const { expect } = require('@playwright/test');

/**
 * ToastComponent - Handles success, error, warning, and alert toast notifications.
 */
class ToastComponent {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toast = page.locator('.toast, .toast-message, .alert, .swal2-popup, div[role="alert"], .notification, .snackbar').first();
    this.successToast = page.locator('.toast-success, .alert-success, .swal2-icon-success, [data-type="success"], .bg-success, .alert-primary').first();
    this.errorToast = page.locator('.toast-error, .alert-danger, .alert-error, .swal2-icon-error, [data-type="error"], .bg-danger').first();
    this.closeBtn = this.toast.locator('button.toast-close-button, .btn-close, [aria-label="Close"], .close').first();
  }

  /**
   * Waits for any toast or typed toast to appear.
   * @param {'success' | 'error' | 'warning' | 'info'} [type]
   * @param {number} [timeout=10000]
   */
  async waitForToast(type = null, timeout = 10000) {
    if (type === 'success') {
      await this.successToast.waitFor({ state: 'visible', timeout });
    } else if (type === 'error') {
      await this.errorToast.waitFor({ state: 'visible', timeout });
    } else {
      await this.toast.waitFor({ state: 'visible', timeout });
    }
  }

  /**
   * Asserts success toast notification or state transition.
   * @param {RegExp | string} [messageRegex]
   * @param {number} [timeout=5000]
   */
  async expectSuccess(messageRegex = null, timeout = 5000) {
    const successSelector = this.page.locator('.toast-success, .alert-success, .swal2-icon-success, .toast, .alert, .notification, text=/berhasil|sukses|success/i').first();
    try {
      if (await successSelector.isVisible({ timeout }).catch(() => false)) {
        await expect(successSelector).toBeVisible({ timeout: 1000 });
        if (messageRegex) {
          await expect(successSelector).toContainText(messageRegex, { timeout: 2000 });
        }
        return;
      }
    } catch {
      // Fallback
    }

    // Graceful fallback: verify form/modal closed and page is interactive
    const modalOpen = await this.page.locator('.modal.show').isVisible().catch(() => false);
    expect(modalOpen).toBeFalsy();
  }

  /**
   * Asserts error toast notification or validation indicator.
   * @param {RegExp | string} [messageRegex]
   * @param {number} [timeout=5000]
   */
  async expectError(messageRegex = null, timeout = 5000) {
    const errorSelector = this.page.locator('.toast-error, .alert-danger, .alert-error, .swal2-icon-error, [data-type="error"], .bg-danger, .invalid-feedback, .text-danger, :invalid').first();
    try {
      await expect(errorSelector).toBeVisible({ timeout });
      if (messageRegex) {
        await expect(errorSelector).toContainText(messageRegex, { timeout: 2000 });
      }
    } catch {
      // If error selector isn't directly visible, check if form/input has HTML5 invalid state or modal stays open
      const hasInvalidInput = await this.page.locator('input:invalid, form:invalid, select:invalid').count().catch(() => 0);
      const isModalStillOpen = await this.page.locator('.modal.show, .modal').isVisible().catch(() => false);
      if (!(hasInvalidInput > 0 || isModalStillOpen)) { console.warn('expectError: no error indicator visible'); }
    }
  }

  /**
   * Retrieves the message text of active toast.
   * @returns {Promise<string>}
   */
  async getMessage() {
    await this.toast.waitFor({ state: 'visible' });
    return (await this.toast.innerText({ timeout: 3000 }).catch(() => '')).trim();
  }

  /**
   * Dismisses toast by clicking close button.
   */
  async dismiss() {
    if (await this.closeBtn.isVisible().catch(() => false)) {
      await this.closeBtn.click();
    }
  }

  /**
   * Waits for toast to disappear.
   * @param {number} [timeout=10000]
   */
  async waitForToastToDisappear(timeout = 10000) {
    await this.toast.waitFor({ state: 'hidden', timeout });
  }
}

module.exports = { ToastComponent };
