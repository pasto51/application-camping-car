// « Chat »: customers talking to each other in the app. Not developed yet: the tab shows the detailed idea,
// to be discussed before any development (administrator only, nothing visible to the customers).

const IDEAS = [
  {
    icon: '💬',
    title: 'Chat entre camping-caristes',
    status: 'Idée, pas encore développée',
    pitch:
      'Les clients de l’appli se posent des questions entre eux et y répondent : « Quelqu’un connaît une aire calme près d’Annecy ? », « Mon frigo fait un bruit de claquement, c’est normal ? ». Celui qui sait choisit de répondre, directement dans l’appli.',
    sections: [
      {
        title: 'Côté client, dans l’appli',
        items: [
          'Une nouvelle tuile « Chat » sur l’accueil.',
          'Poser une question : un titre, un texte, une photo si besoin, et un thème (eau, électricité, gaz, chauffage, itinéraires et aires, astuces de rangement…).',
          'Voir les questions des autres, les plus récentes et celles sans réponse en premier, avec une recherche par mots.',
          'Répondre à une question, ou simplement dire « Merci, ça m’aide aussi ».',
          'Être prévenu par notification quand quelqu’un répond à sa question.',
          'Chacun apparaît sous le petit nom de son véhicule (« Le Baroudeur ») et son modèle, jamais son nom, son téléphone ou son e-mail.',
        ],
      },
      {
        title: 'Deux façons de faire (à choisir)',
        items: [
          'Version 1 conseillée, « questions et réponses » : comme un petit forum. Plus simple pour une clientèle âgée, les réponses restent et servent aux suivants, la relecture est facile.',
          'Version 2, « discussion en direct » : des salons par thème où l’on s’écrit en temps réel. Plus vivant, mais plus difficile à surveiller et demande d’être connecté au même moment.',
          'On peut commencer par la version 1 et ajouter le direct plus tard si les clients le demandent.',
        ],
      },
      {
        title: 'La concession dans la boucle',
        items: [
          'Les conseillers SAV et magasin peuvent répondre avec un badge « Réponse de la concession ✔ ».',
          'Une réponse peut être marquée « Conseil vérifié » par la concession : elle remonte en premier.',
          'Si une question ressemble à une panne, l’appli propose le diagnostic qui correspond ou une demande à l’atelier.',
          'Une bonne question avec sa réponse peut devenir une fiche « Conseils & Astuces » en un clic (après relecture).',
          'Même ton que le reste de l’appli : du conseil, jamais de vente forcée. Pas de remède maison mis en avant par la concession.',
        ],
      },
      {
        title: 'Surveillance et sécurité (indispensable)',
        items: [
          'Bouton « Signaler » sur chaque message ; au-delà de quelques signalements, le message est masqué en attendant la relecture.',
          'Relecture par l’administrateur ou l’éditeur de contenu, depuis cet onglet « Chat » du back-office : masquer, supprimer, bloquer un client.',
          'Filtre automatique des numéros de téléphone, e-mails, liens et grossièretés.',
          'Règles affichées avant le premier message : politesse, pas de publicité, pas de données personnelles, pas de VIN ni d’immatriculation.',
          'Limite de messages par jour et par client pour éviter les abus.',
          'Les messages de la démo restent dans la démo, jamais visibles des vrais clients.',
        ],
      },
      {
        title: 'Qui voit quoi',
        items: [
          'Choix à faire : entraide ouverte à tous les clients de l’appli (plus de monde, plus de réponses) ou limitée aux clients d’une même concession.',
          'Possibilité de filtrer par type de véhicule (fourgon, profilé, capucine, intégral) pour des réponses plus utiles.',
          'Statistiques dans le back-office : questions posées, taux de réponse, sujets qui reviennent le plus (utile pour créer de nouveaux diagnostics ou conseils).',
        ],
      },
      {
        title: 'Points à décider avant de lancer',
        items: [
          'Version 1 (questions-réponses) ou version 2 (direct) ?',
          'Ouvert à tous ou par concession ?',
          'Qui surveille au quotidien, et en combien de temps un message signalé est traité ?',
          'Mise à jour des mentions légales (messages publics entre clients, durée de conservation, droit de suppression).',
        ],
      },
    ],
  },
];

export function registerChatView(VIEWS, { esc, pageHeader }) {
  VIEWS.chat = (el) => {
    el.innerHTML = `${pageHeader('Chat')}
      <div class="card"><p><span class="status">Bientôt</span> Cette fonctionnalité n’est <strong>pas encore développée</strong>. Voici l’idée détaillée, pour y penser et en discuter. Rien n’est visible des clients.</p></div>
      ${IDEAS.map(
        (idea) => `<div class="card idea">
          <h2>${esc(idea.icon)} ${esc(idea.title)} <span class="status">${esc(idea.status)}</span></h2>
          <p>${esc(idea.pitch)}</p>
          ${idea.sections.map((s) => `<h3>${esc(s.title)}</h3><ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')}
        </div>`
      ).join('')}`;
  };
}
