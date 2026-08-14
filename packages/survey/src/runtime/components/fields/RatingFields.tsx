import type { ReactNode } from 'react';
import { DEFAULT_RATE_MAX, NPS_MAX, NPS_MIN } from '../../../core/registry/descriptors/rating';
import type { BooleanQuestion, NpsQuestion, RatingQuestion } from '../../../core/schema/types';
import { useSurveyContext } from '../../SurveyProvider';
import type { FieldProps } from '../../types';
import { StarIcon, smileyFor } from '../ui/icons';

/**
 * Les crans reposent sur de vrais `<input type="radio">` masqués visuellement,
 * pas sur des `<button>` : navigation par flèches, annonce du groupe et de la
 * position sont alors natives, sans code de gestion du clavier.
 */
interface ScaleItem {
  value: number;
  /** Contenu visible du cran. */
  content: ReactNode;
  /** Libellé annoncé, quand le contenu visible n'est pas du texte. */
  srLabel?: string;
}

function Scale({
  items,
  name,
  value,
  disabled,
  invalid,
  describedBy,
  variant,
  onSelect,
}: {
  items: ScaleItem[];
  name: string;
  value: number | undefined;
  disabled: boolean;
  invalid: boolean;
  describedBy: string | undefined;
  variant: 'numbers' | 'stars' | 'smileys' | 'nps';
  onSelect: (value: number) => void;
}): ReactNode {
  return (
    <div
      className={`edbs-rating edbs-rating--${variant}${variant === 'nps' ? ' edbs-nps' : ''}`}
      aria-describedby={describedBy}
    >
      {items.map((item) => {
        const selected = value === item.value;
        return (
          <label
            key={item.value}
            className={
              'edbs-rating__item' +
              (selected ? ' edbs-rating__item--selected' : '') +
              (disabled ? ' edbs-rating__item--disabled' : '')
            }
          >
            <input
              className="edbs-visually-hidden"
              type="radio"
              name={name}
              value={item.value}
              checked={selected}
              disabled={disabled}
              aria-invalid={invalid || undefined}
              onChange={() => onSelect(item.value)}
            />
            <span aria-hidden={item.srLabel ? 'true' : undefined}>{item.content}</span>
            {item.srLabel && <span className="edbs-visually-hidden">{item.srLabel}</span>}
          </label>
        );
      })}
    </div>
  );
}

export function RatingField({
  question,
  snapshot,
  describedBy,
  onChange,
}: FieldProps<RatingQuestion>): ReactNode {
  const { text } = useSurveyContext();
  const max = question.rateMax ?? DEFAULT_RATE_MAX;
  const rateType = question.rateType ?? 'stars';
  const value = typeof snapshot.value === 'number' ? snapshot.value : undefined;
  const invalid = snapshot.showErrors && snapshot.errors.length > 0;

  const items: ScaleItem[] = Array.from({ length: max }, (_, index) => {
    const rating = index + 1;
    switch (rateType) {
      case 'stars':
        return {
          value: rating,
          content: <StarIcon filled={value !== undefined && rating <= value} />,
          srLabel: `${rating} / ${max}`,
        };
      case 'smileys':
        return {
          value: rating,
          content: smileyFor(index, max),
          srLabel: `${rating} / ${max}`,
        };
      default:
        return { value: rating, content: rating };
    }
  });

  const low = text(question.minRateDescription);
  const high = text(question.maxRateDescription);

  return (
    <>
      <Scale
        items={items}
        name={question.name}
        value={value}
        disabled={!snapshot.enabled}
        invalid={invalid}
        describedBy={describedBy}
        variant={rateType}
        onSelect={onChange}
      />
      {(low !== '' || high !== '') && (
        <div className="edbs-rating__legend" aria-hidden="true">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </>
  );
}

export function NpsField({
  question,
  snapshot,
  describedBy,
  onChange,
}: FieldProps<NpsQuestion>): ReactNode {
  const { text, t } = useSurveyContext();
  const value = typeof snapshot.value === 'number' ? snapshot.value : undefined;
  const invalid = snapshot.showErrors && snapshot.errors.length > 0;

  const items: ScaleItem[] = Array.from({ length: NPS_MAX - NPS_MIN + 1 }, (_, index) => ({
    value: NPS_MIN + index,
    content: NPS_MIN + index,
  }));

  return (
    <>
      <Scale
        items={items}
        name={question.name}
        value={value}
        disabled={!snapshot.enabled}
        invalid={invalid}
        describedBy={describedBy}
        variant="nps"
        onSelect={onChange}
      />
      <div className="edbs-rating__legend" aria-hidden="true">
        <span>{text(question.minDescription) || t('ratingLegendLow')}</span>
        <span>{text(question.maxDescription) || t('ratingLegendHigh')}</span>
      </div>
    </>
  );
}

export function BooleanField({
  question,
  snapshot,
  id,
  describedBy,
  onChange,
}: FieldProps<BooleanQuestion>): ReactNode {
  const { text } = useSurveyContext();
  const invalid = snapshot.showErrors && snapshot.errors.length > 0;
  const labelTrue = text(question.labelTrue) || 'Oui';
  const labelFalse = text(question.labelFalse) || 'Non';
  const value = typeof snapshot.value === 'boolean' ? snapshot.value : undefined;

  if (question.renderAs === 'switch') {
    return (
      <label className="edbs-switch" htmlFor={id}>
        <input
          id={id}
          className="edbs-switch__input"
          type="checkbox"
          role="switch"
          checked={value === true}
          disabled={!snapshot.enabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="edbs-switch__track" aria-hidden="true">
          <span className="edbs-switch__thumb" />
        </span>
        <span>{value === true ? labelTrue : labelFalse}</span>
      </label>
    );
  }

  const options: Array<{ label: string; optionValue: boolean }> = [
    { label: labelTrue, optionValue: true },
    { label: labelFalse, optionValue: false },
  ];

  return (
    <div className="edbs-choices edbs-choices--cols-2" aria-describedby={describedBy}>
      {options.map((option, index) => {
        const optionId = `${id}-${index}`;
        const selected = value === option.optionValue;
        return (
          <label
            key={option.label}
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
              checked={selected}
              disabled={!snapshot.enabled}
              aria-invalid={invalid || undefined}
              onChange={() => onChange(option.optionValue)}
            />
            <span className="edbs-choice__label">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
