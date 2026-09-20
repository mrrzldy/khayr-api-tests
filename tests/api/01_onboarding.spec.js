/**
 * Core Journey 1: Onboarding (Auth)
 *
 * Strategy:
 * - Login as superadmin to obtain access token
 * - Skip org creation (use known permanent org ID from .env)
 * - Save token + orgID to .state.json for downstream suites
 */
const { test, expect } = require('./fixtures');
const { MongoClient } = require('mongodb');
const fs = require('fs');

const API = process.env.API_BASE_URL || 'https://core.dev.khayr.id';

let dbClient;
let db;
let dbAvailable = false;
let accessToken = '';
let organizationId = process.env.SUPERADMIN_ORG_ID || '6a790f111111111111111111';

test.beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    try {
      dbClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
      await dbClient.connect();
      db = dbClient.db(process.env.MONGODB_DB_NAME);
      dbAvailable = true;
      console.log('MongoDB connected — DB validation enabled.');
    } catch (e) {
      console.warn('MongoDB not reachable — DB validation will be skipped:', e.message);
    }
  } else {
    console.warn('MONGODB_URI not set — DB validation will be skipped.');
  }
});

test.afterAll(async () => {
  if (dbClient) await dbClient.close().catch(() => null);
});

test.describe.configure({ mode: 'serial' });

test.describe('Core Journey 1: Onboarding (Auth)', () => {

  test('SA-Login: Login as superadmin and get access token', async ({ request }) => {
    const response = await request.post(`${API}/v1/oauth/token`, {
      data: {
        grantType: 'password',
        clientID: 'khayrinternalweb',
        username: process.env.SUPERADMIN_EMAIL || 'dev.khayr@mail.com',
        password: process.env.SUPERADMIN_PASSWORD || '123456',
      },
    });

    const body = await response.json();
    console.log('Login Response status:', response.status());

    expect(response.ok(), `Login failed: ${JSON.stringify(body)}`).toBeTruthy();
    expect(body.data?.accessToken, 'accessToken missing from response').toBeDefined();

    accessToken = body.data.accessToken;
    const refreshToken = body.data.refreshToken;

    // Persist state for downstream test suites
    fs.writeFileSync('.state.json', JSON.stringify({
      accessToken,
      refreshToken,
      organizationId,
    }));

    console.log('Token obtained. Org ID:', organizationId);
  });

  test('SA-Login-QA-Admin: Login as QA admin and validate', async ({ request }) => {
    const response = await request.post(`${API}/v1/oauth/token`, {
      data: {
        grantType: 'password',
        clientID: 'khayrinternalweb',
        username: process.env.ADMIN_EMAIL || 'admin1_qa@clinic.com',
        password: process.env.ADMIN_PASSWORD || 'N91U9XOW',
      },
    });

    const body = await response.json();
    console.log('QA Admin Login Response status:', response.status());
    expect(response.ok(), `QA Admin login failed: ${JSON.stringify(body)}`).toBeTruthy();
    expect(body.data?.accessToken).toBeDefined();

    // Update state with QA org info
    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    state.qaAdminToken = body.data.accessToken;
    state.qaOrganizationId = process.env.QA_ORG_ID || '6a91543f7afc5a04218e49d3';
    fs.writeFileSync('.state.json', JSON.stringify(state));
  });

  test('SA-Login-QA-Doctor: Login as QA doctor and validate', async ({ request }) => {
    const response = await request.post(`${API}/v1/oauth/token`, {
      data: {
        grantType: 'password',
        clientID: 'khayrinternalweb',
        username: process.env.DOKTER_EMAIL || 'doctor1_qa@clinic.com',
        password: process.env.DOKTER_PASSWORD || 'N91U9XOW',
      },
    });

    const body = await response.json();
    expect(response.ok(), `QA Doctor login failed: ${JSON.stringify(body)}`).toBeTruthy();
    expect(body.data?.accessToken).toBeDefined();

    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    state.qaDoctorToken = body.data.accessToken;
    fs.writeFileSync('.state.json', JSON.stringify(state));
  });

  test('SA-Login-Invalid: Invalid credentials return error', async ({ request }) => {
    const response = await request.post(`${API}/v1/oauth/token`, {
      data: {
        grantType: 'password',
        clientID: 'khayrinternalweb',
        username: 'invalid@user.com',
        password: 'wrongpassword',
      },
    });

    expect(response.ok()).toBeFalsy();
    console.log('Invalid login status:', response.status());
  });

});
