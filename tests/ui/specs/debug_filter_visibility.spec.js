const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { SidebarNav } = require('../pages/SidebarNav');
const { ReservationListPage } = require('../pages/ReservationListPage');

test.skip('DEBUG: check visibility values', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const sidebarNav = new SidebarNav(page);
  const reservationListPage = new ReservationListPage(page);

  await loginPage.goto();
  await loginPage.login('Dokter@test-org.com', 'N91U9XOW');
  await loginPage.assertLoginSuccess();

  await sidebarNav.navigateToMenu('Pasien', 'Lihat Reservasi');
  await page.waitForTimeout(3000);

  const isDropdownVisible = await reservationListPage.statusFilterDropdown.isVisible();
  const isTriggerVisible = await reservationListPage.btnFilterTrigger.isVisible();

  console.log('statusFilterDropdown isVisible:', isDropdownVisible);
  console.log('btnFilterTrigger isVisible:', isTriggerVisible);

  console.log('Resolving statusFilterDropdown elements:');
  const count = await reservationListPage.statusFilterDropdown.count();
  console.log('Count:', count);
  for (let i = 0; i < count; i++) {
    console.log(`Element ${i}:`, await reservationListPage.statusFilterDropdown.nth(i).evaluate(el => el.outerHTML));
  }
});
