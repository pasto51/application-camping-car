'use strict';

// Who is told what: the dealership by e-mail when a customer writes, the customer by push notification
// (and e-mail if known) when the dealership answers. Sending never blocks or breaks the request itself.

const { getSetting, setSetting } = require('./db');
const { sendMail } = require('./mailer');
const { sendPush } = require('./webpush');

function mailConfig(db) {
  const get = (k, env) => getSetting(db, k, null) || process.env[env] || null;
  return {
    host: get('mail_host', 'SMTP_HOST'),
    port: Number(get('mail_port', 'SMTP_PORT') || 587),
    user: get('mail_user', 'SMTP_USER'),
    pass: get('mail_pass', 'SMTP_PASS'),
    from: get('mail_from', 'MAIL_FROM'),
    copy: get('mail_copy', 'NOTIFY_EMAIL'), // optional copy of every dealership notification
  };
}

function mailReady(db) {
  const c = mailConfig(db);
  return !!(c.host && c.from);
}

async function mail(db, to, subject, text, log) {
  const config = mailConfig(db);
  if (!config.host || !config.from || !to.length) return false;
  try {
    await sendMail(config, { to, subject, text });
    setSetting(db, 'mail_last', JSON.stringify({ ok: true, at: new Date().toISOString(), to }));
    return true;
  } catch (err) {
    setSetting(db, 'mail_last', JSON.stringify({ ok: false, at: new Date().toISOString(), to, error: err.message }));
    log('[e-mail]', err.message);
    return false;
  }
}

function dealershipRecipients(db, dealershipId) {
  const d = db.prepare('SELECT email FROM dealerships WHERE id = ?').get(dealershipId);
  const users = db.prepare("SELECT email FROM admins WHERE role = 'dealer' AND dealership_id = ?").all(dealershipId).map((u) => u.email);
  const copy = mailConfig(db).copy;
  return [...new Set([d?.email, ...users, copy].filter(Boolean))];
}

function customerName(c) {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Un client';
}

function createNotifier({ db, vapid, log = console.log }) {
  const subject = () => `mailto:${(mailConfig(db).from || 'contact@compagnon-de-bord.fr').replace(/.*<|>.*/g, '')}`;

  async function push(customerId, payload) {
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE customer_id = ?').all(customerId);
    let sent = 0;
    for (const s of subs) {
      try {
        const status = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, vapid, subject());
        if (status === 404 || status === 410) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(s.endpoint);
        else if (status < 300) sent++;
        else log('[push]', status, new URL(s.endpoint).host);
      } catch (err) {
        log('[push]', err.message);
      }
    }
    return sent;
  }

  // A customer created a request or wrote in an existing one.
  function customerWrote({ report, customer, text, origin, isNew }) {
    const vehicle = db.prepare('SELECT v.name, b.name AS brand FROM vehicles v JOIN brands b ON b.id = v.brand_id WHERE v.id = ?').get(customer.vehicle_id);
    const who = customerName(customer);
    const lines = [
      isNew ? `${who} vient d'envoyer une demande depuis l'application Compagnon de bord.` : `${who} a répondu dans sa demande « ${report.title} ».`,
      '',
      `Demande : ${report.title}`,
      `Véhicule : ${[vehicle?.brand, vehicle?.name].filter(Boolean).join(' ')}${customer.plate ? ` (${customer.plate})` : ''}`,
      customer.phone ? `Téléphone : ${customer.phone}` : null,
      customer.email ? `E-mail : ${customer.email}` : null,
      '',
      text || '',
      '',
      `Répondre depuis le back-office : ${origin}/admin/#reports`,
    ].filter((l) => l !== null);
    return mail(db, dealershipRecipients(db, customer.dealership_id), `${isNew ? 'Nouvelle demande' : 'Nouveau message'} : ${report.title} – ${who}`, lines.join('\n'), log);
  }

  // The dealership answered: push to the customer's phones, e-mail if the customer gave one.
  async function dealershipAnswered({ report, customer, text, origin }) {
    const d = db.prepare('SELECT name FROM dealerships WHERE id = ?').get(customer.dealership_id);
    const pushed = await push(customer.id, { title: d?.name || 'Votre concession', body: text.slice(0, 180), url: '/app/#demandes', tag: `demande-${report.id}` });
    if (customer.email) {
      await mail(
        db,
        [customer.email],
        `${d?.name || 'Votre concession'} a répondu : ${report.title}`,
        `Bonjour,\n\n${d?.name || 'Votre concession'} a répondu à votre demande « ${report.title} » :\n\n${text}\n\nRépondez depuis l'application : ${origin}/app/\n`,
        log
      );
    }
    return pushed;
  }

  return { customerWrote, dealershipAnswered, push };
}

module.exports = { createNotifier, mailConfig, mailReady };
