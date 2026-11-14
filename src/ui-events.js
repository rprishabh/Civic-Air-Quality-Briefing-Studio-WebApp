/**
 * @file src/ui-events.js
 * @description Cached DOM query registry, input debouncing, and row highlighting controllers.
 */

/**
 * Creates a debounced version of a callback function.
 * @param {(...args: any[]) => void} fn - Target function
 * @param {number} delayMs - Milliseconds to delay
 * @returns {(...args: any[]) => void} Debounced function
 */
export function debounce(fn, delayMs = 250) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delayMs);
  };
}

/**
 * Caches all primary DOM element references for high-efficiency rendering.
 * @returns {Record<string, HTMLElement|null>}
 */
export function cacheDOMElements() {
  return {
    rawInput: document.getElementById('raw-input-data'),
    fileInput: document.getElementById('file-upload-input'),
    btnGenerate: document.getElementById('btn-generate'),
    btnPresetA: document.getElementById('btn-preset-a'),
    btnPresetB: document.getElementById('btn-preset-b'),
    btnCopy: document.getElementById('btn-copy-brief'),
    btnPrint: document.getElementById('btn-print-brief'),
    personaSelect: document.getElementById('persona-select'),
    languageSelect: document.getElementById('language-select'),
    readingLevelSelect: document.getElementById('reading-level-select'),
    apiKeyInput: document.getElementById('api-key-input'),
    apiKeyStatusBadge: document.getElementById('api-key-status'),
    telemetryTableContainer: document.getElementById('telemetry-table-container'),
    deltaMatrixContainer: document.getElementById('delta-matrix-container'),
    actionCardsContainer: document.getElementById('action-cards-container'),
    citizenAdvisoryContainer: document.getElementById('citizen-advisory-container'),
    technicalBriefContainer: document.getElementById('technical-brief-container'),
    provenanceBadge: document.getElementById('provenance-badge'),
    provenanceLatency: document.getElementById('provenance-latency'),
    iitDelhiResultContainer: document.getElementById('iit-delhi-result')
  };
}

/**
 * Smoothly scrolls to a specific telemetry row and applies an accessible highlight pulse.
 * @param {number} rowIndex - 1-based index of row
 */
export function highlightTelemetryRow(rowIndex) {
  const rowId = `telemetry-row-${rowIndex}`;
  const rowEl = document.getElementById(rowId);
  if (!rowEl) return;

  // Remove previous highlights
  document.querySelectorAll('.telemetry-data-row.highlighted').forEach((r) => {
    r.classList.remove('highlighted');
  });

  rowEl.classList.add('highlighted');
  rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  rowEl.focus();

  setTimeout(() => {
    rowEl.classList.remove('highlighted');
  }, 4000);
}
