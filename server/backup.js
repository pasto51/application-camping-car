'use strict';

// Daily copy of the database in data/sauvegardes (the last 14 days are kept). « VACUUM INTO » writes a consistent copy
// even while the site is in use. To restore: stop the site, replace data/app.db by the copy, restart.
// Full backup (every week, or on demand): one archive site-AAAA-MM-JJ.tar.gz with the database, the photos and the keys
// of the site, enough to put the site back online elsewhere (see docs/SAUVEGARDE-ET-RESTAURATION.md).

const fs = require('node:fs');
const path = require('node:path');

const { spawnSync } = require('node:child_process');

const KEEP = 14;
const FULL_KEEP = 4;
const NAME = /^app-\d{4}-\d{2}-\d{2}\.db$/;
const FULL_NAME = /^site-\d{4}-\d{2}-\d{2}\.tar\.gz$/;

function backupDir(dataDir) {
  const dir = path.join(dataDir, 'sauvegardes');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listBackups(dataDir, pattern = NAME) {
  const dir = backupDir(dataDir);
  return fs
    .readdirSync(dir)
    .filter((f) => pattern.test(f))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, size: stat.size, date: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

function backupNow(db, dataDir) {
  const dir = backupDir(dataDir);
  const name = `app-${new Date().toISOString().slice(0, 10)}.db`;
  const file = path.join(dir, name);
  // One copy per day: today's is replaced by a fresher one.
  fs.rmSync(file, { force: true });
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  for (const old of listBackups(dataDir).slice(KEEP)) fs.rmSync(path.join(dir, old.name), { force: true });
  return listBackups(dataDir).find((b) => b.name === name);
}

const listFullBackups = (dataDir) => listBackups(dataDir, FULL_NAME);

const README = (date) => `Sauvegarde complète du site Compagnon de bord, faite le ${date}.

Contenu : app.db (la base : clients, demandes, contenus, comptes), uploads/ (les photos),
secret.key et vapid.json (les clés du site : sans elles, les codes d'accès et les notifications
des clients ne fonctionnent plus). Fichier confidentiel : gardez-le en lieu sûr.

Pour remettre le site dans cet état : voir docs/SAUVEGARDE-ET-RESTAURATION.md dans le code du site.
`;

// One archive with everything the site needs besides its code. Uses the « tar » command of the server.
function fullBackupNow(db, dataDir) {
  const dir = backupDir(dataDir);
  const day = new Date().toISOString().slice(0, 10);
  const name = `site-${day}.tar.gz`;
  const out = path.join(dir, name);
  const tmp = path.join(dir, '.complete-en-cours');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
  try {
    db.exec(`VACUUM INTO '${path.join(tmp, 'app.db').replace(/'/g, "''")}'`);
    for (const f of ['secret.key', 'vapid.json']) if (fs.existsSync(path.join(dataDir, f))) fs.copyFileSync(path.join(dataDir, f), path.join(tmp, f));
    fs.writeFileSync(path.join(tmp, 'LISEZ-MOI.txt'), README(day));
    fs.rmSync(out, { force: true });
    const r = spawnSync('tar', ['-czf', out, '-C', tmp, '.', '-C', dataDir, 'uploads'], { stdio: 'pipe' });
    if (r.error || r.status !== 0) throw new Error(`archive impossible (${r.error ? r.error.message : String(r.stderr).trim()})`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  for (const old of listFullBackups(dataDir).slice(FULL_KEEP)) fs.rmSync(path.join(dir, old.name), { force: true });
  return listFullBackups(dataDir).find((b) => b.name === name);
}

// Path of a backup, only for one of our own file names.
function backupFile(dataDir, name) {
  if (!NAME.test(String(name)) && !FULL_NAME.test(String(name))) return null;
  const file = path.join(backupDir(dataDir), name);
  return fs.existsSync(file) ? file : null;
}

module.exports = { backupNow, fullBackupNow, listBackups, listFullBackups, backupFile, KEEP, FULL_KEEP };
