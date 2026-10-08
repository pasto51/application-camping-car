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
   - **Mon espace client** : ses infos, sa garantie, son code, ses notifications, l'export ou la suppression de ses données (RGPD).
2. **La concession, sur le PC**
   - **Responsable** : tableau de bord, toutes les demandes, les clients par commercial, la fiche de la concession et son équipe.
   - **SAV** puis **Magasin** : chacun traite ses demandes, répond et transfère à l'autre service avec un motif.
   - **Commercial** (Julien) : ses clients et le récap de leurs demandes, sans e-mails inutiles.
   - Fiche client : **Modifier la garantie**, renvoyer le code d'accès.
   - **Statistiques** (compte `analyste@demo.test`, ou le responsable pour sa concession) : ce que les clients cherchent, la saisonnalité (buée et froid l'hiver, chaleur l'été), les produits conseillés et demandés, et des **idées de campagne** calculées toutes seules.
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
