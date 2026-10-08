'use strict';

// Usage :
//   node server/reset-admin.js NouveauMotDePasse                  → change le mot de passe de l'administrateur (s'il n'y en a qu'un)
//   node server/reset-admin.js email@exemple.fr NouveauMotDePasse → crée cet administrateur ou remplace son mot de passe
const path = require('node:path');
const { openDatabase } = require('./db');
const { hashPassword } = require('./auth');

const args = process.argv.slice(2);
const [email, password] = args.length === 1 ? [null, args[0]] : args;
if (!password || password.length < 8) {
  console.error('Usage : node server/reset-admin.js [email@exemple.fr] MotDePasse   (8 caractères minimum)');
  process.exit(1);
}
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const db = openDatabase(path.join(dataDir, 'app.db'));
let target = email ? email.trim().toLowerCase() : null;
if (!target) {
  const admins = db.prepare("SELECT email FROM admins WHERE role = 'admin' ORDER BY id").all();
  if (admins.length !== 1) {
    console.error(admins.length ? `Plusieurs administrateurs : précisez l'e-mail (${admins.map((a) => a.email).join(', ')})` : 'Aucun administrateur : précisez un e-mail pour le créer.');
    process.exit(1);
  }
  target = admins[0].email;
}
const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(target);
if (existing) {
  db.prepare("UPDATE admins SET password_hash = ?, role = 'admin', dealership_id = NULL WHERE id = ?").run(hashPassword(password), existing.id);
} else {
  db.prepare("INSERT INTO admins (email, name, password_hash, role) VALUES (?, 'Administrateur', ?, 'admin')").run(target, hashPassword(password));
}
db.close();
console.log(`Compte administrateur prêt : ${target}`);
