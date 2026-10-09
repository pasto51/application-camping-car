// « Où trouver quoi »: the guide of the dashboard, for the role of the person signed in. What each menu of the
// back-office is for, and where each thing the customer sees in the app is set.

import { esc } from '/shared/common.js';

const ALL = ['admin', 'editor', 'analytics', 'manager', 'dealer', 'sales', 'sav', 'store'];
const MANAGERS = ['admin', 'manager', 'dealer'];

// What the person does here, in their own words: [role(s), sentence].
const INTRO = {
  admin: 'Vous avez la main sur tout : les concessions et leurs équipes, les contenus de l’appli, les statistiques et les réglages du site.',
  editor: 'Vous rédigez et tenez à jour ce que les clients voient dans l’appli : véhicules, équipements, diagnostics, astuces, bandeaux et contenus. Vous ne voyez ni les clients ni leurs demandes.',
  analytics: 'Vous suivez ce que les clients cherchent et consultent dans l’appli, pour préparer les campagnes. Aucune donnée personnelle : seulement des chiffres.',
  manager: 'Vous suivez votre concession : les demandes de vos clients (SAV et magasin), vos clients et leurs commerciaux, votre équipe, et les bandeaux de votre concession.',
  dealer: 'Vous suivez votre concession : les demandes de vos clients (SAV et magasin), vos clients et leurs commerciaux, votre équipe, et les bandeaux de votre concession.',
  sales: 'Vous faites la mise en main avec le client et vous suivez vos clients. Les demandes sont traitées par le SAV et le magasin : vous n’avez rien à faire, vous voyez seulement le récapitulatif.',
  sav: 'Vous traitez les demandes atelier et garantie des clients de votre concession : vous répondez dans la demande, le client reçoit la réponse dans son appli.',
  store: 'Vous traitez les demandes du magasin : pièces hors garantie, accessoires et produits conseillés par l’appli. Vous répondez dans la demande, le client reçoit la réponse dans son appli.',
};

// The menus of the back-office: [section, title, sentence, roles].
const MENUS = [
  ['dashboard', 'Tableau de bord', 'Ce qui vous attend aujourd’hui, et ce guide.', ALL],
  ['analytics', 'Statistiques', 'Ce que les clients cherchent, les problèmes les plus consultés par mois, les produits conseillés et demandés, les astuces lues, des idées de campagne. Bouton « Exporter (Excel) ».', ['admin', 'analytics', 'manager', 'dealer']],
  ['reports', 'Demandes clients', 'Les demandes à traiter : rendez-vous atelier, pièces, accessoires. Répondre, changer l’état, transférer au SAV ou au magasin. ⏰ = sans réponse depuis plus de 48 h.', ['admin', 'manager', 'dealer', 'sav', 'store']],
  ['customers', 'Clients', 'La fiche de chaque client : véhicule, garantie (modifiable), carnet d’entretien, accord pour les offres, code d’accès à renvoyer, commercial.', ['admin', 'manager', 'dealer', 'sales', 'sav', 'store']],
  ['banners', 'À la une', 'Le bandeau en haut de l’accueil de l’appli, ciblé : concessions, type de véhicule, ancienneté, garantie, équipements, dates. Ex. : portes ouvertes, opération clim.', ['admin', 'editor', 'manager', 'dealer']],
  ['tips', 'Conseils & Astuces', 'Les fiches astuces de l’appli, et celles envoyées par les clients à relire (pastille rouge) : Publier, Corriger ou Refuser.', ['admin', 'editor']],
  ['vehicles', 'Véhicules', 'Les modèles, leur photo, leur plan et leurs équipements (relevé sur téléphone).', ['admin', 'editor']],
  ['diagnostics', 'Diagnostics (pannes)', 'Les parcours « J’ai un souci » : questions, causes, gestes, et le produit conseillé par le magasin.', ['admin', 'editor']],
  ['equipment', 'Équipements', 'La liste des équipements, leurs explications et photos (« C’est quoi, ça ? »).', ['admin', 'editor']],
  ['content', 'Contenus de l’appli', 'Gestes du quotidien, carnet d’entretien (entretiens, fréquences et pour qui), motifs de rendez-vous, « Ce que j’emporte », poids et dépassements des équipements.', ['admin', 'editor']],
  ['brands', 'Marques', 'Les marques de véhicules et leur logo.', ['admin', 'editor']],
  ['dealerships', 'Concessions / Ma concession', 'Coordonnées, logo, téléphone et e-mail du SAV et du magasin (affichés dans l’appli du client), durée de garantie.', ['admin', 'manager', 'dealer', 'sales', 'sav', 'store']],
  ['users', 'Utilisateurs / Mon équipe', 'Les comptes : commerciaux, SAV, magasin, responsables. Créer, modifier, désactiver.', MANAGERS],
  ['settings', 'Paramètres', 'Votre mot de passe. Pour l’administrateur : e-mails du site, annonce, sauvegardes.', ALL],
];

// What the customer sees in the app, and where it is set: [where in the app, what, section, roles who care].
const APP = [
  ['Accueil, en haut', 'Le bandeau « À la une »', 'banners', ['admin', 'editor', 'manager', 'dealer', 'analytics']],
  ['Accueil', 'Le poids du véhicule et « Ce que j’emporte »', 'content', ['admin', 'editor', 'sales']],
  ['Accueil', 'Le carnet d’entretien (pastille rouge quand un entretien approche)', 'content', ['admin', 'editor', 'manager', 'dealer', 'sav', 'sales']],
  ['Accueil', 'Longueur et hauteur, avec les équipements qui dépassent', 'content', ['admin', 'editor', 'sales']],
  ['Gestes du quotidien', 'Les listes Arrivée et Départ', 'content', ['admin', 'editor', 'sales']],
  ['C’est quoi, ça ?', 'Le plan du véhicule et la fiche de chaque équipement', 'equipment', ['admin', 'editor', 'sales', 'sav', 'store']],
  ['J’ai un souci', 'Les diagnostics pas à pas ; « Demander au magasin » arrive dans Demandes clients', ['diagnostics', 'reports'], ['admin', 'editor', 'store', 'sav', 'manager', 'dealer', 'analytics']],
  ['Conseils & Astuces', 'Les fiches astuces et « Partager mon astuce »', 'tips', ['admin', 'editor', 'store', 'analytics']],
  ['Rendez-vous atelier', 'Les motifs de rendez-vous ; la demande arrive au SAV', ['content', 'reports'], ['admin', 'editor', 'sav', 'manager', 'dealer']],
  ['Mon espace client', '« Demander une pièce » : sous garantie au SAV, sinon au magasin', 'reports', ['admin', 'sav', 'store', 'manager', 'dealer']],
  ['Mon espace client', 'Les boutons Appeler / Écrire du SAV et du magasin', 'dealerships', ['admin', 'manager', 'dealer', 'sav', 'store']],
  ['Mise en main', 'Code concession, véhicule, équipements, puis le code d’accès du client', 'customers', ['admin', 'manager', 'dealer', 'sales']],
];

export function guideHtml(role, visibleSections) {
  const can = new Set(visibleSections);
  const link = (id, label) => (can.has(id) ? `<a href="#${id}">${esc(label)}</a>` : esc(label));
  const menus = MENUS.filter(([id, , , roles]) => roles.includes(role) && can.has(id));
  const app = APP.filter(([, , , roles]) => roles.includes(role));
  return `<div class="card guide">
      <h2>Où trouver quoi</h2>
      <p>${esc(INTRO[role] || '')}</p>
      <div class="guide-cols">
        <div>
          <h3>Dans le back-office</h3>
          <ul class="guide-list">${menus.map(([id, title, text]) => `<li><strong>${link(id, title)}</strong><span>${esc(text)}</span></li>`).join('')}</ul>
        </div>
        ${
          app.length
            ? `<div>
          <h3>Dans l’appli du client</h3>
          <ul class="guide-list">${app
            .map(([where, what, ids]) => {
              // The first of its menus this person can open.
              const id = [].concat(ids).find((x) => can.has(x));
              return `<li><strong>${esc(where)}</strong><span>${esc(what)}${id ? ` — <a href="#${id}">${esc(MENUS.find((m) => m[0] === id)?.[1] || '')}</a>` : ''}</span></li>`;
            })
            .join('')}</ul>
          <p class="muted">Appli du client : <a href="/app/" target="_blank" rel="noopener">${esc(location.origin)}/app/</a></p>
        </div>`
            : ''
        }
      </div>
    </div>`;
}
