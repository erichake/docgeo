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
conique par ses coefficients dans `primitive_quadric_object`. L'éditeur
les saisit en `c = x^2 + y^2 = 4` (`EDITOR.md`, « Langage textuel »).
Leur image par une transformation viendra avec l'item 2.

### 2. Rotation, homothétie, translation — fait

Objets `Rot`, `Dil`, `Tra` (item 27 de `GGB_IMPORT.md`) ; les images
d'objets construits sur des points restent faites par `shapes`. Éditeur :
`Rotation`, `Homothétie`, `Translation` au clavier et au menu (famille
« Transformations »). Reste : les images des droites et coniques
d'équation (item 1).

### 3. Arc et secteur de centre donné, demi-cercle — fait

Objets `CArc`, `CSec`, `Semi` (item 28 de `GGB_IMPORT.md`) sur une classe
de base des arcs ; l'orientation des images par une symétrie axiale est
gardée (`orientedShape`, à réutiliser pour tout objet orienté). Éditeur :
`ArcCentre`, `SecteurCentre`, `DemiCercle`, au clavier et au menu.

### 4. Tangentes — fait

Objet `Tan` (item 29 de `GGB_IMPORT.md`) : à un cercle ou une conique
depuis un point (deux solutions), à la courbe d'une fonction. Éditeur :
`Tangente`, au clavier et au menu. Reste, si des figures le demandent :
les tangentes parallèles à une droite et communes à deux cercles.

### 5. Autres constructions planes — fait, sauf un point

Objets `Inv`, `TC`, `RegP`, `Vtx` (item 30 de `GGB_IMPORT.md`). Éditeur :
`CentreInscrit`, `CentreGravité`, `CentreCirconscrit`, `Orthocentre`,
`PolygoneRégulier`, `Sommet`, `Inversion`.

Reste le point sur une droite « dirigée » (parallèle ou perpendiculaire
GeoGebra) : la droite cachée de `directedLine` ne corrige pas la
direction, qui est déjà celle de GeoGebra, mais l'échelle du paramètre :
GeoGebra avance le point en longueurs du vecteur directeur de la droite
de départ (AB), ce qui règle la vitesse de son animation. Le faire par le
paramètre du point demanderait un paramètre de plus aux points sur objet,
pour un gain faible ; laissé de côté.

### 6. La 3D — fait

Plans, intersections, sections et sommets des solides (item 31 de
`GGB_IMPORT.md`) ; cylindre, cône et sphère de rayon donné (item 32).
Restent :

- l'éditeur a ses solides (`Cyl`, `Cone`, `Cube`, `Prsm`, `Pyr`, objets
  uniques qui dessinent tout), mais pas encore de commandes pour les
  plans, les sections ni le patron ; l'import GeoGebra garde ses cubes,
  prismes et pyramides en sommets, faces et arêtes nommés, qui ont leurs
  styles propres ;
- la section d'un cône par un plan (une conique), non importée.

### Hors du chantier

Valeurs et dessins, qui ne sont pas des objets géométriques et peuvent
rester des expressions : `Distance`, `Length`, `Slope`, `Corner`,
`Roots`, `Integral`, `LowerSum` / `UpperSum`, `IterationList`.

## Mesure de référence

Corpus : 238 figures sur 438 sans perte, aucun plantage (après le
correctif du nom d'un segment de longueur nulle, item 24 bis de
`GGB_IMPORT.md`). Moteur : 335,4 Ko après l'item 6 et les solides de l'éditeur.
