# Objets natifs à la place des commandes imitées — plan d'attaque

Plan établi avec l'auteur le 2026-10-15. À lire avant de reprendre ce
chantier, avec `AGENTS.md`, `DGO.md`, `GGB_IMPORT.md` et `EDITOR.md`.

## Le problème

L'import GeoGebra (`src/import/ggb_translate.ts`) traduit encore de
nombreuses commandes en **imitations** : au lieu d'un objet de
`src/objects/` qui porte le sens de la commande, il assemble d'autres
objets et des intermédiaires cachés (points définis par une formule
`Point` avec formule, nombres `Expression` cachés, droites, centres ou
intersections auxiliaires nommés `aux n`). La figure se dessine juste,
mais :

- la construction ne correspond plus à celle de l'auteur (GeoGebra montre
  `Ellipse(A, B, C)`, DocGeo montrait `Conique` par cinq points calculés) ;
- le panneau « Construction » et le texte de l'éditeur montrent ce
  bricolage, et l'enregistrement `.dgo` le fige ;
- l'éditeur ne peut pas proposer ces commandes.

L'auteur ne veut plus de ces bricolages : **chaque commande géométrique de
GeoGebra doit devenir un objet natif** dont les parents sont les arguments
de GeoGebra.

## Le modèle à suivre : les coniques (commit `2caee13`)

`Ellipse`, `Hyperbola` et `Parabola` étaient des `Quadric` par cinq points
calculés. Elles sont devenues de vrais objets. Reprendre la même démarche
pour chaque item (voir `git show 2caee13`) :

1. **Objet** dans `src/objects/` (ici `focal_conic_object.ts`,
   `parabola_object.ts`) : calcul direct et robuste dans son repère propre,
   `dgo()` pour l'enregistrement, fonction `create…`. Mettre le code commun
   dans la classe de base plutôt que de le dupliquer (ici le paramètre des
   points sur conique, passé dans `primitive_quadric_object`), et
   remplacer les `instanceof` d'une sous-classe par la classe de base là
   où il s'agit de toute la famille (points sur objet, lieux, ressort,
   aimants…).
2. **Format `.dgo`** (`src/dgo.ts`) : un nouveau type (`Ell`, `Ell1`,
   `Hyp`, `Hyp1`, `Prb`), son lecteur dans `BUILDERS`, son style dans
   `LOOKS`. Documenter dans les tableaux de `DGO.md` (sans changer la
   largeur des colonnes, pour ne pas réaligner tout le fichier), y compris
   le paramètre d'un point sur l'objet s'il est nouveau. Le format n'est
   pas encore diffusé : on peut changer le sens d'un paramètre.
3. **Commande DGP** propre à DocGeo (`src/import/dgp_commands.ts`, à côté
   de `Circle1`), puisque la traduction GeoGebra produit des commandes DGP.
4. **Traduction GeoGebra** : le gestionnaire de `HANDLERS` appelle
   simplement `define(label, kind, "Commande", arguments)`. Supprimer les
   aides devenues inutiles. Penser aux **images par transformation**
   (`shapes`) : un objet dont tous les arguments sont des points en a une
   automatiquement ; sinon la fournir (voir `Parabola`, image du foyer et
   de la directrice).
5. **Éditeur** : la commande dans le catalogue (`src/editor/catalog.ts`),
   son nom dans les 11 fichiers traduits de `src/editor/lang/` (noms usuels
   de la géométrie scolaire, en un mot, jamais repris des fichiers de
   GeoGebra : voir « Langues » dans `EDITOR.md`), une icône dans le menu des
   outils (`src/editor/tools.ts`) si elle se construit par désignation, et
   la mise à jour du test du menu (`tests/browser/editor.test.ts`).
6. **Tests** : l'aller-retour texte → `.dgo` → texte de
   `tests/browser/editor.test.ts` (ajouter les nouvelles lignes), et un test
   d'import qui vérifie la classe de l'objet et ses parents
   (`tests/browser/ggb_importer.test.ts`, voir « builds ellipses,
   hyperbolas and parabolas like GeoGebra »). Les positions enregistrées
   par GeoGebra doivent être retrouvées (`expectSavedPoints`).
7. **Mesures**, avant et après (voir « Mesure » dans `GGB_IMPORT.md`) :
    - corpus : `npx vitest run --config tools/ggb_corpus/vitest.corpus.config.ts`
      puis `python3 tools/ggb_corpus/roots.py`, en comparant avec le corpus
      mesuré sur le commit précédent (`git stash`) : aucune figure ne doit
      perdre d'élément ;
    - build sans toucher à DocTools : `npx vite build --outDir <dossier
temporaire> --emptyOutDir`, en comparant `assets/engine-*.js`
      (moteur, chargé par le lecteur) et `assets/editor-*.js`. Le build doit
      rester très léger ; un nouvel objet coûte en général 1 à 3 Ko.
8. **Documentation** : un item coché dans `GGB_IMPORT.md` (gain mesuré,
   taille du build) avec sa ligne d'historique, `DGO.md`, et `EDITOR.md` si
   le menu des outils change.
9. `npm run check` (formatage, tests, build) avant de proposer un commit ;
   ne committer que sur demande, message en anglais.

## Ce qui reste, par priorité

Repères : les noms de fonctions de `src/import/ggb_translate.ts` (les
numéros de ligne changent).

### 1. Coniques et droites données par une équation — fait

Objets `EqL`, `EqC`, `EqQ` (item 26 de `GGB_IMPORT.md`), réduction d'une
conique par ses coefficients dans `primitive_quadric_object`. Reste pour
l'éditeur : la saisie d'une équation (syntaxe à trancher avec l'auteur) ;
ces objets s'y affichent en lecture seule. Leur image par une
transformation viendra avec l'item 2.

### 2. Rotation, homothétie, translation

`Rotate`, `Dilate` et `Translate` (gestionnaires `transform`, `turn`,
`turn3D`) : chaque image de point est un point formule, et l'image d'un
segment, d'un polygone, d'une conique… est reconstruite sur les images de
ses points (`shapes`). Les symétries centrale et axiale sont déjà des
objets natifs (`symmetry_object`, `reflection_object`) : faire de même.

- Objets « image d'un point par une rotation (centre, angle formule), une
  homothétie (centre, rapport formule), une translation (vecteur) », en
  2D et autour d'un axe en 3D pour la rotation.
- Garder le mécanisme `shapes` pour les objets construits sur des points,
  ou mieux, si c'est plus simple et plus léger, des images natives de
  segments, polygones, cercles et coniques.
- Commandes `Rotation`, `Homothétie`, `Translation` de l'éditeur : le
  mémo (`EDITOR.md`, « Menu des outils ») les attend déjà.

### 3. Arc et secteur de centre donné, demi-cercle

- `CircleArc(M, A, B)`, `CircleSector` (`centerArc`) : un `Arc3pts` par
  deux points calculés cachés (extrémité sur [MB), milieu).
- `Semicircle(A, B)` : un `Arc3pts` par un milieu calculé.

Objets « arc (ou secteur) de centre M, de A jusqu'à la demi-droite [MB) »
et « demi-cercle ». Commandes de l'éditeur correspondantes.

### 4. Tangentes

`Tangent` :

- à un cercle depuis un point extérieur : centre caché, milieu, cercle de
  diamètre, intersections, puis droites ;
- en un point du cercle : centre et droite cachés, puis perpendiculaire ;
- à la courbe d'une fonction : une droite par deux points calculés.

Un objet « tangente » (à un cercle ou à une conique depuis un point, deux
solutions départagées comme les intersections dans `DGO.md` ; à une
courbe en un point). Les tangentes à une conique quelconque, non
importées aujourd'hui, viendront avec.

### 5. Autres constructions planes

- Inversion `Mirror(P, cercle)` (`inversion`) : centre, droite et
  intersection cachés, puis un point formule.
- Polygone régulier `Polygon(A, B, n)` (`regularVertices`) : sommets
  formules. Un objet « polygone régulier » (commande de l'éditeur aussi).
- `TriangleCenter` : point formule en coordonnées barycentriques (centres
  1 à 5 : centre du cercle inscrit, centre de gravité, centre du cercle
  circonscrit, orthocentre, centre du cercle d'Euler).
- Point sur une droite « dirigée » (parallèle ou perpendiculaire
  GeoGebra) : `directedLine` ajoute une droite cachée pour placer le point
  comme GeoGebra. À résoudre par le paramètre du point sur l'objet plutôt
  que par une droite en plus.

### 6. La 3D, le plus gros chantier

- Plans (`definePlane`, `planeThrough`) : un polygone de quatre coins
  calculés ; `Plane(A, d)` et `OrthogonalPlane` passent par des points de
  direction et des symétriques cachés.
- Intersections : deux plans → droite par deux points calculés ;
  plan-sphère et sphère-sphère → `Circle1` de rayon formule avec axe et
  points cachés (`sphereSection`) ; plan-pyramide → polygone de points
  calculés.
- Solides `Cube`, `Prism`, `Pyramid`, `Net` : points formules, polygones et
  segments, sans objet solide. `Cylinder` et `Cone` (`revolution`) sont
  approchés par des facettes. `Sphere(A, r)` passe par un point caché
  A + (r, 0, 0).

Commencer par l'objet « plan », dont dépend le reste.

### Hors du chantier

Valeurs et dessins, qui ne sont pas des objets géométriques et peuvent
rester des expressions : `Distance`, `Length`, `Slope`, `Corner`,
`Roots`, `Integral`, `LowerSum` / `UpperSum`, `IterationList`.

## Mesure de référence

Corpus : 238 figures sur 438 sans perte, aucun plantage (après le
correctif du nom d'un segment de longueur nulle, item 24 bis de
`GGB_IMPORT.md`). Moteur : 309,4 Ko après l'item 1.
