# Règles de code

## Objectif actuel du projet

DocGeo est actuellement un **lecteur interactif de figures `.dgo`, `.dgp` et
`.ggb`**. Son objectif est d'ouvrir fidèlement les fichiers produits par DGPad
et par GeoGebra, et de permettre la manipulation des objets déjà mobiles dans
ces figures.

Tant que le lecteur ne sait pas ouvrir et manipuler avec robustesse et fluidité
des constructions complexes, ne pas développer d'outils de création, de barre
d'outils de construction ni de fonctions d'édition ou d'export, à l'exception
de l'enregistrement au format `.dgo` et du mode intégré décrit plus bas.

Exception : l'éditeur de constructions décrit dans `EDITOR.md` (page
`editor.html`, code dans `src/editor/`) est un chantier ouvert.
Le lire avant d'y toucher. Le lecteur n'importe jamais `src/editor/` et ne
s'alourdit pas de plus de 2 Ko pour lui ; les classes d'objets ne reçoivent
aucune méthode propre à l'éditeur.

Exception : les macro-constructions décrites dans `MACROS.md` sont un
chantier ouvert. Leur définition et leur application relèvent de l'éditeur
(`src/editor/`, mêmes règles). Leur calcul (nœud d'application) va dans le
moteur, puisque le lecteur doit ouvrir les `.dgo` qui en contiennent : il
reste léger, et le poids du lecteur est mesuré à chaque étape. Lire ce mémo
avant d'y toucher.

Exception : l'image d'un objet par une transformation (outils standards et
macros), décrite dans `TRANSFORMATIONS.md`, est un chantier ouvert, aux
mêmes règles : outils et commandes dans l'éditeur, calcul des images dans
le moteur, léger. Lire ce mémo avant d'y toucher.

### Format natif `.dgo`

`.dgo` est le format natif de DocGeo : le seul qu'il lit et écrit nativement
(JSON compressé en gzip). `.dgp` et `.ggb` ne sont plus que des imports.
L'enregistrement d'une figure au format `.dgo` (Cmd-S / Ctrl-S) est autorisé.
Les décisions de conception et les règles d'évolution du format (purement
additive une fois diffusé) sont dans `DGO.md` : le lire avant toute
modification de l'enregistrement ou de la lecture des figures.

Les développements doivent servir en priorité :

- l'import sûr des formats `.dgp` et `.ggb`, toute exécution de leur contenu
  devant avoir lieu dans un environnement sécurisé et strictement contrôlé (le
  JavaScript des figures GeoGebra et DGPad, et le HTML actif de ces dernières,
  ne sont jamais exécutés : ils sont ignorés et signalés ; les scripts
  GeoGebra sont traduits, voir « Import GeoGebra »). Un texte DGPad est gardé sous
  forme assainie (`src/objects/panel_object.ts`) : ses champs
  `<input target="E">` changent le nombre de l'expression `E` comme une
  manipulation. Les attributs d'événement de ses éléments (`onclick`…, un
  champ qui sélectionne son texte quand on clique) sont retirés à l'import,
  sans être signalés : son HTML ne garde aucun script. Les scripts des
  expressions DGPad, dont les programmes Blockly qui calculent une
  expression (`oncompute`), compilés en JavaScript par DGPad, sont lus par l'analyseur de
  `src/import/dgp_formula.ts` : n'étendre sa grammaire fermée qu'aux
  constructions qu'utilisent des figures réelles. Leur texte n'est jamais
  exécuté par le moteur JavaScript du navigateur. Pour les performances, un
  programme déjà validé par cette grammaire peut en revanche être traduit en
  JavaScript, à condition que son exécution reste aussi sûre que celle de
  l'interpréteur : le code généré ne dépend que de la forme de l'arbre (aucun
  nom, chaîne ou nombre de la figure recopié sans contrôle dans son texte), ne
  lit aucune variable globale, n'accède aux listes que par des indices
  numériques, garde les limites d'étapes et de profondeur, et donne exactement
  les mêmes résultats que l'interpréteur, qui reste la référence et le repli
  (page hôte interdisant `new Function`, construction non traduite). La tortue
  Blockly (fonctions `TURTLE_…`, compilées dans l'expression que dessine sa
  liste) et les boutons Blockly (`BlocklyButton`,
  dont le programme ne peut que mettre en forme des objets, changer la
  valeur d'une expression constante, comme une manipulation, afficher un
  message `ALERT`, dont seul le texte est gardé, attendre (`WAIT(ms)`,
  la figure redessinée pendant l'attente) et poser une question (`ASK`,
  dont la réponse saisie se lit par `ANSWER()`)) sont lus par le
  même interpréteur. Les globales Blockly (`GLOBAL_GET`, `GLOBAL_SET`,
  `GLOBAL_INC`) sont des expressions cachées de la figure, partagées par ses
  programmes et ses boutons (voir `DGO.md`). Le programme « onchange » d'une expression,
  lancé quand sa valeur change, et les programmes « ondrag », « onmousedown »
  et « onmouseup » d'un point, lancés quand on le glisse (ou qu'il est
  animé), l'appuie et le relâche, ont les mêmes droits que celui d'un
  bouton, qui peut aussi déplacer un point libre. Les
  autres programmes Blockly (autres événements) restent
  ignorés et signalés. Exception : l'expression « restrictions » (programme
  Blockly recopié de figure en figure qui verrouille l'interface de DGPad : zoom,
  déplacement de la vue, panneau de contrôle, déplacement des widgets…) est
  écartée sans être signalée. DocGeo ne reproduit pas ces restrictions : un
  éventuel verrouillage de la vue relèverait du mode intégré, choisi par la
  page hôte, pas de la figure. Les restrictions de rotation 3D
  (`restrictTheta`, `restrictPhi`), qui font partie de la vue de la figure,
  restent appliquées ;
- la lecture et l'écriture fidèles du format `.dgo` ;
- la compatibilité géométrique et graphique avec DGPad et GeoGebra ;
- la manipulation des objets existants ;
- la robustesse numérique et les performances sur plusieurs milliers d'objets.

### Quand une figure « passe »

Une figure ne fonctionne pas seulement parce qu'elle s'ouvre et se manipule
correctement dans le lecteur : il faut aussi que **chacun de ses programmes
issus de Blockly** (ceux d'une entrée `BLK` de DGPad : tortues « onlogo »,
boutons « onprogram », « oninit », « onchange », « ondrag »…, « oncompute »)
se montre dans l'éditeur en mode **Blocs**, et pas seulement en mode Texte.
Il en va de même des programmes traduits des scripts GeoGebra.
Cela ne concerne que le code produit par Blockly ou par cette traduction : un
script écrit à la main dans une expression n'a pas à s'ouvrir en blocs. Toute extension de la grammaire des programmes
(`src/import/dgp_formula.ts`) va donc avec ses blocs (`src/editor/blocks/`)
et son aller-retour vérifié (`tests/unit/editor_blocks.test.ts`). Ne jamais
déclarer réparée une figure Blockly sans l'avoir vérifié.

### Intégration dans DocTools

DocGeo est destiné, entre autres, à devenir un utilitaire du module DocEval du
projet DocTools (`/Users/erichake/Desktop/BV/html/doctools_MAIN`), comme
DocCells l'est pour DocShare. Le build (`npm run build` ou
`zz_build_for_doctools.command`), qui produit à la fois le lecteur
(`index.html`) et l'éditeur (`editor.html`), est produit dans
`doctools_MAIN/public/apps/docgeo` : il doit rester autonome, en chemins
relatifs, et ne contenir aucun matériel de test. Une diffusion de DocGeo comme
application indépendante n'est pas exclue : ne pas lier le code à des
hypothèses propres à DocTools qui l'empêcheraient.

`?url=` prend toute la fin de l'adresse de la page, pour qu'un lien collé
tel quel garde ses propres paramètres. Un lien de partage Google Drive,
Dropbox, OneDrive (`1drv.ms/u/c/…`) ou Nextcloud (`…/s/<jeton>`) est
remplacé par l'adresse du fichier (`src/figure_url.ts`). Une figure que le
navigateur ne laisse pas lire (site sans en-tête CORS, Drive et Nextcloud,
qui ne la servent qu'à un serveur) passe par le relais `figure.php`, livré à
côté des pages (`public/figure.php`, compatible PHP 7.4). Il ne lit qu'une
adresse web publique, jamais un fichier local ni une machine du réseau du
serveur. Servi sans PHP, le build reste fonctionnel : seules ces figures-là
ne s'ouvrent pas.

### Mode intégré

Le mode intégré (`index.html?embed`), son protocole `postMessage`, le cadre
d'enregistrement, la lecture de la valeur d'un objet et l'état élève (lecture
et application des valeurs des objets modifiables) sont autorisés : ils
servent à intégrer le lecteur dans une page hôte, pas à construire. Ils sont
décrits dans `EMBED.md` et `DGO.md` (section « État élève »), à lire avant de
les modifier.

Ils ne doivent pas devenir des outils de création ou d'édition : ni créer, ni
supprimer, ni redéfinir d'objet, et ne changer que ce qu'une manipulation
change déjà (points libres et sur objet, curseurs, champs de saisie, cases à
cocher). Le protocole reste générique et versionné, sans hypothèse propre à
DocTools ni à une autre application hôte.

L'éditeur dispose aussi de son mode intégré `editor.html?embed`, décrit
dans `EMBED.md` et `EDITOR.md`, pour DocShare et toute page hôte conservant
des figures complètes. Sa passerelle reste dans `src/editor/` et ne change
pas les droits ni le poids du lecteur intégré.

### Code DGPad de référence

Le code source de la version de DGPad actuellement en production se trouve dans :

`/Users/erichake/Desktop/BV/html/doctools_MAIN/public/apps/dgpad`

Le consulter lorsque l'import `.dgp`, la sémantique d'un objet ou un comportement
de compatibilité ne peuvent pas être déterminés avec certitude depuis le nouveau
projet et les figures de référence.

Ce code de référence a été écrit par l'auteur du projet sans assistance d'IA et
peut contenir des erreurs, oublis ou imprécisions : ce n'est pas une spécification
à reproduire à l'identique. Ce qui fait foi, c'est le rendu et le comportement
obtenus dans DGPad avec la figure ouverte. Ne pas hésiter à implémenter
autrement ou mieux (calcul plus robuste, plus simple, compatible 3D, etc.), du
moment que le résultat reste conforme à ce que produit DGPad.

Exception : là où le rendu de DGPad est mathématiquement faux, on ne le
reproduit pas. Ainsi, une courbe de fonction n'est pas reliée par un trait
vertical à ses discontinuités (`floor`, asymptotes…), contrairement à DGPad.

### Import GeoGebra

Le `geogebra.xml` d'un `.ggb` est traduit en commandes DGP
(`src/import/ggb_translate.ts`), exécutées par le même moteur que l'import
`.dgp` : étendre cette traduction plutôt que créer un chemin d'import parallèle.
Les points sur objet et les intersections sont ensuite recalés sur les positions
enregistrées par GeoGebra (`src/ggb_importer.ts`). Un élément non pris en charge
est ignoré avec ses dépendants et signalé, sans faire échouer l'import.

Les scripts GeoGebra (GgbScript : boutons, clic, mise à jour) ne sont jamais
exécutés tels quels. L'import traduit ceux qui n'emploient que des commandes
reconnues (affectation, `SetValue`, `UpdateConstruction`…) en programmes DGP,
lus par l'interpréteur de `src/import/dgp_formula.ts` avec les mêmes droits
que ceux d'un bouton Blockly, plus ceux de tourner la vue 3D, d'y montrer
ou cacher un axe (`SetViewDirection`, `SetVisibleInView`), de montrer ou
cacher la grille (`ShowGrid`) et de centrer la vue sur un point
(`CenterView`), choix de l'auteur du projet. La traduction écrit ces programmes sous la forme
que produit Blockly, pour qu'ils s'ouvrent en mode **Blocs** dans l'éditeur
(voir « Quand une figure passe »). Un script contenant une commande non
reconnue est ignoré et signalé, de même que tout script JavaScript. La
traduction relève de l'importeur, chargé à la demande ; ce qu'il faut ajouter
au moteur (instruction de l'interpréteur, événement sans équivalent) reste
léger et son poids est mesuré.

`GGB_IMPORT.md` est la feuille de route de la couverture de cet import,
mesurée sur un corpus de figures réelles de geogebra.org : la lire avant
d'étendre la traduction, et la mettre à jour (item coché, gain mesuré, taille
du build) à chaque implémentation. Le build doit rester très léger.

Une version web compilée de GeoGebra (pas son code source Java) se trouve dans :

`/Users/erichake/Desktop/BV/html/doctools_MAIN/public/apps/geogebra`

Elle sert de référence de rendu et à générer des figures de test : la servir en
HTTP local et piloter `classic-offline.html` ou `3d-offline.html` avec
Playwright (`ggbApplet.evalCommand`, `getBase64`, `setBase64`). Les commandes
de script (`SetCoords`, `Slider`…) n'y sont pas chargées : utiliser l'API
JavaScript (`ggbApplet.setCoords`, `setValue`…). Pour la sémantique précise
d'une commande, se référer au dépôt public `geogebra/geogebra`. Les figures de
test sont dans `tests/ggb/` (et `tests/dgp/` pour DGPad).

### Manuel d'utilisation

Le manuel de l'éditeur, destiné à des professeurs de mathématiques (aller
au but, rien sur le lecteur), est un mini-site statique dans
`public/tutorials/<langue>/`, dans les 12 langues de l'éditeur : une page
HTML par rubrique, dont le `<main>` seul porte le contenu, aux mêmes noms de
fichiers et aux mêmes `id` des titres visés par un lien dans toutes les
langues (le changement de langue garde la page et l'ancre). Les fichiers
communs sont dans `public/tutorials/` : `manual.js` (liste des pages
`PAGES`, titres et textes de l'interface par langue `LANGS`, tables des
matières, recherche, sélecteur de langue), `manual.css` (propriétés
logiques, pour l'arabe écrit de droite à gauche), `icons.js`, et
`index.html`, qui ouvre la langue du navigateur ou de `?lang=`. Il n'entre
pas dans le poids du build qui compte (moteur, lecteur, éditeur).

La vidéo de présentation (en français, hébergée sur files.dgpad.net) est
lue dans l'accueil avec ses chapitres, et par épisode dans les pages
concernées (`<figure class="m-video" data-episode="n">`, temps des
épisodes dans `EPISODES` de `manual.js`). `public/tutorials/video/` garde
ses affiches et ses sous-titres, un `<langue>.vtt` par langue, aux mêmes
répliques et aux mêmes temps que `fr.vtt`.

Le français est la version de référence : toute modification d'une page se
reporte dans les 12 langues. Les termes de l'interface sont ceux des
fichiers `src/editor/lang/`, les noms de commandes ceux de la langue (dans
les exemples de code comme dans `commandes.html`), les icônes d'outils
(`data-t`) sont désignées par le libellé anglais de l'outil. En chinois, pas
de saut de ligne du source entre deux caractères chinois : le navigateur
l'afficherait comme une espace.

Les icônes (`icons.js`) et les captures (`<langue>/img/`) sont générées
depuis l'éditeur : `npm run manual` (ou `-- icons`, `-- shots`, `-- check`,
suivis éventuellement de codes de langue ou de noms de captures, voir
`tools/manual/generate.mjs`,
captures décrites dans `tools/manual/shots.mjs`). Après un changement de
l'interface, d'un outil ou d'une commande, relancer `npm run manual` : son
contrôle signale, pour chaque langue, les pages manquantes, les outils et
commandes de l'éditeur absents du manuel, et les icônes, outils ou captures
que le manuel nomme sans qu'ils existent. Mettre alors à jour les pages
concernées.

- **Code minimal** : produire le strict nécessaire, sans code défensif superflu.
- **Pas de `try/catch`** sauf si une exception est réellement possible et doit être traitée différemment.
- **Pas de tests de conditions impossibles** : faire confiance au code interne et aux garanties du framework.
- **Pas de commentaires** sauf si le WHY est non-évident (contrainte cachée, invariant subtil).
- **Pas d'abstraction prématurée** : résoudre le problème posé, pas des cas hypothétiques futurs.
- **Pas de feature flags** ni shims de compatibilité : changer le code directement.

### Règle DOM

Pour toute manipulation du DOM ou gestion d'événements, utiliser **en priorité** l'API `dom.ts` et des styles CSS. Éviter `document.createElement`, `innerHTML` et `addEventListener` directs, sauf si l'API ne couvre pas le cas.

## Git

- Les messages de commit doivent obligatoirement être en anglais.
- Ne jamais committer sans demande explicite de l'utilisateur.
- Committer sur `master`, sauf demande contraire : ne jamais créer de branche de sa propre initiative. Si la branche courante n'est pas `master`, le signaler avant de committer.
