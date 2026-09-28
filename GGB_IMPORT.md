# Couverture de l'import GeoGebra

Feuille de route pour étendre l'import `.ggb`, fondée sur des figures réelles
de geogebra.org. **À mettre à jour à chaque implémentation** : cocher l'item,
noter le gain mesuré et reporter la nouvelle ligne dans l'historique.

## Contrainte absolue : un build léger

Le build fait ~267 Ko, là où DGPad et surtout GeoGebra sont très lourds : c'est
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
commande non gérée n'est pas une cause. L'API utilisée est
`api.geogebra.org/v1.0/search/materials?query=…&size=…&from=…`, puis
`/v1.0/materials/<id>?scope=extended` (éléments `type: "G"` → `url` du `.ggb`).

## Historique

| Date       | Figures sans perte | Build    | Changement                                                       |
| ---------- | ------------------ | -------- | ---------------------------------------------------------------- |
| 2026-09-28 | 105 / 438 (24 %)   | ~254 Ko  | état initial ; 0 plantage, import médian 4 ms, max 170 ms        |
| 2026-09-28 | 120 / 438 (27 %)   | 254,4 Ko | item 1 : textes LaTeX placés dans le repère (+15)                |
| 2026-09-28 | 138 / 438 (32 %)   | 255,4 Ko | item 2 : images à un coin, à l'écran, coins lus après (+18)      |
| 2026-09-28 | 142 / 438 (32 %)   | 255,4 Ko | item 3 : le degré « ° » comme constante (+4)                     |
| 2026-09-28 | 159 / 438 (36 %)   | 255,6 Ko | item 4 : booléens dépendants, `¬`, longueurs et angles (+17)     |
| 2026-09-28 | 164 / 438 (37 %)   | 256,0 Ko | item 5 : `Corner(n)`, coins et taille de la vue (+5)             |
| 2026-09-28 | 170 / 438 (39 %)   | 256,5 Ko | item 6 : `TriangleCenter` pour n = 1 à 5 (+6)                    |
| 2026-09-28 | 171 / 438 (39 %)   | 256,9 Ko | item 7 : appel des fonctions de la figure (+1)                   |
| 2026-09-28 | 171 / 438 (39 %)   | 257,4 Ko | item 7 bis : comparaisons chaînées (exactitude, +0)              |
| 2026-09-28 | 172 / 438 (39 %)   | 258,1 Ko | item 8 : fonctions mathématiques, `Min`, `Max`, `Mod` (+1)       |
| 2026-09-28 | 181 / 438 (41 %)   | 260,1 Ko | item 9 : droites et coniques données par une équation (+9)       |
| 2026-09-28 | 194 / 438 (44 %)   | 261,1 Ko | item 10 : textes, `FractionText`, étiquettes `a'`, `A_{1}` (+13) |
| 2026-09-28 | 202 / 438 (46 %)   | 264,8 Ko | item 11 : tangentes, pente, dérivée, intégrales, sommes (+8)     |
| 2026-09-28 | 203 / 438 (46 %)   | 265,4 Ko | item 12 : hasard, valeurs enregistrées ou tirées à l'import (+1) |
| 2026-09-28 | 211 / 438 (48 %)   | 266,5 Ko | item 13 : solides sur polygone, cône, plans, rotations 3D (+8)   |
| 2026-09-28 | 211 / 438 (48 %)   | 267,0 Ko | item 14 : `Take`, `First`, `Last`, `Sequence(n)`, `l(n)` (+0)    |

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

À écarter, sauf changement de priorité : calcul formel, courbes implicites,
statistiques et probabilités, tableur au-delà des cellules simples, matrices.
Ils sont lourds, ou rares dans ce corpus.
