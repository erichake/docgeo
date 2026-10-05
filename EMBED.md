# Mode intégré de DocGeo

DocGeo peut être intégré dans une page hôte, dans une iframe, et piloté par un
protocole `postMessage`. La page hôte fournit la figure, lit ce que l'élève en
a fait et l'enregistre. Rien de ce protocole ne dépend d'une application hôte
particulière.

## Activation

```html
<iframe
    src="apps/docgeo/index.html?embed"
    style="width: 400px; height: 400px; border: 0"
></iframe>
```

En mode intégré :

- DocGeo n'affiche ni sélecteur de fichier ni avis d'import : l'hôte fournit
  la figure (requête `load`) et affiche lui-même les éléments non importés ;
- Cmd-S / Ctrl-S est sans effet (c'est l'hôte qui enregistre, requête `save`) ;
- la figure occupe toute la fenêtre de l'iframe ;
- un `.dgo` chargé est centré : la région enregistrée (`v.w` × `v.h`, voir
  `DGO.md`) est placée au centre de la fenêtre, au pixel près. Dans une iframe
  de la taille de cette région, la figure apparaît donc exactement comme elle
  a été enregistrée ;
- une figure chargée dans une fenêtre de largeur ou de hauteur nulle (iframe
  dont un ancêtre est en `display: none`) est placée au premier
  redimensionnement de la fenêtre vers une taille non nulle, exactement comme
  si `load` avait eu lieu à ce moment-là, avec ce qu'y ont changé les
  requêtes reçues entre-temps (`setState`, `lock`, `setHidden`) ; `reset` et
  `setState` donnent ensuite ce même placement.

## Messages

Tous les messages sont des objets portant `docgeo: 1`, la version du
protocole. Une évolution incompatible changerait ce numéro.

- **Requête** de l'hôte : `{ docgeo: 1, id, type, ...paramètres }`.
  `id` est libre (nombre ou chaîne) et renvoyé tel quel.
- **Réponse** : `{ docgeo: 1, id, ok: true, result }` ou
  `{ docgeo: 1, id, ok: false, error }`, `error` étant un message en anglais.
- **Événement** spontané : `{ docgeo: 1, event, ... }`.

DocGeo n'accepte que les messages dont la source est sa fenêtre parente
(`event.source === window.parent`) et ignore tout autre message. Il répond à
`window.parent` avec `targetOrigin` `"*"`. L'hôte doit vérifier que les
réponses viennent de son iframe : `event.source === iframe.contentWindow`.

Les requêtes sont traitées une à une, dans l'ordre d'arrivée : l'hôte peut
envoyer `load` puis `frame` sans attendre la première réponse. Les
`ArrayBuffer` sont transférés, pas copiés, dans les deux sens : un
`ArrayBuffer` passé dans la liste de transfert n'est plus utilisable par
l'expéditeur.

## Événements

| `event`  | Quand                                                                                                                                                                                                           | Données    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `ready`  | l'application est prête à recevoir des requêtes (aucune figure encore)                                                                                                                                          | —          |
| `change` | à la fin d'une manipulation qui a changé l'état (relâchement d'un point, d'un curseur ou d'un cercle, case cochée, nombre saisi), jamais pendant le glisser ; pas après `load`, `setState`, `reset` ou `rebase` | —          |
| `frame`  | le cadre a été déplacé ou redimensionné (fin du glisser), ou réduit pour tenir dans une fenêtre devenue plus petite                                                                                             | `{ w, h }` |

Après un `change`, l'hôte lit l'état ou la valeur voulue par une requête.

## Requêtes

| `type`      | Paramètres                                               | `result`                                                                      |
| ----------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `load`      | `data` (`ArrayBuffer`), `format` (`dgo`, `dgp` ou `ggb`) | `{ unsupported: string[] }` : la figure chargée devient la **figure de base** |
| `save`      | —                                                        | `{ data: ArrayBuffer }` : le `.dgo` de la figure courante                     |
| `targets`   | —                                                        | `[{ name, kind: "point" \| "expression", hidden, movable }]`                  |
| `value`     | `name`                                                   | valeur de l'objet                                                             |
| `getState`  | —                                                        | état courant                                                                  |
| `setState`  | `state`                                                  | `null` : repart de la figure de base, puis applique l'état                    |
| `reset`     | —                                                        | `null` : revient à la figure de base                                          |
| `rebase`    | —                                                        | `null` : la figure courante devient la figure de base, vue exceptée           |
| `lock`      | `except` (tableau de noms)                               | `null` : seuls les objets `movable` nommés restent manipulables               |
| `setHidden` | `name`, `hidden` (booléen)                               | `null` : cache ou montre le point ou l'expression, figure de base comprise    |
| `frame`     | `show` (booléen), `w`, `h` (entiers, pixels)             | `null` : affiche ou masque le cadre                                           |

### `load`

Remplace la figure courante. `.dgp` et `.ggb` sont importés, `.dgo` est lu
(gzip ou JSON clair). `unsupported` liste les éléments non importés, qui sont
perdus (toujours vide pour un `.dgo`). Un fichier malformé est refusé
(`ok: false`) : il ne reste alors aucune figure.

Une figure importée (`.dgp`, `.ggb`) est aussitôt remplacée par sa traduction
`.dgo` : la figure affichée est exactement celle que `save` enregistrerait,
et celle que `reset` et `setState` reconstruisent.

### `save`

Le `.dgo` de la figure **dans son état courant** (points déplacés, curseurs,
vue), sans modifier la figure de base. Quand le cadre est affiché, la vue
enregistrée est celle du cadre : `v.w` × `v.h` est la taille du cadre, et
l'origine et les positions en pixels sont recalées pour qu'une fenêtre de
cette taille montre exactement ce qu'il y avait dans le cadre, en 2D comme en
3D.

### `targets` et `value`

`targets` liste tous les points et toutes les expressions de la figure, cachés
compris, dans l'ordre de construction. `hidden` vaut `true` pour un objet
caché ou super-caché. `movable` vaut `true` quand une manipulation peut
changer la valeur de l'objet : point libre (punaisé compris), point sur objet,
expression de valeur constante (curseur, case à cocher, nombre que modifie un
champ de saisie ou le glisser d'un point `Fp`). Ce sont les objets de l'état
(`DGO.md`, « État élève »), hors numéros de branche des intersections, qui ne
se manipulent pas directement, et hors rayons des cercles `C1`, qui ne sont
ni des points ni des expressions. Un point construit (un orthocentre, par
exemple) n'est pas `movable`.

`value` renvoie :

- pour un point, `[x, y]` dans une figure plane et `[x, y, z]` dans une
  figure 3D (selon la figure, pas selon le point), dans la vue courante :
  pour un point punaisé, elles diffèrent donc de celles de l'état, prises
  dans la vue de base, dès que la vue a changé ;
- pour une expression, son nombre (0 ou 1 pour une case à cocher), ou ses
  nombres (`[re, im]` pour un complexe, coordonnées d'un vecteur) ;
- `null` pour un objet non défini, un nombre non fini ou une valeur non
  numérique (texte, liste).

Un nom qui ne désigne ni un point ni une expression est refusé.

### `getState`, `setState` et `reset`

L'état est décrit dans `DGO.md` (section « État élève ») :

```json
{ "M": [2.1, -0.4], "N": 0.35, "k": 31, "cb": 1 }
```

- `getState` renvoie les valeurs des objets modifiables qui diffèrent de la
  figure de base : points, expressions, numéros de branche des intersections
  et rayons des cercles `C1` de rayon numérique (celui qu'un glisser du
  cercle change), sous leur nom. Un point punaisé y figure par ses
  coordonnées dans la vue de base. Toute modification qu'une manipulation peut
  faire à la figure, hors vue et traces, s'y retrouve. État vide : figure non
  manipulée. La vue (zoom,
  déplacement, rotation 3D) n'en fait pas partie.
- `setState` reconstruit la figure de base avec ces valeurs, vue de base
  comprise. `setState(getState())` sur la figure de base reproduit la figure
  à l'identique, traces exceptées. Un état malformé (nom inconnu, objet non
  modifiable, valeur de forme incorrecte) est refusé en entier : la figure
  n'est pas modifiée.
- `reset` reconstruit la figure de base, vue comprise (bouton « recharger »).

### `rebase`

`rebase` fait de la figure courante la figure de base : les valeurs des
objets de l'état (points libres et punaisés, points sur objet, expressions
constantes, numéros de branche, rayons des cercles `C1`) deviennent celles de
la figure de base. Il sert à tirer une variante d'une figure : l'hôte applique
l'état de la variante par `setState`, puis `rebase`, et la variante se
comporte ensuite exactement comme une figure chargée :

- `getState` renvoie les différences avec la nouvelle base (état vide juste
  après `rebase`) ;
- `reset` revient à la nouvelle base ;
- `setState` repart de la nouvelle base, puis applique l'état, dont les
  valeurs remplacent celles de la base ;
- `value`, `targets` et `save` sont inchangés.

La vue de base n'est pas modifiée : un zoom ou un déplacement de la vue
courante n'entre pas dans la nouvelle base, et un point punaisé y garde ses
coordonnées dans la vue de base. Le verrouillage n'est pas modifié, aucun
`change` n'est émis. Plusieurs `rebase` se cumulent ; `load` remet la base
au fichier chargé.

### `lock`

`lock { except: [...] }` verrouille la **position des objets libres et
semi-libres** : les points libres et les points sur objet ne peuvent plus être
déplacés par l'utilisateur, sauf ceux nommés dans `except`. Ce qui change un
nombre reste toujours manipulable : curseurs, cases à cocher, champs de
saisie, panneaux, points `Fp` et rayons des cercles `C1`. Un objet verrouillé ne prend plus le pointeur, comme un point fixe : le glisser
commencé dessus agit sur ce qui se trouve dessous.

- Le zoom, la rotation 3D et le déplacement de la vue au bouton droit restent
  possibles, mais le glisser dans une zone vide d'une figure 2D (bouton gauche
  de la souris ou doigt) ne déplace plus la vue.
- `getState`, `setState`, `value`, `save` et `reset` fonctionnent comme sans
  verrouillage : `setState` peut notamment donner une valeur à un objet
  verrouillé. Aucun `change` n'est émis par `lock`.
- Le verrouillage survit à `reset`, à `setState` et à `rebase`. Il est levé par `load` :
  l'hôte renvoie `lock` après chaque `load`.
- Un nouveau `lock` remplace le précédent. `except` nommant tous les points
  `movable` ne verrouille que le déplacement de la vue.
- Un nom qui ne désigne ni un point ni une expression refuse la requête en
  entier, sans changer le verrouillage en cours.

Le verrouillage ne modifie pas la figure : `save` n'en garde aucune trace.

### `setHidden`

`setHidden { name, hidden }` change la visibilité (style `h` de `DGO.md`) du
point ou de l'expression `name` : `hidden: true` le cache (inchangé s'il est
déjà caché ou super-caché), `hidden: false` le montre. La modification
s'applique à la figure courante et à la figure de base : elle survit à
`reset` et `setState`, `save` l'enregistre et `targets` la reflète. Elle ne
fait pas partie de l'état et n'émet pas de `change`.

### `frame`

`frame { show: true, w, h }` affiche par-dessus la figure un cadre façon
capture d'écran de `w` × `h` pixels, centré dans la fenêtre (réduit s'il ne
tient pas) :

- il se redimensionne par ses poignées (coins et milieux des côtés), et se
  déplace par le reste de ses bords ou par son étiquette, qui affiche ses
  dimensions ;
- l'extérieur est assombri, et la figure reste manipulable à l'intérieur comme
  à l'extérieur du cadre ;
- il reste dans la fenêtre, et mesure au moins 40 × 40 pixels.

`frame { show: false }` le masque. Le cadre est indépendant de la figure : il
reste affiché après un `load`.

Pour recadrer une figure déjà cadrée, l'hôte envoie `load` puis
`frame { show: true, w: v.w, h: v.h }` : figure et cadre étant centrés, le
cadre entoure exactement la région enregistrée.

### Erreurs

| `error`                          | Cause                                                         |
| -------------------------------- | ------------------------------------------------------------- |
| `Unknown request: …`             | `type` inconnu                                                |
| `Invalid request`                | paramètre absent ou de mauvais type                           |
| `No figure loaded`               | requête autre que `load` ou `frame` sans figure chargée       |
| `Invalid DGO file`, …            | fichier refusé par `load` (message du lecteur ou de l'import) |
| `No point or expression named …` | nom inconnu passé à `value`, `lock` ou `setHidden`            |
| `Invalid state`                  | état refusé par `setState`                                    |

## Affichage réduit

L'hôte peut réduire l'iframe par une transformation CSS
(`transform: scale(…)`) en lui gardant sa taille logique `w` × `h` : la
manipulation à la souris et au doigt reste exacte.

## Exemple

```js
const iframe = document.querySelector("iframe");
let id = 0;
const pending = new Map();

window.addEventListener("message", ({ source, data }) => {
    if (source !== iframe.contentWindow || data?.docgeo !== 1) return;
    if (data.event === "ready") start();
    else if (data.event === "change") onChange();
    else if (data.event === undefined) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        data.ok ? resolve(data.result) : reject(new Error(data.error));
    }
});

function request(type, parameters = {}, transfer = []) {
    return new Promise((resolve, reject) => {
        pending.set(++id, { resolve, reject });
        iframe.contentWindow.postMessage(
            { docgeo: 1, id, type, ...parameters },
            "*",
            transfer,
        );
    });
}

async function start() {
    const data = await (await fetch("figure.dgo")).arrayBuffer();
    await request("load", { data, format: "dgo" }, [data]);
    // A variant of the figure, which reset and getState then start from.
    await request("setState", { state: { B: [3, -2], k: 4 } });
    await request("rebase");
    // Only M can be moved.
    await request("lock", { except: ["M"] });
}

async function onChange() {
    const state = await request("getState");
    const value = await request("value", { name: "M" });
}
```
