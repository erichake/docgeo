# Feuille de route du lecteur DGPad Pro

## Objectif actuel

DGPad Pro doit d'abord devenir un **lecteur interactif de fichiers `.dgp`** :

- ouvrir fidèlement des constructions produites par DGPad ;
- calculer leur graphe géométrique ;
- restituer leur apparence et leur visibilité ;
- permettre le déplacement des objets déjà mobiles ;
- rester robuste et fluide sur des figures contenant plusieurs milliers
  d'objets.

Le développement des outils de création, des barres d'outils de construction,
de l'édition de la figure et de l'export est volontairement reporté. Ces travaux
ne commenceront qu'après validation des critères définis à la fin de ce document.

## Principes à préserver

- Les coordonnées mathématiques sont nativement 3D ; la 2D correspond
  généralement au plan `z = 0`.
- Géométrie, projection et rendu restent trois étapes distinctes.
- Le format `.dgp` est analysé comme un format déclaratif contrôlé. Son contenu
  n'est jamais exécuté directement comme du JavaScript.
- Les relations de dépendance entre objets sont explicites.
- Seuls les objets ayant besoin d'être affichés doivent occuper le DOM. Un objet
  auxiliaire masqué peut exister uniquement dans le modèle géométrique.
- Les éléments SVG visibles sont persistants et mis à jour plutôt que recréés à
  chaque image.
- La fidélité avec DGPad est mesurée sur de vraies figures, pas seulement sur des
  exemples synthétiques.

## Socle technique déjà réalisé

La première revue du prototype a conduit aux améliorations suivantes :

- robustesse des vecteurs, tolérances géométriques et états indéfinis ;
- distinction entre validité géométrique et validité de projection ;
- intersections de droites 3D respectant segments et demi-droites ;
- cycle de vie cohérent des objets et de leurs vues SVG ;
- groupes SVG persistants par calque et zones de capture dédiées ;
- Pointer Events et conversion correcte des coordonnées écran/SVG ;
- graphe de dépendances direct et invalidation regroupée par
  `requestAnimationFrame` ;
- séparation `computeGeometry()`, `project()` et `render()` ;
- factories typées et registre explicite des intersections ;
- infrastructure DOM encapsulée et gestion du redimensionnement ;
- tests unitaires, tests navigateur et commande `npm run check`.

Ce socle est désormais au service de la compatibilité `.dgp`. Les anciennes
priorités sont terminées et ne constituent plus la feuille de route active.

## Priorité 1 — Définir et importer le format `.dgp`

### Inventorier le format réellement utilisé

- Constituer un corpus progressif de figures DGPad, des plus simples aux plus
  complexes.
- Recenser les sections, commandes, constructeurs, styles et variantes présents
  dans ce corpus.
- Documenter le sous-ensemble compris par DGPad Pro et les commandes encore non
  prises en charge.

### Écrire un analyseur dédié

- Lire les appels autorisés sans utiliser `eval()`, `Function()` ni l'injection
  d'un `<script>`.
- Reconnaître au minimum les sections de coordonnées, de géométrie et de styles.
- Produire des valeurs typées pour les nombres, booléens, chaînes, identifiants
  et références à des objets antérieurs.
- Préserver les noms DGPad, y compris les caractères non ASCII.
- Signaler précisément la première commande non prise en charge.

### Construire la figure importée

- Résoudre les références dans l'ordre du fichier.
- Associer chaque constructeur `.dgp` à une factory TypeScript explicite.
- Appliquer les styles après la création de la géométrie.
- Supprimer la construction de démonstration actuellement déclenchée par un clic
  dans la scène.

## Priorité 2 — Étendre la compatibilité géométrique

### Mettre en place un registre de constructeurs

- Associer chaque nom de constructeur `.dgp` à une fonction typée.
- Centraliser la vérification du nombre et du type des arguments issus du fichier.
- Garder les classes géométriques indépendantes de la syntaxe du format importé.

### Implémenter les familles nécessaires au corpus

L'ordre est déterminé par les figures à ouvrir, et non par les futurs outils de
construction. Le fichier `Apollonius.dgp` requiert notamment :

- `Point`, `PointOn`, `MidPoint` et `Center` ;
- `Line`, `Segment`, `Ray`, `Parallel`, `Perpendicular` et
  `PerpendicularBisector` ;
- `Circle`, `Circle1`, `Circle3` et `Circle3pts` ;
- les intersections droite/droite, droite/cercle et cercle/cercle, avec leur
  variante `OrderedIntersection` ;
- `Symmetry` et `Reflection`.

Chaque nouvel objet doit disposer de tests sur son calcul, ses dégénérescences,
sa projection et son rendu visible.

### Respecter les branches géométriques de DGPad

- Identifier la sémantique exacte de `OrderedIntersection`.
- Conserver le choix d'une intersection pendant le déplacement lorsque les deux
  solutions se rapprochent, se confondent ou réapparaissent.
- Vérifier les comportements limites par comparaison avec DGPad.

## Priorité 3 — Reproduire styles et affichage

### Décoder les styles `.dgp`

- Prendre en charge `STL()` et ses propriétés utilisées par le corpus : couleur,
  opacité, épaisseur, taille, remplissage et visibilité.
- Prendre en charge `SetCoords()`, `SetCoordsStyle()` et `SetGeneralStyle()`.
- Respecter l'ordre des calques et les règles de sélection.

### Décorréler visibilité et existence de la vue

- Autoriser un objet de construction à ne posséder aucune vue SVG.
- Ne pas créer de nœud SVG pour un objet importé avec `h:1` ou `h:2`.
- Créer ou supprimer la vue uniquement si un changement de style rend l'objet
  visible ou masqué.
- Continuer à calculer les objets masqués nécessaires à leurs descendants.

### Vérifier la fidélité visuelle

- Comparer des captures DGPad et DGPad Pro avec les mêmes dimensions et
  coordonnées.
- Tester séparément formes, épaisseurs, opacités, couleurs et objets indéfinis.

## Priorité 4 — Manipulation dans le lecteur

- Permettre uniquement le déplacement des objets déclarés mobiles par la figure.
- Respecter les contraintes des points liés à une droite, un segment, une
  demi-droite ou un cercle.
- Conserver les gestes de navigation nécessaires : déplacement de la scène, zoom
  et rotation 3D lorsque la figure l'autorise.
- Empêcher qu'un geste de consultation crée ou supprime un objet géométrique.
- Maintenir la branche des intersections et la continuité visuelle pendant un
  déplacement.

## Priorité 5 — Robustesse d'une construction complète

- Propager proprement l'état indéfini à travers toutes les nouvelles familles
  d'objets.
- Faire réapparaître automatiquement les descendants lorsque leur géométrie
  redevient définie.
- Garantir qu'aucune valeur `NaN` ou infinie n'atteint le SVG.
- Vérifier les cas tangents, confondus, parallèles, colinéaires et de rayon nul.
- Valider ou remplacer l'hypothèse actuelle selon laquelle l'ordre du fichier est
  toujours un ordre topologique du graphe.

## Priorité 6 — Performance sur les figures complexes

### Construire des mesures reproductibles

- Mesurer séparément le chargement, le calcul initial, la projection, le rendu et
  le déplacement d'un objet.
- Compter les objets recalculés, les nœuds SVG créés et les écritures DOM par
  image.
- Enregistrer le matériel, le navigateur et les dimensions de la scène avec les
  résultats.

### Utiliser `Apollonius.dgp` comme cible majeure

Cette figure contient actuellement :

- 2 569 objets géométriques ;
- 2 531 objets masqués ;
- 38 objets visibles, soit 3 points, 3 cercles initiaux et 32 `Circle3pts` ;
- 1 190 `OrderedIntersection`.

Son ouverture correcte ne suffira pas : le déplacement de chacun des trois
points libres devra rester fluide et ne provoquer ni fuite de nœuds DOM ni
accumulation d'écouteurs.

### Optimiser à partir des profils

- Éviter toute projection ou écriture SVG pour les objets sans vue.
- Recalculer uniquement la partie invalide du graphe, sauf lorsqu'un point racine
  affecte réellement toute la construction.
- Réduire les allocations temporaires dans les opérations géométriques chaudes si
  leur coût est confirmé par les mesures.
- Ne modifier l'architecture de rendu qu'à partir d'un goulot d'étranglement
  mesuré.

## Priorité 7 — Tests de compatibilité et corpus

- Ajouter une figure minimale par commande `.dgp` prise en charge.
- Ajouter des tests d'import vérifiant noms, types, dépendances, styles et
  visibilité.
- Ajouter des tests navigateur de déplacement sur les figures importées.
- Conserver des cas de dégénérescence reproductibles.
- Maintenir une matrice indiquant, pour chaque fichier du corpus, s'il est analysé,
  construit, affiché et manipulable.
- Ajouter un test de non-régression de performance distinct des tests fonctionnels
  ordinaires.

## Jalons

### Jalon 1 — Premier fichier importé

Un fichier `.dgp` minimal contenant points, droites, segments et intersections
s'ouvre sans adaptation manuelle et reste manipulable.

### Jalon 2 — Géométrie plane courante

Le lecteur prend en charge les objets usuels 2D, leurs styles et leurs principales
dégénérescences sur un corpus représentatif.

### Jalon 3 — Cercles d'Apollonius

`Apollonius.dgp` est analysé entièrement, restitue la figure attendue et permet de
déplacer ses trois points libres avec fluidité.

### Jalon 4 — Lecteur robuste

Un corpus varié de grandes constructions DGPad s'ouvre et se manipule sans erreur,
avec des performances mesurées et sans croissance anormale du DOM ou de la
mémoire.

## Conditions avant de développer les outils de création

Les outils restent hors périmètre tant que les conditions suivantes ne sont pas
toutes remplies :

- le format pris en charge est analysé sans exécution de code arbitraire ;
- les figures représentatives s'ouvrent sans modification manuelle ;
- géométrie, styles, visibilité et interactions sont fidèles à DGPad ;
- les cas dégénérés ne corrompent ni le graphe ni le SVG ;
- les grandes constructions restent manipulables avec une fluidité mesurée ;
- les régressions fonctionnelles et de performance sont couvertes par des tests.

Ce n'est qu'après validation de ce socle qu'une nouvelle feuille de route pourra
être consacrée aux outils de construction et à l'édition.

## Ordre de travail immédiat

1. Documenter la grammaire rencontrée dans un premier corpus `.dgp`.
2. Écrire l'analyseur sûr et importer une figure minimale.
3. Ajouter les constructeurs géométriques selon les besoins du corpus.
4. Rendre la vue SVG optionnelle pour les objets masqués.
5. Étendre progressivement l'import jusqu'à `Apollonius.dgp`.
6. Mesurer puis optimiser son chargement et sa manipulation.
