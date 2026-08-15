import type { ReactNode } from 'react';
import { walkElements } from '../../core/schema/traverse';
import { isPanel, type SurveyDefinition } from '../../core/schema/types';
import { useBuilder, useBuilderContext } from '../BuilderProvider';

interface LogicRow {
  elementId: string | null;
  element: string;
  rule: string;
  expression: string;
}

const RULE_LABELS: Record<string, string> = {
  visibleIf: 'Afficher si',
  enableIf: 'Activer si',
  requiredIf: 'Obligatoire si',
  choicesVisibleIf: 'Filtrer les options si',
};

/**
 * Vue d'ensemble de toutes les règles conditionnelles du sondage.
 *
 * Elles sont réparties dans les propriétés de chaque question ; les rassembler
 * permet de relire un parcours complet — et de repérer une règle oubliée sur une
 * page qu'on n'ouvre plus.
 */
function collectRows(survey: SurveyDefinition): LogicRow[] {
  const rows: LogicRow[] = [];

  const push = (
    elementId: string | null,
    element: string,
    rule: string,
    expression?: string,
  ): void => {
    if (!expression || expression.trim() === '') return;
    rows.push({ elementId, element, rule, expression });
  };

  for (const page of survey.pages) {
    push(page.id, `Page « ${page.name} »`, RULE_LABELS.visibleIf!, page.visibleIf);

    walkElements(page.elements, (element) => {
      const label = element.name;
      push(element.id, label, RULE_LABELS.visibleIf!, element.visibleIf);
      push(element.id, label, RULE_LABELS.enableIf!, element.enableIf);
      if (isPanel(element)) return;
      push(element.id, label, RULE_LABELS.requiredIf!, element.requiredIf);
      if ('choicesVisibleIf' in element) {
        push(element.id, label, RULE_LABELS.choicesVisibleIf!, element.choicesVisibleIf);
      }
      for (const validator of element.validators ?? []) {
        if (validator.type === 'expression') {
          push(element.id, label, 'Validation', validator.expression);
        }
      }
    });
  }

  for (const calculated of survey.calculatedValues ?? []) {
    push(null, `Valeur calculée « ${calculated.name} »`, 'Calcul', calculated.expression);
  }

  (survey.triggers ?? []).forEach((trigger, index) => {
    push(null, `Déclencheur ${index + 1}`, trigger.type, trigger.expression);
  });

  return rows;
}

export function LogicTab(): ReactNode {
  const { t, store } = useBuilderContext();
  const survey = useBuilder((state) => state.survey);
  const rows = collectRows(survey);

  if (rows.length === 0) {
    return <p className="edbs-tab__empty">{t('logicEmpty')}</p>;
  }

  return (
    <div className="edbs-logic">
      <table className="edbs-table">
        <thead>
          <tr>
            <th scope="col">{t('logicElement')}</th>
            <th scope="col">{t('logicRule')}</th>
            <th scope="col">{t('logicExpression')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>
                {row.elementId ? (
                  <button
                    type="button"
                    className="edbs-link"
                    onClick={() => store.getState().select({ kind: 'element', id: row.elementId! })}
                  >
                    {row.element}
                  </button>
                ) : (
                  row.element
                )}
              </td>
              <td>{row.rule}</td>
              <td>
                <code className="edbs-code edbs-code--inline">{row.expression}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
