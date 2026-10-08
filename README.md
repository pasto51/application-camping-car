# Compagnon de bord, version cloud

L'application **Compagnon de bord** (V48 : mise en main, gestes du quotidien, « C'est quoi, ça ? », équipements, poids et charge, diagnostic de pannes, rendez-vous atelier, mission) est branchée sur un serveur cloud. Un back-office permet de tout modifier à distance.

| Partie | URL | Pour qui |
|---|---|---|
| **Application client** (installable sur téléphone) | `/app/` | Le client, avec la concession lors de la mise en main |
| **Back-office** (navigateur, PC ou tablette) | `/admin/` | Administrateurs et concessions |
| **API cloud** + stockage des photos | `/api/…`, `/uploads/…` | Les deux interfaces |

Marques au lancement : **Challenger** (avec le **V114 Road Edition 2027** complet) et **Randger**. Ajoutez les véhicules Randger depuis le back-office.

## Fonctionnement

### Mise en main (dans l'application)
1. La concession ouvre l'application sur le téléphone du client et touche **« Mise en main par la concession »**.
2. Elle saisit son **code concession**, choisit la **marque**, puis le **véhicule**.
3. Elle renseigne le client : prénom, nom, téléphone, e-mail, immatriculation, VIN.
4. L'application s'ouvre sur l'**Espace concession**. La concession y vérifie chaque point avec le client : équipements cochés, poids, dimensions, points oubliés, explications.
5. **« Valider et générer le code »** redemande le code concession, puis affiche le **code d'accès du client** (ex. `V114-ABCD-EFGH`, valable 2 ans). Avec son nom, ce code lui permet de retrouver ses données sur un autre téléphone (« J'ai déjà un code d'accès »).

### Ce qui est sauvegardé dans le cloud
Tout ce que le client enregistre dans l'application : équipements cochés ou ajoutés, **photos** (véhicule et équipements, modifiables), modèles et numéros de série, types d'équipements, poids et mesures, avancement de la mise en main. La sauvegarde est automatique. Hors connexion, l'application continue de fonctionner et envoie les modifications au retour du réseau.

Les **demandes de rendez-vous atelier** arrivent dans le back-office, rubrique « Demandes clients ».
- La concession est **prévenue par e-mail** de chaque nouvelle demande et de chaque nouveau message. L'envoi se règle dans Paramètres → Envoi des e-mails.
- Le client et la concession **échangent des messages** dans la demande, comme une discussion.
- Le client reçoit une **notification sur son téléphone** quand la concession répond, s'il l'a activée dans « Mon compte ». Sur iPhone, l'appli doit être ajoutée à l'écran d'accueil. Il reçoit aussi un e-mail s'il a donné son adresse.
- Les e-mails partent toujours de l'adresse de notifications, mais **au nom de la concession** (« Concession X via Compagnon de bord »), avec sa signature.
- Leur gros bouton **« Consulter la réponse dans mon application »** connecte le client directement. Ce lien ne sert qu'une fois et expire au bout de 14 jours.
- **Coupe-circuit** : si le client répond directement à l'e-mail, sa réponse va à l'e-mail de la concession, jamais dans la boîte de notifications. Les réponses automatiques (« absent du bureau ») sont neutralisées.
- En touchant le **logo de la concession**, le client ouvre le site web de celle-ci.

### Back-office
- **Diagnostics (pannes)** : les 56 entrées (environ 2 000 fins de parcours) se présentent sous forme d'**organigramme modifiable** : questions, réponses, fin de parcours avec cause, geste, produit, sécurité, rendez-vous. Un mode avancé (JSON) est aussi disponible.
- **Équipements** : les 122 équipements du catalogue (nom, rubrique, de série, zone du plan, explication, conseil).
- **Contenus de l'appli** : listes Arrivée et Départ, rappels d'entretien, motifs de rendez-vous, mission « Préparer le départ », réglages avancés.
- **Véhicules → Profil appli et photos** : nom affiché, dimensions, poids, équipements pré-cochés (aucun « de série » imposé), types connus, **photo de chaque équipement** et plan vu du dessus.
- **Relevé sur téléphone** (`/releve`) : dans le véhicule, on choisit le modèle. Pour un véhicule neuf, une **fiche guidée** s'ouvre d'abord, une question par écran : nom, photo d'ensemble, hauteur et longueur, poids (PTAC…), types d'équipements (chauffage, frigo, WC…), puis récapitulatif. Elle se rouvre avec le bouton « 📝 Fiche ». Ensuite on **coche les équipements** d'un doigt et on **prend leurs photos** avec l'appareil du téléphone. Chaque geste est enregistré tout de suite ; sans réseau, l'envoi attend et repart seul. On peut aussi y créer un véhicule ou un nouvel équipement. Réservé aux administrateurs.
- **Concessions** : code concession, téléphone, horaires et logo, affichés dans l'application.
- **Clients** : fiche du client avec ses photos, équipements, modèles notés et l'état de la mise en main ; génération d'un nouveau code d'accès.
- **Comptes** : *administrateur* (tout) ou *concession* (ses clients et ses demandes uniquement).

### Mises à jour à distance
- **Contenu** : chaque enregistrement dans le back-office est publié. L'application le reçoit à sa prochaine ouverture, ou propose « Mettre à jour ».
- **Application** : à chaque déploiement du serveur, le *service worker* détecte la nouvelle version et le client voit « Mettre à jour ». Rien à republier sur les stores.

## Importer une nouvelle version de l'application (V49…)

Le moteur de l'application est généré à partir du fichier HTML unique fourni par son créateur :

```bash
python3 tools/import-compagnon.py chemin/vers/compagnon-de-bord.html
```

L'outil sépare le code des données. Il produit `public/app/index.html`, `public/app/compagnon.js`, ainsi que `server/seed/compagnon.json` et les photos de `server/seed/photos/`. Il vérifie chaque point de découpe et s'arrête avec un message clair si la structure du fichier a changé.

Les données du serveur ne sont initialisées qu'**au premier démarrage**. Ensuite, c'est le back-office qui fait foi : un nouvel import met à jour le moteur, sans écraser les contenus déjà modifiés en ligne.

Les décisions produit et le vocabulaire imposé sont dans [docs/compagnon-v48/](docs/compagnon-v48/). À lire avant d'écrire du contenu.

## Démarrage local

Prérequis : **Node.js 22.5 ou plus récent**. Aucune dépendance npm : le projet n'utilise que la base SQLite intégrée à Node.

```bash
ADMIN_EMAIL=admin@exemple.fr ADMIN_PASSWORD=motdepasse123 npm start
```

- Application client : http://localhost:3000/app/ (code concession de démonstration : `DEMO2026`)
- Back-office : http://localhost:3000/admin/

Tests : `npm test`

## Mise en ligne (cloud)

Les données (base SQLite et photos) sont dans le dossier `DATA_DIR`, qui doit être **persistant**.

| Variable | Rôle |
|---|---|
| `SECRET` | Clé de signature des sessions du back-office (sinon, générée dans `DATA_DIR`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Premier compte administrateur, créé au premier démarrage |
| `DATA_DIR` | Dossier persistant (`./data` par défaut, `/data` dans Docker) |
| `PORT` | Port HTTP (3000 par défaut) |

- **alwaysdata (gratuit, guide pas à pas)** : [docs/HEBERGEMENT-ALWAYSDATA.md](docs/HEBERGEMENT-ALWAYSDATA.md)
- **Render** : *New → Blueprint* sur ce dépôt (`render.yaml`)
- **Serveur / VPS** : `docker compose up -d`, derrière un HTTPS

Mot de passe perdu : `node server/reset-admin.js email@exemple.fr NouveauMotDePasse`.
Accès libre au back-office pour les tests : créer le fichier `data/acces-libre`, qui ouvre le back-office sans mot de passe. Supprimez-le avant d'y mettre de vraies données.

**Sauvegardes** : copiez régulièrement le dossier de données (`app.db` et `uploads/`).

## Structure

```
server/
  app.js            serveur HTTP, fichiers statiques, version de l'appli
  db.js             schéma SQLite et migrations
  catalog.js        catalogue Compagnon de bord, profil des véhicules, données envoyées à l'appli
  seed.js           marques et concession de démonstration
  seed/             données et photos extraites de l'appli V48 (premier démarrage)
  routes/public.js  API de l'application (mise en main, code d'accès, sauvegarde, demandes)
  routes/admin.js   API du back-office
public/
  app/              application client : moteur Compagnon de bord + cloud.js (liaison cloud) + service worker
  admin/            back-office (catalog.js : diagnostics, équipements, contenus, profil véhicule)
tools/
  import-compagnon.py  import d'une nouvelle version de l'appli
test/               tests de l'API
```
