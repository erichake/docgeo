# Calcul formel (Giac) dans DocGeo — mémo de chantier

Ouvert le 2026-11-22. Étapes 0 (essai), M (mise en place), 1 (module
Giac), 2 (Giac dans DocGeo), 3 (commandes dans les formules), 4 (import
GeoGebra), 5 (vue CAS dans le lecteur), 6 (vue CAS dans l'éditeur), 7
(cellules CAS de GeoGebra), 8 (étude du raisonnement automatique), 9
(commandes des cellules réelles), 10 (courbe algébrique,
`LocusEquation`, `Envelope`) et 11 (`Prove` et ses prédicats) faites ; décisions de l'auteur prises le même jour (« Décisions de
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

La table `Ggb2giac` est du code source de GeoGebra. Son en-tête la dit
désormais sous **EUPL 1.2** (vérifié à l'étape 4 ; dépôt
`source/shared/common/…/cas/giac/Ggb2giac.java`), licence compatible avec
la GPL v3 par son annexe ; certaines parties du dépôt (traductions,
ressources) sont sous d'autres licences, non commerciales. DocGeo n'en
reprend que la sémantique (quelle commande de Giac donne la réponse de
GeoGebra), dans ses propres requêtes, jamais le code.

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
  requêtes (20 Ko au plus, décisions 4 et 9). Giac et son Worker ne comptent
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
- **Poids** : 20 Ko au plus pour le lecteur et le moteur sur tout le
  chantier (décisions 4 et 9), mesuré à chaque étape. Le code
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
9. **Budget porté à 20 Ko** (+10 Ko) pour le moteur et le lecteur sur
   tout le chantier, après la mesure de l'étape 3 (`AGENTS.md` mis à
   jour).
10. **`Intégrale(f)`** (primitive) garde ce nom, à côté de
    `Intégrale(f, a, b)` du catalogue.
11. **Curseurs symboliques**, comme dans GeoGebra : `Factor(x^2 - a)`
    montre `x^2-a`.
12. **Noms des commandes** de l'étape 3 acceptés dans les 12 langues.
13. **Variables libres** (`IFactor(a^2 - 5)`, `a` n'étant pas un objet) :
    attendre la vue CAS ; zxmurptj reste un échec jusque-là.
14. **Noms** de `IFactor` et `CSolve` acceptés dans les 12 langues.
15. **Requêtes autonomes**, sans le mode GeoGebra de Giac (`init
    geogebra`) : DocGeo reste indépendant de GeoGebra, dont il ne reprend
    jamais le code, seulement le sens des commandes.
16. **Vue CAS : objets lus par leur valeur**, comme dans GeoGebra, alors
    qu'ils restent des symboles dans les formules de la figure.
17. **Vue CAS en radians**, même dans une figure en degrés.
18. **Une ligne qui définit un objet de la figure** : l'éditeur (étape 6)
    crée un vrai objet de la figure, avec sa ligne dans la Construction,
    que la ligne de la vue CAS nomme ; même traduction à l'import
    (étape 7).
19. **Modes numérique et « garder l'entrée »** : à l'étape 7, en
    commandes `Numeric(…)` et `KeepInput(…)` d'une ligne.
20. **Texte tapé montré tel quel**, seule la réponse en KaTeX.
21. **Lignes CAS traduites dans le lecteur** (langue du navigateur), les
    noms des commandes de calcul formel dans `cas_view`, chargé à la
    demande, pas dans le moteur : à l'étape 7.
22. **Objet défini par une ligne CAS : lien à sens unique** (la ligne CAS
    redéfinit l'objet, pas l'inverse), à revoir seulement si l'usage le
    demande.
23. **Ligne CAS par valeur, objet créé par symbole** (décisions 11 et
    16), accepté.
24. **`Sum`, `Limit`, intégrale définie et `TaylorPolynomial`** ajoutés
    aux commandes de calcul formel (formules et vue CAS, 12 langues),
    dans une petite étape avant le raisonnement automatique (étape 9).
25. **Vue CAS cachée de GeoGebra** (rumzymp5) : non importée.
26. **Lignes `symbolic` de la Suite** : toutes dans la vue CAS quand la
    vue Algèbre est montrée, les nommées en `nom := …`, liées à leur
    objet (étape 9).
27. **Noms** de `Numeric` et `KeepInput` (étape 7) acceptés.
28. **Raisonnement automatique** : continuer, d'abord `LocusEquation` et
    `Envelope` (étape 10), `Prove` ensuite (étape 11).
29. **Courbe algébrique** `f(x, y) = 0` : nouvel objet du moteur, aussi
    obtenu en tapant une équation dans l'éditeur, sans Giac.
30. **`Envelope`** : la courbe entière par Giac quand il est là, le calcul
    numérique actuel (partie balayée) restant le repli.
31. **Glissement** : coordonnées des autres points libres arrondies à
    6 chiffres, pas symboliques.
32. **`Prove`** : réponse `true`, `false` ou indéfinie, avec les
    prédicats (`AreCollinear`…) ajoutés aussi numériquement ; les
    conditions de `ProveDetails` plus tard.
33. **Étape 9 acceptée** : lignes sans commande de la vue CAS évaluées
    comme `Evaluate` de GeoGebra ; une somme sans forme close redemandée
    avec ses bornes par leur valeur (fait au début de l'étape 10) ; noms
    acceptés ; lignes sans nom de la Suite reconnues à `¥¦§¨©ª`.
34. **Liste des étapes figée** (2026-11-22) : plus aucune étape ajoutée.
    Le chantier se termine par les étapes 10 et 11, le manuel et la
    fusion. Une question soulevée par une étape est tranchée dans cette
    étape ou notée « hors chantier », jamais transformée en étape
    nouvelle ; `ProveDetails` et l'outil Relation sont hors chantier.
35. **Équations non polynomiales** (`sin(x) = y`) : des courbes `EqA`,
    comme les courbes implicites de GeoGebra (étape 10).
36. **Repli de `LocusEquation`** : le lieu balayé, comme `Envelope`.
37. **Noms** de `LocusEquation` et `Envelope` acceptés.
38. **Hors chantier** : la traduction des macros, des bissectrices et du
    centre du cercle inscrit, un curseur pour pilote, et les courbes de
    l'espace (section plane d'un cône) ; ces cas gardent le lieu balayé.
39. **Hors chantier** : les commandes imbriquées dans un prédicat
    (`Prouver(SontParallèles(Droite(A, B), …))`, objets à nommer), `Prove`
    dans la vue CAS (`?`), et les nombres non rationnels simples
    (rotation de 60°) dans `Prove` (indéfini).
40. **`true` / `false`** montrés, la valeur restant 1 ou 0 dans les
    formules.
41. **Noms** de `Prove` et des prédicats acceptés (étape 11).

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
- [x] **Étape 3 (CAS) — commandes dans les formules** : une première liste fermée
  (`Derivative`, `Integral`, `Factor`, `Expand`, `Simplify`, `Solve`), relue
  dans le moteur, résultat enregistré dans le `.dgo`, recalcul pendant un
  glissement. Éditeur : commandes dans les 12 langues.
- [x] **Étape 4 (CAS) — import GeoGebra** : ces commandes passent par Giac quand
  il est présent (repli actuel sinon), plus `IFactor`, `CSolve`, mode
  symbolique des suites. Mise à jour de `GGB_IMPORT.md` (exclusion
  levée, mesure du corpus).
- [x] **Étape 5 (CAS) — vue CAS dans le lecteur** : vue et onglet, lignes,
  résultats KaTeX, recalcul quand la figure bouge.
- [x] **Étape 6 (CAS) — vue CAS dans l'éditeur** : saisie, création et
  suppression de la vue et de l'onglet, insertion d'un objet à la souris
  (comme les étapes 15 et 16 de `TABLEUR.md`).
- [x] **Étape 7 (CAS) — import des cellules CAS de GeoGebra** (`cascell`, qui
  sont aujourd'hui ignorées sans être signalées), plus les lignes
  traduites dans le lecteur (décision 21).
- [x] **Étape 8 (CAS) — étude du raisonnement automatique** :
  traduction de la construction en équations, objets couverts, mesures,
  suite du chantier.
- [x] **Étape 9 (CAS) — commandes des cellules réelles** : `Sum`,
  `Limit`, intégrale définie, `TaylorPolynomial` (décision 24), toutes
  les lignes `symbolic` de la Suite dans la vue CAS (décision 26).
- [x] **Étape 10 (CAS) — courbe algébrique, `LocusEquation` et
  `Envelope`** (décisions 28 à 31).
- [x] **Étape 11 (CAS) — `Prove`**, et les prédicats qu'il demande
  (`AreCollinear`…, décision 32).
- [x] **Manuel** dans les 12 langues, quand l'auteur le demandera.
- [x] **Fin du chantier** (sur demande de l'auteur) : commit de
  `giac_MAIN`, fusion de `cas` dans `docgeo_MAIN`, installation de Giac
  dans DocTools, build, tests ; déploiement par l'auteur.

Liste figée (décision 34) : aucune étape ne s'y ajoute.

## Point de reprise

**Chantier terminé le 2026-11-22** : toutes les étapes faites, `cas`
fusionnée dans `master` de `docgeo_MAIN`, Giac installé dans
`doctools_MAIN/public/apps/giac`, DocGeo construit dans DocTools (compte
rendu « Fin du chantier »). Le calcul formel se développe désormais dans
`docgeo_MAIN`, sur `master`, comme le reste (exception d'`AGENTS.md`
mise à jour). `giac_MAIN` est public (https://github.com/erichake/giac)
et le module installé par `install_doctools.sh` : DocGeo est prêt à être
déployé par l'auteur.

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

### Étape 3 : ce qui est fait

Fait le 2026-11-22 dans `docgeo_CAS`.

**Commandes** (décrites dans `DGO.md`, « Commandes de calcul formel ») :
`Derivative(e[, v][, n])`, `Integral(e[, v])` (primitive), `Factor(e)`,
`Expand(e)`, `Simplify(e)`, `Solve(e[, v])` (`Solve(x^2 = 2)`, l'équation
écrite avec `=`, ou une expression nulle), dans toute formule. Un objet du
même nom garde la priorité (règle 2 de `DGO.md`).

- **Grammaire** (`dgp_formula.ts`) : un nœud `cas`, lu par `call` ; `Solve`
  lie son inconnue (`formulaIdentifiers` ne la compte pas : `s =
  Solve(x^2 = 2)` est une valeur, pas une fonction de x).
- **Requête** (`src/import/cas_formula.ts`, `casRequest`), construite depuis
  l'arbre, jamais depuis le texte :
  - les variables x, y, z, t restent des variables ; tout objet est un
    symbole `dg0`, `dg1`… (un même nom, un même symbole) : la requête ne
    dépend pas des valeurs, **un curseur glissé ne demande rien à Giac**
    (`Derivative(a x^3)` demandé une fois, `3*dg0*x^2` évalué à chaque
    image) ;
  - une expression de fonction ou une courbe nommée (`Derivative(f)`,
    `Factor(f(2x))`) est remplacée par sa formule, ses objets étant lus
    dans son propre environnement (`functionOf` de `FormulaEnv`, fourni
    par `expression_object.ts`) ;
  - une partie sans variable que Giac ne lit pas (`d(A, B)`, `x(A)`) est
    un symbole aussi ; une partie qui lit une variable et que Giac ne lit
    pas (`floor(x)`) rend la commande indéfinie ;
  - nombres exacts (`0.25` → `25/100`), fonctions sin, cos, tan, asin,
    acos, atan, sqrt, abs, exp, log (`ln`), constantes π, e, i ;
  - `Derivative` et `Integral` passent par `regroup` (sinon
    `dg0*4*2*x`), comme GeoGebra ;
  - degrés de DGPad : `sin(u)` envoyé `sin(u*pi/180)`, et la réponse
    reconvertie (dérivée juste en degrés comme en radians).
- **Réponse** (`casTree`) : relue par `parseFormula` après deux
  réécritures (`list[` → `[`, `√x` → `sqrt(x)`), puis vérifiée nœud par
  nœud : nombres, + − × ÷ ^, fonctions de la liste ci-dessus, `ln`,
  `sign`, listes, `pi`, `e`, `i`, et seulement les variables et symboles
  de la requête. Autre chose (`undef`, `erf`, une variable inconnue) :
  valeur indéfinie. L'arbre est gardé par texte de réponse et compilé une
  fois.
- **Calcul** (`compileCas`) : la requête est reconstruite à chaque
  évaluation (quelques dizaines de nœuds), la réponse lue dans le cache
  (`readCas`, étape 2), puis évaluée avec les valeurs des symboles.
  Mesuré : une courbe de 800 échantillons reste fluide (essai
  ci-dessous).
- **Lecteurs** : `reading.object` couvre maintenant aussi la projection
  (`objects_collector`, `computeAll`), où une courbe échantillonne sa
  fonction : sans cela, une courbe n'était pas redessinée à l'arrivée de
  la réponse (trouvé à l'essai).
- **Affichage** : une expression dont la formule est une seule commande
  montre la réponse de Giac (`h = (x-a)*(x+a)`), les objets par leur nom,
  les autres symboles par leur valeur (`casShown`) ; dans l'éditeur, la
  même réponse sous la ligne (`valueText`). Forme brute de Giac (`√`,
  `π`, `*`) en attendant KaTeX (étape 5).
- **`.dgo`** : clé `cas` de la figure, `{ requête: réponse }` des requêtes
  lues par ses objets (`casAnswers`), reprises avant le calcul
  (`cas.keep`) : la figure s'affiche sans Giac. Additif (`DGO.md`).
- **Éditeur** : noms traduits dans les 12 langues (`commands` des fichiers
  `lang`, mêmes clés que le catalogue, `Integral` partagé) ; une ligne est
  ramenée aux noms anglais à la lecture (`parseLine`, `casNames`) et
  écrite dans la langue (`renamed`) ; complétion par `FUNCTIONS`.
  `Intégrale(f)` (un ou deux arguments) est la primitive,
  `Intégrale(f, a, b)` reste l'intégrale du catalogue (`Itg`).

| Commande  | fr          | de            | es         | it          | pt          | nl           |
| --------- | ----------- | ------------- | ---------- | ----------- | ----------- | ------------ |
| Derivative | Dérivée    | Ableitung     | Derivada   | Derivata    | Derivada    | Afgeleide    |
| Factor    | Factoriser  | Faktorisiere  | Factoriza  | Fattorizza  | Fatorar     | Ontbind      |
| Expand    | Développer  | Multipliziere | Desarrolla | Sviluppa    | Expandir    | Uitwerken    |
| Simplify  | Simplifier  | Vereinfache   | Simplifica | Semplifica  | Simplificar | Vereenvoudig |
| Solve     | Résoudre    | Löse          | Resuelve   | Risolvi     | Resolver    | Los          |

el : Παράγωγος, Παραγοντοποίηση, Ανάπτυξη, Απλοποίηση, Λύση ;
ar : مشتقة، تحليل، نشر، تبسيط، حل ; hi : अवकलज, गुणनखंड, प्रसार, सरलीकरण,
हल ; zh : 导数、因式分解、展开、化简、求解 ; zh-TW : 導數、因式分解、展開、
化簡、求解.

**Tests** :
- `tests/unit/cas_formula.test.ts` (9) : requêtes (symboles, nombres
  exacts, variable, ordre, équation, partie lue en symbole ou refusée,
  fonction remplacée par sa formule, degrés), inconnue de `Solve` liée,
  formes de réponse de GeoGebra lues ou refusées, évaluation avec Giac
  simulé (une seule requête pour deux valeurs du curseur, réponse
  montrée avec le nom de l'objet) ; `tests/unit/cas.test.ts` : réponses
  reprises d'une figure sans appel à Giac.
- `tests/browser/cas_commands.test.ts` (vrai Giac) : huit lignes tapées
  et relues à l'identique (`g(x) = Derivative(f)`, `h = Factor(x^2 -
  a^2)`, `s = Solve(x^2 = 2)`, `F(x) = Integral(x^2, x)`, `Integral(f, 0,
  1)` du catalogue…), valeurs à l'arrivée des réponses, réponses montrées,
  curseur déplacé calculé aussitôt sans requête, `cas` du `.dgo` et figure
  rouverte ; réponse illisible (`erf`) et partie illisible (`floor(x)`)
  indéfinies.
- `tests/browser/editor.test.ts` : le contrôle des langues couvre les
  noms des commandes de calcul formel et leurs collisions.
- Suite complète : unitaires 302/302 ; navigateur 1 592/1 595, puis les
  trois fichiers en échec relancés seuls : 105/105. Échecs : le contrôle
  des langues (mon tri sur place, corrigé) ; `editor_properties`
  (« Frame was detached ») et `sheet` (pointage `GEO`, délai de 15 s),
  sous charge, qui passent seuls.

**Poids** (`npx vite build` dans un dossier jetable) : moteur `engine-*`
376 181 → 384 301 octets (**+8,1 Ko**, gzip 123 222 → 126 152,
+2,9 Ko), dont `cas_formula.ts` ≈ 4,3 Ko, `cas_cache.ts` ≈ 1,4 Ko,
`cas.ts` ≈ 0,8 Ko, le reste dans la grammaire, les expressions et le
`.dgo` ; éditeur `main-*` 347 850 → 348 292 (+0,4 Ko). Le budget de
10 Ko du chantier (décision 4) était presque atteint : porté à 20 Ko
(décision 9).

**Manuel, à couvrir plus tard** : les six commandes et leurs noms, la
réponse montrée par une expression, `Intégrale(f)` (primitive) à côté
de `Intégrale(f, a, b)`, le message « ⚠ Giac ».

**Questions pour l'auteur** (tranchées : décisions 9 à 12).
1. **Poids** : +8,1 Ko sur 10. Recommandation : charger à la demande
   `cas_formula.ts` (requête et relecture, ≈ 4,3 Ko), comme l'importeur,
   au premier nœud `cas` évalué : le moteur ne garderait que le cache et
   le chargeur (≈ 3,5 Ko pour l'étape). Coût : un module de plus à
   attendre (local, quelques millisecondes) avant d'afficher une figure
   qui en a. Autres leviers plus petits : abandonner les degrés de DGPad
   dans les commandes (≈ 0,4 Ko, commande indéfinie en degrés), ou
   relever le budget.
2. **`Intégrale(f)`** : primitive comme dans GeoGebra, alors que
   `Intégrale(f, a, b)` est une commande du catalogue : une forme en
   prolonge une autre, ce qu'interdit la règle de l'éditeur (sans gêne
   au clic : la primitive ne se tape qu'au clavier). Garder, ou nommer
   la primitive autrement (`Primitive`) ?
3. **Symboles** : comme dans GeoGebra (`FunctionNVar.evalCasCommand`), un
   curseur reste un symbole : `Factor(x^2 - a)` avec a = 4 montre
   `x^2-a`, pas `(x-2)*(x+2)`. D'accord ?
4. **Noms** en néerlandais, hindi et arabe choisis sans référence de
   GeoGebra sous la main : à relire.

### Étape 4 : ce qui est fait

Fait le 2026-11-22 dans `docgeo_CAS`. Le corpus est relié par un lien
symbolique (`tools/ggb_corpus/corpus` → celui de `docgeo_MAIN`, ignoré par
git).

**Interprétation** : « mode symbolique des suites » est lu comme le mode
symbolique de la **Suite** GeoGebra (Calculatrice, `<symbolic val="true"/>`
du noyau), dont les lignes sont des éléments `type="symbolic"` calculés
par Giac. Le `<symbolic val="true"/>` d'un nombre (fraction montrée,
63 figures) n'est qu'une façon de l'écrire : rien à faire.

**Commandes alignées sur GeoGebra** (`Ggb2giac`, lu à l'étape) :
- trouvé en mesurant : notre Giac factorise sur les radicaux par défaut
  (`factor(x^2-2)` → `(x-√2)*(x+√2)`), alors que `Factor(x^2-2)` de
  GeoGebra donne `x^2-2` : GeoGebra lance `init geogebra`, qui change aussi
  la forme des réponses (`{x=…}`, `ί`, `+c_1` des primitives). DocGeo ne
  le lance pas : ses requêtes restent autonomes (un Worker relancé perd
  ses réglages) et règlent ce qu'il faut. `Factor` est
  `[with_sqrt(0),factor(e,x),with_sqrt(1)][1]`, `IFactor` `factor(e,x)`,
  `Solve` et `CSolve` triés (`ggbsort`), comme GeoGebra (`{-√a, √a}`) ;
- nouvelles commandes `IFactor(e)` et `CSolve(e[, v])` (moteur, catalogue,
  noms dans les 12 langues ; `CSolve` lie son inconnue comme `Solve`).

| Commande | fr | de | es | it | pt | nl |
| -------- | -- | -- | -- | -- | -- | -- |
| IFactor | FactoriseIrr | IFaktorisiere | FactorizaI | FattorizzaI | FatorarComCoeficientesIrracionais | OntbindIrrationaal |
| CSolve | CRésoudre | KLöse | ResoluciónC | RisolviC | ResolverNosComplexos | CLos |

el : ΑρρητηΠαραγοντοποίηση, ΛύσηΜιγαδική ; ar : تحليلغيرنسبي، حلمركب ;
hi : अपरिमेयगुणनखंड, सम्मिश्रहल ; zh : 实数域因式分解、复数求解 ; zh-TW :
實數域因式分解、複數求解. Ceux de GeoGebra (`web3d/js/properties_keys_*`)
quand ils existent, sauf nl, ar, hi, zh (accordés aux noms de l'étape 3).

**Repli de `Derivative`** (`derivedCode` dans `dgp_formula.ts`) : sans
réponse de Giac (absent, réponse pas encore arrivée, erreur, ou formule
qu'il ne lit pas, comme un `If`), la dérivée est celle de
`dgp_derivative.ts`, de même valeur exacte : une courbe dérivée s'affiche
dès l'ouverture, avant le chargement de Giac. `dgp_derivative.ts` dérive
aussi `mod` (l'`abs` de DGPad, sous lequel l'import écrit `abs`), que
Giac lit maintenant comme `abs`.

**Import GeoGebra** (`ggb_translate.ts`, détail dans `GGB_IMPORT.md`, item
93) : `Derivative(f[, x][, n])` → `f'(x) = Derivative(f)` (au lieu de la
différence centrée, fausse au bord du domaine) ; `Integral(f[, x])` →
primitive `Integral(h)`, en commande et dans une formule ; les six
commandes et `IFactor`, `CSolve` d'une formule passent telles quelles ;
une ligne `symbolic` → expression cachée, simplifiée si elle n'est pas
déjà une commande.

**Corrigés au passage (défauts de l'étape 3)** :
- `valueText` (valeurs sous les lignes de l'éditeur) lisait
  `formula.node` de tout objet : un point calculé (`Fp`, dont la formule
  est un programme) le faisait échouer, donc la liste des valeurs de
  l'éditeur. Trouvé sur hx9namvf.
- Une commande sans variable libre (`Simplify(sqrt(12) - sqrt(3))`,
  `s = Solve(x^2 = 2)`, dont x est lié) est un programme, pas une formule
  de fonction : sa réponse n'était pas montrée (`= 1.7321`). Les deux
  affichages passent par `casNode` (`expression_object.ts`) : `= √3`.

**Corpus** : 332 / 460 avant et après. hx9namvf : l'écart `a = f'(0)`
(indéfini, −1 dans GeoGebra) est corrigé, la figure attend encore
`Polynomial`. zxmurptj : 3 → 1 élément non importé (`IFactor(a^2 - 5)`,
voir question 1). Les autres figures à `Derivative` ou `Integral` attendent
autre chose (`FitPoly`, fonction écrite dans un texte, fonctions de trois
variables).

**Tests** :
- `tests/unit/cas_formula.test.ts` : requêtes de `Factor`, `IFactor`,
  `Solve`, `CSolve`, inconnue de `CSolve` liée, repli de la dérivée
  (ordre 2, fonction nommée seule), primitive sans réponse indéfinie ;
- `tests/browser/cas_commands.test.ts` (vrai Giac) : figure GeoGebra
  importée (dérivée seconde, primitive en commande et dans une formule,
  quatre lignes `symbolic`), lignes de l'éditeur, valeur de la dérivée
  avant la réponse, valeurs et réponses montrées après ;
- suite complète : unitaires 303/303 ; navigateur 1 595/1 596, l'échec
  étant le pointage instable de `sheet.test.ts` (connu), qui passe seul
  (17/17).

**Poids** (`npx vite build` dans un dossier jetable, HEAD construit à
part pour la comparaison) : moteur `engine-*` 384 301 → 384 976 octets
(**+0,7 Ko**, gzip identique à 15 octets près) ; éditeur `main-*` +25
octets ; importeur GeoGebra (à la demande) 103 044 → 103 555. Chantier :
+8,8 Ko sur 20.

**Manuel, à couvrir plus tard** : `IFactor` et `CSolve` et leurs noms ;
`Factor` sur les rationnels, `IFactor` sur les radicaux ; la réponse
montrée aussi pour une commande sans x (`Résoudre`, `Simplifier(√12 −
√3)`).

**Questions pour l'auteur** (tranchées : décisions 13 à 15).
1. **Variables libres** : une ligne de la Suite comme `IFactor(a^2 - 5)`,
   où `a` n'est pas un objet, n'a pas d'équivalent dans une formule de
   DocGeo (seules x, y, z, t sont libres). Recommandation : laisser cela à
   la vue CAS (étapes 5 à 7), où les variables libres sont naturelles, et
   compter zxmurptj comme un échec jusque-là. Autre voie : accepter dans
   une commande de calcul formel une lettre qui n'est pas un objet, comme
   symbole libre (valeur indéfinie, réponse montrée), environ 0,2 Ko.
2. **Noms** de `IFactor` et `CSolve` en néerlandais, arabe, hindi et
   chinois (pas ceux de GeoGebra, pour rester accordés à ceux de l'étape
   3) : à relire.
3. **`init geogebra`** : d'accord pour des requêtes autonomes (réglages
   dans chaque requête) plutôt que le mode GeoGebra de Giac, qui
   demanderait une option d'initialisation au module générique
   (`giac_MAIN`) et une relecture de nouvelles formes de réponses ?

### Étape 5 : ce qui est fait

Fait le 2026-11-22 dans `docgeo_CAS`.

**Sémantique des lignes, vérifiée dans GeoGebra** (sa vue CAS pilotée par
`evalCommandCAS`, avec un curseur a = 2, `f(x) = x^2 + a` et `A = (1, 3)`) :
`a^2` → 4, `Factor(x^2 - a)` → `x² - 2`, `f(x)` → `x² + 2`, `b^2` → `b²`,
`x(A) + 1/2` → `3/2`. Dans la vue CAS de GeoGebra, les objets de la
figure sont donc remplacés par **leur valeur**, à l'inverse des formules
de la figure (décision 11), et les autres lettres sont des **variables
libres**. DocGeo fait de même :
- une ligne est une formule de DocGeo (`parseFormula`, les noms des objets
  connus), ou une définition `a := …`, `f(x) := …`, qui vaut pour les
  lignes suivantes ; `$n` est l'arbre de la ligne n, si elle précède
  (sinon `?`) ;
- la requête est construite depuis l'arbre, `$n` et les noms définis
  remplacés par leur arbre : chaque requête reste **autonome**
  (décision 15) ; une fonction de la vue ou de la figure est écrite par
  sa formule, comme dans les formules (`functionOf`) ;
- un objet (ou une partie sans variable, `x(A)`) est écrit par sa valeur
  exacte (`rational`, arrondie à 15 chiffres significatifs : un curseur à
  1,44 donne `144/100`), un point ou une liste par la liste de leurs
  valeurs ; une valeur que Giac ne lit pas rend la ligne indéfinie ; une
  lettre qui n'est pas un objet est un symbole `dg<n>`, montrée par son
  nom, et peut être l'inconnue de `Solve` (`Solve(u^2 = 9, u)`) ;
- `pi` et `ln`, tapés comme dans GeoGebra, sont π et le logarithme
  népérien ;
- **radians** toujours, comme la vue CAS de GeoGebra, même dans une figure
  en degrés (DGPad) ;
- `Solve` et `CSolve` montrent leurs solutions en équations, comme
  GeoGebra : `{x = -√2, x = √2}`.

**Code** :
- `src/import/cas_formula.ts` : `casRequest` prend aussi une expression
  quelconque (pas seulement une commande) et un `valueOf` (valeur écrite,
  `null` illisible, `undefined` variable libre) ; une fonction nommée
  seule dans une autre (`g(x) = Derivative(f)`) est écrite avec les
  variables de celle-ci (trouvé à l'essai : `Solve(g(x) = 0)` était
  indéfini ; vaut aussi pour les formules, `Factor(g(x))`) ; `casTree`
  relit aussi une équation (`==`) ; `rational` exporté.
- **Moteur** : `FigureView.cas` (`{ lines, requests }`), `isGraphic`
  (ni tableur ni CAS : les vues où l'on dessine, aussi dans `dgo.ts` et
  aux trois endroits de l'éditeur où « pas tableur » voulait dire
  « graphique »), `construction.updated` (appelé après chaque mise à
  jour), `showCas` / `hideCas` (`src/cas.ts`), appelés là où l'est
  `showSheet` (`reveal`, `arrangeViews`, `fit.ts`, `dispose`) ; ils
  chargent `src/cas_view.ts` **seulement** quand une figure montrée a une
  vue CAS. Le lecteur d'un objet arrivé peut être une fonction
  (`CasCache<construction_object | (() => void)>`). `casAnswers` garde
  aussi les réponses des lignes (`requests` de chaque vue CAS, au départ
  toutes les clés de `cas` du fichier, pour qu'un enregistrement avant le
  premier calcul ne les perde pas).
- **Module à la demande** `src/cas_view.ts` (5,5 Ko, morceau
  `cas_view-*`) : un `div` par vue CAS, placé sur la colonne comme
  l'iframe de DocCells (sous les panneaux de l'éditeur), son `svg`
  masqué ; une ligne : numéro, texte tapé, puis `→` et la réponse en
  KaTeX (`\displaystyle`), refaite seulement quand son TeX change.
  KaTeX est chargé à la demande comme pour les textes (`latex.ts`) :
  importé directement, Rollup le mettait dans un morceau `engine-*`.
  Toutes les lignes sont recalculées après chaque mise à jour de la
  figure (`updated`) et à l'arrivée d'une réponse ; une requête dépassée
  pendant un glissement est remplacée (cache de l'étape 2). Réponse en
  attente : la dernière de la ligne, sinon rien ; sans réponse ou
  illisible : `?`. TeX écrit depuis l'arbre de la réponse (`texOf`) :
  `2x`, fractions, racines, `|x|`, listes entre accolades.
- **Format** (`DGO.md`, « Vue `v` ») : `"t": "c"` et `l` (textes des
  lignes) ; réponses dans `cas` ; onglet CAS (page dont la seule vue est
  la vue CAS). Le format permet plusieurs vues CAS par figure, chacune ses
  lignes ; l'éditeur pourra se limiter à une.

**Essais** :
- `tests/browser/cas_view.test.ts` (vrai Giac) : aller-retour du format
  (vue CAS à côté, onglet CAS), fichiers refusés (objet dans la vue CAS,
  ligne qui n'est pas un texte) ; quinze lignes (commandes, objets par
  valeur, variable libre, définitions de valeur et de fonction, fonction
  de la figure, `$1`, `$20` indéfini, ligne illisible, inconnue libre,
  fonction définie par une commande, `ln`, `pi`), curseur déplacé (les
  lignes qui le lisent suivent), réponses enregistrées, vue retirée avec
  la figure.
- Figure de démonstration `tests/dgo/calcul_formel.dgo` : une page à
  figure et vue CAS, un onglet CAS. Vue à l'œil dans le lecteur de
  développement et dans le **lecteur construit** (avec `giac_MAIN/dist`
  servi à côté) : rendu juste, aucune erreur ; une figure sans vue CAS ne
  charge ni `cas_view`, ni KaTeX, ni Giac. Curseur glissé à la souris :
  les lignes suivent pendant le glissement. Mode page web (`?fit`) : la
  vue CAS est placée dans sa région, ses lignes à leur taille normale,
  défilantes.
- Suite complète : unitaires 303/303, navigateur 1 598/1 598.

**Poids** (`npx vite build` dans des dossiers jetables, `HEAD` construit à
part) : moteur `engine-*` 384 976 → 386 651 octets (**+1,7 Ko**, gzip
126 813 → 128 568). Une partie vient du découpage : `cas_view`, entrée à
la demande, importe une partie du moteur, que Rollup sépare en morceaux
de plus (170 + 89 + 54 + 56 Ko au lieu de 256 + 56 + 56 Ko), d'où des
noms d'import et d'export en plus. Éditeur `main-*` +26 octets.
`cas_view-*` 5,5 Ko, hors du moteur. Chantier : +10,5 Ko sur 20.

**Manuel, à couvrir plus tard** : la vue CAS et l'onglet CAS (lecture),
la syntaxe des lignes (`:=`, `$n`, variables libres, `pi`, `ln`), les
objets lus par leur valeur (à l'inverse des formules de la figure), les
radians, `?` pour une ligne sans réponse.

**Questions pour l'auteur** (tranchées : décisions 16 à 20).
1. **Objets par leur valeur** dans la vue CAS, comme GeoGebra (vérifié),
   alors qu'ils restent des symboles dans les formules de la figure
   (décision 11) : d'accord ?
2. **Radians** toujours dans la vue CAS, comme GeoGebra, même dans une
   figure DGPad en degrés : d'accord ?
3. **Une ligne qui définit un objet de la figure** (prévu dans
   « Trois usages » : `f(x) := x^2` montré dans la figure, comme dans
   GeoGebra) : pas fait. `:=` ne vaut ici que pour les lignes suivantes
   de la vue. Le montrer dans la figure créerait un objet sans ligne de
   la Construction, contraire à « une ligne, un objet ». Recommandation :
   à l'étape 6, l'éditeur crée alors un vrai objet de la figure
   (`f(x) = x^2`, sa ligne dans la Construction), que la ligne de la vue
   CAS nomme ; à l'import (étape 7), même traduction.
4. **Modes** numérique et « garder l'entrée » de GeoGebra : pas faits.
   Recommandation : à l'étape 7, où les cellules de GeoGebra les
   emploient (`evalCommand` `Numeric`, `KeepInput`), en commandes
   `Numeric(…)` et `KeepInput(…)` d'une ligne plutôt qu'en réglage.
5. **Le texte tapé** est montré tel quel (police de l'interface), seule la
   réponse est en KaTeX, comme dans GeoGebra. D'accord ?

### Étape 6 : ce qui est fait

Fait le 2026-11-22 dans `docgeo_CAS`. Éditeur seul, sauf un crochet.

**Moteur** (+76 octets) :
- `casShown(box, view)`, crochet du `DgpadLike` (`construction.ts`),
  appelé par `cas_view.ts` après avoir construit les lignes d'une vue
  CAS : l'éditeur les rend modifiables. Le lecteur ne le définit pas.
- `CAS_DEFINITION` (l'expression de `a := …`, `f(x) := …`) passe de
  `cas_view.ts` à `cas_formula.ts`, pour être lue aussi par l'éditeur.

**Éditeur** (`src/editor/main.ts`, section « COMPUTER ALGEBRA ») :
- **Saisie**, comme la vue CAS de GeoGebra : chaque ligne est un champ
  (le texte tapé, à la place du texte montré) ; un champ vide, numéroté,
  ajoute une ligne à la fin. Entrée calcule la ligne et passe au champ
  suivant ; Échap rend le texte d'avant ; ↑ et ↓ passent d'une ligne à
  l'autre. Une ligne illisible (`2*(`) est refusée, en rouge, avec le
  message « Écriture incomprise » des lignes de la Construction. Une
  ligne vidée puis validée est supprimée ; les `$n` des lignes suivantes
  suivent (`$12` → `$11`), et une référence à la ligne supprimée est
  remplacée par sa formule entre parenthèses (`$1` →
  `(Factor(x^2 - a^2))`). Chaque changement est une étape d'annulation
  (la vue CAS est rebâtie, ses réponses relues dans le cache, sans
  nouvelle requête à Giac pour les lignes inchangées).
- **Langue** : les commandes sont montrées et tapées dans la langue
  (`Factoriser(x^2 - a^2)`), et écrites en anglais dans le `.dgo`
  (`casNames.canonical`, `casName`, comme les lignes de la
  Construction). Le lecteur montre le texte enregistré, donc en anglais
  (question 1).
- **Définition d'un objet** (décision 18) : une ligne `nom := …` ou
  `nom(x) := …` qui ne lit que des objets de la figure (et x, y, z, t ou
  ses variables) crée aussi l'objet, avec sa ligne `nom(x) = …` dans la
  Construction (`enterLine`, comme une ligne tapée), ou le redéfinit s'il
  existe. Une définition qui lit une variable libre (`n := b^2`), un `$n`
  ou un nom défini seulement dans la vue reste propre à la vue : aucun
  curseur créé. Si la ligne de la Construction est refusée (nom pris par
  un autre type d'objet…), son message est montré et la ligne CAS gardée.
- **Insertion à la souris** (comme les étapes 15 et 16 de `TABLEUR.md`) :
  pendant la saisie d'une ligne déjà commencée, un objet pressé dans la
  figure (ou un curseur, un texte…) écrit son nom au curseur, le menu de
  choix s'ouvrant si plusieurs objets sont sous le pointeur ; ni
  sélection, ni déplacement, ni point créé, le focus reste dans le
  champ. Une ligne vide laisse la figure répondre comme d'habitude (sinon
  le champ vide, focalisé après chaque Entrée, capterait tous les clics).
  Une autre ligne pressée (son numéro ou sa réponse) écrit `$n`.
- **Renommer un objet** réécrit les lignes CAS qui le lisent
  (`x(A)` → `x(P)`), comme les références des autres pages.
- **Menus** : Fichier › Vue › « Nouvelle vue calcul formel » (une seule
  par figure dans l'éditeur, le format en permettant plusieurs) et
  « Supprimer la vue calcul formel » ; Fichier › « Nouvel onglet calcul
  formel » (page nommée `CAS1`, `CAS2`…). Mêmes mécanismes que la vue et
  l'onglet tableur (`addView`, `deleteView`, `addPage`, une vue
  graphique gardée au moins). Noms dans les 12 langues :

| Clé | fr | en | de |
| --- | -- | -- | -- |
| `new_cas_view` | Nouvelle vue calcul formel | New CAS view | Neue CAS-Ansicht |
| `delete_cas_view` | Supprimer la vue calcul formel | Delete the CAS view | CAS-Ansicht löschen |
| `new_cas_page` | Nouvel onglet calcul formel | New CAS tab | Neuer CAS-Tab |

  es, it, pt, nl, el, ar, hi, zh, zh-TW : « CAS » dans la tournure de la
  vue tableur de chaque langue ; nom d'onglet `CAS%` partout.
- La frappe dans un champ CAS n'atteint pas les touches propres de la
  figure (`p`, `s` d'une vue 3D).

**Tests** : `tests/browser/cas_editor.test.ts` (vrai Giac, vraie souris
et vrai clavier, éditeur en français sur `tests/dgo/calcul_formel.dgo`) :
lignes montrées en français, ligne ajoutée calculée et focus sur la
suivante, point `A` pressé → `2*A`, réponse pressée → `$12`, aucune
sélection ni objet créé, Échap, ligne illisible refusée, `m(x) := x^2 +
a` crée `m(x) = x^2 + a` dans la Construction, `n := b^2` ne crée ni `n`
ni `b`, première ligne supprimée (`$1` remplacé, réponse `x + 1`, a
valant 1), annulation ; vue supprimée puis recréée par les menus, ligne
calculée, onglet `CAS1` ; réécriture d'une ligne au renommage. Suite
complète : unitaires 303/303, navigateur 1 601/1 601.

**Poids** (`npx vite build` dans des dossiers jetables, `HEAD` construit à
part) : moteur `engine-*` 386 651 → 386 727 octets (**+76**) ; lecteur
`main` 16 343 inchangé ; `cas_view` 5 468 → 5 448 ; éditeur `main-*`
332 000 → 334 991 (+3,0 Ko). Chantier : +10,6 Ko sur 20.

**Pas fait** : insertion d'une ligne entre deux autres, complétion des
commandes dans les champs CAS, aller-retour entre une ligne qui définit
un objet et la ligne de cet objet (question 2).

**Manuel, à couvrir plus tard** : créer et supprimer la vue et l'onglet
calcul formel ; taper, valider, annuler, supprimer une ligne ; `$n` et
leur renumérotation ; objet ou ligne pressés pendant la saisie ; une
définition qui crée un objet de la figure, et quand elle reste propre à
la vue.

**Questions pour l'auteur** (tranchées : décisions 21 à 23).
1. **Langue des lignes dans le lecteur** : l'éditeur les montre dans sa
   langue, le `.dgo` les garde en anglais, et le lecteur montre le texte
   enregistré, donc `Factor(x^2 - 1)` à un élève français. Le traduire
   dans le lecteur demanderait les noms des commandes de calcul formel
   dans les 12 langues hors de l'éditeur (moins de 1 Ko, dans
   `cas_view`, chargé à la demande, pas dans le moteur). Recommandation :
   le faire, à l'étape 7 ou maintenant, la langue du lecteur étant celle
   du navigateur.
2. **Objet défini par une ligne** (décision 18) : la ligne CAS et la
   ligne de l'objet ne se suivent que dans un sens. Taper la ligne CAS
   redéfinit l'objet ; mais changer la ligne de l'objet dans la
   Construction ne réécrit pas la ligne CAS, supprimer la ligne CAS garde
   l'objet, et supprimer l'objet laisse la définition propre à la vue. Un
   renommage suit (les deux s'écrivent avec le nouveau nom). GeoGebra les
   lie dans les deux sens. Recommandation : garder ce sens unique (une
   ligne, un objet ; la vue CAS n'est qu'une façon de le taper), et lier
   les deux seulement si l'usage le demande.
3. **Sémantique** : la ligne CAS lit les objets par leur valeur
   (décision 16), l'objet créé par sa formule les lit comme symboles
   (décision 11). Les valeurs sont les mêmes, seules les réponses
   montrées diffèrent (`m(x) := x^2 + 1` dans la vue, `m(x) = x^2 + a`
   dans la Construction). D'accord ?

### Étape 7 : ce qui est fait

Fait le 2026-11-22 dans `docgeo_CAS`. Moteur inchangé (sauf les listes
de préchargement de Vite).

**Commandes des lignes** (décision 19), propres à la vue CAS, comme les
modes de la vue CAS de GeoGebra : `Numeric(e)` et `Numeric(e, n)` (Giac
`evalf`), `KeepInput(e)` (e montré tel quel, sans requête, la définition
`f(x) := KeepInput(…)` valant pour les lignes suivantes). Elles n'agissent
qu'en tête d'une ligne ou de sa définition (ailleurs elles valent e), et
une fonction du même nom garde la priorité. Calculées dans `cas_view`
seul : la grammaire et le moteur ne les connaissent pas. Dans l'éditeur,
une définition `w(x) := KeepInput(x^2 + a)` crée l'objet `w(x) = x^2 + a`
(décision 18). Une ligne qui n'est qu'un texte (`"Calcul exact"`) est
montrée comme un texte, sans calcul (pour les cellules de texte de
GeoGebra).

**Noms dans la langue** (décision 21) : `src/import/cas_names.ts`, les
noms des dix commandes (les huit des formules, `Numeric`, `KeepInput`)
dans les 11 langues autres que l'anglais, lus par `cas_view` (langue de la
page, `LANG` de `i18n.ts`, ou `?lang=`) et par les fichiers de langue de
l'éditeur (`...CAS_NAMES.fr`, une seule source au lieu de deux). Placé
dans `src/import/` pour que son morceau, chargé seulement avec la vue CAS
ou un importeur, ne soit pas nommé `engine-` (règle de `vite.config.ts`,
dont le commentaire est mis à jour). Noms de `Numeric` : ceux de
GeoGebra (`properties_keys_*`), sauf zh-TW (non traduit chez GeoGebra :
近似數) ; `KeepInput` n'est pas une commande traduite de GeoGebra (c'est
un mode) : noms tirés du libellé de son bouton, sans espaces.

| Commande | fr | de | es | it | pt | nl |
| -------- | -- | -- | -- | -- | -- | -- |
| Numeric | Numérique | Numerisch | ValorNumérico | Numerico | ValorNumérico | Numeriek |
| KeepInput | ConserverSaisie | BehalteEingabe | ConservaEntrada | MantieniInserimento | ManterEntrada | BewaarInvoer |

el : Αριθμητικός, ΔιατήρησηΕισαγομένων ; ar : قيمةعددية، إبقاءالإدخال ;
hi : सांख्यिक, इनपुटरखें ; zh : 近似数、保留输入 ; zh-TW : 近似數、保留原式.

**Import** (`ggb_translate.ts`, `ggb_importer.ts`, `GGB_IMPORT.md` item
94) :
- les cellules `cascell`, jusqu'ici ignorées sans être signalées,
  deviennent les lignes d'une vue CAS quand la fenêtre de GeoGebra la
  montre (vue `8`), placée comme elle (à gauche si elle est à gauche ou
  au-dessus du graphique), aussi large (au plus la moitié de la fenêtre) ;
- une cellule de texte (`useAsText`) est une ligne `"…"` ; une autre est
  lue depuis son `eval` (normalisé par GeoGebra, sans ses `Evaluate` et
  ses parenthèses englobantes), sa définition `nom := …` ou `f(x) := …`
  depuis sa saisie, son mode « garder la saisie » en `KeepInput(…)`, le
  mode numérique étant déjà `Numeric(…)` dans l'`eval` ;
- la traduction est celle des formules (`formula`), les lettres qui ne
  sont pas des objets passées en variables libres (`locals`, qui peut
  maintenant nommer aussi une fonction appelée), comme les fonctions
  définies par les cellules précédentes ; `$n` est renuméroté ; une
  cellule qui appelle une commande que DocGeo n'a pas, ou lit un objet
  d'un nom que les formules n'écrivent pas, est signalée (`cascell …`) ;
- une ligne `symbolic` de la Suite qui lit une variable libre
  (`IFactor(a^2 - 5)`, décision 13) devient aussi une ligne de la vue
  CAS, à la place de la vue Algèbre si elle est montrée, à droite sinon.

**Corpus** : 332 → **333 / 460**, aucune figure perdue : zxmurptj passe.
ksughxrj (vue CAS montrée) : 5 cellules sur 10 importées (textes,
`b(z) := KeepInput(a / h * (h - z))`), les 5 autres signalées (`Sum`
symbolique, `Limit`, `Integral(f, z, 0, h)`), et la figure attend
d'autres éléments (`Prism` dans une `Sequence`…). rumzymp5 : vue CAS
cachée, non importée (voir question 2).

**Tests** :
- `tests/browser/cas_view.test.ts` (vrai Giac) : figure GeoGebra à neuf
  cellules (texte, `Factor`, définition gardée, `Limit` signalée,
  `Solve` d'une fonction de cellule, `Numeric` nommée, `$2 + 1`, `$4`
  d'une cellule non importée signalé, variable libre), vue placée à
  gauche, lignes et réponses KaTeX ; ligne de la Suite à variable libre ;
- `tests/browser/cas_editor.test.ts` : `w(x) := ConserverSaisie(x^2 + a)`
  tapé en français crée `w(x) = x^2 + a`, `Numérique(sqrt(2))` →
  `1.41421356237` ;
- `tests/browser/editor.test.ts` : le contrôle des langues couvre
  `Numeric` et `KeepInput` ;
- lecteur de développement en `?lang=fr` : lignes de
  `tests/dgo/calcul_formel.dgo` et de ksughxrj montrées en français
  (`Factoriser(…)`, `ConserverSaisie(…)`), vue CAS de ksughxrj à gauche,
  aucune erreur ;
- suite complète : unitaires 303/303 ; navigateur 1 598/1 602, les quatre
  échecs (`editor` : contrôle des langues, corrigé ; `editor_properties`,
  `fit`, `sheet` : instables sous charge, connus) relancés seuls :
  110/110.

**Poids** (`npx vite build` dans des dossiers jetables, `HEAD` construit à
part) : moteur `engine-*` 386 727 → 386 777 octets (**+50**, listes de
préchargement) ; lecteur `main` 16 343 → 16 368 ; `cas_view` 5 448 →
6 252 (à la demande) ; noms des commandes, morceau `import-*` 2 751
(1,2 Ko gzip, à la demande) ; importeur GeoGebra 103 596 → 105 448 ;
éditeur `main-*` 334 991 → 335 681. Chantier : +10,6 Ko sur 20.

**Manuel, à couvrir plus tard** : `Numérique(…)` et `ConserverSaisie(…)`
dans une ligne de la vue CAS, une ligne de texte entre guillemets, les
lignes montrées dans la langue du lecteur ; l'import des cellules CAS de
GeoGebra (ce qui est lu, ce qui est signalé).

**Questions pour l'auteur.**
1. **Commandes des cellules réelles** : la moitié des cellules de
   ksughxrj emploient `Sum(e, k, a, b)` symbolique, `Limit(e, n, ∞)` et
   l'intégrale définie `Integral(f, z, a, b)`. Les ajouter aux commandes
   de calcul formel (formules et vue CAS, noms dans les 12 langues,
   environ 0,5 Ko au moteur) ? Recommandation : oui, avec
   `TaylorPolynomial`, dans une petite étape avant l'étape 8, ou au fil
   de celle-ci.
2. **Vue CAS cachée** (rumzymp5) : ses cellules ne sont pas importées,
   puisque GeoGebra ne les montre pas et que leurs jumeaux (fonctions
   `Tn`, `Ro`) sont dans la construction. Les garder dans un onglet CAS
   demanderait que l'import produise un classeur de deux pages.
   Recommandation : ne rien faire.
3. **Lignes de la Suite** : seules celles qui lisent une variable libre
   vont dans la vue CAS ; les autres restent des expressions cachées
   (étape 4), donc invisibles dans le lecteur, alors que la Suite les
   montre toutes dans sa vue Algèbre. Recommandation : montrer toutes les
   lignes `symbolic` dans la vue CAS (les nommées en `nom := …`, liées à
   leur objet), quand la vue Algèbre est montrée.
4. **Noms** de `KeepInput` (pas de nom de commande chez GeoGebra) et
   `Numeric` en zh-TW : à relire.


### Étape 8 : étude du raisonnement automatique

Faite le 2026-11-22 dans `docgeo_CAS`, sans code : seul ce mémo change
(ni tests ni mesure de poids, rien d'autre n'ayant bougé). Giac de
`giac_MAIN/dist` lancé sous Node, comme le fait
`giac_MAIN/tools/giac_eval.cjs` (une entrée par ligne).

**Usage réel.** Sur les 492 figures du corpus GeoGebra, **aucune**
n'emploie `LocusEquation`, `Envelope`, `Prove`, `ProveDetails` ni l'outil
Relation (14 emploient `Locus`, numérique, déjà importé). Les 7 figures à
courbe implicite (`implicitpoly`) sont toutes la même section plane d'un
cône (`IntersectPath(Plane, Cone)`, 3D) : une courbe algébrique du plan ne
les aiderait pas. DGPad n'a pas de raisonnement automatique. Ce n'est donc
pas un levier de l'import (aucune figure gagnée) : c'est une
fonctionnalité nouvelle, pour les professeurs qui construisent dans
l'éditeur.

**Méthode** (celle de GeoGebra, dite de Botana : la construction devient
des équations polynomiales, Giac fait l'élimination) :
- chaque point a deux variables. Celles d'un point libre sont libres ; un
  point sur objet a une équation ; un point construit a les siennes
  (milieu `2m1 - a1 - b1`, alignement `(p1 - a1)(b2 - a2) - (p2 - a2)(b1 -
  a1)`, perpendicularité par un produit scalaire, cercle par une égalité
  de distances au carré). Une droite ou un cercle est donné par ses
  points (deux points, centre et point), qui sont ses variables ;
- **`Prove(T)`** : hypothèses H, thèse T (un polynôme) ;
  `eliminate(H ∪ {1 - t·T}, variables des objets construits ∪ {t})`
  répond `[1]` (vrai partout), des polynômes des variables libres (vrai
  sauf là où ils s'annulent : les conditions de non-dégénérescence de
  `ProveDetails`) ou `[]` (faux en général). Le calcul est fait sur les
  complexes : l'ordre (entre, intérieur, bissectrice intérieure ou
  extérieure, laquelle des deux intersections) n'existe pas, un énoncé
  est prouvé pour toutes les branches à la fois, comme dans GeoGebra ;
- **`LocusEquation(P, M)`** : M point sur objet, P = (x, y), les autres
  points libres par leurs coordonnées (rationnels) ;
  `eliminate(H, toutes les variables sauf x, y)` donne f(x, y) : la
  courbe algébrique entière (toutes ses branches), pas seulement la
  partie balayée ;
- **`Envelope(d, M)`** : de même, plus la condition de contact (jacobien
  de l'équation de d et du chemin de M selon les variables de M). Comme
  GeoGebra, elle donne toute la courbe, quand DocGeo ne trace aujourd'hui
  que la partie balayée (`GGB_IMPORT.md`, item 43).

**Mesures** (premier appel / appel suivant) :

| Calcul | Réponse de Giac | ms |
| ------ | --------------- | -- |
| `Prove` : médianes concourantes, A, B, C symboliques | `[1]`, vrai | 30 / 5 |
| `Prove` faux : centre de gravité sur (AB) | `[]` | 5 / 2 |
| `Prove` : droite de Simson, 4 points du cercle unité symboliques | vrai sauf A = B = C | 75 / 53 |
| idem, A fixé en (1, 0) | idem | 16 / 14 |
| `Prove` : droite d'Euler, A = (0, 0), B sur l'axe | vrai sauf triangle dégénéré | 3 / 3 |
| `Prove` : cercle des neuf points, B = (b, 0) | vrai sauf b = 0 | 4 / 6 |
| `LocusEquation` : milieu de AP, P sur un cercle | un cercle | 0,4 / 0,2 |
| `LocusEquation` : orthocentre, C sur un cercle | degré 4 | 10 / 2 |
| idem, coordonnées à 7 chiffres | degré 4, coefficients de 37 chiffres | 28 / 3 |
| idem, A, B, centre et rayon symboliques | plusieurs centaines de termes | 42 / 16 |
| `Envelope` : droites par (t, 0) et (0, 1 − t) | une parabole | 0,2 / 0,1 |

Giac suffit largement. Recalculer un lieu à chaque image d'un glissement,
les autres points libres donnés par leurs coordonnées (comme GeoGebra),
coûte quelques millisecondes, par le cache existant (une seule requête en
cours). Garder ces points symboliques (comme les curseurs, décision 11)
donne des polynômes énormes : à écarter pour les lieux. Fixer un premier
point libre en (0, 0) pour `Prove` (ce que fait GeoGebra) accélère
nettement (Simson : 53 → 14 ms).

**Objets du moteur couverts.**
- **Directement** (équations de degré 1 ou 2) : point libre `Pt`, point
  sur objet `On` (droite, segment, demi-droite, cercle, arc, l'ordre
  étant perdu), point fixe `Fix` et équations à coefficients numériques
  `EqL`, `EqC`, `EqQ` (constantes rationnelles), `Mid`, `Line`, `Seg`,
  `Ray`, `Vec`, `Par`, `Perp`, `Med`, `Cir`, `C3`, cercle par trois
  points, `Ctr`, intersections droite–droite, droite–cercle et
  cercle–cercle (les deux points à la fois), `Sym`, `Refl`, translation,
  `Inv`, homothétie de rapport numérique, `Prb` (foyer et directrice),
  tangente à un cercle, `TC` (centre de gravité, orthocentre, centre du
  cercle circonscrit), sommets de `Poly`.
- **Avec une variable de plus** : `Bis` (les deux bissectrices), centre
  du cercle inscrit (avec les trois exinscrits), rotation d'un angle
  numérique de cosinus algébrique (90°, 60°, 2π/n) et polygone régulier,
  longueurs et curseurs (variables, `d² = …`).
- **Hors champ** (`Prove` indéfini, comme GeoGebra pour ce qu'il ne
  traduit pas) : tout le 3D (GeoGebra aussi), fonctions et courbes,
  points de formule `Fp`, lieux, listes, itérations, suites, intégrales,
  programmes, mesures d'angles (sauf leurs égalités), rotation d'un angle
  quelconque.
- **Macros** (`Mac`) : par leurs objets intermédiaires, si le moteur les
  garde ; à vérifier à l'étape 10.

**Architecture proposée.**
- **Moteur** (il reste 9,4 Ko du budget) : un objet **courbe
  algébrique** `f(x, y) = 0` (polynôme lu par la grammaire des formules),
  tracé par une grille affinée près de la courbe (marching squares) ; les
  commandes `LocusEquation`, `Envelope`, `Prove` lisant le cache comme
  celles de l'étape 3, leur dernier résultat gardé dans le `.dgo` (une
  figure s'affiche sans Giac ni traducteur). Estimation : 2 à 3 Ko.
- **Traducteur** construction → polynômes : un module chargé à la demande
  (`src/import/`, morceau `import-*`), une table par sorte d'objet, sans
  méthode dans les classes ; chargé seulement quand un résultat manque ou
  qu'une dépendance bouge.
- **Sécurité** : la requête ne contient que des variables générées, des
  rationnels et `eliminate` : aucun texte de la figure (« Sécurité »).
- **Éditeur** : commandes dans les 12 langues ; plus tard, l'outil
  Relation (test numérique, puis « vrai en général » par `Prove`).

**Incertain** : le tracé d'une courbe de degré élevé (points singuliers,
branches proches) ; la taille des coefficients (GeoGebra arrondit les
coordonnées).

**Manuel, à couvrir plus tard** : rien pour cette étape.

**Questions pour l'auteur.**
1. **Continuer**, sachant qu'aucune figure du corpus n'en emploie ?
   Recommandation : oui, en commençant par `LocusEquation` et `Envelope`
   (visuels, utiles en classe), `Prove` ensuite.
2. **Courbe algébrique** : un nouvel objet du moteur (balise `.dgo` à
   créer, `DGO.md`), qu'on pourrait aussi obtenir en tapant une équation
   (`x^3 + y^3 = 3x y`) dans l'éditeur, sans Giac ? Recommandation : oui
   (2 à 3 Ko).
3. **`Envelope`** : la courbe entière par Giac quand il est là, le calcul
   numérique actuel (partie balayée) restant le repli ? Recommandation :
   oui, comme GeoGebra.
4. **Glissement** : coordonnées des autres points arrondies (6 chiffres)
   plutôt que symboliques. Recommandation : arrondies.
5. **`Prove`** : réponse `true`, `false` ou indéfinie ; il demande les
   prédicats (`AreCollinear`, `AreParallel`, `ArePerpendicular`,
   `AreConcyclic`, `AreConcurrent`, `AreEqual`), qui n'existent pas encore
   dans DocGeo, même numériquement. Les conditions de `ProveDetails` en
   langage géométrique : plus tard. D'accord ?

### Étape 9 : ce qui est fait

Fait le 2026-11-22 dans `docgeo_CAS`.

**Commandes** (formules de la figure et vue CAS, `DGO.md`), traduites
comme dans `Ggb2giac` :

| Commande | Requête Giac |
| -------- | ------------ |
| `Sum(e, k, a, b)` | `expand(sum(e, k, a, b))` |
| `Limit(e[, v], a)` | `regroup(limit(e, v, a))` |
| `Integral(e[, v], a, b)` | `regroup(integrate(e, v, a, b))` |
| `TaylorPolynomial(e[, v], a, n)` | `convert(series(e, v, a, n), polynom)` |

- **Variables liées** (`casBound`, `cas_formula.ts`) : l'indice de `Sum`,
  la variable de `Limit` et de l'intégrale définie, nommés ou sinon
  x, y, z, t, comme l'inconnue de `Solve`. `formulaIdentifiers` ne les
  compte pas (`Sum(k^2, k, 1, n)` ne lit que n, `Integral(x z, z, 0, 1)`
  est une fonction de x) ; la requête les écrit `dk0`, `dk1`… : un objet
  du même nom n'est pas lu ; la vue CAS ne les remplace pas par une
  définition de même nom.
- **Ordre d'un polynôme de Taylor** par sa valeur (un entier positif ou
  nul, sinon indéfini) : Giac ne développe pas à un ordre symbolique. Un
  curseur n demande donc un polynôme par entier (cache), quand les autres
  objets restent des symboles (décision 11).
- **Réponses** : `+infinity` et `-infinity` relues (∞), `infinity` sans
  signe (1/x en 0) refusée, comme `Psi`, `euler_gamma` ou
  `bounded_function(…)` (limite de sin en ∞) : indéfinies.
- **`∞`** est lu par la grammaire des formules (`Infinity`), `inf` aussi
  dans une ligne de la vue CAS, comme `pi`.
- **Éditeur** : une ligne entière `Integral(f, a, b)` dont f est un nom
  reste l'objet `Itg` du catalogue (aire tracée) ; `Integral(x^2, 0, a)`
  et `Integral(e, v, a, b)` sont la commande de calcul formel (valeur
  exacte). Noms dans les 12 langues (`cas_names.ts`), ceux de GeoGebra
  (`properties_keys_*`) sauf el `Άθροισμα` (GeoGebra :
  `ΑθροισμαΣτοιχείωνΛίστας`) et zh-TW (non traduit chez GeoGebra) :

| Commande | fr | de | es | it | pt | nl |
| -------- | -- | -- | -- | -- | -- | -- |
| Sum | Somme | Summe | Suma | Somma | Soma | Som |
| Limit | Limite | Grenzwert | Límite | Limite | Limite | Limiet |
| TaylorPolynomial | PolynômeTaylor | TaylorReihe | PolinomioTaylor | PolinomioTaylor | PolinômioDeTaylor | Taylorveelterm |

el : Άθροισμα, Όριο, ΠολυώνυμοTaylor ; ar : مجموع، نهاية، كثيرحدودتايلور ;
hi : योग, सीमा, टेलरबहुलक ; zh : 总和、极限、泰勒公式 ; zh-TW : 總和、極限、
泰勒多項式.

**Vue CAS** :
- une ligne sans commande est évaluée comme par `Evaluate` de GeoGebra
  (`Ggb2giac`) : la plus courte de `regroup(normal(e))` et `regroup(e)`.
  Avant, elle était envoyée telle quelle : `√12 − √3` restait
  `2√3 − √3`, et `$2 + 1` (avec `$2` = `(x − 2)(x + 2)`) donne
  maintenant `x² − 3`, `Derivative(ln(x)) + cos(pi)` `−1 + 1/x` ;
- une division de Giac écrite `1/2*h*a^2/n` est montrée `h a² / (2n)`
  (numérateur et dénominateur rassemblés, `fraction` dans `cas_view.ts`).

**Import GeoGebra** (`GGB_IMPORT.md`, item 95) : `Sum(e, k, a, b)`
(`commandFormula`, k lié), `Limit`, `Integral` entre bornes dans une
formule et `TaylorPolynomial` (commande et formule) passent par Giac ;
dans une cellule, l'indice d'une somme est une variable libre.
**Lignes de la Suite** (décision 26) : quand la vue Algèbre est montrée,
toutes deviennent des lignes de la vue CAS, à sa place ; une ligne sans
nom (étiquette `¥¦§¨©ª…`, celle que GeoGebra donne aux lignes de la
Suite, vu sur zxmurptj) n'est qu'une ligne, une ligne nommée est `nom :=
…` et garde son objet de la figure (lien à sens unique, décision 22).
Sans vue Algèbre, rien ne change, sauf qu'une ligne nommée à variable
libre est aussi écrite `nom := …`.
**Trouvé à l'essai** : le nom d'un objet auxiliaire de l'import
(condition d'affichage `d ≠ 0`) prenait `a` puis `b`, lettres libres des
cellules de ksughxrj (`b(z) := a / h (h − z)`) : `a` y était lue par la
valeur de cet objet (0), d'où des réponses nulles. `freshName` évite
désormais les mots des cellules et des lignes `symbolic`.

**Corpus** : 333 / 460, inchangé. ksughxrj : 9 cellules sur 10
importées, réponses de GeoGebra (`1/3 a² h + a² h/(2n) + a² h/(6n²)`,
limite `1/3 h a²`, intégrale `1/3 a² h`), vue à l'œil dans le lecteur de
développement ; la dixième lit `az`, fonction non importée, et la figure
attend toujours `Prism` dans une `Sequence`. zxmurptj : ses trois lignes
dans la vue CAS (`√3`, `(a − √5)(a + √5)`, `{x = i√5, x = −i√5}`), sans
objet caché.

**Tests** :
- `tests/unit/cas_formula.test.ts` : requêtes des quatre commandes,
  variables liées (objet du même nom non lu, partie illisible refusée,
  `formulaIdentifiers`), ordre de Taylor par valeur (entier, non entier,
  indéfini), réponses infinies lues ou refusées ;
- `tests/browser/cas_commands.test.ts` (vrai Giac, éditeur) : sept lignes
  tapées et relues (`Sum`, `Limit` à ∞ et en un point, `Integral(x^2, 0,
  a)`, `Integral(x z, z, 0, 1)`, `TaylorPolynomial(exp(x), 0, n)`, et
  `Integral(G, 0, 1)` resté au catalogue), valeurs, réponses montrées,
  curseur n changé (somme par sa forme close sans requête, nouveau
  polynôme de Taylor) ;
- `tests/browser/cas_view.test.ts` : cellules `Sum` (d'une fonction de
  cellule), `Limit` de `$n` à ∞, intégrale définie, `TaylorPolynomial`
  (réponses KaTeX), cellule `Product` signalée ; objet auxiliaire qui ne
  prend pas le nom d'une variable libre (le test échoue sans le
  correctif) ; lignes de la Suite sans et avec vue Algèbre (nommée en
  `nom :=` avec son objet, sans nom sans objet, réponses) ; réponses
  existantes mises à jour (`x^{2} - 3`, `-1 + \frac{1}{x}`, clé du
  `.dgo`) ;
- suite complète : unitaires 305/305 ; navigateur 1 602/1 603, l'échec
  (`sheet`, pointage `GEO`, instable sous charge, connu) passant seul
  (17/17).

**Poids** (`npx vite build` dans des dossiers jetables, `HEAD` construit à
part) : moteur `engine-*` 386 777 → 387 924 octets (**+1,1 Ko**, gzip
127 977 → 128 405), plus que les 0,5 Ko estimés : liaison des variables,
forme à bornes des commandes, ordre par valeur, `∞` ; lecteur `main`
16 368 inchangé ; `cas_view` 6 252 → 6 721 (à la demande) ; noms des
commandes (`import-*`) 2 751 → 3 496 (à la demande) ; importeur GeoGebra
105 448 → 106 189 ; éditeur `main-*` 335 681 → 335 707. Chantier :
+11,7 Ko sur 20.

**Manuel, à couvrir plus tard** : `Somme`, `Limite`, intégrale définie
et `PolynômeTaylor` et leurs noms ; `∞` (et `inf` dans la vue CAS) ;
`Intégrale(f, a, b)`, f nommée, qui trace l'aire, à côté de
`Intégrale(x^2, 0, 1)` et `Intégrale(e, v, a, b)`, exactes ; l'ordre d'un
polynôme de Taylor donné par un curseur ; les lignes de la Suite
importées dans la vue CAS.

**Questions pour l'auteur.**
1. **Lignes sans commande de la vue CAS** évaluées comme dans GeoGebra
   (la plus courte de deux formes, voir plus haut), ce qui change des
   réponses de l'étape 5 (`$2 + 1` → `x² − 3`) : d'accord ?
2. **Somme sans forme close** : dans une formule, un curseur reste un
   symbole (décision 11), donc `Sum(1/k, k, 1, n)` (réponse `Psi`) est
   indéfinie, alors que GeoGebra la calcule dans sa vue Algèbre.
   Recommandation : dans ce cas seulement, redemander la somme avec les
   bornes par leur valeur (comme l'ordre de Taylor), environ 0,2 Ko.
3. **Noms** à relire : de `TaylorReihe` (celui de GeoGebra, pour un
   polynôme), el `Άθροισμα`, zh `泰勒公式` (celui de GeoGebra), et les
   trois noms zh-TW.
4. **Lignes de la Suite sans nom** reconnues à leur étiquette `¥¦§¨©ª…`,
   vue sur la seule figure du corpus qui en a (zxmurptj) : à confirmer
   si l'auteur a d'autres figures de la Suite.

### Étape 10 : ce qui est fait

Faite le 2026-11-22 dans `docgeo_CAS`.

**Somme sans forme close** (décision 33) : une somme dont Giac ne donne
qu'une réponse illisible (`Sum(1/k, k, 1, n)` → `Psi`) est redemandée avec
ses bornes par leur valeur (des entiers, sinon indéfinie) :
`expand(sum(1/dk0,dk0,1,3))` → `11/6`. Seconde requête sur son propre site
(`node.args`), pour que le `.dgo` garde les deux réponses ; un curseur n
demande une somme par entier, comme l'ordre de Taylor. Dans la vue CAS,
où n non objet est une variable libre, rien ne change.

**Courbe algébrique** (décision 29), `src/objects/algebraic_object.ts`,
dans le moteur : une sous-classe de `locus_object`, dont elle garde les
points, le rendu, le pointage, les points sur objet, les intersections et
les images par une transformation (le constructeur du lieu accepte
maintenant de n'avoir ni cible ni pilote).
- **Tracé** : la fenêtre en cellules de 8 pixels, le signe de g − d à
  chaque nœud (environ 10 000 évaluations pour 800 × 600), les arêtes où
  il change affinées par 8 dichotomies, un col départagé par la valeur au
  centre de sa cellule ; un changement de signe où la fonction grandit est
  un pôle, écarté (`y = 1/x` n'a pas de trait vertical). Les segments sont
  enchaînés en polylignes, les courbes ouvertes depuis leurs bouts, les
  fermées refermées. Retracée quand la vue bouge (`readsView`).
- **Points sur la courbe** : recalés sur le point le plus proche de leur
  position après chaque tracé (sinon, l'indice de leur échantillon les
  faisait sauter quand on déplace la vue ; le test échoue sans).
- **`EqA`** : l'équation tapée, `f = x^3 + y^3 = a x y`, lue et écrite
  comme `EqQ`. L'éditeur la crée quand l'équation n'est ni de degré 1
  ni de degré 2 (où il refusait « degré »), aussi pour une équation non
  polynomiale (`sin(x) = y`, question 1) ; toujours refusée dans une
  figure 3D, et `x = x` aussi. Couleur des coniques.

**`LocusEquation(P, M)` et `Envelope(d, M)`** (décisions 28, 30, 31) :
balise `LocE` `[P, M]`, M point sur objet.
- **Traducteur** `src/import/locus_equation.ts`, chargé à la demande
  (morceau `locus_equation-*`, 2,9 Ko), sans méthode dans les classes :
  chaque objet de la chaîne entre M et P est lu par sa balise `.dgo`
  (`object.dgo` avec un contexte qui rend les objets eux-mêmes) ; le reste
  de la figure par ses coordonnées arrondies à 6 chiffres (décision 31),
  une droite par un point et sa direction, un cercle par son centre et
  son rayon. Couverts : `On` (M seul, sur une droite, un segment, une
  demi-droite, un cercle, un arc), `Mid`, `Sym`, `Ctr`, `Int` (droites
  et cercles, toutes les intersections à la fois), `Refl`, `TC` (centre
  de gravité, centre du cercle circonscrit, orthocentre, centre du cercle
  d'Euler), `Rot` et `Dil` d'un point (angle ou rapport ne lisant rien qui
  bouge avec M, lus depuis l'image), `Line`, `Seg`, `Ray`, `Par`, `Perp`,
  `Med`, `Cir`, `C1`, `C3`, `C3p`. Le reste (macros, bissectrices, centre
  du cercle inscrit, translations, un curseur pour pilote, 3D) n'est pas
  traduit : la courbe est alors le lieu balayé.
- **Requête** :
  `map(eliminate([équations], [variables]), p->normal(p/gcd(gcd(p,
  diff(p,x)), diff(p,y))))`, chaque facteur une seule fois pour que le
  signe change à la traversée de la courbe. Pour une enveloppe, la droite
  et le déterminant de la matrice jacobienne du système (`det(diff([…],
  [variables]))` : Giac n'a pas de `jacobian`), vérifié sur la parabole de
  l'étape 8. Seuls des noms générés (`dv0`…), des rationnels et des
  commandes fixes : aucun texte de la figure.
- **Réponse** : relue par `casTree`, une liste d'un seul polynôme en x et
  y, sinon le lieu balayé. Gardée dans le cache et dans `cas` du `.dgo`
  (le site est l'objet) : la figure s'affiche sans Giac. Pendant un
  glissement d'un autre point libre, la courbe garde son dernier polynôme
  jusqu'à l'arrivée du suivant.
- **Repli** (décision 30, étendue à `LocusEquation`, question 2) : tant
  que le traducteur se charge, que la réponse n'est pas arrivée, sans Giac
  ou pour une construction non traduite, le lieu balayé de `Loc`.
- **Éditeur** : commandes `LocusEquation(point, point sur objet)` et
  `Envelope(droite, point sur objet)`, noms de GeoGebra
  (`properties_keys_*`) sauf ar `Envelope` (GeoGebra : `منحن0مغلّف`, avec un
  zéro) et zh-TW (non traduit chez GeoGebra) :

| Commande | fr | de | es | it | pt | nl |
| -------- | -- | -- | -- | -- | -- | -- |
| LocusEquation | EquationLieu | Ortsliniengleichung | EcuaciónLugar | EquazioneLuogo | EquaçãoDoLugarGeométrico | VergelijkingMP |
| Envelope | Enveloppe | Einhüllende | Envolvente | Inviluppo | Envelope | OmhullendeVergelijking |

  el : ΕξίσωσηΓεωμετρικούΤόπου, Περιβάλλουσα ; ar : معادلةمحلهندسي،
  منحنىمغلّف ; hi : बिंदुपथसमीकरण, एन्वेलप ; zh : 轨迹方程、包络 ; zh-TW :
  軌跡方程、包絡.
- **Import** : `Envelope` de GeoGebra devient `LocE` (la courbe entière,
  `GGB_IMPORT.md` item 96), `LocusEquation` aussi ; DGPad garde son lieu
  d'une droite (`Loc`), qui reste la partie balayée. Corpus inchangé
  (333 / 460) : aucune figure n'emploie ces commandes (étape 8).
- **Format** : `EqA`, `LocE`, note 39 de `DGO.md`, défaut de `p` (1000)
  et styles.

**Essais** :
- `tests/browser/cas_locus.test.ts` (vrai Giac, lignes tapées dans
  l'éditeur) : folium tapé (lignes relues, points sur la courbe, boucle
  passant par (3/2, 3/2)), point sur la courbe qui suit son curseur et
  reste en place quand la vue bouge, `y = 1/x` sans trait à travers son
  pôle, conique restée `EqQ` ; M sur un
  segment : d'abord le lieu et l'enveloppe balayés (bornés), puis la
  droite y = 1 et la parabole x² = 4y entières, recalcul quand un autre
  point bouge, deux réponses dans le `.dgo`, figure rouverte ; somme sans
  forme close (11/6, puis 25/12 quand n change).
- `tests/unit/cas_formula.test.ts` : bornes d'une somme par leur valeur.
- `tests/browser/editor.test.ts` : `x^3 = y` et `sin(x) = y` ne sont plus
  refusées, elles sont `EqA`.
- `tests/browser/cas_commands.test.ts` : le test attend aussi les réponses
  de `Expand` et `Factor` avant de les lire (il échouait sous charge,
  passant seul).
- Figure `tests/dgo/courbes_algebriques.dgo` (folium, lieu, enveloppe,
  lieu circulaire) ouverte dans le **lecteur construit** sans Giac : rendu
  juste sur toute la fenêtre, aucune requête vers `giac/`, aucune erreur.
- Suite complète : unitaires 306/306 ; navigateur 1 604/1 606, puis les
  deux en échec relancés seuls 21/21 (`cas_commands`, corrigé ; `sheet`,
  pointage `GEO`, instable sous charge, connu).

**Poids** (`npx vite build` dans un dossier jetable) : moteur `engine-*`
387 924 → 390 697 octets (**+2,8 Ko**, gzip 128 405 → 129 609) ; lecteur
`main` 16 368 inchangé ; éditeur `main-*` 335 707 → 335 906 ; traducteur
`locus_equation-*` 2 961 (à la demande) ; importeur GeoGebra 106 189 →
106 294. Chantier : +14,5 Ko sur 20.

**Manuel, à couvrir plus tard** : une équation de degré quelconque tapée
(`x^3 + y^3 = 3x y`), une courbe qui suit la fenêtre ; `ÉquationLieu`
(`EquationLieu`) et `Enveloppe` et leurs noms, la courbe entière (toutes
ses branches, comme GeoGebra), le lieu balayé en attendant Giac ou pour
une construction qu'il ne traduit pas ; la somme sans forme close.

**Questions pour l'auteur** (tranchées : décisions 35 à 38).
1. **Équations non polynomiales** : `sin(x) = y`, refusée jusqu'ici, est
   maintenant une courbe `EqA` (tracée comme les autres, pôles écartés),
   comme une courbe implicite de GeoGebra. Recommandation : garder.
2. **Repli de `LocusEquation`** : le lieu balayé, comme `Envelope`
   (décision 30), plutôt que rien. Recommandation : garder.
3. **Noms** : fr `EquationLieu` est celui de GeoGebra, sans accent
   (`ÉquationLieu` serait plus juste) ; ar `Envelope` corrigé
   (`منحنىمغلّف`) ; zh-TW repris du chinois traditionnel. À relire.
4. **Hors chantier** (décision 34) : la traduction des macros, des
   bissectrices, du centre du cercle inscrit et d'un curseur pour pilote ;
   la section plane d'un cône en 3D (les 7 `implicitpoly` du corpus).

### Étape 11 : ce qui est fait

Faite le 2026-11-22 dans `docgeo_CAS`.

**Prédicats** (décision 32), dans les formules, chaque argument étant le
nom d'un objet : `AreCollinear(A, B, C)`, `AreParallel(d, e)`,
`ArePerpendicular(d, e)`, `AreConcyclic(A, B, C, D)` (cercle ou droite,
comme GeoGebra), `AreConcurrent(d, e, f)` (ou parallèles),
`AreEqual(a, b)` (points, cercles, droites, sinon longueurs de segments
ou valeurs de nombres, comme `==` de GeoGebra). Calculés par DocGeo
(`src/predicates.ts`, moteur), à 10⁻⁹ près relativement : 1 ou 0,
indéfinis pour d'autres objets. Ce sont des commandes de la grammaire
(`CAS_ARITY`, sans requête Giac : une ligne de la vue CAS qui les emploie
reste `?`), qui lisent leurs objets par un nouveau `objectOf` de
l'environnement des formules (`expression_object.ts`).

**`Prove(p)`** : 1 si le prédicat est vrai en général, 0 sinon, indéfini
en attendant la réponse, sans Giac ou pour une construction non
traduite. Une expression dont la formule est un prédicat ou `Prove` montre
`true` ou `false` (dans le lecteur comme sous la ligne de l'éditeur).
- **Traducteur** : `locus_equation.ts` de l'étape 10, devenu commun aux
  lieux et à `Prove` (`system(prove)`, chargé à la demande par `cas.ts`
  comme par la courbe algébrique). Pour `Prove`, toute la construction des
  objets du prédicat est traduite depuis leurs balises `.dgo` : points
  libres `Pt` symboliques (le premier en (0, 0) quand la figure ne lit
  aucun point fixe, comme GeoGebra), points fixes `Fix` par leurs
  coordonnées, et rien n'est lu par sa valeur du moment ; un rayon, un
  angle ou un rapport doit être une fraction de dénominateur au plus 64
  (`exact`) et ne lire aucun objet, sinon indéfini (rotation de 60°
  comprise).
- **Point sur objet** (`On`), pour les lieux aussi : un paramètre, M = P +
  u d sur une droite, M = O + (u, v) avec u² + v² = r² sur un cercle. Pour
  `Prove`, u n'est pas éliminé : l'énoncé est décidé pour une position
  quelconque du point (sinon un énoncé faux en quelques positions seulement
  serait dit faux, et garder les deux coordonnées ferait tout dire vrai).
- **Seconde intersection** (`OtherIntersection`, `Int` à point P connu,
  pour les lieux aussi) : quand P est sur les deux objets, seule l'autre
  intersection, par une équation linéaire (droite et cercle : (M − P)·d +
  2 (P − O)·d = 0 ; deux cercles : symétrique de P par la droite des
  centres). Sans cela, l'énoncé devrait valoir aussi pour P lui-même
  (la perpendiculaire en K, milieu de [AQ], à la corde [AQ] : K = A).
- **Requête** : pour chaque polynôme T de la thèse (deux pour l'égalité de
  deux points ou droites, trois pour deux cercles),
  `eliminate([H…, 1 − t T], [variables sauf paramètres libres])` (méthode
  de Rabinowitsch, étape 8) ; vrai si aucune élimination n'est vide
  (`[1]` ou des conditions de non-dégénérescence), faux sinon. Seuls des
  noms générés, des fractions et `eliminate`, `det` : aucun texte de la
  figure. Réponse gardée dans `cas` du `.dgo`.
- **Sur les complexes**, comme GeoGebra : une intersection de deux
  cercles a ses deux points, un énoncé vrai pour l'un seulement est faux.

**Éditeur** : noms de GeoGebra (`properties_keys_*`) dans les 12 langues
(`cas_names.ts`), sauf nl `ZijnConcyclisch` (GeoGebra : `Zijnconcyclisch`)
et zh-TW (non traduit chez GeoGebra) :

| Commande | fr | de | es | it | pt | nl |
| -------- | -- | -- | -- | -- | -- | -- |
| Prove | Prouver | Prüfe | Demuestra | Verifica | Provar | Bewijs |
| AreCollinear | SontAlignés | LiegenAufGerade | EstánAlineados | TestAllineamento | SãoColineares | ZijnCollineair |
| AreParallel | SontParallèles | SindParallel | SonParalelas | TestParallelismo | SãoParalelas | ZijnEvenwijdig |
| ArePerpendicular | SontPerpendiculaires | SindNormal | SonPerpendiculares | TestPerpendicolarità | SãoPerpendiculares | ZijnOrthogonaal |
| AreConcyclic | SontCocycliques | LiegenAufKreis | SonCocíclicos | TestConciclici | SãoConcíclicos | ZijnConcyclisch |
| AreConcurrent | SontConcourantes | SindKopunktal | SonConcurrentes | TestIncidenza | SãoConcorrentes | ZijnConcurrent |
| AreEqual | SontÉgaux | SindGleich | SonIguales | TestUguaglianza | SãoIguais | ZijnGelijk |

el : ΑποδεικνύεταιΓενικάΟτι, ΕίναιΣυνευθειακά, ΕίναιΠαράλληλες,
ΕίναιΚάθετες, ΕίναιΟμοκυκλικά, ΕίναιΣυντρέχουσες, ΕίναιΙσα ; ar : برهن،
متسامتة، متوازية، عمودية، مشتركةعلىالدائرة، متزامنة، متساوية ; hi : प्रूव,
क्यासमरेखीयहै, समानान्तरहै, क्यालम्बवतहै, संव्रत्तियहै, संगामीहै, क्याबराबरहै ;
zh : 证明、是否共线、是否平行、是否垂直、是否共圆、是否共点、是否相等 ;
zh-TW : 證明、是否共線、是否平行、是否垂直、是否共圓、是否共點、是否相等.

**Import GeoGebra** (`GGB_IMPORT.md`, item 97) : un booléen défini par un
prédicat ou par `Prove` d'un prédicat devient une case à cocher de cette
formule, comme les autres booléens dépendants. Corpus inchangé (aucune
figure, étape 8).

**Essais** :
- `tests/browser/cas_prove.test.ts` (vrai Giac, lignes tapées et relues) :
  médianes concourantes (vrai), centre de gravité sur (AB) (faux), droite
  d'Euler (vrai), droite des milieux de même longueur que la moitié d'un
  côté (vrai), ABC alignés (faux, et toujours faux quand C est posé sur
  (AB), où le prédicat numérique dit vrai) ; angle inscrit dans un
  demi-cercle (M sur le cercle), seconde intersection (vrai), cocyclicité (vraie de quatre points du cercle, fausse
  avec un point libre) ; droite de Simson (vrai) et cercle d'Euler (pied
  d'une hauteur : vrai ; pied d'une perpendiculaire quelconque : faux) ;
  `true` montré, réponses dans le `.dgo` ; import GeoGebra.
- `tests/unit/predicates.test.ts` : les six prédicats numériquement,
  objets d'autres sortes ou indéfinis.
- `tests/browser/cas_locus.test.ts` inchangé et passant (points sur objet
  paramétrés) ; son erreur de type (`GRID.ORG` en lecture seule, étape 10)
  corrigée.
- Figure `tests/dgo/preuves.dgo` (Simson vrai, A, P, G alignés faux) ouverte
  dans le **lecteur construit** sans `giac/` : `s = true`, `r = false`,
  seul le traducteur chargé, aucune requête vers Giac, aucune erreur.
- Suite complète : unitaires 308/308 ; navigateur 1 609/1 610, l'échec
  (`editor_properties`, instable sous charge, connu) passant seul (20/20).

**Poids** (`npx vite build --outDir ../docgeo_CAS_build`) : moteur
`engine-*` 390 697 → 393 037 octets (**+2,3 Ko**, gzip 129 609 → 130 817),
dont `predicates.ts` et la grammaire ; lecteur `main` 16 368 inchangé ;
éditeur `main-*` 335 906 inchangé ; traducteur `locus_equation-*` 2 961 →
5 273 (à la demande) ; noms (`import-*`) 3 496 → 5 894 (à la demande) ;
importeur GeoGebra 106 294 → 106 891. Chantier : +16,8 Ko sur 20.

**Manuel, à couvrir plus tard** : `Prouver` et les six prédicats et leurs
noms, `true` / `false` ; la différence entre un prédicat (vrai sur la
figure telle qu'elle est) et `Prouver` (vrai en général, quelle que soit
la position des points libres) ; l'autre intersection (`AutreIntersection`)
pour énoncer sur la seconde intersection seulement ; les constructions
traduites et ce qui rend `Prouver` indéfini.

**Questions pour l'auteur** (tranchées : décisions 39 à 41).
1. **Commandes imbriquées** : `Prouver(SontParallèles(Droite(A, B),
   Droite(C, D)))` est refusé par l'éditeur (commande inconnue dans une
   formule) ; il faut nommer les droites. GeoGebra l'accepte.
   Recommandation : hors chantier (décision 34).
2. **`Prove` dans la vue CAS** (GeoGebra l'accepte) : la ligne reste `?`.
   Recommandation : hors chantier.
3. **`true` / `false`** montrés, la valeur restant 1 ou 0 dans les
   formules (comme les comparaisons de DocGeo) : d'accord ?
4. **Nombres exacts** : rotation, homothétie ou cercle de rayon donné
   seulement pour des fractions simples ; une rotation de 60° (√3) rend
   `Prove` indéfini. Recommandation : hors chantier.
5. **Noms** à relire : hi `प्रूव` (celui de GeoGebra, translittéré), nl
   `ZijnConcyclisch` (majuscule ajoutée), zh-TW repris du chinois
   traditionnel.

### Manuel : ce qui est fait

Fait le 2026-11-22 dans `docgeo_CAS`, à la demande de l'auteur, avec
les notes « Manuel, à couvrir plus tard » des étapes 3 à 11.

- **Nouvelle page** `calcul-formel.html` (« Le calcul formel »), après
  le tableur dans le groupe « Construire », dans les 12 langues (titres
  dans `manual.js`) : chargement de Giac et « ⚠ Giac » ; les commandes
  de calcul formel (tableau, curseurs symboliques, ordre de Taylor et
  somme sans forme close par valeur, `Intégrale(f, a, b)` qui trace
  l'aire, dernière valeur en attendant) ; la vue calcul formel (menus,
  saisie, `$n`, `:=`, objets par valeur, variables libres, radians,
  `Numérique`, `ConserverSaisie`, lignes de texte, `?`, désignation à la
  souris, définition qui crée un objet, langue du lecteur) ; courbes
  algébriques, `EquationLieu`, `Enveloppe` et leur repli ; prédicats et
  `Prouver` (vrai en général, `AutreIntersection`, limites des
  décisions 39 et 40) ; import GeoGebra.
- **Pages retouchées**, dans les 12 langues : `saisie.html` (équation
  de degré quelconque : courbe algébrique, plus refusée),
  `commandes.html` (`EquationLieu`, `Enveloppe`, que le contrôle disait
  absentes ; équation d'un autre degré), `formules.html` (commandes de
  calcul formel et prédicats), `formats.html` (calcul formel désormais
  repris de GeoGebra).
- **Capture** `calcul-formel.webp` (`tools/manual/shots.mjs`, fonction
  `algebra`) : une fonction, sa dérivée et une vue calcul formel de sept
  lignes tapées, réponses de Giac attendues ; générée dans les 12
  langues.
- `npm run manual -- check` : aucun manque dans les 12 langues.

### Fin du chantier : ce qui est fait

Faite le 2026-11-22, à la demande de l'auteur.

- **`giac_MAIN`** : premier commit (`bb086c7`, branche `master`) :
  `upstream/`, `patches/`, `build.sh`, `module/`, outils, page de test,
  script d'installation ; `emsdk/`, `build*/`, `dist*/` non versionnés.
  Oracle : réponses identiques à Giac d'origine sur 3 128 entrées. **Pas
  de dépôt public** : le créer et le pousser publie sous le compte de
  l'auteur, ce que la fin du chantier ne prévoyait pas ; laissé à
  l'auteur.
- **Fusion** : `git merge --ff-only cas` dans `docgeo_MAIN` (`master`
  n'avait aucun commit propre depuis la création de `cas`).
- **Installation** dans `doctools_MAIN/public/apps/giac` : les fichiers
  de `install_doctools.sh` (`giac.js`, `giac.wasm`, `giac_worker.js`,
  `giac_host.js`, `COPYING`, `SOURCE.txt`), copiés depuis `dist/` du
  commit `bb086c7`, sans la vérification du dépôt public ; `SOURCE.txt`
  le dit (« NOT YET PUBLISHED ») et sera réécrit par le script.
  `doctools_MAIN` n'est pas committé (déploiement par l'auteur).
- **Développement** : `/giac/` sert maintenant
  `../doctools_MAIN/public/apps/giac` (`doccells.config.ts`), comme
  DocCells.
- **`AGENTS.md`** : l'exception du calcul formel ne renvoie plus à
  `docgeo_CAS` ni à la branche `cas`.
- **Build** (`npm run build` dans `docgeo_MAIN`) : moteur `engine-*`
  393 037 octets, comme à l'étape 11.
- **Tests** dans `docgeo_MAIN` : unitaires 308/308 ; navigateur
  1 609/1 610 à deux reprises, l'échec étant chaque fois l'un des deux
  tests instables sous charge (`editor_properties`, glissement d'un
  nombre ; `sheet`, pointage `GEO`), qui passent seuls (37/37).
- **Lecteur construit** dans DocTools, servi avec `apps/giac`, sur une
  figure sans réponses enregistrées : Giac chargé depuis `../giac/`,
  `Prouver` répond (`true`, `false`), aucune erreur.
- `docgeo_CAS` : branche `cas` supprimée (fusionnée), le dossier détaché
  puis détruit par l'auteur, ainsi que `docgeo_CAS_build` (builds
  jetables). Son inscription dans `git worktree list` disparaît par `git
  worktree prune`. `giac_MAIN` renvoie à `docgeo_MAIN` (`4431dac`, poussé).
- **Publication**, à la demande de l'auteur : dépôt public
  `erichake/giac` créé, `master` poussé (`bb086c7`) ;
  `install_doctools.sh` relancé : Giac recompilé, d'origine et modifié,
  réponses identiques sur 3 128 entrées, module réinstallé, `SOURCE.txt`
  donnant l'adresse des sources et le commit. Les 18 tests navigateur du
  calcul formel passent avec le module installé.


### Hors chantier : confort de la vue CAS (2026-11-22)

À la demande de l'auteur, après la fin du chantier.
- **Apparence** (`cas_view.ts`, lecteur et éditeur) : gouttière grise des
  numéros sur toute la hauteur, saisies en police à chasse fixe, réponses
  KaTeX dessous, lignes de texte en italique gris ; dans l'éditeur, la
  ligne en cours de saisie surlignée (fond bleuté, filet et numéro bleus),
  « Saisie… » dans la ligne à ajouter.
- **Historique** : dans la ligne à ajouter, ↑ et ↓ rappellent les lignes
  de la vue (la dernière d'abord, chacune une fois, sans les textes), ↓
  au bout rendant le texte en cours, comme dans un terminal ; ailleurs,
  ↑ et ↓ passent toujours d'une ligne à l'autre.
- **Complétion** dès la deuxième lettre d'un mot, hors des textes : les
  commandes de calcul formel et des lignes dans la langue, les fonctions
  des formules, les objets de la figure et les noms définis dans la vue ;
  ↑ ↓ pour choisir, Tab ou Entrée pour insérer, Échap pour fermer (liste
  de l'éditeur, placée au-dessus du champ faute de place dessous ; un clic
  dans la liste garde le focus dans le champ, aussi pour la Construction).
- **Poids** : moteur et lecteur inchangés ; `cas_view` 6 721 → 7 329
  octets (à la demande) ; éditeur `main-*` 335 906 → 336 904.
- **Tests** : `cas_editor.test.ts`, historique et complétion.
- **Manuel** (`calcul-formel.html`, 12 langues) : lignes « Reprendre une
  ligne » et « Compléter un nom » du tableau de la vue, capture
  régénérée ; Giac présenté comme le moteur de Xcas seulement.
