import { useMemo, type ReactNode } from 'react';
import { validateSurveyDefinition } from '../../core/validation/validateSurvey';
import { useBuilder, useBuilderContext } from '../BuilderProvider';
import { AlertIcon, CheckIcon } from '../icons';

/**
 * Contrôles de conception, affichés en permanence sous le canevas.
 *
 * Le cahier des charges veut un module administrable par des non-techniciens :
 * un nom dupliqué ou une référence cassée doit se voir au moment où on la crée,
 * pas au moment où un client tombe sur un questionnaire incohérent.
 */
export function DiagnosticsPanel(): ReactNode {
  const { t, store } = useBuilderContext();
  const survey = useBuilder((state) => state.survey);
  const result = useMemo(() => validateSurveyDefinition(survey), [survey]);

  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');

  if (result.diagnostics.length === 0) {
    return (
      <div className="edbs-diagnostics edbs-diagnostics--ok">
        <CheckIcon />
        {t('diagnosticsNone')}
      </div>
    );
  }

  return (
    <details className="edbs-diagnostics" open={errors.length > 0}>
      <summary>
        <AlertIcon />
        {`${t('diagnostics')} — ${errors.length} ${t('errors')}, ${warnings.length} ${t('warnings')}`}
      </summary>
      <ul className="edbs-diagnostics__list">
        {result.diagnostics.map((diagnostic, index) => (
          <li key={index} className={`edbs-diagnostics__item edbs-diagnostics__item--${diagnostic.severity}`}>
            {diagnostic.elementId ? (
              <button
                type="button"
                className="edbs-link"
                onClick={() =>
                  store.getState().select({ kind: 'element', id: diagnostic.elementId! })
                }
              >
                {diagnostic.message}
              </button>
            ) : (
              <span>{diagnostic.message}</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
