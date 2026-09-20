/**
 * scripts/run-api-report.js
 *
 * Runs Playwright API tests and generates custom HTML + PDF + TXT reports.
 *
 * Usage:
 *   node scripts/run-api-report.js          ← runs --project=api
 *   npm run test:api:report
 *
 * Output (in reports/ folder, timestamped — never overwrites old files):
 *   reports/api_report_YYYY-MM-DD_HH-MM-SS.html   ← full interactive report
 *   reports/api_report_YYYY-MM-DD_HH-MM-SS.pdf    ← printable PDF
 *   reports/api_report_YYYY-MM-DD_HH-MM-SS.txt    ← full TXT log
 *   reports/api_results_YYYY-MM-DD_HH-MM-SS.json  ← raw Playwright JSON (debug)
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs   = require('fs');

const pad = n => String(n).padStart(2, '0');
const now = new Date();
const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

const reportsDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

const jsonOut = path.join(reportsDir, `api_results_${timestamp}.json`);

console.log('\n========================================');
console.log(`  Khayr API Test Run — ${timestamp}`);
console.log('========================================\n');

// ── Step 1: Run tests with list + json reporters only (no built-in html — it blocks) ──
const args = [
  'playwright', 'test', '--project=api',
  '--reporter=list,json',
  `--output=${path.join(reportsDir, `api_artifacts_${timestamp}`)}`,
];

const proc = spawn('npx', args, {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut },
});

let output = '';
proc.stdout.on('data', chunk => { process.stdout.write(chunk); output += chunk.toString(); });
proc.stderr.on('data', chunk => { process.stderr.write(chunk); output += chunk.toString(); });

proc.on('close', async exitCode => {
  console.log(`\nTests finished (exit code: ${exitCode})`);

  // Wait for JSON file to be written by Playwright
  let retries = 15;
  while (!fs.existsSync(jsonOut) && retries-- > 0) {
    await new Promise(r => setTimeout(r, 500));
  }

  if (!fs.existsSync(jsonOut)) {
    console.warn(`⚠️  JSON output not found at ${jsonOut}. Custom report skipped.`);
    process.exit(exitCode);
    return;
  }

  // ── Step 2: Generate custom HTML + PDF reports ──────────────────────────────
  const { execSync } = require('child_process');
  const generatorScript = path.join(__dirname, 'generate-api-report.js');

  try {
    execSync(
      `node "${generatorScript}" "${jsonOut}" "${reportsDir}" "${timestamp}"`,
      { stdio: 'inherit', cwd: path.join(__dirname, '..') }
    );
  } catch (err) {
    console.warn(`⚠️  Custom report generation failed: ${err.message}`);
  }

  // Also save a full TXT of raw stdout
  const rawTxtPath = path.join(reportsDir, `api_report_${timestamp}.txt`);
  if (!fs.existsSync(rawTxtPath)) {
    const header = [
      `Khayr API Test Report`,
      `Run date : ${now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
      `Generated: ${new Date().toISOString()}`,
      `Exit code: ${exitCode}`,
      `========================================\n`,
    ].join('\n');
    fs.writeFileSync(rawTxtPath, header + output, 'utf8');
    console.log(`✅ RAW TXT → ${rawTxtPath}`);
  }

  console.log('\n========================================');
  console.log(`  Reports saved to: ${reportsDir}`);
  console.log('========================================');
  process.exit(exitCode);
});
