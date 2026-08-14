import { resolveText } from '../../localization/resolveText';
import type { BooleanQuestion, NpsQuestion, RatingQuestion } from '../../schema/types';
import { isEmptyValue } from '../commonProperties';
import type { QuestionTypeDescriptor } from '../types';

export const DEFAULT_RATE_MAX = 5;

/** Bornes NPS — fixées par la méthode, jamais configurables. */
export const NPS_MIN = 0;
export const NPS_MAX = 10;

export const ratingDescriptor: QuestionTypeDescriptor<RatingQuestion> = {
  type: 'rating',
  category: 'rating',
  label: { fr: 'Échelle de notation', en: 'Rating' },
  icon: 'star',
  hasValue: true,
  supportsChoices: false,

  createDefault: (name, id) => ({
    id,
    name,
    type: 'rating',
    title: { fr: 'Question de notation', en: 'Rating question' },
    rateMax: DEFAULT_RATE_MAX,
    rateType: 'stars',
  }),

  properties: [
    {
      name: 'rateType',
      label: { fr: 'Affichage', en: 'Display' },
      editor: 'select',
      group: 'options',
      options: [
        { value: 'stars', label: { fr: 'Étoiles', en: 'Stars' } },
        { value: 'numbers', label: { fr: 'Nombres', en: 'Numbers' } },
        { value: 'smileys', label: { fr: 'Émoticônes', en: 'Smileys' } },
      ],
    },
    {
      name: 'rateMax',
      label: { fr: 'Nombre de crans', en: 'Number of steps' },
      editor: 'number',
      group: 'options',
      min: 2,
      max: 10,
    },
    {
      name: 'minRateDescription',
      label: { fr: 'Légende du minimum', en: 'Minimum label' },
      editor: 'localizedText',
      group: 'options',
    },
    {
      name: 'maxRateDescription',
      label: { fr: 'Légende du maximum', en: 'Maximum label' },
      editor: 'localizedText',
      group: 'options',
    },
  ],

  isEmpty: isEmptyValue,
  normalizeValue: (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  },
  getDisplayValue: (value, question, { locale }) => {
    if (isEmptyValue(value)) return '';
    const max = question.rateMax ?? DEFAULT_RATE_MAX;
    const base = `${String(value)}/${max}`;
    const legend =
      value === 1
        ? resolveText(question.minRateDescription, locale)
        : value === max
          ? resolveText(question.maxRateDescription, locale)
          : '';
    return legend === '' ? base : `${base} (${legend})`;
  },
};

export const npsDescriptor: QuestionTypeDescriptor<NpsQuestion> = {
  type: 'nps',
  category: 'rating',
  label: { fr: 'Score NPS', en: 'NPS score' },
  icon: 'gauge',
  hasValue: true,
  supportsChoices: false,

  createDefault: (name, id) => ({
    id,
    name,
    type: 'nps',
    title: {
      fr: 'Quelle est la probabilité que vous nous recommandiez ?',
      en: 'How likely are you to recommend us?',
    },
    minDescription: { fr: 'Pas du tout probable', en: 'Not at all likely' },
    maxDescription: { fr: 'Très probable', en: 'Extremely likely' },
  }),

  properties: [
    {
      name: 'minDescription',
      label: { fr: 'Légende du 0', en: 'Label for 0' },
      editor: 'localizedText',
      group: 'options',
    },
    {
      name: 'maxDescription',
      label: { fr: 'Légende du 10', en: 'Label for 10' },
      editor: 'localizedText',
      group: 'options',
    },
  ],

  isEmpty: isEmptyValue,
  normalizeValue: (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  },
  getDisplayValue: (value) => {
    if (isEmptyValue(value)) return '';
    const score = Number(value);
    // Segmentation standard NPS : elle est portée ici pour que le rapport soit
    // exploitable sans post-traitement côté backend.
    const segment = score >= 9 ? 'Promoteur' : score >= 7 ? 'Passif' : 'Détracteur';
    return `${score}/${NPS_MAX} (${segment})`;
  },
};

export const booleanDescriptor: QuestionTypeDescriptor<BooleanQuestion> = {
  type: 'boolean',
  category: 'rating',
  label: { fr: 'Oui / Non', en: 'Yes / No' },
  icon: 'toggle',
  hasValue: true,
  supportsChoices: false,

  createDefault: (name, id) => ({
    id,
    name,
    type: 'boolean',
    title: { fr: 'Question oui / non', en: 'Yes / no question' },
    labelTrue: { fr: 'Oui', en: 'Yes' },
    labelFalse: { fr: 'Non', en: 'No' },
    renderAs: 'radio',
  }),

  properties: [
    {
      name: 'renderAs',
      label: { fr: 'Affichage', en: 'Display' },
      editor: 'select',
      group: 'options',
      options: [
        { value: 'radio', label: { fr: 'Boutons radio', en: 'Radio buttons' } },
        { value: 'switch', label: { fr: 'Interrupteur', en: 'Switch' } },
      ],
    },
    {
      name: 'labelTrue',
      label: { fr: 'Libellé « vrai »', en: 'True label' },
      editor: 'localizedText',
      group: 'options',
    },
    {
      name: 'labelFalse',
      label: { fr: 'Libellé « faux »', en: 'False label' },
      editor: 'localizedText',
      group: 'options',
    },
  ],

  // `false` est une réponse valide : seul `undefined`/`null` compte comme absence.
  isEmpty: (value) => value === undefined || value === null,
  normalizeValue: (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1' || value === 1;
  },
  getDisplayValue: (value, question, { locale }) => {
    if (value === undefined || value === null) return '';
    return value
      ? resolveText(question.labelTrue, locale) || 'Oui'
      : resolveText(question.labelFalse, locale) || 'Non';
  },
};
