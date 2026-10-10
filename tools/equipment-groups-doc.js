'use strict';
// Writes docs/EQUIPEMENTS-ENSEMBLES.md from server/equipment-groups.js and checks that every equipment of the
// catalogue is placed. Usage: node tools/equipment-groups-doc.js <equipment.json: [{id, cat, name}]>
const fs = require('node:fs');
const path = require('node:path');
const { GROUPS, HIDE } = require('../server/equipment-groups');

const eq = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const byId = Object.fromEntries(eq.map((e) => [e.id, e]));
const CATS = { cab: 'Cabine et conduite', conf: 'Salon, couchage, rangements', cui: 'Cuisine', sdb: 'Salle d’eau', eau: 'Eau', gaz: 'Gaz', elec: 'Électricité et énergie', chauf: 'Chauffage, climat, aération', ext: 'Extérieur', chas: 'Châssis et suspension', multi: 'Multimédia et connectivité', secu: 'Sécurité' };
const KIND = { always: 'toujours là', option: 'option', pick: 'un seul au choix' };
const name = (x) => x.name || byId[x.id]?.name || `?? ${x.id}`;
const dated = (d) => (d ? ` — 📅 ${d.kind === 'until' ? `rappel à la date marquée (${d.label})` : d.kind === 'made' ? `rappel ${d.years} ans après la date marquée (${d.label})` : `rappel tous les ${d.months} mois (${d.label})`}` : '');
const variant = (v) => (v ? ` — modèle : ${v.o.join(' · ')}` : '');

let md = `# Équipements : ensembles et éléments

> En place dans l’appli, le plan, le relevé et le back-office. Tout se modifie ensuite dans le back-office (Équipements → Modifier : « Fait partie de l’ensemble », « Sorte d’élément », « Date à suivre »).

**Ensemble** = le « gros truc », avec sa place sur le plan. **Élément** = ce qui se règle, se casse ou se change à part.
- **toujours là** : coché d’office avec l’ensemble ;
- **un seul au choix** : on choisit l’un ou l’autre (ex. type de batterie) ;
- **option** : coché seulement si le véhicule l’a ;
- **modèle** : question posée au client (avec « je ne sais pas »), jamais devinée ;
- 📅 : date relevée sur la pièce, avec rappel dans le carnet d’entretien ;
- 🔁 : ensembles qui se remplacent (le véhicule a l’un ou l’autre) ;
- 🆕 : créé pour l’occasion.

Les équipements qui ne sont dans aucun ensemble restent des équipements seuls (ils s’affichent comme avant).
`;
for (const [cat, catName] of Object.entries(CATS)) {
  const groups = GROUPS.filter((g) => g.cat === cat);
  if (!groups.length) continue;
  md += `\n## ${catName}\n`;
  for (const g of groups) {
    md += `\n### ${g.new ? '🆕 ' : ''}${name(g)}${g.alt ? ' 🔁' : ''}${dated(g.dated)}${variant(g.variant)}\n`;
    if (g.note) md += `_${g.note}_\n\n`;
    if (!g.kids.length) md += '- (pas d’élément)\n';
    for (const k of g.kids) {
      const pick = k.role === 'pick' ? ` (${g.picks?.[k.pick] || k.pick})` : '';
      md += `- ${k.new ? '🆕 ' : ''}**${name(k)}** — ${KIND[k.role]}${pick}${variant(k.variant)}${dated(k.dated)}${k.note ? ` (${k.note})` : ''}\n`;
    }
  }
}
md += `\n## Retirés de l’appli\n${HIDE.map((id) => `- ~~${byId[id]?.name || id}~~`).join('\n')}\n`;
const missing = GROUPS.flatMap((g) => [g, ...g.kids]).filter((x) => !x.new && !byId[x.id]).map((x) => x.id);
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'EQUIPEMENTS-ENSEMBLES.md'), md);
console.log(`ensembles : ${GROUPS.length}${missing.length ? ` ; INCONNUS : ${missing.join(', ')}` : ''}`);
