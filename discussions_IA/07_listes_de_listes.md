# `{{…}, {…}}` : les listes de listes

Discussion du 12 novembre 2026, vers 07:45–08:05 (heures locales de la
machine, UTC−3), suite de `06_coordonnee_liste.md`.

---

## MOI

Pourquoi la commande :

`c={{(2,0), (1, 0.8), (0, 1), (-2, 0), (-1, -0.8)},{(2,3), (1, 3.8), (0, 4), (-2, 0]), (-1, 1.2)}}`

est refusée, alors que si je crée deux listes :

`a={(2,0), (1, 0.8), (0, 1), (-2, 0), (-1, -0.8)}`
`b={(2,3), (1, 3.8), (0, 4), (-2, 0]), (-1, 1.2)}`

la commande `c={a,b}` est acceptée ?

## CLAUDE CODE

Le refus n'a rien à voir avec les valeurs des listes : c'est l'écriture
`{ … }` qui n'accepte que des points.

**1. Pourquoi `c = {{…}, {…}}` est refusée.** Dans l'éditeur, une ligne
entre accolades est lue comme **une liste de points** (`{A, (1, 2), …}`,
comme GeoGebra). Chaque élément entre les virgules doit être soit des
coordonnées `(x, y)`, soit une formule. Ici, les éléments sont
`{(2,0), …}` et `{(2,3), …}`, c'est-à-dire eux-mêmes des listes. Ce ne
sont ni des coordonnées ni une formule, d'où l'erreur de syntaxe. Les
listes de listes ne sont pas prises en charge sous cette forme.

**2. Pourquoi `c = {a, b}` passe.** Les éléments `a` et `b` sont de
simples noms, donc des formules valides : la règle est respectée à la
saisie. Mais le calcul de cette liste attend que chaque formule donne
**un point**. Or `a` et `b` valent chacune une liste de 5 points. Le
résultat n'est donc pas une liste de deux listes : c'est une « liste de
points » dont les éléments ne sont pas des points. C'est le même cas que
`(a, 1)` ce matin : la ligne est acceptée, mais ce qu'elle produit n'a
pas de sens. Ce n'est pas un comportement voulu, c'est un trou du
contrôle à la saisie.

**3. Une coquille dans ta saisie.** Dans ta ligne, le 4ᵉ point de la
seconde liste est écrit `(-2, 0])`, avec un `]` en trop. Avec ce `]`,
l'éditeur refuse aussi bien la ligne entière que `b = {…}` seule. Tu l'as
donc sans doute tapée correctement dans l'éditeur. Sans la coquille, la
ligne `c = {{…}, {…}}` reste refusée pour la raison du point 1.

**Ce que je propose :**

- **A.** Refuser `{a, b}` à la saisie quand un élément ne donne pas un
  point, comme pour `(a, 1)`. C'est le plus simple et le plus cohérent
  avec le commit d'aujourd'hui.
- **B.** Accepter les vraies listes de listes `{{…}, {…}}`, comme
  GeoGebra. C'est plus lourd : il faut un nouveau type d'objet et son
  format `.dgo`, et décider de ce que donnent `Élément(c, 1)`,
  `Polygone(Élément(c, 1))`, etc.

Lequel préfères-tu ?

## MOI

Même si c'est plus lourd, je veux accepter les vraies listes de listes,
donc l'option B. Tu me diras à la fin ce que donne la nouvelle taille du
build du moteur seul.

## CLAUDE CODE

Les listes de listes sont acceptées. Ta commande passe maintenant, une
fois corrigé le `]` en trop dans `(-2, 0])` : avec ce caractère, la ligne
reste refusée pour une simple erreur de syntaxe.

**Ce qui marche, comme dans GeoGebra :**

- `c = {{(2,0), (1, 0.8), …}, {(2,3), …}}` crée une liste de listes. Elle
  dessine tous ses points et se relit telle que tu l'as tapée.
- `c = {a, b}` donne maintenant une vraie liste de listes quand `a` et `b`
  sont des listes. Avant, c'était une liste de points sans valeur.
- Dans une formule, `c[0][1]` fonctionne, par exemple dans
  `Droite(c[0][1], c[1][0])`.
- `L = Élément(c, 2)` donne la liste de rang 2, utilisable dans
  `Polygone(L)`. `Polygone(Élément(c, 1))` et `Polygone(c(1))` marchent
  aussi, la liste étant alors intégrée au polygone.
- `Élément(c, 2, 3)` donne le point de rang 3 de la liste de rang 2.
- Quelques écritures sont refusées : `Polygone(c)` (un polygone attend une
  liste de points), `Élément(c, 1, 1, 1)`, et `c(1)` là où un point est
  attendu.

**Format `.dgo`** : l'évolution est purement additive, et les fichiers
existants se lisent sans changement. Une liste à l'intérieur d'une liste
s'écrit comme un tableau de ses éléments, et il y a un nouveau type `Fl`
pour une liste donnée par une formule. Tout est décrit dans `DGO.md`
(note 30) et dans `EDITOR.md` (« Listes de listes »).

**Tests** : 3 nouveaux tests dans `tests/browser/point_lists.test.ts` :
saisie, relecture des lignes, `Élément`, refus, puis enregistrement et
relecture du `.dgo`. Les 279 tests unitaires et les 1 402 tests navigateur
passent. Je n'ai pas tapé les lignes à la main dans `editor.html` : les
tests passent par le même chemin de saisie, mais avec les noms de
commandes anglais.

**Taille du build du moteur seul** (les 6 chunks `engine-*` chargés par
le lecteur, mesurés avant et après) :

|        | Avant                      | Après                      | Écart                    |
| ------ | -------------------------- | -------------------------- | ------------------------ |
| Moteur | 323,31 Ko (104,11 Ko gzip) | 324,22 Ko (104,44 Ko gzip) | +0,91 Ko (+0,33 Ko gzip) |

L'éditeur prend 1,02 Ko de plus (+0,33 Ko gzip).

Je n'ai rien commité et je n'ai pas touché au manuel. Il faudra plus tard
compléter `Élément` dans `commandes.html` (la liste de rang i et la forme
`Élément(c, i, j)`), et ajouter un mot sur les listes de listes dans les
12 langues.

## MOI

ok. Transforme cette discussion en .md dans le dossier « discussions_IA »
et ensuite commit et push.
