/**
 * `@dahhouilyas/survey/headless` — piloter un sondage sans framework.
 *
 * Point d'entrée destiné aux hôtes qui rendent eux-mêmes leur interface : DOM natif,
 * Vue, Svelte, Angular, React Native… Aucune dépendance à React n'est tirée.
 *
 *   import { createHeadlessSurvey } from '@dahhouilyas/survey/headless';
 *
 * Pour un rendu clé en main, voir `@dahhouilyas/survey/runtime` (React) ou
 * `@dahhouilyas/survey/element` (Web Component, tout framework).
 */

export {
  createHeadlessSurvey,
  type HeadlessSurvey,
  type HeadlessSurveyOptions,
  type RenderableNode,
} from './createHeadlessSurvey';

// Ré-exports pratiques : typer ses propres rappels sans importer /core en plus.
export {
  SurveyEngine,
  type PageChangedEvent,
  type PanelSnapshot,
  type QuestionSnapshot,
  type SurveyMode,
  type SurveyState,
  type ValueChangedEvent,
} from '../core/engine/SurveyEngine';

export {
  createTranslator,
  messages,
  type MessageKey,
  type Messages,
  type Translate,
} from '../i18n/messages';

export type {
  Choice,
  Locale,
  LocalizedString,
  Page,
  Panel,
  Question,
  QuestionType,
  SurveyAnswer,
  SurveyDefinition,
  SurveyResult,
} from '../core/schema/types';
