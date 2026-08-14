import type {
  Locale,
  LocalizedString,
  Question,
  QuestionType,
  SurveyElement,
} from '../schema/types';

/**
 * Description d'un type de question.
 *
 * C'est la **source unique** consommée à la fois par le moteur de rendu et par le
 * builder : le panneau de propriétés du builder est *généré* à partir de
 * `properties`, la palette à partir de `label`/`icon`/`category`, et le moteur
 * s'appuie sur `isEmpty`/`getDisplayValue`.
 *
 * Ajouter un type de question = un descripteur ici + un composant React dans
 * `runtime/components/fields`. Rien d'autre à toucher.
 */

export type QuestionCategory = 'text' | 'choice' | 'numeric' | 'rating' | 'content' | 'layout';

/** Clés d'icônes rendues en SVG inline par le builder (aucune dépendance externe). */
export type IconName =
  | 'text'
  | 'textarea'
  | 'radio'
  | 'checkbox'
  | 'dropdown'
  | 'calendar'
  | 'number'
  | 'star'
  | 'gauge'
  | 'toggle'
  | 'html'
  | 'panel';

/* -------------------------------------------------------------------------- */
/* Propriétés éditables                                                       */
/* -------------------------------------------------------------------------- */

export type PropertyGroup = 'general' | 'options' | 'validation' | 'logic' | 'layout';

export type PropertyEditorKind =
  | 'text'
  | 'localizedText'
  | 'localizedTextarea'
  | 'localizedHtml'
  | 'boolean'
  | 'number'
  | 'select'
  | 'choices'
  | 'validators'
  | 'expression';

export interface PropertyOption {
  value: string | number;
  label: LocalizedString;
}

export interface PropertyDescriptor {
  /** Clé de la propriété sur l'objet élément. */
  name: string;
  label: LocalizedString;
  description?: LocalizedString;
  editor: PropertyEditorKind;
  group: PropertyGroup;
  /** Pour l'éditeur `select`. */
  options?: PropertyOption[];
  /** Pour l'éditeur `number`. */
  min?: number;
  max?: number;
  step?: number;
  placeholder?: LocalizedString;
  /** Masque la propriété selon l'état courant de l'élément (ex. « autre » désactivé). */
  isVisible?: (element: SurveyElement) => boolean;
}

/* -------------------------------------------------------------------------- */
/* Descripteur de type                                                        */
/* -------------------------------------------------------------------------- */

/** Contexte fourni au rendu lisible d'une valeur. */
export interface DisplayContext {
  locale: Locale;
  /** Réponses complètes — nécessaire pour les valeurs annexes comme le texte « Autre ». */
  data: Readonly<Record<string, unknown>>;
}

export interface QuestionTypeDescriptor<Q extends Question = Question> {
  type: QuestionType;
  category: QuestionCategory;
  label: LocalizedString;
  icon: IconName;
  /** `false` pour les blocs de contenu (`html`) : ils ne produisent pas de réponse. */
  hasValue: boolean;
  supportsChoices: boolean;
  /** Crée une question par défaut, prête à être affichée dans le builder. */
  createDefault: (name: string, id: string) => Q;
  /** Propriétés spécifiques au type ; les propriétés communes y sont ajoutées par le registre. */
  properties: PropertyDescriptor[];
  /** Détermine si la question est « sans réponse » — base du contrôle d'obligation. */
  isEmpty: (value: unknown) => boolean;
  /** Normalise la valeur issue du champ avant stockage (nombre, tableau trié, …). */
  normalizeValue?: (value: unknown, question: Q) => unknown;
  /** Rendu lisible pour le reporting : libellés d'options plutôt que codes. */
  getDisplayValue: (value: unknown, question: Q, context: DisplayContext) => string;
}

/** Descripteur générique, tel que stocké dans le registre. */
export type AnyQuestionTypeDescriptor = QuestionTypeDescriptor<never>;
