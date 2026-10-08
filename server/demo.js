'use strict';

// Données de démonstration, pour essayer l'application en vrai sur le site (concessions, équipes, clients, demandes).
// Tout est marqué « DÉMO » : codes concession DEMONANT, DEMORENN, DEMOVANN, comptes en @demo.test. Rien ne touche aux vraies données.
//
// Usage (sur le serveur, dans le dossier de l'application) :
//   node server/demo.js                    → crée (ou recrée) la démo et affiche les accès
//   node server/demo.js vous@gmail.com     → idem, et les e-mails des services et des clients arrivent chez vous
//                                            (vous+sav-nantes@gmail.com, vous+client-paul@gmail.com…)
//   node server/demo.js --nom "Camping-Cars Dupont"  → la 1re concession porte le nom du prospect (présentation commerciale)
//   node server/demo.js --stats            → refait seulement les statistiques de test (12 mois de recherches, problèmes,
//                                            conseils…) des concessions démo, sans toucher aux clients, codes et liens
//   node server/demo.js --supprimer        → efface toute la démo
//   SITE_URL=https://mon-site.fr node server/demo.js   → adresse du site dans les liens (par défaut appvdl.alwaysdata.net)

const { createApp } = require('./app');
const { signToken, hashPassword } = require('./auth');

const PASSWORD = 'demo1234';
const SITE = new URL(process.env.SITE_URL || 'https://appvdl.alwaysdata.net');
const args = process.argv.slice(2);
const remove = args.includes('--supprimer');
const statsOnly = args.includes('--stats');
const inbox = args.find((a) => a.includes('@') && !a.startsWith('--'));
// Prospect's name for a sales presentation: shown on the first dealership (the one with SAV and store on site).
const nameAt = args.indexOf('--nom');
const prospect = nameAt >= 0 ? String(args[nameAt + 1] || '').trim().slice(0, 80) : '';

// Plus addressing (vous+tag@domaine): every demo e-mail reaches the person testing, with its destination in the address.
const mailbox = (tag) => {
  if (!inbox) return `${tag}@demo.test`;
  const [user, domain] = inbox.trim().toLowerCase().split('@');
  return `${user}+${tag}@${domain}`;
};

const day = (monthsAgo, extraDays = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(d.getDate() - extraDays);
  return d.toISOString().slice(0, 10);
};
const plusYears = (iso, years) => `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`;

// No e-mail or push while the demo is built: they start when you use it.
const silent = new Proxy({}, { get: () => async () => false });

function removeDemo(db) {
  // Only these three: the dealership DEMO2026 created at install time is left alone.
  const ids = db.prepare("SELECT id FROM dealerships WHERE code IN ('DEMONANT', 'DEMORENN', 'DEMOVANN')").all().map((d) => d.id);
  let customers = 0;
  for (const id of ids) customers += db.prepare('DELETE FROM customers WHERE dealership_id = ?').run(id).changes;
  for (const id of ids) db.prepare('DELETE FROM usage_events WHERE dealership_id = ?').run(id);
  const accounts = db.prepare("DELETE FROM admins WHERE email LIKE '%@demo.test'").run().changes;
  for (const id of ids) db.prepare('DELETE FROM dealerships WHERE id = ?').run(id);
  return { dealerships: ids.length, customers, accounts };
}

// Seasons of each problem (12 weights, January → December), so that the « Statistiques » page tells a true story:
// fogged windscreen and cold in winter, heat and air conditioning in summer, departures in spring, storage in autumn.
const WINTER = [10, 9, 6, 3, 1, 1, 1, 1, 2, 5, 8, 10];
const SUMMER = [1, 1, 2, 3, 5, 8, 10, 10, 5, 2, 1, 1];
const SPRING = [2, 3, 8, 10, 8, 5, 4, 3, 4, 3, 2, 2];
const AUTUMN = [3, 2, 2, 2, 1, 1, 1, 2, 4, 9, 10, 6];
const FLAT = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
const USAGE = [
  ['p_buee', WINTER, 9, ['buée pare-brise', 'condensation vitres', 'buee le matin']],
  ['p_froid', WINTER, 7, ['froid la nuit', 'sol froid']],
  ['g_truma', WINTER, 6, ['chauffage ne marche pas', 'truma clignote']],
  ['p_gaz', WINTER, 5, ['bouteille gaz vide vite']],
  ['c_tank_gel', WINTER, 3, ['eau gelée']],
  ['p_chaleur', SUMMER, 9, ['trop chaud la nuit', 'chaleur cellule']],
  ['h_clim', SUMMER, 6, ['clim ne refroidit pas']],
  ['h_frigo', SUMMER, 8, ['frigo ne refroidit pas', 'frigo gaz']],
  ['p_autonomie', SUMMER, 8, ['batterie ne tient pas', 'autonomie batterie']],
  ['p_moustiques', SUMMER, 4, ['moustiques']],
  ['p_eau', SUMMER, 4, ['manque d eau']],
  ['h_store', SUMMER, 5, ['store bloqué', 'manivelle store']],
  ['p_tpms', SPRING, 4, ['pression pneus']],
  ['p_balan', SPRING, 5, ['camping car balance', 'roulis virage']],
  ['h_wc', FLAT, 5, ['odeur toilettes', 'cassette fuit']],
  ['p_internet', FLAT, 4, ['pas internet', 'wifi camping']],
  ['p_vol', FLAT, 3, ['alarme vol']],
  ['p_stockage', AUTUMN, 4, ['hivernage', 'stockage hiver']],
];
const UNANSWERED = ['remorque', 'attelage', 'starlink', 'panneau grêle'];

function seedUsage(db, dealershipIds) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const leafOf = new Map();
  for (const [id] of USAGE) {
    const row = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(id);
    if (!row) continue;
    const leaves = [];
    (function walk(n) {
      if (!n) return;
      if (Array.isArray(n.n)) n.n.forEach(walk);
      else leaves.push(n);
    })(JSON.parse(row.data).tree);
    leafOf.set(id, leaves.filter((l) => l.prod && !/^Aucun/.test(l.prod)));
  }
  const equipment = db.prepare('SELECT id FROM equipment ORDER BY sort LIMIT 40').all().map((r) => r.id);
  const types = ['fourgon', 'fourgon', 'profile', 'profile', 'compact', 'integral', 'van'];
  const insert = db.prepare('INSERT INTO usage_events (at, month, kind, item, label, query, prod, results, dealership_id, vehicle_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  let n = 0;
  const now = new Date();
  for (let back = 11; back >= 0; back--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 15));
    const month = d.toISOString().slice(0, 7);
    const at = `${month}-15 12:00:00`;
    const growth = 0.6 + (11 - back) * 0.05; // more customers on the app month after month
    dealershipIds.forEach((dealer, k) => {
      const size = [1, 0.7, 0.45][k] || 0.5;
      for (const [id, season, weight, queries] of USAGE) {
        const times = Math.round(season[d.getUTCMonth()] * weight * size * growth * (0.7 + rnd() * 0.6) / 4);
        for (let i = 0; i < times; i++) {
          const type = types[Math.floor(rnd() * types.length)];
          if (rnd() < 0.6) { insert.run(at, month, 'search', null, null, queries[Math.floor(rnd() * queries.length)], null, 1 + Math.floor(rnd() * 4), dealer, type); n++; }
          insert.run(at, month, 'diag', id, null, null, null, null, dealer, type); n++;
          const leaves = leafOf.get(id) || [];
          if (leaves.length && rnd() < 0.75) {
            const leaf = leaves[Math.floor(rnd() * leaves.length)];
            insert.run(at, month, 'result', id, leaf.cause, null, leaf.prod, null, dealer, type); n++;
            if (rnd() < (id.startsWith('p_') ? 0.22 : 0.08)) { insert.run(at, month, 'shop', id, null, null, leaf.prod, null, dealer, type); n++; }
          }
        }
      }
      for (let i = 0; i < Math.round(25 * size * growth); i++) {
        insert.run(at, month, 'equip', equipment[Math.floor(rnd() * equipment.length)], null, null, null, null, dealer, types[Math.floor(rnd() * types.length)]); n++;
      }
      if (rnd() < 0.5) { insert.run(at, month, 'search', null, null, UNANSWERED[Math.floor(rnd() * UNANSWERED.length)], null, 0, dealer, null); n++; }
    });
  }
  return n;
}

async function main() {
  const app = createApp({ notify: silent, log: () => {} });
  const { db, config } = app;

  if (statsOnly) {
    const ids = db.prepare("SELECT id FROM dealerships WHERE code IN ('DEMONANT', 'DEMORENN', 'DEMOVANN') ORDER BY id").all().map((d) => d.id);
    if (!ids.length) throw new Error('Pas de démo sur ce site : lancez d’abord node server/demo.js');
    for (const id of ids) db.prepare('DELETE FROM usage_events WHERE dealership_id = ?').run(id);
    const n = seedUsage(db, ids);
    // A demo made before the statistics has no analyst account yet.
    if (!db.prepare("SELECT 1 FROM admins WHERE email = 'analyste@demo.test'").get()) {
      db.prepare("INSERT INTO admins (email, name, password_hash, role) VALUES ('analyste@demo.test', 'Analyste marketing', ?, 'analytics')").run(hashPassword(PASSWORD));
      console.log(`Compte créé : analyste@demo.test (mot de passe ${PASSWORD}).`);
    }
    console.log(`Statistiques de test ajoutées : ${n} actions sur 12 mois pour les ${ids.length} concessions démo (recherches, problèmes, conseils, demandes au magasin, équipements).`);
    console.log('À voir dans le back-office : Statistiques (compte analyste@demo.test, ou administrateur).');
    console.log(`Base de données : ${require('node:path').resolve(process.env.DATA_DIR || require('node:path').join(__dirname, '..', 'data'))}`);
    console.log('Pensez à redémarrer le site (Web → Sites → Redémarrer) si vous venez de faire la mise à jour.');
    db.close();
    return;
  }

  if (remove) {
    const r = removeDemo(db);
    console.log(`Démo supprimée : ${r.dealerships} concession(s), ${r.customers} client(s), ${r.accounts} compte(s).`);
    db.close();
    return;
  }

  const old = removeDemo(db);
  if (old.dealerships) console.log('(Ancienne démo effacée, nouvelle démo en cours…)');
  const admin = db.prepare("SELECT id FROM admins WHERE role = 'admin' ORDER BY id LIMIT 1").get();
  if (!admin) throw new Error('Aucun administrateur : lancez d’abord node server/reset-admin.js');
  const vehicles = db.prepare('SELECT id, name FROM vehicles WHERE active = 1 ORDER BY sort, id').all();
  if (!vehicles.length) throw new Error('Aucun véhicule actif dans le catalogue');

  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const adminToken = signToken({ sub: admin.id, role: 'admin' }, config.secret, 600);
  async function call(method, url, body, token = adminToken) {
    const res = await fetch(base + url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        // Links in the answers point to the real site, not to this temporary server.
        'X-Forwarded-Proto': SITE.protocol.replace(':', ''),
        'X-Forwarded-Host': SITE.host,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${method} ${url} : ${data?.error || res.status}`);
    return data;
  }
  const staffToken = (id, role) => signToken({ sub: id, role }, config.secret, 600);
  let v = 0;
  const nextVehicle = () => vehicles[v++ % vehicles.length].id;

  // ---- Dealerships ----
  const DEALERS = [
    {
      key: 'nantes',
      name: prospect ? `DÉMO – ${prospect}` : 'DÉMO – Évasion Loisirs Nantes',
      code: 'DEMONANT',
      city: 'Nantes',
      phone: '02 40 00 00 00',
      email: mailbox('accueil-nantes'),
      storeEmail: mailbox('magasin-nantes'),
      savEmail: mailbox('sav-nantes'),
      savPhone: '02 40 00 00 01',
      savHours: 'Lun-ven 8h30-12h / 14h-18h',
      storePhone: '02 40 00 00 02',
      storeHours: 'Mar-sam 9h-12h / 14h-19h',
      warrantyYears: 2,
      situation: 'SAV et magasin sur place',
    },
    {
      key: 'rennes',
      name: 'DÉMO – Horizon Camping-Cars Rennes',
      code: 'DEMORENN',
      city: 'Rennes',
      phone: '02 99 00 00 00',
      email: mailbox('accueil-rennes'),
      storeEmail: mailbox('magasin-rennes'),
      savEmail: mailbox('sav-rennes'),
      savPhone: '02 99 00 00 01',
      storePhone: '02 99 00 00 02',
      storeAddress: 'ZA des Loisirs, 35000 Rennes',
      storeDetached: true,
      warrantyYears: 3,
      situation: 'magasin DÉTACHÉ (indépendant), garantie habituelle 3 ans',
    },
    {
      key: 'vannes',
      name: 'DÉMO – Côte Ouest Vannes',
      code: 'DEMOVANN',
      city: 'Vannes',
      phone: '02 97 00 00 00',
      email: mailbox('accueil-vannes'),
      warrantyYears: 2,
      situation: 'aucun e-mail SAV / magasin renseigné : tout part à l’e-mail général',
    },
  ];
  const D = {};
  for (const d of DEALERS) {
    const created = await call('POST', '/api/admin/dealerships', { ...d, active: true });
    await call('PUT', `/api/admin/dealerships/${created.id}`, d);
    D[d.key] = { ...d, id: created.id, staff: {} };
  }

  // ---- Back-office accounts ----
  const ACCOUNTS = [
    ['nantes', 'manager', 'Claire Martin', 'responsable.nantes'],
    ['nantes', 'sales', 'Julien Robert', 'julien.nantes', '06 11 11 11 11'],
    ['nantes', 'sales', 'Sophie Bernard', 'sophie.nantes', '06 22 22 22 22'],
    ['nantes', 'sav', 'Atelier Nantes', 'sav.nantes'],
    ['nantes', 'store', 'Magasin Nantes', 'magasin.nantes'],
    ['rennes', 'manager', 'Marc Lefèvre', 'responsable.rennes'],
    ['rennes', 'sales', 'Lucas Garnier', 'lucas.rennes'],
    ['rennes', 'sav', 'Atelier Rennes', 'sav.rennes'],
    ['rennes', 'store', 'Magasin Rennes (détaché)', 'magasin.rennes'],
    ['vannes', 'manager', 'Yann Le Floch', 'responsable.vannes'],
    ['vannes', 'sales', 'Gwen Tanguy', 'gwen.vannes'],
    [null, 'editor', 'Éditrice de contenu', 'editeur'],
    [null, 'analytics', 'Analyste marketing', 'analyste'],
  ];
  const accounts = [];
  for (const [key, role, name, login, phone] of ACCOUNTS) {
    const email = `${login}@demo.test`;
    const u = await call('POST', '/api/admin/users', { email, name, phone, role, password: PASSWORD, dealershipId: key ? D[key].id : null });
    if (key) D[key].staff[login.split('.')[0]] = u;
    accounts.push({ key, role, name, email, id: u.id });
  }

  // ---- Customers ----
  // via: 'app' = handover on the customer's phone, 'bo' = registered from the back-office.
  const CUSTOMERS = [
    { key: 'nantes', via: 'app', first: 'Paul', last: 'Morel', sales: 'julien', handover: day(17), note: 'sous garantie' },
    { key: 'nantes', via: 'bo', first: 'Martine', last: 'Leroy', sales: 'julien', handover: day(64), note: 'hors garantie' },
    { key: 'nantes', via: 'app', first: 'Henri', last: 'Dubois', sales: 'sophie', handover: day(40), ext: 5, note: 'sous extension de garantie' },
    { key: 'nantes', via: 'bo', first: 'Nadia', last: 'Petit', sales: 'sophie', handover: day(0, 12), note: 'livrée il y a 12 jours, aucune demande' },
    { key: 'rennes', via: 'app', first: 'Isabelle', last: 'Roux', sales: 'lucas', handover: day(19), note: 'sous garantie (3 ans)' },
    { key: 'rennes', via: 'bo', first: 'Bernard', last: 'Fontaine', sales: 'lucas', handover: day(80), note: 'hors garantie' },
    { key: 'rennes', via: 'bo', first: 'Élodie', last: 'Chevalier', sales: null, handover: day(3), note: 'sans commercial attitré' },
    { key: 'vannes', via: 'app', first: 'Yves', last: 'Le Gall', sales: 'gwen', handover: day(70), note: 'hors garantie' },
    { key: 'vannes', via: 'bo', first: 'Anne', last: 'Moreau', sales: 'gwen', handover: day(6), note: 'sous garantie' },
  ];
  const C = {};
  for (const c of CUSTOMERS) {
    const d = D[c.key];
    const salesperson = c.sales ? d.staff[c.sales] : null;
    const email = mailbox(`client-${c.first.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}`);
    const warrantyExtEnd = c.ext ? plusYears(c.handover, c.ext) : '';
    const vehicleId = nextVehicle();
    let id;
    let token;
    if (c.via === 'app') {
      const h = await call('POST', '/api/handover', {
        dealershipCode: d.code,
        vehicleId,
        salespersonId: salesperson?.id,
        customer: { firstName: c.first, lastName: c.last, email, phone: '06 00 00 00 00', handoverDate: c.handover, warrantyEnd: '', warrantyExtEnd },
      });
      id = h.customer.id;
      token = h.token;
      await call('POST', '/api/me/access-code', { dealershipCode: d.code }, token);
    } else {
      const author = salesperson ? staffToken(salesperson.id, 'sales') : adminToken;
      const created = await call('POST', '/api/admin/customers', {
        vehicleId,
        dealershipId: d.id,
        firstName: c.first,
        lastName: c.last,
        email,
        phone: '06 00 00 00 00',
        handoverDate: c.handover,
        warrantyExtEnd,
        salespersonId: salesperson?.id,
      }, author);
      id = created.id;
    }
    if (!token) {
      const link = (await call('POST', `/api/admin/customers/${id}/resend`, { sendEmail: false })).appLink;
      token = (await call('POST', '/api/link', { token: new URL(link).searchParams.get('lien') })).token;
    }
    C[c.first] = { ...c, id, token, dealer: d };
  }

  // ---- Requests, as the customers would send them from the app ----
  const ask = (who, body) => call('POST', '/api/me/requests', body, C[who].token);
  const part = (who, body) => call('POST', '/api/me/parts', body, C[who].token);
  const answer = (staff, report, body) => call('PUT', `/api/admin/reports/${report.id}`, body, staffToken(staff.id, staff.role));
  const N = D.nantes.staff;
  const R = D.rennes.staff;

  const r1 = await ask('Paul', { title: 'Test d’étanchéité', message: 'Bonjour, je voudrais faire le test d’étanchéité annuel. Quand puis-je venir ?', period: 'Dans le mois' });
  await answer(N.sav, r1, { status: 'en_cours', message: 'Bonjour M. Morel, nous pouvons vous recevoir mardi prochain à 14h. Prévoir 2 heures. Cela vous convient-il ?' });
  await part('Paul', { need: 'remplacement', equipmentName: 'Pompe à eau', model: 'Shurflo Trail King 7', ref: '2095-422-534', cellNumber: 'CL-48213', vehicleYear: '2025', message: 'La pompe tourne mais ne débite plus.' });

  const r3 = await part('Martine', { need: 'piece', equipmentName: 'Store banne', product: 'Manivelle du store', model: 'Thule Omnistor 5200', cellNumber: 'CL-20871', vehicleYear: '2021' });
  await answer(N.magasin, r3, { status: 'en_cours', message: 'Bonjour Mme Leroy, la manivelle (réf. 1500725) est en stock : 34,90 €. Nous vous la mettons de côté.' });
  await part('Martine', { need: 'accessoire', equipmentName: 'Porte-vélos', product: 'Porte-vélos 3 vélos électriques', message: 'Est-ce possible sur mon véhicule ?' });

  await part('Henri', { need: 'remplacement', equipmentName: 'Réfrigérateur', model: 'Thetford T2160', message: 'Ne refroidit plus sur le gaz.' });
  const r6 = await part('Henri', { need: 'accessoire', equipmentName: 'Antenne satellite', product: 'Antenne automatique' });
  await answer(N.magasin, r6, { service: 'sav', transferNote: 'Pose avec passage de câbles : à voir avec l’atelier' });

  await part('Isabelle', { need: 'piece', equipmentName: 'Chauffage', model: 'Truma Combi 4', message: 'Code erreur E517H.' });
  // Comfort problem in the app (« Mon camping-car balance en virage ») → product of the store, even under warranty.
  await part('Isabelle', { need: 'accessoire', product: 'Suspensions pneumatiques auxiliaires', message: 'Conseillé par l’appli : mon camping-car penche et balance en virage.' });
  const r8 = await part('Bernard', { need: 'piece', equipmentName: 'Lanterneau', product: 'Lanterneau 40x40', model: 'Dometic Mini Heki' });
  await answer(R.magasin, r8, { status: 'resolu', message: 'Bonjour, lanterneau commandé, réception jeudi. Pose possible au magasin.' });
  await part('Bernard', { need: 'accessoire', equipmentName: 'Panneau solaire', product: 'Kit solaire 150 W' });
  await ask('Élodie', { title: 'Bruit de roulement', message: 'Un bruit à l’arrière gauche depuis la livraison.' });

  await part('Yves', { need: 'piece', equipmentName: 'WC', product: 'Joint de cassette', model: 'Thetford C223' });
  await ask('Anne', { title: 'Contrôle gaz', message: 'Je voudrais le contrôle gaz avant l’hiver.' });

  // ---- 12 months of use of the app (anonymous statistics), with the seasons, for the « Statistiques » page ----
  const statsCount = seedUsage(db, Object.values(D).map((d) => d.id));

  // ---- What each one sees (checked now, printed below) ----
  const seen = async (staff) =>
    (await call('GET', '/api/admin/reports', undefined, staffToken(staff.id, staff.role))).map((r) => `${r.title} [${r.service === 'magasin' ? 'magasin' : 'SAV'}]`);
  const checks = [
    ['SAV Nantes', await seen(N.sav)],
    ["Magasin Nantes", await seen(N.magasin)],
    ['Responsable Nantes', await seen(N.responsable)],
    ['SAV Rennes', await seen(R.sav)],
    ['Magasin Rennes (détaché)', await seen(R.magasin)],
    ['Responsable Rennes', await seen(R.responsable)],
  ];

  // ---- Customer access: a one-time link (14 days) and the name + access code ----
  const out = [];
  for (const c of Object.values(C)) {
    const res = await call('POST', `/api/admin/customers/${c.id}/resend`, { sendEmail: false });
    out.push({ ...c, link: res.appLink, code: res.accessCode });
  }

  const line = '─'.repeat(78);
  console.log(`\n${line}\n DÉMO prête sur ${SITE.origin}\n${line}`);
  console.log('\n BACK-OFFICE : ' + SITE.origin + '/admin/   (mot de passe de tous les comptes démo : ' + PASSWORD + ')\n');
  const ROLE = { manager: 'Responsable', sales: 'Commercial', sav: 'SAV', store: 'Magasin', editor: 'Éditeur de contenu', analytics: 'Analyste' };
  for (const d of Object.values(D)) {
    console.log(` ${d.name}  (code concession ${d.code} — ${d.situation})`);
    for (const a of accounts.filter((x) => x.key === d.key)) console.log(`    ${ROLE[a.role].padEnd(12)} ${a.name.padEnd(26)} ${a.email}`);
  }
  console.log(`\n Sans concession :\n    ${ROLE.editor.padEnd(12)} ${'Éditrice de contenu'.padEnd(26)} editeur@demo.test\n    ${ROLE.analytics.padEnd(12)} ${'Analyste marketing'.padEnd(26)} analyste@demo.test   (page Statistiques : ${statsCount} actions sur 12 mois)`);
  console.log(`\n${line}\n ESPACES CLIENTS : ouvrez le lien (une seule fois), ou dans l'appli « J'ai déjà un compte » avec le nom et le code.\n Un seul client à la fois par navigateur : ouvrir un autre lien change de client.\n${line}`);
  for (const c of out) {
    console.log(`\n ${c.first} ${c.last} — ${c.dealer.name.replace('DÉMO – ', '')} — ${c.note}${c.sales ? ` — commercial : ${c.dealer.staff[c.sales].name}` : ''}`);
    console.log(`    Nom : ${c.last}   Code : ${c.code}`);
    console.log(`    ${c.link}`);
  }
  console.log(`\n${line}\n VÉRIFICATION DE LA RÉPARTITION DES DEMANDES\n${line}`);
  for (const [who, titles] of checks) console.log(` ${who.padEnd(26)} ${titles.length} demande(s) :\n    ${titles.join('\n    ')}`);
  console.log(`\n Pour tout effacer : node server/demo.js --supprimer\n`);

  app.server.closeAllConnections();
  app.server.close();
  db.close();
}

main().catch((err) => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
