# Application Camping-Car

Plateforme cloud pour les concessions et leurs clients camping-caristes. Elle comprend trois parties, servies par un seul serveur :

| Partie | URL | Pour qui |
|---|---|---|
| **Application client** (PWA installable sur téléphone) | `/app/` | Le client, avec la concession lors de la mise en main |
| **Back-office** (navigateur, PC ou tablette) | `/admin/` | Administrateurs et concessions |
| **API cloud** + stockage des photos | `/api/…`, `/uploads/…` | Les deux interfaces |

Marques au lancement : **Challenger** et **Randger**. D'autres marques s'ajoutent depuis le back-office.

## Fonctionnement

### Mise en main (application client)
1. La concession ouvre l'application sur le téléphone du client, puis touche **« Mise en main par la concession »**.
2. Elle saisit son **code concession**, vérifié en ligne.
3. Elle choisit la **marque** (Challenger / Randger), puis le **véhicule** de cette marque.
4. Elle renseigne le client (nom, téléphone, immatriculation, VIN, date).
5. L'application affiche un **code de récupération**. Il permet au client de retrouver toutes ses données sur un autre téléphone (écran « J'ai déjà un compte »).

### Ce que le client retrouve dans l'application
- **Véhicule** : photo (il peut la remplacer par la sienne), caractéristiques, description, contact de la concession.
- **Dépannage** : fiches problème → solution, avec recherche et catégories, filtrées pour son véhicule. Il peut ajouter une **note personnelle** à chaque fiche.
- **Photos** : galerie personnelle (appareil photo ou galerie). Chaque photo peut être légendée, remplacée ou supprimée.
- **Signaler** : envoi d'un problème à sa concession, avec photos. Il suit le statut et lit la réponse de la concession.
- **Profil** : modifier ses informations, changer de véhicule (code concession requis), supprimer son compte.

Toutes ces données sont **sauvegardées dans le cloud** et rattachées au client. L'application garde aussi une copie sur le téléphone pour fonctionner **hors connexion**, par exemple en zone blanche.

### Back-office
- **Administrateur** : véhicules (photo, caractéristiques, activation), fiches problèmes (une fiche peut concerner tous les véhicules, une marque ou un seul modèle), marques (logo, couleur de l'appli), concessions et leurs codes, utilisateurs, message diffusé dans l'application.
- **Compte concession** : ne voit que **ses** clients et leurs signalements. Il peut y répondre, modifier une fiche client et générer un nouveau code de récupération.

### Mises à jour à distance
- **Contenu** (véhicules, fiches, photos, message) : publié dès l'enregistrement dans le back-office. L'application le recharge à chaque ouverture.
- **Application** : à chaque déploiement du serveur, le *service worker* détecte la nouvelle version. Le client voit « Nouvelle version disponible → Mettre à jour ». Il n'y a rien à republier sur les stores.

## Démarrage local

Prérequis : **Node.js 22.5 ou plus récent**. Aucune dépendance npm : le projet n'utilise que la base SQLite intégrée à Node.

```bash
cp .env.example .env   # optionnel
ADMIN_EMAIL=admin@exemple.fr ADMIN_PASSWORD=motdepasse123 npm start
```

- Application client : http://localhost:3000/app/ (code concession de démonstration : `DEMO2026`)
- Back-office : http://localhost:3000/admin/

Si `ADMIN_PASSWORD` n'est pas fourni au premier lancement, un mot de passe aléatoire est généré et affiché dans les logs.

Tests : `npm test`

## Mise en ligne (cloud)

L'application est un conteneur Docker unique. Les données (base SQLite et photos) sont stockées dans le dossier `DATA_DIR`, qui doit être un **volume persistant**.

| Variable | Rôle |
|---|---|
| `SECRET` | Clé de signature des sessions du back-office (longue chaîne aléatoire) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Premier compte administrateur, créé au premier démarrage |
| `DATA_DIR` | Dossier persistant (`/data` dans le conteneur) |
| `PORT` | Port HTTP (3000 par défaut) |

- **Render** : *New → Blueprint* sur ce dépôt (`render.yaml` fourni, disque persistant inclus).
- **Serveur / VPS** : `SECRET=… ADMIN_PASSWORD=… docker compose up -d`, derrière un reverse proxy HTTPS (Caddy, Nginx…).
- **Fly.io, Railway, Scaleway…** : utiliser le `Dockerfile` et monter un volume sur `/data`.

⚠️ Le **HTTPS est obligatoire** en production : l'installation de la PWA et l'appareil photo ne fonctionnent pas sans.

**Sauvegardes** : copier régulièrement le dossier `/data` (`app.db` et `uploads/`).

## Structure

```
server/
  app.js            serveur HTTP, fichiers statiques, version de l'appli
  db.js             schéma SQLite
  seed.js           données initiales (Challenger, Randger, fiches types, concession démo)
  routes/public.js  API de l'application client (mise en main, profil, photos, notes, signalements)
  routes/admin.js   API du back-office
public/
  app/              application client (PWA + service worker)
  admin/            back-office
  shared/           utilitaires communs (API, compression des photos)
test/               tests de l'API
```

Les photos sont redimensionnées sur le téléphone (1600 px max, en JPEG) avant l'envoi, pour économiser le forfait mobile.
