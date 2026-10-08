import { esc, multiline, formatDate, createApi, pickImage, toast } from '/shared/common.js';

const TOKEN_KEY = 'cc-admin-token';
const SEVERITY = { info: 'Info', attention: 'Attention', urgent: 'Urgent' };
const STATUS = { nouveau: 'Nouveau', en_cours: 'En cours', resolu: 'Résolu' };

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

// ---------- Login ----------

function renderLogin() {
  root.innerHTML = `<div class="login">
    <form class="card" id="login-form">
      <img src="/admin/icon.svg" alt="" width="56" height="56">
      <h1>Back-office Camping-Car</h1>
      <label>E-mail<input name="email" type="email" required autocomplete="username"></label>
      <label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="btn primary">Se connecter</button>
    </form>
  </div>`;
  root.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const res = await api('POST', '/api/admin/login', { email: f.get('email'), password: f.get('password') });
      setToken(res.token);
      state.user = res.user;
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
    ['reports', '💬', 'Signalements', true],
    ['customers', '👥', 'Clients', true],
    ['vehicles', '🚐', 'Véhicules', isAdmin()],
    ['problems', '🛠️', 'Problèmes / dépannage', isAdmin()],
    ['brands', '🏷️', 'Marques', isAdmin()],
    ['dealerships', '🏢', isAdmin() ? 'Concessions' : 'Ma concession', true],
    ['users', '🔑', 'Utilisateurs', isAdmin()],
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
        <small>${isAdmin() ? 'Administrateur' : 'Concession'}</small>
        <button class="btn small" id="logout">Se déconnecter</button>
      </div>
    </aside>
    <main class="content" id="content"></main>
  </div>`;
  root.querySelector('#logout').addEventListener('click', logout);
  showSection(state.section);
}

async function showSection(id) {
  if (!sections().some((s) => s[0] === id)) id = 'dashboard';
  state.section = id;
  root.querySelectorAll('.sidebar a').forEach((a) => a.classList.toggle('active', a.dataset.section === id));
  const content = document.getElementById('content');
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
    switch (f.type) {
      case 'textarea':
        return `<label class="${cls}">${label}<textarea name="${f.name}" rows="${f.rows || 5}" ${req}>${esc(v ?? '')}</textarea>${hint}</label>`;
      case 'select':
        return `<label class="${cls}">${label}<select name="${f.name}" ${req}>${f.options
          .map(([val, text]) => `<option value="${esc(val)}" ${String(v ?? '') === String(val) ? 'selected' : ''}>${esc(text)}</option>`)
          .join('')}</select>${hint}</label>`;
      case 'checkbox':
        return `<label class="check ${cls}"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}> ${label}</label>`;
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
        return `<label class="${cls}">${label}<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v ?? '')}" ${req} ${f.attrs || ''}>${hint}</label>`;
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

  const close = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.querySelectorAll('[data-close]').forEach((b) => (b.onclick = close));
  dialog.addEventListener('cancel', close);

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
    const tiles = [
      ['Signalements ouverts', s.openReports, 'reports'],
      ['Clients', s.customers, 'customers'],
      ...(isAdmin()
        ? [
            ['Véhicules', s.vehicles, 'vehicles'],
            ['Fiches dépannage', s.problems, 'problems'],
            ['Marques', s.brands, 'brands'],
            ['Concessions', s.dealerships, 'dealerships'],
          ]
        : []),
    ];
    el.innerHTML = `${pageHeader('Tableau de bord')}
      <div class="tiles">${tiles.map(([label, n, link]) => `<a class="tile" href="#${link}"><strong>${n}</strong><span>${esc(label)}</span></a>`).join('')}</div>
      <div class="card">
        <h2>Fonctionnement</h2>
        <ul>
          <li>Toute modification des véhicules, marques ou fiches de dépannage est <strong>immédiatement visible</strong> dans l'application des clients (version du contenu : ${s.contentVersion}).</li>
          <li>La mise en main se fait dans l'application du client : la concession saisit son <strong>code concession</strong>, choisit la <strong>marque</strong> puis le <strong>véhicule</strong>.</li>
          <li>Les photos, notes et signalements des clients sont sauvegardés dans le cloud et visibles ici.</li>
          <li>Application client : <a href="/app/" target="_blank">${esc(location.origin)}/app/</a></li>
        </ul>
      </div>`;
  },

  async reports(el) {
    const status = state.filter.reportStatus ?? 'open';
    const all = await api('GET', '/api/admin/reports');
    const list = all.filter((r) => (status === 'open' ? r.status !== 'resolu' : status === 'all' || r.status === status));
    el.innerHTML = `${pageHeader('Signalements clients')}
      <div class="filters">${[
        ['open', 'À traiter'],
        ['nouveau', 'Nouveaux'],
        ['en_cours', 'En cours'],
        ['resolu', 'Résolus'],
        ['all', 'Tous'],
      ]
        .map(([v, l]) => `<button class="chip ${status === v ? 'active' : ''}" data-act="filter" data-value="${v}">${l}</button>`)
        .join('')}</div>
      <div class="cards">${
        list.length
          ? list
              .map(
                (r) => `<div class="card report">
            <div class="report-head">
              <div><strong>${esc(r.title)}</strong><br><small class="muted">${formatDate(r.createdAt)} · ${esc([r.firstName, r.lastName].filter(Boolean).join(' '))} · ${esc(r.vehicleName)}${r.plate ? ` · ${esc(r.plate)}` : ''}${isAdmin() ? ` · ${esc(r.dealershipName)}` : ''}</small></div>
              <span class="status ${esc(r.status)}">${STATUS[r.status]}</span>
            </div>
            ${r.problemTitle ? `<p class="muted">Fiche liée : ${esc(r.problemTitle)}</p>` : ''}
            ${r.description ? `<p>${multiline(r.description)}</p>` : ''}
            ${r.photos.length ? `<div class="photos">${r.photos.map((u) => `<a href="${esc(u)}" target="_blank"><img src="${esc(u)}" alt=""></a>`).join('')}</div>` : ''}
            ${r.dealerReply ? `<div class="reply"><strong>Réponse :</strong> ${multiline(r.dealerReply)}</div>` : ''}
            <div class="actions">
              ${r.phone ? `<a class="btn small" href="tel:${esc(r.phone)}">📞 ${esc(r.phone)}</a>` : ''}
              ${r.email ? `<a class="btn small" href="mailto:${esc(r.email)}">✉️ ${esc(r.email)}</a>` : ''}
              <button class="btn small primary" data-act="answer" data-id="${r.id}">Répondre / changer le statut</button>
            </div>
          </div>`
              )
              .join('')
          : '<p class="muted">Aucun signalement.</p>'
      }</div>`;
    bind(el, {
      filter: (_, b) => {
        state.filter.reportStatus = b.dataset.value;
        VIEWS.reports(el);
      },
      answer: (id) => {
        const r = all.find((x) => x.id === id);
        openForm({
          title: r.title,
          values: r,
          fields: [
            { name: 'status', label: 'Statut', type: 'select', options: Object.entries(STATUS) },
            { name: 'dealerReply', label: 'Réponse au client (visible dans son application)', type: 'textarea' },
          ],
          onSubmit: async (data) => {
            await api('PUT', `/api/admin/reports/${id}`, data);
            toast('Signalement mis à jour');
            VIEWS.reports(el);
          },
        });
      },
    });
  },

  async customers(el) {
    const q = state.filter.customerQuery || '';
    const list = await api('GET', `/api/admin/customers?q=${encodeURIComponent(q)}`);
    el.innerHTML = `${pageHeader('Clients')}
      <form class="search-bar" id="customer-search"><input name="q" type="search" placeholder="Nom, e-mail, immatriculation, VIN…" value="${esc(q)}"><button class="btn">Rechercher</button></form>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Client</th><th>Véhicule</th><th>Immat.</th>${isAdmin() ? '<th>Concession</th>' : ''}<th>Mise en main</th><th>Signal.</th><th></th></tr></thead>
        <tbody>${list
          .map(
            (c) => `<tr>
          <td>${thumb(c.coverPhotoUrl)}</td>
          <td><strong>${esc([c.firstName, c.lastName].filter(Boolean).join(' '))}</strong><br><small class="muted">${esc(c.email || '')}</small></td>
          <td>${esc(c.brandName)} ${esc(c.vehicleName)}</td>
          <td>${esc(c.plate || '')}</td>
          ${isAdmin() ? `<td>${esc(c.dealershipName)}</td>` : ''}
          <td>${formatDate(c.handoverDate)}</td>
          <td>${c.openReports ? `<span class="status nouveau">${c.openReports}</span>` : ''}</td>
          <td class="row-actions"><button class="btn small" data-act="open" data-id="${c.id}">Ouvrir</button></td>
        </tr>`
          )
          .join('')}</tbody>
      </table>${list.length ? '' : '<p class="muted">Aucun client.</p>'}</div>`;
    el.querySelector('#customer-search').onsubmit = (e) => {
      e.preventDefault();
      state.filter.customerQuery = new FormData(e.target).get('q');
      VIEWS.customers(el);
    };
    bind(el, { open: (id) => customerDetail(el, id) });
  },

  async vehicles(el) {
    const { brands, vehicles } = await loadCatalog();
    const brandFilter = state.filter.vehicleBrand || '';
    const list = vehicles.filter((v) => !brandFilter || v.brandId === Number(brandFilter));
    el.innerHTML = `${pageHeader('Véhicules', '<button class="btn primary" data-act="add">＋ Nouveau véhicule</button>')}
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
          <td class="row-actions"><button class="btn small" data-act="edit" data-id="${v.id}">Modifier</button><button class="btn small danger" data-act="del" data-id="${v.id}">Supprimer</button></td>
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
      del: (id) => confirmDelete('Supprimer ce véhicule et ses fiches spécifiques ?', () => api('DELETE', `/api/admin/vehicles/${id}`)),
    });
  },

  async problems(el) {
    const [{ brands, vehicles }, problems] = await Promise.all([loadCatalog(), api('GET', '/api/admin/problems')]);
    const q = (state.filter.problemQuery || '').toLowerCase();
    const list = problems.filter((p) => !q || [p.title, p.category, p.symptoms, p.solution].some((t) => (t || '').toLowerCase().includes(q)));
    const scope = (p) => (p.vehicleName ? `🚐 ${p.brandName} ${p.vehicleName}` : p.brandName ? `🏷️ Toute la gamme ${p.brandName}` : '🌍 Tous les véhicules');
    el.innerHTML = `${pageHeader('Problèmes / fiches de dépannage', '<button class="btn primary" data-act="add">＋ Nouvelle fiche</button>')}
      <form class="search-bar" id="problem-search"><input name="q" type="search" placeholder="Rechercher une fiche…" value="${esc(state.filter.problemQuery || '')}"><button class="btn">Filtrer</button></form>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Titre</th><th>Catégorie</th><th>Concerne</th><th>Gravité</th><th></th></tr></thead>
        <tbody>${list
          .map(
            (p) => `<tr>
          <td>${thumb(p.photoUrl)}</td>
          <td><strong>${esc(p.title)}</strong></td>
          <td>${esc(p.category)}</td>
          <td>${esc(scope(p))}</td>
          <td><span class="sev ${esc(p.severity)}">${esc(SEVERITY[p.severity])}</span></td>
          <td class="row-actions"><button class="btn small" data-act="edit" data-id="${p.id}">Modifier</button><button class="btn small danger" data-act="del" data-id="${p.id}">Supprimer</button></td>
        </tr>`
          )
          .join('')}</tbody>
      </table>${list.length ? '' : '<p class="muted">Aucune fiche.</p>'}</div>`;

    const categories = [...new Set(problems.map((p) => p.category))];
    const scopeOptions = [
      ['all', '🌍 Tous les véhicules'],
      ...brands.map((b) => [`b${b.id}`, `🏷️ Toute la gamme ${b.name}`]),
      ...vehicles.map((v) => [`v${v.id}`, `🚐 ${v.brandName} — ${v.name}`]),
    ];
    const fields = [
      { name: 'title', label: 'Titre du problème', required: true, full: true },
      { name: 'category', label: 'Catégorie', hint: `Existantes : ${categories.join(', ') || '—'}`, attrs: 'list="categories"' },
      { name: 'scope', label: 'Concerne', type: 'select', options: scopeOptions },
      { name: 'severity', label: 'Gravité', type: 'select', options: Object.entries(SEVERITY) },
      { name: 'sort', label: "Ordre d'affichage", type: 'number' },
      { name: 'symptoms', label: 'Symptômes', type: 'textarea', rows: 3 },
      { name: 'solution', label: 'Solution (une étape par ligne)', type: 'textarea', rows: 8 },
      { name: 'photo', label: 'Photo / schéma', type: 'image' },
    ];
    const extra = `<datalist id="categories">${categories.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;
    const toBody = ({ scope: s, ...data }) => ({
      ...data,
      brandId: s.startsWith('b') ? Number(s.slice(1)) : null,
      vehicleId: s.startsWith('v') ? Number(s.slice(1)) : null,
    });

    el.querySelector('#problem-search').onsubmit = (e) => {
      e.preventDefault();
      state.filter.problemQuery = new FormData(e.target).get('q');
      VIEWS.problems(el);
    };
    bind(el, {
      add: () =>
        openForm({
          title: 'Nouvelle fiche de dépannage',
          fields,
          extra,
          values: { scope: 'all', severity: 'info', sort: 0 },
          onSubmit: async (data) => {
            await api('POST', '/api/admin/problems', toBody(data));
            toast('Fiche créée');
            VIEWS.problems(el);
          },
        }),
      edit: (id) => {
        const p = problems.find((x) => x.id === id);
        openForm({
          title: 'Modifier la fiche',
          fields,
          extra,
          values: { ...p, photo: p.photoUrl, scope: p.vehicleId ? `v${p.vehicleId}` : p.brandId ? `b${p.brandId}` : 'all' },
          onSubmit: async (data) => {
            await api('PUT', `/api/admin/problems/${id}`, toBody(data));
            toast('Fiche enregistrée');
            VIEWS.problems(el);
          },
        });
      },
      del: (id) => confirmDelete('Supprimer cette fiche ?', () => api('DELETE', `/api/admin/problems/${id}`)),
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
          <td class="row-actions"><button class="btn small" data-act="edit" data-id="${b.id}">Modifier</button><button class="btn small danger" data-act="del" data-id="${b.id}">Supprimer</button></td>
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
    el.innerHTML = `${pageHeader(isAdmin() ? 'Concessions' : 'Ma concession', isAdmin() ? '<button class="btn primary" data-act="add">＋ Nouvelle concession</button>' : '')}
      <div class="table-wrap"><table>
        <thead><tr><th>Concession</th><th>Code concession</th><th>Ville</th><th>Contact</th><th>Clients</th><th>État</th>${isAdmin() ? '<th></th>' : ''}</tr></thead>
        <tbody>${list
          .map(
            (d) => `<tr>
          <td><strong>${esc(d.name)}</strong></td>
          <td><code class="code">${esc(d.code)}</code></td>
          <td>${esc(d.city || '')}</td>
          <td>${esc(d.phone || '')}<br><small>${esc(d.email || '')}</small></td>
          <td>${d.customerCount}</td>
          <td>${d.active ? '<span class="status resolu">Active</span>' : '<span class="status">Désactivée</span>'}</td>
          ${isAdmin() ? `<td class="row-actions"><button class="btn small" data-act="edit" data-id="${d.id}">Modifier</button><button class="btn small danger" data-act="del" data-id="${d.id}">Supprimer</button></td>` : ''}
        </tr>`
          )
          .join('')}</tbody>
      </table></div>
      <p class="muted">Le code concession est saisi dans l'application du client lors de la mise en main. Gardez-le confidentiel.</p>`;
    const fields = [
      { name: 'name', label: 'Nom', required: true },
      { name: 'code', label: 'Code concession', hint: 'Lettres et chiffres, 4 à 16 caractères. Vide = généré automatiquement.' },
      { name: 'city', label: 'Ville' },
      { name: 'phone', label: 'Téléphone', type: 'tel' },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'active', label: 'Active (le code fonctionne)', type: 'checkbox' },
    ];
    bind(el, {
      add: () =>
        openForm({
          title: 'Nouvelle concession',
          fields,
          values: { active: true },
          onSubmit: async (data) => {
            const d = await api('POST', '/api/admin/dealerships', data);
            toast(`Concession créée — code ${d.code}`);
            VIEWS.dealerships(el);
          },
        }),
      edit: (id) =>
        openForm({
          title: 'Modifier la concession',
          fields,
          values: list.find((x) => x.id === id),
          onSubmit: async (data) => {
            await api('PUT', `/api/admin/dealerships/${id}`, data);
            toast('Concession enregistrée');
            VIEWS.dealerships(el);
          },
        }),
      del: (id) => confirmDelete('Supprimer cette concession ?', () => api('DELETE', `/api/admin/dealerships/${id}`)),
    });
  },

  async users(el) {
    const [users, dealerships] = await Promise.all([api('GET', '/api/admin/users'), api('GET', '/api/admin/dealerships')]);
    el.innerHTML = `${pageHeader('Utilisateurs du back-office', '<button class="btn primary" data-act="add">＋ Nouvel utilisateur</button>')}
      <div class="table-wrap"><table>
        <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Concession</th><th></th></tr></thead>
        <tbody>${users
          .map(
            (u) => `<tr>
          <td>${esc(u.name || '')}</td><td>${esc(u.email)}</td>
          <td>${u.role === 'admin' ? 'Administrateur' : 'Concession'}</td>
          <td>${esc(u.dealershipName || '')}</td>
          <td class="row-actions"><button class="btn small" data-act="edit" data-id="${u.id}">Modifier</button>${
            u.id !== state.user.id ? `<button class="btn small danger" data-act="del" data-id="${u.id}">Supprimer</button>` : ''
          }</td>
        </tr>`
          )
          .join('')}</tbody>
      </table></div>
      <p class="muted">Administrateur : gère tout le catalogue (véhicules, problèmes, marques). Concession : voit uniquement ses clients et leurs signalements.</p>`;
    const fields = (isNew) => [
      { name: 'name', label: 'Nom' },
      { name: 'email', label: 'E-mail', type: 'email', required: true },
      { name: 'role', label: 'Rôle', type: 'select', options: [['dealer', 'Concession'], ['admin', 'Administrateur']] },
      { name: 'dealershipId', label: 'Concession (rôle concession)', type: 'select', options: [['', '—'], ...dealerships.map((d) => [d.id, d.name])] },
      { name: 'password', label: isNew ? 'Mot de passe' : 'Nouveau mot de passe (laisser vide pour ne pas changer)', type: 'password', required: isNew, attrs: 'minlength="8" autocomplete="new-password"' },
    ];
    bind(el, {
      add: () =>
        openForm({
          title: 'Nouvel utilisateur',
          fields: fields(true),
          values: { role: 'dealer' },
          onSubmit: async (data) => {
            await api('POST', '/api/admin/users', data);
            toast('Utilisateur créé');
            VIEWS.users(el);
          },
        }),
      edit: (id) =>
        openForm({
          title: "Modifier l'utilisateur",
          fields: fields(false),
          values: users.find((x) => x.id === id),
          onSubmit: async (data) => {
            await api('PUT', `/api/admin/users/${id}`, data);
            toast('Utilisateur enregistré');
            VIEWS.users(el);
          },
        }),
      del: (id) => confirmDelete('Supprimer cet utilisateur ?', () => api('DELETE', `/api/admin/users/${id}`)),
    });
  },

  async settings(el) {
    const s = await api('GET', '/api/admin/settings');
    el.innerHTML = `${pageHeader('Paramètres')}
      ${
        isAdmin()
          ? `<form class="card form" id="announce-form">
        <h2>Message affiché dans l'application</h2>
        <p class="muted">Ex : rappel d'entretien, campagne de rappel, horaires d'été. Laisser vide pour ne rien afficher.</p>
        <textarea name="announcement" rows="3">${esc(s.announcement || '')}</textarea>
        <button class="btn primary">Publier</button>
      </form>`
          : ''
      }
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
    el.querySelector('#password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api('PUT', '/api/admin/password', { currentPassword: f.get('currentPassword'), newPassword: f.get('newPassword') });
        toast('Mot de passe changé');
        e.target.reset();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  },
};

async function customerDetail(el, id) {
  const [c, { vehicles }, dealerships] = await Promise.all([
    api('GET', `/api/admin/customers/${id}`),
    loadCatalog(),
    api('GET', '/api/admin/dealerships'),
  ]);
  el.innerHTML = `${pageHeader(
    [c.firstName, c.lastName].filter(Boolean).join(' '),
    `<button class="btn" data-act="back">← Retour</button>
     <button class="btn" data-act="edit">Modifier</button>
     <button class="btn" data-act="recovery">Nouveau code de récupération</button>
     ${isAdmin() ? '<button class="btn danger" data-act="del">Supprimer</button>' : ''}`
  )}
    <div class="detail-grid">
      <div class="card">
        ${c.coverPhotoUrl ? `<img class="cover" src="${esc(c.coverPhotoUrl)}" alt="">` : ''}
        <dl class="facts">
          <div><dt>Véhicule</dt><dd>${esc(c.brandName)} ${esc(c.vehicleName)}</dd></div>
          <div><dt>Immatriculation</dt><dd>${esc(c.plate || '—')}</dd></div>
          <div><dt>VIN</dt><dd>${esc(c.vin || '—')}</dd></div>
          <div><dt>Mise en main</dt><dd>${formatDate(c.handoverDate)}</dd></div>
          <div><dt>Concession</dt><dd>${esc(c.dealershipName)}</dd></div>
          <div><dt>E-mail</dt><dd>${esc(c.email || '—')}</dd></div>
          <div><dt>Téléphone</dt><dd>${esc(c.phone || '—')}</dd></div>
          <div><dt>Dernière activité</dt><dd>${formatDate(c.updatedAt)}</dd></div>
        </dl>
      </div>
      <div class="card">
        <h2>Photos du client (${c.photos.length})</h2>
        ${c.photos.length ? `<div class="photos">${c.photos.map((p) => `<a href="${esc(p.url)}" target="_blank" title="${esc(p.caption || '')}"><img src="${esc(p.url)}" alt=""></a>`).join('')}</div>` : '<p class="muted">Aucune photo.</p>'}
        <h2>Notes personnelles (${c.notes.length})</h2>
        ${c.notes.length ? `<ul>${c.notes.map((n) => `<li><strong>${esc(n.problemTitle)}</strong> : ${esc(n.note)}</li>`).join('')}</ul>` : '<p class="muted">Aucune note.</p>'}
      </div>
    </div>
    <div class="card">
      <h2>Signalements (${c.reports.length})</h2>
      ${
        c.reports.length
          ? c.reports
              .map((r) => `<div class="report-line"><span class="status ${esc(r.status)}">${STATUS[r.status]}</span> <strong>${esc(r.title)}</strong> <small class="muted">${formatDate(r.createdAt)}</small></div>`)
              .join('')
          : '<p class="muted">Aucun signalement.</p>'
      }
    </div>`;
  bind(el, {
    back: () => VIEWS.customers(el),
    edit: () =>
      openForm({
        title: 'Modifier le client',
        values: c,
        fields: [
          { name: 'firstName', label: 'Prénom' },
          { name: 'lastName', label: 'Nom', required: true },
          { name: 'email', label: 'E-mail', type: 'email' },
          { name: 'phone', label: 'Téléphone', type: 'tel' },
          { name: 'plate', label: 'Immatriculation' },
          { name: 'vin', label: 'VIN' },
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
    recovery: async () => {
      if (!confirm('Générer un nouveau code ? Le client sera déconnecté de ses téléphones et devra utiliser ce nouveau code.')) return;
      try {
        const { recoveryCode } = await api('POST', `/api/admin/customers/${id}/recovery-code`);
        alert(`Nouveau code de récupération à transmettre au client :\n\n${recoveryCode}`);
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    del: () =>
      confirmDelete('Supprimer définitivement ce client et toutes ses données (photos, notes, signalements) ?', async () => {
        await api('DELETE', `/api/admin/customers/${id}`);
        state.section = 'customers';
      }),
  });
}

// ---------- Start ----------

(async function start() {
  state.section = location.hash.slice(1) || 'dashboard';
  if (!state.token) return renderLogin();
  try {
    state.user = await api('GET', '/api/admin/me');
    renderShell();
  } catch {
    renderLogin();
  }
})();
