'use strict';

const { HttpError } = require('../http');
const { transaction, getSetting, stripVin, bumpContentVersion } = require('../db');
const { sha256, randomToken, randomCode, normalizeCode, createRateLimiter, sealText, openText } = require('../auth');
const { appData, readProfile } = require('../catalog');
const { kindsOf, labelOf, entretienOf, logOf } = require('../entretien');
const { CATEGORY_IDS } = require('../tips');
const { bannerFor } = require('../banners');
const { routeRequest, warrantyOf, SERVICES } = require('../services');
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

  // The dealership's team, to choose the customer's salesperson at the handover (names only).
  function salespeopleOf(db, dealershipId) {
    return camelAll(db.prepare("SELECT id, name, email FROM admins WHERE dealership_id = ? AND role IN ('manager', 'sales') ORDER BY name, email").all(dealershipId)).map((s) => ({ id: s.id, name: s.name || s.email.split('@')[0] }));
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
    const { recovery_hash, vin, plate, access_code_enc, ...publicCustomer } = customer;
    return {
      warranty: warrantyOf(db, customer),
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

  router.get('/api/dealerships/code/:code', ({ db, params, ip }) => {
    const d = findDealershipByCode(db, params.code, ip);
    const w = db.prepare('SELECT warranty_years FROM dealerships WHERE id = ?').get(d.id);
    return { ...camel(d), warrantyYears: w.warranty_years ?? 2, salespeople: salespeopleOf(db, d.id) };
  });

  // Handover ("mise en main"): the dealership enters its code, picks brand + vehicle, fills in the customer.
  router.post('/api/handover', ({ db, body, ip }) => {
    const dealership = findDealershipByCode(db, body.dealershipCode, ip);
    const vehicleId = reqInt(body.vehicleId, 'Véhicule');
    findActiveVehicle(db, vehicleId);
    const c = body.customer || {};
    const lastName = reqStr(c.lastName, 'Nom du client', 100);
    const salesperson = body.salespersonId ? db.prepare("SELECT id FROM admins WHERE id = ? AND dealership_id = ? AND role IN ('manager', 'sales')").get(Number(body.salespersonId), dealership.id) : null;
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
          null, // no number plate
          null, // the VIN stays on the phone
          optDate(c.handoverDate) || new Date().toISOString().slice(0, 10),
          // No usable code until the dealership validates the handover in the app.
          sha256(randomToken())
        );
      if (salesperson) db.prepare('UPDATE customers SET salesperson_id = ? WHERE id = ?').run(salesperson.id, lastInsertRowid);
      // Warranty entered by the salesperson at the handover (end date, extension): it decides SAV or store for parts.
      db.prepare('UPDATE customers SET warranty_end = ?, warranty_ext_end = ? WHERE id = ?').run(optDate(c.warrantyEnd), optDate(c.warrantyExtEnd), lastInsertRowid);
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

  // "Consulter la réponse" button of an e-mail: the single-use link opens a session on this phone or browser.
  router.post('/api/link', ({ db, body, ip }) => {
    if (restoreLimiter(ip)) throw new HttpError(429, 'Trop de tentatives, réessayez dans quelques minutes');
    const hash = sha256(String(body.token || ''));
    const link = db.prepare("SELECT * FROM login_links WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')").get(hash);
    if (!link) throw new HttpError(410, 'Ce lien a déjà servi ou a expiré : ouvrez l’application, ou utilisez votre code d’accès.');
    db.prepare("UPDATE login_links SET used_at = datetime('now') WHERE token_hash = ?").run(hash);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(link.customer_id);
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
      featured: bannerFor(ctx.db, customer),
    };
  });

  // The « À la une » banner for this customer today (asked at each start: dates and time since the handover change).
  router.get('/api/me/featured', (ctx) => ({ featured: bannerFor(ctx.db, requireCustomer(ctx)) }));

  // Saves one storage key of the app; returns the stored value (photos replaced by their URL).
  router.put('/api/me/state/:key', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db, params, body, uploads } = ctx;
    if (!STATE_KEYS.has(params.key)) throw new HttpError(400, 'Donnée inconnue');
    let value = body.value == null ? null : String(body.value);
    if (params.key === 'cdb_hand' && value) value = stripVin(value);
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
      `UPDATE customers SET recovery_hash = ?, access_code_at = ?, access_expires_at = ?, first_name = COALESCE(?, first_name),
       updated_at = datetime('now') WHERE id = ?`
    ).run(sha256(core), now.toISOString(), expires.toISOString(), optStr(body.firstName, 100), customer.id);
    const code = formatAccessCode(vehicle ? readProfile(vehicle).codePrefix : 'CDB', core);
    // Kept encrypted so the dealership and the customer can read it again (lost code), never in clear.
    db.prepare('UPDATE customers SET access_code_enc = ? WHERE id = ?').run(sealText(code, ctx.config.secret), customer.id);
    return {
      code,
      date: now.toLocaleDateString('fr-FR'),
      expiresAt: expires.toISOString().slice(0, 10),
    };
  });

  function requestsOf(db, customerId) {
    const reports = camelAll(db.prepare('SELECT * FROM reports WHERE customer_id = ? ORDER BY updated_at DESC, id DESC').all(customerId));
    const msgs = db
      .prepare('SELECT m.* FROM report_messages m JOIN reports r ON r.id = m.report_id WHERE r.customer_id = ? ORDER BY m.id')
      .all(customerId);
    for (const r of reports) {
      r.messages = camelAll(msgs.filter((m) => m.report_id === r.id));
      r.part = r.part ? JSON.parse(r.part) : null;
    }
    return reports;
  }

  // The customer's own access code, for the client space (to note it, or sign in on another phone).
  router.get('/api/me/access', (ctx) => {
    const customer = requireCustomer(ctx);
    return { accessCode: customer.access_code_enc ? openText(customer.access_code_enc, ctx.config.secret) : null, expiresAt: customer.access_expires_at ? customer.access_expires_at.slice(0, 10) : null };
  });

  // Vehicle details the store needs (never the VIN: it stays on the phone).
  router.put('/api/me/info', (ctx) => {
    const customer = requireCustomer(ctx);
    const { body, db } = ctx;
    if (body.firstName !== undefined) db.prepare('UPDATE customers SET first_name = ? WHERE id = ?').run(optStr(body.firstName, 100), customer.id);
    if (body.email !== undefined) db.prepare('UPDATE customers SET email = ? WHERE id = ?').run(optEmail(body.email), customer.id);
    if (body.phone !== undefined) db.prepare('UPDATE customers SET phone = ? WHERE id = ?').run(optStr(body.phone, 40), customer.id);
    if (body.emailNotify !== undefined) db.prepare('UPDATE customers SET email_notify = ? WHERE id = ?').run(body.emailNotify ? 1 : 0, customer.id);
    // Consent to advice and offers (campaigns), with its date: the proof asked by the law.
    if (body.marketing !== undefined) db.prepare("UPDATE customers SET marketing_optin = ?, marketing_optin_at = datetime('now') WHERE id = ?").run(body.marketing ? 1 : 0, customer.id);
    if (body.cellNumber !== undefined) db.prepare('UPDATE customers SET cell_number = ? WHERE id = ?').run(optStr(body.cellNumber, 40), customer.id);
    if (body.vehicleYear !== undefined) db.prepare('UPDATE customers SET vehicle_year = ? WHERE id = ?').run(optStr(body.vehicleYear, 10), customer.id);
    return session(db, db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id)).customer;
  });

  const NEEDS = { piece: 'Pièce détachée', remplacement: 'Remplacement de l’équipement', accessoire: 'Accessoire ou consommable' };

  // A photo for a store request: a new one taken now, or one the customer already has (theirs or their vehicle's).
  // It is copied, so the request keeps it even if the original changes.
  function partPhoto(ctx, customer, photo) {
    if (typeof photo !== 'string' || !photo) return null;
    if (photo.startsWith('data:')) return ctx.uploads.saveDataUrl(photo);
    const vehicle = ctx.db.prepare('SELECT photo_url, profile FROM vehicles WHERE id = ?').get(customer.vehicle_id);
    const allowed = new Set([...statePhotoUrls(ctx.db, customer.id), vehicle?.photo_url, ...(vehicle ? readProfile(vehicle).photos.map((p) => p.url) : [])].filter(Boolean));
    return allowed.has(photo) ? ctx.uploads.copy(photo) : null;
  }

  // Spare part or replacement equipment: everything the store needs to identify it, sent to the store's e-mail.
  router.post('/api/me/parts', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db, body } = ctx;
    const need = NEEDS[body.need] ? body.need : 'piece';
    const equipmentName = optStr(body.equipmentName, 120);
    const product = optStr(body.product, 200);
    if (!equipmentName && !product) throw new HttpError(400, 'Indiquez l’équipement ou la pièce');
    const part = {
      need,
      equipmentId: optStr(body.equipmentId, 40),
      equipmentName,
      product,
      model: optStr(body.model, 80),
      ref: optStr(body.ref, 80),
      cellNumber: optStr(body.cellNumber, 40),
      vehicleYear: optStr(body.vehicleYear, 10),
      photoUrl: partPhoto(ctx, customer, body.photo),
      vinSent: !!optStr(body.vin, 40),
    };
    // The vehicle's photo is generic (same for every customer of the model): the store is told so.
    part.photoKind = part.photoUrl ? (body.photoKind === 'client' ? 'client' : 'generique') : null;
    const message = optStr(body.message, 4000);
    // Under warranty (or extension): the SAV; out of warranty, or an accessory: the store.
    const route = routeRequest(db, customer, { kind: 'piece', need });
    part.service = route.service;
    part.route = route.reason;
    const title = `${need === 'remplacement' ? 'Remplacement' : need === 'accessoire' ? 'Accessoire' : 'Pièce'} : ${equipmentName || product}`.slice(0, 150);
    const description = [
      NEEDS[need],
      equipmentName && `Équipement : ${equipmentName}`,
      product && `Pièce ou produit : ${product}`,
      part.model && `Marque et modèle : ${part.model}`,
      part.ref && `Référence ou n° de série : ${part.ref}`,
      part.cellNumber && `N° de cellule : ${part.cellNumber}`,
      part.vehicleYear && `Année du véhicule : ${part.vehicleYear}`,
      part.photoKind && `Photo : ${part.photoKind === 'client' ? 'prise par le client' : 'générique du modèle (le client n’a pas joint la sienne)'}`,
      route.service === 'sav' && `⚠️ ${route.reason}`,
      message,
    ]
      .filter(Boolean)
      .join('\n');
    const { lastInsertRowid } = db
      .prepare("INSERT INTO reports (customer_id, title, description, kind, part, photos, service) VALUES (?, ?, ?, 'piece', ?, ?, ?)")
      .run(customer.id, title, description, JSON.stringify(part), JSON.stringify(part.photoUrl ? [part.photoUrl] : []), route.service);
    if (part.cellNumber) db.prepare('UPDATE customers SET cell_number = ? WHERE id = ?').run(part.cellNumber, customer.id);
    if (part.vehicleYear) db.prepare('UPDATE customers SET vehicle_year = ? WHERE id = ?').run(part.vehicleYear, customer.id);
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(lastInsertRowid);
    const fresh = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
    // The VIN goes in the e-mail to the store only: it is not saved anywhere by the application.
    ctx.notify.customerWrote({ report, customer: fresh, text: description, origin: ctx.origin, isNew: true, part, vin: optStr(body.vin, 40) }).catch(() => {});
    return { ...camel(report), part, serviceName: SERVICES[route.service], messages: [] };
  });

  // Workshop appointment request or problem, sent to the dealership (which is told by e-mail).
  router.post('/api/me/requests', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db, body } = ctx;
    const title = reqStr(body.title, 'Motif', 150);
    const parts = [optStr(body.message, 4000), body.period ? `Délai souhaité : ${optStr(body.period, 50)}` : null, body.phone ? `Téléphone : ${optStr(body.phone, 40)}` : null];
    const description = parts.filter(Boolean).join('\n\n');
    const { lastInsertRowid } = db.prepare("INSERT INTO reports (customer_id, title, description, service) VALUES (?, ?, ?, 'sav')").run(customer.id, title, description);
    if (body.phone && !customer.phone) db.prepare('UPDATE customers SET phone = ? WHERE id = ?').run(optStr(body.phone, 40), customer.id);
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(lastInsertRowid);
    const fresh = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
    ctx.notify.customerWrote({ report, customer: fresh, text: description, origin: ctx.origin, isNew: true }).catch(() => {});
    return { ...camel(report), messages: [] };
  });

  router.get('/api/me/requests', (ctx) => requestsOf(ctx.db, requireCustomer(ctx).id));

  // Maintenance: what is due (from the handover and the logbook) and the logbook the customer keeps.
  router.get('/api/me/entretien', (ctx) => entretienOf(ctx.db, requireCustomer(ctx)));
  router.post('/api/me/entretien', (ctx) => {
    const customer = requireCustomer(ctx);
    const kind = kindsOf(ctx.db).some((k) => k.id === ctx.body.kind) ? ctx.body.kind : null;
    if (!kind) throw new HttpError(400, 'Choisissez ce qui a été fait');
    const doneOn = optDate(ctx.body.doneOn) || new Date().toISOString().slice(0, 10);
    if (doneOn > new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'La date ne peut pas être dans le futur');
    if (ctx.db.prepare('SELECT COUNT(*) AS n FROM maintenance_log WHERE customer_id = ?').get(customer.id).n >= 500) throw new HttpError(400, 'Carnet complet');
    ctx.db.prepare('INSERT INTO maintenance_log (customer_id, done_on, kind, note) VALUES (?, ?, ?, ?)').run(customer.id, doneOn, kind, optStr(ctx.body.note, 300));
    return entretienOf(ctx.db, customer);
  });
  router.delete('/api/me/entretien/:id', (ctx) => {
    const customer = requireCustomer(ctx);
    ctx.db.prepare('DELETE FROM maintenance_log WHERE id = ? AND customer_id = ?').run(Number(ctx.params.id), customer.id);
    return entretienOf(ctx.db, customer);
  });

  // « Partager mon astuce »: a tip from a customer, published only once read by an administrator or a content editor.
  const tipLimiter = createRateLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 5 });
  router.post('/api/me/tips', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db, body, uploads } = ctx;
    const title = optStr(body.title, 80);
    const text = optStr(body.body, 1500);
    if (!title) throw new HttpError(400, 'Donnez un titre à votre astuce');
    if (!text || text.length < 10) throw new HttpError(400, 'Expliquez votre astuce en quelques mots');
    if (tipLimiter(`c${customer.id}`)) throw new HttpError(429, 'Merci ! Vous avez déjà partagé plusieurs astuces aujourd’hui, réessayez demain.');
    const category = CATEGORY_IDS.has(body.category) ? body.category : 'entretien';
    const photo = typeof body.photo === 'string' && body.photo.startsWith('data:image/') ? uploads.saveDataUrl(body.photo) : null;
    db.prepare("INSERT INTO tips (title, category, body, image_url, status, customer_id, author_name) VALUES (?, ?, ?, ?, 'pending', ?, ?)").run(
      title, category, text, photo, customer.id, optStr(customer.first_name, 60) || null
    );
    return { ok: true };
  });

  // Usage statistics, without saying who: what is searched, which problems are opened, which advice is reached,
  // « Demander au magasin », which equipment is looked at. Only the dealership, the vehicle type and the month are kept.
  const EVENT_KINDS = ['search', 'diag', 'result', 'shop', 'equip', 'tip'];
  const eventLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 120 });
  router.post('/api/me/events', (ctx) => {
    const customer = requireCustomer(ctx);
    if (eventLimiter(`c${customer.id}`)) return { saved: 0 };
    const list = Array.isArray(ctx.body.events) ? ctx.body.events.slice(0, 50) : [];
    const vehicle = ctx.db.prepare('SELECT * FROM vehicles WHERE id = ?').get(customer.vehicle_id);
    const type = vehicle ? readProfile(vehicle).type || null : null;
    const month = new Date().toISOString().slice(0, 7);
    const insert = ctx.db.prepare(
      'INSERT INTO usage_events (month, kind, item, label, query, prod, results, dealership_id, vehicle_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    let saved = 0;
    for (const e of list) {
      if (!e || !EVENT_KINDS.includes(e.kind)) continue;
      const query = e.kind === 'search' ? text(e.q, 80)?.toLowerCase() : null;
      if (e.kind === 'search' && (!query || query.length < 3)) continue;
      insert.run(month, e.kind, text(e.id, 40), text(e.label, 160), query, text(e.prod, 160), Number.isInteger(e.n) ? e.n : null, customer.dealership_id, type);
      saved++;
    }
    return { saved };
  });

  // The customer answers in the conversation of one of their requests.
  router.post('/api/me/requests/:id/messages', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db } = ctx;
    const report = db.prepare('SELECT * FROM reports WHERE id = ? AND customer_id = ?').get(Number(ctx.params.id), customer.id);
    if (!report) throw new HttpError(404, 'Demande introuvable');
    // A closed request is read-only for the customer: they open a new request instead.
    if (report.status === 'resolu') throw new HttpError(409, 'Cette demande est clôturée : faites une nouvelle demande.');
    const text = reqStr(ctx.body.body, 'Message', 4000);
    db.prepare("INSERT INTO report_messages (report_id, author, body) VALUES (?, 'client', ?)").run(report.id, text);
    db.prepare("UPDATE reports SET updated_at = datetime('now') WHERE id = ?").run(report.id);
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
  // Everything the application keeps about the customer, as a file (right of access and portability).
  router.get('/api/me/export', (ctx) => {
    const customer = requireCustomer(ctx);
    const { db } = ctx;
    const s = session(db, customer);
    const state = {};
    for (const [k, v] of Object.entries(s.state)) {
      try {
        state[k] = JSON.parse(v);
      } catch {
        state[k] = v;
      }
    }
    return {
      exportedAt: new Date().toISOString(),
      note: 'Données enregistrées par l’application Compagnon de bord. Le VIN n’y figure pas : il reste sur votre téléphone.',
      customer: s.customer,
      vehicle: s.vehicle,
      dealership: s.dealership,
      appData: state,
      requests: requestsOf(db, customer.id),
      maintenanceLog: logOf(db, customer.id).map((e) => ({ doneOn: e.done_on, kind: e.kind, label: labelOf(kindsOf(db), e.kind), note: e.note })),
    };
  });

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
  // The tips they shared go with them (and the apps reload the list if one was published).
  const tips = db.prepare('SELECT image_url, status FROM tips WHERE customer_id = ?').all(customerId);
  tips.forEach((t) => files.push(t.image_url));
  db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
  if (tips.some((t) => t.status === 'published')) bumpContentVersion(db);
  files.filter(Boolean).forEach((f) => uploads.remove(f));
  return true;
}

module.exports = { register, deleteCustomer, statePhotoUrls, formatAccessCode };
