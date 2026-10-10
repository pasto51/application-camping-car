'use strict';

// Corrections of the diagnostic content found by the simulations (see docs/SIMULATIONS.md).
// Each one is applied once, and only if the end point still has its original text: a change made
// meanwhile in the back-office always wins.

const { getSetting, setSetting, bumpContentVersion, transaction } = require('./db');
const { seedStarterTips } = require('./tips');
const { CLIENTS_2026_10 } = require('./diagnostics-clients');
const { CLIENTS_2026_10_B } = require('./diagnostics-clients-2');
const { CLIENTS_2026_10_C } = require('./diagnostics-clients-3');
const ROUTE = require('./lists-route');
const FORUMS = require('./diagnostics-forums');
const ELEC = require('./diagnostics-electricite');
const STORES = require('./diagnostics-magasins');
const TIP_PROPOSALS = require('./tips-propositions.json');

const BATTERY_CLASSIC = ['cell', 'agm', 'gel'];
const ROUTINE_LISTS = {
  hiver: {
    title: 'Hivernage',
    goal: 'Protéger le véhicule du gel et de l’humidité pendant les longs mois d’arrêt.',
    note: 'Routine d’automne.',
    items: [
      'Je vide toute l’eau (le plus important) : je vide la cuve d’eau propre, la cuve des eaux grises, et j’ouvre la vanne de sécurité (purge) du chauffe-eau.',
      'J’ouvre les robinets : je laisse tous les robinets (évier, lavabo, douche) ouverts en position centrale (mitigeur au milieu). Ainsi, il ne reste aucune goutte d’eau dans les tuyaux pour geler.',
      'Je m’occupe du frigo : je le vide, le nettoie et je cale la porte pour qu’elle reste entrouverte tout l’hiver (pour éviter les moisissures).',
      'Je laisse respirer l’intérieur : je soulève légèrement les matelas et les assises de la banquette pour laisser l’air circuler. J’en profite pour placer des absorbeurs d’humidité dans l’habitacle.',
      'Je protège les joints : je passe un coup de spray d’entretien au silicone sur les joints en caoutchouc des fenêtres pour éviter qu’ils ne collent ou craquellent avec le froid.',
      { t: 'Je protège ma batterie cellule classique (plomb, AGM, gel) : je ne la laisse surtout pas branchée en permanence. Je la branche seulement 72 h toutes les 3 semaines (astuce : un petit programmateur de prise). Si le véhicule dort en extérieur, le panneau solaire du toit suffit souvent à assurer la charge d’entretien.', eq: BATTERY_CLASSIC, group: 'batterie' },
      { t: 'Je protège ma batterie cellule lithium : c’est très simple, je mets son coupe-circuit sur la position OFF.', eq: ['lith'], group: 'batterie' },
      'Je protège ma batterie moteur : pour être sûr de pouvoir démarrer au printemps, je la relie à un petit panneau solaire d’appoint, ou bien je démarre mon véhicule de temps en temps (15 à 20 minutes) pour maintenir la charge.',
      'Je soulage mes pneus : pour éviter qu’ils ne se déforment sous le poids en restant sur place, je les surgonfle légèrement (+0,5 bar) ou je monte mon véhicule sur des cales anti-ovalisation.',
    ],
  },
  printemps: {
    title: 'Remise en route',
    goal: 'Relancer la machine en douceur et vérifier que tout fonctionne pour les beaux jours.',
    note: 'Routine de réveil, au printemps.',
    items: [
      'Je ferme les vannes d’eau : je referme la purge du chauffe-eau, le bouchon de la cuve d’eau propre et tous les robinets (laissés ouverts cet hiver).',
      'Je chasse l’air des tuyaux : je mets un peu d’eau propre, j’allume la pompe et j’ouvre les robinets un par un jusqu’à ce que l’eau coule normalement sans « crachoter ».',
      'Je purifie mon circuit d’eau : j’en profite pour verser un produit désinfectant spécial cuve dans l’eau propre afin d’éliminer les bactéries de l’hiver.',
      'Je prépare les toilettes : je donne un bon coup de propre à ma cassette WC et je graisse son joint en caoutchouc (avec un spray ou un lubrifiant adapté) pour qu’il reste bien souple et étanche.',
      'Je vérifie les batteries : je m’assure sur le panneau central que les niveaux de charge (batterie moteur et batterie cellule) sont au maximum.',
      'Je teste mes appareils : j’allume mon frigo et mon chauffe-eau au gaz et à l’électricité pour m’assurer qu’ils démarrent bien et fonctionnent correctement après ces mois d’arrêt.',
      { t: 'Je nettoie les grilles du frigo (frigo à absorption) : un petit coup de pinceau ou de soufflette sur les grilles extérieures enlève la poussière et les toiles d’araignées, pour qu’il refroidisse bien.', variant: ['frigo', 'trimixte'] },
      'Je vérifie mon gaz : je regarde la date de péremption imprimée sur la « lyre » (le tuyau noir en caoutchouc souple) qui relie mes bouteilles de gaz.',
      'Je contrôle les ouvrants : je vérifie l’étanchéité et la bonne ouverture des portes, fenêtres et lanterneaux. Je mets un petit coup de spray lubrifiant dans les serrures et sur les charnières si ça grince.',
      'Je contrôle la mécanique de base : avant de rouler, je vérifie les niveaux du moteur (huile, liquide de refroidissement, lave-glace) et je refais absolument la pression de mes pneus.',
      'Je fais une beauté à l’extérieur : un grand lavage de la carrosserie pour enlever les traces et les coulures noires accumulées pendant l’hiver.',
    ],
  },
  mensuel: {
    title: 'Chaque mois',
    goal: 'Prévenir l’usure, éviter les pannes courantes et garder un bon confort à bord.',
    note: 'Entretien mensuel en pleine saison.',
    items: [
      'Entretien de la cassette WC : je nettoie l’intérieur de la cassette avec un produit détartrant spécifique. Je pulvérise ensuite un lubrifiant au silicone spécial joints sur le clapet en caoutchouc pour garantir son étanchéité et faciliter son ouverture.',
      'Traitement de la cuve des eaux grises : pour prévenir les remontées d’odeurs pendant les trajets, je verse une dose de nettoyant spécial cuve dans les bondes (évier et douche) afin de dissoudre les graisses et les résidus de savon.',
      'Dégivrage du réfrigérateur : je retire la glace accumulée dans le compartiment freezer. Un réfrigérateur régulièrement dégivré consomme moins d’énergie et refroidit mieux en été.',
      'Nettoyage du toit et du panneau solaire : avec précaution, j’accède au toit pour retirer les feuilles mortes et nettoyer les fientes d’oiseaux (qui peuvent attaquer la peinture). J’en profite pour nettoyer mon panneau solaire à l’eau claire, pour qu’il recharge bien.',
      'Nettoyage des baies acryliques : les baies de camping-car ne sont pas en verre. Je les nettoie avec une microfibre et un nettoyant spécifique pour acrylique (un produit à vitres de la maison provoque des micro-fissures au soleil).',
      'Lubrification des ouvrants et serrures : je pulvérise du spray lubrifiant dans les serrures de la porte cellule, des soutes et de la trappe WC. Le mécanisme ne grippe pas avec la poussière de la route.',
      'Contrôle des pneus et des niveaux moteur : à froid, je vérifie la pression de tous les pneus. Sous le capot, je contrôle le niveau d’huile, le liquide de refroidissement, et je remplis le lave-glace.',
      'Vérification de la signalisation et de la caméra : avec l’aide d’une autre personne, je vérifie les clignotants, les veilleuses et les feux stop. J’en profite pour nettoyer délicatement la lentille de la caméra de recul avec un chiffon doux.',
    ],
  },
};
const { NEW_EQUIPMENT, NEW_EQUIPMENT_2026, EQUIPMENT_TYPES, GENERIC_NAMES, DEFAULT_SPOTS } = require('./vehicle-types');
const { NEW_DIAGNOSTICS, STORE_BRANCHES } = require('./diagnostics-pieces');
const { CONFORT, CONFORT_2 } = require('./diagnostics-confort');
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
  {
    // Everyday comfort problems that lead to a product of the store (forum research): condensation, heat, cold, gas,
    // battery autonomy, internet, water, cassette, roll, manoeuvres, levelling, theft, insects, shade, storage, light, sleep.
    key: '2026-10-12-problematiques-confort',
    run: (db) => {
      let changed = 0;
      let sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM diagnostics').get().n;
      for (const d of CONFORT) {
        if (db.prepare('SELECT 1 FROM diagnostics WHERE id = ?').get(d.id)) continue;
        db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(d.id, ++sort, JSON.stringify(d));
        changed++;
      }
      return changed;
    },
  },
  {
    // Second series of comfort problems (TV, tyre pressure, camping-car GPS, rattles, weight, dog, step, mats, outdoor shower,
    // washing, winter storage, engine battery, 12 V appliances, drinking water, wind and awning, roof rack, scooter, lighting,
    // cooking smells, extension lead).
    key: '2026-10-13-problematiques-confort-2',
    run: (db) => {
      let changed = 0;
      let sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM diagnostics').get().n;
      for (const d of CONFORT_2) {
        if (db.prepare('SELECT 1 FROM diagnostics WHERE id = ?').get(d.id)) continue;
        db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(d.id, ++sort, JSON.stringify(d));
        changed++;
      }
      return changed;
    },
  },
  {
    // Problems reported by customers: key and lock (Zadi), pleated blinds and fly screens, fridge that frosts or does not
    // cool enough, water leaks (FrostControl).
    key: '2026-10-16-problemes-clients',
    run: (db) => {
      let changed = 0;
      let sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM diagnostics').get().n;
      for (const d of CLIENTS_2026_10) {
        if (db.prepare('SELECT 1 FROM diagnostics WHERE id = ?').get(d.id)) continue;
        db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(d.id, ++sort, JSON.stringify(d));
        changed++;
      }
      return changed;
    },
  },
  {
    // The four customer diagnostics after checking them against the makers' instructions (Zadi, Truma FrostControl,
    // Dometic, Thetford), and the two older ones they replace (same problems, conflicting advice: « leak » and
    // « blind »). Water-circuit leaks were sent to the « test d'étanchéité » appointment: they go to the workshop.
    key: '2026-10-17-diagnostics-verifies',
    run: (db) => {
      let changed = 0;
      for (const d of CLIENTS_2026_10) {
        const row = db.prepare('SELECT 1 FROM diagnostics WHERE id = ?').get(d.id);
        if (row) db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(d), d.id);
        else {
          const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM diagnostics').get().n + 1;
          db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(d.id, sort, JSON.stringify(d));
        }
        changed++;
      }
      changed += db.prepare("DELETE FROM diagnostics WHERE id IN ('leak', 'blind')").run().changes;
      for (const id of ['c_tank_gel', 'g_trumad', 'g_truma', 'h_wc', 'h_pompe', 'h_clim', 'h_sat']) {
        const row = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(id);
        if (!row) continue;
        const data = JSON.parse(row.data);
        let n = 0;
        (function walk(node) {
          if (!node) return;
          if (Array.isArray(node.n)) return node.n.forEach(walk);
          if (node.rdv === 'etanch' && !/joint/i.test(node.cause)) { node.rdv = 'atelier'; n++; } // a roof seal stays « étanchéité »
        })(data.tree);
        if (n) db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(data), id);
        changed += n;
      }
      const eau = db.prepare("SELECT data FROM diagnostics WHERE id = 'h_eau'").get();
      if (eau) {
        const data = JSON.parse(eau.data);
        const leaves = findLeaves(data.tree, { cause: 'Une fuite du circuit d\'eau passe à proximité.' });
        leaves.forEach((leaf) => { leaf.rdv = 'atelier'; });
        if (leaves.length) db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = 'h_eau'").run(JSON.stringify(data));
        changed += leaves.length;
      }
      return changed;
    },
  },
  {
    // Second batch of customer problems (doors, windows, taps, cupboards, gas struts, fridge door, storage lockers,
    // swivel seats, table, slats, lights, fuel in the water tank, tank cap, stabiliser legs, sliding door, bodywork,
    // pop-up roof, inverter), and the cracked shower tray in the leak diagnostic.
    key: '2026-10-18-problemes-clients-2',
    run: (db) => {
      let changed = 0;
      let sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM diagnostics').get().n;
      for (const d of CLIENTS_2026_10_B) {
        if (db.prepare('SELECT 1 FROM diagnostics WHERE id = ?').get(d.id)) continue;
        db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(d.id, ++sort, JSON.stringify(d));
        changed++;
      }
      const fuite = CLIENTS_2026_10.find((d) => d.id === 'p_fuite');
      changed += db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = 'p_fuite'").run(JSON.stringify(fuite)).changes;
      return changed;
    },
  },
  {
    // The customer diagnostics added in October rewritten as funnels (symptom, then checks from the simplest, the
    // workshop last), and the manual dish: pointer, mast and folding, cable, receiver and card.
    key: '2026-10-19-entonnoir-antenne',
    run: (db) => {
      let changed = 0;
      let sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM diagnostics').get().n;
      for (const d of [...CLIENTS_2026_10, ...CLIENTS_2026_10_B, ...CLIENTS_2026_10_C]) {
        if (db.prepare('SELECT 1 FROM diagnostics WHERE id = ?').get(d.id)) {
          db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(d), d.id);
        } else {
          db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(d.id, ++sort, JSON.stringify(d));
        }
        changed++;
      }
      return changed;
    },
  },
  {
    // Three routine checklists in « Gestes du quotidien » (written by the user): winter storage, spring start-up, and the
    // monthly care in season. Lines for some equipment only (battery type, absorption fridge).
    key: '2026-10-15-check-lists-routine',
    run: (db) => {
      const row = db.prepare("SELECT value FROM catalog WHERE key = 'lists'").get();
      const lists = row ? JSON.parse(row.value) : {};
      let changed = 0;
      for (const [key, list] of Object.entries(ROUTINE_LISTS)) {
        if (lists[key]) continue;
        lists[key] = list;
        changed++;
      }
      if (lists.arrivee && !lists.arrivee.title) lists.arrivee.title = 'Arrivée';
      if (lists.depart && !lists.depart.title) lists.depart.title = 'Départ';
      db.prepare("INSERT INTO catalog (key, value) VALUES ('lists', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").run(JSON.stringify(lists));
      return changed;
    },
  },
  {
    // « Conseils & Astuces »: the first tips of the site and the « À la une » banner (only if there are none yet).
    key: '2026-10-14-conseils-astuces',
    run: (db) => seedStarterTips(db),
  },
  {
    // « Gestes du quotidien »: arrival and departure for a campsite or service area, or free parking; when each list
    // unticks itself and reminds the customer. Lists changed by the dealership keep their lines.
    key: '2026-10-20-listes-route',
    run: (db) => {
      const row = db.prepare("SELECT value FROM catalog WHERE key = 'lists'").get();
      if (!row) return 0;
      const lists = JSON.parse(row.value);
      const same = (items, old) => JSON.stringify((items || []).map((i) => (typeof i === 'string' ? i : i.t))) === JSON.stringify(old);
      let changed = 0;
      if (lists.arrivee && same(lists.arrivee.items, ROUTE.OLD_ARRIVEE)) { lists.arrivee.items = ROUTE.ARRIVEE; lists.arrivee.note = ''; changed++; }
      if (lists.depart && same(lists.depart.items, ROUTE.OLD_DEPART)) { lists.depart.items = ROUTE.DEPART; lists.depart.note = ''; changed++; }
      for (const [k, set] of Object.entries(ROUTE.SETTINGS)) {
        if (!lists[k]) continue;
        for (const [f, v] of Object.entries(set)) if (lists[k][f] === undefined || lists[k][f] === '') lists[k][f] = v;
        if (k === 'arrivee' || k === 'depart') lists[k].places = lists[k].items.some((i) => i && i.where) || undefined;
        changed++;
      }
      db.prepare("UPDATE catalog SET value = ?, updated_at = datetime('now') WHERE key = 'lists'").run(JSON.stringify(lists));
      return changed;
    },
  },
  {
    // « Chaque mois » first among the seasonal routines (the order can then be changed in the back-office).
    key: '2026-10-21-ordre-listes',
    run: (db) => {
      const row = db.prepare("SELECT value FROM catalog WHERE key = 'lists'").get();
      if (!row) return 0;
      const lists = JSON.parse(row.value);
      const keys = Object.keys(lists);
      if (keys.join() !== 'arrivee,depart,hiver,printemps,mensuel') return 0;
      const next = Object.fromEntries(['arrivee', 'depart', 'mensuel', 'hiver', 'printemps'].map((k) => [k, lists[k]]));
      db.prepare("UPDATE catalog SET value = ?, updated_at = datetime('now') WHERE key = 'lists'").run(JSON.stringify(next));
      return 1;
    },
  },
  {
    // Problems of motorhome and van owners found on forums of the last three years (vans: pop-up roof, panel, USB
    // socket, roof fan, rear doors, bench seat, diesel smell, cab curtains; motorhomes: grey-water gauge, shower smell,
    // Alde, bike-rack lights, cab ventilation and air-con, key, windows, camera, clutch, gearbox, handbrake, front
    // noise, hydraulic jacks, smoke detector).
    key: '2026-10-22-diagnostics-forums',
    run: (db) => {
      let changed = 0;
      let sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM diagnostics').get().n;
      for (const d of [...FORUMS.VANS, ...FORUMS.MOTORHOMES]) {
        if (db.prepare('SELECT 1 FROM diagnostics WHERE id = ?').get(d.id)) continue;
        db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(d.id, ++sort, JSON.stringify(d));
        changed++;
      }
      return changed;
    },
  },
  {
    // Three diagnostics of the start completed from the forums: charging while driving (smart alternator, lithium),
    // a fuse that blows straight away, the hookup post that trips. Not changed if the dealership reworked them.
    key: '2026-10-23-electricite',
    run: (db) => {
      let changed = 0;
      const edit = (id, fn) => {
        const row = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(id);
        if (!row) return;
        const d = JSON.parse(row.data);
        if (d.tree && fn(d.tree)) {
          db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(d), id);
          changed++;
        }
      };
      const copy = (x) => JSON.parse(JSON.stringify(x));
      const child = (node, option) => (node && node.o ? node.n[node.o.indexOf(option)] : undefined);
      // « En roulant » → … → « Moteur tournant, attendez trois minutes » : its « Non » leads to the new checks.
      edit('nocharge', (t) => {
        const wait = child(child(child(t, 'En roulant'), 'Oui'), 'Non');
        if (!wait || !wait.o || wait.o[1] !== 'Non' || wait.n[1].t) return false;
        wait.n[1] = copy(ELEC.DRIVING_END);
        return true;
      });
      // One cause per end point (the old sentence named two).
      edit('nocharge', (t) => {
        const leaves = findLeaves(t, { cause: 'Une ombre, même partielle, réduit fortement la production.' });
        leaves.forEach((l) => { l.cause = 'L’ombre réduit fortement la production du panneau.'; l.geste = `Même une ombre partielle fait chuter la production. ${l.geste}`; });
        return leaves.length > 0;
      });
      // The search must still find this one first among the newer electrical diagnostics (socket, panel, lights).
      const v12 = db.prepare("SELECT data FROM diagnostics WHERE id = 'no12v'").get();
      if (v12) {
        const d = JSON.parse(v12.data);
        if (d.label === 'Plus de courant dans la cellule (12 V)') {
          d.label = 'Plus de courant dans la cellule (12 V) : panneau éteint, lumières qui faiblissent, un appareil ou une prise qui ne marche plus';
          d.kw = `${d.kw || ''} plus rien ne marche panneau de contrôle reste éteint lumières faiblissent un seul appareil une seule prise fusible grille`.trim();
          db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = 'no12v'").run(JSON.stringify(d));
          changed++;
        }
      }
      edit('no12v', (t) => {
        if (!t.o || t.o.includes('Un fusible grille dès que je le remets')) return false;
        t.o.push('Un fusible grille dès que je le remets');
        t.n.push(copy(ELEC.FUSE_BLOWS));
        return true;
      });
      edit('no230', (t) => {
        const i = t.o ? t.o.indexOf('Ça disjoncte') : -1;
        if (i < 0 || (t.n[i].o && t.n[i].o[0] === 'Le disjoncteur de la borne du camping')) return false;
        t.n[i] = { t: 'Qu’est-ce qui disjoncte ?', o: ['Le disjoncteur de la borne du camping', 'Le disjoncteur dans mon véhicule'], n: [copy(ELEC.POST_TRIPS), t.n[i]] };
        return true;
      });
      return changed;
    },
  },
  {
    // From the advice pages of accessory stores and makers: new diagnostics, new answers to older ones, « Lavage » as a
    // funnel, and 35 tips for « Conseils & Astuces » left « À valider » (never published without being read).
    key: '2026-10-24-sites-magasins',
    run: (db) => {
      let changed = 0;
      let sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM diagnostics').get().n;
      for (const d of STORES.NEW) {
        if (db.prepare('SELECT 1 FROM diagnostics WHERE id = ?').get(d.id)) continue;
        db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(d.id, ++sort, JSON.stringify(d));
        changed++;
      }
      const save = (id, d) => db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(d), id);
      for (const [id, [option, node]] of Object.entries(STORES.BRANCHES)) {
        const row = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(id);
        if (!row) continue;
        const d = JSON.parse(row.data);
        if (!d.tree || !Array.isArray(d.tree.o) || d.tree.o.includes(option)) continue;
        d.tree.o.push(option);
        d.tree.n.push(JSON.parse(JSON.stringify(node)));
        save(id, d);
        changed++;
      }
      const lavage = db.prepare("SELECT data FROM diagnostics WHERE id = 'p_lavage'").get();
      if (lavage) {
        const d = JSON.parse(lavage.data);
        if (d.tree && !d.tree.n) {
          d.tree = JSON.parse(JSON.stringify(STORES.LAVAGE));
          save('p_lavage', d);
          changed++;
        }
      }
      // The broad fridge and toilet diagnostics keep coming first in the search, next to the newer narrow ones.
      const renames = {
        h_frigo: ['Mon frigo ne fait plus de froid (ou a un autre souci)', 'Mon frigo ne fait plus de froid ou ne refroidit plus assez, affiche un code, ou sa flamme ne s’allume pas'],
        h_wc: ['Mes toilettes ne marchent plus (ou ont un souci)', 'Mes toilettes ne marchent plus : chasse d’eau, fuite, odeur, voyant ou indicateur de niveau'],
      };
      for (const [id, [before, after]] of Object.entries(renames)) {
        const row = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(id);
        if (!row) continue;
        const d = JSON.parse(row.data);
        if (d.label !== before) continue;
        d.label = after;
        save(id, d);
        changed++;
      }
      const insert = db.prepare("INSERT INTO tips (title, category, body, store_tip, status, sort) VALUES (?, ?, ?, ?, 'pending', 0)");
      for (const t of TIP_PROPOSALS) {
        if (db.prepare('SELECT 1 FROM tips WHERE title = ?').get(t.title)) continue;
        insert.run(t.title, t.category, t.body, t.storeTip);
        changed++;
      }
      return changed;
    },
  },
  {
    // A tone of advice, not of sale: the gestures no longer repeat « vendu en magasin » (the « Ce qui peut vous
    // aider » block and the « Demander conseil au magasin » button already say where to find it).
    key: '2026-10-25-ton-conseil',
    run(db) {
      const scrub = (text) => text.replace(/ \(vendu[es]{0,2} en magasin\)/g, '').replace(/,? vendu[es]{0,2} en magasin(?: d[’']accessoires(?: de camping-car)?)?/g, '');
      let changed = 0;
      for (const row of db.prepare('SELECT id, data FROM diagnostics').all()) {
        const data = scrub(row.data);
        if (data === row.data) continue;
        db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(data, row.id);
        changed++;
      }
      return changed;
    },
  },
  {
    // « Mon robinet marche mal »: for everyone, not only leaks — leak around the lever (cartridge nut, frost, cartridge
    // or new mixer tap), one tap with a weak flow, the pump that does not start or does not stop with the taps, and
    // the troubles after changing the pump.
    key: '2026-10-26-robinet',
    run: (db) => {
      const d = CLIENTS_2026_10_B.find((x) => x.id === 'p_robinet');
      if (!db.prepare('SELECT 1 FROM diagnostics WHERE id = ?').get(d.id)) return 0;
      db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(d), d.id);
      return 1;
    },
  },
  {
    // « Arrivée » rewritten with the rules checked again (asked by the user, whose site still had the first 6 lines):
    // campsite or service area (reception, ticket, quiet hours) and free parking (on its wheels, no wedges, nothing
    // out, no fire, nothing emptied, limited stay). The departure list is replaced only if it never got its two versions.
    key: '2026-10-27-arrivee',
    run: (db) => {
      const row = db.prepare("SELECT value FROM catalog WHERE key = 'lists'").get();
      if (!row) return 0;
      const lists = JSON.parse(row.value);
      let changed = 0;
      if (lists.arrivee) {
        lists.arrivee = { ...lists.arrivee, items: ROUTE.ARRIVEE, note: '', places: true };
        for (const [f, v] of Object.entries(ROUTE.SETTINGS.arrivee)) if (lists.arrivee[f] === undefined || lists.arrivee[f] === '') lists.arrivee[f] = v;
        changed++;
      }
      if (lists.depart && !(lists.depart.items || []).some((i) => i && i.where)) {
        lists.depart = { ...lists.depart, items: ROUTE.DEPART, note: '', places: true };
        for (const [f, v] of Object.entries(ROUTE.SETTINGS.depart)) if (lists.depart[f] === undefined || lists.depart[f] === '') lists.depart[f] = v;
        changed++;
      }
      db.prepare("UPDATE catalog SET value = ?, updated_at = datetime('now') WHERE key = 'lists'").run(JSON.stringify(lists));
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
