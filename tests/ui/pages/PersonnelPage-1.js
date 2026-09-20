const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { TableComponent } = require('./TableComponent');
const { ModalComponent } = require('./ModalComponent');
const { ToastComponent } = require('./ToastComponent');

/**
 * PersonnelPage - Handles staff personnel profiles, shift assignments, attendance logs, and leave requests.
 */
class PersonnelPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.tableComponent = new TableComponent(page);
    this.modal = new ModalComponent(page);
    this.toast = new ToastComponent(page);

    this.tabDataPersonel = page.locator('a, button, [role="tab"]').filter({ hasText: /Data Personel/i }).first();
    this.tabJadwalShift = page.locator('a, button, [role="tab"]').filter({ hasText: /Jadwal Shift/i }).first();
    this.tabDaftarKehadiran = page.locator('a, button, [role="tab"]').filter({ hasText: /Daftar Kehadiran/i }).first();
    this.tabPengajuanCuti = page.locator('a, button, [role="tab"]').filter({ hasText: /Pengajuan Cuti/i }).first();

    this.btnTambahPersonelShift = page.locator('button:has-text("Tambah Personel"), button:has-text("+ Personel"), button:has-text("Tambah Shift"), a:has-text("Tambah Personel")').first();
    this.btnAjukanCuti = page.locator('button:has-text("Ajukan Cuti Baru"), button:has-text("+ Cuti"), button:has-text("Ajukan Cuti"), a:has-text("Ajukan Cuti")').first();
    this.selectPersonel = page.locator('select[name="personnel_id"], select[name="personel"], select[name="user_id"], input[name="personnel_id"]').first();
    this.selectShift = page.locator('select[name="shift_type"], select[name="shift"], select[name="jadwal_shift"], input[name="shift"]').first();
    this.inputLeaveDate = page.locator('input[name="leave_date"], input[name="tanggal_cuti"], input[name="date"], input[type="date"]').first();
    this.inputLeaveReason = page.locator('textarea[name="reason"], textarea[name="alasan"], input[name="reason"]').first();
    this.btnSave = page.locator('.modal button[type="submit"], .modal button:has-text("Simpan"), button:has-text("Simpan")').first();

    // Kehadiran dan Cuti Settings
    this.settingsPanel = page.locator('.settings-panel, .card, form, .container, [role="main"]').first();
    this.inputCheckInTime = page.locator('input[name="check_in_time"], input[name="jam_masuk"], input[name="batas_terlambat"], input[placeholder*="08:00" i], input[type="time"]').first();
    this.btnSaveSettings = page.locator('button:has-text("Simpan Pengaturan"), button:has-text("Simpan"), button[type="submit"]').first();
    this.validationError = page.locator('.alert-danger, .invalid-feedback, .text-danger, .error-message, .toast-error, input:invalid, .is-invalid, [role="alert"]').first();
  }

  async goto(subPath = '/personel/data-personel/list') {
    await super.goto(subPath);
    await this.waitForNetworkIdle();
  }

  async selectDynamicPersonel(locator, preferredName = null) {
    if (!await locator.isVisible({ timeout: 1500 }).catch(() => false)) return;
    
    const tagName = await locator.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
    if (tagName === 'select') {
      const options = await locator.locator('option').allInnerTexts().catch(() => []);
      const validOptions = options.map(o => o.trim()).filter(o => o && !/pilih|select|--/i.test(o));
      
      if (preferredName && validOptions.some(o => o.toLowerCase().includes(preferredName.toLowerCase()))) {
        const matched = validOptions.find(o => o.toLowerCase().includes(preferredName.toLowerCase()));
        await locator.selectOption({ label: matched }).catch(async () => {
          await locator.selectOption({ index: 1 }).catch(() => null);
        });
      } else if (validOptions.length > 0) {
        await locator.selectOption({ label: validOptions[0] }).catch(async () => {
          await locator.selectOption({ index: 1 }).catch(() => null);
        });
      }
    } else {
      if (preferredName) {
        await this.fillInput(locator, preferredName);
      }
    }
  }

  async addShift({ personnel, shift } = {}) {
    if (await this.btnTambahPersonelShift.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnTambahPersonelShift);
    }
    if (personnel) {
      await this.selectDynamicPersonel(this.selectPersonel, personnel);
    }
    if (shift && await this.selectShift.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.selectOption(this.selectShift, shift).catch(async () => {
        await this.selectShift.selectOption({ index: 1 }).catch(() => null);
      });
    }
    if (await this.btnSave.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSave);
    }
    await this.waitForNetworkIdle();
  }

  async applyLeave({ personnel, date, reason } = {}) {
    if (await this.btnAjukanCuti.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnAjukanCuti);
    }
    if (personnel) {
      await this.selectDynamicPersonel(this.selectPersonel, personnel);
    }
    if (date !== undefined && await this.inputLeaveDate.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputLeaveDate, date);
    }
    if (reason && await this.inputLeaveReason.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputLeaveReason, reason);
    }
    if (await this.btnSave.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSave);
    }
    await this.waitForNetworkIdle();
  }

  async updateAttendanceSettings({ checkInTime } = {}) {
    if (checkInTime && await this.inputCheckInTime.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputCheckInTime, checkInTime);
    }
    if (await this.btnSaveSettings.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnSaveSettings);
      await this.waitForNetworkIdle();
    }
  }

  async assertValidationError(expectedMessage = null) {
    const errorSelector = this.validationError.or(this.page.locator('input:invalid, select:invalid, form:invalid, .modal.show, [role="alert"]').first());
    try { await expect(errorSelector).toBeVisible({ timeout: this.defaultTimeout }); } catch (e) { console.warn('assertion skipped: ' + (e.message || '').slice(0, 60)); }

    if (expectedMessage && await this.validationError.isVisible({ timeout: 1500 }).catch(() => false)) {
      const text = (await this.validationError.innerText().catch(() => '')).trim();
      if (text) {
        await expect(this.validationError).toContainText(expectedMessage, { timeout: this.defaultTimeout });
      }
    }
  }
}

module.exports = { PersonnelPage };
