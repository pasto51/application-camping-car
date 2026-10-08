'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const crypto = require('node:crypto');
const { createApp } = require('../server/app');
const { encrypt, vapidHeader, loadVapidKeys } = require('../server/webpush');

// Fake SMTP server: records every message it receives.
function fakeSmtp() {
  const mails = [];
  const server = net.createServer((sock) => {
    let data = null, auth = 0, mail = { rcpt: [] };
    sock.write('220 fake ESMTP\r\n');
    sock.setEncoding('utf8');
    let buf = '';
    sock.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (data !== null) {
          if (line === '.') { mails.push({ ...mail, data }); data = null; mail = { rcpt: [] }; sock.write('250 OK queued\r\n'); }
          else data += line + '\n';
          continue;
        }
        if (auth === 1) { mail.user = Buffer.from(line, 'base64').toString(); auth = 2; sock.write('334 UGFzc3dvcmQ6\r\n'); continue; }
        if (auth === 2) { mail.pass = Buffer.from(line, 'base64').toString(); auth = 0; sock.write('235 OK\r\n'); continue; }
        if (/^EHLO/.test(line)) sock.write('250-fake\r\n250 AUTH LOGIN\r\n');
        else if (line === 'AUTH LOGIN') { auth = 1; sock.write('334 VXNlcm5hbWU6\r\n'); }
        else if (/^MAIL FROM/.test(line)) { mail.from = line; sock.write('250 OK\r\n'); }
        else if (/^RCPT TO/.test(line)) { mail.rcpt.push(line.match(/<(.+)>/)[1]); sock.write('250 OK\r\n'); }
        else if (line === 'DATA') { data = ''; sock.write('354 go\r\n'); }
        else if (line === 'QUIT') { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('250 OK\r\n');
      }
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, mails, port: server.address().port })));
}

const subject = (m) => Buffer.from((m.data.match(/^Subject: =\?UTF-8\?B\?(.+)\?=$/m) || [])[1] || '', 'base64').toString();
// Text of the e-mail (the text/plain part when the message also has an HTML version).
const bodyText = (m) => {
  const part = m.data.includes('multipart/alternative') ? m.data.split(/--cdb-[0-9a-f]+/).find((x) => x.includes('text/plain')) : m.data;
  return Buffer.from(part.split('\n\n').slice(1).join('').replace(/\s/g, ''), 'base64').toString();
};
const waitFor = async (fn, ms = 3000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('délai dépassé'); await new Promise((r) => setTimeout(r, 20)); } };

let app, base, dataDir, smtp;
const pushes = [];
const realFetch = globalThis.fetch;

async function call(method, url, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await realFetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
}

before(async () => {
  smtp = await fakeSmtp();
  // Push services are reached with fetch: requests to the test push service are recorded instead.
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith('https://push.test/')) { pushes.push({ url: String(url), opts }); return new Response(null, { status: 201 }); }
    return realFetch(url, opts);
  };
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-notify-'));
  app = createApp({ dataDir, secret: 's', adminEmail: 'admin@test.fr', adminPassword: 'motdepasse123', log: () => {} });
  await new Promise((r) => app.server.listen(0, r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});

after(() => {
  globalThis.fetch = realFetch;
  app.server.closeAllConnections();
  app.server.close();
  app.db.close();
  smtp.server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('push payload is encrypted for the phone and signed by the server (RFC 8291 / 8292)', () => {
  const ua = crypto.createECDH('prime256v1');
  ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const sub = { endpoint: 'https://push.test/abc', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } };
  const body = encrypt('{"title":"Bonjour"}', sub);
  // Decrypt as the browser would
  const salt = body.subarray(0, 16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const shared = ua.computeSecret(asPublic);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert.equal(plain.subarray(0, -1).toString(), '{"title":"Bonjour"}');
  assert.equal(plain[plain.length - 1], 2);

  const keys = loadVapidKeys(dataDir);
  const h = vapidHeader(sub.endpoint, keys, 'mailto:test@test.fr');
  const [, jwt, k] = h.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, keys.publicKey);
  const [hd, cl, sig] = jwt.split('.');
  assert.equal(JSON.parse(Buffer.from(cl, 'base64url')).aud, 'https://push.test');
  const pub = Buffer.from(keys.publicKey, 'base64url');
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(`${hd}.${cl}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')));
});

test('conversation: dealership is e-mailed, customer gets push + e-mail, website reaches the app', async () => {
  const admin = (await call('POST', '/api/admin/login', { body: { email: 'admin@test.fr', password: 'motdepasse123' } })).data.token;
  // E-mail server and the dealership's address and website
  const set = await call('PUT', '/api/admin/settings', { token: admin, body: { mail: { host: '127.0.0.1', port: smtp.port, user: 'contact@test.fr', pass: 'secret', from: 'Compagnon <contact@test.fr>' } } });
  assert.equal(set.data.mail.ready, true);
  assert.equal(set.data.mail.passwordSet, true);
  assert.equal(set.data.mail.pass, undefined, 'password never sent back');
  assert.equal((await call('PUT', '/api/admin/dealerships/1', { token: admin, body: { email: 'atelier@concession.fr', website: 'www.concession.fr' } })).status, 200);
  assert.equal((await call('PUT', '/api/admin/dealerships/1', { token: admin, body: { website: 'javascript:alert(1)' } })).status, 400);

  const { data: catalog } = await call('GET', '/api/catalog');
  const h = await call('POST', '/api/handover', { body: { dealershipCode: 'DEMO2026', vehicleId: catalog.vehicles[0].id, customer: { firstName: 'Paul', lastName: 'Morel', email: 'paul@client.fr' } } });
  const token = h.data.token;
  const data = (await call('GET', '/api/app/data', { token })).data;
  assert.equal(data.dealer.website, 'https://www.concession.fr/');

  // Test e-mail from the back-office
  assert.equal((await call('POST', '/api/admin/settings/test-email', { token: admin, body: { to: 'moi@test.fr' } })).status, 200);
  await waitFor(() => smtp.mails.length === 1);
  assert.deepEqual(smtp.mails[0].rcpt, ['moi@test.fr']);
  assert.equal(smtp.mails[0].user, 'contact@test.fr');

  // The customer accepts notifications on their phone
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const sub = { endpoint: 'https://push.test/phone-1', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
  assert.equal((await call('POST', '/api/me/push', { token, body: { subscription: sub } })).status, 200);
  assert.ok((await call('GET', '/api/push/key')).data.publicKey);

  // New request -> e-mail to the dealership
  const req = (await call('POST', '/api/me/requests', { token, body: { title: 'Test d’étanchéité', message: 'Bonjour, quand puis-je venir ?' } })).data;
  await waitFor(() => smtp.mails.length === 2);
  assert.deepEqual(smtp.mails[1].rcpt, ['atelier@concession.fr']);
  assert.match(subject(smtp.mails[1]), /Nouvelle demande : Test d’étanchéité – Paul Morel/);
  assert.match(bodyText(smtp.mails[1]), /quand puis-je venir/);

  // Dealership answers -> push to the phone + e-mail to the customer
  await call('PUT', `/api/admin/reports/${req.id}`, { token: admin, body: { status: 'en_cours', message: 'Mardi 9 h, ça vous va ?' } });
  await waitFor(() => pushes.length === 1 && smtp.mails.length === 3);
  assert.equal(pushes[0].url, 'https://push.test/phone-1');
  assert.equal(pushes[0].opts.headers['Content-Encoding'], 'aes128gcm');
  assert.match(pushes[0].opts.headers.Authorization, /^vapid t=/);
  assert.deepEqual(smtp.mails[2].rcpt, ['paul@client.fr']);
  // Branded for the dealership, replies go to the dealership, a big button signs the customer in
  const m = smtp.mails[2].data;
  assert.match(m, /^From: =\?UTF-8\?B\?.+\?= <contact@test\.fr>$/m);
  assert.equal(Buffer.from(m.match(/^From: =\?UTF-8\?B\?(.+)\?=/m)[1], 'base64').toString(), 'Concession de démonstration · SAV via Compagnon de bord');
  assert.match(m, /^Reply-To: atelier@concession\.fr$/m);
  assert.match(m, /^Auto-Submitted: auto-generated$/m);
  const parts = m.split(/--cdb-[0-9a-f]+/);
  const html = Buffer.from(parts.find((x) => x.includes('text/html')).split('\n\n').slice(1).join('').replace(/\s/g, ''), 'base64').toString();
  assert.match(html, /Consulter la réponse dans mon application/);
  const link = html.match(/href="([^"]*\?lien=[^"]+)"/)[1].replace(/&amp;/g, '&');
  assert.match(link, new RegExp(`#demande-${req.id}$`));
  const linkToken = new URL(link).searchParams.get('lien');
  const signed = await call('POST', '/api/link', { body: { token: linkToken } });
  assert.equal(signed.status, 200);
  assert.equal(signed.data.customer.lastName, 'Morel');
  assert.equal((await call('POST', '/api/link', { body: { token: linkToken } })).status, 410, 'single use');
  // The dealership's e-mail has its own button, and replies from the mailbox go to the customer
  assert.match(smtp.mails[1].data, /^Reply-To: paul@client\.fr$/m);

  // Customer replies in the conversation -> dealership e-mailed again, request back to "à répondre"
  const after = (await call('POST', `/api/me/requests/${req.id}/messages`, { token, body: { body: 'Parfait, à mardi.' } })).data;
  assert.deepEqual(after.messages.map((m) => m.author), ['concession', 'client']);
  await waitFor(() => smtp.mails.length === 4);
  assert.match(subject(smtp.mails[3]), /Nouveau message/);
  const list = (await call('GET', '/api/admin/reports', { token: admin })).data;
  assert.equal(list.find((r) => r.id === req.id).waitingForDealer, true);
  assert.equal((await call('POST', `/api/me/requests/9999/messages`, { token, body: { body: 'x' } })).status, 404);

  // Closed by the dealership: the customer can no longer answer (new request instead); reopening allows it again
  await call('PUT', `/api/admin/reports/${req.id}`, { token: admin, body: { status: 'resolu', message: 'Rendez-vous confirmé, bonne route !' } });
  const closed = (await call('GET', '/api/me/requests', { token })).data.find((r) => r.id === req.id);
  assert.equal(closed.status, 'resolu');
  assert.ok(closed.closedAt);
  const refused = await call('POST', `/api/me/requests/${req.id}/messages`, { token, body: { body: 'Encore une question' } });
  assert.equal(refused.status, 409);
  assert.match(refused.data.error, /clôturée/);
  assert.equal((await call('GET', '/api/admin/reports', { token: admin })).data.find((r) => r.id === req.id).waitingForDealer, false);
  await call('PUT', `/api/admin/reports/${req.id}`, { token: admin, body: { status: 'en_cours' } });
  assert.equal((await call('POST', `/api/me/requests/${req.id}/messages`, { token, body: { body: 'Merci' } })).status, 200);
  assert.equal((await call('GET', '/api/me/requests', { token })).data.find((r) => r.id === req.id).closedAt, null);

  // Customer registered from the back-office: welcome e-mail with the code and the app button
  await waitFor(() => smtp.mails.length === 6);
  const created = (await call('POST', '/api/admin/customers', { token: admin, body: { vehicleId: catalog.vehicles[0].id, dealershipId: 1, firstName: 'Léa', lastName: 'Roux', email: 'lea@client.fr', sendEmail: true } })).data;
  assert.equal(created.emailSent, true);
  await waitFor(() => smtp.mails.length === 7);
  assert.deepEqual(smtp.mails[6].rcpt, ['lea@client.fr']);
  const welcome = smtp.mails[6].data.split(/--cdb-[0-9a-f]+/);
  const welcomeHtml = Buffer.from(welcome.find((x) => x.includes('text/html')).split('\n\n').slice(1).join('').replace(/\s/g, ''), 'base64').toString();
  assert.match(welcomeHtml, /Ouvrir mon application/);
  assert.ok(welcomeHtml.includes(created.accessCode));
});

test('store request: photo, model, cell number, year; the VIN goes in the e-mail only', async () => {
  const admin = (await call('POST', '/api/admin/login', { body: { email: 'admin@test.fr', password: 'motdepasse123' } })).data.token;
  await call('PUT', '/api/admin/dealerships/1', { token: admin, body: { storeEmail: 'magasin@concession.fr' } });
  const { data: catalog } = await call('GET', '/api/catalog');
  const h = await call('POST', '/api/handover', { body: { dealershipCode: 'DEMO2026', vehicleId: catalog.vehicles[0].id, customer: { lastName: 'Piece', vin: 'VF1SECRET1234567', plate: 'ZZ-999-ZZ' } } });
  const token = h.data.token;
  assert.equal(h.data.customer.vin, undefined, 'the VIN is not kept at the handover');
  // The handover checklist synced from the phone loses its VIN on the server
  const st = await call('PUT', '/api/me/state/cdb_hand', { token, body: { value: JSON.stringify({ steps: {}, name: 'Paul', vin: 'VF1SECRET1234567' }) } });
  assert.ok(!st.data.value.includes('VF1SECRET'));
  const before = smtp.mails.length;
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const r = await call('POST', '/api/me/parts', {
    token,
    body: { need: 'piece', equipmentId: 'trumac', equipmentName: 'Chauffage Truma', product: 'Thermostat', model: 'Truma Combi 4', ref: '30030-33600', cellNumber: 'CEL-12345', vehicleYear: '2024', photo: PNG, photoKind: 'client', vin: 'VF1SECRET1234567', message: 'Il ne chauffe plus.' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.kind, 'piece');
  assert.ok(r.data.part.photoUrl.startsWith('/uploads/'));
  assert.equal(r.data.part.vinSent, true);
  assert.equal(r.data.part.photoKind, 'client');
  await waitFor(() => smtp.mails.length === before + 1);
  const mail = smtp.mails[before];
  assert.deepEqual(mail.rcpt, ['atelier@concession.fr'], 'under warranty: the SAV');
  assert.equal(r.data.service, 'sav');
  assert.match(bodyText(mail), /VF1SECRET1234567/);
  assert.match(bodyText(mail), /CEL-12345/);
  // Nowhere on the server
  const dump = JSON.stringify([
    app.db.prepare('SELECT * FROM reports').all(),
    app.db.prepare('SELECT * FROM customers').all(),
    app.db.prepare('SELECT * FROM customer_state').all(),
  ]);
  assert.ok(!dump.includes('VF1SECRET'), 'the VIN is stored nowhere');
  assert.ok(!dump.includes('ZZ-999-ZZ'), 'nor the number plate');
  const me = (await call('GET', '/api/me', { token })).data.customer;
  assert.equal(me.cellNumber, 'CEL-12345');
  assert.equal(me.vehicleYear, '2024');
  const list = (await call('GET', '/api/admin/reports?kind=piece', { token: admin })).data;
  assert.equal(list[0].part.model, 'Truma Combi 4');
  // Accessory: always the store; out of warranty: the store
  const acc = await call('POST', '/api/me/parts', { token, body: { need: 'accessoire', equipmentName: 'Porte-vélos' } });
  assert.equal(acc.data.service, 'magasin');
  await waitFor(() => smtp.mails.length === before + 2);
  assert.deepEqual(smtp.mails[before + 1].rcpt, ['magasin@concession.fr']);
  const cust = app.db.prepare("SELECT id FROM customers WHERE last_name = 'Piece'").get();
  app.db.prepare("UPDATE customers SET warranty_end = '2020-01-01' WHERE id = ?").run(cust.id);
  assert.equal((await call('POST', '/api/me/parts', { token, body: { need: 'piece', equipmentName: 'Pompe' } })).data.service, 'magasin');
  app.db.prepare("UPDATE customers SET warranty_ext_end = '2099-01-01' WHERE id = ?").run(cust.id);
  assert.equal((await call('POST', '/api/me/parts', { token, body: { need: 'remplacement', equipmentName: 'Frigo' } })).data.service, 'sav', 'extended warranty: the SAV');
  // The SAV hands a request to the store, with the reason
  const moved = await call('PUT', `/api/admin/reports/${r.data.id}`, { token: admin, body: { service: 'magasin', transferNote: 'Pièce disponible au magasin' } });
  assert.equal(moved.data.service, 'magasin');
  assert.match(moved.data.transferNote, /SAV → Magasin : Pièce disponible/);
  // A photo URL that is not the customer's is refused
  const other = await call('POST', '/api/me/parts', { token, body: { equipmentName: 'Store', photo: '/uploads/pas-a-moi.jpg' } });
  assert.equal(other.data.part.photoUrl, null);
});

test('daily e-mail to the service mailbox for requests without answer for more than 48 hours', async () => {
  const { runDue } = require('../server/jobs');
  const { data: catalog } = await call('GET', '/api/catalog');
  const h = (await call('POST', '/api/handover', { body: { dealershipCode: 'DEMO2026', vehicleId: catalog.vehicles[0].id, customer: { lastName: 'Patient' } } })).data;
  const r = (await call('POST', '/api/me/requests', { token: h.token, body: { title: 'Toujours rien ?', message: 'Bonjour' } })).data;
  app.db.prepare("UPDATE reports SET created_at = datetime('now', '-3 days') WHERE id = ?").run(r.id);
  const before = smtp.mails.length;
  await runDue({ db: app.db, notify: app.notify, config: app.config, log: () => {} }, { force: true });
  await waitFor(() => smtp.mails.slice(before).some((m) => /sans réponse depuis plus de 48/.test(subject(m))));
  const mail = smtp.mails.slice(before).find((m) => /sans réponse depuis plus de 48/.test(subject(m)));
  assert.deepEqual(mail.rcpt, ['atelier@concession.fr']);
  assert.match(bodyText(mail), /Toujours rien \?/);
});
