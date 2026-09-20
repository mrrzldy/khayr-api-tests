/**
 * scripts/generate-combined-report.js
 *
 * Generates a combined DOC-style HTML + professional PDF report
 * from both API and UI Playwright JSON results.
 *
 * Usage:
 *   node scripts/generate-combined-report.js <api.json> <ui.json> <outDir> <timestamp>
 */

'use strict';

const fs   = require('fs');
const path = require('path');

/* ── helpers ────────────────────────────────────────────────────── */

function flattenSpecs(suites, results = []) {
  for (const suite of (suites || [])) {
    for (const spec of (suite.specs || [])) {
      for (const test of (spec.tests || [])) {
        for (const result of (test.results || [])) {
          results.push({
            suitePath : [...(suite.file ? [suite.file] : []), suite.title].filter(Boolean),
            title     : spec.title,
            status    : result.status,
            duration  : result.duration || 0,
            error     : result.error
              ? (result.error.message || JSON.stringify(result.error)).slice(0, 400)
              : null,
          });
        }
      }
    }
    flattenSpecs(suite.suites || [], results);
  }
  return results;
}

function stats(tests) {
  const total    = tests.length;
  const passed   = tests.filter(t => t.status === 'passed').length;
  const failed   = tests.filter(t => ['failed', 'unexpected', 'timedOut'].includes(t.status)).length;
  const skipped  = tests.filter(t => ['skipped', 'pending'].includes(t.status)).length;
  const passRate = total ? Math.round(passed / total * 100) : 0;
  const totalMs  = tests.reduce((s, t) => s + (t.duration || 0), 0);
  const durationStr = totalMs >= 60000
    ? `${Math.floor(totalMs / 60000)}m ${Math.round((totalMs % 60000) / 1000)}s`
    : `${(totalMs / 1000).toFixed(1)}s`;
  return { total, passed, failed, skipped, passRate, durationStr };
}

function groupBySuite(tests) {
  const groups = {};
  for (const t of tests) {
    const key = t.suitePath.join(' › ') || 'Tests';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return groups;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── DOC-style HTML (sidebar nav, matching api_doc) ─────────────── */

function buildNavItems(groups, prefix) {
  return Object.entries(groups).map(([name, tests], i) => {
    const s   = stats(tests);
    const dot = s.failed > 0 ? '#f85149' : s.passRate < 80 ? '#e3b341' : '#3fb950';
    const id  = `${prefix}-suite-${i}`;
    return `<a class="nav-item" href="#${id}">
      <span class="nav-dot" style="background:${dot}"></span>
      <span class="nav-label">${esc(name.split(' › ').pop())}</span>
      <span class="nav-badge">${s.passed}/${s.total}</span>
    </a>`;
  }).join('\n');
}

function buildSuiteCards(groups, prefix) {
  return Object.entries(groups).map(([name, tests], i) => {
    const s   = stats(tests);
    const id  = `${prefix}-suite-${i}`;
    const statusChip = s.failed === 0
      ? `<span class="chip chip-pass">PASS</span>`
      : `<span class="chip chip-fail">FAIL</span>`;

    const rows = tests.map(t => {
      const icon = t.status === 'passed' ? '✓'
        : ['failed','unexpected','timedOut'].includes(t.status) ? '✗' : '—';
      const cls  = t.status === 'passed' ? 'row-pass'
        : ['failed','unexpected','timedOut'].includes(t.status) ? 'row-fail' : 'row-skip';
      const errHtml = t.error
        ? `<div class="row-err">${esc(t.error)}</div>` : '';
      return `<div class="test-row ${cls}">
        <span class="row-icon">${icon}</span>
        <span class="row-title">${esc(t.title)}</span>
        <span class="row-dur">${(t.duration/1000).toFixed(2)}s</span>
        ${errHtml}
      </div>`;
    }).join('');

    const barColor = s.failed > 0 ? '#f85149' : s.passRate < 80 ? '#e3b341' : '#3fb950';

    return `<div class="spec-card" id="${id}">
      <div class="card-header">
        <span class="card-title">${esc(name)}</span>
        ${statusChip}
        <span class="chip chip-neutral">${s.durationStr}</span>
        <span class="chip chip-neutral">${s.total} tests</span>
      </div>
      <div class="coverage-row">
        <span class="cov-label">${s.passRate}% pass</span>
        <div class="cov-track"><div class="cov-bar" style="width:${s.passRate}%;background:${barColor}"></div></div>
        <span class="cov-pct">${s.passed}/${s.total}</span>
      </div>
      <div class="test-list">${rows}</div>
    </div>`;
  }).join('\n');
}

function buildDocHtml(apiTests, uiTests, timestamp) {
  const apiSt  = stats(apiTests);
  const uiSt   = stats(uiTests);
  const allTests = [...apiTests, ...uiTests];
  const allSt  = stats(allTests);

  const apiGroups = groupBySuite(apiTests);
  const uiGroups  = groupBySuite(uiTests);

  const runDate = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  const apiBarColor = apiSt.failed > 0 ? '#f85149' : '#3fb950';
  const uiBarColor  = uiSt.failed  > 0 ? '#f85149' : '#3fb950';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Khayr Combined Test Report — ${timestamp}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
/* ── tokens ── */
:root {
  --bg:        #0d1117;
  --surface:   #161d2e;
  --surface2:  #1e2a40;
  --border:    #253047;
  --accent:    #0eb8a3;
  --accent2:   #58a6ff;
  --txt:       #e6edf3;
  --txt2:      #8b949e;
  --pass:      #3fb950;
  --fail:      #f85149;
  --warn:      #e3b341;
  --skip:      #8b949e;
  --sidebar-w: 260px;
  --radius:    8px;
  --font-ui:   'Space Grotesk', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg:       #f0f4f8;
    --surface:  #ffffff;
    --surface2: #f8fafc;
    --border:   #d1dbe8;
    --txt:      #1a2332;
    --txt2:     #536478;
  }
}
[data-theme="light"] {
  --bg:       #f0f4f8;
  --surface:  #ffffff;
  --surface2: #f8fafc;
  --border:   #d1dbe8;
  --txt:      #1a2332;
  --txt2:     #536478;
}

/* ── reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 15px; }
body { background: var(--bg); color: var(--txt); font-family: var(--font-body); display: flex; min-height: 100vh; }
a { color: inherit; text-decoration: none; }

/* ── sidebar ── */
.sidebar {
  width: var(--sidebar-w);
  min-height: 100vh;
  background: var(--surface);
  border-right: 1px solid var(--border);
  position: fixed;
  top: 0; left: 0; bottom: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  z-index: 100;
}
.sidebar-logo {
  padding: 20px 18px 14px;
  border-bottom: 1px solid var(--border);
}
.sidebar-logo .logo-title {
  font-family: var(--font-ui);
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -.01em;
}
.sidebar-logo .logo-sub {
  font-size: 0.72rem;
  color: var(--txt2);
  margin-top: 2px;
}
.nav-section {
  padding: 14px 10px 4px;
}
.nav-section-label {
  font-family: var(--font-ui);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--txt2);
  padding: 0 8px;
  margin-bottom: 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  color: var(--txt2);
  transition: background .15s, color .15s;
  cursor: pointer;
}
.nav-item:hover { background: var(--surface2); color: var(--txt); }
.nav-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.nav-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-badge {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1px 7px;
  color: var(--txt2);
  flex-shrink: 0;
}
.nav-overview {
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--accent);
  border-radius: 6px;
}
.nav-overview:hover { background: var(--surface2); }

/* ── main ── */
.main {
  margin-left: var(--sidebar-w);
  flex: 1;
  padding: 32px 36px 60px;
  max-width: 960px;
}
.page-header {
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}
.page-header h1 {
  font-family: var(--font-ui);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--txt);
  letter-spacing: -.02em;
}
.page-meta {
  margin-top: 6px;
  font-size: 0.8rem;
  color: var(--txt2);
  font-family: var(--font-mono);
}

/* ── stats grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 14px;
}
.stat-label {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: .07em;
  text-transform: uppercase;
  color: var(--txt2);
  margin-bottom: 6px;
}
.stat-value {
  font-family: var(--font-ui);
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1;
}
.stat-sub {
  font-size: 0.7rem;
  color: var(--txt2);
  margin-top: 4px;
  font-family: var(--font-mono);
}

/* ── suite breakdown ── */
.suite-breakdown {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 28px;
}
.suite-block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}
.suite-block-title {
  font-family: var(--font-ui);
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--txt2);
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-bottom: 12px;
}

/* ── coverage row ── */
.coverage-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0 4px;
}
.cov-label { font-size: 0.75rem; color: var(--txt2); width: 64px; text-align: right; font-family: var(--font-mono); }
.cov-track { flex: 1; height: 6px; background: var(--surface2); border-radius: 4px; overflow: hidden; border: 1px solid var(--border); }
.cov-bar   { height: 100%; border-radius: 4px; transition: width .5s; }
.cov-pct   { font-size: 0.72rem; color: var(--txt2); width: 50px; font-family: var(--font-mono); }

/* ── section title ── */
.section-title {
  font-family: var(--font-ui);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--txt);
  margin: 36px 0 14px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  font-family: var(--font-mono);
}

/* ── chips ── */
.chip {
  font-family: var(--font-mono);
  font-size: 0.67rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 20px;
  border: 1px solid var(--border);
  display: inline-block;
}
.chip-pass    { background: rgba(63,185,80,.12); border-color: rgba(63,185,80,.35); color: var(--pass); }
.chip-fail    { background: rgba(248,81,73,.12); border-color: rgba(248,81,73,.35); color: var(--fail); }
.chip-skip    { background: rgba(139,148,158,.12); border-color: rgba(139,148,158,.35); color: var(--skip); }
.chip-neutral { background: var(--surface2); color: var(--txt2); }

/* ── spec card ── */
.spec-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 18px;
  margin-bottom: 14px;
  scroll-margin-top: 20px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.card-title {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--txt);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── test rows ── */
.test-list { margin-top: 12px; display: flex; flex-direction: column; gap: 3px; }
.test-row {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  gap: 6px;
  align-items: start;
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 0.78rem;
}
.row-pass { background: rgba(63,185,80,.06); }
.row-fail { background: rgba(248,81,73,.07); }
.row-skip { background: rgba(139,148,158,.06); }
.row-icon { font-family: var(--font-mono); font-size: 0.82rem; line-height: 1.4; }
.row-pass .row-icon { color: var(--pass); }
.row-fail .row-icon { color: var(--fail); }
.row-skip .row-icon { color: var(--skip); }
.row-title { color: var(--txt); line-height: 1.4; word-break: break-word; }
.row-dur   { color: var(--txt2); font-family: var(--font-mono); font-size: 0.7rem; white-space: nowrap; line-height: 1.6; }
.row-err   {
  grid-column: 2 / -1;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--fail);
  background: rgba(248,81,73,.07);
  border-left: 2px solid var(--fail);
  padding: 4px 8px;
  border-radius: 0 4px 4px 0;
  margin-top: 2px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── theme toggle ── */
.theme-toggle {
  margin-top: auto;
  padding: 12px 14px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--txt2);
}
.theme-toggle:hover { color: var(--txt); }

/* ── responsive ── */
@media (max-width: 900px) {
  .stats-grid { grid-template-columns: repeat(3, 1fr); }
  .suite-breakdown { grid-template-columns: 1fr; }
}
@media (max-width: 700px) {
  .sidebar { display: none; }
  .main { margin-left: 0; padding: 20px 16px 40px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
</head>
<body>

<!-- Sidebar -->
<nav class="sidebar">
  <div class="sidebar-logo">
    <div class="logo-title">Khayr DCMS</div>
    <div class="logo-sub">Combined Test Report · ${timestamp}</div>
  </div>
  <div class="nav-section">
    <div class="nav-section-label">Overview</div>
    <a class="nav-overview" href="#overview">📊 Summary</a>
  </div>
  <div class="nav-section">
    <div class="nav-section-label">API Tests (${apiSt.total})</div>
    ${buildNavItems(apiGroups, 'api')}
  </div>
  <div class="nav-section">
    <div class="nav-section-label">UI Tests (${uiSt.total})</div>
    ${buildNavItems(uiGroups, 'ui')}
  </div>
  <div class="theme-toggle" onclick="toggleTheme()">🌙 Toggle Theme</div>
</nav>

<!-- Main -->
<main class="main">
  <div class="page-header" id="overview">
    <h1>Combined Test Report</h1>
    <div class="page-meta">Run: ${runDate} WIB · Timestamp: ${timestamp}</div>
  </div>

  <!-- Combined Stats -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Tests</div>
      <div class="stat-value" style="color:var(--accent2)">${allSt.total}</div>
      <div class="stat-sub">API + UI</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Passed</div>
      <div class="stat-value" style="color:var(--pass)">${allSt.passed}</div>
      <div class="stat-sub">${allSt.passRate}% pass rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Failed</div>
      <div class="stat-value" style="color:var(--fail)">${allSt.failed}</div>
      <div class="stat-sub">incl. timeouts</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Skipped</div>
      <div class="stat-value" style="color:var(--skip)">${allSt.skipped}</div>
      <div class="stat-sub">pending / skipped</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Duration</div>
      <div class="stat-value" style="color:var(--accent);font-size:1.3rem">${allSt.durationStr}</div>
      <div class="stat-sub">total wall-clock</div>
    </div>
  </div>

  <!-- Suite breakdown -->
  <div class="suite-breakdown">
    <div class="suite-block">
      <div class="suite-block-title">🔌 API Tests</div>
      <div style="display:flex;gap:12px;font-size:0.8rem">
        <span>Total: <strong>${apiSt.total}</strong></span>
        <span style="color:var(--pass)">✓ ${apiSt.passed}</span>
        <span style="color:var(--fail)">✗ ${apiSt.failed}</span>
        <span style="color:var(--skip)">— ${apiSt.skipped}</span>
      </div>
      <div class="coverage-row">
        <span class="cov-label">${apiSt.passRate}%</span>
        <div class="cov-track"><div class="cov-bar" style="width:${apiSt.passRate}%;background:${apiBarColor}"></div></div>
        <span class="cov-pct">${apiSt.durationStr}</span>
      </div>
    </div>
    <div class="suite-block">
      <div class="suite-block-title">🖥 UI Tests</div>
      <div style="display:flex;gap:12px;font-size:0.8rem">
        <span>Total: <strong>${uiSt.total}</strong></span>
        <span style="color:var(--pass)">✓ ${uiSt.passed}</span>
        <span style="color:var(--fail)">✗ ${uiSt.failed}</span>
        <span style="color:var(--skip)">— ${uiSt.skipped}</span>
      </div>
      <div class="coverage-row">
        <span class="cov-label">${uiSt.passRate}%</span>
        <div class="cov-track"><div class="cov-bar" style="width:${uiSt.passRate}%;background:${uiBarColor}"></div></div>
        <span class="cov-pct">${uiSt.durationStr}</span>
      </div>
    </div>
  </div>

  <!-- API Section -->
  <div class="section-title">
    🔌 API Tests
    <span class="section-badge chip-${apiSt.failed === 0 ? 'pass' : 'fail'} chip">${apiSt.passed}/${apiSt.total} passed</span>
  </div>
  ${buildSuiteCards(apiGroups, 'api')}

  <!-- UI Section -->
  <div class="section-title">
    🖥 UI Tests
    <span class="section-badge chip-${uiSt.failed === 0 ? 'pass' : 'fail'} chip">${uiSt.passed}/${uiSt.total} passed</span>
  </div>
  ${buildSuiteCards(uiGroups, 'ui')}

</main>

<script>
function toggleTheme() {
  const root = document.documentElement;
  const cur  = root.getAttribute('data-theme');
  root.setAttribute('data-theme', cur === 'light' ? 'dark' : 'light');
}
// Smooth scroll for nav
document.querySelectorAll('.nav-item, .nav-overview').forEach(el => {
  el.addEventListener('click', e => {
    const href = el.getAttribute('href');
    if (href && href.startsWith('#')) {
      e.preventDefault();
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
</script>
</body>
</html>`;
}

/* ── Professional PDF HTML ─────────────────────────────────────── */

function statusPill(s) {
  if (s === 'passed')   return `<span style="color:#3fb950;font-weight:700">✓ PASS</span>`;
  if (['failed','unexpected','timedOut'].includes(s))
                        return `<span style="color:#f85149;font-weight:700">✗ FAIL</span>`;
  return `<span style="color:#8b949e">— SKIP</span>`;
}

function buildSuiteTable(groups) {
  return Object.entries(groups).map(([name, tests]) => {
    const s = stats(tests);
    const barColor = s.failed > 0 ? '#f85149' : s.passRate < 80 ? '#e3b341' : '#3fb950';

    const rows = tests.map(t => `
      <tr>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;max-width:360px;word-break:break-word">${esc(t.title)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;font-size:11px;white-space:nowrap">${statusPill(t.status)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;font-size:11px;font-family:monospace;white-space:nowrap">${(t.duration/1000).toFixed(2)}s</td>
      </tr>
      ${t.error ? `<tr><td colspan="3" style="padding:4px 8px 8px 28px;font-size:10px;color:#c0392b;font-family:monospace;border-bottom:1px solid #eee;word-break:break-word">${esc(t.error)}</td></tr>` : ''}
    `).join('');

    return `
    <div style="margin-bottom:20px;border:1px solid #dde3ec;border-radius:8px;overflow:hidden;page-break-inside:avoid">
      <div style="background:#f8fafc;border-bottom:1px solid #dde3ec;padding:10px 14px;display:flex;align-items:center;gap:12px">
        <span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:700;color:#1a2332;flex:1">${esc(name)}</span>
        <span style="font-size:11px;color:#536478;font-family:monospace">${s.passed}/${s.total} · ${s.passRate}%</span>
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;${s.failed === 0 ? 'background:rgba(63,185,80,.1);color:#2d9e42' : 'background:rgba(248,81,73,.1);color:#c0392b'}">${s.failed === 0 ? 'PASS' : 'FAIL'}</span>
      </div>
      <div style="background:#f0f4f8;padding:8px 14px">
        <div style="background:#dde3ec;height:5px;border-radius:3px;overflow:hidden">
          <div style="background:${barColor};height:100%;width:${s.passRate}%;border-radius:3px"></div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f8fafc">
          <th style="padding:5px 8px;border-bottom:2px solid #dde3ec;text-align:left;font-size:10px;color:#536478;font-weight:600">TEST</th>
          <th style="padding:5px 8px;border-bottom:2px solid #dde3ec;text-align:center;font-size:10px;color:#536478;font-weight:600">STATUS</th>
          <th style="padding:5px 8px;border-bottom:2px solid #dde3ec;text-align:right;font-size:10px;color:#536478;font-weight:600">DURATION</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');
}

function buildPdfHtml(apiTests, uiTests, timestamp, apiJsonFile, uiJsonFile) {
  const apiSt  = stats(apiTests);
  const uiSt   = stats(uiTests);
  const allTests = [...apiTests, ...uiTests];
  const allSt  = stats(allTests);

  const apiGroups = groupBySuite(apiTests);
  const uiGroups  = groupBySuite(uiTests);

  const runDate = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const overallColor = allSt.failed > 0 ? '#c0392b' : allSt.passRate < 80 ? '#e67e22' : '#27ae60';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Khayr Combined Report PDF — ${timestamp}</title>
<style>
@page {
  size: A4;
  margin: 15mm 12mm 18mm;
  @bottom-center {
    content: "CONFIDENTIAL — Khayr DCMS Combined Test Report · ${timestamp}";
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 8px;
    color: #aab4c0;
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  color: #1a2332;
  font-size: 12px;
  line-height: 1.5;
  background: #fff;
}

/* Cover page */
.cover {
  min-height: 240mm;
  display: flex;
  flex-direction: column;
  justify-content: center;
  page-break-after: always;
}
.cover-logo {
  font-size: 13px;
  font-weight: 700;
  color: #0eb8a3;
  letter-spacing: .05em;
  text-transform: uppercase;
  margin-bottom: 32px;
}
.cover-title {
  font-size: 32px;
  font-weight: 800;
  color: #1a2332;
  line-height: 1.15;
  letter-spacing: -.02em;
  margin-bottom: 10px;
}
.cover-subtitle {
  font-size: 14px;
  color: #536478;
  margin-bottom: 36px;
}
.cover-divider {
  height: 4px;
  background: linear-gradient(90deg, #0eb8a3 0%, #58a6ff 60%, transparent 100%);
  border-radius: 2px;
  margin-bottom: 32px;
}
.cover-meta {
  font-size: 10px;
  color: #8b949e;
  font-family: monospace;
  margin-bottom: 36px;
}

/* Cover stats grid */
.cover-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.cover-stat {
  background: #f8fafc;
  border: 1px solid #dde3ec;
  border-radius: 8px;
  padding: 14px 10px;
  text-align: center;
}
.cover-stat-val {
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
}
.cover-stat-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #8b949e;
  font-weight: 600;
}

/* Suite summary grid on cover */
.suite-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
}
.suite-mini {
  background: #f0f4f8;
  border: 1px solid #dde3ec;
  border-radius: 8px;
  padding: 12px 14px;
}
.suite-mini-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #536478;
  margin-bottom: 8px;
}
.suite-mini-stats {
  display: flex;
  gap: 14px;
  font-size: 11px;
}
.cover-bar-track {
  background: #dde3ec;
  height: 6px;
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
}
.cover-bar-fill {
  height: 100%;
  border-radius: 3px;
}

/* Section divider */
.section-divider {
  page-break-before: always;
  margin-bottom: 24px;
  padding-top: 8px;
}
.section-divider h2 {
  font-size: 20px;
  font-weight: 800;
  color: #1a2332;
  margin-bottom: 6px;
}
.section-divider-bar {
  height: 3px;
  background: linear-gradient(90deg, #0eb8a3, transparent);
  border-radius: 2px;
  margin-bottom: 16px;
}
.section-meta {
  font-size: 10px;
  color: #8b949e;
  font-family: monospace;
  margin-bottom: 20px;
}
</style>
</head>
<body>

<!-- Cover Page -->
<div class="cover">
  <div class="cover-logo">Khayr DCMS · QA Automation</div>
  <div class="cover-title">Combined Test Report</div>
  <div class="cover-subtitle">API + UI End-to-End Test Results</div>
  <div class="cover-divider"></div>
  <div class="cover-meta">
    Run timestamp : ${timestamp}<br/>
    Report date   : ${runDate} WIB<br/>
    API source    : ${esc(path.basename(apiJsonFile || 'api_results.json'))}<br/>
    UI source     : ${esc(path.basename(uiJsonFile  || 'ui_results.json'))}
  </div>

  <!-- Combined stats -->
  <div class="cover-stats">
    <div class="cover-stat">
      <div class="cover-stat-val" style="color:#58a6ff">${allSt.total}</div>
      <div class="cover-stat-label">Total</div>
    </div>
    <div class="cover-stat">
      <div class="cover-stat-val" style="color:#27ae60">${allSt.passed}</div>
      <div class="cover-stat-label">Passed</div>
    </div>
    <div class="cover-stat">
      <div class="cover-stat-val" style="color:#c0392b">${allSt.failed}</div>
      <div class="cover-stat-label">Failed</div>
    </div>
    <div class="cover-stat">
      <div class="cover-stat-val" style="color:#8b949e">${allSt.skipped}</div>
      <div class="cover-stat-label">Skipped</div>
    </div>
    <div class="cover-stat">
      <div class="cover-stat-val" style="color:${overallColor}">${allSt.passRate}%</div>
      <div class="cover-stat-label">Pass Rate</div>
    </div>
  </div>

  <!-- Suite mini blocks -->
  <div class="suite-grid">
    <div class="suite-mini">
      <div class="suite-mini-title">🔌 API Tests</div>
      <div class="suite-mini-stats">
        <span>Total: <strong>${apiSt.total}</strong></span>
        <span style="color:#27ae60">✓ ${apiSt.passed}</span>
        <span style="color:#c0392b">✗ ${apiSt.failed}</span>
        <span style="color:#8b949e">— ${apiSt.skipped}</span>
        <span style="font-family:monospace">${apiSt.durationStr}</span>
      </div>
      <div class="cover-bar-track">
        <div class="cover-bar-fill" style="width:${apiSt.passRate}%;background:${apiSt.failed > 0 ? '#c0392b' : '#27ae60'}"></div>
      </div>
    </div>
    <div class="suite-mini">
      <div class="suite-mini-title">🖥 UI Tests</div>
      <div class="suite-mini-stats">
        <span>Total: <strong>${uiSt.total}</strong></span>
        <span style="color:#27ae60">✓ ${uiSt.passed}</span>
        <span style="color:#c0392b">✗ ${uiSt.failed}</span>
        <span style="color:#8b949e">— ${uiSt.skipped}</span>
        <span style="font-family:monospace">${uiSt.durationStr}</span>
      </div>
      <div class="cover-bar-track">
        <div class="cover-bar-fill" style="width:${uiSt.passRate}%;background:${uiSt.failed > 0 ? '#c0392b' : '#27ae60'}"></div>
      </div>
    </div>
  </div>
</div>

<!-- API Section -->
<div class="section-divider">
  <h2>🔌 API Test Results</h2>
  <div class="section-divider-bar"></div>
  <div class="section-meta">
    Total: ${apiSt.total} · Passed: ${apiSt.passed} · Failed: ${apiSt.failed} · Skipped: ${apiSt.skipped} · Pass rate: ${apiSt.passRate}% · Duration: ${apiSt.durationStr}
  </div>
  ${buildSuiteTable(apiGroups)}
</div>

<!-- UI Section -->
<div class="section-divider">
  <h2>🖥 UI Test Results</h2>
  <div class="section-divider-bar"></div>
  <div class="section-meta">
    Total: ${uiSt.total} · Passed: ${uiSt.passed} · Failed: ${uiSt.failed} · Skipped: ${uiSt.skipped} · Pass rate: ${uiSt.passRate}% · Duration: ${uiSt.durationStr}
  </div>
  ${buildSuiteTable(uiGroups)}
</div>

</body>
</html>`;
}

/* ── main ────────────────────────────────────────────────────────── */

const [,, apiJsonFile, uiJsonFile, outDir, timestamp] = process.argv;

if (!apiJsonFile || !uiJsonFile || !outDir || !timestamp) {
  console.error('Usage: node generate-combined-report.js <api.json> <ui.json> <outDir> <timestamp>');
  process.exit(1);
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Load JSON
let apiJson = { suites: [] };
let uiJson  = { suites: [] };
try { apiJson = JSON.parse(fs.readFileSync(apiJsonFile, 'utf8')); } catch (e) { console.warn(`⚠️  Could not read API JSON: ${e.message}`); }
try { uiJson  = JSON.parse(fs.readFileSync(uiJsonFile,  'utf8')); } catch (e) { console.warn(`⚠️  Could not read UI JSON: ${e.message}`);  }

const apiTests = flattenSpecs(apiJson.suites || []);
const uiTests  = flattenSpecs(uiJson.suites  || []);

// Write DOC HTML
const docPath = path.join(outDir, `combined_doc_${timestamp}.html`);
fs.writeFileSync(docPath, buildDocHtml(apiTests, uiTests, timestamp), 'utf8');
console.log(`✅ DOC  → ${docPath}`);

// Write PDF HTML (to be converted by run-combined-report.js via puppeteer)
const pdfHtmlPath = path.join(outDir, `combined_pdf_src_${timestamp}.html`);
fs.writeFileSync(pdfHtmlPath, buildPdfHtml(apiTests, uiTests, timestamp, apiJsonFile, uiJsonFile), 'utf8');
console.log(`✅ PDF-SRC → ${pdfHtmlPath}`);

// Convert PDF HTML → PDF using playwright chromium
(async () => {
  const pdfPath = path.join(outDir, `combined_report_${timestamp}.pdf`);
  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const page    = await browser.newPage();
    await page.setContent(fs.readFileSync(pdfHtmlPath, 'utf8'), { waitUntil: 'networkidle' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: { top: '15mm', right: '12mm', bottom: '18mm', left: '12mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;text-align:center;font-size:8px;color:#aab4c0;font-family:Helvetica,Arial,sans-serif;padding:0 12mm">
        CONFIDENTIAL — Khayr DCMS Combined Test Report · ${timestamp} &nbsp;|&nbsp; Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>`,
    });
    await browser.close();
    // Remove temp PDF-SRC
    try { fs.unlinkSync(pdfHtmlPath); } catch (_) {}
    console.log(`✅ PDF  → ${pdfPath}`);
  } catch (err) {
    console.warn(`⚠️  PDF generation failed (playwright): ${err.message}`);
    console.log(`   PDF-SRC HTML kept at: ${pdfHtmlPath}`);
  }
  process.exit(0);
})();
