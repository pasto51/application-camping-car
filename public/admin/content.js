// « Contenus de l'appli »: everything of the app that is not a vehicle, a piece of equipment or a diagnostic, editable
// here (administrator and content editor): the daily lists, the maintenance logbook (each kind for its own customers),
// the workshop appointment reasons, « Ce que j'emporte », the weight and size of the equipment added after delivery.

import { esc, toast } from '/shared/common.js';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

export function registerContentView(VIEWS, { api, openForm, pageHeader, bind, confirmDelete }) {
  VIEWS.content = async (el) => {
    const [lists, motifs, config, ent, carry, opts] = await Promise.all([
      api('GET', '/api/admin/catalog/lists').then((r) => r.value),
      api('GET', '/api/admin/catalog/motifs').then((r) => r.value),
      api('GET', '/api/admin/catalog/config').then((r) => r.value),
      api('GET', '/api/admin/entretien'),
      api('GET', '/api/admin/carry'),
      api('GET', '/api/admin/banners'), // the dealerships, vehicle types and equipment to choose from
    ]);
    const eqName = Object.fromEntries(opts.equipment);
    const typeName = Object.fromEntries(opts.vehicleTypes);
    const dealerName = Object.fromEntries(opts.dealerships.map((d) => [d.id, d.name]));
    const motifName = Object.fromEntries(motifs.map((m) => [m.id, m.t]));
    const WT = config.WT || {};
    const DIMS = config.DIMS || {};

    const freq = (k) =>
      k.every ? `Tous les ${k.every} mois (depuis la mise en main ou la dernière fois)` : k.season ? `Chaque année vers le ${Number(k.season.slice(3))} ${MONTHS[Number(k.season.slice(0, 2)) - 1]}${k.after ? ` (pas avant ${k.after} mois après la mise en main)` : ''}` : 'Sans date : le client le note seulement';
    const who = (k) => {
      const p = [];
      if (k.dealershipIds?.length) p.push(k.dealershipIds.map((id) => dealerName[id] || '?').join(', '));
      if (k.vehicleTypes?.length) p.push(k.vehicleTypes.map((t) => typeName[t] || t).join(', '));
      if (k.equipmentAny?.length) p.push(`avec ${k.equipmentAny.map((id) => eqName[id] || id).join(' ou ')}`);
      if (k.equipmentNone?.length) p.push(`sans ${k.equipmentNone.map((id) => eqName[id] || id).join(' ni ')}`);
      return p.length ? p.join(' · ') : 'Tous les clients';
    };
    const table = (head, rows, empty = 'Aucun.') =>
      rows.length ? `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}<th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` : `<p class="muted">${empty}</p>`;
    const actions = (act, id) => `<td class="row-actions"><button class="btn small" data-act="${act}" data-id="${id}">Modifier</button><button class="btn small danger" data-act="${act}-del" data-id="${id}">Supprimer</button></td>`;
    // The daily lists: one tab each in the app. A line may be for some vehicles only (equipment, or a variant).
    const variantName = (v) => {
      const V = config.VARIANTS?.[v[0]];
      return V ? `${V.q} : ${(V.o.find((o) => o[0] === v[1]) || [])[1] || v[1]}` : v.join(' = ');
    };
    const itemText = (it) => (typeof it === 'string' ? it : it.t);
    const itemCond = (it) => {
      if (typeof it === 'string') return '';
      const p = [];
      if (it.eq?.length) p.push(`avec ${it.eq.map((id) => eqName[id] || id).join(' ou ')}`);
      if (it.variant) p.push(variantName(it.variant));
      return p.join(' · ');
    };
    const LIST_NAMES = { arrivee: 'Arrivée', depart: 'Départ' };
    const listTitle = (k) => lists[k]?.title || LIST_NAMES[k] || k;
    const listCard = (key) => {
      const L = lists[key];
      return `<div class="card">
        <div class="card-head"><h3>Onglet « ${esc(listTitle(key))} » (${L.items.length} lignes)</h3>
          <div class="row-actions"><button class="btn small" data-act="list-edit" data-key="${esc(key)}">Nom, but et note</button><button class="btn small primary" data-act="line-add" data-key="${esc(key)}">+ Ligne</button><button class="btn small danger" data-act="list-del" data-key="${esc(key)}">Supprimer la liste</button></div></div>
        ${L.goal ? `<p><strong>Le but :</strong> ${esc(L.goal)}</p>` : ''}
        ${table(
          ['#', 'Ligne', 'Pour qui'],
          L.items.map(
            (it, n) => `<tr><td>${n + 1}</td><td>${esc(itemText(it))}</td><td>${esc(itemCond(it)) || '<span class="muted">Tous</span>'}</td>
              <td class="row-actions"><button class="btn small" data-act="line-up" data-key="${esc(key)}" data-id="${n}" ${n ? '' : 'disabled'} aria-label="Monter">↑</button><button class="btn small" data-act="line-edit" data-key="${esc(key)}" data-id="${n}">Modifier</button><button class="btn small danger" data-act="line-del" data-key="${esc(key)}" data-id="${n}">Supprimer</button></td></tr>`
          ),
          'Aucune ligne.'
        )}
        ${L.note ? `<p class="muted">Note sous la liste : ${esc(L.note)}</p>` : ''}
      </div>`;
    };
    const wtIds = Object.keys(WT);
    const dimIds = Object.keys(DIMS);

    el.innerHTML = `${pageHeader('Contenus de l’appli')}
      <p class="muted">Tout ce qui est modifié ici est envoyé aux applications des clients à leur prochaine ouverture.</p>
      <nav class="content-toc">
        <a href="#c-gestes">Gestes du quotidien</a><a href="#c-carnet">Carnet d’entretien</a><a href="#c-rdv">Rendez-vous atelier</a><a href="#c-emporte">Ce que j’emporte</a><a href="#c-poids">Poids des équipements</a><a href="#c-dims">Longueur et hauteur</a><a href="#c-avance">Réglages avancés</a>
      </nav>

      <div class="card-head"><h2 class="section-title" id="c-gestes">Gestes du quotidien</h2><button class="btn" data-act="list-add">+ Nouvelle liste</button></div>
      <p class="muted">Chaque liste est un onglet de l’écran « Gestes du quotidien », dans cet ordre. Le client coche au fur et à mesure ; ce qu’il a coché est gardé.</p>
      ${Object.keys(lists).map(listCard).join('')}

      <h2 class="section-title" id="c-carnet">Carnet d’entretien</h2>
      <div class="card">
        <div class="card-head"><h3>Entretiens et rappels (${ent.kinds.length})</h3><button class="btn primary" data-act="kind-add">+ Nouvel entretien</button></div>
        <p class="muted">Chaque entretien a sa fréquence et son public. Le client voit une pastille rouge 45 jours avant, et reçoit une notification 15 jours avant. Un entretien déjà noté par un client reste dans son carnet.</p>
        ${table(
          ['Entretien', 'Quand', 'Pour qui', 'Rendez-vous'],
          ent.kinds.map(
            (k, i) => `<tr${k.active === false ? ' class="muted"' : ''}><td><strong>${esc(k.label)}</strong>${k.active === false ? ' <span class="status">Désactivé</span>' : ''}${k.why ? `<br><small class="muted">${esc(k.why)}</small>` : ''}</td>
              <td>${esc(freq(k))}</td><td>${esc(who(k))}</td><td>${esc(motifName[k.rdv] || '—')}</td>${actions('kind', i)}</tr>`
          )
        )}
      </div>
      <div class="card">
        <div class="card-head"><h3>À vérifier vous-même (${ent.tips.length})</h3><button class="btn" data-act="tip-add">+ Ajouter</button></div>
        <p class="muted">Les petits contrôles sans date, affichés en bas du carnet du client.</p>
        ${table(['Contrôle', 'Quand'], ent.tips.map((t, i) => `<tr><td><strong>${esc(t.label)}</strong></td><td>${esc(t.when)}</td>${actions('tip', i)}</tr>`))}
      </div>

      <h2 class="section-title" id="c-rdv">Rendez-vous atelier</h2>
      <div class="card">
        <div class="card-head"><h3>Motifs de rendez-vous (${motifs.length})</h3><button class="btn" data-act="motif-add">+ Ajouter</button></div>
        ${table(['Motif', 'Explication pour le client'], motifs.map((m, i) => `<tr><td><strong>${esc(m.t)}</strong></td><td>${esc(m.why || '')}</td>${actions('motif', i)}</tr>`))}
      </div>

      <h2 class="section-title" id="c-emporte">Ce que j’emporte (poids du véhicule)</h2>
      <div class="card">
        <div class="card-head"><h3>Ajouts en un geste (${carry.length})</h3><button class="btn" data-act="carry-add">+ Ajouter</button></div>
        <p class="muted">Ce que le client ajoute en un geste à sa liste « Ce que j’emporte », avec un poids habituel qu’il peut corriger.</p>
        ${table(['Objet', 'Poids'], carry.map((c, i) => `<tr><td>${esc(c.n)}</td><td>${c.kg} kg</td>${actions('carry', i)}</tr>`))}
      </div>

      <h2 class="section-title" id="c-poids">Poids des équipements ajoutés</h2>
      <div class="card">
        <div class="card-head"><h3>Poids par équipement (${wtIds.length})</h3><button class="btn" data-act="wt-add">+ Ajouter</button></div>
        <p class="muted">Poids compté quand l’équipement est ajouté après la livraison (ceux d’origine sont déjà dans la masse en ordre de marche). Le client peut le corriger.</p>
        ${table(['Équipement', 'Poids'], wtIds.map((id) => `<tr><td>${esc(eqName[id] || id)}</td><td>${WT[id]} kg</td>${actions('wt', id)}</tr>`))}
      </div>

      <h2 class="section-title" id="c-dims">Longueur et hauteur</h2>
      <div class="card">
        <div class="card-head"><h3>Équipements qui dépassent (${dimIds.length})</h3><button class="btn" data-act="dim-add">+ Ajouter</button></div>
        <p class="muted">Ce qui dépasse à l’arrière (longueur) ou au-dessus du toit (hauteur). Le client peut corriger la mesure ; seul l’équipement qui dépasse le plus compte.</p>
        ${table(['Équipement', 'Où', 'Dépasse de'], dimIds.map((id) => `<tr><td>${esc(eqName[id] || id)}</td><td>${DIMS[id].t === 'l' ? 'À l’arrière (longueur)' : 'Au-dessus du toit (hauteur)'}</td><td>${DIMS[id].v} cm</td>${actions('dim', id)}</tr>`))}
      </div>

      <h2 class="section-title" id="c-avance">Réglages avancés</h2>
      <div class="card"><p class="muted">Variantes (types de frigo, chauffage…), équipements compris d’office, où trouver la plaque : à modifier avec précaution.</p><div class="actions"><button class="btn" data-act="config">Modifier les réglages (JSON)</button></div></div>`;

    // ---- Saving ----
    const reload = () => VIEWS.content(el);
    const saveEnt = async (next, msg = 'Carnet d’entretien enregistré') => {
      await api('PUT', '/api/admin/entretien', next);
      toast(msg);
      reload();
    };
    const saveMotifs = async (next) => {
      await api('PUT', '/api/admin/catalog/motifs', { value: next });
      toast('Motifs enregistrés');
      reload();
    };
    const saveCarry = async (items) => {
      await api('PUT', '/api/admin/carry', { items });
      toast('Liste enregistrée');
      reload();
    };
    const saveConfig = async (patch, msg) => {
      await api('PUT', '/api/admin/catalog/config', { value: { ...config, ...patch } });
      toast(msg);
      reload();
    };
    const saveLists = async (next, msg = 'Liste enregistrée') => {
      await api('PUT', '/api/admin/catalog/lists', { value: next });
      toast(msg);
      reload();
    };

    // ---- Forms ----
    const kindForm = (i) => {
      const k = i === undefined ? { active: true } : ent.kinds[i];
      const mode = k.every ? 'every' : k.season ? 'season' : 'none';
      const notMode = (m) => ['every', 'season', 'none'].filter((x) => x !== m);
      openForm({
        title: i === undefined ? 'Nouvel entretien' : `Entretien : ${k.label}`,
        values: {
          ...k,
          mode,
          every: k.every || 12,
          seasonDay: k.season ? Number(k.season.slice(3)) : 1,
          seasonMonth: k.season ? k.season.slice(0, 2) : '10',
          after: k.after || 0,
          active: k.active !== false,
        },
        fields: [
          { name: 'label', label: 'Nom de l’entretien', required: true, full: true },
          { name: 'why', label: 'Pourquoi (une phrase pour le client)', type: 'textarea', rows: 2 },
          { name: 'mode', label: 'Quand', type: 'select', options: [['every', 'Tous les X mois'], ['season', 'Chaque année à une date (saison)'], ['none', 'Sans date : le client le note seulement']] },
          { name: 'every', label: 'Tous les … mois', type: 'number', hideIf: ['mode', notMode('every')], hint: 'Compté depuis la mise en main, puis depuis la dernière fois noté dans le carnet.' },
          { name: 'seasonDay', label: 'Jour', type: 'number', hideIf: ['mode', notMode('season')] },
          { name: 'seasonMonth', label: 'Mois', type: 'select', options: MONTHS.map((m, n) => [String(n + 1).padStart(2, '0'), m]), hideIf: ['mode', notMode('season')] },
          { name: 'after', label: 'Pas avant … mois après la mise en main', type: 'number', hideIf: ['mode', notMode('season')], hint: 'Ex. : 10 pour la révision du chauffage d’un véhicule tout neuf.' },
          { name: 'rdv', label: 'Bouton « Prendre rendez-vous » : motif', type: 'select', options: [['', 'Aucun'], ...motifs.map((m) => [m.id, m.t])] },
          { name: 'dealershipIds', label: 'Concessions (aucune cochée : toutes)', type: 'checks', options: opts.dealerships.map((x) => [x.id, x.name]) },
          { name: 'vehicleTypes', label: 'Types de véhicule (aucun coché : tous)', type: 'checks', options: opts.vehicleTypes },
          { name: 'equipmentAny', label: 'Seulement les clients qui ont AU MOINS UN de ces équipements', type: 'checks', filter: 'Chercher un équipement (ex. : frigo)', options: opts.equipment, hint: 'Ex. : la révision du réfrigérateur pour ceux qui ont un frigo.' },
          { name: 'equipmentNone', label: 'Pas pour les clients qui ont l’un de ces équipements', type: 'checks', filter: 'Chercher un équipement', options: opts.equipment },
          { name: 'active', label: 'Actif (décocher pour le suspendre sans le supprimer)', type: 'checkbox' },
        ],
        onSubmit: async (d) => {
          const out = { id: k.id || slug(d.label), label: d.label, why: d.why, rdv: d.rdv, dealershipIds: d.dealershipIds, vehicleTypes: d.vehicleTypes, equipmentAny: d.equipmentAny, equipmentNone: d.equipmentNone, active: d.active };
          if (d.mode === 'every') out.every = Number(d.every);
          if (d.mode === 'season') {
            const day = Math.max(1, Math.min(31, Math.round(Number(d.seasonDay) || 1)));
            out.season = `${d.seasonMonth}-${String(day).padStart(2, '0')}`;
            out.after = Number(d.after) || 0;
          }
          const kinds = ent.kinds.slice();
          if (i === undefined) kinds.push(out);
          else kinds[i] = out;
          await saveEnt({ ...ent, kinds });
        },
      });
    };
    const tipForm = (i) =>
      openForm({
        title: i === undefined ? 'Nouveau contrôle' : 'Contrôle à faire soi-même',
        values: i === undefined ? {} : ent.tips[i],
        fields: [
          { name: 'label', label: 'Contrôle', required: true, full: true },
          { name: 'when', label: 'Quand', full: true, hint: 'Ex. : Avant un long trajet.' },
        ],
        onSubmit: async (d) => {
          const tips = ent.tips.slice();
          if (i === undefined) tips.push(d);
          else tips[i] = d;
          await saveEnt({ ...ent, tips });
        },
      });
    const motifForm = (i) =>
      openForm({
        title: i === undefined ? 'Nouveau motif de rendez-vous' : 'Motif de rendez-vous',
        values: i === undefined ? {} : motifs[i],
        fields: [
          { name: 't', label: 'Motif', required: true, full: true },
          { name: 'why', label: 'Explication pour le client', type: 'textarea', rows: 3 },
        ],
        onSubmit: async (d) => {
          const next = motifs.slice();
          if (i === undefined) {
            let id = slug(d.t) || 'motif';
            for (let n = 2; next.some((m) => m.id === id); n++) id = `${slug(d.t)}-${n}`;
            next.push({ id, t: d.t, why: d.why });
          } else next[i] = { ...motifs[i], t: d.t, why: d.why };
          await saveMotifs(next);
        },
      });
    const carryForm = (i) =>
      openForm({
        title: i === undefined ? 'Nouvel objet' : 'Objet',
        values: i === undefined ? { kg: 10 } : carry[i],
        fields: [
          { name: 'n', label: 'Objet', required: true, hint: 'Ex. : Kayak gonflable.' },
          { name: 'kg', label: 'Poids habituel (kg)', type: 'number', required: true },
        ],
        onSubmit: async (d) => {
          const next = carry.slice();
          if (i === undefined) next.push({ n: d.n, kg: Number(d.kg) });
          else next[i] = { n: d.n, kg: Number(d.kg) };
          await saveCarry(next);
        },
      });
    const wtForm = (id) =>
      openForm({
        title: id ? `Poids : ${eqName[id] || id}` : 'Poids d’un équipement',
        values: id ? { eq: id, kg: WT[id] } : { kg: 10 },
        fields: [
          ...(id ? [] : [{ name: 'eq', label: 'Équipement', type: 'select', options: opts.equipment.filter(([e]) => !(e in WT)) }]),
          { name: 'kg', label: 'Poids (kg)', type: 'number', required: true },
        ],
        onSubmit: async (d) => saveConfig({ WT: { ...WT, [id || d.eq]: Math.max(0, Math.round(Number(d.kg) || 0)) } }, 'Poids enregistré'),
      });
    const dimForm = (id) =>
      openForm({
        title: id ? `Dépassement : ${eqName[id] || id}` : 'Équipement qui dépasse',
        values: id ? { eq: id, t: DIMS[id].t, v: DIMS[id].v } : { t: 'l', v: 20 },
        fields: [
          ...(id ? [] : [{ name: 'eq', label: 'Équipement', type: 'select', options: opts.equipment.filter(([e]) => !(e in DIMS)) }]),
          { name: 't', label: 'Où', type: 'select', options: [['l', 'À l’arrière (ajoute à la longueur)'], ['h', 'Au-dessus du toit (ajoute à la hauteur)']] },
          { name: 'v', label: 'Dépasse de (cm)', type: 'number', required: true },
        ],
        onSubmit: async (d) => {
          const key = id || d.eq;
          const n = (DIMS[key]?.n || eqName[key] || key).toLowerCase();
          await saveConfig({ DIMS: { ...DIMS, [key]: { t: d.t, v: Math.max(0, Math.min(300, Math.round(Number(d.v) || 0))), n } } }, 'Dépassement enregistré');
        },
      });
    const variantOptions = [['', 'Peu importe']];
    for (const [k, V] of Object.entries(config.VARIANTS || {})) for (const o of V.o) if (o[0] !== 'ns') variantOptions.push([`${k}=${o[0]}`, `${V.q} : ${o[1]}`]);
    const listForm = (key) => {
      const L = key ? lists[key] : {};
      openForm({
        title: key ? `Onglet « ${listTitle(key)} »` : 'Nouvelle liste',
        values: { title: key ? listTitle(key) : '', goal: L.goal || '', note: L.note || '' },
        fields: [
          { name: 'title', label: 'Nom de l’onglet (court)', required: true, hint: 'Ex. : Hivernage, Chaque mois.' },
          { name: 'goal', label: 'Le but (affiché en haut de la liste)', type: 'textarea', rows: 2 },
          { name: 'note', label: 'Note sous la liste', full: true },
        ],
        onSubmit: async (d) => {
          let k = key;
          if (!k) {
            k = slug(d.title).replace(/-/g, '') || 'liste';
            for (let n = 2; lists[k]; n++) k = `${slug(d.title).replace(/-/g, '')}${n}`;
          }
          await saveLists({ ...lists, [k]: { ...(lists[k] || { items: [] }), title: d.title, goal: d.goal, note: d.note } });
        },
      });
    };
    const lineForm = (key, n) => {
      const it = n === undefined ? '' : lists[key].items[n];
      const o = typeof it === 'string' ? { t: it } : it;
      openForm({
        title: n === undefined ? `Nouvelle ligne : ${listTitle(key)}` : `Ligne ${n + 1} : ${listTitle(key)}`,
        values: { t: o.t || '', eq: o.eq || [], group: o.group || '', variant: o.variant ? o.variant.join('=') : '' },
        fields: [
          { name: 't', label: 'Ligne', type: 'textarea', rows: 3, required: true, hint: 'Le début jusqu’aux deux-points s’affiche en gras. Ex. : « Je vide toute l’eau : je vide la cuve… »' },
          { name: 'eq', label: 'Seulement si le client a AU MOINS UN de ces équipements (rien coché : tous)', type: 'checks', filter: 'Chercher un équipement (ex. : batterie)', options: opts.equipment },
          { name: 'group', label: 'Groupe (facultatif)', hint: 'Ex. « batterie » sur les lignes « batterie classique » et « batterie lithium » : si le client n’a coché aucun des deux équipements, il voit les deux lignes.' },
          { name: 'variant', label: 'Seulement si (type d’équipement)', type: 'select', options: variantOptions, hint: 'Si le client a répondu autre chose, la ligne est cachée ; s’il ne sait pas, elle est affichée.' },
        ],
        onSubmit: async (d) => {
          const line = d.eq.length || d.variant ? { t: d.t.trim() } : d.t.trim();
          if (typeof line === 'object') {
            if (d.eq.length) line.eq = d.eq;
            if (d.eq.length && d.group.trim()) line.group = d.group.trim().toLowerCase();
            if (d.variant) line.variant = d.variant.split('=');
          }
          const items = lists[key].items.slice();
          if (n === undefined) items.push(line);
          else items[n] = line;
          await saveLists({ ...lists, [key]: { ...lists[key], items } });
        },
      });
    };
    const without = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

    // data-id is a number for the lists, an equipment id for the weights and sizes: read it as text here.
    el.onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const a = b.dataset.act;
      const raw = b.dataset.id;
      const i = raw === undefined ? undefined : Number(raw);
      const key = b.dataset.key;
      const handlers = {
        'list-add': () => listForm(),
        'list-edit': () => listForm(key),
        'list-del': () =>
          confirmDelete(`Supprimer toute la liste « ${listTitle(key)} » (${lists[key].items.length} lignes) de l’appli ?`, () => saveLists(without(lists, key), 'Liste supprimée')),
        'line-add': () => lineForm(key),
        'line-edit': () => lineForm(key, i),
        'line-del': () =>
          confirmDelete(`Supprimer la ligne « ${itemText(lists[key].items[i]).slice(0, 80)} » ?`, () => saveLists({ ...lists, [key]: { ...lists[key], items: lists[key].items.filter((_, n) => n !== i) } }, 'Ligne supprimée')),
        'line-up': () => {
          const items = lists[key].items.slice();
          [items[i - 1], items[i]] = [items[i], items[i - 1]];
          saveLists({ ...lists, [key]: { ...lists[key], items } }, 'Ordre enregistré');
        },
        'kind-add': () => kindForm(),
        kind: () => kindForm(i),
        'kind-del': () =>
          confirmDelete(`Supprimer l’entretien « ${ent.kinds[i].label} » ? Ce que les clients ont déjà noté reste dans leur carnet.`, () => saveEnt({ ...ent, kinds: ent.kinds.filter((_, n) => n !== i) }, 'Entretien supprimé')),
        'tip-add': () => tipForm(),
        tip: () => tipForm(i),
        'tip-del': () => confirmDelete(`Supprimer « ${ent.tips[i].label} » ?`, () => saveEnt({ ...ent, tips: ent.tips.filter((_, n) => n !== i) }, 'Contrôle supprimé')),
        'motif-add': () => motifForm(),
        motif: () => motifForm(i),
        'motif-del': () => {
          const used = ent.kinds.filter((k) => k.rdv === motifs[i].id).map((k) => k.label);
          confirmDelete(`Supprimer le motif « ${motifs[i].t} » ?${used.length ? `\nIl est utilisé par : ${used.join(', ')} (leur bouton « Prendre rendez-vous » ouvrira « Autre souci »).` : ''}`, () => saveMotifs(motifs.filter((_, n) => n !== i)));
        },
        'carry-add': () => carryForm(),
        carry: () => carryForm(i),
        'carry-del': () => confirmDelete(`Retirer « ${carry[i].n} » ?`, () => saveCarry(carry.filter((_, n) => n !== i))),
        'wt-add': () => wtForm(),
        wt: () => wtForm(raw),
        'wt-del': () => confirmDelete(`Retirer le poids de « ${eqName[raw] || raw} » ?`, () => saveConfig({ WT: without(WT, raw) }, 'Poids retiré')),
        'dim-add': () => dimForm(),
        dim: () => dimForm(raw),
        'dim-del': () => confirmDelete(`Retirer le dépassement de « ${eqName[raw] || raw} » ?`, () => saveConfig({ DIMS: without(DIMS, raw) }, 'Dépassement retiré')),
        config: async () =>
          openForm({
            title: 'Réglages avancés (JSON)',
            fields: [{ name: 'json', label: 'IMPL : équipements compris d’office · VARIANTS : types · PLATE : où trouver la plaque · WT et DIMS : modifiables plus haut', type: 'textarea', rows: 24, full: true }],
            values: { json: JSON.stringify(config, null, 1) },
            onSubmit: async ({ json }) => {
              let value;
              try {
                value = JSON.parse(json);
              } catch {
                throw new Error('JSON invalide : vérifiez les virgules et les guillemets');
              }
              await api('PUT', '/api/admin/catalog/config', { value });
              toast('Réglages enregistrés');
              reload();
            },
          }),
      };
      if (handlers[a]) handlers[a]();
    };
    void bind;
  };
}
