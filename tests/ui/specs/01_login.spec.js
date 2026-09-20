const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { SidebarNav } = require('../pages/SidebarNav');

test.describe('UI Test: Superadmin Login (Priority 2)', () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto('/admin');
  });

  test('SA-001: Login Success with valid Superadmin credentials', async () => {
    // Data Uji
    const email = 'dev.khayr@mail.com';
    const password = '123456'; 

    // Langkah Reproduksi
    await loginPage.login(email, password);

    // Hasil yang Diharapkan
    await loginPage.assertLoginSuccess();
  });

  test('SA-002: Login Failed with invalid password', async () => {
    const email = 'dev.khayr@mail.com';
    const password = 'passwordSalah123';

    await loginPage.login(email, password);

    // Tunggu respon alert / navigasi
    await loginPage.assertLoginFailed();
  });

  test('SA-003: Login Failed with empty credentials', async () => {
    await loginPage.login('', '');

    await loginPage.assertValidationRequired();
  });
});

test.describe('UI Test: Multi-Role Authentication & Sidebar Navigation via POM (loginAs)', () => {
  test('AUTH-001: Verify LoginPage.loginAs("Superadmin") redirects and displays sidebar', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const sidebarNav = new SidebarNav(page);

    await loginPage.loginAs('Superadmin');
    await loginPage.assertLoginSuccess();
    await sidebarNav.expectVisible(sidebarNav.sidebarContainer, 'Sidebar navigation container must be visible after Superadmin login');
  });

  test('AUTH-002: Verify LoginPage.loginAs("Dokter") redirects and displays sidebar', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const sidebarNav = new SidebarNav(page);

    await loginPage.loginAs('Dokter');
    await loginPage.assertLoginSuccess();
    await sidebarNav.expectVisible(sidebarNav.sidebarContainer, 'Sidebar navigation container must be visible after Dokter login');
  });

  test('AUTH-003: Verify getCredentials error handling for invalid role', async ({ page }) => {
    const loginPage = new LoginPage(page);
    expect(() => loginPage.getCredentials('UnregisteredRole')).toThrow(/not recognized/i);
  });
});
