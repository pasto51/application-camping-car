'use strict';

const fs = require('node:fs');

const { HttpError } = require('../http');
const { bumpContentVersion, getSetting, setSetting } = require('../db');
const { hashPassword, verifyPassword, signToken, verifyToken, normalizeCode, randomCode, sha256, createRateLimiter, sealText, openText } = require('../auth');
const { camel, camelAll, optStr, reqStr, optInt, reqInt, optEmail, bool01, normalizeSpecs, pick, safeJson } = require('../util');
const { deleteCustomer, formatAccessCode } = require('./public');
const { readProfile, getCatalogValue, CATALOG_KEYS, carryOf } = require('../catalog');
const { TYPES, TYPE_IDS, vehiclePlan, effectiveSpot, isApplicable, layoutList, PLANS } = require('../vehicle-types');
const { matchLayouts } = require('../layouts');
const { warrantyOf, SERVICES, OVERDUE_SQL, WAITING_SINCE } = require('../services');
const { backupNow, fullBackupNow, listBackups, listFullBackups, backupFile, KEEP, FULL_KEEP } = require('../backup');
const { entretienOf, settingsOf, cleanSettings } = require('../entretien');
const { CATEGORIES, CATEGORY_IDS, videoEmbed, tipOut } = require('../tips');
const { SCREENS, ICONS, AGES, WARRANTIES, allBanners, audience, cleanBanner, insertBanner, updateBanner, liveOn } = require('../banners');
const { TYPES: VEHICLE_TYPES } = require('../vehicle-types');
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
  // Wrong passwords: 10 per account and per address, 50 per address, in 15 minutes (a typo does not lock the whole team).
  const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
  const loginIpLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 });
  // A password hash to compare with when the e-mail is unknown: the answer takes the same time (no way to guess the accounts).
  const DUMMY_HASH = hashPassword('compte-inexistant-0000');

  // Test mode (file data/acces-libre): the back-office opens without a password, but only while the site holds no real
  // customer (demo dealerships aside) and never for the backups.
  function openAccessOk(ctx) {
    if (!ctx.config.isOpenAccess()) return false;
    const real = ctx.db
      .prepare("SELECT COUNT(*) AS n FROM customers c JOIN dealerships d ON d.id = c.dealership_id WHERE d.code NOT IN ('DEMO2026', 'DEMONANT', 'DEMORENN', 'DEMOVANN')")
      .get().n;
    return real === 0;
  }

  function auth(ctx) {
    const header = ctx.req.headers.authorization || '';
    const sent = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = verifyToken(sent, ctx.config.secret);
    let user;
    if (payload) {
      user = ctx.db
        .prepare('SELECT id, email, name, role, dealership_id, dealership_ids, phone, token_version, (SELECT store_detached FROM dealerships d WHERE d.id = admins.dealership_id) AS store_detached FROM admins WHERE id = ?')
        .get(payload.sub);
      if (!user) throw new HttpError(401, 'Compte supprimé');
      // Password changed or reset since this sign-in: the session ends on every device.
      if ((payload.tv || 0) !== (user.token_version || 0)) throw new HttpError(401, 'Session expirée, reconnectez-vous');
    } else if (sent) {
      throw new HttpError(401, 'Session expirée, reconnectez-vous');
    } else if (openAccessOk(ctx)) {
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
  // Backups hold all the data and the keys of the site: never without a real sign-in.
  function adminSignedIn(ctx) {
    const user = adminOnly(ctx);
    if (!(ctx.req.headers.authorization || '').startsWith('Bearer ')) throw new HttpError(403, 'Connectez-vous avec votre mot de passe pour les sauvegardes');
    return user;
  }

  // Roles: admin (everything) ; manager, « responsable de concession » (their dealership: customers, team, reassignments) ;
  // sales, « commercial » (sees their dealership, manages only their own customers).
  const ROLES = ['admin', 'editor', 'analytics', 'manager', 'sales', 'sav', 'store'];

  // Content editor: the app's contents (diagnostics, equipment, lists, vehicles and photos, announcement), not the business data.
  function contentOnly(ctx) {
    const user = auth(ctx);
    if (user.role !== 'admin' && user.role !== 'editor') throw new HttpError(403, 'Réservé à l’administrateur et à l’éditeur de contenu');
    return user;
  }
  const SERVICE_OF_ROLE = { sav: 'sav', store: 'magasin' };

  // Customer requests: the SAV and the store see those of their dealership and answer their own; a detached store is
  // independent (its requests are not shown to the dealership, and it sees only them). Salespeople do not handle requests.
  function reportScope(user) {
    if (user.role === 'admin') return { sql: '1 = 1', args: [] };
    const base = { sql: 'c.dealership_id = ?', args: [user.dealership_id ?? -1] };
    if (user.role === 'store') return { sql: `${base.sql} AND (r.service = 'magasin' OR d.store_detached = 0 OR d.store_detached IS NULL)`, args: base.args };
    if (user.role === 'manager' || user.role === 'sav') return { sql: `${base.sql} AND NOT (r.service = 'magasin' AND d.store_detached = 1)`, args: base.args };
    return { sql: '0 = 1', args: [] };
  }
  function canAnswer(user, report) {
    if (user.role === 'admin' || user.role === 'manager') return true;
    return SERVICE_OF_ROLE[user.role] === (report.service || 'sav');
  }
  const isManager = (user) => user.role === 'admin' || user.role === 'manager';

  function managerOnly(ctx) {
    const user = auth(ctx);
    if (!isManager(user)) throw new HttpError(403, 'Réservé au responsable de la concession');
    return user;
  }

  // May this user change this customer (details, access code, answers to their requests)?
  function canManage(user, customer) {
    if (user.role === 'admin') return true;
    if (customer.dealership_id !== user.dealership_id) return false;
    return user.role === 'manager' || customer.salesperson_id === user.id;
  }
  function requireManage(user, customer) {
    if (!canManage(user, customer)) throw new HttpError(403, 'Ce client est suivi par un autre commercial : demandez au responsable de vous le confier.');
  }

  // A salesperson that can follow customers of this dealership (or null).
  function salespersonFor(db, id, dealershipId) {
    if (id === undefined || id === null || id === '') return null;
    const s = db.prepare("SELECT id FROM admins WHERE id = ? AND dealership_id = ? AND role IN ('manager', 'sales')").get(Number(id), dealershipId);
    if (!s) throw new HttpError(400, 'Commercial inconnu pour cette concession');
    return s.id;
  }

  // Everyone in a dealership sees all of its customers and reports.
  function scope(user, column) {
    return user.role === 'admin' ? { sql: '1 = 1', args: [] } : { sql: `${column} = ?`, args: [user.dealership_id ?? -1] };
  }

  function getOr404(db, table, id, label) {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(id));
    if (!row) throw new HttpError(404, `${label} introuvable`);
    return row;
  }

  // ---- Session ----

  router.post('/api/admin/login', ({ db, body, config, ip, origin }) => {
    // Only wrong passwords count: a whole team logging in from the dealership's connection is not blocked.
    const email0 = String(body.email || '').trim().toLowerCase();
    if (loginLimiter.reached(`${ip}|${email0}`) || loginIpLimiter.reached(ip)) throw new HttpError(429, 'Trop de tentatives, réessayez dans quelques minutes');
    const email = String(body.email || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
    const ok = verifyPassword(body.password || '', user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      loginLimiter(`${ip}|${email}`);
      loginIpLimiter(ip);
      throw new HttpError(401, 'Identifiants incorrects');
    }
    // The address of the site, for the links of the e-mails sent by the daily tasks (after a correct password only).
    if (origin && !/localhost|127\.0\.0\.1/.test(origin)) setSetting(db, 'site_origin', origin);
    // « Rester connecté » : 15 days on this device; otherwise the session ends after 12 hours.
    const token = signToken({ sub: user.id, role: user.role, tv: user.token_version || 0 }, config.secret, body.remember ? 60 * 60 * 24 * 15 : 60 * 60 * 12);
    const storeDetached = db.prepare('SELECT store_detached FROM dealerships WHERE id = ?').get(user.dealership_id)?.store_detached ?? null;
    return { token, user: camel({ id: user.id, email: user.email, name: user.name, role: user.role, dealership_id: user.dealership_id, store_detached: storeDetached }) };
  });

  router.get('/api/admin/me', (ctx) => {
    const { token_version, ...me } = auth(ctx);
    return { ...camel(me), openAccess: openAccessOk(ctx), appVersion: ctx.config.appVersion };
  });

  // ---- Statistics of use (« Statistiques ») : what customers look for, to decide the next campaigns ----
  // The administrator and the analyst see every dealership (or one); a dealership manager sees theirs.
  // ---- Backups of the database (administrator) ----
  router.get('/api/admin/backups', (ctx) => {
    adminSignedIn(ctx);
    return { keep: KEEP, fullKeep: FULL_KEEP, backups: listBackups(ctx.config.dataDir), full: listFullBackups(ctx.config.dataDir) };
  });
  router.post('/api/admin/backups', (ctx) => {
    adminSignedIn(ctx);
    if (!ctx.body.full) return backupNow(ctx.db, ctx.config.dataDir);
    try {
      return fullBackupNow(ctx.db, ctx.config.dataDir);
    } catch (err) {
      throw new HttpError(500, `Sauvegarde complète : ${err.message}`);
    }
  });
  router.get('/api/admin/backups/:name', (ctx) => {
    adminSignedIn(ctx);
    const file = backupFile(ctx.config.dataDir, ctx.params.name);
    if (!file) throw new HttpError(404, 'Sauvegarde introuvable');
    ctx.res.writeHead(200, {
      'Content-Type': ctx.params.name.endsWith('.tar.gz') ? 'application/gzip' : 'application/octet-stream',
      'Content-Length': fs.statSync(file).size,
      'Content-Disposition': `attachment; filename="compagnon-${ctx.params.name}"`,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).on('error', () => ctx.res.destroy()).pipe(ctx.res);
  });

  router.get('/api/admin/analytics', (ctx) => {
    const user = auth(ctx);
    if (!['admin', 'analytics', 'manager'].includes(user.role)) throw new HttpError(403, 'Réservé à l’administrateur et à l’analyste');
    const { db } = ctx;
    const months = [3, 6, 12, 24].includes(Number(ctx.query.get('months'))) ? Number(ctx.query.get('months')) : 12;
    // Which dealerships this account may look at: its own (manager), those it follows (analyst of a group), or all.
    const allowed = user.role === 'manager' ? [user.dealership_id ?? -1] : user.role === 'analytics' ? followedIds(user) : null;
    const asked = optInt(ctx.query.get('dealershipId'));
    const dealershipId = user.role === 'manager' ? user.dealership_id ?? -1 : asked && (!allowed || allowed.includes(asked)) ? asked : null;
    const scopeIds = dealershipId ? [dealershipId] : allowed;
    const monthAgo = (n) => {
      const d = new Date();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - n);
      return d.toISOString().slice(0, 7);
    };
    const list = (n) => Array.from({ length: n }, (_, i) => monthAgo(n - 1 - i));
    const from = monthAgo(months - 1);
    const prevFrom = monthAgo(2 * months - 1);
    const scopeSql = scopeIds ? ` AND dealership_id IN (${scopeIds.map(() => '?').join(', ')})` : '';
    const scopeArgs = scopeIds || [];
    const rows = (sql, ...args) => db.prepare(sql).all(...args);
    const inRange = `month >= ? ${scopeSql}`;
    const inPrev = `month >= ? AND month < ? ${scopeSql}`;

    const totals = {};
    for (const r of rows(`SELECT kind, COUNT(*) AS n FROM usage_events WHERE ${inRange} GROUP BY kind`, from, ...scopeArgs)) totals[r.kind] = r.n;
    const prevTotals = {};
    for (const r of rows(`SELECT kind, COUNT(*) AS n FROM usage_events WHERE ${inPrev} GROUP BY kind`, prevFrom, from, ...scopeArgs)) prevTotals[r.kind] = r.n;

    const monthsList = list(months);
    const perMonth = new Map(monthsList.map((m) => [m, { month: m, search: 0, diag: 0, result: 0, shop: 0, equip: 0 }]));
    for (const r of rows(`SELECT month, kind, COUNT(*) AS n FROM usage_events WHERE ${inRange} GROUP BY month, kind`, from, ...scopeArgs)) {
      if (perMonth.has(r.month)) perMonth.get(r.month)[r.kind] = r.n;
    }

    const diagNames = new Map(rows('SELECT id, data FROM diagnostics').map((d) => [d.id, JSON.parse(d.data).label]));
    const prevDiag = new Map(rows(`SELECT item, COUNT(*) AS n FROM usage_events WHERE kind = 'diag' AND ${inPrev} GROUP BY item`, prevFrom, from, ...scopeArgs).map((r) => [r.item, r.n]));
    const topProblems = rows(`SELECT item, MAX(label) AS label, COUNT(*) AS n FROM usage_events WHERE kind = 'diag' AND ${inRange} GROUP BY item ORDER BY n DESC LIMIT 15`, from, ...scopeArgs).map((r) => ({
      id: r.item,
      label: diagNames.get(r.item) || r.label,
      count: r.n,
      previous: prevDiag.get(r.item) || 0,
      comfort: String(r.item || '').startsWith('p_'),
    }));

    // Products put forward at the end of the advice, and how many customers then asked the store.
    const shops = new Map(rows(`SELECT prod, COUNT(*) AS n FROM usage_events WHERE kind = 'shop' AND prod IS NOT NULL AND ${inRange} GROUP BY prod`, from, ...scopeArgs).map((r) => [r.prod, r.n]));
    const topProducts = rows(`SELECT prod, COUNT(*) AS n FROM usage_events WHERE kind = 'result' AND prod IS NOT NULL AND ${inRange} GROUP BY prod ORDER BY n DESC LIMIT 15`, from, ...scopeArgs).map((r) => ({
      product: r.prod,
      shown: r.n,
      asked: shops.get(r.prod) || 0,
    }));

    const topSearches = rows(
      `SELECT query, COUNT(*) AS n, SUM(CASE WHEN results = 0 THEN 1 ELSE 0 END) AS none FROM usage_events WHERE kind = 'search' AND ${inRange} GROUP BY query ORDER BY n DESC LIMIT 20`,
      from,
      ...scopeArgs
    ).map((r) => ({ query: r.query, count: r.n, noResult: r.none }));
    const unanswered = rows(
      `SELECT query, COUNT(*) AS n FROM usage_events WHERE kind = 'search' AND results = 0 AND ${inRange} GROUP BY query ORDER BY n DESC LIMIT 15`,
      from,
      ...scopeArgs
    ).map((r) => ({ query: r.query, count: r.n }));

    // Seasonality: the most frequent problems, month by month over the last 12 months.
    const season12 = list(12);
    const seasonTop = rows(`SELECT item, COUNT(*) AS n FROM usage_events WHERE kind = 'diag' AND month >= ? ${scopeSql} GROUP BY item ORDER BY n DESC LIMIT 10`, season12[0], ...scopeArgs);
    const seasonCells = new Map();
    for (const r of rows(`SELECT item, month, COUNT(*) AS n FROM usage_events WHERE kind = 'diag' AND month >= ? ${scopeSql} GROUP BY item, month`, season12[0], ...scopeArgs)) {
      seasonCells.set(`${r.item}|${r.month}`, r.n);
    }
    const seasonality = {
      months: season12,
      rows: seasonTop.map((t) => ({ id: t.item, label: diagNames.get(t.item) || t.item, counts: season12.map((m) => seasonCells.get(`${t.item}|${m}`) || 0) })),
    };

    // Equipment: how many customers have it (ticked in their app, or the list of their model), and how often it is looked at.
    const eqNames = new Map(rows('SELECT id, data FROM equipment').map((r) => [r.id, JSON.parse(r.data).name]));
    const profiles = new Map(rows('SELECT id, profile FROM vehicles').map((v) => [v.id, (() => { try { return JSON.parse(v.profile || '{}').equipment || []; } catch { return []; } })()]));
    const owners = new Map();
    const customers = rows(`SELECT c.id, c.vehicle_id, s.value AS own FROM customers c LEFT JOIN customer_state s ON s.customer_id = c.id AND s.key = 'cdb_own' ${scopeIds ? `WHERE c.dealership_id IN (${scopeIds.map(() => '?').join(', ')})` : ''}`, ...scopeArgs);
    for (const c of customers) {
      let ids = profiles.get(c.vehicle_id) || [];
      try {
        const own = c.own ? JSON.parse(c.own) : null;
        if (own && typeof own === 'object') ids = Object.keys(own).filter((k) => own[k]);
      } catch { /* keep the model's list */ }
      for (const id of new Set(ids)) owners.set(id, (owners.get(id) || 0) + 1);
    }
    const views = new Map(rows(`SELECT item, COUNT(*) AS n FROM usage_events WHERE kind = 'equip' AND ${inRange} GROUP BY item`, from, ...scopeArgs).map((r) => [r.item, r.n]));
    const equipment = [...new Set([...owners.keys(), ...views.keys()])]
      .map((id) => ({ id, name: eqNames.get(id) || id, owners: owners.get(id) || 0, views: views.get(id) || 0 }))
      .sort((a, b) => b.owners - a.owners || b.views - a.views)
      .slice(0, 25);

    // « Conseils & Astuces »: the tips read the most.
    const tipNames = new Map(rows('SELECT id, title FROM tips').map((t) => [String(t.id), t.title]));
    const topTips = rows(`SELECT item, MAX(label) AS label, COUNT(*) AS n FROM usage_events WHERE kind = 'tip' AND ${inRange} GROUP BY item ORDER BY n DESC LIMIT 10`, from, ...scopeArgs)
      .map((r) => ({ id: r.item, label: tipNames.get(r.item) || r.label || r.item, count: r.n }));

    const vehicleTypes = rows(`SELECT COALESCE(vehicle_type, 'inconnu') AS type, COUNT(*) AS n FROM usage_events WHERE kind = 'diag' AND ${inRange} GROUP BY type ORDER BY n DESC`, from, ...scopeArgs);
    // The dealerships offered in the filter (names only): those followed, or all for the administrator.
    const choices = user.role === 'manager' ? [] : allowed
      ? rows(`SELECT id, name FROM dealerships WHERE id IN (${allowed.map(() => '?').join(', ')}) ORDER BY name`, ...allowed)
      : rows('SELECT id, name FROM dealerships ORDER BY name');
    return {
      months,
      dealershipId: dealershipId || null,
      dealerships: choices,
      followed: allowed && user.role === 'analytics' ? choices.map((d) => d.name) : null,
      customers: customers.length,
      totals,
      prevTotals,
      perMonth: [...perMonth.values()],
      topProblems,
      topProducts,
      topSearches,
      unanswered,
      seasonality,
      equipment,
      topTips,
      vehicleTypes,
    };
  });

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
      customers: seesCustomers(user) ? count(`SELECT COUNT(*) AS n FROM customers c WHERE ${c.sql}`, c.args) : null,
      // Requests the user handles (their service; everything for a manager), without salespeople's.
      openReports: (() => {
        const rs = reportScope(user);
        return count(`SELECT COUNT(*) AS n FROM reports r JOIN customers c ON c.id = r.customer_id JOIN dealerships d ON d.id = c.dealership_id WHERE r.status != 'resolu' AND ${rs.sql}${SERVICE_OF_ROLE[user.role] ? ' AND r.service = ?' : ''}`, [...rs.args, ...(SERVICE_OF_ROLE[user.role] ? [SERVICE_OF_ROLE[user.role]] : [])]);
      })(),
      // Requests of the user's service left without answer for more than 48 hours.
      overdueReports: (() => {
        const rs = reportScope(user);
        const svc = SERVICE_OF_ROLE[user.role];
        return count(`SELECT COUNT(*) AS n FROM reports r JOIN customers c ON c.id = r.customer_id JOIN dealerships d ON d.id = c.dealership_id WHERE ${OVERDUE_SQL} AND ${rs.sql}${svc ? ' AND r.service = ?' : ''}`, [...rs.args, ...(svc ? [svc] : [])]);
      })(),
      contentVersion: Number(getSetting(db, 'content_version', '0')),
      // Tips shared by customers, waiting to be read (administrator and content editor).
      pendingTips: user.role === 'admin' || user.role === 'editor' ? count("SELECT COUNT(*) AS n FROM tips WHERE status = 'pending'") : null,
      // « Mes clients » recap, for whoever follows customers (no e-mail is sent to salespeople).
      mine: {
        customers: count('SELECT COUNT(*) AS n FROM customers WHERE salesperson_id = ?', [user.id]),
        openReports: count("SELECT COUNT(*) AS n FROM reports r JOIN customers c ON c.id = r.customer_id WHERE c.salesperson_id = ? AND r.status != 'resolu'", [user.id]),
        recentReports: camelAll(
          db
            .prepare(
              `SELECT r.id, r.title, r.status, r.kind, r.updated_at, c.id AS customer_id, c.first_name, c.last_name FROM reports r JOIN customers c ON c.id = r.customer_id
               WHERE c.salesperson_id = ? AND r.created_at >= datetime('now', '-30 days') ORDER BY r.updated_at DESC LIMIT 8`
            )
            .all(user.id)
        ),
        recentCustomers: camelAll(
          db.prepare('SELECT id, first_name, last_name, handover_date FROM customers WHERE salesperson_id = ? ORDER BY id DESC LIMIT 5').all(user.id)
        ),
      },
    };
  });

  // ---- « Conseils & Astuces » and the « À la une » banner (administrator and content editor) ----

  function tipAdminOut(db, r) {
    const who = r.customer_id ? db.prepare('SELECT c.first_name, c.last_name, d.name AS dealership FROM customers c JOIN dealerships d ON d.id = c.dealership_id WHERE c.id = ?').get(r.customer_id) : null;
    return { ...tipOut(r), status: r.status, createdAt: r.created_at, publishedAt: r.published_at, sort: r.sort, customer: who ? { id: r.customer_id, name: [who.first_name, who.last_name].filter(Boolean).join(' '), dealership: who.dealership } : null };
  }
  function tipFields(ctx, prev = {}) {
    const { body, uploads } = ctx;
    const title = body.title === undefined ? prev.title : optStr(body.title, 80);
    if (!title) throw new HttpError(400, 'Titre obligatoire');
    const category = body.category === undefined ? prev.category : CATEGORY_IDS.has(body.category) ? body.category : 'entretien';
    let videoUrl = prev.video_url ?? null;
    if (body.videoUrl !== undefined) {
      videoUrl = body.videoUrl ? videoEmbed(body.videoUrl) : null;
      if (body.videoUrl && !videoUrl) throw new HttpError(400, 'Vidéo : collez un lien YouTube ou Vimeo');
    }
    let imageUrl = prev.image_url ?? null;
    if (body.image !== undefined) {
      if (typeof body.image === 'string' && body.image.startsWith('data:image/')) imageUrl = uploads.saveDataUrl(body.image);
      else if (!body.image) imageUrl = null;
      if (prev.image_url && prev.image_url !== imageUrl) uploads.remove(prev.image_url);
    }
    return {
      title,
      category,
      body: body.body === undefined ? prev.body : optStr(body.body, 3000) || '',
      storeTip: body.storeTip === undefined ? prev.store_tip ?? null : optStr(body.storeTip, 400),
      sort: body.sort === undefined ? prev.sort ?? 0 : optInt(body.sort) || 0,
      imageUrl,
      videoUrl,
    };
  }

  router.get('/api/admin/tips', (ctx) => {
    contentOnly(ctx);
    const { db } = ctx;
    return {
      tips: db.prepare("SELECT * FROM tips ORDER BY status = 'pending' DESC, sort DESC, id DESC").all().map((r) => tipAdminOut(db, r)),
      categories: CATEGORIES,
    };
  });

  router.post('/api/admin/tips', (ctx) => {
    contentOnly(ctx);
    const { db } = ctx;
    const f = tipFields(ctx);
    const r = db
      .prepare("INSERT INTO tips (title, category, body, store_tip, sort, image_url, video_url, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', datetime('now'))")
      .run(f.title, f.category, f.body, f.storeTip, f.sort, f.imageUrl, f.videoUrl);
    bumpContentVersion(db);
    return tipAdminOut(db, db.prepare('SELECT * FROM tips WHERE id = ?').get(r.lastInsertRowid));
  });

  // Edit (a customer's tip too, before publishing it: correct a word, add « Le conseil du magasin »); publish: true publishes.
  router.put('/api/admin/tips/:id', (ctx) => {
    contentOnly(ctx);
    const { db, body } = ctx;
    const prev = getOr404(db, 'tips', ctx.params.id, 'Astuce');
    const f = tipFields(ctx, prev);
    const status = body.publish ? 'published' : prev.status;
    db.prepare(
      "UPDATE tips SET title = ?, category = ?, body = ?, store_tip = ?, sort = ?, image_url = ?, video_url = ?, status = ?, published_at = CASE WHEN ? = 'published' AND published_at IS NULL THEN datetime('now') ELSE published_at END WHERE id = ?"
    ).run(f.title, f.category, f.body, f.storeTip, f.sort, f.imageUrl, f.videoUrl, status, status, prev.id);
    if (status === 'published' || prev.status === 'published') bumpContentVersion(db);
    return tipAdminOut(db, db.prepare('SELECT * FROM tips WHERE id = ?').get(prev.id));
  });

  router.delete('/api/admin/tips/:id', (ctx) => {
    contentOnly(ctx);
    const { db, uploads } = ctx;
    const prev = getOr404(db, 'tips', ctx.params.id, 'Astuce');
    db.prepare('DELETE FROM tips WHERE id = ?').run(prev.id);
    if (prev.image_url) uploads.remove(prev.image_url);
    // The banners that opened it go too.
    for (const b of allBanners(db)) if (b.action === 'tip' && b.tipId === prev.id) db.prepare('DELETE FROM banners WHERE id = ?').run(b.id);
    if (prev.status === 'published') bumpContentVersion(db);
    return { ok: true };
  });

  // ---- « À la une »: the banners of the app's home screen ----
  // Administrator and content editor: for any customers. Dealership manager: banners for their own dealership only
  // (open days…); they see the others without changing them.
  function bannerUser(ctx) {
    const user = auth(ctx);
    if (!['admin', 'editor', 'manager'].includes(user.role)) throw new HttpError(403, 'Réservé à l’administrateur, à l’éditeur de contenu et au responsable de concession');
    return user;
  }
  const isGlobalRole = (user) => user.role === 'admin' || user.role === 'editor';
  function canEditBanner(user, b) {
    return isGlobalRole(user) || (b.dealershipIds.length === 1 && b.dealershipIds[0] === user.dealership_id);
  }

  router.get('/api/admin/banners', (ctx) => {
    const user = bannerUser(ctx);
    const { db } = ctx;
    const scopeIds = isGlobalRole(user) ? null : [user.dealership_id ?? -1];
    // A manager sees the banners their customers may receive: for everyone, or naming their dealership.
    const banners = allBanners(db)
      .filter((b) => !scopeIds || !b.dealershipIds.length || b.dealershipIds.includes(scopeIds[0]))
      .map((b) => ({ ...b, editable: canEditBanner(user, b), live: liveOn(b), reach: audience(db, b, scopeIds) }));
    const dealerships = scopeIds ? camelAll(db.prepare('SELECT id, name FROM dealerships WHERE id = ?').all(scopeIds[0])) : camelAll(db.prepare('SELECT id, name FROM dealerships ORDER BY name').all());
    return {
      banners,
      global: isGlobalRole(user),
      dealerships,
      tips: db.prepare("SELECT id, title FROM tips WHERE status = 'published' ORDER BY sort DESC, id DESC").all(),
      equipment: db.prepare('SELECT id, data FROM equipment ORDER BY sort, id').all().map((r) => [r.id, JSON.parse(r.data).name]).sort((a, b) => a[1].localeCompare(b[1], 'fr')),
      vehicleTypes: VEHICLE_TYPES.map((t) => [t.id, t.name]),
      ages: AGES.map((a) => [a[0], a[1]]),
      warranties: WARRANTIES,
      screens: SCREENS,
      icons: ICONS,
    };
  });

  function bannerBody(ctx, user) {
    try {
      return cleanBanner(ctx.db, ctx.body, isGlobalRole(user) ? {} : { dealershipIds: [user.dealership_id] });
    } catch (err) {
      throw new HttpError(400, err.message);
    }
  }

  router.post('/api/admin/banners', (ctx) => {
    const user = bannerUser(ctx);
    if (!isGlobalRole(user) && !user.dealership_id) throw new HttpError(403, 'Aucune concession');
    const id = insertBanner(ctx.db, bannerBody(ctx, user), user.id);
    bumpContentVersion(ctx.db);
    return { id };
  });

  router.put('/api/admin/banners/:id', (ctx) => {
    const user = bannerUser(ctx);
    const { db } = ctx;
    const prev = allBanners(db).find((b) => b.id === Number(ctx.params.id));
    if (!prev) throw new HttpError(404, 'Bandeau introuvable');
    if (!canEditBanner(user, prev)) throw new HttpError(403, 'Ce bandeau est géré par l’administrateur');
    updateBanner(db, prev.id, bannerBody(ctx, user));
    bumpContentVersion(db);
    return { id: prev.id };
  });

  router.delete('/api/admin/banners/:id', (ctx) => {
    const user = bannerUser(ctx);
    const { db } = ctx;
    const prev = allBanners(db).find((b) => b.id === Number(ctx.params.id));
    if (!prev) throw new HttpError(404, 'Bandeau introuvable');
    if (!canEditBanner(user, prev)) throw new HttpError(403, 'Ce bandeau est géré par l’administrateur');
    db.prepare('DELETE FROM banners WHERE id = ?').run(prev.id);
    bumpContentVersion(db);
    return { ok: true };
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

  // The e-mail server settings are for the administrator; the others see the announcement only.
  router.get('/api/admin/settings', (ctx) => {
    const user = auth(ctx);
    const view = settingsView(ctx.db);
    return user.role === 'admin' ? view : { announcement: view.announcement };
  });

  router.put('/api/admin/settings', (ctx) => {
    const user = contentOnly(ctx);
    const { db, body } = ctx;
    if (body.mail && user.role !== 'admin') throw new HttpError(403, 'Réservé aux administrateurs');
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
      if (m.from && /[\r\n]/.test(String(m.from))) throw new HttpError(400, 'Adresse d’expédition invalide');
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
    contentOnly(ctx);
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
    contentOnly(ctx);
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
    contentOnly(ctx);
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
    contentOnly(ctx);
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
      // Vehicle types this equipment exists on (empty: all).
      types: body.types === undefined ? current.types || [] : (Array.isArray(body.types) ? body.types : []).map(String).filter((t) => TYPE_IDS.includes(t)),
    };
  }
  router.get('/api/admin/equipment', (ctx) => {
    contentOnly(ctx);
    return ctx.db.prepare('SELECT sort, data FROM equipment ORDER BY sort, id').all().map((r) => ({ ...JSON.parse(r.data), sort: r.sort }));
  });

  router.post('/api/admin/equipment', (ctx) => {
    contentOnly(ctx);
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
    contentOnly(ctx);
    const row = ctx.db.prepare('SELECT data FROM equipment WHERE id = ?').get(ctx.params.id);
    if (!row) throw new HttpError(404, 'Équipement introuvable');
    const data = { ...equipmentFields(ctx.db, ctx.body, JSON.parse(row.data)), id: ctx.params.id };
    ctx.db.prepare('UPDATE equipment SET data = ? WHERE id = ?').run(JSON.stringify(data), ctx.params.id);
    bumpContentVersion(ctx.db);
    return data;
  });

  router.delete('/api/admin/equipment/:id', (ctx) => {
    contentOnly(ctx);
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
    contentOnly(ctx);
    return ctx.db
      .prepare('SELECT id, sort, data, updated_at FROM diagnostics ORDER BY sort, id')
      .all()
      .map((r) => {
        const d = JSON.parse(r.data);
        return { id: d.id, sort: r.sort, label: d.label, cat: d.cat, eq: d.eq || null, urgent: !!d.urgent, elim: !!d.elim, leaves: countLeaves(d.tree), updatedAt: r.updated_at };
      });
  });

  router.get('/api/admin/diagnostics/:id', (ctx) => {
    contentOnly(ctx);
    const row = ctx.db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(ctx.params.id);
    if (!row) throw new HttpError(404, 'Diagnostic introuvable');
    return JSON.parse(row.data);
  });

  router.post('/api/admin/diagnostics', (ctx) => {
    contentOnly(ctx);
    const body = { tree: { t: 'Première vérification : est-ce réglé ?', o: ['Oui, c’est réglé', 'Non'], n: [{ cause: '', geste: '', prod: '' }, { cause: 'Rien n’a réglé le problème.', geste: 'Passez à l’atelier.', prod: 'Aucun produit : passez à l’atelier', rdv: 'atelier' }] }, ...ctx.body };
    const data = diagnosticFields(ctx.db, body);
    data.id = uniqueId(ctx.db, 'diagnostics', slugId(ctx.body.id) || 'd_' + slugId(data.label).slice(0, 30));
    const sort = ctx.db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM diagnostics').get().n;
    ctx.db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(data.id, sort, JSON.stringify(data));
    bumpContentVersion(ctx.db);
    return data;
  });

  router.put('/api/admin/diagnostics/:id', (ctx) => {
    contentOnly(ctx);
    const row = ctx.db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(ctx.params.id);
    if (!row) throw new HttpError(404, 'Diagnostic introuvable');
    const data = { ...diagnosticFields(ctx.db, ctx.body, JSON.parse(row.data)), id: ctx.params.id };
    ctx.db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(data), ctx.params.id);
    bumpContentVersion(ctx.db);
    return data;
  });

  router.delete('/api/admin/diagnostics/:id', (ctx) => {
    contentOnly(ctx);
    if (!ctx.db.prepare('DELETE FROM diagnostics WHERE id = ?').run(ctx.params.id).changes) throw new HttpError(404, 'Diagnostic introuvable');
    bumpContentVersion(ctx.db);
    return { ok: true };
  });

  // Lists (arrival/departure), reminders, workshop reasons, game steps, equipment sections, settings.
  router.get('/api/admin/catalog/:key', (ctx) => {
    contentOnly(ctx);
    if (!CATALOG_KEYS.includes(ctx.params.key)) throw new HttpError(404, 'Rubrique inconnue');
    return { key: ctx.params.key, value: getCatalogValue(ctx.db, ctx.params.key) };
  });

  router.put('/api/admin/catalog/:key', (ctx) => {
    contentOnly(ctx);
    const { key } = ctx.params;
    if (!CATALOG_KEYS.includes(key)) throw new HttpError(404, 'Rubrique inconnue');
    const value = ctx.body.value;
    const expectArray = ['reminders', 'motifs', 'steps', 'cats'].includes(key);
    if (expectArray ? !Array.isArray(value) : !value || typeof value !== 'object' || Array.isArray(value)) {
      throw new HttpError(400, 'Format invalide');
    }
    if (key === 'lists') {
      for (const [k, list] of Object.entries(value)) {
        // An item: its text, or { t: text, eq: equipment (at least one), group, variant: [variant, value] }.
        const ok = (i) => typeof i === 'string' || (i && typeof i === 'object' && typeof i.t === 'string' && i.t.trim());
        if (!/^[a-z0-9_-]{1,30}$/.test(k) || !list || !Array.isArray(list.items) || !list.items.every(ok)) throw new HttpError(400, `Liste « ${k} » invalide`);
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

  // ---- « Carnet d'entretien »: the kinds of maintenance (dates, reminders, for which customers) and the checks to do
  // oneself; « Ce que j'emporte »: the things added in one touch. Both in « Contenus de l'appli ».
  const saveCatalog = (db, key, value) => {
    db.prepare("INSERT INTO catalog (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").run(key, JSON.stringify(value));
    bumpContentVersion(db);
  };
  router.get('/api/admin/entretien', (ctx) => {
    contentOnly(ctx);
    return settingsOf(ctx.db);
  });
  router.put('/api/admin/entretien', (ctx) => {
    contentOnly(ctx);
    let value;
    try {
      value = cleanSettings(ctx.db, ctx.body);
    } catch (err) {
      throw new HttpError(400, err.message);
    }
    saveCatalog(ctx.db, 'entretien', value);
    return value;
  });
  router.get('/api/admin/carry', (ctx) => {
    contentOnly(ctx);
    return carryOf(ctx.db);
  });
  router.put('/api/admin/carry', (ctx) => {
    contentOnly(ctx);
    if (!Array.isArray(ctx.body.items)) throw new HttpError(400, 'Format invalide');
    const items = ctx.body.items
      .map((x) => ({ n: String(x?.n ?? '').trim().slice(0, 60), kg: Math.max(0, Math.min(999, Math.round(Number(x?.kg) || 0))) }))
      .filter((x) => x.n)
      .slice(0, 40);
    saveCatalog(ctx.db, 'carry', items);
    return items;
  });

  // ---- Vehicle profile: what the app shows for this model (dimensions, weights, plan, equipment photos) ----

  router.get('/api/admin/vehicles/:id/profile', (ctx) => {
    auth(ctx);
    const vehicle = getOr404(ctx.db, 'vehicles', ctx.params.id, 'Véhicule');
    const profile = readProfile(vehicle);
    // plan: the drawing and numbered zones actually shown for this vehicle (its own, or its type's).
    const plan = vehiclePlan(profile);
    // Zone of each equipment when the vehicle does not choose one itself (depends on its type).
    const defaults = { ...profile, spotOverrides: {} };
    const defaultSpots = Object.fromEntries(
      ctx.db
        .prepare('SELECT data FROM equipment')
        .all()
        .map((r) => JSON.parse(r.data))
        .map((q) => [q.id, effectiveSpot(q, defaults, plan.spots)])
    );
    return { ...profile, plan, defaultSpots, types: TYPES };
  });

  function num(value, fallback, label) {
    if (value === undefined || value === '' || value === null) return fallback;
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${label} invalide`);
    return n;
  }

  // Layouts ("implantations") and their plans; the best ones for a few words typed in the relevé.
  router.get('/api/admin/layouts', (ctx) => {
    auth(ctx);
    return layoutList();
  });

  router.post('/api/admin/layouts/match', (ctx) => {
    contentOnly(ctx);
    const text = optStr(ctx.body.text, 500) || '';
    const type = TYPE_IDS.includes(ctx.body.type) ? ctx.body.type : null;
    const found = matchLayouts(text, type);
    const results = found.results.slice(0, 4);
    // Equipment named in the words, as it exists on the best layout's type (« garage » of a fourgon is its « soute »).
    const forType = results[0]?.type || type;
    const catalog = new Map(ctx.db.prepare('SELECT id, data FROM equipment').all().map((r) => [r.id, JSON.parse(r.data)]));
    const equipment = [...new Set(found.equipment.map((id) => (id === 'garage' && forType && !isApplicable(catalog.get(id) || {}, forType) ? 'soute' : id)))]
      .filter((id) => catalog.has(id) && isApplicable(catalog.get(id), forType))
      .map((id) => ({ id, name: catalog.get(id).name }));
    return { ...found, results, equipment };
  });

  router.put('/api/admin/vehicles/:id/profile', (ctx) => {
    contentOnly(ctx);
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
    // Zones of the plan: rebuilt field by field (an identifier, a number, a name, a position), nothing else gets through.
    if (body.spots !== undefined) {
      if (!Array.isArray(body.spots)) throw new HttpError(400, 'Format invalide');
      next.spots = body.spots.slice(0, 60).map((s) => {
        const id = String(s?.id ?? '').trim();
        const x = Number(s?.x);
        const y = Number(s?.y);
        if (!/^[a-z0-9_-]{1,30}$/i.test(id) || !Number.isFinite(x) || !Number.isFinite(y)) throw new HttpError(400, 'Zone du plan invalide');
        return { id, n: Math.max(1, Math.min(99, Math.round(Number(s.n) || 1))), x: Math.round(x), y: Math.round(y), name: optStr(s.name, 80) || id };
      });
    }
    if (body.type !== undefined) {
      if (body.type && !TYPE_IDS.includes(body.type)) throw new HttpError(400, 'Type de véhicule inconnu');
      next.type = body.type || '';
    }
    if (body.layout !== undefined) {
      const L = PLANS.layouts[body.layout];
      if (body.layout && !L) throw new HttpError(400, 'Implantation inconnue');
      next.layout = body.layout || '';
      if (L) next.type = L.type;
    }
    if (body.models !== undefined) {
      if (!body.models || typeof body.models !== 'object' || Array.isArray(body.models)) throw new HttpError(400, 'Format invalide');
      next.models = Object.fromEntries(
        Object.entries(body.models)
          .map(([k, v]) => [String(k), optStr(v, 80)])
          .filter(([, v]) => v)
      );
    }
    if (body.labels !== undefined) {
      if (!body.labels || typeof body.labels !== 'object' || Array.isArray(body.labels)) throw new HttpError(400, 'Format invalide');
      next.labels = Object.fromEntries(
        Object.entries(body.labels)
          .map(([k, v]) => [String(k), optStr(v, 120)])
          .filter(([, v]) => v)
      );
    }
    // Variants (« frigo : comp ») and zone of each equipment (« store : ext »): short identifiers only.
    for (const key of ['vars', 'spotOverrides']) {
      if (body[key] !== undefined) {
        if (!body[key] || typeof body[key] !== 'object' || Array.isArray(body[key])) throw new HttpError(400, 'Format invalide');
        const ok = (v) => typeof v === 'string' && /^[a-z0-9_-]{1,40}$/i.test(v);
        next[key] = Object.fromEntries(Object.entries(body[key]).filter(([k, v]) => ok(k) && ok(v)).slice(0, 300));
      }
    }
    if (body.plan !== undefined) next.planUrl = uploads.resolveImage(body.plan, p.planUrl);
    db.prepare("UPDATE vehicles SET profile = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(next), vehicle.id);
    bumpContentVersion(db);
    return next;
  });

  // Photo of one equipment on this vehicle ("C'est quoi, ça ?"); null removes it.
  router.put('/api/admin/vehicles/:id/photos/:equipmentId', (ctx) => {
    contentOnly(ctx);
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
        .prepare(`SELECT d.*, (SELECT COUNT(*) FROM customers c WHERE c.dealership_id = d.id) AS customer_count,
                  (SELECT COUNT(*) FROM admins a WHERE a.dealership_id = d.id) AS user_count FROM dealerships d WHERE ${s.sql} ORDER BY d.name`)
        .all(...s.args)
    );
  });

  function dealershipCode(db, value, currentId) {
    const code = normalizeCode(value);
    if (code.length < 4 || code.length > 16) throw new HttpError(400, 'Le code concession doit faire entre 4 et 16 caractères (lettres et chiffres)');
    if (db.prepare('SELECT id FROM dealerships WHERE code = ? AND id != ?').get(code, currentId ?? -1)) throw new HttpError(409, 'Ce code est déjà utilisé');
    return code;
  }

  // SAV and store contacts, detached store, usual warranty.
  function serviceFields(db, id, body, d) {
    const v = (key, col, fn) => (body[key] === undefined ? d[col] ?? null : fn(body[key]));
    const years = body.warrantyYears === undefined ? d.warranty_years ?? 2 : optInt(body.warrantyYears) ?? 2;
    if (years < 0 || years > 15) throw new HttpError(400, 'Durée de garantie invalide');
    db.prepare(
      'UPDATE dealerships SET sav_email = ?, sav_phone = ?, sav_hours = ?, store_phone = ?, store_hours = ?, store_address = ?, store_detached = ?, warranty_years = ? WHERE id = ?'
    ).run(
      v('savEmail', 'sav_email', optEmail),
      v('savPhone', 'sav_phone', (x) => optStr(x, 40)),
      v('savHours', 'sav_hours', (x) => optStr(x, 200)),
      v('storePhone', 'store_phone', (x) => optStr(x, 40)),
      v('storeHours', 'store_hours', (x) => optStr(x, 200)),
      v('storeAddress', 'store_address', (x) => optStr(x, 200)),
      body.storeDetached === undefined ? d.store_detached ?? 0 : body.storeDetached ? 1 : 0,
      years,
      id
    );
  }

  router.post('/api/admin/dealerships', (ctx) => {
    adminOnly(ctx);
    const { db, body } = ctx;
    const code = dealershipCode(db, body.code || randomCode(6));
    const { lastInsertRowid } = db
      .prepare('INSERT INTO dealerships (name, code, city, phone, email, store_email, hours, website, logo_url, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        reqStr(body.name, 'Nom de la concession', 120),
        code,
        optStr(body.city, 80),
        optStr(body.phone, 40),
        optEmail(body.email),
        optEmail(body.storeEmail),
        optStr(body.hours, 200),
        optUrl(body.website),
        ctx.uploads.resolveImage(body.logo, null),
        bool01(body.active, 1)
      );
    serviceFields(db, lastInsertRowid, body, {});
    bumpContentVersion(db);
    return camel(getOr404(db, 'dealerships', lastInsertRowid, 'Concession'));
  });

  router.put('/api/admin/dealerships/:id', (ctx) => {
    const user = managerOnly(ctx);
    const { params } = ctx;
    const db = ctx.db;
    const d = getOr404(db, 'dealerships', params.id, 'Concession');
    if (user.role !== 'admin' && d.id !== user.dealership_id) throw new HttpError(403, 'Réservé à votre concession');
    // The code and the active state stay with the administrator.
    const body = user.role === 'admin' ? ctx.body : { ...ctx.body, code: undefined, active: undefined };
    db.prepare('UPDATE dealerships SET name = ?, code = ?, city = ?, phone = ?, email = ?, store_email = ?, hours = ?, website = ?, logo_url = ?, active = ? WHERE id = ?').run(
      body.name === undefined ? d.name : reqStr(body.name, 'Nom de la concession', 120),
      body.code === undefined ? d.code : dealershipCode(db, body.code, d.id),
      pick(optStr(body.city, 80), d.city),
      pick(optStr(body.phone, 40), d.phone),
      pick(optEmail(body.email), d.email),
      body.storeEmail === undefined ? d.store_email : optEmail(body.storeEmail),
      pick(optStr(body.hours, 200), d.hours),
      pick(optUrl(body.website), d.website),
      ctx.uploads.resolveImage(body.logo, d.logo_url),
      bool01(body.active, d.active),
      d.id
    );
    serviceFields(db, d.id, body, d);
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

  const CUSTOMER_SELECT = `SELECT c.id, c.dealership_id, c.vehicle_id, c.first_name, c.last_name, c.email, c.phone, c.cell_number, c.vehicle_year, c.email_notify, c.marketing_optin, c.marketing_optin_at, v.model_year,
      c.handover_date, c.warranty_end, c.warranty_ext_end, c.cover_photo_url, c.access_code_at, c.access_expires_at, c.created_at, c.updated_at,
      d.name AS dealership_name, v.name AS vehicle_name, b.name AS brand_name, c.salesperson_id, s.name AS salesperson_name, s.email AS salesperson_email,
      (SELECT COUNT(*) FROM reports r WHERE r.customer_id = c.id AND r.status != 'resolu') AS open_reports
    FROM customers c
    LEFT JOIN admins s ON s.id = c.salesperson_id
    JOIN dealerships d ON d.id = c.dealership_id
    JOIN vehicles v ON v.id = c.vehicle_id
    JOIN brands b ON b.id = v.brand_id`;

  // A detached store is independent: it sees its own requests (with the customer's details), not the dealership's customers.
  const seesCustomers = (user) => !(user.role === 'store' && user.store_detached);
  function requireCustomers(user) {
    if (!seesCustomers(user)) throw new HttpError(403, 'Magasin détaché : les clients de la concession ne sont pas visibles');
  }

  function getCustomerScoped(ctx, id) {
    requireCustomers(ctx.user);
    const s = scope(ctx.user, 'c.dealership_id');
    const row = ctx.db.prepare(`${CUSTOMER_SELECT} WHERE c.id = ? AND ${s.sql}`).get(Number(id), ...s.args);
    if (!row) throw new HttpError(404, 'Client introuvable');
    return row;
  }

  router.get('/api/admin/customers', (ctx) => {
    const user = auth(ctx);
    requireCustomers(user);
    const s = scope(user, 'c.dealership_id');
    const q = optStr(ctx.query.get('q'), 100);
    const where = [s.sql];
    const args = [...s.args];
    if (q) {
      where.push("(c.last_name LIKE ? OR c.first_name LIKE ? OR c.email LIKE ? OR c.cell_number LIKE ?)");
      args.push(...Array(4).fill(`%${q}%`));
    }
    const dealershipId = user.role === 'admin' ? optInt(ctx.query.get('dealershipId')) : null;
    if (dealershipId) {
      where.push('c.dealership_id = ?');
      args.push(dealershipId);
    }
    if (ctx.query.get('mine') === '1') {
      where.push('c.salesperson_id = ?');
      args.push(user.id);
    }
    return ctx.db
      .prepare(`${CUSTOMER_SELECT} WHERE ${where.join(' AND ')} ORDER BY c.id DESC LIMIT 500`)
      .all(...args)
      .map((c) => ({ ...camel(c), canManage: canManage(user, c) }));
  });

  // The dealership's team, to pick or change a customer's salesperson.
  router.get('/api/admin/salespeople', (ctx) => {
    const user = auth(ctx);
    const dealershipId = user.role === 'admin' ? optInt(ctx.query.get('dealershipId')) : user.dealership_id;
    if (!dealershipId && user.role !== 'admin') return [];
    const where = dealershipId ? 'AND dealership_id = ?' : '';
    return camelAll(
      ctx.db.prepare(`SELECT id, name, email, role, dealership_id FROM admins WHERE role IN ('manager', 'sales') ${where} ORDER BY name, email`).all(...(dealershipId ? [dealershipId] : []))
    );
  });

  // Customer registered from the back-office (instead of the handover in the app): the access code is issued right away.
  router.post('/api/admin/customers', async (ctx) => {
    const user = auth(ctx);
    requireCustomers(user);
    if (!['admin', 'manager', 'dealer', 'sales'].includes(user.role)) throw new HttpError(403, 'Réservé au responsable et aux commerciaux');
    const { db, body } = ctx;
    const vehicleId = reqInt(body.vehicleId, 'Véhicule');
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
    if (!vehicle) throw new HttpError(400, 'Véhicule inconnu');
    let dealershipId = user.dealership_id;
    if (user.role === 'admin') dealershipId = reqInt(body.dealershipId, 'Concession');
    if (!dealershipId || !db.prepare('SELECT id FROM dealerships WHERE id = ?').get(dealershipId)) throw new HttpError(400, 'Concession inconnue');
    const lastName = reqStr(body.lastName, 'Nom du client', 100);
    const email = optEmail(body.email);
    if (body.sendEmail && !email) throw new HttpError(400, 'Indiquez l’e-mail du client pour lui envoyer son accès');
    // A salesperson registers their own customers; the manager (or the administrator) picks who follows them.
    const salespersonId = user.role === 'sales' ? user.id : salespersonFor(db, body.salespersonId, dealershipId) ?? (user.role === 'manager' ? user.id : null);
    const core = randomCode(8);
    const now = new Date();
    const expires = new Date(now);
    expires.setFullYear(expires.getFullYear() + 2);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO customers (dealership_id, vehicle_id, first_name, last_name, email, phone, cell_number, vehicle_year, handover_date, recovery_hash, access_code_at, access_expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        dealershipId,
        vehicleId,
        optStr(body.firstName, 100),
        lastName,
        email,
        optStr(body.phone, 40),
        optStr(body.cellNumber, 40),
        optStr(body.vehicleYear, 10),
        optStr(body.handoverDate, 10) || now.toISOString().slice(0, 10),
        sha256(core),
        now.toISOString(),
        expires.toISOString()
      );
    const accessCode = formatAccessCode(readProfile(vehicle).codePrefix, core);
    db.prepare('UPDATE customers SET access_code_enc = ?, salesperson_id = ?, warranty_end = ?, warranty_ext_end = ? WHERE id = ?').run(
      sealText(accessCode, ctx.config.secret),
      salespersonId,
      optStr(body.warrantyEnd, 10),
      optStr(body.warrantyExtEnd, 10),
      lastInsertRowid
    );
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(lastInsertRowid);
    // Single-use link that opens the app already signed in (to send by e-mail or SMS).
    const appLink = `${ctx.origin}/app/?lien=${ctx.createLoginLink(customer.id)}`;
    let emailSent = false;
    if (body.sendEmail) emailSent = await ctx.notify.welcome({ customer, code: accessCode, url: appLink });
    return { ...camel(getCustomerScoped(ctx, customer.id)), accessCode, appLink, emailSent, expiresAt: expires.toISOString().slice(0, 10) };
  });

  // Sends the current access code again (no new code): e-mail with the « Ouvrir mon application » button, or a link to copy.
  router.post('/api/admin/customers/:id/resend', async (ctx) => {
    const user = auth(ctx);
    const customer = getCustomerScoped(ctx, ctx.params.id);
    requireManage(user, customer);
    const row = ctx.db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
    const accessCode = row.access_code_enc ? openText(row.access_code_enc, ctx.config.secret) : null;
    if (!accessCode) throw new HttpError(409, 'Ce code a été créé avant que l’appli ne puisse le réafficher : générez un nouveau code d’accès.');
    const appLink = `${ctx.origin}/app/?lien=${ctx.createLoginLink(customer.id)}`;
    let emailSent = false;
    if (ctx.body.sendEmail) {
      if (!row.email) throw new HttpError(400, 'Ce client n’a pas d’e-mail');
      emailSent = await ctx.notify.welcome({ customer: row, code: accessCode, url: appLink });
    }
    return { ...camel(customer), accessCode, appLink, emailSent, sendEmail: !!ctx.body.sendEmail, expiresAt: row.access_expires_at ? row.access_expires_at.slice(0, 10) : null };
  });

  router.get('/api/admin/customers/:id', (ctx) => {
    const user = auth(ctx);
    const customer = getCustomerScoped(ctx, ctx.params.id);
    const enc = ctx.db.prepare('SELECT access_code_enc FROM customers WHERE id = ?').get(customer.id).access_code_enc;
    const mine = canManage(user, customer);
    return {
      ...camel(customer),
      canManage: mine,
      canReassign: isManager(user),
      warranty: warrantyOf(ctx.db, customer),
      // The code is shown to whoever may send it to the customer.
      accessCode: mine && enc ? openText(enc, ctx.config.secret) : null,
      ...customerStateSummary(ctx.db, customer.id),
      reports: camelAll(ctx.db.prepare('SELECT * FROM reports WHERE customer_id = ? ORDER BY id DESC').all(customer.id)),
      // Maintenance due and the logbook kept by the customer in the app.
      entretien: entretienOf(ctx.db, ctx.db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id)),
    };
  });

  router.put('/api/admin/customers/:id', (ctx) => {
    const user = auth(ctx);
    const { db, body } = ctx;
    const customer = getCustomerScoped(ctx, ctx.params.id);
    requireManage(user, customer);
    const vehicleId = pick(optInt(body.vehicleId), customer.vehicle_id);
    if (!db.prepare('SELECT id FROM vehicles WHERE id = ?').get(vehicleId)) throw new HttpError(400, 'Véhicule inconnu');
    let dealershipId = customer.dealership_id;
    if (user.role === 'admin' && body.dealershipId !== undefined) {
      dealershipId = reqInt(body.dealershipId, 'Concession');
      if (!db.prepare('SELECT id FROM dealerships WHERE id = ?').get(dealershipId)) throw new HttpError(400, 'Concession inconnue');
    }
    db.prepare(
      `UPDATE customers SET vehicle_id = ?, dealership_id = ?, first_name = ?, last_name = ?, email = ?, phone = ?, cell_number = ?, vehicle_year = ?,
       handover_date = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      vehicleId,
      dealershipId,
      pick(optStr(body.firstName, 100), customer.first_name),
      body.lastName === undefined ? customer.last_name : reqStr(body.lastName, 'Nom', 100),
      pick(optEmail(body.email), customer.email),
      pick(optStr(body.phone, 40), customer.phone),
      body.cellNumber === undefined ? customer.cell_number : optStr(body.cellNumber, 40),
      body.vehicleYear === undefined ? customer.vehicle_year : optStr(body.vehicleYear, 10),
      pick(optStr(body.handoverDate, 10), customer.handover_date),
      customer.id
    );
    if (body.warrantyEnd !== undefined) db.prepare('UPDATE customers SET warranty_end = ? WHERE id = ?').run(optStr(body.warrantyEnd, 10), customer.id);
    if (body.warrantyExtEnd !== undefined) db.prepare('UPDATE customers SET warranty_ext_end = ? WHERE id = ?').run(optStr(body.warrantyExtEnd, 10), customer.id);
    // Only the manager (or the administrator) moves a customer from one salesperson to another.
    if (body.salespersonId !== undefined && Number(body.salespersonId || 0) !== (customer.salesperson_id || 0)) {
      if (!isManager(user)) throw new HttpError(403, 'Seul le responsable de la concession peut changer le commercial d’un client');
      db.prepare('UPDATE customers SET salesperson_id = ? WHERE id = ?').run(salespersonFor(db, body.salespersonId, dealershipId), customer.id);
    }
    return camel(getCustomerScoped(ctx, customer.id));
  });

  // Issues a new recovery code (e.g. the customer lost theirs) and signs out their devices.
  // Issues a new access code (lost code, renewal) valid 2 years; phones already signed in stay signed in.
  // Lost or stolen phone: every session of the customer ends.
  router.post('/api/admin/customers/:id/signout', (ctx) => {
    const user = auth(ctx);
    const customer = getCustomerScoped(ctx, ctx.params.id);
    requireManage(user, customer);
    return { sessions: Number(ctx.db.prepare('DELETE FROM customer_sessions WHERE customer_id = ?').run(customer.id).changes) };
  });

  router.post('/api/admin/customers/:id/recovery-code', async (ctx) => {
    const user = auth(ctx);
    const customer = getCustomerScoped(ctx, ctx.params.id);
    requireManage(user, customer);
    const core = randomCode(8);
    const now = new Date();
    const expires = new Date(now);
    expires.setFullYear(expires.getFullYear() + 2);
    ctx.db
      .prepare('UPDATE customers SET recovery_hash = ?, access_code_at = ?, access_expires_at = ? WHERE id = ?')
      .run(sha256(core), now.toISOString(), expires.toISOString(), customer.id);
    const vehicle = ctx.db.prepare('SELECT * FROM vehicles WHERE id = ?').get(customer.vehicle_id);
    const recoveryCode = formatAccessCode(vehicle ? readProfile(vehicle).codePrefix : 'CDB', core);
    ctx.db.prepare('UPDATE customers SET access_code_enc = ? WHERE id = ?').run(sealText(recoveryCode, ctx.config.secret), customer.id);
    const appLink = `${ctx.origin}/app/?lien=${ctx.createLoginLink(customer.id)}`;
    let emailSent = false;
    if (ctx.body.sendEmail) {
      if (!customer.email) throw new HttpError(400, 'Ce client n’a pas d’e-mail');
      emailSent = await ctx.notify.welcome({ customer: ctx.db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id), code: recoveryCode, url: appLink });
    }
    return { recoveryCode, accessCode: recoveryCode, appLink, emailSent, expiresAt: expires.toISOString().slice(0, 10) };
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
    if (user.role === 'sales') throw new HttpError(403, 'Les demandes sont traitées par le SAV et le magasin');
    const s = reportScope(user);
    const status = ctx.query.get('status');
    const where = [s.sql];
    const args = [...s.args];
    if (status && STATUSES.includes(status)) {
      where.push('r.status = ?');
      args.push(status);
    }
    if (ctx.query.get('kind') === 'piece') where.push("r.kind = 'piece'");
    if (SERVICES[ctx.query.get('service')]) {
      where.push('r.service = ?');
      args.push(ctx.query.get('service'));
    }
    if (ctx.query.get('mine') === '1') {
      where.push('c.salesperson_id = ?');
      args.push(user.id);
    }
    if (ctx.query.get('overdue') === '1') where.push(OVERDUE_SQL);
    const list = camelAll(
      ctx.db
        .prepare(
          `SELECT r.*, c.first_name, c.last_name, c.phone, c.email, c.cell_number, c.salesperson_id, c.dealership_id AS customer_dealership_id, s.name AS salesperson_name,
             c.handover_date, c.warranty_end, c.warranty_ext_end, c.vehicle_year, v.model_year, d.name AS dealership_name, v.name AS vehicle_name, b.name AS brand_name,
             p.title AS problem_title, ${WAITING_SINCE} AS waiting_since, CASE WHEN ${OVERDUE_SQL} THEN 1 ELSE 0 END AS overdue
           FROM reports r
           JOIN customers c ON c.id = r.customer_id
           JOIN dealerships d ON d.id = c.dealership_id
           JOIN vehicles v ON v.id = c.vehicle_id
           JOIN brands b ON b.id = v.brand_id
           LEFT JOIN admins s ON s.id = c.salesperson_id
           LEFT JOIN problems p ON p.id = r.problem_id
           WHERE ${where.join(' AND ')} ORDER BY r.updated_at DESC, r.id DESC LIMIT 500`
        )
        .all(...args)
    );
    const ids = list.map((r) => r.id);
    const msgs = ids.length ? camelAll(ctx.db.prepare(`SELECT * FROM report_messages WHERE report_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).all(...ids)) : [];
    for (const r of list) {
      r.messages = msgs.filter((m) => m.reportId === r.id);
      r.part = r.part ? JSON.parse(r.part) : null;
      r.canManage = canAnswer(user, r);
      r.warranty = warrantyOf(ctx.db, { dealership_id: r.customerDealershipId, handover_date: r.handoverDate, warranty_end: r.warrantyEnd, warranty_ext_end: r.warrantyExtEnd });
      // The customer wrote last: the dealership owes an answer.
      r.waitingForDealer = r.status !== 'resolu' && (r.messages.length ? r.messages[r.messages.length - 1].author === 'client' : r.status === 'nouveau');
    }
    return list;
  });

  router.put('/api/admin/reports/:id', (ctx) => {
    const user = auth(ctx);
    const { db, body } = ctx;
    const s = reportScope(user);
    const report = db
      .prepare(`SELECT r.*, c.dealership_id, c.salesperson_id FROM reports r JOIN customers c ON c.id = r.customer_id JOIN dealerships d ON d.id = c.dealership_id WHERE r.id = ? AND ${s.sql}`)
      .get(Number(ctx.params.id), ...s.args);
    if (!report) throw new HttpError(404, 'Demande introuvable');
    // Sent to the other service (SAV ↔ store), with the reason: that service is told and handles it from now on.
    if (body.service !== undefined && body.service !== report.service) {
      if (!SERVICES[body.service]) throw new HttpError(400, 'Service inconnu');
      if (!canAnswer(user, report)) throw new HttpError(403, 'Cette demande est traitée par un autre service');
      const note = reqStr(body.transferNote, 'Motif du transfert', 300);
      db.prepare("UPDATE reports SET service = ?, transfer_note = ?, updated_at = datetime('now') WHERE id = ?").run(body.service, `${SERVICES[report.service || 'sav']} → ${SERVICES[body.service]} : ${note}`, report.id);
      const moved = db.prepare('SELECT * FROM reports WHERE id = ?').get(report.id);
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(report.customer_id);
      ctx.notify.customerWrote({ report: moved, customer, text: `Demande transférée par le ${SERVICES[report.service || 'sav']} : ${note}\n\n${report.description || ''}`, origin: ctx.origin, isNew: true, part: moved.part ? JSON.parse(moved.part) : null }).catch(() => {});
      return camel(moved);
    }
    if (!canAnswer(user, report)) throw new HttpError(403, 'Cette demande est traitée par un autre service');
    const status = pick(optStr(body.status, 20), report.status);
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Statut invalide');
    // A reply is a new message in the conversation; the customer is notified.
    const reply = optStr(body.dealerReply ?? body.message, 4000);
    if (reply) db.prepare("INSERT INTO report_messages (report_id, author, body) VALUES (?, 'concession', ?)").run(report.id, reply);
    // Closing stamps the date shown to the customer; reopening ("En cours") clears it.
    const closedAt = status === 'resolu' ? report.closed_at || new Date().toISOString().replace('T', ' ').slice(0, 19) : null;
    db.prepare("UPDATE reports SET status = ?, dealer_reply = ?, closed_at = ?, updated_at = datetime('now') WHERE id = ?").run(status, reply || report.dealer_reply, closedAt, report.id);
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

  // ---- Team: the administrator manages everyone, a manager the team of their dealership ----

  const USER_SELECT = `SELECT a.id, a.email, a.name, a.phone, a.role, a.dealership_id, a.dealership_ids, a.created_at, d.name AS dealership_name,
      (SELECT COUNT(*) FROM customers c WHERE c.salesperson_id = a.id) AS customer_count
    FROM admins a LEFT JOIN dealerships d ON d.id = a.dealership_id`;

  router.get('/api/admin/users', (ctx) => {
    const me = managerOnly(ctx);
    const rows = me.role === 'admin'
      ? ctx.db.prepare(`${USER_SELECT} ORDER BY d.name, a.name, a.email`).all()
      : ctx.db.prepare(`${USER_SELECT} WHERE a.dealership_id = ? AND a.role != 'admin' ORDER BY a.name, a.email`).all(me.dealership_id);
    return rows.map(userOut);
  });

  function userFields(db, me, body, current = {}) {
    let role = pick(optStr(body.role, 10), current.role ?? 'sales');
    if (role === 'dealer') role = 'manager';
    if (!ROLES.includes(role)) throw new HttpError(400, 'Rôle invalide');
    const global = role === 'admin' || role === 'editor' || role === 'analytics';
    if (me.role !== 'admin' && global) throw new HttpError(403, 'Seul un administrateur peut créer ce compte');
    // A manager's team always belongs to their dealership; the administrator and content editors belong to none.
    const dealershipId = global ? null : me.role === 'admin' ? pick(optInt(body.dealershipId), current.dealership_id ?? null) : me.dealership_id;
    if (!global && (!dealershipId || !db.prepare('SELECT id FROM dealerships WHERE id = ?').get(dealershipId))) {
      throw new HttpError(400, 'Un compte de concession doit être rattaché à une concession');
    }
    // An analyst can follow only some dealerships (a group of dealers); none = all of them.
    let dealershipIds = null;
    if (role === 'analytics') {
      const ids = body.dealershipIds === undefined ? followedIds(current) || [] : Array.isArray(body.dealershipIds) ? body.dealershipIds : [];
      const known = ids.map(Number).filter((id) => Number.isInteger(id) && db.prepare('SELECT id FROM dealerships WHERE id = ?').get(id));
      dealershipIds = known.length ? JSON.stringify([...new Set(known)]) : null;
    }
    return { role, dealershipId, dealershipIds, name: pick(optStr(body.name, 100), current.name ?? null), phone: body.phone === undefined ? current.phone ?? null : optStr(body.phone, 40) };
  }

  // Dealerships followed by an analyst (null: all).
  function followedIds(user) {
    try {
      const ids = JSON.parse(user?.dealership_ids || 'null');
      return Array.isArray(ids) && ids.length ? ids : null;
    } catch {
      return null;
    }
  }
  const userOut = (row) => {
    const { dealershipIds, ...rest } = camel(row);
    return { ...rest, dealershipIds: followedIds(row) || [] };
  };

  function teamMember(ctx, me, id) {
    const user = getOr404(ctx.db, 'admins', id, 'Utilisateur');
    if (me.role !== 'admin' && (['admin', 'editor', 'analytics'].includes(user.role) || user.dealership_id !== me.dealership_id)) throw new HttpError(404, 'Utilisateur introuvable');
    return user;
  }

  function checkPassword(password) {
    if (String(password || '').length < 8) throw new HttpError(400, 'Mot de passe : 8 caractères minimum');
    return String(password);
  }

  router.post('/api/admin/users', (ctx) => {
    const me = managerOnly(ctx);
    const { db, body } = ctx;
    const email = optEmail(body.email);
    if (!email) throw new HttpError(400, 'E-mail obligatoire');
    if (db.prepare('SELECT id FROM admins WHERE email = ?').get(email)) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail');
    const f = userFields(db, me, body);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO admins (email, name, phone, password_hash, role, dealership_id, dealership_ids) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(email, f.name, f.phone, hashPassword(checkPassword(body.password)), f.role, f.dealershipId, f.dealershipIds);
    return userOut(db.prepare(`${USER_SELECT} WHERE a.id = ?`).get(lastInsertRowid));
  });

  router.put('/api/admin/users/:id', (ctx) => {
    const me = managerOnly(ctx);
    const { db, body } = ctx;
    const user = teamMember(ctx, me, ctx.params.id);
    const f = userFields(db, me, body, user);
    if (user.id === me.id && f.role !== me.role) throw new HttpError(400, 'Vous ne pouvez pas changer votre propre rôle');
    const email = pick(optEmail(body.email), user.email);
    if (db.prepare('SELECT id FROM admins WHERE email = ? AND id != ?').get(email, user.id)) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail');
    const hash = body.password ? hashPassword(checkPassword(body.password)) : user.password_hash;
    db.prepare('UPDATE admins SET email = ?, name = ?, phone = ?, role = ?, dealership_id = ?, dealership_ids = ?, password_hash = ?, token_version = token_version + ? WHERE id = ?').run(email, f.name, f.phone, f.role, f.dealershipId, f.dealershipIds, hash, body.password ? 1 : 0, user.id);
    // Moved to another dealership: their customers stay where they are, without a salesperson.
    if (f.dealershipId !== user.dealership_id) db.prepare('UPDATE customers SET salesperson_id = NULL WHERE salesperson_id = ? AND dealership_id != ?').run(user.id, f.dealershipId ?? -1);
    return userOut(db.prepare(`${USER_SELECT} WHERE a.id = ?`).get(user.id));
  });

  // Hands all the customers of one salesperson to another (holidays, departure…).
  router.post('/api/admin/users/:id/transfer', (ctx) => {
    const me = managerOnly(ctx);
    const from = teamMember(ctx, me, ctx.params.id);
    const to = ctx.body.toUserId ? teamMember(ctx, me, ctx.body.toUserId) : null;
    if (to && (!['manager', 'dealer', 'sales'].includes(to.role) || to.dealership_id !== from.dealership_id)) throw new HttpError(400, 'Choisissez un commercial ou le responsable de la même concession');
    const { changes } = ctx.db.prepare('UPDATE customers SET salesperson_id = ? WHERE salesperson_id = ?').run(to ? to.id : null, from.id);
    return { moved: Number(changes) };
  });

  router.delete('/api/admin/users/:id', (ctx) => {
    const me = managerOnly(ctx);
    const user = teamMember(ctx, me, ctx.params.id);
    if (user.id === me.id) throw new HttpError(400, 'Vous ne pouvez pas supprimer votre propre compte');
    const n = ctx.db.prepare('SELECT COUNT(*) AS n FROM customers WHERE salesperson_id = ?').get(user.id).n;
    if (n && !ctx.query.get('force')) throw new HttpError(409, `${n} client(s) sont suivis par ce compte : transférez-les d’abord à un autre commercial.`);
    ctx.db.prepare('UPDATE customers SET salesperson_id = NULL WHERE salesperson_id = ?').run(user.id);
    ctx.db.prepare('DELETE FROM admins WHERE id = ?').run(user.id);
    return { ok: true };
  });

  // Any signed-in user can change their own password.
  router.put('/api/admin/password', (ctx) => {
    const me = auth(ctx);
    const row = ctx.db.prepare('SELECT password_hash FROM admins WHERE id = ?').get(me.id);
    if (!verifyPassword(ctx.body.currentPassword || '', row.password_hash)) throw new HttpError(400, 'Mot de passe actuel incorrect');
    ctx.db.prepare('UPDATE admins SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').run(hashPassword(checkPassword(ctx.body.newPassword)), me.id);
    // A new session for this device; the others are signed out.
    const fresh = ctx.db.prepare('SELECT token_version FROM admins WHERE id = ?').get(me.id);
    return { ok: true, token: signToken({ sub: me.id, role: me.role, tv: fresh.token_version }, ctx.config.secret, 60 * 60 * 12) };
  });
}

module.exports = { register };
