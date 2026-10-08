#!/usr/bin/env node
'use strict';

// Draws the top-view plan of each layout ("implantation": lit central, salon arrière…) of each vehicle type,
// 800 × 360, cab on the right, entrance door at the bottom, and writes the numbered zones that go with it.
// One definition for both, so the dots always sit on the drawing.
//   node tools/make-plans.js  →  public/app/plans/<layout>.svg (+ <type>.svg for the default one) and server/seed/plans.json

const fs = require('node:fs');
const path = require('node:path');

const C = { bg: '#f3f7f6', body: '#0c2b33', fur: '#dff1ef', bed: '#e9f3f2', line: '#0a7c82', soft: '#9bbcc0', kit: '#fdf3e3', kitLine: '#b7791f', wet: '#eef4fb', glass: '#7fb6bd', wheel: '#3d5a60', text: '#5f7d82' };

const rect = (x, y, w, h, fill, stroke = C.line, rx = 8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const dashed = (x, y, w, h, stroke = C.line) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-dasharray="8 6"/>`;
const label = (x, y, text) => `<text x="${x}" y="${y}" font-size="13" fill="${C.text}" text-anchor="middle">${text}</text>`;
const pillow = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#fff" stroke="${C.soft}" stroke-width="2"/>`;
const wheels = (xs, top, bottom) => `<g fill="${C.wheel}">${xs.map((x) => `<rect x="${x}" y="${top}" width="70" height="18" rx="6"/><rect x="${x}" y="${bottom}" width="70" height="18" rx="6"/>`).join('')}</g>`;
const seats = (x) => `<g fill="${C.fur}" stroke="${C.line}" stroke-width="2"><rect x="${x}" y="98" width="58" height="62" rx="14"/><rect x="${x}" y="200" width="58" height="62" rx="14"/></g>`;
const windshield = (x) => `<path d="M${x} 104 C${x + 16} 140 ${x + 16} 220 ${x} 256" fill="none" stroke="${C.glass}" stroke-width="10" stroke-linecap="round"/>`;
const sdb = (x, y, w, h) => `${rect(x, y, w, h, C.wet)}${pillow(x + 10, y + 10, Math.round(w * 0.42), h - 20)}<ellipse cx="${x + w - 26}" cy="${y + h / 2}" rx="16" ry="21" fill="#fff" stroke="${C.soft}" stroke-width="2"/>`;
const kitchen = (x, y, w) => `${rect(x, y, w, 48, C.kit, C.kitLine)}<rect x="${x + 14}" y="${y + 9}" width="40" height="30" rx="6" fill="#fff" stroke="${C.kitLine}" stroke-width="2"/><circle cx="${x + w - 62}" cy="${y + 24}" r="10" fill="none" stroke="${C.kitLine}" stroke-width="2"/><circle cx="${x + w - 30}" cy="${y + 24}" r="10" fill="none" stroke="${C.kitLine}" stroke-width="2"/>`;
const dinette = (x, y) => `${rect(x, y, 62, 92, C.fur)}${rect(x + 74, y + 12, 76, 60, '#fff', C.soft)}`;
const door = (x, y, w = 70) => `<rect x="${x}" y="${y - 8}" width="${w}" height="16" fill="${C.bg}"/><line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${C.line}" stroke-width="4" stroke-dasharray="10 6"/>`;
const wardrobe = (x, y, w, h) => `${rect(x, y, w, h, C.fur)}<line x1="${x + 6}" y1="${y + h / 2}" x2="${x + w - 6}" y2="${y + h / 2}" stroke="${C.soft}" stroke-width="2"/>`;

const vanBody = (x0) => `<path d="M${x0 + 14} 46 H690 C735 46 772 62 782 110 V250 C772 298 735 314 690 314 H${x0 + 14} A14 14 0 0 1 ${x0} 300 V60 A14 14 0 0 1 ${x0 + 14} 46 Z" fill="#fff" stroke="${C.body}" stroke-width="4"/>`;
const cellBody = (x0, x1) => `<path d="M${x1} 80 H700 C742 80 772 96 782 130 V230 C772 264 742 280 700 280 H${x1}" fill="#fff" stroke="${C.body}" stroke-width="4"/><rect x="${x0}" y="36" width="${x1 - x0}" height="288" rx="18" fill="#fff" stroke="${C.body}" stroke-width="4"/>`;
const integralBody = (x0) => `<path d="M${x0 + 18} 36 H700 C752 36 780 70 784 120 V240 C780 290 752 324 700 324 H${x0 + 18} A18 18 0 0 1 ${x0} 306 V54 A18 18 0 0 1 ${x0 + 18} 36 Z" fill="#fff" stroke="${C.body}" stroke-width="4"/>`;

// ---- Building blocks: each returns { svg: [...], spots: [[id, x, y, name?]] } ----

// Silhouettes (body, cab, outside zones)
const SHELLS = {
  van: () => ({ svg: [wheels([150, 590], 34, 308), vanBody(110), windshield(752), seats(650)], spots: [['cab', 712, 180], ['ext', 588, 340], ['extb', 440, 20], ['arr', 70, 180]] }),
  fourgon: () => ({ svg: [wheels([110, 590], 34, 308), vanBody(70), windshield(752), seats(650)], spots: [['cab', 712, 180], ['ext', 593, 340], ['extb', 495, 20], ['arr', 36, 180]] }),
  cell: () => ({ svg: [wheels([170, 640], 18, 322), cellBody(70, 640), windshield(752), seats(665)], spots: [['cab', 718, 180], ['ext', 526, 344], ['extb', 400, 16], ['arr', 36, 180]] }),
  integral: () => ({
    svg: [
      wheels([170, 640], 18, 322),
      integralBody(70),
      `<path d="M742 70 C774 110 774 250 742 290" fill="none" stroke="${C.glass}" stroke-width="12" stroke-linecap="round"/>`,
      seats(668),
      `<line x1="676" y1="36" x2="736" y2="36" stroke="${C.line}" stroke-width="4" stroke-dasharray="10 6"/>`,
      dashed(560, 44, 200, 272),
      label(660, 172, 'lit de pavillon'),
    ],
    spots: [['cab', 722, 200], ['pav', 636, 118], ['ext', 526, 344], ['extb', 420, 16], ['arr', 36, 180]],
  }),
  capucine: () => ({
    svg: [
      wheels([170, 640], 18, 322),
      cellBody(70, 640),
      windshield(752),
      seats(665),
      `<rect x="590" y="50" width="200" height="260" rx="40" fill="${C.line}" fill-opacity=".07" stroke="${C.line}" stroke-width="2.5" stroke-dasharray="8 6"/>`,
      label(690, 300, 'capucine'),
    ],
    spots: [['cab', 718, 200], ['cap', 660, 108], ['ext', 526, 344], ['extb', 400, 16], ['arr', 36, 180]],
  }),
};

// Rear of a coachbuilt (x 84 → 254)
const REAR = {
  bedTrans: (garage) => ({
    svg: [rect(84, 52, 170, 256, C.bed), pillow(96, 62, 68, 34), pillow(174, 62, 68, 34), garage ? label(169, 300, 'garage dessous') : ''],
    spots: [['lit', 169, 140, 'Lit transversal arrière'], ...(garage ? [['gar', 169, 236]] : [])],
  }),
  bedCentral: () => ({
    svg: [wardrobe(84, 52, 64, 40), wardrobe(84, 268, 64, 40), rect(100, 98, 154, 164, C.bed), pillow(110, 108, 34, 64), pillow(110, 188, 34, 64), label(190, 300, 'garage dessous')],
    spots: [['lit', 196, 140, 'Lit central'], ['gar', 196, 224]],
  }),
  bedTwins: () => ({
    svg: [rect(84, 52, 170, 84, C.bed), pillow(94, 62, 38, 64), rect(84, 224, 170, 84, C.bed), pillow(94, 234, 38, 64), label(169, 186, 'garage dessous')],
    spots: [['lit', 190, 94, 'Lits jumeaux'], ['gar', 169, 162]],
  }),
  bunks: () => ({
    svg: [rect(84, 52, 150, 110, C.bed), `<rect x="92" y="60" width="134" height="94" rx="8" fill="none" stroke="${C.line}" stroke-width="2" stroke-dasharray="6 5"/>`, pillow(96, 70, 34, 74), wardrobe(84, 250, 90, 58), rect(84, 176, 150, 60, C.fur), label(159, 172, 'superposés')],
    spots: [['lit', 170, 107, 'Lits superposés'], ['sal', 140, 212, 'Banquette arrière'], ['tech', 210, 276]],
  }),
  salonU: () => ({
    svg: [`<path d="M84 52 H230 V112 H140 V248 H230 V308 H84 Z" fill="${C.fur}" stroke="${C.line}" stroke-width="2"/>`, rect(150, 124, 70, 112, '#fff', C.soft)],
    spots: [['sal', 112, 180], ['tech', 186, 86]],
  }),
  kitchenL: () => ({
    svg: [`<path d="M84 52 H150 V250 H254 V308 H84 Z" fill="${C.kit}" stroke="${C.kitLine}" stroke-width="2"/>`, `<rect x="96" y="64" width="40" height="30" rx="6" fill="#fff" stroke="${C.kitLine}" stroke-width="2"/>`, `<circle cx="116" cy="140" r="10" fill="none" stroke="${C.kitLine}" stroke-width="2"/><circle cx="116" cy="176" r="10" fill="none" stroke="${C.kitLine}" stroke-width="2"/>`, label(200, 236, 'cuisine arrière')],
    spots: [['cui', 117, 220], ['tech', 210, 100]],
  }),
  sdbRear: () => ({
    svg: [rect(84, 52, 124, 256, C.wet), pillow(94, 62, 70, 74), `<ellipse cx="180" cy="250" rx="18" ry="24" fill="#fff" stroke="${C.soft}" stroke-width="2"/>`, wardrobe(208, 52, 46, 120), label(146, 186, "salle d'eau")],
    spots: [['sdb', 140, 200, "Salle d'eau arrière"], ['pend', 231, 112, 'Penderie arrière'], ['tech', 228, 262]],
  }),
};

// Middle of a coachbuilt (x 270 → 470)
const MIDDLE = {
  std: () => ({ svg: [sdb(270, 50, 130, 100), dashed(355, 172, 70, 52), kitchen(270, 264, 200)], spots: [['cui', 365, 288], ['sdb', 335, 100], ['toit', 390, 198]] }),
  kitchenOnly: () => ({ svg: [wardrobe(270, 50, 70, 100), rect(350, 50, 100, 70, C.fur), dashed(360, 172, 70, 52), kitchen(270, 264, 200)], spots: [['cui', 365, 288], ['toit', 395, 198]] }),
  sdbOnly: () => ({ svg: [sdb(270, 50, 130, 100), dashed(355, 172, 70, 52), wardrobe(270, 262, 80, 50), rect(360, 262, 100, 50, C.fur)], spots: [['sdb', 335, 100], ['toit', 390, 198]] }),
};

// Front of a coachbuilt (dinette, door, optional lit de pavillon)
const FRONT = (pav) => ({
  svg: [dinette(470, 50), door(490, 324, 72), pav ? dashed(460, 44, 190, 272) : '', pav ? label(560, 172, 'lit de pavillon') : ''],
  spots: [['din', 552, 98], ['ent', 526, 292], ['tech', 474, 190], ...(pav ? [['pav', 600, 212]] : [])],
});

// Van and fourgon interiors (all in one)
const VAN_INSIDE = {
  vanTrans: () => ({
    svg: [rect(122, 58, 150, 244, C.bed), pillow(132, 70, 44, 100), pillow(132, 190, 44, 100), sdb(290, 58, 130, 92), dashed(345, 170, 80, 56), kitchen(330, 252, 190), dinette(440, 58), door(550, 314, 78)],
    spots: [['din', 540, 100], ['cui', 430, 284], ['sdb', 340, 104], ['toit', 385, 198], ['ent', 588, 288], ['lit', 200, 180, 'Lit transversal arrière'], ['tech', 470, 172]],
  }),
  vanToit: () => ({
    svg: [rect(122, 58, 84, 244, C.fur), kitchen(230, 58, 260), rect(320, 196, 90, 60, '#fff', C.soft), `<rect x="214" y="70" width="410" height="220" rx="16" fill="none" stroke="${C.line}" stroke-width="2.5" stroke-dasharray="8 6"/>`, label(420, 186, 'toit relevable'), door(550, 314, 78)],
    spots: [['din', 365, 226, 'Table'], ['cui', 360, 82], ['toit', 480, 150, 'Toit relevable et couchage'], ['ent', 588, 288], ['lit', 164, 180, 'Banquette-lit arrière'], ['tech', 164, 88]],
  }),
  fgTrans: () => ({
    svg: [rect(82, 58, 180, 244, C.bed), pillow(92, 70, 44, 100), pillow(92, 190, 44, 100), sdb(280, 58, 140, 92), dashed(300, 176, 90, 60), kitchen(330, 252, 200), dinette(450, 58), door(556, 314, 74)],
    spots: [['din', 552, 100], ['cui', 440, 284], ['sdb', 335, 104], ['toit', 345, 206], ['ent', 593, 288], ['lit', 172, 180], ['tech', 476, 172]],
  }),
  fgTwins: () => ({
    svg: [rect(82, 58, 190, 80, C.bed), pillow(92, 66, 36, 64), rect(82, 222, 190, 80, C.bed), pillow(92, 230, 36, 64), label(177, 186, 'soute dessous'), sdb(290, 58, 140, 92), dashed(310, 176, 80, 56), kitchen(340, 252, 190), dinette(450, 58), door(556, 314, 74)],
    spots: [['din', 552, 100], ['cui', 445, 284], ['sdb', 345, 104], ['toit', 350, 204], ['ent', 593, 288], ['lit', 190, 98, 'Lits jumeaux et soute'], ['tech', 476, 172]],
  }),
};

const NAMES = {
  cab: 'Cabine',
  din: 'Salon et dinette',
  cui: 'Cuisine',
  sdb: "Salle d'eau",
  toit: 'Toit et aération',
  ent: 'Entrée',
  lit: 'Lit arrière et soute',
  gar: 'Garage arrière',
  sal: 'Salon arrière',
  pav: 'Lit de pavillon',
  cap: 'Capucine (au-dessus de la cabine)',
  pend: 'Penderie',
  tech: 'Sous la banquette (technique)',
  ext: 'Extérieur, côté porte',
  extb: 'Extérieur, côté opposé',
  arr: 'Arrière du véhicule (extérieur)',
};
// Numbering order on the plan.
const ORDER = ['cab', 'cap', 'pav', 'din', 'cui', 'sdb', 'toit', 'ent', 'lit', 'sal', 'pend', 'gar', 'tech', 'ext', 'extb', 'arr'];

const cell = (shell, rear, middle, pav) => [SHELLS[shell](), REAR[rear[0]](...(rear.slice(1))), MIDDLE[middle](), FRONT(pav)];

// features: what the layout has (used to find it from a few words, see server/layouts.js).
// spotDefaults: where equipment goes on this layout when it differs from the catalogue.
const LAYOUTS = [
  { id: 'van_trans', type: 'van', name: 'Lit transversal arrière', desc: 'Lit en travers à l’arrière, salle d’eau, cuisine face à la porte, dinette avec sièges pivotants.', features: ['lit_trans', 'sdb', 'cuisine', 'dinette'], parts: () => [SHELLS.van(), VAN_INSIDE.vanTrans()] },
  { id: 'van_toit', type: 'van', name: 'Toit relevable et banquette-lit', desc: 'Banquette arrière transformable en lit, cuisine latérale, couchage dans le toit relevable, sans salle d’eau.', features: ['toit_rel', 'banquette_lit', 'cuisine', 'dinette', 'sans_sdb'], parts: () => [SHELLS.van(), VAN_INSIDE.vanToit()] },
  { id: 'fg_trans', type: 'fourgon', name: 'Lit transversal arrière', desc: 'Grand lit en travers au-dessus de la soute, salle d’eau, cuisine, dinette (fourgon 5,99 à 6,36 m).', features: ['lit_trans', 'soute', 'sdb', 'cuisine', 'dinette'], parts: () => [SHELLS.fourgon(), VAN_INSIDE.fgTrans()] },
  { id: 'fg_jumeaux', type: 'fourgon', name: 'Lits jumeaux arrière', desc: 'Deux lits le long des parois, soute dessous, salle d’eau, cuisine, dinette (fourgon 6,36 m).', features: ['lits_jum', 'soute', 'sdb', 'cuisine', 'dinette'], parts: () => [SHELLS.fourgon(), VAN_INSIDE.fgTwins()] },
  { id: 'cp_salon_ar', type: 'compact', name: 'Salon arrière et lit de pavillon', desc: 'Salon en U à l’arrière, salle d’eau et cuisine au milieu, lit de pavillon à l’avant.', features: ['salon_ar', 'pavillon', 'sdb', 'cuisine', 'dinette'], parts: () => cell('cell', ['salonU'], 'std', true) },
  { id: 'cp_cuisine_ar', type: 'compact', name: 'Cuisine arrière et lit de pavillon', desc: 'Cuisine en L à l’arrière, salle d’eau au milieu, salon face-à-face et lit de pavillon à l’avant.', features: ['cuisine_ar', 'cuisine', 'pavillon', 'sdb', 'dinette', 'face'], parts: () => cell('cell', ['kitchenL'], 'sdbOnly', true) },
  { id: 'cp_sdb_ar', type: 'compact', name: 'Salle d’eau et penderie arrière, lit de pavillon', desc: 'Salle d’eau toute largeur et penderie à l’arrière, cuisine au milieu, salon et lit de pavillon à l’avant.', features: ['sdb_ar', 'sdb', 'penderie_ar', 'penderie', 'pavillon', 'cuisine', 'dinette', 'face'], spotDefaults: { penderie: 'pend' }, parts: () => cell('cell', ['sdbRear'], 'kitchenOnly', true) },
  { id: 'pr_central', type: 'profile', name: 'Lit central et garage', desc: 'Lit central accessible des deux côtés au-dessus du garage, salle d’eau, cuisine, salon (lit de pavillon possible).', features: ['lit_central', 'garage', 'penderie', 'sdb', 'cuisine', 'dinette', 'pavillon?'], spotDefaults: { penderie: 'lit' }, parts: () => cell('cell', ['bedCentral'], 'std', true) },
  { id: 'pr_jumeaux', type: 'profile', name: 'Lits jumeaux et garage', desc: 'Deux lits le long des parois au-dessus du garage, salle d’eau, cuisine, salon (lit de pavillon possible).', features: ['lits_jum', 'garage', 'sdb', 'cuisine', 'dinette', 'pavillon?'], parts: () => cell('cell', ['bedTwins'], 'std', true) },
  { id: 'pr_trans', type: 'profile', name: 'Lit transversal et garage', desc: 'Lit en travers au-dessus du garage, salle d’eau, cuisine, salon (lit de pavillon possible).', features: ['lit_trans', 'garage', 'sdb', 'cuisine', 'dinette', 'pavillon?'], parts: () => cell('cell', ['bedTrans', true], 'std', true) },
  { id: 'in_central', type: 'integral', name: 'Lit central et garage', desc: 'Lit central au-dessus du garage, salle d’eau, cuisine, salon et lit de pavillon au-dessus de la cabine.', features: ['lit_central', 'garage', 'penderie', 'sdb', 'cuisine', 'dinette', 'pavillon'], spotDefaults: { penderie: 'lit' }, parts: () => [SHELLS.integral(), REAR.bedCentral(), MIDDLE.std(), FRONT(false)] },
  { id: 'in_jumeaux', type: 'integral', name: 'Lits jumeaux et garage', desc: 'Lits jumeaux au-dessus du garage, salle d’eau, cuisine, salon et lit de pavillon au-dessus de la cabine.', features: ['lits_jum', 'garage', 'sdb', 'cuisine', 'dinette', 'pavillon'], parts: () => [SHELLS.integral(), REAR.bedTwins(), MIDDLE.std(), FRONT(false)] },
  { id: 'in_trans', type: 'integral', name: 'Lit transversal et garage', desc: 'Lit en travers au-dessus du garage, salle d’eau, cuisine, salon et lit de pavillon au-dessus de la cabine.', features: ['lit_trans', 'garage', 'sdb', 'cuisine', 'dinette', 'pavillon'], parts: () => [SHELLS.integral(), REAR.bedTrans(true), MIDDLE.std(), FRONT(false)] },
  { id: 'ca_superp', type: 'capucine', name: 'Lits superposés et capucine', desc: 'Lits superposés et banquette à l’arrière, salle d’eau, cuisine, dinette et grand lit de capucine : idéal en famille.', features: ['superp', 'capucine', 'sdb', 'cuisine', 'dinette', 'face', 'famille'], parts: () => cell('capucine', ['bunks'], 'std', false) },
  { id: 'ca_trans', type: 'capucine', name: 'Lit transversal, garage et capucine', desc: 'Lit en travers au-dessus du garage, salle d’eau, cuisine, dinette et lit de capucine.', features: ['lit_trans', 'garage', 'capucine', 'sdb', 'cuisine', 'dinette'], parts: () => cell('capucine', ['bedTrans', true], 'std', false) },
];
const DEFAULT_LAYOUT = { van: 'van_trans', fourgon: 'fg_trans', compact: 'cp_salon_ar', profile: 'pr_central', integral: 'in_central', capucine: 'ca_trans' };

const outDir = path.join(__dirname, '..', 'public', 'app', 'plans');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const out = { types: DEFAULT_LAYOUT, layouts: {} };
for (const L of LAYOUTS) {
  const parts = L.parts();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 360" width="800" height="360" font-family="Helvetica, Arial, sans-serif">
  <!-- Plan schématique « ${L.name} » (${L.type}) vu du dessus, cabine à droite, porte d'entrée en bas. Généré par tools/make-plans.js. -->
  <rect width="800" height="360" fill="${C.bg}"/>
  ${parts.flatMap((p) => p.svg).filter(Boolean).join('\n  ')}
</svg>
`;
  fs.writeFileSync(path.join(outDir, `${L.id}.svg`), svg);
  if (DEFAULT_LAYOUT[L.type] === L.id) fs.writeFileSync(path.join(outDir, `${L.type}.svg`), svg);
  const seen = new Map();
  for (const [id, x, y, name] of parts.flatMap((p) => p.spots)) if (!seen.has(id)) seen.set(id, { id, x, y, name: name || NAMES[id] });
  const spots = [...seen.values()].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)).map((s, i) => ({ ...s, n: i + 1 }));
  out.layouts[L.id] = { type: L.type, name: L.name, desc: L.desc, features: L.features, spotDefaults: L.spotDefaults || {}, spots };
}
fs.writeFileSync(path.join(__dirname, '..', 'server', 'seed', 'plans.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`${LAYOUTS.length} implantations :`, LAYOUTS.map((l) => l.id).join(', '));
