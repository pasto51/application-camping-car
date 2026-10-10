'use strict';

// Fifth batch (October 2026): problems that really happen to camping-car and van owners, found on forums and
// manufacturer pages (Routard, Matmut forum, Camping-car.com, Truma, Dometic, Wikicampers, Campingcar
// Bricoloisirs…) and not covered yet. Funnels (see diag-helpers.js): the simplest check first, one cause per end,
// a product sold in a camping-car accessory store, the workshop last. Type questions answered by the app itself
// (vk/vv) and diagnostics of one type only (vonly), as the rule says.

const { buy, shop, funnel, ask } = require('./diag-helpers');

const none = (cause, geste, sec = null) => ({ cause, geste, prod: 'Aucun produit nécessaire', sec });
const YN = ['Oui', 'Non'];
const GAS_SEC = 'Odeur de gaz : fermez la bouteille, n’allumez rien, aérez et sortez. Après un choc, faites contrôler l’étanchéité du circuit gaz.';
const V230_SEC = 'Picotement ou décharge : débranchez le câble côté borne, sans toucher la carrosserie pieds nus ou mouillés, et ne vous rebranchez pas tant que la cause n’est pas trouvée.';
const BAT_SEC = 'Batterie qui chauffe, gonfle ou sent l’œuf pourri : débranchez le 230 V, coupez le solaire, aérez, ne fumez pas et ne touchez pas la batterie.';
const ROAD_SEC = 'Garez-vous hors de la voie, feux de détresse, gilet et triangle. Sur autoroute, appelez l’assistance depuis une borne orange : ne changez pas la roue vous-même.';
const TOW_SEC = 'Ne tractez jamais avec une rotule dont le verrouillage n’est pas confirmé.';

// Regulators with an automatic changeover or a crash sensor: Truma DuoControl, DuoControl CS, MonoControl CS…
const REGULATOR_TYPES = ['v2', 'v3', 'v4', 'v5'];

const REELS = [
  {
    id: 'p_duocontrol',
    cat: 'gaz',
    label: 'Plus de gaz avec mon détendeur Duocontrol ou Monocontrol : sécurité déclenchée, ne bascule pas, fenêtre rouge',
    eq: 'detendeur',
    vonly: ['detendeur', REGULATOR_TYPES],
    kw: 'duocontrol monocontrol duo control mono control cs capteur de choc crash sensor sécurité bouton jaune réarmer inverseur bascule pas fenêtre rouge indicateur bouteille vide détendeur gaz coupé eisex givre',
    tree: ask('Que se passe-t-il ?', [
      ['Plus de gaz du tout, après un choc, un trou ou un freinage brusque', funnel(
        ['Fermez les bouteilles. Appuyez sur le bouton jaune du détendeur en le tournant un peu dans le sens des aiguilles d’une montre et tenez-le 10 secondes, puis rouvrez doucement les bouteilles. Le gaz revient-il ?', buy('Le capteur de choc a coupé le gaz.',
          'C’est sa sécurité : il coupe tout seul après un choc (nid-de-poule, trottoir, freinage brusque). Vérifiez ensuite qu’aucun raccord ne fuit avec une bombe détectrice de fuites.', 'Bombe détectrice de fuites de gaz', GAS_SEC)],
        ['Le bouton jaune ne reste pas enfoncé ? Débranchez les lyres, vérifiez que le détendeur est bien droit sur son support, puis recommencez. Tient-il maintenant ?', buy('Le détendeur était de travers.',
          'Le bouton ne tient que détendeur droit et lyres débranchées. Rebranchez ensuite les lyres et rouvrez les bouteilles doucement.', 'Bombe détectrice de fuites de gaz', GAS_SEC)],
        shop('Le capteur de choc du détendeur ne se réarme plus.', 'Le bouton ne tient plus : l’atelier contrôle le détendeur et le change si besoin, puis vérifie l’étanchéité du circuit.', 'Contrôle du détendeur à l’atelier', GAS_SEC)
      )],
      ['Une bouteille est vide et le gaz ne passe pas sur l’autre', funnel(
        ['Le robinet de la deuxième bouteille est-il ouvert à fond, et la bouteille pleine ? Ouvrez-le doucement. Le gaz revient-il ?', buy('Le robinet de la bouteille de réserve était fermé.',
          'Laissez les deux robinets ouverts : l’inverseur passe seul sur la réserve quand la première bouteille est vide.', 'Jauge de niveau de gaz pour bouteille')],
        ['Tournez le bouton de l’inverseur vers la bouteille pleine (il désigne la bouteille en service). Le gaz revient-il ?', buy('Le bouton de l’inverseur désignait la bouteille vide.',
          'Après chaque changement de bouteille, tournez le bouton vers la bouteille pleine : la fenêtre repasse au vert.', 'Jauge de niveau de gaz pour bouteille')],
        ['Robinet fermé, débranchez puis rebranchez la lyre de la bouteille pleine, et rouvrez le robinet tout doucement. Le gaz revient-il ?', buy('La sécurité anti-rupture de la lyre s’était fermée.',
          'Une ouverture trop brusque du robinet ferme cette sécurité. Ouvrez toujours doucement. Une lyre ancienne se change à sa date limite.', 'Lyre gaz avec sécurité anti-rupture', GAS_SEC)],
        shop('L’inverseur ne bascule plus.', 'Bouteilles et lyres sont bonnes : l’atelier contrôle l’inverseur et le change si besoin.', 'Contrôle de l’inverseur à l’atelier', GAS_SEC)
      )],
      ['La fenêtre de l’inverseur est rouge', funnel(
        ['Rouge veut dire que la bouteille en service est vide et que le gaz vient de la réserve. Changez la bouteille vide, puis tournez le bouton vers la bouteille pleine. La fenêtre repasse-t-elle au vert ?', buy('La bouteille en service était vide : c’est normal.',
          'Pensez à acheter une bouteille quand la fenêtre passe au rouge : il ne vous reste que la réserve.', 'Jauge de niveau de gaz pour bouteille'), ['Oui, c’est vert', 'Non, toujours rouge']],
        shop('L’indicateur de l’inverseur reste bloqué au rouge.', 'Bouteille pleine et bouton tourné, la fenêtre reste rouge : l’atelier contrôle l’inverseur.', 'Contrôle de l’inverseur à l’atelier')
      )],
      ['Le détendeur givre et le gaz faiblit par grand froid', funnel(
        ['Utilisez-vous du butane par temps froid ?', buy('Le butane ne se vaporise plus vers 0 °C.', 'En hiver, roulez au propane : il fonctionne jusqu’à -40 °C.', 'Bouteille de propane'), YN],
        ['Votre détendeur a-t-il son petit chauffage (EisEx) branché et allumé au tableau ?', buy('Le détendeur givre faute de chauffage.', 'Par froid humide, le chauffage du détendeur évite le givre qui bloque le gaz.', 'Chauffage de détendeur'), ['Non, ou il n’en a pas', 'Oui, il est allumé']],
        shop('Le détendeur givre malgré le propane et son chauffage.', 'L’atelier contrôle le détendeur et la pression de sortie.', 'Contrôle du détendeur à l’atelier', GAS_SEC)
      )],
    ]),
  },
  {
    id: 'p_adblue',
    cat: 'ext',
    label: 'Mon camping-car affiche un défaut AdBlue (« démarrage impossible dans … km ») alors que le réservoir est plein',
    kw: 'adblue ad blue défaut démarrage impossible km scr urée réservoir plein voyant moteur euro 6 sonde niveau qualité cristallisé gel',
    tree: funnel(
      ['Remettez au moins 5 litres d’AdBlue d’un coup, contact coupé, puis roulez 10 à 20 km. Le message disparaît-il ?', buy('Le calculateur n’avait pas vu le plein.', 'Un appoint trop petit, ou fait contact mis, passe inaperçu : remettez toujours au moins 5 litres, contact coupé.', 'AdBlue en bidon avec bec verseur')],
      ['L’AdBlue venait-il d’un vieux bidon, ouvert depuis longtemps ou stocké au chaud ou au gel ?', buy('L’AdBlue s’était dégradé.', 'Faites l’appoint avec un AdBlue neuf, puis roulez sur voie rapide. Un AdBlue se garde au frais, bidon fermé, un an au plus.', 'AdBlue neuf aux normes'), YN],
      ['Le message est-il apparu par grand froid (au-dessous de -10 °C) et disparaît-il après 30 minutes de route ?', none('L’AdBlue avait gelé.', 'Il gèle vers -11 °C. Le réservoir a son réchauffeur : le message s’efface une fois l’AdBlue dégelé.'), YN],
      shop('Un élément du circuit AdBlue est en panne.', 'Le message revient avec un AdBlue neuf : prenez rendez-vous tout de suite, avant que le compteur arrive à 0 km. L’atelier lit les codes et contrôle sonde, pompe et réchauffeur ; c’est une panne connue, demandez une prise en charge.', 'Diagnostic du circuit AdBlue à l’atelier',
        'Ne laissez pas le compteur arriver à 0 km : le moteur ne redémarrerait plus, et le dépannage d’un camping-car coûte cher.')
    ),
  },
  {
    id: 'p_modedegrade',
    cat: 'ext',
    label: 'Mon moteur a perdu sa puissance d’un coup et ne monte plus dans les tours (mode dégradé)',
    kw: 'perte de puissance mode dégradé ne monte plus tours turbo durite sifflement voyant moteur egr fap ducato jumper boxer sprinter transit',
    tree: funnel(
      ['Arrêtez-vous en sécurité, coupez le moteur 5 minutes et redémarrez. La puissance revient-elle ?', none('Une sécurité du moteur s’était déclenchée.', 'Cela arrive en côte chargée ou par forte chaleur. Si cela revient souvent, passez à l’atelier.')],
      ['Moteur froid, capot ouvert : une grosse durite noire est-elle déboîtée, fendue ou pleine d’huile ? Entendez-vous un fort sifflement en accélérant ?', shop('Une durite du turbo fuit.', 'Roulez doucement jusqu’à l’atelier, sans forcer le moteur : il change la durite ou son collier. Vérifiez aussi les rappels du constructeur.', 'Remplacement de la durite à l’atelier'), YN],
      ['Faites-vous surtout de petits trajets, et un voyant moteur ou filtre à particules est-il allumé ?', buy('Le filtre à particules est encrassé.', 'Roulez 20 à 30 minutes sur voie rapide pour le régénérer, et utilisez de temps en temps un additif adapté.', 'Additif nettoyant filtre à particules pour gazole'), YN],
      shop('Un capteur du moteur est en défaut.', 'Rien n’a suffi : l’atelier lit les codes et contrôle le circuit d’air, les capteurs et le turbo.', 'Diagnostic moteur à l’atelier',
        'En mode dégradé, évitez l’autoroute : vous ne pourriez pas accélérer pour vous insérer. Voyant rouge : arrêtez-vous.')
    ),
  },
  {
    id: 'p_picote',
    cat: 'elec',
    label: 'Je sens un picotement ou une petite décharge en touchant la carrosserie quand je suis branché',
    eq: 'quai',
    urgent: true,
    kw: 'picotement décharge électrique carrosserie touche châssis courant terre borne camping rallonge 230 v jus électrocution',
    tree: funnel(
      ['Branchez-vous sur une autre borne (ou demandez au camping si la terre est en panne). Le picotement disparaît-il ?', buy('La borne du camping n’a pas de terre.', 'Prévenez le camping et changez de borne. Un petit testeur à brancher avant chaque connexion évite la surprise.', 'Testeur de prise et de polarité 230 V', V230_SEC)],
      ['Essayez avec une autre rallonge, en bon état et sans adaptateur bricolé. Est-ce réglé ?', buy('La rallonge a sa terre coupée.', 'Remplacez-la par une rallonge spéciale camping-car en 3 × 2,5 mm² avec prises bleues, et un adaptateur homologué.', 'Rallonge camping-car 3 × 2,5 mm² avec prises CEE', V230_SEC)],
      ['Coupez un à un les appareils 230 V de la cellule (chargeur, chauffe-eau électrique, frigo sur 230 V). Le picotement disparaît-il quand l’un d’eux est coupé ?', shop('Un appareil 230 V a une fuite de courant.', 'N’utilisez plus cet appareil et faites-le contrôler.', 'Contrôle de l’installation 230 V à l’atelier', V230_SEC), YN],
      shop('La terre de la cellule n’est plus reliée au châssis.', 'L’atelier contrôle la terre jusqu’au châssis, le disjoncteur différentiel et le câblage du convertisseur.', 'Contrôle de l’installation 230 V à l’atelier', V230_SEC)
    ),
  },
  {
    id: 'p_batchauffe',
    cat: 'elec',
    label: 'Ma batterie cellule chauffe, gonfle, ou ça sent l’œuf pourri ou l’acide',
    eq: 'g_batterie',
    vonly: ['g_batterie', ['agm', 'gel']],
    urgent: true,
    kw: 'batterie chauffe gonfle bombée odeur oeuf pourri acide soufre bout surcharge chargeur réglage gel agm',
    tree: funnel(
      ['Le réglage du type de batterie du chargeur (ou du tableau) correspond-il à l’étiquette de la batterie (AGM ou gel) ?', buy('Le chargeur n’est pas réglé sur le bon type de batterie.', 'Réglez le bon type. Une batterie qui a gonflé est abîmée : elle se remplace. Un moniteur de batterie vous montre ensuite la tension.', 'Moniteur de batterie avec shunt', BAT_SEC), ['Non, ou je ne sais pas', 'Oui, c’est le bon réglage']],
      ['Le régulateur solaire est-il réglé sur le même type de batterie ?', buy('Le régulateur solaire surcharge la batterie.', 'Réglez-le sur le bon type. S’il ne se règle pas, un régulateur réglable selon la batterie le remplace.', 'Régulateur solaire MPPT réglable', BAT_SEC), ['Non, ou je ne sais pas', 'Oui']],
      ['La batterie a-t-elle plus de 5 ans, ou une seule des deux batteries chauffe-t-elle ?', buy('La batterie est en fin de vie.', 'Un élément interne est en court-circuit : remplacez la batterie (les deux ensemble si vous en avez deux).', 'Batterie cellule AGM ou gel', BAT_SEC), YN],
      shop('Le chargeur surcharge la batterie.', 'L’atelier mesure les tensions de charge (chargeur, solaire, charge en roulant) et contrôle l’aération du coffre de la batterie.', 'Contrôle de la charge à l’atelier', BAT_SEC)
    ),
  },
  {
    id: 'p_starlink',
    cat: 'elec',
    label: 'Mon Starlink coupe souvent ou vide ma batterie',
    eq: 'wifi',
    kw: 'starlink satellite internet coupe coupure obstruction arbres vide batterie consommation mini antenne parabole',
    tree: funnel(
      ['Dans l’application Starlink, lancez la vérification des obstructions. Le ciel est-il masqué (arbres, lanterneau, antenne, galerie) ?', buy('L’antenne ne voit pas assez de ciel.', 'Déplacez l’antenne ou le véhicule. Un mât ou un pied l’éloigne des obstacles.', 'Mât ou support pour antenne Starlink'), YN],
      ['Les coupures arrivent-elles quand la batterie descend sous 12 V, ou quand le convertisseur bipe ?', buy('Le convertisseur 230 V se coupe quand la batterie baisse.', 'Alimentez le Starlink directement en 12 V : c’est plus économe et il ne coupe plus.', 'Alimentation 12 V pour Starlink'), YN],
      ['Le Starlink reste-t-il allumé la nuit, et la batterie est-elle vide le matin ?', buy('Le Starlink consomme même quand on ne s’en sert pas.', 'Coupez son alimentation la nuit avec un interrupteur ou une minuterie sur sa ligne.', 'Interrupteur ou minuterie 12 V'), YN],
      ['Le câble a-t-il été pincé dans une fenêtre ou une soute ?', buy('Le câble de l’antenne est abîmé.', 'Remplacez le câble et faites-le passer par un passe-câble de toit étanche.', 'Passe-câble de toit étanche'), YN],
      shop('L’alimentation du Starlink est mal installée.', 'L’atelier pose une ligne 12 V dédiée avec fusible et fait le bilan de consommation de vos batteries.', 'Installation d’une alimentation 12 V à l’atelier')
    ),
  },
  {
    id: 'p_routeur',
    cat: 'elec',
    label: 'Mon routeur 4G ou 5G est allumé, le Wi-Fi marche, mais je n’ai pas internet',
    eq: 'wifi',
    kw: 'routeur 4g 5g wifi pas internet sim carte apn code pin forfait data box mobile antenne',
    tree: funnel(
      ['Mettez la carte SIM du routeur dans un téléphone. Internet y marche-t-il ?', none('Le forfait de la carte SIM ne fonctionne pas.', 'Data épuisée, pays hors forfait ou carte non activée : voyez avec votre opérateur.'), ['Non, pas d’internet', 'Oui, ça marche']],
      ['Dans la page de réglage du routeur, un code PIN est-il demandé, ou le nom d’accès de l’opérateur (APN) est-il vide ?', none('Le routeur n’est pas réglé pour votre carte SIM.', 'Désactivez le code PIN, saisissez le nom d’accès de votre opérateur, puis redémarrez le routeur.'), YN],
      ['Le voyant de réseau est-il faible, ou le câble de l’antenne de toit desserré ?', buy('La réception est trop faible.', 'Resserrez le câble. Une antenne de toit dédiée capte bien mieux qu’à l’intérieur.', 'Antenne 4G/5G de toit pour camping-car'), YN],
      ['Internet coupe-t-il au démarrage du moteur ou quand la batterie est faible ?', buy('La tension baisse et le routeur redémarre.', 'Un stabilisateur 12 V garde une tension constante pour le routeur.', 'Stabilisateur de tension 12 V'), YN],
      shop('Le routeur est en défaut.', 'L’atelier contrôle l’antenne, le câblage et l’alimentation, et met le routeur à jour.', 'Contrôle du routeur à l’atelier')
    ),
  },
  {
    id: 'p_crevaison',
    cat: 'ext',
    label: 'J’ai crevé : comment faire avec mon camping-car ?',
    eq: 'secours',
    kw: 'crevaison crevé pneu à plat roue de secours kit anti crevaison cric changer roue berceau treuil',
    tree: funnel(
      ['Le pneu est-il entaillé sur le flanc, ou avez-vous roulé longtemps à plat ?', shop('Le pneu n’est plus réparable.', 'Mettez la roue de secours ou appelez l’assistance : le pneu se remplace, de préférence avec celui du même essieu.', 'Remplacement du pneu chez le pneumaticien', ROAD_SEC), YN],
      ['Avez-vous une roue de secours, ou un kit anti-crevaison ?', buy('Un petit trou dans la bande de roulement se répare avec le kit.', 'Suivez la notice du kit, puis roulez doucement jusqu’au garage pour faire réparer le pneu.', 'Kit anti-crevaison pour camping-car', ROAD_SEC), ['Un kit anti-crevaison', 'Une roue de secours']],
      ['Le berceau de la roue de secours descend-il quand vous tournez la clé du treuil ?', buy('Le treuil du berceau est grippé.', 'Il ne sert jamais et grippe : dégrippez-le maintenant, puis graissez-le chaque printemps.', 'Dégrippant lubrifiant pour mécanisme', ROAD_SEC), ['Non, il est bloqué', 'Oui, il descend']],
      ['Le cric soulève-t-il le véhicule bien droit et stable ?', buy('Le cric n’est pas fait pour le poids du camping-car.', 'Un cric bouteille de bonne capacité, posé sur une plaque d’appui, soulève sans risque. Ne passez jamais sous le véhicule.', 'Cric bouteille hydraulique pour camping-car', ROAD_SEC), ['Non, il peine ou penche', 'Oui']],
      shop('La roue ne se démonte pas.', 'Écrous bloqués ou roue collée : appelez l’assistance.', 'Assistance et pneumaticien', ROAD_SEC)
    ),
  },
  {
    id: 'p_vibre',
    cat: 'ext',
    label: 'Mon volant vibre ou le camping-car tremble vers 80 à 110 km/h',
    eq: 'pneus',
    kw: 'vibration volant vibre tremble tremblement vitesse 90 100 km/h équilibrage méplat pneu hernie',
    tree: funnel(
      ['Le véhicule est-il resté arrêté plusieurs semaines, et la vibration diminue-t-elle après 20 à 30 km ?', buy('Les pneus ont pris des méplats pendant l’arrêt.', 'Ils disparaissent en roulant. Pour le prochain hivernage, posez les roues sur des cales courbes.', 'Cales de roues anti-méplat'), YN],
      ['Les pressions avant et arrière sont-elles celles de l’étiquette (souvent 5 à 5,5 bars) ?', buy('Les pneus sont sous-gonflés.', 'Regonflez à la pression de l’étiquette, à froid.', 'Compresseur 12 V jusqu’à 10 bars'), ['Non, ou je ne sais pas', 'Oui']],
      ['Voyez-vous une bosse sur un flanc ou une usure en vagues ?', shop('Un pneu est déformé.', 'Roulez doucement jusqu’au pneumaticien : il se change sans attendre.', 'Remplacement du pneu chez le pneumaticien', 'Une hernie sur un pneu chargé peut éclater : ne roulez pas vite.'), YN],
      shop('Une roue est déséquilibrée.', 'L’atelier fait l’équilibrage et contrôle le parallélisme, les rotules et les jantes.', 'Équilibrage et géométrie à l’atelier')
    ),
  },
  {
    id: 'p_radar',
    cat: 'ext',
    label: 'Mon radar de recul bipe tout seul ou sonne sans arrêt (souvent avec le porte-vélos)',
    eq: 'camera',
    kw: 'radar recul bip bipe tout seul sonne sans arrêt capteur stationnement porte-vélos aide parking',
    tree: funnel(
      ['Le bip s’arrête-t-il quand le porte-vélos est vide ou replié ?', buy('Le porte-vélos est dans la zone du radar.', 'Désactivez le radar quand les vélos sont chargés. Une caméra de recul prend alors le relais.', 'Caméra de recul pour camping-car'), YN],
      ['Nettoyez les capteurs (boue, givre, gouttes). Est-ce réglé ?', buy('Un capteur était sale.', 'Nettoyez-les de temps en temps, surtout en hiver.', 'Nettoyant carrosserie pour camping-car')],
      ['Un capteur est-il enfoncé, de travers ou fendu ?', buy('Un capteur a pris un choc.', 'Remplacez ce capteur par un modèle compatible avec votre kit.', 'Capteur de radar de recul'), YN],
      ['Le bip arrive-t-il surtout sous la pluie ou après un lavage ?', buy('De l’humidité est entrée dans un connecteur.', 'Nettoyez et protégez les connecteurs des capteurs.', 'Nettoyant et protecteur pour contacts électriques'), YN],
      shop('Le boîtier du radar est en défaut.', 'L’atelier teste chaque capteur, règle la portée et contrôle le câblage.', 'Contrôle du radar de recul à l’atelier')
    ),
  },
  {
    id: 'p_alarme',
    cat: 'ext',
    label: 'Mon alarme se déclenche toute seule la nuit ou quand je suis à bord',
    eq: 'alarme',
    kw: 'alarme déclenche toute seule nuit sonne sirène fausse alerte volumétrique capteur à bord',
    tree: funnel(
      ['Êtes-vous à bord avec l’alarme en mode complet ? Passez-la en mode nuit (sans détection intérieure). Est-ce réglé ?', none('La détection intérieure vous voyait bouger.', 'À bord, utilisez toujours le mode nuit : seules les ouvertures restent surveillées.')],
      ['Un ventilateur, un chauffage soufflant, un lanterneau entrouvert ou un animal bouge-t-il l’air ou les rideaux ?', none('Un courant d’air déclenche le capteur.', 'Coupez le soufflage ou baissez la sensibilité de l’alarme (voir la notice).'), YN],
      ['L’alarme indique-t-elle une zone (porte, soute, capot) qui ferme mal ?', buy('Un contact d’ouverture est déréglé.', 'Remplacez le contact de cette ouverture.', 'Contact magnétique d’ouverture pour alarme'), YN],
      ['La pile de la télécommande ou une batterie du véhicule est-elle faible ?', buy('Une alimentation faible donne de fausses alertes.', 'Changez la pile et gardez les batteries chargées.', 'Chargeur de maintien de batterie'), YN],
      shop('Un capteur de l’alarme est en défaut.', 'L’atelier règle la sensibilité et teste capteurs et sirène.', 'Contrôle de l’alarme à l’atelier')
    ),
  },
  {
    id: 'p_freins',
    cat: 'ext',
    label: 'Mes freins grincent, le véhicule tire d’un côté ou une roue sent le chaud après un long arrêt',
    kw: 'freins grincent grincement tire d un côté roue chaude odeur brûlé disque rouillé étrier grippé hivernage pédale',
    tree: funnel(
      ['Le bruit disparaît-il après quelques freinages doux sur 5 à 10 km ?', none('Une fine couche de rouille couvrait les disques.', 'Après un long arrêt, c’est normal : elle part en freinant doucement.')],
      ['Après un trajet, une jante est-elle bien plus chaude que les autres (approchez la main sans toucher) ?', shop('Un étrier de frein est grippé.', 'Allez vite à l’atelier : la roue freine en permanence et chauffe.', 'Contrôle des freins à l’atelier', 'Si le véhicule tire fortement ou si la pédale s’enfonce, ne roulez pas.'), YN],
      ['Le frein à main est-il resté serré tout l’hiver, et le véhicule semble-t-il retenu au démarrage ?', buy('Le frein à main est resté collé.', 'Pour l’hivernage, stationnez à plat, frein à main desserré, sur des cales.', 'Cales de roues pour stationnement'), YN],
      shop('Les freins ont besoin d’un contrôle.', 'L’atelier contrôle étriers, disques, plaquettes et liquide de frein.', 'Contrôle des freins à l’atelier', 'Si le véhicule tire fortement ou si la pédale s’enfonce, ne roulez pas.')
    ),
  },
  {
    id: 'p_grele',
    cat: 'hum',
    label: 'Mon toit, mon lanterneau ou mon panneau solaire a pris la grêle',
    kw: 'grêle grêlon orage toit lanterneau fendu panneau solaire cassé assurance déclaration impact',
    tree: funnel(
      ['Un lanterneau est-il fendu ou percé (photographiez le toit) ?', buy('Le lanterneau est cassé : l’eau va entrer.', 'Protégez tout de suite le toit, puis déclarez le sinistre à votre assurance sous 5 jours ouvrés.', 'Housse de protection intégrale pour camping-car', 'Ne montez pas sur un toit mouillé, et ne marchez pas partout sur le toit de la cellule.'), YN],
      ['Le verre du panneau solaire est-il fissuré, ou la charge solaire a-t-elle baissé depuis ?', buy('Le panneau solaire est abîmé.', 'Déclarez-le à l’assurance : le panneau se remplace.', 'Panneau solaire de remplacement'), YN],
      ['Voyez-vous des creux sur le toit ou la carrosserie, sans trou ?', none('Les impacts sont seulement esthétiques.', 'Faites constater par l’expert de l’assurance.'), YN],
      shop('L’étanchéité du toit est à contrôler.', 'L’atelier fait un test d’étanchéité et contrôle les fixations du panneau et des lanterneaux, et prépare le devis pour l’expert.', 'Test d’étanchéité à l’atelier')
    ),
  },
  {
    id: 'p_attelage',
    cat: 'ext',
    label: 'Ma rotule d’attelage ne se verrouille plus, ou ma remorque n’a pas de courant',
    eq: 'att',
    kw: 'attelage rotule démontable verrouille plus bloque remorque courant prise 13 broches 7 broches feux remorque',
    tree: funnel(
      ['Le logement de la rotule est-il sale ou plein de sable ? Nettoyez-le. Est-ce réglé ?', buy('Le logement de la rotule était encrassé.', 'Gardez le bouchon sur le logement et graissez-le de temps en temps.', 'Spray d’entretien pour attelage', TOW_SEC)],
      ['La clé de la rotule tourne-t-elle mal ?', buy('La serrure de la rotule est grippée.', 'Lubrifiez la serrure avec un produit spécial serrures.', 'Lubrifiant spécial serrures', TOW_SEC), YN],
      ['Le témoin de verrouillage reste-t-il au rouge ? Réarmez la rotule selon sa notice. Est-ce réglé ?', none('Le mécanisme de la rotule n’était pas armé.', 'Réarmez-la avant chaque pose, jusqu’au témoin vert.', TOW_SEC)],
      ['La prise de la remorque est-elle oxydée, ou les prises sont-elles différentes (7 et 13 broches) ?', buy('La prise électrique de l’attelage ne fait pas contact.', 'Nettoyez la prise. Un adaptateur raccorde une remorque à 7 broches sur une prise à 13 broches.', 'Adaptateur de prise d’attelage 7/13 broches'), YN],
      shop('L’attelage est en défaut.', 'L’atelier contrôle le mécanisme de la rotule, le boîtier électrique et ses fusibles.', 'Contrôle de l’attelage à l’atelier', TOW_SEC)
    ),
  },
  {
    id: 'p_carplay',
    cat: 'elec',
    label: 'Mon écran de cabine ne se connecte plus à mon téléphone (CarPlay, Android Auto, Bluetooth)',
    eq: 'radio',
    kw: 'carplay android auto bluetooth écran autoradio téléphone connecte plus uconnect usb câble appairage',
    tree: funnel(
      ['Redémarrez le téléphone, puis coupez le contact et attendez quelques minutes portes fermées avant de relancer l’écran. Est-ce réglé ?', none('L’écran était bloqué.', 'Un redémarrage complet suffit souvent.')],
      ['Essayez avec un autre câble USB, court et certifié. Est-ce réglé ?', buy('Le câble USB était défectueux.', 'Les câbles bon marché coupent souvent la connexion : prenez un câble certifié.', 'Câble USB certifié CarPlay et Android Auto')],
      ['Supprimez le véhicule du Bluetooth du téléphone et le téléphone de l’écran, puis reconnectez-les. Est-ce réglé ?', none('L’appairage Bluetooth était abîmé.', 'Refaites l’appairage si le problème revient.')],
      shop('Le logiciel de l’écran est à mettre à jour.', 'Le garage du véhicule met à jour l’écran et teste le port USB.', 'Mise à jour de l’écran au garage')
    ),
  },
];

// Habitation side (water, gas, heating, fridge, toilets, the living area).
const CO_SEC = 'Une flamme jaune dégage du monoxyde de carbone : aérez, ne chauffez jamais la cellule avec le réchaud, et coupez tout en cas de mal de tête.';
const LPG_SEC = 'Odeur de gaz ou sifflement qui continue pendant le plein : arrêtez tout de suite et n’insistez pas.';
const RODENT_SEC = 'Un fil rongé peut provoquer un court-circuit : n’utilisez plus l’appareil concerné. Un tuyau de gaz rongé : fermez la bouteille et aérez.';
const HEATER_SEC = 'Fumée dans la cellule ou odeur de gasoil : coupez le chauffage et aérez.';
const LEAK_SEC = 'Un plancher ou une paroi humide se dégrade vite : faites contrôler l’étanchéité sans attendre.';

// The rest of the shower funnel, once the pump type is known.
const showerEnd = (pumpStep) => funnel(
  ...(pumpStep ? [pumpStep] : []),
  ['La poignée du mitigeur est-elle dure, ou l’eau tiède impossible à régler ?', buy('La cartouche du mitigeur est entartrée.', 'Détartrez le circuit d’eau, ou changez la cartouche du mitigeur si elle reste dure.', 'Détartrant pour circuit d’eau de camping-car'), YN],
  shop('Le mélange d’eau chaude et froide se fait mal.', 'L’atelier contrôle le clapet anti-retour, le mitigeur et le chauffe-eau.', 'Contrôle du circuit d’eau chaude à l’atelier')
);

REELS.push(
  {
    id: 'p_remplissage',
    cat: 'eau',
    label: 'Mon réservoir d’eau propre ne se remplit pas : l’eau ressort par la trappe',
    eq: 'propre',
    kw: 'remplissage réservoir eau propre ressort trappe coupelle reflue déborde évent mise à l air plein eau impossible',
    tree: funnel(
      ['L’eau coule-t-elle sous le véhicule par le trop-plein, ou la jauge indique-t-elle plein ?', none('Le réservoir était déjà plein.', 'Si la jauge reste fausse, voyez le diagnostic sur la jauge du réservoir.'), YN],
      ['Remplissez avec le robinet ouvert à moitié. L’eau entre-t-elle sans ressortir ?', buy('Le débit était trop fort pour l’évacuation de l’air.', 'L’air du réservoir doit sortir pendant que l’eau entre : remplissez moins fort.', 'Pistolet de remplissage à débit réglable avec tuyau alimentaire')],
      ['Regardez le petit trou d’évent de la coupelle de remplissage : est-il bouché (insectes, toiles, saleté) ou cassé ?', buy('L’évent de la coupelle est bouché.', 'Dégagez le petit trou avec une tige fine. S’il est cassé, changez la coupelle.', 'Coupelle de remplissage avec évent intégré'), YN],
      ['Garez-vous bien à plat, ou un peu penché du côté de la trappe, puis remplissez. Est-ce réglé ?', buy('Une poche d’air restait coincée dans le réservoir.', 'Remplissez toujours véhicule de niveau.', 'Cales de nivellement')],
      shop('Le tuyau de remplissage est écrasé.', 'L’atelier contrôle le tuyau de remplissage et celui de mise à l’air sous le plancher.', 'Contrôle du remplissage d’eau à l’atelier')
    ),
  },
  {
    id: 'p_refluxdouche',
    cat: 'eau',
    label: 'De l’eau sale remonte dans mon bac de douche ou mon lavabo',
    eq: 'grises',
    kw: 'eau sale remonte bac douche lavabo reflux eaux grises bonde clapet en roulant freinage réservoir plein',
    tree: funnel(
      ['Videz le réservoir d’eaux grises. Est-ce réglé ?', buy('Le réservoir d’eaux grises était plein.', 'Videz-le plus souvent : une fois plein, l’eau remonte par la bonde la plus basse.', 'Tuyau de vidange d’eaux grises')],
      ['L’eau remonte-t-elle surtout à l’arrêt, quand le véhicule penche du côté de la douche ?', buy('La pente renvoie l’eau vers la bonde la plus basse.', 'Mettez le véhicule de niveau à l’arrêt.', 'Cales de nivellement'), YN],
      ['L’eau remonte-t-elle surtout en roulant ou au freinage ?', buy('La bonde n’a pas de clapet anti-retour.', 'Un clapet à membrane sous la bonde empêche l’eau et les odeurs de remonter.', 'Clapet anti-retour et anti-odeur à membrane pour bonde de douche'), YN],
      ['La douche se vide-t-elle lentement en faisant des glouglous ?', buy('Le réservoir et son évent sont encrassés.', 'Nettoyez le réservoir avec un produit adapté, puis rincez à grande eau.', 'Nettoyant pour réservoir d’eaux grises'), YN],
      shop('Les tuyaux d’évacuation sont mal raccordés.', 'L’atelier contrôle la pente des tuyaux, le siphon et l’évent du réservoir.', 'Contrôle des évacuations à l’atelier')
    ),
  },
  {
    id: 'p_bacdouche',
    cat: 'eau',
    label: 'Mon bac de douche est fissuré ou fuit en dessous',
    eq: 'douche',
    kw: 'bac douche fissuré fendu fuite dessous bonde joint receveur plancher humide caillebotis',
    tree: funnel(
      ['Versez de l’eau seulement autour de la bonde. Cela fuit-il ?', buy('Le joint de la bonde est desserré.', 'Changez la bonde et son joint : une bonde fendue fuit sous le plancher sans qu’on la voie.', 'Bonde de douche de rechange avec son joint', LEAK_SEC), YN],
      ['Arrosez seulement le bord, le long des parois. Cela fuit-il ?', buy('Le joint du tour du bac est décollé.', 'Retirez l’ancien joint, séchez bien, puis refaites-le.', 'Mastic d’étanchéité souple spécial camping-car', LEAK_SEC), YN],
      ['Voyez-vous une fissure fine dans le fond du bac ?', buy('Le fond du bac est fissuré.', 'Réparez avec un kit de résine en débordant bien autour de la fissure, puis posez un caillebotis pour répartir le poids.', 'Kit de réparation pour bac de douche', LEAK_SEC), YN],
      ['Le fond plie-t-il quand vous marchez dessus ?', buy('Le fond du bac n’est pas soutenu.', 'Un caillebotis répartit le poids et évite que le bac se fende.', 'Caillebotis de douche'), YN],
      shop('Le bac de douche est à remplacer.', 'L’atelier remplace le bac, remet un support dessous et mesure l’humidité du plancher.', 'Remplacement du bac à l’atelier', LEAK_SEC)
    ),
  },
  {
    id: 'p_vannegrises',
    cat: 'eau',
    label: 'Ma vanne d’eaux grises goutte alors qu’elle est fermée',
    eq: 'grises',
    kw: 'vanne eaux grises goutte fuit fermée guillotine joint poignée vidange bouchon',
    tree: funnel(
      ['L’eau goutte-t-elle près de la purge du chauffe-eau plutôt que de la vanne ?', none('C’est la purge du chauffe-eau qui coule.', 'C’est de l’eau propre : voyez le diagnostic du chauffage Truma (vidange de sécurité).'), YN],
      ['Poussez la poignée à fond. Tourne-t-elle dans le vide ? Resserrez-la. Est-ce réglé ?', none('La poignée de la vanne était desserrée.', 'Resserrez-la de temps en temps.')],
      ['Faites une vidange complète, puis un rinçage réservoir plein d’eau. Est-ce réglé ?', buy('Des saletés empêchaient la vanne de bien fermer.', 'Graisse et cheveux gênent la guillotine : nettoyez le réservoir régulièrement.', 'Nettoyant pour réservoir d’eaux grises')],
      ['Le joint de la vanne est-il sec ou dur ?', buy('Le joint de la vanne a séché.', 'Un lubrifiant pour joints lui rend sa souplesse.', 'Lubrifiant pour joints de vanne et de cassette'), YN],
      ['Le bouchon de sortie manque-t-il ?', buy('Il manque le bouchon de vidange.', 'Le bouchon arrête les gouttes et les odeurs.', 'Bouchon de vidange d’eaux grises'), YN],
      shop('La vanne d’eaux grises est usée.', 'L’atelier remplace la vanne ou son joint, et contrôle le raccord au-dessus.', 'Remplacement de la vanne à l’atelier')
    ),
  },
  {
    id: 'p_douchetiede',
    cat: 'eau',
    label: 'Ma douche passe du chaud au froid',
    eq: 'eauch',
    kw: 'douche chaud froid tiède alterne température varie mitigeur chauffe-eau réserve à-coups pression air',
    tree: funnel(
      ['Mettez le chauffe-eau au plus chaud, attendez 30 minutes, puis coupez l’eau pendant que vous vous savonnez. Est-ce réglé ?', buy('La réserve d’eau chaude était trop petite pour votre douche.', 'Le chauffe-eau contient environ 10 litres : coupez l’eau pendant le savonnage.', 'Pommeau de douche économique avec bouton stop')],
      ['Juste après une vidange : ouvrez un robinet d’eau chaude 3 à 5 minutes, pompe en marche. Est-ce réglé ?', none('Il restait de l’air dans le chauffe-eau.', 'Purgez l’air après chaque vidange en laissant couler l’eau chaude.')],
      { t: 'Quelle pompe à eau avez-vous ?', o: ['Une pompe à pression (elle démarre quand on ouvre un robinet)', 'Une pompe immergée dans le réservoir'], vk: 'pompe', vv: ['press', 'imm'], n: [
        showerEnd(['Le débit fait-il des à-coups ?', buy('La pression de l’eau varie.', 'Un vase d’expansion lisse la pression de la pompe. Si les à-coups continuent, voyez le diagnostic de la pompe.', 'Vase d’expansion pour circuit d’eau'), YN]),
        showerEnd(null),
      ] }
    ),
  },
  {
    id: 'p_flammejaune',
    cat: 'gaz',
    label: 'La flamme de mon réchaud est jaune et noircit mes casseroles',
    eq: 'rechaud',
    kw: 'flamme jaune réchaud plaque noircit casseroles suie brûleur chapeau courant d air monoxyde',
    tree: funnel(
      ['Remettez bien à plat les chapeaux et couronnes des brûleurs. Est-ce réglé ?', none('Un chapeau de brûleur était mal posé.', 'Vérifiez-les après chaque nettoyage.', CO_SEC)],
      ['Les brûleurs sont-ils encrassés (débordement, graisse) ?', buy('Les brûleurs sont encrassés.', 'Nettoyez chapeaux et couronnes, puis séchez-les bien avant de rallumer.', 'Nettoyant dégraissant pour plaque de cuisson au gaz', CO_SEC), YN],
      ['Fermez le lanterneau ou la fenêtre au-dessus du réchaud. La flamme redevient-elle bleue ?', buy('Un courant d’air perturbait la flamme.', 'Un pare-vent protège la flamme quand il faut aérer.', 'Pare-vent de réchaud', CO_SEC), ['Oui, elle est bleue', 'Non, toujours jaune']],
      ['Changez de bouteille. La flamme redevient-elle bleue ?', buy('La bouteille était presque vide.', 'Une bouteille en fin de course, ou du butane par froid, brûle mal.', 'Jauge de niveau de gaz pour bouteille', CO_SEC), ['Oui, elle est bleue', 'Non, toujours jaune']],
      shop('L’injecteur du brûleur est encrassé.', 'L’atelier nettoie l’injecteur, règle l’arrivée d’air et contrôle la pression du gaz.', 'Contrôle du réchaud à l’atelier', CO_SEC)
    ),
  },
  {
    id: 'p_pleingpl',
    cat: 'gaz',
    label: 'Je n’arrive pas à faire le plein de mon réservoir GPL',
    eq: 'gaslow',
    kw: 'gpl plein réservoir bouteille rechargeable station adaptateur embout pistolet s arrête 80 limiteur étranger',
    tree: funnel(
      ['Le pistolet s’arrête-t-il tout seul vers 80 % ?', none('Le limiteur de remplissage a fait son travail.', 'C’est normal : le réservoir n’est jamais rempli à plus de 80 %.', LPG_SEC), YN],
      ['Le pistolet n’entre-t-il pas sur l’embout de remplissage ?', buy('L’adaptateur n’est pas celui du pays.', 'Les embouts changent selon les pays : gardez un jeu d’adaptateurs dans le véhicule.', 'Jeu d’adaptateurs GPL européens', LPG_SEC), YN],
      ['Revissez l’adaptateur à fond et regardez son joint. Le plein démarre-t-il ?', buy('L’adaptateur était mal vissé.', 'Vérifiez son joint à chaque plein, et changez-le s’il est abîmé.', 'Joint d’adaptateur GPL', LPG_SEC), ['Oui, le plein démarre', 'Non']],
      ['Verrouillez le pistolet jusqu’au petit déclic et gardez le bouton de la pompe enfoncé. Le plein démarre-t-il ?', none('Le pistolet n’était pas bien verrouillé.', 'Gardez le bouton enfoncé pendant tout le plein.', LPG_SEC), ['Oui, le plein démarre', 'Non']],
      shop('Le limiteur de remplissage est bloqué.', 'Un installateur GPL contrôle le limiteur, l’embout de remplissage et son flexible.', 'Contrôle de l’installation GPL à l’atelier', LPG_SEC)
    ),
  },
  {
    id: 'p_gazetranger',
    cat: 'gaz',
    label: 'À l’étranger, je ne trouve pas de bouteille de gaz qui va sur mon installation',
    eq: 'bouteille',
    kw: 'gaz étranger espagne portugal italie allemagne bouteille adaptateur filetage campingaz échange refusé',
    tree: ask('Où êtes-vous ?', [
      ['En Espagne ou au Portugal', funnel(
        ['Avez-vous un adaptateur Espagne-Portugal à brancher sur votre lyre ?', buy('Il manque l’adaptateur Espagne-Portugal.', 'Prenez la version à sortie libre, qui se branche sur votre propre détendeur. Testez le raccord avec une bombe détectrice de fuites.', 'Adaptateur gaz Espagne-Portugal', GAS_SEC), ['Non', 'Oui, mais ça ne va pas']],
        buy('Les bouteilles locales ne vont pas sur votre installation.', 'Les bouteilles bleues Campingaz se trouvent presque partout : un adaptateur permet de les utiliser.', 'Adaptateur pour bouteille Campingaz', GAS_SEC)
      )],
      ['Dans un autre pays', buy('Le filetage des bouteilles change selon le pays.', 'Un jeu d’adaptateurs européens couvre la plupart des pays. Testez le raccord avec une bombe détectrice de fuites.', 'Jeu d’adaptateurs gaz européens', GAS_SEC)],
      ['Je voyage souvent à l’étranger', shop('Les bouteilles à échanger ne conviennent pas aux voyages.', 'Une bouteille ou un réservoir GPL rechargeable se remplit en station dans toute l’Europe : l’atelier le pose et contrôle l’installation.', 'Pose d’un gaz rechargeable à l’atelier', GAS_SEC)],
    ]),
  },
  {
    id: 'p_dieselaltitude',
    cat: 'chauf',
    label: 'Mon chauffage diesel fume ou s’arrête en montagne ou par grand froid',
    eq: 'webasto',
    kw: 'chauffage diesel webasto eberspächer autoterm altitude montagne fume s arrête sécurité mode haute altitude gasoil fige froid',
    tree: funnel(
      ['Êtes-vous en altitude (au-dessus de 1 500 m environ) ? Si votre commande a un mode altitude, activez-le. Est-ce réglé ?', none('L’air est trop pauvre en altitude.', 'Pensez à activer le mode altitude en montagne, et à le couper en redescendant.', HEATER_SEC)],
      ['Fait-il moins de -10 °C, avec du gasoil d’été dans le réservoir ?', buy('Le gasoil a figé.', 'Par grand froid, ajoutez un antifigeant au gasoil, ou faites le plein en montagne.', 'Additif antifigeant pour gasoil', HEATER_SEC), YN],
      ['La sortie d’échappement ou l’entrée d’air sous le plancher est-elle bouchée par la neige ?', buy('La neige bouchait l’échappement du chauffage.', 'Dégagez-la, et protégez la sortie en hiver.', 'Protection d’échappement pour chauffage diesel', HEATER_SEC), YN],
      shop('Le chauffage n’est pas réglé pour l’altitude.', 'L’atelier règle la pompe à gasoil, nettoie la chambre de combustion et pose si besoin un kit altitude.', 'Réglage du chauffage diesel à l’atelier', HEATER_SEC)
    ),
  },
  {
    id: 'p_frigomoisi',
    cat: 'frigo',
    label: 'Mon frigo sent mauvais ou a des moisissures à l’intérieur',
    eq: 'frigo',
    kw: 'frigo sent mauvais odeur moisissures moisi champignons hivernage porte fermée joint',
    tree: funnel(
      ['L’odeur est-elle piquante, avec des traces jaunes derrière le frigo ?', none('Ce n’est pas une odeur d’aliments.', 'Voyez tout de suite le diagnostic « Odeur d’ammoniac ou taches jaunes derrière le frigo ».'), YN],
      ['Retirez clayettes et bac. Un jus a-t-il coulé, un aliment est-il oublié ?', buy('Un aliment a pourri dans le frigo.', 'Nettoyez tout l’intérieur avec un produit fait pour les frigos, puis séchez.', 'Nettoyant désinfectant pour réfrigérateur'), YN],
      ['Le frigo est-il resté porte fermée pendant le stockage ?', buy('Le frigo est resté fermé à l’arrêt.', 'À l’arrêt, laissez toujours la porte entrouverte avec la position d’aération du verrou.', 'Cale d’aération pour porte de frigo'), YN],
      ['Le joint de porte est-il noirci ou moisi ?', buy('Le joint de porte a moisi.', 'Nettoyez-le. S’il est fendu, il se change.', 'Joint de porte de frigo de rechange'), YN],
      ['Mettez un absorbeur d’odeurs. Est-ce réglé ?', buy('Une odeur restait dans le plastique.', 'Changez l’absorbeur tous les 2 à 3 mois.', 'Absorbeur d’odeurs pour réfrigérateur')],
      shop('L’écoulement de dégivrage est bouché.', 'L’atelier débouche l’écoulement et contrôle l’isolant de la porte.', 'Contrôle du frigo à l’atelier')
    ),
  },
  {
    id: 'p_souris',
    cat: 'hum',
    label: 'J’ai des souris : crottes, emballages ou fils grignotés',
    kw: 'souris rongeurs rats crottes grignoté fils câbles rongés hivernage moteur nid',
    tree: funnel(
      ['Un appareil ne marche plus (marchepied, éclairage, chauffage) ?', shop('Les rongeurs ont attaqué des fils.', 'L’atelier contrôle tous les fils et durites, répare et désinfecte.', 'Contrôle des fils rongés à l’atelier', RODENT_SEC), YN],
      ['Restait-il de la nourriture dans les placards ?', buy('La nourriture attire les rongeurs.', 'Rangez tout dans des boîtes hermétiques, surtout à l’hivernage.', 'Boîtes de rangement hermétiques pour camping-car', RODENT_SEC), YN],
      ['Voyez-vous des traces dans le compartiment moteur ?', buy('Les rongeurs passent par le moteur.', 'Un spray protège les gaines, un répulsif à ultrasons 12 V les éloigne.', 'Répulsif anti-rongeurs à ultrasons 12 V pour véhicule', RODENT_SEC), YN],
      ['Bouchez les entrées : passages de câbles et de tuyaux, grilles du frigo et du chauffage. Les traces cessent-elles ?', buy('Les rongeurs entraient par une ouverture.', 'Des grilles à maille fine et un répulsif empêchent leur retour.', 'Répulsif anti-rongeurs en spray pour camping-car', RODENT_SEC)],
      shop('Les rongeurs ont fait leur nid dans le véhicule.', 'L’atelier cherche le nid, contrôle les fils et désinfecte l’isolant.', 'Recherche du nid et contrôle à l’atelier', RODENT_SEC)
    ),
  },
  {
    id: 'p_insectes',
    cat: 'hum',
    label: 'J’ai des fourmis, des mites alimentaires ou des cafards dans les placards',
    kw: 'fourmis mites alimentaires papillons cafards blattes insectes placards nourriture',
    tree: ask('Qu’avez-vous trouvé ?', [
      ['Des fourmis', funnel(
        ['Un câble, un tuyau, une cale ou le store touche-t-il le sol ou un arbre ?', buy('Les fourmis montent par ce qui touche le véhicule.', 'Décrochez ce qui touche les branches, et traitez câbles et cales.', 'Répulsif anti-insectes rampants pour camping-car'), YN],
        ['Rangez la nourriture ouverte dans des boîtes fermées. Est-ce réglé ?', buy('La nourriture ouverte attirait les fourmis.', 'Gardez tout dans des boîtes hermétiques.', 'Boîtes de rangement hermétiques pour camping-car')],
        shop('Les fourmis ont fait leur nid dans le véhicule.', 'L’atelier cherche le nid (soute, plancher, isolant) et traite.', 'Désinsectisation à l’atelier')
      )],
      ['De petits papillons', buy('Des mites alimentaires sont arrivées avec les courses.', 'Jetez les paquets touchés et posez des pièges dans les placards.', 'Pièges à phéromones contre les mites alimentaires')],
      ['Des cafards ou des blattes', funnel(
        ['Posez des boîtes appâts dans les placards. Sont-ils partis au bout de 2 semaines ?', buy('Des blattes sont arrivées avec les courses.', 'Laissez les appâts en place quelques semaines.', 'Boîtes appâts anti-blattes'), ['Oui, c’est réglé', 'Non, ils reviennent']],
        shop('Les blattes ont fait leur nid dans le véhicule.', 'L’atelier cherche le nid et traite.', 'Désinsectisation à l’atelier')
      )],
    ]),
  },
  {
    id: 'p_plancher',
    cat: 'hum',
    label: 'Mon plancher est mou, gondole ou craque',
    kw: 'plancher mou gondole craque s enfonce humide pourri fuite infiltration sol revêtement',
    tree: funnel(
      ['Le sol gondole-t-il sans s’enfoncer quand vous appuyez ?', shop('Le revêtement de sol est décollé.', 'Signalez-le au SAV : il recolle ou remplace le revêtement.', 'Recollage du revêtement au SAV', null, 'etanch'), YN],
      ['La zone est-elle près de la douche, des toilettes ou de l’évier, et l’humidimètre montre-t-il de l’humidité ?', shop('Une fuite d’eau mouille le plancher.', 'Coupez la pompe à eau quand vous ne vous en servez pas, et prenez rendez-vous. Un humidimètre permet de suivre la zone.', 'Recherche de fuite au SAV', LEAK_SEC, 'etanch'), YN],
      ['La zone est-elle sous un lanterneau, une baie ou la porte ?', shop('Une infiltration mouille le plancher.', 'Prenez rendez-vous au SAV pour un contrôle d’étanchéité complet.', 'Contrôle d’étanchéité au SAV', LEAK_SEC, 'etanch'), YN],
      ['Un tapis est-il posé sur le sol froid, mouillé dessous ?', buy('La condensation mouille le sol sous le tapis.', 'Un tapis isolant respirant laisse passer l’air sans garder l’humidité.', 'Tapis isolant respirant pour camping-car'), YN],
      shop('Le plancher est abîmé.', 'Le SAV mesure l’humidité, cherche la cause et répare le plancher.', 'Contrôle du plancher au SAV', LEAK_SEC, 'etanch')
    ),
  },
  {
    id: 'p_cloques',
    cat: 'hum',
    label: 'Ma paroi extérieure fait des cloques ou sonne creux',
    kw: 'paroi cloques bulles sonne creux décollement délaminage infiltration carrosserie polyester',
    tree: funnel(
      ['La cloque est-elle seulement sous un autocollant décoratif ?', none('C’est l’autocollant qui se décolle.', 'La paroi n’est pas en cause : signalez-le au SAV si le véhicule est sous garantie.'), YN],
      ['Mesurez l’humidité de la paroi à l’intérieur, au même endroit. Est-elle humide ?', shop('Une infiltration d’eau décolle la paroi.', 'Prenez rendez-vous vite au SAV : l’eau entre par un joint et la paroi se dégrade.', 'Contrôle d’étanchéité au SAV', LEAK_SEC, 'etanch'), YN],
      ['La cloque est-elle à côté d’une fenêtre, d’un feu, d’une trappe ou d’un profilé, avec un joint fissuré ?', buy('Le joint à côté de la cloque est fissuré.', 'Refaites le joint avant que l’eau n’entre, puis surveillez avec un humidimètre.', 'Mastic d’étanchéité spécial camping-car', LEAK_SEC), YN],
      shop('La paroi se décolle.', 'Le SAV contrôle l’étanchéité et recolle la paroi.', 'Contrôle de la paroi au SAV', LEAK_SEC, 'etanch')
    ),
  },
  {
    id: 'p_portedouche',
    cat: 'hum',
    label: 'La porte de ma douche ne ferme plus ou sort de son rail',
    eq: 'douche',
    kw: 'porte douche ferme plus rail paroi pliante coulissante aimant charnière joint',
    tree: funnel(
      ['Mettez le véhicule de niveau. La porte ferme-t-elle ?', buy('La caisse se tord quand le véhicule n’est pas à plat.', 'Garez-vous de niveau.', 'Cales de nivellement'), ['Oui, elle ferme', 'Non']],
      ['Resserrez les vis des charnières. Est-ce réglé ?', none('Les charnières étaient desserrées.', 'Les vibrations de la route les desserrent : vérifiez-les de temps en temps.')],
      ['L’aimant de fermeture tient-il encore ?', buy('L’aimant de fermeture ne tient plus.', 'Changez la fermeture magnétique.', 'Fermeture magnétique de porte'), ['Non, il ne tient plus', 'Oui']],
      ['La paroi pliante ou coulissante saute-t-elle de son rail ?', buy('Les roulettes de la paroi sont usées.', 'Changez roulettes et guides, puis lubrifiez le rail au silicone.', 'Lubrifiant silicone en spray'), YN],
      shop('Le rail de la porte est déformé.', 'L’atelier redresse ou change le rail.', 'Réparation de la porte à l’atelier')
    ),
  },
  {
    id: 'p_cassetterentre',
    cat: 'wc',
    label: 'Ma cassette de toilettes ne rentre plus ou ne sort plus',
    eq: 'wc',
    kw: 'cassette toilettes rentre plus sort plus bloquée trappe portillon thetford dometic bec verseur',
    tree: funnel(
      ['La trappe de la cassette est-elle restée ouverte ? Fermez-la avec la poignée avant de la remettre. Est-ce réglé ?', none('La trappe de la cassette était ouverte.', 'Fermez toujours la trappe avant de remettre la cassette.')],
      ['Le bec verseur est-il bien rabattu, la cassette dans le bon sens ? Est-ce réglé ?', none('Le bec verseur dépassait.', 'Rabattez-le à fond avant de remettre la cassette.')],
      ['Un papier ou un objet est-il tombé dans le logement ?', none('Un objet bloquait le logement.', 'Retirez-le sans forcer.'), YN],
      ['La poignée de la trappe est-elle dure ou bloquée ?', buy('Le mécanisme est grippé par le calcaire.', 'Détartrez la cassette, puis lubrifiez les joints.', 'Détartrant pour cassette de toilettes'), YN],
      shop('Le logement de la cassette est abîmé.', 'L’atelier contrôle le guide, le verrou du portillon et le mécanisme, sans forcer.', 'Réparation du logement à l’atelier')
    ),
  }
);

// Types the app already knows: the spare wheel or the repair kit, butane in the cold.
const typed = (id, start, vk, vv) => {
  const d = REELS.find((x) => x.id === id);
  const walk = (n) => {
    if (!n || n.cause) return;
    if (String(n.t).startsWith(start)) Object.assign(n, { vk, vv });
    (n.n || []).forEach(walk);
  };
  walk(d.tree);
};
typed('p_crevaison', 'Avez-vous une roue de secours', 'secours', ['v2', 'v1']);
typed('p_duocontrol', 'Utilisez-vous du butane', 'bouteille', ['butane', 'propane|rech']);

module.exports = { REELS };
