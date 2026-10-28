# Macro A, B → mAB sur l'horisphère : dépendances des scripts et objets sans parent

Discussion du 28 octobre 2026 (heures locales de la machine, UTC−4).

---

## MOI — 06:39

Je considère cette figure :

`/Users/erichake/Downloads/Horisphere_PourMacro.dgo`

Sans coder, expliques-moi pourquoi on ne peut pas faire une macro qui
prendrait comme initiaux les points A et B, et renverrait le point mAB.
Il me semblait pourtant que dans l'arbre de dépendance, mAB ne dépendait que
de A et B.

## CLAUDE CODE — 06:41

On peut faire cette macro du point de vue géométrique. Ce qui la bloque, c'est
un lien de dépendance que tu ne vois pas dans la figure : il vient d'un script
d'affichage.

**Ce que j'ai vérifié.** J'ai lancé l'analyse de macro de l'éditeur sur ta
figure avec un test temporaire, supprimé ensuite. Avec A et B comme initiaux,
elle répond que mAB n'est **pas** déterminé. Les objets qui lui manquent sont
les cases à cocher `ChSt`, `ChEc`, `ChAB`, `ChAC`, `ChBC`, `ChCD`, `ChDA`.

**D'où vient ce lien.** La chaîne géométrique est bien celle que tu pensais :

```
A, B → stA, stB (formules) → stIab (milieu) → mAB (formule)
```

Mais ta figure contient aussi l'expression-script `E1` (« cacher les
objets ») :

```
stA.setHidden(ChSt==0); stB.setHidden(ChSt==0); … C3.setHidden(ChAB==0); …
```

Ce script change la visibilité de stA et de stB. Le moteur doit donc
recalculer `E1` avant eux, et pour garantir cet ordre il fait de `E1` un
**parent** de chaque objet qu'il met en forme
(`src/objects/expression_object.ts`, l. 516-519). Dans le graphe réel, on a
donc :

```
stA ← A  et  E1
E1  ← ChSt, ChEc, ChAB, … (cases à cocher, nombres libres)
```

L'analyse remonte tous les parents (`src/editor/macro.ts`). Elle trouve donc
des nombres libres que A et B ne peuvent pas fournir, et conclut que mAB
dépend aussi de ces cases.

Même en forçant la macro, ça échoue. La méthode embarquerait `E1` et les cases
dans son corps. Or `E1` cite stD, Ae, C3, C4…, qui n'y sont pas. Le corps est
alors invalide : c'est l'erreur « Invalid DGO file » que j'ai obtenue en
appliquant la macro.

**Pourquoi l'arbre t'a trompé.** Il montre les dépendances de construction,
celles des formules. Le lien « mis en forme par un script » n'y apparaît pas,
alors que c'est un vrai lien du graphe.

**Pour faire la macro tout de suite, sans toucher au code :**

- **Le plus simple :** retirer `stA.setHidden(…)` et `stB.setHidden(…)` du
  script de `E1`, puis définir la macro.
- **Sans toucher à E1 :** construire deux nouveaux points, copies de stA et
  stB qu'aucun script ne cible, puis leur milieu, puis un mAB construit à
  partir de ce milieu.

**Côté code, si tu veux :** l'analyse écarte déjà la condition d'affichage
d'un objet (`parent !== object.condition`). On pourrait de même écarter un
script qui ne fait que mettre l'objet en forme, puisque ce lien ne sert qu'à
l'ordre de calcul. Je ne l'ai pas fait, tu avais demandé de ne pas coder.

---

## MOI — 06:57

Je pense qu'il va falloir que tu touches au code, mais avant cela je veux que
tu fasses une vérification. Voici la même figure, en .dgp :

`/Users/erichake/Downloads/Horisphere_Macros.dgp`

Dans DGPad, il est tout à fait possible de créer cette macro A,B -> mAB

Est-ce bien pour la raison que tu donnes (Est-ce que DGPad écarte les
conditions d'affichage) ?

## CLAUDE CODE — 06:59

Non, la raison n'est pas celle que je supposais. DGPad n'écarte rien : chez
lui, le lien que j'accusais va dans l'autre sens.

**Dans DGPad, le script est un enfant des objets qu'il nomme.** Quand DGPad
lit une expression, il résout chaque nom qu'elle contient et ajoute l'objet
trouvé aux parents de **l'expression elle-même** (`ExpressionInit` dans
`NotPacked/Sandbox/Interpreter.js`, l. 1582-1584) :

```js
if ((_o) && (_o.getParent) && (_o.getParent().indexOf(o) === -1)) {
    _o.addParent(o);   // _o = l'expression E1, o = stA, ChSt, C3…
```

Pour `E1 = "stA.setHidden(ChSt==0); stB.setHidden(…); …"`, DGPad obtient
donc :

```
E1 ← stA, stB, stC, stD, Ae, …, ChSt, ChEc, …
stA ← CdA ← A          (rien ne vient de E1)
```

`setHidden` est pour lui un simple appel de méthode sur un objet nommé. Aucun
code ne fait de `E1` un parent de stA.

**Ce que fait l'outil macro de DGPad.** `checkIntermediate` et
`tagDependencyChain` (Main.js, l. 5332-5372) remontent `getParentAt(i)` à
partir des finaux. En partant de mAB, ils trouvent stIab, puis stA et stB,
puis CdA et CdB, puis A et B, et s'arrêtent là. `E1` est en aval de stA, donc
jamais rencontré, et les cases à cocher non plus.

**Dans DocGeo, le lien est inversé.** À l'import, chaque objet qu'un script
met en forme reçoit ce script comme parent
(`src/objects/expression_object.ts`, l. 516-519), sauf si le script lit aussi
cet objet. Ici, stA n'apparaît que dans `stA.setHidden(…)`. On a donc
`stA ← E1 ← ChSt…`, et c'est ce lien qui bloque la macro. DGPad ne l'a pas.

Ma suggestion précédente (« comme on écarte déjà la condition d'affichage »)
n'était qu'une analogie avec le code de DocGeo, pas le comportement de DGPad.

**Pour la correction**, deux pistes :

1. **Dans l'analyse de macro :** ne pas compter comme source d'un objet un
   script qui ne fait que le mettre en forme. Le moteur ne change pas.
2. **Dans le moteur :** ne plus inverser le lien pour la simple mise en forme
   (`setHidden`, `setColor`…), et le garder pour ce qui change une valeur
   (`SET_EXP`). Ce serait plus fidèle à DGPad, mais il faut d'abord vérifier
   pourquoi l'ordre « script avant cible » a été introduit, car le
   commentaire ne parle que de `SET_EXP`.

Je penche pour la piste 1, plus sûre. Dis-moi laquelle tu préfères avant que
je touche au code.

---

## MOI — 07:02

J'ai bien peur d'avoir rencontré, par le passé, des problèmes de dépendances
dans DGPad lié à l'inversion dont tu parles. Je ne veux donc pas toucher au
comportement actuel de DocGeo, aussi je penche aussi pour la piste 1 qui est
effectivement plus sûre.
Tu peux coder.

## CLAUDE CODE — 07:05

Sur ta figure, on peut maintenant définir la macro A, B → mAB, et elle donne
le bon résultat. Le moteur n'a pas changé : seule l'analyse de macro de
l'éditeur est modifiée.

**La modification** (`src/editor/macro.ts`) : quand l'éditeur remonte les
parents d'un objet pour définir une macro, il écarte déjà la condition
d'affichage. Il écarte maintenant aussi un script qui ne fait que mettre
l'objet en forme (`stA.setHidden(…)`). Les deux étapes qui remontent ces liens
appliquent la même règle :

- le calcul de ce que les initiaux déterminent ;
- la construction du corps de la macro.

L'ordre de calcul « script avant objet » reste intact dans le moteur. C'est ce
qui exclut les problèmes de dépendances que tu as connus avec DGPad.

**Vérifications :**

- **Sur ta figure :** avec A et B comme initiaux, mAB est déterminé et il ne
  manque rien. Le corps de la macro est `stB, stA, stIab, mAB`, sans `E1` ni
  les cases à cocher, comme dans DGPad.
  - Appliquée à A, B, la macro redonne exactement mAB.
  - Appliquée à C, D, elle donne un point de la sphère : sa distance au
    centre (0, 0, 1) vaut 1.
- **Test ajouté** dans `tests/browser/macro_define.test.ts` : un point mis en
  forme par un script reste déterminé par ses initiaux, et le script n'entre
  pas dans le corps. Le test échoue sans la modification et passe avec.
- **Suite complète :** 1229 tests sur 1231 passent. Les deux échecs sont des
  tests de glisser (« drags the independent knob of an inert DGPad
  expression », « scrubs numbers live and commits once, keeping click and
  keyboard editing »). Lancés à part, ils passent avec et sans la
  modification ; ils semblent sensibles à la charge de la suite complète.
- Types et formatage sont corrects.

Je n'ai pas encore committé.

---

## MOI — 07:09

*(Capture d'écran du panneau « Nouvelle macro », étape 2/2, initiaux A et B :
la liste des finaux contient S, Y, X, C10, C2, S21, N, S11, C7…)*

Gros problème : Avec ce que tu as fait, il y a carrément tous les objets dans
la liste des finaux possible !

## CLAUDE CODE — 07:13

C'est corrigé : avec A et B comme initiaux, ta figure ne propose plus que
`stB, stA, stIab, a, mAB` comme finaux, comme DGPad.

**Pourquoi tout s'allumait.** Pour l'éditeur, un point fixe ne dépendait de
rien, donc il était « déterminé » quels que soient les initiaux. Tout ce qui
en découlait l'était aussi. Avant ma première modification, on voyait déjà S,
Y, X, C10, C2, S21, N, S11 et S1 dans la liste. Le reste de la sphère n'y
était pas parce que le script `E2` (« cacher outils sphère »), avec ses cases
à cocher, le bloquait par hasard. En retirant ce blocage, j'ai fait apparaître
toute la figure.

**La correction** (`src/editor/macro.ts`) : un objet qui ne dépend de rien
(point fixe, point à formule constante) n'est plus déterminé, sauf s'il est
lui-même initial. C'est la règle de DGPad : un objet sans parent n'y est
jamais intermédiaire. Si une macro a vraiment besoin d'une constante, on la
désigne comme initial fixé, avec le cadenas.

**Ce que ça donne sur ta figure :**

- les finaux proposés sont `stB, stA, stIab, a, mAB` ;
- le corps de la macro reste `stB, stA, stIab, mAB` ;
- un clic sur le cercle C3 (par A, B, N) est refusé avec « il manque Z, S ».

**Vérifications :**

- J'ai ajouté un test : un point fixe est signalé comme initial manquant, et
  rien de ce qu'il porte n'est proposé.
- Les 48 tests de macros passent.
- Sur la suite complète, 1231 tests sur 1232 passent. Le seul échec est le
  test de glisser déjà vu ; lancé seul, il passe.
- Types et formatage sont corrects.

J'ai ajouté les deux règles dans `MACROS.md` : un objet qui ne dépend de rien
n'est pas déterminé, et un script de mise en forme n'est pas une source.

**C'est une décision à valider** : jusqu'ici, un point fixe pouvait servir de
constante dans le corps d'une macro, et ce n'est plus possible. Si tu préfères
garder cela, il y a une autre solution : continuer à compter les constantes
comme déterminées, mais ne proposer comme finaux que les objets qui dépendent
d'au moins un initial.

Rien n'est committé.

---

## MOI — 07:15

Avant de valider quoi que ce soit, je veux que tu expliques clairement, si
possible avec un exemple simple, ton « jusqu'ici, un point fixe pouvait servir
de constante dans le corps d'une macro, et ce n'est plus possible. ».
Qu'est-ce-que la suppression de ce choix pourrait impliquer ?

## CLAUDE CODE — 07:16

Voici ce que j'entendais, avec un exemple, puis ce que la nouvelle règle
change en pratique.

**Un exemple simple.** Une figure de trois objets :

```
O  = PointFixe(0, 0)
A  = (3, 1)                 point libre
A' = Symétrie(A, O)
```

Je veux une macro avec un seul initial, A, et pour final A'.

Avec l'ancienne règle, O ne dépend de rien, et l'éditeur le comptait donc
comme une constante. A' était accepté, et le corps de la macro était :

```
O  = PointFixe(0, 0)        (caché, recréé à chaque application)
A' = Symétrie(A, O)
```

On obtenait un outil autonome, « symétrique par rapport à l'origine du
repère ».

Avec la nouvelle règle, A' est refusé, avec « il manque O ». O doit devenir un
initial : ordinaire (la macro devient « symétrique de A par rapport à un
point ») ou fixé (désigné une fois, puis retrouvé par son nom dans la figure).

On a le même cas dans ta figure : le cercle C3 passe par A, B et le pôle N,
construit à partir des points fixes S et Z.

**Ce que cela implique.** On perd les macros liées au repère qui se suffisent
à elles-mêmes (origine, point des axes, pôle de la sphère, point à formule
constante comme `RN = [0, 0, 2]`). C'est aussi ce que fait DGPad. Ne changent
pas : les macros déjà enregistrées dans des `.dgo` (l'application exécute le
corps sans repasser par l'analyse), la bibliothèque de macros (aucun point
fixe ; sa géométrie hyperbolique repose déjà sur un initial fixé `Hz`), et les
constantes qui ne sont pas des objets (rayon numérique, nombre tapé dans une
commande, place d'un point sur objet).

**L'autre solution.** Garder les objets qui ne dépendent de rien comme
déterminés, mais ne proposer comme finaux que les objets qui dépendent d'au
moins un initial. Je recommandais cette solution.

---

## MOI — 07:28

Je ne comprends pas :

1. Sur geogebra, ton exemple simple ne permet pas de créer la macro symétrique
   à partir seulement du point A.
2. Sur DGPad non plus ! Regarde la figure
   `/Users/erichake/Downloads/simple.dgp`, tu n'arriveras pas à désigner A' si
   O n'est pas défini en initial.

De quoi parles-tu ?

## CLAUDE CODE — 07:29

Tu as raison : ni GeoGebra ni DGPad ne permettent cette macro. Dans
`simple.dgp`, `O=Point("O","[0,0]","0")` est un point à formule constante,
sans parent, et DGPad refuse donc Symc1 tant que O n'est pas un initial.

Je parlais seulement de **DocGeo avant ma modification d'aujourd'hui**, et je
l'ai mal présenté. Ce n'était pas une possibilité voulue, mais un effet de
bord du test que fait l'éditeur. Pour lui, un objet est déterminé si **tous
ses parents** le sont. Un point fixe n'a aucun parent, donc la condition était
remplie d'office. Personne ne l'a décidé : `MACROS.md` n'en parle pas et aucun
test ne s'en servait. C'est ce même effet de bord qui allumait toute ta
sphère.

Ma modification ne retire donc rien qu'un utilisateur de DGPad ou de GeoGebra
connaisse : elle met DocGeo au même comportement qu'eux. L'« autre solution »
que je recommandais aurait au contraire gardé cet effet de bord en le rendant
officiel, sans aucune raison de le faire. Je la retire, et je te propose de
garder la règle actuelle.

---

## MOI — 07:33

ok. Fais ça, et écrit la discussion actuelle sous la forme d'un fichier .md
(préfixe 04) à placer dans le dossier discussions_IA. Je veux que ce soit
horodaté, à savoir que tu écrives l'heure à laquelle j'ai fait le prompt
(« MOI ») et aussi l'heure de ta réponse (« CLAUDE CODE »).
Ensuite, tu peux faire un commit.

## CLAUDE CODE — 07:35

La note de `MACROS.md` dit maintenant qu'un objet sans parent n'est
déterminé que s'il est initial, comme dans DGPad et GeoGebra. Elle ajoute que
l'ancien comportement venait d'un effet de bord du test « tous ses parents
sont déterminés ». Ce fichier reprend la discussion, et le tout est committé
avec la correction de l'analyse de macro et ses tests.
