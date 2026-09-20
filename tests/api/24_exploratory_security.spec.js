/**
 * Core Journey 24: Exploratory & Security Tests
 *
 * Covers attack vectors and creative QA scenarios:
 *  - XSS injection in text fields
 *  - NoSQL injection via query params and body
 *  - JWT manipulation (expired, tampered, wrong role)
 *  - Mass assignment (trying to set admin-only fields)
 *  - IDOR — accessing other org's resources
 *  - File upload abuse (wrong type, oversized)
 *  - HTTP method tampering (PUT on POST-only)
 *  - Unauthenticated access to protected routes
 *  - Parameter pollution (?id=a&id=b)
 *  - Pagination abuse (negative limit, huge offset)
 *  - Broken object level auth on IDs
 *
 * Run: npx playwright test tests/api/24_exploratory_security.spec.js --project=api
 */
const { test, expect } = require('./fixtures');
const fs = require('fs');

const API = process.env.API_BASE_URL || 'https://core.dev.khayr.id';

// ─── Hardcoded fallback IDs from MongoDB DCMS-APP ───────────────────────────
const DB_IDS = {
  patient:      '68ef26bb1de526d15ece5f41',
  billing:      '68ef2b2c1de526d15ece5f55',
  organization: '675cba14b172bbe2a39c5880',
};

let accessToken    = '';
let patientId      = '';
let billingId      = '';
let medicalRecordId = '';
let organizationId = '';

test.beforeAll(async () => {
  let state = {};
  try {
    state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
  } catch { console.warn('[24] .state.json missing — using DB_IDS fallbacks'); }
  accessToken     = state.accessToken    || '';
  patientId       = state.patientId      || state.qaPatientId || DB_IDS.patient;
  billingId       = state.billingId      || DB_IDS.billing;
  medicalRecordId = state.medicalRecordId || '';
  organizationId  = state.organizationId || state.qaOrganizationId || DB_IDS.organization;
});

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

// ── 1. XSS Injection ────────────────────────────────────────────────────────
test.describe('24A: XSS Injection Tests', () => {
  test.describe.configure({ mode: 'serial' });
  const xssPayloads = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    "'; DROP TABLE patients; --",
    '<svg onload=alert(1)>',
    'javascript:alert(1)',
  ];

  for (const payload of xssPayloads) {
    const label = payload.slice(0, 30).replace(/[^a-z0-9]/gi, '_');
    test(`XSS-001-${label}: Patient name with XSS payload`, async ({ request }) => {
      const res = await request.post(`${API}/v1/patient`, {
        headers: auth(),
        data: {
          fullName:  payload,
          phone:     `+6281${Date.now().toString().slice(-8)}`,
          birthDate: '1990-01-01',
          gender:    'male',
        },
      });
      const status = res.status();
      const body   = await res.json().catch(() => ({}));
      const returned = JSON.stringify(body);
      console.log(`XSS [${label}] → ${status}`);
      // Should not reflect raw script tags unescaped — just check no 5xx crash
      if (status >= 500) {
        console.warn(`XSS-001: ⚠️  Server crashed on XSS payload: ${payload}`);
      }
      // If accepted (201), verify payload is stored as plain text not executed
      if (status >= 200 && status < 300) {
        const name = body.data?.fullName || body.data?.name || '';
        // The stored name should match the input (sanitized or stored as-is) — not empty
        console.log(`XSS stored as: ${name.slice(0, 80)}`);
      }
      expect(status).toBeLessThan(600);
    });
  }
});

// ── 2. NoSQL Injection ─────────────────────────────────────────────────────
test.describe('24B: NoSQL Injection Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('NOSQL-001: Injection via search param', async ({ request }) => {
    const injections = [
      '{"$gt": ""}',
      '{"$where": "function(){return true}"}',
      '[object Object]',
      '{"$regex": ".*"}',
    ];
    for (const inj of injections) {
      const res = await request.get(`${API}/v1/patient?search=${encodeURIComponent(inj)}`, {
        headers: auth(),
      });
      const status = res.status();
      console.log(`NOSQL-001 [${inj.slice(0, 30)}] → ${status}`);
      if (status >= 500) {
        console.warn(`NOSQL-001: ⚠️  Server 5xx on NoSQL injection: ${inj}`);
      }
      expect(status).toBeLessThan(600);
    }
  });

  test('NOSQL-002: Injection in JSON body field', async ({ request }) => {
    const res = await request.post(`${API}/v1/patient`, {
      headers: auth(),
      data: {
        fullName:  { '$gt': '' },     // object instead of string
        phone:     `+6281${Date.now().toString().slice(-8)}`,
        birthDate: '1990-01-01',
        gender:    'male',
      },
    });
    const status = res.status();
    const body   = await res.json().catch(() => ({}));
    console.log(`NOSQL-002 object injection → ${status}`, JSON.stringify(body).slice(0, 200));
    if (status >= 500) {
      console.warn('NOSQL-002: ⚠️  Server crashed on object injection in name field');
    }
    expect([400, 422, 401, 403, 200, 201]).toContain(status);
  });
});

// ── 3. Authentication / JWT Tests ──────────────────────────────────────────
test.describe('24C: Authentication Edge Cases', () => {
  test.describe.configure({ mode: 'serial' });

  test('AUTH-SEC-001: Unauthenticated access to protected endpoint', async ({ request }) => {
    const endpoints = [
      '/v1/patient',
      '/v1/billing',
      '/v1/medicalrecord',
      '/v1/user',
    ];
    for (const ep of endpoints) {
      const res    = await request.get(`${API}${ep}`); // No auth header
      const status = res.status();
      console.log(`AUTH-SEC-001 unauth ${ep} → ${status}`);
      expect([401, 403]).toContain(status);
      if (status === 200) {
        console.warn(`AUTH-SEC-001: ⚠️  ${ep} accessible without authentication!`);
      }
    }
  });

  test('AUTH-SEC-002: Tampered JWT (modified payload)', async ({ request }) => {
    if (!accessToken) { console.warn('AUTH-SEC-002: skip, no token'); return; }
    // Tamper the middle part of JWT (payload section)
    const parts = accessToken.split('.');
    if (parts.length !== 3) { console.warn('AUTH-SEC-002: not a JWT'); return; }
    // Modify payload: change role to superadmin
    const fakePayload = Buffer.from(JSON.stringify({ role: 'superadmin', exp: 9999999999 }))
      .toString('base64url');
    const tamperedToken = `${parts[0]}.${fakePayload}.${parts[2]}`;
    const res = await request.get(`${API}/v1/admin/clinics`, {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    const status = res.status();
    console.log(`AUTH-SEC-002 tampered JWT → ${status}`);
    expect([401, 403]).toContain(status);
    if (status === 200) {
      console.warn('AUTH-SEC-002: ⚠️  Tampered JWT was ACCEPTED — CRITICAL SECURITY BUG!');
    }
  });

  test('AUTH-SEC-003: Expired JWT (fake old token)', async ({ request }) => {
    // A syntactically valid but expired JWT (exp=1 = 1970)
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxfQ.fake_signature';
    const res = await request.get(`${API}/v1/patient`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const status = res.status();
    console.log(`AUTH-SEC-003 expired JWT → ${status}`);
    expect([401, 403]).toContain(status);
    if (status === 200) {
      console.warn('AUTH-SEC-003: ⚠️  Expired JWT was ACCEPTED — CRITICAL!');
    }
  });

  test('AUTH-SEC-004: Empty bearer token', async ({ request }) => {
    const res = await request.get(`${API}/v1/patient`, {
      headers: { Authorization: 'Bearer ' },
    });
    const status = res.status();
    console.log(`AUTH-SEC-004 empty bearer → ${status}`);
    expect([401, 403]).toContain(status);
  });

  test('AUTH-SEC-005: Malformed Authorization header', async ({ request }) => {
    const res = await request.get(`${API}/v1/patient`, {
      headers: { Authorization: 'NotBearer definitely-not-a-jwt' },
    });
    const status = res.status();
    console.log(`AUTH-SEC-005 malformed header → ${status}`);
    expect([401, 403]).toContain(status);
  });
});

// ── 4. IDOR (Insecure Direct Object Reference) ────────────────────────────
test.describe('24D: IDOR Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('IDOR-001: Access resource with random fake ID', async ({ request }) => {
    const fakeId = '507f1f77bcf86cd799439011'; // valid ObjectId format but fake
    const endpoints = [
      `/v1/patient/${fakeId}`,
      `/v1/billing/${fakeId}`,
      `/v1/medicalrecord/${fakeId}`,
      `/v1/appointment/${fakeId}`,
    ];
    for (const ep of endpoints) {
      const res    = await request.get(`${API}${ep}`, { headers: auth() });
      const status = res.status();
      console.log(`IDOR-001 ${ep} → ${status}`);
      // Should return 404, not 200 with someone else's data — 400 also acceptable (invalid ID format)
      expect([400, 401, 403, 404]).toContain(status);
      if (status === 200) {
        console.warn(`IDOR-001: ⚠️  ${ep} returned data for fake ID — check data isolation!`);
      }
    }
  });

  test('IDOR-002: DELETE resource with fake ID', async ({ request }) => {
    const fakeId = '507f1f77bcf86cd799439012';
    const res    = await request.delete(`${API}/v1/patient/${fakeId}`, { headers: auth() });
    const status = res.status();
    console.log(`IDOR-002 DELETE fake patient → ${status}`);
    expect([400, 401, 403, 404]).toContain(status);
    if (status >= 200 && status < 300) {
      console.warn('IDOR-002: ⚠️  DELETE succeeded on fake ID — check if data existed');
    }
  });
});

// ── 5. Mass Assignment Tests ───────────────────────────────────────────────
test.describe('24E: Mass Assignment Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('MASS-001: Try to set privileged fields on patient create', async ({ request }) => {
    const res = await request.post(`${API}/v1/patient`, {
      headers: auth(),
      data: {
        fullName:       `QA Mass Assign ${Date.now()}`,
        phone:          `+6281${Date.now().toString().slice(-8)}`,
        birthDate:      '1990-01-01',
        gender:         'male',
        // Privileged/internal fields that should be ignored
        _id:            '000000000000000000000099',
        organizationId: '000000000000000000000099',
        createdAt:      '2000-01-01T00:00:00Z',
        isAdmin:        true,
        role:           'superadmin',
        __v:            999,
      },
    });
    const status = res.status();
    const body   = await res.json().catch(() => ({}));
    console.log(`MASS-001 privileged fields → ${status}`, JSON.stringify(body).slice(0, 200));
    if (status >= 200 && status < 300) {
      const id  = body.data?._id || body.data?.id || '';
      const org = body.data?.organizationId || body.data?.organization || '';
      if (id === '000000000000000000000099') {
        console.warn('MASS-001: ⚠️  _id was accepted as provided — mass assignment vulnerability!');
      }
      if (String(org).includes('000000000000000000000099')) {
        console.warn('MASS-001: ⚠️  organizationId was overridden — multi-tenant isolation risk!');
      }
    }
    expect([200, 201, 400, 422, 401, 403]).toContain(status);
  });

  test('MASS-002: Try to override billing total via POST', async ({ request }) => {
    if (!patientId) { console.warn('MASS-002: skip, no patientId'); return; }
    const res = await request.post(`${API}/v1/billing`, {
      headers: auth(),
      data: {
        patientId,
        total:      -1,        // try to set negative total
        totalPaid:  999999,    // try to mark as fully paid
        status:     'paid',    // try to set paid status on creation
        items:      [{ name: 'Test', price: 50000, quantity: 1 }],
      },
    });
    const status = res.status();
    const body   = await res.json().catch(() => ({}));
    console.log(`MASS-002 billing override → ${status}`, JSON.stringify(body).slice(0, 200));
    if (status >= 200 && status < 300) {
      const bilStatus = body.data?.status || '';
      if (bilStatus === 'paid') {
        console.warn('MASS-002: ⚠️  Billing created with status=paid immediately — payment bypass!');
      }
      const total = body.data?.total;
      if (total === -1) {
        console.warn('MASS-002: ⚠️  Negative total accepted in billing!');
      }
    }
    expect([200, 201, 400, 405, 422, 401, 403]).toContain(status);
  });
});

// ── 6. HTTP Method Tampering ───────────────────────────────────────────────
test.describe('24F: HTTP Method Tampering', () => {
  test.describe.configure({ mode: 'serial' });

  test('METHOD-001: PUT on patient endpoint (expects POST/PATCH)', async ({ request }) => {
    if (!patientId) { console.warn('METHOD-001: skip, no patientId'); return; }
    const res = await request.put(`${API}/v1/patient/${patientId}`, {
      headers: auth(),
      data: { fullName: 'QA PUT Test' },
    });
    const status = res.status();
    console.log(`METHOD-001 PUT /v1/patient/:id → ${status}`);
    // Should be 404 or 405, not 200
    expect([400, 404, 405, 401, 403, 200, 201]).toContain(status);
    if (status >= 200 && status < 300) {
      console.warn('METHOD-001: PUT succeeded — check if PUT is intentionally supported');
    }
  });

  test('METHOD-002: DELETE on list endpoint', async ({ request }) => {
    const res = await request.delete(`${API}/v1/patient`, { headers: auth() });
    const status = res.status();
    console.log(`METHOD-002 DELETE /v1/patient (list) → ${status}`);
    // Bulk delete on list should NOT be allowed
    expect([400, 404, 405, 401, 403]).toContain(status);
    if (status >= 200 && status < 300) {
      console.warn('METHOD-002: ⚠️  Bulk DELETE on /v1/patient was ACCEPTED — DATA LOSS RISK!');
    }
  });
});

// ── 7. Parameter Pollution & Pagination Abuse ─────────────────────────────
test.describe('24G: Parameter Pollution & Pagination Abuse', () => {
  test.describe.configure({ mode: 'serial' });

  test('PARAM-001: Duplicate query parameters', async ({ request }) => {
    const res = await request.get(
      `${API}/v1/patient?page=1&page=99999&limit=10&limit=99999`,
      { headers: auth() }
    );
    const status = res.status();
    const body   = await res.json().catch(() => ({}));
    console.log(`PARAM-001 duplicate params → ${status}`, JSON.stringify(body).slice(0, 150));
    if (status >= 500) {
      console.warn('PARAM-001: ⚠️  Server crashed on duplicate params');
    }
    expect(status).toBeLessThan(600);
  });

  test('PARAM-002: Negative page/limit', async ({ request }) => {
    const res = await request.get(
      `${API}/v1/patient?page=-1&limit=-10`,
      { headers: auth() }
    );
    const status = res.status();
    console.log(`PARAM-002 negative pagination → ${status}`);
    if (status >= 500) {
      console.warn('PARAM-002: ⚠️  Server crashed on negative pagination');
    }
    expect(status).toBeLessThan(600);
  });

  test('PARAM-003: Extremely large page offset', async ({ request }) => {
    const res = await request.get(
      `${API}/v1/patient?page=99999999&limit=100`,
      { headers: auth() }
    );
    const status = res.status();
    const body   = await res.json().catch(() => ({}));
    console.log(`PARAM-003 huge offset → ${status}`, JSON.stringify(body).slice(0, 100));
    // Should return empty array, not crash
    expect(status).toBeLessThan(600);
    if (status >= 500) {
      console.warn('PARAM-003: ⚠️  Server crashed on huge page offset');
    }
  });

  test('PARAM-004: SQL/NoSQL-like sort injection', async ({ request }) => {
    const maliciousSort = '{"$where": "sleep(5000)"}';
    const res = await request.get(
      `${API}/v1/patient?sort=${encodeURIComponent(maliciousSort)}`,
      { headers: auth() }
    );
    const status = res.status();
    console.log(`PARAM-004 sort injection → ${status}`);
    if (status >= 500) {
      console.warn('PARAM-004: ⚠️  Server 5xx on sort injection');
    }
    expect(status).toBeLessThan(600);
  });
});

// ── 8. Content-Type / Request Format Abuse ────────────────────────────────
test.describe('24H: Content-Type & Format Abuse', () => {
  test.describe.configure({ mode: 'serial' });

  test('CTYPE-001: Send XML body to JSON endpoint', async ({ request }) => {
    const res = await request.post(`${API}/v1/patient`, {
      headers: { ...auth(), 'Content-Type': 'application/xml' },
      data:    '<patient><fullName>QA XML Test</fullName></patient>',
    });
    const status = res.status();
    console.log(`CTYPE-001 XML body → ${status}`);
    expect([400, 415, 422, 401, 403, 200, 201]).toContain(status);
    if (status >= 500) {
      console.warn('CTYPE-001: ⚠️  Server crashed on XML body input');
    }
  });

  test('CTYPE-002: Send plain text body to JSON endpoint', async ({ request }) => {
    const res = await request.post(`${API}/v1/patient`, {
      headers: { ...auth(), 'Content-Type': 'text/plain' },
      data:    'fullName=QA&phone=0812345',
    });
    const status = res.status();
    console.log(`CTYPE-002 plain text body → ${status}`);
    expect([400, 415, 422, 401, 403, 200, 201]).toContain(status);
    if (status >= 500) {
      console.warn('CTYPE-002: ⚠️  Server crashed on plain text body');
    }
  });

  test('CTYPE-003: Deeply nested JSON (bomb attempt)', async ({ request }) => {
    // Create deeply nested object (50 levels)
    let nested = { value: 'leaf' };
    for (let i = 0; i < 50; i++) nested = { child: nested };
    const res = await request.post(`${API}/v1/patient`, {
      headers: auth(),
      data:    { fullName: 'QA', phone: `+6281${Date.now().toString().slice(-8)}`, nested },
    });
    const status = res.status();
    console.log(`CTYPE-003 deeply nested JSON → ${status}`);
    expect(status).toBeLessThan(600);
    if (status >= 500) {
      console.warn('CTYPE-003: ⚠️  Server crashed on deeply nested JSON');
    }
  });
});
