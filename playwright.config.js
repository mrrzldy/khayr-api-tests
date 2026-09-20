const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

const UI_USE = {
  ...devices['Desktop Chrome'],
  headless: true,
  baseURL: process.env.UI_BASE_URL || process.env.BASE_URL || 'https://internal.dev.khayr.id',
  viewport: { width: 1280, height: 720 },
  actionTimeout: 8000,
  navigationTimeout: 60000,
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
};

module.exports = defineConfig({
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  reporter: [['html', { open: 'never' }], ['list']],
  expect: {
    timeout: 10000,
  },
  // Exclude debug helper specs from all runs
  testIgnore: ['**/debug_*.spec.js'],

  projects: [
    // ── API tests ──────────────────────────────────────────────────────────
    {
      name: 'api',
      testMatch: 'tests/api/**/*.spec.js',
      use: {
        extraHTTPHeaders: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      },
    },

    // ── UI (browser) tests — all roles ─────────────────────────────────────
    {
      name: 'ui',
      testMatch: 'tests/ui/specs/[0-9]*.spec.js',
      use: UI_USE,
    },

    // ── Per-role UI projects ────────────────────────────────────────────────
    {
      name: 'ui-superadmin',
      testMatch: 'tests/ui/specs/03_superadmin.spec.js',
      use: UI_USE,
    },
    {
      name: 'ui-dokter',
      testMatch: 'tests/ui/specs/04_dokter.spec.js',
      use: UI_USE,
    },
    {
      name: 'ui-perawat',
      testMatch: 'tests/ui/specs/05_perawat.spec.js',
      use: UI_USE,
    },
    {
      name: 'ui-resepsionis',
      testMatch: 'tests/ui/specs/06_resepsionis.spec.js',
      use: UI_USE,
    },
    {
      name: 'ui-admin',
      testMatch: 'tests/ui/specs/07_admin.spec.js',
      use: UI_USE,
    },
    {
      name: 'ui-finance',
      testMatch: 'tests/ui/specs/08_finance.spec.js',
      use: UI_USE,
    },
    {
      name: 'ui-kasir',
      testMatch: 'tests/ui/specs/09_kasir.spec.js',
      use: UI_USE,
    },
    {
      name: 'ui-khayr-admin',
      testMatch: 'tests/ui/specs/10_khayr_admin.spec.js',
      use: UI_USE,
    },
  ],
});
