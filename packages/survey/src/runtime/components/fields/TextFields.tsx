import type { ReactNode } from 'react';
import type { CommentQuestion, TextQuestion } from '../../../core/schema/types';
import { useSurveyContext } from '../../SurveyProvider';
import type { FieldProps } from '../../types';

export function TextField({
  question,
  snapshot,
  id,
  describedBy,
  onChange,
}: FieldProps<TextQuestion>): ReactNode {
  const { text } = useSurveyContext();
  const invalid = snapshot.showErrors && snapshot.errors.length > 0;

  return (
    <input
      id={id}
      className="edbs-input"
      type={question.inputType ?? 'text'}
      value={String(snapshot.value ?? '')}
      placeholder={text(question.placeholder) || undefined}
      disabled={!snapshot.enabled}
      required={snapshot.required}
      aria-required={snapshot.required || undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      autoComplete={autoCompleteFor(question)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * Renseigne `autocomplete` quand le type de saisie le permet : sur un formulaire
 * bancaire, l'auto-remplissage du navigateur épargne des erreurs de frappe.
 */
function autoCompleteFor(question: TextQuestion): string | undefined {
  switch (question.inputType) {
    case 'email':
      return 'email';
    case 'tel':
      return 'tel';
    case 'url':
      return 'url';
    case 'password':
      return 'current-password';
    default:
      return undefined;
  }
}

export function CommentField({
  question,
  snapshot,
  id,
  describedBy,
  onChange,
}: FieldProps<CommentQuestion>): ReactNode {
  const { text, t } = useSurveyContext();
  const invalid = snapshot.showErrors && snapshot.errors.length > 0;
  const value = String(snapshot.value ?? '');
  const { maxLength } = question;

  // Volontairement pas d'attribut `maxlength` : tronquer silencieusement un
  // texte collé est pire qu'un message. Le compteur avertit, la validation tranche.
  const remaining = maxLength === undefined ? undefined : maxLength - value.length;
  const counterId = maxLength === undefined ? undefined : `${id}-counter`;

  return (
    <>
      <textarea
        id={id}
        className="edbs-textarea"
        rows={question.rows ?? 4}
        value={value}
        placeholder={text(question.placeholder) || undefined}
        disabled={!snapshot.enabled}
        required={snapshot.required}
        aria-required={snapshot.required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={[describedBy, counterId].filter(Boolean).join(' ') || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {remaining !== undefined && question.showCharacterCounter !== false && (
        <div
          id={counterId}
          className={`edbs-counter${remaining < 0 ? ' edbs-counter--over' : ''}`}
          aria-live="polite"
        >
          {remaining < 0
            ? t('charactersOver', { over: -remaining })
            : t('charactersRemaining', { remaining })}
        </div>
      )}
    </>
  );
}
