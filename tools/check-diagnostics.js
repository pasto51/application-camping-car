// Usage : node tools/check-diagnostics.js server/seed/compagnon.json resultat.json
// Contrôle des fins de parcours selon les règles du dossier (check.js, chk_cause.js, DECISIONS_ET_REGLES.md)
// + cohérence entre la dernière vérification et la conclusion.
const fs = require('fs');
const DATA = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const STOP = new Set('le la les un une des de du d l au aux et ou a est sont mon ma mes votre vos ce cet cette qui que qu dans sur sous avec sans pour par en y se s il elle on vous ne n pas plus ca bien si oui non tout tous toute est-ce reglé regle fois encore deja bien quand comme etait etaient a-t-il ont avez vous-meme meme'.split(' '));
const stem = (w) => (w.length > 5 ? w.slice(0, 5) : w.replace(/[sx]$/, ''));
const words = (s) => new Set(norm(s).replace(/[’']/g, ' ').split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem));
const RDV = ['atelier', 'etanch', 'revision'];

const issues = [];
let leaves = 0;
const add = (kind, d, path, leaf, detail) => issues.push({ kind, id: d.id, label: d.label, path: path.map((p) => `${p.t} → ${p.o[p.a]}`), leaf, detail });

for (const d of DATA.diagnostics) {
  if (!d.tree) continue;
  (function walk(n, path) {
    if (Array.isArray(n.n)) {
      if (!n.t || n.o.length < 2) add('question invalide', d, path, null, n.t);
      if (n.o.length !== n.n.length) add('question invalide', d, path, null, 'réponses / suites');
      n.o.forEach((o, i) => walk(n.n[i], path.concat([{ t: n.t, o: n.o, a: i }])));
      return;
    }
    leaves++;
    const L = n, last = path[path.length - 1];
    const ans = last ? norm(last.o[last.a]) : '';
    const all = [L.cause, L.geste, L.prod, L.sec].join(' ');
    if (!L.cause || !L.geste || !L.prod) add('fin incomplète (cause, geste ou produit vide)', d, path, L);
    if (L.rdv && !RDV.includes(L.rdv)) add('rendez-vous inconnu', d, path, L, L.rdv);
    if (/prise de quai/i.test(all)) add('vocabulaire interdit (« prise de quai »)', d, path, L);
    if (/\b\d{5,7}\b/.test(L.prod || '')) add('référence de pièce dans le produit', d, path, L, L.prod);
    if (/ ou |soit| et\/ou| ; |,/.test(L.cause || '')) add('plusieurs causes dans une même fin', d, path, L, L.cause);
    // Safety sentence when gas, carbon monoxide or 230 V is at stake
    if (/(odeur de gaz|fuite de gaz|monoxyde|\bco\b|fumee|suie|brul)/.test(norm(L.cause + ' ' + L.geste)) && !L.sec) add('sécurité absente (gaz / fumée / CO)', d, path, L);
    // The customer is never asked to dismantle gas, 230 V or electronics
    if (!L.pro && /(demont|ouvrez le boitier|ouvrez l.appareil|remplacez la carte|carte electronique|soudez|denudez)/.test(norm(L.geste))) add('geste réservé à un professionnel demandé au client', d, path, L, L.geste);
    // Coherence of the last answer with the conclusion
    const solved = /^oui/.test(ans) && /(regle|resolu|disparu|revenu|repart|fonctionne|marche|reparti|s.allume|tient)/.test(ans);
    const atelier = !!(L.rdv || L.pro) || /atelier|professionnel|concession/.test(norm(L.prod + ' ' + L.geste));
    if (solved && L.pro) add('« c’est réglé » mais fin « à faire par un professionnel »', d, path, L);
    if (solved && last) {
      const q = words(last.t), c = words(L.cause + ' ' + L.geste);
      const common = [...q].filter((w) => c.has(w));
      if (!common.length) add('« c’est réglé » : la cause ne reprend pas ce qui a été vérifié', d, path, L);
    }
    if (/^non/.test(ans) && last && last.o.some((o) => /^oui.*regle/.test(norm(o))) && !atelier && last.a === last.o.length - 1) {
      add('dernier « non » sans renvoi vers l’atelier', d, path, L);
    }
  })(d.tree, []);
}

const byKind = {};
issues.forEach((i) => (byKind[i.kind] = (byKind[i.kind] || 0) + 1));
console.log('fins de parcours contrôlées :', leaves);
console.log(JSON.stringify(byKind, null, 1));
fs.writeFileSync(process.argv[3], JSON.stringify(issues, null, 1));
