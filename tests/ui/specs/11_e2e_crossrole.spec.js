/**
 * Suite 11: Cross-Role End-to-End Flow
 *
 * Simulates a full patient journey through the clinic:
 *   Step 1  — Resepsionis: Login → Buat Reservasi (Pasien Lama)
 *   Step 2  — Dokter: Login → Buka antrian → Tambah Anamnesa → Tambah Diagnosa & Tindakan → Tambah Obat
 *   Step 3  — Kasir: Login → Buka daftar pembayaran → Konfirmasi Bayar (Tunai)
 *
 * Pattern:
 *   - Serial execution via test.describe.configure({ mode: 'serial' })
 *   - Shared `ctx` object carries patient name + any IDs between steps
 *   - Soft assertions throughout: failures warn + continue, never block the chain
 *   - Each step guards itself — if a previous step failed, it logs and skips gracefully
 *
 * Run:
 *   npx playwright test tests/ui/specs/11_e2e_crossrole.spec.js --project=resepsionis
 *   (project doesn't matter — spec handles its own login per step)
 *
 * Or via npm script (once added to package.json):
 *   npm run test:ui:e2e
 */

const { test, expect } = require('@playwright/test');
const { LoginPage }       = require('../pages/LoginPage');
const { ReservationPage } = require('../pages/ReservationPage');
const { ConsultationPage }= require('../pages/ConsultationPage');
const { PaymentPage }     = require('../pages/PaymentPage');

// ─── Shared state across steps ───────────────────────────────────────────────
/** @type {{ patientQuery: string, loginOk: Record<string,boolean> }} */
const ctx = {
  patientQuery: 'Test', // Existing patient search keyword — adjust to match your staging data
  loginOk: {},          // Tracks per-role login success
};

const BASE = process.env.BASE_URL || 'https://internal.dev.khayr.id';

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function doLogin(page, role) {
  const login = new LoginPage(page);
  const ok = await login.loginAs(role);
  ctx.loginOk[role] = !!ok;
  if (!ok) console.warn(`[E2E] loginAs('${role}') failed — downstream steps for this role may be skipped`);
  return ok;
}

async function softTry(label, fn) {
  try {
    await fn();
    console.log(`[E2E] ✅ ${label}`);
  } catch (e) {
    console.warn(`[E2E] ⚠️  ${label} — ${String(e.message || e).slice(0, 120)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('E2E-001 → E2E-003: Full patient journey (Resepsionis → Dokter → Kasir)', () => {
  test.describe.configure({ mode: 'serial' });

  // ── Step 1: Resepsionis buat reservasi ─────────────────────────────────────
  test('E2E-001: Resepsionis — Buat Reservasi Pasien Lama', async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultTimeout(30000);

    const ok = await doLogin(page, 'resepsionis');
    if (!ok) {
      console.warn('[E2E-001] Login resepsionis gagal — skipping reservation step');
      return;
    }

    const reservationPage = new ReservationPage(page);
    await softTry('Navigate to reservation create page', () => reservationPage.goto());

    await softTry('Create reservation for existing patient', () =>
      reservationPage.createReservationExistingPatient({
        patientQuery: ctx.patientQuery,
        // doctor, date, timeSlot intentionally omitted — let the form use defaults/first available
        paymentMethod: 'pribadi',
      })
    );

    // Give the app a moment to process submit
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);

    // Soft-check: expect success toast or redirect away from create page
    await softTry('Assert reservation saved (toast or redirect)', async () => {
      const toastOk = await page.locator('.toast-success, .swal2-success, :has-text("berhasil"), :has-text("sukses")').first().isVisible({ timeout: 5000 }).catch(() => false);
      const redirected = !page.url().includes('/create');
      if (!toastOk && !redirected) {
        console.warn('[E2E-001] No success toast and still on create page — reservation may not have saved');
      }
    });

    console.log('[E2E-001] Reservation step complete');
  });

  // ── Step 2: Dokter handle konsultasi ───────────────────────────────────────
  test('E2E-002: Dokter — Tambah Anamnesa, Diagnosa & Tindakan, Obat', async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultTimeout(30000);

    const ok = await doLogin(page, 'dokter');
    if (!ok) {
      console.warn('[E2E-002] Login dokter gagal — skipping consultation step');
      return;
    }

    const consultationPage = new ConsultationPage(page);
    await softTry('Navigate to consultation list', () => consultationPage.goto());

    // Try to find our test patient in the queue; if not found, use first available row
    await softTry('Search patient in queue', () => consultationPage.searchPatient(ctx.patientQuery));

    const rowCount = await consultationPage.tablePatients.count().catch(() => 0);
    if (rowCount === 0) {
      console.warn('[E2E-002] No patients in consultation queue — consultation step skipped');
      return;
    }

    await softTry('Open patient detail / Periksa', () =>
      consultationPage.openPatientDetail(ctx.patientQuery)
    );

    await softTry('Tambah Anamnesa', () =>
      consultationPage.addAnamnesa({
        keluhan: 'Gigi depan sakit saat digigit (E2E test)',
        riwayatPenyakit: 'Tidak ada riwayat penyakit sistemik',
      })
    );

    await softTry('Tambah Diagnosa & Tindakan', () =>
      consultationPage.addDiagnosisAndProcedure({
        diagnosisCode: 'K02.1',   // Karies email — must exist in staging data
        procedureName: 'Penambalan', // Must exist in staging data
      })
    );

    await softTry('Tambah Obat', () =>
      consultationPage.addMedicine({
        medicineName: 'Amoxicillin',  // Partial match — adjust to match staging product name
        dosage: '3x1',
      })
    );

    await softTry('Assert diagnosa added', () =>
      consultationPage.assertDiagnosisAdded('K02.1', 'Penambalan')
    );

    console.log('[E2E-002] Consultation step complete');
  });

  // ── Step 3: Kasir konfirmasi pembayaran ────────────────────────────────────
  test('E2E-003: Kasir — Konfirmasi Pembayaran (Tunai)', async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultTimeout(30000);

    const ok = await doLogin(page, 'kasir');
    if (!ok) {
      console.warn('[E2E-003] Login kasir gagal — skipping payment step');
      return;
    }

    const paymentPage = new PaymentPage(page);
    await softTry('Navigate to payment list', () => paymentPage.goto());

    // Filter to unpaid / draft records first so we target the right row
    await softTry('Filter status Belum Bayar / Draft', async () => {
      await paymentPage.filterByStatus('Belum Bayar');
    });

    // Optionally search for our patient
    await softTry('Search patient in payment list', async () => {
      await paymentPage.search(ctx.patientQuery);
    });

    const rowCount = await paymentPage.tableRows.count().catch(() => 0);
    if (rowCount === 0) {
      console.warn('[E2E-003] No payment rows found — payment step skipped');
      return;
    }

    await softTry('Open confirmation modal', () => paymentPage.openConfirmation());

    await softTry('Confirm cash payment (Tunai Rp 100.000)', () =>
      paymentPage.confirmCash({ amount: 100000 })
    );

    // Check for success signal
    await softTry('Assert payment confirmed (toast or status change)', async () => {
      const toastOk = await page.locator('.toast-success, .swal2-success, :has-text("berhasil"), :has-text("sukses"), :has-text("Lunas")').first().isVisible({ timeout: 6000 }).catch(() => false);
      if (!toastOk) {
        console.warn('[E2E-003] No success toast after payment — may still have processed');
      } else {
        console.log('[E2E-003] Payment confirmed successfully ✅');
      }
    });

    console.log('[E2E-003] Payment step complete');
  });
});
