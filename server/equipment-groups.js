'use strict';

// PROPOSAL, not used by the app yet: the equipment arranged in « ensembles » (the big thing, with its place on the
// plan) and « éléments » (the parts of it that are set, break or are changed separately). Written for the user to
// review (docs/EQUIPEMENTS-ENSEMBLES.md is generated from it by tools/equipment-groups-doc.js).
//
// Each ensemble: an existing equipment id (or a new one, « new: true »), its category, its elements.
// Each element: an existing equipment id or a new one, and its kind:
//   always : always there with the ensemble (a gas locker always has a hose);
//   choice : one model among several (« je ne sais pas » always possible), never guessed;
//   option : ticked only if the vehicle has it.
// « dated »: a date read on the part, used by the maintenance logbook to remind the customer:
//   until = the date written on it is the end of validity; made = the date written on it is the manufacturing date,
//   valid « years » after it.
// « alt »: ensembles that replace each other (a vehicle has one of them): same alt name.

const E = (id, kind, extra = {}) => ({ id, kind, ...extra });
const N = (id, name, kind, extra = {}) => ({ id, name, kind, new: true, ...extra });

const GROUPS = [
  // ---------- Cabine et conduite ----------
  { cat: 'cab', id: 'sieges', elements: [E('ceint', 'always'), E('sieges_chauf', 'option'), E('isofix', 'option')] },
  { cat: 'cab', id: 'occult', elements: [N('occult_type', 'Type d’occultation', 'choice', { choices: ['Stores plissés intégrés', 'Rideaux', 'Isolants à poser'] }), E('store_pb', 'option')] },
  {
    cat: 'cab', id: 'g_conduite', new: true, name: 'Aides à la conduite', note: 'Pas de place précise sur le plan : la fiche s’ouvre depuis la cabine.',
    elements: [E('regul', 'option'), E('auto', 'option'), E('frein_elec', 'option'), E('start_stop', 'option'), E('aides_cond', 'option'), E('esp', 'option'), E('traction', 'option'), E('camera', 'option'), E('retro_elec', 'option'), E('pare_brise_ch', 'option'), E('airbags', 'option')],
  },
  { cat: 'cab', id: 'radio', elements: [E('gps', 'option'), E('appli_veh', 'option')] },
  { cat: 'cab', id: 'climcab', elements: [] },
  { cat: 'cab', id: 'porte_cond', elements: [] },

  // ---------- Salon, couchage, rangements ----------
  {
    cat: 'conf', id: 'g_salon', new: true, name: 'Salon et dinette',
    elements: [E('table', 'always'), E('banq', 'always'), N('salon_type', 'Forme du salon', 'choice', { choices: ['En L ou face-à-face', 'Salon arrière', 'Banquette simple'], replaces: ['salon_l', 'salon_ar'] }),
      E('dinette_lit', 'option'), E('table_elev', 'option'), E('table_ext', 'option'), E('fen', 'option')],
  },
  {
    cat: 'conf', id: 'lit_ar', alt: 'lit',
    elements: [N('lit_ar_type', 'Type de lit', 'choice', { choices: ['Lit central (à la française)', 'Lits jumeaux', 'Lits superposés', 'Lit relevable'], replaces: ['lit_central', 'lits_jum', 'superp', 'litar'] }), E('lit_haut', 'option')],
  },
  { cat: 'conf', id: 'pavillon', elements: [N('pav_type', 'Type de lit de pavillon', 'choice', { choices: ['Grand lit', 'Lits jumeaux'], replaces: ['lits_jum_pav'] }), E('echelle_lit', 'option')] },
  { cat: 'conf', id: 'lit_cap', elements: [E('fen_cap', 'option')] },
  { cat: 'conf', id: 'lit_cab3', elements: [] },
  {
    cat: 'conf', id: 'g_soute', new: true, name: 'Soute ou garage arrière',
    elements: [N('soute_type', 'Type', 'choice', { choices: ['Soute sous le lit', 'Garage'], replaces: ['soute', 'garage'] }), E('trappe_int', 'option'), E('soute_trav', 'option'), E('arrimage', 'option')],
  },
  { cat: 'conf', id: 'plac', elements: [E('plac_ar', 'option'), E('penderie', 'option')] },
  { cat: 'conf', id: 'baies', elements: [] },
  { cat: 'conf', id: 'skyview', elements: [] },

  // ---------- Cuisine ----------
  {
    cat: 'cui', id: 'g_cuisine', new: true, name: 'Meuble cuisine',
    elements: [E('rechaud', 'always', { choices: ['Gaz', 'Induction', 'Mixte gaz et induction'] }), E('dessous_plaque', 'always'), E('evier', 'always'), E('siphon_cui', 'always'),
      E('hotte', 'option'), E('four', 'option'), E('micro', 'option'), E('poche_cui', 'option'), E('cuis_l', 'option')],
  },
  {
    cat: 'cui', id: 'g_frigo', new: true, name: 'Réfrigérateur', note: 'Remplace « frigo » et « comp », qui faisaient doublon.',
    elements: [N('frigo_type', 'Type de réfrigérateur', 'choice', { choices: ['À compression (12 V)', 'À absorption trimixte (gaz, 12 V, 230 V)'], replaces: ['frigo', 'comp'] }), E('frigo_plaque', 'always')],
  },
  { cat: 'cui', id: 'cuis_ext', elements: [] },

  // ---------- Salle d'eau ----------
  {
    cat: 'sdb', id: 'wc', alt: 'wc',
    elements: [N('cassette', 'Cassette', 'always'), E('chasse', 'always', { choices: ['Chasse sur l’eau propre', 'Réservoir de chasse séparé'] }), E('vanne_wc', 'always'), N('wc_niveau', 'Indicateur de niveau de la cassette', 'always'),
      N('wc_ventil', 'Ventilation anti-odeur', 'option'), N('wc_roulettes', 'Cassette à roulettes et poignée', 'option'), N('wc_cassette2', 'Deuxième cassette', 'option')],
  },
  { cat: 'sdb', id: 'wc_noires', alt: 'wc', elements: [N('noires_vanne', 'Vanne de vidange des eaux noires', 'always')] },
  { cat: 'sdb', id: 'wcfixe', alt: 'wc', elements: [] },
  {
    cat: 'sdb', id: 'douche',
    elements: [E('lavabo', 'always'), E('siphon_sdb', 'always'), E('colonne', 'always'), E('bonde_douche', 'always'),
      N('sdb_type', 'Forme de la salle d’eau', 'choice', { choices: ['Douche séparée', 'Salle d’eau modulable', 'Toute la largeur', 'Compacte'], replaces: ['douche_sep', 'sdb_mod', 'sdb_trav'] }),
      E('caillebotis', 'option'), E('champ', 'option')],
  },

  // ---------- Eau ----------
  {
    cat: 'eau', id: 'propre', name: 'Circuit d’eau propre',
    elements: [E('pompe', 'always', { choices: ['Pompe dans le réservoir (robinets à contacteur)', 'Pompe à pression à côté du réservoir'] }), E('filtre', 'option', { dated: { kind: 'every', months: 6, label: 'Cartouche à changer' } }), E('dext', 'option')],
  },
  { cat: 'eau', id: 'grises', elements: [E('antigel', 'option')] },

  // ---------- Gaz ----------
  {
    cat: 'gaz', id: 'coffre_gaz', alt: 'gaz', name: 'Coffre à gaz (bouteilles)',
    elements: [
      N('lyre', 'Lyre (tuyau entre bouteille et détendeur)', 'always', { dated: { kind: 'until', label: 'Date limite marquée sur la lyre' } }),
      E('bouteille', 'always', { name: 'Détendeur', choices: ['Détendeur simple sur la bouteille', 'Truma Duocontrol', 'Truma Duocontrol CS', 'Truma Monocontrol CS', 'Autre inverseur automatique'], dated: { kind: 'made', years: 10, label: 'Date de fabrication marquée sur le détendeur' } }),
      N('bouteilles_type', 'Bouteilles', 'choice', { choices: ['Butane', 'Propane'] }),
      E('duo', 'option'), E('gazext', 'option'),
    ],
  },
  {
    cat: 'gaz', id: 'gaslow', alt: 'gaz', name: 'Coffre GPL (réservoir fixe ou bouteilles rechargeables)', note: 'Pas de date de validité à suivre.',
    elements: [N('gpl_type', 'Type', 'choice', { choices: ['Réservoir fixe', 'Bouteilles rechargeables'] }), N('gpl_remplissage', 'Prise de remplissage extérieure', 'always'), N('gpl_adaptateurs', 'Adaptateurs de remplissage pour l’étranger', 'option'), E('gazext', 'option')],
  },

  // ---------- Électricité et énergie ----------
  {
    cat: 'elec', id: 'g_batterie', new: true, name: 'Batterie cellule',
    elements: [N('bat_type', 'Type de batterie', 'choice', { choices: ['Plomb', 'AGM', 'GEL', 'Lithium (LiFePO4)'], replaces: ['cell', 'agm', 'gel', 'lith'] }),
      E('coupe', 'always'), E('bat2', 'option'), E('moni', 'option'), E('b2b', 'option')],
  },
  { cat: 'elec', id: 'start', elements: [] },
  { cat: 'elec', id: 'quai', name: 'Prise P17 et circuit 230 V', elements: [E('disj', 'always'), E('charg', 'always'), E('p230', 'option'), E('onduleur', 'option')] },
  { cat: 'elec', id: 'panneau', elements: [E('gest_energie', 'option')] },
  { cat: 'elec', id: 'solaire', elements: [E('mppt', 'always')] },
  { cat: 'elec', id: 'g_eclairage', new: true, name: 'Éclairage et prises', elements: [E('led', 'always'), E('prises', 'option')] },
  { cat: 'elec', id: 'pile_comb', elements: [] },
  { cat: 'elec', id: 'groupe', elements: [] },

  // ---------- Chauffage, climat, aération ----------
  {
    cat: 'chauf', id: 'g_chauffage', new: true, name: 'Chauffage de la cellule', note: 'Remplace « chauf », trop général.',
    elements: [N('chauf_type', 'Modèle', 'choice', { choices: ['Truma Combi (gaz)', 'Truma Combi Diesel', 'Webasto ou Eberspächer (diesel)', 'Alde (eau chaude et radiateurs)', 'Autre'], replaces: ['trumac', 'trumad', 'webasto', 'alde', 'combi', 'chauf'] }),
      E('cmd_chauf', 'always'), E('gaines', 'always'), E('evac_truma', 'always'), E('truma_plaque', 'always'),
      E('gaine_cell', 'option'), E('gaine_sdb', 'option'), E('gaine_soute', 'option'), E('plancher', 'option'), E('appoint', 'option')],
  },
  {
    cat: 'chauf', id: 'eauch', name: 'Eau chaude', note: 'Avec un Truma Combi ou un Alde, l’eau chaude est faite par le chauffage : rien à cocher ici.',
    elements: [N('eauch_type', 'Chauffe-eau', 'choice', { choices: ['Fait par le chauffage (Combi, Alde)', 'Chauffe-eau Truma (gaz / 230 V)', 'Chauffe-eau électrique 230 V'], replaces: ['trumae', 'eaue'] })],
  },
  { cat: 'chauf', id: 'clim', elements: [] },
  { cat: 'chauf', id: 'lant', elements: [E('maxx', 'option')] },
  { cat: 'chauf', id: 'lant_lit', elements: [] },
  { cat: 'chauf', id: 'lant_sdb', elements: [] },
  { cat: 'chauf', id: 'lant_cui', elements: [] },
  { cat: 'chauf', id: 'lant_cap', elements: [] },
  { cat: 'chauf', id: 'lant_pav', elements: [] },
  { cat: 'chauf', id: 'heki', elements: [] },

  // ---------- Extérieur ----------
  {
    cat: 'ext', id: 'store',
    elements: [N('store_toile', 'Toile et bras', 'always'), N('store_cmd', 'Commande', 'choice', { choices: ['Manivelle', 'Moteur 12 V'] }),
      N('store_cotes', 'Côtés (panneaux latéraux)', 'option'), N('store_tempete', 'Kit tempête (sangles et piquets)', 'option'), N('store_led', 'Éclairage LED du store', 'option'), N('store_vent', 'Capteur de vent', 'option')],
  },
  { cat: 'ext', id: 'auvent', elements: [] },
  { cat: 'ext', id: 'porte_cell', elements: [N('porte_moust', 'Moustiquaire de porte', 'option'), E('gouttiere', 'option')] },
  { cat: 'ext', id: 'porte', elements: [E('moust_lat', 'option')] },
  { cat: 'ext', id: 'portes_ar', elements: [E('fen_ar', 'option'), E('rideau_ar', 'option')] },
  { cat: 'ext', id: 'marche_ext', elements: [N('marche_type', 'Type', 'choice', { choices: ['Manuel', 'Électrique'] }), E('marche', 'option')] },
  { cat: 'ext', id: 'trappe', elements: [] },
  { cat: 'ext', id: 'toit_rel', elements: [E('lit_toit', 'always')] },
  { cat: 'ext', id: 'galerie', elements: [E('echelle', 'option')] },
  { cat: 'ext', id: 'velos', elements: [] },
  { cat: 'ext', id: 'porte_moto', elements: [] },
  { cat: 'ext', id: 'att', elements: [] },
  { cat: 'ext', id: 'feu_auvent', elements: [] },

  // ---------- Châssis et suspension ----------
  {
    cat: 'chas', id: 'g_roues', new: true, name: 'Pneus et roues',
    elements: [E('pneus', 'always', { dated: { kind: 'made', years: 6, label: 'Date de fabrication sur le flanc (4 chiffres : semaine et année)' } }), E('secours', 'always', { choices: ['Roue de secours', 'Kit anti-crevaison'] }), E('tpms', 'option'), E('pneus_hiver', 'option')],
  },
  { cat: 'chas', id: 'g_niveau', new: true, name: 'Mise à niveau et stabilisation', elements: [E('cales', 'option'), E('bequilles', 'option'), E('verins', 'option')] },
  { cat: 'chas', id: 'air', elements: [] },
  { cat: 'chas', id: 'alko', elements: [] },
  { cat: 'chas', id: 'x4', elements: [] },
  { cat: 'chas', id: 'ptac_lourd', elements: [] },

  // ---------- Multimédia ----------
  { cat: 'multi', id: 'g_antenne', new: true, name: 'Antenne TV', elements: [N('antenne_type', 'Type d’antenne', 'choice', { choices: ['Satellite manuelle', 'Satellite automatique', 'TNT (hertzienne)'], replaces: ['satman', 'sat', 'tnt'] }), E('tv', 'option')] },
  { cat: 'multi', id: 'wifi', elements: [] },

  // ---------- Sécurité ----------
  {
    cat: 'secu', id: 'g_detecteurs', new: true, name: 'Détecteurs',
    elements: [E('fumee', 'option', { dated: { kind: 'made', years: 10, label: 'Date de fabrication au dos' } }), E('co', 'option', { dated: { kind: 'until', label: 'Date de fin de vie marquée au dos' } }), E('gazdet', 'option'), E('gazsop', 'option')],
  },
  { cat: 'secu', id: 'extinct', elements: [], dated: { kind: 'until', label: 'Date de validité ou de prochain contrôle sur l’étiquette' } },
  { cat: 'secu', id: 'g_antivol', new: true, name: 'Antivol', elements: [E('alarme', 'option'), E('traceur', 'option'), E('coffre_fort', 'option')] },
  { cat: 'secu', id: 'g_bord', new: true, name: 'Équipement de bord obligatoire', elements: [E('gilet', 'always'), E('trousse', 'option', { dated: { kind: 'until', label: 'Dates de péremption des produits' } })] },
];

// Equipment that does not fit anywhere yet: to decide with the user.
const TO_REVIEW = {
  vue_ar: 'C’est une vue du plan (l’arrière du fourgon), pas un équipement : à transformer en simple vue ?',
  tech_vue: 'C’est une vue du plan (l’installation électrique sous la banquette), pas un équipement : à transformer en simple vue ?',
};

module.exports = { GROUPS, TO_REVIEW };
