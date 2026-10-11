'use strict';

// « Les 10 pannes les plus courantes en camping-car » (Esprit Camping-Car, with Star Mobil Services, assistance 24/24):
// what our diagnostics missed. Applied once (« 2026-11-07-dix-pannes »), with the engine of diagnostics-audit.js.
// Covered already: water pump, gas frozen in the cold, gas smell with the fridge vents blocked.

const { buy, shop, funnel } = require('./diag-helpers');
const { applyChanges } = require('./diagnostics-audit');

const none = (cause, geste, sec = null) => ({ cause, geste, prod: 'Aucun produit nécessaire', sec });
const YN = ['Oui', 'Non'];
const FUEL_SEC = 'Odeur de gazole ou fuite sous le véhicule après le choc : ne réarmez rien et ne redémarrez pas (risque d’incendie). Appelez l’assistance.';

const OPS = [
  // The engine stopped after a shock, hazard lights on: the fuel cut-off switch of the chassis (Fiat Ducato, Ford Transit…).
  { id: 'start', op: 'answer', at: 'Que constatez-vous quand vous tournez la clé', option: 'Le moteur s’est coupé après un choc (trou, trottoir) et les warnings se sont allumés',
    node: funnel(
      ['Sentez-vous une odeur de gazole, ou voyez-vous une fuite sous le véhicule ?', shop('Le choc a peut-être endommagé le circuit de carburant.', 'Ne réarmez rien et ne redémarrez pas : appelez l’assistance de votre contrat.', 'Assistance et contrôle à l’atelier', FUEL_SEC), YN],
      ['Retirez la clé. Réarmez l’interrupteur de sécurité du carburant : appuyez sur son bouton (sa place est dans la notice du porteur, souvent côté passager sous la boîte à gants). Remettez le contact : le moteur démarre-t-il ?', none('L’interrupteur de sécurité a coupé le carburant après le choc.', 'C’est une sécurité contre l’incendie : elle coupe le gazole et allume les warnings après un choc. Notez sa place pour la prochaine fois.', FUEL_SEC)],
      shop('Le moteur ne repart pas après le choc.', 'Appelez l’assistance : l’atelier contrôle l’interrupteur de sécurité et le circuit de carburant.', 'Assistance et contrôle à l’atelier', FUEL_SEC)
    ) },
  // The step is in, but the alarm keeps sounding while driving: its switch is dirty or seized.
  { id: 'step', op: 'answer', at: 'Que se passe-t-il ?', option: 'Il est rentré, mais l’alarme sonne quand je roule',
    node: funnel(
      ['Arrêté, rentrez de nouveau le marchepied avec l’interrupteur et poussez-le à fond à la main. L’alarme s’arrête-t-elle ?', none('Le marchepied n’était pas tout à fait rentré.', 'Vérifiez qu’il est rentré à fond avant chaque départ.')],
      ['Sous le marchepied, le petit contacteur de fin de course est-il sale, rouillé ou grippé ? Nettoyez-le et dégrippez-le. L’alarme s’arrête-t-elle ?', buy('Le contacteur du marchepied était grippé.', 'L’humidité et les longs arrêts le grippent : dégrippez les contacteurs, charnières et serrures extérieurs à chaque saison.', 'Dégrippant spray contacts')],
      shop('Le contacteur du marchepied est en défaut.', 'L’atelier contrôle ou change le contacteur et son câblage.', 'Contrôle du marchepied à l’atelier')
    ) },
  // Cabin electronics tripped: switching the battery cut-off off then on again resets it.
  { id: 'no12v', op: 'before', at: 'Le fusible principal près de la batterie est-il intact',
    t: 'Mettez le coupe-batterie sur « arrêt » une minute (et le bouton du chargeur, s’il en a un), puis remettez tout sur « marche ». Le panneau s’allume-t-il ?',
    leaf: none('Une sécurité de la centrale électrique avait disjoncté.', 'Les centrales électriques récentes se coupent à la moindre surtension pour se protéger : couper puis remettre le coupe-batterie les réarme.') },
  // Electric bed stuck at the top: a reset of the 12 V, and a battery too weak to move it.
  { id: 'bedlift', op: 'before', at: 'Rien n\'a suffi : la commande électronique est bloquée.',
    t: 'Mettez le coupe-batterie sur « arrêt » une minute, puis sur « marche », et réessayez. Le lit bouge-t-il ?',
    leaf: none('La commande électronique du lit avait perdu ses réglages.', 'Couper puis remettre le 12 V la remet à zéro. Gardez la batterie bien chargée : une tension trop basse bloque aussi le lit.') },
  // TV: an update of the channels was offered and refused.
  { id: 'p_chaines', op: 'before', at: 'Dans Installation, remettez « LNB universel »',
    t: 'Un message propose-t-il une mise à jour des chaînes ou du logiciel ? Acceptez-la (touche OK), attendez la fin, puis réessayez. Les chaînes reviennent-elles ?',
    leaf: none('Une mise à jour des chaînes attendait d’être acceptée.', 'Les chaînes changent souvent : acceptez toujours les mises à jour proposées, sinon elles disparaissent.') },
  { id: 'h_tv', op: 'before', at: 'Dans Installation, remettez « LNB universel »',
    t: 'Un message propose-t-il une mise à jour des chaînes ou du logiciel ? Acceptez-la (touche OK), attendez la fin, puis réessayez. Les chaînes reviennent-elles ?',
    leaf: none('Une mise à jour des chaînes attendait d’être acceptée.', 'Les chaînes changent souvent : acceptez toujours les mises à jour proposées, sinon elles disparaissent.') },
  { id: 'h_tv', op: 'kw', words: 'mise à jour chaînes accepter' },
  { id: 'p_chaines', op: 'kw', words: 'mise à jour proposée accepter' },
  { id: 'p_crevaison', op: 'kw', words: 'éclaté explosé pneu éclaté' },
  { id: 'start', op: 'kw', words: 'coupé après un choc warnings interrupteur de sécurité inertie coupure carburant' },
  { id: 'step', op: 'kw', words: 'alarme bip marchepied rentré sonne' },
];

const NEW = [
  {
    id: 'p_gasoileau',
    cat: 'eau',
    label: 'J’ai mis du gasoil (ou un autre liquide) dans le réservoir d’eau propre',
    eq: 'propre',
    kw: 'gasoil gazole diesel carburant dans le réservoir d eau propre erreur trappe plein eau confondu',
    tree: funnel(
      ['Avez-vous seulement rempli, sans allumer la pompe ni ouvrir de robinet ?', buy('Le gasoil est resté dans le réservoir.', 'Ne buvez pas cette eau et n’allumez pas la pompe. Videz entièrement le réservoir par sa vidange, puis remplissez d’eau avec un nettoyant pour réservoir, roulez 30 minutes et videz : trois fois de suite. Désinfectez ensuite le circuit avant de le réutiliser.', 'Nettoyant pour réservoir d’eau propre', 'Ne buvez pas l’eau, ne faites pas tourner la pompe ni le chauffe-eau.'), ['Oui', 'Non, la pompe a tourné']],
      shop('Le gasoil est passé dans les tuyaux et le chauffe-eau.', 'Coupez la pompe et le chauffe-eau. L’atelier vide et nettoie tout le circuit, et change les pièces qui gardent l’odeur.', 'Nettoyage du circuit d’eau à l’atelier', 'Ne buvez pas l’eau, ne faites pas tourner la pompe ni le chauffe-eau.')
    ),
  },
];

function applyDixPannes(db) {
  const n = applyChanges(db, { ops: OPS, news: NEW });
  applyDixPannes.missed = applyChanges.missed;
  return n;
}

module.exports = { applyDixPannes, OPS, NEW };
