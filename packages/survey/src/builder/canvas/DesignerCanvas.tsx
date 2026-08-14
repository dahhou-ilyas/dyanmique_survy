import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';
import { useBuilder, useBuilderContext } from '../BuilderProvider';
import { ElementCard } from './ElementCard';
import { PageTabs } from './PageTabs';
import { encodeContainerId } from './dragIds';

export function DesignerCanvas(): ReactNode {
  const { t, text, store } = useBuilderContext();
  const currentPageId = useBuilder((state) => state.currentPageId);
  const page = useBuilder((state) =>
    state.survey.pages.find((candidate) => candidate.id === state.currentPageId),
  );
  const pageSelected = useBuilder(
    (state) => state.selection.kind === 'page' && state.selection.id === currentPageId,
  );

  const containerId = encodeContainerId({ pageId: currentPageId, parentId: null });
  const { setNodeRef, isOver } = useDroppable({ id: containerId });

  if (!page) return <div className="edbs-canvas" />;

  const ids = page.elements.map((element) => element.id);

  return (
    <div className="edbs-canvas">
      <PageTabs />

      <button
        type="button"
        className={`edbs-canvas__pagehead${pageSelected ? ' edbs-canvas__pagehead--selected' : ''}`}
        aria-pressed={pageSelected}
        onClick={() => store.getState().select({ kind: 'page', id: page.id })}
      >
        <span className="edbs-canvas__pagetitle">{text(page.title) || page.name}</span>
        <code className="edbs-card__name">{page.name}</code>
      </button>

      <div
        ref={setNodeRef}
        className={`edbs-canvas__elements${isOver ? ' edbs-canvas__elements--over' : ''}`}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {page.elements.map((element) => (
            <ElementCard key={element.id} element={element} pageId={page.id} />
          ))}
        </SortableContext>

        {page.elements.length === 0 && (
          <div className="edbs-canvas__empty">
            <p className="edbs-canvas__empty-title">{t('emptyPage')}</p>
            <p className="edbs-canvas__empty-hint">{t('emptyPageHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
