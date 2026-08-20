/**
 * `@dahhouilyas/survey/element` — le sondage comme élément HTML standard.
 *
 * Bundle **autonome** : le moteur, les 11 types de questions, le thème et Preact
 * y sont embarqués. Aucune dépendance à installer, aucun bundler requis.
 *
 *   <script type="module" src=".../element.js"></script>
 *   <edb-survey src="/api/formulaire.json"></edb-survey>
 *
 * L'import enregistre l'élément automatiquement.
 */

import { defineSurveyElement } from './SurveyElement';

export { SurveyElement, defineSurveyElement, EVENEMENTS } from './SurveyElement';
export type { Locale, SurveyDefinition, SurveyResult } from '../core/schema/types';

defineSurveyElement();
