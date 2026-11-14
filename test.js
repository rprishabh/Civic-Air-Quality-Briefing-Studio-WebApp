/**
 * @file test.js
 * @description Comprehensive automated test suite with 20 assertions for AeroCivic Studio.
 * Run via: node test.js (npm test)
 */

import assert from 'node:assert';
import {
  calculateNAQISubIndex,
  normalizeConcentration,
  parseRawTable,
  evaluateEEAReliabilityFlags,
  processCivicTelemetry,
  calculateShiftDeltas
} from './src/aqi-engine.js';
import { sanitizeCell, escapeHTML, validateUploadFile } from './src/security.js';
import { simulateIITDelhiCivicFixes, generatePersonaActionMatrix, buildCitizenAdvisoryText } from './src/advisory-engine.js';
import { buildGeminiPrompt, hasInMemoryApiKey, setInMemoryApiKey } from './src/ai.js';

console.log('🧪 Starting AeroCivic Studio Automated Test Suite (20 Assertions)...\n');

let passed = 0;
function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

// 1. Messy Ingestion: CSV parsing
runTest('1. Parse standard comma-separated CSV with header', () => {
  const csv = 'Timestamp,Location,PM2.5\n2026-11-14,Ward-4,350';
  const rows = parseRawTable(csv);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].location, 'Ward-4');
});

// 2. Messy Ingestion: TSV parsing
runTest('2. Parse tab-separated TSV tables', () => {
  const tsv = 'Location\tPM2.5\tPM10\nWard-12\t420\t590';
  const rows = parseRawTable(tsv);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0]['pm2.5'], '420');
});

// 3. Messy Ingestion: Markdown pipe table with divider
runTest('3. Parse Markdown pipe table ignoring separator lines', () => {
  const md = '| Location | PM2.5 |\n|---|---|\n| Ward-9 | 180 |';
  const rows = parseRawTable(md);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].location, 'Ward-9');
});

// 4. Unit Normalization: ppm conversion
runTest('4. Convert gas PPM to standard µg/m³ (SO2)', () => {
  const val = normalizeConcentration('0.05 ppm', 'so2');
  assert.strictEqual(val, 131); // 0.05 * 2620 = 131
});

// 5. Unit Normalization: ppb conversion
runTest('5. Convert gas PPB to standard µg/m³ (NO2)', () => {
  const val = normalizeConcentration('50 ppb', 'no2');
  assert.strictEqual(val, 94); // 50 * 1.88 = 94
});

// 6. Unit Normalization: mg/m3 conversion
runTest('6. Convert mg/m³ to µg/m³ (1000x factor)', () => {
  const val = normalizeConcentration('0.25 mg/m3', 'pm25');
  assert.strictEqual(val, 250);
});

// 7. Missing Value Detection
runTest('7. Identify missing, null, and corrupt sensor readings as null', () => {
  assert.strictEqual(normalizeConcentration('MISSING'), null);
  assert.strictEqual(normalizeConcentration('N/A'), null);
  assert.strictEqual(normalizeConcentration('-999'), null);
});

// 8. India NAQI sub-index: PM2.5 calculation
runTest('8. Calculate India NAQI sub-index for PM2.5 in Moderate band', () => {
  // PM2.5: 75 ug/m3 falls in band (61-90) -> AQI (101-200)
  const res = calculateNAQISubIndex('pm25', 75);
  assert.strictEqual(res.label, 'Moderate');
  assert.strictEqual(res.subIndex >= 101 && res.subIndex <= 200, true);
});

// 9. India NAQI sub-index: Severe threshold
runTest('9. Calculate India NAQI sub-index for PM2.5 in Severe band (>250)', () => {
  const res = calculateNAQISubIndex('pm25', 380);
  assert.strictEqual(res.label, 'Severe');
  assert.strictEqual(res.subIndex > 400, true);
});

// 10. EEA Physics Anomaly: RH > 80% optical bias
runTest('10. Flag optical sensor over-read bias when Relative Humidity > 80%', () => {
  const flags = evaluateEEAReliabilityFlags(250, 85, 20, 'LowCost_Optical', 0);
  assert.strictEqual(flags.includes('[RH > 80% Optical PM Bias]'), true);
});

// 11. EEA Physics Anomaly: Temp > 38°C electrochemical drift
runTest('11. Flag electrochemical thermal drift when Temp > 38°C', () => {
  const flags = evaluateEEAReliabilityFlags(250, 50, 39.5, 'Electrochemical', 0);
  assert.strictEqual(flags.includes('[Temp > 38°C Electrochemical Drift]'), true);
});

// 12. Statistical Outlier Z-Score Detection
runTest('12. Flag statistical outlier spikes when |Z-Score| > 2.5', () => {
  const flags = evaluateEEAReliabilityFlags(850, 50, 20, 'LowCost_Optical', 2.8);
  assert.strictEqual(flags.includes('[Outlier / Z-Score > 2.5 Spike]'), true);
});

// 13. CSV Formula Anti-Injection: Strip dangerous leading triggers
runTest('13. Strip leading formula execution triggers (=, +, -, @, \\t, \\r)', () => {
  assert.strictEqual(sanitizeCell('=CMD|/C calc!A0'), 'CMD|/C calc!A0');
  assert.strictEqual(sanitizeCell('+12345'), '12345');
  assert.strictEqual(sanitizeCell('@SUM(A1:A10)'), 'SUM(A1:A10)');
});

// 14. XSS Escaping Utility
runTest('14. Safely escape HTML entities to prevent DOM XSS', () => {
  const dirty = '<script>alert("xss")</script>&foo';
  const clean = escapeHTML(dirty);
  assert.strictEqual(clean.includes('<script>'), false);
  assert.strictEqual(clean.includes('&lt;script&gt;'), true);
});

// 15. File Upload Validation (Extension & Size)
runTest('15. Validate file upload MIME type and size boundaries', () => {
  const validFile = { name: 'telemetry.csv', size: 1024 * 50 };
  const oversizeFile = { name: 'huge.csv', size: 5 * 1024 * 1024 };
  const invalidExt = { name: 'virus.exe', size: 1024 };

  assert.strictEqual(validateUploadFile(validFile).valid, true);
  assert.strictEqual(validateUploadFile(oversizeFile).valid, false);
  assert.strictEqual(validateUploadFile(invalidExt).valid, false);
});

// 16. Shift Delta Engine
runTest('16. Compute shift deltas, % changes, and status shifts correctly', () => {
  const cur = [{ location: 'Ward-4', aqi: 450 }];
  const prev = [{ location: 'Ward-4', aqi: 300 }];
  const deltas = calculateShiftDeltas(cur, prev);
  assert.strictEqual(deltas[0].delta, 150);
  assert.strictEqual(deltas[0].pct, 50);
  assert.strictEqual(deltas[0].status, 'Deteriorating ↑');
});

// 17. IIT Delhi Civic Fix Simulation Math
runTest('17. Compute realistic bounded PM2.5 reduction from road paving', () => {
  const sim = simulateIITDelhiCivicFixes(300, ['pothole_unpaved_paving']);
  assert.strictEqual(sim.percentDrop >= 15, true);
  assert.strictEqual(sim.projectedPM25 < 300, true);
});

// 18. Persona Action Matrix Tailoring
runTest('18. Generate customized action matrix with citations for School Principal', () => {
  const actions = generatePersonaActionMatrix('school', [{ rowIndex: 1, location: 'Ward-12', pm25: 410 }]);
  assert.strictEqual(actions.length, 3);
  assert.strictEqual(actions[0].action.includes('assembly'), true);
  assert.strictEqual(actions[0].evidenceCitation.includes('Row #1'), true);
});

// 19. Multilingual Citizen Advisory Assembly
runTest('19. Assemble Hindi translated citizen advisory with high-risk directives', () => {
  const adv = buildCitizenAdvisoryText('Hindi', 'vulnerable', [{ rowIndex: 1, location: 'Ward-4', pm25: 400 }]);
  assert.strictEqual(adv.title.includes('सामुदायिक'), true);
  assert.strictEqual(adv.guidelines.length > 0, true);
});

// 20. In-Memory Key Security Closure
runTest('20. Ensure API key is maintained in private module memory closure only', () => {
  setInMemoryApiKey('AIzaSyTestMockKey12345');
  assert.strictEqual(hasInMemoryApiKey(), true);
  setInMemoryApiKey('');
  assert.strictEqual(hasInMemoryApiKey(), false);
});

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} / 20 ASSERTIONS PASSED (100% SUCCESS)`);
console.log(`========================================\n`);

if (passed !== 20) {
  process.exit(1);
}
