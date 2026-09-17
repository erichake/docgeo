# Règles de code

## Objectif actuel du projet

DGPad Pro est actuellement un **lecteur interactif de figures `.dgp`**. Son
objectif est d'ouvrir fidèlement les fichiers produits par DGPad et de permettre
la manipulation des objets déjà mobiles dans ces figures.

Tant que le lecteur ne sait pas ouvrir et manipuler avec robustesse et fluidité
des constructions complexes, ne pas développer d'outils de création, de barre
d'outils de construction ni de fonctions d'édition ou d'export.

Les développements doivent servir en priorité :

- l'import sûr du format `.dgp`, toute exécution de son contenu devant avoir
  lieu dans un environnement sécurisé et strictement contrôlé ;
- la compatibilité géométrique et graphique avec DGPad ;
- la manipulation des objets existants ;
- la robustesse numérique et les performances sur plusieurs milliers d'objets.

### Code DGPad de référence

Le code source de la version de DGPad actuellement en production se trouve dans :

`/Volumes/SSD 2To/Google Drive/Sites/dgpad`

Le consulter lorsque l'import `.dgp`, la sémantique d'un objet ou un comportement
de compatibilité ne peuvent pas être déterminés avec certitude depuis le nouveau
projet et les figures de référence.

Ce code de référence a été écrit par l'auteur du projet sans assistance d'IA et
peut contenir des erreurs, oublis ou imprécisions : ce n'est pas une spécification
à reproduire à l'identique. Ce qui fait foi, c'est le rendu et le comportement
obtenus dans DGPad avec la figure ouverte. Ne pas hésiter à implémenter
autrement ou mieux (calcul plus robuste, plus simple, compatible 3D, etc.), du
moment que le résultat reste conforme à ce que produit DGPad.

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
