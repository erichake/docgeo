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
  boutons, bord des boutons). L'anneau ne porte que des outils géométriques
  (2026-10-12) : les actions sur l'objet sont dans la barre (section
  « Actions sur l'objet sélectionné »). Dans le sens horaire depuis le haut :
  points (point sur objet, intersection, milieu ou centre) ;
  droites (segment, droite, demi-droite, vecteur) ; constructions
  (perpendiculaire, parallèle, médiatrice, bissectrice) ; cercles (centre et
  point, trois points, sphère) ; polygone et angle ; symétries (centrale,
  axiale). Chaque outil garde toujours la même place, quel que soit l'objet
  désigné ; deux outils qui ne s'affichent jamais ensemble partagent une
  place (milieu de deux points, d'un segment, centre d'un cercle). La bande
  d'une famille couvre toutes ses places, même celles sans outil pour
  l'objet : l'élève retient la place autant que l'icône. Le rayon de
  l'anneau est donc fixe (138 px). Un objet sans outil géométrique (texte,
  expression, curseur…) n'ouvre pas d'anneau : le clic le sélectionne
  seulement. Près d'un bord de la figure, l'anneau
  se décale vers l'intérieur juste assez pour y tenir entier, plutôt que de
  se replier, ce qui déplacerait les outils ; un peu plus si l'objet
  tombait sous un bouton, qu'il reste visible au-delà. Un trait pointillé
  relie alors le centre de l'anneau à l'objet. L'anneau resté ouvert suit
  son objet quand on le déplace, lui ou ses parents, ou qu'on déplace ou
  zoome la vue : il reste accroché au point de l'objet le plus proche de
  là où il était, où « point sur objet » placera le point ; un polygone ou
  une sphère l'emmènent avec leur centre.
- **Ligne de l'outil** : survoler une icône affiche dans la consigne la
  ligne que l'outil écrira, ses arguments manquants en `…`
  (`M = Milieu(A, …)`), et ce qu'il reste à désigner. La consigne garde
  cette ligne pendant la désignation des arguments, au doigt comme à la
  souris.

Plus tard : des jeux d'outils choisis par l'enseignant (« Collège début »,
« Tout »…), enregistrés dans la figure ou passés par l'URL. Un anneau à deux
niveaux (familles, puis outils) seulement si l'anneau reste trop dense.

## Actions sur l'objet sélectionné

Décidé le 2026-10-12. Les utilitaires de DGPad (sa rangée grise : nom,
propriétés, corbeille, ancre, aimant, calculatrice, Blockly…) se
multiplieraient sur l'anneau au fil des implémentations. Partage :

- **l'anneau construit** à partir de l'objet (outils géométriques) ;
- **la barre agit** sur l'objet sélectionné (supprimer, redéfinir…) ;
- **le panneau de propriétés règle** ses attributs : ce qui, dans DGPad,
  était un outil mais ne change qu'un attribut (nom, ancre, trace…) y
  devient un champ ou une case ; pas les aimants, qui désignent d'autres
  objets de la figure (section « Aimants ») ;
- ce qui ne dépend pas de l'objet (calculatrice, modes) est un bouton
  permanent de la barre, comme la gomme.

Un nouvel utilitaire passe ce tri avant d'être placé.

La sélection d'un objet par un clic (avec ou sans anneau) fait apparaître
dans la barre une zone contextuelle, centrée entre les groupes permanents
de gauche et annuler / refaire : une pastille de la couleur de l'objet et
son nom (qui nomme aussi le groupe pour les lecteurs d'écran), puis ses
actions, la corbeille la première, en rouge. Pour les distinguer des
boutons carrés permanents, ses actions ont l'aspect des outils de
l'anneau, comme si elles en venaient : boutons ronds pastel sur une bande
en pilule, teinte grise de l'ancienne famille « objet », survol bleu plein
(rouge pour la corbeille). La zone glisse en place en même temps que
l'anneau s'ouvre, pour attirer l'œil vers la barre (sans mouvement si les
animations sont réduites) ; elle disparaît avec l'anneau, dès qu'un outil
de l'un ou une action de l'autre est appliqué, ou par Échap ou un clic
ailleurs. Panneau de propriétés ouvert, un clic sélectionne l'objet dans
le panneau sans anneau ni zone. Survoler une action affiche sa ligne dans
la consigne (`A =` pour supprimer). Suppr et Retour arrière suppriment
l'objet sélectionné, celui du panneau quand il est ouvert. Le bouton
« Propriétés » de la barre (curseurs) reste une bascule permanente : il
ouvre ou ferme le panneau, qui montre l'objet sélectionné. L'utilisateur
attend dans la zone contextuelle tout ce qui concerne l'objet : elle a son
propre bouton « Réglages » (roue dentée, icône distincte), un poussoir qui
ouvre le panneau sur l'objet, comme le faisait le bouton de l'anneau ; la
bascule passe alors à « on », ce qui montre que les deux mènent au même
panneau. L'objet sélectionné brille dans la figure, ce qui compte surtout
quand aucun anneau ne s'ouvre.

La barre est déjà pleine à 320 px : sous 600 px, la zone contextuelle
flotte, centrée, juste sous la barre, par-dessus le haut de la figure,
sans la décaler.

## Aimants

Décidé le 2026-10-12, l'idée de DGPad (son outil aimant, `MagnetManager`)
avec une interface plus parlante. Un point libre (le seul que le moteur
aimante quand on le glisse) a dans la zone contextuelle un bouton
« Aimants », le dernier, comme dans la rangée grise de DGPad. Il ouvre un
mode, qu'on doit voir et savoir quitter sans rien deviner :

- la zone contextuelle en devient le bandeau : « Aimants de P » et un
  bouton « Terminé » bleu, à la place des actions (Suppr n'agit plus sur
  le point) ; la consigne dit « … touchez le vide pour terminer » ;

- le point brille en bleu, ses cibles en rouge, comme dans DGPad, et le
  reste de la figure (grille et axes compris) passe sous un voile blanc
  (opacité 0,4, le `rgba(255,255,255,0.6)` de DGPad) ; un objet survolé en
  sort, pour montrer ce qu'un toucher désignerait ;
- toucher un objet en fait une cible, avec la dernière attraction réglée
  (20 px au départ), ou la choisit si elle l'était déjà ; un menu départage
  les objets superposés. Les cibles possibles sont celles du moteur
  (points, droites, cercles, coniques, listes, courbes), sauf le point et
  ses dépendants, qui bougeraient avec lui ;
- l'attraction de la cible choisie se règle par un curseur dans une carte
  posée au-delà de sa zone, sous l'endroit où elle attire le plus le
  point (au-dessus de la consigne), à la distance fixée quand la cible est
  choisie : la carte ne bouge pas pendant qu'on règle, seulement si la
  figure bouge. Les crans sont ceux de DGPad (« Aucune » retire l'aimant,
  1, 2, 5… 1000 px, « Partout ») ;
- nouveauté : la zone d'attraction de chaque cible est dessinée sous elle,
  en rouge pâle (la forme de la cible épaissie de l'attraction de part et
  d'autre, un disque pour un point), plus marquée pour la cible choisie ;
  on voit d'un coup tout le « champ » du point ;
- le point se glisse pendant le mode pour essayer ; zones et carte suivent
  la figure, glissée ou zoomée ;
- un toucher dans le vide quitte le mode, comme il ferme partout ailleurs
  (anneau, menu, sélection) ; « Terminé » et Échap aussi. En sortir par
  erreur ne coûte rien : les aimants restent. Chaque réglage est une étape
  d'annulation (au relâchement du curseur).

Le moteur garde parmi les aimants une cible supprimée : l'éditeur les
retire après chaque changement, sinon l'enregistrement ne pourrait pas la
nommer.

## Gomme

Décidé le 2026-10-11, comme dans DGPad plutôt que par le menu contextuel de
GeoGebra (un objet à la fois, et un objet caché ne se retrouve que par son
nom ; pas de clic droit au doigt) :

- un bouton « Gomme » de la barre, permanent, active un mode : les objets
  cachés y apparaissent pâles (fantômes) et se désignent ; toucher un objet
  le cache ou le montre, plusieurs à la suite ; ni anneau ni point libre ;
  le glisser déplace toujours. Échap, le bouton ou le focus dans le texte
  en sortent.
- Les objets super-cachés (`h: 2` : objets internes des macros DGPad,
  objets auxiliaires de l'import GeoGebra, que GeoGebra ne dessine pas) ne
  deviennent jamais des fantômes.
- Un fantôme est montré (`hidden = 0`) pour être dessiné comme les autres,
  et caché seulement dans la figure enregistrée et dans la pile
  d'annulation (`eraser.ts`, `withGhostsHidden`).

## Barre d'actions et historique

Les actions sont des pictogrammes SVG dans une barre fixe en haut de la
fenêtre, au-dessus du panneau et de la figure. Groupes séparés : à
gauche ouvrir / enregistrer et gomme / repère / propriétés / historique ;
au bout de la barre, comme dans GeoGebra, annuler / refaire (décidé le
2026-10-12). La zone contextuelle de l'objet sélectionné se centre entre
les deux (section « Actions sur l'objet sélectionné »). Leur place reste la même quand le panneau est fermé. Chaque bouton a une
infobulle et un nom accessible ; les bascules montrent leur état en bleu.

Le panneau « Construction » se ferme par la croix de son en-tête ou par
le bouton historique de la barre, qui permet aussi de le rouvrir. La figure
récupère sa largeur sans changer les objets ; les consignes se recentrent
dans l'espace disponible. Le panneau glisse depuis la gauche en 240 ms,
avec un ralentissement doux, et la figure accompagne le mouvement. Les
préférences de réduction des animations sont respectées ; un panneau fermé
est retiré de la navigation au clavier dès le début du mouvement.
Sur les écrans de 600 px ou moins, le panneau
démarre fermé ; la barre reste sur une seule ligne à 320 px.

## Panneau de propriétés

Le bouton « Propriétés » de la barre ouvre un panneau à droite. Un clic
dans la figure, sur une ligne de construction, ou un choix dans la liste du
panneau sélectionne l'objet. La liste permet de retrouver aussi les objets
cachés ; les objets super-cachés en sont exclus. Dans ce mode, un clic vide
ne crée pas de point et les boutons, cases à cocher et champs de la figure
se désignent sans s'actionner. Les points et les curseurs restent déplaçables.

Les contrôles sont adaptés à l'objet : nom, couleurs, taille, opacités,
pointillés, calque, visibilité, nom affiché et décimales ; forme, position du
nom, trace et pas des points ; codage des segments ; rayon et marque des
angles droits ; échantillonnage des lieux ; segments des listes ; apparence
des curseurs et animation des points sur objet et des curseurs. Les styles
peuvent s'appliquer aux objets de la même classe. Les modifications sont
immédiates, enregistrées dans les styles `.dgo` existants et annulables ;
une saisie numérique ne produit qu'une étape d'historique à sa validation.
Les champs numériques se règlent aussi en cliquant-glissant horizontalement
à la souris : gauche pour diminuer, droite pour augmenter, Maj pour ralentir
d'un facteur dix. Le pas et les bornes sont respectés ; un glissement ne
produit qu'une étape d'historique au relâchement. Un clic simple sélectionne
le nombre pour la saisie ; tant que le champ est en saisie, les gestes natifs
de sélection du texte restent disponibles. Le tactile garde la saisie native
et le défilement du panneau.
Le renommage reconstruit la figure à partir de son `.dgo`, en conservant
les références des dépendants, y compris les formules.

Le panneau se ferme par sa croix, son bouton ou Échap. Sous 900 px, les deux
panneaux s'ouvrent alternativement ; sous 600 px, les propriétés recouvrent
la figure. La barre tient toujours sur une ligne à 320 px. Tout le code
et les styles CSS du panneau restent dans `src/editor/`.

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

- Gomme (section « Gomme ») ; l'import GeoGebra super-cache ses objets
  auxiliaires. Éditeur 35,5 Ko (13,8 Ko en gzip), lecteur inchangé.

- Bouton bascule « Repère » de la barre : montre ou cache les axes avec la
  grille (en 3D, le trièdre avec le plancher), comme `isAxis` de DGPad ;
  hors de la pile d'annulation comme le reste de la vue, mais enregistré.
  Éditeur 36,3 Ko (14,2 Ko en gzip), lecteur inchangé.

- Pictogrammes SVG de l'anneau harmonisés : traits et points plus fins,
  objet créé en rouge, objets de départ gris, géométrie auxiliaire atténuée ;
  fonds pastel par famille, ombres discrètes et survol bleu franc avec
  pictogramme blanc.
  Éditeur 37,3 Ko (14,5 Ko en gzip), lecteur inchangé.

- Barre d'actions à icônes, panneau de construction refermable (section
  « Barre d'actions et historique »). Éditeur 41,7 Ko (15,8 Ko en gzip),
  lecteur inchangé. Vérifiés sur ordinateur et mobile : redimensionnement,
  coordonnées, annulation, bascules et ouverture / enregistrement. Translation
  vérifiée aussi lors d'une inversion du mouvement et avec les préférences
  de réduction des animations.

- Panneau de propriétés (section « Panneau de propriétés »), avec tests de
  rendu, sauvegarde, sélection des objets cachés, application aux objets du
  même type, trace et animation. Vérifiés aussi dans `editor.html` :
  désignation, clavier, renommage et dépendants, annuler / refaire,
  disposition ordinateur et mobile. Éditeur : 56,0 Ko, CSS inclus (20,5 Ko
  en gzip) ; lecteur : +27 octets (+42 en gzip) par rapport à l'étape
  précédente, sans changement du moteur.

- Champs numériques réglables par cliquer-glisser (section « Panneau de
  propriétés ») : effet immédiat, Maj pour le réglage fin, bornes et pas
  respectés, saisie clavier et tactile conservée, une seule annulation par
  glissement. Vérifiés avec de vrais gestes de souris et dans `editor.html`.
  Éditeur : 58,0 Ko, CSS inclus (21,2 Ko en gzip) ; lecteur inchangé.

- Bouton « Propriétés » dans l'anneau, à côté de la corbeille, dans une
  famille « objet » grise centrée sur le haut (section « Anneau d'outils ») ;
  le rayon gagne une place (environ 6 px). Vérifié dans `editor.html`.
  Éditeur : 58,4 Ko, CSS inclus (21,3 Ko en gzip) ; lecteur inchangé.

- Ambiguïté (2026-10-12) : quand plusieurs objets acceptés sont sous le
  clic (objets superposés, comme une droite et deux de ses segments), un
  menu près du clic donne la ligne de chacun ; son survol fait briller
  l'objet, un clic le choisit et le geste continue (anneau, argument d'un
  outil, point sur objet, ligne tapée, gomme, propriétés). Un point sous le
  clic est choisi seul, et l'intersection de deux objets qui se coupent est
  toujours créée directement. Échap ou un appui ailleurs ferment le menu
  sans rien faire. Éditeur : 59,8 Ko, CSS inclus (21,9 Ko en gzip) ;
  lecteur inchangé.

- Intersection au survol (2026-10-12) : partout où un clic désignerait un
  point (sans outil, argument point d'un outil, ligne tapée), le pointeur
  près de l'intersection de deux objets (à moins de 24 px, sans point sous
  lui) fait briller ces deux objets, ceux dont l'intersection la plus
  proche l'est le plus parmi les objets sous lui ; un clic, sans outil,
  crée alors l'intersection sans ouvrir d'anneau. Les intersections des
  paires survolées sont gardées tant que la figure ne change pas.
  Éditeur : 60,5 Ko, CSS inclus (22,1 Ko en gzip) ; lecteur inchangé.

- Actions sur l'objet sélectionné (2026-10-12, section du même nom) :
  corbeille et « Réglages » quittent l'anneau pour une zone contextuelle
  de la barre, avec Suppr / Retour arrière ; l'anneau ne porte plus que
  des outils géométriques (rayon 138 px) et ne s'ouvre pas pour un objet
  qui n'en a aucun ; annuler / refaire au bout de la barre. Vérifié dans
  `editor.html` à 1200 et 360 px de large. Éditeur : 62,8 Ko, CSS inclus
  (22,5 Ko en gzip) ; lecteur inchangé.

- Aimants (2026-10-12, section du même nom) : bouton de la zone
  contextuelle pour les points libres, bandeau « Terminé », voile blanc,
  cibles en rouge, curseur à crans de DGPad, zones d'attraction dessinées. Vérifié dans `editor.html` à 1200
  et 360 px de large (glisser aimanté, annuler / refaire). Éditeur :
  67,8 Ko, CSS inclus (24,1 Ko en gzip) ; lecteur inchangé.

Reste à faire :

- Jeux d'outils de l'enseignant (section « Anneau d'outils »).

- Expressions et curseurs (`a = 3`, `Curseur(0, 10)`), rayons et angles en
  formule (`Cercle(O, 2*a)`), en réutilisant `dgp_formula.ts`.
- Points sur objet et intersections au geste sur les lieux et listes ;
  choix explicite de l'intersection quand le geste est ambigu.
- 3D : points libres dans le plan de l'écran des figures DGPad (`f2`) et
  hors du plan z = 0.
- Lien « modifier cette figure » depuis le lecteur.
- Réutilisation de `ggb_translate.ts` pour accepter davantage de commandes
  GeoGebra.
- Mesures de fluidité sur des figures de plusieurs milliers d'objets (la vue
  texte est entièrement reconstruite après chaque changement).
