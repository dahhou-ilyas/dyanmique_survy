import { forwardRef, memo, type ReactNode } from 'react';
import type { Page } from '../../core/schema/types';
import { useSurveyContext } from '../SurveyProvider';
import { ElementList } from './PanelRenderer';

export interface PageRendererProps {
  page: Page;
  showTitle: boolean;
}

/**
 * Rend une page. Le titre reçoit la `ref` : c'est lui que l'on met au focus au
 * changement de page, pour qu'un lecteur d'écran annonce l'arrivée sur la
 * nouvelle étape plutôt que de laisser le focus sur un bouton disparu.
 */
export const PageRenderer = memo(
  forwardRef<HTMLDivElement, PageRendererProps>(function PageRenderer(
    { page, showTitle },
    ref,
  ): ReactNode {
    const { text } = useSurveyContext();
    const title = text(page.title);
    const description = text(page.description);

    return (
      <div className="edbs-page">
        <div ref={ref} tabIndex={-1} className="edbs-page__anchor">
          {showTitle && title !== '' && <h2 className="edbs-page__title">{title}</h2>}
        </div>
        {description !== '' && <p className="edbs-page__description">{description}</p>}
        <div className="edbs-page__elements">
          <ElementList elements={page.elements} />
        </div>
      </div>
    );
  }),
);
