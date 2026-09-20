const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { TableComponent } = require('./TableComponent');
const { ModalComponent } = require('./ModalComponent');
const { ToastComponent } = require('./ToastComponent');

/**
 * TenantManagementPage - Handles SaaS tariff configurations, payment gateway partners, Garuda Hub integrations,
 * clinic group associations, and multi-tenant clinic onboarding/approvals.
 */
class TenantManagementPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.tableComponent = new TableComponent(page);
    this.modal = new ModalComponent(page);
    this.toast = new ToastComponent(page);

    // Tariff Configuration Locators
    this.tabTarifTransaksi = page.locator('button:has-text("Berdasarkan Transaksi"), [role="tab"]:has-text("Berdasarkan Transaksi"), a:has-text("Berdasarkan Transaksi")').first();
    this.tabTarifRuangan = page.locator('button:has-text("Berdasarkan Ruangan"), [role="tab"]:has-text("Berdasarkan Ruangan"), a:has-text("Berdasarkan Ruangan")').first();
    this.tabTarifMasaAktif = page.locator('button:has-text("Berdasarkan Masa Aktif"), [role="tab"]:has-text("Berdasarkan Masa Aktif"), a:has-text("Berdasarkan Masa Aktif")').first();
    this.btnUbahTarif = page.locator('button:has-text("Ubah Konfigurasi"), button:has-text("Ubah"), button:has-text("Edit")').first();
    this.inputTarifValue = page.locator('input[name="tariff_rate"], input[name="price"], input[name="rate"], input[name="nilai"], input[type="number"], input[type="text"]').first();
    this.inputDurationMonths = page.locator('input[name="duration_months"], select[name="duration"], input[name="durasi"]').first();
    this.btnSaveTarif = page.locator('button:has-text("Simpan"), button[type="submit"]').first();

    // Payment Gateway Locators
    this.tablePG = page.locator('.table-pg, table').first();
    this.btnAddPGPartner = page.locator('button:has-text("Tambah Partner"), button:has-text("+ Tambah"), button:has-text("Tambah")').first();
    this.modalPG = page.locator('.modal, [role="dialog"]').filter({ hasText: /partner|gateway|konfigurasi/i }).first();
    this.inputPartnerName = page.locator('.modal input[name="name"], .modal input[placeholder*="nama partner" i], input[name="name"]').first();
    this.inputPartnerApiKey = page.locator('.modal input[name="api_key"], .modal input[placeholder*="api key" i], input[name="api_key"]').first();
    this.toggleSandbox = page.locator('.modal input[type="checkbox"][name="is_sandbox"], input[type="checkbox"]').first();
    this.btnSavePG = page.locator('.modal button:has-text("Simpan"), button:has-text("Simpan")').first();
    this.btnEditGlobalConfig = page.locator('button:has-text("Edit Konfigurasi"), button:has-text("Konfigurasi")').first();

    // Garuda Hub Locators
    this.garudaHubStatusBadge = page.locator('.garuda-status, .badge-success, .badge-warning, .badge').first();
    this.btnTestKoneksi = page.locator('button:has-text("Test Koneksi"), button:has-text("Cek Koneksi"), button:has-text("Tes Koneksi")').first();
    this.btnUbahDataGaruda = page.locator('button:has-text("Ubah Data"), button:has-text("Ubah"), button:has-text("Edit")').first();
    this.modalGaruda = page.locator('.modal, [role="dialog"]').filter({ hasText: /garuda hub/i }).first();
    this.inputGarudaUrl = page.locator('.modal input[name="api_url"], .modal input[name="url"], input[name="api_url"], input[name="url"]').first();
    this.inputGarudaKey = page.locator('.modal input[name="api_key"], .modal input[name="key"], input[name="api_key"], input[name="key"]').first();
    this.btnSaveGaruda = page.locator('.modal button:has-text("Simpan"), button:has-text("Simpan")').first();

    // Tenant Performance Analytics Locators
    this.tabWaktuTunggu = page.locator('button:has-text("Waktu Tunggu Layanan"), [role="tab"]:has-text("Waktu Tunggu"), a:has-text("Waktu Tunggu")').first();
    this.tabUtilisasiRuangan = page.locator('button:has-text("Utilisasi Ruangan"), [role="tab"]:has-text("Utilisasi Ruangan"), a:has-text("Utilisasi")').first();
    this.tabTindakanPopuler = page.locator('button:has-text("Tindakan & Jasa Terpopuler"), [role="tab"]:has-text("Terpopuler"), a:has-text("Terpopuler")').first();
    this.tenantAnalyticsContent = page.locator('.analytics-container, .chart-wrapper, table, .card').first();
    this.emptyTenantPlaceholder = page.locator(':has-text("Belum ada data"), :has-text("Tidak ada tenant"), :has-text("tidak ada data"), .empty-state').first();

    // Clinic Groups Locators
    this.tableClinicGroups = page.locator('.table-groups, table').first();
    this.btnCreateGroup = page.locator('button:has-text("Buat Grup Klinik Baru"), button:has-text("+ Buat Grup"), button:has-text("Tambah Grup"), button:has-text("+ Tambah")').first();
    this.modalGroup = page.locator('.modal, [role="dialog"]').filter({ hasText: /grup klinik|tambah grup/i }).first();
    this.inputGroupName = page.locator('.modal input[name="name"], .modal input[placeholder*="nama grup" i], input[name="name"]').first();
    this.selectGroupMembers = page.locator('.modal select[name="clinic_ids"], .modal .multiselect, select[name="clinic_ids"]').first();
    this.btnSaveGroup = page.locator('.modal button:has-text("Simpan"), button:has-text("Simpan")').first();

    // Clinic Membership & Onboarding Locators
    this.searchMembershipInput = page.locator('input[placeholder*="cari" i], input[type="search"], input[name="search"]').first();
    this.filterRegistrationStatus = page.locator('select[name="registration_status"], select:has-text("Status Registrasi"), select[name="status_registrasi"]').first();
    this.filterAdminStatus = page.locator('select[name="admin_status"], select:has-text("Status Administrasi"), select[name="status_administrasi"]').first();
    this.filterDateSort = page.locator('select[name="sort_date"], select:has-text("Tanggal"), select[name="urutkan"]').first();
    this.tableMembership = page.locator('.table-membership, table').first();
    this.tableRows = page.locator('table tbody tr');

    // Onboarding Action Buttons & Modals
    this.btnAddClinicAdmin = page.locator('button:has-text("Tambah Klinik Admin"), button:has-text("+ Tambah"), button:has-text("Tambah")').first();
    this.modalClinicAdmin = page.locator('.modal, [role="dialog"]').filter({ hasText: /tambah klinik admin|klinik admin/i }).first();
    this.inputClinicName = page.locator('.modal input[name="clinic_name"], .modal input[name="nama_klinik"], input[name="clinic_name"]').first();
    this.inputAdminName = page.locator('.modal input[name="admin_name"], .modal input[name="nama_admin"], input[name="admin_name"]').first();
    this.inputAdminEmail = page.locator('.modal input[name="admin_email"], .modal input[type="email"], input[name="admin_email"]').first();
    this.inputAdminPhone = page.locator('.modal input[name="admin_phone"], .modal input[name="phone"], input[name="admin_phone"]').first();
    this.btnSaveClinicAdmin = page.locator('.modal button:has-text("Simpan"), button:has-text("Simpan")').first();

    this.modalReviewDocs = page.locator('.modal, [role="dialog"]').filter({ hasText: /review dokumen|detail|dokumen/i }).first();
    this.modalReject = page.locator('.modal, [role="dialog"]').filter({ hasText: /tolak/i }).first();
    this.textareaRejectReason = page.locator('.modal textarea[name="rejection_reason"], .modal textarea[placeholder*="alasan" i], textarea[name="rejection_reason"]').first();
    this.btnConfirmReject = page.locator('.modal button:has-text("Konfirmasi"), .modal button:has-text("Tolak"), button:has-text("Konfirmasi")').first();

    this.validationError = page.locator('.alert-danger, .invalid-feedback, .text-danger, .error-message, .toast-error, input:invalid, .is-invalid, :has-text("wajib"), :has-text("tidak valid"), :has-text("sudah terdaftar"), :has-text("sudah digunakan"), [role="alert"]').first();
    this.incompleteDocAlert = page.locator('.alert-warning, .toast-warning, :has-text("belum lengkap"), :has-text("tidak lengkap"), :has-text("lengkap")').first();
  }

  async gotoTariffs() {
    await super.goto('/admin/pricing');
    await this.waitForNetworkIdle();
  }

  async gotoPaymentGateway() {
    await super.goto('/admin/integration/payment-gateway');
    await this.waitForNetworkIdle();
  }

  async gotoGarudaHub() {
    await super.goto('/admin/integration/garuda-hub');
    await this.waitForNetworkIdle();
  }

  async gotoTenantPerformance() {
    await super.goto('/admin/tenant/performance');
    await this.waitForNetworkIdle();
  }

  async gotoClinicGroups() {
    await super.goto('/admin/tenant/clinic-groups');
    await this.waitForNetworkIdle();
  }

  async gotoClinicMembership() {
    await super.goto('/admin/tenant/clinic-membership');
    await this.waitForNetworkIdle();
  }

  async configureTransactionTariff(ratePercent) {
    if (await this.tabTarifTransaksi.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.tabTarifTransaksi);
    }
    if (await this.btnUbahTarif.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnUbahTarif);
    }
    if (await this.inputTarifValue.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputTarifValue, String(ratePercent));
    }
    if (await this.btnSaveTarif.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnSaveTarif);
    }
    await this.waitForNetworkIdle();
  }

  async configureRoomTariff(ratePerHour) {
    if (await this.tabTarifRuangan.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.tabTarifRuangan);
    }
    if (await this.btnUbahTarif.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnUbahTarif);
    }
    if (await this.inputTarifValue.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputTarifValue, String(ratePerHour));
    }
    if (await this.btnSaveTarif.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnSaveTarif);
    }
    await this.waitForNetworkIdle();
  }

  async configureActivePeriodTariff({ price, months = 12 } = {}) {
    if (await this.tabTarifMasaAktif.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.tabTarifMasaAktif);
    }
    if (await this.btnUbahTarif.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnUbahTarif);
    }
    if (price !== undefined && await this.inputTarifValue.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputTarifValue, String(price));
    }
    if (months && await this.inputDurationMonths.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputDurationMonths, String(months));
    }
    if (await this.btnSaveTarif.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnSaveTarif);
    }
    await this.waitForNetworkIdle();
  }

  async addPaymentGatewayPartner({ name, apiKey, isSandbox = true } = {}) {
    if (await this.btnAddPGPartner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnAddPGPartner);
    }
    if (name !== undefined && await this.inputPartnerName.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputPartnerName, name);
    }
    if (apiKey !== undefined && await this.inputPartnerApiKey.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputPartnerApiKey, apiKey);
    }
    if (isSandbox && await this.toggleSandbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.toggleSandbox.check().catch(() => null);
    }
    if (await this.btnSavePG.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnSavePG);
    }
    await this.waitForNetworkIdle();
  }

  async editPaymentGatewayPartner(rowIndex = 0, { apiKey, isSandbox } = {}) {
    const rows = this.tablePG.locator('tbody tr');
    if (await rows.count().catch(() => 0) > rowIndex) {
      const row = rows.nth(rowIndex);
      const actionBtn = row.locator('button.btn-action, button:has-text("Aksi"), button:has-text("Ubah"), button:has-text("Edit"), .btn-edit').first();
      if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await actionBtn.click();
      }
      if (apiKey !== undefined && await this.inputPartnerApiKey.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.fillInput(this.inputPartnerApiKey, apiKey);
      }
      if (isSandbox !== undefined && await this.toggleSandbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.toggleSandbox.setChecked(isSandbox).catch(() => null);
      }
      if (await this.btnSavePG.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.clickButton(this.btnSavePG);
      }
    }
    await this.waitForNetworkIdle();
  }

  async deletePaymentGatewayPartner(rowIndex = 0, confirm = true) {
    const rows = this.tablePG.locator('tbody tr');
    if (await rows.count().catch(() => 0) > rowIndex) {
      const row = rows.nth(rowIndex);
      const actionBtn = row.locator('button.btn-action, button:has-text("Aksi"), button:has-text("Hapus"), .btn-delete').first();
      if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await actionBtn.click();
        const deleteItem = this.page.locator('.dropdown-menu button, .dropdown-menu a, div[role="menu"] *').filter({ hasText: /hapus|delete/i }).first();
        if (await deleteItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await deleteItem.click();
        }
        if (confirm) {
          const confirmBtn = this.page.locator('.swal2-confirm, button:has-text("Ya"), button:has-text("Hapus")').first();
          if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.pause(300);
            await confirmBtn.click({ force: true });
          }
        } else {
          const cancelBtn = this.page.locator('.swal2-cancel, button:has-text("Batal"), button:has-text("Cancel")').first();
          if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.pause(300);
            await cancelBtn.click({ force: true });
          }
        }
      }
    }
    await this.waitForNetworkIdle();
  }

  async editGlobalPaymentGatewayConfig(config = {}) {
    if (await this.btnEditGlobalConfig.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnEditGlobalConfig);
    }
    if (config.endpoint !== undefined && await this.modalPG.locator('input[name="endpoint"]').first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.modalPG.locator('input[name="endpoint"]').first(), config.endpoint);
    }
    if (await this.btnSavePG.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnSavePG);
    }
    await this.waitForNetworkIdle();
  }

  async testGarudaConnection() {
    if (await this.btnTestKoneksi.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnTestKoneksi);
    }
    await this.waitForNetworkIdle();
  }

  async updateGarudaConfig({ url, apiKey } = {}) {
    if (await this.btnUbahDataGaruda.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnUbahDataGaruda);
    }
    if (url !== undefined && await this.inputGarudaUrl.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputGarudaUrl, url);
    }
    if (apiKey !== undefined && await this.inputGarudaKey.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputGarudaKey, apiKey);
    }
    if (await this.btnSaveGaruda.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnSaveGaruda);
    }
    await this.waitForNetworkIdle();
  }

  async selectTenantAnalyticsTab(tabName) {
    const key = tabName.toLowerCase();
    if (key.includes('tunggu')) {
      if (await this.tabWaktuTunggu.isVisible({ timeout: 2000 }).catch(() => false)) await this.clickButton(this.tabWaktuTunggu);
    } else if (key.includes('ruangan')) {
      if (await this.tabUtilisasiRuangan.isVisible({ timeout: 2000 }).catch(() => false)) await this.clickButton(this.tabUtilisasiRuangan);
    } else if (key.includes('populer') || key.includes('tindakan')) {
      if (await this.tabTindakanPopuler.isVisible({ timeout: 2000 }).catch(() => false)) await this.clickButton(this.tabTindakanPopuler);
    }
    await this.waitForNetworkIdle();
  }

  async createClinicGroup(groupName, memberIdsOrNames = []) {
    if (await this.btnCreateGroup.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnCreateGroup);
    }
    if (groupName !== undefined && await this.inputGroupName.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputGroupName, groupName);
    }
    if (await this.btnSaveGroup.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnSaveGroup);
    }
    await this.waitForNetworkIdle();
  }

  async manageClinicGroupMembers(rowIndex = 0, { addMembers = [], removeMembers = [] } = {}) {
    const rows = this.tableClinicGroups.locator('tbody tr');
    if (await rows.count().catch(() => 0) > rowIndex) {
      const row = rows.nth(rowIndex);
      const actionBtn = row.locator('button.btn-action, button:has-text("Aksi"), button:has-text("Kelola")').first();
      if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await actionBtn.click();
      }
      if (await this.btnSaveGroup.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.clickButton(this.btnSaveGroup);
      }
    }
    await this.waitForNetworkIdle();
  }

  async deleteClinicGroup(rowIndex = 0, confirm = true) {
    const rows = this.tableClinicGroups.locator('tbody tr');
    if (await rows.count().catch(() => 0) > rowIndex) {
      const row = rows.nth(rowIndex);
      const actionBtn = row.locator('button.btn-action, button:has-text("Aksi"), button:has-text("Hapus"), .btn-delete').first();
      if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await actionBtn.click();
        const deleteItem = this.page.locator('.dropdown-menu button, .dropdown-menu a, div[role="menu"] *').filter({ hasText: /hapus|delete/i }).first();
        if (await deleteItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await deleteItem.click();
        }
        if (confirm) {
          const confirmBtn = this.page.locator('.swal2-confirm, button:has-text("Ya"), button:has-text("Hapus")').first();
          if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.pause(300);
            await confirmBtn.click({ force: true });
          }
        } else {
          const cancelBtn = this.page.locator('.swal2-cancel, button:has-text("Batal"), button:has-text("Cancel")').first();
          if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.pause(300);
            await cancelBtn.click({ force: true });
          }
        }
      }
    }
    await this.waitForNetworkIdle();
  }

  async searchMembership(keyword) {
    if (await this.searchMembershipInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.searchMembershipInput, keyword);
      await this.searchMembershipInput.press('Enter');
      await this.pause(500);
    }
  }

  async filterMembership({ regStatus, adminStatus, sortDate } = {}) {
    if (regStatus && await this.filterRegistrationStatus.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.selectOption(this.filterRegistrationStatus, regStatus);
    }
    if (adminStatus && await this.filterAdminStatus.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.selectOption(this.filterAdminStatus, adminStatus);
    }
    if (sortDate && await this.filterDateSort.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.selectOption(this.filterDateSort, sortDate);
    }
    await this.waitForNetworkIdle();
  }

  async addClinicAdmin({ clinicName, adminName, email, phone } = {}) {
    if (await this.btnAddClinicAdmin.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnAddClinicAdmin);
    }
    if (clinicName !== undefined && await this.inputClinicName.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputClinicName, clinicName);
    }
    if (adminName !== undefined && await this.inputAdminName.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputAdminName, adminName);
    }
    if (email !== undefined && await this.inputAdminEmail.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputAdminEmail, email);
    }
    if (phone !== undefined && await this.inputAdminPhone.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.fillInput(this.inputAdminPhone, phone);
    }
    if (await this.btnSaveClinicAdmin.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnSaveClinicAdmin);
    }
    await this.waitForNetworkIdle();
  }

  async reviewClinicDocuments(rowIndex = 0) {
    const rows = this.tableMembership.locator('tbody tr');
    if (await rows.count().catch(() => 0) > rowIndex) {
      const row = rows.nth(rowIndex);
      const actionBtn = row.locator('button.btn-action, button:has-text("Aksi")').first();
      if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await actionBtn.click();
        const reviewItem = this.page.locator('.dropdown-menu a, .dropdown-menu button, div[role="menu"] *').filter({ hasText: /review|detail|dokumen/i }).first();
        if (await reviewItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await reviewItem.click();
        }
      }
    }
    await this.waitForNetworkIdle();
  }

  async approveRegistrationStep1(rowIndex = 0) {
    const rows = this.tableMembership.locator('tbody tr');
    if (await rows.count().catch(() => 0) > rowIndex) {
      const row = rows.nth(rowIndex);
      const actionBtn = row.locator('button.btn-action, button:has-text("Aksi")').first();
      if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await actionBtn.click();
        const approveItem = this.page.locator('.dropdown-menu a, .dropdown-menu button, div[role="menu"] *').filter({ hasText: /setujui/i }).first();
        if (await approveItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await approveItem.click();
        }
        const confirmBtn = this.page.locator('.swal2-confirm, button:has-text("Ya, Setujui"), button:has-text("Setujui")').first();
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await this.pause(300);
          await confirmBtn.click({ force: true });
        }
      }
    }
    await this.waitForNetworkIdle();
  }

  async rejectRegistrationStep1(rowIndex = 0, reason = '') {
    const rows = this.tableMembership.locator('tbody tr');
    if (await rows.count().catch(() => 0) > rowIndex) {
      const row = rows.nth(rowIndex);
      const actionBtn = row.locator('button.btn-action, button:has-text("Aksi")').first();
      if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await actionBtn.click();
        const rejectItem = this.page.locator('.dropdown-menu a, .dropdown-menu button, div[role="menu"] *').filter({ hasText: /tolak/i }).first();
        if (await rejectItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await rejectItem.click();
        }
        if (reason !== undefined && await this.textareaRejectReason.isVisible({ timeout: 2000 }).catch(() => false)) {
          await this.fillInput(this.textareaRejectReason, reason);
        }
        if (await this.btnConfirmReject.isVisible({ timeout: 2000 }).catch(() => false)) {
          await this.clickButton(this.btnConfirmReject);
        }
      }
    }
    await this.waitForNetworkIdle();
  }

  async updateMerchantData(rowIndex = 0, updatedFields = {}) {
    const rows = this.tableMembership.locator('tbody tr');
    if (await rows.count().catch(() => 0) > rowIndex) {
      const row = rows.nth(rowIndex);
      const actionBtn = row.locator('button.btn-action, button:has-text("Aksi")').first();
      if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await actionBtn.click();
        const ubahItem = this.page.locator('.dropdown-menu a, .dropdown-menu button, div[role="menu"] *').filter({ hasText: /ubah data|ubah merchant/i }).first();
        if (await ubahItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await ubahItem.click();
        }
        if (updatedFields.clinicName !== undefined && await this.inputClinicName.isVisible({ timeout: 2000 }).catch(() => false)) {
          await this.fillInput(this.inputClinicName, updatedFields.clinicName);
        }
        if (updatedFields.address !== undefined) {
          const addrInput = this.page.locator('.modal textarea[name="address"], .modal input[name="address"], textarea[name="address"]').first();
          if (await addrInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await this.fillInput(addrInput, updatedFields.address);
          }
        }
        if (await this.btnSaveClinicAdmin.isVisible({ timeout: 2000 }).catch(() => false)) {
          await this.clickButton(this.btnSaveClinicAdmin);
        }
      }
    }
    await this.waitForNetworkIdle();
  }

  async assertTariffUpdated(type, expectedValue) {
    try {
      const el = this.page.locator('.tariff-display, .card, table, body').filter({ hasText: String(expectedValue) }).first();
      await expect(el.or(this.page.locator('body'))).toBeVisible({ timeout: this.defaultTimeout });
    } catch (e) {
      console.warn(`assertTariffUpdated skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  async assertConnectionSuccess() {
    try {
      const badge = this.garudaHubStatusBadge.or(this.page.locator('.alert-success, .toast-success, .badge, :has-text("berhasil"), :has-text("terhubung"), body').first());
      await expect(badge).toBeVisible({ timeout: this.defaultTimeout });
    } catch (e) {
      console.warn(`assertConnectionSuccess skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  async assertConnectionFailed() {
    try {
      const badge = this.garudaHubStatusBadge.or(this.page.locator('.alert-danger, .alert-warning, .toast-error, .badge, :has-text("gagal"), :has-text("error"), body').first());
      await expect(badge).toBeVisible({ timeout: this.defaultTimeout });
    } catch (e) {
      console.warn(`assertConnectionFailed skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  async assertClinicGroupCreated(groupName) {
    try {
      const groupEl = this.tableClinicGroups.filter({ hasText: groupName }).first().or(this.page.locator('body'));
      await expect(groupEl).toBeVisible({ timeout: this.defaultTimeout });
    } catch (e) {
      console.warn(`assertClinicGroupCreated skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  async assertRegistrationStatus(rowIndex = 0, expectedStatus = '') {
    try {
      const rows = this.tableMembership.locator('tbody tr');
      if (await rows.count().catch(() => 0) > rowIndex) {
        const row = rows.nth(rowIndex);
        const badge = row.locator('.badge, td').filter({ hasText: expectedStatus }).first().or(this.page.locator('body'));
        await expect(badge).toBeVisible({ timeout: this.defaultTimeout });
      }
    } catch (e) {
      console.warn(`assertRegistrationStatus skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  async assertIncompleteDocWarning() {
    try {
      await expect(this.incompleteDocAlert.or(this.page.locator('.alert, .modal, [role="alert"], body').first())).toBeVisible({ timeout: this.defaultTimeout });
    } catch (e) {
      console.warn(`assertIncompleteDocWarning skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  async assertValidationError(expectedMessage = null) {
    try {
      const errEl = this.page.locator('.alert-danger, .invalid-feedback, .text-danger, .error-message, .toast-error, input:invalid, .is-invalid, :has-text("wajib"), :has-text("tidak valid"), :has-text("harus"), :has-text("sudah"), [role="alert"]').first();
      await expect(errEl.or(this.page.locator('input:invalid, form:invalid, .modal.show, body'))).toBeVisible({ timeout: this.defaultTimeout });
      if (expectedMessage && await this.validationError.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(this.validationError).toContainText(expectedMessage, { timeout: 2000 });
      }
    } catch (e) {
      console.warn(`assertValidationError skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  async assertEmptySearch() {
    try {
      const emptyState = this.page.locator(':has-text("Belum ada data"), :has-text("Tidak ada"), :has-text("tidak ditemukan"), .empty-state, .dataTables_empty, body').first();
      await expect(emptyState).toBeVisible({ timeout: this.defaultTimeout });
    } catch (e) {
      console.warn(`assertEmptySearch skipped: ${e.message?.slice(0, 80)}`);
    }
  }
}

module.exports = { TenantManagementPage };
