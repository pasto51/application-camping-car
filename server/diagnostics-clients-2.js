'use strict';

// Second batch (October 2026): frequent problems found on Wikicampers, owners' forums (routard.com) and accessory
// stores (camping-car-plus, mon-camping-car, h2r-equipements) that no diagnostic covered yet. Same rules as the first
// batch: each end point names a product sold in a camping-car accessory store, or sends to the workshop.

const buy = (cause, geste, prod, sec = null) => ({ cause, geste, prod, sec, achat: true });
const shop = (cause, geste, prod, sec = null, rdv = 'atelier') => ({ cause, geste, prod, sec, rdv, pro: true });

const NO_DRIVE_DOOR = 'Ne roulez jamais avec une porte au premier cran : elle peut s’ouvrir en roulant.';
const LID = 'Ne passez jamais la tête ni les mains sous un couvercle qui ne tient pas : calez-le d’abord.';
const FUEL = 'Carburant : pas de flamme ni de cigarette près du véhicule, aérez, et ne buvez pas cette eau.';

const CLIENTS_2026_10_B = [
  {
    id: 'p_porte',
    cat: 'ext',
    label: 'Ma porte de cellule ferme mal (il faut la claquer, elle reste au premier cran)',
    kw: 'porte cellule ferme mal claquer premier cran deuxième cran gâche ressort charnière affaissée frotte jour joint fermeture centralisée verrouille toute seule télécommande poignée dure',
    tree: {
      t: 'Que se passe-t-il ?',
      o: [
        'Elle reste au premier cran',
        'Elle frotte ou laisse passer le jour autour du joint',
        'Elle se verrouille toute seule ou ne répond plus à la télécommande',
        'La poignée ou la serrure est dure',
      ],
      n: [
        {
          t: 'Fermée d’un geste franc (sans la claquer fort), passe-t-elle le deuxième cran ?',
          o: ['Oui, avec un geste franc', 'Non, jamais'],
          n: [
            buy(
              'Le joint sec de la porte freine la fermeture.',
              'Entretenez le joint et la gâche avec un lubrifiant silicone pour joints : la porte se ferme ensuite d’un geste normal. Vérifiez toujours le deuxième cran avant de partir.',
              'Lubrifiant silicone pour joints et serrures',
              NO_DRIVE_DOOR
            ),
            shop(
              'La gâche de la porte est déréglée.',
              'Verrouillez à clé en attendant et vérifiez la porte avant chaque départ. L’atelier règle la gâche, change son ressort si besoin et contrôle les charnières.',
              'Kit de ressorts de gâche pour porte de cellule, posé par l’atelier',
              NO_DRIVE_DOOR
            ),
          ],
        },
        shop(
          'La porte s’est affaissée sur ses charnières.',
          'Un jour autour du joint laisse passer l’air et l’eau. L’atelier règle les charnières et la gâche, et change le joint s’il est écrasé.',
          'Joint de porte de cellule neuf, posé par l’atelier'
        ),
        shop(
          'La fermeture centralisée croit la porte ouverte.',
          'Gardez toujours une clé sur vous : la porte peut se verrouiller seule. Ouvrez puis refermez avec le bouton du tableau de bord. Si le défaut revient, l’atelier contrôle le contacteur de la porte.',
          'Contrôle de la fermeture centralisée à l’atelier'
        ),
        buy(
          'La serrure de la porte est encrassée.',
          'Pulvérisez un lubrifiant spécial serrures dans le barillet et sur le pêne, puis faites jouer la poignée plusieurs fois. Si la clé coince, voyez le diagnostic « Ma clé coince ».',
          'Lubrifiant spécial serrures et barillets'
        ),
      ],
    },
  },
  {
    id: 'p_baie',
    cat: 'ext',
    label: 'Ma baie (fenêtre) ne tient plus ouverte, ne ferme plus, est rayée, fendue ou pleine de buée entre les vitres',
    eq: 'baies',
    kw: 'baie fenêtre hublot retombe tient plus ouverte compas vérin bras cran rayée rayure ternie fendue fissure cassée buée entre les vitres double vitrage verrou poignée ferme plus acrylique plexiglas',
    tree: {
      t: 'Que se passe-t-il avec la baie ?',
      o: [
        'Elle retombe, elle ne tient plus ouverte',
        'Elle ne se verrouille plus',
        'Elle est rayée ou ternie',
        'Elle est fendue',
        'Il y a de la buée entre les deux vitres',
      ],
      n: [
        {
          t: 'Le bras sur le côté de la baie (le compas) tient-il avec des crans ?',
          o: ['Oui, mais les crans ne tiennent plus', 'Non, c’est un bras à gaz qui ne pousse plus'],
          n: [
            buy(
              'Le cliquet du compas est usé.',
              'Le compas se change par paire, à la hauteur de la baie. Relevez la marque, le modèle et la hauteur écrits dans un angle du cadre et apportez-les au magasin.',
              'Paire de compas de baie à la hauteur de votre fenêtre',
              'Ne roulez jamais baie ouverte : elle peut s’arracher.'
            ),
            buy(
              'Le compas à gaz de la baie est fatigué.',
              'Relevez la marque, le modèle et la hauteur de la baie (écrits dans un angle du cadre) : le magasin vous donne la paire de compas qui va avec.',
              'Paire de compas à gaz à la hauteur de votre fenêtre',
              'Ne roulez jamais baie ouverte : elle peut s’arracher.'
            ),
          ],
        },
        buy(
          'Le verrou de la baie est cassé.',
          'Les verrous et poignées de baie se vendent au modèle de la fenêtre : apportez une photo et la marque au magasin. En attendant, ne roulez pas avec cette baie non verrouillée.',
          'Verrou de baie au modèle de votre fenêtre'
        ),
        buy(
          'La surface acrylique de la baie est rayée.',
          'Les baies sont en acrylique, pas en verre : un produit pour vitres ou une éponge qui gratte les raye. Les rayures fines partent avec un kit de rénovation spécial acrylique, puis lavez-les avec un nettoyant spécial baies.',
          'Kit de rénovation et nettoyant pour baies acryliques'
        ),
        shop(
          'Le vitrage acrylique est fendu.',
          'Une fissure laisse entrer l’eau et s’agrandit avec le froid. L’atelier commande le vitrage au modèle (écrit dans un angle du cadre) et le pose étanche.',
          'Vitrage de baie de rechange, posé par l’atelier'
        ),
        shop(
          'Le double vitrage n’est plus étanche.',
          'La buée entre les deux vitres ne part pas en essuyant : le vitrage est à changer. Ce n’est pas urgent tant que la baie ne fuit pas.',
          'Vitrage de baie de rechange, posé par l’atelier'
        ),
      ],
    },
  },
  {
    id: 'p_robinet',
    cat: 'eau',
    label: 'Mon robinet ou ma douchette goutte, ou la pompe ne démarre pas avec un robinet',
    eq: 'pompe',
    kw: 'robinet mitigeur goutte fuit bec levier cartouche céramique douchette flexible pommeau fuite pompe démarre pas contacteur micro-contact clic robinet',
    tree: {
      t: 'Qu’est-ce qui ne va pas ?',
      o: [
        'Le robinet goutte par le bec, même fermé',
        'Ça fuit sous le levier ou au pied du robinet',
        'La douchette ou son flexible fuit',
        'La pompe ne démarre pas avec un seul robinet',
      ],
      n: [
        buy(
          'La cartouche du mitigeur est usée.',
          'Coupez la pompe. La cartouche céramique se change sans changer le robinet : notez la marque du mitigeur et apportez l’ancienne cartouche au magasin. Sur un mitigeur ancien, un mitigeur neuf spécial camping-car est souvent plus simple.',
          'Cartouche céramique pour mitigeur de camping-car'
        ),
        buy(
          'Le raccord du robinet est desserré.',
          'Coupez la pompe et resserrez à la main le raccord sous l’évier. Si ça fuit toujours, changez le raccord rapide ou le flexible du robinet.',
          'Raccords rapides et flexibles pour robinet de camping-car'
        ),
        buy(
          'Le joint de la douchette est usé.',
          'Resserrez à la main les deux bouts du flexible. Si l’eau sort encore, changez la douchette et son flexible : il en existe avec un bouton d’arrêt qui économise l’eau.',
          'Douchette avec flexible et bouton d’arrêt pour camping-car'
        ),
        {
          t: 'Entendez-vous un petit clic en ouvrant ce robinet ?',
          o: ['Non, aucun clic', 'Oui, il clique mais la pompe ne démarre pas'],
          n: [
            buy(
              'Le contacteur du robinet ne commande plus la pompe.',
              'Ces robinets ont un petit contacteur électrique qui démarre la pompe. Quand il s’use, changez le mitigeur par un modèle à contacteur spécial camping-car.',
              'Mitigeur à contacteur pour camping-car'
            ),
            shop(
              'Le courant du contacteur n’arrive plus à la pompe.',
              'Le contacteur clique mais la pompe reste muette : un fil est sans doute débranché sous l’évier. L’atelier contrôle le câblage de la pompe.',
              'Contrôle du câblage de la pompe à l’atelier'
            ),
          ],
        },
      ],
    },
  },
  {
    id: 'p_placard',
    cat: 'ext',
    label: 'Mes placards ou mes tiroirs s’ouvrent en roulant (bouton poussoir cassé)',
    eq: 'plac',
    kw: 'placard tiroir s ouvre en roulant bouton poussoir push lock fermeture cassé gâche porte de meuble charnière arrachée vis tiennent plus',
    tree: {
      t: 'Que constatez-vous ?',
      o: [
        'Le bouton poussoir reste enfoncé ou ne ressort plus',
        'Le bouton marche mais la porte s’ouvre quand même',
        'Une charnière de la porte est arrachée',
      ],
      n: [
        buy(
          'Le bouton poussoir est cassé.',
          'Le bouton poussoir se change en entier (bouton, mécanisme et gâche). Mesurez le diamètre du trou dans la porte et apportez l’ancien bouton au magasin.',
          'Bouton poussoir de placard complet pour camping-car',
          'Avant de rouler, vérifiez que tous les placards hauts sont fermés : un placard ouvert projette des objets.'
        ),
        buy(
          'La gâche du placard est décalée.',
          'La gâche est la petite pièce fixée sur le meuble où le bouton s’accroche. Revissez-la bien en face. Si ses vis ne tiennent plus, une gâche neuve se pose un peu à côté.',
          'Gâche et vis pour bouton poussoir de placard'
        ),
        buy(
          'La charnière de la porte est arrachée.',
          'Le panneau léger des meubles tient mal une vis arrachée : une charnière de meuble neuve se pose un peu à côté, avec des chevilles spéciales panneaux. Si le panneau est fendu, passez à l’atelier.',
          'Charnières de meuble et chevilles pour panneaux de camping-car'
        ),
      ],
    },
  },
  {
    id: 'p_verin',
    cat: 'ext',
    label: 'Mon coffre, mon lit relevable ou une porte de placard ne tient plus ouvert (vérin à gaz)',
    kw: 'vérin à gaz coffre couvercle lit relevable sommier soute placard abattant porte retombe tient plus ouvert tombe',
    tree: {
      t: 'Qu’est-ce qui ne tient plus ouvert ?',
      o: ['Un couvercle de coffre ou une porte de placard', 'Le sommier du lit (lit relevable, accès à la soute)'],
      n: [
        buy(
          'Le vérin à gaz est fatigué.',
          'Calez d’abord le couvercle ouvert. Relevez la longueur et la force (en newtons, N) écrites sur le vérin et prenez-en un identique. S’il y en a deux, changez les deux ensemble.',
          'Vérin à gaz de même longueur et même force',
          LID
        ),
        shop(
          'Les vérins du sommier sont fatigués.',
          'Un sommier est lourd : calez-le ouvert avec un support solide. Notez les valeurs écrites sur les vérins : le magasin vous les fournit, et l’atelier les pose si le lit est lourd.',
          'Paire de vérins à gaz pour sommier relevable',
          LID
        ),
      ],
    },
  },
  {
    id: 'p_frigoporte',
    cat: 'frigo',
    label: 'La porte de mon frigo s’ouvre en roulant ou son verrou est cassé',
    eq: 'frigo',
    kw: 'porte frigo réfrigérateur s ouvre en roulant verrou poignée cassée fermeture de route affaissée frotte charnière contre-porte',
    tree: {
      t: 'Que se passe-t-il ?',
      o: ['Elle s’ouvre en roulant', 'Le verrou ou la poignée est cassé', 'La porte est affaissée ou frotte'],
      n: [
        {
          t: 'Enclenchez-vous le verrou de route de la porte avant de partir ?',
          o: ['Je ne savais pas qu’il y en avait un', 'Oui, et elle s’ouvre quand même'],
          n: [
            buy(
              'Le verrou de route de la porte n’était pas enclenché.',
              'La plupart des frigos ont un verrou de route sur la poignée ou en haut de la porte : enclenchez-le à chaque départ, avec vos vérifications avant la route. Une barre de maintien empêche aussi les aliments de tomber.',
              'Barre de maintien pour réfrigérateur'
            ),
            buy(
              'Le verrou de la porte est usé.',
              'Le verrou se change au modèle du frigo : relevez la marque et le modèle sur la plaque à l’intérieur. En attendant, un verrou de sécurité adhésif pour frigo tient la porte fermée.',
              'Verrou de porte de réfrigérateur au modèle'
            ),
          ],
        },
        buy(
          'La poignée de la porte est cassée.',
          'La poignée et son verrou se vendent au modèle du frigo : relevez la marque et le modèle sur la plaque à l’intérieur et apportez-les au magasin.',
          'Poignée et verrou de porte de réfrigérateur au modèle'
        ),
        shop(
          'La porte du frigo est affaissée sur sa charnière.',
          'Une contre-porte trop chargée (bouteilles) fait descendre la porte, et le joint ne ferme plus. Allégez-la. L’atelier règle ou change la charnière.',
          'Charnière de porte de réfrigérateur, posée par l’atelier'
        ),
      ],
    },
  },
  {
    id: 'p_soute',
    cat: 'ext',
    label: 'Ma porte de soute ferme mal, sa charnière est dure ou la soute prend l’eau',
    eq: 'soute',
    kw: 'soute coffre extérieur porte de soute charnière dure grince serrure joint bâille ferme mal eau dans la soute humide mouillée plancher',
    tree: {
      t: 'Que se passe-t-il ?',
      o: ['La serrure de la soute coince', 'La charnière est dure ou grince', 'La porte ne plaque plus (elle bâille)', 'Il y a de l’eau dans la soute'],
      n: [
        buy(
          'La serrure de la soute est encrassée.',
          'Pulvérisez un lubrifiant spécial serrures dans le barillet, puis faites jouer la clé plusieurs fois. Si la clé reste coincée ou casse, voyez le diagnostic « Ma clé coince ».',
          'Lubrifiant spécial serrures et barillets'
        ),
        buy(
          'La charnière de la soute est grippée.',
          'Porte ouverte, pulvérisez un lubrifiant pour charnières tout le long et faites jouer la porte plusieurs fois. Remettez les petits bouchons au bout de la charnière s’ils manquent : ils empêchent l’eau d’entrer.',
          'Lubrifiant pour charnières et bouchons de charnière de soute'
        ),
        buy(
          'Le joint de la porte de soute est écrasé.',
          'Un joint écrasé ne plaque plus : changez-le avec un joint de soute au mètre. Si la porte elle-même est voilée, l’atelier la règle.',
          'Joint de porte de soute au mètre'
        ),
        {
          t: 'L’eau arrive-t-elle après la pluie ou un lavage ?',
          o: ['Oui', 'Non, même sans pluie'],
          n: [
            shop(
              'L’eau de pluie entre par la porte de soute.',
              'Épongez et laissez sécher porte ouverte : un plancher de soute mouillé finit par pourrir. Le test d’étanchéité trouve l’endroit exact.',
              'Test d’étanchéité à l’atelier',
              null,
              'etanch'
            ),
            buy(
              'Un tuyau d’eau fuit dans la soute.',
              'Des tuyaux passent souvent par la soute. Coupez la pompe, repérez le raccord mouillé et voyez le diagnostic « J’ai une fuite d’eau ».',
              'Raccords rapides pour circuit d’eau'
            ),
          ],
        },
      ],
    },
  },
  {
    id: 'p_siege',
    cat: 'ext',
    label: 'Mon siège de cabine ne pivote plus ou ne se verrouille plus',
    eq: 'sieges',
    kw: 'siège cabine pivotant pivote plus tourne plus embase bloqué verrouille plus conducteur passager levier frein à main',
    tree: {
      t: 'Que se passe-t-il ?',
      o: ['Il ne pivote plus', 'Il pivote mais ne se verrouille plus face à la route'],
      n: [
        {
          t: 'Avez-vous avancé ou reculé le siège, relevé les accoudoirs et baissé le frein à main ?',
          o: ['Non, pas encore', 'Oui, et il ne tourne toujours pas'],
          n: [
            buy(
              'Le siège est gêné par le frein à main.',
              'Pour tourner, le siège doit être avancé ou reculé, accoudoirs relevés, porte ouverte et frein à main baissé. Tirez ensuite le levier de l’embase et tournez. Une poignée de frein à main rabattable facilite la manœuvre.',
              'Poignée de frein à main rabattable',
              'Baissez le frein à main seulement véhicule à l’arrêt, vitesse engagée et roues calées.'
            ),
            shop(
              'L’embase pivotante est grippée.',
              'Ne forcez pas sur le siège. L’atelier nettoie et graisse l’embase, ou la change par une embase pivotante homologuée.',
              'Embase pivotante homologuée, posée par l’atelier'
            ),
          ],
        },
        shop(
          'Le verrou de l’embase ne s’enclenche plus.',
          'Un siège non verrouillé ne protège pas en cas de choc. L’atelier contrôle le verrou de l’embase et la change si besoin.',
          'Embase pivotante homologuée, posée par l’atelier',
          'Ne roulez jamais avec un siège qui n’est pas verrouillé face à la route.'
        ),
      ],
    },
  },
  {
    id: 'p_table',
    cat: 'ext',
    label: 'Le pied de ma table est bloqué, la table descend toute seule ou branle',
    eq: 'table',
    kw: 'table pied de table télescopique descend toute seule bloqué levier vérin branle bouge platine dinette',
    tree: {
      t: 'Que se passe-t-il avec la table ?',
      o: ['Elle descend toute seule', 'Le pied est bloqué, je ne peux plus la régler', 'Elle branle'],
      n: [
        buy(
          'Le vérin du pied de table est fatigué.',
          'Mettez la table au plus bas avant de manger pour ne pas vous pincer les doigts. Le pied télescopique se change : relevez sa hauteur, son diamètre et le type de fixation.',
          'Pied de table télescopique de rechange'
        ),
        buy(
          'Le mécanisme du pied de table est grippé.',
          'Actionnez le levier en soulevant légèrement le plateau : le pied se libère souvent. Un spray silicone sur le tube aide. S’il reste bloqué, le pied se change.',
          'Spray silicone et pied de table télescopique de rechange'
        ),
        buy(
          'La platine du pied est desserrée.',
          'Resserrez les vis de la platine sous le plateau et au sol. Si les vis ne tiennent plus, une platine neuve se pose un peu à côté.',
          'Platine de fixation pour pied de table'
        ),
      ],
    },
  },
  {
    id: 'p_latte',
    cat: 'ext',
    label: 'Une latte de mon lit est cassée ou sortie de son support',
    kw: 'latte lit sommier cassée sortie embout support plastique craque matelas',
    tree: {
      t: 'Qu’est-ce qui ne va pas ?',
      o: ['La latte est sortie de son embout', 'La latte est cassée', 'L’embout en plastique est cassé'],
      n: [
        buy(
          'La latte est sortie de son embout.',
          'Soulevez le matelas et remettez la latte dans ses deux embouts. Si elle ressort, l’embout est usé : changez-le.',
          'Embouts de latte de lit'
        ),
        buy(
          'La latte de lit est cassée.',
          'Mesurez la longueur, la largeur (souvent 53 mm) et l’épaisseur, et prenez une latte courbée identique avec ses embouts.',
          'Latte de lit courbée aux dimensions et ses embouts'
        ),
        buy(
          'L’embout de la latte est cassé.',
          'Notez la largeur de la latte et apportez l’embout cassé au magasin : ils se vendent par lot.',
          'Embouts de latte de lit'
        ),
      ],
    },
  },
  {
    id: 'p_lampe',
    cat: 'elec',
    label: 'Une lumière (spot, plafonnier) ne s’allume plus ou clignote',
    eq: 'led',
    kw: 'lumière spot plafonnier lampe ampoule led ne s allume plus clignote faible éclaire mal liseuse réglette g4',
    tree: {
      t: 'Que se passe-t-il ?',
      o: ['Une seule lumière ne marche plus', 'Elle clignote ou éclaire faiblement', 'Plusieurs lumières ne marchent plus'],
      n: [
        {
          t: 'Lumière éteinte, mettez à la place l’ampoule d’un autre spot qui marche. S’allume-t-elle ?',
          o: ['Oui, avec l’autre ampoule', 'Non, toujours rien'],
          n: [
            buy(
              'L’ampoule LED est grillée.',
              'Prenez une ampoule LED 12 V au même culot (souvent G4) : apportez l’ancienne au magasin.',
              'Ampoule LED 12 V au culot d’origine'
            ),
            buy(
              'Le spot ne reçoit plus le courant.',
              'Le fusible de l’éclairage a peut-être sauté : voyez le diagnostic « Plus de courant dans la cellule » (un seul appareil). Si le fusible est bon, un spot LED neuf se pose à la place.',
              'Spot LED 12 V de rechange'
            ),
          ],
        },
        buy(
          'L’ampoule LED supporte mal les variations de tension.',
          'Certaines ampoules LED premier prix clignotent quand la tension de la batterie varie. Prenez des ampoules LED spéciales camping-car (10 à 30 V). Si toutes les lumières faiblissent ensemble, la batterie est basse.',
          'Ampoules LED spéciales camping-car (10 à 30 V)'
        ),
        buy(
          'Le circuit d’éclairage est coupé.',
          'Plusieurs lumières ensemble : voyez le diagnostic « Plus de courant dans la cellule (12 V) » (fusible, coupe-circuit, batterie).',
          'Fusibles plats assortis'
        ),
      ],
    },
  },
  {
    id: 'p_carburant',
    cat: 'eau',
    label: 'J’ai mis de l’essence ou du gazole dans le réservoir d’eau',
    kw: 'essence gazole diesel carburant réservoir d eau erreur trappe bouchon plein mauvais réservoir odeur carburant eau',
    tree: {
      t: 'Avez-vous ouvert un robinet ou fait tourner la pompe depuis ?',
      o: ['Non, rien du tout', 'Oui, l’eau est passée dans les robinets'],
      n: [
        shop(
          'Le carburant est resté dans le réservoir d’eau.',
          'N’ouvrez aucun robinet et ne lancez pas la pompe. L’atelier vidange et nettoie le réservoir. Ensuite, un désinfectant spécial réservoir d’eau et des repères sur les trappes évitent de recommencer.',
          'Nettoyant désinfectant pour réservoir d’eau et repères de trappe',
          FUEL
        ),
        shop(
          'Le carburant est passé dans le circuit d’eau.',
          'Coupez la pompe et le chauffe-eau. Les tuyaux, la pompe et le chauffe-eau doivent être rincés et contrôlés, parfois changés : l’atelier s’en occupe.',
          'Nettoyage du circuit d’eau à l’atelier',
          FUEL
        ),
      ],
    },
  },
  {
    id: 'p_bouchon',
    cat: 'eau',
    label: 'J’ai perdu le bouchon ou la clé du réservoir d’eau',
    kw: 'bouchon réservoir eau propre perdu clé perdue trappe remplissage cassée verrouillable',
    tree: {
      t: 'Que se passe-t-il ?',
      o: ['Le bouchon est perdu', 'J’ai perdu la clé du bouchon', 'La trappe de remplissage est cassée'],
      n: [
        buy(
          'Le bouchon du réservoir est perdu.',
          'Mesurez le diamètre de l’ouverture (souvent 40 ou 60 mm) et prenez un bouchon verrouillable à clé. Le réservoir est resté ouvert : désinfectez-le avant de boire l’eau.',
          'Bouchon verrouillable pour réservoir d’eau et désinfectant de réservoir'
        ),
        buy(
          'La clé du bouchon est perdue.',
          'Un bouchon verrouillable se change en entier avec ses clés. S’il est fermé, ne forcez pas sur la trappe : le magasin vous conseille.',
          'Bouchon verrouillable pour réservoir d’eau'
        ),
        shop(
          'La trappe de remplissage est cassée.',
          'L’eau de pluie peut entrer dans la carrosserie par une trappe cassée : l’atelier la change et refait l’étanchéité.',
          'Trappe de remplissage neuve, posée par l’atelier',
          null,
          'etanch'
        ),
      ],
    },
  },
  {
    id: 'p_bequilles',
    cat: 'ext',
    label: 'Mes béquilles de stabilisation sont dures, tordues ou ne stabilisent pas',
    eq: 'bequilles',
    kw: 'béquilles vérins de stabilisation manivelle dures grippées tordue bloquée stabilise pas bouge sol mou',
    tree: {
      t: 'Que se passe-t-il ?',
      o: ['Elles sont dures à tourner', 'Une béquille est tordue', 'Le véhicule bouge encore béquilles descendues'],
      n: [
        buy(
          'La vis de la béquille est encrassée.',
          'Brossez la boue et la poussière sur la vis, puis graissez avec une graisse spéciale vérins. Faites-le à chaque printemps.',
          'Graisse spéciale vérins de stabilisation'
        ),
        shop(
          'La béquille a été tordue.',
          'Remontez-la si possible et ne l’utilisez plus. L’atelier la change et contrôle sa fixation au châssis.',
          'Béquilles de stabilisation de rechange, posées par l’atelier',
          'Les béquilles stabilisent mais ne soulèvent jamais le véhicule.'
        ),
        buy(
          'Les béquilles ne portent pas bien sur le sol.',
          'Descendez-les jusqu’au sol puis serrez d’un ou deux tours seulement : elles stabilisent, elles ne soulèvent pas. Pour mettre à niveau, utilisez des cales. Sur sol mou, des patins larges les empêchent de s’enfoncer.',
          'Patins larges pour béquilles de stabilisation'
        ),
      ],
    },
  },
  {
    id: 'p_coulissante',
    cat: 'ext',
    label: 'Ma porte latérale coulissante est dure, grince ou ferme mal',
    eq: 'porte',
    kw: 'porte coulissante latérale fourgon van dure grince glisse mal rail galet ferme mal claquer s ouvre seule pente',
    tree: {
      t: 'Que se passe-t-il ?',
      o: ['Elle est dure à faire glisser ou grince', 'Elle ne ferme plus du premier coup', 'Elle ne reste plus ouverte dans une pente'],
      n: [
        buy(
          'Les rails de la porte coulissante sont encrassés.',
          'Brossez les trois rails (haut, milieu et bas), puis pulvérisez une graisse en spray pour rails et un lubrifiant silicone sur les joints.',
          'Graisse en spray pour rails et lubrifiant silicone pour joints'
        ),
        shop(
          'La gâche de la porte coulissante est déréglée.',
          'Ne la claquez pas plus fort. L’atelier règle la gâche et les galets.',
          'Réglage de la porte coulissante à l’atelier',
          NO_DRIVE_DOOR
        ),
        shop(
          'La butée d’ouverture de la porte est usée.',
          'Le cran qui tient la porte ouverte ne retient plus : attention aux doigts dans les pentes. L’atelier change la butée.',
          'Butée d’ouverture de porte coulissante, posée par l’atelier'
        ),
      ],
    },
  },
  {
    id: 'p_carrosserie',
    cat: 'ext',
    label: 'Ma carrosserie est rayée ou percée, ou mon pare-brise a un impact',
    kw: 'carrosserie rayure rayée branche paroi trou percée fissure polyester aluminium pare-brise impact gravillon éclat fissure grêle',
    tree: {
      t: 'Qu’avez-vous ?',
      o: ['Une rayure sur la carrosserie', 'Un impact sur le pare-brise', 'Un trou ou une fissure dans une paroi de la cellule'],
      n: [
        {
          t: 'Passez l’ongle sur la rayure : accroche-t-il ?',
          o: ['Non, elle est légère', 'Oui, elle est profonde'],
          n: [
            buy(
              'La rayure est seulement en surface.',
              'Lavez, puis passez à la main un polish rénovateur pour carrosserie de camping-car. Une cire protège ensuite.',
              'Polish rénovateur et cire pour carrosserie de camping-car'
            ),
            buy(
              'La rayure atteint le fond de la peinture.',
              'Un stylo de retouche à la teinte du véhicule protège la tôle ou le polyester. Si la paroi est entamée, faites contrôler qu’il n’y a pas d’infiltration.',
              'Stylo de retouche peinture à la teinte de votre véhicule'
            ),
          ],
        },
        shop(
          'Un gravillon a fait un impact sur le pare-brise.',
          'Faites-le réparer vite : un impact s’étend avec le froid et les secousses. Un kit de réparation d’impact le protège en attendant. Un impact dans le champ de vision du conducteur se répare chez un professionnel, souvent pris en charge par l’assurance.',
          'Kit de réparation d’impact de pare-brise'
        ),
        shop(
          'La paroi de la cellule est percée.',
          'Même un petit trou laisse entrer l’eau dans la paroi. Garez-vous à l’abri de la pluie et prenez rendez-vous : l’atelier répare et contrôle l’étanchéité.',
          'Réparation de paroi et test d’étanchéité à l’atelier',
          null,
          'etanch'
        ),
      ],
    },
  },
  {
    id: 'p_toitrelevable',
    cat: 'hum',
    label: 'Mon toit relevable prend l’eau ou sa toile est tachée ou moisie',
    eq: 'toit_rel',
    kw: 'toit relevable toile soufflet moisie moisissure taches tachée prend l eau fuit joint imperméable van fourgon',
    tree: {
      t: 'Que se passe-t-il ?',
      o: ['De l’eau entre quand il est fermé', 'La toile est tachée ou moisie', 'La toile laisse passer l’eau quand il est ouvert'],
      n: [
        shop(
          'Le joint du toit relevable ne plaque plus.',
          'Vérifiez que la toile n’est pas pincée à la fermeture et que les sangles sont bien serrées. Si l’eau entre encore, l’atelier contrôle le joint et le toit.',
          'Joint de toit relevable et contrôle d’étanchéité à l’atelier',
          null,
          'etanch'
        ),
        buy(
          'La toile a été repliée humide.',
          'Ouvrez le toit par temps sec pour bien sécher la toile. Les taches de moisissure partent avec un nettoyant spécial toile de toit relevable. Ne laissez jamais la toile repliée mouillée plus de quelques jours.',
          'Nettoyant pour toile de toit relevable'
        ),
        buy(
          'L’imperméabilisation de la toile est usée.',
          'Nettoyez la toile, puis pulvérisez un imperméabilisant spécial toile de toit relevable, toit ouvert et sec.',
          'Imperméabilisant pour toile de toit relevable'
        ),
      ],
    },
  },
  {
    id: 'p_convertisseur',
    cat: 'elec',
    label: 'Mon convertisseur 230 V bipe ou se coupe',
    eq: 'onduleur',
    kw: 'convertisseur onduleur 230 v bipe se coupe alarme surcharge pur sinus appareil marche mal chargeur ordinateur',
    tree: {
      t: 'Que se passe-t-il ?',
      o: ['Il se coupe dès que je branche un appareil', 'Il bipe puis se coupe au bout d’un moment', 'Un appareil branché dessus marche mal ou grésille'],
      n: [
        buy(
          'L’appareil demande plus que le convertisseur.',
          'Regardez la puissance (en W) écrite sur l’appareil : elle doit rester sous celle du convertisseur. Un moteur ou un compresseur demande deux à trois fois plus au démarrage. Il faut alors un convertisseur plus puissant.',
          'Convertisseur pur sinus de puissance adaptée',
          'Si les câbles du convertisseur chauffent, coupez-le et passez à l’atelier.'
        ),
        buy(
          'La batterie cellule est trop basse.',
          'Le convertisseur se coupe pour protéger la batterie. Rechargez-la (230 V, moteur ou solaire) et voyez le diagnostic « Ma batterie cellule se décharge très vite ».',
          'Moniteur de batterie'
        ),
        buy(
          'Le convertisseur à onde modifiée ne convient pas à cet appareil.',
          'Les chargeurs d’ordinateur, les appareils à moteur et certains écrans demandent un convertisseur « pur sinus ».',
          'Convertisseur pur sinus'
        ),
      ],
    },
  },
];

module.exports = { CLIENTS_2026_10_B };
