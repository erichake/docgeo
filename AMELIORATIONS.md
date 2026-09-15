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
- Les points vérifient leurs coordonnées avant projection et leur projection avant
  rendu.
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

- Chaque ajout se termine par `computeAndDraw()` ; le repère est donc visible dès
  la création de la construction.
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
- `objects_collector.markDirty()` propage l'invalidation dans le graphe direct.
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

### [ ] Scinder les responsabilités actuellement regroupées dans `compute()`

**Constat**

Une rotation de la caméra marque encore tous les objets pour un cycle complet de
calcul et de dessin, alors que leurs coordonnées géométriques n'ont pas changé.
Avec des objets plus coûteux, cela recalculera inutilement toute la construction.

**Piste**

Viser progressivement le pipeline suivant :

```text
computeGeometry() → coordonnées et directions 3D
project(camera)   → coordonnées écran
render()          → attributs SVG
```

- Une modification d'un parent déclenche les trois étapes nécessaires.
- Une rotation de caméra ne déclenche que `project()` et `render()`.
- Un changement de style ne déclenche que `render()`.

Cette séparation facilitera aussi les tests, l'export et de futurs renderers.

### [ ] Décider jusqu'où séparer modèle et vue

Il n'est pas nécessaire de construire immédiatement une architecture complexe.
Cependant, les objets géométriques devraient idéalement pouvoir être calculés et
testés sans DOM. Une vue SVG associée pourrait alors prendre en charge uniquement
la création des nœuds, les styles et les attributs graphiques.

## Priorité 6 — API et typage TypeScript

### [ ] Revoir les factories statiques `create()`

**Constat**

Les signatures de `midpoint_object.create()` et `intersection_object.create()` ne
sont pas compatibles avec celle héritée de `point_object`. Les
`@ts-expect-error` signalent cette tension.

**Piste**

- Sortir les factories de la hiérarchie ; ou
- leur donner des noms distincts ; ou
- utiliser un registre de constructeurs avec des paramètres typés.

L'objectif est de supprimer les `@ts-expect-error` sans perdre la simplicité de
création actuelle.

### [ ] Remplacer la résolution dynamique des intersections

**Constat**

`intersection_object` choisit l'algorithme avec une propriété calculée telle que
`line_line`. Cette technique est concise, mais difficile à typer et échoue tard si
une combinaison n'existe pas.

**Piste**

Utiliser un registre explicite, par exemple avec des clés `line:line`,
`line:circle` et `circle:circle`, et produire un résultat clairement défini pour
une combinaison non prise en charge.

### [ ] Clarifier la mutabilité des vecteurs

**Constat**

Les getters de coordonnées renvoient des copies et une parallèle copie maintenant
explicitement le vecteur de sa droite source. Il reste toutefois à choisir et à
documenter une politique générale pour les futurs objets.

**Piste**

- Choisir entre vecteurs immuables et vecteurs mutables.
- Préférer `readonly` et les fonctions vectorielles pures si les performances le
  permettent.
- Copier explicitement un vecteur lorsque le partage de référence n'est pas voulu.

## Priorité 7 — Infrastructure DOM et affichage

### [x] Encapsuler les helpers DOM sans modifier les éléments natifs

**Réalisé**

- `DOMElement` enveloppe les éléments natifs sans modifier leur prototype.
- Le wrapper fournit les opérations chaînables utilisées par le projet.
- Il conserve ses écouteurs et sait les nettoyer avec `dispose()`.

### [ ] Gérer le redimensionnement

**Constat**

L'origine du repère est calculée une fois à partir des dimensions initiales. Le
canvas reçoit une taille CSS, mais pas nécessairement une taille de buffer adaptée.

**Piste**

- Installer un `ResizeObserver` sur le conteneur.
- Recalculer l'origine, la projection et les éléments visibles après redimensionnement.
- Si le canvas est conservé, synchroniser ses attributs `width/height` avec sa
  taille CSS et le ratio de pixels du périphérique.

### [ ] Décider du rôle futur du canvas

Le canvas ne sert actuellement qu'à porter la couleur de fond, alors que le SVG
reçoit les objets et les événements. Deux options sont possibles :

- le supprimer provisoirement et placer le fond sur le SVG ou son conteneur ;
- le conserver avec un rôle documenté, par exemple pour les traces, une couche
  raster ou certains effets coûteux.

Il vaut mieux éviter que le canvas et le SVG soient tous deux responsables des
mêmes interactions.

## Priorité 8 — Tests et outils de développement

### [ ] Ajouter des tests unitaires mathématiques

Premiers cas recommandés :

- norme et normalisation d'un vecteur nul ;
- projection d'un point connu selon plusieurs orientations ;
- inversion écran-plan lorsque celle-ci est possible ;
- détection d'une projection singulière ;
- droite définie par deux points confondus ;
- intersection de droites sécantes, parallèles, confondues et gauches ;
- intersection située hors d'un segment ou derrière l'origine d'une demi-droite ;
- perpendiculaire dans le plan et dans l'espace.

Les tests du noyau mathématique devraient pouvoir fonctionner sans navigateur.

### [ ] Ajouter quelques tests d'intégration dans le navigateur

Cas recommandés :

- déplacer un point et vérifier ses descendants ;
- tourner la caméra sans modifier les coordonnées mathématiques ;
- supprimer un objet puis redessiner ;
- redimensionner la fenêtre ;
- utiliser souris, tactile et stylet via les Pointer Events ;
- vérifier qu'aucun attribut SVG ne contient `NaN` ou `Infinity`.

### [ ] Compléter les contrôles automatiques

Déjà en place :

- `tsc --noEmit` est exécuté par le build ;
- EditorConfig et Prettier définissent le format commun du projet.

Reste à faire :

- ajouter une commande de vérification du format et, si utile, un linter léger ;
- faire échouer les tests lorsqu'une coordonnée non finie atteint la couche de
  projection ou de rendu.

## Ordre de travail suggéré

Déjà réalisés : robustesse géométrique, cycle de vie des objets et du SVG, calques
persistants, Pointer Events, zones de capture, conversion des coordonnées écran,
graphe de dépendances direct, regroupement des mises à jour, suppression des
écouteurs globaux par objet, encapsulation DOM et configuration du formatage.

Pour poursuivre par petites étapes sans réécrire tout le prototype :

1. Séparer progressivement calcul géométrique, projection et rendu.
2. Gérer le redimensionnement et décider du rôle du canvas.
3. Revoir les factories, le registre d'intersections et la mutabilité des vecteurs.
4. Ajouter les tests automatisés et compléter les contrôles de développement.

Chaque étape devrait rester suffisamment petite pour être compilée, testée et
validée visuellement avant de passer à la suivante.
