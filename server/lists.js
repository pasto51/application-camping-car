'use strict';

// « Gestes du quotidien »: the lists of the app (Arrivée, Départ, Hivernage, Remise en route, Chaque mois…).
// Each list: its lines, its place in the menu (on the road / seasons), whether it asks where the customer stops
// (campsite or service area / free parking), when it unticks itself, and a reminder on the phone on some months.

const SECTIONS = ['route', 'saison'];
const WHERE = ['camping', 'libre'];
// « jour »: the day after it was started; a number: that many days after.
const RESETS = ['jour', 7, 14, 30, 60, 90, 180, 365];

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanItem(it) {
  if (typeof it === 'string') {
    const t = str(it, 600);
    if (!t) throw new Error('Ligne vide');
    return t;
  }
  if (!it || typeof it !== 'object') throw new Error('Ligne invalide');
  const t = str(it.t, 600);
  if (!t) throw new Error('Ligne vide');
  const out = { t };
  if (Array.isArray(it.eq)) {
    const eq = it.eq.filter((e) => typeof e === 'string' && /^[a-z0-9_-]{1,40}$/i.test(e)).slice(0, 30);
    if (eq.length) out.eq = eq;
  }
  if (out.eq && str(it.group, 30)) out.group = str(it.group, 30).toLowerCase();
  if (Array.isArray(it.variant) && it.variant.length === 2 && it.variant.every((v) => typeof v === 'string' && v.length <= 40)) out.variant = [it.variant[0], it.variant[1]];
  if (WHERE.includes(it.where)) out.where = it.where;
  return Object.keys(out).length === 1 ? t : out;
}

// Rebuilt field by field (nothing else is kept from what the back-office sent).
function cleanLists(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Format invalide');
  const out = {};
  for (const [k, list] of Object.entries(value)) {
    if (!/^[a-z0-9_-]{1,30}$/.test(k) || !list || !Array.isArray(list.items)) throw new Error(`Liste « ${k} » invalide`);
    let items;
    try {
      items = list.items.slice(0, 200).map(cleanItem);
    } catch (err) {
      throw new Error(`Liste « ${k} » : ${err.message}`);
    }
    const L = { title: str(list.title, 40), goal: str(list.goal, 300), note: str(list.note, 300), items };
    if (SECTIONS.includes(list.section)) L.section = list.section;
    if (list.places) L.places = true;
    const reset = list.reset === 'jour' ? 'jour' : Number(list.reset);
    if (RESETS.includes(reset)) L.reset = reset;
    const months = Array.isArray(list.notify?.months) ? [...new Set(list.notify.months.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b) : [];
    if (months.length) L.notify = { months };
    out[k] = L;
  }
  return out;
}

const DAY = 86400000;
const periodDays = (L) => (L.reset === 'jour' ? 1 : Number(L.reset) || 30);

// The reminders to send today: for each list with months, at most one per period (the time before it unticks
// itself, a month by default), and not when the customer completed it during that period.
function listReminders(lists, chk, sent, now = Date.now()) {
  const month = new Date(now).getUTCMonth() + 1;
  const out = [];
  for (const [k, L] of Object.entries(lists || {})) {
    if (!L.notify?.months?.includes(month)) continue;
    const period = periodDays(L) * DAY;
    const done = Number(chk?._d?.[k]) || 0;
    if (done && now - done < period) continue;
    const last = sent[k] ? Date.parse(`${sent[k]}T00:00:00Z`) : 0;
    if (last && now - last < period) continue;
    out.push({ key: k, title: L.title || k, count: (L.items || []).length });
  }
  return out;
}

module.exports = { cleanLists, listReminders, RESETS, SECTIONS, WHERE };
