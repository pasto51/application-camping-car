'use strict';

// Additions to three diagnostics of the start (October 2026, from the motorhome forums): charging while driving with
// the alternators of recent vehicles and lithium batteries, a fuse that blows straight away, the hookup post that
// trips. Written as funnels (see diag-helpers.js).

const { buy, shop, funnel, ask } = require('./diag-helpers');

const FUSE_SEC = 'Ne mettez jamais un fusible plus fort que l’origine : le câble chaufferait (risque de feu).';
const V230_SEC = 'Câble, fiche ou prise qui chauffe, fond ou sent le brûlé : débranchez et ne réarmez plus.';

// nocharge → « En roulant »: the checks after the existing ones (alternator, link fuse, 3-minute delay).
const DRIVING_END = funnel(
  ['Moteur tournant depuis plus de 10 minutes, mesurez la tension de la batterie cellule : reste-t-elle sous 13 V ?', ask('Votre véhicule est-il récent (norme Euro 6, à partir de 2016 environ) ?', [
    ['Oui, ou je ne sais pas', buy('L’alternateur intelligent ne charge pas assez la cellule.',
      'Sur les porteurs récents, l’alternateur baisse sa tension dès que la batterie moteur est pleine : le coupleur ne voit plus assez de courant pour la cellule. Un booster de charge (chargeur batterie à batterie) recharge la cellule à pleine puissance en roulant.',
      'Booster de charge DC-DC (chargeur batterie à batterie)')],
    ['Non, il est plus ancien', shop('Le coupleur de charge en roulant est en défaut.',
      'La tension ne monte pas en roulant sur un véhicule ancien : l’atelier contrôle le coupleur et son signal moteur (D+).', 'Contrôle du coupleur à l’atelier')],
  ]), ['Oui, sous 13 V', 'Non, au-dessus de 13 V']],
  ['Votre batterie cellule est-elle une lithium ?', buy('Le chargeur en roulant n’est pas réglé pour la lithium.',
    'Une batterie lithium demande un booster ou un coupleur réglé « lithium » ; sinon elle se protège et refuse la charge. Vérifiez le réglage dans son application ou sur le boîtier, ou faites poser un booster compatible.',
    'Booster de charge DC-DC compatible lithium'), ['Oui, lithium', 'Non, plomb ou AGM']],
  shop('Le coupleur de charge en roulant est en défaut.',
    'La tension monte mais la batterie reste vide : l’atelier contrôle le coupleur, les câbles et la batterie.', 'Contrôle de la charge en roulant à l’atelier')
);

// no12v → new answer « Un fusible grille dès que je le remets ».
const FUSE_BLOWS = funnel(
  ['Débranchez tout ce qui est branché sur les prises 12 V et éteignez les appareils de ce circuit, puis remettez un fusible du même calibre. Le fusible tient-il ?', buy('Un appareil branché provoquait le court-circuit.',
    'Rebranchez les appareils un par un : celui qui fait griller le fusible est en panne, ne l’utilisez plus.', 'Fusibles plats assortis', FUSE_SEC), ['Oui, il tient', 'Non, il grille encore']],
  ['Le porte-fusible est-il vert, noirci ou desserré ?', buy('Le porte-fusible oxydé faisait chauffer le fusible.',
    'Coupe-batterie coupé, nettoyez-le avec un spray pour contacts. S’il est noirci ou fondu, faites-le changer par l’atelier.', 'Spray pour contacts électriques', FUSE_SEC), ['Oui', 'Non']],
  shop('Un court-circuit se trouve sur ce circuit.',
    'Laissez ce circuit coupé. L’atelier cherche le câble ou l’appareil en court-circuit.', 'Recherche de court-circuit à l’atelier', FUSE_SEC)
);

// no230 → « Ça disjoncte »: first, which breaker trips.
const POST_TRIPS = funnel(
  ['Éteignez les gros appareils (chauffage électrique, bouilloire, clim, sèche-cheveux) et faites réarmer la borne. Tient-elle ?', buy('La borne limite la puissance.',
    'Les bornes donnent souvent 6, 10 ou 16 A (environ 1 300 à 3 600 W) : allumez un seul gros appareil à la fois. Un wattmètre de prise montre ce que vous consommez.', 'Wattmètre de prise'), ['Oui, elle tient', 'Non, elle disjoncte encore']],
  ['Votre câble est-il resté enroulé sur son enrouleur, ou est-il fin ?', buy('Le câble enroulé chauffe et fait disjoncter.',
    'Déroulez toujours le câble en entier, et prenez un câble de 3 × 2,5 mm² avec des prises étanches.', 'Câble 230 V 3 × 2,5 mm² avec enrouleur', V230_SEC), ['Oui', 'Non, il est déroulé']],
  ['La fiche, la prise du véhicule ou la rallonge sont-elles mouillées ?', buy('L’humidité sur la fiche provoque un défaut d’isolement.',
    'Débranchez, laissez sécher, puis protégez la fiche avec un capuchon étanche.', 'Capuchon de protection étanche pour prise 230 V', V230_SEC), ['Oui', 'Non']],
  ['Branchez-vous sur une autre borne. Ça disjoncte encore ?', buy('La première borne est en défaut.',
    'Prévenez l’accueil. Un testeur de prise 230 V vérifie une borne (terre, polarité) avant de brancher le véhicule.', 'Testeur de prise 230 V'), ['Non, ça tient', 'Oui, encore']],
  shop('L’installation 230 V du véhicule a un défaut d’isolement.',
    'Elle fait disjoncter toutes les bornes : ne la branchez plus. L’atelier contrôle l’installation.', 'Contrôle de l’installation 230 V à l’atelier', V230_SEC)
);

module.exports = { DRIVING_END, FUSE_BLOWS, POST_TRIPS };
