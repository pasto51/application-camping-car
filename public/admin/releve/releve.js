// "Relevé véhicule": phone page to tick a vehicle's pre-checked equipment and take its photos while standing in it.
// Every change is saved straight away; what cannot be sent (no network in the workshop) waits and is retried.
import { esc, createApi, compressImage, toast } from '/shared/common.js';

const TOKEN_KEY = 'cc-admin-token';
const LAST_KEY = 'cc-releve-vehicle';
const root = document.getElementById('root');

const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* private mode: nothing to keep */
    }
  },
};

let token = store.get(TOKEN_KEY);
const api = createApi(
  () => token,
  () => {
    token = null;
    store.set(TOKEN_KEY, null);
  }
);

// Survey state for the open vehicle.
const S = {
  vehicle: null,
  equipment: [], // all known equipment
  cats: [],
  checked: new Set(),
  photos: {}, // equipment id -> url (or local data URL while it uploads)
  filter: 'all',
  search: '',
  // Waiting changes: the whole list (latest wins) and one photo per equipment (latest wins).
  listDirty: false,
  photoQueue: new Map(),
  busy: null,
  failed: false,
};

// ---------- Login and vehicle choice ----------

function renderLogin() {
  root.innerHTML = `<div class="login"><form class="card stack" id="login">
    <img src="/admin/icon.svg" alt="" width="56" height="56">
    <h1>Relevé véhicule</h1>
    <p class="muted" style="margin:0;text-align:center">Cochez les équipements et photographiez-les depuis le véhicule.</p>
    <label>E-mail<input name="email" type="email" required autocomplete="username"></label>
    <label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label>
    <button class="btn primary block">Se connecter</button>
  </form></div>`;
  root.querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const res = await api('POST', '/api/admin/login', { email: f.get('email'), password: f.get('password') });
      token = res.token;
      store.set(TOKEN_KEY, token);
      start();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function renderVehicles() {
  S.vehicle = null;
  history.replaceState(null, '', location.pathname);
  root.innerHTML = '<p class="pad muted">Chargement…</p>';
  const [brands, vehicles] = await Promise.all([api('GET', '/api/admin/brands'), api('GET', '/api/admin/vehicles')]);
  root.innerHTML = `<div class="bar"><div class="bar-row"><h1>Relevé véhicule<small>Choisissez le véhicule dans lequel vous êtes</small></h1>
      <a class="btn small" href="/admin/" style="min-height:40px;background:rgba(255,255,255,.15);color:#fff;border:0">Back-office</a></div></div>
    <div class="wrap">
      ${brands
        .map((b) => {
          const list = vehicles.filter((v) => v.brandId === b.id);
          return `<h2 class="brand-title">${esc(b.name)}</h2><div class="vlist">${
            list.length
              ? list
                  .map(
                    (v) => `<button class="vbtn" data-v="${v.id}">${v.photoUrl ? `<img src="${esc(v.photoUrl)}" alt="">` : '<span class="ph">🚐</span>'}
                <span><strong>${esc(v.name)}</strong><small>${esc(v.modelYear || '')}${v.active ? '' : ' · masqué dans l’appli'}</small></span></button>`
                  )
                  .join('')
              : '<p class="muted" style="margin:0">Aucun véhicule pour cette marque.</p>'
          }</div>`;
        })
        .join('')}
      <button class="btn block" id="newv" style="margin-top:20px">＋ Nouveau véhicule</button>
    </div>`;
  root.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => openVehicle(Number(b.dataset.v))));
  root.querySelector('#newv').onclick = () => newVehicle(brands);
}

function newVehicle(brands) {
  dialog(
    `<form class="dlg" method="dialog" id="nv">
      <h2>Nouveau véhicule</h2>
      <label>Marque<select name="brandId">${brands.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label>
      <label>Nom du véhicule<input name="name" required maxlength="120" placeholder="ex : V114 Road Edition"></label>
      <label>Millésime<input name="modelYear" maxlength="20" inputmode="numeric" placeholder="ex : 2027"></label>
      <div class="stack"><button class="btn primary block" value="ok">Créer et commencer le relevé</button><button class="btn block" value="" formnovalidate>Annuler</button></div>
    </form>`,
    async (dlg, value) => {
      if (value !== 'ok') return;
      const f = new FormData(dlg.querySelector('form'));
      try {
        const v = await api('POST', '/api/admin/vehicles', { brandId: Number(f.get('brandId')), name: f.get('name'), modelYear: f.get('modelYear') });
        openVehicle(v.id);
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  );
}

// ---------- Survey ----------

async function openVehicle(id) {
  if (S.vehicle?.id !== id && hasPending()) {
    toast('Des envois sont en attente, patientez un instant', 'error');
    return;
  }
  root.innerHTML = '<p class="pad muted">Chargement…</p>';
  const [vehicles, profile, equipment, cats] = await Promise.all([
    api('GET', '/api/admin/vehicles'),
    api('GET', `/api/admin/vehicles/${id}/profile`),
    api('GET', '/api/admin/equipment'),
    api('GET', '/api/admin/catalog/cats').then((r) => r.value || []),
  ]);
  const v = vehicles.find((x) => x.id === id);
  if (!v) return renderVehicles();
  Object.assign(S, {
    vehicle: v,
    equipment,
    cats,
    checked: new Set(profile.equipment),
    photos: Object.fromEntries(profile.photos.map((p) => [p.id, p.url])),
  });
  store.set(LAST_KEY, String(id));
  history.replaceState(null, '', `#v=${id}`);
  root.innerHTML = `<div class="bar">
      <div class="bar-row"><button id="back" aria-label="Changer de véhicule">‹</button>
        <h1>${esc(v.brandName)} ${esc(v.name)}<small id="count"></small></h1></div>
      <div class="tools">
        <input id="search" type="search" placeholder="Rechercher un équipement…" value="${esc(S.search)}">
        <div class="chips">${[
          ['all', 'Tout'],
          ['on', 'Cochés'],
          ['nophoto', 'Cochés sans photo'],
          ['off', 'Non cochés'],
        ]
          .map(([k, l]) => `<button class="chip ${S.filter === k ? 'active' : ''}" data-filter="${k}">${l}</button>`)
          .join('')}</div>
      </div>
    </div>
    <div class="wrap" id="list"></div>
    <div class="pending" id="pending" hidden></div>`;
  root.querySelector('#back').onclick = () => (hasPending() ? toast('Des envois sont en attente, patientez un instant', 'error') : renderVehicles());
  root.querySelector('#search').oninput = (e) => {
    S.search = e.target.value;
    renderList();
  };
  root.querySelectorAll('[data-filter]').forEach(
    (b) =>
      (b.onclick = () => {
        S.filter = b.dataset.filter;
        root.querySelectorAll('[data-filter]').forEach((c) => c.classList.toggle('active', c === b));
        renderList();
      })
  );
  const list = root.querySelector('#list');
  list.onclick = (e) => {
    const t = e.target.closest('[data-tick],[data-shot],[data-add]');
    if (!t) return;
    if (t.dataset.tick) toggle(t.dataset.tick);
    else if (t.dataset.shot) photoAction(t.dataset.shot);
    else addEquipment(t.dataset.add);
  };
  renderList();
  renderPending();
}

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function visible(q) {
  const on = S.checked.has(q.id);
  if (S.filter === 'on' && !on) return false;
  if (S.filter === 'off' && on) return false;
  if (S.filter === 'nophoto' && (!on || S.photos[q.id])) return false;
  const words = norm(S.search).split(/\s+/).filter(Boolean);
  const hay = norm(`${q.name} ${q.kw || ''} ${q.text || ''}`);
  return words.every((w) => hay.includes(w));
}

function itemHtml(q) {
  const on = S.checked.has(q.id);
  const url = S.photos[q.id];
  const state = S.busy === q.id ? 'busy' : S.photoQueue.has(q.id) ? 'wait' : '';
  return `<div class="item ${on ? 'on' : ''}" data-item="${esc(q.id)}">
    <button class="tick" data-tick="${esc(q.id)}" aria-pressed="${on}"><span class="box"></span><span>${esc(q.name)}</span></button>
    <button class="shot ${url ? 'has' : ''} ${state}" data-shot="${esc(q.id)}" aria-label="${url ? 'Voir la photo' : 'Prendre une photo'} : ${esc(q.name)}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : '📷'}</button>
  </div>`;
}

function renderList() {
  const list = root.querySelector('#list');
  if (!list) return;
  const searching = S.search.trim() || S.filter !== 'all';
  const known = new Set(S.cats.map((c) => c[0]));
  const cats = [...S.cats, ...(S.equipment.some((q) => !known.has(q.cat)) ? [['__other', 'Autres']] : [])];
  const html = cats
    .map(([cid, cname]) => {
      const all = S.equipment.filter((q) => (cid === '__other' ? !known.has(q.cat) : q.cat === cid));
      const shown = all.filter(visible);
      if (searching && !shown.length) return '';
      const n = all.filter((q) => S.checked.has(q.id)).length;
      return `<section class="cat"><div class="cat-head"><h2>${esc(cname)}</h2><small>${n} / ${all.length}</small></div>
        <div class="items">${shown.map(itemHtml).join('')}${cid === '__other' || searching ? '' : `<button class="add" data-add="${esc(cid)}">＋ Ajouter un équipement dans « ${esc(cname)} »</button>`}</div></section>`;
    })
    .join('');
  list.innerHTML = html || '<p class="empty">Aucun équipement ne correspond.</p>';
  updateCount();
}

function refreshItem(id) {
  const el = root.querySelector(`[data-item="${CSS.escape(id)}"]`);
  const q = S.equipment.find((x) => x.id === id);
  if (el && q) el.outerHTML = itemHtml(q);
  updateCount();
}

function updateCount() {
  const el = root.querySelector('#count');
  if (!el) return;
  const on = [...S.checked];
  const withPhoto = on.filter((id) => S.photos[id]).length;
  el.textContent = `${on.length} équipement${on.length > 1 ? 's' : ''} coché${on.length > 1 ? 's' : ''} · ${withPhoto} avec photo`;
}

function toggle(id) {
  if (S.checked.has(id)) S.checked.delete(id);
  else S.checked.add(id);
  S.listDirty = true;
  if (S.filter === 'all' && !S.search.trim()) {
    refreshItem(id);
    updateCatCount(id);
  } else renderList();
  schedule();
}

function updateCatCount(id) {
  const item = root.querySelector(`[data-item="${CSS.escape(id)}"]`);
  const sec = item?.closest('.cat');
  if (!sec) return;
  const ids = [...sec.querySelectorAll('[data-item]')].map((i) => i.dataset.item);
  sec.querySelector('.cat-head small').textContent = `${ids.filter((x) => S.checked.has(x)).length} / ${ids.length}`;
}

// Opens the phone camera (or the gallery, depending on the phone) and returns a compressed photo.
function takePhoto(camera = true) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.capture = 'environment';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(await compressImage(file));
      } catch (err) {
        toast(err.message, 'error');
        resolve(null);
      }
    };
    input.click();
  });
}

async function setPhoto(id, image) {
  S.photos[id] = image;
  if (!S.photos[id]) delete S.photos[id];
  S.photoQueue.set(id, image);
  // A photographed equipment is obviously in the vehicle.
  if (image && !S.checked.has(id)) {
    S.checked.add(id);
    S.listDirty = true;
  }
  refreshItem(id);
  updateCatCount(id);
  schedule(0);
}

function photoAction(id) {
  const q = S.equipment.find((x) => x.id === id);
  const url = S.photos[id];
  if (!url) {
    takePhoto().then((img) => img && setPhoto(id, img));
    return;
  }
  dialog(
    `<form class="dlg" method="dialog">
      <h2>${esc(q?.name || '')}</h2>
      <img src="${esc(url)}" alt="">
      <div class="stack">
        <button class="btn primary block" value="camera">📷 Reprendre la photo</button>
        <button class="btn block" value="gallery">🖼️ Choisir dans la galerie</button>
        <button class="btn danger block" value="remove">Retirer la photo</button>
        <button class="btn block" value="">Fermer</button>
      </div>
    </form>`,
    async (_dlg, value) => {
      if (value === 'camera' || value === 'gallery') {
        const img = await takePhoto(value === 'camera');
        if (img) setPhoto(id, img);
      } else if (value === 'remove') setPhoto(id, null);
    }
  );
}

function addEquipment(cat) {
  const cname = S.cats.find((c) => c[0] === cat)?.[1] || '';
  dialog(
    `<form class="dlg" method="dialog">
      <h2>Nouvel équipement</h2>
      <p class="muted" style="margin:0">Rubrique « ${esc(cname)} ». Il sera ajouté à la liste de tous les véhicules (non coché ailleurs) et coché ici. Vous pourrez compléter son texte d’explication depuis le back-office.</p>
      <label>Nom de l’équipement<input name="name" required maxlength="120" placeholder="ex : Panneau solaire 150 W"></label>
      <div class="stack"><button class="btn primary block" value="ok">Ajouter et cocher</button><button class="btn block" value="" formnovalidate>Annuler</button></div>
    </form>`,
    async (dlg, value) => {
      if (value !== 'ok') return;
      const name = new FormData(dlg.querySelector('form')).get('name');
      try {
        const q = await api('POST', '/api/admin/equipment', { cat, name });
        S.equipment.push(q);
        S.checked.add(q.id);
        S.listDirty = true;
        renderList();
        schedule(0);
        toast('Équipement ajouté et coché');
        root.querySelector(`[data-item="${CSS.escape(q.id)}"]`)?.scrollIntoView({ block: 'center' });
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  );
}

// ---------- Saving (one request at a time, retried when the network comes back) ----------

let timer;
function schedule(delay = 700) {
  S.failed = false;
  clearTimeout(timer);
  timer = setTimeout(flush, delay);
  renderPending();
}

const hasPending = () => S.listDirty || S.photoQueue.size > 0 || !!S.busy;

async function flush() {
  if (S.busy || !S.vehicle) return;
  const vid = S.vehicle.id;
  try {
    while (S.photoQueue.size || S.listDirty) {
      if (S.photoQueue.size) {
        const [id, image] = S.photoQueue.entries().next().value;
        S.busy = id;
        refreshItem(id);
        renderPending();
        const res = await api('PUT', `/api/admin/vehicles/${vid}/photos/${encodeURIComponent(id)}`, { image });
        // Only drop it if no newer photo was taken meanwhile.
        if (S.photoQueue.get(id) === image) {
          S.photoQueue.delete(id);
          if (res.url) S.photos[id] = res.url;
        }
        S.busy = null;
        refreshItem(id);
      } else {
        S.busy = '__list';
        S.listDirty = false;
        renderPending();
        try {
          await api('PUT', `/api/admin/vehicles/${vid}/profile`, { equipment: [...S.checked] });
        } catch (err) {
          S.listDirty = true;
          throw err;
        }
        S.busy = null;
      }
    }
  } catch (err) {
    const id = S.busy;
    S.busy = null;
    if (id && id !== '__list') refreshItem(id);
    S.failed = true;
    if (err.status === 401) {
      toast('Session expirée : reconnectez-vous', 'error');
    } else if (err.status && err.status !== 0) {
      toast(err.message, 'error');
    }
  }
  renderPending();
}

function renderPending() {
  const el = root.querySelector('#pending');
  if (!el) return;
  const n = S.photoQueue.size + (S.listDirty ? 1 : 0);
  if (!n && !S.busy) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.classList.toggle('saving', !S.failed);
  const photos = S.photoQueue.size;
  const what = [photos ? `${photos} photo${photos > 1 ? 's' : ''}` : '', S.listDirty || S.busy === '__list' ? 'la liste cochée' : ''].filter(Boolean).join(' et ') || 'les modifications';
  el.innerHTML = S.failed
    ? `<span>⚠️ Pas envoyé : ${esc(what)}. Ce sera renvoyé dès que le réseau revient.</span><button class="btn small" id="retry">Réessayer</button>`
    : `<span>⏳ Enregistrement de ${esc(what)}…</span>`;
  el.querySelector('#retry')?.addEventListener('click', () => schedule(0));
}

window.addEventListener('online', () => hasPending() && schedule(0));
setInterval(() => S.failed && hasPending() && navigator.onLine !== false && schedule(0), 30000);
window.addEventListener('beforeunload', (e) => {
  if (hasPending()) e.preventDefault();
});

// ---------- Small helpers ----------

function dialog(html, onClose) {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = html;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => {
    const value = dlg.returnValue;
    Promise.resolve(onClose(dlg, value)).finally(() => dlg.remove());
  });
  dlg.showModal();
  dlg.querySelector('input')?.focus();
}

// ---------- Start ----------

async function start() {
  let me;
  try {
    // Without a token, still try: the server may be in open-access (test) mode.
    me = await api('GET', '/api/admin/me');
  } catch {
    return renderLogin();
  }
  if (me.role !== 'admin') {
    root.innerHTML = `<div class="login"><div class="card stack"><h1>Réservé à l’administrateur</h1>
      <p class="muted" style="margin:0">Les équipements et photos des modèles sont gérés par l’administrateur. La concession ajuste ensuite les équipements de chaque client lors de la mise en main.</p>
      <a class="btn block" href="/admin/">Retour au back-office</a></div></div>`;
    return;
  }
  const fromHash = Number((location.hash.match(/v=(\d+)/) || [])[1]);
  const id = fromHash || Number(store.get(LAST_KEY)) || 0;
  try {
    if (id) return await openVehicle(id);
  } catch {
    /* vehicle deleted: fall back to the list */
  }
  try {
    await renderVehicles();
  } catch (err) {
    root.innerHTML = `<p class="pad error">${esc(err.message)}</p>`;
  }
}

start();
