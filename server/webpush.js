'use strict';

// Web Push without dependency: VAPID authentication (RFC 8292) and aes128gcm payload encryption (RFC 8291).

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const b64u = (buf) => Buffer.from(buf).toString('base64url');

// The server's VAPID key pair is created once and kept in the data directory.
function loadVapidKeys(dataDir) {
  const file = path.join(dataDir, 'vapid.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    const keys = { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
    return keys;
  }
}

function privateKeyObject(keys) {
  const pub = Buffer.from(keys.publicKey, 'base64url');
  return crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: keys.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: 'jwk',
  });
}

// One hour of validity: Apple refuses longer tokens.
function vapidHeader(endpoint, keys, subject) {
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key: privateKeyObject(keys), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${keys.publicKey}`;
}

// Encrypts the payload for one subscription (keys.p256dh, keys.auth given by the browser).
function encrypt(payload, subscription) {
  const uaPublic = Buffer.from(subscription.keys.p256dh, 'base64url');
  const authSecret = Buffer.from(subscription.keys.auth, 'base64url');
  const ecdh = crypto.createECDH('prime256v1');
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

// Sends a notification; resolves with the push service HTTP status (404/410 = subscription gone).
async function sendPush(subscription, payload, keys, subject) {
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      TTL: '86400',
      Urgency: 'normal',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: vapidHeader(subscription.endpoint, keys, subject),
    },
    body: encrypt(JSON.stringify(payload), subscription),
  });
  return res.status;
}

module.exports = { loadVapidKeys, sendPush, encrypt, vapidHeader };
