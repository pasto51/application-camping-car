// « Signaler un bug » (every role, bottom of the menu) and « Prendre en main » (the presentation video of the
// back-office); the list of the bugs reported from the app and the back-office, for the administrator.

import { esc, multiline, formatDate, toast } from '/shared/common.js';

// YouTube and Vimeo play inside a window; any other link opens in a new tab.
export function videoEmbedUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') id = u.pathname === '/watch' ? u.searchParams.get('v') : (u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) || [])[1];
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/(\d{6,12})/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return null;
}

export function registerHelp(VIEWS, { api, openForm, pageHeader, confirmDelete, state, isAdmin, sectionLabel }) {
  const version = () => (state.user?.appVersion || '').slice(0, 6);

  function openBugForm() {
    openForm({
      title: 'Signaler un bug',
      submitLabel: 'Envoyer',
      fields: [
        { name: 'message', label: 'Que s’est-il passé ? Ce que vous faisiez, ce que vous avez vu (un message d’erreur, un bouton qui ne marche pas…)', type: 'textarea', rows: 6, required: true },
      ],
      extra: '<p class="muted" style="margin:0 1rem">L’écran où vous êtes, votre compte et votre navigateur sont joints au message.</p>',
      onSubmit: async (d) => {
        await api('POST', '/api/admin/bugs', { message: d.message, page: sectionLabel(state.section), version: version() });
        toast('Merci, le bug est signalé à l’administrateur.');
        refreshBugsBadge();
      },
    });
  }

  async function openHelpVideo() {
    let url = null;
    try {
      url = (await api('GET', '/api/admin/settings')).help?.admin || null;
    } catch {
      /* no link */
    }
    const embed = url && videoEmbedUrl(url);
    if (url && !embed) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    const dialog = document.createElement('dialog');
    dialog.className = 'help-dialog';
    dialog.innerHTML = `<div class="dialog-form">
      <header><h2>Prendre en main le back-office</h2><button type="button" class="icon" data-close aria-label="Fermer">✕</button></header>
      ${
        embed
          ? `<div class="help-video"><iframe src="${esc(embed)}" title="Présentation du back-office" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`
          : `<div class="fields"><p>La vidéo de présentation n’est pas encore en ligne.</p>
             <p class="muted">${isAdmin() ? 'Ajoutez son lien (YouTube, Vimeo ou autre) dans <a href="#settings" data-close>⚙️ Paramètres → Vidéos de prise en main</a>.' : 'En attendant, le <a href="#dashboard" data-close>Tableau de bord</a> explique où trouver quoi pour votre rôle.'}</p></div>`
      }
    </div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') || e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  }

  VIEWS.bugs = async (el) => {
    const { bugs } = await api('GET', '/api/admin/bugs');
    const fresh = bugs.filter((b) => b.status === 'new');
    const done = bugs.filter((b) => b.status === 'done');
    const card = (b) => `<div class="card bug-row${b.status === 'done' ? ' muted' : ''}">
        <div class="card-head"><div>
          <span class="status ${b.source === 'app' ? 'piece' : ''}">${b.source === 'app' ? 'Appli client' : 'Back-office'}</span>
          ${b.page ? `<span class="status">${esc(b.page)}</span>` : ''}
          <strong>${esc(b.who || '—')}</strong> <small class="muted">le ${formatDate(b.createdAt.slice(0, 10))} à ${esc(b.createdAt.slice(11, 16))}</small>
        </div>
        <div class="row-actions">
          ${b.status === 'new' ? `<button class="btn small primary" data-act="done" data-id="${b.id}">✓ Réglé</button>` : `<button class="btn small" data-act="reopen" data-id="${b.id}">Rouvrir</button>`}
          <button class="btn small danger" data-act="del" data-id="${b.id}">Supprimer</button>
        </div></div>
        <p>${multiline(b.message)}</p>
        <p class="muted"><small>${esc([b.device, b.version && `version ${b.version}`].filter(Boolean).join(' · '))}</small></p>
      </div>`;
    el.innerHTML = `${pageHeader('Bugs signalés')}
      <p class="muted">Envoyés par les clients (bouton en bas de l’appli) et par l’équipe (bouton en bas du menu). Vous recevez aussi chaque bug par e-mail si les e-mails sont configurés.</p>
      <h2 class="section-title">À regarder (${fresh.length})</h2>
      ${fresh.length ? fresh.map(card).join('') : '<p class="muted">Aucun bug en attente.</p>'}
      ${done.length ? `<h2 class="section-title">Réglés (${done.length})</h2>${done.map(card).join('')}` : ''}`;
    el.onclick = async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const id = b.dataset.id;
      if (b.dataset.act === 'del') return confirmDelete('Supprimer ce bug signalé ?', async () => { await api('DELETE', `/api/admin/bugs/${id}`); VIEWS.bugs(el); refreshBugsBadge(); });
      await api('PUT', `/api/admin/bugs/${id}`, { status: b.dataset.act === 'done' ? 'done' : 'new' });
      toast(b.dataset.act === 'done' ? 'Marqué comme réglé' : 'Rouvert');
      VIEWS.bugs(el);
      refreshBugsBadge();
    };
  };

  function refreshBugsBadge(root = document) {
    if (!isAdmin()) return;
    api('GET', '/api/admin/stats').then((st) => {
      const a = root.querySelector('.sidebar a[data-section="bugs"]');
      if (!a) return;
      a.querySelector('.nav-badge')?.remove();
      if (st.newBugs) a.insertAdjacentHTML('beforeend', ` <span class="nav-badge" title="Bugs à regarder">${st.newBugs}</span>`);
    }).catch(() => {});
  }

  return { openBugForm, openHelpVideo, refreshBugsBadge };
}
