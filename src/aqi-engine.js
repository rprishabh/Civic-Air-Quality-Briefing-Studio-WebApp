/**
 * @file src/aqi-engine.js
 * @description Ingestion parser, unit converter, NAQI sub-index engine, and EEA physics triage.
 */

import { NAQI_BREAKPOINTS, GAS_TO_UGM3_FACTORS, SENSOR_PHYSICS_THRESHOLDS } from './constants.js';
import { sanitizeCell } from './security.js';

/** Bounded memoization caches (max 50 entries) */
const _subIndexCache = new Map();
const _parseCache = new Map();
const MAX_CACHE_ENTRIES = 50;

/**
 * Inserts key-value into bounded map evicting oldest if full.
 * @param {Map<string, any>} map
 * @param {string} key
 * @param {any} val
 */
function setBoundedCache(map, key, val) {
  if (map.size >= MAX_CACHE_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, val);
}

/**
 * Calculates India NAQI sub-index using linear piecewise interpolation (O(1) memoized).
 * @param {string} pollutant - 'pm25' | 'pm10' | 'no2' | 'so2'
 * @param {number} concentration - Value in ug/m3
 * @returns {{ subIndex: number, label: string, color: string }}
 */
export function calculateNAQISubIndex(pollutant, concentration) {
  const norm = typeof pollutant === 'string' ? pollutant.toLowerCase() : '';
  const cacheKey = `${norm}:${concentration}`;
  if (_subIndexCache.has(cacheKey)) return _subIndexCache.get(cacheKey);

  const table = NAQI_BREAKPOINTS[norm];
  if (!table || typeof concentration !== 'number' || isNaN(concentration) || concentration < 0) {
    const res = { subIndex: 0, label: 'Unknown', color: '#64748b' };
    setBoundedCache(_subIndexCache, cacheKey, res);
    return res;
  }

  for (const bp of table) {
    if (concentration >= bp.low && concentration <= bp.high) {
      const idx = Math.round(((bp.aqiHigh - bp.aqiLow) / (bp.high - bp.low)) * (concentration - bp.low) + bp.aqiLow);
      const res = { subIndex: idx, label: bp.label, color: bp.color };
      setBoundedCache(_subIndexCache, cacheKey, res);
      return res;
    }
  }

  const top = table[table.length - 1];
  const maxRes = { subIndex: 500, label: top.label, color: top.color };
  setBoundedCache(_subIndexCache, cacheKey, maxRes);
  return maxRes;
}

/**
 * Normalizes dirty pollutant strings with units into standardized numeric ug/m3.
 * @param {string|number|null} raw - Raw input cell
 * @param {string} pollutantType - 'pm25' | 'pm10' | 'no2' | 'so2'
 * @returns {number|null}
 */
export function normalizeConcentration(raw, pollutantType = 'pm25') {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim().toLowerCase();
  if (['missing', 'null', 'n/a', 'na', '-', '-999', 'nan', 'error'].includes(str)) return null;

  const numMatch = str.match(/[-+]?\d*\.?\d+/);
  if (!numMatch) return null;
  const val = parseFloat(numMatch[0]);
  if (isNaN(val)) return null;

  if (str.includes('mg/m3')) return val * GAS_TO_UGM3_FACTORS.mgm3_to_ugm3;
  if (str.includes('ppm')) {
    if (pollutantType === 'so2') return val * GAS_TO_UGM3_FACTORS.so2_ppm;
    return pollutantType === 'no2' ? val * GAS_TO_UGM3_FACTORS.no2_ppm : val * 1000;
  }
  if (str.includes('ppb')) {
    return pollutantType === 'no2' ? val * GAS_TO_UGM3_FACTORS.no2_ppb : val * 1.5;
  }
  return val;
}

/**
 * Parses raw messy tabular text into row objects (O(1) memoized).
 * @param {string} rawText - Tabular text
 * @returns {Array<Record<string, string>>}
 */
export function parseRawTable(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  if (_parseCache.has(rawText)) return _parseCache.get(rawText);

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  let delimiter = ',';
  if (headerLine.includes('\t')) delimiter = '\t';
  else if (headerLine.includes('|')) delimiter = '|';

  let rawHeaders = headerLine.split(delimiter).map((h) => sanitizeCell(h).replace(/\|/g, '').trim().toLowerCase());
  if (delimiter === '|') {
    if (rawHeaders[0] === '') rawHeaders.shift();
    if (rawHeaders[rawHeaders.length - 1] === '') rawHeaders.pop();
  }
  const headers = rawHeaders.filter((h) => h.length > 0);

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.includes('---')) continue;
    let cells = row.split(delimiter).map((c) => sanitizeCell(c).replace(/\|/g, '').trim());
    if (delimiter === '|') {
      if (cells[0] === '') cells.shift();
      if (cells[cells.length - 1] === '') cells.pop();
    }
    if (cells.length < 2) continue;

    const rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = cells[j] !== undefined ? cells[j] : '';
    }
    parsed.push(rowObj);
  }

  setBoundedCache(_parseCache, rawText, parsed);
  return parsed;
}

/** Alias for parseRawTable supporting messy data ingestion benchmarks */
export const parseMessyData = parseRawTable;

/**
 * Audits a telemetry row against EEA physics rules, sensor drift, and humidity biases.
 * @param {number|null} pm25 - PM2.5 in ug/m3
 * @param {number|null} rh - Relative Humidity %
 * @param {number|null} temp - Temperature in Celsius
 * @param {string} sensorType - Type descriptor
 * @param {number} zScore - Statistical Z-Score
 * @returns {Array<string>} Badges
 */
export function evaluateEEAReliabilityFlags(pm25, rh, temp, sensorType, zScore) {
  const flags = [];
  if (pm25 === null) return ['[Missing Reading / Data Gap]'];

  const isLowCost = !sensorType || sensorType.toLowerCase().includes('lowcost') || sensorType.toLowerCase().includes('optical');
  if (rh !== null && rh >= SENSOR_PHYSICS_THRESHOLDS.humidity_optical_pm_bias && isLowCost) {
    flags.push('[RH > 80% Optical PM Bias]');
  }
  if (temp !== null && temp >= SENSOR_PHYSICS_THRESHOLDS.temp_electrochemical_drift) {
    flags.push('[Temp > 38°C Electrochemical Drift]');
  }
  if (Math.abs(zScore) >= SENSOR_PHYSICS_THRESHOLDS.zscore_outlier_cutoff) {
    flags.push('[Outlier / Z-Score > 2.5 Spike]');
  }
  flags.push(sensorType && sensorType.toLowerCase().includes('regulatory') ? '[Verified Reference Standard]' : '[Low-Cost Citizen Sensor]');
  return flags;
}

/**
 * Ingests, normalizes, and computes AQI and EEA physics metrics in single-pass loops.
 * @param {string} rawText - Raw input text
 * @returns {{ rows: Array<any>, meanPM25: number, summary: Record<string, any> }}
 */
export function processCivicTelemetry(rawText) {
  const rawRows = parseRawTable(rawText);
  if (rawRows.length === 0) {
    return { rows: [], meanPM25: 0, summary: { total: 0, valid: 0, gaps: 0 } };
  }

  const sampleKeys = Object.keys(rawRows[0] || {});
  const locKey = sampleKeys.find((k) => k.includes('loc') || k.includes('ward') || k.includes('site')) || 'location';
  const pm25Key = sampleKeys.find((k) => k.includes('pm2.5') || k.includes('pm25')) || 'pm2.5';
  const pm10Key = sampleKeys.find((k) => k.includes('pm10')) || 'pm10';
  const no2Key = sampleKeys.find((k) => k.includes('no2')) || 'no2';
  const rhKey = sampleKeys.find((k) => k.includes('rh') || k.includes('humid')) || 'rh_pct';
  const tempKey = sampleKeys.find((k) => k.includes('temp')) || 'temp_c';
  const typeKey = sampleKeys.find((k) => k.includes('type') || k.includes('model')) || 'sensor_type';

  let sumPM = 0;
  let countPM = 0;
  for (const r of rawRows) {
    const val = normalizeConcentration(r[pm25Key], 'pm25');
    if (val !== null) {
      sumPM += val;
      countPM++;
    }
  }

  const mean = countPM > 0 ? sumPM / countPM : 0;
  let varianceSum = 0;
  if (countPM > 1) {
    for (const r of rawRows) {
      const val = normalizeConcentration(r[pm25Key], 'pm25');
      if (val !== null) varianceSum += Math.pow(val - mean, 2);
    }
  }
  const stdDev = countPM > 1 ? Math.sqrt(varianceSum / (countPM - 1)) : 1;

  let gaps = 0;
  const processedRows = [];
  let index = 0;

  for (const r of rawRows) {
    index++;
    const location = r[locKey] || `Ward-${index}`;
    const pm25 = normalizeConcentration(r[pm25Key], 'pm25');
    const pm10 = normalizeConcentration(r[pm10Key], 'pm10');
    const no2 = normalizeConcentration(r[no2Key], 'no2');
    const rh = normalizeConcentration(r[rhKey]);
    const temp = normalizeConcentration(r[tempKey]);
    const sensorType = r[typeKey] || 'LowCost_Optical';

    if (pm25 === null) gaps++;

    const zScore = pm25 !== null ? (pm25 - mean) / stdDev : 0;
    const flags = evaluateEEAReliabilityFlags(pm25, rh, temp, sensorType, zScore);
    const subPm25 = calculateNAQISubIndex('pm25', pm25 || 0);
    const subPm10 = calculateNAQISubIndex('pm10', pm10 || 0);
    const dominantSub = subPm25.subIndex >= subPm10.subIndex ? subPm25 : subPm10;

    processedRows.push({
      rowIndex: index,
      location,
      pm25,
      pm10,
      no2,
      rh,
      temp,
      sensorType,
      aqi: dominantSub.subIndex,
      category: dominantSub.label,
      color: dominantSub.color,
      flags,
      raw: r
    });
  }

  return {
    rows: processedRows,
    meanPM25: Math.round(mean),
    summary: { total: processedRows.length, valid: processedRows.length - gaps, gaps }
  };
}

/**
 * Compares current processed rows with baseline snapshot in single-pass O(N) loop.
 * @param {Array<any>} currentRows - Processed current records
 * @param {Array<any>} baselineRows - Processed baseline records
 * @returns {Array<{ location: string, currentAQI: number, prevAQI: number, delta: number, pct: number, status: string }>}
 */
export function calculateShiftDeltas(currentRows, baselineRows) {
  if (!currentRows || !baselineRows) return [];
  const baseMap = new Map();
  for (const b of baselineRows) {
    baseMap.set(b.location.toLowerCase(), b);
  }

  const deltas = [];
  for (const cur of currentRows) {
    const prev = baseMap.get(cur.location.toLowerCase());
    if (!prev) {
      deltas.push({
        location: cur.location,
        currentAQI: cur.aqi,
        prevAQI: 0,
        delta: 0,
        pct: 0,
        status: 'New Hotspot ★'
      });
      continue;
    }
    const delta = cur.aqi - prev.aqi;
    const pct = prev.aqi > 0 ? Math.round((delta / prev.aqi) * 100) : 0;
    let status = 'Stable →';
    if (delta > 10) status = 'Deteriorating ↑';
    else if (delta < -10) status = 'Improving ↓';

    deltas.push({
      location: cur.location,
      currentAQI: cur.aqi,
      prevAQI: prev.aqi,
      delta,
      pct,
      status
    });
  }

  return deltas;
}
