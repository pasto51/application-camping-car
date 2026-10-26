'use strict';

// Petite appli privée « sujets de discussion » (covoit, bar, repas), sans lien avec l'appli camping-car.
// Cachée : seulement deux adresses secrètes /cv/<clé>/ (une par personne), écrites dans DATA_DIR/covoit-liens.txt.
// Toute autre adresse sous /cv/ répond « Introuvable », comme une page qui n'existe pas.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { HttpError, readJsonBody, sendJson } = require('./http');

const PAGE = path.join(__dirname, 'covoit.html');
const KINDS = ['covoit', 'bar', 'midi'];
const MAX = 4;

function createCovoit(dataDir) {
  const file = path.join(dataDir, 'covoit.json');
  let state;

  function save() {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 1), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }

  function load() {
    if (state) return state;
    try {
      state = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const m of state.meets) {
        if (m.slots) continue;
        m.slots = { [slotNames(m.kind)[0]]: { topics: m.topics, pick: m.pick } };
        delete m.topics;
        delete m.pick;
      }
    } catch {
      fs.mkdirSync(dataDir, { recursive: true });
      const key = () => crypto.randomBytes(16).toString('hex');
      state = { keys: { a: key(), b: key() }, names: { a: 'Flo', b: 'Marlène' }, meets: [], ideas: { a: [], b: [] }, seq: 0 };
      save();
      fs.writeFileSync(
        path.join(dataDir, 'covoit-liens.txt'),
        'Appli sujets de covoit — adresses secrètes (à ajouter après l\'adresse du site) :\n' +
          `  Lien de Flo     : /cv/${state.keys.a}/\n` +
          `  Lien de Marlène : /cv/${state.keys.b}/\n`,
        { mode: 0o600 }
      );
    }
    return state;
  }

  function who(key) {
    const s = load();
    for (const w of ['a', 'b']) {
      const k = Buffer.from(s.keys[w]);
      const given = Buffer.from(String(key));
      if (k.length === given.length && crypto.timingSafeEqual(k, given)) return w;
    }
    return null;
  }

  const other = (w) => (w === 'a' ? 'b' : 'a');
  const clean = (v, n = 160) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const findMeet = (id) => {
    const m = load().meets.find((x) => x.id === Number(id));
    if (!m) throw new HttpError(404, 'Introuvable (déjà supprimé ?)');
    return m;
  };

  // Un covoit a deux moments (matin, soir), chacun avec ses sujets ; le bar et le midi en ont un seul.
  const slotNames = (kind) => (kind === 'covoit' ? ['matin', 'soir'] : ['main']);
  const emptySlot = () => ({ topics: { a: [], b: [] }, pick: { a: null, b: null } });
  function slotOf(m, name) {
    if (!slotNames(m.kind).includes(name)) throw new HttpError(400, 'Moment inconnu');
    return (m.slots[name] ||= emptySlot());
  }

  // Ce que voit une personne : tout, sauf qu'elle voit « moi » / « l'autre » plutôt que a / b.
  function view(w) {
    const s = load();
    const o = other(w);
    const meets = s.meets
      .slice()
      .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : y.id - x.id))
      .map((m) => ({
        id: m.id,
        kind: m.kind,
        date: m.date,
        debrief: !!m.debrief,
        slots: slotNames(m.kind).map((name) => {
          const sl = m.slots[name] || emptySlot();
          return {
            name,
            mine: sl.topics[w],
            theirs: sl.topics[o],
            myPick: sl.pick[w], // sujet de l'autre que j'ai choisi
            theirPick: sl.pick[o], // mon sujet que l'autre a choisi
          };
        }),
        done: m.done || {},
      }));
    return { me: w, names: { me: s.names[w], them: s.names[o] }, meets, ideas: s.ideas[w], later: s.later || [] };
  }

  const actions = {
    name(w, b) {
      load().names[w] = clean(b.name, 30) || (w === 'a' ? 'Flo' : 'Marlène');
    },
    create(w, b) {
      const s = load();
      const kind = KINDS.includes(b.kind) ? b.kind : 'covoit';
      const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10);
      const slots = Object.fromEntries(slotNames(kind).map((n) => [n, emptySlot()]));
      s.meets.push({ id: ++s.seq, kind, date, slots, debrief: false, done: {} });
    },
    remove(w, b) {
      const s = load();
      s.meets = s.meets.filter((m) => m.id !== Number(b.id));
    },
    topics(w, b) {
      const m = slotOf(findMeet(b.id), b.slot);
      const list = (Array.isArray(b.topics) ? b.topics : []).map((t) => clean(t)).filter(Boolean).slice(0, MAX);
      // Mon choix chez l'autre ne bouge pas ; le choix de l'autre chez moi saute si son sujet a disparu.
      const picked = m.pick[other(w)] != null ? m.topics[w][m.pick[other(w)]] : null;
      m.topics[w] = list;
      m.pick[other(w)] = picked != null && list.includes(picked) ? list.indexOf(picked) : null;
      // Les idées utilisées quittent la réserve.
      const s = load();
      s.ideas[w] = s.ideas[w].filter((i) => !list.includes(i));
    },
    pick(w, b) {
      const m = slotOf(findMeet(b.id), b.slot);
      const i = b.index == null ? null : Number(b.index);
      m.pick[w] = i != null && i >= 0 && i < m.topics[other(w)].length ? i : null;
    },
    done(w, b) {
      // Sujet terminé ou « à reprendre » : un sujet à reprendre va dans la liste commune « On en reparle ».
      const m = findMeet(b.id);
      const s = load();
      const t = clean(b.topic);
      if (!t) return;
      m.done[t] = b.state === 'later' ? 'later' : b.state === 'done' ? 'done' : undefined;
      s.later = (s.later || []).filter((x) => x !== t);
      if (b.state === 'later') s.later.push(t);
    },
    debrief(w, b) {
      const m = findMeet(b.id);
      if (m.kind === 'covoit') m.debrief = !!b.on;
    },
    unlater(w, b) {
      const s = load();
      s.later = (s.later || []).filter((x) => x !== clean(b.topic));
    },
    ideas(w, b) {
      load().ideas[w] = (Array.isArray(b.ideas) ? b.ideas : []).map((t) => clean(t)).filter(Boolean).slice(0, 60);
    },
  };

  async function handle(req, res, url) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const m = /^\/cv\/([0-9a-f]{32})\/(api)?$/.exec(url.pathname);
    const w = m && who(m[1]);
    if (!w) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Introuvable');
    }
    if (!m[2]) {
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Méthode non autorisée');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(PAGE));
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req, 32 * 1024);
      const act = actions[body && body.action];
      if (!act || !Object.hasOwn(actions, body.action)) throw new HttpError(400, 'Action inconnue');
      act(w, body);
      save();
    } else if (req.method !== 'GET') throw new HttpError(405, 'Méthode non autorisée');
    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, view(w), req);
  }

  return { handle, load };
}

module.exports = { createCovoit };
