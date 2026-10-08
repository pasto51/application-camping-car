# Simulations de pannes : rapport du 8 octobre 2026

## Méthode

**500 simulations jouées dans la vraie application** (navigateur, outil `tools/simulate-diagnostics.js`).

Pour chaque simulation :
1. On tire au hasard une panne réelle, c'est-à-dire une fin de parcours d'un diagnostic. La moitié des tirages est répartie entre les diagnostics, l'autre moitié entre les fins de parcours. Une simulation sur 25 porte sur les diagnostics « par élimination ».
2. Le véhicule simulé a les types d'équipements qui correspondent à cette panne, par exemple un frigo trimixte pour une panne au gaz. L'appli saute donc d'elle-même les questions déjà connues.
3. Le client décrit son souci avec ses mots, dans la recherche.
4. Il répond à chaque question comme le ferait le propriétaire de ce véhicule en panne.
5. On compare la conclusion affichée à la panne tirée. Une fois sur dix, on envoie aussi la demande de rendez-vous à la concession.

Les 56 diagnostics ont été couverts. Un parcours compte en moyenne 3,4 questions, et jusqu'à 8.

**Contrôle des 2 015 fins de parcours** (outil `tools/check-diagnostics.js`), selon les règles du dossier (`check.js`, `chk_cause.js`, `DECISIONS_ET_REGLES.md`) :
- une seule cause par fin de parcours ;
- phrase de sécurité pour le gaz, la fumée et le monoxyde de carbone ;
- pas de démontage demandé au client ;
- vocabulaire imposé ;
- cohérence entre la dernière vérification et la conclusion ;
- renvoi vers l'atelier quand rien n'a marché.

Les 95 alertes ont été relues une par une, ainsi qu'un échantillon de parcours complets.

## Résultats

| Contrôle | Résultat |
|---|---|
| Parcours qui aboutissent à la bonne conclusion | **500 / 500** |
| Diagnostics par élimination (plus d'eau, antenne manuelle) | 20 / 20 |
| Demandes de rendez-vous envoyées depuis une conclusion | **50 / 50** (après correction, voir plus bas) |
| Erreurs de l'application pendant les parcours | 0 |
| Recherche : bon diagnostic proposé en 1er (76 phrases réalistes de clients) | **69 / 76** (52 avant correction) |
| Recherche : bon diagnostic dans les 3 premiers (76 phrases réalistes) | **75 / 76** (68 avant correction) |
| Recherche : urgences (odeur de gaz, brûlé, ammoniac) proposées en 1er | **toutes** (« odeur de gaz » était en 3ᵉ à 7ᵉ position avant) |

## Corrigé

1. **Rendez-vous depuis un diagnostic** : 917 fins de parcours proposent un rendez-vous « atelier », qui ne figurait pas dans la liste des motifs. L'envoi de la demande plantait. Ces rendez-vous ouvrent maintenant le motif « J'ai un souci », avec la cause pré-remplie dans le message.
2. **Recherche** : un mot présent dans presque tous les diagnostics (« gaz », « eau ») comptait autant qu'un mot précis. Il compte désormais moins qu'un mot rare. Les premières réponses de chaque organigramme, qui sont les mots du client, servent aussi de mots-clés. Une urgence qui correspond à la description passe en tête.
3. **Truma, ventouse encombrée** (gaz brûlés) : ajout de la phrase de sécurité « Odeur de gaz, fumée ou suie : coupez, aérez et appelez un professionnel. »
4. **Fuite d'eau** : « Un collier était desserré » devient « Un raccord était desserré », pour correspondre à la vérification demandée.

Les corrections 3 et 4 s'appliquent une seule fois au démarrage du serveur, et seulement si le texte n'a pas été modifié entre-temps dans le back-office.

## À valider avec un technicien

| Diagnostic | Parcours | Question |
|---|---|---|
| Plus de gaz (`nogas`) | Détendeur resserré à la main → « Oui, c'est réglé » | La fin affiche aussi « À faire faire par un professionnel ». Le garder (contrôle de la fuite) ou le retirer ? |
| Bouteille / détendeur (`h_gaz`) | Odeur légère après un changement de bouteille → raccord revissé → réglé | Déjà signalé dans `A_VALIDER_ET_A_FAIRE.md`. Ajouter une phrase de sécurité, ou envoyer vers l'atelier ? |
| Frigo, panneau éteint ou code 12 V (`h_frigo`, 6 fins) | Coupe-circuit enclenché → « batterie trop déchargée » | La conclusion arrive sans vérifier la tension. Ajouter une question « Le panneau indique-t-il moins de 12 V ? » |
| Frigo, groupe électrogène (`h_frigo`) | Dernier « Non, rien ne change » | Pas de renvoi vers l'atelier : normal ? |

## Fausses alertes écartées
- **« Plusieurs causes »** : la règle de `chk_cause.js` repère les virgules et les « ou ». Les 13 cas relevés ne contiennent qu'une seule cause.
- **« Démontage demandé »** : les 10 gestes concernés précisent justement « sans rien démonter ».
- **« La cause ne reprend pas la vérification »** : par exemple, « Coupez le 12 V une minute… est-ce reparti ? Oui » mène à « L'électronique s'était bloquée de façon passagère ». C'est cohérent.

## Relancer les simulations

```bash
npm start                                    # dans un autre terminal
BASE=http://localhost:3000 N=500 node tools/simulate-diagnostics.js
node tools/check-diagnostics.js server/seed/compagnon.json alertes.json
```
