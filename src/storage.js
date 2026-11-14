/**
 * @file src/storage.js
 * @description In-memory snapshot comparison history and safe JSON data export/import utilities.
 */

import { sanitizeCell } from './security.js';

/** In-memory cache of saved briefing snapshots */
const _snapshotStore = new Map();

/**
 * Saves a named snapshot in memory.
 * @param {string} name - Snapshot name identifier
 * @param {any} data - Telemetry or briefing payload
 */
export function saveMemorySnapshot(name, data) {
  if (!name || typeof name !== 'string') return;
  _snapshotStore.set(name.trim(), JSON.parse(JSON.stringify(data)));
}

/**
 * Retrieves a named snapshot from memory.
 * @param {string} name - Snapshot identifier
 * @returns {any|null} Cloned snapshot data or null
 */
export function getMemorySnapshot(name) {
  const data = _snapshotStore.get(name.trim());
  return data ? JSON.parse(JSON.stringify(data)) : null;
}

/**
 * Exports data object as a downloadable sanitized JSON file.
 * @param {string} filename - Output file name
 * @param {any} data - Object to export
 */
export function exportSanitizedJSON(filename, data) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeCell(filename) || 'briefing-report.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Clears in-memory snapshot caches.
 */
export function clearMemorySnapshots() {
  _snapshotStore.clear();
}
