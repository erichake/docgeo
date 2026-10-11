# Éditeur de constructions — mémo de conception

Décisions prises avec l'auteur (conversation du 2026-10-11), avant tout code.
Le chantier est ouvert depuis le 2026-10-11 (exception dans `AGENTS.md`) ;
son avancement est à la fin de ce mémo.

## Positionnement

- `index.html` reste le **lecteur** (et son mode intégré `?embed`), inchangé.
- L'éditeur est une page distincte, **`editor.html`**, dont le code vit dans
  **`src/editor/`**.
- La dépendance est **à sens unique** : l'éditeur importe le moteur, le moteur
  et le lecteur n'importent jamais `src/editor/`. Un test le vérifie.
- L'éditeur est dans la même page que le moteur et l'appelle directement :
  pas de pilotage par `postMessage` comme le mode intégré, trop lent pour la
  présélection, l'aperçu qui suit le pointeur et la désignation à chaque
  mouvement.

## Build

- **Un seul build Vite pour les deux pages** (`vite.config.ts`,
  `npm run build`, `zz_build_for_doctools.command`), dans
  `doctools_MAIN/public/apps/docgeo`, que DocTools envoie en production :
  `index.html` (lecteur) et `editor.html` (éditeur). Deux builds vidant le
  même dossier (`emptyOutDir`) s'effaceraient l'un l'autre.
- Les deux pages partagent le fichier du moteur (`assets/engine-*.js`) ; le
  lecteur charge en plus `assets/index-*.js`, l'éditeur `assets/editor-*.js`.
  Le lecteur ne charge jamais le code de l'éditeur.
- On ne construit donc pas l'un sans l'autre : une modification de l'éditeur
  change aussi les fichiers publiés avec le lecteur.

## Coût pour le lecteur : 0 à 2 Ko

Le lecteur pesait 302 Ko (97 Ko en gzip) le 2026-10-11. L'éditeur ne doit pas
l'alourdir de plus de 0 à 2 Ko, ce que permet le découpage du build (le code
propre à l'éditeur reste dans son fichier) :

- tout le code propre à l'éditeur est écrit en **fonctions libres** dans
  `src/editor/`, **jamais en méthodes des classes d'objets**, que le
  tree-shaking ne retire pas (une méthode par classe d'objet finirait dans le
  lecteur) ;
- la désignation des objets sous le pointeur s'appuie sur ce que les objets
  savent déjà faire (`nearestPoint`, projections des aimants…) ;
- l'éditeur pose ses propres écouteurs sur le SVG, avant ceux du moteur, et
  crée son calque d'aperçu avec `dom.ts` ;
- les fonctions de création de `dgo.ts` sont exportées pour l'éditeur (un
  export ne coûte rien) ;
- annuler / refaire : un instantané `.dgo` par action (`writeDgo` /
  `readDgo`), assez rapides pour cela.

Seul un point d'accroche indispensable, s'il en faut un, est ajouté au
moteur. Mesurer la taille du lecteur à chaque étape.

## Deux modes de construction

Le meilleur de DGPad et de GeoGebra :

- **Désignation préfixée, comme DGPad** : on clique sur un objet, les outils
  qui le concernent apparaissent autour de lui, puis on désigne les autres
  arguments. Un clic dans le vide crée un point libre, sur un objet un point
  sur objet, près de deux objets une intersection.
- **Saisie textuelle, comme la barre de saisie de GeoGebra** :
  `M = Milieu(A, B)`, avec complétion des commandes et des noms d'objets
  filtrés par type.

Les deux modes produisent la même chose : un appel de commande typé
`nom = Commande(arguments)`, et ils se nourrissent l'un l'autre :

- une construction au geste affiche la ligne qu'elle produit : l'élève
  apprend le langage en manipulant ;
- pendant la saisie, un clic sur un objet de la figure insère son nom, et les
  objets acceptables pour l'argument en cours sont mis en évidence ;
- survoler une ligne fait briller son objet, et inversement ;
- une seule pile d'annulation.

## La construction est la source, le texte une projection

- Comme la vue Algèbre de GeoGebra : chaque objet s'affiche en une ligne
  `nom = Commande(args)`. Taper une ligne crée l'objet, modifier une ligne le
  redéfinit, déplacer un point libre met à jour ses coordonnées dans sa ligne.
- Les styles restent hors du texte (panneau de propriétés).
- `.dgo` reste le format de stockage. L'éditeur produit des **entrées `.dgo`**
  ajoutées à la figure, sans toucher aux classes internes : la validation est
  celle de la lecture, et tout ce qu'on construit s'enregistre.
- Une entrée `.dgo` et une ligne de texte se correspondent presque
  bijectivement. Tant que le format n'est pas diffusé, veiller à ce que chaque
  type d'objet `.dgo` garde une forme textuelle naturelle.

## Un catalogue de commandes unique

Chaque commande déclare sa signature (type de chaque paramètre et du
résultat), son nom localisé, son icône, son aide et l'entrée `.dgo` qu'elle
produit. Ce catalogue alimente :

- les outils contextuels (les commandes dont un paramètre accepte l'objet
  désigné) ;
- la complétion du texte ;
- la validation, ligne par ligne ;
- l'enregistrement.

Base existante : les types d'objets et de paramètres et la fonction `accepts`
de `src/import/dgp_commands.ts`.

## Langage textuel

- **Proche de GeoGebra, pas identique** : la syntaxe familière aux enseignants
  sur le noyau courant (points, droites, cercles, intersections,
  transformations, curseurs), sans ses bizarreries (règles de nommage
  automatique, commandes dont le résultat change de nature selon les
  arguments, messages d'erreur peu pédagogiques).
- **Aucune forme d'une commande n'en prolonge une autre** (décidé le
  2026-10-11) : les objets déjà désignés disent toujours si la ligne
  continue, donc si un clic écrit `, ` ou `)`. Les types peuvent départager
  les formes (`Milieu(A, B)` / `Milieu(s)`, `Cercle(O, A)` / `Cercle(O, 2)`),
  pas leur nombre d'arguments : là où GeoGebra prolonge une commande, on en
  crée une autre, dont le nom contient le sien (`CercleCirconscrit(A, B, C)`,
  `AutreIntersection(a, b, P)`), et taper l'ancienne forme propose la
  nouvelle. Exceptions : `Polygone`, au nombre de sommets libre, et les
  formes qui finissent par un nombre, tapé au clavier
  (`PointFixe(x, y)` / `(x, y, z)`). Un test vérifie la règle sur tout le
  catalogue.
- Noms de commandes localisés (Milieu / Midpoint), ramenés à une forme
  canonique.
- Réutilisation possible de `src/import/ggb_translate.ts` : une ligne tapée,
  ramenée à la commande GeoGebra canonique (nom, arguments, résultat), a la
  même structure qu'une commande du `geogebra.xml`. Il faudrait le découper
  pour traduire une commande à la fois.
- Grammaire fermée, lue par notre interpréteur (comme `dgp_formula.ts`),
  jamais par `eval`.
- Éditeur de texte : une saisie ligne à ligne avec une liste de complétion
  maison plutôt que CodeMirror ou Monaco, bien plus lourds.

## Points délicats

- **Redéfinition** : changer les parents d'un objet peut casser l'ordre de
  construction, que le moteur suppose topologique (`sequence`,
  `objects_collector`). Réordonner, et refuser les cycles avec un message
  clair. Ajouter des objets à la fin préserve l'ordre.
- **Ambiguïtés que le geste résout implicitement** : l'intersection choisie
  parmi plusieurs, la position d'un point sur objet. Le texte les rend
  explicites (indice ou « le plus proche de », paramètre), et le geste les
  écrit dans sa ligne.
- **Erreurs partielles** : une ligne fausse reste affichée en erreur sans
  casser le reste.
- **Suppression** d'un objet dont d'autres dépendent : supprimer les
  dépendants (`construction.removeObject` le fait déjà) ou les marquer non
  définis.
- **3D** : le langage et la désignation doivent couvrir les figures 3D.

## Anneau d'outils

Décidé le 2026-10-11, pour ne pas dérouter l'élève devant un anneau de seize
icônes :

- **Familles à places fixes** : les outils sont regroupés par familles,
  séparées par un vide et teintées chacune d'une couleur (bande derrière les
  boutons, bord des boutons). Dans le sens horaire depuis le haut :
  suppression ; points (point sur objet, intersection, milieu ou centre) ;
  droites (segment, droite, demi-droite, vecteur) ; constructions
  (perpendiculaire, parallèle, médiatrice, bissectrice) ; cercles (centre et
  point, trois points, sphère) ; polygone et angle ; symétries (centrale,
  axiale). Chaque outil garde toujours la même place, quel que soit l'objet
  désigné ; deux outils qui ne s'affichent jamais ensemble partagent une
  place (milieu de deux points, d'un segment, centre d'un cercle). La bande
  d'une famille couvre toutes ses places, même celles sans outil pour
  l'objet : l'élève retient la place autant que l'icône. Le rayon de
  l'anneau est donc fixe (148 px). Près d'un bord de la figure, l'anneau
  se décale vers l'intérieur juste assez pour y tenir entier, plutôt que de
  se replier, ce qui déplacerait les outils ; un peu plus si l'objet
  tombait sous un bouton, qu'il reste visible au-delà. Un trait pointillé
  relie alors le centre de l'anneau à l'objet.
- **Ligne de l'outil** : survoler une icône affiche dans la consigne la
  ligne que l'outil écrira, ses arguments manquants en `…`
  (`M = Milieu(A, …)`), et ce qu'il reste à désigner ; `A =` pour
  supprimer. La consigne garde cette ligne pendant la désignation des
  arguments, au doigt comme à la souris.

Plus tard : des jeux d'outils choisis par l'enseignant (« Collège début »,
« Tout »…), enregistrés dans la figure ou passés par l'URL. Un anneau à deux
niveaux (familles, puis outils) seulement si l'anneau reste trop dense.

## Lien avec le lecteur

Un lien « modifier cette figure » pourrait ouvrir la figure du lecteur dans
`editor.html` (par l'URL ou en passant son `.dgo`) : le lecteur reste le
format de diffusion, l'éditeur l'atelier.

## Avancement

Fait (2026-10-11) :

- `editor.html`, `src/editor/`, construits avec le lecteur (section
  « Build »).
- Point d'accroche du moteur : `addDgoEntries` (`src/dgo.ts`), qui ajoute des
  entrées `.dgo` après les objets de la figure et que `readDgo` utilise
  lui-même. Lecteur : 303 037 octets, `index` (15 196) + `engine` (287 841),
  soit +367 octets (+301 en gzip) ; l'éditeur ajoute 28,7 Ko (11 Ko en
  gzip) au moteur.
- Catalogue (`catalog.ts`) : signatures typées, noms français et anglais
  (comparés sans casse ni accents), écriture et relecture des entrées `.dgo`
  de `Pt`, `Fix`, `On`, `Mid`, `Line`, `Seg`, `Ray`, `Vec`, `Par`, `Perp`,
  `Med`, `Bis`, `Cir`, `C1` (rayon numérique), `C3`, `C3p`, `C3s`, `Arc`,
  `Sec`, `Ctr`, `Int`, `Poly`, `Ang`, `Sym`, `Refl`, `Quad`, `Sph`, `Loc`.
  Les autres objets s'affichent en lecture seule (`nom = …`).
- Langage (`text.ts`) : `nom = Commande(args)`, `A = (x, y)` ou `(x, y, z)`
  pour un point libre, `nom =` supprime ; noms non identifiants entre
  accents graves ; nombres arrondis à 4 décimales à l'affichage.
  Intersection : `Intersection(a, b)` pour deux droites, sinon
  `Intersection(a, b, n)` (n de 1 à 4) ; `AutreIntersection(a, b, P)`,
  la plus éloignée de P (l'ordre de l'entrée `.dgo`, qui ne sert que si P
  n'est pas défini, est remis à 0 par une redéfinition).
  Point sur objet : `Point(objet, t)`, ou `Point(objet, a, b)` sur un
  polygone ou une conique. Cercle par trois points :
  `CercleCirconscrit(A, B, C)`.
- Vue texte : une ligne modifiable par objet ; Entrée valide, Échap annule ;
  un point libre modifié change en place, sinon redéfinition (réordonnement
  topologique stable, cycles refusés, renommage, style gardé, réduit aux clés
  communes si le type change) ; complétion des commandes et des objets
  acceptés par l'argument en cours (selon les arguments déjà écrits), mis
  en évidence dans la figure ; un clic sur un objet (ou son choix dans la
  liste) insère son nom, suivi en fin de ligne de `, ` si toutes les formes
  possibles de la commande attendent un argument de plus, de `)` si aucune,
  de rien sinon (nom inconnu, polygone) ; redésigner le premier sommet
  d'un polygone ferme la parenthèse, et la ligne fermée ainsi est validée
  aussitôt ; pendant la saisie, l'aperçu suit le pointeur comme pour un
  outil (« fil à la patte ») ; dans la ligne de saisie (pas dans celles des
  objets, reconstruites avec la figure), désigner un point qui n'existe pas
  le crée comme un geste (point libre, sur objet ou intersection) ; survol
  ligne ↔ objet ; un glisser met à jour les lignes. Éditeur 34,5 Ko
  (13,5 Ko en gzip), lecteur inchangé.
- Gestes (`pick.ts`, `tools.ts`) : clic dans le vide → point libre (plan
  z = 0 en 3D) ; clic sur un objet → anneau de ses outils (dont supprimer) ;
  désignation des arguments suivants avec aperçu qui suit le pointeur ; un
  point désigné est un point existant, une intersection (branche la plus
  proche), un point sur objet ou un point libre ; polygone fermé en
  redésignant son premier sommet. Visée (pour le doigt, sans survol) : un
  outil en attente, le pointeur enfoncé dans la figure ne déplace rien,
  montre l'aperçu et désigne là où il est relâché ; enfoncer l'icône d'un
  outil le choisit, et le même geste peut continuer jusqu'à la cible comme
  dans DGPad, mais relâché sur l'icône l'outil reste simplement en attente
  (l'élève qui lâche trop tôt ne perd rien) ; relâché hors de la figure,
  rien n'est désigné. Un bouton ✕ dans la consigne abandonne l'outil
  (Échap au clavier). Styles de création de DGPad : noms des
  points affichés, polygones, sphères et secteurs remplis à 20 %.
- Une pile d'annulation (instantanés `.dgo` sans la vue), Cmd-Z,
  Cmd-Maj-Z, Cmd-Y ; ouverture `.dgo`, `.dgp`, `.ggb` (bouton ou `?url=`),
  Cmd-S.
- Tests : `tests/unit/editor_text.test.ts`, `tests/unit/editor_boundary.test.ts`
  (le lecteur n'importe pas `src/editor/`), `tests/browser/editor.test.ts`.

- Anneau d'outils en familles à places fixes, ligne de l'outil dans la
  consigne (section « Anneau d'outils ») : éditeur 30,7 Ko (12,1 Ko en
  gzip), lecteur inchangé.
- Aperçu dès le premier argument (« fil à la patte ») : quand il manque
  encore un argument après celui que désigne le pointeur, un point caché
  le remplace, comme dans DGPad : cercle de diamètre [premier point,
  pointeur], angle de 60° et bissectrice (demi-droite passant par le
  premier point) au pointeur, polygone réduit à un segment. Éditeur
  31,5 Ko (12,5 Ko en gzip), lecteur inchangé.

Reste à faire :

- Jeux d'outils de l'enseignant (section « Anneau d'outils »).

- Expressions et curseurs (`a = 3`, `Curseur(0, 10)`), rayons et angles en
  formule (`Cercle(O, 2*a)`), en réutilisant `dgp_formula.ts`.
- Panneau de propriétés (couleur, taille, nom affiché, visibilité).
- Points sur objet et intersections au geste sur les lieux et listes ;
  choix explicite de l'intersection quand le geste est ambigu.
- 3D : points libres dans le plan de l'écran des figures DGPad (`f2`) et
  hors du plan z = 0.
- Lien « modifier cette figure » depuis le lecteur.
- Réutilisation de `ggb_translate.ts` pour accepter davantage de commandes
  GeoGebra.
- Mesures de fluidité sur des figures de plusieurs milliers d'objets (la vue
  texte est entièrement reconstruite après chaque changement).
