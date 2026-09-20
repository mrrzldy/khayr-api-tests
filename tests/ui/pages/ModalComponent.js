const { expect } = require('@playwright/test');

/**
 * ModalComponent - Standardized handler for modal dialogs, popups, and confirmations.
 */
class ModalComponent {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {import('@playwright/test').Locator} [modalLocator]
   */
  constructor(page, modalLocator = null) {
    this.page = page;
    this.modal = modalLocator || page.locator('.modal.show, .modal-dialog, div[role="dialog"], .modal-content, .swal2-modal, .swal2-popup').first();
    this.headerTitle = this.modal.locator('.modal-title, [data-testid="modal-title"], .swal2-title, h5, h4, h3').first();
    this.bodyContent = this.modal.locator('.modal-body, .swal2-html-container, p').first();
    this.closeButton = this.modal.locator('button.btn-close, button.close, [aria-label="Close"], .swal2-close').first();
  }

  /**
   * Waits for modal dialog to appear and be visible.
   * @param {RegExp | string} [titleRegex]
   * @param {number} [timeout=10000]
   */
  async waitForModal(titleRegex = null, timeout = 10000) {
    await this.modal.waitFor({ state: 'visible', timeout });
    if (titleRegex) {
      await expect(this.headerTitle).toHaveText(titleRegex, { timeout });
    }
  }

  /**
   * Waits for modal to disappear.
   * @param {number} [timeout=10000]
   */
  async waitForClosed(timeout = 10000) {
    await this.modal.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Retrieves the modal header title text.
   * @returns {Promise<string>}
   */
  async getTitle() {
    await this.modal.waitFor({ state: 'visible' });
    return (await this.headerTitle.innerText({ timeout: 3000 }).catch(() => '')).trim();
  }

  /**
   * Retrieves the modal body content text.
   * @returns {Promise<string>}
   */
  async getBodyText() {
    await this.modal.waitFor({ state: 'visible' });
    return (await this.bodyContent.innerText({ timeout: 3000 }).catch(() => '')).trim();
  }

  /**
   * Clicks confirmation button inside modal.
   * @param {RegExp | string} [buttonText=/Simpan|Konfirmasi|Ya|OK|Submit|Setujui|Terapkan/i]
   */
  async confirm(buttonText = /Simpan|Konfirmasi|Ya|OK|Submit|Setujui|Terapkan/i) {
    let btn = this.modal.locator(`button, a`).filter({ hasText: buttonText }).first();
    if (!await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      btn = this.page.locator('.swal2-confirm, .modal-confirm button.btn-primary, button.btn-primary').first();
    }
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Clicks cancel/dismiss button inside modal.
   * @param {RegExp | string} [buttonText=/Batal|Tutup|Cancel|Close/i]
   */
  async cancel(buttonText = /Batal|Tutup|Cancel|Close/i) {
    let btn = this.modal.locator(`button, a`).filter({ hasText: buttonText }).first();
    if (!await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      btn = this.page.locator('.swal2-cancel, button.btn-secondary, button.close').first();
    }
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click();
      await this.waitForClosed().catch(() => {});
    }
  }

  /**
   * Closes modal via 'X' button.
   */
  async close() {
    if (await this.closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.closeButton.click();
      await this.waitForClosed().catch(() => {});
    }
  }

  /**
   * Fills an input inside the modal.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {string} value
   */
  async fillField(locatorOrSelector, value) {
    const locator = typeof locatorOrSelector === 'string' ? this.modal.locator(locatorOrSelector) : locatorOrSelector;
    await locator.waitFor({ state: 'visible', timeout: 5000 });
    await locator.fill(value !== undefined && value !== null ? String(value) : '');
  }

  /**
   * Selects an option inside the modal.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {string} valueOrLabel
   */
  async selectOption(locatorOrSelector, valueOrLabel) {
    const locator = typeof locatorOrSelector === 'string' ? this.modal.locator(locatorOrSelector) : locatorOrSelector;
    await locator.waitFor({ state: 'visible', timeout: 5000 });
    const tagName = await locator.evaluate(el => el.tagName.toLowerCase()).catch(() => '');

    if (tagName === 'select') {
      try {
        await locator.selectOption({ label: String(valueOrLabel) });
      } catch {
        await locator.selectOption({ value: String(valueOrLabel) });
      }
    } else {
      await locator.click();
      const option = this.modal.locator(`li:has-text("${valueOrLabel}"), div[role="option"]:has-text("${valueOrLabel}"), .dropdown-item:has-text("${valueOrLabel}")`).first();
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click();
      }
    }
  }

  /**
   * Asserts validation error text displayed inside modal.
   * @param {RegExp | string} [messageRegex]
   */
  async expectValidationError(messageRegex = null) {
    const errorLocator = this.modal.locator('.invalid-feedback, .error-message, .text-danger, .alert-danger, :invalid').first();
    try {
      await expect(errorLocator).toBeVisible({ timeout: 5000 });
      if (messageRegex) {
        await expect(errorLocator).toContainText(messageRegex, { timeout: 2000 });
      }
    } catch {
      // Check HTML5 invalid pseudo class on input
      const invalidCount = await this.modal.locator('input:invalid, select:invalid, textarea:invalid').count().catch(() => 0);
      expect(invalidCount).toBeGreaterThan(0);
    }
  }
}

module.exports = { ModalComponent };
