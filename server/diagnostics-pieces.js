'use strict';

// Diagnostics written from the composition of the equipment (spare-parts catalogues): the customer tests,
// one component at a time, and the conclusion names the part that is at fault. No part reference here:
// the store or the workshop chooses the part and the checks to make.

const ATELIER = 'Aucun produit : atelier';
const NONE = 'Aucun produit nécessaire';
const CO = 'Ne faites jamais tourner un groupe dans un endroit fermé ou près d’une fenêtre ouverte : ses gaz d’échappement sont mortels.';

const groupe = {
  id: 'g_groupe',
  cat: 'elec',
  label: 'Mon groupe électrogène ne démarre pas (ou a un souci)',
  eq: 'groupe',
  kw:
    'groupe électrogène générateur groupe ne démarre pas groupe s’arrête pas de 230 V groupe fixe groupe portable gaz gazole essence ' +
    'huile niveau d’huile starter bougie filtre à air surcharge disjoncteur voyant fumée odeur bruit vibrations batterie démarreur réservoir quart',
  tree: {
    t: 'Que se passe-t-il avec votre groupe électrogène ?',
    o: ['Il ne démarre pas', 'Il démarre puis s’arrête', 'Il tourne mais je n’ai pas de 230 V', 'Il fume, sent fort ou fait un bruit inhabituel'],
    n: [
      {
        t: 'Quel est votre groupe ?',
        o: ['Un groupe fixe (dans une soute ou sous le plancher)', 'Un groupe portable (posé par terre)'],
        n: [
          {
            t: 'Quand vous appuyez sur « marche », entendez-vous le démarreur essayer de lancer le moteur ?',
            o: ['Non, rien ne se passe', 'Oui, le moteur tourne mais ne part pas'],
            n: [
              {
                t: 'Rechargez la batterie (en roulant ou branché au secteur) : le groupe s’en sert pour démarrer. Démarre-t-il ensuite ?',
                o: ['Oui, c’est réglé', 'Non'],
                n: [
                  { cause: 'La batterie était trop faible pour lancer le groupe.', geste: 'Gardez la batterie bien chargée avant de lancer le groupe.', prod: NONE, sec: null },
                  {
                    t: 'Regardez le fusible du groupe (sur sa commande ou près de la batterie). Est-il grillé ?',
                    o: ['Oui, je l’ai remplacé et le groupe démarre', 'Non, ou je ne le trouve pas'],
                    n: [
                      { cause: 'Le fusible du groupe était grillé.', geste: 'Remplacez-le par un fusible de même calibre. S’il grille de nouveau, faites contrôler le groupe.', prod: 'Fusibles plats de même calibre', sec: null },
                      { cause: 'Le démarreur du groupe est en défaut.', geste: 'Passez à l’atelier : il contrôlera la commande et le démarreur.', prod: ATELIER, sec: null, pro: true, rdv: 'atelier' },
                    ],
                  },
                ],
              },
              {
                t: 'Avec quoi fonctionne votre groupe ?',
                o: ['Au gaz', 'Au gazole (réservoir du véhicule)', 'À l’essence'],
                n: [
                  {
                    t: 'La bouteille est-elle pleine, son robinet ouvert, et le robinet de gaz du groupe ouvert ?',
                    o: ['Non : je l’ai ouvert et le groupe démarre', 'Oui, tout est ouvert'],
                    n: [
                      { cause: 'Le gaz n’arrivait pas au groupe.', geste: 'Ouvrez la bouteille et le robinet du groupe avant chaque mise en marche.', prod: 'Bouteille de gaz pleine', sec: 'Odeur de gaz : fermez la bouteille, aérez et n’actionnez aucun interrupteur.' },
                      {
                        cause: 'L’alimentation en gaz du groupe est en défaut.',
                        geste: 'N’insistez pas au-delà de trois essais : passez à l’atelier.',
                        prod: ATELIER,
                        sec: 'Odeur de gaz : fermez la bouteille, aérez et n’actionnez aucun interrupteur.',
                        pro: true,
                        rdv: 'atelier',
                      },
                    ],
                  },
                  {
                    t: 'Le réservoir du véhicule est-il au moins au quart ?',
                    o: ['Non, il est presque vide', 'Oui'],
                    n: [
                      { cause: 'Le réservoir du véhicule est trop bas pour le groupe.', geste: 'Le groupe arrête de puiser vers un quart de réservoir pour vous laisser de quoi rouler : faites le plein puis relancez-le.', prod: NONE, sec: null },
                      { cause: 'Le gazole n’arrive pas jusqu’au groupe.', geste: 'Passez à l’atelier : il contrôlera le filtre et la pompe du groupe.', prod: ATELIER, sec: null, pro: true, rdv: 'atelier' },
                    ],
                  },
                  {
                    t: 'Y a-t-il de l’essence dans le réservoir du groupe ?',
                    o: ['Non : j’ai fait le plein et il démarre', 'Oui'],
                    n: [
                      { cause: 'Le réservoir d’essence du groupe était vide.', geste: 'Faites le plein moteur arrêté et froid.', prod: 'Essence sans plomb', sec: 'Ne faites jamais le plein d’un groupe chaud ou en marche.' },
                      { cause: 'La bougie du groupe est encrassée.', geste: 'Faites contrôler la bougie et le carburant à l’atelier.', prod: ATELIER, sec: null, rdv: 'atelier' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            t: 'Y a-t-il de l’essence dans le réservoir, et le robinet d’essence est-il ouvert ?',
            o: ['Non : j’ai fait le plein et ouvert le robinet, il démarre', 'Oui'],
            n: [
              { cause: 'L’essence n’arrivait pas au moteur du groupe.', geste: 'Vérifiez le plein et ouvrez le robinet d’essence avant de tirer le lanceur.', prod: 'Essence sans plomb', sec: 'Ne faites jamais le plein d’un groupe chaud ou en marche.' },
              {
                t: 'Groupe posé à plat, regardez la jauge d’huile. Le niveau est-il bas ?',
                o: ['Oui : j’ai complété et il démarre', 'Non, le niveau est bon'],
                n: [
                  { cause: 'Le niveau d’huile était trop bas : le groupe refusait de démarrer par sécurité.', geste: 'Contrôlez le niveau d’huile avant chaque séjour, groupe à plat.', prod: 'Huile moteur indiquée dans la notice du groupe', sec: null },
                  {
                    t: 'Moteur froid, mettez le starter puis relancez. Le groupe démarre-t-il ?',
                    o: ['Oui, c’est réglé', 'Non'],
                    n: [
                      { cause: 'Le starter n’était pas mis pour un démarrage moteur froid.', geste: 'Mettez le starter pour démarrer à froid, puis retirez-le dès que le moteur tourne régulièrement.', prod: NONE, sec: null },
                      { cause: 'La bougie du groupe est encrassée.', geste: 'Faites contrôler la bougie à l’atelier, surtout si le groupe est resté plusieurs mois sans servir.', prod: ATELIER, sec: null, rdv: 'atelier' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        t: 'Quand s’arrête-t-il ?',
        o: ['Au bout de quelques secondes', 'Quand je branche un appareil', 'Après avoir tourné un moment'],
        n: [
          {
            t: 'Groupe posé à plat, le niveau d’huile est-il bas ?',
            o: ['Oui : j’ai complété et il tourne', 'Non, il est bon'],
            n: [
              { cause: 'Le niveau d’huile était trop bas : le groupe s’arrêtait par sécurité.', geste: 'Contrôlez le niveau d’huile avant chaque séjour, groupe à plat.', prod: 'Huile moteur indiquée dans la notice du groupe', sec: null },
              { cause: 'Le filtre à air du groupe est encrassé.', geste: 'Faites nettoyer ou remplacer le filtre à air à l’atelier.', prod: ATELIER, sec: null, rdv: 'atelier' },
            ],
          },
          {
            cause: 'L’appareil branché demande plus de puissance que le groupe ne peut en donner.',
            geste: 'Ne faites marcher qu’un gros appareil à la fois (clim, bouilloire, sèche-cheveux, micro-ondes).',
            prod: NONE,
            sec: null,
          },
          {
            t: 'Les grilles du groupe sont-elles dégagées et sa trappe bien ouverte ?',
            o: ['Non : je les ai dégagées et il tourne', 'Oui'],
            n: [
              { cause: 'Le groupe chauffait faute d’air.', geste: 'Gardez ses grilles dégagées et laissez-le refroidir avant de le relancer.', prod: NONE, sec: CO },
              { cause: 'Le groupe a un défaut qui le fait s’arrêter.', geste: 'Vérifiez d’abord le carburant, puis passez à l’atelier.', prod: ATELIER, sec: null, pro: true, rdv: 'atelier' },
            ],
          },
        ],
      },
      {
        t: 'Le voyant de surcharge du groupe est-il allumé, ou son disjoncteur est-il sorti ?',
        o: ['Oui', 'Non'],
        n: [
          {
            cause: 'Le groupe a coupé son courant pour se protéger d’une surcharge.',
            geste: 'Débranchez les appareils, réarmez le groupe (ou arrêtez-le et relancez-le), puis rebranchez-les un par un.',
            prod: NONE,
            sec: null,
          },
          {
            t: 'Le véhicule est-il bien relié au groupe (câble branché, ou commutateur sur « groupe ») ?',
            o: ['Non : je l’ai relié et le 230 V revient', 'Oui'],
            n: [
              { cause: 'Le courant du groupe n’arrivait pas au véhicule.', geste: 'Branchez le câble sur la prise du groupe, ou mettez le commutateur sur « groupe ».', prod: NONE, sec: null },
              {
                t: 'Au tableau électrique du véhicule, le disjoncteur 230 V est-il baissé ?',
                o: ['Oui : je l’ai remonté et le 230 V revient', 'Non'],
                n: [
                  { cause: 'Le disjoncteur 230 V du véhicule avait sauté.', geste: 'S’il saute de nouveau, débranchez vos appareils un par un pour trouver celui qui est en défaut.', prod: NONE, sec: null },
                  { cause: 'Le groupe ne produit plus de courant.', geste: 'Passez à l’atelier.', prod: ATELIER, sec: 'Ne démontez jamais la prise ni le boîtier du groupe : il produit du 230 V.', pro: true, rdv: 'atelier' },
                ],
              },
            ],
          },
        ],
      },
      {
        t: 'Que constatez-vous ?',
        o: ['De la fumée bleue ou noire', 'Une odeur de gaz ou d’essence', 'Un bruit inhabituel ou des vibrations'],
        n: [
          {
            cause: 'Le moteur du groupe brûle mal son carburant.',
            geste: 'Arrêtez le groupe, vérifiez le niveau d’huile, puis faites contrôler le filtre à air et le réglage à l’atelier.',
            prod: ATELIER,
            sec: CO,
            rdv: 'atelier',
          },
          {
            cause: 'Le groupe a une fuite de carburant.',
            geste: 'Arrêtez-le tout de suite, fermez le gaz ou le robinet d’essence, aérez, et ne le relancez pas avant un contrôle.',
            prod: ATELIER,
            sec: 'Pas de flamme ni de cigarette à proximité. Odeur de gaz dans la cellule : sortez et appelez un professionnel.',
            pro: true,
            rdv: 'atelier',
            urgent: true,
          },
          {
            cause: 'Une fixation du groupe s’est desserrée.',
            geste: 'Arrêtez-le et faites contrôler ses fixations et ses supports anti-vibrations.',
            prod: ATELIER,
            sec: null,
            rdv: 'atelier',
          },
        ],
      },
    ],
  },
};

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

module.exports = { NEW_DIAGNOSTICS: [groupe, porteVelos], STORE_BRANCHES };
