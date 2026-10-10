'use strict';
// Writes docs/EQUIPEMENTS-ENSEMBLES.md from server/equipment-groups.js and checks that every equipment of the
// catalogue is placed once. Usage: node tools/equipment-groups-doc.js <equipment.json: [{id, cat, name}]>
const fs = require('node:fs');
const path = require('node:path');
const { GROUPS, TO_REVIEW } = require('../server/equipment-groups');

const eq = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const byId = Object.fromEntries(eq.map((e) => [e.id, e]));
const CATS = { cab: 'Cabine et conduite', conf: 'Salon, couchage, rangements', cui: 'Cuisine', sdb: 'Salle d’eau', eau: 'Eau', gaz: 'Gaz', elec: 'Électricité et énergie', chauf: 'Chauffage, climat, aération', ext: 'Extérieur', chas: 'Châssis et suspension', multi: 'Multimédia et connectivité', secu: 'Sécurité' };
const KIND = { always: 'toujours là', choice: 'un modèle parmi', option: 'option' };

const placed = new Map();
const mark = (id, where) => { if (byId[id]) placed.set(id, [...(placed.get(id) || []), where]); };
const name = (x) => x.name || byId[x.id]?.name || `?? ${x.id}`;
const dated = (d) => (d ? ` — 📅 ${d.kind === 'until' ? `rappel à la date marquée (${d.label})` : d.kind === 'made' ? `rappel ${d.years} ans après la date marquée (${d.label})` : `rappel tous les ${d.months} mois (${d.label})`}` : '');

let md = `# Équipements : ensembles et éléments (proposition à relire)

> Rien n’est encore changé dans l’appli. Corrigez librement : ce qui manque, ce qui est mal rangé, les modèles proposés.

**Ensemble** = le « gros truc », avec sa place sur le plan. **Élément** = ce qui se règle, se casse ou se change à part.
- **toujours là** : apparaît d’office avec l’ensemble ;
- **un modèle parmi** : on demande lequel (avec « je ne sais pas »), jamais deviné ;
- **option** : coché seulement si le véhicule l’a ;
- 📅 : date relevée sur la pièce, avec rappel dans le carnet d’entretien ;
- 🔁 : ensembles qui se remplacent (le véhicule a l’un ou l’autre) ;
- 🆕 : n’existe pas encore, à créer.

`;
for (const [cat, catName] of Object.entries(CATS)) {
  const groups = GROUPS.filter((g) => g.cat === cat);
  if (!groups.length) continue;
  md += `\n## ${catName}\n`;
  for (const g of groups) {
    mark(g.id, g.id);
    md += `\n### ${g.new ? '🆕 ' : ''}${name(g)}${g.alt ? ' 🔁' : ''}${dated(g.dated)}\n`;
    if (g.note) md += `_${g.note}_\n\n`;
    if (!g.elements.length) md += '- (pas d’élément : l’ensemble suffit)\n';
    for (const e of g.elements) {
      mark(e.id, g.id);
      (e.replaces || []).forEach((r) => mark(r, g.id));
      const choices = e.choices ? ` : ${e.choices.join(' · ')}` : '';
      md += `- ${e.new ? '🆕 ' : ''}**${name(e)}** — ${KIND[e.kind]}${choices}${dated(e.dated)}\n`;
    }
  }
}
md += '\n## À décider\n';
for (const [id, why] of Object.entries(TO_REVIEW)) { mark(id, 'revoir'); md += `- **${byId[id]?.name || id}** : ${why}\n`; }

const missing = eq.filter((e) => !placed.has(e.id));
const twice = [...placed].filter(([, w]) => w.length > 1 && !w.every((x) => x === w[0]));
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'EQUIPEMENTS-ENSEMBLES.md'), md);
console.log(`équipements : ${eq.length}, placés : ${placed.size}, ensembles : ${GROUPS.length}`);
if (missing.length) console.log('NON PLACÉS :', missing.map((e) => `${e.id} (${e.name})`).join(', '));
if (twice.length) console.log('EN DOUBLE :', twice.map(([id, w]) => `${id} → ${w.join(', ')}`).join(' ; '));
