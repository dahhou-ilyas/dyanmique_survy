import { useMemo, useState, type ReactNode } from 'react';
import { BUILTIN_FUNCTION_NAMES, FUNCTION_SIGNATURES } from '../../../core/expressions/functions';
import { checkExpression } from '../../../core/expressions/parser';
import { collectQuestions } from '../../../core/schema/traverse';
import { useBuilder, useBuilderContext } from '../../BuilderProvider';
import { AlertIcon } from '../../icons';
import type { EditorProps } from './SimpleEditors';

/**
 * Éditeur d'expression conditionnelle.
 *
 * Valide à la frappe et propose les `{noms}` disponibles : sans cela, l'auteur
 * métier écrit une condition à l'aveugle et ne découvre la faute qu'au moment
 * où un répondant tombe sur un questionnaire qui ne se comporte pas comme prévu.
 */
export function ExpressionEditor({ value, onChange, id }: EditorProps): ReactNode {
  const { t, text } = useBuilderContext();
  const survey = useBuilder((state) => state.survey);
  const selection = useBuilder((state) => state.selection);
  const [helpOpen, setHelpOpen] = useState(false);

  const expression = String(value ?? '');
  const check = useMemo(() => checkExpression(expression), [expression]);

  const fields = useMemo(() => {
    const currentId = selection.kind === 'element' ? selection.id : undefined;
    return [
      ...collectQuestions(survey)
        // Se référencer soi-même dans sa propre condition n'a pas de sens.
        .filter((question) => question.id !== currentId)
        .map((question) => ({
          name: question.name,
          label: text(question.title) || question.name,
        })),
      ...(survey.calculatedValues ?? []).map((calculated) => ({
        name: calculated.name,
        label: calculated.name,
      })),
    ];
  }, [survey, selection, text]);

  const insert = (token: string): void => {
    const separator = expression === '' || expression.endsWith(' ') ? '' : ' ';
    onChange(`${expression}${separator}${token}`);
  };

  return (
    <div className="edbs-expression">
      <textarea
        id={id}
        className={`edbs-textarea edbs-expression__input${check.valid ? '' : ' edbs-expression__input--invalid'}`}
        rows={2}
        spellCheck={false}
        value={expression}
        placeholder="{question1} = 'oui'"
        aria-invalid={check.valid ? undefined : true}
        onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
      />

      {!check.valid && (
        <p className="edbs-expression__error" role="alert">
          <AlertIcon />
          {check.error?.message.split('\n')[0] ?? t('expressionInvalid')}
        </p>
      )}

      <button
        type="button"
        className="edbs-btn edbs-btn--ghost edbs-expression__toggle"
        aria-expanded={helpOpen}
        onClick={() => setHelpOpen((open) => !open)}
      >
        {t('expressionHelp')}
      </button>

      {helpOpen && (
        <div className="edbs-expression__help">
          <p className="edbs-field__label">{t('availableFields')}</p>
          <div className="edbs-expression__tokens">
            {fields.length === 0 && <span className="edbs-field__hint">—</span>}
            {fields.map((field) => (
              <button
                key={field.name}
                type="button"
                className="edbs-token"
                title={field.label}
                onClick={() => insert(`{${field.name}}`)}
              >
                {`{${field.name}}`}
              </button>
            ))}
          </div>

          <p className="edbs-field__label">Opérateurs</p>
          <div className="edbs-expression__tokens">
            {[
              '=',
              '!=',
              '>',
              '<',
              '>=',
              '<=',
              'and',
              'or',
              'contains',
              'anyof',
              'empty',
              'notempty',
            ].map((operator) => (
              <button
                key={operator}
                type="button"
                className="edbs-token"
                onClick={() => insert(operator)}
              >
                {operator}
              </button>
            ))}
          </div>

          <p className="edbs-field__label">Fonctions</p>
          <div className="edbs-expression__tokens">
            {BUILTIN_FUNCTION_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                className="edbs-token"
                title={FUNCTION_SIGNATURES[name]}
                onClick={() => insert(`${name}()`)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
