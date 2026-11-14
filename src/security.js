/**
 * @file src/security.js
 * @description Enterprise-grade sanitization, CSV formula anti-injection, and DOM security primitives.
 */

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 Megabytes
const ALLOWED_EXTENSIONS = Object.freeze(['.csv', '.tsv', '.json', '.txt', '.md']);

/**
 * Escapes raw strings for safe rendering in text or attribute contexts.
 * @param {unknown} value - Value to escape
 * @returns {string} Sanitized string
 */
export function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strips leading characters that trigger CSV / Spreadsheet Formula Injection in Excel, LibreOffice, or Google Sheets.
 * @param {unknown} cell - Raw cell content
 * @returns {string} Sanitized cell string safe from execution
 */
export function sanitizeCell(cell) {
  if (cell === null || cell === undefined) return '';
  // Strip null bytes and ASCII control characters (C0/C1)
  let str = String(cell).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  // Strip dangerous spreadsheet formula execution triggers
  while (str.length > 0 && /^[=+\-@\t\r%|]/.test(str)) {
    str = str.substring(1).trim();
  }
  return str;
}

/**
 * Validates uploaded user files against whitelist rules and memory thresholds.
 * @param {File} file - Browser File object
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUploadFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected for upload.' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds 2 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`
    };
  }
  const fileName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (!hasValidExt) {
    return {
      valid: false,
      error: `Unsupported file format. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }
  return { valid: true };
}

/**
 * Safely sets text content on a target DOM element without triggering HTML parsing.
 * @param {HTMLElement|null} element - Target DOM element
 * @param {unknown} text - Plain text value
 */
export function safeSetText(element, text) {
  if (!element) return;
  element.textContent = text === null || text === undefined ? '' : String(text);
}

/**
 * Factory for creating DOM elements with strict attribute validation (disallows on* inline handlers).
 * @param {string} tag - HTML tag name
 * @param {Record<string, string|number|boolean>} [attributes={}] - Safe attribute key-values
 * @param {Array<Node|string>} [children=[]] - Child nodes or string text nodes
 * @returns {HTMLElement} Safely constructed DOM element
 */
export function createSafeElement(tag, attributes = {}, children = []) {
  const el = document.createElement(tag);

  for (const [key, val] of Object.entries(attributes)) {
    const lowerKey = key.toLowerCase();
    // Prohibit inline event attributes (e.g. onclick, onerror) to prevent script injection
    if (lowerKey.startsWith('on')) {
      continue;
    }
    // Prohibit javascript:, vbscript:, and data: URLs in href/src to prevent DOM-based XSS
    if ((lowerKey === 'href' || lowerKey === 'src') && /^javascript:|^vbscript:|^data:text\/html/i.test(String(val).trim())) {
      continue;
    }
    if (typeof val === 'boolean') {
      if (val) el.setAttribute(key, '');
    } else if (val !== null && val !== undefined) {
      el.setAttribute(key, String(val));
    }
  }

  for (const child of children) {
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }

  return el;
}
