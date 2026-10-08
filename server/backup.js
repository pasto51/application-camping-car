'use strict';

// Daily copy of the database in data/sauvegardes (the last 14 days are kept). « VACUUM INTO » writes a consistent copy
// even while the site is in use. To restore: stop the site, replace data/app.db by the copy, restart.

const fs = require('node:fs');
const path = require('node:path');

const KEEP = 14;
const NAME = /^app-\d{4}-\d{2}-\d{2}\.db$/;

function backupDir(dataDir) {
  const dir = path.join(dataDir, 'sauvegardes');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listBackups(dataDir) {
  const dir = backupDir(dataDir);
  return fs
    .readdirSync(dir)
    .filter((f) => NAME.test(f))
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

// Path of a backup, only for one of our own file names.
function backupFile(dataDir, name) {
  if (!NAME.test(String(name))) return null;
  const file = path.join(backupDir(dataDir), name);
  return fs.existsSync(file) ? file : null;
}

module.exports = { backupNow, listBackups, backupFile, KEEP };
