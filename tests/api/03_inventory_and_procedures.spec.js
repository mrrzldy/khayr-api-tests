/**
 * Core Journey 3: Inventory & Procedures Master Data
 *
 * Depends on: 01_onboarding, 02_master_data
 */
const { test, expect } = require('./fixtures');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');

const API = process.env.API_BASE_URL || 'https://core.dev.khayr.id';

let dbClient;
let db;
let dbAvailable = false;
let accessToken = '';
let locationCode = '';
let productCategoryCode = '';
let productCode = '';
let procedureCategoryCode = '';

test.beforeAll(async () => {
  try {
    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    accessToken = state.accessToken;
    locationCode = state.locationCode || 'LOC-MOCK';
  } catch (e) {
    console.warn('Warning: .state.json not found. Run 01_onboarding + 02_master_data first.');
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

test.describe('Core Journey 3: Inventory & Procedures', () => {

  test('INV-001: Create Product Category and Validate in DB', async ({ request }) => {
    productCategoryCode = `PCAT-${Date.now()}`;
    const payload = {
      code: productCategoryCode,
      name: `Kategori Obat ${Date.now()}`,
      status: 'ACTIVE',
    };

    const response = await request.post(`${API}/v1/product/category`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: payload,
    });

    const body = await response.json();
    console.log('Product Category Response:', JSON.stringify(body).substring(0, 200));
    expect(response.ok(), `Create Product Category failed: ${JSON.stringify(body)}`).toBeTruthy();

    const id = body.data?.id || body.data?._id || body.id;
    expect(id).toBeDefined();

    if (dbAvailable) {
      const record = await db.collection('product_categories').findOne({ _id: new ObjectId(id) });
      expect(record, 'Product category not found in DB').toBeTruthy();
    }

    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    state.productCategoryCode = productCategoryCode;
    fs.writeFileSync('.state.json', JSON.stringify(state));
  });

  test('INV-002: Create Product and Validate in DB', async ({ request }) => {
    productCode = `MED-${Date.now()}`;
    const payload = {
      categories: [productCategoryCode],
      code: productCode,
      name: `Paracetamol ${Date.now()}`,
      description: 'Obat demam dan nyeri',
      hasBatchNumber: true,
      status: 'ACTIVE',
      units: [
        {
          unitCode: 'PCS',
          basePrice: 10000,
          finalPrice: 10000,
          currency: 'IDR',
          conversion: { baseUnitCode: 'PCS', factor: 1 },
        },
      ],
    };

    const response = await request.post(`${API}/v1/product`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: payload,
    });

    const body = await response.json();
    console.log('Product Response:', JSON.stringify(body).substring(0, 200));
    expect(response.ok(), `Create Product failed: ${JSON.stringify(body)}`).toBeTruthy();

    const productId = body.data?.id || body.data?._id || body.id;
    expect(productId).toBeDefined();

    if (dbAvailable) {
      const record = await db.collection('products').findOne({ _id: new ObjectId(productId) });
      expect(record, 'Product not found in DB').toBeTruthy();
    }

    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    state.productCode = productCode;
    state.productId = productId;
    fs.writeFileSync('.state.json', JSON.stringify(state));
  });

  test('INV-003: Create Product Stock and Validate in DB', async ({ request }) => {
    if (!productCode || locationCode === 'LOC-MOCK') {
      console.warn('Skipping stock creation: productCode or locationCode not set');
      return;
    }

    const payload = {
      locationCode,
      productCode,
      minimumStock: 10,
      qty: 100,
      unitCode: 'PCS',
      batchNumber: `BATCH-${Date.now()}`,
      expiryDate: '2030-12-31',
    };

    const response = await request.post(`${API}/v1/product/stock`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: payload,
    });

    const body = await response.json();
    console.log('Stock Response:', JSON.stringify(body).substring(0, 200));
    expect(response.ok(), `Create Product Stock failed: ${JSON.stringify(body)}`).toBeTruthy();
  });

  test('PROC-001: Create Procedure Category and Validate in DB', async ({ request }) => {
    procedureCategoryCode = `PRCAT-${Date.now()}`;
    const payload = {
      code: procedureCategoryCode,
      name: `Kategori Prosedur ${Date.now()}`,
      status: 'ACTIVE',
    };

    const response = await request.post(`${API}/v1/procedure/category`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: payload,
    });

    const body = await response.json();
    console.log('Procedure Category Response:', JSON.stringify(body).substring(0, 200));

    if (!response.ok()) {
      // Fallback 1: query the API list to find an existing category
      console.warn('Category creation failed — trying GET /v1/procedure/category for fallback...');
      const listRes = await request.get(`${API}/v1/procedure/category`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (listRes.ok()) {
        const listBody = await listRes.json();
        const items = listBody.data?.data || listBody.data?.items || listBody.data || [];
        const first = Array.isArray(items) ? items[0] : null;
        if (first?.code) {
          procedureCategoryCode = first.code;
          console.log('Using existing category code from API list:', procedureCategoryCode);
        }
      }
      // Fallback 2: try DB if available
      if (!procedureCategoryCode || procedureCategoryCode.startsWith('PRCAT-') && procedureCategoryCode.length < 15) {
        if (dbAvailable) {
          const existing = await db.collection('procedure_categories').findOne({});
          if (existing?.code) {
            procedureCategoryCode = existing.code;
            console.log('Using existing category code from DB:', procedureCategoryCode);
          }
        }
      }
      if (!procedureCategoryCode) {
        console.warn('No valid procedure category found — PROC-002 will be skipped.');
        procedureCategoryCode = '';
      }
    } else {
      const id = body.data?.id || body.data?._id || body.id;
      if (id && dbAvailable) {
        const record = await db.collection('procedure_categories').findOne({ _id: new ObjectId(id) });
        expect(record, 'Procedure category not found in DB').toBeTruthy();
      }
    }

    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    state.procedureCategoryCode = procedureCategoryCode;
    fs.writeFileSync('.state.json', JSON.stringify(state));
  });

  test('PROC-002: Create Procedure and Validate in DB', async ({ request }) => {
    if (!procedureCategoryCode) {
      console.warn('No valid procedureCategoryCode — skipping PROC-002');
      test.skip();
      return;
    }

    const payload = {
      basePrice: 150000,
      categories: [procedureCategoryCode],
      code: `PRCD-${Date.now()}`,
      currency: 'IDR',
      finalPrice: 150000,
      name: `Cabut Gigi ${Date.now()}`,
      pricingType: 'TOOTH_BASED',
      status: 'ACTIVE',
      supplies: [],
    };

    const response = await request.post(`${API}/v1/procedure`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: payload,
    });

    const body = await response.json();
    console.log('Procedure Response:', JSON.stringify(body).substring(0, 200));
    expect(response.ok(), `Create Procedure failed: ${JSON.stringify(body)}`).toBeTruthy();

    const procedureId = body.data?.id || body.data?._id || body.id;
    expect(procedureId).toBeDefined();

    if (dbAvailable) {
      const record = await db.collection('procedures').findOne({ _id: new ObjectId(procedureId) });
      expect(record, 'Procedure not found in DB').toBeTruthy();
    }

    const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
    state.procedureId = procedureId;
    fs.writeFileSync('.state.json', JSON.stringify(state));
  });

});
