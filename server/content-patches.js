'use strict';

// Corrections of the diagnostic content found by the simulations (see docs/SIMULATIONS.md).
// Each one is applied once, and only if the end point still has its original text: a change made
// meanwhile in the back-office always wins.

const { getSetting, setSetting, bumpContentVersion, transaction } = require('./db');
const { NEW_EQUIPMENT, EQUIPMENT_TYPES, GENERIC_NAMES, DEFAULT_SPOTS } = require('./vehicle-types');

const PATCHES = [
  {
    key: '2026-10-08-truma-ventouse-securite',
    diagnostic: 'g_truma',
    match: { cause: "Des saletés gênent l'arrivée d'air et la sortie des gaz brûlés." },
    set: { sec: 'Odeur de gaz, fumée ou suie : coupez, aérez et appelez un professionnel.' },
  },
  {
    key: '2026-10-08-fuite-raccord',
    diagnostic: 'leak',
    match: { cause: 'Un collier était desserré.' },
    set: { cause: 'Un raccord était desserré.' },
  },
  {
    // Every silhouette covered (van, fourgon, profilés, intégral, capucine): new equipment, types each one applies to,
    // generic names (the vehicles that had the old, model-specific name keep it as their own name).
    key: '2026-10-09-types-de-vehicules',
    run: (db) => {
      let changed = 0;
      const rows = new Map(db.prepare('SELECT id, data FROM equipment').all().map((r) => [r.id, JSON.parse(r.data)]));
      const save = (q) => db.prepare('UPDATE equipment SET data = ? WHERE id = ?').run(JSON.stringify(q), q.id);
      let sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM equipment').get().n;
      for (const q of NEW_EQUIPMENT) {
        if (rows.has(q.id)) continue;
        db.prepare('INSERT INTO equipment (id, sort, data) VALUES (?, ?, ?)').run(q.id, ++sort, JSON.stringify(q));
        changed++;
      }
      for (const [id, types] of Object.entries(EQUIPMENT_TYPES)) {
        const q = rows.get(id);
        if (q && !Array.isArray(q.types)) {
          q.types = types;
          save(q);
          changed++;
        }
      }
      for (const [id, spot] of Object.entries(DEFAULT_SPOTS)) {
        const q = rows.get(id);
        if (q && (!q.spot || (id === 'pavillon' && q.spot === 'cab'))) {
          q.spot = spot;
          save(q);
          changed++;
        }
      }
      const vehicles = db.prepare('SELECT id, profile FROM vehicles').all();
      for (const [id, [before, after]] of Object.entries(GENERIC_NAMES)) {
        const q = rows.get(id);
        if (!q || q.name !== before) continue;
        q.name = after;
        save(q);
        changed++;
        for (const v of vehicles) {
          const p = JSON.parse(v.profile || '{}');
          if (!Array.isArray(p.equipment) || !p.equipment.includes(id)) continue;
          p.labels = { ...(p.labels || {}) };
          if (!p.labels[id]) p.labels[id] = before;
          v.profile = JSON.stringify(p);
          db.prepare('UPDATE vehicles SET profile = ? WHERE id = ?').run(v.profile, v.id);
        }
      }
      return changed;
    },
  },
];

function findLeaves(node, match, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node.n)) node.n.forEach((c) => findLeaves(c, match, out));
  else if (Object.entries(match).every(([k, v]) => node[k] === v)) out.push(node);
  return out;
}

function applyContentPatches(db, log = console.log) {
  const done = new Set(JSON.parse(getSetting(db, 'content_patches', '[]')));
  const todo = PATCHES.filter((p) => !done.has(p.key));
  if (!todo.length) return;
  transaction(db, () => {
    let changed = 0;
    for (const p of todo) {
      if (p.run) {
        changed += p.run(db);
        done.add(p.key);
        continue;
      }
      const row = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(p.diagnostic);
      if (row) {
        const data = JSON.parse(row.data);
        const leaves = findLeaves(data.tree, p.match);
        leaves.forEach((leaf) => Object.assign(leaf, p.set));
        if (leaves.length) {
          db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(data), p.diagnostic);
          changed += leaves.length;
        }
      }
      done.add(p.key);
    }
    setSetting(db, 'content_patches', JSON.stringify([...done]));
    if (changed) {
      bumpContentVersion(db);
      log(`[contenu] ${changed} correction(s) de contenu appliquée(s).`);
    }
  });
}

module.exports = { applyContentPatches, PATCHES };
