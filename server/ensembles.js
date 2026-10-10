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

// Third pass (« 2026-10-30-diagnostics-ensembles »): nothing points any more to the dropped equipment, so that the
// diagnostics, lists, workshop reasons and logbook stay right when nobody ticks it.
// - The old general heating and hot water come with their ensemble (behind the scenes, for the diagnostics).
// - The lead battery (no longer fitted) gives way to the « Batterie cellule » ensemble; its lead-only questions go.
function retargetDropped(db) {
  let changed = 0;
  const get = (key) => {
    const row = db.prepare('SELECT value FROM catalog WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : null;
  };
  const put = (key, value) => db.prepare("UPDATE catalog SET value = ?, updated_at = datetime('now') WHERE key = ?").run(JSON.stringify(value), key);
  const swapCell = (ids) => (Array.isArray(ids) && ids.includes('cell') ? [...new Set(ids.map((x) => (x === 'cell' ? 'g_batterie' : x)))] : ids);

  const cfg = get('config');
  if (cfg) {
    cfg.HIDDEN_EQ = cfg.HIDDEN_EQ || {};
    for (const id of HIDE) cfg.HIDDEN_EQ[id] = 1;
    cfg.IMPL = cfg.IMPL || {};
    for (const [ens, child] of [['g_chauffage', 'chauf'], ['g_eauchaude', 'eauch']]) {
      cfg.IMPL[ens] = [...new Set([...(cfg.IMPL[ens] || []), child])];
    }
    put('config', cfg);
    changed++;
  }

  const diag = (id, fn) => {
    const row = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(id);
    if (!row) return;
    const d = fn(JSON.parse(row.data));
    db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(d), id);
    changed++;
  };
  const text = (d, pairs) => {
    let t = JSON.stringify(d);
    for (const [a, b] of pairs) t = t.split(a).join(b);
    return JSON.parse(t);
  };
  diag('batdrain', (d) => text({ ...d, eq: d.eq === 'cell' ? 'g_batterie' : d.eq }, [['Une batterie au plomb dure en général', 'Une batterie AGM ou gel dure en général']]));
  diag('h_bat', (d) => {
    if (d.eq === 'cell') d.eq = 'g_batterie';
    if (d.label === 'J\'ai une question sur ma batterie au plomb ou AGM') d.label = 'J\'ai une question sur ma batterie cellule AGM ou gel';
    if (d.kw) d.kw = d.kw.replace(/\bplomb\b ?/g, '');
    const t = d.tree;
    if (t && Array.isArray(t.o)) {
      const keep = t.o.map((o, i) => (/plomb/i.test(o) ? -1 : i)).filter((i) => i >= 0);
      if (keep.length && keep.length < t.o.length) {
        t.n = keep.map((i) => t.n[i]);
        t.o = keep.map((i) => t.o[i]);
      }
    }
    return d;
  });
  // What stays of the lead battery inside the questions: the « lead or AGM/gel? » question keeps the AGM/gel answer,
  // a « lead » answer goes, and the texts no longer speak of lead.
  const noLead = (n) => {
    if (!n || n.cause) return n;
    if (/plomb/i.test(n.t)) {
      const i = n.o.findIndex((o) => /AGM|gel/i.test(o) && !/plomb/i.test(o));
      if (i >= 0) return noLead(n.n[i]);
    }
    const keep = n.o.map((o, i) => (/plomb/i.test(o) ? -1 : i)).filter((i) => i >= 0);
    if (keep.length && keep.length < n.o.length) {
      n.n = keep.map((i) => n.n[i]);
      n.o = keep.map((i) => n.o[i]);
    }
    n.n = n.n.map(noLead);
    return n;
  };
  diag('h_bat', (d) => text({ ...d, tree: noLead(d.tree) }, [['Des charges trop rares abîment les batteries au plomb.', 'Des charges trop rares abîment les batteries.']]));
  diag('nocharge', (d) => text(d, [['Non, plomb ou AGM', 'Non, AGM ou gel']]));
  diag('p_autonomie', (d) => text(d, [['Une batterie classique (plomb, AGM ou gel)', 'Une batterie classique (AGM ou gel)']]));

  const lists = get('lists');
  if (lists) {
    for (const l of Object.values(lists)) {
      (l.items || []).forEach((it) => {
        if (!it || typeof it !== 'object' || !Array.isArray(it.eq) || !it.eq.includes('cell')) return;
        it.eq = it.eq.filter((x) => x !== 'cell');
        if (!it.eq.length) it.eq = ['g_batterie'];
        it.t = String(it.t).replace('classique (plomb, AGM, gel)', 'classique (AGM ou gel)');
        changed++;
      });
    }
    put('lists', lists);
  }
  for (const key of ['motifs', 'reminders']) {
    const v = get(key);
    if (!Array.isArray(v)) continue;
    v.forEach((m) => {
      if (m.needs) m.needs = swapCell(m.needs);
      if (m.needs && m.needs.includes('chauf') && !m.needs.includes('g_chauffage')) m.needs.push('g_chauffage');
      if (m.needs && m.needs.includes('eauch') && !m.needs.includes('g_eauchaude')) m.needs.push('g_eauchaude');
    });
    put(key, v);
    changed++;
  }
  const ent = get('entretien');
  if (ent && Array.isArray(ent.kinds)) {
    ent.kinds.forEach((k) => {
      k.equipmentAny = swapCell(k.equipmentAny);
      k.equipmentNone = swapCell(k.equipmentNone);
    });
    put('entretien', ent);
    changed++;
  }
  for (const b of db.prepare('SELECT id, equipment_any, equipment_none FROM banners').all()) {
    const any = swapCell(JSON.parse(b.equipment_any || '[]'));
    const none = swapCell(JSON.parse(b.equipment_none || '[]'));
    db.prepare('UPDATE banners SET equipment_any = ?, equipment_none = ? WHERE id = ?').run(JSON.stringify(any), JSON.stringify(none), b.id);
  }
  return changed;
}

module.exports = { applyEnsembles, hideDropped, retargetDropped };
