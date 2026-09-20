const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { SidebarNav } = require('../pages/SidebarNav');
const { ReservationListPage } = require('../pages/ReservationListPage');

test.skip('DEBUG: Run filterByStatus and trace execution', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const sidebarNav = new SidebarNav(page);
  const reservationListPage = new ReservationListPage(page);

  await loginPage.goto();
  await loginPage.login('Dokter@test-org.com', 'N91U9XOW');
  await loginPage.assertLoginSuccess();

  await sidebarNav.navigateToMenu('Pasien', 'Lihat Reservasi');
  await page.waitForTimeout(3000);

  console.log('Calling filterByStatus("Pasien Hadir")...');
  try {
    await reservationListPage.filterByStatus('Pasien Hadir');
    console.log('filterByStatus completed successfully!');
  } catch (err) {
    console.log('filterByStatus failed! Error:', err.message);
  }

  console.log('Current URL after filter:', page.url());
});
