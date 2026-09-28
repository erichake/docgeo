# Couverture de l'import GeoGebra

Feuille de route pour étendre l'import `.ggb`, fondée sur des figures réelles
de geogebra.org. **À mettre à jour à chaque implémentation** : cocher l'item,
noter le gain mesuré et reporter la nouvelle ligne dans l'historique.

## Contrainte absolue : un build léger

Le build fait ~254 Ko, là où DGPad et surtout GeoGebra sont très lourds : c'est
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

| Date       | Figures sans perte | Build    | Changement                                                  |
| ---------- | ------------------ | -------- | ----------------------------------------------------------- |
| 2026-09-28 | 105 / 438 (24 %)   | ~254 Ko  | état initial ; 0 plantage, import médian 4 ms, max 170 ms   |
| 2026-09-28 | 120 / 438 (27 %)   | 254,4 Ko | item 1 : textes LaTeX placés dans le repère (+15)           |
| 2026-09-28 | 138 / 438 (32 %)   | 255,4 Ko | item 2 : images à un coin, à l'écran, coins lus après (+18) |
| 2026-09-28 | 142 / 438 (32 %)   | 255,4 Ko | item 3 : le degré « ° » comme constante (+4)                |

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
- [ ] **4. Conditions d'affichage booléennes** (~40). Négation `¬o`,
      comparaison `o ≟ false`, et booléens définis par une expression (`true`,
      `false`, `Distance(O, Z) < 0.1`) : seul le booléen indépendant (case à
      cocher) est pris en charge. Coût faible.
- [ ] **5. `Corner(n)`** (19). Coins de la fenêtre graphique, souvent pour
      placer des éléments d'interface. Coût faible.
- [ ] **6. `TriangleCenter(A, B, C, n)`** (8 / 7). Au moins les centres
      usuels (n = 1 à 5). Coût très faible.
- [ ] **7. Appel d'une fonction de la figure** (~35) : `(x(A), f(x(A)))`,
      `f(a)` dans un texte ou une expression. Coût faible à moyen.
- [ ] **8. Fonctions mathématiques absentes de `FUNCTIONS`** : `exp`, `ln`,
      `log`, `round`, `ceil`, `sgn`, `min`, `max`, `cot`… que `dgp_formula.ts`
      sait souvent déjà calculer. Coût très faible.
- [ ] **9. Droites et coniques données par une équation** (~40) :
      `y = a x + b`, `x = 1`, `y = x² + 2x − 3`, `y² = 8x`, avec des paramètres.
      Coût moyen.
- [ ] **10. Fonctions texte** (~30) : `Name`, `round`, `FractionText`,
      `Text`, `TableText`, `RotateText`, `Coordinates`. Coût faible à moyen.
- [ ] **11. Analyse** (~30 au total) : `Tangent` (courbe ou cercle), `Slope`,
      `Length`, `Function(f, a, b)`, `Derivative` (numérique), `Integral(f, a, b)`
      (aire hachurée), `LowerSum`/`UpperSum`. Coût moyen.
- [ ] **12. Hasard** (~15) : `Random`, `Shuffle`, `RandomElement`
      (générateurs d'exercices). Coût faible.
- [ ] **13. 3D** (~30) : `Pyramid` et `Prism` construits sur un polygone,
      `Cone`, plans définis par une équation (`plane3d`), `Rotate` autour d'un
      axe, `OrthogonalLine(…, space)`. Coût moyen.
- [ ] **14. Listes** : `Take`, `First`, `Zip`, `Flatten`, `IndexOf`,
      `Append`. Rares ; au cas par cas.

À écarter, sauf changement de priorité : calcul formel, courbes implicites,
statistiques et probabilités, tableur au-delà des cellules simples, matrices.
Ils sont lourds, ou rares dans ce corpus.
