'use strict';

// Problems reported by customers of the dealership (October 2026): key and lock cylinder (Zadi), pleated blinds and fly
// screens (cord, rollers and hooks), absorption fridge that frosts or does not cool enough, water leaks (FrostControl).
// Written from the manufacturers' instructions and camping-car forums; each end point names a product sold in a
// camping-car accessory store (« achat »), or sends to the workshop when the customer must not do it alone.

const buy = (cause, geste, prod, sec = null) => ({ cause, geste, prod, sec, achat: true });
const shop = (cause, geste, prod, sec = null, rdv = 'atelier') => ({ cause, geste, prod, sec, rdv, pro: true });

const CLIENTS_2026_10 = [
  {
    id: 'p_serrure',
    cat: 'ext',
    label: 'Ma clé coince, est cassée ou perdue (porte de cellule, soutes)',
    kw: 'clé cle barillet serrure zadi porte cellule soute coffre coince grippe dure bloque cassée casse perdue perdu double extracteur extraction rouge vert haute sécurité tourne dans le vide',
    tree: {
      t: 'Que se passe-t-il ?',
      o: [
        'La clé entre mais tourne difficilement ou se bloque',
        'La clé est cassée',
        'J’ai perdu une clé ou je veux un double',
        'La clé tourne dans le vide et la porte ne s’ouvre pas',
        'Je veux une seule clé pour toutes les serrures',
      ],
      n: [
        {
          t: 'Avez-vous déjà mis un lubrifiant spécial serrure dans le barillet ?',
          o: ['Non, jamais', 'Oui, et ça coince encore'],
          n: [
            buy(
              'Le barillet est encrassé par la poussière et l’humidité.',
              'Pulvérisez un lubrifiant spécial serrures dans le barillet, puis faites jouer la clé une dizaine de fois. N’utilisez pas d’huile ordinaire : elle colle la poussière et finit par bloquer la serrure.',
              'Lubrifiant spécial serrures et barillets'
            ),
            {
              t: 'Votre barillet Zadi est-il un modèle standard ou haute sécurité ? (le magasin les distingue par leur couleur : rouge pour le standard, vert pour la haute sécurité)',
              o: ['Standard (rouge)', 'Haute sécurité (vert)', 'Je ne sais pas'],
              n: [
                buy(
                  'Le barillet standard est usé.',
                  'Serrure déverrouillée, le barillet se retire avec la clé d’extraction qui correspond à sa série, et un barillet neuf se met à la place, livré avec ses deux clés. La clé d’extraction ne marche que serrure ouverte : elle n’ouvre pas une serrure fermée.',
                  'Barillet Zadi standard avec 2 clés et clé d’extraction'
                ),
                buy(
                  'Le barillet haute sécurité est usé.',
                  'Serrure déverrouillée, le barillet se retire avec la clé d’extraction qui correspond à sa série, puis un barillet haute sécurité neuf se met à la place. Demandez au magasin la clé d’extraction qui va avec votre barillet.',
                  'Barillet Zadi haute sécurité avec 2 clés et clé d’extraction'
                ),
                buy(
                  'Le modèle du barillet n’est pas identifié.',
                  'Apportez une clé et une photo de la serrure au magasin : il reconnaît le modèle (standard ou haute sécurité) et vous donne le barillet et la clé d’extraction qui vont ensemble.',
                  'Barillet Zadi du bon modèle avec ses clés'
                ),
              ],
            },
          ],
        },
        {
          t: 'Où est le morceau cassé ?',
          o: ['Un morceau est resté dans la serrure', 'La clé est cassée hors de la serrure'],
          n: [
            {
              t: 'La serrure est-elle déverrouillée (porte ou soute ouverte) ?',
              o: ['Oui, elle est ouverte', 'Non, elle est fermée à clé'],
              n: [
                buy(
                  'Le morceau de clé bloque le barillet.',
                  'Ne tirez pas le morceau avec une pince : vous abîmeriez la serrure. Serrure déverrouillée, retirez le barillet avec la clé d’extraction qui correspond à sa série et posez un barillet neuf : le morceau part avec l’ancien.',
                  'Barillet Zadi neuf et clé d’extraction de la même série'
                ),
                shop(
                  'Le barillet fermé ne peut pas être extrait.',
                  'La clé d’extraction ne fonctionne que serrure ouverte : ne forcez pas la porte. L’atelier l’ouvre sans abîmer la carrosserie, puis change le barillet.',
                  'Barillet Zadi neuf du même modèle, posé par l’atelier'
                ),
              ],
            },
            buy(
              'Il vous reste une seule clé du barillet.',
              'Faites faire un double tant que vous en avez une. Apportez la clé restante au magasin, avec le numéro gravé dessus : selon le modèle, il commande une clé à ce numéro, sinon il vous propose un kit de barillets neufs avec leurs clés.',
              'Clé Zadi au numéro de votre barillet (ou kit de barillets neufs)'
            ),
          ],
        },
        {
          t: 'Avez-vous encore une clé de cette serrure ou son numéro (gravé sur la clé ou sur la carte des clés) ?',
          o: ['Oui, une clé ou le numéro', 'Non, plus rien'],
          n: [
            buy(
              'Il manque une clé à votre jeu.',
              'Apportez la clé restante ou son numéro au magasin : selon le modèle, il commande une clé ou un barillet à ce numéro, pour qu’une serrure neuve s’ouvre avec vos clés actuelles. Sinon, un kit de barillets identiques remplace toutes les serrures.',
              'Clé ou barillet Zadi au numéro de vos serrures'
            ),
            buy(
              'Sans clé ni numéro le barillet doit être remplacé.',
              'Si la porte est fermée, faites-la ouvrir par l’atelier. Ensuite, un kit de barillets identiques se pose sur la porte et les soutes : une seule clé ouvre tout, et la clé perdue ne sert plus à personne.',
              'Kit de barillets Zadi identiques avec 2 clés'
            ),
          ],
        },
        shop(
          'La tringle derrière le barillet est décrochée.',
          'Si la clé tourne sans résistance, le barillet n’entraîne plus la serrure. Ne forcez pas : l’atelier ouvre la porte par l’intérieur et remet la serrure en état.',
          'Serrure complète du même modèle si le mécanisme est cassé'
        ),
        buy(
          'Chaque serrure a son propre barillet.',
          'Un kit de barillets identiques (5 ou 10, avec 2 clés) se pose serrures ouvertes avec la clé d’extraction : une seule clé pour la porte et toutes les soutes. Il existe en modèle standard et en haute sécurité.',
          'Kit de barillets Zadi identiques avec 2 clés'
        ),
      ],
    },
  },
  {
    id: 'p_storeplisse',
    cat: 'ext',
    label: 'Mon store plissé ou ma moustiquaire (fenêtre, porte, lanterneau, pare-brise) : bloqué, cordon cassé, roulettes ou accroches qui lâchent',
    kw: 'store plissé remis remiflair remitop occultant rideau moustiquaire skydome cordon ficelle fil cassé détendu roulette roulettes accroche accroches patin rail glissière lâche décroche toile déchirée lanterneau fenêtre baie porte pare-brise cabine remonte descend tout seul bloqué bloque tombe travers coulisse mal dur',
    tree: {
      t: 'Qu’est-ce qui ne va pas ?',
      o: [
        'Un cordon (ficelle) est cassé, ou le store pend de travers',
        'Le store est bloqué : il ne monte ni ne descend plus',
        'Il coulisse mal, il force',
        'Une roulette ou une accroche a lâché',
        'La toile est déchirée ou percée',
        'Le store ne tient plus en place (il remonte ou descend tout seul)',
      ],
      n: [
        {
          t: 'Sur quel store ?',
          o: ['Fenêtre ou lanterneau', 'Moustiquaire de porte', 'Store du pare-brise (cabine)'],
          n: [
            buy(
              'Le cordon de tension est usé.',
              'Avant d’enlever l’ancien cordon, notez par où il passe. Le cordon neuf se passe dans les mêmes trous (une longue aiguille aide), puis se noue bien tendu sur son point de réglage (souvent en bas du store). Comptez une heure, ou faites-le faire par le magasin.',
              'Kit de cordon de rechange pour store plissé'
            ),
            buy(
              'Le cordon de la moustiquaire plissée est cassé.',
              'Même principe qu’un store de fenêtre : notez le passage du cordon, remplacez-le et tendez-le sur son point de réglage. Si la toile est abîmée elle aussi, une moustiquaire de porte neuve se pose à la place.',
              'Kit de cordon de rechange pour moustiquaire plissée'
            ),
            buy(
              'Le cordon du store de pare-brise est cassé.',
              'Changer tout le store de cabine coûte très cher : un recordage suffit le plus souvent. Le magasin le fait, ou vous fournit le kit de cordons à la longueur de votre store.',
              'Kit de cordons de rechange pour store de pare-brise plissé'
            ),
          ],
        },
        buy(
          'Un cordon coincé bloque le store.',
          'Ne tirez pas sur la toile et ne forcez pas : les plis et la cassette casseraient. Laissez le store où il est, photographiez-le avec ses côtés et montrez la photo au magasin : il vous donne le kit de cordon de votre store, ou fait le recordage.',
          'Kit de cordon de rechange pour store plissé (selon la marque)'
        ),
        buy(
          'Les rails du store sont encrassés.',
          'Dépoussiérez les rails avec une brosse douce, puis pulvérisez un peu de spray silicone et manœuvrez le store doucement, bien droit, plusieurs fois. Pas d’huile ni de graisse : elles collent la poussière.',
          'Spray silicone pour rails et glissières'
        ),
        {
          t: 'La roulette (ou l’accroche) est-elle cassée ou seulement sortie de son rail ?',
          o: ['Sortie du rail', 'Cassée ou perdue'],
          n: [
            buy(
              'La roulette est sortie de son rail.',
              'Écartez doucement la toile et remettez la roulette dans le rail, puis faites glisser le store deux ou trois fois. Un spray au silicone dans les rails la fait glisser sans forcer, et elle ne ressort plus.',
              'Spray silicone pour rails et glissières'
            ),
            buy(
              'La roulette du store est cassée.',
              'Les roulettes, patins et accroches se vendent en pièces détachées selon la marque du store. Apportez la pièce cassée, ou une photo et les dimensions du store, au magasin.',
              'Roulettes et accroches de rechange pour store plissé'
            ),
          ],
        },
        {
          t: 'Le trou est-il petit ou la toile est-elle usée ?',
          o: ['Un petit trou', 'Une grande déchirure ou une toile usée'],
          n: [
            buy(
              'La toile a un petit trou.',
              'Un patch spécial moustiquaire, posé des deux côtés, referme le trou, le store reste en place.',
              'Patch de réparation spécial moustiquaire'
            ),
            buy(
              'La toile du store est usée.',
              'Changez le store complet, à la taille de la fenêtre : la dimension est écrite sur l’étiquette de la cassette. Un store neuf se pose dans les mêmes fixations.',
              'Store plissé ou moustiquaire neuf aux dimensions de votre fenêtre'
            ),
          ],
        },
        buy(
          'Les cordons ne sont plus assez tendus.',
          'Retendez les cordons sur leur point de réglage (souvent en bas du store) jusqu’à ce qu’il tienne à mi-hauteur. Un cordon effiloché finit par casser : changez-le en même temps.',
          'Kit de cordon de rechange pour store plissé'
        ),
      ],
    },
  },
  {
    id: 'p_frigochaud',
    cat: 'frigo',
    label: 'Mon frigo givre ou ne refroidit pas assez (surtout quand il fait chaud)',
    eq: 'frigo',
    kw: 'frigo réfrigérateur givre glace freezer refroidit pas assez chaud tiède été canicule absorption trimixte gaz grilles grille ventilateur ventilation cheminée roulant soleil',
    tree: {
      t: 'Quel est le souci ?',
      o: ['Il ne refroidit pas assez quand il fait chaud', 'Il givre beaucoup', 'Il ne refroidit pas assez en roulant'],
      n: [
        {
          t: 'Votre frigo est-il à absorption (il marche au gaz, en 12 V et en 230 V) ?',
          o: ['Oui, il marche aussi au gaz', 'Non, c’est un frigo à compresseur', 'Je ne sais pas'],
          // Answered by itself when the type of fridge is known (« Mes équipements »).
          vk: 'frigo',
          vv: ['trimixte', 'comp', 'ns'],
          n: [
            {
              t: 'Regardez les grilles extérieures du frigo : qu’y voyez-vous ?',
              o: ['Les caches d’hiver sont encore posés', 'Elles sont encrassées (poussière, toiles d’araignée, insectes)', 'Elles sont propres et dégagées'],
              n: [
                buy(
                  'Les caches d’hiver bloquent l’air du frigo.',
                  'Retirez les caches d’hiver dès que les beaux jours reviennent (au-dessus d’environ 8 °C dehors) : sans eux, l’air chaud sort par la grille du haut et le frigo refait du froid en quelques heures. Gardez-les pour l’hiver.',
                  'Aucun produit nécessaire'
                ),
                buy(
                  'Les grilles encrassées empêchent la chaleur de sortir.',
                  'Frigo éteint et refroidi, retirez les grilles et dépoussiérez-les avec une brosse douce et un aérosol dépoussiérant, ainsi que les ailettes que vous voyez par l’ouverture. Ne touchez ni au brûleur ni à la cheminée. Remettez les grilles : elles évacuent aussi les gaz brûlés.',
                  'Aérosol dépoussiérant et brosse douce pour grilles de réfrigérateur',
                  'Ne roulez jamais et n’utilisez jamais le frigo au gaz sans ses grilles : elles évacuent les gaz brûlés.'
                ),
                {
                  t: 'Le côté du frigo est-il en plein soleil, ou le véhicule penché ?',
                  o: ['Il est en plein soleil', 'Le véhicule n’est pas à plat', 'Ni l’un ni l’autre'],
                  n: [
                    buy(
                      'Le soleil sur la paroi du frigo bloque son refroidissement.',
                      'Un frigo à absorption perd du froid au-delà d’environ 32 °C dehors. Garez-vous côté frigo à l’ombre si possible. Des ventilateurs 12 V à thermostat, fixés sur la grille du haut, chassent l’air chaud de derrière le frigo et lui redonnent du froid par forte chaleur : le magasin vous conseille le modèle qui va sur votre grille.',
                      'Kit de ventilateurs 12 V à thermostat pour grille de réfrigérateur'
                    ),
                    buy(
                      'Le frigo à absorption perd son froid quand il penche.',
                      'Mettez le véhicule à plat avec des cales : au-delà d’environ 3 degrés d’inclinaison, le froid baisse beaucoup. Une petite application de niveau ou un niveau à bulle posé dans le frigo suffit à vérifier.',
                      'Cales de nivellement avec niveau à bulle'
                    ),
                    shop(
                      'La cheminée du frigo est encrassée.',
                      'Grilles propres et véhicule à plat, un froid toujours faible vient souvent de la cheminée (suie du brûleur au gaz) ou du groupe froid. L’atelier les contrôle et les nettoie.',
                      'Nettoyage de la cheminée et contrôle du réfrigérateur à l’atelier',
                      'Si vous voyez de la suie ou sentez une odeur de gaz, fermez la bouteille et n’utilisez plus le gaz avant le contrôle.'
                    ),
                  ],
                },
              ],
            },
            buy(
              'Le compresseur manque d’air pour évacuer sa chaleur.',
              'Vérifiez que la grille d’aération du compresseur n’est pas cachée par un sac ou un rangement. Dans un meuble fermé, un petit ventilateur d’appoint aide beaucoup l’été.',
              'Ventilateur d’appoint 12 V pour réfrigérateur'
            ),
            buy(
              'Le type de frigo n’est pas connu.',
              'Regardez la plaque à l’intérieur du frigo (ou « Mes équipements »). S’il a des grilles dehors sur la paroi, c’est un frigo à absorption : dépoussiérez-les, et des ventilateurs de grille l’aideront l’été.',
              'Kit de ventilateurs 12 V à thermostat pour grille de réfrigérateur'
            ),
          ],
        },
        {
          t: 'La porte ferme-t-elle bien ? (fermez-la sur une feuille de papier : elle doit résister partout)',
          o: ['Non, la feuille glisse quelque part', 'Oui, elle résiste partout'],
          n: [
            buy(
              'Le joint de porte laisse entrer l’air humide.',
              'L’air humide qui entre par le joint se change en givre. Changez le joint s’il est écrasé ou déchiré, et vérifiez que la porte n’est pas restée bloquée entrouverte (position de rangement).',
              'Joint de porte de réfrigérateur au modèle'
            ),
            {
              t: 'Le thermostat est-il au maximum, ou le frigo souvent ouvert ?',
              o: ['Oui', 'Non'],
              n: [
                buy(
                  'Le thermostat au maximum fait givrer la plaque froide.',
                  'Réglez le thermostat au milieu, laissez refroidir les plats avant de les ranger et dégivrez une fois par mois en saison : le givre isole et fait perdre du froid. Un thermomètre de frigo aide à trouver le bon réglage.',
                  'Thermomètre de réfrigérateur'
                ),
                shop(
                  'La régulation du frigo ne coupe plus le froid.',
                  'Le givre revient vite alors que le joint est bon et le réglage moyen : l’atelier contrôle la sonde et la commande du frigo.',
                  'Contrôle du réfrigérateur à l’atelier'
                ),
              ],
            },
          ],
        },
        buy(
          'En roulant le tirage d’air derrière le frigo diminue.',
          'Faites descendre le frigo en température avant de partir (sur 230 V ou au gaz à l’arrêt), car sur 12 V un frigo à absorption garde le froid sans en refaire beaucoup. Des ventilateurs de grille forcent l’air chaud dehors sur la route.',
          'Kit de ventilateurs 12 V à thermostat pour grille de réfrigérateur'
        ),
      ],
    },
  },
  {
    id: 'p_fuite',
    cat: 'eau',
    label: 'J’ai une fuite d’eau ou mon réservoir se vide tout seul',
    eq: 'pompe',
    kw: 'fuite eau coule goutte flaque sous le camping-car vide tout seul réservoir chauffe-eau frost control frostcontrol vanne vidange soupape purge gel gelé dégel truma évier robinet raccord tuyau douche wc chasse lame cassette eaux grises trop-plein déborde',
    tree: {
      t: 'Où voyez-vous l’eau ?',
      o: [
        'Sous le véhicule, près du chauffe-eau',
        'Sous le véhicule : de l’eau grise qui sent mauvais',
        'Juste après avoir rempli le réservoir',
        'Après une période de gel',
        'Sous l’évier ou au pied d’un robinet',
        'Autour de la douche ou des WC',
        'Le réservoir se vide mais je ne vois pas de fuite',
        'Il y a de l’eau au sol à l’intérieur',
      ],
      n: [
        {
          t: 'Sous le chauffe-eau, la vanne de vidange (FrostControl, bouton jaune) est-elle ouverte (bouton sorti) ?',
          o: ['Oui, le bouton est sorti', 'Non, elle est fermée et ça coule quand même', 'Je ne trouve pas cette vanne'],
          n: [
            {
              t: 'Faisait-il froid (moins de 3 °C environ au niveau de la vanne) ?',
              o: ['Oui', 'Non'],
              n: [
                buy(
                  'La vanne s’est ouverte pour protéger le chauffe-eau du gel.',
                  'C’est normal : elle vide le chauffe-eau dès 3 °C environ. Quand il fait plus doux (vers 7 °C), refermez-la (levier tourné parallèle à la vanne, puis bouton enfoncé jusqu’au déclic), chauffez la cellule et remettez l’eau. Un câble chauffant de cuve protège le reste du circuit l’hiver.',
                  'Câble chauffant antigel pour réservoir et tuyaux'
                ),
                shop(
                  'La soupape de la vanne évacue une surpression.',
                  'Si l’eau part par la vanne pendant la chauffe ou à chaque ouverture de robinet, la pression du circuit est trop forte : la vanne laisse partir l’eau au-delà d’environ 4,5 bars. Une pompe trop puissante (plus de 2,8 bars) ou un vase d’expansion plein d’eau en est souvent la cause. L’atelier contrôle et pose un réducteur de pression si besoin.',
                  'Réducteur de pression ou vase d’expansion, posé par l’atelier'
                ),
              ],
            },
            buy(
              'Le joint de la vanne de vidange est usé.',
              'Coupez la pompe en attendant. Une vanne qui fuit fermée se change entière : elle existe en kit avec les raccords adaptés à vos tuyaux.',
              'Kit de vanne de vidange FrostControl avec raccords'
            ),
            shop(
              'Une fuite se cache sous le véhicule.',
              'La vanne de vidange se trouve sous le plancher près du chauffe-eau, ou à l’intérieur juste à côté de lui. Coupez la pompe et notez où tombent les gouttes : l’atelier trouve la fuite et change la pièce.',
              'Raccords et colliers pour circuit d’eau, posés par l’atelier'
            ),
          ],
        },
        {
          t: 'Fermez la vanne de vidange des eaux grises à fond. La fuite s’arrête-t-elle ?',
          o: ['Oui, ça ne coule plus', 'Non, ça coule toujours'],
          n: [
            buy(
              'La vanne de vidange des eaux grises était mal fermée.',
              'Refermez-la à fond après chaque vidange. Une graisse silicone sur son axe la garde douce et étanche.',
              'Graisse silicone pour vannes et joints'
            ),
            shop(
              'Le joint de la vanne des eaux grises est usé.',
              'Videz le réservoir d’eaux grises sur une aire de service. L’atelier remplace le joint ou la vanne.',
              'Joint ou vanne de vidange d’eaux grises, posé par l’atelier'
            ),
          ],
        },
        buy(
          'Le réservoir d’eau propre déborde par son trop-plein.',
          'C’est normal quand il est plein à ras : arrêtez de remplir dès que l’eau sort du trop-plein. Un pistolet d’arrosage à coupure évite d’en mettre partout.',
          'Pistolet de remplissage à coupure et tuyau alimentaire'
        ),
        {
          t: 'Laissez dégeler. Où voyez-vous des traces d’eau ?',
          o: ['Sur un tuyau ou un raccord visible', 'Autour du chauffe-eau', 'Près de la pompe', 'Je ne vois pas d’où'],
          n: [
            shop(
              'Le gel a fissuré une pièce visible du circuit.',
              'Ne relancez pas la pompe. L’atelier remplace la pièce fissurée. Pour l’hiver suivant, vidangez le circuit ou protégez-le avec un câble chauffant antigel.',
              'Tuyau alimentaire et raccords rapides, posés par l’atelier',
              'Après un gel, faites contrôler le circuit à l’atelier avant de le remettre sous pression.'
            ),
            shop(
              'Le gel a abîmé le chauffe-eau.',
              'Ne relancez ni la pompe ni le chauffe-eau. L’atelier contrôle la cuve et la vanne de vidange.',
              'Contrôle du chauffe-eau à l’atelier',
              'Après un gel, faites contrôler le circuit à l’atelier avant de le remettre sous pression.'
            ),
            shop(
              'La glace a fissuré la pompe à eau.',
              'Coupez la pompe et vidangez le circuit. La pompe est à remplacer.',
              'Pompe à eau de remplacement, posée par l’atelier',
              'Après un gel, faites contrôler le circuit à l’atelier avant de le remettre sous pression.'
            ),
            shop(
              'Une fissure cachée est possible après le gel.',
              'Ne relancez pas la pompe avant le contrôle : l’atelier met le circuit sous pression et cherche la fuite.',
              'Recherche de fuite à l’atelier',
              'Après un gel, faites contrôler le circuit à l’atelier avant de le remettre sous pression.'
            ),
          ],
        },
        {
          t: 'Ça coule quand ?',
          o: ['Seulement quand l’eau coule dans l’évier', 'Tout le temps, même robinet fermé'],
          n: [
            buy(
              'Le siphon de l’évier fuit.',
              'Resserrez à la main l’écrou du siphon sous l’évier et regardez son joint. S’il est fendu ou écrasé, changez le siphon ou son joint.',
              'Siphon et joints d’évacuation pour camping-car'
            ),
            buy(
              'Le raccord rapide du robinet fuit sous pression.',
              'Coupez la pompe. Repoussez le tuyau dans son raccord rapide jusqu’à la butée : il doit s’enfoncer de plus d’un centimètre. Un raccord fendu se change.',
              'Raccords rapides pour circuit d’eau'
            ),
          ],
        },
        {
          t: 'Où exactement ?',
          o: ['Au joint du bac de douche ou au mitigeur', 'Le bac de douche lui-même est fendu', 'Au pied des WC, à chaque chasse d’eau', 'Entre la cuvette et la cassette des WC'],
          n: [
            buy(
              'Le joint du bac de douche est fendu.',
              'Séchez bien la zone, retirez l’ancien joint et refaites-le avec un mastic d’étanchéité spécial sanitaire de camping-car.',
              'Mastic d’étanchéité spécial sanitaire camping-car'
            ),
            shop(
              'Le bac de douche est fendu.',
              'L’eau qui passe par la fissure abîme le plancher en dessous : ne prenez plus de douche avant la réparation. L’atelier répare le bac à la résine ou le change. Un caillebotis répartit ensuite le poids et évite une nouvelle fissure.',
              'Réparation du bac à l’atelier, puis caillebotis de douche'
            ),
            buy(
              'Le joint de la chasse d’eau des WC est usé.',
              'Une petite flaque après chaque chasse vient souvent des joints de la vanne d’arrivée d’eau. Le kit de joints de la marque de vos WC se pose facilement.',
              'Kit de joints pour WC à cassette'
            ),
            buy(
              'Le joint de la lame des WC ne ferme plus bien.',
              'Le joint de la lame sèche et laisse passer le liquide entre la cuvette et la cassette. Lubrifiez-le avec un produit spécial joints de lame, à chaque vidange de cassette. S’il est fendu, un joint de lame neuf se pose.',
              'Lubrifiant spécial joints de lame de WC à cassette'
            ),
          ],
        },
        {
          t: 'Avez-vous regardé la vanne de vidange du chauffe-eau (FrostControl, bouton jaune sous le chauffe-eau) ?',
          o: ['Elle est ouverte (bouton sorti)', 'Elle est fermée'],
          n: [
            buy(
              'La vanne de vidange du chauffe-eau est ouverte.',
              'Bouton sorti, la vanne vide l’eau dehors : c’est sa protection contre le gel (sous 3 °C environ). Au-dessus de 7 °C, refermez-la (levier parallèle à la vanne, puis bouton enfoncé) et remettez l’eau. Un câble chauffant protège le circuit l’hiver.',
              'Câble chauffant antigel pour réservoir et tuyaux'
            ),
            shop(
              'Une fuite cachée se trouve sur le réservoir.',
              'Remplissez le réservoir, coupez la pompe et notez le niveau le lendemain. S’il a baissé, l’atelier contrôle le réservoir et ses raccords.',
              'Recherche de fuite et raccords neufs à l’atelier'
            ),
          ],
        },
        {
          t: 'L’eau apparaît-elle après la pluie ?',
          o: ['Oui, après la pluie', 'Non, même sans pluie'],
          n: [
            shop(
              'De l’eau de pluie entre par un joint de la carrosserie.',
              'Épongez et laissez sécher en aérant : l’humidité abîme le bois des parois. Prenez rendez-vous pour un test d’étanchéité, qui trouve l’endroit exact.',
              'Test d’étanchéité à l’atelier',
              null,
              'etanch'
            ),
            buy(
              'Un raccord du circuit d’eau fuit sous un meuble.',
              'Coupez la pompe, ouvrez les trappes sous l’évier et la douche et repérez le tuyau mouillé. Repoussez-le dans son raccord rapide, ou changez le raccord s’il est fendu.',
              'Raccords rapides pour circuit d’eau'
            ),
          ],
        },
      ],
    },
  },
];

module.exports = { CLIENTS_2026_10 };
