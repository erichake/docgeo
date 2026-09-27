# Format .dgo — mémo de conception

Décisions prises avec l'auteur (conversation du 2026-09-27), avant tout code.

## Positionnement

- `.dgo` devient **le format natif de DocGeo** : seul format lu et écrit
  nativement. `.dgp` et `.ggb` ne sont plus que des **imports**.
- Première étape : version standalone. **Cmd-S / Ctrl-S** enregistre la figure
  courante en `.dgo` (bloquer l'enregistrement de page du navigateur,
  téléchargement via Blob — `showSaveFilePicker` n'existe que sous Chromium).
  Ouvrir un `.dgo` : ajouter l'extension au sélecteur et au choix du lecteur
  dans `src/main.ts` (`accept`, tests `/\.ggb$/i`).
- On enregistre la figure **dans son état courant** (points déplacés, curseurs,
  vue/zoom).
- Mettre à jour `AGENTS.md` : `.dgo` format natif, enregistrement `.dgo`
  autorisé (sans ouvrir la porte aux outils de création/édition).

## Cible DocEval (plus tard)

- L'import `.dgp`/`.ggb` a lieu **une seule fois, dans le navigateur du
  professeur**, au dépôt. **Le fichier d'origine n'est pas conservé** : seul le
  `.dgo` est stocké (colonne `longblob` MySQL/InnoDB, binaire brut — pas en
  base64 dans `options` comme l'actuel `dgpad_source`, qui coûte +33 %).
- Le serveur ne reçoit qu'un JSON compressé ; le lecteur `.dgo` doit résister
  à un fichier malformé (client non fiable), mais `JSON.parse` n'exécute rien.
- Les éléments non importés sont perdus définitivement : le signalement
  d'import doit être bien visible au dépôt.
- **État élève** = seulement la position finale des objets manipulables
  (points libres et semi-libres, valeurs de curseurs, etc.), en JSON clair
  séparé de la figure, indexé par nom : `{"P1":[2.1,-0.4],"Nx":31}`.

## Conteneur

- `.dgo = gzip(JSON UTF-8)` via `CompressionStream("gzip")` /
  `DecompressionStream("gzip")`. Pas de zip, pas de conteneur binaire.
- Toujours compressé, même sans image. Mesures sur les 72 `.dgp` de test :
  1,09 Mo → 193 Ko (17,6 %) ; < 1 Ko : 55–73 %, > 200 Ko : ~15 %.
- Images en data URL base64 dans une table `img` indexée par hash : après gzip
  le surcoût est de 0,3 % (mesuré sur l'image de `mandel.ggb`), et la data URL
  se met directement dans `<image href>`.
- Optionnel : accepter aussi un JSON non compressé en lecture (octets magiques
  `1f 8b`) pour des figures de test lisibles.

## Structure JSON (esquisse)

```json
{"dgo":1,
 "view":{"o":[-1.192,32.653],"u":75.915,"3d":1,"w":1143,"h":705},
 "st":[{"c":"#0000b2","s":6,"f":30,"fl":1}, {"c":"#0000b2","o":1,"s":4,"sn":1,"nmi":1}],
 "img":{"a3f…":"data:image/png;base64,…"},
 "o":[["Pt","P1",[5.245245850440365,-3.73243098432904],0],
      ["Pt","X",{"dir":[1,0,0]},1],
      ["Ex","f","sin(x*y)",[9.63,-2.2]],
      ["Seg","S11",[0,1]]]}
```

- Objets en tableaux positionnels, **dans l'ordre de construction** ;
  références aux parents **par indice** (toujours inférieur). Le nom est
  conservé (affichage, formules, état élève).
- **Styles** : seulement l'écart au défaut du type, dédupliqués dans `st`,
  référencés par indice.
- **Pas de valeurs calculées** (intersections, lieux, listes évaluées) ; ne
  stocker que ce qui lève une ambiguïté (branche d'intersection, paramètre
  d'un point sur objet). Le recalage GeoGebra est appliqué avant l'écriture :
  aucune donnée propre à GeoGebra dans le `.dgo`.
- Nombres JSON (pas de chaînes) ; écriture JS la plus courte pour les points
  libres ; positions d'écran arrondies au pixel.
- Formules : texte source du langage interprété en sandbox
  (`src/import/dgp_formula.ts`), jamais de JS exécuté.
- Tout ce que l'import déduit à la volée doit y être : vue, mode degrés,
  `segmentsOverPolygons`, etc. Tout ce que permettent les importers `.dgp` et
  `.ggb` doit être représentable.

## Règles d'évolution (format purement additif)

1. **Défauts figés dans la spécification `.dgo`**, indépendants de
   `preferences.ts` : changer un défaut changerait tous les anciens fichiers.
2. **Jamais de changement de sémantique** d'un type, d'un champ ou d'une
   fonction de formule : on ajoute un nouveau type ou champ dont le défaut
   reproduit l'ancien comportement.
3. **Numérotation stable des branches d'intersection**, définie par le format
   et non par l'algorithme de calcul.
4. **Noms uniques et stables** (clés de l'état élève) ; le lecteur ne renomme
   jamais.
5. Seule la rétrocompatibilité compte (le lecteur servi est toujours le plus
   récent). En développement, le format peut changer librement ; une fois
   diffusé, le lecteur doit ouvrir la v1 indéfiniment.
6. Une erreur d'import découverte après coup reste figée dans les `.dgo` déjà
   produits.

## Nettoyage à l'import

Profiter de la conversion pour corriger les défauts des fichiers sources, qui
seraient sinon figés. Exemple : `tests/dgp/_Apollonius.dgp` contient des noms
doublement encodés en UTF-8 (`"IntermÃ\u0083Â©diaire"`) —
redécoder tant que le résultat reste de l'UTF-8 valide n'utilisant que des
caractères < 256 ; l'appliquer aux noms, textes et formules.

## Travail à faire

1. Chaque type d'objet (`src/objects/*`) sait se décrire : type, parents,
   paramètres propres.
2. Écrivain `.dgo` à partir de la construction en mémoire (pas des commandes).
3. Lecteur `.dgo` reconstruisant directement les objets : deuxième porte
   d'entrée du moteur, à côté de `src/import/dgp_commands.ts`.
4. Cmd-S / Ctrl-S et ouverture `.dgo` dans la version standalone.
5. **Test d'aller-retour** sur toutes les figures de `tests/dgp` et
   `tests/ggb` : import → `.dgo` → réouverture → objets aux mêmes positions et
   rendu identique. Indispensable puisque l'original n'est pas conservé.
