'use strict';

// Removes the sales demo (server/demo.js): its three dealerships, their customers, banners and notifications, and the
// @demo.test accounts. Never anything else.

function removeDemo(db) {
  // Only these three: the dealership DEMO2026 created at install time is left alone.
  const ids = db.prepare("SELECT id FROM dealerships WHERE code IN ('DEMONANT', 'DEMORENN', 'DEMOVANN')").all().map((d) => d.id);
  let customers = 0;
  for (const id of ids) customers += db.prepare('DELETE FROM customers WHERE dealership_id = ?').run(id).changes;
  for (const id of ids) db.prepare('DELETE FROM usage_events WHERE dealership_id = ?').run(id);
  // Banners « À la une » of the demo: only those for demo dealerships (never one for everyone).
  for (const b of db.prepare('SELECT id, dealership_ids FROM banners').all()) {
    const targets = JSON.parse(b.dealership_ids || '[]');
    if (targets.length && targets.every((t) => ids.includes(t))) db.prepare('DELETE FROM banners WHERE id = ?').run(b.id);
  }
  // Notifications of the demo: only those for demo dealerships.
  for (const c of db.prepare('SELECT id, target FROM notif_campaigns').all()) {
    const targets = JSON.parse(c.target || '{}').dealershipIds || [];
    if (targets.length && targets.every((t) => ids.includes(t))) db.prepare('DELETE FROM notif_campaigns WHERE id = ?').run(c.id);
  }
  const accounts = db.prepare("DELETE FROM admins WHERE email LIKE '%@demo.test'").run().changes;
  for (const id of ids) db.prepare('DELETE FROM dealerships WHERE id = ?').run(id);
  return { dealerships: ids.length, customers, accounts };
}

module.exports = { removeDemo };
