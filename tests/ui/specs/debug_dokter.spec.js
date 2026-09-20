const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');

test.skip('DEBUG: Default Dokter login', async ({ page }) => {
  const loginPage = new LoginPage(page);

  page.on('response', res => {
    if (res.status() === 403) {
      console.log('403 FORBIDDEN REQUEST:', res.request().method(), res.url());
    }
  });

  console.log('Navigating to login page...');
  await loginPage.goto();

  console.log('Logging in as Default Dokter...');
  await loginPage.login('Dokter@test-org.com', 'N91U9XOW');
  await loginPage.assertLoginSuccess();

  await page.waitForTimeout(5000);
});
