import { evaluateCondition, type EvaluationContext } from '../expressions/evaluate';
import { toDate, toNumber } from '../expressions/values';
import { questionRegistry } from '../registry/questionRegistry';
import type { LocalizedString, Question, Validator } from '../schema/types';

/**
 * Une erreur de validation ne porte **pas** de message rédigé mais une clé i18n
 * et ses paramètres : le texte est résolu à l'affichage, dans la langue courante.
 * `customText` prend le pas lorsque l'auteur a saisi son propre message.
 */
export interface ValidationError {
  key: ValidationErrorKey;
  params?: Record<string, string | number>;
  customText?: LocalizedString;
}

export type ValidationErrorKey =
  | 'required'
  | 'invalidEmail'
  | 'invalidFormat'
  | 'invalidNumber'
  | 'numericMin'
  | 'numericMax'
  | 'numericRange'
  | 'textMinLength'
  | 'textMaxLength'
  | 'minSelected'
  | 'maxSelected'
  | 'dateMin'
  | 'dateMax'
  | 'invalidDate'
  | 'expressionFailed';

// Volontairement pragmatique : rejette les fautes de frappe courantes sans
// prétendre implémenter la RFC 5322, dont l'exhaustivité produirait des faux négatifs.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function textLength(value: unknown): number {
  return typeof value === 'string' ? value.length : String(value ?? '').length;
}

function applyValidator(
  validator: Validator,
  value: unknown,
  context: EvaluationContext,
): ValidationError | undefined {
  const customText = validator.text;

  switch (validator.type) {
    case 'email':
      return EMAIL_PATTERN.test(String(value))
        ? undefined
        : { key: 'invalidEmail', ...(customText ? { customText } : {}) };

    case 'regex': {
      let pattern: RegExp;
      try {
        pattern = new RegExp(validator.regex);
      } catch {
        // Une expression régulière invalide est un défaut de configuration :
        // elle ne doit pas bloquer un utilisateur en cours de saisie.
        return undefined;
      }
      return pattern.test(String(value))
        ? undefined
        : { key: 'invalidFormat', ...(customText ? { customText } : {}) };
    }

    case 'numeric': {
      const numeric = toNumber(value);
      if (numeric === undefined) {
        return { key: 'invalidNumber', ...(customText ? { customText } : {}) };
      }
      const { minValue, maxValue } = validator;
      if (minValue !== undefined && maxValue !== undefined) {
        if (numeric < minValue || numeric > maxValue) {
          return {
            key: 'numericRange',
            params: { min: minValue, max: maxValue },
            ...(customText ? { customText } : {}),
          };
        }
        return undefined;
      }
      if (minValue !== undefined && numeric < minValue) {
        return { key: 'numericMin', params: { min: minValue }, ...(customText ? { customText } : {}) };
      }
      if (maxValue !== undefined && numeric > maxValue) {
        return { key: 'numericMax', params: { max: maxValue }, ...(customText ? { customText } : {}) };
      }
      return undefined;
    }

    case 'text': {
      const length = textLength(value);
      const { minLength, maxLength } = validator;
      if (minLength !== undefined && length < minLength) {
        return {
          key: 'textMinLength',
          params: { min: minLength },
          ...(customText ? { customText } : {}),
        };
      }
      if (maxLength !== undefined && length > maxLength) {
        return {
          key: 'textMaxLength',
          params: { max: maxLength },
          ...(customText ? { customText } : {}),
        };
      }
      return undefined;
    }

    case 'expression':
      // Une expression absente ou cassée ne doit pas invalider la réponse :
      // `fallback: true` fait passer la règle comme si elle n'existait pas.
      return evaluateCondition(validator.expression, context, true)
        ? undefined
        : { key: 'expressionFailed', ...(customText ? { customText } : {}) };

    default:
      return undefined;
  }
}

/** Contraintes portées par la question elle-même (min/max, longueur, sélections). */
function validateTypeConstraints(question: Question, value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (question.type) {
    case 'text':
    case 'comment': {
      if (question.maxLength !== undefined && textLength(value) > question.maxLength) {
        errors.push({ key: 'textMaxLength', params: { max: question.maxLength } });
      }
      if (question.type === 'text' && question.inputType === 'email') {
        if (!EMAIL_PATTERN.test(String(value))) errors.push({ key: 'invalidEmail' });
      }
      break;
    }

    case 'number': {
      const numeric = toNumber(value);
      if (numeric === undefined) {
        errors.push({ key: 'invalidNumber' });
        break;
      }
      if (question.min !== undefined && numeric < question.min) {
        errors.push({ key: 'numericMin', params: { min: question.min } });
      }
      if (question.max !== undefined && numeric > question.max) {
        errors.push({ key: 'numericMax', params: { max: question.max } });
      }
      break;
    }

    case 'date': {
      const date = toDate(value);
      if (!date) {
        errors.push({ key: 'invalidDate' });
        break;
      }
      const min = question.min ? toDate(question.min) : undefined;
      const max = question.max ? toDate(question.max) : undefined;
      if (min && date.getTime() < min.getTime()) {
        errors.push({ key: 'dateMin', params: { min: question.min ?? '' } });
      }
      if (max && date.getTime() > max.getTime()) {
        errors.push({ key: 'dateMax', params: { max: question.max ?? '' } });
      }
      break;
    }

    case 'checkbox': {
      const count = Array.isArray(value) ? value.length : 0;
      if (question.minSelectedChoices !== undefined && count < question.minSelectedChoices) {
        errors.push({ key: 'minSelected', params: { min: question.minSelectedChoices } });
      }
      if (question.maxSelectedChoices !== undefined && count > question.maxSelectedChoices) {
        errors.push({ key: 'maxSelected', params: { max: question.maxSelectedChoices } });
      }
      break;
    }

    default:
      break;
  }

  return errors;
}

export interface ValidateQuestionOptions {
  /** Obligation effective, `requiredIf` déjà résolu par le moteur. */
  isRequired: boolean;
  context: EvaluationContext;
}

/**
 * Valide la réponse à une question.
 *
 * Une question vide et facultative ne déclenche **aucune** règle de format : signaler
 * « adresse e-mail invalide » sur un champ qu'on a le droit de laisser vide serait faux.
 */
export function validateQuestion(
  question: Question,
  value: unknown,
  { isRequired, context }: ValidateQuestionOptions,
): ValidationError[] {
  const descriptor = questionRegistry.get(question.type);
  if (!descriptor || !descriptor.hasValue) return [];

  const empty = descriptor.isEmpty(value);

  if (empty) {
    if (!isRequired) return [];
    return [
      {
        key: 'required',
        ...(question.requiredErrorText ? { customText: question.requiredErrorText } : {}),
      },
    ];
  }

  const errors = validateTypeConstraints(question, value);

  for (const validator of question.validators ?? []) {
    const error = applyValidator(validator, value, context);
    if (error) errors.push(error);
  }

  return errors;
}
