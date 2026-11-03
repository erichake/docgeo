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

## Application installable

Décidé avec l'auteur le 2026-11-02 : l'éditeur seul (pas le lecteur) est
une application web installable depuis Chrome ou Edge (macOS, Windows,
Linux), sans droits d'administrateur, depuis
`https://doctools.org/apps/docgeo/editor.html`. Ce que l'installation
qu'offre déjà Chrome pour toute page n'a pas : l'**usage hors ligne** et
l'**ouverture des `.dgo`, `.dgp` et `.ggb` par double-clic**.

- `public/editor.webmanifest` (lié par `editor.html`), en chemins relatifs :
  portée `editor` (préfixe d'adresse, pas un dossier), icônes PNG tirées de
  `icon_blue.svg` (dont une variante « maskable », fond plein, motif à
  80 %), `file_handlers` des trois formats vers `editor.html`, chacun avec
  son icône de document (`file_dgo.png`, `file_dgp.png`, `file_ggb.png` :
  page cornée, motif, extension), que Chrome ignore (essayé avec Chrome 156
  sur macOS, où son application ne déclare qu'un type de document sans
  icône, sur Windows, même après redémarrage, et sur Debian).
- Icônes des fichiers sur Mac (2026-11-02) : `public/macos-icons.sh`, que
  l'utilisateur lance depuis le Terminal (`curl … | sh`, manuel
  `installer.html#icones-mac`). Il construit sur place
  `~/Applications/DocGeo Types.app`, jamais lancée, qui déclare les types
  `org.doctools.docgeo.dgo/.dgp/.ggb` (`UTExportedTypeDeclarations`, avec
  `UTTypeIconFile`) : le Finder prend ces icônes alors que l'application de
  Chrome ouvre les fichiers, et les mises à jour de Chrome n'y touchent pas.
  Construite sur place, elle échappe à la quarantaine ; la même application
  téléchargée (`.dmg`, non signée) voit ses déclarations ignorées. Le
  Finder garde les icônes qu'il a dessinées : le script le relance, à
  l'installation comme à la désinstallation, sans mot de passe ni
  redémarrage (essayé le 2026-11-03, installation, désinstallation et
  réinstallation). Le vidage du cache d'icônes système (`sudo`) et le
  redémarrage d'abord employés ne servaient à rien : l'icône qui semblait
  y survivre venait d'applications d'essai restées enregistrées
  (`lsregister -dump | grep org.doctools.docgeo` les montre ; `lsregister
  -u` puis `-gc` les retire, même disparues). Le type gardé par Spotlight
  (`kMDItemContentType`) n'y est pour rien : le Finder l'ignore. Sans le script,
  macOS 27 compose déjà une icône correcte (icône de l'application sur une
  page, extension en gris).
- Icônes des fichiers sur Windows (2026-11-03, essayé sur Windows 11) :
  `public/windows-icons.ps1`, que l'utilisateur lance depuis PowerShell
  (`irm … | iex`, manuel `installer.html#icones-windows`). Chrome (ou
  Edge) crée un ProgID par extension (`Chrome.<nombre>`), désigné par la
  valeur par défaut de `HKCU\Software\Classes\.dgo` (pas de `UserChoice`),
  dont le `DefaultIcon` vaut `,0` : chemin vide, d'où l'icône blanche. Le
  ProgID de l'application (`Application\ApplicationName` = `DocGeo`) les
  liste dans `FileHandlerProgIds`. Le script ne remplit que ce
  `DefaultIcon`, vers des `.ico` construites depuis `file_*.png`
  (System.Drawing, entrées PNG 16 à 256 px) dans
  `%LOCALAPPDATA%\DocGeo\icons\`, puis `SHChangeNotify` : sans droits
  administrateur ni redémarrage, la commande d'ouverture reste celle du
  navigateur. Tient après redémarrage de Chrome, de Windows et un
  redéploiement de DocGeo ; une mise à jour de Chrome n'a pas été vérifiée
  (relancer le script suffit). Messages dans la langue de Windows,
  redécodés quand Windows PowerShell 5.1 lit le script en ISO-8859-1
  (doctools.org le sert sans `charset`) ; `Invoke-WebRequest` plutôt que
  `Net.WebClient`, que le serveur refuse (429, pas de User-Agent). Une
  extension ouverte par un autre logiciel (DGPad) garde son icône : le
  script le signale. Un premier essai (2026-11-02), un ProgID propre
  `DocGeo.dgo`, avait cassé le double-clic.
- Icônes des fichiers sur Linux (2026-11-03, essayé sur Debian 12, GNOME,
  Nautilus 43) : `public/linux-icons.sh` (`curl … | sh`, manuel
  `installer.html#icones-linux`). Chrome enregistre les types MIME de ses
  gestionnaires de fichiers
  (`~/.local/share/mime/packages/chrome-<id>-<profil>.xml` :
  `application/x-docgeo`, `application/x-dgpad`,
  `application/vnd.geogebra.file`), sans icône. Le script installe
  `file_*.png` comme icônes `hicolor` de ces types (`xdg-icon-resource`,
  contexte `mimetypes`), en 512 px et dessinées à chaque taille de 16 à
  256 px (`file_*_<taille>.png`) : Nautilus, qui réduisait seul l'icône de
  512 px, en crénelait les bords et le texte. Toutes sont produites par
  `node tools/file_icons.mjs` ; sous 48 px, où l'extension ne se lit plus,
  un dessin simplifié calé sur les pixels distingue les formats par la
  couleur du bandeau (DGO bleu, DGP orange, GGB vert, à toutes les tailles,
  donc aussi sur Mac et Windows). Pour l'utilisateur seul : ni `sudo`, ni
  redémarrage, commande d'ouverture inchangée. Chromium en snap (Ubuntu,
  essayé sur Ubuntu ARM, Chromium 156) n'enregistre ni ces types ni le
  fichier à ouvrir (raccourci sans `MimeType=` ni `%U`) : faute du XML de
  Chrome, le script déclare les trois types
  (`~/.local/share/mime/packages/docgeo.xml`), complète le raccourci
  `chrome-*.desktop` nommé `DocGeo` et en fait l'application par défaut des
  `.dgo` et `.dgp` ; la figure s'ouvre alors dans l'appli. Chromium peut
  réécrire ce raccourci (réinstallation) : relancer le script. La
  désinstallation défait tout cela si `docgeo.xml` existe. Les icônes sont
  écrites par le shell, pas par `curl -o` : le `curl` en snap a son propre
  `/tmp`. Le script refuse si Chrome n'a pas enregistré
  `application/x-docgeo` et qu'aucun raccourci DocGeo n'existe. Nautilus montre les icônes une fois
  rouvert. Le bureau GNOME (Desktop Icons NG) ne voit le nouveau thème
  d'icônes GTK qu'en se redessinant : le script désactive puis réactive
  l'extension `ding@rastersoft.com` (ou `desktop-icons@csoriano`, celle
  d'Ubuntu ARM) quand elle est active
  (`gnome-extensions`), à l'installation comme à la désinstallation. Prérequis : `curl` et
  `xdg-utils`, présents par défaut sous GNOME. Si GeoGebra est installé,
  l'icône DocGeo remplace la sienne pour `.ggb`.
- Menu Fichier (`src/editor/install.ts`) : « Installer DocGeo sur cet
  ordinateur… », seulement quand le navigateur le propose
  (`beforeinstallprompt` : Chrome et Edge, pas l'application installée, ni
  Firefox, ni Safari).
- Les fichiers reçus du système arrivent par `window.launchQueue`
  (`src/editor/main.ts`), ouverts comme un fichier choisi ; le handle d'un
  `.dgo` reste celui où l'enregistrement écrit.
- Service worker `editor_sw.js`, écrit au build par le plugin
  `editorServiceWorker` de `vite.config.ts` : tous les fichiers du build sauf
  `index.html`, `figure.php` et le manuel, mis en cache à l'installation et
  servis depuis ce cache quelle que soit leur requête (`?url=`, `?embed`).
  Son nom de cache (`docgeo-editor-<empreinte>`) vient du contenu de ces
  fichiers : tout build qui change un fichier change le worker. Enregistré
  par `src/editor/start.ts` (build seulement), de portée `editor` : le
  lecteur, intégré par d'autres pages, reste servi par le réseau.
- Mises à jour, choix de l'auteur : le cycle par défaut, rien de plus. La
  nouvelle version, téléchargée à l'ouverture qui suit sa publication, sert
  au lancement suivant (toutes les fenêtres de l'éditeur fermées) ; hors
  ligne, l'ancienne continue. Pas de bandeau « nouvelle version », pas de
  vérification périodique, pas de rechargement forcé. Cela vaut aussi pour
  l'éditeur ouvert dans un onglet ou intégré (`?embed`) : la portée couvre
  la page, installée ou non.

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
- **Ordre des arguments** (2026-10-28) : là où GeoGebra prend ses
  arguments dans les deux ordres, l'éditeur aussi (`Intersection(p, d)`
  d'un plan et d'une droite, `Section(p, s)`, `Tangente(c, P, n)`,
  `Sommet(3, p)`, aussi en argument d'une autre commande), la
  ligne relue s'écrivant dans l'ordre habituel. Pas là où l'ordre change le
  sens (`Symétrie`, `Translation`) ni là où GeoGebra l'impose
  (`Perpendiculaire`, `Parabole`, `Plan`, `Prisme`…).
- **Transformations** (décidé avec l'auteur le 2026-10-30) : comme dans
  DGPad et CaRMetal, ce qui définit la transformation d'abord, puis le
  point, à l'outil comme au clavier et dans l'ordre des entrées du `.dgo` :
  `Symétrie(O, P)`, `Symétrie(d, P)`, `Rotation(O, P, a)`,
  `Homothétie(O, P, k)`, `Translation(u, P)`, `Inversion(c, P)`. La ligne
  relue suit ainsi le geste de l'outil. L'ordre de GeoGebra (l'objet
  d'abord) n'est pas accepté : entre deux points, il donnerait sans erreur
  une autre figure. Les fonctions de formule `rotate(P, O, a)` et
  `dilate(P, O, k)`, enregistrées en texte, gardent leur ordre.
- Noms de commandes localisés, les mots usuels de la géométrie dans chaque
  langue (section « Langues »), ramenés à une forme canonique.
- **Équations** (décidé avec l'auteur le 2026-10-15) : `c = x^2 + y^2 = 4`,
  les deux membres des formules en x et y, sans commande à traduire. Un
  `=` hors des parenthèses, sans `;` ni `{`, fait l'équation ; `y = 2x + 1`
  et `x = 3` en sont, comme dans GeoGebra (x et y ne nomment pas d'objet
  en tête de ligne). La nature est lue dans les coefficients du moment :
  degré 1, une droite (`EqL`) ; degré 2 de même coefficient en x² et y²
  sans xy, un cercle (`EqC`) ; sinon une conique (`EqQ`). Une équation de
  degré supérieur, ou qui n'est pas un polynôme (vérifié en trois points
  de plus), est refusée (`degree`). La ligne relit les deux membres tels
  qu'écrits. Une équation qui lit z (s'il ne nomme pas d'objet) est un
  plan (`PlE`), de degré 1 ; z en tête de ligne reste un nom : `z = 3` est
  une expression, le plan s'écrit `p = z = 3`.
- **Coordonnées polaires** (2026-10-17, comme dans GeoGebra) :
  `P = (3; 60°)`, rayon et angle séparés par un point-virgule, est un point
  défini par une formule (`Fp`, `[(3)*cos(60°), (3)*sin(60°)]`), que la
  ligne relit `(3; 60°)`.
- **Vecteur libre** (décidé avec l'auteur le 2026-10-17, comme dans
  GeoGebra) : des coordonnées nommées d'une minuscule, `u = (1, 2)`, font
  un vecteur libre (`VecF`), tracé depuis l'origine, dont un glisser
  déplace la pointe ; la ligne relit `u = (1, 2)`. Un objet du moteur, qui
  porte ses deux extrémités hors de la construction, plutôt que deux
  points cachés qui auraient rompu « une ligne, un objet ». Un point libre
  déjà nommé d'une minuscule (figure DGPad) le reste quand on le redéfinit.
  Il entre dans l'état élève ; comme les rayons des cercles, il n'est pas
  une cible du mode intégré et reste manipulable sous `lock`.
- **Noms par défaut** (2026-10-17, comme dans GeoGebra) : u, v, w pour les
  vecteurs, des lettres grecques pour les angles (sans ι, ο, ni π, qui est
  un nombre), puis numérotées.
- **Textes, cadres HTML et images** (décidé avec l'auteur le 2026-10-17) :
  `t = Texte("Aire : %poly1% cm²", P)` (`Txt`), un texte entre guillemets
  dont les parties `%formule%` affichent leur valeur (`%%` est un `%`),
  attaché au point P ; `Text1 = Html("<b>…</b>")` (`Html`), le cadre HTML
  de DGPad, lu par le même filtre que dans le lecteur (un script, un
  élément ou un attribut inconnus sont refusés : `html`) ;
  `pic1 = Image(A, B, C)` (`Img`), une image par ses coins (un à trois),
  ou `Image(x, y)` fixée à cette place de la fenêtre, en pixels. Entre
  guillemets, `\\`, `\"` et `\n` sont une barre oblique inverse, un
  guillemet et un saut de ligne. Ce que la ligne ne dit pas est gardé par
  la redéfinition : le décalage du texte en pixels (nul pour un nouveau),
  le cadre du HTML (300 × 150 pixels en haut à gauche pour un nouveau), le
  fichier et la taille de l'image, qui ne se crée donc pas par une ligne
  (`image_file`). Un texte placé par GeoGebra à une position fixe garde
  son point d'ancrage caché, nommé dans sa ligne
  (``A1 = Texte("pt A", `aux 2`)``), sans changement du moteur. Le HTML
  s'édite aussi sur plusieurs lignes dans la section « Définition » du
  panneau de propriétés, comme un programme, sans « Mettre en forme ».
  Panneau de propriétés ouvert, un cadre HTML sélectionné se déplace en
  le glissant et se redimensionne par son coin inférieur droit (40 pixels
  au moins), ses champs et ses liens gardant leurs clics (2026-10-20).
  Renommer un objet le renomme dans les formules des textes et du HTML et
  dans les cibles (`target`) de ses champs.
- Réutilisation possible de `src/import/ggb_translate.ts` : une ligne tapée,
  ramenée à la commande GeoGebra canonique (nom, arguments, résultat), a la
  même structure qu'une commande du `geogebra.xml`. Il faudrait le découper
  pour traduire une commande à la fois.
- Grammaire fermée, lue par notre interpréteur (comme `dgp_formula.ts`),
  jamais par `eval`.
- Éditeur de texte : une saisie ligne à ligne avec une liste de complétion
  maison plutôt que CodeMirror ou Monaco, bien plus lourds.

## Langues

Décidé avec l'auteur le 2026-10-13 : l'éditeur parle les 12 langues de
DocTools (`ar`, `de`, `el`, `en`, `es`, `fr`, `hi`, `it`, `nl`, `pt`, `zh`,
`zh-TW`), choisies comme pour le lecteur (`LANG` de `src/i18n.ts` : paramètre
`lang` de l'URL, puis langues du navigateur).

- **Textes** : un fichier par langue dans `src/editor/lang/`. `en.ts` est la
  référence (il définit les clés, `MessageKey`) et le seul chargé avec
  l'éditeur ; les autres sont des chunks chargés à la demande, un seul par
  page (`messages.ts`, `await` au chargement du module). Une clé absente
  d'une langue s'affiche en anglais, mais un test exige que toutes les
  langues traduisent tous les messages, avec autant de `%` : **tout nouveau
  texte de l'éditeur est une clé ajoutée dans les 12 fichiers.** Jamais de
  phrase composée de morceaux (« Désignez » + « un point ») : l'accord
  change d'une langue à l'autre, d'où une phrase entière par cas
  (`designate_point`…).
- **Noms de commandes : les mots usuels de la géométrie scolaire dans
  chaque langue**, des noms (`Spiegelung`, pas le verbe `Spiegle`), au
  singulier, ceux des messages de la langue (`वृत्त`, `二次曲線`).
  Établis par DocGeo (2026-10-14) et non tirés des fichiers de langue de
  GeoGebra, sous licence CC BY-NC-SA, incompatible avec la GPL : ne pas y
  recopier ses traductions. Beaucoup coïncident, ce sont les mots de la
  géométrie. Le nom anglais est accepté dans toutes les langues, celui de
  la langue s'affiche. Une commande composée garde le nom de sa forme
  simple (`AutreIntersection`, `CercleCirconscrit`).
- Deux commandes de même nom dans une langue (`Mittelpunkt` : `Midpoint` et
  `Center` en allemand) n'en font qu'une, départagée par ses arguments ; le
  test vérifie que c'est le seul cas.
- Noms comparés sans casse ni accents latins et grecs ; les signes des
  autres écritures (voyelles du hindi) sont gardés, et acceptés par la
  complétion.
- **Arabe** : `lang` et la direction sur la page ; le panneau de propriétés
  passe de droite à gauche, les champs de code restent de gauche à droite,
  et chaque ligne de la bulle d'aide prend la direction de son texte
  (`unicode-bidi: plaintext`). Menlo et DejaVu Sans Mono dessinent les
  lettres arabes sans les lier : la police du code (`--dge-code`) les en
  exclut (`unicode-range`) pour une police arabe du système.

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
  point, centre et rayon, trois points, sphère) ; polygone, angle et lieu ;
  transformations (symétries centrale et axiale ; famille renommée
  « Transformations » le 2026-10-15). Chaque outil garde toujours la même place, quel que soit l'objet
  désigné ; deux outils qui ne s'affichent jamais ensemble partagent une
  place (milieu de deux points, d'un segment, centre d'un cercle). La bande
  d'une famille couvre toutes ses places, même celles sans outil pour
  l'objet : l'élève retient la place autant que l'icône. Le rayon de
  l'anneau est donc fixe (152 px). Comme dans DGPad, « lieu » n'apparaît
  que sur un point dont dépend un point sur objet, et se crée d'un clic :
  le lieu du point quand se déplace le dernier construit de ces points sur
  objet. Le cercle centre et rayon se règle en maintenant son icône appuyée :
  son rayon suit la souris ou le doigt jusqu’au relâchement, qui crée le
  cercle (2026-10-30). Un glisser du cercle change ensuite ce rayon. Depuis
  le menu ou la palette, le rayon initial reste d’environ 150 px à l’échelle
  courante, arrondi à deux chiffres significatifs. Un objet sans outil géométrique (texte,
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

## Menu des outils

Décidé avec l'auteur le 2026-10-14 : une troisième façon de construire, à
la GeoGebra, l'outil choisi avant les objets.

- **Plus de bouton ni de menu** (retirés le 2026-10-30, décidé avec
  l'auteur) : le bouton « Outils » à droite de la ligne de saisie ouvrait
  les familles de l'anneau et leurs sous-menus. La palette (section
  « Palette d'outils »), aux mêmes familles, mêmes items et même grisage,
  le remplace et prend son icône, une équerre et un crayon : ce qui suit
  vaut pour ses outils. Pas de recherche parmi les outils : la complétion
  de la ligne de saisie le fait déjà.
- **Famille « Programmes »** (décidé avec l'auteur le 2026-10-18), avant
  les macros (teinte 95), absente de l'anneau, qui ne porte que de la
  géométrie. « Tortue » prend un point (un toucher dans le vide en crée
  un), « Bouton » l'endroit de sa flèche, « Quand l'objet est glissé »,
  « … appuyé », « … lâché » un point déplaçable, « Quand la valeur change »
  une expression ; chacun crée son objet ou son programme (ou montre celui
  qui existe), l'ouvre en blocs dans les propriétés et repose l'outil, qui
  ne reste pas en main comme les autres (modes `turtle`, `button` et
  `event` de `tools.ts`). Une sélection est ignorée par « Bouton ».
- **Plus d'outils que l'anneau**, qui reste léger : à la fin de leur
  famille, `AutreIntersection` (points), `Compas`, en 3D « Cercle
  (centre, direction et rayon) » et « Cercle (axe et point) », `Arc`,
  `Secteur` (trois points, en 3D dans leur plan, ou un cercle ou une conique puis deux
  points), `ArcCentre`, `SecteurCentre` (le centre, le début, puis un point
  de la demi-droite où il finit ; en 3D, l'arc de l'angle AMB, dans son
  plan), `DemiCercle`, et les familles « Plans » et
  « Solides » (3D),
  `Conique`, `Ellipse`, `Hyperbole` et `Parabole` (« Cercles, arcs,
  coniques »), ces trois-là comme dans GeoGebra : deux foyers puis un
  point, ou un foyer puis la directrice (au clavier, `Ellipse(F, G, a)` et
  `Hyperbole(F, G, a)` prennent aussi le demi-axe a). Toute commande du catalogue qui
  se construit par désignation y a sa place (`Rotation`, `Translation`
  et `Homothétie` à la fin des transformations ; tangentes… à mesure
  qu'elles s'ajoutent) ; `PointFixe`, `Curseur` et
  `Liste` restent au clavier ou dans la barre.
- **Un item par commande d'une place de l'anneau** (`Item` de `tools.ts`) :
  les formes d'une commande à la même place n'en font qu'un, le premier
  objet désigné choisit la forme comme il choisit les outils de l'anneau
  (`Milieu` de deux points ou d'un segment, `Médiatrice`, le cercle par
  trois points du plan ou de l'espace). Deux places d'une même commande
  ont un nom chacune : « Cercle (centre et point) » / « (centre et
  rayon) », « Symétrie centrale » / « axiale ». La sphère, les plans et
  les solides n'apparaissent qu'en 3D. Exception : « Section » a une seule
  forme au menu, qui prend n'importe quel solide (sphère, cylindre, cône,
  polyèdre), avant ou après le plan ; l'objet construit est celui de ses
  arguments (`formOf` dans `main.ts`). De même, en 3D, « Perpendiculaire »
  prend une droite ou un plan (`Perp` ou `Nrm`, comme la commande de
  GeoGebra), la forme à une droite seule restant celle du plan.
- **Survol** : la ligne que l'outil écrira et ce qu'il faut désigner,
  comme sur l'anneau.
- **Désignation** : celle de l'anneau, sans clavier virtuel ; la ligne en
  cours s'affiche dans la consigne. Le premier objet peut prendre
  n'importe quelle place que son type accepte (une droite d'abord pour
  `Perpendiculaire`) ; à défaut, un point est créé là, libre, sur objet ou
  à une intersection. « Point » crée le point où l'on touche : libre
  dans le vide, sur l'objet touché, ou au croisement de deux objets ;
  « Point sur objet » ne le crée que sur un objet ; « Intersection »
  prend un croisement d'un toucher ou deux objets l'un après l'autre ;
  « Lieu » ne prend qu'un point dont dépend un point sur objet,
  « AutreIntersection » qu'un point déjà là.
- **Désignation dans le panneau « Construction »** (décidé avec l'auteur
  le 2026-10-17) : outil en main (menu ou anneau), un toucher sur une
  ligne désigne son objet au lieu d'éditer la ligne ; pour l'éditer, on
  lâche l'outil. Les lignes que l'outil prend comme argument suivant
  sont sur fond vert, un trait vert au bord, comme le vert des objets
  acceptés dans la figure ; les autres sont pâlies, sans être masquées
  (la liste ne saute pas d'un argument à l'autre), et le gris garde son
  sens : objet caché. Un objet caché, que la figure ne désigne pas, s'y
  désigne. Les lignes des objets déjà désignés, dans la liste ou dans la
  figure, passent en bleu (fond et trait, comme la sélection multiple),
  une pastille bleue au bout disant leur place dans la commande : 2 pour
  la droite désignée d'abord de `Perpendiculaire(…, a)`. La liste n'a pas de position : un point ne s'y désigne que
  s'il existe (ni point sur objet, ni outils « Point »), l'intersection de
  deux courbes y est la première (`rowTakes`, `designateRow`), le plancher
  3D n'y est pas.
- **Cercle (centre et rayon)** : comme sur l'anneau, le centre désigné
  suffit, le rayon d'environ 150 px se change ensuite en glissant le
  cercle ; rien à taper (décidé avec l'auteur le 2026-10-14, qui avait
  d'abord retenu un rayon tapé).
- **Rotation et homothétie** (décidé avec l'auteur le 2026-10-15) : le
  centre puis le point désignés suffisent, l'outil donne un quart de tour
  (90°, ou π/2 dans une figure en radians) ou un rapport de 2, que la
  ligne change ensuite.
- **Outil persistant** : après chaque objet, il attend de nouveau son
  premier argument, sauf ceux gardés (ci-dessous), une transformation
  comme les autres (`TRANSFORMATIONS.md`, décision 5). La zone
  contextuelle de la barre devient un bandeau (icône, nom, « Terminé »),
  comme pour les aimants. On en
  sort aussi par « Terminé », Échap, la croix de la consigne, un autre outil,
  le focus dans la ligne de saisie (ou au clavier dans une ligne), la gomme, les propriétés ou le pas à
  pas ; annuler, refaire et la vue 3D le gardent, sans ses arguments
  autres que gardés. Un
  toucher dans le vide crée un point : il ne peut pas faire sortir de
  l'outil. Pendant l'outil, un glisser vise (comme après un outil de
  l'anneau) ; le bouton droit, lui, glisse les objets et la vue, outil en
  cours ou non : sur un objet, l'éditeur lui passe l'appui comme un appui
  gauche, ailleurs la figure déplace la vue (la tourne en 3D). Au doigt,
  rien encore : il faut sortir de l'outil pour déplacer.
- **Arguments gardés** (décidé avec l'auteur le 2026-10-30) : un argument
  désigné avec **Maj** (dans la figure ou une ligne du texte) après avoir
  choisi l'outil au menu ou à la palette est repris après chaque objet,
  jusqu'à la sortie de l'outil : la droite
  d'une symétrie, le centre de cercles concentriques, la droite de
  plusieurs parallèles. La consigne porte, pour chaque argument désigné,
  un bouton « Garder A » (la voie du doigt, avec pour bulle le rappel
  du Maj-clic), et pour chaque argument gardé « Changer A », qui le
  redemande. Seulement en désignation postfixée : ni l'outil de l'anneau,
  qui ne construit qu'un objet, ni les objets sélectionnés avant l'outil.
  Jamais un argument qui compléterait l'objet, construit aussitôt, ni
  ceux d'un polygone ou d'une intersection. L'annulation
  les retrouve par leur nom (un côté ou un sommet de polygone tant que
  son polygone est le même). Pour une macro, l'initial désigné avec Maj
  est gardé avec ceux qui le précèdent (désignation dans l'ordre) ; son
  « Changer » revient au premier (`MACROS.md`, « Initiaux fixés »).
- **Petit écran** (600 px ou moins) : choisir un outil referme le panneau
  « Construction » et celui des propriétés, pour que la figure se voie
  entière.

### Sélection multiple

Décidé avec l'auteur le 2026-10-14 : l'objet d'abord, comme l'anneau, mais
pour plusieurs objets.

- ⌘-clic, Ctrl-clic, Maj-clic ou appui long (immobile au-delà du délai
  d'un clic, 700 ms : rien d'autre ne l'utilisait) ajoutent l'objet à la
  sélection, ou l'en retirent. L'objet dont l'anneau est ouvert en devient
  le premier. Chacun brille en bleu, son rang dans une pastille ; la
  consigne rappelle le geste, la barre montre les noms, « Supprimer »,
  qui les supprime tous (Suppr aussi), et « Réglages ». Un toucher simple,
  Échap, un outil, la gomme, annuler ou refaire la vident ; les propriétés
  la reprennent.
- Le menu des outils grise les familles et les outils qui ne prennent pas
  la sélection (`assign` dans `tools.ts`) : chaque objet, dans l'ordre,
  prend la première place libre qui accepte son type (droite puis point
  donnent `Perpendiculaire(P, d)`, les points gardent leur ordre). Le
  survol montre la ligne préremplie, le clic l'écrit et l'outil attend le
  reste ; complète, elle est construite aussitôt, le polygone fermé dès
  trois sommets (A, B, C puis « CercleCirconscrit » écrit
  `CercleCirconscrit(A, B, C)`). Sans sélection, l'objet dont l'anneau est
  ouvert sert de premier argument.
- **Propriétés de plusieurs objets** (2026-10-14) : « Réglages », ou le
  bouton « Propriétés » de la barre, ouvre le panneau sur la sélection.
  Panneau ouvert, le même geste (⌘-clic, Ctrl-clic, Maj-clic, appui long,
  et ⌘-clic sur une ligne du panneau « Construction ») y ajoute un objet ou
  l'en retire ; un toucher simple ou la liste reviennent à un seul. La
  liste montre leurs noms, une ligne dit qu'il y en a plusieurs ; ni nom ni
  définition. **Seuls les réglages communs à tous** sont affichés (décidé
  avec l'auteur le 2026-10-14, après un essai où chacun s'appliquait aux
  seuls objets qui l'avaient) : des points et un segment n'ont en commun
  ni taille ni épaisseur, mais couleur, opacité, calque, visibilité, nom
  affiché… Un réglage montre la valeur du premier objet, en italique gris
  (le nuancier en pointillé, la case indéterminée) si les autres en ont
  une autre. « Même type » s'étend aux objets des types sélectionnés.
  Annuler garde les objets du panneau, Suppr les supprime tous.

## Palette d'outils

Décidé avec l'auteur le 2026-10-29, d'après la palette de CaRMetal (tous
les outils à plat, par zones repliables), adaptée à la sélection de
DocGeo. Depuis le 2026-10-30, elle est le seul accès aux outils hors de
l'anneau et du clavier : le menu des outils est retiré.

- **Place** : un bouton « Palette d'outils » de la barre (une équerre et
  un crayon), à côté de
  « Propriétés », et son entrée du menu Affichage, ouvrent à droite un
  panneau de la même place et de la même largeur réglable que les
  propriétés. Les deux s'ouvrent alternativement : ouvrir l'un ferme
  l'autre (et le panneau de définition d'une macro). Passer de l'un à
  l'autre ne lâche pas l'outil en main. À droite, on construit ou on règle.
- **Ouverture mémorisée** (2026-10-30) : visible au premier lancement, puis
  son état ouvert ou fermé est gardé dans le navigateur (`localStorage`,
  `docgeo-palette-open`) et restauré au lancement suivant.
- **Points par les outils seuls** (décidé avec l'auteur le 2026-10-30) :
  palette ouverte et sans outil, la figure se manipule, un clic dans le
  vide ou au croisement de deux objets ne crée pas de point (la ligne de
  saisie qui attend un point excepté). Le premier outil de la palette,
  « Point » (un point et son nom, comme dans GeoGebra), propre à la
  palette, crée un point libre, sur objet ou une intersection selon
  l'endroit ; « Point sur objet », l'item de l'anneau (son icône, un
  point sur une courbe), le suit et ne crée qu'un point sur l'objet
  désigné, un clic dans le vide ne faisant rien (`anywhere` de `Tool`).
  Aucun outil n'est pris d'office à l'ouverture : la figure s'ouvrirait
  en création, un glisser au doigt ne la déplaçant plus. Sous 600 px,
  choisir un outil refermant la palette, la figure n'est jamais visible
  palette ouverte : son clic vide reste celui de l'anneau.
- **Choix d'un objet** : un clic sur un objet le choisit (il brille, la barre
  montre ses actions) **sans ouvrir d'anneau** (décidé avec l'auteur le
  2026-10-29) : la palette montre ses outils. Un clic sur un autre objet le
  choisit à son tour, un clic dans le vide le lâche, comme il fermerait
  l'anneau. Ouvrir la palette masque l'anneau ouvert, son objet restant
  choisi.
- **Zones** : une par famille de `tools.ts`, même ordre, mêmes teintes,
  mêmes items (`Item`), « Programmes » comprise (2026-10-30). Les familles
  sans outil dans la vue (plans et solides dans le plan) n'ont pas de
  zone. La dernière porte « Nouvelle macro » puis les macros de la figure,
  comme des outils. Un clic sur le titre d'une zone la replie ou la
  déplie, état gardé par le navigateur.
- **Grisage vivant** : la règle du menu (`takes`), recalculée à chaque
  changement de sélection : les objets sélectionnés, sinon l'objet choisi
  d'un clic, celui dont le menu ouvrirait l'anneau (décidé le 2026-10-29,
  par cohérence avec le menu). Un outil pris
  part de ces objets, comme au menu. Les outils grisés gardent leur place.
  Le changement se fait en fondu.
- **Outil en main** : son bouton reste enfoncé, aux couleurs de sa famille ;
  un clic dessus le lâche. Survoler un outil affiche sa ligne dans la
  consigne, comme au menu. Une macro de la zone commence son application.
- **Fantôme** (décidé avec l'auteur le 2026-10-29) : survoler un outil que
  les objets choisis complètent (ceux qu'un clic construirait aussitôt :
  `CercleCirconscrit` sur trois points, `Milieu` d'un segment, un polygone
  dès trois sommets, une intersection de deux courbes) montre pâle et sans
  nom l'objet qu'il construirait (`previewItem`, `builtFrom`, le calcul de
  `take`).
- **Aspect** : pas les pastilles rondes de l'anneau (le rond
  reste l'emblème de ce qui est contextuel), mais des boutons carrés à coins
  arrondis, en grille qui se réorganise selon la largeur du panneau ; la
  teinte de la famille est portée par la zone (titre et fond pâle).
- **Échap** lâche l'outil, ferme l'anneau ou vide la sélection, puis ferme
  la palette.
- **Petits écrans** : comme les propriétés, sous 900 px la palette alterne
  avec le panneau « Construction », sous 600 px elle recouvre la figure et
  choisir un outil la referme. Sous 500 px, la barre étant pleine, son
  bouton passe à droite de la ligne de saisie.

Plus tard, la palette sera la vitrine des jeux d'outils choisis par
l'enseignant (section « Anneau d'outils »), comme les sessions restreintes
de CaRMetal, enregistrés dans la figure (voir `DGO.md`).

## Actions sur l'objet sélectionné

Décidé le 2026-10-12. Les utilitaires de DGPad (sa rangée grise : nom,
propriétés, corbeille, ancre, aimant, calculatrice, Blockly…) se
multiplieraient sur l'anneau au fil des implémentations. Partage :

- **l'anneau construit** à partir de l'objet (outils géométriques) ;
- **la barre agit** sur l'objet sélectionné (supprimer, redéfinir…) ;
- **le panneau de propriétés règle** ses attributs : ce qui, dans DGPad,
  était un outil mais ne change qu'un attribut (nom, ancre, trace…) y
  devient un champ ou une case ; pas les aimants, qui désignent d'autres
  objets de la figure (section « Aimants »), ni la punaise, bascule de la
  zone contextuelle à la demande de l'auteur (section « Punaise ») ;
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

La barre est déjà pleine à 320 px : sous 680 px, la zone contextuelle
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

## Punaise

Décidé le 2026-10-12, l'outil punaise de DGPad (`FloatingObjectConstructor`,
style `fl`) : un point libre épinglé garde sa place dans la fenêtre, et non
ses coordonnées, quand on zoome ou déplace la vue ; il se glisse toujours.
Dans une figure plane, un point libre a dans la zone contextuelle, avant
les aimants comme dans DGPad, un bouton bascule « Épingler à l'écran »,
bleu quand le point l'est. Contrairement aux autres actions, la zone et
l'anneau restent ouverts après la bascule, pour montrer le nouvel état.
Son survol dit ce que fera le clic. Pas de bouton dans les figures 3D de
DGPad, où tous les points libres sont déjà épinglés au plan de l'écran,
ni dans les autres figures 3D, où DGPad en fait l'origine du repère.

Une ligne de texte modifiée déplace aussi un point épinglé. Chaque étape
d'annulation garde l'origine et l'unité de sa vue : elle est relue dans
cette vue, puis ramenée à la vue courante, pour qu'annuler après un zoom
ne déplace pas les points épinglés dans la fenêtre.

## Plan et espace

Décidé avec l'auteur le 2026-10-13, après l'essai d'une bascule
automatique (comme GeoGebra ouvre sa vue 3D), abandonnée : passer en 3D
change le calcul des formules (les points y ont trois coordonnées, plus
des nombres complexes), et une heuristique qui fait basculer la figure à
l'insu de l'utilisateur le déroute. La 3D est donc un choix explicite,
comme dans DGPad où elle se décidait à la création de la figure.

- **Bouton « Vue 3D »** (un cube) dans la barre, après « Repère », bleu en
  3D. Il n'apparaît pas dans les figures 3D de DGPad (`f2`), dont les
  points libres sont dans le plan de l'écran.
- **La caméra tourne** (`src/editor/space.ts`, 1,1 s, sans mouvement si
  les animations sont réduites) : la figure est relue en 3D vue de dessus,
  la projection de la vue plane, puis le plan bascule vers l'arrière comme
  une table vue de face, rasante et légèrement tournée (θ = π/12,
  φ = 5π/2 − 2π/15), et l'origine gagne le centre de la fenêtre, où la 3D
  la garde. Le plan bascule d'abord, puis tourne, les deux mouvements se
  chevauchant (accélération sans à-coup, _smootherstep_). Au retour, la
  caméra revient au-dessus du plan par le plus court chemin, en tournant
  d'abord puis en se redressant, puis la figure est relue en 2D.
- **Retour au plan refusé** tant qu'un objet dessiné est hors du plan
  z = 0 (point, ou point d'une liste, de cote non nulle ; sphère, plan,
  solide, patron, section de cylindre ou de cône, cercle d'un plan non
  horizontal) : la consigne le nomme (« A est hors du plan z = 0 : la
  figure reste en 3D »). Une expression, même de valeur `[1, 2, 3]`, n'est
  pas dessinée ; une perpendiculaire (`plumb_line_object`) est celle d'une
  droite, aussi dans le plan.
- **Dans une figure plane, un objet hors du plan est refusé**, quel que
  soit le chemin (`A = Point([1, 2, 3])`, `C = (2, 1, 1)`,
  `Sphère(A, B)`, action « Point » d'une expression `[1, 2, 3]`) : la
  figure revient à sa dernière étape et la consigne invite à passer en
  3D ; la ligne tapée reste dans le champ. Plus de cote jetée en silence.
  Une figure plane ouverte avec un objet hors du plan (aucune des 142 des
  tests) n'est pas soumise au refus.
- **Repère** : la 3D montre le trièdre et le plancher ; le retour au plan
  rend le repère tel qu'il était avant la bascule.
- **Annulation** : chaque bascule est une étape, qui garde de sa vue le
  seul mode (`3d`) ; annuler ou refaire à travers une bascule fait tourner
  la caméra. Les étapes attendent la fin de la rotation.

## Ressort

Décidé le 2026-10-12, l'outil ressort de DGPad (`SpringConstructor`) : on
anime un point sur objet en tirant un ressort depuis le point, la longueur
donnant la vitesse. Dans DGPad, le ressort se mesure du point au doigt : tiré
depuis un bouton de la barre, loin du point, il partirait au cran maximal.
Il est donc **accroché au point** :

- un point sur objet que le moteur anime (sur une droite, un segment, une
  demi-droite, un cercle, un arc, un polygone, une conique ou un lieu) a dans la zone
  contextuelle un bouton bascule « Animer » (un ressort), bleu quand il est
  enfoncé. Il sort sous le point un petit ressort au repos terminé par une
  boule bleue, dans le vide intérieur de l'anneau ; comme pour la punaise,
  la zone et l'anneau restent ouverts, et un second clic range le ressort,
  qui ne sort jamais sans ce bouton (décidé le 2026-10-12, après un essai
  où il sortait à chaque sélection). Le point lui-même se glisse toujours
  (la boule s'en tient à l'écart) ;
- on attrape la boule et on tire : la **longueur** donne la vitesse, par
  crans, ceux de DGPad (px/s le long d'une droite, d'un polygone ou d'une
  conique, °/s sur un cercle, % sur un lieu), écrits le long du ressort ; un cran fait au
  moins 30 px (25 dans DGPad sur les cercles et les polygones), pour que la
  boule au repos, en deçà du premier cran, reste loin du point ;
- le **côté** donne le sens, comme un élastique qu'on lâche : le point part
  à l'opposé de la traction, ce que fait DGPad sur une droite, avec une
  règle unique pour tous les supports. Le sens de marche est celui du
  moteur lui-même (un pas d'animation minuscule, mesuré à l'écran) ;
- tiré **en travers** d'une droite (à plus de 45°), le point fait
  l'aller-retour (`⇄`), comme dans DGPad ; sur les autres supports, il
  boucle toujours ;
- **un fantôme qui part, le point qui reste** : pendant qu'on tire, le point
  reste en place (déjà animé, il s'arrête), le ressort vraiment accroché à
  lui, et un fantôme pâle du point (son dessin et son nom) parcourt déjà le
  chemin à la vitesse et dans le sens du cran ; l'anneau disparaît.
  Relâchée, la boule revient vers le point comme un élastique qu'on lâche,
  le dépasse un peu et oscille en s'amortissant (0,45 s) : c'est quand elle
  passe par le point que celui-ci part, entraînant ses dépendants, et que le
  fantôme disparaît. Les animations en pause reprennent alors ; l'anneau et
  la zone se ferment, en une étape d'annulation. Ramené en deçà du premier
  cran, le ressort arrête le point ; relâché sans avoir bougé, il le laisse
  comme il était. Sans animation (préférence de réduction), le point part
  au relâchement. Le fantôme est un clone du dessin du point que le moteur
  fait avancer avec le point lui-même, prêté le temps d'un pas : aucun
  objet n'est ajouté à la figure ;
- **sorti sur un point déjà animé**, le ressort est tendu à sa vitesse (la
  boule au milieu de son cran, derrière le point ou en travers pour un
  aller-retour), et suit le point à chaque image. On reprend la boule pour
  changer la vitesse.

Le survol du bouton, comme celui de la boule, rappelle la règle dans la
consigne. Les réglages fins (vitesse quelconque, sens
inverse, « Arrêter » à l'extrémité) restent dans le panneau de propriétés,
seul accès au clavier.

DGPad n'anime pas les points sur une conique ; le moteur de DocGeo, si
(2026-10-12) : comme sur un polygone, `vitesse` pixels par seconde à
l'écran, par pas de 4 px au plus, chacun le long de la tangente puis
reprojeté sur la conique. Sur une ellipse, le point boucle ; sur une branche
de parabole ou d'hyperbole, infinie, il fait demi-tour là où il sortirait
de la fenêtre (il s'arrête s'il devait s'arrêter à l'extrémité), sans
changer de branche. Les animations GeoGebra de points sur conique, dont la
vitesse se rapporte au paramètre de GeoGebra, restent ignorées.

Un toucher sur un curseur ou sa poignée, comme sur un texte ou une
expression, le sélectionne (zone contextuelle, sans anneau) au lieu de
créer un point ; pendant une saisie, il écrit son nom ; sa poignée se
glisse toujours. Depuis le 2026-10-19, un curseur (nombre constant entre
deux bornes) a lui aussi son bouton « Animer » : le ressort est accroché à
sa poignée, au repos sous elle (à sa droite sur un curseur vertical), et le
fantôme est un clone pâle de la poignée qui parcourt la piste. Les crans
sont ceux de DGPad (0 à 100 %, en cinquantièmes de l'étendue par seconde,
un cran tous les 500/11 px). Le sens suit la règle commune : tiré à
l'opposé du sens croissant (vers la gauche, ou vers le bas sur un curseur
vertical), il monte ; tiré en travers, il fait l'aller-retour. DGPad
mesure le sens horizontalement même sur un curseur vertical : on ne le
reproduit pas. Les expressions numériques sans bornes, que DGPad anime
aussi, n'ont pas de ressort.

## Noms des points

Décidé le 2026-10-12, comme dans GeoGebra : le nom affiché d'un point se
glisse à la souris ou au doigt, partout autour de lui, et suit exactement
le pointeur. Il s'enregistre en direction (`np`, celle de DGPad, qu'on
règle aussi dans le panneau de propriétés) et en distance (`nd`, en
pixels, deux fois la taille du point par défaut). Le nom ne recouvre
jamais son point (distance au moins nulle) et ne s'en éloigne pas de plus
de 80 px. Un point sous le pointeur l'emporte sur un nom. Survoler un nom
fait briller son point et donne le curseur « doigt ». Chaque glisser est
une étape d'annulation.

Les autres objets dont le moteur écrit le nom à la place de GeoGebra
(segment, droite, demi-droite, vecteur, cercle, arc, conique, courbe,
polygone : `nameAt`, item 24 de `GGB_IMPORT.md`) le montrent ou le masquent
par le panneau « Construction » et le panneau de propriétés, comme les
points. Contrairement à GeoGebra, ils sont créés sans nom affiché : seuls
les points en ont un à leur création (décidé avec l'auteur le 2026-10-14).
Leur nom se glisse et se renomme sur place comme celui d'un point
(2026-10-14), sans limite de distance. Tant qu'il n'a pas été glissé, il
est à la place que lui donne GeoGebra (milieu d'un segment, bord de la
fenêtre pour une droite…). Glissé, il garde sa place relative à l'objet
quand celui-ci change (`no`, décidé avec l'auteur) : la même fraction de
segment et le même écart de côté, le même angle sur un cercle… GeoGebra,
lui, garde un décalage fixe en pixels, qui laisse le nom en arrière quand
on déplace un point. Un toucher sur ce nom désigne son objet dans les
modes propriétés, gomme et aimant.

Décidé le 2026-10-14 : le toucher sans le glisser **renomme sur place**,
sans dialogue. Un champ remplace le nom, dans sa police, sa taille et sa
couleur, le texte sélectionné, suivi d'un bouton « Masquer le nom » (un
œil barré) ; la consigne dit comment valider. Entrée ou un toucher
ailleurs valident (ce toucher ne fait rien d'autre dans la figure), Échap
annule ; un nom vide ou pris est refusé en rouge dans la consigne, le
champ restant ouvert (quitté par un toucher ailleurs, il est abandonné).
Renommer et masquer sont chacun une étape d'annulation ; le nom se
réaffiche par le panneau de propriétés. Dans les modes propriétés, gomme
et aimant, le toucher sur un nom désigne toujours son point.

## Marques d'angles

Décidé le 2026-10-14, comme dans DGPad : la marque d'un angle (son arc, ou
celle d'un angle droit) se glisse pour en changer le rayon (`ar`), qui
suit la distance du pointeur au sommet, proportionnellement à celle où on
l'a prise (pas de saut au premier mouvement), entre 5 et 200 px comme le
champ du panneau de propriétés. Vaut aussi pour les angles fixes de DGPad
(`FA`). Un point, un nom ou un objet plus proche du pointeur passe avant ;
survoler la marque fait briller l'angle et donne le curseur « doigt ».
Chaque glisser est une étape d'annulation. Les angles deviennent aussi
désignables par leur marque (`pick`) : un toucher les sélectionne, la
gomme les cache, le panneau de propriétés les choisit.

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

Barre de menus (`src/editor/menus.ts`, décidé le 2026-10-19, sur le modèle
de DocCells) : hors d'une iframe (DocTools, mode élève), dans tous les
navigateurs, une barre de 32 px au-dessus de celle des icônes, ramenée de
60 à 48 px (boutons de 36 px). Menus Fichier (Nouvelle figure, Ouvrir… ⌘O,
Enregistrer ⌘S, Enregistrer sous… ⇧⌘S), Édition (Annuler, Refaire,
Supprimer, Gomme), Affichage (Repère, Vue 3D, Historique, Propriétés,
cochés selon leur état ; Plein écran, API Fullscreen sur toute la page,
absent là où `document.fullscreenEnabled` est faux : iPhone, Safari
iPadOS < 16.4 qui n'a que `webkit…`, pas de raccourci, ceux du système
appartenant au navigateur, Échap en sort), Macros (section
« Macro-constructions », bibliothèques) et Outils (manuel, DocTools, à
propos). Les menus pressent les boutons de
la barre d'icônes, qui restent (commodes au doigt). Un clic hors d'un menu
ouvert le ferme sans rien faire d'autre ; flèches et Échap au clavier.
`--dge-bar-height` est la hauteur des deux barres ensemble.

Enregistrement (`src/editor/file.ts`, même date) : hors d'une iframe, dans
un navigateur qui a l'API File System Access (Chromium), l'éditeur
enregistre comme une application. Le premier Cmd-S ouvre la boîte
d'enregistrement du système, les suivants réécrivent le même fichier ;
Cmd-Maj-S enregistre sous un autre nom. Une figure `.dgo` ouverte par le
sélecteur du système (bouton, menu, ⌘O) ou déposée garde son fichier ; une
figure `.dgp`, `.ggb`, ou passée par `?url=`, n'en a pas encore. Le nom du
fichier s'affiche au bout de la barre de menus (abrégé s'il est long) et
dans le titre de la page, avec une pastille rouge (« ● » dans le titre)
tant que l'étape courante de la pile d'annulation diffère de celle
enregistrée : annuler jusqu'à l'état enregistré l'efface. Déplacer ou
zoomer la vue, hors de la pile, ne compte pas comme une modification.
Ailleurs (Firefox, Safari, iframe de DocTools), Cmd-S télécharge la
figure, sans nom affiché.

Les changements de la figure (étapes d'annulation, annuler, refaire,
reconstructions) s'enchaînent sur une seule promesse (`recording`), qu'un
enregistrement attend. Une étape qui échoue est dite dans la consigne
(`failed`) et n'arrête ni les suivantes ni l'enregistrement (2026-10-27 :
une exception y bloquait tout, panneau et enregistrement, qui laissait un
fichier vide). Le fichier n'est ouvert en écriture qu'une fois la figure
écrite.

Le panneau « Construction » se ferme par la croix de son en-tête ou par
le bouton historique de la barre, qui permet aussi de le rouvrir. La figure
récupère sa largeur sans changer les objets ; les consignes se recentrent
dans l'espace disponible. Le panneau glisse depuis la gauche en 240 ms,
avec un ralentissement doux, et la figure accompagne le mouvement. Les
préférences de réduction des animations sont respectées ; un panneau fermé
est retiré de la navigation au clavier dès le début du mouvement.
Sur les écrans de 600 px ou moins, le panneau
démarre fermé ; la barre reste sur une seule ligne à 320 px.

Décidé le 2026-10-14, comme la vue Algèbre de GeoGebra : chaque ligne du
panneau « Construction » commence par une pastille de la couleur de
l'objet, pleine s'il est visible, vide s'il est caché, qui le cache ou le
montre d'un toucher (en mode gomme, elle bascule son fantôme) ; les objets
super-cachés n'en ont pas. Une ligne d'objet dont la figure écrit le nom
(section « Noms des points ») finit par un bouton « nom » (un A et un
point) qui affiche ou masque le nom, discret tant que le nom
est masqué : il n'apparaît qu'au survol de la ligne (toujours, pâle, sans
survol). Chaque bascule est une étape d'annulation. L'en-tête compte les
objets ; la ligne de saisie, un champ arrondi, reste collée au bas du
panneau quand la liste défile.

**Valeurs** (2026-10-14) : un bouton « = 1 » de l'en-tête, éteint au
départ et non mémorisé, écrit en gris sous chaque ligne ce que le nom de
l'objet vaut dans une formule (`scriptValue`) : coordonnées d'un point,
longueur d'un segment, rayon d'un cercle, aire d'un polygone, mesure d'un
angle (en degrés avec `°`), valeur d'une expression. Rien quand la ligne
le dit déjà (point libre, constante). Les valeurs suivent les glissers.

**Pas à pas** (2026-10-14), comme la barre de navigation de GeoGebra : un
bouton « escalier » de l'en-tête rejoue la construction. Chaque objet
visible est une étape ; un objet caché va avec l'étape d'avant. Une barre
remplace la saisie : première, précédente, « Étape 3 / 10 », suivante,
dernière (ces deux-là disparaissent sous 270 px de panneau), lecture
(une étape par seconde) et pause ; ← → Début et Fin au clavier. Les
objets des étapes suivantes sont cachés dans la figure (`steps.ts`), pas
dans la figure enregistrée ni dans la pile d'annulation (`withHidden`,
comme les fantômes de la gomme) ; leurs lignes sont pâlies, celle de
l'étape montrée marquée, et la consigne la répète. Un toucher sur une
ligne va à son étape. Les points se glissent toujours, mais un toucher
dans la figure ne construit rien. Échap, le bouton, la fermeture du
panneau, la gomme, les propriétés, un outil, annuler ou le focus dans une
ligne en sortent, la figure entière revenant.

**Filtres de la liste** (2026-10-30, décidé avec l'auteur ; `filters.ts`) :
un bouton « entonnoir », le dernier de l'en-tête avant la croix, ouvre un menu à cocher : tous les objets, les visibles ou les
cachés (au sens de la pastille, `looksHidden`) ; « Liés à la sélection »,
les objets choisis, leurs parents et leurs descendants, figés au moment
du choix (retrouvés par leur nom, qu'une annulation reconstruise ou non
les objets ; le filtre tombe quand aucun ne reste) ; et les types que
la figure contient, avec leur nombre (`kindOf` de `catalog.ts` :
points, droites, segments et vecteurs, cercles, arcs et coniques,
polygones, angles, courbes, lieux et listes, expressions, plans,
solides, autres), plusieurs cochés s'additionnant. Le menu reste ouvert
d'un choix à l'autre ; Échap ou un appui ailleurs le ferme. Chaque
filtre actif est une pastille sous l'en-tête, qu'un clic retire ; le
bouton est allumé et le compteur dit « 312 / 2569 ». Une ligne
d'application de macro repliée se montre si l'un de ses finals passe.
Le filtre ne touche que la liste, pas la figure, ni la figure
enregistrée, ni l'annulation ; il n'est pas mémorisé et ouvrir une figure
le retire. Écarté : les filtres à la place de la ligne de saisie, qui
construit, quand eux ne font que lire.

Les deux panneaux latéraux (construction et propriétés) se redimensionnent
en tirant leur bord intérieur (`src/editor/resize.ts`), qui s'éclaire en
bleu au survol ; un double-clic sur ce bord rend la largeur par défaut. La
largeur reste bornée par celle de la fenêtre (180 px au moins) et la figure
suit sans animation pendant le geste. Le panneau de propriétés garde deux
largeurs : l'ordinaire et la large (programme ou formule d'une expression,
480 px par défaut), réglables chacune ; la figure se décale aussi pour la
largeur large. Les largeurs ne sont pas mémorisées d'une session à l'autre.

## Panneau de propriétés

Le bouton « Propriétés » de la barre ouvre un panneau à droite. Un clic
dans la figure, sur une ligne de construction, ou un choix dans la liste du
panneau sélectionne l'objet. La liste permet de retrouver aussi les objets
cachés ; les objets super-cachés en sont exclus. Dans ce mode, un clic vide
ne crée pas de point et les boutons, cases à cocher et champs de la figure
se désignent sans s'actionner. Les points et les curseurs restent déplaçables.
Comme dans le mode propriétés de DGPad, aucun objet n'y est inerte : la
classe `docgeo-awake` du `body` rend le pointeur aux objets inertes, que
`pick`, les noms et les widgets ignorent sinon.

Ce mode ne vaut que sans outil : le panneau ne bloque pas la construction
(décidé le 2026-10-15). Un outil choisi dans la palette, ou la
ligne de saisie, prend les clics comme panneau fermé, et chaque objet
construit s'affiche dans le panneau, prêt à être réglé. Ouvrir le panneau
garde l'outil de la palette ; Échap lâche l'outil, puis ferme le panneau. L'anneau
ne s'ouvre pas tant que le panneau est ouvert. Écarté : un panneau qui
suivrait la sélection, figure toujours en mode construction, qui aurait
fait perdre la désignation des boutons et des cases sans les actionner, le
clic vide qui désélectionne et le clic sur un axe vers l'onglet « Figure ».

Les contrôles sont adaptés à l'objet : nom, couleurs, taille, opacités,
pointillés, calque, visibilité, nom affiché et décimales ; polygone fixé
(`fx`, qu'un glisser ne translate plus) ; objet inerte (`in`, que le
pointeur traverse, sauf panneau ouvert) ; forme, position du
nom, trace et pas des points ; codage des segments ; rayon et marque des
angles droits ; échantillonnage des lieux ; segments des listes ; apparence
des curseurs et animation des points sur objet et des curseurs. Les styles
peuvent s'appliquer aux objets de la même classe. Une couleur (trait,
remplissage, bouton d'un curseur) différente de celle qu'un outil donne à un
nouvel objet du même type montre à côté de son nuancier un bouton ↺ qui l'y
ramène (chaque objet à la sienne, en mode « même type »). Les modifications sont
immédiates, enregistrées dans les styles `.dgo` existants et annulables ;
une saisie numérique ne produit qu'une étape d'historique à sa validation.
Les champs numériques se règlent aussi en cliquant-glissant horizontalement
à la souris : gauche pour diminuer, droite pour augmenter, Maj pour ralentir
d'un facteur dix. Chaque champ a sa vitesse (`SCRUB` dans
`src/editor/properties.ts`, l'étendue des champs dans `view_settings.ts`) :
un réglage borné parcourt sa plage utile en environ 200 pixels (opacité
0 à 100 %, épaisseur +10, calque +20, taille du texte +20, angle du nom
360°) ; une grandeur sans échelle naturelle (écarts, pas, incréments,
vitesse d'animation, nombre de points) varie de 1 % d'elle-même par pixel,
avec un minimum pour partir de 0 ou d'« auto », arrondie à deux chiffres
significatifs (trois avec Maj). Le pas et les bornes sont respectés ; un glissement ne
produit qu'une étape d'historique au relâchement. Un clic simple sélectionne
le nombre pour la saisie ; tant que le champ est en saisie, les gestes natifs
de sélection du texte restent disponibles. Le tactile garde la saisie native
et le défilement du panneau.
Le renommage reconstruit la figure à partir de son `.dgo`, en conservant
les références des dépendants, y compris les formules.

**Définition d'une commande** (2026-10-21) : tout objet écrit par une
commande, curseur compris (point libre excepté), a sa section
« Définition », la zone multiligne des programmes, qui édite ce qui suit
`nom = ` dans sa ligne. Une ligne de plus de 30 caractères élargit le
panneau et s'y affiche mise en forme (`formatCall` de `text.ts`) : un appel
ou un n-uplet trop long pour 50 colonnes donne une ligne indentée à chaque
argument, les courts qui se suivent la partageant, une formule restant
entière et repliée par la zone. Appliquer relit le texte sur une ligne
(`joinLines`) et le valide comme la ligne de construction (`enterLine`).
La zone partage avec les lignes la complétion, sous le curseur, la mise en
évidence des objets acceptés et la désignation : focus dans la zone, un
clic sur un objet de la figure insère son nom, ou remplace le texte
sélectionné, et la parenthèse fermée ainsi applique la définition. Les
formules et valeurs d'expressions en profitent aussi. Échap ferme la
complétion, rétablit le texte, puis quitte la zone. Au survol, un bouton
crayon d'une ligne de construction (`edit_definition`) ouvre les
propriétés sur l'objet, le curseur au bout de sa définition.
Une poubelle apparaît aussi sur chaque ligne, y compris celles en lecture
seule et les points libres (2026-10-28). Elle supprime l'objet de la ligne
avec ses dépendants, indépendamment de la sélection courante ; sur une
application de macro repliée, elle supprime tous les finaux. La suppression
reste annulable. Les deux boutons se montrent aussi au focus clavier et
restent visibles au doigt.
Éditeur : +142 octets (+29 en gzip) ; moteur et lecteur inchangés.

### Onglet « Figure »

Décidé le 2026-10-14. Le repère n'est pas un objet : il n'entre pas dans la
liste « Choisir un objet… ». Deux onglets sous le titre, « Objet » et
« Figure », séparent ce qui se règle sur un objet de ce qui se règle sur la
figure (`src/editor/view_settings.ts`). Un clic sur un objet ou dans la
liste ramène à « Objet » ; un clic sur un axe dans le plan ouvre « Figure »,
où un clic vide ne change pas d'onglet. Tant que « Figure » est affiché,
aucun objet n'est sélectionné (Suppr n'agit pas).

L'onglet expose les réglages de la vue `.dgo` existants, sans rien ajouter
au lecteur, et doit rester plus clair que le panneau de GeoGebra :

- **Repère** : un interrupteur (`ax`, comme le bouton « Repère ») et, dans
  le plan, six modèles en vignettes dessinées d'après leurs propres
  réglages (DGPad, GeoGebra, axes seuls, grille pointillée, quadrillage,
  millimétré). Un modèle remet toute l'apparence du repère, pas le zoom
  ni le fond ; celui qui correspond aux réglages en cours est surligné,
  aussi après une retouche à la main.
- Dans **Axes** : nom, nombres affichés et unité de chaque axe (π proposé, qui
  écrit les nombres en multiples de π/2), graduations, écart des nombres,
  flèches (DGPad, aucune, ouverte ou pleine de GeoGebra), couleur,
  épaisseur, taille et gras des nombres, style, demi-axes positifs.
- **Axes**, **Grille** (interrupteur `gr`), **Zoom et déplacement** : ce
  qui va par axe est dans deux colonnes _x_ et _y_ ; un maillon lie les
  deux écarts (`td`, `gd`), lié au départ s'ils sont égaux. Un écart vide
  affiche « auto » (0 dans le format). Graduations et trait de la grille se
  choisissent par icônes, le style DGPad / GeoGebra (`gg`) par un bouton
  double. La couleur de la grille suit celle des axes tant qu'elle n'est
  pas choisie (`gc` nul) ; un bouton l'y ramène.
- **Figure** : fond, degrés ou radians, segments au-dessus des polygones ;
  les deux derniers relisent la figure.
- Une couleur changée (axes, fond, grille, sol et ses lignes) montre à
  côté de son nuancier un bouton ↺ qui la ramène à son défaut : celle de
  DGPad, ou celle qu'elle suit (la grille les axes, les lignes le sol).
- En 3D, au lieu du repère plan, les sections reprennent ce qui est
  dessiné : **Axes** (interrupteur `ax` du trièdre seul : couleur,
  épaisseur), **Sol** (interrupteur `fl` : couleur, que son bouton ramène
  au bleu et brun de DGPad, opacité, taille, écart, couleur et épaisseur
  des lignes, leur couleur suivant celle du sol tant qu'elle n'est pas
  choisie) et **Vue**
  (perspective). Le bouton « Repère » de la barre montre ou cache les deux.

Un réglage masqué (repère ou grille éteints) reste réglable, atténué. Les
réglages s'appliquent en direct et chaque modification est une étape
d'annulation : une étape garde désormais toute la vue, sauf la fenêtre, le
cadrage (origine et unité) et la caméra (θ, φ). Le bouton « Repère » de la
barre devient lui aussi annulable, et ne rallume plus la grille : il cache
ou montre le repère tel qu'il est réglé.

Le panneau se ferme par sa croix, son bouton ou Échap. Sous 900 px, les deux
panneaux s'ouvrent alternativement ; sous 600 px, les propriétés recouvrent
la figure. La barre tient toujours sur une ligne à 320 px. Tout le code
et les styles CSS du panneau restent dans `src/editor/`.

## Expressions

Plan du 2026-10-12. Une commande polyvalente, comme dans DGPad : nombre,
formule, fonction, curseur, liste, programme. Le moteur sait déjà tout
faire : `expression_object` (valeur, fonction de x, y, z, t, programme,
curseur aux bornes fixes ou calculées, case à cocher, champ de saisie,
LaTeX, ancrage à un point), la grammaire fermée de `dgp_formula.ts`
(`parseFormula`, `parseProgram`, `formulaSource`, `formulaIdentifiers`,
`programReferences`, `programTargets`) et l'entrée `.dgo` `Ex` (`v`, `f` ou
`s`, `mn`/`mx`, `on`/`d`/`xy`). Le format ne change pas : il manque le
chemin de création de l'éditeur.

- **Une commande, une nature déduite du texte**, par la classification de
  l'import DGPad (`dgp_commands.ts`), sortie de l'import pour être partagée :
  constante (`a = 3`, `L = [1, 2, 3]`) → `v` ; fonction de x, y, z, t libres
  (`f = 0.5x^2-4`) → `f` ; formule ou script qui lit la figure
  (`E = d(H, M)`, `if(...){...};"..."`) → `s`. Case à cocher, champ de
  saisie et LaTeX sont des réglages d'affichage (panneau de propriétés),
  pas des natures.
- **Lecture d'une ligne `nom = …`** : `(x, y)` donne un point libre ; une
  commande du catalogue en tête, un appel de commande ; sinon
  `parseProgram`, une expression. Les fonctions de formule sont en
  minuscules (`d`, `sqrt`), les commandes en majuscules : peu de
  collisions. La ligne se relit par `formulaSource`, et `Ex` quitte la
  lecture seule.
- **Dépendances** : les `refs` sont les parents ; un programme est parent
  des objets qu'il stylise (`targets`), dont le refus des cycles de la
  redéfinition doit tenir compte.
- **Expressions en argument** (formules en ligne tranchées le
  2026-10-16) : un paramètre `real` accepte une expression nommée
  (`Cercle(O, r)`) ou une formule en ligne (`Cercle(O, 2*r)`), que le
  `.dgo` stocke déjà pour `C1`, sans objet auxiliaire caché. Une formule
  seulement, lue par `parseFormula` comme le moteur la relit : un
  programme (instructions, `var`, boucles) passe par une expression
  nommée.
- **Curseur** (tranché le 2026-10-12) : une commande
  `Curseur(min, max, valeur)` (`Slider`), relue sous cette forme ; les
  bornes sont des nombres ou des expressions nommées, la valeur un nombre.
  `a = 5` sur un curseur en refait une constante : la ligne dit tout.
- **Programmes longs** (2026-10-12) : la section « Définition » du panneau
  de propriétés, plus large pour une formule ou un programme, édite la
  valeur, la formule ou le programme d'une expression qui n'est pas un
  curseur, sur autant de lignes qu'il faut ; la ligne de texte en montre la
  forme compacte. DGPad n'offrait qu'un champ d'une ligne. Entrée garde
  l'indentation (un niveau de plus après `{`), `}` en tête de ligne la
  retire, Tab indente, ⌘-Entrée ou Ctrl-Entrée applique (bouton
  « Appliquer »), Échap rétablit le texte appliqué ; les frappes passent
  par l'édition du navigateur, annulables comme elle. « Mettre en forme »
  met une instruction par ligne, indentée par ses accolades, en ne touchant
  qu'aux espaces et sauts de ligne entre les jetons. Une erreur désigne la
  ligne où la lecture s'arrête ou une parenthèse, un crochet ou une
  accolade qui ne correspond pas, et la sélectionne ; une méthode inconnue
  est nommée (`s.setColor(` : les méthodes sont celles de DGPad,
  `setRGBColor`…).
- **Nouveau programme** (2026-10-12, déplacé le 2026-10-31) : un bouton `{ }`
  en tête de la famille « Programmes » de la palette ouvre le panneau de
  propriétés sur un programme à écrire : son nom (le prochain libre,
  modifiable) et la même zone
  multiligne, vide, avec un exemple en filigrane. L'expression n'est créée
  qu'au clic sur « Créer » (ou ⌘-Entrée), sans objet provisoire ; la ligne
  de saisie ne s'agrandit pas (pas de Maj-Entrée, décidé avec l'auteur).
- **Listes de points** (2026-10-12) : `L = Liste(p)` (`List`, entrée
  `ELst`) dessine les points de la valeur de l'expression `p`, coupés par
  un point indéfini, avec les instructions de la tortue ; `Liste(` ne met
  en évidence que les expressions. Comme les boutons de la calculatrice de
  DGPad, une expression dont la valeur est une liste de points a dans la
  zone contextuelle « Liste de points » et « Liste de segments »
  (épaisseur 1, réglable ensuite dans le panneau) : elles écrivent cette
  ligne et cachent le texte de `p`, en une étape d'annulation.
- **Suites** (décidé avec l'auteur le 2026-10-17, comme dans GeoGebra) :
  `L = Séquence(f, k, a, b)` ou `Séquence(f, k, a, b, s)` (`Sequence`,
  entrée `Seq`) prend f pour k de a à b par s (1 par défaut). f est une
  formule qui donne un point ou un nombre, `Segment(P, Q)`,
  `Droite(P, Q)`, `Cercle(O, r)`, `Cercle(O, r, u)` (dans le plan
  orthogonal à la direction u, ajouté le 2026-10-21 pour les cercles de
  l'espace d'une figure d'Yves, `Cyclide_de_Dupin_Sequence.dgo`) ou
  `Polygone(A, B, C, …)` de formules,
  ou une autre `Séquence`, dont les bornes lisent k (suites
  triangulaires). La ligne se relit telle qu'écrite ; une variable déjà
  prise par une suite qui l'entoure, ou f d'une autre forme, est refusée.
  Une liste de points se lit dans une formule par son nom, comme une
  liste de DGPad (`L[k-1]`, `L[j-1][i-1]` pour des suites imbriquées,
  `L.length`), et les formules ont `rotate(P, O, a)` et
  `dilate(P, O, k)`, pour que les suites importées de GeoGebra se
  relisent sans cos ni sin : `liste1 =
Séquence(Séquence(Cercle(LesCtr[j-1][i-1], Rayon[j-1]), j, 1, n), i, 1,
n)` dans `CerclesDeCercles.ggb`. Nommées comme les commandes, ces
  fonctions auraient été lues comme `Rotation(…)` (noms comparés sans la
  casse). Comme dans toute formule, `2i` est le nombre imaginaire : écrire
  `2*i`. Pas de valeur sous la ligne d'une liste : ce qu'elle dessine
  suffit, et ses milliers de points seraient réécrits à chaque glisser.
- **Déplacement** (2026-10-12) : comme dans DGPad, une expression se
  glisse par son texte (ou la piste de son curseur), qui suit le pointeur ;
  ancrée à un point, elle garde son ancrage et son décalage change. La
  poignée d'un curseur, une case à cocher ou un champ de saisie gardent
  leur geste, et un objet géométrique sous le pointeur passe avant. Un
  toucher la sélectionne toujours, ou écrit son nom dans la ligne en cours
  de saisie, désignation désormais faite au relâcher pour qu'un glisser
  reste possible pendant une saisie.
- **Nature déduite** (2026-10-17) : comme dans DGPad. `f(x) = …` est,
  comme dans GeoGebra, la courbe de la fonction (`Cur`, sans bornes),
  qu'une formule appelle comme une expression (`f(2)`, `f'(2)`) et que la
  ligne relit `f(x) = …` ; `f(x, y) = …` (variables parmi x, y, z, t) est
  l'expression `f = …`. Sur un intervalle (2026-11-01), elle s'écrit
  comme dans GeoGebra `f(x) = …, (a ≤ x ≤ b)` (`<=` accepté, une borne
  pouvant manquer, bornes nombres ou formules).
- **Produits à la GeoGebra** (2026-10-17) : dans une ligne tapée, un nom
  fait de lettres qu'aucun objet ne porte et qui finit par x, y, z ou t
  est le produit de ses lettres, écrites séparées (`ax^2 + bx` devient
  `a x^2 + b x`), hors appel, méthode et programme (`splitProducts`).
- **Curseurs créés à la volée** (2026-10-17, comme dans GeoGebra) : un nom
  lu par la ligne qu'aucun objet ne porte, commençant par une minuscule
  (`(a, 4)`, `y = m x + p`, `Cercle(O, r)`), devient un curseur ajouté
  avant elle, dans la même étape d'annulation : de −5 à 5 au pas de 0,1,
  valeur 1 ; d'une lettre grecque (`Rotation(O, A, α)`), un angle de 0 à
  360 au pas de 1, valeur 45 (en radians, de 0 à 2π, valeur π/4, pas de
  1°). Pas pour les noms propres aux formules (x, y, z, t, e, i, π) ni
  pour le nom de la ligne. Une ligne refusée ensuite ramène la figure à sa
  dernière étape, sans ses curseurs (`resolveWithSliders`).
- **Degrés et dérivées** (2026-10-17) : `30°` est un angle en degrés,
  converti dans l'unité de la figure, et `f'(x)` la dérivée de f par
  rapport à sa première variable (`f''` la seconde), à côté de `f.dx(x)`
  de DGPad ; tous deux dans la grammaire du moteur, qui les relit dans le
  `.dgo` (`DGO.md`).

### Désignation au clic dans une formule

En tapant `E = d(`, un clic sur H puis sur M doit écrire `E = d(H, M)`,
comme pour `Milieu(A, B)`. Aujourd'hui, `completionAt` reconnaît l'appel
`d(` mais `findCommand("d")` ne trouve rien : ni mise en évidence, ni `, `
ou `)` après le nom, et le clic sur M remplace H (`insertWord` remplace le
mot avant le curseur). Dès qu'un opérateur est tapé (`AI-AM+`), le
tokenizer de la saisie, qui ne connaît que `( ) , =`, échoue et
`completionAt` renvoie `null`.

- **Signatures des fonctions de formule** dans le catalogue, avec le type
  `Overload` des commandes et un indicateur « fonction de formule » :
  `d(point, point)`, `x(point)`, `y(point)`, `sqrt(real)`… `overloadsAt`,
  `paramAt`, `accepts` et `insertArgument` servent alors tels quels : un
  clic sur H écrit `d(H, `, un clic sur M écrit `M)`, et seuls les points
  sont mis en évidence entre-temps.
- **`real` accepte une expression** dans une formule (`accepts` le refuse
  aujourd'hui) : le même changement que les expressions en argument des
  commandes.
- **Tokenizer de la saisie** : celui de `dgp_formula.ts`, réutilisé, pour
  que `+ - * / ^ < > [ ] ; { }` soient des jetons et que `completionAt`
  situe le curseur dans `AI-AM-`.
- **Nom en position libre** : après un opérateur, en tête de formule ou
  pour un argument de type quelconque, un clic insère le nom de tout objet
  lisible (`READABLE` de l'import), tous mis en évidence. Si le mot avant
  le curseur est déjà le nom complet d'un objet, le clic ajoute au lieu de
  remplacer : le remplacement ne sert qu'à compléter un mot en cours de
  frappe.
- **Complétion des fonctions** : en tête de formule ou après un opérateur,
  `d` ou `sq` proposent les fonctions de formule (`d( )`, `sqrt( )`) à côté
  des commandes.
- **Noms entre accents graves** : le parseur de formules doit accepter les
  noms que `formatName` écrit ainsi (`` `A 1` ``).
- Dans la ligne de saisie du bas, un clic dans le vide pendant `d(H, `
  crée un point libre, comme pour les commandes (`expectsPoint`).

## Blocs et tortue

Décidé avec l'auteur le 2026-10-17, après examen de l'implémentation de
DGPad (son `BlocklyManager`, ses `BlocklyObjects`, sa `TurtleObject`) : la
tortue et les programmes Blockly de DGPad, avec le rendu « zelos » de
Blockly (style Scratch 3), choisi par l'auteur. Ce que DGPad faisait mal et
qui n'est pas repris : le programme stocké trois fois (XML, source et code
compilé, renommés par expressions régulières), des dépendances relevées
pendant la génération du code et enregistrées, du JavaScript exécuté par
`eval`, un moteur de calcul qui appelle l'interface, Blockly modifié dans
ses méthodes internes et figé dans sa version de 2016.

- **Apparence** (choisie par l'auteur sur des captures comparées) : rendu
  zelos à l'échelle 0,7, plus compact que celui de Scratch, et les trois
  teintes de Scratch pour chaque catégorie de DocGeo (fond, menus plus
  sombres, contour plus sombre encore), le contour séparant les blocs
  d'une pile ; les blocs de départ (« tortue partant de A »,
  « programme ») ont la couleur de « quand le drapeau vert est cliqué ».
- **Le texte du programme reste la seule source** : le `.dgo` ne change
  pas. Les blocs en sont une vue, reconstruite depuis l'arbre de
  `parseProgram` (`programBlocks`), et réécrivent le texte du programme
  (`blocksProgram`), dans la grammaire fermée de `dgp_formula.ts`, appliqué
  comme le texte de la section « Définition ». Ouvrir les blocs ne réécrit
  rien : seule une modification applique le texte qu'ils écrivent (le
  programme compilé par le Blockly de DGPad devient alors lisible :
  `blockly_var_m` → `m`, sans la fonction qui l'enveloppait).
- **Aller-retour vérifié par les valeurs** (`tests/unit/editor_blocks.test.ts`) :
  un programme et le texte de ses blocs calculent la même chose, mêmes
  mises en forme comprises, et les blocs de ce texte le réécrivent à
  l'identique ; sur les tortues des figures DGPad des tests et sur des
  programmes qui éprouvent les priorités des opérateurs.
- **Une instruction sans bloc** (`L.slice(-2)`, une fonction qui renvoie une
  valeur ailleurs qu'à sa fin…) laisse le programme en texte, avec un
  message ; on ne perd rien.
- **Listes** (2026-10-18, pour les boutons de `urne_et_boules.dgp`) :
  catégorie « Listes » avec les blocs de DGPad `L [ i ]` et `L [ i ] = v`
  (`dg_list_get`, `dg_list_set`, élément compté depuis 1, écrit
  `L[i - 1]` ; `L [ i ] = v` ne vise qu'une variable, une globale ou un de
  leurs éléments : sur un autre bloc, il n'écrit rien), et ceux de Blockly
  « créer une liste vide / avec », « liste avec l'élément … répété … fois »
  (la fonction `listsRepeat` qu'écrit Blockly, recopiée en tête du
  programme) et « longueur de » ; une liste littérale de 2 ou 3 éléments
  reste un bloc « point ». Bloc « entier aléatoire entre » de Blockly,
  sous la forme qu'écrit le Blockly de DGPad
  (`floor(random() * (abs(a - b) + 1) + (a + b - abs(a - b)) / 2)`).
  Les menus d'objets et de globales gardent les noms que citent les
  programmes affichés, même absents de la figure (DGPad n'en change
  rien) : sinon Blockly les remplace par le premier objet du menu, que le
  programme réécrit viserait.
- **Attente** (2026-11-01) : bloc « attendre … ms » (`dg_wait`,
  `WAIT(ms)`, catégorie « Boucles »), qui n'attend que dans le programme
  d'un bouton, la figure redessinée pendant l'attente ; un nouveau clic
  arrête le lancement en cours. Un `ALERT` ou un `WAIT` en dernière
  instruction reste une instruction (et non la valeur rendue par le
  programme), comme l'appel d'une procédure qui ne rend rien.
- **Capteurs** (2026-11-01, comme Scratch) : catégorie « Capteurs » avec
  « demander … et attendre » (`dg_ask`, `ASK(question)`) et « réponse »
  (`dg_answer`, `ANSWER()`). La question s'affiche dans la boîte du
  message, avec un champ ; le programme reprend à la validation (OK ou
  Entrée), comme après un `WAIT`. Hors du programme d'un bouton ou d'un
  événement, `ASK` ne demande rien.
- **Boucles écrites à la main** (2026-11-01, sans nouveau bloc) : `v++`
  seul devient « ajouter 1 à v » ; une boucle `for` qui n'est pas celle de
  Blockly (`i < n`, pas quelconque) devient son initialisation suivie d'un
  « tant que » dont le corps finit par la mise à jour, sauf si ce corps
  contient un `continue` (qui sauterait la mise à jour).
- **Messages, ajout à une liste, ouverture de la figure** (2026-10-19,
  pour `pirates.dgp`) : bloc « afficher le message » (`ALERT`, catégorie
  « Texte »), bloc « ajouter … à la fin de … » de DGPad (`dgpad_push`,
  `L.push(v)`, sur une variable ou un de ses éléments, catégorie
  « Listes » ; avec, depuis le 2026-10-30, « rompre la liste … »,
  `dgpad_stop_list`, `L.push([NaN, NaN, NaN])` : un point non dessinable
  qui interrompt la ligne tracée par la liste, comme le crayon levé de la
  tortue), bloc de départ « quand la figure s'ouvre » (« oninit » de
  DGPad, d'une expression ou d'un bouton, montré avec le programme du
  bouton). Une liste de 2 ou 3 éléments dont l'un est un texte ou une liste
  (`[-1, "choisir..."]`) est un bloc « créer une liste avec », pas un point.
- **Programmes Blockly des figures DGPad** (2026-10-19, chantier
  `BLOCS_BLOCKLY.md`) : chaque programme `BLK` des figures de `tests/dgp/`
  fait l'aller-retour (`tests/unit/editor_blocks.test.ts`, qui tient la
  liste de celles qui ne passent pas encore). Ajouts :
    - fonctions avec résultat (`procedures_defreturn`, le résultat étant
      celui de leur dernière instruction) ;
    - **variables d'une procédure** : celles de Blockly sont celles du
      programme (une procédure peut en calculer une pour le programme,
      comme `compterChiffres` de `division_posee.dgo`), mais le Blockly de
      DGPad déclare siennes celles qu'une procédure affecte (`var` devant
      leur première affectation). Une telle procédure garde cette règle,
      marquée par la `data` de son bloc (« own variables », que Blockly
      conserve), et ses blocs l'écrivent de même (`var m;` en tête) : sinon
      une procédure récursive (Gosper, Hilbert, Cesaro) dessinerait autre
      chose. Les compteurs des boucles sont les siens dans les deux cas ;
      une procédure qui a des deux sortes de variables reste en texte ;
    - « flèches de [objet] : longueur … largeur … » (`setArrow`, Figure),
      « angle [180°|360°] A B C » (`Angle180`, `Angle360`, Figure), le menu
      des grandeurs de la vue de DGPad (largeur et hauteur de la fenêtre,
      coordonnées de son centre, unité en pixels, angles phi et theta :
      `windoww()`… `theta()`, Figure) ;
    - « dernier élément de L » (`L.slice(-1)[0]` de Blockly) et « retirer
      le [premier|dernier] élément de L » (`L.shift()`, `L.pop()`), Listes ;
    - « liste avec l'élément … répété … fois » sous le nom `lists_repeat`
      d'une autre version du Blockly de DGPad ; « répéter n fois » sous la
      forme de Blockly (`var repeat_end = n; for (var count = 0; count <
repeat_end; count++)`), seulement pour un n entier tel qu'écrit
      (`round`, `floor`, `ceil`, longueur, entier) : il répète alors autant
      de fois que celui de DocGeo, compté de 1 à n ;
    - **bloc « expression »** (Figure), le `dgpad_expression_input` de
      DGPad : un texte tapé, écrit tel quel dans le programme. Les blocs ne
      s'en servent que pour ce qui n'a pas d'autre bloc et que les auteurs
      tapaient ainsi : appel d'une fonction de la figure (`f(tLoc)`),
      `NaN`, `L.join("\\times")`, `parseInt`, `split`, `reverse` ; son texte
      est écrit par les blocs (noms de variables simplifiés).
- **Section « Définition »** d'un programme (ou d'un nouveau programme) :
  bascule **Texte** / **Blocs**. Une tortue s'ouvre en blocs, un autre
  programme en texte ; un choix vaut ensuite pour la session. Le programme
  s'applique à chaque changement des blocs, une fois le glisser ou le menu
  terminés, et pendant la saisie d'un nombre ou d'un texte, comme dans DGPad
  (250 ms après la dernière frappe ; une étape d'annulation chacun) ; un
  nouveau programme est créé à son premier bloc. Le panneau, reconstruit
  après chaque changement, retrouve l'espace de travail tel qu'il était
  (`blocks/view.ts`), et rouvre le champ en cours de saisie que sa
  reconstruction a fermé, curseur en place ; une annulation hors du panneau recharge les blocs du
  programme rétabli. Dans le panneau, ⌘-Z est celui de Blockly, comme
  celui du navigateur dans le texte.
- **Bouton « Tortue »** (zone contextuelle d'un point, et de la liste d'une
  tortue) : crée, comme DGPad, une expression super-cachée
  (`TURTLE_INIT("P", P); … return TURTLE_RESULT();`) et la liste qui la
  dessine, en une étape, et l'ouvre en blocs. Elles reçoivent des noms
  ordinaires, pas ceux de DGPad (`blk_turtle_exp_P`, `blk_turtle_list_P`) :
  une tortue est retrouvée par ce qu'elle dessine (`figureTurtles`,
  `turtleStart`), son programme par son `TURTLE_INIT`, et `TURTLE_GET` et
  `TURTLE_LENGTH` la désignent par le nom que lui donne son `TURTLE_INIT`,
  quels que soient les noms de son point, de son programme et de sa
  liste. Les tortues de DGPad, dont la liste est inerte et le
  point souvent caché, s'ouvrent depuis leur ligne du panneau
  « Construction », panneau de propriétés ouvert (le sélecteur d'objet
  montre alors l'expression super-cachée).
- **Boutons** (2026-10-18, comme dans DGPad) : un clic sur la flèche ou
  le libellé lance le programme, sans sélectionner le bouton (la liste
  « Construction » montre ensuite les valeurs qu'il a changées) ; un clic
  sur son cercle à trois points le sélectionne (anneau, zone
  contextuelle), un glisser du cercle le déplace, comme le texte d'une
  expression. Panneau ouvert (blocs agrandis compris), un clic sur le
  bouton le lance aussi, pour essayer le programme qu'on modifie ; son
  cercle le sélectionne. La zone contextuelle d'un bouton
  a un bouton « Programme » (une pièce de puzzle, l'icône Blockly de DGPad)
  qui ouvre son programme en blocs ; la section « Définition » de ses
  propriétés le montre aussi, en blocs par défaut. Bloc « fixer [objet] à
  … » de la catégorie « Figure » (`X.setExpression(v)`, le `SET_EXP` de
  DGPad), bloc « fraction aléatoire » de Blockly (`random()`).
  Commande `Button("libellé")` (2026-10-18, `Bouton` en français) : la
  ligne d'un bouton, qui ne dit que son libellé (lu tel quel, ses « % »
  compris) ; sa redéfinition garde programme, place et style
  (`buttonOverload` de `figure.ts`). Tapée, elle crée le bouton la flèche
  au centre de la vue et ouvre son programme en blocs, comme l'outil
  « Bouton » du menu, qui le pose là où l'on touche. Libellé par défaut
  de l'outil : « Lancer » (`button_caption`).
- **Événements** (proposé par l'auteur le 2026-10-18, à l'essai, comme
  Scratch, à la place des onglets « Appuyé », « Déplacé », « Relâché » de
  DGPad). Les programmes d'un objet sont ses propriétés : le panneau montre
  toujours l'objet (A), jamais l'un de ses programmes. Écartés après essai
  par l'auteur : chaque programme sélectionné comme un objet, avec un bloc
  de départ qui pouvait viser un autre objet (déroutant) ; puis un
  accordéon qui repliait les autres programmes (l'utilisateur croit avoir
  perdu les blocs qui disparaissent : engagement direct).
    - Section « Programmes » d'un point ou d'une expression (sans programme
      propre) : un espace de travail avec tous ses programmes (tortue,
      gestes, changement de valeur), toujours tous visibles et modifiables,
      chacun sous son bloc de départ (`id` `dge:` + son nom), rangés dans
      l'ordre de la figure, leurs procédures dessous. Chaque pile écrit son
      programme avec les procédures qu'elle appelle (`stackState`). Un clic
      dans une pile en fait le programme courant, sans reconstruire le
      panneau (le geste serait interrompu) : celui de « Texte » et de la
      tortue dessinée. Un programme sans blocs n'est que son bloc de départ,
      replié, figé, montré en texte quand on le choisit. Sans programme, un
      bouton « Ajouter un programme » ouvre l'espace de travail vide, sur la
      catégorie « Événements ». Une expression ou un bouton qui a son propre
      programme montre les autres dans sa section « Définition ».
    - Pliage par l'utilisateur, lui seul : « Réduire la pile » / « Développer
      la pile » du menu contextuel d'un bloc de départ (à la place de
      « Réduire le bloc » de Blockly). Pliée, la pile n'est que son bloc de
      départ, sans encoche dessous, une pastille donnant le nombre de ses
      blocs, qui la déplie d'un clic ; son programme garde son texte (`id`
      `dgf:`). Elle reste pliée pour la session.
    - Bouton en haut à droite de l'espace de travail : il l'agrandit sur la
      figure dans une fenêtre, et l'y ramène. Comme dans DGPad, la fenêtre
      se déplace par sa barre de titre (le nom de l'objet ; un double clic
      rend sa place par défaut), se redimensionne par son coin, et laisse
      voir la figure par transparence ; sa place vaut pour la session.
      Les panneaux de construction et de propriétés s'effacent en 180 ms,
      avec un déplacement de 8 px : la figure s'étend d'abord dessous sans
      bouger à l'écran ; au retour, ils réapparaissent avant qu'elle ne leur
      rende leur place. La fenêtre apparaît en fondu et se lève de 8 px ;
      la réduction l'efface en 120 ms, puis les blocs réapparaissent dans le
      panneau. Aucun mouvement si les animations sont réduites. Barre de
      titre translucide, nom dans une pastille, catégories espacées à liseré
      fin, contour arrondi et ombre douce ; le fond de travail garde sa
      transparence, sans flouter la figure.
      Fermer le panneau de propriétés, ou montrer un objet sans blocs, ramène
      les blocs ; le bouton du panneau de construction aussi, et l'ouvre.
    - Dialogues de Blockly (nom d'une variable ou d'une globale,
      confirmation) dans le style de l'éditeur (`dialog` de `view.ts`), ses
      textes « OK » et « Annuler » étant ceux de Blockly.
    - Catégorie « Événements » : les blocs de départ que l'objet peut encore
      avoir, son nom écrit dedans (pas de menu) : « tortue partant de A »,
      « quand A est glissé », « … est appuyé », « … est lâché » (point
      déplaçable), « quand a change » (expression). Lâché dans l'espace de
      travail, il crée le programme (`Evt` super-caché, ou la tortue). Une
      pile glissée sur la boîte à outils (ou son bloc de départ supprimé)
      supprime son programme. « Tortue » quand l'objet a une tortue.
        - Sélectionner un programme (ligne « quand M est glissé » ou de la
          tortue, menu des objets, création) sélectionne son objet et en fait
          le programme courant (`programOwner`, `ownPrograms` de `figure.ts`).
          Pas de bouton « Programme » dans la zone contextuelle (retiré à la
          demande de l'auteur le 2026-10-18) : les programmes d'événement se
          créent par la famille « Programmes » de la palette.
        - Blocs « minimum / maximum de la liste » (`min(a, b)`), et
          `Coordinate("A", 1)` de DGPad lu `y(A)`.
        - Manuel (2026-10-18, validé par l'auteur) : « Programmes
          d'événements » de `expressions.html`, captures `evenements.webp`
          et `blocs-agrandis.webp`. Le lâcher d'un point enregistre l'étape
          et relit les lignes après son propre `pointerup` (celui de
          l'éditeur capture), son programme « lâché » compris.
- **La tortue dessinée** (demandé par l'auteur, comme dans DGPad) : tant
  que le panneau de propriétés montre son programme (texte ou blocs), elle
  est dessinée là où elle finit, tournée dans sa direction, et suit chaque
  bloc ajouté, les glissers et la vue (`src/editor/turtle.ts`, un calque
  recalé à chaque image). Dans le plan, une tortue vue de dessus, la tête
  dans sa direction ; dans l'espace, la flèche de DGPad, bâtie sur sa
  direction et sa gauche à l'écran, verte quand son dessus est tourné vers
  soi, grise sinon. Point d'accroche du moteur : `programTurtle`, la
  tortue telle que le dernier calcul de chaque programme l'a laissée.
- **Angles de la tortue en degrés**, quelle que soit l'unité de la figure :
  ses blocs écrivent `TURTLE_TURN(90°)`. Un angle sans `°` (DGPad passait
  la figure en degrés) ne se lit en blocs que dans une figure en degrés.
- **Blocs** : ceux de DGPad pour la tortue (avancer, tourner, pivoter en
  3D, crayon, couleur n° de la palette 7 × 10 ou `#rrggbb`, épaisseur et
  taille des points, remplissage, écriture, police, image, se tourner vers
  un point, y aller, position, point n° et nombre de points d'une tortue,
  décimales écrites), ceux de Blockly (boucles, logique, maths, texte,
  variables, fonctions avec ou sans résultat ; l'opération + − × ÷ de Blockly prend
  aussi des points, comme le `Math.plus` de DGPad : `P1 + [1, 0]`, sinon
  Blockly refuserait d'y brancher le bloc « point » et l'espace de travail
  resterait vide), une catégorie « Globales » (créer une
  globale, la fixer, l'augmenter, la lire : les globales de DGPad, `Ex`
  cachées de la figure, créées à l'application du programme qui en nomme une
  nouvelle) et une catégorie « Figure » : objet de la figure (menu de ses
  noms), abscisse, ordonnée, distance, point, mise en forme d'un objet
  (`setHidden`…, `setRGBColor`), « renvoyer ». Un bloc valeur laissé seul
  (objet, nombre…) s'écrit `Z;` ou `12;`, comme DGPad (décidé avec
  l'auteur le 2026-10-19). Textes dans les 12 langues
  (`blocks/messages.ts`), ceux de Blockly par ses fichiers de langue.
- **Poids** : Blockly (13.4, ses blocs et le rendu zelos) est un chunk à
  part, `workspace-*.js`, chargé à la première ouverture des blocs, comme
  le fichier de ses textes dans la langue de la page. Il n'importe rien du
  moteur ni de l'éditeur à l'exécution : le programme lui arrive lu, la
  langue et l'écriture des noms par `view.ts`, sinon le moteur serait coupé
  en deux fichiers pour lui. Ni corbeille, ni boutons de zoom, ni sons :
  Blockly irait chercher ses images ailleurs (le build reste autonome).

## Macro-constructions

Chantier ouvert le 2026-10-26, décrit dans `MACROS.md` : définir une macro
par manipulation directe dans la figure, l'appliquer comme un outil natif
(catalogue, outils contextuels, langage textuel). La définition et
l'application vivent dans `src/editor/`, le calcul dans le moteur (nœud
d'application, format dans `DGO.md`).

**Définir une macro** (2026-10-26, `macro.ts` pour la logique,
`macro_panel.ts` et `macro.css` pour l'interface) :

- **Entrée** : « Nouvelle macro », dans la zone « Macros » de la palette
  (au menu Macros hors d'une iframe), ouvre le mode. Les objets
  sélectionnés en deviennent les initiaux, dans leur ordre.
- **Deux étapes** (décidé avec l'auteur le 2026-10-26, à la place d'une
  règle automatique et d'une bascule « Initial / Final », trop confuses) :
  le panneau les annonce dans un cadre bleu, la consigne les répète.
  **Étape 1/2** : chaque toucher ajoute ou retire un initial, même un
  objet déjà déterminé ; « Suivant : les finaux » (grisé sans initial)
  passe à l'étape 2. **Étape 2/2** : chaque toucher sur un objet que les
  initiaux déterminent (en vert) ajoute ou retire un final ; un objet non
  déterminé est refusé, la consigne disant ce qui lui manque ; un initial
  ne fait rien ; « Retour aux initiaux » revient à l'étape 1.
- **Panneau** à droite, à la place des propriétés (fermées en entrant), qui
  glisse comme elles en entrant et en sortant :
  nom, étape, initiaux (rang, message affiché à l'usage, celui du type par
  défaut, ×), finaux à l'étape 2 seulement (nom donné à l'application, ×),
  aide, icône (16 × 16 pixels dessinés à la main ; un trait qui part d'un
  pixel noir efface). Le rang d'un initial se glisse pour changer l'ordre.
  En pied, à l'étape 2, l'état et un bouton qui dit ce qu'il fera :
  « Créer la macro », « Ajouter une méthode à M », « Remplacer la méthode
  de M ». Ce qui l'empêche (final manquant ou non déterminé, autres finaux,
  signature ambiguë, macro créée après) s'écrit en rouge, le bouton
  grisé : aucune boîte de dialogue. Enregistrer est une étape
  d'annulation et ferme le mode, panneau et consigne compris (demandé par
  l'auteur le 2026-10-26).
- **Figure** : le reste sous un voile (comme les aimants), les initiaux en
  bleu, les finaux choisis en orange, ce que les initiaux déterminent en
  vert (le bouquet), ce qui manque à un final en rouge clignotant (fixe si
  les animations sont réduites). Les lignes du panneau « Construction »
  portent la même couleur en bordure, et un toucher sur une ligne désigne
  son objet, caché compris. Un toucher sur un côté de polygone désigne le
  polygone. Un objet qu'aucun type d'initial n'accepte (courbe, liste,
  texte…) est refusé, avec un message.
- La figure reste manipulable. Un toucher dans le vide ne fait rien : on
  sort par la croix, Échap, un outil, les propriétés, la gomme ou une autre
  figure. Annuler et refaire gardent le mode (initiaux et finaux sont
  retenus par leur nom).

**Appliquer une macro** (2026-10-26) : les macros de la figure suivent
« Nouvelle macro » dans la zone « Macros » de la palette, chacune avec son
icône (une boîte sans icône dessinée). Grisée si les objets sélectionnés
ne commencent aucune de ses méthodes ; sinon ils en sont les premiers
initiaux. Choisie, elle se comporte comme un outil du menu : bandeau
(icône, nom, « Terminé »), consigne qui donne l'aide de la macro puis
« 1/3 – » et le message de l'initial attendu (celui du type par défaut,
plusieurs séparés par « · » quand des méthodes attendent des types
différents), initiaux désignés en bleu ; les objets acceptés ne sont pas
mis en vert, ce qui chargerait la figure (décidé avec l'auteur le
2026-10-26) : la consigne suffit. Un
toucher sur un objet accepté, dans la figure ou sur sa ligne, le prend ;
si une méthode encore possible attend un point, un toucher ailleurs en
crée un, libre, sur objet ou à une intersection (`designatePoint`).
Quand un nombre est attendu, la consigne porte un champ où le taper
(Entrée), à défaut d'une expression désignée : un nombre décimal, la
virgule acceptée, écrit en formule constante dans l'entrée `Mac`. Avant le
dernier initial, la macro s'applique en aperçu (pâle, sans noms) à l'objet
survolé ou à un point qui suit le pointeur, pour voir par exemple de quel
côté tombe un triangle équilatéral. **Dans l'anneau** (décidé avec
l'auteur le 2026-10-26) : une seule place « Macros », la dernière, visible
quand une macro de la figure accepte l'objet touché comme premier initial ;
elle ouvre à côté d'elle la liste de ces macros, et celle qu'on choisit
part de l'objet (`showRingMacros`). La
macro s'applique dès qu'une méthode est complète (`applyMacro` : une
entrée `Mac` et une `Out` par final, nommé comme le final de la macro,
numéroté s'il est pris, avec son style de la définition), puis attend de
nouveau son premier initial. On en sort comme d'un outil (Échap,
« Terminé », un autre outil, les propriétés, la gomme). L'outil retient
sa macro et ses initiaux désignés par leurs noms : annuler et refaire
reconstruisent la figure, où il les retrouve ; il se ferme si elle n'a
plus sa macro (une annulation avant sa définition, ou avant la copie
d'une macro de bibliothèque). Le nœud est
super-caché (`h` vaut 2 pour `Mac`) et n'a pas de ligne : l'application
se lit dans celle de ses finaux.

**Initiaux fixés** (2026-10-27, voir `MACROS.md`) : dans le panneau de
définition, un cadenas sur la ligne d'un initial (après son message) le
fixe, cherché ensuite par le nom de l'objet désigné. À l'application, il
est pris sans le demander quand l'éditeur connaît l'objet désigné la
dernière fois pour ce nom, ou que la figure a un objet de ce nom
(`withFixed`), sauf s'il compléterait une méthode ; la consigne porte
alors un bouton « Changer Hz » (`dge-hint-text`), qui le redemande. Le
menu, l'anneau et la sélection partent des initiaux fixés trouvés.

**Langage textuel** (2026-10-26, forme choisie avec l'auteur) : une macro
de la figure est une commande, de son nom (complétée comme les autres,
ses arguments proposés selon les types de ses méthodes). Une ligne
l'applique et nomme ses finaux dans l'ordre : `O, c = Circonscrit(A, B,
C)` ; `_` pour un final non voulu (`O, _ = …`) ; `I = Milieu(A, B)` pour
une macro à un final ; `Circonscrit(A, B, C)` seul nomme les finaux
d'après ceux de la macro. Il faut autant de noms que de finaux
(`macro_names`), libres ou déjà ceux des finaux de l'application
redéfinie (`macro_taken`). Un nombre s'y tape (`Homothétie(O, P, 3)`),
écrit comme formule constante. Les arguments choisissent la méthode,
comme les types choisissent la forme d'une commande. Une application à
plusieurs finaux n'a qu'une ligne, à la place de son premier final
(décidé avec l'auteur le 2026-10-26, à la place d'une ligne par final,
illisible pour les 32 cercles d'Apollonius) : sa pastille montre ou cache
tous ses finaux, et un chevron la déplie en une ligne par final (son nom,
sa pastille, sa valeur), repliée par défaut. Modifier la ligne de
l'application redéfinit l'application (initiaux, méthode, noms) : un
final passé à `_` est
supprimé avec ce qui en dépend, un nom ajouté crée le final. Les
initiaux doivent précéder l'application dans la construction
(`macro_order`). `c =` supprime un final seul. Le panneau de définition
refuse un nom de macro qui n'est pas un mot (`macro_bad_name`) ou qui
est celui d'une commande (`macro_command_name`), de la langue courante ou
de l'anglais. Le nœud d'application n'a pas de ligne.

**Ouvrir la boîte** (2026-10-26, choix de l'auteur) : une action de la
zone contextuelle, après « Réglages » (une boîte au couvercle ouvert),
visible quand l'objet sélectionné est un final d'une application. Ni dans
l'anneau, ni dans les propriétés, ni dans le texte, qui en montre le
résultat. Survolée, elle écrit dans la consigne la ligne de l'application
et le nombre d'objets de sa construction, et montre en aperçu (pâles, sans
noms) ceux qui ne sont pas des finaux. Touchée, elle remplace
l'application par sa construction (`boxOf` de `macro.ts`, `openBox` de
`figure.ts`, qui réécrit le `.dgo`) :

- à la place du nœud, les objets du corps dont les finaux ont besoin, dans
  l'ordre du corps ; un final supprimé ne revient pas, ni ce dont lui seul
  avait besoin ;
- les finaux restent les mêmes objets (nom, style, état) et leurs
  dépendants les suivent ;
- les intermédiaires prennent le nom qu'ils ont dans le corps (`m1` pris
  devient `m2`) et le style qu'ils avaient dans la figure où la macro a
  été définie : cachés s'ils l'étaient (demandé par l'auteur le
  2026-10-26) ;
- les initiaux et leurs sous-objets sont les objets de la figure ; un
  centre qu'elle n'a pas est créé (`Ctr`), avec son nom ; un nombre tapé
  devient une expression constante sous celles qu'elle montre ; un point
  d'un initial qui n'est pas un objet de la figure (fin d'un arc, ou
  extrémité d'un segment final d'une application, calculée dans son corps),
  qu'aucune entrée ne décrit, refuse l'ouverture (`open_box_point`) ; une
  doublure d'un objet de la figure (extrémité d'un segment final qui est
  un initial de son application) est cet objet ;
- un seul niveau : les applications du corps restent des boîtes, qu'on
  ouvre à leur tour ;
- les formules du corps gardent dans le `.dgo` les noms du corps, reliés
  aux objets par leur table ; leur ligne les écrit avec ceux de la figure,
  et une variable propre d'un programme (`var a`) qui prendrait le nom
  d'un objet qu'il lit y est renommée (`a1`), sans quoi la ligne, relue,
  changerait de sens (2026-10-27, `renamed` de `figure.ts`) ;
- les branches d'intersection suivies sont celles du nœud : la figure ne
  bouge pas ;
- la définition reste dans la figure.

Une étape d'annulation. Les objets sortis de la boîte ne sont pas mis en
évidence (décidé avec l'auteur le 2026-10-26) ; l'aperçu au survol, qui
cache ceux qui le seront, suffit.

**Voir le programme** (2026-10-28, voir `MACROS.md`) : le bouton `</>` du
bandeau d'une macro appliquée, et des actions d'un final sélectionné,
ouvre en lecture seule le programme de chaque méthode (`macro_program.ts`).
Le corps est lu à part, dans une construction privée (`readEntries` et
`privateConstruction` de `dgo.ts`), sur les initiaux désignés ou des objets
qui en tiennent lieu, nommés comme dans la figure où la macro a été définie
(clé `n` de `DGO.md`, que `methodOf` remplit), et chaque objet s'écrit par
`lineOf`, comme dans le panneau de construction.

**Bibliothèques de macros** (2026-10-27, `library.ts`, `my_macros.ts`,
voir `MACROS.md`, « Bibliothèque », et `DGO.md`) : hors d'une iframe
seulement, un menu « Macros » de la barre de menus, entre « Affichage » et
« Outils » :

- « Nouvelle macro », qui ouvre la définition, puis « Macros de la
  figure ▸ » (grisées comme dans la palette ; en sous-menu, une
  figure pouvant en avoir beaucoup, demandé par l'auteur le 2026-10-27),
  qui les applique ;
- « Bibliothèque ▸ » (`public/macros/<langue>.dgo`, chargée au démarrage)
  et « Mes macros ▸ » (`localStorage`), leurs dossiers en sous-menus
  (`items` d'un item de `menus.ts` : au survol ou au toucher, à côté de
  l'item, flèches au clavier). Une macro choisie est recopiée dans la
  figure avec celles qu'elle applique, puis appliquée comme une macro de
  la figure ; la copie est retirée si on sort sans l'avoir appliquée. Si
  la figure en a une autre version, une alerte propose de la remplacer :
  la figure est reconstruite, ses applications suivant leur macro, ou
  reste telle quelle si elles ne vont pas à la nouvelle définition
  (`macros_replace_failed`) ; refusée, la figure garde la sienne ;
- « Ajouter à mes macros ▸ » : les macros de la figure, moins les copies
  de macros de la bibliothèque ;
- « Gérer mes macros… » : un dialogue, chaque macro sous son dossier, son
  nom et son dossier modifiables (règle des noms de `nameProblem`, unique
  avec la bibliothèque), × pour la supprimer, refusé si une autre
  l'applique ; « Importer des macros », « Exporter mes macros », un
  rappel qu'elles ne sont gardées que dans ce navigateur ;
- « Importer des macros… » : les macros d'un `.dgo`, figure ou
  bibliothèque ; « Exporter mes macros… » : un `.dgo` sans objets
  (`saveOther` de `file.ts`, qui laisse le fichier de la figure).

Ajouter ou importer une macro qui a le nom d'une des miennes, autrement
définie, ouvre une alerte qui propose de les remplacer toutes ; une macro
au nom d'une macro de la bibliothèque est refusée, sauf à en être la copie
exacte, qui n'est alors qu'une dépendance, pas montrée.

Dans le langage textuel, hors d'une iframe, le nom d'une macro de la
bibliothèque ou de mes macros que la figure n'a pas est une commande
(`isCall`, complétion) : la ligne qui l'applique la recopie dans la
figure, avec celles qu'elle applique (une de même nom dans la figure est
gardée) ; refusée, la figure revient à son étape. La bibliothèque fournie
est produite par `npm run macros` (`tools/macros/`, voir `MACROS.md`).

## Lien avec le lecteur

Un lien « modifier cette figure » pourrait ouvrir la figure du lecteur dans
`editor.html` (par l'URL ou en passant son `.dgo`) : le lecteur reste le
format de diffusion, l'éditeur l'atelier. Une figure intégrée dans une page
web (ci-dessous) a ce lien : le bouton « Modifier la figure » de sa barre.

## Intégration dans une page web

Décidé avec l'auteur le 2026-10-23 (`src/editor/web_page.ts`), en
remplacement de `responsive.php` de DGPad : **Fichier › Intégrer dans une
page web…**, rien d'autre (pas de bouton dans la barre), copie le code d'une
iframe qui montre la figure dans le lecteur (`index.html?fit=…&url=…`, voir
`EMBED.md`, « Page web »).

- La page lit toujours une **figure publiée en ligne**, jamais une figure
  embarquée dans le code (trop lourde avec des images, et qu'une
  modification obligerait à recopier partout) : la republier au même endroit
  met à jour toutes les pages. Une figure qui n'a pas été ouverte par son
  lien (`?url=`, ou par cette commande) demande d'abord ce lien, dans une
  fenêtre qui annonce son remplacement (et la perte des modifications non
  enregistrées) ; la figure publiée y est ouverte à sa place et l'adresse
  de la page reçoit `url=` (`history.replaceState`). Un lien qui échoue
  laisse la fenêtre ouverte, avec l'erreur. Le code copié marche donc à
  coup sûr : l'éditeur vient de charger la figure par le même chemin que le
  lecteur (`figure_url.ts`).
- Une figure modifiée depuis son ouverture par son lien (étape de
  l'historique différente) fait d'abord confirmer qu'on sait que la page
  montrera la version publiée.
- Le cadre de `frame.ts` (celui du mode intégré, placé dans le `body`, donc
  dans la figure entre la barre et le panneau) prend d'abord 80 % de la
  figure, centré. La figure reste manipulable, la vue se zoome et se déplace :
  le **cadrage est porté par le code**, pas par le fichier (région, origine,
  unité, angles 3D), qui n'a jamais à être republié pour un cadrage.
- La zone contextuelle de la barre devient un bandeau, seul au milieu de la
  barre : icône et nom de la commande, Options (centrage, bordure, boutons sur la
  figure, bouton « Modifier la figure », gardés pour la session), **Copier
  le code** (presse-papiers, confirmé par la consigne) et Terminé, ou Échap.
- L'iframe : `width` (en premier, le seul nombre à changer pour une autre
  taille, décidé avec l'auteur le 2026-10-23), `max-width:100%` et
  `aspect-ratio` aux proportions du cadre (pas de bandes vides, la hauteur
  suit la largeur), entourée de `<center>` (option « Centrer la figure », cochée au départ), `allow="fullscreen"`, `loading="lazy"`. L'adresse du lecteur est celle de
  l'éditeur (`index.html` à côté de `editor.html`) : un code copié depuis
  `localhost` ne sert que localement, ce que permet `embed_test.html`.

## Mesure de l'éditabilité

Une figure importée n'est modifiable dans le panneau Construction que si
chacun de ses objets a une ligne (`lineOf`) et que cette ligne, relue telle
quelle, est acceptée (`parseLine` puis `resolve`). Plutôt que de corriger
figure par figure, on mesure sur toutes les figures de `tests/` et du corpus
GeoGebra (`tools/ggb_corpus/corpus`, voir `GGB_IMPORT.md`), ouvertes comme
dans l'éditeur :

```sh
npx vitest run --config tools/editability/vitest.editability.config.ts   # → results.jsonl (~40 s)
python3 tools/editability/summary.py [tests/dgp …]   # résumé, éventuellement restreint à des chemins
```

`summary.py` donne par origine le nombre de figures entièrement modifiables
et la part d'objets modifiables, puis, pour les objets en lecture seule, le
type `.dgo` et, pour GeoGebra, la commande ou le type d'élément d'origine
(nombre d'objets, de figures, et de figures où c'est la **seule** cause), et
enfin les lignes refusées par erreur. Le relancer après chaque extension du
langage textuel, et se fixer sur les causes qui touchent beaucoup de figures
ou en sont souvent la seule cause.

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
  `Sec`, `Arcs`, `Secs`, `CArc`, `CSec`, `CArcs`, `CSecs`, `QArc`, `QSec`,
  `Ctr`, `Int`, `Poly`, `Ang`, `Sym`, `Refl`, `Quad`, `Sph`, `Loc`.
  Les autres objets s'affichent en lecture seule (`nom = …`).
- Langage (`text.ts`) : `nom = Commande(args)`, `A = (x, y)` ou `(x, y, z)`
  pour un point libre, `nom =` supprime ; noms non identifiants entre
  accents graves ; nombres arrondis à 4 décimales à l'affichage.
  Intersection : `Intersection(a, b)` pour deux droites, sinon
  `Intersection(a, b, n)` (n de 1 à 4, sans limite avec une courbe ou un
  lieu, de 1 à 2 pour une droite et une
  sphère, un cylindre ou un cône, dans les deux ordres, entrée `CyI`) ;
  `AutreIntersection(a, b, P)`,
  la plus éloignée de P (l'ordre de l'entrée `.dgo`, qui ne sert que si P
  n'est pas défini, est remis à 0 par une redéfinition).
  Point sur objet : `Point(objet, t)`, ou `Point(objet, a, b)` sur un
  polygone ou une conique, `Point(objet, x, y, z)` sur une sphère, un
  cylindre ou un cône (sur son côté), créé là où la surface est vue sous le
  pointeur. Cercle par trois points :
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
  (Échap au clavier). Styles de création (`createdStyle` de `figure.ts`),
  propres à DocGeo et choisis par l'auteur (2026-10-30) : points opaques,
  contour `#1E293B`, orange (`#F59E0B`) libres et sur objet, gris
  (`#CBD5E1`) construits, nom affiché en taille 26 ; une couleur par type
  d'objet (segment, vecteur, droite, demi-droite, parallèle,
  perpendiculaire, médiatrice, bissectrice, tangente, angle, cercle, arc,
  secteur, conique, polygone), sa famille pour les types voisins ; comme
  dans DGPad, polygones, sphères et secteurs remplis à 20 %. Une nouvelle
  figure a le fond blanc `#FFFFFF`. Les défauts du format (`LOOKS` de `dgo.ts`,
  fond `#FAFAFA`) restent figés.
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

- Droite et sphère, cylindre ou cône (2026-10-30) : `Intersection(d, s, n)`
  (n = 1 ou 2, dans les deux ordres, entrée `CyI`), au clavier comme au
  geste : l'outil « Intersection », le survol et le croisement d'un clic
  prennent une droite et une surface (`crossable`, `meet` du catalogue).
  Deux surfaces, une surface et une courbe ne se croisent pas en points.
  Comme dans GeoGebra (décidé avec l'auteur le même jour), deux objets
  désignés l'un après l'autre (figure, panneau ou sélection) donnent
  tous leurs points d'un coup (`intersections`) : un de deux droites,
  deux d'une droite ou d'un cercle avec une droite, un cercle, une
  conique ou une surface, même non définis ; de coniques ou de courbes,
  ceux trouvés à la création (au moins un, au plus quatre). Un clic sur
  un croisement n'en crée qu'un. La consigne de l'outil, en 3D, nomme
  les surfaces, puis demande une droite après une surface.
  Éditeur +1 Ko (+0,26 Ko en gzip) ; moteur et lecteur inchangés.

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

- Noms des points glissés comme dans GeoGebra (2026-10-12, section
  « Noms des points ») : clé `.dgo` `nd`. Vérifié dans `editor.html`
  (glisser, annuler, toucher sur le nom). Éditeur : 69,2 Ko, CSS inclus
  (25,0 Ko en gzip) ; lecteur : +80 octets (+20 en gzip), le champ
  `nameDistance` du moteur.

- Punaise (2026-10-12, section du même nom). Vérifiée dans `editor.html`
  (bascule, zoom, annuler / refaire après zoom, ligne de texte).
  Éditeur : 70,3 Ko, CSS inclus (25,4 Ko en gzip) ; lecteur inchangé.

- Ressort (2026-10-12, section du même nom) : `src/editor/spring.ts`.
  Vérifié dans `editor.html` (segment, cercle, aller-retour, reprise sur un
  point animé, annuler). Éditeur : 75,7 Ko, CSS inclus (27,3 Ko en gzip) ;
  lecteur : +19 octets, une exportation de plus du moteur partagé.

- Points sur conique animés (2026-10-12, section « Ressort »), donc aussi
  au ressort. Vérifiés dans `editor.html` (ellipse, hyperbole). Éditeur :
  +60 octets ; lecteur : +609 octets (+249 en gzip), la marche le long de
  la conique dans le moteur.

- Expressions, première étape (2026-10-12, section du même nom) : une
  ligne `nom = formule` qui n'est ni un point ni une commande du catalogue
  crée une `Ex`, de nature déduite par la classification de l'import
  DGPad, sortie dans `src/import/dgp_expression.ts` (`expressionContent`).
  Créée sous les expressions affichées en haut à gauche, valeur montrée
  avec deux décimales en taille 24, comme par la calculatrice de DGPad. La
  ligne relit le texte enregistré de la formule, ses noms réécrits en ceux
  des objets (renommage) et sans saut de ligne ; redéfinie, l'expression
  garde son texte, sa place, son ancrage et, constante, les bornes de son
  curseur. Ordre et cycles de la redéfinition suivent les entrées `.dgo` :
  les cibles d'un programme le précèdent bien qu'il soit leur parent dans
  le moteur (un programme peut lire ce qu'il stylise). Erreurs : nom
  inconnu, fonction inconnue (`unknown_command`), écriture incomprise.
  Désignation au clic dans une formule : fonctions de formule signées dans
  le catalogue (`FUNCTIONS` : `d`, `x`, `y`, `sqrt`, trigonométrie…,
  `min`, `max`), complétées en tête de formule ou après un opérateur, sans
  aperçu et sans valider la ligne à leur `)` ; `real` accepte une
  expression nommée (`Cercle(O, r)`, écrite `C1` à formule réduite à ce
  nom), les nombres seuls étant `number` (`Point`, `Intersection`,
  `PointFixe`) ; la saisie lit ses jetons avec le lexer de
  `dgp_formula.ts`, qui accepte les noms entre accents graves et les
  primes (`A'`) ; en position libre, les objets lisibles sont mis en
  évidence et un clic ajoute un nom après un nom complet. Vérifié dans
  `editor.html` (`E = d(` puis H et M, point libre créé par un clic dans
  le vide, complétion de `sq`, redéfinition et erreurs, figures DGPad à
  programmes). Éditeur : 80,2 Ko, CSS inclus (28,6 Ko en gzip), soit
  +3,2 Ko (+1,2 Ko en gzip) ; lecteur : +558 octets (+253 en gzip), le
  lexer et le module partagé.

- Curseurs et éditeur multiligne des programmes (2026-10-12, section
  « Expressions ») : commande `Curseur` / `Slider` écrivant une `Ex` à
  bornes (sous la piste des curseurs déjà affichés), relue par le
  catalogue, dont la relecture vérifie désormais que les arguments décodés
  sont acceptés ; un curseur à bornes calculées par formule reste en
  lecture seule (il a sa ligne depuis les formules en argument). Section « Définition » du panneau de propriétés
  (`formatProgram`, `syntaxLine`, `unknownMethod` dans `text.ts`). Un
  toucher sur un curseur, un texte ou une expression le sélectionne au
  lieu de créer un point. Vérifiés dans `editor.html` (création, glisser
  de la poignée, ligne mise à jour, sélection, nom inséré pendant une
  saisie ; programme mis en forme, indentation au clavier, ⌘-Entrée,
  erreur de ligne). Éditeur : 85,7 Ko, CSS inclus (30,4 Ko en gzip),
  soit +5,5 Ko (+1,8 Ko en gzip) ; lecteur : +22 octets (une exportation).

- Listes de points (2026-10-12, section « Expressions ») : commande
  `Liste` / `List`, actions « Liste de points » et « Liste de segments »
  de la zone contextuelle. La complétion se ferme quand une ligne est
  validée. Vérifié dans `editor.html` (boutons proposés pour la seule
  expression à liste de points, consigne au survol, ligne tapée avec mise
  en évidence, annulation qui remontre l'expression). Éditeur : 86,9 Ko,
  CSS inclus (30,7 Ko en gzip), soit +1,3 Ko ; lecteur inchangé.

- Bouton « Nouveau programme » (2026-10-12, section « Expressions »).
  Vérifié dans `editor.html` à 1200 et 360 px de large (focus dans la
  zone, indentation au clavier, création, sélection du nouvel objet).
  Éditeur : 87,8 Ko, CSS inclus (31,0 Ko en gzip), soit +0,9 Ko ; lecteur
  inchangé.

- Déplacement des expressions (2026-10-12, section « Expressions »).
  Vérifié dans `editor.html` (expression et curseur glissés par leur
  texte, poignée du curseur, nom écrit par un toucher pendant une saisie,
  annulation et rétablissement). Éditeur : +0,5 Ko (+0,1 Ko en gzip) ;
  lecteur inchangé.

- Points définis par une formule (2026-10-13, entrée `Fp`, le
  `Point("M","2*B-A","0")` de DGPad) : `M = (x(B) + 1, y(A))`, des
  coordonnées qui ne sont pas toutes des nombres (un point libre sinon), et
  `M = Point(2*B - A)`, un seul argument, qu'aucun point sur objet ne prend,
  pour une formule dont la valeur est un point ; la ligne relit l'une ou
  l'autre forme. Comme le bouton point de la calculatrice de DGPad, une
  expression dont la valeur est un point a dans la zone contextuelle
  « Point » : comme « Liste de points », il ajoute le point qu'elle donne
  (`C = Point(a)`) et cache l'expression sans la supprimer, en une étape
  d'annulation (décidé avec l'auteur le 2026-10-13). Lecteur :
  les points fixes et à formule sont remplis en gris (défaut `.dgo` de
  `Fix` et `Fp` changé), comme `point_fixed` dans DGPad. Vérifié dans
  `editor.html` (figure DGPad, saisie des deux formes, redéfinition,
  action « Point »). Éditeur : +2,2 Ko (+0,6 Ko en gzip) ; lecteur :
  +30 octets.

- Point, liste ou expression (2026-10-13, idée de l'auteur) : une ligne
  `nom = formule` dont la valeur est un point ou une liste de points
  (essayée sur une expression ajoutée et retirée aussitôt) montre au bout
  de la ligne ses choix : « Point », ou « Liste de points » et « Liste de
  segments », et « Expression » (calculatrice) ; leur survol montre les
  lignes que chacun écrit. Entrée choisit celui qui est allumé : un point
  pour un nom à majuscule (comme l'éditeur nomme les points) ou un point
  redéfini, une expression sinon ; pas de raccourci pour l'autre choix
  (décidé avec l'auteur). Une nouvelle ligne choisie « Point » est un
  point qui porte la formule ; une liste, ou un point tiré d'une expression
  existante, s'ajoute en gardant l'expression, cachée, comme les actions de
  la zone contextuelle. Les boutons ne suivent pas le défilement du
  panneau, comme la complétion (accepté). Les points construits (autres
  que libres et sur objet) sont créés remplis de gris (`#cccccc`), comme
  dans DGPad. Vérifié dans `editor.html`. Éditeur : +2,9 Ko (+0,9 Ko en
  gzip) ; lecteur inchangé.
- Langues (2026-10-13, section du même nom) : 12 langues, noms de
  commandes de GeoGebra, remplacés le 2026-10-14 par les mots usuels de
  chaque langue (table ajoutée en `zh-TW`). Vérifié dans `editor.html` en allemand, arabe,
  hindi et chinois. Éditeur : −2,2 Ko (88,4 Ko, le français sorti du
  chunk) et 2,2 à 3 Ko en gzip par langue chargée ; lecteur inchangé
  (`index` 15,2 Ko), l'aide d'interopérabilité de Rolldown passant du
  moteur dans un chunk à part (0,6 Ko).

- Plan et espace (2026-10-13, section du même nom) : bouton « Vue 3D »,
  caméra animée, objets hors du plan refusés dans une figure plane, retour
  au plan refusé tant qu'il en reste, mode gardé par les étapes
  d'annulation. La barre passe à des boutons de 32 px sous 440 px, et la
  zone contextuelle flotte sous la barre jusqu'à 680 px. Vérifié dans
  `editor.html` (refus, aller-retour, annuler / refaire, figure DGPad 3D,
  barre de 320 à 800 px). Éditeur : 90,9 Ko, +2,1 Ko (+0,8 Ko en gzip) ;
  lecteur inchangé (+10 octets d'exportations du moteur partagé).

- Onglet « Figure » du panneau de propriétés (2026-10-14, section du même
  nom) : repère, modèles, axes, grille, zoom, fond et unité d'angle ; vue
  annulable. Vérifié dans `editor.html` (modèles, annuler / refaire,
  synchronisation avec le bouton « Repère », 3D). Éditeur : 101,9 Ko,
  +11,0 Ko (+3,7 Ko en gzip), CSS +4,1 Ko (+0,9 Ko en gzip) ; lecteur
  inchangé.
- Axes de GeoGebra (2026-10-14, item 23 de `GGB_IMPORT.md`) : flèches,
  noms, nombres masqués et unité π, au format (`al`, `nu`, `au`, `ah`), au
  dessin, à l'import et dans l'onglet « Figure ». Vérifié face au rendu de
  GeoGebra sur des figures du corpus. Lecteur +1,9 Ko (+0,8 Ko en gzip),
  éditeur +1,3 Ko (+0,4 Ko en gzip).
- Onglet « Figure » en 3D (2026-10-14) : sections Axes, Sol et Vue ;
  couleur, opacité, taille, écart, couleur et épaisseur des lignes du sol
  au format (`fc`, `fo`, `fe`, `fd`, `fg`, `fw`) et au dessin. Vérifié
  dans `editor.html` (réglages, annuler / refaire). Moteur partagé
  +0,7 Ko (+0,2 Ko en gzip), éditeur +1,1 Ko (+0,4 Ko en gzip).
- Cercle centre et rayon dans l'anneau (2026-10-14) : `C1` à rayon
  numérique d'environ 150 px, créé d'un clic (section « Anneau
  d'outils ») ; une expression n'ouvre toujours pas d'anneau. Vérifié dans
  `editor.html` (ligne survolée, création, rayon après un zoom). Éditeur
  +0,2 Ko (+0,1 Ko en gzip) ; lecteur inchangé.
- Noms des points renommés et masqués sur place (2026-10-14, section
  « Noms des points ») : curseur « doigt » au survol d'un nom. Vérifié
  dans `editor.html` (curseur, renommage, nom pris, Échap, masquer,
  annuler, toucher ailleurs). Éditeur +2,0 Ko (+0,6 Ko en gzip) ; lecteur inchangé.

- Marques d'angles glissées (2026-10-14, section du même nom). Vérifié
  dans `editor.html` (curseur, glisser, annuler / refaire, sélection,
  champ du panneau suivi). Éditeur +1,8 Ko (+0,6 Ko en gzip) ; lecteur
  +30 octets (une exportation du moteur partagé).
- Panneau « Construction » soigné (2026-10-14, section « Barre d'actions
  et historique ») : pastilles de visibilité, bouton du nom des points,
  compteur, saisie collée au bas. Vérifié dans `editor.html` (bascules,
  annuler, gomme, liste qui défile). Éditeur +3,1 Ko (+0,7 Ko en gzip) ;
  lecteur inchangé.
- Valeurs sous les lignes et construction pas à pas (2026-10-14, même
  section). Vérifiés dans `editor.html` (lecture, pause, clavier, toucher
  sur une ligne, glisser pendant le pas à pas, Échap, annuler, panneau à
  360 px). Éditeur +4,9 Ko (+1,5 Ko en gzip) ; lecteur inchangé.
- Nom des objets autres que les points (2026-10-14, section « Noms des
  points ») : bouton « nom » du panneau « Construction » et case du
  panneau de propriétés pour tout objet dont le moteur écrit le nom
  (`hasName`). Vérifié dans `editor.html` sur une figure GeoGebra.
  Éditeur +62 octets ; lecteur inchangé.
- Noms des autres objets glissés et renommés sur place (2026-10-14,
  section « Noms des points ») : style `no`, place relative à l'objet,
  convertie aussi depuis le `labelOffset` de GeoGebra. Vérifié dans
  `editor.html` (glisser le nom puis un point du segment ou du cercle,
  annuler, renommage) et face au rendu de GeoGebra sur des figures du
  corpus. Lecteur +1,9 Ko (+0,6 Ko en gzip), éditeur +0,2 Ko
  (+0,1 Ko en gzip).
- Fil à la patte de la conique par cinq points (`Quad`), que ni DGPad ni
  GeoGebra ne montrent : dès le deuxième point, jusqu'à trois points
  cachés complètent les points désignés et le pointeur sur la conique
  passant par eux la plus proche d'un cercle (`src/editor/conic_preview.ts`).
  Par deux points, le cercle de diamètre ; par trois, le cercle
  circonscrit ; par quatre, la conique de leur faisceau qui minimise
  ((λ − μ)/(λ + μ))² (λ, μ valeurs propres de sa partie quadratique) :
  le cercle s'ils sont cocycliques, une ellipse s'ils sont en position
  convexe, sinon une hyperbole. Éditeur +1,3 Ko (+0,6 Ko en gzip) ;
  lecteur inchangé.
- Lieu dans l'anneau (2026-10-14, section « Anneau d'outils ») : sur un
  point dont dépend un point sur objet, comme dans DGPad, `Lieu(M, P)`
  créé d'un clic. Vérifié dans `editor.html` (outil présent sur le point
  dépendant, absent sur un point libre, ligne survolée, création).
  Éditeur +0,4 Ko (+0,1 Ko en gzip) ; lecteur inchangé.
- Menu des outils (2026-10-14, section du même nom) : bouton à droite de
  la ligne de saisie, familles et sous-menus, aide au survol, outil
  persistant avec son bandeau, rayon tapé, petit écran. Vérifié dans
  `editor.html` avec Playwright (cercles enchaînés, perpendiculaire par
  la droite d'abord, intersection, polygone, milieu d'un segment, point
  sur objet, annuler en gardant l'outil, sortie par Échap et par la ligne
  de saisie ; à 380 px au doigt, panneau refermé ; arabe). Puis outils
  hors de l'anneau (conique, arc…), cercle de rayon par défaut et bouton
  droit pendant l'outil (point glissé, vue déplacée). Éditeur : 128,4 Ko,
  +7,6 Ko (+2,0 Ko en gzip) ; lecteur inchangé.
- Sélection multiple (2026-10-14, section du même nom) : vérifiée dans
  `editor.html` avec Playwright (⌘-clic sur A, B, C puis
  CercleCirconscrit, droite puis point pour Perpendiculaire, polygone de
  quatre sommets, segment depuis l'objet de l'anneau, suppression de deux
  points, appui long au doigt, toucher qui vide). Éditeur : 131,4 Ko,
  +3,0 Ko (+0,9 Ko en gzip) ; lecteur inchangé.

- Propriétés de plusieurs objets (2026-10-14, section « Sélection
  multiple ») : vérifiées dans `editor.html` avec Playwright (« Réglages »
  sur A et B, ⌘-clic sur le segment puis sur une ligne pour ajouter et
  retirer, réglages communs, couleur appliquée aux trois, annuler,
  toucher simple, suppression de deux objets). Éditeur : 132,9 Ko,
  +1,5 Ko (+0,5 Ko en gzip), CSS +0,1 Ko ; lecteur inchangé.

- Équations (2026-10-15, section « Langage textuel ») : droites, cercles
  et coniques d'une équation tapée, de nature lue dans ses coefficients ;
  celles d'une figure GeoGebra se relisent en objets de même type, les
  équations enregistrées par leurs seuls coefficients écrites sans
  termes nuls (`x - y - 2 = 0`). Éditeur +1,4 Ko (+0,5 Ko en gzip) ;
  lecteur +0,2 Ko.

- Rotation, homothétie, translation (2026-10-15) : `Rotation(P, O, a)`,
  `Homothétie(P, O, k)` (a, k nombres ou expressions nommées) et
  `Translation(P, u)` (u vecteur) au clavier, images de points (entrées
  `Rot`, `Dil`, `Tra`), nommées comme des points. Au menu des outils,
  dans la famille « Symétries » renommée « Transformations » : rotation
  et homothétie (le point, puis le centre ; 90° et un rapport de 2,
  section « Menu des outils »), translation (le point, puis le vecteur).
  Éditeur +0,9 Ko (+0,3 Ko en gzip).

- Arcs de centre donné et demi-cercle (2026-10-15) : `ArcCentre(M, A, B)`
  et `SecteurCentre(M, A, B)`, de A à la demi-droite [MB) dans le sens
  direct, et `DemiCercle(A, B)`, à gauche de AB (entrées `CArc`, `CSec`,
  `Semi`), au clavier et au menu (« Cercles, arcs, coniques »). Noms
  composés qui contiennent ceux d'`Arc` et `Secteur`, qui restent l'arc
  par trois points. L'image d'un arc par une symétrie axiale, parcourue
  dans le sens indirect, s'affiche en lecture seule. Éditeur +0,5 Ko
  (+0,1 Ko en gzip).

- Tangentes (2026-10-15) : `Tangente(P, c, n)`, la tangente n (1 ou 2)
  par P à un cercle ou une conique, comme `Intersection(c, d, n)`, et
  `Tangente(P, f)`, à la courbe d'une fonction (entrée `Tan`). Au menu,
  famille « Constructions », un seul outil pour les deux formes (le point,
  puis le cercle, la conique ou la courbe), qui donne la tangente 1, que
  la ligne change ; les formes d'un item du menu hors de l'anneau peuvent
  désormais être plusieurs. Éditeur +0,7 Ko (+0,2 Ko en gzip).

- Centres, polygone régulier, sommet, inversion (2026-10-15) : un nom
  d'école par centre plutôt que le numéro de Kimberling de GeoGebra,
  `CentreInscrit`, `CentreGravité`, `CentreCirconscrit`, `Orthocentre`
  (A, B, C), au menu des points ; le centre du cercle d'Euler, rare,
  s'affiche en lecture seule. `PolygoneRégulier(A, B, n)` (n ≥ 3), au
  menu « Polygones, angles, lieux », qui donne un carré que la ligne
  change ; `Sommet(p, k)`, de rang k depuis 1, au clavier ;
  `Inversion(P, c)`, au menu des transformations (le point, puis le
  cercle). Éditeur +1,5 Ko (+0,4 Ko en gzip).

- Solides (2026-10-15, décidé avec l'auteur : un objet unique qui dessine
  tout) : `Cylindre(A, B, r)`, `Cône(A, B, r)` (base de centre A, sommet
  B), `Cube(A, B, C)` (sur le carré ABCD du plan ABC ; voir plus bas
  le cube en deux clics), `Prisme(p, P)`,
  `Pyramide(p, S)` sur un polygone p, et `Sphère(O, r)` à côté de
  `Sphère(O, A)`. Un solide est une seule ligne : il dessine ses faces ou
  sa silhouette, ses arêtes ou ses bords (en pointillé derrière) et cache
  ce qui est derrière lui ; `Sommet(c, k)` donne les sommets d'un
  polyèdre. Au menu, une famille « Solides », hors de l'anneau et en 3D
  seulement ; le cylindre et le cône prennent le rayon par défaut du
  cercle. Éditeur +1,1 Ko (+0,3 Ko en gzip) ; lecteur +4,8 Ko (+1,4 Ko en
  gzip).

- Plans, sections et patron (2026-10-15) : `Plan(A, B, C)`, `Plan(A, d)`
  (contenant d), `PlanParallèle(A, p)`, `PlanOrthogonal(A, d)` et
  `p = x + y + z = 3` ; `Section(s, p)` d'une sphère (cercle), d'un
  cylindre ou d'un cône (conique limitée au solide), d'un polyèdre
  (polygone) ; `Patron(c, f)` d'un cube, d'un prisme ou d'une pyramide,
  déplié de f (0 : plié, 1 : à plat), un objet unique qui dessine ses
  faces, comme les patrons de GeoGebra. Au clavier seulement :
  `Intersection(d, p)`, `Intersection(p, q)`, `Intersection(s, t)` de deux
  sphères, `Perpendiculaire(A, p)` (au geste depuis le 2026-10-16). Au menu, une famille « Plans » (3D),
  et `Section` et `Patron` à la fin des « Solides ». Les solides se
  désignent à l'intérieur de leur contour, l'anneau s'ouvrant en son
  milieu ; plans, sections et sphères de rayon donné créés sont remplis
  comme les polygones.
  Éditeur +2,5 Ko (+0,75 Ko en gzip) ; moteur +3,3 Ko (+1,1 Ko en gzip,
  avec l'item 33 de `GGB_IMPORT.md`), lecteur inchangé.

- Cube en deux clics (décidé avec l'auteur le 2026-10-15) : deux points
  ne déterminent pas le plan du carré, sauf s'ils le partagent. Deux
  points sur un même plan ou polygone donnent `Cube(A, B, p, ±1)`, le
  cube du côté du plan tourné vers la caméra à sa création, mémorisé
  (±1 : du côté de la normale de p ou de l'autre) ; deux points libres de
  même cote, comme sur le sol, `Cube(A, B, 1)`, carré horizontal, cube
  au-dessus (−1 au-dessous, au clavier). Sinon, le troisième point reste
  à désigner ; l'aperçu montre le cube dès le survol du deuxième. Ces
  cubes, comme `Cube(A, B, p)` importé de GeoGebra, sont indéfinis dès
  que AB n'est plus parallèle au plan, comme dans GeoGebra (DocGeo
  dessinait un parallélépipède). Les faces d'un solide n'étant pas des
  objets, deux sommets d'un cube n'en empilent pas un autre. Au passage :
  un plan tout juste créé n'était pas désignable avant un changement de
  vue, ses coins n'étant pas projetés. Éditeur +1,0 Ko (+0,4 Ko en
  gzip) ; moteur +0,6 Ko (+0,2 Ko en gzip), lecteur inchangé.
- Construction panneau de propriétés ouvert (2026-10-15, section « Panneau
  de propriétés ») : un outil du menu ou la ligne de saisie prend les
  clics, l'objet construit s'affiche dans le panneau ; auparavant, l'outil
  restait armé mais inerte. Vérifié dans `editor.html` (outil Segment,
  ligne de saisie avec désignation et point libre, sélection après Échap,
  Échap deux fois). Éditeur +57 octets (+21 en gzip) ; lecteur inchangé.
- Perpendiculaire à un plan au geste (2026-10-16) : en 3D, l'outil
  « Perpendiculaire » prend une droite ou un plan (paramètre `linear`,
  forme sans étiquette résolue à la construction comme « Section »), dans
  l'ordre qu'on veut ; dans le plan, il ne prend toujours qu'une droite.
  Le sol se désigne comme un plan, là où aucun objet n'en prend un, pour
  tout outil qui attend un plan (`Perpendiculaire`, `PlanParallèle`,
  `Section`) : il devient un plan `z = 0` caché (le `xOyPlane` de
  GeoGebra), ajouté à la première désignation puis réutilisé, et l'aperçu
  le prend déjà au survol, montrant le sol jusqu'à ce que l'outil
  s'applique. Éditeur +0,9 Ko (+0,3 Ko en gzip) ; lecteur
  inchangé.
- Cercles d'axe donné (2026-10-16), les outils 3D de GeoGebra « cercle
  d'axe donné passant par un point » et « cercle (centre, rayon,
  direction) » : `Cercle(d, P)`, d'axe d (droite, segment, demi-droite,
  vecteur) passant par P (entrée `CAx`), et `Cercle(O, r, d)`, de centre
  O et de rayon r autour d'une droite, ou parallèle à un plan
  (`C1` à axe, qui prend désormais un plan), dans l'ordre de GeoGebra.
  Au menu, en 3D, à la suite du compas : « Cercle (centre, direction et
  rayon) » (le centre, puis une droite ou un plan, le sol compris, le
  rayon d'environ 150 px de « Cercle (centre et rayon) ») et « Cercle
  (axe et point) ». Un cercle d'un plan non horizontal garde la figure
  en 3D. Les libellés des outils d'une même commande sont portés par
  l'outil (`labelled` dans `tools.ts`) et non plus par l'étiquette `.dgo`,
  que les deux formes de `C1` partagent. Import GeoGebra : item 36 de
  `GGB_IMPORT.md`. Éditeur +0,6 Ko (+0,14 Ko en gzip) ; moteur +0,85 Ko
  (+0,27 Ko en gzip). Les cercles et arcs de l'espace sont en pointillés
  là où le sol ou une face les cache (même item), moteur +1,1 Ko.
- Formules en argument (2026-10-16, section « Expressions ») : un
  paramètre `real` (rayon d'un cercle, d'une sphère, d'un cylindre ou
  d'un cône, angle d'une rotation, rapport d'une homothétie, demi-axe
  d'une ellipse ou d'une hyperbole, dépliement d'un patron, bornes d'un
  curseur) accepte une formule (`Cylindre(A, C, d(A, B))`), un argument
  courant jusqu'à la virgule ou la `)` de l'appel. Elle est lue par
  `parseFormula`, ses noms étant ceux des objets (`FormulaArg` dans
  `catalog.ts`), écrite `[texte, {nom: indice}]` et relue telle quelle,
  renommage compris ; un curseur à bornes calculées a désormais sa ligne.
  Les fonctions de formule sont complétées en position d'un tel
  paramètre. Une formule dont la valeur n'est pas un nombre donne un
  objet non défini. Dans une figure 3D, le moteur évalue désormais ces
  formules (rayons, angles, rapports, bornes de curseur), ainsi que celles
  des textes et des angles fixes, avec les trois coordonnées des points,
  comme les expressions : `d(A, C)` y valait 0
  pour C à la verticale de A, ce qui faussait aussi l'import GeoGebra
  (`Sphere(A, Distance(A, C))`). Éditeur +0,8 Ko (+0,2 Ko en gzip) ;
  moteur +60 octets.

- Raccourcis de GeoGebra (2026-10-17) : curseurs créés à la volée,
  `30°`, `f'(x)`, `f(x) = …` tracée, `ax` lu a x, coordonnées polaires, noms des vecteurs et
  des angles (sections « Langage textuel » et « Expressions »), puis le
  vecteur libre `VecF` (même section). Vérifié
  dans `editor.html` avec Playwright (lignes, ligne refusée sans ses
  curseurs, annulation ; vecteur glissé à la souris ; parabole
  `f(x)=ax^2+bx+c` tracée). Éditeur +2,8 Ko (+1,1 Ko en gzip) ; moteur +0,9 Ko (+0,3 Ko en gzip, dont 0,6 Ko pour
  le vecteur libre) ; `index` +0,1 Ko (état élève).

- Désignation dans le panneau « Construction » (2026-10-17, section
  « Menu des outils ») : lignes acceptées en vert, autres pâlies, objets
  cachés désignables, lignes déjà désignées en bleu avec leur place.
  Vérifié dans `editor.html` avec Playwright (droite par deux points dont
  un caché, intersection de deux courbes, polygone fermé sur son premier
  sommet, perpendiculaire par sa droite d'abord, ligne de nouveau
  éditable après Échap, sélection par ligne du panneau de propriétés).
  Éditeur +1,5 Ko (+0,4 Ko en gzip) ; moteur inchangé.

- Suites (2026-10-17, section « Expressions ») : `Séquence` au catalogue
  (paramètre `readable` pour f, un objet que lit une formule), entrée
  `.dgo` `Seq` que l'import GeoGebra produit aussi (`GGB_IMPORT.md`,
  item 38). Vérifié dans `editor.html` avec Playwright sur
  `CerclesDeCercles.ggb` (lignes de `Ctr`, `Rayon`, `LesCtr` et `liste1`
  modifiables, `liste1` redéfinie par sa ligne en segments). Éditeur
  +1,8 Ko (+0,7 Ko en gzip) ; moteur +3,0 Ko (+1,0 Ko en gzip).

- Textes, cadres HTML et images (2026-10-17, section « Langage
  textuel ») : `Texte`, `Html` et `Image` au catalogue (paramètre `text`,
  argument `TextArg`), édition du HTML dans la section « Définition ».
  Mesure (section « Mesure de l'éditabilité ») : figures entièrement
  modifiables de 359 à 530 sur 649 (objets modifiables de 93,4 à
  94,9 %). Vérifié dans `editor.html` avec Playwright (texte à formule et
  saut de ligne, image redéfinie par ses coins, HTML modifié par sa ligne
  et par la section « Définition », script refusé). Éditeur +2,7 Ko
  (+0,9 Ko en gzip) ; moteur et lecteur +0,05 Ko (exports partagés).

- Blocs et tortue (2026-10-17, section du même nom) : `src/editor/blocks/`
  (`program_blocks.ts` pur, `workspace.ts` seul à importer Blockly,
  `view.ts`, `messages.ts`), bascule de la section « Définition », bouton
  « Tortue », manuel (section « Blocs et tortue » d'`expressions.html`,
  capture `tortue.webp`, 12 langues). Vérifié dans `editor.html` avec
  Playwright (tortue créée sur un point, bloc glissé sous le départ et
  appliqué, nombre modifié, annulation par la barre, nouveau programme créé
  par un bloc, figure `partage_dgpad.dgp` ouverte en blocs sans être
  réécrite, arabe de droite à gauche). Éditeur : 159,1 Ko, +2,8 Ko
  (+1,1 Ko en gzip), CSS +0,2 Ko ; lecteur : mêmes octets (366,5 Ko), l'aide
  de préchargement de Vite (1,2 Ko) sortie du moteur dans un fichier à
  part, que Blockly partage ; à la demande : Blockly 748,8 Ko (207 Ko en
  gzip) et ses textes, 80 à 94 Ko (18 à 21 Ko en gzip) par langue.

- Tortue dessinée pendant l'édition de son programme (2026-10-17, section
  « Blocs et tortue »). Vérifié dans `editor.html` avec Playwright (sur A,
  tête à droite ; après « avancer de 100 pixels » et « tourner à gauche de
  90 », 100 pixels plus loin, tête en haut ; A glissé, la tortue le suit ;
  panneau fermé, elle disparaît ; en 3D, la flèche verte inclinée par
  « pivoter vers le haut »). Éditeur +2,0 Ko (+0,7 Ko en gzip) ; moteur
  +80 octets.

- Globales Blockly (2026-10-18) : `Ex` cachées de la figure (`"g"` du
  `.dgo`), partagées par les programmes et les boutons, catégorie
  « Globales » des blocs, manuel (`expressions.html`, `formules.html`, 12
  langues). Une globale nommée par un programme est ajoutée à son
  application, comme les curseurs d'une ligne, jamais pendant la frappe ;
  le choix point / expression n'essaie pas un programme qui change des
  valeurs. Supprimer un programme garde ce qu'il met en forme ou change.
  Vérifié dans `editor.html` avec Playwright (globale créée par une ligne,
  lue par une autre, programme qui l'écrit redéfini).

- Boutons (2026-10-18, section « Blocs et tortue ») : flèche qui lance
  sans sélectionner, libellé qui sélectionne et se glisse, action
  « Programme » de la zone contextuelle, programme d'un bouton dans la
  section « Définition » (entrée `Btn` réécrite, libellé, place et style
  gardés), blocs « fixer … à » et « fraction aléatoire », liste
  « Construction » rafraîchie après un bouton. Vérifié dans `editor.html`
  avec Playwright sur `lancer2desNew.dgp` (flèche d'« Interrompre » :
  `départ = 0`, aucune zone ; libellé : zone et « Programme » ; libellé
  glissé de (60, 120) ; programme réécrit en texte, montré en blocs, lancé,
  annulé). Éditeur +0,95 Ko, Blockly +1 Ko ; lecteur : mêmes octets.

- Création des boutons et des tortues (2026-10-18, sections « Menu des
  outils » et « Blocs et tortue ») : commande `Button`, famille
  « Programmes » du menu (« Tortue », « Bouton »), manuel des 12 langues
  (`menu-outils.html`, `commandes.html`, `expressions.html`). Vérifié dans
  `editor.html` avec Playwright : bouton posé par l'outil (flèche centrée
  sur le toucher), programme ouvert en blocs, écrit en texte, appliqué et
  lancé (`k = 2`), libellé changé par sa ligne, programme et place
  gardés ; tortue d'un point créé dans le vide ; `Bouton("Go")` tapé, au
  centre de la vue. Éditeur +1,4 Ko ; lecteur : −9 octets.

Reste à faire :

- Blocs : un toucher sur un objet de la figure qui
  remplit le menu du bloc sélectionné (le `getName` de DGPad) ; fonctions
  qui renvoient une valeur, listes en blocs.

- Jeux d'outils de l'enseignant (section « Anneau d'outils »).
- Outils du moteur sans commande dans l'éditeur, à ajouter au catalogue
  puis au menu : angle fixe, intersection droite-plan.

- Expressions (section du même nom) : listes en k (`Lst`).
- Points sur objet et intersections au geste sur les lieux et listes ;
  choix explicite de l'intersection quand le geste est ambigu.
- 3D : points libres dans le plan de l'écran des figures DGPad (`f2`) et
  hors du plan z = 0 au geste.
- Lien « modifier cette figure » depuis le lecteur, hors d'une page web
  (`?fit` l'a déjà).
- Réutilisation de `ggb_translate.ts` pour accepter davantage de commandes
  GeoGebra.
- Mesures de fluidité sur des figures de plusieurs milliers d'objets (la vue
  texte est entièrement reconstruite après chaque changement).

### Boutons de programme — 2026-10-18

Le bouton adopte un fond gris clair et un contour fin. Toute sa zone
« ▶ libellé » exécute le programme. À droite, les trois points dans un
cercle ouvrent les outils contextuels ; glisser ce cercle déplace le bouton.
Le lecteur affiche uniquement la zone d'exécution. La décoration des outils
est ajoutée par l'éditeur au montage de la vue et reste hors du lecteur.

### Côtés virtuels des polygones — 2026-10-21

Un clic près d'un côté propose les outils des segments et surligne seulement
ce côté ; l'intérieur continue à désigner le polygone. Les sommets gardent
la priorité. L'éditeur transmet une référence `Côté(p, k)` (`Side` en anglais),
numérotée à partir de 1 dans l'ordre des sommets. Cette écriture s'utilise en
argument, par exemple `Milieu(Côté(p, 2))`, sans créer de ligne de construction.
Les polygones réguliers et les contours des sections sont concernés, les plans
ne le sont pas. Les réglages et la gomme continuent à désigner l'objet entier.
Un côté n'a ni style, ni nom, ni suppression indépendants.

Le moteur conserve seulement les références utilisées comme parties internes
du polygone, hors du collecteur d'objets et sans vue SVG. Ses dépendants ont
le polygone pour parent ; sa suppression les supprime et la redéfinition détecte
les cycles. Le `.dgo` stocke ces références dans les arguments (voir `DGO.md`),
sans ajouter d'objet. Un côté qui disparaît devient indéfini ; son numéro est
conservé et peut redevenir défini. Le milieu et la médiatrice gardent le côté
comme support, pour suivre aussi son extrémité de fermeture si le nombre de
sommets change.

### Intégration de l'éditeur dans DocShare — 2026-10-24

`editor.html?embed` expose `load` et `save` par le protocole `docgeo: 1`
(voir `EMBED.md`). La page hôte conserve les documents et les copies
élèves en `.dgo` complet. L'ouverture réutilise le parcours de l'éditeur
(panneaux et historique réinitialisés), et l'écriture son parcours
`asSaved`, après les opérations d'historique en cours. Le bouton
d'enregistrement et Cmd-S / Ctrl-S demandent à l'hôte d'enregistrer ;
Cmd-Maj-S / Ctrl-Maj-S télécharge toujours une copie locale.
La passerelle vit uniquement dans `src/editor/embed.ts` : le lecteur et
son protocole existant restent indépendants.

### Aperçu et éclairage des sphères — 2026-10-28

L'aperçu reprend le remplissage de l'objet construit, sans ses noms ; le
point provisoire n'affiche plus son nom interne. La sphère atténue son
remplissage plutôt que son groupe SVG, car sa partie derrière le sol est
dessinée par celui-ci. Ajouter ou retirer une sphère rafraîchit le masque
du sol dès la prochaine image : plus de trou laissé par l'aperçu ni de
croissant blanc à la validation, sans attendre une rotation.

Les nouvelles sphères sont remplies à 50 % ; le dégradé comporte un reflet
blanc décentré et des bords plus sombres. Les opacités des figures déjà
enregistrées sont conservées. Vérifié par les tests de création et retrait
(projections parallèle et perspective), d'aperçu et d'annulation dans
l'éditeur intégré, et par le geste de l'anneau suivi d'une rotation dans
`editor.html`. Contrôle du manuel passé dans les 12 langues. Moteur et
lecteur : +199 octets (+55 en gzip) ; éditeur : +119 octets (+51 en gzip).

### Zoom au pincement — 2026-10-28

Le lecteur et l'éditeur distinguent le pincement du pavé tactile (événements
Ctrl-molette) de la molette : sa sensibilité est multipliée par 20, celle de
la molette reste inchangée. Sur écran tactile, écarter ou rapprocher deux
doigts zoome selon le rapport de leurs distances ; les glisser ensemble
déplace la vue, sans la faire tourner en 3D. Le milieu des doigts reste le
centre du geste, dans les coordonnées du SVG, y compris en iframe réduite.
Les limites de zoom et les réglages du repère restent appliqués ; le
verrouillage intégré garde le zoom mais empêche le déplacement à deux doigts.

Le deuxième doigt annule le glisser du premier ; les événements du pincement
sont consommés jusqu'au retrait de tous les doigts, pour ne déplacer aucun
objet ni créer de point au relâchement. Les indications de l'éditeur suivent
la vue. Le manuel décrit les gestes dans les 12 langues.

Vérifié par les tests du moteur (ancrage, sensibilité, objet sous le doigt,
verrouillage et doigt restant), par des contacts tactiles envoyés au navigateur
dans l'éditeur intégré (vide et point) et dans le lecteur réduit à moitié.
Suites complètes : 274 tests unitaires et 1 269 tests navigateur passés ;
contrôle du manuel passé dans les 12 langues. Pas d'essai sur appareil iOS
physique. Moteur et lecteur : +1 549 octets (environ +510 en gzip) ; code
propre à l'éditeur : +265 octets (+65 en gzip).

### Palette d'outils — 2026-10-29

Section « Palette d'outils » : `src/editor/palette.ts` et `palette.css`,
câblés dans `main.ts` (`setPalette`, exclusive des propriétés et du panneau
de définition d'une macro). La ligne de survol d'un item est commune au
menu et à la palette (`itemHint`). Zones repliées gardées dans
`localStorage` (`docgeo-palette-folded`). Bouton et entrée du menu
Affichage, textes dans les 12 langues.

Vérifié dans `editor.html` (Playwright) : grisage selon l'anneau ouvert et
selon une sélection multiple, construction préremplie, outil gardé en
passant par les propriétés, Échap, zones 3D et macros, arabe, largeurs de
320 à 1 280 px (barre sans débordement mesurée de 360 à 680 px ; à
320 px, elle débordait déjà de 31 px avant ce changement). Test navigateur
`tests/browser/tool_palette.test.ts`. Suites complètes : 274 tests
unitaires et 1 275 tests navigateur passés. Moteur et lecteur inchangés ;
éditeur : +3 653 octets (+980 en gzip) de code, +3 765 octets de CSS.
Manuel non mis à jour.

Ensuite, même jour : le fantôme de l'outil survolé, et palette ouverte, un
clic sur un objet le choisit sans anneau. Corrigé au passage dans `take` :
la forme d'un item se choisissait sur la sélection déjà vidée, si bien
qu'un segment sélectionné puis « Milieu » (menu ou palette) levait une
exception ; elle se choisit sur les objets pris. Test navigateur étendu
(fantôme, milieu d'un segment, clic sans anneau) ; suites complètes passées.
Éditeur : +524 octets (+141 en gzip) de plus.

Manuel, dans les 12 langues : section « La palette d'outils » de la page
du menu des outils (capture `palette.webp`, décrite dans
`tools/manual/shots.mjs`), et compléments dans l'interface (bouton, menu
Affichage), les gestes (clic sur un objet, palette ouverte), la sélection
multiple (palette, fantôme), les propriétés et les raccourcis (Échap).
Contrôle du manuel passé dans les 12 langues.

2026-10-30 : palette visible au premier lancement, puis ouverture mémorisée
dans `localStorage` (`docgeo-palette-open`). Vérifié dans Chromium après
rechargement et réouverture de la page, stockage autorisé ou refusé ;
24 tests navigateur ciblés et contrôle du manuel dans les 12 langues passés.
Éditeur : +142 octets (+94 en gzip) ; moteur et lecteur identiques.

### Pictogrammes de construction — 2026-10-29

Les 54 outils géométriques utilisent les SVG de
`src/editor/construction_icons.ts` : points bleus cerclés, contours sombres,
résultat mis en rouge et surfaces colorées. Les dessins de 32 unités sont
ramenés au cadre commun de 24 unités ; palette, menu et anneau partagent les
mêmes icônes. Le survol adapte leurs couleurs au fond bleu.

La sphère est classée en tête des solides dans le menu et la palette ; sa
place et sa famille dans l'anneau restent celles des cercles. Le classement
commun des items se fait dans `tools.ts`, sans déplacer les places de
l'anneau.

Par rapport au début de la refonte : éditeur +3 386 octets (+1 815 en gzip),
CSS +107 octets (+16 en gzip) ; moteur et lecteur identiques. Vérifié par
les 46 tests navigateur de l'éditeur et de la palette, par la correspondance
des 54 dessins avec la planche validée, et par la création d'une sphère
depuis la palette.

Manuel : nouvelles icônes, captures de l'anneau, du menu et de la palette
dans les 12 langues, sphère déplacée parmi les solides avec indication de
sa place dans l'anneau. Le fond des icônes est aussi celui de leurs repères
évidés, comme dans l'éditeur. Contrôle du manuel et de ses icônes passé dans
les 12 langues ; aperçus français, arabe et chinois vérifiés en thèmes clair
et sombre.

### Icônes des macros fournies — 2026-10-31

Les 75 macros de la bibliothèque ont leurs dessins SVG dédiés dans
`tools/macros/icons.mjs`, dans le style des outils : points bleus cerclés,
contours sombres, résultats rouges et remplissages légers. Le générateur
les intègre aux bibliothèques des 12 langues, sans code supplémentaire
dans le lecteur ou l'éditeur. Les macros personnelles gardent leur
miniature, leurs lettres ou leur image. Voir `MACROS.md`.

Bibliothèque française : 45 106 → 22 709 octets. JS et CSS du build
identiques ; constructions et styles des macros conservés. Vérifié par
les 111 tests navigateur des macros, de l'éditeur et de la palette, par la
planche des 75 dessins et par leur affichage dans le menu de bibliothèque
puis dans le bandeau de la macro choisie. Icônes, captures et contrôle du
manuel régénérés dans les 12 langues ; aucun contenu du manuel à modifier.

### Ordre des transformations — 2026-10-30

Les transformations prennent d'abord ce qui les définit (centre, droite,
vecteur, cercle), puis le point, comme DGPad et CaRMetal : à l'outil, au
clavier et dans la ligne relue, qui suivent désormais l'ordre des entrées
`Sym`, `Refl`, `Rot`, `Dil`, `Tra`, `Inv` du `.dgo`, inchangé. Les figures
enregistrées ne changent donc pas : seul le catalogue perd sa permutation
(`withReal` aussi). Préalable à l'image d'un objet par une transformation
(un outil qui garde la transformation et prend ensuite des objets). Tests
et sources des bibliothèques de macros réécrits ; bibliothèques
régénérées, identiques. Même règle pour les macros de transformation de la
bibliothèque, l'objet transformé en dernier initial (comme dans CaRMetal) :
`SymétrieH` prend désormais la droite g, puis le point M (seule à changer).
Suites unitaires et navigateur passées.

Manuel mis à jour le même jour, avec l'image d'un objet (ci-dessous).

### Image d'un objet par une transformation — 2026-10-30

Étape 2 de `TRANSFORMATIONS.md` (le moteur à l'étape 1). Le dernier
paramètre de `Symétrie` (centrale et axiale), `Rotation`, `Homothétie` et
`Translation` est `transformable` : un point, une droite (segment,
demi-droite, vecteur), un cercle (arc) ou un polygone, pas un plan.
`Inversion` garde un point (étape 3). Au clavier, `v1 = Symétrie(d, v)` ;
la ligne relue est la même. L'outil du menu ou de la palette, une fois
désignés le centre, l'axe ou le vecteur, les garde et prend un point ou
un objet après l'autre, comme DGPad : un point sous le pointeur, sinon
l'objet transformable sous lui, sinon un point créé là (libre, sur objet
ou à un croisement), image comprise ; l'aperçu au survol montre l'image
de l'objet. L'anneau d'un polygone, d'un cercle… propose les symétries,
l'objet à la place du point. L'image est nommée (`nextName`) et stylée
(`createdStyle`) selon sa nature (`builtTag` de `figure.ts`, d'après
`imageLook` du moteur), et reprend la couleur, le remplissage, la taille,
l'opacité, le pointillé et la décoration de son objet ; pas son nom
affiché, sa visibilité ni ses autres réglages. Message
`designate_transformable` dans les 12 langues. Tests : « maps objects by
transformations, as their objects » (`editor.test.ts`), lignes relues
dans « writes back the line of each command », et « keeps a
transformation, which maps points and objects » (`tool_palette.test.ts`,
l'éditeur intégré piloté au pointeur). Éditeur +0,81 Ko (+0,26 Ko en
gzip) ; moteur +0,10 Ko.

Étape 3 (même jour) : `transformable` prend aussi les coniques, les
courbes de fonctions et les lieux (pas les listes), et `Inversion` le
prend aussi, son entrée marquée quand l'objet passe par le centre
(`straightImage`), la ligne relue sans la marque. `builtTag` en tient
compte (droite ou cercle).

Étape 4 (même jour) : une macro qui envoie un point sur un point
(`mapsPoints`) prend un objet à la place de son dernier point, à l'outil
(aperçu, toucher dans le vide qui crée un point), au clavier
(`a = Milieu(O, p)`, ligne relue, redéfinition) ; l'outil garde ses
autres initiaux après chaque application. La nature de l'image est
trouvée à l'application (`imageVerdict`) et enregistrée.
`designation`, `firstFixed` prennent les macros de la figure (pour
`finalTypes`).

Étape 5 (même jour) : `transformable` prend aussi, en 3D, les plans, les
sphères et les polyèdres ; `invertible` (inversion, dernier initial d'une
macro qui envoie des points) ne les prend pas (`mappedSlot` désigne la
place de l'objet transformé).

Manuel mis à jour dans les 12 langues (même jour) : l'ordre des
transformations, l'image d'un objet (`menu-outils.html#transformer-un-objet`,
`commandes.html`, `3d.html`, `macros.html#image-objet`), les arguments
gardés (`menu-outils.html#arguments-gardes`, `raccourcis.html`), avec
`selection.html`, `faq.html` et `gestes.html` (`TRANSFORMATIONS.md`,
« Avancement »).

### Rayon d’un cercle depuis l’anneau — 2026-10-30

Maintenir l’icône « Cercle (centre et rayon) » appuyée montre un aperçu dont
le rayon suit la souris ou le doigt ; le relâchement crée le cercle en une
seule action annulable. Échap ou l’annulation du pointeur retire l’aperçu.
Le menu et la palette gardent leur rayon initial prédéfini.

Vérifié par 80 tests navigateur ciblés, dont souris et tactile en iframe
réduite, rayon final, annulation et rétablissement. Build et contrôle du
manuel dans les 12 langues passés. Moteur et lecteur : mêmes octets ;
éditeur : +742 octets (+210 en gzip).

### Palette seule, filtres de la liste — 2026-10-30

Décidé avec l'auteur : le menu des outils (bouton à droite de la ligne de
saisie) faisait double emploi avec la palette. Retiré (`openTools`,
`openFamily`, `closeTools`), son conteneur restant celui des macros de
l'anneau (`ringMacrosMenu`). La palette prend son icône (équerre et
crayon ; le marteau et le tournevis disparaissent), la zone
« Programmes » et « Nouvelle macro » en tête de la zone « Macros », qui
existe donc toujours. Sous 500 px, le bouton de la palette passe à droite
de la ligne de saisie. À sa place dans l'en-tête du panneau
« Construction », les filtres (section « Filtres de la liste »).

Tests : `tool_palette.test.ts` (zones, bouton de la ligne caché, filtres
par type, pastilles, Échap, liés à la sélection, retrait à l'ouverture
d'une figure), `macro_editor.test.ts` passé du menu à la palette. Suites
complètes : 274 tests unitaires et 1 297 tests navigateur passés. Moteur et
lecteur : mêmes octets ; éditeur : +2,4 Ko (+0,73 Ko en gzip). Dans
l'en-tête, devenu plus chargé, le titre s'abrège avant le compteur.

Manuel, dans les 12 langues (même jour) : la page du menu des outils
devient « La palette d'outils » (`menu-outils.html`, nom et ancres
gardés : « Ouvrir la palette » `#palette`, « Construire avec un outil »
`#construire`), capture `menu-outils.webp` retirée ; le menu remplacé par
la palette ailleurs (sélection, accueil, macros, programmes, 3D, FAQ,
commandes, propriétés) ; « Filtrer la liste » (`objets.html#filtrer-la-liste`)
et le bouton de l'en-tête (`interface.html`) ; la pastille des points, à
leur forme et à leurs couleurs ; les couleurs de création et le fond blanc
(`proprietes.html#couleurs-de-creation`). `generate.mjs` clique le bouton
visible d'un libellé (celui de la palette existe deux fois).

### Outils « Point » et « Point sur objet » — 2026-10-30

Décidé avec l'auteur : palette ouverte, le clic vide créait un point,
ce qui doublait son sens (lâcher l'objet choisi, sinon créer un point)
et l'icône de l'outil « Point », un point sur une courbe, ne disait pas
qu'il crée aussi des points libres. Section « Palette d'outils », puce
« Points par les outils seuls ». Le « Point » de la palette est ajouté en
tête de la zone après la construction des familles (`tools.ts`, comme la
sphère), hors anneau ; celui de l'anneau prend le libellé `tool_point_on`
(12 langues) et l'icône `PointOn`, sa consigne `designate_support`.

Tests : `tool_palette.test.ts` (clics vides sans effet, « Point sur objet »
puis « Point » : point sur objet, libre, intersection), item ajouté dans
`editor.test.ts` ; `fit.test.ts` ne prend plus le « A » de l'icône pour
l'étiquette du point A ; `editor_embed.test.ts` referme la palette qu'un
autre fichier de tests, lancé en même temps, aurait mémorisée ouverte.
Suites complètes : 274 tests unitaires et 1 300 tests navigateur passés
(un test d'`editor_embed` reste instable sous la charge, son clic simulé
pris pour un appui long, sans lien avec ce changement). Moteur et
lecteur : mêmes octets ; éditeur : +363 octets (+116 en gzip).

Manuel, dans les 12 langues : la palette (`menu-outils.html`) dit que,
sans outil, le clic vide ne crée pas de point, et liste « Point » (sans
badge anneau, `A = (x, y)`) puis « Point sur objet » ; les gestes
(nouvelle ligne « le vide ou un croisement, palette ouverte », icône de
la famille Points), la sélection, les raccourcis (« palette fermée »), la
3D et une question de la FAQ. Icônes et capture `palette.webp`
régénérées, contrôle passé.

### Classeurs — 2026-11-01

Un classeur (`.dgo` à pages, voir `DGO.md` « Classeur ») montre ses pages
par des onglets sous la figure (`src/workbook.ts`, partagé avec le
lecteur). Menu Fichier : « Nouvelle page » ajoute une page vide après les
autres et la montre (la figure devient la page 1 d'un classeur si elle n'en
était pas un) ; « Supprimer la page », après confirmation, supprime la page
montrée et montre sa voisine (une seule page restante redevient une
figure). Un double clic sur un onglet modifie le nom de sa page (Entrée
valide, Échap annule). Une fois le classeur créé, sa barre d'onglets
reprend celle de DocCells (FortuneSheet) : un bouton « + » ajoute une page
après les autres, un bouton liste toutes les pages (page montrée cochée,
couleur de son onglet) pour en montrer une, et chaque onglet a sa flèche
▾. Un clic droit sur un onglet ou sa flèche (qui montrent d'abord sa page)
ouvre le menu de la page (`contextMenu` de `src/editor/menus.ts`) :
Renommer, Dupliquer (copie insérée après elle et montrée, nommée
« … (copie) »), Supprimer la page, Déplacer vers la gauche ou la droite,
et la couleur de l'onglet (8 couleurs ou aucune, clé `c` de la page, voir
`DGO.md`), que le lecteur montre aussi. Un onglet se déplace aussi par
glisser-déposer, les autres s'écartant pour lui faire place. Pas de
masquage de page (décision de l'auteur). Changer d'onglet garde la page quittée telle
quelle, avec son historique d'annulation, retrouvé au retour ; le point
qui signale une modification devant le nom de fichier vaut pour tout le
classeur (pages ajoutées, supprimées ou renommées comprises), et
l'enregistrement l'écrit en entier. Le mode intégré du lecteur ne montre que la page `p`.

#### Références entre pages — 2026-11-01

Une formule lit une expression d'une autre page par `'Page 1'!c` (voir
`DGO.md`, « Références entre pages »). À la saisie (`checkExternals` de
`src/editor/figure.ts`, pour les expressions, formules, programmes et
textes), une page ou un objet inconnu est refusé (« Objet inconnu »),
comme une référence à la page montrée ou à une page qui la lit, directement
ou non (« Référence circulaire », `unreadable` de `src/workbook.ts`). Les
noms de pages restent uniques : une nouvelle page ou une copie est numérotée
au besoin, et renommer une page avec le nom d'une autre est refusé.
Renommer la page montrée ou l'un de ses objets réécrit les références des
autres pages, descriptions et historiques d'annulation compris
(`renameReferences`, `renameExternals` de `src/editor/text.ts`). Supprimer
une page montre sa voisine sans elle : ses références à la page supprimée
deviennent indéfinies.

#### Ouvrir dans un nouvel onglet — 2026-11-01

Menu Fichier, « Ouvrir dans un nouvel onglet… » (`openInTabs` de
`src/editor/main.ts`) : un ou plusieurs fichiers (`.dgo`, `.dgp`, `.ggb`)
deviennent des pages insérées après la page montrée, chaque fichier montré
à son tour, le dernier le restant (un `.dgp` ou un `.ggb` n'a de
description qu'une fois ouvert). Une figure devient une page nommée d'après
son fichier (sans extension), un classeur y met toutes ses pages, sous leurs
noms, sa page montrée l'étant ; un nom déjà pris est numéroté, et les
références entre pages insérées suivent ce renommage (`renamedJson`). Une
figure seule devient d'abord la page 1 d'un classeur, comme pour « Nouvelle
page ». Le classeur garde son fichier d'enregistrement : le handle du
fichier ouvert n'est pas repris. Les globales Blockly suivent la règle du
classeur : la page quittée donne ses valeurs aux autres. Un fichier
illisible arrête l'insertion, ses pages retirées (« Impossible d'ouvrir
cette figure »).

« Enregistrer la page sous… » (classeur seulement) écrit la page montrée
seule dans un `.dgo` (`saveOther`), sans changer le fichier du classeur.

Glisser-déposer (`dropFigures` de `src/drop.ts`, qui donne tous les
fichiers de figure déposés et rend son voile) : l'endroit du dépôt décide.
Sur la figure, les fichiers la remplacent, plusieurs formant un classeur de
leurs pages, qu'un enregistrement n'écrit dans aucun d'eux. Le voile de
l'éditeur s'arrête au-dessus des onglets et porte en bas un bandeau
« Ouvrir dans un nouvel onglet » (pages insérées après la page montrée).
Déposés sur les onglets, les fichiers sont ouverts dans de nouveaux
onglets à l'endroit du dépôt, les onglets suivants s'écartant pour leur
faire place (`dropOnTabs`). Le lecteur ne garde que le remplacement par le
premier fichier. Une figure déposée n'est jamais fusionnée dans la page
montrée (objets homonymes, repères, 2D/3D, styles, macros : les pages
restent des figures indépendantes, voir `DGO.md`).

Remplacer une figure modifiée et non enregistrée (« Nouvelle figure »,
« Ouvrir… », dépôt sur la figure) demande confirmation (`discarded`).
