import { esc, multiline, formatDate, createApi, pickImage, toast } from '/shared/common.js';

const formatDateTime = (t) => {
  const d = new Date(String(t).replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? '' : `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};
import { registerCatalogViews } from '/admin/catalog.js';

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
    ['reports', '💬', 'Demandes clients', true],
    ['customers', '👥', 'Clients', true],
    ['vehicles', '🚐', 'Véhicules', isAdmin()],
    ['diagnostics', '🛠️', 'Diagnostics (pannes)', true],
    ['equipment', '🧰', 'Équipements', true],
    ['content', '📋', 'Contenus de l’appli', true],
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
        ${
          state.user.openAccess
            ? '<small class="open-access">⚠️ Accès libre, sans mot de passe (mode test)</small>'
            : '<button class="btn small" id="logout">Se déconnecter</button>'
        }
      </div>
    </aside>
    <main class="content" id="content"></main>
  </div>`;
  root.querySelector('#logout')?.addEventListener('click', logout);
  showSection(state.section);
}

async function showSection(id) {
  if (!sections().some((s) => s[0] === id)) id = 'dashboard';
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
      ['Demandes à traiter', s.openReports, 'reports'],
      ['Clients', s.customers, 'customers'],
      ['Diagnostics', s.diagnostics, 'diagnostics'],
      ['Équipements', s.equipment, 'equipment'],
      ...(isAdmin()
        ? [
            ['Véhicules', s.vehicles, 'vehicles'],
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
          <li>Toute modification des véhicules, équipements, diagnostics ou contenus est <strong>publiée dans l'application des clients</strong> : ils la reçoivent à la prochaine ouverture (version du contenu : ${s.contentVersion}).</li>
          <li>Mise en main : dans l'application du client, la concession saisit son <strong>code concession</strong>, choisit la <strong>marque</strong> puis le <strong>véhicule</strong>, coche les équipements, vérifie chaque point, puis génère le <strong>code d'accès</strong> du client (valable 2 ans).</li>
          <li>Tout ce que le client enregistre (équipements cochés, photos, modèles, poids…) est sauvegardé dans le cloud. Ses demandes de rendez-vous arrivent dans « Demandes clients ».</li>
          <li>Application client : <a href="/app/" target="_blank">${esc(location.origin)}/app/</a></li>
        </ul>
      </div>`;
  },

  async reports(el) {
    const status = state.filter.reportStatus ?? 'open';
    const [all, settings] = await Promise.all([api('GET', '/api/admin/reports'), api('GET', '/api/admin/settings').catch(() => null)]);
    const list = all.filter((r) =>
      status === 'piece' ? r.kind === 'piece' && r.status !== 'resolu' : status === 'open' ? r.status !== 'resolu' : status === 'all' || r.status === status
    );
    const toAnswer = all.filter((r) => r.waitingForDealer).length;
    const mailWarning = settings && !settings.mail.ready
      ? `<div class="card warn-card">✉️ Les e-mails de notification ne sont pas encore configurés : vous ne serez pas prévenu des nouvelles demandes. ${isAdmin() ? '<a href="#settings">Configurer l’envoi des e-mails</a>' : 'Demandez à l’administrateur de le configurer.'}</div>`
      : '';
    el.innerHTML = `${pageHeader(`Demandes clients${toAnswer ? ` · ${toAnswer} à répondre` : ''}`)}
      ${mailWarning}
      <div class="filters">${[
        ['open', 'À traiter'],
        ['nouveau', 'Nouvelles'],
        ['en_cours', 'En cours'],
        ['resolu', 'Clôturées'],
        ['all', 'Toutes'],
        ['piece', '🛒 Magasin (pièces)'],
      ]
        .map(([v, l]) => `<button class="chip ${status === v ? 'active' : ''}" data-act="filter" data-value="${v}">${l}</button>`)
        .join('')}</div>
      <div class="cards">${
        list.length
          ? list
              .map(
                (r) => `<div class="card report ${r.waitingForDealer ? 'waiting' : ''}">
            <div class="report-head">
              <div>${r.kind === 'piece' ? '<span class="status piece">🛒 Magasin</span> ' : ''}<strong>${esc(r.title)}</strong>${r.waitingForDealer ? ' <span class="status nouveau">À répondre</span>' : ''}<br><small class="muted">${formatDate(r.createdAt)} · ${esc([r.firstName, r.lastName].filter(Boolean).join(' '))} · ${esc(r.brandName)} ${esc(r.vehicleName)}${isAdmin() ? ` · ${esc(r.dealershipName)}` : ''}</small></div>
              <span class="status ${esc(r.status)}">${STATUS[r.status]}</span>
            </div>
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
            <form class="reply-form" data-reply="${r.id}">
              <textarea name="message" rows="2" placeholder="${r.status === 'resolu' ? 'Dernier message au client (facultatif)' : 'Votre réponse au client (il la reçoit dans son application)'}"></textarea>
              <div class="actions">
                <select name="status">${Object.entries(STATUS).map(([v, l]) => `<option value="${v}" ${(r.status === 'nouveau' ? 'en_cours' : r.status) === v ? 'selected' : ''}>${v === 'resolu' ? 'Clôturer la demande' : l}</option>`).join('')}</select>
                <button class="btn primary">Envoyer</button>
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
    const list = await api('GET', `/api/admin/customers?q=${encodeURIComponent(q)}`);
    el.innerHTML = `${pageHeader('Clients', '<button class="btn primary" data-act="add">＋ Nouveau client</button>')}
      <form class="search-bar" id="customer-search"><input name="q" type="search" placeholder="Nom, e-mail, immatriculation, n° de cellule…" value="${esc(q)}"><button class="btn">Rechercher</button></form>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Client</th><th>Véhicule</th><th>N° cellule</th>${isAdmin() ? '<th>Concession</th>' : ''}<th>Mise en main</th><th>Signal.</th><th></th></tr></thead>
        <tbody>${list
          .map(
            (c) => `<tr>
          <td>${thumb(c.coverPhotoUrl)}</td>
          <td><strong>${esc([c.firstName, c.lastName].filter(Boolean).join(' '))}</strong><br><small class="muted">${esc(c.email || '')}</small></td>
          <td>${esc(c.brandName)} ${esc(c.vehicleName)}</td>
          <td>${esc(c.cellNumber || '')}</td>
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
    bind(el, { open: (id) => customerDetail(el, id), add: () => newCustomer(el) });
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
          <td class="row-actions"><button class="btn small primary" data-act="profile" data-id="${v.id}">Profil appli et photos</button><button class="btn small" data-act="edit" data-id="${v.id}">Modifier</button><button class="btn small danger" data-act="del" data-id="${v.id}">Supprimer</button></td>
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
      { name: 'storeEmail', label: 'E-mail du magasin (demandes de pièces)', type: 'email', hint: 'Laissez vide pour les recevoir à l’e-mail de la concession.' },
      { name: 'hours', label: 'Horaires affichés dans l’appli', full: true },
      { name: 'website', label: 'Site web (ouvert en touchant le logo dans l’appli)', full: true, attrs: 'placeholder="www.ma-concession.fr"' },
      { name: 'logo', label: 'Logo de la concession (affiché dans l’appli)', type: 'image' },
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
          values: { ...list.find((x) => x.id === id), logo: list.find((x) => x.id === id).logoUrl },
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

registerCatalogViews(VIEWS, { api, openForm, pageHeader, bind, confirmDelete, thumb, isAdmin });

// Registers a customer from the back-office (instead of the handover in the app) and hands over their access.
const NEEDS = { piece: 'Pièce détachée', remplacement: 'Remplacement de l’équipement', accessoire: 'Accessoire ou consommable' };

// What the store needs to identify the part. The VIN is never stored: the customer may send it in the e-mail only.
function partLines(r) {
  const p = r.part || {};
  return [
    ['Besoin', NEEDS[p.need] || 'Pièce détachée'],
    ['Client', [r.firstName, r.lastName].filter(Boolean).join(' ')],
    ['Véhicule', `${r.brandName} ${r.vehicleName}`],
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
  const [{ vehicles }, dealerships] = await Promise.all([loadCatalog(), isAdmin() ? api('GET', '/api/admin/dealerships') : Promise.resolve([])]);
  const active = vehicles.filter((v) => v.active);
  if (!active.length) return toast('Créez d’abord un véhicule (rubrique Véhicules)', 'error');
  openForm({
    title: 'Nouveau client',
    submitLabel: 'Enregistrer le client',
    values: { handoverDate: new Date().toISOString().slice(0, 10), sendEmail: true, dealershipId: dealerships[0]?.id },
    fields: [
      { name: 'vehicleId', label: 'Véhicule', type: 'select', required: true, options: active.map((v) => [v.id, `${v.brandName} — ${v.name}${v.modelYear ? ' ' + v.modelYear : ''}`]) },
      ...(isAdmin() ? [{ name: 'dealershipId', label: 'Concession', type: 'select', required: true, options: dealerships.map((d) => [d.id, d.name]) }] : []),
      { name: 'firstName', label: 'Prénom' },
      { name: 'lastName', label: 'Nom', required: true, hint: 'Le client le saisit avec son code d’accès.' },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'phone', label: 'Téléphone', type: 'tel' },
      { name: 'cellNumber', label: 'N° de cellule', hint: 'Plaque du constructeur de la cellule.' },
      { name: 'vehicleYear', label: 'Année du véhicule' },
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
     <button class="btn" data-act="recovery">Nouveau code d’accès</button>
     ${isAdmin() ? '<button class="btn danger" data-act="del">Supprimer</button>' : ''}`
  )}
    <div class="detail-grid">
      <div class="card">
        <dl class="facts">
          <div><dt>Véhicule</dt><dd>${esc(c.brandName)} ${esc(c.vehicleName)}</dd></div>
          <div><dt>N° de cellule</dt><dd>${esc(c.cellNumber || '—')}</dd></div>
          <div><dt>Année du véhicule</dt><dd>${esc(c.vehicleYear || (/\b(19|20)\d{2}\b/.exec(c.modelYear || '') || ['—'])[0])}</dd></div>
          <div><dt>VIN</dt><dd class="muted">Conservé seulement sur le téléphone du client</dd></div>
          <div><dt>Mise en main</dt><dd>${formatDate(c.handoverDate)}</dd></div>
          <div><dt>Concession</dt><dd>${esc(c.dealershipName)}</dd></div>
          <div><dt>E-mail</dt><dd>${esc(c.email || '—')}${c.email && c.emailNotify === 0 ? ' <small class="muted">(ne veut pas recevoir les réponses par e-mail)</small>' : ''}</dd></div>
          <div><dt>Téléphone</dt><dd>${esc(c.phone || '—')}</dd></div>
          <div><dt>Code d’accès</dt><dd>${
            c.accessCode
              ? `<code class="code">${esc(c.accessCode)}</code> <button class="btn small" data-act="copycode">Copier</button> <button class="btn small primary" data-act="resend">Renvoyer au client</button><br><small class="muted">Valable jusqu’au ${formatDate(c.accessExpiresAt.slice(0, 10))}</small>`
              : c.accessExpiresAt
                ? `créé avant cette version, il ne peut pas être réaffiché : utilisez « Nouveau code d’accès » (valable jusqu’au ${formatDate(c.accessExpiresAt.slice(0, 10))})`
                : 'pas encore généré'
          }</dd></div>
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
      <h2>Équipements cochés (${c.equipmentOwned ? c.equipmentOwned.length : 'liste de série'})</h2>
      <p class="muted">${esc((c.equipmentOwned || []).join(' · ') || 'Le client n’a pas encore modifié la liste de série.')}</p>
    </div>
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
