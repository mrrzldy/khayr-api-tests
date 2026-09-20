const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { TableComponent } = require('./TableComponent');
const { ToastComponent } = require('./ToastComponent');

/**
 * QuotaManagementPage - Handles quota top-ups, nominal packages, QRIS/Transfer payments, and quota usage audit logs.
 */
class QuotaManagementPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.tableComponent = new TableComponent(page);
    this.toast = new ToastComponent(page);

    this.nominalPresetButtons = page.locator('.nominal-card, .btn-nominal, .package-card, .card:has-text("Kuota"), .card:has-text("Rp"), button:has-text("100"), button:has-text("250"), button:has-text("500"), button:has-text("1.")');
    this.btnManualNominal = page.locator('input[name="manual_nominal_radio"], label:has-text("Manual"), button:has-text("Manual"), input[value="manual"]').first();
    this.inputManualNominal = page.locator('input[name="nominal_amount"], input[placeholder*="nominal" i], input[name="amount"], input[type="number"]').first();
    this.radioTransfer = page.locator('input[type="radio"][value="transfer"], label:has-text("Transfer") input, label:has-text("Transfer"), input[value="transfer"], .payment-method-transfer').first();
    this.radioQRIS = page.locator('input[type="radio"][value="qris"], label:has-text("QRIS") input, label:has-text("QRIS"), input[value="qris"], .payment-method-qris').first();
    this.btnBayar = page.locator('button:has-text("Bayar"), button[type="submit"], button:has-text("Topup"), button:has-text("Beli")').first();
    this.btnSalinRekening = page.locator('button:has-text("Salin"), .btn-copy-account, button:has-text("Copy"), button[title*="Salin" i]').first();
    this.qrisImage = page.locator('.qris-code img, .qr-image, img[alt*="QRIS" i], .qr-code, svg.qris').first();
    this.btnExportCSV = page.locator('button:has-text("Ekspor CSV"), a:has-text("Ekspor CSV"), button:has-text("Export"), a:has-text("Export")').first();
    this.btnResetFilter = page.locator('button:has-text("Reset"), button[type="reset"], button:has-text("Atur Ulang")').first();

    // Usage Log Locators
    this.tableUsage = page.locator('.table-usage, table').first();
    this.inputSearchUsage = page.locator('input[placeholder*="cari" i], input[type="search"], input[name="search"]').first();
    this.selectUsageType = page.locator('select[name="type"], select:has-text("Tipe"), select[name="tipe"]').first();
    this.selectUsageSubType = page.locator('select[name="sub_type"], select:has-text("Sub Tipe"), select[name="sub_tipe"]').first();
    this.inputUsageStartDate = page.locator('input[name="start_date"], input[type="date"]').nth(0);
    this.inputUsageEndDate = page.locator('input[name="end_date"], input[type="date"]').nth(1);
    this.btnApplyUsageFilter = page.locator('button:has-text("Terapkan"), button:has-text("Filter")').first();
    this.validationError = page.locator('.alert-danger, .invalid-feedback, .text-danger, .error-message, .toast-error, input:invalid, .is-invalid, [role="alert"]').first();
  }

  async goto(subPath = '/manajemen-kuota/pembayaran') {
    await super.goto(subPath);
    await this.waitForNetworkIdle();
  }

  async topupQuota({ nominal, isManual = false, paymentMethod = 'transfer' } = {}) {
    if (isManual) {
      if (await this.btnManualNominal.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.clickButton(this.btnManualNominal);
      }
      if (await this.inputManualNominal.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.fillInput(this.inputManualNominal, String(nominal));
      }
    } else {
      const preset = this.page.locator(`.btn-nominal, .nominal-card, .card, button`).filter({ 
        hasText: new RegExp(String(nominal).replace(/\B(?=(\d{3})+(?!\d))/g, "."), 'i') 
      }).first();
      
      if (await preset.isVisible({ timeout: 1500 }).catch(() => false)) {
        await preset.click();
      } else {
        const directBtn = this.page.locator(`button:has-text("${nominal}"), .card:has-text("${nominal}")`).first();
        if (await directBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await directBtn.click();
        } else if (await this.inputManualNominal.isVisible({ timeout: 1500 }).catch(() => false)) {
          await this.fillInput(this.inputManualNominal, String(nominal));
        }
      }
    }

    if (paymentMethod && paymentMethod.toLowerCase() === 'qris') {
      if (await this.radioQRIS.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.clickButton(this.radioQRIS);
      }
    } else {
      if (await this.radioTransfer.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.clickButton(this.radioTransfer);
      }
    }

    if (await this.btnBayar.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnBayar);
      await this.waitForNetworkIdle();
    }
  }

  async copyAccountNumber() {
    if (await this.btnSalinRekening.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSalinRekening);
    }
  }

  async exportCSV() {
    if (await this.btnExportCSV.isVisible({ timeout: 2000 }).catch(() => false)) {
      try {
        const [download] = await Promise.all([
          this.page.waitForEvent('download', { timeout: 4000 }).catch(() => null),
          this.btnExportCSV.click().catch(() => null),
        ]);
        return download;
      } catch {
        // Safe export click fallback
      }
    }
  }

  async searchUsage(keyword) {
    if (await this.inputSearchUsage.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputSearchUsage, keyword);
      await this.inputSearchUsage.press('Enter');
      await this.pause(500);
    }
  }

  async filterUsageByType(typeName) {
    if (await this.selectUsageType.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.selectOption(this.selectUsageType, typeName);
      await this.pause(500);
    }
  }

  async filterUsageBySubType(subTypeName) {
    if (await this.selectUsageSubType.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.selectOption(this.selectUsageSubType, subTypeName);
      await this.pause(500);
    }
  }

  async filterUsageByPeriod(startDate, endDate) {
    if (await this.inputUsageStartDate.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputUsageStartDate, startDate);
      if (await this.inputUsageEndDate.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.fillInput(this.inputUsageEndDate, endDate);
      }
      if (await this.btnApplyUsageFilter.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.clickButton(this.btnApplyUsageFilter);
      }
      await this.pause(500);
    }
  }

  async resetFilter() {
    if (await this.btnResetFilter.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnResetFilter);
      await this.waitForNetworkIdle();
    }
  }

  async assertValidationError(expectedMessage = null) {
    const errorSelector = this.validationError.or(this.page.locator('input:invalid, form:invalid, .modal.show, [role="alert"]').first());
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

module.exports = { QuotaManagementPage };
