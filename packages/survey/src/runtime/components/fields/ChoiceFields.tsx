import type { ReactNode } from 'react';
import { OTHER_VALUE, otherCommentKey } from '../../../core/registry/descriptors/choice';
import type {
  CheckboxQuestion,
  Choice,
  ChoiceQuestion,
  DropdownQuestion,
  LocalizedString,
  RadioGroupQuestion,
} from '../../../core/schema/types';
import { useSurveyContext } from '../../SurveyProvider';
import { useSurveyState } from '../../hooks/useSurveyEngine';
import type { FieldProps } from '../../types';

function columnsClass(colCount: number | undefined): string {
  return colCount && colCount > 1 ? ` edbs-choices--cols-${colCount}` : '';
}

/** Champ libre associé à l'option « Autre », stocké sous une clé dédiée. */
function OtherInput({
  question,
  disabled,
}: {
  question: ChoiceQuestion;
  disabled: boolean;
}): ReactNode {
  const { engine, text, t } = useSurveyContext();
  const key = otherCommentKey(question.name);
  // Le texte libre de « Autre » n'est pas une question du sondage : il n'a donc
  // pas d'instantané dédié. On s'abonne à l'état global — le composant est petit
  // et n'apparaît que lorsque l'option est cochée.
  useSurveyState();
  const value = String(engine.getValue(key) ?? '');

  return (
    <div className="edbs-other">
      <input
        className="edbs-input"
        type="text"
        value={value}
        disabled={disabled}
        placeholder={text(question.otherPlaceholder) || t('otherPlaceholder')}
        aria-label={text(question.otherText) || t('otherLabel')}
        onChange={(event) => engine.setValue(key, event.target.value)}
      />
    </div>
  );
}

function choiceLabel(
  choice: Choice,
  resolve: (value: LocalizedString | undefined) => string,
): string {
  const label = resolve(choice.text);
  return label === '' ? String(choice.value) : label;
}

export function RadioGroupField({
  question,
  snapshot,
  id,
  describedBy,
  onChange,
}: FieldProps<RadioGroupQuestion>): ReactNode {
  const { text, t } = useSurveyContext();
  const invalid = snapshot.showErrors && snapshot.errors.length > 0;
  const options: Array<Choice & { isOther?: boolean }> = [...snapshot.visibleChoices];
  if (question.hasOther) {
    options.push({ value: OTHER_VALUE, text: question.otherText ?? t('otherLabel'), isOther: true });
  }

  return (
    <>
      <div
        className={`edbs-choices${columnsClass(question.colCount)}`}
        aria-describedby={describedBy}
      >
        {options.map((choice, index) => {
          const selected = snapshot.value === choice.value;
          const optionId = `${id}-${index}`;
          return (
            <label
              key={String(choice.value)}
              htmlFor={optionId}
              className={
                'edbs-choice' +
                (selected ? ' edbs-choice--selected' : '') +
                (snapshot.enabled ? '' : ' edbs-choice--disabled')
              }
            >
              <input
                id={optionId}
                className="edbs-choice__input"
                type="radio"
                name={question.name}
                value={String(choice.value)}
                checked={selected}
                disabled={!snapshot.enabled}
                aria-invalid={invalid || undefined}
                onChange={() => onChange(choice.value)}
              />
              <span className="edbs-choice__label">{choiceLabel(choice, text)}</span>
            </label>
          );
        })}
      </div>
      {question.hasOther && snapshot.value === OTHER_VALUE && (
        <OtherInput question={question} disabled={!snapshot.enabled} />
      )}
    </>
  );
}

export function CheckboxField({
  question,
  snapshot,
  id,
  describedBy,
  onChange,
}: FieldProps<CheckboxQuestion>): ReactNode {
  const { text, t } = useSurveyContext();
  const invalid = snapshot.showErrors && snapshot.errors.length > 0;
  const selected = Array.isArray(snapshot.value) ? snapshot.value : [];

  const options: Array<Choice & { isOther?: boolean }> = [...snapshot.visibleChoices];
  if (question.hasOther) {
    options.push({ value: OTHER_VALUE, text: question.otherText ?? t('otherLabel'), isOther: true });
  }

  const toggle = (value: Choice['value'], checked: boolean): void => {
    // L'ordre des options du sondage est conservé : le résultat reste lisible
    // quel que soit l'ordre dans lequel l'utilisateur a coché.
    const next = checked
      ? options.map((choice) => choice.value).filter((candidate) =>
          candidate === value ? true : selected.includes(candidate),
        )
      : selected.filter((candidate) => candidate !== value);
    onChange(next);
  };

  return (
    <>
      <div
        className={`edbs-choices${columnsClass(question.colCount)}`}
        aria-describedby={describedBy}
      >
        {options.map((choice, index) => {
          const isChecked = selected.includes(choice.value);
          const optionId = `${id}-${index}`;
          return (
            <label
              key={String(choice.value)}
              htmlFor={optionId}
              className={
                'edbs-choice' +
                (isChecked ? ' edbs-choice--selected' : '') +
                (snapshot.enabled ? '' : ' edbs-choice--disabled')
              }
            >
              <input
                id={optionId}
                className="edbs-choice__input"
                type="checkbox"
                value={String(choice.value)}
                checked={isChecked}
                disabled={!snapshot.enabled}
                aria-invalid={invalid || undefined}
                onChange={(event) => toggle(choice.value, event.target.checked)}
              />
              <span className="edbs-choice__label">{choiceLabel(choice, text)}</span>
            </label>
          );
        })}
      </div>
      {question.hasOther && selected.includes(OTHER_VALUE) && (
        <OtherInput question={question} disabled={!snapshot.enabled} />
      )}
    </>
  );
}

export function DropdownField({
  question,
  snapshot,
  id,
  describedBy,
  onChange,
}: FieldProps<DropdownQuestion>): ReactNode {
  const { text, t } = useSurveyContext();
  const invalid = snapshot.showErrors && snapshot.errors.length > 0;

  return (
    <>
      <select
        id={id}
        className="edbs-select"
        value={snapshot.value === undefined ? '' : String(snapshot.value)}
        disabled={!snapshot.enabled}
        required={snapshot.required}
        aria-required={snapshot.required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          // Retrouver la valeur d'origine : `<select>` ne rend que des chaînes,
          // or une option peut porter une valeur numérique.
          const match = snapshot.visibleChoices.find((choice) => String(choice.value) === raw);
          onChange(match ? match.value : raw);
        }}
      >
        <option value="">{text(question.placeholder) || t('selectPlaceholder')}</option>
        {snapshot.visibleChoices.map((choice) => (
          <option key={String(choice.value)} value={String(choice.value)}>
            {choiceLabel(choice, text)}
          </option>
        ))}
        {question.hasOther && (
          <option value={OTHER_VALUE}>{text(question.otherText) || t('otherLabel')}</option>
        )}
      </select>
      {question.hasOther && snapshot.value === OTHER_VALUE && (
        <OtherInput question={question} disabled={!snapshot.enabled} />
      )}
    </>
  );
}
