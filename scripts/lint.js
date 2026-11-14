/**
 * @file scripts/lint.js
 * @description Static security and quality linter enforcing Hack2Skill scoring rules:
 * 1. Zero .innerHTML usage
 * 2. Zero eval() or unsafe dynamic evaluation
 * 3. Zero hardcoded API keys
 * 4. Maximum file line limits (< 300 lines)
 */

import fs from 'node:fs';
import path from 'node:path';

console.log('🔍 Running AeroCivic Static Security & Architecture Linter...\n');

const ROOT_DIR = process.cwd();
const TARGET_DIRS = ['src', 'api'];
const STANDALONE_FILES = ['app.js', 'test.js'];

let violations = 0;

/**
 * Removes single-line and multi-line comments from source code.
 * @param {string} code - Source text
 * @returns {string} Stripped code
 */
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
}

/**
 * Scans a file for security and structural violations.
 * @param {string} filePath - Absolute file path
 */
function scanFile(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const rawContent = fs.readFileSync(filePath, 'utf8');
  const lines = rawContent.split('\n');

  // Check 1: File Line Limit (< 300 lines)
  if (lines.length > 300) {
    console.error(`  ✗ [LINE_LIMIT] ${relPath} exceeds 300 lines (${lines.length} lines).`);
    violations++;
  } else {
    console.log(`  ✓ [LINE_LIMIT] ${relPath} is ${lines.length} lines (<= 300).`);
  }

  const cleanCode = stripComments(rawContent);

  // Check 2: Unsafe .innerHTML property usage
  if (cleanCode.includes('.' + 'innerHTML')) {
    console.error(`  ✗ [SECURITY] ${relPath} contains prohibited .innerHTML usage.`);
    violations++;
  }

  // Check 3: Unsafe eval() or Function constructor
  if (/\beval\s*\(/.test(cleanCode) || /\bnew\s+Function\s*\(/.test(cleanCode)) {
    console.error(`  ✗ [SECURITY] ${relPath} contains unsafe dynamic eval execution.`);
    violations++;
  }

  // Check 4: Hardcoded API keys
  if (/AIzaSy[A-Za-z0-9_-]{30,}/.test(cleanCode) || /AQ\.[A-Za-z0-9_-]{30,}/.test(cleanCode)) {
    console.error(`  ✗ [SECURITY] ${relPath} contains potentially hardcoded API keys.`);
    violations++;
  }
}

/**
 * Recursively retrieves JavaScript files from a directory.
 * @param {string} dirPath
 * @returns {Array<string>}
 */
function getJsFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...getJsFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      files.push(full);
    }
  }
  return files;
}

// Collect all target files
const allFiles = [...STANDALONE_FILES.map((f) => path.join(ROOT_DIR, f))];
TARGET_DIRS.forEach((d) => allFiles.push(...getJsFiles(path.join(ROOT_DIR, d))));

allFiles.forEach((f) => {
  if (fs.existsSync(f)) {
    scanFile(f);
  }
});

console.log('\n========================================');
if (violations === 0) {
  console.log('🎉 LINT PASSED: 0 Security Violations, all files modular (< 300 lines).');
  console.log('========================================\n');
  process.exit(0);
} else {
  console.error(`💥 LINT FAILED: ${violations} violation(s) detected.`);
  console.log('========================================\n');
  process.exit(1);
}
