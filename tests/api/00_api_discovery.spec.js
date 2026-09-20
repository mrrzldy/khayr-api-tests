/**
 * API Discovery Spec v3 — Aggressive Capture
 *
 * Captures ALL non-static network requests (debug mode) + API endpoint discovery.
 * Fixes low-capture issue by:
 *   1. Forcing page reload on each visit (bypasses SPA cache)
 *   2. Capturing ALL request URLs to debug_all_requests.json
 *   3. Using more aggressive wait strategies
 *   4. Trying more interaction patterns per page
 *
 * Output:
 *   api_discovery_report.json    — gap analysis vs ALREADY_COVERED
 *   debug_all_requests.json      — every unique URL seen (for debugging)
 *
 * Run: npx playwright test tests/ui/specs/00_api_discovery.spec.js --project=ui --reporter=list
 */
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../ui/pages/LoginPage');
const fs = require('fs');

const APP = process.env.UI_BASE_URL || process.env.BASE_URL || 'https://internal.dev.khayr.id';
const API_PATTERN = /core\.dev\.khayr\.id/;

// Capture ALL non-static requests for debug
const STATIC_PATTERN = /\.(js|css|png|jpg|jpeg|gif|ico|woff|woff2|ttf|svg|map)(\?|$)/i;
const allRequestUrls = new Set();

const discoveredEndpoints = new Map();

function normalise(url) {
  return url
    .replace(/.*core\.dev\.khayr\.id/, '')
    .replace(/\?.*$/, '')
    .replace(/\/[0-9a-f]{24}/gi, '/:id')
    .replace(/\/[0-9]{8,}/g, '/:id');
}

function interceptPage(page, role) {
  page.on('request', req => {
    const url = req.url();
    const method = req.method();
    if (['OPTIONS', 'HEAD'].includes(method)) return;

    // Debug: capture all non-static URLs
    if (!STATIC_PATTERN.test(url)) {
      allRequestUrls.add(`${method} ${url}`);
    }

    // Discovery: capture API endpoints
    if (!API_PATTERN.test(url)) return;
    const path = normalise(url);
    const key = `${method} ${path}`;
    if (!discoveredEndpoints.has(key)) {
      discoveredEndpoints.set(key, { method, path, roles: [role] });
    } else {
      const e = discoveredEndpoints.get(key);
      if (!e.roles.includes(role)) e.roles.push(role);
    }
  });
}

/** Click safely — no throw if element missing */
async function tryClick(page, selector) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 })) {
      await el.click({ timeout: 3000 });
      await page.waitForTimeout(1000);
    }
  } catch { /* skip */ }
}

/** Fill input safely */
async function tryFill(page, selector, value) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 })) {
      await el.fill(value);
      await el.press('Enter');
      await page.waitForTimeout(1000);
    }
  } catch { /* skip */ }
}

/** Navigate to a page, force reload, and do common interactions to trigger API calls */
async function visitAndInteract(page, path) {
  try {
    // Navigate
    await page.goto(`${APP}${path}`, { timeout: 25000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(500);

    // 1. Trigger search
    await tryFill(page, 'input[type="search"], input[placeholder*="Cari" i], input[name="search"], input[placeholder*="Search" i]', 'a');
    // 2. Click filter / dropdown buttons
    await tryClick(page, 'button:has-text("Filter"), .btn-filter, [data-filter], button:has-text("Semua")');
    // 3. Click date filters
    await tryClick(page, 'button:has-text("Hari"), button:has-text("Bulan"), button:has-text("Tahun")');
    // 4. Click first table row or action button (to open detail / trigger GET by ID)
    await tryClick(page, 'table tbody tr:first-child td:first-child, tbody tr:first-child');
    // 5. Click first action button in table
    await tryClick(page, 'table tbody tr:first-child button, tbody tr:first-child .btn-action, tbody tr:first-child .dropdown-toggle');
    // 6. Close any modal that opened
    await tryClick(page, 'button:has-text("Tutup"), button:has-text("Batal"), .modal .btn-close, [data-bs-dismiss="modal"]');
    // 7. Scroll down to trigger lazy loads
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => null);
    await page.waitForTimeout(600);
    // 8. Click pagination if exists
    await tryClick(page, '.pagination .page-item:not(.active):not(.disabled) a, [aria-label="Next"]');
    // 9. Click any tabs on the page
    await tryClick(page, '.nav-tabs .nav-item:nth-child(2) a, .tab-list button:nth-child(2)');
    // 10. Click any select/dropdown to trigger option-load API
    await tryClick(page, 'select, .select2-container, .v-select, [class*="select"]');
    // 11. Try export/download buttons (often trigger report APIs)
    await tryClick(page, 'button:has-text("Export"), button:has-text("Download"), button:has-text("Unduh")');
    // 12. Click status filter chips
    await tryClick(page, '.badge, [class*="chip"], button:has-text("Aktif"), button:has-text("Menunggu")');

    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
  } catch {
    // Page not accessible for this role — skip
  }
}

// Pages to visit per role — updated to match actual frontend routes from routes.tsx
const PAGES = [
  '/dashboard',
  '/patient/reservation',
  '/patient/reservation/create',
  '/patient/list',
  // Doctor flows — real routes per routes.tsx
  '/doctor/consultation-treatment/list',
  '/report/medical-records/list',
  // Payment
  '/payment/list',
  // Personnel — real routes use /personel/ (not /personnel/)
  '/personel/data-personel/list',
  '/personel/schedule-personel/list',
  // Inventory
  '/inventory',
  // Master data — real routes use /master-data/ not /master/
  '/master-data/product',
  '/master-data/product-category',
  '/master-data/procedure',
  '/master-data/insurer',
  '/master-data/room',
  '/master-data/location',
  // Timetable
  '/timetable',
  // Quota
  '/quota/topup',
  '/quota/usage',
  // Finance
  '/finance/gl',
  '/finance/cash-flow',
  // Reports
  '/report/finance',
  '/report/performance',
  '/report/profile-360',
  // Superadmin
  '/admin/access-control',
  '/admin/pricing',
  '/admin/integration/payment-gateway',
  '/admin/tenant/performance',
  '/admin/tenant/clinic-groups',
  '/admin/tenant/clinic-membership',
  // Voucher
  '/voucher/create',
  '/voucher/history',
  '/voucher/settlement',
  // Membership
  '/membership/clinic-profile',
  '/membership/documents',
];

const ROLES = ['superadmin', 'admin', 'dokter', 'perawat', 'resepsionis', 'finance', 'kasir'];

for (const role of ROLES) {
  test(`DISCOVERY: interactive scan as [${role}]`, async ({ page }) => {
    test.setTimeout(300000); // 5 min — visiting 37 pages takes ~2 min per role
    interceptPage(page, role);

    const loginPage = new LoginPage(page);
    try {
      await loginPage.loginAs(role);
    } catch {
      console.warn(`[${role}] login failed — skipping`);
      return;
    }

    for (const pagePath of PAGES) {
      await visitAndInteract(page, pagePath);
    }

    console.log(`[${role}] ✓ done. Unique endpoints so far: ${discoveredEndpoints.size}`);
  });
}

// ── Generate report ─────────────────────────────────────────────────────────

test.afterAll(() => {
  const ALREADY_COVERED = new Set([
    // suite 01-05
    'POST /v1/oauth/token',
    'POST /v1/location',    'GET /v1/location',    'GET /v1/location/:id',
    'POST /v1/insurer',     'GET /v1/insurer',      'GET /v1/insurer/:id',
    'POST /v1/product/category', 'GET /v1/product/category',
    'POST /v1/product',     'GET /v1/product',
    'POST /v1/product/stock',
    'POST /v1/procedure/category', 'GET /v1/procedure/category',
    'POST /v1/procedure',   'GET /v1/procedure',
    'POST /v1/user',        'GET /v1/user',        'GET /v1/user/:id',
    'GET /v1/patient',      'GET /v1/patient/:id', 'POST /v1/patient',
    'POST /v1/appointment', 'GET /v1/appointment', 'GET /v1/appointment/:id',
    'POST /v1/medicalrecord','GET /v1/medicalrecord','GET /v1/medicalrecord/:id',
    'GET /v1/billing',      'GET /v1/billing/:id',  'PUT /v1/billing/:id/status',
    // suite 06
    'GET /v1/demography',   'GET /v1/organization/:id',
    'GET /v1/product/stock/summary', 'GET /v1/product/stock/summary/stats',
    'GET /v1/reports/customer-360', 'GET /v1/roles-access',
    'GET /v1/clinic/documents',
    // suite 07 — reference & master data
    'GET /v1/diagnose/reference',       'GET /v1/diagnose/reference/:id',
    'GET /v1/medicalhistory/reference', 'GET /v1/medicalhistory/reference/:id',
    'GET /v1/procedure/reference',
    'GET /v1/procedure/category/:id',   'GET /v1/procedure/:id',
    'GET /v1/product/category/:id',     'GET /v1/product/:id',
    'GET /v1/product/stock/history',    'GET /v1/product/stock/:id',
    'GET /v1/product/stock/summary/:id','GET /v1/product/unit', 'GET /v1/product/unit/:id',
    'GET /v1/tooth/finding',            'GET /v1/tooth/finding/:id',
    'GET /v1/tooth/mobility/reference', 'GET /v1/tooth/nomenclature',
    'GET /v1/tooth/nomenclature/:id',   'GET /v1/tooth/periodontal/pocket/reference',
    'GET /v1/payment/channel',          'GET /v1/payment/channel/:id',
    'GET /v1/profile',
    'GET /v1/role',                     'GET /v1/role/:id',
    'GET /v1/organization',
    // suite 08 — region & scheduling
    'GET /v1/region/country',           'GET /v1/region/country/:id',
    'GET /v1/region/state',             'GET /v1/region/state/:id',
    'GET /v1/region/city',              'GET /v1/region/city/:id',
    'GET /v1/region/district',          'GET /v1/region/district/:id',
    'GET /v1/region/subdistrict',       'GET /v1/region/subdistrict/:id',
    'GET /v1/shift/timeslot',           'GET /v1/shift/timeslot/:id',
    'GET /v1/timetable',
    'GET /v1/user/shift',               'GET /v1/user/shift/:id',
    'POST /v1/user/shift',              'PUT /v1/user/shift/:id',
    'DELETE /v1/user/shift/:id',
    // suite 09 — PATCH operations
    'PATCH /v1/appointment/:id',        'PATCH /v1/insurer/:id',
    'PATCH /v1/location/:id',           'PATCH /v1/organization/:id',
    'PATCH /v1/procedure/category/:id', 'PATCH /v1/procedure/:id',
    'PATCH /v1/product/category/:id',   'PATCH /v1/product/:id',
    'PATCH /v1/user/:id',
    'PUT /v1/appointment/:id/status',   'PUT /v1/billing/:id/status/paid',
    // suite 10 — advanced POST & billing items
    'POST /v1/billing/:id/item',        'PUT /v1/billing/:id/item/:id',
    'DELETE /v1/billing/:id/item/:id',
    'POST /v1/appointment/:id/follow-up',
    'POST /v1/product/stock/:id/adjustment', 'POST /v1/product/stock/:id/conversion',
    'POST /v1/product/:id/image',
    'POST /v1/organization',
    'POST /v1/scheduler/satusehat/medicalrecord',
    'POST /v1/scheduler/satusehat/patient-ihs-number',
    'POST /v1/scheduler/satusehat/practitioner-ihs-number',
    // suite 11 — DELETE operations
    'DELETE /v1/insurer/:id',           'DELETE /v1/location/:id',
    'DELETE /v1/procedure/category/:id','DELETE /v1/procedure/:id',
    'DELETE /v1/product/category/:id',  'DELETE /v1/product/:id',
    'DELETE /v1/product/:id/image',
  ]);

  const all = Array.from(discoveredEndpoints.values())
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  const gaps = all.filter(e => !ALREADY_COVERED.has(`${e.method} ${e.path}`));

  const report = {
    generated: new Date().toISOString(),
    totalDiscovered: all.length,
    alreadyCovered: all.length - gaps.length,
    totalGaps: gaps.length,
    gaps: gaps.map(e => ({ key: `${e.method} ${e.path}`, ...e })),
    allEndpoints: all.map(e => ({
      key: `${e.method} ${e.path}`, ...e,
      covered: ALREADY_COVERED.has(`${e.method} ${e.path}`),
    })),
  };

  fs.writeFileSync('api_discovery_report.json', JSON.stringify(report, null, 2));

  // Also write debug file: all unique URLs captured (to diagnose what the app actually calls)
  const debugUrls = Array.from(allRequestUrls).sort();
  fs.writeFileSync('debug_all_requests.json', JSON.stringify({
    generated: new Date().toISOString(),
    totalUniqueUrls: debugUrls.length,
    urls: debugUrls,
  }, null, 2));

  console.log(`\n📊 Discovery report → api_discovery_report.json`);
  console.log(`   Total discovered : ${all.length}`);
  console.log(`   Already covered  : ${all.length - gaps.length}`);
  console.log(`   🔴 Gaps          : ${gaps.length}`);
  console.log(`\n🔍 Debug file → debug_all_requests.json (${debugUrls.length} unique URLs)`);
  if (gaps.length) {
    console.log('\n🔴 GAP ENDPOINTS:');
    gaps.forEach(e => console.log(`   ${e.method.padEnd(7)}${e.path}  [${e.roles.join(', ')}]`));
  } else {
    console.log('\n✅ Semua endpoint sudah tercover!');
  }
});
