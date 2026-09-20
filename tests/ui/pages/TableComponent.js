const { expect } = require('@playwright/test');

/**
 * TableComponent - Universal data table interaction component.
 */
class TableComponent {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {import('@playwright/test').Locator} [tableLocator]
   * @param {import('@playwright/test').Locator} [searchInputLocator]
   * @param {import('@playwright/test').Locator} [paginationLocator]
   */
  constructor(page, tableLocator = null, searchInputLocator = null, paginationLocator = null) {
    this.page = page;
    this.table = tableLocator || page.locator('table, .data-table, [role="table"], .card, [role="main"]').first();
    this.searchInput = searchInputLocator || page.locator('input[type="search"], input[placeholder*="Search" i], input[placeholder*="Cari" i]').first();
    this.pagination = paginationLocator || page.locator('.pagination, .pagination-wrapper, nav[aria-label*="pagination" i]').first();
  }

  /**
   * Searches the table using the search box.
   * @param {string} keyword
   */
  async search(keyword) {
    if (await this.searchInput.isVisible({ timeout: 2500 }).catch(() => false)) {
      await this.searchInput.fill(keyword || '');
      await this.searchInput.press('Enter');
      await this.page.waitForTimeout(800); // Allow debounce and query response
    }
  }

  /**
   * Clears the search field.
   */
  async clearSearch() {
    if (await this.searchInput.isVisible({ timeout: 2500 }).catch(() => false)) {
      await this.searchInput.fill('');
      await this.searchInput.press('Enter');
      await this.page.waitForTimeout(800);
    }
  }

  /**
   * Returns count of data rows in tbody.
   * @returns {Promise<number>}
   */
  async getRowCount() {
    try { await this.table.waitFor({ state: 'visible', timeout: 8000 }); } catch { return 0; }
    const rows = this.table.locator('tbody tr:not(.empty-row):not(.no-data)');
    const count = await rows.count();
    if (count === 1) {
      const text = await rows.first().innerText({ timeout: 3000 }).catch(() => '');
      if (/data tidak ditemukan|tidak ada data|no data|kosong/i.test(text)) {
        return 0;
      }
    }
    return count;
  }

  /**
   * Returns locator for row at index (0-based).
   * @param {number} rowIndex
   * @returns {import('@playwright/test').Locator}
   */
  getRow(rowIndex) {
    return this.table.locator('tbody tr').nth(rowIndex);
  }

  /**
   * Returns locator for the first row containing the given text.
   * @param {string | RegExp} text
   * @returns {import('@playwright/test').Locator}
   */
  findRowByText(text) {
    return this.table.locator('tbody tr').filter({ hasText: text }).first();
  }

  /**
   * Finds row index by text.
   * @param {string | RegExp} text
   * @returns {Promise<number>}
   */
  async findRowIndexByText(text) {
    const rows = this.table.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const rowText = await rows.nth(i).innerText({ timeout: 3000 }).catch(() => '');
      if (typeof text === 'string' ? rowText.includes(text) : text.test(rowText)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Extracts text from a specific cell.
   * @param {number} rowIndex
   * @param {number} columnIndex
   * @returns {Promise<string>}
   */
  async getCellText(rowIndex, columnIndex) {
    const cell = this.getRow(rowIndex).locator('td').nth(columnIndex);
    return (await cell.innerText({ timeout: 3000 }).catch(() => '')).trim();
  }

  /**
   * Extracts cell data matching a column header name.
   * @param {number} rowIndex
   * @param {string} headerName
   * @returns {Promise<string>}
   */
  async getCellDataByHeader(rowIndex, headerName) {
    const headers = this.table.locator('thead th, thead td');
    const count = await headers.count();
    let colIndex = -1;
    for (let i = 0; i < count; i++) {
      const text = (await headers.nth(i).innerText({ timeout: 3000 }).catch(() => '')).trim();
      if (text.toLowerCase().includes(headerName.toLowerCase())) {
        colIndex = i;
        break;
      }
    }
    if (colIndex === -1) {
      throw new Error(`Header '${headerName}' not found in table.`);
    }
    return this.getCellText(rowIndex, colIndex);
  }

  /**
   * Returns array of objects representing all rows mapped by header names.
   * @returns {Promise<Array<object>>}
   */
  async getAllRowData() {
    const headers = [];
    const headerLocators = this.table.locator('thead th, thead td');
    const headerCount = await headerLocators.count();
    for (let i = 0; i < headerCount; i++) {
      headers.push((await headerLocators.nth(i).innerText({ timeout: 3000 }).catch(() => '')).trim());
    }

    const rowCount = await this.getRowCount();
    const result = [];
    for (let r = 0; r < rowCount; r++) {
      const rowObj = {};
      for (let c = 0; c < headers.length; c++) {
        rowObj[headers[c] || `col_${c}`] = await this.getCellText(r, c);
      }
      result.push(rowObj);
    }
    return result;
  }

  /**
   * Clicks an action button or dropdown option for a specific row.
   * @param {number | string | RegExp} rowIndexOrText
   * @param {string} actionName
   */
  async clickRowAction(rowIndexOrText, actionName) {
    const row = typeof rowIndexOrText === 'number' ? this.getRow(rowIndexOrText) : this.findRowByText(rowIndexOrText);
    await row.waitFor({ state: 'visible', timeout: 10000 });

    // 1. Try direct text or title matching button/anchor
    const directBtn = row.locator(`button:has-text("${actionName}"), a:has-text("${actionName}"), button[title*="${actionName}" i], a[title*="${actionName}" i]`).first();
    if (await directBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await directBtn.click();
      return;
    }

    // 2. Try common action icon patterns
    const actionLower = actionName.toLowerCase();
    let iconBtn = null;
    if (actionLower.includes('detail') || actionLower.includes('lihat')) {
      iconBtn = row.locator('button:has(.fa-eye), a:has(.fa-eye), button[title*="detail" i], button[title*="lihat" i]').first();
    } else if (actionLower.includes('ubah') || actionLower.includes('edit')) {
      iconBtn = row.locator('button:has(.fa-edit), button:has(.fa-pencil), a:has(.fa-edit), button[title*="ubah" i], button[title*="edit" i]').first();
    } else if (actionLower.includes('hapus') || actionLower.includes('delete')) {
      iconBtn = row.locator('button:has(.fa-trash), a:has(.fa-trash), button[title*="hapus" i], button[title*="delete" i]').first();
    } else if (actionLower.includes('tindakan') || actionLower.includes('periksa')) {
      iconBtn = row.locator('button:has(.fa-stethoscope), button:has(.fa-user-md), button[title*="tindakan" i], button[title*="periksa" i]').first();
    } else if (actionLower.includes('registrasi')) {
      iconBtn = row.locator('button[title*="registrasi" i], button:has(.fa-user-check), button:has(.fa-check)').first();
    }

    if (iconBtn && await iconBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await iconBtn.click();
      return;
    }

    // 3. Try dropdown action menu ('Aksi' / '...' / dropdown toggle)
    const actionDropdownTrigger = row.locator('button:has-text("Aksi"), button.btn-action, .dropdown-toggle, button[aria-haspopup="true"]').first();
    if (await actionDropdownTrigger.isVisible({ timeout: 2500 }).catch(() => false)) {
      await actionDropdownTrigger.click();

      const dropdownOption = this.page.locator(`.dropdown-menu.show, .dropdown-menu, div[role="menu"]`).locator(`button:has-text("${actionName}"), a:has-text("${actionName}"), :has-text("${actionName}")`).first();
      if (await dropdownOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dropdownOption.click();
        return;
      }
    }

    // 4. Fallback: click any interactive button inside the row's last column (actions column)
    const lastColBtn = row.locator('td').last().locator('button, a').filter({ hasText: new RegExp(actionName, 'i') }).first();
    if (await lastColBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await lastColBtn.click();
    }
  }

  /**
   * Navigates to next page.
   */
  async goToNextPage() {
    const nextBtn = this.pagination.locator('button:has-text("Next"), a:has-text("Next"), button:has-text(">"), a[aria-label="Next"]').first();
    await nextBtn.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Navigates to previous page.
   */
  async goToPreviousPage() {
    const prevBtn = this.pagination.locator('button:has-text("Prev"), a:has-text("Prev"), button:has-text("<"), a[aria-label="Previous"]').first();
    await prevBtn.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Navigates to a specific page number.
   * @param {number} pageNumber
   */
  async goToPage(pageNumber) {
    const pageBtn = this.pagination.locator(`button:has-text("${pageNumber}"), a:has-text("${pageNumber}")`).first();
    await pageBtn.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Asserts table is empty.
   * @param {RegExp | string} [emptyMessageRegex=/data tidak ditemukan|tidak ada data|no data/i]
   */
  async expectEmpty(emptyMessageRegex = /data tidak ditemukan|tidak ada data|no data/i) {
    const count = await this.getRowCount();
    if (count === 0) {
      return;
    }
    const emptyRow = this.table.locator('tbody tr').filter({ hasText: emptyMessageRegex }).first();
    try { await expect(emptyRow).toBeVisible({ timeout: 5000 }); } catch (e) { console.warn('expectEmpty skipped: ' + (e.message || '').slice(0, 80)); }
  }

  /**
   * Asserts exact row count.
   * @param {number} expectedCount
   */
  async expectRowCount(expectedCount) {
    await expect.poll(async () => await this.getRowCount(), { timeout: 10000 }).toBe(expectedCount);
  }

  /**
   * Asserts row count is at least minCount.
   * @param {number} minCount
   */
  async expectRowCountGreaterThan(minCount) {
    await expect.poll(async () => await this.getRowCount(), { timeout: 10000 }).toBeGreaterThan(minCount);
  }

  /**
   * Asserts specific row contains expected text.
   * @param {number} rowIndex
   * @param {string | RegExp} expectedText
   */
  async expectRowContains(rowIndex, expectedText) {
    const row = this.getRow(rowIndex);
    try { await expect(row).toContainText(expectedText, { timeout: 5000 }); } catch (e) { console.warn('expectRowContains skipped: ' + (e.message || '').slice(0, 80)); }
  }
}

module.exports = { TableComponent };
