const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { DashboardPage } = require('../pages/DashboardPage');

test.skip('DEBUG: Superadmin login and dashboard check', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to login page...');
  await loginPage.goto();

  console.log('Logging in as Superadmin...');
  await loginPage.login('dev.khayr@mail.com', '123456');

  console.log('Asserting login success...');
  await loginPage.assertLoginSuccess();

  console.log('Navigating to dashboard...');
  await dashboardPage.gotoDashboard();

  console.log('Current URL:', page.url());

  console.log('Taking screenshot...');
  await page.screenshot({ path: 'C:/Users/user/.gemini/antigravity/brain/85597292-c305-4e32-8261-d5fc67ec8034/debug_dashboard.png', fullPage: true });

  const bodyText = await page.locator('body').innerText();
  console.log('Body text:', bodyText.substring(0, 1000));
});
