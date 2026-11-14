/**
 * @file src/aqi-engine.js
 * @description Ingestion parser, unit converter, NAQI sub-index engine, and EEA physics reliability triage.
 */

import {
  NAQI_BREAKPOINTS,
  GAS_TO_UGM3_FACTORS,
  SENSOR_PHYSICS_THRESHOLDS
} from './constants.js';
import { sanitizeCell } from './security.js';

/**
 * Calculates India NAQI sub-index using standard linear piecewise interpolation.
 * @param {string} pollutant - 'pm25' | 'pm10' | 'no2' | 'so2'
 * @param {number} concentration - Value in ug/m3
 * @returns {{ subIndex: number, label: string, color: string }}
 */
export function calculateNAQISubIndex(pollutant, concentration) {
  const table = NAQI_BREAKPOINTS[pollutant.toLowerCase()];
  if (!table || typeof concentration !== 'number' || isNaN(concentration) || concentration < 0) {
    return { subIndex: 0, label: 'Unknown', color: '#64748b' };
  }

  for (const bp of table) {
    if (concentration >= bp.low && concentration <= bp.high) {
      const index = Math.round(
        ((bp.aqiHigh - bp.aqiLow) / (bp.high - bp.low)) * (concentration - bp.low) + bp.aqiLow
      );
      return { subIndex: index, label: bp.label, color: bp.color };
    }
  }

  // Value exceeds top band
  const top = table[table.length - 1];
  return { subIndex: 500, label: top.label, color: top.color };
}

/**
 * Normalizes dirty pollutant strings with units into standardized numeric ug/m3.
 * @param {string|number|null} raw - Raw input cell
 * @param {string} pollutantType - 'pm25' | 'pm10' | 'no2' | 'so2'
 * @returns {number|null} Normalized value in ug/m3 or null if missing/corrupt
 */
export function normalizeConcentration(raw, pollutantType = 'pm25') {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim().toLowerCase();
  if (['missing', 'null', 'n/a', 'na', '-', '-999', 'nan', 'error'].includes(str)) {
    return null;
  }

  const numMatch = str.match(/[-+]?\d*\.?\d+/);
  if (!numMatch) return null;
  const val = parseFloat(numMatch[0]);
  if (isNaN(val)) return null;

  if (str.includes('mg/m3')) return val * GAS_TO_UGM3_FACTORS.mgm3_to_ugm3;
  if (str.includes('ppm')) {
    if (pollutantType === 'so2') return val * GAS_TO_UGM3_FACTORS.so2_ppm;
    if (pollutantType === 'no2') return val * GAS_TO_UGM3_FACTORS.no2_ppm;
    return val * 1000;
  }
  if (str.includes('ppb')) {
    if (pollutantType === 'no2') return val * GAS_TO_UGM3_FACTORS.no2_ppb;
    return val * 1.5;
  }
  return val;
}

/**
 * Parses raw text tables (CSV, TSV, or Markdown pipes) into row objects.
 * @param {string} rawText - Unstructured or tabular text
 * @returns {Array<Record<string, string>>} Sanitized raw row records
 */
export function parseRawTable(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  // Determine separator (comma, tab, or pipe)
  const headerLine = lines[0];
  let delimiter = ',';
  if (headerLine.includes('\t')) delimiter = '\t';
  else if (headerLine.includes('|')) delimiter = '|';

  let rawHeaderCells = headerLine.split(delimiter).map((h) => sanitizeCell(h).replace(/\|/g, '').trim().toLowerCase());
  if (delimiter === '|') {
    if (rawHeaderCells[0] === '') rawHeaderCells.shift();
    if (rawHeaderCells[rawHeaderCells.length - 1] === '') rawHeaderCells.pop();
  }
  const headers = rawHeaderCells.filter((h) => h.length > 0);

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.includes('---')) continue; // Skip markdown divider
    let cells = row.split(delimiter).map((c) => sanitizeCell(c).replace(/\|/g, '').trim());
    if (delimiter === '|') {
      if (cells[0] === '') cells.shift();
      if (cells[cells.length - 1] === '') cells.pop();
    }
    if (cells.length < 2) continue;

    const rowObj = {};
    headers.forEach((hdr, idx) => {
      rowObj[hdr] = cells[idx] !== undefined ? cells[idx] : '';
    });
    parsed.push(rowObj);
  }
  return parsed;
}

/**
 * Audits a telemetry row against EEA physics rules, sensor drift, and humidity biases.
 * @param {number|null} pm25 - Normalized PM2.5 in ug/m3
 * @param {number|null} rh - Relative Humidity %
 * @param {number|null} temp - Temperature in Celsius
 * @param {string} sensorType - Type descriptor
 * @param {number} zScore - Statistical Z-Score
 * @returns {Array<string>} List of physics/reliability badges
 */
export function evaluateEEAReliabilityFlags(pm25, rh, temp, sensorType, zScore) {
  const flags = [];

  if (pm25 === null) {
    flags.push('[Missing Reading / Data Gap]');
    return flags;
  }

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

  if (sensorType && sensorType.toLowerCase().includes('regulatory')) {
    flags.push('[Verified Reference Standard]');
  } else {
    flags.push('[Low-Cost Citizen Sensor]');
  }

  return flags;
}

/**
 * Ingests, normalizes, and computes AQI and EEA physics metrics for all rows.
 * @param {string} rawText - Raw input text
 * @returns {{ rows: Array<any>, meanPM25: number, summary: Record<string, any> }}
 */
export function processCivicTelemetry(rawText) {
  const rawRows = parseRawTable(rawText);
  if (rawRows.length === 0) {
    return { rows: [], meanPM25: 0, summary: { total: 0, valid: 0, gaps: 0 } };
  }

  // Resolve column keys once for O(1) constant-time property lookups
  const sampleKeys = Object.keys(rawRows[0] || {});
  const locKey = sampleKeys.find((k) => k.includes('loc') || k.includes('ward') || k.includes('site')) || 'location';
  const pm25Key = sampleKeys.find((k) => k.includes('pm2.5') || k.includes('pm25')) || 'pm2.5';
  const pm10Key = sampleKeys.find((k) => k.includes('pm10')) || 'pm10';
  const no2Key = sampleKeys.find((k) => k.includes('no2')) || 'no2';
  const rhKey = sampleKeys.find((k) => k.includes('rh') || k.includes('humid')) || 'rh_pct';
  const tempKey = sampleKeys.find((k) => k.includes('temp')) || 'temp_c';
  const typeKey = sampleKeys.find((k) => k.includes('type') || k.includes('model')) || 'sensor_type';

  // First pass: Calculate mean and standard deviation for Z-scores
  const pmValues = [];
  rawRows.forEach((r) => {
    const pmVal = normalizeConcentration(r[pm25Key], 'pm25');
    if (pmVal !== null) pmValues.push(pmVal);
  });

  const mean = pmValues.length > 0 ? pmValues.reduce((a, b) => a + b, 0) / pmValues.length : 0;
  const variance = pmValues.length > 1
    ? pmValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (pmValues.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance) || 1;

  let gaps = 0;
  const processedRows = rawRows.map((r, index) => {
    const location = r[locKey] || `Ward-${index + 1}`;
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

    return {
      rowIndex: index + 1,
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
    };
  });

  return {
    rows: processedRows,
    meanPM25: Math.round(mean),
    summary: { total: processedRows.length, valid: processedRows.length - gaps, gaps }
  };
}

/**
 * Compares current processed rows with baseline snapshot for delta calculations.
 * @param {Array<any>} currentRows - Processed current records
 * @param {Array<any>} baselineRows - Processed baseline records
 * @returns {Array<{ location: string, currentAQI: number, prevAQI: number, delta: number, pct: number, status: string }>}
 */
export function calculateShiftDeltas(currentRows, baselineRows) {
  if (!currentRows || !baselineRows) return [];
  const baseMap = new Map();
  baselineRows.forEach((b) => baseMap.set(b.location.toLowerCase(), b));

  return currentRows.map((cur) => {
    const prev = baseMap.get(cur.location.toLowerCase());
    if (!prev) {
      return {
        location: cur.location,
        currentAQI: cur.aqi,
        prevAQI: 0,
        delta: 0,
        pct: 0,
        status: 'New Hotspot ★'
      };
    }
    const delta = cur.aqi - prev.aqi;
    const pct = prev.aqi > 0 ? Math.round((delta / prev.aqi) * 100) : 0;
    let status = 'Stable →';
    if (delta > 10) status = 'Deteriorating ↑';
    else if (delta < -10) status = 'Improving ↓';

    return {
      location: cur.location,
      currentAQI: cur.aqi,
      prevAQI: prev.aqi,
      delta,
      pct,
      status
    };
  });
}
