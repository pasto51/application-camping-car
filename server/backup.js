'use strict';

// Daily copy of the database in data/sauvegardes (the last 14 days are kept). « VACUUM INTO » writes a consistent copy
// even while the site is in use. To restore: stop the site, replace data/app.db by the copy, restart.
// Full backup (every day, or on demand): one archive site-AAAA-MM-JJ.tar.gz with EVERYTHING needed to put the site back
// online on a new server, even if this one is lost or locked and without GitHub: the database, the photos, the keys of
// the site, its code (folder code/), the settings of the server and a step-by-step guide (LISEZ-MOI.txt). It must be
// downloaded off the server (see docs/SAUVEGARDE-ET-RESTAURATION.md): the back-office warns after 30 days without.

const fs = require('node:fs');
const path = require('node:path');

const { spawnSync } = require('node:child_process');

const KEEP = 14;
const FULL_KEEP = 7;
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

// The code of the site as it runs on the server (the data folder is saved apart, just above).
const APP_ROOT = path.join(__dirname, '..');
const CODE = ['server', 'public', 'tools', 'docs', 'test', 'package.json', 'README.md', 'CLAUDE.md', 'Dockerfile', 'docker-compose.yml', 'render.yaml'];
function codeVersion() {
  const r = spawnSync('git', ['-C', APP_ROOT, 'rev-parse', '--short=10', 'HEAD'], { stdio: 'pipe' });
  return r.status === 0 ? String(r.stdout).trim() : '';
}

const README = (date, version) => `SAUVEGARDE COMPLÈTE DU SITE COMPAGNON DE BORD — faite le ${date}
${version ? `Version du code : ${version}\n` : ''}
Ce fichier suffit, à lui seul, pour remettre tout le site en ligne sur un nouveau serveur :
même si l'ancien serveur est perdu, piraté ou bloqué, et même sans GitHub.
FICHIER CONFIDENTIEL (données des clients, clés du site) : gardez-le sur votre ordinateur
et sur une clé USB, ne l'envoyez à personne.

CONTENU
  app.db                la base : clients, véhicules, demandes, contenus, comptes, réglages des e-mails
  uploads/              les photos
  secret.key            la clé du site (codes d'accès des clients) — indispensable
  vapid.json            la clé des notifications — indispensable
  code/                 le code du site (programmes en JavaScript pour Node.js)
  REGLAGES-SERVEUR.txt  comment régler le nouveau serveur

REMETTRE LE SITE EN LIGNE SUR UN NOUVEAU SERVEUR (alwaysdata ou autre)
  1. Créez le compte d'hébergement. Choisissez Node.js 22 ou plus récent
     (alwaysdata : Environnement → Node.js).
  2. Envoyez ce fichier dans le dossier de base du serveur (~), avec FileZilla
     (connexion SFTP, identifiants SSH de l'hébergeur).
  3. Dans la console SSH, copiez-collez cette ligne (remplacez le nom du fichier) :
       mkdir -p ~/application-camping-car/data && cd ~/application-camping-car && tar -xzf ~/site-${date}.tar.gz -C data && cp -r data/code/. . && rm -rf data/code && echo OK
  4. Créez le site comme décrit dans REGLAGES-SERVEUR.txt (type Node.js, commande, dossier),
     puis Redémarrer.
  5. Ouvrez /admin/ : connectez-vous avec vos comptes habituels (ils sont dans la base).
     Les clients retrouvent tout (compte, photos, demandes) ; leurs codes d'accès et les
     notifications marchent, car les clés sont dans la sauvegarde.
  6. Si l'adresse du site change, renvoyez les codes d'accès depuis les fiches clients,
     ou gardez la même adresse (nom de domaine).

Mode d'emploi détaillé : code/docs/SAUVEGARDE-ET-RESTAURATION.md
`;

const SETTINGS = (env) => `RÉGLAGES DU SERVEUR — à recréer sur le nouvel hébergement

Hébergement d'origine : alwaysdata (compte appvdl). Ces réglages marchent ailleurs aussi.

Node.js : version 22 ou plus récente.

Site (alwaysdata : Web → Sites → Ajouter un site)
  Type .............. Node.js
  Commande .......... node server/index.js
  Dossier de travail  application-camping-car
  Adresse ........... celle de votre compte (ou votre nom de domaine)

Variables d'environnement utilisées par le site (toutes facultatives) :
  PORT et IP ........ donnés par l'hébergeur (alwaysdata les règle tout seul)
  DATA_DIR .......... dossier des données (par défaut : application-camping-car/data)
  SITE_URL .......... adresse publique du site${env.SITE_URL ? ` (valeur actuelle : ${env.SITE_URL})` : ''}
  ADMIN_EMAIL et ADMIN_PASSWORD : seulement pour créer le premier compte d'un site VIDE.
                      Inutile ici : vos comptes sont déjà dans la base.
  SECRET ............ inutile : la clé du site est dans secret.key.

Réglages enregistrés dans la base (rien à refaire) : e-mails (SMTP), concessions, équipes,
contenus de l'appli, bandeaux, notifications.

E-mails : si l'adresse d'envoi était une adresse alwaysdata, recréez la même boîte chez le nouvel
hébergeur (ou changez-la dans le back-office : Paramètres → E-mails).
`;

// One archive with everything the site needs: data, keys, code, settings. Uses the « tar » command of the server.
// secret: the key the site really uses (it may come from the SECRET variable rather than from secret.key).
function fullBackupNow(db, dataDir, { secret } = {}) {
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
    if (secret) fs.writeFileSync(path.join(tmp, 'secret.key'), secret, { mode: 0o600 });
    const version = codeVersion();
    for (const f of CODE) {
      const src = path.join(APP_ROOT, f);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(tmp, 'code', f), { recursive: true });
    }
    if (version) fs.writeFileSync(path.join(tmp, 'code', 'VERSION.txt'), `${version}\n`);
    fs.writeFileSync(path.join(tmp, 'LISEZ-MOI.txt'), README(day, version));
    fs.writeFileSync(path.join(tmp, 'REGLAGES-SERVEUR.txt'), SETTINGS(process.env));
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
