'use strict';

// Daily tasks of the running site: backup of the database, maintenance reminders, alert on requests left without answer.
// Each one runs once a day (checked every hour, from 7 a.m. server time), and is remembered in the settings so that a
// restart does not run it twice.

const { getSetting, setSetting } = require('./db');
const { backupNow } = require('./backup');
const { dueItems, logOf } = require('./entretien');
const { SERVICES, serviceEmail, OVERDUE_SQL, WAITING_SINCE } = require('./services');

const TASKS = [];

// Add a daily task: run(app) may be async; what it returns is logged.
function daily(name, run) {
  TASKS.push({ name, run });
}

daily('sauvegarde', (app) => {
  const b = backupNow(app.db, app.config.dataDir);
  return `sauvegarde ${b.name} (${Math.round(b.size / 1024)} Ko)`;
});

// Maintenance reminders: one notification on the phone for each date coming within 45 days (or already passed),
// at most one per customer and per day. Only customers who allowed notifications receive them.
daily('rappels', async (app) => {
  const { db, notify } = app;
  const today = new Date().toISOString().slice(0, 10);
  const customers = db.prepare('SELECT DISTINCT c.* FROM customers c JOIN push_subscriptions p ON p.customer_id = c.id').all();
  let sent = 0;
  for (const c of customers) {
    const item = dueItems(c, logOf(db, c.id), today).find(
      (i) => i.state !== 'later' && !db.prepare('SELECT 1 FROM reminder_sent WHERE customer_id = ? AND kind = ? AND due = ?').get(c.id, i.kind, i.due)
    );
    if (!item) continue;
    const date = new Date(`${item.due}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const n = await notify.push(c.id, {
      title: item.state === 'late' ? `À faire : ${item.label}` : `À prévoir : ${item.label}`,
      body: `${item.state === 'late' ? 'C’était prévu' : 'À faire'} pour le ${date}. Prenez rendez-vous en un geste dans l’application.`,
      url: '/app/',
      tag: `rappel-${item.kind}`,
    });
    db.prepare('INSERT OR IGNORE INTO reminder_sent (customer_id, kind, due) VALUES (?, ?, ?)').run(c.id, item.kind, item.due);
    sent += n ? 1 : 0;
  }
  return `rappels d’entretien : ${sent} notification(s)`;
});

// Requests left without answer for more than 48 hours: one e-mail a day to each service mailbox (SAV, store).
daily('relances', async (app) => {
  const { db, notify } = app;
  const rows = db
    .prepare(
      `SELECT r.id, r.title, r.service, c.first_name, c.last_name, d.id AS dealership_id, d.name AS dealership_name, ${WAITING_SINCE} AS since
       FROM reports r JOIN customers c ON c.id = r.customer_id JOIN dealerships d ON d.id = c.dealership_id
       WHERE ${OVERDUE_SQL} ORDER BY since`
    )
    .all();
  const groups = new Map();
  for (const r of rows) {
    const service = r.service === 'magasin' ? 'magasin' : 'sav';
    const key = `${r.dealership_id}|${service}`;
    if (!groups.has(key)) groups.set(key, { dealershipId: r.dealership_id, dealer: { name: r.dealership_name }, service, reports: [] });
    groups.get(key).reports.push({ title: r.title, client: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Un client', since: new Date(`${r.since.replace(' ', 'T')}Z`).toLocaleDateString('fr-FR') });
  }
  const origin = getSetting(db, 'site_origin', '') || '';
  let sent = 0;
  for (const g of groups.values()) {
    const to = serviceEmail(db, g.dealershipId, g.service);
    if (!to) continue;
    if (await notify.overdueDigest({ to, dealer: g.dealer, serviceName: SERVICES[g.service], reports: g.reports, url: `${origin}/admin/#reports` })) sent++;
  }
  return `demandes en attente +48 h : ${rows.length}, ${sent} e-mail(s)`;
});

async function runDue(app, { force = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  for (const t of TASKS) {
    const key = `job_${t.name}`;
    if (!force && getSetting(app.db, key, '') === today) continue;
    try {
      const r = await t.run(app);
      setSetting(app.db, key, today);
      if (r) out.push(r);
    } catch (err) {
      app.log(`[tâches] ${t.name} : ${err.message}`);
    }
  }
  if (out.length) app.log(`[tâches] ${out.join(' · ')}`);
  return out;
}

function startJobs(app) {
  const tick = () => {
    if (new Date().getHours() >= 7) runDue(app).catch(() => {});
  };
  setTimeout(tick, 60 * 1000).unref();
  setInterval(tick, 60 * 60 * 1000).unref();
}

module.exports = { startJobs, runDue, daily };
