/**
 * `@dahhouilyas/survey/builder` — créateur de sondages en glisser-déposer.
 *
 * Point d'entrée destiné au **back-office**. L'application qui affiche les
 * sondages n'importe que `@dahhouilyas/survey/runtime` : rien de ce module (dnd-kit,
 * éditeurs de propriétés) n'entre alors dans son bundle.
 *
 *   import { SurveyBuilder } from '@dahhouilyas/survey/builder';
 *   import '@dahhouilyas/survey/themes/builder.css';
 */

export { SurveyBuilder, type SurveyBuilderProps } from './SurveyBuilder';

export {
  BuilderProvider,
  useBuilder,
  useBuilderActions,
  useBuilderContext,
  type BuilderProviderProps,
} from './BuilderProvider';

export {
  createBuilderStore,
  redoLabel,
  undoLabel,
  type BuilderActions,
  type BuilderState,
  type BuilderStore,
  type BuilderStoreApi,
  type DropTarget,
  type Selection,
} from './store/builderStore';

export { BUILDER_TABS, Toolbar, type BuilderTab, type ToolbarProps } from './layout/Toolbar';
export { DesignerCanvas } from './canvas/DesignerCanvas';
export {
  TOOLBOX_DRAG_PREFIX,
  isToolboxDrag,
  resolveDropTarget,
  toolboxDragType,
} from './canvas/dropTarget';
export {
  decodeContainerId,
  encodeContainerId,
  isContainerId,
  type ContainerId,
} from './canvas/dragIds';
export { PropertyGrid } from './properties/PropertyGrid';
export { ToolboxPanel } from './toolbox/ToolboxPanel';
export { PreviewPane } from './tabs/PreviewPane';
export { LogicTab } from './tabs/LogicTab';
export { TranslationsTab } from './tabs/TranslationsTab';
export { JsonTab } from './tabs/JsonTab';
export { DiagnosticsPanel } from './tabs/DiagnosticsPanel';

export {
  builderMessages,
  createBuilderTranslator,
  type BuilderMessageKey,
  type BuilderMessages,
  type TranslateBuilder,
} from '../i18n/builderMessages';

// Ré-exports pratiques pour l'écran d'administration : créer un sondage vierge et
// contrôler sa validité sans importer un second point d'entrée.
export { createPage, createPanel, createQuestion, createSurvey } from '../core/schema/defaults';
export { safeParseSurvey, parseSurvey } from '../core/schema/zod';
export { validateSurveyDefinition, type SurveyDiagnostic } from '../core/validation/validateSurvey';
export type { Locale, SurveyDefinition } from '../core/schema/types';
