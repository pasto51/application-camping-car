'use strict';

const { HttpError } = require('../http');
const { transaction, getSetting } = require('../db');
const { sha256, randomToken, randomCode, normalizeCode, createRateLimiter } = require('../auth');
const { appData, readProfile } = require('../catalog');
const { camel, camelAll, optStr, reqStr, reqInt, optEmail, optDate } = require('../util');

// Storage keys of the Compagnon de bord app that are saved in the cloud.
const STATE_KEYS = new Set(['cdb_own', 'cdb_ueq', 'cdb_uph', 'cdb_var', 'cdb_mod', 'cdb_dim', 'cdb_wt', 'cdb_photo', 'cdb_hand']);
const PHOTO_KEYS = new Set(['cdb_uph', 'cdb_photo']);
const MAX_STATE_BYTES = 30 * 1024 * 1024;
const ACCESS_YEARS = 2;

// Access codes look like "V114-ABCD-EFGH"; only the 8 random characters are checked.
function codeCore(code) {
  return normalizeCode(code).slice(-8);
}

function formatAccessCode(prefix, core) {
  return `${normalizeCode(prefix) || 'CDB'}-${core.slice(0, 4)}-${core.slice(4)}`;
}

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
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ? AND active = 1').get(vehicleId);
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
    if (!row) throw new HttpError(401, 'Session expirée, utilisez votre code d’accès');
    ctx.tokenHash = sha256(token);
    return row;
  }

  function readState(db, customerId) {
    const out = {};
    for (const r of db.prepare('SELECT key, value FROM customer_state WHERE customer_id = ?').all(customerId)) out[r.key] = r.value;
    return out;
  }

  // Profile + saved state: what the app needs on this phone.
  function session(db, customer) {
    const vehicle = db
      .prepare('SELECT v.id, v.name, v.model_year, b.name AS brand_name FROM vehicles v JOIN brands b ON b.id = v.brand_id WHERE v.id = ?')
      .get(customer.vehicle_id);
    const dealership = db.prepare('SELECT id, name, city, phone, email FROM dealerships WHERE id = ?').get(customer.dealership_id);
    const { recovery_hash, ...publicCustomer } = customer;
    return {
      contentVersion: Number(getSetting(db, 'content_version', '0')),
      customer: camel(publicCustomer),
      vehicle: camel(vehicle),
      dealership: camel(dealership),
      state: readState(db, customer.id),
    };
  }

  // Photos arrive as data URLs inside the app's storage: they are stored as files and replaced by their URL.
  function storePhotos(uploads, key, value, previous) {
    const urlsOf = (v) => {
      if (v == null) return [];
      if (key === 'cdb_photo') return [v];
      const obj = JSON.parse(v || '{}');
      return Object.values(obj && typeof obj === 'object' ? obj : {});
    };
    // A photo URL is accepted only if it was already this customer's: nobody can claim (and later delete) another file.
    const owned = new Set(urlsOf(previous));
    const resolve = (v) => {
      if (typeof v !== 'string') return null;
      if (v.startsWith('data:')) return uploads.saveDataUrl(v);
      return owned.has(v) ? v : null;
    };
    let next = value;
    if (key === 'cdb_photo') {
      next = value == null ? null : resolve(value);
    } else if (value != null) {
      let obj;
      try {
        obj = JSON.parse(value);
      } catch {
        throw new HttpError(400, 'Données invalides');
      }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new HttpError(400, 'Données invalides');
      for (const [id, v] of Object.entries(obj)) {
        const url = resolve(v);
        if (url) obj[id] = url;
        else delete obj[id];
      }
      next = JSON.stringify(obj);
    }
    const kept = new Set(urlsOf(next));
    for (const url of urlsOf(previous)) if (!kept.has(url)) uploads.remove(url);
    return next;
  }

  // ---- Public, no session ----

  router.get('/api/config', ({ db, config }) => ({
    appVersion: config.appVersion,
    contentVersion: Number(getSetting(db, 'content_version', '0')),
  }));

  // Brands and active vehicles, for the dealership during the handover.
  router.get('/api/catalog', ({ db }) => ({
    brands: camelAll(db.prepare('SELECT id, name, logo_url, color FROM brands ORDER BY sort, name').all()),
    vehicles: camelAll(db.prepare('SELECT id, brand_id, name, model_year, photo_url FROM vehicles WHERE active = 1 ORDER BY sort, name').all()),
  }));

  router.get('/api/dealerships/code/:code', ({ db, params, ip }) => camel(findDealershipByCode(db, params.code, ip)));

  // Handover ("mise en main"): the dealership enters its code, picks brand + vehicle, fills in the customer.
  router.post('/api/handover', ({ db, body, ip }) => {
    const dealership = findDealershipByCode(db, body.dealershipCode, ip);
    const vehicleId = reqInt(body.vehicleId, 'Véhicule');
    findActiveVehicle(db, vehicleId);
    const c = body.customer || {};
    const lastName = reqStr(c.lastName, 'Nom du client', 100);
    return transaction(db, () => {
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO customers (dealership_id, vehicle_id, first_name, last_name, email, phone, plate, vin, handover_date, recovery_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          dealership.id,
          vehicleId,
          optStr(c.firstName, 100),
          lastName,
          optEmail(c.email),
          optStr(c.phone, 40),
          optStr(c.plate, 20),
          optStr(c.vin, 40),
          optDate(c.handoverDate) || new Date().toISOString().slice(0, 10),
          // No usable code until the dealership validates the handover in the app.
          sha256(randomToken())
        );
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(lastInsertRowid);
      return { token: createSession(db, customer.id), ...session(db, customer) };
    });
  });

  // Restores the customer's data on another phone with their name and access code.
  router.post('/api/restore', ({ db, body, ip }) => {
    if (restoreLimiter(ip)) throw new HttpError(429, 'Trop de tentatives, réessayez dans quelques minutes');
    const core = codeCore(body.code);
    const lastName = reqStr(body.lastName, 'Nom', 100);
    if (core.length !== 8) throw new HttpError(400, 'Code d’accès incomplet');
    const customer = db.prepare('SELECT * FROM customers WHERE recovery_hash = ? AND lower(last_name) = lower(?)').get(sha256(core), lastName);
    if (!customer) throw new HttpError(404, 'Aucun compte ne correspond à ce nom et ce code');
    return { token: createSession(db, customer.id), ...session(db, customer) };
  });

  // ---- Customer session ----

  router.get('/api/me', (ctx) => session(ctx.db, requireCustomer(ctx)));

  // Catalogue + vehicle profile + dealership: the data the app runs on.
  router.get('/api/app/data', (ctx) => {
    const customer = requireCustomer(ctx);
    return {
      contentVersion: Number(getSetting(ctx.db, 'content_version', '0')),
      announcement: getSetting(ctx.db, 'announcement', null),
      ...appData(ctx.db, { vehicleId: customer.vehicle_id, dealershipId: customer.dealership_id }),
    };
  });

  // Saves one storage key of the app; returns the stored value (photos replaced by their URL).
  router.put('/api/me/state/:key', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db, params, body, uploads } = ctx;
    if (!STATE_KEYS.has(params.key)) throw new HttpError(400, 'Donnée inconnue');
    const value = body.value == null ? null : String(body.value);
    if (value && value.length > MAX_STATE_BYTES) throw new HttpError(413, 'Données trop volumineuses');
    const previous = db.prepare('SELECT value FROM customer_state WHERE customer_id = ? AND key = ?').get(customer.id, params.key)?.value ?? null;
    const stored = PHOTO_KEYS.has(params.key) ? storePhotos(uploads, params.key, value, previous) : value;
    if (stored == null) {
      db.prepare('DELETE FROM customer_state WHERE customer_id = ? AND key = ?').run(customer.id, params.key);
    } else {
      db.prepare(
        `INSERT INTO customer_state (customer_id, key, value) VALUES (?, ?, ?)
         ON CONFLICT(customer_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).run(customer.id, params.key, stored);
    }
    db.prepare("UPDATE customers SET updated_at = datetime('now') WHERE id = ?").run(customer.id);
    return { key: params.key, value: stored };
  });

  // End of the handover checklist: the dealership confirms with its code, the customer receives their access code.
  router.post('/api/me/access-code', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db, body, ip } = ctx;
    const dealership = findDealershipByCode(db, body.dealershipCode, ip);
    if (dealership.id !== customer.dealership_id) throw new HttpError(403, 'Ce code ne correspond pas à la concession de ce client');
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(customer.vehicle_id);
    const core = randomCode(8);
    const now = new Date();
    const expires = new Date(now);
    expires.setFullYear(expires.getFullYear() + ACCESS_YEARS);
    db.prepare(
      `UPDATE customers SET recovery_hash = ?, access_code_at = ?, access_expires_at = ?, first_name = COALESCE(?, first_name), vin = COALESCE(?, vin),
       updated_at = datetime('now') WHERE id = ?`
    ).run(sha256(core), now.toISOString(), expires.toISOString(), optStr(body.firstName, 100), optStr(body.vin, 40), customer.id);
    return {
      code: formatAccessCode(vehicle ? readProfile(vehicle).codePrefix : 'CDB', core),
      date: now.toLocaleDateString('fr-FR'),
      expiresAt: expires.toISOString().slice(0, 10),
    };
  });

  function requestsOf(db, customerId) {
    const reports = camelAll(db.prepare('SELECT * FROM reports WHERE customer_id = ? ORDER BY updated_at DESC, id DESC').all(customerId));
    const msgs = db
      .prepare('SELECT m.* FROM report_messages m JOIN reports r ON r.id = m.report_id WHERE r.customer_id = ? ORDER BY m.id')
      .all(customerId);
    for (const r of reports) r.messages = camelAll(msgs.filter((m) => m.report_id === r.id));
    return reports;
  }

  // Workshop appointment request or problem, sent to the dealership (which is told by e-mail).
  router.post('/api/me/requests', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db, body } = ctx;
    const title = reqStr(body.title, 'Motif', 150);
    const parts = [optStr(body.message, 4000), body.period ? `Délai souhaité : ${optStr(body.period, 50)}` : null, body.phone ? `Téléphone : ${optStr(body.phone, 40)}` : null];
    const description = parts.filter(Boolean).join('\n\n');
    const { lastInsertRowid } = db.prepare('INSERT INTO reports (customer_id, title, description) VALUES (?, ?, ?)').run(customer.id, title, description);
    if (body.phone && !customer.phone) db.prepare('UPDATE customers SET phone = ? WHERE id = ?').run(optStr(body.phone, 40), customer.id);
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(lastInsertRowid);
    const fresh = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
    ctx.notify.customerWrote({ report, customer: fresh, text: description, origin: ctx.origin, isNew: true }).catch(() => {});
    return { ...camel(report), messages: [] };
  });

  router.get('/api/me/requests', (ctx) => requestsOf(ctx.db, requireCustomer(ctx).id));

  // The customer answers in the conversation of one of their requests.
  router.post('/api/me/requests/:id/messages', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db } = ctx;
    const report = db.prepare('SELECT * FROM reports WHERE id = ? AND customer_id = ?').get(Number(ctx.params.id), customer.id);
    if (!report) throw new HttpError(404, 'Demande introuvable');
    const text = reqStr(ctx.body.body, 'Message', 4000);
    db.prepare("INSERT INTO report_messages (report_id, author, body) VALUES (?, 'client', ?)").run(report.id, text);
    // A new message from the customer puts the request back on the dealership's to-do list.
    db.prepare("UPDATE reports SET status = CASE WHEN status = 'resolu' THEN 'nouveau' ELSE status END, updated_at = datetime('now') WHERE id = ?").run(report.id);
    ctx.notify.customerWrote({ report, customer, text, origin: ctx.origin, isNew: false }).catch(() => {});
    return requestsOf(db, customer.id).find((r) => r.id === report.id);
  });

  // Push notifications: the phone gives its subscription, the server keeps it for this customer.
  router.get('/api/push/key', ({ config }) => ({ publicKey: config.vapid.publicKey }));

  router.post('/api/me/push', (ctx) => {
    const customer = requireCustomer(ctx);
    const s = ctx.body.subscription || {};
    const endpoint = optStr(s.endpoint, 2000);
    if (!endpoint || !/^https:\/\//.test(endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) throw new HttpError(400, 'Abonnement invalide');
    ctx.db
      .prepare(
        `INSERT INTO push_subscriptions (endpoint, customer_id, p256dh, auth) VALUES (?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET customer_id = excluded.customer_id, p256dh = excluded.p256dh, auth = excluded.auth`
      )
      .run(endpoint, customer.id, String(s.keys.p256dh).slice(0, 200), String(s.keys.auth).slice(0, 100));
    return { ok: true };
  });

  router.delete('/api/me/push', (ctx) => {
    const customer = requireCustomer(ctx);
    ctx.db.prepare('DELETE FROM push_subscriptions WHERE customer_id = ? AND endpoint = ?').run(customer.id, String(ctx.body.endpoint || ''));
    return { ok: true };
  });

  router.post('/api/me/logout', (ctx) => {
    requireCustomer(ctx);
    ctx.db.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').run(ctx.tokenHash);
    return { ok: true };
  });

  // Right to erasure: removes the customer, their sessions, saved data and photo files.
  router.delete('/api/me', (ctx) => {
    const customer = requireCustomer(ctx);
    deleteCustomer(ctx.db, ctx.uploads, customer.id);
    return { ok: true };
  });
}

// Photo URLs kept in a customer's saved state.
function statePhotoUrls(db, customerId) {
  const urls = [];
  for (const r of db.prepare("SELECT key, value FROM customer_state WHERE customer_id = ? AND key IN ('cdb_uph', 'cdb_photo')").all(customerId)) {
    if (r.key === 'cdb_photo') urls.push(r.value);
    else {
      try {
        urls.push(...Object.values(JSON.parse(r.value || '{}')));
      } catch {
        /* ignore malformed */
      }
    }
  }
  return urls.filter((u) => typeof u === 'string' && u.startsWith('/uploads/'));
}

function deleteCustomer(db, uploads, customerId) {
  const customer = db.prepare('SELECT cover_photo_url FROM customers WHERE id = ?').get(customerId);
  if (!customer) return false;
  const files = [customer.cover_photo_url, ...statePhotoUrls(db, customerId)];
  for (const p of db.prepare('SELECT url FROM customer_photos WHERE customer_id = ?').all(customerId)) files.push(p.url);
  for (const r of db.prepare('SELECT photos FROM reports WHERE customer_id = ?').all(customerId)) files.push(...JSON.parse(r.photos || '[]'));
  db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
  files.forEach((f) => uploads.remove(f));
  return true;
}

module.exports = { register, deleteCustomer, statePhotoUrls, formatAccessCode };
