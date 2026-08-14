import { resolveText } from '../../localization/resolveText';
import type { DateQuestion, NumberQuestion } from '../../schema/types';
import { isEmptyValue } from '../commonProperties';
import type { QuestionTypeDescriptor } from '../types';

export const numberDescriptor: QuestionTypeDescriptor<NumberQuestion> = {
  type: 'number',
  category: 'numeric',
  label: { fr: 'Nombre', en: 'Number' },
  icon: 'number',
  hasValue: true,
  supportsChoices: false,

  createDefault: (name, id) => ({
    id,
    name,
    type: 'number',
    title: { fr: 'Question numérique', en: 'Number question' },
  }),

  properties: [
    {
      name: 'min',
      label: { fr: 'Valeur minimale', en: 'Minimum' },
      editor: 'number',
      group: 'validation',
    },
    {
      name: 'max',
      label: { fr: 'Valeur maximale', en: 'Maximum' },
      editor: 'number',
      group: 'validation',
    },
    {
      name: 'step',
      label: { fr: 'Pas', en: 'Step' },
      editor: 'number',
      group: 'options',
      min: 0,
    },
    {
      name: 'unit',
      label: { fr: 'Unité', en: 'Unit' },
      editor: 'localizedText',
      group: 'options',
    },
  ],

  isEmpty: isEmptyValue,
  // Le champ HTML rend une chaîne : on stocke un nombre pour que les comparaisons
  // d'expressions (`{montant} > 1000`) et le reporting travaillent sur le bon type.
  normalizeValue: (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  },
  getDisplayValue: (value, question, { locale }) => {
    if (isEmptyValue(value)) return '';
    const unit = resolveText(question.unit, locale);
    return unit === '' ? String(value) : `${String(value)} ${unit}`;
  },
};

export const dateDescriptor: QuestionTypeDescriptor<DateQuestion> = {
  type: 'date',
  category: 'numeric',
  label: { fr: 'Date', en: 'Date' },
  icon: 'calendar',
  hasValue: true,
  supportsChoices: false,

  createDefault: (name, id) => ({
    id,
    name,
    type: 'date',
    title: { fr: 'Question date', en: 'Date question' },
  }),

  properties: [
    {
      name: 'min',
      label: { fr: 'Date minimale', en: 'Minimum date' },
      editor: 'text',
      group: 'validation',
      placeholder: 'AAAA-MM-JJ',
    },
    {
      name: 'max',
      label: { fr: 'Date maximale', en: 'Maximum date' },
      editor: 'text',
      group: 'validation',
      placeholder: 'AAAA-MM-JJ',
    },
  ],

  isEmpty: isEmptyValue,
  // Stockage systématique en ISO `YYYY-MM-DD` : indépendant du fuseau et de la locale,
  // donc directement comparable en base et dans les expressions de date.
  normalizeValue: (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    return String(value);
  },
  getDisplayValue: (value, _question, { locale }) => {
    if (isEmptyValue(value)) return '';
    const parsed = new Date(`${String(value)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB');
  },
};
