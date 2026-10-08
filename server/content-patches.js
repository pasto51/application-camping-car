'use strict';

// Corrections of the diagnostic content found by the simulations (see docs/SIMULATIONS.md).
// Each one is applied once, and only if the end point still has its original text: a change made
// meanwhile in the back-office always wins.

const { getSetting, setSetting, bumpContentVersion, transaction } = require('./db');

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
      log(`[contenu] ${changed} fin(s) de parcours corrigée(s).`);
    }
  });
}

module.exports = { applyContentPatches, PATCHES };
