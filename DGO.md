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
| `deg` | angles en degrés (1) ou en radians (0)   | 1 (DGPad)  |
| `sop` | `construction.segmentsOverPolygons`      | 0          |
| `bg`  | couleur de fond                          | `#FAFAFA`  |
| `st`  | styles, référencés par indice            | `[]`       |
| `img` | images : clé → data URL                  | `{}`       |
| `o`   | objets `[type, nom, paramètres, style?]` | (requis)   |
| `mac` | macro-constructions (ci-après)           | `[]`       |

Couleurs : `#rgb`, `#rrggbb` ou `rgb(r,g,b)`. Booléens : 0 ou 1. JSON n'ayant
pas NaN, un nombre non fini s'écrit `null` là où il peut survenir :
coordonnées d'un point libre, paramètre d'un point sur objet, valeur d'une
expression, rayon numérique d'un `C1`. Une clé
d'image est formée des 16 premiers chiffres hexadécimaux du SHA-256 de sa data
URL (même image, même clé).

### Vue `v`

`o` origine en pixels, `u` pixels par unité, `w` et `h` taille de la fenêtre
à l'enregistrement (requis). À l'ouverture, une figure plane ou 3D de DGPad
(`f2`) garde son origine à la même place dans la fenêtre (comme DGPad) ; une
autre figure 3D, à la même place par rapport au centre de la fenêtre. En mode intégré (`EMBED.md`), la région
enregistrée `w` × `h` est centrée dans la fenêtre au pixel près, en 2D comme en
3D : origine et positions en pixels (`xy` des expressions) sont décalées de
`round((largeur − w) / 2)` et `round((hauteur − h) / 2)`.

| Clé  | Contenu                              | Défaut          |
| ---- | ------------------------------------ | --------------- |
| `3d` | figure 3D                            | 0               |
| `th` | angle θ de la caméra                 | π/2             |
| `ph` | angle φ de la caméra                 | 5π/2            |
| `rt` | bornes de θ                          | [-π/2, π/2]     |
| `rp` | bornes de φ (`null` : non bornée)    | [null, null]    |
| `pe` | perspective                          | 0               |
| `f2` | repère 2D d'une figure 3D (ci-après) | `null`          |
| `fl` | sol                                  | valeur de `3d`  |
| `ax` | axes affichés                        | 1               |
| `gr` | grille                               | 1               |
| `ox` | axe Ox (`oy` : Oy)                   | 1               |
| `lx` | Ox verrouillé (`ly` : Oy)            | 0               |
| `cz` | zoom centré sur l'origine            | 0               |
| `op` | abscisses et ordonnées positives     | 0               |
| `c`  | couleur des axes                     | `rgb(80,80,80)` |
| `f`  | taille des graduations               | 18              |
| `s`  | épaisseur des axes                   | 2               |
| `gw` | épaisseur de la grille               | 0.1             |
| `gd` | distances de la grille (Ox, Oy)      | [0, 0]          |
| `gs` | intervalles entre deux lignes        | 0               |
| `gc` | couleur de la grille                 | `null`          |
| `gl` | pointillés de la grille              | []              |
| `td` | distances des graduations (Ox, Oy)   | [0, 0]          |
| `ts` | styles des graduations (Ox, Oy)      | [0, 0]          |
| `nb` | nombres des graduations en gras      | 0               |
| `gg` | graduations à la manière de GeoGebra | 0               |
| `al` | noms des axes (Ox, Oy)               | ["", ""]        |
| `nu` | nombres des axes affichés (Ox, Oy)   | [1, 1]          |
| `au` | unités des nombres (Ox, Oy)          | ["", ""]        |
| `ah` | flèches des axes                     | 0               |
| `fc` | couleur du sol                       | `null`          |
| `fo` | opacité du sol                       | 0.3             |
| `fd` | écart des lignes du sol              | 1               |
| `fg` | couleur des lignes du sol            | `null`          |
| `fw` | épaisseur des lignes du sol          | 0.5             |
| `fe` | demi-côté du sol                     | 8               |

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

Sol d'une figure 3D (plan z = 0, carré centré sur l'origine, en unités de la
figure) : `fc` sa couleur (`null` : bleu vu de dessus, brun vu de dessous, comme
DGPad), `fo` l'opacité de son remplissage, `fd` l'écart de ses lignes,
parallèles aux axes et passant par l'origine (0 : aucune), `fg` leur couleur
(`null` : celle du sol, à demi transparente ; une couleur choisie est opaque),
`fw` leur épaisseur en pixels, `fe` son demi-côté. `ax` et `fl` sont
indépendants : le trièdre et le sol se montrent séparément.

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

| Type   | Objet                                  | Paramètres                                      |
| ------ | -------------------------------------- | ----------------------------------------------- |
| `Pt`   | point libre                            | `[x, y]` ou `[x, y, z]`                         |
| `Fix`  | point fixe                             | idem                                            |
| `Fp`   | point défini par une formule           | `[formule]`, `[formule, n1, n2]` (1)            |
| `On`   | point sur objet                        | `[support, paramètre]` (2)                      |
| `Mid`  | milieu                                 | `[A, B]`                                        |
| `Sym`  | symétrique de P par rapport à O        | `[O, P]`                                        |
| `Refl` | symétrique de P par rapport à d        | `[d, P]`                                        |
| `Rot`  | P tourné autour de O                   | `[O, P, a]`, `[O, P, a, d]` (15)                |
| `Dil`  | image de P par l'homothétie (O, k)     | `[O, P, k]` (15)                                |
| `Tra`  | P translaté du vecteur u               | `[u, P]` (15)                                   |
| `Inv`  | inverse de P dans le cercle c          | `[c, P]`                                        |
| `TC`   | centre du triangle ABC                 | `[A, B, C, n]` (18)                             |
| `Vtx`  | sommet k d'un polygone ou polyèdre     | `[polygone ou polyèdre, k]` (18)                |
| `Ctr`  | centre d'un cercle                     | `[cercle]`                                      |
| `DirP` | P + vecteur directeur unitaire de d    | `[d, P]`                                        |
| `PlI`  | intersection droite-plan               | `[d, plan]`                                     |
| `Int`  | intersection                           | `[o1, o2, branche]`, `[o1, o2, rang, P]` (3)    |
| `CyI`  | intersection droite-solide             | `[d, solide, 0 ou 1]` (4)                       |
| `Line` | droite (AB)                            | `[A, B]`                                        |
| `Ray`  | demi-droite [AB)                       | `[A, B]`                                        |
| `Seg`  | segment                                | `[A, B]`                                        |
| `Vec`  | vecteur                                | `[A, B]`                                        |
| `VecF` | vecteur libre, tracé depuis l'origine  | `[x, y]` ou `[x, y, z]`                         |
| `Par`  | parallèle à d par P                    | `[d, P]`                                        |
| `Perp` | perpendiculaire à d par P              | `[d, P]`                                        |
| `Med`  | médiatrice                             | `[A, B]`                                        |
| `EqL`  | droite d'équation g = d                | `[g, d]` (14)                                   |
| `Tan`  | tangente par P                         | `[P, conique, n]`, `[P, courbe]` (17)           |
| `Bis`  | bissectrice de l'angle AOB             | `[A, O, B]`                                     |
| `FA`   | angle fixe : demi-droite [OA) tournée  | `[A, O, degrés ou formule, sens trigo]` (10)    |
| `Ang`  | angle AOB                              | `[A, O, B]`                                     |
| `Cir`  | cercle de centre O passant par A       | `[O, A]`                                        |
| `C1`   | cercle de centre O et de rayon r       | `[O, r]`, `[O, r, axe]` (5)                     |
| `CAx`  | cercle d'axe d passant par P           | `[d, P]`                                        |
| `C3`   | cercle de centre O et de rayon AB      | `[A, B, O]`                                     |
| `C3p`  | cercle passant par trois points        | `[A, B, C]`                                     |
| `C3s`  | idem, dans leur plan de l'espace       | `[A, B, C]`                                     |
| `Arc`  | arc de A à C passant par B             | `[A, B, C]`                                     |
| `Sec`  | secteur de A à C passant par B         | `[A, B, C]`                                     |
| `CArc` | arc de centre M, de A à [MB)           | `[M, A, B]`, `[M, A, B, 1]` (16)                |
| `CSec` | secteur de centre M, de A à [MB)       | idem                                            |
| `Semi` | demi-cercle de diamètre [AB]           | `[A, B]` (16)                                   |
| `EqC`  | cercle d'équation g = d                | `[g, d]` (14)                                   |
| `Quad` | conique passant par cinq points        | `[A, B, C, D, E]`                               |
| `Ell`  | ellipse de foyers F, G passant par P   | `[F, G, P]`                                     |
| `Ell1` | ellipse de foyers F, G et demi-axe a   | `[F, G, a]` (5)                                 |
| `Hyp`  | hyperbole de foyers F, G passant par P | `[F, G, P]`                                     |
| `Hyp1` | hyperbole de foyers F, G et demi-axe a | `[F, G, a]` (5)                                 |
| `Prb`  | parabole de foyer F, de directrice d   | `[F, d]`                                        |
| `EqQ`  | conique d'équation g = d               | `[g, d]` (14)                                   |
| `Sph`  | sphère de centre O passant par A       | `[O, A]`                                        |
| `Sph1` | sphère de centre O et de rayon r       | `[O, r]` (5)                                    |
| `Cyl`  | cylindre d'axe AB et de rayon r        | `[A, B, r]` (4, 5)                              |
| `Cone` | cône de base de centre A, de sommet B  | `[A, B, r]` (4, 5)                              |
| `Disk` | disque d'un cylindre ou d'un cône      | `[solide, 0 ou 1]` (4)                          |
| `Cube` | cube sur le carré ABCD du plan ABC     | `[A, B, C]` (21)                                |
| `CubP` | cube sur AB parallèle à un plan        | `[A, B, plan ou polygone, ±1]` (20, 21)         |
| `CubZ` | cube sur AB, carré ABCD horizontal     | `[A, B, ±1]` (20, 21)                           |
| `Prsm` | prisme sur un polygone, jusqu'à P      | `[polygone, P]` (21)                            |
| `Pyr`  | pyramide sur un polygone, de sommet S  | `[polygone, S]` (21)                            |
| `Pl`   | plan passant par A, B et C             | `[A, B, C]` (19)                                |
| `PlP`  | plan par A parallèle à un plan         | `[A, plan]` (19)                                |
| `PlL`  | plan par A contenant d                 | `[A, d]` (19)                                   |
| `PlO`  | plan par A orthogonal à d              | `[A, d]` (19)                                   |
| `PlE`  | plan d'équation g = d                  | `[g, d]` (14, 19)                               |
| `PlPl` | intersection de deux plans             | `[plan, plan]` (19)                             |
| `Nrm`  | droite par P orthogonale à un plan     | `[plan, P]`                                     |
| `SphC` | section d'une sphère                   | `[sphère, plan ou sphère]` (19)                 |
| `PlS`  | section d'un polyèdre par un plan      | `[plan, A1, B1, …]`, `[plan, polyèdre]` (19)    |
| `CubV` | sommet de cube                         | `[A, B, C ou plan, k]` (20)                     |
| `Abv`  | point au-dessus d'un polygone          | `[polygone, h, k]` (20)                         |
| `NetV` | sommet du patron d'un polyèdre         | `[P, f, O1, E1, C1, Q1, …]` (20)                |
| `Net`  | patron d'un polyèdre, déplié de f      | `[polyèdre, f]` (5, 21)                         |
| `CyS`  | section d'un cylindre ou d'un cône     | `[solide, plan]` (4)                            |
| `Poly` | polygone                               | `[A, B, C, …]`                                  |
| `RegP` | polygone régulier de n côtés sur [AB]  | `[A, B, n]`, `[A, B, n, plan]` (18)             |
| `Loc`  | lieu de P quand M parcourt son support | `[P, M]`                                        |
| `Ex`   | expression                             | objet (6)                                       |
| `Cur`  | courbe y = f(x)                        | `[formule, min, max]` (23)                      |
| `Lst`  | liste de formules en k                 | `[nature, nombre, formule, formule?]` (7)       |
| `Seq`  | suite (`Sequence` de GeoGebra)         | `[nature, [boucle, …], formule, …]` (22)        |
| `ELst` | points d'une expression                | `[expression]` (12)                             |
| `Itr`  | itération de segments                  | `[[P1, Q1, …], niveaux, [[ax,ay,bx,by], …]]`    |
| `Txt`  | texte attaché à un point               | `[point, [dx, dy], texte]` (8)                  |
| `Img`  | image                                  | `[clé, largeur, hauteur, A, B?, C?]` (9)        |
| `Html` | texte HTML dans un cadre de la fenêtre | `[[x, y, largeur, hauteur], rayon, texte]` (11) |
| `Btn`  | bouton qui exécute un script           | objet (13)                                      |
| `Evt`  | script lancé par une `Ex` ou un point  | `{"on": expression ou point, "s": script}` (24) |
| `Mac`  | application d'une macro-construction   | `[macro, méthode, initiaux, branches?]` (25)    |
| `Out`  | final de rang k d'une application      | `[application, k]` (25)                         |

1. La formule peut être un script, dont la dernière instruction donne les
   coordonnées (`"var u=A[0]-B[0];[u,0]"`). `n1`, `n2` : les nombres
   (expressions, ou `null`) que déplace un glisser du point, pour chacune de
   ses coordonnées.
2. Droite (AB), segment, demi-droite : `t` tel que M = A + t·AB. Autre
   droite, définie par un point P et une direction : distance signée à P, en
   unités, le long de son vecteur directeur. Cercle : angle. Polygone,
   conique : couple. Lieu, liste, courbe : leur paramètre. Le couple d'une
   conique : coordonnées, dans le repère affine de trois points, du point
   ensuite projeté sur elle. Ces points sont ses trois premiers pour `Quad` ;
   le centre et les extrémités des deux demi-axes pour une ellipse ou une
   hyperbole ; pour une parabole, le sommet et les points à la distance p du
   foyer à la directrice, le long de celle-ci puis vers le foyer.
3. Deux solutions au plus (droite-cercle, cercle-cercle, droite-conique) :
   0 ou 1, droite-cercle dans l'ordre A + (t₀ + h)·u puis A + (t₀ − h)·u,
   droite-conique par paramètre croissant le long de la droite, cercle-cercle
   la solution à gauche puis à droite de O₁O₂ vue de la normale du premier.
   Le vecteur directeur d'une perpendiculaire (`Perp`) est, comme dans
   DGPad, celui de d tourné d'un quart de tour direct dans leur plan.
   Davantage (cercle-conique, conique-conique, avec une courbe) : rang de la
   solution par angle croissant autour du centre de gravité de toutes les
   solutions. Avec un point P : rang par distance décroissante à P.
4. Solide : cylindre, cône ou sphère ; l'intersection avec une droite
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
   (valeur constante ou de curseur), `"f"` (formule de fonction en x, y, z, t)
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
    pixels ; couleur (`c`, `o`) du cadre et du fond, taille (`s`) du cadre,
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
    le texte est gardé, pas le HTML). Sans `"s"`, il ne fait rien.
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
    d'une fonction (`Cur`), la tangente au point d'abscisse celle de P. Son
    point (2) est le point de contact.
18. `n` du centre : 1 cercle inscrit, 2 gravité, 3 cercle circonscrit,
    4 orthocentre, 5 cercle d'Euler (premiers centres de Kimberling). Le
    polygone régulier tourne dans le sens direct de A à B, ses autres
    sommets lui étant propres ; `k` d'un sommet compte depuis 0, dans
    l'ordre des sommets du polygone. Dans un plan, il tourne autour de la
    normale de ce plan.
19. Un plan est dessiné comme celui de GeoGebra, un carré de demi-côté h
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
    formule, ajoutée le 2026-10-21), ou les sommets d'un polygone (`polygons`, trois formules
    ou plus). Au plus 100 000 tours en tout. Lue par son nom, une suite de
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
    « onmouseup »), quand on l'appuie et le relâche. Plusieurs programmes
    d'un même geste s'exécutent chacun, dans l'ordre de la figure. Le script
    fixe aussi la place des points libres (`SET_EXP`). Avec `"e": "init"`,
    programme « oninit » de DGPad d'une expression ou d'un bouton `on`
    (« quand la figure s'ouvre » de l'éditeur) : il s'exécute une fois,
    quand la figure est ouverte (fichier `.dgo` ou import `.dgp`), avant ce
    que la page hôte applique (état élève), et pas quand l'éditeur
    reconstruit la figure.
25. Voir « Macro-constructions » ci-après.

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
| `arc`     | `Arc`, `Sec`, `CArc`, `CSec`, `Semi`                                          | son centre, son début, sa fin              |
| `conic`   | `Quad`, `Ell`, `Ell1`, `Hyp`, `Hyp1`, `Prb`, `EqQ`                            | —                                          |
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
  on ouvre la boîte (caché s'il l'était), sans effet sur le calcul. Ni `sc`
  ni `mg`. Décidé avec l'auteur le 2026-10-26, quand seuls les finaux en
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
  paramètre de l'entrée `On` (nombre ou couple) ; absent, celle du corps.
  Un initial ou un intermédiaire indéfini rend indéfinis les finaux qui en
  dépendent.

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
S'y ajoutent `sc` (condition d'affichage : indice d'une expression) et `mg`
(aimants : `[[indice, rayon en pixels], …]`), qui peuvent désigner un objet
postérieur.

| Clé  | Objets       | Contenu                                  | Défaut                            |
| ---- | ------------ | ---------------------------------------- | --------------------------------- |
| `c`  | tous         | couleur du trait                         | du type                           |
| `fc` | tous         | couleur de remplissage                   | `c` s'il est donné, sinon du type |
| `s`  | tous         | taille                                   | du type                           |
| `o`  | tous         | opacité                                  | du type                           |
| `h`  | tous         | 0 visible, 1 caché, 2 super-caché        | 0 (`Mac` : 2)                     |
| `sn` | tous         | nom affiché                              | 0                                 |
| `in` | tous         | inerte : ignore survol, clic et toucher  | 0                                 |
| `no` | tous         | place du nom déplacé (hors points)       | `null` (place de GeoGebra)        |
| `f`  | tous         | taille de police                         | 16                                |
| `p`  | tous         | précision (lieu : nombre d'échantillons) | -1 (`Loc` : 1000, `Html` : 4)     |
| `l`  | tous         | calque (entier, sous les `Html`)         | 0                                 |
| `sp` | points       | `circle`, `cross`, `diamond`, `rect`     | `circle`                          |
| `pb` | points       | épaisseur du contour                     | 1                                 |
| `np` | points       | direction du nom (radians)               | 0                                 |
| `nd` | points       | distance du nom (pixels)                 | `null` (deux fois la taille)      |
| `tk` | points       | trace                                    | 0                                 |
| `i`  | points       | pas de déplacement `[dx, dy]`            | [0, 0]                            |
| `fl` | points       | punaisé à sa place dans la fenêtre       | 0                                 |
| `sb` | `On`         | sur le bord du polygone                  | 0                                 |
| `an` | `On`, `Ex`   | animation (ci-dessous)                   | `null`                            |
| `pl` | `Poly`       | plan                                     | 0                                 |
| `su` | `Poly`       | section (garde ses sommets définis)      | 0, 1 pour `PlS`                   |
| `fx` | `Poly`       | fixé : ne se déplace pas par translation | 0                                 |
| `ar` | `Ang`, `FA`  | rayon de l'arc                           | 30                                |
| `ra` | `Ang`        | marque d'angle droit                     | `dgpad`                           |
| `dc` | `Seg`, `Vec` | décoration (0 à 6), `VecF` compris       | 0                                 |
| `dh` | tous         | motif de pointillés, en pixels           | `[]` (trait plein)                |
| `lo` | tous         | opacité du trait (GeoGebra)              | 1                                 |
| `is` | `Ex`         | pas du curseur                           | 0                                 |
| `cL` | `Ex`         | longueur du curseur                      | 200                               |
| `cV` | `Ex`         | curseur vertical                         | 0                                 |
| `cB` | `Ex`         | case à cocher                            | 0                                 |
| `iB` | `Ex`         | champ de saisie (largeur)                | 0                                 |
| `tx` | `Ex`         | LaTeX                                    | 0                                 |
| `cc` | `Ex`         | couleur du bouton du curseur             | `#780013`                         |
| `cr` | `Ex`         | rayon du bouton                          | 10                                |
| `co` | `Ex`         | opacité du bouton                        | 0                                 |
| `sg` | `ELst`       | épaisseur des segments                   | -1                                |
| `sa` | `ELst`       | flèche des segments `[l, d]` (px)        | `null`                            |

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

Animation `an` : `[vitesse, sens, extrémité]` ou `[vitesse, sens, extrémité,
GeoGebra]`. Comme dans DGPad, elle est lancée à l'ouverture et un bouton en bas
à gauche de la fenêtre la suspend et la reprend. Sens 1 ou -1 (sens courant à
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
paramètre de GeoGebra ramené de 0 à 1 (angle de -π à π sur un cercle, de 0 à 1
sur un arc ou un segment, une unité par côté d'un polygone, les droites,
demi-droites et courbes infinies comprimées comme le fait son `PathNormalizer`).

Défauts par type : `[remplissage, trait, taille, opacité]` (opacité absente :
non définie).

| Types                                                                     | Défauts                                   |
| ------------------------------------------------------------------------- | ----------------------------------------- |
| `Pt`, `On`, `DirP`                                                        | `rgb(255,255,255)`, `rgb(80,80,80)`, 6, 0 |
| `Fix`, `Fp`, `Mid`, `Int`, `CyI`, `PlI`, `Ctr`, `Sym`, `Refl`             | `rgb(180,180,180)`, `rgb(80,80,80)`, 6, 0 |
| `Rot`, `Dil`, `Tra`, `Inv`, `TC`, `Vtx`                                   | `rgb(180,180,180)`, `rgb(80,80,80)`, 6, 0 |
| `CubV`, `Abv`, `NetV`                                                     | `rgb(180,180,180)`, `rgb(80,80,80)`, 6, 0 |
| `Line`, `Par`, `Perp`, `Med`, `EqL`, `Tan`, `PlPl`, `Nrm`                 | `rgb(35,141,227)`, `rgb(80,80,80)`, 2     |
| `Ray`, `Bis`                                                              | `rgb(35,141,227)`, `#993300`, 2           |
| `Seg`, `Vec`, `VecF`                                                      | `rgb(35,141,227)`, `rgb(180,80,80)`, 4    |
| `FA`                                                                      | `#006633`, `#006633`, 1, 0                |
| `Ang`                                                                     | `#006633`, `#006633`, 4, 0                |
| `Cir`, `C1`, `CAx`, `C3`, `C3p`, `C3s`, `Arc`, `Sec`, `CyS`, `EqC`        | `#CC66CC`, `#CC66CC`, 2, 0                |
| `CArc`, `CSec`, `Semi`, `SphC`, `Disk`                                    | `#CC66CC`, `#CC66CC`, 2, 0                |
| `Quad`, `Ell`, `Ell1`, `Hyp`, `Hyp1`, `Prb`, `EqQ`                        | `#CC66CC`, `#CC66CC`, 2, 0                |
| `Sph`, `Sph1`, `Poly`, `RegP`, `PlS`                                      | `rgb(35,141,227)`, `rgb(80,80,80)`, 2, 0  |
| `Cyl`, `Cone`, `Cube`, `CubP`, `CubZ`, `Prsm`, `Pyr`, `Net` (opacité 0,4) | `rgb(35,141,227)`, `rgb(80,80,80)`, 2     |
| `Pl`, `PlP`, `PlL`, `PlO`, `PlE` (`pl` : 1)                               | `rgb(35,141,227)`, `rgb(80,80,80)`, 2, 0  |
| `Loc`, `Cur`                                                              | `#0b5b94`, `#0b5b94`, 2                   |
| `Lst`, `ELst`, `Itr`                                                      | `#656148`, `#656148`, 2                   |
| `Ex`                                                                      | `rgb(0,0,178)`, `rgb(0,0,178)`, 7, 0      |
| `Txt`, `Img`                                                              | `#000000`, `#000000`, 1                   |
| `Html`                                                                    | `#000000`, `#000000`, 3                   |

## État élève

L'état d'une figure est ce qu'une manipulation y a changé par rapport à sa
figure de base (le `.dgo` chargé, ou la figure qu'en a tirée la requête
`rebase` du mode intégré, voir `EMBED.md`) : un objet JSON clair, séparé de la figure,
indexé par nom, limité aux objets **dont la valeur diffère** de la figure de
base (égalité exacte des nombres JSON). État vide : figure non manipulée.

**Invariant** : toute modification qu'une manipulation de l'utilisateur peut
faire à la figure, hors vue et traces, se retrouve dans l'état. Tout nouvel
objet manipulable y entre donc, par une nouvelle ligne du tableau ci-dessous.

```json
{ "M": [2.1, -0.4], "N": 0.35, "k": 31, "cb": 1, "I2": 3 }
```

| Objet                                                  | Valeur                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `Pt` (point libre), punaisé (`fl`) compris (3)         | `[x, y]` dans une figure plane, `[x, y, z]` dans une figure 3D (1) |
| `On` (point sur objet), final de macro compris         | son paramètre, sous la forme de `.dgo` : nombre ou couple (4)      |
| `Ex` de valeur constante numérique (`"v"`)             | le nombre                                                          |
| `Int` sans point P dont les solutions sont suivies (2) | le numéro de branche de `.dgo` (note 3 des objets)                 |
| `C1` à rayon numérique (non formule)                   | le rayon, qu'un glisser du cercle change                           |
| `VecF` (vecteur libre)                                 | ses coordonnées, comme un point libre (1)                          |
| `Mac` qui a des branches                               | `branches`, sous sa forme de `.dgo` (note 25 des objets)           |

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
   connaître son objet. Un point sur polygone ou sur conique, de paramètre
   couple, n'en accepte pas : un couple y reste son paramètre.

- Les `Ex` de valeur constante couvrent les curseurs, les cases à cocher, les
  nombres que modifie un champ de saisie ou le glisser d'un point `Fp`.
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
