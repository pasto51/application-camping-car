'use strict';

// Finds the layout ("implantation") of a vehicle from a few words typed in the relevé,
// e.g. « penderie arrière, lit pavillon, cuisine et table », and the equipment those words name.
// No AI service: a list of phrases and synonyms, scored against each layout's features.

const { layoutList } = require('./vehicle-types');

// weight: how much the word tells the layouts apart (4 = it decides, 1 = every layout has it).
const FEATURES = [
  { id: 'toit_rel', label: 'toit relevable', weight: 4, re: /toit (relevable|releve|levant|ouvrant)|pop ?top/, eq: ['toit_rel', 'lit_toit'] },
  { id: 'superp', label: 'lits superposés', weight: 4, re: /superpose/, eq: ['superp'] },
  { id: 'capucine', label: 'capucine', weight: 4, re: /capucine/, eq: ['lit_cap'] },
  { id: 'lits_jum', label: 'lits jumeaux', weight: 4, re: /jumeaux|lits? separes|(deux|2) lits( simples)?/, eq: ['lits_jum'] },
  { id: 'lit_central', label: 'lit central', weight: 4, re: /lit (central|centrale|a la francaise|ile|queen)|queen ?size|lit centre/, eq: ['lit_central'] },
  { id: 'lit_trans', label: 'lit transversal', weight: 4, re: /transversal|lit (arriere )?en travers|lit travers/, eq: ['lit_ar'] },
  { id: 'salon_ar', label: 'salon arrière', weight: 4, re: /salon (arriere|en u|panoramique)|salon u\b|banquette en u/, eq: ['salon_ar'] },
  { id: 'cuisine_ar', label: 'cuisine arrière', weight: 4, re: /cuisine (en l )?(a l )?arriere|arriere cuisine/, eq: ['rechaud', 'evier', 'frigo'] },
  { id: 'sdb_ar', label: 'salle d’eau arrière', weight: 4, re: /(salle d eau|salle de bains?|sdb|douche|toilettes?|wc|cabinet de toilette)( \w+){0,2} (a l )?arriere/, eq: ['douche', 'wc'] },
  { id: 'penderie_ar', label: 'penderie arrière', weight: 4, re: /(penderie|armoire|dressing)( \w+){0,2} (a l )?arriere|arriere (avec )?(une )?(penderie|armoire|dressing)/, eq: ['penderie'] },
  { id: 'banquette_lit', label: 'banquette-lit', weight: 3, re: /banquette (lit|convertible|arriere)|banquettelit/, eq: ['banq'] },
  { id: 'pavillon', label: 'lit de pavillon', weight: 3, re: /pavillon|basculant|lit (de |au )?plafond|lit electrique avant|lit escamotable/, eq: ['pavillon'] },
  { id: 'garage', label: 'garage', weight: 2, re: /garage|soute/, eq: ['garage'] },
  { id: 'face', label: 'salon face-à-face', weight: 2, re: /face a face|en face|vis a vis/, eq: ['salon_l'] },
  { id: 'famille', label: 'famille', weight: 1, re: /famil|enfant/, eq: [] },
  { id: 'penderie', label: 'penderie', weight: 1, re: /penderie|armoire|dressing/, eq: ['penderie'] },
  { id: 'sdb', label: 'salle d’eau', weight: 1, re: /salle d eau|salle de bains?|sdb|douche|toilette|wc/, eq: ['douche', 'wc'] },
  { id: 'cuisine', label: 'cuisine', weight: 1, re: /cuisine|kitchenette|plaque|evier|frigo|refrigerateur/, eq: ['rechaud', 'evier', 'frigo'] },
  { id: 'dinette', label: 'table', weight: 1, re: /table|dinette|salon/, eq: ['table'] },
  { id: 'lit_ar', label: 'lit arrière', weight: 1, re: /lit (fixe )?arriere|chambre arriere/, eq: [] },
];
// The detailed feature already says it: no need to count the general one too.
const COVERS = { cuisine_ar: ['cuisine'], sdb_ar: ['sdb'], penderie_ar: ['penderie'], salon_ar: ['dinette'], superp: ['famille'] };
const REAR_BEDS = ['lit_trans', 'lit_central', 'lits_jum', 'superp', 'banquette_lit'];
// A garage on a coachbuilt is a « soute » in a fourgon.
const SAME = { garage: ['garage', 'soute'] };

const TYPE_WORDS = [
  ['profile', /semi integral/],
  ['compact', /profile compact|compact/],
  ['integral', /integral/],
  ['capucine', /capucine/],
  ['profile', /profile|semi integral/],
  ['fourgon', /fourgon/],
  ['van', /\bvan\b/],
];

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// « penderie arrière, lit pavillon, sans salle d'eau » → wanted and refused features.
function understand(text) {
  const wanted = new Set();
  const refused = new Set();
  const parts = String(text || '')
    .split(/[,;\n+/]| et | avec | puis /i)
    .map(norm)
    .filter(Boolean);
  for (const part of parts) {
    const negative = /^(sans|pas de|pas d|aucun|aucune|ni)\b/.test(part);
    for (const f of FEATURES) if (f.re.test(part)) (negative ? refused : wanted).add(f.id);
  }
  for (const [big, small] of Object.entries(COVERS)) if (wanted.has(big)) small.forEach((x) => wanted.delete(x));
  if (REAR_BEDS.some((b) => wanted.has(b))) wanted.delete('lit_ar');
  let type = null;
  const all = norm(text);
  for (const [t, re] of TYPE_WORDS) if (re.test(all)) {
    type = t;
    break;
  }
  return { wanted: [...wanted], refused: [...refused], type };
}

function has(layout, id) {
  const ids = SAME[id] || [id];
  if (ids.some((x) => layout.features.includes(x))) return 'yes';
  if (ids.some((x) => layout.features.includes(`${x}?`))) return 'maybe';
  if (id === 'lit_ar' && REAR_BEDS.some((b) => layout.features.includes(b))) return 'yes';
  return null;
}

// Best layouts for these words, most likely first.
function matchLayouts(text, type) {
  const u = understand(text);
  const byId = Object.fromEntries(FEATURES.map((f) => [f.id, f]));
  const useType = type || u.type;
  const results = layoutList()
    .filter((L) => !useType || L.type === useType)
    .map((L) => {
      let score = 0;
      const matched = [];
      const missing = [];
      for (const id of u.wanted) {
        const f = byId[id];
        const h = has(L, id);
        if (h === 'yes') score += f.weight;
        else if (h === 'maybe') score += f.weight - 0.5;
        else score -= f.weight >= 3 ? 3 : f.weight >= 2 ? 1 : 0.5;
        (h ? matched : missing).push(f.label);
      }
      for (const id of u.refused) {
        if (has(L, id) === 'yes' || (id === 'sdb' && !L.features.includes('sans_sdb') && L.features.includes('sdb'))) {
          score -= 4;
          missing.push(`sans ${byId[id].label}`);
        }
      }
      return { ...L, score, matched, missing };
    })
    .sort((a, b) => b.score - a.score);
  const equipment = [...new Set(u.wanted.flatMap((id) => byId[id].eq))];
  return { understood: u.wanted.map((id) => byId[id].label), refused: u.refused.map((id) => byId[id].label), type: useType || null, results, equipment };
}

module.exports = { matchLayouts, understand, FEATURES };
