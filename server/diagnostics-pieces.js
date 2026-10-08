'use strict';

// Diagnostics written from the composition of the equipment (spare-parts catalogues): the customer tests,
// one component at a time, and the conclusion names the part that is at fault. No part reference here:
// the store or the workshop chooses the part and the checks to make.

const ATELIER = 'Aucun produit : atelier';
const NONE = 'Aucun produit nécessaire';

const porteVelos = {
  id: 'h_portevelos',
  cat: 'ext',
  label: 'Mon porte-vélos est dur, bouge ou il lui manque une pièce',
  eq: 'velos',
  kw:
    'porte-vélos porte vélos porte-vélo rail sangle bras de maintien cale roue dur à déplier replier grippé bouge vibre bruit en roulant ' +
    'fixation paroi charge maximale poids vélos électriques pièce cassée perdue',
  tree: {
    t: 'Que se passe-t-il avec votre porte-vélos ?',
    o: ['Il est dur à déplier ou à replier', 'Il bouge, vibre ou fait du bruit en roulant', 'Une sangle, un bras ou une cale est cassé ou perdu', 'Combien de poids puis-je mettre dessus ?'],
    n: [
      {
        t: 'Les articulations sont-elles sales, sèches ou rouillées ?',
        o: ['Oui', 'Non, elles sont propres'],
        n: [
          { cause: 'Les articulations du porte-vélos sont grippées par la poussière et le sel.', geste: 'Rincez à l’eau claire, séchez, puis mettez un peu de lubrifiant sec sur les articulations.', prod: 'Lubrifiant sec (PTFE)', sec: null },
          { cause: 'Une pièce du porte-vélos est faussée.', geste: 'Ne forcez pas : faites-le contrôler, la plupart de ses pièces se remplacent.', prod: ATELIER, sec: null, rdv: 'atelier' },
        ],
      },
      {
        t: 'Les vélos sont-ils bien serrés (sangles des roues et bras de maintien) ?',
        o: ['Non : je les ai resserrés et plus rien ne bouge', 'Oui, ils sont bien serrés'],
        n: [
          { cause: 'Les vélos n’étaient pas assez serrés sur le porte-vélos.', geste: 'Resserrez sangles et bras de maintien au départ et à la première pause.', prod: NONE, sec: 'Un vélo qui se détache en roulant est très dangereux : vérifiez à chaque arrêt.' },
          {
            t: 'Est-ce le porte-vélos lui-même qui bouge sur la carrosserie ?',
            o: ['Oui', 'Non'],
            n: [
              {
                cause: 'Les fixations du porte-vélos sur la paroi se sont desserrées.',
                geste: 'Ne roulez plus avec des vélos dessus : faites resserrer les fixations et contrôler leur étanchéité à l’atelier.',
                prod: ATELIER,
                sec: 'Ne roulez jamais chargé avec un porte-vélos qui bouge.',
                pro: true,
                rdv: 'atelier',
              },
              { cause: 'Une cale du porte-vélos est usée.', geste: 'Faites remplacer la cale ou le rail usé : ils laissent du jeu aux vélos.', prod: 'Pièce de rechange du porte-vélos', sec: null, rdv: 'atelier' },
            ],
          },
        ],
      },
      {
        cause: 'Les pièces de maintien du porte-vélos s’usent avec le temps.',
        geste: 'Sangles, bras et cales se remplacent : notez la marque et le modèle de votre porte-vélos (étiquette sur le cadre) et demandez la pièce à votre magasin.',
        prod: 'Pièce de rechange du porte-vélos',
        sec: 'Ne roulez pas avec un vélo sans sa sangle ou son bras de maintien.',
      },
      {
        cause: 'Chaque porte-vélos a une charge maximale inscrite sur son étiquette.',
        geste: 'Elle est souvent de 35 à 60 kg. Pesez vos vélos (un vélo électrique dépasse souvent 20 kg) et retirez leurs batteries pour rouler.',
        prod: NONE,
        sec: 'Trop de poids à l’arrière allège l’avant du véhicule et rend la conduite dangereuse.',
      },
    ],
  },
};

// Store: the parts that wear (locking, crank and its end piece, roller drive, foot lock, caps).
const STORE_BRANCHES = [
  {
    option: 'Mon store s’ouvre un peu en roulant ou ne reste pas fermé',
    kw: 'store s’ouvre en roulant ne reste pas fermé verrouillage verrou descend tout seul sangle',
    node: {
      t: 'Rentrez le store à fond puis tirez doucement sur la barre. Reste-t-il fermé ?',
      o: ['Non, il redescend', 'Oui, mais il s’ouvre quand même en roulant'],
      n: [
        {
          cause: 'Le verrouillage du store est usé.',
          geste: 'Maintenez le store fermé avec une sangle en attendant la réparation, et passez à l’atelier.',
          prod: 'Sangle de maintien',
          sec: 'Un store qui s’ouvre en roulant peut s’arracher : arrêtez-vous dès que vous le voyez bouger.',
          rdv: 'atelier',
        },
        {
          cause: 'Les verrous du store sont déréglés.',
          geste: 'Rentrez-le jusqu’à la butée (un tour de manivelle de plus) puis faites régler les verrous à l’atelier.',
          prod: ATELIER,
          sec: 'Un store qui s’ouvre en roulant peut s’arracher : arrêtez-vous dès que vous le voyez bouger.',
          rdv: 'atelier',
        },
      ],
    },
  },
  {
    option: 'La manivelle tourne dans le vide ou ne s’emboîte plus',
    kw: 'manivelle tourne dans le vide ne s’emboîte plus glisse embout mécanisme rouleau store ne bouge pas manivelle perdue',
    node: {
      t: 'La manivelle s’emboîte-t-elle bien au bout du store ?',
      o: ['Non, elle glisse ou ne tient pas', 'Oui, mais le store ne bouge pas'],
      n: [
        {
          cause: 'L’embout qui reçoit la manivelle est usé.',
          geste: 'Chaque modèle de store a sa propre manivelle : notez le modèle (étiquette sur le caisson) et faites vérifier la manivelle et l’embout au magasin.',
          prod: 'Manivelle adaptée à votre store',
          sec: null,
        },
        {
          cause: 'Le mécanisme qui fait tourner le rouleau du store est cassé.',
          geste: 'N’insistez pas pour ne pas abîmer la toile : passez à l’atelier.',
          prod: ATELIER,
          sec: 'Les bras du store sont sous tension : ne les démontez jamais.',
          pro: true,
          rdv: 'atelier',
        },
      ],
    },
  },
  {
    option: 'Un pied du store ne se bloque plus ou glisse',
    kw: 'pied de store ne se bloque plus glisse blocage pied support pied',
    node: {
      cause: 'Le blocage du pied du store est usé.',
      geste: 'Rentrez le store ou calez le pied en attendant : la pièce de blocage se remplace au magasin.',
      prod: 'Blocage de pied de store',
      sec: 'Un store sorti doit toujours reposer sur ses deux pieds bloqués : rentrez-le s’il y a du vent.',
    },
  },
  {
    option: 'Un cache ou un embout du store est cassé ou a disparu',
    kw: 'cache store embout cassé perdu flasque capot',
    node: {
      cause: 'Un cache du store est cassé.',
      geste: 'Les caches protègent le mécanisme de l’eau et de la poussière : faites-les remplacer au magasin en notant le modèle du store.',
      prod: 'Cache ou embout de store',
      sec: null,
    },
  },
];

module.exports = { NEW_DIAGNOSTICS: [porteVelos], STORE_BRANCHES };
