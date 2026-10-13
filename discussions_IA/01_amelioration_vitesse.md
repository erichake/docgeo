# Amélioration de la vitesse du lecteur DocGeo

> Discussion du 13 octobre 2026 sur les performances du lecteur (`index.html`), à partir de la figure [MiraSansTortue.dgp](../tests/dgp/Yves_05/MiraSansTortue.dgp) (attracteur de Gumowski-Mira, 30 000 points calculés par un script).

**Sommaire**

1. [Où passe le temps ?](#1-où-passe-le-temps-)
2. [Affichage des longues listes et tracé des `List`](#2-affichage-des-longues-listes-et-tracé-des-list)
3. [D'autres figures profiteraient-elles de la traduction des scripts ?](#3-dautres-figures-profiteraient-elles-de-la-traduction-des-scripts-)
4. [Traduction des scripts en JavaScript](#4-traduction-des-scripts-en-javascript)

---

## 1. Où passe le temps ?

### Moi

La figure [MiraSansTortue.dgp](../tests/dgp/Yves_05/MiraSansTortue.dgp) s'ouvre et se manipule très correctement dans DocGeo, de façon beaucoup plus fluide que dans DGPad.

Penses-tu qu'il puisse être encore possible d'améliorer la vitesse du lecteur (`index.html`) pour que ce genre de figure soit encore plus rapide ? Mais attention : si tu proposes une modification, il faudrait que cela profite à d'autres figures, pas uniquement à celle-ci !

### IA

Oui, il reste une marge nette. Elle ne vient pas d'astuces propres à cette figure, mais de trois coûts que d'autres figures paient aussi. J'ai mesuré en déplaçant A, dans Chromium piloté par Playwright. Les chiffres sont indicatifs, mais les proportions sont parlantes. Je n'ai rien modifié dans le projet.

#### Où passe le temps (par image, environ 100 ms au total)

| Poste                                                | Coût       |
| ---------------------------------------------------- | ---------- |
| Script d'E1 (30 000 itérations, 60 000 appels à `f`) | ~30 ms     |
| **Texte d'E1** : formatage de la liste               | ~10 ms     |
| **Texte d'E1** : mise en page par le navigateur      | **~32 ms** |
| Construction du tracé de List1 (30 000 disques)      | ~17 ms     |
| Calcul et projection de List1                        | ~4 ms      |

Ce qui m'a surpris : E1 n'est pas masquée. DocGeo écrit donc à chaque image `E1 = [[1,2 ; 2,95] ; …]`, un texte de **495 000 caractères**. Le navigateur le met en page en entier alors que seuls ~80 caractères sont visibles.

#### Propositions, par rapport gain/effort

**1. N'écrire que la partie visible du texte d'une expression** (petit changement, gain ~40 ms ici)

- Une ligne de texte ne peut pas montrer plus de (largeur de la fenêtre − x) / (largeur minimale d'un caractère) caractères. On arrête le formatage au-delà, donc rien ne change à l'écran.
- Profite à toute figure qui affiche une expression dont la valeur est une longue liste. C'est fréquent dans les figures DGPad à `List`, où l'expression source est souvent laissée visible.
- Je limiterais ça au rendu : la lecture de la valeur en mode intégré et l'enregistrement `.dgo` ne changeraient pas.

**2. Construire plus vite le tracé des `List`** (changement local à `expression_list_object.render`, gain ~10 à 12 ms ici)

- Aujourd'hui, pour chaque point, on recalcule `rgb(${style.rgb})` (conversion d'un tableau en chaîne), on relit une `Map` et on y concatène.
- En calculant la couleur et la fin d'arc une seule fois par style, et en accumulant dans des tableaux, un micro-banc sur 30 000 points passe de **31 ms à 8 ms**.
- En option, arrondir les coordonnées au centième de pixel raccourcit le tracé de 30 % : moins de mémoire et d'analyse pour le navigateur, sans différence visible.
- Profite à toutes les `List` DGPad, tortue Blockly comprise.

**3. Traduire en JavaScript les programmes déjà validés** (chantier important, gain ~25 ms ici)

- `AGENTS.md` prévoit déjà ce cas, avec ses contraintes : code dépendant de la seule forme de l'arbre, limites d'étapes et de profondeur conservées, résultats identiques, interpréteur gardé comme référence et comme repli.
- La même boucle en JavaScript natif prend 0,5 ms, contre ~30 ms pour l'interpréteur par fermetures. Une traduction sûre resterait probablement à quelques ms.
- C'est le gain le plus large : tous les scripts, et aussi les courbes de fonctions, qui appellent `evaluateFunction` à chaque échantillon. Mais il faut écrire tout le traducteur et vérifier qu'il donne les mêmes résultats que l'interpréteur.
- Étape intermédiaire moins risquée : alléger l'appel d'une expression-fonction (`f(x)`). Chaque appel crée un environnement de trois fermetures, refait des recherches dans des `Map` et une `WeakMap`, et alloue un nouveau `Frame`. Gain estimé : ~5 ms ici, et aussi sur toutes les courbes.

#### Ce qui resterait

Il resterait surtout le dessin par le navigateur de 30 000 petits disques en SVG. Seul un rendu sur `canvas` des grosses listes y changerait vraiment quelque chose. Ce serait un changement d'architecture, que je ne propose pas maintenant.

Je suggère de commencer par 1 et 2 : peu de code, sans risque pour la fidélité, et environ la moitié du temps par image gagnée sur cette figure. Le point 3 viendrait ensuite, séparément. Je les implémente ?

---

## 2. Affichage des longues listes et tracé des `List`

### Moi

Concernant le 1 : regarde ce que DGPad fait pour limiter le nombre d'éléments affichés. Tu peux t'en inspirer sans nécessairement recopier intégralement…

Concernant le 2 : effectivement, les points que tu abordes peuvent être payants…

Alors oui, moyennant une lecture de mes commentaires ci-dessus, tu peux implémenter 1 et 2.

### IA

J'ai implémenté les points 1 et 2 : sur MiraSansTortue, une image en déplaçant A passe d'environ **114 ms à 75 ms**. Mesure faite dans Chromium sans écran, à prendre comme une indication. Le rendu de la figure est identique, à part le texte d'E1. Les tests passent, sauf un test de l'éditeur (`editor_properties.test.ts`, « edits a program on several lines ») qui échouait déjà avant mes modifications. Rien n'est committé.

#### 1. Affichage des longues listes ([expression_object.ts](../src/objects/expression_object.ts))

- Le volume `SSD 2To` n'étant pas monté, j'ai lu le code de DGPad dans `~/Mon Drive/Sites/dgpad`. Sa fonction `$U.parseList` n'affiche que les 3 premiers éléments, suivis de `... (N éléments)`.
- DocGeo fait maintenant pareil : `E1 = [[1,2 ; 2,95] ; [4,15 ; 2,47] ; [6,14 ; 1,11] ; … (30002 éléments)]`.
- Le texte passe de 495 000 caractères à 69. On gagne ~10 ms de formatage et ~30 ms de mise en page du navigateur par image.
- Je n'ai pas repris tout `parseList` : les sous-listes gardent le formatage de DocGeo, et le ✂ que DGPad affiche pour les séparateurs n'est pas reproduit.
- Seul l'affichage d'une expression est concerné. Les textes, les étiquettes de `List`, la valeur lue en mode intégré et l'enregistrement `.dgo` ne changent pas.
- Le mot « éléments » est traduit dans les 12 langues de [i18n.ts](../src/i18n.ts) (clé `list_items`).

#### 2. Tracé des `List` DGPad ([expression_list_object.ts](../src/objects/expression_list_object.ts))

- La couleur, le groupe de traits et la forme du disque ne sont recalculés que lorsque le style change d'un point au suivant. Avant, c'était pour chacun des 30 000 points.
- Les chaînes du tracé sont assemblées dans des tableaux au lieu d'être concaténées dans une `Map`.
- Les chaînes du contour rempli ne sont plus construites quand les points ne sont pas reliés.
- Les coordonnées sont arrondies au centième de pixel : le tracé est 30 % plus court à lire pour le navigateur, sans différence visible.
- Résultat : ~17 ms → ~8 ms par image. Toutes les `List` en profitent, y compris celles de la tortue Blockly.

J'ai aussi ajouté un test dans [dgp_commands.test.ts](../tests/browser/dgp_commands.test.ts) : une liste de 1 000 éléments s'affiche bien tronquée, et une liste de 3 éléments reste entière. Le formatage passe, et le build, fait dans un dossier temporaire pour ne pas toucher à DocTools, ne prend que quelques centaines d'octets.

Il reste surtout le script d'E1 (~30 ms par image), qui relève du point 3 (traduction en JavaScript) quand tu voudras t'y attaquer.

---

## 3. D'autres figures profiteraient-elles de la traduction des scripts ?

### Moi

Concernant l'amélioration proposée pour le script d'E1, tu peux me confirmer que d'autres scripts d'autres figures pourront en bénéficier ?

### IA

Oui, je te le confirme, et beaucoup d'autres figures du corpus y gagneraient davantage que MiraSansTortue.

**Mesure.** J'ai pris les 43 figures de `tests/dgp` dont un script contient une boucle. Dans chacune, j'ai recalculé 10 fois tout ce qui dépend de l'objet ayant le plus de dépendants, et mesuré la part du temps JavaScript passée dans l'évaluation des scripts. Le temps de dessin du navigateur n'est pas compté.

| Figure                                                    | Part du temps dans les scripts | Temps par mise à jour |
| --------------------------------------------------------- | ------------------------------ | --------------------- |
| CG_0034_Pt_Fr_Essai_EnvF                                  | 100 %                          | **958 ms**            |
| F26_m_kCtr_7oct GrosZoom cusp gauche                      | 100 %                          | 674 ms                |
| F26_m_kCtr_7oct GrosZoom 2cusp 3H                         | 100 %                          | 549 ms                |
| 09_CG_0034_Pt_Fr_Aimant5_Net                              | 99 %                           | 156 ms                |
| F26 … `_opt`, 3H1E, Gene Video (6 figures)                | 98–99 %                        | 39 à 138 ms           |
| 120Config_5paraboles_Rot, yves                            | 96 %                           | 28 à 34 ms            |
| PSH_Tournesol_n25                                         | 76 %                           | 13 ms                 |
| **MiraSansTortue**                                        | 64 %                           | 46 ms                 |
| mandel, mandel2, PSE_Medatrices…, PH_Cercles_Exinscrits1… | 40 à 50 %                      | 10 à 21 ms            |

Les figures d'Yves (dossiers `Yves_04` et suivants) sont les plus concernées. Leurs scripts calculent des racines de polynômes, des enveloppes et des points de rebroussement, avec des boucles imbriquées sur des nombres. C'est exactement ce qu'une traduction en JavaScript accélère le plus. Aujourd'hui, ces figures sont limitées à 1 à 10 images par seconde par le seul calcul.

**Pourquoi le gain serait général :**

- Formules et programmes passent par le même compilateur (`compileNode`). La traduction profiterait donc à tous les scripts, pas à un type d'objet en particulier.
- Ce même compilateur sert aussi aux courbes de fonctions, aux points définis par formule, aux bornes des curseurs et aux valeurs dans les textes. Pour eux, le gain sera faible, sauf pour les courbes, qui évaluent leur fonction à chaque échantillon.
- Sur une quinzaine de figures à boucles, les scripts pèsent moins de 30 % du temps. Elles y gagneraient peu, sans y perdre.

**Ce que je ne peux pas encore chiffrer précisément :**

- Le facteur d'accélération réel. En JavaScript pur, la boucle de Mira tourne ~60 fois plus vite. Une traduction sûre garde les compteurs d'étapes et de profondeur, la gestion des valeurs indéfinies et les cas complexes ou listes exigés par `AGENTS.md`. Je m'attendrais plutôt à un facteur 5 à 15 sur les boucles numériques, moins sur les scripts qui manipulent surtout des listes.
- Une page hôte qui interdit `new Function` resterait sur l'interpréteur actuel, qui sert de repli.

Pour mener ce chantier, ces figures (CG_0034, F26…) seraient de bons bancs d'essai : il faudrait comparer leurs résultats à ceux de l'interpréteur, valeur par valeur.

---

## 4. Traduction des scripts en JavaScript

### Moi

OK. Tu peux attaquer le chantier du script d'E1.

### IA

La traduction en JavaScript des scripts fonctionne. Sur tout le corpus, elle donne exactement les mêmes résultats que l'interpréteur, et les figures à scripts lourds deviennent nettement plus rapides. Rien n'est committé.

#### Gains

Temps JavaScript par mise à jour, après échauffement, dessin du navigateur non compté.

| Figure                       | Avant  | Après              |
| ---------------------------- | ------ | ------------------ |
| CG_0034_Pt_Fr_Essai_EnvF     | 865 ms | **~129 ms** (×6,7) |
| F26 … GrosZoom cusp gauche   | 674 ms | ~113 ms            |
| F26 … GrosZoom 2cusp 3H      | 549 ms | ~94 ms             |
| 09_CG_0034_Pt_Fr_Aimant5_Net | 156 ms | ~29 ms             |
| MiraSansTortue               | 46 ms  | ~21 ms             |
| mandel                       | 10 ms  | ~7 ms              |

Pour Mira, le gain est plus modeste : une fois le script accéléré, ce sont le dessin de 30 000 points et les 60 000 appels à `f` qui dominent. L'ouverture des figures n'a pas régressé (CG_0034 : 2,8 s → 2,7 s), et la première mise à jour n'a pas d'à-coup.

#### Fonctionnement ([dgp_formula.ts](../src/import/dgp_formula.ts))

- Un programme ou une formule est traduit seulement quand il a assez travaillé : un seuil de 1 000 étapes et évaluations. Un script à boucles est traduit dès sa deuxième exécution. Les milliers de formules simples d'une figure, elles, ne le sont jamais, et l'ouverture ne paie rien.
- Le code généré respecte les règles de `AGENTS.md` :
    - il ne dépend que de la forme de l'arbre ;
    - les noms et les textes, ainsi que les nombres non finis, sont rangés dans un tableau de constantes lu par indice ;
    - il n'accède aux listes que par des indices numériques ;
    - il ne lit aucune variable globale, seulement des fonctions utilitaires passées en paramètre ;
    - il garde les limites d'étapes et de profondeur.
- Les opérations et comparaisons sur les nombres sont écrites directement dans le code généré, avec repli sur l'interpréteur pour les complexes, les listes et les valeurs indéfinies.
- Les constructions rares (tortue, `join`, méthodes d'objets…) sont déléguées aux fermetures existantes, qui restent la référence. Si la page interdit `new Function`, l'interpréteur continue de tout faire seul.

Pour que l'interpréteur et la traduction partagent le même code, j'ai fait trois petites refactorisations dans `dgp_formula.ts` : appels à un argument, appels de fonctions de script, déclaration des fonctions d'un bloc.

#### Autres améliorations au passage

Elles profitent aussi à l'interpréteur et aux courbes :

- la vue de la figure n'est plus construite à chaque appel de fonction, seulement si la fonction en a besoin ;
- chaque évaluation n'alloue plus de `Set` inutile ;
- la lecture des points d'une `List` est plus légère.

#### Vérifications

- Nouveau test [dgp_translation.test.ts](../tests/browser/dgp_translation.test.ts) : chaque figure du corpus (138 DGPad et 53 GeoGebra) est ouverte dans les deux modes, puis le point libre dont dépendent le plus d'objets est déplacé. Toutes les valeurs et tout le dessin sont comparés au bit près.
- Pour vérifier que ce test détecte bien les écarts, j'ai faussé la multiplication de 10⁻¹⁵ : 74 figures échouent alors.
- Les 64 tests unitaires des formules tournent aussi une seconde fois avec tout traduit ([dgp_formula_translated.test.ts](../tests/unit/dgp_formula_translated.test.ts)).
- Toute la suite passe, sauf `editor_properties.test.ts` (« edits a program on several lines »), qui échouait déjà avant. Le formatage est bon, et le build grossit d'environ 5 Ko (~2 Ko compressé), pour l'ensemble des modifications de cette session.

#### Ce qui resterait

Il resterait une marge sur les scripts les plus lourds : garder les variables du script dans des variables JavaScript locales plutôt que dans un tableau. Mais le code généré devrait alors se synchroniser avec l'interpréteur à chaque délégation, ce qui le compliquerait nettement. Je ne le ferais que si ces figures restent trop lentes à l'usage.
