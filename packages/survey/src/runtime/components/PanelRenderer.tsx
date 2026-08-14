import { memo, useId, useState, type ReactNode } from 'react';
import { isPanel, type Panel, type SurveyElement } from '../../core/schema/types';
import { useSurveyContext } from '../SurveyProvider';
import { usePanelSnapshot } from '../hooks/useSurveyEngine';
import { QuestionRenderer } from './QuestionRenderer';
import { ChevronDownIcon } from './ui/icons';

/** Rend les enfants d'un conteneur — factorisé entre page et groupe. */
export function ElementList({ elements }: { elements: SurveyElement[] }): ReactNode {
  return (
    <>
      {elements.map((element) =>
        isPanel(element) ? (
          <PanelRenderer key={element.id} panel={element} />
        ) : (
          <QuestionRenderer key={element.id} name={element.name} />
        ),
      )}
    </>
  );
}

export const PanelRenderer = memo(function PanelRenderer({ panel }: { panel: Panel }): ReactNode {
  const { text, t } = useSurveyContext();
  const snapshot = usePanelSnapshot(panel.id);
  const bodyId = useId();

  // L'état plié/déplié est de l'état d'interface pur : il appartient au composant,
  // pas au moteur, et ne doit pas repartir dans les réponses.
  const [collapsed, setCollapsed] = useState(panel.state === 'collapsed');

  if (snapshot && !snapshot.visible) return null;

  const title = text(panel.title);
  const description = text(panel.description);
  const collapsible = panel.state !== undefined;

  return (
    <section className="edbs-panel" aria-labelledby={`${bodyId}-title`}>
      {(title !== '' || description !== '') &&
        (collapsible ? (
          <button
            type="button"
            className="edbs-panel__header edbs-panel__header--interactive"
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            onClick={() => setCollapsed((value) => !value)}
          >
            <ChevronDownIcon
              className={`edbs-panel__chevron${collapsed ? ' edbs-panel__chevron--collapsed' : ''}`}
            />
            <PanelHeading id={`${bodyId}-title`} title={title} description={description} />
            <span className="edbs-visually-hidden">
              {collapsed ? t('expandGroup') : t('collapseGroup')}
            </span>
          </button>
        ) : (
          <div className="edbs-panel__header">
            <PanelHeading id={`${bodyId}-title`} title={title} description={description} />
          </div>
        ))}

      {!collapsed && (
        <div id={bodyId} className="edbs-panel__body">
          <ElementList elements={panel.elements} />
        </div>
      )}
    </section>
  );
});

function PanelHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}): ReactNode {
  return (
    <span>
      <h3 id={id} className="edbs-panel__title">
        {title}
      </h3>
      {description !== '' && <span className="edbs-panel__description">{description}</span>}
    </span>
  );
}
