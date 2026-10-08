# Catalogues 2026-2027 : modèles, plans et équipements

Sources : catalogues Challenger 2027, Randger 2026 et Rimor 2026-27 fournis par la concession. Les implantations ont été décrites en mots puis redessinées avec nos plans schématiques (aucun plan des catalogues n’est repris). Les données détaillées extraites sont dans `docs/catalogues-2026/*.json`.

## Comment l’appli s’en sert

- Dans le relevé, étape « Ce qu’il y a dedans » : taper le modèle (« V114 », « R602 », « Kilig 669 ») ou quelques mots (« lit relevable, garage haut ») propose le bon plan. Si le nom du véhicule contient un modèle connu, le plan est proposé tout seul.
- 25 plans (implantations) : `tools/make-plans.js`. Recherche : `server/layouts.js`. Correspondance modèle → plan : `server/seed/models.json`.
- 25 équipements ajoutés au catalogue (frein de stationnement électrique, aides à la conduite, Traction+, PTAC alourdi et permis C1, pneus 3PMSF, application du véhicule, table réglable, lit arrière réglable en hauteur, lits jumeaux de pavillon, toit panoramique, trappe vers le garage, anneaux d’arrimage, cuisine en L, salle d’eau toute largeur, caillebotis, gestionnaire d’énergie…).

## Modèle → plan

| Marque | Modèle | Type | Plan |
|---|---|---|---|
| Challenger | V114S | Van | Lit transversal arrière |
| Challenger | V114 | Fourgon aménagé | Lit transversal arrière |
| Challenger | V114M | Fourgon aménagé | Lits superposés arrière |
| Challenger | V210 | Fourgon aménagé | Lit relevable et garage haut |
| Challenger | V217 | Fourgon aménagé | Lits jumeaux arrière |
| Challenger | S217 | Profilé | Lits jumeaux et garage |
| Challenger | S194 | Profilé | Lit transversal et garage |
| Challenger | S294 | Profilé | Lit transversal et garage |
| Challenger | X150 | Profilé compact | Salle d’eau et penderie arrière, lit de pavillon |
| Challenger | X260 | Profilé compact | Salle d’eau et penderie arrière, lit de pavillon |
| Challenger | 250 | Profilé compact | Salle d’eau et penderie arrière, lit de pavillon |
| Challenger | 240 | Profilé | Salle d’eau et dressing arrière, lit de pavillon |
| Challenger | 260 | Profilé | Salle d’eau et dressing arrière, lit de pavillon |
| Challenger | 270 | Profilé | Salle d’eau et dressing arrière, lit de pavillon |
| Challenger | 380 | Profilé | Lits superposés arrière |
| Challenger | 287 | Profilé | Lits jumeaux et garage |
| Challenger | 337 | Profilé | Lits jumeaux et garage |
| Challenger | 328 | Profilé | Lit central et garage |
| Challenger | 318 | Profilé | Lit central et garage |
| Challenger | C194 | Capucine | Lit transversal, garage et capucine |
| Challenger | C256 | Capucine | Lits superposés et capucine |
| Challenger | C387 | Capucine | Lits jumeaux, garage et capucine |
| Challenger | 3057 | Intégral | Lits jumeaux et garage |
| Challenger | 3048 | Intégral | Lit central et garage |
| Randger | R490 | Van | Toit relevable et banquette-lit |
| Randger | R540 | Van | Lit transversal arrière |
| Randger | R550 | Van | Lit de pavillon, cuisine et salle d’eau arrière |
| Randger | R555 | Fourgon aménagé | Lit transversal et lit de pavillon |
| Randger | R600 | Fourgon aménagé | Lits superposés arrière |
| Randger | R602 | Fourgon aménagé | Lit transversal arrière |
| Randger | R635 | Fourgon aménagé | Grand lit longitudinal et garage |
| Randger | R640 | Fourgon aménagé | Lits jumeaux arrière |
| Randger | R560 4x4 | Fourgon aménagé | Lit transversal arrière |
| Randger | R560 | Fourgon aménagé | Lit transversal arrière |
| Rimor | Horus 38 | Fourgon aménagé | Lit relevable et garage haut |
| Rimor | Horus 45 | Fourgon aménagé | Lits superposés arrière |
| Rimor | Horus 54 | Van | Lit transversal arrière |
| Rimor | Horus 95 | Fourgon aménagé | Lits jumeaux arrière |
| Rimor | Kilig 5 | Capucine | Lit transversal, garage et capucine |
| Rimor | Kilig 9 | Capucine | Lits superposés et capucine |
| Rimor | Kilig 50 | Capucine | Salle d’eau arrière et couchettes superposées |
| Rimor | Kilig 669 | Capucine | Lit central, garage et capucine |
| Rimor | Kilig 695 | Capucine | Lits jumeaux, garage et capucine |
| Rimor | Kilig 55 Plus | Profilé | Lit transversal et garage |
| Rimor | Kilig 56 Plus | Profilé compact | Cuisine arrière et lit de pavillon |
| Rimor | Kilig 66 Plus | Profilé | Lit central et garage |
| Rimor | Kilig 67 Plus | Profilé compact | Salle d’eau et penderie arrière, lit de pavillon |
| Rimor | Kilig 69 Plus | Profilé | Lit central et garage |
| Rimor | Kilig 73 Plus | Profilé | Lits superposés arrière |
| Rimor | Kilig 77 Plus | Profilé compact | Salon arrière et lit de pavillon |
| Rimor | Kilig 78 Plus | Profilé | Lit transversal et garage |
| Rimor | Kilig 79 Plus | Profilé | Lits superposés arrière |
| Rimor | Kilig 95 Plus | Profilé | Lits jumeaux et garage |
| Rimor | Kilig 99 Plus | Profilé | Lits jumeaux et garage |
| Rimor | Sarus 50 | Capucine | Salle d’eau arrière et couchettes superposées |
| Rimor | Sarus 695 | Capucine | Lits jumeaux, garage et capucine |
| Rimor | Sarus 66 Plus | Profilé | Lit central et garage |
| Rimor | Sarus 69 Plus | Profilé | Lit central et garage |
| Rimor | Sarus 95 Plus | Profilé | Lits jumeaux et garage |
| Rimor | Sarus 96 Plus | Profilé | Lits jumeaux et garage |

## À vérifier

- Challenger : le catalogue ne donne ni hauteurs, ni PTAC, ni couchages par modèle (ils sont sur le site). Plans F&S et 380 peu lisibles.
- Randger : puissance des panneaux solaires non indiquée ; R550 (5,48 m) classé Van, R560 (5,98 m) classé Fourgon.
- Rimor : le chauffage « Combi C4 » est supposé être un Truma Combi 4 ; le Kilig 67 Plus (grand rangement arrière, sans lit fixe) est rapproché du plan « salle d’eau et penderie arrière ».
- Les profilés slim Challenger (S217, S194, S294) ont un lit fixe : ils sont classés Profilé, pas Profilé compact.
