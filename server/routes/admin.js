'use strict';

const { HttpError } = require('../http');
const { bumpContentVersion, getSetting, setSetting } = require('../db');
const { hashPassword, verifyPassword, signToken, verifyToken, normalizeCode, randomCode, sha256, createRateLimiter } = require('../auth');
const { camel, camelAll, optStr, reqStr, optInt, reqInt, optEmail, bool01, normalizeSpecs, pick } = require('../util');
const { deleteCustomer } = require('./public');

const SEVERITIES = ['info', 'attention', 'urgent'];
const STATUSES = ['nouveau', 'en_cours', 'resolu'];

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
      problems: count('SELECT COUNT(*) AS n FROM problems'),
      dealerships: count('SELECT COUNT(*) AS n FROM dealerships'),
      customers: count(`SELECT COUNT(*) AS n FROM customers c WHERE ${c.sql}`, c.args),
      openReports: count(`SELECT COUNT(*) AS n FROM reports r JOIN customers c ON c.id = r.customer_id WHERE r.status != 'resolu' AND ${c.sql}`, c.args),
      contentVersion: Number(getSetting(db, 'content_version', '0')),
    };
  });

  // ---- Settings ----

  router.get('/api/admin/settings', (ctx) => {
    auth(ctx);
    return { announcement: getSetting(ctx.db, 'announcement', null) };
  });

  router.put('/api/admin/settings', (ctx) => {
    adminOnly(ctx);
    setSetting(ctx.db, 'announcement', optStr(ctx.body.announcement, 500));
    bumpContentVersion(ctx.db);
    return { announcement: getSetting(ctx.db, 'announcement', null) };
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

  // ---- Problems (troubleshooting sheets) ----
  // Scope: vehicle_id set -> that vehicle only; brand_id only -> whole brand; neither -> all vehicles.

  router.get('/api/admin/problems', (ctx) => {
    auth(ctx);
    return camelAll(
      ctx.db
        .prepare(
          `SELECT p.*, b.name AS brand_name, v.name AS vehicle_name FROM problems p
           LEFT JOIN brands b ON b.id = p.brand_id LEFT JOIN vehicles v ON v.id = p.vehicle_id
           ORDER BY p.category, p.sort, p.title`
        )
        .all()
    );
  });

  function problemFields(db, body, current = {}) {
    let vehicleId = pick(optInt(body.vehicleId), current.vehicle_id ?? null);
    let brandId = pick(optInt(body.brandId), current.brand_id ?? null);
    if (vehicleId) {
      const v = db.prepare('SELECT brand_id FROM vehicles WHERE id = ?').get(vehicleId);
      if (!v) throw new HttpError(400, 'Véhicule inconnu');
      brandId = v.brand_id;
    } else if (brandId && !db.prepare('SELECT id FROM brands WHERE id = ?').get(brandId)) {
      throw new HttpError(400, 'Marque inconnue');
    }
    const severity = pick(optStr(body.severity, 20), current.severity ?? 'info');
    if (!SEVERITIES.includes(severity)) throw new HttpError(400, 'Gravité invalide');
    return {
      brandId,
      vehicleId,
      category: pick(optStr(body.category, 80), current.category ?? 'Général') || 'Général',
      title: body.title === undefined ? current.title : reqStr(body.title, 'Titre', 200),
      symptoms: pick(optStr(body.symptoms, 5000), current.symptoms ?? null),
      solution: pick(optStr(body.solution, 10000), current.solution ?? null),
      severity,
      sort: pick(optInt(body.sort), current.sort ?? 0) ?? 0,
    };
  }

  router.post('/api/admin/problems', (ctx) => {
    adminOnly(ctx);
    const { db, body, uploads } = ctx;
    const f = problemFields(db, body);
    if (!f.title) throw new HttpError(400, 'Titre obligatoire');
    const photo = uploads.resolveImage(body.photo, null);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO problems (brand_id, vehicle_id, category, title, symptoms, solution, photo_url, severity, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(f.brandId, f.vehicleId, f.category, f.title, f.symptoms, f.solution, photo, f.severity, f.sort);
    bumpContentVersion(db);
    return camel(getOr404(db, 'problems', lastInsertRowid, 'Fiche'));
  });

  router.put('/api/admin/problems/:id', (ctx) => {
    adminOnly(ctx);
    const { db, body, uploads, params } = ctx;
    const problem = getOr404(db, 'problems', params.id, 'Fiche');
    const f = problemFields(db, body, problem);
    db.prepare(
      `UPDATE problems SET brand_id = ?, vehicle_id = ?, category = ?, title = ?, symptoms = ?, solution = ?, photo_url = ?, severity = ?, sort = ?,
       updated_at = datetime('now') WHERE id = ?`
    ).run(f.brandId, f.vehicleId, f.category, f.title, f.symptoms, f.solution, uploads.resolveImage(body.photo, problem.photo_url), f.severity, f.sort, problem.id);
    bumpContentVersion(db);
    return camel(getOr404(db, 'problems', problem.id, 'Fiche'));
  });

  router.delete('/api/admin/problems/:id', (ctx) => {
    adminOnly(ctx);
    const problem = getOr404(ctx.db, 'problems', ctx.params.id, 'Fiche');
    ctx.db.prepare('DELETE FROM problems WHERE id = ?').run(problem.id);
    ctx.uploads.remove(problem.photo_url);
    bumpContentVersion(ctx.db);
    return { ok: true };
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
      .prepare('INSERT INTO dealerships (name, code, city, phone, email, active) VALUES (?, ?, ?, ?, ?, ?)')
      .run(reqStr(body.name, 'Nom de la concession', 120), code, optStr(body.city, 80), optStr(body.phone, 40), optEmail(body.email), bool01(body.active, 1));
    return camel(getOr404(db, 'dealerships', lastInsertRowid, 'Concession'));
  });

  router.put('/api/admin/dealerships/:id', (ctx) => {
    adminOnly(ctx);
    const { db, body, params } = ctx;
    const d = getOr404(db, 'dealerships', params.id, 'Concession');
    db.prepare('UPDATE dealerships SET name = ?, code = ?, city = ?, phone = ?, email = ?, active = ? WHERE id = ?').run(
      body.name === undefined ? d.name : reqStr(body.name, 'Nom de la concession', 120),
      body.code === undefined ? d.code : dealershipCode(db, body.code, d.id),
      pick(optStr(body.city, 80), d.city),
      pick(optStr(body.phone, 40), d.phone),
      pick(optEmail(body.email), d.email),
      bool01(body.active, d.active),
      d.id
    );
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
      c.handover_date, c.cover_photo_url, c.created_at, c.updated_at,
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
      photos: camelAll(ctx.db.prepare('SELECT * FROM customer_photos WHERE customer_id = ? ORDER BY id DESC').all(customer.id)),
      notes: camelAll(
        ctx.db.prepare('SELECT n.*, p.title AS problem_title FROM customer_notes n JOIN problems p ON p.id = n.problem_id WHERE n.customer_id = ?').all(customer.id)
      ),
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
  router.post('/api/admin/customers/:id/recovery-code', (ctx) => {
    auth(ctx);
    const customer = getCustomerScoped(ctx, ctx.params.id);
    const code = randomCode(8);
    ctx.db.prepare('UPDATE customers SET recovery_hash = ? WHERE id = ?').run(sha256(code), customer.id);
    ctx.db.prepare('DELETE FROM customer_sessions WHERE customer_id = ?').run(customer.id);
    return { recoveryCode: code };
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
    return camelAll(
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
           WHERE ${where.join(' AND ')} ORDER BY r.id DESC LIMIT 500`
        )
        .all(...args)
    );
  });

  router.put('/api/admin/reports/:id', (ctx) => {
    const user = auth(ctx);
    const { db, body } = ctx;
    const s = scope(user, 'c.dealership_id');
    const report = db.prepare(`SELECT r.* FROM reports r JOIN customers c ON c.id = r.customer_id WHERE r.id = ? AND ${s.sql}`).get(Number(ctx.params.id), ...s.args);
    if (!report) throw new HttpError(404, 'Signalement introuvable');
    const status = pick(optStr(body.status, 20), report.status);
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Statut invalide');
    db.prepare("UPDATE reports SET status = ?, dealer_reply = ?, updated_at = datetime('now') WHERE id = ?").run(
      status,
      pick(optStr(body.dealerReply, 4000), report.dealer_reply),
      report.id
    );
    return camel(db.prepare('SELECT * FROM reports WHERE id = ?').get(report.id));
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
