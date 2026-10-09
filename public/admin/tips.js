// « Conseils & Astuces »: the tips shown in the app (written here, or shared by customers and published once read), and
// the « À la une » banner of the app's home screen. Administrator and content editor only.

import { esc, multiline, formatDate, toast } from '/shared/common.js';

export function registerTipsView(VIEWS, { api, openForm, pageHeader, bind, confirmDelete, refreshTipsBadge }) {
  VIEWS.tips = async (el) => {
    const d = await api('GET', '/api/admin/tips');
    const catName = Object.fromEntries(d.categories);
    const screenName = Object.fromEntries(d.screens);
    const pending = d.tips.filter((t) => t.status === 'pending');
    const published = d.tips.filter((t) => t.status === 'published');
    const f = d.featured;
    const featuredText = !f
      ? '<p class="muted">Aucun bandeau : l’accueil de l’appli n’en affiche pas.</p>'
      : `<div class="feat-preview"><span class="feat-ic">${esc(f.icon)}</span><div><small>À LA UNE</small><strong>${esc(f.title)}</strong>${f.subtitle ? `<span>${esc(f.subtitle)}</span>` : ''}</div></div>
         <p class="muted">Au toucher : ${
           f.action === 'tip'
             ? `ouvre l’astuce « ${esc(published.find((t) => t.id === f.tipId)?.title || '?')} »`
             : f.action === 'screen'
               ? `ouvre la page « ${esc(screenName[f.screen] || f.screen)} »`
               : f.action === 'link'
                 ? `ouvre le site ${esc(f.url)}`
                 : 'affiche l’annonce'
         }</p>`;

    const card = (t) => `<div class="card tip-row">
        <div class="tip-main">
          ${t.imageUrl ? `<img class="tip-thumb" src="${esc(t.imageUrl)}" alt="">` : t.videoUrl ? '<span class="tip-thumb tip-vid">▶</span>' : ''}
          <div>
            <span class="status">${esc(catName[t.category] || t.category)}</span>
            ${t.customer ? `<span class="status piece">Astuce de client</span>` : ''}
            <h3>${esc(t.title)}</h3>
            <p>${multiline(t.body)}</p>
            ${t.storeTip ? `<p class="tip-store">🛒 <strong>Le conseil du magasin :</strong> ${esc(t.storeTip)}</p>` : ''}
            <p class="muted">${t.customer ? `Envoyée par ${esc(t.customer.name)} (${esc(t.customer.dealership)}) le ${formatDate(t.createdAt)}. Seul le prénom est affiché dans l’appli.` : t.publishedAt ? `Publiée le ${formatDate(t.publishedAt)}` : ''}</p>
          </div>
        </div>
        <div class="row-actions">
          ${t.status === 'pending' ? `<button class="btn small primary" data-act="publish" data-id="${t.id}">✓ Publier</button>` : ''}
          <button class="btn small" data-act="edit" data-id="${t.id}">${t.status === 'pending' ? 'Corriger puis publier' : 'Modifier'}</button>
          <button class="btn small danger" data-act="del" data-id="${t.id}">${t.status === 'pending' ? 'Refuser' : 'Supprimer'}</button>
        </div>
      </div>`;

    el.innerHTML = `${pageHeader('Conseils & Astuces', '<button class="btn primary" data-act="add">+ Nouvelle astuce</button>')}
      <div class="card">
        <h2>Bandeau « À la une » (accueil de l’appli)</h2>
        ${featuredText}
        <div class="row-actions"><button class="btn" data-act="featured">Modifier le bandeau</button>${f ? '<button class="btn danger" data-act="nofeatured">Retirer le bandeau</button>' : ''}</div>
      </div>
      <h2 class="section-title">À valider (${pending.length})</h2>
      ${pending.length ? pending.map(card).join('') : '<p class="muted">Aucune astuce de client en attente.</p>'}
      <h2 class="section-title">Publiées dans l’appli (${published.length})</h2>
      ${published.map(card).join('')}`;

    const fields = (t) => [
      { name: 'title', label: 'Titre', required: true },
      { name: 'category', label: 'Thème', type: 'select', options: d.categories },
      { name: 'body', label: 'Texte de l’astuce (court et simple)', type: 'textarea', rows: 6, required: true },
      { name: 'image', label: 'Photo', type: 'image' },
      { name: 'videoUrl', label: 'Vidéo (lien YouTube ou Vimeo, facultatif)', hint: 'La vidéo reste chez YouTube ou Vimeo : elle s’affiche dans l’appli sans être copiée sur notre serveur.' },
      {
        name: 'storeTip',
        label: 'Le conseil du magasin (facultatif)',
        type: 'textarea',
        rows: 2,
        hint: 'Un produit spécialisé vendu en magasin d’accessoires de camping-car. Jamais de remède maison, pas de référence.',
      },
      { name: 'sort', label: 'Mettre en avant (plus le nombre est grand, plus l’astuce est haute)', type: 'number' },
      ...(t?.status === 'pending' ? [{ name: 'publish', label: 'Publier dans l’appli en enregistrant', type: 'checkbox' }] : []),
    ];
    const reload = () => {
      refreshTipsBadge();
      return VIEWS.tips(el);
    };

    bind(el, {
      add: () =>
        openForm({
          title: 'Nouvelle astuce',
          fields: fields(),
          values: { category: 'entretien', sort: 0 },
          submitLabel: 'Publier',
          onSubmit: async (data) => {
            await api('POST', '/api/admin/tips', data);
            toast('Astuce publiée : visible dans les applications');
            reload();
          },
        }),
      edit: (id) => {
        const t = d.tips.find((x) => x.id === id);
        openForm({
          title: t.status === 'pending' ? 'Corriger l’astuce du client' : 'Modifier l’astuce',
          fields: fields(t),
          values: { ...t, image: t.imageUrl, videoUrl: t.videoUrl || '', storeTip: t.storeTip || '', publish: t.status === 'pending' },
          onSubmit: async (data) => {
            await api('PUT', `/api/admin/tips/${id}`, data);
            toast(data.publish || t.status === 'published' ? 'Astuce enregistrée : visible dans les applications' : 'Astuce enregistrée, pas encore publiée');
            reload();
          },
        });
      },
      publish: async (id) => {
        await api('PUT', `/api/admin/tips/${id}`, { publish: true });
        toast('Astuce publiée : visible dans les applications');
        reload();
      },
      del: (id) => {
        const t = d.tips.find((x) => x.id === id);
        confirmDelete(t.status === 'pending' ? `Refuser et supprimer l’astuce « ${t.title} » ?` : `Supprimer l’astuce « ${t.title} » des applications ?`, async () => {
          await api('DELETE', `/api/admin/tips/${id}`);
          toast(t.status === 'pending' ? 'Astuce refusée' : 'Astuce supprimée');
          reload();
        });
      },
      featured: () => {
        const others = (keep) => ['tip', 'screen', 'link', 'popup'].filter((a) => a !== keep);
        openForm({
          title: 'Bandeau « À la une »',
          fields: [
            { name: 'title', label: 'Titre', required: true, hint: 'Court : 3 à 5 mots (ex. : Avant l’hiver).' },
            { name: 'subtitle', label: 'Sous-titre', hint: 'Une phrase (ex. : Protégez votre circuit d’eau du gel).' },
            { name: 'icon', label: 'Icône', type: 'select', options: d.icons.map((i) => [i, i]) },
            {
              name: 'action',
              label: 'Au toucher',
              type: 'select',
              options: [
                ['tip', 'Ouvrir une astuce'],
                ['screen', 'Ouvrir une page de l’appli'],
                ['link', 'Ouvrir un site internet'],
                ['popup', 'Afficher une annonce'],
              ],
            },
            { name: 'tipId', label: 'Astuce', type: 'select', options: published.map((t) => [t.id, t.title]), hideIf: ['action', others('tip')] },
            { name: 'screen', label: 'Page de l’appli', type: 'select', options: d.screens, hideIf: ['action', others('screen')] },
            { name: 'url', label: 'Adresse du site (https://…)', hideIf: ['action', others('link')] },
            { name: 'text', label: 'Texte de l’annonce', type: 'textarea', rows: 5, hideIf: ['action', others('popup')], hint: 'Ex. : portes ouvertes, nouveauté au magasin, horaires d’été.' },
          ],
          values: { icon: '💡', action: 'tip', ...(f || {}) },
          onSubmit: async (data) => {
            await api('PUT', '/api/admin/featured', data);
            toast('Bandeau enregistré : visible dans les applications');
            reload();
          },
        });
      },
      nofeatured: () =>
        confirmDelete('Retirer le bandeau « À la une » de l’accueil des applications ?', async () => {
          await api('PUT', '/api/admin/featured', { remove: true });
          toast('Bandeau retiré');
          reload();
        }),
    });
  };
}
