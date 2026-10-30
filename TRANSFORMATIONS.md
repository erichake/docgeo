# Image d'un objet par une transformation

Chantier ouvert le 2026-10-30, avec l'auteur. Mémo des décisions et de
l'avancement : le lire avant d'y toucher, le tenir à jour à chaque étape.
Il relève de l'éditeur (`EDITOR.md`, mêmes règles : le lecteur n'importe
jamais `src/editor/`) pour les outils et les commandes tapées, et du
moteur pour le calcul des images, que le lecteur doit ouvrir : le moteur
reste léger, le poids du lecteur est mesuré à chaque étape.

## Objectif

Une transformation ponctuelle (qui envoie un point sur un point)
s'applique aussi à un objet : l'image d'un triangle par une symétrie
axiale, d'un cercle par une rotation, d'une droite par une inversion…
Cela vaut pour **les outils et commandes de transformation standards**
(`Symétrie` centrale et axiale, `Rotation`, `Homothétie`, `Translation`,
`Inversion`) comme pour **les macros** de transformation ponctuelle
(celles de l'utilisateur et de la bibliothèque, dont `SymétrieH`). Les
deux suivent les mêmes règles et la même interface.

## Décisions de l'auteur

1. **Reconstruire autant que possible un objet de même nature** : l'image
   d'un polygone est un polygone, d'un cercle un cercle (ou une droite,
   pour une inversion)… En cas d'échec seulement, l'image est un **lieu**
   (celui de l'image d'un point qui parcourt l'objet).
2. **Le moteur a des commandes qui, comme dans GeoGebra, acceptent un
   point, un segment, une droite, un polygone, un cercle, une conique, une
   fonction…** (`Reflect(poly, d)` dans GeoGebra ; ici dans l'ordre de
   DocGeo, ci-dessous).
3. **Pas seulement les macros** : les outils classiques de transformation
   sont adaptés de la même façon.
4. **Ordre des arguments** (fait le 2026-10-30, commit `7aff39c`) : comme
   dans DGPad et CaRMetal, ce qui définit la transformation d'abord, puis
   le point : `Symétrie(O, P)`, `Symétrie(d, P)`, `Rotation(O, P, a)`,
   `Homothétie(O, P, k)`, `Translation(u, P)`, `Inversion(c, P)`, à
   l'outil, au clavier, dans la ligne relue et dans les entrées du `.dgo`
   (inchangées). Une macro de transformation a l'objet transformé en
   **dernier initial** (`SymétrieH` : le disque, la droite g, puis M).
   L'ordre de GeoGebra (l'objet d'abord) n'est pas accepté au clavier :
   entre deux points, il donnerait sans erreur une autre figure.
5. **Ce qui définit la transformation est redemandé** (révisé avec
   l'auteur le 2026-10-30) : comme tout outil, après chaque image,
   l'outil attend de nouveau son premier argument, ce qu'attend un
   utilisateur. Garder la transformation d'une image à l'autre, comme
   DGPad, est un choix : un argument désigné avec **Maj**, ou gardé par
   le bouton « Garder d » de la consigne, est repris jusqu'à la sortie de
   l'outil (`EDITOR.md`, « Arguments gardés »), pour tous les outils et
   les macros. L'ordre ci-dessus reste celui de DGPad et du clavier.
6. Aperçu au survol de l'objet de l'image qu'il donnerait, comme pour un
   point aujourd'hui (et comme CaRMetal, en jaune).

7. **Représentation** (décidé le 2026-10-30) : un nœud, porté par les
   entrées existantes, et pas une décomposition en images de points
   (comme l'import GeoGebra) : `["Refl", [d, X]]`, X étant un point ou un
   objet (`DGO.md`, note 28). Une ligne unique, relue `Symétrie(d, X)`.
   L'image est un objet de même nature que X, utilisable comme tout autre
   (intersections, points sur objet…). Elle est construite dans le moteur
   sur les images de points de X, privées (hors de la figure), lues sur
   la géométrie de X : elle couvre donc aussi un cercle de rayon donné,
   une droite par équation, un objet sans points de définition. Repli :
   un lieu. Pour une macro, même entrée `Mac`, l'objet à la place du
   dernier initial ; le verdict du test numérique « droite / cercle
   conservé », fait une fois à l'application, sera enregistré dans
   l'entrée, pour qu'une figure rouverte dans une autre position ne change
   pas de nature.

8. **Inversion d'une droite ou d'un cercle passant par le centre**
   (validé par l'auteur le 2026-10-30 ; comme le verdict d'une macro,
   décision 7) :
   l'image est une droite, nature décidée à la construction et
   enregistrée dans l'entrée (`["Inv", [c, X, 1]]`), l'éditeur la
   calculant (`straightImage`) quand il écrit l'entrée. Une figure
   rouverte ailleurs ne change donc pas de nature ; si l'objet quitte
   le centre, l'image reste la droite par les images de deux de ses
   points, et une image « cercle » dont l'objet vient passer par le
   centre est indéfinie à cet instant.

## Mise en œuvre

- `src/objects/transformed_object.ts` : `createTransformed`, dont
  l'argument `map` fait l'image d'un point par la transformation (une
  instance des classes de points existantes : `reflection_object`…).
  L'image est une instance ordinaire (`segment_object`,
  `polygon_object`…) construite sur des points privés : images de points
  de X (extrémités, sommets) ou de points lus sur sa géométrie
  (`source_point` : point + vecteur directeur d'une droite, trois points
  d'un cercle, extrémités et milieu d'un arc). Elle les calcule et les
  projette elle-même avant sa propre géométrie (méthodes remplacées sur
  l'instance) ; ses parents dans la figure, son entrée `.dgo` et
  `readsView` sont ceux d'un « gabarit », l'image d'un point construite
  avec X à la place du point et jamais calculée. Les objets de la figure
  ne connaissent pas les objets privés (liens retirés).
- Style par défaut : celui de sa nature, par `look` (`construction_object`)
  et `lookTag` (`src/dgo.ts`), qui servent aussi aux finals de macros.
- Natures traitées : segment, vecteur, demi-droite (`Ray`, `Bis`, `FA`),
  droite, polygone (y compris section et polygone régulier), cercle, arc
  et secteur. Le cercle et l'arc images passent par trois points
  (`C3p`/`Arc`, `C3s`/`Arcs` en 3D) : l'orientation d'un arc suit celle
  de la transformation sans rien à décider.
- Coniques (étape 3) : `quadric5pts_object` sur les images de cinq points
  (ellipse : à 2π/5 l'un de l'autre ; hyperbole : trois sur une branche,
  deux sur l'autre ; parabole : de part et d'autre du sommet), la nature
  (ellipse, hyperbole, parabole) relue à chaque calcul. Seulement dans un
  plan horizontal, comme `Quad`.
- Repli en lieu (étape 3) : un `point_on_object` privé sur l'objet, son
  image, et un `locus_object` construit dans une construction privée dont
  `OBJS.V` ne contient qu'eux (là où le lieu cherche ce qui les relie),
  puis rendu à la figure. Courbes de fonctions, lieux, arcs de conique ;
  par une inversion aussi demi-droites, vecteurs et coniques.
- Polygone par une inversion (remarque de l'auteur, 2026-10-30 : au
  survol, l'outil proposait un point sur le polygone) : un polygone,
  région remplie comme son objet, dont chaque côté est l'image de 32
  points du côté (`SIDE_SAMPLES`), ses côtés devenus des arcs approchés
  par des segments. Pas un lieu : un lieu sur un polygone n'en prend que
  les sommets. Un polygone qui contient le centre a pour image
  l'extérieur de cette courbe, que ce polygone ne montre pas ; un sommet
  au centre la rend indéfinie.
- Inversion (étape 3) : droite, cercle, segment, arc → cercle, cercle,
  arc, arc par trois points. La droite est prise autour de son point le
  plus proche du centre O ; un cercle passant par O, en deux points qui
  n'y sont jamais (à l'opposé de O, et à un quart de tour). Le verdict
  « droit » est enregistré (`[c, X, 1]`, décision 8).

- Macros (étape 4) : une méthode « envoie des points »
  (`mapsPoints`, `src/editor/macro.ts`) quand son dernier initial est un
  point et son seul final un point (`finalTypes`, qui lit aussi les images
  par transformation des corps). Son dernier initial prend alors un objet
  (`transformable`, `takenInitials`), à l'outil, au clavier et dans
  l'aperçu ; comme pour les outils, ses autres initiaux sont redemandés
  après chaque application, sauf ceux gardés (décision 5). L'entrée `Mac` porte l'objet et le
  verdict (`DGO.md`, « Image d'un objet »). Le moteur fait de chaque point
  privé de l'image une application privée de la méthode (`application` de
  `src/dgo.ts`, `applied_point` de `macro_object.ts`), détachée de la
  figure, le gabarit de `createTransformed` donnant l'entrée.
- Verdict (`imageVerdict`, éditeur), décision 7 : l'image d'essai en lieu
  (100 points ; pour un polygone, celui des images de points de ses côtés)
  dit si les images sont alignées (droite, segment, demi-droite, vecteur,
  polygone à côtés droits), cocycliques (cercle, arc) ou, pour une conique,
  sur la conique par cinq de leurs points ; sinon un lieu. Tolérance
  relative 10⁻⁶. Une courbe de fonction, un lieu ou un arc de conique
  donnent toujours un lieu.
- Sans pôle connu (macro), les points d'une droite sont pris de part et
  d'autre de son point P1, pas en P1, souvent un centre (celui d'une
  inversion par exemple).
- Espace (étape 5) : plan (`plane_object`, « Pl » sur les images de son
  centre, de son centre plus U et plus N × U), sphère (`sphere_object` de
  centre l'image de son point P1, passant par l'image de CENTER + R·x),
  polyèdre (`polyhedron_object`, définition `Map` : les images de ses
  sommets et ses faces). Seulement par les similitudes : ni l'inversion ni
  les macros ne les prennent (`invertible` de `src/dgo.ts` et du
  catalogue).
- Glisser : une image ne se glisse pas (ses points sont privés) ; un point
  se pose dessus comme sur tout objet et s'y glisse.

## Étapes

1. Moteur : images par `Sym`, `Refl`, `Rot`, `Dil`, `Tra` des segments,
   vecteurs, demi-droites, droites, polygones, cercles et arcs. **Fait.**
2. Éditeur : outil persistant (décision 5), aperçu au
   survol, commande tapée (`Symétrie(d, poly)`), ligne relue, style de
   l'image repris de l'objet. **Fait** (`EDITOR.md`, « Image d'un objet
   par une transformation »).
3. Coniques (transformation affine : conique par cinq points), repli en
   lieu (courbes de fonctions, lieux…), inversion des droites et des
   cercles. **Fait** (décision 8).
4. Macros de transformation (entrée `Mac`, verdict enregistré). **Fait.**
5. 3D (plans, polyèdres, sphères), point sur une image. **Fait**, sauf
   le manuel, après le feu vert de l'auteur.

## Référence : CaRMetal

`…/netbeans/CaRMetal/src/rene/zirkel/macro/MacroRunner.java` (chemin
complet dans la conversation d'origine :
`/Users/erichake/Documents/Anciens Documents/Ancienne dropbox/Documents/Programmation/netbeans/CaRMetal`).
Idées à garder, sans recopier le code :

- `isMultipleFinalAccepted` : la macro n'a qu'un final, un point, et son
  dernier initial est un point ; au moment de le désigner, un autre objet
  est accepté (`selectMultipleFinal`).
- `LaunchMultipleFinalMacro` : selon l'objet désigné, la macro est lancée
  sur ses points de définition et l'objet reconstruit sur leurs images :
  droite et segment (deux points), cercle (centre et point du cercle),
  polygone (chaque sommet) ; sinon (arc, conique, fonction…) un lieu
  (`LaunchLocus` : point lié à l'objet, macro appliquée, lieu de l'image).
- `keepLine`, `keepCircle` : réglages de l'utilisateur disant si la macro
  conserve droites et cercles ; sinon, lieu (une inversion envoie une
  droite sur un cercle). DocGeo vise mieux : le savoir sans le demander
  (ci-dessous).

## Existant dans DocGeo

- Moteur : `Sym`, `Refl`, `Rot`, `Dil`, `Tra`, `Inv` étaient des images
  de **points** seulement (`DGO.md`, tableau des points ; note 15) ;
  depuis l'étape 1, voir « Mise en œuvre ».
  L'image d'un arc par une symétrie axiale existe déjà (arc parcouru dans
  le sens indirect, note 16).
- Import GeoGebra : `transform` (`src/import/ggb_translate.ts`) traduit
  déjà l'image d'un objet construit sur des points (`shapes` : segments,
  vecteurs, polygones…), d'un polyèdre, d'une liste écrite ou d'une
  itération, en images de ses points de définition (points auxiliaires)
  et en même construction sur ces images (`shape.build`). Point de départ
  possible, à généraliser plutôt qu'à doubler.
- Macros : `MACROS.md` (« Image d'un objet », dans la liste des idées
  CaRMetal) ; nœud d'application dans le moteur.

## Questions ouvertes (à trancher avec l'auteur)

- **Nature conservée par une macro** : inconnue d'avance. Test numérique
  à l'application (les images de plusieurs points d'une droite restent
  alignées, d'un cercle cocycliques), puis droite / cercle reconstruits,
  sinon lieu. Les isométries et homothéties conservent tout ; l'inversion
  envoie droite et cercle sur droite ou cercle selon le cas (exact).
- **Image d'une conique, d'une courbe de fonction** : par une
  transformation affine, une conique reste une conique (équation
  transformée) ; une courbe de fonction n'est en général plus une courbe
  de fonction (lieu ou courbe paramétrée).
- **3D**, reste : cylindres et cônes (leur rayon, nombre ou formule,
  n'est pas l'image d'un point), coniques hors d'un plan horizontal
  (`Quad` y est limité), rotation autour d'un axe à l'outil et au clavier
  (le moteur la connaît : `Rot` à quatre paramètres).
- **Manuel** : à mettre à jour dans les 12 langues à la fin, après le feu
  vert de l'auteur (y compris l'ordre des arguments du 2026-10-30, pas
  encore reporté : `commandes.html`, `menu-outils.html`,
  `selection.html`).

## Avancement

- 2026-10-30 : ordre des arguments des transformations (décision 4),
  commit `7aff39c`.
- 2026-10-30 : étape 1 (moteur), représentation par nœud (décision 7).
  Test `.dgo reader` « reads images of objects by transformations »
  (`tests/browser/dgo.test.ts`), aller-retour compris. Moteur (et
  lecteur) 376,92 → 378,63 Ko (+1,7 Ko ; gzip +0,7 Ko, 120,28 Ko) ;
  éditeur −0,03 Ko.
- 2026-10-30 : étape 2 (éditeur). Paramètre `transformable` du catalogue,
  outil qui garde la transformation, aperçu, nom et style selon la nature
  de l'image (`builtTag`, `imageLook`), style repris de l'objet. Le
  moteur refuse un plan (`check`). Éditeur 256,14 → 256,95 Ko (+0,81
  Ko) ; moteur 378,63 → 378,73 Ko (+0,10 Ko ; gzip 120,32 Ko).
- 2026-10-30 : étape 3. Coniques, repli en lieu, inversion (décision 8).
  Test `.dgo reader` « reads images of conics, curves, and by
  inversions », lignes relues dans l'éditeur. Puis l'inversion d'un
  polygone (même paramètre `transformable` pour toutes les
  transformations). Moteur
  378,73 → 380,44 Ko (+1,71 Ko ; gzip 120,92 Ko) ; éditeur 256,95 →
  257,26 Ko (+0,31 Ko). Retiré à la demande de l'auteur le test instable
  « drags the independent knob of an inert DGPad expression »
  (`dgp_commands.test.ts`, glisser réel du navigateur).
- 2026-10-30 : étape 4 (macros de transformation). Tests « reads images
  of objects by transformation macros » (`dgo.test.ts`), « maps objects
  by a macro that maps points, as found when applied » (`macros.test.ts`),
  « keeps the initials of a macro that maps points »
  (`tool_palette.test.ts`) et « maps objects by a reflection in a
  hyperbolic line » (`macro_library.test.ts`, `SymétrieH` : arc
  orthogonal au disque, triangle aux côtés courbes) ; la macro « Milieu » de `macro_define.test.ts`
  prend désormais un segment en second initial. Moteur 380,44 → 381,54 Ko
  (+1,10 Ko ; gzip 121,33 Ko) ; éditeur 257,26 → 260,01 Ko (+2,75 Ko).
  Remarque de l'auteur (figure `SymDeSym.dgo`, macro « rond », composée
  de deux symétries axiales) : le polygone image n'était pas rempli avant
  un changement de son opacité. `applyMacro` ajoutait ses entrées hors
  d'un lot (`beginBatch`), l'objet étant dessiné avant d'être stylé ; il
  les ajoute désormais en lot, finaux ordinaires compris.
- 2026-10-30 : étape 5 (sauf le manuel). Paramètre `invertible` rétabli
  (inversion, macros) à côté de `transformable` (similitudes, objets de
  l'espace compris). Tests « reads images of planes, spheres and
  polyhedra, and points on images » (`dgo.test.ts`) et « maps planes,
  spheres and solids in space, and puts points on images »
  (`editor.test.ts`). Moteur 381,54 → 382,09 Ko (+0,55 Ko ; gzip 121,40
  Ko) ; éditeur 260,01 → 260,15 Ko.
- 2026-10-30 : décision 5 révisée avec l'auteur. Les outils et les macros
  ne gardent plus d'eux-mêmes ce qui définit la transformation : Maj-clic
  ou bouton « Garder » de la consigne, pour tout argument (`EDITOR.md`,
  « Arguments gardés »). Tests « keeps a transformation designated with
  Shift… » et « keeps the initials of a macro designated with Shift »
  (`tool_palette.test.ts`). Moteur inchangé (382,09 Ko) ; éditeur
  260,15 → 261,78 Ko (+1,63 Ko). Réservé ensuite aux désignations
  postfixées (ni anneau, ni sélection préalable), test « keeps no
  argument designated before the tool ».
