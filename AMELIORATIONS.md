# Pistes d'amélioration de DGPad Pro

Ce document rassemble les améliorations identifiées lors de la première revue du
prototype. Il doit servir de feuille de route, pas de cahier des charges figé : les
points peuvent être traités indépendamment et réévalués à mesure que le moteur
s'enrichit.

## Principes à préserver

- Les objets géométriques possèdent des coordonnées mathématiques 3D natives.
- La 2D est un cas particulier de la 3D, généralement avec `z = 0`.
- La projection vers l'écran reste distincte des coordonnées mathématiques.
- Les objets sont représentés par des éléments SVG persistants, mis à jour plutôt
  que recréés à chaque image.
- Le projet reste léger et sans framework tant qu'un framework n'apporte pas de
  bénéfice concret.
- Les relations de dépendance entre objets restent explicites.

## Priorité 1 — Robustesse géométrique

### [x] Sécuriser la normalisation des vecteurs

**Réalisé**

- `vNormalize()` renvoie désormais `null` lorsque la norme est nulle ou non
  finie :

    ```ts
    function vNormalize<T extends readonly number[]>(v: T): T | null;
    ```

- `vNorm()` utilise `Math.hypot()` pour éviter les débordements intermédiaires.
- Les comparaisons géométriques partagent une tolérance absolue et relative.
- Deux points confondus rendent leur droite indéfinie et masquée, sans transmettre
  de valeur non finie au SVG.

### [x] Distinguer dégénérescence géométrique et dégénérescence de projection

**Réalisé**

- `defined` représente l'existence de la droite dans l'espace.
- `projectionDefined` représente l'existence de sa projection comme droite à
  l'écran.
- Une droite 3D regardée dans son axe reste géométriquement définie, mais son tracé
  SVG est masqué.

### [x] Sécuriser l'inversion écran-plan

**Réalisé**

- `construction.unprojectToZPlane(screen, z)` reçoit explicitement les coordonnées
  écran et la cote du plan de déplacement.
- Le déterminant est comparé à une tolérance tenant compte de l'échelle des axes.
- La méthode renvoie `null` lorsque la projection n'est pas inversible ; le point
  conserve alors sa dernière position valide.

### [x] Formaliser la validité des objets

**Réalisé**

- Tous les objets de construction possèdent un état `defined`.
- `isVisible` combine cet état avec le masquage demandé par l'utilisateur.
- Les points distinguent désormais leur validité géométrique `defined` de leur
  validité de projection `projectionDefined`.
- Un objet indéfini reste dans le graphe et redevient visible dès que ses parents
  permettent à nouveau son calcul.

### [x] Terminer les contraintes de segment et de demi-droite

**Réalisé**

- `insideBounds(parameter)` accepte tout paramètre pour une droite, l'intervalle
  du segment et les paramètres positifs pour une demi-droite.
- Les bornes utilisent la tolérance géométrique commune.
- L'intersection de deux supports est calculée en 3D, puis rejetée pour des droites
  parallèles, gauches ou lorsque le résultat est hors des bornes.

## Priorité 2 — Cycle de vie des objets et du SVG

### [x] Implémenter une vraie suppression d'objet

**Réalisé**

- `construction.removeObject(object)` supprime l'objet et tous ses descendants.
- Les références sont retirées des parents et enfants survivants.
- `objects_collector.remove()` met à jour la liste de construction et le
  dictionnaire des noms.
- `DOMElement.dispose()` retire le nœud SVG et libère ses écouteurs.
- Le clic de démonstration sur un point utilise désormais cette suppression
  complète.

### [x] Unifier la création et le montage des éléments SVG

**Réalisé**

`construction.add()` applique maintenant un cycle unique :

```text
création du modèle
→ ajout à la construction
→ création et montage de la vue SVG
→ calcul géométrique
→ projection
→ rendu
→ destruction complète éventuelle
```

- L'objet construit sa vue, tandis que la construction est seule responsable de
  son montage dans le bon calque.
- `createSVG()` remplace, remonte et redessine correctement une vue recréée.
- Les constructeurs d'objets ne créent et ne montent plus eux-mêmes leur SVG.
- `dom` est garanti après l'ajout à la construction ; les assertions `dom!` ont
  disparu.

### [x] Initialiser réellement la scène

**Réalisé**

- Chaque ajout exécute immédiatement `refresh()` ; le repère est donc calculé,
  projeté et visible dès la création de la construction.
- `grid_object` représente actuellement le repère formé par les trois axes, pas une
  grille complète.
- Le chemin `OY` inutilisé a été supprimé.

### [x] Utiliser des groupes SVG pour les calques

**Réalisé**

```svg
<g data-layer="1"></g>
<g data-layer="4"></g>
<g data-layer="5"></g>
```

- Les groupes sont créés une fois, dans l'ordre numérique défini par les
  préférences.
- Chaque objet est directement monté dans son groupe.
- `orderAndDrawAll()` et les retraits/réinsertions nécessaires à l'ancien tri ont
  été supprimés.
- La liste de rendu `D`, devenue identique à la liste de construction `V`, a été
  supprimée.

### [x] Employer `<g>` pour les points

**Réalisé**

Un point utilise désormais une forme centrée dans un groupe translaté :

```svg
<g transform="translate(x y)">
  <circle cx="0" cy="0" r="6"></circle>
</g>
```

- Le `<svg>` imbriqué et son viewport local ont disparu.
- Un déplacement modifie un seul attribut `transform`, au lieu de deux attributs
  `x` et `y`.
- Le groupe accueille désormais la zone de capture et pourra aussi recevoir le nom
  et les décorations du point.

## Priorité 3 — Interactions

### [x] Remplacer les événements souris/tactiles par les Pointer Events

**Réalisé**

- La couche DOM utilise `pointerdown`, `pointermove`, `pointerup` et
  `pointercancel`.
- Elle suit le `pointerId` actif et capture le pointeur pendant un déplacement.
- Souris, stylet et interaction tactile simple empruntent le même chemin.

### [x] Éviter les écouteurs globaux installés par chaque objet

**Réalisé**

- Les gestionnaires appartiennent au `DOMElement` concerné et sont supprimés par
  `dispose()`.
- Aucun couple d'écouteurs de déplacement n'est installé sur `window` pour chaque
  objet.
- Un élément ne traite le mouvement que lorsqu'il possède la capture du pointeur.

### [x] Créer de vraies zones de capture SVG

**Réalisé**

- Les droites utilisent un groupe contenant un chemin de capture transparent et
  un chemin visible qui partage la même géométrie.
- Les points possèdent un disque de capture transparent indépendant de leur forme.
- La préférence `touchsize` pilote les zones de capture, tandis que `size` reste
  réservée au dessin visible.
- Les formes visibles des droites ignorent les événements afin que leur épaisseur
  n'influence plus la tolérance de sélection.

### [x] Convertir les coordonnées de pointeur dans le repère SVG

**Réalisé**

- `DOMElement.svgPoint()` convertit `clientX/clientY` avec l'inverse de
  `getScreenCTM()`.
- Le déplacement des points utilise ces coordonnées SVG avant l'inversion vers le
  plan mathématique.
- Les gestes utilisent désormais les coordonnées client, indépendantes du
  défilement de la page.

## Priorité 4 — Graphe de dépendances et recalcul

### [x] Conserver les enfants directs plutôt que tous les descendants

**Réalisé**

- Chaque objet conserve uniquement ses `parents` et `children` directs.
- La fermeture transitive et le tri par nombre de descendants ont disparu.
- `objects_collector.markGeometryDirty()` propage l'invalidation dans le graphe
  direct.
- `objects_collector.update()` recalcule chaque objet marqué une seule fois dans
  l'ordre de construction, qui garantit actuellement que les parents précèdent
  leurs enfants.

Une validation topologique explicite restera nécessaire lorsque le projet
permettra de redéfinir les dépendances ou de créer des cycles.

### [x] Regrouper les mises à jour d'une interaction

**Réalisé**

- Le déplacement d'un point marque uniquement ce point et ses descendants.
- La rotation de la scène marque toute la construction.
- Un seul `requestAnimationFrame` regroupe les mouvements reçus avant le prochain
  rendu.
- Le cycle différé calcule et dessine chaque objet marqué une seule fois.

## Priorité 5 — Séparer géométrie, projection et rendu

### [x] Scinder les responsabilités actuellement regroupées dans `compute()`

**Réalisé**

Chaque objet suit maintenant le pipeline suivant :

```text
computeGeometry() → coordonnées et directions 3D
project(camera)   → coordonnées écran
render()          → attributs SVG
```

- `invalidateGeometry(object)` propage les trois étapes aux descendants.
- `invalidateProjection()` ne lance que la projection et le rendu de la scène ;
  une rotation ne recalcule donc plus la géométrie.
- `invalidateRender(object)` ne touche qu'au SVG de l'objet.
- Le collecteur fusionne ces niveaux d'invalidation et exécute uniquement les
  étapes nécessaires dans l'ordre de construction.

### [x] Décider jusqu'où séparer modèle et vue

**Décision actuelle**

- Les objets restent légers et conservent leur vue SVG associée.
- `computeGeometry()` et `project()` ne manipulent pas le DOM.
- `render()` est seul responsable des attributs SVG qui dépendent de l'état
  calculé.
- `createSVG()` reste responsable de la structure et du style initial de la vue.

Cette séparation pragmatique rend le calcul testable sans introduire dès maintenant
une seconde hiérarchie de classes de vues.

## Priorité 6 — API et typage TypeScript

### [x] Revoir les factories statiques `create()`

**Réalisé**

- Les factories sont sorties des classes et exportées comme fonctions nommées :
  `createPoint()`, `createMidpoint()`, `createLine()`, `createIntersection()`, etc.
- Elles ne sont donc plus héritées et peuvent avoir des paramètres propres à chaque
  type d'objet.
- `construction.add()` et `objects_collector.add()` sont génériques et conservent
  précisément le type de l'objet ajouté.
- Les deux `@ts-expect-error` ont disparu.

### [x] Remplacer la résolution dynamique des intersections

**Réalisé**

- Un registre explicite associe les clés `famille:famille` à des fonctions de
  calcul typées.
- La combinaison `line:line` pointe actuellement vers `computeLineLine()`.
- Une combinaison absente laisse simplement l'intersection dans l'état
  géométrique indéfini.
- L'affectation dynamique d'une méthode et sa conversion de type ont disparu.

### [x] Clarifier la mutabilité des vecteurs

**Décision actuelle**

- `Vec2` et `Vec3` sont des tuples `readonly`.
- Les opérations vectorielles sont pures et renvoient de nouveaux tuples.
- Leurs surcharges distinguent explicitement les résultats 2D et 3D sans conversion
  de type opaque.
- Les objets remplacent leurs vecteurs complets au lieu de modifier une composante
  partagée ; une parallèle peut donc réutiliser sans risque le vecteur immuable de
  sa droite source.

## Priorité 7 — Infrastructure DOM et affichage

### [x] Encapsuler les helpers DOM sans modifier les éléments natifs

**Réalisé**

- `DOMElement` enveloppe les éléments natifs sans modifier leur prototype.
- Le wrapper fournit les opérations chaînables utilisées par le projet.
- Il conserve ses écouteurs et sait les nettoyer avec `dispose()`.

### [x] Gérer le redimensionnement

**Réalisé**

- `DOMElement.observeResize()` encapsule `ResizeObserver` et le déconnecte lors du
  `dispose()`.
- La construction observe son SVG et replace l'origine au centre de ses nouvelles
  dimensions.
- Un redimensionnement invalide uniquement la projection et le rendu de la scène.
- `construction.dispose()` annule une frame en attente, détruit les objets et le
  SVG, puis retire la construction du registre global.

### [x] Décider du rôle futur du canvas

**Décision actuelle**

- Le canvas inutilisé a été supprimé.
- Le SVG porte désormais la couleur de fond et constitue l'unique surface
  d'affichage et d'interaction.
- Un canvas pourra être réintroduit plus tard si une fonctionnalité précise le
  justifie, par exemple des traces ou une couche raster coûteuse.

## Priorité 8 — Tests et outils de développement

### [x] Ajouter des tests unitaires mathématiques

**Réalisé**

- Vitest exécute sept tests unitaires sans navigateur.
- Les vecteurs couvrent normalisation, valeurs nulles ou non finies, grandes normes
  et opérations pures 2D/3D.
- La projection a été extraite dans `projection.ts` afin de tester directement la
  projection 3D, l'inversion écran-plan et les projections singulières.

### [x] Ajouter quelques tests d'intégration dans le navigateur

**Réalisé**

- Vitest Browser Mode et Playwright exécutent douze tests dans Chromium.
- Ils couvrent les droites dégénérées, les intersections sécantes, parallèles,
  confondues, gauches et hors bornes, ainsi que les perpendiculaires 2D/3D.
- Ils vérifient le recalcul des descendants, la suppression, la rotation de caméra
  sans recalcul géométrique et le redimensionnement par `ResizeObserver`.
- Souris, interaction tactile et stylet empruntent le même chemin Pointer Events.
- Une dégénérescence fait échouer le test si `NaN` ou `Infinity` atteint le SVG.

### [x] Compléter les contrôles automatiques

**Réalisé**

- `npm test` exécute les suites unitaires puis navigateur.
- `npm run format` applique Prettier et `npm run format:check` contrôle le format.
- `npm run check` enchaîne format, tests et build TypeScript/Vite.
- Le `tsconfig.json` contrôle également les tests et leurs configurations.
- Vite 8, Vitest 5 et leurs dépendances ont été audités sans vulnérabilité connue.

## Ordre de travail suggéré

Toutes les priorités de cette première revue sont réalisées : robustesse
géométrique, cycle de vie SVG, interactions, graphe de dépendances, séparation du
pipeline, typage, infrastructure d'affichage et tests automatisés.

Les prochaines étapes pourront désormais être définies par les nouvelles
fonctionnalités géométriques et par des mesures de performance sur de grandes
constructions.
