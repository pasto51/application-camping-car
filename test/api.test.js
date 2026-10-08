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
  assert.equal((await call('GET', '/api/admin/equipment', { token: admin })).data.length, 188);

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
  assert.equal(data.equipment.length, 188);
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
    body: { vehicleId: v114.id, dealershipId: dealership.id, firstName: 'Paul', lastName: 'Bureau', cellNumber: 'CEL-1', plate: 'AB-123-CD' },
  });
  assert.equal(res.status, 200);
  assert.match(res.data.accessCode, /^V114-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(res.data.dealershipName, dealership.name);
  // The code restores the account in the app
  const restored = await call('POST', '/api/restore', { body: { lastName: 'bureau', code: res.data.accessCode } });
  assert.equal(restored.status, 200);
  assert.equal(restored.data.customer.cellNumber, 'CEL-1');
  assert.equal(restored.data.customer.plate, undefined, 'no number plate kept');
  // The link opens it once
  const token = new URL(res.data.appLink).searchParams.get('lien');
  assert.equal((await call('POST', '/api/link', { body: { token } })).status, 200);
  assert.equal((await call('POST', '/api/link', { body: { token } })).status, 410);
  // A new code replaces the old one
  const again = await call('POST', `/api/admin/customers/${res.data.id}/recovery-code`, { token: admin, body: {} });
  assert.equal((await call('POST', '/api/restore', { body: { lastName: 'Bureau', code: res.data.accessCode } })).status, 404);
  assert.equal((await call('POST', '/api/restore', { body: { lastName: 'Bureau', code: again.data.recoveryCode } })).status, 200);
});

test('vehicle type: plan, equipment of that type only, zone and name chosen for the vehicle', async () => {
  const admin = await login('admin@test.fr', 'motdepasse123');
  const brands = (await call('GET', '/api/admin/brands', { token: admin })).data;
  const v = (await call('POST', '/api/admin/vehicles', { token: admin, body: { brandId: brands[1].id, name: 'Profilé test' } })).data;
  assert.equal((await call('PUT', `/api/admin/vehicles/${v.id}/profile`, { token: admin, body: { type: 'bateau' } })).status, 400);
  await call('PUT', `/api/admin/vehicles/${v.id}/profile`, {
    token: admin,
    body: { type: 'profile', equipment: ['velos', 'garage'], labels: { velos: 'Porte-vélos 3 places', garage: '' }, spotOverrides: { velos: 'ext' } },
  });
  const p = (await call('GET', `/api/admin/vehicles/${v.id}/profile`, { token: admin })).data;
  assert.equal(p.plan.planUrl, '/app/plans/pr_central.svg');
  assert.ok(p.plan.spots.some((s) => s.id === 'gar'));
  assert.equal(p.defaultSpots.velos, 'arr');
  assert.equal(p.defaultSpots.bouteille, 'ext', 'gas locker outside on a coachbuilt');
  assert.deepEqual(p.labels, { velos: 'Porte-vélos 3 places' });

  const dealership = (await call('GET', '/api/admin/dealerships', { token: admin })).data[0];
  const c = (await call('POST', '/api/admin/customers', { token: admin, body: { vehicleId: v.id, dealershipId: dealership.id, lastName: 'Type' } })).data;
  const token = (await call('POST', '/api/restore', { body: { lastName: 'Type', code: c.accessCode } })).data.token;
  const { data } = await call('GET', '/api/app/data', { token });
  const eq = Object.fromEntries(data.equipment.map((q) => [q.id, q]));
  assert.equal(eq.velos.name, 'Porte-vélos 3 places');
  assert.equal(eq.velos.spot, 'ext');
  assert.equal(eq.garage.spot, 'gar');
  assert.equal(data.vehicle.planUrl, '/app/plans/pr_central.svg');
  assert.ok(data.config.HIDDEN_EQ.porte, 'no sliding side door on a profilé');
  assert.ok(!data.config.HIDDEN_EQ.porte_cell);
  const spotIds = new Set(data.vehicle.spots.map((s) => s.id));
  assert.ok(data.equipment.every((q) => !q.spot || spotIds.has(q.spot)), 'every zone exists on the plan');

  // The V114 keeps its own names after the catalogue went generic
  const { data: catalog } = await call('GET', '/api/catalog');
  const v114 = (await call('GET', `/api/admin/vehicles/${catalog.vehicles.find((x) => x.name === 'V114').id}/profile`, { token: admin })).data;
  assert.equal(v114.labels.lant, 'Lanterneau avant, 70 × 40 cm');
  const lant = (await call('GET', '/api/admin/equipment', { token: admin })).data.find((q) => q.id === 'lant');
  assert.equal(lant.name, 'Lanterneau du salon');
  // Types on an equipment
  assert.deepEqual((await call('PUT', '/api/admin/equipment/lant', { token: admin, body: { types: ['van', 'nope'] } })).data.types, ['van']);
});

test('a few words find the layout and the equipment they name', async () => {
  const admin = await login('admin@test.fr', 'motdepasse123');
  const r = (await call('POST', '/api/admin/layouts/match', { token: admin, body: { type: 'compact', text: 'penderie arrière, lit pavillon, cuisine et table' } })).data;
  assert.equal(r.results[0].id, 'cp_sdb_ar');
  assert.ok(r.results[0].matched.includes('penderie arrière'));
  assert.deepEqual(r.equipment.map((q) => q.id).sort(), ['evier', 'frigo', 'pavillon', 'penderie', 'rechaud', 'table'].sort());
  // The type can come from the words; « soute » of a fourgon
  assert.equal((await call('POST', '/api/admin/layouts/match', { token: admin, body: { text: 'capucine, lits superposés' } })).data.results[0].id, 'ca_superp');
  const fg = (await call('POST', '/api/admin/layouts/match', { token: admin, body: { type: 'fourgon', text: 'lits jumeaux, garage' } })).data;
  assert.equal(fg.results[0].id, 'fg_jumeaux');
  assert.ok(fg.equipment.some((q) => q.id === 'garage'), 'some fourgons have a garage (R635, V210)');
  assert.equal((await call('POST', '/api/admin/layouts/match', { token: admin, body: { type: 'fourgon', text: 'lit relevable, garage haut' } })).data.results[0].id, 'fg_relevable');
  assert.equal((await call('POST', '/api/admin/layouts/match', { token: admin, body: { text: 'capucine, salle d’eau au fond, couchettes superposées' } })).data.results[0].id, 'ca_superp_long');
  assert.equal((await call('POST', '/api/admin/layouts/match', { token: admin, body: { type: 'van', text: 'toit relevable, sans douche' } })).data.results[0].id, 'van_toit');
  // Choosing a layout sets the type and the plan
  const brands = (await call('GET', '/api/admin/brands', { token: admin })).data;
  const v = (await call('POST', '/api/admin/vehicles', { token: admin, body: { brandId: brands[0].id, name: 'Compact test' } })).data;
  assert.equal((await call('PUT', `/api/admin/vehicles/${v.id}/profile`, { token: admin, body: { layout: 'nope' } })).status, 400);
  await call('PUT', `/api/admin/vehicles/${v.id}/profile`, { token: admin, body: { layout: 'cp_sdb_ar', equipment: ['penderie'] } });
  const p = (await call('GET', `/api/admin/vehicles/${v.id}/profile`, { token: admin })).data;
  assert.equal(p.type, 'compact');
  assert.equal(p.plan.planUrl, '/app/plans/cp_sdb_ar.svg');
  assert.equal(p.defaultSpots.penderie, 'pend');
});

test('a catalogue model name finds its layout', async () => {
  const admin = await login('admin@test.fr', 'motdepasse123');
  const find = async (text, type) => (await call('POST', '/api/admin/layouts/match', { token: admin, body: { text, type } })).data;
  assert.equal((await find('Challenger V114M')).results[0].id, 'fg_superp');
  assert.equal((await find('Kilig 669', 'profile')).results[0].id, 'ca_central', 'the model wins over a wrong type');
  assert.equal((await find('Randger R635')).model.model, 'R635');
  assert.equal((await find('lit 140')).model, null);
});

test('brand and model noted for the vehicle are pre-filled in the app', async () => {
  const admin = await login('admin@test.fr', 'motdepasse123');
  const brands = (await call('GET', '/api/admin/brands', { token: admin })).data;
  const v = (await call('POST', '/api/admin/vehicles', { token: admin, body: { brandId: brands[0].id, name: 'Modèles test' } })).data;
  await call('PUT', `/api/admin/vehicles/${v.id}/profile`, { token: admin, body: { models: { trumac: 'Truma Combi 4', wc: 'Thetford C223', vide: '  ' } } });
  const dealership = (await call('GET', '/api/admin/dealerships', { token: admin })).data[0];
  const c = (await call('POST', '/api/admin/customers', { token: admin, body: { vehicleId: v.id, dealershipId: dealership.id, lastName: 'Modele' } })).data;
  const token = (await call('POST', '/api/restore', { body: { lastName: 'Modele', code: c.accessCode } })).data.token;
  const { data } = await call('GET', '/api/app/data', { token });
  assert.deepEqual(data.vehicle.models, { trumac: 'Truma Combi 4', wc: 'Thetford C223' });
});

test('the access code can be read again by the dealership and the customer, and resent', async () => {
  const admin = await login('admin@test.fr', 'motdepasse123');
  const { data: catalog } = await call('GET', '/api/catalog');
  const v114 = catalog.vehicles.find((v) => v.name === 'V114');
  const dealership = (await call('GET', '/api/admin/dealerships', { token: admin })).data[0];
  const c = (await call('POST', '/api/admin/customers', { token: admin, body: { vehicleId: v114.id, dealershipId: dealership.id, lastName: 'Relire' } })).data;
  assert.equal((await call('GET', `/api/admin/customers/${c.id}`, { token: admin })).data.accessCode, c.accessCode);
  const row = app.db.prepare('SELECT access_code_enc FROM customers WHERE id = ?').get(c.id);
  assert.ok(row.access_code_enc && !row.access_code_enc.includes(c.accessCode.slice(-4)), 'stored encrypted');
  const again = (await call('POST', `/api/admin/customers/${c.id}/resend`, { token: admin, body: {} })).data;
  assert.equal(again.accessCode, c.accessCode, 'same code, not a new one');
  const token = (await call('POST', '/api/link', { body: { token: new URL(again.appLink).searchParams.get('lien') } })).data.token;
  assert.equal((await call('GET', '/api/me/access', { token })).data.accessCode, c.accessCode);
  // A new code replaces it everywhere
  const fresh = (await call('POST', `/api/admin/customers/${c.id}/recovery-code`, { token: admin, body: {} })).data;
  assert.equal((await call('GET', `/api/admin/customers/${c.id}`, { token: admin })).data.accessCode, fresh.recoveryCode);
});

test('roles: salespeople see the dealership but manage their own customers; the manager reassigns', async () => {
  const admin = await login('admin@test.fr', 'motdepasse123');
  const d = (await call('POST', '/api/admin/dealerships', { token: admin, body: { name: 'Équipe', code: 'EQUIPE01' } })).data;
  const mk = async (email, role, token = admin) => (await call('POST', '/api/admin/users', { token, body: { email, name: email.split('@')[0], password: 'motdepasse1', role, dealershipId: d.id } })).data;
  await mk('chef@equipe.fr', 'dealer'); // old role name: becomes a manager
  const chef = await login('chef@equipe.fr', 'motdepasse1');
  assert.equal((await call('GET', '/api/admin/me', { token: chef })).data.role, 'manager');
  const s1 = await mk('alice@equipe.fr', 'sales', chef);
  const s2 = await mk('bruno@equipe.fr', 'sales', chef);
  assert.equal((await call('POST', '/api/admin/users', { token: chef, body: { email: 'pirate@equipe.fr', password: 'motdepasse1', role: 'admin' } })).status, 403);
  assert.ok((await call('GET', '/api/admin/users', { token: chef })).data.every((u) => u.dealershipId === d.id), 'a manager sees only their team');
  const alice = await login('alice@equipe.fr', 'motdepasse1');
  const bruno = await login('bruno@equipe.fr', 'motdepasse1');
  assert.equal((await call('GET', '/api/admin/users', { token: alice })).status, 403);

  const { data: catalog } = await call('GET', '/api/catalog');
  const c = (await call('POST', '/api/admin/customers', { token: alice, body: { vehicleId: catalog.vehicles[0].id, lastName: 'DeAlice', salespersonId: s2.id } })).data;
  assert.equal(c.salespersonId, s1.id, 'a salesperson registers their own customers');
  // Bruno sees the customer but cannot manage it
  const seen = (await call('GET', '/api/admin/customers', { token: bruno })).data.find((x) => x.id === c.id);
  assert.equal(seen.canManage, false);
  assert.equal((await call('GET', `/api/admin/customers/${c.id}`, { token: bruno })).data.accessCode, null);
  assert.equal((await call('PUT', `/api/admin/customers/${c.id}`, { token: bruno, body: { phone: '06' } })).status, 403);
  assert.equal((await call('POST', `/api/admin/customers/${c.id}/resend`, { token: bruno, body: {} })).status, 403);
  assert.equal((await call('PUT', `/api/admin/customers/${c.id}`, { token: alice, body: { salespersonId: s2.id } })).status, 403, 'only the manager reassigns');
  assert.equal((await call('GET', '/api/admin/customers?mine=1', { token: bruno })).data.length, 0);
  // The customer's request: Bruno cannot answer it
  // (a session through the handover: the restore endpoint is rate-limited and other tests already use it)
  const ctoken = (await call('POST', '/api/handover', { body: { dealershipCode: 'EQUIPE01', vehicleId: catalog.vehicles[0].id, salespersonId: s1.id, customer: { lastName: 'Client2' } } })).data.token;
  const req = (await call('POST', '/api/me/requests', { token: ctoken, body: { title: 'Fuite', message: 'Ça goutte' } })).data;
  // Requests are handled by the SAV and the store, not by salespeople
  assert.equal((await call('GET', '/api/admin/reports', { token: alice })).status, 403);
  assert.equal((await call('PUT', `/api/admin/reports/${req.id}`, { token: alice, body: { status: 'en_cours', message: 'Bonjour' } })).status, 404);
  await mk('sav@equipe.fr', 'sav', chef);
  const sav = await login('sav@equipe.fr', 'motdepasse1');
  assert.equal((await call('PUT', `/api/admin/reports/${req.id}`, { token: sav, body: { status: 'en_cours', message: 'Bonjour' } })).status, 200);
  // Alice's dashboard recap
  const stats = (await call('GET', '/api/admin/stats', { token: alice })).data;
  assert.equal(stats.mine.customers, 2);
  assert.equal(stats.mine.recentReports[0].title, 'Fuite');
  // The manager hands the customer to Bruno, then all of Bruno's customers back to Alice
  assert.equal((await call('PUT', `/api/admin/customers/${c.id}`, { token: chef, body: { salespersonId: s2.id } })).status, 200);
  assert.equal((await call('PUT', `/api/admin/customers/${c.id}`, { token: bruno, body: { phone: '0600000000' } })).status, 200);
  assert.equal((await call('DELETE', `/api/admin/users/${s2.id}`, { token: chef })).status, 409, 'transfer before deleting');
  assert.equal((await call('POST', `/api/admin/users/${s2.id}/transfer`, { token: chef, body: { toUserId: s1.id } })).data.moved, 1);
  // Handover in the app with a chosen advisor
  const dc = (await call('GET', '/api/dealerships/code/EQUIPE01')).data;
  assert.deepEqual(dc.salespeople.map((p) => p.name).sort(), ['alice', 'bruno', 'chef']);
  const h = (await call('POST', '/api/handover', { body: { dealershipCode: 'EQUIPE01', vehicleId: catalog.vehicles[0].id, salespersonId: s2.id, customer: { lastName: 'Main' } } })).data;
  assert.equal(h.customer.salespersonId, s2.id);
  // Detached store: its requests are its own, the dealership does not see them
  await call('PUT', `/api/admin/dealerships/${d.id}`, { token: chef, body: { storeDetached: true, storePhone: '05 00 00 00 00' } });
  await mk('mag@equipe.fr', 'store', chef);
  const mag = await login('mag@equipe.fr', 'motdepasse1');
  const acc = (await call('POST', '/api/me/parts', { token: h.token, body: { need: 'accessoire', equipmentName: 'Auvent' } })).data;
  assert.equal(acc.service, 'magasin');
  assert.ok((await call('GET', '/api/admin/reports', { token: mag })).data.some((r) => r.id === acc.id));
  assert.ok(!(await call('GET', '/api/admin/reports', { token: mag })).data.some((r) => r.id === req.id), 'a detached store sees only its requests');
  assert.ok(!(await call('GET', '/api/admin/reports', { token: chef })).data.some((r) => r.id === acc.id), 'the dealership does not see them');
  assert.equal((await call('PUT', `/api/admin/reports/${acc.id}`, { token: sav, body: { message: 'x' } })).status, 404);
  assert.equal((await call('PUT', `/api/admin/reports/${acc.id}`, { token: mag, body: { status: 'en_cours', message: 'On a ça en stock' } })).status, 200);
  const app2 = (await call('GET', '/api/app/data', { token: h.token })).data;
  assert.equal(app2.dealer.store.phone, '05 00 00 00 00');
});

test('content editor: edits the app contents, not the customers, the requests or the accounts', async () => {
  const admin = await login('admin@test.fr', 'motdepasse123');
  const d = (await call('POST', '/api/admin/dealerships', { token: admin, body: { name: 'Édition', code: 'EDITION1' } })).data;
  const ed = (await call('POST', '/api/admin/users', { token: admin, body: { email: 'edit@test.fr', password: 'motdepasse1', role: 'editor', dealershipId: d.id } })).data;
  assert.equal(ed.dealershipId, null, 'not tied to a dealership');
  const editor = await login('edit@test.fr', 'motdepasse1');
  assert.equal((await call('PUT', '/api/admin/equipment/frigo', { token: editor, body: { tip: 'Dégivrez-le.' } })).status, 200);
  assert.equal((await call('PUT', '/api/admin/settings', { token: editor, body: { announcement: 'Campagne gaz' } })).data.announcement, 'Campagne gaz');
  assert.equal((await call('PUT', '/api/admin/settings', { token: editor, body: { mail: { host: 'x' } } })).status, 403);
  assert.equal((await call('POST', '/api/admin/users', { token: editor, body: { email: 'x@test.fr', password: 'motdepasse1', role: 'sales', dealershipId: d.id } })).status, 403);
  assert.deepEqual((await call('GET', '/api/admin/customers', { token: editor })).data, []);
  assert.equal((await call('GET', '/api/admin/reports', { token: editor })).data.length, 0);
  const { data: catalog } = await call('GET', '/api/catalog');
  assert.equal((await call('POST', '/api/admin/customers', { token: editor, body: { vehicleId: catalog.vehicles[0].id, lastName: 'X' } })).status, 400);
  assert.equal((await call('DELETE', `/api/admin/vehicles/${catalog.vehicles[0].id}`, { token: editor })).status, 403);
  // A manager cannot create or touch an editor account
  await call('POST', '/api/admin/users', { token: admin, body: { email: 'chef@edition.fr', password: 'motdepasse1', role: 'manager', dealershipId: d.id } });
  const chef = await login('chef@edition.fr', 'motdepasse1');
  assert.equal((await call('POST', '/api/admin/users', { token: chef, body: { email: 'y@test.fr', password: 'motdepasse1', role: 'editor' } })).status, 403);
  assert.equal((await call('DELETE', `/api/admin/users/${ed.id}`, { token: chef })).status, 404);
  assert.equal((await call('PUT', '/api/admin/equipment/frigo', { token: chef, body: { tip: 'x' } })).status, 403);
  // The relevé (equipment and photos of a model) is for the administrator and the content editor only
  const vid = catalog.vehicles[0].id;
  for (const token of [chef]) {
    assert.equal((await call('POST', '/api/admin/vehicles', { token, body: { brandId: 1, name: 'X' } })).status, 403);
    assert.equal((await call('PUT', `/api/admin/vehicles/${vid}/profile`, { token, body: { equipment: [] } })).status, 403);
    assert.equal((await call('PUT', `/api/admin/vehicles/${vid}/photos/frigo`, { token, body: { image: null } })).status, 403);
    assert.equal((await call('POST', '/api/admin/layouts/match', { token, body: { text: 'lit central' } })).status, 403);
  }
  assert.equal((await call('PUT', `/api/admin/vehicles/${vid}/profile`, { token: editor, body: { equipment: ['frigo'] } })).status, 200);
  assert.equal((await call('POST', '/api/admin/layouts/match', { token: editor, body: { text: 'lit central' } })).status, 200);
  // The manager and the salesperson fix the warranty from the back-office
  const s = (await call('POST', '/api/admin/users', { token: chef, body: { email: 'vend@edition.fr', password: 'motdepasse1', role: 'sales' } })).data;
  const sales = await login('vend@edition.fr', 'motdepasse1');
  const c = (await call('POST', '/api/admin/customers', { token: sales, body: { vehicleId: catalog.vehicles[0].id, lastName: 'Garanti', handoverDate: '2026-01-10' } })).data;
  assert.equal(c.salespersonId, s.id);
  const w = (await call('PUT', `/api/admin/customers/${c.id}`, { token: sales, body: { warrantyEnd: '2029-01-10', warrantyExtEnd: '2031-01-10' } })).data;
  assert.equal(w.warrantyEnd, '2029-01-10');
  assert.equal((await call('GET', `/api/admin/customers/${c.id}`, { token: chef })).data.warranty.until, '2031-01-10');
  assert.equal((await call('PUT', `/api/admin/customers/${c.id}`, { token: chef, body: { warrantyEnd: '', warrantyExtEnd: '' } })).status, 200);
  assert.equal((await call('GET', `/api/admin/customers/${c.id}`, { token: chef })).data.warrantyExtEnd, null);
});

test('« rester connecté » gives a 15-day session, otherwise 12 hours', async () => {
  const exp = (t) => JSON.parse(Buffer.from(t.split('.')[0], 'base64url').toString()).exp - Date.now() / 1000;
  const long = (await call('POST', '/api/admin/login', { body: { email: 'admin@test.fr', password: 'motdepasse123', remember: true } })).data.token;
  const short = (await call('POST', '/api/admin/login', { body: { email: 'admin@test.fr', password: 'motdepasse123' } })).data.token;
  assert.ok(exp(long) > 14 * 86400 && exp(long) <= 15 * 86400);
  assert.ok(exp(short) <= 12 * 3600);
});
