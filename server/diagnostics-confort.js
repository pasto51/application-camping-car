'use strict';

// Everyday comfort problems that lead to a product sold by the store (the most frequent complaints on camping-car forums).
// Each end point names the product (« En rayon ») and is marked « achat »: « Demander au magasin » then sends an accessory
// request, which goes to the store. Installation is done by the store, which has its own workshop.

const leaf = (cause, geste, prod, sec = null) => ({ cause, geste, prod, sec, achat: true });
const POSE = 'Le magasin vous conseille le bon modèle et le fait poser.';

const CONFORT = [
  {
    id: 'p_buee',
    cat: 'hum',
    label: 'J’ai de la buée ou du givre sur le pare-brise le matin',
    kw: 'buée pare-brise givre condensation vitres cabine matin humidité isolant extérieur volet isotherme rideau thermique cabine froide hiver ruisselle',
    tree: {
      t: 'Avez-vous une protection isolante sur le pare-brise la nuit ?',
      o: ['Non, rien', 'Oui, à l’intérieur (rideau ou isolant)', 'Oui, à l’extérieur'],
      n: [
        leaf(
          'Le pare-brise froid fait condenser l’humidité de la cellule.',
          'Un isolant posé à l’extérieur garde la vitre presque à la température de l’intérieur : la buée ne se forme plus. En été, il garde aussi la cabine au frais. Il existe pour chaque porteur (Ducato, Transit, Master…).',
          'Isolant extérieur de pare-brise et vitres de cabine'
        ),
        leaf(
          'Un isolant intérieur laisse la vitre froide derrière lui.',
          'L’humidité passe derrière l’isolant intérieur et se dépose sur la vitre glacée. Posé à l’extérieur, l’isolant supprime ce problème.',
          'Isolant extérieur de pare-brise et vitres de cabine'
        ),
        {
          t: 'La nuit, laissez-vous un aérateur ou un lanterneau entrouvert ?',
          o: ['Non, tout est fermé', 'Oui'],
          n: [
            leaf(
              'L’humidité de la nuit reste enfermée dans la cellule.',
              'Deux personnes rejettent près d’un litre d’eau par nuit : laissez un aérateur entrouvert et placez un absorbeur d’humidité dans la cabine.',
              'Absorbeur d’humidité rechargeable'
            ),
            leaf(
              'L’air de la cellule reste très humide malgré l’aération.',
              'Un absorbeur posé dans la cabine capte l’humidité avant qu’elle n’atteigne les vitres. Si les parois restent mouillées, faites contrôler l’étanchéité.',
              'Absorbeur d’humidité rechargeable'
            ),
          ],
        },
      ],
    },
  },
  {
    id: 'p_humide',
    cat: 'hum',
    label: 'J’ai de l’humidité sous les matelas ou dans les placards',
    kw: 'humidité matelas moisissure dessous du lit condensation placards soute parois mouillées odeur de moisi sous-matelas aéré isolant',
    tree: {
      t: 'Où trouvez-vous l’humidité ?',
      o: ['Sous les matelas', 'Dans les placards ou la soute'],
      n: [
        leaf(
          'Le matelas posé à plat empêche l’air de circuler dessous.',
          'Un sous-matelas aéré laisse passer l’air sous le matelas : plus de condensation ni de moisissure.',
          'Sous-matelas aéré anti-condensation'
        ),
        leaf(
          'Les parois froides des placards font condenser l’air.',
          'Un isolant adhésif sur les parois les garde tièdes, et un absorbeur d’humidité capte le reste.',
          'Isolant adhésif pour parois et absorbeur d’humidité'
        ),
      ],
    },
  },
  {
    id: 'p_chaleur',
    cat: 'chauf',
    label: 'Il fait trop chaud dans le camping-car en été (surtout la nuit)',
    kw: 'trop chaud chaleur été canicule nuit étouffant cellule cabine soleil ventilation ventilateur lanterneau extracteur climatisation stores occultants isolant extérieur',
    tree: {
      t: 'Dans la journée, le pare-brise et les baies sont-ils protégés du soleil ?',
      o: ['Non', 'Oui'],
      n: [
        leaf(
          'Le soleil chauffe la cellule à travers le pare-brise et les baies.',
          'Un isolant extérieur sur le pare-brise renvoie le soleil avant qu’il ne chauffe la vitre : la cabine reste bien plus fraîche.',
          'Isolant extérieur de pare-brise et stores occultants'
        ),
        {
          t: 'Le soir, l’air circule-t-il dans la cellule ?',
          o: ['Non, l’air ne bouge pas', 'Oui, mais il fait encore trop chaud'],
          n: [
            leaf(
              'L’air chaud reste bloqué sous le toit.',
              `Un lanterneau à ventilateur chasse l’air chaud et fait entrer l’air frais du soir, même sous la pluie. ${POSE}`,
              'Lanterneau ventilé (extracteur d’air)'
            ),
            leaf(
              'La ventilation ne suffit plus par forte chaleur.',
              `La climatisation de toit rafraîchit et sèche l’air. Elle demande du 230 V (camping). ${POSE}`,
              'Climatisation de toit'
            ),
          ],
        },
      ],
    },
  },
  {
    id: 'p_froid',
    cat: 'chauf',
    label: 'J’ai froid dans le camping-car en hiver (sol froid, cabine glacée)',
    kw: 'froid hiver sol froid pieds froids cabine glacée courant d’air chauffage ne suffit pas isolation tapis moquette rideau de séparation isolant pare-brise lanterneau',
    tree: {
      t: 'D’où vient surtout le froid ?',
      o: ['Du sol', 'De la cabine', 'Des lanterneaux et des baies'],
      n: [
        leaf(
          'Le plancher laisse passer le froid.',
          'Une moquette de cellule ou un tapis isolant coupe le froid du plancher et rend la cellule plus agréable.',
          'Moquette de cellule ou tapis de sol isolant'
        ),
        leaf(
          'La cabine et ses vitres refroidissent la cellule.',
          'Un rideau isolant entre la cabine et la cellule, avec un isolant extérieur de pare-brise, garde la chaleur dans la partie vie.',
          'Rideau isolant de séparation cabine et isolant extérieur de pare-brise'
        ),
        leaf(
          'La chaleur s’échappe par les lanterneaux et les baies.',
          'Des isolants à poser sur les lanterneaux et les baies la nuit gardent la chaleur et réduisent la consommation du chauffage.',
          'Isolants de lanterneaux et de baies'
        ),
      ],
    },
  },
  {
    id: 'p_gaz',
    cat: 'gaz',
    label: 'Ma bouteille de gaz se vide trop vite ou je tombe en panne de gaz',
    kw: 'bouteille de gaz vide trop vite panne de gaz hiver consommation chauffage deuxième bouteille inverseur automatique jauge niveau de gaz bouteille rechargeable gpl propane',
    tree: {
      t: 'Combien de bouteilles avez-vous à bord ?',
      o: ['Une seule', 'Deux ou plus'],
      n: [
        leaf(
          'Une seule bouteille ne suffit pas pour chauffer en hiver.',
          `Avec deux bouteilles et un inverseur automatique, le gaz passe tout seul sur la bouteille pleine : plus de panne en pleine nuit. ${POSE}`,
          'Inverseur automatique et deuxième bouteille de gaz',
          'Le raccordement du gaz se fait uniquement par un professionnel.'
        ),
        {
          t: 'Savez-vous ce qu’il reste dans la bouteille en service ?',
          o: ['Non, je le découvre quand elle est vide', 'Oui'],
          n: [
            leaf(
              'Rien n’indique le niveau de gaz restant.',
              'Un indicateur de niveau se pose sur la bouteille et vous prévient avant qu’elle ne soit vide.',
              'Indicateur de niveau de gaz'
            ),
            leaf(
              'Le chauffage consomme beaucoup de gaz par grand froid.',
              `Une bouteille rechargeable se remplit à la pompe GPL des stations-service, sans échange ni recherche de bouteille. En hiver, préférez le propane. ${POSE}`,
              'Bouteille de gaz rechargeable (GPL)',
              'Le raccordement du gaz se fait uniquement par un professionnel.'
            ),
          ],
        },
      ],
    },
  },
  {
    id: 'p_autonomie',
    cat: 'elec',
    label: 'Ma batterie ne tient pas plus d’un ou deux jours sans camping (frigo, lumières…)',
    kw: 'batterie ne tient pas autonomie électrique frigo à compression vide la batterie deux jours sans camping hors camping lithium panneau solaire booster chargeur en roulant moniteur de batterie',
    tree: {
      t: 'Quelle est la batterie de votre cellule ?',
      o: ['Une batterie classique (plomb, AGM ou gel)', 'Une batterie lithium', 'Je ne sais pas'],
      n: [
        {
          t: 'Avez-vous un panneau solaire sur le toit ?',
          o: ['Non', 'Oui'],
          n: [
            leaf(
              'Sans panneau solaire la batterie se vide dès que vous ne roulez plus.',
              `Un panneau solaire recharge la batterie chaque jour, même à l’arrêt. ${POSE}`,
              'Kit panneau solaire avec régulateur'
            ),
            leaf(
              'Une batterie classique ne donne qu’environ la moitié de sa capacité.',
              `À taille égale, une batterie lithium donne presque deux fois plus d’énergie, se recharge plus vite et pèse moins lourd. Le chargeur et le régulateur doivent être adaptés : ${POSE.toLowerCase()}`,
              'Batterie lithium'
            ),
          ],
        },
        {
          t: 'Le panneau solaire la recharge-t-il complètement les jours de soleil ?',
          o: ['Non, ou je n’ai pas de panneau', 'Oui, mais pas par temps gris'],
          n: [
            leaf(
              'La production solaire est trop faible pour ce que vous consommez.',
              `Un panneau supplémentaire augmente la recharge chaque jour. ${POSE}`,
              'Panneau solaire supplémentaire'
            ),
            leaf(
              'Par temps gris la recharge solaire ne suffit pas.',
              `Un chargeur en roulant (booster) recharge la batterie de la cellule beaucoup plus vite pendant que vous roulez. ${POSE}`,
              'Chargeur de batterie en roulant (booster)'
            ),
          ],
        },
        leaf(
          'Il faut connaître votre consommation pour choisir la bonne solution.',
          'Un moniteur de batterie affiche ce qui reste et ce que vous consommez. Avec ces chiffres, le magasin vous conseille la bonne solution : lithium, solaire ou booster.',
          'Moniteur de batterie'
        ),
      ],
    },
  },
  {
    id: 'p_recharge',
    cat: 'elec',
    label: 'Je ne peux pas recharger mon ordinateur ou mes vélos électriques sans camping',
    kw: 'recharger ordinateur portable vélo électrique batterie vae sans camping 230 v prise convertisseur 12 v 230 v pur sinus prise usb téléphone tablette',
    tree: {
      t: 'Que voulez-vous recharger ?',
      o: ['Un téléphone ou une tablette', 'Un ordinateur portable', 'Les batteries de vélos électriques'],
      n: [
        leaf(
          'Il manque une prise USB rapide en 12 V.',
          'Une prise USB double à charge rapide se branche sur le 12 V de la cellule et recharge vite téléphones et tablettes.',
          'Prise USB double charge rapide 12 V'
        ),
        leaf(
          'L’ordinateur a besoin d’une prise 230 V.',
          'Un petit convertisseur pur sinus transforme le 12 V de la batterie en 230 V pour l’ordinateur, sans risque pour ses composants.',
          'Convertisseur 12 V / 230 V pur sinus (environ 300 W)'
        ),
        leaf(
          'Les chargeurs de vélos électriques demandent trop de puissance pour une petite prise.',
          `Il faut un convertisseur pur sinus puissant relié directement à une batterie de cellule de bonne capacité (idéalement lithium). ${POSE}`,
          'Convertisseur pur sinus 1000 W ou plus'
        ),
      ],
    },
  },
  {
    id: 'p_internet',
    cat: 'elec',
    label: 'Je n’ai pas (ou peu) d’internet dans le camping-car',
    kw: 'internet wifi réseau 4g 5g pas de connexion partage de connexion téléphone capte mal routeur antenne toit wifi du camping trop loin satellite starlink box',
    tree: {
      t: 'Comment vous connectez-vous aujourd’hui ?',
      o: ['Avec le partage de connexion du téléphone', 'Avec le wifi des campings', 'Je n’ai rien'],
      n: [
        leaf(
          'Le téléphone capte mal à l’intérieur de la cellule.',
          `Une antenne sur le toit capte bien mieux qu’un téléphone à l’intérieur, et le routeur partage la connexion à tous vos appareils. ${POSE}`,
          'Routeur 4G/5G avec antenne de toit'
        ),
        leaf(
          'Le wifi du camping est trop loin pour être capté.',
          'Une antenne wifi amplificatrice capte le wifi du camping de beaucoup plus loin.',
          'Antenne wifi amplificatrice'
        ),
        leaf(
          'Il n’y a aucun équipement internet à bord.',
          'Un routeur 4G/5G avec une carte SIM vous donne internet partout où il y a du réseau mobile. Pour les zones isolées, le magasin peut vous présenter l’internet par satellite.',
          'Routeur 4G/5G'
        ),
      ],
    },
  },
  {
    id: 'p_eau',
    cat: 'eau',
    label: 'Je manque d’eau propre au bout de deux ou trois jours',
    kw: 'eau propre manque d’eau réservoir trop petit autonomie eau douche consomme pommeau économique mousseur économiseur jerrican pliable tuyau remplissage',
    tree: {
      t: 'Qu’est-ce qui consomme le plus d’eau chez vous ?',
      o: ['Les douches', 'La vaisselle et la cuisine', 'Je ne sais pas'],
      n: [
        leaf(
          'La douche consomme la plus grande partie de l’eau.',
          'Un pommeau de douche économique avec arrêt d’eau divise la consommation sans perdre en confort.',
          'Pommeau de douche économique avec stop-eau'
        ),
        leaf(
          'Le robinet ouvert en continu gaspille l’eau.',
          'Un mousseur économiseur se visse sur le robinet et réduit nettement le débit.',
          'Mousseur économiseur d’eau pour robinet'
        ),
        leaf(
          'Le réservoir se refait plus facilement avec une réserve d’appoint.',
          'Un jerrican pliable d’eau alimentaire et un tuyau à embouts universels permettent de compléter le plein partout.',
          'Jerrican pliable d’eau alimentaire et tuyau de remplissage universel'
        ),
      ],
    },
  },
  {
    id: 'p_cassette',
    cat: 'wc',
    label: 'La cassette de mes toilettes est pleine trop vite',
    eq: 'wc',
    kw: 'cassette toilettes pleine trop vite vidange trop souvent autonomie wc deuxième cassette de rechange toilettes sèches à séparation',
    tree: {
      t: 'Que cherchez-vous ?',
      o: ['Tenir quelques jours de plus', 'Ne presque plus avoir à vider'],
      n: [
        leaf(
          'Une seule cassette limite votre autonomie.',
          'Une deuxième cassette se range dans la soute et double votre autonomie : vous videz quand cela vous arrange.',
          'Cassette de rechange avec bouchon'
        ),
        leaf(
          'Les toilettes à cassette se remplissent vite d’eau de chasse.',
          `Les toilettes sèches à séparation ne demandent ni eau ni produit chimique et se vident beaucoup moins souvent. ${POSE}`,
          'Toilettes sèches à séparation'
        ),
      ],
    },
  },
  {
    id: 'p_balan',
    cat: 'ext',
    label: 'Mon camping-car penche ou balance en virage (roulis)',
    kw: 'balance roulis penche virage arrière bas affaissé charge soute porte-vélos suspensions pneumatiques auxiliaires amortisseurs renforcés vent latéral camions tangue',
    tree: {
      t: 'Que constatez-vous ?',
      o: ['L’arrière est plus bas une fois chargé', 'Il balance même peu chargé', 'Il est secoué par le vent et les camions'],
      n: [
        leaf(
          'Les ressorts arrière s’affaissent sous la charge.',
          `Des suspensions pneumatiques auxiliaires se gonflent selon la charge : le véhicule reste droit et balance beaucoup moins. ${POSE}`,
          'Suspensions pneumatiques auxiliaires',
          'Elles n’augmentent pas le poids autorisé : respectez le PTAC inscrit sur la carte grise.'
        ),
        leaf(
          'Les amortisseurs d’origine sont trop souples pour le poids de la cellule.',
          `Des amortisseurs renforcés pour camping-car tiennent mieux la cellule en virage. ${POSE}`,
          'Amortisseurs renforcés pour camping-car'
        ),
        leaf(
          'La grande surface du camping-car prend le vent sur le côté.',
          `Des suspensions pneumatiques auxiliaires et des amortisseurs renforcés stabilisent nettement le véhicule face au vent. ${POSE}`,
          'Suspensions pneumatiques auxiliaires et amortisseurs renforcés'
        ),
      ],
    },
  },
  {
    id: 'p_manoeuvre',
    cat: 'ext',
    label: 'J’ai du mal à manœuvrer ou à reculer',
    kw: 'manœuvre reculer marche arrière difficile angle mort visibilité arrière caméra de recul écran radar de recul rétroviseur créneau',
    tree: {
      t: 'Qu’est-ce qui vous gêne le plus ?',
      o: ['La marche arrière', 'Les angles morts en roulant'],
      n: [
        leaf(
          'La cellule cache tout l’arrière du véhicule.',
          `Une caméra de recul avec écran montre l’arrière en direct, de jour comme de nuit. ${POSE}`,
          'Caméra de recul avec écran'
        ),
        leaf(
          'Les rétroviseurs ne montrent pas les côtés de la cellule.',
          `Des caméras d’angle mort sous les rétroviseurs montrent les côtés du véhicule. ${POSE}`,
          'Caméras d’angle mort'
        ),
      ],
    },
  },
  {
    id: 'p_niveau',
    cat: 'ext',
    label: 'Le camping-car n’est pas droit quand je m’arrête (je dors mal)',
    kw: 'pas droit pente niveau dormir mal tête en bas frigo niveau cales de mise à niveau niveau à bulle vérins stabilisation',
    tree: {
      t: 'Comment le mettez-vous à niveau aujourd’hui ?',
      o: ['Je ne le mets pas à niveau', 'Avec des cales, mais c’est pénible'],
      n: [
        leaf(
          'Le sol de l’emplacement est en pente.',
          'Des cales de mise à niveau et un petit niveau à bulle suffisent pour dormir droit (et votre frigo marche mieux à plat).',
          'Cales de mise à niveau et niveau à bulle'
        ),
        leaf(
          'La mise à niveau avec des cales demande plusieurs manœuvres.',
          `Des vérins de stabilisation mettent le véhicule à niveau sans manœuvre et le rendent plus stable à l’arrêt. ${POSE}`,
          'Vérins de stabilisation'
        ),
      ],
    },
  },
  {
    id: 'p_vol',
    cat: 'ext',
    label: 'J’ai peur des vols ou des intrusions',
    kw: 'vol cambriolage intrusion sécurité nuit peur dormir serrure verrou supplémentaire alarme gps antivol porte cabine porte cellule coffre-fort',
    tree: {
      t: 'Quand êtes-vous le plus inquiet ?',
      o: ['Quand je dors à bord', 'Quand je laisse le camping-car', 'Pour mes objets de valeur'],
      n: [
        leaf(
          'Les serrures d’origine s’ouvrent facilement.',
          `Des verrous de sécurité intérieurs sur les portes cabine et cellule bloquent l’ouverture pendant que vous dormez. ${POSE}`,
          'Verrous de sécurité pour portes cabine et cellule'
        ),
        leaf(
          'Le véhicule n’a pas d’alarme.',
          `Une alarme avec localisation GPS vous prévient sur votre téléphone et aide à retrouver le véhicule. ${POSE}`,
          'Alarme avec localisation GPS'
        ),
        leaf(
          'Les objets de valeur restent à la vue dans la cellule.',
          `Un coffre-fort fixé dans un placard met papiers et objets de valeur à l’abri. ${POSE}`,
          'Coffre-fort pour camping-car'
        ),
      ],
    },
  },
  {
    id: 'p_moustiques',
    cat: 'ext',
    label: 'Les moustiques et les insectes entrent dans le camping-car',
    kw: 'moustiques insectes mouches entrent porte d’entrée moustiquaire déchirée baie lanterneau la nuit',
    tree: {
      t: 'Par où entrent-ils ?',
      o: ['Par la porte d’entrée', 'Par une baie ou un lanterneau'],
      n: [
        leaf(
          'La porte d’entrée n’a pas de moustiquaire.',
          `Une moustiquaire de porte permet de laisser la porte ouverte sans insectes. ${POSE}`,
          'Moustiquaire de porte d’entrée'
        ),
        leaf(
          'Une moustiquaire de baie est abîmée.',
          'La toile de moustiquaire se remplace : notez le modèle de la baie ou du lanterneau (étiquette dans le cadre).',
          'Moustiquaire de rechange pour baie ou lanterneau'
        ),
      ],
    },
  },
  {
    id: 'p_ombre',
    cat: 'ext',
    label: 'Je n’ai pas d’ombre ni d’abri devant le camping-car',
    kw: 'ombre soleil devant terrasse store de façade auvent abri pluie vent de côté paroi latérale pare-vent',
    tree: {
      t: 'Avez-vous déjà un store de façade ?',
      o: ['Non', 'Oui, mais le soleil ou le vent passe sur le côté'],
      n: [
        leaf(
          'Il n’y a pas de store sur la façade.',
          `Un store de façade donne une vraie terrasse ombragée en quelques tours de manivelle. ${POSE}`,
          'Store de façade'
        ),
        leaf(
          'Le store protège du dessus mais pas des côtés.',
          'Des parois latérales se fixent au store et coupent le vent et le soleil rasant.',
          'Parois latérales pour store (pare-vent)'
        ),
      ],
    },
  },
  {
    id: 'p_rangement',
    cat: 'ext',
    label: 'Je manque de place pour ranger',
    kw: 'manque de place rangement soute pleine vélos chaises table encombrant porte-vélos rangements suspendus filets organisateur',
    tree: {
      t: 'Qu’est-ce qui prend trop de place ?',
      o: ['Les vélos', 'Les chaises, la table et le matériel extérieur', 'Les affaires à l’intérieur'],
      n: [
        leaf(
          'Les vélos prennent toute la soute.',
          `Un porte-vélos libère la soute et se charge facilement. ${POSE}`,
          'Porte-vélos',
          'Respectez la charge maximale du porte-vélos et le poids total autorisé du véhicule.'
        ),
        leaf(
          'Le mobilier d’extérieur classique est encombrant.',
          'Des chaises et une table extra-plates se rangent dans un espace très fin de la soute.',
          'Mobilier de camping extra-plat'
        ),
        leaf(
          'Les placards ne sont pas organisés pour les petites affaires.',
          'Des rangements suspendus et des filets utilisent l’espace perdu derrière les portes et sous les lits.',
          'Rangements suspendus et filets de rangement'
        ),
      ],
    },
  },
  {
    id: 'p_lumiere',
    cat: 'elec',
    label: 'L’éclairage est faible ou vide trop la batterie',
    kw: 'éclairage faible lumière jaune ampoule consomme trop batterie led réglette spot lecture',
    tree: {
      cause: 'Les anciennes ampoules éclairent peu et consomment beaucoup.',
      geste: 'Des ampoules et réglettes LED 12 V éclairent mieux et consomment jusqu’à dix fois moins.',
      prod: 'Ampoules et réglettes LED 12 V',
      sec: null,
      achat: true,
    },
  },
  {
    id: 'p_lit',
    cat: 'ext',
    label: 'Je dors mal : le lit est inconfortable ou la lumière me réveille',
    kw: 'dormir mal lit inconfortable matelas dur fin mal au dos surmatelas lumière réveille tôt occultant rideaux cabine',
    tree: {
      t: 'Qu’est-ce qui vous gêne ?',
      o: ['Le matelas', 'La lumière du jour trop tôt'],
      n: [
        leaf(
          'Le matelas d’origine est fin.',
          'Un surmatelas à mémoire de forme, coupé à la forme de votre lit, change vraiment les nuits.',
          'Surmatelas sur mesure pour camping-car'
        ),
        leaf(
          'La lumière passe par la cabine et les baies.',
          'Un store plissé occultant pour la cabine et des rideaux occultants font le noir complet.',
          'Store occultant de cabine'
        ),
      ],
    },
  },
  {
    id: 'p_detecteur',
    cat: 'gaz',
    label: 'Je voudrais dormir tranquille côté gaz et monoxyde de carbone',
    kw: 'détecteur gaz monoxyde de carbone co sécurité nuit alarme dormir tranquille chauffage fuite',
    tree: {
      cause: 'Aucun détecteur ne surveille l’air de la cellule.',
      geste: 'Un détecteur gaz et monoxyde de carbone sonne dès qu’il détecte un danger, même la nuit.',
      prod: 'Détecteur gaz et monoxyde de carbone',
      sec: 'Un détecteur ne remplace pas l’entretien : faites contrôler l’installation gaz et le chauffage chaque année.',
      achat: true,
    },
  },
  {
    id: 'p_dehors',
    cat: 'gaz',
    label: 'Je voudrais cuisiner dehors sans tout sortir',
    kw: 'cuisiner dehors barbecue plancha extérieur prise de gaz extérieure odeurs de cuisine dans la cellule',
    tree: {
      cause: 'Cuisiner à l’intérieur garde les odeurs et la chaleur dans la cellule.',
      geste: `Une plancha ou un barbecue à gaz branché sur une prise de gaz extérieure se raccorde en un geste, sans bouteille à transporter. ${POSE}`,
      prod: 'Plancha ou barbecue à gaz et prise de gaz extérieure',
      sec: 'La prise de gaz extérieure se pose uniquement par un professionnel. Cuisinez toujours à l’air libre.',
      achat: true,
    },
  },
];

module.exports = { CONFORT };
