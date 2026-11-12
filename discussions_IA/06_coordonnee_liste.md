# `Droite((a,1), (a,2))` : une liste en coordonnée

Discussion du 12 novembre 2026, vers 07:20–07:45 (heures locales de la
machine, UTC−3), suite de `05_formule_point_en_argument.md`.

---

## MOI

Dans l'image jointe, dans le panneau de construction, je retrouve les lignes
exactement telles que je les ai tapées. Pourquoi la droite « b » ne s'est pas
affichée, alors que « c » oui ?

> *Capture : dans l'éditeur, trois lignes :*
> `a = {(2, 0), (1, 0.8), (0, 1), (-2, 0), (-1, -0.8)}`*,*
> `b = Droite((a,1), (a,2))` *et*
> `c = Droite(Élément(a, 2), Élément(a, 3))`*. Seule la droite `c` est
> dessinée.*

## CLAUDE CODE

Parce que `(a,1)` ne désigne pas le premier élément de `a`. C'est **un point
de coordonnées (x = a ; y = 1)**, écrit comme `(2, 3)`. Les parenthèses avec
virgule servent toujours à donner des coordonnées, en GeoGebra comme dans
DocGeo.

Ici, `a` est une liste de points et non un nombre. L'abscisse de `(a,1)`
est donc indéfinie, comme celle de `(a,2)`. La droite `b`, définie par deux
points indéfinis, est elle-même indéfinie et ne se dessine pas. L'éditeur
accepte la ligne parce qu'elle a la forme de coordonnées, et c'est pour ça
qu'elle reste affichée telle que tu l'as tapée. Ce n'est qu'au calcul que
les coordonnées s'avèrent indéfinies.

Pour prendre des éléments de la liste, deux écritures sont possibles :

- `Droite(Élément(a, 1), Élément(a, 2))` : les indices commencent à **1** ;
- `Droite(a[0], a[1])` : les indices commencent à **0**.

Ta droite `c` utilise `Élément(a, 2)` et `Élément(a, 3)`. Elle passe donc
par (1 ; 0,8) et (0 ; 1), et c'est bien ce qu'on voit sur le dessin.

Pour l'instant, rien ne prévient que `b` est indéfinie. Si tu veux, je peux
faire refuser à la saisie, ou signaler, des coordonnées qui ne donnent pas
un nombre. Une telle erreur deviendrait alors visible tout de suite.

## MOI

Je comprends. Donc pour ce genre de choses, il vaut mieux rester sur les
crochets :

`a = [[2, 0], [1, 0.8], [0, 1], [-2, 0], [-1, -0.8]]`

et ensuite

`b = Droite(a[1], a[2])`

C'est cela ?

## CLAUDE CODE

Oui, `b = Droite(a[1], a[2])` fonctionne. Attention à l'indice : avec les
crochets, on compte à partir de **0**. Ainsi, `a[1]` est (1 ; 0,8) et `a[2]`
est (0 ; 1). Tu obtiens donc la même droite que
`c = Droite(Élément(a, 2), Élément(a, 3))`. Pour passer par les deux
premiers points, il faut écrire `Droite(a[0], a[1])`.

Ce qui compte, c'est la façon d'écrire l'accès à un élément : `a[1]` ou
`Élément(a, 2)`, et jamais `(a,1)`, qui définit un point de coordonnées. La
façon d'écrire la liste `a` elle-même ne devrait rien changer.
`[[2, 0], [1, 0.8], …]` et `{(2, 0), (1, 0.8), …}` donnent toutes deux une
liste de points. Je n'ai cependant pas essayé `a[1]` sur une liste écrite
avec accolades.

## MOI

ok. Je pencherais pour faire un refus clair de cette saisie : je ne vois pas
de cas dans lesquels cela devrait être accepté : toi oui ?

## CLAUDE CODE

Je ne vois aucun cas légitime, à une condition près sur la façon de faire le
test.

**Ce qu'il faut refuser.** Une coordonnée dont la valeur est une **liste**,
qu'il s'agisse d'une liste de points, d'une liste de nombres ou d'un point,
puisqu'un point est une liste de 2 ou 3 nombres. Dans `(a, 1)`, une liste
en abscisse ne donne jamais de point. Il vaut mieux le dire tout de suite.

**Ce qu'il ne faut pas refuser.** Une coordonnée numérique qui est
**momentanément indéfinie**. Par exemple, avec `r = sqrt(t)` et le curseur
`t` négatif au moment de la saisie, `(r, 1)` est indéfini, mais ne le
devient plus quand on bouge `t`. Le test ne doit donc pas porter sur « la
valeur est-elle un nombre défini ? », mais seulement sur « la valeur
est-elle une liste ? ». Le même test servirait pour les coordonnées
polaires `(a; 90°)` et pour les points 3D `(a, 1, 2)`.

**Ce qui restera indéfini sans être refusé :**

- On redéfinit `a` plus tard en liste. La droite devient alors indéfinie,
  comme toute construction dont un parent change de nature. Le refus ne
  joue qu'à la saisie de la ligne, ou à sa retouche.
- La lecture des fichiers `.dgo`, `.dgp` et `.ggb` n'est pas concernée. Le
  lecteur doit toujours ouvrir la figure telle qu'elle est.

Le message pourrait être du type « La coordonnée `a` est une liste, pas un
nombre. Pour un élément de la liste, écrire `a[0]` ou `Élément(a, 1)` ».
Le contrôle se placerait dans l'éditeur seulement : le lecteur n'est pas
touché. Je le fais ?

## MOI

Oui tu le fais. Ensuite commit, et ensuite tu fais un .md de notre
discussion dans le dossier « discussions_IA ».

## CLAUDE CODE

C'est fait, et committé sur `master` (46e6f6b, rien n'est poussé) :

> `Refuse a point coordinate whose value is a list, as a in (a, 1)`

**Contrôle** (`src/editor/figure.ts`, `pointProgram`) : toute formule de
point écrite dans l'éditeur est calculée une fois à la saisie, sur une
expression ajoutée puis retirée aussitôt, comme pour `a[0]` dans la
discussion précédente. Cela couvre les coordonnées `(a, 1)`, `(a; 90°)` et
`(1, a, 2)`, que ce soit dans une ligne `P = (a, 1)` ou en argument. Si
l'une des coordonnées a pour valeur une liste, la ligne est refusée avec
ce message :

> Une coordonnée est un nombre, pas une liste : pour un élément de la liste
> L, écrire L[0] ou Élément(L, 1)

Le message est traduit dans les 12 langues de l'éditeur, chaque fois avec
le nom localisé de la commande `Élément`. Une coordonnée seulement
indéfinie, comme `1/t` avec `t = 0`, reste acceptée. Le lecteur n'est pas
touché.

**Surprise en écrivant le test.** Dans DocGeo, `sqrt(-1)` n'est pas
indéfini : c'est le nombre complexe i, dont la valeur est une liste
`[0, 1]`. L'exemple `r = sqrt(t)` avec `t` négatif que je donnais plus haut
est donc faux. Une telle coordonnée est complexe, pas indéfinie, et le
refus est justifié. Le test utilise `r = 1/t` avec `t = 0` à la place.

Le test se trouve dans `tests/browser/embedded_points.test.ts`. Les types
sont vérifiés, et la suite complète passe (279 tests unitaires et 1 399
tests navigateur).
