import type { ComponentType } from 'react';
import { CheckboxField, DropdownField, RadioGroupField } from './components/fields/ChoiceFields';
import { HtmlBlock } from './components/fields/HtmlBlock';
import { DateField, NumberField } from './components/fields/NumericFields';
import { BooleanField, NpsField, RatingField } from './components/fields/RatingFields';
import { CommentField, TextField } from './components/fields/TextFields';
import type { FieldProps } from './types';

/**
 * Association type de question → composant de rendu.
 *
 * C'est le pendant React du registre de descripteurs : enregistrer un descripteur
 * dans `questionRegistry` et un composant ici suffit à faire vivre un nouveau type
 * dans le moteur de rendu **et** dans le builder.
 *
 *   <SurveyRenderer components={{ ...defaultFieldComponents, signature: MonChamp }} />
 */
export type FieldComponents = Record<string, ComponentType<FieldProps<never>>>;

export const defaultFieldComponents = {
  text: TextField,
  comment: CommentField,
  radiogroup: RadioGroupField,
  checkbox: CheckboxField,
  dropdown: DropdownField,
  date: DateField,
  number: NumberField,
  rating: RatingField,
  nps: NpsField,
  boolean: BooleanField,
  html: HtmlBlock,
} as unknown as FieldComponents;
