'use strict';

// Catalogue of the "Compagnon de bord" app: equipment, diagnostics, lists and settings,
// plus the per-vehicle profile (dimensions, weights, plan, equipment photos).

const fs = require('node:fs');
const path = require('node:path');
const { transaction, bumpContentVersion } = require('./db');
const { safeJson } = require('./util');

const SEED_DIR = path.join(__dirname, 'seed');
const CATALOG_KEYS = ['lists', 'reminders', 'motifs', 'steps', 'cats', 'config'];
const PLACEHOLDER_DESCRIPTION = 'Fiche exemple : complétez la description, les caractéristiques et la photo depuis le back-office.';

function loadSeed() {
  return JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'compagnon.json'), 'utf8'));
}

// Copies a seed photo into the upload store and returns its public URL.
function importSeedPhoto(uploads, file) {
  if (!file) return null;
  const buffer = fs.readFileSync(path.join(SEED_DIR, 'photos', file));
  const ext = path.extname(file).slice(1).replace('jpg', 'jpeg');
  return uploads.saveDataUrl(`data:image/${ext};base64,${buffer.toString('base64')}`);
}

// A vehicle without a detailed profile still works: no plan, no photos, neutral values.
function defaultProfile(vehicle) {
  return {
    heroPrefix: '',
    heroName: vehicle ? vehicle.name : '',
    fullName: vehicle ? vehicle.name : '',
    codePrefix: 'CDB',
    model: { l: 0, h: 0 },
    weights: { ptac: 3500, mom: 2800, pax: 2, eau: 30, gaz: 0, bag: 100 },
    extra: [],
    vars: {},
    spotOverrides: {},
    spots: [],
    planUrl: null,
    photos: [],
  };
}

function readProfile(vehicle) {
  return { ...defaultProfile(vehicle), ...safeJson(vehicle.profile || '{}', {}) };
}

// First start with the Compagnon de bord: load the catalogue and create the Challenger V114.
function seedCatalog(db, uploads, log = console.log) {
  if (db.prepare('SELECT COUNT(*) AS n FROM equipment').get().n > 0) return;
  const seed = loadSeed();
  transaction(db, () => {
    seed.equipment.forEach((q, i) => db.prepare('INSERT INTO equipment (id, sort, data) VALUES (?, ?, ?)').run(q.id, i, JSON.stringify(q)));
    seed.diagnostics.forEach((d, i) => db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(d.id, i, JSON.stringify(d)));
    for (const key of CATALOG_KEYS) db.prepare('INSERT INTO catalog (key, value) VALUES (?, ?)').run(key, JSON.stringify(seed[key]));

    // Example vehicles created by the first version are replaced by the real V114.
    db.prepare(
      'DELETE FROM vehicles WHERE description = ? AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.vehicle_id = vehicles.id)'
    ).run(PLACEHOLDER_DESCRIPTION);
    db.prepare('DELETE FROM problems WHERE vehicle_id IS NULL AND brand_id IS NULL').run();

    let brand = db.prepare("SELECT id FROM brands WHERE lower(name) = 'challenger'").get();
    if (!brand) brand = { id: db.prepare("INSERT INTO brands (name, color, sort) VALUES ('Challenger', '#c8102e', 0)").run().lastInsertRowid };
    if (!db.prepare("SELECT id FROM brands WHERE lower(name) = 'randger'").get()) {
      db.prepare("INSERT INTO brands (name, color, sort) VALUES ('Randger', '#1d3557', 1)").run();
    }

    const { photos, heroFile, planFile, ...profile } = seed.vehicle;
    profile.photos = photos.map((p) => ({ id: p.id, url: importSeedPhoto(uploads, p.file) }));
    profile.planUrl = importSeedPhoto(uploads, planFile);
    const heroUrl = importSeedPhoto(uploads, heroFile);
    const specs = [
      { label: 'Longueur', value: `${String(profile.model.l).replace('.', ',')} m` },
      { label: 'Hauteur', value: `${String(profile.model.h).replace('.', ',')} m` },
      { label: 'PTAC', value: `${profile.weights.ptac} kg` },
    ];
    db.prepare('INSERT INTO vehicles (brand_id, name, model_year, description, photo_url, specs, profile, sort) VALUES (?, ?, ?, ?, ?, ?, ?, 0)').run(
      brand.id,
      'V114',
      'Road Edition 2027',
      'Van de 5,99 m. Véhicule de démonstration du Compagnon de bord : équipements relevés sur le véhicule d’exposition.',
      heroUrl,
      JSON.stringify(specs),
      JSON.stringify(profile)
    );

    if (seed.dealer) {
      db.prepare("UPDATE dealerships SET hours = COALESCE(hours, ?) WHERE code = 'DEMO2026'").run(seed.dealer.hours || null);
    }
    bumpContentVersion(db);
  });
  log(`[seed] Compagnon de bord : ${seed.equipment.length} équipements, ${seed.diagnostics.length} diagnostics, véhicule Challenger V114 créé.`);
}

function getCatalogValue(db, key) {
  const row = db.prepare('SELECT value FROM catalog WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}

// Everything the app needs to start for a given vehicle and dealership.
function appData(db, { vehicleId, dealershipId }) {
  const vehicle = db
    .prepare('SELECT v.*, b.name AS brand_name FROM vehicles v JOIN brands b ON b.id = v.brand_id WHERE v.id = ?')
    .get(vehicleId);
  const dealership = db.prepare('SELECT * FROM dealerships WHERE id = ?').get(dealershipId);
  const profile = vehicle ? readProfile(vehicle) : defaultProfile(null);
  const data = {
    equipment: db.prepare('SELECT data FROM equipment ORDER BY sort, id').all().map((r) => JSON.parse(r.data)),
    diagnostics: db.prepare('SELECT data FROM diagnostics ORDER BY sort, id').all().map((r) => JSON.parse(r.data)),
    vehicle: {
      ...profile,
      id: vehicle?.id,
      brand: vehicle?.brand_name,
      heroUrl: vehicle?.photo_url || null,
      fullName: profile.fullName || [vehicle?.brand_name, vehicle?.name, vehicle?.model_year].filter(Boolean).join(' '),
    },
    dealer: {
      name: dealership?.name || '',
      tel: dealership?.phone || '',
      email: dealership?.email || '',
      hours: dealership?.hours || '',
      city: dealership?.city || '',
      logoUrl: dealership?.logo_url || null,
    },
  };
  for (const key of CATALOG_KEYS) data[key] = getCatalogValue(db, key);
  return data;
}

module.exports = { seedCatalog, appData, readProfile, defaultProfile, getCatalogValue, CATALOG_KEYS };
