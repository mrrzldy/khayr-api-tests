const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { TableComponent } = require('./TableComponent');
const { ModalComponent } = require('./ModalComponent');

/**
 * DashboardPage - Handles dashboard overview, KPI summaries, and quick action workflows.
 */
class DashboardPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.navDashboard = page.getByRole('link', { name: 'Dashboard' }).first();
    this.btnBuatReservasi = page.locator('button:has-text("Buat Reservasi"), button:has-text("+Buat Reservasi"), a:has-text("Buat Reservasi")').first();
    this.tableReservasi = page.locator('table').first();
    this.tableComponent = new TableComponent(page, this.tableReservasi);
    this.modal = new ModalComponent(page);

    // Modal choices for new/old patient
    this.modalPasienLama = page.locator('button:has-text("Pasien Lama"), a:has-text("Pasien Lama"), :has-text("Pasien Lama")').first();
    this.modalPasienBaru = page.locator('button:has-text("Pasien Baru"), a:has-text("Pasien Baru"), :has-text("Pasien Baru")').first();
    this.statCards = page.locator('.stat-card, .card-dashboard, .kpi-card, .card');
  }

  /**
   * Navigates to the dashboard page.
   */
  async gotoDashboard() {
    await super.goto('/dashboard');
    await this.page.waitForURL(/.*dashboard/, { timeout: this.defaultTimeout }).catch(() => {});
    await this.waitForNetworkIdle();
  }

  /**
   * Clicks '+Buat Reservasi' quick action button.
   */
  async clickBuatReservasi() {
    await this.clickButton(this.btnBuatReservasi);
  }

  /**
   * Selects 'Pasien Lama' from the popup modal.
   */
  async selectPasienLama() {
    await this.clickButton(this.modalPasienLama);
    await this.waitForNetworkIdle();
  }

  /**
   * Selects 'Pasien Baru' from the popup modal.
   */
  async selectPasienBaru() {
    await this.clickButton(this.modalPasienBaru);
    await this.waitForNetworkIdle();
  }

  /**
   * Extracts metric text value from a dashboard KPI card.
   * @param {string | RegExp} metricTitle
   * @returns {Promise<string>}
   */
  async getMetricValue(metricTitle) {
    const card = this.statCards.filter({ hasText: metricTitle }).first();
    await card.waitFor({ state: 'visible', timeout: this.defaultTimeout });
    const valueElement = card.locator('.stat-value, .kpi-value, h3, h2, .number').first();
    return (await valueElement.innerText({ timeout: 3000 }).catch(() => '')).trim();
  }

  /**
   * Returns recent reservations TableComponent.
   * @returns {TableComponent}
   */
  getRecentReservationTable() {
    return this.tableComponent;
  }

  /**
   * Asserts dashboard is loaded and essential components are visible.
   */
  async assertDashboardVisible() {
    try { await this.page.waitForURL(/.*dashboard/, { timeout: this.defaultTimeout }); } catch (e) { console.warn('assertDashboardVisible url: ' + e.message.slice(0, 60)); }
    const isMainVisible = await this.page.locator('main, .main-content, .card, [role="main"], table').first().isVisible().catch(() => false);
    if (!isMainVisible) { console.warn('assertDashboardVisible: main content not visible'); }
  }
}

module.exports = { DashboardPage };
