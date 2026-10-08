// Back-office screens for the Compagnon de bord content: equipment, diagnostics (flowcharts),
// app content (lists, reminders, workshop reasons, game) and the vehicle profile with its photos.
import { esc, pickImage, toast } from '/shared/common.js';

const DIAG_CATS = [
  ['eau', 'Eau'],
  ['elec', 'Électricité et batteries'],
  ['gaz', 'Gaz et cuisine'],
  ['chauf', 'Chauffage et eau chaude'],
  ['frigo', 'Réfrigérateur'],
  ['wc', 'Toilettes et odeurs'],
  ['hum', 'Humidité et infiltrations'],
  ['ext', 'Extérieur et équipements'],
];
const LEAF_FIELDS = [
  ['cause', 'Cause (une seule)', 'textarea'],
  ['geste', 'Geste à faire', 'textarea'],
  ['prod', 'Produit (ou « Aucun produit : passez à l’atelier »)', 'text'],
  ['sec', 'Phrase de sécurité (gaz, monoxyde, 230 V)', 'text'],
];

export function registerCatalogViews(VIEWS, h) {
  const { api, openForm, pageHeader, bind, confirmDelete, thumb, isAdmin } = h;
  const state = { diagFilter: '', diagCat: '', eqFilter: '', eqCat: '' };

  // ---------- Equipment ----------

  VIEWS.equipment = async (el) => {
    const [list, cats] = await Promise.all([api('GET', '/api/admin/equipment'), api('GET', '/api/admin/catalog/cats').then((r) => r.value)]);
    const catName = Object.fromEntries(cats);
    const q = state.eqFilter.toLowerCase();
    const shown = list.filter((x) => (!state.eqCat || x.cat === state.eqCat) && (!q || [x.name, x.text, x.kw, x.id].some((t) => (t || '').toLowerCase().includes(q))));
    el.innerHTML = `${pageHeader(`Équipements (${list.length})`, isAdmin() ? '<button class="btn primary" data-act="add">＋ Nouvel équipement</button>' : '')}
      <p class="muted">Le catalogue commun à tous les véhicules : ce que le client coche dans « Mes équipements » et retrouve dans « C’est quoi, ça ? ». Les photos se règlent par véhicule (Véhicules → Profil appli).</p>
      <form class="search-bar" id="eq-search"><input name="q" type="search" placeholder="Chercher : Truma, frigo, marchepied…" value="${esc(state.eqFilter)}"><button class="btn">Filtrer</button></form>
      <div class="filters"><button class="chip ${!state.eqCat ? 'active' : ''}" data-act="cat" data-value="">Toutes</button>${cats
        .map(([id, n]) => `<button class="chip ${state.eqCat === id ? 'active' : ''}" data-act="cat" data-value="${esc(id)}">${esc(n)}</button>`)
        .join('')}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Équipement</th><th>Rubrique</th><th>De série</th><th>Zone du plan</th><th></th></tr></thead>
        <tbody>${shown
          .map(
            (x) => `<tr>
          <td><strong>${esc(x.name)}</strong><br><small class="muted">${esc(x.text || '').slice(0, 110)}${(x.text || '').length > 110 ? '…' : ''}</small></td>
          <td>${esc(catName[x.cat] || x.cat)}</td>
          <td>${x.base ? '✓' : ''}</td>
          <td>${esc(x.spot || '')}</td>
          <td class="row-actions">${isAdmin() ? `<button class="btn small" data-act="edit" data-key="${esc(x.id)}">Modifier</button><button class="btn small danger" data-act="del" data-key="${esc(x.id)}">Supprimer</button>` : ''}</td>
        </tr>`
          )
          .join('')}</tbody></table>${shown.length ? '' : '<p class="muted">Aucun équipement.</p>'}</div>`;

    const fields = [
      { name: 'name', label: 'Nom', required: true, full: true },
      { name: 'cat', label: 'Rubrique', type: 'select', options: cats },
      { name: 'spot', label: 'Zone du plan (cab, din, cui, sdb, toit, ent, lit, tech, ext, extb)' },
      { name: 'base', label: 'De série (coché d’office)', type: 'checkbox' },
      { name: 'text', label: 'Explication (« C’est quoi, ça ? »)', type: 'textarea', rows: 4 },
      { name: 'tip', label: 'Conseil', type: 'textarea', rows: 2 },
      { name: 'kw', label: 'Mots-clés de recherche', full: true },
    ];
    el.querySelector('#eq-search').onsubmit = (e) => {
      e.preventDefault();
      state.eqFilter = new FormData(e.target).get('q');
      VIEWS.equipment(el);
    };
    bindKeys(el, {
      cat: (_, b) => {
        state.eqCat = b.dataset.value;
        VIEWS.equipment(el);
      },
      add: () =>
        openForm({
          title: 'Nouvel équipement',
          fields,
          values: { cat: cats[0]?.[0] },
          onSubmit: async (data) => {
            await api('POST', '/api/admin/equipment', data);
            toast('Équipement créé');
            VIEWS.equipment(el);
          },
        }),
      edit: (id) =>
        openForm({
          title: 'Modifier l’équipement',
          fields,
          values: list.find((x) => x.id === id),
          onSubmit: async (data) => {
            await api('PUT', `/api/admin/equipment/${encodeURIComponent(id)}`, data);
            toast('Équipement enregistré');
            VIEWS.equipment(el);
          },
        }),
      del: (id) => confirmDelete('Supprimer cet équipement du catalogue ?', () => api('DELETE', `/api/admin/equipment/${encodeURIComponent(id)}`)),
    });
  };

  // ---------- Diagnostics ----------

  VIEWS.diagnostics = async (el) => {
    const list = await api('GET', '/api/admin/diagnostics');
    const q = state.diagFilter.toLowerCase();
    const shown = list.filter((d) => (!state.diagCat || d.cat === state.diagCat) && (!q || [d.label, d.id, d.eq].some((t) => (t || '').toLowerCase().includes(q))));
    const total = list.reduce((a, d) => a + d.leaves, 0);
    el.innerHTML = `${pageHeader(`Diagnostics (${list.length} entrées, ${total} fins de parcours)`, isAdmin() ? '<button class="btn primary" data-act="add">＋ Nouveau diagnostic</button>' : '')}
      <p class="muted">Chaque diagnostic est un organigramme : le client vérifie une chose à la fois, du plus simple au plus rare. Chaque fin de parcours nomme <strong>une seule cause</strong>, ou envoie à l’atelier.</p>
      <form class="search-bar" id="diag-search"><input name="q" type="search" placeholder="Chercher : frigo, Truma, toilettes…" value="${esc(state.diagFilter)}"><button class="btn">Filtrer</button></form>
      <div class="filters"><button class="chip ${!state.diagCat ? 'active' : ''}" data-act="cat" data-value="">Toutes</button>${DIAG_CATS.map(
        ([id, n]) => `<button class="chip ${state.diagCat === id ? 'active' : ''}" data-act="cat" data-value="${id}">${esc(n)}</button>`
      ).join('')}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Le souci, dans les mots du client</th><th>Rubrique</th><th>Équipement</th><th>Fins</th><th></th></tr></thead>
        <tbody>${shown
          .map(
            (d) => `<tr>
          <td>${d.urgent ? '<span class="status nouveau">Urgent</span> ' : ''}<strong>${esc(d.label)}</strong><br><small class="muted">${esc(d.id)}</small></td>
          <td>${esc((DIAG_CATS.find((c) => c[0] === d.cat) || [, d.cat])[1])}</td>
          <td>${esc(d.eq || '')}</td>
          <td>${d.elim ? 'élimination' : d.leaves}</td>
          <td class="row-actions"><button class="btn small" data-act="open" data-key="${esc(d.id)}">Ouvrir l’organigramme</button></td>
        </tr>`
          )
          .join('')}</tbody></table></div>`;
    el.querySelector('#diag-search').onsubmit = (e) => {
      e.preventDefault();
      state.diagFilter = new FormData(e.target).get('q');
      VIEWS.diagnostics(el);
    };
    bindKeys(el, {
      cat: (_, b) => {
        state.diagCat = b.dataset.value;
        VIEWS.diagnostics(el);
      },
      open: (id) => diagnosticEditor(el, id),
      add: async () => {
        const eq = await api('GET', '/api/admin/equipment');
        openForm({
          title: 'Nouveau diagnostic',
          fields: [
            { name: 'label', label: 'Le souci, dans les mots du client (ex : « Mon store ne rentre plus »)', required: true, full: true },
            { name: 'cat', label: 'Rubrique', type: 'select', options: DIAG_CATS },
            { name: 'eq', label: 'Équipement concerné', type: 'select', options: [['', '— Aucun —'], ...eq.map((x) => [x.id, x.name])] },
            { name: 'kw', label: 'Mots-clés de recherche', full: true },
          ],
          values: { cat: 'eau' },
          onSubmit: async (data) => {
            const d = await api('POST', '/api/admin/diagnostics', data);
            toast('Diagnostic créé : complétez l’organigramme');
            diagnosticEditor(el, d.id);
          },
        });
      },
    });
  };

  async function diagnosticEditor(el, id) {
    const [d, eq, motifs] = await Promise.all([
      api('GET', `/api/admin/diagnostics/${encodeURIComponent(id)}`),
      api('GET', '/api/admin/equipment'),
      api('GET', '/api/admin/catalog/motifs').then((r) => r.value || []),
    ]);
    const canEdit = isAdmin();
    let dirty = false;
    const rdvOptions = [['', '— Pas de rendez-vous —'], ...motifs.filter((m) => m.id !== 'souci').map((m) => [m.id, m.t]), ['atelier', 'Atelier (souci)']];

    const nodeAt = (path) => path.split('.').filter(Boolean).reduce((n, i) => n.n[Number(i)], d.tree);
    const isQuestion = (n) => Array.isArray(n.n);
    const leaves = (n) => (isQuestion(n) ? n.n.reduce((a, c) => a + leaves(c), 0) : 1);

    function leafHtml(n, path) {
      const ro = canEdit ? '' : 'readonly';
      return `<div class="leaf ${n.pro ? 'pro' : ''}">
        <p class="node-kind">🏁 Fin de parcours</p>
        ${LEAF_FIELDS.map(
          ([k, label, type]) => `<label>${esc(label)}${
            type === 'textarea'
              ? `<textarea rows="2" data-path="${path}" data-k="${k}" ${ro}>${esc(n[k] ?? '')}</textarea>`
              : `<input data-path="${path}" data-k="${k}" value="${esc(n[k] ?? '')}" ${ro}>`
          }</label>`
        ).join('')}
        <div class="leaf-row">
          <label class="check"><input type="checkbox" data-path="${path}" data-k="pro" ${n.pro ? 'checked' : ''} ${canEdit ? '' : 'disabled'}> À faire faire par un professionnel</label>
          <label>Rendez-vous proposé<select data-path="${path}" data-k="rdv" ${canEdit ? '' : 'disabled'}>${rdvOptions
            .map(([v, t]) => `<option value="${esc(v)}" ${String(n.rdv || '') === v ? 'selected' : ''}>${esc(t)}</option>`)
            .join('')}</select></label>
        </div>
        ${canEdit ? `<div class="node-actions"><button type="button" class="btn small" data-op="toq" data-path="${path}">Remplacer par une question</button></div>` : ''}
      </div>`;
    }

    function nodeHtml(n, path, depth) {
      if (!isQuestion(n)) return leafHtml(n, path);
      const ro = canEdit ? '' : 'readonly';
      return `<div class="question">
        <p class="node-kind">❓ Question ${n.vk ? `<span class="muted">(passée automatiquement si la fiche du client indique « ${esc(n.vk)} »)</span>` : ''}</p>
        <textarea rows="2" class="qtext" data-path="${path}" data-k="t" ${ro}>${esc(n.t)}</textarea>
        <div class="answers">${n.o
          .map((o, i) => {
            const p = path ? `${path}.${i}` : String(i);
            const child = n.n[i];
            return `<details class="answer" ${depth < 1 ? 'open' : ''}>
              <summary><span class="arrow">↳</span><input class="atext" data-path="${path}" data-ai="${i}" value="${esc(o)}" ${ro}>
                <small class="muted">${isQuestion(child) ? `${leaves(child)} fin(s)` : 'fin'}</small>
                ${canEdit && n.o.length > 1 ? `<button type="button" class="btn small danger" data-op="delans" data-path="${path}" data-i="${i}" title="Supprimer cette réponse">✕</button>` : ''}
              </summary>
              <div class="child">${nodeHtml(child, p, depth + 1)}</div>
            </details>`;
          })
          .join('')}</div>
        ${
          canEdit
            ? `<div class="node-actions"><button type="button" class="btn small" data-op="addans" data-path="${path}">＋ Ajouter une réponse</button>${
                path ? `<button type="button" class="btn small danger" data-op="toleaf" data-path="${path}">Remplacer par une fin de parcours</button>` : ''
              }</div>`
            : ''
        }
      </div>`;
    }

    function render() {
      el.innerHTML = `${pageHeader(
        d.label,
        `<button class="btn" data-op="back">← Liste</button>${
          canEdit
            ? `<button class="btn" data-op="meta">Titre, rubrique…</button><button class="btn" data-op="json">Mode avancé (JSON)</button><button class="btn danger" data-op="delete">Supprimer</button><button class="btn primary" data-op="save">Enregistrer</button>`
            : ''
        }`
      )}
        <p class="muted">${esc(d.id)} · ${esc((DIAG_CATS.find((c) => c[0] === d.cat) || [, d.cat])[1])}${d.eq ? ` · équipement : ${esc((eq.find((x) => x.id === d.eq) || {}).name || d.eq)}` : ''} · ${
        d.tree ? `${leaves(d.tree)} fin(s) de parcours` : ''
      }</p>
        ${
          d.elim
            ? '<div class="card"><p>Ce diagnostic utilise l’ancien format « par élimination ». Modifiez-le avec le <strong>mode avancé (JSON)</strong>, ou recréez-le au format organigramme.</p></div>'
            : ''
        }
        <div class="tree" id="tree">${d.tree ? nodeHtml(d.tree, '', 0) : ''}</div>
        <div class="tree-legend muted">Astuce : dépliez chaque réponse (↳) pour voir la suite du parcours. Les modifications sont enregistrées avec le bouton « Enregistrer ».</div>`;
    }

    render();

    el.oninput = (e) => {
      const t = e.target;
      if (t.dataset.path === undefined) return;
      const n = nodeAt(t.dataset.path);
      dirty = true;
      if (t.dataset.ai !== undefined) n.o[Number(t.dataset.ai)] = t.value;
      else if (t.dataset.k === 'pro') {
        if (t.checked) n.pro = true;
        else delete n.pro;
      } else if (t.dataset.k) {
        const v = t.value;
        if (v === '' && t.dataset.k !== 'cause') delete n[t.dataset.k];
        else n[t.dataset.k] = v;
      }
    };
    el.onchange = el.oninput;

    el.onclick = async (e) => {
      // Clicking in an answer field must not fold or unfold the answer.
      if (e.target.matches('summary input')) e.preventDefault();
      const b = e.target.closest('[data-op]');
      if (!b) return;
      const op = b.dataset.op;
      if (op === 'back') {
        if (dirty && !confirm('Quitter sans enregistrer les modifications ?')) return;
        el.onclick = el.oninput = el.onchange = null;
        return VIEWS.diagnostics(el);
      }
      if (op === 'save') {
        try {
          await api('PUT', `/api/admin/diagnostics/${encodeURIComponent(id)}`, { tree: d.tree });
          dirty = false;
          toast('Diagnostic enregistré : visible dans les applications');
        } catch (err) {
          toast(err.message, 'error');
        }
        return;
      }
      if (op === 'delete') {
        if (!confirm('Supprimer définitivement ce diagnostic ?')) return;
        await api('DELETE', `/api/admin/diagnostics/${encodeURIComponent(id)}`);
        toast('Diagnostic supprimé');
        el.onclick = el.oninput = el.onchange = null;
        return VIEWS.diagnostics(el);
      }
      if (op === 'meta') {
        return openForm({
          title: 'Diagnostic',
          values: { ...d, urgent: !!d.urgent },
          fields: [
            { name: 'label', label: 'Le souci, dans les mots du client', required: true, full: true },
            { name: 'cat', label: 'Rubrique', type: 'select', options: DIAG_CATS },
            { name: 'eq', label: 'Équipement concerné (le diagnostic est mis en avant s’il est dans le véhicule)', type: 'select', options: [['', '— Aucun —'], ...eq.map((x) => [x.id, x.name])] },
            { name: 'urgent', label: 'Urgent (danger : toujours affiché en tête)', type: 'checkbox' },
            { name: 'kw', label: 'Mots-clés et synonymes de recherche', type: 'textarea', rows: 3 },
          ],
          onSubmit: async (data) => {
            Object.assign(d, await api('PUT', `/api/admin/diagnostics/${encodeURIComponent(id)}`, data));
            toast('Enregistré');
            render();
          },
        });
      }
      if (op === 'json') {
        const { id: _id, ...rest } = d;
        return openForm({
          title: 'Mode avancé (JSON)',
          fields: [{ name: 'json', label: 'Contenu complet du diagnostic', type: 'textarea', rows: 22, full: true }],
          values: { json: JSON.stringify(rest, null, 1) },
          onSubmit: async ({ json }) => {
            let parsed;
            try {
              parsed = JSON.parse(json);
            } catch {
              throw new Error('JSON invalide : vérifiez les virgules et les guillemets');
            }
            Object.keys(d).forEach((k) => k !== 'id' && delete d[k]);
            Object.assign(d, await api('PUT', `/api/admin/diagnostics/${encodeURIComponent(id)}`, parsed));
            dirty = false;
            toast('Enregistré');
            render();
          },
        });
      }
      // Structure edits (kept in memory until "Enregistrer").
      const path = b.dataset.path ?? '';
      const n = nodeAt(path);
      if (op === 'addans') {
        n.o.push('Nouvelle réponse');
        n.n.push({ cause: '', geste: '', prod: '' });
      }
      if (op === 'delans') {
        if (!confirm('Supprimer cette réponse et toute la suite du parcours ?')) return;
        n.o.splice(Number(b.dataset.i), 1);
        n.n.splice(Number(b.dataset.i), 1);
      }
      if (op === 'toq') {
        const leaf = { ...n };
        Object.keys(n).forEach((k) => delete n[k]);
        Object.assign(n, { t: 'Vérifiez … : est-ce réglé ?', o: ['Oui, c’est réglé', 'Non'], n: [leaf, { cause: 'Rien n’a réglé le problème.', geste: 'Passez à l’atelier.', prod: 'Aucun produit : passez à l’atelier', rdv: 'atelier' }] });
      }
      if (op === 'toleaf') {
        if (!confirm('Remplacer cette question et toute sa suite par une fin de parcours ?')) return;
        Object.keys(n).forEach((k) => delete n[k]);
        Object.assign(n, { cause: '', geste: '', prod: '' });
      }
      dirty = true;
      render();
    };
  }

  // ---------- App content: lists, reminders, workshop reasons, game ----------

  VIEWS.content = async (el) => {
    const [lists, reminders, motifs, steps] = await Promise.all(['lists', 'reminders', 'motifs', 'steps'].map((k) => api('GET', `/api/admin/catalog/${k}`).then((r) => r.value)));
    const ro = isAdmin() ? '' : 'readonly';
    const listCard = (key, title) => `<form class="card form" data-list="${key}">
        <h2>${esc(title)}</h2>
        <label>Une étape par ligne<textarea name="items" rows="${(lists[key]?.items.length || 4) + 2}" ${ro}>${esc((lists[key]?.items || []).join('\n'))}</textarea></label>
        <label>Note affichée sous la liste<input name="note" value="${esc(lists[key]?.note || '')}" ${ro}></label>
        ${isAdmin() ? '<button class="btn primary">Enregistrer</button>' : ''}
      </form>`;
    el.innerHTML = `${pageHeader('Contenus de l’appli')}
      <p class="muted">Ces textes apparaissent dans l’écran « Gestes du quotidien », les rappels, les rendez-vous atelier et la mission « Préparer le départ ».</p>
      <div class="detail-grid">${listCard('arrivee', 'Liste « Arrivée »')}${listCard('depart', 'Liste « Départ »')}</div>
      <div class="card"><h2>Rappels d’entretien (${reminders.length})</h2>
        <div class="table-wrap"><table><thead><tr><th>Rappel</th><th>Quand</th><th>Motif de rendez-vous</th><th></th></tr></thead><tbody>
        ${reminders.map((r, i) => `<tr><td>${esc(r.t)}</td><td>${esc(r.w)}</td><td>${esc(r.m || '')}</td><td class="row-actions">${isAdmin() ? `<button class="btn small" data-act="rem" data-id="${i}">Modifier</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card"><h2>Motifs de rendez-vous atelier (${motifs.length})</h2>
        <div class="table-wrap"><table><thead><tr><th>Motif</th><th>Explication</th><th></th></tr></thead><tbody>
        ${motifs.map((m, i) => `<tr><td><strong>${esc(m.t)}</strong><br><small class="muted">${esc(m.id)}</small></td><td>${esc(m.why || '')}</td><td class="row-actions">${isAdmin() ? `<button class="btn small" data-act="motif" data-id="${i}">Modifier</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="card"><h2>Mission « Préparer le départ » (${steps.length} étapes, dans l’ordre)</h2>
        <div class="table-wrap"><table><thead><tr><th>#</th><th>Geste</th><th>Pourquoi</th><th></th></tr></thead><tbody>
        ${steps.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.t)}</td><td>${esc(s.why)}</td><td class="row-actions">${isAdmin() ? `<button class="btn small" data-act="step" data-id="${i}">Modifier</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div></div>
      ${isAdmin() ? '<div class="card"><h2>Réglages avancés</h2><p class="muted">Variantes (types de frigo, chauffage…), équipements implicites, poids des accessoires, dépassements : à modifier avec précaution.</p><div class="actions"><button class="btn" data-act="config">Modifier les réglages (JSON)</button></div></div>' : ''}`;

    el.querySelectorAll('[data-list]').forEach((f) => {
      f.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        const next = { ...lists, [f.dataset.list]: { ...lists[f.dataset.list], note: fd.get('note'), items: fd.get('items').split('\n').map((s) => s.trim()).filter(Boolean) } };
        try {
          await api('PUT', '/api/admin/catalog/lists', { value: next });
          toast('Liste enregistrée');
          VIEWS.content(el);
        } catch (err) {
          toast(err.message, 'error');
        }
      };
    });

    const saveArray = (key, arr) => api('PUT', `/api/admin/catalog/${key}`, { value: arr }).then(() => {
      toast('Enregistré');
      VIEWS.content(el);
    });
    bind(el, {
      rem: (i) =>
        openForm({
          title: 'Rappel',
          values: { ...reminders[i], needs: (reminders[i].needs || []).join(', ') },
          fields: [
            { name: 't', label: 'Rappel', required: true, full: true },
            { name: 'w', label: 'Quand', full: true },
            { name: 'm', label: 'Motif de rendez-vous associé', type: 'select', options: [['', '—'], ...motifs.map((m) => [m.id, m.t])] },
            { name: 'needs', label: 'Seulement si le véhicule a l’un de ces équipements (identifiants séparés par des virgules)', full: true },
          ],
          onSubmit: (data) => {
            const r = { t: data.t, w: data.w };
            if (data.m) r.m = data.m;
            const needs = data.needs.split(',').map((s) => s.trim()).filter(Boolean);
            if (needs.length) r.needs = needs;
            const next = reminders.slice();
            next[i] = r;
            return saveArray('reminders', next);
          },
        }),
      motif: (i) =>
        openForm({
          title: 'Motif de rendez-vous',
          values: motifs[i],
          fields: [
            { name: 't', label: 'Motif', required: true, full: true },
            { name: 'why', label: 'Explication pour le client', type: 'textarea', rows: 4 },
          ],
          onSubmit: (data) => {
            const next = motifs.slice();
            next[i] = { ...motifs[i], t: data.t, why: data.why };
            return saveArray('motifs', next);
          },
        }),
      step: (i) =>
        openForm({
          title: `Étape ${i + 1}`,
          values: steps[i],
          fields: [
            { name: 't', label: 'Geste', required: true, full: true },
            { name: 'why', label: 'Pourquoi (indice donné au client)', type: 'textarea', rows: 3 },
          ],
          onSubmit: (data) => {
            const next = steps.slice();
            next[i] = { t: data.t, why: data.why };
            return saveArray('steps', next);
          },
        }),
      config: async () => {
        const cfg = (await api('GET', '/api/admin/catalog/config')).value;
        openForm({
          title: 'Réglages avancés (JSON)',
          fields: [{ name: 'json', label: 'IMPL : équipements implicites · VARIANTS : types · WT : poids des accessoires (kg) · DIMS : dépassements (cm) · PLATE : où trouver la plaque', type: 'textarea', rows: 24, full: true }],
          values: { json: JSON.stringify(cfg, null, 1) },
          onSubmit: async ({ json }) => {
            let value;
            try {
              value = JSON.parse(json);
            } catch {
              throw new Error('JSON invalide : vérifiez les virgules et les guillemets');
            }
            await api('PUT', '/api/admin/catalog/config', { value });
            toast('Réglages enregistrés');
          },
        });
      },
    });
  };

  // ---------- Vehicle profile and photos ----------

  VIEWS.vehicleProfile = async (el, vehicleId, back) => {
    const [vehicles, profile, equipment, config] = await Promise.all([
      api('GET', '/api/admin/vehicles'),
      api('GET', `/api/admin/vehicles/${vehicleId}/profile`),
      api('GET', '/api/admin/equipment'),
      api('GET', '/api/admin/catalog/config').then((r) => r.value),
    ]);
    const v = vehicles.find((x) => x.id === vehicleId);
    const photoOf = Object.fromEntries(profile.photos.map((p) => [p.id, p.url]));
    const eqName = Object.fromEntries(equipment.map((q) => [q.id, q.name]));
    const W = { ptac: 'PTAC (kg)', mom: 'Masse en ordre de marche (kg)', pax: 'Passagers', eau: 'Eau propre (L)', gaz: 'Gaz (kg)', bag: 'Bagages (kg)' };
    el.innerHTML = `${pageHeader(`Profil appli : ${v.brandName} ${v.name}`, '<button class="btn" data-act="back">← Véhicules</button><button class="btn primary" data-act="edit">Modifier le profil</button>')}
      <div class="detail-grid">
        <div class="card">
          <h2>Ce que voit le client</h2>
          <dl class="facts">
            <div><dt>Accueil</dt><dd>${esc(profile.heroPrefix)} <strong>${esc(profile.heroName)}</strong></dd></div>
            <div><dt>Nom complet</dt><dd>${esc(profile.fullName)}</dd></div>
            <div><dt>Longueur / hauteur</dt><dd>${esc(profile.model.l)} m / ${esc(profile.model.h)} m</dd></div>
            <div><dt>Préfixe des codes clients</dt><dd>${esc(profile.codePrefix)}</dd></div>
            ${Object.entries(W).map(([k, l]) => `<div><dt>${esc(l)}</dt><dd>${esc(profile.weights[k])}</dd></div>`).join('')}
          </dl>
          <p class="muted">Équipements en plus de la série : ${esc(profile.extra.map((i) => eqName[i] || i).join(', ') || '—')}</p>
          <p class="muted">Types connus : ${esc(Object.entries(profile.vars).map(([k, val]) => `${config.VARIANTS?.[k]?.q || k} : ${(config.VARIANTS?.[k]?.o || []).find((o) => o[0] === val)?.[1] || val}`).join(' · ') || '—')}</p>
        </div>
        <div class="card">
          <h2>Plan vu du dessus (« C’est quoi, ça ? »)</h2>
          ${profile.planUrl ? `<img class="cover" src="${esc(profile.planUrl)}" alt="">` : '<p class="muted">Aucun plan : l’image du plan n’était pas dans le dossier fourni. Ajoutez-la (format 800 × 360 conseillé).</p>'}
          <p class="muted">${profile.spots.length} zones numérotées.</p>
          <div class="actions"><button class="btn" data-act="plan">${profile.planUrl ? 'Changer le plan' : 'Ajouter le plan'}</button>${profile.planUrl ? '<button class="btn danger" data-act="noplan">Retirer</button>' : ''}</div>
        </div>
      </div>
      <div class="card">
        <h2>Photos des équipements (${profile.photos.length})</h2>
        <p class="muted">Sur ce véhicule, un équipement de série n’est coché d’office que s’il a sa photo. Cliquez sur une photo pour la remplacer.</p>
        <div class="eq-photos">${equipment
          .map(
            (q) => `<div class="eq-photo ${photoOf[q.id] ? '' : 'none'}">
            <button type="button" data-act="photo" data-key="${esc(q.id)}" title="${esc(q.name)}">${photoOf[q.id] ? `<img src="${esc(photoOf[q.id])}" alt="" loading="lazy">` : '<span>＋ Photo</span>'}</button>
            <small>${esc(q.name)}</small>
            ${photoOf[q.id] ? `<button type="button" class="linkbtn" data-act="nophoto" data-key="${esc(q.id)}">Retirer</button>` : ''}
          </div>`
          )
          .join('')}</div>
      </div>`;

    const reload = () => VIEWS.vehicleProfile(el, vehicleId, back);
    bindKeys(el, {
      back: () => back(),
      plan: async () => {
        const img = await pickImage();
        if (!img) return;
        await api('PUT', `/api/admin/vehicles/${vehicleId}/profile`, { plan: img });
        toast('Plan enregistré');
        reload();
      },
      noplan: async () => {
        await api('PUT', `/api/admin/vehicles/${vehicleId}/profile`, { plan: null });
        reload();
      },
      photo: async (id) => {
        const img = await pickImage();
        if (!img) return;
        await api('PUT', `/api/admin/vehicles/${vehicleId}/photos/${encodeURIComponent(id)}`, { image: img });
        toast('Photo enregistrée');
        reload();
      },
      nophoto: async (id) => {
        if (!confirm('Retirer cette photo ?')) return;
        await api('PUT', `/api/admin/vehicles/${vehicleId}/photos/${encodeURIComponent(id)}`, { image: null });
        reload();
      },
      edit: () => {
        const variantFields = Object.entries(config.VARIANTS || {}).map(([k, V]) => ({
          name: `var_${k}`,
          label: V.q,
          type: 'select',
          options: [['', '— Non précisé —'], ...V.o.map((o) => [o[0], o[1]])],
        }));
        openForm({
          title: 'Profil du véhicule dans l’appli',
          values: {
            ...profile,
            l: profile.model.l,
            h: profile.model.h,
            ...Object.fromEntries(Object.keys(W).map((k) => [`w_${k}`, profile.weights[k]])),
            extra: profile.extra.join(', '),
            ...Object.fromEntries(Object.entries(profile.vars).map(([k, val]) => [`var_${k}`, val])),
          },
          fields: [
            { name: 'heroPrefix', label: 'Accueil : mot avant le nom (ex : Van)' },
            { name: 'heroName', label: 'Accueil : nom (ex : V114)' },
            { name: 'fullName', label: 'Nom complet (ex : Challenger V114 Road Edition 2027)', full: true },
            { name: 'codePrefix', label: 'Préfixe des codes clients (ex : V114)' },
            { name: 'l', label: 'Longueur (m)', type: 'number', attrs: 'step="0.01"' },
            { name: 'h', label: 'Hauteur (m)', type: 'number', attrs: 'step="0.01"' },
            ...Object.entries(W).map(([k, l]) => ({ name: `w_${k}`, label: l, type: 'number' })),
            { name: 'extra', label: 'Équipements en plus de la série (identifiants séparés par des virgules)', full: true },
            ...variantFields,
          ],
          onSubmit: async (data) => {
            const vars = {};
            Object.keys(config.VARIANTS || {}).forEach((k) => data[`var_${k}`] && (vars[k] = data[`var_${k}`]));
            await api('PUT', `/api/admin/vehicles/${vehicleId}/profile`, {
              heroPrefix: data.heroPrefix,
              heroName: data.heroName,
              fullName: data.fullName,
              codePrefix: data.codePrefix,
              model: { l: data.l, h: data.h },
              weights: Object.fromEntries(Object.keys(W).map((k) => [k, data[`w_${k}`]])),
              extra: data.extra.split(',').map((s) => s.trim()).filter(Boolean),
              vars,
            });
            toast('Profil enregistré : visible dans les applications');
            reload();
          },
        });
      },
    });
  };

  // Like bind(), but passes string identifiers (equipment and diagnostic ids are text).
  function bindKeys(container, handlers) {
    container.onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (b && handlers[b.dataset.act]) handlers[b.dataset.act](b.dataset.key, b);
    };
  }
}
