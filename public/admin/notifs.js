// « Notifications »: messages pushed to the customers' phones (administrator only for now). Who: the same targeting as
// the « À la une » banners. What: a theme (open day, workshop, offer, maintenance, winter…), a short text, and what
// opens when it is touched. When: now or later. Then how many received and opened it.

import { esc, formatDate, toast } from '/shared/common.js';

export function registerNotifsView(VIEWS, { api, openForm, pageHeader, bind, confirmDelete }) {
  VIEWS.notifs = async (el) => {
    const d = await api('GET', '/api/admin/notifs');
    const name = (list) => Object.fromEntries(list.map((x) => (Array.isArray(x) ? [x[0], x[1]] : [x.id, x.name])));
    const dealerName = name(d.dealerships);
    const typeName = name(d.vehicleTypes);
    const ageName = name(d.ages);
    const warrantyName = name(d.warranties);
    const eqName = name(d.equipment);
    const screenName = name(d.screens);
    const tipName = Object.fromEntries(d.tips.map((t) => [t.id, t.title]));
    const kindOf = Object.fromEntries(d.kinds.map((k) => [k.id, k]));
    const when = (iso) => {
      const t = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
      return `${formatDate(t.toISOString().slice(0, 10))} à ${t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    };
    const who = (t) => {
      const parts = [];
      parts.push(!t.dealershipIds?.length ? 'Toutes les concessions' : t.dealershipIds.map((id) => dealerName[id] || '?').join(', '));
      if (t.vehicleTypes?.length) parts.push(t.vehicleTypes.map((x) => typeName[x] || x).join(', '));
      if (t.age) parts.push(ageName[t.age]);
      if (t.warranty) parts.push(warrantyName[t.warranty]);
      if (t.equipmentAny?.length) parts.push(`avec ${t.equipmentAny.map((id) => eqName[id] || id).join(' ou ')}`);
      if (t.equipmentNone?.length) parts.push(`sans ${t.equipmentNone.map((id) => eqName[id] || id).join(' ni ')}`);
      if (t.optinOnly) parts.push('ayant accepté les offres');
      return parts.join(' · ');
    };
    const does = (c) =>
      c.action === 'tip' ? `ouvre l’astuce « ${esc(tipName[c.tipId] || '?')} »` : c.action === 'screen' ? `ouvre « ${esc(screenName[c.screen] || c.screen)} »` : c.action === 'link' ? `ouvre ${esc(c.url)}` : c.action === 'home' ? 'ouvre l’accueil de l’appli' : 'affiche le message complet';
    const pct = (a, b) => (b ? ` (${Math.round((a / b) * 100)} %)` : '');
    const card = (c) => `<div class="card banner-row">
        <div class="notif-preview"><span class="notif-app">🔔 Compagnon de bord</span><strong>${esc(c.icon)} ${esc(c.title)}</strong><span>${esc(c.body)}</span></div>
        <div class="banner-info">
          <p>${c.status === 'scheduled' ? `<span class="status">Programmée le ${when(c.sendAt)}</span>` : c.status === 'sending' ? '<span class="status">Envoi en cours…</span>' : `<span class="status resolu">Envoyée le ${when(c.sentAt)}</span>`} <span class="status">${esc(kindOf[c.kind]?.name || '')}</span></p>
          <p><strong>Pour :</strong> ${esc(who(c.target))}</p>
          <p class="muted">${
            c.status === 'sent'
              ? `${c.targeted} client(s) ciblé(s) · <b>${c.delivered}</b> l’ont reçue sur leur téléphone · <b>${c.opened}</b> l’ont ouverte${pct(c.opened, c.delivered)}`
              : `${c.targeted} client(s) ciblé(s) aujourd’hui, dont ${c.reachable} avec les notifications activées`
          } · au toucher, ${does(c)}</p>
        </div>
        <div class="row-actions">${c.status === 'scheduled' ? `<button class="btn small danger" data-act="cancel" data-id="${c.id}">Annuler l’envoi</button>` : c.status === 'sent' ? `<button class="btn small" data-act="again" data-id="${c.id}">Réutiliser</button><button class="btn small danger" data-act="del" data-id="${c.id}">Retirer de la liste</button>` : ''}</div>
      </div>`;
    const planned = d.campaigns.filter((c) => c.status !== 'sent');
    const sent = d.campaigns.filter((c) => c.status === 'sent');

    const phones = Object.entries(d.phones || {}).map(([k, n]) => `${n} ${esc(k)}`).join(' · ');
    const errWhy = (e) => (e.status === 403 || e.status === 401 ? 'clé refusée par le service' : e.status === 400 ? 'message refusé' : e.status === 413 ? 'message trop long' : e.status === 0 ? `pas de connexion au service (${esc(e.error || '')})` : `code ${e.status}`);
    const lastErr = d.pushLastError && (!d.pushLastOk || d.pushLastError.at > d.pushLastOk.at) ? d.pushLastError : null;
    const phonesLine = `<p class="muted">Téléphones inscrits : ${phones || 'aucun'}.${
      lastErr ? ` <b>Dernier envoi en échec</b> le ${when(lastErr.at)} (${esc(lastErr.host)} : ${errWhy(lastErr)}).` : d.pushLastOk ? ` Dernier envoi réussi le ${when(d.pushLastOk.at)}.` : ''
    }</p>`;
    const testPush = () =>
      openForm({
        title: '🔔 Essayer sur un téléphone',
        submitLabel: 'Envoyer l’essai',
        fields: [{ name: 'email', label: 'E-mail du client (le vôtre si vous avez un compte client)', type: 'email', required: true, full: true, hint: 'Le client doit avoir ouvert l’appli et touché « Activer » sur son téléphone.' }],
        onSubmit: async (data) => {
          const r = await api('POST', '/api/admin/notifs/test', data);
          if (!r.results.length) throw new Error('Ce client n’a aucun téléphone inscrit : il doit ouvrir l’appli et toucher « Activer sur ce téléphone ».');
          const lines = r.results.map((x) => `${x.phone} : ${x.ok ? 'envoyée ✔' : x.status === 404 || x.status === 410 ? 'inscription périmée (rouvrir l’appli)' : `échec, ${errWhy(x)}`}`);
          alert(`Résultat de l’essai :\n\n${lines.join('\n')}\n\nSi c’est « envoyée » mais que rien n’apparaît, vérifiez que les notifications de l’appli sont autorisées dans les réglages du téléphone.`);
          VIEWS.notifs(el);
        },
      });

    el.innerHTML = `${pageHeader('Notifications', '<button class="btn" data-act="test">Essayer sur un téléphone</button> <button class="btn primary" data-act="add">+ Nouvelle notification</button>')}
      <div class="card"><p><strong>${d.subscribers}</strong> client(s) sur ${d.customers} ont accepté les notifications sur leur téléphone. Les autres ne les reçoivent pas (ils voient toujours le bandeau « À la une »).</p>
      ${phonesLine}
      <p class="muted">Conseil : une notification par semaine au plus, sinon les clients les coupent. Les offres et portes ouvertes ne partent qu’aux clients qui ont accepté les conseils et offres. Les rappels d’entretien et des listes (hivernage, chaque mois…) partent déjà tout seuls.</p></div>
      ${planned.length ? `<h2 class="section-title">Programmées (${planned.length})</h2>${planned.map(card).join('')}` : ''}
      <h2 class="section-title">Envoyées (${sent.length})</h2>
      ${sent.length ? sent.map(card).join('') : '<p class="muted">Aucune notification envoyée pour l’instant.</p>'}`;

    const others = (keep) => ['popup', 'screen', 'tip', 'link', 'home'].filter((a) => a !== keep);
    const fields = (kind) => [
      { name: 'title', label: 'Titre (gras sur le téléphone)', required: true, attrs: 'maxlength="60"', hint: 'Court : 3 à 6 mots.' },
      { name: 'body', label: 'Message (une ou deux phrases)', type: 'textarea', rows: 3, required: true, hint: '180 caractères au plus : le téléphone coupe la suite.' },
      {
        name: 'action',
        label: 'Quand le client touche la notification',
        type: 'select',
        options: [
          ['popup', 'Afficher le message complet'],
          ['screen', 'Ouvrir une page de l’appli'],
          ['tip', 'Ouvrir une astuce'],
          ['link', 'Ouvrir un site internet (inscription, catalogue…)'],
          ['home', 'Ouvrir l’accueil (pour le nouveau « À la une »)'],
        ],
      },
      { name: 'text', label: 'Message complet (dans l’appli)', type: 'textarea', rows: 5, hideIf: ['action', others('popup')], hint: 'Date, horaires, adresse, programme, conditions de l’offre…' },
      { name: 'screen', label: 'Page de l’appli', type: 'select', options: d.screens, hideIf: ['action', others('screen')] },
      { name: 'tipId', label: 'Astuce', type: 'select', options: d.tips.map((t) => [t.id, t.title]), hideIf: ['action', others('tip')] },
      { name: 'url', label: 'Adresse du site (https://…)', hideIf: ['action', others('link')] },
      { name: 'dealershipIds', label: 'Concessions (aucune cochée : toutes)', type: 'checks', options: d.dealerships.map((x) => [x.id, x.name]) },
      { name: 'vehicleTypes', label: 'Types de véhicule (aucun coché : tous)', type: 'checks', options: d.vehicleTypes },
      { name: 'age', label: 'Ancienneté du véhicule (depuis la mise en main)', type: 'select', options: d.ages },
      { name: 'warranty', label: 'Garantie', type: 'select', options: d.warranties },
      { name: 'equipmentNone', label: 'Clients qui n’ont AUCUN de ces équipements', type: 'checks', filter: 'Chercher un équipement (ex. : clim)', options: d.equipment },
      { name: 'equipmentAny', label: 'Clients qui ont AU MOINS UN de ces équipements', type: 'checks', filter: 'Chercher un équipement (ex. : solaire)', options: d.equipment },
      kindOf[kind]?.commercial
        ? { name: 'optinOnly', label: 'Seulement les clients qui ont accepté les conseils et offres (obligatoire pour ce thème)', type: 'checkbox' }
        : { name: 'optinOnly', label: 'Seulement les clients qui ont accepté les conseils et offres', type: 'checkbox' },
      { name: 'when', label: 'Envoi', type: 'select', options: [['now', 'Tout de suite'], ['later', 'À une date et une heure']] },
      { name: 'sendAt', label: 'Date et heure d’envoi', type: 'datetime-local', hideIf: ['when', ['now']], hint: 'Évitez avant 9 h et après 20 h.' },
    ];
    const compose = (kind, values = {}) => {
      const k = kindOf[kind];
      openForm({
        title: `${k.icon} Notification : ${k.name}`,
        submitLabel: 'Vérifier et envoyer',
        fields: fields(kind),
        values: { title: k.title, body: k.body, action: k.action, screen: k.screen || 'tips', optinOnly: !!k.commercial, when: 'now', ...values },
        onSubmit: async (data) => {
          const body = { ...data, kind, sendAt: data.when === 'later' && data.sendAt ? new Date(data.sendAt).toISOString() : null };
          if (data.when === 'later' && !data.sendAt) throw new Error('Choisissez la date et l’heure d’envoi');
          const a = await api('POST', '/api/admin/notifs/audience', body);
          if (!a.targeted) throw new Error('Aucun client ne correspond à ce ciblage');
          const msg = `${body.sendAt ? `Programmer pour le ${when(body.sendAt)}` : 'Envoyer maintenant'} « ${data.title} » ?\n\n${a.targeted} client(s) ciblé(s), dont ${a.reachable} avec les notifications activées sur leur téléphone.`;
          if (!confirm(msg)) throw new Error('Envoi annulé : rien n’est parti.');
          await api('POST', '/api/admin/notifs', body);
          toast(body.sendAt ? 'Notification programmée' : 'Notification envoyée');
          VIEWS.notifs(el);
        },
      });
    };
    const pickKind = () => {
      const dialog = document.createElement('dialog');
      dialog.innerHTML = `<div class="dialog-form"><header><h2>Quel type de notification ?</h2><button type="button" class="icon" data-close aria-label="Fermer">✕</button></header>
        <div class="kind-grid">${d.kinds.map((k) => `<button type="button" class="kind-btn" data-kind="${esc(k.id)}"><span>${esc(k.icon)}</span>${esc(k.name)}${k.commercial ? '<small>clients ayant accepté les offres</small>' : ''}</button>`).join('')}</div></div>`;
      document.body.appendChild(dialog);
      dialog.addEventListener('click', (e) => {
        const b = e.target.closest('[data-kind]');
        if (b) {
          dialog.close();
          compose(b.dataset.kind);
        } else if (e.target.closest('[data-close]') || e.target === dialog) dialog.close();
      });
      dialog.addEventListener('close', () => dialog.remove());
      dialog.showModal();
    };

    bind(el, {
      add: pickKind,
      test: testPush,
      again: (id) => {
        const c = d.campaigns.find((x) => x.id === id);
        compose(c.kind, { title: c.title, body: c.body, action: c.action, text: c.text, screen: c.screen, tipId: c.tipId, url: c.url, ...c.target });
      },
      cancel: (id) =>
        confirmDelete('Annuler cet envoi programmé ?', async () => {
          await api('DELETE', `/api/admin/notifs/${id}`);
          toast('Envoi annulé');
          VIEWS.notifs(el);
        }),
      del: (id) =>
        confirmDelete('Retirer cette notification de la liste ? (Elle a déjà été envoyée.)', async () => {
          await api('DELETE', `/api/admin/notifs/${id}`);
          VIEWS.notifs(el);
        }),
    });
  };
}
