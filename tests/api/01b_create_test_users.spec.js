const { test, expect } = require('./fixtures');
const fs = require('fs');

test.use({ baseURL: 'https://core.dev.khayr.id' });

let accessToken = '';
let organizationId = '';

test.beforeAll(async () => {
  const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
  accessToken = state.accessToken;
  organizationId = state.organizationId;
});

test.describe('Core Journey 1b: Create Test Users for All Roles', () => {

  const roles = [
    { name: 'Admin', roleKey: 'ADMIN', prefix: 'admin' },
    { name: 'Dokter', roleKey: 'DOCTOR', prefix: 'doctor' },
    { name: 'Resepsionis', roleKey: 'RECEPTIONIST', prefix: 'receptionist' },
    { name: 'Perawat', roleKey: 'NURSE', prefix: 'nurse' },
    { name: 'Finance', roleKey: 'FINANCE', prefix: 'finance' },
    { name: 'Kasir', roleKey: 'CASHIER', prefix: 'cashier' }
  ];

  for (const role of roles) {
    test(`Create User for ${role.name} Role`, async ({ request }) => {
      const uniqueSuffix = Date.now().toString().slice(-6);
      const email = `${role.prefix}_${uniqueSuffix}@clinic.com`;
      const phone = `+6281${Date.now().toString().slice(3)}`;
      
      const payload = {
        firstName: `Test`,
        lastName: role.name,
        email: email,
        msisdn: phone,
        password: "N91U9XOW",
        roles: [role.roleKey],
        organizationID: organizationId,
        birthDate: "1995-01-01",
        gender: "MALE"
      };

      const response = await request.post('https://core.dev.khayr.id/v1/user', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        data: payload
      });

      const body = await response.json();
      console.log(`Create User ${role.name} Response:`, body);
      expect(response.ok()).toBeTruthy();

      // Save to state
      const state = JSON.parse(fs.readFileSync('.state.json', 'utf8'));
      if (!state.credentials) state.credentials = {};
      state.credentials[role.roleKey] = {
        email: email,
        password: "N91U9XOW"
      };
      fs.writeFileSync('.state.json', JSON.stringify(state, null, 2));
    });
  }

});
