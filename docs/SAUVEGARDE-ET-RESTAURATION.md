# Sauvegarder et remettre le site en ligne

Le site est fait de **deux choses** :

1. **Le code** (les programmes) : il est sur GitHub. La version du **9 octobre 2026** a pour identifiant
   **`43636a525d`** (à garder précieusement). On peut y revenir à tout moment.
2. **Les données** (clients, demandes, contenus, comptes, **photos**, clés du site) : elles sont sur le serveur alwaysdata,
   dans le dossier `data`. Elles changent tous les jours : il faut donc les sauvegarder régulièrement.

## Les sauvegardes des données

Dans le back-office : **Paramètres → Sauvegardes** (compte administrateur).

- **Sauvegarde complète** : un seul fichier `site-AAAA-MM-JJ.tar.gz` avec la base, les photos et les clés du site.
  Elle se fait **toute seule chaque semaine** (les 4 dernières sont gardées sur le serveur), ou avec le bouton
  « Faire une sauvegarde complète maintenant ».
- **Base seule** : une copie de la base chaque jour (les 14 derniers jours), pour revenir à la veille après une erreur.

👉 **Téléchargez une sauvegarde complète sur votre ordinateur une fois par mois** (et avant une grosse modification), et
rangez-la aussi sur une clé USB ou un cloud. Si le serveur disparaît, c'est la seule copie qui reste.
Ce fichier est **confidentiel** (données des clients et clés du site) : ne l'envoyez à personne.

---

## Cas 1 : une mise à jour pose problème → revenir au code du 9 octobre 2026

Les données ne bougent pas, seul le code revient en arrière. Dans la console SSH d'alwaysdata, copiez-collez :

```
cd ~/application-camping-car && git fetch origin && git checkout 43636a525d && echo OK
```

Puis **Web → Sites → Redémarrer**. En bas du menu du back-office, la version change.

Pour revenir ensuite à la dernière version :

```
cd ~/application-camping-car && git checkout claude/app-vehicles-cloud-backoffice-gaifle && git pull && echo OK
```

Puis **Redémarrer**.

## Cas 2 : des données abîmées ou supprimées par erreur → remettre une sauvegarde complète

Choisissez la date dans **Paramètres → Sauvegardes** (ex. `site-2026-10-09.tar.gz`). Sur alwaysdata, **Web → Sites →
Arrêter** le site, puis copiez-collez en remplaçant `AAAA-MM-JJ` par cette date :

```
cd ~/application-camping-car && mkdir -p ~/restauration && tar -xzf data/sauvegardes/site-AAAA-MM-JJ.tar.gz -C ~/restauration && mv data ~/data-avant-restauration && mkdir data && cp -a ~/restauration/. data/ && cp -a ~/data-avant-restauration/sauvegardes data/ && rm -rf ~/restauration && echo OK
```

Puis **Web → Sites → Redémarrer** (ou Démarrer). L'ancien dossier est gardé dans `~/data-avant-restauration` (au cas où) : vous
pourrez le supprimer quand tout va bien (`rm -rf ~/data-avant-restauration`).

> Pour revenir seulement à la base de la veille (sans toucher aux photos), voir « Sauvegardes » dans le README.

## Cas 3 : le serveur est perdu → tout remettre sur un nouveau compte ou un nouvel hébergement

Il faut : le code (GitHub) et **la sauvegarde complète téléchargée sur votre ordinateur**.

1. Sur le nouveau serveur, dans la console SSH, récupérez le code à la version du 9 octobre 2026 :
   ```
   cd ~ && git clone https://github.com/pasto51/application-camping-car.git && cd application-camping-car && git checkout 43636a525d && echo OK
   ```
   (Pour la dernière version à la place : `git checkout claude/app-vehicles-cloud-backoffice-gaifle`.)
2. Envoyez le fichier `site-AAAA-MM-JJ.tar.gz` de votre ordinateur vers le dossier `~` du serveur, avec FileZilla
   (connexion « SFTP » avec les identifiants SSH d'alwaysdata).
3. Remettez les données :
   ```
   cd ~/application-camping-car && mkdir -p data && tar -xzf ~/site-AAAA-MM-JJ.tar.gz -C data && echo OK
   ```
4. Créez le site comme la première fois (voir « Mise en ligne (cloud) » dans le README : site de type
   **Node.js**, commande `node server/index.js`, dossier `application-camping-car`), puis **Redémarrer**.
5. Si l'adresse du site change, les liens déjà envoyés aux clients pointent vers l'ancienne adresse : renvoyez les codes
   d'accès depuis les fiches clients, ou gardez la même adresse (nom de domaine).

Les clients retrouvent tout : leur compte, leurs photos, leurs demandes. Les clés du site (`secret.key`, `vapid.json`)
sont dans la sauvegarde : les codes d'accès et les notifications continuent de fonctionner.
