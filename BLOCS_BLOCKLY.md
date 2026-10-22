# Programmes Blockly en mode « Blocs » : figures à rendre conformes

Chantier ouvert le 2026-10-19, à démarrer sur signal de l'auteur. Lire
d'abord `AGENTS.md` (section « Quand une figure « passe » ») et `EDITOR.md`
(section « Blocs et tortue »).

## Objectif

Une figure DGPad ne « passe » que si elle s'ouvre et se manipule
correctement dans le lecteur **et** si chacun de ses programmes **issus de
Blockly** s'affiche dans l'éditeur (`editor.html`) en mode **Blocs**, pas
seulement en mode Texte.

Périmètre :

- Seul le code produit par Blockly compte : les programmes d'une entrée
  `BLK(objet, {...})` du `.dgp`, c'est-à-dire les tortues `onlogo`, les
  boutons `onprogram`, `oninit`, `onchange`, `ondrag`, `onmousedown`,
  `onmouseup` et `oncompute`. Un script écrit à la main dans une expression,
  sans `BLK`, n'a pas à s'ouvrir en blocs.
- Le programme `restrictions` (écarté à l'import) n'est pas concerné.
- **Les figures qui passent par `GetCanvas()` sont mises de côté** : c'est
  interdit dans DocGeo, on ne le prend jamais en charge (au mieux, une
  réécriture en `.dgo`, sur demande). Il s'agit de
  `tests/dgp/Monique/Pythagore_en_liquide.dgp` et
  `tests/dgp/Yves_09_Blockly/NewP4554Temps.dgp`.

## État au 2026-10-19

Au début du chantier : sur les 61 figures de `tests/dgp/` qui contiennent du
Blockly, 26 (hors `GetCanvas()`) avaient au moins un programme qui ne
s'ouvrait pas en blocs. À la fin de la journée, toutes s'ouvrent en blocs
(le test de mesure attend une liste vide). Pour
chaque programme, la table donne **le premier** obstacle rencontré :
d'autres peuvent apparaître une fois celui-ci levé.

| Figure (`tests/dgp/…`)                                        | Programmes refusés : premier obstacle                                                                                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Blockly/decomposition_facteurs_premiers.dgp`                 | `P1.onlogo` : `liste.join("\\times")`, jointure avec séparateur (G)                                                                                        |
| `Blockly/division_posee_new.dgp`                              | `P1.onlogo` : appel de la fonction à résultat `createMatrice` (A)                                                                                          |
| `Blockly/lancer2desMax.dgp`                                   | `P1.onlogo` : fonction à résultat (A) ; `cpt.onchange` : boucle `for (count = 0; count < repeat_end; …)` (H) ; `blk_btn.onprogram` : `lists_repeat(…)` (C) |
| `Blockly/lancer2desNew.dgp`                                   | `P1.onlogo` : fonction à résultat (A) ; `blk_btn.onprogram` : `lists_repeat(…)` (C)                                                                        |
| `Blockly/urne_et_boules.dgp`                                  | `P1.onlogo` : `pixel()` (E) ; `P9.onlogo` : fonction à résultat (A)                                                                                        |
| `Yves_02/05_GeodesiqueDuToreAvecT.dgp`                        | `Courbe3D.oncompute` : appel `f(…)` d'une expression-fonction de la figure (B)                                                                             |
| `Yves_02/06_SolenoideTore.dgp`                                | `Courbe3D.oncompute` : `f(…)` (B)                                                                                                                          |
| `Yves_02/07_SerretFrenet2param.dgp`                           | `Courbe3D.oncompute` : `f(…)` (B)                                                                                                                          |
| `Yves_02/08_SphereOsculatrice.dgp`                            | `Courbe3D.oncompute` : `f(…)` (B)                                                                                                                          |
| `Yves_07_Blockly/Helice3D_ModifCode_Plan.dgp`                 | `C.oncompute` : `pixel()` (E)                                                                                                                              |
| `Yves_08_Blockly/02_SystDyn2_5regions.dgp`                    | `VectM`, `VectN`, `VectP`, `VectQ`, `VectR`, `VectS`, `VectT`, `Champ` (`oncompute`) : `setArrow` (D)                                                      |
| `Yves_08_Blockly/06_Volterra_2Traj_RK4.dgp`                   | `Champ.oncompute` : `setArrow` (D) ; `N_RK4`, `M_RK4` (`oncompute`) : fonction à résultat `fnctRK` (A)                                                     |
| `Yves_08_Blockly/24_VolterraLogistik_Trajectoire2.dgp`        | `Champ.oncompute` : `setArrow` (D) ; `M_RK4.oncompute` : `fnctRK` (A)                                                                                      |
| `Yves_08_Blockly/31_CompetitionLogistik_3D.dgp`               | `Champ.oncompute` : `setArrow` (D) ; `M_RK4.oncompute` : `fnctRK` (A) ; `Traj3D_M.oncompute` : `M_RK4[…].slice(…)` (F)                                     |
| `Yves_08_Blockly/33_CompetitionPtBienRepulsif_3D.dgp`         | idem 31 : (D), (A), (F)                                                                                                                                    |
| `Yves_08_Blockly/34_CompetitionRepulsif_3D_TresAttractif.dgp` | idem 31 : (D), (A), (F)                                                                                                                                    |
| `Yves_09_Blockly/CourbePolya.dgp`                             | `A.onlogo`, `B.onlogo` : fonction à résultat `Projection` (A)                                                                                              |
| `Yves_09_Blockly/DalhiaGene_Sesam.dgp`                        | `O.onlogo` : fonction à résultat (A)                                                                                                                       |
| `Yves_09_Blockly/Dalhia_3tempo_Sesam.dgp`                     | `O.onlogo` : fonction à résultat `PolyRetour` (A)                                                                                                          |
| `Yves_09_Blockly/Dalhia_4tempo_Sesam.dgp`                     | `O.onlogo` : fonction à résultat (A)                                                                                                                       |
| `Yves_09_Blockly/Fig35_SLNH_curseur.dgp`                      | `M_RK4.oncompute` : `fnctRK` (A) ; `Traj3D_M.oncompute` : `slice` (F)                                                                                      |
| `Yves_09_Blockly/Les75Sol_du_Prelude1.dgp`                    | `Plt1.onlogo` : instruction réduite à une valeur, `12;` (I)                                                                                                |
| `Yves_09_Blockly/PavPentaMR2.dgp`                             | `C.onlogo` : `Angle180(…)` (J)                                                                                                                             |
| `Yves_09_Blockly/PavPentaMR3.dgp`                             | `C.onlogo` : `Angle180(…)` (J)                                                                                                                             |
| `Yves_09_Blockly/PavPentaMR4.dgp`                             | `C.onlogo` : `Angle180(…)` (J)                                                                                                                             |
| `Yves_09_Blockly/PavPentaMR5.dgp`                             | `C.onlogo` : `Angle180(…)` (J)                                                                                                                             |

## Obstacles, par ordre de rendement

Le XML Blockly d'origine est dans chaque `BLK` (champ `"xml"`) : il dit
exactement quels blocs l'auteur a posés. Le lire pour choisir le bloc à
ajouter. Les blocs propres à DGPad sont définis dans
`/Users/erichake/Mon Drive/Sites/dgpad/scripts/NotPacked/thirdParty/Blockly/perso/blocks/*.js`
(code généré : `…/perso/js/*.js`, libellés : `scripts/NotPacked/lang/LocalStrings*.js`).

- **(A) Fonctions avec résultat** (`procedures_defreturn` et
  `procedures_callreturn` de Blockly) : 14 figures. Aujourd'hui, seules les
  fonctions sans valeur ont un bloc (`Decompiler.procedure`, qui refuse un
  corps contenant `return` ; `Decompiler.value` refuse l'appel `userCall`).
- **(D) `setArrow`** dans le bloc « mise en forme » (`dg_style`,
  `STYLE_METHODS`) : 6 figures (flèches au bout des segments d'une liste,
  `[longueur, demi-largeur]` en pixels).
- **(J) `Angle180`** (bloc DGPad) : 4 figures, toutes PavPenta.
- **(F) `slice`** (sous-liste, `lists_getSublist` de Blockly, sous la forme
  qu'écrit le Blockly de DGPad) : 4 figures, après (A).
- **(B) Appel d'une expression-fonction de la figure** (`f(t)`, bloc DGPad
  `dgpad_expression_input`) : 4 figures Yves_02.
- **(E) `pixel()`** (bloc DGPad) : 2 figures.
- **(C) `lists_repeat(…)`** : variante du `listsRepeat` que lit déjà le
  décompilateur (nom de la fonction recopiée par une autre version du
  Blockly de DGPad) : 2 figures.
- **(G) Jointure avec séparateur** (`lists_split` en mode « texte depuis
  liste ») : 1 figure.
- **(H) Boucle « répéter n fois »** à nombre calculé, écrite par Blockly
  `for (var count = 0; count < repeat_end; count++)` avec
  `var repeat_end = n` : 1 figure.
- **(I) Bloc valeur laissé seul** dans l'espace de travail (Blockly écrit
  `12;`) : 1 figure. Décider avec l'auteur s'il est montré seul ou ignoré.

## Méthode

1. **Mesure d'abord.** Écrire dans `tests/unit/editor_blocks.test.ts` un
   test qui, pour chaque figure Blockly de `tests/dgp/` sans `GetCanvas()`,
   fait l'aller-retour (`roundTrip`) de chacun de ses programmes `BLK`,
   dans l'unité d'angle de la figure (`degree:` de `SetGeneralStyle`, en
   degrés par défaut), et tient une liste des figures qui échouent encore.
   Ce test échoue aussi si une figure de la liste passe, pour que la liste
   reste exacte. Les programmes sont ceux que l'importeur donne à
   l'éditeur :
    - `onlogo` et `oncompute` : **reconstruits depuis le `sync` du `BLK`**,
      comme `compileBlocklyPrograms` (`src/import/dgp_commands.ts`), et non
      depuis le texte enregistré de l'expression, qui a perdu l'échappement
      des apostrophes (`TURTLE_TEXT('d\'or')`) ;
    - les autres modes : leur `sync` tel quel.
      Lire les `.dgp` avec `parseDgp` (`src/import/dgp_parser.ts`), pas avec
      des expressions régulières.
2. **Un obstacle à la fois**, dans l'ordre de rendement ci-dessus. Pour
   chaque bloc :
    - lecture du programme vers les blocs (`Decompiler` de
      `src/editor/blocks/program_blocks.ts`) et écriture des blocs vers le
      programme (`Generator`, même fichier), dans la grammaire fermée de
      `src/import/dgp_formula.ts` ;
    - définition du bloc et place dans la boîte à outils
      (`src/editor/blocks/workspace.ts`) ;
    - textes dans les 12 langues (`src/editor/blocks/messages.ts`) ;
    - test d'aller-retour : le programme et le texte de ses blocs calculent
      la même chose, et les blocs de ce texte le réécrivent à l'identique.
      Ne pas étendre la grammaire des programmes sans nécessité. Si une figure
      en a besoin, l'extension va avec ses blocs et elle est contrôlée dans le
      lecteur.
3. **Vérifier dans l'éditeur** au moins une figure par obstacle levé :
   `editor.html?url=/tests/dgp/…`, propriétés de l'objet, onglet
   « Blocs ». La figure doit aussi toujours bien s'ouvrir et se manipuler
   dans le lecteur (`index.html?url=…`).
4. **Contraintes** : le texte du programme reste la seule source (le `.dgo`
   ne change pas). Mettre à jour `EDITOR.md` (section « Blocs et tortue »)
   et cocher l'avancement ci-dessous. Lancer `npm run check` avant de rendre
   compte. Messages de commit en anglais, et pas de commit sans demande.

## Consignes impératives de l'auteur

- **Taille du build du lecteur : extrême importance.** Le lecteur n'importe
  jamais `src/editor/`. Sur l'ensemble du chantier, le chunk `engine-*.js`
  du build (`npm run build`) ne doit pas grossir de plus de 10 Ko, et en
  aucun cas de plus de 15 Ko (taille non compressée), par rapport à la
  référence du 2026-10-19 : **362,24 Ko (115,33 Ko gzip)**. Mesurer après
  chaque obstacle levé et donner le chiffre dans le compte rendu. Les blocs
  eux-mêmes vont dans l'éditeur (`editor-*.js`, `workspace-*.js`), pas dans
  le lecteur.
- **Ne pas toucher aux manuels** (`public/tutorials/`) et ne pas lancer
  `npm run manual`, même si l'interface ou les blocs changent : c'est pour
  préserver les tokens de l'auteur, qui donnera le feu vert une fois
  satisfait. Noter seulement, dans l'avancement ci-dessous, ce que les
  manuels devront reprendre.

## Avancement

- [x] Test de mesure sur toutes les figures Blockly (étape 1) :
      « opens every Blockly program of the test figures in blocks », qui
      attend la liste des figures qui ne passent pas (vide en fin de
      chantier). Pour que l'aller-retour compare vraiment, les
      noms des expressions de la figure et des globales y valent un nombre,
      les autres un point propre à chaque nom, et les globales gardent la
      valeur qu'on leur donne (sinon `while (I <= N)` tournait jusqu'à la
      limite d'étapes).
- [x] (A) Fonctions avec résultat — 3 Dalhia, puis avec les suivants les
      RK4, CourbePolya, Fig35. Constat : le Blockly de DGPad rend locales à
      une procédure les variables qu'elle affecte (`perso/js/core.js`,
      `procedures_defreturn`) ; une telle procédure garde cette règle
      (marque `data` de son bloc), sans quoi six figures récursives
      (Cesaro ×3, Hilbert, Gosper, PavHbidir) ouvraient en blocs un
      programme qui dessinait autre chose. Les autres gardent celle de
      Blockly et de DocGeo (variables du programme), dont dépendent les
      `.dgo` écrits avec les blocs (`division_posee.dgo`, `engrenage.dgo`,
      `VTT.dgo`).
- [x] (D) `setArrow` : bloc « flèches de … ».
- [x] (J) `Angle180` : bloc « angle 180°|360° » (les 4 PavPenta, CourbePolya).
- [x] (F) `slice` : c'était le « dernier élément » de Blockly
      (`L.slice(-1)[0]`) : bloc « dernier élément de » (6 figures RK4 et
      SystDyn).
- [x] (B) Appel d'une expression-fonction de la figure : bloc
      « expression » (le `dgpad_expression_input` de DGPad), qui sert aussi
      à `NaN`, `join` avec séparateur, `parseInt`, `split`, `reverse` (les 4
      Yves_02, `division_posee_new`, Fig35).
- [x] (E) `pixel()` : c'est le bloc DGPad `dgpad_window_props`, repris
      avec ses 7 grandeurs de la vue (urne_et_boules, Helice3D).
- [x] (C) `lists_repeat` (lancer2desNew).
- [x] (G) Jointure avec séparateur : c'était un bloc « expression » de
      DGPad (voir (B)). `decomposition_facteurs_premiers` demandait aussi
      « retirer le premier élément » (`L.shift()`) : bloc « retirer le
      premier|dernier élément de ».
- [x] (H) Répéter n fois à nombre calculé (lancer2desMax), pour un n
      entier tel qu'écrit.
- [x] (I) Bloc valeur laissé seul (`Les75Sol_du_Prelude1.dgp`) : décidé
      avec l'auteur, il est montré seul et réécrit (`12;`), comme le bloc
      d'objet laissé seul (`Z;`).

Taille du chunk `engine-*.js` (référence 362,24 Ko) : 362,35 Ko après le
chantier (+0,11 Ko, `blocklySource` partagé par l'importeur et le test).

Remarqué en chemin, hors chantier :

- 5 tests `figure_state.test.ts` (état élève de DalhiaGene_Sesam,
  Dalhia_3tempo_Sesam, Dalhia_4tempo_Sesam, NewP4554Temps, PavPentaMR3 :
  globales `Rsuiv`, `ccar`…) échouaient déjà avant ce chantier (commit
  `588c95a`) ;
- le bloc « constante » de Blockly (π, e, φ, √2, √½, ∞) s'écrivait
  toujours `Math.PI`, et la grammaire ne connaissait que π : `Math.E`,
  `Math.SQRT2`, `Math.SQRT1_2` rendaient le programme illisible et
  `Infinity` y était lu comme un nom d'objet. Corrigé : les cinq constantes
  sont lues, φ (que Blockly écrit `(1 + Math.sqrt(5)) / 2`) est reconnu en
  blocs, et chaque constante s'écrit comme dans DGPad (moteur 362,53 Ko,
  +0,18 Ko). `1 / 0` valait déjà l'infini dans un programme ; seule une
  valeur finale non finie rend l'expression indéfinie. Le `i` de DGPad
  (`[0,1]`) se montre en bloc point (0, 1), de même valeur.

Manuels (au feu vert de l'auteur, 2026-10-19) : la section « Blocs et
tortue » de `expressions.html`, dans les 12 langues, présente les blocs
ajoutés pour `pirates.dgp` et par ce chantier (listes, fonctions avec
résultat et variables des fonctions DGPad, angle, grandeurs de la vue,
« expression », flèches, message, programme d'ouverture). Les captures
n'ont pas changé ; `npm run manual -- check` ne signale rien.
