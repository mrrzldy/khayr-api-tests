/**
 * API Discovery Spec — Route-Aware Edition
 *
 * Visits every real frontend route from routes.tsx + makes interactions to
 * trigger API calls. Captures all discovered endpoints vs. ALREADY_COVERED list.
 *
 * Run:
 *   npx playwright test tests/ui/specs/00_api_discovery.spec.js --project=ui --reporter=list
 */
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const fs = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────
const APP = process.env.UI_BASE_URL || process.env.BASE_URL || 'https://internal.dev.khayr.id';

// Match any API call (both base URLs)
const API_PATTERN = /\/v1\//;
const STATIC_PATTERN = /\.(js|css|png|jpg|jpeg|gif|ico|woff|woff2|ttf|svg|map)(\?|$)/i;

const allRequestUrls   = new Set();
const discoveredEndpoints = new Map();

function normalise(url) {
  return url
    .replace(/.*\/v1/, '/v1')
    .replace(/\?.*$/, '')
    .replace(/\/[0-9a-f]{24}/gi, '/:id')
    .replace(/\/[0-9]{8,}/g, '/:id');
}

function interceptPage(page, role) {
  page.on('request', req => {
    const url    = req.url();
    const method = req.method();
    if (['OPTIONS', 'HEAD'].includes(method)) return;

    if (!STATIC_PATTERN.test(url)) allRequestUrls.add(`${method} ${url}`);

    if (!API_PATTERN.test(url)) return;
    const path = normalise(url);
    const key  = `${method} ${path}`;
    if (!discoveredEndpoints.has(key)) {
      discoveredEndpoints.set(key, { method, path, roles: [role] });
    } else {
      const e = discoveredEndpoints.get(key);
      if (!e.roles.includes(role)) e.roles.push(role);
    }
  });
}

async function tryClick(page, selector) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 })) {
      await el.click({ timeout: 3000 });
      await page.waitForTimeout(800);
    }
  } catch { /* skip */ }
}

async function tryFill(page, selector, value) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 })) {
      await el.fill(value);
      await el.press('Enter');
      await page.waitForTimeout(800);
    }
  } catch { /* skip */ }
}

async function visitAndInteract(page, path) {
  try {
    await page.goto(`${APP}/${path.replace(/^\//, '')}`, { timeout: 25000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(400);

    // Trigger search
    await tryFill(page, 'input[type="search"], input[placeholder*="Cari" i], input[name="search"], input[placeholder*="Search" i]', 'a');
    // Click filter / status buttons
    await tryClick(page, 'button:has-text("Filter"), button:has-text("Semua"), button:has-text("Aktif"), [data-filter]');
    // Date filters
    await tryClick(page, 'button:has-text("Hari"), button:has-text("Bulan"), button:has-text("Tahun")');
    // First table row (open detail → triggers GET /:id)
    await tryClick(page, 'table tbody tr:first-child td:first-child, tbody tr:first-child');
    // Action buttons
    await tryClick(page, 'table tbody tr:first-child button, tbody tr:first-child .btn-action');
    // Close modal
    await tryClick(page, 'button:has-text("Tutup"), button:has-text("Batal"), .modal .btn-close, [data-bs-dismiss="modal"]');
    // Scroll to lazy-load more
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => null);
    await page.waitForTimeout(500);
    // Pagination
    await tryClick(page, '.pagination .page-item:not(.active):not(.disabled) a, [aria-label="Next"]');
    // Tabs
    await tryClick(page, '.nav-tabs .nav-item:nth-child(2) a, .tab-list button:nth-child(2)');
    // Export/download
    await tryClick(page, 'button:has-text("Export"), button:has-text("Unduh"), button:has-text("Download")');

    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
  } catch { /* page not accessible for this role — skip */ }
}

// ── All real routes from routes.tsx ─────────────────────────────────────────
// List / index pages only (no :id or /create — those need real data IDs)
const PAGES = [
  '/dashboard',

  // Patient
  '/patient/reservation',
  '/patient/reservation/create',
  '/patient/list',
  '/patient/list/create',

  // Doctor
  '/doctor/consultation-treatment/list',

  // Timetable
  '/timetable',

  // Personel
  '/personel/data-personel/list',
  '/personel/schedule-personel/list',

  // Master Data
  '/master-data/procedure',
  '/master-data/procedure/add',
  '/master-data/product',
  '/master-data/product/create',
  '/master-data/product-category',
  '/master-data/product-category/create',
  '/master-data/insurer',
  '/master-data/insurer/create',
  '/master-data/location',
  '/master-data/location/add',
  '/master-data/room',
  '/master-data/room/create',

  // Inventory
  '/inventory',
  '/inventory/create',

  // Reports
  '/report/medical-records/list',

  // Payment
  '/payment/list',
];

const ROLES = ['superadmin', 'admin', 'dokter', 'perawat', 'resepsionis', 'finance', 'kasir'];

for (const role of ROLES) {
  test(`DISCOVERY: scan as [${role}]`, async ({ page }) => {
    test.setTimeout(360000); // 6 min
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
    'POST /v1/oauth/token',
    'GET /v1/location',    'POST /v1/location',    'GET /v1/location/:id',    'PATCH /v1/location/:id',   'DELETE /v1/location/:id',
    'GET /v1/insurer',     'POST /v1/insurer',     'GET /v1/insurer/:id',     'PATCH /v1/insurer/:id',    'DELETE /v1/insurer/:id',
    'GET /v1/product/category', 'POST /v1/product/category', 'GET /v1/product/category/:id', 'PATCH /v1/product/category/:id', 'DELETE /v1/product/category/:id',
    'GET /v1/product/unit',     'GET /v1/product/unit/:id',
    'GET /v1/product',     'POST /v1/product',     'GET /v1/product/:id',     'PATCH /v1/product/:id',    'DELETE /v1/product/:id',
    'POST /v1/product/:id/image', 'DELETE /v1/product/:id/image',
    'GET /v1/product/stock', 'POST /v1/product/stock', 'GET /v1/product/stock/:id',
    'POST /v1/product/stock/:id/adjustment', 'POST /v1/product/stock/:id/conversion',
    'GET /v1/product/stock/summary', 'GET /v1/product/stock/summary/:id',
    'GET /v1/product/stock/history',
    'GET /v1/procedure/category', 'POST /v1/procedure/category', 'GET /v1/procedure/category/:id', 'PATCH /v1/procedure/category/:id', 'DELETE /v1/procedure/category/:id',
    'GET /v1/procedure',   'POST /v1/procedure',   'GET /v1/procedure/:id',   'PATCH /v1/procedure/:id',  'DELETE /v1/procedure/:id',
    'GET /v1/procedure/reference',
    'GET /v1/role',        'GET /v1/role/:id',
    'GET /v1/user',        'POST /v1/user',        'GET /v1/user/:id',        'PATCH /v1/user/:id',
    'GET /v1/user/shift',  'POST /v1/user/shift',  'GET /v1/user/shift/:id',  'PUT /v1/user/shift/:id',   'DELETE /v1/user/shift/:id',
    'GET /v1/patient',     'POST /v1/patient',     'GET /v1/patient/:id',
    'GET /v1/appointment', 'POST /v1/appointment', 'GET /v1/appointment/:id', 'PATCH /v1/appointment/:id',
    'PUT /v1/appointment/:id/status', 'POST /v1/appointment/:id/follow-up',
    'GET /v1/shift/timeslot', 'GET /v1/shift/timeslot/:id',
    'GET /v1/timetable',
    'GET /v1/tooth/finding', 'GET /v1/tooth/finding/:id',
    'GET /v1/tooth/mobility/reference', 'GET /v1/tooth/nomenclature', 'GET /v1/tooth/nomenclature/:id',
    'GET /v1/tooth/periodontal/pocket/reference',
    'GET /v1/diagnose/reference', 'GET /v1/diagnose/reference/:id',
    'GET /v1/medicalhistory/reference', 'GET /v1/medicalhistory/reference/:id',
    'GET /v1/medicalrecord', 'POST /v1/medicalrecord', 'GET /v1/medicalrecord/:id',
    'GET /v1/billing',     'GET /v1/billing/:id',   'PUT /v1/billing/:id/status',   'PUT /v1/billing/:id/status/paid',
    'POST /v1/billing/:id/item', 'PUT /v1/billing/:id/item/:id', 'DELETE /v1/billing/:id/item/:id',
    'GET /v1/payment/channel', 'GET /v1/payment/channel/:id',
    'GET /v1/region/country', 'GET /v1/region/country/:id',
    'GET /v1/region/state',   'GET /v1/region/state/:id',
    'GET /v1/region/city',    'GET /v1/region/city/:id',
    'GET /v1/region/district','GET /v1/region/district/:id',
    'GET /v1/region/subdistrict', 'GET /v1/region/subdistrict/:id',
    'GET /v1/profile',
    'GET /v1/organization',   'POST /v1/organization',  'PATCH /v1/organization/:id',
  ]);

  const all  = Array.from(discoveredEndpoints.values()).sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  const gaps = all.filter(e => !ALREADY_COVERED.has(`${e.method} ${e.path}`));

  const report = {
    generated: new Date().toISOString(),
    baseURL: APP,
    totalDiscovered: all.length,
    alreadyCovered: all.length - gaps.length,
    totalGaps: gaps.length,
    gaps:         gaps.map(e => ({ key: `${e.method} ${e.path}`, ...e })),
    allEndpoints: all.map(e => ({ key: `${e.method} ${e.path}`, ...e, covered: ALREADY_COVERED.has(`${e.method} ${e.path}`) })),
  };

  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/api_discovery_report.json', JSON.stringify(report, null, 2));

  const debugUrls = Array.from(allRequestUrls).sort();
  fs.writeFileSync('reports/debug_all_requests.json', JSON.stringify({ generated: new Date().toISOString(), totalUniqueUrls: debugUrls.length, urls: debugUrls }, null, 2));

  console.log(`\n📊 Discovery report → reports/api_discovery_report.json`);
  console.log(`   Base URL         : ${APP}`);
  console.log(`   Total discovered : ${all.length}`);
  console.log(`   Already covered  : ${all.length - gaps.length}`);
  console.log(`   🔴 Gaps          : ${gaps.length}`);
  if (gaps.length) {
    console.log('\n🔴 GAP ENDPOINTS:');
    gaps.forEach(e => console.log(`   ${e.method.padEnd(7)}${e.path}  [${e.roles.join(', ')}]`));
  } else {
    console.log('\n✅ Semua endpoint sudah tercover!');
  }
});
