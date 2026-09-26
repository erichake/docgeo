# Mémo `List` — syntaxe et sémantique

Notes sur la commande `.dgp` `List`, propre à DocGeo (n'existe pas dans
DGPad — voir la discussion qui a mené à son ajout, commits `aa0fe03` et
suivants). Remplace les scripts Blockly dynamiques de DGPad (exécution
arbitraire, exclue pour des raisons de sécurité) par le moteur de formules
existant, déjà sandboxé ([dgp_formula.ts](src/import/dgp_formula.ts)).

## Syntaxe

```
List(name, nature, countFormula, formula1 [, formula2]);
```

- `nature` : `"point" | "segment" | "line" | "label"`.
- `countFormula` : une formule DGP (même grammaire que le 2e argument de
  `Point`/`Circle1`), évaluée une fois → `count`.
- `formula1`/`formula2` : évaluées une fois par indice `k = 0..count-1`.
    - `"point"` : 1 formule → position.
    - `"segment"`/`"line"` : 2 formules → les deux extrémités (segment :
      tracé entre elles ; line : tracé à travers, prolongé hors champ).
    - `"label"` : 2 formules → position, puis une valeur numérique à afficher.

Implémentation : [list_object.ts](src/objects/list_object.ts), commande
enregistrée dans [dgp_commands.ts](src/import/dgp_commands.ts).

## Identifiants réservés : `k` et `count`

- `i` est **déjà** pris par le lexer de formule pour l'unité imaginaire (un
  `i` seul se lit toujours comme nombre complexe) — c'est pour ça que
  l'indice de boucle s'appelle `k`, pas `i`.
- `k` (indice courant) et `count` (taille évaluée de la liste) sont
  disponibles dans `formula1`/`formula2`, **pas** dans `countFormula`
  (auto-référence impossible). Ils masquent tout objet réel du même nom —
  ne pas nommer un point ou un curseur `k` ou `count` dans une figure qui
  utilise `List`.

## `x(...)` n'est PAS nécessaire pour `n`/`k`/`count`

Toute référence (point, curseur, `k`, `count`) se résout en interne comme un
vecteur `[valeur, 0]`, jamais un nombre brut — mais `List` détecte
automatiquement qu'un vecteur à partie imaginaire nulle **est** un nombre
réel, et l'utilise comme tel pour `count` et pour la valeur d'un `"label"`.
Donc `"6*n"` fonctionne directement, pas besoin d'écrire `"6*x(n)"`.

## `perp(v)`

Fonction de formule ajoutée pour `List` : vecteur unitaire perpendiculaire à
`v` (rotation 90°, puis normalisé), `null` si `v` est nul. Sert à décaler un
repère d'un côté du segment porteur, ex. graduations :

```
A+(B-A)*k/(count-1)-perp(B-A)*0.12
```

## `count` : points inclusifs vs intervalles — piège classique

`k` va de `0` à `count-1`. Deux usages différents du même mot :

- **Points inclusifs des deux bouts** (ex. graduations primaires 0..6, une
  liste de labels) : `count` points ne définissent que `count-1`
  intervalles → diviser par `count-1`, pas `count` :
    ```
    A+(B-A)*k/(count-1)     // count points, de A (k=0) à B (k=count-1) inclus
    ```
    Diviser par `count` à la place fait tomber le dernier point **avant** B
    (`(count-1)/count` de la distance) — c'est le bug qu'on a eu sur `Lp`/`Ll`
    puis sur `Lpt` (voir commits `1d9a108`, `a9d7be1`).
- **`count` = nombre d'intervalles voulu directement** (ex. `count = 6*n`
  subdivisions) : diviser par `count` tel quel est déjà correct :
    ```
    A+(B-A)*k/count         // count intervalles ; le tout dernier point (=B)
                             // n'est jamais généré (k s'arrête à count-1)
    ```
    Acceptable pour des graduations secondaires (B a déjà son propre point),
    pas pour une liste servant de support `PointOn`/aimant si on veut pouvoir
    atteindre le dernier point exactement — dans ce cas, compter les points
    (`count+1`, cf. `Lpt` dans `partage.dgp`) et diviser par `count-1`.

## `PointOn` sur une `List`

Une `List` de nature `"point"` est un support `PointOn` valide (comme
`Locus`, cohérent avec le code de référence DGPad — `list` y est groupé
avec `locus`). Contrairement à `Locus` (interpolation continue), l'alpha
d'un point sur une `List` **s'accroche** à l'item le plus proche — pas
d'interpolation entre deux points, puisque chaque item est une position
individuellement significative. `alpha` vit dans l'espace des indices
(`0..count-1`), pas normalisé 0..1.

## Aimantation (`mg` style) sur une `List`

Une `List` de nature `"point"` peut aussi être une cible du style `mg`
d'un point libre, au même titre qu'une droite ou un cercle :

```
STL(P,"...;mg:[Lpt,5000]");
```

Accroche au point de la liste le plus proche (même logique de plus-proche-
voisin que `PointOn`, pas de projection continue).

## Bornes

- `"point"`/`"segment"`/`"line"` : jusqu'à 5000 items (repliés dans un seul
  `<path>`, comme `locus_object`).
- `"label"` : jusqu'à 500 (vrais nœuds `<text>`, un pool fixe alloué à la
  création).

## Exemple complet

Voir [tests/partage.dgp](tests/partage.dgp) : graduations
primaires/secondaires d'un segment, labels numériques, point `PointOn` une
liste de points, et aimantation sur cette même liste.
