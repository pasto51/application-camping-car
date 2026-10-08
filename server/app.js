'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { openDatabase } = require('./db');
const { createUploadStore } = require('./uploads');
const { HttpError, createRouter, readJsonBody, sendJson, serveStatic } = require('./http');
const { seed } = require('./seed');
const { seedCatalog, ensureEquipmentPresets } = require('./catalog');
const { applyContentPatches } = require('./content-patches');
const { loadVapidKeys } = require('./webpush');
const { createNotifier } = require('./notify');
const { randomToken, sha256 } = require('./auth');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const BODY_LIMIT = 40 * 1024 * 1024; // report with several photos as data URLs

// Hash of the front-end files: it changes on each deploy, which makes the service worker update the installed app.
function computeAppVersion() {
  const hash = crypto.createHash('sha256');
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else hash.update(entry.name).update(fs.readFileSync(full));
    }
  };
  walk(PUBLIC_DIR);
  return hash.digest('hex').slice(0, 12);
}

function createApp(options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const config = {
    secret: options.secret || process.env.SECRET || loadOrCreateSecret(dataDir),
    appVersion: computeAppVersion(),
    // Test mode: back-office opens without a password while the file data/acces-libre exists (or ACCES_LIBRE=1).
    dataDir,
    isOpenAccess: () => (options.openAccess ?? process.env.ACCES_LIBRE === '1') || fs.existsSync(path.join(dataDir, 'acces-libre')),
  };
  const db = options.db || openDatabase(options.dbFile || path.join(dataDir, 'app.db'));
  const uploads = createUploadStore(path.join(dataDir, 'uploads'));
  const log = options.log || console.log;

  seed(db, { adminEmail: options.adminEmail ?? process.env.ADMIN_EMAIL, adminPassword: options.adminPassword ?? process.env.ADMIN_PASSWORD, log });
  seedCatalog(db, uploads, log);
  ensureEquipmentPresets(db);
  applyContentPatches(db, log);
  config.vapid = loadVapidKeys(dataDir);
  const LINK_DAYS = 14;
  const createLoginLink = (customerId) => {
    const token = randomToken(24);
    db.prepare("DELETE FROM login_links WHERE expires_at < datetime('now')").run();
    db.prepare(`INSERT INTO login_links (token_hash, customer_id, expires_at) VALUES (?, ?, datetime('now', '+${LINK_DAYS} days'))`).run(sha256(token), customerId);
    return token;
  };
  const notify = options.notify || createNotifier({ db, vapid: config.vapid, log, createLoginLink });

  const router = createRouter();
  publicRoutes.register(router);
  adminRoutes.register(router);

  async function handleApi(req, res, url) {
    const found = router.match(req.method, url.pathname);
    if (!found) throw new HttpError(404, 'Route inconnue');
    if (found.methodNotAllowed) throw new HttpError(405, 'Méthode non autorisée');
    const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readJsonBody(req, BODY_LIMIT) : {};
    const ctx = {
      req,
      res,
      db,
      config,
      uploads,
      body: body && typeof body === 'object' ? body : {},
      params: found.route ? found.params : {},
      query: url.searchParams,
      ip: req.socket.remoteAddress || 'unknown',
      notify,
      createLoginLink,
      // Public address of the site, for links in e-mails (the host may sit behind an HTTPS proxy).
      origin: `${String(req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http')).split(',')[0]}://${String(req.headers['x-forwarded-host'] || req.headers.host).split(',')[0]}`,
    };
    let result;
    for (const handler of found.route.handlers) result = await handler(ctx);
    // A handler that sent a file itself (e.g. a backup to download) has already answered.
    if (res.headersSent) return;
    sendJson(res, 200, result ?? { ok: true }, req);
  }

  function handleStatic(req, res, url) {
    const p = url.pathname;
    if (p === '/') {
      res.writeHead(302, { Location: '/app/' });
      return res.end();
    }
    if (p === '/admin' || p === '/admin/releve' || p === '/releve' || p === '/releve/') {
      res.writeHead(302, { Location: p.includes('releve') ? '/admin/releve/' : '/admin/' });
      return res.end();
    }
    if (p.startsWith('/uploads/')) {
      if (serveStatic(req, res, uploads.dir, p.slice('/uploads/'.length), { cacheControl: 'public, max-age=31536000, immutable' })) return;
    } else if (p === '/app/sw.js') {
      // Injected version so that each deploy produces a new service worker.
      if (serveStatic(req, res, PUBLIC_DIR, 'app/sw.js', { transform: (s) => s.replaceAll('__APP_VERSION__', config.appVersion) })) return;
    } else {
      const rel = p.endsWith('/') ? p + 'index.html' : p;
      if (serveStatic(req, res, PUBLIC_DIR, rel)) return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Introuvable');
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    try {
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else if (req.method === 'GET' || req.method === 'HEAD') handleStatic(req, res, url);
      else throw new HttpError(405, 'Méthode non autorisée');
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) log('[error]', err);
      if (!res.headersSent) sendJson(res, status, { error: status === 500 ? 'Erreur interne du serveur' : err.message });
      else res.end();
    }
  });

  return { server, db, config, notify, uploads, log };
}

// Without a SECRET env var, a random one is kept in the data directory so sessions survive restarts.
function loadOrCreateSecret(dataDir) {
  const file = path.join(dataDir, 'secret.key');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    fs.mkdirSync(dataDir, { recursive: true });
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

module.exports = { createApp };
