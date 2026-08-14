import type { CommentQuestion, TextQuestion } from '../../schema/types';
import { isEmptyValue } from '../commonProperties';
import type { QuestionTypeDescriptor } from '../types';

export const textDescriptor: QuestionTypeDescriptor<TextQuestion> = {
  type: 'text',
  category: 'text',
  label: { fr: 'Texte court', en: 'Single-line text' },
  icon: 'text',
  hasValue: true,
  supportsChoices: false,

  createDefault: (name, id) => ({
    id,
    name,
    type: 'text',
    title: { fr: 'Question texte', en: 'Text question' },
    inputType: 'text',
  }),

  properties: [
    {
      name: 'inputType',
      label: { fr: 'Type de saisie', en: 'Input type' },
      editor: 'select',
      group: 'options',
      options: [
        { value: 'text', label: { fr: 'Texte', en: 'Text' } },
        { value: 'email', label: { fr: 'E-mail', en: 'Email' } },
        { value: 'tel', label: { fr: 'Téléphone', en: 'Phone' } },
        { value: 'url', label: { fr: 'URL', en: 'URL' } },
        { value: 'password', label: { fr: 'Mot de passe', en: 'Password' } },
      ],
    },
    {
      name: 'placeholder',
      label: { fr: 'Aide de saisie', en: 'Placeholder' },
      editor: 'localizedText',
      group: 'options',
    },
    {
      name: 'maxLength',
      label: { fr: 'Longueur maximale', en: 'Max length' },
      editor: 'number',
      group: 'validation',
      min: 1,
    },
  ],

  isEmpty: isEmptyValue,
  normalizeValue: (value) => (typeof value === 'string' && value === '' ? undefined : value),
  getDisplayValue: (value) => (isEmptyValue(value) ? '' : String(value)),
};

export const commentDescriptor: QuestionTypeDescriptor<CommentQuestion> = {
  type: 'comment',
  category: 'text',
  label: { fr: 'Texte long', en: 'Long text' },
  icon: 'textarea',
  hasValue: true,
  supportsChoices: false,

  createDefault: (name, id) => ({
    id,
    name,
    type: 'comment',
    title: { fr: 'Question texte long', en: 'Long text question' },
    rows: 4,
  }),

  properties: [
    {
      name: 'placeholder',
      label: { fr: 'Aide de saisie', en: 'Placeholder' },
      editor: 'localizedText',
      group: 'options',
    },
    {
      name: 'rows',
      label: { fr: 'Hauteur (lignes)', en: 'Rows' },
      editor: 'number',
      group: 'layout',
      min: 2,
      max: 20,
    },
    {
      name: 'maxLength',
      label: { fr: 'Longueur maximale', en: 'Max length' },
      editor: 'number',
      group: 'validation',
      min: 1,
    },
    {
      name: 'showCharacterCounter',
      label: { fr: 'Afficher le compteur de caractères', en: 'Show character counter' },
      editor: 'boolean',
      group: 'options',
      isVisible: (element) => element.type === 'comment' && element.maxLength !== undefined,
    },
  ],

  isEmpty: isEmptyValue,
  normalizeValue: (value) => (typeof value === 'string' && value === '' ? undefined : value),
  getDisplayValue: (value) => (isEmptyValue(value) ? '' : String(value)),
};
