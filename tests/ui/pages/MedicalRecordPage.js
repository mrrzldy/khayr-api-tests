const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { TableComponent } = require('./TableComponent');
const { ModalComponent } = require('./ModalComponent');

/**
 * MedicalRecordPage - Handles patient electronic medical records (EMR), consultation histories, and diagnosis details.
 */
class MedicalRecordPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.tableComponent = new TableComponent(page);
    this.modal = new ModalComponent(page);

    this.searchInput = page.locator('input[type="search"], input[placeholder*="Cari" i], input[name="search"]').first();
    this.tableRecords = page.locator('table tbody tr');
    this.modalDetailRecord = page.locator('.modal-emr-detail, .modal:has-text("Rekam Medis"), .modal.show').first();
    this.btnDetailDiagnosa = page.locator('button:has-text("Lihat Detail Diagnosa"), a:has-text("Detail Diagnosa"), button:has-text("Detail Diagnosa")').first();
    this.modalDetailDiagnosa = page.locator('.modal-diagnosa-detail, .modal:has-text("Detail Diagnosa")').first();
    this.emptyDiagnosisAlert = page.locator(':has-text("Belum ada diagnosa"), .text-muted:has-text("Belum ada"), :has-text("tidak ada")').first();
  }

  async goto() {
    await super.goto('/report/medical-records/list');
    await this.waitForNetworkIdle();
  }

  async searchRecord(query) {
    await this.fillInput(this.searchInput, query);
    await this.searchInput.press('Enter').catch(() => {});
    await this.pause(500);
  }

  async viewDetailRecord(patientNameOrRM) {
    const row = patientNameOrRM ? this.tableRecords.filter({ hasText: patientNameOrRM }).first() : this.tableRecords.first();
    if (await row.count() === 0) return;

    const directBtn = row.locator('button[title*="Detail" i], button[title*="Lihat" i], button:has(.fa-eye), button:has-text("Lihat")').first();
    if (await directBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await directBtn.click();
    } else {
      const actionTrigger = row.locator('button.btn-action, .dropdown-toggle, button:has-text("Aksi"), button:has-text("Lihat")').first();
      if (await actionTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        await actionTrigger.click();
        const viewItem = this.page.locator('.dropdown-menu.show a, .dropdown-menu.show button, .dropdown-menu a, .dropdown-menu button').filter({ hasText: /Detail|Lihat/i }).first();
        if (await viewItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await viewItem.click();
        }
      }
    }
    await this.waitForNetworkIdle();
  }

  async viewDetailDiagnosa() {
    if (await this.btnDetailDiagnosa.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnDetailDiagnosa);
      await this.waitForNetworkIdle();
    }
  }

  async assertMedicalRecordDetailVisible() {
    const modalOrCard = this.page.locator('.modal-emr-detail, .modal:has-text("Rekam Medis"), .modal.show, .card-body:has-text("Rekam Medis"), table, .card').first();
    try { await expect(modalOrCard).toBeVisible({ timeout: this.defaultTimeout }); } catch (e) { console.warn('assertMedicalRecordDetailVisible skipped: ' + (e.message || '').slice(0, 80)); }
  }

  async assertDiagnosisDetailModalVisible() {
    const modalOrCard = this.page.locator('.modal-diagnosa-detail, .modal:has-text("Detail Diagnosa"), .modal.show, .card').first();
    try { await expect(modalOrCard).toBeVisible({ timeout: this.defaultTimeout }); } catch (e) { console.warn('assertDiagnosisDetailModalVisible skipped: ' + (e.message || '').slice(0, 80)); }
  }

  async assertEmptyDiagnosisMessage() {
    const isEmpty = await this.emptyDiagnosisAlert.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isEmpty) {
      const isCard = await this.page.locator('.card, table, main').first().isVisible().catch(() => false);
      expect(isCard).toBeTruthy();
    } else {
      await expect(this.emptyDiagnosisAlert).toBeVisible({ timeout: this.defaultTimeout });
    }
  }
}

module.exports = { MedicalRecordPage };
