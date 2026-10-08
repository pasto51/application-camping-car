'use strict';

const { transaction, bumpContentVersion } = require('./db');
const { hashPassword, randomToken } = require('./auth');

// Starting catalogue: the two brands with a few example models, to be completed from the back-office.
const BRANDS = [
  { name: 'Challenger', color: '#c8102e', vehicles: ['Challenger 260', 'Challenger 328', 'Challenger 390'] },
  { name: 'Randger', color: '#1d3557', vehicles: ['Randger R535', 'Randger R600', 'Randger R640'] },
];

const PROBLEMS = [
  {
    category: 'Électricité',
    title: 'La batterie cellule se décharge rapidement',
    severity: 'attention',
    symptoms: "Les éclairages faiblissent, le tableau de bord indique une tension inférieure à 12 V à l'arrêt.",
    solution:
      "1. Vérifiez que le coupe-batterie cellule est sur ON.\n2. Contrôlez la tension au tableau de commande (12,6 V = batterie chargée).\n3. Branchez le véhicule sur le secteur 230 V ou roulez au moins 1 h pour recharger.\n4. Éteignez les équipements en veille (TV, prise USB, pompe).\n5. Si la tension reste basse après recharge, contactez votre concession.",
  },
  {
    category: 'Eau',
    title: "Pas d'eau aux robinets",
    severity: 'info',
    symptoms: 'Rien ne sort du robinet ou un filet d\'eau seulement, la pompe ne se fait pas entendre.',
    solution:
      "1. Vérifiez le niveau du réservoir d'eau propre au tableau de commande.\n2. Activez la pompe (bouton pompe du tableau).\n3. Contrôlez que les vidanges du réservoir et du chauffe-eau sont fermées.\n4. Vérifiez le fusible de la pompe.\n5. En hiver, assurez-vous que le circuit n'est pas gelé.",
  },
  {
    category: 'Froid',
    title: 'Le réfrigérateur ne refroidit pas',
    severity: 'attention',
    symptoms: 'La température intérieure du réfrigérateur monte, le voyant de fonctionnement clignote.',
    solution:
      "1. Vérifiez le mode sélectionné (12 V en roulant, 230 V sur secteur, gaz à l'arrêt).\n2. En mode gaz : bouteille ouverte et non vide, robinet du réfrigérateur ouvert.\n3. Dégagez les grilles d'aération extérieures.\n4. Le véhicule doit être à peu près de niveau.\n5. Si le voyant défaut persiste, contactez votre concession.",
  },
  {
    category: 'Chauffage',
    title: 'Le chauffage ne démarre pas',
    severity: 'attention',
    symptoms: 'Le chauffage reste froid ou affiche un code défaut sur le panneau de commande.',
    solution:
      "1. Vérifiez la tension de la batterie cellule (minimum 11 V).\n2. Contrôlez l'arrivée de gaz (bouteille, robinets, détendeur).\n3. Dégagez la cheminée extérieure (neige, feuilles).\n4. Notez le code défaut affiché et réinitialisez selon la notice.\n5. Si le défaut revient, contactez votre concession.",
  },
  {
    category: 'Sanitaire',
    title: 'Odeurs dans la cabine de toilette',
    severity: 'info',
    symptoms: 'Mauvaises odeurs persistantes provenant des toilettes ou des siphons.',
    solution:
      "1. Videz la cassette des toilettes et utilisez un produit adapté.\n2. Lubrifiez le joint de la trappe avec le produit d'entretien prévu.\n3. Remettez un peu d'eau dans les siphons (évier, douche, lavabo).\n4. Videz régulièrement le réservoir d'eaux grises.",
  },
  {
    category: 'Carrosserie',
    title: 'Le marchepied électrique ne rentre pas',
    severity: 'urgent',
    symptoms: "Le marchepied reste sorti, l'alarme de marchepied sonne au démarrage du moteur.",
    solution:
      "1. Ne roulez pas avec le marchepied sorti.\n2. Vérifiez qu'aucun obstacle (gravier, boue) ne bloque le mécanisme.\n3. Contrôlez le fusible du marchepied.\n4. Utilisez la procédure de rentrée manuelle décrite dans la notice.\n5. Contactez votre concession pour une vérification.",
  },
];

function seed(db, { adminEmail, adminPassword, log = console.log } = {}) {
  transaction(db, () => {
    if (db.prepare('SELECT COUNT(*) AS n FROM brands').get().n === 0) {
      BRANDS.forEach((brand, i) => {
        const { lastInsertRowid } = db.prepare('INSERT INTO brands (name, color, sort) VALUES (?, ?, ?)').run(brand.name, brand.color, i);
        brand.vehicles.forEach((name, j) => {
          db.prepare('INSERT INTO vehicles (brand_id, name, description, specs, sort) VALUES (?, ?, ?, ?, ?)').run(
            lastInsertRowid,
            name,
            'Fiche exemple : complétez la description, les caractéristiques et la photo depuis le back-office.',
            JSON.stringify([{ label: 'Places carte grise', value: 'À compléter' }]),
            j
          );
        });
      });
      PROBLEMS.forEach((p, i) => {
        db.prepare('INSERT INTO problems (category, title, symptoms, solution, severity, sort) VALUES (?, ?, ?, ?, ?, ?)').run(
          p.category,
          p.title,
          p.symptoms,
          p.solution,
          p.severity,
          i
        );
      });
      db.prepare('INSERT INTO dealerships (name, code, city) VALUES (?, ?, ?)').run('Concession de démonstration', 'DEMO2026', 'France');
      bumpContentVersion(db);
      log('[seed] Catalogue initial créé (Challenger, Randger) et concession de démonstration (code DEMO2026).');
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
