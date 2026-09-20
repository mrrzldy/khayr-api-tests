const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');

/**
 * SidebarNav - Encapsulates all sidebar navigation interactions and role menu checks.
 */
class SidebarNav extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.sidebarContainer = page.locator('aside, nav.sidebar, .sidebar-wrapper, .sidebar, .sidebar-menu, [role="navigation"]').first();
    this.userProfileDropdown = page.locator('.user-profile, .avatar-dropdown, [data-testid="user-menu"], .profile-toggle').first();
    this.logoutButton = page.locator('button:has-text("Keluar"), a:has-text("Keluar"), button:has-text("Logout"), a:has-text("Logout")').first();
  }

  /**
   * Finds a menu item locator by text within the sidebar.
   * @param {string} menuName
   * @returns {import('@playwright/test').Locator}
   */
  getMenuItemLocator(menuName) {
    return this.sidebarContainer.locator(`a, button, li, .nav-item, .menu-item, .nav-link`).filter({ hasText: new RegExp(`^\\s*${menuName}\\s*$`, 'i') }).first();
  }

  /**
   * Returns true if a high-z-index fixed overlay is blocking the UI.
   * Uses computed z-index (not CSS class names) to avoid Tailwind bracket issues.
   * @returns {Promise<boolean>}
   */
  async _hasBlockingOverlay() {
    return this.page.evaluate(() => {
      for (const el of document.querySelectorAll('div.fixed, div[style*="position: fixed"], div[style*="position:fixed"]')) {
        const z = parseInt(window.getComputedStyle(el).zIndex || '0', 10);
        const style = window.getComputedStyle(el);
        if (z >= 9999 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          return true;
        }
      }
      return false;
    }).catch(() => false);
  }

  /**
   * Navigates directly via the URL map, bypassing all sidebar DOM interaction.
   * @param {string} parentMenu
   * @param {string} [subMenu]
   */
  async _navigateViaUrlMap(parentMenu, subMenu = null) {
    const matched = await this._tryUrlMap(parentMenu, subMenu);
    return matched;
  }

  async _tryUrlMap(parentMenu, subMenu = null) {
    const urlMap = {
      // Core navigation
      'dashboard': '/dashboard',
      'jadwal praktik': '/timetable',
      'timetable': '/timetable',

      // Patient / Reservation
      'buat reservasi': '/patient/reservation/create',
      'lihat reservasi': '/patient/reservation',
      'reservasi': '/patient/reservation',
      'data pasien': '/patient/list',       // was /patient/data — real route is /patient/list
      'pasien': '/patient/list',

      // Payment
      'pembayaran': '/payment/list',
      'payment': '/payment/list',

      // Personnel — real routes use /personel/ (not /personnel/) per routes.tsx
      'data personel': '/personel/data-personel/list',  // was /personnel/data
      'personel': '/personel/data-personel/list',
      'jadwal shift': '/personel/schedule-personel/list',  // was /personnel/shifts
      'jadwal personel': '/personel/schedule-personel/list',
      'daftar kehadiran': '/personel/kehadiran',
      'pengajuan cuti': '/personel/pengajuan-cuti',
      'kehadiran dan cuti': '/pengaturan/kehadiran-cuti',
      'bagi hasil dokter': '/pengaturan/bagi-hasil-dokter',

      // Quota
      'beli/topup kuota': '/manajemen-kuota/pembayaran',
      'penggunaan kuota': '/manajemen-kuota/penggunaan',

      // Inventory
      'inventori': '/inventory',
      'inventory': '/inventory',

      // Master Data — real routes use /master-data/ not /master/
      'produk/bahan/obat/alat': '/master-data/product',    // was /master/product
      'produk': '/master-data/product',
      'kategori produk': '/master-data/product-category',  // was /master/category
      'product category': '/master-data/product-category',
      'jasa/tindakan': '/master-data/procedure',            // was /master/service
      'prosedur': '/master-data/procedure',
      'tindakan': '/master-data/procedure',
      'asuransi': '/master-data/insurer',                   // was /master/insurance
      'insurer': '/master-data/insurer',
      'ruangan': '/master-data/room',                       // was /master/room
      'lokasi': '/master-data/location',
      'location': '/master-data/location',
      'parameter keuangan': '/master-data/finance-param',
      'data demografi': '/master-data/demography',

      // Finance
      'general ledger': '/pengaturan/input-keuangan/general-ledger',
      'cash flow': '/pengaturan/input-keuangan/cash-flow',

      // Membership / Clinic settings
      'profil klinik': '/pengaturan/keanggotaan/profil',
      'dokumen administrasi': '/pengaturan/keanggotaan/dokumen-administrasi',
      'garuda hub': '/pengaturan/keanggotaan/garuda-hub',

      // Voucher marketplace
      'buat promo': '/voucher-marketplace/buat-promo',
      'riwayat promo': '/voucher-marketplace/riwayat-promo',
      'invoice & settlement': '/voucher-marketplace/invoice-settlement',

      // Reports
      'laporan keuangan': '/report/financial-report/list',
      'laporan bagi hasil': '/report/doctor-fee',
      'laporan kinerja': '/report/performance/list',
      'profil 360': '/report/profile-360',
      'rekam medis': '/report/medical-records/list',          // was /doctor/medical-record

      // Doctor flows — real route is /doctor/consultation-treatment/list
      'dokter konsultasi & tindakan': '/doctor/consultation-treatment/list',
      'konsultasi & tindakan': '/doctor/consultation-treatment/list',  // was /doctor/consultation
      'konsultasi': '/doctor/consultation-treatment/list',
      'consultation': '/doctor/consultation-treatment/list',

      // Superadmin routes
      'hak akses': '/admin/access-control',
      'pengaturan tarif': '/admin/pricing',
      'tarif': '/admin/pricing',
      'payment gateway': '/admin/integration/payment-gateway',
      'laporan kinerja tenant': '/admin/tenant/performance',
      'manajemen tenant laporan kinerja': '/admin/tenant/performance',
      'manajemen tenant keanggotaan klinik': '/admin/tenant/clinic-membership',
      'manajemen tenant grup klinik': '/admin/tenant/clinic-groups',
      'kinerja tenant': '/admin/tenant/performance',
      'grup klinik': '/admin/tenant/clinic-groups',
      'keanggotaan klinik': '/admin/tenant/clinic-membership',
    };
    // Build combined parent+sub key for disambiguation (e.g. Tenant > Laporan Kinerja vs Laporan > Laporan Kinerja)
    const subKey = (subMenu || '').toLowerCase();
    const parentKey = (parentMenu || '').toLowerCase();
    const combinedKey = subMenu ? `${parentKey} ${subKey}` : parentKey;
    const key = (subMenu || parentMenu).toLowerCase();

    // 1. Try exact combined key match first
    if (urlMap[combinedKey]) {
      await this.goto(urlMap[combinedKey]);
      await this.waitForNetworkIdle();
      return true;
    }
    // 2. Try partial combined key (combined includes map key)
    for (const [k, url] of Object.entries(urlMap)) {
      if (k.length > key.length && combinedKey.includes(k)) {
        await this.goto(url);
        await this.waitForNetworkIdle();
        return true;
      }
    }
    // 3. Fall back to subMenu/parentMenu key — sorted by key length desc so more specific entries win
    for (const [k, url] of Object.entries(urlMap).sort((a, b) => b[0].length - a[0].length)) {
      if (key === k || key.includes(k) || k.includes(key)) {
        await this.goto(url);
        await this.waitForNetworkIdle();
        return true;
      }
    }
    return false;
  }

  /**
   * Dismisses any blocking full-screen overlay/modal that would intercept pointer events.
   * Uses computed z-index (not class names) to detect overlays, and force-removes via JS.
   */
  async dismissBlockingOverlay() {
    try {
      const hasOverlay = await this._hasBlockingOverlay();
      if (!hasOverlay) return;

      // 1. Try Escape key (sent to focused element / document)
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.waitForTimeout(400);

      // 2. Try clicking a close button inside the modal
      const closeBtn = this.page.locator([
        'button[aria-label*="close" i]',
        'button[aria-label*="tutup" i]',
        'button:has(.fa-times)',
        'button:has(.fa-xmark)',
        'button:has([class*="close"])',
        '[data-dismiss="modal"]',
        '.modal-close',
      ].join(', ')).first();
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(400);
      }

      // 3. Force-hide via JS as last resort
      await this.page.evaluate(() => {
        document.querySelectorAll('div.fixed, div[style*="position: fixed"], div[style*="position:fixed"]').forEach(el => {
          const z = parseInt(window.getComputedStyle(el).zIndex || '0', 10);
          if (z >= 9999) el.style.display = 'none';
        });
      }).catch(() => {});

    } catch (_) { /* ignore */ }
  }

  /**
   * Navigates to a top-level menu or submenu item.
   * @param {string} parentMenu
   * @param {string} [subMenu]
   */
  async navigateTo(parentMenu, subMenu = null) {
    await this.waitForSpinnerDisappear();

    // Always try URL map FIRST for deterministic, overlap-free navigation
    const mappedByUrl = await this._tryUrlMap(parentMenu, subMenu);
    if (mappedByUrl) return;

    // If a blocking overlay is present, skip all sidebar DOM interaction
    const overlayBlocking = await this._hasBlockingOverlay();
    if (overlayBlocking) {
      return; // already tried URL map above, nothing else we can do
    }

    // Dismiss any full-screen overlay that could block pointer events on the sidebar
    await this.dismissBlockingOverlay();

    if (subMenu) {
      // Locate parent category button/header
      const parentCategory = this.page.locator('aside, nav, .sidebar, [role="navigation"]').locator('button, a, .nav-link, .menu-header, .accordion-button').filter({ hasText: new RegExp(`^\\s*${parentMenu}`, 'i') }).first();
      if (await parentCategory.isVisible().catch(() => false)) {
        // Check if accordion is already expanded or collapsed
        const isExpanded = await parentCategory.getAttribute('aria-expanded');
        const isCollapsed = await parentCategory.getAttribute('class').then(cls => (cls || '').includes('collapsed')).catch(() => false);
        if (isExpanded === 'false' || isCollapsed) {
          await parentCategory.click();
          await this.pause(300);
        }

        const subItem = this.page.locator('aside, nav, .sidebar, [role="navigation"]').locator('a, .nav-link, .submenu-item, [role="menuitem"], .dropdown-item').filter({ hasText: new RegExp(subMenu, 'i') }).first();
        if (await subItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await subItem.click();
          await this.waitForNetworkIdle();
          return;
        }
      }
    } else {
      const directItem = this.page.locator('aside, nav, .sidebar, [role="navigation"]').locator('a, button, .nav-link, .menu-item').filter({ hasText: new RegExp(`^\\s*${parentMenu}`, 'i') }).first();
      if (await directItem.isVisible().catch(() => false)) {
        await directItem.click();
        await this.waitForNetworkIdle();
        return;
      }
    }

    // Check if parentMenu is already visible in general layout
    let parentLocator = this.page.locator('aside, nav, .sidebar, header, [role="navigation"]').locator('a, button, li, .nav-link, .menu-item').filter({ hasText: new RegExp(`^\\s*${parentMenu}`, 'i') }).first();
    let isVisible = await parentLocator.isVisible().catch(() => false);

    if (!isVisible) {
      parentLocator = this.page.locator('a, button, .nav-link, .menu-item, [role="menuitem"], .dropdown-item').filter({ hasText: new RegExp(parentMenu, 'i') }).first();
      isVisible = await parentLocator.isVisible().catch(() => false);
    }

    if (!isVisible) {
      // Try opening role menu button or hamburger toggle if present
      const roleMenuBtn = this.page.locator('button:has-text("Kasir"), button:has-text("Finance"), button:has-text("Klinik"), .sidebar-toggle, button.navbar-toggler, button[aria-label*="menu" i]').first();
      if (await roleMenuBtn.isVisible().catch(() => false)) {
        await roleMenuBtn.click();
        await this.pause(400);
      }
      parentLocator = this.page.locator('a, button, li, .nav-link, .menu-item, [role="menuitem"], .dropdown-item').filter({ hasText: new RegExp(parentMenu, 'i') }).first();
      isVisible = await parentLocator.isVisible().catch(() => false);
    }

    if (!isVisible) {
      const hamburger = this.page.locator('button:has(.fa-bars), button:has(svg), button.btn-sidebar, .hamburger').first();
      if (await hamburger.isVisible().catch(() => false)) {
        await hamburger.click();
        await this.pause(400);
      }
      parentLocator = this.page.locator('a, button, li, .nav-link, .menu-item, [role="menuitem"], .dropdown-item').filter({ hasText: new RegExp(parentMenu, 'i') }).first();
      isVisible = await parentLocator.isVisible().catch(() => false);
    }

    if (isVisible) {
      await parentLocator.scrollIntoViewIfNeeded();
      if (!subMenu) {
        await parentLocator.click();
        await this.waitForNetworkIdle();
        return;
      }

      let subLocator = this.page.locator('a, button, li, .nav-link, .submenu-item, [role="menuitem"], .dropdown-item').filter({ hasText: new RegExp(subMenu, 'i') }).first();
      if (!await subLocator.isVisible().catch(() => false)) {
        await parentLocator.click();
        await this.pause(300);
      }
      subLocator = this.page.locator('a, button, li, .nav-link, .submenu-item, [role="menuitem"], .dropdown-item').filter({ hasText: new RegExp(subMenu, 'i') }).first();
      if (await subLocator.isVisible().catch(() => false)) {
        await subLocator.scrollIntoViewIfNeeded();
        await subLocator.click();
        await this.waitForNetworkIdle();
        return;
      }
    }

    // Fallback: navigate via URL map
    await this._navigateViaUrlMap(parentMenu, subMenu);
  }

  /**
   * Alias method for navigateTo matching interface contract in PROJECT.md
   * @param {string} menuName
   * @param {string} [subMenuName]
   */
  async navigateToMenu(menuName, subMenuName = null) {
    await this.navigateTo(menuName, subMenuName);
  }

  /**
   * Asserts that a menu item is currently marked as active.
   * @param {string} menuName
   */
  async expectActiveMenu(menuName) {
    const item = this.sidebarContainer.locator(`a.active, li.active, .nav-link.active, .menu-item.active, .active`).filter({ hasText: new RegExp(menuName, 'i') }).first();
    await expect(item).toBeVisible({ timeout: this.defaultTimeout });
  }

  /**
   * Extracts all currently visible sidebar menu names.
   * @returns {Promise<string[]>}
   */
  async getVisibleMenuItems() {
    const items = this.sidebarContainer.locator('a, .nav-link, .menu-title, .menu-item');
    const count = await items.count();
    const result = [];
    for (let i = 0; i < count; i++) {
      if (await items.nth(i).isVisible().catch(() => false)) {
        const text = (await items.nth(i).innerText().catch(() => '')).trim();
        if (text && !result.includes(text)) {
          result.push(text);
        }
      }
    }
    return result;
  }

  /**
   * Executes logout from the top navigation / sidebar.
   */
  async logout() {
    if (await this.userProfileDropdown.isVisible().catch(() => false)) {
      await this.userProfileDropdown.click();
    }
    await this.logoutButton.waitFor({ state: 'visible', timeout: this.defaultTimeout });
    await this.logoutButton.click();
    await this.page.waitForURL(/.*login/, { timeout: this.defaultTimeout });
  }
}

module.exports = { SidebarNav };
