# Macro-constructions — mémo de conception

Décisions prises avec l'auteur (conversation du 2026-10-26), avant tout code.
La discussion complète est dans `discussions_IA/03_macro_constructions.docx`.

Lire avant d'y toucher : ce mémo, `EDITOR.md` (catalogue de commandes,
langage textuel, côtés virtuels), `DGO.md` (règles d'évolution du format) et
`AGENTS.md`.

## Pourquoi

Une macro-construction transforme une construction comprise en un outil
réutilisable. C'est l'équivalent, en géométrie dynamique, de la procédure
Logo (`POUR CARRE … FIN`) : l'apprenant **étend le langage de son
micro-monde** (Papert ; Laborde et Balacheff pour Cabri). Le test du
déplacement valide la construction, la macro réifie une procédure ou un
théorème. L'élève passe ainsi de la boîte blanche, dont il a compris
l'intérieur, à la boîte noire qu'il utilise. Les outils qu'il se fabrique
sont des briques de savoir qu'il empile.

Conséquence pour la conception : tout ce qui relève de la définition d'une
macro se fait **par manipulation directe dans la figure**, pas dans des
boîtes de dialogue (le défaut de GeoGebra).

## Références étudiées

- **DGPad** (`doctools_MAIN/public/apps/dgpad/scripts/Main.js`) :
  `macroConstructionTag`, `checkIntermediates`, `computeMacro` (définition),
  classe `Macro` avec `tagPossibleInitials` et `executeMacro` (application).
  Modes d'objet : 0 neutre, 1 intermédiaire déterminé, 2 initial, 3 final,
  4 initial possible à l'application, 5 initial choisi. Objets auto
  (`setMacroAutoObject`, `DefinitionPoint`) : un segment ou un polygone
  choisi comme initial rend ses points disponibles. L'application
  **développe** la macro : son script recrée tous les objets dans la figure.
- **Cabri II et II Plus** (`tests/cabri_figures_et_macros/`), décrit plus
  bas : modèle de référence pour l'encapsulation et les méthodes.
- **GeoGebra** : un outil appliqué est un seul algorithme dont les sorties
  sont les finaux (encapsulation). L'import actuel développe ces outils en
  objets cachés (`expandMacros`, `src/import/ggb_translate.ts`).
- **CaRMetal** (E. Hakenholz, 2006, Java), où les macros avaient beaucoup
  compté. Les sources ne sont pas accessibles ; le chapitre « Macros » de
  son manuel (2011) l'est : <http://carmetal2.free.fr/images/pdf/macros.pdf>.
  Ce qu'on y trouve, au-delà de ce mémo :
    - une bibliothèque de macros fournies (codage des figures, polygones,
      quadrilatères, transformations, vecteurs, barycentres, fonctions,
      complexes, curseurs, grilles…), rangées en dossiers et sous-dossiers
      (glisser-déposer), enregistrables sur disque, et « ajouter à la
      bibliothèque » pour qu'une macro de l'élève soit là à chaque
      lancement ;
    - les macros aussi par un clic droit dans le vide : menu flottant à
      l'endroit de la souris ;
    - par initial, deux options : « Ask », un nombre demandé par une boîte
      de dialogue (rejeté en fin de liste), et « fix », un initial désigné
      une seule fois puis gardé d'une application à l'autre (le centre, le
      rapport et l'angle d'une similitude : seul le point est ensuite
      demandé) ; la barre d'espace reprenait aussi les initiaux précédents ;
    - une transformation ponctuelle définie par macro s'applique aussi à un
      objet (droite, cercle, polygone) : survolé, son image s'affiche en
      aperçu (en jaune), comme lieu des images de ses points ;
    - une macro sans final, qui insère une partie de construction (le
      repère des figures 3D) ;
    - le style des finaux (propriétés conditionnelles comprises) recopié
      comme défaut à l'application.
- **Article « La nouvelle orientation d'Alice »**, E. Hakenholz,
  abraCAdaBRI n° 10, sept.-oct. 1995, p. 15-19 (PDF fourni dans la
  conversation). Il établit la « règle d'or » de l'orientation et construit
  une logique booléenne par macros (VF-constructions). C'est le corpus de
  test naturel du chantier.

### Ce que montrent les fichiers Cabri

Fichier `.mac` :

- Nom de la macro et nom du final (« Macro original, milieu »,
  « CastillonInversion, Point Castillon »), icône 16×16 dessinée par
  l'auteur, texte d'aide. L'aide donne l'ordre des initiaux (« Choisir,
  suivant l'ordre, le cercle, le centre d'inversion a et le point P ») et le
  domaine de validité (« La macro est en défaut si P, a et O sont alignés »).
- `CN` initiaux, `ON` objets construits, `FN` finaux, `PO = ON − FN`
  intermédiaires.
- `CT` : type de chaque initial (`point`, `segment`, `circle`, `vector`,
  `number`). `CS n` est le nombre de sous-objets exposés (2 extrémités pour
  un segment, le centre pour un cercle). Les sous-objets sont numérotés
  avant l'objet : pour un cercle initial, 1 est le centre et 2 le cercle.
- `Const` : liste linéaire de constructions élémentaires désignées par leurs
  numéros. Un drapeau 0/1 marque les finaux, et seuls les finaux portent un
  style. Les intersections portent leur indice (`int ind:0` / `0x10000`).
- **Méthodes** (`Mth: 0`, `Mth: 1`…) : une même macro a plusieurs signatures
  d'initiaux, chacune avec sa construction. `Macro_original augmente.mac` est
  le milieu de deux points (qui construit un segment caché) **et** d'un
  segment.
- Dans ce corpus, aucune définition n'appelle une autre macro.

Fichier `.fig` :

- Section `Used macro` : les définitions des macros utilisées sont
  recopiées dans la figure, qui s'ouvre sans le `.mac`.
- Application : `Ma: inversion con signo, Const: 6 i: 0 4 i: 0 5 i: 0`
  (l'appel et ses initiaux), puis un objet par final, `18: Ma R, F No1`, avec
  son propre nom et son propre style. Plusieurs finaux donnent `F No1`,
  `F No2`…
- Les intermédiaires ne sont jamais écrits, mais les numéros sautent à
  chaque application. Cabri encapsulait dans le fichier et l'interface, et
  développait en mémoire.
- Le rôle de `i: 0` après chaque initial est inconnu, et l'auteur ne s'en
  souvient pas.

### La règle d'or de l'orientation

Une droite est orientée. Les deux intersections g et h d'une droite (OA) et
d'un cercle sont nommées de sorte que **gh** ait le sens de **OA**, et ce
sens se conserve dans toutes les positions de la figure. Une parallèle hérite
du sens de sa droite. Une bissectrice change de sens quand son sommet
traverse le segment, et dépend de l'ordre de ses points dans le cas
dégénéré. Le choix entre deux intersections est donc une **fonction de
l'état présent**, sans historique : une macro est une fonction pure de ses
initiaux **ordonnés**. Changer l'ordre des initiaux change le sens de la
macro : VF-OU est la figure de VF-ET avec ses initiaux permutés (loi de
De Morgan), et VF-NON vient de la même figure.

Le moteur la respecte déjà (`src/objects/intersection_object.ts`) :

- droite × cercle : solutions prises le long du vecteur directeur orienté
  `VEC` (`t + offset`, puis `t − offset`) ;
- cercle × cercle : choix selon la direction du premier centre vers le
  second ;
- « autre intersection » que P (`away`) : enregistrée comme définition, pas
  comme indice.

**Exception** : conique × conique, jusqu'à 4 racines (`groupAssign`), suit la
continuité (position précédente). Une application neuve n'a pas d'historique
et prend l'ordre fixe : elle peut donner un autre point que celui que le
concepteur voyait après déplacement. Les cas dégénérés (bissectrice quand le
sommet est au milieu : Cabri I et II diffèrent) font partie de la sémantique
des macros. Pour les figures importées, la référence est DGPad.

## Décisions

### Définir une macro (éditeur)

- **Les initiaux d'abord, puis les finaux** (décidé avec l'auteur le
  2026-10-26, en remplacement de « deux rôles, aucun ordre imposé » : la
  règle automatique de DGPad, une bascule « Initial / Final » pour la
  forcer et les finaux désignés en premier s'étaient montrés confus à
  l'essai). Deux étapes explicites, comme le « magnétophone » de CaRMetal
  et Cabri : à l'étape 1, chaque toucher ajoute ou retire un initial,
  même un objet déjà déterminé (on coupe ainsi plus tôt dans le graphe) ;
  « Suivant : les finaux » passe à l'étape 2, où chaque toucher sur un
  objet déterminé ajoute ou retire un final, un objet non déterminé étant
  refusé avec ce qui lui manque. « Retour aux initiaux » revient à
  l'étape 1.
- **N'importe quel objet peut être initial** : libre, semi-libre (point sur
  objet) ou construit. La remontée dans les dépendances s'arrête aux
  initiaux. Choisir les initiaux, c'est choisir **ce que l'outil veut dire**
  (ses hypothèses) : une tangente « à partir de O, M, P » n'est pas l'outil
  « cercle, point ». C'est pourquoi on ne déduit jamais les initiaux
  automatiquement des finaux.
- **Le bouquet.** À chaque initial, tous les objets déterminés s'allument :
  « voilà ce que tes données permettent de construire ». Le concepteur
  choisit ses finaux dans ce bouquet. Sans final désigné, **les objets
  visibles déterminés sont les finaux**. Les objets cachés déterminés
  restent des intermédiaires. Une fois un final cliqué, le reste du bouquet
  reste allumé. L'œil doit distinguer nettement trois états : initial, final
  possible et final choisi.
- **Un final qui n'est plus déterminé** (initial retiré en revenant à
  l'étape 1) est signalé, et ses ancêtres manquants sont **suggérés**,
  jamais choisis d'office.
- **La macro est valide quand tous ses finaux sont déterminés par ses
  initiaux.**
- **La figure reste manipulable pendant la définition.** Si l'on déplace un
  objet qui fait bouger un final sans être initial ni déterminé par les
  initiaux, c'est un initial manquant (le test du déplacement appliqué à la
  macro).
- **Le panneau est un récapitulatif, pas un outil de sélection.** Il porte
  l'ordre des initiaux, réordonnable par glisser-déposer (l'ordre des clics
  n'est qu'une valeur par défaut), et le message affiché à l'usage pour
  chaque initial (« Le cercle ? »). Il porte aussi le nom de la macro, le nom
  de ses finaux, l'aide (ordre et domaine de validité) et l'icône dessinée
  par l'auteur. On peut **réordonner et enregistrer une nouvelle macro sans
  refaire la sélection** (VF-ET, VF-OU et VF-NON viennent d'une seule
  figure).
- **Sous-objets** : chaque type d'initial expose une liste fixe et ordonnée
  de sous-objets (extrémités d'un segment, centre d'un cercle, points d'un
  vecteur, sommets d'un polygone), utilisables dans le corps (comme `CS` dans
  Cabri et `DefinitionPoint` dans DGPad). L'ordre porte le sens : [AB] et
  [BA] ne donnent pas le même résultat.
- Un initial semi-libre n'est plus qu'un objet de son type à l'usage : sa
  contrainte disparaît, sauf si son support est aussi un initial. C'est une
  généralisation légitime, qu'on ne signale pas.

### Méthodes

- Une macro, c'est un nom, une icône, le nom de ses finaux et une liste de
  **méthodes**. Une méthode, c'est une signature (types ordonnés des
  initiaux, avec leurs sous-objets), un corps, et une aide donnant l'ordre
  des initiaux.
- **Toutes les méthodes d'une macro produisent les mêmes finaux**, en nombre
  et en types : l'outil garde un seul sens.
- **Ajouter une méthode, c'est construire.** Définir une macro sous un nom
  existant, avec les mêmes finaux et une autre signature, propose de
  l'ajouter comme méthode. Avec une signature existante, l'éditeur propose
  de la remplacer. L'élève enrichit son outil (« mon milieu marche aussi sur
  un segment ») sans boîte de dialogue de typage.
- **Signatures ambiguës refusées à la définition** : aucune signature n'en
  prolonge une autre, par exemple (point, point) et (point, point, point).
  C'est la règle « aucune forme d'une commande n'en prolonge une autre » du
  catalogue de l'éditeur (`EDITOR.md`, « Langage textuel ») : les macros la
  suivent comme toute commande.
- **Types exacts au départ.** Une méthode qui attend une droite n'accepte
  qu'une droite ; la généralisation passe par les méthodes. Laisser plus tard
  une droite accepter un segment ou une demi-droite (le moteur les traite
  déjà comme des droites) change le sens (une intersection du corps
  deviendrait bornée) : seulement sur un besoin issu de figures réelles.
- Ce choix remplace l'idée, écartée, d'un typage déduit de l'usage que le
  corps fait de chaque initial.

### Appliquer une macro (éditeur)

- **La macro se comporte comme un outil natif.** À chaque clic, on garde
  les méthodes dont la signature commence par les types déjà choisis, et on
  allume les objets acceptables comme initial suivant pour l'une d'elles
  (`tagPossibleInitials` de DGPad, sur toutes les méthodes). Un clic dans le
  vide crée un point libre, et un clic sur une ligne un point sur objet, si
  une méthode encore possible attend un point (DGPad ne le permettait pas).
- La macro s'applique dès qu'une méthode est complète, ce qui est sans
  ambiguïté grâce à la règle des signatures.
- Pendant la désignation, on affiche l'aide et le message de l'initial
  attendu (« 1/3 – Le cercle ? »).
- Un nombre initial se désigne par un curseur ou une expression, ou se tape.
- Proposition : afficher le résultat en aperçu avant le dernier clic, pour
  voir, par exemple, de quel côté tombe un triangle équilatéral selon
  l'ordre des points.

### Le calcul : un nœud d'application (moteur)

- **Encapsuler, pas développer** (comme Cabri et GeoGebra, à l'inverse de
  DGPad). Une application est **un appel de fonction** :

    | Fonction                      | Macro                                                 |
    | ----------------------------- | ----------------------------------------------------- |
    | corps                         | constructions élémentaires de la méthode              |
    | paramètres ordonnés           | initiaux                                              |
    | variables locales             | intermédiaires                                        |
    | valeurs de retour (plusieurs) | finaux                                                |
    | appel                         | nœud « application », qui a les initiaux pour parents |

- **Les variables locales sont de vrais objets, pas un second moteur.** Le
  corps est calculé par les classes d'objets existantes. Chaque application
  possède sa construction privée, créée à partir de la définition, absente
  de la figure (ni dessinée, ni désignable, ni nommée, ni enregistrée).
  C'est une fonction dont les variables locales persistent, et non une
  fonction pure : certains objets ont une mémoire (continuité de conique ×
  conique).
- **Le précédent dans le moteur : les parties virtuelles du polygone**
  (`src/objects/polygon_part.ts`). Ce sont des objets de la bonne classe,
  hors du collecteur, recalculés avec leur propriétaire (`virtualParts`), qui
  portent une référence `{ owner, kind, rank }`
  (`src/objects/construction_object.ts`). Leurs dépendants ont le
  propriétaire pour parent (`addParents`). `polygon_side` vide sa liste de
  parents tout en gardant ses extrémités internes.
- **Un final est l'objet même produit par le corps**, de sa classe exacte
  (`intersection_object`, `circle3pts_object`, `segment_object`…), **adopté
  dans la figure** : dans le collecteur, avec un nom, un style et une vue,
  désignable et masquable comme les autres. Dans le graphe, son seul parent
  est le nœud d'application ; en interne, il garde ses références aux objets
  privés. L'ordre de calcul en découle : initiaux, nœud, finaux, puis leurs
  dépendants. Il n'y a aucune classe intermédiaire par type d'objet.
  L'orientation (`VEC`) d'une droite finale traverse le nœud, un segment
  final garde ses bornes, et les tests `instanceof` du moteur restent
  valables.
- **Règles** :
    - un final n'est jamais déplaçable ;
    - supprimer un final ne supprime que lui, et le nœud disparaît avec son
      dernier final ;
    - supprimer un initial supprime le nœud et ses finaux ;
    - l'inexistence se propage (intermédiaire indéfini, finaux indéfinis) :
      VF-existe ssi vrai en dépend.
- **Les applications s'emboîtent** : le corps d'une méthode peut contenir
  des applications d'autres macros, gardées comme appels (pas aplaties). Pas
  de récursion : une macro existe avant d'être utilisée. Les doublons de
  calcul (une droite recalculée dans la boîte noire) sont acceptés.
- **Style** : la définition garde le style de chaque final au moment de la
  création, comme défaut. Chaque application garde ensuite le sien,
  modifiable comme pour tout objet.
- **Le calcul va dans le moteur**, puisque le lecteur doit ouvrir les `.dgo`
  qui contiennent des macros. Il doit rester léger, et la taille du lecteur
  doit être mesurée. La définition et l'application (sélection, bouquet,
  panneau) vont dans `src/editor/`, selon les règles de `EDITOR.md` : des
  fonctions libres, jamais des méthodes des classes d'objets.

### Format `.dgo`

À concevoir dans `DGO.md` avant tout code, en ajouts seulement (règles
d'évolution) :

- **Définitions recopiées dans la figure** (comme `Used macro` de Cabri) :
  nom, nom des finaux, icône, aide, méthodes (signature, corps, finaux avec
  leur style par défaut). La figure reste autonome.
- **Proposition** : le corps d'une méthode est un petit tableau d'entrées
  `.dgo` ordinaires, aux indices locaux (initiaux et sous-objets d'abord,
  comme dans Cabri). La lecture et la validation restent celles des figures.
- **Un type d'objet « application »** : macro, méthode et références aux
  initiaux.
- **Les finaux** sont des entrées du tableau `o` (nom, style, état), définies
  comme « sortie n° k de telle application », jamais par leur propre
  définition, puisque leurs parents sont privés. Voir la forme des
  références `["side", polygone, k]` existantes.
- Numérotation stable des branches d'intersection (règle 3 de `DGO.md`) :
  elle vaut aussi dans les corps.
- État élève : les finaux ne sont pas modifiables ; leurs noms sont stables.

### Imports

- **DGPad** : rien ne change, les `.dgp` contiennent les macros déjà
  développées. Les définitions `$macros` (JavaScript) restent ignorées.
- **GeoGebra** : plus tard, les outils (`geogebra_macro.xml`) pourraient
  devenir des nœuds d'application au lieu d'être développés par
  `expandMacros`. Ce n'est pas urgent.
- **Cabri** : aucun import prévu, le corpus sert de référence.

### Ouvrir la boîte

L'éditeur peut proposer une action « Ouvrir la boîte », qui remplace une
application par ses objets élémentaires, visibles et nommés. La macro reste
encapsulée par défaut et se développe sur demande, ce que Cabri ne
permettait pas et que DGPad imposait toujours. L'élève peut passer de la
boîte noire à la boîte blanche, puis revenir à la boîte noire en recréant la
macro.

## Étapes

0. **Ouvrir le chantier** : ajouter dans `AGENTS.md` l'exception des macros
   (définition et application dans l'éditeur, calcul dans le moteur), avec
   un renvoi vers ce mémo, et un renvoi dans `EDITOR.md`.
1. **Format** : rédiger dans `DGO.md` les définitions, l'application, les
   finaux et le corps des méthodes, et les faire valider par l'auteur.
2. **Moteur** :
    - nœud d'application, construction privée du corps, finaux adoptés ;
    - lecture et écriture `.dgo` ;
    - tests sur des `.dgo` écrits à la main :
        - aller-retour ;
        - conservation de l'orientation à travers le nœud ;
        - propagation de l'inexistence ;
        - applications emboîtées ;
        - méthodes ;
        - suppression d'un final ou d'un initial ;
        - conique × conique ;
    - mesure du poids du lecteur.

    Figures de test tirées de l'article d'Alice (VF-Pt intérieur segment,
    VF-intersection seg/dte et seg/seg, VF-ET, VF-OU par permutation,
    VF-NON, VF-existe ssi vrai, partage du plan par un quadrilatère croisé)
    et de Castillon (`tests/cabri_figures_et_macros/`).

3. **Éditeur, définition** :
    - outil Macro : rôles, bascule, bouquet, suggestions, validité, figure
      manipulable ;
    - panneau : ordre des initiaux, messages, noms, aide, icône ;
    - enregistrement : nouvelle macro, nouvelle méthode, remplacement,
      refus des signatures ambiguës.
4. **Éditeur, application** :
    - macros dans le menu des outils et les outils contextuels (catalogue) ;
    - désignation incrémentale entre méthodes ;
    - points créés à la volée ;
    - aide et messages, aperçu.
5. **Langage textuel** : la macro comme commande du catalogue, et la forme
   textuelle d'une application à plusieurs finaux.
6. **Ouvrir la boîte.**
7. **Bibliothèque** : conserver et partager les macros hors d'une figure
   (voir « Questions ouvertes »).
8. Éventuellement, les outils GeoGebra en nœuds d'application.
9. **Manuel** dans les 12 langues (`npm run manual`).

Mesurer le poids du lecteur et de l'éditeur à chaque étape. Noter
l'avancement à la fin de ce mémo.

## Idées de CaRMetal retenues

Retenues par l'auteur le 2026-10-26, à placer dans les étapes (voir
« Références étudiées », CaRMetal) :

- **Bibliothèque** (étape 7) : macros fournies, rangées en dossiers, et
  « ajouter à la bibliothèque » pour qu'une macro soit là à chaque
  ouverture.
- **Menu au clic droit** : un clic droit dans le vide ouvre un menu
  flottant des macros, à l'endroit de la souris.
- **Initiaux fixés** : un initial désigné une fois puis gardé d'une
  application à l'autre (centre, rapport, angle d'une similitude).
- **Image d'un objet** : une macro de transformation ponctuelle appliquée
  à une droite, un cercle, un polygone donne son image (lieu des images),
  avec aperçu au survol.

## Questions ouvertes

- Initial inutilisé, ancêtre d'aucun final : l'avertir ou le refuser ?
- Bibliothèque de macros : personnelle, fournie par l'enseignant, stockée
  où (DocTools, fichier) ?
- Modifier la définition d'une macro : faut-il mettre à jour ses
  applications dans la figure, et comment versionner les copies des
  définitions ?
- Restriction des outils par l'enseignant, pour que l'élève reconstruise
  un outil retiré puis le gagne sous forme de macro (Cabri le permettait).

## Avancement

- Étape 0 faite (2026-10-26) : exception dans `AGENTS.md`, renvoi dans
  `EDITOR.md` (« Macro-constructions »).
- Étape 1 faite (2026-10-26) : `DGO.md`, « Macro-constructions » (clé
  racine `mac`, entrées `Mac` et `Out`, note 25, ligne `Mac` de l'état
  élève), validée par l'auteur : nom requis du nœud `Mac`, `branches` dans
  l'état élève et le `.dgo`, style d'un `Out` en écart aux défauts de son
  type ; sous-objets de la demi-droite (origine), de l'arc (centre, début,
  fin), de la sphère (centre), type `angle` (A, O, B) distinct de
  `number` ; une valeur réglable du corps est un initial manquant, le point
  mobile d'un lieu est accepté.
- Étape 2, moteur, faite (2026-10-26) :
    - `src/objects/macro_object.ts` : types d'initiaux, sous-objets, nœud
      `macro_object`. Les initiaux entrent dans le corps par des
      **doublures** (`Object.create` de l'objet de la figure, avec leurs
      propres liens et parties virtuelles) : le corps lit l'état courant de
      la figure sans entrer dans son graphe, et ses intersections suivies
      ont leurs propres groupes. Le corps est lu par les builders de
      `dgo.ts` dans une construction privée (`privateConstruction`), puis
      ses objets reviennent à la construction de la figure.
    - Le nœud calcule son corps, sauf ses finaux dont rien n'a besoin dans
      le corps, que la figure calcule après lui. Un final perd ses parents
      au profit du nœud (`output`) ; `objectEntry` l'écrit `Out`.
    - `construction.removeObject` retire le nœud avec son dernier final.
    - État élève : les branches du nœud, jamais les finaux.
    - Tests : `tests/browser/macros.test.ts` (aller-retour, méthodes,
      orientation des droites, inexistence, applications emboîtées,
      sous-objets, nombres, lieu, suppression, conique × conique et état
      élève, macros refusées).
    - Poids : moteur 363 756 → 369 689 octets (+5,9 Ko, +2,0 Ko en gzip).
    - Pas encore faits : cas en 3D. Dans l'éditeur, les lignes des nœuds et
      des finaux sont en lecture seule (étape 5).
- Étape 3, éditeur, définition, faite (2026-10-26) : interface décrite dans
  `EDITOR.md` (« Macro-constructions ») ; logique dans `src/editor/macro.ts`
  (initiaux et sous-objets, objets déterminés, ancêtres manquants, méthode
  tirée de la figure, enregistrement), panneau dans `macro_panel.ts`. Tests
  `tests/browser/macro_define.test.ts` et `macro_editor.test.ts` (éditeur
  intégré, de bout en bout). Poids : lecteur +113 octets (`objectStyle`),
  éditeur +12,5 Ko (+4,1 Ko en gzip).
    - Le test du déplacement n'est pas fait au glisser : les ancêtres
      manquants d'un final sont montrés d'emblée, ce qui revient au même.
    - Les images (`Img`) ne vont pas dans un corps : leur clé est celle de la
      figure.
    - Pas encore de pastilles de rang dans la figure : le panneau donne
      l'ordre.
    - Le manuel (étape 9) ne parle pas encore de la famille « Macros ».
- Étape 4, éditeur, application, en partie faite (2026-10-26) : macros de
  la figure dans le menu, désignation incrémentale entre méthodes, points
  créés à la volée (libres, sur objet, à une intersection), aide et
  messages dans la consigne, application dès qu'une méthode est complète
  (`designation`, `applyMacro` de `macro.ts`, `startApply` de `main.ts`).
  Le nœud est super-caché par défaut et sans ligne. Testé dans
  `macro_define.test.ts` et `macro_editor.test.ts`.
    - Les objets acceptés comme initial suivant ne sont pas mis en vert
      (décidé avec l'auteur) : la consigne suffit.
    - Faits ensuite : un nombre tapé dans la consigne, l'aperçu avant le
      dernier initial.
    - Anneau (décidé avec l'auteur) : une place « Macros », qui ouvre la
      liste des macros acceptant l'objet touché comme premier initial.
- Étape 5, langage textuel, faite (2026-10-26). Forme choisie par l'auteur
  (affectation multiple) : `O, c = Circonscrit(A, B, C)`, les finaux
  nommés dans l'ordre, `_` pour un final non voulu ; `I = Milieu(A, B)`
  pour une macro à un final ; `Circonscrit(A, B, C)` seul nomme les finaux
  d'après la macro. Détails dans `EDITOR.md` (« Macro-constructions »).
  Tests : `tests/unit/editor_text.test.ts`, `macro_editor.test.ts`.
    - Une application ne peut prendre comme initial un objet construit
      après elle (`macro_order`) : la redéfinition ne réordonne pas la
      construction, contrairement à celle d'une commande.
    - Une macro ne peut pas porter le nom d'une commande de la langue
      courante (ni de l'anglais) ; dans une autre langue, la commande
      l'emporte à la lecture.
- Étape 3 revue (2026-10-26) : définition en deux étapes (initiaux, puis
  « Suivant : les finaux », puis finaux), à la place de la règle
  automatique et de la bascule « Initial / Final » (voir « Définir une
  macro »). Le bouton est gardé après discussion avec l'auteur : à
  l'étape 1, un objet déjà déterminé (vert) peut être voulu comme initial
  (couper plus tôt), et seul le moment lève l'ambiguïté.

## Reste à faire

Dans l'ordre que choisira l'auteur :

- **Étape 6, « Ouvrir la boîte »** : remplacer une application par ses
  objets élémentaires, visibles et nommés.
- **Idées de CaRMetal retenues** (section ci-dessus) : bibliothèque
  (étape 7), menu au clic droit, initiaux fixés, image d'un objet.
- **Cas en 3D** : rien n'a été essayé (doublures des initiaux, `flat`,
  projection du corps).
- **Étape 9, manuel** dans les 12 langues (`npm run manual`) : la famille
  « Macros », la définition en deux étapes, l'application (menu, anneau,
  texte).
- Mesurer le poids du lecteur et de l'éditeur à chaque étape.
