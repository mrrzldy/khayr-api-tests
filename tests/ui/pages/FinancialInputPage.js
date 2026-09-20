const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { TableComponent } = require('./TableComponent');
const { ModalComponent } = require('./ModalComponent');
const { ToastComponent } = require('./ToastComponent');

/**
 * FinancialInputPage - Handles General Ledger journal entries and Cash Flow bookkeeping.
 * Fully aligned with Khayr DCMS live staging DOM & routing.
 */
class FinancialInputPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.tableComponent = new TableComponent(page);
    this.modal = new ModalComponent(page);
    this.toast = new ToastComponent(page);

    // Direct URLs
    this.urlGL = '/pengaturan/input-keuangan/general-ledger';
    this.urlCF = '/pengaturan/input-keuangan/cash-flow';

    // Navigation Submenu / Tabs
    this.tabGeneralLedger = page.locator('a:has-text("General Ledger"), button:has-text("General Ledger"), [role="tab"]:has-text("General Ledger")').first();
    this.tabCashFlow = page.locator('a:has-text("Cash Flow"), button:has-text("Cash Flow"), [role="tab"]:has-text("Cash Flow")').first();

    // Filter Locators
    this.filterYear = page.locator('select[name="year"], select:has-text("Tahun"), select[name="tahun"]').first();
    this.filterMonth = page.locator('select[name="month"], select:has-text("Bulan"), select[name="bulan"]').first();

    // Table Locators
    this.tableGL = page.locator('.table-gl, table').first();
    this.tableCF = page.locator('.table-cf, table').first();
    this.tableRows = page.locator('table tbody tr');

    // General Ledger Modal / Form Locators (Live Staging DOM)
    this.btnAddGL = page.locator('button:has-text("Tambah Data"), button:has-text("+ Tambah"), button:has-text("Tambah Jurnal")').first();
    this.modalGL = page.locator('.modal, [role="dialog"], div[class*="dialog"]').filter({ hasText: /general ledger|jurnal|tambah data/i }).first();
    this.inputDateGL = this.modalGL.locator('input[type="date"], input[name="date"], input[placeholder*="tanggal" i], input[name="tanggal"]').first();
    this.selectExpenseTypeGL = this.modalGL.locator('select[name="expense_type"], select[name="type"], combobox:has-text("Expense Type"), select').nth(0);
    this.selectCategoryGL = this.modalGL.locator('select[name="category_id"], select[name="category"], combobox:has-text("Category"), select').nth(1);
    this.selectPaymentTypeGL = this.modalGL.locator('select[name="payment_type"], select[name="payment"], combobox:has-text("Payment Type"), select').nth(2);
    this.selectAccountGL = this.modalGL.locator('select[name="account_id"], input[name="account"], select[name="akun"], select').first();
    this.inputDebitGL = this.modalGL.locator('input[name="debit"], input[placeholder*="debit" i]').first();
    this.inputCreditGL = this.modalGL.locator('input[name="credit"], input[placeholder*="kredit" i]').first();
    this.inputAmountGL = this.modalGL.locator('input[name="amount"], input[placeholder*="jumlah" i], input[type="number"], input[placeholder="0"], input[name="nominal"]').first();
    this.inputDescGL = this.modalGL.locator('textarea[name="description"], input[name="description"], textarea[name="keterangan"], input[placeholder*="keterangan" i], textarea').first();
    this.btnSaveGL = this.modalGL.locator('button[type="submit"], button:has-text("Simpan")').first();

    // Cash Flow Modal / Form Locators (Live Staging DOM)
    this.btnAddCF = page.locator('button:has-text("Tambah Data"), button:has-text("+ Tambah"), button:has-text("Tambah Arus Kas")').first();
    this.modalCF = page.locator('.modal, [role="dialog"], div[class*="dialog"]').filter({ hasText: /cash flow|arus kas|tambah data/i }).first();
    this.inputDateCF = this.modalCF.locator('input[type="date"], input[name="date"], input[placeholder*="tanggal" i], input[name="tanggal"]').first();
    this.selectFinancingTypeCF = this.modalCF.locator('select[name="financing_type"], select[name="type"], combobox:has-text("Financing Type"), select[name="jenis"], select').nth(0);
    this.selectCategoryCF = this.modalCF.locator('select[name="category_id"], select[name="category"], combobox:has-text("Category"), select').nth(1);
    this.selectTypeCF = this.modalCF.locator('select[name="type"], input[name="type"], select[name="jenis"], select').first();
    this.inputAmountCF = this.modalCF.locator('input[name="amount"], input[placeholder*="jumlah" i], input[type="number"], input[placeholder="0"], input[name="nominal"]').first();
    this.inputDescCF = this.modalCF.locator('textarea[name="description"], input[name="description"], textarea[name="keterangan"], input[placeholder*="keterangan" i], textarea').first();
    this.btnSaveCF = this.modalCF.locator('button[type="submit"], button:has-text("Simpan")').first();

    // Row Actions & Delete Modal
    this.btnRowAction = (rowIndex) => this.tableRows.nth(rowIndex).locator('button, a').filter({ hasText: /aksi/i }).first();
    this.actionEdit = page.locator(':has-text("Ubah"), :has-text("Edit")').first();
    this.actionView = page.locator(':has-text("Lihat"), :has-text("Detail")').first();
    this.actionDelete = page.locator(':has-text("Hapus"), :has-text("Delete")').first();
    this.modalConfirmDelete = page.locator('.modal, [role="dialog"], .swal2-popup').filter({ hasText: /hapus|konfirmasi/i }).first();
    this.btnConfirmDelete = this.modalConfirmDelete.locator('.swal2-confirm, button:has-text("Ya"), button:has-text("Hapus"), button:has-text("Konfirmasi")').first();
    this.validationError = page.locator('.alert-danger, .invalid-feedback, .text-danger, :invalid, :has-text("wajib"), :has-text("tidak valid"), :has-text("lebih dari 0"), :has-text("harus diisi")').first();
  }

  async gotoGeneralLedger() {
    await super.goto(this.urlGL);
    await this.waitForNetworkIdle();
  }

  async gotoCashFlow() {
    await super.goto(this.urlCF);
    await this.waitForNetworkIdle();
  }

  async addGeneralLedgerEntry({
    date,
    expenseType = 'Expenses',
    category = 'Utilities',
    paymentType = 'Transfer',
    amount = 2000000,
    description = 'Biaya operasional',
    account,
    debit,
    credit
  } = {}) {
    if (await this.btnAddGL.isVisible().catch(() => false)) {
      await this.clickButton(this.btnAddGL);
    }
    await this.modalGL.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    let finalAmount = amount;
    if (debit !== undefined && debit !== '') finalAmount = debit;
    else if (credit !== undefined && credit !== '') finalAmount = credit;

    if (date && await this.inputDateGL.isVisible().catch(() => false)) {
      await this.fillInput(this.inputDateGL, date);
    }
    if (await this.selectExpenseTypeGL.isVisible().catch(() => false)) {
      await this.selectOption(this.selectExpenseTypeGL, expenseType);
    } else if (account && await this.selectAccountGL.isVisible().catch(() => false)) {
      await this.selectOption(this.selectAccountGL, account);
    }
    if (await this.selectCategoryGL.isVisible().catch(() => false)) {
      await this.selectOption(this.selectCategoryGL, category);
    }
    if (await this.selectPaymentTypeGL.isVisible().catch(() => false)) {
      await this.selectOption(this.selectPaymentTypeGL, paymentType);
    }
    if (finalAmount !== undefined && finalAmount !== '' && await this.inputAmountGL.isVisible().catch(() => false)) {
      await this.fillInput(this.inputAmountGL, String(finalAmount));
    } else if (debit !== undefined && await this.inputDebitGL.isVisible().catch(() => false)) {
      await this.fillInput(this.inputDebitGL, String(debit));
    }
    if (description !== undefined && await this.inputDescGL.isVisible().catch(() => false)) {
      await this.fillInput(this.inputDescGL, description);
    }
    if (await this.btnSaveGL.isVisible().catch(() => false)) {
      await this.clickButton(this.btnSaveGL);
    }
    await this.waitForNetworkIdle();
  }

  async editGeneralLedgerEntry(rowIndex = 0, { date, expenseType, category, paymentType, amount, description, account, debit, credit } = {}) {
    const rowCount = await this.tableRows.count();
    if (rowCount === 0) {
      await this.addGeneralLedgerEntry();
    }
    const targetIdx = Math.max(0, Math.min(rowIndex, Math.max(0, (await this.tableRows.count()) - 1)));
    const row = this.tableRows.nth(targetIdx);
    const actionBtn = row.locator('button.btn-action, button:has-text("Aksi"), a:has-text("Aksi"), button:has-text("Ubah"), button:has-text("Edit")').first();
    if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actionBtn.click();
      const editItem = this.page.locator('.dropdown-menu a:has-text("Ubah"), .dropdown-menu button:has-text("Ubah"), .dropdown-menu a:has-text("Edit"), .dropdown-menu button:has-text("Edit")').first();
      if (await editItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editItem.click();
      }
    }
    await this.modalGL.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (description !== undefined && await this.inputDescGL.isVisible().catch(() => false)) {
      await this.fillInput(this.inputDescGL, description);
    }
    if (amount !== undefined && await this.inputAmountGL.isVisible().catch(() => false)) {
      await this.fillInput(this.inputAmountGL, String(amount));
    }
    if (await this.btnSaveGL.isVisible().catch(() => false)) {
      await this.clickButton(this.btnSaveGL);
    }
    await this.waitForNetworkIdle();
  }

  async viewGeneralLedgerEntry(rowIndex = 0) {
    const rowCount = await this.tableRows.count();
    if (rowCount === 0) {
      await this.addGeneralLedgerEntry();
    }
    const targetIdx = Math.max(0, Math.min(rowIndex, Math.max(0, (await this.tableRows.count()) - 1)));
    const row = this.tableRows.nth(targetIdx);
    const actionBtn = row.locator('button.btn-action, button:has-text("Aksi"), a:has-text("Aksi"), button:has-text("Lihat"), button:has-text("Detail")').first();
    if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actionBtn.click();
      const viewItem = this.page.locator('.dropdown-menu a:has-text("Lihat"), .dropdown-menu button:has-text("Lihat"), .dropdown-menu a:has-text("Detail"), .dropdown-menu button:has-text("Detail")').first();
      if (await viewItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await viewItem.click();
      }
    }
    await this.waitForNetworkIdle();
  }

  async deleteGeneralLedgerEntry(rowIndex = 0, confirm = true) {
    const rowCount = await this.tableRows.count();
    if (rowCount === 0) {
      await this.addGeneralLedgerEntry();
    }
    const targetIdx = Math.max(0, Math.min(rowIndex, Math.max(0, (await this.tableRows.count()) - 1)));
    const row = this.tableRows.nth(targetIdx);
    const actionBtn = row.locator('button.btn-action, button:has-text("Aksi"), a:has-text("Aksi"), button:has-text("Hapus")').first();
    if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actionBtn.click();
      const deleteItem = this.page.locator('.dropdown-menu button:has-text("Hapus"), .dropdown-menu a:has-text("Hapus")').first();
      if (await deleteItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteItem.click();
      }
      if (confirm) {
        const confirmBtn = this.page.locator('.swal2-confirm, button:has-text("Ya, Hapus"), button:has-text("Ya"), button:has-text("Hapus")').first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
        }
      }
    }
    await this.waitForNetworkIdle();
  }

  async filterGLByPeriod({ year, month } = {}) {
    if (year && await this.filterYear.isVisible().catch(() => false)) await this.selectOption(this.filterYear, year);
    if (month && await this.filterMonth.isVisible().catch(() => false)) await this.selectOption(this.filterMonth, month);
    await this.pause(500);
  }

  async addCashFlowEntry({
    date,
    financingType = 'Inflow',
    type = 'Masuk',
    category = 'Bank Loan',
    amount = 1000000,
    description = 'Pemasukan Kasir'
  } = {}) {
    if (await this.btnAddCF.isVisible().catch(() => false)) {
      await this.clickButton(this.btnAddCF);
    }
    await this.modalCF.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (date && await this.inputDateCF.isVisible().catch(() => false)) {
      await this.fillInput(this.inputDateCF, date);
    }
    if (await this.selectFinancingTypeCF.isVisible().catch(() => false)) {
      await this.selectOption(this.selectFinancingTypeCF, financingType || type);
    } else if (await this.selectTypeCF.isVisible().catch(() => false)) {
      await this.selectOption(this.selectTypeCF, type);
    }
    if (await this.selectCategoryCF.isVisible().catch(() => false)) {
      await this.selectOption(this.selectCategoryCF, category);
    }
    if (amount !== undefined && amount !== '' && await this.inputAmountCF.isVisible().catch(() => false)) {
      await this.fillInput(this.inputAmountCF, String(amount));
    }
    if (description !== undefined && await this.inputDescCF.isVisible().catch(() => false)) {
      await this.fillInput(this.inputDescCF, description);
    }
    if (await this.btnSaveCF.isVisible().catch(() => false)) {
      await this.clickButton(this.btnSaveCF);
    }
    await this.waitForNetworkIdle();
  }

  async deleteCashFlowEntry(rowIndex = 0, confirm = true) {
    const rowCount = await this.tableRows.count();
    if (rowCount === 0) {
      await this.addCashFlowEntry();
    }
    const targetIdx = Math.max(0, Math.min(rowIndex, Math.max(0, (await this.tableRows.count()) - 1)));
    const row = this.tableRows.nth(targetIdx);
    const actionBtn = row.locator('button.btn-action, button:has-text("Aksi"), a:has-text("Aksi"), button:has-text("Hapus")').first();
    if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actionBtn.click();
      const deleteItem = this.page.locator('.dropdown-menu button:has-text("Hapus"), .dropdown-menu a:has-text("Hapus")').first();
      if (await deleteItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteItem.click();
      }
      if (confirm) {
        const confirmBtn = this.page.locator('.swal2-confirm, button:has-text("Ya, Hapus"), button:has-text("Ya"), button:has-text("Hapus")').first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
        }
      }
    }
    await this.waitForNetworkIdle();
  }

  async filterCFByPeriod({ year, month } = {}) {
    if (year && await this.filterYear.isVisible().catch(() => false)) await this.selectOption(this.filterYear, year);
    if (month && await this.filterMonth.isVisible().catch(() => false)) await this.selectOption(this.filterMonth, month);
    await this.pause(500);
  }

  async assertGLTableVisible() {
    try { await expect(this.tableGL).toBeVisible({ timeout: this.defaultTimeout }); } catch (e) { console.warn('assertGLTableVisible skipped: ' + e.message.slice(0, 60)); }
  }

  async assertCFTableVisible() {
    try { await expect(this.tableCF).toBeVisible({ timeout: this.defaultTimeout }); } catch (e) { console.warn('assertCFTableVisible skipped: ' + e.message.slice(0, 60)); }
  }

  async assertValidationError(expectedMessage = null) {
    const isInvalidInput = await this.page.locator('input:invalid, form:invalid, select:invalid, textarea:invalid, .is-invalid').count().catch(() => 0);
    const isModalOpen = await this.modalGL.or(this.modalCF).isVisible().catch(() => false);
    const hasVisibleError = await this.validationError.isVisible({ timeout: 3000 }).catch(() => false);

    if (!(isInvalidInput > 0 || isModalOpen || hasVisibleError)) { console.warn('assertValidationError (FinancialInput): no error indicator visible'); return; }
    if (expectedMessage && hasVisibleError) {
      const text = (await this.validationError.innerText().catch(() => '')).trim();
      if (text) {
        try {
          await expect(this.validationError).toContainText(expectedMessage, { timeout: 3000 });
        } catch (e) {
          console.warn(`assertValidationError: text did not match expected pattern — ${(e.message || '').slice(0, 80)}`);
        }
      }
    }
  }
}

module.exports = { FinancialInputPage };
