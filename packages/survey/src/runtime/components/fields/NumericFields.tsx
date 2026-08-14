import type { ReactNode } from 'react';
import type { DateQuestion, NumberQuestion } from '../../../core/schema/types';
import { useSurveyContext } from '../../SurveyProvider';
import type { FieldProps } from '../../types';

export function NumberField({
  question,
  snapshot,
  id,
  describedBy,
  onChange,
}: FieldProps<NumberQuestion>): ReactNode {
  const { text } = useSurveyContext();
  const invalid = snapshot.showErrors && snapshot.errors.length > 0;
  const unit = text(question.unit);

  const input = (
    <input
      id={id}
      className="edbs-input"
      type="number"
      inputMode={question.step !== undefined && question.step < 1 ? 'decimal' : 'numeric'}
      value={snapshot.value === undefined || snapshot.value === null ? '' : String(snapshot.value)}
      min={question.min}
      max={question.max}
      step={question.step}
      disabled={!snapshot.enabled}
      required={snapshot.required}
      aria-required={snapshot.required || undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    />
  );

  if (unit === '') return input;

  return (
    <div className="edbs-input-group">
      {input}
      {/* L'unité est déjà annoncée dans le libellé résolu : purement visuelle ici. */}
      <span className="edbs-input-group__unit" aria-hidden="true">
        {unit}
      </span>
    </div>
  );
}

export function DateField({
  question,
  snapshot,
  id,
  describedBy,
  onChange,
}: FieldProps<DateQuestion>): ReactNode {
  const invalid = snapshot.showErrors && snapshot.errors.length > 0;

  return (
    <input
      id={id}
      className="edbs-input"
      type="date"
      value={String(snapshot.value ?? '')}
      min={question.min}
      max={question.max}
      disabled={!snapshot.enabled}
      required={snapshot.required}
      aria-required={snapshot.required || undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
