'use strict';

// Which service of the dealership handles a customer's request:
//   SAV (after-sales / workshop): workshop appointments and problems (sealing test, gas check, servicing…), and parts or
//   products while the vehicle is under warranty or extended warranty;
//   Magasin (store): parts and products out of warranty, and always accessories added to the vehicle.

const SERVICES = { sav: 'SAV', magasin: 'Magasin' };

function addYears(date, years) {
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

// Warranty of a customer's vehicle: its end date (or the usual one from the handover) and the extension, if any.
function warrantyOf(db, customer) {
  const d = db.prepare('SELECT warranty_years FROM dealerships WHERE id = ?').get(customer.dealership_id) || {};
  const years = Number.isInteger(d.warranty_years) ? d.warranty_years : 2;
  const end = customer.warranty_end || (customer.handover_date ? addYears(customer.handover_date, years) : null);
  const ext = customer.warranty_ext_end || null;
  const until = [end, ext].filter(Boolean).sort().pop() || null;
  const today = new Date().toISOString().slice(0, 10);
  return { end, extEnd: ext, until, active: !!until && until >= today, extended: !!ext && ext >= today && (!end || end < today) };
}

const fr = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

function routeRequest(db, customer, { kind, need }) {
  if (kind !== 'piece') return { service: 'sav', reason: 'Atelier' };
  if (need === 'accessoire') return { service: 'magasin', reason: 'Accessoire' };
  const w = warrantyOf(db, customer);
  return w.active
    ? { service: 'sav', reason: w.extended ? `Sous extension de garantie jusqu’au ${fr(w.until)}` : `Sous garantie jusqu’au ${fr(w.until)}` }
    : { service: 'magasin', reason: 'Hors garantie' };
}

// The service's mailbox (one per service); the SAV falls back on the dealership's address.
function serviceEmail(db, dealershipId, service) {
  const d = db.prepare('SELECT email, sav_email, store_email FROM dealerships WHERE id = ?').get(dealershipId) || {};
  return service === 'magasin' ? d.store_email || d.sav_email || d.email : d.sav_email || d.email;
}

module.exports = { SERVICES, warrantyOf, routeRequest, serviceEmail, addYears };
