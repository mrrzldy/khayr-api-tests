# Khayr Dev Dental Clinic - Playwright E2E Automation Framework

Project ini berisi automated testing suite tingkat enterprise untuk **API** dan **UI Portal Khayr**. Seluruh test case dari Excel (680+ test cases) telah dimapping ke dalam arsitektur Page Object Model (POM) menggunakan Playwright.

---

## 📂 Struktur Folder Utama

- `tests/api/`: Berisi 5 file skenario API core journey (Onboarding, Master Data, Inventory, Patient & Appointment, Medical Record & Billing).
- `tests/ui/specs/`: Berisi skrip otomatisasi UI untuk masing-masing role (Superadmin, Dokter, Perawat, Resepsionis, Admin, Finance, Kasir, Khayr Admin).
- `tests/ui/pages/`: Berisi Page Object Model (POM) yang mengisolasi selector elemen DOM web.
- `playwright.config.js`: File konfigurasi utama Playwright (dituning untuk sequential execution).
- `.env`: File konfigurasi environment (URL API, URL Web, & MongoDB URI).

---

## 🚀 Cara Menjalankan Automation Test (Untuk QA)

### 1. Persiapan Awal (Prerequisites)
Pastikan Node.js telah terinstall. Buka terminal/CMD di folder `khayr-api-tests` lalu install semua dependencies:
```bash
npm install
npx playwright install
```

### 2. Konfigurasi Environment (`.env`)
Buka file `.env` di root folder. Pastikan URL target sudah benar:
- `BASE_URL`: URL API backend (e.g., `https://core.dev.khayr.id`)
- `MONGODB_URI`: String koneksi database untuk melakukan validasi asersi data langsung ke MongoDB.

---

### 3. Perintah Eksekusi (Running Tests)

- **Menjalankan Seluruh Test Suite (API & UI):**
  ```bash
  npx playwright test
  ```

- **Hanya Menjalankan API Tests (Core Journey):**
  ```bash
  npx playwright test tests/api/
  ```

- **Hanya Menjalankan UI Tests (Per Role):**
  ```bash
  npx playwright test tests/ui/specs/
  ```

- **Menjalankan 1 File Spesifik (Misal: Kasir):**
  ```bash
  npx playwright test tests/ui/specs/09_kasir.spec.js
  ```

- **Menjalankan Test dengan Mode Visual UI (Bisa ngelihat browser ngeklik sendiri secara langsung):**
  ```bash
  npx playwright test --ui
  ```

---

## 📊 Cara Melihat Laporan Hasil Test (Report)

Setelah menjalankan tes, Playwright secara otomatis membuat laporan HTML interaktif yang sangat detail.

1. **Untuk Membuka Report Secara Lokal:**
   ```bash
   npx playwright show-report
   ```
2. **Membaca Laporan:**
   - **Passed (Hijau):** Tes berhasil lolos verifikasi frontend & database.
   - **Failed (Merah):** Ada bug/error. Klik pada test case yang merah untuk melihat screenshot error, baris kode yang gagal, dan log respons API/halaman.
   - **Skipped (Abu-abu):** Tes dilewati (skenario opsional/belum aktif).

3. **PDF Report:**
   Untuk kenyamanan pamer ke manajemen, laporan ringkas berbentuk PDF selalu tersimpan di root folder dengan nama `playwright-report.pdf`.

---

## 🐛 Cara Melaporkan Bug ke Developer

Jika ada tes yang gagal (berwarna merah) pada API:
1. Klik nama tes yang gagal di halaman Report.
2. Salin bagian `Error Message` dan `Response Body` (biasanya memuat alasan error dari backend, seperti `"the roles field is required"`).
3. Serahkan detail error tersebut ke tim Backend Developer untuk diperbaiki.
