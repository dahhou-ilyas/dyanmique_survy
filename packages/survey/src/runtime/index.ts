/**
 * `@edb/survey/runtime` — moteur de rendu React.
 *
 * Point d'entrée à utiliser dans l'application qui **affiche** les sondages
 * (interstitiel après authentification). Le builder vit dans `@edb/survey/builder`
 * et n'est jamais tiré dans ce bundle.
 *
 *   import { SurveyRenderer } from '@edb/survey/runtime';
 *   import '@edb/survey/themes/default.css';
 */

export { SurveyRenderer, type SurveyRendererProps } from './SurveyRenderer';
export {
  SurveyProvider,
  useSurveyContext,
  type SurveyContextValue,
  type SurveyProviderProps,
} from './SurveyProvider';

export { usePanelSnapshot, useQuestionSnapshot, useSurveyState } from './hooks/useSurveyEngine';

export { defaultFieldComponents, type FieldComponents } from './fieldComponents';
export { usesGroupSemantics, type FieldProps } from './types';

export { QuestionRenderer, type QuestionRendererProps } from './components/QuestionRenderer';
export { ElementList, PanelRenderer } from './components/PanelRenderer';
export { PageRenderer, type PageRendererProps } from './components/PageRenderer';
export { NavigationBar } from './components/NavigationBar';
export { ProgressBar } from './components/ProgressBar';
export { CompletePage } from './components/CompletePage';
export { sanitizeHtml } from './components/fields/HtmlBlock';

export {
  createTranslator,
  formatMessage,
  messages,
  type MessageKey,
  type Messages,
  type Translate,
} from '../i18n/messages';

// Ré-exports pratiques : l'application hôte a besoin de ces types pour typer ses
// propres callbacks sans importer un second point d'entrée.
export {
  SurveyEngine,
  type PageChangedEvent,
  type PanelSnapshot,
  type QuestionSnapshot,
  type SurveyEngineOptions,
  type SurveyMode,
  type SurveyState,
  type ValueChangedEvent,
} from '../core/engine/SurveyEngine';
export type {
  Locale,
  LocalizedString,
  Question,
  SurveyAnswer,
  SurveyDefinition,
  SurveyResult,
} from '../core/schema/types';
