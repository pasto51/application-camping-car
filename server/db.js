'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  color TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_year TEXT,
  description TEXT,
  photo_url TEXT,
  specs TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Général',
  title TEXT NOT NULL,
  symptoms TEXT,
  solution TEXT,
  photo_url TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dealerships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  city TEXT,
  phone TEXT,
  email TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'dealer')),
  dealership_id INTEGER REFERENCES dealerships(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id),
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  plate TEXT,
  vin TEXT,
  handover_date TEXT,
  cover_photo_url TEXT,
  recovery_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_notes (
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (customer_id, problem_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  problem_id INTEGER REFERENCES problems(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  photos TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'en_cours', 'resolu')),
  dealer_reply TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Compagnon de bord: catalogue shared by every vehicle, edited in the back-office.
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  sort INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diagnostics (
  id TEXT PRIMARY KEY,
  sort INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Other catalogue blocks (lists, reminders, motifs, steps, cats, config), one JSON document each.
CREATE TABLE IF NOT EXISTS catalog (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Everything the app keeps for a customer (equipment checked, photos, weights, handover…), by storage key.
CREATE TABLE IF NOT EXISTS customer_state (
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (customer_id, key)
);

-- Conversation of a request between the customer and the dealership.
CREATE TABLE IF NOT EXISTS report_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK (author IN ('client', 'concession')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Phones of a customer that accept push notifications.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Single-use links sent by e-mail ("Consulter la réponse") that sign the customer in.
CREATE TABLE IF NOT EXISTS login_links (
  token_hash TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_messages ON report_messages(report_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_brand ON vehicles(brand_id);
CREATE INDEX IF NOT EXISTS idx_problems_scope ON problems(brand_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_customers_dealership ON customers(dealership_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_reports_customer ON reports(customer_id);
`;

function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  migrate(db);
  // Optional fields that were not sent arrive as undefined: store them as NULL.
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const stmt = prepare(sql);
    const fix = (args) => args.map((a) => (a === undefined ? null : a));
    return {
      run: (...args) => stmt.run(...fix(args)),
      get: (...args) => stmt.get(...fix(args)),
      all: (...args) => stmt.all(...fix(args)),
    };
  };
  return db;
}

// Columns added after the first release: added in place so existing databases keep their data.
const ADDED_COLUMNS = [
  ['vehicles', 'profile', 'TEXT'],
  ['dealerships', 'hours', 'TEXT'],
  ['dealerships', 'logo_url', 'TEXT'],
  ['dealerships', 'website', 'TEXT'],
  ['reports', 'closed_at', 'TEXT'],
  ['customers', 'access_code_at', 'TEXT'],
  ['customers', 'access_expires_at', 'TEXT'],
  ['customers', 'cell_number', 'TEXT'],
  ['customers', 'vehicle_year', 'TEXT'],
  ['reports', 'kind', 'TEXT'],
  ['reports', 'part', 'TEXT'],
  ['dealerships', 'store_email', 'TEXT'],
  ['customers', 'access_code_enc', 'TEXT'],
  ['customers', 'email_notify', 'INTEGER DEFAULT 1'],
];

// The VIN is never kept on the server: it stays on the customer's phone (see public/app/cloud.js).
function stripVin(value) {
  try {
    const o = JSON.parse(value);
    if (!o || typeof o !== 'object' || !('vin' in o)) return value;
    delete o.vin;
    return JSON.stringify(o);
  } catch {
    return value;
  }
}

function migrate(db) {
  for (const [table, column, type] of ADDED_COLUMNS) {
    const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
    if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
  // VINs and number plates saved by earlier versions are erased: the application does not keep them.
  db.exec('UPDATE customers SET vin = NULL, plate = NULL WHERE vin IS NOT NULL OR plate IS NOT NULL');
  for (const r of db.prepare("SELECT customer_id, value FROM customer_state WHERE key = 'cdb_hand' AND value LIKE '%\"vin\"%'").all()) {
    db.prepare("UPDATE customer_state SET value = ? WHERE customer_id = ? AND key = 'cdb_hand'").run(stripVin(r.value), r.customer_id);
  }
  // Answers given before conversations existed become the first message from the dealership.
  db.exec(`INSERT INTO report_messages (report_id, author, body, created_at)
    SELECT id, 'concession', dealer_reply, updated_at FROM reports r
    WHERE dealer_reply IS NOT NULL AND dealer_reply != '' AND NOT EXISTS (SELECT 1 FROM report_messages m WHERE m.report_id = r.id)`);
}

// Wraps fn in a transaction; rolls back if it throws.
function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function getSetting(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value == null ? null : String(value));
}

// The app compares this number with its cached copy to know when to refetch the catalogue.
function bumpContentVersion(db) {
  const next = Number(getSetting(db, 'content_version', '0')) + 1;
  setSetting(db, 'content_version', next);
  return next;
}

module.exports = { openDatabase, transaction, getSetting, setSetting, bumpContentVersion, stripVin };
