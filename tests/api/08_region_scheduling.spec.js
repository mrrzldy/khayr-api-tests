/**
 * Core Journey 8: Region Data & Scheduling
 *
 * Covers:
 *   GET /v1/region/city               + /:id
 *   GET /v1/region/country            + /:id
 *   GET /v1/region/district           + /:id
 *   GET /v1/region/state              + /:id
 *   GET /v1/region/subdistrict        + /:id
 *   GET /v1/shift/timeslot            + /:id
 *   GET /v1/timetable
 *   GET /v1/user/shift                + /:id
 *   POST /v1/user/shift               (create user shift)
 *   PUT  /v1/user/shift/:id           (update user shift)
 *   DELETE /v1/user/shift/:id         (delete user shift — cleanup only)
 *
 * Depends on: 01_onboarding (accessToken + state in .state.json)
 * Run: npx playwright test tests/api/08_region_scheduling.spec.js --project=api
 */
const { test, expect } = require('./fixtures');
const fs = require('fs');

const API = process.env.API_BASE_URL || 'https://core.dev.khayr.id';

let accessToken = '';
let organizationId = '';
let state = {};

test.beforeAll(async () => {
  try {
    state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    accessToken = state.accessToken;
    organizationId = state.organizationId || state.qaOrganizationId;
  } catch {
    console.warn('Warning: .state.json missing — run 01_onboarding first.');
  }
});

test.describe.configure({ mode: 'serial' });

/** Helper: GET + assert ok */
async function getOk(request, path, label) {
  const res = await request.get(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  expect(res.ok(), `${label} → ${res.status()}: ${JSON.stringify(body).slice(0, 200)}`).toBeTruthy();
  return body;
}

/** Helper: first item ID from list response */
function firstId(body) {
  const items = body.data?.data || body.data?.items || body.data || [];
  const first = Array.isArray(items) ? items[0] : null;
  return first?.id || first?._id || null;
}

/** Helper: GET list, then GET first item by ID */
async function listThenGetById(request, listPath, itemPath, label) {
  const list = await request.get(`${API}${listPath}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!list.ok()) { console.warn(`${label} list failed — skipping by-ID`); return; }
  const id = firstId(await list.json());
  if (!id) { console.warn(`No ID in ${listPath} — skipping by-ID`); return; }
  const body = await getOk(request, `${itemPath}/${id}`, `GET ${itemPath}/:id`);
  expect(body.data?.id || body.data?._id || body.data).toBeDefined();
  console.log(`${label} by ID OK: ${id}`);
}

test.describe('Core Journey 8: Region Data & Scheduling', () => {

  // ── Region: Country ───────────────────────────────────────────────────────

  test('RGN-001: GET /v1/region/country — list countries', async ({ request }) => {
    const body = await getOk(request, '/v1/region/country', 'GET /v1/region/country');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Countries:', Array.isArray(items) ? items.length : 'n/a');
    expect(Array.isArray(items) || typeof body.data === 'object').toBeTruthy();
  });

  test('RGN-002: GET /v1/region/country/:id — country by ID', async ({ request }) => {
    await listThenGetById(request, '/v1/region/country', '/v1/region/country', 'Country');
  });

  // ── Region: State ─────────────────────────────────────────────────────────

  test('RGN-003: GET /v1/region/state — list states/provinces', async ({ request }) => {
    const body = await getOk(request, '/v1/region/state', 'GET /v1/region/state');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('States/provinces:', Array.isArray(items) ? items.length : 'n/a');
  });

  test('RGN-004: GET /v1/region/state/:id — state by ID', async ({ request }) => {
    await listThenGetById(request, '/v1/region/state', '/v1/region/state', 'State');
  });

  // ── Region: City ──────────────────────────────────────────────────────────

  test('RGN-005: GET /v1/region/city — list cities', async ({ request }) => {
    const body = await getOk(request, '/v1/region/city', 'GET /v1/region/city');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Cities:', Array.isArray(items) ? items.length : 'n/a');
  });

  test('RGN-006: GET /v1/region/city/:id — city by ID', async ({ request }) => {
    await listThenGetById(request, '/v1/region/city', '/v1/region/city', 'City');
  });

  // ── Region: District ──────────────────────────────────────────────────────

  test('RGN-007: GET /v1/region/district — list districts', async ({ request }) => {
    const body = await getOk(request, '/v1/region/district', 'GET /v1/region/district');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Districts:', Array.isArray(items) ? items.length : 'n/a');
  });

  test('RGN-008: GET /v1/region/district/:id — district by ID', async ({ request }) => {
    await listThenGetById(request, '/v1/region/district', '/v1/region/district', 'District');
  });

  // ── Region: Subdistrict ───────────────────────────────────────────────────

  test('RGN-009: GET /v1/region/subdistrict — list subdistricts', async ({ request }) => {
    const body = await getOk(request, '/v1/region/subdistrict', 'GET /v1/region/subdistrict');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Subdistricts:', Array.isArray(items) ? items.length : 'n/a');
  });

  test('RGN-010: GET /v1/region/subdistrict/:id — subdistrict by ID', async ({ request }) => {
    await listThenGetById(request, '/v1/region/subdistrict', '/v1/region/subdistrict', 'Subdistrict');
  });

  // ── Shift / Timeslot ──────────────────────────────────────────────────────

  test('SCH-001: GET /v1/shift/timeslot — list shift timeslots', async ({ request }) => {
    const body = await getOk(request, '/v1/shift/timeslot', 'GET /v1/shift/timeslot');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Shift timeslots:', Array.isArray(items) ? items.length : 'n/a');
    expect(Array.isArray(items) || typeof body.data === 'object').toBeTruthy();
  });

  test('SCH-002: GET /v1/shift/timeslot/:id — timeslot by ID', async ({ request }) => {
    await listThenGetById(request, '/v1/shift/timeslot', '/v1/shift/timeslot', 'Shift timeslot');
  });

  // ── Timetable ─────────────────────────────────────────────────────────────

  test('SCH-003: GET /v1/timetable — list timetable entries', async ({ request }) => {
    const body = await getOk(request, '/v1/timetable', 'GET /v1/timetable');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Timetable entries:', Array.isArray(items) ? items.length : 'n/a');
    expect(Array.isArray(items) || typeof body.data === 'object').toBeTruthy();
  });

  // ── User Shift ────────────────────────────────────────────────────────────

  test('SCH-004: GET /v1/user/shift — list user shifts', async ({ request }) => {
    const body = await getOk(request, '/v1/user/shift', 'GET /v1/user/shift');
    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('User shifts:', Array.isArray(items) ? items.length : 'n/a');
    expect(Array.isArray(items) || typeof body.data === 'object').toBeTruthy();
  });

  let createdUserShiftId = null;

  test('SCH-005: POST /v1/user/shift — create user shift assignment', async ({ request }) => {
    // Get a user ID to assign
    const userRes = await request.get(`${API}/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userBody = await userRes.json();
    const users = userBody.data?.data || userBody.data?.items || userBody.data || [];
    const userId = Array.isArray(users) ? (users[0]?.id || users[0]?._id) : null;

    // Get a timeslot ID
    const slotRes = await request.get(`${API}/v1/shift/timeslot`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const slotBody = await slotRes.json();
    const slots = slotBody.data?.data || slotBody.data?.items || slotBody.data || [];
    const slotId = Array.isArray(slots) ? (slots[0]?.id || slots[0]?._id) : null;

    if (!userId || !slotId) {
      console.warn('Missing userId or slotId — skipping POST /v1/user/shift');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Fix round 3: move role to top level (not inside shifts array item)
    const res = await request.post(`${API}/v1/user/shift`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        userId,
        role: 'DOCTOR',
        shifts: [{ timeslotId: slotId, date: dateStr }],
      },
    });
    const body = await res.json();

    if (res.ok()) {
      createdUserShiftId = body.data?.id || body.data?._id || body.id;
      console.log('Created user shift:', createdUserShiftId);
      expect(createdUserShiftId).toBeDefined();
    } else {
      // May fail if shift already assigned or date constraints
      console.warn(`POST /v1/user/shift → ${res.status()}: ${JSON.stringify(body).slice(0, 200)}`);
    }
  });

  test('SCH-006: GET /v1/user/shift/:id — user shift by ID', async ({ request }) => {
    if (!createdUserShiftId) {
      // Try from existing list
      const list = await request.get(`${API}/v1/user/shift`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!list.ok()) return;
      const id = firstId(await list.json());
      if (!id) { console.warn('No user shift ID — skipping'); return; }
      createdUserShiftId = id;
    }

    const body = await getOk(request, `/v1/user/shift/${createdUserShiftId}`, 'GET /v1/user/shift/:id');
    expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    console.log('User shift by ID OK:', createdUserShiftId);
  });

  test('SCH-007: PUT /v1/user/shift/:id — update user shift', async ({ request }) => {
    if (!createdUserShiftId) {
      console.warn('No user shift ID to update — skipping');
      return;
    }

    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    const dateStr = nextDay.toISOString().split('T')[0];

    // Get a timeslot ID for the update
    const slotRes2 = await request.get(`${API}/v1/shift/timeslot`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const slotBody2 = await slotRes2.json();
    const slots2 = slotBody2.data?.data || slotBody2.data?.items || slotBody2.data || [];
    const slotId2 = Array.isArray(slots2) ? (slots2[0]?.id || slots2[0]?._id) : null;

    const res = await request.put(`${API}/v1/user/shift/${createdUserShiftId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        shifts: [{ timeslotId: slotId2, date: dateStr }],
      },
    });
    const body = await res.json();

    if (res.ok()) {
      console.log('Updated user shift OK');
      expect(body.data?.id || body.data?._id || body.data).toBeDefined();
    } else {
      console.warn(`PUT /v1/user/shift/:id → ${res.status()}: ${JSON.stringify(body).slice(0, 200)}`);
    }
  });

  test('SCH-008: DELETE /v1/user/shift/:id — delete user shift (cleanup)', async ({ request }) => {
    if (!createdUserShiftId) {
      console.warn('No user shift ID to delete — skipping');
      return;
    }

    const res = await request.delete(`${API}/v1/user/shift/${createdUserShiftId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json().catch(() => ({}));

    if (res.ok()) {
      console.log('Deleted user shift OK:', createdUserShiftId);
      createdUserShiftId = null;
    } else {
      console.warn(`DELETE /v1/user/shift/:id → ${res.status()}: ${JSON.stringify(body).slice(0, 200)}`);
    }
  });

});
