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
  const { api, openForm, pageHeader, bind, confirmDelete, thumb, canEditContent } = h;
  const state = { diagFilter: '', diagCat: '', eqFilter: '', eqCat: '' };

  // ---------- Equipment ----------

  const VEHICLE_TYPES = [
    ['van', 'Van'],
    ['fourgon', 'Fourgon aménagé'],
    ['compact', 'Profilé compact'],
    ['profile', 'Profilé'],
    ['integral', 'Intégral'],
    ['capucine', 'Capucine'],
  ];
  const typesLabel = (types) => (types?.length ? types.map((t) => (VEHICLE_TYPES.find((x) => x[0] === t) || [, t])[1]).join(', ') : 'Tous');

  VIEWS.equipment = async (el) => {
    const [list, cats] = await Promise.all([api('GET', '/api/admin/equipment'), api('GET', '/api/admin/catalog/cats').then((r) => r.value)]);
    const catName = Object.fromEntries(cats);
    const nameById = Object.fromEntries(list.map((x) => [x.id, x.name]));
    const kidsN = list.reduce((n, x) => (x.grp ? { ...n, [x.grp]: (n[x.grp] || 0) + 1 } : n), {});
    const ROLES = { always: 'toujours là', option: 'option', pick: 'un seul au choix' };
    const q = state.eqFilter.toLowerCase();
    const shown = list.filter((x) => (!state.eqCat || x.cat === state.eqCat) && (!q || [x.name, x.text, x.kw, x.id].some((t) => (t || '').toLowerCase().includes(q))));
    el.innerHTML = `${pageHeader(`Équipements (${list.length})`, canEditContent() ? '<button class="btn primary" data-act="add">＋ Nouvel équipement</button>' : '')}
      <p class="muted">Le catalogue commun à tous les véhicules. Ce qui est pré-coché, et les photos, se règlent pour chaque véhicule (Véhicules → Profil appli et photos).</p>
      <form class="search-bar" id="eq-search"><input name="q" type="search" placeholder="Chercher : Truma, frigo, marchepied…" value="${esc(state.eqFilter)}"><button class="btn">Filtrer</button></form>
      <div class="filters"><button class="chip ${!state.eqCat ? 'active' : ''}" data-act="cat" data-value="">Toutes</button>${cats
        .map(([id, n]) => `<button class="chip ${state.eqCat === id ? 'active' : ''}" data-act="cat" data-value="${esc(id)}">${esc(n)}</button>`)
        .join('')}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Équipement</th><th>Rubrique</th><th>Véhicules</th><th>Zone du plan</th><th></th></tr></thead>
        <tbody>${shown
          .map(
            (x) => `<tr>
          <td><strong>${esc(x.name)}</strong>${x.grp && nameById[x.grp] ? `<br><small>↳ élément de « ${esc(nameById[x.grp])} » · ${esc(ROLES[x.role] || 'option')}</small>` : kidsN[x.id] ? `<br><small>Ensemble : ${kidsN[x.id]} élément(s)</small>` : ''}${x.dated ? ' <small>📅</small>' : ''}<br><small class="muted">${esc(x.text || '').slice(0, 110)}${(x.text || '').length > 110 ? '…' : ''}</small></td>
          <td>${esc(catName[x.cat] || x.cat)}</td>
          <td><small>${esc(typesLabel(x.types))}</small></td>
          <td>${esc(x.spot || '')}</td>
          <td class="row-actions">${canEditContent() ? `<button class="btn small" data-act="edit" data-key="${esc(x.id)}">Modifier</button><button class="btn small danger" data-act="del" data-key="${esc(x.id)}">Supprimer</button>` : ''}</td>
        </tr>`
          )
          .join('')}</tbody></table>${shown.length ? '' : '<p class="muted">Aucun équipement.</p>'}</div>`;

    const fields = [
      { name: 'name', label: 'Nom', required: true, full: true },
      { name: 'cat', label: 'Rubrique', type: 'select', options: cats },
      { name: 'spot', label: 'Zone du plan par défaut (cab, din, cui, sdb, toit, ent, lit, gar, sal, pav, cap, tech, ext, extb, arr)', full: true },
      ...VEHICLE_TYPES.map(([id, n]) => ({ name: `type_${id}`, label: `Existe sur : ${n}`, type: 'checkbox' })),
      { name: 'text', label: 'Explication (« C’est quoi, ça ? »)', type: 'textarea', rows: 4 },
      { name: 'tip', label: 'Conseil', type: 'textarea', rows: 2 },
      { name: 'kw', label: 'Mots-clés de recherche', full: true },
      {
        name: 'grp', label: 'Fait partie de l’ensemble', type: 'select', full: true,
        options: [['', '— Aucun : c’est un ensemble ou un équipement seul —'], ...list.filter((x) => !x.grp).map((x) => [x.id, x.name]).sort((a, b) => a[1].localeCompare(b[1], 'fr'))],
        hint: 'Un élément (lyre, détendeur…) s’affiche sous son ensemble (coffre à gaz) dans l’appli, sur le plan et dans le relevé.',
      },
      { name: 'role', label: 'Sorte d’élément', type: 'select', options: [['always', 'Toujours là avec l’ensemble'], ['option', 'Option (cochée si le véhicule l’a)'], ['pick', 'Un seul au choix parmi plusieurs']], hideIf: ['grp', ['']] },
      { name: 'pick', label: 'Groupe du choix (même mot pour les éléments entre lesquels on choisit, ex. « batterie »)', hideIf: ['grp', ['']] },
      { name: 'note', label: 'Remarque importante (encadré)', full: true, hint: 'Ex. « Ne marche que branchée sur le 230 V ».' },
      { name: 'dkind', label: 'Date à suivre (rappel dans le carnet d’entretien)', type: 'select', options: [['', 'Aucune'], ['until', 'Date limite marquée dessus'], ['made', 'Date de fabrication marquée dessus'], ['every', 'À changer régulièrement (date du dernier changement)']] },
      { name: 'dyears', label: 'Se change combien d’années après sa fabrication ?', type: 'number', hideIf: ['dkind', ['', 'until', 'every']] },
      { name: 'dmonths', label: 'À changer tous les combien de mois ?', type: 'number', hideIf: ['dkind', ['', 'until', 'made']] },
      { name: 'dlabel', label: 'Où lire la date (texte affiché au client)', full: true, hideIf: ['dkind', ['']] },
    ];
    // No box ticked = the equipment exists on every type of vehicle.
    function withTypes(data) {
      const types = VEHICLE_TYPES.map(([t]) => t).filter((t) => data[`type_${t}`]);
      VEHICLE_TYPES.forEach(([t]) => delete data[`type_${t}`]);
      const { dkind, dyears, dmonths, dlabel, ...rest } = data;
      const dated = dkind ? { kind: dkind, years: Number(dyears) || undefined, months: Number(dmonths) || undefined, label: dlabel } : null;
      return { ...rest, grp: rest.grp || '', role: rest.grp ? rest.role : '', pick: rest.grp && rest.role === 'pick' ? rest.pick : '', dated, types: types.length === VEHICLE_TYPES.length ? [] : types };
    }
    function typeValues(x) {
      const all = !x.types?.length;
      return {
        ...x,
        dkind: x.dated?.kind || '', dyears: x.dated?.years || 10, dmonths: x.dated?.months || 12, dlabel: x.dated?.label || '',
        ...Object.fromEntries(VEHICLE_TYPES.map(([t]) => [`type_${t}`, all || x.types.includes(t)])),
      };
    }
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
            await api('POST', '/api/admin/equipment', withTypes(data));
            toast('Équipement créé');
            VIEWS.equipment(el);
          },
        }),
      edit: (id) =>
        openForm({
          title: 'Modifier l’équipement',
          fields,
          values: typeValues(list.find((x) => x.id === id)),
          onSubmit: async (data) => {
            await api('PUT', `/api/admin/equipment/${encodeURIComponent(id)}`, withTypes(data));
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
    el.innerHTML = `${pageHeader(`Diagnostics (${list.length} entrées, ${total} fins de parcours)`, canEditContent() ? '<button class="btn primary" data-act="add">＋ Nouveau diagnostic</button>' : '')}
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
    const canEdit = canEditContent();
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

  // ---------- Vehicle profile and photos ----------

  VIEWS.vehicleProfile = async (el, vehicleId, back) => {
    const [vehicles, profile, equipment, config, cats, layouts] = await Promise.all([
      api('GET', '/api/admin/vehicles'),
      api('GET', `/api/admin/vehicles/${vehicleId}/profile`),
      api('GET', '/api/admin/equipment'),
      api('GET', '/api/admin/catalog/config').then((r) => r.value),
      api('GET', '/api/admin/catalog/cats').then((r) => r.value),
      api('GET', '/api/admin/layouts'),
    ]);
    const v = vehicles.find((x) => x.id === vehicleId);
    const eqById = Object.fromEntries(equipment.map((q) => [q.id, q]));
    const isKid = (q) => !!(q.grp && q.grp !== q.id && eqById[q.grp]);
    const hidden = (config && config.HIDDEN_EQ) || {};
    const kidsOf = (id) => equipment.filter((q) => q.grp === id && q.grp !== q.id && !hidden[q.id]);
    const ensOn = (id) => profile.equipment.includes(id) || equipment.some((q) => q.grp === id && profile.equipment.includes(q.id));
    // An « always » element of a ticked ensemble shows ticked (the app counts it in anyway).
    const has = (id) => profile.equipment.includes(id) || (eqById[id]?.role === 'always' && !eqById[id].noimpl && eqById[id].grp && profile.equipment.includes(eqById[id].grp));
    const fits = (q) => !profile.type || !q.types?.length || q.types.includes(profile.type) || has(q.id);
    const KIND = { always: 'compris', option: 'option', pick: 'un seul au choix' };
    const presetRow = (q, kid = false) =>
      `<label class="check${kid ? ' preset-kid' : ''}"><input type="checkbox" name="eq" value="${esc(q.id)}" ${has(q.id) || (!kid && ensOn(q.id)) ? 'checked' : ''}> ${esc(profile.labels?.[q.id] || q.name)}${kid ? ` <small class="muted">${KIND[q.role] || 'option'}</small>` : ''}</label>`;
    const presetKids = (q) => {
      const ks = kidsOf(q.id);
      if (!ks.length) return '';
      const on = ensOn(q.id);
      return `<div class="preset-kids" data-kids="${esc(q.id)}" ${on ? '' : 'hidden'}>${ks.map((k) => presetRow(k, true)).join('')}</div>`;
    };
    const presetForm_wire = (form) =>
      form.addEventListener('change', (e) => {
        const box = e.target;
        if (box.name !== 'eq') return;
        const q = eqById[box.value];
        if (!q) return;
        const input = (id) => form.querySelector(`input[name=eq][value="${CSS.escape(id)}"]`);
        const kids = kidsOf(q.id);
        if (kids.length) {
          kids.forEach((k) => {
            const i = input(k.id);
            if (i) i.checked = box.checked ? i.checked || (k.role === 'always' && !k.noimpl) : false;
          });
          const wrap = form.querySelector(`[data-kids="${CSS.escape(q.id)}"]`);
          if (wrap) wrap.hidden = !box.checked;
        }
        if (isKid(q) && box.checked) {
          if (q.role === 'pick') kidsOf(q.grp).forEach((k) => k.pick === q.pick && k.id !== q.id && input(k.id) && (input(k.id).checked = false));
          const parent = input(q.grp);
          if (parent) parent.checked = true;
        }
        el.querySelector('#preset-n').textContent = form.querySelectorAll('input[name=eq]:checked').length;
      });
    const photoOf = Object.fromEntries(profile.photos.map((p) => [p.id, p.url]));
    const eqName = Object.fromEntries(equipment.map((q) => [q.id, q.name]));
    const W = { ptac: 'PTAC (kg)', mom: 'Masse en ordre de marche (kg)', pax: 'Passagers', eau: 'Eau propre (L)', gaz: 'Gaz (kg)', bag: 'Bagages (kg)' };
    el.innerHTML = `${pageHeader(`Profil appli : ${v.brandName} ${v.name}`, `<button class="btn" data-act="back">← Véhicules</button><a class="btn" href="/admin/releve/#v=${vehicleId}" target="_blank" rel="noopener">📱 Relevé sur téléphone</a><button class="btn primary" data-act="edit">Modifier le profil</button>`)}
      <div class="detail-grid">
        <div class="card">
          <h2>Ce que voit le client</h2>
          <dl class="facts">
            <div><dt>Accueil</dt><dd>${esc(profile.heroPrefix)} <strong>${esc(profile.heroName)}</strong></dd></div>
            <div><dt>Nom complet</dt><dd>${esc(profile.fullName)}</dd></div>
            <div><dt>Type</dt><dd>${esc(typesLabel(profile.type ? [profile.type] : []).replace('Tous', '—'))}</dd></div>
            <div><dt>Plan</dt><dd>${esc(layouts.find((L) => L.id === profile.plan.layout)?.name || (profile.planUrl ? 'Plan importé' : '—'))}</dd></div>
            <div><dt>Longueur / hauteur</dt><dd>${esc(profile.model.l)} m / ${esc(profile.model.h)} m</dd></div>
            <div><dt>Préfixe des codes clients</dt><dd>${esc(profile.codePrefix)}</dd></div>
            ${Object.entries(W).map(([k, l]) => `<div><dt>${esc(l)}</dt><dd>${esc(profile.weights[k])}</dd></div>`).join('')}
          </dl>
          <p class="muted">Types connus : ${esc(Object.entries(profile.vars).map(([k, val]) => `${config.VARIANTS?.[k]?.q || k} : ${(config.VARIANTS?.[k]?.o || []).find((o) => o[0] === val)?.[1] || val}`).join(' · ') || '—')}</p>
        </div>
        <div class="card">
          <h2>Plan vu du dessus (« C’est quoi, ça ? »)</h2>
          ${
            profile.plan.planUrl
              ? `<img class="cover" src="${esc(profile.plan.planUrl)}" alt="">${profile.planUrl ? '' : '<p class="muted">Plan schématique du type de véhicule. Vous pouvez le remplacer par le vrai plan (format 800 × 360, cabine à droite, porte en bas).</p>'}`
              : '<p class="muted">Pas de plan : choisissez le type de véhicule (Modifier le profil).</p>'
          }
          <p class="muted">${profile.plan.spots.length} zones numérotées : ${esc(profile.plan.spots.map((s) => `${s.n}. ${s.name}`).join(' · '))}</p>
          <div class="actions"><button class="btn" data-act="plan">${profile.planUrl ? 'Changer le plan' : 'Ajouter le plan'}</button>${profile.planUrl ? '<button class="btn danger" data-act="noplan">Retirer</button>' : ''}</div>
        </div>
      </div>
      <form class="card" id="preset-form">
        <div class="page-head"><h2>Équipements pré-cochés pour ce véhicule (<span id="preset-n">${profile.equipment.length}</span>)</h2>
          <div class="actions"><button type="button" class="btn small" data-act="none">Tout décocher</button><button class="btn primary">Enregistrer la liste</button></div></div>
        <p class="muted">Ce que le client trouve déjà coché à la mise en main. La concession ajuste ensuite tout avec lui (ajouter, décocher) pour son véhicule.</p>
        <div class="preset-cats">${cats
          .map(
            ([cid, cname]) => `<fieldset><legend>${esc(cname)}</legend>${equipment
              .filter((q) => q.cat === cid && !isKid(q) && !hidden[q.id])
              .filter((q) => fits(q) || kidsOf(q.id).some((k) => has(k.id)))
              .map((q) => presetRow(q) + presetKids(q))
              .join('')}</fieldset>`
          )
          .join('')}</div>
      </form>
      <div class="card">
        <h2>Photos des équipements (${profile.photos.length})</h2>
        <p class="muted">Photos de ce véhicule, affichées dans « C’est quoi, ça ? ». Cliquez sur une photo pour la remplacer.</p>
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
    // Ensembles and elements, as in the relevé: an ensemble brings its « always » elements and takes them all away
    // when unticked; « un seul au choix » unticks the others; ticking an element ticks its ensemble.
    presetForm_wire(el.querySelector('#preset-form'));
    const presetForm = el.querySelector('#preset-form');
    const count = () => (el.querySelector('#preset-n').textContent = presetForm.querySelectorAll('input[name=eq]:checked').length);
    presetForm.addEventListener('change', count);
    presetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ids = [...presetForm.querySelectorAll('input[name=eq]:checked')].map((i) => i.value);
      try {
        await api('PUT', `/api/admin/vehicles/${vehicleId}/profile`, { equipment: ids });
        toast(`Liste enregistrée : ${ids.length} équipements pré-cochés`);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    bindKeys(el, {
      back: () => back(),
      none: () => {
        presetForm.querySelectorAll('input[name=eq]').forEach((i) => (i.checked = false));
        count();
      },
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
            ...Object.fromEntries(Object.entries(profile.vars).map(([k, val]) => [`var_${k}`, val])),
          },
          fields: [
            { name: 'type', label: 'Type de véhicule', type: 'select', options: [['', '— Non précisé —'], ...VEHICLE_TYPES] },
            {
              name: 'layout',
              label: 'Plan (implantation)',
              type: 'select',
              hint: 'Choisir un plan règle aussi le type.',
              options: [['', '— Plan habituel du type —'], ...layouts.map((L) => [L.id, `${typesLabel([L.type])} : ${L.name}`])],
            },
            { name: 'heroPrefix', label: 'Accueil : mot avant le nom (ex : Van)' },
            { name: 'heroName', label: 'Accueil : nom (ex : V114)' },
            { name: 'fullName', label: 'Nom complet (ex : Challenger V114 Road Edition 2027)', full: true },
            { name: 'codePrefix', label: 'Préfixe des codes clients (ex : V114)' },
            { name: 'l', label: 'Longueur (m)', type: 'number', attrs: 'step="0.01"' },
            { name: 'h', label: 'Hauteur (m)', type: 'number', attrs: 'step="0.01"' },
            ...Object.entries(W).map(([k, l]) => ({ name: `w_${k}`, label: l, type: 'number' })),
            ...variantFields,
          ],
          onSubmit: async (data) => {
            const vars = {};
            Object.keys(config.VARIANTS || {}).forEach((k) => data[`var_${k}`] && (vars[k] = data[`var_${k}`]));
            await api('PUT', `/api/admin/vehicles/${vehicleId}/profile`, {
              type: data.layout ? undefined : data.type,
              layout: data.layout,
              heroPrefix: data.heroPrefix,
              heroName: data.heroName,
              fullName: data.fullName,
              codePrefix: data.codePrefix,
              model: { l: data.l, h: data.h },
              weights: Object.fromEntries(Object.keys(W).map((k) => [k, data[`w_${k}`]])),
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
