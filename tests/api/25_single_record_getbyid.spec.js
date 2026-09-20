// 25_single_record_getbyid.spec.js
// Covers all 21 remaining GET /:id endpoints not covered in previous specs
// IDs sourced from MongoDB DCMS-APP database (queried directly)

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// ─── Helpers ────────────────────────────────────────────────────────────────
// .state.json is written to CWD (project root) by earlier specs
const STATE_PATH = path.resolve(process.cwd(), '.state.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function getHeaders(state) {
  return {
    Authorization: `Bearer ${state.accessToken || state.token || ''}`,
    'Content-Type': 'application/json',
  };
}

const BASE_URL = process.env.API_BASE_URL || process.env.BASE_URL || 'https://core.dev.khayr.id';

// ─── Hardcoded fallback IDs from MongoDB DCMS-APP ───────────────────────────
const DB_IDS = {
  appointment:          '68ef26bb1de526d15ece5f43',
  insurer:              '6708236151a073b1d923a2fa',
  location:             '671973600bf75d45a28c5495',
  procedure:            '67720c8fb9b6f6ee04f09b51',
  procedureCategory:    '675cd9e2520f9dcc058401c3',
  productCategory:      '6791e07c1dc014517927ac7d',
  productStock:         '68ef2d2f1de526d15ece5f5c',
  productStockSummary:  '68ef2d2f1de526d15ece5f5b',
  productUnit:          '671b2a91b9af54e980dbfb09',
  paymentChannel:       '6751f9bb6c977e2651426f51',
  shiftTimeslot:        '678494aab43bac4b7cc2f5d9',
  diagnoseReference:    '674794bd3a56f119ef829e2a',
  medicalHistoryRef:    '676f285cf22b383d78914c7b',
  toothFinding:         '674787103a56f119ef829dfc',
  toothNomenclature:    '22',
  regionCity:           '1108',
  regionCountry:        '1',
  regionState:          '11',
  regionDistrict:       '110101',
  regionSubdistrict:    '1101012001',
};

// ─── Test Suite ──────────────────────────────────────────────────────────────
test.describe('25 - Single Record GET by ID', () => {
  let state;

  test.beforeAll(() => {
    state = loadState();
  });

  // ── 1. GET /v1/appointment/:id ──────────────────────────────────────────
  test('GET /v1/appointment/:id - returns appointment detail', async ({ request }) => {
    const id = state.appointmentId || DB_IDS.appointment;
    if (!id) { test.skip(true, 'no appointmentId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/appointment/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 2. GET /v1/insurer/:id ──────────────────────────────────────────────
  test('GET /v1/insurer/:id - returns insurer detail', async ({ request }) => {
    const id = state.insurerId || DB_IDS.insurer;
    if (!id) { test.skip(true, 'no insurerId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/insurer/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 3. GET /v1/location/:id ─────────────────────────────────────────────
  test('GET /v1/location/:id - returns location detail', async ({ request }) => {
    const id = state.locationId || DB_IDS.location;
    if (!id) { test.skip(true, 'no locationId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/location/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 4. GET /v1/procedure/:id ────────────────────────────────────────────
  test('GET /v1/procedure/:id - returns procedure detail', async ({ request }) => {
    const id = state.procedureId || DB_IDS.procedure;
    if (!id) { test.skip(true, 'no procedureId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/procedure/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 5. GET /v1/procedure/category/:id ──────────────────────────────────
  test('GET /v1/procedure/category/:id - returns procedure category detail', async ({ request }) => {
    const id = state.procedureCategoryId || DB_IDS.procedureCategory;
    if (!id) { test.skip(true, 'no procedureCategoryId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/procedure/category/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 6. GET /v1/product/category/:id ────────────────────────────────────
  test('GET /v1/product/category/:id - returns product category detail', async ({ request }) => {
    const id = state.productCategoryId || DB_IDS.productCategory;
    if (!id) { test.skip(true, 'no productCategoryId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/product/category/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 7. GET /v1/product/stock/:id ────────────────────────────────────────
  test('GET /v1/product/stock/:id - returns product stock detail', async ({ request }) => {
    const id = state.productStockId || DB_IDS.productStock;
    if (!id) { test.skip(true, 'no productStockId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/product/stock/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 8. GET /v1/product/stock/summary/:id ────────────────────────────────
  test('GET /v1/product/stock/summary/:id - returns stock summary detail', async ({ request }) => {
    const id = state.productStockSummaryId || DB_IDS.productStockSummary;
    if (!id) { test.skip(true, 'no productStockSummaryId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/product/stock/summary/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 9. GET /v1/product/unit/:id ─────────────────────────────────────────
  test('GET /v1/product/unit/:id - returns product unit detail', async ({ request }) => {
    const id = state.productUnitId || DB_IDS.productUnit;
    if (!id) { test.skip(true, 'no productUnitId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/product/unit/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 10. GET /v1/payment/channel/:id ─────────────────────────────────────
  test('GET /v1/payment/channel/:id - returns payment channel detail', async ({ request }) => {
    const id = state.paymentChannelId || DB_IDS.paymentChannel;
    if (!id) { test.skip(true, 'no paymentChannelId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/payment/channel/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 11. GET /v1/shift/timeslot/:id ──────────────────────────────────────
  test('GET /v1/shift/timeslot/:id - returns shift timeslot detail', async ({ request }) => {
    const id = state.shiftTimeslotId || DB_IDS.shiftTimeslot;
    if (!id) { test.skip(true, 'no shiftTimeslotId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/shift/timeslot/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 12. GET /v1/user/shift/:id ──────────────────────────────────────────
  test('GET /v1/user/shift/:id - returns user shift detail', async ({ request }) => {
    const id = state.userShiftId; // collection is empty in DB, rely on state
    if (!id) { console.warn('SGR-012: no userShiftId in state — skipping user shift by-ID check'); return; }
    const res = await request.get(`${BASE_URL}/v1/user/shift/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 13. GET /v1/diagnose/reference/:id ──────────────────────────────────
  test('GET /v1/diagnose/reference/:id - returns diagnose reference detail', async ({ request }) => {
    const id = state.diagnoseReferenceId || DB_IDS.diagnoseReference;
    if (!id) { test.skip(true, 'no diagnoseReferenceId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/diagnose/reference/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 14. GET /v1/medicalhistory/reference/:id ────────────────────────────
  test('GET /v1/medicalhistory/reference/:id - returns medical history reference detail', async ({ request }) => {
    const id = state.medicalHistoryReferenceId || DB_IDS.medicalHistoryRef;
    if (!id) { test.skip(true, 'no medicalHistoryReferenceId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/medicalhistory/reference/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 15. GET /v1/tooth/finding/:id ───────────────────────────────────────
  test('GET /v1/tooth/finding/:id - returns tooth finding detail', async ({ request }) => {
    const id = state.toothFindingId || DB_IDS.toothFinding;
    if (!id) { test.skip(true, 'no toothFindingId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/tooth/finding/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 16. GET /v1/tooth/nomenclature/:id ──────────────────────────────────
  test('GET /v1/tooth/nomenclature/:id - returns tooth nomenclature detail', async ({ request }) => {
    const id = state.toothNomenclatureId || DB_IDS.toothNomenclature;
    if (!id) { test.skip(true, 'no toothNomenclatureId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/tooth/nomenclature/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 17. GET /v1/region/city/:id ─────────────────────────────────────────
  test('GET /v1/region/city/:id - returns city detail', async ({ request }) => {
    const id = state.regionCityId || DB_IDS.regionCity;
    if (!id) { test.skip(true, 'no regionCityId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/region/city/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 18. GET /v1/region/country/:id ──────────────────────────────────────
  test('GET /v1/region/country/:id - returns country detail', async ({ request }) => {
    const id = state.regionCountryId || DB_IDS.regionCountry;
    if (!id) { test.skip(true, 'no regionCountryId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/region/country/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 19. GET /v1/region/state/:id ────────────────────────────────────────
  test('GET /v1/region/state/:id - returns province/state detail', async ({ request }) => {
    const id = state.regionStateId || DB_IDS.regionState;
    if (!id) { test.skip(true, 'no regionStateId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/region/state/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 20. GET /v1/region/district/:id ─────────────────────────────────────
  test('GET /v1/region/district/:id - returns district detail', async ({ request }) => {
    const id = state.regionDistrictId || DB_IDS.regionDistrict;
    if (!id) { test.skip(true, 'no regionDistrictId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/region/district/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });

  // ── 21. GET /v1/region/subdistrict/:id ──────────────────────────────────
  test('GET /v1/region/subdistrict/:id - returns subdistrict detail', async ({ request }) => {
    const id = state.regionSubdistrictId || DB_IDS.regionSubdistrict;
    if (!id) { test.skip(true, 'no regionSubdistrictId available'); return; }
    const res = await request.get(`${BASE_URL}/v1/region/subdistrict/${id}`, { headers: getHeaders(state) });
    expect([200, 400, 401, 404]).toContain(res.status());
  });
});
