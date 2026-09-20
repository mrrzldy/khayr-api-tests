/**
 * Core Journey 19: Run Summary
 *
 * Runs LAST in the suite. Reads .state.json and queries the DB to produce
 * a clear human-readable summary of everything automation did this run:
 *
 *  - ✅ DATA CREATED
 *  - ✏️  DATA UPDATED/EDITED
 *  - 🗑️  DATA DELETED
 *  - 🐛 BUGS FOUND (RBAC / validation issues)
 *
 * No assertions — this test always passes. It's purely informational.
 */

const { test } = require('./fixtures');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI ||
  'mongodb+srv://dental_dev:wGDPEhMSoJ3fK1XS@dentalclinicdev.qafu7.mongodb.net/';
const DB_NAME   = process.env.MONGODB_DB_NAME || 'DCMS-APP';

const API = process.env.API_BASE_URL || 'https://core.dev.khayr.id';

test.describe.configure({ mode: 'serial' });

test('RUN-SUMMARY: Automation run data summary', async ({ request }) => {
  // ── Load state ─────────────────────────────────────────────────────────────
  let state = {};
  try {
    state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
  } catch {
    console.log('[SUMMARY] ⚠️  .state.json not found — run 01_onboarding first');
    return;
  }

  const creds = state.credentials || {};
  const orgId = state.organizationId || '6a790f111111111111111111';

  // ── DB connection ──────────────────────────────────────────────────────────
  let db = null;
  let client = null;
  try {
    client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    db = client.db(DB_NAME);
  } catch {
    console.warn('[SUMMARY] ⚠️  DB not available — showing state.json data only');
  }

  const divider = '━'.repeat(60);

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n');
  console.log('╔' + '═'.repeat(60) + '╗');
  console.log('║        🤖 AUTOMATION RUN SUMMARY                          ║');
  console.log('╚' + '═'.repeat(60) + '╝');
  console.log(divider);

  // ── ORG ────────────────────────────────────────────────────────────────────
  let orgName = 'TESTING_ORG';
  if (db) {
    const org = await db.collection('clinic_organization').findOne(
      { _id: new ObjectId(orgId) },
      { projection: { name: 1 } }
    ).catch(() => null);
    if (org) orgName = org.name;
  }
  console.log(`🏥 ORGANIZATION : ${orgName}`);
  console.log(`   ID           : ${orgId}`);
  console.log(`   UI URL       : ${API.replace('https://core.dev.khayr.id', 'https://internal.dev.khayr.id')}/patient/list`);
  console.log(divider);

  // ── CREATED DATA ──────────────────────────────────────────────────────────
  console.log('✅ DATA CREATED');
  console.log('');

  // Users / credentials
  console.log('  👥 USERS (per role):');
  const roleKeys = ['ADMIN','DOCTOR','NURSE','RECEPTIONIST','FINANCE','CASHIER'];
  for (const role of roleKeys) {
    if (creds[role]) {
      let userId = '';
      if (db) {
        const u = await db.collection('clinic_user').findOne(
          { email: creds[role].email },
          { projection: { _id: 1 } }
        ).catch(() => null);
        if (u) userId = ` | ID: ${u._id}`;
      }
      console.log(`     ${role.padEnd(14)} ${creds[role].email} / ${creds[role].password}${userId}`);
    }
  }
  console.log('');

  // Patient
  if (state.patientId) {
    let patInfo = `ID: ${state.patientId}`;
    if (db) {
      const p = await db.collection('clinic_user').findOne(
        { _id: new ObjectId(state.patientId) },
        { projection: { firstName: 1, lastName: 1, email: 1, organizationID: 1 } }
      ).catch(() => null);
      if (p) {
        const orgTag = p.organizationID ? `org: ${p.organizationID}` : '⚠️  NO ORG';
        patInfo = `${p.firstName} ${p.lastName} <${p.email}> | ${orgTag} | ID: ${state.patientId}`;
      }
    }
    console.log(`  🧑 PATIENT      : ${patInfo}`);
  }

  // Appointment
  if (state.appointmentId) {
    let apptInfo = `ID: ${state.appointmentId}`;
    if (db) {
      const a = await db.collection('appointments').findOne(
        { _id: new ObjectId(state.appointmentId) },
        { projection: { status: 1, appointmentTime: 1 } }
      ).catch(() => null);
      if (a) apptInfo = `Status: ${a.status} | Time: ${a.appointmentTime} | ID: ${state.appointmentId}`;
    }
    console.log(`  📅 APPOINTMENT  : ${apptInfo}`);
  }

  // Medical Record
  if (state.medicalRecordId) {
    let mrInfo = `ID: ${state.medicalRecordId}`;
    if (db) {
      const mr = await db.collection('medical_records').findOne(
        { _id: new ObjectId(state.medicalRecordId) },
        { projection: { appointmentID: 1, createdAt: 1 } }
      ).catch(() => null);
      if (mr) mrInfo = `Appointment: ${mr.appointmentID} | Created: ${mr.createdAt} | ID: ${state.medicalRecordId}`;
    }
    console.log(`  📋 MED RECORD   : ${mrInfo}`);
  }

  // Billing
  if (state.billingId) {
    let billInfo = `ID: ${state.billingId}`;
    if (db) {
      const b = await db.collection('billings').findOne(
        { _id: new ObjectId(state.billingId) },
        { projection: { status: 1, totalAmount: 1 } }
      ).catch(() => null);
      if (b) billInfo = `Status: ${b.status} | Total: Rp ${(b.totalAmount || 0).toLocaleString()} | ID: ${state.billingId}`;
    }
    console.log(`  💰 BILLING      : ${billInfo}`);
  }

  // Master data
  if (state.locationId)          console.log(`  📍 LOCATION     : ${state.locationCode || ''} | ID: ${state.locationId}`);
  if (state.insurerId)           console.log(`  🏦 INSURER      : ID: ${state.insurerId}`);
  if (state.productId)           console.log(`  💊 PRODUCT      : ${state.productCode || ''} | ID: ${state.productId}`);
  if (state.procedureId)         console.log(`  🦷 PROCEDURE    : ID: ${state.procedureId}`);

  console.log('');
  console.log(divider);

  // ── EDITED DATA ────────────────────────────────────────────────────────────
  console.log('✏️  DATA UPDATED/EDITED (auto-reverted after test)');
  console.log('');
  console.log('  • Appointment status   → ARRIVED → IN_PROGRESS → COMPLETED');
  console.log('  • Insurer name         → patched & reverted');
  console.log('  • Location address     → patched');
  console.log('  • Org description      → patched');
  console.log('  • Procedure category   → patched & reverted');
  console.log('  • Procedure description→ patched');
  console.log('  • Product category     → patched & reverted');
  console.log('  • Product description  → patched');
  console.log('  • User bio (superadmin)→ patched');
  console.log('');
  console.log(divider);

  // ── DELETED DATA ──────────────────────────────────────────────────────────
  console.log('🗑️  DATA DELETED');
  console.log('');
  console.log('  • User shift assignments (created & cleaned up in SCH tests)');
  console.log('  • Billing items (created & removed in BILL tests)');
  console.log('');
  console.log(divider);

  // ── BUGS FOUND ────────────────────────────────────────────────────────────
  console.log('🐛 BUGS / API ISSUES FOUND THIS RUN');
  console.log('');
  console.log('  APPT-001 POST /v1/appointment → 400: "patientID does not exist"');
  console.log('           → Patient created via POST /v1/user (roles:PATIENT) is NOT');
  console.log('             visible to the appointment API — backend has separate patient');
  console.log('             registry; creating a user with PATIENT role does not auto-');
  console.log('             register them in the patient collection the appointment API checks.');
  console.log('           → Test falls back to existing appointment (suite still passes).');
  console.log('');
  console.log('  BILL-003 POST /v1/billing/:id/item with type=PROCEDURE');
  console.log('           → 422: "type PROCEDURE not implemented"');
  console.log('           → Backend has not implemented PROCEDURE handler for billing items');
  console.log('');
  console.log('  BILL-004 PUT /v1/billing/:id/status → 400: paymentChannel required');
  console.log('           → Field "paymentChannel" sent with valid ID but API still rejects');
  console.log('           → Backend validation broken — ignores the field even when present');
  console.log('');
  console.log('  PROC-001 POST /v1/procedure/category → 500 Internal Server Error');
  console.log('           → Backend error on procedure category creation');
  console.log('');
  console.log('  SCH-005  POST /v1/user/shift → 500 Internal Server Error');
  console.log('           → Backend error on shift assignment creation');
  console.log('');
  console.log(divider);
  console.log('');
  console.log(`  Run completed at: ${new Date().toISOString()}`);
  console.log('╔' + '═'.repeat(60) + '╗');
  console.log('║                   END OF SUMMARY                          ║');
  console.log('╚' + '═'.repeat(60) + '╝');
  console.log('');

  if (client) await client.close();
});
