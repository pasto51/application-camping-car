# Mettre l'application en ligne sur alwaysdata (gratuit)

Guide pas à pas, sans connaissances techniques. Comptez environ 15 minutes.

À la fin, vous aurez :
- l'**appli client** : `https://VOTRE-COMPTE.alwaysdata.net/app/`
- le **back-office** : `https://VOTRE-COMPTE.alwaysdata.net/admin/`

Vos modifications, vos clients et vos photos sont **conservés**.

> Les noms des menus peuvent légèrement changer selon la version du site alwaysdata. En cas de doute, faites une capture d'écran et demandez.

---

## Étape 1 — Créer le compte

1. Allez sur **alwaysdata.com** et cliquez sur **« Inscription »**.
2. Choisissez l'offre **gratuite** (pas de carte bancaire).
3. Choisissez un **nom de compte**, par exemple `horsol-camping`. Il fera partie de l'adresse de l'appli : `horsol-camping.alwaysdata.net`.
4. Validez l'e-mail reçu.

👉 **Notez l'espace disque indiqué pour l'offre gratuite** (10 Mo ou 100 Mo). Avec 10 Mo, ce sera trop petit pour les photos.

## Étape 2 — Choisir la version de Node.js

L'application a besoin de **Node.js 22 ou plus récent**.

1. Dans le panneau alwaysdata, menu **Environnement**, puis **Node.js**.
2. Choisissez la version **la plus récente** proposée (22 ou plus), puis enregistrez.

## Étape 3 — Ouvrir la console

La console est une fenêtre où l'on tape des commandes.

1. Menu **Accès distant**, puis **SSH**.
2. Modifiez l'utilisateur SSH et cochez **« Activer la connexion par mot de passe »**. Choisissez un mot de passe.
3. Ouvrez la **console web (Web SSH)** proposée par alwaysdata et connectez-vous avec cet utilisateur.

## Étape 4 — Télécharger l'application

Dans la console, copiez-collez cette ligne puis appuyez sur Entrée :

```
git clone https://github.com/pasto51/application-camping-car.git
```

Vérifiez ensuite la version de Node.js :

```
node -v
```

Le résultat doit commencer par `v22` ou plus. Sinon, revenez à l'étape 2.

## Étape 5 — Configurer le site

1. Menu **Web**, puis **Sites**. Modifiez le site existant, ou cliquez sur **Ajouter un site**.
2. **Type** : `Node.js`.
3. **Commande** :
   ```
   node --no-warnings=ExperimentalWarning server/index.js
   ```
4. **Répertoire de travail** : `application-camping-car`.
5. **Variables d'environnement** : mettez votre e-mail et un mot de passe solide (au moins 8 caractères) :
   ```
   ADMIN_EMAIL=votre@email.fr ADMIN_PASSWORD=VotreMotDePasse123
   ```
   Ce sont vos identifiants pour entrer dans le back-office.
6. Enregistrez. Le site démarre.

## Étape 6 — Tester

- Back-office : `https://VOTRE-COMPTE.alwaysdata.net/admin/`, avec l'e-mail et le mot de passe de l'étape 5.
- Appli : `https://VOTRE-COMPTE.alwaysdata.net/app/`. Pour essayer la mise en main, utilisez le code concession de démonstration **DEMO2026**.

Sur téléphone, ouvrez l'adresse de l'appli puis :
- **iPhone** (Safari) : bouton Partager, puis **« Sur l'écran d'accueil »** ;
- **Android** (Chrome) : menu ⋮, puis **« Installer l'application »**.

---

## Plus tard : installer une nouvelle version

Quand l'application est améliorée :

1. Ouvrez la console (étape 3) et tapez :
   ```
   cd application-camping-car && git pull
   ```
2. Menu **Web**, puis **Sites** : cliquez sur **Redémarrer** pour le site.

Vos données (clients, photos, modifications) ne sont **pas touchées** : elles sont rangées dans le dossier `application-camping-car/data`.

## Sauvegarde

Téléchargez de temps en temps le dossier `application-camping-car/data`, par exemple avec le gestionnaire de fichiers ou en FTP. Il contient toute la base et toutes les photos.

## Accès libre au back-office (mode test)

Pour ouvrir le back-office **sans mot de passe**, tapez dans la console :

```
touch ~/application-camping-car/data/acces-libre
```

Pour **remettre le mot de passe**, supprimez ce fichier et choisissez vos identifiants :

```
rm ~/application-camping-car/data/acces-libre
cd ~/application-camping-car && node server/reset-admin.js votre@email.fr VotreMotDePasse
```

⚠️ En accès libre, toute personne qui connaît l'adresse `/admin/` peut modifier l'application et voir les clients. Réservez ce mode aux tests, sans vraies données clients.

## Recevoir un e-mail à chaque demande client

Le serveur a besoin d'une adresse e-mail pour envoyer les notifications.

1. Dans le panneau alwaysdata, menu **E-mails**, puis **Adresses**, cliquez sur **Ajouter une adresse**. Par exemple `notifications@appvdl.alwaysdata.net` (ou une adresse de votre domaine), avec un mot de passe.
2. Dans le back-office, ouvrez **Paramètres**, puis **Envoi des e-mails**, et remplissez :
   - Serveur SMTP : `smtp-appvdl.alwaysdata.net`
   - Port : `465`
   - Identifiant : l'adresse créée au point 1
   - Mot de passe : celui de cette adresse
   - Adresse d'expédition : `Compagnon de bord <l'adresse créée au point 1>`
3. Tapez votre adresse dans « Adresse pour un test », puis cliquez sur **Envoyer un e-mail de test**.
4. Dans **Concessions**, renseignez l'**e-mail** de chaque concession : c'est là que partent les nouvelles demandes.

Si le nom du serveur SMTP est différent, il s'affiche dans **E-mails** sur alwaysdata.
