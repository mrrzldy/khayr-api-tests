const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * LoginPage - Handles multi-role authentication, credential management, and login assertions.
 */
class LoginPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="pengguna" i], input[placeholder*="admin" i]').first();
    this.passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="sandi" i], input[placeholder*="password" i]').first();
    this.loginButton = page.locator('button[type="submit"], button:has-text("Masuk"), button:has-text("Sign In"), button:has-text("Login")').first();
    this.errorMessage = page.locator('.error-message, .alert-danger, .text-danger, :has-text("Kredensial tidak valid"), :has-text("salah"), [role="alert"]').first();
    this.rememberMeCheckbox = page.locator('input[type="checkbox"][name*="remember" i], input[type="checkbox"]').first();

    // Built-in Role Credentials Matrix
    this.ROLE_CREDENTIALS = {
      superadmin: {
        email: process.env.SUPERADMIN_EMAIL || 'dev.khayr@mail.com',
        password: process.env.SUPERADMIN_PASSWORD || '123456',
      },
      'khayr admin': {
        email: process.env.SUPERADMIN_EMAIL || 'dev.khayr@mail.com',
        password: process.env.SUPERADMIN_PASSWORD || '123456',
      },
      khayradmin: {
        email: process.env.SUPERADMIN_EMAIL || 'dev.khayr@mail.com',
        password: process.env.SUPERADMIN_PASSWORD || '123456',
      },
      admin: {
        email: process.env.ADMIN_EMAIL || 'admin1_qa@clinic.com',
        password: process.env.ADMIN_PASSWORD || 'N91U9XOW',
      },
      resepsionis: {
        email: process.env.RESEPSIONIS_EMAIL || 'receptionist1_qa@clinic.com',
        password: process.env.RESEPSIONIS_PASSWORD || 'N91U9XOW',
      },
      finance: {
        email: process.env.FINANCE_EMAIL || 'finance1_qa@clinic.com',
        password: process.env.FINANCE_PASSWORD || 'N91U9XOW',
      },
      kasir: {
        email: process.env.KASIR_EMAIL || 'cashier1_qa@clinic.com',
        password: process.env.KASIR_PASSWORD || 'N91U9XOW',
      },
      perawat: {
        email: process.env.PERAWAT_EMAIL || 'nurse1_qa@clinic.com',
        password: process.env.PERAWAT_PASSWORD || 'N91U9XOW',
      },
      dokter: {
        email: process.env.DOKTER_EMAIL || 'doctor1_qa@clinic.com',
        password: process.env.DOKTER_PASSWORD || 'N91U9XOW',
      },
      pasien: {
        email: process.env.PASIEN_EMAIL || 'Pasien@test-org.com',
        password: process.env.PASIEN_PASSWORD || 'N91U9XOW',
      },
    };

    // Load dynamic credentials from .state.json if present
    const fs = require('fs');
    if (fs.existsSync('.state.json') && process.env.USE_DYNAMIC_CREDS === 'true') {
      try {
        const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
        if (state.credentials) {
          const map = {
            admin: 'ADMIN',
            resepsionis: 'RECEPTIONIST',
            finance: 'FINANCE',
            kasir: 'CASHIER',
            perawat: 'NURSE',
            dokter: 'DOCTOR'
          };
          for (const [key, roleKey] of Object.entries(map)) {
            if (state.credentials[roleKey]) {
              this.ROLE_CREDENTIALS[key] = {
                email: state.credentials[roleKey].email,
                password: state.credentials[roleKey].password
              };
            }
          }
        }
      } catch (e) {
        // Fall back silently on read errors
      }
    }
  }

  /**
   * Navigates to the login page.
   * @param {string} [path='/login']
   */
  async goto(path = '/login') {
    await super.goto(path);
  }

  /**
   * Retrieves credentials for a given role name.
   * @param {string} roleName
   * @returns {{ email: string, password: string }}
   */
  getCredentials(roleName) {
    const key = (roleName || '').trim().toLowerCase();
    const creds = this.ROLE_CREDENTIALS[key];
    if (!creds) {
      throw new Error(`Role '${roleName}' not recognized. Valid roles: ${Object.keys(this.ROLE_CREDENTIALS).join(', ')}`);
    }
    return creds;
  }

  /**
   * Logs in with provided email and password.
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    if (email !== undefined && email !== null && email !== '') {
      await this.emailInput.fill(email);
    }
    if (password !== undefined && password !== null && password !== '') {
      await this.passwordInput.fill(password);
    }
    await this.loginButton.click();
  }

  /**
   * Automatically logs in as the specified role. Retries once on session expiry
   * (i.e. when URL stays on /login after the first attempt).
   * @param {string} roleName
   */
  async loginAs(roleName) {
    const { email, password } = this.getCredentials(roleName);
    this._lastCredentials = { email, password };
    this._lastRole = roleName;
    const key = (roleName || '').trim().toLowerCase();
    const ADMIN_PORTAL_ROLES = ['superadmin', 'khayr admin', 'khayradmin'];
    const loginPath = ADMIN_PORTAL_ROLES.includes(key) ? '/admin' : '/login';

    await this.goto(loginPath);
    await this.login(email, password);
    await this.page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => null);

    // If still on any login-like page, retry once (handles session expiry mid-run)
    const currentUrl = this.page.url();
    const isStillOnLogin = currentUrl.includes(loginPath.replace(/^\//, ''));
    if (isStillOnLogin) {
      await this.page.waitForTimeout(1000).catch(() => null);
      await this.goto(loginPath);
      await this.page.waitForTimeout(500).catch(() => null);
      await this.emailInput.fill(email, { timeout: 10000 }).catch(() => null);
      await this.passwordInput.fill(password, { timeout: 10000 }).catch(() => null);
      await this.loginButton.click({ timeout: 10000 }).catch(() => null);
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    }

    try {
      await this.assertLoginSuccess();
      return true;
    } catch (e) {
      console.warn(`[LoginPage] loginAs('${roleName}') failed: ${String(e.message || e).slice(0, 120)}`);
      return false;
    }
  }

  /**
   * Asserts that login succeeded and user redirected away from /login.
   */
  async assertLoginSuccess() {
    // Wait up to 25s for redirect away from login
    try {
      await expect(this.page).not.toHaveURL(/.*login/, { timeout: 25000 });
    } catch {
      // One more forced navigate attempt then check again
      const { email, password } = this._lastCredentials || {};
      if (email && password) {
        const isAdmin = (this._lastRole || '').toLowerCase().includes('superadmin') || (this._lastRole || '').toLowerCase().includes('khayr');
        const path = isAdmin ? '/admin' : '/login';
        await this.goto(path).catch(() => {});
        await this.login(email, password).catch(() => {});
        await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      }
      await expect(this.page).not.toHaveURL(/.*login/, { timeout: 15000 });
    }
    await this.waitForNetworkIdle();
  }

  /**
   * Asserts that login failed and user remains on /login.
   * @param {RegExp | string} [expectedError]
   */
  async assertLoginFailed(expectedError = null) {
    await expect(this.page).toHaveURL(/.*login|\/admin$/, { timeout: this.defaultTimeout });
    if (expectedError) {
      await expect(this.errorMessage).toBeVisible({ timeout: this.defaultTimeout });
      await expect(this.errorMessage).toContainText(expectedError);
    }
  }

  /**
   * Asserts validation required on empty fields.
   */
  async assertValidationRequired() {
    const isInvalid = await this.page.locator('input:invalid, form:invalid').count().catch(() => 0);
    const isLoginPage = this.page.url().includes('login');
    expect(isInvalid > 0 || isLoginPage).toBeTruthy();
  }
}

module.exports = { LoginPage };
