import { useState, type ReactNode } from 'react';
import { resolveText, setLocalizedText } from '../../../core/localization/resolveText';
import type { Choice, LocalizedString } from '../../../core/schema/types';
import { useBuilderContext } from '../../BuilderProvider';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon } from '../../icons';
import type { EditorProps } from './SimpleEditors';

/**
 * Édition des options de réponse.
 *
 * Deux modes : une liste ligne à ligne pour les retouches, et une saisie en masse
 * pour créer vingt options d'un coup — coller une liste depuis un tableur est le
 * geste réel des utilisateurs métier, l'imposer option par option serait punitif.
 */
export function ChoicesEditor({ value, onChange }: EditorProps): ReactNode {
  const { locale, t } = useBuilderContext();
  const choices = Array.isArray(value) ? (value as Choice[]) : [];
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const update = (index: number, changes: Partial<Choice>): void => {
    onChange(choices.map((choice, i) => (i === index ? { ...choice, ...changes } : choice)));
  };

  const move = (index: number, offset: number): void => {
    const target = index + offset;
    if (target < 0 || target >= choices.length) return;
    const next = [...choices];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    onChange(next);
  };

  const add = (): void => {
    // Un identifiant libre plutôt que `item${length + 1}` : après suppression,
    // la longueur ne garantit plus l'unicité.
    const used = new Set(choices.map((choice) => String(choice.value)));
    let index = choices.length + 1;
    while (used.has(`item${index}`)) index += 1;
    onChange([...choices, { value: `item${index}`, text: `Option ${index}` }]);
  };

  const openBulk = (): void => {
    setBulkText(
      choices
        .map((choice) => {
          const label = resolveText(choice.text, locale);
          return label === '' || label === String(choice.value)
            ? String(choice.value)
            : `${String(choice.value)} | ${label}`;
        })
        .join('\n'),
    );
    setBulkOpen(true);
  };

  const applyBulk = (): void => {
    const parsed = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .map((line) => {
        const separator = line.indexOf('|');
        if (separator === -1) return { value: line } satisfies Choice;
        return {
          value: line.slice(0, separator).trim(),
          text: line.slice(separator + 1).trim(),
        } satisfies Choice;
      });
    onChange(parsed);
    setBulkOpen(false);
  };

  if (bulkOpen) {
    return (
      <div className="edbs-choices-editor">
        <p className="edbs-field__hint">{t('bulkEditHint')}</p>
        <textarea
          className="edbs-textarea"
          rows={Math.max(6, Math.min(20, bulkText.split('\n').length + 1))}
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
        />
        <div className="edbs-choices-editor__actions">
          <button type="button" className="edbs-btn edbs-btn--primary" onClick={applyBulk}>
            {t('applyBulk')}
          </button>
          <button
            type="button"
            className="edbs-btn edbs-btn--ghost"
            onClick={() => setBulkOpen(false)}
          >
            {t('delete')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="edbs-choices-editor">
      <ul className="edbs-choices-editor__list">
        {choices.map((choice, index) => (
          <li key={index} className="edbs-choices-editor__row">
            <input
              className="edbs-input edbs-choices-editor__value"
              type="text"
              value={String(choice.value)}
              aria-label={`${t('choiceValue')} ${index + 1}`}
              onChange={(event) => update(index, { value: event.target.value })}
            />
            <input
              className="edbs-input"
              type="text"
              value={resolveText(choice.text, locale)}
              aria-label={`${t('choiceLabel')} ${index + 1}`}
              onChange={(event) => {
                const next = setLocalizedText(
                  choice.text as LocalizedString | undefined,
                  locale,
                  event.target.value,
                );
                update(index, next === '' ? { text: undefined } : { text: next });
              }}
            />
            <button
              type="button"
              className="edbs-icon-btn"
              aria-label={t('moveUp')}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ChevronUpIcon />
            </button>
            <button
              type="button"
              className="edbs-icon-btn"
              aria-label={t('moveDown')}
              disabled={index === choices.length - 1}
              onClick={() => move(index, 1)}
            >
              <ChevronDownIcon />
            </button>
            <button
              type="button"
              className="edbs-icon-btn edbs-icon-btn--danger"
              aria-label={`${t('removeChoice')} ${index + 1}`}
              onClick={() => onChange(choices.filter((_, i) => i !== index))}
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>

      <div className="edbs-choices-editor__actions">
        <button type="button" className="edbs-btn edbs-btn--secondary" onClick={add}>
          <PlusIcon />
          {t('addChoice')}
        </button>
        <button type="button" className="edbs-btn edbs-btn--ghost" onClick={openBulk}>
          {t('bulkEdit')}
        </button>
      </div>
    </div>
  );
}
