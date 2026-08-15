import type { Locale } from '../core/schema/types';

/**
 * Libellés de l'interface et messages de validation.
 *
 * Les erreurs de validation circulent dans le moteur sous forme de clés
 * (`ValidationErrorKey`) et ne sont traduites qu'ici, au moment de l'affichage :
 * changer de langue en cours de sondage ne demande donc aucune revalidation.
 */

export interface Messages {
  /* Validation */
  required: string;
  invalidEmail: string;
  invalidFormat: string;
  invalidNumber: string;
  invalidDate: string;
  numericMin: string;
  numericMax: string;
  numericRange: string;
  textMinLength: string;
  textMaxLength: string;
  minSelected: string;
  maxSelected: string;
  dateMin: string;
  dateMax: string;
  expressionFailed: string;

  /* Navigation */
  previous: string;
  next: string;
  complete: string;
  pageProgress: string;
  progressPercent: string;

  /* Question */
  requiredIndicator: string;
  requiredHint: string;
  otherLabel: string;
  otherPlaceholder: string;
  selectPlaceholder: string;
  charactersRemaining: string;
  charactersOver: string;
  ratingLegendLow: string;
  ratingLegendHigh: string;

  /* États */
  completeTitle: string;
  completeText: string;
  errorSummary: string;
  errorSummaryOne: string;
  emptySurvey: string;
  collapseGroup: string;
  expandGroup: string;
}

const fr: Messages = {
  required: 'Cette question est obligatoire.',
  invalidEmail: 'Saisissez une adresse e-mail valide.',
  invalidFormat: 'Le format saisi n’est pas valide.',
  invalidNumber: 'Saisissez un nombre.',
  invalidDate: 'Saisissez une date valide.',
  numericMin: 'La valeur doit être supérieure ou égale à {min}.',
  numericMax: 'La valeur doit être inférieure ou égale à {max}.',
  numericRange: 'La valeur doit être comprise entre {min} et {max}.',
  textMinLength: 'Saisissez au moins {min} caractères.',
  textMaxLength: 'Ne dépassez pas {max} caractères.',
  minSelected: 'Sélectionnez au moins {min} réponse(s).',
  maxSelected: 'Sélectionnez au plus {max} réponse(s).',
  dateMin: 'La date doit être postérieure ou égale au {min}.',
  dateMax: 'La date doit être antérieure ou égale au {max}.',
  expressionFailed: 'Cette réponse n’est pas valide.',

  previous: 'Précédent',
  next: 'Suivant',
  complete: 'Terminer',
  pageProgress: 'Page {current} sur {total}',
  progressPercent: '{percent} %',

  requiredIndicator: '*',
  requiredHint: 'obligatoire',
  otherLabel: 'Autre',
  otherPlaceholder: 'Précisez',
  selectPlaceholder: 'Sélectionnez…',
  charactersRemaining: '{remaining} caractères restants',
  charactersOver: '{over} caractères de trop',
  ratingLegendLow: 'Pas du tout probable',
  ratingLegendHigh: 'Très probable',

  completeTitle: 'Merci !',
  completeText: 'Vos réponses ont bien été enregistrées.',
  errorSummary: '{count} questions nécessitent votre attention.',
  errorSummaryOne: 'Une question nécessite votre attention.',
  emptySurvey: 'Ce sondage ne contient aucune question.',
  collapseGroup: 'Replier le groupe',
  expandGroup: 'Déplier le groupe',
};

const en: Messages = {
  required: 'This question is required.',
  invalidEmail: 'Enter a valid email address.',
  invalidFormat: 'The value does not match the expected format.',
  invalidNumber: 'Enter a number.',
  invalidDate: 'Enter a valid date.',
  numericMin: 'The value must be greater than or equal to {min}.',
  numericMax: 'The value must be less than or equal to {max}.',
  numericRange: 'The value must be between {min} and {max}.',
  textMinLength: 'Enter at least {min} characters.',
  textMaxLength: 'Do not exceed {max} characters.',
  minSelected: 'Select at least {min} answer(s).',
  maxSelected: 'Select at most {max} answer(s).',
  dateMin: 'The date must be on or after {min}.',
  dateMax: 'The date must be on or before {max}.',
  expressionFailed: 'This answer is not valid.',

  previous: 'Previous',
  next: 'Next',
  complete: 'Submit',
  pageProgress: 'Page {current} of {total}',
  progressPercent: '{percent}%',

  requiredIndicator: '*',
  requiredHint: 'required',
  otherLabel: 'Other',
  otherPlaceholder: 'Please specify',
  selectPlaceholder: 'Select…',
  charactersRemaining: '{remaining} characters remaining',
  charactersOver: '{over} characters over the limit',
  ratingLegendLow: 'Not at all likely',
  ratingLegendHigh: 'Extremely likely',

  completeTitle: 'Thank you!',
  completeText: 'Your answers have been recorded.',
  errorSummary: '{count} questions need your attention.',
  errorSummaryOne: 'One question needs your attention.',
  emptySurvey: 'This survey has no questions.',
  collapseGroup: 'Collapse group',
  expandGroup: 'Expand group',
};

export const messages: Record<Locale, Messages> = { fr, en };

export type MessageKey = keyof Messages;

/** Remplace les jetons `{nom}` d'un gabarit par leurs valeurs. */
export function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

/**
 * Traducteur pour une locale, avec surcharge partielle par l'application hôte.
 * Un libellé non surchargé retombe sur le dictionnaire intégré.
 */
export function createTranslator(locale: Locale, overrides?: Partial<Messages>): Translate {
  const dictionary = { ...messages[locale], ...overrides };
  return (key, params) => formatMessage(dictionary[key] ?? key, params);
}
