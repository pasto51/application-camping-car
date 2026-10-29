'use strict';

// What the store's training days teach (hivernage, Master Class énergie, atelier énergie, suspensions, vérins and
// stabilisation) and the app did not say yet. Applied once (« 2026-11-10-formations »): lines added to the
// « Hivernage » and « Remise en route » lists (only if missing), tips to proofread (never published as they are),
// and two diagnostics completed. No part reference, no brand: the store's own words stay with the store.

const { buy, shop, funnel } = require('./diag-helpers');
const { applyChanges } = require('./diagnostics-audit');

const none = (cause, geste, sec = null) => ({ cause, geste, prod: 'Aucun produit nécessaire', sec });
const YN = ['Oui', 'Non'];

const LINES = {
  hiver: [
    'Gaz : je ferme les bouteilles et je dévisse la lyre (le tuyau souple), pour que son joint ne colle pas à la bouteille. Le propane ne craint pas le froid : les bouteilles peuvent rester à bord, robinets fermés.',
    'Eaux grises : une fois le réservoir vidé, je laisse sa vanne de vidange ouverte tout l’hiver. Rien ne gèle dedans et il s’aère.',
    { t: 'Cassette WC : je la nettoie, je graisse le joint de la lame, puis je la laisse hors de son logement, lame ouverte, pour qu’elle s’aère.', eq: ['wc'] },
    { t: 'Frigo à absorption : je nettoie ses grilles extérieures, puis je pose les caches d’hiver.', variant: ['frigo', 'trimixte'] },
    { t: 'Lanterneau panoramique à manivelle : je le laisse très légèrement entrouvert, pour que son joint ne colle pas au cadre.', eq: ['heki'] },
    { t: 'Rafraîchisseur d’air : je vide son eau et je nettoie son filtre.', eq: ['rafraich'] },
    'Serrures : je pulvérise un lubrifiant dans les serrures de la porte et des soutes. L’humidité de l’hiver les grippe.',
    'Placards : je les vide de toute nourriture (les rongeurs adorent) et je laisse les portes entrouvertes.',
    { t: 'Lit de pavillon : je le laisse en position basse, pour que l’air circule autour du matelas.', eq: ['pavillon'] },
    'Appareils : je sors la télé, le GPS et les petits appareils, pour les garder au sec à la maison.',
    'Carburant : je fais le plein avant de garer le véhicule. Un réservoir plein limite la condensation dans le gazole.',
    'Frein à main : sur un sol plat, cales sous les roues et vitesse engagée, je le desserre, pour que les freins ne collent pas.',
    'Moteur : je contrôle les niveaux, puis je glisse un carton sous le moteur. Une tache au printemps révèle une fuite.',
    'Carrosserie : je lave le véhicule, toit compris, avant de le garer, et je le cale légèrement penché pour que la pluie s’écoule.',
    'Dehors : une housse respirante à la taille du véhicule, des housses sur les roues et des protections sur les essuie-glaces.',
  ],
  printemps: [
    'Gaz : je revisse la lyre sur la bouteille, je regarde sa date, puis je contrôle les raccords avec un spray détecteur de fuite.',
    { t: 'Frigo à absorption : je retire les caches d’hiver des grilles avant de l’allumer.', variant: ['frigo', 'trimixte'] },
    { t: 'Cassette WC : je la remets dans son logement et je referme la lame.', eq: ['wc'] },
    'Carton sous le moteur : s’il est taché, je passe à l’atelier avant de partir.',
    'Freins : après des mois à l’arrêt, je fais les premiers mètres au pas et j’essaie les freins avant de prendre la route.',
  ],
};

const TIPS = [
  {
    title: 'À la maison tout est à volonté, en camping-car tout est à gérer',
    category: 'energie',
    body: 'Chez vous, l’eau, le gaz et l’électricité ne s’arrêtent jamais. En camping-car, chacun a sa réserve : un réservoir d’eau, des bouteilles de gaz, une batterie. Quand une réserve est vide, il faut déplacer la maison pour la refaire. Regarder ses niveaux chaque jour, c’est la clé de vacances tranquilles.',
    storeTip: 'Un moniteur de batterie affiche en direct ce que vous consommez et le temps qu’il vous reste.',
  },
  {
    title: 'Votre batterie est un seau d’eau',
    category: 'energie',
    body: 'Imaginez une batterie de 100 Ah comme un seau de 100 litres. Le moteur le remplit d’environ 5 à 10 litres par heure : il faut plus de 8 heures de route pour le remplir. Une borne 230 V fait à peu près pareil (10 à 20 heures). Un panneau solaire de 100 W donne 2,5 à 4 litres par heure en plein soleil : environ 40 par jour l’été, 25 au printemps et à l’automne, 5 à 10 l’hiver. Toutes les recharges sont lentes : c’est la batterie qui fixe la vitesse.',
    storeTip: 'Une batterie lithium avec son booster de charge, posés par l’atelier, se remplit trois à quatre fois plus vite en roulant.',
  },
  {
    title: 'Ce que consomment vos appareils',
    category: 'energie',
    body: 'Par heure de marche, environ : un spot LED 0,3 A, la ventilation du chauffage 1,5 A, une télé 2 A, un frigo trimixte au gaz 0,1 A. Les gros appareils branchés sur un convertisseur vont beaucoup plus loin : micro-ondes 40 à 140 A, radiateur électrique 50 à 65 A, climatisation 45 à 70 A, cafetière à capsules près de 100 A pendant qu’elle chauffe. Une glacière à compression prend 20 à 30 Ah par jour (deux fois plus en congélation), la recharge d’un vélo électrique 7 à 10 Ah. Faites le compte avant de partir sans borne.',
    storeTip: 'Le magasin vous aide à faire votre bilan d’énergie : ce que vous consommez, ce que vous produisez, ce qu’il vous faut.',
  },
  {
    title: 'Batterie : la capacité écrite n’est pas la capacité utile',
    category: 'energie',
    body: 'Sur une batterie de 100 Ah, vous n’utilisez vraiment qu’une partie : environ 50 à 60 Ah sur une batterie acide, 65 sur une AGM, 70 sur une gel, et presque tout sur une lithium. Plus vous videz une batterie au plomb, plus elle vieillit vite. C’est comme acheter un pack de 6 bouteilles et n’avoir le droit d’en boire que 4.',
    storeTip: 'Une batterie lithium s’utilise presque entièrement et dure bien plus longtemps ; l’atelier la pose toujours avec son booster de charge.',
  },
  {
    title: 'Panneau solaire : le soleil oui, la chaleur non',
    category: 'energie',
    body: 'Un panneau solaire produit avec la lumière, pas avec la chaleur. Il donne le meilleur en plein soleil vers 20 à 25 °C ; en pleine canicule, il produit moins. L’altitude n’y change rien. Gardez-le propre, sans ombre, et faites-le contrôler s’il a plusieurs années.',
    storeTip: 'Un régulateur solaire MPPT tire jusqu’à environ 30 % de courant en plus du même panneau.',
  },
  {
    title: 'Hivernage : le propane ne gèle pas, la lyre si',
    category: 'hiver',
    body: 'Inutile de sortir les bouteilles de propane pour l’hiver : il supporte le grand froid. Fermez-les et dévissez la lyre, le tuyau souple qui les relie au détendeur : son joint ne collera pas et ne s’abîmera pas au printemps. Profitez-en pour regarder la date imprimée sur la lyre.',
    storeTip: 'Une lyre neuve, à la bonne longueur pour votre coffre à gaz, se change en quelques minutes.',
  },
  {
    title: 'Suspensions : votre camping-car est toujours chargé au maximum',
    category: 'route',
    body: 'Le porteur de votre camping-car est un utilitaire, prévu pour rouler souvent à vide ou à moitié chargé. Un camping-car, lui, roule toujours au plus lourd. Avec le temps, les lames arrière s’aplatissent et touchent leurs butées : le véhicule roule bas, penche dans les virages, freine moins bien et ses pneus souffrent. Regardez de temps en temps votre essieu arrière, et faites peser le véhicule chargé.',
    storeTip: 'Butées progressives, ressorts additionnels ou coussins pneumatiques posés par l’atelier redonnent tenue de route et confort ; l’arrière en premier.',
  },
  {
    title: 'Vérins de mise à niveau : toujours par paire',
    category: 'confort',
    body: 'Les vérins mettent le camping-car à plat en deux minutes, frein à main serré. En commande manuelle, faites-les toujours sortir ou rentrer par paire, jamais un seul : le châssis se tordrait. Ils servent aussi à pencher le véhicule pour mieux vidanger, à changer une roue ou à monter les chaînes. Rentrez-les toujours avant de rouler.',
    storeTip: 'Sans vérins, des cales de nivellement à grandes marches suffisent pour dormir et cuisiner à plat.',
  },
];

const OPS = [
  // Rear lower once loaded: weigh it, then look at the leaf springs.
  { id: 'p_balan', op: 'before', at: 'Les ressorts arrière s’affaissent sous la charge.',
    t: 'Faites peser le camping-car chargé (pont-bascule) : dépasse-t-il son poids total autorisé (PTAC, sur la carte grise) ?', o: ['Oui, il est trop lourd', 'Non, ou je ne sais pas'],
    leaf: none('Le camping-car est en surcharge.', 'Allégez-le : l’eau seulement à l’arrivée, les charges lourdes près des roues. En surcharge, le freinage s’allonge et les suspensions s’usent vite.', 'Un camping-car en surcharge freine moins bien et risque l’éclatement d’un pneu.') },
  { id: 'p_balan', op: 'before', at: 'Les ressorts arrière s’affaissent sous la charge.',
    t: 'Regardez l’essieu arrière : les lames de ressort sont-elles plates, ou touchent-elles les butées en caoutchouc ?', o: YN,
    leaf: shop('Les lames arrière touchent leurs butées.', 'L’atelier pose des butées progressives, des ressorts additionnels ou des coussins pneumatiques : l’arrière d’abord, c’est là qu’est le poids.', 'Renfort de suspension arrière (pose à l’atelier)') },
  { id: 'p_balan', op: 'answer', at: 'Que constatez-vous ?', option: 'Ça cogne sur les bosses (effet « tape-cul »)',
    node: funnel(
      ['Regardez au-dessus de l’essieu arrière : les butées en caoutchouc sont-elles fendues, écrasées ou absentes ?', shop('Les butées de suspension arrière sont usées.', 'L’atelier les remplace par des butées progressives, plus douces.', 'Butées progressives (pose à l’atelier)'), YN],
      shop('La suspension arrière talonne sous la charge.', 'L’atelier mesure la hauteur de caisse et propose un renfort : ressorts additionnels ou coussins pneumatiques.', 'Renfort de suspension arrière (pose à l’atelier)')
    ) },
  { id: 'p_balan', op: 'answer', at: 'Que constatez-vous ?', option: 'L’avant plonge au freinage ou dans les virages',
    node: shop('Les amortisseurs avant sont trop faibles pour le poids de la cellule.', 'L’atelier pose des jambes de force avant (amortisseurs et ressorts renforcés, toujours par paire).', 'Jambes de force avant (pose à l’atelier)') },
  { id: 'p_balan', op: 'kw', words: 'tape-cul talonne cogne bosses butées lames plates affaissé surcharge plonge freinage' },
  // The panel gives less in a heat wave: normal.
  { id: 'h_solaire', op: 'answer', at: 'Précisez le problème', option: 'Il charge moins en pleine chaleur, l’été',
    node: funnel(
      ['Nettoyez le panneau avec un nettoyant spécial panneaux solaires. La charge remonte-t-elle ?', buy('Le panneau était encrassé.', 'Nettoyez-le à chaque lavage du toit.', 'Nettoyant spécial panneaux solaires')],
      ['Produit-il normalement le matin et en fin de journée, et moins seulement aux heures les plus chaudes ?', none('La chaleur fait baisser la production du panneau.', 'Un panneau produit le mieux en plein soleil vers 20 à 25 °C ; en canicule il produit moins, c’est normal. Rien ne doit gêner l’air sous le panneau.'), ['Oui', 'Non, il produit peu toute la journée']],
      shop('Le panneau produit moins que prévu.', 'L’atelier mesure ce que donne le panneau et contrôle le régulateur.', 'Contrôle du solaire à l’atelier', null, 'energie')
    ) },
  { id: 'h_solaire', op: 'kw', words: 'chaleur canicule été produit moins' },
];

// The lines a list does not have yet are added at its end (the owner may have edited the list).
function addLines(db) {
  const row = db.prepare("SELECT value FROM catalog WHERE key = 'lists'").get();
  if (!row) return 0;
  const lists = JSON.parse(row.value);
  const text = (it) => (typeof it === 'string' ? it : it && it.t);
  let n = 0;
  for (const [id, lines] of Object.entries(LINES)) {
    const L = lists[id];
    if (!L || !Array.isArray(L.items)) continue;
    const have = new Set(L.items.map(text));
    for (const line of lines) {
      if (have.has(text(line))) continue;
      L.items.push(line);
      n++;
    }
  }
  if (n) db.prepare("UPDATE catalog SET value = ?, updated_at = datetime('now') WHERE key = 'lists'").run(JSON.stringify(lists));
  return n;
}

// Proposed tips wait for a proofreading in the back-office (« Conseils & Astuces »).
function addTips(db) {
  const insert = db.prepare("INSERT INTO tips (title, category, body, store_tip, status, sort) VALUES (?, ?, ?, ?, 'pending', 0)");
  let n = 0;
  for (const t of TIPS) {
    if (db.prepare('SELECT 1 FROM tips WHERE title = ?').get(t.title)) continue;
    insert.run(t.title, t.category, t.body, t.storeTip);
    n++;
  }
  return n;
}

function applyFormations(db) {
  const n = addLines(db) + addTips(db) + applyChanges(db, { ops: OPS });
  applyFormations.missed = applyChanges.missed;
  return n;
}

module.exports = { applyFormations, LINES, TIPS, OPS };
