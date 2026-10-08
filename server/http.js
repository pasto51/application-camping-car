'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Minimal router: add(method, '/api/things/:id', handler). Handlers receive ctx and return data to send as JSON.
function createRouter() {
  const routes = [];

  function add(method, pattern, ...handlers) {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern.replace(/\/:([a-zA-Z]+)/g, (_, key) => {
        keys.push(key);
        return '/([^/]+)';
      }) + '/?$'
    );
    routes.push({ method, regex, keys, handlers });
  }

  function match(method, pathname) {
    let pathMatched = false;
    for (const route of routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params = {};
      route.keys.forEach((key, i) => (params[key] = decodeURIComponent(m[i + 1])));
      return { route, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }

  return {
    get: (p, ...h) => add('GET', p, ...h),
    post: (p, ...h) => add('POST', p, ...h),
    put: (p, ...h) => add('PUT', p, ...h),
    patch: (p, ...h) => add('PATCH', p, ...h),
    delete: (p, ...h) => add('DELETE', p, ...h),
    match,
  };
}

function readJsonBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new HttpError(413, 'Requête trop volumineuse'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'JSON invalide'));
      }
    });
    req.on('error', reject);
  });
}

// Large answers (the app catalogue is about 1 MB) are compressed when the client accepts it.
function sendJson(res, status, data, req) {
  let body = Buffer.from(JSON.stringify(data));
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Accept-Encoding' };
  if (body.length > 2048 && req && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    body = zlib.gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(body);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

// Serves a file from root, refusing paths that escape it. Returns false if not found.
function serveStatic(req, res, root, relPath, { cacheControl = 'no-cache', transform } = {}) {
  const filePath = path.resolve(root, '.' + path.posix.normalize('/' + relPath));
  if (!filePath.startsWith(path.resolve(root) + path.sep)) return false;
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Cache-Control': cacheControl, 'X-Content-Type-Options': 'nosniff' };
  if (transform) {
    const body = transform(fs.readFileSync(filePath, 'utf8'));
    res.writeHead(200, { ...headers, 'Content-Length': Buffer.byteLength(body) });
    res.end(req.method === 'HEAD' ? undefined : body);
    return true;
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  if (req.method === 'HEAD') res.end();
  else {
    // The file can disappear between stat and read (photo replaced meanwhile): never leave the response hanging.
    fs.createReadStream(filePath)
      .on('error', () => res.destroy())
      .pipe(res);
  }
  return true;
}

module.exports = { HttpError, createRouter, readJsonBody, sendJson, serveStatic };
