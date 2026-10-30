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
5. **L'outil garde la transformation** : une fois désignés ce qui la
   définit (centre, droite, vecteur, cercle, angle ou rapport ; initiaux
   d'une macro), l'outil, persistant, ne demande plus que l'objet suivant,
   comme dans DGPad. Aujourd'hui, il redemande son premier argument après
   chaque objet (`EDITOR.md`, « Outil persistant ») : c'est la raison du
   changement d'ordre ci-dessus.
6. Aperçu au survol de l'objet de l'image qu'il donnerait, comme pour un
   point aujourd'hui (et comme CaRMetal, en jaune).

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

- Moteur : `Sym`, `Refl`, `Rot`, `Dil`, `Tra`, `Inv` sont des images de
  **points** seulement (`DGO.md`, tableau des points ; note 15).
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

- **Représentation dans le `.dgo`** : décomposition (images des points de
  définition, puis l'objet reconstruit, comme l'import GeoGebra) ou nœud
  « image de l'objet X par la transformation T » ? La décomposition ne
  demande presque rien au moteur mais ne couvre que les objets définis par
  des points (pas une conique par équation, une fonction, un lieu, un
  objet libre comme un cercle de rayon donné) et multiplie les lignes de
  la construction relue ; un nœud donne une ligne unique
  (`Symétrie(d, poly)`), le type de l'image étant celui de l'objet. Le
  format est additif une fois diffusé (`DGO.md`).
- **Nature conservée par une macro** : inconnue d'avance. Test numérique
  à l'application (les images de plusieurs points d'une droite restent
  alignées, d'un cercle cocycliques), puis droite / cercle reconstruits,
  sinon lieu. Les isométries et homothéties conservent tout ; l'inversion
  envoie droite et cercle sur droite ou cercle selon le cas (exact).
- **Image d'une conique, d'une courbe de fonction** : par une
  transformation affine, une conique reste une conique (équation
  transformée) ; une courbe de fonction n'est en général plus une courbe
  de fonction (lieu ou courbe paramétrée).
- **3D** : rotation autour d'un axe, symétries d'objets de l'espace,
  polyèdres (déjà dans l'import GeoGebra).
- **Glisser** : une image n'est pas mobile ; un point sur l'image ?
- **Manuel** : à mettre à jour dans les 12 langues à la fin, après le feu
  vert de l'auteur (y compris l'ordre des arguments du 2026-10-30, pas
  encore reporté : `commandes.html`, `menu-outils.html`,
  `selection.html`).

## Avancement

- 2026-10-30 : ordre des arguments des transformations (décision 4),
  commit `7aff39c`.
