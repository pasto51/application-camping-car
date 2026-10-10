'use strict';

// Applies the « ensembles / éléments » arrangement (server/equipment-groups.js) to the equipment of a site, once
// (content patch « 2026-10-28-ensembles »). Existing equipment keeps its id; new ensembles and elements are created.
// On each equipment: ens (it is an ensemble), grp (its ensemble), role (always / option / pick), pick (radio key),
// picks (on the ensemble: the question of each radio key), note, dated, alt.
// noimpl (an « always » element brought by another element, not by the ensemble). The app ticks the « always » elements
// with their ensemble. In the app configuration: VARIANTS (model questions), HIDDEN_EQ (dropped items).

const { GROUPS, HIDE, PHOTO_VIEWS } = require('./equipment-groups');

const variantOf = (v) => ({ q: v.q, o: [...v.o.map((label, i) => [`v${i + 1}`, label, '', '']), ['ns', 'Je ne sais pas', '', '']] });

function applyEnsembles(db) {
  const rows = new Map(db.prepare('SELECT id, data FROM equipment').all().map((r) => [r.id, JSON.parse(r.data)]));
  const cfgRow = db.prepare("SELECT value FROM catalog WHERE key = 'config'").get();
  const cfg = cfgRow ? JSON.parse(cfgRow.value) : {};
  cfg.IMPL = cfg.IMPL || {};
  cfg.VARIANTS = cfg.VARIANTS || {};
  cfg.IMPL_VISIBLE = cfg.IMPL_VISIBLE || {};
  cfg.HIDDEN_EQ = cfg.HIDDEN_EQ || {};
  let sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM equipment').get().n;
  const created = new Set();
  const create = (q) => {
    const item = { base: false, tip: '', img: '', kw: '', ...q };
    rows.set(q.id, item);
    created.add(q.id);
  };
  const addVariant = (id, v) => {
    if (v && !cfg.VARIANTS[id]) cfg.VARIANTS[id] = variantOf(v);
  };
  const removeImpl = (parent, child) => {
    if (!cfg.IMPL[parent]) return;
    cfg.IMPL[parent] = cfg.IMPL[parent].filter((c) => c !== child);
    if (!cfg.IMPL[parent].length) delete cfg.IMPL[parent];
  };
  // The water pump now belongs to the fresh-water circuit (not the other way round), and the area under the hob is
  // only an option (it cannot always be photographed).
  removeImpl('pompe', 'propre');
  removeImpl('rechaud', 'dessous_plaque');

  for (const g of GROUPS) {
    let ens = rows.get(g.id);
    const kidsThere = g.kids.map((k) => rows.get(k.id)).filter(Boolean);
    if (!ens) {
      if (!g.new) continue;
      const from = g.spotFrom ? rows.get(g.spotFrom) : kidsThere.find((k) => k.spot);
      const types = kidsThere.some((k) => !Array.isArray(k.types) || !k.types.length) || !kidsThere.length ? [] : [...new Set(kidsThere.flatMap((k) => k.types))];
      create({ id: g.id, cat: g.cat, name: g.name, text: g.text || '', spot: from?.spot || null, types });
      ens = rows.get(g.id);
    } else if (g.name) ens.name = g.name;
    ens.ens = true;
    for (const f of ['picks', 'note', 'dated', 'alt']) if (g[f]) ens[f] = g[f];
    addVariant(g.id, g.variant);
    for (const k of g.kids) {
      let q = rows.get(k.id);
      if (!q) {
        if (!k.new) continue;
        create({ id: k.id, cat: g.cat, name: k.name, text: k.text || '', spot: null, types: Array.isArray(ens.types) ? ens.types : [] });
        q = rows.get(k.id);
      } else if (k.name) q.name = k.name;
      q.grp = g.id;
      q.role = k.role;
      if (k.pick) q.pick = k.pick;
      for (const f of ['note', 'dated']) if (k[f]) q[f] = k[f];
      addVariant(k.id, k.variant);
      // Brought by another element (the Truma plate comes with the Truma Combi): not ticked with the ensemble.
      if (k.impl === false) q.noimpl = true;
    }
  }
  // An ensemble brought by another equipment (grey water with the shower) stays visible and is not unticked with it.
  const implied = new Set(Object.values(cfg.IMPL).flat());
  for (const [id, q] of rows) if (q.ens && implied.has(id)) cfg.IMPL_VISIBLE[id] = 1;
  for (const id of HIDE) cfg.HIDDEN_EQ[id] = 1;

  for (const [id, q] of rows) {
    if (created.has(id)) db.prepare('INSERT INTO equipment (id, sort, data) VALUES (?, ?, ?)').run(id, ++sort, JSON.stringify(q));
    else db.prepare('UPDATE equipment SET data = ? WHERE id = ?').run(JSON.stringify(q), id);
  }
  db.prepare("INSERT INTO catalog (key, value) VALUES ('config', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").run(JSON.stringify(cfg));
  return created.size + GROUPS.length;
}

// Second pass (« 2026-10-29-ensembles-retouches »): the old general heating and hot water hidden, the vehicle photos
// stored as equipment kept on the plan.
function hideDropped(db) {
  const row = db.prepare("SELECT value FROM catalog WHERE key = 'config'").get();
  if (!row) return 0;
  const cfg = JSON.parse(row.value);
  cfg.HIDDEN_EQ = cfg.HIDDEN_EQ || {};
  for (const id of HIDE) cfg.HIDDEN_EQ[id] = 1;
  cfg.PHOTO_VIEWS = PHOTO_VIEWS;
  db.prepare("UPDATE catalog SET value = ?, updated_at = datetime('now') WHERE key = 'config'").run(JSON.stringify(cfg));
  return HIDE.length;
}

module.exports = { applyEnsembles, hideDropped };
