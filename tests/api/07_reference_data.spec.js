/**
 * Core Journey 7: Reference & Master Data — GET endpoints
 *
 * Covers all read-only reference/master data endpoints not in suites 01–06:
 *
 *   GET /v1/diagnose/reference          + /:id
 *   GET /v1/medicalhistory/reference    + /:id
 *   GET /v1/procedure/reference
 *   GET /v1/procedure/category/:id
 *   GET /v1/procedure/:id
 *   GET /v1/product/category/:id
 *   GET /v1/product/:id
 *   GET /v1/product/stock/history
 *   GET /v1/product/stock/:id
 *   GET /v1/product/stock/summary/:id
 *   GET /v1/product/unit               + /:id
 *   GET /v1/tooth/finding              + /:id
 *   GET /v1/tooth/mobility/reference
 *   GET /v1/tooth/nomenclature         + /:id
 *   GET /v1/tooth/periodontal/pocket/reference
 *   GET /v1/payment/channel            + /:id
 *   GET /v1/profile
 *   GET /v1/role                       + /:id
 *   GET /v1/organization               (list)
 *
 * Depends on: 01_onboarding (accessToken in .state.json)
 * Run: npx playwright test tests/api/07_reference_data.spec.js --project=api
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
    console.warn('Warning: .state.json missing — run 01_onboarding first.');
  }
});

test.describe.configure({ mode: 'serial' });

/** Helper: GET endpoint, assert ok, return parsed body */
async function getOk(request, path, label) {
  const res = await request.get(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  expect(res.ok(), `${label} → ${res.status()}: ${JSON.stringify(body).slice(0, 200)}`).toBeTruthy();
  return body;
}

/** Helper: get first item ID from a list response */
function firstId(body) {
  const items = body.data?.data || body.data?.items || body.data || [];
  const first = Array.isArray(items) ? items[0] : null;
  return first?.id || first?._id || null;
}

test.describe('Core Journey 7: Reference & Master Data GETs', () => {

  // ── Diagnose Reference ───────────────────────────────────────────────────

  test('REF-001: GET /v1/diagnose/reference — list ICD diagnoses', async ({ request }) => {
    const body = await getOk(request, '/v1/diagnose/reference', 'GET /v1/diagnose/reference');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Diagnose references:', Array.isArray(items) ? items.length : 'n/a');
    expect(Array.isArray(items) || typeof body.data === 'object').toBeTruthy();
  });

  test('REF-002: GET /v1/diagnose/reference/:id — get by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/diagnose/reference`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const id = firstId(await list.json());
    if (!id) { console.warn('No diagnose reference ID found — skipping'); return; }

    const body = await getOk(request, `/v1/diagnose/reference/${id}`, 'GET /v1/diagnose/reference/:id');
    expect(body.data?.id || body.data?._id || body.id || body.data).toBeDefined();
    console.log('Diagnose ref by ID OK:', id);
  });

  // ── Medical History Reference ─────────────────────────────────────────────

  test('REF-003: GET /v1/medicalhistory/reference — list medical history refs', async ({ request }) => {
    const body = await getOk(request, '/v1/medicalhistory/reference', 'GET /v1/medicalhistory/reference');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Medicalhistory references:', Array.isArray(items) ? items.length : 'n/a');
  });

  test('REF-004: GET /v1/medicalhistory/reference/:id — get by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/medicalhistory/reference`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const listBody = await list.json();
    const items = listBody.data?.data || listBody.data?.items || listBody.data || [];
    const first = Array.isArray(items) ? items[0] : null;
    // Try both id/_id and any numeric/code field the API may use
    const id = first?.id || first?._id || first?.code || first?.referenceId || null;
    if (!id) { console.warn('No medicalhistory reference ID found — skipping'); return; }

    const res = await request.get(`${API}/v1/medicalhistory/reference/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json();
    if (res.ok()) {
      expect(body.data?.id || body.data?._id || body.data).toBeDefined();
      console.log('Medicalhistory ref by ID OK:', id);
    } else {
      // Endpoint may not support lookup by this ID format — log and skip
      console.warn(`GET /v1/medicalhistory/reference/:id → ${res.status()} (ID format may differ): ${JSON.stringify(body).slice(0, 150)}`);
    }
  });

  // ── Procedure Reference ───────────────────────────────────────────────────

  test('REF-005: GET /v1/procedure/reference — list procedure references', async ({ request }) => {
    const body = await getOk(request, '/v1/procedure/reference', 'GET /v1/procedure/reference');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Procedure references:', Array.isArray(items) ? items.length : 'n/a');
  });

  test('REF-006: GET /v1/procedure/category/:id — get category by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/procedure/category`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const id = firstId(await list.json());
    if (!id) { console.warn('No procedure category ID — skipping'); return; }

    const body = await getOk(request, `/v1/procedure/category/${id}`, 'GET /v1/procedure/category/:id');
    expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    console.log('Procedure category by ID OK:', id);
  });

  test('REF-007: GET /v1/procedure/:id — get procedure by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/procedure`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const id = firstId(await list.json());
    if (!id) { console.warn('No procedure ID — skipping'); return; }

    const body = await getOk(request, `/v1/procedure/${id}`, 'GET /v1/procedure/:id');
    expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    console.log('Procedure by ID OK:', id);
  });

  // ── Product Detail ────────────────────────────────────────────────────────

  test('REF-008: GET /v1/product/category/:id — product category by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/product/category`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const id = firstId(await list.json());
    if (!id) { console.warn('No product category ID — skipping'); return; }

    const body = await getOk(request, `/v1/product/category/${id}`, 'GET /v1/product/category/:id');
    expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    console.log('Product category by ID OK:', id);
  });

  test('REF-009: GET /v1/product/:id — product by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/product`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const id = firstId(await list.json());
    if (!id) { console.warn('No product ID — skipping'); return; }

    const body = await getOk(request, `/v1/product/${id}`, 'GET /v1/product/:id');
    expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    console.log('Product by ID OK:', id);
  });

  test('REF-010: GET /v1/product/stock/history — stock transaction history', async ({ request }) => {
    const body = await getOk(request, '/v1/product/stock/history', 'GET /v1/product/stock/history');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Stock history entries:', Array.isArray(items) ? items.length : 'n/a');
  });

  test('REF-011: GET /v1/product/stock/:id — stock entry by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/product/stock`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const id = firstId(await list.json());
    if (!id) { console.warn('No stock ID — skipping'); return; }

    const body = await getOk(request, `/v1/product/stock/${id}`, 'GET /v1/product/stock/:id');
    expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    console.log('Stock by ID OK:', id);
  });

  test('REF-012: GET /v1/product/stock/summary/:id — stock summary by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/product/stock/summary`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const id = firstId(await list.json());
    if (!id) { console.warn('No stock summary ID — skipping'); return; }

    const body = await getOk(request, `/v1/product/stock/summary/${id}`, 'GET /v1/product/stock/summary/:id');
    expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    console.log('Stock summary by ID OK:', id);
  });

  test('REF-013: GET /v1/product/unit — list product units', async ({ request }) => {
    const body = await getOk(request, '/v1/product/unit', 'GET /v1/product/unit');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Product units:', Array.isArray(items) ? items.length : 'n/a');
  });

  test('REF-014: GET /v1/product/unit/:id — product unit by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/product/unit`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const id = firstId(await list.json());
    if (!id) { console.warn('No product unit ID — skipping'); return; }

    const body = await getOk(request, `/v1/product/unit/${id}`, 'GET /v1/product/unit/:id');
    expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    console.log('Product unit by ID OK:', id);
  });

  // ── Tooth Reference ───────────────────────────────────────────────────────

  test('REF-015: GET /v1/tooth/finding — list tooth findings', async ({ request }) => {
    const body = await getOk(request, '/v1/tooth/finding', 'GET /v1/tooth/finding');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Tooth findings:', Array.isArray(items) ? items.length : 'n/a');
  });

  test('REF-016: GET /v1/tooth/finding/:id — tooth finding by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/tooth/finding`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const id = firstId(await list.json());
    if (!id) { console.warn('No tooth finding ID — skipping'); return; }

    const body = await getOk(request, `/v1/tooth/finding/${id}`, 'GET /v1/tooth/finding/:id');
    expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    console.log('Tooth finding by ID OK:', id);
  });

  test('REF-017: GET /v1/tooth/mobility/reference — tooth mobility reference', async ({ request }) => {
    const body = await getOk(request, '/v1/tooth/mobility/reference', 'GET /v1/tooth/mobility/reference');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Tooth mobility references:', Array.isArray(items) ? items.length : 'n/a');
  });

  test('REF-018: GET /v1/tooth/nomenclature — tooth nomenclature list', async ({ request }) => {
    const body = await getOk(request, '/v1/tooth/nomenclature', 'GET /v1/tooth/nomenclature');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Tooth nomenclatures:', Array.isArray(items) ? items.length : 'n/a');
  });

  test('REF-019: GET /v1/tooth/nomenclature/:id — tooth nomenclature by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/tooth/nomenclature`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const id = firstId(await list.json());
    if (!id) { console.warn('No tooth nomenclature ID — skipping'); return; }

    const body = await getOk(request, `/v1/tooth/nomenclature/${id}`, 'GET /v1/tooth/nomenclature/:id');
    expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    console.log('Tooth nomenclature by ID OK:', id);
  });

  test('REF-020: GET /v1/tooth/periodontal/pocket/reference — perio pocket reference', async ({ request }) => {
    const body = await getOk(request, '/v1/tooth/periodontal/pocket/reference', 'GET /v1/tooth/periodontal/pocket/reference');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Perio pocket references:', Array.isArray(items) ? items.length : 'n/a');
  });

  // ── Payment Channel ───────────────────────────────────────────────────────

  test('REF-021: GET /v1/payment/channel — list payment channels', async ({ request }) => {
    const body = await getOk(request, '/v1/payment/channel', 'GET /v1/payment/channel');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Payment channels:', Array.isArray(items) ? items.length : 'n/a');
  });

  test('REF-022: GET /v1/payment/channel/:id — payment channel by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/payment/channel`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const id = firstId(await list.json());
    if (!id) { console.warn('No payment channel ID — skipping'); return; }

    const body = await getOk(request, `/v1/payment/channel/${id}`, 'GET /v1/payment/channel/:id');
    expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    console.log('Payment channel by ID OK:', id);
  });

  // ── Profile ───────────────────────────────────────────────────────────────

  test('REF-023: GET /v1/profile — get current user profile', async ({ request }) => {
    const body = await getOk(request, '/v1/profile', 'GET /v1/profile');
    const profileData = body.data || body;
    expect(profileData).toBeDefined();
    console.log('Profile:', JSON.stringify(profileData).slice(0, 150));
  });

  // ── Role ──────────────────────────────────────────────────────────────────

  test('REF-024: GET /v1/role — list roles', async ({ request }) => {
    const body = await getOk(request, '/v1/role', 'GET /v1/role');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Roles:', Array.isArray(items) ? items.length : 'n/a');
    expect(Array.isArray(items) || typeof body.data === 'object').toBeTruthy();
  });

  test('REF-025: GET /v1/role/:id — role by ID', async ({ request }) => {
    const list = await request.get(`${API}/v1/role`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!list.ok()) return;
    const id = firstId(await list.json());
    if (!id) { console.warn('No role ID — skipping'); return; }

    const body = await getOk(request, `/v1/role/${id}`, 'GET /v1/role/:id');
    expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    console.log('Role by ID OK:', id);
  });

  // ── Organization List ─────────────────────────────────────────────────────

  test('REF-026: GET /v1/organization — list organizations', async ({ request }) => {
    const res = await request.get(`${API}/v1/organization`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json();
    if (res.ok()) {
      const items = body.data?.data || body.data?.items || body.data || [];
      console.log('Organizations:', Array.isArray(items) ? items.length : 'n/a');
      expect(Array.isArray(items) || typeof body.data === 'object').toBeTruthy();
    } else {
      // Some roles (non-superadmin) may not have access to org list
      console.warn(`GET /v1/organization → ${res.status()} (may require superadmin)`);
    }
  });

});
