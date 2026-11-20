# Feuilles DocCells dans DocGeo — mémo de chantier

Ouvert le 2026-11-19. Une page de DocGeo peut montrer un classeur du tableur
DocCells (`/Users/erichake/Desktop/BV/html/doccells_MAIN`), à côté de la
figure ou seul dans son onglet. Les deux se lisent l'un l'autre en direct :
une formule de la figure lit des cellules (`Feuille1!B3`), une cellule lit
un objet de la figure (`=GEO("AB")`).

## Mode d'emploi de ce mémo

Une session qui reçoit « lis TABLEUR.md et fais ce qu'il dit » :

1. lit ce mémo en entier, puis `AGENTS.md`, `VUES.md`, `DGO.md` (« Classeur »,
   « Vue `v` », « Règles d'évolution ») et, dans DocCells, `EMBED.md` et
   `WORKBOOK_FORMAT.md` ;
2. fait la **première étape non cochée** de la section « Étapes », et elle
   seule ;
3. à la fin de l'étape : tests (`npm run test`), build (`npm run build`),
   poids du lecteur avant / après, puis met à jour « Point de reprise » et
   coche l'étape ;
4. présente ce qui a été fait et les mesures, et s'arrête. **Pas de commit
   sans demande explicite.** Pas de modification du manuel
   (`public/tutorials/`) ni de `npm run manual` : noter seulement ce qu'il
   faudra y couvrir.

Une étape marquée **(DocCells)** ne se fait pas dans DocGeo : la session
s'arrête et dit à l'auteur d'ouvrir une session dans `doccells_MAIN` avec
« lis ../docgeo_MAIN/TABLEUR.md, section Étape N, et fais-la ».

## Ce qui existe déjà dans DocCells

Fait et commité du 2026-11-19 (DocCells `81a9a78` à `9fb91b0`), et construit
dans `doctools_MAIN/public/apps/doccells` :

- **mode intégré** `index.html?embed` (DocCells `EMBED.md`) ;
- **accès synchrone `iframe.contentWindow.docCells`** pour un hôte de même
  origine, que DocGeo utilise (pas le protocole `postMessage`) :
  - `whenReady()`, `load(archive)`, `save()` ;
  - `subscribe(ref)` et `unsubscribe(id)` ;
  - `setCellValues(updates)` et `getValues(ref)` ;
  - `on("values" | "change" | "sheetRenamed" | "sheetDeleted" | "save", f)`.

  `setCellValues` recalcule tout de suite et renvoie les nouvelles valeurs
  des abonnements de ce client, dans la même image ;
- **références DocCells** avec nom de feuille obligatoire (`Feuille1!B3`,
  `'Données 2'!A1:A20`, apostrophe doublée `'L''été'!A1`) ;
- **valeurs** : nombre, texte, booléen, `null` ; une erreur est
  `{ error: "#DIV/0!" }` ; une plage est un tableau de lignes ;
- **format d'archivage** JSON versionné `{ format: "doccells", version, … }`
  (`WORKBOOK_FORMAT.md`), stable dans la durée : c'est ce que DocGeo
  enregistre ;
- **performances mesurées** : 300 formules dépendantes, environ 1,3 ms de
  recalcul par `setCellValues`. Le dessin a lieu à l'image suivante, et
  jamais tant que l'iframe est masquée.

DocGeo n'embarque **jamais** le code de DocCells (5 Mo, React) : il le montre
dans une iframe et l'appelle par `contentWindow.docCells`.

## Décisions de l'auteur (2026-11-19)

1. **Une feuille est une vue.** Elle forme une colonne de la page, au même
   titre qu'une vue graphique (`VUES.md`), et se met à jour en direct pendant
   une manipulation. Une page dont la seule vue est une vue tableur apparaît
   comme un **onglet tableur** du classeur DocGeo : les deux usages, « à
   côté de la figure » et « dans un autre onglet », sont un seul mécanisme.
2. **La figure lit les cellules** avec la syntaxe des références entre
   pages : `Feuille1!B3`, plage `Feuille1!B2:B21`.
3. **Une cellule lit la figure** par une formule DocCells `=GEO("AB")`
   (étape 3, côté DocCells).

## Modèle

- **Un classeur DocCells par page au plus**, montré par **une vue tableur au
  plus** dans cette page. Ils vont ensemble : créer la vue crée le classeur
  (vide), supprimer la vue supprime le classeur.
- **Une seule iframe DocCells par fenêtre DocGeo.**
  - Elle est créée la première fois qu'une page montrée a une vue tableur :
    le code de DocCells n'est chargé que s'il sert.
  - Elle est ensuite réutilisée d'une page à l'autre : montrer une page fait
    `load(archive)`, la quitter (et enregistrer) fait `save()` dans sa
    description.
  - Elle est placée en `position: absolute` sur le rectangle de la colonne
    (`arrangeViews`), jamais déplacée dans le DOM : déplacer une iframe la
    recharge.
  - Sur une page sans vue tableur, elle est masquée (`display: none`), et
    DocCells ne dessine plus rien.
- **Lecteur** : `../doccells/index.html?embed&mode=student`. L'élève peut
  saisir dans les cellules, comme il manipule un champ de saisie ; ces
  saisies n'entrent pas dans l'état élève en v1. **Éditeur** :
  `../doccells/index.html?embed`, DocCells complet.
- **Contrôle de l'origine** : si `contentWindow.docCells` est inaccessible
  (autre origine) ou si DocCells est absent, la vue tableur affiche un
  message, ses références sont indéfinies, et le reste de la figure
  fonctionne.

## Références aux cellules dans les formules de la figure

Syntaxe (`src/import/dgp_formula.ts`, à côté du nœud `external`) :

| Écriture                  | Sens                                               |
| ------------------------- | -------------------------------------------------- |
| `Feuille1!B3`             | cellule B3 de la feuille Feuille1 du classeur de la page |
| `'Données 2'!B3`          | nom de feuille entre apostrophes (`\'` pour une apostrophe, comme pour les pages) |
| `Feuille1!B2:B21`         | plage                                              |
| `'Page 2'!Feuille1!B3`    | cellule du classeur d'une autre page               |

- **Règle de résolution.** `X!Y` est une cellule si `X` est une feuille du
  classeur de la page et si `Y` est une adresse de cellule (lettres puis
  chiffres : `B3`, `AA12`) ; sinon, c'est une référence à une page, comme
  aujourd'hui. Pas de `$` (il n'y a pas de recopie).
- **DocGeo convertit ses références à l'appel de DocCells** : `\'` y devient
  l'apostrophe doublée de DocCells.
- **Valeurs lues par la figure** :
  - un nombre, un texte ou un booléen est gardé tel quel ;
  - une cellule vide ou une erreur donne une valeur **indéfinie** ;
  - une plage d'une ligne ou d'une colonne donne une liste plate ;
  - un rectangle donne une liste de lignes ;
  - une date est un nombre (numéro de série).
- **Abonnements.** DocGeo s'abonne une fois à chaque référence distincte des
  formules de la page montrée (`subscribe`), garde les valeurs reçues, et
  les formules les lisent dans ce cache, de façon synchrone.
- **Changements de valeurs.** Quand des valeurs changent (événement `values`
  d'une saisie de l'utilisateur, ou retour de `setCellValues`), les objets
  qui les lisent sont recalculés et redessinés, comme après une
  manipulation (`objects_collector`).
- **Feuille renommée** (`sheetRenamed`) : l'éditeur réécrit les références
  de la page, comme il le fait quand une page est renommée. Le lecteur ne
  réécrit rien.
- **Feuille supprimée** (`sheetDeleted`) : les références sont gardées et
  deviennent indéfinies.
- **Autre page.** Une page non montrée n'a pas d'iframe active : ses
  cellules sont lues dans les valeurs `v` enregistrées dans son archive,
  c'est-à-dire leur dernier calcul. C'est cohérent avec la règle des pages
  acycliques (`DGO.md`) : la page lue ne peut pas dépendre de celle qui la
  lit.
- **Une seule ligne par objet.** Une référence n'est que du texte de
  formule : aucun objet nouveau, aucune ligne `nom = …`.

## `GEO` : une cellule lit la figure

- **Côté DocCells** (étape 3), DocCells reste générique : il ne connaît que
  des **valeurs fournies par l'hôte**, désignées par un nom.
  - `=GEO("AB")` lit la valeur que l'hôte a fournie sous le nom `AB`.
  - Le nom `GEO` est le même dans toutes les langues de DocCells.
  - L'argument doit être un texte écrit dans la formule ; sinon, `#VALUE!`.
  - Un nom que l'hôte n'a pas fourni, ou une valeur indéfinie, donne
    `#N/A`.
- **Côté DocGeo** (étape 4), le nom est interprété comme dans une formule de
  la figure :
  - `GEO("AB")` est l'objet AB de la page du classeur ;
  - `GEO("'Page 1'!AB")` est l'objet AB d'une autre page, calculé comme les
    références entre pages.

  La valeur fournie est celle qu'une formule de la figure lit en nommant
  l'objet, si c'est un nombre, un texte ou un booléen. Sinon (point, liste),
  elle est indéfinie : l'auteur crée une expression, par exemple `x(A)`.
- **Ajouts à l'accès synchrone de DocCells** (étape 3) :
  - `hostNames()` : les noms lus par les formules `GEO` du classeur, plus un
    événement `hostNamesChanged` quand l'utilisateur en ajoute ou en retire ;
  - `setHostValues([{ name, v }])` : comme `setCellValues`, recalcule
    aussitôt les cellules qui en dépendent (par l'index inverse, qui doit
    connaître ces noms) et renvoie les nouvelles valeurs des abonnements ;
  - `hostDependencies(ref)` : les noms d'hôte dont dépend une cellule ou une
    plage, directement ou non.

  Les mêmes opérations doivent aussi exister dans le protocole
  `postMessage`, qui reste générique.
- **Ordre du calcul (étape 4).**
  - Une référence de cellule `R` dépend des objets nommés par
    `hostDependencies(R)`.
  - Pendant une mise à jour, DocGeo calcule ces objets, envoie leurs
    nouvelles valeurs par `setHostValues` (un seul appel s'il le peut),
    reçoit les cellules recalculées et poursuit avec les objets qui les
    lisent, dans la même image.
- **Cycles.**
  - Un objet lu par `GEO` ne peut pas dépendre d'une cellule qui dépend de
    lui. L'éditeur refuse la formule qui fermerait un cycle, que ce soit
    celle de la figure ou celle de la cellule, en le signalant.
  - Dans un fichier qui en contient un, la référence qui le ferme est
    indéfinie.

## Format `.dgo`

Purement additif (`DGO.md`, « Règles d'évolution »), à décrire dans
`DGO.md` dès l'étape 1 :

- **`wb`**, clé d'une figure (donc aussi d'une page de classeur) : l'archive
  DocCells, recopiée telle que `save()` la donne
  (`{ format: "doccells", version, … }`). DocGeo n'en interprète que les
  noms de feuilles et les valeurs `v` des cellules (lecture depuis une autre
  page, étape 2). Absente : pas de classeur.
- **`t`**, clé d'une vue (`v` ou élément de `vs`) : `"s"` pour une vue
  tableur ; absente, c'est une vue graphique.
  - Une vue tableur n'a que `t` et `cw` ; si c'est `v`, aussi `w` et `h`,
    qui restent requis.
  - Les clés des vues graphiques (`o`, `u`, `3d`…) n'y sont ni écrites ni
    lues.
  - Une page dont `v` est une vue tableur et qui n'a pas de `vs` est un
    onglet tableur.
- **Aucun objet ne peut avoir pour vue (`vw`) une vue tableur.**

## Développement et build

- **Adresse.** DocCells est servi à côté de DocGeo : DocTools livre
  `public/apps/docgeo` et `public/apps/doccells`. DocGeo ouvre donc
  `../doccells/index.html?embed`, en chemin relatif à sa page.
- **Développement.** `vite.config.ts` sert le dossier
  `../doctools_MAIN/public/apps/doccells` sous `/doccells/` (un petit
  middleware du serveur de développement). Il faut faire de même pour les
  tests navigateur si leur configuration ne passe pas par ce serveur.
  - Rien n'est copié dans `public/` ni dans le build de DocGeo.
  - Pour une modification de DocCells : session dans DocCells, puis
    `npm run build:doctools`, puis recharger DocGeo.
  - Ne jamais lancer le serveur de développement de DocCells, ni le servir
    sur un port (règle de son `AGENTS.md`).
- **Diffusion indépendante de DocGeo.** Le dossier `doccells/` doit être
  posé à côté. Sans lui, les vues tableur affichent leur message et le
  reste fonctionne.
- **Poids.** Le moteur et le lecteur augmentent au plus de 8 Ko pour tout le
  chantier (3 Ko prévus d'abord, relevés à 8 Ko par l'auteur le 2026-11-20) (création et suivi de l'iframe, références, abonnements, `GEO`),
  mesuré à chaque étape. Le code propre à l'éditeur (création et
  suppression de vues et de pages tableur) va dans `src/editor/`. DocCells
  ne compte pas dans ce poids : c'est une application à part, chargée
  seulement quand une page montrée a une vue tableur.

## Sécurité

Un `.dgo` peut venir de n'importe où (`?url=`). L'iframe DocCells étant de
même origine, elle a accès à la page DocGeo : une archive malveillante ne
doit rien pouvoir exécuter dans DocCells (texte enrichi, liens
`javascript:`, noms de feuilles, commentaires, validations…). Cette
vérification fait partie de l'étape 3. DocGeo, de son côté, ne passe à
DocCells que l'archive enregistrée, sans rien en interpréter d'autre que ce
qui est dit plus haut.

## Étapes

- [x] **Étape 1 (DocGeo) — vue tableur et page tableur, sans liens.**
  - Middleware de développement. Clés `wb` et `t` lues et écrites, décrites
    dans `DGO.md`.
  - Vue tableur dans le lecteur : iframe unique, placée sur la colonne,
    masquée hors des pages qui en ont une, `load` à l'affichage d'une page,
    `save` en la quittant et à l'enregistrement (Cmd-S dans l'iframe :
    événement `save`, qui déclenche l'enregistrement de DocGeo dans
    l'éditeur).
  - Onglet tableur (page dont la seule vue est tableur).
  - Éditeur, dans les 12 langues de `src/editor/lang/` : « Nouvelle vue
    tableur » (là où est « Nouvelle vue », `view_settings.ts`), « Nouvelle
    page tableur » (là où sont créées les pages), suppression de la vue (et
    du classeur).
  - Iframe absente ou inaccessible : message dans la vue.
  - Tests :
    - aller-retour `.dgo` d'une page à vue tableur, de même que d'une page
      tableur seule, et d'un classeur qui mélange les deux ;
    - test navigateur : ouverture, saisie dans une cellule, changement de
      page et retour (la saisie est gardée), enregistrement puis
      réouverture.

    Figure de test dans `tests/`.
- [x] **Étape 2 (DocGeo) — la figure lit les cellules.**
  - Syntaxe et règle de résolution ci-dessus, abonnements, cache, recalcul
    des objets à chaque changement de valeurs.
  - Feuille renommée ou supprimée.
  - Lecture depuis une autre page par les valeurs de l'archive.
  - Tests :
    - analyseur, dont les cas ambigus `X!Y` (page ou feuille) ;
    - test navigateur : une saisie dans B3 déplace un point dont la
      coordonnée est `Feuille1!B3`, et une plage donne une liste ;
    - mesure du temps entre la saisie dans DocCells et le redessin de la
      figure.
- [x] **Étape 3 (DocCells) — `GEO` et valeurs fournies par l'hôte.**
  - Session ouverte dans `doccells_MAIN`. La fonction `GEO`,
    `hostNames()` / `hostNamesChanged`, `setHostValues` et
    `hostDependencies` comme décrits ci-dessus, dans l'accès synchrone et
    dans le protocole, avec leurs tests ; mise à jour de son `EMBED.md`.
  - La sécurité des archives chargées (section « Sécurité »).
  - Un nombre saisi au clavier rendu comme un nombre, et non comme son
    texte (voir « À faire dans DocCells avant tout »).
  - Puis `npm run build:doctools`. Pas de commit sans demande.
- [x] **Étape 4 (DocGeo) — les cellules lisent la figure.**
  - Valeurs fournies à `GEO`, y compris depuis une autre page. Ordre du
    calcul dans la même image, cycles refusés par l'éditeur et indéfinis
    dans un fichier.
  - Test navigateur : glisser un point change `=GEO("AB")` et une cellule
    qui en dépend, et un objet de la figure qui lit cette cellule suit dans
    la même image.
  - Mesure par image avec 300 formules dépendantes, à vitesse normale et
    avec un processeur ralenti 4 fois.
- [x] **Étape 5 (DocGeo) — finitions.**
  - Mode intégré du lecteur (`EMBED.md`) : la page `p` peut avoir une vue
    tableur.
  - Revue des limites ci-dessous avec l'auteur.
  - Liste de ce que le manuel devra couvrir (sans l'écrire).

## Limites de la v1

- Saisies de l'élève dans les cellules absentes de l'état élève.
- L'annulation de DocGeo ne couvre pas les cellules : DocCells a sa propre
  annulation.
- Une seule vue tableur par page.
- Les cellules d'une page non montrée gardent leurs dernières valeurs
  calculées.

## Point de reprise

État au 2026-11-20 : étapes 1, 2, 4 et 5 faites dans DocGeo, étape 3 faite
dans DocCells (rien n'est commité, ni dans DocGeo ni dans DocCells ; DocCells
construit dans `doctools_MAIN/public/apps/doccells`). Toutes les étapes sont
faites : restent les décisions de l'auteur sur les limites (ci-dessous),
le commit et le manuel.

### Étape 5 : ce qui est fait

- **Mode intégré du lecteur** (décrit dans `EMBED.md`, « Vue tableur », et
  `DGO.md`) : la page `p` montrait déjà sa vue tableur. `save` enregistre les
  cellules saisies ; `reset` et `setState` rendent maintenant les cellules
  de la figure de base (`rebuild` force le rechargement par
  `restoreSheet`), alors qu'avant elles gardaient la saisie, sauf après un
  `save` ; `rebase` prend les cellules courantes (`sheetArchive`). Les
  saisies restent hors de l'état et n'émettent pas `change`.
- **`sync`** : un rechargement demandé pendant un `load` (`setState` envoyé
  par l'hôte juste après `load`, cas courant) ne fait plus apparaître
  « ⚠ DocCells » : l'échec est celui du `load`, plus un `held` vide.
- **Page web** (`?fit`) : l'iframe prend la place du `svg` de la vue
  tableur (`showSheet` recopie `left`, `top`, `width`, `height`), donc sa
  part de la région centrée, et non plus la moitié de la fenêtre ;
  `fit.ts` appelle `showSheet` à chaque placement.
- **Langue** : DocCells est ouvert avec `&lang=` de DocGeo (`LANG`, du
  lecteur comme de l'éditeur).
- **Tests** (`tests/browser/sheet.test.ts`, « a sheet view in the embedded
  player ») : `setState` aussitôt après `load`, saisie, `save` qui la
  contient, `reset` qui rend la cellule de base, `rebase` puis `reset` qui
  garde la saisie, aucun « ⚠ DocCells » ; vue tableur d'un classeur en
  `?fit` placée sur son `svg`. Suite complète : tout passe, sauf
  `fit.test.ts` (« pinches… », pincement par événements tactiles), qui a
  encore échoué une fois sous charge et passe seul (3 fois sur 3).
- **Poids** : moteur 375 055 → 375 132 octets (+77), lecteur `main`
  15 702 → 15 830 (+128), éditeur inchangé. Le chantier compte **+5,8 Ko**
  au moteur (369 321 → 375 132) et +0,2 Ko au lecteur `main`, pour 8 Ko
  prévus.
- **Limites revues avec l'auteur** : présentées le 2026-11-20, décisions à
  reporter ici (« Limites de la v1 »).

### Étape 4 : ce qui est fait

- **Valeurs fournies** (`src/sheet.ts`) : `names` (les noms lus par `GEO`),
  lus par `hostNames()` après chaque `load`, puis à chaque
  `hostNamesChanged`. Un nom est lu par l'analyseur des formules
  (`FormulaLexer`) : un identifiant est un objet de la page, `'Page 1'!k`
  passe par les références entre pages (`readExternal`, exporté par
  `dgp_formula.ts`) ; autre chose, ou une valeur qui n'est ni nombre fini,
  ni texte, ni booléen (point, liste) : `null`. `provide` n'envoie que les
  valeurs changées (`given`, vidé à chaque `load`), en un seul
  `setHostValues`.
- **Ordre du calcul** : `objects_collector.update` appelle `provide` après
  chaque tour de calcul de la géométrie, avec les objets calculés ; les
  cellules renvoyées par `setHostValues` marquent les objets qui les lisent
  (`reread`, maintenant limité aux lecteurs des références changées), que
  le tour suivant calcule, dans la même image. `computeAll` (objet ajouté
  par l'éditeur) fournit aussi sa valeur. Les tours restent limités à 3 par
  image : une chaîne qui passe plus de deux fois de la figure aux cellules
  finit à l'image suivante.
- **Cycles** : à l'abonnement, DocGeo lit `hostDependencies(ref)`, relu pour
  toutes les références à chaque `change` et `hostNamesChanged`
  (`rescan`). Quand un objet lit une référence, `closes` remonte des objets
  nommés par ses noms d'hôte, par leurs parents et par les cellules qu'ils
  lisent : si l'objet est atteint, la référence est indéfinie (`null`) et
  notée dans `cycles` (objet et référence). C'est la lecture qui ferme le
  cycle, dans l'ordre du calcul, qui est coupée.
- **Éditeur** : une ligne qui fait apparaître un cycle nouveau est refusée
  (« Référence circulaire : Feuille1!A1 », `refuseFlaws`, à côté du refus
  hors du plan). Une formule de cellule qui en ferme un est signalée de
  même (`sheetCycle`) et les cellules sont rechargées telles qu'elles
  étaient avant elle (le `wb` de l'étape courante de l'historique,
  `restoreSheet`) : DocCells n'a pas d'opération pour refuser une saisie.
  Le lecteur ne refuse rien : la référence reste indéfinie.
- **Tests** (`tests/browser/sheet.test.ts`, « cells that read the
  figure ») : point déplacé comme par un glisser, `=GEO("d")`, la cellule
  qui en dépend et l'expression qui la lit vérifiées dans la même image
  (`requestAnimationFrame` enregistré après celui de la mise à jour) ;
  texte fourni ; objet d'une autre page ; cycle dans un fichier ; refus
  dans l'éditeur d'une ligne, puis d'une formule de cellule ; 300 formules.
  Les tests atteignent le moteur de la page intégrée par
  `import("/src/construction.ts")` dans sa fenêtre. Commande de test
  `throttle` (CDP `Emulation.setCPUThrottlingRate`) ajoutée à
  `vitest.browser.config.ts`.
- **Mesures** (Chrome headless, A1 `=GEO("d")`, A2 à A300 en chaîne,
  l'expression lue `Feuille1!A300`) : image complète (géométrie,
  `setHostValues`, recalcul des 300 formules, objet qui lit A300)
  **0,7 à 0,8 ms** (médiane de 40) ; **3 ms** avec le processeur ralenti
  4 fois.
- **Poids** : moteur 373 359 → 375 055 octets (**+1,7 Ko**) ; lecteur
  `main` inchangé ; éditeur +0,3 Ko. Le chantier compte maintenant
  **+5,7 Ko** au moteur (369 321 → 375 055), pour 3 Ko prévus : à revoir
  avec l'auteur.
- **Non fait, à voir** : un objet supprimé sans reconstruction de la figure
  garde sa dernière valeur dans DocCells jusqu'au prochain chargement ;
  `?lang=` toujours pas transmis à DocCells (étape 5).

### Étape 3 : ce qui est fait (dans DocCells)

Décrit dans `EMBED.md` de DocCells (section 7, « Valeurs fournies par
l'hôte : `GEO` »), avec ce qui suit pour l'étape 4.

- **`GEO`** (`src/features/recalc/hostValues.js`) : `=GEO("AB")` lit la
  valeur fournie sous le nom `AB`. Argument qui n'est pas un texte écrit
  dans la formule : `#VALUE!` ; nom non fourni, `null` ou nombre non fini :
  `#N/A`. La fonction reçoit ses arguments non évalués (arbre des formules
  de DocCells). Même nom dans toutes les langues. FortuneSheet ne propage
  pas les erreurs : `GEO("AB")+1` vaut `#VALUE!` (et non `#N/A`) tant que
  `AB` n'a pas de valeur.
- **Accès synchrone** (et mêmes requêtes dans le protocole) :
  - `hostNames()` → noms triés ; `hostDependencies(ref)` → noms triés,
    directs et indirects, toutes feuilles ;
  - `setHostValues([{ name, v }])` → `{ recalculated, values }`, comme
    `setCellValues` (un nom inchangé ne recalcule rien ; valeurs refusées si
    ni nombre, ni texte, ni booléen, ni `null`) ;
  - événement `hostNamesChanged` `{ names }` après une action de
    l'utilisateur (formule saisie, effacée…), **pas** après `load` : après
    chaque `load`, DocGeo lit `hostNames()`.
- **`load` efface les valeurs de l'hôte** (elles appartiennent au classeur
  montré) et accepte `load(archive, { hostValues: [{ name, v }] })`, prises
  avant le recalcul. Sans elles, les cellules `GEO` valent `#N/A` jusqu'au
  premier `setHostValues` : pour l'étape 4, faire `load`, `hostNames()`,
  calculer, `setHostValues` dans la même tâche, ou passer `hostValues` si
  DocGeo connaît déjà les noms (archive déjà vue).
- **Cycles** : DocCells n'en voit aucun (il ne connaît que ses formules) ;
  c'est à DocGeo de les refuser (étape 4).
- **Nombre saisi au clavier** : rendu comme un nombre (`cellValues.js`,
  `rawValue` : `ct.t === "n"` et texte numérique) par `getValues`,
  `subscribe` et `values`. Le `v: "3"` reste tel quel dans l'archive
  (DocGeo le convertit déjà).
- **`?lang=fr`** (ou `fr-FR`, `de`…) impose la langue de DocCells
  (`src/utils/langParameter.js`, qui remplace `navigator.language` avant le
  chargement des modules) : DocGeo peut transmettre la sienne.
- **Sécurité des archives** (`WORKBOOK_FORMAT.md` de DocCells, « Archives
  d'origine inconnue ») :
  - FortuneSheet écrivait du contenu de cellule par `innerHTML` sans
    l'échapper : texte commençant par `<span` ou formule (barre de formule
    et éditeur, à la simple sélection), texte enrichi et ses styles,
    commentaires (HTML), textes d'aide des validations, tableau HTML de la
    copie (styles), noms de feuilles dans l'éditeur de formule. Corrigé par
    `scripts/patch-fortune-html-safety.cjs` (postinstall) : échappement, et
    nettoyage par une liste de balises et d'attributs pour les commentaires
    et la copie ;
  - images : seules les URL `data:image/…` sont gardées au chargement ;
  - liens : FortuneSheet préfixe déjà `https://` toute adresse qui n'est pas
    `http(s)` (pas de `javascript:`).
  - Vérifié par une archive piégée (test navigateur) : avec l'ancien build,
    6 vecteurs exécutaient du script (commentaire, texte, texte enrichi,
    aide de validation, copie) ; aucun avec le nouveau.
- **Tests** (DocCells) : `tests/embed.test.mjs` (Node, 14 tests dont 6
  nouveaux), `tests/workbookArchive.test.mjs` (images), tous les tests Node
  passent ; `tests/browser/embedMode.browser.mjs` : **44/44** (13 nouvelles
  vérifications : `?lang=fr`, `GEO` par le protocole et l'accès synchrone,
  `hostNamesChanged` sur une formule saisie au clavier, nombre saisi, archive
  piégée) ; variante sans serveur du skill de tests (recalcul fr-FR et
  en-US) : 8/8. Le smoke test (serveur de développement) n'a pas été lancé :
  le serveur 5174 n'était pas démarré.
- **Mesures** (Chrome headless, 300 formules qui dépendent de `GEO("AB")`) :
  `setHostValues` synchrone **1,1 ms** (médiane, recalcul seul) ;
  `postMessage` d'une autre origine, aller-retour `setCellValues` →
  `values` 5,6 ms (inchangé).
- **Poids de DocCells** (build DocTools, `index-*.js`) : 5 673 382 →
  5 681 953 octets (+8,6 Ko, +2,9 Ko gzip). Le moteur et le lecteur de
  DocGeo ne changent pas à cette étape.

### Étape 2 : ce qui est fait

- **Syntaxe** (`FormulaLexer.external`, `src/import/dgp_formula.ts`) :
  `X!B3`, `X!B2:B21` (la plage collée à sa première cellule ; `k ? F!A1 :
  B2` avec espaces reste une condition, `k?F!A1:B2` serait une plage),
  `'Page 2'!X!B3` (nœud `external` de page `Page 2` et de nom
  `X!B3`). La décision cellule ou page est prise au calcul, pas à
  l'analyse : `readExternals` (`src/workbook.ts`) demande d'abord
  `readCells` (`src/sheet.ts`), puis lit la page comme avant.
- **Figure calculée** : `reading.object`, posé par
  `objects_collector.update` et `construction_object.computeAll`, donne
  l'objet en calcul, donc sa figure (`object.C`), et l'inscrit parmi les
  lecteurs de cellules (`readers`). Sans objet en calcul (vérification
  d'une ligne de l'éditeur), c'est la figure montrée.
- **Valeurs** : si l'iframe tient le classeur de la figure (`holder`),
  abonnement à la première lecture de chaque référence (`subscribe`,
  synchrone), cache par référence, désabonnement de tout à chaque `load` ;
  un nom qui n'est pas une feuille est aussi gardé (sans réessai à chaque
  calcul). Sinon (DocCells pas encore prêt, figure calculée sans être
  montrée, autre page) : valeurs `v` de l'archive (`archiveCells`, qui
  tolère une archive malformée et refuse une plage de plus de 10 000
  cellules). Quand l'iframe prend le classeur, puis à chaque événement
  `values`, les lecteurs sont recalculés (`invalidateGeometry`) : au
  redessin suivant, dans la même image que la saisie.
- **Feuille renommée** (`sheetRenamed`) : l'éditeur réécrit les références
  de la page montrée (`renameSheet` : figure reconstruite, une étape
  d'annulation) et celles des autres pages vers ses cellules ;
  `renamedJson` ne touche plus à `wb` (formules de DocCells). Le lecteur
  ne réécrit rien : l'abonnement de DocCells suit la feuille renommée.
  **Feuille supprimée** : DocCells envoie `values: null`, la référence
  devient indéfinie (chemin de code seulement, pas vérifié par
  l'interface).
- **Éditeur** : `unreadable` accepte une cellule ; `externalSource` écrit
  une plage et la feuille d'une autre page sans les mettre entre
  accents graves. Comme les références entre pages, les références aux
  cellules ne viennent pas de Blockly et n'ont pas de bloc.
- **Tests** : `tests/unit/dgp_formula.test.ts` (« references to cells »,
  cas ambigus) ; `tests/browser/sheet.test.ts` : lecture dans l'archive
  (sa page, une autre, plage en liste, rectangle en lignes, erreur,
  entrée nulle, nom qui n'est pas une feuille refusé par l'éditeur) ;
  lecteur intégré : saisie dans DocCells (`setCellValues` par le protocole,
  posté depuis la fenêtre de DocGeo) suivie par une expression et une
  liste.
- **Vérifié à la main** (Playwright, éditeur réel) : formule saisie au
  clavier dans B2 (`=4`) → le point `B = (Feuille1!B2, 1)` se déplace ;
  **6 à 16 ms** entre la touche Entrée dans DocCells et le changement du
  `svg` (une image) ; feuille renommée dans DocCells → lignes réécrites
  (`m = 2*Data!B2`).
- **Poids** : moteur 371 258 → 373 341 octets (**+2,1 Ko** ; +4,0 Ko pour
  le chantier, au-delà des 3 Ko prévus), lecteur `main` inchangé, éditeur
  +0,4 Ko.

### Étape 1 : ce qui est fait

- **Format** (`src/dgo.ts`, décrit dans `DGO.md`) : `t: "s"` d'une vue,
  `wb` de la figure. Lecture : une vue tableur au plus, `wb` requise avec
  elle (ignorée sans elle), grille de la vue réglée par défaut (plane) ;
  `vw` ou `vws` qui nomme la vue tableur : fichier invalide ; un objet
  sans `vw` va dans la première vue graphique (`c.view`, `c.active`).
- **Moteur** : `FigureView.sheet`, `construction.workbook` (archive lue,
  remplacée par chaque `save()`), `src/sheet.ts` (iframe unique, insérée
  en tête du `body` pour passer sous les vues et les panneaux, placée par
  `arrangeViews` sur la colonne, masquée par `dispose`). Seule une
  figure **révélée** (`reveal`) montre l'iframe : les pages calculées sans
  être montrées (`workbook.ts`) n'y touchent pas. Le `svg` de la vue
  tableur reste en place, `visibility: hidden` (sa taille sert à
  `windowSize` quand c'est la première vue).
- **Chargement** : `load` seulement si l'archive diffère (texte JSON) de
  celle que l'iframe tient (`held`, mise à jour par chaque `load` et
  `save`) ; une figure reconstruite depuis la description de la
  précédente (annulation, renommage, vue ajoutée…) garde donc le classeur
  tel quel, sans recharger. `describeDgo` écrit `wb` par `save()` quand
  l'iframe tient le classeur de la figure (`holder`), sinon l'archive lue
  (chargement en cours, archive refusée). Archive refusée par DocCells
  (malformée, version future) : message, et l'archive est gardée telle
  quelle à l'enregistrement.
- **Message** : « ⚠ DocCells », sans traduction (c'est un nom ; 12
  traductions coûtaient 0,75 Ko au moteur), si `contentWindow.docCells`
  est inaccessible, si DocCells n'a pas émis `ready` 10 s après le
  chargement de l'iframe, ou si l'archive est refusée.
- **Événements** : `save` (Cmd-S dans l'iframe) → `dgpad.saveFigure`
  (lecteur : comme son Cmd-S ; éditeur : `save()`, qui passe par l'hôte en
  mode intégré) ; `change` → `dgpad.sheetChanged` (éditeur seulement).
- **Éditeur** (`src/editor/main.ts`, 12 langues) : Fichier > Nouvel
  onglet tableur (« Tableur n ») ; Fichier > Vue > Nouvelle vue tableur
  (une seule par page), Supprimer la vue tableur. Le classeur créé a une
  feuille vide, nommée dans la langue de l'éditeur (`sheet_name`).
  « Supprimer la vue » ne vise qu'une vue graphique et laisse au moins une
  vue graphique ; ses objets vont dans la vue graphique la plus proche.
  La vue active n'est jamais la vue tableur (sauf onglet tableur).
- **Annulation** : les cellules n'en font pas partie. Chaque `change`
  remplace le `wb` de l'étape courante de l'historique (pas de nouvelle
  étape) et marque la figure modifiée ; `reframe` d'une étape reprend le
  `wb` courant si l'étape et la figure ont toutes deux une vue tableur.
  Annuler la suppression de la vue tableur rend le classeur tel qu'il
  était à la suppression.
- **Développement** : `doccells.config.ts` (middleware `/doccells/`),
  branché dans `vite.config.ts` et `vitest.browser.config.ts`
  (`allowImportingTsExtensions` dans `tsconfig.json`, pour l'importer
  avec son extension, comme le veut le chargeur de Vite).
- **Tests** : `tests/browser/sheet.test.ts` (aller-retour d'une page à vue
  tableur, d'un onglet tableur, du classeur mixte `tests/dgo/tableur.dgo`,
  fichiers refusés ; éditeur intégré : saisie, changement d'onglet et
  retour, enregistrement, réouverture). Vérifié aussi à la main
  (Playwright) : saisie au clavier, figure marquée modifiée, Cmd-S dans
  DocCells, annuler / refaire la création et la suppression de la vue,
  séparation déplacée sans perte de saisie.
- **Poids** : moteur 369 321 → 371 258 octets (**+1,9 Ko**, +0,6 Ko
  gzip), lecteur `main` +30 octets, éditeur +1,1 Ko. Il reste 1,1 Ko du
  budget de 3 Ko pour les étapes 2 et 4 : sans doute trop peu, à revoir
  avec l'auteur.

### Remarques pour la suite

- `?lang=` transmis à DocCells (étape 5).
- Le lecteur ouvre DocCells en `mode=student`, qui montre encore ses
  menus Édition, Affichage, Insertion…
- Dans l'éditeur, la palette d'outils ouverte couvre la droite de la vue
  tableur comme celle d'une vue graphique ; dans un onglet tableur, la
  palette et la zone de saisie restent (un objet saisi y est calculé,
  pas dessiné).
- Un nombre saisi au clavier dans une cellule est maintenant rendu comme un
  nombre (étape 3).
- Collage dans DocCells : FortuneSheet lit le HTML du presse-papiers par
  `innerHTML` dans un élément détaché, ce qui charge ses images (et peut
  exécuter un `onerror`) si l'utilisateur colle du HTML copié d'une page
  malveillante. Hors du périmètre « archive chargée » de l'étape 3, non
  corrigé : à voir avec l'auteur.
- Mode page web (`?fit`) : vue tableur placée (étape 5).
- `fit.test.ts` (« pinches a figure scaled to half size… ») a échoué une
  fois dans la suite complète, sous charge, et passe seul et à la
  relance : instable, sans lien avec ce chantier.

### Manuel (à écrire plus tard, rien n'est fait)

- Fichier > Nouvel onglet tableur ; Fichier > Vue > Nouvelle vue tableur,
  Supprimer la vue tableur (`interface.html`, section « Plusieurs
  vues », et le menu Fichier).
- Les cellules ne s'annulent pas avec la figure (annulation propre de
  DocCells) ; Cmd-S dans le tableur enregistre la figure.
- Message « ⚠ DocCells » quand DocCells n'est pas installé à côté.
- La fonction `=GEO("AB")` dans une cellule (nom d'un objet, autre page
  `GEO("'Page 1'!AB")`), `#N/A` tant que l'objet n'a pas de valeur, et
  qu'elle n'existe que dans DocGeo (dans DocCells seul, elle vaut `#N/A`).
  Un point ou une liste ne se lisent pas : passer par une expression
  (`x(A)`).
- Référence circulaire entre la figure et les cellules : la ligne est
  refusée ; une formule de cellule qui en ferme une est annulée, avec le
  même message.
- Les références aux cellules dans les formules de la figure : `Feuille1!B3`,
  plage `Feuille1!B2:B21` (liste, ou liste de lignes), `'Données 2'!B3`,
  autre page `'Page 2'!Feuille1!B3` (dernières valeurs calculées) ; cellule
  vide ou en erreur indéfinie ; renommer une feuille dans DocCells réécrit
  les formules.
- Intégrer dans une page web une figure à vue tableur : le dossier
  `doccells/` doit être publié à côté de DocGeo ; l'élève peut saisir dans
  les cellules, mais ces saisies ne sont pas gardées dans sa réponse.
