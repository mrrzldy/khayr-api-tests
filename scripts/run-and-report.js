/**
 * run-and-report.js
 * Run Playwright tests and auto-generate timestamped TXT + PDF reports.
 * Usage:
 *   node scripts/run-and-report.js          → runs --project=api
 *   node scripts/run-and-report.js ui       → runs --project=ui
 *   node scripts/run-and-report.js api      → runs --project=api
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

// Determine project: from CLI arg (node run-and-report.js ui) or env var
const project = process.argv[2] || process.env.TEST_PROJECT || 'api';
const validProjects = ['api', 'ui'];
if (!validProjects.includes(project)) {
  console.error(`❌ Unknown project "${project}". Use: api | ui`);
  process.exit(1);
}

const reportsDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

const txtFile  = path.join(reportsDir, `test_${project}_${timestamp}.txt`);
const pdfFile  = path.join(reportsDir, `test_${project}_${timestamp}.pdf`);
const htmlDir  = path.join(reportsDir, `html_${project}_${timestamp}`);

console.log(`\n========================================`);
console.log(`  Khayr ${project.toUpperCase()} Test Run — ${timestamp}`);
console.log(`========================================\n`);

// ── Step 1: Run tests with list reporter (for TXT) + html reporter (for PDF) ──

const args = [
  'playwright', 'test', `--project=${project}`,
  '--reporter=list,html',
  `--output=${path.join(reportsDir, `artifacts_${project}_${timestamp}`)}`,
];

process.env.PLAYWRIGHT_HTML_REPORT = htmlDir;  // tell html reporter where to write

const proc = spawn('npx', args, {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  env: { ...process.env, PLAYWRIGHT_HTML_REPORT: htmlDir },
});

let output = '';

proc.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  output += chunk.toString();
});

proc.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
  output += chunk.toString();
});

proc.on('close', async (exitCode) => {
  // ── Step 2: Write TXT log ─────────────────────────────────────────────────
  const header = [
    `Khayr API Test Report`,
    `Run date : ${now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
    `Generated: ${new Date().toISOString()}`,
    `Exit code: ${exitCode}`,
    `========================================\n`,
  ].join('\n');

  fs.writeFileSync(txtFile, header + output, 'utf8');
  console.log(`\n✅ TXT report  → ${txtFile}`);

  // ── Step 3: Convert HTML report to PDF via Playwright ────────────────────
  try {
    const { chromium } = require('playwright');
    const htmlIndex = path.join(htmlDir, 'index.html');

    if (!fs.existsSync(htmlIndex)) {
      console.warn(`⚠️  HTML report not found at ${htmlIndex} — skipping PDF`);
      process.exit(exitCode);
      return;
    }

    const browser = await chromium.launch({ headless: true });
    const page    = await browser.newPage();

    // Load the self-contained HTML report
    await page.goto(`file:///${htmlIndex.replace(/\\/g, '/')}`, { waitUntil: 'networkidle', timeout: 30000 });

    // Let the React app render
    await page.waitForTimeout(3000);

    await page.pdf({
      path: pdfFile,
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    });

    await browser.close();
    console.log(`✅ PDF report  → ${pdfFile}`);
  } catch (err) {
    console.warn(`⚠️  PDF generation failed: ${err.message}`);
    console.warn(`   Run: npx playwright show-report "${htmlDir}" to view HTML report`);
  }

  process.exit(exitCode);
});
