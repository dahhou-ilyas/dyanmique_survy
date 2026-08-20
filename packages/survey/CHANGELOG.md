# @dahhouilyas/survey

## 0.2.0

### Minor Changes

- 3ebdeac: Première version du module de sondage.

  - **Modèle JSON** aligné sur SurveyJS, versionné (`schemaVersion`) et migrable.
  - **Moteur d'expressions** maison — lexer, parseur à montée en précédence, interpréteur —
    sans aucune évaluation dynamique de code.
  - **`SurveyEngine`** : machine d'état TypeScript pure (visibilité, validation, navigation,
    déclencheurs, valeurs calculées, résultat exploitable pour le reporting).
  - **`SurveyRenderer`** : moteur de rendu React 18, 11 types de questions, groupes
    imbriquables, accessibilité WCAG 2.1 AA vérifiée par axe-core.
  - **`SurveyBuilder`** : concepteur en glisser-déposer (souris et clavier), panneau de
    propriétés généré depuis le registre de types, aperçu, vue logique, traductions, JSON et
    contrôles de conception en continu.
  - **Thèmes** en variables CSS scopées à `.edbs-root` : `default`, `builder`, `compact`,
    `dark-auto`, `edb`.
