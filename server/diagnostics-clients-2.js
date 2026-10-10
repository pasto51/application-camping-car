'use strict';

// Second batch (October 2026): frequent problems found on Wikicampers, owners' forums (routard.com) and accessory
// stores (camping-car-plus, mon-camping-car, h2r-equipements) that no diagnostic covered yet. Written as funnels
// (see diag-helpers.js): each end point names a product sold in a camping-car accessory store, or the workshop.

const { buy, shop, funnel, ask } = require('./diag-helpers');

const NO_DRIVE_DOOR = 'Ne roulez jamais avec une porte au premier cran : elle peut s’ouvrir en roulant.';
const LID = 'Ne passez jamais la tête ni les mains sous un couvercle qui ne tient pas : calez-le d’abord.';
const FUEL = 'Carburant : pas de flamme ni de cigarette près du véhicule, aérez, et ne buvez pas cette eau.';
const WINDOW_SEC = 'Ne roulez jamais baie ouverte : elle peut s’arracher.';
const LUBE = 'Lubrifiant spécial serrures et barillets';
const SEAL_LUBE = 'Lubrifiant silicone pour joints et serrures';

const CLIENTS_2026_10_B = [
  {
    id: 'p_porte',
    cat: 'ext',
    label: 'Ma porte de cellule ferme mal (il faut la claquer, elle reste au premier cran)',
    kw: 'porte cellule ferme mal claquer premier cran deuxième cran gâche ressort charnière affaissée frotte jour joint fermeture centralisée verrouille toute seule télécommande poignée dure',
    tree: ask('Que se passe-t-il ?', [
      ['Elle reste au premier cran, il faut la claquer', funnel(
        ['Passez un lubrifiant silicone sur le joint et sur la gâche, puis fermez la porte d’un geste franc. Passe-t-elle le deuxième cran ?', buy('Le joint sec de la porte freinait la fermeture.',
          'Entretenez le joint et la gâche avec un lubrifiant silicone à chaque saison : la porte se ferme d’un geste normal. Vérifiez toujours le deuxième cran avant de partir.', SEAL_LUBE, NO_DRIVE_DOOR), ['Oui, c’est réglé', 'Non, toujours au premier cran']],
        ['Un objet, un tapis ou le marchepied gêne-t-il la porte en bas ?', buy('Un tapis gênait la fermeture de la porte.',
          'Gardez le seuil dégagé : un tapis d’entrée fin, coupé à la bonne taille, ne gêne pas la porte.', 'Tapis d’entrée fin pour camping-car'), ['Oui, quelque chose gêne', 'Non, rien ne gêne']],
        shop('La gâche de la porte est déréglée.',
          'Verrouillez à clé en attendant et vérifiez la porte avant chaque départ. L’atelier règle la gâche, change son ressort si besoin et contrôle les charnières.',
          'Kit de ressorts de gâche pour porte de cellule, posé par l’atelier', NO_DRIVE_DOOR)
      )],
      ['Elle frotte ou laisse passer le jour autour du joint', funnel(
        ['Le joint de porte est-il écrasé, déchiré ou décollé par endroits ?', buy('Le joint de la porte est abîmé.',
          'Un joint écrasé laisse passer l’air et l’eau : il se change au mètre, au profil de votre porte (apportez un morceau ou une photo au magasin).', 'Joint de porte de cellule au mètre'), ['Oui', 'Non, il est en bon état']],
        shop('La porte s’est affaissée sur ses charnières.',
          'Joint en bon état, la porte bâille encore : l’atelier règle les charnières et la gâche.', 'Réglage de la porte à l’atelier')
      )],
      ['Elle se verrouille toute seule ou ne répond plus à la télécommande', funnel(
        ['Changez la pile de la télécommande. La porte répond-elle de nouveau ?', buy('La pile de la télécommande était usée.',
          'Gardez une pile de rechange dans la boîte à gants, et toujours une clé sur vous : la porte peut se verrouiller seule.', 'Pile de télécommande de rechange')],
        ['Ouvrez puis refermez avec le bouton du tableau de bord, porte bien fermée. Le défaut disparaît-il ?', buy('La fermeture centralisée croyait la porte ouverte.',
          'Fermez toujours la porte jusqu’au deuxième cran avant de verrouiller : sinon le contacteur la croit ouverte. Gardez une clé sur vous.', 'Aucun produit nécessaire')],
        shop('Le contacteur de la porte est en défaut.',
          'Gardez toujours une clé sur vous : la porte peut se verrouiller seule. L’atelier contrôle le contacteur et la fermeture centralisée.',
          'Contrôle de la fermeture centralisée à l’atelier')
      )],
      ['La poignée ou la serrure est dure', funnel(
        ['Pulvérisez un lubrifiant spécial serrures dans le barillet et sur le pêne, puis faites jouer la poignée plusieurs fois. Est-ce réglé ?', buy('La serrure de la porte était encrassée.',
          'Relubrifiez-la deux fois par an. Si la clé coince, voyez aussi le diagnostic « Ma clé coince ».', LUBE)],
        shop('Le mécanisme de la poignée est usé.',
          'Ne forcez pas sur la poignée : elle casserait. L’atelier change la poignée ou la serrure.', 'Poignée ou serrure de porte de cellule, posée par l’atelier')
      )],
    ]),
  },
  {
    id: 'p_baie',
    cat: 'ext',
    label: 'Ma baie (fenêtre) ne tient plus ouverte, ne ferme plus, est rayée, fendue ou pleine de buée entre les vitres',
    eq: 'baies',
    kw: 'baie fenêtre hublot retombe tient plus ouverte compas vérin bras cran rayée rayure ternie fendue fissure cassée buée entre les vitres double vitrage verrou poignée ferme plus acrylique plexiglas',
    tree: ask('Que se passe-t-il avec la baie ?', [
      ['Elle retombe, elle ne tient plus ouverte', funnel(
        ['Ouvrez-la jusqu’au cran voulu, en la poussant jusqu’au déclic. Tient-elle ouverte ?', buy('La baie n’était pas ouverte jusqu’au cran.',
          'Les compas à crans tiennent seulement au déclic : poussez la baie jusqu’au cran, et refermez-la en la soulevant un peu plus haut pour libérer le cran.', 'Aucun produit nécessaire', WINDOW_SEC), ['Oui, elle tient', 'Non, elle retombe']],
        ['Le compas (le bras sur le côté) est-il tordu, cassé ou décroché ?', buy('Le compas de la baie est cassé.',
          'Le compas se change par paire, à la hauteur de la baie. Relevez la marque, le modèle et la hauteur écrits dans un angle du cadre et apportez-les au magasin.',
          'Paire de compas de baie à la hauteur de votre fenêtre', WINDOW_SEC), ['Oui', 'Non, il a l’air entier']],
        buy('Le compas de la baie est fatigué.',
          'Les crans ou le vérin du compas ne tiennent plus. Relevez la marque, le modèle et la hauteur de la baie (écrits dans un angle du cadre) : le magasin vous donne la paire de compas qui va avec.',
          'Paire de compas à la hauteur de votre fenêtre', WINDOW_SEC)
      )],
      ['Elle ne se verrouille plus', funnel(
        ['Appuyez sur la baie pour bien la plaquer contre le joint, puis tournez le verrou. Se verrouille-t-elle ?', buy('Le joint repoussait la baie et empêchait le verrou de prendre.',
          'Plaquez toujours la baie avant de tourner le verrou. Un lubrifiant silicone sur le joint l’aide à se plaquer.', SEAL_LUBE, WINDOW_SEC), ['Oui, elle se verrouille', 'Non']],
        buy('Le verrou de la baie est cassé.',
          'Les verrous et poignées de baie se vendent au modèle de la fenêtre : apportez une photo et la marque au magasin. En attendant, ne roulez pas avec cette baie non verrouillée.',
          'Verrou de baie au modèle de votre fenêtre', WINDOW_SEC)
      )],
      ['Elle est rayée ou ternie', funnel(
        ['Passez l’ongle sur la rayure : accroche-t-il ?', buy('La rayure de la baie est profonde.',
          'Les rayures profondes s’atténuent avec un kit de rénovation acrylique en plusieurs passes. Si la vue reste gênée, le vitrage se change au modèle (écrit dans un angle du cadre).',
          'Kit de rénovation pour baies acryliques'), ['Oui, il accroche', 'Non, la rayure est fine']],
        buy('La surface acrylique de la baie est rayée.',
          'Les baies sont en acrylique, pas en verre : un produit pour vitres ou une éponge qui gratte les raye. Les rayures fines partent avec un kit de rénovation spécial acrylique, puis lavez-les avec un nettoyant spécial baies.',
          'Kit de rénovation et nettoyant pour baies acryliques')
      )],
      ['Elle est fendue', shop('Le vitrage acrylique est fendu.',
        'Une fissure laisse entrer l’eau et s’agrandit avec le froid. L’atelier commande le vitrage au modèle (écrit dans un angle du cadre) et le pose étanche.',
        'Vitrage de baie de rechange, posé par l’atelier')],
      ['Il y a de la buée entre les deux vitres', funnel(
        ['Aérez et chauffez la cellule une heure. La buée disparaît-elle ?', buy('C’était de la condensation sur la vitre intérieure.',
          'La buée sur la face intérieure vient de l’humidité de la cellule : aérez et utilisez un absorbeur d’humidité.', 'Absorbeur d’humidité'), ['Oui, elle disparaît', 'Non, elle reste entre les vitres']],
        shop('Le double vitrage n’est plus étanche.',
          'La buée entre les deux vitres ne part pas : le vitrage est à changer. Ce n’est pas urgent tant que la baie ne fuit pas.', 'Vitrage de baie de rechange, posé par l’atelier')
      )],
    ]),
  },
  {
    id: 'p_robinet',
    cat: 'eau',
    label: 'Mon robinet marche mal : il fuit, goutte, coule faiblement, ou la pompe ne démarre pas ou ne s’arrête pas',
    eq: 'pompe',
    kw: 'robinet mitigeur goutte fuit fuite milieu levier cartouche céramique écrou douchette flexible pommeau pompe démarre pas arrête pas tourne contacteur micro-contact clic mousseur débit faible calcaire gel fendu changé pompe nouvelle pompe purge air',
    tree: ask('Qu’est-ce qui ne va pas ?', [
      ['Le robinet goutte par le bec, même fermé', funnel(
        ['Fermez le levier à fond, bien au centre, puis attendez une minute. Goutte-t-il encore ?', buy('La cartouche du mitigeur est usée.',
          'Coupez la pompe. La cartouche céramique se change sans changer le robinet : notez la marque du mitigeur et apportez l’ancienne cartouche au magasin. Sur un mitigeur ancien, un mitigeur neuf spécial camping-car est souvent plus simple.',
          'Cartouche céramique pour mitigeur de camping-car'), ['Oui, il goutte encore', 'Non, c’est arrêté']],
        buy('Le levier du mitigeur n’était pas fermé à fond.',
          'Fermez-le toujours bien au centre et en bas. S’il recommence à goutter fermé à fond, la cartouche s’use : elle se change.', 'Cartouche céramique pour mitigeur de camping-car')
      )],
      ['Ça fuit au milieu du robinet, autour du levier', funnel(
        ['Coupez la pompe. Retirez le petit cache du levier et sa vis, enlevez le levier, puis resserrez à la main l’écrou qui tient la cartouche, sans forcer. Rallumez la pompe : est-ce réglé ?', buy('L’écrou de la cartouche s’était desserré.',
          'Les vibrations de la route le desserrent : revérifiez-le de temps en temps, sans forcer. Si la fuite revient écrou serré, c’est la cartouche qui est usée.', 'Cartouche céramique pour mitigeur de camping-car')],
        ['Le robinet a-t-il passé un hiver avec de l’eau dedans (circuit pas vidangé) ?', buy('Le corps du mitigeur a été fendu par le gel.',
          'Une fissure ne se répare pas : changez le mitigeur par un modèle spécial camping-car. À l’hivernage, vidangez le circuit et laissez les robinets ouverts en position milieu.',
          'Mitigeur pour camping-car'), ['Oui', 'Non, ou je ne sais pas']],
        ['Le robinet est-il récent (moins de 5 ans) et le magasin trouve-t-il la même cartouche ? Apportez l’ancienne pour comparer.', buy('La cartouche céramique du mitigeur est usée.',
          'La cartouche identique se change par le dessus du robinet, pompe coupée, sans passer sous l’évier : un quart d’heure. Le magasin vous montre comment.',
          'Cartouche céramique pour mitigeur de camping-car'), ['Oui', 'Non, ancien ou cartouche introuvable']],
        buy('Le mitigeur est usé.',
          'Sur un mitigeur ancien ou quand la cartouche est introuvable, un mitigeur neuf règle tout d’un coup. Comptez 30 à 45 minutes sous l’évier. Avec une pompe dans le réservoir, prenez un modèle à contacteur.',
          'Mitigeur pour camping-car')
      )],
      ['Ça fuit sous l’évier ou au pied du robinet', funnel(
        ['Coupez la pompe et resserrez à la main le raccord sous l’évier. Est-ce réglé ?', buy('Le raccord du robinet était desserré.',
          'Les vibrations de la route le desserrent : vérifiez-le de temps en temps.', 'Raccords rapides et flexibles pour robinet de camping-car')],
        ['Le flexible sous le robinet est-il mouillé ou fendu ?', buy('Le flexible du robinet est usé.',
          'Coupez la pompe et changez le flexible : il se vend à la longueur et au diamètre de votre robinet.', 'Raccords rapides et flexibles pour robinet de camping-car'), ['Oui', 'Non']],
        buy('Le joint au pied du mitigeur est usé.',
          'L’eau sort au pied du robinet : le joint du corps est usé. Un mitigeur neuf spécial camping-car se pose à la place.', 'Mitigeur pour camping-car')
      )],
      ['La douchette ou son flexible fuit', funnel(
        ['Resserrez à la main les deux bouts du flexible. Est-ce réglé ?', buy('Le flexible de la douchette était desserré.',
          'Revérifiez-le de temps en temps, sans forcer : le plastique se fend si on serre trop.', 'Douchette avec flexible et bouton d’arrêt pour camping-car')],
        ['L’eau sort-elle du flexible lui-même (fendu, percé) ?', buy('Le flexible de la douchette est fendu.',
          'Changez le flexible, ou la douchette complète : il en existe avec un bouton d’arrêt qui économise l’eau.', 'Flexible de douche pour camping-car'), ['Oui', 'Non, de la douchette']],
        buy('Le joint de la douchette est usé.',
          'Changez la douchette et son flexible : il en existe avec un bouton d’arrêt qui économise l’eau.', 'Douchette avec flexible et bouton d’arrêt pour camping-car')
      )],
      ['Un seul robinet coule faiblement (les autres vont bien)', funnel(
        ['Dévissez le petit embout au bout du bec (le mousseur). Est-il encrassé ou plein de calcaire ?', buy('Le mousseur du robinet est entartré.',
          'Changez le mousseur. Pour éviter que ça revienne, détartrez le circuit avec un produit spécial circuit d’eau de camping-car, puis rincez bien le réservoir.',
          'Mousseur de robinet et détartrant pour circuit d’eau de camping-car'), ['Oui, il est sale', 'Non, il est propre']],
        buy('La cartouche du mitigeur est entartrée.',
          'Le calcaire freine l’eau dans la cartouche : changez-la par la même, ou changez le mitigeur s’il est ancien.', 'Cartouche céramique pour mitigeur de camping-car')
      )],
      ['La pompe ne démarre pas quand j’ouvre le robinet', ask('Avec quels robinets ?', [
        ['Avec un seul robinet', funnel(
          ['Ouvrez ce robinet en grand, puis en position eau chaude et eau froide. La pompe démarre-t-elle d’un côté ?', buy('Le contacteur du robinet commence à s’user.',
            'Il ne réagit plus que d’un côté : il va lâcher. Changez le mitigeur par un modèle à contacteur spécial camping-car.', 'Mitigeur à contacteur pour camping-car'), ['Oui, d’un côté seulement', 'Non, jamais']],
          ['Entendez-vous un petit clic en ouvrant ce robinet ?', shop('Le courant du contacteur n’arrive plus à la pompe.',
            'Le contacteur clique mais la pompe reste muette : un fil est sans doute débranché sous l’évier. L’atelier contrôle le câblage de la pompe.', 'Contrôle du câblage de la pompe à l’atelier'), ['Oui, il clique', 'Non, aucun clic']],
          buy('Le contacteur du robinet ne commande plus la pompe.',
            'Ces robinets ont un petit contacteur électrique qui démarre la pompe. Il est usé : changez le mitigeur par un modèle à contacteur spécial camping-car.', 'Mitigeur à contacteur pour camping-car')
        )],
        ['Avec aucun robinet', funnel(
          ['Le bouton de la pompe est-il allumé au tableau de commande ? Allumez-le et ouvrez un robinet. Est-ce réglé ?', { cause: 'La pompe était coupée au tableau de commande.',
            geste: 'Rallumez-la au tableau à chaque arrivée. Coupez-la en roulant et la nuit : une fuite ne videra pas le réservoir.', prod: 'Aucun produit nécessaire', sec: null }],
          ['Regardez le fusible de la pompe (tableau ou boîte à fusibles de la cellule). Est-il grillé ?', buy('Le fusible de la pompe est grillé.',
            'Remplacez-le par un fusible de même valeur. S’il regrille aussitôt, faites contrôler la pompe.', 'Fusibles plats assortis'), ['Oui, il est grillé', 'Non, il est bon']],
          shop('La pompe ne fonctionne plus.',
            'Le bouton et le fusible sont bons : la pompe elle-même est en cause. Voyez aussi « J’ai un souci avec ma pompe à eau » ; l’atelier la teste et la change si besoin.', 'Contrôle de la pompe à l’atelier')
        )],
      ])],
      ['La pompe ne s’arrête pas quand je ferme le robinet', funnel(
        ['Fermez tous les robinets bien au centre et en bas, douche comprise. Un filet d’eau coule-t-il encore quelque part ?', buy('Un robinet mal fermé fait tourner la pompe.',
          'Si le filet continue levier fermé à fond, la cartouche de ce robinet est usée : elle se change.', 'Cartouche céramique pour mitigeur de camping-car'), ['Oui, un filet coule', 'Non, tout est fermé']],
        ['Votre pompe est-elle dans le réservoir ? Si oui, bougez un peu le levier fermé de chaque robinet : la pompe s’arrête-t-elle ?', buy('Le contacteur du robinet reste collé.',
          'Le petit contacteur qui démarre la pompe ne se relâche plus : il va lâcher. Changez le mitigeur par un modèle à contacteur spécial camping-car. En attendant, coupez la pompe au tableau quand vous n’utilisez pas l’eau.',
          'Mitigeur à contacteur pour camping-car'), ['Oui, elle s’arrête', 'Non, ou ma pompe est à côté du réservoir']],
        shop('Le pressostat de la pompe ne la coupe plus.',
          'Avec une pompe à côté du réservoir, c’est son pressostat qui l’arrête quand la pression est atteinte. Voyez aussi « J’ai un souci avec ma pompe à eau » ; l’atelier le règle ou le change.',
          'Réglage du pressostat à l’atelier')
      )],
      ['Ça marche mal depuis que j’ai changé la pompe', funnel(
        ['Ouvrez tous les robinets, eau chaude et eau froide, douche comprise, jusqu’à ce que l’eau coule sans bulles ni à-coups. Est-ce réglé ?', { cause: 'De l’air restait dans le circuit après le changement de pompe.',
          geste: 'Purgez ainsi après chaque changement de pompe, vidange ou hivernage, sans oublier l’eau chaude.', prod: 'Aucun produit nécessaire', sec: null }],
        ['Coupez la pompe au tableau. Débranchez puis rebranchez les cosses de la nouvelle pompe : nettoyez-les et serrez-les bien. Est-ce réglé ?', buy('Les cosses de la pompe faisaient un mauvais contact.',
          'Les vibrations et l’humidité les abîment : nettoyez-les et protégez-les.', 'Nettoyant et protecteur pour contacts électriques')],
        ['La nouvelle pompe est-elle du même type que l’ancienne ? (dans le réservoir, ou à côté et qui démarre toute seule)', buy('La nouvelle pompe ne correspond pas au circuit.',
          'Une pompe dans le réservoir a besoin de robinets à contacteur ; une pompe à côté du réservoir démarre seule quand la pression baisse. Le magasin vous aide à choisir la pompe adaptée à votre circuit.',
          'Pompe à eau adaptée à votre circuit'), ['Non, un autre type', 'Oui, ou je ne sais pas']],
        ['Les robinets gouttent-ils ou ferment-ils mal depuis la nouvelle pompe ?', buy('La nouvelle pompe est trop puissante pour vos robinets.',
          'Une pression plus forte fatigue les cartouches des robinets. Un réducteur de pression, ou une pompe moins puissante, les protège.',
          'Réducteur de pression pour circuit d’eau de camping-car'), ['Oui', 'Non']],
        shop('Le montage de la nouvelle pompe est à contrôler.',
          'Rien n’a suffi : l’atelier contrôle le branchement, le sens des tuyaux et le réglage de la pompe.', 'Contrôle du montage de la pompe à l’atelier')
      )],
    ]),
  },
  {
    id: 'p_placard',
    cat: 'ext',
    label: 'Mes placards ou mes tiroirs s’ouvrent en roulant (bouton poussoir cassé)',
    eq: 'plac',
    kw: 'placard tiroir s ouvre en roulant bouton poussoir push lock fermeture cassé gâche porte de meuble charnière arrachée vis tiennent plus',
    tree: funnel(
      ['Appuyez sur le bouton poussoir, porte fermée : ressort-il et reste-t-il sorti ?', buy('Le placard n’était pas verrouillé avant de partir.',
        'Le bouton doit être sorti pour verrouiller (sur la plupart des modèles) : faites le tour des placards avant chaque départ.', 'Aucun produit nécessaire',
        'Avant de rouler, vérifiez que tous les placards hauts sont fermés : un placard ouvert projette des objets.'), ['Oui, il reste sorti', 'Non, il reste enfoncé ou ne bouge plus']],
      ['Le bouton reste-t-il enfoncé, ou tourne-t-il dans le vide ?', buy('Le bouton poussoir est cassé.',
        'Le bouton poussoir se change en entier (bouton, mécanisme et gâche). Mesurez le diamètre du trou dans la porte et apportez l’ancien bouton au magasin.',
        'Bouton poussoir de placard complet pour camping-car',
        'Avant de rouler, vérifiez que tous les placards hauts sont fermés : un placard ouvert projette des objets.'), ['Oui', 'Non, il marche']],
      ['La gâche (la petite pièce sur le meuble où le bouton s’accroche) a-t-elle bougé ou ses vis tournent-elles dans le vide ?', buy('La gâche du placard est décalée.',
        'Revissez-la bien en face du pêne. Si ses vis ne tiennent plus, une gâche neuve se pose un peu à côté.', 'Gâche et vis pour bouton poussoir de placard'), ['Oui', 'Non']],
      ['Une charnière de la porte est-elle arrachée ou la porte pend-elle ?', buy('La charnière de la porte est arrachée.',
        'Le panneau léger des meubles tient mal une vis arrachée : une charnière de meuble neuve se pose un peu à côté, avec des chevilles spéciales panneaux.',
        'Charnières de meuble et chevilles pour panneaux de camping-car'), ['Oui', 'Non']],
      shop('La porte du placard est voilée.',
        'Bouton, gâche et charnières bons, la porte ne tient pas fermée : le panneau est sans doute voilé. L’atelier le règle ou le change.', 'Réglage du meuble à l’atelier')
    ),
  },
  {
    id: 'p_verin',
    cat: 'ext',
    label: 'Mon coffre, mon lit relevable ou une porte de placard ne tient plus ouvert (vérin à gaz)',
    kw: 'vérin à gaz coffre couvercle lit relevable sommier soute placard abattant porte retombe tient plus ouvert tombe',
    tree: ask('Qu’est-ce qui ne tient plus ouvert ?', [
      ['Un couvercle de coffre ou une porte de placard', funnel(
        ['Calez le couvercle ouvert. Le vérin est-il décroché d’une de ses rotules (les petites boules aux deux bouts) ?', buy('Le vérin était sorti de sa rotule.',
          'Remettez l’embout sur sa rotule en appuyant jusqu’au clic. Si la rotule est arrachée, une rotule neuve se visse à la même place.', 'Rotules de fixation pour vérin à gaz', LID), ['Oui, il est décroché', 'Non, il est bien accroché']],
        buy('Le vérin à gaz est fatigué.',
          'Relevez la longueur et la force (en newtons, N) écrites sur le vérin et prenez-en un identique. S’il y en a deux, changez les deux ensemble.', 'Vérin à gaz de même longueur et même force', LID)
      )],
      ['Le sommier du lit (lit relevable, accès à la soute)', funnel(
        ['Calez le sommier ouvert avec un support solide. Les vérins sont-ils bien accrochés aux deux bouts ?', shop('Les vérins du sommier sont fatigués.',
          'Notez les valeurs écrites sur les vérins : le magasin vous les fournit, et l’atelier les pose, car un sommier est lourd.', 'Paire de vérins à gaz pour sommier relevable', LID), ['Oui, ils sont accrochés', 'Non, un vérin est décroché']],
        shop('Un vérin du sommier s’est décroché.',
          'Ne passez pas sous le sommier. L’atelier remet le vérin en place et contrôle sa fixation.', 'Rotules et vérins à gaz pour sommier, posés par l’atelier', LID)
      )],
    ]),
  },
  {
    id: 'p_frigoporte',
    cat: 'frigo',
    label: 'La porte de mon frigo s’ouvre en roulant ou son verrou est cassé',
    eq: 'frigo',
    kw: 'porte frigo réfrigérateur s ouvre en roulant verrou poignée cassée fermeture de route affaissée frotte charnière contre-porte',
    tree: funnel(
      ['Enclenchez-vous le verrou de route de la porte avant de partir (sur la poignée ou en haut de la porte) ?', buy('Le verrou de route de la porte n’était pas enclenché.',
        'Enclenchez-le à chaque départ, avec vos vérifications avant la route. Une barre de maintien empêche aussi les aliments de tomber.', 'Barre de maintien pour réfrigérateur'), ['Non, je ne savais pas', 'Oui, à chaque fois']],
      ['Le verrou ou la poignée est-il cassé ?', buy('La poignée de la porte est cassée.',
        'La poignée et son verrou se vendent au modèle du frigo : relevez la marque et le modèle sur la plaque à l’intérieur. En attendant, un verrou de sécurité adhésif pour frigo tient la porte fermée.',
        'Poignée et verrou de porte de réfrigérateur au modèle'), ['Oui', 'Non, il a l’air entier']],
      ['La contre-porte est-elle très chargée (bouteilles) ?', buy('La contre-porte trop chargée tire sur le verrou.',
        'Rangez les bouteilles debout dans le bas du frigo et allégez la contre-porte : le verrou tient mieux et la porte ne s’affaisse pas.', 'Range-bouteilles pour réfrigérateur'), ['Oui', 'Non']],
      shop('La porte du frigo est affaissée sur sa charnière.',
        'Le verrou est entier mais ne prend plus : la porte est descendue. L’atelier règle ou change la charnière.', 'Charnière de porte de réfrigérateur, posée par l’atelier')
    ),
  },
  {
    id: 'p_soute',
    cat: 'ext',
    label: 'Ma porte de soute ferme mal, sa charnière est dure ou la soute prend l’eau',
    eq: 'soute',
    kw: 'soute coffre extérieur porte de soute charnière dure grince serrure joint bâille ferme mal eau dans la soute humide mouillée plancher',
    tree: ask('Que se passe-t-il ?', [
      ['La serrure de la soute coince', funnel(
        ['Pulvérisez un lubrifiant spécial serrures dans le barillet, puis faites jouer la clé plusieurs fois. La clé tourne-t-elle bien ?', buy('La serrure de la soute était encrassée.',
          'Relubrifiez-la deux fois par an. Si la clé reste coincée ou casse, voyez le diagnostic « Ma clé coince ».', LUBE), ['Oui, elle tourne bien', 'Non, elle coince encore']],
        buy('Le barillet de la soute est usé.',
          'Voyez le diagnostic « Ma clé coince » : le barillet se change avec la clé d’extraction, ou toutes les serrures avec un kit de barillets identiques.', 'Barillet Zadi avec clé d’extraction')
      )],
      ['La charnière est dure ou grince', funnel(
        ['Porte ouverte, pulvérisez un lubrifiant pour charnières tout le long et faites jouer la porte. Est-ce réglé ?', buy('La charnière de la soute était grippée.',
          'Remettez les petits bouchons au bout de la charnière s’ils manquent : ils empêchent l’eau d’entrer et la charnière de rouiller.', 'Lubrifiant pour charnières et bouchons de charnière de soute')],
        shop('La charnière de la soute est abîmée.',
          'Elle reste dure ou se tord : l’atelier la change, car il faut déposer la porte.', 'Charnière de soute, posée par l’atelier')
      )],
      ['La porte ne plaque plus (elle bâille)', funnel(
        ['Le joint de la porte de soute est-il écrasé ou décollé ?', buy('Le joint de la porte de soute est écrasé.',
          'Un joint écrasé ne plaque plus : changez-le avec un joint de soute au mètre.', 'Joint de porte de soute au mètre'), ['Oui', 'Non, il est en bon état']],
        shop('La porte de soute est voilée.',
          'Joint en bon état, la porte bâille encore : l’atelier règle la gâche ou la porte.', 'Réglage de la porte de soute à l’atelier')
      )],
      ['Il y a de l’eau dans la soute', funnel(
        ['L’eau arrive-t-elle après la pluie ou un lavage ?', shop('L’eau de pluie entre par la porte de soute.',
          'Épongez et laissez sécher porte ouverte : un plancher de soute mouillé finit par pourrir. Le test d’étanchéité trouve l’endroit exact.',
          'Test d’étanchéité à l’atelier', null, 'etanch'), ['Oui', 'Non, même sans pluie']],
        ['Un tuyau ou un raccord d’eau passe-t-il dans la soute, mouillé ?', buy('Un tuyau d’eau fuit dans la soute.',
          'Coupez la pompe, repoussez le tuyau dans son raccord rapide ou changez le raccord, et voyez le diagnostic « J’ai une fuite d’eau ».', 'Raccords rapides pour circuit d’eau'), ['Oui', 'Non']],
        buy('L’humidité de la soute se condense.',
          'Ni pluie ni tuyau : c’est de la condensation (affaires mouillées, différence de température). Aérez la soute et posez un absorbeur d’humidité.', 'Absorbeur d’humidité pour soute')
      )],
    ]),
  },
  {
    id: 'p_siege',
    cat: 'ext',
    label: 'Mon siège de cabine ne pivote plus ou ne se verrouille plus',
    eq: 'sieges',
    kw: 'siège cabine pivotant pivote plus tourne plus embase bloqué verrouille plus conducteur passager levier frein à main',
    tree: ask('Que se passe-t-il ?', [
      ['Il ne pivote plus', funnel(
        ['Avancez ou reculez le siège, relevez les accoudoirs et ouvrez la porte, puis tirez le levier de l’embase. Le siège tourne-t-il ?', buy('Le siège touchait la porte en tournant.',
          'Pour tourner, le siège doit être avancé ou reculé, accoudoirs relevés, porte ouverte. Notez la bonne position une fois pour toutes.', 'Aucun produit nécessaire'), ['Oui, il tourne', 'Non, il bloque']],
        ['Le siège est-il gêné par le frein à main ? Véhicule calé et vitesse engagée, baissez-le. Le siège tourne-t-il ?', buy('Le siège est gêné par le frein à main.',
          'Une poignée de frein à main rabattable dégage la place et facilite la manœuvre.', 'Poignée de frein à main rabattable',
          'Baissez le frein à main seulement véhicule à l’arrêt, vitesse engagée et roues calées.'), ['Oui, il tourne', 'Non, il bloque']],
        shop('L’embase pivotante est grippée.',
          'Ne forcez pas sur le siège. L’atelier nettoie et graisse l’embase, ou la change par une embase pivotante homologuée.', 'Embase pivotante homologuée, posée par l’atelier')
      )],
      ['Il pivote mais ne se verrouille plus face à la route', funnel(
        ['Tournez le siège bien droit face à la route et poussez-le jusqu’au déclic du levier. Est-il verrouillé (il ne bouge plus) ?', buy('Le siège n’était pas tourné jusqu’au cran.',
          'Le verrou ne prend que siège bien droit : poussez jusqu’au déclic et vérifiez qu’il ne tourne plus avant de rouler.', 'Aucun produit nécessaire',
          'Ne roulez jamais avec un siège qui n’est pas verrouillé face à la route.'), ['Oui, il est verrouillé', 'Non, il tourne encore']],
        shop('Le verrou de l’embase ne s’enclenche plus.',
          'Un siège non verrouillé ne protège pas en cas de choc. L’atelier contrôle le verrou de l’embase et la change si besoin.', 'Embase pivotante homologuée, posée par l’atelier',
          'Ne roulez jamais avec un siège qui n’est pas verrouillé face à la route.')
      )],
    ]),
  },
  {
    id: 'p_table',
    cat: 'ext',
    label: 'Le pied de ma table est bloqué, la table descend toute seule ou branle',
    eq: 'table',
    kw: 'table pied de table télescopique descend toute seule bloqué levier vérin branle bouge platine dinette',
    tree: ask('Que se passe-t-il avec la table ?', [
      ['Elle descend toute seule', funnel(
        ['Le pied a-t-il un collier ou une molette de blocage ? Serrez-le à la hauteur voulue. La table tient-elle ?', buy('Le collier de blocage du pied était desserré.',
          'Resserrez-le à la main à chaque réglage de hauteur.', 'Aucun produit nécessaire'), ['Oui, elle tient', 'Non, ou il n’y en a pas']],
        buy('Le vérin du pied de table est fatigué.',
          'Mettez la table au plus bas avant de manger pour ne pas vous pincer les doigts. Le pied télescopique se change : relevez sa hauteur, son diamètre et le type de fixation.', 'Pied de table télescopique de rechange')
      )],
      ['Le pied est bloqué, je ne peux plus la régler', funnel(
        ['Actionnez le levier en soulevant légèrement le plateau. Le pied se libère-t-il ?', buy('Le poids du plateau bloquait le levier du pied.',
          'Soulevez toujours un peu le plateau en actionnant le levier. Un spray silicone sur le tube le fait glisser plus doucement.', 'Spray silicone pour mécanismes')],
        ['Pulvérisez un spray silicone sur le tube et recommencez. Le pied se libère-t-il ?', buy('Le tube du pied de table était grippé.',
          'Refaites-le une fois par an : le tube glisse sans forcer.', 'Spray silicone pour mécanismes'), ['Oui, il se libère', 'Non, il reste bloqué']],
        buy('Le mécanisme du pied de table est cassé.',
          'Le pied télescopique se change : relevez sa hauteur, son diamètre et le type de fixation.', 'Pied de table télescopique de rechange')
      )],
      ['Elle branle', funnel(
        ['Resserrez les vis de la platine sous le plateau et au sol. La table est-elle stable ?', buy('La platine du pied était desserrée.',
          'Les vibrations de la route la desserrent : revérifiez-la de temps en temps.', 'Aucun produit nécessaire'), ['Oui, elle est stable', 'Non, les vis tournent dans le vide']],
        buy('Les vis de la platine ne tiennent plus.',
          'Elles tournent dans le vide : une platine neuve se pose un peu à côté, avec des vis neuves.', 'Platine de fixation pour pied de table')
      )],
    ]),
  },
  {
    id: 'p_latte',
    cat: 'ext',
    label: 'Une latte de mon lit est cassée ou sortie de son support',
    kw: 'latte lit sommier cassée sortie embout support plastique craque matelas',
    tree: funnel(
      ['Soulevez le matelas : la latte est-elle seulement sortie de ses embouts ? Remettez-la. Tient-elle ?', buy('La latte était sortie de son embout.',
        'Remettez-la bien dans ses deux embouts, et ne vous asseyez pas sur le bord du lit d’un coup.', 'Aucun produit nécessaire'), ['Oui, elle tient', 'Non, elle ressort']],
      ['L’embout en plastique est-il cassé ou fendu ?', buy('L’embout de la latte est cassé.',
        'Notez la largeur de la latte (souvent 53 mm) et apportez l’embout cassé au magasin : ils se vendent par lot.', 'Embouts de latte de lit'), ['Oui', 'Non']],
      ['La latte elle-même est-elle cassée ou fendue ?', buy('La latte de lit est cassée.',
        'Mesurez la longueur, la largeur et l’épaisseur, et prenez une latte courbée identique avec ses embouts.', 'Latte de lit courbée aux dimensions et ses embouts'), ['Oui', 'Non']],
      shop('Le cadre du sommier est abîmé.',
        'Latte et embouts bons, la latte ne tient pas : le support du sommier est sans doute cassé. L’atelier le répare.', 'Réparation du sommier à l’atelier')
    ),
  },
  {
    id: 'p_lampe',
    cat: 'elec',
    label: 'Une lumière (spot, plafonnier) ne s’allume plus ou clignote',
    eq: 'led',
    kw: 'lumière spot plafonnier lampe ampoule led ne s allume plus clignote faible éclaire mal liseuse réglette g4',
    tree: ask('Que se passe-t-il ?', [
      ['Une seule lumière ne marche plus', funnel(
        ['Lumière éteinte, mettez à la place l’ampoule d’un autre spot qui marche. S’allume-t-elle ?', buy('L’ampoule LED est grillée.',
          'Prenez une ampoule LED 12 V au même culot (souvent G4) : apportez l’ancienne au magasin.', 'Ampoule LED 12 V au culot d’origine'), ['Oui, avec l’autre ampoule', 'Non, toujours rien']],
        ['L’interrupteur de ce spot est-il sur marche, et le variateur au-dessus de zéro ?', buy('Le spot était éteint sur son propre interrupteur.',
          'Beaucoup de spots ont un interrupteur ou un variateur sur le côté : vérifiez-le en premier.', 'Aucun produit nécessaire'), ['Non, il était éteint', 'Oui']],
        ['Voyez le diagnostic « Plus de courant dans la cellule » (un seul appareil) : le fusible de l’éclairage était-il grillé ?', buy('Le fusible de l’éclairage était grillé.',
          'Remplacez-le par un fusible du même calibre, jamais plus fort. S’il grille de nouveau, passez à l’atelier.', 'Fusibles plats assortis'), ['Oui, il était grillé', 'Non, il est bon']],
        buy('Le spot ne reçoit plus le courant.',
          'Ampoule et fusible bons : le spot lui-même est en panne. Un spot LED neuf se pose à la place.', 'Spot LED 12 V de rechange')
      )],
      ['Elle clignote ou éclaire faiblement', funnel(
        ['Les autres lumières faiblissent-elles aussi ? Regardez la tension de la batterie au panneau.', buy('La batterie cellule est basse.',
          'Toutes les lumières faiblissent ensemble : rechargez la batterie (230 V, moteur ou solaire) et voyez le diagnostic « Ma batterie cellule se décharge très vite ».', 'Moniteur de batterie'), ['Oui, toutes faiblissent', 'Non, une seule']],
        buy('L’ampoule LED supporte mal les variations de tension.',
          'Certaines ampoules LED premier prix clignotent quand la tension varie. Prenez des ampoules LED spéciales camping-car (10 à 30 V).', 'Ampoules LED spéciales camping-car (10 à 30 V)')
      )],
      ['Plusieurs lumières ne marchent plus', buy('Le circuit d’éclairage est coupé.',
        'Plusieurs lumières ensemble : voyez le diagnostic « Plus de courant dans la cellule (12 V) » (fusible, coupe-circuit, batterie).', 'Fusibles plats assortis')],
    ]),
  },
  {
    id: 'p_carburant',
    cat: 'eau',
    label: 'J’ai mis de l’essence ou du gazole dans le réservoir d’eau',
    kw: 'essence gazole diesel carburant réservoir d eau erreur trappe bouchon plein mauvais réservoir odeur carburant eau',
    tree: ask('Avez-vous ouvert un robinet ou fait tourner la pompe depuis ?', [
      ['Non, rien du tout', shop('Le carburant est resté dans le réservoir d’eau.',
        'N’ouvrez aucun robinet et ne lancez pas la pompe. L’atelier vidange et nettoie le réservoir. Ensuite, un désinfectant spécial réservoir d’eau et des repères sur les trappes évitent de recommencer.',
        'Nettoyant désinfectant pour réservoir d’eau et repères de trappe', FUEL)],
      ['Oui, l’eau est passée dans les robinets', shop('Le carburant est passé dans le circuit d’eau.',
        'Coupez la pompe et le chauffe-eau. Les tuyaux, la pompe et le chauffe-eau doivent être rincés et contrôlés, parfois changés : l’atelier s’en occupe.',
        'Nettoyage du circuit d’eau à l’atelier', FUEL)],
      ['Je ne sais pas', shop('Du carburant est peut-être dans le circuit d’eau.',
        'Dans le doute, n’ouvrez plus aucun robinet et coupez la pompe et le chauffe-eau. L’atelier contrôle le réservoir et le circuit.',
        'Contrôle et nettoyage du circuit d’eau à l’atelier', FUEL)],
    ]),
  },
  {
    id: 'p_bouchon',
    cat: 'eau',
    label: 'J’ai perdu le bouchon ou la clé du réservoir d’eau',
    kw: 'bouchon réservoir eau propre perdu clé perdue trappe remplissage cassée verrouillable',
    tree: ask('Que se passe-t-il ?', [
      ['Le bouchon est perdu', buy('Le bouchon du réservoir est perdu.',
        'Mesurez le diamètre de l’ouverture (souvent 40 ou 60 mm) et prenez un bouchon verrouillable à clé. Le réservoir est resté ouvert : désinfectez-le avant de boire l’eau.',
        'Bouchon verrouillable pour réservoir d’eau et désinfectant de réservoir')],
      ['J’ai perdu la clé du bouchon', funnel(
        ['Le bouchon est-il ouvert (vous pouvez le retirer) ?', buy('La clé du bouchon est perdue.',
          'Un bouchon verrouillable se change en entier avec ses clés : mesurez le diamètre et prenez le même.', 'Bouchon verrouillable pour réservoir d’eau'), ['Oui, il s’enlève', 'Non, il est verrouillé']],
        shop('Le bouchon est verrouillé sans clé.',
          'Ne forcez pas sur la trappe : elle casserait. L’atelier retire le bouchon sans abîmer la trappe, puis vous posez un bouchon neuf.', 'Bouchon verrouillable neuf, retiré et posé par l’atelier')
      )],
      ['La trappe de remplissage est cassée', shop('La trappe de remplissage est cassée.',
        'L’eau de pluie peut entrer dans la carrosserie par une trappe cassée : l’atelier la change et refait l’étanchéité.',
        'Trappe de remplissage neuve, posée par l’atelier', null, 'etanch')],
    ]),
  },
  {
    id: 'p_bequilles',
    cat: 'ext',
    label: 'Mes béquilles de stabilisation sont dures, tordues ou ne stabilisent pas',
    eq: 'bequilles',
    kw: 'béquilles vérins de stabilisation manivelle dures grippées tordue bloquée stabilise pas bouge sol mou',
    tree: ask('Que se passe-t-il ?', [
      ['Elles sont dures à tourner', funnel(
        ['Brossez la boue et la poussière sur la vis, puis graissez-la avec une graisse spéciale vérins. Est-ce réglé ?', buy('La vis de la béquille était encrassée.',
          'Faites-le à chaque printemps, et rentrez les béquilles propres.', 'Graisse spéciale vérins de stabilisation')],
        ['La béquille est-elle tordue (elle frotte d’un côté) ?', shop('La béquille a été tordue.',
          'Remontez-la si possible et ne l’utilisez plus. L’atelier la change et contrôle sa fixation au châssis.', 'Béquilles de stabilisation de rechange, posées par l’atelier',
          'Les béquilles stabilisent mais ne soulèvent jamais le véhicule.'), ['Oui', 'Non']],
        shop('Le mécanisme de la béquille est grippé.',
          'Graissée et droite, elle reste dure : l’atelier la change.', 'Béquilles de stabilisation de rechange, posées par l’atelier')
      )],
      ['Une béquille est tordue', shop('La béquille a été tordue.',
        'Remontez-la si possible et ne l’utilisez plus. L’atelier la change et contrôle sa fixation au châssis.', 'Béquilles de stabilisation de rechange, posées par l’atelier',
        'Les béquilles stabilisent mais ne soulèvent jamais le véhicule.')],
      ['Le véhicule bouge encore béquilles descendues', funnel(
        ['Les béquilles s’enfoncent-elles dans le sol (herbe, terre, sable) ?', buy('Les béquilles s’enfoncent dans le sol mou.',
          'Posez des patins larges sous chaque béquille : ils répartissent le poids et ne s’enfoncent pas.', 'Patins larges pour béquilles de stabilisation'), ['Oui', 'Non, le sol est dur']],
        buy('Les béquilles ne portent pas bien sur le sol.',
          'Descendez-les jusqu’au sol puis serrez d’un ou deux tours seulement : elles stabilisent, elles ne soulèvent pas. Pour mettre à niveau, utilisez des cales d’abord, les béquilles ensuite.', 'Cales de nivellement')
      )],
    ]),
  },
  {
    id: 'p_coulissante',
    cat: 'ext',
    label: 'Ma porte latérale coulissante est dure, grince ou ferme mal',
    eq: 'porte',
    kw: 'porte coulissante latérale fourgon van dure grince glisse mal rail galet ferme mal claquer s ouvre seule pente',
    tree: ask('Que se passe-t-il ?', [
      ['Elle est dure à faire glisser ou grince', funnel(
        ['Brossez les trois rails (haut, milieu et bas), puis pulvérisez une graisse en spray pour rails. Est-ce réglé ?', buy('Les rails de la porte coulissante étaient encrassés.',
          'Refaites-le deux fois par an, et passez un lubrifiant silicone sur les joints.', 'Graisse en spray pour rails et lubrifiant silicone pour joints')],
        shop('Un galet de la porte coulissante est usé.',
          'Rails propres et graissés, la porte force encore : l’atelier contrôle et change les galets.', 'Galets de porte coulissante, posés par l’atelier')
      )],
      ['Elle ne ferme plus du premier coup', funnel(
        ['Passez un lubrifiant silicone sur les joints et graissez la gâche, puis fermez d’un geste franc. Ferme-t-elle du premier coup ?', buy('Les joints secs freinaient la fermeture de la porte.',
          'Entretenez les joints et la gâche à chaque saison : la porte se ferme sans la claquer.', 'Lubrifiant silicone pour joints et graisse en spray', NO_DRIVE_DOOR), ['Oui, c’est réglé', 'Non, toujours pas']],
        shop('La gâche de la porte coulissante est déréglée.',
          'Ne la claquez pas plus fort. L’atelier règle la gâche et les galets.', 'Réglage de la porte coulissante à l’atelier', NO_DRIVE_DOOR)
      )],
      ['Elle ne reste plus ouverte dans une pente', shop('La butée d’ouverture de la porte est usée.',
        'Le cran qui tient la porte ouverte ne retient plus : attention aux doigts dans les pentes. L’atelier change la butée.', 'Butée d’ouverture de porte coulissante, posée par l’atelier')],
    ]),
  },
  {
    id: 'p_carrosserie',
    cat: 'ext',
    label: 'Ma carrosserie est rayée ou percée, ou mon pare-brise a un impact',
    kw: 'carrosserie rayure rayée branche paroi trou percée fissure polyester aluminium pare-brise impact gravillon éclat fissure grêle',
    tree: ask('Qu’avez-vous ?', [
      ['Une rayure sur la carrosserie', funnel(
        ['Lavez la zone puis passez l’ongle sur la rayure : accroche-t-il ?', ask('La paroi elle-même est-elle entamée (fente, éclat, trou) ?', [
          ['Oui', shop('La paroi de la cellule est entamée.',
            'L’eau peut entrer par la fente et abîmer la paroi. Garez-vous à l’abri de la pluie : l’atelier répare et contrôle l’étanchéité.',
            'Réparation de paroi et test d’étanchéité à l’atelier', null, 'etanch')],
          ['Non, seule la peinture est touchée', buy('La rayure atteint le fond de la peinture.',
            'Un stylo de retouche à la teinte du véhicule protège la tôle ou le polyester.', 'Stylo de retouche peinture à la teinte de votre véhicule')],
        ]), ['Oui, il accroche', 'Non, elle est légère']],
        buy('La rayure est seulement en surface.',
          'Passez à la main un polish rénovateur pour carrosserie de camping-car. Une cire protège ensuite.', 'Polish rénovateur et cire pour carrosserie de camping-car')
      )],
      ['Un impact sur le pare-brise', ask('L’impact est-il plus petit qu’une pièce de 2 euros, et hors du champ de vision du conducteur ?', [
        ['Oui', buy('Un gravillon a fait un petit impact sur le pare-brise.',
          'Protégez-le vite avec un kit de réparation d’impact : il s’étend avec le froid et les secousses. Faites-le contrôler à la prochaine visite ; il est souvent pris en charge par l’assurance.',
          'Kit de réparation d’impact de pare-brise')],
        ['Non, il est plus grand ou devant le conducteur', shop('L’impact du pare-brise est trop grand pour une réparation maison.',
          'Faites-le réparer ou changer vite par un professionnel : il peut se fissurer en roulant. C’est souvent pris en charge par l’assurance.',
          'Réparation ou remplacement du pare-brise par un professionnel')],
      ])],
      ['Un trou ou une fissure dans une paroi de la cellule', shop('La paroi de la cellule est percée.',
        'Même un petit trou laisse entrer l’eau dans la paroi. Garez-vous à l’abri de la pluie et prenez rendez-vous : l’atelier répare et contrôle l’étanchéité.',
        'Réparation de paroi et test d’étanchéité à l’atelier', null, 'etanch')],
    ]),
  },
  {
    id: 'p_toitrelevable',
    cat: 'hum',
    label: 'Mon toit relevable prend l’eau ou sa toile est tachée ou moisie',
    eq: 'toit_rel',
    kw: 'toit relevable toile soufflet moisie moisissure taches tachée prend l eau fuit joint imperméable van fourgon',
    tree: ask('Que se passe-t-il ?', [
      ['De l’eau entre quand il est fermé', funnel(
        ['Rouvrez puis refermez le toit en vérifiant que la toile rentre bien à l’intérieur et que les sangles sont serrées. L’eau entre-t-elle encore à la prochaine pluie ?', shop('Le joint du toit relevable ne plaque plus.',
          'Toile bien rentrée et sangles serrées, l’eau entre encore : l’atelier contrôle le joint et le toit.', 'Joint de toit relevable et contrôle d’étanchéité à l’atelier', null, 'etanch'), ['Oui, encore', 'Non, c’est réglé']],
        buy('La toile était pincée dans la fermeture du toit.',
          'Rentrez toujours la toile vers l’intérieur en fermant : pincée, elle laisse passer l’eau et s’use. Un nettoyant pour joints garde le joint souple.', 'Nettoyant et lubrifiant pour joints')
      )],
      ['La toile est tachée ou moisie', funnel(
        ['Ouvrez le toit par temps sec et laissez sécher la toile une journée. Les taches partent-elles en brossant à sec ?', buy('La toile a été repliée humide.',
          'Ne laissez jamais la toile repliée mouillée plus de quelques jours. Un nettoyant spécial toile de toit relevable entretient la toile.', 'Nettoyant pour toile de toit relevable'), ['Oui', 'Non, elles restent']],
        buy('La toile est tachée par la moisissure.',
          'Toile ouverte et sèche, passez un nettoyant anti-moisissure spécial toile de toit relevable, puis un imperméabilisant.', 'Nettoyant anti-moisissure et imperméabilisant pour toile de toit relevable')
      )],
      ['La toile laisse passer l’eau quand il est ouvert', funnel(
        ['L’eau passe-t-elle par une couture ou un trou ?', buy('Une couture de la toile n’est plus étanche.',
          'Un produit d’étanchéité pour coutures se passe à l’intérieur, toile sèche. Un trou se répare avec un kit de réparation pour toile.', 'Étanchéité pour coutures et kit de réparation de toile'), ['Oui', 'Non, à travers la toile']],
        buy('L’imperméabilisation de la toile est usée.',
          'Nettoyez la toile, puis pulvérisez un imperméabilisant spécial toile de toit relevable, toit ouvert et sec.', 'Imperméabilisant pour toile de toit relevable')
      )],
    ]),
  },
  {
    id: 'p_convertisseur',
    cat: 'elec',
    label: 'Mon convertisseur 230 V bipe ou se coupe',
    eq: 'onduleur',
    kw: 'convertisseur onduleur 230 v bipe se coupe alarme surcharge pur sinus appareil marche mal chargeur ordinateur',
    tree: ask('Que se passe-t-il ?', [
      ['Il se coupe dès que je branche un appareil', funnel(
        ['Regardez la puissance (en W) écrite sur l’appareil : est-elle plus forte que celle du convertisseur ?', buy('L’appareil demande plus que le convertisseur.',
          'Un appareil plus fort que le convertisseur le fait couper. Il faut alors un convertisseur plus puissant, ou un appareil 12 V.', 'Convertisseur pur sinus de puissance adaptée',
          'Si les câbles du convertisseur chauffent, coupez-le et passez à l’atelier.'), ['Oui, plus forte', 'Non, plus faible']],
        ['L’appareil a-t-il un moteur ou un compresseur (cafetière, sèche-cheveux, glacière) ?', buy('Le démarrage de l’appareil dépasse la puissance du convertisseur.',
          'Un moteur ou un compresseur demande deux à trois fois sa puissance au démarrage. Il faut un convertisseur avec une pointe de démarrage suffisante.', 'Convertisseur pur sinus de puissance adaptée'), ['Oui', 'Non']],
        shop('Le convertisseur est en défaut.',
          'Il coupe avec un petit appareil : l’atelier contrôle le convertisseur et ses câbles.', 'Contrôle du convertisseur à l’atelier')
      )],
      ['Il bipe puis se coupe au bout d’un moment', funnel(
        ['Regardez la tension de la batterie cellule au panneau : est-elle sous 12 V ?', buy('La batterie cellule est trop basse.',
          'Le convertisseur se coupe pour protéger la batterie. Rechargez-la (230 V, moteur ou solaire) et voyez le diagnostic « Ma batterie cellule se décharge très vite ».', 'Moniteur de batterie'), ['Oui, sous 12 V', 'Non, au-dessus']],
        ['Le convertisseur est-il chaud et dans un coffre fermé ?', buy('Le convertisseur surchauffe faute d’aération.',
          'Il a besoin d’air : dégagez ses grilles et laissez le coffre entrouvert, ou faites ajouter une grille d’aération.', 'Grille d’aération pour coffre'), ['Oui', 'Non']],
        shop('Le convertisseur se coupe sans raison visible.',
          'Batterie bonne et aération dégagée : l’atelier contrôle le convertisseur et la section des câbles.', 'Contrôle du convertisseur à l’atelier')
      )],
      ['Un appareil branché dessus marche mal ou grésille', buy('Le convertisseur à onde modifiée ne convient pas à cet appareil.',
        'Les chargeurs d’ordinateur, les appareils à moteur et certains écrans demandent un convertisseur « pur sinus ». Regardez l’étiquette du vôtre.', 'Convertisseur pur sinus')],
    ]),
  },
];

module.exports = { CLIENTS_2026_10_B };
