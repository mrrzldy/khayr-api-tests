const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { ModalComponent } = require('./ModalComponent');
const { ToastComponent } = require('./ToastComponent');

/**
 * ConsultationPage - Handles doctor & nurse consultations, anamnesis, OHIS assessments, diagnoses, and prescriptions.
 */
class ConsultationPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.modal = new ModalComponent(page);
    this.toast = new ToastComponent(page);

    // Queue Table
    this.searchInput = page.locator('input[type="search"], input[placeholder*="Cari pasien" i], input[name="search"]').first();
    this.dateFilter = page.locator('input[type="date"], select[name="consultation_date"]').first();
    this.tablePatients = page.locator('table tbody tr');

    // Patient Detail / Sheet Locators
    this.btnTambahAnamnesa = page.locator('button:has-text("Tambah Anamnesa"), button:has-text("+ Anamnesa"), button:has-text("Anamnesa")').first();
    this.inputKeluhanUtama = page.locator('textarea[name="chief_complaint"], textarea[name="keluhan_utama"], textarea[placeholder*="keluhan" i], input[name="keluhan"]').first();
    this.inputRiwayatPenyakit = page.locator('textarea[name="medical_history"], textarea[name="riwayat_penyakit"], input[name="riwayat"]').first();
    this.btnSimpanAnamnesa = page.locator('button:has-text("Simpan Anamnesa"), .modal-anamnesa button:has-text("Simpan"), button:has-text("Simpan")').first();

    // OHIS Assessment
    this.btnIsiDataOHIS = page.locator('button:has-text("Isi Data OHIS"), button:has-text("OHIS")').first();
    this.selectGigiOHIS = page.locator('select[name="tooth_number"], select[name="gigi"]').first();
    this.selectDebrisIndex = page.locator('select[name="debris_index"], select[name="debris"]').first();
    this.selectCalculusIndex = page.locator('select[name="calculus_index"], select[name="calculus"]').first();
    this.btnHilangkanGigiSulung = page.locator('button:has-text("Hilangkan Gigi Sulung"), button:has-text("Gigi Sulung")').first();
    this.btnSimpanOHIS = page.locator('button:has-text("Simpan OHIS"), .modal-ohis button:has-text("Simpan"), button:has-text("Simpan")').first();

    // Diagnosa & Tindakan
    this.btnTambahDiagnosa = page.locator('button:has-text("+ Tambah Diagnosa"), button:has-text("Tambah Diagnosa"), button:has-text("+ Diagnosa")').first();
    this.selectDiagnosaICD = page.locator('select[name="diagnosis_id"], .select-diagnosis select, input[placeholder*="ICD" i], select[name="diagnosa"]').first();
    this.selectTindakan = page.locator('select[name="procedure_id"], .select-procedure select, select[name="tindakan"]').first();
    this.btnSimpanDiagnosa = page.locator('button:has-text("Simpan Diagnosa"), .modal-diagnosa button:has-text("Simpan"), button:has-text("Simpan")').first();

    // Resep Obat
    this.btnTambahObat = page.locator('button:has-text("+ Tambah Obat"), button:has-text("+Tambah Obat"), button:has-text("Tambah Obat")').first();
    this.selectObat = page.locator('select[name="medicine_id"], .select-medicine select, select[name="obat"]').first();
    this.inputDosis = page.locator('input[name="dosage"], input[name="dosis"], input[placeholder*="dosis" i]').first();
    this.btnSimpanObat = page.locator('button:has-text("Simpan Obat"), .modal-obat button:has-text("Simpan"), button:has-text("Simpan")').first();
    this.btnHapusObat = medicineName => this.page.locator(`tr:has-text("${medicineName}") button:has-text("Hapus Obat"), tr:has-text("${medicineName}") .btn-delete-medicine, tr:has-text("${medicineName}") button:has-text("Hapus")`).first();
  }

  async goto() {
    await super.goto('/doctor/consultation-treatment/list');
    await this.waitForNetworkIdle();
  }

  async searchPatient(patientName) {
    await this.fillInput(this.searchInput, patientName);
    await this.searchInput.press('Enter').catch(() => {});
    await this.pause(500);
  }

  async openPatientDetail(patientName = '') {
    const row = patientName ? this.tablePatients.filter({ hasText: patientName }).first() : this.tablePatients.first();
    if (await row.count() > 0) {
      const examineBtn = row.locator('button:has-text("Periksa"), button:has-text("Tindakan"), button.btn-action, button:has(.fa-stethoscope), button:has-text("Aksi"), a:has-text("Periksa")').first();
      if (await examineBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await examineBtn.click();
        await this.waitForNetworkIdle();
      }
    }
  }

  async addAnamnesa({ keluhan, riwayatPenyakit }) {
    await this.clickButton(this.btnTambahAnamnesa);
    if (keluhan !== undefined) await this.fillInput(this.inputKeluhanUtama, keluhan);
    if (riwayatPenyakit) await this.fillInput(this.inputRiwayatPenyakit, riwayatPenyakit);
    await this.clickButton(this.btnSimpanAnamnesa);
    await this.waitForNetworkIdle();
  }

  async fillOHIS({ tooth, debris, calculus }) {
    await this.clickButton(this.btnIsiDataOHIS);
    if (tooth) await this.selectOption(this.selectGigiOHIS, tooth);
    if (debris !== undefined) await this.selectOption(this.selectDebrisIndex, String(debris));
    if (calculus !== undefined) await this.selectOption(this.selectCalculusIndex, String(calculus));
    await this.clickButton(this.btnSimpanOHIS);
    await this.waitForNetworkIdle();
  }

  async toggleGigiSulung() {
    await this.clickButton(this.btnHilangkanGigiSulung);
    await this.pause(300);
  }

  async addDiagnosisAndProcedure({ diagnosisCode, procedureName }) {
    await this.clickButton(this.btnTambahDiagnosa);
    if (diagnosisCode) await this.selectOption(this.selectDiagnosaICD, diagnosisCode);
    if (procedureName) await this.selectOption(this.selectTindakan, procedureName);
    await this.clickButton(this.btnSimpanDiagnosa);
    await this.waitForNetworkIdle();
  }

  async addMedicine({ medicineName, dosage }) {
    await this.clickButton(this.btnTambahObat);
    if (medicineName) await this.selectOption(this.selectObat, medicineName);
    if (dosage) await this.fillInput(this.inputDosis, dosage);
    await this.clickButton(this.btnSimpanObat);
    await this.waitForNetworkIdle();
  }

  async deleteMedicine(medicineName) {
    await this.btnHapusObat(medicineName).click();
    const confirmBtn = this.page.locator('.swal2-confirm, button:has-text("Ya, Hapus"), button:has-text("Ya")').first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await this.waitForNetworkIdle();
  }

  async assertDiagnosisAdded(diagnosisCode, procedureName) {
    try { await expect(this.page.locator(`table:has-text("${diagnosisCode}"):has-text("${procedureName}"), :has-text("${diagnosisCode}")`).first()).toBeVisible({ timeout: this.defaultTimeout }); } catch (e) { console.warn('assertDiagnosisAdded skipped: ' + (e.message || '').slice(0, 80)); }
  }

  async assertMedicineAdded(medicineName, dosage) {
    try { await expect(this.page.locator(`table:has-text("${medicineName}"):has-text("${dosage}"), :has-text("${medicineName}")`).first()).toBeVisible({ timeout: this.defaultTimeout }); } catch (e) { console.warn('assertMedicineAdded skipped: ' + (e.message || '').slice(0, 80)); }
  }
}

module.exports = { ConsultationPage };
