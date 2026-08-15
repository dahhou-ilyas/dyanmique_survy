/**
 * Modèle de données d'un sondage.
 *
 * La forme du JSON est volontairement alignée sur celle de SurveyJS
 * (`pages[].elements[]`, `type`, `name`, `title`, `isRequired`, `visibleIf`, `choices`) :
 * le cahier des charges désigne SurveyJS comme solution cible, garder la même structure
 * conserve une porte de sortie dans les deux sens et aligne le vocabulaire de l'équipe.
 */

/* -------------------------------------------------------------------------- */
/* Localisation                                                               */
/* -------------------------------------------------------------------------- */

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

/** Table de traductions ; `default` sert de repli quand la locale demandée est absente. */
export type LocalizedMap = { default?: string } & Partial<Record<Locale, string>>;

/**
 * Un texte affichable. La forme `string` couvre le cas monolingue et reste la
 * représentation compacte par défaut ; la forme objet apparaît dès qu'une traduction existe.
 */
export type LocalizedString = string | LocalizedMap;

/* -------------------------------------------------------------------------- */
/* Validateurs                                                                */
/* -------------------------------------------------------------------------- */

interface ValidatorBase {
  /** Message personnalisé ; à défaut, un message i18n par défaut est utilisé. */
  text?: LocalizedString;
}

export interface EmailValidator extends ValidatorBase {
  type: 'email';
}
export interface RegexValidator extends ValidatorBase {
  type: 'regex';
  regex: string;
}
export interface NumericValidator extends ValidatorBase {
  type: 'numeric';
  minValue?: number;
  maxValue?: number;
}
export interface TextLengthValidator extends ValidatorBase {
  type: 'text';
  minLength?: number;
  maxLength?: number;
}
export interface ExpressionValidator extends ValidatorBase {
  type: 'expression';
  expression: string;
}

export type Validator =
  EmailValidator | RegexValidator | NumericValidator | TextLengthValidator | ExpressionValidator;

export type ValidatorType = Validator['type'];

/* -------------------------------------------------------------------------- */
/* Choix                                                                      */
/* -------------------------------------------------------------------------- */

export interface Choice {
  /** Valeur stockée dans les réponses — c'est elle qui part en base, pas le libellé. */
  value: string | number;
  /** Libellé affiché ; si absent, `value` est affichée telle quelle. */
  text?: LocalizedString;
  /** Condition d'affichage de cette option ; `{item}` référence la valeur de l'option. */
  visibleIf?: string;
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                  */
/* -------------------------------------------------------------------------- */

export const QUESTION_TYPES = [
  'text',
  'comment',
  'radiogroup',
  'checkbox',
  'dropdown',
  'date',
  'number',
  'rating',
  'nps',
  'boolean',
  'html',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type ElementType = QuestionType | 'panel';

export interface BaseQuestion {
  /** Identifiant technique stable, jamais affiché ; survit aux renommages de `name`. */
  id: string;
  /**
   * Identifiant unique de la question dans le sondage — exigence explicite du cahier
   * des charges. C'est la clé utilisée dans les réponses et dans les expressions `{name}`.
   */
  name: string;
  type: QuestionType;
  title: LocalizedString;
  description?: LocalizedString;
  isRequired?: boolean;
  requiredErrorText?: LocalizedString;
  /** Expression conditionnant l'affichage. Ex. `{satisfait} = 'non'` */
  visibleIf?: string;
  /** Expression conditionnant l'activation (lecture seule si fausse). */
  enableIf?: string;
  /** Expression rendant la question obligatoire dynamiquement. */
  requiredIf?: string;
  defaultValue?: unknown;
  validators?: Validator[];
  readOnly?: boolean;
}

export type TextInputType = 'text' | 'email' | 'tel' | 'url' | 'password';

export interface TextQuestion extends BaseQuestion {
  type: 'text';
  inputType?: TextInputType;
  placeholder?: LocalizedString;
  maxLength?: number;
}

export interface CommentQuestion extends BaseQuestion {
  type: 'comment';
  placeholder?: LocalizedString;
  rows?: number;
  maxLength?: number;
  showCharacterCounter?: boolean;
}

interface ChoiceQuestionBase extends BaseQuestion {
  choices: Choice[];
  /** Filtre appliqué à chaque option ; `{item}` désigne la valeur de l'option testée. */
  choicesVisibleIf?: string;
  hasOther?: boolean;
  otherText?: LocalizedString;
  otherPlaceholder?: LocalizedString;
}

export interface RadioGroupQuestion extends ChoiceQuestionBase {
  type: 'radiogroup';
  colCount?: 1 | 2 | 3 | 4;
}

export interface CheckboxQuestion extends ChoiceQuestionBase {
  type: 'checkbox';
  colCount?: 1 | 2 | 3 | 4;
  minSelectedChoices?: number;
  maxSelectedChoices?: number;
}

export interface DropdownQuestion extends ChoiceQuestionBase {
  type: 'dropdown';
  placeholder?: LocalizedString;
}

export interface DateQuestion extends BaseQuestion {
  type: 'date';
  /** Bornes au format ISO `YYYY-MM-DD`. */
  min?: string;
  max?: string;
}

export interface NumberQuestion extends BaseQuestion {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  unit?: LocalizedString;
}

export interface RatingQuestion extends BaseQuestion {
  type: 'rating';
  /** Nombre de crans, 2 à 10. */
  rateMax?: number;
  rateType?: 'stars' | 'numbers' | 'smileys';
  minRateDescription?: LocalizedString;
  maxRateDescription?: LocalizedString;
}

export interface NpsQuestion extends BaseQuestion {
  type: 'nps';
  minDescription?: LocalizedString;
  maxDescription?: LocalizedString;
}

export interface BooleanQuestion extends BaseQuestion {
  type: 'boolean';
  labelTrue?: LocalizedString;
  labelFalse?: LocalizedString;
  renderAs?: 'switch' | 'radio';
}

/**
 * Bloc de contenu sans réponse : texte d'introduction, conditions générales, mention légale.
 * Le HTML est assaini au rendu — son contenu est saisi par des utilisateurs back-office.
 */
export interface HtmlQuestion extends BaseQuestion {
  type: 'html';
  html: LocalizedString;
}

export type Question =
  | TextQuestion
  | CommentQuestion
  | RadioGroupQuestion
  | CheckboxQuestion
  | DropdownQuestion
  | DateQuestion
  | NumberQuestion
  | RatingQuestion
  | NpsQuestion
  | BooleanQuestion
  | HtmlQuestion;

/** Questions portant une valeur (tout sauf `html`). */
export type ValueQuestion = Exclude<Question, HtmlQuestion>;
/** Questions exposant une liste d'options. */
export type ChoiceQuestion = RadioGroupQuestion | CheckboxQuestion | DropdownQuestion;

/* -------------------------------------------------------------------------- */
/* Conteneurs                                                                 */
/* -------------------------------------------------------------------------- */

export interface Panel {
  id: string;
  name: string;
  type: 'panel';
  title?: LocalizedString;
  description?: LocalizedString;
  state?: 'expanded' | 'collapsed';
  elements: SurveyElement[];
  visibleIf?: string;
  enableIf?: string;
}

export type SurveyElement = Question | Panel;

export interface Page {
  id: string;
  name: string;
  title?: LocalizedString;
  description?: LocalizedString;
  elements: SurveyElement[];
  visibleIf?: string;
}

/* -------------------------------------------------------------------------- */
/* Logique transverse                                                         */
/* -------------------------------------------------------------------------- */

export interface CalculatedValue {
  name: string;
  expression: string;
  /** Si vrai, la valeur calculée est jointe aux réponses envoyées au backend. */
  includeIntoResult?: boolean;
}

export interface SetValueTrigger {
  type: 'setvalue';
  expression: string;
  setToName: string;
  setValue: unknown;
}
export interface CopyValueTrigger {
  type: 'copyvalue';
  expression: string;
  fromName: string;
  setToName: string;
}
export interface SkipTrigger {
  type: 'skip';
  expression: string;
  /** Nom de la page ou de la question vers laquelle sauter. */
  gotoName: string;
}
export interface CompleteTrigger {
  type: 'complete';
  expression: string;
}

export type Trigger = SetValueTrigger | CopyValueTrigger | SkipTrigger | CompleteTrigger;
export type TriggerType = Trigger['type'];

/* -------------------------------------------------------------------------- */
/* Sondage                                                                    */
/* -------------------------------------------------------------------------- */

export interface SurveySettings {
  locale: Locale;
  showProgressBar: 'off' | 'top' | 'bottom';
  showQuestionNumbers: 'on' | 'off' | 'onPage';
  showPageTitles: boolean;
  /**
   * `onNextPage` : les erreurs n'apparaissent qu'à la tentative de navigation.
   * `onValueChanged` : validation au fil de la saisie, une fois le champ touché.
   */
  checkErrorsMode: 'onNextPage' | 'onValueChanged';
  requiredErrorText?: LocalizedString;
  pagePrevText?: LocalizedString;
  pageNextText?: LocalizedString;
  completeText?: LocalizedString;
  completedHtml?: LocalizedString;
}

/** Version du schéma produite par cette version du package (cf. `migrate.ts`). */
export const CURRENT_SCHEMA_VERSION = 1;

export interface SurveyDefinition {
  schemaVersion: number;
  id: string;
  title: LocalizedString;
  description?: LocalizedString;
  pages: Page[];
  settings: SurveySettings;
  calculatedValues?: CalculatedValue[];
  triggers?: Trigger[];
}

/* -------------------------------------------------------------------------- */
/* Résultat                                                                   */
/* -------------------------------------------------------------------------- */

/** Une réponse, sous la forme « clé / valeur » exploitable pour le reporting. */
export interface SurveyAnswer {
  questionId: string;
  questionName: string;
  type: QuestionType;
  /** Libellé résolu dans la locale de passation — garde le rapport lisible dans le temps. */
  title: string;
  value: unknown;
  /** Rendu lisible de `value` (libellés d'options plutôt que codes). */
  displayValue: string;
}

export interface SurveyResult {
  surveyId: string;
  schemaVersion: number;
  locale: Locale;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  /** Réponses indexées par `name` — pratique côté front. */
  data: Record<string, unknown>;
  /** Réponses à plat — pratique côté base et reporting. */
  answers: SurveyAnswer[];
}

/* -------------------------------------------------------------------------- */
/* Gardes de type                                                             */
/* -------------------------------------------------------------------------- */

export function isPanel(element: SurveyElement): element is Panel {
  return element.type === 'panel';
}

export function isQuestion(element: SurveyElement): element is Question {
  return element.type !== 'panel';
}

export function isChoiceQuestion(question: Question): question is ChoiceQuestion {
  return (
    question.type === 'radiogroup' || question.type === 'checkbox' || question.type === 'dropdown'
  );
}

export function hasValue(question: Question): question is ValueQuestion {
  return question.type !== 'html';
}
