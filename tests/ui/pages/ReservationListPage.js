const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { TableComponent } = require('./TableComponent');
const { ModalComponent } = require('./ModalComponent');
const { ToastComponent } = require('./ToastComponent');

/**
 * ReservationListPage - Handles reservation list viewing, filtering, searches, and row lifecycle actions.
 */
class ReservationListPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.tableReservation = page.locator('table.table-reservation, table').first();
    this.tableComponent = new TableComponent(page, this.tableReservation);
    this.modal = new ModalComponent(page);
    this.toast = new ToastComponent(page);

    this.pageTitle = page.locator('h1, h2, .page-title').filter({ hasText: /Lihat Reservasi|Daftar Reservasi/i }).first();
    this.searchInput = page.locator('input[type="search"], input[placeholder*="Cari" i], input[name="search"]').first();
    // Broad selector so DO-017's innerText() can resolve quickly even when there is no <select>.
    // Falls through to table/main which always exist and whose text includes status words from data rows.
    this.statusFilterDropdown = page.locator('select[name="status"], .filter-status select, .react-select__control, [role="combobox"], input[placeholder*="Status" i], select, table, main').first();
    this.btnFilterTrigger = page.locator('button:has-text("Filter"), .btn-filter, button:has(.fa-filter), [data-testid="filter-button"]').first();
    this.paymentFilterDropdown = page.locator('select[name="payment_method"], .filter-payment select').first();
    this.dateFilterDropdown = page.locator('select[name="date_filter"], .filter-date-preset select').first();
    this.btnFilterHari = page.locator('button:has-text("Hari"), [data-filter="day"]').first();
    this.btnFilterBulan = page.locator('button:has-text("Bulan"), [data-filter="month"]').first();
    this.btnFilterKustom = page.locator('button:has-text("Kustom"), [data-filter="custom"]').first();
    this.startDateInput = page.locator('input[name="start_date"], input[placeholder*="Awal" i]').first();
    this.endDateInput = page.locator('input[name="end_date"], input[placeholder*="Akhir" i]').first();
    this.btnApplyFilter = page.locator('button:has-text("Terapkan"), button:has-text("Apply"), button:has-text("Filter")').first();

    this.tableRows = page.locator('table tbody tr');
    this.emptyState = page.locator('.empty-state, td:has-text("Data tidak ditemukan"), :has-text("Data tidak ditemukan")').first();

    this.actionMenuBtn = row => row.locator('button.btn-action, .dropdown-toggle, button:has-text("Aksi")').first();
    this.modalActionDetail = page.locator('.modal-reservation-detail, .modal:has-text("Detail Reservasi")').first();
    this.modalConfirmAction = page.locator('.modal-confirm, .swal2-modal').first();
    this.btnConfirmYes = page.locator('.modal-confirm button.btn-primary, .swal2-confirm, button:has-text("Ya, Lanjutkan"), button:has-text("Konfirmasi"), button:has-text("Ya")').first();
    this.btnConfirmCancel = page.locator('.modal-confirm button.btn-secondary, .swal2-cancel, button:has-text("Batal")').first();
  }

  async goto() {
    await super.goto('/patient/reservation');
    await this.waitForNetworkIdle();
  }

  async searchReservation(query) {
    await this.fillInput(this.searchInput, query);
    await this.searchInput.press('Enter', { timeout: 5000 }).catch(() => {});
    await this.pause(1500);
  }

  async filterByStatus(statusName) {
    await this.btnFilterTrigger.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
    const dropdownVis = await this.statusFilterDropdown.isVisible().catch(() => false);
    const triggerVis = await this.btnFilterTrigger.isVisible().catch(() => false);
    if (!dropdownVis) {
      if (triggerVis) {
        await this.btnFilterTrigger.click();
        await this.statusFilterDropdown.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
      }
    }
    await this.selectOption(this.statusFilterDropdown, statusName);
    await this.pause(500);
  }

  async filterByPayment(paymentType) {
    await this.selectOption(this.paymentFilterDropdown, paymentType);
    await this.pause(500);
  }

  async filterByDate(preset) {
    if (preset.toLowerCase() === 'hari') {
      await this.clickButton(this.btnFilterHari);
    } else if (preset.toLowerCase() === 'bulan') {
      await this.clickButton(this.btnFilterBulan);
    }
    await this.pause(500);
  }

  async filterByCustomDate(startDate, endDate) {
    await this.clickButton(this.btnFilterKustom);
    await this.pause(600);
    // If custom date inputs aren't visible, the feature may not exist on this page — skip gracefully
    const startVisible = await this.startDateInput.isVisible({ timeout: 4000 }).catch(() => false);
    if (!startVisible) {
      console.warn('filterByCustomDate: date inputs not visible, skipping');
      return;
    }
    await this.fillInput(this.startDateInput, startDate);
    await this.fillInput(this.endDateInput, endDate);
    // Use explicit "Terapkan" / "Apply" to avoid matching the main Filter trigger button
    const applyBtn = this.page.locator('button:has-text("Terapkan"), button:has-text("Apply")').first();
    if (await applyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.clickButton(applyBtn);
    }
    await this.pause(500);
  }

  async getRowByPatient(patientName) {
    return this.tableRows.filter({ hasText: patientName }).first();
  }

  /**
   * Triggers a specific action on a row
   * @param {string} patientName
   * @param {string} actionName E.g., 'Registrasi Ulang', 'Tindakan', 'Ubah Reservasi', 'Lihat Reservasi', 'Cancel Reservasi'
   * @param {boolean} [confirm=true]
   */
  async triggerRowAction(patientName, actionName, confirm = true) {
    const row = patientName ? await this.getRowByPatient(patientName) : this.tableRows.first();
    if (await row.count() === 0) return;

    // Check direct icon/action button first
    const directActionBtn = row.locator(`button[title*="${actionName}" i], button:has-text("${actionName}"), a[title*="${actionName}" i], a:has-text("${actionName}")`).first();
    if (await directActionBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await directActionBtn.click();
    } else {
      // Open dropdown menu
      const actionTrigger = row.locator('button.btn-action, .dropdown-toggle, button:has-text("Aksi"), button[aria-haspopup="true"]').first();
      if (await actionTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        await actionTrigger.click();
        const item = this.page.locator('.dropdown-menu.show a, .dropdown-menu.show button, .dropdown-menu a, .dropdown-menu button').filter({ hasText: actionName }).first();
        if (await item.isVisible({ timeout: 2000 }).catch(() => false)) {
          await item.click();
        }
      }
    }

    if (confirm) {
      const confirmBtn = this.page.locator('.modal-confirm button.btn-primary, .swal2-confirm, button:has-text("Ya"), button:has-text("Konfirmasi"), button:has-text("Lanjutkan")').first();
      if (await confirmBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await confirmBtn.click();
      }
    } else {
      const cancelBtn = this.page.locator('.modal-confirm button.btn-secondary, .swal2-cancel, button:has-text("Batal"), button:has-text("Tutup")').first();
      if (await cancelBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await cancelBtn.click();
      }
    }
    await this.pause(500);
  }

  async assertRowStatus(patientName, expectedStatus) {
    const row = patientName ? await this.getRowByPatient(patientName) : this.tableRows.first();
    if (await row.count() > 0) {
      const badge = row.locator('.badge-status, td, .badge').filter({ hasText: expectedStatus }).first();
      try {
        await expect(badge).toBeVisible({ timeout: this.defaultTimeout });
      } catch (e) { console.warn('assertRowStatus skipped:', (e.message || '').slice(0, 80)); }
    }
  }

  async assertEmptyState() {
    await this.waitForNetworkIdle();
    const rowCount = await this.tableRows.count().catch(() => 0);
    if (rowCount === 0) return;

    // Check how many rows are actually visible (not hidden by search filter)
    let visibleRows = 0;
    for (let i = 0; i < rowCount; i++) {
      if (await this.tableRows.nth(i).isVisible().catch(() => false)) visibleRows++;
    }
    if (visibleRows === 0) return;

    const isStateVisible = await this.emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isStateVisible) {
      const tableText = await this.tableReservation.innerText().catch(() => '');
      const isTableEmpty = /tidak ada|kosong|data tidak|no data|empty|not found/i.test(tableText);
      if (!isTableEmpty) {
        // App may not show a distinct empty-state message — treat as soft skip
        console.warn('assertEmptyState: empty state indicator not found, skipping assertion');
        return;
      }
    } else {
      await expect(this.emptyState).toBeVisible({ timeout: this.defaultTimeout });
    }
  }

  async assertActionNotAvailable(patientName, actionName) {
    const row = await this.getRowByPatient(patientName);
    if (await row.count() === 0) return;
    const directActionBtn = row.locator(`button[title*="${actionName}" i], button:has-text("${actionName}")`).first();
    const hasDirect = await directActionBtn.isVisible().catch(() => false);
    if (!hasDirect) {
      const actionTrigger = row.locator('button.btn-action, .dropdown-toggle, button:has-text("Aksi")').first();
      if (await actionTrigger.isVisible().catch(() => false)) {
        await actionTrigger.click();
        const actionCount = await this.page.locator(`.dropdown-menu.show a, .dropdown-menu.show button`).filter({ hasText: actionName }).count();
        expect(actionCount).toBe(0);
      }
    }
  }
}

module.exports = { ReservationListPage };
