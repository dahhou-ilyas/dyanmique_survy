/**
 * `@edb/survey/core` — modèle, moteur d'expressions, validation et moteur d'exécution.
 * Aucune dépendance à React : ce point d'entrée est utilisable côté Node
 * (validation d'un JSON reçu par API, calcul de résultats) comme côté navigateur.
 */

export * from './schema/types';
export * from './schema/traverse';
export {
  createId,
  createDefaultSettings,
  createPage,
  createPanel,
  createQuestion,
  createSurvey,
} from './schema/defaults';
export {
  MIGRATIONS,
  SurveyMigrationError,
  migrateSurvey,
  needsMigration,
  type MigrationStep,
} from './schema/migrate';
export {
  SurveySchemaError,
  parseSurvey,
  safeParseSurvey,
  schemas,
  surveyDefinitionSchema,
  questionSchema,
  toSchemaIssues,
  type ParseSurveyResult,
  type SchemaIssue,
} from './schema/zod';

export {
  isLocalizedTextEmpty,
  resolveText,
  resolveTextOrUndefined,
  setLocalizedText,
  toLocalizedMap,
} from './localization/resolveText';

export {
  CATEGORY_LABELS,
  PAGE_PROPERTIES,
  PANEL_PROPERTIES,
  PROPERTY_GROUP_LABELS,
  PROPERTY_GROUP_ORDER,
  QuestionRegistry,
  TOOLBOX_ORDER,
  UnknownQuestionTypeError,
  questionRegistry,
} from './registry/questionRegistry';
export {
  CHOICE_PROPERTIES,
  COL_COUNT_PROPERTY,
  IDENTITY_PROPERTIES,
  LOGIC_PROPERTIES,
  PANEL_LOGIC_PROPERTIES,
  VALIDATION_PROPERTIES,
  isEmptyValue,
} from './registry/commonProperties';
export { OTHER_VALUE, otherCommentKey } from './registry/descriptors/choice';
export { DEFAULT_RATE_MAX, NPS_MAX, NPS_MIN } from './registry/descriptors/rating';
export type {
  AnyQuestionTypeDescriptor,
  DisplayContext,
  IconName,
  PropertyDescriptor,
  PropertyEditorKind,
  PropertyGroup,
  PropertyOption,
  QuestionCategory,
  QuestionTypeDescriptor,
} from './registry/types';
