'use strict';

// Catalogue of the "Compagnon de bord" app: equipment, diagnostics, lists and settings,
// plus the per-vehicle profile (dimensions, weights, plan, equipment photos).

const fs = require('node:fs');
const path = require('node:path');
const { transaction, bumpContentVersion } = require('./db');
const { publishedTips, featuredOf, CATEGORIES } = require('./tips');
const { safeJson } = require('./util');
const { vehiclePlan, effectiveSpot, isApplicable } = require('./vehicle-types');

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
    type: '', // silhouette: van, fourgon, compact, profile, integral, capucine (server/vehicle-types.js)
    layout: '', // implantation of that type (lit central, salon arrière…): picks the plan, see tools/make-plans.js
    models: {}, // brand and model of equipment on this vehicle (ex : truma → « Truma Combi 4 »), pre-filled for its customers
    labels: {}, // equipment name on this vehicle, when it differs from the catalogue (ex : « Lanterneau avant, 70 × 40 cm »)
    equipment: [], // pre-checked for this vehicle; the dealership adjusts it with each customer
    vars: {},
    spotOverrides: {},
    spots: [],
    planUrl: null,
    photos: [],
  };
}

function readProfile(vehicle) {
  const base = defaultProfile(vehicle);
  const saved = safeJson(vehicle.profile || '{}', {});
  return { ...base, ...saved, weights: { ...base.weights, ...(saved.weights || {}) } };
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

// Each vehicle has its own pre-checked equipment list. Vehicles created before this existed get the list
// they used to show (equipment marked as standard in the V48 app, plus the vehicle's additions, with a photo).
function ensureEquipmentPresets(db) {
  const vehicles = db.prepare('SELECT id, profile FROM vehicles').all();
  const catalog = db.prepare('SELECT data FROM equipment').all().map((r) => JSON.parse(r.data));
  for (const v of vehicles) {
    const p = safeJson(v.profile || '{}', {});
    if (Array.isArray(p.equipment)) continue;
    const photos = new Set((p.photos || []).map((x) => x.id));
    const ids = new Set([...catalog.filter((q) => q.base).map((q) => q.id), ...(p.extra || [])]);
    p.equipment = [...ids].filter((id) => photos.has(id));
    delete p.extra;
    db.prepare('UPDATE vehicles SET profile = ? WHERE id = ?').run(JSON.stringify(p), v.id);
  }
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
  const { spots, planUrl } = vehiclePlan(profile);
  const preset = new Set(profile.equipment);
  const labels = profile.labels || {};
  const hidden = {};
  const equipment = db
    .prepare('SELECT data FROM equipment ORDER BY sort, id')
    .all()
    .map((r) => {
      const q = JSON.parse(r.data);
      // Equipment that does not exist on this kind of vehicle stays out of the customer's list (unless pre-checked).
      if (!isApplicable(q, profile.type) && !preset.has(q.id)) hidden[q.id] = 1;
      return { ...q, name: labels[q.id] || q.name, spot: effectiveSpot(q, profile, spots) };
    });
  const data = {
    equipment,
    diagnostics: db.prepare('SELECT data FROM diagnostics ORDER BY sort, id').all().map((r) => JSON.parse(r.data)),
    vehicle: {
      ...profile,
      id: vehicle?.id,
      brand: vehicle?.brand_name,
      spots,
      planUrl,
      spotOverrides: {}, // already applied to each equipment's zone
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
      website: dealership?.website || null,
      // Who the customer contacts: the SAV (workshop) and the store, always both (a detached store too), by phone or e-mail.
      // Same mailboxes as the requests: SAV → its e-mail or the dealership's; store → its e-mail, else the SAV's, else the dealership's.
      sav: { phone: dealership?.sav_phone || dealership?.phone || '', email: dealership?.sav_email || dealership?.email || '' },
      store: {
        phone: dealership?.store_phone || dealership?.phone || '',
        email: dealership?.store_email || dealership?.sav_email || dealership?.email || '',
        detached: !!dealership?.store_detached,
      },
    },
  };
  for (const key of CATALOG_KEYS) data[key] = getCatalogValue(db, key);
  data.tips = publishedTips(db);
  data.tipCategories = CATEGORIES;
  data.featured = featuredOf(db);
  if (data.config) data.config = { ...data.config, HIDDEN_EQ: { ...(data.config.HIDDEN_EQ || {}), ...hidden } };
  return data;
}

module.exports = { seedCatalog, ensureEquipmentPresets, appData, readProfile, defaultProfile, getCatalogValue, CATALOG_KEYS };
