'use strict';

// Arrival and departure, as the user asked: not the same things to do in a campsite or service area as when parked
// on a public place (« stationnement libre »). Parked is not camped: nothing out of the vehicle (awning, table,
// chairs, wedges, step), nothing running out, and a stay limited by the town (sources: Maison des communes de la
// Vendée, Assemblée nationale written answers, camping-car.com). « where »: camping = campsite or service area,
// libre = free parking; no « where »: both.

const C = 'camping';
const F = 'libre';

const ARRIVEE = [
  { t: 'Le règlement : je regarde les horaires, la durée maximale et où se trouvent la vidange et l’eau.', where: C },
  { t: 'Stationnement autorisé : pas de panneau d’interdiction ni d’arrêté de la commune, et pas sur un rivage, dans un bois ou près d’un site protégé.', where: F },
  { t: 'Bon emplacement : sol plat et stable, assez de place pour ouvrir la porte et le store, pas de branches basses au-dessus du toit.', where: C },
  { t: 'Bien garé : sur une vraie place, sans gêner personne, et si possible dans le sens du départ.', where: F },
  { t: 'Véhicule calé à plat : cales sous les roues, frein à main serré et vitesse engagée.', where: C },
  { t: 'Je reste « stationné » : rien ne dépasse du véhicule (ni store, ni table, ni chaises), cales et marchepied rangés.', where: F },
  { t: 'Prise P17 branchée : câble déroulé en entier et ampérage de la borne regardé (6, 10 ou 16 A).', where: C },
  { t: 'Climatisation : elle ne marche que sur 230 V (prise P17), télécommande dans le tiroir', eq: ['clim'], where: C },
  { t: 'Frigo passé sur 230 V pour garder le gaz et la batterie.', variant: ['frigo', 'trimixte'], where: C },
  { t: 'Frigo au gaz pour ne pas vider la batterie, et batterie cellule regardée au panneau.', variant: ['frigo', 'trimixte'], where: F },
  { t: 'Batterie cellule regardée au panneau : je sais combien de temps je tiens sans prise.', where: F },
  { t: 'Aucun écoulement : vanne des eaux grises fermée, rien n’est vidé au sol.', where: F },
  { t: 'Store sorti seulement si le vent le permet, pieds bien posés.', eq: ['store'], where: C },
  'Aérateurs de toit ouverts pour renouveler l’air',
  'Niveau d’eau propre contrôlé',
  'Robinet de gaz ouvert selon la notice',
  { t: 'La nuit : portes verrouillées, clés et téléphone à portée de main.', where: F },
  { t: 'Discrétion : pas de bruit, et une seule nuit ou deux (la commune limite souvent la durée à 24 ou 48 h).', where: F },
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
