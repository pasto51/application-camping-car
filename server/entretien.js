'use strict';

// Maintenance: what is due for a customer (from the handover date and what they noted in their logbook), and the
// logbook itself. The customer keeps the logbook (« J'ai fait le test d'étanchéité le… »): the next date follows from it.
// The kinds of maintenance are set in the back-office (« Contenus de l'appli » → « Carnet d'entretien »), each for its
// own customers (dealerships, type of vehicle, equipment they have or do not have); these are the first ones.

const { getCatalogValue, readProfile } = require('./catalog');

const DEFAULT_KINDS = [
  { id: 'etanch', label: 'Test d’étanchéité', every: 12, rdv: 'etanch', why: 'Une fois par an : souvent exigé pour garder la garantie étanchéité.' },
  { id: 'revision', label: 'Révision annuelle', every: 12, rdv: 'revision', why: 'Entretien du porteur et de la cellule.' },
  { id: 'gaz', label: 'Contrôle de l’installation gaz', every: 24, rdv: 'gaz', why: 'Tuyaux, détendeur et appareils au gaz : pour votre sécurité.' },
  { id: 'chauf', label: 'Révision du chauffage', season: '10-01', after: 10, rdv: 'chauf', why: 'Avant l’hiver, pour ne pas tomber en panne au froid.' },
  { id: 'hiv', label: 'Hivernage', season: '10-15', rdv: 'hiv', why: 'Vidange de l’eau et protection contre le gel avant l’hiver.' },
  { id: 'printemps', label: 'Remise en route (déshivernage)', season: '03-15', after: 4, rdv: 'revision', why: 'Avant la saison : eau, gaz, batteries et étanchéité.' },
  { id: 'frigo', label: 'Révision du réfrigérateur', season: '04-01', after: 10, rdv: 'frigo', equipmentAny: ['frigo', 'comp'], why: 'Avant la saison : brûleur et ventilation, pour qu’il refroidisse bien sur le gaz.' },
  { id: 'eauch', label: 'Révision du chauffe-eau', every: 12, rdv: 'eauch', equipmentAny: ['eauch', 'g_eauchaude', 'trumae', 'eaue', 'trumac', 'trumad', 'combi'], why: 'Chaque année, avec la vidange : anode, soupape et joints.' },
  { id: 'energie', label: 'Contrôle des batteries', season: '03-01', after: 4, rdv: 'energie', equipmentAny: ['g_batterie', 'agm', 'gel', 'lith', 'solaire', 'b2b'], why: 'Après l’hiver : charge, cosses et chargeur, avant de repartir.' },
  { id: 'pneus', label: 'Pneus (contrôle ou remplacement)' },
  { id: 'autre', label: 'Autre intervention' },
];
// The small checks the customer does himself, without a date.
const DEFAULT_TIPS = [
  { label: 'Pression des pneus', when: 'Toutes les 2 semaines en saison, et après un stockage' },
  { label: 'Niveaux moteur : huile, refroidissement, lave-glace', when: 'Avant un long trajet' },
];
const SOON_DAYS = 45; // shown as « à faire » (red dot) this many days before the date
const NOTIFY_DAYS = 15; // notified on the phone this many days before the date

// What the back-office saved, else the first kinds.
function settingsOf(db) {
  const v = getCatalogValue(db, 'entretien');
  return {
    kinds: Array.isArray(v?.kinds) ? v.kinds : DEFAULT_KINDS,
    tips: Array.isArray(v?.tips) ? v.tips : DEFAULT_TIPS,
  };
}
const kindsOf = (db) => settingsOf(db).kinds;
const labelOf = (kinds, id) => kinds.find((k) => k.id === id)?.label || 'Intervention';

const iso = (d) => d.toISOString().slice(0, 10);
const day = (s) => new Date(`${s}T12:00:00Z`);
const addMonths = (s, n) => {
  const d = day(s);
  d.setUTCMonth(d.getUTCMonth() + n);
  return iso(d);
};
const addDays = (s, n) => iso(new Date(day(s).getTime() + n * 86400000));

// Is this kind of maintenance for this customer? (A kind already noted in their logbook stays, whatever the targeting.)
function isFor(k, customer, own, ctx, lastDone) {
  if (k.active === false) return false;
  if (lastDone) return true;
  if (k.dealershipIds?.length && !k.dealershipIds.includes(customer.dealership_id)) return false;
  if (k.vehicleTypes?.length && !k.vehicleTypes.includes(ctx.vehicleType || '')) return false;
  const any = k.equipmentAny || k.needs || [];
  if (any.length && !any.some((id) => own[id])) return false;
  if ((k.equipmentNone || []).some((id) => own[id])) return false;
  return true;
}

// The dated items of a customer, earliest first: { kind, label, due, state: 'late' | 'soon' | 'later', rdv, why }.
// own: the equipment checked for the vehicle (fridge, water heater, batteries…); ctx: { vehicleType }.
function dueItems(customer, log, today = iso(new Date()), own = {}, kinds = DEFAULT_KINDS, ctx = {}) {
  const last = {};
  for (const e of log) if (!last[e.kind] || e.done_on > last[e.kind]) last[e.kind] = e.done_on;
  const out = [];
  for (const k of kinds) {
    const kind = k.id;
    if (!isFor(k, customer, own, ctx, last[kind])) continue;
    let due = null;
    if (k.every) {
      const base = last[kind] || customer.handover_date;
      if (!base) continue;
      due = addMonths(base, k.every);
    } else if (k.season) {
      const year = Number(today.slice(0, 4));
      // This season's date, or next year's once it is done (or long past).
      for (const y of [year - 1, year, year + 1]) {
        const d = `${y}-${k.season}`;
        const doneThisSeason = last[kind] && last[kind] >= addDays(d, -120);
        if (!doneThisSeason && addDays(d, 60) >= today) {
          due = d;
          break;
        }
      }
      // Not before the first season after the handover (nor too soon for a new vehicle: « after » months).
      const first = customer.handover_date ? addMonths(customer.handover_date, k.after || 0) : null;
      while (due && first && due < first) due = `${Number(due.slice(0, 4)) + 1}-${k.season}`;
    } else continue;
    if (!due) continue;
    const state = due < today ? 'late' : due <= addDays(today, SOON_DAYS) ? 'soon' : 'later';
    out.push({ kind, label: k.label, due, state, rdv: k.rdv, why: k.why, lastDone: last[kind] || null });
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

function logOf(db, customerId) {
  return db.prepare('SELECT id, done_on, kind, note, created_at FROM maintenance_log WHERE customer_id = ? ORDER BY done_on DESC, id DESC').all(customerId);
}

// Equipment checked by the customer (cdb_own), to know whether he has a fridge, a water heater, batteries…
// Without any change by the customer, the list ticked for the vehicle by the dealership (as the app does).
function ownOf(db, customerId) {
  const row = db.prepare("SELECT value FROM customer_state WHERE customer_id = ? AND key = 'cdb_own'").get(customerId);
  try {
    if (row) return JSON.parse(row.value) || {};
  } catch {
    return {};
  }
  const vehicle = db.prepare('SELECT v.* FROM vehicles v JOIN customers c ON c.vehicle_id = v.id WHERE c.id = ?').get(customerId);
  return vehicle ? Object.fromEntries((readProfile(vehicle).equipment || []).map((id) => [id, true])) : {};
}

function vehicleTypeOf(db, customer) {
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(customer.vehicle_id);
  return vehicle ? readProfile(vehicle).type || '' : '';
}

// Dates read on the parts (gas hose, regulator, detectors, extinguisher, tyres…: « dated » equipment) and entered by the
// customer in the app (cdb_dates, 'YYYY-MM'). until = end of validity; made = manufacturing date + years; every =
// last change + months. Returns the dated items (kind « date-<id> ») and the equipment whose date is still missing.
function datedOf(db, customer, today = iso(new Date()), own = ownOf(db, customer.id)) {
  let dates = {};
  try {
    dates = JSON.parse(db.prepare("SELECT value FROM customer_state WHERE customer_id = ? AND key = 'cdb_dates'").get(customer.id)?.value || '{}') || {};
  } catch {
    dates = {};
  }
  const items = [];
  const missing = [];
  for (const r of db.prepare('SELECT data FROM equipment').all()) {
    const q = JSON.parse(r.data);
    // An « always » element comes with its ensemble (the hose with the gas locker), as in the app.
    const has = own[q.id] || (q.grp && own[q.grp] && q.role === 'always' && !q.noimpl);
    if (!q.dated || !has) continue;
    const v = dates[q.id];
    if (!/^\d{4}-\d{2}$/.test(v || '')) {
      missing.push({ id: q.id, label: q.name, where: q.dated.label || '' });
      continue;
    }
    const start = `${v}-01`;
    const due = q.dated.kind === 'until' ? start : q.dated.kind === 'made' ? addMonths(start, 12 * (q.dated.years || 10)) : addMonths(start, q.dated.months || 12);
    const state = due < today ? 'late' : due <= addDays(today, SOON_DAYS) ? 'soon' : 'later';
    items.push({ kind: `date-${q.id}`, eq: q.id, dated: true, label: `${q.dated.kind === 'every' ? 'À changer' : 'À remplacer'} : ${q.name}`, due, state, rdv: null, why: q.dated.label || '' });
  }
  return { items, missing };
}

// What is due for one customer, with the kinds set in the back-office, and the dates read on the parts.
function dueFor(db, customer, today) {
  const own = ownOf(db, customer.id);
  const items = dueItems(customer, logOf(db, customer.id), today, own, kindsOf(db), { vehicleType: vehicleTypeOf(db, customer) });
  return [...items, ...datedOf(db, customer, today, own).items].sort((a, b) => a.due.localeCompare(b.due));
}

function entretienOf(db, customer, today) {
  const { kinds, tips } = settingsOf(db);
  const log = logOf(db, customer.id);
  const own = ownOf(db, customer.id);
  const ctx = { vehicleType: vehicleTypeOf(db, customer) };
  const dated = datedOf(db, customer, today || iso(new Date()), own);
  return {
    items: [...dueItems(customer, log, today, own, kinds, ctx), ...dated.items].sort((a, b) => a.due.localeCompare(b.due)),
    datesMissing: dated.missing,
    tips,
    log: log.map((e) => ({ id: e.id, doneOn: e.done_on, kind: e.kind, label: labelOf(kinds, e.kind), note: e.note })),
    // What the customer may note: the kinds for them (and « Autre intervention » kinds without a date).
    kinds: kinds.filter((k) => isFor(k, customer, own, ctx, log.some((e) => e.kind === k.id))).map((k) => [k.id, k.label]),
  };
}

// Checks what the back-office sends (« Carnet d'entretien »).
function cleanSettings(db, value) {
  if (!value || !Array.isArray(value.kinds) || !Array.isArray(value.tips)) throw new Error('Format invalide');
  const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '');
  const ids = new Set();
  const equipment = new Set(db.prepare('SELECT id FROM equipment').all().map((r) => r.id));
  const list = (v, keep) => [...new Set((Array.isArray(v) ? v : []).filter(keep))].slice(0, 60);
  const kinds = value.kinds.slice(0, 60).map((k) => {
    const label = str(k.label, 80);
    if (!label) throw new Error('Chaque entretien doit avoir un nom');
    let id = str(k.id, 30).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!id) id = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'entretien';
    let unique = id;
    for (let n = 2; ids.has(unique); n++) unique = `${id}-${n}`;
    ids.add(unique);
    const out = { id: unique, label };
    const why = str(k.why, 300);
    if (why) out.why = why;
    const rdv = str(k.rdv, 30);
    if (rdv) out.rdv = rdv;
    if (k.every) {
      const every = Math.round(Number(k.every));
      if (!(every >= 1 && every <= 120)) throw new Error(`« ${label} » : fréquence de 1 à 120 mois`);
      out.every = every;
    } else if (k.season) {
      if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(k.season)) throw new Error(`« ${label} » : date de saison invalide`);
      out.season = k.season;
      const after = Math.round(Number(k.after) || 0);
      if (after) out.after = Math.max(0, Math.min(36, after));
    }
    const dealershipIds = list(k.dealershipIds, (x) => Number.isInteger(x) && x > 0);
    if (dealershipIds.length) out.dealershipIds = dealershipIds;
    const vehicleTypes = list(k.vehicleTypes, (x) => typeof x === 'string' && x.length <= 30);
    if (vehicleTypes.length) out.vehicleTypes = vehicleTypes;
    const any = list(k.equipmentAny, (x) => equipment.has(x));
    const none = list(k.equipmentNone, (x) => equipment.has(x));
    if (any.some((x) => none.includes(x))) throw new Error(`« ${label} » : un même équipement ne peut pas être à la fois « ont » et « n’ont pas »`);
    if (any.length) out.equipmentAny = any;
    if (none.length) out.equipmentNone = none;
    if (k.active === false) out.active = false;
    return out;
  });
  const tips = value.tips.slice(0, 30).map((t) => ({ label: str(t.label, 120), when: str(t.when, 160) })).filter((t) => t.label);
  return { kinds, tips };
}

module.exports = { DEFAULT_KINDS, DEFAULT_TIPS, settingsOf, kindsOf, labelOf, dueItems, dueFor, entretienOf, logOf, ownOf, cleanSettings, SOON_DAYS, NOTIFY_DAYS };
