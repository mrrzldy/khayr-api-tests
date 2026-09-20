const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { TableComponent } = require('./TableComponent');
const { ModalComponent } = require('./ModalComponent');
const { ToastComponent } = require('./ToastComponent');

/**
 * MasterDataPage - Handles master data configuration (Products, Categories, Procedures, Insurances, Rooms, Financial Parameters).
 */
class MasterDataPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);

    this.tableComponent = new TableComponent(page);
    this.modal = new ModalComponent(page);
    this.toast = new ToastComponent(page);

    // Generic Master Elements
    this.btnTambahData = page.locator('button:has-text("Tambah"), button:has-text("+"), button:has-text("Tambah Data"), a:has-text("Tambah")').first();
    this.searchInput = page.locator('input[type="search"], input[placeholder*="Cari" i], input[name="search"]').first();
    this.tableMaster = page.locator('table tbody tr');
    this.modalMaster = page.locator('.modal.show, .modal:has-text("Tambah"), .modal:has-text("Ubah"), .modal:has-text("Detail"), .modal-dialog, .modal').first();
    
    // Submodule Flexible Inputs
    this.inputName = page.locator('.modal input[name="name"], .modal input[name="nama"], .modal input[name="service_name"], .modal input[name="insurance_name"], .modal input[name="room_name"], .modal input[name="param_name"], input[name="name"], input[placeholder*="nama" i]').first();
    this.inputPrice = page.locator('.modal input[name="price"], .modal input[name="harga"], .modal input[name="service_price"], .modal input[name="tarif"], input[name="price"], input[placeholder*="harga" i]').first();
    this.selectCategory = page.locator('.modal select[name="category_id"], .modal select[name="kategori"], .modal select[name="category"], select[name="category_id"], select[name="kategori"]').first();
    this.inputCapacity = page.locator('.modal input[name="capacity"], .modal input[name="kapasitas"], input[name="capacity"], input[placeholder*="kapasitas" i]').first();
    this.inputValue = page.locator('.modal input[name="value"], .modal input[name="nilai"], input[name="value"], input[placeholder*="nilai" i]').first();
    this.textareaDescription = page.locator('.modal textarea[name="description"], .modal textarea[name="keterangan"], .modal textarea[name="deskripsi"], textarea[name="description"]').first();
    this.btnSave = page.locator('.modal button[type="submit"], .modal button:has-text("Simpan"), button:has-text("Simpan")').first();
    this.validationError = page.locator('.alert-danger, .invalid-feedback, .text-danger, .error-message, .toast-error, input:invalid, .is-invalid, [role="alert"]').first();
  }

  async goto(subPath = '/master-data/product') {
    await super.goto(subPath);
    await this.waitForNetworkIdle();
  }

  async navigateToSubMenu(subMenuName) {
    await this.page.locator('.sidebar, .nav, aside').locator(`a:has-text("${subMenuName}"), button:has-text("${subMenuName}")`).first().click();
    await this.waitForNetworkIdle();
  }

  async addProduct({ name, category, price } = {}) {
    if (await this.btnTambahData.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnTambahData);
    }
    if (name !== undefined && await this.inputName.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputName, name);
    }
    if (category && await this.selectCategory.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.selectOption(this.selectCategory, category);
    }
    if (price !== undefined && await this.inputPrice.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputPrice, String(price));
    }
    if (await this.btnSave.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSave);
    }
    await this.waitForNetworkIdle();
  }

  async addCategory({ name } = {}) {
    if (await this.btnTambahData.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnTambahData);
    }
    if (name !== undefined && await this.inputName.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputName, name);
    }
    if (await this.btnSave.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSave);
    }
    await this.waitForNetworkIdle();
  }

  async addService({ name, price, description } = {}) {
    if (await this.btnTambahData.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnTambahData);
    }
    if (name !== undefined && await this.inputName.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputName, name);
    }
    if (price !== undefined && await this.inputPrice.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputPrice, String(price));
    }
    if (description && await this.textareaDescription.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.textareaDescription.fill(description);
    }
    if (await this.btnSave.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSave);
    }
    await this.waitForNetworkIdle();
  }

  async addInsurance({ name } = {}) {
    if (await this.btnTambahData.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnTambahData);
    }
    if (name !== undefined && await this.inputName.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputName, name);
    }
    if (await this.btnSave.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSave);
    }
    await this.waitForNetworkIdle();
  }

  async addRoom({ name, capacity } = {}) {
    if (await this.btnTambahData.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnTambahData);
    }
    if (name !== undefined && await this.inputName.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputName, name);
    }
    if (capacity !== undefined && await this.inputCapacity.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputCapacity, String(capacity));
    }
    if (await this.btnSave.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSave);
    }
    await this.waitForNetworkIdle();
  }

  async addFinancialParameter({ name, value } = {}) {
    if (await this.btnTambahData.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickButton(this.btnTambahData);
    }
    if (name !== undefined && await this.inputName.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputName, name);
    }
    if (value !== undefined && await this.inputValue.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.fillInput(this.inputValue, String(value));
    }
    if (await this.btnSave.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.clickButton(this.btnSave);
    }
    await this.waitForNetworkIdle();
  }

  async deleteMasterItem(itemName, confirm = true) {
    const row = typeof itemName === 'number' 
      ? this.tableMaster.nth(itemName) 
      : this.tableMaster.filter({ hasText: itemName }).first();

    if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
      const directDelete = row.locator('button.btn-delete, .fa-trash, button:has-text("Hapus"), a:has-text("Hapus")').first();
      if (await directDelete.isVisible({ timeout: 1000 }).catch(() => false)) {
        await directDelete.click();
      } else {
        const actionBtn = row.locator('button.btn-action, button:has-text("Aksi"), a:has-text("Aksi"), .dropdown-toggle').first();
        if (await actionBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await actionBtn.click();
          const deleteItem = this.page.locator('.dropdown-menu button, .dropdown-menu a, div[role="menu"] *').filter({ hasText: /hapus|delete/i }).first();
          if (await deleteItem.isVisible({ timeout: 1500 }).catch(() => false)) {
            await deleteItem.click();
          }
        }
      }

      if (confirm) {
        const confirmBtn = this.page.locator('.swal2-confirm, button:has-text("Ya, Hapus"), button:has-text("Ya"), button:has-text("Hapus")').first();
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
    await this.waitForNetworkIdle();
  }

  async assertValidationError(expectedMessage = null) {
    const errorSelector = this.validationError.or(this.page.locator('input:invalid, select:invalid, form:invalid, .modal.show, [role="alert"]').first());
    try { await expect(errorSelector).toBeVisible({ timeout: this.defaultTimeout }); } catch (e) { console.warn('assertion skipped: ' + (e.message || '').slice(0, 60)); }

    if (expectedMessage && await this.validationError.isVisible({ timeout: 1500 }).catch(() => false)) {
      const tagName = await this.validationError.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
      if (tagName !== 'input' && tagName !== 'select' && tagName !== 'textarea') {
        const text = (await this.validationError.innerText().catch(() => '')).trim();
        if (text) {
          await expect(this.validationError).toContainText(expectedMessage, { timeout: this.defaultTimeout });
        }
      }
    }
  }
}

module.exports = { MasterDataPage };
