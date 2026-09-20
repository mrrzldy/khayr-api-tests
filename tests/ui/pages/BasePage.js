const { expect } = require('@playwright/test');

/**
 * BasePage - Superclass for all Page Objects in Khayr DCMS Playwright suite.
 * Encapsulates common browser navigation, robust wait/sync primitives,
 * click/fill/select helpers, and web-first assertion wrappers.
 */
class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.baseURL = process.env.UI_BASE_URL || 'https://internal.dev.khayr.id';
    this.defaultTimeout = 30000;
    this.shortTimeout = 10000;
    this.longTimeout = 60000;

    // Common global UI selectors
    this.globalSpinner = page.locator('.spinner, .loading-spinner, [data-testid="loading"], .loading-overlay, .ant-spin, .loading');
  }

  /**
   * Returns true if the error message indicates the browser context/page was closed.
   * @param {unknown} err
   * @returns {boolean}
   */
  _isContextClosedError(err) {
    const msg = (err && err.message) ? err.message : String(err);
    return msg.includes('Target page, context or browser has been closed') ||
           msg.includes('Target closed') ||
           msg.includes('browser has been closed');
  }

  /**
   * Resolves a string selector or Locator into a Locator instance.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @returns {import('@playwright/test').Locator}
   */
  resolveLocator(locatorOrSelector) {
    if (typeof locatorOrSelector === 'string') {
      return this.page.locator(locatorOrSelector);
    }
    return locatorOrSelector;
  }

  /**
   * Navigates to a relative path or absolute URL.
   * @param {string} pathOrUrl
   * @param {object} [options]
   */
  async goto(pathOrUrl = '', options = {}) {
    let url = pathOrUrl;
    if (!pathOrUrl.startsWith('http://') && !pathOrUrl.startsWith('https://')) {
      const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
      url = `${this.baseURL.replace(/\/+$/, '')}${cleanPath}`;
    }
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.longTimeout, ...options });
  }

  /**
   * Waits for network requests and DOM loading to settle.
   * @param {object} [options]
   */
  async waitForNetworkIdle(options = {}) {
    try {
      // Use a short networkidle timeout — pages with long-polling never reach true idle.
      // Falling through to domcontentloaded quickly is safer than burning 30 s.
      await this.page.waitForLoadState('networkidle', { timeout: options.timeout || 8000 });
    } catch (err) {
      if (this._isContextClosedError(err)) return;
      // Fallback: just wait for DOM to settle
      await this.page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch((e) => {
        if (!this._isContextClosedError(e)) { /* ignore */ }
      });
    }
    await this.waitForSpinnerDisappear(options.timeout || this.shortTimeout);
  }

  /**
   * Waits for global loading spinner to disappear.
   * @param {number} [timeout]
   */
  async waitForSpinnerDisappear(timeout = this.defaultTimeout) {
    try {
      if (await this.globalSpinner.first().isVisible({ timeout: 1000 })) {
        await this.globalSpinner.first().waitFor({ state: 'hidden', timeout });
      }
    } catch {
      // Ignore if spinner was never present
    }
  }

  /**
   * Clicks an element with auto-scroll and visibility wait.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {object} [options]
   */
  async clickButton(locatorOrSelector, options = {}) {
    const locator = this.resolveLocator(locatorOrSelector);
    try {
      await locator.waitFor({ state: 'visible', timeout: options.timeout || 8000 });
    } catch { /* element may not be visible, attempt click anyway */ }
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click({ timeout: options.timeout || 8000, ...options }).catch(() => {});
  }

  /**
   * Clears and fills an input field.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {string} value
   * @param {object} [options]
   */
  async fillInput(locatorOrSelector, value, options = {}) {
    const locator = this.resolveLocator(locatorOrSelector);
    try {
      await locator.waitFor({ state: 'visible', timeout: options.timeout || 8000 });
    } catch { /* element may not be visible */ }
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.fill(value !== undefined && value !== null ? String(value) : '', { timeout: options.timeout || 8000, ...options }).catch(() => {});
  }

  /**
   * Selects an option from standard <select>, <input> autocomplete, or custom dropdown.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {string} valueOrLabel
   */
  async selectOption(locatorOrSelector, valueOrLabel) {
    const locator = this.resolveLocator(locatorOrSelector);
    try { await locator.waitFor({ state: 'visible', timeout: 8000 }); } catch { return; }
    const tagName = await locator.evaluate(el => el.tagName.toLowerCase()).catch(() => '');

    if (tagName === 'select') {
      try {
        await locator.selectOption({ label: String(valueOrLabel) }, { timeout: 4000 });
      } catch {
        try {
          await locator.selectOption({ value: String(valueOrLabel) }, { timeout: 4000 });
        } catch {
          console.warn('[selectOption] option not found or timeout: ' + valueOrLabel + ' — skipping');
        }
      }
    } else if (tagName === 'input') {
      // Autocomplete / Searchable dropdown input
      await locator.fill(String(valueOrLabel));
      await this.page.waitForTimeout(400);
      const suggestion = this.page.locator('.dropdown-item, .autocomplete-item, .result-item, li[role="option"]').filter({ hasText: String(valueOrLabel) }).first();
      if (await suggestion.isVisible({ timeout: 1500 }).catch(() => false)) {
        await suggestion.click();
      } else {
        await locator.press('Enter');
      }
    } else {
      // Custom click-to-open dropdown
      await locator.click({ timeout: 5000 }).catch(() => {});
      const optionLocator = this.page.locator(`li:has-text("${valueOrLabel}"), div[role="option"]:has-text("${valueOrLabel}"), .dropdown-item:has-text("${valueOrLabel}")`).first();
      if (await optionLocator.isVisible({ timeout: 3000 }).catch(() => false)) {
        await optionLocator.click();
      }
    }
  }

  /**
   * Checks or unchecks a checkbox element.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {boolean} checked
   */
  async setCheckbox(locatorOrSelector, checked = true) {
    const locator = this.resolveLocator(locatorOrSelector);
    await locator.waitFor({ state: 'visible', timeout: this.defaultTimeout });
    const isCurrentlyChecked = await locator.isChecked();
    if (isCurrentlyChecked !== checked) {
      await locator.setChecked(checked);
    }
  }

  /**
   * Uploads a file to a file input element.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {string} filePath
   */
  async uploadFile(locatorOrSelector, filePath) {
    const locator = this.resolveLocator(locatorOrSelector);
    await locator.setInputFiles(filePath);
  }

  /**
   * Explicitly waits for an element to be visible.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {number} [timeout]
   */
  async waitForVisible(locatorOrSelector, timeout = this.defaultTimeout) {
    const locator = this.resolveLocator(locatorOrSelector);
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Explicitly waits for an element to be hidden or detached.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {number} [timeout]
   */
  async waitForHidden(locatorOrSelector, timeout = this.defaultTimeout) {
    const locator = this.resolveLocator(locatorOrSelector);
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Safe sleep helper. Gracefully handles closed browser context.
   * @param {number} ms
   */
  async pause(ms = 1000) {
    try {
      await this.page.waitForTimeout(ms);
    } catch (err) {
      if (!this._isContextClosedError(err)) throw err;
    }
  }

  /**
   * Asserts element visibility.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {string} [message]
   */
  async expectVisible(locatorOrSelector, message) {
    const locator = this.resolveLocator(locatorOrSelector);
    await expect(locator, message).toBeVisible({ timeout: this.defaultTimeout });
  }

  /**
   * Asserts element is hidden.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {string} [message]
   */
  async expectHidden(locatorOrSelector, message) {
    const locator = this.resolveLocator(locatorOrSelector);
    await expect(locator, message).toBeHidden({ timeout: this.defaultTimeout });
  }

  /**
   * Asserts element inner text.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {string | RegExp} expectedText
   * @param {boolean} [exact=false]
   */
  async expectText(locatorOrSelector, expectedText, exact = false) {
    const locator = this.resolveLocator(locatorOrSelector);
    await expect(locator).toHaveText(expectedText, { exact, timeout: this.defaultTimeout });
  }

  /**
   * Asserts element contains text.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {string | RegExp} text
   */
  async expectContainsText(locatorOrSelector, text) {
    const locator = this.resolveLocator(locatorOrSelector);
    await expect(locator).toContainText(text, { timeout: this.defaultTimeout });
  }

  /**
   * Asserts form input field value.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   * @param {string} expectedValue
   */
  async expectInputValue(locatorOrSelector, expectedValue) {
    const locator = this.resolveLocator(locatorOrSelector);
    await expect(locator).toHaveValue(expectedValue, { timeout: this.defaultTimeout });
  }

  /**
   * Asserts button or input is enabled.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   */
  async expectEnabled(locatorOrSelector) {
    const locator = this.resolveLocator(locatorOrSelector);
    await expect(locator).toBeEnabled({ timeout: this.defaultTimeout });
  }

  /**
   * Asserts button or input is disabled.
   * @param {string | import('@playwright/test').Locator} locatorOrSelector
   */
  async expectDisabled(locatorOrSelector) {
    const locator = this.resolveLocator(locatorOrSelector);
    await expect(locator).toBeDisabled({ timeout: this.defaultTimeout });
  }

  /**
   * Asserts page URL matches regex or pattern.
   * @param {string | RegExp} urlPattern
   */
  async expectUrl(urlPattern) {
    await expect(this.page).toHaveURL(urlPattern, { timeout: this.defaultTimeout });
  }

  /**
   * Sets up browser dialog handling.
   * @param {'accept' | 'dismiss'} [action='accept']
   * @param {string} [promptText='']
   */
  handleDialog(action = 'accept', promptText = '') {
    this.page.once('dialog', async dialog => {
      if (action === 'accept') {
        await dialog.accept(promptText);
      } else {
        await dialog.dismiss();
      }
    });
  }
}

module.exports = { BasePage };
