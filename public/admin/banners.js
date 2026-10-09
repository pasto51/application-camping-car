// « À la une »: the banners of the app's home screen, each for its own customers. Administrator and content editor:
// for any customers; dealership manager: for their own dealership (open days, store news…).

import { esc, formatDate, toast } from '/shared/common.js';

export function registerBannersView(VIEWS, { api, openForm, pageHeader, bind, confirmDelete }) {
  VIEWS.banners = async (el) => {
    const d = await api('GET', '/api/admin/banners');
    const name = (list) => Object.fromEntries(list.map((x) => (Array.isArray(x) ? [x[0], x[1]] : [x.id, x.name])));
    const dealerName = name(d.dealerships);
    const typeName = name(d.vehicleTypes);
    const ageName = name(d.ages);
    const warrantyName = name(d.warranties);
    const eqName = name(d.equipment);
    const screenName = name(d.screens);
    const tipName = Object.fromEntries(d.tips.map((t) => [t.id, t.title]));
    const today = new Date().toISOString().slice(0, 10);

    const who = (b) => {
      const parts = [];
      const known = b.dealershipIds.filter((id) => dealerName[id]).map((id) => dealerName[id]);
      const more = b.dealershipIds.length - known.length;
      parts.push(!b.dealershipIds.length ? 'Toutes les concessions' : [...known, ...(more ? [known.length ? 'et d’autres concessions' : `${more} concession(s)`] : [])].join(', ').replace(', et', ' et'));
      if (b.vehicleTypes.length) parts.push(b.vehicleTypes.map((t) => typeName[t] || t).join(', '));
      if (b.age) parts.push(ageName[b.age]);
      if (b.warranty) parts.push(warrantyName[b.warranty]);
      const eqs = (ids) => ids.map((id) => eqName[id] || id).join(' ou ');
      if (b.equipmentAny.length) parts.push(`avec ${eqs(b.equipmentAny)}`);
      if (b.equipmentNone.length) parts.push(`sans ${eqs(b.equipmentNone)}`);
      if (b.optinOnly) parts.push('ayant accepté les offres');
      return parts.join(' · ');
    };
    const when = (b) =>
      b.startsOn && b.startsOn > today
        ? `<span class="status">Programmé à partir du ${formatDate(b.startsOn)}</span>`
        : b.endsOn && b.endsOn < today
          ? `<span class="status">Terminé le ${formatDate(b.endsOn)}</span>`
          : `<span class="status resolu">En ligne${b.endsOn ? ` jusqu’au ${formatDate(b.endsOn)}` : ''}</span>`;
    const does = (b) =>
      b.action === 'tip'
        ? `ouvre l’astuce « ${esc(tipName[b.tipId] || '?')} »`
        : b.action === 'screen'
          ? `ouvre la page « ${esc(screenName[b.screen] || b.screen)} »`
          : b.action === 'link'
            ? `ouvre ${esc(b.url)}`
            : 'affiche une annonce';

    el.innerHTML = `${pageHeader('À la une', '<button class="btn primary" data-act="add">+ Nouveau bandeau</button>')}
      <div class="card"><p class="muted">Le bandeau s’affiche en haut de l’accueil de l’application. Chaque client voit <strong>un seul</strong> bandeau :
      celui qui le concerne avec la <strong>priorité</strong> la plus haute (à égalité, le plus récent).${d.global ? '' : ' Vous pouvez créer des bandeaux pour les clients de votre concession ; ceux de l’administrateur sont affichés pour information.'}</p></div>
      ${
        d.banners.length
          ? d.banners
              .map(
                (b) => `<div class="card banner-row">
          <div class="feat-preview"><span class="feat-ic">${esc(b.icon)}</span><div><small>À LA UNE</small><strong>${esc(b.title)}</strong>${b.subtitle ? `<span>${esc(b.subtitle)}</span>` : ''}</div></div>
          <div class="banner-info">
            <p>${when(b)} <span class="status">Priorité ${b.priority}</span></p>
            <p><strong>Pour :</strong> ${esc(who(b))}</p>
            <p class="muted">${b.reach} client(s) concerné(s) aujourd’hui · au toucher, ${does(b)}</p>
          </div>
          <div class="row-actions">${b.editable ? `<button class="btn small" data-act="edit" data-id="${b.id}">Modifier</button><button class="btn small danger" data-act="del" data-id="${b.id}">Supprimer</button>` : '<small class="muted">Géré par l’administrateur</small>'}</div>
        </div>`
              )
              .join('')
          : '<p class="muted">Aucun bandeau : l’accueil de l’application n’en affiche pas.</p>'
      }`;

    const others = (keep) => ['tip', 'screen', 'link', 'popup'].filter((a) => a !== keep);
    const fields = [
      { name: 'title', label: 'Titre', required: true, hint: 'Court : 3 à 5 mots (ex. : Portes ouvertes samedi).' },
      { name: 'subtitle', label: 'Sous-titre', hint: 'Une phrase (ex. : -15 % sur les accessoires, café offert).' },
      { name: 'icon', label: 'Icône', type: 'select', options: d.icons.map((i) => [i, i]) },
      {
        name: 'action',
        label: 'Au toucher',
        type: 'select',
        options: [
          ['popup', 'Afficher une annonce'],
          ['tip', 'Ouvrir une astuce'],
          ['screen', 'Ouvrir une page de l’appli'],
          ['link', 'Ouvrir un site internet'],
        ],
      },
      { name: 'text', label: 'Texte de l’annonce', type: 'textarea', rows: 4, hideIf: ['action', others('popup')], hint: 'Date, horaires, ce qui est proposé.' },
      { name: 'tipId', label: 'Astuce', type: 'select', options: d.tips.map((t) => [t.id, t.title]), hideIf: ['action', others('tip')] },
      { name: 'screen', label: 'Page de l’appli', type: 'select', options: d.screens, hideIf: ['action', others('screen')] },
      { name: 'url', label: 'Adresse du site (https://…)', hideIf: ['action', others('link')] },
      ...(d.global ? [{ name: 'dealershipIds', label: 'Concessions (aucune cochée : toutes)', type: 'checks', options: d.dealerships.map((x) => [x.id, x.name]) }] : []),
      { name: 'vehicleTypes', label: 'Types de véhicule (aucun coché : tous)', type: 'checks', options: d.vehicleTypes },
      { name: 'age', label: 'Ancienneté du véhicule (depuis la mise en main)', type: 'select', options: d.ages },
      { name: 'warranty', label: 'Garantie', type: 'select', options: d.warranties },
      {
        name: 'equipmentNone',
        label: 'Clients qui n’ont AUCUN de ces équipements (pour le leur proposer)',
        type: 'checks',
        filter: 'Chercher un équipement (ex. : clim)',
        options: d.equipment,
        hint: 'Ex. opération clim : cochez toutes les climatisations, seuls les clients sans clim verront le bandeau.',
      },
      { name: 'equipmentAny', label: 'Clients qui ont AU MOINS UN de ces équipements', type: 'checks', filter: 'Chercher un équipement (ex. : solaire)', options: d.equipment, hint: 'Ex. : les clients équipés d’un panneau solaire.' },
      { name: 'optinOnly', label: 'Seulement les clients qui ont accepté les conseils et offres (conseillé pour une offre commerciale)', type: 'checkbox' },
      { name: 'startsOn', label: 'Début (vide : tout de suite)', type: 'date' },
      { name: 'endsOn', label: 'Fin (vide : sans fin)', type: 'date', hint: 'Le bandeau disparaît tout seul après cette date.' },
      { name: 'priority', label: 'Priorité (0 à 99)', type: 'number', hint: 'Si plusieurs bandeaux concernent un client, le plus prioritaire s’affiche.' },
    ];
    const save = (id) => async (data) => {
      await api(id ? 'PUT' : 'POST', id ? `/api/admin/banners/${id}` : '/api/admin/banners', data);
      toast('Bandeau enregistré : visible dans les applications concernées');
      VIEWS.banners(el);
    };

    bind(el, {
      add: () =>
        openForm({
          title: 'Nouveau bandeau « À la une »',
          fields,
          values: { icon: '📣', action: 'popup', priority: d.global ? 0 : 10 },
          onSubmit: save(),
        }),
      edit: (id) => {
        const b = d.banners.find((x) => x.id === id);
        openForm({ title: 'Modifier le bandeau', fields, values: { ...b }, onSubmit: save(id) });
      },
      del: (id) => {
        const b = d.banners.find((x) => x.id === id);
        confirmDelete(`Supprimer le bandeau « ${b.title} » ?`, async () => {
          await api('DELETE', `/api/admin/banners/${id}`);
          toast('Bandeau supprimé');
          VIEWS.banners(el);
        });
      },
    });
  };
}
