#!/usr/bin/env node
'use strict';

// Draws the top-view plan of each vehicle type (800 × 360, cab on the right, entrance door at the bottom)
// and writes the numbered zones that go with it. One definition for both, so dots always sit on the drawing.
//   node tools/make-plans.js  →  public/app/plans/<type>.svg + server/seed/plans.json

const fs = require('node:fs');
const path = require('node:path');

const C = { bg: '#f3f7f6', body: '#0c2b33', fur: '#dff1ef', bed: '#e9f3f2', line: '#0a7c82', soft: '#9bbcc0', kit: '#fdf3e3', kitLine: '#b7791f', wet: '#eef4fb', glass: '#7fb6bd', wheel: '#3d5a60' };

const rect = (x, y, w, h, fill, stroke = C.line, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2" ${extra}/>`;
const dashed = (x, y, w, h, stroke = C.line) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-dasharray="8 6"/>`;
const label = (x, y, text) => `<text x="${x}" y="${y}" font-size="13" fill="#5f7d82" text-anchor="middle">${text}</text>`;
const wheels = (xs, top, bottom) => `<g fill="${C.wheel}">${xs.map((x) => `<rect x="${x}" y="${top}" width="70" height="18" rx="6"/><rect x="${x}" y="${bottom}" width="70" height="18" rx="6"/>`).join('')}</g>`;
const seats = (x) => `<g fill="${C.fur}" stroke="${C.line}" stroke-width="2"><rect x="${x}" y="98" width="58" height="62" rx="14"/><rect x="${x}" y="200" width="58" height="62" rx="14"/></g>`;
const windshield = (x) => `<path d="M${x} 104 C${x + 16} 140 ${x + 16} 220 ${x} 256" fill="none" stroke="${C.glass}" stroke-width="10" stroke-linecap="round"/>`;
const sdb = (x, y, w, h) => `${rect(x, y, w, h, C.wet)}<rect x="${x + 10}" y="${y + 10}" width="${Math.round(w * 0.42)}" height="${h - 20}" rx="6" fill="#fff" stroke="${C.soft}" stroke-width="2"/><ellipse cx="${x + w - 26}" cy="${y + h / 2}" rx="16" ry="21" fill="#fff" stroke="${C.soft}" stroke-width="2"/>`;
const kitchen = (x, y, w) => `${rect(x, y, w, 48, C.kit, C.kitLine)}<rect x="${x + 14}" y="${y + 9}" width="40" height="30" rx="6" fill="#fff" stroke="${C.kitLine}" stroke-width="2"/><circle cx="${x + w - 62}" cy="${y + 24}" r="10" fill="none" stroke="${C.kitLine}" stroke-width="2"/><circle cx="${x + w - 30}" cy="${y + 24}" r="10" fill="none" stroke="${C.kitLine}" stroke-width="2"/>`;
const dinette = (x, y) => `${rect(x, y, 62, 92, C.fur)}${rect(x + 74, y + 12, 76, 60, '#fff', C.soft)}`;
const door = (x, y, w = 70) => `<rect x="${x}" y="${y - 8}" width="${w}" height="16" fill="${C.bg}"/><line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${C.line}" stroke-width="4" stroke-dasharray="10 6"/>`;
const bedSplit = (x, y, w, h) => `${rect(x, y, w, h, C.bed)}<rect x="${x + 10}" y="${y + 12}" width="40" height="${Math.round(h / 2) - 22}" rx="10" fill="#fff" stroke="${C.soft}" stroke-width="2"/><rect x="${x + 10}" y="${y + Math.round(h / 2) + 10}" width="40" height="${Math.round(h / 2) - 22}" rx="10" fill="#fff" stroke="${C.soft}" stroke-width="2"/>`;

// Van-shaped body (fourgon, van): one width from back to front.
const vanBody = (x0) => `<path d="M${x0 + 14} 46 H690 C735 46 772 62 782 110 V250 C772 298 735 314 690 314 H${x0 + 14} A14 14 0 0 1 ${x0} 300 V60 A14 14 0 0 1 ${x0 + 14} 46 Z" fill="#fff" stroke="${C.body}" stroke-width="4"/>`;
// Coachbuilt: wide cell + narrower cab.
const cellBody = (x0, x1) => `<path d="M${x1} 80 H700 C742 80 772 96 782 130 V230 C772 264 742 280 700 280 H${x1}" fill="#fff" stroke="${C.body}" stroke-width="4"/><rect x="${x0}" y="36" width="${x1 - x0}" height="288" rx="18" fill="#fff" stroke="${C.body}" stroke-width="4"/>`;
const integralBody = (x0) => `<path d="M${x0 + 18} 36 H700 C752 36 780 70 784 120 V240 C780 290 752 324 700 324 H${x0 + 18} A18 18 0 0 1 ${x0} 306 V54 A18 18 0 0 1 ${x0 + 18} 36 Z" fill="#fff" stroke="${C.body}" stroke-width="4"/>`;

const NAMES = {
  cab: 'Cabine',
  din: 'Salon et dinette',
  cui: 'Cuisine',
  sdb: "Salle d'eau",
  toit: 'Toit et aération',
  ent: 'Entrée',
  lit: 'Lit arrière et soute',
  chambre: 'Chambre arrière',
  gar: 'Garage arrière',
  sal: 'Salon arrière',
  pav: 'Lit de pavillon',
  cap: 'Capucine (au-dessus de la cabine)',
  tech: 'Sous la banquette (technique)',
  ext: 'Extérieur, côté porte',
  extb: 'Extérieur, côté opposé',
  arr: 'Arrière du véhicule (extérieur)',
};
// [id, x, y, name?] in reading order: the number shown on the plan follows this order.
const PLANS = {
  van: {
    name: 'Van',
    draw: () => [
      wheels([150, 590], 34, 308),
      vanBody(110),
      windshield(752),
      seats(650),
      bedSplit(122, 58, 150, 244),
      sdb(290, 58, 130, 92),
      dashed(345, 170, 80, 56),
      kitchen(330, 252, 190),
      dinette(440, 58),
      door(550, 314, 78),
    ],
    spots: [['cab', 712, 180], ['din', 540, 100], ['cui', 430, 284], ['sdb', 340, 104], ['toit', 385, 198], ['ent', 588, 288], ['lit', 200, 180], ['tech', 470, 172], ['ext', 588, 340], ['extb', 440, 20], ['arr', 70, 180]],
  },
  fourgon: {
    name: 'Fourgon aménagé',
    draw: () => [
      wheels([110, 590], 34, 308),
      vanBody(70),
      windshield(752),
      seats(650),
      bedSplit(82, 58, 180, 244),
      sdb(280, 58, 140, 92),
      dashed(300, 176, 90, 60),
      kitchen(330, 252, 200),
      dinette(450, 58),
      door(556, 314, 74),
    ],
    spots: [['cab', 712, 180], ['din', 552, 100], ['cui', 440, 284], ['sdb', 335, 104], ['toit', 345, 206], ['ent', 593, 288], ['lit', 172, 180], ['tech', 476, 172], ['ext', 593, 340], ['extb', 495, 20], ['arr', 36, 180]],
  },
  compact: {
    name: 'Profilé compact',
    draw: () => [
      wheels([150, 640], 18, 322),
      cellBody(70, 630),
      windshield(752),
      seats(660),
      // Rear U lounge (no fixed rear bed)
      `<path d="M84 52 H230 V112 H140 V248 H230 V308 H84 Z" fill="${C.fur}" stroke="${C.line}" stroke-width="2"/>`,
      rect(150, 124, 70, 112, '#fff', C.soft),
      sdb(250, 50, 130, 100),
      dashed(355, 172, 70, 52),
      kitchen(250, 264, 200),
      dinette(450, 50),
      dashed(440, 44, 200, 272),
      door(470, 324, 72),
      label(540, 172, 'lit de pavillon'),
    ],
    spots: [['cab', 715, 180], ['pav', 590, 212], ['din', 532, 98], ['cui', 345, 288], ['sdb', 315, 100], ['toit', 390, 198], ['ent', 506, 292], ['sal', 112, 180], ['tech', 186, 88], ['ext', 506, 344], ['extb', 400, 16], ['arr', 36, 180]],
  },
  profile: {
    name: 'Profilé',
    draw: () => [
      wheels([170, 640], 18, 322),
      cellBody(70, 640),
      windshield(752),
      seats(665),
      rect(84, 52, 170, 256, C.bed),
      rect(110, 88, 118, 184, '#fff', C.soft),
      label(169, 300, 'garage dessous'),
      sdb(270, 50, 130, 100),
      dashed(355, 172, 70, 52),
      kitchen(270, 264, 200),
      dinette(470, 50),
      dashed(460, 44, 190, 272),
      door(490, 324, 72),
      label(560, 172, 'lit de pavillon'),
    ],
    spots: [['cab', 718, 180], ['pav', 600, 212], ['din', 552, 98], ['cui', 365, 288], ['sdb', 335, 100], ['toit', 390, 198], ['ent', 526, 292], ['chambre', 169, 128, NAMES.chambre], ['gar', 169, 236], ['tech', 474, 190], ['ext', 526, 344], ['extb', 400, 16], ['arr', 36, 180]],
  },
  integral: {
    name: 'Intégral',
    draw: () => [
      wheels([170, 640], 18, 322),
      integralBody(70),
      `<path d="M742 70 C774 110 774 250 742 290" fill="none" stroke="${C.glass}" stroke-width="12" stroke-linecap="round"/>`,
      seats(668),
      rect(84, 52, 170, 256, C.bed),
      rect(110, 88, 118, 184, '#fff', C.soft),
      label(169, 300, 'garage dessous'),
      sdb(270, 50, 130, 100),
      dashed(355, 172, 70, 52),
      kitchen(270, 264, 200),
      dinette(470, 50),
      dashed(560, 44, 200, 272),
      door(490, 324, 72),
      `<line x1="676" y1="36" x2="736" y2="36" stroke="${C.line}" stroke-width="4" stroke-dasharray="10 6"/>`,
      label(660, 172, 'lit de pavillon'),
    ],
    spots: [['cab', 722, 200], ['pav', 636, 118], ['din', 540, 98], ['cui', 365, 288], ['sdb', 335, 100], ['toit', 390, 198], ['ent', 526, 292], ['chambre', 169, 128, NAMES.chambre], ['gar', 169, 236], ['tech', 474, 190], ['ext', 526, 344], ['extb', 420, 16], ['arr', 36, 180]],
  },
  capucine: {
    name: 'Capucine',
    draw: () => [
      wheels([170, 640], 18, 322),
      cellBody(70, 640),
      windshield(752),
      seats(665),
      bedSplit(84, 52, 170, 256),
      label(169, 182, 'lit ou superposés'),
      sdb(270, 50, 130, 100),
      dashed(355, 172, 70, 52),
      kitchen(270, 264, 200),
      dinette(470, 50),
      `<rect x="590" y="50" width="200" height="260" rx="40" fill="${C.line}" fill-opacity=".07" stroke="${C.line}" stroke-width="2.5" stroke-dasharray="8 6"/>`,
      door(490, 324, 72),
      label(690, 300, 'capucine'),
    ],
    spots: [['cab', 718, 200], ['cap', 660, 108], ['din', 545, 98], ['cui', 365, 288], ['sdb', 335, 100], ['toit', 390, 198], ['ent', 526, 292], ['lit', 169, 128, 'Chambre arrière'], ['gar', 169, 236], ['tech', 474, 190], ['ext', 526, 344], ['extb', 400, 16], ['arr', 36, 180]],
  },
};

const outDir = path.join(__dirname, '..', 'public', 'app', 'plans');
fs.mkdirSync(outDir, { recursive: true });
const spots = {};
for (const [type, plan] of Object.entries(PLANS)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 360" width="800" height="360" font-family="Helvetica, Arial, sans-serif">
  <!-- Plan schématique « ${plan.name} » vu du dessus, cabine à droite, porte d'entrée en bas. Généré par tools/make-plans.js. -->
  <rect width="800" height="360" fill="${C.bg}"/>
  ${plan.draw().join('\n  ')}
</svg>
`;
  fs.writeFileSync(path.join(outDir, `${type}.svg`), svg);
  // "chambre" is drawn as its own zone name but keeps the "lit" id, so equipment placed at "lit" lands there.
  spots[type] = plan.spots.map(([id, x, y, name], i) => ({ id: id === 'chambre' ? 'lit' : id, n: i + 1, x, y, name: name || NAMES[id] }));
}
fs.writeFileSync(path.join(__dirname, '..', 'server', 'seed', 'plans.json'), JSON.stringify(spots, null, 1) + '\n');
console.log('Plans :', Object.keys(PLANS).join(', '));
