# Audit de sécurité — 9 octobre 2026

Audit fait sur une copie locale du site (jamais sur le vrai site) : trois revues complètes du code (accès et rôles ;
injections, piratage par contenu, fichiers ; saturation, mots de passe, fuites de données), une attaque « en aveugle »
de toutes les adresses du site, et un test de charge.

## Ce qui a été tenté

- **Attaque en aveugle** : 9 960 requêtes piégées sur les 94 adresses du site (sans compte, avec un faux jeton, comme
  client, comme administrateur ; données absurdes, géantes, codes d'attaque). Résultat : aucune erreur, aucun plantage.
- **Charge** : 600 ouvertures d'appli avec 50 en même temps, 1 000 bandeaux, 600 sauvegardes, statistiques et bandeaux
  du back-office avec 300 clients.
- **Revues de code** : chaque adresse vérifiée pour chaque rôle (client d'une autre concession, commercial, SAV, magasin
  détaché, éditeur, analyste, responsable), injections SQL, scripts piégés, fichiers envoyés, chemins interdits, en-têtes,
  e-mails, mots de passe, jetons, sauvegardes, VIN.

## Failles trouvées et corrigées

| Gravité | Faille | Correction |
|---|---|---|
| Critique | Une seule requête mal formée, sans compte, **éteignait le serveur** | La requête reçoit un refus, le serveur continue |
| Haute | Un visiteur sans compte pouvait envoyer 40 Mo et **saturer la mémoire** | 256 Ko sans compte ; les photos seulement avec une session |
| Haute | Un client pouvait stocker 300 Mo de données et saturer le serveur | 512 Ko par donnée, 3 Mo par client (photos en fichiers) |
| Haute | Un éditeur pouvait cacher un **script piégé dans le plan d'un véhicule** (vol de session des clients et de l'administrateur) | Zones du plan contrôlées une par une, et affichage protégé |
| Haute | Une tentative de connexion ratée pouvait **remplacer l'adresse des liens des e-mails** par un faux site (hameçonnage) | Adresse enregistrée seulement après un bon mot de passe, jamais tirée d'un en-tête inventé |
| Haute (mode test) | Le mode « accès libre » donnait l'administration à tout le monde, sauvegardes comprises | Coupé automatiquement dès qu'il y a de vrais clients ; jamais pour les sauvegardes ; un faux jeton est refusé |
| Moyenne | Après un changement de mot de passe, **l'ancienne session restait valable 15 jours** | Toutes les autres sessions sont coupées |
| Moyenne | Un téléphone perdu restait connecté pour toujours | Bouton « Déconnecter ses téléphones » dans la fiche client ; déconnexion après 1 an sans utilisation |
| Moyenne | Un code d'accès expiré ouvrait encore le compte | Refusé après sa date |
| Moyenne | Les limites anti-essais étaient communes à tout le site derrière le proxy (20 erreurs = tout le monde bloqué) | Vraie adresse du visiteur ; limite par compte et par adresse |
| Moyenne | Un client pouvait envoyer des centaines de demandes (et autant d'e-mails) | 15 demandes et 60 messages par jour et par client |
| Basse | L'éditeur et l'analyste voyaient l'équipe de toutes les concessions | Liste vide |
| Basse | Des clients pouvaient être confiés à un compte SAV ou magasin ; le SAV pouvait créer des clients | Réservé aux commerciaux et au responsable |
| Basse | Les réglages e-mail visibles par tous les rôles | Administrateur seulement |
| Basse | Le temps de réponse révélait si un e-mail de compte existe | Même temps de réponse |
| Basse | Un VIN ou une plaque tapés dans la recherche étaient gardés dans les statistiques | Masqués (« numéro masqué ») |
| Basse | Adresse d'expédition des e-mails avec retour à la ligne ; adresse « % » ; téléchargement interrompu | Refusés proprement |
| Performance | 50 ouvertures d'appli simultanées : jusqu'à 20 s d'attente | Contenu préparé une fois : 600 ouvertures en 1,3 s au lieu de 25 s |

En plus : en-têtes de protection (pas d'affichage du site dans un autre site, HTTPS mémorisé par le navigateur),
statistiques de plus de 3 ans supprimées automatiquement.

Chaque correction est vérifiée par un test automatique (`npm test`).

## Ce qui a été vérifié et qui est sain

- Aucune **fuite entre concessions** ni entre clients : chaque fiche, demande, photo et donnée est filtrée.
- **Injections SQL** : impossibles, toutes les requêtes sont paramétrées.
- **Scripts piégés** : tous les textes (noms, demandes, astuces, bandeaux…) sont protégés à l'affichage, dans l'appli, le back-office et les e-mails.
- **Fichiers envoyés** : seulement des photos JPEG/PNG/WebP vérifiées, 6 Mo maximum, noms aléatoires ; impossible de lire `data/`, la base, les clés ou les sauvegardes par le site.
- **Mots de passe** : chiffrés (scrypt, sel). **Jetons** : signés, vérifiés, avec expiration ; le rôle est relu à chaque requête.
- **VIN et plaque** : jamais enregistrés (vérifié partout : base, demandes, export, e-mails gardés, journaux).

## Ce qui reste à décider (choix d'organisation, pas des bugs)

1. **Code concession** : la mise en main se fait avec le seul code de la concession, tapé sur le téléphone du client.
   Quelqu'un qui le voit pourrait créer de faux clients. Conseils : des codes longs et difficiles (8 caractères ou plus,
   avec des chiffres), les changer si un code circule. Évolution possible : un code de mise en main à usage unique,
   généré par le commercial dans le back-office.
2. **Concession DEMO2026** (créée à l'installation, son code est connu) : **désactivez-la** dans le back-office
   (Concessions → Modifier → inactive) dès que les vraies concessions sont en place.
3. **Mode accès libre** (fichier `data/acces-libre`) : à supprimer sur le vrai site, même s'il se coupe désormais tout
   seul dès qu'il y a de vrais clients.
4. **Sauvegardes complètes** : elles contiennent tout (clients, clés) ; gardez les copies téléchargées en lieu sûr.
