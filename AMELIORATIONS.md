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

### [ ] Sécuriser la normalisation des vecteurs

**Constat**

`vNormalize()` divise toujours par la norme. Deux points confondus produisent donc
un vecteur contenant des `NaN`.

**Piste**

- Ajouter une normalisation sûre, par exemple :

    ```ts
    function vNormalizeSafe(v: Vec3, epsilon = 1e-12): Vec3 | null;
    ```

- Décider si un vecteur nul doit être représenté par `null`, par un état de
  validité sur l'objet, ou par un type dédié.
- Éviter de transmettre des coordonnées non finies au SVG.

**Critères de validation**

- Deux points confondus ne provoquent ni exception ni attribut SVG contenant
  `NaN` ou `Infinity`.
- Une droite dégénérée possède un état défini et un rendu cohérent, par exemple
  masqué.

### [ ] Distinguer dégénérescence géométrique et dégénérescence de projection

**Constat**

Une droite 3D valide peut être parallèle à la direction de vue et se projeter en
un point. `primitive_line_object.compute()` vérifie actuellement le vecteur 3D,
mais normalise ensuite le vecteur projeté sans vérifier qu'il est non nul.

**Piste**

- Vérifier séparément la validité du vecteur géométrique et celle de sa projection.
- Définir le rendu d'une droite regardée « de face » : masquée, réduite à un point,
  ou représentée par un symbole spécifique.

**Critère de validation**

- Orienter la caméra dans l'axe d'une droite ne produit aucune valeur non finie.

### [ ] Remplacer et sécuriser `construction.bidon()`

**Constat**

Cette méthode reconstruit les coordonnées d'un point déplacé sur le plan
`z = constante`. Son déterminant devient nul lorsque `sin(THETA) = 0`, position
actuellement autorisée par la caméra.

**Piste**

- Renommer la méthode, par exemple `screenToPlane()` ou `unprojectToPlane()`.
- Lui donner explicitement le plan de déplacement.
- Tester le déterminant avec une tolérance et renvoyer `Vec3 | null` si
  l'inversion est impossible.
- À terme, modéliser le déplacement comme l'intersection d'un rayon de vue avec
  un plan de travail.

**Critères de validation**

- Un point reste déplaçable pour toutes les orientations autorisées où la
  projection est inversible.
- Une orientation singulière est gérée sans division par zéro.

### [ ] Formaliser la validité des objets

**Constat**

Plusieurs situations sont mathématiquement indéfinies : droite définie par deux
points confondus, intersection de droites parallèles, droites gauches, etc.

**Piste**

- Ajouter un état tel que `valid`, `defined` ou un résultat typé.
- Centraliser les tests `Number.isFinite()` avant projection et rendu.
- Masquer proprement les objets indéfinis tout en les conservant dans le graphe de
  construction pour qu'ils puissent redevenir valides.

### [ ] Terminer les contraintes de segment et de demi-droite

**Constat**

`InsideBounds()` existe sur les droites primitives, mais n'est pas encore
surchargée par `segment_object` et `ray_line_object`. Une intersection impliquant
un segment utilise donc actuellement sa droite support.

**Piste**

- Implémenter les bornes à partir du paramètre de la droite.
- Faire vérifier ces bornes par les algorithmes d'intersection.
- Définir une tolérance numérique adaptée à l'échelle de la construction.

## Priorité 2 — Cycle de vie des objets et du SVG

### [ ] Implémenter une vraie suppression d'objet

**Constat**

`point_object.mouseclick()` appelle `removeSVG()`, mais laisse le point dans le
collecteur, le dictionnaire de noms et le graphe de dépendances. Un rendu ultérieur
peut alors accéder à `dom === null`.

**Piste**

- Retirer ce comportement de démonstration ou créer
  `construction.removeObject(object)`.
- Lors d'une suppression, traiter explicitement :
    - les parents et enfants ;
    - `objects_collector.V`, `D` et `O` ;
    - le DOM et ses événements ;
    - la stratégie concernant les objets descendants.

**Critère de validation**

- Après suppression, une rotation, un recalcul et un nouveau tri ne provoquent
  aucune erreur.

### [ ] Unifier la création et le montage des éléments SVG

**Constat**

La grille ajoute elle-même son élément au SVG, tandis que les autres objets
attendent `orderAndDrawAll()`. Une recréation via `createSVG()` ne garantit pas que
le nouveau nœud soit remonté dans le document.

**Piste**

Adopter un cycle unique :

```text
création du modèle
→ ajout à la construction
→ création et montage de la vue SVG
→ calcul géométrique
→ projection
→ rendu
→ destruction complète éventuelle
```

- Choisir un seul responsable du montage : l'objet, le collecteur ou un renderer.
- Éliminer les assertions `dom!` là où l'invariant n'est pas garanti.
- Utiliser les coordonnées écran `sx/sy`, et non `x/y`, pour la position SVG
  initiale d'un point.

### [ ] Initialiser réellement la scène

**Constat**

La grille crée ses chemins, mais la construction ne lance pas immédiatement un
cycle `compute/draw`. La scène initiale peut donc rester vide jusqu'à la première
interaction.

**Piste**

- Déclencher explicitement l'initialisation une fois les dimensions connues.
- Clarifier si `grid_object` représente une grille complète ou seulement le repère.
- Supprimer ou utiliser le chemin `OY`, actuellement créé mais non dessiné.

### [ ] Utiliser des groupes SVG pour les calques

**Constat**

`orderAndDrawAll()` retire et réinsère tous les nœuds pour appliquer l'ordre des
calques.

**Piste**

Créer des groupes persistants, par exemple :

```svg
<g data-layer="grid"></g>
<g data-layer="lines"></g>
<g data-layer="points"></g>
<g data-layer="labels"></g>
```

Chaque objet serait monté directement dans son groupe. Il resterait possible de
gérer un ordre relatif à l'intérieur d'un calque.

### [ ] Évaluer l'emploi de `<g>` pour les points

**Constat**

Chaque point est actuellement un élément `<svg>` imbriqué avec
`overflow: visible`. Cette structure est valide, mais plus complexe que nécessaire
si aucun viewport local n'est recherché.

**Piste**

Utiliser éventuellement :

```svg
<g transform="translate(x y)">
  <circle cx="0" cy="0" r="6"></circle>
</g>
```

Le groupe pourrait contenir la forme, la zone de capture, le nom et les futures
décorations. Ce changement doit être guidé par une mesure ou par un besoin de
simplification, pas seulement par principe.

## Priorité 3 — Interactions

### [x] Remplacer les événements souris/tactiles par les Pointer Events

**Constat**

Le code maintient deux chemins séparés pour souris et tactile. La recherche du
toucher actif ne compare pas réellement son identifiant, l'identifiant `0` est
traité comme faux et l'état est difficile à réinitialiser correctement.

**Piste**

- Utiliser `pointerdown`, `pointermove`, `pointerup` et `pointercancel`.
- Utiliser `setPointerCapture(event.pointerId)` pendant un déplacement.
- Conserver un seul état d'interaction actif au niveau de la construction.
- Prévoir explicitement le cas de plusieurs pointeurs si les gestes multitouch
  deviennent nécessaires.

**Réalisé**

La couche DOM utilise maintenant les Pointer Events, suit un `pointerId`, traite
`pointercancel` et capture le pointeur pendant un déplacement.

### [x] Éviter les écouteurs globaux installés par chaque objet

**Constat**

Chaque objet déplaçable installe ses propres écouteurs `mousemove` et `mouseup` sur
`window`. Le coût d'un mouvement de souris augmente donc avec le nombre d'objets,
même lorsqu'un seul objet est manipulé.

**Piste**

- Centraliser le déplacement dans un contrôleur d'interaction ; ou
- n'installer les écouteurs que pendant le déplacement actif ; ou
- s'appuyer sur la capture des Pointer Events.

**Critère de validation**

- Le nombre de gestionnaires globaux ne croît pas avec le nombre de points.

Les gestionnaires de déplacement sont désormais attachés à l'élément concerné et
ne sont actifs pour le mouvement que lorsque cet élément possède la capture du
pointeur.

### [ ] Créer de vraies zones de capture SVG

**Constat**

La préférence `touchsize` n'est pas encore utilisée. La zone interactive d'une
droite correspond seulement à l'épaisseur visible de son trait.

**Piste**

- Placer la forme visible et une forme de capture dans un même `<g>`.
- Pour une droite, ajouter un chemin transparent plus épais avec une configuration
  adaptée de `pointer-events`.
- Maintenir la taille visuelle et la tolérance de sélection comme deux notions
  indépendantes.

### [ ] Convertir les coordonnées de pointeur dans le repère SVG

**Constat**

Les déplacements utilisent directement `pageX/pageY`. Cela fonctionne avec une
page plein écran sans décalage, mais devient faux si le SVG est intégré, transformé
ou placé dans une page défilante.

**Piste**

- Convertir `clientX/clientY` à l'aide de la matrice écran du SVG
  (`getScreenCTM()`), ou définir une fonction centrale équivalente.

## Priorité 4 — Graphe de dépendances et recalcul

### [ ] Conserver les enfants directs plutôt que tous les descendants

**Constat**

`childs` contient aujourd'hui la fermeture transitive des dépendances. Cela rend le
nom trompeur, augmente la mémoire utilisée et complique l'ordre de recalcul.

Le tri par `childLength()` ne garantit pas un ordre topologique. Un objet dépendant
à la fois d'un ancêtre et d'un descendant peut être calculé trop tôt.

**Piste**

- Ne stocker que `parents` et `children` directs.
- Propager un marqueur `dirty` aux descendants.
- Recalculer les objets marqués dans l'ordre de `objects_collector.V`, tant que
  l'ordre de création garantit que les parents précèdent leurs enfants.
- Prévoir plus tard une véritable validation topologique pour la redéfinition des
  objets et la détection des cycles.

### [ ] Regrouper les mises à jour d'une interaction

**Piste**

- Une modification marque les objets concernés.
- Un unique cycle de mise à jour recalcule, projette et rend la scène.
- Si nécessaire, regrouper les mouvements rapides avec `requestAnimationFrame`.

Cela évitera plusieurs recalculs ou rendus du même objet lors d'une seule action.

## Priorité 5 — Séparer géométrie, projection et rendu

### [ ] Scinder les responsabilités actuellement regroupées dans `compute()`

**Constat**

Une rotation de la caméra appelle `OBJS.compute()`, alors que les coordonnées
géométriques n'ont pas changé. Avec des objets plus coûteux, cela recalculera
inutilement toute la construction.

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

Les getters de coordonnées renvoient des copies, tandis que certaines directions
peuvent partager la même référence, par exemple une parallèle qui affecte
directement `this.D.VEC` à `this.VEC`.

**Piste**

- Choisir entre vecteurs immuables et vecteurs mutables.
- Préférer `readonly` et les fonctions vectorielles pures si les performances le
  permettent.
- Copier explicitement un vecteur lorsque le partage de référence n'est pas voulu.

## Priorité 7 — Infrastructure DOM et affichage

### [x] Encapsuler les helpers DOM sans modifier les éléments natifs

**Constat**

`customize()` ajoute des méthodes aux objets DOM et remplace des noms natifs comme
`remove()` et `append()`. Cette approche permet une syntaxe compacte, mais présente
des risques de collision et rend les types difficiles à maintenir.

**Piste**

- Créer un petit wrapper chaînable autour d'un `Element` ; ou
- employer quelques fonctions utilitaires sans modifier l'élément ; ou
- utiliser directement les API DOM lorsque cela reste lisible.

**Réalisé**

`DOMElement` enveloppe maintenant les éléments natifs. Il possède ses écouteurs et
leur nettoyage sans ajouter ni remplacer de méthodes sur `Element`.

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

### [ ] Ajouter des contrôles automatiques simples

- Conserver `tsc --noEmit` dans le build.
- Ajouter un formateur et, si utile, un linter léger.
- Faire échouer les tests lorsqu'une coordonnée non finie atteint la couche de
  projection ou de rendu.

## Ordre de travail suggéré

Pour avancer par petites étapes sans réécrire tout le prototype :

1. Ajouter les tests du module vectoriel et sécuriser les vecteurs nuls.
2. Sécuriser la projection et remplacer `bidon()`.
3. Formaliser l'état valide ou indéfini des objets.
4. Corriger la suppression et unifier le montage SVG.
5. Passer aux Pointer Events et aux zones de capture.
6. Corriger l'invalidation et l'ordre du graphe de dépendances.
7. Ajouter le redimensionnement.
8. Séparer progressivement calcul géométrique, projection et rendu.
9. Revoir ensuite les factories, le helper DOM et l'organisation des calques.

Chaque étape devrait rester suffisamment petite pour être compilée, testée et
validée visuellement avant de passer à la suivante.
