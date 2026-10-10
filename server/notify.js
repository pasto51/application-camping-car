'use strict';

// Who is told what: the dealership by e-mail when a customer writes, the customer by push notification
// (and e-mail if known) when the dealership answers. Sending never blocks or breaks the request itself.

const { getSetting, setSetting } = require('./db');
const { sendMail } = require('./mailer');
const { serviceEmail, SERVICES } = require('./services');
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

async function mail(db, to, subject, text, log, extra = {}) {
  const config = mailConfig(db);
  if (!config.host || !config.from || !to.length) return false;
  try {
    await sendMail(config, { to, subject, text, ...extra });
    setSetting(db, 'mail_last', JSON.stringify({ ok: true, at: new Date().toISOString(), to }));
    return true;
  } catch (err) {
    setSetting(db, 'mail_last', JSON.stringify({ ok: false, at: new Date().toISOString(), to, error: err.message }));
    log('[e-mail]', err.message);
    return false;
  }
}

function customerName(c) {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Un client';
}

const escHtml = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// E-mail layout: dealership header, message, one big button, dealership signature.
// Tables and inline styles: the only layout every mail client (Gmail, Outlook, iPhone) displays the same way.
function emailHtml({ dealer, intro, quote, image, button, url, note, footer }) {
  const sig = [dealer.phone && `Tél. ${escHtml(dealer.phone)}`, dealer.hours && escHtml(dealer.hours), dealer.website && `<a href="${escHtml(dealer.website)}" style="color:#0a7c82">${escHtml(dealer.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>`].filter(Boolean).join('<br>');
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f3f7f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #d5e2e1;border-radius:16px;font-family:Helvetica,Arial,sans-serif;color:#0c2b33">
<tr><td style="background:#0a7c82;border-radius:16px 16px 0 0;padding:18px 24px;color:#ffffff;font-size:20px;font-weight:bold">${escHtml(dealer.name || 'Votre concession')}</td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.5">
<p style="margin:0 0 14px">${intro}</p>
${image ? `<img src="${escHtml(image)}" alt="" width="472" style="display:block;width:100%;max-width:472px;border-radius:12px;margin:0 0 16px">` : ''}
${quote ? `<div style="background:#dff3e6;border-radius:12px;padding:14px 16px;margin:0 0 22px;font-size:16px">${escHtml(quote).replace(/\n/g, '<br>')}</div>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:4px 0 18px">
<a href="${escHtml(url)}" style="display:block;background:#0a7c82;color:#ffffff;text-decoration:none;font-size:18px;font-weight:bold;padding:16px 20px;border-radius:12px;text-align:center">${escHtml(button)}</a>
</td></tr></table>
${note ? `<p style="margin:0;color:#4d6a70;font-size:14px">${note}</p>` : ''}
</td></tr>
${sig || footer ? `<tr><td style="border-top:1px solid #d5e2e1;padding:16px 24px;color:#4d6a70;font-size:13px;line-height:1.5"><b style="color:#0c2b33">${escHtml(dealer.name || '')}</b><br>${sig}${footer ? `<br><br>${footer}` : ''}</td></tr>` : ''}
</table></td></tr></table></body></html>`;
}

function createNotifier({ db, vapid, log = console.log, createLoginLink = () => null }) {
  const subject = () => `mailto:${(mailConfig(db).from || 'contact@compagnon-de-bord.fr').replace(/.*<|>.*/g, '')}`;

  // Sends to every phone of the customer; returns one result per phone (service, HTTP status, ok).
  // The last answer of the push services is kept so the « Notifications » tab can show what went wrong.
  async function pushResults(customerId, payload) {
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE customer_id = ?').all(customerId);
    const results = [];
    for (const s of subs) {
      const host = new URL(s.endpoint).host;
      let r;
      try {
        const status = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, vapid, subject());
        if (status === 404 || status === 410) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(s.endpoint);
        r = { host, status, ok: status < 300 };
      } catch (err) {
        r = { host, status: 0, ok: false, error: err.message };
      }
      if (!r.ok) log('[push]', r.status, host, r.error || '');
      results.push(r);
      setSetting(db, r.ok ? 'push_last_ok' : 'push_last_error', JSON.stringify({ ...r, at: new Date().toISOString() }));
    }
    return results;
  }

  async function push(customerId, payload) {
    return (await pushResults(customerId, payload)).filter((r) => r.ok).length;
  }

  // A customer created a request or wrote in an existing one.
  function customerWrote({ report, customer, text, origin, isNew, part, vin }) {
    const vehicle = db.prepare('SELECT v.name, b.name AS brand FROM vehicles v JOIN brands b ON b.id = v.brand_id WHERE v.id = ?').get(customer.vehicle_id);
    const who = customerName(customer);
    const lines = [
      isNew ? `${who} vient d'envoyer une demande depuis l'application Compagnon de bord.` : `${who} a répondu dans sa demande « ${report.title} ».`,
      '',
      `Demande : ${report.title}`,
      `Véhicule : ${[vehicle?.brand, vehicle?.name].filter(Boolean).join(' ')}`,
      customer.phone ? `Téléphone : ${customer.phone}` : null,
      customer.email ? `E-mail : ${customer.email}` : null,
      '',
      text || '',
      vin ? `VIN : ${vin} (communiqué par le client pour cette demande, non conservé par l'application)` : null,
      part?.photoUrl ? `Photo : ${origin}${part.photoUrl}` : null,
      '',
      `Répondre depuis le back-office : ${origin}/admin/#reports`,
    ].filter((l) => l !== null);
    const url = `${origin}/admin/#reports`;
    const d = db.prepare('SELECT * FROM dealerships WHERE id = ?').get(customer.dealership_id) || {};
    const html = emailHtml({
      dealer: { name: d.name },
      intro: isNew
        ? `<b>${escHtml(who)}</b> vient d'envoyer une demande : <b>${escHtml(report.title)}</b>.<br>Véhicule : ${escHtml([vehicle?.brand, vehicle?.name].filter(Boolean).join(' '))}${customer.phone ? `<br>Téléphone : ${escHtml(customer.phone)}` : ''}`
        : `<b>${escHtml(who)}</b> a répondu dans sa demande <b>${escHtml(report.title)}</b>.`,
      quote: vin ? `${text}\nVIN : ${vin}` : text,
      image: part?.photoUrl ? `${origin}${part.photoUrl}` : null,
      button: 'Répondre dans le back-office',
      url,
      note:
        (vin ? 'Le VIN figure seulement dans cet e-mail : l’application ne le conserve pas. ' : '') +
        'Répondez depuis le back-office : le client reçoit votre réponse dans son application, et l’échange reste dans l’historique.',
    });
    // One mailbox per service: the SAV's or the store's (managers see everything in the back-office, without e-mails).
    const to = [...new Set([serviceEmail(db, customer.dealership_id, report.service || 'sav'), mailConfig(db).copy].filter(Boolean))];
    const label = `${SERVICES[report.service] || 'SAV'} · ${isNew ? 'Nouvelle demande' : 'Nouveau message'}`;
    return mail(db, to, `${label} : ${report.title} – ${who}`, lines.join('\n'), log, {
      html,
      fromName: 'Compagnon de bord',
      // A direct reply from the mailbox still reaches the customer instead of the notification address.
      replyTo: customer.email || undefined,
    });
  }

  // The dealership answered: push to the customer's phones, e-mail if the customer gave one.
  async function dealershipAnswered({ report, customer, text, origin }) {
    const d = db.prepare('SELECT * FROM dealerships WHERE id = ?').get(customer.dealership_id) || {};
    // The answer comes from the SAV or from the store: the e-mail says which, and a direct reply reaches that service.
    const name = `${d.name || 'Votre concession'}${report.service === 'magasin' ? ' · Magasin' : report.service === 'sav' ? ' · SAV' : ''}`;
    const pushed = await push(customer.id, { title: name, body: text.slice(0, 180), url: `/app/#demande-${report.id}`, tag: `demande-${report.id}` });
    if (customer.email && customer.email_notify !== 0) {
      // The button signs the customer in directly (single-use link), even in a browser where they never logged in.
      const token = createLoginLink(customer.id);
      const url = `${origin}/app/${token ? `?lien=${token}` : ''}#demande-${report.id}`;
      const html = emailHtml({
        dealer: { name, phone: d.phone, hours: d.hours, website: d.website },
        intro: `Bonjour${customer.first_name ? ' ' + escHtml(customer.first_name) : ''},<br><b>${escHtml(name)}</b> a répondu à votre demande <b>« ${escHtml(report.title)} »</b> :`,
        quote: text,
        button: 'Consulter la réponse dans mon application',
        url,
        note: 'Pour répondre, utilisez le bouton ci-dessus : votre message arrive directement à la concession et reste dans l’historique de votre demande.',
        footer: 'E-mail envoyé par l’application Compagnon de bord.',
      });
      const plain = [
        `Bonjour${customer.first_name ? ' ' + customer.first_name : ''},`,
        '',
        `${name} a répondu à votre demande « ${report.title} » :`,
        '',
        text,
        '',
        `Consulter la réponse dans mon application : ${url}`,
        '',
        'Pour répondre, utilisez l’application : votre message arrive directement à la concession.',
        '',
        [name, d.phone, d.hours, d.website].filter(Boolean).join(' · '),
      ].join('\n');
      await mail(db, [customer.email], `${name} a répondu : ${report.title}`, plain, log, {
        html,
        fromName: `${name} via Compagnon de bord`,
        // Safety net: if the customer answers the e-mail itself, the dealership receives it (never the notification box).
        replyTo: serviceEmail(db, customer.dealership_id, report.service || 'sav') || mailConfig(db).copy || undefined,
      });
    }
    return pushed;
  }

  // Account created from the back-office: the customer gets their access code and a button that opens the app signed in.
  async function welcome({ customer, code, url }) {
    if (!customer.email) return false;
    const d = db.prepare('SELECT * FROM dealerships WHERE id = ?').get(customer.dealership_id) || {};
    const name = d.name || 'Votre concession';
    const vehicle = db.prepare('SELECT v.name, b.name AS brand FROM vehicles v JOIN brands b ON b.id = v.brand_id WHERE v.id = ?').get(customer.vehicle_id);
    const what = [vehicle?.brand, vehicle?.name].filter(Boolean).join(' ');
    const hello = `Bonjour${customer.first_name ? ' ' + customer.first_name : ''},`;
    const html = emailHtml({
      dealer: { name, phone: d.phone, hours: d.hours, website: d.website },
      intro: `${escHtml(hello)}<br><b>${escHtml(name)}</b> vous a ouvert votre application <b>Compagnon de bord</b>${what ? ` pour votre ${escHtml(what)}` : ''} : prise en main, équipements, dépannages pas à pas et contact avec l’atelier.`,
      quote: `Votre code d’accès : ${code}`,
      button: 'Ouvrir mon application',
      url,
      note: `Le bouton fonctionne une seule fois, pendant 14 jours. Ensuite, ou sur un autre téléphone, choisissez « J’ai déjà un code d’accès » et saisissez votre nom (${escHtml(customer.last_name)}) et ce code. Sur téléphone, ajoutez l’application à l’écran d’accueil pour la retrouver facilement.`,
      footer: 'E-mail envoyé par l’application Compagnon de bord.',
    });
    const plain = [
      hello,
      '',
      `${name} vous a ouvert votre application Compagnon de bord${what ? ` pour votre ${what}` : ''}.`,
      '',
      `Ouvrir mon application : ${url}`,
      `Votre code d’accès : ${code} (avec votre nom : ${customer.last_name})`,
      '',
      'Le lien fonctionne une seule fois, pendant 14 jours. Ensuite, choisissez « J’ai déjà un code d’accès » dans l’application.',
      '',
      [name, d.phone, d.hours, d.website].filter(Boolean).join(' · '),
    ].join('\n');
    return mail(db, [customer.email], `${name} : votre application Compagnon de bord`, plain, log, {
      html,
      fromName: `${name} via Compagnon de bord`,
      replyTo: d.email || mailConfig(db).copy || undefined,
    });
  }

  // Once a day: the requests of a service left without answer for more than 48 hours, in one e-mail to its mailbox.
  async function overdueDigest({ to, dealer, serviceName, reports, url }) {
    const lines = reports.map((r) => `• ${r.title} — ${r.client}, depuis le ${r.since}`);
    const subject = `${reports.length} demande${reports.length > 1 ? 's' : ''} sans réponse depuis plus de 48 h · ${serviceName}`;
    const html = emailHtml({
      dealer: { name: `${dealer.name || 'Concession'} · ${serviceName}` },
      intro: `Ces demandes de clients attendent une réponse depuis plus de 48 heures :<br><br>${reports
        .map((r) => `• <b>${escHtml(r.title)}</b> — ${escHtml(r.client)}, depuis le ${escHtml(r.since)}`)
        .join('<br>')}`,
      button: 'Répondre dans le back-office',
      url,
      note: 'Ce rappel est envoyé une fois par jour tant qu’une demande reste sans réponse.',
      footer: 'E-mail envoyé par l’application Compagnon de bord.',
    });
    const text = ['Ces demandes de clients attendent une réponse depuis plus de 48 heures :', '', ...lines, '', `Répondre : ${url}`].join('\n');
    return mail(db, [to], subject, text, log, { html, fromName: `${dealer.name || 'Compagnon de bord'} via Compagnon de bord` });
  }

  // « Signaler un bug »: an e-mail to every administrator account.
  async function bugReported({ bug, url }) {
    const to = db.prepare("SELECT email FROM admins WHERE role = 'admin'").all().map((r) => r.email).filter((e) => /@/.test(e) && !/@demo\.test$|\.local$/.test(e));
    if (!to.length) return false;
    const from = bug.source === 'app' ? `un client (${bug.who || 'appli'})` : `le back-office (${bug.who || 'équipe'})`;
    const subject = `Bug signalé depuis ${bug.source === 'app' ? 'l’appli' : 'le back-office'}${bug.page ? ` · ${bug.page}` : ''}`;
    const html = emailHtml({
      dealer: { name: 'Compagnon de bord · bug signalé' },
      intro: `Un bug vient d’être signalé par ${escHtml(from)}${bug.page ? `, sur l’écran « ${escHtml(bug.page)} »` : ''}.`,
      quote: bug.message,
      button: 'Voir dans le back-office',
      url,
      note: `${bug.device ? `Appareil : ${escHtml(bug.device)}<br>` : ''}${bug.version ? `Version : ${escHtml(bug.version)}` : ''}`,
      footer: 'E-mail envoyé par l’application Compagnon de bord.',
    });
    const text = [`Bug signalé par ${from}${bug.page ? `, écran « ${bug.page} »` : ''} :`, '', bug.message, '', bug.device ? `Appareil : ${bug.device}` : '', bug.version ? `Version : ${bug.version}` : '', '', `Voir : ${url}`].filter((l, i, a) => l || a[i - 1]).join('\n');
    return mail(db, to, subject, text, log, { html, fromName: 'Compagnon de bord' });
  }

  return { customerWrote, dealershipAnswered, welcome, push, pushResults, overdueDigest, bugReported };
}

module.exports = { createNotifier, mailConfig, mailReady, emailHtml };
