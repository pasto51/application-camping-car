'use strict';

// Fourth batch (October 2026): from the advice pages of accessory stores and makers (Narbonne Accessoires blog, H2R
// guides, Dometic and Thetford FAQs). New diagnostics, and new answers added to some older ones. Written as funnels
// (see diag-helpers.js); the home remedies some pages give (vinegar, baking soda, soap) are left out.

const { buy, shop, funnel, ask } = require('./diag-helpers');

const V230_SEC = 'Rallonge chaude, fiche qui fond ou odeur de brûlé : débranchez côté borne, risque d’incendie.';
const GAS_SEC = 'Odeur de gaz : fermez la bouteille, aérez, n’allumez rien et voyez le diagnostic « Je sens une odeur de gaz ».';
const FUSES = 'Fusibles plats assortis';

const NEW = [
  {
    id: 'p_glaciere',
    cat: 'frigo',
    label: 'Ma glacière électrique ne refroidit plus assez ou s’arrête toute seule',
    kw: 'glacière électrique ne refroidit plus assez s arrête toute seule thermoélectrique compression 12 v allume-cigare fiche fusible batterie moteur coupé',
    tree: funnel(
      ['Le témoin de la fiche 12 V de la glacière est-il éteint ?', buy('Le fusible de la fiche 12 V est grillé.',
        'Dévissez le bout de la fiche : le fusible est dedans. Remplacez-le par le même calibre (écrit sur la fiche).', 'Fusibles de rechange pour fiche 12 V'), ['Oui, il est éteint', 'Non, il est allumé']],
      ['Dégagez ses grilles (pas contre une paroi) et mettez-la à l’ombre, hors d’un coffre fermé. Refroidit-elle mieux ?', buy('La chaleur de la glacière ne s’évacuait pas.',
        'Laissez toujours de l’air autour de ses grilles. Une housse isotherme l’aide à garder le froid au soleil.', 'Housse isotherme pour glacière')],
      ['S’arrête-t-elle dès que le moteur est coupé ?', buy('La protection de batterie coupe la glacière.',
        'Elle se coupe pour ne pas vider la batterie quand la tension baisse. Une batterie nomade lithium la fait tourner moteur coupé.', 'Batterie nomade lithium pour glacière'), ['Oui', 'Non']],
      ['Le ventilateur tourne-t-il en continu, et fait-il très chaud dehors ?', buy('La glacière thermoélectrique a atteint sa limite.',
        'Ces glacières ne descendent que de 15 à 25 °C sous la température extérieure : par forte chaleur, elles ne suffisent plus. Une glacière à compression refroidit vraiment, même en été.', 'Glacière à compression'), ['Oui', 'Non']],
      ['Refroidissez-la d’abord sur 230 V et chargez des produits déjà froids. Est-ce réglé ?', buy('La glacière était chargée de produits tièdes.',
        'Une glacière garde le froid mais en refait peu : chargez-la froide, avec des accumulateurs de froid.', 'Accumulateurs de froid')],
      shop('Le compresseur de la glacière est en panne.', 'Alimentation bonne et glacière bien placée, elle ne refroidit pas : faites-la contrôler au magasin ou à l’atelier.', 'Contrôle de la glacière au service après-vente')
    ),
  },
  {
    id: 'p_induction',
    cat: 'elec',
    label: 'Ma plaque à induction ne chauffe pas ou ne reconnaît pas la casserole',
    kw: 'plaque induction ne chauffe pas reconnaît pas casserole clignote disjoncte borne puissance limiter 230 v cuisson',
    tree: funnel(
      ['Approchez un aimant du fond de la casserole : accroche-t-il ?', buy('La casserole n’est pas compatible induction.',
        'Seules les casseroles dont le fond attire l’aimant marchent sur l’induction. Une batterie de casseroles empilables pour camping-car prend peu de place.', 'Batterie de casseroles induction empilables pour camping-car'), ['Non, il n’accroche pas', 'Oui, il accroche']],
      ['Posée à plat, le fond de la casserole est-il bombé, ou plus petit que la zone de cuisson ?', buy('Le fond de la casserole n’est pas détecté.',
        'Un fond déformé ou trop petit n’est pas reconnu : prenez une casserole à fond plat, au diamètre de la zone.', 'Casserole induction au bon diamètre'), ['Oui', 'Non']],
      ['La plaque coupe-t-elle ou fait-elle sauter la borne ? Baissez sa limite de puissance (6, 10 ou 13 A selon le modèle). Est-ce réglé ?', buy('La plaque demandait plus que la borne ne donne.',
        'Réglez la limite de puissance de la plaque sur l’ampérage de la borne, et n’allumez pas d’autre gros appareil en même temps.', 'Aucun produit nécessaire'), ['Oui, c’est réglé', 'Non, rien ne change']],
      shop('La plaque à induction est en panne.', 'Bonne casserole, bonne puissance, elle ne chauffe pas : l’atelier la contrôle.', 'Contrôle de la plaque à l’atelier',
        'Verre fêlé : n’utilisez plus la plaque et coupez le 230 V.')
    ),
  },
  {
    id: 'p_appoint',
    cat: 'chauf',
    label: 'Mon radiateur d’appoint électrique s’arrête tout seul ou ma rallonge chauffe',
    eq: 'appoint',
    kw: 'radiateur d appoint chauffage électrique soufflant s arrête tout seul coupe sécurité surchauffe rallonge chauffe enrouleur borne',
    tree: funnel(
      ['La rallonge, la fiche ou la prise sont-elles chaudes, ou sentez-vous le brûlé ?', shop('La rallonge chauffe sous la charge du radiateur.',
        'Débranchez tout. Une rallonge restée enroulée ou trop fine chauffe avec un radiateur : n’utilisez qu’une rallonge 3 × 2,5 mm² déroulée en entier. L’atelier contrôle la prise du véhicule si elle a chauffé.',
        'Rallonge camping-car 3 × 2,5 mm² et contrôle de la prise à l’atelier', V230_SEC), ['Oui', 'Non']],
      ['Le radiateur est-il posé bien à plat et stable ?', buy('La sécurité anti-basculement avait coupé le radiateur.',
        'Posez-le à plat, sur un sol stable, loin du passage.', 'Chauffage d’appoint avec sécurités anti-basculement et surchauffe'), ['Non, il penchait', 'Oui']],
      ['Dégagez-le (rideau, coussin, paroi trop près). Reste-t-il allumé ?', buy('La sécurité de surchauffe avait coupé le radiateur.',
        'Laissez au moins un mètre libre devant et de l’air tout autour. Un modèle avec thermostat chauffe juste ce qu’il faut.', 'Chauffage d’appoint avec thermostat et sécurité de surchauffe'), ['Oui, il reste allumé', 'Non, il coupe encore']],
      ['C’est la borne du camping qui disjoncte ?', buy('Le radiateur demande plus que la borne ne donne.',
        'Voyez le diagnostic « Plus de 230 V » (« Ça disjoncte ») : réglez le radiateur sur une puissance plus faible.', 'Wattmètre de prise'), ['Oui', 'Non']],
      shop('Le radiateur d’appoint est en panne.', 'Bien placé et bien alimenté, il coupe encore : ne l’utilisez plus.', 'Chauffage d’appoint de remplacement', V230_SEC)
    ),
  },
  {
    id: 'p_auvent',
    cat: 'ext',
    label: 'Mon auvent se dégonfle, goutte à l’intérieur, moisit, se déchire ou sa fermeture coince',
    eq: 'auvent',
    kw: 'auvent gonflable boudin dégonfle mou vanne goutte condensation toile moisit taches déchirure fermeture éclair coince imperméable couture',
    tree: ask('Que se passe-t-il avec l’auvent ?', [
      ['Un boudin se dégonfle (auvent gonflable)', funnel(
        ['C’est le matin, après une nuit froide ? Regonflez à la pression indiquée. Est-ce réglé ?', buy('Le froid de la nuit avait fait baisser la pression.',
          'C’est normal : la pression baisse au froid. Regonflez le matin avec une pompe à manomètre.', 'Pompe de gonflage avec manomètre'), ['Oui, c’est réglé', 'Non, il se dégonfle encore']],
        ['Fermez toutes les vannes entre les boudins et attendez : un seul se ramollit ? Rebranchez son tuyau à fond sur la vanne et serrez le collier. Est-ce réglé ?', buy('Le tuyau du boudin s’était desserré sur sa vanne.',
          'Vérifiez les colliers à chaque montage : serrez à la main plus un demi-tour.', 'Aucun produit nécessaire'), ['Oui, il tient', 'Non, il perd encore']],
        buy('Le boudin de l’auvent est percé.', 'Repérez le trou avec un peu d’eau sur le boudin gonflé et posez une rustine du kit de réparation. Un boudin éclaté se fait changer chez le revendeur (garantie).', 'Kit de réparation pour boudin d’auvent')
      )],
      ['Il goutte à l’intérieur ou l’eau traverse', funnel(
        ['Les gouttes tombent-elles du plafond par temps frais, avec du monde dedans ?', buy('C’est de la condensation sous la toile.',
          'Aérez l’auvent. Une doublure de toit arrête la condensation, et un tapis de sol respirant évite l’humidité du sol.', 'Doublure de toit d’auvent et tapis de sol respirant'), ['Oui', 'Non']],
        ['L’eau passe-t-elle par une couture ou un ruban d’étanchéité décollé ?', buy('Une couture de l’auvent n’est plus étanche.',
          'Toile sèche, passez un mastic pour coutures de toile à l’intérieur.', 'Mastic pour coutures de toile'), ['Oui, par une couture', 'Non, à travers la toile']],
        buy('L’imperméabilisant de la toile est usé.', 'Nettoyez la toile puis passez un imperméabilisant pour toile d’auvent, une fois par an.', 'Imperméabilisant pour toile d’auvent')
      )],
      ['La toile est tachée ou moisie', buy('La toile de l’auvent a moisi.',
        'Taches noires après un rangement humide : nettoyez avec un nettoyant anti-moisissure adapté (coton ou PVC), puis séchez avant de ranger.', 'Nettoyant anti-moisissure pour toile')],
      ['La toile est déchirée', ask('La déchirure est-elle petite (moins d’une main) ?', [
        ['Oui', buy('La toile de l’auvent a une petite déchirure.', 'Toile propre et sèche, posez un patch de réparation des deux côtés.', 'Patch de réparation pour toile d’auvent')],
        ['Non, elle est grande', shop('La toile de l’auvent est trop déchirée.', 'Faites-la réparer ou changer le panneau chez le revendeur.', 'Réparation de la toile chez le revendeur')],
      ])],
      ['La fermeture éclair coince', buy('La fermeture éclair de l’auvent est sèche.', 'Brossez-la, puis pulvérisez un spray silicone pour fermetures éclair et faites-la glisser plusieurs fois.', 'Spray silicone pour fermetures éclair')],
    ]),
  },
  {
    id: 'p_wcseches',
    cat: 'wc',
    label: 'Mes toilettes sèches à séparation sentent mauvais',
    eq: 'wcfixe',
    kw: 'toilettes sèches séparation odeur sentent mauvais urine bidon ammoniac litière ventilateur filtre charbon tartre',
    tree: funnel(
      ['Le bidon d’urine est-il plein, ou resté plusieurs jours sans être vidé ? Videz-le et rincez-le. Est-ce réglé ?', buy('L’urine qui stagnait dégageait de l’ammoniac.',
        'Videz le bidon tous les deux ou trois jours et nettoyez-le avec un produit spécial réservoir d’urine.', 'Nettoyant pour réservoir d’urine')],
      ['Recouvrez-vous les matières après chaque passage ?', buy('Les matières humides sentent.',
        'Recouvrez-les à chaque passage avec un agent desséchant : il absorbe l’humidité et l’odeur.', 'Agent desséchant (litière) pour toilettes sèches'), ['Non, pas toujours', 'Oui']],
      ['Y a-t-il un dépôt jaune ou dur dans la cuvette ou le tuyau ?', buy('Du tartre urinaire s’est déposé.',
        'Un nettoyant spécial cuvette de toilettes sèches le dissout sans abîmer le plastique.', 'Nettoyant pour cuvette de toilettes sèches'), ['Oui', 'Non']],
      ['Le filtre du ventilateur a-t-il plus d’un an ?', buy('Le filtre à charbon du ventilateur est saturé.',
        'Changez-le une fois par an.', 'Filtre de rechange pour ventilateur de toilettes'), ['Oui, ou je ne sais pas', 'Non']],
      shop('Le raccord du tuyau d’urine fuit.', 'Odeur toujours là : l’atelier contrôle le tuyau d’urine et le ventilateur.', 'Contrôle des toilettes à l’atelier')
    ),
  },
  {
    id: 'p_station',
    cat: 'elec',
    label: 'Ma batterie nomade (station d’énergie) ne se recharge pas ou se coupe',
    kw: 'batterie nomade station d énergie powerstation ne se recharge pas se coupe surcharge chaleur panneau solaire pliable prise 12 v roulant',
    tree: funnel(
      ['Est-elle au soleil, derrière une vitre ou dans un coffre chaud ? Mettez-la à l’ombre dans un endroit aéré. Est-ce réglé ?', buy('La protection contre la chaleur avait coupé la batterie.',
        'Rangez-la à l’ombre et aérée, et calez-la ou sanglez-la pour la route.', 'Aucun produit nécessaire')],
      ['Se coupe-t-elle quand vous branchez un appareil à moteur ou à résistance (cafetière, sèche-cheveux) ?', buy('L’appareil dépasse la puissance de sortie de la batterie.',
        'Regardez la puissance de l’appareil (en W) : elle doit rester sous celle de la batterie. Sinon, il faut une station plus puissante.', 'Station d’énergie de plus forte puissance'), ['Oui', 'Non']],
      ['En roulant, branchée sur la prise 12 V, le voyant de charge reste-t-il éteint ?', buy('Le fusible de la prise 12 V est grillé.',
        'Changez le fusible de la prise au même calibre, puis voyez « Ma prise USB ou 12 V ne marche plus » si besoin.', FUSES), ['Oui, il reste éteint', 'Non, elle charge']],
      ['La recharge solaire est-elle faible ? Orientez le panneau face au soleil, sans ombre.', buy('Le panneau solaire était mal orienté.',
        'Tournez-le vers le soleil deux ou trois fois par jour ; une rallonge de câble permet de le poser au soleil, la batterie à l’ombre.', 'Panneau solaire pliable avec rallonge de câble'), ['Oui, elle est faible', 'Non']],
      shop('La batterie nomade est en panne.', 'Ni chaleur ni surcharge, elle se coupe ou ne charge plus : faites-la contrôler sous garantie.', 'Contrôle de la batterie nomade au service après-vente')
    ),
  },
  {
    id: 'p_essuieglace',
    cat: 'ext',
    label: 'Mes essuie-glaces laissent des traces ou mon lave-glace ne gicle plus',
    kw: 'essuie-glaces traces balais lave-glace gicle plus gelé réservoir insectes pare-brise pluie',
    tree: ask('Que se passe-t-il ?', [
      ['Le lave-glace ne gicle plus', funnel(
        ['Le réservoir de lave-glace est-il vide ?', buy('Le réservoir de lave-glace est vide.', 'Remplissez-le avec un liquide lave-glace, jamais de l’eau seule.', 'Liquide lave-glace'), ['Oui', 'Non']],
        ['Gèle-t-il en ce moment ?', buy('Le liquide de lave-glace a gelé.', 'Attendez le dégel puis remplacez-le par un lave-glace spécial hiver.', 'Lave-glace spécial hiver'), ['Oui', 'Non']],
        shop('La pompe de lave-glace est en panne.', 'Réservoir plein, aucun bruit de pompe : l’atelier contrôle la pompe et son fusible.', 'Contrôle du lave-glace à l’atelier')
      )],
      ['Les essuie-glaces laissent des traces', funnel(
        ['Nettoyez le pare-brise avec un nettoyant anti-insectes. Les traces disparaissent-elles ?', buy('Le pare-brise était encrassé.', 'Les insectes et la graisse de la route font des traces : nettoyez-le à chaque plein.', 'Nettoyant anti-insectes')],
        ['Le caoutchouc des balais est-il fendu ou dur ?', buy('Les balais sont usés.', 'Changez-les une fois par an, à la longueur d’origine.', 'Balais de rechange pour le pare-brise'), ['Oui', 'Non']],
        buy('L’eau de pluie colle au pare-brise.', 'Un traitement anti-pluie fait glisser l’eau et aide les balais.', 'Traitement anti-pluie pour pare-brise')
      )],
    ]),
  },
  {
    id: 'p_dome',
    cat: 'ext',
    label: 'Mon lanterneau panoramique (dôme de toit) est rayé, fendillé ou a de la buée entre ses vitres',
    eq: 'heki',
    kw: 'lanterneau panoramique dôme de toit heki rayé fendillé fissures étoile buée entre les vitres acrylique',
    tree: ask('Que voyez-vous ?', [
      ['De la buée entre les deux vitres', funnel(
        ['Aérez et chauffez la cellule quelques heures. La buée disparaît-elle ?', buy('L’acrylique avait absorbé l’humidité.',
          'C’est normal par temps froid et humide : la buée part en aérant. Un absorbeur d’humidité aide.', 'Absorbeur d’humidité'), ['Oui', 'Non, elle reste']],
        shop('Le double vitrage du dôme n’est plus étanche.', 'La buée reste : le vitrage est à changer. Ce n’est pas urgent tant qu’il ne fuit pas.', 'Vitrage de lanterneau, posé par l’atelier')
      )],
      ['De fines rayures', buy('Les rayures viennent de la poussière et des branches.', 'Un kit efface-rayures pour acrylique les atténue. Nettoyez ensuite seulement avec un nettoyant spécial acrylique.', 'Kit efface-rayures pour acrylique')],
      ['De petites fissures en étoile', buy('Un produit pour vitres a attaqué l’acrylique.',
        'Les produits pour vitres ou à l’alcool fendillent l’acrylique : n’utilisez plus qu’un nettoyant spécial acrylique, avant que ça s’aggrave.', 'Nettoyant spécial acrylique')],
      ['Une vraie fente ou un trou', shop('La vitre du dôme est fendue.', 'L’eau peut entrer : protégez-la de la pluie et prenez rendez-vous.', 'Vitrage de lanterneau, posé par l’atelier', null, 'etanch')],
    ]),
  },
  {
    id: 'p_four',
    cat: 'gaz',
    label: 'Mon four à gaz ne s’allume pas ou s’éteint quand je lâche le bouton',
    eq: 'four',
    kw: 'four à gaz ne s allume pas s éteint lâche le bouton allumeur étincelle pile thermocouple flamme',
    tree: funnel(
      ['La plaque de cuisson s’allume-t-elle, elle ?', buy('Le gaz n’arrive plus dans le véhicule.',
        'Ni plaque ni four : voyez le diagnostic « Plus de gaz alors que la bouteille n’est pas vide ».', 'Aucun produit nécessaire', GAS_SEC), ['Non, rien ne s’allume', 'Oui, la plaque marche']],
      ['Vous venez de changer de bouteille ? Essayez d’allumer trois ou quatre fois. Le four s’allume-t-il ?', buy('De l’air restait dans le tuyau de gaz.',
        'Après un changement de bouteille, il faut quelques essais pour chasser l’air.', 'Aucun produit nécessaire', GAS_SEC), ['Oui, il s’allume', 'Non']],
      ['Entendez-vous l’étincelle de l’allumeur ?', buy('La pile de l’allumeur du four est usée.',
        'Changez la pile de l’allumeur (souvent sous le bouton ou dans le four, selon le modèle).', 'Pile pour allumeur de four', GAS_SEC), ['Non, aucune étincelle', 'Oui']],
      ['Bouton enfoncé, gardez-le appuyé 15 secondes après l’allumage. Le four reste-t-il allumé ?', buy('La sécurité de flamme n’avait pas eu le temps de chauffer.',
        'Gardez toujours le bouton appuyé 15 secondes après l’allumage.', 'Aucun produit nécessaire', GAS_SEC), ['Oui, il reste allumé', 'Non, il s’éteint']],
      shop('La sécurité de flamme du four est en défaut.', 'Ne démontez rien. L’atelier contrôle le thermocouple et le brûleur (toiles d’araignée après l’hiver).', 'Contrôle du four à l’atelier', GAS_SEC)
    ),
  },
];

// New answers added to older diagnostics (appended to their first question).
const BRANCHES = {
  h_wc: ['La cuvette jaunit, la chasse est faible, le clapet est dur ou la cassette se bouche', ask('Lequel ?', [
    ['La cuvette jaunit ou garde des traces', buy('Des dépôts ont jauni la cuvette.', 'N’utilisez pas de produit ménager : il attaque le plastique. Un nettoyant spécial cuvette de WC chimique et un produit de rinçage protecteur la gardent blanche.', 'Nettoyant pour cuvette de WC chimique')],
    ['La chasse est faible, réservoir plein et fusible bon', funnel(
      ['Versez un additif de rinçage anticalcaire dans le réservoir de chasse et faites quelques chasses. Est-ce mieux ?', buy('Le calcaire freinait la pompe de chasse.', 'Ajoutez l’additif à chaque plein du réservoir de chasse.', 'Additif de rinçage anticalcaire pour WC chimique'), ['Oui, c’est mieux', 'Non, rien ne change']],
      shop('La pompe de chasse est usée.', 'L’atelier contrôle et change la pompe.', 'Pompe de chasse, posée par l’atelier')
    )],
    ['Le clapet est dur ou bloqué après l’hiver', buy('Le joint du clapet s’est collé pendant l’hiver.', 'Pulvérisez un lubrifiant spécial joints sur le joint à lèvres et manœuvrez doucement. Pour l’hiver suivant, laissez le clapet ouvert.', 'Spray lubrifiant pour joints de WC')],
    ['La cassette se bouche à la vidange', buy('Le papier toilette ordinaire bouche la cassette.', 'Utilisez un papier toilette à dissolution rapide et un additif qui décompose les matières.', 'Papier toilette à dissolution rapide')],
  ])],
  h_frigo: ['Au gaz : il ne s’allume pas après un changement de bouteille, ou il passe au gaz alors que je suis branché', ask('Lequel ?', [
    ['Il ne s’allume pas juste après un changement de bouteille', funnel(
      ['Relancez l’allumage trois ou quatre fois. Le frigo s’allume-t-il ?', buy('De l’air restait dans le tuyau de gaz.', 'Après un changement de bouteille, quelques essais chassent l’air. Allumer d’abord la plaque de cuisson aide.', 'Aucun produit nécessaire', GAS_SEC), ['Oui, il s’allume', 'Non']],
      shop('Le circuit gaz du frigo est en défaut.', 'Voyez aussi « La flamme de mon frigo ne s’allume pas ». L’atelier contrôle le brûleur.', 'Contrôle du frigo à l’atelier', GAS_SEC)
    )],
    ['Il passe au gaz alors que je suis branché (mode automatique)', buy('La tension de la borne est trop faible pour le frigo.', 'En automatique, le frigo passe au gaz si le 230 V est trop bas, puis revient seul. Une rallonge de bonne section déroulée en entier aide.', 'Rallonge 230 V 3 × 2,5 mm²')],
  ])],
  nogas: ['La flamme baisse et le gaz arrive mal (détendeur encrassé)', funnel(
    ['Le détendeur a-t-il plus de 10 ans (date gravée dessus) ?', buy('Le détendeur est trop ancien.', 'Il se change tous les 10 ans, avec sa lyre.', 'Détendeur et lyre de gaz', GAS_SEC), ['Oui', 'Non']],
    buy('Les impuretés du gaz encrassent le détendeur.', 'Un filtre à gaz posé avant le détendeur le protège des dépôts huileux. Faites-le poser par l’atelier.', 'Filtre à gaz avant détendeur', GAS_SEC)
  )],
  h_store: ['La toile est tachée, verte ou moisie', funnel(
    ['La toile a-t-elle été rangée mouillée ? Déroulez-la par temps sec et laissez-la sécher. Les taches noires restent-elles ?', buy('La toile du store a moisi.', 'Nettoyez avec un nettoyant anti-moisissure pour toile, puis séchez toujours avant de rentrer le store.', 'Nettoyant anti-moisissure pour toile'), ['Oui, elles restent', 'Non, elles sont parties']],
    ['Y a-t-il des taches de sève ou des traces noires de coulures ?', buy('La toile du store est encrassée.', 'Un nettoyant spécial toile de store les enlève sans abîmer la toile.', 'Nettoyant spécial toile de store'), ['Oui', 'Non']],
    buy('La toile du store laisse passer l’eau.', 'Toile propre et sèche, passez un imperméabilisant pour toile.', 'Imperméabilisant pour toile')
  )],
  p_baie: ['De petites fissures en étoile autour des fixations', buy('Un produit pour vitres a attaqué l’acrylique de la baie.',
    'Les produits pour vitres ou à l’alcool fendillent l’acrylique : n’utilisez plus qu’un nettoyant spécial acrylique, et un polish pour acrylique si la baie est devenue terne. Une fissure qui s’agrandit se fait voir à l’atelier.', 'Nettoyant spécial acrylique et polish pour acrylique')],
  p_internet: ['J’ai un téléphone mais le réseau est très faible', funnel(
    ['Garez-vous dans un endroit dégagé (pas entre des bâtiments, pas au fond d’une vallée). Le réseau revient-il ?', buy('Les obstacles bloquaient le réseau.', 'Une application de carte des relais montre où se trouve l’antenne la plus proche.', 'Aucun produit nécessaire'), ['Oui, il revient', 'Non']],
    buy('Le téléphone seul capte mal dans la cellule.', 'Une antenne 4G/5G extérieure, orientée vers le relais, capte beaucoup mieux. Choisissez-la compatible avec les fréquences de votre opérateur.', 'Antenne 4G/5G extérieure pour camping-car')
  )],
};

// The « Lavage » diagnostic was one end point: now a funnel.
const LAVAGE = funnel(
  ['Le problème, ce sont surtout les coulures noires sous les baies et le toit ?', buy('Les coulures noires ne partent pas avec un nettoyant ordinaire.', 'Un nettoyant spécial coulures noires les dissout ; ensuite une cire protectrice les empêche de revenir.', 'Nettoyant anti-coulures noires et cire de protection'), ['Oui', 'Non']],
  ['Des insectes collés sur la face avant ?', buy('Les insectes collés abîment la peinture.', 'Nettoyez-les vite après le trajet avec un nettoyant anti-insectes.', 'Nettoyant anti-insectes'), ['Oui', 'Non']],
  ['Un aspect verdâtre sur les joints ou le toit ?', buy('De la mousse s’installe sur la carrosserie.', 'Un nettoyant anti-mousse spécial camping-car l’enlève sans abîmer les joints.', 'Nettoyant anti-mousse pour camping-car'), ['Oui', 'Non']],
  buy('Le camping-car est difficile à laver en hauteur.', 'Une brosse télescopique et un shampooing spécial camping-car rendent le lavage plus simple.', 'Brosse de lavage télescopique et shampooing pour camping-car')
);

module.exports = { NEW, BRANCHES, LAVAGE };
