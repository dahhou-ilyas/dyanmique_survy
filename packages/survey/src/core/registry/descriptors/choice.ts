import { resolveText } from '../../localization/resolveText';
import type {
  CheckboxQuestion,
  Choice,
  ChoiceQuestion,
  DropdownQuestion,
  Locale,
  RadioGroupQuestion,
} from '../../schema/types';
import { CHOICE_PROPERTIES, COL_COUNT_PROPERTY, isEmptyValue } from '../commonProperties';
import type { DisplayContext, QuestionTypeDescriptor } from '../types';

/** Valeur réservée à l'option « Autre ». */
export const OTHER_VALUE = 'other';

/**
 * Clé sous laquelle le texte libre de « Autre » est stocké dans les réponses.
 * Convention alignée sur SurveyJS pour rester lisible côté reporting.
 */
export function otherCommentKey(questionName: string): string {
  return `${questionName}-Comment`;
}

function choiceLabel(choice: Choice, locale: Locale): string {
  const text = resolveText(choice.text, locale);
  return text === '' ? String(choice.value) : text;
}

/** Libellé d'une valeur unique ; retombe sur la valeur brute si l'option a disparu. */
function displaySingle(
  value: unknown,
  question: ChoiceQuestion,
  { locale, data }: DisplayContext,
): string {
  if (value === OTHER_VALUE && question.hasOther) {
    const comment = data[otherCommentKey(question.name)];
    const otherLabel = resolveText(question.otherText, locale) || 'Autre';
    return isEmptyValue(comment) ? otherLabel : `${otherLabel} : ${String(comment)}`;
  }
  const choice = question.choices.find((candidate) => candidate.value === value);
  return choice ? choiceLabel(choice, locale) : String(value);
}

const defaultChoices = (): Choice[] => [
  { value: 'item1', text: { fr: 'Option 1', en: 'Choice 1' } },
  { value: 'item2', text: { fr: 'Option 2', en: 'Choice 2' } },
  { value: 'item3', text: { fr: 'Option 3', en: 'Choice 3' } },
];

export const radioGroupDescriptor: QuestionTypeDescriptor<RadioGroupQuestion> = {
  type: 'radiogroup',
  category: 'choice',
  label: { fr: 'Choix unique', en: 'Single choice' },
  icon: 'radio',
  hasValue: true,
  supportsChoices: true,

  createDefault: (name, id) => ({
    id,
    name,
    type: 'radiogroup',
    title: { fr: 'Question à choix unique', en: 'Single choice question' },
    choices: defaultChoices(),
  }),

  properties: [...CHOICE_PROPERTIES, COL_COUNT_PROPERTY],

  isEmpty: isEmptyValue,
  getDisplayValue: (value, question, context) =>
    isEmptyValue(value) ? '' : displaySingle(value, question, context),
};

export const checkboxDescriptor: QuestionTypeDescriptor<CheckboxQuestion> = {
  type: 'checkbox',
  category: 'choice',
  label: { fr: 'Choix multiple', en: 'Multiple choice' },
  icon: 'checkbox',
  hasValue: true,
  supportsChoices: true,

  createDefault: (name, id) => ({
    id,
    name,
    type: 'checkbox',
    title: { fr: 'Question à choix multiple', en: 'Multiple choice question' },
    choices: defaultChoices(),
  }),

  properties: [
    ...CHOICE_PROPERTIES,
    COL_COUNT_PROPERTY,
    {
      name: 'minSelectedChoices',
      label: { fr: 'Minimum de sélections', en: 'Min selected' },
      editor: 'number',
      group: 'validation',
      min: 0,
    },
    {
      name: 'maxSelectedChoices',
      label: { fr: 'Maximum de sélections', en: 'Max selected' },
      editor: 'number',
      group: 'validation',
      min: 1,
    },
  ],

  isEmpty: isEmptyValue,
  // Toujours stocker un tableau : le reporting et les expressions `anyof`/`allof`
  // n'ont ainsi jamais à distinguer « une seule case » de « plusieurs ».
  normalizeValue: (value) => {
    if (value === undefined || value === null) return undefined;
    const array = Array.isArray(value) ? value : [value];
    return array.length === 0 ? undefined : array;
  },
  getDisplayValue: (value, question, context) => {
    if (isEmptyValue(value)) return '';
    const values = Array.isArray(value) ? value : [value];
    return values.map((entry) => displaySingle(entry, question, context)).join(', ');
  },
};

export const dropdownDescriptor: QuestionTypeDescriptor<DropdownQuestion> = {
  type: 'dropdown',
  category: 'choice',
  label: { fr: 'Liste déroulante', en: 'Dropdown' },
  icon: 'dropdown',
  hasValue: true,
  supportsChoices: true,

  createDefault: (name, id) => ({
    id,
    name,
    type: 'dropdown',
    title: { fr: 'Liste déroulante', en: 'Dropdown question' },
    choices: defaultChoices(),
  }),

  properties: [
    ...CHOICE_PROPERTIES,
    {
      name: 'placeholder',
      label: { fr: 'Texte par défaut', en: 'Placeholder' },
      editor: 'localizedText',
      group: 'options',
    },
  ],

  isEmpty: isEmptyValue,
  getDisplayValue: (value, question, context) =>
    isEmptyValue(value) ? '' : displaySingle(value, question, context),
};
