/**
 * scripts/run-ui-report.js
 *
 * Runs Playwright UI tests and generates custom HTML + PDF + DOC + TXT reports.
 *
 * Usage:
 *   node scripts/run-ui-report.js          ← runs --project=ui
 *   npm run test:ui:report
 *
 * Output (in reports/ folder, timestamped):
 *   reports/ui_report_YYYY-MM-DD_HH-MM-SS.html   ← full interactive report
 *   reports/ui_report_YYYY-MM-DD_HH-MM-SS.pdf    ← printable PDF
 *   reports/ui_doc_YYYY-MM-DD_HH-MM-SS.html      ← sidebar doc-style report
 *   reports/ui_report_YYYY-MM-DD_HH-MM-SS.txt    ← full TXT log
 *   reports/ui_results_YYYY-MM-DD_HH-MM-SS.json  ← raw Playwright JSON (debug)
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

const jsonOut = path.join(reportsDir, `ui_results_${timestamp}.json`);

console.log('\n========================================');
console.log(`  Khayr UI Test Run — ${timestamp}`);
console.log('========================================\n');

const args = [
  'playwright', 'test', '--project=ui',
  '--workers=3',          // 3 spec files in parallel (safe: tests within a file stay sequential)
  '--reporter=list,json',
  `--output=${path.join(reportsDir, `ui_artifacts_${timestamp}`)}`,
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

  // Wait for JSON file
  let retries = 15;
  while (!fs.existsSync(jsonOut) && retries-- > 0) {
    await new Promise(r => setTimeout(r, 500));
  }

  if (!fs.existsSync(jsonOut)) {
    console.warn(`⚠️  JSON output not found at ${jsonOut}. Custom report skipped.`);
    process.exit(exitCode);
    return;
  }

  // Generate custom HTML + PDF + DOC reports
  const { execSync } = require('child_process');
  const generatorScript = path.join(__dirname, 'generate-ui-report.js');

  try {
    execSync(
      `node "${generatorScript}" "${jsonOut}" "${reportsDir}" "${timestamp}"`,
      { stdio: 'inherit', cwd: path.join(__dirname, '..') }
    );
  } catch (err) {
    console.warn(`⚠️  Custom report generation failed: ${err.message}`);
  }

  // Save raw TXT
  const rawTxtPath = path.join(reportsDir, `ui_log_${timestamp}.txt`);
  if (!fs.existsSync(rawTxtPath)) {
    const header = [
      `Khayr UI Test Report`,
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
