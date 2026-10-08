# Compagnon de bord — dossier développeur

Application d'accompagnement pour propriétaires de camping-cars (mise en main, entretien, diagnostic de pannes). Elle est conçue pour être vendue par les concessionnaires : le concessionnaire paie, il remet au client un code à usage unique qui donne 2 ans d'accès, puis environ 20 € pour continuer.

Version livrée : V48 (8 octobre 2026). Véhicule de démonstration : Challenger V114 Road Edition 2027.

## Contenu du dossier

| Dossier | Contenu |
|---|---|
| `01_application/` | `compagnon-de-bord.html` : l'application complète, un seul fichier (HTML, CSS et JavaScript sans bibliothèque, photos intégrées). Elle s'ouvre directement dans un navigateur. |
| `02_donnees/` | Les données de l'appli, extraites en JSON pour pouvoir les séparer du code : équipements, diagnostics, configuration, photos. |
| `03_diagnostics_sources/` | Les fichiers sources des diagnostics (format `put/Q/L`) et les deux scripts de contrôle. |
| `DECISIONS_ET_REGLES.md` | Décisions produit, vocabulaire imposé, retours clients. À lire avant de toucher au contenu. |
| `A_VALIDER_ET_A_FAIRE.md` | Ce qui est factice (démo), à valider avec un technicien, ou pas encore fait. |

## Écrans de l'application

1. **Accueil** : photo du véhicule (modifiable), dimensions, poids et charge, accès aux autres écrans.
2. **Gestes** (`daily`) : listes Arrivée, Départ, Entretien avec rappels (démo).
3. **C'est quoi, ça ?** (`what`) : plan du V114 vu du dessus avec 10 zones numérotées ; chaque équipement a sa fiche et sa photo.
4. **Mes équipements** (`equip`) : cases à cocher par rubrique ; le client peut ajouter son propre équipement et sa photo.
5. **Poids et charge** (`weight`) : calcul PTAC et charge utile avec les accessoires.
6. **J'ai un souci** (`diag`) : diagnostic guidé (voir plus bas).
7. **Rendez-vous atelier** (`rdv`) : motifs de rendez-vous préremplis par le diagnostic.
8. **Espace concession** (`hand`) : liste de contrôle de la livraison et génération du code client (démo).
9. **Jeu du voyage** (`game`) : mission ludique d'accueil.

## Architecture technique

- Une seule page, JavaScript « vanilla » dans une fonction auto-appelée. Pas de framework, pas de serveur, pas d'appel réseau.
- Les données sont dans le code, en tableaux et objets (`EQUIP`, `SOUCIS`, `VARIANTS`, `LISTS`, `MOTIFS`, `SPOTS`…). Elles sont exportées dans `02_donnees/` : c'est la base d'un futur back-office.
- Stockage côté client uniquement (`localStorage`, par navigateur) :

| Clé | Rôle |
|---|---|
| `cdb_own` | équipements cochés |
| `cdb_ueq` | équipements ajoutés par le client |
| `cdb_uph` | photos du client (JPEG redimensionné à 1000 px, en base64) |
| `cdb_var` | variantes choisies (type de frigo, de chauffage, de toilettes…) |
| `cdb_mod` | modèles et numéros de série notés par le client |
| `cdb_dim` | mesures des accessoires (hauteur, dépassement) |
| `cdb_wt` | poids saisis |
| `cdb_photo` | photo du véhicule |
| `cdb_hand` | avancement de l'espace concession |

- Les photos du V114 (54 images) sont intégrées en base64 dans le fichier. Elles sont aussi fournies en JPEG dans `02_donnees/photos/`, avec `photos_par_equipement.json` (identifiant d'équipement vers fichier).

## Le catalogue d'équipements (`02_donnees/equipements.json`)

122 équipements : `id`, rubrique (`cat`), nom, `base` (de série oui/non), zone du plan (`spot`), texte, conseil, mots-clés.

- **Équipements implicites** : cocher un équipement coche d'office ses éléments (toilettes → vanne de vidange et bouton de chasse ; douche → lavabo, siphon, colonne, évacuation, aérateur ; marchepied extérieur → bouton de commande ; un chauffage → commande, sorties d'air chaud ; etc.). Table `IMPL` dans `configuration.json`. Les éléments implicites sont masqués de la liste, sauf `marche` et `bouteille` qui portent un choix de type.
- **Variantes** (`VARIANTS`) : le client précise le type d'un équipement (frigo trimixte ou à compression, chauffage gaz / diesel / Alde, cassette Thetford / Dometic…). L'appli saute alors les questions déjà connues dans le diagnostic. Le type de chauffage et de chauffe-eau se déduit de l'appareil choisi (`APP_VARS`).
- **Alias** (`OWN_ALIAS`) et équipement masqué (`HIDDEN_EQ`) : le frigo à compression n'est plus une case séparée.

## Le diagnostic (`02_donnees/diagnostics.json`)

### Principe
Le client décrit son souci avec ses mots (« mon frigo ne fait plus de froid »). L'appli le fait ensuite **vérifier tout ce qu'il peut vérifier, étape par étape**, du plus simple au plus rare. Chaque vérification est une question : « Vérifiez X : est-ce réglé ? » Si oui, la fin du parcours nomme **une seule cause** et donne le geste à retenir. Si non, on passe à la vérification suivante. Quand le client a tout essayé : **« Allez à l'atelier »**, avec le récapitulatif et un rendez-vous préparé. Tout ce qui touche au gaz, au 230 V, à une carte électronique ou à un démontage n'est jamais demandé au client : il mène directement à l'atelier.

### Chiffres
- 56 entrées de premier niveau, environ 2 013 fins de parcours (plus 2 diagnostics au modèle « élimination » : `nowater` et `antman`).
- 19 entrées regroupées par appareil, préfixes `h_` (frigo, toilettes, pompe, antenne satellite, clim, lithium, solaire, batterie, vélo électrique, store, infiltration d'eau, suspensions, télé, GPS, gaz) et `g_` (Truma gaz, Truma Diesel, Webasto/Eberspächer, EFOY). Ces entrées sont **construites au chargement** à partir des diagnostics fins ; le détail est dans `diagnostics.json` (arbre complet) et `03_diagnostics_sources/` (sources fines).
- `diagnostics_liste.csv` : liste à plat (identifiant, rubrique, équipement, titre, nombre de fins).

### Structure d'un diagnostic
```
{ id, cat, label, eq, kw, urgent?, vonly?, tree }
tree = question { t, o:[réponses], n:[suites] }  ou  fin { cause, geste, prod, sec?, pro?, rdv?, cx? }
```
- `cat` : eau, elec, gaz, chauf, frigo, wc, hum, ext.
- `eq` : identifiant d'équipement. Un diagnostic n'est proposé en premier que si l'équipement est dans le véhicule du client ; sinon il apparaît dans « Autres équipements (pas dans mon véhicule) ».
- `vonly` : [équipement, [variantes]] pour n'afficher que la variante concernée.
- `urgent` : danger (odeur de gaz, ammoniac…) : toujours affiché en tête.
- Fin : `cause` (une seule), `geste`, `prod` (produit en rayon ou « atelier »), `sec` (phrase de sécurité), `pro` (à faire faire par un professionnel), `rdv` (motif de rendez-vous : atelier, etanch, revision).
- Recherche : texte libre normalisé (accents, pluriels) sur `label` + `kw` + synonymes (`SYN`), avec bonus aux mots exacts et à la pertinence vis-à-vis des équipements du client.

### Contrôle qualité des sources
`03_diagnostics_sources/check.js fichier.js` valide le format (rubriques, équipements, motifs de rendez-vous, mots interdits, références de pièces). `chk_cause.js` signale toute fin qui énumère plusieurs causes. Les deux doivent afficher OK / rien.

## Pour lancer
Ouvrir `01_application/compagnon-de-bord.html` dans un navigateur (mobile ou ordinateur, largeur 400 px de référence).

## Pistes pour la suite
1. Séparer les données du code : charger `equipements.json` et `diagnostics.json` depuis un back-office.
2. Gestion des codes d'accès (1 code = 1 véhicule, 2 ans) et du renouvellement.
3. Comptes concessionnaires, personnalisation (nom, téléphone, horaires, logo) : aujourd'hui `DEALER` est un exemple.
4. Rendez-vous atelier réels (aujourd'hui, l'appli prépare le motif, mais n'envoie rien).
5. Notifications de rappel (aujourd'hui simulées).
6. Sauvegarde du compte du client (aujourd'hui, tout reste sur son téléphone).
