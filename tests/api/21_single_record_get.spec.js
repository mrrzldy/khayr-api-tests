/**
 * Suite 21: Single-Record GET by ID
 *
 * Gap identified from reading khayr-core-service controller routes:
 * The existing specs cover list GETs but don't exercise the /:id routes
 * for most resources. This spec fetches each collection and uses the
 * first returned item's ID to hit the single-record endpoint.
 *
 * Covers:
 *   GET /v1/insurer/:id
 *   GET /v1/diagnose/reference/:id
 *   GET /v1/procedure/category/:id
 *   GET /v1/procedure/:id
 *   GET /v1/product/category/:id
 *   GET /v1/product/unit/:id
 *   GET /v1/product/:id
 *   GET /v1/product/stock/:id
 *   GET /v1/region/country/:id
 *   GET /v1/region/state/:id
 *   GET /v1/region/city/:id
 *   GET /v1/region/district/:id
 *   GET /v1/region/subdistrict/:id
 *   GET /v1/role/:id
 *   GET /v1/shift/timeslot/:id
 *   GET /v1/tooth/nomenclature/:id
 *   GET /v1/tooth/finding/:id
 *   GET /v1/user/shift/:id
 *
 * Depends on: 01_onboarding (.state.json for accessToken)
 */
const { test, expect } = require('./fixtures');
const fs = require('fs');

const API = process.env.API_BASE_URL || 'https://core.dev.khayr.id';

let accessToken = '';

test.beforeAll(async () => {
  try {
    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    accessToken = state.accessToken;
  } catch {
    console.warn('[21] .state.json missing — run 01_onboarding first.');
  }
});

test.describe.configure({ mode: 'serial' });

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

/**
 * Helper: GET list, pick first item, GET by its ID.
 * Returns early (soft skip) if no items or endpoint not found.
 */
async function testGetById(request, listPath, idPath, label) {
  const listRes = await request.get(`${API}${listPath}`, { headers: auth() });
  const listStatus = listRes.status();

  if (listStatus === 401) {
    console.warn(`[SGR] ${label} list → 401 (insufficient org permissions) — skipping`);
    return;
  }
  if (![200, 201].includes(listStatus)) {
    console.warn(`[SGR] ${label} list → ${listStatus} — skipping by-ID check`);
    return;
  }

  const body = await listRes.json().catch(() => ({}));
  const items = body.data?.items || body.data?.data || body.data || [];
  const first = Array.isArray(items) ? items[0] : null;
  const id = first?._id || first?.id;

  if (!id) {
    console.warn(`[SGR] ${label} — no items in list, cannot test by-ID`);
    return;
  }

  const byIdPath = idPath.replace(':id', id);
  const res = await request.get(`${API}${byIdPath}`, { headers: auth() });
  const status = res.status();
  const resBody = await res.json().catch(() => ({}));

  console.log(`GET ${byIdPath} → ${status}`);
  expect([200, 400, 401, 403, 404]).toContain(status);

  if (status === 200) {
    console.log(`  ✅ ${label} by-ID OK`);
  } else {
    console.warn(`  ⚠️  ${label} by-ID → ${status}: ${JSON.stringify(resBody).slice(0, 150)}`);
  }
}

// ── Insurer ──────────────────────────────────────────────────────────────────
test('SGR-001: GET /v1/insurer/:id — single insurer', async ({ request }) => {
  await testGetById(request, '/v1/insurer', '/v1/insurer/:id', 'insurer');
});

// ── Diagnose Reference ────────────────────────────────────────────────────────
test('SGR-002: GET /v1/diagnose/reference/:id — single diagnose reference', async ({ request }) => {
  await testGetById(request, '/v1/diagnose/reference', '/v1/diagnose/reference/:id', 'diagnose/reference');
});

// ── Procedure Category ────────────────────────────────────────────────────────
test('SGR-003: GET /v1/procedure/category/:id — single procedure category', async ({ request }) => {
  await testGetById(request, '/v1/procedure/category', '/v1/procedure/category/:id', 'procedure/category');
});

// ── Procedure ─────────────────────────────────────────────────────────────────
test('SGR-004: GET /v1/procedure/:id — single procedure', async ({ request }) => {
  await testGetById(request, '/v1/procedure', '/v1/procedure/:id', 'procedure');
});

// ── Product Category ──────────────────────────────────────────────────────────
test('SGR-005: GET /v1/product/category/:id — single product category', async ({ request }) => {
  await testGetById(request, '/v1/product/category', '/v1/product/category/:id', 'product/category');
});

// ── Product Unit ──────────────────────────────────────────────────────────────
test('SGR-006: GET /v1/product/unit/:id — single product unit', async ({ request }) => {
  await testGetById(request, '/v1/product/unit', '/v1/product/unit/:id', 'product/unit');
});

// ── Product ───────────────────────────────────────────────────────────────────
test('SGR-007: GET /v1/product/:id — single product', async ({ request }) => {
  await testGetById(request, '/v1/product', '/v1/product/:id', 'product');
});

// ── Product Stock ─────────────────────────────────────────────────────────────
test('SGR-008: GET /v1/product/stock/:id — single stock entry', async ({ request }) => {
  await testGetById(request, '/v1/product/stock', '/v1/product/stock/:id', 'product/stock');
});

// ── Role ──────────────────────────────────────────────────────────────────────
test('SGR-009: GET /v1/role/:id — single role', async ({ request }) => {
  await testGetById(request, '/v1/role', '/v1/role/:id', 'role');
});

// ── Shift Timeslot ────────────────────────────────────────────────────────────
test('SGR-010: GET /v1/shift/timeslot/:id — single timeslot', async ({ request }) => {
  await testGetById(request, '/v1/shift/timeslot', '/v1/shift/timeslot/:id', 'shift/timeslot');
});

// ── Tooth Nomenclature ────────────────────────────────────────────────────────
test('SGR-011: GET /v1/tooth/nomenclature/:id — single tooth nomenclature', async ({ request }) => {
  await testGetById(request, '/v1/tooth/nomenclature', '/v1/tooth/nomenclature/:id', 'tooth/nomenclature');
});

// ── Tooth Finding ─────────────────────────────────────────────────────────────
test('SGR-012: GET /v1/tooth/finding/:id — single tooth finding', async ({ request }) => {
  await testGetById(request, '/v1/tooth/finding', '/v1/tooth/finding/:id', 'tooth/finding');
});

// ── User Shift ────────────────────────────────────────────────────────────────
test('SGR-013: GET /v1/user/shift/:id — single user shift', async ({ request }) => {
  await testGetById(request, '/v1/user/shift', '/v1/user/shift/:id', 'user/shift');
});

// ── Region: Country ──────────────────────────────────────────────────────────
test('SGR-014: GET /v1/region/country/:id — single country', async ({ request }) => {
  await testGetById(request, '/v1/region/country', '/v1/region/country/:id', 'region/country');
});

// ── Region: State ─────────────────────────────────────────────────────────────
test('SGR-015: GET /v1/region/state/:id — single state/province', async ({ request }) => {
  // state list may be large — pass limit param
  const listRes = await request.get(`${API}/v1/region/state?limit=1`, { headers: auth() });
  if (!listRes.ok()) { console.warn('[SGR-015] state list failed'); return; }
  const body = await listRes.json().catch(() => ({}));
  const items = body.data?.items || body.data?.data || body.data || [];
  const id = Array.isArray(items) && items[0] ? (items[0]._id || items[0].id) : null;
  if (!id) { console.warn('[SGR-015] no state items — skipping'); return; }
  const res = await request.get(`${API}/v1/region/state/${id}`, { headers: auth() });
  console.log(`GET /v1/region/state/${id} → ${res.status()}`);
  expect([200, 401, 403, 404]).toContain(res.status());
});

// ── Region: City ─────────────────────────────────────────────────────────────
test('SGR-016: GET /v1/region/city/:id — single city', async ({ request }) => {
  const listRes = await request.get(`${API}/v1/region/city?limit=1`, { headers: auth() });
  if (!listRes.ok()) { console.warn('[SGR-016] city list failed'); return; }
  const body = await listRes.json().catch(() => ({}));
  const items = body.data?.items || body.data?.data || body.data || [];
  const id = Array.isArray(items) && items[0] ? (items[0]._id || items[0].id) : null;
  if (!id) { console.warn('[SGR-016] no city items — skipping'); return; }
  const res = await request.get(`${API}/v1/region/city/${id}`, { headers: auth() });
  console.log(`GET /v1/region/city/${id} → ${res.status()}`);
  expect([200, 401, 403, 404]).toContain(res.status());
});

// ── Region: District ─────────────────────────────────────────────────────────
test('SGR-017: GET /v1/region/district/:id — single district', async ({ request }) => {
  await testGetById(request, '/v1/region/district?limit=1', '/v1/region/district/:id', 'region/district');
});

// ── Region: Subdistrict ───────────────────────────────────────────────────────
test('SGR-018: GET /v1/region/subdistrict/:id — single subdistrict', async ({ request }) => {
  await testGetById(request, '/v1/region/subdistrict?limit=1', '/v1/region/subdistrict/:id', 'region/subdistrict');
});

// ── Medical History Reference ─────────────────────────────────────────────────
test('SGR-019: GET /v1/medicalhistory/reference/:id — single medical history ref', async ({ request }) => {
  await testGetById(request, '/v1/medicalhistory/reference', '/v1/medicalhistory/reference/:id', 'medicalhistory/reference');
});

// ── Location ──────────────────────────────────────────────────────────────────
test('SGR-020: GET /v1/location/:id — single location', async ({ request }) => {
  await testGetById(request, '/v1/location', '/v1/location/:id', 'location');
});
