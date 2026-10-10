'use strict';
// Checks every link between the equipment and what depends on it: diagnostics (eq, questions answered by a variant,
// causes kept or dropped by a variant), daily lists (eq, variant), workshop reasons, maintenance logbook, banners,
// and the app configuration (implied equipment, variants). An equipment a customer can no longer have (hidden, or
// only reachable through a hidden one) would make a diagnostic or a list line vanish for everyone.
//   node tools/check-equipment-links.js            → on a fresh copy of the site's contents
//   DATA_DIR=… node tools/check-equipment-links.js → on that site's data
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = process.env.DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'links-'));
const { createApp } = require('../server/app');
const app = createApp({ dataDir, log: () => {} });
const { db } = app;
const json = (key) => {
  const r = db.prepare('SELECT value FROM catalog WHERE key = ?').get(key);
  return r ? JSON.parse(r.value) : null;
};
const eq = new Map(db.prepare('SELECT data FROM equipment').all().map((r) => [JSON.parse(r.data).id, JSON.parse(r.data)]));
const cfg = json('config') || {};
const HIDDEN = cfg.HIDDEN_EQ || {};
const VARIANTS = cfg.VARIANTS || {};
const IMPL = cfg.IMPL || {};
const ALIAS = cfg.OWN_ALIAS || {};
const problems = [];
const bad = (where, msg) => problems.push(`${where} : ${msg}`);

// What a customer can tick: visible, and its ensemble visible. What comes with it: implied by a tickable parent
// (configuration or « always » element of a tickable ensemble), or the alias of a tickable one.
const tickable = (id) => {
  const q = eq.get(id);
  if (!q || HIDDEN[id]) return false;
  return !q.grp || q.grp === id || (eq.has(q.grp) && !HIDDEN[q.grp]);
};
const memo = {};
function ownable(id, seen = new Set()) {
  if (id in memo) return memo[id];
  if (seen.has(id)) return false;
  seen.add(id);
  let ok = tickable(id);
  if (!ok) ok = Object.entries(IMPL).some(([p, kids]) => kids.includes(id) && ownable(p, seen));
  if (!ok) {
    const q = eq.get(id);
    ok = !!(q && q.grp && q.role === 'always' && !q.noimpl && ownable(q.grp, seen));
  }
  if (!ok && ALIAS[id]) ok = ownable(ALIAS[id], seen);
  return (memo[id] = ok);
}
const checkEq = (where, id) => {
  if (!eq.has(id)) bad(where, `équipement inconnu « ${id} »`);
  else if (!ownable(id)) bad(where, `« ${eq.get(id).name} » (${id}) ne peut plus être coché par personne`);
};
const checkAny = (where, ids) => {
  (ids || []).forEach((id) => !eq.has(id) && bad(where, `équipement inconnu « ${id} »`));
  if (ids && ids.length && !ids.some((id) => eq.has(id) && ownable(id))) bad(where, `aucun de ces équipements ne peut être coché : ${ids.join(', ')}`);
};
const checkVar = (where, key, values) => {
  const V = VARIANTS[key];
  if (!V) return bad(where, `question de type inconnue « ${key} »`);
  if (!ownable(key)) bad(where, `la question « ${V.q} » porte sur un équipement que personne ne peut cocher (${key})`);
  const known = new Set(V.o.map((o) => o[0]));
  (values || []).forEach((v) => !known.has(v) && bad(where, `réponse « ${v} » absente de la question « ${V.q} »`));
};

// Diagnostics
for (const r of db.prepare('SELECT data FROM diagnostics').all()) {
  const d = JSON.parse(r.data);
  const at = `Diagnostic ${d.id} « ${d.label} »`;
  if (d.eq) checkEq(at, d.eq);
  if (d.vonly) checkVar(at, d.vonly[0], d.vonly[1]);
  const walk = (n) => {
    if (!n || n.cause) return;
    if (n.vk) {
      checkVar(at, n.vk, (n.vv || []).flatMap((p) => String(p).split('|')).filter(Boolean));
      if (!Array.isArray(n.vv) || n.vv.length !== n.o.length) bad(at, `la question « ${n.t} » n'a pas une réponse par type pour chaque choix`);
    }
    (n.n || []).forEach(walk);
  };
  walk(d.tree);
  for (const c of d.elim?.causes || []) {
    if (c.only) checkVar(`${at}, cause ${c.k}`, c.only[0], c.only[1]);
    if (c.not) checkVar(`${at}, cause ${c.k}`, c.not[0], c.not[1]);
  }
}
// Daily lists
for (const [k, l] of Object.entries(json('lists') || {})) {
  (l.items || []).forEach((it, i) => {
    if (!it || typeof it !== 'object') return;
    const at = `Liste « ${l.title || k} », ligne ${i + 1}`;
    if (it.eq) checkAny(at, it.eq);
    if (it.variant) checkVar(at, it.variant[0], [it.variant[1]]);
  });
}
// Workshop reasons, maintenance logbook, banners
for (const m of json('motifs') || []) if (m.needs) checkAny(`Motif d’atelier « ${m.t} »`, m.needs);
const { kindsOf } = require('../server/entretien');
for (const k of kindsOf(db)) {
  if (k.equipmentAny) checkAny(`Carnet « ${k.label} »`, k.equipmentAny);
  (k.equipmentNone || []).forEach((id) => !eq.has(id) && bad(`Carnet « ${k.label} »`, `équipement inconnu « ${id} »`));
}
for (const b of db.prepare('SELECT title, equipment_any, equipment_none FROM banners').all()) {
  const any = JSON.parse(b.equipment_any || '[]');
  if (any.length) checkAny(`Bandeau « ${b.title} »`, any);
}
// App configuration
for (const [p, kids] of Object.entries(IMPL)) {
  if (!eq.has(p)) bad('IMPL', `parent inconnu « ${p} »`);
  kids.forEach((c) => !eq.has(c) && bad('IMPL', `élément inconnu « ${c} » (de ${p})`));
}
for (const [id, set] of Object.entries(cfg.APP_VARS || {})) {
  if (!eq.has(id)) bad('APP_VARS', `équipement inconnu « ${id} »`);
  for (const [k, v] of Object.entries(set)) checkVar(`APP_VARS ${id}`, k, [v]);
}
for (const key of Object.keys(VARIANTS)) if (!eq.has(key)) bad('VARIANTS', `question sur un équipement inconnu « ${key} »`);
// Ensembles
for (const q of eq.values()) {
  if (q.grp && !eq.has(q.grp)) bad(`Équipement ${q.id}`, `ensemble inconnu « ${q.grp} »`);
  if (q.role === 'pick' && !q.pick) bad(`Équipement ${q.id}`, 'élément « un seul au choix » sans groupe de choix');
  if (q.role === 'pick' && q.grp && !(eq.get(q.grp)?.picks || {})[q.pick]) bad(`Équipement ${q.id}`, `pas de question pour le choix « ${q.pick} »`);
}

console.log(`Équipements : ${eq.size} (${Object.keys(HIDDEN).length} retirés). Liens contrôlés : diagnostics, listes, motifs, carnet, bandeaux, configuration.`);
console.log(problems.length ? `\n${problems.length} problème(s) :\n- ${problems.join('\n- ')}` : 'Aucun problème.');
app.server?.close?.();
db.close();
if (!process.env.DATA_DIR) fs.rmSync(dataDir, { recursive: true, force: true });
process.exit(problems.length ? 1 : 0);
