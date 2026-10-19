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

Sur les 61 figures de `tests/dgp/` qui contiennent du Blockly, 26 (hors
`GetCanvas()`) ont au moins un programme qui ne s'ouvre pas en blocs. Pour
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
`/Volumes/SSD 2To/Google Drive/Sites/dgpad/scripts/NotPacked/thirdParty/Blockly/perso/blocks/*.js`
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

- [ ] Test de mesure sur toutes les figures Blockly (étape 1)
- [ ] (A) Fonctions avec résultat
- [ ] (D) `setArrow`
- [ ] (J) `Angle180`
- [ ] (F) `slice`
- [ ] (B) Appel d'une expression-fonction de la figure
- [ ] (E) `pixel()`
- [ ] (C) `lists_repeat`
- [ ] (G) Jointure avec séparateur
- [ ] (H) Répéter n fois à nombre calculé
- [ ] (I) Bloc valeur laissé seul (à décider avec l'auteur)

À reprendre dans les manuels, au feu vert de l'auteur :

- Blocs ajoutés le 2026-10-19 pour `pirates.dgp` : « afficher le message »
  (Texte), « ajouter … à la fin de … » (Listes), bloc de départ « quand la
  figure s'ouvre » (Événements).
