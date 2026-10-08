'use strict';

// Usage : node server/reset-admin.js email@exemple.fr NouveauMotDePasse
// Crée le compte administrateur ou remplace son mot de passe.
const path = require('node:path');
const { openDatabase } = require('./db');
const { hashPassword } = require('./auth');

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage : node server/reset-admin.js email@exemple.fr MotDePasse (8 caractères minimum)');
  process.exit(1);
}
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const db = openDatabase(path.join(dataDir, 'app.db'));
const normalized = email.trim().toLowerCase();
const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(normalized);
if (existing) {
  db.prepare("UPDATE admins SET password_hash = ?, role = 'admin', dealership_id = NULL WHERE id = ?").run(hashPassword(password), existing.id);
} else {
  db.prepare("INSERT INTO admins (email, name, password_hash, role) VALUES (?, 'Administrateur', ?, 'admin')").run(normalized, hashPassword(password));
}
db.close();
console.log(`Compte administrateur prêt : ${normalized}`);
