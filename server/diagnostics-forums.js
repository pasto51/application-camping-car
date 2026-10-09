'use strict';

// Third batch (October 2026): problems of motorhome and van owners found on forums of the last three years (VW
// California club, Matmut forum (California, Ducato), Fiat and T6 forums, Peugeot and Mercedes forums, Camping-Car
// Infos, Campingcar Bricoloisirs…) that no diagnostic covered. Written as funnels (see diag-helpers.js): each end
// point names a product sold in a camping-car accessory store, or the workshop.

const { buy, shop, funnel, ask } = require('./diag-helpers');

const FUSES = 'Fusibles plats assortis';
const SEAT_SEC = 'Ne roulez jamais avec une banquette ou une ceinture qui ne se verrouille pas : personne ne voyage à cette place.';
const FUEL_SEC = 'Odeur de carburant : coupez le chauffage, aérez, ne fumez pas. Mal de tête ou nausée : sortez à l’air libre (monoxyde de carbone).';
const BURN_SEC = 'Prise chaude, noircie ou odeur de brûlé : débranchez tout et coupez le coupe-batterie de la cellule.';

const VANS = [
  {
    id: 'p_toitmoteur',
    cat: 'ext',
    label: 'Mon toit relevable ne monte plus, ne descend plus ou ne se verrouille pas',
    eq: 'toit_rel',
    kw: 'toit relevable ne monte plus descend pas bloqué verrouille pas électrique california nugget marco polo grand california vérin toit tombe soufflet coincé crochets',
    tree: ask('Votre toit relevable est-il électrique ou manuel ?', [
      ['Électrique (bouton ou panneau)', funnel(
        ['Contact mis (ou moteur en marche), frein à main serré et porte coulissante fermée : le toit répond-il ?', buy('Une condition de sécurité bloquait le toit.',
          'Le toit ne bouge que si les sécurités sont remplies (contact, frein à main, porte fermée selon le modèle) : voyez la notice.', 'Aucun produit nécessaire'), ['Oui, il bouge', 'Non, rien']],
        ['La tension de la batterie cellule est-elle sous 12,2 V au panneau ?', buy('La batterie cellule est trop faible pour le toit.',
          'Sur beaucoup de fourgons, le toit est alimenté par la batterie cellule. Rechargez-la ; si elle se vide vite, elle est en fin de vie.', 'Batterie cellule et chargeur adapté'), ['Oui, sous 12,2 V', 'Non, au-dessus']],
        ['Faites la remise à zéro du panneau de commande décrite dans la notice (bouton maintenu quelques secondes). Est-ce réglé ?', buy('Une erreur de capteur restait en mémoire.',
          'La remise à zéro efface l’erreur. Si elle revient souvent, faites contrôler les capteurs du toit à la prochaine visite.', 'Aucun produit nécessaire')],
        ['La toile ou le soufflet est-il pincé dans les crochets ou le cadre ?', buy('La toile du toit était coincée.',
          'Rentrez la toile vers l’intérieur avant de refermer. Un spray silicone sur les joints et les charnières évite qu’elle accroche.', 'Spray silicone pour joints et charnières'), ['Oui, elle est pincée', 'Non']],
        shop('Le mécanisme électrique du toit est en panne.',
          'Ne forcez pas le toit. S’il penche ou si de l’huile suinte, ne l’actionnez plus : l’atelier contrôle le moteur, les capteurs et le circuit.', 'Contrôle du toit relevable à l’atelier')
      )],
      ['Manuel', funnel(
        ['La toile ou le soufflet est-il pincé dans les crochets ou le cadre ?', buy('La toile du toit était coincée.',
          'Rentrez la toile vers l’intérieur avant de refermer. Un spray silicone sur les joints et les charnières évite qu’elle accroche.', 'Spray silicone pour joints et charnières'), ['Oui, elle est pincée', 'Non']],
        ['Le toit redescend-il tout seul, ou se lève-t-il mal d’un côté ?', buy('Les vérins à gaz du toit sont usés.',
          'Les vérins se changent par paire, à la longueur et à la force de l’origine (écrites dessus). Calez le toit avant de les changer.', 'Vérins à gaz pour toit relevable de fourgon',
          'Ne passez jamais la tête sous un toit qui ne tient pas : calez-le d’abord.'), ['Oui', 'Non']],
        ['Les crochets de fermeture sont-ils durs ou grippés ?', buy('Les crochets de fermeture du toit sont grippés.',
          'Un spray silicone sur les crochets et charnières les fait jouer sans forcer.', 'Spray silicone pour joints et charnières'), ['Oui', 'Non']],
        shop('Le mécanisme du toit est abîmé.', 'Ne forcez pas : l’atelier contrôle les charnières, les vérins et la coque.', 'Contrôle du toit relevable à l’atelier')
      )],
    ]),
  },
  {
    id: 'p_tableau',
    cat: 'elec',
    label: 'Mon tableau de commande de la cellule affiche un code erreur ou une tension qui semble fausse',
    eq: 'panneau',
    kw: 'tableau de commande panneau de contrôle cellule code erreur alarme tension fausse batterie affichage cbe schaudt nordelettronica jauge écran',
    tree: ask('Que voyez-vous ?', [
      ['Un code d’erreur ou une alarme', funnel(
        ['Cherchez le code dans la notice du tableau : parle-t-il de la batterie, de l’eau ou du chauffage ?', buy('Le code signale un besoin connu.',
          'Suivez ce que dit la notice (recharger la batterie, remplir ou vider l’eau, voir le diagnostic du chauffage). Le code disparaît quand c’est réglé.', 'Aucun produit nécessaire'), ['Oui, la notice l’explique', 'Non, ou je ne trouve pas']],
        ['Faites la remise à zéro ou l’effacement des erreurs prévu par la notice. Le code disparaît-il ?', buy('Une erreur ancienne restait en mémoire.',
          'Si elle ne revient pas, rien d’autre à faire.', 'Aucun produit nécessaire'), ['Oui, c’est réglé', 'Non, rien ne change']],
        shop('Le code d’erreur du tableau revient.', 'L’atelier lit le code et contrôle l’appareil en cause.', 'Contrôle de l’installation électrique à l’atelier')
      )],
      ['Une tension qui me semble fausse', funnel(
        ['Mesurez la tension sur la batterie avec un voltmètre : est-elle plus basse que celle affichée ?', buy('L’affichage surestime la charge de la batterie.',
          'Le tableau mesure loin de la batterie : il se trompe souvent. Un contrôleur de batterie à shunt donne la vraie charge, en pourcentage.', 'Contrôleur de batterie à shunt'), ['Oui, plus basse', 'Non, pareille']],
        buy('La batterie est réellement faible.',
          'Le tableau dit vrai : voyez le diagnostic « Ma batterie cellule se décharge très vite ». Un contrôleur à shunt aide à suivre la charge.', 'Contrôleur de batterie à shunt')
      )],
      ['Le tableau reste éteint', funnel(
        ['Le coupe-batterie de la cellule est-il sur « marche » ?', buy('Le coupe-batterie de la cellule était coupé.',
          'Remettez-le sur marche ; il coupe tout le 12 V de la cellule.', 'Aucun produit nécessaire'), ['Non, il était coupé', 'Oui']],
        ['Le fusible du tableau (souvent sous le siège ou dans le bloc électrique) est-il grillé ?', buy('Le fusible du tableau était grillé.',
          'Remplacez-le par un fusible du même calibre, jamais plus fort. S’il regrille, passez à l’atelier.', FUSES), ['Oui, il était grillé', 'Non, il est bon']],
        shop('Le tableau de commande est en panne.', 'Voyez aussi « Plus de courant dans la cellule (12 V) ». L’atelier contrôle le tableau et le bloc électrique.', 'Contrôle du tableau à l’atelier')
      )],
    ]),
  },
  {
    id: 'p_prise',
    cat: 'elec',
    label: 'Ma prise USB ou ma prise 12 V (allume-cigare) de la cellule ne marche plus',
    eq: 'prises',
    kw: 'prise usb ne marche plus ne charge pas prise 12 v allume-cigare cellule téléphone recharge usb-c chargeur',
    tree: funnel(
      ['La prise est-elle chaude, noircie, ou sentez-vous le brûlé ?', shop('La prise a chauffé.',
        'Ne l’utilisez plus. L’atelier contrôle la prise et son câble.', 'Contrôle et remplacement de la prise à l’atelier', BURN_SEC), ['Oui', 'Non']],
      ['Les autres lumières et appareils 12 V de la cellule marchent-ils ?', buy('Tout le 12 V de la cellule est coupé.',
        'Voyez le diagnostic « Plus de courant dans la cellule (12 V) » : coupe-batterie, fusible principal, batterie.', FUSES), ['Non, rien ne marche', 'Oui, ils marchent']],
      ['Essayez un autre câble et un autre appareil. La prise charge-t-elle ?', buy('Le câble de charge était usé.',
        'Les câbles s’usent vite en voyage : gardez-en un de rechange. La prise est bonne.', 'Câble de charge USB de rechange'), ['Oui, ça charge', 'Non, toujours rien']],
      ['Le fusible de cette prise, au tableau de la cellule, est-il grillé ?', buy('Le fusible de la prise était grillé.',
        'Souvent après un appareil trop gourmand (glacière, compresseur). Remplacez-le par le même calibre ; s’il regrille, passez à l’atelier.', FUSES), ['Oui, il était grillé', 'Non, il est bon']],
      buy('Le module USB de la prise est usé.',
        'Fusible bon, la prise ne charge plus : le module USB est hors service. Une prise USB double ou USB-C de rechange se pose à la place.', 'Prise USB double ou USB-C de rechange pour camping-car')
    ),
  },
  {
    id: 'p_ventiltoit',
    cat: 'hum',
    label: 'Mon ventilateur de toit motorisé ne tourne plus ou son capot ne s’ouvre plus',
    eq: 'maxx',
    kw: 'ventilateur de toit maxxfan maxx fan aérateur extracteur ne tourne plus capot ne s ouvre plus télécommande lanterneau ventilé',
    tree: funnel(
      ['Changez les piles de la télécommande, ou essayez avec les boutons du ventilateur. Est-ce réglé ?', buy('Les piles de la télécommande étaient usées.',
        'Gardez des piles de rechange : le ventilateur marche aussi avec ses boutons.', 'Piles de rechange pour télécommande')],
      ['La batterie cellule est-elle sous 11,5 V ?', buy('La tension est trop basse pour le ventilateur.',
        'Le ventilateur s’arrête pour protéger la batterie : rechargez-la.', 'Moniteur de batterie'), ['Oui, sous 11,5 V', 'Non, au-dessus']],
      ['Le fusible du ventilateur est-il grillé ?', buy('Le fusible du ventilateur était grillé.',
        'Remplacez-le par le même calibre. S’il regrille, passez à l’atelier.', FUSES), ['Oui, il était grillé', 'Non, il est bon']],
      ['Le capot s’ouvre-t-il avec la manivelle de secours ? Retirez feuilles ou givre qui le bloquent.', buy('Le moteur du capot est en panne.',
        'Le ventilateur tourne capot ouvert à la main : seul le moteur du capot est en cause. Il existe en kit de rechange. Une housse de pluie permet d’aérer même sous l’averse.', 'Kit moteur de capot pour ventilateur de toit'), ['Oui, à la manivelle', 'Non, il est bloqué']],
      shop('L’électronique du ventilateur est en panne.', 'Tension et fusible bons, rien ne marche : l’atelier contrôle la carte du ventilateur.', 'Contrôle du ventilateur de toit à l’atelier')
    ),
  },
  {
    id: 'p_portesar',
    cat: 'ext',
    label: 'Ma porte arrière (battante) ne s’ouvre plus, ferme mal ou ne tient plus ouverte',
    eq: 'portes_ar',
    kw: 'porte arrière battante ducato jumper boxer ne s ouvre plus ferme mal serrure arrêt de porte 90 180 degrés claquer télécommande verrouillage',
    tree: ask('Que se passe-t-il ?', [
      ['Elle ne s’ouvre plus', funnel(
        ['Ouvrez la porte droite, puis la gauche de l’intérieur avec sa poignée. S’ouvre-t-elle ?', buy('Le verrouillage centralisé retenait la porte.',
          'Ouvrez avec la télécommande, puis par l’intérieur. Pulvérisez un lubrifiant dans la serrure : un contacteur encrassé bloque souvent une seule porte.', 'Lubrifiant spécial serrures'), ['Oui, elle s’ouvre', 'Non']],
        ['Pulvérisez un lubrifiant dans la serrure et sur la gâche, puis réessayez. Est-ce réglé ?', buy('La serrure de la porte arrière était grippée.',
          'Relubrifiez-la deux fois par an : la poussière de la route la grippe.', 'Lubrifiant spécial serrures')],
        shop('La serrure de la porte arrière est bloquée.', 'Ne forcez pas. L’atelier ouvre la porte et répare la serrure : c’est aussi votre sortie de secours.', 'Réparation de la serrure à l’atelier')
      )],
      ['Elle ferme mal, il faut la claquer', funnel(
        ['Graissez la gâche et passez un lubrifiant silicone sur le joint, puis fermez d’un geste franc. Est-ce réglé ?', buy('La gâche sèche freinait la fermeture.',
          'Entretenez la gâche et le joint deux fois par an.', 'Lubrifiant silicone pour joints et graisse de gâche')],
        shop('La porte arrière est déréglée.', 'L’atelier règle la gâche et les charnières.', 'Réglage des portes arrière à l’atelier')
      )],
      ['Elle ne tient plus ouverte (à 90° ou 180°)', buy('L’arrêt de porte arrière est cassé.',
        'Attention au vent : une porte qui ne tient pas se rabat. L’arrêt de porte se change au modèle du fourgon.', 'Arrêt de porte arrière adapté à votre fourgon')],
    ]),
  },
  {
    id: 'p_banquette',
    cat: 'ext',
    label: 'Ma banquette-lit ne se déplie plus, se bloque, ou sa ceinture ne se déroule plus',
    eq: 'banq',
    kw: 'banquette lit rib rock and roll ne se déplie plus bloquée verrouille pas position route rails ceinture bloquée ne se déroule plus enrouleur',
    tree: ask('Que se passe-t-il ?', [
      ['Elle ne se déplie plus ou se bloque', funnel(
        ['Une ceinture ou une sangle est-elle coincée dessous ?', buy('Une sangle était prise sous la banquette.',
          'Rangez les ceintures avant de manœuvrer la banquette.', 'Aucun produit nécessaire'), ['Oui', 'Non']],
        ['Un objet ou des miettes encombrent-ils les rails ? Videz et dépoussiérez-les. Est-ce réglé ?', buy('Les rails de la banquette étaient encombrés.',
          'Un spray silicone sur les rails les fait glisser sans à-coup. Évitez de ranger des objets dessous.', 'Spray silicone pour rails et glissières')],
        ['Appuyez fort sur le dossier en tirant la manette. La banquette se libère-t-elle ?', buy('Le verrou de la banquette était en tension.',
          'Appuyez toujours sur le dossier avant de tirer la manette.', 'Aucun produit nécessaire'), ['Oui, elle se libère', 'Non']],
        shop('Le mécanisme de la banquette est bloqué.', 'Ne forcez pas. L’atelier contrôle le mécanisme et ses ancrages.', 'Contrôle de la banquette à l’atelier', SEAT_SEC)
      )],
      ['Elle ne se verrouille plus en position route', shop('Le verrou de la banquette ne s’enclenche plus.',
        'Personne ne voyage sur cette banquette en attendant : elle doit être verrouillée pour protéger en cas de choc. L’atelier contrôle le verrou.', 'Contrôle de la banquette à l’atelier', SEAT_SEC)],
      ['Sa ceinture ne se déroule plus ou ne se rembobine plus', funnel(
        ['Le véhicule est-il en pente ? Tirez doucement la ceinture, sans à-coup. Se déroule-t-elle ?', buy('Le blocage de sécurité de la ceinture s’était enclenché.',
          'C’est normal en pente ou après un à-coup : tirez doucement, sans forcer.', 'Aucun produit nécessaire'), ['Oui, elle se déroule', 'Non']],
        ['La banquette est-elle bien verrouillée et la sangle libre (pas pincée) ?', buy('La sangle de la ceinture était pincée.',
          'Sur certaines banquettes, la ceinture reste bloquée tant que la banquette n’est pas verrouillée. Dégagez la sangle et verrouillez.', 'Aucun produit nécessaire'), ['Non, c’était ça', 'Oui, tout est bon']],
        shop('L’enrouleur de la ceinture est bloqué.', 'C’est une pièce de sécurité : personne ne voyage à cette place avant le contrôle de l’atelier.', 'Contrôle de la ceinture à l’atelier', SEAT_SEC)
      )],
    ]),
  },
  {
    id: 'p_gasoil',
    cat: 'chauf',
    label: 'Je sens le gasoil dans mon camping-car ou mon fourgon',
    kw: 'odeur de gasoil diesel carburant dans le fourgon dans le camping-car odeur chauffage fuite réservoir bouchon plein',
    tree: funnel(
      ['L’odeur vient-elle seulement quand le chauffage diesel tourne ?', shop('L’odeur vient du chauffage diesel.',
        'Arrêtez le chauffage et voyez le diagnostic « Ça sent le carburant ou le brûlé autour de mon chauffage diesel ». L’atelier contrôle l’échappement et les raccords.',
        'Contrôle du chauffage diesel à l’atelier, et détecteur de monoxyde de carbone', FUEL_SEC), ['Oui, avec le chauffage', 'Non, même chauffage éteint']],
      ['Avez-vous fait le plein récemment ? Le bouchon est-il bien fermé, du gasoil a-t-il débordé ?', buy('Du gasoil a débordé au plein.',
        'L’odeur part en quelques jours. Fermez bien le bouchon et ne remplissez pas jusqu’à débordement. Un détecteur de monoxyde de carbone veille la nuit.', 'Détecteur de monoxyde de carbone pour camping-car', FUEL_SEC), ['Oui, c’est possible', 'Non']],
      shop('Une fuite de gasoil est possible.',
        'Traces humides sous le véhicule ou odeur côté moteur : ne roulez pas loin. L’atelier cherche la fuite (filtre, conduites).', 'Recherche de fuite de carburant à l’atelier', FUEL_SEC)
    ),
  },
  {
    id: 'p_rideaux',
    cat: 'ext',
    label: 'Mes rideaux isolants de cabine se décrochent (ventouses, aimants)',
    eq: 'occult',
    kw: 'rideaux isolants cabine se décrochent tombent ventouses aimants occultation pare-brise vitres isolant thermique',
    tree: funnel(
      ['Nettoyez la vitre avec un nettoyant pour vitres de camping-car, puis reposez la ventouse sur vitre froide. Tient-elle ?', buy('La vitre sale empêchait la ventouse de tenir.',
        'Posez les ventouses sur vitre propre et froide, et appuyez bien au centre.', 'Nettoyant pour vitres de camping-car'), ['Oui, elle tient', 'Non, elle tombe']],
      ['Les ventouses sont-elles durcies, fendues ou déformées ?', buy('Les ventouses du rideau sont usées.',
        'Elles durcissent avec le soleil : changez-les toutes en même temps.', 'Lot de ventouses de rechange pour rideau'), ['Oui', 'Non']],
      ['Le rideau tient-il par aimants posés loin du cadre métallique ?', buy('Les aimants n’ont pas de tôle derrière eux.',
        'Les aimants ne tiennent que sur la tôle du cadre : un rideau à la forme exacte de votre cabine tombe juste sur le métal.', 'Rideau isolant adapté au modèle de votre cabine'), ['Oui', 'Non']],
      buy('Le rideau n’est pas à la taille de la cabine.',
        'Un rideau trop petit ou trop grand tire sur ses fixations : prenez-le au modèle exact de votre véhicule.', 'Rideau isolant adapté au modèle de votre cabine')
    ),
  },
];

const GAS_SEC = 'Si le chauffage s’éteint sans cesse ou sent le brûlé, fermez le gaz et ne l’utilisez plus avant le contrôle.';
const DRIVE_SEC = 'En attendant l’atelier, roulez doucement et le moins possible.';

const MOTORHOMES = [
  {
    id: 'p_jaugegrises',
    cat: 'eau',
    label: 'Ma jauge d’eaux grises affiche toujours plein (ou rien)',
    eq: 'grises',
    kw: 'jauge eaux grises niveau toujours plein vide faux sonde réservoir eaux usées affichage panneau voyant plein',
    tree: funnel(
      ['Videz entièrement le réservoir d’eaux grises sur une aire de service. La jauge affiche-t-elle maintenant vide ?', buy('Le réservoir était vraiment plein.',
        'Videz-le plus souvent : avec la douche, il se remplit vite.', 'Aucun produit nécessaire'), ['Oui, elle affiche vide', 'Non, toujours plein']],
      ['Versez un dégraissant spécial réservoir d’eaux grises, roulez, puis videz. La jauge est-elle juste ?', buy('La graisse faisait contact sur la sonde.',
        'Les tiges de la sonde s’encrassent : un dégraissant spécial réservoir une fois par mois les garde propres.', 'Dégraissant pour réservoir d’eaux grises'), ['Oui, c’est réglé', 'Non, rien ne change']],
      ['Par la trappe de visite, le fil de la sonde est-il débranché ou la fiche verte d’oxydation ?', buy('Le fil de la sonde faisait mauvais contact.',
        'Rebranchez la fiche et protégez-la avec un spray pour contacts électriques.', 'Spray pour contacts électriques'), ['Oui', 'Non, tout est branché']],
      shop('La sonde de niveau est en panne.', 'Réservoir vide et propre, la jauge reste fausse : la sonde ou le câble est à changer.', 'Sonde de niveau pour réservoir, posée par l’atelier')
    ),
  },
  {
    id: 'p_odeurdouche',
    cat: 'wc',
    label: 'Ça sent l’égout dans la douche ou le lavabo, surtout en roulant',
    kw: 'odeur égout douche lavabo bonde siphon remonte en roulant mauvaise odeur eaux grises salle d eau',
    tree: funnel(
      ['Remettez le bouchon dans la bonde après chaque douche et pendant les trajets. L’odeur disparaît-elle ?', buy('L’air du réservoir remonte par la bonde.',
        'Les siphons plats des camping-cars se vident en roulant : un bouchon ou un clapet anti-odeur dans la bonde bloque l’air du réservoir.', 'Bouchons de bonde ou clapets anti-odeur'), ['Oui, c’est réglé', 'Non, rien ne change']],
      ['Le siphon de la douche est-il encrassé (cheveux, dépôts) ?', buy('Le siphon de la douche est encrassé.',
        'Nettoyez-le avec un goupillon de bonde, puis versez un additif désodorisant pour eaux grises dans les bondes.', 'Goupillon de bonde et additif désodorisant pour eaux grises'), ['Oui', 'Non']],
      ['Versez une dose de nettoyant spécial réservoir d’eaux grises, roulez puis videz. L’odeur disparaît-elle ?', buy('Le réservoir d’eaux grises était encrassé.',
        'Videz souvent et faites un nettoyage du réservoir une fois par mois.', 'Nettoyant pour réservoir d’eaux grises'), ['Oui, c’est réglé', 'Non, rien ne change']],
      shop('L’aération du réservoir d’eaux grises est bouchée.', 'L’atelier contrôle la mise à l’air du réservoir et pose un siphon plus profond si besoin.', 'Contrôle de l’évacuation à l’atelier')
    ),
  },
  {
    id: 'p_alde',
    cat: 'chauf',
    label: 'Mon chauffage Alde ne chauffe plus bien ou fait des glouglous',
    eq: 'alde',
    kw: 'alde chauffage central eau chaude radiateurs convecteurs glouglou gargouille ne chauffe plus bien vase d expansion liquide glycol pompe purge',
    tree: funnel(
      ['Chauffage froid, le liquide est-il sous le repère « MIN » du vase d’expansion ?', buy('Le liquide de chauffage est trop bas.',
        'Complétez avec le liquide de chauffage préconisé par Alde (mélange glycol), jamais avec de l’eau seule. Un niveau qui baisse souvent cache une fuite : atelier.', 'Liquide de chauffage glycol préconisé par Alde', GAS_SEC), ['Oui, il est bas', 'Non, il est bon']],
      ['Mettez la pompe à la vitesse la plus faible et laissez tourner une heure. Les glouglous disparaissent-ils ?', buy('De l’air restait dans le circuit de chauffage.',
        'La petite vitesse aide l’air à remonter au vase. Si les glouglous reviennent, l’atelier purge le circuit.', 'Aucun produit nécessaire', GAS_SEC), ['Oui, c’est réglé', 'Non, rien ne change']],
      ['Entendez-vous la pompe tourner (léger ronronnement) ?', shop('Le circuit de chauffage Alde est à purger.',
        'La pompe tourne mais la chaleur ne circule pas bien : l’atelier purge le circuit et contrôle les radiateurs.', 'Purge et contrôle du chauffage Alde à l’atelier', GAS_SEC), ['Oui, elle tourne', 'Non, aucun bruit']],
      shop('La pompe de circulation Alde est en panne.', 'Sans pompe, l’eau chaude ne circule plus. L’atelier la contrôle et la change.', 'Pompe de circulation Alde, posée par l’atelier', GAS_SEC)
    ),
  },
  {
    id: 'p_feuxvelo',
    cat: 'ext',
    label: 'Les feux de mon porte-vélos ou de ma remorque ne s’allument pas',
    kw: 'feux porte-vélos remorque attelage prise 13 broches 7 broches clignotant feu stop ne s allument pas adaptateur rampe',
    tree: funnel(
      ['Les broches de la prise sont-elles vertes ou oxydées ? Nettoyez-les au spray pour contacts. Est-ce réglé ?', buy('La prise faisait mauvais contact.',
        'Protégez la prise avec un spray pour contacts et son capuchon fermé.', 'Spray pour contacts électriques')],
      ['Utilisez-vous un adaptateur 13 broches / 7 broches ? Essayez sans, ou avec un autre. Est-ce réglé ?', buy('L’adaptateur de prise était en défaut.',
        'Un testeur de prise d’attelage montre en un geste quelles fonctions arrivent.', 'Adaptateur 13/7 broches et testeur de prise d’attelage')],
      ['Une seule lumière ne marche pas (les autres oui) ?', buy('L’ampoule du feu de la rampe est grillée.',
        'Changez l’ampoule ou le feu de la rampe du porte-vélos.', 'Ampoule ou feu de rechange pour rampe de porte-vélos'), ['Oui, une seule', 'Non, aucune']],
      shop('L’alimentation de la prise d’attelage est coupée.', 'Fusible ou boîtier électronique du véhicule : l’atelier contrôle le faisceau d’attelage.', 'Contrôle du faisceau d’attelage à l’atelier')
    ),
  },
  {
    id: 'p_ventcabine',
    cat: 'ext',
    label: 'La ventilation de la cabine ne marche qu’à fond, ou plus du tout',
    kw: 'ventilation cabine pulseur ventilateur marche qu à fond vitesse 4 ne marche plus résistance chauffage cabine souffle plus',
    tree: ask('Que se passe-t-il ?', [
      ['Elle ne marche qu’à la vitesse maximale', shop('La résistance de la ventilation est grillée.',
        'C’est la panne classique : seule la vitesse maximale passe à côté de la résistance. L’atelier la change rapidement.', 'Résistance de ventilation, posée par l’atelier')],
      ['Elle ne marche plus du tout', funnel(
        ['Le fusible de la ventilation (boîte à fusibles de la cabine) est-il grillé ?', buy('Le fusible de la ventilation était grillé.',
          'Remplacez-le par le même calibre. S’il regrille, passez à l’atelier.', 'Fusibles auto assortis'), ['Oui, il était grillé', 'Non, il est bon']],
        shop('Le moteur de ventilation est en panne.', 'Fusible bon, rien ne souffle : l’atelier contrôle le moteur et sa commande.', 'Contrôle de la ventilation à l’atelier')
      )],
      ['Elle grince ou tourne par à-coups', shop('Le moteur de ventilation est grippé.', 'Il risque de lâcher : l’atelier le change.', 'Moteur de ventilation, posé par l’atelier')],
    ]),
  },
  {
    id: 'p_climcabine',
    cat: 'chauf',
    label: 'La climatisation de la cabine ne fait plus de froid ou sent mauvais',
    kw: 'climatisation cabine clim moteur porteur ne fait plus de froid souffle chaud mauvaise odeur recharge gaz ducato',
    tree: ask('Que se passe-t-il ?', [
      ['Elle ne fait plus de froid', funnel(
        ['Le bouton A/C est-il allumé et la ventilation au-dessus de 0 ?', buy('La climatisation n’était pas en marche.',
          'Elle ne fait du froid que bouton A/C allumé et ventilation en marche, moteur tournant.', 'Aucun produit nécessaire'), ['Non, c’était ça', 'Oui']],
        ['Le fusible de la climatisation est-il grillé ?', buy('Le fusible de la climatisation était grillé.',
          'Remplacez-le par le même calibre. S’il regrille, passez à l’atelier.', 'Fusibles auto assortis'), ['Oui, il était grillé', 'Non, il est bon']],
        shop('Le circuit de climatisation manque de gaz.', 'La recharge et la recherche de fuite se font seulement par un professionnel agréé.', 'Recharge et contrôle de climatisation à l’atelier')
      )],
      ['Elle sent mauvais', buy('Le circuit de climatisation est encrassé.',
        'Une bombe de nettoyage pour climatisation assainit le circuit. Faites aussi changer le filtre d’habitacle à la révision.', 'Nettoyant aérosol pour climatisation')],
    ]),
  },
  {
    id: 'p_centralisation',
    cat: 'ext',
    label: 'La clé de mon véhicule n’ouvre plus ou ne verrouille plus les portes (télécommande, centralisation)',
    kw: 'clé télécommande centralisation verrouillage portes cabine n ouvre plus ne verrouille plus pile clé plip fiat ducato bip',
    tree: funnel(
      ['Changez la pile de la clé (pile bouton). Les portes répondent-elles ?', buy('La pile de la clé était usée.',
        'Gardez une pile de rechange. Une coque de clé neuve remplace une coque cassée.', 'Pile bouton et coque de clé de rechange'), ['Oui, c’est réglé', 'Non, rien ne change']],
      ['Le double de la clé marche-t-il ?', buy('La première clé est en panne.',
        'Le double marche : la clé elle-même est en cause. Une coque neuve suffit souvent, sinon l’atelier programme une clé.', 'Coque de clé de rechange'), ['Oui, le double marche', 'Non, pareil']],
      ['Le moteur démarre-t-il normalement ?', shop('La centralisation des portes est en défaut.',
        'Le moteur démarre mais les portes ne répondent pas : l’atelier contrôle le fusible et le boîtier de centralisation.', 'Contrôle de la centralisation à l’atelier'), ['Oui', 'Non, il ne démarre pas']],
      shop('L’antidémarrage ne reconnaît plus la clé.', 'Ni portes ni démarrage : l’atelier lit le boîtier et reprogramme la clé si besoin.', 'Contrôle de l’antidémarrage à l’atelier')
    ),
  },
  {
    id: 'p_vitre',
    cat: 'ext',
    label: 'Ma vitre électrique de cabine ne monte plus ou ne descend plus',
    kw: 'vitre électrique lève-vitre cabine ne remonte plus descend pas bloquée bouton fiat ducato x250 porte conducteur passager',
    tree: funnel(
      ['Baissez la vitre à fond, puis maintenez le bouton vers le haut quelques secondes après la fin de course. Remonte-t-elle normalement ?', buy('La vitre avait perdu sa mémoire de fin de course.',
        'Cette remise à zéro suffit souvent après un débranchement de batterie.', 'Aucun produit nécessaire'), ['Oui, c’est réglé', 'Non, rien ne change']],
      ['Le bouton de l’autre porte fait-il bouger cette vitre (si votre véhicule le permet) ?', buy('Le bouton de la vitre est usé.',
        'Le bouton se change au modèle du véhicule.', 'Interrupteur de lève-vitre au modèle du véhicule'), ['Oui', 'Non']],
      ['Le fusible des lève-vitres est-il grillé ?', buy('Le fusible des lève-vitres était grillé.',
        'Remplacez-le par le même calibre. S’il regrille, passez à l’atelier.', 'Fusibles auto assortis'), ['Oui, il était grillé', 'Non, il est bon']],
      shop('Le mécanisme du lève-vitre est en panne.', 'Fermez la vitre si possible et protégez-la de la pluie. L’atelier change le moteur ou le mécanisme.', 'Lève-vitre, posé par l’atelier')
    ),
  },
  {
    id: 'p_camera',
    cat: 'ext',
    label: 'Ma caméra de recul affiche un écran noir ou « pas de signal »',
    eq: 'camera',
    kw: 'caméra de recul écran noir bleu pas de signal no signal image saute sans fil radar recul marche arrière',
    tree: funnel(
      ['Marche arrière passée (ou feux allumés selon le montage), l’image apparaît-elle ?', buy('La caméra ne s’allume qu’en marche arrière.',
        'C’est son fonctionnement normal : elle est alimentée par le feu de recul. Pour une vue permanente, il faut un montage dédié.', 'Aucun produit nécessaire'), ['Oui, en marche arrière', 'Non, jamais']],
      ['Nettoyez la lentille de la caméra. L’image est-elle nette ?', buy('La lentille de la caméra était sale.',
        'La boue et la pluie la salissent vite : nettoyez-la au départ avec un nettoyant pour vitres.', 'Nettoyant pour vitres de camping-car'), ['Oui, c’est réglé', 'Non, rien ne change']],
      ['Caméra sans fil : l’image saute-t-elle ou coupe-t-elle ?', buy('Le signal sans fil est brouillé.',
        'Les caméras sans fil sont sensibles aux parasites : un kit de caméra filaire donne une image stable.', 'Kit de caméra de recul filaire'), ['Oui', 'Non, ou elle est filaire']],
      shop('Le câble de la caméra est coupé.', 'L’atelier contrôle les fiches derrière l’écran et le câble jusqu’à la caméra.', 'Contrôle de la caméra de recul à l’atelier')
    ),
  },
  {
    id: 'p_embrayage',
    cat: 'ext',
    label: 'Mon embrayage patine, vibre ou sent le brûlé',
    kw: 'embrayage patine sent le brûlé odeur brûlé vibration pédale dure molle volant moteur bimasse claquement ralenti démarrage en côte',
    tree: funnel(
      ['L’odeur de brûlé vient-elle seulement après une manœuvre en pente ou une marche arrière chargée ?', buy('L’embrayage a chauffé pendant la manœuvre.',
        'Faites les manœuvres d’un trait, frein à main pour démarrer en côte, sans faire patiner. Des cales de mise à niveau évitent de forcer pour monter dessus.', 'Cales de mise à niveau', DRIVE_SEC), ['Oui, après une manœuvre', 'Non, aussi en roulant']],
      ['En 4e, accélérez franchement : le moteur monte-t-il dans les tours sans que la vitesse suive ?', shop('L’embrayage est usé.', 'Il patine : l’atelier le change avant qu’il lâche.', 'Remplacement de l’embrayage à l’atelier', DRIVE_SEC), ['Oui, il patine', 'Non']],
      ['La pédale est-elle devenue très molle ou très dure ?', shop('Le circuit de commande de l’embrayage est en défaut.', 'L’atelier contrôle le circuit hydraulique de l’embrayage.', 'Contrôle de l’embrayage à l’atelier', DRIVE_SEC), ['Oui', 'Non']],
      shop('Le volant moteur vibre.', 'Vibrations ou claquements au ralenti : l’atelier contrôle le volant moteur et l’embrayage.', 'Contrôle de l’embrayage à l’atelier', DRIVE_SEC)
    ),
  },
  {
    id: 'p_boiteauto',
    cat: 'ext',
    label: 'Ma boîte automatique donne des à-coups ou affiche un message d’alerte',
    eq: 'auto',
    kw: 'boîte automatique à-coups message transmission check boîte 9 vitesses 9speed comfort matic mode dégradé passe mal vitesses ducato',
    tree: funnel(
      ['Arrêtez-vous dans un endroit sûr, coupez le moteur 10 minutes, puis repartez. Le message est-il parti ?', shop('La boîte de vitesses avait trop chauffé.',
        'Le message est parti, mais faites contrôler la boîte rapidement : il revient souvent en montée ou chargé.', 'Contrôle de la boîte automatique à l’atelier', DRIVE_SEC), ['Oui, il est parti', 'Non, il reste']],
      shop('La boîte automatique est en défaut.', 'Roulez doucement jusqu’à l’atelier, ou faites-vous dépanner si la boîte reste bloquée. Une mise à jour du logiciel de la boîte existe pour certains modèles : l’atelier la vérifie, souvent sous garantie.', 'Diagnostic et mise à jour de la boîte à l’atelier', DRIVE_SEC)
    ),
  },
  {
    id: 'p_freinmain',
    cat: 'ext',
    label: 'Mon frein à main ne tient plus en pente',
    kw: 'frein à main ne tient plus pente crans tire loin câble détendu stationnement recule roule tout seul',
    tree: funnel(
      ['Le levier monte-t-il de plus de 5 crans avant de serrer ?', shop('Le câble du frein à main est détendu.',
        'En attendant, garez-vous vitesse engagée et roues calées. L’atelier règle le câble et les garnitures.', 'Réglage du frein à main à l’atelier', 'Garez-vous toujours vitesse engagée, roues tournées vers le trottoir et calées.'), ['Oui, plus de 5 crans', 'Non']],
      ['Les freins ont-ils été changés récemment ? Appuyez plusieurs fois fort sur la pédale de frein, puis serrez. Tient-il ?', buy('Le rattrapage des freins ne s’était pas refait.',
        'Après des travaux de freins, quelques appuis fermes sur la pédale suffisent. Gardez des cales de roue pour les pentes.', 'Cales de roue'), ['Oui, il tient', 'Non']],
      shop('Le frein à main est usé.', 'L’atelier contrôle les garnitures et le mécanisme du frein à main.', 'Contrôle du frein à main à l’atelier', 'Garez-vous toujours vitesse engagée, roues tournées vers le trottoir et calées.')
    ),
  },
  {
    id: 'p_bruitavant',
    cat: 'ext',
    label: 'Ça claque, cogne ou ronfle à l’avant du véhicule quand je roule',
    kw: 'bruit avant claque cogne ronfle roulement crécelle tourner volant suspension coupelle cardan cliquetis braquage route abîmée',
    tree: ask('Quel bruit, et quand ?', [
      ['Un ronflement qui monte avec la vitesse', shop('Un roulement de roue est usé.', 'Décrivez le bruit à l’atelier : il contrôle les roulements.', 'Contrôle des roulements à l’atelier', DRIVE_SEC)],
      ['Des claquements sur route abîmée ou en tournant le volant à l’arrêt', shop('Une coupelle de suspension avant est usée.', 'C’est un point faible connu des fourgons : l’atelier contrôle les coupelles et les amortisseurs.', 'Contrôle de la suspension avant à l’atelier', DRIVE_SEC)],
      ['Un cliquetis en braquant à fond', shop('Un cardan de transmission est usé.', 'L’atelier contrôle les cardans et leurs soufflets.', 'Contrôle des cardans à l’atelier', DRIVE_SEC)],
      ['Je ne sais pas le décrire', shop('L’origine du bruit avant reste à trouver.', 'Notez quand il apparaît (vitesse, virage, freinage) : l’atelier fait un essai avec vous.', 'Contrôle du train avant à l’atelier', DRIVE_SEC)],
    ]),
  },
  {
    id: 'p_verinshydro',
    cat: 'ext',
    label: 'Mes vérins hydrauliques de mise à niveau ne sortent plus ou ne remontent pas',
    eq: 'verins',
    kw: 'vérins hydrauliques mise à niveau automatique ne remontent pas ne sortent plus code erreur huile pression moteur pompe hydraulique',
    tree: funnel(
      ['Moteur tournant, au point mort et frein à main serré (selon la notice), les vérins répondent-ils ?', buy('Une condition de sécurité bloquait les vérins.',
        'Les vérins ne bougent que si les sécurités sont remplies (moteur, frein à main, point mort) : voyez la notice.', 'Aucun produit nécessaire',
        'Ne roulez jamais avec un vérin encore sorti.'), ['Oui, ils répondent', 'Non']],
      ['Le boîtier de commande affiche-t-il un code ou un message de niveau d’huile bas ?', shop('Le niveau d’huile hydraulique est bas.', 'L’atelier complète l’huile et cherche la fuite.', 'Contrôle des vérins hydrauliques à l’atelier', 'Ne roulez jamais avec un vérin encore sorti.'), ['Oui', 'Non']],
      ['La batterie est-elle sous 12 V ?', buy('La batterie est trop faible pour la pompe des vérins.',
        'Moteur tournant, la pompe a assez de courant. Rechargez la batterie.', 'Moniteur de batterie'), ['Oui, sous 12 V', 'Non']],
      shop('Le système de vérins est en panne.', 'Si un vérin reste sorti, ne roulez pas : l’atelier dispose de la remontée de secours.', 'Contrôle des vérins hydrauliques à l’atelier', 'Ne roulez jamais avec un vérin encore sorti.')
    ),
  },
  {
    id: 'p_fumee',
    cat: 'gaz',
    label: 'Mon détecteur de fumée bipe toutes les minutes',
    eq: 'fumee',
    kw: 'détecteur de fumée bipe toutes les minutes bip court pile alarme incendie détecteur fumée',
    tree: funnel(
      ['Y a-t-il de la fumée ou une odeur de brûlé ?', shop('Le détecteur a détecté de la fumée.', 'Sortez, coupez le gaz et le 230 V, et appelez les secours si besoin.', 'Contrôle de l’installation à l’atelier', 'Fumée ou odeur de brûlé : sortez tout le monde, coupez le gaz et le courant, appelez le 18 ou le 112.'), ['Oui', 'Non, aucun signe']],
      ['Changez la pile du détecteur. Le bip s’arrête-t-il ?', buy('La pile du détecteur était faible.',
        'Un bip court toutes les minutes annonce une pile faible : changez-la tous les ans.', 'Pile pour détecteur de fumée'), ['Oui, il s’arrête', 'Non, il bipe encore']],
      buy('Le détecteur de fumée est en fin de vie.',
        'Après 8 à 10 ans (date au dos), il faut le changer. Ne le retirez et ne le couvrez jamais.', 'Détecteur de fumée adapté au camping-car',
        'Gardez toujours un détecteur de fumée en marche : changez-le sans attendre.')
    ),
  },
];

module.exports = { VANS, MOTORHOMES };
