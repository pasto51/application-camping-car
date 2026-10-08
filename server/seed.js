'use strict';

const { transaction, bumpContentVersion } = require('./db');
const { hashPassword, randomToken } = require('./auth');

// The two brands at launch; the detailed vehicles come from the Compagnon de bord catalogue (catalog.js).
const BRANDS = [
  { name: 'Challenger', color: '#c8102e' },
  { name: 'Randger', color: '#1d3557' },
];

function seed(db, { adminEmail, adminPassword, log = console.log } = {}) {
  transaction(db, () => {
    if (db.prepare('SELECT COUNT(*) AS n FROM brands').get().n === 0) {
      BRANDS.forEach((brand, i) => db.prepare('INSERT INTO brands (name, color, sort) VALUES (?, ?, ?)').run(brand.name, brand.color, i));
      db.prepare('INSERT INTO dealerships (name, code, city, phone, hours) VALUES (?, ?, ?, ?, ?)').run(
        'Concession de démonstration',
        'DEMO2026',
        'France',
        '05 00 00 00 00',
        'Du lundi au samedi, 9 h à 18 h'
      );
      bumpContentVersion(db);
      log('[seed] Marques Challenger et Randger, concession de démonstration (code DEMO2026).');
    }

    if (db.prepare("SELECT COUNT(*) AS n FROM admins WHERE role = 'admin'").get().n === 0) {
      const email = (adminEmail || 'admin@camping-car.local').toLowerCase();
      const password = adminPassword || randomToken(9);
      db.prepare("INSERT INTO admins (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')").run(email, 'Administrateur', hashPassword(password));
      log(`[seed] Compte administrateur créé : ${email}` + (adminPassword ? '' : ` / mot de passe : ${password} (à changer)`));
    }
  });
}

module.exports = { seed };
