import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import { isPanel, type Panel, type SurveyElement } from '../../core/schema/types';
import { useBuilder, useBuilderContext } from '../BuilderProvider';
import { CopyIcon, GripIcon, QuestionIcon, TrashIcon } from '../icons';
import { encodeContainerId } from './dragIds';

export interface ElementCardProps {
  element: SurveyElement;
  pageId: string;
}

export function ElementCard({ element, pageId }: ElementCardProps): ReactNode {
  const { registry, t, text, store } = useBuilderContext();
  const selected = useBuilder(
    (state) => state.selection.kind === 'element' && state.selection.id === element.id,
  );

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: element.id,
    data: { kind: 'element', pageId },
  });

  const panel = isPanel(element) ? element : null;
  const descriptor = panel ? undefined : registry.get(element.type);
  const title = text(element.title) || element.name;

  const className =
    'edbs-card' +
    (selected ? ' edbs-card--selected' : '') +
    (isDragging ? ' edbs-card--dragging' : '') +
    (panel ? ' edbs-card--panel' : '');

  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-edbs-element={element.id}
    >
      <div className="edbs-card__bar">
        <button
          type="button"
          className="edbs-card__grip"
          aria-label={`${t('dragHandle')} : ${title}`}
          {...listeners}
          {...attributes}
        >
          <GripIcon />
        </button>

        {/* Le corps entier est cliquable pour sélectionner : c'est le geste attendu
            dans un éditeur, et il reste accessible au clavier via ce bouton. */}
        <button
          type="button"
          className="edbs-card__select"
          aria-pressed={selected}
          onClick={() => store.getState().select({ kind: 'element', id: element.id })}
        >
          <span className="edbs-card__icon">
            <QuestionIcon name={panel ? 'panel' : (descriptor?.icon ?? 'text')} />
          </span>
          <span className="edbs-card__labels">
            <span className="edbs-card__title">{title}</span>
            <span className="edbs-card__meta">
              <code className="edbs-card__name">{element.name}</code>
              {!panel && descriptor && <span>· {text(descriptor.label)}</span>}
            </span>
          </span>
          <span className="edbs-card__badges">
            {!panel && element.isRequired && (
              <span className="edbs-badge edbs-badge--required">{t('requiredBadge')}</span>
            )}
            {element.visibleIf && (
              <span className="edbs-badge edbs-badge--conditional">{t('conditionalBadge')}</span>
            )}
          </span>
        </button>

        <div className="edbs-card__actions">
          <button
            type="button"
            className="edbs-icon-btn"
            title={t('duplicate')}
            aria-label={`${t('duplicate')} : ${title}`}
            onClick={() => store.getState().duplicateElement(element.id)}
          >
            <CopyIcon />
          </button>
          <button
            type="button"
            className="edbs-icon-btn edbs-icon-btn--danger"
            title={t('delete')}
            aria-label={`${t('delete')} : ${title}`}
            onClick={() => store.getState().removeElement(element.id)}
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {panel && <PanelChildren panel={panel} pageId={pageId} />}
    </div>
  );
}

/** Contenu d'un groupe : conteneur de dépôt et liste triable imbriqués. */
function PanelChildren({ panel, pageId }: { panel: Panel; pageId: string }): ReactNode {
  const { t } = useBuilderContext();
  const containerId = encodeContainerId({ pageId, parentId: panel.id });
  const { setNodeRef, isOver } = useDroppable({ id: containerId });
  const ids = panel.elements.map((child) => child.id);

  return (
    <div
      ref={setNodeRef}
      className={`edbs-card__children${isOver ? ' edbs-card__children--over' : ''}`}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {panel.elements.map((child) => (
          <ElementCard key={child.id} element={child} pageId={pageId} />
        ))}
      </SortableContext>
      {panel.elements.length === 0 && <p className="edbs-dropzone">{t('dropHere')}</p>}
    </div>
  );
}
