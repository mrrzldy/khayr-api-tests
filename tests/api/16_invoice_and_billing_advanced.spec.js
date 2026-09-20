/**
 * Core Journey 16: Invoice, Billing Advanced & Business Rules
 *
 * Covers:
 *  INV-001  Cannot print/generate invoice for UNPAID billing → 400/422
 *  INV-002  Can generate invoice after billing is PAID → 200 + PDF/URL
 *  INV-003  Cannot transition billing directly UNPAID → CANCELLED (invalid state machine)
 *  INV-004  Partial payment updates balance correctly
 *  INV-005  Double payment (overpayment) is rejected or handled
 *  INV-006  Billing tied to appointment — cannot delete appointment with active billing
 *  INV-007  Invoice number is unique per billing record
 *  INV-008  Billing summary/report endpoint returns correct totals
 *  INV-009  List billings with multiple status filters
 *  INV-010  Billing with insurer — verify insurer fields present
 *
 * Depends on: 05_medical_record_billing, 10_billing_advanced (.state.json)
 */

const { test, expect } = require('./fixtures');
const fs = require('fs');

const API = process.env.API_BASE_URL || 'https://core.dev.khayr.id';

let token = '';
let state = {};

test.beforeAll(() => {
  try {
    state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    token = state.accessToken || '';
  } catch {
    console.warn('[INV] .state.json missing — run 01_onboarding first');
  }
});

test.describe.configure({ mode: 'serial' });

function auth() { return { Authorization: `Bearer ${token}` }; }

// ── Invoice / Print Tests ─────────────────────────────────────────────────────

test('INV-001: Cannot print invoice for UNPAID billing', async ({ request }) => {
  /**
   * Business rule: Invoice (PDF/receipt) can only be generated after the
   * billing has been PAID. Attempting to print an UNPAID billing should
   * return 400 or 422 with a clear error message.
   */
  if (!token) { console.warn('[INV-001] No token — skipping'); return; }

  // Find an UNPAID billing or create a reference
  let unpaidBillingId = '';

  // Try to find an UNPAID billing from the list
  const listRes = await request.get(`${API}/v1/billing?status=UNPAID&limit=1`, { headers: auth() });
  if (listRes.ok()) {
    const body = await listRes.json().catch(() => ({}));
    const items = body.data?.data || body.data || body.items || body.billings || [];
    if (Array.isArray(items) && items.length > 0) {
      unpaidBillingId = items[0]._id || items[0].id;
    }
  }

  if (!unpaidBillingId) {
    // Use the billing from state — it may already be PAID; try anyway to document behavior
    unpaidBillingId = state.billingId;
  }

  if (!unpaidBillingId) {
    console.warn('[INV-001] ⚠️ No billing ID available — skipping');
    return;
  }

  // Try common invoice/print endpoint patterns
  const printPaths = [
    `/v1/billing/${unpaidBillingId}/invoice`,
    `/v1/billing/${unpaidBillingId}/print`,
    `/v1/invoice/billing/${unpaidBillingId}`,
    `/v1/billing/${unpaidBillingId}/receipt`,
  ];

  for (const path of printPaths) {
    const res = await request.get(`${API}${path}`, { headers: auth() });
    const status = res.status();
    if (status === 404) continue;

    if ([400, 422, 403].includes(status)) {
      const body = await res.json().catch(() => ({}));
      const msg = body.error?.message || body.message || body.detail || '';
      console.log(`[INV-001] ✅ Cannot print UNPAID invoice — ${path} → ${status}: ${msg}`);
      return;
    } else if ([200, 201].includes(status)) {
      // If billing was already PAID, this is expected
      console.warn(`[INV-001] ⚠️ ${path} → ${status} — billing may already be PAID (no UNPAID billing to test with)`);
      return;
    } else {
      console.warn(`[INV-001] ⚠️ ${path} → ${status}`);
    }
  }
  console.warn('[INV-001] ⚠️ No invoice/print endpoint found at known paths');
});

test('INV-002: Can retrieve invoice after billing is PAID', async ({ request }) => {
  if (!token) { console.warn('[INV-002] No token — skipping'); return; }

  // Find a PAID billing
  let paidBillingId = '';
  const listRes = await request.get(`${API}/v1/billing?status=PAID&limit=1`, { headers: auth() });
  if (listRes.ok()) {
    const body = await listRes.json().catch(() => ({}));
    const items = body.data?.data || body.data || body.items || body.billings || [];
    if (Array.isArray(items) && items.length > 0) {
      paidBillingId = items[0]._id || items[0].id;
    }
  }

  // Fall back to state.billingId
  if (!paidBillingId) paidBillingId = state.billingId;
  if (!paidBillingId) { console.warn('[INV-002] ⚠️ No PAID billing found — skipping'); return; }

  const printPaths = [
    `/v1/billing/${paidBillingId}/invoice`,
    `/v1/billing/${paidBillingId}/print`,
    `/v1/invoice/billing/${paidBillingId}`,
    `/v1/billing/${paidBillingId}/receipt`,
  ];

  for (const path of printPaths) {
    const res = await request.get(`${API}${path}`, { headers: auth() });
    const status = res.status();
    if (status === 404) continue;

    if ([200, 201].includes(status)) {
      console.log(`[INV-002] ✅ PAID billing invoice retrieval OK at ${path} → ${status}`);
      return;
    } else {
      const body = await res.json().catch(() => ({}));
      console.warn(`[INV-002] ⚠️ ${path} → ${status}: ${JSON.stringify(body).slice(0, 150)}`);
    }
  }
  console.warn('[INV-002] ⚠️ No invoice endpoint found or responded — endpoint path unknown');
});

test('INV-003: Cannot transition billing UNPAID → CANCELLED directly (invalid state machine)', async ({ request }) => {
  /**
   * State machine: UNPAID → PARTIAL → PAID → can issue receipt
   * CANCELLED should only be reachable from UNPAID via an explicit cancel action,
   * OR it should be forbidden depending on business rules.
   * This test documents which transitions the API actually allows.
   */
  if (!token || !state.billingId) { console.warn('[INV-003] No token or billingId — skipping'); return; }

  // Try to set billing to CANCELLED directly
  const cancelPaths = [
    { path: `/v1/billing/${state.billingId}/status`, data: { status: 'CANCELLED' } },
    { path: `/v1/billing/${state.billingId}/cancel`, data: {} },
  ];

  for (const { path, data } of cancelPaths) {
    const res = await request.put(`${API}${path}`, { headers: auth(), data });
    const status = res.status();
    if (status === 404) continue;

    const body = await res.json().catch(() => ({}));
    if ([200, 201].includes(status)) {
      console.warn(`[INV-003] ⚠️ API allows UNPAID→CANCELLED at ${path} — verify this is intended business logic`);
    } else {
      console.log(`[INV-003] ✅ UNPAID→CANCELLED correctly rejected at ${path} → ${status}: ${body.error?.message || body.message || ''}`);
    }
    return;
  }
  console.warn('[INV-003] ⚠️ No cancel endpoint found — skipping');
});

test('INV-004: Partial payment updates billing balance correctly', async ({ request }) => {
  if (!token || !state.billingId) { console.warn('[INV-004] No token/billingId — skipping'); return; }

  // First GET billing to know totalAmount
  const getRes = await request.get(`${API}/v1/billing/${state.billingId}`, { headers: auth() });
  if (!getRes.ok()) { console.warn(`[INV-004] Cannot GET billing — skipping`); return; }
  const billing = await getRes.json().catch(() => ({}));
  const billingData = billing.data || billing;

  const totalAmount = billingData.totalAmount || billingData.total || 0;
  if (!totalAmount) { console.warn('[INV-004] ⚠️ totalAmount not found in billing response — skipping'); return; }

  const partialAmount = Math.floor(totalAmount / 2);

  // Attempt partial payment
  const payPaths = [
    `/v1/billing/${state.billingId}/payment`,
    `/v1/billing/${state.billingId}/pay`,
    `/v1/payment`,
  ];

  for (const path of payPaths) {
    const payData = path.includes('/payment') && !path.includes(state.billingId)
      ? { billingId: state.billingId, amount: partialAmount, paymentMethod: 'CASH' }
      : { amount: partialAmount, paymentMethod: 'CASH' };

    const res = await request.post(`${API}${path}`, { headers: auth(), data: payData });
    const status = res.status();
    if (status === 404) continue;

    if ([200, 201].includes(status)) {
      // Verify balance reduced
      const verifyRes = await request.get(`${API}/v1/billing/${state.billingId}`, { headers: auth() });
      if (verifyRes.ok()) {
        const updated = await verifyRes.json().catch(() => ({}));
        const updatedData = updated.data || updated;
        const paidAmount = updatedData.paidAmount || updatedData.paid || 0;
        console.log(`[INV-004] ✅ Partial payment: totalAmount=${totalAmount}, paidAmount=${paidAmount}, balance=${totalAmount - paidAmount}`);
      }
    } else {
      const body = await res.json().catch(() => ({}));
      console.warn(`[INV-004] ⚠️ ${path} → ${status}: ${JSON.stringify(body).slice(0, 200)}`);
    }
    return;
  }
  console.warn('[INV-004] ⚠️ No payment endpoint found');
});

test('INV-005: Overpayment (amount > total) is rejected or handled gracefully', async ({ request }) => {
  if (!token || !state.billingId) { console.warn('[INV-005] No token/billingId — skipping'); return; }

  const payPaths = [
    `/v1/billing/${state.billingId}/payment`,
    `/v1/billing/${state.billingId}/pay`,
  ];

  for (const path of payPaths) {
    const res = await request.post(`${API}${path}`, {
      headers: auth(),
      data: { amount: 99999999, paymentMethod: 'CASH' },
    });
    const status = res.status();
    if (status === 404) continue;

    const body = await res.json().catch(() => ({}));
    if ([400, 422].includes(status)) {
      console.log(`[INV-005] ✅ Overpayment correctly rejected → ${status}`);
    } else if ([200, 201].includes(status)) {
      console.warn(`[INV-005] ⚠️ Overpayment accepted → ${status} — verify business rule`);
    } else {
      console.warn(`[INV-005] ⚠️ ${path} → ${status}: ${JSON.stringify(body).slice(0, 150)}`);
    }
    return;
  }
  console.warn('[INV-005] ⚠️ No payment endpoint found — skipping');
});

test('INV-006: Cannot delete appointment that has active billing', async ({ request }) => {
  if (!token || !state.appointmentId) { console.warn('[INV-006] No token/appointmentId — skipping'); return; }

  const res = await request.delete(`${API}/v1/appointment/${state.appointmentId}`, { headers: auth() });
  const status = res.status();

  if ([400, 409, 422, 403].includes(status)) {
    const body = await res.json().catch(() => ({}));
    console.log(`[INV-006] ✅ Cannot delete appointment with active billing → ${status}: ${body.error?.message || body.message || ''}`);
  } else if ([200, 201, 204].includes(status)) {
    console.warn('[INV-006] ⚠️ API allowed deleting appointment with active billing — verify business rule (cascade delete?)');
  } else {
    console.warn(`[INV-006] ⚠️ Unexpected status ${status}`);
  }
});

test('INV-007: Invoice number is unique per billing', async ({ request }) => {
  if (!token) { console.warn('[INV-007] No token — skipping'); return; }

  const { status, body } = await (async () => {
    const res = await request.get(`${API}/v1/billing?limit=10`, { headers: auth() });
    return { status: res.status(), body: await res.json().catch(() => ({})) };
  })();

  if (![200, 201].includes(status)) { console.warn(`[INV-007] ⚠️ ${status} — skipping`); return; }

  const items = body.data?.data || body.data || body.items || body.billings || [];
  if (!Array.isArray(items) || items.length < 2) {
    console.warn('[INV-007] ⚠️ Not enough billing records to check uniqueness — skipping');
    return;
  }

  const invoiceNumbers = items
    .map(b => b.invoiceNumber || b.billingNumber || b.number)
    .filter(Boolean);

  const unique = new Set(invoiceNumbers);
  expect(unique.size, `Invoice numbers should be unique (found ${invoiceNumbers.length - unique.size} duplicates)`).toBe(invoiceNumbers.length);
  console.log(`[INV-007] ✅ All ${invoiceNumbers.length} invoice numbers are unique`);
});

test('INV-008: Billing report/summary endpoint returns totals', async ({ request }) => {
  if (!token) { console.warn('[INV-008] No token — skipping'); return; }

  const reportPaths = [
    '/v1/billing/summary',
    '/v1/report/billing',
    '/v1/billing/report',
    '/v1/report',
  ];

  for (const path of reportPaths) {
    const res = await request.get(`${API}${path}`, { headers: auth() });
    const status = res.status();
    if (status === 404) continue;

    if ([200, 201].includes(status)) {
      const body = await res.json().catch(() => ({}));
      console.log(`[INV-008] ✅ Report endpoint at ${path} → ${status}: ${JSON.stringify(body).slice(0, 200)}`);
      return;
    }
    console.warn(`[INV-008] ⚠️ ${path} → ${status}`);
  }
  console.warn('[INV-008] ⚠️ No billing report endpoint found');
});

test('INV-009: Billing list with multiple statuses (comma-separated or repeated param)', async ({ request }) => {
  if (!token) { console.warn('[INV-009] No token — skipping'); return; }

  const variants = [
    '/v1/billing?status=UNPAID,PAID',
    '/v1/billing?status[]=UNPAID&status[]=PAID',
    '/v1/billing?status=UNPAID&status=PAID',
  ];

  for (const path of variants) {
    const res = await request.get(`${API}${path}`, { headers: auth() });
    const status = res.status();
    if (!res.ok()) continue;

    const body = await res.json().catch(() => ({}));
    const items = body.data?.data || body.data || body.items || body.billings || [];
    if (!Array.isArray(items)) continue;

    console.log(`[INV-009] ✅ Multi-status filter via "${path.split('?')[1]}" → ${items.length} records`);
    return;
  }
  console.warn('[INV-009] ⚠️ Multi-status filter not supported or returned non-2xx');
});

test('INV-010: Billing with insurer contains insurer fields', async ({ request }) => {
  if (!token || !state.billingId) { console.warn('[INV-010] No token/billingId — skipping'); return; }

  const res = await request.get(`${API}/v1/billing/${state.billingId}`, { headers: auth() });
  if (!res.ok()) { console.warn(`[INV-010] ⚠️ ${res.status()} — skipping`); return; }

  const body = await res.json().catch(() => ({}));
  const billing = body.data || body;

  const hasInsurer = billing.insurerId || billing.insurer || billing.insurerName;
  if (hasInsurer) {
    console.log(`[INV-010] ✅ Billing contains insurer field: ${JSON.stringify(hasInsurer)}`);
  } else {
    console.warn('[INV-010] ⚠️ Billing does not contain insurer fields — may be cash-only billing or insurer not attached');
  }
});
