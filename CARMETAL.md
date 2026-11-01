# Import CaRMetal : suivi du chantier

Corpus : `tests/zirz/` (104 fichiers .zir/.zirz/.zirs, beaucoup de classeurs).
Code : `src/import/zir_translate.ts` (traduction en commandes DGP),
`src/zir_importer.ts` (exécution, classeurs). Test de non-régression :
`tests/browser/workbook.test.ts` (« imports CaRMetal figures of the corpus »).

## Outils

- Mesure du corpus : `npx vitest run --config tools/zir_corpus/vitest.corpus.config.ts`
  → `tools/zir_corpus/results.jsonl` (ignoré par git), puis
  `python3 tools/zir_corpus/roots.py [genre]` (fichiers propres, erreurs,
  éléments ignorés par genre, ou fichiers d'un genre). Le champ `fails`
  (1er nom inconnu des formules refusées) n'est rempli que si l'on remplace
  temporairement, dans `formula()`, `if (error instanceof Unsupported)
  return null;` par un `(globalThis as any).ZIRF?.push(error.message)`.
- Voir une figure : `tools/carmetal/render.sh` (vrai CaRMetal) et
  `tools/carmetal/docgeo.mjs` (lecteur, serveur `npx vite --port 5199`),
  `--page n` pour une page de classeur, puis des glissés `x1,y1:x2,y2`
  (avis d'import fermé avant la capture).
- Voir un script de menu : `render.sh … --script "Nom"` lance le script
  dans CaRMetal et attend sa fin ; `docgeo.mjs … --click "Nom" [--wait
  ms]` clique le bouton du lecteur (après les glissés).
- Scripts de menu : `npx vitest run --config
  tools/zir_corpus/vitest.corpus.config.ts tools/zir_corpus/scripts.test.ts`
  → `tools/zir_corpus/scripts.txt` (versionné : chaque script, `translated`
  ou son premier obstacle : `script: …` dans le JavaScript, `grammar: …`,
  `blocks` si l'éditeur ne peut pas le montrer en blocs) et
  `unblocked.txt` (ignoré : les programmes refusés par les blocs).

## État (2026-11-01, fin de session 2)

78/104 fichiers sans élément signalé (35 au départ), plus aucune erreur.
`parseZir` (2026-11-01) a révélé ~65 pages de 9 classeurs qui
s'ouvraient vides (balise non fermée `<Preferences<Windowdim …/>`).

Pages révélées comparées à CaRMetal (session 2) : 46 —
Complements_StatEspace 8/8 (avec glissé, p.3), Moulton_Long 12/12 (le
même fichier dans Yves et Yves_Capes_Agreg), PorismeSteiner 7/7,
Beltrami_long 16/16 (p.3 : CaRMetal plante, `ClassCastException`, pas de
référence), CIRM3 p.10, lievretortue 1-2 (dé et textes « gagne »
dépendants de ses 15 éléments signalés, compteurs à mémoire). Reste à
comparer : CubiquesBusser p.7-13 (courbes `EqXY` écartées).

Beltrami_long : 2 éléments signalés (p.3 `Track Tr6`, trace de P quand
le curseur tP varie : le moteur n'a pas de lieu piloté par un curseur ;
p.14 `E358`, curseur aux bornes `min(@rA,@rB)`, famille connue) : pas
encore remis dans le test de corpus de `workbook.test.ts`. Écarts vus :
p.1, la branche droite de la tractrice (lieu de B quand A parcourt une
droite) s'arrête plus tôt que dans CaRMetal (domaine du lieu) ; p.9, les
mesures diffèrent de quelques % (longitudes de A et B) ; p.15, réseau de
bissectrices du disque incomplet.

Fait et vérifié (rendu comparé à CaRMetal, glissés) :
- objets des `<Macro>` exclus de la figure (doublons) ;
- point sur conique (paramètre DGP en couple) ; point sur liste de points ;
- points « punaisés » (`d(windoww)`) reconnus aussi par leur `y` ;
- textes et expressions placés par formule (`windowcx-windoww+3/pixel`,
  `x(O)+…`), expressions LaTeX ainsi placées ;
- noms de repli `_n_` (et non `$n`) : un panneau `%…%` peut les citer ;
- objet de nom vide `""`, cité par `to=""` ou un argument vide (`x()`,
  `a(P,,Q)`) : figures hyperboliques d'Yves ;
- polygone de moins de 3 sommets ignoré (CaRMetal ne le dessine pas) ;
- formules : `invalid`, `sinhyp`… `Argtanh`, `random(r)`, `ratan2`,
  `inside(P, cercle)`, fonctions de plusieurs variables (`var="x y"`) ;
  `atan2` de CaRMetal est en degrés (celui de DGP en radians) ;
- mémoires `d(x)` → 0, `sum(…)` → 0, `old(x)` → x : leurs valeurs à
  l'ouverture et au repos (compteurs de tours : justes à l'ouverture, non
  mis à jour au glissé) ;
- objets triés par dépendances (références avant `@A`), hors `magnetobjs`,
  styles conditionnels, noms suivis de `(` (sauf fonctions), nombres ;
- arc dont les extrémités sont ses intersections avec un autre objet :
  cercle complet caché, arc ajouté en fin ;
- arcs `start/end` : toujours le petit arc (sans `acute`, CaRMetal prend
  son option `options.obtuse`, fausse par défaut), par `Arc3pts` passant
  par le milieu de l'arc ; un demi-cercle exact reste dans le sens direct ;
- vecteur lu comme sa longueur dans une formule ;
- marquage des lignes de texte `*`, `**`, `***` : retiré, lignes « grandes »
  ×1,3 en textes séparés (le gras n'existe pas dans les textes DocGeo) ;
- couleur par formules (`scolor="R,,V,,B"`) : couleur fixe de repli ;
- classeur : pages importées à la hauteur affichée (au-dessus des onglets),
  `windowcy` des formules (rotations 3D d'Yves) n'étant plus décalé ;
- LaTeX : `\mbox` → `\text` (KaTeX n'a pas `\mbox`), accolades non
  fermées refermées (CaRMetal les tolère) ;
- scripts : jamais exécutés, traduits (voir plus bas) ou signalés ;
- intersection d'un lieu avec une droite ou un cercle (moteur :
  croisements de sa ligne polygonale, suivis par `groupAssign`) ; toute
  intersection calée sur sa position enregistrée (CaRMetal la calcule par
  projections depuis là où elle était) : `settleTargets` la « sème »
  (`intersection_object.seed`), même indéfinie à sa création ; point sur
  lieu calé lui aussi (`locus_object.alphaOf`) ; rang de branche `.dgo`
  d'une intersection : tout entier ≥ 0 (un lieu en a plus de 4) ;
- angle sans `acute` : orienté de 0 à 360° dans CaRMetal, lu
  `Angle360(A,O,B)` dans les formules (l'angle dessiné reste ≤ 180°) ;
- `x(u)`, `y(u)` d'un vecteur : ses composantes (pas sa longueur) ;
- cercle `filled` : rempli comme un polygone ;
- contrôles (`CTRL…`, en pixels de la fenêtre `Windowdim` enregistrée)
  ramenés au même endroit de la figure dans la fenêtre actuelle.

Fait et vérifié en session 2 (pages révélées) :
- intersection de deux cercles : le `first` de CaRMetal est le second
  côté de DGP (ordre inversé) ; la règle d'import qui « retournait » une
  intersection indéfinie est supprimée (elle compensait cette inversion
  et faisait apparaître des points hors de leur demi-droite, que
  CaRMetal ne montre pas) ;
- `windowh` est la hauteur **entière** de la fenêtre (`windoww` la
  demi-largeur) ;
- courbes paramétrées (`Function` dont `x` n'est pas la variable : 292
  dans le corpus, aucune n'était tracée) : lieu du point (x(t), y(t))
  quand t, point d'un segment caché, va de min à max, échantillonné aux
  pas `d` de CaRMetal (`p:` du lieu) ; une courbe cartésienne de moins de
  100 pas est la ligne brisée de ses valeurs (droites de Moulton à
  `(t==1)`) ;
- moteur : intersections courbe×courbe, courbe×lieu et lieu×lieu
  (droites de Moulton) ;
- LaTeX au milieu d'un texte : chaque ligne qui en contient est une
  expression LaTeX, le texte en `\textsf{…}` (`≠`… en mode math), les
  valeurs `%…%` incluses ; `^-^1`, `_k_-_1` lus `^{-1}`, `_{k-1}`
  (tolérés par CaRMetal) ; `$` final manquant ajouté ;
- étiquette « gardée proche » (`keepclose`) placée comme
  `drawPointLabel` de CaRMetal (dégagée selon sa largeur) ;
- une expression s'affiche avec `digits.edit` (et non `digits.lengths`) ;
- point `dot` rempli de sa couleur ;
- styles conditionnels : une condition « caché » l'emporte sur les
  variantes de style, et l'original est caché quand une variante est
  dessinée (cercle épais sous sa variante normale, PorismeSteiner p.5) ;
- variante de style d'un point punaisé (`Odl#0`) ; noms accentués dans
  les formules (`uGravité`).

## Scripts

JavaScript de CaRMetal (Rhino), dans `<Script Name onload mousedrag>`
sous `<CaR>`. Scripts « de menu » (lancés à la main) : boutons s'ils se
traduisent, sinon ignorés sans bruit pour l'instant (section suivante). Les scripts `mousedrag` sont
réécrits jeton par jeton en programme DGPad (`scriptProgram`,
`zir_translate.ts`), que la grammaire fermée de `dgp_formula.ts` valide
et que le moteur exécute ; le JavaScript n'est jamais exécuté :
- propriétaire : point (`Point`, `PointOn`) → `BLK(P,{"ondrag":…})` ;
  expression d'un `CTRLbutton` → son `onchange` (le bouton du panneau
  bascule l'expression entre 0 et 1) ; plusieurs scripts d'un même
  propriétaire concaténés ;
- variables du script → locales `$v…` ; `X("A")` → `x(A)`,
  `GetExpressionValue("E")` → `E`, `SetExpressionValue("E",v)` →
  `SET_EXP("E",v)` (v nombre, ou chaîne numérique ou `"_x"`),
  `Move("A",x,y)` → `SET_EXP("A",[x,y])`, `Math.` (random, sqrt, abs,
  floor, ceil, round, min, max, exp, log, pow, PI, E) ;
- chaînes : `_x` remplacé par la valeur de la variable x (comme
  `parseVariables` de CaRMetal) ;
- fins de ligne : `;` inséré comme l'ASI de JavaScript (la grammaire DGP
  l'exige entre deux instructions) ;
- `GetText`/`SetText` : un texte sans `%…%` ni `$` lu ou changé par un
  script a son contenu dans une expression cachée (texte littéral, valeur
  constante que `SET_EXP` change : `parseLiteralList` de
  `dgp_expression.ts` accepte désormais un texte seul) et s'affiche
  `%contenu%`.

Passent (vérifié : boutons, glissés, tests de `workbook.test.ts`) :
Tchin_tchin, MultiActionCarre (Eric et IREM_Avril12), stern1 p.1, Heron.

Restent signalés (7 fichiers), hors d'atteinte d'une traduction sûre :
- API Java : `getC().find("f").setExpressions(…)` (Pick, analyse) ;
- noms calculés : `SetThickness("sa"+p+"b"+q)`, `Move("B"+i,…)` (stern1
  Tree/Ford, gaussiennes `onload`) ;
- `SetText` d'un texte à formules `%…%` et LaTeX (stern1 contfrac,
  FractionContinue glouton) : le texte devrait être réanalysé à chaque
  changement ;
- animations `Pause` (Galton, Gouttes de Pi).
Non faits faute de figure qui en profite : propriétaires multiples
(`mousedrag="A;B;C"`), fonctions déclarées dans un script, `onload`.

## Scripts de menu → boutons Blockly (chantier ouvert le 2026-11-01)

But : chaque script du menu Scripts de CaRMetal devient un bouton de la
figure importée, dont le programme est la traduction du script et
s'ouvre dans l'éditeur en mode **Blocs** (règle « Quand une figure
passe » d'AGENTS.md : blocs dans `src/editor/blocks/`, aller-retour dans
`tests/unit/editor_blocks.test.ts`). Le JavaScript n'est toujours jamais
exécuté : traduction en programme validé par la grammaire fermée de
`dgp_formula.ts`, comme les scripts `mousedrag`.

Modèle : `/Users/erichake/Desktop/Script_DocGeo.dgo` (fourni par
l'auteur, hors du dépôt) : un bouton `Btn` « Lancer » dont le programme
déplace deux points (`"s": [code, références]`). Partir de l'existant :
format `Btn` (DGO.md), droits des programmes de bouton (AGENTS.md), blocs
de bouton de l'éditeur, `scriptProgram` de `zir_translate.ts`.

Décisions de l'auteur (2026-11-01) :
1. Un bouton peut **dessiner** des points, segments et polygones, sans
   créer d'objet : son dessin est une liste (comme la tortue Blockly,
   qui dessine par une expression liste), refaite à chaque lancement.
   C'est une extension des droits des boutons : mettre à jour la phrase
   correspondante d'AGENTS.md (et DGO.md / EDITOR.md si le format ou
   l'éditeur changent), accord donné.
2. Nouveaux blocs acceptés : « attendre n ms » (`Pause`, programme qui
   s'interrompt et reprend, figure redessinée entre deux pas) et
   « demander une valeur » (`Input`). Bloc de message déjà là (`ALERT`)
   pour `Prompt`/`Alert`.
3. Les boutons des scripts de menu sont rangés en colonne dans un coin
   de la figure (un par script, libellé = `Name` du script).

Inventaire : `python3 tools/zir_corpus/menu_scripts.py [texte]` (fonctions
appelées, scripts qui construisent ou non, code des scripts dont le nom
ou le fichier contient le texte). **100 scripts de menu dans 31
fichiers** (le décompte de 67 écartait à tort les scripts portant
`mousedrag=""` ou `onload="false"`). Ancien inventaire (67, 13 fichiers) :
- 6 qui manipulent seulement (Robot ×4 dans Complements_StatEspace et
  CIRM5_StatEspace, robot_circ « jeu » et « repetita ») :
  `GetExpressionValue`, `X`/`Y`, `Move`, `SetColor`, `SetThickness`,
  `Pause`, `Prompt`, fonction déclarée (`function NombreDeCoups(k)`),
  `Println` ;
- 61 qui construisent (`Point` 56, `Segment` 34, `Polygon`, `Symmetry`,
  `MidPoint`, `SetHide`, `SetPointType`…) : par le dessin (décision 1),
  les transformations n'étant que des calculs de coordonnées. Les objets
  qu'ils ont créés avant l'enregistrement sont déjà dans la figure : ne
  pas les dupliquer. Restent signalés ceux qui construisent de vrais
  objets réutilisés ensuite (`ExecuteMacro`, `Intersection`, magnétisme,
  `TracePt3D`…).

Fait (2026-11-01, étape 1) :
- `WAIT(ms)` (DGO.md note 13, AGENTS.md) : un programme de bouton qui
  attend est exécuté pas à pas (`programSteps`, `dgp_formula.ts`) : des
  générateurs parcourent ses instructions et s'arrêtent à chaque `WAIT`
  instruction, y compris dans une fonction appelée comme instruction
  (`f(x);`, `v = f(x);`) ; ses expressions restent les fermetures
  compilées. Un `WAIT` dans une expression n'attend pas. `runProgram`
  (`expression_object.ts`) enchaîne les pas par `setTimeout`, la figure se
  redessine entre deux ; un nouveau clic arrête le lancement en cours.
  Bloc « attendre … ms » (`dg_wait`, catégorie Boucles, 12 langues).
  Moteur +1,52 Ko (+0,46 Ko gzip), lecteur `main` inchangé.
- Traduction (`scriptProgram`) : `Pause` → `WAIT`, `Prompt`/`Alert` →
  `ALERT`, `SetColor(o,"blue")` → `setRGBColor` (palette de CaRMetal),
  `SetThickness` "thick"/"normal" d'un point → `setSize`/`setOpacity`
  (style de `translateObject`), listes `"A,B"`. Un objet peut être nommé
  par une variable toujours mise au même nom (`m="M"; Move(m,…)`,
  `p=m`). Les variables gardent leur nom, sauf s'il est celui d'un objet
  (`$v…`), pour rester lisibles en mode Blocs.
- Bouton `blk_btn<k>` par script de menu traduit, libellé `Name`, en
  colonne en haut à droite (bord droit à 12 px, pas de 50 px).
- Vérifié : Robot (1) de Complements_StatEspace et CIRM5_StatEspace
  (test `workbook.test.ts` « turns CaRMetal's menu scripts into
  buttons », capture du lecteur : le robot avance case par case, revient
  à l'origine, « Gagné en N coups ! ») ; aller-retour en blocs dans
  `editor_blocks.test.ts` (« waits, as CaRMetal's robot »).
- Limites : `ALERT` n'interrompt pas le programme jusqu'au OK (le
  `Prompt` de CaRMetal si) ; un `WAIT` ne s'exécute que dans un bouton
  (pas dans « ondrag »/« onchange »).

Fait (2026-11-01, étape 2 : dessin) :
- le bouton d'un script qui dessine a une expression cachée
  `blk_draw<k>` (liste DGPad, `[]` à l'ouverture) et sa liste
  `blk_draw<k>_list` (`List`, `sg:1;o:0`) : ni le format ni le moteur ne
  changent. Le programme commence par `DRAWING` (`zir_translate.ts`) :
  `$o`, les objets dessinés `[x, y, genre, caché, r, g, b, taille,
  sommets]`, `$point(a, b)` et `$line(k, p)` qui les ajoutent et rendent
  leur numéro, `$show()` qui refait la liste (avant chaque `WAIT` et à la
  fin). `Point`, `Segment`, `Polygon` (`"A,B,C"` ou `a+","+b`),
  `MidPoint`, `Symmetry` deviennent ces appels (coordonnées calculées au
  lancement) ; `SetHide`, `SetColor`, `SetRGBColor`, `SetThickness`,
  `SetFilled`, `SetPointType` ("point") d'un objet dessiné changent son
  enregistrement. Un objet nommé que la figure a déjà (laissé par le
  script avant l'enregistrement) n'est pas redessiné ; un segment ou
  polygone dont tous les sommets sont de la figure non plus.
- chaînes-formules de `Point` : `"x_a"` → abscisse du point que nomme a
  (objet de la figure ou dessiné), `"_c"` → valeur de c, puis formule
  CaRMetal (fonctions de la figure comprises : `Laf(x)`). Une formule
  bâtie par concaténation (`"x("+p+")…"`, variable recevant du texte)
  est un obstacle (`formula text`), comme des noms joints dans une
  variable (`s=s+","+e`, `names joined`).
- `Math.sin/cos/tan` du JavaScript (radians) convertis pour la figure en
  degrés, `Math.asin…` aussi ; `SetRGBColor`, `SetHide`, `SetShowName`
  d'un objet de la figure.
- moteur : les programmes de bouton appellent les fonctions de la figure
  (`callFunction` dans `runProgram`) ; blocs : voir EDITOR.md « Boucles
  des scripts ».
- Vérifié (bouton cliqué / script lancé dans CaRMetal) : Rejour (×2,
  dessin progressif à chaque `Pause`), Tournesol, Toile Générique, exo,
  en plus de Robot (1) ×2 et milieuXY. Aller-retour en blocs :
  `editor_blocks.test.ts` « draws, as CaRMetal's menu scripts ».
- Limites : points toujours ronds (la liste DGPad n'a pas de croix) ;
  noms des objets dessinés non affichés ; dessin statique (CaRMetal
  crée des objets dynamiques, qui suivent les glissés).

Comptage (`scripts.txt`, 2026-11-01) : **8/100 traduits**. Premiers
obstacles : `Array(` 13 (tableaux et noms calculés `"C"+(j+1)`),
`TracePt3D(` 7, `Input(` 6, `ExecuteMacro(` 6, `.replace` 6 (L-systèmes),
`TracePoint(` 5, `"thick"` 5 (`SetThickness` d'un objet non point),
`function(` 4, `formula text` 4, `switch(` 3, `includes(` 3,
`SetPointType(` 3, `Conditional(` 3, puis 1-2 chacun.

Plan :
1. ~~Robot~~ (fait, voir ci-dessus).
2. Fonctions déclarées dans un script (Robot (2), déjà exécutables pas à
   pas), `Println` (Robot (2) : console de CaRMetal, à remplacer par un
   message cumulé ?), `Input`.
3. Dessin : blocs « dessiner un point / segment / polygone », scripts
   de construction simples (« Lancers de dés » de Complements_StatEspace).
4. Ensuite les animations `Pause` déjà signalées (Galton, Gouttes de Pi),
   qui relèvent du même mécanisme.

## Familles restantes (fichiers représentatifs)

- Courbes implicites `EqXY` : CubiquesBusser, thomsonmovie1, courbes,
  quintique20pts, Courbes elliptiques. Écartées comme dans GGB_IMPORT.md.
- Styles conditionnels autres que couleur, épaisseur et « caché »
  (`showname`, `background`…) : ignorés.
- Compteurs `sum`/`d` à vraie mémoire : approchés (voir plus haut) ; reste
  CIRM3/LIM02 (Buffon : `nb`, `mil`, `abs1`), ERMITtest (108).
- Curseur aux bornes cycliques (`min(@rA,@rB)`, rA dépendant du curseur) :
  Paris7 PS_PentaOrtho.
- Couleurs dynamiques (`scolor` par formules) : non gérées par le moteur.

## Défauts propres aux figures ou à CaRMetal (laissés de côté)

- Poncelet456IREM p.1 : le quadrilatère vert (porisme) n'apparaît pas dans
  CaRMetal (intersection droite-conique tangente jugée inexistante) ; DocGeo
  le montre, comme l'annonce le texte de la figure.
- CorpsFiniCompletAlain : style conditionnel corrompu (`&&@&&@…`).
- Paris7 PSH_Maffati : conique `quad6` à `point4=""` sans objet de nom
  vide.
- 05b_TAffOrtho Intro3 : les axes l15, l16 de l'ellipse n'apparaissent
  pas dans CaRMetal à l'ouverture ; DocGeo les construit.
- ERMITtest ER19 : dans le rendu de CaRMetal, M n'est pas sur l'arc (AB)
  où la figure l'enregistre (`alpha`) ; DocGeo l'y place.

## Écarts de rendu connus

- Points non épais : CaRMetal les remplit de blanc ; DocGeo garde le gris
  par défaut des intersections, milieux, points fixés (`auto_fill_color`,
  non enregistré dans `.dgo` : demanderait un ajout au format).
- Textes LaTeX plus grands que dans CaRMetal (KaTeX à 1,21 em, et
  CaRMetal réduit ses polices avec la fenêtre) : Tchin_tchin, textes un
  peu chevauchés par les boutons, pourtant bien placés.
- ConiquesDaniel p.1 : l'étoile orange (Po…Po6, polygone de Poncelet)
  diffère de CaRMetal ; les points enregistrés (actx) et les ω^k
  concordent, l'écart est plus loin dans la chaîne (non trouvé).
- Curseur `CTRLslider` affiché dans DocGeo (ConiquesDaniel p.1 « a »)
  mais absent du rendu de CaRMetal : à vérifier.

## Prochaine action

1. Scripts de menu : `new Array()` et noms calculés (`Move("C"+i,…)`,
   `Point("A"+i,…)` : table nom → numéro dans le programme), puis
   `Input`, `Println`, fonctions déclarées (Robot (2), robot_circ),
   `SetThickness` des segments de la figure, `switch`.
2. Pages révélées restantes : CubiquesBusser p.7-13 ; Beltrami (Tr6 :
   lieu piloté par un curseur, E358), puis le remettre dans le test.
3. Plus tard : étoile de ConiquesDaniel p.1 (comparer Po1…Po6 pas à
   pas) ; familles restantes ci-dessus (styles conditionnels,
   compteurs à mémoire, curseur aux bornes cycliques).
4. En attente de l'accord de l'auteur : DGO.md, note 3 des objets
   (`Int` accepte un lieu, rang de branche entier ≥ 0, au lieu de 0 à 3).
