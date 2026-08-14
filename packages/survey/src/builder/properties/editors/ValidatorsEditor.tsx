import type { ReactNode } from 'react';
import { resolveText, setLocalizedText } from '../../../core/localization/resolveText';
import type { LocalizedString, Validator, ValidatorType } from '../../../core/schema/types';
import { useBuilderContext } from '../../BuilderProvider';
import { PlusIcon, TrashIcon } from '../../icons';
import type { EditorProps } from './SimpleEditors';

const VALIDATOR_LABELS: Record<ValidatorType, { fr: string; en: string }> = {
  email: { fr: 'Adresse e-mail', en: 'Email address' },
  regex: { fr: 'Format (expression régulière)', en: 'Pattern (regular expression)' },
  numeric: { fr: 'Plage numérique', en: 'Numeric range' },
  text: { fr: 'Longueur du texte', en: 'Text length' },
  expression: { fr: 'Expression personnalisée', en: 'Custom expression' },
};

const VALIDATOR_TYPES: ValidatorType[] = ['email', 'regex', 'numeric', 'text', 'expression'];

function createValidator(type: ValidatorType): Validator {
  switch (type) {
    case 'regex':
      return { type: 'regex', regex: '' };
    case 'numeric':
      return { type: 'numeric' };
    case 'text':
      return { type: 'text' };
    case 'expression':
      return { type: 'expression', expression: '' };
    default:
      return { type: 'email' };
  }
}

/** Règles de validation d'une question, ajoutables sans écrire de code. */
export function ValidatorsEditor({ value, onChange }: EditorProps): ReactNode {
  const { locale, t } = useBuilderContext();
  const validators = Array.isArray(value) ? (value as Validator[]) : [];

  const update = (index: number, changes: Partial<Validator>): void => {
    onChange(
      validators.map((validator, i) =>
        i === index ? ({ ...validator, ...changes } as Validator) : validator,
      ),
    );
  };

  const remove = (index: number): void => {
    const next = validators.filter((_, i) => i !== index);
    onChange(next.length === 0 ? undefined : next);
  };

  return (
    <div className="edbs-validators">
      {validators.map((validator, index) => (
        <fieldset key={index} className="edbs-validators__item">
          <legend className="edbs-visually-hidden">
            {`${t('validatorType')} ${index + 1}`}
          </legend>

          <div className="edbs-validators__head">
            <select
              className="edbs-select"
              aria-label={`${t('validatorType')} ${index + 1}`}
              value={validator.type}
              onChange={(event) => {
                // Changer de type reconstruit la règle : les champs de l'ancien
                // type n'ont aucun sens pour le nouveau.
                const next = createValidator(event.target.value as ValidatorType);
                onChange(validators.map((current, i) => (i === index ? next : current)));
              }}
            >
              {VALIDATOR_TYPES.map((type) => (
                <option key={type} value={type}>
                  {VALIDATOR_LABELS[type][locale]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="edbs-icon-btn edbs-icon-btn--danger"
              aria-label={`${t('delete')} ${index + 1}`}
              onClick={() => remove(index)}
            >
              <TrashIcon />
            </button>
          </div>

          {validator.type === 'regex' && (
            <input
              className="edbs-input"
              type="text"
              spellCheck={false}
              placeholder="^[0-9]{5}$"
              aria-label="Expression régulière"
              value={validator.regex}
              onChange={(event) => update(index, { regex: event.target.value } as Partial<Validator>)}
            />
          )}

          {validator.type === 'numeric' && (
            <div className="edbs-validators__pair">
              <input
                className="edbs-input"
                type="number"
                placeholder="min"
                aria-label="Valeur minimale"
                value={validator.minValue ?? ''}
                onChange={(event) =>
                  update(index, {
                    minValue: event.target.value === '' ? undefined : Number(event.target.value),
                  } as Partial<Validator>)
                }
              />
              <input
                className="edbs-input"
                type="number"
                placeholder="max"
                aria-label="Valeur maximale"
                value={validator.maxValue ?? ''}
                onChange={(event) =>
                  update(index, {
                    maxValue: event.target.value === '' ? undefined : Number(event.target.value),
                  } as Partial<Validator>)
                }
              />
            </div>
          )}

          {validator.type === 'text' && (
            <div className="edbs-validators__pair">
              <input
                className="edbs-input"
                type="number"
                min={0}
                placeholder="min"
                aria-label="Longueur minimale"
                value={validator.minLength ?? ''}
                onChange={(event) =>
                  update(index, {
                    minLength: event.target.value === '' ? undefined : Number(event.target.value),
                  } as Partial<Validator>)
                }
              />
              <input
                className="edbs-input"
                type="number"
                min={1}
                placeholder="max"
                aria-label="Longueur maximale"
                value={validator.maxLength ?? ''}
                onChange={(event) =>
                  update(index, {
                    maxLength: event.target.value === '' ? undefined : Number(event.target.value),
                  } as Partial<Validator>)
                }
              />
            </div>
          )}

          {validator.type === 'expression' && (
            <input
              className="edbs-input"
              type="text"
              spellCheck={false}
              placeholder="{montant} <= {plafond}"
              aria-label="Expression de validation"
              value={validator.expression}
              onChange={(event) =>
                update(index, { expression: event.target.value } as Partial<Validator>)
              }
            />
          )}

          <input
            className="edbs-input"
            type="text"
            placeholder={t('customMessage')}
            aria-label={`${t('customMessage')} ${index + 1}`}
            value={resolveText(validator.text, locale)}
            onChange={(event) => {
              const next = setLocalizedText(
                validator.text as LocalizedString | undefined,
                locale,
                event.target.value,
              );
              update(index, { text: next === '' ? undefined : next } as Partial<Validator>);
            }}
          />
        </fieldset>
      ))}

      <button
        type="button"
        className="edbs-btn edbs-btn--secondary"
        onClick={() => onChange([...validators, createValidator('email')])}
      >
        <PlusIcon />
        {t('addValidator')}
      </button>
    </div>
  );
}
