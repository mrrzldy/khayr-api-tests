/**
 * scripts/run-combined-report.js
 *
 * Finds the latest api_results_*.json and ui_results_*.json in the reports/
 * folder and generates a combined HTML + PDF report from them.
 *
 * Usage:
 *   node scripts/run-combined-report.js
 *   npm run test:combined:report
 *
 * Output:
 *   reports/combined_report_YYYY-MM-DD_HH-MM-SS.html
 *   reports/combined_report_YYYY-MM-DD_HH-MM-SS.pdf
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { execSync } = require('child_process');

const pad = n => String(n).padStart(2, '0');
const now = new Date();
const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

const reportsDir = path.join(__dirname, '..', 'reports');

// ── Find latest JSON files ────────────────────────────────────────────────────
function findLatest(prefix) {
  if (!fs.existsSync(reportsDir)) return null;
  const files = fs.readdirSync(reportsDir)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length ? path.join(reportsDir, files[0]) : null;
}

const apiJson = findLatest('api_results_');
const uiJson  = findLatest('ui_results_');

if (!apiJson) {
  console.error('❌ No api_results_*.json found in reports/. Run npm run test:api:report first.');
  process.exit(1);
}
if (!uiJson) {
  console.error('❌ No ui_results_*.json found in reports/. Run npm run test:ui:report first.');
  process.exit(1);
}

console.log('\n========================================');
console.log(`  Khayr Combined Report — ${timestamp}`);
console.log('========================================');
console.log(`  API: ${path.basename(apiJson)}`);
console.log(`  UI : ${path.basename(uiJson)}`);
console.log('========================================\n');

const generatorScript = path.join(__dirname, 'generate-combined-report.js');

try {
  execSync(
    `node "${generatorScript}" "${apiJson}" "${uiJson}" "${reportsDir}" "${timestamp}"`,
    { stdio: 'inherit', cwd: path.join(__dirname, '..') }
  );
} catch (err) {
  console.error(`❌ Combined report generation failed: ${err.message}`);
  process.exit(1);
}

console.log('\n========================================');
console.log(`  Combined report saved to: ${reportsDir}`);
console.log('========================================\n');
