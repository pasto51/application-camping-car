'use strict';

// « Le camping-car pour les nuls » (le-camping-car-pour-les-nuls.blogspot.com, read from end to end: articles, pages,
// « Mécontents » and comments): the failures our diagnostics missed or only half covered. Applied once
// (« 2026-11-08-blog-nuls »), with the engine of diagnostics-audit.js. Ends follow the store / workshop rules: no tape,
// no glue « système D », no part reference.

const { buy, shop, funnel, ask } = require('./diag-helpers');
const { applyChanges } = require('./diagnostics-audit');

const none = (cause, geste, sec = null) => ({ cause, geste, prod: 'Aucun produit nécessaire', sec });
const YN = ['Oui', 'Non'];
const LANT_SEC = 'Ne roulez pas avec un lanterneau qui se soulève : le vent peut l’arracher.';

const OPS = [
  // After a bottle change or a LPG fill, air in the pipe puts the heater in safety a few times.
  { id: 'heater', op: 'before', at: 'Attendez 15 minutes après l\'arrêt de sécurité',
    t: 'Venez-vous de changer de bouteille ou de faire le plein de GPL ? Allumez un feu du réchaud quelques secondes, puis relancez le chauffage deux ou trois fois. Démarre-t-il ?',
    o: ['Oui, il démarre', 'Non, ou je n’ai pas changé de bouteille'],
    leaf: none('De l’air restait dans le tuyau de gaz après le changement de bouteille.', 'Après chaque changement de bouteille, allumez d’abord le réchaud : il chasse l’air du tuyau, et le chauffage démarre ensuite du premier coup.') },
  // On the 230 V charger: oxidised or loose terminals.
  { id: 'nocharge', op: 'before', at: 'La batterie a-t-elle plus de 5 ans',
    t: 'Coupe-batterie sur « arrêt », regardez les cosses de la batterie cellule : sont-elles blanches, vertes ou desserrées ? Nettoyez-les, resserrez-les, remettez le coupe-batterie et rebranchez. La batterie monte-t-elle ?',
    leaf: buy('Une cosse oxydée de la batterie cellule empêchait la charge.', 'Nettoyez les cosses une fois par an et protégez-les avec un spray pour bornes.', 'Nettoyant et spray protecteur pour cosses de batterie') },
  // The fridge relay stuck on: the fridge keeps running on 12 V, engine off.
  { id: 'p_batmoteur', op: 'before', at: 'La batterie du moteur se décharge doucement à l’arrêt.',
    t: 'Moteur arrêté depuis plus d’une heure, le frigo marche-t-il encore sur 12 V (voyant 12 V allumé, si votre frigo en a un) ?',
    o: ['Oui, il reste sur 12 V', 'Non, ou mon frigo n’a pas de 12 V'],
    leaf: shop('Le relais du frigo reste collé : le frigo vide la batterie du moteur à l’arrêt.', 'En attendant, passez le frigo sur gaz ou 230 V à chaque arrêt. L’atelier change le relais et contrôle son câblage.', 'Contrôle du relais du frigo à l’atelier', null, 'frigo') },
  // The alarm screams at night: its fuse melted, the alarm thinks a wire was cut.
  { id: 'p_alarme', op: 'before', at: 'La pile de la télécommande ou une batterie du véhicule est-elle faible',
    t: 'Regardez le fusible de l’alarme (sa place est dans la notice de l’alarme) : est-il fondu ? Remplacez-le par un fusible de même calibre. L’alarme reste-t-elle calme ?',
    leaf: buy('Le fusible de l’alarme a fondu : l’alarme croyait qu’un fil avait été coupé.', 'Gardez des fusibles de rechange à bord. S’il fond de nouveau, passez à l’atelier.', 'Fusibles plats assortis') },
  // Water inside the light after the rain.
  { id: 'p_feux', op: 'before', at: 'Ampoule retirée, le culot est-il vert',
    t: 'Voyez-vous de l’eau ou de la buée à l’intérieur du feu ?', o: ['Oui, il y a de l’eau', 'Non, il est sec'],
    leaf: buy('Le joint du feu n’est plus étanche : l’eau entre dans le feu.', 'Séchez le feu. Le magasin fournit le joint (ou le feu complet) au modèle de votre véhicule ; l’atelier peut le poser.', 'Joint de feu au modèle du véhicule') },
  // Yellowed, chalky polyester front.
  { id: 'p_lavage', op: 'before', at: 'Un aspect verdâtre sur les joints ou le toit',
    t: 'La face avant ou une paroi en polyester est-elle jaunie, terne ou farineuse (la main devient blanche en la touchant) ?', o: YN,
    leaf: buy('Le polyester s’oxyde au soleil.', 'Lavez, puis passez un rénovateur pour polyester. Protégez ensuite la paroi deux fois par an avec une cire anti-UV.', 'Rénovateur pour polyester et cire anti-UV') },
  // The open door doesn't stay open: its stop is worn.
  { id: 'p_porte', op: 'answer', at: 'Que se passe-t-il ?', option: 'Ouverte, elle ne reste plus bloquée et bat au vent',
    node: funnel(
      ['Ouvrez la porte en grand : l’arrêt de porte sur la paroi (crochet ou ventouse) est-il usé ou cassé ?', buy('L’arrêt de porte est usé : il ne retient plus la porte.', 'Ne laissez pas la porte battre au vent : elle abîme sa charnière. L’arrêt neuf se visse à la place de l’ancien.', 'Arrêt de porte de cellule'), ['Oui, il est usé ou cassé', 'Non, il est entier']],
      shop('La porte ne s’accroche plus sur son arrêt.', 'L’atelier règle l’arrêt et la charnière de la porte.', 'Réglage de la porte à l’atelier')
    ) },
  // A roof vent that opens while driving.
  { id: 'lant', op: 'answer', at: 'Que constatez-vous ?', option: 'Il se soulève ou s’ouvre tout seul en roulant',
    node: funnel(
      ['Fermez-le jusqu’en butée et enclenchez bien le verrou. Reste-t-il fermé en roulant ?', none('Le lanterneau n’était pas fermé jusqu’au verrou.', 'Avant chaque départ, faites le tour des lanterneaux : le vent arrache un lanterneau mal fermé.', LANT_SEC)],
      shop('Le verrou du lanterneau est cassé.', 'Ne roulez plus avec : l’atelier change le verrou ou le compas.', 'Remplacement du verrou du lanterneau à l’atelier', LANT_SEC)
    ) },
  // A panoramic dome deformed by the heat trapped under its blind.
  { id: 'p_dome', op: 'answer', at: 'Que voyez-vous ?', option: 'Il est bombé ou déformé',
    node: funnel(
      ['Laissez-vous le store occultant fermé en plein soleil ?', buy('La chaleur bloquée sous le store occultant a déformé le dôme.', 'Aux heures chaudes, laissez l’occultant ouvert (moustiquaire seule) et protégez le dôme par l’extérieur. Si de l’eau entre déjà, passez à l’atelier.', 'Isolant extérieur de lanterneau'), YN],
      shop('Le dôme est déformé.', 'L’atelier contrôle son étanchéité et le remplace si besoin.', 'Contrôle du dôme à l’atelier', null, 'etanch')
    ) },
  // A tank full to the brim spills through its overflow in bends.
  { id: 'p_fuite', op: 'before', at: 'Le réservoir d’eau propre déborde par son trop-plein.',
    t: 'L’eau sort-elle par le trop-plein surtout en roulant (virages, freinages), réservoir plein à ras ?', o: ['Oui, en roulant', 'Non, pendant le remplissage'],
    leaf: buy('Le réservoir plein à ras déborde par son trop-plein quand l’eau bouge en roulant.', 'Remplissez un peu moins avant de rouler. Si cela ne suffit pas, un clapet se pose sur le tube de trop-plein.', 'Clapet anti-débordement pour trop-plein de réservoir') },
  // The grey tank only half empties.
  { id: 'c_tank_vidange', op: 'answer', at: 'Que se passe-t-il ?', option: 'L’eau sort, mais le réservoir reste à moitié plein',
    node: funnel(
      ['Garez-vous légèrement penché du côté de la vanne (cales sous les roues de l’autre côté), puis rouvrez. Le réservoir se vide-t-il en entier ?', buy('Le véhicule penchait à l’opposé de la vanne : l’eau restait au fond.', 'Sur l’aire de vidange, calez le véhicule pour que la vanne soit au point le plus bas.', 'Cales de nivellement')],
      ['Versez un nettoyant pour réservoir d’eaux grises, roulez une demi-heure, puis vidangez. Le réservoir se vide-t-il en entier ?', buy('Des dépôts gras retenaient l’eau au fond du réservoir.', 'Traitez le réservoir une fois par mois et vidangez souvent.', 'Nettoyant pour réservoir d’eaux grises')],
      shop('La vidange du réservoir est en défaut.', 'L’atelier contrôle la vanne et la mise à l’air du réservoir.', 'Contrôle de la vidange à l’atelier')
    ) },
  // The Truma Combi D under the bed keeps people awake.
  { id: 'g_trumad', op: 'answer', at: 'Que constatez-vous ?', option: 'Il est très bruyant, surtout la nuit',
    node: funnel(
      ['Le soir, chauffez bien la cellule, puis passez la ventilation en mode « éco » ou « nuit » et baissez la consigne. Le bruit devient-il supportable ?', none('Le chauffage tournait à pleine puissance la nuit.', 'Chauffez la cellule avant le coucher, puis laissez-le en mode nuit.')],
      shop('Le bruit d’échappement et d’aspiration du chauffage n’est pas amorti.', 'L’atelier pose des silencieux d’échappement et d’aspiration adaptés, et contrôle les fixations anti-vibrations.', 'Pose de silencieux à l’atelier', null, 'chauf')
    ) },
  // The bike rack hides the reversing camera.
  { id: 'p_camera', op: 'before', at: 'La caméra ne s’allume qu’en marche arrière.',
    t: 'L’image montre-t-elle surtout le porte-vélos ou les vélos ?', o: ['Oui', 'Non, l’image est bonne'],
    leaf: buy('Le porte-vélos cache la caméra de recul.', 'Le magasin ou l’atelier déplace la caméra en haut de la paroi arrière, au-dessus du porte-vélos.', 'Caméra de recul à fixer en haut de paroi') },
  // The light under the drop-down bed is switched by the bed itself.
  { id: 'p_lampe', op: 'answer', at: 'Que se passe-t-il ?', option: 'La lumière sous le lit de pavillon ne s’allume plus',
    node: funnel(
      ['Descendez le lit à fond, jusqu’en butée. La lumière s’allume-t-elle ?', none('Le lit n’était pas descendu jusqu’en butée : c’est lui qui allume cette lumière.', 'Cette lumière s’allume seulement quand le lit est descendu à fond.')],
      shop('Le contacteur du lit de pavillon est déréglé.', 'Ne forcez pas sur le lit : l’atelier règle le contacteur.', 'Réglage du contacteur du lit à l’atelier')
    ) },
  // The roof vent blind derails when driving with the vent ajar.
  { id: 'p_storeplisse', op: 'answer', at: 'Qu’est-ce qui ne va pas ?', option: 'Il déraille quand je roule',
    node: funnel(
      ['Le lanterneau ou la fenêtre derrière le store était-il entrouvert ? Fermez-le, remettez le store dans ses rails et roulez. Le store tient-il ?', buy('L’air du lanterneau entrouvert faisait dérailler le store.', 'Roulez lanterneau fermé. Pour garder l’isolation en roulant, posez un isolant de lanterneau à la place du store.', 'Isolant de lanterneau')],
      shop('Les rails du store ne le retiennent plus en roulant.', 'L’atelier contrôle le store et ses rails.', 'Contrôle du store à l’atelier')
    ) },
  // Broken drawer runners.
  { id: 'p_placard', op: 'before', at: 'Appuyez sur le bouton poussoir',
    t: 'Est-ce un tiroir qui sort de travers ou qui tombe ? Videz-le : une glissière est-elle tordue ou cassée ?', o: ['Oui, une glissière est cassée', 'Non, ou c’est une porte de placard'],
    leaf: buy('Une glissière du tiroir est cassée.', 'Les glissières se changent avec les mêmes vis. Allégez le tiroir et gardez-le verrouillé en roulant.', 'Glissières de tiroir de rechange') },
  { id: 'heater', op: 'kw', words: 'changement de bouteille plein gpl plusieurs essais air dans le tuyau' },
  { id: 'nocharge', op: 'kw', words: 'cosses oxydées bornes sulfatées' },
  { id: 'p_batmoteur', op: 'kw', words: 'relais frigo batterie moteur vide en une nuit' },
  { id: 'p_alarme', op: 'kw', words: 'hurle en pleine nuit fusible alarme' },
  { id: 'p_feux', op: 'kw', words: 'eau dans le feu buée feu stop haut' },
  { id: 'p_lavage', op: 'kw', words: 'polyester jauni terne farineux oxydé face avant' },
  { id: 'p_porte', op: 'kw', words: 'arrêt de porte bat au vent retenue' },
  { id: 'lant', op: 'kw', words: 'ouvert en roulant envolé arraché soulève' },
  { id: 'p_dome', op: 'kw', words: 'bombé déformé gondolé' },
  { id: 'p_fuite', op: 'kw', words: 'trop-plein virages déborde en roulant' },
  { id: 'c_tank_vidange', op: 'kw', words: 'se vide à moitié reste de l eau' },
  { id: 'g_trumad', op: 'kw', words: 'bruyant bruit nuit sous le lit' },
  { id: 'p_camera', op: 'kw', words: 'porte-vélos cache caméra' },
  { id: 'p_lampe', op: 'kw', words: 'lit de pavillon plafonnier cabine' },
  { id: 'p_storeplisse', op: 'kw', words: 'déraille en roulant occultant lanterneau' },
  { id: 'p_placard', op: 'kw', words: 'glissière tiroir tombe de travers' },
];

const NEW = [
  {
    id: 'p_rouille',
    cat: 'ext',
    label: 'Des vis, des écrous ou des supports rouillent (dessous du véhicule, soutes)',
    kw: 'rouille rouillé visserie boulons écrous vis châssis soute faux plancher corrosion antirouille',
    tree: funnel(
      ['La rouille est-elle seulement en surface (taches orange sur les vis, les écrous ou les supports) ?', buy('La visserie d’origine rouille avec l’humidité.', 'Brossez la rouille à la brosse métallique, puis pulvérisez un galvanisant à froid. Recommencez chaque année avant l’hiver, et faites remplacer peu à peu les vis par de l’inox.', 'Spray antirouille galvanisant à froid'), ['Oui, en surface', 'Non, une pièce est rongée ou percée']],
      shop('La rouille a attaqué une pièce en profondeur.', 'Une pièce rongée (support, fixation de réservoir, longeron) peut lâcher : l’atelier la contrôle et la remplace.', 'Contrôle antirouille à l’atelier')
    ),
  },
  {
    id: 'p_meuble',
    cat: 'ext',
    label: 'Un meuble bouge ou s’écarte de la paroi, ou un chant (bordure) se décolle',
    kw: 'meuble bouge décollé se décolle paroi équerre chant bordure habillage colle vibrations',
    tree: ask('Qu’est-ce qui ne tient plus ?', [
      ['Le meuble entier bouge ou s’écarte de la paroi', funnel(
        ['Ouvrez le meuble : une petite équerre en plastique qui le tient à la paroi est-elle fendue ou cassée ?', buy('Une équerre de fixation du meuble a cassé avec les vibrations.', 'Changez-la par le même modèle, avec ses vis, et gardez-en deux ou trois à bord. Si la vis ne tient plus dans la paroi, passez à l’atelier : ne percez pas la paroi.', 'Équerres de fixation de meuble pour camping-car'), ['Oui', 'Non, elles sont entières']],
        shop('La fixation du meuble dans la paroi ne tient plus.', 'L’atelier refixe le meuble sans abîmer la paroi.', 'Refixation du meuble à l’atelier')
      )],
      ['Un chant (bordure) ou un habillage se décolle', funnel(
        ['Nettoyez et séchez le chant, recollez-le à la colle de montage et maintenez-le pendant le séchage. Tient-il ?', buy('La colle d’origine du chant a lâché avec la chaleur et les vibrations.', 'Recollez dès le début du décollement, avant que le panneau ne prenne l’humidité.', 'Colle de montage spéciale camping-car')],
        shop('Le chant ne tient plus sur le panneau.', 'L’atelier le recolle ou le remplace.', 'Réparation du meuble à l’atelier')
      )],
    ]),
  },
  {
    id: 'p_ralentisseur',
    cat: 'ext',
    label: 'Le dessous de mon camping-car touche les ralentisseurs ou les entrées de parking',
    kw: 'touche frotte racle ralentisseur dos d âne trottoir parking porte-à-faux bas arrière suspension',
    tree: funnel(
      ['Passez les ralentisseurs en biais, une roue après l’autre, au pas. Est-ce réglé ?', none('Le porte-à-faux arrière touchait en passant le ralentisseur de face.', 'Passez toujours ralentisseurs et entrées de parking en biais, au pas.')],
      ['Videz les eaux grises, ne gardez que l’eau utile et rangez le lourd près des roues plutôt qu’au fond de la soute arrière. Est-ce réglé ?', none('Le poids à l’arrière écrasait la suspension.', 'Roulez eaux grises vides et réservoir d’eau propre en partie rempli ; gardez les charges lourdes près des essieux.')],
      shop('La suspension arrière est trop basse pour la charge du véhicule.', 'L’atelier pose une suspension pneumatique auxiliaire, qui remonte l’arrière de quelques centimètres.', 'Suspension pneumatique auxiliaire (pose à l’atelier)')
    ),
  },
  {
    id: 'p_sifflement',
    cat: 'ext',
    label: 'Ça siffle en roulant (portière, porte de cellule, pare-brise, fenêtre)',
    kw: 'siffle sifflement bruit d air vent en roulant portière joint pare-brise fenêtre',
    tree: ask('D’où vient le sifflement ?', [
      ['D’une portière ou de la porte de cellule', funnel(
        ['Passez un lubrifiant silicone sur le joint et fermez la porte à fond. Le sifflement s’arrête-t-il ?', buy('Le joint de la porte était sec : l’air passait en roulant.', 'Entretenez les joints de porte au silicone à chaque saison.', 'Lubrifiant silicone pour joints')],
        ['Le joint est-il écrasé, déchiré ou décollé par endroits ?', buy('Le joint de la porte est abîmé.', 'Le magasin fournit le joint au modèle de votre véhicule ; il se pose en le pressant dans sa feuillure.', 'Joint de porte au modèle du véhicule'), ['Oui', 'Non, il est en bon état']],
        shop('La porte ne plaque plus sur son joint.', 'L’atelier règle la gâche et les charnières.', 'Réglage de la porte à l’atelier')
      )],
      ['Du pare-brise', shop('Le joint du pare-brise laisse passer l’air.', 'N’y collez rien vous-même : l’atelier contrôle le joint, et le pare-brise s’il a bougé.', 'Contrôle du pare-brise à l’atelier', null, 'etanch')],
      ['D’une fenêtre de la cellule', funnel(
        ['Fermez-la jusqu’au dernier cran et tournez bien ses verrous. Le sifflement s’arrête-t-il ?', none('La fenêtre n’était pas verrouillée à fond.', 'Avant de rouler, vérifiez que chaque fenêtre est fermée sur tous ses verrous.')],
        shop('Le joint de la fenêtre est usé.', 'L’atelier remplace le joint de la fenêtre.', 'Contrôle de la fenêtre à l’atelier', null, 'etanch')
      )],
    ]),
  },
];

function applyBlogNuls(db) {
  const n = applyChanges(db, { ops: OPS, news: NEW });
  applyBlogNuls.missed = applyChanges.missed;
  return n;
}

module.exports = { applyBlogNuls, OPS, NEW };
