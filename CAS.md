# Calcul formel (Giac) dans DocGeo — mémo de chantier

Ouvert le 2026-11-22. Étapes 0 (essai), M (mise en place), 1 (module
Giac) et 2 (Giac dans DocGeo) faites ; décisions de l'auteur prises le même jour (« Décisions de
l'auteur »).

Objectif : donner à DocGeo ce que Giac donne à GeoGebra, c'est-à-dire des
commandes de calcul formel dans les formules de la figure, une vue CAS
et, plus tard, le raisonnement automatique. Giac est livré comme un
**module complètement séparé**, chargé **seulement quand une figure en a
besoin**.

## Ce que l'auteur fait

1. Trancher les questions nouvelles qu'une étape soulève : dans la
   conversation (la session les reporte ici) ou directement dans ce mémo.
2. Dire « lis CAS.md et fais ce qu'il dit » **dans la session indiquée par
   l'étape en cours** (voir « Où travailler ») ; la session dit à la fin
   de chaque étape où ouvrir la suivante.
3. Demander les commits quand une étape est acceptée.

## Où travailler : le chantier ne touche jamais la production

Le chantier dure plus d'une semaine, pendant laquelle l'auteur continue de
corriger DocGeo pour ses utilisateurs et de déployer
(`zz_DEPLOY_PROD.command`, qui committe `docgeo_MAIN`, le construit dans
`doctools_MAIN/public/apps/docgeo` et le publie). Exception à la règle
« commits sur `master` » d'`AGENTS.md`, décidée par l'auteur :

- **`docgeo_MAIN`** reste sur `master` : corrections, builds et
  déploiements de production. Aucun code du chantier CAS n'y entre avant
  la fin du chantier.
- **`docgeo_CAS`** (`/Users/erichake/Desktop/BV/html/docgeo_CAS`) est un
  second dossier du même dépôt (`git worktree`), sur la branche `cas`.
  Tout le code du chantier s'y écrit et s'y committe, dans une session
  VS Code ouverte sur ce dossier.
  - **Jamais de `npm run build` ni de `zz_*.command` dans `docgeo_CAS`** :
    ils écrivent dans `../doctools_MAIN`, donc en production. Pour mesurer
    le poids : `npx tsc --noEmit && npx vite build --outDir
    ../docgeo_CAS_build` (dossier jetable, hors de DocTools).
  - Le serveur de développement et les tests (`npm run test`) y
    fonctionnent normalement : les chemins relatifs vers `../doctools_MAIN`
    (DocCells, GeoGebra) sont les mêmes.
  - La session y reprend régulièrement les corrections de production :
    `git merge master` dans `docgeo_CAS`.
- **`giac_MAIN`** (`/Users/erichake/Desktop/BV/html/giac_MAIN`) : la copie
  de Giac, son propre dépôt, ses propres sessions (étapes **(Giac)**). Elle
  ne touche pas la production : ses fichiers produits ne sont copiés dans
  `docgeo_CAS` que par une étape DocGeo.
- **À la fin du chantier** (et seulement sur demande de l'auteur) :
  `git merge cas` dans `docgeo_MAIN`, build, tests, puis déploiement par
  l'auteur.

Les mémoires de Claude sont rangées par dossier : celle de `docgeo_CAS`
est un lien vers celle de `docgeo_MAIN`, pour que ses sessions gardent les
préférences de l'auteur.

## Mode d'emploi de ce mémo

Une session qui reçoit « lis CAS.md et fais ce qu'il dit » :

0. vérifie qu'elle est dans le dossier qu'indique l'étape à faire. Sinon,
   elle s'arrête et dit à l'auteur quel dossier ouvrir ;
1. lit ce mémo en entier, puis `AGENTS.md`, `TABLEUR.md` (modèle de
   l'intégration d'un module chargé à la demande : vue, onglet, cache,
   recalcul), `VUES.md` et `DGO.md` (« Règles d'évolution ») ;
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

Chaque étape indique son dossier : **(MAIN)** pour `docgeo_MAIN`,
**(CAS)** pour `docgeo_CAS`, **(Giac)** pour `giac_MAIN`. Une session ouverte
dans `giac_MAIN` lit le mémo dans `../docgeo_CAS/CAS.md` (« lis
../docgeo_CAS/CAS.md et fais ce qu'il dit »). Après la mise en place, le
mémo vit dans `docgeo_CAS` : c'est là qu'il est mis à jour.

## Pourquoi ouvrir ce chantier

La mesure du 2026-11-19 sur le corpus GeoGebra (`GGB_IMPORT.md`) a montré
qu'un seul échec dépend vraiment du calcul formel (`zxmurptj` :
`IFactor`, `CSolve`), et que deux figures ont des cellules CAS. Ce n'est
donc pas un levier de l'import : c'est une **décision de fonctionnalité**
de l'auteur. Ce chantier lève l'exclusion « hors périmètre,
définitivement » de `GGB_IMPORT.md`, et il demande une exception de plus
dans `AGENTS.md` (à rédiger avec l'auteur, sur le modèle de celle de
`TABLEUR.md`).

## Ce qui existe déjà

Dans DocGeo :

- **La dérivation symbolique** des formules DGPad
  (`src/import/dgp_derivative.ts`), simplifiée juste assez pour que les
  dérivées de dérivées ne grossissent pas. L'import GeoGebra traduit
  `Derivative(f)` par cette dérivation et `Integral`, `LowerSum` et
  `UpperSum` par un calcul numérique (`src/import/ggb_translate.ts`). Ces
  traductions restent le repli quand Giac est absent.
- **Le rendu KaTeX** (`src/objects/latex.ts`), qui montrera les résultats
  exacts (fractions, radicaux, matrices).
- **Le modèle de `TABLEUR.md`** pour un module lourd chargé à la demande :
  - une vue (colonne d'une page) ou un onglet, selon le même mécanisme
    (`VUES.md`) ;
  - les formules lisent un **cache de façon synchrone**, et une valeur qui
    change recalcule et redessine les objets qui la lisent, comme après
    une manipulation (`objects_collector`) ;
  - les dernières valeurs sont enregistrées dans le `.dgo` : une page
    s'affiche sans attendre le module ;
  - DocGeo fonctionne si le module est absent : un message dans la vue,
    des valeurs indéfinies, et le reste de la figure fonctionne ;
  - le poids du lecteur a un budget, mesuré à chaque étape.

Dans GeoGebra (version web, `doctools_MAIN/public/apps/geogebra`) :

- Giac y est présent : son WebAssembly est encodé en base64 dans un texte
  Java de `web3d/DC5F3199AE057F65D55CBC49F47E2649.cache.js` (52 Mo), chargé
  à la première commande qui en a besoin (étape 0) ;
- chaque commande est traduite en une chaîne Giac par la table `Ggb2giac`
  (dépôt public `geogebra/geogebra`, paquet `org.geogebra.common.cas.giac`),
  et la réponse de Giac est relue par l'analyseur de GeoGebra ;
- le prouveur (`org.geogebra.common.kernel.prover`) traduit la construction
  en équations polynomiales (méthode de Botana), puis confie l'élimination
  et les bases de Gröbner à Giac. C'est le moteur de `Prove`,
  `ProveDetails`, `LocusEquation`, `Envelope` et de l'outil Relation.

## Giac

- **Auteurs** : Bernard Parisse (Institut Fourier, Grenoble), avec Renée
  De Graeve. C'est le moteur de Xcas.
- **Code** : C++, 301 000 lignes (`src/giac/cpp`), développé depuis le
  début des années 2000. Il dépend de GMP et de MPFR, et en option de
  PARI, NTL et d'autres bibliothèques.
- **Compilations web** (mesurées à l'étape 0) :
  - Bernard Parisse publie la sienne (`giacwasm.js`, Xcas en ligne), qui
    contient aussi ce que demande l'interface d'Xcas (tableur, son,
    MicroPython, appels à `UI`) ;
  - GeoGebra compile la sienne depuis le dépôt public `geogebra/giac`, un
    miroir de Giac avec ses scripts de compilation (Gradle, Emscripten
    4.0.7, GMP 6.3.0 et MPFR 4.2.1 précompilés). Le code de Giac y a un
    mode GeoGebra (`GIAC_GGB`, 66 passages) qui donne les formes de
    réponse de GeoGebra.
- **Poids** : 7,6 Mo de WebAssembly pour GeoGebra (1,9 Mo en brotli),
  14 Mo pour Bernard Parisse (3,4 Mo en brotli).

### Licence

Giac est distribué sous **GPL v3 ou ultérieure** : c'est l'en-tête de ses
sources (« Copyright (C) 2001,14 B. Parisse, Institut Fourier », vérifié à
l'étape 0 ; le miroir `geogebra/giac` n'a pas de fichier `COPYING`, notre
copie devra en avoir un). La GPL autorise explicitement
la modification et la diffusion d'une version modifiée, à condition de :

- la diffuser elle aussi sous GPL ;
- fournir ses **sources complètes et correspondantes**, modifications et
  scripts de compilation compris : un dépôt public de la copie modifiée
  suffit ;
- garder les mentions de droits d'auteur, et signaler clairement les
  modifications, avec leur date.

DocGeo est sous GPL v3 : l'ensemble est cohérent. Les dépendances
(GMP et MPFR en LGPL v3, PARI en GPL v2 ou ultérieure, NTL en LGPL) sont
compatibles. GeoGebra a obtenu de l'Institut Fourier une licence
particulière pour ses applications non libres. Elle ne nous concerne pas,
puisque nous restons sous GPL.

La table `Ggb2giac` est du code source de GeoGebra. Ce code est publié sous
GPL v3, mais certaines parties du dépôt (traductions, ressources) sont sous
d'autres licences, non commerciales : vérifier le `LICENSE` du dépôt avant
d'en reprendre quoi que ce soit, et ne reprendre que du code.

### Intervenir sur Giac

Giac n'appartient pas à l'auteur, comme DocCells, mais on peut y travailler
légalement dans une **copie locale** (un « fork »), comme on travaille dans
DocCells :

- un dépôt séparé, par exemple
  `/Users/erichake/Desktop/BV/html/giac_MAIN`, avec les sources de Giac,
  une chaîne de compilation Emscripten (emsdk) et un script de
  compilation reproductible ;
- ce dépôt est public, ce qui répond à l'obligation de fournir les
  sources ;
- les modifications restent **petites et isolées** (un fichier de
  correctifs lisible), pour pouvoir reprendre chaque nouvelle version de
  Giac ;
- pas de contact avec Bernard Parisse (décision 6) : nos correctifs
  restent dans notre copie, qui reprend les nouvelles versions du miroir
  `geogebra/giac`.

Ce qu'une session peut raisonnablement y faire :

- **réglages de compilation** : niveau d'optimisation, LTO, SIMD
  WebAssembly, et retrait des modules inutiles (graphisme, entrées-sorties,
  interface), pour la vitesse comme pour le poids ;
- **mesures** : profilage des commandes lentes sur des cas réels ;
- **correctifs ciblés** : un bogue précis, une commande dangereuse à
  neutraliser, un point d'entrée simplifié pour le Worker.

Réécrire un algorithme de fond (factorisation, Gröbner, intégration…) est
possible, mais seulement dans ce cadre, le même que celui d'`AGENTS.md`
pour la traduction en JavaScript des programmes Blockly :

- **mesurer d'abord**, sur des calculs réels de DocGeo, où le temps passe
  vraiment. Dans le navigateur, la lenteur vient souvent de la compilation
  plutôt que des algorithmes : GMP sans son assembleur, pas de
  multiplication 64 × 64 → 128 bits en WebAssembly, multi-thread soumis à
  des en-têtes de serveur. Ces pistes passent avant toute réécriture ;
- **réécrire seulement le point chaud mesuré**, une fonction ou un
  algorithme à la fois ;
- **garder Giac d'origine comme référence et comme oracle** : la version
  réécrite est comparée à l'originale sur des milliers d'entrées, tirées
  au hasard et tirées des figures, et doit donner exactement les mêmes
  résultats. Une erreur de calcul formel ne plante pas, elle donne un
  résultat plausible et faux : seule cette comparaison la révèle ;
- **ne la garder que si le gain est mesuré**, et la tenir dans un
  correctif isolé, pour ne pas éloigner notre copie de l'originale.

Les algorithmes de Giac sont à l'état de l'art (ses bases de Gröbner
rivalisent avec Maple et Magma), et chaque écart rend plus difficile la
reprise des nouvelles versions. L'essentiel de la fluidité se gagnera donc
d'abord **du côté de DocGeo** : cache, requêtes regroupées, calculs évités
pendant un glissement (voir « Modèle »).

## Modèle

### Module séparé

- Giac tourne dans un **Web Worker**, jamais sur le fil principal :
  - l'interface ne gèle jamais, même pendant un calcul lourd ;
  - un calcul trop long peut être arrêté (`terminate`) au bout d'un délai.
    Le Worker est alors relancé sans recompiler Giac : le
    `WebAssembly.Module` compilé lui est transmis.
- Le **lecteur** ne contient que le chargeur, le cache et le protocole des
  requêtes (10 Ko au plus, décision 4). Giac et son Worker ne comptent
  pas dans le poids du build.
- Giac est chargé **la première fois qu'une page montrée a besoin d'un
  calcul** dont le résultat n'est pas déjà connu, jamais à l'ouverture
  d'une figure qui n'en emploie pas.

### Résultats asynchrones, lus de façon synchrone

C'est le modèle des cellules de `TABLEUR.md`, appliqué aux calculs :

- une **requête** est un appel Giac construit par DocGeo à partir de
  l'arbre d'une formule, et non du texte de la figure (voir « Sécurité »).
  Son texte, dépendances déjà remplacées par leurs valeurs, est sa clé
  dans le cache ;
- une formule lit le **résultat** dans le cache, de façon synchrone. Ce
  résultat est relu dans le moteur comme une formule (`FormulaNode`) : une
  fonction, un nombre, un point ou une liste, ensuite évalués comme les
  autres à chaque image ;
- tant que le résultat n'est pas arrivé, l'objet garde **son dernier
  résultat** (ou celui qui est enregistré dans le `.dgo`), et il est
  indéfini s'il n'en a jamais eu ;
- quand un résultat arrive, les objets qui le lisent sont recalculés et
  redessinés, comme après une manipulation.

Pendant un glissement :

- une seule requête en cours par objet : une requête dépassée est
  remplacée, jamais mise en file ;
- un résultat qui dépend d'un curseur (`Derivative(a x^3)`) est demandé
  **une fois avec `a` symbolique**, puis évalué à chaque image sans Giac.
  GeoGebra fait déjà ainsi (`FunctionNVar.evalCasCommand`, vérifié le
  2026-11-22) : les curseurs restent des symboles dans la chaîne envoyée,
  et le résultat est mis en cache par cette chaîne. Il dérive aussi un
  polynôme à coefficients numériques sans Giac du tout
  (`Function.getDerivative`, « much faster, especially in web »). À
  reproduire, et à étudier commande par commande à l'étape 3 ;
- au relâchement, la dernière requête donne le résultat exact.

### Enregistrement

Le `.dgo` garde le **dernier résultat** de chaque calcul, comme il garde les
valeurs `v` des cellules DocCells. Une figure dont personne ne bouge les
dépendances s'ouvre et s'affiche donc sans télécharger Giac, même hors
ligne.

### Trois usages, du plus simple au plus lourd

1. **Commandes de calcul formel dans les formules** : `Derivative`,
   `Integral`, `Factor`, `Expand`, `Simplify`, `Solve`, `Limit`,
   `TaylorPolynomial`… Elles produisent des objets de la figure, recalculés
   quand leurs dépendances changent. Une seule ligne par objet (`AGENTS.md`).
2. **La vue CAS** : une nouvelle sorte de vue, comme la vue tableur (`t`
   d'une vue, colonne d'une page ou onglet). Elle contient des lignes de
   calcul, des références `$n` entre lignes, la distinction entre `:=` et
   `=`, des variables libres, et les modes exact, numérique ou « garder
   l'entrée ». Une ligne peut lire des objets de la figure, et peut
   définir un objet montré dans la figure. Résultats rendus par KaTeX.
3. **Le raisonnement automatique** : `LocusEquation`, `Envelope`, `Prove`,
   `ProveDetails`, l'outil Relation « vrai en général ». Il faut traduire
   chaque étape de la construction en équations polynomiales, pour chaque
   objet de DocGeo. C'est la partie la plus lourde, avec une part de
   recherche.

## Fidélité à GeoGebra

- La traduction des commandes suit `Ggb2giac` (voir sa licence plus haut).
  Elle définit la sémantique : mêmes résultats que GeoGebra, mêmes formes
  de réponse.
- Les noms des objets sont renommés dans les appels : pour Giac, `e` et
  `i` sont les constantes e et i (un objet `e` devient `exp(1)`), et
  d'autres noms sont des commandes. GeoGebra préfixe ses variables
  (`ggbtmpvar`).
- La réponse de Giac est relue par une grammaire fermée, comme
  `dgp_formula.ts`. Une réponse que cette grammaire ne connaît pas rend
  l'objet indéfini et le signale.
- Les noms des commandes suivent la règle des autres commandes de
  l'éditeur (noms de la langue, `src/editor/lang/`), voir « Questions pour
  l'auteur ».

## Format `.dgo`

Purement additif (`DGO.md`, « Règles d'évolution »), à décrire dans
`DGO.md` à l'étape qui l'introduit :

- les commandes de calcul formel dans les formules, avec leur dernier
  résultat ;
- la vue CAS (`t` d'une vue) et ses lignes, avec leurs derniers résultats.

## Sécurité

Giac est un interpréteur complet. Une figure peut venir de n'importe où
(`?url=`). Les règles sont les mêmes que pour `dgp_formula.ts` :

- **Jamais de texte de la figure passé tel quel à Giac.** DocGeo construit
  chaque appel depuis un arbre validé, avec une **liste fermée** de
  commandes, et des noms de variables contrôlés (lettres et chiffres).
  Une ligne de la vue CAS est d'abord lue par la grammaire de DocGeo,
  puis traduite.
- **Pas de sortie du bac à sable.** L'étape 0 a trouvé une porte dans
  les deux compilations : `read("…")` fait une requête HTTP synchrone
  (`XMLHttpRequest`, code JavaScript appelé depuis le WebAssembly) vers
  n'importe quelle adresse, et un chemin relatif vise le serveur de la
  page, avec ses cookies. La réponse revient dans Giac. Elle est fermée de
  deux façons :
  - le Worker retire `XMLHttpRequest`, `fetch`, `importScripts`,
    `WebSocket` et `EventSource` de sa portée dès que Giac est chargé
    (vérifié : `read` échoue alors, sans requête, et Giac continue de
    calculer) ;
  - notre compilation retire ce code (étape Giac).

  Le reste est sans danger : `write` est refusé (« Running in secure
  mode »), `system`, `fetch`, `alert` ne sont pas des commandes, `input`
  appelle `prompt`, absent d'un Worker, et l'ouverture d'une page
  (`window.open`, compilation de GeoGebra) n'existe pas dans un Worker.
- Le Worker n'a pas accès au DOM. Un calcul sans fin est arrêté par le
  délai : celui de Giac (`timeout n`) n'interrompt pas une boucle
  (`while true do od`), seul l'arrêt du Worker le fait.

## Développement et build

- **Où sont les fichiers** (décision 2) : `public/apps/giac` de DocTools,
  comme les autres applications embarquées (`doccells`…). DocGeo l'ouvre
  en chemin relatif, `../giac/`. Ce module doit rester **générique**, pour
  servir plus tard à DocShare ou à toute autre page : le Worker, Giac, le
  verrouillage du réseau et un protocole simple (charger, calculer avec un
  délai, arrêter). La traduction des commandes GeoGebra et la relecture des
  réponses restent dans DocGeo.
- **Pendant le chantier**, rien n'est copié dans DocTools (ce serait livré
  en production) : `giac_MAIN` produit ses fichiers dans son `dist/`, et le
  serveur de développement de `docgeo_CAS` les sert sous `/giac/` (petit
  middleware, comme pour DocCells). À la fin du chantier, avec la fusion
  dans `docgeo_MAIN`, un script de `giac_MAIN` les installe dans
  `doctools_MAIN/public/apps/giac`. Le dépôt `giac_MAIN` doit être public
  avant ce premier déploiement (sources exigées par la GPL).
- **Diffusion indépendante** : sans ce dossier, les calculs gardent leur
  résultat enregistré, sinon ils sont indéfinis, et un message le dit. La
  dérivation symbolique et les calculs numériques actuels restent le
  repli.
- **Poids** : 10 Ko au plus pour le lecteur et le moteur sur tout le
  chantier (décision 4), mesuré à chaque étape. Le code
  de la saisie dans la vue CAS va dans `src/editor/`. L'affichage de la vue
  CAS, nécessaire au lecteur, est un module chargé à la demande.

## Décisions de l'auteur (2026-11-22)

1. **Notre propre compilation de Giac**, faite dans `giac_MAIN` depuis le
   miroir `geogebra/giac`, avec les réglages de GeoGebra (`-Oz`).
2. **Livrée dans `public/apps/giac` de DocTools**, comme les applications
   embarquées : DocShare pourra l'employer plus tard. Module générique
   (voir « Développement et build »).
3. **La vue CAS est du code propre à DocGeo**, chargé à la demande (pas une
   iframe).
4. **Budget : 10 Ko** pour le lecteur (et le moteur) sur tout le chantier.
5. **Noms des commandes traduits** dans les 12 langues, comme toutes les
   commandes de DocGeo.
6. **Pas de contact** avec Bernard Parisse.
7. **Mémoire de Giac fixe**, 64 Mo (réglage de GeoGebra) : un calcul
   énorme donne `crash` et le Worker est relancé (compte rendu de
   l'étape 1).
8. **Exception d'`AGENTS.md`** validée telle que rédigée à l'étape 2.

## Étapes

- [x] **Étape 0 — essai, sans toucher à DocGeo** (dossier de travail
  temporaire).
  - Récupérer la compilation web de Bernard Parisse et celle de GeoGebra.
  - Mesurer leur poids brut, gzip et brotli, et le temps de chargement et
    de compilation.
  - Dans un Worker, mesurer le temps de commandes typiques : `factor`,
    `solve`, `diff`, `integrate`, `limit`, `gbasis`, `eliminate`.
  - Confirmer la licence (`COPYING`) et vérifier les sorties du bac à
    sable.
  - Essayer de recompiler Giac depuis ses sources avec Emscripten.
  - Rapport, puis décisions 1 et 2.
- [x] **Étape M (MAIN) — mise en place** :
  - avec l'accord de l'auteur, commit de `CAS.md` sur `master` (un mémo,
    sans effet sur la production) ;
  - `git worktree add ../docgeo_CAS -b cas`, puis `npm install` dans
    `docgeo_CAS` ;
  - lien de la mémoire : le dossier mémoire du projet `docgeo_CAS` dans
    `~/.claude/projects/` pointe vers celui de `docgeo_MAIN` ;
  - création de `giac_MAIN` : sources du miroir `geogebra/giac`, Emscripten
    4.0.7 (`emsdk`), `COPYING`, script de compilation (commande de
    l'étape 0) vers `dist/`, `AGENTS.md` (petits correctifs isolés, Giac d'origine comme
    référence, mesures), `git init` ;
  - la session dit ensuite à l'auteur d'ouvrir `giac_MAIN` dans VS Code
    pour l'étape 1.
- [x] **Étape 1 (Giac) — copie, compilation et module générique.**
  - Script reproductible vers `dist/`, code réseau de Giac retiré
    (`read` d'une adresse), réponses vérifiées identiques à celles de
    l'étape 0.
  - Module générique dans `dist/` (décision 2) : un Worker qui charge
    Giac, retire les fonctions réseau de sa portée, et répond à un
    protocole simple et versionné (prêt, calcul avec délai, erreur),
    plus une petite bibliothèque d'appel pour la page hôte (création,
    arrêt et relance du Worker, `WebAssembly.Module` transmis pour ne pas
    recompiler). Rien de propre à DocGeo.
  - Une page de test dans `giac_MAIN`, et le script d'installation dans
    `doctools_MAIN/public/apps/giac`, qui ne sera lancé qu'à la fin du
    chantier.
- [x] **Étape 2 (CAS) — Giac dans DocGeo**, sans commande visible :
  middleware de développement (`/giac/` → `../giac_MAIN/dist`), chargement
  à la demande par la bibliothèque du module, cache des résultats et
  recalcul des objets à leur arrivée, message si Giac est absent, tests
  unitaires du cache, poids mesuré. Exception `AGENTS.md` (rédigée avec
  l'auteur), `GGB_IMPORT.md` (exclusion du calcul formel levée).
- [ ] **Étape 3 (CAS) — commandes dans les formules** : une première liste fermée
  (`Derivative`, `Integral`, `Factor`, `Expand`, `Simplify`, `Solve`), relue
  dans le moteur, résultat enregistré dans le `.dgo`, recalcul pendant un
  glissement. Éditeur : commandes dans les 12 langues.
- [ ] **Étape 4 (CAS) — import GeoGebra** : ces commandes passent par Giac quand
  il est présent (repli actuel sinon), plus `IFactor`, `CSolve`, mode
  symbolique des suites. Mise à jour de `GGB_IMPORT.md` (exclusion
  levée, mesure du corpus).
- [ ] **Étape 5 (CAS) — vue CAS dans le lecteur** : vue et onglet, lignes,
  résultats KaTeX, recalcul quand la figure bouge.
- [ ] **Étape 6 (CAS) — vue CAS dans l'éditeur** : saisie, création et
  suppression de la vue et de l'onglet, insertion d'un objet à la souris
  (comme les étapes 15 et 16 de `TABLEUR.md`).
- [ ] **Étape 7 (CAS) — import des cellules CAS de GeoGebra** (`cascell`, qui
  sont aujourd'hui ignorées sans être signalées).
- [ ] **Étape 8 (CAS) — raisonnement automatique** : d'abord une étude
  (traduction de la construction en équations, objets couverts), puis
  `LocusEquation` et `Envelope`, puis `Prove`.
- [ ] **Manuel** dans les 12 langues, quand l'auteur le demandera.

## Point de reprise

Étapes 0, M, 1 et 2 faites le 2026-11-22 (comptes rendus ci-dessous).
Étape 2 committée sur la branche `cas` ; `giac_MAIN` n'a encore aucun
commit (à demander par l'auteur dans une session de `giac_MAIN`).
Prochaine action : étape 3, dans une session VS Code ouverte sur
`docgeo_CAS` (« lis CAS.md et fais ce qu'il dit »).

## Comptes rendus des étapes

### Étape 0 : ce qui est fait

Fait le 2026-11-22, entièrement dans un dossier temporaire : rien n'a
changé dans DocGeo. Mesures dans Chromium (Playwright), Giac dans un Web
Worker, fichiers servis en local (le temps de téléchargement s'y ajoute :
environ 1 s pour 2 Mo à 20 Mbit/s).

**Compilations essayées.**

| Compilation                           | `.wasm` | brotli | JS    | Prêt     |
| ------------------------------------- | ------- | ------ | ----- | -------- |
| GeoGebra (copie locale, extraite)     | 7,6 Mo  | 1,9 Mo | 69 Ko | 0,13–0,15 s |
| Bernard Parisse (`giacwasm.js`, 2025-10-27) | 14 Mo | 3,4 Mo | 327 Ko | 0,26–0,31 s |
| La nôtre, `-Oz` (réglages de GeoGebra) | 7,6 Mo | 1,9 Mo | 70 Ko | 0,13 s   |
| La nôtre, `-O2`                       | 15 Mo   | 2,8 Mo | 70 Ko | 0,25 s   |
| La nôtre, `-O3`                       | 15 Mo   | 2,9 Mo | 70 Ko | 0,25 s   |

« Prêt » : de la création du Worker au premier calcul possible
(chargement, compilation du WebAssembly, initialisation).

**Vitesse.** Tout est rapide. Les commandes usuelles (`factor`, `solve`,
`diff`, `integrate`, `limit`, `series`, `simplify`, `csolve`, `desolve`,
`det`, `egvl`, `eliminate`) prennent de 2 à 20 ms au premier appel, puis
moins de 2 ms. Les plus lourdes essayées, après le premier appel :

| Calcul                                   | GeoGebra | la nôtre `-Oz` | `-O3` |
| ---------------------------------------- | -------- | -------------- | ----- |
| `gbasis` cyclic-5                        | 6,3 ms   | 4,7 ms         | 6,8 ms |
| `gbasis` cyclic-6 (45 polynômes)         | 32 ms    | 32 ms          | 31 ms |
| `ifactor(2^128+1)`                       | 30 ms    | 30 ms          | 30 ms |
| `factor((x+y+z)^20-x^20-y^20-z^20)`      | 4,5 ms   | 4,4 ms         | 3,9 ms |
| `solve(x^4+p*x^2+q=0,x)`                 | 2,8 ms   | 2,3 ms         | 3,7 ms |
| déterminant symbolique 6 × 6             | 1,8 ms   | 1,8 ms         | 1,6 ms |

La compilation de Bernard Parisse a des temps du même ordre. Optimiser pour
la vitesse (`-O2`, `-O3`) ne gagne rien, double le poids et ralentit le
chargement : `-Oz` est le bon réglage. La fluidité ne demande donc ni
réécriture ni réglage de Giac : elle dépend de ce que DocGeo lui envoie
(cache, regroupement), comme prévu dans « Modèle ».

**Recompilation depuis les sources : réussie du premier coup.**
- Sources : miroir `geogebra/giac` (révision `19a710a` du 2026-10-12),
  Emscripten 4.0.7 installé par `emsdk`, GMP et MPFR précompilés du
  miroir.
- Commande de GeoGebra (`build.gradle`, tâche `emccCompileWasm`), sans
  Gradle : `emcc` sur chacun des 51 fichiers `.cc`, 8 en parallèle, avec
  `-DIN_GIAC -DGIAC_GENERIC_CONSTANTS -DHAVE_CONFIG_H -DGIAC_GGB -DTIMEOUT
  -DEMCC2 -fwasm-exceptions -Oz`, puis édition de liens avec
  `src/giac.js/js/time.js` et l'export `_caseval`.
- 29 s de compilation, 18 s d'édition de liens sur ce Mac (`-O3` : 45 s).
- Sur les 18 commandes du banc, ses réponses sont **identiques** à celles
  de la compilation de GeoGebra.

**Formes des réponses.** La compilation de GeoGebra (mode `GIAC_GGB`)
écrit `√2` et ne fait que factoriser dans `ifactor`. Celle de Bernard
Parisse écrit `sqrt(2)` et ajoute une valeur approchée
(`…=1.84467440737e+19`, réglage de l'interface d'Xcas). Le mode GeoGebra
est celui qu'il nous faut.

**Délai.** `timeout 2` est accepté (« Max eval time set to 2.0 ») mais
n'interrompt pas `while true do od`. Arrêter le Worker l'interrompt, et le
relancer prend de 0,13 à 0,25 s. Giac reste utilisable après une erreur
JavaScript interne (`read` sans réseau, par exemple).

**Noms.** `e` et `i` sont des constantes pour Giac : le premier essai de
cyclic-5, écrit avec une variable `e`, a répondu avec `exp(1)`. D'où la
règle de renommage de « Fidélité à GeoGebra ».

**Sécurité.** Voir « Sécurité » : `read("…")` atteint le réseau dans les
deux compilations ; retirer les fonctions réseau du Worker après le
chargement ferme cette porte (vérifié).

**Licence.** GPL v3 ou ultérieure, confirmée par l'en-tête des sources.

**Recommandations pour les questions 1 et 2** (suivies : décisions 1
et 2).
1. Notre propre compilation, depuis le miroir `geogebra/giac` : même poids
   et même vitesse que celle de GeoGebra, mode GeoGebra des réponses,
   chaîne de compilation simple et rapide (moins d'une minute), et seule
   façon de retirer le code réseau à la source. Celle de Bernard Parisse
   pèse deux fois plus, porte l'interface d'Xcas et répond sous une autre
   forme.
2. Le dépôt de la copie de Giac contient les sources du miroir, un script
   de compilation (`emcc` direct, comme à l'étape 0) et le fichier
   `COPYING`. Il produit `giac.wasm` (7,6 Mo) et son `giac.js` (70 Ko).

### Étape M : ce qui est fait

Fait le 2026-11-22.

- `CAS.md` committé sur `master` (`a37eb516`), avec l'accord de l'auteur.
- `docgeo_CAS` : `git worktree add ../docgeo_CAS -b cas`, `npm install`.
  Le mémo vit désormais ici (branche `cas`).
- Mémoire de Claude : les dossiers `-Users-erichake-Desktop-BV-html-docgeo-CAS`
  et `-Users-erichake-Desktop-BV-html-giac-MAIN` de `~/.claude/projects/`
  ont un lien `memory` vers celle de `docgeo_MAIN` (`giac_MAIN` aussi, pour
  que ses sessions gardent les préférences de l'auteur).
- `giac_MAIN` (`git init`, branche `master`, rien de committé) :
  - `upstream/` (17 Mo) : copie non modifiée de la partie utile du miroir
    `geogebra/giac`, révision `19a710a` (2026-10-12) notée dans
    `UPSTREAM.md` : `src/giac/` (C++, en-têtes, grammaires flex et bison),
    `src/giac.js/js/time.js`, GMP et MPFR précompilés, `README.md` ;
    `update_upstream.sh <révision>` la remplace ;
  - `patches/` : nos correctifs, un fichier daté par correctif, appliqués
    par `build.sh` sur une copie (`build/src`) ; vide pour l'instant ;
  - `build.sh` : commande de l'étape 0 (`emcc` direct, réglages de
    GeoGebra, `-Oz`, compilation parallèle) vers `dist/giac.js` (69 Ko) et
    `dist/giac.wasm` (7,6 Mo, 2,7 Mo gzip, 1,9 Mo brotli), en 48 s ;
    `--original` compile sans correctif (la référence) ;
  - Emscripten 4.0.7 dans `emsdk/` ; `emsdk/`, `build/`, `dist/` ignorés
    par git ;
  - `COPYING` (GPL v3), `README.md` (anglais, pour le dépôt public),
    `AGENTS.md` (+ `CLAUDE.md`) : organisation, licence, correctifs petits
    et isolés, mesurer d'abord, Giac d'origine comme oracle, sécurité,
    module générique.
- Vérifié sous Node : `factor`, `diff`, `integrate`, `solve` (`√2`, mode
  GeoGebra) et `ifactor(2^128+1)` répondent comme à l'étape 0.
- Aucun code de DocGeo touché : ni tests ni build du lecteur à mesurer.

### Étape 1 : ce qui est fait

Fait le 2026-11-22 dans `giac_MAIN` (organisation décrite dans son
`AGENTS.md`). Aucun code de DocGeo touché : ni tests ni build du lecteur à
mesurer.

**Correctifs** (`patches/`, un fichier daté chacun) :
- `01-no-network.patch` : sous Emscripten, `fetch()` de Giac (appelé par
  `read("…")`, `csv2gen`…) renvoie `"ERROR"` sans JavaScript, et
  `system_browser_command` (`window.open`) ne fait plus rien. Le seul
  JavaScript appelable depuis Giac est désormais `Date.now` et un `alert`
  inerte (`UI.warnpy`) ; `build.sh` échoue s'il reste `XMLHttpRequest`,
  `window` ou `fetch` dans ce code. Le reste de `giac.js` (runtime
  d'Emscripten : chargement du `.wasm`, fichiers paresseux) n'est pas
  atteignable depuis Giac.
- `02-no-history.patch` : **trouvé en mesurant**. `caseval` gardait chaque
  entrée et chaque résultat dans l'historique du contexte, jamais libéré
  (`restart` ne le vide pas). La mémoire de la compilation est fixe
  (64 Mo, réglage de GeoGebra : `ALLOW_MEMORY_GROWTH` n'est pas passé à
  l'édition de liens) : environ 620 résultats de `expand((x+y+z+1)^12)`
  suffisaient à arrêter Giac. Sans historique, 20 000 passent. DocGeo n'en
  a pas besoin (les `$n` de la vue CAS seront gérés par DocGeo) ; seuls
  `ans()`, `quest()`, `entry()` sont touchés.

**Compilation** : `./build.sh` (≈ 55 s) → `dist/`, `./build.sh --original`
→ `dist_original/` (la référence, côte à côte pour l'oracle).

| Fichier          | Brut      | gzip      | brotli    |
| ---------------- | --------- | --------- | --------- |
| `giac.wasm`      | 7 582 348 | 2 656 722 | 1 947 481 |
| `giac.js`        | 68 399    | 19 072    | 17 083    |
| `giac_worker.js` | 2 326     | 1 069     | 889       |
| `giac_host.js`   | 4 123     | 1 569     | 1 349     |

Deux compilations d'une même source diffèrent de quelques centaines
d'octets (ordre de blocs d'exceptions WebAssembly, même taille) ; leurs
réponses sont identiques.

**Oracle** : `tools/oracle.sh` compare `dist/` à `dist_original/` sous Node
sur `test/inputs.txt` (128 commandes : banc de l'étape 0, commandes
usuelles) et des entrées au hasard reproductibles (`factor`, `expand`,
`diff`, `integrate`, `solve`, `limit`, `taylor`, `partfrac`, `gcd`…).
Réponses **identiques** sur 3 128, puis 10 128 entrées (deux graines),
en 2 à 3 s ; une seule erreur Giac sur 3 128. Le banc exécuté dans le
navigateur donne exactement les réponses de l'originale (donc celles de
GeoGebra, étape 0).

**Module générique** (`module/`, copié dans `dist/`) :
- `giac_host.js` (module ES, 1,3 Ko brotli) : `createGiac({timeout})`
  rend `{ load, eval(expr, {timeout}), stop }`. `eval` résout
  `{ value, ms, log }` ou rejette une `GiacError` de code `giac` (message
  de Giac), `timeout`, `crash`, `load`, `protocol` ou `stopped`. Rien
  n'est chargé avant le premier `load`/`eval`. La page compile le
  `.wasm` (`compileStreaming`, ou `compile` si le serveur ne donne pas
  `application/wasm`) et transmet le `WebAssembly.Module` au Worker : un
  Worker arrêté (délai, plantage, `stop`) est relancé sans retélécharger
  ni recompiler. Une évaluation à la fois, en file ; le délai court à
  partir de l'envoi au Worker. Les variables de Giac sont perdues à la
  relance : DocGeo doit envoyer des requêtes autonomes (ce qui va avec le
  cache par texte de requête).
- `giac_worker.js` : charge `giac.js`, puis retire de sa portée `fetch`,
  `XMLHttpRequest`, `importScripts`, `WebSocket`, `WebSocketStream`,
  `EventSource`, `WebTransport`, `Worker`, `SharedWorker` et `caches`
  (et vérifie qu'ils sont absents, sinon il refuse de démarrer). Le code
  est enfermé dans une fonction : `giac.js` déclare des globales (`run`
  remplaçait la fonction du Worker, trouvé à l'essai).
- Protocole v1, décrit en tête de `giac_host.js` : `init`, `eval` →
  `ready`, `result`, `error`, chaque message porte `v`.

**Essais dans le navigateur** (`tools/browser_test.mjs`, page
`test/index.html`, Chromium et WebKit) :

| Essai                                   | Chromium | WebKit |
| --------------------------------------- | -------- | ------ |
| Prêt (téléchargement local compris)     | 41–54 ms | 83 ms  |
| `read("https://…")`, `read("/…")`       | erreur Giac, **aucune requête** | idem |
| `while true do od`, délai 500 ms        | `timeout`, puis `2+2` → 4 | idem |
| Relance après délai (hors délai)        | 11–14 ms | 27 ms  |
| Mémoire épuisée (`expand(…^30)` à 6 var.) | `crash`, puis relance | idem |
| `stop()` (en cours + en file)           | `stopped` ×2, puis relance | idem |
| Erreur de syntaxe                       | `giac`   | `giac` |

Requêtes de la page : la page, `giac_host.js`, `giac.wasm` **une fois**,
puis `giac_worker.js` et `giac.js` à chaque (re)lancement.

**Script d'installation** `install_doctools.sh` (non lancé) : refuse si le
dépôt a des modifications non committées, n'a pas de dépôt public
(`origin`) ou si le commit n'y est pas poussé ; recompile les deux
versions, passe l'oracle, copie `giac.js`, `giac.wasm`, `giac_worker.js`,
`giac_host.js`, `COPYING` dans `doctools_MAIN/public/apps/giac` et écrit
`SOURCE.txt` (adresse du dépôt, commit, révision du miroir, correctifs).

**Pour l'étape 2** : DocGeo charge la bibliothèque par
`import(/* @vite-ignore */ '../giac/giac_host.js')` (son `import.meta.url`
situe le reste) ; le middleware de développement doit servir `.wasm` en
`application/wasm` (sinon compilation plus lente, mais fonctionne).
La file ne retire pas une requête dépassée : la règle « une requête par
objet » se tient dans DocGeo, avant l'envoi.

**Questions pour l'auteur.**
1. Mémoire de Giac : fixe à 64 Mo (réglage de GeoGebra, gardé) ou
   extensible (`ALLOW_MEMORY_GROWTH` à l'édition de liens) ? Fixe : un
   calcul énorme donne `crash` et le Worker est relancé, la mémoire de
   l'onglet reste bornée (utile sur tablette). Extensible : ces calculs
   aboutissent, mais un calcul emballé peut prendre jusqu'à 2 Go avant
   son délai. Recommandation : garder 64 Mo.
2. Au déploiement : vérifier que le serveur de DocTools compresse
   `giac.wasm` (1,9 Mo en brotli, 2,7 Mo en gzip, 7,6 Mo sans).

### Étape 2 : ce qui est fait

Fait le 2026-11-22 dans `docgeo_CAS`. Aucune commande visible : le module
n'est encore importé par aucun code du moteur.

- **Middleware** (`doccells.config.ts`) : un `serve(préfixe, dossier)`
  commun sert `/doccells/` (inchangé) et `/giac/` → `../giac_MAIN/dist`,
  `.wasm` en `application/wasm`, au serveur de développement et aux tests
  navigateur. À la fin du chantier, `/giac/` lira
  `../doctools_MAIN/public/apps/giac`, comme DocCells.
- **Cache** (`src/cas_cache.ts`, classe `CasCache` sans dépendance,
  testable sous Node) : `read(site, requête, lecteur)` rend
  synchroniquement la réponse connue, sinon le dernier résultat du site
  (`undefined` s'il n'en a jamais eu), et demande la requête.
  - Le **site** est l'endroit d'une formule qui demande (son nœud, à
    l'étape 3) ; le **lecteur**, l'objet recalculé à l'arrivée.
  - Une requête à la fois vers Giac ; la file de DocGeo ne garde que la
    dernière requête de chaque site : une requête dépassée et attendue par
    personne n'est jamais envoyée (« une requête par objet », que la file
    du module ne fait pas).
  - Erreur de Giac, délai dépassé, mémoire épuisée (`giac`, `timeout`,
    `crash`) : réponse `null` gardée, la requête n'est pas redemandée.
    Toute autre erreur (module absent, protocole) : Giac est **absent**
    pour la session, plus rien n'est demandé, les résultats connus
    restent lus.
  - 2 000 réponses gardées au plus, les plus anciennement lues retirées.
- **Moteur** (`src/cas.ts`) : le singleton `cas` charge
  `../giac/giac_host.js` relativement à la **page** (`document.baseURI`,
  pas au module : le moteur est dans `assets/`), à la première requête,
  délai de 5 s ; à l'arrivée d'une réponse, `invalidateGeometry` de ses
  lecteurs, comme après une manipulation. `readCas(site, requête)` prend
  pour lecteur l'objet en cours de calcul (`reading.object`, comme
  `readCells`). Giac absent : un « ⚠ Giac » discret, en bas à gauche de la
  page, sans langue (c'est un nom).
- **Tests** : `tests/unit/cas.test.ts` (6 tests, Giac simulé : réponse
  synchrone et recalcul, dernier résultat gardé, requête dépassée
  remplacée, requête encore attendue envoyée, erreurs gardées, Giac
  absent) ; `tests/browser/cas.test.ts` (vrai Giac servi sous `/giac/` :
  chargement à la demande, `factor(x^4-1)`, erreur de syntaxe → `null`,
  lecteurs recalculés).
- **Remarque pour l'étape 3** : en mode GeoGebra, Giac répond `undef`
  (et non une erreur) à certaines entrées mal formées (`factor((`) : la
  relecture des réponses doit en faire une valeur indéfinie.
- **Poids** : build du lecteur et de l'éditeur **identique octet pour
  octet** avant et après (mêmes empreintes de fichiers ; morceaux
  `engine-*` : 376 181 octets, 121 549 en gzip), puisque rien ne l'importe
  encore. Coût à venir, quand l'étape 3 l'importera : environ 1,8 Ko
  minifié (`cas.ts` + `cas_cache.ts`), sur les 10 Ko du budget.
- **Mémos** : `GGB_IMPORT.md`, exclusion du calcul formel levée (règle
  « pas de calcul formel » remplacée par « seulement par le module Giac
  chargé à la demande », `IFactor` et `CSolve` renvoyés à l'étape 4) ;
  `AGENTS.md`, exception du chantier rédigée, validée par l'auteur
  (décision 8) (sur le modèle de celle de `TABLEUR.md` : module GPL
  séparé, chargé à la demande dans un Worker, chargeur et cache dans le
  moteur sous 10 Ko, aucun texte de la figure passé à Giac, branche
  `cas` dans `docgeo_CAS`).
- **Manuel** : rien à couvrir à cette étape (aucune commande visible).

