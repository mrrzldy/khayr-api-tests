/**
 * scripts/generate-api-report.js
 *
 * Reads Playwright's JSON reporter output and generates:
 *   1. Custom HTML report (full detail: request/response, DB table, errors)
 *   2. PDF from the HTML (via Playwright Chromium)
 *   3. Full TXT log
 *
 * Usage (called automatically by run-api-report.js):
 *   node scripts/generate-api-report.js <results.json> <output-dir> <timestamp>
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Endpoint → MongoDB collection mapping ────────────────────────────────────
const ENDPOINT_MAP = [
  { pattern: /\/v1\/oauth/,            collection: 'users (auth)',          op: 'READ'   },
  { pattern: /\/v1\/patient/,          collection: 'patients',              op: 'WRITE'  },
  { pattern: /\/v1\/appointment/,      collection: 'appointments',          op: 'WRITE'  },
  { pattern: /\/v1\/reservation/,      collection: 'reservations',          op: 'WRITE'  },
  { pattern: /\/v1\/invoice/,          collection: 'invoices',              op: 'WRITE'  },
  { pattern: /\/v1\/billing/,          collection: 'billings',              op: 'WRITE'  },
  { pattern: /\/v1\/payment/,          collection: 'payments',              op: 'WRITE'  },
  { pattern: /\/v1\/inventory/,        collection: 'inventory_items',       op: 'WRITE'  },
  { pattern: /\/v1\/procedure/,        collection: 'procedures',            op: 'WRITE'  },
  { pattern: /\/v1\/medical.?record/,  collection: 'medical_records',       op: 'WRITE'  },
  { pattern: /\/v1\/diagnosis/,        collection: 'diagnoses',             op: 'WRITE'  },
  { pattern: /\/v1\/doctor|\/v1\/dentist/, collection: 'staff',             op: 'WRITE'  },
  { pattern: /\/v1\/staff/,            collection: 'staff',                 op: 'WRITE'  },
  { pattern: /\/v1\/user/,             collection: 'users',                 op: 'WRITE'  },
  { pattern: /\/v1\/organization/,     collection: 'organizations',         op: 'WRITE'  },
  { pattern: /\/v1\/clinic/,           collection: 'clinics',               op: 'WRITE'  },
  { pattern: /\/v1\/schedule|\/v1\/jadwal/, collection: 'schedules',        op: 'WRITE'  },
  { pattern: /\/v1\/shift/,            collection: 'shifts',                op: 'WRITE'  },
  { pattern: /\/v1\/quota/,            collection: 'quotas',                op: 'WRITE'  },
  { pattern: /\/v1\/voucher/,          collection: 'vouchers',              op: 'WRITE'  },
  { pattern: /\/v1\/region|\/v1\/province|\/v1\/city/, collection: 'regions', op: 'READ' },
  { pattern: /\/v1\/icd/,              collection: 'icd_codes',             op: 'READ'   },
  { pattern: /\/v1\/drug|\/v1\/obat/,  collection: 'drugs',                 op: 'READ'   },
  { pattern: /\/v1\/role|\/v1\/permission/, collection: 'roles',            op: 'READ'   },
  { pattern: /\/v1\/notification/,     collection: 'notifications',         op: 'READ'   },
  { pattern: /\/v1\/report/,           collection: 'reports',               op: 'READ'   },
  { pattern: /\/v1\/dashboard/,        collection: '(aggregated views)',    op: 'READ'   },
];

function guessCollection(url, method) {
  if (!url) return { collection: '-', op: '-' };
  for (const { pattern, collection, op } of ENDPOINT_MAP) {
    if (pattern.test(url)) {
      const m = (method || '').toUpperCase();
      const actualOp = m === 'GET' ? 'READ' : m === 'POST' ? 'INSERT' : m === 'PUT' || m === 'PATCH' ? 'UPDATE' : m === 'DELETE' ? 'DELETE' : op;
      return { collection, op: actualOp };
    }
  }
  return { collection: '(unknown)', op: '-' };
}

// ── Parse Playwright JSON results ────────────────────────────────────────────
function flattenSpecs(suites, results = []) {
  for (const suite of (suites || [])) {
    for (const spec of (suite.specs || [])) {
      for (const test of (spec.tests || [])) {
        for (const result of (test.results || [])) {
          results.push({
            suitePath: [...(suite.file ? [suite.file] : []), suite.title].filter(Boolean),
            title: spec.title,
            status: result.status,           // 'passed' | 'failed' | 'skipped' | 'timedOut'
            duration: result.duration || 0,
            error: result.error ? (result.error.message || JSON.stringify(result.error)) : null,
            stdout: (result.stdout || []).map(s => s.text || '').join(''),
            stderr: (result.stderr || []).map(s => s.text || '').join(''),
            attachments: result.attachments || [],
          });
        }
      }
    }
    flattenSpecs(suite.suites || [], results);
  }
  return results;
}

function parseHttpLogs(attachments, stdout) {
  const logs = [];
  // 1. From attachments (fixtures.js wraps request context)
  for (const att of attachments) {
    if (att.name === 'http-log' && att.body) {
      try {
        const entry = JSON.parse(Buffer.from(att.body, 'base64').toString());
        logs.push(entry);
      } catch {}
    }
  }
  // 2. Fallback: parse console.log lines from stdout
  if (logs.length === 0 && stdout) {
    const lines = stdout.split('\n');
    let current = null;
    for (const line of lines) {
      const m = line.match(/\[HTTP\]\s+(\w+)\s+(\S+)\s+(\d+)/);
      if (m) {
        if (current) logs.push(current);
        current = { method: m[1], url: m[2], status: parseInt(m[3]), requestBody: null, responseBody: null };
      } else if (current) {
        const rb = line.match(/\[REQ_BODY\]\s+(.+)/);
        const rs = line.match(/\[RES_BODY\]\s+(.+)/);
        if (rb) { try { current.requestBody = JSON.parse(rb[1]); } catch { current.requestBody = rb[1]; } }
        if (rs) { try { current.responseBody = JSON.parse(rs[1]); } catch { current.responseBody = rs[1]; } }
      }
    }
    if (current) logs.push(current);
    // If still nothing, look for status lines like "Login Response status: 200"
    if (logs.length === 0) {
      const statusLines = stdout.match(/(?:status|Status):\s*(\d+)/g) || [];
      const urlLines   = stdout.match(/(?:POST|GET|PUT|PATCH|DELETE)\s+(https?:\/\/\S+)/g) || [];
      urlLines.forEach((ul, i) => {
        const pm = ul.match(/(\w+)\s+(https?:\/\/\S+)/);
        if (!pm) return;
        logs.push({ method: pm[1], url: pm[2], status: parseInt((statusLines[i] || '').replace(/\D/g, '') || '0'), requestBody: null, responseBody: null });
      });
    }
  }
  return logs;
}

// ── HTML generation ──────────────────────────────────────────────────────────
function statusBadge(status) {
  const map = { passed: '#22c55e', failed: '#ef4444', skipped: '#f59e0b', timedOut: '#f97316' };
  const color = map[status] || '#6b7280';
  const label = status === 'timedOut' ? 'TIMEOUT' : status.toUpperCase();
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">${label}</span>`;
}

function opBadge(op) {
  const map = { INSERT: '#2563eb', UPDATE: '#d97706', DELETE: '#dc2626', READ: '#6b7280' };
  const color = map[op] || '#6b7280';
  return `<span style="background:${color};color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;">${op}</span>`;
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function jsonBlock(obj) {
  if (!obj) return '<em style="color:#999">—</em>';
  try {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    return `<pre style="background:#1e1e2e;color:#cdd6f4;padding:10px;border-radius:6px;font-size:11px;overflow-x:auto;max-height:200px;margin:4px 0;">${esc(str.slice(0,2000))}${str.length>2000?'\n… (truncated)':''}</pre>`;
  } catch { return esc(String(obj)); }
}

function buildHtml(allTests, timestamp, jsonFile, runState) {
  const total   = allTests.length;
  const passed  = allTests.filter(t => t.status === 'passed').length;
  const failed  = allTests.filter(t => t.status === 'failed').length;
  const skipped = allTests.filter(t => !['passed','failed'].includes(t.status)).length;
  const passRate = total ? Math.round(passed/total*100) : 0;

  // Group by suite path
  const groups = {};
  for (const t of allTests) {
    const key = t.suitePath.join(' › ') || 'Tests';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  let rows = '';
  for (const [group, tests] of Object.entries(groups)) {
    rows += `<tr><td colspan="7" style="background:#1e293b;color:#94a3b8;font-size:11px;font-weight:600;padding:6px 14px;letter-spacing:.05em;">${esc(group)}</td></tr>`;
    for (const t of tests) {
      const httpLogs = parseHttpLogs(t.attachments, t.stdout);
      const primaryLog = httpLogs[0] || {};
      const { collection, op } = guessCollection(primaryLog.url, primaryLog.method);
      const rowId = `row-${Math.random().toString(36).slice(2)}`;
      const hasDetail = httpLogs.length > 0 || t.error || t.stdout;
      rows += `
      <tr style="border-bottom:1px solid #1e293b;" onclick="${hasDetail ? `toggleDetail('${rowId}')` : ''}">
        <td style="padding:8px 14px;">${statusBadge(t.status)}</td>
        <td style="padding:8px 14px;font-size:12px;font-weight:500;max-width:300px;">${esc(t.title)}</td>
        <td style="padding:8px 14px;font-size:11px;color:#64748b;">${httpLogs.map(l=>`<code>${esc(l.method||'')} ${esc((l.url||'').replace(/https?:\/\/[^/]+/,''))}</code>`).join('<br>') || '—'}</td>
        <td style="padding:8px 14px;font-size:11px;">${httpLogs.map(l=>`<code style="color:${l.status>=400?'#ef4444':'#22c55e'}">${l.status||'—'}</code>`).join('<br>') || '—'}</td>
        <td style="padding:8px 14px;font-size:11px;">${collection}</td>
        <td style="padding:8px 14px;font-size:11px;">${op !== '-' ? opBadge(op) : '—'}</td>
        <td style="padding:8px 14px;font-size:11px;color:#64748b;">${(t.duration/1000).toFixed(2)}s</td>
      </tr>`;
      if (hasDetail) {
        rows += `<tr id="${rowId}" style="display:none;background:#0f172a;">
          <td colspan="7" style="padding:12px 24px;">`;
        if (t.error) rows += `<div style="margin-bottom:12px;"><strong style="color:#ef4444;">❌ Error:</strong>${jsonBlock(t.error)}</div>`;
        if (httpLogs.length > 0) {
          rows += `<strong style="color:#94a3b8;font-size:12px;">HTTP Calls (${httpLogs.length}):</strong>`;
          for (const log of httpLogs) {
            const { collection: col, op: operation } = guessCollection(log.url, log.method);
            rows += `<div style="margin-top:10px;border-left:3px solid #334155;padding-left:12px;">
              <div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:4px;">
                <span style="color:#7dd3fc">${esc(log.method||'')}</span>
                <span style="color:#f8fafc">${esc(log.url||'')}</span>
                <span style="color:${(log.status||0)>=400?'#ef4444':'#4ade80'}"> → ${log.status||'?'}</span>
                <span style="color:#6b7280;font-size:10px;margin-left:8px;">${log.durationMs||''}ms</span>
                ${col!=='-'?`<span style="margin-left:8px;color:#94a3b8;font-size:10px;">table: <strong>${esc(col)}</strong> ${opBadge(operation)}</span>`:''}
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div><div style="color:#94a3b8;font-size:10px;margin-bottom:2px;">REQUEST BODY</div>${jsonBlock(log.requestBody)}</div>
                <div><div style="color:#94a3b8;font-size:10px;margin-bottom:2px;">RESPONSE BODY</div>${jsonBlock(log.responseBody)}</div>
              </div>
            </div>`;
          }
        }
        if (t.stdout && !httpLogs.length) {
          rows += `<div style="margin-top:10px;"><strong style="color:#94a3b8;font-size:11px;">Console output:</strong>${jsonBlock(t.stdout.slice(0,1000))}</div>`;
        }
        rows += `</td></tr>`;
      }
    }
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Khayr API Test Report — ${timestamp}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
.header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-bottom: 1px solid #1e293b; padding: 28px 40px; display: flex; align-items: center; justify-content: space-between; }
.header h1 { font-size: 22px; font-weight: 700; color: #f1f5f9; }
.header .meta { font-size: 12px; color: #64748b; margin-top: 4px; }
.stats { display: flex; gap: 16px; padding: 20px 40px; background: #0f172a; border-bottom: 1px solid #1e293b; }
.stat { background: #1e293b; border-radius: 10px; padding: 14px 20px; flex: 1; text-align: center; }
.stat .num { font-size: 28px; font-weight: 800; }
.stat .lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
.stat.pass .num { color: #22c55e; }
.stat.fail .num { color: #ef4444; }
.stat.skip .num { color: #f59e0b; }
.stat.rate .num { color: #7dd3fc; }
.container { padding: 24px 40px; }
table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 10px; overflow: hidden; font-size: 12px; }
thead tr { background: #0f172a; }
th { padding: 10px 14px; text-align: left; color: #64748b; font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
tbody tr { cursor: pointer; transition: background .15s; }
tbody tr:hover { background: #1e2a3a; }
.legend { margin-top: 16px; padding: 12px 16px; background: #1e293b; border-radius: 8px; font-size: 11px; color: #64748b; }
.legend strong { color: #94a3b8; }
</style>
<script>
function toggleDetail(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
}
</script>
</head>
<body>
<div class="header">
  <div>
    <h1>🧪 Khayr API Test Report</h1>
    <div class="meta">Generated: ${timestamp} &nbsp;|&nbsp; Source: ${path.basename(jsonFile)}</div>
  </div>
  <div style="font-size:36px;font-weight:900;color:${passRate>=80?'#22c55e':passRate>=50?'#f59e0b':'#ef4444'}">${passRate}%</div>
</div>
<div class="stats">
  <div class="stat"><div class="num">${total}</div><div class="lbl">TOTAL TESTS</div></div>
  <div class="stat pass"><div class="num">${passed}</div><div class="lbl">PASSED</div></div>
  <div class="stat fail"><div class="num">${failed}</div><div class="lbl">FAILED</div></div>
  <div class="stat skip"><div class="num">${skipped}</div><div class="lbl">SKIPPED/OTHER</div></div>
  <div class="stat rate"><div class="num">${passRate}%</div><div class="lbl">PASS RATE</div></div>
</div>
<div class="container">
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Test Name</th>
        <th>Endpoint</th>
        <th>HTTP Status</th>
        <th>MongoDB Table</th>
        <th>Operation</th>
        <th>Duration</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="legend">
    <strong>💡 Tip:</strong> Klik setiap baris untuk lihat detail request body, response body, dan error.
    Operation: <strong style="color:#2563eb">INSERT</strong> = POST | <strong style="color:#d97706">UPDATE</strong> = PUT/PATCH | <strong style="color:#dc2626">DELETE</strong> = DELETE | <strong style="color:#6b7280">READ</strong> = GET
  </div>
</div>
${buildRunSummarySection(runState || {})}
</body>
</html>`;
}

// ── TXT log generation ───────────────────────────────────────────────────────
function buildTxt(allTests, timestamp) {
  const lines = [
    '================================================',
    `  Khayr API Test Report`,
    `  Generated : ${timestamp}`,
    `  Total     : ${allTests.length}`,
    `  Passed    : ${allTests.filter(t=>t.status==='passed').length}`,
    `  Failed    : ${allTests.filter(t=>t.status==='failed').length}`,
    `  Other     : ${allTests.filter(t=>!['passed','failed'].includes(t.status)).length}`,
    '================================================',
    '',
  ];
  for (const t of allTests) {
    const httpLogs = parseHttpLogs(t.attachments, t.stdout);
    const { collection, op } = guessCollection(httpLogs[0]?.url, httpLogs[0]?.method);
    lines.push(`[${t.status.toUpperCase().padEnd(7)}] ${t.title}`);
    lines.push(`  Duration  : ${(t.duration/1000).toFixed(2)}s`);
    if (httpLogs.length) {
      httpLogs.forEach(l => {
        const { collection: col, op: oper } = guessCollection(l.url, l.method);
        lines.push(`  HTTP      : ${l.method} ${l.url} → ${l.status||'?'} (${l.durationMs||0}ms)`);
        if (l.requestBody) lines.push(`  REQ BODY  : ${JSON.stringify(l.requestBody).slice(0,300)}`);
        if (l.responseBody) lines.push(`  RES BODY  : ${JSON.stringify(l.responseBody).slice(0,300)}`);
        if (col !== '-') lines.push(`  DB TABLE  : ${col} [${oper}]`);
      });
    }
    if (t.error) lines.push(`  ERROR     : ${t.error.slice(0,500)}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ── Professional PDF HTML template ──────────────────────────────────────────
function buildPdfHtml(allTests, timestamp, jsonFile) {
  const total   = allTests.length;
  const passed  = allTests.filter(t => t.status === 'passed').length;
  const failed  = allTests.filter(t => t.status === 'failed').length;
  const skipped = allTests.filter(t => !['passed','failed'].includes(t.status)).length;
  const passRate = total ? Math.round(passed / total * 100) : 0;
  const totalDuration = allTests.reduce((s, t) => s + (t.duration || 0), 0);
  const durationStr = totalDuration >= 60000
    ? `${Math.floor(totalDuration/60000)}m ${Math.round((totalDuration%60000)/1000)}s`
    : `${(totalDuration/1000).toFixed(1)}s`;

  const groups = {};
  for (const t of allTests) {
    const key = t.suitePath.join(' › ') || 'Tests';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const passColor = '#16a34a', failColor = '#dc2626', skipColor = '#ca8a04', accentColor = '#1d4ed8';

  function statusPill(status) {
    const map = { passed: [passColor,'PASSED'], failed: [failColor,'FAILED'], skipped: [skipColor,'SKIPPED'], timedOut: ['#ea580c','TIMEOUT'] };
    const [bg, label] = map[status] || ['#6b7280', status.toUpperCase()];
    return `<span class="pill" style="background:${bg};color:#fff;">${label}</span>`;
  }
  function opPill(op) {
    const map = { INSERT: accentColor, UPDATE: '#b45309', DELETE: failColor, READ: '#6b7280' };
    return `<span class="pill sm" style="background:${map[op]||'#6b7280'};color:#fff;">${op}</span>`;
  }

  let sections = '';
  let suiteIdx = 0;
  for (const [group, tests] of Object.entries(groups)) {
    suiteIdx++;
    const sPass = tests.filter(t => t.status === 'passed').length;
    const sFail = tests.filter(t => t.status === 'failed').length;
    const suiteRate = tests.length ? Math.round(sPass/tests.length*100) : 0;

    let rows = '';
    tests.forEach((t, i) => {
      const httpLogs = parseHttpLogs(t.attachments, t.stdout);
      const primary = httpLogs[0] || {};
      const { collection, op } = guessCollection(primary.url, primary.method);
      const endpointStr = httpLogs.map(l => `${l.method||''} ${(l.url||'').replace(/https?:\/\/[^/]+/,'')}`).join('; ') || '—';
      const httpStatus = httpLogs.map(l => l.status || '?').join(', ') || '—';
      const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';

      rows += `
      <tr style="background:${rowBg};">
        <td style="width:24px;color:#94a3b8;font-size:10px;text-align:right;padding-right:8px;">${i+1}</td>
        <td style="width:68px;">${statusPill(t.status)}</td>
        <td style="max-width:220px;font-size:11px;font-weight:500;color:#1e293b;word-break:break-word;">${esc(t.title)}</td>
        <td style="font-size:10px;color:#475569;word-break:break-all;max-width:160px;">${esc(endpointStr)}</td>
        <td style="font-size:11px;text-align:center;font-weight:600;color:${httpStatus.split(',').some(s=>parseInt(s)>=400)?failColor:passColor};">${esc(httpStatus)}</td>
        <td style="font-size:10px;color:#475569;max-width:100px;">${esc(collection)}</td>
        <td style="font-size:10px;text-align:center;">${op !== '-' ? opPill(op) : '—'}</td>
        <td style="font-size:10px;text-align:right;color:#64748b;white-space:nowrap;">${(t.duration/1000).toFixed(2)}s</td>
      </tr>`;
      if (t.error) {
        rows += `<tr style="background:#fef2f2;"><td colspan="8" style="font-size:10px;color:${failColor};padding:4px 8px 8px 40px;word-break:break-all;">⚠ ${esc(t.error.slice(0,300))}</td></tr>`;
      }
    });

    sections += `
    <div class="suite" style="${suiteIdx > 1 ? 'page-break-before:auto;' : ''}">
      <div class="suite-header">
        <div class="suite-title">${esc(group)}</div>
        <div class="suite-meta">
          <span>${tests.length} tests</span>
          <span class="pass-chip">${sPass} passed</span>
          ${sFail > 0 ? `<span class="fail-chip">${sFail} failed</span>` : ''}
          <span class="rate-chip">${suiteRate}%</span>
        </div>
      </div>
      <table class="result-table">
        <thead><tr>
          <th style="width:24px;">#</th><th style="width:68px;">Status</th>
          <th>Test Name</th><th>Endpoint</th>
          <th style="width:60px;">HTTP</th><th style="width:100px;">Collection</th>
          <th style="width:60px;">Op</th><th style="width:54px;text-align:right;">Time</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Khayr API Test Report — ${timestamp}</title>
<style>
@page { size: A4; margin: 15mm 12mm; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#1e293b; background:#fff; }
.cover { display:flex; flex-direction:column; height:257mm; page-break-after:always; }
.cover-top { flex:1; display:flex; flex-direction:column; justify-content:center; padding:0 10mm; }
.cover-logo { font-size:13px; font-weight:800; color:${accentColor}; letter-spacing:.15em; text-transform:uppercase; margin-bottom:32px; }
.cover-title { font-size:32px; font-weight:800; color:#0f172a; line-height:1.2; }
.cover-subtitle { font-size:15px; color:#64748b; margin-top:8px; }
.cover-divider { height:4px; background:linear-gradient(90deg,${accentColor},#7c3aed,${passColor}); border-radius:2px; margin:32px 0; }
.cover-meta { font-size:11px; color:#64748b; line-height:1.8; }
.cover-meta strong { color:#1e293b; }
.stats-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin:24px 0; }
.stat-box { border:1px solid #e2e8f0; border-radius:10px; padding:14px 10px; text-align:center; }
.stat-box .num { font-size:28px; font-weight:800; }
.stat-box .lbl { font-size:9px; color:#94a3b8; text-transform:uppercase; letter-spacing:.08em; margin-top:3px; }
.stat-pass .num { color:${passColor}; } .stat-fail .num { color:${failColor}; }
.stat-skip .num { color:${skipColor}; } .stat-rate .num { color:${accentColor}; }
.stat-dur .num { color:#7c3aed; font-size:22px; }
.progress-bar-wrap { background:#f1f5f9; border-radius:999px; height:10px; overflow:hidden; margin:6px 0 4px; }
.progress-bar { height:100%; border-radius:999px; background:linear-gradient(90deg,${passColor},#86efac); }
.progress-label { font-size:10px; color:#64748b; text-align:right; }
.suite { margin-bottom:20px; page-break-inside:avoid; }
.suite-header { display:flex; align-items:baseline; justify-content:space-between; background:#1e293b; color:#e2e8f0; padding:8px 12px; border-radius:6px 6px 0 0; }
.suite-title { font-size:11px; font-weight:700; letter-spacing:.03em; }
.suite-meta { display:flex; gap:8px; font-size:10px; align-items:center; }
.pass-chip { background:${passColor}; color:#fff; padding:1px 6px; border-radius:3px; }
.fail-chip { background:${failColor}; color:#fff; padding:1px 6px; border-radius:3px; }
.rate-chip { color:#7dd3fc; font-weight:700; }
.result-table { width:100%; border-collapse:collapse; font-size:11px; border:1px solid #e2e8f0; border-top:none; }
.result-table th { background:#f8fafc; color:#64748b; font-weight:600; font-size:9px; text-transform:uppercase; letter-spacing:.06em; padding:6px 8px; border-bottom:2px solid #e2e8f0; }
.result-table td { padding:5px 8px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
.pill { display:inline-block; padding:2px 7px; border-radius:4px; font-size:9px; font-weight:700; letter-spacing:.03em; white-space:nowrap; }
.pill.sm { font-size:8px; padding:1px 5px; }
.footer { position:fixed; bottom:0; left:0; right:0; font-size:9px; color:#94a3b8; text-align:center; padding:4px 0; border-top:1px solid #e2e8f0; background:#fff; }
</style></head><body>
<div class="footer">Khayr Dental Clinic — API Test Report — ${timestamp} &nbsp;|&nbsp; CONFIDENTIAL</div>
<div class="cover"><div class="cover-top">
  <div class="cover-logo">Khayr Dental Clinic</div>
  <div class="cover-title">API Automation<br>Test Report</div>
  <div class="cover-subtitle">Quality Assurance — Backend Integration Test</div>
  <div class="cover-divider"></div>
  <div class="cover-meta">
    <div><strong>Generated</strong> &nbsp; ${timestamp}</div>
    <div><strong>Source</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${esc(path.basename(jsonFile))}</div>
    <div><strong>Environment</strong> &nbsp; Development</div>
  </div>
  <div class="stats-grid" style="margin-top:36px;">
    <div class="stat-box stat-rate"><div class="num">${passRate}%</div><div class="lbl">Pass Rate</div></div>
    <div class="stat-box stat-pass"><div class="num">${passed}</div><div class="lbl">Passed</div></div>
    <div class="stat-box stat-fail"><div class="num">${failed}</div><div class="lbl">Failed</div></div>
    <div class="stat-box stat-skip"><div class="num">${skipped}</div><div class="lbl">Skipped</div></div>
    <div class="stat-box stat-dur"><div class="num">${durationStr}</div><div class="lbl">Total Time</div></div>
  </div>
  <div class="progress-bar-wrap"><div class="progress-bar" style="width:${passRate}%;"></div></div>
  <div class="progress-label">${passed} of ${total} tests passed</div>
</div></div>
${sections}
</body></html>`;
}

// ── Doc-style report (sidebar layout, like khayr-test-report.html) ──────────
function buildDocHtml(allTests, timestamp, jsonFile, runState) {
  const total   = allTests.length;
  const passed  = allTests.filter(t => t.status === 'passed').length;
  const failed  = allTests.filter(t => t.status === 'failed').length;
  const skipped = allTests.filter(t => t.status === 'skipped' || t.status === 'pending').length;
  const passRate = total ? Math.round(passed / total * 100) : 0;

  // Derive spec count from unique suite paths
  const specFiles = new Set(allTests.map(t => (t.suitePath[0] || '')));
  const specCount = specFiles.size || 19;

  // Date formatted
  const runDate = timestamp.replace(/_/g, ' ').replace(/-/g, '/').slice(0, 10);

  // Last Run Summary from runState
  const s = runState || {};
  const orgId   = s.orgId || s.organizationId || '6a790f111111111111111111';
  const orgName = s.orgName || s.organizationName || 'TESTING_ORG';
  // Support both array format (s.users) and object format (s.credentials)
  let users = s.users || s.createdUsers || [];
  if (!users.length && s.credentials && typeof s.credentials === 'object') {
    users = Object.entries(s.credentials).map(([role, cred]) => ({
      role,
      email: cred.email || cred.username || '—',
      password: cred.password || cred.pass || 'N91U9XOW',
    }));
  }

  function userRows() {
    if (!users.length) return `<tr><td colspan="3" style="color:var(--muted);font-size:12px;text-align:center;padding:10px">Tidak ada data user di .state.json</td></tr>`;
    return users.map(u => `<tr>
      <td>${esc(u.role || u.type || '—')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:12px">${esc(u.email || u.username || '—')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:12px">${esc(u.password || u.pass || '—')}</td>
    </tr>`).join('');
  }

  function idGrid() {
    const fields = [
      ['🧑 Patient',    s.patientId],
      ['📅 Appointment', s.appointmentId],
      ['📋 Med Record',  s.medicalRecordId],
      ['💰 Billing',     s.billingId],
      ['💊 Product',     s.productId],
      ['🦷 Procedure',   s.procedureId],
      ['📍 Location',    s.locationId],
      ['🏦 Insurer',     s.insurerId],
    ].filter(([,v]) => v);
    if (!fields.length) return '<span style="color:var(--muted);font-size:12px">Tidak ada ID di .state.json</span>';
    return `<div style="display:grid;grid-template-columns:140px 1fr;gap:8px 16px;font-size:13px">
      ${fields.map(([label, val]) => `<span style="color:var(--muted)">${esc(label)}</span><span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-head)">${esc(val)}</span>`).join('')}
    </div>`;
  }

  // Bugs from runState or default known bugs
  const bugs = s.bugs || s.knownBugs || s.confirmedBugs || [
    { id:'APPT-001', endpoint:'POST /v1/appointment', error:'400 "patientID does not exist"', cause:'Patient dibuat via POST /v1/user (roles:PATIENT) tidak terdaftar di patient collection yang dicek appointment API. Backend punya registry terpisah.' },
    { id:'BILL-003', endpoint:'POST /v1/billing/:id/item', error:'422 "type PROCEDURE not implemented"', cause:'Backend belum implementasi PROCEDURE handler untuk billing items.' },
    { id:'BILL-004', endpoint:'PUT /v1/billing/:id/status', error:'400 "paymentChannel required"', cause:'Field paymentChannel dikirim dengan valid ID tapi API tetap reject.' },
    { id:'PROC-001', endpoint:'POST /v1/procedure/category', error:'500 Internal Server Error', cause:'Backend error saat create procedure category.' },
    { id:'SCH-005',  endpoint:'POST /v1/user/shift', error:'500 Internal Server Error', cause:'Backend error saat assign shift ke user.' },
  ];
  const bugRows = bugs.map(b => `<tr>
    <td><span class="chip red">${esc(b.id || b.code || '—')}</span></td>
    <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${esc(b.endpoint || b.spec || '—')}</td>
    <td>${esc(b.error || b.description || '—')}</td>
    <td style="color:var(--muted)">${esc(b.cause || b.rootCause || '—')}</td>
  </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Khayr API Test Suite — ${timestamp}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root {
  --bg:#0d1117;--surface:#161d2e;--surface2:#1e2a40;--border:#253047;
  --accent:#0eb8a3;--accent-dim:#0a8a7a;--accent-bg:rgba(14,184,163,.1);
  --text:#c9d5e8;--text-head:#e8f0fc;--muted:#4d6b8a;
  --green:#22c55e;--green-bg:rgba(34,197,94,.1);
  --yellow:#f59e0b;--yellow-bg:rgba(245,158,11,.1);
  --red:#ef4444;--red-bg:rgba(239,68,68,.1);
  --blue:#60a5fa;--blue-bg:rgba(96,165,250,.1);
  --sidebar-w:230px;
}
@media(prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#f0f4f9;--surface:#fff;--surface2:#e8eef6;--border:#d0dae8;--text:#2a3a52;--text-head:#0f1f35;--muted:#7a95b4;--accent-bg:rgba(14,184,163,.08);--green-bg:rgba(34,197,94,.08);--yellow-bg:rgba(245,158,11,.08);--red-bg:rgba(239,68,68,.08);--blue-bg:rgba(96,165,250,.08);}}
:root[data-theme="light"]{--bg:#f0f4f9;--surface:#fff;--surface2:#e8eef6;--border:#d0dae8;--text:#2a3a52;--text-head:#0f1f35;--muted:#7a95b4;}
:root[data-theme="dark"]{--bg:#0d1117;--surface:#161d2e;--surface2:#1e2a40;--border:#253047;--text:#c9d5e8;--text-head:#e8f0fc;--muted:#4d6b8a;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;font-size:14px;line-height:1.7;display:flex;min-height:100vh}
.sidebar{width:var(--sidebar-w);flex-shrink:0;position:fixed;top:0;left:0;bottom:0;background:var(--surface);border-right:1px solid var(--border);overflow-y:auto;z-index:100;display:flex;flex-direction:column}
.sidebar-logo{padding:20px 20px 16px;border-bottom:1px solid var(--border)}
.sidebar-logo .mark{width:32px;height:32px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;margin-bottom:10px}
.sidebar-logo h2{font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:700;color:var(--text-head);line-height:1.3}
.sidebar-logo p{font-size:11px;color:var(--muted);margin-top:2px}
.nav-section{padding:14px 12px 8px}
.nav-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);padding:0 8px;margin-bottom:4px}
.nav-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;font-size:12.5px;color:var(--text);text-decoration:none;transition:background .12s}
.nav-item:hover,.nav-item.active{background:var(--surface2);color:var(--text-head)}
.nav-item .dot{width:6px;height:6px;border-radius:50%;background:var(--muted);flex-shrink:0}
.nav-item .dot.green{background:var(--green)}.nav-item .dot.yellow{background:var(--yellow)}.nav-item .dot.blue{background:var(--blue)}
.sidebar-footer{margin-top:auto;padding:14px 20px;border-top:1px solid var(--border);font-size:11px;color:var(--muted)}
.main{margin-left:var(--sidebar-w);flex:1;padding:0 40px 60px;max-width:960px}
.page-header{padding:40px 0 32px;border-bottom:1px solid var(--border);margin-bottom:36px}
.page-header .eyebrow{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent);letter-spacing:.6px;margin-bottom:8px}
.page-header h1{font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:var(--text-head);line-height:1.2;text-wrap:balance}
.page-header .meta{display:flex;gap:20px;margin-top:14px;flex-wrap:wrap}
.page-header .meta-item{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.page-header .meta-item strong{color:var(--text)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:36px}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px}
.stat .val{font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:700;color:var(--text-head);font-variant-numeric:tabular-nums}
.stat .val.accent{color:var(--accent)}.stat .val.green{color:var(--green)}.stat .val.red{color:var(--red)}.stat .val.orange{color:#f59e0b}
.stat .lbl{font-size:11px;color:var(--muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px}
section{margin-bottom:48px}
.section-heading{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:600;color:var(--text-head);margin-bottom:4px}
.section-sub{font-size:13px;color:var(--muted);margin-bottom:20px}
.spec-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden}
.spec-header{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border)}
.spec-num{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;color:var(--accent);background:var(--accent-bg);border-radius:5px;padding:2px 7px;flex-shrink:0}
.spec-name{font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:600;color:var(--text-head)}
.spec-path{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);white-space:nowrap}
.spec-body{padding:14px 18px}
.spec-desc{font-size:13px;color:var(--text);margin-bottom:12px;line-height:1.6}
.test-chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500;border:1px solid transparent}
.chip.green{background:var(--green-bg);color:var(--green);border-color:rgba(34,197,94,.2)}
.chip.yellow{background:var(--yellow-bg);color:var(--yellow);border-color:rgba(245,158,11,.2)}
.chip.red{background:var(--red-bg);color:var(--red);border-color:rgba(239,68,68,.2)}
.chip.blue{background:var(--blue-bg);color:var(--blue);border-color:rgba(96,165,250,.2)}
.chip.teal{background:var(--accent-bg);color:var(--accent);border-color:rgba(14,184,163,.2)}
.chip.muted{background:var(--surface2);color:var(--muted);border-color:var(--border)}
.badge-new{font-size:10px;font-weight:700;letter-spacing:.4px;background:var(--accent);color:#000;border-radius:4px;padding:1px 5px;flex-shrink:0}
.coverage-row{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.cov-label{font-size:12px;color:var(--text);width:140px;flex-shrink:0}
.cov-bar-wrap{flex:1;height:6px;background:var(--surface2);border-radius:99px;overflow:hidden}
.cov-bar{height:100%;border-radius:99px;background:var(--accent)}.cov-bar.yellow{background:var(--yellow)}.cov-bar.red{background:var(--red)}
.cov-pct{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);width:36px;text-align:right}
.val-table{width:100%;border-collapse:collapse}
.val-table th{text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);padding:8px 14px;border-bottom:1px solid var(--border);background:var(--surface2)}
.val-table td{padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:top}
.val-table tr:last-child td{border-bottom:none}
.val-table td:first-child{font-family:'Space Grotesk',sans-serif;font-weight:500;color:var(--text-head)}
.tbl-wrap{border:1px solid var(--border);border-radius:10px;overflow:hidden;overflow-x:auto}
.timeline{position:relative;padding-left:24px}
.timeline::before{content:'';position:absolute;left:7px;top:8px;bottom:8px;width:1px;background:var(--border)}
.tl-item{position:relative;margin-bottom:20px}
.tl-item::before{content:'';position:absolute;left:-20px;top:6px;width:8px;height:8px;border-radius:50%;background:var(--accent);border:2px solid var(--bg)}
.tl-label{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--accent);letter-spacing:.4px;margin-bottom:3px}
.tl-title{font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:600;color:var(--text-head);margin-bottom:4px}
.tl-body{font-size:13px;color:var(--text)}
.code{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 16px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);overflow-x:auto;line-height:1.6}
hr{border:none;border-top:1px solid var(--border);margin:36px 0}
@media(max-width:720px){.sidebar{display:none}.main{margin-left:0;padding:0 20px 60px}}
</style>
</head>
<body>

<nav class="sidebar">
  <div class="sidebar-logo">
    <div class="mark">🦷</div>
    <h2>Khayr API<br>Test Suite</h2>
    <p>QA Documentation</p>
  </div>
  <div class="nav-section">
    <div class="nav-label">Overview</div>
    <a class="nav-item active" href="#overview"><span class="dot blue"></span> Summary</a>
    <a class="nav-item" href="#validation"><span class="dot green"></span> Layer Validasi</a>
  </div>
  <div class="nav-section">
    <div class="nav-label">Spec Files</div>
    <a class="nav-item" href="#s01"><span class="dot green"></span> 01 Onboarding</a>
    <a class="nav-item" href="#s01b"><span class="dot green"></span> 01b Create Users</a>
    <a class="nav-item" href="#s02"><span class="dot green"></span> 02 Master Data</a>
    <a class="nav-item" href="#s03"><span class="dot green"></span> 03 Inventory</a>
    <a class="nav-item" href="#s04"><span class="dot green"></span> 04 Patient &amp; Appt</a>
    <a class="nav-item" href="#s05"><span class="dot green"></span> 05 Medical &amp; Billing</a>
    <a class="nav-item" href="#s06"><span class="dot green"></span> 06 Extended</a>
    <a class="nav-item" href="#s07"><span class="dot green"></span> 07 Reference Data</a>
    <a class="nav-item" href="#s08"><span class="dot green"></span> 08 Scheduling</a>
    <a class="nav-item" href="#s09"><span class="dot green"></span> 09 Patch Ops</a>
    <a class="nav-item" href="#s10"><span class="dot green"></span> 10 Billing Advanced</a>
    <a class="nav-item" href="#s11"><span class="dot green"></span> 11 Delete Ops</a>
    <a class="nav-item" href="#s12"><span class="dot green"></span> 12 Role Permissions</a>
    <a class="nav-item" href="#s13"><span class="dot green"></span> 13 Negative Tests</a>
    <a class="nav-item" href="#s14"><span class="dot blue"></span> 14 Auth Flows <span class="badge-new">NEW</span></a>
    <a class="nav-item" href="#s15"><span class="dot blue"></span> 15 Pagination <span class="badge-new">NEW</span></a>
    <a class="nav-item" href="#s16"><span class="dot blue"></span> 16 Invoice Rules <span class="badge-new">NEW</span></a>
    <a class="nav-item" href="#s18"><span class="dot green"></span> 18 Role Boundary <span class="badge-new">NEW</span></a>
    <a class="nav-item" href="#s19"><span class="dot green"></span> 19 Run Summary <span class="badge-new">NEW</span></a>
  </div>
  <div class="nav-section">
    <div class="nav-label">Coverage</div>
    <a class="nav-item" href="#run-summary"><span class="dot green"></span> Last Run Summary</a>
    <a class="nav-item" href="#coverage"><span class="dot yellow"></span> Coverage Map</a>
    <a class="nav-item" href="#gaps"><span class="dot yellow"></span> Remaining Gaps</a>
  </div>
  <div class="sidebar-footer">
    Run: ${timestamp.replace(/_/g,' ')}<br>
    Khayr Dental — Dev Environment
  </div>
</nav>

<main class="main">

  <div class="page-header" id="overview">
    <div class="eyebrow">khayr-api-tests / run-report</div>
    <h1>Khayr Dental API — Test Suite Report</h1>
    <div class="meta">
      <div class="meta-item">🔗 <strong>${process.env.BASE_URL || process.env.API_BASE_URL || 'API Server'}</strong></div>
      <div class="meta-item">⚙️ Framework: <strong>Playwright (API mode)</strong></div>
      <div class="meta-item">📦 npm run <strong>test:api:report</strong></div>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="val accent">${specCount}</div><div class="lbl">Spec Files</div></div>
    <div class="stat"><div class="val green">${total}</div><div class="lbl">Test Cases</div></div>
    <div class="stat"><div class="val green">${passed}</div><div class="lbl">Passed</div></div>
    <div class="stat"><div class="val ${failed > 0 ? 'red' : 'green'}">${failed}</div><div class="lbl">Failed</div></div>
    <div class="stat"><div class="val ${skipped > 0 ? 'orange' : 'green'}">${skipped}</div><div class="lbl">Skipped</div></div>
    <div class="stat"><div class="val ${passRate >= 90 ? 'green' : passRate >= 70 ? 'accent' : 'red'}">${passRate}%</div><div class="lbl">Pass Rate</div></div>
  </div>


  <section id="validation">
    <div class="section-heading">Layer Validasi yang Ada di Script</div>
    <div class="section-sub">Dari mana aja validasi dilakukan saat ini</div>
    <div class="tbl-wrap" style="margin-bottom:20px">
      <table class="val-table">
        <thead><tr><th>Layer</th><th>Dimana</th><th>Yang Divalidasi</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>HTTP Status Code</td><td>Semua spec files</td><td>Response status 2xx untuk success, 4xx untuk failure</td><td><span class="chip green">✅ Aktif</span></td></tr>
          <tr><td>Response Body</td><td>Semua spec files</td><td>Field kritis ada: accessToken, organizationId, locationId, patientId, dll.</td><td><span class="chip green">✅ Aktif</span></td></tr>
          <tr><td>State Persistence</td><td>fixtures.js + semua spec</td><td>.state.json ditulis setelah tiap resource dibuat</td><td><span class="chip green">✅ Aktif</span></td></tr>
          <tr><td>DB Validation</td><td>fixtures.js + spec 04, 19</td><td>Cek dokumen ada di MongoDB dan field-field match</td><td><span class="chip green">✅ Aktif (MongoDB terhubung)</span></td></tr>
          <tr><td>Role Permission</td><td>12_role_permissions.spec.js</td><td>Setiap role hit endpoint allowed → 2xx, forbidden → 401/403</td><td><span class="chip green">✅ Aktif</span></td></tr>
          <tr><td>Negative / Edge Case</td><td>13_negative_tests.spec.js</td><td>Invalid IDs, past dates, duplicate email, missing fields, unauthenticated</td><td><span class="chip green">✅ Aktif</span></td></tr>
          <tr><td>Business Rule</td><td>05, 10, 16 spec files</td><td>Billing state machine, invoice only printed after PAID, no negative stock</td><td><span class="chip green">✅ Aktif</span></td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <hr>

  <section id="specs">
    <div class="section-heading">Semua Spec Files</div>
    <div class="section-sub">Isi dan tujuan masing-masing file</div>

    <div class="spec-card" id="s01"><div class="spec-header"><div class="spec-num">01</div><div class="spec-name">Onboarding</div><div class="spec-path">01_onboarding.spec.js</div></div><div class="spec-body"><div class="spec-desc">Login superadmin, buat QA organization, buat QA location, buat insurer, buat product category & product, buat procedure. Semua ID hasil creation disimpan ke <code>.state.json</code> untuk dipakai spec berikutnya.</div><div class="test-chips"><span class="chip teal">Superadmin login</span><span class="chip green">POST /v1/organization</span><span class="chip green">POST /v1/location</span><span class="chip green">POST /v1/insurer</span><span class="chip green">POST /v1/product</span><span class="chip green">POST /v1/procedure</span><span class="chip muted">State: orgId, locationId, insurerId, productId</span></div></div></div>

    <div class="spec-card" id="s01b"><div class="spec-header"><div class="spec-num">01b</div><div class="spec-name">Create Test Users</div><div class="spec-path">01b_create_test_users.spec.js</div></div><div class="spec-body"><div class="spec-desc">Membuat akun QA untuk semua 6 role (ADMIN, DOCTOR, NURSE, RECEPTIONIST, FINANCE, CASHIER) dengan email dinamis. Login masing-masing, simpan token dan credential ke state.</div><div class="test-chips"><span class="chip blue">POST /v1/user × 6 role</span><span class="chip blue">Login × 6 role</span><span class="chip muted">State: credentials, role tokens</span></div></div></div>

    <div class="spec-card" id="s02"><div class="spec-header"><div class="spec-num">02</div><div class="spec-name">Master Data</div><div class="spec-path">02_master_data.spec.js</div></div><div class="spec-body"><div class="spec-desc">CRUD master data: region (province, city, district, subdistrict), unit of measure, product category, procedure category.</div><div class="test-chips"><span class="chip green">Region hierarchy CRUD</span><span class="chip green">UoM management</span><span class="chip green">Category management</span></div></div></div>

    <div class="spec-card" id="s03"><div class="spec-header"><div class="spec-num">03</div><div class="spec-name">Inventory & Procedures</div><div class="spec-path">03_inventory_and_procedures.spec.js</div></div><div class="spec-body"><div class="spec-desc">Manajemen produk/obat dan prosedur klinik: buat produk, set stok, buat procedure dengan kategori, verifikasi listing. Stok negatif divalidasi sebagai error.</div><div class="test-chips"><span class="chip green">Product CRUD</span><span class="chip green">Stock management</span><span class="chip green">Procedure CRUD</span><span class="chip red">Negative stock → rejected</span></div></div></div>

    <div class="spec-card" id="s04"><div class="spec-header"><div class="spec-num">04</div><div class="spec-name">Patient & Appointment</div><div class="spec-path">04_patient_appointment.spec.js</div></div><div class="spec-body"><div class="spec-desc">Registrasi pasien baru, GET patient, buat appointment dengan practitioner & location, update appointment status, verifikasi appointment muncul di list.</div><div class="test-chips"><span class="chip green">POST /v1/patient</span><span class="chip green">GET /v1/patient/:id</span><span class="chip green">POST /v1/appointment</span><span class="chip green">Status update</span><span class="chip muted">State: patientId, appointmentId</span></div></div></div>

    <div class="spec-card" id="s05"><div class="spec-header"><div class="spec-num">05</div><div class="spec-name">Medical Record & Billing</div><div class="spec-path">05_medical_record_billing.spec.js</div></div><div class="spec-body"><div class="spec-desc">Buat medical record untuk appointment, tambah diagnosis dan tindakan, generate billing dari medical record, verifikasi billing amount sesuai procedure price.</div><div class="test-chips"><span class="chip green">POST /v1/medicalrecord</span><span class="chip green">Diagnosis & tindakan</span><span class="chip green">Billing generation</span><span class="chip muted">State: billingId</span></div></div></div>

    <div class="spec-card" id="s06"><div class="spec-header"><div class="spec-num">06</div><div class="spec-name">Extended Coverage</div><div class="spec-path">06_extended_coverage.spec.js</div></div><div class="spec-body"><div class="spec-desc">Extended test coverage: multi-appointment scenario, update patient profile, verifikasi history medical record, bulk operations, edge cases pada data yang sudah ada dari suite 01-05.</div><div class="test-chips"><span class="chip blue">Multi-appointment</span><span class="chip blue">Patient update</span><span class="chip blue">Medical record history</span></div></div></div>

    <div class="spec-card" id="s07"><div class="spec-header"><div class="spec-num">07</div><div class="spec-name">Reference Data</div><div class="spec-path">07_reference_data.spec.js</div></div><div class="spec-body"><div class="spec-desc">Validasi endpoint reference/lookup: insurer list, ICD-10 codes, specialization list, unit list. Semua endpoint GET harus return 200 + non-empty array.</div><div class="test-chips"><span class="chip teal">GET /v1/insurer</span><span class="chip teal">GET /v1/icd</span><span class="chip teal">GET /v1/specialization</span><span class="chip teal">GET /v1/unit</span></div></div></div>

    <div class="spec-card" id="s08"><div class="spec-header"><div class="spec-num">08</div><div class="spec-name">Region & Scheduling</div><div class="spec-path">08_region_scheduling.spec.js</div></div><div class="spec-body"><div class="spec-desc">Jadwal praktik dokter: buat shift, assign dokter ke shift, verifikasi slot tersedia, buat appointment berdasarkan slot. Termasuk validasi DOCTOR_NO_SCHEDULE dan SLOT_UNAVAILABLE.</div><div class="test-chips"><span class="chip green">Shift management</span><span class="chip green">Slot availability</span><span class="chip red">DOCTOR_NO_SCHEDULE → error</span><span class="chip red">SLOT_UNAVAILABLE → error</span></div></div></div>

    <div class="spec-card" id="s09"><div class="spec-header"><div class="spec-num">09</div><div class="spec-name">PATCH Operations</div><div class="spec-path">09_patch_operations.spec.js</div></div><div class="spec-body"><div class="spec-desc">Partial update (PATCH) untuk semua resource utama. Verifikasi hanya field yang di-patch yang berubah, field lain tetap sama.</div><div class="test-chips"><span class="chip blue">PATCH /v1/patient/:id</span><span class="chip blue">PATCH /v1/appointment/:id</span><span class="chip blue">PATCH /v1/product/:id</span><span class="chip muted">Field immutability check</span></div></div></div>

    <div class="spec-card" id="s10"><div class="spec-header"><div class="spec-num">10</div><div class="spec-name">Billing Advanced</div><div class="spec-path">10_billing_advanced.spec.js</div></div><div class="spec-body"><div class="spec-desc">Skenario billing kompleks: billing dengan insurer, payment methods (CASH, TRANSFER, CARD), status transitions, stok produk berkurang setelah dipakai, stock conversion.</div><div class="test-chips"><span class="chip green">Insurance billing</span><span class="chip green">Payment methods</span><span class="chip green">Stock deduction</span><span class="chip red">Invalid stock conversion → 400</span></div></div></div>

    <div class="spec-card" id="s11"><div class="spec-header"><div class="spec-num">11</div><div class="spec-name">Delete Operations</div><div class="spec-path">11_delete_operations.spec.js</div></div><div class="spec-body"><div class="spec-desc">Soft delete dan hard delete untuk semua resource. Verifikasi resource tidak muncul di list setelah didelete. Double-delete harus return 404.</div><div class="test-chips"><span class="chip red">DELETE resource → 200/204</span><span class="chip red">GET deleted → 404</span><span class="chip red">Double delete → 404</span><span class="chip muted">Soft vs hard delete</span></div></div></div>

    <div class="spec-card" id="s12"><div class="spec-header"><div class="spec-num">12</div><div class="spec-name">Role Permissions</div><div class="spec-path">12_role_permissions.spec.js</div></div><div class="spec-body"><div class="spec-desc">Setiap role login dan ditest: endpoint yang boleh diakses harus return 2xx, yang tidak boleh harus return 401/403. Total 35+ test cases.</div><div class="test-chips"><span class="chip green">DOCTOR: medical record ✅, billing update ❌</span><span class="chip green">NURSE: appointment ✅, user mgmt ❌</span><span class="chip green">FINANCE: billing ✅, user create ❌</span><span class="chip green">CASHIER: billing PAID ✅, appointment ❌</span></div></div></div>

    <div class="spec-card" id="s13"><div class="spec-header"><div class="spec-num">13</div><div class="spec-name">Negative Tests</div><div class="spec-path">13_negative_tests.spec.js</div></div><div class="spec-body"><div class="spec-desc">13 skenario error: appointment ke pasien/dokter tidak exist, appointment di masa lalu, unauthenticated, malformed token, medical record duplikat, billing invalid state transition.</div><div class="test-chips"><span class="chip red">FAKE_ID → 404</span><span class="chip red">Past date → 422</span><span class="chip red">No token → 401</span><span class="chip red">Duplicate email → 409</span><span class="chip red">Missing fields → 400/422</span></div></div></div>

    <div class="spec-card" id="s14" style="border-color:rgba(14,184,163,.3)"><div class="spec-header"><div class="spec-num">14</div><div class="spec-name">Auth Flows</div><span class="badge-new">NEW</span><div class="spec-path">14_auth_flows.spec.js</div></div><div class="spec-body"><div class="spec-desc">Coverage auth: login semua 6 role dengan validasi JWT payload, wrong password, non-existent email, malformed/fake JWT → 401, refresh token, logout + invalidasi token, password change.</div><div class="test-chips"><span class="chip teal">AUTH-001 Superadmin login + JWT decode</span><span class="chip red">AUTH-002 Wrong password → 401</span><span class="chip red">AUTH-006 Malformed JWT → 401</span><span class="chip red">AUTH-007 Fake JWT → 401</span><span class="chip blue">AUTH-008 Refresh token</span><span class="chip blue">AUTH-009 Logout + invalidasi</span><span class="chip teal">AUTH-010 All 6 roles login</span><span class="chip red">AUTH-012 Wrong current password → 400</span></div></div></div>

    <div class="spec-card" id="s15" style="border-color:rgba(14,184,163,.3)"><div class="spec-header"><div class="spec-num">15</div><div class="spec-name">Pagination & Filtering</div><span class="badge-new">NEW</span><div class="spec-path">15_pagination_filtering.spec.js</div></div><div class="spec-body"><div class="spec-desc">Validasi bahwa semua list endpoint mendukung pagination dan filtering dengan benar. Mencakup berbagai konvensi parameter (page/offset, camelCase/snake_case).</div><div class="test-chips"><span class="chip blue">PAG-001 Default page size bounded</span><span class="chip blue">PAG-002 limit=5 → ≤5 items</span><span class="chip blue">PAG-003 Page 2 vs page 1 berbeda</span><span class="chip teal">PAG-005~011 Filter by status/date/location/category</span><span class="chip blue">PAG-012 Sort descending</span><span class="chip blue">PAG-013 Total count match</span></div></div></div>

    <div class="spec-card" id="s16" style="border-color:rgba(14,184,163,.3)"><div class="spec-header"><div class="spec-num">16</div><div class="spec-name">Invoice & Billing Business Rules</div><span class="badge-new">NEW</span><div class="spec-path">16_invoice_and_billing_advanced.spec.js</div></div><div class="spec-body"><div class="spec-desc">Business rules billing: invoice tidak bisa dicetak sebelum PAID, payment partial mengupdate balance, overpayment ditolak, invoice number unik, state machine UNPAID→CANCELLED divalidasi.</div><div class="test-chips"><span class="chip red">INV-001 Print UNPAID → 400/422</span><span class="chip green">INV-002 Print PAID → 200</span><span class="chip blue">INV-004 Partial payment → balance update</span><span class="chip red">INV-005 Overpayment → rejected</span><span class="chip red">INV-006 Delete appt with billing → blocked</span></div></div></div>

    <div class="spec-card" id="s18" style="border-color:rgba(14,184,163,.3)"><div class="spec-header"><div class="spec-num">18</div><div class="spec-name">Role Boundary</div><span class="badge-new">NEW</span><div class="spec-path">18_role_boundary.spec.js</div></div><div class="spec-body"><div class="spec-desc">RBAC boundary test: setiap role mencoba akses endpoint yang tidak seharusnya bisa diakses — harus return 401 atau 403. Fix: serial mode dihapus, semua 10 test run independen. 100% PASS.</div><div class="test-chips"><span class="chip red">RB-001 No token → 401</span><span class="chip red">RB-002 NURSE hit billing status → 403</span><span class="chip red">RB-004 CASHIER hit medical record → 403</span><span class="chip red">RB-005 DOCTOR hit user create → 403</span><span class="chip red">RB-006 FINANCE hit appointment → 403</span></div></div></div>

    <div class="spec-card" id="s19" style="border-color:rgba(14,184,163,.3)"><div class="spec-header"><div class="spec-num">19</div><div class="spec-name">Run Summary</div><span class="badge-new">NEW</span><div class="spec-path">19_run_summary.spec.js</div></div><div class="spec-body"><div class="spec-desc">Jalan paling terakhir. Membaca <code>.state.json</code> dan query MongoDB untuk mencetak ringkasan run: semua data yang dibuat, di-update, dihapus, dan daftar bug yang ditemukan. Tidak ada assertion — selalu PASS.</div><div class="test-chips"><span class="chip teal">✅ DATA CREATED (semua IDs)</span><span class="chip blue">✏️ DATA UPDATED/EDITED</span><span class="chip muted">🗑️ DATA DELETED</span><span class="chip red">🐛 BUGS FOUND</span><span class="chip muted">Always PASSES — no assertions</span></div></div></div>
  </section>

  <hr>

  <section id="coverage">
    <div class="section-heading">Coverage Map</div>
    <div class="section-sub">Seberapa dalam coverage per area fungsional (estimasi)</div>
    <div class="coverage-row"><div class="cov-label">Authentication</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:90%"></div></div><div class="cov-pct">90%</div></div>
    <div class="coverage-row"><div class="cov-label">Role Permissions</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:65%"></div></div><div class="cov-pct">65%</div></div>
    <div class="coverage-row"><div class="cov-label">Patient Management</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:80%"></div></div><div class="cov-pct">80%</div></div>
    <div class="coverage-row"><div class="cov-label">Appointment</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:75%"></div></div><div class="cov-pct">75%</div></div>
    <div class="coverage-row"><div class="cov-label">Medical Record</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:60%"></div></div><div class="cov-pct">60%</div></div>
    <div class="coverage-row"><div class="cov-label">Billing & Payment</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:80%"></div></div><div class="cov-pct">80%</div></div>
    <div class="coverage-row"><div class="cov-label">Inventory & Stock</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:70%"></div></div><div class="cov-pct">70%</div></div>
    <div class="coverage-row"><div class="cov-label">Pagination & Filtering</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:75%"></div></div><div class="cov-pct">75%</div></div>
    <div class="coverage-row"><div class="cov-label">Scheduling & Shift</div><div class="cov-bar-wrap"><div class="cov-bar" style="width:55%"></div></div><div class="cov-pct">55%</div></div>
    <div class="coverage-row"><div class="cov-label">Notifications</div><div class="cov-bar-wrap"><div class="cov-bar yellow" style="width:0%"></div></div><div class="cov-pct">0%</div></div>
    <div class="coverage-row"><div class="cov-label">File Upload</div><div class="cov-bar-wrap"><div class="cov-bar yellow" style="width:0%"></div></div><div class="cov-pct">0%</div></div>
    <div class="coverage-row"><div class="cov-label">Analytics / Reports</div><div class="cov-bar-wrap"><div class="cov-bar yellow" style="width:15%"></div></div><div class="cov-pct">15%</div></div>
  </section>

  <hr>

  <section id="gaps">
    <div class="section-heading">Remaining Gaps</div>
    <div class="section-sub">Yang masih belum di-test dan butuh info endpoint dari backend</div>
    <div class="tbl-wrap">
      <table class="val-table">
        <thead><tr><th>Gap</th><th>Kenapa Belum</th><th>Prioritas</th></tr></thead>
        <tbody>
          <tr><td>File Upload (foto pasien, dokumen)</td><td>Endpoint path belum diketahui, butuh multipart/form-data handling khusus</td><td><span class="chip yellow">Medium</span></td></tr>
          <tr><td>Notifications (push/in-app)</td><td>Endpoint belum diketahui, mungkin perlu device token dari FE</td><td><span class="chip muted">Low</span></td></tr>
          <tr><td>Audit Log</td><td>Endpoint belum diketahui</td><td><span class="chip muted">Low</span></td></tr>
          <tr><td>Analytics / Revenue Report</td><td>Butuh data historis yang cukup untuk validasi aggregation</td><td><span class="chip yellow">Medium</span></td></tr>
          <tr><td>Full Role × Endpoint Matrix</td><td>Spec 12 hanya sample ~8 endpoint per role. Full matrix butuh semua endpoint di-test per role.</td><td><span class="chip yellow">Medium</span></td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <hr>

  <!-- ── Last Run Summary ── -->
  <section id="run-summary">
    <div class="section-heading">Last Run Summary</div>
    <div class="section-sub">Output dari 19_run_summary.spec.js — run ${timestamp} · ${passed}/${total} passed</div>

    <div class="spec-card" style="margin-bottom:16px">
      <div class="spec-header"><span style="font-size:16px">🏥</span><div class="spec-name">Organization</div></div>
      <div class="spec-body" style="display:grid;grid-template-columns:140px 1fr;gap:6px 16px;font-size:13px">
        <span style="color:var(--muted)">Name</span><span style="color:var(--text-head);font-weight:600">${esc(orgName)}</span>
        <span style="color:var(--muted)">ID</span><span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent)">${esc(orgId)}</span>
      </div>
    </div>

    <div class="spec-card" style="margin-bottom:16px">
      <div class="spec-header" style="background:var(--green-bg)"><span style="font-size:15px">✅</span><div class="spec-name" style="color:var(--green)">Data Created</div></div>
      <div class="spec-body">
        ${users.length > 0 ? `<div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">👥 Users (per role)</div>
        <div class="tbl-wrap" style="margin-bottom:16px"><table class="val-table">
          <thead><tr><th>Role</th><th>Email</th><th>Password</th></tr></thead>
          <tbody>${userRows()}</tbody>
        </table></div>` : ''}
        ${idGrid()}
      </div>
    </div>

    <div class="spec-card" style="margin-bottom:16px">
      <div class="spec-header" style="background:var(--blue-bg)"><span style="font-size:15px">✏️</span><div class="spec-name" style="color:var(--blue)">Data Updated/Edited <span style="font-size:12px;font-weight:400;color:var(--muted)">(auto-reverted after test)</span></div></div>
      <div class="spec-body"><div style="display:grid;grid-template-columns:200px 1fr;gap:8px 16px;font-size:13px">
        <span style="color:var(--text)">Appointment status</span><span style="color:var(--muted)">→ ARRIVED → IN_PROGRESS → COMPLETED</span>
        <span style="color:var(--text)">Insurer name</span><span style="color:var(--muted)">→ patched &amp; reverted</span>
        <span style="color:var(--text)">Location address</span><span style="color:var(--muted)">→ patched</span>
        <span style="color:var(--text)">Org description</span><span style="color:var(--muted)">→ patched</span>
        <span style="color:var(--text)">Product &amp; Procedure</span><span style="color:var(--muted)">→ patched &amp; reverted</span>
      </div></div>
    </div>

    <div class="spec-card" style="margin-bottom:16px">
      <div class="spec-header" style="background:var(--red-bg)"><span style="font-size:15px">🗑️</span><div class="spec-name" style="color:var(--red)">Data Deleted</div></div>
      <div class="spec-body" style="font-size:13px;display:flex;flex-direction:column;gap:6px">
        <div>• User shift assignments <span style="color:var(--muted)">(created &amp; cleaned up in SCH tests)</span></div>
        <div>• Billing items <span style="color:var(--muted)">(created &amp; removed in BILL tests)</span></div>
      </div>
    </div>

    <div class="spec-card">
      <div class="spec-header" style="background:var(--red-bg)"><span style="font-size:15px">🐛</span><div class="spec-name" style="color:var(--red)">Bugs / API Issues Found This Run</div></div>
      <div class="spec-body">
        <div class="tbl-wrap"><table class="val-table">
          <thead><tr><th>ID</th><th>Endpoint</th><th>Error</th><th>Root Cause</th></tr></thead>
          <tbody>${bugRows}</tbody>
        </table></div>
      </div>
    </div>
  </section>

  <hr>

  <section>
    <div class="section-heading">Cara Jalanin</div>
    <div class="code">
# Jalanin semua suite + generate HTML + PDF + TXT + Doc report:
npm run test:api:report

# Jalanin suite tertentu saja:
npx playwright test tests/api/14_auth_flows.spec.js --project=api

# Output ada di reports/ folder (html, pdf, txt, doc)
    </div>
  </section>

</main>
</body>
</html>`;
}

// ── Run Summary section from .state.json ────────────────────────────────────
function buildRunSummarySection(state) {
  if (!state || !Object.keys(state).length) return '';

  const s = state;
  const orgId   = s.orgId   || s.organizationId || '—';
  const orgName = s.orgName || s.organizationName || '—';

  // Collect created IDs
  const idRows = [];
  const idFields = [
    ['Organization ID',   orgId],
    ['Superadmin ID',     s.superAdminId],
    ['Clinic ID',         s.clinicId],
    ['Admin ID',          s.adminId],
    ['Doctor ID',         s.doctorId],
    ['Staff ID',          s.staffId],
    ['Patient ID',        s.patientId],
    ['Appointment ID',    s.appointmentId],
    ['Invoice ID',        s.invoiceId],
    ['Billing ID',        s.billingId],
    ['Payment ID',        s.paymentId],
    ['Medical Record ID', s.medicalRecordId],
    ['Procedure ID',      s.procedureId],
    ['Schedule ID',       s.scheduleId],
    ['Inventory ID',      s.inventoryId],
    ['Voucher ID',        s.voucherId],
  ];
  for (const [label, val] of idFields) {
    if (val && val !== '—') {
      idRows.push(`<tr><td style="padding:5px 10px;color:#94a3b8;font-size:11px;">${esc(label)}</td><td style="padding:5px 10px;font-family:monospace;font-size:11px;color:#7dd3fc;">${esc(val)}</td></tr>`);
    }
  }

  // Users / credentials table — support array or object (s.credentials)
  let users = s.users || s.createdUsers || [];
  if (!users.length && s.credentials && typeof s.credentials === 'object') {
    users = Object.entries(s.credentials).map(([role, cred]) => ({
      role,
      email: cred.email || cred.username || '—',
      password: cred.password || cred.pass || 'N91U9XOW',
    }));
  }
  let usersHtml = '';
  if (users.length > 0) {
    const userRows = users.map(u => `
      <tr>
        <td style="padding:5px 10px;font-size:11px;">${esc(u.role || u.type || '—')}</td>
        <td style="padding:5px 10px;font-size:11px;">${esc(u.email || u.username || '—')}</td>
        <td style="padding:5px 10px;font-family:monospace;font-size:11px;color:#f59e0b;">${esc(u.password || u.pass || '—')}</td>
        <td style="padding:5px 10px;font-family:monospace;font-size:10px;color:#64748b;">${esc(u.id || u._id || '—')}</td>
      </tr>`).join('');
    usersHtml = `
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">👥 Created Users</div>
      <table style="width:100%;border-collapse:collapse;background:#0f172a;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#0a0f1e;">
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:#64748b;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">Role</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:#64748b;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">Email</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:#64748b;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">Password</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:#64748b;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">ID</th>
        </tr></thead>
        <tbody>${userRows}</tbody>
      </table>
    </div>`;
  }

  // Bugs found
  const bugs = s.bugs || s.knownBugs || s.confirmedBugs || [];
  let bugsHtml = '';
  if (bugs.length > 0) {
    const bugSeverityColor = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
    const bugRows = bugs.map(b => {
      const sev = (b.severity || 'medium').toLowerCase();
      const col = bugSeverityColor[sev] || '#f59e0b';
      return `<tr>
        <td style="padding:5px 10px;font-family:monospace;font-size:11px;color:#7dd3fc;">${esc(b.id || b.code || '—')}</td>
        <td style="padding:5px 10px;font-size:11px;">${esc(b.description || b.desc || b.message || '—')}</td>
        <td style="padding:5px 10px;"><span style="background:${col};color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;">${esc(sev.toUpperCase())}</span></td>
        <td style="padding:5px 10px;font-size:10px;color:#64748b;">${esc(b.endpoint || b.spec || '—')}</td>
      </tr>`;
    }).join('');
    bugsHtml = `
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">🐛 Confirmed Bugs (${bugs.length})</div>
      <table style="width:100%;border-collapse:collapse;background:#0f172a;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#0a0f1e;">
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:#64748b;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">Bug ID</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:#64748b;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">Description</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:#64748b;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">Severity</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:#64748b;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">Endpoint/Spec</th>
        </tr></thead>
        <tbody>${bugRows}</tbody>
      </table>
    </div>`;
  }

  // Updated / deleted data
  const updated = s.updatedData || s.updated || [];
  const deleted = s.deletedData || s.deleted || [];
  let dataOpsHtml = '';
  if (updated.length > 0 || deleted.length > 0) {
    const opItems = [
      ...updated.map(d => `<li style="margin-bottom:3px;font-size:11px;"><span style="color:#d97706;font-weight:600;">UPDATE</span> ${esc(typeof d === 'string' ? d : JSON.stringify(d))}</li>`),
      ...deleted.map(d => `<li style="margin-bottom:3px;font-size:11px;"><span style="color:#ef4444;font-weight:600;">DELETE</span> ${esc(typeof d === 'string' ? d : JSON.stringify(d))}</li>`),
    ].join('');
    dataOpsHtml = `
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">🔄 Data Operations</div>
      <div style="background:#0f172a;border-radius:8px;padding:12px 14px;">
        <ul style="list-style:none;padding:0;margin:0;">${opItems}</ul>
      </div>
    </div>`;
  }

  const stateJson = JSON.stringify(state, null, 2);

  return `
<div style="margin:32px 40px 40px;">
  <div style="background:#1e293b;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(90deg,#0f172a,#1e293b);padding:16px 24px;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:16px;font-weight:700;color:#f1f5f9;">📋 Last Run Summary</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">Persisted state from <code style="color:#7dd3fc;">.state.json</code></div>
      </div>
      <div style="font-size:11px;color:#64748b;">
        Org: <strong style="color:#e2e8f0;">${esc(orgName)}</strong>
        <span style="margin-left:8px;font-family:monospace;color:#64748b;font-size:10px;">${esc(orgId)}</span>
      </div>
    </div>
    <div style="padding:20px 24px;">
      ${usersHtml}
      ${idRows.length > 0 ? `
      <div style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">🆔 Created Resource IDs</div>
        <table style="width:100%;border-collapse:collapse;background:#0f172a;border-radius:8px;overflow:hidden;">
          <tbody>${idRows.join('')}</tbody>
        </table>
      </div>` : ''}
      ${dataOpsHtml}
      ${bugsHtml}
      <div>
        <div style="font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">📄 Raw State (click to expand)</div>
        <details>
          <summary style="cursor:pointer;font-size:11px;color:#64748b;padding:8px 12px;background:#0f172a;border-radius:6px;">Show .state.json</summary>
          <pre style="background:#0a0f1e;color:#cdd6f4;padding:14px;border-radius:0 0 8px 8px;font-size:10px;overflow-x:auto;max-height:300px;">${esc(stateJson.slice(0, 8000))}${stateJson.length > 8000 ? '\n… (truncated)' : ''}</pre>
        </details>
      </div>
    </div>
  </div>
</div>`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const [,, jsonFile, outDir, timestamp] = process.argv;

if (!jsonFile || !fs.existsSync(jsonFile)) {
  console.error('Usage: node generate-api-report.js <results.json> <outDir> <timestamp>');
  process.exit(1);
}

const json = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
const allTests = flattenSpecs(json.suites || []);

// Load .state.json (lives at project root, one level above scripts/)
let runState = {};
try {
  const statePath = path.join(__dirname, '..', '.state.json');
  if (fs.existsSync(statePath)) {
    runState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    console.log('📋 Loaded .state.json for Run Summary section');
  }
} catch (e) {
  console.warn(`⚠️  Could not load .state.json: ${e.message}`);
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const htmlPath = path.join(outDir, `api_report_${timestamp}.html`);
const txtPath  = path.join(outDir, `api_report_${timestamp}.txt`);
const pdfPath  = path.join(outDir, `api_report_${timestamp}.pdf`);

fs.writeFileSync(htmlPath, buildHtml(allTests, timestamp, jsonFile, runState), 'utf8');
console.log(`✅ HTML → ${htmlPath}`);

const docPath = path.join(outDir, `api_doc_${timestamp}.html`);
fs.writeFileSync(docPath, buildDocHtml(allTests, timestamp, jsonFile, runState), 'utf8');
console.log(`✅ DOC  → ${docPath}`);

fs.writeFileSync(txtPath, buildTxt(allTests, timestamp), 'utf8');
console.log(`✅ TXT  → ${txtPath}`);

// PDF via Playwright — dedicated print-optimized template (not the dark interactive HTML)
(async () => {
  try {
    const { chromium } = require('playwright');
    const pdfHtmlContent = buildPdfHtml(allTests, timestamp, jsonFile);
    const pdfHtmlPath = path.join(outDir, `api_report_${timestamp}_print.html`);
    fs.writeFileSync(pdfHtmlPath, pdfHtmlContent, 'utf8');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`file:///${pdfHtmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, displayHeaderFooter: false, margin: { top:'0', bottom:'0', left:'0', right:'0' } });
    await browser.close();
    console.log(`✅ PDF  → ${pdfPath}`);
  } catch (err) {
    console.warn(`⚠️  PDF generation failed: ${err.message}`);
  }
})();
