'use strict';

// Vehicle types (silhouettes): which equipment exists on each, where it sits on the plan, and the default plan.
// Plans and zones are drawn by tools/make-plans.js.

const PLANS = require('./seed/plans.json'); // { types: {type: default layout}, layouts: {id: {type, name, desc, features, spotDefaults, spots}} }

const TYPES = [
  { id: 'van', name: 'Van', hint: 'Fourgon court, jusqu’à 5,40 m environ, porte latérale coulissante' },
  { id: 'fourgon', name: 'Fourgon aménagé', hint: '5,99 à 6,40 m, porte latérale coulissante et portes arrière' },
  { id: 'compact', name: 'Profilé compact', hint: 'Cellule de moins de 7 m, sans lit fixe à l’arrière' },
  { id: 'profile', name: 'Profilé', hint: 'Cellule avec lit arrière et garage, souvent un lit de pavillon' },
  { id: 'integral', name: 'Intégral', hint: 'Cabine intégrée à la cellule, lit de pavillon au-dessus' },
  { id: 'capucine', name: 'Capucine', hint: 'Grand couchage au-dessus de la cabine' },
];
const TYPE_IDS = TYPES.map((t) => t.id);

const VANS = ['van', 'fourgon'];
const CELLS = ['compact', 'profile', 'integral', 'capucine'];
const BIG_CELLS = ['profile', 'integral', 'capucine'];
const REAR_BED = ['van', 'fourgon', 'profile', 'integral', 'capucine'];

// Where an equipment goes when the vehicle's plan has no such zone.
const SPOT_FALLBACK = { pav: ['cab'], cap: ['cab'], gar: ['lit'], sal: ['lit'], lit: ['sal', 'pend'], pend: ['lit', 'sal'] };

// Default zones that differ by silhouette (gas locker outside on a coachbuilt, garage instead of the van boot…).
const CELL_SPOTS = { bouteille: 'ext', coffre_gaz: 'ext', gazext: 'ext', soute: 'gar', gaine_soute: 'gar' };
const TYPE_SPOTS = {
  compact: { ...CELL_SPOTS, plac_ar: 'sal', gaine_soute: 'sal' },
  profile: CELL_SPOTS,
  integral: CELL_SPOTS,
  capucine: CELL_SPOTS,
};

function isApplicable(q, type) {
  return !type || !Array.isArray(q.types) || !q.types.length || q.types.includes(type);
}

// Layout ("implantation") of a vehicle: the one chosen for it, else the usual one of its type.
function layoutOf(profile) {
  const L = PLANS.layouts[profile.layout];
  if (L && (!profile.type || L.type === profile.type)) return { id: profile.layout, ...L };
  const id = PLANS.types[profile.type];
  return id ? { id, ...PLANS.layouts[id] } : null;
}

// Plan shown for a vehicle: its own drawing and zones if it has some, else those of its layout.
function vehiclePlan(profile) {
  const own = Array.isArray(profile.spots) && profile.spots.length ? profile.spots : null;
  const L = layoutOf(profile);
  const spots = own || (L ? L.spots.map((x) => ({ ...x })) : []);
  const planUrl = profile.planUrl || (!own && L ? `/app/plans/${L.id}.svg` : spots.length ? '/app/plan-van.svg' : null);
  return { spots, planUrl, layout: own ? null : L?.id || null };
}

function layoutList() {
  return Object.entries(PLANS.layouts).map(([id, L]) => ({ id, type: L.type, name: L.name, desc: L.desc, features: L.features, planUrl: `/app/plans/${id}.svg` }));
}

// Zone of an equipment on this vehicle: the vehicle's own choice, else the default for its type, else the catalogue's.
// Always a zone that exists on the plan (or null: "Emplacement variable").
function effectiveSpot(q, profile, spots) {
  const ids = new Set(spots.map((s) => s.id));
  const own = profile.spotOverrides || {};
  if (Object.prototype.hasOwnProperty.call(own, q.id)) return own[q.id] && ids.has(own[q.id]) ? own[q.id] : null;
  const spot = layoutOf(profile)?.spotDefaults?.[q.id] ?? TYPE_SPOTS[profile.type]?.[q.id] ?? q.spot;
  if (!spot) return null;
  if (ids.has(spot)) return spot;
  return (SPOT_FALLBACK[spot] || []).find((alt) => ids.has(alt)) || null;
}

// Catalogue additions so that every silhouette is covered, and the types each existing equipment applies to.
const EQUIPMENT_TYPES = {
  porte: VANS,
  litar: VANS,
  vue_ar: VANS,
  fen_ar: VANS,
  rideau_ar: VANS,
  lit_ar: REAR_BED,
  soute: REAR_BED,
  gaine_soute: REAR_BED,
  pavillon: ['compact', 'profile', 'integral'],
};

// Equipment whose name described the V114 only: generic name in the catalogue, the V114 keeps its own (per-vehicle name).
const GENERIC_NAMES = {
  lant: ['Lanterneau avant, 70 × 40 cm', 'Lanterneau du salon'],
  lant_lit: ['Lanterneau au-dessus du lit, 40 × 40 cm', 'Lanterneau de la chambre'],
  solaire: ['Panneaux solaires, 2 × 100 W', 'Panneaux solaires'],
  agm: ['Batterie AGM 100 Ah', 'Batterie cellule AGM'],
  trumac: ['Chauffage et eau chaude : Truma Combi 4 (gaz)', 'Chauffage et eau chaude : Truma Combi (gaz)'],
  prises: ['Prise USB (côté banquette)', 'Prises USB'],
};

// Better default zones for equipment that had none (outside of the vehicle, at the back).
const DEFAULT_SPOTS = { velos: 'arr', att: 'arr', echelle: 'arr', camera: 'arr', dext: 'ext', p230: 'ext', trappe: 'ext', pavillon: 'pav' };

const q = (id, cat, name, spot, types, text, tip = '', kw = '') => ({ id, cat, name, base: false, spot, types: types || [], text, tip, img: '', kw });
const NEW_EQUIPMENT = [
  // Cab and structure
  q('porte_cond', 'cab', 'Porte conducteur', 'cab', ['integral'], 'Sur un intégral, la cabine a sa propre porte côté conducteur, en plus de la porte de la cellule.', 'Vérifiez qu’elle est bien fermée avant de partir.', 'portiere conducteur integral'),
  q('store_pb', 'cab', 'Store plissé du pare-brise', 'cab', ['integral'], 'Store intégré qui occulte le grand pare-brise de l’intégral, du haut vers le bas.', 'Remontez-le entièrement avant de démarrer.', 'store plisse pare brise occultation integral'),
  q('porte_cell', 'ext', 'Porte de la cellule', 'ent', CELLS, 'Porte d’entrée de la cellule, souvent avec fenêtre, moustiquaire et rangements intégrés. Verrouillez-la avant de rouler.', 'Graissez la serrure et les charnières une fois par an.', 'porte entree cellule serrure moustiquaire'),
  q('portes_ar', 'ext', 'Portes arrière battantes', 'arr', VANS, 'Les deux portes arrière s’ouvrent à 90°, puis à 180° en décrochant le tirant. Elles donnent accès au lit et à la soute.', 'Bloquez-les en position ouverte par vent fort.', 'porte arriere battante hayon'),
  q('moust_lat', 'ext', 'Moustiquaire de la porte latérale', 'ent', VANS, 'Rideau à glissière qui ferme l’ouverture de la porte latérale contre les insectes, porte ouverte.', 'Faites-la coulisser doucement, sans tirer en biais.', 'moustiquaire porte coulissante insectes'),
  q('toit_rel', 'ext', 'Toit relevable', 'toit', VANS, 'Le toit se soulève à l’arrêt pour gagner de la hauteur et un couchage. Des vérins à gaz l’aident à monter.', 'Ne roulez jamais toit levé. Repliez-le sec, ou faites-le sécher dès que possible.', 'toit relevable pop top'),
  q('galerie', 'ext', 'Galerie ou barres de toit', 'toit', [], 'Pour porter un coffre ou du matériel sur le toit. Le poids s’ajoute à la charge, et la hauteur augmente.', 'Mesurez la hauteur totale avec la galerie chargée.', 'galerie barres de toit coffre'),
  q('auvent', 'ext', 'Auvent', 'ext', [], 'Abri en toile qui se fixe sur le côté du véhicule (rail ou store) pour agrandir l’espace de vie.', 'Démontez-le par vent fort.', 'auvent tente avancee'),
  q('feu_auvent', 'ext', 'Éclairage extérieur', 'ext', [], 'Lampe au-dessus de la porte pour éclairer l’entrée le soir. Elle fonctionne sur la batterie cellule.', 'Éteignez-la en partant : elle consomme et attire les insectes.', 'lampe exterieure feu d auvent eclairage porte'),
  q('porte_moto', 'ext', 'Porte-moto ou porte-scooter', 'arr', BIG_CELLS, 'Plateforme fixée au châssis, à l’arrière, pour transporter un deux-roues.', 'Contrôlez la charge sur l’essieu arrière et le débord autorisé.', 'porte moto scooter plateforme'),
  q('cuis_ext', 'cui', 'Cuisine extérieure', 'ext', [], 'Plaque de cuisson ou rangement de cuisine accessible depuis l’extérieur.', 'Fermez le robinet de gaz de l’appareil après usage.', 'cuisine exterieure barbecue plancha'),
  // Beds and living
  q('lit_toit', 'conf', 'Lit du toit relevable', 'toit', VANS, 'Couchage installé dans le toit relevable. Le matelas reste en place, toit replié.', 'Respectez la charge maximale indiquée pour ce lit.', 'lit toit relevable couchage'),
  q('lit_central', 'conf', 'Lit central (à la française)', 'lit', BIG_CELLS, 'Grand lit à l’arrière, accessible des deux côtés. Il se relève souvent pour accéder au garage dessous.', 'Débarrassez-le avant de le relever.', 'lit central queen ile'),
  q('lits_jum', 'conf', 'Lits jumeaux', 'lit', ['fourgon', 'profile', 'integral', 'capucine'], 'Deux lits séparés à l’arrière, que l’on réunit souvent en un grand lit avec un coussin d’appoint.', '', 'lits jumeaux lits separes'),
  q('superp', 'conf', 'Lits superposés', 'lit', BIG_CELLS, 'Deux couchages l’un au-dessus de l’autre, souvent pour les enfants, avec une échelle.', 'Vérifiez le filet ou la barrière du lit du haut.', 'lits superposes enfants'),
  q('lit_cap', 'conf', 'Lit de capucine', 'cap', ['capucine'], 'Grand couchage au-dessus de la cabine. On y monte par une échelle ; il se relève parfois pour dégager la cabine.', 'Rangez l’échelle et vérifiez le filet de sécurité avant de rouler.', 'capucine lit cabine'),
  q('fen_cap', 'conf', 'Fenêtre de la capucine', 'cap', ['capucine'], 'Baie à l’avant ou sur le côté de la capucine, pour l’air et la lumière.', 'Surveillez son joint : c’est une entrée d’eau fréquente.', 'fenetre capucine'),
  q('echelle_lit', 'conf', 'Échelle du lit', 'din', CELLS, 'Échelle amovible pour monter au lit de capucine, de pavillon ou du haut. Elle s’accroche en haut et se range pour rouler.', '', 'echelle lit'),
  q('dinette_lit', 'conf', 'Dinette transformable en lit', 'din', [], 'La table descend et les coussins se réorganisent pour faire un couchage d’appoint.', 'Gardez la notice : l’ordre des coussins n’est pas évident.', 'dinette lit appoint table'),
  q('salon_l', 'conf', 'Salon en L ou face-à-face', 'din', CELLS, 'Banquettes et sièges de cabine pivotés autour de la table. Certaines places sont homologuées pour rouler.', 'Vérifiez quelles places ont une ceinture.', 'salon face a face L banquette'),
  q('salon_ar', 'conf', 'Salon arrière', 'sal', ['compact'], 'À l’arrière, un salon en U avec grandes vitres, transformable en couchage.', '', 'salon arriere U'),
  q('baies', 'conf', 'Baies de la cellule (store et moustiquaire)', 'din', CELLS, 'Fenêtres à double vitrage acrylique, avec store occultant et moustiquaire intégrés. Elles s’ouvrent en compas et se bloquent.', 'Fermez-les avant de rouler ; nettoyez-les à l’eau douce, jamais à l’alcool.', 'baie fenetre store occultant moustiquaire'),
  q('penderie', 'conf', 'Penderie ou armoire', 'lit', [], 'Rangement pour suspendre les vêtements.', 'Calez les cintres pour éviter les bruits en roulant.', 'penderie armoire dressing'),
  q('garage', 'conf', 'Garage arrière', 'gar', BIG_CELLS, 'Grande soute sous le lit arrière, accessible par une ou deux portes. Des rails et des anneaux servent à arrimer le chargement.', 'Arrimez tout et respectez la charge maximale du garage.', 'garage soute arriere'),
  q('soute_trav', 'conf', 'Soute traversante ou double plancher', 'tech', CELLS, 'Rangement sous le plancher, accessible par des trappes extérieures.', 'Le lourd en bas et au centre : le véhicule reste plus stable.', 'soute traversante double plancher'),
  q('isofix', 'conf', 'Fixations Isofix', 'din', [], 'Points d’ancrage pour siège enfant sur certaines places homologuées.', '', 'isofix siege enfant'),
  // Roof vents
  q('lant_sdb', 'chauf', 'Lanterneau de la salle d’eau', 'sdb', [], 'Il aère la salle d’eau et évacue la vapeur de la douche.', 'Ouvrez-le pendant et après la douche contre la condensation.', 'lanterneau salle d eau aeration'),
  q('lant_cui', 'chauf', 'Lanterneau de la cuisine', 'cui', [], 'Il évacue l’air chaud et les odeurs de cuisson.', 'Fermez-le avant de rouler et dès qu’il pleut.', 'lanterneau cuisine'),
  q('heki', 'chauf', 'Lanterneau panoramique (type Heki)', 'din', CELLS, 'Grand lanterneau au-dessus du salon, avec store et moustiquaire, qui inonde la cellule de lumière.', 'Fermez-le avant de rouler et par vent fort.', 'heki panoramique lanterneau'),
  q('lant_cap', 'chauf', 'Lanterneau de la capucine', 'cap', ['capucine'], 'Il aère le couchage de la capucine.', 'Fermez-le avant de rouler et dès qu’il pleut.', 'lanterneau capucine'),
  q('lant_pav', 'chauf', 'Lanterneau du lit de pavillon', 'pav', ['compact', 'profile', 'integral'], 'Il aère le lit de pavillon, au-dessus de l’avant du véhicule.', 'Fermez-le avant de rouler.', 'lanterneau pavillon'),
  // Kitchen, bathroom
  q('hotte', 'cui', 'Hotte aspirante', 'cui', CELLS, 'Elle aspire la vapeur et les odeurs de cuisson vers l’extérieur.', 'Nettoyez le filtre régulièrement.', 'hotte aspiration'),
  q('douche_sep', 'sdb', 'Douche séparée', 'sdb', CELLS, 'Cabine de douche indépendante du lavabo et des toilettes.', 'Laissez la porte entrouverte après la douche pour sécher.', 'douche separee cabine'),
  q('sdb_mod', 'sdb', 'Salle d’eau modulable', 'sdb', ['van', 'fourgon', 'compact'], 'Une cloison ou un lavabo pivotant transforme la salle d’eau en douche.', 'Remettez le lavabo en place et bloquez-le avant de rouler.', 'salle d eau modulable lavabo pivotant cloison'),
  q('wc_noires', 'sdb', 'Toilettes à réservoir fixe (eaux noires)', 'sdb', BIG_CELLS, 'Les toilettes se vident dans un réservoir sous le plancher, que l’on vidange sur une aire de service par une vanne.', 'Vidangez d’abord les eaux noires, puis les eaux grises pour rincer le tuyau.', 'eaux noires reservoir fixe wc'),
  // Energy, chassis, safety
  q('bat2', 'elec', 'Deuxième batterie cellule', 'tech', [], 'Une seconde batterie double l’autonomie de la cellule. Les deux se chargent ensemble.', 'Remplacez-les ensemble, par deux batteries identiques.', 'batterie double parallele'),
  q('pile_comb', 'elec', 'Pile à combustible (type EFOY)', 'tech', [], 'Elle produit de l’électricité à partir de méthanol pour recharger la batterie cellule, sans bruit.', 'N’utilisez que les cartouches prévues par le fabricant.', 'efoy pile combustible methanol'),
  q('alko', 'chas', 'Châssis surbaissé (type AL-KO)', null, CELLS, 'Châssis plus bas et plus large derrière la cabine : meilleure tenue de route et plancher plus bas.', 'Attention à la garde au sol sur les chemins et les rampes.', 'alko chassis surbaisse'),
  q('x4', 'chas', 'Transmission 4×4', null, VANS, 'Transmission intégrale pour les chemins et les terrains glissants.', '', '4x4 transmission integrale'),
  q('bequilles', 'chas', 'Béquilles de stabilisation', 'arr', CELLS, 'Béquilles à manivelle, à l’arrière, qui stabilisent la cellule à l’arrêt.', 'Remontez-les avant de partir.', 'bequilles stabilisateurs manivelle'),
  q('coffre_fort', 'secu', 'Coffre-fort', null, [], 'Petit coffre fixé à la structure, pour les papiers et objets de valeur.', 'Notez le code ailleurs que dans le véhicule.', 'coffre fort'),
];

// From the 2026-2027 Challenger, Randger and Rimor catalogues (equipment an owner meets and may ask about).
const NEW_EQUIPMENT_2026 = [
  q('frein_elec', 'cab', 'Frein de stationnement électrique', 'cab', [], 'Un bouton remplace le levier de frein à main. Il se desserre seul au démarrage, ceinture bouclée.', 'Sur une pente, vérifiez le témoin rouge avant de quitter le volant.', 'frein a main electrique parking'),
  q('pare_brise_ch', 'cab', 'Pare-brise chauffant', 'cab', VANS, 'Des fils très fins dans le pare-brise le dégivrent et le désembuent en quelques minutes.', 'À utiliser moteur tournant : il consomme beaucoup.', 'pare brise chauffant degivrage'),
  q('sieges_chauf', 'cab', 'Sièges avant chauffants', 'cab', [], 'Les sièges de la cabine chauffent, moteur tournant.', '', 'sieges chauffants'),
  q('retro_elec', 'cab', 'Rétroviseurs électriques et dégivrants', 'cab', [], 'Réglage depuis la cabine, et dégivrage par temps froid. Certains se replient électriquement.', 'Repliez-les dans les rues étroites et au stationnement.', 'retroviseurs electriques chauffants rabattables'),
  q('aides_cond', 'secu', 'Aides à la conduite (Pack Safety)', 'cab', [], 'Freinage d’urgence automatique, alerte de franchissement de ligne, détection de fatigue et lecture des panneaux de vitesse.', 'Gardez le pare-brise propre devant la caméra : ces aides en dépendent.', 'pack safety aebs freinage urgence maintien de voie fatigue panneaux'),
  q('airbags', 'secu', 'Airbags conducteur et passager', 'cab', [], 'Coussins gonflables qui protègent en cas de choc frontal.', 'Rien sur le tableau de bord côté passager.', 'airbag'),
  q('esp', 'chas', 'ESP, ABS et antipatinage', null, [], 'Ces systèmes évitent le blocage des roues au freinage, le patinage au démarrage et la perte de contrôle en virage.', 'Un témoin allumé en permanence : faites contrôler au garage.', 'esp abs asr antipatinage stabilite'),
  q('traction', 'chas', 'Traction+ et aide en descente', 'cab', [], 'Traction+ aide à démarrer sur l’herbe mouillée, le sable ou la neige ; l’aide en descente retient le véhicule dans les pentes raides.', 'Activez-les avant de vous engager sur un terrain glissant.', 'traction plus hill descent control aide demarrage cote patinage'),
  q('start_stop', 'chas', 'Start & Stop', 'cab', [], 'Le moteur se coupe aux arrêts et redémarre quand on relâche le frein ou appuie sur l’embrayage.', 'Il se désactive par un bouton si vous préférez.', 'start stop arret automatique moteur'),
  q('ptac_lourd', 'chas', 'PTAC alourdi (plus de 3,5 t)', null, CELLS, 'Le véhicule peut peser plus de 3,5 tonnes en charge : davantage de charge utile.', 'Au-delà de 3,5 t, le permis C1 est obligatoire, et les règles de vitesse et de circulation changent.', 'ptac 3650 4100 permis c1 charge utile'),
  q('pneus_hiver', 'chas', 'Pneus M+S ou 3PMSF (hiver)', null, [], 'Pneus adaptés à la boue et à la neige. Le symbole flocon (3PMSF) les rend valables en zone montagne l’hiver.', 'Vérifiez la pression à froid une fois par mois.', 'pneus hiver neige m+s 3pmsf flocon loi montagne'),
  q('appli_veh', 'multi', 'Application du véhicule sur smartphone', null, [], 'Une appli (porteur ou cellule) montre la position, les niveaux de batterie et d’eau, et permet parfois de commander l’éclairage ou le chauffage.', 'Activez le Bluetooth près du véhicule pour qu’elle se connecte.', 'application smartphone fordpass luano camp bluetooth'),
  q('table_elev', 'conf', 'Table réglable en hauteur', 'din', [], 'La table monte et descend (électriquement ou par un pied télescopique) : repas, salon, ou couchage d’appoint en position basse.', 'Rien dessus quand vous la baissez.', 'table electrique t-system tulipe telescopique'),
  q('table_ext', 'conf', 'Table utilisable dehors', 'din', [], 'La table se décroche de son rail pour servir à l’extérieur.', 'Raccrochez-la bien sur son rail avant de rouler.', 'table exterieure rail'),
  q('lit_haut', 'conf', 'Lit arrière réglable en hauteur', 'lit', REAR_BED, 'Le lit arrière monte ou descend pour agrandir le garage dessous (vélos debout) ou abaisser le couchage.', 'Vérifiez le verrouillage du lit après chaque réglage.', 'lit relevable papillon easybed garage haut modulable'),
  q('lits_jum_pav', 'conf', 'Lits jumeaux de pavillon', 'pav', ['compact', 'profile', 'integral'], 'Deux lits séparés qui descendent du plafond au-dessus du salon.', 'Remontez-les et verrouillez-les avant de rouler.', 'lits jumeaux pavillon'),
  q('lit_cab3', 'conf', 'Couchage de cabine', 'cab', VANS, 'Un couchage d’appoint s’installe dans la cabine, sièges tournés.', '', 'couchage cabine 3e lit'),
  q('skyview', 'conf', 'Toit panoramique', 'din', [], 'Grande baie vitrée au-dessus de l’avant ou du salon, avec store occultant.', 'Fermez le store au soleil : la cellule chauffe vite.', 'toit panoramique skyview verriere'),
  q('trappe_int', 'conf', 'Trappe d’accès au garage depuis l’intérieur', 'lit', BIG_CELLS, 'Une trappe sous le lit ou dans la salle d’eau donne accès au garage sans sortir.', '', 'trappe garage interieur'),
  q('arrimage', 'secu', 'Anneaux d’arrimage et filet de soute', 'gar', [], 'Points d’attache dans la soute ou le garage pour sangler vélos et bagages, et filet de retenue.', 'Arrimez tout : un objet libre devient dangereux au freinage.', 'arrimage anneaux sangles filet soute'),
  q('cuis_l', 'cui', 'Cuisine en L', 'cui', CELLS, 'Plan de travail en angle : plus de surface et de rangements.', '', 'cuisine en l angle'),
  q('caillebotis', 'sdb', 'Caillebotis de douche', 'sdb', [], 'Grille en bois ou plastique posée dans le bac de douche : on reste au sec et le bac se protège.', 'Sortez-le de temps en temps pour nettoyer dessous.', 'caillebotis douche'),
  q('sdb_trav', 'sdb', 'Salle d’eau toute largeur', 'sdb', CELLS, 'Salle d’eau qui occupe toute la largeur à l’arrière, souvent avec douche et WC de chaque côté.', 'Fermez les deux portes avant de rouler.', 'salle de bain traversante arriere'),
  q('gest_energie', 'elec', 'Gestionnaire d’énergie connecté', 'tech', [], 'Un boîtier gère la charge de la batterie (secteur, moteur, solaire) et affiche tout sur le tableau ou sur une appli.', 'Consultez-le avant de partir en autonomie.', 'meb 300 gestionnaire energie centrale bluetooth'),
  q('gouttiere', 'ext', 'Gouttière au-dessus de la porte', 'ent', [], 'Petit rebord qui évite que la pluie ne coule sur vous en entrant.', '', 'gouttiere porte pluie'),
];

module.exports = { NEW_EQUIPMENT_2026, TYPES, TYPE_IDS, isApplicable, vehiclePlan, layoutOf, layoutList, PLANS, effectiveSpot, EQUIPMENT_TYPES, GENERIC_NAMES, DEFAULT_SPOTS, NEW_EQUIPMENT };
