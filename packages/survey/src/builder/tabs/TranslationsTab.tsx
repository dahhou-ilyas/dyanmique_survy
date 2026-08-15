import { useMemo, useState, type ReactNode } from 'react';
import { resolveText, setLocalizedText } from '../../core/localization/resolveText';
import { walkElements } from '../../core/schema/traverse';
import {
  isChoiceQuestion,
  isPanel,
  LOCALES,
  type Choice,
  type Locale,
  type LocalizedString,
  type SurveyDefinition,
} from '../../core/schema/types';
import { useBuilder, useBuilderContext } from '../BuilderProvider';
import type { BuilderStoreApi } from '../store/builderStore';

interface TranslationRow {
  key: string;
  /** Où se situe le texte, pour que l'auteur se repère. */
  context: string;
  value: LocalizedString | undefined;
  apply: (store: BuilderStoreApi, locale: Locale, text: string) => void;
}

/**
 * Rassemble tous les textes traduisibles du sondage.
 *
 * Sans cette vue, traduire un questionnaire de trente questions imposerait
 * d'ouvrir trente panneaux de propriétés — et de découvrir en production les
 * libellés qu'on a oubliés.
 */
function collectRows(survey: SurveyDefinition): TranslationRow[] {
  const rows: TranslationRow[] = [];

  const push = (row: TranslationRow): void => {
    rows.push(row);
  };

  push({
    key: 'survey.title',
    context: 'Sondage · titre',
    value: survey.title,
    apply: (store, locale, text) =>
      store.getState().updateSurvey({
        title: setLocalizedText(survey.title, locale, text),
      }),
  });

  if (survey.description !== undefined) {
    push({
      key: 'survey.description',
      context: 'Sondage · description',
      value: survey.description,
      apply: (store, locale, text) =>
        store.getState().updateSurvey({
          description: setLocalizedText(survey.description, locale, text),
        }),
    });
  }

  for (const page of survey.pages) {
    if (page.title !== undefined) {
      push({
        key: `page.${page.id}.title`,
        context: `Page « ${page.name} » · titre`,
        value: page.title,
        apply: (store, locale, text) =>
          store.getState().updatePage(page.id, {
            title: setLocalizedText(page.title, locale, text),
          }),
      });
    }

    walkElements(page.elements, (element) => {
      push({
        key: `element.${element.id}.title`,
        context: `${element.name} · libellé`,
        value: element.title,
        apply: (store, locale, text) =>
          store.getState().updateElement(element.id, {
            title: setLocalizedText(element.title, locale, text),
          }),
      });

      if (element.description !== undefined) {
        push({
          key: `element.${element.id}.description`,
          context: `${element.name} · description`,
          value: element.description,
          apply: (store, locale, text) =>
            store.getState().updateElement(element.id, {
              description: setLocalizedText(element.description, locale, text),
            }),
        });
      }

      if (isPanel(element) || !isChoiceQuestion(element)) return;

      element.choices.forEach((choice, index) => {
        push({
          key: `element.${element.id}.choice.${index}`,
          context: `${element.name} · option « ${String(choice.value)} »`,
          value: choice.text,
          apply: (store, locale, text) => {
            const next: Choice[] = element.choices.map((current, i) =>
              i === index
                ? { ...current, text: setLocalizedText(current.text, locale, text) }
                : current,
            );
            store.getState().updateElement(element.id, { choices: next });
          },
        });
      });
    });
  }

  return rows;
}

export function TranslationsTab(): ReactNode {
  const { t, store } = useBuilderContext();
  const survey = useBuilder((state) => state.survey);

  const sourceLocale = survey.settings.locale;
  const [targetLocale, setTargetLocale] = useState<Locale>(
    LOCALES.find((code) => code !== sourceLocale) ?? 'en',
  );

  const rows = useMemo(() => collectRows(survey), [survey]);
  const translated = rows.filter(
    (row) => resolveTextExact(row.value, targetLocale) !== undefined,
  ).length;

  if (rows.length === 0) {
    return <p className="edbs-tab__empty">{t('translationsEmpty')}</p>;
  }

  return (
    <div className="edbs-translations">
      <div className="edbs-translations__bar">
        <label className="edbs-preview__locale">
          <span className="edbs-field__label">Langue cible</span>
          <select
            className="edbs-select"
            value={targetLocale}
            onChange={(event) => setTargetLocale(event.target.value as Locale)}
          >
            {LOCALES.filter((code) => code !== sourceLocale).map((code) => (
              <option key={code} value={code}>
                {code.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <span className="edbs-translations__progress">
          {t('translationsProgress', { done: translated, total: rows.length })}
        </span>
      </div>

      <table className="edbs-table">
        <thead>
          <tr>
            <th scope="col">Emplacement</th>
            <th scope="col">{sourceLocale.toUpperCase()}</th>
            <th scope="col">{targetLocale.toUpperCase()}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const target = resolveTextExact(row.value, targetLocale) ?? '';
            return (
              <tr key={row.key} className={target === '' ? 'edbs-table__row--todo' : undefined}>
                <td className="edbs-translations__context">{row.context}</td>
                <td>{resolveText(row.value, sourceLocale)}</td>
                <td>
                  <input
                    className="edbs-input"
                    type="text"
                    value={target}
                    aria-label={`${row.context} — ${targetLocale.toUpperCase()}`}
                    onChange={(event) => row.apply(store, targetLocale, event.target.value)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Traduction **exacte** dans la locale demandée, sans repli.
 * Le repli de `resolveText` ferait passer un texte non traduit pour traduit.
 */
function resolveTextExact(value: LocalizedString | undefined, locale: Locale): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return undefined;
  const exact = value[locale];
  return exact === undefined || exact === '' ? undefined : exact;
}
