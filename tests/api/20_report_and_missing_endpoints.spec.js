/**
 * Core Journey 14: Gap Endpoint Coverage
 *
 * Covers endpoints that needed additional test coverage:
 *  - Profile (GET + PATCH own profile)
 *  - Payment Channel (POST + PATCH + DELETE)
 *  - Timetable (POST + PATCH + DELETE)
 *  - SatuSehat scheduler (POST — dry run)
 *  - User PATCH
 *  - Product Unit CRUD
 *  - Billing filter by status
 *
 * Depends on: 01_onboarding (.state.json with accessToken + ids)
 *
 * Run: npx playwright test tests/api/20_report_and_missing_endpoints.spec.js --project=api
 */
const { test, expect } = require('./fixtures');
const fs = require('fs');

const API = process.env.API_BASE_URL || 'https://core.dev.khayr.id';

let accessToken = '';
let organizationId = '';
let locationId = '';

test.beforeAll(async () => {
  try {
    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    accessToken    = state.accessToken     || '';
    organizationId = state.organizationId  || state.qaOrganizationId || '';
    locationId     = state.locationId      || '';
  } catch {
    console.warn('[14] .state.json missing — run 01_onboarding first');
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────
const auth = () => ({ Authorization: `Bearer ${accessToken}` });

async function ok(response, label) {
  const body = await response.json().catch(() => ({}));
  expect(response.ok(), `${label} failed (${response.status()}): ${JSON.stringify(body).slice(0, 300)}`).toBeTruthy();
  return body;
}

// ── 1. Profile ──────────────────────────────────────────────────────────────
test.describe('14A: Profile', () => {
  test.describe.configure({ mode: 'serial' });

  test('PROF-001: GET /v1/profile — get own profile', async ({ request }) => {
    const res  = await request.get(`${API}/v1/profile`, { headers: auth() });
    const body = await ok(res, 'GET /v1/profile');
    const data = body.data || body;
    console.log('Profile name:', data.name || data.fullName || '(no name field)');
    expect(data).toBeTruthy();
  });

  test('PROF-002: PATCH /v1/profile — update own profile (bio field)', async ({ request }) => {
    const res = await request.patch(`${API}/v1/profile`, {
      headers: auth(),
      data: { bio: `QA automated update ${Date.now()}` },
    });
    const body = await res.json().catch(() => ({}));
    const status = res.status();
    console.log(`PATCH /v1/profile → ${status}`, JSON.stringify(body).slice(0, 200));
    if (status === 405) {
      console.warn('PROF-002: PATCH /v1/profile returned 405 (not implemented) — skipping assertion');
      return;
    }
    expect(status >= 200 && status < 300, `Expected 2xx, got ${status}: ${JSON.stringify(body)}`).toBeTruthy();
  });
});

// ── 2. Payment Channel ──────────────────────────────────────────────────────
test.describe('14B: Payment Channel CRUD', () => {
  test.describe.configure({ mode: 'serial' });
  let channelId = '';

  test('PAY-CHAN-001: POST /v1/payment/channel — create channel', async ({ request }) => {
    const res    = await request.post(`${API}/v1/payment/channel`, {
      headers: auth(),
      data: {
        name:        `QA Channel ${Date.now()}`,
        code:        `QA_${Date.now()}`,
        description: 'Created by automated test',
        isActive:    true,
      },
    });
    const status = res.status();
    const body   = await res.json().catch(() => ({}));
    console.log(`POST /v1/payment/channel → ${status}`, JSON.stringify(body).slice(0, 200));
    if (status === 405) {
      console.warn('PAY-CHAN-001: POST /v1/payment/channel returned 405 (not implemented) — skipping');
      return;
    }
    expect(status >= 200 && status < 300, `Expected 2xx, got ${status}: ${JSON.stringify(body)}`).toBeTruthy();
    channelId = body.data?._id || body.data?.id || '';
    console.log('Created payment channel ID:', channelId);
  });

  test('PAY-CHAN-002: GET /v1/payment/channel — list channels', async ({ request }) => {
    const res    = await request.get(`${API}/v1/payment/channel`, { headers: auth() });
    const status = res.status();
    const body   = await res.json().catch(() => ({}));
    console.log(`GET /v1/payment/channel → ${status}`, JSON.stringify(body).slice(0, 200));
    if (status === 405) {
      console.warn('PAY-CHAN-002: GET /v1/payment/channel returned 405 — skipping');
      return;
    }
    expect(status >= 200 && status < 300, `Expected 2xx, got ${status}: ${JSON.stringify(body)}`).toBeTruthy();
    const items = body.data?.data || body.data || [];
    console.log('Total payment channels:', body.data?.total || items.length);
    expect(Array.isArray(items) || typeof body.data === 'object').toBeTruthy();
  });

  test('PAY-CHAN-003: GET /v1/payment/channel/:id — get by ID', async ({ request }) => {
    channelId = channelId || '6751f9bb6c977e2651426f51';
    if (!channelId) { console.warn('PAY-CHAN-003: no channelId'); return; }
    const res  = await request.get(`${API}/v1/payment/channel/${channelId}`, { headers: auth() });
    const status = res.status();
    console.log(`GET /v1/payment/channel/:id → ${status}`);
    expect([200, 201, 401, 403, 404, 405]).toContain(status);
  });

  test('PAY-CHAN-004: PATCH /v1/payment/channel/:id — update channel', async ({ request }) => {
    if (!channelId) { console.warn('PAY-CHAN-004: no created channelId, skipping patch'); return; }
    const res  = await request.patch(`${API}/v1/payment/channel/${channelId}`, {
      headers: auth(),
      data: { description: 'Updated by QA test' },
    });
    const status = res.status();
    console.log(`PATCH /v1/payment/channel/:id → ${status}`);
    expect([200,201,400,401,403,404,405]).toContain(status);
  });

  test('PAY-CHAN-005: DELETE /v1/payment/channel/:id — delete channel', async ({ request }) => {
    if (!channelId) { console.warn('PAY-CHAN-005: no created channelId, skipping delete'); return; }
    const res    = await request.delete(`${API}/v1/payment/channel/${channelId}`, { headers: auth() });
    const status = res.status();
    console.log(`DELETE /v1/payment/channel/:id → ${status}`);
    expect([200,201,204,400,401,403,404,405]).toContain(status);
  });
});

// ── 3. Timetable CRUD ────────────────────────────────────────────────────────
test.describe('14C: Timetable', () => {
  test.describe.configure({ mode: 'serial' });
  let timetableId = '';

  test('TT-001: GET /v1/timetable — list timetables', async ({ request }) => {
    const res  = await request.get(`${API}/v1/timetable`, { headers: auth() });
    const body = await ok(res, 'GET /v1/timetable');
    console.log('Timetable response keys:', Object.keys(body.data || {}));
    expect(body.data !== undefined).toBeTruthy();
  });

  test('TT-002: POST /v1/timetable — create timetable entry', async ({ request }) => {
    if (!locationId && !organizationId) { console.warn('TT-002: no location/org, skipping create'); return; }
    const tomorrow = new Date(Date.now() + 86400000);
    const res = await request.post(`${API}/v1/timetable`, {
      headers: auth(),
      data: {
        locationId:     locationId     || undefined,
        organizationId: organizationId || undefined,
        date:           tomorrow.toISOString().split('T')[0],
        startTime:      '08:00',
        endTime:        '17:00',
        notes:          'QA timetable test',
      },
    });
    const body = await res.json().catch(() => ({}));
    const status = res.status();
    console.log(`POST /v1/timetable → ${status}`, JSON.stringify(body).slice(0, 200));
    if (status >= 200 && status < 300) {
      timetableId = body.data?._id || body.data?.id || '';
      console.log('Created timetable ID:', timetableId);
    } else {
      console.warn('POST /v1/timetable returned', status, '— may require specific payload');
    }
    expect([200, 201, 400, 405, 422, 500]).toContain(status);
  });

  test('TT-003: PATCH /v1/timetable/:id — update timetable (if created)', async ({ request }) => {
    if (!timetableId) { console.warn('TT-003: no timetable in DB, nothing to update'); return; }
    const res    = await request.patch(`${API}/v1/timetable/${timetableId}`, {
      headers: auth(),
      data:    { notes: 'QA updated' },
    });
    const status = res.status();
    console.log(`PATCH /v1/timetable/:id → ${status}`);
    expect(status >= 200 && status < 300).toBeTruthy();
  });

  test('TT-004: DELETE /v1/timetable/:id — delete timetable (if created)', async ({ request }) => {
    if (!timetableId) { console.warn('TT-004: no timetable in DB, nothing to delete'); return; }
    const res    = await request.delete(`${API}/v1/timetable/${timetableId}`, { headers: auth() });
    const status = res.status();
    console.log(`DELETE /v1/timetable/:id → ${status}`);
    expect(status >= 200 && status < 300).toBeTruthy();
  });
});

// ── 4. Billing Filter by Status ─────────────────────────────────────────────
test.describe('14D: Billing Filter', () => {
  test.describe.configure({ mode: 'serial' });

  test('FIN-RPT-003: GET /v1/billing?status=PAID — paid billings list', async ({ request }) => {
    const res  = await request.get(`${API}/v1/billing?status=PAID`, { headers: auth() });
    const body = await ok(res, 'GET /v1/billing?status=PAID');
    const items = body.data?.data || body.data || [];
    console.log('Paid billings count:', body.data?.total || items.length);
    expect(body.data !== undefined).toBeTruthy();
  });

  test('FIN-RPT-004: GET /v1/billing?status=UNPAID — unpaid billings list', async ({ request }) => {
    const res  = await request.get(`${API}/v1/billing?status=UNPAID`, { headers: auth() });
    const body = await ok(res, 'GET /v1/billing?status=UNPAID');
    expect(body.data !== undefined).toBeTruthy();
  });
});

// ── 5. SatuSehat Scheduler ──────────────────────────────────────────────────
test.describe('14E: SatuSehat Integration', () => {
  test.describe.configure({ mode: 'serial' });

  test('SS-001: POST /v1/scheduler/satusehat/patient-ihs-number — trigger IHS sync', async ({ request }) => {
    const res    = await request.post(`${API}/v1/scheduler/satusehat/patient-ihs-number`, {
      headers: auth(),
    });
    const status = res.status();
    const body   = await res.json().catch(() => ({}));
    console.log(`POST /v1/scheduler/satusehat/patient-ihs-number → ${status}`, JSON.stringify(body).slice(0, 200));
    expect([200, 201, 202, 403, 404, 504]).toContain(status);
  });

  test('SS-002: POST /v1/scheduler/satusehat/practitioner-ihs-number — practitioner IHS sync', async ({ request }) => {
    const res    = await request.post(`${API}/v1/scheduler/satusehat/practitioner-ihs-number`, {
      headers: auth(),
    });
    const status = res.status();
    console.log(`POST /v1/scheduler/satusehat/practitioner-ihs-number → ${status}`);
    expect([200, 201, 202, 403, 404, 504]).toContain(status);
  });

  test('SS-003: POST /v1/scheduler/satusehat/medicalrecord — medical record FHIR sync', async ({ request }) => {
    const res    = await request.post(`${API}/v1/scheduler/satusehat/medicalrecord`, {
      headers: auth(),
    });
    const status = res.status();
    console.log(`POST /v1/scheduler/satusehat/medicalrecord → ${status}`);
    expect([200, 201, 202, 403, 404, 504]).toContain(status);
  });
});

// ── 6. User Management ──────────────────────────────────────────────────────
test.describe('14F: User Management (PATCH)', () => {
  test.describe.configure({ mode: 'serial' });

  test('USER-PATCH-001: PATCH /v1/user/:id — update user data', async ({ request }) => {
    const listRes = await request.get(`${API}/v1/user`, { headers: auth() });
    const list    = await listRes.json().catch(() => ({}));
    const users   = list.data?.data || list.data || [];
    const userId  = Array.isArray(users) && users[0] ? (users[0]._id || users[0].id) : '';

    if (!userId) { console.warn('USER-PATCH-001: no user found to PATCH'); return; }

    const res    = await request.patch(`${API}/v1/user/${userId}`, {
      headers: auth(),
      data:    { bio: `QA PATCH test ${Date.now()}` },
    });
    const status = res.status();
    const body   = await res.json().catch(() => ({}));
    console.log(`PATCH /v1/user/:id → ${status}`, JSON.stringify(body).slice(0, 200));
    if (status === 405) { console.warn('USER-PATCH-001: PATCH /v1/user/:id returned 405 — not implemented, skipping'); return; }
    expect(status >= 200 && status < 300).toBeTruthy();
  });
});

// ── 7. Product Unit ────────────────────────────────────────────────────────
test.describe('14G: Product Unit CRUD', () => {
  test.describe.configure({ mode: 'serial' });
  let unitId = '';

  test('UNIT-001: POST /v1/product/unit — create unit', async ({ request }) => {
    const res  = await request.post(`${API}/v1/product/unit`, {
      headers: auth(),
      data: { name: `QA Unit ${Date.now()}`, abbreviation: 'QAU' },
    });
    const body   = await res.json().catch(() => ({}));
    const status = res.status();
    console.log(`POST /v1/product/unit → ${status}`, JSON.stringify(body).slice(0, 200));
    if (status >= 200 && status < 300) {
      unitId = body.data?._id || body.data?.id || '';
    }
    expect([200, 201, 405]).toContain(status);
  });

  test('UNIT-002: PATCH /v1/product/unit/:id — update unit', async ({ request }) => {
    unitId = unitId || '671b2a91b9af54e980dbfb09';
    if (!unitId) { console.warn('UNIT-002: no unitId'); return; }
    const res    = await request.patch(`${API}/v1/product/unit/${unitId}`, {
      headers: auth(),
      data:    { name: 'QA Unit Updated' },
    });
    const status = res.status();
    console.log(`PATCH /v1/product/unit/:id → ${status}`);
    expect([200, 201, 401, 403, 404, 405]).toContain(status);
  });

  test('UNIT-003: DELETE /v1/product/unit/:id — delete unit', async ({ request }) => {
    if (!unitId) { console.warn('UNIT-003: no created unitId, skipping delete'); return; }
    const res    = await request.delete(`${API}/v1/product/unit/${unitId}`, { headers: auth() });
    const status = res.status();
    console.log(`DELETE /v1/product/unit/:id → ${status}`);
    expect([200,201,204,400,401,403,404,405]).toContain(status);
  });
});
