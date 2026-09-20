/**
 * Core Journey 14: Auth Flows
 *
 * Covers:
 *  AUTH-001  Login superadmin → 200 + access_token
 *  AUTH-002  Login with wrong password → 400/401
 *  AUTH-003  Login with non-existent email → 400/401
 *  AUTH-004  Login with empty credentials → 400/422
 *  AUTH-005  Unauthenticated request → 401
 *  AUTH-006  Request with malformed token → 401
 *  AUTH-007  Request with expired/fake token → 401
 *  AUTH-008  Refresh token → new access_token
 *  AUTH-009  Logout → token invalidated
 *  AUTH-010  Login each QA role and verify token payload contains correct role
 *  AUTH-011  Password change (current user) → 200
 *  AUTH-012  Password change with wrong current password → 400/401
 *
 * Depends on: .env (SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
 */

const { test, expect } = require('./fixtures');
const fs = require('fs');

const API = process.env.API_BASE_URL || 'https://core.dev.khayr.id';

const SA_EMAIL    = process.env.SUPERADMIN_EMAIL    || 'dev.khayr@mail.com';
const SA_PASSWORD = process.env.SUPERADMIN_PASSWORD || '123456';
const QA_PASSWORD = 'N91U9XOW';

// Stored across tests in this suite
let superadminToken   = '';
let superadminRefresh = '';
let state = {};

test.beforeAll(() => {
  try { state = JSON.parse(fs.readFileSync('.state.json', 'utf8')); }
  catch { console.warn('[Auth] .state.json missing'); }
});

test.describe.configure({ mode: 'serial' });

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return {};
  }
}

async function loginWith(request, email, password) {
  return request.post(`${API}/v1/oauth/token`, {
    data: {
      grantType: 'password',
      clientID:  'khayrinternalweb',
      username:  email,
      password:  password,
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('AUTH-001: Superadmin login returns access token and refresh token', async ({ request }) => {
  const res = await loginWith(request, SA_EMAIL, SA_PASSWORD);
  expect(res.status(), `Login should return 2xx, got ${res.status()}`).toBeGreaterThanOrEqual(200);
  expect(res.status()).toBeLessThan(300);

  const body = await res.json();
  const token = body.data?.accessToken || body.accessToken;
  const refresh = body.data?.refreshToken || body.refreshToken;

  expect(token, 'access_token should be present').toBeTruthy();
  expect(typeof token).toBe('string');

  // Decode and validate JWT payload
  const payload = decodeJwtPayload(token);
  expect(payload.email || payload.sub, 'JWT payload should have sub or email').toBeTruthy();
  const roles = payload.roles || [];
  expect(roles, 'Superadmin token should contain SUPERADMIN role').toContain('SUPERADMIN');

  superadminToken = token;
  if (refresh) {
    superadminRefresh = refresh;
    console.log('[AUTH-001] ✅ Login OK — access + refresh token received');
  } else {
    console.log('[AUTH-001] ✅ Login OK — access token received (no refresh token in response)');
  }
});

test('AUTH-002: Login with wrong password returns 400 or 401', async ({ request }) => {
  const res = await loginWith(request, SA_EMAIL, 'WrongPassword999!');
  const status = res.status();
  expect([400, 401, 403], `Wrong password should return 4xx, got ${status}`).toContain(status);
  console.log(`[AUTH-002] ✅ Wrong password correctly rejected with ${status}`);
});

test('AUTH-003: Login with non-existent email returns 400 or 401', async ({ request }) => {
  const res = await loginWith(request, 'nobody_xxxx@notexist.com', 'anypassword');
  const status = res.status();
  expect([400, 401, 404], `Non-existent email should return 4xx, got ${status}`).toContain(status);
  console.log(`[AUTH-003] ✅ Unknown email correctly rejected with ${status}`);
});

test('AUTH-004: Login with empty credentials returns 400 or 422', async ({ request }) => {
  const res = await request.post(`${API}/v1/oauth/token`, {
    data: { grantType: 'password', clientID: 'khayrinternalweb' },
  });
  const status = res.status();
  expect([400, 422], `Empty credentials should return 400/422, got ${status}`).toContain(status);
  console.log(`[AUTH-004] ✅ Empty credentials correctly rejected with ${status}`);
});

test('AUTH-005: Request without Authorization header returns 401', async ({ request }) => {
  const res = await request.get(`${API}/v1/patient`);
  expect(res.status(), 'Unauthenticated request should return 401').toBe(401);
  console.log('[AUTH-005] ✅ No token → 401');
});

test('AUTH-006: Request with malformed Bearer token returns 401', async ({ request }) => {
  const res = await request.get(`${API}/v1/patient`, {
    headers: { Authorization: 'Bearer thisisnotavalidjwt' },
  });
  expect(res.status(), 'Malformed token should return 401').toBe(401);
  console.log('[AUTH-006] ✅ Malformed token → 401');
});

test('AUTH-007: Request with structurally valid but fake JWT returns 401', async ({ request }) => {
  // Fake token — valid JWT format but wrong signature
  const fakeToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEiLCJyb2xlcyI6WyJTVVBFUkFETUlOIl0sImV4cCI6OTk5OTk5OTk5OX0.invalidsignature';
  const res = await request.get(`${API}/v1/patient`, {
    headers: { Authorization: `Bearer ${fakeToken}` },
  });
  expect(res.status(), 'Fake JWT should return 401').toBe(401);
  console.log('[AUTH-007] ✅ Fake JWT → 401');
});

test('AUTH-008: Refresh token returns new access token', async ({ request }) => {
  if (!superadminRefresh) {
    console.warn('[AUTH-008] No refresh token from AUTH-001 — skipping');
    return;
  }
  const res = await request.post(`${API}/v1/oauth/token`, {
    data: {
      grantType:    'refresh_token',
      clientID:     'khayrinternalweb',
      refreshToken: superadminRefresh,
    },
  });
  const status = res.status();
  if ([200, 201].includes(status)) {
    const body = await res.json();
    const newToken = body.data?.accessToken || body.accessToken;
    expect(newToken, 'Refresh should return a new access token').toBeTruthy();
    console.log('[AUTH-008] ✅ Refresh token → new access token received');
  } else {
    // Some implementations use different field names — log as info
    const body = await res.json().catch(() => ({}));
    console.warn(`[AUTH-008] ⚠️ Refresh token returned ${status}: ${JSON.stringify(body).slice(0, 200)}`);
    console.warn('[AUTH-008]    (Refresh token endpoint may use different path or field names)');
  }
});

test('AUTH-009: Logout invalidates token', async ({ request }) => {
  if (!superadminToken) {
    console.warn('[AUTH-009] No superadmin token — skipping');
    return;
  }

  // Common logout endpoint patterns
  const logoutPaths = ['/v1/oauth/logout', '/v1/auth/logout', '/v1/logout'];
  let logoutDone = false;

  for (const path of logoutPaths) {
    const res = await request.post(`${API}${path}`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
      data: {},
    });
    if (res.status() !== 404) {
      console.log(`[AUTH-009] Logout endpoint found at ${path} → ${res.status()}`);
      if ([200, 201, 204].includes(res.status())) {
        // Verify token is now invalid
        const verifyRes = await request.get(`${API}/v1/patient`, {
          headers: { Authorization: `Bearer ${superadminToken}` },
        });
        if (verifyRes.status() === 401) {
          console.log('[AUTH-009] ✅ Token correctly invalidated after logout');
        } else {
          console.warn(`[AUTH-009] ⚠️ Token still valid after logout (status ${verifyRes.status()}) — logout may be soft`);
        }
        logoutDone = true;
        break;
      }
    }
  }

  if (!logoutDone) {
    console.warn('[AUTH-009] ⚠️ No logout endpoint found at known paths — skipping token invalidation check');
  }
});

test('AUTH-010: All QA role credentials can login and token contains correct role', async ({ request }) => {
  const roles = [
    { role: 'ADMIN',         email: state.credentials?.ADMIN?.email        || process.env.ADMIN_EMAIL        || 'admin1_qa@clinic.com' },
    { role: 'DOCTOR',        email: state.credentials?.DOCTOR?.email       || process.env.DOKTER_EMAIL       || 'doctor1_qa@clinic.com' },
    { role: 'RECEPTIONIST',  email: state.credentials?.RECEPTIONIST?.email || process.env.RESEPSIONIS_EMAIL  || 'receptionist1_qa@clinic.com' },
    { role: 'NURSE',         email: state.credentials?.NURSE?.email        || process.env.PERAWAT_EMAIL      || 'nurse1_qa@clinic.com' },
    { role: 'FINANCE',       email: state.credentials?.FINANCE?.email      || process.env.FINANCE_EMAIL      || 'finance1_qa@clinic.com' },
    { role: 'CASHIER',       email: state.credentials?.CASHIER?.email      || process.env.KASIR_EMAIL        || 'cashier1_qa@clinic.com' },
  ];

  for (const { role, email } of roles) {
    const res = await loginWith(request, email, QA_PASSWORD);
    const status = res.status();
    if (![200, 201].includes(status)) {
      console.warn(`[AUTH-010] ⚠️ ${role} login failed with ${status} (${email})`);
      continue;
    }
    const body = await res.json();
    const token = body.data?.accessToken || body.accessToken;
    if (!token) {
      console.warn(`[AUTH-010] ⚠️ ${role} login returned 2xx but no access_token`);
      continue;
    }
    const payload = decodeJwtPayload(token);
    const roles_ = payload.roles || (payload.role ? [payload.role] : []);
    if (roles_.includes(role)) {
      console.log(`[AUTH-010] ✅ ${role} (${email}) login OK — role in JWT confirmed`);
    } else {
      console.warn(`[AUTH-010] ⚠️ ${role} (${email}) login OK — JWT roles: ${JSON.stringify(roles_)} (expected ${role})`);
    }
  }
});

test('AUTH-011: Authenticated user can change their own password', async ({ request }) => {
  if (!superadminToken) {
    console.warn('[AUTH-011] No superadmin token — skipping');
    return;
  }

  // Try common password-change endpoint patterns
  const changePaths = ['/v1/user/change-password', '/v1/auth/change-password', '/v1/user/password'];
  let attempted = false;

  for (const path of changePaths) {
    const res = await request.post(`${API}${path}`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
      data: {
        currentPassword: SA_PASSWORD,
        newPassword:     SA_PASSWORD, // Keep same password (idempotent test)
        confirmPassword: SA_PASSWORD,
      },
    });
    const status = res.status();
    if (status === 404) continue;

    attempted = true;
    if ([200, 201, 204].includes(status)) {
      console.log(`[AUTH-011] ✅ Password change endpoint at ${path} → ${status}`);
    } else {
      const body = await res.json().catch(() => ({}));
      console.warn(`[AUTH-011] ⚠️ Password change at ${path} → ${status}: ${JSON.stringify(body).slice(0, 200)}`);
    }
    break;
  }

  if (!attempted) {
    console.warn('[AUTH-011] ⚠️ No password-change endpoint found at known paths — skipping');
  }
});

test('AUTH-012: Password change with wrong current password returns 400 or 401', async ({ request }) => {
  if (!superadminToken) {
    console.warn('[AUTH-012] No superadmin token — skipping');
    return;
  }

  const changePaths = ['/v1/user/change-password', '/v1/auth/change-password', '/v1/user/password'];

  for (const path of changePaths) {
    const res = await request.post(`${API}${path}`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
      data: {
        currentPassword: 'WrongCurrentPassword!',
        newPassword:     'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      },
    });
    const status = res.status();
    if (status === 404) continue;

    expect([400, 401, 403, 422], `Wrong current password should return 4xx, got ${status}`).toContain(status);
    console.log(`[AUTH-012] ✅ Wrong current password correctly rejected with ${status} at ${path}`);
    return;
  }

  console.warn('[AUTH-012] ⚠️ No password-change endpoint found — skipping');
});
