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
- **CaRMetal** (E. Hakenholz, 2006, Java, sur la base de C.a.R. de
  R. Grothmann), où les macros avaient beaucoup compté. Les sources ne sont
  pas accessibles, mais le paquet installé l'est
  (`…/Lubuntu/carmetal/usr/share/carmetal/` du Drive de l'auteur) : le
  `CaRMetal.jar` (classes seules, lues par leurs noms, chaînes et appels) et
  les bibliothèques `fr_library.mcr` (140 macros), `library.mcr` (en, 87),
  `es_library.mcr` (98), en XML lisible. Ce qu'on y voit :
    - une macro est une construction ordinaire : initiaux
      `mainparameter`, sous-objets `parameter`, finaux `target`,
      intermédiaires super-cachés ; `<Parameter>` donne l'ordre et l'invite
      de chaque initial, `<PromptFor>` les nombres demandés (« Ask ») ;
    - un `.mcr` est une figure réduite à ses `<Macro>` : bibliothèque,
      export et macros d'une figure ont le même format ;
    - les dossiers sont le chemin écrit dans le nom
      (`Polygones/Quadrilatères/Carré`) ;
    - trois niveaux : `builtin.mcr` dans le jar (60 outils de CaRMetal
      écrits en macros : 3D, disque de Poincaré, tests…), la bibliothèque de
      la langue copiée dans le dossier personnel au premier lancement, les
      macros de la figure ;
    - bibliothèque ou figure tient à un booléen (`Protected`) : une figure
      n'enregistre pas les macros de bibliothèque, ce que permet le
      développement des macros ; à l'ouverture, un nom déjà pris est
      ignoré ;
    - « Cacher les doublons » : un final égal à un objet déjà présent est
      caché ;
    - un initial fixé est retrouvé par son nom dans la figure.

    Le chapitre « Macros » de son manuel (2011) :
    <http://carmetal2.free.fr/images/pdf/macros.pdf>. Ce qu'on y trouve,
    au-delà de ce mémo :
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
  possible et final choisi. Chaque objet de la macro est donc peint de la
  couleur unie de son état, quelle que soit la sienne : initiaux en bleu,
  leur rang dans une pastille à côté d'eux (comme dans le panneau), finaux
  possibles en gris, finaux choisis en orange, ce qui manque en rouge
  (décidé avec l'auteur le 2026-10-27, à la place d'un halo autour de la
  couleur propre : un utilisateur avait pris un initial vert foncé, sous son
  halo bleu, pour un final possible, sous halo vert). Pas de paire rouge et
  vert, que confondent les daltoniens. Un clic sur un initial à l'étape 2
  dit pourquoi il n'est pas pris.
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
  de ses finaux, l'aide (ordre et domaine de validité) et l'icône. Celle-ci
  est dessinée d'après la figure (`src/editor/macro_icon.ts`), dans le style
  des icônes d'outils : initiaux en gris, finaux en rouge, cadrés sur ce
  qu'ils montrent (une droite traverse le cadre sans l'agrandir). Elle suit
  la figure quand on la manipule, ce qui permet de choisir une configuration
  parlante. L'auteur peut la remplacer par une ou deux lettres tapées
  (« CC » pour un cercle circonscrit), en gris, ou par une image PNG ou SVG
  de son disque, le dernier choix l'emportant (demandé par l'auteur le
  2026-10-26, à la place d'un éditeur d'icône pixel par pixel que personne
  n'aurait utilisé). Dans tous les cas, c'est une image de la table `img`
  du `.dgo`. Enregistrer ferme le panneau (demandé par l'auteur le
  2026-10-26, à la place du mode laissé ouvert pour réordonner et
  enregistrer sous un autre nom) : VF-ET, VF-OU et VF-NON viennent
  toujours d'une seule figure, la sélection refaite à chaque macro.
- **Sous-objets** : chaque type d'initial expose une liste fixe et ordonnée
  de sous-objets (extrémités d'un segment, centre d'un cercle, points d'un
  vecteur, sommets d'un polygone), utilisables dans le corps (comme `CS` dans
  Cabri et `DefinitionPoint` dans DGPad). L'ordre porte le sens : [AB] et
  [BA] ne donnent pas le même résultat.
- **Le rayon numérique d'un cercle est une constante du corps** (décidé
  avec l'auteur le 2026-10-26) : un cercle de centre déterminé et de rayon
  donné par un nombre est déterminé, même visible et agrandi à la main dans
  la figure, comme les nombres d'une construction dans Cabri et CaRMetal.
  Les figures DGPad en usent comme astuce (96 cercles de rayon 0,01 dans
  `tests/dgp/Apollonius/_Apollonius.dgo`, sans lesquels ses trois cercles
  ne déterminaient rien). Un rayon donné par une expression suit, lui, les
  objets dont elle dépend.
- **Un point sur objet dont le support est déterminé est déterminé**
  (décidé avec l'auteur le 2026-10-27, la lacune venant des triangles et
  quadrilatères particuliers de CaRMetal, dont un sommet est libre sur une
  droite ou un cercle). Final, il reste manipulable après l'application :
  on le glisse le long de son support, chaque application gardant sa
  place, enregistrée avec la figure et modifiable dans l'état élève ;
  l'application le pose là où il était dans la figure de définition,
  transposé sur le nouveau support. Intermédiaire, sa place est une
  constante du corps, comme le rayon numérique d'un cercle (choix de
  l'auteur, plutôt que de le refuser comme initial manquant). Un final sur
  objet d'une application emboîtée est un intermédiaire de la macro qui
  l'applique : sa place y est figée. Ouvrir la boîte en fait un point sur
  objet ordinaire, à sa place. Un point libre reste interdit : il ne
  dépendrait d'aucun initial.
- **Un objet sans parent n'est déterminé que s'il est initial**
  (2026-10-28), comme dans DGPad et GeoGebra : un point fixe ou à formule
  constante est un initial manquant. Le test « tous ses parents sont
  déterminés », vrai d'office pour un objet sans parent, l'acceptait par
  effet de bord, et toute la figure qu'il porte (la sphère et ses repères
  de `Horisphere_PourMacro.dgo`) s'allumait en finaux possibles.
- **Un script qui met un objet en forme n'en est pas une source**
  (2026-10-28) : le moteur fait d'une expression comme
  `stA.setHidden(ChSt==0)` un parent de `stA` pour la calculer avant lui,
  lien que DGPad n'a pas (l'expression y dépend de `stA`). La définition
  l'ignore, comme la condition d'affichage : il n'entre pas dans le corps,
  et ses cases à cocher ne sont pas des initiaux manquants.
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

### Initiaux fixés

Demandés par l'auteur le 2026-10-27, pour les macros du disque de
Poincaré, qui prennent toutes le disque en premier initial :

- **À la définition**, un cadenas sur la ligne d'un initial le fixe. Il
  est alors cherché par **le nom de l'objet désigné** (`Hz`), comme les
  `=Hz` de CaRMetal : les macros définies à partir du même objet partagent
  leur initial fixé, sans réglage de plus.
- **À l'application**, un initial fixé est pris sans le demander quand
  l'éditeur trouve l'objet désigné la dernière fois pour ce nom (par
  n'importe quelle macro, dans cette session), ou à défaut un objet de la
  figure qui porte ce nom, du type attendu. Sinon, il est demandé comme
  les autres, et l'objet désigné est retenu. Il est mis en bleu avec les
  initiaux désignés, et la consigne compte son rang (« 2/3 – … »).
- Il n'est pris d'office que si **toutes les méthodes encore possibles**
  l'attendent à ce rang, sous le même nom, et jamais s'il compléterait
  une méthode : une application ne se fait pas sans un toucher.
- **Changer** : la consigne porte un bouton « Changer Hz », qui revient à
  ce rang et le demande, l'objet désigné remplaçant le précédent.
- Le menu, l'anneau et la sélection en tiennent compte : une macro dont
  le disque est connu se propose pour un point, son initial suivant.
- La mémoire est celle de l'éditeur ouvert, par le nom de l'objet : elle
  survit à l'annulation, qui reconstruit la figure, mais pas au
  rechargement de la page, où le nom retrouve l'objet. Rien n'est ajouté
  aux objets de la figure.
- Le langage textuel écrit tous les initiaux, fixés compris
  (`l = DroiteH(Hz, A, B)`).
- **Gardés le temps de l'outil** (2026-10-30) : sans cadenas, un initial
  désigné avec Maj, ou gardé par le bouton « Garder » de la consigne, est
  repris avec ceux qui le précèdent d'une application à l'autre, jusqu'à
  la sortie de l'outil, comme les arguments gardés des outils
  (`EDITOR.md`). « Changer » redemande alors tout depuis le premier. Les
  objets donnés avant la macro (anneau, sélection) n'ont pas de bouton
  « Garder ».

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
    - un final n'est jamais déplaçable, sauf un point sur objet, qui se
      glisse le long de son support (ci-après) ;
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
- État élève : les finaux ne sont pas modifiables, sauf un point sur objet
  (sa place) ; leurs noms sont stables.

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

### Voir le programme

Décidé avec l'auteur le 2026-10-28, plutôt qu'une boîte transparente (les
intermédiaires en fantômes, illisibles par milliers, comme dans les 8
cercles d'Apollonius) ou un second dépliage dans le panneau de construction,
qui en a déjà un pour les finaux :

- Un bouton `</>` (« Voir le programme ») dans le bandeau de l'application,
  entre le nom de la macro et « Terminé », et dans les actions d'un final
  sélectionné, après « Ouvrir la boîte ».
- Il ouvre une fenêtre en lecture seule : pour chaque méthode, son aide, ses
  initiaux (rang, nom, sous-objets entre parenthèses, message), puis le
  corps dans le langage textuel, une ligne par objet, les finaux en gras.
  Rien ne change dans la figure.
- Les initiaux déjà désignés y portent leur nom dans la figure, leurs
  sous-objets aussi quand elle les a ; un objet du corps qui aurait le même
  nom est renommé (`O` devient `O1`). Les autres prennent le nom qu'ils
  avaient dans la figure où la macro a été définie (clé `n` des méthodes,
  ajoutée le 2026-10-28 à la demande de l'auteur), celui dont parle l'aide
  (« l'axe d, le centre O, puis un point M ») ; à défaut, ou si ce nom est
  pris par un initial désigné, ils sont nommés comme l'éditeur nomme ce
  qu'il crée. Une application d'une autre macro dans le corps
  est une ligne, qui ouvre le programme de cette macro ; un fil d'Ariane
  au titre ramène aux précédentes.
- **Noms traduits** (demandé par l'auteur le 2026-10-28) : les noms des
  intermédiaires d'une macro de la bibliothèque fournie, qui deviennent
  visibles, se traduisent dans les 12 langues quand ce sont des mots
  (variables des programmes, `milieu`…), pas les lettres. Pas encore fait.
- Pas de copie du programme vers la Saisie (essayée puis écartée par
  l'auteur le 2026-10-28) : « Ouvrir la boîte » sert à cela.

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
   (voir « Bibliothèque »).
8. Éventuellement, les outils GeoGebra en nœuds d'application.
9. **Manuel** dans les 12 langues (`npm run manual`).

Mesurer le poids du lecteur et de l'éditeur à chaque étape. Noter
l'avancement à la fin de ce mémo.

## Idées de CaRMetal retenues

Retenues par l'auteur le 2026-10-26, à placer dans les étapes (voir
« Références étudiées », CaRMetal) :

- **Bibliothèque** (étape 7) : macros fournies, rangées en dossiers, et
  « ajouter à la bibliothèque » pour qu'une macro soit là à chaque
  ouverture (section « Bibliothèque »).
- **Menu au clic droit** : un clic droit dans le vide ouvre un menu
  flottant des macros, à l'endroit de la souris.
- **Initiaux fixés** : un initial désigné une fois puis gardé d'une
  application à l'autre (centre, rapport, angle d'une similitude). Fait le
  2026-10-27 (voir « Initiaux fixés »).
- **Image d'un objet** : une macro de transformation ponctuelle appliquée
  à une droite, un cercle, un polygone donne son image (lieu des images),
  avec aperçu au survol. Fait le 2026-10-30, en mieux : l'image est de la
  nature trouvée à l'application (droite, cercle, conique, sinon lieu),
  voir `TRANSFORMATIONS.md`.

## Bibliothèque

Décidé avec l'auteur le 2026-10-27, après étude de CaRMetal (voir
« Références étudiées »), dont on garde les idées sans le recopier.

- **Deux sources.** La **bibliothèque fournie**, livrée avec le logiciel,
  en lecture seule et chargée à la demande, hors du poids de l'éditeur.
  **Mes macros**, qui la complètent, dans la seule version autonome (barre
  de menus) : dans le stockage du navigateur (`localStorage`), propre au
  site et effaçable, d'où « Exporter mes macros » et « Importer des
  macros » pour les reprendre dans un autre navigateur. Ni bibliothèque
  fournie ni « Mes macros » dans une iframe (DocTools) : seulement dans la
  version autonome (décidé avec l'auteur le 2026-10-27).
- **Un nom déjà pris** (décidé avec l'auteur le 2026-10-27) : importer ou
  ajouter à mes macros une macro dont le nom est celui d'une de mes macros,
  différente, ouvre une alerte qui propose de les remplacer, toutes à la
  fois ; refusé, mes macros restent. De même quand on applique une macro de
  bibliothèque dont la figure a une autre version. Une macro de mes macros
  ne prend pas le nom d'une macro fournie, sauf à en être la copie exacte
  (une dépendance) : elle n'est alors pas montrée dans « Mes macros ».
- **Même format que les figures** : une bibliothèque est un `.dgo` sans
  objets, réduit à sa table `mac` (comme le `.mcr` de CaRMetal). Importer
  des macros, c'est aussi les reprendre d'une figure ou d'un enseignant.
- **Dossiers et sous-dossiers**, hors du nom : le nom d'une macro est une
  commande du langage textuel (`Circonscrit(A, B, C)`) et reste unique dans
  la bibliothèque fournie et mes macros réunies. Le champ du dossier est à
  ajouter dans `DGO.md` (règles d'évolution).
- **Appliquer une macro de bibliothèque recopie sa définition dans la
  figure**, qui reste autonome (contrairement à CaRMetal, qui pouvait ne
  pas enregistrer ses macros de bibliothèque parce qu'il les développe). La
  copie garde son origine et sa version, pour signaler plus tard une
  version plus récente (voir « Questions ouvertes », modifier une
  définition).
- **Noms traduits** : la bibliothèque fournie donne, dans les 12 langues de
  l'éditeur, le nom de chaque macro, de ses finaux, son aide et le message
  de chaque initial ; le corps est commun.
- **Menu « Macros »** dans la barre de menus, entre « Affichage » et
  « Outils » (proposé par l'auteur) : « Nouvelle macro », « Macros de la
  figure ▸ » (en sous-menu : une figure peut en avoir beaucoup),
  « Bibliothèque ▸ » et « Mes macros ▸ » (dossiers en sous-menus),
  « Ajouter à mes macros ▸ », « Gérer mes macros… », « Importer des
  macros… », « Exporter mes macros… ». La famille « Macros » du menu des
  outils et l'anneau restent, seuls accès dans une iframe.
- **Onglet « Macros » de la palette** (décidé avec l'auteur le 2026-11-05,
  voir `EDITOR.md`, « Palette d'outils ») : « Mes macros » et la bibliothèque
  fournie, par dossiers. Chaque section de la bibliothèque a sa teinte, dans
  l'onglet comme sur les icônes du menu (`SECTION_HUES` de `library.ts`,
  dans l'ordre de ses sections, qu'un test vérifie dans les 12 langues : une
  section ajoutée demande sa teinte). Une section au même thème qu'une
  famille d'outils en reprend la teinte : Cercles (145), Quadrilatères et
  formes (185), Constructions (265), Transformations (320). Les autres :
  Triangles (215), Coniques (35), Géométrie projective (65), Géométrie
  hyperbolique (95). « Mes macros » et les macros de la figure gardent le
  rouge de la famille (0).
- **Gérer mes macros** : un dialogue plutôt qu'un panneau, la figure
  n'ayant rien à y faire. Chaque macro, rangée sous son dossier, a son nom
  et son dossier (« Coniques / Éléments », avec les dossiers existants
  proposés) modifiables, et se supprime, sauf si une autre l'applique ; un
  rappel dit d'exporter. Le dossier se tape plutôt qu'il ne se glisse :
  plus simple, au doigt comme à la souris.
- **Reconstruites avec l'éditeur**, jamais converties des `.mcr` : chaque
  macro refaite est un test de recette de la définition, et son corps est
  propre, sans les astuces de CaRMetal.
- Un futur mode « kiosque » permettra à l'enseignant de retirer des outils
  et des macros aux élèves (voir « Questions ouvertes », restriction des
  outils).

### Icônes de la bibliothèque fournie

Depuis le 2026-10-31, chacune des 75 macros fournies a un dessin SVG dédié
dans `tools/macros/icons.mjs`, indexé par son nom anglais. Même style que
les outils géométriques : cadre de 32 unités, points bleus cerclés,
contours sombres, résultat rouge et surfaces légèrement colorées. Les
compositions privilégient la lisibilité en petit ; les constructions
complexes montrent leurs éléments caractéristiques. Les droites et
segments du disque de Poincaré restent orthogonaux au bord.

`npm run macros` intègre ces dessins à la table d'images des bibliothèques
dans les 12 langues et refuse une macro sans dessin. Aucun code de dessin
n'entre dans le build du moteur, du lecteur ou de l'éditeur. Les macros
personnelles gardent leur miniature automatique, leurs lettres ou l'image
choisie par l'auteur.

La bibliothèque française passe de 45 106 à 22 709 octets ; les douze
bibliothèques, de 543 722 à 274 902 octets. Seules leurs images et les
références d'icônes changent : corps, styles, aides et signatures conservés.
Les fichiers JS et CSS du build restent identiques octet pour octet.

### Contenu de la bibliothèque fournie

Tri des 140 macros de `fr_library.mcr` validé par l'auteur le 2026-10-27.

**Écartées** (≈ 110), parce que DocGeo le fait autrement : codage des
segments (propriété du segment) et de l'angle droit (marqué par l'angle),
polygones réguliers et lignes polygonales (outils), rotation, homothétie,
inversion et reports de mesure algébrique (outils), vecteurs, matrices,
coordonnées polaires, complexes et barycentres (expressions : un point est
un complexe), tangentes (outil Tangente), nombre dérivé (`f'(a)`), astuces
d'interface (barre de progression, curseurs, objets flottants et
magnétiques, grilles), interpolation par tangentes.

**Reprises de CaRMetal** :

- Triangles : isocèle, rectangle, isocèle rectangle, équilatéral.
  Quadrilatères : trapèze, cerf-volant, parallélogramme, losange,
  rectangle, carré (voulus par l'auteur, même si l'élève doit savoir les
  construire : le mode kiosque les lui retirera).
- Transformations : transformation affine (image de M par celle qui envoie
  ABC sur A′B′C′, qui remplace aussi le report barycentrique), conjugué
  harmonique, homologie harmonique.
- Construction de coniques : par directrice, foyer et excentricité ; par
  directrice, foyer et un point ; par cercle directeur et foyer (avec les
  sommets) ; par 3 points et un contact avec sa tangente ; par un point et
  deux contacts avec leurs tangentes ; les deux paraboles par 4 points ;
  l'hyperbole équilatère par 4 points.
- Éléments des coniques : centre, axes (le focal en premier ; orientation
  à surveiller), foyers et directrices, asymptotes (chacun fusionne
  plusieurs macros de CaRMetal), polaire d'un point.
- Formes quadratiques : q(x), forme polaire f(x, y), q(x) généralisée.
- Cercles : centres d'homothétie de deux cercles, tangentes communes, axe
  radical, cercles tangents à un cercle par deux points, cercles tangents
  à deux cercles par un point, centre d'Euler d'un quadrilatère.

**Ajoutées** (absentes de CaRMetal) :

- Classiques : cercle inscrit, cercles exinscrits, cercle et droite
  d'Euler, point de Fermat, droite de Simson, cercle d'Apollonius
  (MA/MB = k), cercles tangents à trois cercles, conjugué isogonal,
  symédianes et point de Lemoine, partage d'un segment en n parts égales,
  moyenne géométrique √(ab).
- Niveau universitaire (proposées par Claude, l'auteur en voulant) :
  birapport de quatre points alignés, homographie d'une droite par trois
  couples, droite de Pascal, point de Brianchon, centre et axe de
  perspective de deux triangles (Desargues), pôle d'une droite par rapport
  à une conique, diamètres conjugués, cercle principal, cercle orthoptique
  (de Monge), cercle orthogonal à deux cercles par un point, points limites
  d'un faisceau de cercles, centre radical de trois cercles, centre de la
  similitude directe qui envoie A, B sur A′, B′.

**Géométrie hyperbolique** (disque de Poincaré, demandée par l'auteur le
2026-10-27, comme les macros `DP_…` de CaRMetal) : droite, segment,
demi-droite, milieu, médiatrice, perpendiculaire (et son pied),
bissectrice, symétrie axiale, cercle (par un point ou de rayon donné),
cercle circonscrit (et son centre), distance, angle, horocycle,
hypercycle, parallèles limites, perpendiculaire commune. Le disque est un
initial fixé, de nom `Hz`, de centre et de rayon quelconques. Les
formules (`tools/macros/hyperbolic.mjs`) passent par les transformations
de Möbius du disque, robustes là où les constructions euclidiennes
(inverse d'un point, cercle par trois points) ne le sont pas : le centre
du disque n'a pas d'inverse. Une droite, un segment ou une demi-droite
hyperbolique est un arc, et son centre et son rayon suffisent aux macros
qui la prennent, quelle que soit sa nature : pas ses extrémités, qui,
pour un final, sont dans le corps de son application, où la boîte ne les
atteint pas. Un diamètre, arc par
trois points alignés, serait indéfini : son point du milieu est écarté de
la corde d'un dix-millième de sa longueur, invisible.

## Questions ouvertes

- Initial inutilisé, ancêtre d'aucun final : l'avertir ou le refuser ?
- Macros sur une courbe de fonction (minimum, maximum, intégrale de
  CaRMetal ; cercle osculateur, normale) : aucun type d'initial n'accepte
  encore une courbe. Laissées de côté (décidé avec l'auteur le 2026-10-27).
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
    - Les objets acceptés comme initial suivant ne sont pas mis en valeur
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
  l'étape 1, un objet déjà déterminé (gris) peut être voulu comme initial
  (couper plus tôt), et seul le moment lève l'ambiguïté.

- Étape 6, « Ouvrir la boîte », faite (2026-10-26) : action de la zone
  contextuelle sur un final, consigne et aperçu au survol, une étape
  d'annulation ; détails dans `EDITOR.md` (« Macro-constructions »).
  Choix de l'auteur : intermédiaires visibles, fin d'un arc absente de la
  figure refusée (pas de nouvelle entrée `.dgo`), une application à la
  fois. Le nœud garde les objets de son corps par indice local (`local`),
  et `describeDgo` expose l'écriture d'une entrée (`dgoEntry`). Tests
  `tests/browser/macro_open.test.ts` et `macro_editor.test.ts`. Poids :
  lecteur +79 octets (+39 en gzip), éditeur +3,0 Ko (+1,0 Ko en gzip).
- Le corps d'une méthode garde le style de chaque objet, intermédiaires
  compris (demandé par l'auteur le 2026-10-26) : en ouvrant la boîte, un
  intermédiaire caché à la définition reste caché, et garde ses couleurs.
  Le lecteur accepte désormais un style sur toute entrée du corps
  (`DGO.md`, « Macro-constructions »).
- Enregistrer une macro ferme le mode, panneau et consigne compris
  (demandé par l'auteur le 2026-10-26) ; le message « Macro enregistrée »
  disparaît avec lui.
- Étape 7, bibliothèque, faite (2026-10-27) :
    - format : clé `d` (dossier) d'une macro de bibliothèque, dans `DGO.md`
      (« Bibliothèques de macros ») ;
    - `src/editor/library.ts` : lecture et écriture d'une bibliothèque,
      fusion d'une macro et de celles qu'elle applique (`merge`, par leurs
      noms, réindexées, une macro remplacée déplacée après celles qu'elle
      applique), conflits (`conflicts`), « Mes macros » dans
      `localStorage` ; `my_macros.ts` : le dialogue ; menu « Macros » et
      sous-menus de la barre (`menus.ts`) ;
    - appliquer une macro de bibliothèque la recopie dans la figure, qui la
      retire si elle n'est pas appliquée ; remplacer une version de la
      figure la reconstruit, ou la laisse telle quelle si ses applications
      ne vont pas aux nouvelles définitions ;
    - bibliothèque fournie : `npm run macros` (`tools/macros/build.mjs`)
      construit chaque macro de `tools/macros/library.mjs` par le code de
      l'éditeur (`methodOf`) à partir de sa figure
      écrite dans le langage textuel, et écrit `public/macros/<langue>.dgo`
      (chargé à la demande). Les icônes viennent de `icons.mjs` (depuis le
      2026-10-31, à la place de `macroThumbnail`). Les sources sont rangées
      par dossier
      (`triangles.mjs`, `quadrilaterals.mjs`, `circles.mjs`,
      `transformations.mjs`, `conics.mjs`, `projective.mjs`,
      `constructions.mjs`), chaque texte en 12 langues (`tr.mjs`). Le
      générateur refuse un nom pris par une commande dans sa langue, ou
      deux fois ;
    - les 59 macros de « Contenu de la bibliothèque fournie », sauf
      minimum, maximum et intégrale (courbes) ; à la place de leurs sommets
      sur objet, les triangles et quadrilatères ont un sommet libre sur son
      support (point sur objet final). Les éléments d'une conique, que les
      formules ne lisent pas (sauf son centre, `q.center()`), viennent de
      son équation, calculée dans un programme à partir de cinq points
      d'elle figés dans le corps (`programs.mjs`) : sans angle, car
      `atan2` rend des radians quelle que soit l'unité de la figure, comme
      dans DGPad ;
    - tests : `tests/browser/macro_library.test.ts` (aller-retour, fusion
      avec dépendances, conflits et remplacement, stockage, même
      bibliothèque dans les 12 langues, chaque macro fournie appliquée à
      une autre figure que la sienne et vérifiée géométriquement : angles,
      distances, tangences, birapports, équation des coniques) ;
    - une macro de bibliothèque se tape aussi dans le langage textuel
      (`a = AxeRadical(c, d)`) : complétée, recopiée dans la figure avec
      celles qu'elle applique, retirée si la ligne est refusée ;
    - un nom de macro admet les signes combinants (`\p{M}`) : les noms
      hindis étaient refusés ;
    - poids, étape 7 et finaux sur objet compris : lecteur (moteur)
      +295 octets (+141 en gzip), éditeur +12,5 Ko (+4,0 Ko en gzip) ; la
      bibliothèque d'une langue, chargée au démarrage de l'éditeur hors
      d'une iframe, pèse environ 41 Ko (`.dgo` compressé, icônes
      comprises) ;
    - un point sur objet peut faire partie du corps (ci-dessus) : troisième
      paramètre de `Out`, final déplaçable, état élève (`figure_state.ts`),
      règle de l'éditeur (`unbuilt` de `macro.ts`) ; tests dans
      `macros.test.ts`, `macro_define.test.ts` et `macro_open.test.ts` ;
    - pas fait : l'origine et la version gardées dans la copie d'une macro
      de bibliothèque. Comparer les définitions suffit à reconnaître une
      autre version (alerte de remplacement) ; ce n'est à faire que si l'on
      veut dire laquelle est la plus récente.
- Étape 9, manuel, faite (2026-10-27) : page « Les macros »
  (`public/tutorials/<langue>/macros.html`, dans les 12 langues : créer,
  appliquer, au clavier, ouvrir la boîte, bibliothèque, mes macros), famille
  « Macros » de la page du menu des outils, icône de « Nouvelle macro »
  (`npm run manual -- icons`). Pas de capture d'écran pour l'instant.

- Initiaux fixés et géométrie hyperbolique, faits (2026-10-27) :
    - format : troisième élément d'un initial, le nom par lequel il est
      cherché (`DGO.md`, « Macro-constructions ») ;
    - éditeur : cadenas du panneau (`macro_panel.ts`), `withFixed`,
      `rememberFixed` et `firstFixed` de `macro.ts`, bouton « Changer » de
      la consigne (`main.ts`) ;
    - bibliothèque : 16 macros du dossier « Géométrie hyperbolique »
      (`tools/macros/hyperbolic.mjs`, option `fixed` d'une méthode) ;
    - tests : `macro_define.test.ts` (nom, mémoire, jamais le dernier
      initial), `macro_editor.test.ts` (demandé une fois, « Changer »,
      cadenas enregistré), `macro_library.test.ts` (chaque macro vérifiée
      dans un disque décentré : orthogonalité au bord, distances
      hyperboliques, inversions ; diamètres ; perpendiculaire commune des
      droites que trace `LineH`) ;
    - poids : lecteur (moteur) +65 octets (+25 en gzip), éditeur
      +1,7 Ko (+0,5 Ko en gzip) ; bibliothèque d'une langue 40,7 →
      44,9 Ko.

- Ouvrir la boîte, correction (2026-10-27, signalé par l'auteur) : la
  boîte de `PerpendiculaireH` appliquée à une droite de `DroiteH` vidait
  la figure. Les extrémités de cette droite, sous-objets de l'initial, sont
  des objets du corps de `DroiteH`, absents de la figure : le `.dgo` réécrit
  y renvoyait, et ne se lisait plus. Un sous-objet n'est plus qu'un objet
  de la figure, ou celui dont il est la doublure (`figureObject` de
  `macro.ts`) ; à défaut, la boîte refuse de s'ouvrir (`open_box_point`).
  Les macros hyperboliques qui prennent une droite lisent désormais son
  centre et son rayon, que la boîte sait écrire (`Ctr`), plutôt que ses
  extrémités : leurs boîtes s'ouvrent. Tests dans `macro_open.test.ts` et
  `macro_library.test.ts`.

- Annuler pendant l'application, correction (2026-10-27, signalé par
  l'auteur) : une macro de la bibliothèque n'est recopiée dans la figure
  qu'à sa première application ; annuler celle-ci rendait une figure sans
  la macro, que l'outil, encore en main, cherchait par son rang : une
  exception dans la reconstruction bloquait la chaîne des changements de
  l'éditeur, panneau figé, enregistrement d'un fichier vide. L'outil
  retient désormais sa macro et ses initiaux par leurs noms, et se ferme
  si la figure n'a plus sa macro ; une étape qui échoue est dite et
  n'arrête plus les suivantes (`EDITOR.md`). Test dans
  `macro_editor.test.ts` (macro définie, appliquée, définition annulée).
  Vu en ouvrant la boîte d'une macro hyperbolique sur un disque nommé
  `a` : la ligne d'une formule du corps écrivait `var a = …` près du `a`
  du disque, et la relire changeait la figure. Une variable propre qui
  prendrait le nom d'un objet lu est renommée dans la ligne (`EDITOR.md`,
  « Ouvrir la boîte » ; test dans `editor.test.ts`).

- Déplacement d'un final sur objet, correction (2026-10-28, signalé par
  l'auteur sur `Rectangle`) : invalider le final seul laissait son corps
  privé inchangé et recalculait ses dépendants selon l'ordre des finaux,
  différent de celui du corps (C avant D). Le déplacement invalide
  désormais le nœud d'application, qui recalcule le corps dans son ordre
  avant les finaux. Tests : déplacements rapides de D dans la macro fournie,
  intermédiaire privé, macro emboîtée et dépendant extérieur
  (`macro_library.test.ts`, `macros.test.ts`). Moteur partagé : +16 octets
  (+4 en gzip) ; code propre au lecteur et à l'éditeur inchangé.

## Reste à faire

Dans l'ordre que choisira l'auteur :

- **Idées de CaRMetal retenues** (section ci-dessus) : menu au clic droit,
  image d'un objet.
- **Cas en 3D** : rien n'a été essayé (doublures des initiaux, `flat`,
  projection du corps).
- Mesurer le poids du lecteur et de l'éditeur à chaque étape.
- **Voir le programme** : traduire les noms des intermédiaires de la
  bibliothèque fournie.
