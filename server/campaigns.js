'use strict';

// « Notifications »: messages pushed from the back-office to the customers' phones (administrator only for now).
// Who: the same targeting as the « À la une » banners. What: a short text, and what opens when it is touched (a message,
// a page of the app, a tip, a web page, the home screen). When: now, or at a set date and time.

const { SCREENS, AGES, WARRANTIES, cleanBanner, bannerOut, matches, customerContext } = require('./banners');

// The themes: each fills in an icon, a title, a text and what opens; « commercial » ones only go to the customers
// who accepted the advice and offers.
const KINDS = [
  { id: 'une', name: 'Nouveau « À la une »', icon: '📣', title: 'Nouveau dans votre appli', body: 'Découvrez ce que votre concession met à la une cette semaine.', action: 'home' },
  { id: 'portes', name: 'Portes ouvertes', icon: '🎉', title: 'Portes ouvertes samedi', body: 'Venez nous voir : nouveautés, essais et café offert. Touchez pour les détails.', action: 'popup', commercial: true },
  { id: 'evenement', name: 'Conférence ou événement', icon: '🎤', title: 'Conférence à la concession', body: 'Une conférence sur le voyage en camping-car. Touchez pour la date et l’inscription.', action: 'popup' },
  { id: 'atelier', name: 'Formation ou atelier', icon: '🛠️', title: 'Atelier pratique : bien partir', body: 'Apprenez les bons gestes avec notre équipe. Places limitées : touchez pour les détails.', action: 'popup' },
  { id: 'promo', name: 'Promotion du magasin', icon: '🎁', title: 'Offre du magasin', body: 'Cette semaine au magasin : une offre sur les accessoires. Touchez pour en profiter.', action: 'popup', commercial: true },
  { id: 'entretien', name: 'Penser à l’entretien', icon: '🔧', title: 'Pensez à l’entretien', body: 'Révision, étanchéité, gaz : regardez votre carnet et prenez rendez-vous en un geste.', action: 'screen', screen: 'carnet' },
  { id: 'hivernage', name: 'Hivernage', icon: '❄️', title: 'Avant l’hiver : l’hivernage', body: 'Le froid arrive : suivez la liste d’hivernage pour protéger votre camping-car.', action: 'screen', screen: 'daily' },
  { id: 'printemps', name: 'Remise en route', icon: '☀️', title: 'C’est reparti !', body: 'Avant la première sortie, suivez la liste de remise en route.', action: 'screen', screen: 'daily' },
  { id: 'securite', name: 'Information importante', icon: '⚠️', title: 'Information importante', body: 'Une information importante sur votre véhicule : touchez pour la lire.', action: 'popup' },
  { id: 'autre', name: 'Autre message', icon: '📣', title: '', body: '', action: 'popup' },
];
const KIND_IDS = new Set(KINDS.map((k) => k.id));
const ACTIONS = ['popup', 'screen', 'tip', 'link', 'home'];

const json = (v, d) => {
  try {
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};

// Checks what comes from the form; the targeting is checked by the banners' own rules.
function cleanCampaign(db, body) {
  const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
  const kind = KIND_IDS.has(body.kind) ? body.kind : 'autre';
  const title = str(body.title, 60);
  const text = str(body.body, 180);
  if (!title) throw new Error('Titre obligatoire');
  if (!text) throw new Error('Écrivez le message de la notification');
  const k = KINDS.find((x) => x.id === kind);
  const action = ACTIONS.includes(body.action) ? body.action : k.action;
  const screen = body.screen || k.screen;
  // The banners' checks for the action and the targeting (a home action is checked as a popup without text).
  const b = cleanBanner(db, { ...body, title, screen, action: action === 'home' ? 'popup' : action, text: action === 'popup' ? body.text : 'x' });
  const payload = action === 'home' ? {} : JSON.parse(b.payload);
  const commercial = k.commercial;
  const target = {
    dealershipIds: JSON.parse(b.dealership_ids),
    vehicleTypes: JSON.parse(b.vehicle_types),
    age: b.age,
    warranty: b.warranty,
    equipmentAny: JSON.parse(b.equipment_any),
    equipmentNone: JSON.parse(b.equipment_none),
    // Offers and open days: only the customers who accepted them.
    optinOnly: commercial ? true : !!b.optin_only,
  };
  let sendAt = null;
  if (body.sendAt) {
    const t = Date.parse(body.sendAt);
    if (!Number.isFinite(t)) throw new Error('Date d’envoi invalide');
    if (t < Date.now() - 60000) throw new Error('La date d’envoi est déjà passée');
    if (t > Date.now() + 366 * 86400000) throw new Error('Date d’envoi trop lointaine');
    sendAt = new Date(t).toISOString();
  }
  return { kind, title, body: text, icon: k.icon, action, payload: JSON.stringify(payload), target: JSON.stringify(target), sendAt };
}

// The targeting read as a banner, to use the same matching as the « À la une » banners.
const asBanner = (target) => ({ ...bannerOut({ id: 0, title: '', action: 'popup', payload: '{}' }), ...target, startsOn: '', endsOn: '' });

function audienceOf(db, target) {
  const b = asBanner(target);
  const ids = db.prepare('SELECT * FROM customers').all().filter((c) => matches(b, customerContext(db, c))).map((c) => c.id);
  const withPush = new Set(db.prepare('SELECT DISTINCT customer_id FROM push_subscriptions').all().map((r) => r.customer_id));
  return { ids, targeted: ids.length, reachable: ids.filter((id) => withPush.has(id)).length };
}

function campaignOut(db, r) {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    icon: r.icon || '📣',
    action: r.action,
    ...json(r.payload, {}),
    target: json(r.target, {}),
    status: r.status,
    sendAt: r.send_at,
    sentAt: r.sent_at,
    targeted: r.targeted,
    reachable: r.reachable,
    delivered: r.delivered,
    opened: db.prepare('SELECT COUNT(*) AS n FROM notif_opens WHERE campaign_id = ?').get(r.id).n,
    createdAt: r.created_at,
  };
}

// Sends one campaign now: one notification on each phone of each customer targeted, touching it opens the app on it.
async function sendCampaign(app, id) {
  const { db, notify } = app;
  const claimed = db.prepare("UPDATE notif_campaigns SET status = 'sending' WHERE id = ? AND status = 'scheduled'").run(id).changes;
  if (!claimed) return null;
  const r = db.prepare('SELECT * FROM notif_campaigns WHERE id = ?').get(id);
  const { ids, targeted, reachable } = audienceOf(db, json(r.target, {}));
  let delivered = 0;
  for (const cid of ids) {
    try {
      const n = await notify.push(cid, { title: `${r.icon || ''} ${r.title}`.trim(), body: r.body, url: `/app/#notif-${r.id}`, tag: `notif-${r.id}` });
      if (n) delivered++;
    } catch {
      /* one phone that fails does not stop the others */
    }
  }
  db.prepare("UPDATE notif_campaigns SET status = 'sent', sent_at = datetime('now'), targeted = ?, reachable = ?, delivered = ? WHERE id = ?").run(targeted, reachable, delivered, id);
  return { targeted, reachable, delivered };
}

// Every minute: the campaigns whose time has come.
function startCampaigns(app) {
  const tick = () => {
    const due = app.db.prepare("SELECT id FROM notif_campaigns WHERE status = 'scheduled' AND send_at IS NOT NULL AND send_at <= ?").all(new Date().toISOString());
    for (const { id } of due) sendCampaign(app, id).catch((err) => app.log?.('[notifications]', err.message));
  };
  setInterval(tick, 60 * 1000).unref();
  tick();
}

// What the app opens when a notification is touched (and the open is counted once per customer).
function openCampaign(db, id, customerId) {
  const r = db.prepare("SELECT * FROM notif_campaigns WHERE id = ? AND status = 'sent'").get(id);
  if (!r) return null;
  db.prepare('INSERT OR IGNORE INTO notif_opens (campaign_id, customer_id) VALUES (?, ?)').run(id, customerId);
  return { id: r.id, title: r.title, icon: r.icon, action: r.action, ...json(r.payload, {}), eyebrow: 'Message de votre concession' };
}

const subscribers = (db) => db.prepare('SELECT COUNT(DISTINCT customer_id) AS n FROM push_subscriptions').get().n;

module.exports = { KINDS, ACTIONS, SCREENS, AGES, WARRANTIES, cleanCampaign, audienceOf, campaignOut, sendCampaign, startCampaigns, openCampaign, subscribers };
