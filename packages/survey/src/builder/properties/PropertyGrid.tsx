import { useId, type ReactNode } from 'react';
import {
  PAGE_PROPERTIES,
  PANEL_PROPERTIES,
  PROPERTY_GROUP_LABELS,
  PROPERTY_GROUP_ORDER,
} from '../../core/registry/questionRegistry';
import type { PropertyDescriptor, PropertyGroup } from '../../core/registry/types';
import { findElementById } from '../../core/schema/traverse';
import { isPanel, LOCALES, type SurveyElement } from '../../core/schema/types';
import { useBuilder, useBuilderContext } from '../BuilderProvider';
import { ChoicesEditor } from './editors/ChoicesEditor';
import { ExpressionEditor } from './editors/ExpressionEditor';
import {
  BooleanEditor,
  LocalizedHtmlEditor,
  LocalizedTextEditor,
  NumberEditor,
  SelectEditor,
  SettingField,
  TextEditor,
  type EditorProps,
} from './editors/SimpleEditors';
import { ValidatorsEditor } from './editors/ValidatorsEditor';

/**
 * Panneau de propriétés — **généré** à partir des descripteurs du registre.
 *
 * Aucun code d'interface n'est écrit par type de question : ajouter un type et
 * ses `properties` suffit à le rendre éditable ici. C'est ce qui rend le builder
 * extensible sans le modifier.
 */
export function PropertyGrid(): ReactNode {
  const { t } = useBuilderContext();
  const selection = useBuilder((state) => state.selection);

  return (
    <aside className="edbs-properties" aria-label={t('properties')}>
      <h2 className="edbs-properties__title">{t('properties')}</h2>
      {selection.kind === 'survey' && <SurveyProperties />}
      {selection.kind === 'page' && <PageProperties pageId={selection.id} />}
      {selection.kind === 'element' && <ElementProperties elementId={selection.id} />}
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Rendu générique d'une propriété                                            */
/* -------------------------------------------------------------------------- */

function PropertyEditor(props: EditorProps): ReactNode {
  switch (props.property.editor) {
    case 'localizedText':
      return <LocalizedTextEditor {...props} />;
    case 'localizedTextarea':
      return <LocalizedTextEditor {...props} multiline />;
    case 'localizedHtml':
      return <LocalizedHtmlEditor {...props} />;
    case 'boolean':
      return <BooleanEditor {...props} />;
    case 'number':
      return <NumberEditor {...props} />;
    case 'select':
      return <SelectEditor {...props} />;
    case 'choices':
      return <ChoicesEditor {...props} />;
    case 'validators':
      return <ValidatorsEditor {...props} />;
    case 'expression':
      return <ExpressionEditor {...props} />;
    default:
      return <TextEditor {...props} />;
  }
}

function PropertyRow({
  property,
  value,
  onChange,
}: {
  property: PropertyDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
}): ReactNode {
  const { text } = useBuilderContext();
  const id = useId();
  const description = text(property.description);

  return (
    <div className="edbs-field">
      <label className="edbs-field__label" htmlFor={id}>
        {text(property.label)}
      </label>
      <PropertyEditor property={property} value={value} onChange={onChange} id={id} />
      {description !== '' && <p className="edbs-field__hint">{description}</p>}
    </div>
  );
}

function PropertyGroups({
  properties,
  target,
  onChange,
}: {
  properties: PropertyDescriptor[];
  target: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}): ReactNode {
  const { locale } = useBuilderContext();

  const visible = properties.filter(
    (property) => !property.isVisible || property.isVisible(target as unknown as SurveyElement),
  );
  const groups = PROPERTY_GROUP_ORDER.filter((group) =>
    visible.some((property) => property.group === group),
  );

  return (
    <>
      {groups.map((group: PropertyGroup) => (
        <section key={group} className="edbs-properties__group">
          <h3 className="edbs-properties__group-title">{PROPERTY_GROUP_LABELS[group][locale]}</h3>
          {visible
            .filter((property) => property.group === group)
            .map((property) => (
              <PropertyRow
                key={property.name}
                property={property}
                value={target[property.name]}
                onChange={(value) => onChange(property.name, value)}
              />
            ))}
        </section>
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Élément sélectionné                                                        */
/* -------------------------------------------------------------------------- */

function ElementProperties({ elementId }: { elementId: string }): ReactNode {
  const { registry, store } = useBuilderContext();
  const element = useBuilder((state) => findElementById(state.survey, elementId)?.element);

  if (!element) return <EmptySelection />;

  const properties = isPanel(element)
    ? PANEL_PROPERTIES
    : registry.has(element.type)
      ? registry.propertiesFor(element.type)
      : PANEL_PROPERTIES;

  return (
    <>
      <p className="edbs-properties__subject">
        <code className="edbs-card__name">{element.name}</code>
        {!isPanel(element) && <span> · {element.type}</span>}
      </p>
      <PropertyGroups
        properties={properties}
        target={element as unknown as Record<string, unknown>}
        onChange={(name, value) => {
          // Le nom passe par une action dédiée : il doit rester unique dans tout
          // le sondage, sans quoi les expressions et les réponses collisionnent.
          if (name === 'name') {
            store.getState().renameElement(elementId, String(value ?? ''));
            return;
          }
          store.getState().updateElement(elementId, { [name]: value });
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Page sélectionnée                                                          */
/* -------------------------------------------------------------------------- */

function PageProperties({ pageId }: { pageId: string }): ReactNode {
  const { store, t } = useBuilderContext();
  const page = useBuilder((state) => state.survey.pages.find((candidate) => candidate.id === pageId));

  if (!page) return <EmptySelection />;

  return (
    <>
      <p className="edbs-properties__subject">{t('pageProperties')}</p>
      <PropertyGroups
        properties={PAGE_PROPERTIES}
        target={page as unknown as Record<string, unknown>}
        onChange={(name, value) => store.getState().updatePage(pageId, { [name]: value })}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Sondage sélectionné                                                        */
/* -------------------------------------------------------------------------- */

function SurveyProperties(): ReactNode {
  const { store, locale, t } = useBuilderContext();
  const survey = useBuilder((state) => state.survey);
  const actions = store.getState();

  const titleProperty: PropertyDescriptor = {
    name: 'title',
    label: t('surveyTitle'),
    editor: 'localizedText',
    group: 'general',
  };
  const descriptionProperty: PropertyDescriptor = {
    name: 'description',
    label: t('surveyDescription'),
    editor: 'localizedTextarea',
    group: 'general',
  };

  return (
    <>
      <p className="edbs-properties__subject">{t('surveyProperties')}</p>

      <section className="edbs-properties__group">
        <h3 className="edbs-properties__group-title">{PROPERTY_GROUP_LABELS.general[locale]}</h3>
        <PropertyRow
          property={titleProperty}
          value={survey.title}
          onChange={(value) => actions.updateSurvey({ title: value as never })}
        />
        <PropertyRow
          property={descriptionProperty}
          value={survey.description}
          onChange={(value) => actions.updateSurvey({ description: value as never })}
        />
      </section>

      <section className="edbs-properties__group">
        <h3 className="edbs-properties__group-title">{t('settings')}</h3>

        <SettingField label={t('defaultLocale')}>
          {(id) => (
            <select
              id={id}
              className="edbs-select"
              value={survey.settings.locale}
              onChange={(event) => actions.updateSettings({ locale: event.target.value as never })}
            >
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {code.toUpperCase()}
                </option>
              ))}
            </select>
          )}
        </SettingField>

        <SettingField label={t('showProgressBar')}>
          {(id) => (
            <select
              id={id}
              className="edbs-select"
              value={survey.settings.showProgressBar}
              onChange={(event) =>
                actions.updateSettings({ showProgressBar: event.target.value as never })
              }
            >
              <option value="off">—</option>
              <option value="top">Haut</option>
              <option value="bottom">Bas</option>
            </select>
          )}
        </SettingField>

        <SettingField label={t('showQuestionNumbers')}>
          {(id) => (
            <select
              id={id}
              className="edbs-select"
              value={survey.settings.showQuestionNumbers}
              onChange={(event) =>
                actions.updateSettings({ showQuestionNumbers: event.target.value as never })
              }
            >
              <option value="off">—</option>
              <option value="onPage">Par page</option>
              <option value="on">Continue</option>
            </select>
          )}
        </SettingField>

        <SettingField
          label={t('checkErrorsMode')}
          hint="« À la navigation » évite d’afficher une erreur pendant que l’utilisateur saisit."
        >
          {(id) => (
            <select
              id={id}
              className="edbs-select"
              value={survey.settings.checkErrorsMode}
              onChange={(event) =>
                actions.updateSettings({ checkErrorsMode: event.target.value as never })
              }
            >
              <option value="onNextPage">À la navigation</option>
              <option value="onValueChanged">À la saisie</option>
            </select>
          )}
        </SettingField>

        <SettingField label={t('showPageTitles')}>
          {(id) => (
            <label className="edbs-switch" htmlFor={id}>
              <input
                id={id}
                className="edbs-switch__input"
                type="checkbox"
                role="switch"
                checked={survey.settings.showPageTitles}
                onChange={(event) =>
                  actions.updateSettings({ showPageTitles: event.target.checked })
                }
              />
              <span className="edbs-switch__track" aria-hidden="true">
                <span className="edbs-switch__thumb" />
              </span>
            </label>
          )}
        </SettingField>
      </section>
    </>
  );
}

function EmptySelection(): ReactNode {
  const { t } = useBuilderContext();
  return (
    <div className="edbs-properties__empty">
      <p className="edbs-properties__empty-title">{t('noSelection')}</p>
      <p className="edbs-field__hint">{t('noSelectionHint')}</p>
    </div>
  );
}
