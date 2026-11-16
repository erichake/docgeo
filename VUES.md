# Vues multiples — mémo de conception

Ouvert le 2026-11-16. Une figure peut se montrer dans plusieurs vues côte à
côte, comme les Graphiques et Graphiques 2 de GeoGebra : **une seule
construction** (un seul panneau de construction dans l'éditeur), dont chaque
objet est dessiné dans **une** vue.

**Décisions de l'auteur (2026-11-16)** : les vues sont **uniquement des
colonnes** côte à côte (trois vues, trois colonnes ; jamais de découpage
horizontal ni libre) ; on doit pouvoir **redimensionner** les vues (déplacer
leur séparation à la souris) ; chaque vue a ses **propres réglages** (fond,
axes, grille, repère…), indépendants des autres. Une première version qui
découpait la vue sous le pointeur en deux le long de son plus grand côté a
été refusée. Ce n'est pas un classeur : les pages
sont des figures indépendantes montrées une à la fois, les vues montrent la
même figure en même temps, et tout s'y met à jour en direct.

## Modèle

- `construction.views` : chaque vue est une colonne, de gauche à droite dans
  l'ordre des indices, de largeur `share` rapportée à la somme des `share`
  (`rect` en est déduit par `arrangeViews`, en fractions de la fenêtre),
  sa grille (`grid_object` : origine, unité,
  axes, grille, 2D ou 3D, fond propre `background`), son `<svg>` positionné
  dans la page, ses niveaux et calques.
- **Vue courante** (`construction.view`) : `GRID`, `svg`, `traceLayer`,
  `width`, `height` et donc `formulaView()` sont ceux de la vue courante. Elle
  vaut la vue de l'objet calculé pendant la mise à jour
  (`objects_collector.update`, `refresh`), et la vue sous le pointeur pour
  ses gestes (écouteur en capture sur `<html>`, avant tout autre ;
  inchangée pendant un geste bouton enfoncé). `inView(n, f)` calcule dans
  une vue donnée.
- **Vue active** (`construction.active`) : la dernière vue appuyée. C'est
  celle que règle l'éditeur (onglet « Figure » : axes, grille, fond
  propre ; « Nouvelle vue », « Supprimer la vue ») ; l'éditeur l'entoure
  de bleu quand il y a plusieurs vues (`dge-active-view`).
- **Séparations** : entre deux colonnes, une poignée (`div` de 9 px,
  `col-resize`, sauf en mode page web) déplace leur bord ; ce que montrent
  les deux vues reste en place à l'écran (l'origine de celle de droite est
  décalée d'autant) ; à la fin, `dgpad.viewsChanged()` (l'éditeur y fait
  une étape d'annulation). Largeur minimale 40 px.
- `construction_object.view` : l'indice de la vue où l'objet est dessiné,
  celle qui est courante à sa création. `moveToView` le change.
- **Un objet, une vue** : un objet construit sur des objets d'une autre vue
  les voit dans la sienne. La position à l'écran d'un point
  (`point_object.screen`) est celle de sa vue ; lue depuis une autre vue,
  elle y est projetée. C'est ce qui permet au segment de la vue 2 de
  s'appuyer sur des points de la vue 1. Dans le corpus GeoGebra, un objet
  n'est presque jamais montré dans deux graphiques à la fois (3 sur 263) :
  il l'est alors dans le premier seulement.
- Une seule figure plane ou de l'espace pour l'instant : toutes les vues
  ont le type de la première.

## Format

Voir `DGO.md` : `vs` (vues après la première), `cw` (largeur de la
colonne), `bg` (fond propre), style `vw` (vue d'un objet). Une figure à
plusieurs vues est toujours enregistrée et montrée en entier (ni cadrage,
ni centrage en mode intégré). En DGP : commande `View(n, largeur, x0, y0,
unité, unitéY, style)` et style `vw:n`.

## Import GeoGebra

Le graphique 2 (`gui view id="16"`) visible à côté du graphique 1 donne
deux colonnes, aussi larges que dans GeoGebra (`size width`). Il est la
colonne de gauche s'il est à gauche du graphique 1 ou au-dessus
(`secondFirst` : premier chiffre de sa `location` qui diffère, 0 nord,
3 ouest), sinon celle de droite (à droite ou en dessous). Corpus : à droite
15 fois, en dessous 5, à gauche 3. La colonne de droite reçoit son repère,
son style et son fond ; les objets montrés seulement dans son graphique y
sont dessinés (`inSecond`). Le graphique 2 seul (graphique 1 caché)
devient l'unique vue. Une figure 3D n'est pas concernée (ci-dessous).

## Éditeur

Fichier > Nouvelle vue : une colonne de plus, à droite ; toutes les
colonnes prennent la même largeur, chacune gardant son centre ; la nouvelle
reprend les réglages de la vue active, son origine en son centre. Fichier >
Supprimer la vue (la vue active) : sa largeur revient à la colonne de
gauche (de droite pour la première), qui garde son centre, et ses objets y
passent. Les deux s'annulent, comme le déplacement d'une séparation.
L'origine et l'unité de chaque vue ne font pas d'étape d'annulation (comme
celles de la première) ; à la reconstruction d'une étape, chaque vue garde
ce qu'elle montre au même endroit de l'écran (`reframe`, `lefts`).

## Point de reprise (état au 2026-11-16, commité)

Fait et testé : vues multiples de figures planes en colonnes
redimensionnables, vue active et fond propre à chaque vue (moteur, `.dgo`,
DGP, import du graphique 2 de GeoGebra, éditeur), régions d'inéquations de x et
y (`region_object.ts`, `Reg`, `Region`, import des `functionnvar`), mode
page web (`fit.ts`). Corpus `roots.py` 321 → 324 / 456 ; moteur +4,9 Ko.
Figure de référence du chantier : `tests/ggb/synthese_couleurs.ggb` (deux
graphiques, régions coloriées).

### Où est le code

- `src/construction.ts` : `FigureView`, `views`, `view`, getters `GRID`,
  `svg`, `traceLayer`, `width`, `height` (de la vue courante), `inView`,
  `addView(share)`, `arrangeViews` (colonnes en `%`, ligne de séparation
  en `box-shadow`, poignées), `divider`, `active`, `moveToView`, `windowSize`, `resize(index, w, h)`,
  `enterView` (écouteur en capture sur `<html>` : `pointerdown`,
  `pointermove` sans bouton, `wheel`), `paintBackground` (fond propre de
  la vue, sinon celui de la figure), `layer(level, layer, view)`.
- `src/objects_collector.ts` : `update` fixe `c.view = object.view` avant
  chaque calcul, projection et dessin, puis rétablit la vue courante.
- `src/objects/construction_object.ts` : `view` (vue courante à la
  création), `refresh` dans `inView`.
- `src/objects/point_object.ts` : `screen`, `sx`, `sy` projetés dans la
  vue courante si elle n'est pas celle du point (seul objet dont les
  autres lisent la position à l'écran : segments, polygones, angles,
  textes ancrés, images).
- `src/objects/grid_object.ts` : `background`.
- `src/dgo.ts` : `VIEW.bg`, écriture `v`/`vs` (`cw` = `rect[2]`, écrit
  seulement s'il y a plusieurs vues), lecture (`readDgo` : `addView(cw)`
  puis réglages, `arrangeViews`, origines ; pas de centrage avec plusieurs
  vues), style `vw` traité hors de `STYLE`
  (dans `dgoEntry` et `readEntries`, comme `sc`, `rgb`, `mg`) pour qu'un
  objet ajouté sans `vw` reste dans la vue où on l'ajoute ;
  `figureObjects` exclut les grilles de toutes les vues ; `Reg`.
- `src/import/dgp_commands.ts` : commandes `View` et `Region`, style
  `vw`, `background` de `SetCoordsStyle`, `is2D` posé sur toutes les
  grilles.
- `src/import/ggb_translate.ts` : `graphicsView`, `shownView`, `location`
  (remontée en tête), `second` (`"beside"` / `"alone"`), `secondFirst`,
  `views`, `inSecond`, `outOfView` ; `view` (graphique de la colonne de
  gauche), `right` (celui de la colonne de droite) ;
  `coordsStyle(élément de vue)` (factorisé pour servir aux deux
  graphiques) ; émission des deux `View` après `SetCoordsStyle` ; passe
  finale `STL … vw:1` ; `writtenOut` et la traduction des `functionnvar`
  (avec `VALUE_KINDS`, sinon `x(A)` échoue).
- `src/fit.ts` : chaque vue placée et mise à l'échelle dans la région
  (pas de poignées : `fixedSize`).
- `src/editor/main.ts` : `addView`, `deleteView`, `showActiveView`
  (section VIEWS, avant « Formulas read other pages »), entrées du menu
  Fichier, `studio.viewsChanged` (étape après une séparation déplacée),
  `history[…].views` et `record`/`reframe` (`patch.v` remplace toute la
  première vue ; `lefts`), `widen` sur toutes les vues, style
  `svg.dge-active-view`. Libellés `new_view`, `delete_view` dans
  `src/editor/lang/*.ts`.
- `src/editor/view_settings.ts` et `properties.ts` : l'onglet « Figure »
  règle la grille de la vue active (`activeGrid`), refait quand elle
  change ; avec plusieurs vues, « Fond » est le fond propre de la vue.
- Tests : `tests/browser/views.test.ts`.

### Pièges rencontrés

- Le serveur Vite de développement, après des modifications, sert une
  seconde instance de `/src/editor/main.ts` à un `import()` lancé depuis
  Playwright : redémarrer Vite avant tout script qui lit `studio`.
- Le navigateur des tests vitest a une fenêtre de 414 px de large : une
  capture d'une figure de 1000 px y paraît coupée.
- Une figure ne s'affiche qu'après `c.reveal()`.
- `npm run build` écrit dans `doctools_MAIN` : pour mesurer, construire
  `HEAD` dans un `git worktree` temporaire et l'arbre courant avec
  `npx vite build --outDir <dossier temporaire>`, puis comparer les
  chunks `engine-*`.
- `GGB_IMPORT.md` n'est pas au format Prettier : ne pas le reformater.
- `tools/ggb_corpus/reference.mjs shot` : l'applet GeoGebra de référence
  ne restaure pas la disposition des vues (il ne montre qu'un graphique).

### Vérifier

- `npx vitest run --config vitest.browser.config.ts tests/browser/views.test.ts`
- Corpus : `npx vitest run --config tools/ggb_corpus/vitest.corpus.config.ts`
  puis `python3 tools/ggb_corpus/roots.py` (324 sans perte au départ).
- À l'œil : `reference.mjs shot <fichier>` (serveurs : voir son en-tête).
- Éditeur réel : un script Playwright (dans `tools/`, pour trouver
  `playwright`) qui ouvre `http://localhost:5199/editor.html?lang=fr`,
  tape des lignes dans `.dge-input`, survole une vue, clique
  `.dge-menubar > div > button:has-text("Fichier")` puis
  `.dge-menu-popup button:has-text("Nouvelle vue")`, et lit l'état par
  `(await import("/src/editor/main.ts")).studio.scene` (`views`,
  `OBJS.V` avec `view`). Une séparation se déplace par
  `page.mouse.down/move/up` sur le bord gauche d'une vue (`svg`
  `getBoundingClientRect().left`).

## Reste à faire

1. **Vue plane à côté d'une vue 3D** (demandée par l'auteur). Séparer :
    - ce que _calcule_ la figure (points à 2 ou 3 coordonnées) : propriété
      de la figure, par exemple `construction.space` (vraie si une vue est
      3D, ou fixée par la figure) ;
    - ce que _montre_ une vue : `grid.is2D` par vue (plan z = 0 vu de
      dessus, axes du plan, sans rotation, sans sol).

    Les lectures de `GRID.is2D` (une soixantaine, dans `construction.ts`,
    `dgo.ts`, `figure_state.ts`, `workbook.ts`, une dizaine d'objets,
    `dgp_commands.ts` et l'éditeur : `main.ts`, `figure.ts`, `catalog.ts`,
    `pin.ts`, `turtle.ts`, `view_settings.ts`, `web_page.ts`) sont à
    classer une à une : celles qui décident d'une valeur (`scriptValue
(!c.GRID.is2D)`, `vec3`, `space` des transformations et des cercles,
    `perAxis` du `.dgo`…) passent à la propriété de la figure ; celles qui
    décident du dessin ou des gestes (`keydown`, `mousedrag`, `pan`,
    traces, `resize`, axes, `polygon_object` l. ~331, `primitive_line`
    l. ~239) restent à la vue. Les parties cachées (`hidden_line.ts`,
    `paintByDepth`, `floorOccluder` et `OBJS.polygons`/`solids`) ne
    doivent traiter que les objets d'une même vue (aujourd'hui
    `paintByDepth` est appelé en vue 0). Dans le `.dgo`, `3d` de chaque
    vue dit son type ; la propriété de la figure reste à décider (déduite
    des vues, ou clé de la racine : format additif, voir `DGO.md`).
    Ensuite : import des figures GeoGebra « graphique + 3D » en deux vraies
    vues (au lieu de la bande `gi`/`gv` lue par `grid_object.viewInset`,
    `bandBackground`, `flatStart` de `ggb_translate.ts`), et du graphique 2
    à côté d'une vue 3D (p2phkeyw, s6thhndj, yxfyhpuz, mVcNuwvp). Dans
    l'éditeur, « Nouvelle vue » doit pouvoir créer une vue plane ou 3D.

2. Autres réglages par vue à proposer à l'auteur : vue plane ou 3D par vue
   (point 1), verrouiller une vue (ni déplacement ni zoom), changer l'ordre
   des colonnes, image de fond par vue (aujourd'hui `bgi` est celle de la
   figure, montrée dans les vues sans fond propre).
3. Choisir la vue d'un objet dans ses propriétés (éditeur), ou le faire
   glisser d'une vue à l'autre.
4. Manuel (12 langues, après accord de l'auteur) : Fichier > Nouvelle vue,
   Supprimer la vue.
5. Performances des régions : ~27 ms par image en déplaçant A dans
   `synthese_couleurs.ggb` (12 régions, grille de 8 px).
