'use strict';

// Building blocks of the customer diagnostics, written as funnels: the symptom first, then checks in order (the
// simplest and most likely first), each one ending on its own cause when it is the answer, and the workshop last.

// End points: a product of the accessory store, or the workshop.
const buy = (cause, geste, prod, sec = null) => ({ cause, geste, prod, sec, achat: true });
const shop = (cause, geste, prod, sec = null, rdv = 'atelier') => ({ cause, geste, prod, sec, rdv, pro: true });

const SOLVED = ['Oui, c’est réglé', 'Non, rien ne change'];

// funnel([question, endIfYes, answers?], …, last): each check either ends the path (first answer) or leads to the next
// one; « last » is what remains when no check found the cause (most often the workshop).
const funnel = (...items) => {
  const last = items.pop();
  return items.reduceRight((next, [t, yes, o = SOLVED]) => ({ t, o, n: [yes, next] }), last);
};

// A question with its answers and what follows each one.
const ask = (t, pairs) => ({ t, o: pairs.map((p) => p[0]), n: pairs.map((p) => p[1]) });

module.exports = { buy, shop, funnel, ask, SOLVED };
