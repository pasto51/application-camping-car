# Compagnon de bord, version cloud

L'application **Compagnon de bord** (V48 : mise en main, gestes du quotidien, « C'est quoi, ça ? », équipements, poids et charge, diagnostic de pannes, rendez-vous atelier, conseils et astuces) est branchée sur un serveur cloud. Un back-office permet de tout modifier à distance.

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

### Demande au magasin (pièces et remplacements)
- Sur chaque équipement (« C'est quoi, ça ? ») et à la fin d'un diagnostic (« Demander au magasin »), le client envoie une demande avec : **photo** (celle de l'équipement, ou une nouvelle), **marque et modèle**, **référence ou n° de série**, **n° de cellule**, **année du véhicule**, et ce qu'il lui faut (pièce, remplacement, accessoire).
- Elle part à l'**e-mail du magasin** de la concession (Concessions → « E-mail du magasin ») et apparaît dans le back-office, filtre « 🛒 Magasin », avec une fiche pièce à copier pour la commande fournisseur.
- Le n° de cellule et l'année se remplissent par le client (Mon compte → Mon véhicule) ou par le commercial (fiche client).
- Photo : si le client a sa propre photo de l'équipement, c'est elle qui part ; sinon la photo du modèle est envoyée, signalée comme « photo générique », et le client est invité à joindre la sienne.
- **VIN : jamais enregistré sur le serveur.** Saisi à la mise en main sur le téléphone du client, il y reste ; il n'est transmis que dans l'e-mail d'une demande au magasin, si le client coche la case. **L'immatriculation n'est plus demandée ni conservée.** Les VIN et immatriculations des versions précédentes ont été effacés.

### Espace client (dans l'appli)
Sur l'accueil : **🛒 Demander une pièce** et **👤 Mon espace client** : mes informations (prénom, e-mail, téléphone), mon véhicule (année, n° de cellule, VIN gardé sur le téléphone), mon code d'accès, notifications (téléphone et e-mails de réponse), mes données (téléchargement, suppression du compte), confidentialité et mentions légales (`public/app/legal.html`, éléments de l'éditeur à compléter).

Le **code d'accès** est conservé chiffré : la fiche client du back-office l'affiche, avec « Copier » et « Renvoyer au client » (e-mail, ou lien et SMS).

### Back-office
- **Diagnostics (pannes)** : les 56 entrées (environ 2 000 fins de parcours) se présentent sous forme d'**organigramme modifiable** : questions, réponses, fin de parcours avec cause, geste, produit, sécurité, rendez-vous. Un mode avancé (JSON) est aussi disponible.
- **Équipements** : les 188 équipements du catalogue (nom, rubrique, types de véhicules concernés, zone du plan, explication, conseil).
- **Conseils & Astuces** : les astuces de l'appli (titre, photo ou vidéo YouTube / Vimeo, texte, « Le conseil du magasin »), celles envoyées par les clients à valider (pastille rouge dans le menu). Réservé à l'administrateur et à l'éditeur de contenu.
- **À la une** : les bandeaux de l'accueil de l'appli (ouvrent une astuce, une page de l'appli, un site ou une annonce). Chacun a son public : concessions, type de véhicule, ancienneté depuis la mise en main, garantie, avec ou sans certains équipements (ex. opération clim : tous ceux qui n'ont pas de clim), accord pour les offres, et ses dates de début et de fin. Le client voit le plus prioritaire de ceux qui le concernent. Le responsable de concession crée ceux de sa concession.
- **Contenus de l'appli** : les **listes des Gestes du quotidien** (Arrivée, Départ, Hivernage, Remise en route, Chaque mois, et celles que vous ajoutez : un onglet chacune ; chaque ligne peut viser les clients qui ont certains équipements, ex. batterie lithium) ; **carnet d'entretien** (chaque entretien : fréquence en mois ou date de saison, bouton rendez-vous, et pour qui : concessions, types de véhicule, clients avec ou sans certains équipements ; les contrôles à faire soi-même) ; motifs de rendez-vous ; « Ce que j'emporte » ; poids et dépassements (longueur, hauteur) des équipements ; réglages avancés.
- **Tableau de bord** : pour chaque rôle, un guide « Où trouver quoi » (les menus du back-office et où se règle chaque chose de l'appli du client).
- **Véhicules → Profil appli et photos** : nom affiché, dimensions, poids, équipements pré-cochés (aucun « de série » imposé), types connus, **photo de chaque équipement** et plan vu du dessus.
- **Relevé sur téléphone** (`/releve`) : dans le véhicule, on choisit le modèle. Pour un véhicule neuf, une **fiche guidée** s'ouvre d'abord, une question par écran : nom, **type de véhicule** (van, fourgon aménagé, profilé compact, profilé, intégral, capucine), photo d'ensemble, hauteur et longueur, poids (PTAC…), types d'équipements (chauffage, frigo, WC…), puis récapitulatif. Elle se rouvre avec le bouton « 📝 Fiche ». Ensuite on **coche les équipements** d'un doigt et on **prend leurs photos** avec l'appareil du téléphone. Chaque geste est enregistré tout de suite ; sans réseau, l'envoi attend et repart seul. La liste ne montre que les équipements qui existent sur ce type (pas de porte latérale coulissante sur un profilé, pas de lit arrière sur un profilé compact…), avec un bouton pour afficher les autres. Le bouton 📍 de chaque équipement choisit sa **zone sur le plan** (utile pour l'extérieur) et son **nom sur ce véhicule** (taille, modèle). Étape **« Ce qu'il y a dedans »** : on décrit l'intérieur en quelques mots (« penderie arrière, lit pavillon, cuisine et table ») ; l'appli propose les plans qui correspondent parmi 25 implantations, ou directement à partir du nom du modèle (V114, R602, Kilig 669… voir `docs/CATALOGUES-2026.md`), (lit transversal, central, jumeaux, superposés, salon arrière, cuisine arrière, salle d'eau arrière, toit relevable…) et coche les équipements cités. Les plans sont dans `public/app/plans/`, dessinés par `node tools/make-plans.js` ; la recherche est dans `server/layouts.js`. On peut aussi y créer un véhicule ou un nouvel équipement. Réservé aux administrateurs.
- **Concessions** : code concession, téléphone, horaires et logo, affichés dans l'application.
- **Clients → ＋ Nouveau client** : enregistrer un client sans passer par la mise en main dans l'appli. Le code d'accès est créé tout de suite, avec un lien qui ouvre l'appli déjà connectée (à copier, à envoyer par SMS, ou par e-mail de bienvenue automatique).
- **Clients** : fiche du client avec ses photos, équipements, modèles notés et l'état de la mise en main ; génération d'un nouveau code d'accès.
- **SAV et magasin** (fiche de la concession) : chacun a son e-mail, son téléphone et ses horaires ; le magasin peut être **détaché** (indépendant : la concession ne voit pas ses demandes, il ne voit que les siennes). Aiguillage automatique :
  - rendez-vous atelier et soucis (étanchéité, gaz, révision…) → **SAV** ;
  - pièce ou remplacement d'équipement **sous garantie ou extension** → **SAV** ; hors garantie → **magasin** ;
  - accessoire ou consommable → **magasin**.
  La garantie se saisit à la mise en main (fin de garantie, proposée d'après la garantie habituelle de la concession, et extension) ou dans la fiche client du back-office (bouton « Modifier la garantie », pour le responsable de concession et le commercial du client, en cas d'erreur à la livraison). Chaque service reçoit les e-mails de ses demandes et peut **transférer** une demande à l'autre avec un motif. Le client voit toujours deux lignes, « SAV » et « Magasin » (même détaché), avec « Appeler » et « Écrire », sur l’accueil et dans son espace client.
- **Rôles** :
  - *Administrateur* : tout (catalogue, concessions, utilisateurs).
  - *Éditeur de contenu* (compte créé par l'administrateur, sans concession) : modifie les contenus de l'appli — diagnostics et organigrammes, équipements, listes, véhicules, marques, photos et relevé, message / campagne affiché dans l'appli. Il ne voit ni les clients, ni les demandes, ni les concessions, ni les comptes, ne supprime pas de véhicule et ne touche pas aux réglages des e-mails.
  - *Responsable de concession* : voit et gère tout dans sa concession (clients, demandes, équipe, fiche de la concession sauf le code), sans recevoir d'e-mails ; confie ou bascule les clients entre commerciaux.
  - *SAV / atelier* et *Magasin* : voient les demandes et répondent à celles de leur service. Un *magasin détaché* ne voit que ses demandes, et pas les clients de la concession.
  - *Commercial* : gère ses clients et fait les mises en main ; ne traite pas les demandes (pas de menu Demandes, pas d'e-mail) mais en voit le récap sur son tableau de bord.
- **Commercial du client** : choisi à la mise en main dans l'appli ou à la création dans le back-office (suivi interne, non affiché au client). Les anciens comptes « concession » deviennent responsables de concession.

### Mises à jour à distance
- **Contenu** : chaque enregistrement dans le back-office est publié. L'application le reçoit à sa prochaine ouverture, ou propose « Mettre à jour ».
- **Application** : à chaque déploiement du serveur, le *service worker* détecte la nouvelle version et le client voit « Mettre à jour ». Rien à republier sur les stores.

## Démo pour essayer en vrai

Sur le serveur, dans le dossier de l'application :

```bash
node server/demo.js vous@gmail.com   # crée 3 concessions DÉMO, leurs équipes, 9 clients et leurs demandes, puis affiche les accès
node server/demo.js --stats          # refait seulement les statistiques de test (12 mois), sans toucher aux clients ni aux codes
node server/demo.js --supprimer      # efface toute la démo (la concession DEMO2026 et les vraies données ne sont pas touchées)
```

- Comptes du back-office en `@demo.test`, mot de passe `demo1234`.
- Pour chaque client : un lien qui ouvre son appli (une seule fois, 14 jours) et son nom + code d'accès (« J'ai déjà un compte »). Ouvrir le lien d'un autre client dans le même navigateur change de client.
- Avec votre adresse en argument, les e-mails des services et des clients démo arrivent chez vous (`vous+sav-nantes@gmail.com`, `vous+client-paul@gmail.com`…), une fois l'envoi des e-mails configuré.
- Relancer la commande recrée une démo propre.
- `--nom "Camping-Cars Dupont"` : la première concession porte le nom du prospect. Déroulé d'une présentation commerciale : [docs/DEMO-PRESENTATION.md](docs/DEMO-PRESENTATION.md).

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

## Sauvegardes

- Chaque jour (à partir de 7 h), le serveur copie la base dans `data/sauvegardes/app-AAAA-MM-JJ.db` et garde les 14 derniers jours.
- Back-office → **Paramètres → Sauvegardes** (administrateur) : liste, « Sauvegarder maintenant » et « Télécharger ». Téléchargez-en une régulièrement pour la garder chez vous.
- Les photos sont dans `data/uploads` (sauvegardé par alwaysdata avec le reste du compte).
- **Restaurer** : sur alwaysdata, **Web → Sites → Arrêter** le site, puis dans le terminal :
  ```bash
  cd ~/application-camping-car && cp data/app.db data/app-avant-restauration.db && cp data/sauvegardes/app-AAAA-MM-JJ.db data/app.db && rm -f data/app.db-wal data/app.db-shm
  ```
  puis **Redémarrer** le site.

## Tâches quotidiennes

Le serveur fait aussi chaque jour : les **rappels d'entretien** (notification sur le téléphone des clients 15 jours avant une échéance : étanchéité, révision, contrôle gaz, chauffage, hivernage, remise en route ; calculées depuis la mise en main et le carnet d'entretien que le client tient dans l'appli) et un **e-mail par service** (SAV, magasin) listant les demandes **sans réponse depuis plus de 48 h**.

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
