'use strict';

// Audit of the diagnostics against real-life sources (October 2026: owners' forums, makers' manuals and FAQ).
// Applied once (« 2026-11-05-audit-diagnostics »). Each change targets one precise place of a path, found by the start
// of its text; a place changed meanwhile in the back-office is no longer found and is left alone.
// - before : a new check placed before a question or an end (« Faites ceci. Est-ce réglé ? » → its own end)
// - end    : an end rewritten (one cause, a store product, or the workshop)
// - text   : a sentence replaced wherever it appears in the diagnostic
// - answer : a new answer to a question, with what follows it
// - gate   : a type question (answered by the app when it knows the type), then a check for those who have the part
// - vv, node, set, kw, custom : a known answer per type, a question reworded, a field (title, vonly), keywords,
//            and two changes too particular for the rest (see CUSTOM)
// - elim   : a cause of a « list of causes » diagnostic rewritten (nowater, antman)
// New diagnostics (NEW) are added if missing.

const { buy, shop, funnel, SOLVED } = require('./diag-helpers');

const none = (cause, geste, sec = null) => ({ cause, geste, prod: 'Aucun produit nécessaire', sec });
const YN = ['Oui', 'Non'];
const NOT_BUTANE = 'propane|rech';
const GAS_SEC = 'Odeur de gaz : fermez la bouteille, n’allumez rien, aérez et sortez.';
const ROAD_SEC = 'Garez-vous hors de la voie, feux de détresse, gilet et triangle. Sur autoroute, appelez l’assistance depuis une borne orange : ne changez pas la roue vous-même.';
const TRUMA_CODE = 'Notez le code affiché sur la commande (sur un Truma, par exemple E 517 H : arrivée de gaz coupée ; W 255 H : pas de 12 V ou liaison coupée avec la commande) et passez à l’atelier avec ce code. Pour un Truma Combi, le diagnostic du chauffage Truma explique chaque code.';
const MANUAL_DISH = buy('Votre antenne manuelle n’est plus pointée sur le satellite.', 'Suivez le diagnostic « Mon antenne manuelle ne pointe plus (plus d’image) » : il reprend le pointage pas à pas.', 'Pointeur satellite (satfinder)');

const OPS = [
  // ---------- Eau ----------
  { id: 'h_pompe', op: 'before', at: 'Voyez-vous une fuite dans le circuit (sous l’évier, autour de la pompe, au sol)'.replace('’', "'"),
    t: 'Le réservoir est-il presque vide, ou venez-vous de faire une vidange ? Remplissez-le, puis ouvrez chaque robinet (eau chaude, eau froide, douche) jusqu’à ce que l’eau coule sans bulles. La pompe s’arrête-t-elle maintenant ?',
    leaf: buy('De l’air dans le circuit empêchait la pompe de monter en pression.', 'Gardez toujours un peu d’eau dans le réservoir et purgez chaque robinet après une vidange ou un hivernage.', 'Filtre à eau en ligne pour pompe') },
  { id: 'h_pompe', op: 'text', from: 'Le moteur tourne-t-il quand on le branche directement sur une batterie ?',
    to: 'Pompe en marche au tableau, entendez-vous la pompe tourner quand vous ouvrez un robinet ?' },
  { id: 'nowater', op: 'text', from: 'dévissez l\'aérateur et rincez-le au vinaigre blanc, sinon changez la cartouche du mitigeur',
    to: 'dévissez l\'aérateur et faites-le tremper dans un détartrant pour circuit d\'eau de camping-car, ou changez-le ; si l\'eau reste faible, changez la cartouche du mitigeur' },
  { id: 'taste', op: 'text', from: ' Le vinaigre blanc aide à détartrer.', to: '' },
  { id: 'taste', op: 'before', at: 'L\'eau est-elle restée plus d\'une semaine dans le réservoir',
    t: 'Remplissez-vous le réservoir avec un tuyau d’arrosage de jardin ?', o: YN,
    leaf: buy('Le tuyau d’arrosage donne un goût de plastique à l’eau.', 'Videz et rincez le réservoir, puis remplissez avec un tuyau prévu pour l’eau potable, rangé propre et à l’abri du soleil.', 'Tuyau de remplissage spécial eau potable') },
  { id: 'nohotwater', op: 'text', from: 'détartrez au vinaigre blanc dilué à 50 %, deux fois par an environ', to: 'détartrez-le avec un détartrant spécial chauffe-eau de camping-car, deux fois par an environ' },
  { id: 'c_tank_niveau', op: 'before', at: 'Pouvez-vous accéder aux sondes du réservoir et les nettoyer avec un nettoyant détartrant',
    t: 'Versez un nettoyant détartrant spécial réservoirs d’eau propre, roulez une heure, puis videz et rincez le réservoir. L’affichage est-il redevenu juste ?',
    leaf: buy('Le calcaire sur la sonde faussait l’affichage.', 'Détartrez le réservoir une ou deux fois par saison.', 'Nettoyant détartrant spécial réservoirs d’eau propre') },
  { id: 'c_tank_niveau', op: 'before', at: 'Pouvez-vous accéder aux sondes du réservoir et les nettoyer ?',
    t: 'Versez un nettoyant détartrant spécial réservoirs d’eau propre, roulez une heure, puis videz et rincez le réservoir. L’affichage est-il redevenu juste ?',
    leaf: buy('Un dépôt bloquait la sonde de niveau.', 'Détartrez le réservoir une ou deux fois par saison.', 'Nettoyant détartrant spécial réservoirs d’eau propre') },
  { id: 'winter', op: 'end', at: 'Le circuit d\'eau doit être remis en route proprement.',
    leaf: buy('Le circuit d’eau doit être remis en route proprement.', 'Fermez d’abord la vanne de vidange du chauffe-eau (levier fermé, puis bouton enfoncé ; au-dessus d’environ 7 °C pour une vanne FrostControl) et les bouchons de vidange. Remplissez ensuite le réservoir, désinfectez le circuit, ouvrez les robinets un à un pour purger l’air, et cherchez les fuites sous l’évier.', 'Désinfectant spécial réservoirs d’eau potable') },
  // ---------- Toilettes ----------
  { id: 'h_wc', op: 'answer', at: 'Où est-ce que ça fuit ?', option: 'Par le bec verseur, quand je la porte ou la vide',
    node: buy('Le bouchon du bec verseur est mal vissé.', 'Vissez le bouchon à fond et rabattez le bec avant de porter la cassette. Pendant la vidange, appuyez sur le bouton d’aération pour éviter les éclaboussures. Un bouchon fendu ou sans joint se change.', 'Bouchon de bec verseur pour cassette') },
  // ---------- Frigo ----------
  { id: 'h_frigo', op: 'before', at: 'Le brûleur du frigo est encrassé.', geste: 'Passez à l\'atelier pour nettoyer le brûleur.',
    t: 'Allumez d’abord un feu de la plaque de cuisson pendant une minute pour chasser l’air du tuyau, puis relancez le frigo plusieurs fois de suite. La flamme prend-elle ?',
    leaf: buy('De l’air restait dans le tuyau de gaz.', 'Après chaque changement de bouteille, allumez la plaque de cuisson une minute avant de lancer le frigo.', 'Filtre à gaz pour détendeur') },
  { id: 'h_frigo', op: 'before', at: 'La grille haute extérieure est-elle bouchée (nid d\'insectes, feuilles) ? Dégagez-la. Est-ce réglé ?',
    t: 'Rallumez en gardant le bouton enfoncé 15 à 20 secondes après l’apparition de la flamme. La flamme tient-elle quand vous relâchez ?', o: ['Oui, elle tient', 'Non, elle s’éteint'],
    leaf: buy('Le bouton était relâché trop tôt.', 'Gardez le bouton enfoncé 15 à 20 secondes après l’allumage, le temps que la sécurité chauffe. Par vent fort, garez-vous dos au vent ; par temps froid, posez les caches d’hiver.', 'Caches d’hiver pour grilles de frigo') },
  // ---------- Humidité et étanchéité ----------
  { id: 'h_eau', op: 'before', at: 'Le joint de la fenêtre laisse passer l\'eau.', geste: 'Nettoyez, inspectez le joint',
    t: 'Fenêtre fermée, tous les loquets sont-ils bien verrouillés ? Dehors, dégagez les petites fentes d’évacuation du bas du cadre, puis versez un peu d’eau sur la fenêtre. L’eau ressort-elle dehors sans entrer ?',
    leaf: buy('Les fentes d’évacuation du cadre de la fenêtre étaient bouchées.', 'Dégagez-les à chaque lavage du véhicule et entretenez les joints de la fenêtre.', 'Spray silicone pour joints de fenêtre') },
  { id: 'h_eau', op: 'end', at: 'Le joint de la fenêtre laisse passer l\'eau.', geste: 'Nettoyez, inspectez le joint',
    leaf: shop('Le joint de la fenêtre laisse passer l’eau.', 'Photographiez, séchez et prenez rendez-vous : l’atelier contrôle le joint et mesure l’humidité de la paroi. Ne mettez pas de mastic vous-même.', 'Contrôle d’étanchéité de la fenêtre', null, 'etanch') },
  { id: 'humid', op: 'end', at: 'Une infiltration est possible.',
    leaf: shop('De l’eau s’infiltre dans la paroi.', 'Photographiez les traces, séchez, et prenez rendez-vous pour un test d’étanchéité : l’atelier mesure l’humidité des parois. Un absorbeur d’humidité aide en attendant.', 'Test d’étanchéité à l’atelier', null, 'etanch') },
  { id: 'humid', op: 'end', at: 'Une infiltration d\'origine inconnue est possible.',
    leaf: shop('De l’eau s’infiltre quelque part dans la cellule.', 'Photographiez les traces, séchez, et prenez rendez-vous pour un test d’étanchéité : l’atelier mesure l’humidité de toutes les parois. Un absorbeur d’humidité aide en attendant.', 'Test d’étanchéité à l’atelier', null, 'etanch') },
  { id: 'humid', op: 'end', at: 'Le joint de la fenêtre laisse passer l\'eau.', geste: 'Inspectez le joint : fissures',
    leaf: shop('Le joint de la fenêtre laisse passer l’eau.', 'Regardez le joint (fissures, décollements), photographiez et prenez rendez-vous pour un contrôle d’étanchéité. Ne mettez pas de mastic vous-même.', 'Contrôle d’étanchéité de la fenêtre', null, 'etanch') },
  { id: 'humid', op: 'end', at: 'Le joint du lanterneau laisse passer l\'eau.', geste: 'Inspectez le joint et le cadre',
    leaf: shop('Le joint du lanterneau laisse passer l’eau.', 'Regardez le joint et le cadre sous une bonne lumière, photographiez et prenez rendez-vous pour un contrôle d’étanchéité.', 'Contrôle d’étanchéité du lanterneau', null, 'etanch') },

  // ---------- Gaz et chauffage ----------
  // Codes that do not exist on Truma controls (E001, W401…) replaced by real ones (Truma FAQ: E 517 H, W 255 H).
  { id: 'heater', op: 'text', from: 'Notez le code (exemples Truma, à confirmer dans la notice : E001 échec d\'allumage, E005 tension hors plage, E011 surchauffe du chauffe-eau, E041 pression de gaz insuffisante, W401 sécurité thermique) et passez à l\'atelier.', to: TRUMA_CODE },
  { id: 'heater', op: 'text', from: 'Notez le code (E001 échec d\'allumage, E005 tension hors plage, E011 surchauffe, E041 pression de gaz, W401 sécurité thermique : à confirmer dans la notice) et passez à l\'atelier.', to: TRUMA_CODE },
  { id: 'nohotwater', op: 'text', from: 'Notez le code (exemples Truma : E001 échec d\'allumage, E005 tension hors plage, E011 surchauffe du chauffe-eau, E041 pression de gaz insuffisante, W401 sécurité thermique) et passez à l\'atelier.', to: TRUMA_CODE },
  { id: 'g_truma', op: 'text', from: 'Ne s\'allume pas : le voyant jaune clignote ou la LED rouge s\'allume (pas de flamme)', to: 'Ne s\'allume pas : le voyant jaune clignote, la LED rouge s\'allume ou un code gaz s\'affiche (507, 516, 517…)' },
  { id: 'g_truma', op: 'kw', words: '507 516 517 e517h e 517 h gaz interrompu code erreur w255h' },
  // The butane question is answered by the gas type only when it is cold: a butane owner in summer is asked.
  { id: 'heater', op: 'vv', at: 'Utilisez-vous du butane par temps froid', vv: ['', NOT_BUTANE] },
  { id: 'heater', op: 'end', at: 'Le butane ne se vaporise plus par grand froid.',
    leaf: buy('Le butane ne se vaporise plus par grand froid.', 'En hiver, passez au propane : il fonctionne jusqu’à -40 °C.', 'Bouteille de propane', GAS_SEC) },
  { id: 'heater', op: 'end', at: 'La bouteille en service était vide.',
    leaf: buy('La bouteille en service était vide.', 'Remplacez la bouteille vide. Une jauge vous évite d’être surpris.', 'Jauge de niveau de gaz pour bouteille') },
  { id: 'nogas', op: 'end', at: 'La bouteille en service était vide.',
    leaf: buy('La bouteille en service était vide.', 'Remplacez la bouteille vide. Une jauge vous évite d’être surpris.', 'Jauge de niveau de gaz pour bouteille') },
  { id: 'nogas', op: 'before', at: 'Rien n\'a suffi : le détendeur est mal monté.',
    t: 'Robinet fermé, débranchez la lyre de la bouteille puis rebranchez-la, et rouvrez le robinet tout doucement. Le gaz revient-il ?',
    leaf: buy('La sécurité anti-rupture de la lyre s’était fermée.', 'Une ouverture trop brusque du robinet ferme cette sécurité : ouvrez toujours doucement. Vérifiez ensuite les raccords avec une bombe détectrice de fuites, jamais avec une flamme.', 'Lyre gaz avec sécurité anti-rupture', GAS_SEC) },
  // Regulators with a crash sensor (Duocontrol CS, Monocontrol CS): asked only if the app does not know the type.
  { id: 'nogas', op: 'gate', at: 'Le flexible est-il écrasé ou plié ? Rectifiez. Le gaz revient-il ?',
    t: 'Votre détendeur a-t-il un bouton jaune de réarmement (capteur de choc : Duocontrol CS, Monocontrol CS) ?', o: ['Oui', 'Non, ou je ne sais pas'], vk: 'detendeur', vv: ['v3|v4', 'v1|v2'],
    check: 'Fermez les bouteilles, appuyez sur le bouton jaune en le tournant un peu dans le sens des aiguilles d’une montre et tenez-le 10 secondes, puis rouvrez doucement. Le gaz revient-il ?',
    leaf: buy('Le capteur de choc du détendeur avait coupé le gaz.', 'C’est sa sécurité après un choc (trou, trottoir, freinage brusque). Vérifiez ensuite les raccords avec une bombe détectrice de fuites. Si le bouton ne tient pas, voyez « Plus de gaz avec mon détendeur Duocontrol ou Monocontrol ».', 'Bombe détectrice de fuites de gaz', GAS_SEC) },
  { id: 'heater', op: 'before', at: 'Entendez-vous un bruit de gargouillis dans les radiateurs ?',
    t: 'Chauffage froid, le liquide est-il sous le repère « MIN » du vase d’expansion ?', o: ['Oui, il est sous le MIN', 'Non, le niveau est bon'],
    leaf: buy('Le liquide de chauffage est trop bas.', 'Complétez avec le liquide préconisé par Alde (mélange au glycol), jamais avec de l’eau seule. S’il baisse souvent, une fuite existe : atelier.', 'Liquide de chauffage au glycol préconisé par Alde') },
  { id: 'heater', op: 'answer', at: 'Comment ça s\'est passé ?', option: 'En montagne, ou par grand froid',
    node: funnel(
      ['Êtes-vous au-dessus de 1 500 m environ ? Si votre commande a un mode altitude, activez-le. Le chauffage tient-il ?', none('L’air est trop pauvre en altitude.', 'Activez le mode altitude en montagne, et coupez-le en redescendant.')],
      ['Fait-il moins de -10 °C, avec du gazole d’été dans le réservoir ?', buy('Le gazole a figé avec le froid.', 'Par grand froid, ajoutez un antifigeant au gazole, ou faites le plein en station de montagne.', 'Additif antifigeant pour gazole'), YN],
      shop('Le chauffage n’est pas réglé pour l’altitude.', 'L’atelier règle la pompe à gazole, nettoie la chambre de combustion et pose si besoin un kit altitude.', 'Réglage du chauffage diesel à l’atelier')
    ) },
  // ---------- Électricité et batteries ----------
  { id: 'h_lith', op: 'before', at: 'Comment votre batterie lithium est-elle reliée à la batterie moteur ?',
    t: 'Fait-il moins de 0 °C là où se trouve la batterie (nuit de gel, véhicule non chauffé) ? Chauffez la cellule une heure puis réessayez de charger. La charge démarre-t-elle ?',
    leaf: none('La batterie lithium était trop froide pour charger.', 'C’est normal : sous 0 °C, sa protection bloque la charge pour ne pas l’abîmer, et la charge reprend dès qu’elle se réchauffe. Pour voyager souvent en hiver, une batterie lithium avec chauffage intégré se réchauffe toute seule.') },
  { id: 'h_lith', op: 'end', at: 'Un régulateur PWM est mal adapté à la batterie lithium.',
    leaf: buy('Le régulateur solaire n’a pas de réglage pour la lithium.', 'Vérifiez dans sa notice s’il propose un profil lithium et choisissez-le. Sinon, un régulateur MPPT réglable « lithium » charge mieux : le magasin vous conseille le modèle, l’atelier le pose.', 'Régulateur solaire MPPT compatible lithium') },
  { id: 'nocharge', op: 'before', at: 'La batterie a-t-elle plus de 5 ans ou a-t-elle souvent été déchargée à fond ?',
    t: 'Le type de batterie réglé sur le chargeur (sélecteur ou menu du tableau) correspond-il à l’étiquette de la batterie (AGM, gel ou lithium) ?', o: ['Non, il est différent', 'Oui, il correspond'],
    leaf: buy('Le chargeur n’est pas réglé sur le bon type de batterie.', 'Réglez le type indiqué sur la batterie en suivant la notice du chargeur, puis refaites une charge complète. Un moniteur de batterie montre ensuite si elle se remplit.', 'Moniteur de batterie') },
  { id: 'nocharge', op: 'node', at: 'La batterie moteur démarre-t-elle bien ?',
    t: 'Moteur tournant, le voyant de batterie du tableau de bord reste-t-il allumé ?', o: ['Oui, il reste allumé', 'Non, il s’éteint'] },
  { id: 'nocharge', op: 'end', at: 'L\'alternateur ne charge plus.',
    leaf: shop('L’alternateur ne charge plus.', 'Le voyant de batterie allumé moteur tournant est une alerte : faites contrôler l’alternateur et sa courroie avant de repartir loin.', 'Contrôle de la charge à l’atelier') },
  // An AGM / gel diagnostic (ages of a lithium battery differ; lithium has its own).
  { id: 'batdrain', op: 'set', field: 'vonly', value: ['g_batterie', ['agm', 'gel']] },

  // ---------- Extérieur, porteur et accessoires ----------
  { id: 'step', op: 'answer', at: 'Que se passe-t-il ?', option: 'Il reste sorti quand je démarre (bip ou voyant)',
    node: funnel(
      ['Moteur tournant, appuyez sur l’interrupteur pour rentrer le marchepied. Rentre-t-il ?', buy('La rentrée automatique au démarrage ne reçoit plus le signal du moteur.', 'Rentrez le marchepied à l’interrupteur avant chaque départ. Faites contrôler le branchement de la rentrée automatique à la prochaine visite.', 'Spray pour contacts électriques')],
      shop('La commande du marchepied est en défaut.', 'Ne roulez pas marchepied sorti : rentrez-le à la main si la notice le prévoit, puis passez à l’atelier.', 'Contrôle du marchepied à l’atelier')
    ) },
  { id: 'start', op: 'answer', at: 'Que constatez-vous quand vous tournez la clé', option: 'Le tableau s’allume mais le démarreur ne fait aucun bruit',
    node: funnel(
      ['Boîte automatique : le levier est-il bien sur P (ou N) ? Mettez-le et réessayez. Le moteur démarre-t-il ?', none('Le levier de vitesses n’était pas sur P.', 'Le démarreur ne tourne que levier sur P ou N.')],
      ['Un voyant de clé ou de cadenas s’allume-t-il ? Essayez le double de la clé. Le moteur démarre-t-il ?', buy('L’antidémarrage ne reconnaît plus la première clé.', 'Démarrez avec le double et rangez-le à part. Faites contrôler et reprogrammer la clé à l’atelier.', 'Coque de clé de rechange')],
      shop('Le démarreur est en défaut.', 'Appelez l’assistance : l’atelier contrôle l’antidémarrage et le démarreur.', 'Assistance et contrôle du démarrage')
    ) },
  { id: 'e_man_skew', op: 'end', at: 'En France la tête LNB se règle à 0°.',
    leaf: buy('L’inclinaison de la tête LNB dépend du lieu et du satellite.', 'Si l’image est bonne, ne touchez à rien. Sinon, lisez l’angle de votre région dans le tableau de la notice (ce n’est pas 0° en France), desserrez un peu l’étrier, tournez la tête doucement en regardant la barre de qualité, puis resserrez.', 'Pointeur satellite (satfinder)') },
  { id: 'e_man_skew', op: 'text', from: '(en France la référence est 0°)', to: '(selon le tableau de la notice)' },
  { id: 'h_sat', op: 'text', from: '(en France la référence est 0°)', to: '(selon le tableau de la notice)' },
  { id: 'f_pneus_gonfle', op: 'set', field: 'label', from: 'Où gonfler mes pneus de camping-car à 6 bars ?', value: 'Où gonfler mes pneus de camping-car (jusqu’à 5,5 bars) ?' },
  { id: 'f_pneus_gonfle', op: 'text', from: 'gonfler pneus 6 bars', to: 'gonfler pneus 5 bars 5,5 bars 6 bars' },
  { id: 'f_pneus_gonfle', op: 'end', at: 'Les pneus de camping-car se gonflent jusqu\'à 6 bars.',
    leaf: buy('Les pneus de camping-car demandent une forte pression.', 'Souvent 5 à 5,5 bars, une pression que tous les gonfleurs n’atteignent pas. Gonflez à froid, à la valeur de l’étiquette (montant de porte), sans dépasser la pression écrite sur le flanc du pneu.', 'Manomètre de gonflage') },
  { id: 'h_tv', op: 'before', at: 'Rien n\'a suffi : l\'amplificateur d\'antenne est défaillant.',
    t: 'Les chaînes manquent-elles surtout près d’une ville ou d’un relais de téléphone, et reviennent-elles plus loin ?', o: YN,
    leaf: buy('Les antennes de téléphone 4G et 5G brouillent la réception TNT.', 'Un filtre 4G/5G se pose sur le câble, entre l’antenne et l’amplificateur ; il ne convient pas à toutes les antennes à amplificateur intégré : demandez conseil au magasin. Relancez ensuite une recherche des chaînes.', 'Filtre 4G/5G pour antenne TNT') },
  { id: 'h_tv', op: 'custom', fn: 'tvDontKnow' },
  { id: 'tyres', op: 'before', at: 'L\'alerte concerne-t-elle toujours la même roue ?',
    t: 'Pression bonne à froid, réinitialisez la surveillance des pneus (menu du tableau de bord ou bouton, selon la notice), puis roulez 20 minutes. L’alerte est-elle partie ?',
    leaf: buy('La surveillance n’avait pas enregistré la nouvelle pression.', 'Réinitialisez-la après chaque regonflage, toujours à froid et à la pression de l’étiquette.', 'Manomètre de gonflage') },
  { id: 'tyres', op: 'end', at: 'Le système de contrôle de pression a besoin d\'être réinitialisé.',
    leaf: shop('Le boîtier de surveillance des pneus est en défaut.', 'La réinitialisation n’a pas suffi : l’atelier contrôle le boîtier et les capteurs.', 'Contrôle de la surveillance des pneus à l’atelier') },
  { id: 'p_crevaison', op: 'before', at: 'Le cric soulève-t-il le véhicule bien droit et stable ?',
    t: 'Véhicule encore au sol, gilet mis et triangle posé : les écrous se desserrent-ils d’un quart de tour avec la clé de roue ?', o: ['Non, ils sont bloqués', 'Oui, ils se desserrent'],
    leaf: buy('Les écrous de roue sont bloqués.', 'Ne forcez pas en sautant sur la clé : appelez l’assistance. Gardez à bord une clé à long bras pour la prochaine fois.', 'Clé de roue à long bras', ROAD_SEC) },
  { id: 'p_crevaison', op: 'end', at: 'La roue ne se démonte pas.',
    leaf: buy('La roue crevée se change par la roue de secours.', 'Calez le véhicule, levez-le juste assez, changez la roue et serrez en croix. Faites contrôler le serrage après 50 km et réparer le pneu crevé.', 'Cales de roue', ROAD_SEC) },
  { id: 'h_store', op: 'before', at: 'Les fins de course sont mal réglées.',
    t: 'Une branche, la toile ou un bras gêne-t-il le store, ou la batterie cellule est-elle faible au panneau ? Dégagez ou rechargez, puis réessayez. Le store va-t-il jusqu’au bout ?',
    leaf: buy('La batterie cellule était trop faible pour le moteur du store.', 'Rechargez la batterie avant de manœuvrer le store. S’il reste sorti, rentrez-le à la manivelle de secours si la notice en prévoit une, puis passez à l’atelier.', 'Moniteur de batterie') },
  { id: 'p_feuxvelo', op: 'custom', fn: 'bikeLightsFirst' },
];

// « List of causes » diagnostics: one cause per end; FRANSAT is on another satellite than TNTSAT.
const ELIM = {
  nowater: {
    coupe: { cause: 'Le 12 V de la cellule est coupé.' },
    vide: { cause: 'Le réservoir d’eau propre ne donne plus d’eau.', geste: 'Coupez la pompe, remplissez le réservoir et vérifiez que sa vanne est ouverte, puis ouvrez les robinets un à un pour purger l’air avant de relancer la pompe. La pompe qui tourne à vide s’abîme.' },
    robinet: { cause: 'Le robinet de ce point d’eau est entartré.' },
    tuyau: { cause: 'L’arrivée d’eau de ce point d’eau est pincée.' },
    crepine: { cause: 'La crépine de la pompe est bouchée.' },
    fuite: { cause: 'Une prise d’air empêche la pompe de monter en pression.' },
    fusible: { p: 2 },
    clapet: { cause: 'Le pressostat de la pompe ne tient plus la pression.' },
    pompe: { cause: 'La pompe est hors service.' },
  },
  antman: {
    recept: { cause: 'Le téléviseur n’est pas réglé sur l’antenne.' },
    meteo: { cause: 'Le mauvais temps coupe le signal du satellite.' },
    obst: { cause: 'Un obstacle masque la vue du satellite.' },
    mat: { cause: 'Le mât n’est pas bien déployé.' },
    pos: { cause: 'La parabole est décalée du satellite.', test: 'Vérifiez que le récepteur cherche le satellite de votre carte (Astra 19,2° Est pour TNTSAT, Eutelsat 5° Ouest pour FRANSAT). Reprenez le pointage très lentement avec un pointeur de satellite.' },
    bouge: { cause: 'Le support de la parabole a bougé.' },
    cable: { cause: 'Le câble de l’antenne est abîmé.' },
    couv: { cause: 'Vous êtes trop loin de l’émetteur TNT.' },
  },
};

const NEW = [
  {
    id: 'p_doucheevac',
    cat: 'eau',
    label: 'Ma douche se vide mal : l’eau stagne dans le bac',
    eq: 'douche',
    kw: 'douche se vide mal stagne bac eau reste bonde lente évacuation cheveux deux bondes penche',
    tree: funnel(
      ['Videz le réservoir d’eaux grises. La douche se vide-t-elle ?', buy('Le réservoir d’eaux grises était plein.', 'Videz-le plus souvent : avec la douche, il se remplit vite.', 'Jauge de niveau pour eaux grises')],
      ['Mettez le véhicule bien de niveau (niveau à bulle posé dans le bac). L’eau s’évacue-t-elle ?', buy('Le véhicule penchait du côté opposé à la bonde.', 'Dans un bac à deux bondes, le tuyau qui les relie est presque à plat : calez le véhicule de niveau avant la douche.', 'Cales de nivellement')],
      ['Retirez la grille de la bonde et les cheveux du siphon. L’eau s’évacue-t-elle ?', buy('Des cheveux bouchaient la bonde.', 'Nettoyez la bonde chaque semaine et posez un filtre attrape-cheveux.', 'Filtre attrape-cheveux pour bonde de douche')],
      shop('Le tuyau d’évacuation de la douche est obstrué.', 'L’atelier débouche le tuyau entre la bonde et le réservoir et contrôle sa pente.', 'Débouchage de l’évacuation à l’atelier')
    ),
  },
  {
    id: 'p_chassecoule',
    cat: 'wc',
    label: 'De l’eau coule sans arrêt dans la cuvette de mes toilettes',
    eq: 'wc',
    kw: 'eau coule sans arrêt cuvette toilettes chasse continue ne s arrête pas vanne de chasse thetford dometic wc',
    tree: funnel(
      ['Le bouton de chasse reste-t-il enfoncé ? Libérez-le. L’eau s’arrête-t-elle ?', buy('Le bouton de chasse restait enfoncé.', 'Gardez le bouton propre et sec, sans dépôt de calcaire.', 'Nettoyant pour toilettes de camping-car')],
      ['Coupez la pompe à eau, rallumez-la, puis tirez la chasse une fois. L’eau s’arrête-t-elle après la chasse ?', buy('La vanne de chasse restait collée par le calcaire.', 'Un additif anticalcaire dans l’eau de chasse évite qu’elle colle à nouveau.', 'Additif anticalcaire pour eau de chasse')],
      shop('La vanne électrique de chasse est défectueuse.', 'Coupez la pompe à eau entre deux usages en attendant. L’atelier change la vanne et contrôle le tuyau du jet.', 'Remplacement de la vanne de chasse à l’atelier')
    ),
  },
  {
    id: 'p_feux',
    cat: 'ext',
    label: 'Un feu ou un clignotant de mon véhicule ne marche plus (phare, feu stop, clignotant qui bat trop vite)',
    kw: 'feu phare feu stop clignotant bat trop vite ampoule grillée feu arrière veilleuse ne marche plus éclairage véhicule',
    tree: funnel(
      ['Faites le tour du véhicule feux allumés (quelqu’un appuie sur le frein). Un seul feu est-il éteint ?', buy('L’ampoule de ce feu est grillée.', 'Changez-la par une ampoule identique (apportez l’ancienne au magasin). Un clignotant qui bat trop vite signale une ampoule grillée du même côté. Gardez un coffret d’ampoules à bord.', 'Coffret d’ampoules de rechange'), YN],
      ['Les deux feux du même type sont-ils éteints (les deux stops, ou les deux phares) ? Regardez le fusible de ces feux dans la boîte à fusibles de la cabine. Est-il grillé ?', buy('Le fusible de ces feux a grillé.', 'Remplacez-le par un fusible de même calibre. S’il grille de nouveau, passez à l’atelier.', 'Fusibles auto assortis'), YN],
      ['Ampoule retirée, le culot est-il vert, oxydé ou humide ? Nettoyez-le au spray pour contacts et remontez. Le feu s’allume-t-il ?', buy('Le culot de l’ampoule faisait mauvais contact.', 'Protégez le culot avec un spray pour contacts.', 'Spray pour contacts électriques')],
      shop('Le câblage des feux est en défaut.', 'Ne roulez pas de nuit avec un feu éteint : l’atelier contrôle le faisceau et les masses.', 'Contrôle de l’éclairage à l’atelier')
    ),
  },
  {
    id: 'p_autoradio',
    cat: 'elec',
    label: 'Mon autoradio ou mon écran de cabine ne s’allume plus ou perd ses réglages à chaque démarrage',
    eq: 'radio',
    kw: 'autoradio radio écran cabine ne s allume plus perd réglages stations heure coupe-batterie fusible',
    tree: funnel(
      ['Le coupe-batterie (ou l’interrupteur général 12 V de la cellule) est-il enclenché ? Enclenchez-le. L’autoradio s’allume-t-il ?', none('Le coupe-batterie coupait l’autoradio.', 'Laissez-le enclenché pendant l’utilisation. Sur ce branchement, les réglages se perdent à chaque coupure : c’est normal.')],
      ['Contact mis, l’autoradio s’allume-t-il, et s’éteint-il seulement moteur coupé ou batterie faible ?', buy('La batterie qui alimente l’autoradio est trop faible.', 'Rechargez cette batterie. Un chargeur de maintien l’entretient pendant les arrêts.', 'Chargeur de maintien de batterie'), YN],
      ['Le fusible de l’autoradio (boîte à fusibles de la cabine) est-il grillé ?', buy('Le fusible de l’autoradio a grillé.', 'Remplacez-le par un fusible de même calibre. S’il grille de nouveau, passez à l’atelier.', 'Fusibles auto assortis'), YN],
      shop('L’alimentation permanente de l’autoradio est mal branchée.', 'L’atelier contrôle le fil permanent et le fil après contact de l’autoradio.', 'Contrôle du branchement de l’autoradio')
    ),
  },
  {
    id: 'p_flaque',
    cat: 'ext',
    label: 'Il y a une tache ou une flaque sous l’avant de mon camping-car',
    kw: 'flaque tache sous le véhicule sous le moteur avant liquide fuite huile liquide de refroidissement eau clim gouttes porteur',
    tree: funnel(
      ['Le liquide est-il clair comme de l’eau, sans odeur, et apparaît-il après avoir roulé avec la climatisation de la cabine ?', none('C’est l’eau de la climatisation de la cabine : c’est normal.', 'Rien à faire : l’eau de condensation s’écoule sous l’avant.'), YN],
      ['Moteur froid, capot ouvert : le bocal de liquide de refroidissement est-il sous le repère mini (liquide coloré sous le véhicule) ?', shop('Le circuit de refroidissement perd du liquide.', 'Complétez moteur froid avec le liquide prévu au carnet, surveillez le niveau chaque jour et prenez rendez-vous.', 'Contrôle du circuit de refroidissement à l’atelier'), YN],
      ['Le niveau d’huile est-il bas à la jauge (tache brune ou noire et grasse sous le moteur) ?', shop('Le moteur perd de l’huile.', 'Complétez avec l’huile du carnet et prenez rendez-vous.', 'Recherche de fuite d’huile à l’atelier'), YN],
      shop('Une fuite vient du porteur.', 'Ne démarrez pas si ça sent le gazole ou si la pédale de frein est molle : appelez l’assistance. Sinon, prenez rendez-vous pour une recherche de fuite.', 'Recherche de fuite à l’atelier', 'Odeur de gazole ou pédale de frein molle : ne roulez pas.')
    ),
  },
];

// ---------- engine ----------
const startsWith = (s, at) => String(s || '').startsWith(at);
const matches = (n, op) => (n.cause ? startsWith(n.cause, op.at) && (!op.geste || startsWith(n.geste, op.geste)) : !op.geste && startsWith(n.t, op.at));

const copy = (x) => JSON.parse(JSON.stringify(x));

// Changes too particular for the generic ops.
const CUSTOM = {
  // « Je ne sais pas » about the TV equipment no longer ends without help: what is on the roof, seen at a glance.
  tvDontKnow(tree) {
    let hits = 0;
    const visit = (n) => {
      if (!n || n.cause) return;
      if (n.t === 'Quel est votre équipement ?' && n.o.length === 3 && /sais pas/.test(n.o[2]) && n.n[2].cause) {
        n.n[2] = {
          t: 'Sur le toit, que voyez-vous ?',
          o: ['Une parabole qui se déplie toute seule (boîtier de commande)', 'Une parabole sur un mât que je tourne à la main', 'Une petite antenne en soucoupe ou en râteau'],
          n: [copy(n.n[0]), copy(MANUAL_DISH), copy(n.n[1])],
        };
        n.o.splice(2, 0, 'Une parabole manuelle (je la tourne à la main)');
        n.n.splice(2, 0, copy(MANUAL_DISH));
        hits++;
        return;
      }
      n.n.forEach(visit);
    };
    visit(tree);
    return { tree, hits };
  },
  // Bike rack / trailer lights: « one light only » (a bulb) is seen at a glance, so it comes first.
  bikeLightsFirst(tree) {
    let one = null;
    const visit = (n) => {
      if (!n || n.cause) return n;
      if (startsWith(n.t, 'Une seule lumière ne marche pas') && n.n.length === 2) {
        one = n;
        return n.n[1];
      }
      n.n = n.n.map(visit);
      return n;
    };
    const rest = visit(copy(tree));
    if (!one) return { tree, hits: 0 };
    return { tree: { t: one.t, o: one.o, n: [one.n[0], rest] }, hits: 1 };
  },
};

// Applies one op to a tree; returns the new tree and how many places changed.
function applyOp(tree, op) {
  let hits = 0;
  if (op.op === 'custom') return CUSTOM[op.fn](tree);
  const visit = (n) => {
    if (!n) return n;
    if ((op.op === 'before' || op.op === 'end' || op.op === 'gate') && matches(n, op)) {
      hits++;
      if (op.op === 'end') return copy(op.leaf);
      if (op.op === 'gate') {
        // A type question (answered by the app when it knows), then the check for those who have the part.
        return { t: op.t, o: op.o, vk: op.vk, vv: op.vv, n: [{ t: op.check, o: SOLVED, n: [copy(op.leaf), copy(n)] }, n] };
      }
      return { t: op.t, o: op.o || SOLVED, n: [copy(op.leaf), n] };
    }
    if (n.cause) return n;
    if (op.op === 'answer' && !hits && startsWith(n.t, op.at) && !n.o.includes(op.option)) {
      hits++;
      const last = n.o.length - 1;
      const at = /sais pas|autre/i.test(n.o[last]) ? last : n.o.length;
      n.o.splice(at, 0, op.option);
      n.n.splice(at, 0, copy(op.node));
    }
    if ((op.op === 'vv' || op.op === 'node') && startsWith(n.t, op.at)) {
      hits++;
      if (op.op === 'vv') n.vv = op.vv;
      if (op.t) n.t = op.t;
      if (op.o) n.o = op.o;
    }
    n.n = n.n.map(visit);
    return n;
  };
  if (op.op === 'text') {
    const s = JSON.stringify(tree);
    const from = JSON.stringify(op.from).slice(1, -1);
    if (!s.includes(from)) return { tree, hits: 0 };
    return { tree: JSON.parse(s.split(from).join(JSON.stringify(op.to).slice(1, -1))), hits: 1 };
  }
  return { tree: visit(tree), hits };
}

// Applies a set of changes (ops on paths, causes of « list » diagnostics, new diagnostics); also used by later batches.
function applyChanges(db, { ops = [], elim = {}, news = [] }) {
  let changed = 0;
  const missed = [];
  const load = (id) => {
    const r = db.prepare('SELECT data FROM diagnostics WHERE id = ?').get(id);
    return r ? JSON.parse(r.data) : null;
  };
  const save = (d) => db.prepare("UPDATE diagnostics SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(d), d.id);
  for (const op of ops) {
    const d = load(op.id);
    if (!d) { missed.push(`${op.id} (absent)`); continue; }
    if (op.op === 'text') {
      // The whole diagnostic: the « list of causes » ones keep their texts outside the tree.
      const { tree, hits } = applyOp(d, op);
      if (!hits) { missed.push(`${op.id} : ${op.from.slice(0, 50)}`); continue; }
      save(tree);
    } else if (op.op === 'kw') {
      if (String(d.kw || '').includes(op.words)) continue;
      d.kw = `${d.kw || ''} ${op.words}`.trim();
      save(d);
    } else if (op.op === 'set') {
      if (op.from !== undefined && d[op.field] !== op.from) { missed.push(`${op.id} : ${op.field}`); continue; }
      if (op.from === undefined && d[op.field]) { missed.push(`${op.id} : ${op.field} déjà réglé`); continue; }
      d[op.field] = op.value;
      save(d);
    } else {
      const { tree, hits } = applyOp(d.tree, op);
      if (!hits) { missed.push(`${op.id} : ${(op.at || op.fn).slice(0, 50)}`); continue; }
      d.tree = tree;
      save(d);
    }
    changed++;
  }
  for (const [id, causes] of Object.entries(elim)) {
    const d = load(id);
    if (!d || !d.elim) continue;
    for (const c of d.elim.causes || []) {
      const fix = causes[c.k];
      if (!fix) continue;
      if (fix.cause) c.r.cause = fix.cause;
      if (fix.geste) c.r.geste = fix.geste;
      if (fix.test) c.test = fix.test;
      if (fix.p) c.p = fix.p;
      changed++;
    }
    save(d);
  }
  let sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM diagnostics').get().n;
  for (const d of news) {
    if (load(d.id)) continue;
    db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(d.id, ++sort, JSON.stringify(d));
    changed++;
  }
  applyChanges.missed = missed;
  return changed;
}

function applyAudit(db) {
  const n = applyChanges(db, { ops: OPS, elim: ELIM, news: NEW });
  applyAudit.missed = applyChanges.missed;
  return n;
}

module.exports = { applyAudit, applyChanges, OPS, ELIM, NEW };
