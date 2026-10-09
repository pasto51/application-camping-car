'use strict';

// Problems reported by customers of the dealership (October 2026): key and lock cylinder (Zadi), pleated blinds and fly
// screens (cord, rollers and hooks), absorption fridge that frosts or does not cool enough, water leaks (FrostControl).
// Written from the manufacturers' instructions and camping-car forums, as funnels (see diag-helpers.js): each end point
// names a product sold in a camping-car accessory store, or sends to the workshop when the customer must not do it alone.

const { buy, shop, funnel, ask } = require('./diag-helpers');

const LUBE = 'Lubrifiant spécial serrures et barillets';
const CORD = 'Kit de cordon de rechange pour store plissé (selon la marque)';
const SILICONE = 'Spray silicone pour rails et glissières';
const FANS = 'Kit de ventilateurs 12 V à thermostat pour grille de réfrigérateur';
const GEL_SEC = 'Après un gel, faites contrôler le circuit à l’atelier avant de le remettre sous pression.';
const NO_GRID = 'Ne roulez jamais et n’utilisez jamais le frigo au gaz sans ses grilles : elles évacuent les gaz brûlés.';

// Model of the Zadi cylinder, then the cylinder that goes with it (asked where the cylinder has to be changed).
const zadiCylinder = () =>
  ask('Votre barillet Zadi est-il un modèle standard ou haute sécurité ? (le magasin les distingue par leur couleur : rouge pour le standard, vert pour la haute sécurité)', [
    ['Standard (rouge)', buy('Le barillet standard est usé.',
      'Serrure déverrouillée, le barillet se retire avec la clé d’extraction qui correspond à sa série, et un barillet neuf se met à la place, livré avec ses deux clés. La clé d’extraction ne marche que serrure ouverte : elle n’ouvre pas une serrure fermée.',
      'Barillet Zadi standard avec 2 clés et clé d’extraction')],
    ['Haute sécurité (vert)', buy('Le barillet haute sécurité est usé.',
      'Serrure déverrouillée, le barillet se retire avec la clé d’extraction qui correspond à sa série, puis un barillet haute sécurité neuf se met à la place. Demandez au magasin la clé d’extraction qui va avec votre barillet.',
      'Barillet Zadi haute sécurité avec 2 clés et clé d’extraction')],
    ['Je ne sais pas', buy('Le modèle du barillet n’est pas identifié.',
      'Apportez une clé et une photo de la serrure au magasin : il reconnaît le modèle (standard ou haute sécurité) et vous donne le barillet et la clé d’extraction qui vont ensemble.',
      'Barillet Zadi du bon modèle avec ses clés')],
  ]);

// Absorption fridge that does not cool enough: from the simplest check to the workshop.
const absorptionHot = () =>
  funnel(
    ['Les caches d’hiver sont-ils encore posés sur les grilles extérieures du frigo ?', buy('Les caches d’hiver bloquent l’air du frigo.',
      'Retirez les caches d’hiver dès que les beaux jours reviennent (au-dessus d’environ 8 °C dehors) : l’air chaud sort de nouveau par la grille du haut et le frigo refait du froid en quelques heures. Gardez-les pour l’hiver.',
      'Aucun produit nécessaire'), ['Oui, ils sont posés', 'Non']],
    ['Les grilles extérieures sont-elles encrassées (poussière, toiles d’araignée, insectes) ?', buy('Les grilles encrassées empêchent la chaleur de sortir.',
      'Frigo éteint et refroidi, retirez les grilles et dépoussiérez-les avec une brosse douce et un aérosol dépoussiérant, ainsi que les ailettes que vous voyez par l’ouverture. Ne touchez ni au brûleur ni à la cheminée. Remettez les grilles.',
      'Aérosol dépoussiérant et brosse douce pour grilles de réfrigérateur', NO_GRID), ['Oui, elles sont encrassées', 'Non, elles sont propres']],
    ['Posez un niveau à bulle dans le frigo : le véhicule penche-t-il ?', buy('Le frigo à absorption perd son froid quand il penche.',
      'Mettez le véhicule à plat avec des cales : au-delà d’environ 3 degrés d’inclinaison, le froid baisse beaucoup.',
      'Cales de nivellement avec niveau à bulle'), ['Oui, il penche', 'Non, il est à plat']],
    ['Le côté du frigo est-il en plein soleil ?', buy('Le soleil sur la paroi du frigo bloque son refroidissement.',
      'Un frigo à absorption perd du froid au-delà d’environ 32 °C dehors. Garez-vous côté frigo à l’ombre si possible. Des ventilateurs 12 V à thermostat, fixés sur la grille du haut, chassent l’air chaud de derrière le frigo : le magasin vous conseille le modèle qui va sur votre grille.',
      FANS), ['Oui, en plein soleil', 'Non, il est à l’ombre']],
    ['Fermez la porte sur une feuille de papier : la feuille résiste-t-elle tout autour ?', buy('Le joint de porte laisse entrer l’air chaud.',
      'Un joint écrasé ou déchiré laisse sortir le froid. Changez-le au modèle du frigo (plaque à l’intérieur).',
      'Joint de porte de réfrigérateur au modèle'), ['Non, la feuille glisse quelque part', 'Oui, elle résiste partout']],
    shop('La cheminée du frigo est encrassée.',
      'Grilles propres, véhicule à plat et joint bon, un froid toujours faible vient souvent de la cheminée (suie du brûleur au gaz) ou du groupe froid. L’atelier les contrôle et les nettoie.',
      'Nettoyage de la cheminée et contrôle du réfrigérateur à l’atelier',
      'Si vous voyez de la suie ou sentez une odeur de gaz, fermez la bouteille et n’utilisez plus le gaz avant le contrôle.')
  );

const compressorHot = () =>
  funnel(
    ['Dégagez la grille d’aération du compresseur (sac, rangement posé devant). Le frigo refroidit-il mieux ?', buy('La grille d’aération du compresseur était cachée.',
      'Laissez toujours cette grille dégagée. Dans un meuble fermé, un petit ventilateur d’appoint aide beaucoup l’été.',
      'Ventilateur d’appoint 12 V pour réfrigérateur')],
    ['La batterie cellule est-elle sous 12 V (panneau de contrôle) ?', buy('La batterie cellule est trop basse pour le compresseur.',
      'Le compresseur ralentit ou s’arrête quand la batterie baisse. Rechargez-la (230 V, moteur ou solaire) ; un moniteur de batterie vous prévient avant.',
      'Moniteur de batterie'), ['Oui, sous 12 V', 'Non, au-dessus']],
    shop('Le compresseur du frigo manque de puissance.',
      'Grille dégagée et batterie bonne, le froid reste faible : l’atelier contrôle le compresseur, son ventilateur et le thermostat.',
      'Contrôle du réfrigérateur à l’atelier')
  );

const CLIENTS_2026_10 = [
  {
    id: 'p_serrure',
    cat: 'ext',
    label: 'Ma clé coince, est cassée ou perdue (porte de cellule, soutes)',
    kw: 'clé cle barillet serrure zadi porte cellule soute coffre coince grippe dure bloque cassée casse perdue perdu double extracteur extraction rouge vert haute sécurité tourne dans le vide',
    tree: ask('Que se passe-t-il ?', [
      ['La clé entre mais tourne difficilement ou se bloque', funnel(
        ['Pulvérisez un lubrifiant spécial serrures dans le barillet, puis faites jouer la clé une dizaine de fois. Est-ce réglé ?', buy('Le barillet était encrassé par la poussière et l’humidité.',
          'Relubrifiez le barillet deux fois par an. N’utilisez pas d’huile ordinaire : elle colle la poussière et finit par bloquer la serrure.', LUBE)],
        ['Essayez le double de la clé. Tourne-t-il mieux ?', buy('La clé est usée.',
          'Une clé usée accroche dans un barillet sain. Apportez-la au magasin avec le numéro gravé dessus : selon le modèle, il commande une clé à ce numéro, sinon un kit de barillets neufs.',
          'Clé Zadi au numéro de votre barillet (ou kit de barillets neufs)'), ['Oui, le double tourne bien', 'Non, pareil']],
        zadiCylinder()
      )],
      ['La clé est cassée', ask('Où est le morceau cassé ?', [
        ['Un morceau est resté dans la serrure', ask('La serrure est-elle déverrouillée (porte ou soute ouverte) ?', [
          ['Oui, elle est ouverte', buy('Le morceau de clé bloque le barillet.',
            'Ne tirez pas le morceau avec une pince : vous abîmeriez la serrure. Serrure déverrouillée, retirez le barillet avec la clé d’extraction qui correspond à sa série et posez un barillet neuf : le morceau part avec l’ancien.',
            'Barillet Zadi neuf et clé d’extraction de la même série')],
          ['Non, elle est fermée à clé', shop('Le barillet fermé ne peut pas être extrait.',
            'La clé d’extraction ne fonctionne que serrure ouverte : ne forcez pas la porte. L’atelier l’ouvre sans abîmer la carrosserie, puis change le barillet.',
            'Barillet Zadi neuf du même modèle, posé par l’atelier')],
        ])],
        ['La clé est cassée hors de la serrure', buy('Il vous reste une seule clé du barillet.',
          'Faites faire un double tant que vous en avez une. Apportez la clé restante au magasin, avec le numéro gravé dessus : selon le modèle, il commande une clé à ce numéro, sinon il vous propose un kit de barillets neufs avec leurs clés.',
          'Clé Zadi au numéro de votre barillet (ou kit de barillets neufs)')],
      ])],
      ['J’ai perdu une clé ou je veux un double', ask('Avez-vous encore une clé de cette serrure ou son numéro (gravé sur la clé ou sur la carte des clés) ?', [
        ['Oui, une clé ou le numéro', buy('Il manque une clé à votre jeu.',
          'Apportez la clé restante ou son numéro au magasin : selon le modèle, il commande une clé ou un barillet à ce numéro, pour qu’une serrure neuve s’ouvre avec vos clés actuelles. Sinon, un kit de barillets identiques remplace toutes les serrures.',
          'Clé ou barillet Zadi au numéro de vos serrures')],
        ['Non, plus rien', buy('Sans clé ni numéro le barillet doit être remplacé.',
          'Si la porte est fermée, faites-la ouvrir par l’atelier. Ensuite, un kit de barillets identiques se pose sur la porte et les soutes : une seule clé ouvre tout, et la clé perdue ne sert plus à personne.',
          'Kit de barillets Zadi identiques avec 2 clés')],
      ])],
      ['La clé tourne dans le vide et la porte ne s’ouvre pas', funnel(
        ['Clé tournée, poussez la porte vers l’intérieur en même temps (le joint la tient parfois coincée). La porte s’ouvre-t-elle ?', buy('Le joint serré coinçait le pêne de la porte.',
          'Entretenez le joint et le pêne avec un lubrifiant silicone : la serrure s’ouvre ensuite sans forcer.', 'Lubrifiant silicone pour joints et serrures')],
        ['Essayez la poignée intérieure. La porte s’ouvre-t-elle de l’intérieur ?', shop('La tringle derrière le barillet est décrochée.',
          'La serrure marche de l’intérieur mais le barillet n’entraîne plus le mécanisme. L’atelier remet la tringle en place.',
          'Remise en état de la serrure à l’atelier'), ['Oui, elle s’ouvre de l’intérieur', 'Non, ni dedans ni dehors']],
        shop('Le mécanisme de la serrure est cassé.',
          'Ne forcez pas la porte. L’atelier l’ouvre sans abîmer la carrosserie et change la serrure.',
          'Serrure complète du même modèle, posée par l’atelier')
      )],
      ['Je veux une seule clé pour toutes les serrures', buy('Chaque serrure a son propre barillet.',
        'Un kit de barillets identiques (5 ou 10, avec 2 clés) se pose serrures ouvertes avec la clé d’extraction : une seule clé pour la porte et toutes les soutes. Il existe en modèle standard et en haute sécurité.',
        'Kit de barillets Zadi identiques avec 2 clés')],
    ]),
  },
  {
    id: 'p_storeplisse',
    cat: 'ext',
    label: 'Mon store plissé ou ma moustiquaire (fenêtre, porte, lanterneau, pare-brise) : bloqué, cordon cassé, roulettes ou accroches qui lâchent',
    kw: 'store plissé remis remiflair remitop occultant rideau moustiquaire skydome cordon ficelle fil cassé détendu roulette roulettes accroche accroches patin rail glissière lâche décroche toile déchirée lanterneau fenêtre baie porte pare-brise cabine remonte descend tout seul bloqué bloque tombe travers coulisse mal dur',
    tree: ask('Qu’est-ce qui ne va pas ?', [
      ['Un cordon (ficelle) est cassé, ou le store pend de travers', funnel(
        ['Regardez les deux côtés du store : un cordon est-il cassé ou sorti de son passage ?', ask('Sur quel store ?', [
          ['Fenêtre ou lanterneau', buy('Le cordon de tension est usé.',
            'Avant d’enlever l’ancien cordon, notez par où il passe. Le cordon neuf se passe dans les mêmes trous (une longue aiguille aide), puis se noue bien tendu sur son point de réglage (souvent en bas du store). Comptez une heure, ou faites-le faire par le magasin.',
            CORD)],
          ['Moustiquaire de porte', buy('Le cordon de la moustiquaire plissée est cassé.',
            'Même principe qu’un store de fenêtre : notez le passage du cordon, remplacez-le et tendez-le sur son point de réglage. Si la toile est abîmée elle aussi, une moustiquaire de porte neuve se pose à la place.',
            'Kit de cordon de rechange pour moustiquaire plissée')],
          ['Store du pare-brise (cabine)', buy('Le cordon du store de pare-brise est cassé.',
            'Changer tout le store de cabine coûte très cher : un recordage suffit le plus souvent. Le magasin le fait, ou vous fournit le kit de cordons à la longueur de votre store.',
            'Kit de cordons de rechange pour store de pare-brise plissé')],
        ]), ['Oui, un cordon est cassé', 'Non, ils sont entiers']],
        ['Retendez les cordons sur leur point de réglage (souvent en bas du store). Le store tient-il droit ?', buy('Les cordons du store s’étaient détendus.',
          'Retendez-les à chaque début de saison. Un cordon effiloché finit par casser : changez-le en même temps.', CORD)],
        shop('Le mécanisme du store est abîmé.',
          'Cordons entiers et tendus, le store pend toujours : ne forcez pas. L’atelier le répare ou pose un store neuf aux dimensions.',
          'Réparation du store ou store neuf, posé par l’atelier')
      )],
      ['Le store est bloqué : il ne monte ni ne descend plus', funnel(
        ['Sans tirer sur la toile, regardez les côtés : un cordon est-il cassé ou coincé ?', buy('Un cordon coincé bloque le store.',
          'Ne tirez pas sur la toile et ne forcez pas : les plis et la cassette casseraient. Laissez le store où il est, photographiez-le avec ses côtés et montrez la photo au magasin : il vous donne le kit de cordon de votre store, ou fait le recordage.',
          CORD), ['Oui, un cordon est cassé ou coincé', 'Non, je ne vois rien']],
        ['Une roulette ou un patin est-il sorti du rail ? Remettez-le doucement dans le rail. Le store bouge-t-il de nouveau ?', buy('La roulette du store était sortie du rail.',
          'Pulvérisez un peu de spray silicone dans les rails : la roulette glisse sans forcer et ne ressort plus.', SILICONE)],
        shop('Le mécanisme du store est bloqué.',
          'Ne forcez pas : la cassette casserait. L’atelier débloque le store ou pose un store neuf aux dimensions.',
          'Réparation du store ou store neuf, posé par l’atelier')
      )],
      ['Il coulisse mal, il force', funnel(
        ['Dépoussiérez les rails avec une brosse douce, puis pulvérisez un peu de spray silicone. Le store coulisse-t-il mieux ?', buy('Les rails du store étaient encrassés.',
          'Refaites-le à chaque début de saison. Pas d’huile ni de graisse : elles collent la poussière.', SILICONE)],
        ['Manœuvrez le store bien droit, par le milieu de la barre. Coulisse-t-il mieux ?', buy('Le store était manœuvré de biais.',
          'Tirez-le toujours par le milieu de la barre, sans forcer d’un côté : il glisse droit et les cordons s’usent moins.', 'Aucun produit nécessaire')],
        ['Le store se plisse-t-il de travers (un côté plus bas que l’autre) ?', buy('Un cordon détendu fait coulisser le store de travers.',
          'Retendez le cordon du côté bas sur son point de réglage, ou changez-le s’il est effiloché.', CORD), ['Oui, il est de travers', 'Non, il est droit']],
        shop('Le cadre du store frotte.',
          'Rails propres et cordons tendus, le store force encore : l’atelier contrôle le cadre et ses fixations.',
          'Contrôle du store à l’atelier')
      )],
      ['Une roulette ou une accroche a lâché', ask('La roulette (ou l’accroche) est-elle cassée ou seulement sortie de son rail ?', [
        ['Sortie du rail', funnel(
          ['Écartez doucement la toile, remettez la roulette dans le rail et faites glisser le store deux ou trois fois. La roulette tient-elle ?', buy('La roulette était sortie de son rail.',
            'Un spray silicone dans les rails la fait glisser sans forcer, et elle ne ressort plus.', SILICONE), ['Oui, elle tient', 'Non, elle ressort']],
          buy('La roulette du store est usée.',
            'Elle ressort sans cesse : elle est usée. Les roulettes, patins et accroches se vendent en pièces détachées selon la marque du store : apportez la pièce, ou une photo et les dimensions du store, au magasin.',
            'Roulettes et accroches de rechange pour store plissé')
        )],
        ['Cassée ou perdue', buy('La roulette du store est cassée.',
          'Les roulettes, patins et accroches se vendent en pièces détachées selon la marque du store. Apportez la pièce cassée, ou une photo et les dimensions du store, au magasin.',
          'Roulettes et accroches de rechange pour store plissé')],
      ])],
      ['La toile est déchirée ou percée', ask('Le trou est-il petit ou la toile est-elle usée ?', [
        ['Un petit trou', buy('La toile a un petit trou.',
          'Un patch spécial moustiquaire, posé des deux côtés, referme le trou, le store reste en place.', 'Patch de réparation spécial moustiquaire')],
        ['Une grande déchirure ou une toile usée', buy('La toile du store est usée.',
          'Changez le store complet, à la taille de la fenêtre : la dimension est écrite sur l’étiquette de la cassette. Un store neuf se pose dans les mêmes fixations.',
          'Store plissé ou moustiquaire neuf aux dimensions de votre fenêtre')],
      ])],
      ['Le store ne tient plus en place (il remonte ou descend tout seul)', funnel(
        ['Retendez les cordons sur leur point de réglage (souvent en bas du store). Le store tient-il à mi-hauteur ?', buy('Les cordons du store étaient détendus.',
          'Retendez-les à chaque début de saison : un store bien tendu tient à n’importe quelle hauteur.', CORD)],
        ['Un cordon est-il effiloché ou cassé ?', buy('Le cordon de tension est usé.',
          'Un cordon effiloché ne tient plus la tension et finit par casser : changez-le avec un kit de cordon à votre store.', CORD), ['Oui', 'Non']],
        shop('Le ressort du store est fatigué.',
          'Sur les stores à enrouleur, le ressort ne se retend pas soi-même : l’atelier le change ou pose un store neuf.',
          'Store neuf aux dimensions, posé par l’atelier')
      )],
    ]),
  },
  {
    id: 'p_frigochaud',
    cat: 'frigo',
    label: 'Mon frigo givre ou ne refroidit pas assez (surtout quand il fait chaud)',
    eq: 'frigo',
    kw: 'frigo réfrigérateur givre glace freezer refroidit pas assez chaud tiède été canicule absorption trimixte gaz grilles grille ventilateur ventilation cheminée roulant soleil caches hiver',
    tree: ask('Quel est le souci ?', [
      ['Il ne refroidit pas assez quand il fait chaud', {
        t: 'Votre frigo est-il à absorption (il marche au gaz, en 12 V et en 230 V) ?',
        o: ['Oui, il marche aussi au gaz', 'Non, c’est un frigo à compresseur', 'Je ne sais pas'],
        // Answered by itself when the type of fridge is known (« Mes équipements »).
        vk: 'frigo',
        vv: ['trimixte', 'comp', 'ns'],
        n: [
          absorptionHot(),
          compressorHot(),
          ask('Votre frigo a-t-il des grilles dehors, sur la paroi du véhicule ?', [
            ['Oui, deux grilles l’une au-dessus de l’autre', absorptionHot()],
            ['Non, pas de grille dehors', compressorHot()],
          ]),
        ],
      }],
      ['Il givre beaucoup', funnel(
        ['Fermez la porte sur une feuille de papier : la feuille résiste-t-elle tout autour ?', buy('Le joint de porte laisse entrer l’air humide.',
          'L’air humide qui entre par le joint se change en givre. Changez le joint s’il est écrasé ou déchiré : il se vend au modèle du frigo.',
          'Joint de porte de réfrigérateur au modèle'), ['Non, la feuille glisse quelque part', 'Oui, elle résiste partout']],
        ['La porte reste-t-elle souvent ouverte, ou bloquée entrouverte en position de rangement ?', buy('La porte ouverte fait entrer l’air humide.',
          'Ouvrez-la moins longtemps, couvrez les aliments et laissez refroidir les plats avant de les ranger. Une barre de maintien évite de chercher longtemps porte ouverte.',
          'Boîtes de conservation hermétiques'), ['Oui', 'Non']],
        ['Réglez le thermostat au milieu et dégivrez. Le givre revient-il moins vite ?', buy('Le thermostat au maximum faisait givrer la plaque froide.',
          'Gardez le thermostat au milieu et dégivrez une fois par mois en saison : le givre isole et fait perdre du froid. Un thermomètre de frigo aide à trouver le bon réglage.',
          'Thermomètre de réfrigérateur'), ['Oui, c’est mieux', 'Non, il revient aussi vite']],
        shop('La régulation du frigo ne coupe plus le froid.',
          'Le givre revient vite alors que le joint est bon et le réglage moyen : l’atelier contrôle la sonde et la commande du frigo.',
          'Contrôle du réfrigérateur à l’atelier')
      )],
      ['Il ne refroidit pas assez en roulant', funnel(
        ['Le frigo était-il déjà froid au départ (8 heures sur 230 V, ou au gaz à l’arrêt) ?', buy('Le frigo n’était pas assez froid au départ.',
          'Sur 12 V, un frigo à absorption garde le froid sans en refaire beaucoup. Faites-le descendre en température avant de partir ; des accumulateurs de froid aident sur les longs trajets.',
          'Accumulateurs de froid (pains de glace)'), ['Non, je l’allume au départ', 'Oui, il était froid']],
        ['Moteur en marche, le voyant 12 V du frigo est-il allumé ?', shop('Le frigo ne reçoit pas le 12 V en roulant.',
          'Voyez aussi le diagnostic « Mon frigo ne refroidit pas ou peu en 12 V ». L’atelier contrôle le fusible et le relais du frigo.',
          'Contrôle du circuit 12 V du frigo à l’atelier'), ['Non, il est éteint', 'Oui, il est allumé']],
        buy('En roulant le tirage d’air derrière le frigo diminue.',
          'Le 12 V marche bien mais le froid baisse par forte chaleur : des ventilateurs à thermostat sur la grille du haut forcent l’air chaud dehors sur la route.',
          FANS)
      )],
    ]),
  },
  {
    id: 'p_fuite',
    cat: 'eau',
    label: 'J’ai une fuite d’eau ou mon réservoir se vide tout seul',
    eq: 'pompe',
    kw: 'fuite eau coule goutte flaque sous le camping-car vide tout seul réservoir chauffe-eau frost control frostcontrol vanne vidange soupape purge gel gelé dégel truma évier robinet raccord tuyau douche bac fendu wc chasse lame cassette eaux grises trop-plein déborde',
    tree: ask('Où voyez-vous l’eau ?', [
      ['Sous le véhicule, près du chauffe-eau', ask('Sous le chauffe-eau, la vanne de vidange (FrostControl, bouton jaune) est-elle ouverte (bouton sorti) ?', [
        ['Oui, le bouton est sorti', ask('Faisait-il froid (moins de 3 °C environ au niveau de la vanne) ?', [
          ['Oui', buy('La vanne s’est ouverte pour protéger le chauffe-eau du gel.',
            'C’est normal : elle vide le chauffe-eau dès 3 °C environ. Au-dessus de 7 °C, refermez-la (levier tourné parallèle à la vanne, puis bouton enfoncé jusqu’au déclic), chauffez la cellule et remettez l’eau. Un câble chauffant de cuve protège le reste du circuit l’hiver.',
            'Câble chauffant antigel pour réservoir et tuyaux')],
          ['Non', funnel(
            ['Refermez la vanne (levier parallèle, puis bouton enfoncé) et remettez l’eau. La vanne reste-t-elle fermée ?', buy('La vanne de vidange était restée ouverte depuis la dernière vidange.',
              'Après chaque vidange, refermez-la avant de remettre l’eau : levier parallèle à la vanne, puis bouton enfoncé jusqu’au déclic.', 'Aucun produit nécessaire')],
            shop('La soupape de la vanne évacue une surpression.',
              'La vanne lâche l’eau dès que la pression dépasse environ 4,5 bars : une pompe trop puissante (plus de 2,8 bars) ou un vase d’expansion plein d’eau en est souvent la cause. L’atelier contrôle et pose un réducteur de pression si besoin.',
              'Réducteur de pression ou vase d’expansion, posé par l’atelier')
          )],
        ])],
        ['Non, elle est fermée et ça coule quand même', funnel(
          ['Coupez la pompe une heure. Ça coule encore par la vanne ?', buy('Le joint de la vanne de vidange est usé.',
            'Une vanne qui fuit fermée se change entière : elle existe en kit avec les raccords adaptés à vos tuyaux. Gardez la pompe coupée en attendant.',
            'Kit de vanne de vidange FrostControl avec raccords'), ['Oui, par la vanne', 'Non, ça coule ailleurs']],
          shop('Un raccord fuit sous le plancher près du chauffe-eau.',
            'Coupez la pompe et notez où tombent les gouttes. L’atelier trouve le raccord en cause et le change.',
            'Raccords et colliers pour circuit d’eau, posés par l’atelier')
        )],
        ['Je ne trouve pas cette vanne', shop('Une fuite se cache sous le véhicule.',
          'La vanne de vidange se trouve sous le plancher près du chauffe-eau, ou à l’intérieur juste à côté de lui. Coupez la pompe et notez où tombent les gouttes : l’atelier trouve la fuite et change la pièce.',
          'Raccords et colliers pour circuit d’eau, posés par l’atelier')],
      ])],
      ['Sous le véhicule : de l’eau grise qui sent mauvais', funnel(
        ['Fermez la vanne de vidange des eaux grises à fond. La fuite s’arrête-t-elle ?', buy('La vanne de vidange des eaux grises était mal fermée.',
          'Refermez-la à fond après chaque vidange. Une graisse silicone sur son axe la garde douce et étanche.', 'Graisse silicone pour vannes et joints')],
        shop('Le joint de la vanne des eaux grises est usé.',
          'Videz le réservoir d’eaux grises sur une aire de service. L’atelier remplace le joint ou la vanne.',
          'Joint ou vanne de vidange d’eaux grises, posé par l’atelier')
      )],
      ['Juste après avoir rempli le réservoir', ask('Ça coule seulement pendant le remplissage ou juste après ?', [
        ['Oui, seulement au remplissage', buy('Le réservoir d’eau propre déborde par son trop-plein.',
          'C’est normal quand il est plein à ras : arrêtez de remplir dès que l’eau sort du trop-plein. Un pistolet de remplissage à coupure évite d’en mettre partout.',
          'Pistolet de remplissage à coupure et tuyau alimentaire')],
        ['Non, ça continue après', shop('Le réservoir d’eau propre fuit.',
          'Coupez la pompe, séchez et notez d’où l’eau revient. L’atelier contrôle le réservoir et ses raccords.',
          'Recherche de fuite et raccords neufs à l’atelier')],
      ])],
      ['Après une période de gel', ask('Laissez dégeler. Où voyez-vous des traces d’eau ?', [
        ['Sur un tuyau ou un raccord visible', shop('Le gel a fissuré une pièce visible du circuit.',
          'Ne relancez pas la pompe. L’atelier remplace la pièce fissurée. Pour l’hiver suivant, vidangez le circuit ou protégez-le avec un câble chauffant antigel.',
          'Tuyau alimentaire et raccords rapides, posés par l’atelier', GEL_SEC)],
        ['Autour du chauffe-eau', shop('Le gel a abîmé le chauffe-eau.',
          'Ne relancez ni la pompe ni le chauffe-eau. L’atelier contrôle la cuve et la vanne de vidange.',
          'Contrôle du chauffe-eau à l’atelier', GEL_SEC)],
        ['Près de la pompe', shop('La glace a fissuré la pompe à eau.',
          'Coupez la pompe et vidangez le circuit. La pompe est à remplacer.',
          'Pompe à eau de remplacement, posée par l’atelier', GEL_SEC)],
        ['Je ne vois pas d’où', shop('Une fissure cachée est possible après le gel.',
          'Ne relancez pas la pompe avant le contrôle : l’atelier met le circuit sous pression et cherche la fuite.',
          'Recherche de fuite à l’atelier', GEL_SEC)],
      ])],
      ['Sous l’évier ou au pied d’un robinet', ask('Ça coule quand ?', [
        ['Seulement quand l’eau coule dans l’évier', funnel(
          ['Resserrez à la main l’écrou du siphon sous l’évier. La fuite s’arrête-t-elle ?', buy('L’écrou du siphon de l’évier était desserré.',
            'Les vibrations de la route le desserrent : vérifiez-le de temps en temps.', 'Siphon et joints d’évacuation pour camping-car')],
          ['Le joint du siphon est-il fendu ou écrasé ?', buy('Le joint du siphon est usé.',
            'Changez le joint, ou le siphon complet s’il est fendu.', 'Siphon et joints d’évacuation pour camping-car'), ['Oui', 'Non']],
          shop('L’évacuation de l’évier fuit plus loin.',
            'Siphon serré et joint bon, l’eau sort plus loin sur le tuyau d’évacuation : l’atelier le contrôle.',
            'Tuyau et raccords d’évacuation, posés par l’atelier')
        )],
        ['Tout le temps, même robinet fermé', funnel(
          ['Coupez la pompe et repoussez le tuyau dans son raccord rapide jusqu’à la butée (il s’enfonce de plus d’un centimètre). La fuite s’arrête-t-elle ?', buy('Le tuyau était mal enfoncé dans son raccord rapide.',
            'Les vibrations de la route le font ressortir : vérifiez les raccords sous l’évier de temps en temps.', 'Raccords rapides pour circuit d’eau')],
          ['Le raccord est-il fendu ?', buy('Le raccord rapide est fendu.',
            'Coupez la pompe et changez le raccord : il se vend au diamètre de vos tuyaux.', 'Raccords rapides pour circuit d’eau'), ['Oui, il est fendu', 'Non']],
          ['L’eau sort-elle du robinet lui-même (sous le levier) ?', buy('Le robinet fuit à sa base.',
            'La cartouche ou le joint du robinet est usé : voyez le diagnostic « Mon robinet ou ma douchette goutte ».', 'Cartouche céramique pour mitigeur de camping-car'), ['Oui', 'Non']],
          shop('Une fuite se cache sous le meuble.',
            'Coupez la pompe et épongez. L’atelier cherche la fuite et change la pièce.', 'Recherche de fuite et raccords neufs à l’atelier')
        )],
      ])],
      ['Autour de la douche ou des WC', ask('Où exactement ?', [
        ['Au joint du bac de douche ou au mitigeur', funnel(
          ['Séchez le bac puis faites couler la douche : l’eau passe-t-elle par le joint autour du bac ?', buy('Le joint du bac de douche est fendu.',
            'Séchez bien la zone, retirez l’ancien joint et refaites-le avec un mastic d’étanchéité spécial sanitaire de camping-car.',
            'Mastic d’étanchéité spécial sanitaire camping-car'), ['Oui, par le joint', 'Non']],
          ['L’eau sort-elle au raccord du mitigeur ou du flexible de douche ?', buy('Le joint de la douchette est usé.',
            'Resserrez à la main les deux bouts du flexible. Si l’eau sort encore, changez la douchette et son flexible.', 'Douchette avec flexible et bouton d’arrêt pour camping-car'), ['Oui', 'Non']],
          shop('Une fuite se cache sous le bac de douche.',
            'Ne prenez plus de douche en attendant : l’eau qui passe dessous abîme le plancher. L’atelier contrôle la bonde et les raccords.',
            'Recherche de fuite à l’atelier')
        )],
        ['Le bac de douche lui-même est fendu', shop('Le bac de douche est fendu.',
          'L’eau qui passe par la fissure abîme le plancher en dessous : ne prenez plus de douche avant la réparation. L’atelier répare le bac à la résine ou le change. Un caillebotis répartit ensuite le poids et évite une nouvelle fissure.',
          'Réparation du bac à l’atelier, puis caillebotis de douche')],
        ['Au pied des WC, à chaque chasse d’eau', funnel(
          ['Resserrez à la main le raccord d’arrivée d’eau derrière les WC. La flaque disparaît-elle ?', buy('Le raccord d’arrivée d’eau des WC était desserré.',
            'Vérifiez-le à chaque début de saison : les vibrations le desserrent.', 'Raccords rapides pour circuit d’eau')],
          ['La flaque apparaît-elle seulement pendant la chasse d’eau ?', buy('Les joints de la vanne de chasse d’eau sont usés.',
            'Une petite flaque à chaque chasse vient souvent des joints de la vanne d’arrivée d’eau. Le kit de joints de la marque de vos WC se pose facilement.',
            'Kit de joints pour WC à cassette'), ['Oui, pendant la chasse', 'Non, tout le temps']],
          shop('L’origine de la fuite des WC reste à trouver.',
            'Raccord serré et joints bons : l’atelier cherche la fuite sous les WC.', 'Recherche de fuite à l’atelier')
        )],
        ['Entre la cuvette et la cassette des WC', funnel(
          ['Lubrifiez le joint de la lame avec un produit spécial joints de lame, puis refermez bien la lame. La fuite s’arrête-t-elle ?', buy('Le joint de la lame était sec.',
            'Le joint de la lame sèche et laisse passer le liquide : lubrifiez-le à chaque vidange de cassette.', 'Lubrifiant spécial joints de lame de WC à cassette')],
          ['Le joint de la lame est-il fendu ou déformé ?', buy('Le joint de la lame des WC est usé.',
            'Un joint de lame neuf se pose facilement : il se vend à la marque et au modèle de vos WC.', 'Joint de lame pour WC à cassette'), ['Oui', 'Non']],
          shop('La lame des WC ne ferme plus bien.',
            'Joint lubrifié et en bon état, le liquide passe encore : l’atelier contrôle le mécanisme de la lame.', 'Contrôle des WC à l’atelier')
        )],
      ])],
      ['Le réservoir se vide mais je ne vois pas de fuite', funnel(
        ['Regardez la vanne FrostControl sous le chauffe-eau : le bouton jaune est-il sorti ?', buy('La vanne de vidange du chauffe-eau est ouverte.',
          'Bouton sorti, la vanne vide l’eau dehors : c’est sa protection contre le gel (sous 3 °C environ). Au-dessus de 7 °C, refermez-la (levier parallèle à la vanne, puis bouton enfoncé) et remettez l’eau. Un câble chauffant protège le circuit l’hiver.',
          'Câble chauffant antigel pour réservoir et tuyaux'), ['Oui, il est sorti', 'Non, il est enfoncé']],
        ['Le robinet de vidange du réservoir d’eau propre est-il bien fermé ? Fermez-le à fond. Le niveau tient-il ?', buy('Le robinet de vidange du réservoir était entrouvert.',
          'Refermez-le à fond après chaque vidange. Une graisse silicone sur son axe le garde doux.', 'Graisse silicone pour vannes et joints'), ['Oui, le niveau tient', 'Non, il baisse encore']],
        shop('Une fuite cachée se trouve sur le réservoir.',
          'Remplissez le réservoir, coupez la pompe et notez le niveau le lendemain. S’il a baissé, l’atelier contrôle le réservoir et ses raccords.',
          'Recherche de fuite et raccords neufs à l’atelier')
      )],
      ['Il y a de l’eau au sol à l’intérieur', funnel(
        ['L’eau apparaît-elle après la pluie ?', shop('De l’eau de pluie entre par un joint de la carrosserie.',
          'Épongez et laissez sécher en aérant : l’humidité abîme le bois des parois. Prenez rendez-vous pour un test d’étanchéité, qui trouve l’endroit exact.',
          'Test d’étanchéité à l’atelier', null, 'etanch'), ['Oui, après la pluie', 'Non, même sans pluie']],
        ['Y a-t-il de l’eau sous le frigo (eau de dégivrage) ?', buy('L’eau de dégivrage du frigo déborde.',
          'Dégivrez porte ouverte avec un bac dessous, sans gratter : une spatule en plastique décolle la glace sans abîmer la plaque.',
          'Spatule de dégivrage en plastique'), ['Oui, sous le frigo', 'Non']],
        ['Coupez la pompe pour la nuit. Le sol reste-t-il sec le lendemain ?', buy('Un raccord du circuit d’eau fuit sous un meuble.',
          'Ouvrez les trappes sous l’évier et la douche, repérez le tuyau mouillé et repoussez-le dans son raccord rapide, ou changez le raccord s’il est fendu.',
          'Raccords rapides pour circuit d’eau'), ['Oui, il reste sec', 'Non, il est encore mouillé']],
        shop('L’origine de l’eau au sol reste à trouver.',
          'Ni pluie ni circuit d’eau en cause : l’atelier cherche l’origine (réservoir, soute, joint de plancher).', 'Recherche de fuite à l’atelier')
      )],
    ]),
  },
];

module.exports = { CLIENTS_2026_10 };
