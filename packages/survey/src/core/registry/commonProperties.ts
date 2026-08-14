import type { PropertyDescriptor } from './types';
import { isChoiceQuestion, isPanel, type SurveyElement } from '../schema/types';

/** Vrai si la valeur doit être considérée comme « pas de réponse ». */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'number') return Number.isNaN(value);
  return false;
}

/** Identité et libellés — présents sur tous les éléments, y compris les panels. */
export const IDENTITY_PROPERTIES: PropertyDescriptor[] = [
  {
    name: 'name',
    label: { fr: 'Identifiant', en: 'Name' },
    description: {
      fr: 'Clé unique utilisée dans les réponses et les expressions. Modifier ce nom casse les règles qui y font référence.',
      en: 'Unique key used in answers and expressions. Renaming breaks rules that reference it.',
    },
    editor: 'text',
    group: 'general',
  },
  {
    name: 'title',
    label: { fr: 'Libellé', en: 'Title' },
    editor: 'localizedText',
    group: 'general',
  },
  {
    name: 'description',
    label: { fr: 'Description', en: 'Description' },
    editor: 'localizedTextarea',
    group: 'general',
  },
];

/** Obligation et règles de validation — sans objet pour les blocs de contenu. */
export const VALIDATION_PROPERTIES: PropertyDescriptor[] = [
  {
    name: 'isRequired',
    label: { fr: 'Obligatoire', en: 'Required' },
    editor: 'boolean',
    group: 'validation',
  },
  {
    name: 'requiredErrorText',
    label: { fr: "Message si non renseigné", en: 'Required error message' },
    editor: 'localizedText',
    group: 'validation',
    isVisible: (element) => !isPanel(element) && element.isRequired === true,
  },
  {
    name: 'validators',
    label: { fr: 'Règles de validation', en: 'Validation rules' },
    editor: 'validators',
    group: 'validation',
  },
];

/** Logique conditionnelle — commune à tous les éléments. */
export const LOGIC_PROPERTIES: PropertyDescriptor[] = [
  {
    name: 'visibleIf',
    label: { fr: 'Afficher si', en: 'Visible if' },
    description: {
      fr: "Expression évaluée en continu. Ex. : {satisfaction} <= 2",
      en: 'Continuously evaluated expression. E.g. {satisfaction} <= 2',
    },
    editor: 'expression',
    group: 'logic',
  },
  {
    name: 'enableIf',
    label: { fr: 'Activer si', en: 'Enabled if' },
    editor: 'expression',
    group: 'logic',
  },
  {
    name: 'requiredIf',
    label: { fr: 'Obligatoire si', en: 'Required if' },
    editor: 'expression',
    group: 'logic',
  },
];

/** Propriétés de logique applicables aux panels (pas de `requiredIf`). */
export const PANEL_LOGIC_PROPERTIES: PropertyDescriptor[] = LOGIC_PROPERTIES.filter(
  (property) => property.name !== 'requiredIf',
);

const hasOtherEnabled = (element: SurveyElement): boolean =>
  !isPanel(element) && isChoiceQuestion(element) && element.hasOther === true;

/** Propriétés partagées par toutes les questions à options. */
export const CHOICE_PROPERTIES: PropertyDescriptor[] = [
  {
    name: 'choices',
    label: { fr: 'Options de réponse', en: 'Choices' },
    editor: 'choices',
    group: 'options',
  },
  {
    name: 'hasOther',
    label: { fr: 'Proposer « Autre »', en: 'Show "Other"' },
    editor: 'boolean',
    group: 'options',
  },
  {
    name: 'otherText',
    label: { fr: 'Libellé de « Autre »', en: '"Other" label' },
    editor: 'localizedText',
    group: 'options',
    isVisible: hasOtherEnabled,
  },
  {
    name: 'otherPlaceholder',
    label: { fr: 'Aide de saisie de « Autre »', en: '"Other" placeholder' },
    editor: 'localizedText',
    group: 'options',
    isVisible: hasOtherEnabled,
  },
  {
    name: 'choicesVisibleIf',
    label: { fr: 'Filtrer les options si', en: 'Choices visible if' },
    description: {
      fr: 'Expression appliquée à chaque option ; {item} désigne sa valeur.',
      en: 'Expression applied to each choice; {item} is its value.',
    },
    editor: 'expression',
    group: 'logic',
  },
];

export const COL_COUNT_PROPERTY: PropertyDescriptor = {
  name: 'colCount',
  label: { fr: 'Colonnes', en: 'Columns' },
  editor: 'select',
  group: 'layout',
  options: [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
  ],
};
