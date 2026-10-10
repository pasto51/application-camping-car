'use strict';

// Diagnostics, lists and the type of each equipment (« sous-type »: compression or absorption fridge, submerged or
// pressure pump, butane or propane, AGM / gel / lithium battery…). Applied once (« 2026-10-31-types »):
// - a question whose answer the app already knows is answered by itself (vk: the type, vv: for each answer the types
//   it stands for, '' when the type cannot tell); the customer sees it and can go back;
// - a diagnostic that only concerns one type is set aside for the others (vonly);
// - list lines for one type of pump or heater.
// The choices of an ensemble (type of battery) also act as a type: VARIANTS entry flagged « pick », filled by the app.

const NOT_BUTANE = 'propane|rech';

// [diagnostic, question (start of its text), type, answers]
const QUESTIONS = [
  ['g_truma', 'Fait-il très froid', 'bouteille', ['', NOT_BUTANE]],
  ['h_frigo', 'Fait-il proche de 0 °C avec une bouteille de butane', 'bouteille', ['', NOT_BUTANE]],
  ['h_gaz', 'Est-ce une bouteille de butane, avec une température proche de 0 °C', 'bouteille', ['', NOT_BUTANE]],
  ['h_gaz', 'Quelle bouteille avez-vous', 'bouteille', ['butane', NOT_BUTANE]],
  ['h_gaz', 'Fait-il froid dehors (autour de 0 degré ou moins), avec une bouteille de butane', 'bouteille', ['', NOT_BUTANE]],
  ['heater', 'Utilisez-vous du butane par temps froid', 'bouteille', ['butane', NOT_BUTANE]],
  ['plaque', 'Comment s\'allume votre plaque', 'rechaud', ['pile', 'manuel']],
  ['plaque', 'Quel gaz utilisez-vous', 'bouteille', ['butane', NOT_BUTANE]],
  ['h_frigo', 'Que constatez-vous', 'frigo', ['', '', 'comp']],
  ['h_store', 'Quel est votre type de store', 'store', ['elec', 'manuel']],
  ['p_ventstore', 'Votre store est-il électrique', 'store', ['elec', 'manuel']],
  ['p_toitmoteur', 'Votre toit relevable est-il électrique ou manuel', 'toit_rel', ['elec', 'manuel']],
  ['h_solaire', 'Lisez l\'étiquette de votre régulateur solaire', 'mppt', ['v2', 'v1', '']],
  ['h_lith', 'Lisez l\'étiquette du régulateur solaire', 'mppt', ['v1', 'v2', '']],
  ['nocharge', 'Votre batterie cellule est-elle une lithium', 'g_batterie', ['lith', 'agm|gel']],
  ['p_autonomie', 'Quelle est la batterie de votre cellule', 'g_batterie', ['agm|gel', 'lith', '']],
  ['h_bat', 'Que lit-on sur l\'étiquette de la batterie cellule', 'g_batterie', ['agm|gel', '']],
  ['p_robinet', 'Votre pompe est-elle dans le réservoir', 'pompe', ['', 'press']],
  ['h_wc', 'Quel type de toilette avez-vous', 'wc', ['', '', 'dometic|autre']],
];

// Diagnostics that only concern some types: set aside (« autre équipement ») for the others.
const ONLY = {
  ammonia: ['frigo', ['trimixte']], // ammonia leaks only from an absorption fridge
  step: ['marche', ['auto', 'inter']], // the electric step
  h_bat: ['g_batterie', ['agm', 'gel']], // AGM / gel questions (lithium has its own)
};

// New types: the battery of the « Batterie cellule » ensemble (filled from the choice made there), the pop-up roof.
const NEW_VARIANTS = {
  g_batterie: { q: 'Type de batterie', pick: true, o: [['agm', 'AGM', '', ''], ['gel', 'Gel', '', ''], ['lith', 'Lithium', '', ''], ['ns', 'Je ne sais pas', '', '']] },
  toit_rel: { q: 'Commande du toit relevable', o: [['elec', 'Électrique (bouton ou panneau)', '', ''], ['manuel', 'Manuel', '', ''], ['ns', 'Je ne sais pas', '', '']] },
};

// List lines for one type (added once, if the list has no such line yet).
const LIST_LINES = {
  hiver: [
    { t: 'Pompe immergée : je la sors du réservoir, ou je la laisse au sec réservoir vide, pour qu’elle ne gèle pas.', variant: ['pompe', 'imm'] },
    { t: 'Pompe à pression : robinets ouverts, je la fais tourner quelques secondes pour la vider, puis je la coupe.', variant: ['pompe', 'press'] },
    { t: 'Truma Combi : je vérifie que la vidange de sécurité (FrostControl) est bien ouverte et le chauffe-eau vide.', eq: ['trumac', 'trumad'] },
  ],
  printemps: [{ t: 'Pompe immergée : je la remets dans le réservoir avant de le remplir.', variant: ['pompe', 'imm'] }],
};

function applyDiagTypes(db) {
  let changed = 0;
  const row = db.prepare("SELECT value FROM catalog WHERE key = 'config'").get();
  if (row) {
    const cfg = JSON.parse(row.value);
    cfg.VARIANTS = cfg.VARIANTS || {};
    for (const [k, v] of Object.entries(NEW_VARIANTS)) if (!cfg.VARIANTS[k]) cfg.VARIANTS[k] = v;
    db.prepare("UPDATE catalog SET value = ?, updated_at = datetime('now') WHERE key = 'config'").run(JSON.stringify(cfg));
  }
  const save = (d) => db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(d), d.id);
  const load = (id) => {
    const r = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(id);
    return r ? JSON.parse(r.data) : null;
  };
  for (const [id, start, vk, vv] of QUESTIONS) {
    const d = load(id);
    if (!d) continue;
    const walk = (n) => {
      if (!n || n.cause) return;
      if (!n.vk && String(n.t).startsWith(start) && n.o.length === vv.length) {
        n.vk = vk;
        n.vv = vv;
        changed++;
      }
      (n.n || []).forEach(walk);
    };
    walk(d.tree);
    save(d);
  }
  for (const [id, only] of Object.entries(ONLY)) {
    const d = load(id);
    if (!d || d.vonly) continue;
    d.vonly = only;
    save(d);
    changed++;
  }
  const lr = db.prepare("SELECT value FROM catalog WHERE key = 'lists'").get();
  if (lr) {
    const lists = JSON.parse(lr.value);
    for (const [k, lines] of Object.entries(LIST_LINES)) {
      if (!lists[k]) continue;
      for (const line of lines) {
        if (lists[k].items.some((it) => (typeof it === 'string' ? it : it.t) === line.t)) continue;
        lists[k].items.push(line);
        changed++;
      }
    }
    db.prepare("UPDATE catalog SET value = ?, updated_at = datetime('now') WHERE key = 'lists'").run(JSON.stringify(lists));
  }
  return changed;
}

module.exports = { applyDiagTypes, QUESTIONS, ONLY };
