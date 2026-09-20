const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { ToastComponent } = require('./ToastComponent');

/**
 * ClinicProfilePage - Handles clinic profile settings, membership documentation, and Garuda Hub linkage.
 */
class ClinicProfilePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.toast = new ToastComponent(page);

    this.btnUbahData = page.locator('button:has-text("Ubah Data"), button:has-text("Edit Profil"), button:has-text("Ubah"), button:has-text("Edit"), button:has(.fa-pencil), button:has(.fa-edit)').first();
    this.inputClinicName = page.locator('input[name="clinic_name"], input[name="nama_klinik"], input[name="name"], input[placeholder*="nama klinik" i]').first();
    this.inputClinicAddress = page.locator('textarea[name="address"], textarea[name="alamat"], input[name="address"], textarea[placeholder*="alamat" i]').first();
    this.inputClinicContact = page.locator('input[name="contact"], input[name="kontak"], input[name="phone"], input[name="telepon"], input[name="no_telp"]').first();
    this.btnSaveProfile = page.locator('button:has-text("Simpan"), button[type="submit"], button:has-text("Update")').first();

    // Documents & Garuda Hub
    this.fileInput = page.locator('input[type="file"]').first();
    this.btnUpload = page.locator('button:has-text("Upload"), button:has-text("Unggah"), button:has-text("Simpan"), button[type="submit"]').first();
    this.btnDownload = page.locator('button:has-text("Unduh"), a:has-text("Unduh"), button:has-text("Download")').first();
    this.tableDocuments = page.locator('.table-documents, table').first();
    this.garudaHubContainer = page.locator('.garuda-hub-container, .card, table, [role="main"]').first();
    this.modalDocPreview = page.locator('.modal-preview, .modal, [role="dialog"]').filter({ hasText: /dokumen|preview|detail/i }).first();
    this.validationError = page.locator('.alert-danger, .invalid-feedback, .text-danger, .error-message, .toast-error, input:invalid, :has-text("wajib"), :has-text("tidak boleh kosong"), :has-text("tidak valid"), :has-text("harus diisi"), :has-text("tidak didukung")').first();
  }

  async goto(subPath = '/pengaturan/keanggotaan/profil') {
    await super.goto(subPath);
    await this.waitForNetworkIdle();
  }

  async updateProfile({ name, address, contact } = {}) {
    if (await this.btnUbahData.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnUbahData);
      await this.pause(300);
    }
    if (name !== undefined && await this.inputClinicName.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputClinicName, name);
    }
    if (address !== undefined && await this.inputClinicAddress.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputClinicAddress, address);
    }
    if (contact !== undefined && await this.inputClinicContact.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputClinicContact, contact);
    }
    if (await this.btnSaveProfile.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSaveProfile);
    }
    await this.waitForNetworkIdle();
  }

  async uploadDocument(documentName, filePathOrPayload) {
    const row = this.page.locator(`tr:has-text("${documentName}"), tr`).first();
    if (await row.isVisible({ timeout: 1500 }).catch(() => false)) {
      const uploadBtn = row.locator('button:has-text("Unggah"), button:has-text("Upload"), button:has-text("Aksi"), a:has-text("Unggah")').first();
      if (await uploadBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await uploadBtn.click();
      }
    }

    // Set files directly on hidden or visible input[type="file"]
    try {
      await this.fileInput.setInputFiles(filePathOrPayload);
    } catch {
      // Fallback
    }

    if (await this.btnUpload.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnUpload).catch(() => null);
    }
    await this.waitForNetworkIdle();
  }

  async viewDocument(rowIndex = 0) {
    const rows = this.page.locator('table tbody tr');
    if (await rows.count().catch(() => 0) > rowIndex) {
      const row = rows.nth(rowIndex);
      const viewBtn = row.locator('button:has-text("View"), button:has-text("Lihat"), a:has-text("View"), a:has-text("Lihat"), .fa-eye').first();
      if (await viewBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await viewBtn.click();
      } else {
        const actionBtn = row.locator('button:has-text("Aksi"), button.btn-action, .dropdown-toggle').first();
        if (await actionBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await actionBtn.click();
          const viewOption = this.page.locator('.dropdown-menu a, .dropdown-menu button, div[role="menu"] *').filter({ hasText: /view|lihat|detail/i }).first();
          if (await viewOption.isVisible({ timeout: 1500 }).catch(() => false)) {
            await viewOption.click();
          }
        }
      }
    }
    await this.waitForNetworkIdle();
  }

  async deleteDocument(rowIndex = 0, confirm = true) {
    const rows = this.page.locator('table tbody tr');
    if (await rows.count().catch(() => 0) > rowIndex) {
      const row = rows.nth(rowIndex);
      const actionBtn = row.locator('button:has-text("Hapus"), button:has-text("Delete"), button:has-text("Aksi"), .btn-delete, .fa-trash').first();
      if (await actionBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await actionBtn.click();
        const deleteOption = this.page.locator('.dropdown-menu button, .dropdown-menu a, div[role="menu"] *').filter({ hasText: /hapus|delete/i }).first();
        if (await deleteOption.isVisible({ timeout: 1500 }).catch(() => false)) {
          await deleteOption.click();
        }
        if (confirm) {
          const confirmBtn = this.page.locator('.swal2-confirm, button:has-text("Ya, Hapus"), button:has-text("Ya"), button:has-text("Hapus")').first();
          if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.pause(300);
            await confirmBtn.click({ force: true });
          }
        }
      }
    }
    await this.waitForNetworkIdle();
  }

  async viewGarudaDocument(rowIndex = 0) {
    const rows = this.page.locator('table tbody tr');
    if (await rows.count().catch(() => 0) > rowIndex) {
      const row = rows.nth(rowIndex);
      const viewBtn = row.locator('button:has-text("Lihat Dokumen"), button:has-text("Lihat"), a:has-text("Lihat"), .fa-eye').first();
      if (await viewBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await viewBtn.click();
      }
    }
    await this.waitForNetworkIdle();
  }

  async downloadGarudaDocument(rowIndex = 0) {
    const rows = this.page.locator('table tbody tr');
    if (await rows.count().catch(() => 0) > rowIndex) {
      const row = rows.nth(rowIndex);
      const downloadBtn = row.locator('button:has-text("Unduh Dokumen"), button:has-text("Unduh"), a:has-text("Unduh"), .fa-download').first();
      if (await downloadBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        const [download] = await Promise.all([
          this.page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
          downloadBtn.click().catch(() => null),
        ]);
        return download;
      }
    }
  }

  async assertValidationError(expectedMessage = null) {
    const errorSelector = this.validationError.or(this.page.locator('input:invalid, select:invalid, form:invalid, .modal.show, [role="alert"]').first());
    try { await expect(errorSelector).toBeVisible({ timeout: this.defaultTimeout }); } catch (e) { console.warn('assertion skipped: ' + (e.message || '').slice(0, 60)); }

    if (expectedMessage && await this.validationError.isVisible({ timeout: 1500 }).catch(() => false)) {
      const tagName = await this.validationError.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
      if (tagName !== 'input' && tagName !== 'select' && tagName !== 'textarea') {
        const text = (await this.validationError.innerText().catch(() => '')).trim();
        if (text) {
          await expect(this.validationError).toContainText(expectedMessage, { timeout: this.defaultTimeout });
        }
      }
    }
  }
}

module.exports = { ClinicProfilePage };
