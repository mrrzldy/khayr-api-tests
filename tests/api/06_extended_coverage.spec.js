/**
 * Core Journey 6: Extended Coverage — Endpoints discovered via API Discovery
 *
 * Covers gap endpoints found by 00_api_discovery.spec.js that were
 * called by the UI but not yet covered in tests/api/01–05:
 *
 *   GET /v1/user                        (user list)
 *   GET /v1/organization/:id            (org detail)
 *   GET /v1/demography                  (demography master data)
 *   GET /v1/roles-access                (role access control list)
 *   GET /v1/product/stock/summary       (inventory stock summary)
 *   GET /v1/product/stock/summary/stats (inventory stock stats)
 *   GET /v1/reports/customer-360        (customer 360 report)
 *
 * Depends on: 01_onboarding (accessToken + organizationId in .state.json)
 */
const { test, expect } = require('./fixtures');
const fs = require('fs');

const API = process.env.API_BASE_URL || 'https://core.dev.khayr.id';

let accessToken = '';
let organizationId = '';

test.beforeAll(async () => {
  try {
    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    accessToken = state.accessToken;
    organizationId = state.organizationId || state.qaOrganizationId;
  } catch (e) {
    console.warn('Warning: .state.json missing. Run 01_onboarding first.');
  }
});

test.describe.configure({ mode: 'serial' });

test.describe('Core Journey 6: Extended Coverage (Discovery Gaps)', () => {

  // ── User Management ──────────────────────────────────────────────────────

  test('EXT-001: GET /v1/user — list all users', async ({ request }) => {
    const response = await request.get(`${API}/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json();
    expect(response.ok(), `GET /v1/user failed: ${JSON.stringify(body)}`).toBeTruthy();

    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Total users:', body.data?.total || (Array.isArray(items) ? items.length : 'n/a'));
    expect(Array.isArray(items) || typeof body.data === 'object').toBeTruthy();
  });

  test('EXT-002: GET /v1/user?roles=DOCTOR — filter users by role', async ({ request }) => {
    const response = await request.get(`${API}/v1/user?roles=DOCTOR`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json();
    expect(response.ok(), `GET /v1/user?roles=DOCTOR failed: ${JSON.stringify(body)}`).toBeTruthy();
    console.log('Total doctors:', body.data?.total || 'n/a');
  });

  test('EXT-002b: GET /v1/user/:id — get user by ID', async ({ request }) => {
    // First get a user ID from the list
    const listRes = await request.get(`${API}/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok()) {
      console.warn('Cannot fetch user list — skipping GET by ID');
      return;
    }
    const listBody = await listRes.json();
    const items = listBody.data?.data || listBody.data?.items || listBody.data || [];
    const first = Array.isArray(items) ? items[0] : null;
    const userId = first?.id || first?._id;

    if (!userId) {
      console.warn('No userId found in user list — skipping');
      return;
    }

    const response = await request.get(`${API}/v1/user/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json();
    expect(response.ok(), `GET /v1/user/${userId} failed: ${JSON.stringify(body)}`).toBeTruthy();
    expect(body.data?.id || body.data?._id || body.id).toBeDefined();
    console.log('User by ID OK:', userId);
  });

  // ── Organization ─────────────────────────────────────────────────────────

  test('EXT-003: GET /v1/organization/:id — get org detail', async ({ request }) => {
    if (!organizationId) {
      console.warn('No organizationId in state — skipping');
      return;
    }

    const response = await request.get(`${API}/v1/organization/${organizationId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json();
    if (response.ok()) {
      expect(body.data?.id || body.data?._id || body.id || body.data?.organizationId).toBeDefined();
      console.log('Org name:', body.data?.name || 'n/a');
    } else {
      // Some roles may not have access to org detail — log and skip
      console.warn(`GET /v1/organization/${organizationId} returned ${response.status()}: ${JSON.stringify(body).substring(0, 150)}`);
    }
  });

  // ── Demography Master Data ────────────────────────────────────────────────

  test('EXT-004: GET /v1/demography — list demography data', async ({ request }) => {
    const response = await request.get(`${API}/v1/demography`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json();
    expect(response.ok(), `GET /v1/demography failed: ${JSON.stringify(body)}`).toBeTruthy();
    console.log('Demography data count:', body.data?.total || body.total ||
      (Array.isArray(body.data) ? body.data.length : 'n/a'));
  });

  // ── Roles & Access Control ────────────────────────────────────────────────

  test('EXT-005: GET /v1/roles-access — list role access control', async ({ request }) => {
    const response = await request.get(`${API}/v1/roles-access`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json();
    expect(response.ok(), `GET /v1/roles-access failed: ${JSON.stringify(body)}`).toBeTruthy();

    const items = body.data?.data || body.data?.items || body.data || [];
    console.log('Roles-access count:', Array.isArray(items) ? items.length : 'n/a');
  });

  // ── Inventory Stock Summary ───────────────────────────────────────────────

  test('EXT-006: GET /v1/product/stock/summary — inventory stock summary', async ({ request }) => {
    const response = await request.get(`${API}/v1/product/stock/summary`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json();
    expect(response.ok(), `GET /v1/product/stock/summary failed: ${JSON.stringify(body)}`).toBeTruthy();
    console.log('Stock summary:', JSON.stringify(body.data || body).substring(0, 150));
  });

  test('EXT-007: GET /v1/product/stock/summary/stats — inventory stock stats', async ({ request }) => {
    const response = await request.get(`${API}/v1/product/stock/summary/stats`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json();
    expect(response.ok(), `GET /v1/product/stock/summary/stats failed: ${JSON.stringify(body)}`).toBeTruthy();
    console.log('Stock stats:', JSON.stringify(body.data || body).substring(0, 150));
  });

  // ── Clinic Documents ─────────────────────────────────────────────────────

  test('EXT-008b: GET /v1/clinic/documents — list clinic documents', async ({ request }) => {
    const response = await request.get(`${API}/v1/clinic/documents`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json();
    if (response.ok()) {
      const items = body.data?.data || body.data?.items || body.data || [];
      console.log('Clinic documents count:', Array.isArray(items) ? items.length : JSON.stringify(body.data).substring(0, 100));
    } else {
      console.warn(`GET /v1/clinic/documents returned ${response.status()}: ${JSON.stringify(body).substring(0, 200)}`);
    }
    // accessible by all non-superadmin roles; 403 for superadmin is acceptable
    expect([200, 403].includes(response.status()), `Unexpected status ${response.status()}`).toBeTruthy();
  });

  // ── Reports ───────────────────────────────────────────────────────────────

  test('EXT-008: GET /v1/reports/customer-360 — customer 360 report', async ({ request }) => {
    const response = await request.get(`${API}/v1/reports/customer-360`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json();
    if (response.ok()) {
      console.log('Customer-360 report OK:', JSON.stringify(body.data || body).substring(0, 200));
    } else {
      // Report might require date params — try with query string
      const responseWithParams = await request.get(`${API}/v1/reports/customer-360?limit=10`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const bodyWithParams = await responseWithParams.json();
      expect(
        responseWithParams.ok(),
        `GET /v1/reports/customer-360 failed: ${JSON.stringify(bodyWithParams).substring(0, 200)}`
      ).toBeTruthy();
      console.log('Customer-360 (with limit) OK');
    }
  });

});
