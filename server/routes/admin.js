'use strict';

const { HttpError } = require('../http');
const { bumpContentVersion, getSetting, setSetting } = require('../db');
const { hashPassword, verifyPassword, signToken, verifyToken, normalizeCode, randomCode, sha256, createRateLimiter } = require('../auth');
const { camel, camelAll, optStr, reqStr, optInt, reqInt, optEmail, bool01, normalizeSpecs, pick, safeJson } = require('../util');
const { deleteCustomer, formatAccessCode } = require('./public');
const { readProfile, getCatalogValue, CATALOG_KEYS } = require('../catalog');
const { mailConfig, mailReady } = require('../notify');
const { sendMail } = require('../mailer');

const SEVERITIES = ['info', 'attention', 'urgent'];
const STATUSES = ['nouveau', 'en_cours', 'resolu'];

// What the app saved for a customer, summarised for the back-office.
function customerStateSummary(db, customerId) {
  const state = {};
  for (const r of db.prepare('SELECT key, value, updated_at FROM customer_state WHERE customer_id = ?').all(customerId)) {
    state[r.key] = { value: r.value, updatedAt: r.updated_at };
  }
  const parse = (k, fallback) => {
    try {
      return state[k] ? JSON.parse(state[k].value) ?? fallback : fallback;
    } catch {
      return fallback;
    }
  };
  const names = {};
  for (const r of db.prepare('SELECT id, data FROM equipment').all()) names[r.id] = JSON.parse(r.data).name;
  for (const q of parse('cdb_ueq', [])) if (q && q.id) names[q.id] = q.name;
  const photos = Object.entries(parse('cdb_uph', {}))
    .filter(([, url]) => typeof url === 'string')
    .map(([id, url]) => ({ id, name: names[id] || id, url }));
  if (state.cdb_photo?.value) photos.unshift({ id: 'vehicule', name: 'Photo du véhicule', url: state.cdb_photo.value });
  const own = parse('cdb_own', null);
  const hand = parse('cdb_hand', {});
  const mods = parse('cdb_mod', {});
  return {
    photos,
    equipmentOwned: own ? Object.keys(own).filter((k) => own[k]).map((id) => names[id] || id) : null,
    customEquipment: parse('cdb_ueq', []).map((q) => q.name),
    models: Object.entries(mods)
      .filter(([, m]) => m && (m.name || m.ref))
      .map(([id, m]) => ({ id, name: names[id] || id, model: m.name || '', ref: m.ref || '' })),
    handover: { steps: Object.keys(hand.steps || {}).filter((k) => hand.steps[k]).length, validatedOn: hand.date || null },
    stateUpdatedAt: Object.values(state).map((s) => s.updatedAt).sort().pop() || null,
  };
}

// Website of a dealership: "www.exemple.fr" becomes "https://www.exemple.fr"; only http(s) links are kept.
function optUrl(value) {
  const s = optStr(value, 300);
  if (s == null) return s;
  const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) throw new Error();
    return u.href;
  } catch {
    throw new HttpError(400, 'Adresse du site web invalide');
  }
}

function register(router) {
  const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

  function auth(ctx) {
    const header = ctx.req.headers.authorization || '';
    const payload = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '', ctx.config.secret);
    let user;
    if (payload) {
      user = ctx.db.prepare('SELECT id, email, name, role, dealership_id FROM admins WHERE id = ?').get(payload.sub);
      if (!user) throw new HttpError(401, 'Compte supprimé');
    } else if (ctx.config.isOpenAccess()) {
      user = ctx.db.prepare("SELECT id, email, name, role, dealership_id FROM admins WHERE role = 'admin' ORDER BY id LIMIT 1").get();
    }
    if (!user) throw new HttpError(401, 'Connexion requise');
    ctx.user = user;
    return user;
  }

  function adminOnly(ctx) {
    const user = auth(ctx);
    if (user.role !== 'admin') throw new HttpError(403, 'Réservé aux administrateurs');
    return user;
  }

  // Dealers only see their own dealership's customers and reports.
  function scope(user, column) {
    return user.role === 'admin' ? { sql: '1 = 1', args: [] } : { sql: `${column} = ?`, args: [user.dealership_id ?? -1] };
  }

  function getOr404(db, table, id, label) {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(id));
    if (!row) throw new HttpError(404, `${label} introuvable`);
    return row;
  }

  // ---- Session ----

  router.post('/api/admin/login', ({ db, body, config, ip }) => {
    if (loginLimiter(ip)) throw new HttpError(429, 'Trop de tentatives, réessayez dans quelques minutes');
    const email = String(body.email || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
    if (!user || !verifyPassword(body.password || '', user.password_hash)) throw new HttpError(401, 'Identifiants incorrects');
    const token = signToken({ sub: user.id, role: user.role }, config.secret);
    return { token, user: camel({ id: user.id, email: user.email, name: user.name, role: user.role, dealership_id: user.dealership_id }) };
  });

  router.get('/api/admin/me', (ctx) => ({ ...camel(auth(ctx)), openAccess: ctx.config.isOpenAccess() }));

  router.get('/api/admin/stats', (ctx) => {
    const user = auth(ctx);
    const { db } = ctx;
    const c = scope(user, 'c.dealership_id');
    const count = (sql, args = []) => db.prepare(sql).get(...args).n;
    return {
      brands: count('SELECT COUNT(*) AS n FROM brands'),
      vehicles: count('SELECT COUNT(*) AS n FROM vehicles'),
      equipment: count('SELECT COUNT(*) AS n FROM equipment'),
      diagnostics: count('SELECT COUNT(*) AS n FROM diagnostics'),
      dealerships: count('SELECT COUNT(*) AS n FROM dealerships'),
      customers: count(`SELECT COUNT(*) AS n FROM customers c WHERE ${c.sql}`, c.args),
      openReports: count(`SELECT COUNT(*) AS n FROM reports r JOIN customers c ON c.id = r.customer_id WHERE r.status != 'resolu' AND ${c.sql}`, c.args),
      contentVersion: Number(getSetting(db, 'content_version', '0')),
    };
  });

  // ---- Settings ----

  function settingsView(db) {
    const c = mailConfig(db);
    return {
      announcement: getSetting(db, 'announcement', null),
      mail: { host: c.host, port: c.port, user: c.user, from: c.from, copy: c.copy, passwordSet: !!c.pass, ready: mailReady(db) },
      mailLast: safeJson(getSetting(db, 'mail_last', 'null'), null),
    };
  }

  router.get('/api/admin/settings', (ctx) => {
    auth(ctx);
    return settingsView(ctx.db);
  });

  router.put('/api/admin/settings', (ctx) => {
    adminOnly(ctx);
    const { db, body } = ctx;
    if (body.announcement !== undefined) {
      setSetting(db, 'announcement', optStr(body.announcement, 500));
      bumpContentVersion(db);
    }
    // Outgoing e-mail server (the password is only replaced when a new one is typed).
    if (body.mail) {
      const m = body.mail;
      setSetting(db, 'mail_host', optStr(m.host, 200));
      setSetting(db, 'mail_port', optInt(m.port) || 587);
      setSetting(db, 'mail_user', optStr(m.user, 200));
      if (m.pass) setSetting(db, 'mail_pass', String(m.pass).slice(0, 200));
      setSetting(db, 'mail_from', optStr(m.from, 200));
      setSetting(db, 'mail_copy', optEmail(m.copy));
    }
    return settingsView(db);
  });

  router.post('/api/admin/settings/test-email', async (ctx) => {
    adminOnly(ctx);
    const to = optEmail(ctx.body.to);
    if (!to) throw new HttpError(400, 'Adresse e-mail obligatoire');
    try {
      await sendMail(mailConfig(ctx.db), { to: [to], subject: 'Test Compagnon de bord', text: 'Bonjour,\n\nL’envoi des e-mails du Compagnon de bord fonctionne.\n' });
    } catch (err) {
      setSetting(ctx.db, 'mail_last', JSON.stringify({ ok: false, at: new Date().toISOString(), to: [to], error: err.message }));
      throw new HttpError(502, err.message);
    }
    setSetting(ctx.db, 'mail_last', JSON.stringify({ ok: true, at: new Date().toISOString(), to: [to] }));
    return { ok: true };
  });

  // ---- Brands ----

  router.get('/api/admin/brands', (ctx) => {
    auth(ctx);
    return camelAll(ctx.db.prepare('SELECT b.*, (SELECT COUNT(*) FROM vehicles v WHERE v.brand_id = b.id) AS vehicle_count FROM brands b ORDER BY sort, name').all());
  });

  router.post('/api/admin/brands', (ctx) => {
    adminOnly(ctx);
    const { db, body, uploads } = ctx;
    const name = reqStr(body.name, 'Nom de la marque', 80);
    if (db.prepare('SELECT id FROM brands WHERE lower(name) = lower(?)').get(name)) throw new HttpError(409, 'Cette marque existe déjà');
    const logo = uploads.resolveImage(body.logo, null);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO brands (name, logo_url, color, sort) VALUES (?, ?, ?, ?)')
      .run(name, logo, optStr(body.color, 20), optInt(body.sort) || 0);
    bumpContentVersion(db);
    return camel(getOr404(db, 'brands', lastInsertRowid, 'Marque'));
  });

  router.put('/api/admin/brands/:id', (ctx) => {
    adminOnly(ctx);
    const { db, body, uploads, params } = ctx;
    const brand = getOr404(db, 'brands', params.id, 'Marque');
    const name = body.name === undefined ? brand.name : reqStr(body.name, 'Nom de la marque', 80);
    if (db.prepare('SELECT id FROM brands WHERE lower(name) = lower(?) AND id != ?').get(name, brand.id)) throw new HttpError(409, 'Cette marque existe déjà');
    db.prepare('UPDATE brands SET name = ?, logo_url = ?, color = ?, sort = ? WHERE id = ?').run(
      name,
      uploads.resolveImage(body.logo, brand.logo_url),
      pick(optStr(body.color, 20), brand.color),
      pick(optInt(body.sort), brand.sort) ?? 0,
      brand.id
    );
    bumpContentVersion(db);
    return camel(getOr404(db, 'brands', brand.id, 'Marque'));
  });

  router.delete('/api/admin/brands/:id', (ctx) => {
    adminOnly(ctx);
    const brand = getOr404(ctx.db, 'brands', ctx.params.id, 'Marque');
    const used = ctx.db.prepare('SELECT COUNT(*) AS n FROM customers c JOIN vehicles v ON v.id = c.vehicle_id WHERE v.brand_id = ?').get(brand.id).n;
    if (used) throw new HttpError(409, `Impossible : ${used} client(s) possèdent un véhicule de cette marque`);
    ctx.db.prepare('DELETE FROM brands WHERE id = ?').run(brand.id);
    ctx.uploads.remove(brand.logo_url);
    bumpContentVersion(ctx.db);
    return { ok: true };
  });

  // ---- Vehicles ----

  router.get('/api/admin/vehicles', (ctx) => {
    auth(ctx);
    return camelAll(
      ctx.db
        .prepare(
          `SELECT v.*, b.name AS brand_name, (SELECT COUNT(*) FROM customers c WHERE c.vehicle_id = v.id) AS customer_count
           FROM vehicles v JOIN brands b ON b.id = v.brand_id ORDER BY b.sort, b.name, v.sort, v.name`
        )
        .all()
    );
  });

  function vehicleFields(db, body, current = {}) {
    const brandId = body.brandId === undefined ? current.brand_id : reqInt(body.brandId, 'Marque');
    if (!brandId || !db.prepare('SELECT id FROM brands WHERE id = ?').get(brandId)) throw new HttpError(400, 'Marque inconnue');
    return {
      brandId,
      name: body.name === undefined ? current.name : reqStr(body.name, 'Nom du véhicule', 120),
      modelYear: pick(optStr(body.modelYear, 20), current.model_year ?? null),
      description: pick(optStr(body.description, 5000), current.description ?? null),
      specs: pick(normalizeSpecs(body.specs), current.specs ?? '[]'),
      active: bool01(body.active, current.active ?? 1),
      sort: pick(optInt(body.sort), current.sort ?? 0) ?? 0,
    };
  }

  router.post('/api/admin/vehicles', (ctx) => {
    adminOnly(ctx);
    const { db, body, uploads } = ctx;
    const f = vehicleFields(db, body);
    if (!f.name) throw new HttpError(400, 'Nom du véhicule obligatoire');
    const photo = uploads.resolveImage(body.photo, null);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO vehicles (brand_id, name, model_year, description, photo_url, specs, active, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(f.brandId, f.name, f.modelYear, f.description, photo, f.specs, f.active, f.sort);
    bumpContentVersion(db);
    return camel(getOr404(db, 'vehicles', lastInsertRowid, 'Véhicule'));
  });

  router.put('/api/admin/vehicles/:id', (ctx) => {
    adminOnly(ctx);
    const { db, body, uploads, params } = ctx;
    const vehicle = getOr404(db, 'vehicles', params.id, 'Véhicule');
    const f = vehicleFields(db, body, vehicle);
    db.prepare(
      `UPDATE vehicles SET brand_id = ?, name = ?, model_year = ?, description = ?, photo_url = ?, specs = ?, active = ?, sort = ?,
       updated_at = datetime('now') WHERE id = ?`
    ).run(f.brandId, f.name, f.modelYear, f.description, uploads.resolveImage(body.photo, vehicle.photo_url), f.specs, f.active, f.sort, vehicle.id);
    bumpContentVersion(db);
    return camel(getOr404(db, 'vehicles', vehicle.id, 'Véhicule'));
  });

  router.delete('/api/admin/vehicles/:id', (ctx) => {
    adminOnly(ctx);
    const vehicle = getOr404(ctx.db, 'vehicles', ctx.params.id, 'Véhicule');
    const used = ctx.db.prepare('SELECT COUNT(*) AS n FROM customers WHERE vehicle_id = ?').get(vehicle.id).n;
    if (used) throw new HttpError(409, `Impossible : ${used} client(s) possèdent ce véhicule. Désactivez-le plutôt.`);
    ctx.db.prepare('DELETE FROM vehicles WHERE id = ?').run(vehicle.id);
    ctx.uploads.remove(vehicle.photo_url);
    bumpContentVersion(ctx.db);
    return { ok: true };
  });

  // ---- Compagnon de bord : catalogue (équipements, diagnostics, listes, réglages) ----

  const DIAG_CATS = ['eau', 'elec', 'gaz', 'chauf', 'frigo', 'wc', 'hum', 'ext'];

  function slugId(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
  }

  function uniqueId(db, table, base) {
    let id = base || 'element';
    for (let i = 2; db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id); i++) id = `${base}_${i}`;
    return id;
  }

  function equipmentFields(db, body, current = {}) {
    const cats = (getCatalogValue(db, 'cats') || []).map((c) => c[0]);
    const cat = pick(optStr(body.cat, 20), current.cat);
    if (!cat || (cats.length && !cats.includes(cat))) throw new HttpError(400, 'Rubrique inconnue');
    return {
      ...current,
      cat,
      name: body.name === undefined ? current.name : reqStr(body.name, 'Nom', 120),
      spot: body.spot === undefined ? current.spot ?? null : optStr(body.spot, 20) || null,
      text: pick(optStr(body.text, 2000), current.text ?? '') ?? '',
      tip: pick(optStr(body.tip, 1000), current.tip ?? '') ?? '',
      kw: pick(optStr(body.kw, 500), current.kw ?? '') ?? '',
    };
  }
  router.get('/api/admin/equipment', (ctx) => {
    auth(ctx);
    return ctx.db.prepare('SELECT sort, data FROM equipment ORDER BY sort, id').all().map((r) => ({ ...JSON.parse(r.data), sort: r.sort }));
  });

  router.post('/api/admin/equipment', (ctx) => {
    adminOnly(ctx);
    const f = equipmentFields(ctx.db, ctx.body);
    if (!f.name) throw new HttpError(400, 'Nom obligatoire');
    const id = uniqueId(ctx.db, 'equipment', slugId(ctx.body.id) || slugId(f.name));
    const sort = ctx.db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM equipment').get().n;
    const data = { id, ...f, img: '' };
    ctx.db.prepare('INSERT INTO equipment (id, sort, data) VALUES (?, ?, ?)').run(id, sort, JSON.stringify(data));
    bumpContentVersion(ctx.db);
    return data;
  });

  router.put('/api/admin/equipment/:id', (ctx) => {
    adminOnly(ctx);
    const row = ctx.db.prepare('SELECT data FROM equipment WHERE id = ?').get(ctx.params.id);
    if (!row) throw new HttpError(404, 'Équipement introuvable');
    const data = { ...equipmentFields(ctx.db, ctx.body, JSON.parse(row.data)), id: ctx.params.id };
    ctx.db.prepare('UPDATE equipment SET data = ? WHERE id = ?').run(JSON.stringify(data), ctx.params.id);
    bumpContentVersion(ctx.db);
    return data;
  });

  router.delete('/api/admin/equipment/:id', (ctx) => {
    adminOnly(ctx);
    const used = ctx.db.prepare("SELECT COUNT(*) AS n FROM diagnostics WHERE json_extract(data, '$.eq') = ?").get(ctx.params.id).n;
    if (used) throw new HttpError(409, `Impossible : ${used} diagnostic(s) sont rattachés à cet équipement`);
    if (!ctx.db.prepare('DELETE FROM equipment WHERE id = ?').run(ctx.params.id).changes) throw new HttpError(404, 'Équipement introuvable');
    bumpContentVersion(ctx.db);
    return { ok: true };
  });

  // A question has a text (t), answers (o) and one follow-up per answer (n); a leaf names the cause.
  function validateTree(node, depth = 0) {
    if (depth > 80) throw new HttpError(400, 'Arbre trop profond');
    if (!node || typeof node !== 'object' || Array.isArray(node)) throw new HttpError(400, 'Étape de diagnostic invalide');
    if (Array.isArray(node.o) || Array.isArray(node.n) || node.t !== undefined) {
      if (typeof node.t !== 'string' || !node.t.trim()) throw new HttpError(400, 'Une question n’a pas de texte');
      if (!Array.isArray(node.o) || !Array.isArray(node.n) || !node.o.length || node.o.length !== node.n.length) {
        throw new HttpError(400, `La question « ${node.t.slice(0, 60)} » doit avoir autant de suites que de réponses`);
      }
      node.o.forEach((o) => {
        if (typeof o !== 'string' || !o.trim()) throw new HttpError(400, `Une réponse de « ${node.t.slice(0, 60)} » est vide`);
      });
      node.n.forEach((n) => validateTree(n, depth + 1));
    } else if (typeof node.cause !== 'string') {
      throw new HttpError(400, 'Une fin de parcours n’a pas de cause');
    }
  }

  function countLeaves(node) {
    if (!node || typeof node !== 'object') return 0;
    return Array.isArray(node.n) ? node.n.reduce((a, n) => a + countLeaves(n), 0) : 1;
  }

  function diagnosticFields(db, body, current = {}) {
    const cat = pick(optStr(body.cat, 20), current.cat);
    if (!DIAG_CATS.includes(cat)) throw new HttpError(400, 'Rubrique de diagnostic inconnue');
    const data = {
      ...current,
      cat,
      label: body.label === undefined ? current.label : reqStr(body.label, 'Titre', 200),
      eq: body.eq === undefined ? current.eq ?? null : optStr(body.eq, 40) || null,
      kw: pick(optStr(body.kw, 2000), current.kw ?? '') ?? '',
    };
    if (body.urgent !== undefined) {
      if (body.urgent) data.urgent = true;
      else delete data.urgent;
    }
    if (body.tree !== undefined) {
      validateTree(body.tree);
      data.tree = body.tree;
    }
    if (!data.tree && !data.elim) throw new HttpError(400, 'Le diagnostic doit contenir au moins une étape');
    if (data.eq && !db.prepare('SELECT 1 FROM equipment WHERE id = ?').get(data.eq)) throw new HttpError(400, 'Équipement inconnu');
    return data;
  }

  router.get('/api/admin/diagnostics', (ctx) => {
    auth(ctx);
    return ctx.db
      .prepare('SELECT id, sort, data, updated_at FROM diagnostics ORDER BY sort, id')
      .all()
      .map((r) => {
        const d = JSON.parse(r.data);
        return { id: d.id, sort: r.sort, label: d.label, cat: d.cat, eq: d.eq || null, urgent: !!d.urgent, elim: !!d.elim, leaves: countLeaves(d.tree), updatedAt: r.updated_at };
      });
  });

  router.get('/api/admin/diagnostics/:id', (ctx) => {
    auth(ctx);
    const row = ctx.db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(ctx.params.id);
    if (!row) throw new HttpError(404, 'Diagnostic introuvable');
    return JSON.parse(row.data);
  });

  router.post('/api/admin/diagnostics', (ctx) => {
    adminOnly(ctx);
    const body = { tree: { t: 'Première vérification : est-ce réglé ?', o: ['Oui, c’est réglé', 'Non'], n: [{ cause: '', geste: '', prod: '' }, { cause: 'Rien n’a réglé le problème.', geste: 'Passez à l’atelier.', prod: 'Aucun produit : passez à l’atelier', rdv: 'atelier' }] }, ...ctx.body };
    const data = diagnosticFields(ctx.db, body);
    data.id = uniqueId(ctx.db, 'diagnostics', slugId(ctx.body.id) || 'd_' + slugId(data.label).slice(0, 30));
    const sort = ctx.db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM diagnostics').get().n;
    ctx.db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(data.id, sort, JSON.stringify(data));
    bumpContentVersion(ctx.db);
    return data;
  });

  router.put('/api/admin/diagnostics/:id', (ctx) => {
    adminOnly(ctx);
    const row = ctx.db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(ctx.params.id);
    if (!row) throw new HttpError(404, 'Diagnostic introuvable');
    const data = { ...diagnosticFields(ctx.db, ctx.body, JSON.parse(row.data)), id: ctx.params.id };
    ctx.db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(data), ctx.params.id);
    bumpContentVersion(ctx.db);
    return data;
  });

  router.delete('/api/admin/diagnostics/:id', (ctx) => {
    adminOnly(ctx);
    if (!ctx.db.prepare('DELETE FROM diagnostics WHERE id = ?').run(ctx.params.id).changes) throw new HttpError(404, 'Diagnostic introuvable');
    bumpContentVersion(ctx.db);
    return { ok: true };
  });

  // Lists (arrival/departure), reminders, workshop reasons, game steps, equipment sections, settings.
  router.get('/api/admin/catalog/:key', (ctx) => {
    auth(ctx);
    if (!CATALOG_KEYS.includes(ctx.params.key)) throw new HttpError(404, 'Rubrique inconnue');
    return { key: ctx.params.key, value: getCatalogValue(ctx.db, ctx.params.key) };
  });

  router.put('/api/admin/catalog/:key', (ctx) => {
    adminOnly(ctx);
    const { key } = ctx.params;
    if (!CATALOG_KEYS.includes(key)) throw new HttpError(404, 'Rubrique inconnue');
    const value = ctx.body.value;
    const expectArray = ['reminders', 'motifs', 'steps', 'cats'].includes(key);
    if (expectArray ? !Array.isArray(value) : !value || typeof value !== 'object' || Array.isArray(value)) {
      throw new HttpError(400, 'Format invalide');
    }
    if (key === 'lists') {
      for (const [k, list] of Object.entries(value)) {
        if (!list || !Array.isArray(list.items) || list.items.some((i) => typeof i !== 'string')) throw new HttpError(400, `Liste « ${k} » invalide`);
      }
    }
    const json = JSON.stringify(value);
    if (json.length > 2 * 1024 * 1024) throw new HttpError(413, 'Trop volumineux');
    ctx.db
      .prepare("INSERT INTO catalog (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
      .run(key, json);
    bumpContentVersion(ctx.db);
    return { key, value };
  });

  // ---- Vehicle profile: what the app shows for this model (dimensions, weights, plan, equipment photos) ----

  router.get('/api/admin/vehicles/:id/profile', (ctx) => {
    auth(ctx);
    const vehicle = getOr404(ctx.db, 'vehicles', ctx.params.id, 'Véhicule');
    return readProfile(vehicle);
  });

  function num(value, fallback, label) {
    if (value === undefined || value === '' || value === null) return fallback;
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${label} invalide`);
    return n;
  }

  router.put('/api/admin/vehicles/:id/profile', (ctx) => {
    adminOnly(ctx);
    const { db, body, uploads } = ctx;
    const vehicle = getOr404(db, 'vehicles', ctx.params.id, 'Véhicule');
    const p = readProfile(vehicle);
    const w = body.weights || {};
    const next = {
      ...p,
      heroPrefix: pick(optStr(body.heroPrefix, 30), p.heroPrefix) ?? '',
      heroName: pick(optStr(body.heroName, 60), p.heroName) ?? '',
      fullName: pick(optStr(body.fullName, 120), p.fullName) ?? '',
      codePrefix: body.codePrefix === undefined ? p.codePrefix : normalizeCode(body.codePrefix).slice(0, 8) || 'CDB',
      model: body.model ? { l: num(body.model.l, p.model.l, 'Longueur'), h: num(body.model.h, p.model.h, 'Hauteur') } : p.model,
      weights: Object.fromEntries(Object.entries(p.weights).map(([k, v]) => [k, num(w[k], v, 'Poids')])),
    };
    if (body.equipment !== undefined) {
      if (!Array.isArray(body.equipment)) throw new HttpError(400, 'Format invalide');
      const known = new Set(db.prepare('SELECT id FROM equipment').all().map((r) => r.id));
      next.equipment = [...new Set(body.equipment.map(String))].filter((id) => known.has(id));
    }
    for (const key of ['spots']) {
      if (body[key] !== undefined) {
        if (!Array.isArray(body[key])) throw new HttpError(400, 'Format invalide');
        next[key] = body[key];
      }
    }
    for (const key of ['vars', 'spotOverrides']) {
      if (body[key] !== undefined) {
        if (!body[key] || typeof body[key] !== 'object' || Array.isArray(body[key])) throw new HttpError(400, 'Format invalide');
        next[key] = body[key];
      }
    }
    if (body.plan !== undefined) next.planUrl = uploads.resolveImage(body.plan, p.planUrl);
    db.prepare("UPDATE vehicles SET profile = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(next), vehicle.id);
    bumpContentVersion(db);
    return next;
  });

  // Photo of one equipment on this vehicle ("C'est quoi, ça ?"); null removes it.
  router.put('/api/admin/vehicles/:id/photos/:equipmentId', (ctx) => {
    adminOnly(ctx);
    const { db, uploads, params, body } = ctx;
    const vehicle = getOr404(db, 'vehicles', params.id, 'Véhicule');
    if (!db.prepare('SELECT 1 FROM equipment WHERE id = ?').get(params.equipmentId)) throw new HttpError(404, 'Équipement introuvable');
    const p = readProfile(vehicle);
    const i = p.photos.findIndex((x) => x.id === params.equipmentId);
    const current = i >= 0 ? p.photos[i].url : null;
    const url = uploads.resolveImage(body.image ?? null, current);
    if (url && i >= 0) p.photos[i].url = url;
    else if (url) p.photos.push({ id: params.equipmentId, url });
    else if (i >= 0) p.photos.splice(i, 1);
    db.prepare("UPDATE vehicles SET profile = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(p), vehicle.id);
    bumpContentVersion(db);
    return { id: params.equipmentId, url };
  });

  // ---- Dealerships ----

  router.get('/api/admin/dealerships', (ctx) => {
    const user = auth(ctx);
    const s = scope(user, 'd.id');
    return camelAll(
      ctx.db
        .prepare(`SELECT d.*, (SELECT COUNT(*) FROM customers c WHERE c.dealership_id = d.id) AS customer_count FROM dealerships d WHERE ${s.sql} ORDER BY d.name`)
        .all(...s.args)
    );
  });

  function dealershipCode(db, value, currentId) {
    const code = normalizeCode(value);
    if (code.length < 4 || code.length > 16) throw new HttpError(400, 'Le code concession doit faire entre 4 et 16 caractères (lettres et chiffres)');
    if (db.prepare('SELECT id FROM dealerships WHERE code = ? AND id != ?').get(code, currentId ?? -1)) throw new HttpError(409, 'Ce code est déjà utilisé');
    return code;
  }

  router.post('/api/admin/dealerships', (ctx) => {
    adminOnly(ctx);
    const { db, body } = ctx;
    const code = dealershipCode(db, body.code || randomCode(6));
    const { lastInsertRowid } = db
      .prepare('INSERT INTO dealerships (name, code, city, phone, email, hours, website, logo_url, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        reqStr(body.name, 'Nom de la concession', 120),
        code,
        optStr(body.city, 80),
        optStr(body.phone, 40),
        optEmail(body.email),
        optStr(body.hours, 200),
        optUrl(body.website),
        ctx.uploads.resolveImage(body.logo, null),
        bool01(body.active, 1)
      );
    bumpContentVersion(db);
    return camel(getOr404(db, 'dealerships', lastInsertRowid, 'Concession'));
  });

  router.put('/api/admin/dealerships/:id', (ctx) => {
    adminOnly(ctx);
    const { db, body, params } = ctx;
    const d = getOr404(db, 'dealerships', params.id, 'Concession');
    db.prepare('UPDATE dealerships SET name = ?, code = ?, city = ?, phone = ?, email = ?, hours = ?, website = ?, logo_url = ?, active = ? WHERE id = ?').run(
      body.name === undefined ? d.name : reqStr(body.name, 'Nom de la concession', 120),
      body.code === undefined ? d.code : dealershipCode(db, body.code, d.id),
      pick(optStr(body.city, 80), d.city),
      pick(optStr(body.phone, 40), d.phone),
      pick(optEmail(body.email), d.email),
      pick(optStr(body.hours, 200), d.hours),
      pick(optUrl(body.website), d.website),
      ctx.uploads.resolveImage(body.logo, d.logo_url),
      bool01(body.active, d.active),
      d.id
    );
    bumpContentVersion(db);
    return camel(getOr404(db, 'dealerships', d.id, 'Concession'));
  });

  router.delete('/api/admin/dealerships/:id', (ctx) => {
    adminOnly(ctx);
    const d = getOr404(ctx.db, 'dealerships', ctx.params.id, 'Concession');
    const used = ctx.db.prepare('SELECT COUNT(*) AS n FROM customers WHERE dealership_id = ?').get(d.id).n;
    if (used) throw new HttpError(409, `Impossible : ${used} client(s) sont rattachés à cette concession. Désactivez-la plutôt.`);
    ctx.db.prepare('DELETE FROM dealerships WHERE id = ?').run(d.id);
    return { ok: true };
  });

  // ---- Customers ----

  const CUSTOMER_SELECT = `SELECT c.id, c.dealership_id, c.vehicle_id, c.first_name, c.last_name, c.email, c.phone, c.plate, c.vin,
      c.handover_date, c.cover_photo_url, c.access_code_at, c.access_expires_at, c.created_at, c.updated_at,
      d.name AS dealership_name, v.name AS vehicle_name, b.name AS brand_name,
      (SELECT COUNT(*) FROM reports r WHERE r.customer_id = c.id AND r.status != 'resolu') AS open_reports
    FROM customers c
    JOIN dealerships d ON d.id = c.dealership_id
    JOIN vehicles v ON v.id = c.vehicle_id
    JOIN brands b ON b.id = v.brand_id`;

  function getCustomerScoped(ctx, id) {
    const s = scope(ctx.user, 'c.dealership_id');
    const row = ctx.db.prepare(`${CUSTOMER_SELECT} WHERE c.id = ? AND ${s.sql}`).get(Number(id), ...s.args);
    if (!row) throw new HttpError(404, 'Client introuvable');
    return row;
  }

  router.get('/api/admin/customers', (ctx) => {
    const user = auth(ctx);
    const s = scope(user, 'c.dealership_id');
    const q = optStr(ctx.query.get('q'), 100);
    const where = [s.sql];
    const args = [...s.args];
    if (q) {
      where.push("(c.last_name LIKE ? OR c.first_name LIKE ? OR c.email LIKE ? OR c.plate LIKE ? OR c.vin LIKE ?)");
      args.push(...Array(5).fill(`%${q}%`));
    }
    return camelAll(ctx.db.prepare(`${CUSTOMER_SELECT} WHERE ${where.join(' AND ')} ORDER BY c.id DESC LIMIT 500`).all(...args));
  });

  router.get('/api/admin/customers/:id', (ctx) => {
    auth(ctx);
    const customer = getCustomerScoped(ctx, ctx.params.id);
    return {
      ...camel(customer),
      ...customerStateSummary(ctx.db, customer.id),
      reports: camelAll(ctx.db.prepare('SELECT * FROM reports WHERE customer_id = ? ORDER BY id DESC').all(customer.id)),
    };
  });

  router.put('/api/admin/customers/:id', (ctx) => {
    const user = auth(ctx);
    const { db, body } = ctx;
    const customer = getCustomerScoped(ctx, ctx.params.id);
    const vehicleId = pick(optInt(body.vehicleId), customer.vehicle_id);
    if (!db.prepare('SELECT id FROM vehicles WHERE id = ?').get(vehicleId)) throw new HttpError(400, 'Véhicule inconnu');
    let dealershipId = customer.dealership_id;
    if (user.role === 'admin' && body.dealershipId !== undefined) {
      dealershipId = reqInt(body.dealershipId, 'Concession');
      if (!db.prepare('SELECT id FROM dealerships WHERE id = ?').get(dealershipId)) throw new HttpError(400, 'Concession inconnue');
    }
    db.prepare(
      `UPDATE customers SET vehicle_id = ?, dealership_id = ?, first_name = ?, last_name = ?, email = ?, phone = ?, plate = ?, vin = ?,
       handover_date = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      vehicleId,
      dealershipId,
      pick(optStr(body.firstName, 100), customer.first_name),
      body.lastName === undefined ? customer.last_name : reqStr(body.lastName, 'Nom', 100),
      pick(optEmail(body.email), customer.email),
      pick(optStr(body.phone, 40), customer.phone),
      pick(optStr(body.plate, 20), customer.plate),
      pick(optStr(body.vin, 40), customer.vin),
      pick(optStr(body.handoverDate, 10), customer.handover_date),
      customer.id
    );
    return camel(getCustomerScoped(ctx, customer.id));
  });

  // Issues a new recovery code (e.g. the customer lost theirs) and signs out their devices.
  // Issues a new access code (lost code, renewal) valid 2 years; phones already signed in stay signed in.
  router.post('/api/admin/customers/:id/recovery-code', (ctx) => {
    auth(ctx);
    const customer = getCustomerScoped(ctx, ctx.params.id);
    const core = randomCode(8);
    const now = new Date();
    const expires = new Date(now);
    expires.setFullYear(expires.getFullYear() + 2);
    ctx.db
      .prepare('UPDATE customers SET recovery_hash = ?, access_code_at = ?, access_expires_at = ? WHERE id = ?')
      .run(sha256(core), now.toISOString(), expires.toISOString(), customer.id);
    const vehicle = ctx.db.prepare('SELECT * FROM vehicles WHERE id = ?').get(customer.vehicle_id);
    return { recoveryCode: formatAccessCode(vehicle ? readProfile(vehicle).codePrefix : 'CDB', core), expiresAt: expires.toISOString().slice(0, 10) };
  });

  router.delete('/api/admin/customers/:id', (ctx) => {
    adminOnly(ctx);
    const customer = getCustomerScoped(ctx, ctx.params.id);
    deleteCustomer(ctx.db, ctx.uploads, customer.id);
    return { ok: true };
  });

  // ---- Reports ----

  router.get('/api/admin/reports', (ctx) => {
    const user = auth(ctx);
    const s = scope(user, 'c.dealership_id');
    const status = ctx.query.get('status');
    const where = [s.sql];
    const args = [...s.args];
    if (status && STATUSES.includes(status)) {
      where.push('r.status = ?');
      args.push(status);
    }
    const list = camelAll(
      ctx.db
        .prepare(
          `SELECT r.*, c.first_name, c.last_name, c.phone, c.email, c.plate, d.name AS dealership_name, v.name AS vehicle_name, b.name AS brand_name,
             p.title AS problem_title
           FROM reports r
           JOIN customers c ON c.id = r.customer_id
           JOIN dealerships d ON d.id = c.dealership_id
           JOIN vehicles v ON v.id = c.vehicle_id
           JOIN brands b ON b.id = v.brand_id
           LEFT JOIN problems p ON p.id = r.problem_id
           WHERE ${where.join(' AND ')} ORDER BY r.updated_at DESC, r.id DESC LIMIT 500`
        )
        .all(...args)
    );
    const ids = list.map((r) => r.id);
    const msgs = ids.length ? camelAll(ctx.db.prepare(`SELECT * FROM report_messages WHERE report_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).all(...ids)) : [];
    for (const r of list) {
      r.messages = msgs.filter((m) => m.reportId === r.id);
      // The customer wrote last: the dealership owes an answer.
      r.waitingForDealer = r.messages.length ? r.messages[r.messages.length - 1].author === 'client' : r.status === 'nouveau';
    }
    return list;
  });

  router.put('/api/admin/reports/:id', (ctx) => {
    const user = auth(ctx);
    const { db, body } = ctx;
    const s = scope(user, 'c.dealership_id');
    const report = db.prepare(`SELECT r.* FROM reports r JOIN customers c ON c.id = r.customer_id WHERE r.id = ? AND ${s.sql}`).get(Number(ctx.params.id), ...s.args);
    if (!report) throw new HttpError(404, 'Demande introuvable');
    const status = pick(optStr(body.status, 20), report.status);
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Statut invalide');
    // A reply is a new message in the conversation; the customer is notified.
    const reply = optStr(body.dealerReply ?? body.message, 4000);
    if (reply) db.prepare("INSERT INTO report_messages (report_id, author, body) VALUES (?, 'concession', ?)").run(report.id, reply);
    db.prepare("UPDATE reports SET status = ?, dealer_reply = ?, updated_at = datetime('now') WHERE id = ?").run(status, reply || report.dealer_reply, report.id);
    if (reply) {
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(report.customer_id);
      ctx.notify.dealershipAnswered({ report, customer, text: reply, origin: ctx.origin }).catch(() => {});
    }
    return {
      ...camel(db.prepare('SELECT * FROM reports WHERE id = ?').get(report.id)),
      messages: camelAll(db.prepare('SELECT * FROM report_messages WHERE report_id = ? ORDER BY id').all(report.id)),
    };
  });

  // ---- Back-office users ----

  router.get('/api/admin/users', (ctx) => {
    adminOnly(ctx);
    return camelAll(
      ctx.db.prepare('SELECT a.id, a.email, a.name, a.role, a.dealership_id, a.created_at, d.name AS dealership_name FROM admins a LEFT JOIN dealerships d ON d.id = a.dealership_id ORDER BY a.email').all()
    );
  });

  function userFields(db, body, current = {}) {
    const role = pick(optStr(body.role, 10), current.role ?? 'dealer');
    if (!['admin', 'dealer'].includes(role)) throw new HttpError(400, 'Rôle invalide');
    const dealershipId = role === 'dealer' ? pick(optInt(body.dealershipId), current.dealership_id ?? null) : null;
    if (role === 'dealer' && (!dealershipId || !db.prepare('SELECT id FROM dealerships WHERE id = ?').get(dealershipId))) {
      throw new HttpError(400, 'Un compte concession doit être rattaché à une concession');
    }
    return { role, dealershipId, name: pick(optStr(body.name, 100), current.name ?? null) };
  }

  function checkPassword(password) {
    if (String(password || '').length < 8) throw new HttpError(400, 'Mot de passe : 8 caractères minimum');
    return String(password);
  }

  router.post('/api/admin/users', (ctx) => {
    adminOnly(ctx);
    const { db, body } = ctx;
    const email = optEmail(body.email);
    if (!email) throw new HttpError(400, 'E-mail obligatoire');
    if (db.prepare('SELECT id FROM admins WHERE email = ?').get(email)) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail');
    const f = userFields(db, body);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO admins (email, name, password_hash, role, dealership_id) VALUES (?, ?, ?, ?, ?)')
      .run(email, f.name, hashPassword(checkPassword(body.password)), f.role, f.dealershipId);
    return camel(db.prepare('SELECT id, email, name, role, dealership_id FROM admins WHERE id = ?').get(lastInsertRowid));
  });

  router.put('/api/admin/users/:id', (ctx) => {
    const me = adminOnly(ctx);
    const { db, body } = ctx;
    const user = getOr404(db, 'admins', ctx.params.id, 'Utilisateur');
    const f = userFields(db, body, user);
    if (user.id === me.id && f.role !== 'admin') throw new HttpError(400, 'Vous ne pouvez pas retirer votre propre rôle administrateur');
    const email = pick(optEmail(body.email), user.email);
    if (db.prepare('SELECT id FROM admins WHERE email = ? AND id != ?').get(email, user.id)) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail');
    const hash = body.password ? hashPassword(checkPassword(body.password)) : user.password_hash;
    db.prepare('UPDATE admins SET email = ?, name = ?, role = ?, dealership_id = ?, password_hash = ? WHERE id = ?').run(email, f.name, f.role, f.dealershipId, hash, user.id);
    return camel(db.prepare('SELECT id, email, name, role, dealership_id FROM admins WHERE id = ?').get(user.id));
  });

  router.delete('/api/admin/users/:id', (ctx) => {
    const me = adminOnly(ctx);
    const user = getOr404(ctx.db, 'admins', ctx.params.id, 'Utilisateur');
    if (user.id === me.id) throw new HttpError(400, 'Vous ne pouvez pas supprimer votre propre compte');
    ctx.db.prepare('DELETE FROM admins WHERE id = ?').run(user.id);
    return { ok: true };
  });

  // Any signed-in user can change their own password.
  router.put('/api/admin/password', (ctx) => {
    const me = auth(ctx);
    const row = ctx.db.prepare('SELECT password_hash FROM admins WHERE id = ?').get(me.id);
    if (!verifyPassword(ctx.body.currentPassword || '', row.password_hash)) throw new HttpError(400, 'Mot de passe actuel incorrect');
    ctx.db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hashPassword(checkPassword(ctx.body.newPassword)), me.id);
    return { ok: true };
  });
}

module.exports = { register };
