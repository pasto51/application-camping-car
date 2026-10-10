'use strict';

// Before the real launch: removes the sales demo and every trial (customers, their requests, photos and data,
// notifications sent, bugs reported, statistics, the install-time dealership DEMO2026 when no team uses it).
// Keeps the administrators and the teams, the real dealerships, the vehicles, the catalogue, the diagnostics, the
// app contents, the tips, the banners and the settings.
//
//   node server/nettoyage.js         → shows what would be removed (nothing is changed)
//   node server/nettoyage.js --oui   → saves a copy of the database, then removes
//
// DATA_DIR: the data folder (by default « data » next to « server »).

const path = require('node:path');
const { openDatabase, bumpContentVersion } = require('./db');
const { createUploadStore } = require('./uploads');
const { deleteCustomer } = require('./routes/public');
const { removeDemo } = require('./demo-remove');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const db = openDatabase(path.join(dataDir, 'app.db'));
const uploads = createUploadStore(path.join(dataDir, 'uploads'));
const go = process.argv.includes('--oui');
const n = (sql, ...a) => db.prepare(sql).get(...a).n;

const DEMO_CODES = ['DEMONANT', 'DEMORENN', 'DEMOVANN'];
const customers = db.prepare('SELECT c.id, c.first_name, c.last_name, c.created_at, d.name AS dealer, d.code FROM customers c JOIN dealerships d ON d.id = c.dealership_id ORDER BY c.id').all();
const install = db.prepare("SELECT id, name FROM dealerships WHERE code = 'DEMO2026'").get();
const installTeam = install ? n("SELECT COUNT(*) AS n FROM admins WHERE dealership_id = ? AND email NOT LIKE '%@demo.test'", install.id) : 0;

console.log(`\nDossier des données : ${dataDir}\n`);
console.log(`Démo commerciale : ${n(`SELECT COUNT(*) AS n FROM dealerships WHERE code IN (${DEMO_CODES.map(() => '?').join(',')})`, ...DEMO_CODES)} concession(s), ${n("SELECT COUNT(*) AS n FROM admins WHERE email LIKE '%@demo.test'")} compte(s) @demo.test`);
console.log(`Clients d'essai : ${customers.length}`);
for (const c of customers) console.log(`   - ${[c.first_name, c.last_name].filter(Boolean).join(' ')} (${c.dealer}, créé le ${c.created_at.slice(0, 10)})`);
console.log(`   avec leurs demandes (${n('SELECT COUNT(*) AS n FROM reports')}), photos, carnets, astuces partagées et téléphones inscrits`);
console.log(`Notifications envoyées ou programmées : ${n('SELECT COUNT(*) AS n FROM notif_campaigns')}`);
console.log(`Problèmes signalés : ${n('SELECT COUNT(*) AS n FROM bug_reports')}`);
console.log(`Statistiques d'utilisation : ${n('SELECT COUNT(*) AS n FROM usage_events')} ligne(s)`);
if (install) {
  console.log(
    installTeam
      ? `Concession d'installation « ${install.name} » (code DEMO2026) : GARDÉE, ${installTeam} compte(s) d'équipe y sont rattachés. Changez son code dans Concessions si vous l'utilisez pour de vrai.`
      : `Concession d'installation « ${install.name} » (code DEMO2026) : supprimée (aucune équipe n'y est rattachée).`
  );
}
const demoIds = db.prepare(`SELECT id FROM dealerships WHERE code IN (${DEMO_CODES.map(() => '?').join(',')})`).all(...DEMO_CODES).map((d) => d.id);
const banners = db.prepare('SELECT title, dealership_ids FROM banners').all().filter((b) => {
  const t = JSON.parse(b.dealership_ids || '[]');
  return !(t.length && t.every((id) => demoIds.includes(id)));
});
if (banners.length) console.log(`\nGardés (à retirer vous-même dans le back-office s'ils étaient des essais) : bandeaux « À la une » : ${banners.map((b) => `« ${b.title} »`).join(', ')}`);

if (!go) {
  console.log('\nRien n’a été changé. Pour supprimer pour de bon : node server/nettoyage.js --oui\n');
  process.exit(0);
}

// A copy of the whole database first, to go back if needed.
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const copy = path.join(dataDir, `avant-nettoyage-${stamp}.db`);
db.exec(`VACUUM INTO '${copy.replace(/'/g, "''")}'`);
console.log(`\nCopie de sécurité : ${copy}`);

removeDemo(db);
for (const c of db.prepare('SELECT id FROM customers').all()) deleteCustomer(db, uploads, c.id);
db.exec('DELETE FROM notif_campaigns; DELETE FROM bug_reports; DELETE FROM usage_events;');
if (install && !installTeam) db.prepare('DELETE FROM dealerships WHERE id = ?').run(install.id);
// The apps reload their data (some contents depended on the removed customers' shared tips).
bumpContentVersion(db);
console.log('Nettoyage terminé. Redémarrez le site (Web → Sites → Redémarrer).\n');
db.close();
