'use strict';

// Manual satellite dish (October 2026, asked by the store): pointer that will not calibrate or locks on the wrong
// satellite, mast and folding, cable and LNB, receiver that lost its channels or its card. From the sellers' and
// makers' instructions (Teleco, Megasat, Maxview, Satlink, Alden, TNTSAT) and owners' forums, written as funnels.

const { buy, shop, funnel, ask } = require('./diag-helpers');

const POINTER = 'Pointeur satellite numérique qui identifie le satellite';
const LNB_SHOP = shop('La tête LNB ne transmet plus le signal.',
  'Démodulateur allumé, pointeur bien branché et réglé, rien ne réagit : l’atelier mesure la tension sur le câble et teste la tête LNB.',
  'Contrôle de la tête LNB et du câble à l’atelier');
const FOLD_SEC = 'Ne roulez jamais antenne dépliée : elle peut arracher le toit.';
const SAT = 'Astra 19,2° Est pour TNTSAT, Eutelsat 5° Ouest pour Fransat';

const CLIENTS_2026_10_C = [
  {
    id: 'p_pointeur',
    cat: 'ext',
    label: 'Mon pointeur satellite ne calibre pas ou ne cale pas sur le satellite (antenne manuelle)',
    eq: 'satman',
    kw: 'pointeur satfinder sat finder calibrer calibre étalonner boîtier pointage cale pas trouve pas satellite aiguille bip antenne manuelle parabole mauvais satellite astra hot bird fransat tntsat application boussole',
    tree: ask('Que se passe-t-il ?', [
      ['Le pointeur ne réagit pas ou ne veut pas calibrer', ask('Quel pointeur utilisez-vous ?', [
        ['Un boîtier à aiguille, avec un bouton de réglage', funnel(
          ['Le pointeur prend son courant par le câble du démodulateur : allumez le démodulateur (pas en veille). L’aiguille bouge-t-elle ?', buy('Le démodulateur en veille ne donnait pas de courant au pointeur.',
            'Allumez toujours le démodulateur avant de pointer : c’est lui qui alimente la tête LNB et le pointeur.', 'Aucun produit nécessaire'), ['Oui, elle bouge', 'Non']],
          ['Le pointeur est-il branché dans le bon sens (prise « LNB » vers l’antenne, prise « récepteur » vers le démodulateur), fiches vissées ? Corrigez. L’aiguille bouge-t-elle ?', buy('Le pointeur était branché à l’envers.',
            'Prise « LNB » côté antenne, prise « récepteur » côté démodulateur, fiches vissées à la main. Un cordon coaxial court facilite le branchement.', 'Cordon coaxial court avec fiches F'), ['Oui, elle bouge', 'Non']],
          ['Tournez le bouton de sensibilité pour mettre l’aiguille au milieu, puis balayez lentement autour du sud. L’aiguille monte-t-elle à un endroit ?', buy('La sensibilité du pointeur n’était pas réglée.',
            'Mettez l’aiguille au milieu avant de chercher, et baissez la sensibilité dès qu’elle part en butée : le satellite est là où elle monte le plus. Vérifiez ensuite les chaînes.', 'Boussole et carte des satellites'), ['Oui, elle monte', 'Non']],
          LNB_SHOP
        )],
        ['Un boîtier numérique, avec écran ou voyants', funnel(
          ['Le pointeur est-il chargé (ou branché sur le 12 V) et allumé ?', buy('La batterie du pointeur était vide.',
            'Rechargez-le avant de partir. Certains modèles se branchent sur une prise 12 V : un cordon allume-cigare évite la panne.', 'Cordon 12 V pour pointeur satellite'), ['Non, il était vide ou éteint', 'Oui']],
          [`Le bon satellite est-il choisi dans le menu du pointeur (${SAT}) ?`, buy('Le pointeur cherchait un autre satellite.',
            'Choisissez le satellite de votre carte dans le menu avant de pointer.', 'Aucun produit nécessaire'), ['Non, il était sur un autre', 'Oui']],
          ['Réglez l’inclinaison de la parabole d’après la carte d’élévation (notice ou application), puis tournez très lentement autour du sud. Le pointeur bipe-t-il ?', buy('L’inclinaison de la parabole n’était pas bonne.',
            'Le satellite ne se trouve qu’à la bonne inclinaison : réglez-la d’abord, puis tournez lentement. Notez les réglages qui marchent dans chaque région.', 'Boussole et carte des satellites'), ['Oui, il bipe', 'Non']],
          ['La liste des satellites du pointeur est-elle ancienne (jamais mise à jour) ?', buy('La liste des satellites du pointeur est périmée.',
            'Les chaînes changent de fréquence : un pointeur jamais mis à jour ne reconnaît plus le satellite. Mettez-le à jour (voir la notice, souvent par USB), ou passez à un pointeur récent.', 'Pointeur satellite numérique à liste modifiable'), ['Oui, ou je ne sais pas', 'Non, elle est à jour']],
          LNB_SHOP
        )],
        ['Une application sur mon téléphone', funnel(
          ['À quelques mètres du véhicule, loin de la carrosserie, calibrez la boussole du téléphone (faites des « 8 » avec lui). La direction affichée est-elle stable ?', buy('La boussole du téléphone n’était pas calibrée.',
            'Calibrez-la à chaque fois, loin du métal : la carrosserie fausse la boussole. Une boussole classique confirme la direction du sud.', 'Boussole de camping'), ['Oui, elle est stable', 'Non, elle bouge encore']],
          ['La localisation du téléphone est-elle activée pour l’application ?', buy('L’application ne connaissait pas votre position.',
            'Activez la localisation : l’application calcule la direction et l’inclinaison d’après l’endroit où vous êtes.', 'Aucun produit nécessaire'), ['Non, elle était coupée', 'Oui']],
          buy('L’application ne donne qu’une direction approximative.',
            'Elle montre où viser, pas le signal. Pour caler finement, il faut un pointeur qui mesure le signal, branché sur le câble.', POINTER)
        )],
        ['Le bip du démodulateur', funnel(
          ['Avez-vous activé le bip (souvent la touche « Mute ») et monté le volume de la télé ?', buy('Le bip du démodulateur n’était pas activé.',
            'Activez le bip comme indiqué dans la notice, puis balayez lentement autour du sud.', 'Aucun produit nécessaire'), ['Non', 'Oui']],
          buy('Le bip seul ne suffit pas à caler finement.',
            'Voyez le diagnostic « Mon antenne manuelle cherche mais je n’entends aucun bip ». Un pointeur numérique branché sur le câble aide beaucoup.', POINTER)
        )],
      ])],
      ['Le pointeur trouve un signal mais je n’ai pas les chaînes', funnel(
        ['Lancez une recherche de chaînes : voyez-vous des chaînes étrangères (italiennes, anglaises, allemandes) ?', buy('La parabole est calée sur un satellite voisin.',
          'Astra 19,2° Est, Hot Bird 13° Est et Astra 28,2° Est sont proches dans le ciel. Pour TNTSAT, visez Astra 19,2° Est, un peu plus à l’est que Hot Bird : tournez lentement jusqu’au satellite suivant et refaites la recherche. Un pointeur qui reconnaît le satellite évite l’erreur.',
          POINTER), ['Oui, des chaînes étrangères', 'Non, aucune chaîne']],
        [`Votre carte correspond-elle au satellite visé (${SAT}) ?`, buy('La carte ne correspond pas au satellite visé.',
          'Une carte TNTSAT ne marche que sur Astra 19,2° Est, une carte Fransat sur Eutelsat 5° Ouest : visez le bon satellite.', 'Boussole et carte des satellites'), ['Non, ce n’est pas le bon', 'Oui']],
        ['Dans le menu Installation du démodulateur, l’antenne est-elle réglée en « LNB universel », sans commutateur (DiSEqC désactivé) ?', buy('Les réglages d’antenne du démodulateur avaient changé.',
          'Après une mise à jour ou une remise à zéro, remettez « LNB universel », 22 kHz automatique, DiSEqC désactivé, puis relancez la recherche des chaînes.', 'Aucun produit nécessaire'), ['Non, c’était autre chose', 'Oui, ou je ne sais pas']],
        shop('L’installation satellite est en défaut.',
          'Bon satellite et bons réglages, toujours pas de chaînes : l’atelier teste la tête LNB, le câble et le démodulateur.', 'Contrôle de l’installation satellite à l’atelier')
      )],
      ['Le pointeur bipe partout ou l’aiguille reste au maximum', funnel(
        ['Baissez la sensibilité jusqu’à ce que l’aiguille revienne au milieu, puis balayez lentement. Trouvez-vous un endroit où elle monte nettement ?', buy('La sensibilité du pointeur était trop forte.',
          'Une aiguille en butée ne montre plus rien : baissez la sensibilité chaque fois qu’elle monte au maximum.', 'Aucun produit nécessaire'), ['Oui', 'Non, elle reste au maximum']],
        ['Cachez la tête LNB avec la main : le pointeur réagit-il encore pareil ?', shop('Un défaut du câble fausse le signal.',
          'Le pointeur réagit même tête cachée : il ne mesure pas le satellite mais un défaut (fiche mouillée, court-circuit). L’atelier contrôle le câble et la tête LNB.', 'Contrôle de la tête LNB et du câble à l’atelier'), ['Oui, pareil', 'Non, il baisse']],
        buy('Le pointeur ne reconnaît pas le satellite.',
          'Il réagit à tous les satellites : visez d’abord le bon (direction et inclinaison d’après la carte), puis confirmez par une recherche de chaînes. Un pointeur qui identifie le satellite évite l’erreur.', POINTER)
      )],
    ]),
  },
  {
    id: 'p_mat',
    cat: 'ext',
    label: 'Le mât de mon antenne manuelle est dur ou redescend, la parabole ne se replie pas, ou l’image coupe quand je touche le câble',
    eq: 'satman',
    kw: 'mât antenne manuelle parabole dur grippé tourne mal manivelle redescend bouge vent replie pas repliée bloquée frein collier câble coaxial fiche f lnb eau rouille image coupe',
    tree: ask('Que se passe-t-il ?', [
      ['Le mât est dur à tourner ou à monter', funnel(
        ['Le frein (ou la molette de serrage) du mât est-il bien desserré ?', buy('Le frein du mât était serré.',
          'Desserrez le frein avant de tourner, resserrez-le une fois le satellite trouvé.', 'Aucun produit nécessaire'), ['Non, il était serré', 'Oui']],
        ['Pulvérisez un spray silicone sur la partie du mât qui tourne et sur la manivelle (pas sur le joint du toit). Le mât tourne-t-il mieux ?', buy('Le mât de l’antenne était grippé.',
          'Refaites-le à chaque début de saison. Ne forcez jamais : un mât forcé abîme l’étanchéité du toit.', 'Spray silicone pour mécanismes d’antenne'), ['Oui, c’est réglé', 'Non, rien ne change']],
        shop('Le mécanisme du mât est bloqué.',
          'Ne forcez pas : vous abîmeriez le passage du toit et son étanchéité. L’atelier débloque ou change le mécanisme.', 'Remise en état du mât d’antenne à l’atelier')
      )],
      ['Le mât ou la parabole redescend, ou bouge au vent', funnel(
        ['Resserrez le frein ou le collier du mât une fois le satellite trouvé. La parabole tient-elle ?', buy('Le frein du mât n’était pas assez serré.',
          'Serrez-le à la main une fois calé, et repointez quand le vent tombe.', 'Aucun produit nécessaire')],
        ['Manivelle en butée, pouvez-vous encore soulever la parabole à la main ?', shop('Le pignon de la manivelle patine.',
          'Le mécanisme d’élévation est usé : l’atelier le change.', 'Mécanisme d’élévation, posé par l’atelier'), ['Oui, elle bouge', 'Non, elle est ferme']],
        buy('Le vent fait bouger la parabole.',
          'Par grand vent, une parabole manuelle bouge : repointez quand il faiblit, et garez-vous si possible à l’abri.', 'Boussole et pointeur satellite pour repointer')
      )],
      ['La parabole ne se replie pas', funnel(
        ['Tournez d’abord le mât dans sa position de route (repère), frein desserré, puis repliez. La parabole se replie-t-elle ?', buy('Le mât n’était pas dans sa position de route.',
          'La parabole ne se replie que mât tourné dans sa position de route : marquez-la d’un repère. Un avertisseur « antenne levée » évite de partir antenne dépliée.', 'Avertisseur d’antenne levée', FOLD_SEC), ['Oui, c’est réglé', 'Non, elle ne descend pas']],
        shop('Le mécanisme de repli est bloqué.',
          'Ne roulez pas et ne forcez pas. Appelez l’atelier : il vous dit comment faire pour venir, ou se déplace.', 'Remise en état de l’antenne à l’atelier', FOLD_SEC)
      )],
      ['L’image coupe quand je touche le câble', funnel(
        ['Resserrez à la main les fiches du câble, au démodulateur et sous la tête LNB. Est-ce réglé ?', buy('Une fiche du câble coaxial était desserrée.',
          'Vissez-les à la main sans forcer, et vérifiez-les en début de saison.', 'Fiche F à visser pour câble satellite')],
        ['La fiche sous la tête LNB est-elle verte, rouillée ou mouillée ?', buy('L’eau a oxydé la fiche de la tête LNB.',
          'Démodulateur éteint, une fiche F neuve et étanche, avec son capuchon de protection, remplace l’ancienne (le magasin peut la poser). Le capuchon empêche ensuite l’eau d’entrer.', 'Fiche F étanche avec capuchon de protection'), ['Oui', 'Non']],
        ['Le câble est-il écrasé ou plié net quelque part (passage du toit, placard) ?', shop('Le câble coaxial est écrasé.',
          'Un câble écrasé coupe le signal. L’atelier le change en refaisant l’étanchéité du passage de toit.', 'Cordon coaxial neuf, posé par l’atelier'), ['Oui', 'Non']],
        shop('La tête LNB est en défaut.', 'Fiches et câble bons : l’atelier teste la tête LNB et la change si besoin.', 'Tête LNB de remplacement, posée par l’atelier')
      )],
    ]),
  },
  {
    id: 'p_chaines',
    cat: 'ext',
    label: 'Mon démodulateur satellite n’a plus les chaînes ou affiche un message de carte (TNTSAT, Fransat)',
    kw: 'démodulateur décodeur tntsat fransat carte à puce plus de chaînes mise à jour remise à zéro message carte absente non valide expirée chaînes disparues pas de signal',
    tree: ask('Que se passe-t-il ?', [
      ['Plus aucune chaîne, après une mise à jour ou une remise à zéro', funnel(
        [`Dans Installation, remettez « LNB universel », 22 kHz automatique, DiSEqC désactivé et le bon satellite (${SAT}), puis relancez la recherche des chaînes. Les chaînes reviennent-elles ?`, buy('Les réglages d’antenne du démodulateur avaient été effacés.',
          'Notez ces réglages dans la boîte à gants : après une mise à jour ou une remise à zéro, il suffit de les remettre.', 'Aucun produit nécessaire'), ['Oui, c’est réglé', 'Non, rien ne change']],
        ['Dans le menu du démodulateur, la qualité du signal (pas seulement le niveau) est-elle sous la moitié ?', buy('L’antenne n’est pas calée sur le satellite.',
          'Repointez l’antenne : voyez le diagnostic « Mon pointeur satellite ne calibre pas ou ne cale pas ».', POINTER), ['Oui, la qualité est faible', 'Non, elle est bonne']],
        ['Faites une remise à zéro usine (menu « réglages d’usine »), puis l’installation guidée. Les chaînes reviennent-elles ?', buy('Le logiciel du démodulateur était bloqué.',
          'La remise à zéro efface les réglages : refaites l’installation guidée avec le bon satellite.', 'Aucun produit nécessaire'), ['Oui, c’est réglé', 'Non, rien ne change']],
        shop('Le démodulateur est en panne.', 'Bons réglages et bon signal, toujours rien : l’atelier contrôle le démodulateur, ou vous en conseille un neuf.', 'Contrôle du démodulateur à l’atelier, ou démodulateur TNTSAT ou Fransat neuf')
      )],
      ['Un message parle de la carte (absente, non valide, expirée)', funnel(
        ['Démodulateur éteint, retirez la carte puis remettez-la à fond, puce dans le bon sens. Le message disparaît-il ?', buy('La carte était mal insérée.',
          'Les vibrations de la route la font bouger : vérifiez-la si le message revient.', 'Aucun produit nécessaire'), ['Oui, c’est réglé', 'Non, rien ne change']],
        ['Dans le menu « Carte à puce », la date de fin est-elle passée ? (une carte TNTSAT dure 4 ans après sa première utilisation)', buy('La carte TNTSAT a expiré.',
          'Elle se renouvelle auprès de TNTSAT (ou de Fransat pour une carte Fransat). Méfiez-vous des cartes d’occasion.', 'Carte TNTSAT ou Fransat neuve'), ['Oui, elle est expirée', 'Non']],
        ['Laissez le démodulateur allumé une heure, calé sur le satellite. Le message disparaît-il ?', buy('La carte attendait la mise à jour de ses droits par le satellite.',
          'Une carte restée longtemps sans servir reçoit ses droits par le satellite : laissez le démodulateur allumé et calé une heure.', 'Aucun produit nécessaire'), ['Oui, c’est réglé', 'Non, rien ne change']],
        shop('Le lecteur de carte du démodulateur est en défaut.', 'Carte bien mise, valable et à jour : l’atelier contrôle le lecteur du démodulateur ; sinon la carte se change.', 'Contrôle du démodulateur à l’atelier')
      )],
      ['Certaines chaînes seulement ont disparu', funnel(
        ['Relancez une recherche automatique des chaînes. Les chaînes reviennent-elles ?', buy('La liste des chaînes avait changé.',
          'Les chaînes changent parfois de fréquence : relancez la recherche de temps en temps.', 'Aucun produit nécessaire'), ['Oui, c’est réglé', 'Non, rien ne change']],
        ['Pleut-il fort ou neige-t-il ?', buy('La forte pluie affaiblit le signal du satellite.',
          'Le signal revient quand l’averse passe. Essuyez la neige sur la parabole.', 'Aucun produit nécessaire'), ['Oui', 'Non']],
        shop('L’inclinaison de la tête LNB est décalée.',
          'Voyez aussi « Je veux régler l’inclinaison de la tête LNB (skew) ». L’atelier vérifie l’inclinaison et la tête.', 'Réglage de l’antenne à l’atelier')
      )],
    ]),
  },
];

module.exports = { CLIENTS_2026_10_C };
