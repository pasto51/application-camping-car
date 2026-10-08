import { esc, multiline, formatDate, createApi, pickImage, toast, formData } from '/shared/common.js';

const STORE_KEY = 'cc-app-v1';
const SEVERITY = { info: 'Info', attention: 'Attention', urgent: 'Urgent' };
const STATUS = { nouveau: 'Envoyé', en_cours: 'En cours de traitement', resolu: 'Résolu' };

// ---------- State & storage ----------

const state = {
  token: null,
  profile: null, // last /api/me response, also kept offline
  screen: 'welcome', // welcome | handover | restore | main
  tab: 'vehicle', // vehicle | help | photos | reports | profile
  view: null, // sub-view inside a tab, e.g. { name: 'problem', id }
  handover: null, // { mode: 'new' | 'change', step, code, dealership, catalog, brandId, vehicleId, recoveryCode }
  search: '',
  category: '',
  busy: false,
  online: navigator.onLine,
  updateReady: null,
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    state.token = saved.token || null;
    state.profile = saved.profile || null;
  } catch {
    /* storage unavailable: start fresh */
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ token: state.token, profile: state.profile }));
  } catch {
    /* quota or private mode: data stays in the cloud anyway */
  }
}

function signOutLocal() {
  state.token = null;
  state.profile = null;
  state.screen = 'welcome';
  state.view = null;
  save();
}

const api = createApi(
  () => state.token,
  () => {
    if (state.token) {
      signOutLocal();
      toast('Session expirée : récupérez votre compte avec votre code', 'error');
      render();
    }
  }
);

function setProfile(data) {
  const { token, recoveryCode, ...profile } = data;
  if (token) state.token = token;
  state.profile = profile;
  save();
}

async function refreshProfile({ quiet = true } = {}) {
  if (!state.token) return;
  try {
    setProfile(await api('GET', '/api/me'));
    render();
  } catch (err) {
    if (!quiet && err.status !== 401) toast(err.message, 'error');
  }
}

async function run(fn) {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    await fn();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    state.busy = false;
    render();
  }
}

// ---------- Rendering ----------

const root = document.getElementById('app');

function render() {
  const accent = state.profile?.vehicle?.brandColor;
  document.documentElement.style.setProperty('--accent', accent || '#1d3557');
  let html = '';
  if (state.screen === 'handover') html = renderHandover();
  else if (state.screen === 'restore') html = renderRestore();
  else if (state.screen === 'main' && state.profile) html = renderMain();
  else html = renderWelcome();
  root.innerHTML = banners() + html;
}

function banners() {
  let out = '';
  if (!state.online) out += '<div class="banner offline">Hors connexion : affichage des données enregistrées sur le téléphone.</div>';
  if (state.updateReady) out += '<div class="banner update">Nouvelle version disponible <button data-action="apply-update">Mettre à jour</button></div>';
  return out;
}

function header(title, back) {
  return `<header class="topbar">
    ${back ? `<button class="icon-btn" data-action="${back}" aria-label="Retour">←</button>` : '<span class="icon-btn"></span>'}
    <h1>${esc(title)}</h1>
    <span class="icon-btn"></span>
  </header>`;
}

function busyAttr() {
  return state.busy ? 'disabled' : '';
}

// ---------- Welcome / restore ----------

function renderWelcome() {
  return `<main class="welcome">
    <img src="/app/icon.svg" alt="" class="welcome-logo">
    <h1>Mon Camping-Car</h1>
    <p class="muted">Votre véhicule, ses fiches de dépannage et votre concession, toujours avec vous.</p>
    <div class="stack">
      <button class="btn primary big" data-action="start-handover">Mise en main par la concession</button>
      <button class="btn big" data-action="go-restore">J'ai déjà un compte (nouveau téléphone)</button>
    </div>
    <p class="hint">La mise en main est réalisée avec votre concessionnaire, qui saisit son code concession puis choisit votre véhicule.</p>
  </main>`;
}

function renderRestore() {
  return `${header('Récupérer mon compte', 'go-welcome')}
  <main class="page">
    <form class="card form" data-form="restore">
      <p class="muted">Saisissez votre nom et le code de récupération remis lors de la mise en main.</p>
      <label>Nom<input name="lastName" required autocomplete="family-name"></label>
      <label>Code de récupération<input name="recoveryCode" required autocapitalize="characters" autocomplete="off" class="code-input" placeholder="XXXXXXXX"></label>
      <button class="btn primary" ${busyAttr()}>Récupérer mes données</button>
    </form>
    <p class="hint">Code perdu ? Votre concession peut vous en générer un nouveau depuis son back-office.</p>
  </main>`;
}

// ---------- Handover (mise en main) ----------

function handoverSteps(h) {
  const steps = ['code', 'brand', 'vehicle', ...(h.mode === 'new' ? ['customer'] : [])];
  const i = steps.indexOf(h.step);
  return `<ol class="steps">${steps
    .map((s, n) => `<li class="${n < i ? 'done' : n === i ? 'current' : ''}">${{ code: 'Concession', brand: 'Marque', vehicle: 'Véhicule', customer: 'Client' }[s]}</li>`)
    .join('')}</ol>`;
}

function renderHandover() {
  const h = state.handover;
  const backAction = h.step === 'code' || h.step === 'done' ? (h.mode === 'new' ? 'go-welcome' : 'cancel-change') : 'handover-back';
  const title = h.mode === 'new' ? 'Mise en main' : 'Changer de véhicule';
  if (h.step === 'done') return renderHandoverDone();
  let body = '';

  if (h.step === 'code') {
    body = `<form class="card form" data-form="handover-code">
      <p class="muted">Étape réservée à la concession : saisissez votre code concession.</p>
      <label>Code concession<input name="code" required autocapitalize="characters" autocomplete="off" class="code-input" value="${esc(h.code || '')}" placeholder="EX : CONC2026"></label>
      <button class="btn primary" ${busyAttr()}>Valider</button>
    </form>`;
  }

  if (h.step === 'brand') {
    body = `<p class="section-title">Choisissez la marque</p>
      <div class="grid brands">${h.catalog.brands
        .filter((b) => h.catalog.vehicles.some((v) => v.brandId === b.id))
        .map(
          (b) => `<button class="choice brand" data-action="pick-brand" data-id="${b.id}" style="--brand:${esc(b.color || '#1d3557')}">
            ${b.logoUrl ? `<img src="${esc(b.logoUrl)}" alt="">` : `<span class="brand-initial">${esc(b.name[0])}</span>`}
            <strong>${esc(b.name)}</strong>
          </button>`
        )
        .join('')}</div>`;
  }

  if (h.step === 'vehicle') {
    const brand = h.catalog.brands.find((b) => b.id === h.brandId);
    const vehicles = h.catalog.vehicles.filter((v) => v.brandId === h.brandId);
    body = `<p class="section-title">Choisissez le véhicule ${esc(brand?.name || '')}</p>
      <div class="list">${vehicles
        .map(
          (v) => `<button class="choice vehicle" data-action="pick-vehicle" data-id="${v.id}">
            ${v.photoUrl ? `<img src="${esc(v.photoUrl)}" alt="">` : '<span class="ph">🚐</span>'}
            <span><strong>${esc(v.name)}</strong>${v.modelYear ? `<small>${esc(v.modelYear)}</small>` : ''}</span>
          </button>`
        )
        .join('')}</div>`;
  }

  if (h.step === 'customer') {
    const v = h.catalog.vehicles.find((x) => x.id === h.vehicleId);
    body = `<form class="card form" data-form="handover-customer">
      <p class="selected">🚐 <strong>${esc(v?.name || '')}</strong></p>
      <div class="row2">
        <label>Prénom<input name="firstName" autocomplete="given-name"></label>
        <label>Nom *<input name="lastName" required autocomplete="family-name"></label>
      </div>
      <label>E-mail<input name="email" type="email" autocomplete="email"></label>
      <label>Téléphone<input name="phone" type="tel" autocomplete="tel"></label>
      <div class="row2">
        <label>Immatriculation<input name="plate" autocapitalize="characters"></label>
        <label>Date de mise en main<input name="handoverDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
      </div>
      <label>N° de série (VIN)<input name="vin" autocapitalize="characters"></label>
      <button class="btn primary" ${busyAttr()}>Terminer la mise en main</button>
    </form>`;
  }

  return `${header(title, backAction)}
  <main class="page">
    ${handoverSteps(h)}
    ${h.dealership ? `<p class="dealer-chip">🏢 ${esc(h.dealership.name)}${h.dealership.city ? ` · ${esc(h.dealership.city)}` : ''}</p>` : ''}
    ${body}
  </main>`;
}

function renderHandoverDone() {
  const h = state.handover;
  return `${header('Mise en main terminée')}
  <main class="page">
    <div class="card center">
      <p class="big-emoji">✅</p>
      <h2>Bienvenue à bord !</h2>
      <p>Le véhicule est enregistré. Notez ce <strong>code de récupération</strong> : il permet de retrouver vos données sur un autre téléphone.</p>
      <p class="recovery">${esc(h.recoveryCode)}</p>
      <button class="btn" data-action="copy-code">Copier le code</button>
      <button class="btn primary" data-action="finish-handover">Accéder à mon camping-car</button>
    </div>
  </main>`;
}

async function startHandover(mode) {
  state.handover = { mode, step: 'code' };
  state.screen = 'handover';
  render();
}

// ---------- Main app ----------

function renderMain() {
  const p = state.profile;
  const v = state.view;
  let content = '';
  if (state.tab === 'vehicle') content = renderVehicle(p);
  if (state.tab === 'help') content = v?.name === 'problem' ? renderProblem(p, v.id) : renderHelp(p);
  if (state.tab === 'photos') content = v?.name === 'photo' ? renderPhoto(p, v.id) : renderPhotos(p);
  if (state.tab === 'reports') content = v?.name === 'new-report' ? renderNewReport(p, v.problemId) : renderReports(p);
  if (state.tab === 'profile') content = v?.name === 'edit-profile' ? renderEditProfile(p) : renderProfile(p);
  const tabs = [
    ['vehicle', '🚐', 'Véhicule'],
    ['help', '🛠️', 'Dépannage'],
    ['photos', '📷', 'Photos'],
    ['reports', '💬', 'Signaler'],
    ['profile', '👤', 'Profil'],
  ];
  const openReports = p.reports.filter((r) => r.status !== 'resolu').length;
  return `${content}
  <nav class="tabbar">${tabs
    .map(
      ([id, icon, label]) => `<button class="${state.tab === id ? 'active' : ''}" data-action="tab" data-tab="${id}">
        <span class="tab-icon">${icon}${id === 'reports' && openReports ? `<i class="dot">${openReports}</i>` : ''}</span>${label}
      </button>`
    )
    .join('')}</nav>`;
}

function renderVehicle(p) {
  const v = p.vehicle || {};
  const c = p.customer;
  const photo = c.coverPhotoUrl || v.photoUrl;
  return `${header(v.name || 'Mon véhicule')}
  <main class="page">
    ${p.announcement ? `<div class="card announce">📣 ${multiline(p.announcement)}</div>` : ''}
    <div class="hero">
      ${photo ? `<img src="${esc(photo)}" alt="Photo du véhicule">` : '<div class="hero-ph">🚐</div>'}
      <button class="btn small floating" data-action="change-cover">${c.coverPhotoUrl ? 'Changer la photo' : 'Mettre ma photo'}</button>
    </div>
    <div class="card">
      <p class="brand-tag">${esc(v.brandName || '')}</p>
      <h2>${esc(v.name || '')}${v.modelYear ? ` <small>${esc(v.modelYear)}</small>` : ''}</h2>
      <dl class="facts">
        ${c.plate ? `<div><dt>Immatriculation</dt><dd>${esc(c.plate)}</dd></div>` : ''}
        ${c.handoverDate ? `<div><dt>Mise en main</dt><dd>${formatDate(c.handoverDate)}</dd></div>` : ''}
        ${c.vin ? `<div><dt>VIN</dt><dd>${esc(c.vin)}</dd></div>` : ''}
      </dl>
      ${v.description ? `<p>${multiline(v.description)}</p>` : ''}
    </div>
    ${
      v.specs?.length
        ? `<div class="card"><h3>Caractéristiques</h3><dl class="specs">${v.specs.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl></div>`
        : ''
    }
    ${renderDealerCard(p.dealership)}
  </main>`;
}

function renderDealerCard(d) {
  if (!d) return '';
  return `<div class="card dealer">
    <h3>Ma concession</h3>
    <p><strong>${esc(d.name)}</strong>${d.city ? `<br><span class="muted">${esc(d.city)}</span>` : ''}</p>
    <div class="actions">
      ${d.phone ? `<a class="btn" href="tel:${esc(d.phone.replace(/\s/g, ''))}">📞 Appeler</a>` : ''}
      ${d.email ? `<a class="btn" href="mailto:${esc(d.email)}">✉️ E-mail</a>` : ''}
      <button class="btn" data-action="new-report">💬 Signaler un problème</button>
    </div>
  </div>`;
}

function renderHelp(p) {
  const categories = [...new Set(p.problems.map((x) => x.category))];
  const q = state.search.trim().toLowerCase();
  const list = p.problems.filter(
    (x) =>
      (!state.category || x.category === state.category) &&
      (!q || [x.title, x.symptoms, x.solution, x.category].some((t) => (t || '').toLowerCase().includes(q)))
  );
  const noted = new Set(p.notes.map((n) => n.problemId));
  return `${header('Dépannage')}
  <main class="page">
    <input class="search" type="search" placeholder="Rechercher un problème…" data-input="search" value="${esc(state.search)}">
    <div class="chips">
      <button class="chip ${!state.category ? 'active' : ''}" data-action="category" data-value="">Tout</button>
      ${categories.map((c) => `<button class="chip ${state.category === c ? 'active' : ''}" data-action="category" data-value="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <div class="list">${
      list.length
        ? list
            .map(
              (x) => `<button class="item" data-action="open-problem" data-id="${x.id}">
              <span class="sev ${esc(x.severity)}" title="${esc(SEVERITY[x.severity] || '')}"></span>
              <span class="item-main"><strong>${esc(x.title)}</strong><small>${esc(x.category)}${noted.has(x.id) ? ' · 📝 note perso' : ''}</small></span>
              <span class="chev">›</span>
            </button>`
            )
            .join('')
        : '<p class="empty">Aucune fiche ne correspond. Vous pouvez signaler le problème à votre concession.</p>'
    }</div>
    <button class="btn wide" data-action="new-report">💬 Je ne trouve pas : signaler à ma concession</button>
  </main>`;
}

function renderProblem(p, id) {
  const x = p.problems.find((pb) => pb.id === id);
  if (!x) return renderHelp(p);
  const note = p.notes.find((n) => n.problemId === id);
  return `${header(x.category, 'close-view')}
  <main class="page">
    <div class="card">
      <span class="badge sev-${esc(x.severity)}">${esc(SEVERITY[x.severity] || x.severity)}</span>
      <h2>${esc(x.title)}</h2>
      ${x.photoUrl ? `<img class="content-img" src="${esc(x.photoUrl)}" alt="">` : ''}
      ${x.symptoms ? `<h3>Symptômes</h3><p>${multiline(x.symptoms)}</p>` : ''}
      ${x.solution ? `<h3>Que faire ?</h3><p>${multiline(x.solution)}</p>` : ''}
    </div>
    <form class="card form" data-form="note" data-id="${x.id}">
      <h3>📝 Ma note personnelle</h3>
      <textarea name="note" rows="3" placeholder="Ex : sur mon véhicule, le fusible est derrière le siège passager…">${esc(note?.note || '')}</textarea>
      <button class="btn" ${busyAttr()}>Enregistrer la note</button>
    </form>
    <button class="btn primary wide" data-action="new-report" data-problem="${x.id}">Le problème persiste : prévenir ma concession</button>
  </main>`;
}

function renderPhotos(p) {
  return `${header('Mes photos')}
  <main class="page">
    <div class="actions">
      <button class="btn primary" data-action="add-photo" data-capture="1" ${busyAttr()}>📷 Prendre une photo</button>
      <button class="btn" data-action="add-photo" ${busyAttr()}>🖼️ Depuis la galerie</button>
    </div>
    ${
      p.photos.length
        ? `<div class="gallery">${p.photos
            .map((ph) => `<button class="thumb" data-action="open-photo" data-id="${ph.id}"><img src="${esc(ph.url)}" alt="${esc(ph.caption || '')}" loading="lazy">${ph.caption ? `<span>${esc(ph.caption)}</span>` : ''}</button>`)
            .join('')}</div>`
        : '<p class="empty">Gardez ici les photos utiles : compteur, emplacement des fusibles, rayures à la livraison… Elles sont sauvegardées dans le cloud.</p>'
    }
  </main>`;
}

function renderPhoto(p, id) {
  const ph = p.photos.find((x) => x.id === id);
  if (!ph) return renderPhotos(p);
  return `${header('Photo', 'close-view')}
  <main class="page">
    <img class="content-img" src="${esc(ph.url)}" alt="">
    <p class="muted center">Ajoutée le ${formatDate(ph.createdAt)}</p>
    <form class="card form" data-form="photo" data-id="${ph.id}">
      <label>Légende<input name="caption" value="${esc(ph.caption || '')}" maxlength="200"></label>
      <button class="btn" ${busyAttr()}>Enregistrer</button>
    </form>
    <div class="actions">
      <button class="btn" data-action="replace-photo" data-id="${ph.id}" ${busyAttr()}>🔄 Remplacer la photo</button>
      <button class="btn danger" data-action="delete-photo" data-id="${ph.id}" ${busyAttr()}>🗑️ Supprimer</button>
    </div>
  </main>`;
}

function renderReports(p) {
  return `${header('Mes signalements')}
  <main class="page">
    <button class="btn primary wide" data-action="new-report">＋ Nouveau signalement</button>
    ${
      p.reports.length
        ? p.reports
            .map(
              (r) => `<div class="card report">
            <div class="report-head"><strong>${esc(r.title)}</strong><span class="status ${esc(r.status)}">${esc(STATUS[r.status] || r.status)}</span></div>
            <small class="muted">${formatDate(r.createdAt)}</small>
            ${r.description ? `<p>${multiline(r.description)}</p>` : ''}
            ${r.photos?.length ? `<div class="mini-gallery">${r.photos.map((u) => `<img src="${esc(u)}" alt="">`).join('')}</div>` : ''}
            ${r.dealerReply ? `<div class="reply"><strong>Réponse de la concession</strong><p>${multiline(r.dealerReply)}</p></div>` : ''}
          </div>`
            )
            .join('')
        : '<p class="empty">Aucun signalement pour le moment.</p>'
    }
  </main>`;
}

function renderNewReport(p, problemId) {
  const problem = p.problems.find((x) => x.id === problemId);
  const photos = state.view.photos || [];
  return `${header('Nouveau signalement', 'close-view')}
  <main class="page">
    <form class="card form" data-form="report">
      <label>Objet *<input name="title" required maxlength="150" value="${esc(state.view.title ?? problem?.title ?? '')}"></label>
      <label>Description<textarea name="description" rows="5" placeholder="Que se passe-t-il ? Depuis quand ? Où êtes-vous ?">${esc(state.view.description || '')}</textarea></label>
      <div>
        <p class="label">Photos (${photos.length}/6)</p>
        <div class="mini-gallery">${photos.map((u, i) => `<button type="button" class="mini" data-action="remove-report-photo" data-index="${i}"><img src="${u}" alt=""><span>✕</span></button>`).join('')}
          ${photos.length < 6 ? '<button type="button" class="mini add" data-action="add-report-photo">＋</button>' : ''}
        </div>
      </div>
      <button class="btn primary" ${busyAttr()}>Envoyer à ma concession</button>
    </form>
  </main>`;
}

function renderProfile(p) {
  const c = p.customer;
  return `${header('Profil')}
  <main class="page">
    <div class="card">
      <h2>${esc([c.firstName, c.lastName].filter(Boolean).join(' '))}</h2>
      <dl class="facts">
        ${c.email ? `<div><dt>E-mail</dt><dd>${esc(c.email)}</dd></div>` : ''}
        ${c.phone ? `<div><dt>Téléphone</dt><dd>${esc(c.phone)}</dd></div>` : ''}
        ${c.plate ? `<div><dt>Immatriculation</dt><dd>${esc(c.plate)}</dd></div>` : ''}
      </dl>
      <button class="btn" data-action="edit-profile">Modifier mes informations</button>
    </div>
    <div class="card">
      <h3>Véhicule</h3>
      <p>${esc(p.vehicle?.brandName || '')} — ${esc(p.vehicle?.name || '')}</p>
      <button class="btn" data-action="change-vehicle">Changer de véhicule (avec la concession)</button>
    </div>
    <div class="card">
      <h3>Données & application</h3>
      <p class="muted">Vos informations, notes et photos sont sauvegardées dans le cloud. Pour les retrouver sur un autre téléphone, utilisez votre nom et votre code de récupération.</p>
      <div class="actions">
        <button class="btn" data-action="refresh">🔄 Actualiser</button>
        <button class="btn" data-action="check-update">⬆️ Vérifier les mises à jour</button>
      </div>
      <div class="actions">
        <button class="btn" data-action="logout">Se déconnecter de ce téléphone</button>
        <button class="btn danger" data-action="delete-account">Supprimer mon compte</button>
      </div>
    </div>
  </main>`;
}

function renderEditProfile(p) {
  const c = p.customer;
  return `${header('Mes informations', 'close-view')}
  <main class="page">
    <form class="card form" data-form="profile">
      <div class="row2">
        <label>Prénom<input name="firstName" value="${esc(c.firstName || '')}"></label>
        <label>Nom *<input name="lastName" required value="${esc(c.lastName || '')}"></label>
      </div>
      <label>E-mail<input name="email" type="email" value="${esc(c.email || '')}"></label>
      <label>Téléphone<input name="phone" type="tel" value="${esc(c.phone || '')}"></label>
      <div class="row2">
        <label>Immatriculation<input name="plate" value="${esc(c.plate || '')}"></label>
        <label>VIN<input name="vin" value="${esc(c.vin || '')}"></label>
      </div>
      <button class="btn primary" ${busyAttr()}>Enregistrer</button>
    </form>
  </main>`;
}

// ---------- Events ----------

const actions = {
  'go-welcome': () => {
    state.screen = 'welcome';
    state.handover = null;
  },
  'go-restore': () => (state.screen = 'restore'),
  'start-handover': () => startHandover('new'),
  'change-vehicle': () => startHandover('change'),
  'cancel-change': () => {
    state.screen = 'main';
    state.handover = null;
  },
  'handover-back': () => {
    const h = state.handover;
    h.step = { brand: 'code', vehicle: 'brand', customer: 'vehicle' }[h.step] || 'code';
  },
  'pick-brand': (el) => {
    state.handover.brandId = Number(el.dataset.id);
    state.handover.step = 'vehicle';
  },
  'pick-vehicle': (el) => {
    const h = state.handover;
    h.vehicleId = Number(el.dataset.id);
    if (h.mode === 'new') {
      h.step = 'customer';
      return;
    }
    const v = h.catalog.vehicles.find((x) => x.id === h.vehicleId);
    if (!confirm(`Associer le véhicule « ${v?.name} » à ce compte ?`)) return;
    return run(async () => {
      setProfile(await api('PUT', '/api/me/vehicle', { dealershipCode: h.code, vehicleId: h.vehicleId }));
      state.screen = 'main';
      state.tab = 'vehicle';
      state.handover = null;
      toast('Véhicule mis à jour');
    });
  },
  'copy-code': async () => {
    try {
      await navigator.clipboard.writeText(state.handover.recoveryCode);
      toast('Code copié');
    } catch {
      toast('Copie impossible, notez le code', 'error');
    }
  },
  'finish-handover': () => {
    state.screen = 'main';
    state.tab = 'vehicle';
    state.handover = null;
  },
  tab: (el) => {
    state.tab = el.dataset.tab;
    state.view = null;
    window.scrollTo(0, 0);
  },
  'close-view': () => (state.view = null),
  category: (el) => (state.category = el.dataset.value),
  'open-problem': (el) => {
    state.view = { name: 'problem', id: Number(el.dataset.id) };
    window.scrollTo(0, 0);
  },
  'open-photo': (el) => (state.view = { name: 'photo', id: Number(el.dataset.id) }),
  'new-report': (el) => {
    state.tab = 'reports';
    state.view = { name: 'new-report', problemId: el.dataset.problem ? Number(el.dataset.problem) : null, photos: [] };
    window.scrollTo(0, 0);
  },
  'add-report-photo': async () => {
    keepReportDraft();
    const images = await pickImage({ multiple: true });
    state.view.photos = [...state.view.photos, ...images].slice(0, 6);
  },
  'remove-report-photo': (el) => {
    keepReportDraft();
    state.view.photos.splice(Number(el.dataset.index), 1);
  },
  'add-photo': async (el) => {
    const image = await pickImage({ capture: !!el.dataset.capture });
    if (!image) return;
    const caption = prompt('Légende (facultatif)') || '';
    return run(async () => {
      await api('POST', '/api/me/photos', { image, caption });
      await refreshProfile();
      toast('Photo sauvegardée');
    });
  },
  'replace-photo': async (el) => {
    const image = await pickImage();
    if (!image) return;
    return run(async () => {
      await api('PATCH', `/api/me/photos/${el.dataset.id}`, { image });
      await refreshProfile();
      toast('Photo remplacée');
    });
  },
  'delete-photo': (el) => {
    if (!confirm('Supprimer cette photo ?')) return;
    return run(async () => {
      await api('DELETE', `/api/me/photos/${el.dataset.id}`);
      state.view = null;
      await refreshProfile();
      toast('Photo supprimée');
    });
  },
  'change-cover': async () => {
    const image = await pickImage();
    if (!image) return;
    return run(async () => {
      setProfile(await api('PATCH', '/api/me', { coverPhoto: image }));
      toast('Photo du véhicule mise à jour');
    });
  },
  'edit-profile': () => (state.view = { name: 'edit-profile' }),
  refresh: () => run(() => refreshProfile({ quiet: false }).then(() => toast('Données à jour'))),
  'check-update': async () => {
    const reg = await navigator.serviceWorker?.getRegistration('/app/');
    if (!reg) return toast("Mises à jour automatiques indisponibles sur ce navigateur");
    await reg.update();
    if (!reg.waiting && !reg.installing) toast("L'application est à jour");
  },
  'apply-update': () => {
    state.updateReady?.postMessage('SKIP_WAITING');
  },
  logout: () => {
    if (!confirm('Se déconnecter ? Vous aurez besoin de votre code de récupération pour revenir.')) return;
    api('POST', '/api/me/logout').catch(() => {});
    signOutLocal();
  },
  'delete-account': () => {
    if (!confirm('Supprimer définitivement votre compte, vos photos, notes et signalements ?')) return;
    return run(async () => {
      await api('DELETE', '/api/me');
      signOutLocal();
      toast('Compte supprimé');
    });
  },
};

// Keeps what was typed in the report form when the view re-renders (adding photos).
function keepReportDraft() {
  const form = root.querySelector('[data-form="report"]');
  if (form) Object.assign(state.view, formData(form));
}

const forms = {
  restore: (data) =>
    run(async () => {
      setProfile(await api('POST', '/api/restore', data));
      state.screen = 'main';
      state.tab = 'vehicle';
      toast('Compte récupéré');
    }),
  'handover-code': (data) =>
    run(async () => {
      const h = state.handover;
      h.dealership = await api('GET', `/api/dealerships/code/${encodeURIComponent(data.code)}`);
      h.code = data.code;
      h.catalog = await api('GET', '/api/catalog');
      const brands = h.catalog.brands.filter((b) => h.catalog.vehicles.some((v) => v.brandId === b.id));
      if (!brands.length) throw new Error('Aucun véhicule disponible dans le catalogue');
      h.step = 'brand';
    }),
  'handover-customer': (data) =>
    run(async () => {
      const h = state.handover;
      const res = await api('POST', '/api/handover', { dealershipCode: h.code, vehicleId: h.vehicleId, customer: data });
      setProfile(res);
      h.recoveryCode = res.recoveryCode;
      h.step = 'done';
    }),
  note: (data, form) =>
    run(async () => {
      const id = Number(form.dataset.id);
      await api('PUT', `/api/me/notes/${id}`, data);
      await refreshProfile();
      toast('Note enregistrée');
    }),
  photo: (data, form) =>
    run(async () => {
      await api('PATCH', `/api/me/photos/${form.dataset.id}`, data);
      await refreshProfile();
      toast('Légende enregistrée');
    }),
  report: (data) =>
    run(async () => {
      await api('POST', '/api/me/reports', { ...data, problemId: state.view.problemId, photos: state.view.photos });
      state.view = null;
      await refreshProfile();
      toast('Signalement envoyé à votre concession');
    }),
  profile: (data) =>
    run(async () => {
      setProfile(await api('PATCH', '/api/me', data));
      state.view = null;
      toast('Informations enregistrées');
    }),
};

root.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  await fn(el);
  render();
});

root.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  forms[form.dataset.form]?.(formData(form), form);
});

root.addEventListener('input', (e) => {
  if (e.target.dataset.input === 'search') {
    state.search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const input = root.querySelector('[data-input="search"]');
    input.focus();
    input.setSelectionRange(pos, pos);
  }
});

window.addEventListener('online', () => {
  state.online = true;
  refreshProfile();
  render();
});
window.addEventListener('offline', () => {
  state.online = false;
  render();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForContentUpdate();
});

// Refetches the profile when the catalogue changed in the back-office.
async function checkForContentUpdate() {
  if (!state.token || !navigator.onLine) return;
  try {
    const cfg = await api('GET', '/api/config');
    if (cfg.contentVersion !== state.profile?.contentVersion || cfg.announcement !== state.profile?.announcement) await refreshProfile();
  } catch {
    /* offline */
  }
}

// ---------- Service worker (remote updates & offline) ----------

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).then((reg) => {
    const notify = (worker) => {
      state.updateReady = worker;
      render();
    };
    if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) notify(worker);
      });
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

// ---------- Start ----------

load();
if (state.token && state.profile) state.screen = 'main';
render();
refreshProfile();
registerServiceWorker();
