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
  type: '', // vehicle silhouette: hides equipment that does not exist on it
  types: [],
  plan: { spots: [], planUrl: null },
  defaultSpots: {},
  labels: {}, // equipment name on this vehicle
  models: {}, // brand and model on this vehicle
  spotOverrides: {}, // equipment zone on this vehicle
  showAll: false,
  metaDirty: false,
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
    <label class="remember"><input type="checkbox" name="remember" checked> Rester connecté 15 jours sur ce téléphone</label>
    <button class="btn primary block">Se connecter</button>
  </form></div>`;
  root.querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const res = await api('POST', '/api/admin/login', { email: f.get('email'), password: f.get('password'), remember: f.get('remember') === 'on' });
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
      ${token ? '<button class="linkbtn" id="logout" style="display:block;margin:24px auto 0">Se déconnecter</button>' : ''}
    </div>`;
  root.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => openVehicle(Number(b.dataset.v))));
  root.querySelector('#newv').onclick = () => newVehicle(brands);
  root.querySelector('#logout')?.addEventListener('click', () => {
    token = null;
    store.set(TOKEN_KEY, null);
    store.set(LAST_KEY, null);
    renderLogin();
  });
}

function newVehicle(brands) {
  dialog(
    `<form class="dlg" method="dialog" id="nv">
      <h2>Nouveau véhicule</h2>
      <label>Marque<select name="brandId">${brands.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label>
      <label>Nom du véhicule<input name="name" required maxlength="120" placeholder="ex : V114 Road Edition"></label>
      <div class="stack"><button class="btn primary block" value="ok">Créer et remplir sa fiche</button><button class="btn block" value="" formnovalidate>Annuler</button></div>
    </form>`,
    async (dlg, value) => {
      if (value !== 'ok') return;
      const f = new FormData(dlg.querySelector('form'));
      try {
        const v = await api('POST', '/api/admin/vehicles', { brandId: Number(f.get('brandId')), name: f.get('name') });
        openWizard(v.id);
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  );
}

// ---------- Survey ----------

async function openVehicle(id, skipWizard = false) {
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
  if (!skipWizard && !v.photoUrl && !profile.model.h) return openWizard(id);
  Object.assign(S, {
    vehicle: v,
    equipment,
    cats,
    checked: new Set(profile.equipment),
    photos: Object.fromEntries(profile.photos.map((p) => [p.id, p.url])),
    type: profile.type || '',
    types: profile.types || [],
    plan: profile.plan || { spots: [], planUrl: null },
    defaultSpots: profile.defaultSpots || {},
    labels: { ...(profile.labels || {}) },
    models: { ...(profile.models || {}) },
    spotOverrides: { ...(profile.spotOverrides || {}) },
  });
  store.set(LAST_KEY, String(id));
  history.replaceState(null, '', `#v=${id}`);
  root.innerHTML = `<div class="bar">
      <div class="bar-row"><button id="back" aria-label="Changer de véhicule">‹</button>
        <h1>${esc(v.brandName)} ${esc(v.name)}<small id="count"></small></h1><button id="fiche">📝 Fiche</button></div>
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
  root.querySelector('#fiche').onclick = () => (hasPending() ? toast('Des envois sont en attente, patientez un instant', 'error') : openWizard(id));
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
    const t = e.target.closest('[data-tick],[data-shot],[data-add],[data-zone],[data-showall],[data-pick-type]');
    if (!t) return;
    if (t.dataset.zone) itemSheet(t.dataset.zone);
    else if (t.dataset.showall !== undefined) {
      S.showAll = !S.showAll;
      renderList();
    } else if (t.dataset.pickType !== undefined) openWizard(id, 1);
    else if (t.dataset.tick) toggle(t.dataset.tick);
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

const nameOf = (q) => S.labels[q.id] || q.name;
// Equipment that exists on this kind of vehicle (always shown when it is ticked).
const applicable = (q) => !S.type || !q.types?.length || q.types.includes(S.type) || S.checked.has(q.id);
const spotOf = (id) => {
  const ids = new Set(S.plan.spots.map((s) => s.id));
  if (Object.prototype.hasOwnProperty.call(S.spotOverrides, id)) return ids.has(S.spotOverrides[id]) ? S.spotOverrides[id] : null;
  return S.defaultSpots[id] ?? null;
};
const spotById = (id) => S.plan.spots.find((s) => s.id === id);

function visible(q) {
  const on = S.checked.has(q.id);
  if (!S.showAll && !applicable(q)) return false;
  if (S.filter === 'on' && !on) return false;
  if (S.filter === 'off' && on) return false;
  if (S.filter === 'nophoto' && (!on || S.photos[q.id])) return false;
  const words = norm(S.search).split(/\s+/).filter(Boolean);
  const hay = norm(`${nameOf(q)} ${q.name} ${q.kw || ''} ${q.text || ''}`);
  return words.every((w) => hay.includes(w));
}

function itemHtml(q) {
  const on = S.checked.has(q.id);
  const url = S.photos[q.id];
  const state = S.busy === q.id ? 'busy' : S.photoQueue.has(q.id) ? 'wait' : '';
  return `<div class="item ${on ? 'on' : ''}" data-item="${esc(q.id)}">
    <button class="tick" data-tick="${esc(q.id)}" aria-pressed="${on}"><span class="box"></span><span>${esc(nameOf(q))}${S.models[q.id] ? `<small class="mdl">${esc(S.models[q.id])}</small>` : ''}</span></button>
    ${S.plan.spots.length ? `<button class="zone ${spotOf(q.id) ? '' : 'none'}" data-zone="${esc(q.id)}" aria-label="Zone et nom : ${esc(nameOf(q))}">${spotOf(q.id) ? `📍${spotById(spotOf(q.id)).n}` : '📍?'}</button>` : ''}
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
      const all = S.equipment.filter((q) => (cid === '__other' ? !known.has(q.cat) : q.cat === cid) && (S.showAll || applicable(q)));
      const shown = all.filter(visible);
      if (searching && !shown.length) return '';
      const n = all.filter((q) => S.checked.has(q.id)).length;
      return `<section class="cat"><div class="cat-head"><h2>${esc(cname)}</h2><small>${n} / ${all.length}</small></div>
        <div class="items">${shown.map(itemHtml).join('')}${cid === '__other' || searching ? '' : `<button class="add" data-add="${esc(cid)}">＋ Ajouter un équipement dans « ${esc(cname)} »</button>`}</div></section>`;
    })
    .join('');
  const hiddenN = S.type ? S.equipment.filter((q) => !applicable(q)).length : 0;
  const typeName = S.types.find((t) => t.id === S.type)?.name;
  const head = S.type
    ? `<p class="type-note">Liste adaptée à un <strong>${esc(typeName || S.type)}</strong>${hiddenN ? ` : ${hiddenN} équipements d’autres types ${S.showAll ? 'affichés' : 'masqués'}. <button class="linkbtn" data-showall>${S.showAll ? 'Les masquer' : 'Les afficher'}</button>` : '.'}</p>`
    : '<p class="type-note warn">Indiquez le type de véhicule (van, profilé, capucine…) : la liste ne montrera que ses équipements. <button class="linkbtn" data-pick-type>Choisir le type</button></p>';
  list.innerHTML = head + (html || '<p class="empty">Aucun équipement ne correspond.</p>');
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
      <h2>${esc(q ? nameOf(q) : '')}</h2>
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

// Brands and models seen in the 2026-2027 catalogues and on the road: suggestions only, anything can be typed.
const MODEL_HINTS = {
  trumac: ['Truma Combi 4', 'Truma Combi 6', 'Truma Combi 4 E'],
  trumad: ['Truma Combi D 4', 'Truma Combi D 6'],
  webasto: ['Webasto Air Top 2000 STC', 'Eberspächer Airtronic D2', 'Autoterm Air 2D'],
  alde: ['Alde Compact 3030'],
  chauf: ['Truma Combi 4', 'Truma Combi D 4', 'Webasto Air Top 2000 STC'],
  cmd_chauf: ['Truma CP Plus', 'Truma iNet X'],
  wc: ['Thetford C223', 'Thetford C263', 'Dometic CTW 4110'],
  wcfixe: ['Trelino', 'Separett Villa', 'OGO'],
  frigo: ['Dometic CRX 80', 'Dometic CRX 140', 'Thetford T2090'],
  comp: ['Dometic CRX 80', 'Dometic CRX 140'],
  rechaud: ['Dometic', 'Can', 'Thetford'],
  four: ['Thetford Duplex', 'Dometic'],
  pompe: ['Shurflo Trail King', 'Fiamma Aqua 8', 'Reich'],
  solaire: ['2 × 100 W', '1 × 150 W', '2 × 120 W'],
  mppt: ['Victron SmartSolar 75/15', 'Votronic MPP 250'],
  b2b: ['Votronic VCC 1212-30', 'Victron Orion-Tr Smart 12/12-30', 'Schaudt WA 121545'],
  charg: ['Votronic VAC 1215', 'Schaudt EBL', 'Victron Blue Smart IP22'],
  cell: ['AGM 95 Ah', 'AGM 105 Ah'],
  agm: ['AGM 95 Ah', 'AGM 105 Ah'],
  lith: ['Lithium 120 Ah', 'Lithium 150 Ah', 'Lithium 200 Ah'],
  gest_energie: ['MEB-300 Smart Energy', 'Schaudt EBL', 'Victron Cerbo GX'],
  panneau: ['CBE PC380', 'Schaudt LT 453', 'Nordelettronica'],
  onduleur: ['Victron Phoenix 12/500', 'Votronic SMI 1200'],
  store: ['Thule Omnistore 6300', 'Fiamma F45', 'Fiamma F80S', 'Thule Omnistor 5200'],
  marche: ['Thule Slide-out Step', 'Fiamma'],
  lant: ['Fiamma Vent 40', 'Dometic Midi Heki', 'Dometic Mini Heki'],
  lant_lit: ['Fiamma Vent 28', 'Dometic Micro Heki'],
  heki: ['Dometic Midi Heki', 'Dometic Heki 2'],
  maxx: ['MaxxAir MaxxFan Deluxe', 'Fiamma Turbo Vent'],
  clim: ['Truma Aventa', 'Dometic FreshJet', 'Telair'],
  radio: ['Zenec Z-E3766', 'Ford SYNC 4', 'Pioneer'],
  gps: ['Garmin Camper', 'TomTom GO Camper', 'Zenec'],
  camera: ['Zenec', 'Waeco PerfectView', 'Ford'],
  sat: ['Teleco Flatsat', 'Oyster', 'Megasat'],
  tnt: ['Teleco', 'Fracarro'],
  tv: ['Alphatronics', 'Telefunken'],
  wifi: ['Alden Wifi', 'Teltonika', 'Tenda'],
  velos: ['Thule Elite Van XT', 'Fiamma Carry-Bike'],
  att: ['Westfalia', 'AL-KO'],
  verins: ['Goldschmitt', 'E&P Hydraulics'],
  air: ['Goldschmitt', 'VB-Airsuspension', 'Dunlop'],
  alarme: ['Thitronik WiPro III', 'Cobra'],
  traceur: ['Thitronik', 'Invoxia'],
  co: ['Thitronik CO-Melder'],
  gazdet: ['Thitronik G.A.S.-pro'],
  duo: ['Truma DuoControl', 'GOK'],
  gaslow: ['Gaslow', 'Alugas', 'Wynen'],
  filtre: ['BWT Bestcamp', 'Alde Aquastar'],
  pile_comb: ['EFOY Comfort 80', 'EFOY Comfort 150'],
  groupe: ['Honda EU22i', 'Telair Energy'],
  x4: ['Ford Transit AWD', 'Dangel'],
};

// Zone on the plan and name of one equipment, for this vehicle only.
function itemSheet(id) {
  const q = S.equipment.find((x) => x.id === id);
  if (!q) return;
  let chosen = spotOf(id);
  let reset = false;
  const dots = () =>
    S.plan.spots
      .map(
        (s) => `<g class="pdot ${s.id === chosen ? 'sel' : ''}" data-spot="${esc(s.id)}" transform="translate(${Number(s.x) || 0} ${Number(s.y) || 0})"><circle r="30" fill="transparent"/><circle class="d" r="24"/><text y="7">${esc(s.n)}</text></g>`
      )
      .join('');
  const zoneList = () =>
    S.plan.spots.map((s) => `<button type="button" class="zbtn ${s.id === chosen ? 'sel' : ''}" data-spot="${esc(s.id)}"><b>${esc(s.n)}</b> ${esc(s.name)}</button>`).join('') +
    `<button type="button" class="zbtn ${chosen ? '' : 'sel'}" data-spot=""><b>–</b> Pas de zone précise (emplacement variable)</button>`;
  dialog(
    `<form class="dlg" method="dialog">
      <h2>${esc(nameOf(q))}</h2>
      <label>Marque et modèle<input name="model" maxlength="80" list="model-hints" value="${esc(S.models[id] || '')}" placeholder="${esc(MODEL_HINTS[id]?.[0] ? `ex : ${MODEL_HINTS[id][0]}` : 'ex : marque et nom du modèle')}" autocomplete="off"><datalist id="model-hints">${(MODEL_HINTS[id] || []).map((m) => `<option value="${esc(m)}">`).join('')}</datalist><span class="hint">Déjà noté pour chaque client de ce véhicule : utile en magasin ou à l’atelier. Le client y ajoute son numéro de série.</span></label>
      <label>Nom sur ce véhicule<input name="label" maxlength="120" value="${esc(S.labels[id] || '')}" placeholder="${esc(q.name)}"><span class="hint">Laissez vide pour garder « ${esc(q.name)} ». Ex : préciser la taille, le modèle ou la position.</span></label>
      <div class="label-like">Zone sur le plan <span class="hint">Touchez le bon numéro.</span></div>
      <div class="plan-pick">${S.plan.planUrl ? `<img src="${esc(S.plan.planUrl)}" alt="">` : ''}<svg viewBox="0 0 800 360" id="pdots">${dots()}</svg></div>
      <div class="zlist" id="zlist">${zoneList()}</div>
      ${Object.prototype.hasOwnProperty.call(S.spotOverrides, id) ? '<button type="button" class="linkbtn" data-reset>Revenir à la zone par défaut</button>' : ''}
      <div class="stack"><button class="btn primary block" value="ok">Enregistrer</button><button class="btn block" value="" formnovalidate>Annuler</button></div>
    </form>`,
    (dlg, value) => {
      if (value !== 'ok') return;
      const fd = new FormData(dlg.querySelector('form'));
      const label = fd.get('label').trim();
      const model = fd.get('model').trim();
      if (model) S.models[id] = model;
      else delete S.models[id];
      if (label && label !== q.name) S.labels[id] = label;
      else delete S.labels[id];
      if (reset) delete S.spotOverrides[id];
      else if (chosen !== spotOf(id)) S.spotOverrides[id] = chosen || '';
      S.metaDirty = true;
      refreshItem(id);
      schedule(0);
    },
    { focus: false }
  );
  const dlg = document.querySelector('dialog[open]');
  const choose = (spot) => {
    chosen = spot || null;
    reset = false;
    dlg.querySelector('#pdots').innerHTML = dots();
    dlg.querySelector('#zlist').innerHTML = zoneList();
  };
  dlg.querySelector('form').addEventListener('click', (e) => {
    const t = e.target.closest('[data-spot]');
    if (t) choose(t.dataset.spot);
    if (e.target.closest('[data-reset]')) {
      chosen = S.defaultSpots[id] ?? null;
      dlg.querySelector('#pdots').innerHTML = dots();
      dlg.querySelector('#zlist').innerHTML = zoneList();
      reset = true;
      toast('Zone par défaut : enregistrez pour confirmer');
    }
  });
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

// ---------- Guided vehicle form: one question per screen, then the equipment survey ----------

const WEIGHTS = [
  ['ptac', 'PTAC (kg)', 'Poids total autorisé en charge, sur la carte grise (case F.2).', 3500],
  ['mom', 'Masse en ordre de marche (kg)', 'Poids à vide avec conducteur, carte grise case G.', 2800],
  ['pax', 'Nombre de passagers habituel', 'Valeur de départ du calcul de charge.', 2],
  ['eau', 'Eau propre au départ (L)', 'Litres d’eau propre que le client emporte en général.', 30],
  ['gaz', 'Gaz au départ (kg)', 'Laissez 0 si la masse en ordre de marche inclut déjà le gaz.', 0],
  ['bag', 'Bagages (kg)', 'Valeur de départ du calcul de charge.', 100],
];

// Accepts "2,90", "2.9" or "290" (cm) and returns metres.
function metres(value) {
  const n = Number(String(value || '').replace(',', '.').trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 20 ? Math.round(n) / 100 : n;
}
const numOrNull = (value) => {
  const n = Number(String(value ?? '').replace(',', '.').replace(/\s/g, ''));
  return String(value ?? '').trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};
const prefixOf = (text) => String(text || '').toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '').slice(0, 8);

async function openWizard(id, step = 0) {
  root.innerHTML = '<p class="pad muted">Chargement…</p>';
  const [brands, vehicles, profile, config] = await Promise.all([
    api('GET', '/api/admin/brands'),
    api('GET', '/api/admin/vehicles'),
    api('GET', `/api/admin/vehicles/${id}/profile`),
    api('GET', '/api/admin/catalog/config').then((r) => r.value || {}),
  ]);
  const v = vehicles.find((x) => x.id === id);
  if (!v) return renderVehicles();
  store.set(LAST_KEY, String(id));
  history.replaceState(null, '', `#v=${id}`);
  const layouts = await api('GET', '/api/admin/layouts');
  const W = { v, profile, brands, layouts, types: profile.types || [], variants: config.VARIANTS || {}, photo: v.photoUrl || null };
  showStep(W, step);
}

const STEPS = [
  {
    title: 'Le nom du véhicule',
    html: ({ v, profile, brands }) => {
      const brand = brands.find((b) => b.id === v.brandId)?.name || '';
      const short = profile.heroName && profile.heroName !== v.name ? profile.heroName : profile.heroName || v.name;
      return `<label>Marque<select name="brandId">${brands.map((b) => `<option value="${b.id}" ${b.id === v.brandId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
        <label>Nom du modèle<input name="name" required maxlength="120" value="${esc(v.name)}" placeholder="ex : V114 Road Edition"></label>
        <label>Millésime<input name="modelYear" maxlength="20" inputmode="numeric" value="${esc(v.modelYear || '')}" placeholder="ex : 2027"></label>
        <label>Nom court sur l’accueil de l’appli<input name="heroName" maxlength="60" value="${esc(short)}" placeholder="ex : V114"><span class="hint">Écrit en grand sur l’écran d’accueil du client.</span></label>
        <label>Mot avant le nom court<input name="heroPrefix" maxlength="30" value="${esc(profile.heroPrefix)}" placeholder="ex : Van, Profilé, Fourgon"></label>
        <label>Nom complet<input name="fullName" maxlength="120" value="${esc(profile.fullName && profile.fullName !== v.name ? profile.fullName : [brand, v.name, v.modelYear].filter(Boolean).join(' '))}" placeholder="ex : Challenger V114 Road Edition 2027"><span class="hint">Utilisé dans les textes et les demandes de rendez-vous.</span></label>`;
    },
    // The full name follows brand, model and year until it is typed by hand.
    bind: ({ v, profile, brands }, el) => {
      const full = el.querySelector('[name=fullName]');
      const hero = el.querySelector('[name=heroName]');
      const auto = () => [brands.find((b) => b.id === Number(el.querySelector('[name=brandId]').value))?.name, el.querySelector('[name=name]').value.trim(), el.querySelector('[name=modelYear]').value.trim()].filter(Boolean).join(' ');
      let fullAuto = !profile.fullName || profile.fullName === v.name || full.value === auto();
      let heroAuto = hero.value === v.name;
      full.oninput = () => (fullAuto = false);
      hero.oninput = () => (heroAuto = false);
      el.oninput = (e) => {
        if (fullAuto && e.target !== full) full.value = auto();
        if (heroAuto && e.target.name === 'name') hero.value = e.target.value;
      };
      el.querySelector('[name=brandId]').onchange = () => fullAuto && (full.value = auto());
    },
    save: async ({ v, profile }, f) => {
      const name = f.get('name').trim();
      if (!name) throw new Error('Le nom du modèle est obligatoire');
      const heroName = f.get('heroName').trim() || name;
      await api('PUT', `/api/admin/vehicles/${v.id}`, { brandId: Number(f.get('brandId')), name, modelYear: f.get('modelYear') });
      await api('PUT', `/api/admin/vehicles/${v.id}/profile`, {
        heroName,
        heroPrefix: f.get('heroPrefix'),
        fullName: f.get('fullName').trim() || name,
        // Customer access codes start with this (ex : V114-ABCD-EFGH); keep one already chosen.
        codePrefix: profile.codePrefix && profile.codePrefix !== 'CDB' ? profile.codePrefix : prefixOf(heroName) || 'CDB',
      });
    },
  },
  {
    title: 'Le type de véhicule',
    html: ({ profile, types }) => `<p class="muted" style="margin:0">La liste des équipements et le plan vu du dessus s’adaptent au type.</p>
      <div class="types">${types
        .map(
          (t) => `<label class="type-card"><input type="radio" name="type" value="${esc(t.id)}" ${profile.type === t.id ? 'checked' : ''}>
          <img src="/app/plans/${esc(t.id)}.svg" alt=""><span><strong>${esc(t.name)}</strong><small>${esc(t.hint)}</small></span></label>`
        )
        .join('')}</div>`,
    save: async (W, f) => {
      const { v, profile } = W;
      const type = f.get('type') || '';
      if (!type) throw new Error('Choisissez le type de véhicule (ou passez cette étape)');
      if (profile.type !== type) {
        profile.layout = '';
        W.match = null;
        W.layoutPick = null;
      }
      profile.type = type;
      await api('PUT', `/api/admin/vehicles/${v.id}/profile`, { type, ...(profile.layout ? {} : { layout: '' }) });
    },
  },
  {
    title: 'Ce qu’il y a dedans',
    html: (W) => {
      const { profile } = W;
      const m = W.match;
      const pick = W.layoutPick ?? profile.layout ?? m?.results[0]?.id ?? '';
      const cards = (list) =>
        list
          .map(
            (L) => `<label class="layout-card"><input type="radio" name="layout" value="${esc(L.id)}" ${pick === L.id ? 'checked' : ''}>
            <img src="${esc(L.planUrl)}" alt=""><span><strong>${esc(L.name)}</strong><small>${esc(L.desc)}</small>
            ${L.matched?.length ? `<small class="ok-l">✓ ${esc(L.matched.join(' · '))}</small>` : ''}${L.missing?.length ? `<small class="ko-l">✗ ${esc(L.missing.join(' · '))}</small>` : ''}</span></label>`
          )
          .join('');
      return `<p class="muted" style="margin:0">Décrivez l’intérieur en quelques mots, ou donnez le modèle (V114, R602, Kilig 669…) : l’appli trouve le bon plan et coche ce que vous citez.</p>
        <label>En quelques mots<textarea name="words" rows="2" placeholder="ex : penderie arrière, lit pavillon, cuisine et table — ou : Kilig 669">${esc(W.words || '')}</textarea></label>
        <button type="button" class="btn block" data-find>🔎 Trouver le plan</button>
        ${
          m
            ? `${m.understood.length ? `<p class="muted" style="margin:0">Compris : <strong>${esc(m.understood.join(', '))}</strong>${m.refused.length ? ` · sans ${esc(m.refused.join(', '))}` : ''}</p>` : '<p class="muted" style="margin:0">Je n’ai reconnu aucun mot : choisissez le plan dans la liste.</p>'}
              <div class="layouts">${cards(m.results)}</div>
              ${
                m.equipment.length
                  ? `<fieldset class="choice"><legend>Je coche aussi</legend>${m.equipment
                      .map((q) => `<label class="opt"><input type="checkbox" name="eq" value="${esc(q.id)}" checked><span>${esc(q.name)}</span></label>`)
                      .join('')}</fieldset>`
                  : ''
              }`
            : `<div class="layouts">${cards(W.layouts.filter((L) => !profile.type || L.type === profile.type))}</div>`
        }`;
    },
    bind: (W, el) => {
      // A catalogue model in the vehicle's name (« C256 », « Kilig 669 »…) finds its plan straight away.
      if (!W.match && !W.autoTried) {
        W.autoTried = true;
        api('POST', '/api/admin/layouts/match', { text: `${W.v.brandName} ${W.v.name} ${W.profile.fullName || ''}`, type: W.profile.type || null })
          .then((r) => {
            if (!r.model || W.step !== STEPS.findIndex((x) => x.title === 'Ce qu’il y a dedans')) return;
            W.match = r;
            W.words = `${r.model.brand} ${r.model.model}`;
            W.layoutPick = r.results[0]?.id;
            showStep(W, W.step);
          })
          .catch(() => {});
      }
      el.querySelector('[data-find]').onclick = async () => {
        W.words = el.querySelector('[name=words]').value;
        try {
          W.match = await api('POST', '/api/admin/layouts/match', { text: W.words, type: W.profile.type || null });
          W.layoutPick = W.match.results[0]?.id;
          showStep(W, W.step);
        } catch (err) {
          toast(err.message, 'error');
        }
      };
      el.querySelectorAll('[name=layout]').forEach((r) => (r.onchange = () => (W.layoutPick = r.value)));
      el.querySelector('[name=words]').onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          el.querySelector('[data-find]').click();
        }
      };
    },
    save: async (W, f) => {
      const layout = f.get('layout');
      if (!layout) throw new Error('Choisissez un plan (ou passez cette étape)');
      const add = f.getAll('eq');
      const body = { layout };
      if (add.length) body.equipment = [...new Set([...(W.profile.equipment || []), ...add])];
      W.profile = await api('PUT', `/api/admin/vehicles/${W.v.id}/profile`, body).then((p) => ({ ...W.profile, ...p }));
      if (add.length) toast(`${add.length} équipement${add.length > 1 ? 's' : ''} coché${add.length > 1 ? 's' : ''}`);
    },
  },
  {
    title: 'La photo du véhicule',
    html: ({ photo }) => `<p class="muted" style="margin:0">Une vue d’ensemble, de trois-quarts avant de préférence. C’est la grande photo de l’accueil de l’appli.</p>
      <button type="button" class="hero-shot ${photo ? 'has' : ''}" data-hero>${photo ? `<img src="${esc(photo)}" alt="">` : '<span>📷<br>Prendre la photo</span>'}</button>
      ${photo ? '<div class="row2"><button type="button" class="btn" data-hero>📷 Reprendre</button><button type="button" class="btn" data-hero-gallery>🖼️ Galerie</button></div>' : '<button type="button" class="btn" data-hero-gallery>🖼️ Choisir dans la galerie</button>'}`,
    bind: (W, el) => {
      const pick = async (camera) => {
        const img = await takePhoto(camera);
        if (!img) return;
        W.newPhoto = img;
        W.photo = img;
        showStep(W, W.step);
      };
      el.querySelectorAll('[data-hero]').forEach((b) => (b.onclick = () => pick(true)));
      el.querySelectorAll('[data-hero-gallery]').forEach((b) => (b.onclick = () => pick(false)));
    },
    save: async (W) => {
      if (!W.newPhoto) return;
      const res = await api('PUT', `/api/admin/vehicles/${W.v.id}`, { photo: W.newPhoto });
      W.newPhoto = null;
      W.photo = res.photoUrl;
      W.v.photoUrl = res.photoUrl;
    },
  },
  {
    title: 'Les dimensions',
    html: ({ profile }) => `<label>Hauteur (m)<input name="h" inputmode="decimal" value="${profile.model.h || ''}" placeholder="ex : 2,90"><span class="hint">Hauteur totale, sans les équipements de toit (l’appli les ajoute). Sert pour les ponts et les parkings.</span></label>
      <label>Longueur (m)<input name="l" inputmode="decimal" value="${profile.model.l || ''}" placeholder="ex : 5,99"><span class="hint">Sans attelage ni porte-vélos (l’appli les ajoute).</span></label>`,
    save: async ({ v, profile }, f) => {
      const h = metres(f.get('h'));
      const l = metres(f.get('l'));
      if (f.get('h') && !h) throw new Error('Hauteur invalide');
      if (f.get('l') && !l) throw new Error('Longueur invalide');
      if (h && h > 5) throw new Error('Hauteur invalide : indiquez-la en mètres (ex : 2,90)');
      if (l && l > 15) throw new Error('Longueur invalide : indiquez-la en mètres (ex : 5,99)');
      profile.model = { l: l || 0, h: h || 0 };
      await api('PUT', `/api/admin/vehicles/${v.id}/profile`, { model: profile.model });
    },
  },
  {
    title: 'Les poids',
    html: ({ profile }) =>
      WEIGHTS.map(
        ([k, label, hint]) => `<label>${esc(label)}<input name="${k}" inputmode="numeric" value="${esc(profile.weights[k] ?? '')}"><span class="hint">${esc(hint)}</span></label>`
      ).join(''),
    save: async ({ v, profile }, f) => {
      const weights = {};
      for (const [k, label] of WEIGHTS) {
        const n = numOrNull(f.get(k));
        if (n === null) throw new Error(`${label} : nombre attendu`);
        weights[k] = n;
      }
      if (weights.mom >= weights.ptac) throw new Error('La masse en ordre de marche doit être inférieure au PTAC');
      profile.weights = weights;
      await api('PUT', `/api/admin/vehicles/${v.id}/profile`, { weights });
    },
  },
  {
    title: 'Les types d’équipements',
    html: ({ profile, variants }) =>
      `<p class="muted" style="margin:0">L’appli adapte ses explications et ses dépannages à ces réponses. Le client peut les corriger ensuite.</p>` +
      Object.entries(variants)
        .map(
          ([k, V]) => `<fieldset class="choice"><legend>${esc(V.q)}</legend>${[...V.o.filter((o) => o[0] !== 'ns'), ['', 'Je ne sais pas / à préciser par le client']]
            .map((o) => `<label class="opt"><input type="radio" name="var_${esc(k)}" value="${esc(o[0])}" ${(profile.vars[k] || '') === o[0] ? 'checked' : ''}><span>${esc(o[1])}</span></label>`)
            .join('')}</fieldset>`
        )
        .join(''),
    save: async ({ v, profile, variants }, f) => {
      const vars = {};
      for (const k of Object.keys(variants)) if (f.get(`var_${k}`)) vars[k] = f.get(`var_${k}`);
      profile.vars = vars;
      await api('PUT', `/api/admin/vehicles/${v.id}/profile`, { vars });
    },
  },
  {
    title: 'C’est prêt',
    html: (W) => { const { v, profile, photo, variants } = W; return `<div class="recap">
        ${photo ? `<img src="${esc(photo)}" alt="">` : '<p class="error" style="margin:0">Pas de photo du véhicule.</p>'}
        <dl>
          <div><dt>Nom complet</dt><dd>${esc(profile.fullName || v.name)}</dd></div>
          <div><dt>Type</dt><dd>${esc(W.types.find((t) => t.id === profile.type)?.name || '—')}</dd></div>
          <div><dt>Plan</dt><dd>${esc(W.layouts.find((L) => L.id === profile.layout)?.name || '—')}</dd></div>
          <div><dt>Accueil de l’appli</dt><dd>${esc(profile.heroPrefix)} <strong>${esc(profile.heroName)}</strong></dd></div>
          <div><dt>Hauteur · longueur</dt><dd>${profile.model.h ? `${Number(profile.model.h).toFixed(2).replace('.', ',')} m` : '—'} · ${profile.model.l ? `${Number(profile.model.l).toFixed(2).replace('.', ',')} m` : '—'}</dd></div>
          <div><dt>PTAC · ordre de marche</dt><dd>${esc(profile.weights.ptac)} kg · ${esc(profile.weights.mom)} kg</dd></div>
          <div><dt>Types renseignés</dt><dd>${Object.keys(profile.vars).length} sur ${Object.keys(variants).length}</dd></div>
          <div><dt>Codes clients</dt><dd>${esc(profile.codePrefix)}-XXXX-XXXX</dd></div>
        </dl>
      </div>
      <p class="muted" style="margin:0">Étape suivante : cochez les équipements présents et photographiez-les.</p>`; },
  },
];

function showStep(W, step) {
  W.step = Math.max(0, Math.min(step, STEPS.length - 1));
  document.getElementById('toast')?.classList.remove('show');
  const S0 = STEPS[W.step];
  const last = W.step === STEPS.length - 1;
  root.innerHTML = `<div class="bar"><div class="bar-row"><button id="wback" aria-label="Retour">‹</button>
      <h1>${esc(W.v.brandName)} ${esc(W.v.name)}<small>Fiche du véhicule · étape ${W.step + 1} sur ${STEPS.length}</small></h1></div>
      <div class="progress"><span style="width:${((W.step + 1) / STEPS.length) * 100}%"></span></div></div>
    <form class="wrap stack" id="wiz" novalidate>
      <h2 class="step-title">${esc(S0.title)}</h2>
      ${S0.html(W)}
      <div class="wiz-nav">
        ${W.step ? '<button type="button" class="btn" data-prev>Précédent</button>' : ''}
        <button class="btn primary">${last ? 'Commencer le relevé des équipements' : 'Suivant'}</button>
      </div>
      ${last ? '' : '<button type="button" class="linkbtn" data-skip>Passer cette étape</button>'}
    </form>`;
  const form = root.querySelector('#wiz');
  S0.bind?.(W, form);
  root.querySelector('#wback').onclick = () => (W.step ? showStep(W, W.step - 1) : renderVehicles());
  form.querySelector('[data-prev]')?.addEventListener('click', () => showStep(W, W.step - 1));
  form.querySelector('[data-skip]')?.addEventListener('click', () => showStep(W, W.step + 1));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.wiz-nav .primary');
    btn.disabled = true;
    try {
      await S0.save?.(W, new FormData(form));
      if (last) return openVehicle(W.v.id, true);
      if (W.step === 0) {
        // Names may have changed: reload them for the title and the recap.
        const [vehicles, profile] = await Promise.all([api('GET', '/api/admin/vehicles'), api('GET', `/api/admin/vehicles/${W.v.id}/profile`)]);
        W.v = vehicles.find((x) => x.id === W.v.id) || W.v;
        W.profile = profile;
      }
      showStep(W, W.step + 1);
      window.scrollTo(0, 0);
    } catch (err) {
      btn.disabled = false;
      toast(err.message, 'error');
    }
  });
  form.querySelector('input:not([type=radio])')?.focus({ preventScroll: true });
}

// ---------- Saving (one request at a time, retried when the network comes back) ----------

let timer;
function schedule(delay = 700) {
  S.failed = false;
  clearTimeout(timer);
  timer = setTimeout(flush, delay);
  renderPending();
}

const hasPending = () => S.listDirty || S.metaDirty || S.photoQueue.size > 0 || !!S.busy;

async function flush() {
  if (S.busy || !S.vehicle) return;
  const vid = S.vehicle.id;
  try {
    while (S.photoQueue.size || S.listDirty || S.metaDirty) {
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
      } else if (S.metaDirty) {
        S.busy = '__meta';
        S.metaDirty = false;
        renderPending();
        try {
          await api('PUT', `/api/admin/vehicles/${vid}/profile`, { labels: S.labels, spotOverrides: S.spotOverrides, models: S.models });
        } catch (err) {
          S.metaDirty = true;
          throw err;
        }
        S.busy = null;
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
    if (id && !id.startsWith('__')) refreshItem(id);
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
  const n = S.photoQueue.size + (S.listDirty ? 1 : 0) + (S.metaDirty ? 1 : 0);
  if (!n && !S.busy) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.classList.toggle('saving', !S.failed);
  const photos = S.photoQueue.size;
  const what = [photos ? `${photos} photo${photos > 1 ? 's' : ''}` : '', S.listDirty || S.busy === '__list' ? 'la liste cochée' : '', S.metaDirty || S.busy === '__meta' ? 'les zones et noms' : ''].filter(Boolean).join(' et ') || 'les modifications';
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

function dialog(html, onClose, { focus = true } = {}) {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = html;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => {
    const value = dlg.returnValue;
    Promise.resolve(onClose(dlg, value)).finally(() => dlg.remove());
  });
  dlg.showModal();
  if (focus) dlg.querySelector('input')?.focus();
  else dlg.querySelector('h2')?.setAttribute('tabindex', '-1'), dlg.querySelector('h2')?.focus();
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
  if (me.role !== 'admin' && me.role !== 'editor') {
    root.innerHTML = `<div class="login"><div class="card stack"><h1>Réservé à l’administrateur et à l’éditeur de contenu</h1>
      <p class="muted" style="margin:0">Le relevé (équipements et photos des modèles) se fait avec un compte administrateur ou éditeur de contenu. La concession ajuste ensuite les équipements de chaque client lors de la mise en main.</p>
      <button class="btn primary block" id="switch">Se connecter avec un autre compte</button>
      <a class="btn block" href="/admin/">Retour au back-office</a></div></div>`;
    root.querySelector('#switch').onclick = () => {
      token = null;
      store.set(TOKEN_KEY, null);
      store.set(LAST_KEY, null);
      renderLogin();
    };
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
