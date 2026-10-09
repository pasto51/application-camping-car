# Compagnon de bord — notes pour le travail sur ce projet

Application pour camping-cars : appli client (PWA, `public/app`), back-office web (`public/admin`), relevé véhicule sur téléphone (`public/admin/releve`), serveur Node sans dépendance (`server/`). Hébergement : alwaysdata (compte appvdl).

## L'utilisateur

- Débutant en informatique : expliquer en français simple, sans jargon, avec les commandes exactes à copier.
- Après chaque changement poussé, lui donner la mise à jour : `cd ~/application-camping-car && git pull && echo OK`, puis **Web → Sites → Redémarrer** sur alwaysdata.

## Règles qu'il a fixées

- **VIN** : jamais stocké sur le serveur. Saisi à la mise en main, il reste sur le téléphone du client et part seulement dans l'e-mail d'une demande de pièce.
- **Immatriculation** : aucune, nulle part.
- **Équipements** : ne jamais pré-cocher d'équipements « de série ». C'est lui qui coche pour chaque véhicule (relevé).
- **Plans** : dessinés dans notre style, jamais copiés des catalogues.
- **Diagnostics = solution magasin** : chaque fin de parcours met en avant un produit vendu en magasin d'accessoires de camping-car (produit spécialisé), jamais de remède maison (vinaigre, bicarbonate, savon, chiffon, ruban adhésif, « système D »). Pas de référence de pièce. « Aucun produit nécessaire » seulement si aucun produit n'a de sens.
- **Pas de diagnostic groupe électrogène** (ne l'intéresse pas).
- **Conseils & Astuces** (ancien mini-jeu « Missions ») : astuces publiées depuis le back-office ou partagées par les clients, jamais publiées sans relecture (administrateur ou éditeur de contenu). « Le conseil du magasin » suit la règle solution magasin. La démo ne publie jamais d'astuce (elle serait visible des vrais clients).
- Demandes : sous garantie ou extension → SAV ; hors garantie ou accessoire → magasin ; atelier (étanchéité, gaz…) → SAV. Un e-mail par service, pas d'e-mail aux commerciaux ni au responsable.

## Démo commerciale — à garder à jour

`server/demo.js` crée une démo réelle (3 concessions, équipes, clients, demandes) qui sert à **vendre l'application aux concessions**. Guide de présentation : `docs/DEMO-PRESENTATION.md`.

- **À chaque nouvelle fonctionnalité visible**, mettre à jour `server/demo.js` pour qu'elle apparaisse dans la démo (données d'exemple, nouveau rôle, nouveau type de demande…), puis `docs/DEMO-PRESENTATION.md` si le déroulé change.
- La démo ne doit jamais toucher aux vraies données : seulement les codes DEMONANT, DEMORENN, DEMOVANN et les comptes en `@demo.test` (pas DEMO2026, créée à l'installation).
- La vérifier après modification : `DATA_DIR=<dossier temporaire> node server/demo.js` doit finir sans erreur et afficher la bonne répartition des demandes.

## Vérifier avant de pousser

- `npm test`.
- Pour l'interface : lancer le serveur (`DATA_DIR=… PORT=3997 ADMIN_EMAIL=… ADMIN_PASSWORD=… node server/index.js`) et passer dans un navigateur (Playwright).
- Branche de travail : `claude/app-vehicles-cloud-backoffice-gaifle`.
