# Compagnon de bord — notes pour le travail sur ce projet

Application pour camping-cars : appli client (PWA, `public/app`), back-office web (`public/admin`), relevé véhicule sur téléphone (`public/admin/releve`), serveur Node sans dépendance (`server/`). Hébergement : alwaysdata (compte appvdl).

## L'utilisateur

- Débutant en informatique : expliquer en français simple, sans jargon, avec les commandes exactes à copier.
- Après chaque changement poussé, lui donner la mise à jour : `cd ~/application-camping-car && git pull && echo OK`, puis **Web → Sites → Redémarrer** sur alwaysdata.

## Règles qu'il a fixées

- **VIN** : jamais stocké sur le serveur. Saisi à la mise en main, il reste sur le téléphone du client et part seulement dans l'e-mail d'une demande de pièce.
- **Immatriculation** : aucune, nulle part.
- **Équipements** : ne jamais pré-cocher d'équipements « de série ». C'est lui qui coche pour chaque véhicule (relevé).
- **Ensembles et éléments** : un équipement peut être un élément d'un ensemble (`grp`, `role` : toujours là / option / un seul au choix `pick`). Les éléments s'affichent sous leur ensemble (appli, plan, relevé) ; « toujours là » est coché avec l'ensemble. Dates à suivre (`dated` : date limite, fabrication + ans, ou tous les X mois) relevées par le client (`cdb_dates`) et rappelées dans le carnet. Liste validée : `server/equipment-groups.js` (doc : `docs/EQUIPEMENTS-ENSEMBLES.md`). Pas de date pour le GPL.
- **Plans** : dessinés dans notre style, jamais copiés des catalogues.
- **Diagnostics = solution magasin** : chaque fin de parcours met en avant un produit vendu en magasin d'accessoires de camping-car (produit spécialisé), jamais de remède maison (vinaigre, bicarbonate, savon, chiffon, ruban adhésif, « système D »). Pas de référence de pièce. « Aucun produit nécessaire » seulement si aucun produit n'a de sens.
- **Diagnostics en entonnoir** : d'abord le symptôme, puis des vérifications une par une, de la plus simple et la plus probable à la plus technique (« Faites ceci. Est-ce réglé ? »). Chaque vérification qui trouve la cause finit le parcours sur une seule cause ; l'atelier vient en dernier, quand rien n'a suffi. Briques : `server/diag-helpers.js` (`funnel`, `ask`, `buy`, `shop`).
- **Diagnostics et types** : une question dont l'appli connaît déjà la réponse (type de frigo, de pompe, gaz, batterie AGM/gel/lithium…) porte `vk`/`vv` et se répond toute seule ; un diagnostic propre à un type porte `vonly` ; une ligne de liste propre à un type porte `variant`. Le choix d'un ensemble « un seul au choix » vaut aussi comme type (entrée VARIANTS `pick`). Pour tout nouveau diagnostic, brancher ainsi ses questions de type (`server/diag-types.js`).
- **Pas de diagnostic groupe électrogène** (ne l'intéresse pas).
- **Conseils & Astuces** (ancien mini-jeu « Missions ») : astuces publiées depuis le back-office ou partagées par les clients, jamais publiées sans relecture (administrateur ou éditeur de contenu). « Le conseil d’expert » (ancien « conseil du magasin ») suit la règle solution magasin, sur un ton de conseil, jamais vendeur. La démo ne publie jamais d'astuce (elle serait visible des vrais clients).
- **Bandeaux « À la une »** : ciblés (concessions, type de véhicule, ancienneté, garantie, équipement, accord offres, dates). Ceux de la démo visent seulement les concessions de démo, jamais « toutes ».
- **Chat entre camping-caristes** : pas encore développé. L'onglet « Chat » du back-office (`public/admin/chat.js`, administrateur) montre seulement l'idée détaillée, à développer plus tard.
- Demandes : sous garantie ou extension → SAV ; hors garantie ou accessoire → magasin ; atelier (étanchéité, gaz…) → SAV. Un e-mail par service, pas d'e-mail aux commerciaux ni au responsable.

## Démo commerciale — à garder à jour

`server/demo.js` crée une démo réelle (3 concessions, équipes, clients, demandes) qui sert à **vendre l'application aux concessions**. Guide de présentation : `docs/DEMO-PRESENTATION.md`.

- **À chaque nouvelle fonctionnalité visible**, mettre à jour `server/demo.js` pour qu'elle apparaisse dans la démo (données d'exemple, nouveau rôle, nouveau type de demande…), puis `docs/DEMO-PRESENTATION.md` si le déroulé change.
- La démo ne doit jamais toucher aux vraies données : seulement les codes DEMONANT, DEMORENN, DEMOVANN et les comptes en `@demo.test` (pas DEMO2026, créée à l'installation).
- La vérifier après modification : `DATA_DIR=<dossier temporaire> node server/demo.js` doit finir sans erreur et afficher la bonne répartition des demandes.

## Sauvegardes

- Sauvegarde complète hebdomadaire (base + photos + clés) dans Paramètres → Sauvegardes ; mode d'emploi pour remettre le site en ligne : `docs/SAUVEGARDE-ET-RESTAURATION.md`.
- Versions figées du code (identifiants de commit, la session ne peut pas pousser de tag) : 9 octobre 2026 = `43636a525d`. En noter une nouvelle quand l'utilisateur demande de figer une version.

## Sécurité (audit du 9 octobre 2026 : `docs/AUDIT-SECURITE.md`)

- Tout texte venant d'un utilisateur s'affiche avec `esc()` ; toute donnée structurée (zones du plan, variantes…) est reconstruite champ par champ côté serveur.
- Corps de requête : 256 Ko sans session, 40 Mo seulement avec une session valide.
- Adresse du site dans les e-mails : `publicOrigin()` (jamais un en-tête inventé) ; `site_origin` enregistré après un bon mot de passe.
- Limites anti-abus par vraie adresse (`clientIp`) et par compte ou client.

## Vérifier avant de pousser

- `npm test` (il lance aussi `tools/check-equipment-links.js` : aucun diagnostic, ligne de liste, motif ou entretien ne doit viser un équipement que personne ne peut cocher ; à relancer après tout retrait ou regroupement d'équipements).
- Pour l'interface : lancer le serveur (`DATA_DIR=… PORT=3997 ADMIN_EMAIL=… ADMIN_PASSWORD=… node server/index.js`) et passer dans un navigateur (Playwright).
- Branche de travail : `claude/app-vehicles-cloud-backoffice-gaifle`.
