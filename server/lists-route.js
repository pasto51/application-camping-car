'use strict';

// Arrival and departure, as the user asked: not the same things to do in a campsite or service area as when parked
// on a public place (« stationnement libre »). Parked is not camped: nothing out of the vehicle (awning, table,
// chairs, wedges, step), nothing running out, and a stay limited by the town (sources: Maison des communes de la
// Vendée, Assemblée nationale written answers, camping-car.com). « where »: camping = campsite or service area,
// libre = free parking; no « where »: both.

const C = 'camping';
const F = 'libre';

const ARRIVEE = [
  { t: 'Accueil : je me présente au camping, ou je paie l’aire et je laisse le ticket visible. Je lis le règlement : horaires, durée maximale, vidange et eau.', where: C },
  { t: 'Bon emplacement : sol plat et stable, assez de place pour ouvrir la porte et le store, pas de branches basses au-dessus du toit.', where: C },
  { t: 'Véhicule à plat : cales sous les roues si besoin, niveau vérifié.', where: C },
  { t: 'Stationnement autorisé : pas de panneau d’interdiction ni de barre de hauteur, pas d’arrêté de la commune. Jamais sur un terrain privé sans accord, ni en bord de mer, en forêt ou sur un site protégé.', where: F },
  { t: 'Bien garé : sur une vraie place, sans gêner personne, et si possible dans le sens du départ.', where: F },
  { t: 'Je reste « stationné » : le véhicule repose sur ses roues, sans cales ni béquilles, et rien ne dépasse (store, table, chaises, marchepied rentré).', where: F },
  { t: 'Sol en pente : je cherche une place plus plate plutôt que de sortir les cales (avec les cales, c’est du camping).', where: F },
  'Frein à main serré et vitesse engagée.',
  { t: 'Prise P17 branchée : câble déroulé en entier, ampérage de la borne regardé (6, 10 ou 16 A), adaptateur si besoin.', where: C },
  { t: 'Climatisation : elle ne marche que sur 230 V (prise P17), télécommande dans le tiroir', eq: ['clim'], where: C },
  { t: 'Frigo passé sur 230 V pour garder le gaz et la batterie.', variant: ['frigo', 'trimixte'], where: C },
  { t: 'Frigo au gaz pour ne pas vider la batterie.', variant: ['frigo', 'trimixte'], where: F },
  { t: 'Batterie cellule regardée au panneau : je sais combien de temps je tiens sans prise.', where: F },
  { t: 'Store sorti seulement si le vent le permet, pieds posés et attachés.', eq: ['store'], where: C },
  'Aérateurs de toit ouverts pour renouveler l’air',
  'Niveau d’eau propre contrôlé',
  'Robinet de gaz ouvert selon la notice',
  { t: 'Aucun écoulement : vanne des eaux grises fermée, rien n’est vidé au sol (vidange seulement sur une borne).', where: F },
  { t: 'Ni feu ni barbecue, et pas de moteur qui tourne à l’arrêt.', where: F },
  { t: 'Calme : silence la nuit (souvent de 22 h à 7 h), et au pas dans les allées.', where: C },
  { t: 'Discrétion : pas de bruit, et une nuit ou deux seulement (la commune limite souvent à 24 ou 48 h, 7 jours au plus).', where: F },
  { t: 'La nuit : portes verrouillées, clés et téléphone à portée de main.', where: F },
];

const DEPART = [
  { t: 'Eaux grises et cassette WC vidées sur la borne de l’aire de service.', where: C },
  { t: 'Eau propre remplie si besoin, à la borne.', where: C },
  { t: 'Aucune trace laissée : déchets emportés, rien vidé sur place.', where: F },
  { t: 'Vidange prévue sur la prochaine aire de service (eaux grises, cassette WC).', where: F },
  { t: 'Prise P17 débranchée et câble rangé', where: C },
  { t: 'Cales de nivellement ramassées', where: C },
  { t: 'Table, chaises et tapis rangés dans la soute.', where: C },
  { t: 'Store rentré', eq: ['store'], where: C },
  { t: 'Frigo passé sur 12 V pour rouler (pas de gaz en roulant).', variant: ['frigo', 'trimixte'] },
  'Objets rangés, tiroirs et portes de placard verrouillés',
  'Lanterneaux (skydomes) et fenêtres fermés',
  'Antenne rentrée et repliée',
  'Marchepied rentré',
  'Tour du véhicule : rien d’oublié dehors, rien sous les roues.',
  'Pression des pneus contrôlée à froid',
];

// The lists as they were before (the patch replaces them only if the dealership did not change them).
const OLD_ARRIVEE = ['Véhicule calé à plat', 'Prise P17 branchée', 'Climatisation : elle ne marche que sur 230 V (prise P17), télécommande dans le tiroir', "Aérateurs de toit ouverts pour renouveler l'air", "Niveau d'eau propre contrôlé", 'Robinet de gaz ouvert selon la notice'];
const OLD_DEPART = ['Eaux grises vidées sur un point de vidange prévu', 'Prise P17 débranchée et câble rangé', 'Cales de nivellement ramassées', 'Objets rangés, tiroirs et portes de placard verrouillés', 'Lanterneaux (skydomes) et fenêtres fermés', 'Antenne automatique rentrée (éteinte)', 'Marchepied rentré', 'Store rentré', 'Pression des pneus contrôlée à froid'];

// When each list unticks itself and when it reminds the customer (months).
const SETTINGS = {
  arrivee: { section: 'route', places: true, reset: 'jour', goal: 'S’installer en sécurité, sans rien oublier.' },
  depart: { section: 'route', places: true, reset: 'jour', goal: 'Repartir sans rien oublier ni rien abîmer.' },
  hiver: { section: 'saison', reset: 90, notify: { months: [10, 11] } },
  printemps: { section: 'saison', reset: 90, notify: { months: [3, 4] } },
  mensuel: { section: 'saison', reset: 30, notify: { months: [4, 5, 6, 7, 8, 9, 10] } },
};

module.exports = { ARRIVEE, DEPART, OLD_ARRIVEE, OLD_DEPART, SETTINGS };
