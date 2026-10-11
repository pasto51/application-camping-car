'use strict';

// Font Vendôme Mondea (catalogue 2019): the brand and the vehicle, created once (« 2026-11-09-font-vendome-mondea »).
// No equipment is ticked here: the owner ticks it on the vehicle itself (relevé). The plan is ours (« fg_sdb_pav »,
// tools/make-plans.js); only the facts of the catalogue are kept (sizes, weights, models of the appliances).

const BRAND = 'Font Vendôme';

function addMondea(db) {
  let brand = db.prepare('SELECT id FROM brands WHERE lower(name) = lower(?)').get(BRAND);
  if (!brand) {
    const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM brands').get().n;
    brand = { id: db.prepare('INSERT INTO brands (name, color, sort) VALUES (?, ?, ?)').run(BRAND, '#1a9ea4', sort).lastInsertRowid };
  }
  if (db.prepare('SELECT id FROM vehicles WHERE brand_id = ? AND lower(name) = ?').get(brand.id, 'mondea')) return 0;
  const specs = [
    { label: 'Longueur', value: '5,99 m' },
    { label: 'Largeur', value: '2,05 m' },
    { label: 'Hauteur', value: '2,88 m' },
    { label: 'PTAC', value: '3500 kg' },
    { label: 'Porteur', value: 'Fiat Ducato 2.3 (130, 150 ou 180 ch)' },
    { label: 'Places', value: '4 assises (5 en option), 4 couchages' },
    { label: 'Eau propre / eaux usées', value: '100 L / 100 L' },
  ];
  const profile = {
    heroPrefix: 'Fourgon',
    heroName: 'Mondea',
    fullName: 'Font Vendôme Mondea',
    codePrefix: 'MONDEA',
    type: 'fourgon',
    layout: 'fg_sdb_pav',
    model: { l: 5.99, h: 2.88 },
    weights: { ptac: 3500, mom: 3112, pax: 2, eau: 30, gaz: 0 },
    // Brand and model of the appliances, shown once the equipment is ticked.
    models: { trumad: 'Truma Combi D 4 (commande CP plus)', wc: 'Thetford C 223', frigo: 'Réfrigérateur à compression 150 L', pavillon: 'Lit de pavillon électrique 197 × 132 cm' },
    equipment: [],
  };
  const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM vehicles WHERE brand_id = ?').get(brand.id).n;
  db.prepare('INSERT INTO vehicles (brand_id, name, model_year, description, photo_url, specs, profile, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    brand.id,
    'Mondea',
    'Gamme 2019',
    'Fourgon de 5,99 m sur Fiat Ducato : salle d’eau arrière avec douche séparée, lit de pavillon électrique au-dessus du salon, 4 places.',
    null,
    JSON.stringify(specs),
    JSON.stringify(profile),
    sort
  );
  return 1;
}

module.exports = { addMondea };
