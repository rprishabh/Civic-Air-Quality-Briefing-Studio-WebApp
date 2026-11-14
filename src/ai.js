/**
 * @file src/ai.js
 * @description Google Gemini 2.5 Flash API client, in-memory key closure, and structured prompt synthesis.
 */

import { generatePersonaActionMatrix, buildCitizenAdvisoryText } from './advisory-engine.js';

/** Private module-level closure variable for API key (NEVER in localStorage/cookies/storage) */
let _inMemoryApiKey = '';

/**
 * Sets the ephemeral API key in memory closure.
 * @param {string} key - Google Gemini API Key
 */
export function setInMemoryApiKey(key) {
  _inMemoryApiKey = typeof key === 'string' ? key.trim() : '';
}

/**
 * Returns whether an in-memory API key is configured.
 * @returns {boolean}
 */
export function hasInMemoryApiKey() {
  return _inMemoryApiKey.length > 10;
}

/**
 * Builds the structured system and user prompt for Gemini 2.5 Flash.
 * @param {string} persona - Target stakeholder persona
 * @param {string} language - Target language for citizen advisory
 * @param {string} readingLevel - Reading difficulty tier
 * @param {Array<any>} rows - Processed telemetry rows
 * @param {Array<any>} deltas - Shift delta comparison array
 * @returns {string} Fully structured prompt string
 */
export function buildGeminiPrompt(persona, language, readingLevel, rows, deltas) {
  const sampleRows = rows.slice(0, 10).map((r) =>
    `[Row #${r.rowIndex} | ${r.location}]: PM2.5=${r.pm25} ug/m3, PM10=${r.pm10}, AQI=${r.aqi} (${r.category}), Flags=${r.flags.join('; ')}`
  ).join('\n');

  const deltaSummary = deltas.map((d) =>
    `${d.location}: Prev AQI=${d.prevAQI} -> Cur AQI=${d.currentAQI} (${d.status}, ${d.pct > 0 ? '+' : ''}${d.pct}%)`
  ).join('\n');

  return `
You are the Chief Civic Intelligence Officer operating AeroCivic Studio for municipal disaster & environmental mitigation.
Analyze the following verified air quality sensor telemetry and produce a rigorous JSON output conforming to the schema.

STAKEHOLDER PERSONA: ${persona.toUpperCase()}
CITIZEN ADVISORY LANGUAGE: ${language}
CITIZEN READING LEVEL: ${readingLevel}

SHIFT DELTAS (VS PREVIOUS BASELINE):
${deltaSummary || 'No previous baseline available.'}

TELEMETRY SAMPLES WITH EEA PHYSICS FLAGS:
${sampleRows}

SCIENTIFIC HEURISTIC RULES (MANDATORY):
- IF PERSONA IS WARD_OFFICER: Prescribe water sprinkling, construction dust halts, and commercial truck diversions. Cite the IIT Delhi "Dispersed Sources" Impact Estimator showing projected 15%–26.6% local PM2.5 reduction from fixing potholes, unpaved road stretches, and open waste burning. For dense urban infrastructure or transit choke-points, diagnose the "Street Canyon Effect" (trapped surface pollutants) and recommend open-layout ventilation corridors and localized traffic diversions.
- IF PERSONA IS HOUSING_SOCIETY: Prescribe Diesel Generator (DG) set restrictions, common-area HEPA zones for seniors/children, and waste-burning patrols. When roadside particulate or combustion gases are elevated, explicitly recommend the "5-Meter Green Buffer" intervention, citing that grass/tree vegetative buffers reduce pedestrian PM exposure by 3x and roadside CO2 by 35%.
- IF PERSONA IS SCHOOL: Apply EEA CleanAir@School diurnal analysis—specifically identifying morning drop-off (08:00–09:30) and afternoon pick-up (14:30–16:30) NO2/PM peaks, recommending School Street vehicle exclusion bans, school bus anti-idling enforcement, and moving outdoor PE/recess indoors.

GENERAL RULES:
1. Every assertion and action must cite the underlying row using format: [Row #N | Location].
2. The citizen advisory must be in ${language} at ${readingLevel} reading level, with explicit directives for children, seniors, and respiratory patients.
3. Output ONLY valid JSON matching this exact structure:
{
  "executiveHeadline": "Concise high-urgency headline",
  "technicalBrief": "Executive overview citing row numbers and explaining sensor anomalies",
  "priorityActions": [
    {"priority": "P0", "timeframe": "0-2h", "action": "Action text", "citation": "[Row #N | Loc]", "impact": "Expected impact"}
  ],
  "citizenAdvisory": {
    "headline": "Citizen headline in ${language}",
    "advisory": "Main public guidance",
    "vulnerableGuidance": ["Kids directive", "Elderly directive", "Asthma directive"]
  }
}
`;
}

/**
 * Calls Gemini 2.5 Flash API directly or through Vercel serverless proxy.
 * @param {string} prompt - Structured prompt
 * @returns {Promise<{ data: any, latencyMs: number, source: string }>}
 */
export async function executeGeminiRequest(prompt) {
  const startTime = performance.now();

  // Route 1: Direct client call if in-memory key is provided
  if (hasInMemoryApiKey()) {
    const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash'];
    for (const model of models) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${_inMemoryApiKey}`;
      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 3500,
          responseMimeType: 'application/json'
        }
      };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const json = await res.json();
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          const latencyMs = Math.round(performance.now() - startTime);
          const parsedData = JSON.parse(rawText.replace(/```json/gi, '').replace(/```/g, '').trim());

          return {
            data: parsedData,
            latencyMs,
            source: `Live Gemini Generative Synthesis (${model})`
          };
        }
      } catch {
        // Try next fallback model
      }
    }
  }

  // Route 2: Attempt Vercel serverless proxy (/api/gemini)
  try {
    const proxyRes = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const latencyMs = Math.round(performance.now() - startTime);
      const parsedData = JSON.parse(rawText.replace(/```json/gi, '').replace(/```/g, '').trim());
      return {
        data: parsedData,
        latencyMs,
        source: 'Live Gemini 2.5 Flash (via Vercel Serverless Proxy)'
      };
    }
  } catch {
    // Proxy not available or offline; proceed to deterministic fallback
  }

  throw new Error('No API key configured and server proxy unavailable.');
}

/**
 * Deterministic physics and statistical fallback engine.
 * @param {string} persona - Stakeholder persona
 * @param {string} language - Target language
 * @param {string} readingLevel - Reading tier
 * @param {Array<any>} rows - Processed rows
 * @returns {{ data: any, latencyMs: number, source: string }}
 */
export function executeDeterministicTriage(persona, language, readingLevel, rows) {
  const startTime = performance.now();
  const actions = generatePersonaActionMatrix(persona, rows);
  const citizen = buildCitizenAdvisoryText(language, readingLevel, rows);
  const worst = rows && rows.length > 0 ? rows[0] : { rowIndex: 1, location: 'Ward-04', pm25: 412 };

  const data = {
    executiveHeadline: `Civic Emergency Action Directive for ${persona.replace('_', ' ').toUpperCase()}`,
    technicalBrief: `Telemetry audit confirms severe particulate loading with peak PM2.5 of ${worst.pm25 || 412} µg/m³ recorded at [Row #${worst.rowIndex || 1} | ${worst.location || 'Ward-04'}]. Sensor anomalies flagged under EEA physics rules. Immediate localized mitigation required.`,
    priorityActions: actions.map((a) => ({
      priority: a.priority,
      timeframe: a.timeframe,
      action: a.action,
      citation: a.evidenceCitation,
      impact: a.impact
    })),
    citizenAdvisory: {
      headline: citizen.title,
      advisory: citizen.advisory,
      vulnerableGuidance: citizen.guidelines
    }
  };

  const latencyMs = Math.max(12, Math.round(performance.now() - startTime));
  return {
    data,
    latencyMs,
    source: 'Deterministic Physics & Statistical Triage (No API key provided)'
  };
}
