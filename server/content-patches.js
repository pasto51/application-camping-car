'use strict';

// Corrections of the diagnostic content found by the simulations (see docs/SIMULATIONS.md).
// Each one is applied once, and only if the end point still has its original text: a change made
// meanwhile in the back-office always wins.

const { getSetting, setSetting, bumpContentVersion, transaction } = require('./db');
const { NEW_EQUIPMENT, NEW_EQUIPMENT_2026, EQUIPMENT_TYPES, GENERIC_NAMES, DEFAULT_SPOTS } = require('./vehicle-types');
const { NEW_DIAGNOSTICS, STORE_BRANCHES } = require('./diagnostics-pieces');
// Store first: specialised products sold in the store instead of home remedies (see CLAUDE.md).
const STORE_PRODUCTS = require('./seed/diag-magasin.json');
const STORE_QUESTIONS = [
  [['c_tank_niveau'], "Pouvez-vous accéder aux sondes du réservoir et les nettoyer à l'eau vinaigrée ?", 'Pouvez-vous accéder aux sondes du réservoir et les nettoyer avec un nettoyant détartrant spécial réservoirs (vendu en magasin) ?'],
  [['g_trumad', 'g_truma', 'g_web'], "Couvrez le panneau solaire d'une bâche ou d'un carton puis relancez : le défaut a-t-il disparu ?", 'Couvrez le panneau solaire avec une housse de protection puis relancez : le défaut a-t-il disparu ?'],
  [['h_wc'], "Videz et rincez la cassette à l'eau chaude, puis passez vinaigre blanc et bicarbonate. L'odeur a-t-elle disparu ?", "Videz et rincez la cassette à l'eau chaude, puis laissez agir un nettoyant détartrant spécial cassette (vendu en magasin). L'odeur a-t-elle disparu ?"],
  [['h_clim'], 'Nettoyez le filtre à particules du diffuseur (chiffon doux ou aspirateur) et relancez. L\'air est-il plus frais ?', 'Nettoyez le filtre à particules du diffuseur avec un nettoyant spécial filtres de clim (vendu en magasin) et relancez. L\'air est-il plus frais ?'],
  [['h_clim'], 'Changez les piles (LR3 neuves, bien orientées) et nettoyez les lamelles avec un chiffon sec. La clim répond-elle ?', 'Changez les piles (LR3 neuves, bien orientées) et nettoyez les lamelles avec une lingette microfibre. La clim répond-elle ?'],
  [['h_solaire'], 'Nettoyez le panneau avec un chiffon humide et placez le véhicule en plein soleil, hors de toute ombre. La charge revient-elle ?', 'Nettoyez le panneau avec un nettoyant spécial panneaux solaires et placez le véhicule en plein soleil, hors de toute ombre. La charge revient-elle ?'],
  [['h_solaire'], 'Nettoyez le panneau avec un chiffon humide : feuilles, fientes, saleté. La charge remonte-t-elle ?', 'Nettoyez le panneau avec un nettoyant spécial panneaux solaires : feuilles, fientes, saleté. La charge remonte-t-elle ?'],
  [['h_eau'], "Nettoyez le joint d'ouvrant avec un chiffon humide et refermez bien la fenêtre. Le passage d'eau ou d'air continue-t-il ?", "Nettoyez le joint d'ouvrant avec un nettoyant pour joints et refermez bien la fenêtre. Le passage d'eau ou d'air continue-t-il ?"],
  [['h_tv'], 'Essuyez le disque avec un chiffon doux. Se lit-il maintenant ?', 'Essuyez le disque avec une lingette microfibre. Se lit-il maintenant ?'],
  [['h_tv'], "Éteignez l'écran et passez doucement un chiffon doux, sans produit. Le point a-t-il disparu ?", "Éteignez l'écran et passez doucement une lingette microfibre spéciale écrans. Le point a-t-il disparu ?"],
  [['h_gaz'], "Pulvérisez de l'eau savonneuse sur les raccords, bouteille ouverte. Des bulles se forment-elles ?", 'Pulvérisez un spray détecteur de fuites de gaz (vendu en magasin) sur les raccords, bouteille ouverte. Des bulles se forment-elles ?'],
  [['h_gaz'], "Fermez la bouteille et pulvérisez de l'eau savonneuse sur les raccords, puis rouvrez. Des bulles se forment-elles ?", 'Fermez la bouteille et pulvérisez un spray détecteur de fuites de gaz (vendu en magasin) sur les raccords, puis rouvrez. Des bulles se forment-elles ?'],
];


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
  {
    // Equipment and vehicle types found in the 2026-2027 Challenger, Randger and Rimor catalogues.
    // Types are only widened if they were still the ones set by the previous patch (a back-office edit wins).
    key: '2026-10-10-catalogues-constructeurs',
    run: (db) => {
      let changed = 0;
      const rows = new Map(db.prepare('SELECT id, data FROM equipment').all().map((r) => [r.id, JSON.parse(r.data)]));
      let sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM equipment').get().n;
      for (const q of NEW_EQUIPMENT_2026) {
        if (rows.has(q.id)) continue;
        db.prepare('INSERT INTO equipment (id, sort, data) VALUES (?, ?, ?)').run(q.id, ++sort, JSON.stringify(q));
        changed++;
      }
      const WIDEN = {
        superp: [['profile', 'integral', 'capucine'], ['fourgon', 'profile', 'integral', 'capucine']],
        pavillon: [['compact', 'profile', 'integral'], ['van', 'fourgon', 'compact', 'profile', 'integral']],
        baies: [['compact', 'profile', 'integral', 'capucine'], []],
        hotte: [['compact', 'profile', 'integral', 'capucine'], []],
        douche_sep: [['compact', 'profile', 'integral', 'capucine'], []],
        sdb_mod: [['van', 'fourgon', 'compact'], ['van', 'fourgon', 'compact', 'profile']],
        echelle_lit: [['compact', 'profile', 'integral', 'capucine'], []],
        lant_pav: [['compact', 'profile', 'integral'], ['van', 'fourgon', 'compact', 'profile', 'integral']],
        garage: [['profile', 'integral', 'capucine'], ['fourgon', 'compact', 'profile', 'integral', 'capucine']],
        lit_central: [['profile', 'integral', 'capucine'], ['fourgon', 'profile', 'integral', 'capucine']],
      };
      for (const [id, [before, after]] of Object.entries(WIDEN)) {
        const q = rows.get(id);
        if (!q || JSON.stringify(q.types || []) !== JSON.stringify(before)) continue;
        q.types = after;
        db.prepare('UPDATE equipment SET data = ? WHERE id = ?').run(JSON.stringify(q), id);
        changed++;
      }
      return changed;
    },
  },
  {
    // Written from the composition of the equipment (spare-parts catalogue): bike rack, store parts that wear.
    // A diagnostic already there (same id) and store answers already there are left as they are.
    key: '2026-10-11-pieces-groupe-porte-velos-store',
    run: (db) => {
      let changed = 0;
      let sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM diagnostics').get().n;
      for (const d of NEW_DIAGNOSTICS) {
        if (db.prepare('SELECT 1 FROM diagnostics WHERE id = ?').get(d.id)) continue;
        db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(d.id, ++sort, JSON.stringify(d));
        changed++;
      }
      const row = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get('h_store');
      if (row) {
        const store = JSON.parse(row.data);
        const root = store.tree;
        let added = 0;
        if (root && Array.isArray(root.o) && Array.isArray(root.n)) {
          for (const b of STORE_BRANCHES) {
            if (root.o.includes(b.option)) continue;
            root.o.push(b.option);
            root.n.push(JSON.parse(JSON.stringify(b.node)));
            store.kw = `${store.kw || ''} ${b.option} ${b.kw}`.trim();
            added++;
          }
        }
        if (added) {
          db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(store), 'h_store');
          changed += added;
        }
      }
      return changed;
    },
  },
  {
    // The generator diagnostic is not wanted: removed where an earlier version had added it.
    key: '2026-10-11-sans-groupe-electrogene',
    run: (db) => db.prepare("DELETE FROM diagnostics WHERE id = 'g_groupe'").run().changes,
  },
  {
    // Every end point puts forward the store's product: no home remedy. An end point is only changed if it still has
    // the text it had when this list was written (a back-office edit wins).
    key: '2026-10-11-solution-magasin',
    run: (db) => {
      let changed = 0;
      const byId = new Map();
      for (const e of STORE_PRODUCTS) byId.set(e.id, [...(byId.get(e.id) || []), e]);
      for (const [id, edits] of byId) {
        const row = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(id);
        if (!row) continue;
        const data = JSON.parse(row.data);
        let n = 0;
        for (const e of edits) {
          let leaf = data.tree;
          for (const i of e.path) leaf = leaf && Array.isArray(leaf.n) ? leaf.n[i] : null;
          if (!leaf || Array.isArray(leaf.n) || leaf.cause !== e.cause) continue;
          if (e.from.prod !== undefined && leaf.prod !== e.from.prod) continue;
          if (e.from.geste !== undefined && leaf.geste !== e.from.geste) continue;
          Object.assign(leaf, e.to);
          n++;
        }
        if (n) {
          db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(data), id);
          changed += n;
        }
      }
      // The questions too: the test asked of the customer uses the store's product.
      for (const [ids, from, to] of STORE_QUESTIONS) {
        for (const id of ids) {
          const row = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(id);
          if (!row) continue;
          const data = JSON.parse(row.data);
          let n = 0;
          (function walk(node) {
            if (!node || !Array.isArray(node.n)) return;
            if (node.t === from) {
              node.t = to;
              n++;
            }
            node.n.forEach(walk);
          })(data.tree);
          if (n) {
            db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(data), id);
            changed += n;
          }
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
