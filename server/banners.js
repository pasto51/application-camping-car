'use strict';

// « À la une »: the banners of the app's home screen, each for its own customers (dealerships, type of vehicle, time
// since the handover, warranty, equipment they have or do not have, consent to offers) and between two dates.
// A customer sees one banner: the one with the highest priority among those for them, then the most recent.

const { getSetting, setSetting } = require('./db');
const { warrantyOf } = require('./services');
const { readProfile } = require('./catalog');
const { ownOf } = require('./entretien');

const SCREENS = [
  ['tips', 'Conseils & Astuces'],
  ['weight', 'Poids du véhicule'],
  ['carnet', 'Carnet d’entretien'],
  ['daily', 'Gestes du quotidien'],
  ['diag', 'J’ai un souci'],
  ['rdv', 'Rendez-vous atelier'],
  ['equip', 'Mes équipements'],
  ['what', 'C’est quoi, ça ?'],
];
const SCREEN_IDS = new Set(SCREENS.map((s) => s[0]));
const ICONS = ['💡', '📣', '🎉', '🎁', '🛒', '❄️', '☀️', '💧', '🔥', '🔋', '🔧', '🚐', '🛡️', '⚠️'];
// Time since the handover, in months: [id, label, min, max].
const AGES = [
  ['', 'Tous, quelle que soit l’ancienneté', null, null],
  ['m3', 'Livrés depuis moins de 3 mois', null, 3],
  ['m12', 'Livrés depuis 3 à 12 mois', 3, 12],
  ['y3', 'Livrés depuis 1 à 3 ans', 12, 36],
  ['old', 'Livrés depuis plus de 3 ans', 36, null],
];
const AGE_IDS = new Set(AGES.map((a) => a[0]));
const WARRANTIES = [
  ['', 'Tous'],
  ['under', 'Sous garantie (ou extension)'],
  ['out', 'Hors garantie'],
];

const json = (v, d) => {
  try {
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};
const today = () => new Date().toISOString().slice(0, 10);
const monthsSince = (iso, now = today()) => {
  if (!iso) return null;
  const [y1, m1, d1] = iso.split('-').map(Number);
  const [y2, m2, d2] = now.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};

function bannerOut(r) {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle || '',
    icon: r.icon || '💡',
    action: r.action,
    ...json(r.payload, {}),
    dealershipIds: json(r.dealership_ids, []),
    vehicleTypes: json(r.vehicle_types, []),
    age: r.age || '',
    warranty: r.warranty || '',
    // Equipment: at least one of « equipmentAny », none of « equipmentNone » (e.g. an air-conditioning offer for those
    // without any air conditioning). The first version had a single piece of equipment (equipment_id / equipment_has).
    equipmentAny: json(r.equipment_any, null) || (r.equipment_id && r.equipment_has !== 0 ? [r.equipment_id] : []),
    equipmentNone: json(r.equipment_none, null) || (r.equipment_id && r.equipment_has === 0 ? [r.equipment_id] : []),
    optinOnly: !!r.optin_only,
    startsOn: r.starts_on || '',
    endsOn: r.ends_on || '',
    priority: r.priority || 0,
    createdAt: r.created_at,
  };
}
// What the app needs: the look and the action, not the targeting.
const appOut = (b) => (b ? { id: b.id, title: b.title, subtitle: b.subtitle, icon: b.icon, action: b.action, tipId: b.tipId, screen: b.screen, url: b.url, text: b.text } : null);

function liveOn(b, day = today()) {
  return (!b.startsOn || b.startsOn <= day) && (!b.endsOn || b.endsOn >= day);
}

// Is this banner for this customer? (ctx: what is known about them, computed once.)
function matches(b, c, day = today()) {
  if (!liveOn(b, day)) return false;
  if (b.dealershipIds.length && !b.dealershipIds.includes(c.dealershipId)) return false;
  if (b.vehicleTypes.length && !b.vehicleTypes.includes(c.vehicleType)) return false;
  if (b.age) {
    const [, , min, max] = AGES.find((a) => a[0] === b.age) || [];
    if (c.months == null) return false;
    if (min != null && c.months < min) return false;
    if (max != null && c.months >= max) return false;
  }
  if (b.warranty === 'under' && !c.underWarranty) return false;
  if (b.warranty === 'out' && c.underWarranty) return false;
  if (b.equipmentAny.length && !b.equipmentAny.some((id) => c.own[id])) return false;
  if (b.equipmentNone.some((id) => c.own[id])) return false;
  if (b.optinOnly && !c.optin) return false;
  return true;
}

function customerContext(db, customer, day = today()) {
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(customer.vehicle_id);
  const profile = vehicle ? readProfile(vehicle) : null;
  // Equipment: as ticked in the app, else the list of the model.
  let own = ownOf(db, customer.id);
  if (!Object.keys(own).length && profile) own = Object.fromEntries(profile.equipment.map((id) => [id, true]));
  return {
    dealershipId: customer.dealership_id,
    vehicleType: profile?.type || '',
    months: monthsSince(customer.handover_date, day),
    underWarranty: warrantyOf(db, customer).active,
    own,
    optin: customer.marketing_optin === 1,
  };
}

const ORDER = 'ORDER BY priority DESC, id DESC';
function allBanners(db) {
  return db.prepare(`SELECT * FROM banners ${ORDER}`).all().map(bannerOut);
}

function bannerFor(db, customer) {
  if (!customer) return null;
  const c = customerContext(db, customer);
  return appOut(allBanners(db).find((b) => matches(b, c)) || null);
}

// How many customers a banner reaches today (within the dealerships the user may see).
function audience(db, b, dealershipIds = null) {
  const rows = dealershipIds
    ? db.prepare(`SELECT * FROM customers WHERE dealership_id IN (${dealershipIds.map(() => '?').join(', ') || 'NULL'})`).all(...dealershipIds)
    : db.prepare('SELECT * FROM customers').all();
  const ignoreDates = { ...b, startsOn: '', endsOn: '' };
  return rows.filter((c) => matches(ignoreDates, customerContext(db, c))).length;
}

// Checks and normalizes what comes from the back-office form.
function cleanBanner(db, body, { dealershipIds: forced } = {}) {
  const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '');
  const title = str(body.title, 80);
  if (!title) throw new Error('Titre obligatoire');
  const action = ['tip', 'screen', 'link', 'popup'].includes(body.action) ? body.action : 'popup';
  const payload = {};
  if (action === 'tip') {
    const id = Number(body.tipId);
    if (!db.prepare("SELECT 1 FROM tips WHERE id = ? AND status = 'published'").get(id)) throw new Error('Choisissez une astuce publiée');
    payload.tipId = id;
  } else if (action === 'screen') {
    if (!SCREEN_IDS.has(body.screen)) throw new Error('Choisissez une page de l’application');
    payload.screen = body.screen;
  } else if (action === 'link') {
    const url = str(body.url, 500);
    if (!/^https:\/\/\S+$/i.test(url)) throw new Error('Le lien doit commencer par https://');
    payload.url = url;
  } else {
    payload.text = str(body.text, 1500);
    if (!payload.text) throw new Error('Écrivez le texte de l’annonce');
  }
  const ids = (v) => (Array.isArray(v) ? v : []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const dealershipIds = forced || [...new Set(ids(body.dealershipIds))].filter((id) => db.prepare('SELECT 1 FROM dealerships WHERE id = ?').get(id));
  const types = [...new Set((Array.isArray(body.vehicleTypes) ? body.vehicleTypes : []).map(String))].slice(0, 20);
  const date = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const startsOn = date(body.startsOn);
  const endsOn = date(body.endsOn);
  if (startsOn && endsOn && endsOn < startsOn) throw new Error('La date de fin est avant la date de début');
  const known = (v) => [...new Set((Array.isArray(v) ? v : []).map(String))].filter((id) => db.prepare('SELECT 1 FROM equipment WHERE id = ?').get(id)).slice(0, 60);
  const equipmentAny = known(body.equipmentAny);
  const equipmentNone = known(body.equipmentNone);
  if (equipmentAny.some((id) => equipmentNone.includes(id))) throw new Error('Un même équipement ne peut pas être à la fois « ont » et « n’ont pas »');
  return {
    title,
    subtitle: str(body.subtitle, 140),
    icon: ICONS.includes(body.icon) ? body.icon : '💡',
    action,
    payload: JSON.stringify(payload),
    dealership_ids: JSON.stringify(dealershipIds),
    vehicle_types: JSON.stringify(types),
    age: AGE_IDS.has(body.age) ? body.age : '',
    warranty: ['under', 'out'].includes(body.warranty) ? body.warranty : '',
    equipment_any: JSON.stringify(equipmentAny),
    equipment_none: JSON.stringify(equipmentNone),
    equipment_id: null,
    equipment_has: 1,
    optin_only: body.optinOnly ? 1 : 0,
    starts_on: startsOn,
    ends_on: endsOn,
    priority: Math.max(0, Math.min(99, Math.round(Number(body.priority) || 0))),
  };
}

const COLUMNS = ['title', 'subtitle', 'icon', 'action', 'payload', 'dealership_ids', 'vehicle_types', 'age', 'warranty', 'equipment_any', 'equipment_none', 'equipment_id', 'equipment_has', 'optin_only', 'starts_on', 'ends_on', 'priority'];
function insertBanner(db, b, createdBy = null) {
  const r = db.prepare(`INSERT INTO banners (${COLUMNS.join(', ')}, created_by) VALUES (${COLUMNS.map(() => '?').join(', ')}, ?)`).run(...COLUMNS.map((k) => b[k]), createdBy);
  return Number(r.lastInsertRowid);
}
function updateBanner(db, id, b) {
  db.prepare(`UPDATE banners SET ${COLUMNS.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...COLUMNS.map((k) => b[k]), id);
}

// The first version had a single banner (setting « featured »): it becomes a banner for everyone.
function migrateFeatured(db) {
  const old = getSetting(db, 'featured', null);
  if (old === null) return;
  const f = json(old, null);
  if (f && f.title && !db.prepare('SELECT COUNT(*) AS n FROM banners').get().n) {
    const { title, subtitle, icon, action, tipId, screen, url, text } = f;
    insertBanner(db, {
      title, subtitle: subtitle || '', icon: icon || '💡', action,
      payload: JSON.stringify({ tipId, screen, url, text }),
      dealership_ids: '[]', vehicle_types: '[]', age: '', warranty: '', equipment_any: '[]', equipment_none: '[]', equipment_id: null, equipment_has: 1, optin_only: 0, starts_on: null, ends_on: null, priority: 0,
    });
  }
  setSetting(db, 'featured', null);
  db.prepare("DELETE FROM settings WHERE key = 'featured'").run();
}

module.exports = { SCREENS, ICONS, AGES, WARRANTIES, allBanners, bannerOut, bannerFor, audience, cleanBanner, insertBanner, updateBanner, migrateFeatured, liveOn, matches, customerContext };
