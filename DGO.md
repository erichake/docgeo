# Format .dgo — mémo de conception

Décisions prises avec l'auteur (conversation du 2026-09-27), avant tout code.

## Positionnement

- `.dgo` devient **le format natif de DocGeo** : seul format lu et écrit
  nativement. `.dgp` et `.ggb` ne sont plus que des **imports**.
- Première étape : version standalone. **Cmd-S / Ctrl-S** enregistre la figure
  courante en `.dgo` (bloquer l'enregistrement de page du navigateur,
  téléchargement via Blob — `showSaveFilePicker` n'existe que sous Chromium).
  Ouvrir un `.dgo` : ajouter l'extension au sélecteur et au choix du lecteur
  dans `src/main.ts` (`accept`, tests `/\.ggb$/i`).
- On enregistre la figure **dans son état courant** (points déplacés, curseurs,
  vue/zoom).
- Mettre à jour `AGENTS.md` : `.dgo` format natif, enregistrement `.dgo`
  autorisé (sans ouvrir la porte aux outils de création/édition).

## Cible DocEval (plus tard)

- L'import `.dgp`/`.ggb` a lieu **une seule fois, dans le navigateur du
  professeur**, au dépôt. **Le fichier d'origine n'est pas conservé** : seul le
  `.dgo` est stocké (colonne `longblob` MySQL/InnoDB, binaire brut — pas en
  base64 dans `options` comme l'actuel `dgpad_source`, qui coûte +33 %).
- Le serveur ne reçoit qu'un JSON compressé ; le lecteur `.dgo` doit résister
  à un fichier malformé (client non fiable), mais `JSON.parse` n'exécute rien.
- Les éléments non importés sont perdus définitivement : le signalement
  d'import doit être bien visible au dépôt.
- **État élève** = seulement la position finale des objets manipulables
  (points libres et semi-libres, valeurs de curseurs, etc.), en JSON clair
  séparé de la figure, indexé par nom : `{"P1":[2.1,-0.4],"Nx":31}`.

## Conteneur

- `.dgo = gzip(JSON UTF-8)` via `CompressionStream("gzip")` /
  `DecompressionStream("gzip")`. Pas de zip, pas de conteneur binaire.
- Toujours compressé, même sans image. Mesures sur les 72 `.dgp` de test :
  1,09 Mo → 193 Ko (17,6 %) ; < 1 Ko : 55–73 %, > 200 Ko : ~15 %.
- Images en data URL base64 dans une table `img` indexée par hash : après gzip
  le surcoût est de 0,3 % (mesuré sur l'image de `mandel.ggb`), et la data URL
  se met directement dans `<image href>`.
- Optionnel : accepter aussi un JSON non compressé en lecture (octets magiques
  `1f 8b`) pour des figures de test lisibles.

## Structure JSON (v1)

Implémentée dans `src/dgo.ts` (défauts, styles, vue, lecteur) ; chaque type
d'objet se décrit lui-même par sa méthode `dgo()` (type et paramètres).

```json
{
    "dgo": 1,
    "v": {
        "o": [550, 424.9],
        "u": 50,
        "w": 1100,
        "h": 700,
        "3d": 1,
        "th": 0.0524,
        "ph": 0.977,
        "fl": 0
    },
    "deg": 0,
    "sop": 1,
    "bg": "#ffffff",
    "st": [{ "c": "#4d4dff", "sn": 1 }, { "h": 1 }],
    "img": { "9f86d081884c7d65": "data:image/png;base64,…" },
    "o": [
        ["Pt", "A", [-3.51, -3.48], 0],
        ["Fp", "aux 2", [["A+[2,0,0]", { "A": 0 }]], 1],
        ["Sph", "a", [0, 1]],
        ["Ex", "E2", { "t": "", "v": 2.6, "mn": 0, "mx": 10, "xy": [64, 251] }]
    ]
}
```

- Objets en tableaux positionnels, **dans l'ordre de construction** ;
  références aux parents **par indice** (toujours inférieur). Le nom est
  conservé (affichage, formules, état élève).
- **Styles** : seulement l'écart au défaut du type, dédupliqués dans `st`,
  référencés par indice.
- **Pas de valeurs calculées** (intersections, lieux, listes évaluées) ; ne
  stocker que ce qui lève une ambiguïté (branche d'intersection, paramètre
  d'un point sur objet). Le recalage GeoGebra est appliqué avant l'écriture :
  aucune donnée propre à GeoGebra dans le `.dgo`.
- Nombres JSON (pas de chaînes) ; écriture JS la plus courte pour les points
  libres ; positions d'écran arrondies au pixel.
- Formules : texte source du langage interprété en sandbox
  (`src/import/dgp_formula.ts`), jamais de JS exécuté.
- Tout ce que l'import déduit à la volée doit y être : vue, mode degrés,
  `segmentsOverPolygons`, etc. Tout ce que permettent les importers `.dgp` et
  `.ggb` doit être représentable.

### Racine

| Clé   | Contenu                                  | Défaut     |
| ----- | ---------------------------------------- | ---------- |
| `dgo` | version du format                        | (requis) 1 |
| `v`   | vue et repère (ci-dessous)               | (requis)   |
| `vs`  | autres vues (ci-dessous)                 | `[]`       |
| `deg` | angles en degrés (1) ou en radians (0)   | 1 (DGPad)  |
| `sop` | `construction.segmentsOverPolygons`      | 0          |
| `bg`  | couleur de fond                          | `#FAFAFA`  |
| `bgi` | motif de fond : clé dans `img`           | `null`     |
| `bgf` | disposition du motif                     | `repeat`   |
| `st`  | styles, référencés par indice            | `[]`       |
| `img` | images : clé → data URL                  | `{}`       |
| `o`   | objets `[type, nom, paramètres, style?]` | (requis)   |
| `mac` | macro-constructions (ci-après)           | `[]`       |
| `wb`  | classeur DocCells de la vue tableur      | `null`     |
| `cas` | réponses de Giac, par requête            | `{}`       |

Classeur DocCells (depuis le 2026-11-20, `TABLEUR.md`) : `wb` est
l'archive DocCells (`{ format: "doccells", version, … }`), recopiée telle
que DocCells la donne (`save`) et lui est rendue (`load`). Elle va avec la
vue tableur de la figure (`t` ci-après) : requise s'il y en a une, ignorée
sinon. DocGeo n'en lit pour l'instant rien d'autre que sa présence : son
contenu, vérifié par DocCells, est son affaire.

Réponses de Giac (depuis le 2026-11-22, `CAS.md`) : `cas` associe à
chaque requête de calcul formel lue par un objet de la figure (texte
construit par DocGeo depuis la formule, voir « Commandes de calcul
formel » ci-après) ou par une ligne d'une vue CAS (`t` ci-après) la
dernière réponse de Giac, `null` s'il n'en a pas donné. Le lecteur les reprend avant de calculer les objets : une figure
dont les requêtes y sont s'affiche sans charger Giac, même hors ligne.
Ce n'est qu'un cache : une requête absente (ou écrite autrement par une
version ultérieure) est simplement redemandée à Giac. Une réponse n'est
jamais exécutée, seulement relue par la grammaire des formules.

Motif de fond (depuis le 2026-11-15) : l'image `bgi` est peinte derrière
toute la figure, par-dessus la couleur `bg`, selon `bgf`, comme en CSS :
`repeat` en mosaïque depuis le coin en haut à gauche, `repeat-x` et
`repeat-y` en une seule rangée le long du haut ou une seule colonne le long
de la gauche, `center` centrée à sa taille, `stretch` étirée à la fenêtre,
`cover` agrandie jusqu'à la remplir, `contain` jusqu'à y tenir.

### Classeur

Un classeur est une suite de figures **indépendantes**, montrées une à la
fois par des onglets. Sa racine
n'a que trois clés :

| Clé   | Contenu                                 | Défaut   |
| ----- | --------------------------------------- | -------- |
| `dgo` | version du format                       | (requis) |
| `pg`  | pages : `{"n": nom, …}` (au moins une)  | (requis) |
| `p`   | indice de la page montrée à l'ouverture | 0        |

Une page est une figure (toutes les clés de la racine ci-dessus, sauf `dgo`),
plus son nom `n` (unique dans le classeur) et, si elle en a une, la couleur
`c` de son onglet. Rien n'est partagé entre les pages : ni objets, ni styles,
ni images, ni macros, et leurs noms d'objets sont indépendants, mais une
formule peut lire une expression d'une autre page, et les globales Blockly
sont celles du classeur (ci-après).
L'enregistrement garde chaque page dans l'état où on l'a laissée, et `p` est
la page montrée.

Pour l'instant, le mode intégré du lecteur montre la page `p` d'un classeur,
seule, sans onglets, vue tableur comprise (`EMBED.md`) : l'état élève est
celui de cette page.

#### Références entre pages

Seule exception à l'indépendance des pages : une formule peut lire la
valeur d'une expression d'une autre page, avec la syntaxe des tableurs :
`m = 'Page 1'!c`. Le nom de la page s'écrit comme une chaîne (`\'` pour une
apostrophe : `'L\'aire'!c`), ou tel quel s'il est un identifiant
(`Page2!c`) ; celui de l'objet comme dans toute formule. Une chaîne ou un
nom suivi immédiatement de `!` puis d'un nom est une référence ; `'a'!=c`
reste une comparaison (`src/import/dgp_formula.ts`, nœud `external`).

- **Lecture seule** : rien dans une page ne change une autre page (ni
  `SET_EXP`, ni programme), sauf ses globales (ci-après). Tout objet autre qu'une fonction
  peut être lu, avec la valeur qu'une formule de sa page lit en le nommant
  (coordonnées d'un point, longueur d'un segment…), indéfinie s'il n'en a
  pas.
- **Par le nom**, comme les objets dans les formules : le texte enregistré
  est celui qu'on lit. Les noms de pages sont donc uniques dans un classeur ;
  l'éditeur réécrit les références des autres pages quand il renomme la page
  montrée ou l'un de ses objets. Une référence à une page ou un objet absent
  est indéfinie, et l'expression est gardée (pas de suppression en cascade).
- **Graphe des pages acyclique** : si une page en lit une autre, celle-ci ne
  la lit pas, même indirectement. Chaque page se calcule ainsi d'un bloc.
  L'éditeur refuse une référence qui fermerait un cycle ; dans un fichier
  qui en contient un, la référence qui le fermerait, lue pendant que la page
  qu'elle vise est montrée ou en calcul, est indéfinie.
- **Dans le moteur**, la valeur d'une référence est fournie par le classeur
  (`src/workbook.ts`) et ne change pas tant que la page est montrée : le
  graphe interne de la page ne change pas.
- **Calcul paresseux** : une seule page étant montrée, rien n'est propagé
  pendant une manipulation. Le classeur garde, pour chaque page calculée,
  les valeurs de ses expressions et les pages qu'elle a lues. Quitter une
  page relève ses valeurs ; si elles ont changé, celles des pages qui la
  lisent, directement ou non, sont oubliées. Une référence à une page sans
  valeurs la calcule d'abord sans la montrer (construction créée depuis la
  description, valeurs relevées, construction détruite), ainsi que les
  pages qu'elle lit à leur tour. Supprimer une page oublie toutes les
  valeurs. Les descriptions ne changent pas, et ce cache n'est pas
  enregistré.
- **Mode intégré** : il calcule de même, sans les montrer, les pages que lit
  la page `p` ; l'état élève reste celui de la page `p`.

Format : aucune clé nouvelle, la référence n'étant que du texte de formule
(un ajout à la grammaire, conforme aux règles d'évolution).

Cellules (depuis le 2026-11-20, `TABLEUR.md`) : `X!B3` est la cellule B3
de la feuille `X` du classeur `wb` de la page, si `X` en est une feuille et
`B3` une adresse (lettres puis chiffres, sans `$`), sinon une référence à
une page ; `X!B2:B21` une plage, écrite d'un seul tenant ; `'Page 2'!X!B3`
une cellule du classeur d'une autre page, lue dans les valeurs `v` de son
archive. Une cellule vide ou en erreur est indéfinie, un booléen vaut 1 ou
0 ; une plage d'une ligne ou d'une colonne est une liste, un rectangle une
liste de lignes, une cellule indéfinie y valant NaN. Aucune clé nouvelle :
du texte de formule.

#### Globales du classeur

Une globale Blockly (6) est celle du classeur : toutes les pages qui ont une
globale de ce nom (leur `Ex` de `"g"` égal) lui donnent la même valeur.
Seuls des événements la changent (bouton, programme « onchange »,
« ondrag »…), jamais un calcul : comme un point libre, elle ne crée pas de
cycle entre les pages. Chaque page la garde comme son `Ex`, et le classeur
(`src/workbook.ts`) synchronise leurs descriptions :

- **À l'ouverture**, chaque globale prend la valeur qu'elle a dans la page
  montrée, ou, si elle n'y en a pas (`"v"` absent ou `null`), la première
  qu'elle a dans les pages, dans l'ordre : une globale jamais fixée n'efface
  pas celle d'une autre page.
- **En quittant une page et à l'enregistrement**, ses globales sont données
  aux autres pages, dont les valeurs calculées sont oubliées si l'une
  d'elles change. Le fichier enregistré donne donc la même valeur à une
  globale dans toutes ses pages.
- Comme une référence entre pages, la valeur d'une autre page qui dépend
  d'une globale ne change pas tant que la page est montrée : elle suit le
  changement de la globale au prochain affichage.

Couleurs : `#rgb`, `#rrggbb` ou `rgb(r,g,b)`. Booléens : 0 ou 1. JSON n'ayant
pas NaN, un nombre non fini s'écrit `null` là où il peut survenir :
coordonnées d'un point libre, paramètre d'un point sur objet, valeur d'une
expression, rayon numérique d'un `C1`. Une clé
d'image est formée des 16 premiers chiffres hexadécimaux du SHA-256 de sa data
URL (même image, même clé).

### Vue `v`

Depuis le 2026-11-16, une figure peut avoir plusieurs vues (`VUES.md`),
côte à côte en colonnes, de gauche à droite : `v` est la première, `vs` les
suivantes, chacune avec les mêmes clés que `v` sauf `w` et `h` (taille de la
fenêtre, donnée par `v` seule). Chaque vue a sa largeur `cw`, rapportée à la
somme de celles des vues (écrite en fraction de la largeur de la fenêtre ;
1 par défaut), son origine `o` en pixels depuis son coin en haut à gauche,
son unité, ses réglages, et sa couleur de fond `bg` (`null` : le fond de la
figure, `bg` et `bgi` de la racine). Une figure à plusieurs vues est toujours enregistrée et montrée en
entier : ni cadrage (région), ni centrage en mode intégré. Une seule
construction pour toutes les vues ; chaque objet est dessiné dans la sienne
(style `vw`). Depuis le 2026-11-16, `3d` est propre à chaque vue : la figure
est dans l'espace (points à trois coordonnées) dès qu'une de ses vues est 3D,
sans clé de la racine ; une vue plane d'une figure de l'espace la montre de
dessus (plan z = 0, ni rotation ni sol).

Vue tableur (depuis le 2026-11-20, `TABLEUR.md`) : `"t": "s"` fait d'une
vue une colonne qui montre le classeur `wb` de la figure (DocCells, dans
une iframe) ; absente, c'est une vue graphique. Une figure a au plus une
vue tableur, qui n'a que `t` et `cw`, plus `w` et `h` si c'est `v` ; les
clés des vues graphiques (`o`, `u`, `3d`…) n'y sont ni écrites ni lues.
Aucun objet n'y est dessiné : un style `vw` ou `vws` qui la nomme rend le
fichier invalide ; un objet sans `vw` va dans la première vue graphique.
Une page dont `v` est la vue tableur et qui n'a pas de `vs` est un onglet
tableur.

Vue CAS (depuis le 2026-11-22, `CAS.md`) : `"t": "c"` fait d'une vue une
colonne qui montre des lignes de calcul formel, `l`, tableau de textes
(requis), tels que tapés : une formule de DocGeo (`Factor(x^2 - a)`), une
définition `nom := …` ou `f(x, y) := …`, `$n` désignant la ligne n
(à partir de 1) quand elle la précède. Chaque ligne est calculée par
Giac, les objets de la figure qu'elle lit écrits par leur valeur exacte
(comme la vue CAS de GeoGebra), ses autres lettres étant des variables
libres, en radians ; leurs réponses vont dans `cas`. Comme une vue
tableur, une vue CAS n'a que `t`, `l` et `cw`, plus `w` et `h` si c'est
`v`, et aucun objet n'y est dessiné (`vw` ou `vws` qui la nomme : fichier
invalide). Une page dont `v` est une vue CAS et qui n'a pas de `vs` est un
onglet CAS.
Depuis le 2026-11-22 (étape 7 de `CAS.md`) : une ligne qui n'est qu'un
texte entre guillemets (`"Calcul exact"`) est montrée comme un texte, sans
calcul ; `Numeric(e)` et `Numeric(e, n)` (n chiffres) donnent la valeur
approchée de e, `KeepInput(e)` montre e tel quel sans le calculer, comme
les modes de la vue CAS de GeoGebra. Ces deux commandes n'existent que
dans les lignes d'une vue CAS et n'agissent qu'en tête de la ligne ou de
sa définition (`v := Numeric(…)`), valant e ailleurs ; une fonction de la vue ou de la figure du même nom
garde la priorité. Les lignes restent écrites avec les noms anglais des
commandes ; le lecteur et l'éditeur les montrent dans leur langue.

`o` origine en pixels, `u` pixels par unité, `w` et `h` taille de la fenêtre
à l'enregistrement (requis). Depuis le 2026-11-14, `uy` donne les pixels par
unité le long de Oy d'une figure plane, quand ils diffèrent de `u` (axes de
GeoGebra d'échelles différentes) ; le zoom garde leur rapport. À l'ouverture, une figure plane ou 3D de DGPad
(`f2`) garde son origine à la même place dans la fenêtre (comme DGPad) ; une
autre figure 3D, à la même place par rapport au centre de la fenêtre. En mode intégré (`EMBED.md`), la région
enregistrée `w` × `h` est centrée dans la fenêtre au pixel près, en 2D comme en
3D : origine et positions en pixels (`xy` des expressions) sont décalées de
`round((largeur − w) / 2)` et `round((hauteur − h) / 2)`.

| Clé   | Contenu                               | Défaut          |
| ----- | ------------------------------------- | --------------- |
| `3d`  | figure 3D                             | 0               |
| `th`  | angle θ de la caméra                  | π/2             |
| `ph`  | angle φ de la caméra                  | 5π/2            |
| `rt`  | bornes de θ                           | [-π/2, π/2]     |
| `rp`  | bornes de φ (`null` : non bornée)     | [null, null]    |
| `pe`  | perspective                           | 0               |
| `f2`  | repère 2D d'une figure 3D (ci-après)  | `null`          |
| `fl`  | sol                                   | valeur de `3d`  |
| `ax`  | axes affichés                         | 1               |
| `gr`  | grille                                | 1               |
| `ox`  | axe Ox (`oy` : Oy, `oz` : Oz)         | 1               |
| `lx`  | Ox verrouillé (`ly` : Oy)             | 0               |
| `cz`  | zoom centré sur l'origine             | 0               |
| `lk`  | vue verrouillée (ci-après)            | 0               |
| `op`  | abscisses et ordonnées positives      | 0               |
| `c`   | couleur des axes                      | `rgb(80,80,80)` |
| `f`   | taille des graduations                | 18              |
| `s`   | épaisseur des axes                    | 2               |
| `gw`  | épaisseur de la grille                | 0.1             |
| `gd`  | distances de la grille (Ox, Oy)       | [0, 0]          |
| `gs`  | intervalles entre deux lignes         | 0               |
| `gc`  | couleur de la grille                  | `null`          |
| `gl`  | pointillés de la grille               | []              |
| `td`  | distances des graduations (Ox, Oy)    | [0, 0]          |
| `ts`  | styles des graduations (Ox, Oy)       | [0, 0]          |
| `nb`  | nombres des graduations en gras       | 0               |
| `gg`  | graduations à la manière de GeoGebra  | 0               |
| `al`  | noms des axes (Ox, Oy)                | ["", ""]        |
| `nu`  | nombres des axes affichés (Ox, Oy)    | [1, 1]          |
| `au`  | unités des nombres (Ox, Oy)           | ["", ""]        |
| `ah`  | flèches des axes                      | 0               |
| `fc`  | couleur du sol                        | `null`          |
| `fo`  | opacité du sol                        | 0.3             |
| `fd`  | écart des lignes du sol               | 1               |
| `fg`  | couleur des lignes du sol             | `null`          |
| `fw`  | épaisseur des lignes du sol           | 0.5             |
| `fe`  | demi-côté du sol                      | 8               |
| `gb`  | taille de la boîte de GeoGebra        | 1               |
| `gi`  | coin de la vue 3D de GeoGebra         | [0, 0]          |
| `gp`  | centre initial de la vue 3D           | `null`          |
| `gv`  | (lu seulement) bande de la vue à côté | `null`          |
| `cw`  | largeur de la colonne (ci-dessus)     | 1               |
| `bg`  | fond propre à la vue                  | `null`          |
| `bgi` | image de fond propre à la vue         | `null`          |
| `bgf` | disposition de cette image            | `repeat`        |

Dans une figure plane, comme dans GeoGebra : `td` est, par axe, la distance
fixe entre deux nombres, une petite graduation à mi-chemin (0 : distance
automatique de DGPad ; elle reprend aussi la main quand, à force de dézoomer,
les nombres se chevaucheraient). `ts` : 0 graduations principales et
secondaires, 1 principales seulement, 2 aucune (les nombres restent).
`gg` : graduations d'un seul côté de l'axe, vers ses nombres (3 pixels, 2 pour
une secondaire, 3 avec des axes de plus d'un pixel), aucune quand la grille est
affichée à la distance des nombres ; nombres rapprochés des axes, un 0 en bas à
gauche de l'origine ; lignes secondaires de la grille aussi épaisses que les
principales (`gw` pixels), plus pâles (opacité 60/255).

Axes d'une figure plane : `al` donne le nom écrit au bout de chaque axe, `nu`
masque ses nombres (graduations gardées), `au` l'unité écrite après eux ;
l'unité `π` place les nombres automatiques sur des multiples de π/2, écrits
`π/2`, `π`, `3π/2`… (`td` reste en unités de la figure). `ah` : 0 flèche de
DGPad, 1 aucune, 2 flèche ouverte de GeoGebra, 3 flèche pleine de GeoGebra
(un tiers de la taille des nombres, un pixel de plus par axes de plus d'un
pixel).

Grille d'une figure plane : `gd` est, par axe, la distance fixe entre deux
lignes principales (0 : celle des nombres ; elle reprend aussi la main quand, à
force de dézoomer, les lignes secondaires seraient à moins de 3 pixels), `gs`
le nombre d'intervalles entre deux lignes principales (0 : ceux des
graduations, 1 : pas de lignes secondaires), `gc` sa couleur (`null` : celle
des axes) et `gl` ses pointillés, en pixels comme `dh`.

Axes de GeoGebra d'une figure 3D (`gg`, depuis le 2026-11-15) : au lieu du
trièdre, trois axes rouge, vert et bleu, chacun d'une face à l'autre de la
boîte de découpe de GeoGebra, une flèche au bout, une graduation et un nombre
à chaque multiple de sa distance (`td`, sinon automatique), les nombres d'un
côté, le nom de l'autre, au-delà de la flèche. `td`, `ts`, `al`, `nu` et `au`
y ont une troisième valeur, celle de Oz (lus d'une paire, Oz garde son
défaut) ; `oz` affiche Oz. La boîte : centrée sur le point de l'espace au
centre de la vue 3D, à la profondeur de `gp`, point au centre de la vue
quand la figure s'ouvre (`null` : à celle de l'origine, le plus proche de
l'origine sur la droite de visée). Avec `gp`, comme dans GeoGebra, la vue
tourne autour du centre de la boîte, qui reste au centre de la vue (depuis le
2026-11-15). La boîte est
aussi large que cette vue le long de Ox et de Oy, aussi haute le long de Oz,
le tout réduit par sa taille `gb` (0 petite, 1 moyenne, 2 grande : facteur
1/√3, 1/√2, 1). La vue 3D est la fenêtre privée de `gi` pixels à gauche et en
haut (vue graphique de GeoGebra à côté), depuis le 2026-11-15 ; depuis le
2026-11-16, l'import ne l'écrit plus que pour un graphique au-dessus de la
vue 3D ou en dessous, celui de gauche ou de droite devenant une vue plane
(`VUES.md`). Cette vue est
peinte par le motif de fond (`bgi`) : une image SVG d'un rectangle de sa
couleur, de `gi` pixels de large (ou de haut) et 8 de haut (ou de large),
en mosaïque verticale (ou horizontale). Écrite un temps sous la forme de sa
seule couleur `gv` (`null` : aucune bande), qui n'est plus écrite et, lue sans
`bgi`, donne ce motif. Les plans (`Pl`…) s'y dessinent par
leur section de la boîte (leur carré, qui repère leurs points, est inchangé).

Sol d'une figure 3D (plan z = 0, carré centré sur l'origine, en unités de la
figure) : `fc` sa couleur (`null` : bleu vu de dessus, brun vu de dessous, comme
DGPad), `fo` l'opacité de son remplissage, `fd` l'écart de ses lignes,
parallèles aux axes et passant par l'origine (0 : aucune), `fg` leur couleur
(`null` : celle du sol, à demi transparente ; une couleur choisie est opaque),
`fw` leur épaisseur en pixels, `fe` son demi-côté. `ax` et `fl` sont
indépendants : le trièdre et le sol se montrent séparément.

`bgi`, `bgf` d'une vue (depuis le 2026-11-16) : son image de fond, clé
dans `img` de la racine, peinte par-dessus sa couleur (`bg`, sinon celle de
la figure), disposée comme le motif de la figure (`bgf` de la racine). Une
vue qui n'a ni couleur ni image propre montre le fond de la figure (`bg` et
`bgi` de la racine) ; une vue de couleur propre sans image n'en montre pas.

`lk` (depuis le 2026-11-16) : la vue ne se déplace, ne se zoome ni ne tourne
par aucun geste (souris, molette, doigts) ; les scripts la changent encore
(`CenterView`, `SetViewDirection`…).

`f2` : coordonnées, dans le repère 2D d'une figure 3D de DGPad, de son origine
3D. Ses objets 2D (points libres, points de formule à deux coordonnées, axes,
et ce qui n'est construit qu'à partir d'eux et de l'origine 3D) restent fixes
à l'écran quand la vue tourne, comme dans DGPad : ils sont dans le plan passant
par l'origine 3D face à la caméra, rapporté à ce repère (unités de la vue, axes
vers la droite et le haut de l'écran). Une formule lit leurs coordonnées 2D
(mais `[0, 0, 0]` pour l'origine 3D), et leurs cercles sont dans ce plan. Les
points libres y sont punaisés (`fl`), `Pt` donnant leurs coordonnées 2D. Sans
`f2`, un point de formule à deux coordonnées d'une figure 3D est à z = 0.

### Objets

Un indice désigne un objet antérieur du tableau `o`. Les noms sont uniques ;
un fichier qui répète un nom est refusé.

Depuis le 2026-10-21, une référence peut aussi être `["side", polygone, k]`
ou `["vertex", polygone, k]` : le côté ou le sommet numéro k, à partir de 1,
dans l'ordre des sommets du polygone (qui doit précéder l'objet et ne pas être
un plan). Le dernier côté rejoint le premier sommet. Ces références ne créent
aucune entrée dans `o` ; leurs utilisateurs dépendent directement du polygone.
Un rang absent rend la référence indéfinie ; elle redevient définie si ce rang
existe de nouveau. Une section numérote les sommets de son contour défini.
Le rang est conservé quand le polygone est redéfini.

Depuis le 2026-11-06, une référence peut aussi être `["face", polyèdre, k]` :
la face numéro k, à partir de 1, dans l'ordre des faces du polyèdre (note 21),
aux mêmes règles. Elle est un polygone sur les sommets de cette face. Une
référence n'a pas elle-même de parties : ni `["side", ["face", …], k]`, ni
`["vertex", ["face", …], k]`.

Depuis le 2026-11-11, une référence à un point peut aussi être
`["Fp", formule]` : un point écrit dans la définition de l'objet, comme
`(0, 7)` dans `Droite((0, 7), (1, 7))`, défini par sa formule comme un `Fp`
(sans les nombres que déplace un glisser). Il ne crée aucune entrée dans
`o` ; l'objet qui le prend dépend directement des objets que lit sa formule.
Il est fixe : un objet qui en prend un ne se glisse pas.

Depuis le 2026-11-12, une référence à une liste peut de même être
`["Fl", formule]` : une liste écrite dans la définition de l'objet, comme
`Élément(c, 1)` dans `Polygone(Élément(c, 1))`, définie par sa formule
comme un `Fl` (note 30).

Depuis le 2026-11-16, une référence peut être tout objet écrit dans la
définition de l'objet, comme `Droite(A, B)` dans
`Intersection(Droite(A, B), Cercle(O, 2))` : son entrée sans nom ni style,
`[type, paramètres]`, par exemple `["Line", [0, 3]]`, ses propres
références pouvant l'être à leur tour (`["Line", [["Mid", [0, 1]], 2]]`).
`Fp` et `Fl` gardent leur forme `[type, formule]` ci-dessus. Comme eux, il
ne crée aucune entrée dans `o`, n'est jamais dessiné, et l'objet qui le
prend dépend directement de ce qu'il lit. Ses parties ne se désignent pas :
ni `["side", ["Poly", …], k]`, ni le point d'une liste écrite ainsi. Sont
exclus les types que l'on déplace, édite, montre ou applique pour
eux-mêmes : `Pt`, `VecF`, `On`, `Ex`, `Txt`, `Html`, `Img`, `Btn`, `Evt`,
`Mac`, `Out`. Un tableau de deux éléments dont le second n'est pas un objet
JSON n'est donc jamais une formule `[texte, {nom: indice}]`, ce qui
distingue, dans `Tra`, un vecteur écrit dans la définition d'une formule.

`Mid` et `Med` acceptent aussi `[segment]`, notamment une référence de côté :
le calcul suit les deux extrémités actuelles de ce segment, y compris lorsque
le nombre de côtés du polygone change. Les anciennes formes `[A, B]` gardent
leur sens.

Une **formule** est son texte, ou `[texte, {nom: indice}]` quand elle lit
d'autres objets : chaque nom qu'elle emploie y est associé à l'objet qu'il
désigne. Ce nom est propre à la formule et peut différer du nom affiché de
l'objet (une étiquette GeoGebra comme `A_{1}` n'est pas un identifiant).
Un nom y peut contenir des primes (`A'`), et s'écrire entre accents graves
s'il n'est pas un identifiant (`` `A 1` ``), comme l'écrit l'éditeur.
Comme dans DGPad, un objet nommé vaut : ses coordonnées (point), sa valeur
(expression), sa longueur (segment), ses composantes (vecteur), son rayon
(cercle, arc), sa mesure dans l'unité d'angle de la figure (angle, angle
fixe), son aire (polygone), ses points (liste de nature `point`, `Lst` ou
`Seq`, en listes de listes pour des boucles imbriquées) ; tout autre objet
est indéfini. Dans une figure
3D, un point y a ses trois coordonnées, dans toute formule (sauf les objets
2D d'une figure à `f2`). Une expression
de fonction (`"f"`) ou une courbe (`Cur`) s'appelle par son nom : `f(2)`, et
sa dérivée par rapport à l'une de ses variables, comme dans DGPad, par
`f.dx(…)`, `f.dy(…)`, `f.dz(…)` ou `f.dt(…)`, ou par rapport à sa première
variable, comme dans GeoGebra, par `f'(…)` (`f''(…)` pour la dérivée
seconde), sauf si un objet s'appelle `f'`. Un nombre suivi de `°` est un
angle en degrés, converti dans l'unité d'angle de la figure (`cos(60°)`
vaut 0,5 en degrés comme en radians). `rotate(P, O, a)` est l'image du
point P par la rotation de centre O et d'angle a (dans l'unité d'angle de
la figure, autour de la verticale de O dans l'espace, sa hauteur gardée),
`dilate(P, O, k)` son image par l'homothétie de centre O et de rapport k.
Une surface (`Surf`) s'appelle par son nom comme une fonction de x et y :
`g(1, 2)`. `meet(P, Q, s, n)` est le n-ième point (1 ou 2) où le segment
[PQ] rencontre le cylindre, le cône, la sphère ou la surface s, les points
triés de P vers Q, indéfini hors du segment, comme `Intersect(Segment(P,
Q), s, n)` de GeoGebra (2026-11-17).
Commandes de calcul formel (depuis le 2026-11-22, `CAS.md`), calculées
par Giac, avec les noms anglais de GeoGebra (traduits dans l'éditeur),
sauf si un objet porte ce nom : `Derivative(e)`, `Derivative(e, v)`,
`Derivative(e, n)`, `Derivative(e, v, n)` (dérivée n-ième, n entier écrit),
`Integral(e)`, `Integral(e, v)` (primitive), `Factor(e)` (sur les
rationnels), `IFactor(e)` (sur les radicaux, depuis le 2026-11-22, étape
4), `Expand(e)`, `Simplify(e)`, `Solve(e)`, `Solve(e, v)` (e une équation
`g = d` ou une expression nulle ; la liste triée des solutions réelles),
`CSolve(e)`, `CSolve(e, v)` (des solutions complexes, étape 4). v est
l'une des variables x, y, z, t, par défaut la première que lit e (x
sinon) ; elle est liée dans `Solve` et `CSolve`. Dans e, un objet est un symbole pour Giac (un
curseur déplacé ne change pas la requête), une expression de fonction ou
une courbe appelée est remplacée par sa formule, et une partie sans
variable que Giac ne lit pas (`d(A, B)`) est un symbole aussi ; une partie
qui lit une variable et que Giac ne lit pas rend la commande indéfinie.
Les nombres sont envoyés exacts (0,1 est 1/10). La valeur est la réponse
de Giac, relue comme une formule et évaluée avec les valeurs du moment ;
indéfinie tant qu'elle n'est pas arrivée, ou si la grammaire des formules
ne la lit pas (`erf`). Sans réponse de Giac (absent, pas encore arrivée,
ou partie que Giac ne lit pas), `Derivative` est la dérivée symbolique de
DocGeo (`dgp_derivative.ts`), de même valeur. Une expression dont la
formule est une seule commande montre la réponse de Giac plutôt que sa
formule.
Depuis le 2026-11-22 (étape 9) : `Sum(e, k, a, b)` (somme de e pour k
entier de a à b, développée), `Limit(e, a)`, `Limit(e, v, a)` (a pouvant
être `∞`, écrit aussi `Infinity`), `Integral(e, a, b)`, `Integral(e, v,
a, b)` (intégrale définie, exacte) et `TaylorPolynomial(e, a, n)`,
`TaylorPolynomial(e, v, a, n)` (polynôme de Taylor d'ordre n en a). L'indice
de `Sum` et la variable de `Limit` et de l'intégrale définie sont liés : un
nom quelconque, même celui d'un objet, qu'ils ne lisent pas. L'ordre n
d'un polynôme de Taylor est envoyé par sa valeur, un entier positif ou nul
(sinon indéfini) : un curseur change la requête. Une ligne entière
`Integral(f, a, b)`, f nommée, reste l'objet `Itg` (aire tracée) de
l'éditeur.
`mean(l)`, `median(l)`, `q1(l)`, `q3(l)`, `sd(l)` et `sampleSD(l)` sont la
moyenne, la médiane, les quartiles et les écarts types (de la population,
d'un échantillon) d'une liste de nombres, comme `Mean`, `Median`, `Q1`,
`Q3`, `SD`, `SampleSD` de GeoGebra : les quartiles sont les médianes des
valeurs sous et au-dessus de la médiane, qu'aucune n'inclut, indéfinis
pour une seule valeur (2026-11-17).

| Type    | Objet                                                                       | Paramètres                                               |
| ------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| `Pt`    | point libre                                                                 | `[x, y]` ou `[x, y, z]`                                  |
| `Fix`   | point fixe                                                                  | idem                                                     |
| `Fp`    | point défini par une formule                                                | `[formule]`, `[formule, n1, n2]` (1)                     |
| `On`    | point sur objet                                                             | `[support, paramètre]` (2)                               |
| `Mid`   | milieu                                                                      | `[A, B]`                                                 |
| `Sym`   | symétrique de P par rapport à O                                             | `[O, P]` (28)                                            |
| `Refl`  | symétrique de P par rapport à d                                             | `[d, P]` (28)                                            |
| `Rot`   | P tourné autour de O                                                        | `[O, P, a]`, `[O, P, a, d]` (15, 28)                     |
| `Dil`   | image de P par l'homothétie (O, k)                                          | `[O, P, k]` (15, 28)                                     |
| `Tra`   | P translaté du vecteur u                                                    | `[u, P]` (15, 28)                                        |
| `Inv`   | inverse de P dans le cercle c                                               | `[c, P]` (28)                                            |
| `TC`    | centre du triangle ABC                                                      | `[A, B, C, n]` (18)                                      |
| `Vtx`   | sommet k d'un polygone ou polyèdre P                                        | `[P, k]`, `[P, k, 1]` (18)                               |
| `Ctr`   | centre d'un cercle                                                          | `[cercle]`                                               |
| `DirP`  | P + vecteur directeur unitaire de d                                         | `[d, P]`                                                 |
| `CnP`   | centre, foyer, sommet, point de directrice ou excentricité d'une conique    | `[conique, "C"…"F1"…"e"]` (voir `conic_point_object.ts`) |
| `PlI`   | intersection droite-plan ou polygone                                        | `[d, plan]` (19)                                         |
| `Int`   | intersection                                                                | `[o1, o2, branche]`, `[o1, o2, rang, P]` (3)             |
| `CyI`   | intersection droite-solide                                                  | `[d, solide, 0 ou 1]` (4)                                |
| `Line`  | droite (AB)                                                                 | `[A, B]`                                                 |
| `Ray`   | demi-droite [AB)                                                            | `[A, B]`                                                 |
| `Seg`   | segment                                                                     | `[A, B]`                                                 |
| `Vec`   | vecteur                                                                     | `[A, B]`                                                 |
| `VecF`  | vecteur libre, tracé depuis l'origine                                       | `[x, y]` ou `[x, y, z]`                                  |
| `Par`   | parallèle à d par P                                                         | `[d, P]`                                                 |
| `Perp`  | perpendiculaire à d par P                                                   | `[d, P]`                                                 |
| `Med`   | médiatrice                                                                  | `[A, B]`                                                 |
| `EqL`   | droite d'équation g = d                                                     | `[g, d]` (14)                                            |
| `Tan`   | tangente par P                                                              | `[P, conique, n]`, `[P, courbe]` (17)                    |
| `TanX`  | tangente à la courbe d'une fonction, à une abscisse                         | `[x ou formule, courbe]` (17)                            |
| `Bis`   | bissectrice de l'angle AOB                                                  | `[A, O, B]`                                              |
| `FA`    | angle fixe : demi-droite [OA) tournée                                       | `[A, O, degrés ou formule, sens trigo]` (10)             |
| `Ang`   | angle AOB                                                                   | `[A, O, B]`                                              |
| `Cir`   | cercle de centre O passant par A                                            | `[O, A]`                                                 |
| `C1`    | cercle de centre O et de rayon r                                            | `[O, r]`, `[O, r, axe]` (5)                              |
| `CAx`   | cercle d'axe d passant par P                                                | `[d, P]`                                                 |
| `C3`    | cercle de centre O et de rayon AB                                           | `[A, B, O]`                                              |
| `C3p`   | cercle passant par trois points                                             | `[A, B, C]`                                              |
| `C3s`   | idem, dans leur plan de l'espace                                            | `[A, B, C]`                                              |
| `Arc`   | arc de A à C passant par B                                                  | `[A, B, C]`                                              |
| `Sec`   | secteur de A à C passant par B                                              | `[A, B, C]`                                              |
| `Arcs`  | arc de A à C par B, dans leur plan                                          | `[A, B, C]` (26)                                         |
| `Secs`  | secteur, idem                                                               | `[A, B, C]` (26)                                         |
| `CArc`  | arc de centre M, de A à [MB)                                                | `[M, A, B]`, `[M, A, B, 1]` (16)                         |
| `CSec`  | secteur de centre M, de A à [MB)                                            | idem                                                     |
| `CArcs` | arc de centre M, de A à [MB), espace                                        | `[M, A, B]` (26)                                         |
| `CSecs` | secteur, idem                                                               | `[M, A, B]` (26)                                         |
| `Semi`  | demi-cercle de diamètre [AB]                                                | `[A, B]` (16), `[A, B, plan]` (32)                       |
| `EqC`   | cercle d'équation g = d                                                     | `[g, d]` (14)                                            |
| `Quad`  | conique passant par cinq points                                             | `[A, B, C, D, E]`                                        |
| `Ell`   | ellipse de foyers F, G passant par P                                        | `[F, G, P]`                                              |
| `Ell1`  | ellipse de foyers F, G et demi-axe a                                        | `[F, G, a]` (5)                                          |
| `Hyp`   | hyperbole de foyers F, G passant par P                                      | `[F, G, P]`                                              |
| `Hyp1`  | hyperbole de foyers F, G et demi-axe a                                      | `[F, G, a]` (5)                                          |
| `Prb`   | parabole de foyer F, de directrice d                                        | `[F, d]`                                                 |
| `EqQ`   | conique d'équation g = d                                                    | `[g, d]` (14)                                            |
| `QArc`  | arc du cercle ou de l'ellipse c, P à Q                                      | `[c, P, Q]` (27)                                         |
| `QSec`  | secteur, idem                                                               | `[c, P, Q]` (27)                                         |
| `Sph`   | sphère de centre O passant par A                                            | `[O, A]`                                                 |
| `Sph1`  | sphère de centre O et de rayon r                                            | `[O, r]` (5)                                             |
| `Cyl`   | cylindre d'axe AB et de rayon r                                             | `[A, B, r]` (4, 5)                                       |
| `Cone`  | cône de base de centre A, de sommet B                                       | `[A, B, r]` (4, 5)                                       |
| `Disk`  | disque d'un cylindre ou d'un cône                                           | `[solide, 0 ou 1]` (4)                                   |
| `Cube`  | cube sur le carré ABCD du plan ABC                                          | `[A, B, C]` (21)                                         |
| `CubP`  | cube sur AB parallèle à un plan                                             | `[A, B, plan ou polygone, ±1]` (20, 21)                  |
| `CubZ`  | cube sur AB, carré ABCD horizontal                                          | `[A, B, ±1]` (20, 21)                                    |
| `Tetr`  | tétraèdre régulier sur la face ABC du plan ABC (35)                         | `[A, B, C]` (21)                                         |
| `TetP`  | tétraèdre sur AB parallèle à un plan (35)                                   | `[A, B, plan ou polygone, ±1]` (20, 21)                  |
| `TetZ`  | tétraèdre sur AB, face horizontale (35)                                     | `[A, B, ±1]` (20, 21)                                    |
| `Octa`  | octaèdre régulier sur la face ABC du plan ABC (35)                          | `[A, B, C]` (21)                                         |
| `OctP`  | octaèdre sur AB parallèle à un plan (35)                                    | `[A, B, plan ou polygone, ±1]` (20, 21)                  |
| `OctZ`  | octaèdre sur AB, face horizontale (35)                                      | `[A, B, ±1]` (20, 21)                                    |
| `Dode`  | dodécaèdre régulier sur la face ABCDE du plan ABC (35)                      | `[A, B, C]` (21)                                         |
| `DodP`  | dodécaèdre sur AB parallèle à un plan (35)                                  | `[A, B, plan ou polygone, ±1]` (20, 21)                  |
| `DodZ`  | dodécaèdre sur AB, face horizontale (35)                                    | `[A, B, ±1]` (20, 21)                                    |
| `Icos`  | icosaèdre régulier sur la face ABC du plan ABC (35)                         | `[A, B, C]` (21)                                         |
| `IcoP`  | icosaèdre sur AB parallèle à un plan (35)                                   | `[A, B, plan ou polygone, ±1]` (20, 21)                  |
| `IcoZ`  | icosaèdre sur AB, face horizontale (35)                                     | `[A, B, ±1]` (20, 21)                                    |
| `Prsm`  | prisme sur un polygone, jusqu'à P                                           | `[polygone, P]` (21)                                     |
| `Pyr`   | pyramide sur un polygone, de sommet S                                       | `[polygone, S]` (21)                                     |
| `PrsH`  | prisme sur un polygone, de hauteur h (31)                                   | `[polygone, h]`                                          |
| `PyrH`  | pyramide sur un polygone, de hauteur h (31)                                 | `[polygone, h]`                                          |
| `Pl`    | plan passant par A, B et C                                                  | `[A, B, C]` (19)                                         |
| `PlP`   | plan par A parallèle à un plan                                              | `[A, plan]` (19)                                         |
| `PlL`   | plan par A contenant d                                                      | `[A, d]` (19)                                            |
| `PlO`   | plan par A orthogonal à d                                                   | `[A, d]` (19)                                            |
| `PlE`   | plan d'équation g = d                                                       | `[g, d]` (14, 19)                                        |
| `PlPl`  | intersection de deux plans                                                  | `[plan, plan]` (19)                                      |
| `Nrm`   | droite par P orthogonale à un plan                                          | `[plan, P]`                                              |
| `SphC`  | section d'une sphère                                                        | `[sphère, plan ou sphère]` (19)                          |
| `PlS`   | section d'un polyèdre par un plan                                           | `[plan, A1, B1, …]`, `[plan, polyèdre]` (19)             |
| `CubV`  | sommet de cube                                                              | `[A, B, C ou plan, k]` (20)                              |
| `Abv`   | point au-dessus d'un polygone                                               | `[polygone, h, k]` (20)                                  |
| `NetV`  | sommet du patron d'un polyèdre                                              | `[P, f, O1, E1, C1, Q1, …]` (20)                         |
| `Net`   | patron d'un polyèdre, déplié de f                                           | `[polyèdre, f]` (5, 21)                                  |
| `CyS`   | section d'un cylindre ou d'un cône                                          | `[solide, plan]` (4)                                     |
| `Poly`  | polygone                                                                    | `[A, B, C, …]`                                           |
| `PolyL` | polygone sur les points d'une liste, autant qu'elle en a                    | `[liste]` (29)                                           |
| `RegP`  | polygone régulier de n côtés sur [AB]                                       | `[A, B, n]`, `[A, B, n, plan]` (18)                      |
| `Loc`   | lieu de P quand M (sur objet ou curseur, 34) varie ; P droite : l'enveloppe | `[P, M]`                                                 |
| `Ex`    | expression                                                                  | objet (6)                                                |
| `Cur`   | courbe y = f(x)                                                             | `[formule, min, max]` (23)                               |
| `Reg`   | région du plan où une formule de x et y est vraie (33)                      | `formule`                                                |
| `Surf`  | surface z = f(x, y), f une formule de x et y (34)                           | `[formule, taille]`                                      |
| `Box`   | boîte à moustaches d'une liste autour de y, de hauteur 2s (36)              | `[y, s, liste]`, trois formules                          |
| `Itg`   | intégrale d'une fonction de a à b, sa région entre courbe et axe (37)       | `[courbe, a, b]`                                         |
| `LSum`  | somme inférieure d'une fonction de a à b sur n intervalles (37)             | `[courbe, a, b, n]`                                      |
| `USum`  | somme supérieure d'une fonction de a à b sur n intervalles (37)             | `[courbe, a, b, n]`                                      |
| `Lst`   | liste de formules en k                                                      | `[nature, nombre, formule, formule?]` (7)                |
| `Seq`   | suite (`Sequence` de GeoGebra)                                              | `[nature, [boucle, …], formule, …]` (22)                 |
| `ItL`   | s, f(s), f(f(s))… : `IterationList` de GeoGebra (38)                        | `[z, f, s, n]`, f formule de z                           |
| `ELst`  | points d'une expression                                                     | `[expression]` (12)                                      |
| `Pts`   | liste de points `{A, (1, 2), …}` de GeoGebra                                | `[formule, …]` (29, 30)                                  |
| `Fl`    | liste donnée par une formule, comme `Élément(c, 1)` d'une liste de listes   | `[formule]` (30)                                         |
| `Itr`   | itération de segments                                                       | `[[P1, Q1, …], niveaux, [[ax,ay,bx,by], …]]`             |
| `Txt`   | texte attaché à un point                                                    | `[point, [dx, dy], texte]` (8)                           |
| `Img`   | image                                                                       | `[clé, largeur, hauteur, A, B?, C?]` (9)                 |
| `Html`  | texte HTML dans un cadre de la fenêtre                                      | `[[x, y, largeur, hauteur], rayon, texte]` (11)          |
| `Btn`   | bouton qui exécute un script                                                | objet (13)                                               |
| `Evt`   | script lancé par une `Ex`, un point, un texte ou une forme                  | `{"on": expression ou point, "s": script}` (24)          |
| `Mac`   | application d'une macro-construction                                        | `[macro, méthode, initiaux, branches?]` (25)             |
| `Out`   | final de rang k d'une application                                           | `[application, k]` (25)                                  |

1. La formule peut être un script, dont la dernière instruction donne les
   coordonnées (`"var u=A[0]-B[0];[u,0]"`). `n1`, `n2` : les nombres
   (expressions, ou `null`) que déplace un glisser du point, pour chacune de
   ses coordonnées. Depuis le 2026-11-15, `[formule, P]` : un glisser du
   point, ou un script qui le place, place le point libre `P` là où il va
   (`DynamicCoordinates` de GeoGebra), la formule lisant `P`.
2. Droite (AB), segment, demi-droite : `t` tel que M = A + t·AB. Autre
   droite, définie par un point P et une direction : distance signée à P, en
   unités, le long de son vecteur directeur. Cercle : angle. Polygone,
   conique : couple. Sphère, cylindre, cône : triplet. Lieu, liste, courbe :
   leur paramètre. Le couple d'une conique : coordonnées, dans le repère
   affine de trois points, du point ensuite projeté sur elle. Ces points sont ses trois premiers pour `Quad` ;
   le centre et les extrémités des deux demi-axes pour une ellipse ou une
   hyperbole ; pour une parabole, le sommet et les points à la distance p du
   foyer à la directrice, le long de celle-ci puis vers le foyer. Le triplet
   d'une sphère : la direction du point depuis son centre, un vecteur que la
   lecture normalise. D'un cylindre ou d'un cône `[x, y, h]` : le point est sur
   son côté (jamais sur ses disques), dans la direction (x, y), normalisée,
   autour de son axe, dans le repère (U, V) de ses disques (U = (−sin θ,
   cos θ, 0), θ = atan2(y, x) de AB, V = AB/|AB| ∧ U), à la fraction h ∈ [0, 1]
   de sa hauteur depuis A. Un point sur une surface ne peut pas mener un lieu
   (lieu vide).
3. Deux solutions au plus (droite-cercle, cercle-cercle, droite-conique) :
   0 ou 1, droite-cercle dans l'ordre A + (t₀ + h)·u puis A + (t₀ − h)·u,
   droite-conique par paramètre croissant le long de la droite, cercle-cercle
   la solution à gauche puis à droite de O₁O₂ vue de la normale du premier.
   Le vecteur directeur d'une perpendiculaire (`Perp`) est, comme dans
   DGPad, celui de d tourné d'un quart de tour direct dans leur plan.
   Davantage (cercle-conique, conique-conique, avec une courbe ou un lieu) :
   rang de la solution par angle croissant autour du centre de gravité de
   toutes les solutions. Avec un point P : rang par distance décroissante à
   P. Une courbe (`Cur`) ou un lieu (`Loc`) coupe une droite, un cercle, une
   courbe ou un lieu ; le lieu par sa ligne brisée. Le rang n'est alors pas
   limité à 3.
4. Solide : cylindre, cône, sphère ou surface (`Surf`) ; l'intersection avec une droite
   prolonge la paroi du cylindre ou du cône au-delà de ses disques, comme
   GeoGebra, ses solutions triées le long de la droite. Un cylindre ou un
   cône se dessine par sa silhouette, ombrée le long de ses génératrices,
   et cache ce qui est derrière lui comme ses faces le feraient. Ses
   disques sont celui de A (0) et celui de B (1, cylindre seulement), leur
   bord en pointillé là où le solide le cache. La section d'un cylindre
   ou d'un cône par un plan ne garde que la partie entre ses disques (une
   conique pour le cône), un point par génératrice. D'une épaisseur de
   trait non nulle, le cylindre ou le cône trace lui-même le bord de ses
   disques et les génératrices de sa silhouette (l'import de GeoGebra lui
   donne une épaisseur nulle : ses disques le font).
5. `r` nombre (rayon qu'un glisser change, `null` s'il n'est pas fini) ou
   formule ; `axe` : droite normale au plan du cercle, ou plan parallèle
   au sien. `a`, demi-grand axe
   d'une ellipse, demi-axe transverse d'une hyperbole : nombre ou formule,
   comme `r`, sans glisser.
6. `{"t": texte, "mn": min, "mx": max, …}` (bornes nombres, ou formules
   toutes deux quand l'une lit d'autres objets) avec exactement l'un de `"v"`
   (valeur constante ou de curseur ; un texte constant, sans formule, en
   est une), `"f"` (formule de fonction en x, y, z, t)
   ou `"s"` (script) ; position `"xy": [x, y]` en pixels, ou attachée à un
   point : `"on": point, "d": [dx, dy]`. Un script peut, par
   `SET_EXP("E", valeur)`, changer la valeur d'une `Ex` de valeur constante
   ou placer un point libre (`[x, y]` ou `[x, y, z]`), recalculés après
   lui, comme DGPad. Un objet qu'il met en forme sans que sa formule le
   désigne (déclaré après lui, comme la liste qui le dessine) n'est pas mis
   en forme : son style l'est déjà. `"g": nom` fait de l'`Ex` (de valeur
   `"v"`, nombre, texte ou liste) une globale Blockly de DGPad, partagée par
   les scripts : `GLOBAL_GET("nom")` la lit, `GLOBAL_SET("nom", valeur)` et
   `GLOBAL_INC("nom", pas)` la changent comme `SET_EXP` ; la formule associe
   la globale au nom `GLOBAL nom`.
   `"mu": [choix…]` (liste non vide de textes) fait de l'`Ex` de valeur
   constante un menu déroulant de ces choix, sa valeur étant le numéro du
   choix, à partir de 1 ; le style `iB`, sur une `Ex` sans formule, en fait un
   champ de saisie de sa propre valeur, sur une `Ex` dont la formule ne lit
   qu'un nombre ou une courbe `Cur`, celui de ce nombre ou de cette fonction.
   L'`Ex` vaut alors le texte de la formule de la courbe ; une formule tapée,
   en notation de GeoGebra (`x²`, `ln`, `e`, `pi`, `f(x) =` en tête), qui ne
   lit que `x` et des objets déclarés avant la courbe, la redéfinit, comme
   dans GeoGebra (choix de l'auteur du projet) ; une autre est refusée. Le
   texte `"t"` de l'un et de l'autre, s'il n'est pas vide, est un label placé
   avant eux, comme celui, placé après, d'une case à cocher : `"xy"` est alors
   le coin supérieur gauche de ce label.
7. Nature `point`, `segment`, `line`, `label`, `polygon` (région remplie
   bordée par les points, pris dans l'ordre), `polygons` (chaque suite de
   points définis borne une région, un point indéfini les séparant) ou
   `circle` (centre, puis rayon, dans le plan xOy) ; une seule formule pour
   `point`, `polygon` et `polygons`. `k` et `count` y
   sont l'indice et le nombre d'éléments ; dans une figure 3D, les points y
   ont leurs trois coordonnées, comme dans les autres formules.
8. Texte dont les parties `%formule%` affichent leur valeur, `%%` étant un
   `%`.
9. Coins inférieur gauche et inférieur droit, et supérieur gauche (sinon la
   hauteur garde les proportions). Avec le seul coin inférieur gauche,
   l'image garde sa taille en pixels ; à la place des coins, `[x, y]`, sa
   position en pixels dans la fenêtre (coin supérieur gauche), à taille en
   pixels.
10. Une formule donne l'angle dans l'unité d'angle de la figure.
11. Le texte de DGPad, dont seuls sont gardés une liste fermée d'éléments,
    d'attributs et de styles (`src/objects/panel_object.ts`) : un texte qui
    contient un script, ou un élément inconnu, est refusé (l'import `.dgp`
    retire d'abord les attributs d'événement, `onclick`…, de ses éléments). Ses parties
    `%formule%` affichent leur valeur (`%%` est un `%`), ses parties `$TeX$`
    sont dessinées par KaTeX ; un champ `target="E"` change le nombre de
    l'expression `E` (état élève de `E`) ; un menu `populate="L"` prend ses
    options dans la liste de l'expression `L`, chacune `[valeur, légende]` ou
    une valeur qui est sa propre légende (une légende entre apostrophes
    s'affiche sans elles). Position et taille intérieure en
    pixels ; couleur (`c`) du cadre, couleur (`fc`) du fond, opacité (`o`) des
    deux, taille (`s`) du cadre,
    précision (`p`) des valeurs.
12. Les points (2 ou 3 nombres, un point indéfini coupant le tracé) sont
    entrecoupés d'instructions de dessin de 4 nombres ou plus, celles de la
    tortue Blockly de DGPad (fonctions `TURTLE_…` des scripts) :
    `[0, r, g, b]` dégradé depuis la couleur précédente, `[1, r, g, b]`
    couleur, `[2, 0, 0, n]` couleur n de la palette 7×10 de DGPad,
    `[3, 0, 0, i]` couleur suivante de i, `[4, 0, 0, op]` remplissage à
    op % de la région fermée par le dernier point, `[10, 0, 0, t]` et
    `[11, 0, 0, i]` taille du crayon, `[12, 0, 0, t]` et `[13, 0, 0, i]`
    rayon des points, `[20, 0, texte, u]` texte (parties `$$TeX$$`) écrit au
    dernier point dans la direction `u`, `[21, 0, 0, [police, taille, style,
alignement]]` police, `[30, url, l, h, zoom, opacité, u]` image (largeur
    négative : taille naturelle). Les couleurs et tailles s'appliquent aux
    points qui suivent. `TURTLE_GET("A", n)` et `TURTLE_LENGTH("A")` lisent
    les points de la liste (`ELst`) qui dessine la tortue `"A"`, celle du
    `TURTLE_INIT("A", …)` de son script : la formule associe cette liste au
    nom `blk_turtle_list_A` (celui que lui donne DGPad), quel que soit son
    nom à elle.
13. `{"t": légende, "s": script, "xy": [x, y]}` : bouton « lecture » de DGPad
    (`BlocklyButton`), légendé à sa gauche, dont `xy` est le bord droit à
    mi-hauteur, en pixels. Un clic exécute le script, qui ne fait que mettre
    en forme des objets et, par `SET_EXP("E", valeur)` ou une globale (6),
    changer la valeur d'une `Ex` de valeur constante, comme une manipulation
    (état élève de `E`), et afficher un message (`ALERT(texte)`, dont seul
    le texte est gardé, pas le HTML). `WAIT(ms)`, instruction du programme
    ou d'une fonction qu'il appelle comme instruction, l'interrompt ms
    millisecondes, la figure redessinée, puis il reprend (ailleurs, dans
    une expression ou un programme d'un autre objet, il n'attend pas) ; un
    nouveau clic arrête le lancement en cours. `ASK(question)`, aux mêmes
    endroits, l'interrompt de même jusqu'à la réponse saisie, que lit
    ensuite `ANSWER()` (nombre si elle se lit comme tel, virgule décimale
    acceptée, texte sinon ; `""` avant toute question) : la réponse est
    propre à chaque lancement. Depuis le 2026-11-15, pour les scripts de
    GeoGebra (`SetViewDirection`, `SetVisibleInView` d'un axe) :
    `VIEW_DIRECTION([x, y, z])` tourne la vue 3D en une seconde, comme
    GeoGebra, pour regarder le long de ce vecteur, du côté le plus proche de
    la caméra (de l'autre si elle y regarde déjà ; de dessus, Ox vers la
    droite), et `SHOW_AXIS(n, b)` montre (b ≠ 0) ou cache l'axe n (0 Ox, 1 Oy,
    2 Oz). Ni la vue ni les axes ne font partie de l'état élève. Sans `"s"`,
    il ne fait rien.
14. `g` et `d` : formules en x et y des deux membres de l'équation, de degré
    1 pour une droite, 2 au plus pour une conique, recalculés à chaque
    mouvement. Un cercle a le même coefficient en x² et en y², sans xy ; une
    conique est une ellipse, une hyperbole ou une parabole selon ses
    coefficients du moment. Le point P d'une droite (2) est son point le
    plus proche de l'origine, son vecteur directeur (b, −a) pour
    l'équation ax + by + c = 0.
15. `O` : centre, `null` pour l'origine. `a` (angle, dans l'unité d'angle de
    la figure) et `k` (rapport) : nombre ou formule, comme `r` (5), sans
    glisser. La rotation garde la hauteur de P (axe vertical par O) ; avec
    une droite `d`, elle tourne autour de d, ou de sa parallèle par O, dans
    le sens direct autour de son vecteur directeur. `u` : un vecteur
    (`Vec`, `VecF`), un point (son vecteur position) ou une formule dont la valeur
    est un vecteur.
16. Arc et secteur dans le sens direct, de A jusqu'à la demi-droite [MB),
    sur le cercle de centre M passant par A ; avec `1`, dans le sens
    indirect (l'image d'un arc par une symétrie axiale). Le demi-cercle est
    à gauche de AB, parcouru de A à B dans le sens indirect.
17. À un cercle ou une conique, la tangente `n` (0 ou 1) des deux qui
    passent par P, leurs points de contact (sur la polaire de P) rangés
    par paramètre croissant le long de la polaire, dirigée par (b, −a) pour
    ax + by + c = 0 ; P sur la conique, la tangente en P. À la courbe
    d'une fonction (`Cur`), la tangente au point d'abscisse celle de P.
    `TanX` donne cette abscisse par un nombre ou une formule : une entrée à
    part, car un nombre se lirait dans `Tan` comme l'indice d'un point. Son
    point (2) est le point de contact.
18. `n` du centre : 1 cercle inscrit, 2 gravité, 3 cercle circonscrit,
    4 orthocentre, 5 cercle d'Euler (premiers centres de Kimberling). Le
    polygone régulier tourne dans le sens direct de A à B, ses autres
    sommets lui étant propres ; `k` d'un sommet compte depuis 0, dans
    l'ordre des sommets du polygone. Dans un plan, il tourne autour de la
    normale de ce plan. Depuis le 2026-11-14, `n` peut être une formule
    (comme `r`, note 5), arrondie à l'entier le plus proche : moins de 3
    côtés, le polygone est indéfini, et ses sommets de rang n ou plus le
    sont aussi. Le troisième élément 1 d'un `Vtx` le fait reboucler : de
    rang le nombre de sommets du polygone, c'est son premier (fin du côté
    de fermeture quand ce nombre varie).
19. Depuis le 2026-11-06, un polygone ou une référence de face vaut un plan
    partout où une entrée prend un plan (`PlI`, `PlP`, `PlPl`, `Nrm`, `SphC`,
    `CyS`, `PlS`, `RegP`, `Semi`, `C1`, `CubV`) : son plan passe par la
    moyenne de ses sommets, de normale celle de son aire orientée, indéfini
    s'il n'a pas d'aire. Avec un polygone, `PlI` est indéfini hors de lui, bord compris à
    la tolérance près ; avec tout plan, quand la droite lui est parallèle (à
    10⁻¹⁰ près, relativement).
    Un plan est dessiné comme celui de GeoGebra, un carré de demi-côté h
    autour de son centre, ses coins lui étant propres. Par trois points :
    centré en leur centre de gravité, le long de AB, h² = 25 + somme des
    carrés des distances du centre aux points. Autrement : centré au pied
    de l'origine, le long de (−sin θ, cos θ, 0), θ angle polaire de la
    normale, h² = 25 + carré de la distance du centre à A. Le plan
    « xOy » de GeoGebra est `PlE` z = 0, caché. La droite de deux plans
    part du pied, sur elle, du milieu de leurs centres, et se dessine sur
    la moyenne de leurs demi-côtés de part et d'autre. Section d'un
    polyèdre : un sommet par arête (ses deux extrémités), indéfini là où
    le plan la manque ; celle d'un polyèdre de DocGeo (21), convexe, a ses
    sommets rangés autour de leur centre.
20. `CubV` : de rang k parmi B + w, A + w, A + h, B + h, B + w + h,
    A + w + h, w étant AB tourné d'un quart de tour dans le plan ABC (ou
    parallèle au plan), h la normale de longueur AB du côté de AB × BC (ou
    de la normale du plan) ; indéfini, comme dans GeoGebra, si AB n'est
    pas parallèle au plan (à 10⁻⁹ près, relativement). `CubP` et `CubZ`
    font de même, du côté de la normale du plan (celle de ses trois
    premiers sommets) ou du haut (0, 0, 1), multipliée par ±1. `Abv` : à la hauteur h (nombre ou formule)
    au-dessus du centre de gravité du polygone (k = −1) ou de son sommet k,
    le long de sa normale tournée vers le haut. `NetV` : P tourné autour de chaque arête OE de sa suite de faces, de f
    fois l'angle de (OC) à la direction qui s'éloigne de Q dans la face
    parente.
21. Un polyèdre se dessine entier : ses faces, celles du fond d'abord,
    éclairées comme les polygones, et ses arêtes, en pointillé là où ne se
    rencontrent que des faces du fond ; il cache ce qui est derrière lui.
    Le cube a pour sommets A..H = 0..7 : A, B, puis B + w, A + w, A + h,
    B + h, B + w + h, A + w + h (voir `CubV`), C ne donnant que le plan et
    le côté (`CubP` et `CubZ` : le plan ou l'horizontale, et ±1). Le prisme a pour sommets ceux du polygone puis P et les
    autres sommets du haut, translatés de P moins le premier sommet ; la
    pyramide, ceux du polygone puis S. Le patron (`Net`) se dessine entier,
    ses faces éclairées, celles du fond d'abord : chacune pend à la
    première face atteinte en largeur depuis la première face du polyèdre,
    les faces dans leur ordre, et tourne autour de leur arête commune de f
    fois son angle avec elle (0 : plié, 1 : à plat), ses descendantes
    avec elle, comme les patrons de GeoGebra.
22. Une boucle `[v, début, fin, pas?]` (pas : 1 par défaut, formules
    toutes trois) fait prendre à la variable v les valeurs début,
    début + pas… tant qu'elle ne dépasse pas fin (à 10⁻⁶ pas près, comme
    GeoGebra) ; un pas nul n'en donne aucune. Les boucles suivantes sont
    imbriquées dans la précédente, et leurs bornes, comme les formules,
    lisent les variables de celles qui les entourent, aux noms distincts,
    qui masquent les objets de même nom (`i` aussi, sinon l'unité
    imaginaire). Pour chaque tour de la boucle la plus intérieure, les
    formules donnent un élément : un point ou un nombre (nature `point`,
    une formule), les extrémités d'un segment ou deux points d'une droite
    (`segment`, `line`), le centre et le rayon d'un cercle (`circle`, dans
    le plan xOy, ou orthogonal à la direction que donne une troisième
    formule, ajoutée le 2026-10-21), les sommets d'un polygone (`polygons`, trois formules
    ou plus) ou cinq points d'une conique d'un plan horizontal (`conic`,
    ajoutée le 2026-11-15). Au plus 100 000 tours en tout. Lue par son nom, une suite de
    points vaut la liste de ses points, une liste par tour de chaque
    boucle extérieure (un point indéfini y vaut `NaN`).
23. `min` et `max` : nombre, `null` (bord de la fenêtre) ou formule d'autres
    objets, comme `a*c/d`.
24. Programme « onchange » de DGPad (`BLK`) : quand la valeur de
    l'expression `on` change (curseur, animation, `SET_EXP`), le script
    s'exécute comme celui d'un bouton (13), une fois les objets qu'il lit et
    change calculés ; jamais à l'ouverture de la figure. Jamais dessiné.
    Avec `"e"`, programme d'un geste sur le point `on` (« quand A est
    glissé, appuyé, lâché » de l'éditeur) : `"drag"` (« ondrag » de DGPad),
    une fois par pas de son glisser ou de son animation, pas quand un parent
    ou un autre programme le déplace ; `"down"` et `"up"` (« onmousedown »,
    « onmouseup »), quand on l'appuie et le relâche. Depuis le 2026-11-14,
    `on` peut aussi être un texte (`Txt`) avec `"down"` : quand on clique
    dessus (script de clic d'un texte de GeoGebra). Depuis le 2026-11-17,
    `on` peut aussi être une forme (polygone, droite, segment, cercle, arc,
    conique, courbe, lieu, image) avec `"down"`, de même (script de clic
    d'une forme de GeoGebra) ; une image n'en reçoit le clic que si elle a
    un tel programme. Plusieurs programmes
    d'un même geste s'exécutent chacun, dans l'ordre de la figure. Le script
    fixe aussi la place des points libres (`SET_EXP`). Avec `"e": "init"`,
    programme « oninit » de DGPad d'une expression ou d'un bouton `on`
    (« quand la figure s'ouvre » de l'éditeur) : il s'exécute une fois,
    quand la figure est ouverte (fichier `.dgo` ou import `.dgp`), avant ce
    que la page hôte applique (état élève), et pas quand l'éditeur
    reconstruit la figure.
25. Voir « Macro-constructions » ci-après.
26. Dans le plan des trois points (ajoutés le 2026-10-29, demandés par
    l'auteur, pour les arcs de grands cercles d'une sphère). `Arcs` et
    `Secs` : sur le cercle passant par A, B et C. `CArcs` et `CSecs` : sur
    le cercle de centre M passant par A, l'arc de l'angle AMB (le plus
    court), sans sens à choisir ; indéfini si M, A et B sont alignés.
    L'éditeur les écrit en 3D, `Arc`, `Sec`, `CArc` et `CSec` dans le
    plan. Deux cercles de plans différents (de ces arcs, `C3s`…) se
    coupent sur la droite commune aux deux plans.
27. Arc d'un cercle ou d'une ellipse c, de P à Q dans le sens direct de son
    plan (autour de la normale d'un cercle), P et Q pris à leur angle autour
    du centre pour un cercle, ramenés sur l'ellipse sinon (ajoutés le
    2026-10-29, `Arc(c, P, Q)` et `Sector(c, P, Q)` de GeoGebra) ; indéfini
    si c est une autre conique. Sur un cercle, c'est un arc de cercle ; sur
    une ellipse, une conique : ses intersections, ses tangentes et ses points
    sont ceux de c, indéfinis ou ramenés à l'extrémité la plus proche
    au-delà de l'arc, comme sur un arc de cercle. Le paramètre d'un point sur
    l'arc d'ellipse est celui de c.
28. À la place du point P, un objet (ajouté le 2026-10-30, voir
    `TRANSFORMATIONS.md`) : son image, construite sur les images de ses
    points (non enregistrées). Par `Sym`, `Refl`, `Rot`, `Dil` et `Tra`,
    de même nature : segment, vecteur, demi-droite et polygone, sur les
    images de ses extrémités ou de ses sommets ; droite,
    de son point et de ce point plus son vecteur directeur ; cercle, le
    cercle passant par les images de trois de ses points ; arc ou secteur,
    celui qui passe par les images de ses extrémités et de son milieu,
    parcouru dans le sens qu'elles donnent ; conique (pas un arc de
    conique), la conique passant par les images de cinq de ses points ;
    dans l'espace, plan, le plan passant par les images de trois de ses
    points ; sphère, celle de centre l'image du sien passant par l'image
    d'un de ses points ; polyèdre, celui de mêmes faces sur les images de
    ses sommets (pas un cylindre ni un cône). Par
    `Inv` (`[c, X]`, `[c, X, 1]`) : une droite, un cercle, un segment ou
    un arc donnent un cercle, un cercle, un arc ou un arc ; avec `1`
    (droite ou cercle passant par le centre de c quand l'objet a été
    construit), une droite, une droite, un segment ou un segment ; un
    polygone, le polygone des images de 32 points de chacun de ses côtés,
    à partir de son sommet (ses côtés deviennent des arcs) ; pas un plan,
    une sphère ni un polyèdre. Sinon (courbe de fonction, lieu, arc de
    conique, et par
    `Inv` demi-droite, vecteur ou conique), le lieu de l'image d'un point
    qui parcourt l'objet. Son style par défaut est celui de sa nature
    (`Seg`, `Vec`, `Ray`, `Line`, `Poly`, `Cir`, `Arc`, `Quad`, `Loc`,
    `Pl`, `Sph`, `Cube`). Un point se pose sur une image comme sur tout
    objet (`On`) ; une image ne se glisse pas.
29. Ajoutés le 2026-11-11, comme les listes de GeoGebra. `Pts` : un point
    par formule, dans l'ordre (coordonnées, point nommé ou formule de
    point), lu par son nom comme une liste `Seq` de nature `point` ; sans
    `k` ni `count`. `PolyL` : un polygone sur les points d'une liste de
    nature `point` (`Pts`, `Seq`, `Lst`), autant de sommets qu'elle a de
    points, ses points indéfinis écartés ; il est indéfini en dessous de
    trois. Le point de rang n d'une liste L (`Élément(L, n)` de l'éditeur)
    est un `Fp`, ou un point intégré `["Fp", formule]`, de formule
    `L[(n)-1]`.
30. Ajoutés le 2026-11-12, comme les listes de listes de GeoGebra. Un
    élément de `Pts` peut être une liste à son tour, écrite comme un
    tableau de ses éléments : `{{A, (1, 0)}, {(2, 3)}}` donne
    `[[["A", {"A": 0}], "[1, 0]"], ["[2, 3]"]]`. Un tableau est une
    formule s'il a deux éléments dont le second est un objet (ses
    références) ; sinon c'est une liste, dont les éléments ne sont jamais
    des objets. Une formule peut aussi donner une liste, comme `a` dans
    `{a, b}`. Lue par son nom, la liste vaut ses éléments, listes
    comprises (`c[0][1]`) ; elle dessine tous les points qu'elle contient.
    Elle est une liste de listes quand elle en contient une ; `PolyL` ne
    prend qu'une liste de points. `Fl` : une liste définie par une
    formule qui en donne une, intégrée à un objet (`["Fl", formule]`,
    voir plus haut) ou seule sur sa ligne ; l'éditeur l'écrit
    `Élément(c, i)`, de formule `c[(i)-1]`, pour une liste de listes c.
    Le point `Élément(c, i, j)` est un `Fp` de formule
    `c[(i)-1][(j)-1]`.
31. Ajoutés le 2026-11-13, comme `Prism(poly, h)` et `Pyramid(poly, h)` de
    GeoGebra : h, nombre ou formule, est la hauteur du premier sommet du
    haut au-dessus du premier sommet de la base, ou celle du sommet
    au-dessus du centre de ses sommets, le long de la normale de la base
    tournée vers le haut (comme `Abv`). Ces sommets sont propres au solide.
32. Ajouté le 2026-11-14, comme `Semicircle(A, B, p)` de GeoGebra : dans
    le plan, à gauche de AB autour de sa normale, parcouru de A à B dans
    le sens indirect autour d'elle.
33. Ajouté le 2026-11-16, comme une inéquation de x et y de GeoGebra
    (`a(x, y) = (x - x(A))² + (y - y(A))² ≤ r²`, `a(x, y) ∧ b(x, y)`) :
    les points du plan z = 0 où la formule ne vaut ni 0 ni `NaN`, remplis
    (`fc`, `o`) et bordés (`c`, `s`). Calculée sur une grille de la vue de
    8 pixels de côté, chaque bord affiné par dichotomie : un détail plus
    petit que la grille peut manquer.
34. Ajoutés le 2026-11-17, comme la surface z = f(x, y) de GeoGebra (une
    fonction de x et y, ou une quadrique donnée par une équation résolue
    en z) et son `Locus(P, curseur)`. La surface se dessine dans la boîte
    de coupe de GeoGebra, qui la borne même quand elle n'est pas utilisée :
    celle de la fenêtre, aussi profonde que large, réduite selon sa taille
    (0 petite, 1 moyenne, 2 grande : côté 1/√3, √(2/3) ou 1 fois celui de
    la fenêtre), tournée avec la vue, puis la boîte en x, y et z qui la
    contient. Maillée, ses faces éclairées comme celles des polygones
    (`fc`, `o`), elle cache ce qui est derrière
    elle, pas ce qui est posé sur elle. Son intersection avec une droite
    (`CyI`) est exacte quand f est au plus du second degré le long de la
    droite, cherchée sinon par échantillonnage. Le lieu d'un curseur prend
    1000 valeurs régulières de son min à son max, quel que soit son pas.
35. Ajoutés le 2026-11-17, comme les polyèdres réguliers de GeoGebra
    (`Tetrahedron`, `Octahedron`, `Dodecahedron`, `Icosahedron`) : la
    face ABC… (un triangle, un pentagone pour le dodécaèdre) est dans le
    plan ABC, du côté de AB × BC, C ne donnant que ce plan et ce côté, ou
    dans le plan de AB parallèle au plan donné ou horizontal, et le solide
    du côté de sa normale ou du haut, multipliée par ±1, comme le cube.
    Ses sommets ont l'ordre et les noms de ceux de GeoGebra (A, B, puis
    les siens, par couches parallèles à la première face), et ses faces
    son ordre (`PlatonicSolidsFactory`), qui numérote aussi leurs patrons :
    tétraèdre CAB DAC BAD CBD ; octaèdre CAB FAC DAF BAD EBD CBE FCE FED ;
    dodécaèdre EABCD JAEIO BAJKF CBFLG DCGMH EDHNI OINST JOTPK FKPQL
    GLQRM HMRSN TSRQP ; icosaèdre CAB FAC GAF DAG BAD HBD EBH CBE ICE FCI
    KEH IEK LIK FIL JKH LKJ GLJ FLG DJH GJD (A = 0, B = 1…).
36. Ajouté le 2026-11-17, comme `BoxPlot(y, s, liste)` de GeoGebra : la
    boîte va du premier quartile au troisième sur y ± s, traversée par la
    médiane, ses moustaches vont jusqu'aux valeurs extrêmes, terminées par
    des barres de même hauteur. Lu par une formule, l'objet vaut la
    médiane, comme dans GeoGebra.
37. Ajoutés le 2026-11-17, comme `Integral(f, a, b)`, `LowerSum(f, a, b,
n)` et `UpperSum(f, a, b, n)` de GeoGebra : a, b et n sont des nombres
    ou des formules (comme le rayon de `C1`). L'intégrale se calcule par la
    méthode de Simpson sur 1000 intervalles, sa région est tracée par 200 ;
    chaque rectangle d'une somme a pour hauteur le plus petit ou le plus
    grand de 17 échantillons de la fonction sur son intervalle. Lu par une
    formule, l'objet vaut l'intégrale ou la somme. Dans une formule,
    `eccentricity(c)` est l'excentricité de la conique c ; le point
    `CnP` `"e"` (excentricité en abscisse), que l'import n'écrit plus, reste
    lu.
38. Ajouté le 2026-11-17, comme `IterationList(f, z, s, n)` de GeoGebra :
    les n + 1 valeurs s, f(s), f(f(s))…, nombres, complexes ou points, f
    étant une formule de la variable z (comme celle d'une boucle de `Seq`),
    s et n des formules qui ne la lisent pas. Lue par son nom, la liste de
    ces valeurs ; dessinée comme une liste de points.

### Macro-constructions

Décidé avec l'auteur le 2026-10-26 (`MACROS.md`), implémenté dans
`src/objects/macro_object.ts` et `src/dgo.ts`.

Les définitions des macros de la figure, appliquées ou non, y sont
recopiées (comme la section `Used macro` de Cabri) : la figure reste
autonome. Une application est un nœud du graphe (`Mac`), qui calcule le
corps d'une méthode dans une construction privée, absente de la figure ;
chacun de ses finaux est une entrée `Out` de `o`.

```json
{
    "dgo": 1,
    "v": { "o": [550, 350], "u": 50, "w": 1100, "h": 700 },
    "mac": [
        {
            "n": "Milieu",
            "f": ["I"],
            "m": [
                {
                    "i": [
                        ["point", "Le premier point ?"],
                        ["point", "Le second point ?"]
                    ],
                    "h": "Choisir les deux points.",
                    "b": [["Mid", "I", [0, 1]]],
                    "f": [2]
                },
                {
                    "i": [["segment", "Le segment ?"]],
                    "b": [["Mid", "I", [2]]],
                    "f": [3]
                }
            ]
        }
    ],
    "o": [
        ["Pt", "A", [-2, 1]],
        ["Pt", "B", [3, 0]],
        ["Mac", "mac1", [0, 0, [0, 1]]],
        ["Out", "I", [2, 1]],
        ["Seg", "s", [0, 1]],
        ["Mac", "mac2", [0, 1, [4]]],
        ["Out", "J", [5, 1]]
    ]
}
```

Macro :

| Clé  | Contenu                                                        | Défaut   |
| ---- | -------------------------------------------------------------- | -------- |
| `n`  | nom de la macro, unique dans `mac`                             | (requis) |
| `f`  | noms de ses finaux, dans leur ordre (proposés à l'application) | (requis) |
| `ic` | icône : clé de la table `img`                                  | `null`   |
| `m`  | méthodes, une au moins                                         | (requis) |

Méthode :

| Clé | Contenu                                                                  | Défaut   |
| --- | ------------------------------------------------------------------------ | -------- |
| `i` | initiaux ordonnés `[type, message, nom?]`, un au moins                   | (requis) |
| `n` | noms des initiaux et de leurs sous-objets, par indice local (ci-après)   | absent   |
| `h` | aide : ordre des initiaux, domaine de validité                           | `""`     |
| `b` | corps : entrées `.dgo` (ci-après)                                        | (requis) |
| `f` | indices locaux des finaux dans le corps, dans l'ordre de `f` de la macro | (requis) |

Types des initiaux, exacts (une méthode qui attend une droite n'accepte
qu'une droite), et leurs sous-objets, utilisables dans le corps :

| Type      | Objets                                                                        | Sous-objets                                |
| --------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| `point`   | tout point                                                                    | —                                          |
| `line`    | droite : `Line`, `Par`, `Perp`, `Med`, `EqL`, `Tan`, `PlPl`, `Nrm`            | —                                          |
| `ray`     | demi-droite : `Ray`, `Bis`, `FA`                                              | son origine                                |
| `segment` | segment, côté de polygone                                                     | ses deux extrémités                        |
| `vector`  | `Vec`, `VecF`                                                                 | son origine, son extrémité                 |
| `circle`  | cercle entier : `Cir`, `C1`, `CAx`, `C3`, `C3p`, `C3s`, `EqC`, `SphC`, `Disk` | son centre                                 |
| `arc`     | `Arc`, `Sec`, `CArc`, `CSec`, `Semi`, et ceux de l'espace (26)                | son centre, son début, sa fin              |
| `conic`   | `Quad`, `Ell`, `Ell1`, `Hyp`, `Hyp1`, `Prb`, `EqQ`, `QArc`, `QSec`            | —                                          |
| `polygon` | `Poly`, `RegP`, `PlS`, pas un plan                                            | par `["vertex", i, k]` et `["side", i, k]` |
| `plane`   | `Pl`, `PlP`, `PlL`, `PlO`, `PlE`                                              | —                                          |
| `sphere`  | `Sph`, `Sph1`                                                                 | son centre                                 |
| `angle`   | `Ang`, l'angle AOB                                                            | A, O, B                                    |
| `number`  | `Ex` autre qu'une fonction, ou formule constante                              | —                                          |

Un initial qui a un `nom` (chaîne non vide) est **fixé** (demandé par
l'auteur le 2026-10-27, voir `MACROS.md`) : l'éditeur le prend sans le
demander, s'il trouve l'objet désigné la dernière fois pour ce nom, ou à
défaut un objet de la figure qui porte ce nom. Ce nom est celui de l'objet
désigné comme initial à la définition : les macros définies à partir du
même objet partagent leur initial fixé (`["circle", "", "Hz"]`, le disque
de Poincaré des macros hyperboliques). Sans effet sur le calcul ; le
lecteur se contente de le garder.

Les noms `n` (ajoutés le 2026-10-28, demandés par l'auteur) sont ceux
qu'avaient, dans la figure où la méthode a été définie, ses initiaux et
leurs sous-objets, un par indice local de l'initial (donc autant que
d'indices locaux avant le corps), `""` pour un sous-objet que la figure
n'avait pas (le centre d'un cercle par trois points) : `["d", "O", "M"]`.
Sans effet sur le calcul ; l'éditeur les montre dans le programme d'une
macro (`MACROS.md`, « Voir le programme »), pour qu'il parle des mêmes
objets que l'aide.

Le début d'un arc est le point d'où il part (A pour `Arc`, `CArc`, `Semi`),
sa fin celui où il s'arrête. Un angle n'est pas un nombre : le corps lit sa
mesure par son nom, dans une formule.

Corps d'une méthode :

- **Indices locaux** : les initiaux d'abord, dans leur ordre, chacun précédé
  de ses sous-objets (comme dans Cabri), puis les entrées du corps. Dans la
  seconde méthode de l'exemple, 0 et 1 sont les extrémités du segment, 2 le
  segment, 3 le milieu. Le premier sommet d'un polygone initial d'indice
  local 4 est `["vertex", 4, 1]` ; un rang absent rend la référence
  indéfinie, comme dans la figure.
- Ses entrées sont des entrées `.dgo` ordinaires, lues et validées comme
  celles de `o`. Leurs références (indices, références de côté ou de
  sommet, noms des formules) ne désignent que des initiaux, des sous-objets
  et des entrées antérieures du corps, jamais un objet de la figure.
- Leurs noms, uniques dans le corps, ne sont pas ceux de la figure (« Ouvrir
  la boîte » les reprend, renommés au besoin).
- Chaque entrée peut avoir un style (indice dans `st`), celui de son objet
  dans la figure où la macro a été définie : pour un final, son style par
  défaut à l'application ; pour un intermédiaire, celui qu'il prend quand
  on ouvre la boîte (caché s'il l'était), sans effet sur le calcul. Ni `sc`,
  ni `rgb`, ni `mg`. Décidé avec l'auteur le 2026-10-26, quand seuls les finaux en
  avaient un.
- Rien de ce qu'une manipulation change, qui serait un initial manquant :
  ni objet libre (`Pt`, `VecF`), ni `Ex` de valeur `"v"` (curseur, nombre
  réglable) ou globale (`"g"`) ; un nombre constant s'écrit dans une
  formule (`"2"`). Le rayon numérique d'un `C1` y est en revanche une
  constante, qu'aucun glisser ne change, même sur un final (décidé avec
  l'auteur le 2026-10-26, voir `MACROS.md`). Ni `Btn`, `Evt`, `Html`, ni
  `Img`, dont la clé est celle de la table `img` de la figure.
- Un point sur objet (`On`) dont le support est calculé dans le corps y
  est permis (décidé avec l'auteur le 2026-10-27, voir `MACROS.md`) : son
  paramètre est une constante du corps pour un intermédiaire, et pour un
  final la place où il est posé à l'application, qu'un glisser change
  ensuite (ci-après, `Out`). Celui du point mobile d'un lieu n'est qu'un
  point de départ.
- Il peut contenir des `Mac` et des `Out`, d'une macro d'indice inférieur
  dans `mac` (pas de récursion).
- La numérotation des branches d'intersection (note 3) y est la même.

Le lecteur refuse une macro dont un final est un initial ou un sous-objet,
dont deux finaux d'une méthode sont la même entrée, dont une méthode n'a
pas autant de finaux que `f`, ou dont la signature (types des initiaux)
d'une méthode est celle d'une autre ou la prolonge (règle de `EDITOR.md`,
« Langage textuel »). Il lit le corps d'une méthode à chaque application.
L'éditeur n'enregistre pas non plus de méthodes dont les finaux n'ont pas,
rang par rang, le même type (celui des initiaux, ou à défaut le même type
`.dgo`).

Application (note 25 des objets) :

- `Mac` : `macro` est un indice dans `mac`, `méthode` dans ses `m`. Un
  initial par initial de la méthode, du type exact attendu : une référence
  d'objet, ou, pour un `number`, une formule constante, qui ne nomme rien
  (un nombre tapé s'écrit `"3"`). Le nœud dépend des initiaux. Il n'est ni
  dessiné ni désignable ; son nom, requis comme pour toute entrée, sert à
  l'état élève. `branches` : dans l'ordre du corps, la branche (note 3) de
  chaque `Int` sans point P et, pour chaque `Mac` du corps, la liste de ses
  propres branches ; absent, celles du corps. Écrit quand il en diffère,
  pour que la figure enregistrée après manipulation (intersections suivies)
  se rouvre à l'identique.
- `Out` : le final de rang k, à partir de 1 dans l'ordre de `f`, d'une
  application antérieure ; au plus un `Out` par rang. Le final d'une macro
  peut être celui d'une application de son corps. C'est l'objet même que
  calcule le corps, de la classe de son entrée, adopté dans la figure : nommé,
  stylé (écart aux défauts du type de son entrée dans le corps, comme tout
  objet), désignable, jamais déplaçable, sauf un point sur objet, qui se
  glisse le long de son support : son `Out` a alors un troisième
  paramètre, `["Out", "C", [4, 1, 0.37]]`, sa place, de même forme que le
  paramètre de l'entrée `On` (nombre, couple ou triplet) ; absent, celle du
  corps.
  Un initial ou un intermédiaire indéfini rend indéfinis les finaux qui en
  dépendent.
- **Image d'un objet** (ajoutée le 2026-10-30, voir
  `TRANSFORMATIONS.md`) : une méthode qui envoie un point sur un point
  (son dernier initial est un point, son seul final un point) prend à la
  place de ce point un objet qu'une inversion prend (note 28 : ni plan,
  ni sphère, ni polyèdre). L'entrée `Mac` est alors l'image elle-même, sans `Out`, par
  exemple `["Mac", "a", [1, 0, [5, 4], "Poly"]]` ; son quatrième
  paramètre, à la place de `branches`, est la nature
  trouvée par l'éditeur à l'application (droite, cercle, conique ou lieu),
  enregistrée pour qu'une figure rouverte ailleurs garde la sienne : `Line`,
  `Ray`, `Seg`, `Vec`, `Cir`, `Arc`, `Poly`, `Quad` ou `Loc`, parmi celles
  que peut avoir l'image de cet objet (note 28) ; pour un polygone, `Poly`
  (côtés droits, sur les images de ses sommets) ou `Loc` (le polygone des
  images de 32 points de chacun de ses côtés). Chacun des points privés de
  l'image est une application de la méthode, l'objet remplacé par ce point.
  Son style par défaut est celui de cette nature.

### Bibliothèques de macros

Décidé avec l'auteur le 2026-10-27 (`MACROS.md`, « Bibliothèque »),
implémenté dans `src/editor/library.ts`.

Une bibliothèque est un `.dgo` sans objets (`"o": []`), réduit à `mac`,
`st` et `img` : la bibliothèque fournie (`public/macros/<langue>.dgo`,
produite par `npm run macros`), « Mes macros » (stockage du navigateur, en
JSON clair) et leur export. Ouverte dans l'éditeur, c'est une figure vide
qui a ces macros. Toute figure sert aussi de bibliothèque à l'import : ses
objets sont ignorés.

Une macro de bibliothèque a une clé de plus, sans effet dans une figure :

| Clé | Contenu                                          | Défaut |
| --- | ------------------------------------------------ | ------ |
| `d` | son dossier : noms des dossiers depuis la racine | `[]`   |

Appliquer une macro de bibliothèque recopie dans le `mac` de la figure sa
définition, sans `d`, et celles des macros que ses corps appliquent, avant
elle, chaque `Mac` d'un corps réindexé. Une macro de même nom et de même
définition (les macros appliquées désignées par leur nom) n'est pas
recopiée. Les mêmes règles valent pour ajouter des macros à « Mes macros ».

### Styles `st`

Pour chaque objet, les seules clés qui diffèrent de leur défaut, figé ici.
S'y ajoutent `sc` (condition d'affichage : indice d'une expression), `rgb`
(couleur dynamique : indice d'une expression), `mg` (aimants :
`[[indice, rayon en pixels], …]`) et `av` (vitesse variable d'une animation :
indice d'une expression, voir `an`), qui peuvent désigner un objet postérieur.
Depuis le 2026-11-16, `vw` est l'indice de la vue où l'objet est dessiné
(0 : `v`, 1 : la première de `vs`…) ; absent, il l'est dans la première à la
lecture d'une figure, dans celle où on l'ajoute dans l'éditeur. Un objet
peut s'appuyer sur ceux d'une autre vue : il les voit dans la sienne.
Depuis le 2026-11-17, `vws` liste les autres vues où l'objet est aussi
dessiné (`[1]`, `[0, 2]`…), pour l'objet de GeoGebra montré dans deux vues
à la fois ; une vue plane d'une figure de l'espace n'y dessine ses points,
droites, segments et polygones que s'ils sont dans le plan z = 0.

Depuis le 2026-11-14 aussi, pour les figures de GeoGebra : `cp` est la
légende d'un objet, écrite à la place de son nom (`sn`) ; `ho` fait d'un
point un cercle ou un losange creux, son contour `pb` ; `no` d'un point
place le début et la ligne de base de son nom, en pixels depuis lui (vers la
droite et vers le bas), au lieu de `np` et `nd`, et se perd quand l'éditeur
déplace le nom.

Depuis le 2026-11-15, le `cp` d'un point peut contenir `%v` : ses
coordonnées, `(x, y)` ou `(x, y, z)` dans une figure 3D, arrondies à `p`
décimales sans zéros inutiles (étiquettes « valeur » et « nom = valeur » de
GeoGebra).

Depuis le 2026-11-14 encore, pour les curseurs de GeoGebra (`Ex`) : `cp`
remplace leur étiquette « nom = valeur », `%v` y valant la valeur ; `no` place
le début et la ligne de base de cette étiquette, en pixels depuis le bouton
(un curseur horizontal). `bf` écrit un texte (`Txt`, `Ex`) en gras ; `tp` fait
de la trace `tk` d'un point celle de GeoGebra : une copie du point à chacune de
ses positions, au lieu d'une ligne qui les relie.

Depuis le 2026-11-14 encore, `bg` donne à un texte (`Txt`, `Ex`) le fond de
GeoGebra : un rectangle de cette couleur, 3 pixels autour du texte, qui cache
ce qui est dessous.

Depuis le 2026-11-14, `rgb` donne à l'objet la couleur de GeoGebra (trait et
remplissage) que calcule l'expression, liste `[r, g, b]` : chaque canal est
ramené dans [0, 1] par une onde triangulaire de période 2 (1,2 donne 0,8 ;
−0,3 donne 0,3), puis multiplié par 255 et tronqué. Le bouton d'un curseur
de la couleur de son objet la suit. Sans `rgb`, la couleur est celle de `c`.

| Clé  | Objets                   | Contenu                                                                                    | Défaut                            |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------- |
| `c`  | tous                     | couleur du trait                                                                           | du type                           |
| `fc` | tous                     | couleur de remplissage                                                                     | `c` s'il est donné, sinon du type |
| `s`  | tous                     | taille                                                                                     | du type                           |
| `o`  | tous                     | opacité                                                                                    | du type                           |
| `h`  | tous                     | 0 visible, 1 caché, 2 super-caché                                                          | 0 (`Mac` : 2)                     |
| `sn` | tous                     | nom affiché                                                                                | 0                                 |
| `in` | tous                     | inerte : ignore survol, clic et toucher                                                    | 0                                 |
| `no` | tous                     | place du nom déplacé (point : ci-après)                                                    | `null` (place de GeoGebra)        |
| `cp` | tous                     | légende, écrite à la place du nom                                                          | `null` (le nom)                   |
| `f`  | tous                     | taille de police                                                                           | 16                                |
| `p`  | tous                     | précision (lieu : nombre d'échantillons)                                                   | -1 (`Loc` : 1000, `Html` : 4)     |
| `l`  | tous                     | calque (entier, sous les `Html`)                                                           | 0                                 |
| `sp` | points, listes de points | `circle`, `cross`, `diamond`, `rect`                                                       | `circle`                          |
| `pb` | points                   | épaisseur du contour                                                                       | 1                                 |
| `ho` | points                   | creux : sans remplissage                                                                   | 0                                 |
| `np` | points                   | direction du nom (radians)                                                                 | 0                                 |
| `nd` | points                   | distance du nom (pixels)                                                                   | `null` (deux fois la taille)      |
| `tk` | points                   | trace                                                                                      | 0                                 |
| `tp` | points                   | trace par points (GeoGebra)                                                                | 0                                 |
| `i`  | points                   | pas de déplacement `[dx, dy]`                                                              | [0, 0]                            |
| `fl` | points                   | punaisé à sa place dans la fenêtre                                                         | 0                                 |
| `sb` | `On`                     | sur le bord du polygone                                                                    | 0                                 |
| `an` | `On`, `Ex`               | animation (ci-dessous)                                                                     | `null`                            |
| `pl` | `Poly`                   | plan                                                                                       | 0                                 |
| `su` | `Poly`                   | section (garde ses sommets définis)                                                        | 0, 1 pour `PlS`                   |
| `fx` | `Poly`                   | fixé : ne se déplace pas par translation                                                   | 0                                 |
| `pn` | `Poly`                   | indéfini si ses sommets ne sont pas coplanaires (GeoGebra, 2026-11-17)                     | 0                                 |
| `ar` | `Ang`, `FA`              | rayon de l'arc                                                                             | 30                                |
| `ra` | `Ang`                    | marque d'angle droit                                                                       | `dgpad`                           |
| `ao` | `Ang`                    | orientation dans le plan : 0 ≤ 180° (DGPad), 1 sens direct de OA à OB, 2 ≥ 180° (GeoGebra) | `0`                               |
| `dc` | `Seg`, `Vec`             | décoration (0 à 6), `VecF` compris                                                         | 0                                 |
| `dh` | tous                     | motif de pointillés, en pixels                                                             | `[]` (trait plein)                |
| `lo` | tous                     | opacité du trait (GeoGebra)                                                                | 1 (`Btn` : 0,25)                  |
| `is` | `Ex`                     | pas du curseur                                                                             | 0                                 |
| `cL` | `Ex`                     | longueur du curseur                                                                        | 200                               |
| `cV` | `Ex`                     | curseur vertical                                                                           | 0                                 |
| `cD` | `Ex`                     | valeur (en radians) écrite en degrés, comme un angle de GeoGebra                           | 0                                 |
| `cN` | `Ex`                     | curseur sans nom ni valeur (2026-11-13)                                                    | 0                                 |
| `cB` | `Ex`                     | case à cocher                                                                              | 0                                 |
| `iB` | `Ex`                     | champ de saisie (largeur)                                                                  | 0                                 |
| `tx` | `Ex`                     | LaTeX                                                                                      | 0                                 |
| `bf` | `Txt`, `Ex`              | gras                                                                                       | 0                                 |
| `bg` | `Txt`, `Ex`              | couleur du fond                                                                            | `null` (sans fond)                |
| `cc` | `Ex`                     | couleur du bouton du curseur                                                               | `null` (celle du curseur)         |
| `cf` | `Ex`                     | remplissage du bouton, si `co` > 0                                                         | `null` (celle du bouton)          |
| `cr` | `Ex`                     | rayon du bouton                                                                            | 10                                |
| `co` | `Ex`                     | opacité du bouton                                                                          | 0                                 |
| `sg` | `ELst`                   | épaisseur des segments                                                                     | -1                                |
| `sa` | `ELst`                   | flèche des segments `[l, d]` (px)                                                          | `null`                            |

Nom `sn` : écrit, pour un objet autre qu'un point, à la place que lui donne
GeoGebra (segment, droite, demi-droite, vecteur, cercle, arc, conique,
courbe, polygone). Déplacé, il garde sa place relative à l'objet quand
celui-ci change, `no` la donnant selon l'objet (pixels vers la droite et vers
le bas) :

- droite par deux points, segment, demi-droite, vecteur : `[t, d]`, à la
  fraction `t` du chemin de son premier point au second, à `d` pixels à
  gauche de ce chemin ;
- autre droite : `[l, d]`, à `l` pixels de son point le long de la droite ;
- cercle, arc, ellipse : `[α, d]`, à l'angle `α` du paramétrage de l'objet,
  à `d` pixels à l'extérieur ;
- courbe : `[x, dx, dy]`, décalé du point d'abscisse `x` ;
- polygone, hyperbole, parabole : `[dx, dy]`, décalé de la place de GeoGebra
  (moyenne des sommets, sommet).

Un point place le sien par `np` et `nd`. Le `labelOffset` de GeoGebra, en
pixels, est converti à l'import. DGPad n'écrit que le nom des points :
l'import `.dgp` ignore son `sn` sur les autres objets.

Inerte `in` : comme l'objet inerte de DGPad (`nmi:true`, importé), l'objet
ne répond plus au pointeur, qui atteint ce qui est dessous : ni survol, ni
clic, ni toucher, ni déplacement. Le panneau de propriétés de l'éditeur
ouvert, aucun objet n'est inerte.

Fixé `fx` : comme dans GeoGebra, un polygone dont les sommets (hors ceux
qu'il calcule, comme ceux d'un `RegP`) sont tous des points libres, non
punaisés, se glisse en translatant ces sommets, sauf s'il est fixé. L'import
GeoGebra fixe les polygones fixés (`fixed`) ou non sélectionnables
(`selectionAllowed`). Ses sommets restent manipulables un à un.

Calque `l` : comme dans DGPad et GeoGebra, un objet est peint au-dessus de
ceux des calques plus bas, points compris ; à calque égal, l'ordre reste celui
des types. Les `Html`, comme les textes de DGPad, restent au-dessus.

Animation `an` : `[vitesse, sens, extrémité]`, `[vitesse, sens, extrémité,
GeoGebra]` ou `[vitesse, sens, extrémité, 1, arrêtée]`. Comme dans DGPad, elle
est lancée à l'ouverture et un bouton en bas à gauche de la fenêtre la suspend
et la reprend. Arrêtée (1), celle d'un objet de GeoGebra qui ne joue pas
attend qu'un programme la lance (`setAnimated(1)`, le `StartAnimation` de
GeoGebra) ; le bouton n'apparaît qu'une fois une animation lancée. Sens 1 ou -1 (sens courant à
l'enregistrement). Extrémité : 0 retour à l'autre extrémité, 1 aller-retour,
2 arrêt (« croissant une fois » de GeoGebra ; la vitesse est alors mise à 0).
Vitesse positive, sans le drapeau GeoGebra (ou à 0), comme dans DGPad : en
pixels d'écran par seconde sur une droite ou le bord d'un polygone (partie
visible d'une droite, depuis l'origine d'une demi-droite), en radians par
seconde sur un cercle, cinq fois autant d'échantillons par seconde sur un lieu,
en cinquantièmes de l'intervalle d'un curseur par seconde (par pas entiers
s'il en a un), en unités par seconde pour un autre nombre.
Avec le drapeau GeoGebra à 1, comme dans GeoGebra : à la vitesse 1, un curseur
parcourt son intervalle et un point sur objet son chemin en 10 s, selon le
paramètre de GeoGebra ramené de 0 à 1 (angle de -π à π sur un cercle, t de
`centre + u cos t + v sin t` de -π à π sur une ellipse, u et v ses demi-axes,
de 0 à 1 sur un arc ou un segment, une unité par côté d'un polygone, les
droites, demi-droites et courbes infinies comprimées comme le fait son
`PathNormalizer`).
Depuis le 2026-11-13, la clé de style `av`, indice d'une expression, rend la
vitesse variable comme celle de GeoGebra, qui peut dépendre de la figure : la
vitesse effective est celle de `an` (1 pour une figure GeoGebra) multipliée
par la valeur courante de l'expression, son signe inversant le sens. Sans
`av`, la vitesse reste constante.

Défauts par type : `[remplissage, trait, taille, opacité]` (opacité absente :
non définie).

| Types                                                                                     | Défauts                                   |
| ----------------------------------------------------------------------------------------- | ----------------------------------------- |
| `Pt`, `On`, `DirP`                                                                        | `rgb(255,255,255)`, `rgb(80,80,80)`, 6, 0 |
| `Fix`, `Fp`, `Mid`, `Int`, `CyI`, `PlI`, `Ctr`, `CnP`, `Sym`, `Refl`                      | `rgb(180,180,180)`, `rgb(80,80,80)`, 6, 0 |
| `Rot`, `Dil`, `Tra`, `Inv`, `TC`, `Vtx`                                                   | `rgb(180,180,180)`, `rgb(80,80,80)`, 6, 0 |
| `CubV`, `Abv`, `NetV`                                                                     | `rgb(180,180,180)`, `rgb(80,80,80)`, 6, 0 |
| `Line`, `Par`, `Perp`, `Med`, `EqL`, `Tan`, `PlPl`, `Nrm`                                 | `rgb(35,141,227)`, `rgb(80,80,80)`, 2     |
| `Ray`, `Bis`                                                                              | `rgb(35,141,227)`, `#993300`, 2           |
| `Seg`, `Vec`, `VecF`                                                                      | `rgb(35,141,227)`, `rgb(180,80,80)`, 4    |
| `FA`                                                                                      | `#006633`, `#006633`, 1, 0                |
| `Ang`                                                                                     | `#006633`, `#006633`, 4, 0                |
| `Cir`, `C1`, `CAx`, `C3`, `C3p`, `C3s`, `Arc`, `Sec`, `CyS`, `EqC`                        | `#CC66CC`, `#CC66CC`, 2, 0                |
| `CArc`, `CSec`, `Semi`, `SphC`, `Disk`                                                    | `#CC66CC`, `#CC66CC`, 2, 0                |
| `Arcs`, `Secs`, `CArcs`, `CSecs`, `QArc`, `QSec`                                          | `#CC66CC`, `#CC66CC`, 2, 0                |
| `Quad`, `Ell`, `Ell1`, `Hyp`, `Hyp1`, `Prb`, `EqQ`                                        | `#CC66CC`, `#CC66CC`, 2, 0                |
| `Sph`, `Sph1`, `Poly`, `RegP`, `PlS`                                                      | `rgb(35,141,227)`, `rgb(80,80,80)`, 2, 0  |
| `Cyl`, `Cone`, `Cube`, `CubP`, `CubZ`, `Prsm`, `Pyr`, `PrsH`, `PyrH`, `Net` (opacité 0,4) | `rgb(35,141,227)`, `rgb(80,80,80)`, 2     |
| `Tetr`, `TetP`, `TetZ`, `Octa`, `OctP`, `OctZ` (opacité 0,4)                              | `rgb(35,141,227)`, `rgb(80,80,80)`, 2     |
| `Dode`, `DodP`, `DodZ`, `Icos`, `IcoP`, `IcoZ` (opacité 0,4)                              | `rgb(35,141,227)`, `rgb(80,80,80)`, 2     |
| `Surf` (opacité 0,4)                                                                      | `rgb(35,141,227)`, `rgb(80,80,80)`, 2     |
| `Box`, `Itg`, `LSum`, `USum`                                                              | `rgb(35,141,227)`, `rgb(80,80,80)`, 2, 0  |
| `Pl`, `PlP`, `PlL`, `PlO`, `PlE` (`pl` : 1)                                               | `rgb(35,141,227)`, `rgb(80,80,80)`, 2, 0  |
| `Loc`, `Cur`                                                                              | `#0b5b94`, `#0b5b94`, 2                   |
| `Lst`, `ELst`, `Itr`, `ItL`                                                               | `#656148`, `#656148`, 2                   |
| `Ex`                                                                                      | `rgb(0,0,178)`, `rgb(0,0,178)`, 7, 0      |
| `Txt`                                                                                     | `#000000`, `#000000`, 1                   |
| `Img` (une épaisseur non nulle dessine son cadre)                                         | `#000000`, `#000000`, 0                   |
| `Html`                                                                                    | `#000000`, `#000000`, 3                   |
| `Btn` (bord : `c` à `lo`, épaisseur `s` ; fond : `fc` à `o`)                              | `#000000`, `#000000`, 1, 0,05             |

## État élève

L'état d'une figure est ce qu'une manipulation y a changé par rapport à sa
figure de base (le `.dgo` chargé, ou la figure qu'en a tirée la requête
`rebase` du mode intégré, voir `EMBED.md`) : un objet JSON clair, séparé de la figure,
indexé par nom, limité aux objets **dont la valeur diffère** de la figure de
base (égalité exacte des nombres JSON). État vide : figure non manipulée.

**Invariant** : toute modification qu'une manipulation de l'utilisateur peut
faire à la figure, hors vue et traces, se retrouve dans l'état. Tout nouvel
objet manipulable y entre donc, par une nouvelle ligne du tableau ci-dessous.

Les styles que changent les programmes d'une manipulation (note 24 des
objets, scripts de mise à jour de GeoGebra) se retrouvent, eux, en
appliquant l'état (depuis le 2026-11-16) : une fois la figure construite
avec ses valeurs, les programmes « onchange » des objets qu'il nomme et
« ondrag » des points qu'il nomme s'exécutent, dans l'ordre de la figure,
pour leurs styles seulement. Ni leurs affectations, déjà dans l'état, ni
leurs messages, questions, attentes ou changements de vue (fond compris).
Un style qu'un programme ne tire pas des valeurs finales (compteur de
passages, réponse à une question) peut donc différer.

```json
{ "M": [2.1, -0.4], "N": 0.35, "k": 31, "cb": 1, "I2": 3 }
```

| Objet                                                     | Valeur                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `Pt` (point libre), punaisé (`fl`) compris (3)            | `[x, y]` dans une figure plane, `[x, y, z]` dans une figure 3D (1) |
| `On` (point sur objet), final de macro compris            | son paramètre de `.dgo` : nombre, couple ou triplet (4)            |
| `Ex` de valeur constante numérique (`"v"`)                | le nombre                                                          |
| `Int` sans point P dont les solutions sont suivies (2)    | le numéro de branche de `.dgo` (note 3 des objets)                 |
| `C1` à rayon numérique (non formule)                      | le rayon, qu'un glisser du cercle change                           |
| `VecF` (vecteur libre)                                    | ses coordonnées, comme un point libre (1)                          |
| `Mac` qui a des branches                                  | `branches`, sous sa forme de `.dgo` (note 25 des objets)           |
| `Cur` qu'un champ de saisie redéfinit (note 6 des objets) | le texte de sa formule, ses objets désignés par leur nom           |

Comme dans `.dgo`, un nombre non fini s'écrit `null`.

1. À l'application, `[x, y]` est accepté aussi dans une figure 3D (z = 0).
2. Intersections à plus de deux solutions (cercle-conique, conique-conique…) :
   chacune suit sa solution quand la figure bouge, si bien que les mêmes
   valeurs des autres objets, atteintes autrement, peuvent donner une autre
   numérotation. Leur branche fait donc partie de l'état quand elle diffère.
3. Un point punaisé garde sa place dans la fenêtre quand la vue change, et
   un glisser change cette place. Ses coordonnées dans l'état sont celles de
   cette place dans la vue de base (la vue avec laquelle la figure de base est
   construite), indépendantes de la vue courante : zoomer ou déplacer la vue
   ne change pas l'état. Appliquées comme paramètres de `Pt`, elles le
   replacent au même endroit. Dans une figure 3D à repère 2D (`f2`), ce sont
   ses coordonnées dans ce repère, suivies de 0.
4. À l'application, un point sur objet de paramètre numérique (droite,
   segment, cercle, courbe… hors lieu et liste) accepte aussi des coordonnées
   `[x, y]` ou `[x, y, z]` : il est placé à l'endroit de son objet le plus
   proche, comme par un glisser (sans le pas d'incrément), une fois la figure
   construite avec le reste de l'état. L'état relu donne son paramètre. Ainsi
   l'hôte peut appliquer la valeur (`value`) attendue d'un point sans
   connaître son objet. Un point sur polygone, sur conique ou sur une
   surface, de paramètre couple ou triplet, n'en accepte pas : ce couple ou
   ce triplet y reste son paramètre.

- Les `Ex` de valeur constante couvrent les curseurs, les cases à cocher, les
  nombres que modifie un champ de saisie ou le glisser d'un point `Fp`.
- Une courbe qu'un champ de saisie redéfinit y entre par sa formule, un
  texte : appliquée, elle est relue comme une formule tapée dans le champ,
  et refusée si elle n'en est pas une.
- La vue (zoom, déplacement, rotation 3D) et les traces n'en font pas partie.
- Les finaux d'une macro (`Out`) non plus, même un point sur objet ou une
  intersection : les branches sont celles de leur application.
- Une animation (`an`) change la valeur de son objet comme une manipulation :
  elle entre dans l'état.
- **Application** : la figure de base, où chaque objet de l'état reçoit sa
  valeur (paramètres de `Pt`, `On`, `Int`, `C1` ; `"v"` d'une `Ex`), est
  reconstruite comme un `.dgo`. Elle reproduit la figure d'où l'état a été
  tiré, au dessin près. Un état qui nomme un objet inconnu ou non modifiable, ou dont une
  valeur n'a pas la forme attendue, est refusé en entier.
- **Stabilité** : mêmes exigences que le format `.dgo`. Un état enregistré
  (réponse d'élève, état attendu) doit pouvoir être réappliqué indéfiniment à
  sa figure de base : la forme des valeurs ne change jamais, toute évolution
  est additive.

## Règles d'évolution (format purement additif)

1. **Défauts figés dans la spécification `.dgo`**, indépendants de
   `preferences.ts` : changer un défaut changerait tous les anciens fichiers.
2. **Jamais de changement de sémantique** d'un type, d'un champ ou d'une
   fonction de formule : on ajoute un nouveau type ou champ dont le défaut
   reproduit l'ancien comportement.
3. **Numérotation stable des branches d'intersection**, définie par le format
   et non par l'algorithme de calcul.
4. **Noms uniques et stables** (clés de l'état élève) ; le lecteur ne renomme
   jamais.
5. Seule la rétrocompatibilité compte (le lecteur servi est toujours le plus
   récent). En développement, le format peut changer librement ; une fois
   diffusé, le lecteur doit ouvrir la v1 indéfiniment.
6. Une erreur d'import découverte après coup reste figée dans les `.dgo` déjà
   produits.

## Nettoyage à l'import

Profiter de la conversion pour corriger les défauts des fichiers sources, qui
seraient sinon figés. Exemple : `tests/dgp/Apollonius/_Apollonius.dgp` contient des noms
doublement encodés en UTF-8 (`"IntermÃ\u0083Â©diaire"`) —
redécoder tant que le résultat reste de l'UTF-8 valide n'utilisant que des
caractères < 256 ; l'appliquer aux noms, textes et formules.

## Travail à faire

Fait (v1) :

1. Chaque type d'objet (`src/objects/*`) se décrit : méthode `dgo()`.
2. Écrivain `.dgo` à partir de la construction en mémoire (`src/dgo.ts`).
3. Lecteur `.dgo` reconstruisant directement les objets (`src/dgo.ts`),
   qui refuse tout fichier malformé.
4. Cmd-S / Ctrl-S et ouverture `.dgo` (gzip ou JSON clair) dans la version
   standalone.
5. Test d'aller-retour sur toutes les figures de `tests/dgp` et `tests/ggb`
   (`tests/browser/dgo.test.ts`) : mêmes descriptions, mêmes positions, même
   dessin au pixel près, y compris après manipulation.
6. Nettoyage à l'import des textes doublement encodés en UTF-8.

7. État élève (section ci-dessus) et mode intégré piloté par `postMessage`
   (`EMBED.md`), avec cadre d'enregistrement.

Reste à faire, côté DocTools : intégration DocEval (import au dépôt, stockage
`longblob`, signalement d'import bien visible).
