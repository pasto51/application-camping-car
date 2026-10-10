import { esc, multiline, formatDate, createApi, pickImage, toast } from '/shared/common.js';

const formatDateTime = (t) => {
  const d = new Date(String(t).replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? '' : `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};
import { registerCatalogViews } from '/admin/catalog.js';
import { registerAnalyticsView } from '/admin/analytics.js';
import { registerTipsView } from '/admin/tips.js';
import { registerBannersView } from '/admin/banners.js';
import { registerContentView } from '/admin/content.js';
import { guideHtml } from '/admin/guide.js';
import { registerHelp } from '/admin/help.js';
import { registerNotifsView } from '/admin/notifs.js';
import { registerIdeasView } from '/admin/ideas.js';

const TOKEN_KEY = 'cc-admin-token';
const SEVERITY = { info: 'Info', attention: 'Attention', urgent: 'Urgent' };
const STATUS = { nouveau: 'Nouvelle', en_cours: 'En cours', resolu: 'Clôturée' };

const state = { token: null, user: null, section: 'dashboard', filter: {}, cache: {} };

try {
  state.token = localStorage.getItem(TOKEN_KEY);
} catch {
  /* storage unavailable */
}

const api = createApi(
  () => state.token,
  () => logout()
);

function setToken(token) {
  state.token = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function logout() {
  setToken(null);
  state.user = null;
  renderLogin();
}

const root = document.getElementById('root');
const isAdmin = () => state.user?.role === 'admin';
// Content editor: diagnostics, equipment, lists, vehicles and photos, announcement — no customers, requests or dealerships.
const isEditor = () => state.user?.role === 'editor';
const canEditContent = () => isAdmin() || isEditor();
// Analyst: the statistics of use only (all dealerships), to prepare the campaigns.
const isAnalyst = () => state.user?.role === 'analytics';
const canSeeStats = () => isAdmin() || isAnalyst() || ['manager', 'dealer'].includes(state.user?.role);
// Responsable de concession (or administrator): reassigns customers, manages the team.
// A detached store is independent: no access to the dealership's customers.
const isDetachedStore = () => state.user?.role === 'store' && !!state.user?.storeDetached;
const isManager = () => ['admin', 'manager', 'dealer'].includes(state.user?.role);
const ROLE_LABELS = { admin: 'Administrateur', editor: 'Éditeur de contenu', analytics: 'Analyste (statistiques)', manager: 'Responsable de concession', dealer: 'Responsable de concession', sales: 'Commercial', sav: 'SAV / atelier', store: 'Magasin' };
const ROLE_ORDER = ['manager', 'sales', 'sav', 'store', 'editor', 'analytics', 'admin'];
// For searches: no accents, no capitals.
const norm = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const SERVICE_LABELS = { sav: '🛠️ SAV', magasin: '🛒 Magasin' };
// The service a SAV or store account works for (requests shown first).
const myService = () => ({ sav: 'sav', store: 'magasin' })[state.user?.role] || '';

// ---------- Login ----------

function renderLogin() {
  root.innerHTML = `<div class="login">
    <form class="card" id="login-form">
      <img src="/admin/icon.svg" alt="" width="56" height="56">
      <h1>Back-office Camping-Car</h1>
      <label>E-mail<input name="email" type="email" required autocomplete="username"></label>
      <label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label>
      <label class="check"><input type="checkbox" name="remember" checked> Rester connecté 15 jours sur cet appareil</label>
      <button class="btn primary">Se connecter</button>
    </form>
  </div>`;
  root.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const res = await api('POST', '/api/admin/login', { email: f.get('email'), password: f.get('password'), remember: f.get('remember') === 'on' });
      setToken(res.token);
      // The full profile (version of the site, test mode…), not only what the login returns.
      state.user = await api('GET', '/api/admin/me').catch(() => res.user);
      renderShell();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ---------- Shell ----------

function sections() {
  const all = [
    ['dashboard', '📊', 'Tableau de bord', true],
    ['analytics', '📈', 'Statistiques', canSeeStats()],
    ['reports', '💬', 'Demandes clients', state.user?.role !== 'sales' && !isEditor() && !isAnalyst()],
    ['customers', '👥', 'Clients', !isEditor() && !isAnalyst() && !isDetachedStore()],
    ['vehicles', '🚐', 'Véhicules', canEditContent()],
    ['diagnostics', '🛠️', 'Diagnostics (pannes)', canEditContent()],
    ['equipment', '🧰', 'Équipements', canEditContent()],
    ['banners', '📣', 'À la une', canEditContent() || ['manager', 'dealer'].includes(state.user?.role)],
    ['notifs', '🔔', 'Notifications', isAdmin()],
    ['tips', '💡', 'Conseils & Astuces', canEditContent()],
    ['content', '📋', 'Contenus de l’appli', canEditContent()],
    ['brands', '🏷️', 'Marques', canEditContent()],
    ['dealerships', '🏢', isAdmin() ? 'Concessions' : 'Ma concession', !isEditor() && !isAnalyst()],
    ['users', '🔑', isAdmin() ? 'Utilisateurs' : 'Mon équipe', isManager()],
    ['bugs', '🐞', 'Bugs signalés', isAdmin()],
    ['ideas', '🧭', 'Idées à venir', isAdmin()],
    ['settings', '⚙️', 'Paramètres', true],
  ];
  return all.filter((s) => s[3]);
}

function renderShell() {
  root.innerHTML = `<div class="shell">
    <aside class="sidebar">
      <div class="logo"><img src="/admin/icon.svg" alt="" width="32" height="32"><span>Back-office</span></div>
      <nav>${sections()
        .map(([id, icon, label]) => `<a href="#${id}" data-section="${id}" class="${state.section === id ? 'active' : ''}"><span>${icon}</span>${esc(label)}</a>`)
        .join('')}</nav>
      <div class="me">
        <strong>${esc(state.user.name || state.user.email)}</strong>
        <small>${esc(ROLE_LABELS[state.user.role] || 'Concession')}</small>
        ${
          state.user.openAccess && !state.token
            ? '<small class="open-access">⚠️ Accès libre, sans mot de passe (mode test)</small>'
            : '<button class="btn small" id="logout">Se déconnecter</button>'
        }
        ${state.user.appVersion ? `<small class="version">Version ${esc(state.user.appVersion.slice(0, 6))}</small>` : ''}
      </div>
      <div class="side-help">
        <button class="btn small" id="helpbtn" type="button" title="Voir la vidéo de présentation du back-office">❓ Prendre en main</button>
        <button class="btn small" id="bugbtn" type="button">🐞 Signaler un bug</button>
      </div>
    </aside>
    <main class="content" id="content"></main>
  </div>`;
  root.querySelector('#logout')?.addEventListener('click', logout);
  root.querySelector('#bugbtn').addEventListener('click', () => HELP.openBugForm());
  root.querySelector('#helpbtn').addEventListener('click', () => HELP.openHelpVideo());
  showSection(state.section);
  refreshTipsBadge();
  HELP.refreshBugsBadge(root);
}

// Tips shared by customers and waiting to be read: a badge on « Conseils & Astuces ».
function refreshTipsBadge() {
  if (!canEditContent()) return;
  api('GET', '/api/admin/stats').then((st) => {
    const a = root.querySelector('.sidebar a[data-section="tips"]');
    if (!a) return;
    a.querySelector('.nav-badge')?.remove();
    if (st.pendingTips) a.insertAdjacentHTML('beforeend', ` <span class="nav-badge" title="Astuces à valider">${st.pendingTips}</span>`);
  }).catch(() => {});
}

async function showSection(id) {
  if (!sections().some((s) => s[0] === id)) id = sections()[0][0];
  state.section = id;
  root.querySelectorAll('.sidebar a').forEach((a) => a.classList.toggle('active', a.dataset.section === id));
  const content = document.getElementById('content');
  content.oninput = content.onchange = content.onclick = null;
  content.innerHTML = '<p class="muted">Chargement…</p>';
  try {
    await VIEWS[id](content);
  } catch (err) {
    content.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

window.addEventListener('hashchange', () => {
  if (state.user) showSection(location.hash.slice(1) || 'dashboard');
});

// ---------- Generic form dialog ----------
// field: { name, label, type: text|email|tel|number|date|password|textarea|select|checkbox|image|specs, options, required, hint, full }

function openForm({ title, fields, values = {}, submitLabel = 'Enregistrer', onSubmit, extra = '' }) {
  const dialog = document.createElement('dialog');
  const images = {}; // name -> undefined (unchanged) | null (removed) | dataURL
  const specs = {};

  const fieldHtml = (f) => {
    const v = values[f.name];
    const req = f.required ? 'required' : '';
    const label = `${esc(f.label)}${f.required ? ' *' : ''}`;
    const hint = f.hint ? `<small class="hint">${esc(f.hint)}</small>` : '';
    const cls = f.full || ['textarea', 'image', 'specs'].includes(f.type) ? 'full' : '';
    // Hidden for some values of another field (e.g. no dealership for an administrator, editor or analyst).
    const hide = f.hideIf ? `data-hide-if="${f.hideIf[0]}" data-hide-values="${esc(f.hideIf[1].join(','))}"` : '';
    switch (f.type) {
      case 'textarea':
        return `<label class="${cls}" ${hide}>${label}<textarea name="${f.name}" rows="${f.rows || 5}" ${req}>${esc(v ?? '')}</textarea>${hint}</label>`;
      case 'select':
        return `<label class="${cls}" ${hide}>${label}<select name="${f.name}" ${req}>${f.options
          .map(([val, text]) => `<option value="${esc(val)}" ${String(v ?? '') === String(val) ? 'selected' : ''}>${esc(text)}</option>`)
          .join('')}</select>${hint}</label>`;
      case 'checkbox':
        return `<label class="check ${cls}"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}> ${label}</label>`;
      case 'checks': {
        // Several choices among a list (e.g. the dealerships followed by an analyst).
        const on = new Set((Array.isArray(v) ? v : []).map(String));
        // A long list (equipment…) gets a search box, with what is already checked first.
        const opts = f.filter ? [...f.options].sort((a, b) => on.has(String(b[0])) - on.has(String(a[0]))) : f.options;
        return `<div class="field full" ${f.showIf ? `data-show-if="${f.showIf[0]}" data-show-value="${esc(f.showIf[1])}"` : ''}><span class="label">${label}</span>
          ${f.filter ? `<input type="search" class="checks-filter" data-checks-filter="${f.name}" placeholder="${esc(f.filter)}">` : ''}
          <div class="checks" data-checks="${f.name}">${opts.length ? opts.map(([val, text]) => `<label class="check"><input type="checkbox" name="${f.name}" value="${esc(val)}" ${on.has(String(val)) ? 'checked' : ''}> ${esc(text)}</label>`).join('') : '<span class="muted">Aucune concession.</span>'}</div>${hint}</div>`;
      }
      case 'image':
        return `<div class="field full"><span class="label">${label}</span>
          <div class="image-field" data-image="${f.name}">
            <div class="preview">${v ? `<img src="${esc(v)}" alt="">` : '<span>Aucune photo</span>'}</div>
            <div class="image-actions"><button type="button" class="btn small" data-pick>Choisir une photo</button>
            <button type="button" class="btn small danger" data-clear ${v ? '' : 'hidden'}>Retirer</button></div>
          </div>${hint}</div>`;
      case 'specs':
        specs[f.name] = Array.isArray(v) ? v.map((s) => ({ ...s })) : [];
        return `<div class="field full"><span class="label">${label}</span><div class="specs-editor" data-specs="${f.name}"></div>${hint}</div>`;
      default:
        return `<label class="${cls}" ${hide}>${label}<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v ?? '')}" ${req} ${f.attrs || ''}>${hint}</label>`;
    }
  };

  dialog.innerHTML = `<form method="dialog" class="dialog-form">
    <header><h2>${esc(title)}</h2><button type="button" class="icon" data-close aria-label="Fermer">✕</button></header>
    <div class="fields">${fields.map(fieldHtml).join('')}</div>
    ${extra}
    <footer><button type="button" class="btn" data-close>Annuler</button><button class="btn primary" type="submit">${esc(submitLabel)}</button></footer>
  </form>`;
  document.body.appendChild(dialog);

  const renderSpecs = (name) => {
    const el = dialog.querySelector(`[data-specs="${name}"]`);
    el.innerHTML = `${specs[name]
      .map(
        (s, i) => `<div class="spec-row">
        <input placeholder="Caractéristique (ex : Longueur)" value="${esc(s.label || '')}" data-spec="${i}" data-key="label">
        <input placeholder="Valeur (ex : 6,99 m)" value="${esc(s.value || '')}" data-spec="${i}" data-key="value">
        <button type="button" class="btn small danger" data-spec-remove="${i}">✕</button></div>`
      )
      .join('')}<button type="button" class="btn small" data-spec-add>＋ Ajouter une caractéristique</button>`;
    el.oninput = (e) => {
      const i = e.target.dataset.spec;
      if (i !== undefined) specs[name][i][e.target.dataset.key] = e.target.value;
    };
    el.onclick = (e) => {
      if (e.target.matches('[data-spec-add]')) specs[name].push({ label: '', value: '' });
      else if (e.target.dataset.specRemove !== undefined) specs[name].splice(Number(e.target.dataset.specRemove), 1);
      else return;
      renderSpecs(name);
    };
  };
  Object.keys(specs).forEach(renderSpecs);

  dialog.querySelectorAll('[data-image]').forEach((el) => {
    const name = el.dataset.image;
    const preview = el.querySelector('.preview');
    const clear = el.querySelector('[data-clear]');
    el.querySelector('[data-pick]').onclick = async () => {
      const img = await pickImage();
      if (!img) return;
      images[name] = img;
      preview.innerHTML = `<img src="${img}" alt="">`;
      clear.hidden = false;
    };
    clear.onclick = () => {
      images[name] = null;
      preview.innerHTML = '<span>Aucune photo</span>';
      clear.hidden = true;
    };
  });

  dialog.querySelectorAll('[data-checks-filter]').forEach((input) => {
    const box = dialog.querySelector(`[data-checks="${input.dataset.checksFilter}"]`);
    const norm = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    input.oninput = () => {
      const q = norm(input.value.trim());
      box.querySelectorAll('label').forEach((l) => (l.hidden = !!q && !norm(l.textContent).includes(q) && !l.querySelector('input').checked));
    };
  });

  const close = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.querySelectorAll('[data-close]').forEach((b) => (b.onclick = close));
  dialog.addEventListener('cancel', close);
  // Fields shown only for one value of another field (e.g. the dealerships followed, for an analyst).
  const toggles = () =>
    dialog.querySelectorAll('[data-show-if]').forEach((el) => {
      const ctl = dialog.querySelector(`[name="${el.dataset.showIf}"]`);
      el.hidden = !ctl || ctl.value !== el.dataset.showValue;
    }) ||
    dialog.querySelectorAll('[data-hide-if]').forEach((el) => {
      const ctl = dialog.querySelector(`[name="${el.dataset.hideIf}"]`);
      el.hidden = !!ctl && el.dataset.hideValues.split(',').includes(ctl.value);
    });
  dialog.addEventListener('change', toggles);
  toggles();

  dialog.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {};
    for (const f of fields) {
      if (f.type === 'image') {
        if (images[f.name] !== undefined) data[f.name] = images[f.name];
      } else if (f.type === 'specs') {
        data[f.name] = specs[f.name].filter((s) => s.label?.trim() && s.value?.trim());
      } else if (f.type === 'checkbox') {
        data[f.name] = form.elements[f.name].checked;
      } else if (f.type === 'checks') {
        data[f.name] = [...form.querySelectorAll(`input[name="${f.name}"]:checked`)].map((x) => Number(x.value) || x.value);
      } else {
        const val = form.elements[f.name].value;
        if (f.type === 'password' && !val) continue;
        data[f.name] = val;
      }
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await onSubmit(data);
      close();
    } catch (err) {
      toast(err.message, 'error');
      submit.disabled = false;
    }
  });

  dialog.showModal();
  return dialog;
}

async function confirmDelete(message, fn) {
  if (!confirm(message)) return;
  try {
    await fn();
    toast('Supprimé');
    showSection(state.section);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function pageHeader(title, actionsHtml = '') {
  return `<div class="page-head"><h1>${esc(title)}</h1><div class="actions">${actionsHtml}</div></div>`;
}

function thumb(url) {
  return url ? `<img class="thumb" src="${esc(url)}" alt="">` : '<span class="thumb ph">—</span>';
}

// Binds clicks on [data-act] buttons inside a container.
function bind(container, handlers) {
  container.onclick = (e) => {
    const el = e.target.closest('[data-act]');
    if (el && handlers[el.dataset.act]) handlers[el.dataset.act](el.dataset.id ? Number(el.dataset.id) : undefined, el);
  };
}

async function loadCatalog() {
  const [brands, vehicles] = await Promise.all([api('GET', '/api/admin/brands'), api('GET', '/api/admin/vehicles')]);
  return { brands, vehicles };
}

// ---------- Views ----------

const VIEWS = {
  async dashboard(el) {
    const s = await api('GET', '/api/admin/stats');
    const guide = guideHtml(state.user.role, sections().map((x) => x[0]));
    // Content editor and analyst: no customers nor requests, the guide (and the tips to read) only.
    if (isEditor() || isAnalyst()) {
      el.innerHTML = `${pageHeader('Tableau de bord')}
        ${isEditor() && s.pendingTips ? `<div class="tiles"><a class="tile tile-alert" href="#tips"><strong>${s.pendingTips}</strong><span>Astuce(s) de clients à relire</span></a></div>` : ''}
        ${guide}`;
      return;
    }
    const tiles = [
      ...(state.user.role === 'sales' ? [] : [[myService() ? `Demandes ${myService() === 'sav' ? 'SAV' : 'magasin'} à traiter` : 'Demandes à traiter', s.openReports, 'reports']]),
      ...(state.user.role !== 'sales' && s.overdueReports ? [['⏰ Sans réponse depuis plus de 48 h', s.overdueReports, 'reports', 'overdue']] : []),
      ...(isDetachedStore() ? [] : [['Clients', s.customers, 'customers']]),
      ...(isAdmin()
        ? [
            ['Diagnostics', s.diagnostics, 'diagnostics'],
            ['Équipements', s.equipment, 'equipment'],
            ['Véhicules', s.vehicles, 'vehicles'],
            ['Marques', s.brands, 'brands'],
            ['Concessions', s.dealerships, 'dealerships'],
          ]
        : []),
    ];
    const m = s.mine || {};
    const recap =
      m.customers || state.user.role === 'sales'
        ? `<div class="card recap"><h2>Mes clients (${m.customers || 0})</h2>
        ${m.openReports ? `<p><a href="#reports">${m.openReports} demande${m.openReports > 1 ? 's' : ''} en cours</a> chez vos clients.</p>` : '<p class="muted">Aucune demande en cours chez vos clients.</p>'}
        ${
          (m.recentReports || []).length
            ? `<h3>Leurs demandes des 30 derniers jours</h3><ul class="recap-list">${m.recentReports
                .map((r) => `<li>${r.kind === 'piece' ? '🛒 ' : ''}<strong>${esc([r.firstName, r.lastName].filter(Boolean).join(' '))}</strong> : ${esc(r.title)} <span class="status ${esc(r.status)}">${STATUS[r.status]}</span> <small class="muted">${formatDate(r.updatedAt)}</small></li>`)
                .join('')}</ul>`
            : ''
        }
        ${(m.recentCustomers || []).length ? `<h3>Dernières mises en main</h3><p>${m.recentCustomers.map((c) => `${esc([c.firstName, c.lastName].filter(Boolean).join(' '))} <small class="muted">(${formatDate(c.handoverDate)})</small>`).join(' · ')}</p>` : ''}
        <p><a href="#customers">Voir mes clients</a></p></div>`
        : '';
    el.innerHTML = `${pageHeader('Tableau de bord')}
      ${recap}
      <div class="tiles">${tiles.map(([label, n, link, filter]) => `<a class="tile${filter ? ' tile-alert' : ''}" href="#${link}" ${filter ? `data-report-filter="${filter}"` : ''}><strong>${n}</strong><span>${esc(label)}</span></a>`).join('')}</div>
      ${guide}
      <div class="card">
        <h2>Fonctionnement</h2>
        <ul>
          <li>Toute modification des véhicules, équipements, diagnostics ou contenus est <strong>publiée dans l'application des clients</strong> : ils la reçoivent à la prochaine ouverture (version du contenu : ${s.contentVersion}).</li>
          <li>Mise en main : dans l'application du client, la concession saisit son <strong>code concession</strong>, choisit la <strong>marque</strong> puis le <strong>véhicule</strong>, coche les équipements, vérifie chaque point, puis génère le <strong>code d'accès</strong> du client (valable 2 ans).</li>
          <li>Tout ce que le client enregistre (équipements cochés, photos, modèles, poids…) est sauvegardé dans le cloud. Ses demandes de rendez-vous arrivent dans « Demandes clients ».</li>
          <li>Application client : <a href="/app/" target="_blank">${esc(location.origin)}/app/</a></li>
        </ul>
      </div>`;
    // The « +48 h » tile opens the requests filtered on those.
    el.querySelectorAll('[data-report-filter]').forEach((a) => a.addEventListener('click', () => (state.filter.reportStatus = a.dataset.reportFilter)));
  },

  async reports(el) {
    const status = state.filter.reportStatus ?? 'open';
    const service = state.filter.reportService ?? myService();
    const [all, settings] = await Promise.all([api('GET', '/api/admin/reports'), api('GET', '/api/admin/settings').catch(() => null)]);
    const list = all.filter((r) =>
      (!service || r.service === service) && (status === 'open' ? r.status !== 'resolu' : status === 'overdue' ? r.overdue : status === 'all' || r.status === status)
    );
    const overdue = all.filter((r) => r.overdue && (!service || r.service === service)).length;
    const toAnswer = all.filter((r) => r.waitingForDealer).length;
    const mailWarning = settings?.mail && !settings.mail.ready
      ? `<div class="card warn-card">✉️ Les e-mails de notification ne sont pas encore configurés : vous ne serez pas prévenu des nouvelles demandes. ${isAdmin() ? '<a href="#settings">Configurer l’envoi des e-mails</a>' : 'Demandez à l’administrateur de le configurer.'}</div>`
      : '';
    el.innerHTML = `${pageHeader(`Demandes clients${toAnswer ? ` · ${toAnswer} à répondre` : ''}`)}
      ${mailWarning}
      <div class="filters">${[
        ['open', 'À traiter'],
        ...(overdue || status === 'overdue' ? [['overdue', `⏰ Sans réponse +48 h (${overdue})`]] : []),
        ['nouveau', 'Nouvelles'],
        ['en_cours', 'En cours'],
        ['resolu', 'Clôturées'],
        ['all', 'Toutes'],
      ]
        .map(([v, l]) => `<button class="chip ${status === v ? 'active' : ''}" data-act="filter" data-value="${v}">${l}</button>`)
        .join('')}</div>
      <div class="filters">${[
        ['', 'Tous les services'],
        ['sav', SERVICE_LABELS.sav],
        ['magasin', SERVICE_LABELS.magasin],
      ]
        .map(([v, l]) => `<button class="chip ${service === v ? 'active' : ''}" data-act="service" data-value="${v}">${l}</button>`)
        .join('')}</div>
      <div class="cards">${
        list.length
          ? list
              .map(
                (r) => `<div class="card report ${r.waitingForDealer ? 'waiting' : ''}">
            <div class="report-head">
              <div><span class="status ${r.service === 'magasin' ? 'piece' : 'sav'}">${SERVICE_LABELS[r.service] || SERVICE_LABELS.sav}</span> ${
                r.warranty?.until ? (r.warranty.active ? `<span class="status resolu">🛡️ Garantie jusqu’au ${formatDate(r.warranty.until)}</span> ` : '<span class="status">Hors garantie</span> ') : ''
              }<strong>${esc(r.title)}</strong>${
                r.overdue
                  ? ` <span class="status nouveau">⏰ Sans réponse depuis ${Math.max(2, Math.floor((Date.now() - new Date(String(r.waitingSince).replace(' ', 'T') + 'Z')) / 86400000))} jours</span>`
                  : r.waitingForDealer
                    ? ' <span class="status nouveau">À répondre</span>'
                    : ''
              }<br><small class="muted">${formatDate(r.createdAt)} · ${esc([r.firstName, r.lastName].filter(Boolean).join(' '))} · ${esc(r.brandName)} ${esc(r.vehicleName)}${isAdmin() ? ` · ${esc(r.dealershipName)}` : ''}${r.salespersonName ? ` · suivi par ${esc(r.salespersonName)}` : ''}</small></div>
              <span class="status ${esc(r.status)}">${STATUS[r.status]}</span>
            </div>
            ${r.transferNote ? `<p class="closed-note">↪︎ Transférée : ${esc(r.transferNote)}</p>` : ''}
            ${r.part ? partCard(r) : ''}
            <div class="thread">
              <div class="msg client"><p>${multiline(r.description || r.title)}</p><small>Client · ${formatDateTime(r.createdAt)}</small></div>
              ${r.messages.map((m) => `<div class="msg ${esc(m.author)}"><p>${multiline(m.body)}</p><small>${m.author === 'client' ? 'Client' : 'Concession'} · ${formatDateTime(m.createdAt)}</small></div>`).join('')}
            </div>
            ${r.photos.length && !r.part ? `<div class="photos">${r.photos.map((u) => `<a href="${esc(u)}" target="_blank"><img src="${esc(u)}" alt=""></a>`).join('')}</div>` : ''}
            ${
              r.status === 'resolu'
                ? `<p class="closed-note">🔒 Demande clôturée${r.closedAt ? ` le ${formatDateTime(r.closedAt)}` : ''} : le client ne peut plus y répondre (il peut faire une nouvelle demande). Pour la rouvrir, choisissez « En cours ».</p>`
                : ''
            }
            ${r.canManage ? '' : `<p class="closed-note">Demande traitée par le ${r.service === 'magasin' ? 'magasin' : 'SAV'} : lecture seule.</p>`}
            <form class="reply-form" data-reply="${r.id}" ${r.canManage ? '' : 'hidden'}>
              <textarea name="message" rows="2" placeholder="${r.status === 'resolu' ? 'Dernier message au client (facultatif)' : 'Votre réponse au client (il la reçoit dans son application)'}"></textarea>
              <div class="actions">
                <select name="status">${Object.entries(STATUS).map(([v, l]) => `<option value="${v}" ${(r.status === 'nouveau' ? 'en_cours' : r.status) === v ? 'selected' : ''}>${v === 'resolu' ? 'Clôturer la demande' : l}</option>`).join('')}</select>
                <button class="btn primary">Envoyer</button>
                <button type="button" class="btn small" data-act="transfer" data-id="${r.id}" data-to="${r.service === 'magasin' ? 'sav' : 'magasin'}">Transférer au ${r.service === 'magasin' ? 'SAV' : 'magasin'}</button>
                ${r.phone ? `<a class="btn small" href="tel:${esc(r.phone)}">📞 ${esc(r.phone)}</a>` : ''}
                ${r.email ? `<a class="btn small" href="mailto:${esc(r.email)}">✉️ ${esc(r.email)}</a>` : ''}
              </div>
            </form>
          </div>`
              )
              .join('')
          : '<p class="muted">Aucune demande.</p>'
      }</div>`;
    el.querySelectorAll('[data-reply]').forEach((f) => {
      f.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        try {
          await api('PUT', `/api/admin/reports/${f.dataset.reply}`, { status: fd.get('status'), message: fd.get('message') });
          toast(fd.get('message').trim() ? 'Réponse envoyée au client' : 'Statut enregistré');
          VIEWS.reports(el);
        } catch (err) {
          toast(err.message, 'error');
        }
      };
    });
    bind(el, {
      filter: (_, b) => {
        state.filter.reportStatus = b.dataset.value;
        VIEWS.reports(el);
      },
      service: (_, b) => {
        state.filter.reportService = b.dataset.value;
        VIEWS.reports(el);
      },
      transfer: (id, b) =>
        openForm({
          title: `Transférer au ${b.dataset.to === 'sav' ? 'SAV' : 'magasin'}`,
          submitLabel: 'Transférer',
          fields: [{ name: 'transferNote', label: 'Motif (visible par les deux services)', required: true, full: true, attrs: 'placeholder="ex : hors garantie, pièce disponible au magasin…"' }],
          onSubmit: async (data) => {
            await api('PUT', `/api/admin/reports/${id}`, { service: b.dataset.to, transferNote: data.transferNote });
            toast('Demande transférée : le service est prévenu par e-mail');
            VIEWS.reports(el);
          },
        }),
      copypart: async (id) => {
        const r = all.find((x) => x.id === Number(id));
        const text = partLines(r).map(([k, v]) => `${k} : ${v}`).join('\n');
        try {
          await navigator.clipboard.writeText(text);
          toast('Fiche copiée : collez-la dans votre commande fournisseur');
        } catch {
          prompt('Copiez cette fiche :', text);
        }
      },
    });
  },

  async customers(el) {
    const q = state.filter.customerQuery || '';
    // A salesperson starts on their own customers; everyone in the dealership can see all of them.
    const mine = state.filter.customerMine ?? state.user.role === 'sales';
    const dealer = isAdmin() ? state.filter.customerDealership || '' : '';
    const [list, dealerships] = await Promise.all([
      api('GET', `/api/admin/customers?q=${encodeURIComponent(q)}${mine ? '&mine=1' : ''}${dealer ? `&dealershipId=${dealer}` : ''}`),
      isAdmin() ? api('GET', '/api/admin/dealerships') : Promise.resolve([]),
    ]);
    el.innerHTML = `${pageHeader('Clients', '<button class="btn primary" data-act="add">＋ Nouveau client</button>')}
      ${
        isAdmin()
          ? `<div class="filter-bar"><select data-dealer><option value="">Toutes les concessions</option>${dealerships
              .map((d) => `<option value="${d.id}" ${String(dealer) === String(d.id) ? 'selected' : ''}>${esc(d.name)}</option>`)
              .join('')}</select><span class="muted">${list.length} client${list.length > 1 ? 's' : ''}${list.length === 500 ? ' (500 premiers : affinez la recherche)' : ''}</span></div>`
          : ''
      }
      ${isAdmin() ? '' : `<div class="filters"><button class="chip ${mine ? 'active' : ''}" data-act="mine" data-value="1">Mes clients</button><button class="chip ${mine ? '' : 'active'}" data-act="mine" data-value="0">Toute la concession</button></div>`}
      <form class="search-bar" id="customer-search"><input name="q" type="search" placeholder="Nom, e-mail, n° de cellule…" value="${esc(q)}"><button class="btn">Rechercher</button></form>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Client</th><th>Véhicule</th><th>N° cellule</th>${isAdmin() ? '<th>Concession</th>' : ''}<th>Commercial</th><th>Mise en main</th><th>Signal.</th><th></th></tr></thead>
        <tbody>${list
          .map(
            (c) => `<tr>
          <td>${thumb(c.coverPhotoUrl)}</td>
          <td><strong>${esc([c.firstName, c.lastName].filter(Boolean).join(' '))}</strong><br><small class="muted">${esc(c.email || '')}</small></td>
          <td>${esc(c.brandName)} ${esc(c.vehicleName)}</td>
          <td>${esc(c.cellNumber || '')}</td>
          ${isAdmin() ? `<td>${esc(c.dealershipName)}</td>` : ''}
          <td>${c.salespersonName ? esc(c.salespersonName) : '<span class="muted">—</span>'}${c.salespersonId === state.user.id ? ' <span class="status resolu">moi</span>' : ''}</td>
          <td>${formatDate(c.handoverDate)}</td>
          <td>${c.openReports ? `<span class="status nouveau">${c.openReports}</span>` : ''}</td>
          <td class="row-actions"><button class="btn small" data-act="open" data-id="${c.id}">Ouvrir</button></td>
        </tr>`
          )
          .join('')}</tbody>
      </table>${list.length ? '' : '<p class="muted">Aucun client.</p>'}</div>`;
    el.querySelector('[data-dealer]')?.addEventListener('change', (e) => {
      state.filter.customerDealership = e.target.value;
      VIEWS.customers(el);
    });
    el.querySelector('#customer-search').onsubmit = (e) => {
      e.preventDefault();
      state.filter.customerQuery = new FormData(e.target).get('q');
      VIEWS.customers(el);
    };
    bind(el, {
      open: (id) => customerDetail(el, id),
      add: () => newCustomer(el),
      mine: (_, b) => {
        state.filter.customerMine = b.dataset.value === '1';
        VIEWS.customers(el);
      },
    });
  },

  async vehicles(el) {
    const { brands, vehicles } = await loadCatalog();
    const brandFilter = state.filter.vehicleBrand || '';
    const list = vehicles.filter((v) => !brandFilter || v.brandId === Number(brandFilter));
    el.innerHTML = `${pageHeader('Véhicules', '<a class="btn" href="/admin/releve/" target="_blank" rel="noopener">📱 Relevé sur téléphone</a><button class="btn primary" data-act="add">＋ Nouveau véhicule</button>')}
      <p class="muted">Astuce : sur votre téléphone, ouvrez <strong>${esc(location.host)}/releve</strong> dans le véhicule pour cocher les équipements et prendre les photos sur place.</p>
      <div class="filters"><button class="chip ${!brandFilter ? 'active' : ''}" data-act="brand" data-value="">Toutes les marques</button>${brands
        .map((b) => `<button class="chip ${String(b.id) === String(brandFilter) ? 'active' : ''}" data-act="brand" data-value="${b.id}">${esc(b.name)}</button>`)
        .join('')}</div>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Véhicule</th><th>Marque</th><th>Millésime</th><th>Clients</th><th>État</th><th></th></tr></thead>
        <tbody>${list
          .map(
            (v) => `<tr>
          <td>${thumb(v.photoUrl)}</td>
          <td><strong>${esc(v.name)}</strong></td>
          <td>${esc(v.brandName)}</td>
          <td>${esc(v.modelYear || '')}</td>
          <td>${v.customerCount}</td>
          <td>${v.active ? '<span class="status resolu">Actif</span>' : '<span class="status">Masqué</span>'}</td>
          <td class="row-actions"><button class="btn small primary" data-act="profile" data-id="${v.id}">Profil appli et photos</button><button class="btn small" data-act="edit" data-id="${v.id}">Modifier</button>${isAdmin() ? `<button class="btn small danger" data-act="del" data-id="${v.id}">Supprimer</button>` : ''}</td>
        </tr>`
          )
          .join('')}</tbody>
      </table>${list.length ? '' : '<p class="muted">Aucun véhicule.</p>'}</div>`;

    const fields = [
      { name: 'brandId', label: 'Marque', type: 'select', required: true, options: brands.map((b) => [b.id, b.name]) },
      { name: 'name', label: 'Nom du modèle', required: true },
      { name: 'modelYear', label: 'Millésime / année' },
      { name: 'sort', label: "Ordre d'affichage", type: 'number' },
      { name: 'photo', label: 'Photo du véhicule', type: 'image' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'specs', label: 'Caractéristiques', type: 'specs' },
      { name: 'active', label: 'Proposé lors de la mise en main', type: 'checkbox' },
    ];
    bind(el, {
      brand: (_, b) => {
        state.filter.vehicleBrand = b.dataset.value;
        VIEWS.vehicles(el);
      },
      add: () =>
        openForm({
          title: 'Nouveau véhicule',
          fields,
          values: { brandId: brandFilter || brands[0]?.id, active: true, sort: 0 },
          onSubmit: async (data) => {
            await api('POST', '/api/admin/vehicles', data);
            toast('Véhicule créé');
            VIEWS.vehicles(el);
          },
        }),
      edit: (id) => {
        const v = vehicles.find((x) => x.id === id);
        openForm({
          title: `Modifier ${v.name}`,
          fields,
          values: { ...v, photo: v.photoUrl },
          onSubmit: async (data) => {
            await api('PUT', `/api/admin/vehicles/${id}`, data);
            toast('Véhicule enregistré');
            VIEWS.vehicles(el);
          },
        });
      },
      profile: (id) => VIEWS.vehicleProfile(el, id, () => VIEWS.vehicles(el)),
      del: (id) => confirmDelete('Supprimer ce véhicule ?', () => api('DELETE', `/api/admin/vehicles/${id}`)),
    });
  },

  async brands(el) {
    const brands = await api('GET', '/api/admin/brands');
    el.innerHTML = `${pageHeader('Marques', '<button class="btn primary" data-act="add">＋ Nouvelle marque</button>')}
      <div class="table-wrap"><table>
        <thead><tr><th>Logo</th><th>Marque</th><th>Couleur</th><th>Véhicules</th><th></th></tr></thead>
        <tbody>${brands
          .map(
            (b) => `<tr>
          <td>${thumb(b.logoUrl)}</td>
          <td><strong>${esc(b.name)}</strong></td>
          <td>${b.color ? `<span class="swatch" style="background:${esc(b.color)}"></span> ${esc(b.color)}` : ''}</td>
          <td>${b.vehicleCount}</td>
          <td class="row-actions"><button class="btn small" data-act="edit" data-id="${b.id}">Modifier</button>${isAdmin() ? `<button class="btn small danger" data-act="del" data-id="${b.id}">Supprimer</button>` : ''}</td>
        </tr>`
          )
          .join('')}</tbody>
      </table></div>`;
    const fields = [
      { name: 'name', label: 'Nom', required: true },
      { name: 'color', label: "Couleur de l'application", type: 'color' },
      { name: 'sort', label: "Ordre d'affichage", type: 'number' },
      { name: 'logo', label: 'Logo', type: 'image' },
    ];
    bind(el, {
      add: () =>
        openForm({
          title: 'Nouvelle marque',
          fields,
          values: { color: '#1d3557', sort: brands.length },
          onSubmit: async (data) => {
            await api('POST', '/api/admin/brands', data);
            toast('Marque créée');
            VIEWS.brands(el);
          },
        }),
      edit: (id) => {
        const b = brands.find((x) => x.id === id);
        openForm({
          title: `Modifier ${b.name}`,
          fields,
          values: { ...b, logo: b.logoUrl, color: b.color || '#1d3557' },
          onSubmit: async (data) => {
            await api('PUT', `/api/admin/brands/${id}`, data);
            toast('Marque enregistrée');
            VIEWS.brands(el);
          },
        });
      },
      del: (id) => confirmDelete('Supprimer cette marque, ses véhicules et ses fiches ?', () => api('DELETE', `/api/admin/brands/${id}`)),
    });
  },

  async dealerships(el) {
    const list = await api('GET', '/api/admin/dealerships');
    // A dealership account has only its own: straight to its page.
    if (!isAdmin() && list.length === 1) return dealershipDetail(el, list[0].id);
    const f = (state.filter.dealerships ||= { q: '' });
    el.innerHTML = `${pageHeader(isAdmin() ? 'Concessions' : 'Ma concession', isAdmin() ? '<button class="btn primary" data-act="add">＋ Nouvelle concession</button>' : '')}
      <div class="filter-bar"><input type="search" data-f="q" placeholder="Nom, ville, code…" value="${esc(f.q)}"><span class="muted" data-count></span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Concession</th><th>Code concession</th><th>Ville</th><th>Contact</th><th>Clients</th><th>Comptes</th><th>État</th>${isManager() ? '<th></th>' : ''}</tr></thead>
        <tbody data-rows></tbody>
      </table></div>
      <p class="muted">Cliquez sur une concession pour voir sa fiche et tous les comptes qui y sont rattachés. Le code concession est saisi dans l'application du client lors de la mise en main : gardez-le confidentiel.</p>`;
    const render = () => {
      const q = norm(f.q);
      const shown = list.filter((d) => !q || norm([d.name, d.city, d.code, d.email].join(' ')).includes(q));
      el.querySelector('[data-rows]').innerHTML = shown
        .map(
          (d) => `<tr class="clickable" data-act="open" data-id="${d.id}">
          <td><strong>${esc(d.name)}</strong></td>
          <td><code class="code">${esc(d.code)}</code></td>
          <td>${esc(d.city || '')}</td>
          <td>${esc(d.phone || '')}<br><small>${esc(d.email || '')}</small></td>
          <td>${d.customerCount}</td>
          <td>${d.userCount}</td>
          <td>${d.active ? '<span class="status resolu">Active</span>' : '<span class="status">Désactivée</span>'}</td>
          ${isManager() ? `<td class="row-actions"><button class="btn small" data-act="open" data-id="${d.id}">Voir</button><button class="btn small" data-act="edit" data-id="${d.id}">Modifier</button>${isAdmin() ? `<button class="btn small danger" data-act="del" data-id="${d.id}">Supprimer</button>` : ''}</td>` : ''}
        </tr>`
        )
        .join('');
      el.querySelector('[data-count]').textContent = shown.length === list.length ? `${list.length} concession${list.length > 1 ? 's' : ''}` : `${shown.length} sur ${list.length}`;
    };
    render();
    el.oninput = (e) => {
      if (e.target.dataset?.f !== 'q') return;
      f.q = e.target.value;
      render();
    };
    bind(el, {
      open: (id) => dealershipDetail(el, id),
      add: () =>
        openForm({
          title: 'Nouvelle concession',
          fields: dealershipFields(),
          values: { active: true, warrantyYears: 2 },
          onSubmit: async (data) => {
            const d = await api('POST', '/api/admin/dealerships', data);
            toast(`Concession créée — code ${d.code}`);
            dealershipDetail(el, d.id);
          },
        }),
      edit: (id) => editDealership(list.find((x) => x.id === id), () => VIEWS.dealerships(el)),
      del: (id) => confirmDelete('Supprimer cette concession ?', () => api('DELETE', `/api/admin/dealerships/${id}`)),
    });
  },

  async users(el) {
    const [users, dealerships] = await Promise.all([api('GET', '/api/admin/users'), api('GET', '/api/admin/dealerships')]);
    const f = (state.filter.users ||= { q: '', role: '', dealership: '' });
    const roleOptions = [...new Set(users.map((u) => (u.role === 'dealer' ? 'manager' : u.role)))].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
    el.innerHTML = `${pageHeader(isAdmin() ? 'Utilisateurs du back-office' : 'Mon équipe', '<button class="btn primary" data-act="add">＋ Nouveau compte</button>')}
      <div class="filter-bar">
        <input type="search" data-f="q" placeholder="Nom, e-mail, téléphone…" value="${esc(f.q)}">
        <select data-f="role"><option value="">Tous les rôles</option>${roleOptions.map((r) => `<option value="${r}" ${f.role === r ? 'selected' : ''}>${esc(ROLE_LABELS[r] || r)}</option>`).join('')}</select>
        ${
          isAdmin()
            ? `<select data-f="dealership"><option value="">Toutes les concessions</option><option value="none" ${f.dealership === 'none' ? 'selected' : ''}>Sans concession (administrateurs, éditeurs)</option>${dealerships
                .map((d) => `<option value="${d.id}" ${String(f.dealership) === String(d.id) ? 'selected' : ''}>${esc(d.name)}</option>`)
                .join('')}</select>`
            : ''
        }
        <button class="btn small" data-act="reset">Effacer les filtres</button>
        <span class="muted" data-count></span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nom</th><th>Contact</th><th>Rôle</th>${isAdmin() ? '<th>Concession</th>' : ''}<th>Clients suivis</th><th></th></tr></thead>
        <tbody data-rows></tbody>
      </table><p class="muted" data-empty hidden>Aucun compte ne correspond à ces filtres.</p></div>
      <div class="card muted"><p><strong>Commercial</strong> : gère ses clients (fiche, code d’accès) et fait les mises en main. Il ne traite pas les demandes : il en voit le récap sur son tableau de bord.</p>
      <p><strong>SAV / atelier</strong> : voit les demandes de la concession, répond à celles du SAV (rendez-vous, soucis, pièces sous garantie) et peut les transférer au magasin.</p>
      <p><strong>Magasin</strong> : répond aux demandes du magasin (pièces hors garantie, produits, accessoires) et peut les transférer au SAV. Magasin détaché : il ne voit que ses demandes, et pas les clients de la concession.</p>
      <p><strong>Responsable de concession</strong> : voit et gère tout dans sa concession (clients, demandes, équipe, fiche de la concession), sans recevoir d’e-mails.</p>
      ${isAdmin() ? '<p><strong>Éditeur de contenu</strong> : modifie les contenus de l’appli (diagnostics et organigrammes, équipements, listes, véhicules et leurs photos, relevé, message / campagne affiché dans l’appli). Il ne voit ni les clients, ni les demandes, ni les concessions, ni les comptes.</p><p><strong>Analyste (statistiques)</strong> : voit seulement les statistiques d’utilisation de l’appli (recherches, problèmes, produits conseillés, saisonnalité, équipements) de toutes les concessions, ou seulement de celles qu’on lui coche (groupement de concessions), pour préparer les campagnes. Le responsable de concession voit aussi les statistiques de sa concession.</p><p><strong>Administrateur</strong> : gère tout, dont le catalogue (véhicules, équipements, diagnostics) et les concessions.</p>' : ''}</div>`;
    // Filtering happens in the page: typing does not reload the list nor lose the cursor.
    const render = () => {
      const q = norm(f.q);
      const shown = users.filter(
        (u) =>
          (!q || norm([u.name, u.email, u.phone, u.dealershipName].join(' ')).includes(q)) &&
          (!f.role || (u.role === 'dealer' ? 'manager' : u.role) === f.role) &&
          (!f.dealership || (f.dealership === 'none' ? !u.dealershipId : String(u.dealershipId) === String(f.dealership)))
      );
      el.querySelector('[data-rows]').innerHTML = shown.map((u) => userRow(u, { showDealership: isAdmin() })).join('');
      el.querySelector('[data-empty]').hidden = !!shown.length;
      el.querySelector('[data-count]').textContent = shown.length === users.length ? `${users.length} compte${users.length > 1 ? 's' : ''}` : `${shown.length} sur ${users.length} comptes`;
    };
    render();
    el.oninput = el.onchange = (e) => {
      const key = e.target.dataset?.f;
      if (!key) return;
      f[key] = e.target.value;
      render();
    };
    bind(el, {
      ...userActions(users, dealerships, () => VIEWS.users(el)),
      reset: () => {
        state.filter.users = { q: '', role: '', dealership: '' };
        VIEWS.users(el);
      },
    });
  },

  async settings(el) {
    const s = await api('GET', '/api/admin/settings');
    el.innerHTML = `${pageHeader('Paramètres')}
      ${
        canEditContent()
          ? `<form class="card form" id="announce-form">
        <h2>Message affiché dans l'application</h2>
        <p class="muted">Ex : rappel d'entretien, campagne de rappel, horaires d'été. Laisser vide pour ne rien afficher.</p>
        <textarea name="announcement" rows="3">${esc(s.announcement || '')}</textarea>
        <button class="btn primary">Publier</button>
      </form>`
          : ''
      }
      ${
        isAdmin()
          ? `<form class="card form" id="mail-form">
        <h2>Envoi des e-mails ${s.mail.ready ? '<span class="status resolu">Configuré</span>' : '<span class="status nouveau">Non configuré</span>'}</h2>
        <p class="muted">Sert à prévenir la concession de chaque nouvelle demande et à envoyer ses réponses au client. Sur alwaysdata : créez une adresse dans <b>E-mails → Adresses</b>, puis indiquez <b>smtp-appvdl.alwaysdata.net</b>, port <b>465</b>, l’adresse complète et son mot de passe.</p>
        <div class="fields-inline">
          <label>Serveur SMTP<input name="host" value="${esc(s.mail.host || '')}" placeholder="smtp-appvdl.alwaysdata.net"></label>
          <label>Port<input name="port" type="number" value="${esc(s.mail.port || 465)}"></label>
          <label>Identifiant<input name="user" value="${esc(s.mail.user || '')}" placeholder="contact@votre-domaine.fr" autocomplete="off"></label>
          <label>Mot de passe<input name="pass" type="password" placeholder="${s.mail.passwordSet ? '•••••••• (inchangé)' : ''}" autocomplete="new-password"></label>
          <label>Adresse d’expédition<input name="from" value="${esc(s.mail.from || '')}" placeholder="Compagnon de bord <contact@votre-domaine.fr>"></label>
          <label>Copie de toutes les notifications (facultatif)<input name="copy" type="email" value="${esc(s.mail.copy || '')}"></label>
        </div>
        <p class="muted">Les notifications partent vers l’e-mail de chaque concession (rubrique Concessions) et de ses comptes du back-office.</p>
        ${s.mailLast ? `<p class="${s.mailLast.ok ? 'muted' : 'error'}">Dernier envoi : ${s.mailLast.ok ? 'réussi' : 'échec'} (${formatDateTime(s.mailLast.at.replace('T', ' ').slice(0, 19))})${s.mailLast.error ? ' : ' + esc(s.mailLast.error) : ''}</p>` : ''}
        <div class="actions"><button class="btn primary">Enregistrer</button><input name="testto" type="email" placeholder="Adresse pour un test"><button type="button" class="btn" id="mail-test">Envoyer un e-mail de test</button></div>
      </form>`
          : ''
      }
      ${
        isAdmin()
          ? `<form class="card form" id="help-form">
        <h2>Vidéos de prise en main</h2>
        <p class="muted">Le bouton ❓ ouvre ces vidéos : celle de l’appli pour les clients, celle du back-office pour l’équipe. Mettez votre vidéo sur YouTube (en « non répertoriée » si vous ne voulez pas qu’on la trouve en cherchant) ou sur Vimeo, puis collez son lien ici. Un autre lien s’ouvre dans un nouvel onglet.</p>
        <label>Vidéo de l’appli (clients)<input name="app" type="url" value="${esc(s.help?.app || '')}" placeholder="https://youtu.be/…"></label>
        <label>Vidéo du back-office (équipe)<input name="admin" type="url" value="${esc(s.help?.admin || '')}" placeholder="https://youtu.be/…"></label>
        <button class="btn primary">Enregistrer</button>
      </form>`
          : ''
      }
      ${isAdmin() ? '<div class="card" id="backups"><h2>Sauvegardes</h2><p class="muted">Chargement…</p></div>' : ''}
      <form class="card form" id="password-form">
        <h2>Mon mot de passe</h2>
        <label>Mot de passe actuel<input name="currentPassword" type="password" required autocomplete="current-password"></label>
        <label>Nouveau mot de passe<input name="newPassword" type="password" required minlength="8" autocomplete="new-password"></label>
        <button class="btn">Changer le mot de passe</button>
      </form>`;
    el.querySelector('#announce-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('PUT', '/api/admin/settings', { announcement: new FormData(e.target).get('announcement') });
        toast('Message publié dans les applications');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    el.querySelector('#help-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api('PUT', '/api/admin/settings', { help: { app: f.get('app'), admin: f.get('admin') } });
        toast('Liens des vidéos enregistrés');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    const mailForm = el.querySelector('#mail-form');
    if (mailForm) {
      const mailData = () => {
        const f = new FormData(mailForm);
        return { host: f.get('host'), port: f.get('port'), user: f.get('user'), pass: f.get('pass'), from: f.get('from'), copy: f.get('copy') };
      };
      mailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api('PUT', '/api/admin/settings', { mail: mailData() });
          toast('Réglages des e-mails enregistrés');
          VIEWS.settings(el);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      el.querySelector('#mail-test').addEventListener('click', async (e) => {
        const to = mailForm.elements.testto.value.trim();
        if (!to) return toast('Indiquez une adresse pour le test', 'error');
        e.target.disabled = true;
        try {
          await api('PUT', '/api/admin/settings', { mail: mailData() });
          await api('POST', '/api/admin/settings/test-email', { to });
          toast(`E-mail de test envoyé à ${to}`);
        } catch (err) {
          toast(err.message, 'error');
        }
        VIEWS.settings(el);
      });
    }
    if (isAdmin()) drawBackups(el.querySelector('#backups'));
    el.querySelector('#password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        const r = await api('PUT', '/api/admin/password', { currentPassword: f.get('currentPassword'), newPassword: f.get('newPassword') });
        // The other devices are signed out; this one keeps a fresh session.
        if (r.token) setToken(r.token);
        toast('Mot de passe changé : vos autres appareils sont déconnectés');
        e.target.reset();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  },
};

registerCatalogViews(VIEWS, { api, openForm, pageHeader, bind, confirmDelete, thumb, isAdmin, canEditContent });
registerTipsView(VIEWS, { api, openForm, pageHeader, bind, confirmDelete, refreshTipsBadge });
const HELP = registerHelp(VIEWS, { api, openForm, pageHeader, confirmDelete, state, isAdmin, sectionLabel: (id) => (sections().find((x) => x[0] === id) || [])[2] || id });
registerBannersView(VIEWS, { api, openForm, pageHeader, bind, confirmDelete });
registerContentView(VIEWS, { api, openForm, pageHeader, bind, confirmDelete });
registerNotifsView(VIEWS, { api, openForm, pageHeader, bind, confirmDelete });
registerIdeasView(VIEWS, { esc, pageHeader });
registerAnalyticsView(VIEWS, { api, pageHeader, state, canSeeAll: () => isAdmin() || isAnalyst() });

// Registers a customer from the back-office (instead of the handover in the app) and hands over their access.
const NEEDS = { piece: 'Pièce détachée', remplacement: 'Remplacement de l’équipement', accessoire: 'Accessoire ou consommable' };

// What the store needs to identify the part. The VIN is never stored: the customer may send it in the e-mail only.
function partLines(r) {
  const p = r.part || {};
  return [
    ['Besoin', NEEDS[p.need] || 'Pièce détachée'],
    ['Client', [r.firstName, r.lastName].filter(Boolean).join(' ')],
    ['Véhicule', `${r.brandName} ${r.vehicleName}`],
    ['Garantie', r.warranty?.until ? (r.warranty.active ? `sous garantie jusqu’au ${formatDate(r.warranty.until)}` : `terminée le ${formatDate(r.warranty.until)}`) : '—'],
    ['Année du véhicule', p.vehicleYear || r.vehicleYear || (/\b(19|20)\d{2}\b/.exec(r.modelYear || '') || ['—'])[0]],
    ['N° de cellule', p.cellNumber || r.cellNumber || 'à demander au client'],
    ['Équipement', p.equipmentName || '—'],
    ['Pièce ou produit', p.product || '—'],
    ['Marque et modèle', p.model || '—'],
    ['Référence ou n° de série', p.ref || '—'],
    ['VIN', p.vinSent ? 'dans l’e-mail envoyé au magasin (non conservé ici)' : 'non communiqué : à demander au client (carte grise, case E)'],
  ];
}

function partCard(r) {
  return `<div class="part-card">
    ${r.part.photoUrl ? `<figure><a href="${esc(r.part.photoUrl)}" target="_blank"><img src="${esc(r.part.photoUrl)}" alt=""></a><figcaption class="muted">${r.part.photoKind === 'client' ? 'Photo du client' : 'Photo générique du modèle'}</figcaption></figure>` : '<div class="part-nophoto">Pas de photo</div>'}
    <dl class="facts">${partLines(r).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <button type="button" class="btn small" data-act="copypart" data-id="${r.id}">Copier la fiche pièce</button>
  </div>`;
}

async function newCustomer(el) {
  const [{ vehicles }, dealerships, team] = await Promise.all([
    loadCatalog(),
    isAdmin() ? api('GET', '/api/admin/dealerships') : Promise.resolve([]),
    isManager() ? api('GET', '/api/admin/salespeople') : Promise.resolve([]),
  ]);
  const active = vehicles.filter((v) => v.active);
  if (!active.length) return toast('Créez d’abord un véhicule (rubrique Véhicules)', 'error');
  openForm({
    title: 'Nouveau client',
    submitLabel: 'Enregistrer le client',
    values: { handoverDate: new Date().toISOString().slice(0, 10), sendEmail: true, dealershipId: dealerships[0]?.id },
    fields: [
      { name: 'vehicleId', label: 'Véhicule', type: 'select', required: true, options: active.map((v) => [v.id, `${v.brandName} — ${v.name}${v.modelYear ? ' ' + v.modelYear : ''}`]) },
      ...(isAdmin() ? [{ name: 'dealershipId', label: 'Concession', type: 'select', required: true, options: dealerships.map((d) => [d.id, d.name]) }] : []),
      ...(isManager()
        ? [{ name: 'salespersonId', label: 'Commercial qui suit ce client', type: 'select', options: [['', isAdmin() ? '— Aucun —' : '— Moi —'], ...team.map((u) => [u.id, `${u.name || u.email}${isAdmin() && u.dealershipId ? '' : ''}`])], hint: isAdmin() ? 'Il doit appartenir à la concession choisie.' : '' }]
        : []),
      { name: 'firstName', label: 'Prénom' },
      { name: 'lastName', label: 'Nom', required: true, hint: 'Le client le saisit avec son code d’accès.' },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'phone', label: 'Téléphone', type: 'tel' },
      { name: 'cellNumber', label: 'N° de cellule', hint: 'Plaque du constructeur de la cellule.' },
      { name: 'vehicleYear', label: 'Année du véhicule' },
      { name: 'warrantyEnd', label: 'Fin de garantie', type: 'date', hint: 'Vide : garantie habituelle de la concession à partir de la mise en main.' },
      { name: 'warrantyExtEnd', label: 'Extension de garantie jusqu’au', type: 'date' },
      { name: 'handoverDate', label: 'Date de mise en main', type: 'date' },
      { name: 'sendEmail', label: 'Envoyer au client son code d’accès et un bouton « Ouvrir mon application » par e-mail', type: 'checkbox', full: true },
    ],
    onSubmit: async (data) => {
      const c = await api('POST', '/api/admin/customers', data);
      showAccess(c, c.accessCode, () => customerDetail(el, c.id));
    },
  });
}

// Shows a customer's access code and app link, ready to copy, text or e-mail.
function showAccess(c, code, onClose) {
  const dialog = document.createElement('dialog');
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  const sms = `Bonjour${c.firstName ? ' ' + c.firstName : ''}, voici votre application Compagnon de bord : ${c.appLink}\nVotre code d’accès : ${code} (avec votre nom : ${c.lastName})`;
  const phone = String(c.phone || '').replace(/[^\d+]/g, '');
  dialog.innerHTML = `<form method="dialog" class="dialog-form">
    <header><h2>Accès de ${esc(name)}</h2><button class="icon" aria-label="Fermer">✕</button></header>
    <div class="access-box">
      ${c.emailSent ? `<p class="ok-note">✅ E-mail envoyé à ${esc(c.email)}.</p>` : c.sendEmail === false || !c.email ? '' : '<p class="warn-note">⚠️ L’e-mail n’a pas pu partir : vérifiez Paramètres → Envoi des e-mails, ou transmettez le code ci-dessous.</p>'}
      <p class="muted">Code d’accès à transmettre au client (valable jusqu’au ${formatDate(c.expiresAt)}). Dans l’application : « J’ai déjà un code d’accès », puis son nom <strong>${esc(c.lastName)}</strong> et ce code.</p>
      <p class="big-code">${esc(code)}</p>
      <label>Lien qui ouvre l’application déjà connectée <small class="hint">(une seule fois, pendant 14 jours)</small>
        <span class="copy-row"><input readonly value="${esc(c.appLink)}"><button type="button" class="btn" data-copy>Copier</button></span></label>
      <div class="actions">
        ${phone ? `<a class="btn" href="sms:${esc(phone)}?&body=${encodeURIComponent(sms)}">📱 Envoyer par SMS</a>` : ''}
        <button type="button" class="btn" data-copy-all>Copier le message pour le client</button>
      </div>
    </div>
    <footer><button class="btn primary">Terminé</button></footer>
  </form>`;
  document.body.appendChild(dialog);
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copié');
    } catch {
      prompt('Copiez ce texte :', text);
    }
  };
  dialog.querySelector('[data-copy]').onclick = () => copy(c.appLink);
  dialog.querySelector('[data-copy-all]').onclick = () => copy(sms);
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
  });
  dialog.showModal();
}

// ---------- Back-office accounts (Utilisateurs, and the team in a dealership's page) ----------

function userRow(u, { showDealership }) {
  return `<tr>
    <td><strong>${esc(u.name || '')}</strong></td><td>${esc(u.email)}${u.phone ? `<br><small>${esc(u.phone)}</small>` : ''}</td>
    <td>${esc(ROLE_LABELS[u.role] || u.role)}</td>
    ${showDealership ? `<td>${u.dealershipId ? `<button class="lnk" data-act="dealer" data-id="${u.dealershipId}">${esc(u.dealershipName || '')}</button>` : u.role === 'analytics' ? `<span class="muted">${u.dealershipIds?.length ? `${u.dealershipIds.length} concession${u.dealershipIds.length > 1 ? 's' : ''} suivie${u.dealershipIds.length > 1 ? 's' : ''}` : 'Toutes les concessions'}</span>` : '<span class="muted">—</span>'}</td>` : ''}
    <td>${['admin', 'editor', 'analytics'].includes(u.role) ? '' : u.customerCount}</td>
    <td class="row-actions"><button class="btn small" data-act="edit" data-id="${u.id}">Modifier</button>${
      u.customerCount ? `<button class="btn small" data-act="transfer" data-id="${u.id}">Transférer ses clients</button>` : ''
    }${u.id !== state.user.id ? `<button class="btn small danger" data-act="del" data-id="${u.id}">Supprimer</button>` : ''}</td>
  </tr>`;
}

// Add / edit / transfer / delete, shared by both pages. `dealershipId` pre-fills the dealership of a new account.
function userActions(users, dealerships, reload, { dealershipId } = {}) {
  const roles = [['sales', 'Commercial'], ['sav', 'SAV / atelier'], ['store', 'Magasin'], ['manager', 'Responsable de concession'], ...(isAdmin() ? [['editor', 'Éditeur de contenu'], ['analytics', 'Analyste (statistiques)'], ['admin', 'Administrateur']] : [])];
  const fields = (isNew) => [
    { name: 'name', label: 'Nom (affiché au client pour un commercial)' },
    { name: 'email', label: 'E-mail (identifiant)', type: 'email', required: true },
    { name: 'phone', label: 'Téléphone (affiché au client)', type: 'tel' },
    { name: 'role', label: 'Rôle', type: 'select', options: roles },
    ...(isAdmin() ? [{ name: 'dealershipId', label: 'Concession', type: 'select', options: [['', '—'], ...dealerships.map((d) => [d.id, d.name])], hideIf: ['role', ['admin', 'editor', 'analytics']] }] : []),
    ...(isAdmin()
      ? [{ name: 'dealershipIds', label: 'Concessions suivies par l’analyste', type: 'checks', showIf: ['role', 'analytics'], options: dealerships.map((d) => [d.id, d.name]), hint: 'Pour un groupement de concessions : cochez celles qu’il peut suivre. Rien de coché : toutes les concessions.' }]
      : []),
    { name: 'password', label: isNew ? 'Mot de passe' : 'Nouveau mot de passe (laisser vide pour ne pas changer)', type: 'password', required: isNew, attrs: 'minlength="8" autocomplete="new-password"' },
  ];
  return {
    add: () =>
      openForm({
        title: 'Nouveau compte',
        fields: fields(true),
        values: { role: 'sales', dealershipId: dealershipId ?? dealerships[0]?.id },
        onSubmit: async (data) => {
          await api('POST', '/api/admin/users', data);
          toast('Compte créé');
          reload();
        },
      }),
    edit: (id) => {
      const u = users.find((x) => x.id === id);
      openForm({
        title: 'Modifier le compte',
        fields: fields(false),
        values: { ...u, role: u.role === 'dealer' ? 'manager' : u.role },
        onSubmit: async (data) => {
          await api('PUT', `/api/admin/users/${id}`, data);
          toast('Compte enregistré');
          reload();
        },
      });
    },
    transfer: (id) => {
      const from = users.find((x) => x.id === id);
      const others = users.filter((u) => u.id !== id && ['manager', 'dealer', 'sales'].includes(u.role) && u.dealershipId === from.dealershipId);
      openForm({
        title: `Transférer les ${from.customerCount} clients de ${from.name || from.email}`,
        submitLabel: 'Transférer',
        fields: [{ name: 'toUserId', label: 'Vers', type: 'select', options: [['', '— Personne (clients sans commercial) —'], ...others.map((u) => [u.id, `${u.name || u.email} (${ROLE_LABELS[u.role]})`])] }],
        values: { toUserId: others[0]?.id || '' },
        onSubmit: async (data) => {
          const r = await api('POST', `/api/admin/users/${id}/transfer`, { toUserId: data.toUserId || null });
          toast(`${r.moved} client${r.moved > 1 ? 's' : ''} transféré${r.moved > 1 ? 's' : ''}`);
          reload();
        },
      });
    },
    del: async (id) => {
      if (!confirm('Supprimer ce compte ?')) return;
      try {
        await api('DELETE', `/api/admin/users/${id}`);
        toast('Supprimé');
        reload();
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    dealer: (id) => dealershipDetail(document.getElementById('content'), id),
  };
}

// ---------- A dealership's page: its details and everyone attached to it ----------

function dealershipFields() {
  return [
    { name: 'name', label: 'Nom', required: true },
    { name: 'code', label: 'Code concession', hint: 'Lettres et chiffres, 4 à 16 caractères. Vide = généré automatiquement.' },
    { name: 'city', label: 'Ville' },
    { name: 'phone', label: 'Téléphone', type: 'tel' },
    { name: 'email', label: 'E-mail', type: 'email' },
    { name: 'warrantyYears', label: 'Garantie habituelle (années)', type: 'number', attrs: 'min="0" max="15"', hint: 'À partir de la mise en main. Ajustable pour chaque client.' },
    { name: 'savEmail', label: 'SAV : e-mail (reçoit les demandes du SAV)', type: 'email', hint: 'Vide : l’e-mail de la concession.' },
    { name: 'savPhone', label: 'SAV : téléphone (affiché au client)', type: 'tel' },
    { name: 'savHours', label: 'SAV : horaires', full: true },
    { name: 'storeEmail', label: 'Magasin : e-mail (reçoit les demandes du magasin)', type: 'email', hint: 'Vide : celui du SAV.' },
    { name: 'storePhone', label: 'Magasin : téléphone (affiché au client)', type: 'tel' },
    { name: 'storeHours', label: 'Magasin : horaires', full: true },
    { name: 'storeAddress', label: 'Magasin : adresse (s’il est détaché)', full: true },
    { name: 'storeDetached', label: 'Magasin détaché (indépendant : la concession ne voit pas ses demandes)', type: 'checkbox', full: true },
    { name: 'hours', label: 'Horaires affichés dans l’appli', full: true },
    { name: 'website', label: 'Site web (ouvert en touchant le logo dans l’appli)', full: true, attrs: 'placeholder="www.ma-concession.fr"' },
    { name: 'logo', label: 'Logo de la concession (affiché dans l’appli)', type: 'image' },
    { name: 'active', label: 'Active (le code fonctionne)', type: 'checkbox' },
  ].filter((f) => isAdmin() || !['code', 'active'].includes(f.name)); // the code stays with the administrator
}

function editDealership(d, reload) {
  openForm({
    title: 'Modifier la concession',
    fields: dealershipFields(),
    values: { ...d, logo: d.logoUrl },
    onSubmit: async (data) => {
      await api('PUT', `/api/admin/dealerships/${d.id}`, data);
      toast('Concession enregistrée');
      reload();
    },
  });
}


async function dealershipDetail(el, id) {
  const [dealerships, users] = await Promise.all([api('GET', '/api/admin/dealerships'), isManager() ? api('GET', '/api/admin/users') : Promise.resolve([])]);
  const d = dealerships.find((x) => x.id === id);
  if (!d) return VIEWS.dealerships(el);
  const team = users.filter((u) => u.dealershipId === id).sort((a, b) => ROLE_ORDER.indexOf(a.role === 'dealer' ? 'manager' : a.role) - ROLE_ORDER.indexOf(b.role === 'dealer' ? 'manager' : b.role) || norm(a.name || a.email).localeCompare(norm(b.name || b.email)));
  const count = (r) => team.filter((u) => (u.role === 'dealer' ? 'manager' : u.role) === r).length;
  const fact = (label, value) => `<div><dt>${label}</dt><dd>${value || '<span class="muted">—</span>'}</dd></div>`;
  el.innerHTML = `${pageHeader(
    d.name,
    `${isAdmin() ? '<button class="btn" data-act="back">← Concessions</button>' : ''}${isManager() ? '<button class="btn" data-act="editdealer">Modifier la concession</button>' : ''}`
  )}
    <div class="detail-grid">
      <div class="card">
        <h2>Concession ${d.active ? '<span class="status resolu">Active</span>' : '<span class="status">Désactivée</span>'}</h2>
        <dl class="facts">
          ${fact('Code concession', d.code ? `<code class="code">${esc(d.code)}</code>` : '')}
          ${fact('Ville', esc(d.city || ''))}
          ${fact('Accueil', [esc(d.phone || ''), esc(d.email || '')].filter(Boolean).join('<br>'))}
          ${fact('Garantie habituelle', `${d.warrantyYears ?? 2} an${(d.warrantyYears ?? 2) > 1 ? 's' : ''}`)}
          ${fact('SAV / atelier', [esc(d.savPhone || ''), esc(d.savEmail || ''), d.savHours ? `<small>${esc(d.savHours)}</small>` : ''].filter(Boolean).join('<br>'))}
          ${fact(`Magasin${d.storeDetached ? ' (détaché)' : ''}`, [esc(d.storePhone || ''), esc(d.storeEmail || ''), d.storeAddress ? `<small>${esc(d.storeAddress)}</small>` : '', d.storeHours ? `<small>${esc(d.storeHours)}</small>` : ''].filter(Boolean).join('<br>'))}
          ${fact('Clients', `${d.customerCount} <button class="btn small" data-act="customers">Voir les clients</button>`)}
          ${fact('Comptes', String(team.length || d.userCount || 0))}
        </dl>
      </div>
      ${isManager() ? `<div class="card">
        <h2>Équipe</h2>
        <div class="filters">${['manager', 'sales', 'sav', 'store'].map((r) => `<span class="chip">${esc(ROLE_LABELS[r])} : ${count(r)}</span>`).join('')}</div>
        ${count('manager') ? '' : '<p class="error">Aucun responsable de concession.</p>'}
        ${count('sav') ? '' : '<p class="muted">Pas de compte SAV : les demandes SAV arrivent quand même par e-mail.</p>'}
        <button class="btn primary" data-act="add">＋ Ajouter un compte à cette concession</button>
      </div>` : ''}
    </div>
    ${
      isManager()
        ? `<div class="card"><h2>Comptes rattachés (${team.length})</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Nom</th><th>Contact</th><th>Rôle</th><th>Clients suivis</th><th></th></tr></thead>
        <tbody>${team.map((u) => userRow(u, { showDealership: false })).join('')}</tbody>
      </table>${team.length ? '' : '<p class="muted">Aucun compte rattaché pour l’instant.</p>'}</div></div>`
        : ''
    }`;
  bind(el, {
    ...userActions(users, dealerships, () => dealershipDetail(el, id), { dealershipId: id }),
    back: () => VIEWS.dealerships(el),
    editdealer: () => editDealership(d, () => dealershipDetail(el, id)),
    customers: () => {
      if (isAdmin()) state.filter.customerQuery = '';
      state.filter.customerMine = false;
      state.filter.customerDealership = id;
      location.hash = 'customers';
    },
  });
}

// Daily copies of the database (made by the server), to download and keep elsewhere.
async function drawBackups(box) {
  const { keep, fullKeep, backups, full = [] } = await api('GET', '/api/admin/backups');
  const size = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(n / 1024)} Ko`);
  const rows = (list, from) =>
    `<div class="table-wrap"><table><thead><tr><th>Jour</th><th>Taille</th><th></th></tr></thead><tbody>${list
      .map((b) => `<tr><td>${formatDate(b.name.slice(from, from + 10))}</td><td>${size(b.size)}</td><td class="row-actions"><button class="btn small" data-dl="${esc(b.name)}">Télécharger</button></td></tr>`)
      .join('')}</tbody></table></div>`;
  box.innerHTML = `<h2>Sauvegardes</h2>
    <h3>Sauvegarde complète (pour remettre le site en ligne)</h3>
    <p class="muted">Un seul fichier avec <strong>tout ce qui n’est pas le code</strong> : la base (clients, demandes, contenus, comptes), <strong>les photos</strong> et les clés du site. Faite chaque semaine (les ${fullKeep} dernières sont gardées). <strong>Téléchargez-la sur votre ordinateur</strong> de temps en temps : c’est la vraie sécurité si le serveur a un problème. Fichier confidentiel : gardez-le en lieu sûr.</p>
    ${full.length ? rows(full, 5) : '<p>Aucune sauvegarde complète pour l’instant.</p>'}
    <div class="actions"><button class="btn primary" data-now="full">Faire une sauvegarde complète maintenant</button></div>
    <h3>Base seule, chaque jour</h3>
    <p class="muted">La base est aussi copiée chaque jour (les ${keep} derniers jours), pour revenir à la veille en cas d’erreur.</p>
    ${backups.length ? rows(backups, 4) : '<p>Aucune sauvegarde pour l’instant : la première se fait dans l’heure qui suit le démarrage du site.</p>'}
    <div class="actions"><button class="btn" data-now="db">Sauvegarder la base maintenant</button></div>`;
  box.onclick = async (e) => {
    const dl = e.target.closest('[data-dl]');
    try {
      const now = e.target.closest('[data-now]');
      if (now) {
        now.disabled = true;
        now.textContent = 'Sauvegarde en cours…';
        await api('POST', '/api/admin/backups', { full: now.dataset.now === 'full' });
        toast(now.dataset.now === 'full' ? 'Sauvegarde complète faite : téléchargez-la' : 'Sauvegarde faite');
        return drawBackups(box);
      }
      if (!dl) return;
      const res = await fetch(`/api/admin/backups/${encodeURIComponent(dl.dataset.dl)}`, { headers: { Authorization: `Bearer ${state.token}` } });
      if (!res.ok) throw new Error('Téléchargement impossible');
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: `compagnon-${dl.dataset.dl}` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

async function customerDetail(el, id) {
  const [c, { vehicles }, dealerships] = await Promise.all([
    api('GET', `/api/admin/customers/${id}`),
    loadCatalog(),
    api('GET', '/api/admin/dealerships'),
  ]);
  const team = c.canReassign ? await api('GET', `/api/admin/salespeople?dealershipId=${c.dealershipId}`) : [];
  el.innerHTML = `${pageHeader(
    [c.firstName, c.lastName].filter(Boolean).join(' '),
    `<button class="btn" data-act="back">← Retour</button>
     ${c.canManage ? '<button class="btn" data-act="edit">Modifier</button><button class="btn" data-act="recovery">Nouveau code d’accès</button><button class="btn" data-act="signout">Déconnecter ses téléphones</button>' : ''}
     ${isAdmin() ? '<button class="btn danger" data-act="del">Supprimer</button>' : ''}`
  )}
    ${c.canManage ? '' : `<div class="card warn-card">Ce client est suivi par ${esc(c.salespersonName || 'un autre commercial')} : vous pouvez consulter sa fiche, mais pas la modifier. Le responsable de la concession peut vous le confier.</div>`}
    <div class="detail-grid">
      <div class="card">
        <dl class="facts">
          <div><dt>Véhicule</dt><dd>${esc(c.brandName)} ${esc(c.vehicleName)}</dd></div>
          <div><dt>N° de cellule</dt><dd>${esc(c.cellNumber || '—')}</dd></div>
          <div><dt>Année du véhicule</dt><dd>${esc(c.vehicleYear || (/\b(19|20)\d{2}\b/.exec(c.modelYear || '') || ['—'])[0])}</dd></div>
          <div><dt>VIN</dt><dd class="muted">Conservé seulement sur le téléphone du client</dd></div>
          <div><dt>Mise en main</dt><dd>${formatDate(c.handoverDate)}</dd></div>
          <div><dt>Garantie</dt><dd>${
            c.warranty?.until
              ? `${c.warranty.active ? '🛡️ ' : ''}${c.warranty.active ? 'Sous ' : 'Terminée : '}${c.warranty.extended ? 'extension ' : 'garantie '}${c.warranty.active ? 'jusqu’au ' : 'le '}${formatDate(c.warranty.extended || !c.warranty.active ? c.warranty.until : c.warranty.end || c.warranty.until)}${
                  c.warranty.extEnd && !c.warranty.extended && c.warranty.active ? `<br>puis extension jusqu’au ${formatDate(c.warranty.extEnd)}` : ''
                }<br><small class="muted">Pendant la garantie, ses demandes de pièces vont au SAV ; ensuite au magasin.</small>`
              : '—'
          }${c.canManage ? '<br><button class="btn small" data-act="warranty">Modifier la garantie</button>' : ''}</dd></div>
          <div><dt>Concession</dt><dd>${esc(c.dealershipName)}</dd></div>
          <div><dt>Commercial</dt><dd>${
            c.canReassign
              ? `<select data-salesperson><option value="">— Aucun —</option>${team.map((u) => `<option value="${u.id}" ${u.id === c.salespersonId ? 'selected' : ''}>${esc(u.name || u.email)}</option>`).join('')}</select>`
              : esc(c.salespersonName || '—')
          }</dd></div>
          <div><dt>E-mail</dt><dd>${esc(c.email || '—')}${c.email && c.emailNotify === 0 ? ' <small class="muted">(ne veut pas recevoir les réponses par e-mail)</small>' : ''}</dd></div>
          <div><dt>Téléphone</dt><dd>${esc(c.phone || '—')}</dd></div>
          <div><dt>Conseils et offres</dt><dd>${c.marketingOptin === 1 ? `Accepte${c.marketingOptinAt ? ` <small class="muted">(le ${formatDate(c.marketingOptinAt.slice(0, 10))})</small>` : ''}` : c.marketingOptin === 0 ? 'Refuse' : '<span class="muted">Pas encore répondu</span>'}</dd></div>
          <div><dt>Code d’accès</dt><dd>${
            c.accessCode
              ? `<code class="code">${esc(c.accessCode)}</code> <button class="btn small" data-act="copycode">Copier</button> <button class="btn small primary" data-act="resend">Renvoyer au client</button><br><small class="muted">Valable jusqu’au ${formatDate(c.accessExpiresAt.slice(0, 10))}</small>`
              : c.accessExpiresAt
                ? `créé avant cette version, il ne peut pas être réaffiché : utilisez « Nouveau code d’accès » (valable jusqu’au ${formatDate(c.accessExpiresAt.slice(0, 10))})`
                : 'pas encore généré'
          }</dd></div>
          ${c.nickname ? `<div><dt>Petit nom du véhicule</dt><dd>« ${esc(c.nickname)} »</dd></div>` : ''}
          <div><dt>Contrôle de mise en main</dt><dd>${c.handover.steps}/5 points${c.handover.validatedOn ? ` · validée le ${esc(c.handover.validatedOn)}` : ''}</dd></div>
          <div><dt>Dernière sauvegarde de l’appli</dt><dd>${c.stateUpdatedAt ? formatDate(c.stateUpdatedAt) : '—'}</dd></div>
        </dl>
      </div>
      <div class="card">
        <h2>Photos du client (${c.photos.length})</h2>
        ${c.photos.length ? `<div class="photos">${c.photos.map((p) => `<a href="${esc(p.url)}" target="_blank" title="${esc(p.name)}"><img src="${esc(p.url)}" alt=""></a>`).join('')}</div>` : '<p class="muted">Aucune photo.</p>'}
        <h2>Modèles et numéros notés (${c.models.length})</h2>
        ${c.models.length ? `<ul>${c.models.map((m) => `<li><strong>${esc(m.name)}</strong> : ${esc([m.model, m.ref && 'réf. ' + m.ref].filter(Boolean).join(', '))}</li>`).join('')}</ul>` : '<p class="muted">Aucun.</p>'}
        ${c.customEquipment.length ? `<h2>Équipements ajoutés par le client</h2><p>${esc(c.customEquipment.join(', '))}</p>` : ''}
      </div>
    </div>
    <div class="card">
      <h2>Équipements cochés (${c.equipmentOwned ? c.equipmentOwned.length : 'liste du véhicule'})</h2>
      <p class="muted">${esc((c.equipmentOwned || []).join(' · ') || 'Le client n’a pas encore modifié la liste pré-cochée de son véhicule.')}</p>
    </div>
    ${
      c.entretien
        ? `<div class="card"><h2>Entretien</h2>
      <p class="muted">Échéances calculées depuis la mise en main et le carnet que le client tient dans son application (il reçoit un rappel sur son téléphone).</p>
      <div class="detail-grid"><div><h3>Prochaines échéances</h3><ul>${c.entretien.items
        .map((i) => `<li><strong>${esc(i.label)}</strong> : ${formatDate(i.due)} ${i.state === 'late' ? '<span class="status nouveau">En retard</span>' : i.state === 'soon' ? '<span class="status en_cours">Bientôt</span>' : ''}</li>`)
        .join('') || '<li class="muted">Pas de date de mise en main.</li>'}</ul></div>
      <div><h3>Carnet d’entretien</h3><ul>${c.entretien.log.map((e) => `<li>${formatDate(e.doneOn)} · ${esc(e.label)}${e.note ? ` <small class="muted">— ${esc(e.note)}</small>` : ''}</li>`).join('') || '<li class="muted">Rien de noté par le client.</li>'}</ul></div></div></div>`
        : ''
    }
    <div class="card">
      <h2>Demandes (${c.reports.length})</h2>
      ${
        c.reports.length
          ? c.reports
              .map((r) => `<div class="report-line"><span class="status ${esc(r.status)}">${STATUS[r.status]}</span> <strong>${esc(r.title)}</strong> <small class="muted">${formatDate(r.createdAt)}</small></div>`)
              .join('')
          : '<p class="muted">Aucune demande.</p>'
      }
    </div>`;
  el.querySelector('[data-salesperson]')?.addEventListener('change', async (e) => {
    try {
      await api('PUT', `/api/admin/customers/${id}`, { salespersonId: e.target.value || null });
      toast(e.target.value ? `Client confié à ${e.target.selectedOptions[0].textContent}` : 'Client sans commercial');
    } catch (err) {
      toast(err.message, 'error');
      customerDetail(el, id);
    }
  });
  bind(el, {
    copycode: async () => {
      try {
        await navigator.clipboard.writeText(c.accessCode);
        toast('Code copié');
      } catch {
        prompt('Code d’accès :', c.accessCode);
      }
    },
    resend: async () => {
      const sendEmail = !!c.email && confirm(`Renvoyer le code et le bouton « Ouvrir mon application » par e-mail à ${c.email} ?\n(Annuler : afficher le code et le lien à copier ou envoyer par SMS)`);
      try {
        const res = await api('POST', `/api/admin/customers/${id}/resend`, { sendEmail });
        showAccess({ ...c, ...res }, res.accessCode, () => customerDetail(el, id));
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    back: () => VIEWS.customers(el),
    warranty: () =>
      openForm({
        title: 'Modifier la garantie',
        values: c,
        fields: [
          { name: 'warrantyEnd', label: 'Fin de garantie', type: 'date', hint: 'Vide : garantie habituelle de la concession à partir de la mise en main.' },
          { name: 'warrantyExtEnd', label: 'Extension de garantie jusqu’au', type: 'date', hint: 'Vide : pas d’extension.' },
          { name: 'handoverDate', label: 'Date de mise en main', type: 'date' },
        ],
        onSubmit: async (data) => {
          await api('PUT', `/api/admin/customers/${id}`, data);
          toast('Garantie enregistrée');
          customerDetail(el, id);
        },
      }),
    edit: () =>
      openForm({
        title: 'Modifier le client',
        values: c,
        fields: [
          { name: 'firstName', label: 'Prénom' },
          { name: 'lastName', label: 'Nom', required: true },
          { name: 'email', label: 'E-mail', type: 'email' },
          { name: 'phone', label: 'Téléphone', type: 'tel' },
              { name: 'cellNumber', label: 'N° de cellule' },
          { name: 'vehicleYear', label: 'Année du véhicule' },
          { name: 'warrantyEnd', label: 'Fin de garantie', type: 'date', hint: 'Vide : garantie habituelle de la concession.' },
          { name: 'warrantyExtEnd', label: 'Extension de garantie jusqu’au', type: 'date' },
          { name: 'handoverDate', label: 'Date de mise en main', type: 'date' },
          { name: 'vehicleId', label: 'Véhicule', type: 'select', options: vehicles.map((v) => [v.id, `${v.brandName} — ${v.name}`]) },
          ...(isAdmin() ? [{ name: 'dealershipId', label: 'Concession', type: 'select', options: dealerships.map((d) => [d.id, d.name]) }] : []),
        ],
        onSubmit: async (data) => {
          await api('PUT', `/api/admin/customers/${id}`, data);
          toast('Client enregistré');
          customerDetail(el, id);
        },
      }),
    // Lost or stolen phone: the customer's devices are signed out (they come back with their access code).
    signout: async () => {
      if (!confirm('Déconnecter tous les téléphones de ce client (téléphone perdu ou volé) ? Il pourra revenir avec son code d’accès.')) return;
      try {
        const r = await api('POST', `/api/admin/customers/${id}/signout`);
        toast(`${r.sessions} téléphone(s) déconnecté(s)`);
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    recovery: async () => {
      if (!confirm('Générer un nouveau code d’accès (code perdu ou renouvellement) ? L’ancien code ne fonctionnera plus.')) return;
      const sendEmail = !!c.email && confirm(`Envoyer aussi le nouveau code et le bouton « Ouvrir mon application » par e-mail à ${c.email} ?`);
      try {
        const res = await api('POST', `/api/admin/customers/${id}/recovery-code`, { sendEmail });
        showAccess({ ...c, ...res, sendEmail }, res.recoveryCode, () => customerDetail(el, id));
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    del: () =>
      confirmDelete('Supprimer définitivement ce client et toutes ses données (photos, équipements, demandes) ?', async () => {
        await api('DELETE', `/api/admin/customers/${id}`);
        state.section = 'customers';
      }),
  });
}

// ---------- Start ----------

(async function start() {
  state.section = location.hash.slice(1) || 'dashboard';
  // Without a token, still try: the server may be in open-access (test) mode.
  try {
    state.user = await api('GET', '/api/admin/me');
    renderShell();
  } catch {
    renderLogin();
  }
})();
