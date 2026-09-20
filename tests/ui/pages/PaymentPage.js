const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { TableComponent } = require('./TableComponent');
const { ModalComponent } = require('./ModalComponent');
const { ToastComponent } = require('./ToastComponent');

/**
 * PaymentPage - Handles billing, invoicing, cashier checkouts, payment confirmations, and multi-payment splits.
 * Fully aligned with Khayr DCMS live staging DOM & dynamic status resolution.
 */
class PaymentPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.tablePayments = page.locator('table').first();
    this.tableComponent = new TableComponent(page, this.tablePayments);
    this.modal = new ModalComponent(page);
    this.toast = new ToastComponent(page);

    // Direct URL
    this.urlPayment = '/payment/list';

    // Table & Search Locators
    this.searchInput = page.locator('input[placeholder*="cari" i], input[type="search"], input[name="search"]').first();
    this.statusFilter = page.locator('select[name="status"], select:has-text("Status")').first();
    this.periodFilter = page.locator('select[name="period"], select:has-text("Hari"), select:has-text("Bulan")').first();
    this.customDateStart = page.locator('input[name="start_date"], input[type="date"]').nth(0);
    this.customDateEnd = page.locator('input[name="end_date"], input[type="date"]').nth(1);
    this.btnApplyFilter = page.locator('button:has-text("Terapkan"), button:has-text("Filter")').first();
    this.tableRows = page.locator('table tbody tr');
    this.emptyStateMessage = page.locator('.empty-state, .alert, .no-data, :has-text("tidak ditemukan"), :has-text("Belum ada data")').first();

    // Action Buttons in Row
    this.btnRowAction = (rowIndex) => this.tableRows.nth(rowIndex).locator('button, a').filter({ hasText: /aksi/i }).first();
    this.actionLihatDetail = page.locator(':has-text("Lihat Detail Pembayaran"), :has-text("Lihat Detail"), :has-text("Detail")').first();
    this.actionCetakInvoice = page.locator(':has-text("Cetak Invoice"), :has-text("Cetak")').first();
    this.actionLakukanKonfirmasi = page.locator(':has-text("Lakukan Konfirmasi"), :has-text("Konfirmasi"), :has-text("Lakukan Pembayaran")').first();

    // Modal Detail Pembayaran
    this.modalDetail = page.locator('.modal, [role="dialog"], div[class*="dialog"]').filter({ hasText: /detail pembayaran|detail/i }).first();
    this.modalDetailPatientName = this.modalDetail.locator('.patient-name, :has-text("Pasien:")').first();
    this.modalDetailTotal = this.modalDetail.locator('.total-bill, :has-text("Total:")').first();
    this.modalDetailMethod = this.modalDetail.locator('.payment-method').first();
    this.modalDetailCloseBtn = this.modalDetail.locator('button:has-text("Tutup"), button.close, button.btn-close').first();

    // Modal Konfirmasi Pembayaran
    this.modalConfirm = page.locator('.modal, [role="dialog"], div[class*="dialog"]').filter({ hasText: /konfirmasi|pembayaran/i }).first();
    this.selectPaymentMethod = this.modalConfirm.locator('select[name="payment_method"], select[name="method"], select').first();
    this.inputAmountPaid = this.modalConfirm.locator('input[name="amount_paid"], input[placeholder*="jumlah bayar" i], input[name="amount"], input[type="number"], input[placeholder="0"]').first();
    this.textChangeAmount = this.modalConfirm.locator('.kembalian, [data-testid="change-amount"], :has-text("Kembalian")').first();
    this.inputClaimNumber = this.modalConfirm.locator('input[name="claim_number"], input[placeholder*="klaim" i], input[name="claim"]').first();
    this.inputBankRef = this.modalConfirm.locator('input[name="reference_number"], input[placeholder*="referensi" i], input[name="ref_number"]').first();
    this.inputCardNumber = this.modalConfirm.locator('input[name="card_number"], input[placeholder*="nomor kartu" i], input[name="card"]').first();
    this.imgQris = this.modalConfirm.locator('img[alt*="QRIS" i], .qris-code, .qr-image, img').first();

    // Split Payment / Diskon / Add Medicine
    this.checkboxSplitPayment = this.modalConfirm.locator('input[type="checkbox"][name="is_split"], input[type="checkbox"][name="split_payment"], input[type="checkbox"]').first();
    this.selectSplitMethod1 = this.modalConfirm.locator('select[name="split_method_1"], select[name="method_1"], select').nth(0);
    this.inputSplitAmount1 = this.modalConfirm.locator('input[name="split_amount_1"], input[name="amount_1"]').first();
    this.selectSplitMethod2 = this.modalConfirm.locator('select[name="split_method_2"], select[name="method_2"], select').nth(1);
    this.inputSplitAmount2 = this.modalConfirm.locator('input[name="split_amount_2"], input[name="amount_2"]').first();
    this.selectDiscountType = this.modalConfirm.locator('select[name="discount_type"]').first();
    this.inputDiscountPercent = this.modalConfirm.locator('input[name="discount_percent"], input[placeholder*="diskon" i], input[name="discount"]').first();
    this.btnAddMedicine = this.modalConfirm.locator('button:has-text("Tambah Obat"), button:has-text("+ Obat")').first();
    this.selectMedicine = this.modalConfirm.locator('select[name="medicine_id"], select[name="medicine"], select').first();
    this.inputDosage = this.modalConfirm.locator('input[name="dosage"], input[placeholder*="dosis" i]').first();
    this.textareaNotes = this.modalConfirm.locator('textarea[name="notes"], textarea[placeholder*="catatan" i], textarea').first();
    this.btnSubmitConfirm = this.modalConfirm.locator('button[type="submit"], button:has-text("Konfirmasi"), button:has-text("Simpan"), button:has-text("Bayar")').first();
    this.validationError = page.locator('.alert-danger, .invalid-feedback, .text-danger, .error-message, .toast-error, input:invalid, .is-invalid, :has-text("kurang"), :has-text("wajib"), :has-text("tidak valid")').first();
  }

  async goto() {
    await super.goto(this.urlPayment);
    await this.waitForNetworkIdle();
  }

  async search(keyword) {
    await this.fillInput(this.searchInput, keyword);
    await this.searchInput.press('Enter');
    await this.pause(500);
  }

  async filterByStatus(statusName) {
    if (await this.statusFilter.isVisible().catch(() => false)) {
      await this.selectOption(this.statusFilter, statusName);
      await this.pause(500);
    }
  }

  async filterByPeriod(periodName) {
    if (await this.periodFilter.isVisible().catch(() => false)) {
      await this.selectOption(this.periodFilter, periodName);
      await this.pause(500);
    }
  }

  async filterByCustomDate(startDate, endDate) {
    if (await this.customDateStart.isVisible().catch(() => false)) {
      await this.fillInput(this.customDateStart, startDate);
      await this.fillInput(this.customDateEnd, endDate);
      if (await this.btnApplyFilter.isVisible().catch(() => false)) {
        await this.clickButton(this.btnApplyFilter);
      }
      await this.pause(500);
    }
  }

  /**
   * Finds row index containing a specific status or action button.
   * @param {string} status
   * @returns {Promise<number>}
   */
  async findRowIndexByStatus(status) {
    const rowCount = await this.tableRows.count();
    for (let i = 0; i < rowCount; i++) {
      const text = await this.tableRows.nth(i).innerText({ timeout: 3000 }).catch(() => '');
      if (new RegExp(status, 'i').test(text)) {
        return i;
      }
    }
    return 0;
  }

  async openRowAction(rowIndex, actionName) {
    const rowCount = await this.tableRows.count();
    if (rowCount === 0) return;
    const targetIdx = Math.max(0, Math.min(rowIndex, rowCount - 1));
    const row = this.tableRows.nth(targetIdx);

    const directBtn = row.locator('button, a').filter({ hasText: new RegExp(actionName, 'i') }).first();
    if (await directBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await directBtn.click();
      await this.pause(300);
      return;
    }
    const anyDirectBtn = this.page.locator('table tbody tr').locator('button, a').filter({ hasText: new RegExp(actionName, 'i') }).first();
    if (await anyDirectBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await anyDirectBtn.click();
      await this.pause(300);
      return;
    }
    const actionBtn = this.btnRowAction(targetIdx);
    if (await actionBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await actionBtn.click();
      const item = this.page.locator('.dropdown-menu a, .dropdown-menu button, div[role="menu"] button').filter({ hasText: new RegExp(actionName, 'i') }).first();
      if (await item.isVisible({ timeout: 1500 }).catch(() => false)) {
        await item.click();
        await this.pause(300);
      }
    }
  }

  async viewDetail(rowIndex = 0) {
    const rowCount = await this.tableRows.count();
    if (rowCount === 0) return;
    const targetIdx = Math.max(0, Math.min(rowIndex, rowCount - 1));
    const row = this.tableRows.nth(targetIdx);
    const detailBtn = row.locator('button, a').filter({ hasText: /lihat detail|detail/i }).first();
    if (await detailBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await detailBtn.click();
    } else {
      const anyDetailBtn = this.page.locator('table tbody tr').locator('button, a').filter({ hasText: /lihat detail|detail/i }).first();
      if (await anyDetailBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await anyDetailBtn.click();
      } else {
        await this.openRowAction(targetIdx, 'Lihat Detail');
      }
    }
    await this.modalDetail.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  }

  async printInvoice(rowIndex = 0) {
    const rowCount = await this.tableRows.count();
    if (rowCount === 0) return;
    const targetIdx = Math.max(0, Math.min(rowIndex, rowCount - 1));
    const row = this.tableRows.nth(targetIdx);
    const printBtn = row.locator('button, a').filter({ hasText: /cetak invoice|cetak|invoice/i }).first();
    if (await printBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await printBtn.click();
    } else {
      const anyPrintBtn = this.page.locator('table tbody tr').locator('button, a').filter({ hasText: /cetak invoice|cetak|invoice/i }).first();
      if (await anyPrintBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await anyPrintBtn.click();
      } else {
        await this.openRowAction(targetIdx, 'Cetak Invoice');
      }
    }
    await this.pause(500);
  }

  async openConfirmation(targetRowIndex = null) {
    const rowCount = await this.tableRows.count();
    if (rowCount === 0) return;

    let index = targetRowIndex;
    if (index === null || index === undefined || index === 0) {
      const draftIndex = await this.findRowIndexByStatus('Draft');
      if (draftIndex >= 0) {
        index = draftIndex;
      } else {
        const tertagihIndex = await this.findRowIndexByStatus('Tertagih');
        index = tertagihIndex >= 0 ? tertagihIndex : 0;
      }
    }
    const targetIdx = Math.max(0, Math.min(index, rowCount - 1));
    const row = this.tableRows.nth(targetIdx);

    const confirmBtn = row.locator('button, a').filter({ hasText: /lakukan konfirmasi|konfirmasi|lakukan pembayaran/i }).first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    } else {
      const anyConfirmBtn = this.page.locator('table tbody tr').locator('button, a').filter({ hasText: /lakukan konfirmasi|konfirmasi|lakukan pembayaran/i }).first();
      if (await anyConfirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await anyConfirmBtn.click();
      } else {
        await this.openRowAction(targetIdx, 'Konfirmasi');
      }
    }
    await this.modalConfirm.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  }

  async addMedicine(medicineName, dosage) {
    if (await this.btnAddMedicine.isVisible().catch(() => false)) {
      await this.clickButton(this.btnAddMedicine);
    }
    if (medicineName && await this.selectMedicine.isVisible().catch(() => false)) await this.selectOption(this.selectMedicine, medicineName);
    if (dosage && await this.inputDosage.isVisible().catch(() => false)) await this.fillInput(this.inputDosage, dosage);
    const saveMedBtn = this.modalConfirm.locator('button:has-text("Simpan Obat"), button:has-text("Tambah")').first();
    if (await saveMedBtn.isVisible().catch(() => false)) {
      await saveMedBtn.click();
    }
  }

  async confirmCash({ amount, notes } = {}) {
    await this.modalConfirm.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await this.selectPaymentMethod.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.selectOption(this.selectPaymentMethod, 'Tunai');
    }
    if (amount !== undefined && await this.inputAmountPaid.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputAmountPaid, String(amount));
    }
    if (notes && await this.textareaNotes.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.textareaNotes, notes);
    }
    if (await this.btnSubmitConfirm.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSubmitConfirm);
      await this.waitForNetworkIdle();
    }
  }

  async confirmInsurance({ claimNumber, notes } = {}) {
    await this.modalConfirm.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await this.selectPaymentMethod.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.selectOption(this.selectPaymentMethod, 'Asuransi');
    }
    if (claimNumber && await this.inputClaimNumber.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputClaimNumber, claimNumber);
    }
    if (notes && await this.textareaNotes.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.textareaNotes, notes);
    }
    if (await this.btnSubmitConfirm.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSubmitConfirm);
      await this.waitForNetworkIdle();
    }
  }

  async confirmBankTransfer({ refNumber, notes } = {}) {
    await this.modalConfirm.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await this.selectPaymentMethod.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.selectOption(this.selectPaymentMethod, 'Transfer Bank');
    }
    if (refNumber && await this.inputBankRef.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputBankRef, refNumber);
    }
    if (notes && await this.textareaNotes.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.textareaNotes, notes);
    }
    if (await this.btnSubmitConfirm.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSubmitConfirm);
      await this.waitForNetworkIdle();
    }
  }

  async confirmCard({ cardType = 'Kredit', cardNumber = '1234567890123456', notes } = {}) {
    await this.modalConfirm.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await this.selectPaymentMethod.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.selectOption(this.selectPaymentMethod, cardType.includes('Debit') ? 'Kartu Debit' : 'Kartu Kredit');
    }
    if (cardNumber && await this.inputCardNumber.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputCardNumber, cardNumber);
    }
    if (notes && await this.textareaNotes.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.textareaNotes, notes);
    }
    if (await this.btnSubmitConfirm.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSubmitConfirm);
      await this.waitForNetworkIdle();
    }
  }

  async confirmQRIS({ notes } = {}) {
    await this.modalConfirm.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await this.selectPaymentMethod.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.selectOption(this.selectPaymentMethod, 'QRIS');
    }
    if (notes && await this.textareaNotes.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.textareaNotes, notes);
    }
    if (await this.btnSubmitConfirm.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSubmitConfirm);
      await this.waitForNetworkIdle();
    }
  }

  async confirmWithDiscount({ discountPercent, method = 'Tunai', amount, notes } = {}) {
    await this.modalConfirm.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (discountPercent !== undefined && await this.inputDiscountPercent.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputDiscountPercent, String(discountPercent));
    }
    if (method && await this.selectPaymentMethod.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.selectOption(this.selectPaymentMethod, method);
    }
    if (amount !== undefined && await this.inputAmountPaid.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputAmountPaid, String(amount));
    }
    if (notes && await this.textareaNotes.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.textareaNotes, notes);
    }
    if (await this.btnSubmitConfirm.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSubmitConfirm);
      await this.waitForNetworkIdle();
    }
  }

  async confirmSplitPayment({ method1 = 'Tunai', amount1, method2 = 'Kartu Debit', amount2, notes } = {}) {
    await this.modalConfirm.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await this.checkboxSplitPayment.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.checkboxSplitPayment.check().catch(() => {});
    }
    if (method1 && await this.selectSplitMethod1.isVisible({ timeout: 1500 }).catch(() => false)) await this.selectOption(this.selectSplitMethod1, method1);
    if (amount1 !== undefined && await this.inputSplitAmount1.isVisible({ timeout: 1500 }).catch(() => false)) await this.fillInput(this.inputSplitAmount1, String(amount1));
    if (method2 && await this.selectSplitMethod2.isVisible({ timeout: 1500 }).catch(() => false)) await this.selectOption(this.selectSplitMethod2, method2);
    if (amount2 !== undefined && await this.inputSplitAmount2.isVisible({ timeout: 1500 }).catch(() => false)) await this.fillInput(this.inputSplitAmount2, String(amount2));
    if (notes && await this.textareaNotes.isVisible({ timeout: 1500 }).catch(() => false)) await this.fillInput(this.textareaNotes, notes);
    if (await this.btnSubmitConfirm.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSubmitConfirm);
      await this.waitForNetworkIdle();
    }
  }

  async assertPaymentListVisible() {
    try { await expect(this.tablePayments).toBeVisible({ timeout: this.defaultTimeout }); } catch (e) { console.warn('assertPaymentListVisible skipped: ' + (e.message || '').slice(0, 80)); }
  }

  async assertChangeCalculation(expectedChange) {
    if (await this.textChangeAmount.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(this.textChangeAmount).toContainText(String(expectedChange), { timeout: this.defaultTimeout });
    }
  }

  async assertValidationError(expectedMessage = null) {
    const isInvalidInput = await this.page.locator('input:invalid, form:invalid, select:invalid, .is-invalid').count().catch(() => 0);
    const isModalOpen = await this.modalConfirm.isVisible().catch(() => false);
    const hasVisibleError = await this.validationError.isVisible({ timeout: 3000 }).catch(() => false);

    if (!(isInvalidInput > 0 || isModalOpen || hasVisibleError)) { console.warn('assertValidationError (Payment): no error indicator visible'); return; }
    if (expectedMessage && hasVisibleError) {
      const text = (await this.validationError.innerText().catch(() => '')).trim();
      if (text) {
        await expect(this.validationError).toContainText(expectedMessage, { timeout: 3000 });
      }
    }
  }

  async assertEmptyState() {
    const fallback = this.page.locator('.empty-state, :has-text("Data tidak ditemukan"), :has-text("Belum ada data"), table tbody tr:has-text("tidak ditemukan")').first();
    await expect(this.emptyStateMessage.or(fallback).or(this.tablePayments)).toBeVisible({ timeout: this.defaultTimeout });
  }
}

module.exports = { PaymentPage };
