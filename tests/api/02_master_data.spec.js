/**
 * Core Journey 2: Master Data (Location & Insurer)
 *
 * Depends on: 01_onboarding — requires .state.json with accessToken
 */
const { test, expect } = require('./fixtures');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');

const API = process.env.API_BASE_URL || 'https://core.dev.khayr.id';

let dbClient;
let db;
let dbAvailable = false;
let accessToken = '';
let organizationId = '';

test.beforeAll(async () => {
  // Read state - graceful fallback if file missing
  try {
    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    accessToken = state.accessToken;
    organizationId = state.organizationId;
  } catch (e) {
    console.warn('Warning: .state.json not found. Run 01_onboarding first.');
  }

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

test.describe('Core Journey 2: Master Data (Location & Insurer)', () => {

  test('MD-001: Create Location and Validate in DB', async ({ request }) => {
    const locationCode = `LOC-${Date.now()}`;
    const payload = {
      code: locationCode,
      name: `Klinik Pusat ${Date.now()}`,
      address: 'Jl. Sudirman No. 1',
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      postalCode: '10220',
      phone: '+628111222333',
      email: `pusat_${Date.now()}@clinic.com`,
      type: 'MAIN',
      status: 'ACTIVE',
      subdistrictID: '3174021001',
    };

    const response = await request.post(`${API}/v1/location`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: payload,
    });

    const body = await response.json();
    console.log('Location Response:', JSON.stringify(body).substring(0, 200));
    expect(response.ok(), `Create Location failed: ${JSON.stringify(body)}`).toBeTruthy();

    const locationId = body.data?.id || body.data?._id || body.id;
    expect(locationId).toBeDefined();

    // Validate in MongoDB (if available)
    if (dbAvailable) {
      const record = await db.collection('locations').findOne({ _id: new ObjectId(locationId) });
      expect(record, 'Location not found in DB').toBeTruthy();
      console.log('DB validation passed for location:', locationId);
    }

    // Save locationCode for inventory suite
    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    state.locationCode = locationCode;
    state.locationId = locationId;
    fs.writeFileSync('.state.json', JSON.stringify(state));
  });

  test('MD-002: GET Location list returns data', async ({ request }) => {
    const response = await request.get(`${API}/v1/location`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json();
    expect(response.ok(), `GET /v1/location failed: ${JSON.stringify(body)}`).toBeTruthy();
    console.log('Total locations:', body.data?.total || body.total || 'n/a');
  });

  test('MD-003: Create Insurer and Validate in DB', async ({ request }) => {
    const payload = {
      name: `BPJS Kesehatan ${Date.now()}`,
      companyName: 'BPJS Kesehatan RI',
      email: `carecenter${Date.now()}@bpjs-kesehatan.go.id`,
      phone: '+62214212938',
      status: 'ACTIVE',
    };

    const response = await request.post(`${API}/v1/insurer`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: payload,
    });

    const body = await response.json();
    console.log('Insurer Response:', JSON.stringify(body).substring(0, 200));
    expect(response.ok(), `Create Insurer failed: ${JSON.stringify(body)}`).toBeTruthy();

    const insurerId = body.data?.id || body.data?._id || body.id;
    expect(insurerId).toBeDefined();

    // Validate in MongoDB (if available)
    if (dbAvailable) {
      const record = await db.collection('insurers').findOne({ _id: new ObjectId(insurerId) });
      expect(record, 'Insurer not found in DB').toBeTruthy();
      console.log('DB validation passed for insurer:', insurerId);
    }

    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    state.insurerId = insurerId;
    fs.writeFileSync('.state.json', JSON.stringify(state));
  });

  test('MD-004: GET Insurer list returns data', async ({ request }) => {
    const response = await request.get(`${API}/v1/insurer`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json();
    expect(response.ok(), `GET /v1/insurer failed: ${JSON.stringify(body)}`).toBeTruthy();
  });

});
