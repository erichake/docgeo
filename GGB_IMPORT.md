# Couverture de l'import GeoGebra

Feuille de route pour étendre l'import `.ggb`, fondée sur des figures réelles
de geogebra.org. **À mettre à jour à chaque implémentation** : cocher l'item,
noter le gain mesuré et reporter la nouvelle ligne dans l'historique.

## Contrainte absolue : un build léger

Le build fait ~269 Ko, là où DGPad et surtout GeoGebra sont très lourds : c'est
un atout essentiel du projet. Chaque ajout doit rester proportionné à ce qu'il
débloque :

- vérifier la taille du build (`npm run build`) avant et après chaque
  implémentation, et la noter dans l'historique ;
- aucune dépendance nouvelle ;
- réutiliser le moteur existant (`dgp_formula.ts`, objets DGP) plutôt que
  d'ajouter du code parallèle ;
- pas de calcul formel : dériver ou intégrer numériquement ;
- renoncer à une fonctionnalité rare dont le coût en taille est élevé.

## Périmètre

Objectif réaliste : environ 75 % du corpus, en traitant les causes par
fréquence plutôt que figure par figure. Au-delà, chaque figure gagnée coûte
plus que les précédentes et alourdit le build.

Hors périmètre, définitivement :

- le calcul formel (CAS) ;
- le JavaScript des figures, ignoré et signalé (voir `AGENTS.md`) ;
- les commandes qui dépendent d'un service extérieur.

Tout le reste est dans le périmètre, y compris les scripts GeoGebra
(GgbScript), traduits en programmes qui s'ouvrent en blocs, les statistiques
(`Mean`, `SD`, `BoxPlot`, `FitPoly`…), les plages du tableur (`A2:A11`, une
liste) et les constructions qui lisent la vue (`Corner`, fonctions de la
figure, `Zip`). Une commande rare n'est pas refusée : elle vient plus tard,
à son rang de fréquence. Une figure testée à la main sur geogebra.org qui
échoue est ajoutée au corpus, pour que sa mesure suive les figures qui
intéressent réellement.

## Mesure

Les outils sont dans `tools/ggb_corpus/`. Le corpus (~470 `.ggb`, 17 Mo) est
hors de git et hors du build.

```sh
python3 tools/ggb_corpus/collect.py 15    # recrée le corpus s'il manque (lent : ~15 min)
npx vitest run --config tools/ggb_corpus/vitest.corpus.config.ts   # importe tout → results.jsonl
python3 tools/ggb_corpus/roots.py         # résumé, causes premières
```

`roots.py` affiche, pour chaque cause, le nombre de figures touchées et le
nombre de figures où c'est la **seule** cause. Il ne compte pas les échecs en
cascade : un `Segment` qui échoue parce qu'un de ses points dépend d'une
commande non gérée n'est pas une cause. Une cause ne nomme que la commande la
plus extérieure d'un élément (`Circle` pour `Circle(A, r, UnitVector[v])`) :
`roots.py` liste donc ensuite, par nombre de figures, les commandes et
fonctions inconnues de `ggb_translate.ts` (absentes de `HANDLERS`,
`FORMULA_COMMANDS`, `LIST_COMMANDS`, `FUNCTIONS` et `ITEM_FUNCTIONS`) trouvées
à l'intérieur des éléments non importés, cascades comprises. N'y figurent que
les commandes de GeoGebra (celles dont la version compilée de
`doctools_MAIN/public/apps/geogebra` connaît une syntaxe) et les fonctions en
minuscules ; les outils personnalisés (macros, `geogebra_macro.xml`) d'une
figure sont seulement comptés. L'API utilisée est
`api.geogebra.org/v1.0/search/materials?query=…&size=…&from=…`, puis
`/v1.0/materials/<id>?scope=extended` (éléments `type: "G"` → `url` du `.ggb`).

## Historique

| Date       | Figures sans perte | Build    | Changement                                                           |
| ---------- | ------------------ | -------- | -------------------------------------------------------------------- |
| 2026-09-28 | 105 / 438 (24 %)   | ~254 Ko  | état initial ; 0 plantage, import médian 4 ms, max 170 ms            |
| 2026-09-28 | 120 / 438 (27 %)   | 254,4 Ko | item 1 : textes LaTeX placés dans le repère (+15)                    |
| 2026-09-28 | 138 / 438 (32 %)   | 255,4 Ko | item 2 : images à un coin, à l'écran, coins lus après (+18)          |
| 2026-09-28 | 142 / 438 (32 %)   | 255,4 Ko | item 3 : le degré « ° » comme constante (+4)                         |
| 2026-09-28 | 159 / 438 (36 %)   | 255,6 Ko | item 4 : booléens dépendants, `¬`, longueurs et angles (+17)         |
| 2026-09-28 | 164 / 438 (37 %)   | 256,0 Ko | item 5 : `Corner(n)`, coins et taille de la vue (+5)                 |
| 2026-09-28 | 170 / 438 (39 %)   | 256,5 Ko | item 6 : `TriangleCenter` pour n = 1 à 5 (+6)                        |
| 2026-09-28 | 171 / 438 (39 %)   | 256,9 Ko | item 7 : appel des fonctions de la figure (+1)                       |
| 2026-09-28 | 171 / 438 (39 %)   | 257,4 Ko | item 7 bis : comparaisons chaînées (exactitude, +0)                  |
| 2026-09-28 | 172 / 438 (39 %)   | 258,1 Ko | item 8 : fonctions mathématiques, `Min`, `Max`, `Mod` (+1)           |
| 2026-09-28 | 181 / 438 (41 %)   | 260,1 Ko | item 9 : droites et coniques données par une équation (+9)           |
| 2026-09-28 | 194 / 438 (44 %)   | 261,1 Ko | item 10 : textes, `FractionText`, étiquettes `a'`, `A_{1}` (+13)     |
| 2026-09-28 | 202 / 438 (46 %)   | 264,8 Ko | item 11 : tangentes, pente, dérivée, intégrales, sommes (+8)         |
| 2026-09-28 | 203 / 438 (46 %)   | 265,4 Ko | item 12 : hasard, valeurs enregistrées ou tirées à l'import (+1)     |
| 2026-09-28 | 211 / 438 (48 %)   | 266,5 Ko | item 13 : solides sur polygone, cône, plans, rotations 3D (+8)       |
| 2026-09-28 | 211 / 438 (48 %)   | 267,0 Ko | item 14 : `Take`, `First`, `Last`, `Sequence(n)`, `l(n)` (+0)        |
| 2026-09-28 | 223 / 438 (51 %)   | 268,0 Ko | item 15 : images d'arcs, polygones, coniques, polyèdres (+12)        |
| 2026-09-28 | 230 / 438 (53 %)   | 269,0 Ko | item 16 : suites de polygones, `Rotate` en formule, listes 3D (+7)   |
| 2026-09-28 | 251 / 470 (53 %)   | 269,3 Ko | item 15 bis : images d'images par une transformation (+0)            |
| 2026-09-28 | 251 / 470 (53 %)   | 269,8 Ko | item 15 ter : points sur une perpendiculaire ou parallèle (+0)       |
| 2026-10-03 | —                  | 275,8 Ko | item 17 : pointillés des traits (style, +0)                          |
| 2026-10-03 | —                  | 276,1 Ko | item 18 : opacité des traits (style, +0)                             |
| 2026-10-04 | 232 / 438 (53 %)   | 297,5 Ko | item 19 : `UnitVector` dans une formule (+0)                         |
| 2026-10-04 | 238 / 438 (54 %)   | 298,8 Ko | item 20 : `Mode`, `Roots`, `Point(A, vecteur)` (+6)                  |
| 2026-10-05 | —                  | 300,7 Ko | item 21 : calques (style, +0)                                        |
| 2026-10-06 | —                  | 302,2 Ko | item 22 : grille (style, +0)                                         |
| 2026-10-14 | —                  | 301,1 Ko | item 23 : flèches, noms, nombres et unité π des axes (style, +0)     |
| 2026-10-15 | 229 / 438 (52 %)   | 308,7 Ko | item 25 : ellipse, hyperbole et parabole natives (+0)                |
| 2026-10-14 | —                  | 303,8 Ko | item 24 : noms des objets autres que les points (style, +0)          |
| 2026-10-15 | 238 / 438 (54 %)   | 308,8 Ko | item 24 bis : pas de nom pour un segment de longueur nulle (+9)      |
| 2026-10-15 | 238 / 438 (54 %)   | 309,4 Ko | item 26 : droite, cercle et conique d'équation natifs (+0)           |
| 2026-10-15 | 238 / 438 (54 %)   | 313,3 Ko | item 27 : rotation, homothétie et translation natives (+0)           |
| 2026-10-15 | 238 / 438 (54 %)   | 314,9 Ko | item 28 : arc et secteur de centre donné, demi-cercle natifs (+0)    |
| 2026-10-15 | 238 / 438 (54 %)   | 316,4 Ko | item 29 : tangentes natives, aussi aux coniques (+0)                 |
| 2026-10-15 | 238 / 438 (54 %)   | 319,3 Ko | item 30 : inversion, centres, polygone régulier natifs (+0)          |
| 2026-10-15 | 238 / 438 (54 %)   | 326,8 Ko | item 31 : plans, sections et sommets des solides natifs (+0)         |
| 2026-10-15 | 238 / 438 (54 %)   | 330,6 Ko | item 32 : cylindre, cône et sphère de rayon donné natifs (+0)        |
| 2026-10-15 | 242 / 438 (55 %)   | 338,8 Ko | item 33 : section d'un cône, patrons des prismes et pyramides (+4)   |
| 2026-10-15 | 265 / 470 (56 %)   | 342,2 Ko | item 35 : macros, `Sequence` de cercles par un point (+2)            |
| 2026-10-16 | —                  | 360,1 Ko | item 36 : cercle d'axe donné, de direction un plan (+1)              |
| 2026-10-16 | —                  | 362,1 Ko | item 37 : translation des polygones, polygones fixés (+0)            |
| 2026-10-17 | 245 / 438 (56 %)   | 365,9 Ko | item 38 : `Sequence` natifs, listes lues par leur nom (+0)           |
| 2026-10-21 | 245 / 438 (56 %)   | 370,5 Ko | item 39 : suites de cercles orientés, détection 3D (+0)              |
| 2026-10-28 | —                  | 372,0 Ko | item 40 : points sur une sphère, un cylindre, un cône (+0)           |
| 2026-10-29 | 251 / 456 (55 %)   | 376,9 Ko | item 41 : arcs et secteurs d'un cercle ou d'une ellipse (+6)         |
| 2026-10-30 | 251 / 456 (55 %)   | 382,7 Ko | item 42 : inversion des objets (+0)                                  |
| 2026-11-13 | 249 / 456 (55 %)   | 324,7 Ko | item 46 : polaires, vitesses variables, nombres figés (+2)           |
| 2026-11-13 | 249 / 456 (55 %)   | 325,0 Ko | item 47 : solides et images natifs, construction lisible (+0)        |
| 2026-11-14 | 240 / 456 (53 %)   | 325,9 Ko | item 52 : scripts des boutons, autres scripts signalés (−16)         |
| 2026-11-14 | 240 / 456 (53 %)   | 326,5 Ko | item 53 : clics, légendes, points creux, axes d'échelles différentes |
| 2026-11-14 | 240 / 456 (53 %)   | 326,7 Ko | item 54 : demi-cercle d'un plan, arcs de centre 3D (+0)              |
| 2026-11-14 | 250 / 456 (55 %)   | 326,7 Ko | item 55 : pas d'un curseur d'angle en degrés (+10)                   |
| 2026-11-14 | 251 / 456 (55 %)   | 326,7 Ko | item 56 : centre de gravité d'un polygone (+1)                       |
| 2026-11-14 | 258 / 456 (57 %)   | 326,8 Ko | item 57 : nombres complexes, scripts de mise à jour (+7)             |
| 2026-11-14 | 258 / 456 (57 %)   | 327,4 Ko | item 58 : polygone régulier d'un curseur, listes dessinées (+0)      |
| 2026-11-14 | 260 / 456 (57 %)   | 327,9 Ko | item 59 : traces, légendes de curseurs, fonctions dans un texte (+2) |
| 2026-11-15 | 265 / 456 (58 %)   | 332,9 Ko | item 63 : repère 3D de GeoGebra, scripts de vue (+0)                 |
| 2026-11-15 | 269 / 456 (59 %)   | 333,2 Ko | item 64 : scripts, `If`, `Execute`, styles, `StartAnimation` (+4)    |

## À faire, par rapport gain / coût

Chiffres de l'état initial : figures touchées / figures où c'est la seule
cause.

- [x] **1. Textes LaTeX placés dans le repère** (~116 / 29). Fait : un
      texte LaTeX ancré devient une `ExpressionOn` LaTeX qui suit son point
      (les `$` sont retirés, KaTeX les refusant en mode math). **+15 figures**
      (105 → 120), cause « text » 116 / 29 → 78 / 14 ; build +0,2 Ko. Le
      reste relève surtout de `LaTeX[…]`, `Name[…]`, `FractionText` (item 10)
      et des angles dans les textes.
- [x] **2. Images avec un seul coin** (44 / 18). Fait : coin inférieur
      gauche seul (taille en pixels, comme GeoGebra), coins A et D sans B
      (B calculé en gardant les proportions), images fixées à l'écran
      (`ScreenImage`, `Img` à position `[x, y]` dans le `.dgo`), et objets
      traduits après les points de leurs `startPoint` (GeoGebra enregistre
      parfois une image avant ses coins). **+18 figures** (120 → 138), cause
      « image » 44 / 18 → 12 / 1 ; build +1 Ko. Restent les images
      `centered` (coin n° 3 = centre, 5 figures ayant d'autres causes) et
      les coins non construits.
- [x] **3. Rotation en degrés `Rotate(A, 90*°, M)`** (17 / 7). Fait : `°`
      devient `*(π/180)` après un opérande (`90°`, `(90 / n)°`), `(π/180)`
      sinon (`90*°`, `α / °`). **+4 figures** (138 → 142), cause
      « Rotate » 17 / 7 → 11 / 3 : le reste est la rotation 3D autour d'un
      axe (item 13). Build inchangé.
- [x] **4. Conditions d'affichage booléennes** (~40). Fait : `¬`
      devient `!`, `true` et `false` sont lus, un booléen défini par une
      expression devient une case à cocher calculée, non cliquable (ou une
      case libre si l'expression est constante), et une formule numérique
      lit un segment comme sa longueur et un angle comme sa valeur (en
      radians). **+17 figures** (142 → 159) ; causes « condition »
      38 / 7 → 5 / 0, « boolean » 23 / 1 → 5 / 0, et « text » 73 / 14 →
      62 / 9 par les longueurs ; build +0,2 Ko. Restent des booléens sur des
      listes (`∈`, `⊆`, `IndexOf`), le parallélisme `∥` et l'égalité de
      points.
- [x] **5. `Corner(n)`** (19). Fait : `Corner(n)` et `Corner(1, n)`,
      en commande ou dans une formule, deviennent des formules de la
      fenêtre (`windowcx()`, `windoww()`…) ; 5 et 6 donnent la taille de la
      vue en pixels. Un point ou un nombre qui ne lit que la fenêtre est
      désormais recalculé avec elle, au lieu d'être figé à l'import.
      **+5 figures** (159 → 164), cause « Corner » 19 / 0 → 0 ; build
      +0,4 Ko. Restent `Corner(texte, n)` et `Corner(image, n)`, rares.
- [x] **6. `TriangleCenter(A, B, C, n)`** (8 / 7). Fait : centre du
      cercle inscrit, centre de gravité, centre du cercle circonscrit,
      orthocentre et centre du cercle d'Euler (n = 1 à 5), en points
      calculés par leurs coordonnées barycentriques. **+6 figures**
      (164 → 170), cause « TriangleCenter » 8 / 7 → 0 ; build +0,5 Ko.
      Reste n = 13 (point de Fermat), dans une figure.
- [x] **7. Appel d'une fonction de la figure** (~35) : `(x(A), f(x(A)))`,
      `f(a)` dans un texte ou une expression. Fait : une fonction de x
      (courbe `Cur`) s'appelle par son nom dans les formules des points,
      listes, textes, expressions et autres fonctions (`DGO.md`), et
      `If(x ≥ 1, …, 0)` définit une fonction. **+1 figure** (170 → 171),
      figures touchées par un appel non traduit 47 → 41 ; build +0,4 Ko. Le
      mécanisme marche, mais les fonctions appelées restantes sont presque
      toutes elles-mêmes non traduites : `Random` (item 12), `Derivative`,
      `Function(f, a, b)` (item 11), `LaTeX[f]` (item 10), et surtout les
      comparaisons chaînées (item 7 bis).
- [x] **7 bis. Comparaisons chaînées** (~10) : `xmin ≤ x ≤ xmax` dans
      une fonction, `1.5 < s < 2.5` dans un `If` ou une condition. Fait :
      toute formule traduite lit `a < x ≤ b` comme `a < x && x ≤ b`, le
      sens de `<` dans les formules DGP restant celui de DGPad. Ces
      comparaisons étaient déjà acceptées, mais lues à tort `(a < x) ≤ b` :
      le gain est d'exactitude (29 figures du corpus en contiennent),
      **+0 figure** sans perte (171). Au passage, un appel de fonction de
      la figure ne rend plus une formule « constante » (un point
      `(f(1), f(3))` était figé à l'import). Build +0,4 Ko.
- [x] **8. Fonctions mathématiques absentes de `FUNCTIONS`** : `exp`, `ln`,
      `log`, `round`, `ceil`, `sgn`, `min`, `max`, `cot`… Fait : une
      fonction se traduit par un nom DGP ou par une expression de ses
      arguments traduits (`exp`, `ln`, `log(x)` et `log(b, x)`, `round(x)`
      et `round(x, n)`, `ceil`, `sgn`, `cot`, `min`, `max`, `Min`, `Max`
      avec une liste `{…}` écrite, `Mod` jamais négatif, `z` d'un point 3D,
      la constante `ℯ`), et `Min`, `Max`, `Mod` sont aussi des commandes
      donnant un nombre. Seules les fonctions présentes dans le corpus sont
      gardées (hyperboliques, `cbrt`, `nroot`, `sec`, `lg`, `Div` n'y
      figurent pas). **+1 figure** (171 → 172), éléments non importés
      5373 → 5253 (−120, surtout par cascade : `Min` d'une liste, `z` en
      3D) ; build +0,8 Ko.
- [x] **9. Droites et coniques données par une équation** (~40) :
      `y = a x + b`, `x = 1`, `y = x² + 2x − 3`, `y² = 8x`, avec des
      paramètres. Fait : sans calcul formel, le polynôme L − R de
      l'équation est évalué en 3 points (droite) ou 6 points (conique) par
      des nombres cachés, qui en donnent les coefficients à chaque
      mouvement. Une droite passe par deux points calculés ; un cercle
      (d'après la matrice enregistrée) reste un cercle, de centre et rayon
      calculés ; une autre conique est une `Quadric` par cinq points
      calculés dans son repère propre (ellipse, hyperbole dont l'axe
      transverse est choisi en mouvement, parabole), sa nature étant lue
      dans la matrice de GeoGebra. Les droites et coniques constantes
      (sans expression) passent par le même chemin. **+9 figures**
      (172 → 181), éléments non importés 5253 → 5002 (−251) ; causes
      « conic » 15 / 12 → 1 / 0, « line » 26 / 6 → 1 / 0 ; build +2 Ko.
      Une copie `c' = c` d'une conique, auparavant figée, est désormais
      signalée. Restent les coniques 3D et les équations de degré > 2.
- [x] **10. Fonctions texte** (~30) : `Name`, `round`, `FractionText`,
      `Text`, `TableText`, `RotateText`, `Coordinates`. Fait : un texte
      écrit `Name[A]` comme l'étiquette, un angle seul en degrés suivi de
      « ° », un point seul comme `(1.23, 2)` (vérifié dans GeoGebra ; le
      `LaTeX` d'un point, qui écrivait `(x; y)`, suit), et lit points et
      polygones dans ses formules ; la commande `Text(objet, point)` et un
      point d'ancrage écrit en calcul (`A + (0, 1)`) sont traduits ;
      `FractionText` donne la première réduite de fraction continue à
      1e-8 près, comme GeoGebra (`\frac{ 19601 }{ 13860 }` pour √2), par un
      script caché. Surtout, une formule lit désormais les étiquettes à
      primes ou indices entre accolades (`a'`, `A'_{1}`), qui échouaient
      partout, et l'ordre de traduction en tient compte. **+13 figures**
      (181 → 194), éléments non importés 5002 → 4531 (−471) ; cause
      « text » 54 / 10 → 27 / 1 ; build +1 Ko. Restent `TableText`
      (8 figures, qui attendent toutes aussi `Random` ou `Shuffle`,
      item 12), `RotateText` (3), `LaTeX` d'une fonction ou d'une conique,
      l'ancrage `absolute` calculé, et les textes dont le point d'ancrage
      n'est pas importé (la plupart des 27 restants). `Coordinates`
      n'apparaît pas dans le corpus.
- [x] **11. Analyse** (~30 au total) : `Tangent` (courbe ou cercle), `Slope`,
      `Length`, `Function(f, a, b)`, `Derivative` (numérique), `Integral(f, a, b)`
      (aire hachurée), `LowerSum`/`UpperSum`. Fait : tangente à une
      fonction en x(A) (dérivée par différence centrée), à un cercle en un
      point qu'il porte, ou depuis un point extérieur (par le cercle de
      diamètre [A, centre]) ; `Slope` d'une droite, en commande ou dans une
      formule, dessiné comme le triangle de pente de GeoGebra depuis le
      point de départ de la droite ; `Length` d'une liste, d'un segment,
      d'un vecteur ou d'un point ; `Function(f, a, b)` (bornes de la courbe
      si constantes, sinon condition) ; `Derivative(f)` ; `Integral(f, a, b)`
      par la méthode de Simpson (1000 intervalles) ; `LowerSum`, `UpperSum`,
      chaque rectangle ayant pour hauteur le minimum ou le maximum de 17
      échantillons. Aires et rectangles sont une nouvelle nature de liste
      `polygon` (région remplie, `DGO.md`). Au passage, une liste écrite
      `{1, a, 3}` est lue. **+8 figures** (194 → 202) ; causes « Tangent »
      15 / 6 → 2 / 2 (coniques), « Slope » 5 / 2, « Function » 7 / 4,
      « Derivative » 5 / 0, « Integral » 3 / 2 → 0 ; build +3,7 Ko. Écartées faute de gain
      mesuré : la tangente à une conique autre qu'un cercle (Pascal au
      point, polaire depuis un point extérieur : 2 figures, bloquées par
      ailleurs, ~1 Ko), `Integral(f)` (calcul formel), `IntegralBetween`
      (1 figure, bloquée par `Sup`, `Inf`), `Derivative(f, x)` à plusieurs
      variables et `Length` d'un texte (4 figures, attendant aussi
      `TableText`).
- [x] **12. Hasard** (~15) : `Random`, `Shuffle`, `RandomElement`
      (générateurs d'exercices). Fait : un nombre ou un point aléatoire
      garde la valeur enregistrée par GeoGebra (`Random`, `RandomBetween`,
      `RandomUniform`, `RandomElement`, un point `(Random[…], …)`), de même
      qu'une liste aléatoire (`Shuffle`, `Sequence` de nombres aléatoires :
      attribut `randomResult`), ce qui garde aussi l'état élève valable ;
      `Random(a, b)` dans une fonction, dont GeoGebra n'enregistre pas la
      valeur, est tiré une fois à l'import, comme `RandomElement` d'un
      texte. Au passage, `Element` est aussi une commande (texte, point ou
      nombre), et un texte affiche une partie de type chaîne (mot d'une
      liste). **+1 figure** (202 → 203) ; causes « Random » 13 / 0 et
      « Shuffle » 12 / 0 → 0, « RandomElement » 2 / 0 → 2 / 0 (`Remove`) ;
      build +0,6 Ko. Ces générateurs d'exercices attendent surtout
      `TableText`, `Zip`, `SelectedIndex`, les listes appelées `l(n)` et
      des images.
- [x] **13. 3D** (~30) : `Pyramid` et `Prism` construits sur un polygone,
      `Cone`, plans définis par une équation (`plane3d`), `Rotate` autour d'un
      axe, `OrthogonalLine(…, space)`. Fait : `Pyramid(poly, S)` et
      `Pyramid(poly, h)` (sommet au-dessus du centre des sommets),
      `Prism(poly, h)`, le long de la normale du polygone orientée vers le
      haut comme dans GeoGebra ; `Cone(C, S, r)` comme le cylindre (disque
      de base à 60 côtés, faces latérales triangulaires) ; un plan donné par
      une équation ou par ses coefficients enregistrés, par le même calcul
      que les droites (item 9) ; `Rotate(P, a, droite)` et
      `Rotate(P, a, A, vecteur ou droite)` par la formule de Rodrigues ;
      `OrthogonalLine(P, d, space)` et `(P, d, xOyPlane)`, qui sont la
      perpendiculaire de DGP. **+8 figures** (203 → 211) ; causes
      « Pyramid » 9 / 5, « Prism » 4 / 4, « Cone » 8 / 2, « plane3d »
      12 / 2, « OrthogonalLine » 6 / 4 → 0, « Rotate » 10 / 3 → 10 / 2 ;
      build +1,1 Ko. Restent les rotations d'objets autres que des points
      (droites, polygones, polyèdres, coniques : la plupart des « Rotate »
      restants, en 2D comme en 3D) et les angles dans une formule
      (`Angle[A, O, B]`).
- [x] **14. Listes** : `Take`, `First`, `Zip`, `Flatten`, `IndexOf`,
      `Append`. Rares ; au cas par cas. Fait : `Take(l, m, n)`,
      `First(l, n)` et `Last(l, n)`, lus comme des listes de formules (en
      commande ou dans une formule), `Sequence(n)` et `Sequence(a, b)`, et
      l'appel `l(n)` du n-ième élément d'une liste. **+0 figure** (211) ;
      causes « Take » 2, « First » 3 → 0 ; build +0,5 Ko. Les figures qui
      les emploient sont de gros exercices interactifs, bloqués aussi par
      `TableText`, `SelectedIndex`, `ClosestPoint`, `Insert`, les listes
      d'objets (`{Segment[A, B], …}`) ou les rotations de polygones.
      `Zip`, `Flatten` d'une suite de suites, `Append` et `IndexOf` ont été
      écrits puis retirés : +1,1 Ko pour aucune figure gagnée.

- [x] **15. Transformations d'objets autres que des points** (29 / 16) :
      `Rotate`, `Translate`, `Mirror`, `Dilate` n'acceptaient qu'un point
      (et une itération de segments). Fait : chaque objet défini par des
      points garde ces points et sa commande DGP (segment, droite, vecteur,
      cercle par points, arc et secteur, conique par cinq points, polygone),
      et son image est la même commande sur les images de ces points ; un
      polyèdre (`Cube`, `Pyramid`, `Prism`) garde ses faces, et son image
      dessine les leurs et leurs côtés, dans le style du polyèdre, sa
      condition d'affichage s'appliquant à chacun. La réflexion par un
      cercle (inversion) reste limitée aux points. Au passage, `Translate`
      accepte tout vecteur calculé (`Vector[(2 * v) + w]`, `(a, b)`, qui
      lisent les vecteurs de la figure). GeoGebra ne nomme, dans tout le
      corpus, que l'image elle-même, jamais ses sommets ni ses côtés.
      **+12 figures** (211 → 223), éléments non importés 3634 → 2970
      (−664, surtout les 101 cubes translatés d'une figure) ; causes
      « Translate » 17 / 5 → 8 / 0, « Rotate » 9 / 2 → 2 / 0, « Dilate »
      2 / 0 → 0, « Mirror » 11 / 8 → 9 / 6 ; build +1 Ko. Les 6 « Mirror »
      restants sont le côté d'un cône réfléchi par le plan `z = 0`, dans des
      figures qui définissent aussi des surfaces par une équation
      (`functionNVar`, `IntersectPath` avec elles) : `roots.py` ne les
      compte pas, une expression `Cone: z = …` lisant son propre nom. Restent
      aussi les images de listes, de fonctions et de plans, la
      réflexion par un plan, et les cercles de rayon donné (`Circle1`).
      Constaté sans rapport avec l'item : l'intersection d'un cercle du plan
      et d'un cercle 3D est indéfinie (figure des 101 cubes, dont une
      partie reste donc à l'origine).
- [x] **15 bis. Images d'images** : `Dilate(image1, -e, O)`,
      `Rotate(image, α, O)`… Fait : une image définie par au moins deux
      coins est l'image des images de ses coins A, B et D (D, s'il manque,
      n'est construit que pour une transformation, pour qu'une symétrie
      axiale retourne l'image). Éléments non importés 2907 → 2893 (−14 :
      `acq2y7nx` et 13 rotations d'images de `ymm8gspz`) ; figures sans
      perte inchangées (causes restantes ailleurs) ; build +0,3 Ko.
- [x] **15 ter. Points sur une perpendiculaire ou une parallèle**
      (exactitude) : GeoGebra place `Point(d)` depuis le point de départ de
      d le long de son vecteur directeur non normé (celui de la droite de
      référence, tourné d'un quart de tour pour une perpendiculaire), là où
      DGP prend un vecteur unitaire : quand la droite de référence
      s'allongeait, le point ne suivait pas. Fait : un tel point est posé
      sur une droite cachée par son départ et ce vecteur, confondue avec d.
      Positions à l'ouverture inchangées sur tout le corpus (≈ 60 figures
      concernées) ; build +0,5 Ko.
- [x] **16. Listes d'objets** (16 / 2) : `Sequence(Polygon[…], …)`
      (14 figures), `Sequence(Segment[…], …)` en 3D (15 figures, le
      `Sequence` dessiné étant limité au 2D), `Sequence` de vecteurs,
      droites, perpendiculaires, arcs et cercles, `Zip` de vecteurs ou de
      textes, listes écrites `{Segment[A, B], …}`. Fait : un `Sequence` de
      points, de segments ou de polygones est lu par `listFormula` (plus de
      limite au 2D : dans une figure 3D, une liste lit les trois coordonnées
      de ses points, comme les autres formules), et une suite de points
      s'appelle ensuite par `Element[l, i]` ; une nouvelle nature de liste
      `polygons`, additive dans le `.dgo`, dessine un polygone par suite de
      points définis, chaque polygone étant suivi d'un point indéfini ;
      `Polygon(liste)` est la nature `polygon` ; `Rotate` et `Translate` d'un
      point ou d'un vecteur se lisent dans une formule ; l'image d'une liste
      écrite (`Translate({t2, t3}, A - G)`) est l'image de chacun de ses
      éléments (item 15), dans le style de la liste. **+7 figures**
      (223 → 230), éléments non importés 2970 → 2907 ; causes « Sequence »
      20 / 7 → 11 / 5, « Polygon » 18 / 1 → 10 / 0 ; build +1 Ko. Restent,
      chacun dans une ou deux figures : les `Sequence` imbriqués (deux
      indices), de cubes, d'arcs par trois points, de textes et de matrices,
      et `Sum` d'une liste qui dépend de l'indice (`A + Sum[First[l, i]]`),
      qu'une expression cachée ne peut calculer pour chaque élément. `Zip`
      (4 figures) est toujours bloqué par ailleurs.

- [x] **17. Pointillés** : le `type` de `lineStyle` (10, 15, 20, 30 :
      tirets courts, longs, pointillé, tiret-point) était ignoré, tout trait
      étant plein. Fait : il devient le style `ld`, motif en pixels calculé
      comme `EuclidianStatic.getStroke` pour une demi-épaisseur w (`4+w, 4`,
      `8+w, 8`, `w, 3`, `8+w, 4, w, 4`), et pointille droites, segments,
      cercles, arcs, coniques, contours de polygones, courbes et lieux.
      Aucun gain sur le compte des figures sans perte (c'est un style) ;
      build +0,15 Ko.
- [x] **18. Opacité du trait** : l'`opacity` de `lineStyle` (0 à 255, 178
      par défaut, écrite seulement en dessous de 255) était ignorée, les
      traits étant opaques. Fait : elle devient le style `lo`, appliquée
      comme `Drawable.getObjectColor` à la couleur des traits seulement
      (`stroke-opacity` du groupe de l'objet, pointes des droites et point
      d'angle droit compris), jamais au remplissage. Aucun gain sur le
      compte des figures sans perte ; build +0,3 Ko.
- [x] **19. `UnitVector` dans une formule** : `A - UnitVector[s]`, qui
      place l'étiquette d'une droite
      (`tests/ggb/Benjamin/6eme_Droites_secantes.ggb`), faisait ignorer le
      point et les textes posés sur lui. Fait : le vecteur unitaire d'un
      segment (de son début à sa fin), d'une droite (sa direction) ou de
      tout vecteur calculé, en 2D comme en 3D. **+0 figure** du corpus
      (232) : ses 7 figures à `UnitVector` sont bloquées par ailleurs
      (`Zip`, `Circle` autour d'un axe, `Point` sur un vecteur,
      `AngularBisector` de deux droites) ; build +0,2 Ko. `roots.py` ne
      nommant que la commande la plus extérieure d'un élément non importé,
      `UnitVector` n'apparaissait dans aucune cause : il liste depuis les
      commandes inconnues à l'intérieur de ces éléments.
- [x] **20. Commandes cachées dans les éléments non importés** : la liste
      de `roots.py` (item 19). Toutes ont été écrites (`Name`, `Defined`,
      `Radius`, `Vertex`, `UnitOrthogonalVector`, `Product`, `IndexOf`,
      `IsInRegion`, `PathParameter`, `asind`, `Append`, `Zip`, `Shuffle`,
      `Remove`, `KeepIf`, `Flatten`, `PlaneBisector`, `Point(chemin, t)`,
      `CurveCartesian`, `RotateText`, commandes géométriques imbriquées
      dans une formule…), pour +7,4 Ko, puis retirées faute de figure
      gagnée, sauf : `Mode` (valeurs les plus fréquentes, croissantes,
      calculées par le script d'une expression cachée), `Roots(f, a, b)`
      (changements de signe sur 200 échantillons, puis dichotomie) et
      `Point(A, vecteur)`. Au passage, une droite donnée par son équation
      suit la direction (b, −a) de GeoGebra. **+6 figures** (232 → 238),
      éléments non importés 2889 → 2844 ; build +1,3 Ko. Les 3 figures à
      `Mode` s'ouvrent dans l'état enregistré : leurs listes déroulantes ne
      sont pas dessinées et `SelectedIndex` garde sa valeur enregistrée.
      `CSolve` et `IFactor` relèvent du calcul formel (écarté).
- [x] **21. Calques** : le `layer` d'un élément (0 à 9, dans 79 figures
      du corpus sur 470) était ignoré. Fait : il devient le style `l`, le
      calque de DGPad (`construction_object.level`) : un objet est peint
      au-dessus de ceux des calques plus bas, points compris. Aucun gain sur
      le compte des figures sans perte (c'est un style) ; build +0,8 Ko,
      calques DGPad compris. Depuis le 2026-11-13, pas dans une figure 3D :
      la vue 3D de GeoGebra ignore les calques et n'ordonne que par la
      profondeur (une base blanche au calque 1 recouvrait des pyramides).
- [x] **22. Grille** : DocGeo dessinait toujours la grille de DGPad, aux
      graduations de ses axes. Fait, mesuré sur GeoGebra : la distance fixe
      `<grid distX distY>` (sinon celle des nombres), la sous-grille du type
      3 (cinq intervalles, lignes pâles) ou son absence (type 0), la couleur
      `gridColor`, `gridIsBold` et les pointillés `lineStyle grid` (116
      figures du corpus sur 470 ont une grille, 39 pointillée). Les axes sont
      gradués sur une grille à distance fixe. Les grilles isométrique,
      polaire et en points restent cartésiennes. Build +1,5 Ko.
- [x] **23. Axes** : DocGeo dessinait les axes de GeoGebra avec le gros
      triangle de DGPad, sans leur nom ni leur unité, et avec tous leurs
      nombres. Mesuré sur les 152 figures planes du corpus qui montrent axes
      ou grille : flèches ouvertes (`lineStyle axes` 1 et 3, 114 figures),
      pleines (9 et 11, 11 figures), aucune (0, 1 figure) ; noms d'axes
      (`label`, 25 axes, un `$x$` LaTeX lu comme `x`) ; nombres masqués
      (`showNumbers`, 21 axes, graduations gardées) ; unité π (`unitLabel`,
      7 axes). Fait d'après `DrawAxis.java` : flèches d'un tiers de la taille
      des nombres (un pixel de plus par axes gras), nom en bout d'axe, nombres
      multiples de π/2 écrits `π/2`, `π`, `3π/2`… comme le `formatPiE` actuel
      de GeoGebra (la version compilée de `doctools_MAIN` n'écrit encore que
      `π`). Les nombres d'une distance fixe non décimale (`π/2` sans unité)
      ont au plus les décimales de GeoGebra (`1.57`, plus `1.5707963268`).
      Grilles isométrique et polaire, point de croisement des axes : aucune
      figure du corpus. Rapport x:y différent de 1 (14 figures) : écarté,
      chantier du moteur. Build +1,9 Ko (+0,8 Ko en gzip).
- [x] **24. Noms des objets autres que les points** : seul le nom des
      points était écrit. Mesuré sur le corpus : 151 figures sur 459
      montrent le nom d'un segment (271), d'une droite (102), d'une
      fonction (39), d'une conique (35), d'un vecteur (31), d'un polygone
      (17), d'un arc (7) ou d'une demi-droite (4). Fait d'après
      `DrawSegment`, `DrawLine`, `DrawRay`, `DrawVector`, `DrawConic`,
      `DrawConicPart`, `DrawParametricCurve` et `DrawPolygon` : segment à
      16 pixels du milieu, droite au bord de la fenêtre, cercle et ellipse en
      haut à gauche, arc à côté de son milieu, courbe à son premier point
      dans la fenêtre, polygone à la moyenne de ses sommets ; hyperbole et
      parabole à leur sommet. Le style DGP `lb` (propre à DocGeo) les
      distingue du `sn` de DGPad, qui n'écrit que le nom des points. Le
      décalage `labelOffset` est converti à l'import en place relative à
      l'objet (`no` de `DGO.md`), qui la garde quand l'objet change, là où
      GeoGebra garde un décalage fixe en pixels (ajouté ensuite avec le
      glisser des noms dans l'éditeur, +1,9 Ko). Écartés : la valeur (`labelMode` 1
      et 2, 132 étiquettes) et la légende (`caption`, 94), qui n'écrivent
      rien plutôt qu'un nom faux. Build +2 Ko (+0,6 Ko en gzip).
- [x] **25. Ellipse, hyperbole et parabole natives** : `Ellipse(F, G, P)`,
      `Ellipse(F, G, a)`, `Hyperbola(…)` et `Parabola(F, d)` étaient
      traduites en une `Quadric` par cinq points calculés, avec leurs
      objets cachés intermédiaires (nombres, points). Elles deviennent les
      objets `Ell`, `Ell1`, `Hyp`, `Hyp1` et `Prb` de `DGO.md` (commandes DGP
      propres à DocGeo `Ellipse`, `Ellipse1`, `Hyperbola`, `Hyperbola1`,
      `Parabola`), de parents les arguments de GeoGebra, calculés dans leur
      repère propre, ainsi que les commandes de même nom de l'éditeur.
      L'image d'une parabole par une similitude est la parabole des images
      de son foyer et de sa directrice, si celle-ci passe par deux points.
      Corpus inchangé (229 figures sur 438 sans perte, comme juste avant :
      les 15 plantages dans `nameAt` d'un segment sont antérieurs), points
      enregistrés retrouvés dans les figures qui les utilisent. Moteur
      +2,6 Ko (+0,9 Ko en gzip).
- [x] **26. Droite, cercle et conique d'équation natifs** : une droite
      (`y = a x + 1`) était une `Line` par deux points calculés, une
      conique (`x²/9 + y²/4 = 1`) une `Quadric` par cinq points calculés
      sur des nombres cachés, un cercle un `Circle1` de centre calculé.
      Ils deviennent les objets `EqL`, `EqC` et `EqQ` de `DGO.md`
      (commandes DGP propres à DocGeo `EquationLine`, `EquationCircle`,
      `EquationConic`), dont les parents sont les objets que lit
      l'équation, gardée telle que l'auteur l'a écrite : ses deux membres,
      formules en x et y, donnent les coefficients à chaque mouvement. Une
      conique d'équation change de nature (ellipse, hyperbole, parabole)
      avec eux, comme dans GeoGebra ; la réduction d'une conique par ses
      coefficients est passée de `Quad` à la classe de base. L'image d'une
      droite ou d'une conique d'équation par une transformation n'est plus
      construite (aucune figure du corpus ne l'emploie) : elle viendra avec
      les transformations natives. Corpus inchangé (238 figures sur 438
      sans perte). Moteur +0,7 Ko (inchangé en gzip).
- [x] **27. Rotation, homothétie et translation natives** : l'image d'un
      point par `Rotate`, `Dilate` et `Translate` était un point formule.
      Elle devient les objets `Rot`, `Dil` et `Tra` de `DGO.md` (commandes
      DGP propres à DocGeo `Rotation`, `AxisRotation`, `Dilation`,
      `Translation`, `Translation1`), de parents les arguments de
      GeoGebra : centre (l'origine sans lui), angle ou rapport (nombre ou
      formule), axe en 3D (une droite ou un vecteur, ou leur parallèle par
      un point), vecteur, point (son vecteur position) ou formule. Les
      images de segments, polygones, coniques… restent construites sur les
      images de leurs points (`shapes`). Corpus : 238 figures sur 438 sans
      perte, inchangé, mais deux figures perdent moins d'éléments (16 → 9
      et 9 → 7) : un axe de rotation n'a plus besoin d'un point connu de la
      traduction ; leurs images tombent sur les positions enregistrées par
      GeoGebra. Moteur +3,6 Ko (+0,7 Ko en gzip).
- [x] **28. Arc et secteur de centre donné, demi-cercle natifs** :
      `CircleArc(M, A, B)` et `CircleSector` étaient un `Arc3pts` par deux
      points calculés cachés, `Semicircle(A, B)` par un milieu calculé. Ils
      deviennent les objets `CArc`, `CSec` et `Semi` de `DGO.md` (commandes
      DGP propres à DocGeo `CenterArc`, `CenterSector`, `Semicircle`), de
      parents les arguments de GeoGebra, sur une classe de base des arcs
      (`primitive_arc_object`) que partage `Arc3pts`. Une symétrie axiale
      renverse le sens de parcours : l'image d'un arc de centre donné est
      parcourue dans le sens indirect (`[M, A, B, 1]`), celle d'un
      demi-cercle de [AB] est le demi-cercle de [B'A'], et les images de
      ces images le savent (`orientedShape`) ; une symétrie centrale, un
      demi-tour, est désormais une transformation directe. Corpus inchangé
      (238 figures sur 438 sans perte, aucun élément perdu), points
      enregistrés retrouvés comme avant. Moteur +1,6 Ko (+0,4 Ko en gzip).
- [x] **29. Tangentes natives** : `Tangent(P, cercle)` passait par un
      centre, un milieu, un cercle de diamètre et des intersections cachés,
      en un point du cercle par une perpendiculaire, et `Tangent(P, f)` par
      deux points calculés ; les tangentes à une autre conique étaient
      ignorées. Elles deviennent l'objet `Tan` de `DGO.md` (commande DGP
      propre à DocGeo `Tangent`), de parents P et le cercle, la conique ou
      la courbe : contacts sur la polaire de P, dérivée exacte d'une
      fonction. Le triangle de pente d'une tangente à une fonction
      (`Slope`) part de son point de contact, calculé pour lui seul.
      Corpus : 238 figures sur 438 sans perte, mais deux figures perdent
      bien moins d'éléments (17 → 1 et 6 → 1) ; les 18 tangentes du corpus
      importées coïncident avec les droites enregistrées par GeoGebra (13
      avant), dans l'ordre de ses deux solutions. Moteur +1,5 Ko (+0,6 Ko
      en gzip).
- [x] **30. Inversion, centres de triangle, polygone régulier natifs** :
      `Mirror(P, cercle)` passait par un centre, une droite et une
      intersection cachés, `TriangleCenter(A, B, C, n)` (n de 1 à 5) était
      un point formule, et les sommets de `Polygon(A, B, n)` aussi. Ils
      deviennent les objets `Inv`, `TC`, `RegP` et `Vtx` de `DGO.md`
      (commandes DGP propres à DocGeo `Inversion`, `TriangleCenter`,
      `RegularPolygon`, `Vertex`) : le polygone régulier calcule ses
      sommets, et ceux que GeoGebra nomme en sont les sommets ; son image
      par une symétrie axiale est celui de [B'A']. Le polygone régulier
      dans un plan de l'espace attend l'objet plan (item 6 de
      `NATIVE_OBJECTS.md`). Corpus inchangé (238 figures sur 438 sans
      perte, aucun élément perdu), points enregistrés retrouvés comme
      avant. Moteur +2,9 Ko (+0,7 Ko en gzip).
- [x] **31. Plans, sections et sommets des solides natifs** : un plan
      était un carré de quatre points calculés, dont les formules
      (centre, normale, demi-côté) étaient recopiées dans celles des
      intersections. Il devient un objet (`Pl`, `PlP`, `PlL`, `PlO`, `PlE`
      de `DGO.md`), dessiné comme avant, ses coins lui étant propres, le
      plan xOy de GeoGebra un `PlE` caché ; et ce qui le lit aussi :
      intersection droite-plan (`PlI`) et plan-plan (`PlPl`), sections d'une
      sphère (`SphC`, aussi entre deux sphères), d'un cylindre (`CyS`) et
      d'un polyèdre (`PlS`), perpendiculaire à un plan (`Nrm`), polygone
      régulier et cube posés sur un plan. Les sommets calculés des solides
      deviennent des points natifs : cube (`CubV`), sommets du haut d'un
      prisme (translations), apex et sommet à la hauteur h (`Abv`), bords
      du cylindre et du cône (`Rim`, remplacés à l'item 32), sommets d'un
      patron (`NetV`). Un
      polygone projette ses sommets propres avec les points de la figure
      (`ownVertices`), avant les segments dont il cache une partie.
      Corpus inchangé (238 figures sur 438
      sans perte, aucun élément perdu), points enregistrés retrouvés comme
      avant. Moteur +7,5 Ko (+1,5 Ko en gzip).
- [x] **32. Cylindre, cône et sphère de rayon donné natifs** : le
      cylindre et le cône étaient approchés par 60 facettes (polygones) sur
      des points de leurs bords, leurs disques par des polygones réguliers.
      Ils deviennent les objets `Cyl` et `Cone` de `DGO.md`, sous
      l'étiquette et le style de leur face latérale (celle du solide
      désignant le même objet), dessinés par leur silhouette ombrée le long
      de leurs génératrices tournées vers la caméra, deux fois transparente
      comme GeoGebra dessine aussi leur côté caché ; ils cachent les
      segments par la profondeur où le rayon de vue les rencontre (paroi et
      disques), comme leurs facettes. Leurs disques sont des `Disk`, au
      bord en pointillé là où le solide le cache. L'intersection avec une
      droite (`CyI`) et la section par un plan (`CyS`) lisent le solide
      lui-même, ce qui étend la première au cône, et `Sphere(A, r)` n'a
      plus de point caché A + (r, 0, 0) (`Sph1`). Un solide qui bouge fait
      recalculer les parties cachées de tous les segments, comme un
      polygone. Corpus inchangé (238 figures sur 438 sans perte, aucun
      élément perdu), points enregistrés retrouvés comme avant. Moteur
      +3,8 Ko (+1,0 Ko en gzip).
- [x] **33. Section d'un cône par un plan, patrons des prismes et des
      pyramides** : `IntersectPath(plan, cône)` est un `CyS`, dont la
      section suit désormais chaque génératrice, du bord du disque au bord
      de l'autre ou au sommet : une conique limitée au cône, comme dans
      GeoGebra. `Net` ne savait déplier que les cubes : les prismes et
      les pyramides, que GeoGebra déplie par des algorithmes propres
      (`AlgoPolyhedronNetPrism`, `AlgoPolyhedronNetPyramid`), ont leurs
      sommets numérotés comme eux (ceux de la base, puis ceux de chaque
      face latérale, puis le reste du haut, pendu à la première face
      latérale). Figures de test `3d_cone_section` et `3d_patrons`,
      générées par GeoGebra. Corpus : 242 figures sur 438 sans perte (+4 :
      trois patrons, une section de cône), aucun élément perdu, sommets des
      patrons retrouvés aux positions enregistrées. Avec les commandes de
      l'éditeur (plans, sections, patron natif `Net`, `NATIVE_OBJECTS.md`),
      moteur +3,3 Ko (+1,1 Ko en gzip).
- [x] **34. `Sequence` imbriqués et `Sequence` de cercles** :
      `tests/ggb/Yves_06/CerclesDeCercles.ggb` (GeoGebra 3.2) dessine des
      cercles `Circle[Element[Element[LesCtr, j], i], Element[Rayon, j]]`
      par deux `Sequence` imbriqués, `LesCtr` étant lui-même un `Sequence`
      de `Sequence` de points tournés : rien n'était dessiné. Fait : une
      liste de listes (`sub` de `ListFormula`) se lit par `Element` et
      `Length`, et se dessine aplatie quand la taille de ses listes ne
      dépend pas de leur indice ; un `Sequence` de `Circle(centre, rayon)`
      est une nouvelle nature de liste `circle` (centre, rayon), additive
      dans le `.dgo`, chaque cercle étant tracé par quatre arcs de Bézier,
      images affines de ceux d'un cercle (juste aussi en 3D, dans le plan
      xOy). Corpus inchangé (242 figures sur 438 sans perte) : ses
      `Sequence` imbriqués sont triangulaires (`i, j, n` ; `j, 2, n - i`)
      ou d'images de polygones. Restent ceux-ci et `Flatten` d'un
      `Sequence` imbriqué (5 figures). Moteur +1,3 Ko (+0,5 Ko en gzip).

- [x] **35. Outils personnalisés (macros) et `Sequence` de cercles par un
      point** : `tests/ggb/Yves_06/TgtesComm_2Paraboles_parwxM.ggb` construit
      sa seconde parabole par l'outil `Para3ptsetcoef` de son
      `geogebra_macro.xml` : ni elle ni les tangentes communes n'étaient
      justes. `TICE_M2_Maths_limacon_de_Pascal.ggb` trace ses cercles par
      `Sequence(Circle[Element[LesPts, i], P], …)`, cercle de centre passant
      par un point : rien n'était dessiné. Fait : chaque commande d'un outil
      est remplacée, avant la traduction, par la construction de l'outil,
      ses entrées et sorties renommées en celles de la commande, ses autres
      objets en étiquettes neuves (`c1_{1}`) cachées ; `Circle(M, A)` dans
      un `Sequence` se lit comme `Circle(M, Distance(M, A))`. Corpus :
      265 figures sur 470 sans perte (+2, deux figures à macros), éléments
      non importés 2809 → 2786 ; les macros dont une commande interne
      n'est pas prise en charge signalent désormais celle-ci. Moteur
      +1,5 Ko (+0,5 Ko en gzip).
- [x] **36. Cercle d'axe donné, cercle de direction un plan** :
      `Circle(d, P)`, le cercle d'axe d (droite, segment, demi-droite,
      vecteur) passant par P, n'était pas importé, ni `Circle(A, r, p)`
      dont la direction est un plan (seule une droite l'était). Fait :
      entrée `.dgo` `CAx` (commande DGP propre à DocGeo `AxisCircle`), de
      centre le projeté de P sur d ; l'axe de `C1` peut être un plan, sa
      normale, et l'import passe par une normale cachée au plan par le
      centre. Vérifié face à GeoGebra (`tests/ggb/3D/3d_cercles_axe.ggb`,
      centres et rayons relevés dans GeoGebra). Corpus : +1 figure sans
      perte (`roots.py` : 244 → 245 sur 438), éléments non importés
      2786 → 2770 (patrons de cubes qui font tourner leurs faces). Moteur
      +0,85 Ko (+0,27 Ko en gzip). Puis, comme dans GeoGebra, le trait
      des cercles et des arcs de l'espace est en pointillés là où le sol,
      un plan, un polygone transparent ou un solide le cache, et absent
      derrière une face opaque, comme celui des droites : il est
      échantillonné en cordes, découpées chacune par
      `hiddenIntervalsBetween` (`polylineSplit`), les disques des
      cylindres et des cônes gardant leur propre calcul. Moteur +1,1 Ko
      (+0,5 Ko en gzip).
- [x] **37. Translation des polygones, polygones fixés** : dans GeoGebra,
      un polygone dont tous les sommets sont des points libres se glisse
      par translation. Fait : comme un point seul, son premier sommet suit
      la grille aimantée ; les sommets d'un polygone régulier qu'il calcule
      suivent les deux points donnés. Un polygone fixé (`fixed`) ou non
      sélectionnable (`selectionAllowed`) ne bouge pas : style `.dgo` `fx`
      (DGP `fx:true`). Corpus : 799 polygones, 40 fixés (29 à sommets
      libres), 73 non sélectionnables (19 à sommets libres). Moteur +0,8 Ko
      (+0,23 Ko en gzip).
- [x] **38. `Sequence` natifs, listes lues par leur nom** : un `Sequence`
      était compilé en liste de formules en k (`Lst`), ses `Sequence`
      imbriqués mis à plat (`floor`, `%`) et les listes qu'il lit
      recopiées dans ses formules : `liste1` de
      `tests/ggb/Yves_06/CerclesDeCercles.ggb` avait deux formules de
      2 000 caractères, que l'éditeur ne pouvait pas écrire. Fait : entrée
      `.dgo` `Seq` (commande DGP propre à DocGeo `Sequence`), ses boucles
      imbriquées gardant leurs variables, dont les bornes lisent celles
      des boucles qui les entourent (les `Sequence` triangulaires
      `i, j, n` ; `j, 2, n - i` sont désormais importés) ; une liste de
      points se lit par son nom (`LesCtr[j-1][i-1]`), une liste écrite
      `{…}` non dessinée devient une expression cachée
      (`Ctr = [B1, …, B22]`), et `Rotate` dans une formule la fonction
      `rotate(P, O, a)` (avec `dilate(P, O, k)`). L'éditeur écrit et
      relit ces lignes (`EDITOR.md`). Corpus : figures sans perte
      inchangées (245 sur 438), éléments non importés 2770 → 2765, figures
      où `Sequence` en perd 12 → 11. Moteur +3,0 Ko (+1,0 Ko en gzip).

- [x] **39. Suites de cercles 3D orientés** :
      `tests/ggb/3D/Cercles3D.ggb` ne contient qu'une liste,
      `Sequence(Circle[(0, 0, k), 2, Vector[(0, 0, 1)]], k, 0, 5)` :
      le troisième argument du cercle n'était pas traduit et, sans objet
      isolé de type 3D, la figure était lue en 2D. Fait : la troisième
      formule de `Seq` donne sa direction (déjà prise en charge par le
      moteur), les formules de vecteurs lisent les variables de boucle,
      et une vue 3D affichée (`gui`, vue 512) suffit à reconnaître une
      figure 3D. Le seul indicateur `uses3D` ne suffit pas : il reste vrai
      dans certaines figures planes (`mandel2.ggb`). Les six centres
      `(0, 0, k)` et rayons 2 sont vérifiés face à GeoGebra, ainsi que le
      rendu, la rotation et l'aller-retour `.dgo`. **+1 figure de test** ;
      corpus inchangé (245 sur 438 sans perte, 0 plantage, mêmes éléments
      non importés). Build (chunks `engine` et chargeur du lecteur) :
      370 356 → 370 453 octets, **+97 octets**.

- [x] **40. Points sur une sphère, un cylindre ou un cône** :
      `Point(s)` sur une sphère, ou sur un cylindre ou un cône (sur son
      côté, jamais sur ses disques) devient un point sur objet de
      paramètre triplet (voir `DGO.md`), recalé sur la position
      enregistrée par GeoGebra. Glissé, il suit la surface sous le
      pointeur, sur la face où il se trouve (cachée ou non), et se pose sur
      le contour quand le pointeur en sort, sans animation. Aucune figure du
      corpus n'en contient : **+0**. Moteur 370 312 → 372 001 octets
      (+1,7 Ko, +0,5 Ko en gzip), chargeur du lecteur +13 octets.
- [x] **41. Arcs et secteurs d'un cercle ou d'une ellipse** :
      `Arc(c, P, Q)` et `Sector(c, P, Q)` deviennent les objets `QArc` et
      `QSec` de `DGO.md` (commandes DGP propres à DocGeo `ArcOnCircle`,
      `SectorOnCircle`, `ArcOnConic`, `SectorOnConic`), de P à Q dans le
      sens direct, P et Q pris à leur angle sur un cercle (un point qui
      n'est pas sur le cercle, comme dans « What is a Radian? », garde le
      rayon du cercle), ramenés sur l'ellipse sinon. Le corpus n'en avait
      aucune : 18 figures en contenant, trouvées par l'API avec les
      recherches « arc ellipse », « kepler », « loi des aires », « arco de
      elipse », « radian », « inscribed angle arc », « Kreisbogen », « arco
      circunferencia »… et filtrées sur ces commandes, y ont été ajoutées
      (corpus de 456 figures). **+6** (251 sans perte au lieu de 245),
      toutes avec des arcs de cercle ; celles d'ellipses (dont « Deuxième
      loi de Kepler ») ont d'autres manques. Non traduits : la forme à
      paramètres `Arc(c, t1, t2)` (une figure, qui a 19 autres manques),
      les arcs d'hyperbole et de parabole. Moteur 376,0 → 376,9 Ko
      (+0,9 Ko).
- [x] **42. Inversion des objets** : `Mirror(X, cercle)` ne traduisait
      que l'inverse d'un point. Il prend désormais, comme l'éditeur
      (`TRANSFORMATIONS.md`), un polygone (image dont les côtés sont des
      arcs, là où GeoGebra fait une courbe paramétrée), une droite, un
      segment, un cercle, un arc, et en lieu une conique, une courbe de
      fonction ou un lieu : objet `Inv` de `DGO.md`, la commande DGP
      `Inversion` acceptant un objet. GeoGebra enregistre l'image d'une
      droite ou d'un cercle passant par le centre comme une conique
      dégénérée (`A0 = A1 = 0` dans sa `matrix`) : c'est le verdict
      « droit » de l'entrée. Ni demi-droite ni vecteur, que GeoGebra
      n'inverse pas vraiment. Signalé par l'auteur sur une figure
      exportée de GeoGebra (polygone inversé). Corpus inchangé (251 / 456,
      aucun élément gagné : ses `Mirror` par un cercle restants portent
      sur des points déjà perdus). Moteur 382,09 → 382,68 Ko (+0,59 Ko ;
      gzip 121,59 Ko).
- [x] **43. Enveloppe d'une droite** : `Envelope(d, M)` donne le lieu de la
      droite `d` quand `M` parcourt son support (`Loc` de `DGO.md`, la
      commande DGP `Envelope`), calculé par intersection de ses positions
      voisines. GeoGebra enregistre une équation (`implicitpoly`) et trace
      toute la courbe algébrique : ici, seule sa partie balayée. Le chemin
      autre qu'une droite reste ignoré et signalé. Corpus inchangé (aucune
      figure n'utilise `Envelope`) ; vérifié sur `tests/ggb/enveloppe.ggb`,
      dont les points suivent l'équation enregistrée. Moteur +0,7 Ko, import
      +0,2 Ko.
- [x] **44. Tangente à une abscisse** : `Tangent(2, f)` et `Tangent(a + 1, f)`
      étaient ignorés et signalés : `Tangent` n'acceptait qu'un point. Traduit
      en `Tangent(P, f)`, P étant un point auxiliaire masqué de cette abscisse,
      sans objet nouveau, et le triangle de pente suit. Corpus inchangé (272 /
      488 : aucune figure n'emploie cette forme) ; vérifié dans
      `tests/browser/ggb_importer.test.ts`. Import +0,10 Ko (+0,04 Ko en gzip).
- [x] **45. Label des champs de saisie** : un `Textfield` perdait son label.
      Il le montre avant le champ, si « afficher le label » est actif : sa
      légende (`caption`), ou à défaut son nom, comme le rendu de référence de
      GeoGebra, où sa position est celle du label (25 labels visibles sur les
      53 champs du corpus). Une légende LaTeX qui n'enveloppe que du texte
      (`$\text{Réponse}$`, 3 de ces labels) est écrite comme ce texte, de même
      pour une case à cocher (`$\bold{StartAnimation}$`). Les indices restent
      écrits tels quels (`x_0=`) et une autre commande LaTeX reste brute. Corpus
      inchangé (272 / 488 : aucune figure ne change de statut) ; vérifié dans
      `tests/browser/ggb_importer.test.ts`. Import +0,19 Ko (+0,09 Ko en gzip).
- [x] **46. Coordonnées polaires, vitesses d'animation variables, nombres
      figés signalés** : sept manques relevés sur trois figures envoyées par
      l'auteur (« Oval Gearing », un pavage, trois pyramides qui se
      déplient en cube), chacun traité pour toutes les figures. Fait :
      les coordonnées polaires `(r; θ)` et sphériques `(r; θ; φ)` dans
      toute formule ; `OrthogonalVector` de tout vecteur calculé
      (`Vector[A, B] / 2`) ; une vitesse d'animation donnée par un nombre ou
      une expression de la figure (`speed="vanim"`), clé additive `av` de
      `DGO.md`, et l'animation d'un point sur une ellipse selon le paramètre
      de GeoGebra (elle était ignorée) ; l'indice d'un `Sequence`,
      `IterationList` ou `Iteration` qui porte le nom d'un objet de la
      figure (`k`, `n`, segments fréquents) : leurs arguments étaient
      construits avant la commande, `Polygon(Translate(J, k u))` lisant
      alors la longueur du segment `k` ; un polygone là où GeoGebra prend une
      direction (`Cube(A, B, poly)`, `OrthogonalLine`, `Circle(O, r, poly)`,
      `Polygon(A, B, n, poly)`, `Plane(P, poly)`) ; `PathParameter` d'un
      point sur un segment. Enfin, un nombre dont le calcul n'est pas traduit
      gardait en silence sa valeur enregistrée (la figure semblait importée
      sans perte, mais ne réagissait plus) : il la garde, mais il est
      désormais signalé (38 figures, 118 nombres, surtout `SelectedIndex`).
      **+2 figures** gagnées, 13 figures en perdant moins (79 éléments
      retrouvés), mais 4 figures comptées à tort sans perte sont désormais
      signalées : 251 → 249 / 456. Moteur 324,19 → 324,67 Ko (+0,48 Ko ;
      +0,14 Ko en gzip), import 52,94 → 53,96 Ko (+1,02 Ko).
- [x] **47. Solides et images natifs, une construction lisible** : dans
      l'éditeur, une figure importée doit se lire comme sa construction
      GeoGebra, sans objets fantômes. Le cube, le prisme et la pyramide
      étaient construits sommet par sommet (`CubV`, `Abv`, translations), et
      l'image d'un objet par `Translate`, `Rotate`, `Dilate` ou `Mirror`
      était faite des images de ses points (`aux N`), de ses côtés et de ses
      faces. Fait : le solide est un polyèdre natif (`Cube`, `CubP`,
      `Prsm`, `Pyr`, et `PrsH`, `PyrH` de hauteur h, ajoutés à `DGO.md`),
      caché puisque GeoGebra dessine ses faces et ses arêtes comme des
      objets à part, ses sommets étant `Vertex(solide, k)` ; l'image d'une
      droite, d'un segment, d'un cercle, d'un polygone, d'une conique, d'une
      sphère ou d'un polyèdre est une image native (commandes DGP de
      transformation acceptant un objet), les points de l'image n'étant
      construits que si une commande les lit. L'éditeur écrit aussi
      `Prism(poly, h)`, `Pyramid(poly, h)`, `Translation(formule, objet)`
      et les rotations autour de l'origine ou d'un axe ; un objet auxiliaire
      prend un nom comme ceux de l'éditeur (`m = Line(B, C)`, et non
      `aux 4`). Au passage, la scène ordonne les solides par profondeur
      avec les polygones (`paintByDepth`, aussi pour les solides de
      l'éditeur), et les images sont construites dans le plan d'une figure
      plane dès l'import. Mesuré par `tools/editability` sur le corpus :
      objets 33 964 → 24 340, sans ligne 3389 → 127, figures entièrement
      modifiables 364 → 389 / 455 ; import inchangé (249 / 456, 37
      éléments de plus importés), import le plus long 13,8 s → 0,3 s.
      Moteur 324,67 → 324,97 Ko (+0,30 Ko), import +1,2 Ko.
- [x] **48. Angle de deux droites, valeur d'un angle** : `Angle(g, h)`
      n'acceptait que trois points (figure « Circumcenter », envoyée par
      l'auteur). Fait : l'angle de la direction de g à celle de h, à leur
      intersection, comme GeoGebra (`Angle(A, O, B)` de DGP sur deux points
      auxiliaires) ; la direction d'une médiatrice `LineBisector(A, B)` est
      AB tourné d'un quart de tour direct (vérifié par `Direction`), ce qui
      sert aussi aux parallèles et perpendiculaires à une médiatrice. Une
      demi-droite ou une droite de direction inconnue reste signalée. La
      valeur d'un angle affichée par GeoGebra (`labelMode` 1 ou 2) est
      désormais montrée, avec les décimales de la figure. **+1 figure**
      (250 / 456), 2 autres en perdant moins ; moteur inchangé, import
      +0,42 Ko.
- [x] **49. Points écrits dans les commandes, section d'un prisme, vue
      graphique à côté de la vue 3D** : `3d_section_prisme.ggb` n'importait
      rien, ses commandes lisant des points calculés sur place
      (`Polygon(B + (-2, -2), …)`, `Vector[A, A + (0, 0, h)]` dans un
      `Translate` dans un `Rotate`). Fait : une entrée qui n'est pas un objet devient un
      point auxiliaire dès qu'elle vaut un point, couple ou point hors de
      tout appel (`B + (-2, -2)`, mais pas `x(B) + 2`), comme déjà les
      couples et les commandes imbriquées. Dans une figure 3D, `(x, y)` et
      `(r; θ)` valent `(x, y, 0)`, comme dans GeoGebra : la somme d'un point
      et d'un couple y était indéfinie sans être signalée (4 figures du
      corpus y gagnent des objets). La section d'un polyèdre autre qu'une
      pyramide (prisme, cube…) par un plan est `PlaneSection(plan, solide)`,
      ses sommets rangés autour de son centre (la commande DGP accepte un
      polyèdre, que le `.dgo` lisait déjà). Une figure qui montre une vue
      graphique à côté de sa vue 3D (29 des 62 figures 3D du corpus, le
      plus souvent pour ses curseurs) : ses widgets restent placés depuis
      le coin supérieur gauche de la fenêtre, et la vue 3D est centrée dans
      le reste, décalée de la demi-largeur (ou demi-hauteur) de la vue
      graphique ; une figure 3D garde au redimensionnement son origine par
      rapport au centre de la fenêtre, comme à la lecture d'un `.dgo`, au
      lieu d'être recentrée. Reste : la géométrie de la seule vue graphique
      (la manette de `3d_section_prisme`, que la boîte de découpe de la vue
      3D de GeoGebra cache) est dessinée dans le plan z = 0. Le repère 2D
      `f2` des figures 3D de DGPad n'y convient pas : ses points sont dans
      le plan de l'écran, et un objet 3D construit à partir d'eux tournerait
      avec la vue. **+6 figures** (256 / 456), 16 autres en perdant moins,
      éléments non importés 3006 → 2811 ; moteur +0,08 Ko, import +0,75 Ko.
- [x] **50. Curseurs sans étiquette** : un curseur dont GeoGebra cache le
      nom (`label="false"`, 62 curseurs dans 37 figures du corpus) était
      dessiné avec « s = 0 », par-dessus les textes que la figure place à
      côté (`3d_section_prisme`). Fait : style `cN` (curseur sans nom ni
      valeur, ajouté à `DGO.md`), que l'éditeur règle par « Afficher le
      nom » dans les propriétés du curseur. Au passage, la piste d'un
      curseur horizontal est à sa position, comme dans GeoGebra, et non
      20 pixels plus bas (`CURSOR_OFFSET_Y`, où DocGeo met le nom
      au-dessus) : les textes que la figure place sous ses curseurs ne les
      chevauchent plus. Corpus inchangé (rendu seulement) ; moteur
      +0,09 Ko, import +0,13 Ko.
- [x] **51. Couleurs dynamiques, `TableText`, `Insert`, textes LaTeX sur
      plusieurs lignes** : `graphe_complet.ggb` (envoyée par l'auteur)
      perdait son tableau, ses couleurs qui changent avec n, les sauts de
      ligne de son texte, et figeait une liste. Fait : la couleur dynamique
      RGB d'un objet (`dynamicr`…) est une expression cachée lue à chaque
      dessin (style `rgb`, ajouté à `DGO.md`), chaque canal ramené dans
      [0, 1] par une onde triangulaire comme GeoGebra (1,2 → 0,8 ; −0,3 →
      0,3, vérifié), une couleur constante devenant une couleur fixe ; un
      curseur la prend sans perdre son bouton en cours de glissement. Une
      couleur HSV ou HSL reste fixe, une formule illisible est signalée
      (« color »). `Insert(objet, liste, n)` se lit comme une liste ;
      `TableText` est un tableau LaTeX calculé par un script caché, aux
      options `v`, `h`, `l`, `c`, `r`, `|` et `_` (avec leurs chiffres),
      au texte identique à celui de GeoGebra. Un texte LaTeX passe à la
      ligne à chaque saut de ligne hors environnement, ligne vide gardée.
      L'attribut `randomResult`, que GeoGebra écrit aussi pour des listes
      qui n'ont rien d'aléatoire, n'est plus lu que pour une commande
      aléatoire : une telle liste suit la figure, ou est signalée si elle
      n'est pas traduite (elle restait figée sans signalement). Au
      passage, une formule dont une chaîne ouvre ou ferme une parenthèse
      ou une accolade est signalée au lieu de faire échouer l'import.
      Corpus : 277 / 488 inchangé, 6 éléments de moins signalés ; moteur
      325,16 → 325,95 Ko (+0,79 Ko), import +2,2 Ko.

- [x] **52. Scripts des boutons** : `resolution_equation.ggb` (balance
      à cubes et à billes) restait figée : ses boutons étaient écartés sans
      signalement. Fait, après assouplissement de la règle d'`AGENTS.md` :
      le script GgbScript d'un bouton qui n'emploie que des affectations
      (`a = …`, `a := …`), des `SetValue[a, …]` et des
      `UpdateConstruction[]` devient le programme d'un bouton DGP
      (`BlocklyButton`), écrit comme Blockly l'écrit (`a.setExpression(…)`,
      un `If[c, x, a]` en `if (c) {…}`) pour s'ouvrir en mode Blocs
      (vérifié par un aller-retour). `UpdateConstruction[]` n'a rien à
      refaire, l'import gardant les nombres aléatoires. Le bouton garde sa
      place à l'écran, sa légende, sa couleur de fond et sa taille de
      police (bornée par sa hauteur fixe). Tout autre script (commande non
      reconnue, script de clic d'un autre objet, script de mise à jour,
      JavaScript) est désormais signalé (« script ») au lieu d'être ignoré
      sans bruit. Au passage, un point plus un nombre (`y(P + 0.7)`) ajoute
      ce nombre à chaque coordonnée, comme GeoGebra, et un point dont
      l'étiquette est une légende (`labelMode` 3) n'écrit plus son nom.
      Corpus : 29 figures ont au moins un bouton traduit, dont 9 sans aucun
      signalement ; 277 → 261 / 488 sans perte, les 16 figures perdues ne
      l'étant que par leurs scripts, jusque-là ignorés sans signalement
      (« script » devient la première cause : 91 figures, seule cause de
      21). Moteur inchangé, import +1,8 Ko (+0,7 Ko en gzip). Restent à
      traduire : `StartAnimation`, les scripts de mise à jour
      (`onUpdate`, l'« onchange » d'une expression) et ceux de clic d'un
      texte ou d'un point.

- [x] **53. Scripts de clic, légendes, points creux, axes d'échelles
      différentes** : `resolution_equation.ggb` ne s'ouvrait toujours pas
      comme dans GeoGebra. Fait : le script de clic d'un texte ou d'un point
      (affectations, `SetValue`…) devient son programme « quand on appuie »
      (`Evt` `"down"`, qu'un texte accepte désormais, ouvert en mode Blocs
      par l'éditeur, qui l'offre aussi pour un texte). Une légende sans
      valeur (`labelMode` 3, sans `%`) s'écrit à la place du nom (style
      `cp`), pour un point comme pour un autre objet. Un point creux
      (styles 2 et 5) n'est plus rempli, son contour de la moitié de sa
      taille (`ho`, `pb`), comme le dessine GeoGebra (vérifié sur un
      polygone rempli). Le nom d'un point est placé au pixel près comme
      `DrawPoint` : son début 4 pixels à droite, sa ligne de base deux fois
      sa taille au-dessus, plus `labelOffset` (`no` d'un point) ; la taille
      d'un point par défaut est celle de GeoGebra (5). Un bouton garde ses
      couleurs : texte `objColor`, fond `bgColor` (style `fc`, désormais lu
      dans le DGP). Les axes d'échelles différentes (`yscale`, 15 figures
      du corpus) gardent leur rapport : unité propre à Oy (`SetCoords`,
      `uy` de la vue `.dgo`), que la projection, le zoom et les cercles
      (dessinés en ellipses) suivaient déjà. Corpus : 240 / 456 inchangé
      (ces écarts n'étaient pas signalés). Moteur +0,6 Ko, import +0,3 Ko.

- [x] **54. Demi-cercle d'un plan, arcs de centre 3D** : `pliage.ggb` (une
      feuille pliée selon un demi-cercle, `tests/ggb/02_solved`) ne
      s'ouvrait pas : `Semicircle(B, C, p)` n'était pas traduit, ni tout
      ce qui en dépend. Fait : demi-cercle dans le plan p, à gauche de AB
      autour de sa normale (`Semi` à trois entrées, `DemiCercle(p, A, B)`
      dans l'éditeur). Le côté choisi par GeoGebra dépend du repère
      interne de son plan : relevé dans GeoGebra, il suit la normale de
      DocGeo pour `Plane(A, B, C)`, `OrthogonalPlane(A, d)` et le plan
      xOy, la normale opposée pour `Plane(A, d)`, celle de son modèle pour
      `Plane(A, q)`. Un plan donné par une équation reste signalé, le côté
      de GeoGebra n'y suivant pas une règle simple. `CircleArc` et
      `CircleSector` d'un point 3D sont l'arc de l'angle AMB, dans le plan
      des trois points, comme dans GeoGebra (`CArcs`, `CSecs`). Une copie
      de polygone (`q1blanc = q1`) passe par ses sommets ; les points
      d'une liste écrite (`{t1, K, L, M}` tournés) gardent le style de
      point de la liste, pas celui d'un polygone. Un segment [AA] vaut 0
      dans une formule (indéfini comme droite), comme dans GeoGebra et
      DGPad : la condition `k ≟ 0` de la figure ne s'affichait jamais.
      Corpus : 240 / 456 inchangé (aucune figure n'emploie `Semicircle`
      avec un plan), un élément non importé de moins. Moteur +0,2 Ko,
      import +0,5 Ko. Reste : le quadrillage du sol sans plateau ni axes
      (`grid="true"`, 6 figures 3D du corpus et celle-ci), que DocGeo ne
      dessine pas.
- [x] **55. Pas d'un curseur d'angle en degrés** (21 / 10) : un curseur
      d'angle enregistre son pas en degrés (`step="°"`, `"5°"`, `"90*°"`),
      recopié tel quel dans le style `i:`, qui n'accepte qu'un nombre : le
      style entier était rejeté (cause « cmd STL »). Fait : le pas devient
      un nombre de radians, comme la valeur du curseur. **+10 figures**
      (240 → 250), cause « cmd STL » 21 / 10 → 0. Moteur inchangé, import
      +0,1 Ko. Reste un pas `(0.01745329 * rad)`, dans une figure.
- [x] **56. Centre de gravité d'un polygone** (1 / 1) : `Centroid(poly)`,
      absent, écartait tout ce qui en dépendait (`pythagore.ggb`, puzzle
      dont les pièces se placent par les centres de gravité de
      quadrilatères). Fait : le point est une formule sur les sommets du
      polygone, le centre de gravité de sa surface (formule de l'aire),
      pas la moyenne de ses sommets ; plan seulement. **+1 figure**
      (250 → 251). Moteur inchangé, import +0,3 Ko. Pour que ce puzzle
      se manipule comme dans GeoGebra : un objet que GeoGebra ne laisse
      pas sélectionner (`selectionAllowed="false"`) est inerte (`nmi`),
      le pointeur passe aux objets dessous (les poignées des pièces, sous
      le carré `poly1`) ; la copie d'un polygone régulier
      (`ccbcov = poly1`, cache des pièces) garde tous ses sommets, pas les
      deux premiers ; dans un calque, GeoGebra peint les listes sous les
      autres objets (priorité de type 40, polygones 50) : chaque calque
      occupe deux niveaux, le plus bas pour les listes ; une légende
      `%n` écrit le nom ; un côté commun à plusieurs objets est tracé
      par celui peint en dernier, niveau compris (le côté [CB] de
      `poly1` passait sous le cache). Moteur +0,02 Ko, import +0,1 Ko.
- [x] **57. Nombres complexes et scripts de mise à jour** :
      `spirale_fibonacci.ggb` (spirale d'or de raison complexe `q`, animée
      par un curseur dont le script de `A` change `q`). Fait : `ί` fait
      d'une expression un point (`CircleArc`, `Circle`), `abs` d'un
      complexe est son module, et `z^e` d'une base qui peut être complexe
      prend l'argument de GeoGebra, dans ]−π, π] (celui de DGPad est dans
      [0, 2π[ : `q^t` partait en spirale pour un `q` réel à 10⁻¹⁶ près) ;
      `Point(arc, t)` sur un `CircleArc` ; `CurveCartesian` du plan, lieu
      d'un point dont `t` est l'abscisse d'un point sur y = 0 entre ses
      bornes ; `Polygon(A, B, n)` dans un `Sequence` ; `Element` d'un
      `Sequence` de polygones, seul ou dans un `Sequence` ; copie d'un
      `Sequence` ; borne de curseur lisant une liste ; la variable d'un
      `Sequence` nommée comme un objet n'attend plus cet objet. Le script
      de mise à jour (`onUpdate`) d'un nombre devient son « onchange »,
      celui d'un point libre ou sur objet son « ondrag », celui d'un autre
      point le « onchange » d'un nombre caché de ses coordonnées ;
      `SetValue` déplace un point libre ou sur objet (le moteur place
      celui-ci comme un glissement), ne change pas un point dépendant,
      comme GeoGebra ; l'unité imaginaire y est écrite `[0,1]`, pour que
      le programme s'ouvre en blocs. Un événement ne relance plus son
      programme pour des coordonnées inchangées. Jusqu'ici, un script de
      mise à jour seul était lu comme un script de clic vide, ignoré sans
      être signalé : 5 figures le signalent maintenant (`ZoomIn`,
      `SetVisibleInView`, `ParseToNumber`…). **+7 figures** (251 → 258),
      éléments non importés 3246 → 3045. Moteur +0,14 Ko, import +3,1 Ko.
- [x] **58. Polygone régulier d'un curseur, listes dessinées** :
      `septPersonnes.ggb` (graphe complet des poignées de main de n
      personnes). Fait : `Polygon(A, B, n)` d'un nombre `n` variable ;
      GeoGebra enregistre les sorties de son plus grand n (côtés, puis
      sommets), celles qui le dépassent sont indéfinies, et le côté de
      fermeture finit au sommet de rang n, qui reboucle sur A (`Vtx` à
      trois entrées, voir `DGO.md`) ; moins de 3 côtés : indéfini.
      `Translate(l, v)` d'une liste écrite `{…}` nommée, copie `l2 = l1'`
      d'une liste dessinée de segments, dont les objets se dessinent au
      niveau des listes, sous ceux de leur calque. Un polyèdre sans
      définition (ni commande ni expression), que GeoGebra ne dessine
      pas, est ignoré sans être signalé et ne rend plus la figure 3D.
      Aucune figure du corpus gagnée : des deux qui ont un polygone
      régulier variable, l'une le construit sur des `Element` de liste,
      l'autre a d'autres causes. Moteur +0,5 Ko, import +0,5 Ko.
- [x] **59. Traces, légendes de curseurs, fonctions dans un texte** :
      quatre figures envoyées (`somme_geometrique.ggb`,
      `Multiplication_de_fractions.ggb`, `somme_ari_geo.ggb`,
      `Bifurcation_de_Feigenbaum.ggb`). Fait :
      `Sequence(Dilate[poly, k, Ω], …)` (de même `Rotate`, `Translate`),
      la suite des polygones des images de ses sommets, `Dilate` d'un point se lisant dans une
      formule ; `IterationList(f, s, n)` ; un `Element` d'une suite de
      points est un point (`Segment(Element[Px, 1], …)`) ; une fonction
      dans un texte s'écrit comme GeoGebra, ses nombres lus en direct
      (« 0.5 (x - 8) + 8 », « 8 - 0.5 x », « 2x² ») ; les indices d'un
      texte simple (`u_{n+1}`) en caractères Unicode en indice ; un texte
      en gras (`style` 1), en `\boldsymbol` pour un texte LaTeX, et tout
      texte LaTeX en style « display » (`\sum` à bornes dessus et
      dessous, fractions pleines) et, s'il n'est pas `serif`, sans
      empattement (`\sf`, `\textsf`), comme GeoGebra le dessine ; une
      lettre grecque d'une légende LaTeX (`$\Omega$` → Ω). L'étiquette
      d'un curseur horizontal suit son bouton, à son décalage
      (`labelOffset`) près, comme dans `DrawSlider` (−11, −15 pixels ; une
      légende LaTeX 10 pixels plus haut), et sa légende (`labelMode` 3,
      `%v` sa valeur) remplace « nom = valeur ». Un objet absent du
      premier graphique (bit 0 de `ev`, une image du seul graphique 2)
      est caché, une condition d'affichage ne le montrant pas ; une ligne
      de 0 pixel, que GeoGebra ne dessine pas, n'a pas d'étiquette. Un
      nombre libre enregistré indéfini (`NaN`) le reste. La trace d'un
      point est celle de GeoGebra, une copie du point à chaque position
      (style `tp`, voir `DGO.md`) : le diagramme de bifurcation se
      dessine ; les traces commencent quand la figure s'affiche
      (`reveal`), sans garder les mouvements de son ouverture. **+2
      figures** (258 → 260), éléments non importés 3045 → 2974. Moteur
      +0,5 Ko, import +3,8 Ko. Reste, dans `somme_geometrique.ggb`, un
      point gris clair de style « + » (`pointStyle` 3) dessiné en « × »,
      DocGeo n'ayant pas cette forme.
- [x] **60. Bissectrices de deux droites, `StartAnimation`, fonds de
      texte** : `thales.ggb` (théorème de Thalès, sa réciproque et ses
      contre-exemples animés). Fait : `AngularBisector(g, h)` de deux
      droites ou segments, ses deux bissectrices par leur intersection, le
      long de la somme puis de la différence de leurs directions unitaires,
      dans l'ordre de GeoGebra ; `Angle(A, B, C)` dans une formule (de BA à
      BC, dans [0, 2π[) ; copie d'un segment (`acode = a`).
      `StartAnimation(n)` d'un script, pour un curseur « croissant une
      fois » : une boucle Blockly à la fin du programme (le script de
      GeoGebra continue pendant l'animation), qui avance le curseur jusqu'à
      son maximum toutes les 40 ms, à la vitesse de GeoGebra (son intervalle
      en 10 s à 1), et s'ouvre en blocs. Un texte LaTeX ne passe à la ligne,
      au saut de ligne de son source, qu'en mode texte (hors `$`, dans un
      texte qui en a) : en mode math, c'est une espace ; `\\` d'un texte
      gras passe à la ligne hors du `\boldsymbol`, dont les `\text` sont
      en gras (`\textbf`). Le fond d'un texte (`bgColor`, même blanc) est
      dessiné et cache ce qui est dessous (style `bg`, voir `DGO.md`). La
      largeur d'un bouton, qui le place par son bord gauche comme GeoGebra,
      est mesurée dans sa police au lieu d'être devinée (88 pixels de trop
      ici). **+1 figure** (260 → 261), éléments non importés 2974 → 2968.
      Moteur +0,6 Ko, import +1,4 Ko. Reste : les légendes LaTeX des points
      (`$O$`) écrites en texte simple, pas en italique.
- [x] **61. Vecteurs calculés, listes d'images** : `mediatrice.ggb`
      (règle et équerre animées traçant la médiatrice). Fait : les
      commandes dont une formule lit les entrées (`Max`, `Min`, `Length`…)
      les reçoivent telles quelles, commandes imbriquées comprises
      (`Max(Min[r, 1], 0)` : une commande intérieure, construite à part, ne
      se lisait plus) ; `UnitVector`, `UnitOrthogonalVector` et
      `OrthogonalVector` comme commandes, d'un `Segment[A, B]` écrit ; un
      vecteur calculé (commande ou expression `w' = k w`) est tracé depuis
      son point de départ ou l'origine, et une translation lit sa formule :
      nul, il translate encore, comme dans GeoGebra (un vecteur de deux
      points confondus est indéfini dans DocGeo) ; l'`Angle` de deux
      `Line[A, B]` dans une formule (d'une direction à l'autre, dans
      [0, 2π[). Une liste cachée d'objets (`{poly1, pic10}`) ne dessine que
      ses images, l'image d'une image s'en construit de même, et celle
      d'une liste déjà transformée se construit de ses éléments ; une image
      dans une liste est dessinée telle quelle, au-dessus des éléments qui
      la précèdent, comme GeoGebra les peint dans l'ordre. **+4 figures**
      (261 → 265), éléments non importés 2968 → 2890. Moteur inchangé,
      import +1,0 Ko.
- [x] **62. Échantillons aléatoires, `CountIf`, `BinomialDist`** :
      `Intervalle_confiance_estimation.ggb` (intervalles de confiance de N
      échantillons de taille n), malgré la statistique écartée ci-dessous,
      à la demande. Fait : une commande (`Sequence`, `CountIf`,
      `BinomialDist`) qu'une formule ne sait pas lire, faute de boucles,
      est calculée par le script d'une expression cachée : suites
      imbriquées (matrices), `CountIf(condition en x, liste)`,
      `BinomialDist(n, p, k, true|false)`, `Random(a, b)` ; ses listes se
      lisent par leur nom, dessinées par une `Sequence` de leurs éléments si
      GeoGebra les dessine. Une suite tirée au hasard garde les valeurs
      enregistrées et tire les autres (n ou N plus grands) avec un
      générateur à graine fixe, pour que la figure et l'état d'un élève se
      rouvrent à l'identique. `Element(m, i, j)` d'une liste de listes,
      `Sum` comme commande. Une formule lit un nom comme la variable
      locale qu'il désigne avant l'objet du même nom (les côtés `i` et `k`
      du carré masquaient les variables des suites). Une case à cocher sans
      étiquette (`show label="false"`) n'écrit pas sa légende ; un `%` d'un
      texte LaTeX, que KaTeX lit comme un commentaire, est écrit. Aucune
      figure du corpus gagnée (265), éléments non importés 2890 → 2885.
      Moteur inchangé, import +3,0 Ko. Recalcul en 0,15 s quand n change
      (n × N lois binomiales).
- [x] **63. Repère 3D de GeoGebra, scripts de vue** : `repere.ggb` (un
      point P de l'espace, trois cases qui masquent chacune un axe et
      ramènent P dans le plan des deux autres). Fait : les axes 3D de
      GeoGebra (rouge, vert, bleu, gradués, nommés, chacun d'une face à
      l'autre de la boîte de découpe) remplacent le trièdre de DocGeo dans
      toute figure 3D de GeoGebra ; le sol n'est dessiné que si le plateau
      l'est (`plate`, absent de 51 figures 3D du corpus). La boîte suit la
      vue (centre, taille de la fenêtre moins la vue graphique, `size` du
      `clipping`) : `CornerThreeD(-1, n)` en est le coin n, un point de
      formule lisant la vue ; montrée (`show`), ses douze arêtes grises ;
      les plans s'y dessinent par leur section, comme dans GeoGebra (leur
      carré repère toujours leurs points). `DynamicCoordinates(Q, …)` :
      un point de formule dont le glisser, ou un script qui le place,
      place Q (`Fp` `[formule, Q]`). Une légende `%v` d'un point, ou les
      étiquettes « valeur » et « nom = valeur », écrit ses coordonnées.
      Scripts : `SetViewDirection(point)` tourne la vue en une seconde
      comme GeoGebra (`VIEW_DIRECTION`), `SetVisibleInView(axe, -1, b)`
      (noms anglais ou français) montre ou cache un axe (`SHOW_AXIS`), d'un
      objet le cache (`setHidden`), `SetCoords` place un point,
      `SetActiveView` ne fait rien ; `SetValue` d'un nombre dépendant ne
      fait rien, comme dans GeoGebra. GeoGebra exécute le script d'une case
      avant de recalculer ce qui en dépend : ces objets y valent ce qu'ils
      valaient pour la valeur contraire de la case (relevé dans GeoGebra).
      `z(P)` est une fonction des formules (bloc « cote »), pour que ces
      scripts s'ouvrent en blocs, avec ceux de la vue et des axes. Un
      polyèdre, dessiné par ses faces, ne suit plus la condition
      d'affichage qui le montrait en double ; un `polygon3d` sans
      définition est ignoré. Corpus : 265 / 456 inchangé (pas de figure
      gagnée, les autres scripts de vue restant rares), éléments non
      importés 2885 → 2849. Moteur +5,0 Ko (+1,9 Ko en gzip), import
      +2,6 Ko, éditeur +2,5 Ko. Reste : `axesColored` faux (axes noirs),
      les graduations secondaires et le pointillé des plans (`fading`) ;
      la boîte, centrée comme la rotation de DocGeo autour de l'origine,
      bouge un peu quand la vue tourne, là où celle de GeoGebra reste
      fixe.

- [x] **64. Scripts : conditions, `Execute`, styles, animations**. Les
      scripts refusés étaient pour un tiers du JavaScript, pour deux tiers des
      GgbScripts arrêtés par une commande non traduite. Fait (relevé dans
      GeoGebra) : une ligne `#` est un commentaire, un `;` final est permis ;
      `If(condition, commande[, commande])` en tête de ligne devient un `if`
      (24 figures) ; `Execute({"…", "…"})` de textes constants, leurs
      commandes ; `ShowLabel` (`setShowName`), `SetFilling` (`setOpacity`),
      `SetLineThickness` et `SetPointSize` (`setSize`), `SetColor` d'un nom
      (palette de GeoGebra, `"Lime"` = #BFFF00, puis noms HTML, sans casse
      ni espace), de `"#RRGGBB"`, `"#AARRGGBB"` (son alpha : le remplissage)
      ou de trois composantes ; `ZoomIn(1)` ne fait rien.
      `StartAnimation(objets…[, booléen])` d'un curseur ou d'un point sur
      objet : méthode `setAnimated` des programmes (bloc de style
      « animé (0 ou 1) »), qui lance ou arrête son animation, et relance
      toutes les animations comme GeoGebra. Un objet que GeoGebra n'anime
      pas reçoit une animation arrêtée (`an` : 5ᵉ élément 1, voir `DGO.md`),
      et le bouton pause n'apparaît qu'une fois une animation lancée. Le
      curseur « croissant une fois » hors d'un `If` garde sa boucle de
      l'item 60. **+4 figures** (265 → 269), éléments non importés
      2849 → 2793. Moteur +0,3 Ko, import +2,2 Ko. Reste, parmi les
      scripts : le JavaScript (17 figures), des cibles elles-mêmes non
      importées (cascades), `SetCaption`, `SetFixed`, `CenterView`,
      `ShowGrid`, `ParseToNumber`, `RunClickScript`, le clic sur une
      conique, un polygone ou une image, `StartAnimation()` global ; une
      dizaine de figures seulement ne sont plus bloquées que par leurs
      scripts.
