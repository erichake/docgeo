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

| Date       | Figures sans perte | Build    | Changement                                                         |
| ---------- | ------------------ | -------- | ------------------------------------------------------------------ |
| 2026-09-28 | 105 / 438 (24 %)   | ~254 Ko  | état initial ; 0 plantage, import médian 4 ms, max 170 ms          |
| 2026-09-28 | 120 / 438 (27 %)   | 254,4 Ko | item 1 : textes LaTeX placés dans le repère (+15)                  |
| 2026-09-28 | 138 / 438 (32 %)   | 255,4 Ko | item 2 : images à un coin, à l'écran, coins lus après (+18)        |
| 2026-09-28 | 142 / 438 (32 %)   | 255,4 Ko | item 3 : le degré « ° » comme constante (+4)                       |
| 2026-09-28 | 159 / 438 (36 %)   | 255,6 Ko | item 4 : booléens dépendants, `¬`, longueurs et angles (+17)       |
| 2026-09-28 | 164 / 438 (37 %)   | 256,0 Ko | item 5 : `Corner(n)`, coins et taille de la vue (+5)               |
| 2026-09-28 | 170 / 438 (39 %)   | 256,5 Ko | item 6 : `TriangleCenter` pour n = 1 à 5 (+6)                      |
| 2026-09-28 | 171 / 438 (39 %)   | 256,9 Ko | item 7 : appel des fonctions de la figure (+1)                     |
| 2026-09-28 | 171 / 438 (39 %)   | 257,4 Ko | item 7 bis : comparaisons chaînées (exactitude, +0)                |
| 2026-09-28 | 172 / 438 (39 %)   | 258,1 Ko | item 8 : fonctions mathématiques, `Min`, `Max`, `Mod` (+1)         |
| 2026-09-28 | 181 / 438 (41 %)   | 260,1 Ko | item 9 : droites et coniques données par une équation (+9)         |
| 2026-09-28 | 194 / 438 (44 %)   | 261,1 Ko | item 10 : textes, `FractionText`, étiquettes `a'`, `A_{1}` (+13)   |
| 2026-09-28 | 202 / 438 (46 %)   | 264,8 Ko | item 11 : tangentes, pente, dérivée, intégrales, sommes (+8)       |
| 2026-09-28 | 203 / 438 (46 %)   | 265,4 Ko | item 12 : hasard, valeurs enregistrées ou tirées à l'import (+1)   |
| 2026-09-28 | 211 / 438 (48 %)   | 266,5 Ko | item 13 : solides sur polygone, cône, plans, rotations 3D (+8)     |
| 2026-09-28 | 211 / 438 (48 %)   | 267,0 Ko | item 14 : `Take`, `First`, `Last`, `Sequence(n)`, `l(n)` (+0)      |
| 2026-09-28 | 223 / 438 (51 %)   | 268,0 Ko | item 15 : images d'arcs, polygones, coniques, polyèdres (+12)      |
| 2026-09-28 | 230 / 438 (53 %)   | 269,0 Ko | item 16 : suites de polygones, `Rotate` en formule, listes 3D (+7) |
| 2026-09-28 | 251 / 470 (53 %)   | 269,3 Ko | item 15 bis : images d'images par une transformation (+0)          |
| 2026-09-28 | 251 / 470 (53 %)   | 269,8 Ko | item 15 ter : points sur une perpendiculaire ou parallèle (+0)     |
| 2026-10-03 | —                  | 275,8 Ko | item 17 : pointillés des traits (style, +0)                        |
| 2026-10-03 | —                  | 276,1 Ko | item 18 : opacité des traits (style, +0)                           |
| 2026-10-04 | 232 / 438 (53 %)   | 297,5 Ko | item 19 : `UnitVector` dans une formule (+0)                       |
| 2026-10-04 | 238 / 438 (54 %)   | 298,8 Ko | item 20 : `Mode`, `Roots`, `Point(A, vecteur)` (+6)                |
| 2026-10-05 | —                  | 300,7 Ko | item 21 : calques (style, +0)                                      |
| 2026-10-06 | —                  | 302,2 Ko | item 22 : grille (style, +0)                                       |
| 2026-10-14 | —                  | 301,1 Ko | item 23 : flèches, noms, nombres et unité π des axes (style, +0)   |
| 2026-10-15 | 229 / 438 (52 %)   | 308,7 Ko | item 25 : ellipse, hyperbole et parabole natives (+0)              |
| 2026-10-14 | —                  | 303,8 Ko | item 24 : noms des objets autres que les points (style, +0)        |
| 2026-10-15 | 238 / 438 (54 %)   | 308,8 Ko | item 24 bis : pas de nom pour un segment de longueur nulle (+9)    |
| 2026-10-15 | 238 / 438 (54 %)   | 309,4 Ko | item 26 : droite, cercle et conique d'équation natifs (+0)         |
| 2026-10-15 | 238 / 438 (54 %)   | 313,3 Ko | item 27 : rotation, homothétie et translation natives (+0)         |
| 2026-10-15 | 238 / 438 (54 %)   | 314,9 Ko | item 28 : arc et secteur de centre donné, demi-cercle natifs (+0)  |
| 2026-10-15 | 238 / 438 (54 %)   | 316,4 Ko | item 29 : tangentes natives, aussi aux coniques (+0)               |
| 2026-10-15 | 238 / 438 (54 %)   | 319,3 Ko | item 30 : inversion, centres, polygone régulier natifs (+0)        |
| 2026-10-15 | 238 / 438 (54 %)   | 326,8 Ko | item 31 : plans, sections et sommets des solides natifs (+0)       |
| 2026-10-15 | 238 / 438 (54 %)   | 330,6 Ko | item 32 : cylindre, cône et sphère de rayon donné natifs (+0)      |
| 2026-10-15 | 242 / 438 (55 %)   | 338,8 Ko | item 33 : section d'un cône, patrons des prismes et pyramides (+4) |

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
      calques DGPad compris.
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

À écarter, sauf changement de priorité : calcul formel, courbes implicites,
statistiques et probabilités, tableur au-delà des cellules simples, matrices.
Ils sont lourds, ou rares dans ce corpus.
