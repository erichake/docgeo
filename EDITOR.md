# Éditeur de constructions — mémo de conception

Décisions prises avec l'auteur (conversation du 2026-10-11), avant tout code.
Le chantier est ouvert depuis le 2026-10-11 (exception dans `AGENTS.md`) ;
son avancement est à la fin de ce mémo.

## Positionnement

- `index.html` reste le **lecteur** (et son mode intégré `?embed`), inchangé.
- L'éditeur est une page distincte, **`editor.html`**, dont le code vit dans
  **`src/editor/`**.
- La dépendance est **à sens unique** : l'éditeur importe le moteur, le moteur
  et le lecteur n'importent jamais `src/editor/`. Un test le vérifie.
- L'éditeur est dans la même page que le moteur et l'appelle directement :
  pas de pilotage par `postMessage` comme le mode intégré, trop lent pour la
  présélection, l'aperçu qui suit le pointeur et la désignation à chaque
  mouvement.

## Build

- **Un seul build Vite pour les deux pages** (`vite.config.ts`,
  `npm run build`, `zz_build_for_doctools.command`), dans
  `doctools_MAIN/public/apps/docgeo`, que DocTools envoie en production :
  `index.html` (lecteur) et `editor.html` (éditeur). Deux builds vidant le
  même dossier (`emptyOutDir`) s'effaceraient l'un l'autre.
- Les deux pages partagent le fichier du moteur (`assets/engine-*.js`) ; le
  lecteur charge en plus `assets/index-*.js`, l'éditeur `assets/editor-*.js`.
  Le lecteur ne charge jamais le code de l'éditeur.
- On ne construit donc pas l'un sans l'autre : une modification de l'éditeur
  change aussi les fichiers publiés avec le lecteur.

## Coût pour le lecteur : 0 à 2 Ko

Le lecteur pesait 302 Ko (97 Ko en gzip) le 2026-10-11. L'éditeur ne doit pas
l'alourdir de plus de 0 à 2 Ko, ce que permet le découpage du build (le code
propre à l'éditeur reste dans son fichier) :

- tout le code propre à l'éditeur est écrit en **fonctions libres** dans
  `src/editor/`, **jamais en méthodes des classes d'objets**, que le
  tree-shaking ne retire pas (une méthode par classe d'objet finirait dans le
  lecteur) ;
- la désignation des objets sous le pointeur s'appuie sur ce que les objets
  savent déjà faire (`nearestPoint`, projections des aimants…) ;
- l'éditeur pose ses propres écouteurs sur le SVG, avant ceux du moteur, et
  crée son calque d'aperçu avec `dom.ts` ;
- les fonctions de création de `dgo.ts` sont exportées pour l'éditeur (un
  export ne coûte rien) ;
- annuler / refaire : un instantané `.dgo` par action (`writeDgo` /
  `readDgo`), assez rapides pour cela.

Seul un point d'accroche indispensable, s'il en faut un, est ajouté au
moteur. Mesurer la taille du lecteur à chaque étape.

## Deux modes de construction

Le meilleur de DGPad et de GeoGebra :

- **Désignation préfixée, comme DGPad** : on clique sur un objet, les outils
  qui le concernent apparaissent autour de lui, puis on désigne les autres
  arguments. Un clic dans le vide crée un point libre, sur un objet un point
  sur objet, près de deux objets une intersection.
- **Saisie textuelle, comme la barre de saisie de GeoGebra** :
  `M = Milieu(A, B)`, avec complétion des commandes et des noms d'objets
  filtrés par type.

Les deux modes produisent la même chose : un appel de commande typé
`nom = Commande(arguments)`, et ils se nourrissent l'un l'autre :

- une construction au geste affiche la ligne qu'elle produit : l'élève
  apprend le langage en manipulant ;
- pendant la saisie, un clic sur un objet de la figure insère son nom, et les
  objets acceptables pour l'argument en cours sont mis en évidence ;
- survoler une ligne fait briller son objet, et inversement ;
- une seule pile d'annulation.

## La construction est la source, le texte une projection

- Comme la vue Algèbre de GeoGebra : chaque objet s'affiche en une ligne
  `nom = Commande(args)`. Taper une ligne crée l'objet, modifier une ligne le
  redéfinit, déplacer un point libre met à jour ses coordonnées dans sa ligne.
- Les styles restent hors du texte (panneau de propriétés).
- `.dgo` reste le format de stockage. L'éditeur produit des **entrées `.dgo`**
  ajoutées à la figure, sans toucher aux classes internes : la validation est
  celle de la lecture, et tout ce qu'on construit s'enregistre.
- Une entrée `.dgo` et une ligne de texte se correspondent presque
  bijectivement. Tant que le format n'est pas diffusé, veiller à ce que chaque
  type d'objet `.dgo` garde une forme textuelle naturelle.

## Un catalogue de commandes unique

Chaque commande déclare sa signature (type de chaque paramètre et du
résultat), son nom localisé, son icône, son aide et l'entrée `.dgo` qu'elle
produit. Ce catalogue alimente :

- les outils contextuels (les commandes dont un paramètre accepte l'objet
  désigné) ;
- la complétion du texte ;
- la validation, ligne par ligne ;
- l'enregistrement.

Base existante : les types d'objets et de paramètres et la fonction `accepts`
de `src/import/dgp_commands.ts`.

## Langage textuel

- **Proche de GeoGebra, pas identique** : la syntaxe familière aux enseignants
  sur le noyau courant (points, droites, cercles, intersections,
  transformations, curseurs), sans ses bizarreries (règles de nommage
  automatique, commandes dont le résultat change de nature selon les
  arguments, messages d'erreur peu pédagogiques).
- **Aucune forme d'une commande n'en prolonge une autre** (décidé le
  2026-10-11) : les objets déjà désignés disent toujours si la ligne
  continue, donc si un clic écrit `, ` ou `)`. Les types peuvent départager
  les formes (`Milieu(A, B)` / `Milieu(s)`, `Cercle(O, A)` / `Cercle(O, 2)`),
  pas leur nombre d'arguments : là où GeoGebra prolonge une commande, on en
  crée une autre, dont le nom contient le sien (`CercleCirconscrit(A, B, C)`,
  `AutreIntersection(a, b, P)`), et taper l'ancienne forme propose la
  nouvelle. Exceptions : `Polygone`, au nombre de sommets libre, et les
  formes qui finissent par un nombre, tapé au clavier
  (`PointFixe(x, y)` / `(x, y, z)`). Un test vérifie la règle sur tout le
  catalogue.
- Noms de commandes localisés, les mots usuels de la géométrie dans chaque
  langue (section « Langues »), ramenés à une forme canonique.
- **Équations** (décidé avec l'auteur le 2026-10-15) : `c = x^2 + y^2 = 4`,
  les deux membres des formules en x et y, sans commande à traduire. Un
  `=` hors des parenthèses, sans `;` ni `{`, fait l'équation ; `y = 2x + 1`
  et `x = 3` en sont, comme dans GeoGebra (x et y ne nomment pas d'objet
  en tête de ligne). La nature est lue dans les coefficients du moment :
  degré 1, une droite (`EqL`) ; degré 2 de même coefficient en x² et y²
  sans xy, un cercle (`EqC`) ; sinon une conique (`EqQ`). Une équation de
  degré supérieur, ou qui n'est pas un polynôme (vérifié en trois points
  de plus), est refusée (`degree`). La ligne relit les deux membres tels
  qu'écrits. Une équation qui lit z (s'il ne nomme pas d'objet) est un
  plan (`PlE`), de degré 1 ; z en tête de ligne reste un nom : `z = 3` est
  une expression, le plan s'écrit `p = z = 3`.
- Réutilisation possible de `src/import/ggb_translate.ts` : une ligne tapée,
  ramenée à la commande GeoGebra canonique (nom, arguments, résultat), a la
  même structure qu'une commande du `geogebra.xml`. Il faudrait le découper
  pour traduire une commande à la fois.
- Grammaire fermée, lue par notre interpréteur (comme `dgp_formula.ts`),
  jamais par `eval`.
- Éditeur de texte : une saisie ligne à ligne avec une liste de complétion
  maison plutôt que CodeMirror ou Monaco, bien plus lourds.

## Langues

Décidé avec l'auteur le 2026-10-13 : l'éditeur parle les 12 langues de
DocTools (`ar`, `de`, `el`, `en`, `es`, `fr`, `hi`, `it`, `nl`, `pt`, `zh`,
`zh-TW`), choisies comme pour le lecteur (`LANG` de `src/i18n.ts` : paramètre
`lang` de l'URL, puis langues du navigateur).

- **Textes** : un fichier par langue dans `src/editor/lang/`. `en.ts` est la
  référence (il définit les clés, `MessageKey`) et le seul chargé avec
  l'éditeur ; les autres sont des chunks chargés à la demande, un seul par
  page (`messages.ts`, `await` au chargement du module). Une clé absente
  d'une langue s'affiche en anglais, mais un test exige que toutes les
  langues traduisent tous les messages, avec autant de `%` : **tout nouveau
  texte de l'éditeur est une clé ajoutée dans les 12 fichiers.** Jamais de
  phrase composée de morceaux (« Désignez » + « un point ») : l'accord
  change d'une langue à l'autre, d'où une phrase entière par cas
  (`designate_point`…).
- **Noms de commandes : les mots usuels de la géométrie scolaire dans
  chaque langue**, des noms (`Spiegelung`, pas le verbe `Spiegle`), au
  singulier, ceux des messages de la langue (`वृत्त`, `二次曲線`).
  Établis par DocGeo (2026-10-14) et non tirés des fichiers de langue de
  GeoGebra, sous licence CC BY-NC-SA, incompatible avec la GPL : ne pas y
  recopier ses traductions. Beaucoup coïncident, ce sont les mots de la
  géométrie. Le nom anglais est accepté dans toutes les langues, celui de
  la langue s'affiche. Une commande composée garde le nom de sa forme
  simple (`AutreIntersection`, `CercleCirconscrit`).
- Deux commandes de même nom dans une langue (`Mittelpunkt` : `Midpoint` et
  `Center` en allemand) n'en font qu'une, départagée par ses arguments ; le
  test vérifie que c'est le seul cas.
- Noms comparés sans casse ni accents latins et grecs ; les signes des
  autres écritures (voyelles du hindi) sont gardés, et acceptés par la
  complétion.
- **Arabe** : `lang` et la direction sur la page ; le panneau de propriétés
  passe de droite à gauche, les champs de code restent de gauche à droite,
  et chaque ligne de la bulle d'aide prend la direction de son texte
  (`unicode-bidi: plaintext`). Menlo et DejaVu Sans Mono dessinent les
  lettres arabes sans les lier : la police du code (`--dge-code`) les en
  exclut (`unicode-range`) pour une police arabe du système.

## Points délicats

- **Redéfinition** : changer les parents d'un objet peut casser l'ordre de
  construction, que le moteur suppose topologique (`sequence`,
  `objects_collector`). Réordonner, et refuser les cycles avec un message
  clair. Ajouter des objets à la fin préserve l'ordre.
- **Ambiguïtés que le geste résout implicitement** : l'intersection choisie
  parmi plusieurs, la position d'un point sur objet. Le texte les rend
  explicites (indice ou « le plus proche de », paramètre), et le geste les
  écrit dans sa ligne.
- **Erreurs partielles** : une ligne fausse reste affichée en erreur sans
  casser le reste.
- **Suppression** d'un objet dont d'autres dépendent : supprimer les
  dépendants (`construction.removeObject` le fait déjà) ou les marquer non
  définis.
- **3D** : le langage et la désignation doivent couvrir les figures 3D.

## Anneau d'outils

Décidé le 2026-10-11, pour ne pas dérouter l'élève devant un anneau de seize
icônes :

- **Familles à places fixes** : les outils sont regroupés par familles,
  séparées par un vide et teintées chacune d'une couleur (bande derrière les
  boutons, bord des boutons). L'anneau ne porte que des outils géométriques
  (2026-10-12) : les actions sur l'objet sont dans la barre (section
  « Actions sur l'objet sélectionné »). Dans le sens horaire depuis le haut :
  points (point sur objet, intersection, milieu ou centre) ;
  droites (segment, droite, demi-droite, vecteur) ; constructions
  (perpendiculaire, parallèle, médiatrice, bissectrice) ; cercles (centre et
  point, centre et rayon, trois points, sphère) ; polygone, angle et lieu ;
  transformations (symétries centrale et axiale ; famille renommée
  « Transformations » le 2026-10-15). Chaque outil garde toujours la même place, quel que soit l'objet
  désigné ; deux outils qui ne s'affichent jamais ensemble partagent une
  place (milieu de deux points, d'un segment, centre d'un cercle). La bande
  d'une famille couvre toutes ses places, même celles sans outil pour
  l'objet : l'élève retient la place autant que l'icône. Le rayon de
  l'anneau est donc fixe (152 px). Comme dans DGPad, « lieu » n'apparaît
  que sur un point dont dépend un point sur objet, et se crée d'un clic :
  le lieu du point quand se déplace le dernier construit de ces points sur
  objet. Le cercle centre et rayon se crée
  d'un clic, sans autre désignation : un rayon numérique d'environ 150 px
  à l'échelle courante, arrondi à deux chiffres significatifs, qu'un
  glisser du cercle change ensuite. Un objet sans outil géométrique (texte,
  expression, curseur…) n'ouvre pas d'anneau : le clic le sélectionne
  seulement. Près d'un bord de la figure, l'anneau
  se décale vers l'intérieur juste assez pour y tenir entier, plutôt que de
  se replier, ce qui déplacerait les outils ; un peu plus si l'objet
  tombait sous un bouton, qu'il reste visible au-delà. Un trait pointillé
  relie alors le centre de l'anneau à l'objet. L'anneau resté ouvert suit
  son objet quand on le déplace, lui ou ses parents, ou qu'on déplace ou
  zoome la vue : il reste accroché au point de l'objet le plus proche de
  là où il était, où « point sur objet » placera le point ; un polygone ou
  une sphère l'emmènent avec leur centre.
- **Ligne de l'outil** : survoler une icône affiche dans la consigne la
  ligne que l'outil écrira, ses arguments manquants en `…`
  (`M = Milieu(A, …)`), et ce qu'il reste à désigner. La consigne garde
  cette ligne pendant la désignation des arguments, au doigt comme à la
  souris.

Plus tard : des jeux d'outils choisis par l'enseignant (« Collège début »,
« Tout »…), enregistrés dans la figure ou passés par l'URL. Un anneau à deux
niveaux (familles, puis outils) seulement si l'anneau reste trop dense.

## Menu des outils

Décidé avec l'auteur le 2026-10-14 : une troisième façon de construire, à
la GeoGebra, l'outil choisi avant les objets.

- **Un bouton « Outils »** (une équerre et un crayon) à droite de la ligne de saisie ouvre
  un menu des familles de l'anneau, mêmes couleurs, même ordre, l'icône de
  leur premier outil ; chacune ouvre son sous-menu (survol à la souris,
  toucher au doigt), à côté du menu, ou par-dessus quand la fenêtre est
  trop étroite. L'élève n'apprend qu'un classement. Pas de recherche dans
  le menu : la complétion de la ligne de saisie le fait déjà.
- **Plus d'outils que l'anneau**, qui reste léger : à la fin de leur
  famille, `AutreIntersection` (points), `Compas`, `Arc`, `Secteur`,
  `ArcCentre`, `SecteurCentre` (le centre, le début, puis un point de la
  demi-droite où il finit), `DemiCercle`, et les familles « Plans » et
  « Solides » (3D),
  `Conique`, `Ellipse`, `Hyperbole` et `Parabole` (« Cercles, arcs,
  coniques »), ces trois-là comme dans GeoGebra : deux foyers puis un
  point, ou un foyer puis la directrice (au clavier, `Ellipse(F, G, a)` et
  `Hyperbole(F, G, a)` prennent aussi le demi-axe a). Toute commande du catalogue qui
  se construit par désignation y a sa place (`Rotation`, `Translation`
  et `Homothétie` à la fin des transformations ; tangentes… à mesure
  qu'elles s'ajoutent) ; `PointFixe`, `Curseur` et
  `Liste` restent au clavier ou dans la barre.
- **Un item par commande d'une place de l'anneau** (`Item` de `tools.ts`) :
  les formes d'une commande à la même place n'en font qu'un, le premier
  objet désigné choisit la forme comme il choisit les outils de l'anneau
  (`Milieu` de deux points ou d'un segment, `Médiatrice`, le cercle par
  trois points du plan ou de l'espace). Deux places d'une même commande
  ont un nom chacune : « Cercle (centre et point) » / « (centre et
  rayon) », « Symétrie centrale » / « axiale ». La sphère, les plans et
  les solides n'apparaissent qu'en 3D. Exception : « Section » a une seule
  forme au menu, qui prend n'importe quel solide (sphère, cylindre, cône,
  polyèdre), avant ou après le plan ; l'objet construit est celui de ses
  arguments (`formOf` dans `main.ts`).
- **Survol** : la ligne que l'outil écrira et ce qu'il faut désigner,
  comme sur l'anneau.
- **Désignation** : celle de l'anneau, sans clavier virtuel ; la ligne en
  cours s'affiche dans la consigne. Le premier objet peut prendre
  n'importe quelle place que son type accepte (une droite d'abord pour
  `Perpendiculaire`) ; à défaut, un point est créé là, libre, sur objet ou
  à une intersection. « Point » crée le point où l'on touche ;
  « Intersection » prend un croisement d'un toucher ou deux objets l'un
  après l'autre ; « Lieu » ne prend qu'un point dont dépend un point sur
  objet, « AutreIntersection » qu'un point déjà là.
- **Cercle (centre et rayon)** : comme sur l'anneau, le centre désigné
  suffit, le rayon d'environ 150 px se change ensuite en glissant le
  cercle ; rien à taper (décidé avec l'auteur le 2026-10-14, qui avait
  d'abord retenu un rayon tapé).
- **Rotation et homothétie** (décidé avec l'auteur le 2026-10-15) : le
  point puis le centre désignés suffisent, l'outil donne un quart de tour
  (90°, ou π/2 dans une figure en radians) ou un rapport de 2, que la
  ligne change ensuite.
- **Outil persistant** : après chaque objet, il attend de nouveau son
  premier argument. Le bouton prend l'icône de l'outil, enfoncé, aux
  couleurs de sa famille, et la zone contextuelle de la barre devient un
  bandeau (icône, nom, « Terminé »), comme pour les aimants. Ce bouton
  pressé quitte l'outil et rouvre aussitôt le menu, d'un seul clic. On en
  sort aussi par « Terminé », Échap, la croix de la consigne, un autre outil,
  le focus dans une ligne de texte, la gomme, les propriétés ou le pas à
  pas ; annuler, refaire et la vue 3D le gardent, sans ses arguments. Un
  toucher dans le vide crée un point : il ne peut pas faire sortir de
  l'outil. Pendant l'outil, un glisser vise (comme après un outil de
  l'anneau) ; le bouton droit, lui, glisse les objets et la vue, outil en
  cours ou non : sur un objet, l'éditeur lui passe l'appui comme un appui
  gauche, ailleurs la figure déplace la vue (la tourne en 3D). Au doigt,
  rien encore : il faut sortir de l'outil pour déplacer.
- **Petit écran** (600 px ou moins) : choisir un outil referme le panneau
  « Construction » et celui des propriétés, pour que la figure se voie
  entière.

### Sélection multiple

Décidé avec l'auteur le 2026-10-14 : l'objet d'abord, comme l'anneau, mais
pour plusieurs objets.

- ⌘-clic, Ctrl-clic, Maj-clic ou appui long (immobile au-delà du délai
  d'un clic, 700 ms : rien d'autre ne l'utilisait) ajoutent l'objet à la
  sélection, ou l'en retirent. L'objet dont l'anneau est ouvert en devient
  le premier. Chacun brille en bleu, son rang dans une pastille ; la
  consigne rappelle le geste, la barre montre les noms, « Supprimer »,
  qui les supprime tous (Suppr aussi), et « Réglages ». Un toucher simple,
  Échap, un outil, la gomme, annuler ou refaire la vident ; les propriétés
  la reprennent.
- Le menu des outils grise les familles et les outils qui ne prennent pas
  la sélection (`assign` dans `tools.ts`) : chaque objet, dans l'ordre,
  prend la première place libre qui accepte son type (droite puis point
  donnent `Perpendiculaire(P, d)`, les points gardent leur ordre). Le
  survol montre la ligne préremplie, le clic l'écrit et l'outil attend le
  reste ; complète, elle est construite aussitôt, le polygone fermé dès
  trois sommets (A, B, C puis « CercleCirconscrit » écrit
  `CercleCirconscrit(A, B, C)`). Sans sélection, l'objet dont l'anneau est
  ouvert sert de premier argument.
- **Propriétés de plusieurs objets** (2026-10-14) : « Réglages », ou le
  bouton « Propriétés » de la barre, ouvre le panneau sur la sélection.
  Panneau ouvert, le même geste (⌘-clic, Ctrl-clic, Maj-clic, appui long,
  et ⌘-clic sur une ligne du panneau « Construction ») y ajoute un objet ou
  l'en retire ; un toucher simple ou la liste reviennent à un seul. La
  liste montre leurs noms, une ligne dit qu'il y en a plusieurs ; ni nom ni
  définition. **Seuls les réglages communs à tous** sont affichés (décidé
  avec l'auteur le 2026-10-14, après un essai où chacun s'appliquait aux
  seuls objets qui l'avaient) : des points et un segment n'ont en commun
  ni taille ni épaisseur, mais couleur, opacité, calque, visibilité, nom
  affiché… Un réglage montre la valeur du premier objet, en italique gris
  (le nuancier en pointillé, la case indéterminée) si les autres en ont
  une autre. « Même type » s'étend aux objets des types sélectionnés.
  Annuler garde les objets du panneau, Suppr les supprime tous.

## Actions sur l'objet sélectionné

Décidé le 2026-10-12. Les utilitaires de DGPad (sa rangée grise : nom,
propriétés, corbeille, ancre, aimant, calculatrice, Blockly…) se
multiplieraient sur l'anneau au fil des implémentations. Partage :

- **l'anneau construit** à partir de l'objet (outils géométriques) ;
- **la barre agit** sur l'objet sélectionné (supprimer, redéfinir…) ;
- **le panneau de propriétés règle** ses attributs : ce qui, dans DGPad,
  était un outil mais ne change qu'un attribut (nom, ancre, trace…) y
  devient un champ ou une case ; pas les aimants, qui désignent d'autres
  objets de la figure (section « Aimants »), ni la punaise, bascule de la
  zone contextuelle à la demande de l'auteur (section « Punaise ») ;
- ce qui ne dépend pas de l'objet (calculatrice, modes) est un bouton
  permanent de la barre, comme la gomme.

Un nouvel utilitaire passe ce tri avant d'être placé.

La sélection d'un objet par un clic (avec ou sans anneau) fait apparaître
dans la barre une zone contextuelle, centrée entre les groupes permanents
de gauche et annuler / refaire : une pastille de la couleur de l'objet et
son nom (qui nomme aussi le groupe pour les lecteurs d'écran), puis ses
actions, la corbeille la première, en rouge. Pour les distinguer des
boutons carrés permanents, ses actions ont l'aspect des outils de
l'anneau, comme si elles en venaient : boutons ronds pastel sur une bande
en pilule, teinte grise de l'ancienne famille « objet », survol bleu plein
(rouge pour la corbeille). La zone glisse en place en même temps que
l'anneau s'ouvre, pour attirer l'œil vers la barre (sans mouvement si les
animations sont réduites) ; elle disparaît avec l'anneau, dès qu'un outil
de l'un ou une action de l'autre est appliqué, ou par Échap ou un clic
ailleurs. Panneau de propriétés ouvert, un clic sélectionne l'objet dans
le panneau sans anneau ni zone. Survoler une action affiche sa ligne dans
la consigne (`A =` pour supprimer). Suppr et Retour arrière suppriment
l'objet sélectionné, celui du panneau quand il est ouvert. Le bouton
« Propriétés » de la barre (curseurs) reste une bascule permanente : il
ouvre ou ferme le panneau, qui montre l'objet sélectionné. L'utilisateur
attend dans la zone contextuelle tout ce qui concerne l'objet : elle a son
propre bouton « Réglages » (roue dentée, icône distincte), un poussoir qui
ouvre le panneau sur l'objet, comme le faisait le bouton de l'anneau ; la
bascule passe alors à « on », ce qui montre que les deux mènent au même
panneau. L'objet sélectionné brille dans la figure, ce qui compte surtout
quand aucun anneau ne s'ouvre.

La barre est déjà pleine à 320 px : sous 680 px, la zone contextuelle
flotte, centrée, juste sous la barre, par-dessus le haut de la figure,
sans la décaler.

## Aimants

Décidé le 2026-10-12, l'idée de DGPad (son outil aimant, `MagnetManager`)
avec une interface plus parlante. Un point libre (le seul que le moteur
aimante quand on le glisse) a dans la zone contextuelle un bouton
« Aimants », le dernier, comme dans la rangée grise de DGPad. Il ouvre un
mode, qu'on doit voir et savoir quitter sans rien deviner :

- la zone contextuelle en devient le bandeau : « Aimants de P » et un
  bouton « Terminé » bleu, à la place des actions (Suppr n'agit plus sur
  le point) ; la consigne dit « … touchez le vide pour terminer » ;

- le point brille en bleu, ses cibles en rouge, comme dans DGPad, et le
  reste de la figure (grille et axes compris) passe sous un voile blanc
  (opacité 0,4, le `rgba(255,255,255,0.6)` de DGPad) ; un objet survolé en
  sort, pour montrer ce qu'un toucher désignerait ;
- toucher un objet en fait une cible, avec la dernière attraction réglée
  (20 px au départ), ou la choisit si elle l'était déjà ; un menu départage
  les objets superposés. Les cibles possibles sont celles du moteur
  (points, droites, cercles, coniques, listes, courbes), sauf le point et
  ses dépendants, qui bougeraient avec lui ;
- l'attraction de la cible choisie se règle par un curseur dans une carte
  posée au-delà de sa zone, sous l'endroit où elle attire le plus le
  point (au-dessus de la consigne), à la distance fixée quand la cible est
  choisie : la carte ne bouge pas pendant qu'on règle, seulement si la
  figure bouge. Les crans sont ceux de DGPad (« Aucune » retire l'aimant,
  1, 2, 5… 1000 px, « Partout ») ;
- nouveauté : la zone d'attraction de chaque cible est dessinée sous elle,
  en rouge pâle (la forme de la cible épaissie de l'attraction de part et
  d'autre, un disque pour un point), plus marquée pour la cible choisie ;
  on voit d'un coup tout le « champ » du point ;
- le point se glisse pendant le mode pour essayer ; zones et carte suivent
  la figure, glissée ou zoomée ;
- un toucher dans le vide quitte le mode, comme il ferme partout ailleurs
  (anneau, menu, sélection) ; « Terminé » et Échap aussi. En sortir par
  erreur ne coûte rien : les aimants restent. Chaque réglage est une étape
  d'annulation (au relâchement du curseur).

Le moteur garde parmi les aimants une cible supprimée : l'éditeur les
retire après chaque changement, sinon l'enregistrement ne pourrait pas la
nommer.

## Punaise

Décidé le 2026-10-12, l'outil punaise de DGPad (`FloatingObjectConstructor`,
style `fl`) : un point libre épinglé garde sa place dans la fenêtre, et non
ses coordonnées, quand on zoome ou déplace la vue ; il se glisse toujours.
Dans une figure plane, un point libre a dans la zone contextuelle, avant
les aimants comme dans DGPad, un bouton bascule « Épingler à l'écran »,
bleu quand le point l'est. Contrairement aux autres actions, la zone et
l'anneau restent ouverts après la bascule, pour montrer le nouvel état.
Son survol dit ce que fera le clic. Pas de bouton dans les figures 3D de
DGPad, où tous les points libres sont déjà épinglés au plan de l'écran,
ni dans les autres figures 3D, où DGPad en fait l'origine du repère.

Une ligne de texte modifiée déplace aussi un point épinglé. Chaque étape
d'annulation garde l'origine et l'unité de sa vue : elle est relue dans
cette vue, puis ramenée à la vue courante, pour qu'annuler après un zoom
ne déplace pas les points épinglés dans la fenêtre.

## Plan et espace

Décidé avec l'auteur le 2026-10-13, après l'essai d'une bascule
automatique (comme GeoGebra ouvre sa vue 3D), abandonnée : passer en 3D
change le calcul des formules (les points y ont trois coordonnées, plus
des nombres complexes), et une heuristique qui fait basculer la figure à
l'insu de l'utilisateur le déroute. La 3D est donc un choix explicite,
comme dans DGPad où elle se décidait à la création de la figure.

- **Bouton « Vue 3D »** (un cube) dans la barre, après « Repère », bleu en
  3D. Il n'apparaît pas dans les figures 3D de DGPad (`f2`), dont les
  points libres sont dans le plan de l'écran.
- **La caméra tourne** (`src/editor/space.ts`, 1,1 s, sans mouvement si
  les animations sont réduites) : la figure est relue en 3D vue de dessus,
  la projection de la vue plane, puis le plan bascule vers l'arrière comme
  une table vue de face, rasante et légèrement tournée (θ = π/12,
  φ = 5π/2 − 2π/15), et l'origine gagne le centre de la fenêtre, où la 3D
  la garde. Le plan bascule d'abord, puis tourne, les deux mouvements se
  chevauchant (accélération sans à-coup, _smootherstep_). Au retour, la
  caméra revient au-dessus du plan par le plus court chemin, en tournant
  d'abord puis en se redressant, puis la figure est relue en 2D.
- **Retour au plan refusé** tant qu'un objet dessiné est hors du plan
  z = 0 (point, ou point d'une liste, de cote non nulle ; sphère, plan,
  solide, patron, section de cylindre ou de cône) : la consigne le nomme (« A est hors du plan z = 0 : la
  figure reste en 3D »). Une expression, même de valeur `[1, 2, 3]`, n'est
  pas dessinée ; une perpendiculaire (`plumb_line_object`) est celle d'une
  droite, aussi dans le plan.
- **Dans une figure plane, un objet hors du plan est refusé**, quel que
  soit le chemin (`A = Point([1, 2, 3])`, `C = (2, 1, 1)`,
  `Sphère(A, B)`, action « Point » d'une expression `[1, 2, 3]`) : la
  figure revient à sa dernière étape et la consigne invite à passer en
  3D ; la ligne tapée reste dans le champ. Plus de cote jetée en silence.
  Une figure plane ouverte avec un objet hors du plan (aucune des 142 des
  tests) n'est pas soumise au refus.
- **Repère** : la 3D montre le trièdre et le plancher ; le retour au plan
  rend le repère tel qu'il était avant la bascule.
- **Annulation** : chaque bascule est une étape, qui garde de sa vue le
  seul mode (`3d`) ; annuler ou refaire à travers une bascule fait tourner
  la caméra. Les étapes attendent la fin de la rotation.

## Ressort

Décidé le 2026-10-12, l'outil ressort de DGPad (`SpringConstructor`) : on
anime un point sur objet en tirant un ressort depuis le point, la longueur
donnant la vitesse. Dans DGPad, le ressort se mesure du point au doigt : tiré
depuis un bouton de la barre, loin du point, il partirait au cran maximal.
Il est donc **accroché au point** :

- un point sur objet que le moteur anime (sur une droite, un segment, une
  demi-droite, un cercle, un arc, un polygone, une conique ou un lieu) a dans la zone
  contextuelle un bouton bascule « Animer » (un ressort), bleu quand il est
  enfoncé. Il sort sous le point un petit ressort au repos terminé par une
  boule bleue, dans le vide intérieur de l'anneau ; comme pour la punaise,
  la zone et l'anneau restent ouverts, et un second clic range le ressort,
  qui ne sort jamais sans ce bouton (décidé le 2026-10-12, après un essai
  où il sortait à chaque sélection). Le point lui-même se glisse toujours
  (la boule s'en tient à l'écart) ;
- on attrape la boule et on tire : la **longueur** donne la vitesse, par
  crans, ceux de DGPad (px/s le long d'une droite, d'un polygone ou d'une
  conique, °/s sur un cercle, % sur un lieu), écrits le long du ressort ; un cran fait au
  moins 30 px (25 dans DGPad sur les cercles et les polygones), pour que la
  boule au repos, en deçà du premier cran, reste loin du point ;
- le **côté** donne le sens, comme un élastique qu'on lâche : le point part
  à l'opposé de la traction, ce que fait DGPad sur une droite, avec une
  règle unique pour tous les supports. Le sens de marche est celui du
  moteur lui-même (un pas d'animation minuscule, mesuré à l'écran) ;
- tiré **en travers** d'une droite (à plus de 45°), le point fait
  l'aller-retour (`⇄`), comme dans DGPad ; sur les autres supports, il
  boucle toujours ;
- **un fantôme qui part, le point qui reste** : pendant qu'on tire, le point
  reste en place (déjà animé, il s'arrête), le ressort vraiment accroché à
  lui, et un fantôme pâle du point (son dessin et son nom) parcourt déjà le
  chemin à la vitesse et dans le sens du cran ; l'anneau disparaît.
  Relâchée, la boule revient vers le point comme un élastique qu'on lâche,
  le dépasse un peu et oscille en s'amortissant (0,45 s) : c'est quand elle
  passe par le point que celui-ci part, entraînant ses dépendants, et que le
  fantôme disparaît. Les animations en pause reprennent alors ; l'anneau et
  la zone se ferment, en une étape d'annulation. Ramené en deçà du premier
  cran, le ressort arrête le point ; relâché sans avoir bougé, il le laisse
  comme il était. Sans animation (préférence de réduction), le point part
  au relâchement. Le fantôme est un clone du dessin du point que le moteur
  fait avancer avec le point lui-même, prêté le temps d'un pas : aucun
  objet n'est ajouté à la figure ;
- **sorti sur un point déjà animé**, le ressort est tendu à sa vitesse (la
  boule au milieu de son cran, derrière le point ou en travers pour un
  aller-retour), et suit le point à chaque image. On reprend la boule pour
  changer la vitesse.

Le survol du bouton, comme celui de la boule, rappelle la règle dans la
consigne. Les réglages fins (vitesse quelconque, sens
inverse, « Arrêter » à l'extrémité) restent dans le panneau de propriétés,
seul accès au clavier.

DGPad n'anime pas les points sur une conique ; le moteur de DocGeo, si
(2026-10-12) : comme sur un polygone, `vitesse` pixels par seconde à
l'écran, par pas de 4 px au plus, chacun le long de la tangente puis
reprojeté sur la conique. Sur une ellipse, le point boucle ; sur une branche
de parabole ou d'hyperbole, infinie, il fait demi-tour là où il sortirait
de la fenêtre (il s'arrête s'il devait s'arrêter à l'extrémité), sans
changer de branche. Les animations GeoGebra de points sur conique, dont la
vitesse se rapporte au paramètre de GeoGebra, restent ignorées.

Les curseurs, que DGPad anime aussi au ressort, n'en ont pas encore. Un
toucher sur un curseur, comme sur un texte ou une expression, le
sélectionne (zone contextuelle, sans anneau) au lieu de créer un point ;
pendant une saisie, il écrit son nom ; sa poignée se glisse toujours.

## Noms des points

Décidé le 2026-10-12, comme dans GeoGebra : le nom affiché d'un point se
glisse à la souris ou au doigt, partout autour de lui, et suit exactement
le pointeur. Il s'enregistre en direction (`np`, celle de DGPad, qu'on
règle aussi dans le panneau de propriétés) et en distance (`nd`, en
pixels, deux fois la taille du point par défaut). Le nom ne recouvre
jamais son point (distance au moins nulle) et ne s'en éloigne pas de plus
de 80 px. Un point sous le pointeur l'emporte sur un nom. Survoler un nom
fait briller son point et donne le curseur « doigt ». Chaque glisser est
une étape d'annulation.

Les autres objets dont le moteur écrit le nom à la place de GeoGebra
(segment, droite, demi-droite, vecteur, cercle, arc, conique, courbe,
polygone : `nameAt`, item 24 de `GGB_IMPORT.md`) le montrent ou le masquent
par le panneau « Construction » et le panneau de propriétés, comme les
points. Contrairement à GeoGebra, ils sont créés sans nom affiché : seuls
les points en ont un à leur création (décidé avec l'auteur le 2026-10-14).
Leur nom se glisse et se renomme sur place comme celui d'un point
(2026-10-14), sans limite de distance. Tant qu'il n'a pas été glissé, il
est à la place que lui donne GeoGebra (milieu d'un segment, bord de la
fenêtre pour une droite…). Glissé, il garde sa place relative à l'objet
quand celui-ci change (`no`, décidé avec l'auteur) : la même fraction de
segment et le même écart de côté, le même angle sur un cercle… GeoGebra,
lui, garde un décalage fixe en pixels, qui laisse le nom en arrière quand
on déplace un point. Un toucher sur ce nom désigne son objet dans les
modes propriétés, gomme et aimant.

Décidé le 2026-10-14 : le toucher sans le glisser **renomme sur place**,
sans dialogue. Un champ remplace le nom, dans sa police, sa taille et sa
couleur, le texte sélectionné, suivi d'un bouton « Masquer le nom » (un
œil barré) ; la consigne dit comment valider. Entrée ou un toucher
ailleurs valident (ce toucher ne fait rien d'autre dans la figure), Échap
annule ; un nom vide ou pris est refusé en rouge dans la consigne, le
champ restant ouvert (quitté par un toucher ailleurs, il est abandonné).
Renommer et masquer sont chacun une étape d'annulation ; le nom se
réaffiche par le panneau de propriétés. Dans les modes propriétés, gomme
et aimant, le toucher sur un nom désigne toujours son point.

## Marques d'angles

Décidé le 2026-10-14, comme dans DGPad : la marque d'un angle (son arc, ou
celle d'un angle droit) se glisse pour en changer le rayon (`ar`), qui
suit la distance du pointeur au sommet, proportionnellement à celle où on
l'a prise (pas de saut au premier mouvement), entre 5 et 200 px comme le
champ du panneau de propriétés. Vaut aussi pour les angles fixes de DGPad
(`FA`). Un point, un nom ou un objet plus proche du pointeur passe avant ;
survoler la marque fait briller l'angle et donne le curseur « doigt ».
Chaque glisser est une étape d'annulation. Les angles deviennent aussi
désignables par leur marque (`pick`) : un toucher les sélectionne, la
gomme les cache, le panneau de propriétés les choisit.

## Gomme

Décidé le 2026-10-11, comme dans DGPad plutôt que par le menu contextuel de
GeoGebra (un objet à la fois, et un objet caché ne se retrouve que par son
nom ; pas de clic droit au doigt) :

- un bouton « Gomme » de la barre, permanent, active un mode : les objets
  cachés y apparaissent pâles (fantômes) et se désignent ; toucher un objet
  le cache ou le montre, plusieurs à la suite ; ni anneau ni point libre ;
  le glisser déplace toujours. Échap, le bouton ou le focus dans le texte
  en sortent.
- Les objets super-cachés (`h: 2` : objets internes des macros DGPad,
  objets auxiliaires de l'import GeoGebra, que GeoGebra ne dessine pas) ne
  deviennent jamais des fantômes.
- Un fantôme est montré (`hidden = 0`) pour être dessiné comme les autres,
  et caché seulement dans la figure enregistrée et dans la pile
  d'annulation (`eraser.ts`, `withGhostsHidden`).

## Barre d'actions et historique

Les actions sont des pictogrammes SVG dans une barre fixe en haut de la
fenêtre, au-dessus du panneau et de la figure. Groupes séparés : à
gauche ouvrir / enregistrer et gomme / repère / propriétés / historique ;
au bout de la barre, comme dans GeoGebra, annuler / refaire (décidé le
2026-10-12). La zone contextuelle de l'objet sélectionné se centre entre
les deux (section « Actions sur l'objet sélectionné »). Leur place reste la même quand le panneau est fermé. Chaque bouton a une
infobulle et un nom accessible ; les bascules montrent leur état en bleu.

Le panneau « Construction » se ferme par la croix de son en-tête ou par
le bouton historique de la barre, qui permet aussi de le rouvrir. La figure
récupère sa largeur sans changer les objets ; les consignes se recentrent
dans l'espace disponible. Le panneau glisse depuis la gauche en 240 ms,
avec un ralentissement doux, et la figure accompagne le mouvement. Les
préférences de réduction des animations sont respectées ; un panneau fermé
est retiré de la navigation au clavier dès le début du mouvement.
Sur les écrans de 600 px ou moins, le panneau
démarre fermé ; la barre reste sur une seule ligne à 320 px.

Décidé le 2026-10-14, comme la vue Algèbre de GeoGebra : chaque ligne du
panneau « Construction » commence par une pastille de la couleur de
l'objet, pleine s'il est visible, vide s'il est caché, qui le cache ou le
montre d'un toucher (en mode gomme, elle bascule son fantôme) ; les objets
super-cachés n'en ont pas. Une ligne d'objet dont la figure écrit le nom
(section « Noms des points ») finit par un bouton « nom » (un A et un
point) qui affiche ou masque le nom, discret tant que le nom
est masqué : il n'apparaît qu'au survol de la ligne (toujours, pâle, sans
survol). Chaque bascule est une étape d'annulation. L'en-tête compte les
objets ; la ligne de saisie, un champ arrondi, reste collée au bas du
panneau quand la liste défile.

**Valeurs** (2026-10-14) : un bouton « = 1 » de l'en-tête, éteint au
départ et non mémorisé, écrit en gris sous chaque ligne ce que le nom de
l'objet vaut dans une formule (`scriptValue`) : coordonnées d'un point,
longueur d'un segment, rayon d'un cercle, aire d'un polygone, mesure d'un
angle (en degrés avec `°`), valeur d'une expression. Rien quand la ligne
le dit déjà (point libre, constante). Les valeurs suivent les glissers.

**Pas à pas** (2026-10-14), comme la barre de navigation de GeoGebra : un
bouton « escalier » de l'en-tête rejoue la construction. Chaque objet
visible est une étape ; un objet caché va avec l'étape d'avant. Une barre
remplace la saisie : première, précédente, « Étape 3 / 10 », suivante,
dernière (ces deux-là disparaissent sous 270 px de panneau), lecture
(une étape par seconde) et pause ; ← → Début et Fin au clavier. Les
objets des étapes suivantes sont cachés dans la figure (`steps.ts`), pas
dans la figure enregistrée ni dans la pile d'annulation (`withHidden`,
comme les fantômes de la gomme) ; leurs lignes sont pâlies, celle de
l'étape montrée marquée, et la consigne la répète. Un toucher sur une
ligne va à son étape. Les points se glissent toujours, mais un toucher
dans la figure ne construit rien. Échap, le bouton, la fermeture du
panneau, la gomme, les propriétés, un outil, annuler ou le focus dans une
ligne en sortent, la figure entière revenant.

Les deux panneaux latéraux (construction et propriétés) se redimensionnent
en tirant leur bord intérieur (`src/editor/resize.ts`), qui s'éclaire en
bleu au survol ; un double-clic sur ce bord rend la largeur par défaut. La
largeur reste bornée par celle de la fenêtre (180 px au moins) et la figure
suit sans animation pendant le geste. Le panneau de propriétés garde deux
largeurs : l'ordinaire et la large (programme ou formule d'une expression,
480 px par défaut), réglables chacune ; la figure se décale aussi pour la
largeur large. Les largeurs ne sont pas mémorisées d'une session à l'autre.

## Panneau de propriétés

Le bouton « Propriétés » de la barre ouvre un panneau à droite. Un clic
dans la figure, sur une ligne de construction, ou un choix dans la liste du
panneau sélectionne l'objet. La liste permet de retrouver aussi les objets
cachés ; les objets super-cachés en sont exclus. Dans ce mode, un clic vide
ne crée pas de point et les boutons, cases à cocher et champs de la figure
se désignent sans s'actionner. Les points et les curseurs restent déplaçables.

Ce mode ne vaut que sans outil : le panneau ne bloque pas la construction
(décidé le 2026-10-15). Un outil choisi dans le menu « Outils », ou la
ligne de saisie, prend les clics comme panneau fermé, et chaque objet
construit s'affiche dans le panneau, prêt à être réglé. Ouvrir le panneau
garde l'outil du menu ; Échap lâche l'outil, puis ferme le panneau. L'anneau
ne s'ouvre pas tant que le panneau est ouvert. Écarté : un panneau qui
suivrait la sélection, figure toujours en mode construction, qui aurait
fait perdre la désignation des boutons et des cases sans les actionner, le
clic vide qui désélectionne et le clic sur un axe vers l'onglet « Figure ».

Les contrôles sont adaptés à l'objet : nom, couleurs, taille, opacités,
pointillés, calque, visibilité, nom affiché et décimales ; forme, position du
nom, trace et pas des points ; codage des segments ; rayon et marque des
angles droits ; échantillonnage des lieux ; segments des listes ; apparence
des curseurs et animation des points sur objet et des curseurs. Les styles
peuvent s'appliquer aux objets de la même classe. Une couleur (trait,
remplissage, bouton d'un curseur) différente de celle qu'un outil donne à un
nouvel objet du même type montre à côté de son nuancier un bouton ↺ qui l'y
ramène (chaque objet à la sienne, en mode « même type »). Les modifications sont
immédiates, enregistrées dans les styles `.dgo` existants et annulables ;
une saisie numérique ne produit qu'une étape d'historique à sa validation.
Les champs numériques se règlent aussi en cliquant-glissant horizontalement
à la souris : gauche pour diminuer, droite pour augmenter, Maj pour ralentir
d'un facteur dix. Chaque champ a sa vitesse (`SCRUB` dans
`src/editor/properties.ts`, l'étendue des champs dans `view_settings.ts`) :
un réglage borné parcourt sa plage utile en environ 200 pixels (opacité
0 à 100 %, épaisseur +10, calque +20, taille du texte +20, angle du nom
360°) ; une grandeur sans échelle naturelle (écarts, pas, incréments,
vitesse d'animation, nombre de points) varie de 1 % d'elle-même par pixel,
avec un minimum pour partir de 0 ou d'« auto », arrondie à deux chiffres
significatifs (trois avec Maj). Le pas et les bornes sont respectés ; un glissement ne
produit qu'une étape d'historique au relâchement. Un clic simple sélectionne
le nombre pour la saisie ; tant que le champ est en saisie, les gestes natifs
de sélection du texte restent disponibles. Le tactile garde la saisie native
et le défilement du panneau.
Le renommage reconstruit la figure à partir de son `.dgo`, en conservant
les références des dépendants, y compris les formules.

### Onglet « Figure »

Décidé le 2026-10-14. Le repère n'est pas un objet : il n'entre pas dans la
liste « Choisir un objet… ». Deux onglets sous le titre, « Objet » et
« Figure », séparent ce qui se règle sur un objet de ce qui se règle sur la
figure (`src/editor/view_settings.ts`). Un clic sur un objet ou dans la
liste ramène à « Objet » ; un clic sur un axe dans le plan ouvre « Figure »,
où un clic vide ne change pas d'onglet. Tant que « Figure » est affiché,
aucun objet n'est sélectionné (Suppr n'agit pas).

L'onglet expose les réglages de la vue `.dgo` existants, sans rien ajouter
au lecteur, et doit rester plus clair que le panneau de GeoGebra :

- **Repère** : un interrupteur (`ax`, comme le bouton « Repère ») et, dans
  le plan, six modèles en vignettes dessinées d'après leurs propres
  réglages (DGPad, GeoGebra, axes seuls, grille pointillée, quadrillage,
  millimétré). Un modèle remet toute l'apparence du repère, pas le zoom
  ni le fond ; celui qui correspond aux réglages en cours est surligné,
  aussi après une retouche à la main.
- Dans **Axes** : nom, nombres affichés et unité de chaque axe (π proposé, qui
  écrit les nombres en multiples de π/2), graduations, écart des nombres,
  flèches (DGPad, aucune, ouverte ou pleine de GeoGebra), couleur,
  épaisseur, taille et gras des nombres, style, demi-axes positifs.
- **Axes**, **Grille** (interrupteur `gr`), **Zoom et déplacement** : ce
  qui va par axe est dans deux colonnes _x_ et _y_ ; un maillon lie les
  deux écarts (`td`, `gd`), lié au départ s'ils sont égaux. Un écart vide
  affiche « auto » (0 dans le format). Graduations et trait de la grille se
  choisissent par icônes, le style DGPad / GeoGebra (`gg`) par un bouton
  double. La couleur de la grille suit celle des axes tant qu'elle n'est
  pas choisie (`gc` nul) ; un bouton l'y ramène.
- **Figure** : fond, degrés ou radians, segments au-dessus des polygones ;
  les deux derniers relisent la figure.
- Une couleur changée (axes, fond, grille, sol et ses lignes) montre à
  côté de son nuancier un bouton ↺ qui la ramène à son défaut : celle de
  DGPad, ou celle qu'elle suit (la grille les axes, les lignes le sol).
- En 3D, au lieu du repère plan, les sections reprennent ce qui est
  dessiné : **Axes** (interrupteur `ax` du trièdre seul : couleur,
  épaisseur), **Sol** (interrupteur `fl` : couleur, que son bouton ramène
  au bleu et brun de DGPad, opacité, taille, écart, couleur et épaisseur
  des lignes, leur couleur suivant celle du sol tant qu'elle n'est pas
  choisie) et **Vue**
  (perspective). Le bouton « Repère » de la barre montre ou cache les deux.

Un réglage masqué (repère ou grille éteints) reste réglable, atténué. Les
réglages s'appliquent en direct et chaque modification est une étape
d'annulation : une étape garde désormais toute la vue, sauf la fenêtre, le
cadrage (origine et unité) et la caméra (θ, φ). Le bouton « Repère » de la
barre devient lui aussi annulable, et ne rallume plus la grille : il cache
ou montre le repère tel qu'il est réglé.

Le panneau se ferme par sa croix, son bouton ou Échap. Sous 900 px, les deux
panneaux s'ouvrent alternativement ; sous 600 px, les propriétés recouvrent
la figure. La barre tient toujours sur une ligne à 320 px. Tout le code
et les styles CSS du panneau restent dans `src/editor/`.

## Expressions

Plan du 2026-10-12. Une commande polyvalente, comme dans DGPad : nombre,
formule, fonction, curseur, liste, programme. Le moteur sait déjà tout
faire : `expression_object` (valeur, fonction de x, y, z, t, programme,
curseur aux bornes fixes ou calculées, case à cocher, champ de saisie,
LaTeX, ancrage à un point), la grammaire fermée de `dgp_formula.ts`
(`parseFormula`, `parseProgram`, `formulaSource`, `formulaIdentifiers`,
`programReferences`, `programTargets`) et l'entrée `.dgo` `Ex` (`v`, `f` ou
`s`, `mn`/`mx`, `on`/`d`/`xy`). Le format ne change pas : il manque le
chemin de création de l'éditeur.

- **Une commande, une nature déduite du texte**, par la classification de
  l'import DGPad (`dgp_commands.ts`), sortie de l'import pour être partagée :
  constante (`a = 3`, `L = [1, 2, 3]`) → `v` ; fonction de x, y, z, t libres
  (`f = 0.5x^2-4`) → `f` ; formule ou script qui lit la figure
  (`E = d(H, M)`, `if(...){...};"..."`) → `s`. Case à cocher, champ de
  saisie et LaTeX sont des réglages d'affichage (panneau de propriétés),
  pas des natures.
- **Lecture d'une ligne `nom = …`** : `(x, y)` donne un point libre ; une
  commande du catalogue en tête, un appel de commande ; sinon
  `parseProgram`, une expression. Les fonctions de formule sont en
  minuscules (`d`, `sqrt`), les commandes en majuscules : peu de
  collisions. La ligne se relit par `formulaSource`, et `Ex` quitte la
  lecture seule.
- **Dépendances** : les `refs` sont les parents ; un programme est parent
  des objets qu'il stylise (`targets`), dont le refus des cycles de la
  redéfinition doit tenir compte.
- **Expressions en argument** : un paramètre `real` accepte une expression
  nommée (`Cercle(O, r)`), puis une formule en ligne (`Cercle(O, 2*r)`),
  que le `.dgo` stocke déjà pour `C1`, sans objet auxiliaire caché.
- **Curseur** (tranché le 2026-10-12) : une commande
  `Curseur(min, max, valeur)` (`Slider`), relue sous cette forme ; les
  bornes sont des nombres ou des expressions nommées, la valeur un nombre.
  `a = 5` sur un curseur en refait une constante : la ligne dit tout.
- **Programmes longs** (2026-10-12) : la section « Définition » du panneau
  de propriétés, plus large pour une formule ou un programme, édite la
  valeur, la formule ou le programme d'une expression qui n'est pas un
  curseur, sur autant de lignes qu'il faut ; la ligne de texte en montre la
  forme compacte. DGPad n'offrait qu'un champ d'une ligne. Entrée garde
  l'indentation (un niveau de plus après `{`), `}` en tête de ligne la
  retire, Tab indente, ⌘-Entrée ou Ctrl-Entrée applique (bouton
  « Appliquer »), Échap rétablit le texte appliqué ; les frappes passent
  par l'édition du navigateur, annulables comme elle. « Mettre en forme »
  met une instruction par ligne, indentée par ses accolades, en ne touchant
  qu'aux espaces et sauts de ligne entre les jetons. Une erreur désigne la
  ligne où la lecture s'arrête ou une parenthèse, un crochet ou une
  accolade qui ne correspond pas, et la sélectionne ; une méthode inconnue
  est nommée (`s.setColor(` : les méthodes sont celles de DGPad,
  `setRGBColor`…).
- **Nouveau programme** (2026-10-12) : un bouton `{ }` dans l'en-tête du
  panneau « Construction », près de la ligne de saisie (la barre d'actions
  est pleine à 320 px), ouvre le panneau de propriétés sur un programme à
  écrire : son nom (le prochain libre, modifiable) et la même zone
  multiligne, vide, avec un exemple en filigrane. L'expression n'est créée
  qu'au clic sur « Créer » (ou ⌘-Entrée), sans objet provisoire ; la ligne
  de saisie ne s'agrandit pas (pas de Maj-Entrée, décidé avec l'auteur).
- **Listes de points** (2026-10-12) : `L = Liste(p)` (`List`, entrée
  `ELst`) dessine les points de la valeur de l'expression `p`, coupés par
  un point indéfini, avec les instructions de la tortue ; `Liste(` ne met
  en évidence que les expressions. Comme les boutons de la calculatrice de
  DGPad, une expression dont la valeur est une liste de points a dans la
  zone contextuelle « Liste de points » et « Liste de segments »
  (épaisseur 1, réglable ensuite dans le panneau) : elles écrivent cette
  ligne et cachent le texte de `p`, en une étape d'annulation.
- **Déplacement** (2026-10-12) : comme dans DGPad, une expression se
  glisse par son texte (ou la piste de son curseur), qui suit le pointeur ;
  ancrée à un point, elle garde son ancrage et son décalage change. La
  poignée d'un curseur, une case à cocher ou un champ de saisie gardent
  leur geste, et un objet géométrique sous le pointeur passe avant. Un
  toucher la sélectionne toujours, ou écrit son nom dans la ligne en cours
  de saisie, désignation désormais faite au relâcher pour qu'un glisser
  reste possible pendant une saisie.
- **À trancher** : nature déduite (DGPad) ou déclarée (`f(x) = …`,
  GeoGebra), la recommandation étant de déduire en acceptant aussi
  `f(x) =`, qui lève l'ambiguïté d'un point nommé `x` ou `t`.

### Désignation au clic dans une formule

En tapant `E = d(`, un clic sur H puis sur M doit écrire `E = d(H, M)`,
comme pour `Milieu(A, B)`. Aujourd'hui, `completionAt` reconnaît l'appel
`d(` mais `findCommand("d")` ne trouve rien : ni mise en évidence, ni `, `
ou `)` après le nom, et le clic sur M remplace H (`insertWord` remplace le
mot avant le curseur). Dès qu'un opérateur est tapé (`AI-AM+`), le
tokenizer de la saisie, qui ne connaît que `( ) , =`, échoue et
`completionAt` renvoie `null`.

- **Signatures des fonctions de formule** dans le catalogue, avec le type
  `Overload` des commandes et un indicateur « fonction de formule » :
  `d(point, point)`, `x(point)`, `y(point)`, `sqrt(real)`… `overloadsAt`,
  `paramAt`, `accepts` et `insertArgument` servent alors tels quels : un
  clic sur H écrit `d(H, `, un clic sur M écrit `M)`, et seuls les points
  sont mis en évidence entre-temps.
- **`real` accepte une expression** dans une formule (`accepts` le refuse
  aujourd'hui) : le même changement que les expressions en argument des
  commandes.
- **Tokenizer de la saisie** : celui de `dgp_formula.ts`, réutilisé, pour
  que `+ - * / ^ < > [ ] ; { }` soient des jetons et que `completionAt`
  situe le curseur dans `AI-AM-`.
- **Nom en position libre** : après un opérateur, en tête de formule ou
  pour un argument de type quelconque, un clic insère le nom de tout objet
  lisible (`READABLE` de l'import), tous mis en évidence. Si le mot avant
  le curseur est déjà le nom complet d'un objet, le clic ajoute au lieu de
  remplacer : le remplacement ne sert qu'à compléter un mot en cours de
  frappe.
- **Complétion des fonctions** : en tête de formule ou après un opérateur,
  `d` ou `sq` proposent les fonctions de formule (`d( )`, `sqrt( )`) à côté
  des commandes.
- **Noms entre accents graves** : le parseur de formules doit accepter les
  noms que `formatName` écrit ainsi (`` `A 1` ``).
- Dans la ligne de saisie du bas, un clic dans le vide pendant `d(H, `
  crée un point libre, comme pour les commandes (`expectsPoint`).

## Lien avec le lecteur

Un lien « modifier cette figure » pourrait ouvrir la figure du lecteur dans
`editor.html` (par l'URL ou en passant son `.dgo`) : le lecteur reste le
format de diffusion, l'éditeur l'atelier.

## Avancement

Fait (2026-10-11) :

- `editor.html`, `src/editor/`, construits avec le lecteur (section
  « Build »).
- Point d'accroche du moteur : `addDgoEntries` (`src/dgo.ts`), qui ajoute des
  entrées `.dgo` après les objets de la figure et que `readDgo` utilise
  lui-même. Lecteur : 303 037 octets, `index` (15 196) + `engine` (287 841),
  soit +367 octets (+301 en gzip) ; l'éditeur ajoute 28,7 Ko (11 Ko en
  gzip) au moteur.
- Catalogue (`catalog.ts`) : signatures typées, noms français et anglais
  (comparés sans casse ni accents), écriture et relecture des entrées `.dgo`
  de `Pt`, `Fix`, `On`, `Mid`, `Line`, `Seg`, `Ray`, `Vec`, `Par`, `Perp`,
  `Med`, `Bis`, `Cir`, `C1` (rayon numérique), `C3`, `C3p`, `C3s`, `Arc`,
  `Sec`, `Ctr`, `Int`, `Poly`, `Ang`, `Sym`, `Refl`, `Quad`, `Sph`, `Loc`.
  Les autres objets s'affichent en lecture seule (`nom = …`).
- Langage (`text.ts`) : `nom = Commande(args)`, `A = (x, y)` ou `(x, y, z)`
  pour un point libre, `nom =` supprime ; noms non identifiants entre
  accents graves ; nombres arrondis à 4 décimales à l'affichage.
  Intersection : `Intersection(a, b)` pour deux droites, sinon
  `Intersection(a, b, n)` (n de 1 à 4) ; `AutreIntersection(a, b, P)`,
  la plus éloignée de P (l'ordre de l'entrée `.dgo`, qui ne sert que si P
  n'est pas défini, est remis à 0 par une redéfinition).
  Point sur objet : `Point(objet, t)`, ou `Point(objet, a, b)` sur un
  polygone ou une conique. Cercle par trois points :
  `CercleCirconscrit(A, B, C)`.
- Vue texte : une ligne modifiable par objet ; Entrée valide, Échap annule ;
  un point libre modifié change en place, sinon redéfinition (réordonnement
  topologique stable, cycles refusés, renommage, style gardé, réduit aux clés
  communes si le type change) ; complétion des commandes et des objets
  acceptés par l'argument en cours (selon les arguments déjà écrits), mis
  en évidence dans la figure ; un clic sur un objet (ou son choix dans la
  liste) insère son nom, suivi en fin de ligne de `, ` si toutes les formes
  possibles de la commande attendent un argument de plus, de `)` si aucune,
  de rien sinon (nom inconnu, polygone) ; redésigner le premier sommet
  d'un polygone ferme la parenthèse, et la ligne fermée ainsi est validée
  aussitôt ; pendant la saisie, l'aperçu suit le pointeur comme pour un
  outil (« fil à la patte ») ; dans la ligne de saisie (pas dans celles des
  objets, reconstruites avec la figure), désigner un point qui n'existe pas
  le crée comme un geste (point libre, sur objet ou intersection) ; survol
  ligne ↔ objet ; un glisser met à jour les lignes. Éditeur 34,5 Ko
  (13,5 Ko en gzip), lecteur inchangé.
- Gestes (`pick.ts`, `tools.ts`) : clic dans le vide → point libre (plan
  z = 0 en 3D) ; clic sur un objet → anneau de ses outils (dont supprimer) ;
  désignation des arguments suivants avec aperçu qui suit le pointeur ; un
  point désigné est un point existant, une intersection (branche la plus
  proche), un point sur objet ou un point libre ; polygone fermé en
  redésignant son premier sommet. Visée (pour le doigt, sans survol) : un
  outil en attente, le pointeur enfoncé dans la figure ne déplace rien,
  montre l'aperçu et désigne là où il est relâché ; enfoncer l'icône d'un
  outil le choisit, et le même geste peut continuer jusqu'à la cible comme
  dans DGPad, mais relâché sur l'icône l'outil reste simplement en attente
  (l'élève qui lâche trop tôt ne perd rien) ; relâché hors de la figure,
  rien n'est désigné. Un bouton ✕ dans la consigne abandonne l'outil
  (Échap au clavier). Styles de création : points au style
  propre à DocGeo, bruns à fond beige (`#604820`, `#e4ceb9`), opaques, nom
  affiché en taille 26 ; comme dans DGPad, polygones, sphères et secteurs
  remplis à 20 %.
- Une pile d'annulation (instantanés `.dgo` sans la vue), Cmd-Z,
  Cmd-Maj-Z, Cmd-Y ; ouverture `.dgo`, `.dgp`, `.ggb` (bouton ou `?url=`),
  Cmd-S.
- Tests : `tests/unit/editor_text.test.ts`, `tests/unit/editor_boundary.test.ts`
  (le lecteur n'importe pas `src/editor/`), `tests/browser/editor.test.ts`.

- Anneau d'outils en familles à places fixes, ligne de l'outil dans la
  consigne (section « Anneau d'outils ») : éditeur 30,7 Ko (12,1 Ko en
  gzip), lecteur inchangé.
- Aperçu dès le premier argument (« fil à la patte ») : quand il manque
  encore un argument après celui que désigne le pointeur, un point caché
  le remplace, comme dans DGPad : cercle de diamètre [premier point,
  pointeur], angle de 60° et bissectrice (demi-droite passant par le
  premier point) au pointeur, polygone réduit à un segment. Éditeur
  31,5 Ko (12,5 Ko en gzip), lecteur inchangé.

- Gomme (section « Gomme ») ; l'import GeoGebra super-cache ses objets
  auxiliaires. Éditeur 35,5 Ko (13,8 Ko en gzip), lecteur inchangé.

- Bouton bascule « Repère » de la barre : montre ou cache les axes avec la
  grille (en 3D, le trièdre avec le plancher), comme `isAxis` de DGPad ;
  hors de la pile d'annulation comme le reste de la vue, mais enregistré.
  Éditeur 36,3 Ko (14,2 Ko en gzip), lecteur inchangé.

- Pictogrammes SVG de l'anneau harmonisés : traits et points plus fins,
  objet créé en rouge, objets de départ gris, géométrie auxiliaire atténuée ;
  fonds pastel par famille, ombres discrètes et survol bleu franc avec
  pictogramme blanc.
  Éditeur 37,3 Ko (14,5 Ko en gzip), lecteur inchangé.

- Barre d'actions à icônes, panneau de construction refermable (section
  « Barre d'actions et historique »). Éditeur 41,7 Ko (15,8 Ko en gzip),
  lecteur inchangé. Vérifiés sur ordinateur et mobile : redimensionnement,
  coordonnées, annulation, bascules et ouverture / enregistrement. Translation
  vérifiée aussi lors d'une inversion du mouvement et avec les préférences
  de réduction des animations.

- Panneau de propriétés (section « Panneau de propriétés »), avec tests de
  rendu, sauvegarde, sélection des objets cachés, application aux objets du
  même type, trace et animation. Vérifiés aussi dans `editor.html` :
  désignation, clavier, renommage et dépendants, annuler / refaire,
  disposition ordinateur et mobile. Éditeur : 56,0 Ko, CSS inclus (20,5 Ko
  en gzip) ; lecteur : +27 octets (+42 en gzip) par rapport à l'étape
  précédente, sans changement du moteur.

- Champs numériques réglables par cliquer-glisser (section « Panneau de
  propriétés ») : effet immédiat, Maj pour le réglage fin, bornes et pas
  respectés, saisie clavier et tactile conservée, une seule annulation par
  glissement. Vérifiés avec de vrais gestes de souris et dans `editor.html`.
  Éditeur : 58,0 Ko, CSS inclus (21,2 Ko en gzip) ; lecteur inchangé.

- Bouton « Propriétés » dans l'anneau, à côté de la corbeille, dans une
  famille « objet » grise centrée sur le haut (section « Anneau d'outils ») ;
  le rayon gagne une place (environ 6 px). Vérifié dans `editor.html`.
  Éditeur : 58,4 Ko, CSS inclus (21,3 Ko en gzip) ; lecteur inchangé.

- Ambiguïté (2026-10-12) : quand plusieurs objets acceptés sont sous le
  clic (objets superposés, comme une droite et deux de ses segments), un
  menu près du clic donne la ligne de chacun ; son survol fait briller
  l'objet, un clic le choisit et le geste continue (anneau, argument d'un
  outil, point sur objet, ligne tapée, gomme, propriétés). Un point sous le
  clic est choisi seul, et l'intersection de deux objets qui se coupent est
  toujours créée directement. Échap ou un appui ailleurs ferment le menu
  sans rien faire. Éditeur : 59,8 Ko, CSS inclus (21,9 Ko en gzip) ;
  lecteur inchangé.

- Intersection au survol (2026-10-12) : partout où un clic désignerait un
  point (sans outil, argument point d'un outil, ligne tapée), le pointeur
  près de l'intersection de deux objets (à moins de 24 px, sans point sous
  lui) fait briller ces deux objets, ceux dont l'intersection la plus
  proche l'est le plus parmi les objets sous lui ; un clic, sans outil,
  crée alors l'intersection sans ouvrir d'anneau. Les intersections des
  paires survolées sont gardées tant que la figure ne change pas.
  Éditeur : 60,5 Ko, CSS inclus (22,1 Ko en gzip) ; lecteur inchangé.

- Actions sur l'objet sélectionné (2026-10-12, section du même nom) :
  corbeille et « Réglages » quittent l'anneau pour une zone contextuelle
  de la barre, avec Suppr / Retour arrière ; l'anneau ne porte plus que
  des outils géométriques (rayon 138 px) et ne s'ouvre pas pour un objet
  qui n'en a aucun ; annuler / refaire au bout de la barre. Vérifié dans
  `editor.html` à 1200 et 360 px de large. Éditeur : 62,8 Ko, CSS inclus
  (22,5 Ko en gzip) ; lecteur inchangé.

- Aimants (2026-10-12, section du même nom) : bouton de la zone
  contextuelle pour les points libres, bandeau « Terminé », voile blanc,
  cibles en rouge, curseur à crans de DGPad, zones d'attraction dessinées. Vérifié dans `editor.html` à 1200
  et 360 px de large (glisser aimanté, annuler / refaire). Éditeur :
  67,8 Ko, CSS inclus (24,1 Ko en gzip) ; lecteur inchangé.

- Noms des points glissés comme dans GeoGebra (2026-10-12, section
  « Noms des points ») : clé `.dgo` `nd`. Vérifié dans `editor.html`
  (glisser, annuler, toucher sur le nom). Éditeur : 69,2 Ko, CSS inclus
  (25,0 Ko en gzip) ; lecteur : +80 octets (+20 en gzip), le champ
  `nameDistance` du moteur.

- Punaise (2026-10-12, section du même nom). Vérifiée dans `editor.html`
  (bascule, zoom, annuler / refaire après zoom, ligne de texte).
  Éditeur : 70,3 Ko, CSS inclus (25,4 Ko en gzip) ; lecteur inchangé.

- Ressort (2026-10-12, section du même nom) : `src/editor/spring.ts`.
  Vérifié dans `editor.html` (segment, cercle, aller-retour, reprise sur un
  point animé, annuler). Éditeur : 75,7 Ko, CSS inclus (27,3 Ko en gzip) ;
  lecteur : +19 octets, une exportation de plus du moteur partagé.

- Points sur conique animés (2026-10-12, section « Ressort »), donc aussi
  au ressort. Vérifiés dans `editor.html` (ellipse, hyperbole). Éditeur :
  +60 octets ; lecteur : +609 octets (+249 en gzip), la marche le long de
  la conique dans le moteur.

- Expressions, première étape (2026-10-12, section du même nom) : une
  ligne `nom = formule` qui n'est ni un point ni une commande du catalogue
  crée une `Ex`, de nature déduite par la classification de l'import
  DGPad, sortie dans `src/import/dgp_expression.ts` (`expressionContent`).
  Créée sous les expressions affichées en haut à gauche, valeur montrée
  avec deux décimales en taille 24, comme par la calculatrice de DGPad. La
  ligne relit le texte enregistré de la formule, ses noms réécrits en ceux
  des objets (renommage) et sans saut de ligne ; redéfinie, l'expression
  garde son texte, sa place, son ancrage et, constante, les bornes de son
  curseur. Ordre et cycles de la redéfinition suivent les entrées `.dgo` :
  les cibles d'un programme le précèdent bien qu'il soit leur parent dans
  le moteur (un programme peut lire ce qu'il stylise). Erreurs : nom
  inconnu, fonction inconnue (`unknown_command`), écriture incomprise.
  Désignation au clic dans une formule : fonctions de formule signées dans
  le catalogue (`FUNCTIONS` : `d`, `x`, `y`, `sqrt`, trigonométrie…,
  `min`, `max`), complétées en tête de formule ou après un opérateur, sans
  aperçu et sans valider la ligne à leur `)` ; `real` accepte une
  expression nommée (`Cercle(O, r)`, écrite `C1` à formule réduite à ce
  nom), les nombres seuls étant `number` (`Point`, `Intersection`,
  `PointFixe`) ; la saisie lit ses jetons avec le lexer de
  `dgp_formula.ts`, qui accepte les noms entre accents graves et les
  primes (`A'`) ; en position libre, les objets lisibles sont mis en
  évidence et un clic ajoute un nom après un nom complet. Vérifié dans
  `editor.html` (`E = d(` puis H et M, point libre créé par un clic dans
  le vide, complétion de `sq`, redéfinition et erreurs, figures DGPad à
  programmes). Éditeur : 80,2 Ko, CSS inclus (28,6 Ko en gzip), soit
  +3,2 Ko (+1,2 Ko en gzip) ; lecteur : +558 octets (+253 en gzip), le
  lexer et le module partagé.

- Curseurs et éditeur multiligne des programmes (2026-10-12, section
  « Expressions ») : commande `Curseur` / `Slider` écrivant une `Ex` à
  bornes (sous la piste des curseurs déjà affichés), relue par le
  catalogue, dont la relecture vérifie désormais que les arguments décodés
  sont acceptés ; un curseur à bornes calculées par formule reste en
  lecture seule. Section « Définition » du panneau de propriétés
  (`formatProgram`, `syntaxLine`, `unknownMethod` dans `text.ts`). Un
  toucher sur un curseur, un texte ou une expression le sélectionne au
  lieu de créer un point. Vérifiés dans `editor.html` (création, glisser
  de la poignée, ligne mise à jour, sélection, nom inséré pendant une
  saisie ; programme mis en forme, indentation au clavier, ⌘-Entrée,
  erreur de ligne). Éditeur : 85,7 Ko, CSS inclus (30,4 Ko en gzip),
  soit +5,5 Ko (+1,8 Ko en gzip) ; lecteur : +22 octets (une exportation).

- Listes de points (2026-10-12, section « Expressions ») : commande
  `Liste` / `List`, actions « Liste de points » et « Liste de segments »
  de la zone contextuelle. La complétion se ferme quand une ligne est
  validée. Vérifié dans `editor.html` (boutons proposés pour la seule
  expression à liste de points, consigne au survol, ligne tapée avec mise
  en évidence, annulation qui remontre l'expression). Éditeur : 86,9 Ko,
  CSS inclus (30,7 Ko en gzip), soit +1,3 Ko ; lecteur inchangé.

- Bouton « Nouveau programme » (2026-10-12, section « Expressions »).
  Vérifié dans `editor.html` à 1200 et 360 px de large (focus dans la
  zone, indentation au clavier, création, sélection du nouvel objet).
  Éditeur : 87,8 Ko, CSS inclus (31,0 Ko en gzip), soit +0,9 Ko ; lecteur
  inchangé.

- Déplacement des expressions (2026-10-12, section « Expressions »).
  Vérifié dans `editor.html` (expression et curseur glissés par leur
  texte, poignée du curseur, nom écrit par un toucher pendant une saisie,
  annulation et rétablissement). Éditeur : +0,5 Ko (+0,1 Ko en gzip) ;
  lecteur inchangé.

- Points définis par une formule (2026-10-13, entrée `Fp`, le
  `Point("M","2*B-A","0")` de DGPad) : `M = (x(B) + 1, y(A))`, des
  coordonnées qui ne sont pas toutes des nombres (un point libre sinon), et
  `M = Point(2*B - A)`, un seul argument, qu'aucun point sur objet ne prend,
  pour une formule dont la valeur est un point ; la ligne relit l'une ou
  l'autre forme. Comme le bouton point de la calculatrice de DGPad, une
  expression dont la valeur est un point a dans la zone contextuelle
  « Point » : comme « Liste de points », il ajoute le point qu'elle donne
  (`C = Point(a)`) et cache l'expression sans la supprimer, en une étape
  d'annulation (décidé avec l'auteur le 2026-10-13). Lecteur :
  les points fixes et à formule sont remplis en gris (défaut `.dgo` de
  `Fix` et `Fp` changé), comme `point_fixed` dans DGPad. Vérifié dans
  `editor.html` (figure DGPad, saisie des deux formes, redéfinition,
  action « Point »). Éditeur : +2,2 Ko (+0,6 Ko en gzip) ; lecteur :
  +30 octets.

- Point, liste ou expression (2026-10-13, idée de l'auteur) : une ligne
  `nom = formule` dont la valeur est un point ou une liste de points
  (essayée sur une expression ajoutée et retirée aussitôt) montre au bout
  de la ligne ses choix : « Point », ou « Liste de points » et « Liste de
  segments », et « Expression » (calculatrice) ; leur survol montre les
  lignes que chacun écrit. Entrée choisit celui qui est allumé : un point
  pour un nom à majuscule (comme l'éditeur nomme les points) ou un point
  redéfini, une expression sinon ; pas de raccourci pour l'autre choix
  (décidé avec l'auteur). Une nouvelle ligne choisie « Point » est un
  point qui porte la formule ; une liste, ou un point tiré d'une expression
  existante, s'ajoute en gardant l'expression, cachée, comme les actions de
  la zone contextuelle. Les boutons ne suivent pas le défilement du
  panneau, comme la complétion (accepté). Les points construits (autres
  que libres et sur objet) sont créés remplis de gris (`#cccccc`), comme
  dans DGPad. Vérifié dans `editor.html`. Éditeur : +2,9 Ko (+0,9 Ko en
  gzip) ; lecteur inchangé.
- Langues (2026-10-13, section du même nom) : 12 langues, noms de
  commandes de GeoGebra, remplacés le 2026-10-14 par les mots usuels de
  chaque langue (table ajoutée en `zh-TW`). Vérifié dans `editor.html` en allemand, arabe,
  hindi et chinois. Éditeur : −2,2 Ko (88,4 Ko, le français sorti du
  chunk) et 2,2 à 3 Ko en gzip par langue chargée ; lecteur inchangé
  (`index` 15,2 Ko), l'aide d'interopérabilité de Rolldown passant du
  moteur dans un chunk à part (0,6 Ko).

- Plan et espace (2026-10-13, section du même nom) : bouton « Vue 3D »,
  caméra animée, objets hors du plan refusés dans une figure plane, retour
  au plan refusé tant qu'il en reste, mode gardé par les étapes
  d'annulation. La barre passe à des boutons de 32 px sous 440 px, et la
  zone contextuelle flotte sous la barre jusqu'à 680 px. Vérifié dans
  `editor.html` (refus, aller-retour, annuler / refaire, figure DGPad 3D,
  barre de 320 à 800 px). Éditeur : 90,9 Ko, +2,1 Ko (+0,8 Ko en gzip) ;
  lecteur inchangé (+10 octets d'exportations du moteur partagé).

- Onglet « Figure » du panneau de propriétés (2026-10-14, section du même
  nom) : repère, modèles, axes, grille, zoom, fond et unité d'angle ; vue
  annulable. Vérifié dans `editor.html` (modèles, annuler / refaire,
  synchronisation avec le bouton « Repère », 3D). Éditeur : 101,9 Ko,
  +11,0 Ko (+3,7 Ko en gzip), CSS +4,1 Ko (+0,9 Ko en gzip) ; lecteur
  inchangé.
- Axes de GeoGebra (2026-10-14, item 23 de `GGB_IMPORT.md`) : flèches,
  noms, nombres masqués et unité π, au format (`al`, `nu`, `au`, `ah`), au
  dessin, à l'import et dans l'onglet « Figure ». Vérifié face au rendu de
  GeoGebra sur des figures du corpus. Lecteur +1,9 Ko (+0,8 Ko en gzip),
  éditeur +1,3 Ko (+0,4 Ko en gzip).
- Onglet « Figure » en 3D (2026-10-14) : sections Axes, Sol et Vue ;
  couleur, opacité, taille, écart, couleur et épaisseur des lignes du sol
  au format (`fc`, `fo`, `fe`, `fd`, `fg`, `fw`) et au dessin. Vérifié
  dans `editor.html` (réglages, annuler / refaire). Moteur partagé
  +0,7 Ko (+0,2 Ko en gzip), éditeur +1,1 Ko (+0,4 Ko en gzip).
- Cercle centre et rayon dans l'anneau (2026-10-14) : `C1` à rayon
  numérique d'environ 150 px, créé d'un clic (section « Anneau
  d'outils ») ; une expression n'ouvre toujours pas d'anneau. Vérifié dans
  `editor.html` (ligne survolée, création, rayon après un zoom). Éditeur
  +0,2 Ko (+0,1 Ko en gzip) ; lecteur inchangé.
- Noms des points renommés et masqués sur place (2026-10-14, section
  « Noms des points ») : curseur « doigt » au survol d'un nom. Vérifié
  dans `editor.html` (curseur, renommage, nom pris, Échap, masquer,
  annuler, toucher ailleurs). Éditeur +2,0 Ko (+0,6 Ko en gzip) ; lecteur inchangé.

- Marques d'angles glissées (2026-10-14, section du même nom). Vérifié
  dans `editor.html` (curseur, glisser, annuler / refaire, sélection,
  champ du panneau suivi). Éditeur +1,8 Ko (+0,6 Ko en gzip) ; lecteur
  +30 octets (une exportation du moteur partagé).
- Panneau « Construction » soigné (2026-10-14, section « Barre d'actions
  et historique ») : pastilles de visibilité, bouton du nom des points,
  compteur, saisie collée au bas. Vérifié dans `editor.html` (bascules,
  annuler, gomme, liste qui défile). Éditeur +3,1 Ko (+0,7 Ko en gzip) ;
  lecteur inchangé.
- Valeurs sous les lignes et construction pas à pas (2026-10-14, même
  section). Vérifiés dans `editor.html` (lecture, pause, clavier, toucher
  sur une ligne, glisser pendant le pas à pas, Échap, annuler, panneau à
  360 px). Éditeur +4,9 Ko (+1,5 Ko en gzip) ; lecteur inchangé.
- Nom des objets autres que les points (2026-10-14, section « Noms des
  points ») : bouton « nom » du panneau « Construction » et case du
  panneau de propriétés pour tout objet dont le moteur écrit le nom
  (`hasName`). Vérifié dans `editor.html` sur une figure GeoGebra.
  Éditeur +62 octets ; lecteur inchangé.
- Noms des autres objets glissés et renommés sur place (2026-10-14,
  section « Noms des points ») : style `no`, place relative à l'objet,
  convertie aussi depuis le `labelOffset` de GeoGebra. Vérifié dans
  `editor.html` (glisser le nom puis un point du segment ou du cercle,
  annuler, renommage) et face au rendu de GeoGebra sur des figures du
  corpus. Lecteur +1,9 Ko (+0,6 Ko en gzip), éditeur +0,2 Ko
  (+0,1 Ko en gzip).
- Fil à la patte de la conique par cinq points (`Quad`), que ni DGPad ni
  GeoGebra ne montrent : dès le deuxième point, jusqu'à trois points
  cachés complètent les points désignés et le pointeur sur la conique
  passant par eux la plus proche d'un cercle (`src/editor/conic_preview.ts`).
  Par deux points, le cercle de diamètre ; par trois, le cercle
  circonscrit ; par quatre, la conique de leur faisceau qui minimise
  ((λ − μ)/(λ + μ))² (λ, μ valeurs propres de sa partie quadratique) :
  le cercle s'ils sont cocycliques, une ellipse s'ils sont en position
  convexe, sinon une hyperbole. Éditeur +1,3 Ko (+0,6 Ko en gzip) ;
  lecteur inchangé.
- Lieu dans l'anneau (2026-10-14, section « Anneau d'outils ») : sur un
  point dont dépend un point sur objet, comme dans DGPad, `Lieu(M, P)`
  créé d'un clic. Vérifié dans `editor.html` (outil présent sur le point
  dépendant, absent sur un point libre, ligne survolée, création).
  Éditeur +0,4 Ko (+0,1 Ko en gzip) ; lecteur inchangé.
- Menu des outils (2026-10-14, section du même nom) : bouton à droite de
  la ligne de saisie, familles et sous-menus, aide au survol, outil
  persistant avec son bandeau, rayon tapé, petit écran. Vérifié dans
  `editor.html` avec Playwright (cercles enchaînés, perpendiculaire par
  la droite d'abord, intersection, polygone, milieu d'un segment, point
  sur objet, annuler en gardant l'outil, sortie par Échap et par la ligne
  de saisie ; à 380 px au doigt, panneau refermé ; arabe). Puis outils
  hors de l'anneau (conique, arc…), cercle de rayon par défaut et bouton
  droit pendant l'outil (point glissé, vue déplacée). Éditeur : 128,4 Ko,
  +7,6 Ko (+2,0 Ko en gzip) ; lecteur inchangé.
- Sélection multiple (2026-10-14, section du même nom) : vérifiée dans
  `editor.html` avec Playwright (⌘-clic sur A, B, C puis
  CercleCirconscrit, droite puis point pour Perpendiculaire, polygone de
  quatre sommets, segment depuis l'objet de l'anneau, suppression de deux
  points, appui long au doigt, toucher qui vide). Éditeur : 131,4 Ko,
  +3,0 Ko (+0,9 Ko en gzip) ; lecteur inchangé.

- Propriétés de plusieurs objets (2026-10-14, section « Sélection
  multiple ») : vérifiées dans `editor.html` avec Playwright (« Réglages »
  sur A et B, ⌘-clic sur le segment puis sur une ligne pour ajouter et
  retirer, réglages communs, couleur appliquée aux trois, annuler,
  toucher simple, suppression de deux objets). Éditeur : 132,9 Ko,
  +1,5 Ko (+0,5 Ko en gzip), CSS +0,1 Ko ; lecteur inchangé.

- Équations (2026-10-15, section « Langage textuel ») : droites, cercles
  et coniques d'une équation tapée, de nature lue dans ses coefficients ;
  celles d'une figure GeoGebra se relisent en objets de même type, les
  équations enregistrées par leurs seuls coefficients écrites sans
  termes nuls (`x - y - 2 = 0`). Éditeur +1,4 Ko (+0,5 Ko en gzip) ;
  lecteur +0,2 Ko.

- Rotation, homothétie, translation (2026-10-15) : `Rotation(P, O, a)`,
  `Homothétie(P, O, k)` (a, k nombres ou expressions nommées) et
  `Translation(P, u)` (u vecteur) au clavier, images de points (entrées
  `Rot`, `Dil`, `Tra`), nommées comme des points. Au menu des outils,
  dans la famille « Symétries » renommée « Transformations » : rotation
  et homothétie (le point, puis le centre ; 90° et un rapport de 2,
  section « Menu des outils »), translation (le point, puis le vecteur).
  Éditeur +0,9 Ko (+0,3 Ko en gzip).

- Arcs de centre donné et demi-cercle (2026-10-15) : `ArcCentre(M, A, B)`
  et `SecteurCentre(M, A, B)`, de A à la demi-droite [MB) dans le sens
  direct, et `DemiCercle(A, B)`, à gauche de AB (entrées `CArc`, `CSec`,
  `Semi`), au clavier et au menu (« Cercles, arcs, coniques »). Noms
  composés qui contiennent ceux d'`Arc` et `Secteur`, qui restent l'arc
  par trois points. L'image d'un arc par une symétrie axiale, parcourue
  dans le sens indirect, s'affiche en lecture seule. Éditeur +0,5 Ko
  (+0,1 Ko en gzip).

- Tangentes (2026-10-15) : `Tangente(P, c, n)`, la tangente n (1 ou 2)
  par P à un cercle ou une conique, comme `Intersection(c, d, n)`, et
  `Tangente(P, f)`, à la courbe d'une fonction (entrée `Tan`). Au menu,
  famille « Constructions », un seul outil pour les deux formes (le point,
  puis le cercle, la conique ou la courbe), qui donne la tangente 1, que
  la ligne change ; les formes d'un item du menu hors de l'anneau peuvent
  désormais être plusieurs. Éditeur +0,7 Ko (+0,2 Ko en gzip).

- Centres, polygone régulier, sommet, inversion (2026-10-15) : un nom
  d'école par centre plutôt que le numéro de Kimberling de GeoGebra,
  `CentreInscrit`, `CentreGravité`, `CentreCirconscrit`, `Orthocentre`
  (A, B, C), au menu des points ; le centre du cercle d'Euler, rare,
  s'affiche en lecture seule. `PolygoneRégulier(A, B, n)` (n ≥ 3), au
  menu « Polygones, angles, lieux », qui donne un carré que la ligne
  change ; `Sommet(p, k)`, de rang k depuis 1, au clavier ;
  `Inversion(P, c)`, au menu des transformations (le point, puis le
  cercle). Éditeur +1,5 Ko (+0,4 Ko en gzip).

- Solides (2026-10-15, décidé avec l'auteur : un objet unique qui dessine
  tout) : `Cylindre(A, B, r)`, `Cône(A, B, r)` (base de centre A, sommet
  B), `Cube(A, B, C)` (sur le carré ABCD du plan ABC ; voir plus bas
  le cube en deux clics), `Prisme(p, P)`,
  `Pyramide(p, S)` sur un polygone p, et `Sphère(O, r)` à côté de
  `Sphère(O, A)`. Un solide est une seule ligne : il dessine ses faces ou
  sa silhouette, ses arêtes ou ses bords (en pointillé derrière) et cache
  ce qui est derrière lui ; `Sommet(c, k)` donne les sommets d'un
  polyèdre. Au menu, une famille « Solides », hors de l'anneau et en 3D
  seulement ; le cylindre et le cône prennent le rayon par défaut du
  cercle. Éditeur +1,1 Ko (+0,3 Ko en gzip) ; lecteur +4,8 Ko (+1,4 Ko en
  gzip).

- Plans, sections et patron (2026-10-15) : `Plan(A, B, C)`, `Plan(A, d)`
  (contenant d), `PlanParallèle(A, p)`, `PlanOrthogonal(A, d)` et
  `p = x + y + z = 3` ; `Section(s, p)` d'une sphère (cercle), d'un
  cylindre ou d'un cône (conique limitée au solide), d'un polyèdre
  (polygone) ; `Patron(c, f)` d'un cube, d'un prisme ou d'une pyramide,
  déplié de f (0 : plié, 1 : à plat), un objet unique qui dessine ses
  faces, comme les patrons de GeoGebra. Au clavier seulement :
  `Intersection(d, p)`, `Intersection(p, q)`, `Intersection(s, t)` de deux
  sphères, `Perpendiculaire(A, p)`. Au menu, une famille « Plans » (3D),
  et `Section` et `Patron` à la fin des « Solides ». Les solides se
  désignent à l'intérieur de leur contour, l'anneau s'ouvrant en son
  milieu ; plans, sections et sphères de rayon donné créés sont remplis
  comme les polygones.
  Éditeur +2,5 Ko (+0,75 Ko en gzip) ; moteur +3,3 Ko (+1,1 Ko en gzip,
  avec l'item 33 de `GGB_IMPORT.md`), lecteur inchangé.

- Cube en deux clics (décidé avec l'auteur le 2026-10-15) : deux points
  ne déterminent pas le plan du carré, sauf s'ils le partagent. Deux
  points sur un même plan ou polygone donnent `Cube(A, B, p, ±1)`, le
  cube du côté du plan tourné vers la caméra à sa création, mémorisé
  (±1 : du côté de la normale de p ou de l'autre) ; deux points libres de
  même cote, comme sur le sol, `Cube(A, B, 1)`, carré horizontal, cube
  au-dessus (−1 au-dessous, au clavier). Sinon, le troisième point reste
  à désigner ; l'aperçu montre le cube dès le survol du deuxième. Ces
  cubes, comme `Cube(A, B, p)` importé de GeoGebra, sont indéfinis dès
  que AB n'est plus parallèle au plan, comme dans GeoGebra (DocGeo
  dessinait un parallélépipède). Les faces d'un solide n'étant pas des
  objets, deux sommets d'un cube n'en empilent pas un autre. Au passage :
  un plan tout juste créé n'était pas désignable avant un changement de
  vue, ses coins n'étant pas projetés. Éditeur +1,0 Ko (+0,4 Ko en
  gzip) ; moteur +0,6 Ko (+0,2 Ko en gzip), lecteur inchangé.
- Construction panneau de propriétés ouvert (2026-10-15, section « Panneau
  de propriétés ») : un outil du menu ou la ligne de saisie prend les
  clics, l'objet construit s'affiche dans le panneau ; auparavant, l'outil
  restait armé mais inerte. Vérifié dans `editor.html` (outil Segment,
  ligne de saisie avec désignation et point libre, sélection après Échap,
  Échap deux fois). Éditeur +57 octets (+21 en gzip) ; lecteur inchangé.

Reste à faire :

- Jeux d'outils de l'enseignant (section « Anneau d'outils »).
- Outils du moteur sans commande dans l'éditeur, à ajouter au catalogue
  puis au menu : angle fixe, intersection droite-plan.

- Expressions (section du même nom) : formules en argument
  (`Cercle(O, 2*a)`, bornes d'un curseur), ressort des curseurs, listes
  en k (`Lst`) ; trancher `f(x) =`.
- Points sur objet et intersections au geste sur les lieux et listes ;
  choix explicite de l'intersection quand le geste est ambigu.
- 3D : points libres dans le plan de l'écran des figures DGPad (`f2`) et
  hors du plan z = 0 au geste.
- Lien « modifier cette figure » depuis le lecteur.
- Réutilisation de `ggb_translate.ts` pour accepter davantage de commandes
  GeoGebra.
- Mesures de fluidité sur des figures de plusieurs milliers d'objets (la vue
  texte est entièrement reconstruite après chaque changement).
