# `Droite(a[0], a[1])` : une formule dont la valeur est un point, en argument

Discussion du 12 novembre 2026 (heures locales de la machine, UTC−3).

---

## MOI — 06:56

Après ce que tu as fait hier (voir les commits), je pensais que ce genre de
chose ne produirait plus d'erreur : voir image jointe.

> *Capture : dans l'éditeur, une expression*
> `a = [[2, 0], [1, 0.8], [0, 1], [-2, 0], [-1, -0.8]]`*. La ligne tapée*
> `Droite(a[0],a[1])` *est refusée avec le message « Arguments incorrects
> pour Droite ».*

## MOI (pendant que Claude Code travaillait) — 06:58

Là où c'est incohérent c'est que a[0] tout seul propose de créer un point
(Image).

> *Capture : la même figure, la ligne* `a[0]` *tapée seule. L'éditeur
> propose de créer un point ou une expression.*

## CLAUDE CODE — 06:59

C'est corrigé : `Droite(a[0], a[1])` construit maintenant la droite, de la
même façon que `a[0]` tapé seul propose déjà un point.

**Cause.** Le commit d'hier ne reconnaissait comme point écrit en argument
que deux formes : les coordonnées, comme `(1, 2)` ou `(3; 90°)`, et
`Point(…)`. Ces formes se reconnaissent au texte. `a[0]` est une formule
quelconque, impossible à classer sans la calculer. Elle restait donc une
formule, qui n'est acceptée que comme nombre, d'où « Arguments incorrects
pour Droite ». Une ligne réduite à `a[0]` passe par un autre chemin :
l'éditeur calcule sa valeur sur une expression ajoutée puis retirée
aussitôt, et voit que c'est un point.

**Correction** (`src/editor/figure.ts`, `givesPoint`) : en argument, une
formule est maintenant calculée de la même façon. Si sa valeur est un point
(2 ou 3 nombres), elle devient un point intégré à l'objet, comme `(1, 2)`.
Sinon elle reste une formule, si bien que `Cercle(A, a[0][0])` garde un
rayon numérique.

**Comportement à valider :** la ligne se relit
`d = Droite(Point(a[0]), Point(a[1]))`. C'est l'écriture déjà utilisée pour
tout point intégré qui n'est pas en coordonnées. Elle reste sans ambiguïté
même si `a` change plus tard de nature. Si tu préfères qu'elle se relise
`Droite(a[0], a[1])` comme tapée, c'est faisable, mais la relecture
dépendrait alors de la valeur de `a` au moment où elle est lue.

Un test a été ajouté dans `tests/browser/embedded_points.test.ts`, et la
suite complète passe. La modification ne touche que l'éditeur, pas le
lecteur. Rien n'est commité.

## MOI — 07:03

Je ne comprends pas : « mais la relecture dépendrait alors de la valeur de a
au moment où elle est lue. »

Veux-tu dire que si on modifie a ensuite, la droite ne va pas s'adapter aux
changements ?

## CLAUDE CODE — 07:03

Non, la droite suit bien les changements de `a`, quelle que soit l'écriture.
Le point intégré garde sa formule `a[0]` et la recalcule à chaque
modification de `a`. Si tu remplaces `[2, 0]` par `[3, 1]`, la droite bouge.

Ma remarque concernait seulement le **texte de la ligne**, quand il est
relu, c'est-à-dire quand tu modifies la ligne dans le panneau Construction
et la valides :

- Avec `Droite(Point(a[0]), Point(a[1]))`, le texte dit lui-même que ce sont
  des points. La ligne se relit toujours de la même façon.
- Avec `Droite(a[0], a[1])`, c'est la valeur actuelle de `a[0]` qui décide
  si c'est un point. Le cas gênant : tu redéfinis `a` en liste de nombres,
  par exemple `a = [1, 2, 3]`. La droite devient indéfinie dans les deux
  cas. Mais si tu retouches ensuite sa ligne, la version sans `Point` est
  refusée (« Arguments incorrects »), alors que la version avec `Point` est
  acceptée.

L'enregistrement `.dgo` n'est pas concerné : il garde la formule du point,
pas le texte de la ligne.

Le risque est donc mince. Si tu préfères voir la ligne telle que tu l'as
tapée, je peux la faire relire `Droite(a[0], a[1])`.

## MOI — 07:10

Quand tu dis « L'enregistrement .dgo n'est pas concerné : il garde la
formule du point, pas le texte de la ligne. », cela signifie que si on tape
« Droite(a[0], a[1]) », qu'on quitte DocGeo et qu'on le relance en ouvrant la
figure, il y aura écrit « Droite(Point(a[0]), Point(a[1])) » dans le
panneau ?

## CLAUDE CODE — 07:10

Oui, et c'est déjà le cas avant même de quitter DocGeo. Le panneau n'affiche
jamais le texte tapé : il réécrit chaque ligne à partir de l'objet. Pour la
droite, l'objet ne garde que ses deux points intégrés, de formules `a[0]` et
`a[1]`, et c'est aussi ce que contient le `.dgo`. La ligne
`Droite(Point(a[0]), Point(a[1]))` apparaît donc dès la validation, puis de
nouveau à la réouverture de la figure, puisque les deux affichages sont
produits de la même façon. Le test ajouté vérifie justement ce texte juste
après la saisie.

C'est le principe de toutes les lignes du panneau : ce qui est tapé est
normalisé, comme `L(2)` qui se relit `Élément(L, 2)`. Si on décide
d'afficher `Droite(a[0], a[1])`, ce sera aussi le cas partout, juste après
la saisie comme à la réouverture, sans rien changer au format `.dgo`.

## MOI — 07:13

ok. Il s'agit donc juste d'une écriture « Droite(a[0], a[1]) » qui ne va
vivre que le temps de la session. Par conséquent cela n'est pas utile de
l'écrire tel quel dans le panneau.

## CLAUDE CODE — 07:14

D'accord, je laisse l'affichage `Droite(Point(a[0]), Point(a[1]))`. Une
petite précision : ce n'est pas `Droite(a[0], a[1])` qui disparaît à la fin
de la session. Ce texte n'apparaît jamais dans le panneau, il ne sert qu'au
moment de la saisie. La forme avec `Point` est la seule affichée, et elle se
relit toujours sans ambiguïté.

La correction est donc complète, et rien n'est commité. Je committe si tu me
le demandes.

## MOI — 07:14

ok. commit

## CLAUDE CODE — 07:14

J'ai fait le commit sur `master` (166edb0). Il contient la correction dans
`src/editor/figure.ts` et son test, et je n'ai rien poussé.

> `Take a formula whose value is a point as a point argument, as a[0] in
> Line(a[0], a[1])`
