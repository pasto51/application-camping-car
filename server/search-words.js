'use strict';

// Words customers really type that did not lead to the right diagnostic (search audit of October 2026: 552
// customer-like queries played in the app). Added once to the keywords (« 2026-11-04-mots-recherche »), never
// removing anything: a keyword changed meanwhile in the back-office stays.
const WORDS = {
  nowater: 'coule rien ne coule plus d’eau pas d’eau',
  greydrain: 'descend plus douche évacue lavabo évier bouché',
  p_bruits: 'bruit bruits vibration vibrations',
  burn: 'cramé odeur de brûlé ça sent le brûlé',
  bedlift: 'lit de toit lit descend pas',
  c_tank_niveau: 'indicateur',
  h_air: 'coussin d’air coussins',
  p_eau: 'plus d’eau vite vide vite',
  p_eclairage_ext: 'lumière dehors extérieur',
  p_lumiere: 'lumière pas assez éclaire peu',
  p_chaleur: '35 40 degrés dedans clim',
  p_manoeuvre: 'dur galère manœuvrer',
  p_niveau: 'penche penché',
  p_tele: 'installer tv ajouter',
  p_marche: 'marchepied amovible marche amovible',
  p_appareils: '220 sans borne',
  p_wcseches: 'wc sec sèche',
  p_station: 'ecoflow bluetti jackery',
  p_cassetterentre: 'coincée coince',
  h_eau: 'fuite toit rentre pluie',
  h_tv: 'pas d’image image',
  h_sat: 'pas d’image image sat',
  p_chaines: 'pas d’image image',
  p_adblue: 'voyant',
  p_convertisseur: 'bip bipe',
  p_radar: 'bip bipe',
  p_starlink: 'internet wifi',
  nogas: 'détendeur',
  p_flammejaune: 'plaque',
  humid: 'humidité condensation',
  p_buee: 'humidité condensation',
  p_humide: 'condensation',
  p_ventiltoit: 'lanterneau',
  lant: 'infiltration',
  p_toitrelevable: 'infiltration',
  heater: 'truma',
  nohotwater: 'truma',
  p_dieselaltitude: 'webasto eberspächer',
  h_store: 'fiamma thule',
  h_portevelos: 'fiamma thule',
  h_lith: 'victron',
  nocharge: 'victron chargeur ne charge pas',
  p_cassette: 'thetford',
  h_clim: 'dometic',
  no12v: '12v jus',
  p_prise: '12v',
  no230: '220 220v',
};

function addSearchWords(db) {
  let changed = 0;
  for (const [id, words] of Object.entries(WORDS)) {
    const row = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(id);
    if (!row) continue;
    const d = JSON.parse(row.data);
    const kw = d.kw || '';
    if (kw.includes(words)) continue;
    d.kw = `${kw} ${words}`.trim();
    db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(d), id);
    changed++;
  }
  return changed;
}

module.exports = { addSearchWords, WORDS };
