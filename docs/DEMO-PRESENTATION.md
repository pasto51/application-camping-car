# Démo commerciale — présenter Compagnon de bord à une concession

La démo crée sur le site de vraies concessions, équipes, clients et demandes, tous marqués « DÉMO ».
On s'en sert pour présenter l'application à un prospect, depuis un PC (back-office) et un téléphone (appli client).

## Avant le rendez-vous (5 minutes)

Dans le terminal alwaysdata :

```bash
cd ~/application-camping-car && git pull
node server/demo.js --nom "Nom de la concession du prospect" votre@gmail.com
```

- `--nom` : la première concession porte le nom du prospect (« DÉMO – Camping-Cars Dupont »). Facultatif.
- L'adresse e-mail : les e-mails de la démo arrivent chez vous (`votre+sav-nantes@gmail.com`…). Facultatif.
- La commande affiche tous les accès : **gardez-les** (copier-coller dans une note).
- `node server/demo.js --stats` refait seulement les statistiques de test (12 mois), sans changer les clients ni leurs codes.
- Relancer la commande recrée une démo propre (les essais du rendez-vous précédent disparaissent).

Préparez :
- **PC** : le back-office ouvert avec le compte du **responsable** de la première concession.
- **Téléphone** : le lien de **Paul Morel** (sous garantie, une réponse du SAV l'attend). Ajoutez l'appli à l'écran d'accueil.
- Une **fenêtre de navigation privée** pour changer de compte du back-office sans vous déconnecter.

Mot de passe de tous les comptes démo : `demo1234`. Les liens clients ne servent qu'une fois. Ensuite, on passe par « J'ai déjà un compte » avec le nom et le code affichés.

## Déroulé conseillé (15 minutes)

1. **Le client, sur le téléphone (Paul Morel)**
   - Accueil : son véhicule, son plan, le SAV et le Magasin de **sa** concession, chacun avec « Appeler » et « Écrire » ; un espace client simple, en gros caractères.
   - « La concession vous a répondu » : il lit la réponse du SAV et répond.
   - **Diagnostic** : une panne guidée pas à pas, le client teste pièce par pièce (ex. « Mon store s'ouvre un peu en roulant », « Mon porte-vélos bouge en roulant »).
   - **Confort = vente** : « J'ai de la buée sur le pare-brise », « Ma batterie ne tient pas deux jours », « Mon camping-car balance en virage », « Je ne sais jamais si mes pneus sont bien gonflés », « Monter dans la cellule est difficile »… (41 situations) l'appli conseille le produit (isolant extérieur, lithium ou solaire, suspensions pneumatiques, capteurs de pression, marchepied électrique) et « Demander au magasin » envoie la demande au magasin.
   - **🛒 Demander une pièce** : photo, modèle, référence. Sous garantie, la demande part **au SAV** ; hors garantie, **au magasin**.
   - **À la une** : le bandeau de l'accueil, **ciblé** par la concession dans le back-office. Paul (Nantes) voit « Portes ouvertes samedi », Nadia (livrée il y a peu) « Bienvenue à bord », Bernard (hors garantie) « Votre garantie se termine », les autres « Avant l'hiver ».
   - **💡 Conseils & Astuces** : les bons gestes en fiches courtes, par thème (eau, énergie, gaz, hiver…), chacune avec **« Le conseil du magasin »** et « Demander au magasin ». En bas, **« Partager mon astuce »** : le client envoie la sienne (avec photo), la concession la relit avant publication.
   - **Gestes du quotidien** : un menu en deux parties. **Sur la route** : Arrivée et Départ, avec le choix **camping ou aire de service / stationnement libre** (en stationnement libre : rien ne dépasse, rien ne coule, durée limitée) ; elles se décochent toutes seules le lendemain. **Saisons et entretien** : Hivernage, Remise en route et Chaque mois, avec un rappel sur le téléphone les bons mois (réglable dans Contenus de l'appli, comme le temps avant que chaque liste se décoche). Les lignes s'adaptent au véhicule (batterie classique ou lithium, frigo à absorption).
   - **📒 Carnet d'entretien**, juste sous le poids, avec une **pastille rouge** quand quelque chose est à faire (test d'étanchéité, révision, hivernage, frigo, chauffe-eau, batteries…) : « Prendre rendez-vous » en un geste, ou « C'est fait ». Le client y note ce qui est fait, l'appli calcule les prochaines dates. Rappel sur le téléphone 15 jours avant.
   - **🔔 Notifications** (administrateur) : choisir un thème (portes ouvertes, conférence, atelier, promotion, entretien, hivernage…), le message, ce qui s'ouvre au toucher, les clients visés (mêmes filtres que « À la une »), maintenant ou à une date. Ensuite : combien l'ont reçue et ouverte. La démo en montre une envoyée (portes ouvertes à Nantes) et une programmée (hivernage).
   - **❓ et 🐞** : le « ? » en haut de l’appli ouvre la vidéo de prise en main (lien réglé dans Paramètres) ; en bas de l’accueil, « Signaler un problème » arrive chez l’administrateur (rubrique Bugs signalés) et par e-mail. Les mêmes boutons sont en bas du menu du back-office.
   - **Petit nom du véhicule** : sous la photo, « Donner un petit nom à mon véhicule ». Le nom s'affiche en grand à l'accueil, le modèle juste en dessous ; la concession le voit dans la fiche client. Ouvrir l'appli d'**Isabelle Roux** : son véhicule s'appelle « Le Baroudeur ».
   - **⚖️ Poids du véhicule**, bien visible sur l'accueil : charge restante, vert / orange / rouge. **Ce que j'emporte** : comme le petit cahier de certains clients, il note une fois le poids de ses affaires (vélos, valises, réserves…) et coche avant chaque départ ce qu'il emporte ; l'appli fait le calcul. Ouvrir l'appli d'**Isabelle Roux** : 2 vélos électriques et le plein d'eau, il reste peu de marge.
   - **Mon espace client** : ses infos, sa garantie, son code, ses notifications, son accord pour les **conseils et offres**, l'export ou la suppression de ses données (RGPD).
2. **La concession, sur le PC**
   - **Tableau de bord** : chaque compte (responsable, commercial, SAV, magasin, éditeur, analyste) trouve un guide « Où trouver quoi » adapté à son rôle. Montrez-le en premier : la prise en main est immédiate.
   - **Responsable** : tableau de bord, toutes les demandes, les clients par commercial, la fiche de la concession et son équipe.
   - **SAV** puis **Magasin** : chacun traite ses demandes, répond et transfère à l'autre service avec un motif. Une demande **sans réponse depuis plus de 48 h** est signalée (⏰ tuile et filtre) et rappelée chaque jour par e-mail au service (ex. SAV de Rennes).
   - **Commercial** (Julien) : ses clients et le récap de leurs demandes, sans e-mails inutiles.
   - Fiche client : **Modifier la garantie**, renvoyer le code d'accès, l'**entretien** (échéances et carnet du client), son accord pour les conseils et offres.
   - **Statistiques** (compte `analyste@demo.test`, ou le responsable pour sa concession) : ce que les clients cherchent, la saisonnalité (buée et froid l'hiver, chaleur l'été), les produits conseillés et demandés, et des **idées de campagne** calculées toutes seules. Pour un **groupement de concessions** : `analyste.ouest@demo.test` ne voit que Nantes et Rennes.
   - **📣 À la une** (compte `responsable.nantes@demo.test` ou `editeur@demo.test`) : chaque bandeau a son public (concessions, type de véhicule, ancienneté, garantie, avec ou sans certains équipements — ex. « Opération clim » pour ceux qui n'ont pas de clim —, accord pour les offres) et ses dates, avec le **nombre de clients concernés**. Le responsable crée les bandeaux de sa concession (portes ouvertes), l'éditeur ceux de tout le réseau.
   - **Conseils & Astuces** (compte `editeur@demo.test`) : 2 astuces de clients **à valider** (pastille rouge) : « Publier », « Corriger puis publier » ou « Refuser ». Ne publiez pas les astuces de démo : elles apparaîtraient chez les vrais clients. Les statistiques montrent aussi les **astuces les plus lues**.
   - **Contenus de l'appli** (compte `editeur@demo.test`) : tout se règle sans informaticien. Ex. : ajouter un entretien « Contrôle de la clim » chaque année en mai, seulement pour les clients qui ont une clim. Ne l'enregistrez pas pendant une démo sur le vrai site : le carnet d'entretien est commun à tous les clients.
3. **Les arguments à montrer**
   - **Magasin détaché** (concession de Rennes) : il ne voit que ses demandes et pas les clients de la concession ; la concession ne voit pas ses demandes.
   - **Garantie** : la demande va automatiquement au bon service.
   - **Données sensibles** : le VIN reste sur le téléphone du client, aucune immatriculation n'est enregistrée.
   - **Mise en main** : le commercial crée le compte du client depuis son téléphone avec le code concession.

## Après le rendez-vous

```bash
node server/demo.js --supprimer
```

Efface la démo (les vraies concessions, la concession DEMO2026 et les vrais clients ne sont pas touchés).

## Ce que contient la démo

| Concession | Particularité | Clients |
|---|---|---|
| Nantes (ou le nom du prospect) | SAV et magasin sur place | Paul (sous garantie), Martine (hors garantie), Henri (extension), Nadia (livrée il y a 12 jours) |
| Rennes | Magasin **détaché**, garantie 3 ans | Isabelle (sous garantie), Bernard (hors garantie), Élodie (sans commercial) |
| Vannes | Pas d'e-mail SAV ni magasin : tout part à l'e-mail général | Yves (hors garantie), Anne (sous garantie) |

Équipes : responsable, commerciaux, SAV, magasin, plus une éditrice de contenu sans concession.
