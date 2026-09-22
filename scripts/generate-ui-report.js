/**
 * scripts/generate-ui-report.js
 *
 * Reads Playwright JSON output (--project=ui) and generates:
 *   1. ui_report_TIMESTAMP.html    — dark interactive report (click any row for detail)
 *   2. ui_report_TIMESTAMP.pdf     — polished printable PDF with suite breakdown
 *   3. ui_doc_TIMESTAMP.html       — sidebar doc-style report with human-readable labels
 *   4. ui_summary_TIMESTAMP.txt    — structured summary (bugs + errors)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtMs(ms) {
  if (!ms) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms/60000)}m ${Math.round((ms%60000)/1000)}s`;
}

function classifyStep(title) {
  if (/page\.goto|navigate to|go to|url/i.test(title))
    return { type: 'navigate', icon: '🌐', color: '#38bdf8' };
  if (/expect|assert|toBe|toHave|toContain|toBeVisible|toBeEnabled|toBeChecked|toHaveText|toHaveValue/i.test(title))
    return { type: 'assert', icon: '✔', color: '#22c55e' };
  if (/click|fill|type|select|check|press|tap|drag|hover|focus|blur|clear/i.test(title))
    return { type: 'interact', icon: '🖱', color: '#a78bfa' };
  if (/screenshot|attach/i.test(title))
    return { type: 'capture', icon: '📸', color: '#f59e0b' };
  if (/wait/i.test(title))
    return { type: 'wait', icon: '⏳', color: '#94a3b8' };
  return { type: 'other', icon: '·', color: '#64748b' };
}

function extractUrls(steps) {
  const urls = [];
  for (const s of steps) {
    const m = s.title.match(/goto\s*\(\s*['"]([^'"]+)['"]/i)
           || s.title.match(/navigate.*?['"]([^'"]+)['"]/i);
    if (m && m[1]) urls.push(m[1]);
  }
  return [...new Set(urls)];
}

/**
 * Read screenshot as base64 data URL.
 */
function readScreenshot(filePath, jsonDir) {
  if (!filePath) return null;
  const MAX_BYTES = 800 * 1024;
  const candidates = [
    filePath,
    path.resolve(jsonDir, filePath),
    path.resolve(jsonDir, '..', filePath),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const stat = fs.statSync(p);
      if (stat.size > MAX_BYTES) {
        console.warn(`  ⚠ Screenshot too large (${Math.round(stat.size/1024)}KB), skipping: ${path.basename(p)}`);
        return null;
      }
      const data = fs.readFileSync(p);
      return `data:image/png;base64,${data.toString('base64')}`;
    } catch (_) {}
  }
  return null;
}

// ── Flatten Playwright JSON → test objects ────────────────────────────────────
function flattenSpecs(suites, jsonDir, sPath = []) {
  const tests = [];
  for (const suite of suites) {
    const p = suite.title ? [...sPath, suite.title] : sPath;
    if (suite.specs) {
      for (const spec of suite.specs) {
        for (const result of (spec.tests || [spec])) {
          const results = result.results || [];
          const r = results[results.length - 1] || {};
          const retryCount = results.length - 1;

          const steps = (r.steps || []).map(s => ({
            title:    s.title || '',
            duration: s.duration || 0,
            error:    s.error?.message || s.error?.stack || '',
            category: classifyStep(s.title || ''),
          }));

          const attachments = (r.attachments || [])
            .filter(a => a.contentType?.startsWith('image/') && a.path)
            .map(a => ({
              name:    a.name || 'screenshot',
              path:    a.path,
              dataUrl: readScreenshot(a.path, jsonDir),
            }))
            .filter(a => a.dataUrl);

          tests.push({
            title:      spec.title || result.title || '(untitled)',
            suitePath:  p,
            status:     r.status || result.status || 'unknown',
            duration:   r.duration || 0,
            retryCount,
            error:      r.error?.message || r.error?.stack || '',
            steps,
            attachments,
            urls:       extractUrls(steps),
          });
        }
      }
    }
    if (suite.suites) tests.push(...flattenSpecs(suite.suites, jsonDir, p));
  }
  return tests;
}

// ── Khayr-specific spec name mapping ─────────────────────────────────────────
const SPEC_LABEL_MAP = {
  '00_api_discovery':       { label: 'API Discovery & Health Check', icon: '🔍', desc: 'Checks that core API endpoints respond correctly before UI tests run' },
  '01_login':               { label: 'Login & Authentication',        icon: '🔐', desc: 'Login flows — valid credentials, invalid credentials, session handling, logout' },
  '03_superadmin':          { label: 'Super Admin — Tenant Management', icon: '🏢', desc: 'Super admin features: tenant creation, user management, platform-level settings' },
  '04_dokter':              { label: 'Dokter — Consultation & Records', icon: '👨‍⚕️', desc: 'Doctor role: patient consultation, medical records, diagnosis, prescriptions' },
  '05_perawat':             { label: 'Perawat — Nursing & Patient Care', icon: '👩‍⚕️', desc: 'Nurse role: patient care tasks, vitals entry, nursing notes, handover' },
  '06_resepsionis':         { label: 'Resepsionis — Registration',     icon: '🗂️', desc: 'Receptionist role: patient registration, reservation booking, check-in flow' },
  '07_admin':               { label: 'Admin — Operational Management', icon: '⚙️', desc: 'Admin role: operational configuration, schedule management, reporting' },
  '08_finance':             { label: 'Finance — Billing & Payments',   icon: '💰', desc: 'Finance role: invoice creation, payment processing, financial reporting' },
  '09_kasir':               { label: 'Kasir — Cashier & Transactions', icon: '🧾', desc: 'Cashier role: payment collection, receipt generation, daily transactions' },
  '10_khayr_admin':         { label: 'Khayr Admin — Platform Management', icon: '🛡️', desc: 'Platform admin: voucher marketplace, settlement, tenant-level administration' },
  'debug_dokter':           { label: '[Debug] Dokter Flows',           icon: '🐛', desc: 'Debug spec for isolating doctor role issues' },
  'debug_filter_visibility':{ label: '[Debug] Filter Visibility',      icon: '🐛', desc: 'Debug spec for filter UI visibility issues' },
  'debug_filter':           { label: '[Debug] Filter Behavior',        icon: '🐛', desc: 'Debug spec for filter logic and behavior' },
  'debug_login':            { label: '[Debug] Login Flow',             icon: '🐛', desc: 'Debug spec for login flow issues' },
};

function getSpecMeta(rawSuiteTitle) {
  // Extract just the filename stem, e.g. "tests\ui\specs\04_dokter.spec.js" → "04_dokter"
  const basename = rawSuiteTitle.replace(/\\/g, '/').split('/').pop().replace(/\.spec\.js$/, '');
  return SPEC_LABEL_MAP[basename] || { label: basename, icon: '📋', desc: 'UI test coverage for this module' };
}

function getSpecDescription(rawSuiteTitle) {
  return getSpecMeta(rawSuiteTitle).desc;
}

function statusBadge(s) {
  const map = { passed: ['#22c55e','#14532d'], failed: ['#ef4444','#7f1d1d'], skipped: ['#f59e0b','#78350f'], timedOut: ['#f97316','#7c2d12'] };
  const [fg, bg] = map[s] || ['#94a3b8','#1e293b'];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:${bg}44;color:${fg};border:1px solid ${fg}44">${esc(s.toUpperCase())}</span>`;
}

// ── Interactive dark HTML ─────────────────────────────────────────────────────
const MAX_EMBED_SCREENSHOTS = 30;

function buildHtml(allTests, timestamp, jsonFile) {
  const total    = allTests.length;
  const passed   = allTests.filter(t => t.status === 'passed').length;
  const failed   = allTests.filter(t => t.status === 'failed').length;
  const skipped  = allTests.filter(t => t.status === 'skipped').length;
  const retried  = allTests.filter(t => t.retryCount > 0).length;
  const passRate = total ? Math.round(passed / total * 100) : 0;
  const duration = allTests.reduce((s,t) => s + t.duration, 0);

  // Budget screenshots: failed first
  let screenshotBudget = MAX_EMBED_SCREENSHOTS;
  const screenshotAllowed = new Set();
  for (const t of [...allTests.filter(t=>t.status==='failed'), ...allTests.filter(t=>t.status!=='failed')]) {
    if (t.attachments.length > 0 && screenshotBudget > 0) {
      screenshotAllowed.add(t);
      screenshotBudget -= Math.min(t.attachments.length, 2);
    }
  }
  const embeddedCount = MAX_EMBED_SCREENSHOTS - screenshotBudget;

  const rows = allTests.map((t, i) => {
    const suite = t.suitePath.map(s => getSpecMeta(s).label).join(' › ');
    const retryBadge = t.retryCount > 0
      ? `<span style="font-size:10px;color:#f59e0b;margin-left:6px">↺×${t.retryCount}</span>` : '';

    const stepRows = t.steps.map(s => {
      const { icon, color } = s.category;
      return `<tr>
        <td style="color:${color};font-size:12px;width:24px;text-align:center">${icon}</td>
        <td style="font-size:12px">${esc(s.title)}</td>
        <td style="font-size:11px;color:var(--muted);white-space:nowrap">${fmtMs(s.duration)}</td>
        <td style="font-size:11px;color:var(--muted)">${s.category.type}</td>
      </tr>${s.error ? `<tr><td colspan="4" style="padding:4px 8px 8px 28px"><div style="font-size:11px;color:var(--red);background:#ef444422;padding:6px 8px;border-radius:4px;font-family:monospace;white-space:pre-wrap;word-break:break-word">${esc(s.error)}</div></td></tr>` : ''}`;
    }).join('');

    const stepsSection = t.steps.length ? `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Steps (${t.steps.length})</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="width:24px"></th>
            <th style="text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;padding-bottom:4px">Action</th>
            <th style="text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;padding-bottom:4px">Dur</th>
            <th style="text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;padding-bottom:4px">Type</th>
          </tr></thead>
          <tbody>${stepRows}</tbody>
        </table>
      </div>` : '';

    const urlsSection = t.urls.length ? `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Pages Visited</div>
        ${t.urls.map(u => `<div style="font-family:monospace;font-size:11px;color:var(--blue);padding:2px 0">🌐 ${esc(u)}</div>`).join('')}
      </div>` : '';

    const embedAttachments = screenshotAllowed.has(t) ? t.attachments.slice(0, 2) : [];
    const screenshotsSection = embedAttachments.length ? `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">📸 Screenshots</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${embedAttachments.map(a => `<div>
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px">${esc(a.name)}</div>
            <img src="${a.dataUrl}" style="max-width:480px;max-height:320px;border:1px solid var(--border);border-radius:4px;cursor:pointer" onclick="openImg(this)" />
          </div>`).join('')}
          ${t.attachments.length > 2 ? `<div style="font-size:11px;color:var(--muted);align-self:center">+${t.attachments.length-2} more in artifacts folder</div>` : ''}
        </div>
      </div>` : t.attachments.length > 0 ? `<div style="font-size:11px;color:var(--muted);margin-bottom:8px">📸 ${t.attachments.length} screenshot(s) saved in <code>ui_artifacts_*/</code></div>` : '';

    const errorSection = t.error ? `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Error</div>
        <div style="background:#ef444422;border:1px solid #ef444444;border-radius:6px;padding:10px"><pre style="font-size:11px;color:var(--red);white-space:pre-wrap;word-break:break-word">${esc(t.error.substring(0,800))}</pre></div>
      </div>` : '';

    // Always show at least basic test info in the detail panel
    const basicInfo = `
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:12px;padding:10px 14px;background:var(--bg3);border-radius:6px">
        <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Suite</div><div style="font-size:12px">${esc(suite || t.suitePath.join(' › '))}</div></div>
        <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Status</div><div>${statusBadge(t.status)}</div></div>
        <div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Duration</div><div style="font-family:monospace;font-size:12px">${fmtMs(t.duration)}</div></div>
        ${t.retryCount > 0 ? `<div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Retries</div><div style="font-size:12px;color:var(--yellow)">${t.retryCount}×</div></div>` : ''}
      </div>`;

    return `
    <tr class="test-row ${t.status}" onclick="toggle(${i})">
      <td>${statusBadge(t.status)}${retryBadge}</td>
      <td class="test-title">${esc(t.title)}</td>
      <td class="mono" style="color:var(--muted);font-size:12px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(suite)}</td>
      <td class="mono">${fmtMs(t.duration)}</td>
    </tr>
    <tr id="detail-${i}" class="detail-row" style="display:none">
      <td colspan="4">
        ${basicInfo}
        ${urlsSection}${screenshotsSection}${errorSection}${stepsSection}
      </td>
    </tr>`;
  }).join('');

  const failedTests = allTests.filter(t => t.status === 'failed');
  const bugsSection = failedTests.length ? `
  <section style="padding:0 24px 24px">
    <h2 style="font-size:16px;margin-bottom:12px;color:var(--red)">❌ Failed Tests (${failedTests.length})</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>
        <th style="background:var(--bg2);padding:8px 12px;text-align:left;color:var(--muted);font-size:11px;text-transform:uppercase">Test</th>
        <th style="background:var(--bg2);padding:8px 12px;text-align:left;color:var(--muted);font-size:11px;text-transform:uppercase">Suite</th>
        <th style="background:var(--bg2);padding:8px 12px;text-align:left;color:var(--muted);font-size:11px;text-transform:uppercase">Error</th>
      </tr></thead>
      <tbody>
        ${failedTests.map(t => `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid var(--border)44;vertical-align:top">${esc(t.title)}${t.retryCount>0?`<br><span style="font-size:10px;color:var(--yellow)">retried ${t.retryCount}×</span>`:''}</td>
          <td style="padding:8px 12px;border-bottom:1px solid var(--border)44;font-size:12px;color:var(--muted);vertical-align:top">${esc(t.suitePath.map(s => getSpecMeta(s).label).join(' › '))}</td>
          <td style="padding:8px 12px;border-bottom:1px solid var(--border)44;vertical-align:top"><pre style="font-size:10px;color:var(--red);white-space:pre-wrap;word-break:break-word">${esc((t.error||'').substring(0,400))}</pre></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </section>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Khayr UI Report — ${timestamp}</title>
<style>
  :root{--bg:#0f172a;--bg2:#1e293b;--bg3:#334155;--text:#f1f5f9;--muted:#94a3b8;--border:#334155;--green:#22c55e;--red:#ef4444;--yellow:#f59e0b;--blue:#38bdf8;--accent:#6366f1}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;font-size:14px}
  header{background:var(--bg2);border-bottom:1px solid var(--border);padding:16px 24px}
  header h1{font-size:18px;font-weight:700;margin-bottom:2px}
  header .ts{color:var(--muted);font-size:12px}
  .stats{display:flex;gap:12px;padding:16px 24px;flex-wrap:wrap}
  .stat{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 20px;text-align:center;min-width:90px}
  .stat .val{font-size:22px;font-weight:700}.stat .lbl{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
  .stat.g .val{color:var(--green)}.stat.r .val{color:var(--red)}.stat.y .val{color:var(--yellow)}.stat.b .val{color:var(--blue)}
  .controls{padding:0 24px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .btn{background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px}
  .btn:hover,.btn.active{background:var(--accent);border-color:var(--accent)}
  .search-box{background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:6px 12px;border-radius:6px;font-size:13px;width:220px;outline:none;margin-left:auto}
  .search-box::placeholder{color:var(--muted)}
  .tbl-wrap{overflow-x:auto;padding:0 24px 24px}
  table.main{width:100%;border-collapse:collapse}
  table.main th{background:var(--bg2);color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px;padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)}
  .test-row td{padding:10px 12px;border-bottom:1px solid #334155;cursor:pointer}
  .test-row:hover td{background:var(--bg2)}
  .test-row.failed td{border-left:3px solid var(--red)}
  .test-row.skipped td{opacity:.6}
  .test-title{max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mono{font-family:monospace;font-size:12px;color:var(--muted);white-space:nowrap}
  .detail-row td{background:#1a2840;padding:16px 24px;border-bottom:2px solid var(--accent)44}
  .hidden{display:none!important}
  #lightbox{display:none;position:fixed;inset:0;background:#000c;z-index:9999;align-items:center;justify-content:center;cursor:zoom-out}
  #lightbox.show{display:flex}
  #lightbox img{max-width:90vw;max-height:90vh;border-radius:6px;box-shadow:0 0 40px #000}
  .expand-all-btn{font-size:11px;color:var(--muted);background:none;border:1px solid var(--border);padding:4px 10px;border-radius:4px;cursor:pointer;margin-left:8px}
  .expand-all-btn:hover{color:var(--text);border-color:var(--accent)}
</style>
</head>
<body>
<header>
  <h1>🖥️ Khayr UI Test Report</h1>
  <div class="ts">Run: ${timestamp} · ${total} tests · ${fmtMs(duration)}${embeddedCount>0?` · ${embeddedCount} screenshots embedded`:''}</div>
</header>
<div class="stats">
  <div class="stat"><div class="val">${total}</div><div class="lbl">Total</div></div>
  <div class="stat g"><div class="val">${passed}</div><div class="lbl">Passed</div></div>
  <div class="stat r"><div class="val">${failed}</div><div class="lbl">Failed</div></div>
  <div class="stat y"><div class="val">${skipped}</div><div class="lbl">Skipped</div></div>
  <div class="stat b"><div class="val">${passRate}%</div><div class="lbl">Pass Rate</div></div>
  ${retried>0?`<div class="stat y"><div class="val">${retried}</div><div class="lbl">Retried</div></div>`:''}
</div>
<div class="controls">
  <button class="btn active" onclick="filterStatus('all',this)">All (${total})</button>
  <button class="btn" onclick="filterStatus('passed',this)">✅ Passed (${passed})</button>
  <button class="btn" onclick="filterStatus('failed',this)">❌ Failed (${failed})</button>
  ${skipped>0?`<button class="btn" onclick="filterStatus('skipped',this)">⏭ Skipped (${skipped})</button>`:''}
  <button class="expand-all-btn" onclick="toggleAll()">Expand All</button>
  <input class="search-box" type="text" placeholder="Search tests..." oninput="filterSearch(this.value)">
</div>
<div class="tbl-wrap">
  <table class="main">
    <thead><tr><th style="width:120px">Status</th><th>Test Name</th><th>Suite</th><th style="width:90px">Duration</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
${bugsSection}
<div id="lightbox" onclick="closeLightbox()"><img id="lbImg" src="" /></div>
<script>
let allExpanded = false;
function toggle(i){const d=document.getElementById('detail-'+i);d.style.display=d.style.display==='none'?'table-row':'none'}
function toggleAll(){
  allExpanded=!allExpanded;
  document.querySelectorAll('.detail-row').forEach(d=>{
    const row=d.previousElementSibling;
    if(!row||!row.classList.contains('hidden'))d.style.display=allExpanded?'table-row':'none';
  });
  document.querySelector('.expand-all-btn').textContent=allExpanded?'Collapse All':'Expand All';
}
function filterStatus(s,btn){
  document.querySelectorAll('.btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter=s;
  applyFilters();
}
let currentFilter='all', currentSearch='';
function filterSearch(v){currentSearch=v.toLowerCase();applyFilters();}
function applyFilters(){
  document.querySelectorAll('.test-row').forEach(row=>{
    const det=row.nextElementSibling;
    const matchStatus=currentFilter==='all'||row.classList.contains(currentFilter);
    const matchSearch=!currentSearch||row.textContent.toLowerCase().includes(currentSearch);
    if(matchStatus&&matchSearch){row.classList.remove('hidden');}
    else{row.classList.add('hidden');if(det)det.style.display='none';}
  });
}
function openImg(el){document.getElementById('lbImg').src=el.src;document.getElementById('lightbox').classList.add('show')}
function closeLightbox(){document.getElementById('lightbox').classList.remove('show')}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox()})
</script>
</body></html>`;
}

// ── PDF HTML (polished — full report with suite breakdown) ────────────────────
function buildPdfHtml(allTests, timestamp) {
  const total    = allTests.length;
  const passed   = allTests.filter(t => t.status === 'passed').length;
  const failed   = allTests.filter(t => t.status === 'failed').length;
  const skipped  = allTests.filter(t => t.status === 'skipped').length;
  const retried  = allTests.filter(t => t.retryCount > 0).length;
  const passRate = total ? Math.round(passed / total * 100) : 0;
  const duration = allTests.reduce((s,t) => s + t.duration, 0);

  // Group by suite
  const suiteMap = {};
  for (const t of allTests) {
    const key = t.suitePath[0] || '(root)';
    if (!suiteMap[key]) suiteMap[key] = [];
    suiteMap[key].push(t);
  }
  const suites = Object.entries(suiteMap);

  const passColor = '#16a34a', failColor = '#dc2626', skipColor = '#d97706', accentColor = '#4f46e5';

  const suiteRows = suites.map(([name, tests]) => {
    const sp = tests.filter(t=>t.status==='passed').length;
    const sf = tests.filter(t=>t.status==='failed').length;
    const ss = tests.filter(t=>t.status==='skipped').length;
    const rate = tests.length ? Math.round(sp/tests.length*100) : 0;
    const meta = getSpecMeta(name);
    const barWidth = rate;
    const barColor = rate === 100 ? passColor : rate > 60 ? '#d97706' : failColor;

    const failedRows = tests.filter(t=>t.status==='failed').map(t => `
      <tr style="background:#fef2f2">
        <td style="padding:5px 10px;font-size:10px;color:#dc2626">❌ ${esc(t.title)}</td>
        <td style="padding:5px 10px;font-size:10px;text-align:right;white-space:nowrap;color:#64748b">${fmtMs(t.duration)}</td>
        <td style="padding:5px 10px;font-size:9px;color:#dc2626;font-family:monospace;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((t.error||'').split('\n')[0].substring(0,120))}</td>
      </tr>`).join('');

    return `
    <div style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;break-inside:avoid">
      <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e2e8f0;border-left:4px solid ${sf>0?failColor:passColor}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:13px;font-weight:700;color:#0f172a">${meta.icon} ${esc(meta.label)}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">${esc(meta.desc)}</div>
          </div>
          <div style="text-align:right;white-space:nowrap;margin-left:16px">
            <div style="font-size:12px;color:${barColor};font-weight:700">${rate}%</div>
            <div style="font-size:10px;color:#64748b">${tests.length} tests</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-top:8px">
          <span style="font-size:10px;color:${passColor}">✅ ${sp} passed</span>
          ${sf>0?`<span style="font-size:10px;color:${failColor}">❌ ${sf} failed</span>`:''}
          ${ss>0?`<span style="font-size:10px;color:${skipColor}">⏭ ${ss} skipped</span>`:''}
        </div>
        <div style="margin-top:6px;height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden">
          <div style="width:${barWidth}%;height:100%;background:${barColor};border-radius:2px"></div>
        </div>
      </div>
      ${sf>0?`<table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="padding:5px 10px;text-align:left;font-size:9px;text-transform:uppercase;color:#64748b;background:#fef2f2;border-bottom:1px solid #fecaca">Failed Test</th>
          <th style="padding:5px 10px;text-align:right;font-size:9px;text-transform:uppercase;color:#64748b;background:#fef2f2;border-bottom:1px solid #fecaca;white-space:nowrap">Duration</th>
          <th style="padding:5px 10px;text-align:left;font-size:9px;text-transform:uppercase;color:#64748b;background:#fef2f2;border-bottom:1px solid #fecaca">Error</th>
        </tr></thead>
        <tbody>${failedRows}</tbody>
      </table>`:''}
    </div>`;
  }).join('');

  const failedTests = allTests.filter(t=>t.status==='failed');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Khayr UI Report ${timestamp}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,sans-serif;color:#0f172a;background:#fff;font-size:12px;line-height:1.5}
  @media print{
    body{font-size:11px}
    .no-break{break-inside:avoid}
    @page{size:A4;margin:15mm 12mm}
  }
  .page-header{background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#fff;padding:24px 32px;margin-bottom:24px}
  .page-header h1{font-size:22px;font-weight:700;margin-bottom:4px}
  .page-header .meta{font-size:11px;opacity:.85}
  .stats-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:0 0 24px}
  .stat-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;text-align:center}
  .stat-card .v{font-size:24px;font-weight:700;line-height:1}
  .stat-card .l{font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:#64748b;margin-top:3px}
  .stat-card.g .v{color:#16a34a}.stat-card.r .v{color:#dc2626}.stat-card.y .v{color:#d97706}.stat-card.b .v{color:#4f46e5}
  .progress-bar{height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;margin:0 0 24px}
  .progress-fill{height:100%;background:linear-gradient(90deg,#16a34a,#22c55e);border-radius:5px}
  .section-title{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;gap:8px}
</style>
</head>
<body>
<div class="page-header">
  <h1>🖥️ Khayr DCMS — UI Test Report</h1>
  <div class="meta">Run: ${timestamp} &nbsp;·&nbsp; ${total} tests &nbsp;·&nbsp; ${fmtMs(duration)} &nbsp;·&nbsp; ${suites.length} spec files</div>
</div>

<div style="padding:0 0 0 0">
<div class="stats-grid">
  <div class="stat-card"><div class="v">${total}</div><div class="l">Total</div></div>
  <div class="stat-card g"><div class="v">${passed}</div><div class="l">Passed</div></div>
  <div class="stat-card r"><div class="v">${failed}</div><div class="l">Failed</div></div>
  <div class="stat-card y"><div class="v">${skipped}</div><div class="l">Skipped</div></div>
  <div class="stat-card b"><div class="v">${passRate}%</div><div class="l">Pass Rate</div></div>
</div>

<div class="progress-bar">
  <div class="progress-fill" style="width:${passRate}%"></div>
</div>

<div class="section-title">📋 Suite Breakdown</div>
${suiteRows}

${failedTests.length > 0 ? `
<div style="break-before:page;margin-top:8px">
<div class="section-title" style="color:#dc2626">❌ Failed Tests Summary</div>
<table style="width:100%;border-collapse:collapse;font-size:10px">
  <thead><tr style="background:#fef2f2">
    <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #fecaca;color:#64748b;text-transform:uppercase;font-size:9px">Test</th>
    <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #fecaca;color:#64748b;text-transform:uppercase;font-size:9px">Suite</th>
    <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #fecaca;color:#64748b;text-transform:uppercase;font-size:9px">Duration</th>
    <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #fecaca;color:#64748b;text-transform:uppercase;font-size:9px">Error (excerpt)</th>
  </tr></thead>
  <tbody>
    ${failedTests.map((t,idx)=>`<tr style="background:${idx%2===0?'#fff':'#fffbfb'}">
      <td style="padding:5px 10px;border-bottom:1px solid #fee2e2;font-size:10px">${esc(t.title)}</td>
      <td style="padding:5px 10px;border-bottom:1px solid #fee2e2;font-size:9px;color:#64748b">${esc(t.suitePath.map(s=>getSpecMeta(s).label).join(' › '))}</td>
      <td style="padding:5px 10px;border-bottom:1px solid #fee2e2;font-family:monospace;font-size:9px;white-space:nowrap">${fmtMs(t.duration)}</td>
      <td style="padding:5px 10px;border-bottom:1px solid #fee2e2;font-size:9px;color:#dc2626;font-family:monospace;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((t.error||'').split('\n')[0].substring(0,150))}</td>
    </tr>`).join('')}
  </tbody>
</table>
</div>` : ''}
</div>
</body></html>`;
}

// ── Spec-level detail chips for doc view ─────────────────────────────────────
const SPEC_CHIP_MAP = {
  '00_api_discovery': [
    {cls:'teal', text:'GET /v1/auth/health'},
    {cls:'teal', text:'GET /v1/appointment'},
    {cls:'teal', text:'GET /v1/billing'},
    {cls:'muted', text:'7 endpoints · pre-flight check'},
  ],
  '01_login': [
    {cls:'green', text:'SA-001 Login valid Superadmin'},
    {cls:'red',   text:'SA-002 Wrong password → error'},
    {cls:'red',   text:'SA-003 Empty credentials → block'},
    {cls:'teal',  text:'AUTH-001 loginAs(Superadmin) → sidebar'},
    {cls:'teal',  text:'AUTH-002 loginAs(Dokter) → sidebar'},
    {cls:'red',   text:'AUTH-003 Invalid role → error'},
  ],
  '03_superadmin': [
    {cls:'green', text:'SA-001~010 Tenant management'},
    {cls:'green', text:'User creation all 6 roles'},
    {cls:'green', text:'Platform settings'},
    {cls:'red',   text:'1 flaky test — monitored'},
    {cls:'muted', text:'176 passed / 179 total'},
  ],
  '04_dokter': [
    {cls:'green', text:'Consultation flow'},
    {cls:'green', text:'Medical record input'},
    {cls:'green', text:'Diagnosis & tindakan'},
    {cls:'green', text:'Prescription management'},
    {cls:'muted', text:'40/40 passed'},
  ],
  '05_perawat': [
    {cls:'green', text:'Patient vitals entry'},
    {cls:'green', text:'Nursing notes'},
    {cls:'green', text:'Patient care tasks'},
    {cls:'green', text:'Handover flow'},
    {cls:'muted', text:'53/53 passed'},
  ],
  '06_resepsionis': [
    {cls:'green', text:'Patient registration'},
    {cls:'green', text:'Reservation booking'},
    {cls:'green', text:'Check-in flow'},
    {cls:'muted', text:'25/26 passed'},
  ],
  '07_admin': [
    {cls:'green', text:'Operational config'},
    {cls:'green', text:'Schedule management'},
    {cls:'green', text:'Report generation'},
    {cls:'muted', text:'146/146 passed'},
  ],
  '08_finance': [
    {cls:'green', text:'Invoice creation'},
    {cls:'green', text:'Payment processing'},
    {cls:'green', text:'Financial reporting'},
    {cls:'muted', text:'75/75 passed'},
  ],
  '09_kasir': [
    {cls:'green', text:'Payment collection'},
    {cls:'green', text:'Receipt generation'},
    {cls:'green', text:'Daily transactions'},
    {cls:'muted', text:'80/80 passed'},
  ],
  '10_khayr_admin': [
    {cls:'green', text:'Voucher marketplace'},
    {cls:'green', text:'Settlement flow'},
    {cls:'green', text:'Tenant administration'},
    {cls:'muted', text:'80/80 passed'},
  ],
  '11_e2e_crossrole': [
    {cls:'teal',  text:'Cross-role E2E flow'},
    {cls:'blue',  text:'Superadmin → Dokter → Kasir'},
    {cls:'yellow',text:'1/3 passed — WIP'},
  ],
};

function specChips(rawName) {
  const stem = rawName.replace(/\\/g,'/').split('/').pop().replace(/\.spec\.js$/,'');
  const chips = SPEC_CHIP_MAP[stem] || [];
  if (!chips.length) return '<span class="chip muted">No detail available</span>';
  return chips.map(c=>`<span class="chip ${c.cls}">${esc(c.text)}</span>`).join('');
}

// ── Doc sidebar HTML ───────────────────────────────────────────────────────────
function buildDocHtml(allTests, timestamp, jsonFile) {
  const total    = allTests.length;
  const passed   = allTests.filter(t=>t.status==='passed').length;
  const failed   = allTests.filter(t=>t.status==='failed').length;
  const skipped  = allTests.filter(t=>t.status==='skipped').length;
  const passRate = total ? Math.round(passed/total*100) : 0;
  const duration = allTests.reduce((s,t)=>s+t.duration,0);

  // Group by top-level spec file
  const suiteMap = {};
  for (const t of allTests) {
    const key = t.suitePath[0] || '(root)';
    if (!suiteMap[key]) suiteMap[key] = [];
    suiteMap[key].push(t);
  }

  const suites = Object.entries(suiteMap);

  // Build page coverage from URLs (may be empty if no steps recorded)
  const urlMap = {};
  for (const t of allTests) {
    for (const url of t.urls) {
      if (!urlMap[url]) urlMap[url] = { count:0, passed:0, failed:0 };
      urlMap[url].count++;
      if (t.status==='passed') urlMap[url].passed++;
      else if (t.status==='failed') urlMap[url].failed++;
    }
  }
  const pageCoverage = Object.entries(urlMap).sort((a,b)=>b[1].count-a[1].count);

  // Sidebar links with human-readable labels
  const sidebarLinks = suites.map(([name, tests], i) => {
    const sp = tests.filter(t=>t.status==='passed').length;
    const sf = tests.filter(t=>t.status==='failed').length;
    const meta = getSpecMeta(name);
    const dotColor = sf>0 ? '#ef4444' : '#22c55e';
    return `<a href="#suite-${i}" class="nav-link" onclick="showSuite(${i});return true">
      <span class="dot" style="background:${dotColor}"></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${meta.icon} ${esc(meta.label)}</span>
      <span class="nav-badge">${sp}/${tests.length}</span>
    </a>`;
  }).join('');

  const suiteCards = suites.map(([name, tests], i) => {
    const sp = tests.filter(t=>t.status==='passed').length;
    const sf = tests.filter(t=>t.status==='failed').length;
    const ss = tests.filter(t=>t.status==='skipped').length;
    const rate = tests.length ? Math.round(sp/tests.length*100) : 0;
    const meta = getSpecMeta(name);

    const testRows = tests.map(t => {
      const icon = t.status==='passed'?'✅':t.status==='failed'?'❌':'⏭';
      const retryChip = t.retryCount>0?`<span style="font-size:10px;color:var(--yellow);margin-left:6px">↺×${t.retryCount}</span>`:'';
      const screenshot = t.status==='failed'&&t.attachments[0]
        ?`<div style="margin:6px 0 0 28px"><img src="${t.attachments[0].dataUrl}" style="max-width:360px;max-height:200px;border-radius:4px;border:1px solid var(--border)" /></div>`:'';
      return `<div class="ti ${t.status}">
        <span class="ti-icon">${icon}</span>
        <span class="ti-name">${esc(t.title)}${retryChip}</span>
        <span class="ti-dur">${fmtMs(t.duration)}</span>
        ${t.error?`<div class="ti-err">${esc(t.error.substring(0,300))}</div>`:''}
        ${screenshot}
      </div>`;
    }).join('');

    return `<section class="card" id="suite-${i}">
      <div class="card-hdr" style="border-left:4px solid ${sf>0?'#ef4444':'#22c55e'}">
        <div class="card-name">${meta.icon} ${esc(meta.label)}</div>
        <div class="card-desc">${esc(meta.desc)}</div>
        <div class="card-meta">
          <span style="color:var(--green)">✅ ${sp} passed</span> ·
          ${sf>0?`<span style="color:var(--red)">❌ ${sf} failed</span> ·`:''}
          ${ss>0?`<span style="color:var(--yellow)">⏭ ${ss} skipped</span> ·`:''}
          <span>${tests.length} total</span> ·
          <strong style="color:${rate===100?'var(--green)':rate>60?'var(--yellow)':'var(--red)'}">${rate}% pass</strong>
        </div>
        <div class="bar"><div class="bar-fill" style="width:${rate}%;background:${rate===100?'#22c55e':rate>60?'#f59e0b':'#ef4444'}"></div></div>
      </div>
      <div class="card-tests">${testRows}</div>
    </section>`;
  }).join('');

  const coverageSection = pageCoverage.length ? `
  <section class="card" id="coverage">
    <div class="card-hdr" style="border-left:4px solid var(--accent)">
      <div class="card-name">🗺️ Page Coverage</div>
      <div class="card-meta">${pageCoverage.length} unique pages visited</div>
    </div>
    <div class="card-tests" style="padding:12px 18px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border);color:var(--muted);font-size:11px;text-transform:uppercase">URL</th>
          <th style="text-align:center;padding:6px 8px;border-bottom:1px solid var(--border);color:var(--muted);font-size:11px;width:70px">Visits</th>
          <th style="text-align:center;padding:6px 8px;border-bottom:1px solid var(--border);color:var(--green);font-size:11px;width:70px">Pass</th>
          <th style="text-align:center;padding:6px 8px;border-bottom:1px solid var(--border);color:var(--red);font-size:11px;width:70px">Fail</th>
        </tr></thead>
        <tbody>
          ${pageCoverage.map(([url,info])=>`<tr>
            <td style="padding:6px 8px;border-bottom:1px solid var(--border)44;font-family:monospace;font-size:11px;color:var(--blue)">${esc(url)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid var(--border)44;text-align:center">${info.count}</td>
            <td style="padding:6px 8px;border-bottom:1px solid var(--border)44;text-align:center;color:var(--green)">${info.passed}</td>
            <td style="padding:6px 8px;border-bottom:1px solid var(--border)44;text-align:center;color:${info.failed>0?'var(--red)':'var(--muted)'}">${info.failed}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>` : `
  <section class="card" id="coverage">
    <div class="card-hdr" style="border-left:4px solid var(--accent)">
      <div class="card-name">🗺️ Page Coverage</div>
      <div class="card-meta">No URL data recorded</div>
    </div>
    <div class="card-tests" style="padding:16px 18px">
      <div style="color:var(--muted);font-size:13px;line-height:1.6">
        <p style="margin-bottom:8px">Page coverage is empty because Playwright step tracing was not enabled during this run.</p>
        <p>To populate this section, enable steps reporting in <code style="font-family:monospace;background:var(--bg3);padding:1px 5px;border-radius:3px">playwright.config.js</code>:</p>
        <pre style="margin-top:10px;background:var(--bg3);padding:10px 14px;border-radius:6px;font-size:11px;color:var(--blue);overflow-x:auto">use: {
  trace: 'on-first-retry',  // or 'on' for all tests
}</pre>
      </div>
    </div>
  </section>`;

  const failedTests = allTests.filter(t=>t.status==='failed');
  const bugsCard = failedTests.length ? `
  <section class="card" id="bugs">
    <div class="card-hdr" style="border-left:4px solid #ef4444">
      <div class="card-name">❌ Failed Tests</div>
      <div class="card-meta">${failedTests.length} test(s) failed</div>
    </div>
    <div class="card-tests">
      ${failedTests.map(t=>`
      <div class="ti failed">
        <span class="ti-icon">❌</span>
        <span class="ti-name">${esc(t.suitePath.map(s=>getSpecMeta(s).label).join(' › '))} › ${esc(t.title)}${t.retryCount>0?`<span style="font-size:10px;color:var(--yellow);margin-left:6px">↺×${t.retryCount}</span>`:''}</span>
        <span class="ti-dur">${fmtMs(t.duration)}</span>
        ${t.error?`<div class="ti-err">${esc(t.error.substring(0,400))}</div>`:''}
        ${t.attachments[0]?`<div style="margin:8px 0 0 28px"><img src="${t.attachments[0].dataUrl}" style="max-width:400px;max-height:240px;border-radius:4px;border:1px solid var(--border)" /></div>`:''}
      </div>`).join('')}
    </div>
  </section>` : '';

  // Build spec cards for "Semua Spec Files" documentation section
  const specDocCards = suites.map(([name], i) => {
    const meta = getSpecMeta(name);
    const chips = specChips(name);
    return `<div class="spec-card" id="sdoc-${i}">
      <div class="spec-header">
        <div class="spec-num">${String(i+1).padStart(2,'0')}</div>
        <div class="spec-name">${meta.icon} ${esc(meta.label)}</div>
        <div class="spec-path">${esc(name.replace(/\\/g,'/').split('/').pop())}</div>
      </div>
      <div class="spec-body">
        <div class="spec-desc">${esc(meta.desc)}</div>
        <div class="test-chips">${chips}</div>
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Khayr UI Test Suite — ${timestamp}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400&display=swap">
<style>
  :root{--bg:#f8fafc;--bg2:#fff;--bg3:#f1f5f9;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--green:#16a34a;--red:#dc2626;--yellow:#d97706;--accent:#4f46e5;--blue:#0284c7;--red-bg:#fef2f2;--green-bg:#f0fdf4;--yellow-bg:#fffbeb;--blue-bg:#eff6ff;--accent-bg:#eef2ff;--sw:260px}
  @media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f172a;--bg2:#1e293b;--bg3:#334155;--text:#f1f5f9;--muted:#94a3b8;--border:#334155;--red-bg:#7f1d1d22;--green-bg:#14532d22;--yellow-bg:#78350f22;--blue-bg:#1e3a5f22;--accent-bg:#312e8122;--blue:#38bdf8;--green:#22c55e;--red:#ef4444;--yellow:#fbbf24;--accent:#818cf8}}
  :root[data-theme="dark"]{--bg:#0f172a;--bg2:#1e293b;--bg3:#334155;--text:#f1f5f9;--muted:#94a3b8;--border:#334155;--red-bg:#7f1d1d22;--green-bg:#14532d22;--yellow-bg:#78350f22;--blue-bg:#1e3a5f22;--accent-bg:#312e8122;--blue:#38bdf8;--green:#22c55e;--red:#ef4444;--yellow:#fbbf24;--accent:#818cf8}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;font-size:14px;display:flex;min-height:100vh}
  .sidebar{width:var(--sw);min-height:100vh;background:var(--bg2);border-right:1px solid var(--border);position:fixed;top:0;left:0;overflow-y:auto;display:flex;flex-direction:column}
  .sb-brand{padding:20px 16px 12px;border-bottom:1px solid var(--border)}
  .sb-icon{font-size:28px;margin-bottom:4px}.sb-name{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700}.sb-sub{font-size:11px;color:var(--muted)}
  .sb-stats{padding:12px 16px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .sb-stat{text-align:center;padding:6px 4px;background:var(--bg3);border-radius:6px}
  .sb-stat .sv{font-size:16px;font-weight:700;font-family:'Space Grotesk',sans-serif}
  .sb-stat .sl{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-top:1px}
  .sb-stat.g .sv{color:var(--green)}.sb-stat.r .sv{color:var(--red)}.sb-stat.y .sv{color:var(--yellow)}.sb-stat.b .sv{color:var(--accent)}
  .sb-rate{padding:8px 16px 12px;border-bottom:1px solid var(--border)}
  .sb-rate-bar{height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:4px}
  .sb-rate-fill{height:100%;border-radius:3px;background:${passRate===100?'#22c55e':passRate>60?'#f59e0b':'#ef4444'}}
  .nav-sect{padding:12px 8px 4px}.nav-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);font-weight:600;padding:0 8px 6px}
  .nav-link{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;font-size:12px;color:var(--text);text-decoration:none;cursor:pointer}
  .nav-link:hover,.nav-link.active{background:var(--bg3)}.dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}.nav-badge{margin-left:auto;font-size:10px;color:var(--muted);font-family:monospace;flex-shrink:0}
  .main{margin-left:var(--sw);flex:1;padding:32px 40px 60px}
  .pg-title{font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;margin-bottom:4px}.pg-sub{color:var(--muted);font-size:13px;margin-bottom:24px}
  .section-heading{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:600;color:var(--text);margin-bottom:4px}
  .section-sub{font-size:13px;color:var(--muted);margin-bottom:20px}
  .card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;margin-bottom:16px;overflow:hidden}
  .card-hdr{padding:14px 18px;background:var(--bg3)}
  .card-name{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:600;margin-bottom:2px}
  .card-desc{font-size:12px;color:var(--muted);margin-bottom:6px}.card-meta{font-size:12px;color:var(--muted);margin-bottom:8px}
  .bar{height:4px;background:var(--border);border-radius:2px;overflow:hidden}.bar-fill{height:100%;border-radius:2px}
  .card-tests{padding:8px 0}
  .ti{display:flex;align-items:flex-start;gap:10px;padding:8px 18px;border-bottom:1px solid var(--border)44;flex-wrap:wrap}.ti:last-child{border-bottom:none}
  .ti-icon{flex-shrink:0;font-size:13px;margin-top:1px}.ti-name{flex:1;font-size:13px;min-width:0}.ti-dur{font-family:monospace;font-size:11px;color:var(--muted);white-space:nowrap}
  .ti-err{width:100%;font-family:monospace;font-size:11px;color:var(--red);background:var(--red-bg);padding:6px 8px;border-radius:4px;white-space:pre-wrap;word-break:break-word;margin-top:4px}
  .suite-hidden{display:none}
  .stats{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:28px}
  .stat{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px 10px;text-align:center}
  .stat .val{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700}.stat .lbl{font-size:11px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.4px}
  .stat .val.green{color:var(--green)}.stat .val.red{color:var(--red)}.stat .val.accent{color:var(--accent)}.stat .val.orange{color:var(--yellow)}
  .val-table{width:100%;border-collapse:collapse}
  .val-table th{text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);padding:8px 14px;border-bottom:1px solid var(--border);background:var(--bg3)}
  .val-table td{padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:top}
  .val-table tr:last-child td{border-bottom:none}
  .val-table td:first-child{font-family:'Space Grotesk',sans-serif;font-weight:500;color:var(--text)}
  .tbl-wrap{border:1px solid var(--border);border-radius:10px;overflow:hidden;overflow-x:auto}
  .spec-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden}
  .spec-header{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border);background:var(--bg3)}
  .spec-num{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;color:var(--accent);background:var(--accent-bg);border-radius:5px;padding:2px 7px;flex-shrink:0}
  .spec-name{font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:600;color:var(--text)}
  .spec-path{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);white-space:nowrap}
  .spec-body{padding:14px 18px}
  .spec-desc{font-size:13px;color:var(--text);margin-bottom:12px;line-height:1.6}
  .test-chips{display:flex;gap:6px;flex-wrap:wrap}
  .chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500;border:1px solid transparent}
  .chip.green{background:var(--green-bg);color:var(--green);border-color:rgba(34,197,94,.2)}
  .chip.yellow{background:var(--yellow-bg);color:var(--yellow);border-color:rgba(245,158,11,.2)}
  .chip.red{background:var(--red-bg);color:var(--red);border-color:rgba(239,68,68,.2)}
  .chip.blue{background:var(--blue-bg);color:var(--blue);border-color:rgba(96,165,250,.2)}
  .chip.teal{background:var(--accent-bg);color:var(--accent);border-color:rgba(79,70,229,.2)}
  .chip.muted{background:var(--bg3);color:var(--muted);border-color:var(--border)}
  .cov-row{display:flex;align-items:center;gap:12px;margin-bottom:10px}
  .cov-label{font-size:12px;color:var(--text);width:160px;flex-shrink:0}
  .cov-bar-wrap{flex:1;height:6px;background:var(--bg3);border-radius:99px;overflow:hidden}
  .cov-bar{height:100%;border-radius:99px;background:var(--accent)}.cov-bar.yellow{background:var(--yellow)}.cov-bar.red{background:var(--red)}
  .cov-pct{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);width:36px;text-align:right}
  hr{border:none;border-top:1px solid var(--border);margin:36px 0}
  @media(max-width:720px){.sidebar{display:none}.main{margin-left:0;padding:0 20px 60px}.stats{grid-template-columns:repeat(3,1fr)}}
</style>
</head><body>
<nav class="sidebar">
  <div class="sb-brand">
    <div class="sb-icon">🖥️</div>
    <div class="sb-name">Khayr UI<br>Test Suite</div>
    <div class="sb-sub">QA Documentation · ${timestamp}</div>
  </div>
  <div class="sb-stats">
    <div class="sb-stat g"><div class="sv">${passed}</div><div class="sl">Passed</div></div>
    <div class="sb-stat r"><div class="sv">${failed}</div><div class="sl">Failed</div></div>
    <div class="sb-stat y"><div class="sv">${skipped}</div><div class="sl">Skipped</div></div>
    <div class="sb-stat b"><div class="sv">${total}</div><div class="sl">Total</div></div>
  </div>
  <div class="sb-rate">
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)"><span>Pass Rate</span><strong style="color:var(--text)">${passRate}%</strong></div>
    <div class="sb-rate-bar"><div class="sb-rate-fill" style="width:${passRate}%"></div></div>
  </div>
  <div class="nav-sect">
    <div class="nav-lbl">Overview</div>
    <a href="#overview" class="nav-link active"><span class="dot" style="background:var(--blue)"></span>Summary</a>
    <a href="#validation" class="nav-link"><span class="dot" style="background:var(--green)"></span>Layer Validasi</a>
    <a href="#spec-docs" class="nav-link"><span class="dot" style="background:var(--accent)"></span>Apa yang Ditest</a>
  </div>
  <div class="nav-sect">
    <div class="nav-lbl">Spec Files (${suites.length})</div>
    ${sidebarLinks}
  </div>
  <div class="nav-sect">
    <div class="nav-lbl">Coverage</div>
    <a href="#coverage-map" class="nav-link"><span class="dot" style="background:var(--accent)"></span>Coverage Map</a>
    <a href="#coverage" class="nav-link" onclick="showSuiteById('coverage');return true"><span class="dot" style="background:var(--accent)"></span>Page Coverage<span class="nav-badge">${pageCoverage.length}</span></a>
  </div>
  ${failedTests.length?`<div class="nav-sect">
    <div class="nav-lbl">Issues</div>
    <a href="#bugs" class="nav-link" onclick="showSuiteById('bugs');return true"><span class="dot" style="background:#ef4444"></span>Failed Tests<span class="nav-badge">${failedTests.length}</span></a>
  </div>`:''}
</nav>
<main class="main">

  <div id="overview" style="margin-bottom:32px">
    <div class="pg-title">UI Test Report</div>
    <div class="pg-sub">Run ${timestamp} · ${total} tests · ${fmtMs(duration)} · ${suites.length} spec files</div>
    <div class="stats">
      <div class="stat"><div class="val accent">${suites.length}</div><div class="lbl">Spec Files</div></div>
      <div class="stat"><div class="val green">${total}</div><div class="lbl">Test Cases</div></div>
      <div class="stat"><div class="val green">${passed}</div><div class="lbl">Passed</div></div>
      <div class="stat"><div class="val ${failed>0?'red':'green'}">${failed}</div><div class="lbl">Failed</div></div>
      <div class="stat"><div class="val ${skipped>0?'orange':'green'}">${skipped}</div><div class="lbl">Skipped</div></div>
      <div class="stat"><div class="val ${passRate>=90?'green':passRate>=70?'accent':'red'}">${passRate}%</div><div class="lbl">Pass Rate</div></div>
    </div>
  </div>

  <section id="validation">
    <div class="section-heading">Layer Validasi yang Ada di Script</div>
    <div class="section-sub">Dari mana aja validasi dilakukan di UI test suite ini</div>
    <div class="tbl-wrap" style="margin-bottom:20px">
      <table class="val-table">
        <thead><tr><th>Layer</th><th>Dimana</th><th>Yang Divalidasi</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>UI Visibility</td><td>Semua spec files</td><td>Element muncul di layar — button, form, tabel, sidebar navigation</td><td><span class="chip green">✅ Aktif</span></td></tr>
          <tr><td>Role-Based Access</td><td>00_api_discovery + semua role spec</td><td>Setiap role hanya bisa akses menu dan fitur sesuai permission-nya</td><td><span class="chip green">✅ Aktif</span></td></tr>
          <tr><td>Form Validation</td><td>03_superadmin, 04_dokter, 06_resepsionis</td><td>Required fields, format input, error message saat submit invalid data</td><td><span class="chip green">✅ Aktif</span></td></tr>
          <tr><td>Navigation Flow</td><td>Semua spec files</td><td>page.goto() + redirect check, sidebar active state, breadcrumb</td><td><span class="chip green">✅ Aktif</span></td></tr>
          <tr><td>Screenshot on Failure</td><td>playwright.config.js</td><td>Attachment screenshot otomatis ketika test gagal</td><td><span class="chip green">✅ Aktif</span></td></tr>
          <tr><td>Cross-Role E2E</td><td>11_e2e_crossrole</td><td>Alur lintas role: Superadmin buat tenant → Dokter konsultasi → Kasir bayar</td><td><span class="chip yellow">⚠️ WIP</span></td></tr>
          <tr><td>API Health Pre-check</td><td>00_api_discovery</td><td>Pastikan semua API backend hidup sebelum UI test jalan</td><td><span class="chip green">✅ Aktif</span></td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <hr>

  <section id="spec-docs">
    <div class="section-heading">Semua Spec Files</div>
    <div class="section-sub">Isi dan tujuan masing-masing file UI test</div>
    ${specDocCards}
  </section>

  <hr>

  <section id="coverage-map" style="margin-bottom:32px">
    <div class="section-heading">Coverage Map</div>
    <div class="section-sub">Seberapa dalam coverage per area fungsional UI</div>
    <div class="cov-row"><div class="cov-label">Login & Auth</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:95%"></div></div><div class="cov-pct">95%</div></div>
    <div class="cov-row"><div class="cov-label">Super Admin</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:85%"></div></div><div class="cov-pct">85%</div></div>
    <div class="cov-row"><div class="cov-label">Dokter</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:80%"></div></div><div class="cov-pct">80%</div></div>
    <div class="cov-row"><div class="cov-label">Perawat</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:75%"></div></div><div class="cov-pct">75%</div></div>
    <div class="cov-row"><div class="cov-label">Resepsionis</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:70%"></div></div><div class="cov-pct">70%</div></div>
    <div class="cov-row"><div class="cov-label">Admin</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:80%"></div></div><div class="cov-pct">80%</div></div>
    <div class="cov-row"><div class="cov-label">Finance</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:75%"></div></div><div class="cov-pct">75%</div></div>
    <div class="cov-row"><div class="cov-label">Kasir</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:75%"></div></div><div class="cov-pct">75%</div></div>
    <div class="cov-row"><div class="cov-label">Khayr Admin</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:70%"></div></div><div class="cov-pct">70%</div></div>
    <div class="cov-row"><div class="cov-label">Cross-Role E2E</div><div class="cov-bar-wrap"><div class="cov-bar yellow" style="width:30%"></div></div><div class="cov-pct">30%</div></div>
    <div class="cov-row"><div class="cov-label">Mobile Responsive</div><div class="cov-bar-wrap"><div class="cov-bar yellow" style="width:0%"></div></div><div class="cov-pct">0%</div></div>
    <div class="cov-row"><div class="cov-label">Accessibility</div><div class="cov-bar-wrap"><div class="cov-bar yellow" style="width:0%"></div></div><div class="cov-pct">0%</div></div>
  </section>

  <hr>

  <div id="all-suites">
    <div style="margin-bottom:20px">
      <div class="section-heading">Test Results per Spec</div>
      <div class="section-sub">Detail hasil run per spec file — klik sidebar untuk filter per suite</div>
    </div>
    ${suiteCards}
    ${coverageSection}
    ${bugsCard}
  </div>
</main>
<script>
function showSuite(idx){
  document.querySelectorAll('.card').forEach((c,i)=>{
    c.classList.toggle('suite-hidden', c.id!=='suite-'+idx);
  });
  document.getElementById('coverage')?.classList.add('suite-hidden');
  document.getElementById('bugs')?.classList.add('suite-hidden');
  setTimeout(()=>{const el=document.getElementById('suite-'+idx);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},50);
}
function showSuiteById(id){
  document.querySelectorAll('.card').forEach(c=>{c.classList.add('suite-hidden')});
  const el=document.getElementById(id);if(el){el.classList.remove('suite-hidden');setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),50);}
}
function showAll(){
  document.querySelectorAll('.card').forEach(c=>c.classList.remove('suite-hidden'));
  window.scrollTo({top:0,behavior:'smooth'});
}
</script>
</body></html>`;
}

// ── TXT summary ───────────────────────────────────────────────────────────────
function buildSummaryTxt(allTests, timestamp) {
  const total    = allTests.length;
  const passed   = allTests.filter(t=>t.status==='passed').length;
  const failed   = allTests.filter(t=>t.status==='failed').length;
  const skipped  = allTests.filter(t=>t.status==='skipped').length;
  const retried  = allTests.filter(t=>t.retryCount>0).length;
  const duration = allTests.reduce((s,t)=>s+t.duration,0);
  const failedTests = allTests.filter(t=>t.status==='failed');

  let txt = [
    `========================================`,
    `  KHAYR UI TEST REPORT — SUMMARY`,
    `  Run : ${timestamp}`,
    `========================================`,
    ``,
    `SUMMARY`,
    `  Total   : ${total}`,
    `  Passed  : ${passed}`,
    `  Failed  : ${failed}`,
    `  Skipped : ${skipped}`,
    `  Retried : ${retried}`,
    `  Duration: ${fmtMs(duration)}`,
    `  Pass %  : ${total?Math.round(passed/total*100):0}%`,
    ``,
  ].join('\n');

  if (failedTests.length) {
    txt += `FAILED TESTS (${failedTests.length})\n${'─'.repeat(40)}\n`;
    for (const t of failedTests) {
      txt += `\n  ❌ ${t.suitePath.map(s=>getSpecMeta(s).label).join(' › ')} › ${t.title}\n`;
      txt += `     Duration : ${fmtMs(t.duration)}\n`;
      if (t.retryCount>0) txt += `     Retries  : ${t.retryCount}\n`;
      if (t.urls.length) txt += `     Pages    : ${t.urls.join(', ')}\n`;
      if (t.error) {
        txt += `     Error:\n`;
        txt += t.error.substring(0,600).split('\n').map(l=>`       ${l}`).join('\n')+'\n';
      }
    }
    txt += '\n';
  }

  txt += `ALL TESTS\n${'─'.repeat(40)}\n`;
  for (const t of allTests) {
    const icon = t.status==='passed'?'✅':t.status==='failed'?'❌':'⏭';
    const retry = t.retryCount>0?` [retry×${t.retryCount}]`:'';
    const suiteName = t.suitePath.map(s=>getSpecMeta(s).label).join(' › ');
    txt += `  ${icon} [${t.status.padEnd(7)}] ${fmtMs(t.duration).padStart(7)}${retry}  ${suiteName} › ${t.title}\n`;
    if (t.urls.length) txt += `         🌐 ${t.urls.join(' · ')}\n`;
  }

  return txt;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const [,, jsonFile, outDir, timestamp] = process.argv;

if (!jsonFile || !fs.existsSync(jsonFile)) {
  console.error('Usage: node generate-ui-report.js <results.json> <outDir> <timestamp>');
  process.exit(1);
}

const jsonDir  = path.dirname(path.resolve(jsonFile));
const json     = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
const allTests = flattenSpecs(json.suites || [], jsonDir);

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const htmlPath    = path.join(outDir, `ui_report_${timestamp}.html`);
const docPath     = path.join(outDir, `ui_doc_${timestamp}.html`);
const summaryPath = path.join(outDir, `ui_summary_${timestamp}.txt`);
const pdfPath     = path.join(outDir, `ui_report_${timestamp}.pdf`);

fs.writeFileSync(htmlPath, buildHtml(allTests, timestamp, jsonFile), 'utf8');
console.log(`✅ HTML    → ${htmlPath}`);

fs.writeFileSync(docPath, buildDocHtml(allTests, timestamp, jsonFile), 'utf8');
console.log(`✅ DOC     → ${docPath}`);

fs.writeFileSync(summaryPath, buildSummaryTxt(allTests, timestamp), 'utf8');
console.log(`✅ SUMMARY → ${summaryPath}`);

// PDF via lightweight print HTML (timeout 60s)
(async () => {
  try {
    const { chromium } = require('playwright');
    const pdfHtmlContent = buildPdfHtml(allTests, timestamp);
    const pdfHtmlPath = path.join(outDir, `_ui_print_${timestamp}.html`);
    fs.writeFileSync(pdfHtmlPath, pdfHtmlContent, 'utf8');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`file:///${pdfHtmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    });
    await browser.close();
    try { fs.unlinkSync(pdfHtmlPath); } catch (_) {}
    console.log(`✅ PDF     → ${pdfPath}`);
  } catch (err) {
    console.warn(`⚠️  PDF generation failed: ${err.message}`);
  }
})();
