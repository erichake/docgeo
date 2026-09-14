# Règles de code

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
