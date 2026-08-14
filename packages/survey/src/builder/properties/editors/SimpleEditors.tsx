import { useId, type ReactNode } from 'react';
import { resolveEditableText, setLocalizedText } from '../../../core/localization/resolveText';
import type { LocalizedString } from '../../../core/schema/types';
import type { PropertyDescriptor } from '../../../core/registry/types';
import { useBuilderContext } from '../../BuilderProvider';

export interface EditorProps {
  property: PropertyDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Identifiant du contrôle, fourni par la grille pour lier le libellé. */
  id: string;
}

export function TextEditor({ value, onChange, property, id }: EditorProps): ReactNode {
  const { text } = useBuilderContext();
  return (
    <input
      id={id}
      className="edbs-input"
      type="text"
      value={String(value ?? '')}
      placeholder={text(property.placeholder) || undefined}
      onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
    />
  );
}

/**
 * Édite un texte multilingue dans la langue courante du builder.
 * `setLocalizedText` conserve les autres traductions et retombe sur une chaîne
 * nue tant que le sondage reste monolingue — le JSON ne s'alourdit pas pour rien.
 */
export function LocalizedTextEditor({
  value,
  onChange,
  property,
  id,
  multiline = false,
}: EditorProps & { multiline?: boolean }): ReactNode {
  const { locale, text } = useBuilderContext();
  const current = resolveEditableText(value as LocalizedString | undefined, locale);
  const placeholder = text(property.placeholder) || undefined;

  const handle = (next: string): void => {
    const updated = setLocalizedText(value as LocalizedString | undefined, locale, next);
    onChange(updated === '' ? undefined : updated);
  };

  return multiline ? (
    <textarea
      id={id}
      className="edbs-textarea"
      rows={3}
      value={current}
      placeholder={placeholder}
      onChange={(event) => handle(event.target.value)}
    />
  ) : (
    <input
      id={id}
      className="edbs-input"
      type="text"
      value={current}
      placeholder={placeholder}
      onChange={(event) => handle(event.target.value)}
    />
  );
}

export function LocalizedHtmlEditor(props: EditorProps): ReactNode {
  return (
    <div className="edbs-html-editor">
      <LocalizedTextEditor {...props} multiline />
      <p className="edbs-field__hint edbs-field__hint--mono">
        &lt;p&gt; &lt;strong&gt; &lt;em&gt; &lt;ul&gt; &lt;li&gt; &lt;a&gt; &lt;h2&gt; …
      </p>
    </div>
  );
}

export function BooleanEditor({ value, onChange, id }: EditorProps): ReactNode {
  return (
    <label className="edbs-switch" htmlFor={id}>
      <input
        id={id}
        className="edbs-switch__input"
        type="checkbox"
        role="switch"
        checked={value === true}
        onChange={(event) => onChange(event.target.checked ? true : undefined)}
      />
      <span className="edbs-switch__track" aria-hidden="true">
        <span className="edbs-switch__thumb" />
      </span>
    </label>
  );
}

export function NumberEditor({ value, onChange, property, id }: EditorProps): ReactNode {
  return (
    <input
      id={id}
      className="edbs-input"
      type="number"
      value={value === undefined || value === null ? '' : String(value)}
      min={property.min}
      max={property.max}
      step={property.step}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === '') {
          onChange(undefined);
          return;
        }
        const parsed = Number(raw);
        onChange(Number.isNaN(parsed) ? undefined : parsed);
      }}
    />
  );
}

export function SelectEditor({ value, onChange, property, id }: EditorProps): ReactNode {
  const { text } = useBuilderContext();
  const options = property.options ?? [];

  return (
    <select
      id={id}
      className="edbs-select"
      value={value === undefined ? '' : String(value)}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === '') {
          onChange(undefined);
          return;
        }
        const match = options.find((option) => String(option.value) === raw);
        onChange(match ? match.value : raw);
      }}
    >
      <option value="">—</option>
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {text(option.label)}
        </option>
      ))}
    </select>
  );
}

/** Champ étiqueté réutilisable pour les réglages hors grille de propriétés. */
export function SettingField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}): ReactNode {
  const id = useId();
  return (
    <div className="edbs-field">
      <label className="edbs-field__label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint && <p className="edbs-field__hint">{hint}</p>}
    </div>
  );
}
