'use strict';

const crypto = require('node:crypto');

const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(String(password), salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

// Human-friendly code without ambiguous characters (0/O, 1/I/L).
function randomCode(length = 8) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Stateless signed token for back-office users: base64url(payload).hmac
function signToken(payload, secret, ttlSeconds = 60 * 60 * 12) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token, secret) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

// Fixed-window limiter kept in memory; enough for a single instance.
function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  return function isLimited(key) {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      if (hits.size > 10000) {
        for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
      }
      return false;
    }
    entry.count += 1;
    return entry.count > max;
  };
}

// Reversible encryption (AES-256-GCM) of short secrets the dealership must be able to read again (the customer's access code).
function sealText(text, secret) {
  const key = crypto.createHash('sha256').update(`access-code:${secret}`).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

function openText(sealed, secret) {
  try {
    const [iv, tag, data] = String(sealed || '').split('.').map((p) => Buffer.from(p, 'base64url'));
    const key = crypto.createHash('sha256').update(`access-code:${secret}`).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

module.exports = {
  sealText,
  openText,
  hashPassword,
  verifyPassword,
  sha256,
  randomToken,
  randomCode,
  normalizeCode,
  signToken,
  verifyToken,
  createRateLimiter,
};
