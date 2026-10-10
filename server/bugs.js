'use strict';

// « Signaler un bug » (app and back-office) and the « Prendre en main » videos (one for customers, one for the team).

const { getSetting } = require('./db');

const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '');

function saveBug(db, { source, customerId = null, adminId = null, who, page, message, device, version }) {
  const text = clean(message, 3000);
  if (text.length < 3) throw new Error('Décrivez le problème en quelques mots');
  const r = db
    .prepare('INSERT INTO bug_reports (source, customer_id, admin_id, who, page, message, device, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(source, customerId, adminId, clean(who, 160), clean(page, 120), text, clean(device, 300), clean(version, 20));
  return db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(r.lastInsertRowid);
}

function bugOut(r) {
  return { id: r.id, source: r.source, who: r.who || '', page: r.page || '', message: r.message, device: r.device || '', version: r.version || '', status: r.status, createdAt: r.created_at };
}

// A link to the video: YouTube or Vimeo are shown inside the app, any other https link opens in a new tab.
function cleanVideoUrl(v) {
  const s = clean(v, 400);
  if (!s) return null;
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error('Lien de la vidéo invalide (il doit commencer par https://)');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Lien de la vidéo invalide (il doit commencer par https://)');
  return u.href;
}

function helpVideos(db) {
  return { app: getSetting(db, 'help_video_app', null), admin: getSetting(db, 'help_video_admin', null) };
}

module.exports = { saveBug, bugOut, cleanVideoUrl, helpVideos };
