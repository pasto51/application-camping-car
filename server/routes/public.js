'use strict';

const { HttpError } = require('../http');
const { transaction, getSetting } = require('../db');
const { sha256, randomToken, randomCode, normalizeCode, createRateLimiter } = require('../auth');
const { camel, camelAll, optStr, reqStr, reqInt, optInt, optEmail, optDate, pick } = require('../util');

const MAX_REPORT_PHOTOS = 6;

function register(router) {
  const codeLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
  const restoreLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

  function findDealershipByCode(db, code, ip) {
    if (codeLimiter(ip)) throw new HttpError(429, 'Trop de tentatives, réessayez dans quelques minutes');
    const normalized = normalizeCode(code);
    if (!normalized) throw new HttpError(400, 'Code concession obligatoire');
    const row = db.prepare('SELECT id, name, city, phone, email FROM dealerships WHERE code = ? AND active = 1').get(normalized);
    if (!row) throw new HttpError(404, 'Code concession inconnu');
    return row;
  }

  function findActiveVehicle(db, vehicleId) {
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND active = 1').get(vehicleId);
    if (!vehicle) throw new HttpError(404, 'Véhicule introuvable');
    return vehicle;
  }

  function createSession(db, customerId) {
    const token = randomToken();
    db.prepare('INSERT INTO customer_sessions (token_hash, customer_id) VALUES (?, ?)').run(sha256(token), customerId);
    return token;
  }

  function requireCustomer(ctx) {
    const header = ctx.req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new HttpError(401, 'Session requise');
    const row = ctx.db
      .prepare('SELECT c.* FROM customer_sessions s JOIN customers c ON c.id = s.customer_id WHERE s.token_hash = ?')
      .get(sha256(token));
    if (!row) throw new HttpError(401, 'Session expirée, reconnectez-vous');
    ctx.tokenHash = sha256(token);
    return row;
  }

  function profile(db, customer) {
    const vehicle = db
      .prepare('SELECT v.*, b.name AS brand_name, b.logo_url AS brand_logo_url, b.color AS brand_color FROM vehicles v JOIN brands b ON b.id = v.brand_id WHERE v.id = ?')
      .get(customer.vehicle_id);
    const dealership = db.prepare('SELECT id, name, city, phone, email FROM dealerships WHERE id = ?').get(customer.dealership_id);
    const problems = db
      .prepare(
        `SELECT * FROM problems
         WHERE vehicle_id = ? OR (vehicle_id IS NULL AND (brand_id IS NULL OR brand_id = ?))
         ORDER BY category, sort, title`
      )
      .all(customer.vehicle_id, vehicle ? vehicle.brand_id : -1);
    const photos = db.prepare('SELECT id, url, caption, created_at FROM customer_photos WHERE customer_id = ? ORDER BY id DESC').all(customer.id);
    const notes = db.prepare('SELECT problem_id, note, updated_at FROM customer_notes WHERE customer_id = ?').all(customer.id);
    const reports = db.prepare('SELECT * FROM reports WHERE customer_id = ? ORDER BY id DESC').all(customer.id);
    const { recovery_hash, ...publicCustomer } = customer;
    return {
      contentVersion: Number(getSetting(db, 'content_version', '0')),
      announcement: getSetting(db, 'announcement', null),
      customer: camel(publicCustomer),
      vehicle: camel(vehicle),
      dealership: camel(dealership),
      problems: camelAll(problems),
      photos: camelAll(photos),
      notes: camelAll(notes),
      reports: camelAll(reports),
    };
  }

  function touchCustomer(db, id) {
    db.prepare("UPDATE customers SET updated_at = datetime('now') WHERE id = ?").run(id);
  }

  // ---- Public, no session ----

  router.get('/api/config', ({ db, config }) => ({
    appVersion: config.appVersion,
    contentVersion: Number(getSetting(db, 'content_version', '0')),
    announcement: getSetting(db, 'announcement', null),
  }));

  // Brands and active vehicles, used by the dealership during the handover.
  router.get('/api/catalog', ({ db }) => ({
    contentVersion: Number(getSetting(db, 'content_version', '0')),
    brands: camelAll(db.prepare('SELECT * FROM brands ORDER BY sort, name').all()),
    vehicles: camelAll(db.prepare('SELECT * FROM vehicles WHERE active = 1 ORDER BY sort, name').all()),
  }));

  router.get('/api/dealerships/code/:code', ({ db, params, ip }) => camel(findDealershipByCode(db, params.code, ip)));

  // Handover ("mise en main"): the dealership enters its code, picks brand + vehicle, fills in the customer.
  router.post('/api/handover', ({ db, body, ip }) => {
    const dealership = findDealershipByCode(db, body.dealershipCode, ip);
    const vehicleId = reqInt(body.vehicleId, 'Véhicule');
    findActiveVehicle(db, vehicleId);
    const c = body.customer || {};
    const firstName = optStr(c.firstName, 100);
    const lastName = reqStr(c.lastName, 'Nom du client', 100);
    const email = optEmail(c.email);
    const recoveryCode = randomCode(8);

    return transaction(db, () => {
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO customers (dealership_id, vehicle_id, first_name, last_name, email, phone, plate, vin, handover_date, recovery_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          dealership.id,
          vehicleId,
          firstName,
          lastName,
          email,
          optStr(c.phone, 40),
          optStr(c.plate, 20),
          optStr(c.vin, 40),
          optDate(c.handoverDate) || new Date().toISOString().slice(0, 10),
          sha256(recoveryCode)
        );
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(lastInsertRowid);
      const token = createSession(db, customer.id);
      return { token, recoveryCode, ...profile(db, customer) };
    });
  });

  // Restores the customer's data on a new phone with the recovery code given at handover.
  router.post('/api/restore', ({ db, body, ip }) => {
    if (restoreLimiter(ip)) throw new HttpError(429, 'Trop de tentatives, réessayez dans quelques minutes');
    const code = normalizeCode(body.recoveryCode);
    const lastName = reqStr(body.lastName, 'Nom', 100);
    if (!code) throw new HttpError(400, 'Code de récupération obligatoire');
    const customer = db
      .prepare('SELECT * FROM customers WHERE recovery_hash = ? AND lower(last_name) = lower(?)')
      .get(sha256(code), lastName);
    if (!customer) throw new HttpError(404, 'Aucun compte ne correspond à ce nom et ce code');
    const token = createSession(db, customer.id);
    return { token, ...profile(db, customer) };
  });

  // ---- Customer session ----

  router.get('/api/me', (ctx) => profile(ctx.db, requireCustomer(ctx)));

  router.patch('/api/me', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db, body, uploads } = ctx;
    const cover = uploads.resolveImage(body.coverPhoto, customer.cover_photo_url);
    db.prepare(
      `UPDATE customers SET first_name = ?, last_name = ?, email = ?, phone = ?, plate = ?, vin = ?, cover_photo_url = ?,
       updated_at = datetime('now') WHERE id = ?`
    ).run(
      pick(optStr(body.firstName, 100), customer.first_name),
      pick(body.lastName === undefined ? undefined : reqStr(body.lastName, 'Nom', 100), customer.last_name),
      pick(optEmail(body.email), customer.email),
      pick(optStr(body.phone, 40), customer.phone),
      pick(optStr(body.plate, 20), customer.plate),
      pick(optStr(body.vin, 40), customer.vin),
      cover,
      customer.id
    );
    return profile(db, db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id));
  });

  // Changing vehicle needs a dealership code, like the original handover.
  router.put('/api/me/vehicle', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db, body, ip } = ctx;
    const dealership = findDealershipByCode(db, body.dealershipCode, ip);
    const vehicleId = reqInt(body.vehicleId, 'Véhicule');
    findActiveVehicle(db, vehicleId);
    db.prepare("UPDATE customers SET vehicle_id = ?, dealership_id = ?, updated_at = datetime('now') WHERE id = ?").run(
      vehicleId,
      dealership.id,
      customer.id
    );
    return profile(db, db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id));
  });

  router.post('/api/me/photos', (ctx) => {
    const customer = requireCustomer(ctx);
    const url = ctx.uploads.saveDataUrl(ctx.body.image);
    const { lastInsertRowid } = ctx.db
      .prepare('INSERT INTO customer_photos (customer_id, url, caption) VALUES (?, ?, ?)')
      .run(customer.id, url, optStr(ctx.body.caption, 200));
    touchCustomer(ctx.db, customer.id);
    return camel(ctx.db.prepare('SELECT id, url, caption, created_at FROM customer_photos WHERE id = ?').get(lastInsertRowid));
  });

  router.patch('/api/me/photos/:id', (ctx) => {
    const customer = requireCustomer(ctx);
    const photo = ctx.db.prepare('SELECT * FROM customer_photos WHERE id = ? AND customer_id = ?').get(Number(ctx.params.id), customer.id);
    if (!photo) throw new HttpError(404, 'Photo introuvable');
    const url = ctx.body.image ? ctx.uploads.resolveImage(ctx.body.image, photo.url) : photo.url;
    ctx.db.prepare('UPDATE customer_photos SET url = ?, caption = ? WHERE id = ?').run(url, pick(optStr(ctx.body.caption, 200), photo.caption), photo.id);
    touchCustomer(ctx.db, customer.id);
    return camel(ctx.db.prepare('SELECT id, url, caption, created_at FROM customer_photos WHERE id = ?').get(photo.id));
  });

  router.delete('/api/me/photos/:id', (ctx) => {
    const customer = requireCustomer(ctx);
    const photo = ctx.db.prepare('SELECT * FROM customer_photos WHERE id = ? AND customer_id = ?').get(Number(ctx.params.id), customer.id);
    if (!photo) throw new HttpError(404, 'Photo introuvable');
    ctx.db.prepare('DELETE FROM customer_photos WHERE id = ?').run(photo.id);
    ctx.uploads.remove(photo.url);
    touchCustomer(ctx.db, customer.id);
    return { ok: true };
  });

  // Personal note attached to a troubleshooting sheet; an empty note deletes it.
  router.put('/api/me/notes/:problemId', (ctx) => {
    const customer = requireCustomer(ctx);
    const problemId = Number(ctx.params.problemId);
    if (!ctx.db.prepare('SELECT id FROM problems WHERE id = ?').get(problemId)) throw new HttpError(404, 'Fiche introuvable');
    const note = optStr(ctx.body.note, 2000);
    if (note) {
      ctx.db
        .prepare(
          `INSERT INTO customer_notes (customer_id, problem_id, note) VALUES (?, ?, ?)
           ON CONFLICT(customer_id, problem_id) DO UPDATE SET note = excluded.note, updated_at = datetime('now')`
        )
        .run(customer.id, problemId, note);
    } else {
      ctx.db.prepare('DELETE FROM customer_notes WHERE customer_id = ? AND problem_id = ?').run(customer.id, problemId);
    }
    touchCustomer(ctx.db, customer.id);
    return { ok: true, note: note || null };
  });

  // Problem report sent to the dealership, with optional photos.
  router.post('/api/me/reports', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db, body, uploads } = ctx;
    const title = reqStr(body.title, 'Titre', 150);
    const problemId = optInt(body.problemId) || null;
    if (problemId && !db.prepare('SELECT id FROM problems WHERE id = ?').get(problemId)) throw new HttpError(404, 'Fiche introuvable');
    const images = Array.isArray(body.photos) ? body.photos.slice(0, MAX_REPORT_PHOTOS) : [];
    const urls = images.map((img) => uploads.saveDataUrl(img));
    const { lastInsertRowid } = db
      .prepare('INSERT INTO reports (customer_id, problem_id, title, description, photos) VALUES (?, ?, ?, ?, ?)')
      .run(customer.id, problemId, title, optStr(body.description, 4000), JSON.stringify(urls));
    return camel(db.prepare('SELECT * FROM reports WHERE id = ?').get(lastInsertRowid));
  });

  router.post('/api/me/logout', (ctx) => {
    requireCustomer(ctx);
    ctx.db.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').run(ctx.tokenHash);
    return { ok: true };
  });

  // Right to erasure: removes the customer, their sessions, notes, reports and photo files.
  router.delete('/api/me', (ctx) => {
    const customer = requireCustomer(ctx);
    deleteCustomer(ctx.db, ctx.uploads, customer.id);
    return { ok: true };
  });
}

function deleteCustomer(db, uploads, customerId) {
  const customer = db.prepare('SELECT cover_photo_url FROM customers WHERE id = ?').get(customerId);
  if (!customer) return false;
  const files = [customer.cover_photo_url];
  for (const p of db.prepare('SELECT url FROM customer_photos WHERE customer_id = ?').all(customerId)) files.push(p.url);
  for (const r of db.prepare('SELECT photos FROM reports WHERE customer_id = ?').all(customerId)) files.push(...JSON.parse(r.photos || '[]'));
  db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
  files.forEach((f) => uploads.remove(f));
  return true;
}

module.exports = { register, deleteCustomer };
