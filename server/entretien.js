'use strict';

// Maintenance: what is due for a customer (from the handover date and what they noted in their logbook), and the
// logbook itself. The customer keeps the logbook (« J'ai fait le test d'étanchéité le… »): the next date follows from it.

const KINDS = {
  etanch: { label: 'Test d’étanchéité', every: 12, rdv: 'etanch', why: 'Une fois par an : souvent exigé pour garder la garantie étanchéité.' },
  revision: { label: 'Révision annuelle', every: 12, rdv: 'revision', why: 'Entretien du porteur et de la cellule.' },
  gaz: { label: 'Contrôle de l’installation gaz', every: 24, rdv: 'gaz', why: 'Tuyaux, détendeur et appareils au gaz : pour votre sécurité.' },
  chauf: { label: 'Révision du chauffage', season: '10-01', after: 10, rdv: 'chauf', why: 'Avant l’hiver, pour ne pas tomber en panne au froid.' },
  hiv: { label: 'Hivernage', season: '10-15', rdv: 'hiv', why: 'Vidange de l’eau et protection contre le gel avant l’hiver.' },
  printemps: { label: 'Remise en route (déshivernage)', season: '03-15', after: 4, rdv: 'revision', why: 'Avant la saison : eau, gaz, batteries et étanchéité.' },
  pneus: { label: 'Pneus (contrôle ou remplacement)' },
  autre: { label: 'Autre intervention' },
};
const SOON_DAYS = 45; // shown, and notified, this many days before the date

const iso = (d) => d.toISOString().slice(0, 10);
const day = (s) => new Date(`${s}T12:00:00Z`);
const addMonths = (s, n) => {
  const d = day(s);
  d.setUTCMonth(d.getUTCMonth() + n);
  return iso(d);
};
const addDays = (s, n) => iso(new Date(day(s).getTime() + n * 86400000));

// The dated items of a customer, earliest first: { kind, label, due, state: 'late' | 'soon' | 'later', rdv, why }.
function dueItems(customer, log, today = iso(new Date())) {
  const last = {};
  for (const e of log) if (!last[e.kind] || e.done_on > last[e.kind]) last[e.kind] = e.done_on;
  const out = [];
  for (const [kind, k] of Object.entries(KINDS)) {
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

function entretienOf(db, customer, today) {
  const log = logOf(db, customer.id);
  return {
    items: dueItems(customer, log, today),
    log: log.map((e) => ({ id: e.id, doneOn: e.done_on, kind: e.kind, label: KINDS[e.kind]?.label || 'Intervention', note: e.note })),
    kinds: Object.entries(KINDS).map(([id, k]) => [id, k.label]),
  };
}

module.exports = { KINDS, dueItems, entretienOf, logOf, SOON_DAYS };
