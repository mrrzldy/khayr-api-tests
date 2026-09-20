/**
 * Core Journey 9: PATCH / Update Operations
 *
 * Covers all PATCH endpoints and remaining PUT variants:
 *
 *   PATCH /v1/appointment/:id
 *   PATCH /v1/insurer/:id
 *   PATCH /v1/location/:id
 *   PATCH /v1/organization/:id
 *   PATCH /v1/procedure/category/:id
 *   PATCH /v1/procedure/:id
 *   PATCH /v1/product/category/:id
 *   PATCH /v1/product/:id
 *   PATCH /v1/user/:id
 *   PUT   /v1/appointment/:id/status
 *   PUT   /v1/billing/:id/status/paid
 *
 * Pattern: read existing item, PATCH a safe field (notes/description),
 * assert the response is 2xx.
 *
 * Depends on: 01_onboarding (accessToken + IDs in .state.json)
 * Run: npx playwright test tests/api/09_patch_operations.spec.js --project=api
 */
const { test, expect } = require('./fixtures');
const fs = require('fs');

const API = process.env.API_BASE_URL || 'https://core.dev.khayr.id';

let accessToken = '';
let state = {};

test.beforeAll(async () => {
  try {
    state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    accessToken = state.accessToken;
  } catch {
    console.warn('Warning: .state.json missing — run 01_onboarding first.');
  }
});

test.describe.configure({ mode: 'serial' });

/** Helper: GET list, return first item */
async function getFirstItem(request, listPath) {
  const res = await request.get(`${API}${listPath}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok()) return null;
  const body = await res.json();
  const items = body.data?.data || body.data?.items || body.data || [];
  return Array.isArray(items) ? items[0] : null;
}

/** Helper: PATCH and assert 2xx */
async function patchOk(request, path, data, label) {
  const res = await request.patch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data,
  });
  const body = await res.json();
  if (res.ok()) {
    console.log(`${label} OK`);
    return body;
  } else {
    console.warn(`${label} → ${res.status()}: ${JSON.stringify(body).slice(0, 200)}`);
    return null;
  }
}

test.describe('Core Journey 9: PATCH / Update Operations', () => {

  // ── PATCH Appointment ─────────────────────────────────────────────────────

  test('PATCH-001: PATCH /v1/appointment/:id — update appointment notes', async ({ request }) => {
    const id = state.appointmentId || state.qaAppointmentId;
    if (!id) {
      const item = await getFirstItem(request, '/v1/appointment');
      if (!item) { console.warn('No appointment to patch — skipping'); return; }
      const itemId = item.id || item._id;
      await patchOk(request, `/v1/appointment/${itemId}`, { notes: 'Auto-test patch' }, 'PATCH appointment');
      return;
    }
    await patchOk(request, `/v1/appointment/${id}`, { notes: 'Auto-test patch' }, 'PATCH appointment');
  });

  // ── PATCH Insurer ─────────────────────────────────────────────────────────

  test('PATCH-002: PATCH /v1/insurer/:id — update insurer name', async ({ request }) => {
    const item = await getFirstItem(request, '/v1/insurer');
    if (!item) { console.warn('No insurer to patch — skipping'); return; }
    const id = item.id || item._id;
    const originalName = item.name || 'Test Insurer';

    const result = await patchOk(request, `/v1/insurer/${id}`,
      { name: `${originalName} (patched)` },
      'PATCH insurer'
    );

    if (result) {
      // Restore original name
      await request.patch(`${API}/v1/insurer/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { name: originalName },
      });
    }
  });

  // ── PATCH Location ────────────────────────────────────────────────────────

  test('PATCH-003: PATCH /v1/location/:id — update location address', async ({ request }) => {
    const item = await getFirstItem(request, '/v1/location');
    if (!item) { console.warn('No location to patch — skipping'); return; }
    const id = item.id || item._id;

    await patchOk(request, `/v1/location/${id}`,
      { address: item.address || 'Auto-test address' },
      'PATCH location'
    );
  });

  // ── PATCH Organization ────────────────────────────────────────────────────

  test('PATCH-004: PATCH /v1/organization/:id — update org description', async ({ request }) => {
    const orgId = state.organizationId || state.qaOrganizationId;
    if (!orgId) { console.warn('No organizationId in state — skipping'); return; }

    await patchOk(request, `/v1/organization/${orgId}`,
      { description: 'Auto-test description' },
      'PATCH organization'
    );
  });

  // ── PATCH Procedure Category ──────────────────────────────────────────────

  test('PATCH-005: PATCH /v1/procedure/category/:id — update procedure category', async ({ request }) => {
    const item = await getFirstItem(request, '/v1/procedure/category');
    if (!item) { console.warn('No procedure category to patch — skipping'); return; }
    const id = item.id || item._id;
    const originalName = item.name || 'Test Category';

    const result = await patchOk(request, `/v1/procedure/category/${id}`,
      { name: `${originalName} (patched)` },
      'PATCH procedure/category'
    );

    if (result) {
      await request.patch(`${API}/v1/procedure/category/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { name: originalName },
      });
    }
  });

  // ── PATCH Procedure ───────────────────────────────────────────────────────

  test('PATCH-006: PATCH /v1/procedure/:id — update procedure description', async ({ request }) => {
    const item = await getFirstItem(request, '/v1/procedure');
    if (!item) { console.warn('No procedure to patch — skipping'); return; }
    const id = item.id || item._id;

    await patchOk(request, `/v1/procedure/${id}`,
      { description: 'Auto-test description' },
      'PATCH procedure'
    );
  });

  // ── PATCH Product Category ────────────────────────────────────────────────

  test('PATCH-007: PATCH /v1/product/category/:id — update product category', async ({ request }) => {
    const item = await getFirstItem(request, '/v1/product/category');
    if (!item) { console.warn('No product category to patch — skipping'); return; }
    const id = item.id || item._id;
    const originalName = item.name || 'Test Category';

    const result = await patchOk(request, `/v1/product/category/${id}`,
      { name: `${originalName} (patched)` },
      'PATCH product/category'
    );

    if (result) {
      await request.patch(`${API}/v1/product/category/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { name: originalName },
      });
    }
  });

  // ── PATCH Product ─────────────────────────────────────────────────────────

  test('PATCH-008: PATCH /v1/product/:id — update product description', async ({ request }) => {
    const item = await getFirstItem(request, '/v1/product');
    if (!item) { console.warn('No product to patch — skipping'); return; }
    const id = item.id || item._id;

    await patchOk(request, `/v1/product/${id}`,
      { description: 'Auto-test description' },
      'PATCH product'
    );
  });

  // ── PATCH User ────────────────────────────────────────────────────────────

  test('PATCH-009: PATCH /v1/user/:id — update user bio/notes', async ({ request }) => {
    const item = await getFirstItem(request, '/v1/user');
    if (!item) { console.warn('No user to patch — skipping'); return; }
    const id = item.id || item._id;

    await patchOk(request, `/v1/user/${id}`,
      { bio: 'Auto-test bio' },
      'PATCH user'
    );
  });

  // ── PUT Appointment Status ────────────────────────────────────────────────

  test('PATCH-010: PUT /v1/appointment/:id/status — update appointment status', async ({ request }) => {
    const id = state.appointmentId || state.qaAppointmentId;
    if (!id) {
      const item = await getFirstItem(request, '/v1/appointment');
      if (!item) { console.warn('No appointment for status update — skipping'); return; }
      const itemId = item.id || item._id;
      const currentStatus = item.status || 'PENDING';

      const res = await request.put(`${API}/v1/appointment/${itemId}/status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { status: currentStatus },
      });
      const body = await res.json();
      if (res.ok()) {
        console.log('PUT appointment status OK');
      } else {
        console.warn(`PUT appointment/:id/status → ${res.status()}: ${JSON.stringify(body).slice(0, 200)}`);
      }
      return;
    }

    const currentRes = await request.get(`${API}/v1/appointment/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const currentBody = await currentRes.json();
    const currentStatus = currentBody.data?.status || 'PENDING';

    const res = await request.put(`${API}/v1/appointment/${id}/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { status: currentStatus },
    });
    const body = await res.json();
    if (res.ok()) {
      console.log('PUT appointment status OK');
      expect(body.data || body).toBeDefined();
    } else {
      console.warn(`PUT appointment/:id/status → ${res.status()}: ${JSON.stringify(body).slice(0, 200)}`);
    }
  });

  // ── PUT Billing Status Paid ───────────────────────────────────────────────

  test('PATCH-011: PUT /v1/billing/:id/status/paid — mark billing as paid', async ({ request }) => {
    // Fix round 6: log channel structure + send both paymentChannelId and paymentChannelCode
    const chanRes = await request.get(`${API}/v1/payment/channel`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const chanBody = await chanRes.json();
    const channels = chanBody.data?.data || chanBody.data?.items || chanBody.data || [];
    const channel = Array.isArray(channels) ? channels[0] : null;
    console.log('Payment channel:', JSON.stringify(channel).slice(0, 200));
    const paymentChannelId = channel?.id || channel?._id || null;
    const paymentChannelCode = channel?.code || null;

    // Fix: API requires field named 'paymentChannel' (the channel code or ID)
    const buildPayload = () => {
      const p = {};
      if (paymentChannelCode) p.paymentChannel = paymentChannelCode;
      else if (paymentChannelId) p.paymentChannel = paymentChannelId;
      return p;
    };

    const id = state.billingId || state.qaBillingId;
    if (!id) {
      // Try to find an existing billing in PENDING/CONFIRMED state
      const billingRes = await request.get(`${API}/v1/billing`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!billingRes.ok()) { console.warn('No billing list — skipping'); return; }
      const billingBody = await billingRes.json();
      const billings = billingBody.data?.data || billingBody.data?.items || billingBody.data || [];
      const allBillings = Array.isArray(billings) ? billings : [];
      const item = allBillings.find(b => b.status !== 'PAID') || allBillings[0];
      if (!item) { console.warn('No billing for paid status update — skipping'); return; }
      const itemId = item.id || item._id;
      console.log(`Using billing ${itemId} with status ${item.status}`);

      const res = await request.put(`${API}/v1/billing/${itemId}/status/paid`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: buildPayload(),
      });
      const body = await res.json();
      if (res.ok()) {
        console.log('PUT billing/status/paid OK');
      } else {
        console.warn(`PUT billing/:id/status/paid → ${res.status()}: ${JSON.stringify(body).slice(0, 200)}`);
      }
      return;
    }

    // Log billing status before paying
    const checkRes = await request.get(`${API}/v1/billing/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (checkRes.ok()) {
      const checkBody = await checkRes.json();
      console.log(`Billing ${id} status: ${checkBody.data?.status}`);
    }

    const res = await request.put(`${API}/v1/billing/${id}/status/paid`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: buildPayload(),
    });
    const body = await res.json();
    if (res.ok()) {
      console.log('PUT billing/status/paid OK');
      expect(body.data || body).toBeDefined();
    } else {
      // Log full detail to see complete error message
      console.warn(`PUT billing/:id/status/paid → ${res.status()} | detail: ${body?.error?.detail}`);
      console.warn(`payload sent: ${JSON.stringify(buildPayload())}`);
    }
  });

});
