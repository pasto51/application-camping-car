'use strict';

// A lithium cell battery always comes with a charging booster (DC-DC) for driving: fitted by the workshop or the
// store (« 2026-11-06-booster-lithium »). In the app: ticking « lithium » ticks « Charge de la batterie cellule en
// roulant » as a booster (its type question: booster or relay), and a booster that no longer charges has its own
// diagnostic, ending at the workshop or store for anything beyond a look.

const { buy, shop, funnel } = require('./diag-helpers');

const B2B_VARIANT = { q: 'Type de charge en roulant', o: [['v1', 'Booster de charge (DC-DC)', '', ''], ['v2', 'Coupleur séparateur (relais)', '', ''], ['ns', 'Je ne sais pas', '', '']] };
const LITH_NOTE = 'Elle demande un booster de charge (DC-DC) pour se recharger en roulant : il est posé par l’atelier ou le magasin.';

const P_BOOSTER = {
  id: 'p_booster',
  cat: 'elec',
  label: 'Mon booster de charge ne recharge plus la batterie cellule en roulant',
  eq: 'b2b',
  vonly: ['b2b', ['v1']],
  kw: 'booster dc-dc dc dc chargeur en roulant batterie cellule ne charge pas en roulant lithium alternateur d+ votronic victron orion ctek schaudt',
  tree: funnel(
    ['Roulez au moins 10 minutes, moteur chaud. Le voyant du booster (ou son application) montre-t-il qu’il charge ?', buy('Le booster attendait que le moteur tourne depuis assez longtemps.', 'C’est normal : il ne démarre qu’après un court délai, moteur bien lancé. Un moniteur de batterie montre ce qu’il envoie.', 'Moniteur de batterie'), ['Oui, il charge', 'Non']],
    {
      t: 'Quelle est la batterie de votre cellule ?', vk: 'g_batterie', vv: ['lith', 'agm|gel'], o: ['Lithium', 'AGM ou gel'],
      n: [
        funnel(
          ['Fait-il moins de 0 °C là où se trouve la batterie ? Chauffez la cellule une heure, puis roulez de nouveau. La charge démarre-t-elle ?', { cause: 'La batterie lithium était trop froide pour charger.', geste: 'C’est normal : sous 0 °C, sa protection refuse la charge, qui reprend quand elle se réchauffe.', prod: 'Aucun produit nécessaire', sec: null }],
          shop('Le booster de charge est en défaut.', 'Ne touchez pas au câblage. L’atelier ou le magasin qui l’a posé contrôle son réglage pour la lithium, ses fusibles, et le signal « moteur en marche » (sur les porteurs récents, il faut parfois un simulateur D+).', 'Contrôle du booster de charge', null, 'energie')
        ),
        shop('Le booster de charge est en défaut.', 'Ne touchez pas au câblage. L’atelier ou le magasin qui l’a posé contrôle son réglage pour votre batterie, ses fusibles, et le signal « moteur en marche » (sur les porteurs récents, il faut parfois un simulateur D+).', 'Contrôle du booster de charge', null, 'energie'),
      ],
    }
  ),
};

function applyBooster(db) {
  let changed = 0;
  const row = db.prepare("SELECT value FROM catalog WHERE key = 'config'").get();
  if (row) {
    const cfg = JSON.parse(row.value);
    cfg.VARIANTS = cfg.VARIANTS || {};
    cfg.IMPL = cfg.IMPL || {};
    cfg.APP_VARS = cfg.APP_VARS || {};
    cfg.IMPL_VISIBLE = cfg.IMPL_VISIBLE || {};
    if (!cfg.VARIANTS.b2b) cfg.VARIANTS.b2b = B2B_VARIANT;
    cfg.IMPL.lith = [...new Set([...(cfg.IMPL.lith || []), 'b2b'])];
    cfg.APP_VARS.lith = { ...(cfg.APP_VARS.lith || {}), b2b: 'v1' };
    // Stays visible under its ensemble, and is not unticked when the battery changes.
    cfg.IMPL_VISIBLE.b2b = 1;
    db.prepare("UPDATE catalog SET value = ?, updated_at = datetime('now') WHERE key = 'config'").run(JSON.stringify(cfg));
    changed++;
  }
  const lr = db.prepare("SELECT data FROM equipment WHERE id = 'lith'").get();
  if (lr) {
    const q = JSON.parse(lr.data);
    if (!q.note) {
      q.note = LITH_NOTE;
      db.prepare("UPDATE equipment SET data = ? WHERE id = 'lith'").run(JSON.stringify(q));
      changed++;
    }
  }
  if (!db.prepare('SELECT 1 FROM diagnostics WHERE id = ?').get(P_BOOSTER.id)) {
    const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS n FROM diagnostics').get().n;
    db.prepare('INSERT INTO diagnostics (id, sort, data) VALUES (?, ?, ?)').run(P_BOOSTER.id, sort + 1, JSON.stringify(P_BOOSTER));
    changed++;
  }
  return changed;
}

module.exports = { applyBooster, P_BOOSTER, LITH_NOTE };
