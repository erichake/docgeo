# Feuilles DocCells dans DocGeo — mémo de chantier

Ouvert le 2026-11-19. Une page de DocGeo peut montrer un classeur du tableur
DocCells (`/Users/erichake/Desktop/BV/html/doccells_MAIN`), à côté de la
figure ou seul dans son onglet. Les deux se lisent l'un l'autre en direct :
une formule de la figure lit des cellules (`!B3`), une cellule lit
un objet de la figure (`=GEO("AB")`).

## Mode d'emploi de ce mémo

Une session qui reçoit « lis TABLEUR.md et fais ce qu'il dit » :

1. lit ce mémo en entier, puis `AGENTS.md`, `VUES.md`, `DGO.md` (« Classeur »,
   « Vue `v` », « Règles d'évolution ») et, dans DocCells, `EMBED.md` et
   `WORKBOOK_FORMAT.md` ;
2. fait la **première étape non cochée** de la section « Étapes », et elle
   seule ;
3. à la fin de l'étape : tests (`npm run test`), build (`npm run build`),
   poids du lecteur avant / après, puis met à jour « Point de reprise »,
   ajoute son compte rendu à la fin de « Comptes rendus des étapes » et
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
- **valeurs** : nombre, texte, booléen, liste (étape 13), `null` ; une erreur est
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
   pages : `Feuille1!B3`, plage `Feuille1!B2:B21` (remplacé par la décision 11).
3. **Une cellule lit la figure** par une formule DocCells `=GEO("AB")`
   (étape 3, côté DocCells).

Décisions du 2026-11-20, après les étapes 1 à 5 :

4. **Une seule feuille.** DocGeo ne montre que la première feuille du
   classeur, sans barre d'onglets de feuilles : les onglets tableur de
   DocGeo en tiennent lieu. Le mode intégré de DocCells ne doit alors
   offrir aucun moyen d'en créer une autre (rien n'est publié : aucune
   archive à plusieurs feuilles à reprendre).
5. **Les barres de DocCells à la place de celles de DocGeo** (barre de
   menus et barre de boutons), à la même hauteur, quand la vue tableur est
   active (onglet tableur, ou clic dans la vue tableur d'une page mixte),
   et non plus en haut de la colonne. Mécanisme envisagé : DocCells
   dessine ses barres, vivantes, dans des éléments fournis par l'hôte de
   même origine (portail React, dans un shadow root), et non une copie
   par `postMessage`. Sa faisabilité est vérifiée d'abord par un essai
   (étape 6).

Décisions du 2026-11-20, après l'étape 8 :

6. **Un menu DocGeo réduit** quand la vue tableur est active, plutôt que
   des boutons ajoutés, qui surchargeraient l'interface (fait, voir
   « Étape 8 : ce qui est fait »).
7. La palette et les propriétés ouvertes restent ouvertes quand la vue
   tableur devient active.
8. **Menus de DocCells en 13 px**, comme ceux de DocGeo (étape 9).
9. **Un seul voile** : celui de DocGeo a le même fond que celui du
   dialogue de DocCells ouvert (étapes 9 et 10).
10. L'éditeur intégré (`editor.html?embed`), qui n'a pas de barre de
    menus, garde les barres de DocCells dans l'iframe.

Décisions du 2026-11-21 (11 faite, étape 14) :

11. **Plus aucun nom de feuille dans les formules de la figure.**
    `Feuille1` n'apparaît nulle part dans l'interface, et chaque classeur
    n'a qu'une feuille : le nom de feuille reste interne à l'échange avec
    DocCells. Les cellules sont désignées par leur page :

    | Écriture             | Sens                                                |
    | -------------------- | --------------------------------------------------- |
    | `!A1`, `!A1:A200`    | cellules de la vue tableur de la page               |
    | `Tableur2!B3`        | cellules d'un onglet tableur, depuis toute page     |
    | `'Page 1'!!B3`       | cellules de la vue tableur d'une autre page (mixte) |

    - `!A1` est la syntaxe des références entre pages sans nom de page :
      « la page courante ». Pas de forme nue `A1` à la GeoGebra : les
      objets nommés A1, A2… restent permis, et `c ? A1 : A2` reste un test.
    - `'Page 1'!B3` garde son sens (objet B3 de la page 1) ; `'Page 1'!!B3`
      est « page 1 » suivi de `!B3`. Un onglet tableur n'a pas de figure :
      `Tableur2!B3` y est toujours une cellule.
    - **Conflit avec la négation** : `!` collé à une adresse de cellule en
      capitales (sans espace, non suivie d'un nom, d'une parenthèse ou
      d'une apostrophe) désigne des cellules, dans toute page : la négation
      d'un objet A1 s'écrit `!(A1)` ou `! A1`. Règle purement lexicale,
      plus simple qu'une règle propre aux pages à tableur, et sans
      réécriture à l'ajout d'une vue : aucun `!A1` de négation dans les
      figures `.dgp` du corpus ; les blocs écrivent `!(A1)`, l'import
      GeoGebra `! A1`.
    - Remplace `Feuille1!B3` et `'Page 2'!Feuille1!B3`.
    - Nom par défaut des onglets tableur sans espace : `Tableur2`.
    - Aucune compatibilité pour les `Feuille1!B3` déjà écrits (un seul
      fichier, non diffusé, refait par l'auteur).
12. **Insertion à la souris** : pendant une saisie dans la Construction,
    cliquer ou sélectionner dans la vue tableur insère la référence
    (`!A1:A200`).

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

Syntaxe (`src/import/dgp_formula.ts`, à côté du nœud `external`) ; aucun
nom de feuille (décision 11) :

| Écriture             | Nœud `external`        | Sens                                         |
| -------------------- | ---------------------- | -------------------------------------------- |
| `!B3`, `!B2:B21`     | page `""`, `B3`        | cellules de la vue tableur de la page        |
| `Tableur2!B3`        | page `Tableur2`, `B3`  | cellules d'un onglet tableur, de toute page  |
| `'Page 1'!!B3`       | page `Page 1`, `!B3`   | cellules de la vue tableur d'une autre page  |

- **Règle de résolution** (`cellsOf`, `src/workbook.ts`). `X!Y` désigne des
  cellules si `X` est un onglet tableur (page dont la seule vue est la vue
  tableur, sans figure) et `Y` une adresse (lettres puis chiffres : `B3`,
  `AA12`, sans distinction de casse) ; sinon l'objet `Y` de la page `X`.
  Pas de `$` (il n'y a pas de recopie). La page calculée lit ses propres
  cellules en direct, les autres pages dans leur archive.
- **La feuille lue est la première du classeur** (`firstSheet`,
  `src/sheet.ts`), la seule que montre DocGeo ; son nom n'entre que dans
  les références passées à DocCells.
- **DocGeo convertit ses références à l'appel de DocCells** : `\'` y devient
  l'apostrophe doublée de DocCells.
- **Valeurs lues par la figure** :
  - un nombre, un texte, un booléen ou une liste (étape 13) est gardé tel
    quel ;
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
- **Feuille renommée** (`sheetRenamed`) : aucune formule à réécrire ;
  DocGeo se réabonne sous le nouveau nom.
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
  l'objet, si c'est un nombre, un texte, un booléen ou une liste de nombres
  finis et de listes (étape 13 : un point `[x, y]`, un point 3D, une liste
  de points…). Sinon, elle est indéfinie.
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
- [x] **Étape 6 (DocCells) — essai : les barres de DocCells dans la page
  de l'hôte.** Un essai, pas une fonction livrée : il dit si la
  décision 5 est faisable par un portail, et à quel prix.
  - **Ce qui est essayé.**
    - Accès synchrone provisoire `mountChrome({ menus, toolbar })`, qui
      reçoit deux éléments de la page hôte, et `unmountChrome()`, qui rend
      les barres à l'iframe.
    - La barre de menus de DocCells (`StandaloneMenuBar`) et la barre de
      boutons de FortuneSheet y sont dessinées par `createPortal`, dans
      un shadow root, avec les styles de DocCells recopiés.
    - La barre de boutons est dessinée par le `Workbook` de FortuneSheet :
      la sortir demande un correctif `postinstall`, comme
      `scripts/patch-fortune-html-safety.cjs`.
  - **Page hôte d'essai** dans les tests navigateur de DocCells, pilotée
    par Playwright avec `page.route`, comme
    `tests/browser/embedMode.browser.mjs`. Pas de serveur de
    développement, pas de port.
    - Elle ouvre `index.html?embed` dans une iframe et a, en haut, une
      bande de la hauteur des barres de DocGeo.
    - Cette bande contient un faux menu « Fichier » de l'hôte suivi de
      l'élément `menus`, puis l'élément `toolbar` en dessous.
    - Elle a aussi une fausse « figure » (une zone cliquable et un champ
      de saisie) à côté de l'iframe.
  - **À vérifier**, une réponse par point, avec une capture :
    1. apparence identique à celle des barres dans l'iframe (styles,
       icônes, polices) ;
    2. sur une sélection : Gras, couleur du texte et du fond, police,
       format des nombres ; l'état des boutons suit la cellule
       sélectionnée (Gras actif…) ;
    3. Gras **pendant la saisie** d'une cellule : la saisie est-elle
       gardée, la cellule garde-t-elle le focus ? ;
    4. un menu ouvert, puis un clic dans la grille, puis un clic dans la
       « figure » : le menu se ferme-t-il chaque fois ? ;
    5. listes déroulantes et palettes placées sous leur bouton ;
    6. dialogues ouverts depuis les barres (image, validation, mise en
       forme conditionnelle…) : où apparaissent-ils ? ;
    7. raccourcis clavier dans la grille (Cmd-B, Cmd-Z) ;
    8. `unmountChrome` puis `mountChrome` : barres rendues à l'iframe puis
       ressorties, sans perte d'état.
  - **Résultat** : rapport dans ce mémo (« Point de reprise », « Étape
    6 ») : ce qui marche, ce qui casse et comment le réparer, la taille
    du correctif de FortuneSheet, et un verdict (portail, découpe de
    l'iframe en L par `clip-path`, ou abandon). Les étapes suivantes
    sont écrites d'après lui, avec l'auteur.
  - Le code de l'essai n'est ni commité ni construit dans DocTools (pas de
    `npm run build:doctools`) : l'auteur décide de son sort.
- [x] **Étape 7 (DocCells) — les barres dans l'hôte, en vrai, et la
  feuille unique.** Elle part du code de l'essai (étape 6), gardé tel
  quel dans l'arbre de travail de DocCells, et le termine.
  - **Correctif de FortuneSheet** branché dans `postinstall`, à côté de
    `patch-fortune-html-safety.cjs`, et vérifié après une réinstallation
    (`npm ci`).
  - **Hauteurs imposées par l'hôte** : les barres de DocGeo ne bougent
    pas, ce sont celles de DocCells qui s'y logent. `mountChrome` dessine
    chaque barre à la hauteur de l'élément reçu, contenu centré
    verticalement (pour DocGeo : barre de menus 32 px, barre de boutons
    48 px). Rien de propre à DocGeo dans DocCells : c'est la hauteur de
    l'élément qui compte.
  - **« More »** : `ResizeObserver` sur l'élément de la barre de boutons,
    qui recalcule les boutons rangés quand sa largeur change.
  - **Dialogues** : événement `dialog` `{ open: true | false }`, émis à
    l'ouverture et à la fermeture de tout dialogue de DocCells ou de
    FortuneSheet, pour que l'hôte pose son propre voile pendant ce temps.
  - **Styles** : une seule feuille construite dans le document hôte,
    partagée par les deux shadow roots (`adoptedStyleSheets`).
  - **Points non vérifiés par l'essai** : liste près du bord droit de la
    fenêtre hôte, sous-menus « More formats », info-bulles, navigation au
    clavier dans les barres. Réparer ce qui ne va pas.
  - **Feuille unique** : paramètre d'URL du mode intégré (`&sheetTabs=0`
    ou autre nom, au choix de DocCells). Il montre la première feuille,
    masque la barre d'onglets de feuilles et le zoom, et retire tout
    moyen de créer une feuille (menus, import d'un fichier à plusieurs
    feuilles, raccourcis).
  - **`mode=student`** : sans barre de menus ni barre de boutons
    (barre de formule gardée). C'est ce que montre le lecteur de DocGeo,
    qui n'a pas de barres à échanger.
  - `mountChrome`, `unmountChrome`, `dialog` et le paramètre de feuille
    unique décrits dans `EMBED.md` de DocCells, et dans le protocole
    `postMessage` pour ce qui peut y passer (le paramètre et l'événement ;
    `mountChrome` demande l'accès synchrone, donc la même origine).
  - Tests, puis `npm run build:doctools`. Commit sur demande de l'auteur.
- [x] **Étape 8 (DocGeo) — échange des barres.**
  - DocGeo ouvre DocCells avec la feuille unique.
  - **Éditeur seulement** : le lecteur n'a pas de barres. Le code va dans
    `src/editor/`, le moteur ne fait que signaler quelle vue est active.
  - **Vue tableur active** : dans un onglet tableur, toujours ; dans une
    page mixte, dès qu'on clique ou qu'on tape dans les cellules, jusqu'au
    clic dans une vue graphique, dans le panneau Construction ou sur un
    autre onglet. (Aujourd'hui la vue active n'est jamais la vue tableur,
    sauf onglet tableur : à revoir.)
  - **Échange** : quand la vue tableur devient active, la barre de menus
    de DocGeo garde son menu Fichier, suivi des menus de DocCells, et la
    barre de boutons de DocGeo est remplacée par celle de DocCells ;
    l'inverse quand elle cesse de l'être. Les deux barres gardent leur
    hauteur : rien ne bouge en dessous. `mountChrome` une fois, au premier
    besoin, puis on montre ou on cache les éléments. Pas de
    `unmountChrome` à chaque échange (FortuneSheet recrée alors sa barre).
  - L'iframe, qui n'a plus ses barres, a sa grille en haut de la colonne.
  - **Voile** de DocGeo sur toute sa page pendant un dialogue de DocCells.
  - **À proposer à l'auteur pendant l'étape** : ce qui manque de DocGeo
    quand ses autres menus sont cachés, par exemple rouvrir le panneau
    Construction dans un onglet tableur.
  - Tests navigateur : échange des barres au clic dans une page mixte,
    hauteur inchangée de la vue graphique, Gras sur une cellule depuis la
    barre de DocGeo, Fichier > Enregistrer depuis une vue tableur active.
    Poids du moteur et du lecteur mesurés.

- [x] **Étape 9 (DocCells) — taille des menus et fond du voile donnés à
  l'hôte.** Rien de propre à DocGeo : comme pour la hauteur, c'est
  l'élément reçu qui compte.
  - **Taille du texte** : la barre de menus montée par `mountChrome`
    prend la taille de police de l'élément `menus` (calculée, donc
    héritée de la page hôte), pour ses boutons, leurs listes et leurs
    sous-menus. Dans l'iframe, et dans DocCells seul, rien ne change
    (15 px). DocGeo donne 13 px.
    - Aujourd'hui `.dc-menu-root-button` a `font-size: 15px`
      (`StandaloneMenuBar.css`), et `.dc-chrome` reçoit les 16 px du
      document de l'iframe (`copyInherited` de `chromeMount.js`).
  - **Fond du voile** : l'événement `dialog` porte, avec `open: true`, le
    voile du dialogue au premier plan, `veil: { background,
    backdropFilter }` (valeurs CSS calculées de son voile), ou `veil:
    null` s'il n'en a pas (recherche / remplacement). Un nouvel événement
    `dialog` est émis quand le dialogue au premier plan change de voile
    sans que tous soient fermés.
    - Voiles relevés le 2026-11-20 : `rgba(32, 33, 36, 0.38)` pour la
      plupart des dialogues de DocCells, `rgba(31, 35, 41, 0.48)` avec
      `blur(2px)` pour le format des nombres, `rgba(15, 23, 42, …)` pour
      « À propos », blanc à 50 % pour les dialogues de FortuneSheet.
      DocCells peut aussi les unifier : décision qui lui appartient.
  - Décrit dans `EMBED.md` de DocCells (sections 6 et 14) et dans le
    protocole `postMessage` (le voile y passe).
  - Tests, puis `npm run build:doctools`. Commit sur demande de l'auteur.
- [x] **Étape 10 (DocGeo) — le voile et les menus harmonisés.**
  - Le voile de DocGeo prend `veil.background` et `veil.backdropFilter`
    de l'événement `dialog` (transparent si `veil` est `null`).
  - Rien à faire pour la taille : `.dge-sheet-menus` hérite des 13 px de
    `.dge-menubar` ; vérifier les menus de DocCells en 13 px, comme les
    menus de DocGeo et leurs listes.
  - Tests navigateur : couleur du voile égale à celle du voile du
    dialogue de DocCells (« Couleurs alternées », un dialogue de
    FortuneSheet, la recherche), taille du texte des menus de DocCells.
    Poids du moteur et du lecteur mesurés (inchangés : tout est dans
    l'éditeur).

- [x] **Étape 11 (DocCells) — l'apparence des menus donnée par l'hôte.**
  Décision de l'auteur (2026-11-21) : les menus de DocCells sortis dans
  DocGeo doivent avoir l'apparence de ceux de DocGeo (police, hauteur
  des lignes, survol…) ; changer celle de DocCells ne pose pas de
  problème. Comme pour la taille du texte (étape 9), rien de propre à
  DocGeo dans DocCells : la barre de menus montée par `mountChrome`
  prend ce que lui donne l'élément `menus`. Dans l'iframe et dans
  DocCells seul, rien ne change.
  - **Écarts relevés** (`StandaloneMenuBar.css` contre les menus de
    DocGeo, `src/editor/main.ts`, règles `.dge-menubar` et
    `.dge-menu-popup`) :

    | | DocGeo | DocCells sorti |
    | --- | --- | --- |
    | Police | `system-ui, -apple-system, "Segoe UI", sans-serif` | `Inter, Roboto, Arial, Helvetica, sans-serif` (`.dc-chrome`) |
    | Couleur du texte | `#1f2937` | `#202124` |
    | Titre de menu | `padding: 0 10px`, arrondi 6 px, survol `#eef2f7` | `padding: 0 10px`, arrondi 4 px, survol `#eef2f7` |
    | Liste | `padding: 4px`, `min-width: 220px`, bord `#d1d5db`, arrondi 8 px, ombre `0 6px 20px rgb(0 0 0 / 0.14)` | `padding: 8px 0`, `min-width: 288px` |
    | Ligne (`.dc-menu-item`) | `min-height: 32px`, `padding: 6px 12px 6px 4px`, arrondi 5 px | `min-height: 38px`, `padding: 0 12px 0 14px`, arrondi 0 |
    | Survol d'une ligne | fond `#2563eb`, texte blanc | fond `#f1f3f4` |
    | Ligne désactivée | `opacity: 0.4` | couleur `#a6a8ad` |
    | Icônes (`.dc-menu-icon`) | aucune ; 20 px quand il y en a | 22 px |
    | Raccourcis | taille du texte, `opacity: 0.6` | `#9aa0a6` |
    | Séparateur | `margin: 4px 8px`, `#e5e7eb` | — |

  - **Police** : la barre sortie hérite de la famille de police de
    l'élément `menus`, comme de sa taille (`font-family: inherit` au lieu
    d'`Inter…` sur `.dc-chrome` sorti), pour ses titres, listes,
    sous-menus et raccourcis.
  - **Le reste** : des propriétés CSS personnalisées, lues sur l'élément
    `menus` (elles traversent le shadow root), chacune avec la valeur
    actuelle de DocCells par défaut. Par exemple `--dc-menu-color`,
    `--dc-menu-item-height`, `--dc-menu-item-radius`,
    `--dc-menu-item-hover-background`, `--dc-menu-item-hover-color`,
    `--dc-menu-list-padding`, `--dc-menu-list-min-width`,
    `--dc-menu-list-border`, `--dc-menu-list-shadow`,
    `--dc-menu-icon-size`, `--dc-menu-disabled-opacity`. Noms et liste au
    choix de DocCells, à garder courts : ce qui n'a pas d'écart visible
    n'a pas besoin de variable.
  - **Survol bleu** : texte, icônes (`currentColor` ou équivalent),
    chevrons de sous-menus et raccourcis doivent rester lisibles sur le
    fond de survol choisi par l'hôte (blanc sur `#2563eb` pour DocGeo).
  - **Icônes** : gardées, à la taille donnée par l'hôte ; vérifier
    qu'à 32 px de ligne elles ne débordent pas (DocGeo donnera 18 px).
  - Décrit dans `EMBED.md` de DocCells (section 14, à côté de « Taille du
    texte »).
  - Tests : la barre sortie avec et sans variables (valeurs de DocCells
    par défaut), police héritée, hauteur d'une ligne, couleur au survol ;
    l'iframe inchangée. Puis `npm run build:doctools`. Commit sur demande
    de l'auteur.
- [x] **Étape 12 (DocGeo) — les menus de DocCells à l'image de ceux de
  DocGeo.**
  - `.dge-sheet-menus` donne les variables de l'étape 11 avec les valeurs
    de DocGeo (tableau ci-dessus) ; la police est déjà héritée de
    `.dge-menubar`. Si possible, une seule source pour ces valeurs
    (variables CSS de l'éditeur reprises par `.dge-menu-popup` et par
    `.dge-sheet-menus`), pour qu'elles ne divergent plus.
  - Vérifier côte à côte, menus ouverts : Fichier et Format, DocGeo et
    Édition (capture avant / après pour l'auteur) ; titres de la barre
    alignés et de même police.
  - Test (`tests/browser/sheet.test.ts`, celui de l'étape 10) : police,
    hauteur d'une ligne et fond au survol d'un menu de DocCells égaux à
    ceux d'un menu de DocGeo. Poids du moteur et du lecteur inchangés.
  - Capture `tableur.webp` du manuel à refaire
    (`npm run manual -- shots tableur.webp`).

- [x] **Étape 14 (DocGeo) — références sans nom de feuille** (décision
  11) : `!B3`, `Tableur2!B3`, `'Page 1'!!B3` ; onglets tableur nommés
  `Tableur2` (sans espace, 12 langues).
- [x] **Étape 15 (DocCells et DocGeo) — insertion à la souris** (décision
  12). Comme dans Excel quand on écrit une formule : pendant une
  saisie dans la Construction (champ de saisie ou ligne en cours
  d'édition), cliquer une cellule de la vue tableur insère `!B3` au
  curseur, glisser sur une plage insère `!A1:A200`, qui se met à jour
  pendant le glissé.
  - **DocCells** (aucun événement de sélection aujourd'hui) : un mode
    « désignation », ouvert et fermé par l'hôte (`setPicking(on)`, aussi
    dans le protocole et `EMBED.md`). Dans ce mode, un appui ou un glissé
    sur la grille émet `pick` `{ ref, done }` (`done` au relâchement) ;
    la cellule active, la sélection, le focus et le contenu ne changent
    pas, aucun éditeur de cellule ne s'ouvre ; un cadre montre la plage
    désignée. Générique : rien de propre à DocGeo.
  - **DocGeo** : mode ouvert tant qu'une saisie de la Construction a le
    focus et que la page a une vue tableur (`src/sheet.ts` ; éditeur
    seul, jamais le lecteur). `pick` remplace au curseur la référence
    insérée par le même glissé, ou insère la nouvelle ; le focus reste
    dans la saisie ; la vue tableur ne devient pas active (pas de
    bascule des barres). Une sélection d'une seule cellule donne `!B3`.
  - Hors saisie, la vue tableur se comporte comme aujourd'hui.
  - Tests : DocCells (`tests/embed.test.mjs` : `pick` émis, sélection
    inchangée) ; DocGeo (`tests/browser/sheet.test.ts` : glissé réel à la
    souris, texte inséré, focus gardé, barres inchangées). Poids du
    lecteur inchangé.
  - Manuel : page tableur, section « Les cellules lues par la figure ».
  - Demander l'étape depuis DocGeo (« lis TABLEUR.md et fais l'étape
    15 ») : comme les étapes 3, 6, 7, 9, 11 et 13, la session DocGeo
    modifie aussi DocCells et le construit dans
    `doctools_MAIN/public/apps/doccells`.

- [x] **Étape 13 (DocCells et DocGeo) — listes et complexes dans les
  cellules** (décidé avec l'auteur le 2026-11-21).
  - DocCells : une cellule contient une liste, saisie entre crochets avec
    le séparateur de la langue (`[2; 1]`, `[[1; 2]; [3; 4]]`), ou résultat
    d'une formule (`=[2;1]*[3;2]`). Opérateurs au sens de DocGeo
    (`evalBinary` de `dgp_formula.ts`) : complexes sur les listes de deux
    nombres (`[4; 7]`), `+` et `-` terme à terme, multiple d'une liste. Les
    fonctions voient une liste comme une plage (`SOMME`, `INDEX(A1;1)`,
    éléments numérotés à partir de 1). Aussi hors de DocGeo.
  - `GEO` renvoie les points et les listes ; la figure lit une liste dans
    une cellule.

## Limites de la v1

- Saisies de l'élève dans les cellules absentes de l'état élève.
- L'annulation de DocGeo ne couvre pas les cellules : DocCells a sa propre
  annulation.
- Une seule vue tableur par page.
- Les cellules d'une page non montrée gardent leurs dernières valeurs
  calculées.

## Point de reprise

État au 2026-11-21 : étapes 1 à 15 faites et commitées, manuel compris
(listes et points de l'étape 13, références sans nom de feuille de
l'étape 14, capture `tableur.webp` refaite). Étape 15 (insertion à la
souris) faite et commitée, dans DocCells et DocGeo, manuel compris (page
tableur, « Désigner les cellules à la souris »). Restent les décisions de
l'auteur sur les limites de la v1.

## Comptes rendus des étapes

Ce qui a été fait à chaque étape, dans l'ordre des étapes.

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

### Étape 6 : rapport de l'essai (dans DocCells)

**Verdict : le portail marche.** Les huit points passent, après quatre
corrections faites pendant l'essai. Pas besoin de découper l'iframe en L
par `clip-path`. Il reste des choses à régler avant une vraie fonction (voir
« À régler »).

**Code de l'essai** (DocCells, dans l'arbre de travail, ni commité ni
construit dans DocTools ; `node_modules` patché à la main, le script n'est
pas encore dans `postinstall`) :

- `src/features/embed/chromeMount.js` (150 lignes) :
  `docCells.mountChrome({ menus, toolbar })` et `unmountChrome()`. Chaque
  élément reçoit un shadow root ouvert avec une copie des styles de
  DocCells : le texte de toutes ses feuilles, adresses `url()` rendues
  absolues, `body.x` réécrit en `.dc-chrome.x`. Les règles `:root` et `body`
  ne s'appliquent pas dans un shadow root : police, taille, couleur et
  interligne sont recopiés de l'iframe sur l'élément de montage. Il exporte
  aussi `queryChrome`, `queryChromeAll` et `observeChrome`, qui cherchent
  dans les deux barres puis dans le document, et `toggleChromeClass`.
- Correctif de FortuneSheet `scripts/patch-fortune-chrome-portal.cjs`
  (bundle ESM seul, celui que lit Vite ; environ 50 lignes ajoutées au
  bundle, 4 endroits) :
  1. réglage `doccellsToolbarContainer` du `Workbook` : la barre de
     boutons y est dessinée par `createPortal`, avec une copie des symboles
     SVG des icônes (un `<use href="#id">` ne voit que les symboles de son
     propre arbre) ;
  2. `useOutsideClick` (fermeture des listes et palettes) écoute aussi le
     document hôte. Il reconnaît un clic dans le shadow root par
     `composedPath`, car dans le document hôte la cible est l'élément
     porteur ;
  3. bouton Image : le champ de fichier est pris dans le bouton
     (`showImgChooser` le cherchait dans le document de DocCells, et le
     bouton ne faisait plus rien) ;
  4. la liste « More » est dessinée dans l'élément de la barre (elle
     s'ouvrait dans l'iframe, loin de son bouton).
- DocCells (+83/−37 lignes dans 5 fichiers) : `App.jsx` suit l'état des
  barres (`flushSync`, pour que les portails soient démontés avant qu'on
  vide les shadow roots) ; `StandaloneMenuBar` dessine sa barre par
  `createPortal`, et ferme ses menus sur un clic ou Échap dans l'un ou
  l'autre document ; les commandes des menus (`standaloneMenuCommands.js`)
  et les boutons ajoutés par DocCells (`useFortuneToolbarButtons.js`)
  cherchent la barre par `queryChrome` et la regardent par
  `observeChrome`, et les boutons sont remis quand la barre change de
  place.
- Un `mousedown` dans la barre de boutons hôte est annulé (sauf dans un
  champ de saisie) : le focus reste dans l'iframe.
- Test : `tests/browser/chromePortal.browser.mjs` (Playwright, build servi
  par `page.route`, sans serveur ni port). Page hôte avec une bande de
  32 px (faux menu « Fichier » puis l'élément `menus`) et une de 48 px
  (`toolbar`), une fausse figure (zone et champ) à gauche de l'iframe.
  Résultat : **22/22**, captures `SHOTS`.

**Réponses aux huit points :**

1. **Apparence identique** : mêmes tailles, positions, polices, couleurs
   et icônes, élément par élément, pour les deux barres. Sur 1 300 px de
   large, la barre hôte montre 37 éléments sans « More », contre 25 sur les
   1 000 px de l'iframe. **Hauteurs** : barre de menus de DocCells 37 px
   (DocGeo 32), barre de boutons 41 px (DocGeo 48). Quand l'iframe n'a plus
   ses barres, sa grille remonte de 127 à 49 px de son bord.
2. **Sélection** : Gras, couleur du texte, couleur du fond, police (Arial)
   et format (pourcentage) s'appliquent. L'état de Gras suit la cellule
   sélectionnée. Les menus qui passent par la barre (alignement, formats)
   marchent aussi, sans laisser de liste ouverte.
3. **Gras pendant la saisie** : avec la barre hôte, la saisie est gardée et
   la cellule garde le focus (`abc`, Gras, `def` donne `abcdef`). C'est
   mieux que la barre dans l'iframe, où le bouton prend le focus et la
   suite de la saisie est perdue (`abc`). Dans les deux cas, FortuneSheet
   ne met rien en gras pendant une saisie sans sélection de texte.
4. **Fermeture** : un menu ouvert se ferme sur un clic dans la grille, dans
   la figure, dans son champ et sur « Fichier », et sur Échap. Une palette
   se ferme sur un clic dans la grille ou dans la figure, et reste ouverte
   sur un clic dedans. (Corrections 2 et `StandaloneMenuBar`.)
5. **Listes et palettes** : toutes sont placées 2 à 4 px sous leur bouton,
   par-dessus l'iframe et la figure (Format, Police, Taille, couleurs,
   Bordures, Fusion, Alignement, Rotation).
6. **Dialogues** : ceux de DocCells (mise en forme conditionnelle,
   graphique, liste déroulante, bouton Graphique) s'ouvrent dans l'iframe,
   et leur voile ne couvre que l'iframe. « À propos » est dans la barre de
   menus : il couvre toute la page hôte. Le bouton Image ouvre le sélecteur
   de fichier (correction 3).
7. **Raccourcis** dans la grille : Cmd-B puis Cmd-Z marchent, et le bouton
   Gras suit.
8. **`unmountChrome` puis `mountChrome`** : les barres reviennent dans
   l'iframe avec les boutons ajoutés par DocCells, puis ressortent. Le
   classeur, la sélection et l'historique d'annulation sont gardés, et Gras
   marche ensuite. FortuneSheet recrée sa barre (son état local, comme la
   couleur personnalisée, repart de zéro).

**Mesures** : `mountChrome` prend 11 à 25 ms (copie des styles et premier
dessin des deux barres). Il recopie 125 Ko de CSS dans chaque shadow root.
Le bundle de DocCells passe de 5 681 953 à 5 684 505 octets (+2,5 Ko).
DocGeo ne change pas.

**Non-régression** (DocCells) : ESLint propre ; tests Node 85/85 ;
`embedMode.browser.mjs` 44/44 ; variante sans serveur du skill de tests
8/8.

**À régler avant une vraie fonction :**

- **Hauteurs** : DocGeo adopte celles de DocCells (37 et 41 px), ou
  l'hôte impose les siennes (option de `mountChrome`, règles ajoutées au
  shadow root).
- **« More »** : FortuneSheet ne recalcule les boutons rangés dans
  « More » que quand la largeur de sa grille change, pas celle de la bande
  hôte. Il faut un `ResizeObserver` sur l'élément de la barre (correctif),
  sinon une fenêtre redimensionnée laisse la barre déborder ou rester
  rangée.
- **Dialogues** : leur voile ne couvre que l'iframe. Pendant un dialogue,
  les barres et la figure restent cliquables. Il faudrait que DocGeo pose
  un voile, ou que DocCells signale l'ouverture et la fermeture des
  dialogues.
- **Styles** : 2 × 125 Ko copiés. Mieux vaut une seule feuille construite
  dans le document hôte et partagée (`adoptedStyleSheets`). La copie est
  faite au montage : en développement, un rechargement à chaud du CSS ne
  l'atteint pas.
- **Non vérifié** : listes près du bord droit de la fenêtre hôte (le
  `Combo` compare à `window.innerWidth` de l'iframe), sous-menus « More
  formats » (placés d'après le cadre du classeur dans l'iframe), info-bulles
  des boutons, navigation au clavier (Tab) dans les barres, mode
  `mode=student`.
- **Correctif** : il ne patche que le bundle ESM et n'est pas encore dans
  `postinstall`. Une réinstallation l'efface, et sans lui `mountChrome`
  laisse la barre de boutons dans l'iframe.

### Étape 7 : ce qui est fait (dans DocCells)

Décrit dans `EMBED.md` de DocCells : section 1 (`&singleSheet`,
`mode=student`), section 2 (`mountChrome`, `unmountChrome`), section 6
(événement `dialog`), section 14 (« Barres dans la page hôte »).

- **Correctif de FortuneSheet** `scripts/patch-fortune-chrome-portal.cjs`,
  dernier de `postinstall`. Vérifié par un `npm ci` dans une copie du
  dépôt : il s'applique, et les bundles obtenus sont identiques octet pour
  octet à ceux du `node_modules` de travail. Sept modifications du bundle
  ESM (les quatre de l'essai, plus 5 à 7 ci-dessous).
- **Hauteurs imposées par l'hôte** : chaque barre prend la hauteur de
  l'élément reçu, contenu centré (règles du shadow root, rien de propre à
  DocGeo). Vérifié à 32 et 48 px, écart au centre ≤ 1 px.
- **« More »** (correctif 5) : `ResizeObserver` (de la fenêtre de
  l'élément) sur la barre ; le rangement est recalculé à chaque largeur, y
  compris pour des barres montées dans une bande masquée puis montrée
  (cas de l'étape 8 : `mountChrome` une fois, puis montrer / cacher).
  Remarque : à 1 300 px, « More » apparaît (Formule rapide et Filtre y
  vont). L'essai comptait 37 éléments sans « More » parce que FortuneSheet
  mesurait sa barre avant que DocCells y ajoute ses 6 boutons : la barre
  débordait sans qu'on le voie.
- **Dialogues** : événement `dialog` `{ open }` (accès synchrone et
  protocole), `true` au premier dialogue ouvert, `false` quand aucun ne
  l'est plus. Observation du DOM (`src/features/embed/dialogWatch.js`) :
  dialogues de DocCells (`aria-modal`), voile des dialogues et alertes de
  FortuneSheet, recherche / remplacement. Vérifié sur 6 dialogues, dont la
  recherche (Cmd-F) et « À propos » (dans la barre sortie).
- **Styles** : une feuille construite dans le document hôte, adoptée par les
  deux shadow roots (125 Ko de CSS une fois au lieu de deux), refaite à
  chaque `mountChrome` (environ 24 ms, styles et premier dessin compris).
- **Points non vérifiés par l'essai** :
  - listes près du bord droit : `Combo` compare à la largeur de la fenêtre
    qui les montre (correctif 6) ; Format et Bordures placées à 65 px du
    bord : listes dans la fenêtre ;
  - sous-menus (correctif 7) : les styles de bordure sont placés contre le
    bord de la fenêtre hôte. « More formats » de FortuneSheet est masqué
    par DocCells, qui le remplace par sa commande « Format personnalisé »
    (un dialogue) : vérifiée au bord droit ;
  - info-bulles : visibles, juste sous la barre (3 px), au-dessus de
    l'iframe ;
  - clavier : Tab depuis « Fichier » de l'hôte entre dans la barre de
    menus, Entrée ouvre un menu, Tab en parcourt les commandes, Échap
    ferme, Tab continue jusqu'aux boutons. Corrigé : Échap ferme aussi
    « À propos » quand le focus est dans la page hôte. Comme dans
    l'iframe, Entrée sur un bouton de FortuneSheet (des `div`) ne fait
    rien.
- **Feuille unique : `&singleSheet`** (`=0`, `false`, `no`, `off` le
  désactivent). `load` montre la première feuille (ordre des onglets) ;
  barre d'onglets et zoom masqués (`showSheetTabs: false`). Plus aucun
  moyen de créer une feuille : le « + », la liste et le menu contextuel des
  onglets sont dans cette barre ; ni les menus de DocCells, ni le menu
  contextuel de la grille, ni un raccourci n'en créent (vérifié), et le
  mode intégré n'ouvre pas de fichier. Les autres feuilles d'une archive
  restent dans le classeur et dans `save()`, non montrées. Le zoom au
  clavier ou à la molette de FortuneSheet reste possible.
- **`mode=student`** (avec `?embed` seulement ; DocCells seul n'est pas
  changé) : ni barre de menus ni barre de boutons, barre de formule
  gardée, grille en haut (49 px, comme avec les barres sorties) ;
  raccourcis de la grille gardés ; `mountChrome` renvoie `false`.
- **Tests** (DocCells) :
  - `tests/browser/chromePortal.browser.mjs` (le test de l'essai,
    complété) : **33/33** ;
  - `embedMode.browser.mjs` 44/44 ; recalcul sans serveur du skill de
    tests 8/8 ; tests Node 85/85 ; ESLint propre sur le code modifié (la
    seule erreur, `Buffer` dans `vite.config.js`, est antérieure). Un test
    Node (`change` après suppression d'une feuille, attente de 10 ms) a
    échoué pendant qu'un build tournait en parallèle et passe sinon :
    instable sous charge, sans lien.
- **Poids** : bundle principal de DocCells 5 681 953 (avant l'essai) →
  5 686 871 octets (+4,9 Ko, dont +2,5 Ko pour l'essai). DocGeo ne change
  pas.
- **Pour l'étape 8** :
  - URL : `../doccells/index.html?embed&singleSheet` (éditeur) ; le
    lecteur garde `&mode=student`, qui n'a plus de barres, et peut ajouter
    `&singleSheet` ;
  - `mountChrome` une fois, puis montrer / cacher les éléments : la barre
    de boutons se recalcule toute seule quand son élément réapparaît ;
  - les éléments doivent avoir leur hauteur (32 et 48 px) ;
  - `docCells.on("dialog", …)` pour le voile.
- **Manuel** : rien de nouveau côté DocGeo à ce stade (l'échange des barres
  viendra avec l'étape 8).

### Étape 8 : ce qui est fait

- **Feuille unique** : le lecteur et l'éditeur ouvrent
  `../doccells/index.html?embed&singleSheet&lang=…` (le lecteur ajoute
  toujours `&mode=student`).
- **Moteur** (`src/sheet.ts`) : un `pointerdown` ou un `keydown` dans la
  fenêtre de DocCells (écoutés en capture) fait de la vue tableur la vue
  active (`c.active`) de la figure montrée et appelle
  `dgpad.sheetActivated`. `dgpad.sheetReady(cells)` est appelé quand
  DocCells est prêt. Rien d'autre : le lecteur n'a pas de barres.
- **Éditeur** (`src/editor/main.ts`) :
  - `mountChrome` une fois, à `sheetReady` : la grille de l'iframe est
    donc en haut de la colonne dès que DocCells est prêt, que la vue
    tableur soit active ou non. Deux éléments : `.dge-sheet-menus`, dans
    la barre de menus après les menus de DocGeo (32 px), et
    `.dge-sheet-bar`, placé comme `.dge-bar` (48 px). Pas
    d'`unmountChrome`.
  - **Échange** : classe `dge-sheet-on` du `body` quand la vue active est
    la vue tableur (`showSheetBars`, appelé par `showActiveView`, qui
    l'est aussi maintenant à l'ouverture d'une page). Elle cache
    `.dge-bar` et les menus de DocGeo sauf Fichier, et montre les deux
    éléments de DocCells. Rien ne bouge en dessous (vérifié : vue
    graphique au pixel près, barre de DocCells à la place exacte de
    `.dge-bar`).
  - **Sortie** : clic dans une vue graphique (déjà fait par le moteur),
    dans le panneau Construction, ou ligne saisie (`leaveSheet` : la
    première vue graphique devient active), ou autre onglet. Dans un
    onglet tableur, rien n'en sort.
  - **Vue tableur active** : « Supprimer la vue » est désactivé (il aurait
    supprimé la vue tableur) ; Déplacer la vue à gauche / droite déplace
    la colonne tableur ; une ligne saisie va dans la vue graphique.
  - **Clavier** : les flèches de la barre de menus sautent les menus
    cachés (`menus.ts`).
  - **Voile** : à l'événement `dialog`, `dge-sheet-dialog` montre un voile
    transparent sur toute la page (z-index 21) et passe l'iframe
    au-dessus (22). Pas de voile pour « À propos », dessiné dans la barre
    de menus sortie, qui a déjà le sien sur toute la page (reconnu par un
    `[aria-modal="true"]` dans le shadow root des menus).
  - **Mode intégré de l'éditeur** (`editor.html?embed`) : il n'a pas de
    barre de menus ; rien n'est échangé, DocCells garde ses barres dans
    l'iframe, comme avant.
- **Tests** (`tests/browser/sheet.test.ts`, « DocCells' bars in the
  editor's ») : l'éditeur doit être une fenêtre de premier niveau pour
  avoir sa barre de menus, le test l'ouvre donc par `window.open`. Échange
  au `pointerdown` dans DocCells, menus et barres montrés ou cachés,
  hauteur et place inchangées de la vue graphique et de la barre ; Gras
  sur A1 depuis la barre de DocGeo ; Fichier > Enregistrer depuis la vue
  tableur active (`showSaveFilePicker` simulé), le fichier contient le
  Gras ; retour par la vue graphique puis par le panneau Construction ;
  onglet tableur ; dialogue « Couleurs alternées » : voile sur la page,
  iframe au-dessus. Suite complète : tout passe (1 588 tests navigateur,
  284 unitaires) ; à un premier passage, `fit.test.ts` (pincement) et
  `embed.test.ts` (« circle radius… is part of the state », délai
  dépassé) ont échoué sous charge, puis passé seuls et à la relance
  complète.
- **Vérifié aussi à la main** (Playwright, éditeur réel, souris et
  clavier) : saisie au clavier dans une cellule, Gras par la souris,
  « À propos » (pas de voile de DocGeo), clic sur le voile sans effet,
  flèches dans la barre de menus.
- **Poids** : moteur 375 132 → 375 363 octets (**+231**, +77 gzip) ;
  lecteur `main` inchangé (15 830) ; éditeur 327 914 → 329 341 (+1,4 Ko).
  Le chantier compte **+6,0 Ko** au moteur (369 321 → 375 363), pour 8 Ko
  prévus.
- **Propositions faites à l'auteur**, tranchées par les décisions 6 à 10
  (la palette ou les propriétés ouvertes, qui restent ouvertes et
  couvrent la droite de la grille, sont gardées telles quelles).
- **Menu « DocGeo »** (décision 6), ajouté après l'étape :
  - Second menu de la barre, montré seulement quand la vue tableur est
    active, à la place des autres menus de DocGeo : Historique de la
    construction, Palette d'outils, Propriétés (les bascules du menu
    Affichage), puis Manuel d'utilisation.
  - Son nom est « DocGeo » dans toutes les langues : c'est un nom, et
    « Affichage » ferait doublon avec celui de DocCells, juste à côté.
  - Vérifié : dans un onglet tableur, il ferme et rouvre le panneau
    Construction, la grille suit. Test mis à jour (menus montrés et
    cachés) ; suite navigateur complète : 1 588/1 588.
  - Poids : éditeur 329 341 → 329 524 octets (+183) ; moteur et lecteur
    inchangés.

### Étape 9 : ce qui est fait (dans DocCells)

Décrit dans `EMBED.md` de DocCells : section 6 (`veil` de l'événement
`dialog`, exemple de la section 14) et section 14 (« Taille du texte »).

- **Taille du texte des menus** (`chromeMount.js`) : la barre de menus
  sortie ne recopie plus la taille du texte du document de l'iframe ;
  elle hérite de celle de l'élément `menus` à travers le shadow root, et
  ses boutons, listes, sous-menus et raccourcis la prennent
  (`font-size: inherit`, règles propres aux barres sorties). Elle suit
  donc aussi un changement de taille de la page hôte, sans nouveau
  `mountChrome`. Dans l'iframe et dans DocCells seul : 15 px, listes
  14 px, inchangés. Pour DocGeo, `.dge-sheet-menus` hérite des 13 px de
  `.dge-menubar` : rien à faire.
  - Les raccourcis (13 px dans l'iframe) prennent aussi la taille de
    l'hôte, comme les `kbd` de DocGeo.
  - Non changé : hauteur des lignes des listes (38 px, contre 32 px chez
    DocGeo) et icônes de 22 px. À voir avec l'auteur à l'étape 10 si
    l'écart se voit.
- **Voile** (`dialogWatch.js`) : avec `open: true`, l'événement `dialog`
  porte `veil: { background, backdropFilter }` (valeurs calculées), ou
  `veil: null`. Le voile d'un dialogue est l'élément le plus extérieur,
  parmi lui et ses ancêtres, placé (`fixed` ou `absolute`) et qui a un fond
  ou un `backdrop-filter` ; la recherche de FortuneSheet n'en a pas. Le
  premier plan est le voile de plus grand `z-index`. Un nouvel événement
  `{ open: true, veil }` est émis quand ce voile change, dialogues
  ouverts ; `open: false` n'a pas de `veil`. Passe tel quel par le
  protocole `postMessage`.
  - Voiles non unifiés (décision laissée à l'auteur) : `rgba(32, 33, 36,
    0.38)` pour la plupart des dialogues ; format des nombres
    `rgba(31, 35, 41, 0.48)` + `blur(2px)` ; noms définis
    `rgba(15, 23, 42, 0.38)` ; « À propos » `rgba(15, 23, 42, 0.35)` ;
    impression `rgb(238, 241, 244)` **opaque** (aperçu plein écran : le
    voile de DocGeo deviendra opaque aussi) ; FortuneSheet
    `rgba(255, 255, 255, 0.5)`.
  - « À propos » a aussi son `veil` (le sien, déjà sur toute la page
    hôte) : DocGeo, qui ne pose pas de voile pour lui (étape 8), doit
    continuer à l'ignorer pour ne pas le doubler.
- **Tests** (DocCells) : `chromePortal.browser.mjs` **37/37** (4
  nouvelles vérifications : menus sortis en 13 px hérités puis 11 px,
  boutons, listes, sous-menus et raccourcis ; menus rendus à l'iframe en
  15 / 14 px ; `veil` égal au voile dessiné pour « Couleurs alternées »,
  le format des nombres (flou) et « À propos », identique par le
  protocole ; recherche `veil: null`, puis alerte de FortuneSheet
  par-dessus : nouvel événement avec son voile, puis `null`, puis
  fermé). La comparaison « barre de menus identique » se fait avec
  l'élément `menus` à 15 px. `embedMode.browser.mjs` 44/44, tests Node
  85/85, ESLint propre sur les fichiers modifiés.
- **Poids** : bundle principal de DocCells 5 686 871 → 5 687 860 octets
  (+989). DocGeo ne change pas.
- **Pour l'étape 10** : `docCells.on("dialog", ({ open, veil }) => …)`,
  `veil?.background ?? "transparent"`, `veil?.backdropFilter ?? "none"` ;
  mettre à jour le voile à chaque événement `open: true`, pas seulement au
  premier.

### Étape 10 : ce qui est fait

- **Voile** (`mountSheetBars`, `src/editor/main.ts`) : à chaque événement
  `dialog`, le voile de DocGeo prend `veil.background` et
  `veil.backdropFilter` (transparent et sans filtre si `veil` est `null`
  ou absent). « À propos » reste sans voile de DocGeo, comme à l'étape 8.
  Vérifié à la main (Playwright) : « Couleurs alternées »
  `rgba(32, 33, 36, 0.38)`, sur la figure comme sur l'iframe ; format des
  nombres `rgba(31, 35, 41, 0.48)` et `blur(2px)` ; recherche (Cmd-F) :
  voile transparent ; dialogue fermé : voile retiré.
- **Menus** : rien à changer, les menus de DocCells héritent des 13 px de
  la barre de menus. Vérifié : boutons des menus, listes et sous-menus en
  13 px.
- **À voir avec l'auteur** : les lignes des listes de DocCells font
  38 px, celles de DocGeo 32 px, et leurs icônes 22 px ; l'écart se voit
  quand on passe d'un menu à l'autre, sans gêner. À harmoniser dans
  DocCells (hauteur des lignes donnée par l'hôte, comme la taille du
  texte) si l'auteur le souhaite.
- **Tests** (`tests/browser/sheet.test.ts`, même test que l'étape 8) :
  fond du voile égal à celui du voile de « Couleurs alternées » dans
  l'iframe, voile retiré à la fermeture du dialogue, menus de DocCells
  de la même taille que ceux de DocGeo. Suite navigateur complète :
  1 588/1 588.
- **Poids** : moteur et lecteur inchangés ; éditeur 329 524 → 329 637
  octets (+113).
- **Correction signalée par l'auteur** : la barre de menus réunit deux
  systèmes de menus (DocGeo et DocCells), qui s'ignoraient. Un menu de
  DocCells s'ouvrait par-dessus un menu ouvert de DocGeo (le voile des
  menus de DocGeo est sous la barre), et le survol ne passait pas de l'un
  à l'autre.
  - `menuBar` (`src/editor/menus.ts`) reçoit l'élément des menus de
    DocCells (`inner`) : un `pointerover` sur un de ses titres ferme le
    menu ouvert de DocGeo et ouvre celui-là (par un `click` sur son
    bouton) ; un `pointerdown` dans cet élément ferme le menu de DocGeo ;
    le survol d'un titre de DocGeo, un menu de DocCells ouvert, le ferme
    (`click` sur son bouton) et ouvre celui de DocGeo. Le menu ouvert de
    DocCells est reconnu par son `aria-expanded="true"`, l'attribut ARIA
    standard des titres de menus : rien d'autre de DocCells n'est lu.
  - Comme entre deux menus de DocGeo, un clic sur un titre déjà ouvert
    par le survol le referme.
  - Non fait : les flèches du clavier ne passent pas d'une barre à
    l'autre (chacune reste dans ses menus ; Tab passe de l'une à
    l'autre).
  - Vérifié avec la vraie souris (Playwright), page mixte et onglet
    tableur : jamais deux menus ouverts. Test : un menu de DocGeo, survol
    de « Format » de DocCells, survol de « Fichier », fermeture. Suite
    navigateur complète : 1 588/1 588. Éditeur 329 637 → 329 909 octets
    (+272), moteur et lecteur inchangés.

### Étape 11 : ce qui est fait (dans DocCells)

Décrit dans `EMBED.md` de DocCells, section 14 (« Police », « Apparence
des menus », avec le tableau des propriétés et l'exemple des valeurs de
DocGeo).

- **Police** (`chromeMount.js`) : la barre de menus sortie ne recopie plus
  la famille de police du document de l'iframe ; `.dc-menu-bar` sortie a
  `font-family: inherit`. Titres, listes, sous-menus et raccourcis
  prennent celle de l'élément `menus` (pour DocGeo, celle de
  `.dge-menubar`, déjà héritée : rien à faire). La barre de boutons et
  « À propos » gardent Inter.
- **Propriétés `--dc-menu-*`**, lues par `StandaloneMenuBar.css` (les
  mêmes règles dans l'iframe, où personne ne les donne : valeurs de
  DocCells par défaut). Posées sur `.dge-sheet-menus` (ou un ancêtre),
  elles traversent le shadow root. Valeurs à donner pour DocGeo (le
  tableau des écarts ci-dessus, `EMBED.md` en a l'exemple complet) :

  ```css
  --dc-menu-color: #1f2937;
  --dc-menu-title-radius: 6px;
  --dc-menu-list-padding: 4px;
  --dc-menu-list-min-width: 220px;
  --dc-menu-list-border: 1px solid #d1d5db;
  --dc-menu-list-shadow: 0 6px 20px rgb(0 0 0 / 0.14);
  --dc-menu-item-height: 32px;
  --dc-menu-item-padding: 6px 12px 6px 4px;
  --dc-menu-item-radius: 5px;
  --dc-menu-item-hover-background: #2563eb;
  --dc-menu-item-hover-color: #fff;
  --dc-menu-icon-size: 18px;
  --dc-menu-shortcut-opacity: 0.6;
  --dc-menu-divider-margin: 4px 8px;
  ```

  - `--dc-menu-list-padding` est **une seule longueur avec unité** (tout
    autour ; absente : `8px 0`), parce que le sous-menu s'en sert pour
    aligner sa première ligne sur celle qui l'ouvre.
  - `--dc-menu-list-offset` (écart entre le titre et sa liste, `1px`) :
    inutile tant que `.dge-sheet-menus` garde `margin-block: -3px` (les
    listes de DocGeo et de DocCells tombent alors toutes deux à 32 px du
    haut). Si l'étape 12 retire cette marge pour que le survol des titres
    de DocCells ait la hauteur de ceux de DocGeo (25 px au lieu de 31),
    donner `--dc-menu-list-offset: 4px`.
  - `--dc-menu-disabled-opacity` (`0.4`) : déjà la valeur de DocGeo.
- **Survol** : avec `--dc-menu-item-hover-color`, texte, icônes, coche,
  chevrons et raccourcis prennent la couleur donnée (blanc sur
  `#2563eb`). La ligne qui ouvre un sous-menu garde le fond du survol
  tant que la souris est dans le sous-menu (DocGeo la met en
  `#eef2f7`) : écart gardé, pour ne pas ajouter deux variables.
- **Icônes** : à la taille donnée (18 px), colonne de la même largeur ;
  à 32 px de ligne elles restent dans la ligne (vérifié).
- **Changé aussi dans DocCells seul**, sans écart visible (l'auteur
  l'acceptait) : ligne désactivée en `opacity: 0.4` au lieu de la couleur
  `#a6a8ad` (même gris sur blanc), sans fond au survol ; raccourcis et
  chevrons dans la couleur du texte à `opacity: 0.45` au lieu de
  `#9aa0a6` / `#8a8f98`, pour rester lisibles sur un survol foncé.
- **Tests** (DocCells) : `chromePortal.browser.mjs` **41/41** (4
  nouvelles vérifications : police héritée de l'élément `menus` ;
  sans variables, apparence de DocCells ; avec les variables de DocGeo,
  lignes de 32 px, survol bleu, texte, icônes, chevron et raccourcis
  blancs, icônes de 18 px dans la ligne, sous-menu aligné, séparateurs ;
  menus rendus à l'iframe en Inter et inchangés malgré les variables
  posées sur l'élément de l'hôte). Captures `1-menus-default`,
  `1-menus-docgeo`, `8-iframe-menus`. `embedMode.browser.mjs` 44/44,
  tests Node 85/85, ESLint propre.
- **Poids** : bundle principal de DocCells 5 687 733 → 5 687 803 octets
  (+70), CSS 104 055 → 105 831 (+1 776). DocGeo ne change pas.

### Étape 12 : ce qui est fait

- **Une seule source** (`src/editor/main.ts`) : l'apparence des menus de
  DocGeo est donnée par des propriétés aux noms que lit DocCells
  (`--dc-menu-color`, `--dc-menu-title-radius`, `--dc-menu-list-*`,
  `--dc-menu-item-*`, `--dc-menu-shortcut-opacity`,
  `--dc-menu-divider-margin`), posées sur `.dge-menubar` et
  `.dge-menu-popup` (barre, menu contextuel, menu des filtres) et lues par
  leurs règles. La barre de DocCells, dans `.dge-menubar`, en hérite.
  Pas de seconde série `--dge-…` recopiée en `--dc-…` : essayée, elle
  coûtait +1,6 Ko. Posées sur `.dge-menubar` et non sur `body`, elles
  n'atteignent pas la barre de boutons de DocCells (`.dge-sheet-bar`).
- **Propres à DocCells** (`.dge-sheet-menus`) : `--dc-menu-icon-size: 18px`
  et `--dc-menu-list-offset: 4px`. `margin-block: -3px` est remplacé par
  `margin-block-end: -1px` : les titres de DocCells ont la hauteur et la
  position de ceux de DocGeo (25 px à 3 px du haut ; ils faisaient 30 px
  à 0), le bord bas (invisible) de leur barre passant sous eux. Les
  listes des deux tombent à 32 px du haut, alignées sur leur titre.
- **Vérifié** (Playwright, captures avant / après de Fichier, DocGeo,
  Format et Édition, menus ouverts) : même police, lignes de 32 px,
  survol `#2563eb` texte blanc, icônes de 18 px, sous-menu aligné sur sa
  ligne, titres alignés. Restent, voulus : les icônes et les chevrons
  `▶` de DocCells (`›` dans DocGeo), le fond de la ligne dont le
  sous-menu est ouvert (étape 11).
- **Test** (`tests/browser/sheet.test.ts`, celui de l'étape 10) : police,
  hauteur, fond et couleur d'une ligne survolée (vraie souris : commande
  `hover` de `vitest.browser.config.ts`, qui la déplace dans la fenêtre
  ouverte par le test) égaux dans un menu de DocGeo et un de DocCells,
  titres de même hauteur et position. Il échoue sans le changement. La
  barre de DocCells est remontée au passage à l'onglet tableur : ses
  titres sont relus. Suite navigateur complète : 1 588/1 588.
- **Capture** `tableur.webp` refaite dans les 12 langues.
- **Poids** : éditeur 329 909 → 330 903 octets (+994) ; moteur et lecteur
  inchangés.

### Étape 13 : ce qui est fait

- **DocCells** (`src/lib/formula-parser/helper/list.js`, décrit dans
  `WORKBOOK_FORMAT.md` et `EMBED.md`) :
  - `v` d'une cellule peut être une liste (tableau JSON) ; `m` son texte,
    dans la langue ; l'éditeur de la cellule la montre dans la langue
    courante. Apostrophe initiale : un texte.
  - Formules : `[` et `]` hors des textes deviennent un appel de `LIST`
    avant l'analyse ; la formule enregistrée garde ses crochets.
  - Opérateurs `+ - * / ^` et moins unaire : sens de DocGeo, y compris
    les n racines de `^(1/n)` ; division par zéro : `#DIV/0!` ; autre
    cas : `#VALUE!`.
  - FortuneSheet : `scripts/patch-fortune-lists.cjs` (`setCellValue` garde
    la liste, `valueShowEs` pour l'éditeur).
  - Export Excel : une liste, ou une formule à crochets, part en valeur
    (texte de la liste), sans formule.
  - `setHostValues` et `setCellValues` acceptent les listes de nombres
    finis ; liste inchangée : rien n'est recalculé.
  - Tests : `tests/lists.test.mjs`, `tests/embed.test.mjs` (90 au total).
- **DocGeo** (`src/sheet.ts`) : `hostValue` envoie les listes,
  comparées par leur texte JSON ; `scalar` garde une liste lue dans une
  cellule. Test navigateur : `=GEO("A")`, `=A1*A1` relu par la figure en
  glissant `A`.
- **Poids** : moteur 375 363 → 375 482 octets (+119), lecteur `main`
  inchangé.

### Étape 14 : ce qui est fait

- `dgp_formula.ts` : lexème `!` + adresse en capitales (`CELLS`) → nœud
  `external` de page `""` ; `X!!B3` → nom `!B3` ; la forme
  `X!Feuille!B3` n'existe plus. `negation()` écrit `!(A1)`, employé par
  les blocs ; l'import GeoGebra écrit `¬A1` en `! A1`.
- `workbook.ts` : `cellsOf` (voir « Règle de résolution »).
- `sheet.ts` : `readCells(range)` et `archiveCells(workbook, range)` lisent
  la première feuille ; nom de la feuille montrée gardé (`sheet`) au
  chargement et au renommage, qui réabonne.
- Éditeur : `externalSource` écrit les trois formes ; `renameSheet` et
  `sheetRenamed` retirés ; `sheet_page_name` sans espace (« Tableur% »,
  « Hoja% », « Foglio% », « Φύλλο% », « جدول% »…).
- Tests : `dgp_formula.test.ts` (trois formes, négations), `sheet.test.ts`
  (formules réécrites, `Figure!!A1`, `Tableur!B2`).
- Manuel (12 langues) : pages tableur (références, `'Figure 1'!!B3`,
  négation `!(A1)`, listes dans les cellules, `GEO` d'un point), formules
  et démarrage (noms d'onglets) ; capture `tableur.webp` refaite
  (`s = !B4`). Séparateur des listes : `;` dans les langues à virgule
  décimale, `,` ailleurs.

### Étape 15 : ce qui est fait

- **DocCells** (`src/features/embed/cellPicker.js`, décrit dans son
  `EMBED.md`, section 15, et dans les tableaux des sections 2, 5 et 6) :
  - `setPicking(on)` (accès synchrone, requête `setPicking` `{ on }` du
    protocole, `on` booléen) ouvre ou ferme le mode « désignation » ;
    événement `pick` `{ ref, done }` à chaque nouvelle plage désignée,
    `done: true` au relâchement ; `ref` canonique, avec le nom de la
    feuille (`Feuille1!B2:C4`), cellule fusionnée comptée entière, cellule
    la plus proche hors de la grille.
  - Écouteurs posés une fois, en capture sur la fenêtre de l'iframe, avant
    ceux de l'hôte (posés après `ready`) : un appui désignant sur
    `.fortune-cell-area` n'atteint ni FortuneSheet ni l'hôte
    (`stopImmediatePropagation`). Le `pointerdown` n'est **pas** annulé :
    l'annuler supprime le `mousedown` sans empêcher l'iframe de prendre le
    focus ; c'est le `mousedown`, annulé, qui le garde dans le champ de
    l'hôte. `click`, `dblclick`, `contextmenu`, `touchstart` sont arrêtés
    aussi : ni éditeur de cellule, ni menu contextuel.
  - Cellule sous le pointeur comme `handleCellAreaMouseDown` de
    FortuneSheet (`rowLocation`, `colLocation`, volets figés, fusions) ;
    les volets figés, que FortuneSheet garde hors du contexte, sont lus par
    `doccellsFreeze()`, ajouté à l'API du Workbook par
    `scripts/patch-fortune-live-update.cjs` (nouvelle version de son API,
    mise à niveau sur place).
  - Cadre pointillé (`.dc-pick-frame`, bleu de la copie de FortuneSheet)
    dans la grille, gardé après le relâchement jusqu'à la désignation
    suivante ou la fermeture.
  - Tests : `tests/embed.test.mjs` (`setPicking`, `pick` à tous les
    clients) ; `tests/browser/embedMode.browser.mjs`, 6 vérifications à la
    vraie souris (glissé B2 → C4 : `pick` à chaque plage puis `done`, cadre,
    sélection et focus inchangés, double clic sans éditeur, mode fermé : la
    grille sélectionne). Corrigé au passage : « hostDependencies, requête
    invalide » échouait depuis l'étape 13 (`[1, 2]` y est devenu une valeur
    d'hôte valide ; le test envoie `[1, "a"]`). Navigateur 50/50,
    `chromePortal` 41/41, Node 97/97, ESLint propre.
  - `npm run build:doctools` fait. Bundle principal 5 692 963 → 5 695 677
    octets (+2,7 Ko).
- **DocGeo** (`pickCells`, `src/editor/main.ts`, éditeur seul, lecteur et
  moteur inchangés) :
  - `setPicking(!!editing())` à chaque `focusin` / `focusout` : ouvert tant
    qu'un champ de la Construction (ligne de saisie, ligne en cours
    d'édition, définition) a le focus. Sans vue tableur montrée, l'iframe
    est masquée : rien à désigner.
  - `pick` : la référence prise après le dernier `!` (`!B3`,
    `!A1:A200`) remplace au curseur la sélection du champ, puis, pendant
    le même glissé, ce qu'il a inséré (`replaceText`, comme un objet
    désigné) ; complétion mise à jour.
  - La vue tableur ne devient pas active : l'appui désignant n'atteint pas
    l'écouteur `pointerdown` de `src/sheet.ts`. Hors saisie, un appui sur
    les cellules l'active comme avant.
  - Test (`tests/browser/sheet.test.ts`, « cells picked while a line is
    typed ») à la vraie souris (commande `mouse` de
    `vitest.browser.config.ts`) : `s = 2 * !B2 + 1` à l'appui,
    `!B2:C4` puis `!B2:B4` pendant le glissé, cadre montré, focus et
    curseur dans le champ, barres de DocGeo gardées ; un second appui
    insère `!A1` ; hors saisie, l'appui active la vue tableur. La palette
    d'outils ouverte couvrait la grille dans la fenêtre de test : le test
    la ferme. Suite complète : 286 unitaires, 1 590 navigateur.
- **Poids** : moteur 376 182 octets et lecteur `main` 15 857 inchangés ;
  éditeur 330 599 → 330 923 (+324).
- **Manuel** (page tableur, `#souris`, 12 langues, dans « La figure lit
  les cellules ») : pendant la saisie d'une ligne, cliquer une cellule insère
  `!B3` au curseur, glisser insère une plage `!A1:A20` ; la vue tableur
  reste inactive et le focus dans la ligne ; un cadre pointillé montre la
  plage. Hors saisie, un clic dans les cellules les sélectionne comme
  avant.

## Remarques pour la suite

- `?lang=` transmis à DocCells (étape 5).
- Le lecteur ouvre DocCells en `mode=student`, qui ne montre plus ni menus
  ni barre de boutons (étape 7).
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

## Manuel (fait le 2026-11-21)

Page `tableur.html` dans les 12 langues (groupe « Construire », après
les macros), capture `tableur.webp` (`spreadsheet` de
`tools/manual/shots.mjs` : triangle, cellules `GEO`, somme relue par la
figure, vue tableur active). Ajouts dans `interface.html` (menu Fichier,
menu DocGeo, « Plusieurs vues »), `demarrage.html` (classeurs),
`formules.html` (« Lire une cellule du tableur », `#cellules`),
`integration.html`, `index.html`, `formats.html` et `faq.html`. Ce qui
était prévu :


- Les barres de DocCells à la place de celles de DocGeo quand on clique
  dans les cellules (Fichier reste, et le menu DocGeo : Construction,
  palette, propriétés, manuel), retour en cliquant dans la figure ou
  dans le panneau Construction ; onglet tableur ; une seule feuille par
  vue tableur (plusieurs feuilles : plusieurs onglets tableur).

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
