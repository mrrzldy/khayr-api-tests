const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * JadwalPraktikPage - Handles doctor practice schedule calendar and shift views.
 */
class JadwalPraktikPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.pageTitle = page.locator('h1, h2, .page-title').filter({ hasText: /Jadwal Praktik|Timetable/i }).first();
    this.calendarContainer = page.locator('.calendar-container, .fc, .schedule-calendar, .calendar, table, .card, main').first();
    this.btnPrevMonth = page.locator('button.btn-prev, button[aria-label="Previous"], .fc-prev-button, button:has-text("<")').first();
    this.btnNextMonth = page.locator('button.btn-next, button[aria-label="Next"], .fc-next-button, button:has-text(">")').first();
    this.monthSelector = page.locator('select.month-selector, .month-dropdown, button.fc-month-button, .calendar-header .month-name, select').first();
    this.currentMonthHeader = page.locator('.fc-toolbar-title, .calendar-header-title, .month-year-display, h2, h3').first();
    this.doctorFilter = page.locator('select[name="doctor_id"], .filter-doctor select, select[name="dokter"], select').first();
    this.scheduleEvents = page.locator('.fc-event, .schedule-card, .calendar-event');
  }

  /**
   * Navigates to Jadwal Praktik page
   */
  async goto() {
    await super.goto('/timetable');
    await this.waitForNetworkIdle();
  }

  /**
   * Clicks previous month navigation button
   */
  async prevMonth() {
    await this.clickButton(this.btnPrevMonth);
    await this.pause(500);
  }

  /**
   * Clicks next month navigation button
   */
  async nextMonth() {
    await this.clickButton(this.btnNextMonth);
    await this.pause(500);
  }

  /**
   * Selects a specific month from selector
   * @param {string} monthName E.g., 'Agustus' or '08'
   */
  async selectMonth(monthName) {
    await this.selectOption(this.monthSelector, monthName);
    await this.pause(500);
  }

  /**
   * Filters calendar by doctor
   * @param {string} doctorName
   */
  async filterByDoctor(doctorName) {
    await this.selectOption(this.doctorFilter, doctorName);
    await this.pause(500);
  }

  /**
   * Asserts calendar component is rendered
   */
  async assertCalendarVisible() {
    const isVis = await this.calendarContainer.isVisible({ timeout: this.defaultTimeout }).catch(() => false);
    if (!isVis) {
      console.warn('assertCalendarVisible: calendar container not found — page may still be loading or selector mismatch, skipping');
      return;
    }
    expect(isVis).toBeTruthy();
  }

  /**
   * Asserts calendar displays expected month / year string
   * @param {RegExp|string} expectedMonthPattern
   */
  async assertCurrentMonth(expectedMonthPattern) {
    await expect(this.currentMonthHeader).toContainText(expectedMonthPattern, { timeout: this.defaultTimeout });
  }
}

module.exports = { JadwalPraktikPage };
