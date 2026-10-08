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

const login = async (email, password) => (await call('POST', '/api/admin/login', { body: { email, password } })).data.token;

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

async function handover(customer = { firstName: 'Marie', lastName: 'Durand', vin: 'VF1234567890ABCDE' }) {
  const { data: catalog } = await call('GET', '/api/catalog');
  const v114 = catalog.vehicles.find((v) => v.name === 'V114');
  const res = await call('POST', '/api/handover', { body: { dealershipCode: 'demo2026', vehicleId: v114.id, customer } });
  assert.equal(res.status, 200);
  return { ...res.data, v114 };
}

test('the Compagnon de bord catalogue and the Challenger V114 are loaded', async () => {
  const { data } = await call('GET', '/api/catalog');
  assert.deepEqual(data.brands.map((b) => b.name), ['Challenger', 'Randger']);
  const v114 = data.vehicles.find((v) => v.name === 'V114');
  assert.ok(v114 && v114.photoUrl, 'V114 with its photo');
  const admin = await login('admin@test.fr', 'motdepasse123');
  const diags = (await call('GET', '/api/admin/diagnostics', { token: admin })).data;
  assert.equal(diags.length, 56);
  assert.ok(diags.reduce((a, d) => a + d.leaves, 0) > 2000, 'about 2 000 end points');
  assert.equal((await call('GET', '/api/admin/equipment', { token: admin })).data.length, 122);

  // Content corrections from the simulations are applied
  const truma = (await call('GET', '/api/admin/diagnostics/g_truma', { token: admin })).data;
  const leaf = (function find(n) {
    if (Array.isArray(n.n)) for (const c of n.n) { const f = find(c); if (f) return f; }
    return n.cause && n.cause.startsWith('Des saletés gênent') ? n : null;
  })(truma.tree);
  assert.match(leaf.sec, /aérez/);
});

test('handover, app data, cloud save of the app storage and restore on another phone', async () => {
  const h = await handover();
  const { token } = h;
  assert.equal(h.vehicle.name, 'V114');
  assert.equal(h.dealership.name, 'Concession de démonstration');
  assert.deepEqual(h.state, {});

  // Data the app runs on
  const { data } = await call('GET', '/api/app/data', { token });
  assert.equal(data.equipment.length, 122);
  assert.equal(data.diagnostics.length, 56);
  assert.equal(data.vehicle.heroName, 'V114');
  assert.equal(data.vehicle.photos.length, 53);
  assert.ok(data.vehicle.photos.every((p) => p.url.startsWith('/uploads/')));
  assert.equal(data.dealer.name, 'Concession de démonstration');
  assert.ok(data.lists.arrivee.items.length > 0 && data.config.VARIANTS.frigo);
  assert.equal((await fetch(base + data.vehicle.photos[0].url)).status, 200);

  // The app saves its storage keys; photos are stored as files
  assert.equal((await call('PUT', '/api/me/state/cdb_own', { token, body: { value: '{"frigo":true}' } })).status, 200);
  const uph = await call('PUT', '/api/me/state/cdb_uph', { token, body: { value: JSON.stringify({ frigo: PNG }) } });
  const frigoUrl = JSON.parse(uph.data.value).frigo;
  assert.match(frigoUrl, /^\/uploads\/.+\.png$/);
  const cover = await call('PUT', '/api/me/state/cdb_photo', { token, body: { value: PNG } });
  assert.match(cover.data.value, /^\/uploads\//);
  assert.equal((await call('PUT', '/api/me/state/autre', { token, body: { value: 'x' } })).status, 400);

  // A URL that is not the customer's own is dropped (cannot take over someone else's file)
  const foreign = await call('PUT', '/api/me/state/cdb_uph', { token, body: { value: JSON.stringify({ frigo: frigoUrl, pompe: data.vehicle.photos[0].url }) } });
  assert.deepEqual(JSON.parse(foreign.data.value), { frigo: frigoUrl });
  assert.equal((await fetch(base + data.vehicle.photos[0].url)).status, 200);

  // Removing a photo deletes its file
  await call('PUT', '/api/me/state/cdb_uph', { token, body: { value: '{}' } });
  assert.equal((await fetch(base + frigoUrl)).status, 404);

  // No access code before the dealership validates the handover
  assert.equal((await call('POST', '/api/restore', { body: { lastName: 'Durand', code: 'V114-AAAA-BBBB' } })).status, 404);
  assert.equal((await call('POST', '/api/me/access-code', { token, body: { dealershipCode: 'FAUX1234' } })).status, 404);
  const access = await call('POST', '/api/me/access-code', { token, body: { dealershipCode: 'DEMO2026' } });
  assert.equal(access.status, 200);
  assert.match(access.data.code, /^V114-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  // Another phone: name + access code bring back everything
  const restored = await call('POST', '/api/restore', { body: { lastName: 'durand', code: access.data.code.toLowerCase() } });
  assert.equal(restored.status, 200);
  assert.equal(restored.data.state.cdb_own, '{"frigo":true}');
  assert.equal(restored.data.state.cdb_photo, cover.data.value);

  // Workshop request reaches the dealership, which answers
  const req = await call('POST', '/api/me/requests', { token, body: { title: 'Test d’étanchéité', message: 'Bonjour', period: '15 jours', phone: '0600000000' } });
  assert.equal(req.status, 200);
  const admin = await login('admin@test.fr', 'motdepasse123');
  const reports = (await call('GET', '/api/admin/reports', { token: admin })).data;
  const mine = reports.find((r) => r.id === req.data.id);
  assert.match(mine.description, /15 jours/);
  await call('PUT', `/api/admin/reports/${mine.id}`, { token: admin, body: { status: 'en_cours', dealerReply: 'Lundi 9 h' } });
  assert.equal((await call('GET', '/api/me/requests', { token })).data[0].dealerReply, 'Lundi 9 h');

  // Back-office sees the saved data
  const detail = (await call('GET', `/api/admin/customers/${h.customer.id}`, { token: admin })).data;
  assert.deepEqual(detail.equipmentOwned, ['Réfrigérateur à compression (sous la plaque de cuisson)']);
  assert.equal(detail.photos.length, 1);
  assert.ok(detail.accessExpiresAt);

  // Erasure removes data and files
  assert.equal((await call('DELETE', '/api/me', { token })).status, 200);
  assert.equal((await call('GET', '/api/me', { token: restored.data.token })).status, 401);
  assert.equal((await fetch(base + cover.data.value)).status, 404);
});

test('back-office edits the catalogue and the app receives it', async () => {
  const admin = await login('admin@test.fr', 'motdepasse123');
  const { token, v114 } = await handover({ lastName: 'Martin' });
  const v1 = (await call('GET', '/api/config')).data.contentVersion;

  // Diagnostic flowchart
  const d = (await call('GET', '/api/admin/diagnostics/h_frigo', { token: admin })).data;
  d.tree.t = 'Que constatez-vous sur votre frigo ?';
  assert.equal((await call('PUT', '/api/admin/diagnostics/h_frigo', { token: admin, body: { tree: d.tree } })).status, 200);
  const broken = { t: 'Question', o: ['Oui', 'Non'], n: [{ cause: 'x' }] };
  assert.equal((await call('PUT', '/api/admin/diagnostics/h_frigo', { token: admin, body: { tree: broken } })).status, 400);
  const created = await call('POST', '/api/admin/diagnostics', { token: admin, body: { label: 'Ma porte ferme mal', cat: 'ext' } });
  assert.equal(created.status, 200);

  // Equipment and lists
  assert.equal((await call('PUT', '/api/admin/equipment/frigo', { token: admin, body: { tip: 'Dégivrez-le chaque mois.' } })).status, 200);
  const lists = (await call('GET', '/api/admin/catalog/lists', { token: admin })).data.value;
  lists.arrivee.items.push('Cales rangées');
  assert.equal((await call('PUT', '/api/admin/catalog/lists', { token: admin, body: { value: lists } })).status, 200);

  // Vehicle profile and an equipment photo
  assert.equal((await call('PUT', `/api/admin/vehicles/${v114.id}/profile`, { token: admin, body: { model: { l: '6,36', h: 2.7 }, weights: { ptac: 3500 } } })).status, 200);
  const preset = (await call('GET', `/api/admin/vehicles/${v114.id}/profile`, { token: admin })).data.equipment;
  assert.ok(preset.length > 20, 'the V114 keeps the list of its V48 app');
  const chosen = await call('PUT', `/api/admin/vehicles/${v114.id}/profile`, { token: admin, body: { equipment: ['frigo', 'wc', 'inconnu', 'frigo'] } });
  assert.deepEqual(chosen.data.equipment, ['frigo', 'wc']);
  const photo = await call('PUT', `/api/admin/vehicles/${v114.id}/photos/frigo`, { token: admin, body: { image: PNG } });
  assert.match(photo.data.url, /^\/uploads\//);

  const { data } = await call('GET', '/api/app/data', { token });
  assert.ok(data.contentVersion > v1);
  assert.equal(data.diagnostics.find((x) => x.id === 'h_frigo').tree.t, 'Que constatez-vous sur votre frigo ?');
  assert.ok(data.diagnostics.some((x) => x.label === 'Ma porte ferme mal'));
  assert.equal(data.equipment.find((x) => x.id === 'frigo').tip, 'Dégivrez-le chaque mois.');
  assert.ok(data.lists.arrivee.items.includes('Cales rangées'));
  assert.deepEqual(data.vehicle.model, { l: 6.36, h: 2.7 });
  assert.equal(data.vehicle.photos.find((p) => p.id === 'frigo').url, photo.data.url);
  assert.deepEqual(data.vehicle.equipment, ['frigo', 'wc']);

  // Dealer accounts cannot change the catalogue
  await call('POST', '/api/admin/users', { token: admin, body: { email: 'vendeur@test.fr', password: 'vendeur1234', role: 'dealer', dealershipId: 1 } });
  const dealer = await login('vendeur@test.fr', 'vendeur1234');
  assert.equal((await call('PUT', '/api/admin/equipment/frigo', { token: dealer, body: { tip: 'x' } })).status, 403);
  assert.equal((await call('GET', '/api/admin/diagnostics', { token: dealer })).status, 200);
});

test('a dealer only sees its own customers', async () => {
  const admin = await login('admin@test.fr', 'motdepasse123');
  const other = await call('POST', '/api/admin/dealerships', { token: admin, body: { name: 'Autre', code: 'AUTRE01' } });
  await call('POST', '/api/admin/users', { token: admin, body: { email: 'autre@test.fr', password: 'autre12345', role: 'dealer', dealershipId: other.data.id } });
  const otherToken = await login('autre@test.fr', 'autre12345');
  const { customer } = await handover({ lastName: 'Bernard' });
  assert.equal((await call('GET', `/api/admin/customers/${customer.id}`, { token: otherToken })).status, 404);
  assert.equal((await call('GET', '/api/admin/customers', { token: otherToken })).data.length, 0);
});

test('static apps and versioned service worker are served', async () => {
  const appPage = await (await fetch(base + '/app/')).text();
  assert.match(appPage, /<meta name="viewport"/);
  assert.match(appPage, /compagnon\.js/);
  const sw = await (await fetch(base + '/app/sw.js')).text();
  assert.ok(!sw.includes('__APP_VERSION__'));
  assert.ok(sw.includes(app.config.appVersion));
  assert.equal((await fetch(base + '/admin/')).status, 200);
  assert.equal((await fetch(base + '/app/../server/app.js')).status, 404);
  assert.equal((await fetch(base + '/uploads/..%2F..%2Fpackage.json')).status, 404);
});

test('open access mode opens the back-office without a password', async () => {
  assert.equal((await call('GET', '/api/admin/me')).status, 401);
  const flag = path.join(dataDir, 'acces-libre');
  fs.writeFileSync(flag, '');
  const me = await call('GET', '/api/admin/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.openAccess, true);
  fs.rmSync(flag);
  assert.equal((await call('GET', '/api/admin/me')).status, 401);
});

test('a customer registered from the back-office gets a working access code and app link', async () => {
  const admin = await login('admin@test.fr', 'motdepasse123');
  const { data: catalog } = await call('GET', '/api/catalog');
  const v114 = catalog.vehicles.find((v) => v.name === 'V114');
  const dealership = (await call('GET', '/api/admin/dealerships', { token: admin })).data[0];
  assert.equal((await call('POST', '/api/admin/customers', { token: admin, body: { vehicleId: v114.id, dealershipId: dealership.id } })).status, 400);
  assert.equal((await call('POST', '/api/admin/customers', { token: admin, body: { vehicleId: v114.id, dealershipId: dealership.id, lastName: 'Bureau', sendEmail: true } })).status, 400);
  const res = await call('POST', '/api/admin/customers', {
    token: admin,
    body: { vehicleId: v114.id, dealershipId: dealership.id, firstName: 'Paul', lastName: 'Bureau', plate: 'AB-123-CD' },
  });
  assert.equal(res.status, 200);
  assert.match(res.data.accessCode, /^V114-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(res.data.dealershipName, dealership.name);
  // The code restores the account in the app
  const restored = await call('POST', '/api/restore', { body: { lastName: 'bureau', code: res.data.accessCode } });
  assert.equal(restored.status, 200);
  assert.equal(restored.data.customer.plate, 'AB-123-CD');
  // The link opens it once
  const token = new URL(res.data.appLink).searchParams.get('lien');
  assert.equal((await call('POST', '/api/link', { body: { token } })).status, 200);
  assert.equal((await call('POST', '/api/link', { body: { token } })).status, 410);
  // A new code replaces the old one
  const again = await call('POST', `/api/admin/customers/${res.data.id}/recovery-code`, { token: admin, body: {} });
  assert.equal((await call('POST', '/api/restore', { body: { lastName: 'Bureau', code: res.data.accessCode } })).status, 404);
  assert.equal((await call('POST', '/api/restore', { body: { lastName: 'Bureau', code: again.data.recoveryCode } })).status, 200);
});
