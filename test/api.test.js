'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server/app');

// 1x1 transparent PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

let app, base, dataDir;

async function call(method, url, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-test-'));
  app = createApp({ dataDir, secret: 'test-secret', adminEmail: 'admin@test.fr', adminPassword: 'motdepasse123', log: process.env.DEBUG ? console.log : () => {} });
  await new Promise((r) => app.server.listen(0, r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});

after(() => {
  app.server.closeAllConnections();
  app.server.close();
  app.db.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('seed provides Challenger and Randger with vehicles', async () => {
  const { status, data } = await call('GET', '/api/catalog');
  assert.equal(status, 200);
  assert.deepEqual(data.brands.map((b) => b.name), ['Challenger', 'Randger']);
  for (const brand of data.brands) assert.ok(data.vehicles.some((v) => v.brandId === brand.id));
});

test('unknown dealership code is rejected', async () => {
  const { status } = await call('GET', '/api/dealerships/code/NOPE1234');
  assert.equal(status, 404);
});

test('full flow: back-office content, handover, customer data, reports', async () => {
  // Back-office login
  const login = await call('POST', '/api/admin/login', { body: { email: 'admin@test.fr', password: 'motdepasse123' } });
  assert.equal(login.status, 200);
  const admin = login.data.token;
  assert.equal((await call('POST', '/api/admin/login', { body: { email: 'admin@test.fr', password: 'faux' } })).status, 401);

  // Admin creates a dealership and a vehicle with a photo
  const dealership = await call('POST', '/api/admin/dealerships', { token: admin, body: { name: 'Concession Test', code: 'test-77', city: 'Lyon', phone: '0400000000' } });
  assert.equal(dealership.status, 200);
  assert.equal(dealership.data.code, 'TEST77');

  const { data: brands } = await call('GET', '/api/admin/brands', { token: admin });
  const randger = brands.find((b) => b.name === 'Randger');
  const vehicle = await call('POST', '/api/admin/vehicles', {
    token: admin,
    body: { brandId: randger.id, name: 'Randger R560', modelYear: '2026', photo: PNG, specs: [{ label: 'Longueur', value: '5,99 m' }, { label: '', value: 'ignoré' }] },
  });
  assert.equal(vehicle.status, 200);
  assert.match(vehicle.data.photoUrl, /^\/uploads\/.+\.png$/);
  assert.deepEqual(vehicle.data.specs, [{ label: 'Longueur', value: '5,99 m' }]);
  const photoRes = await fetch(base + vehicle.data.photoUrl);
  assert.equal(photoRes.status, 200);

  // Problem specific to this vehicle + one for the other brand
  const specific = await call('POST', '/api/admin/problems', { token: admin, body: { title: 'Lanterneau R560 bloqué', category: 'Ouvrants', vehicleId: vehicle.data.id } });
  assert.equal(specific.status, 200);
  assert.equal(specific.data.brandId, randger.id);
  const challenger = brands.find((b) => b.name === 'Challenger');
  await call('POST', '/api/admin/problems', { token: admin, body: { title: 'Spécifique Challenger', brandId: challenger.id } });

  // Content version bumps with catalogue changes
  const cfg1 = await call('GET', '/api/config');

  // Handover in the app: dealership code -> brand -> vehicle -> customer
  const dealer = await call('GET', '/api/dealerships/code/test77');
  assert.equal(dealer.data.name, 'Concession Test');
  const handover = await call('POST', '/api/handover', {
    body: { dealershipCode: 'TEST77', vehicleId: vehicle.data.id, customer: { firstName: 'Marie', lastName: 'Durand', email: 'marie@exemple.fr', plate: 'AB-123-CD' } },
  });
  assert.equal(handover.status, 200);
  const { token, recoveryCode } = handover.data;
  assert.ok(token && recoveryCode);
  assert.equal(handover.data.vehicle.name, 'Randger R560');
  assert.equal(handover.data.dealership.name, 'Concession Test');
  const titles = handover.data.problems.map((p) => p.title);
  assert.ok(titles.includes('Lanterneau R560 bloqué'), 'vehicle-specific problem is shown');
  assert.ok(titles.includes("Pas d'eau aux robinets"), 'generic problem is shown');
  assert.ok(!titles.includes('Spécifique Challenger'), 'other brand problem is hidden');
  assert.equal(handover.data.customer.recoveryHash, undefined);

  // Customer data: cover photo, gallery photo (replace + caption), note
  const cover = await call('PATCH', '/api/me', { token, body: { coverPhoto: PNG, phone: '0600000000' } });
  assert.match(cover.data.customer.coverPhotoUrl, /^\/uploads\//);
  const photo = await call('POST', '/api/me/photos', { token, body: { image: PNG, caption: 'Fusibles' } });
  assert.equal(photo.data.caption, 'Fusibles');
  const replaced = await call('PATCH', `/api/me/photos/${photo.data.id}`, { token, body: { image: PNG, caption: 'Boîte à fusibles' } });
  assert.notEqual(replaced.data.url, photo.data.url);
  assert.equal((await fetch(base + photo.data.url)).status, 404, 'old file is removed');
  await call('PUT', `/api/me/notes/${specific.data.id}`, { token, body: { note: 'Graisser le joint' } });

  // Report sent to the dealership
  const report = await call('POST', '/api/me/reports', { token, body: { title: 'Fuite', description: 'Sous l’évier', photos: [PNG], problemId: specific.data.id } });
  assert.equal(report.status, 200);
  assert.equal(report.data.photos.length, 1);

  // Invalid image is rejected
  assert.equal((await call('POST', '/api/me/photos', { token, body: { image: 'data:image/png;base64,AAAA' } })).status, 400);

  // Data is restored on another phone with name + recovery code
  assert.equal((await call('POST', '/api/restore', { body: { lastName: 'Durand', recoveryCode: 'WRONG123' } })).status, 404);
  const restored = await call('POST', '/api/restore', { body: { lastName: 'durand', recoveryCode: recoveryCode.toLowerCase() } });
  assert.equal(restored.status, 200);
  assert.equal(restored.data.photos.length, 1);
  assert.equal(restored.data.notes[0].note, 'Graisser le joint');
  assert.equal(restored.data.customer.phone, '0600000000');

  // Dealer account only sees its own customers and can answer reports
  const userRes = await call('POST', '/api/admin/users', { token: admin, body: { email: 'vendeur@test.fr', password: 'vendeur1234', role: 'dealer', dealershipId: dealership.data.id } });
  assert.equal(userRes.status, 200);
  const dealerLogin = await call('POST', '/api/admin/login', { body: { email: 'vendeur@test.fr', password: 'vendeur1234' } });
  const dealerToken = dealerLogin.data.token;
  const customers = await call('GET', '/api/admin/customers', { token: dealerToken });
  assert.equal(customers.data.length, 1);
  assert.equal(customers.data[0].lastName, 'Durand');
  assert.equal((await call('POST', '/api/admin/vehicles', { token: dealerToken, body: { brandId: randger.id, name: 'X' } })).status, 403);

  const reports = await call('GET', '/api/admin/reports', { token: dealerToken });
  assert.equal(reports.data.length, 1);
  await call('PUT', `/api/admin/reports/${reports.data[0].id}`, { token: dealerToken, body: { status: 'en_cours', dealerReply: 'Passez lundi' } });
  const me = await call('GET', '/api/me', { token });
  assert.equal(me.data.reports[0].status, 'en_cours');
  assert.equal(me.data.reports[0].dealerReply, 'Passez lundi');

  // A dealer from another dealership cannot see this customer
  const other = await call('POST', '/api/admin/dealerships', { token: admin, body: { name: 'Autre' } });
  await call('POST', '/api/admin/users', { token: admin, body: { email: 'autre@test.fr', password: 'autre12345', role: 'dealer', dealershipId: other.data.id } });
  const otherToken = (await call('POST', '/api/admin/login', { body: { email: 'autre@test.fr', password: 'autre12345' } })).data.token;
  assert.equal((await call('GET', `/api/admin/customers/${customers.data[0].id}`, { token: otherToken })).status, 404);
  assert.equal((await call('GET', '/api/admin/reports', { token: otherToken })).data.length, 0);

  // Editing the vehicle in the back-office is visible in the app
  await call('PUT', `/api/admin/vehicles/${vehicle.data.id}`, { token: admin, body: { description: 'Nouvelle description' } });
  const cfg2 = await call('GET', '/api/config');
  assert.ok(cfg2.data.contentVersion > cfg1.data.contentVersion);
  assert.equal((await call('GET', '/api/me', { token })).data.vehicle.description, 'Nouvelle description');

  // Vehicle in use cannot be deleted
  assert.equal((await call('DELETE', `/api/admin/vehicles/${vehicle.data.id}`, { token: admin })).status, 409);

  // Change of vehicle requires a dealership code
  const { data: catalog } = await call('GET', '/api/catalog');
  const challengerVehicle = catalog.vehicles.find((v) => v.brandId === challenger.id);
  assert.equal((await call('PUT', '/api/me/vehicle', { token, body: { dealershipCode: 'BAD', vehicleId: challengerVehicle.id } })).status, 404);
  const changed = await call('PUT', '/api/me/vehicle', { token, body: { dealershipCode: 'TEST77', vehicleId: challengerVehicle.id } });
  assert.equal(changed.data.vehicle.brandName, 'Challenger');
  assert.ok(changed.data.problems.some((p) => p.title === 'Spécifique Challenger'));

  // Account deletion removes data and sessions
  assert.equal((await call('DELETE', '/api/me', { token })).status, 200);
  assert.equal((await call('GET', '/api/me', { token: restored.data.token })).status, 401);
});

test('static apps and versioned service worker are served', async () => {
  const appPage = await fetch(base + '/app/');
  assert.equal(appPage.status, 200);
  const sw = await (await fetch(base + '/app/sw.js')).text();
  assert.ok(!sw.includes('__APP_VERSION__'));
  assert.ok(sw.includes(app.config.appVersion));
  assert.equal((await fetch(base + '/admin/')).status, 200);
  assert.equal((await fetch(base + '/app/../server/app.js')).status, 404);
  assert.equal((await fetch(base + '/uploads/..%2F..%2Fpackage.json')).status, 404);
});
