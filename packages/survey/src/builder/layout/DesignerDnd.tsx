import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState, type ReactNode } from 'react';
import { findElementById } from '../../core/schema/traverse';
import { isPanel } from '../../core/schema/types';
import { useBuilderContext } from '../BuilderProvider';
import { decodeContainerId, isContainerId } from '../canvas/dragIds';
import { QuestionIcon } from '../icons';
import { TOOLBOX_DRAG_PREFIX } from '../toolbox/ToolboxPanel';
import type { DropTarget } from '../store/builderStore';

/**
 * Contexte de glisser-déposer du concepteur.
 *
 * `@dnd-kit` est choisi pour son `KeyboardSensor` : le déplacement au clavier
 * fonctionne sans code supplémentaire, ce qui rend le builder utilisable sans
 * souris — exigence d'accessibilité que `react-beautiful-dnd`, déprécié, ne
 * couvrirait plus.
 */
export function DesignerDnd({ children }: { children: ReactNode }): ReactNode {
  const { store, t, text, registry } = useBuilderContext();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    // Un petit seuil évite qu'un simple clic de sélection ne déclenche un déplacement.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Traduit la cible survolée en position d'insertion dans le modèle. */
  const resolveTarget = (overId: string): DropTarget | undefined => {
    const state = store.getState();

    if (isContainerId(overId)) {
      const container = decodeContainerId(overId);
      if (!container) return undefined;
      return { ...container, index: Number.POSITIVE_INFINITY };
    }

    const location = findElementById(state.survey, overId);
    if (!location) return undefined;

    // Déposer sur un groupe replié : on insère à l'intérieur plutôt qu'à côté,
    // sinon un groupe vide serait impossible à remplir au clavier.
    if (isPanel(location.element)) {
      return { pageId: location.page.id, parentId: location.element.id, index: 0 };
    }

    return {
      pageId: location.page.id,
      parentId: location.parent?.id ?? null,
      index: location.index,
    };
  };

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    setActiveId(null);
    if (!over) return;

    const activeKey = String(active.id);
    const target = resolveTarget(String(over.id));
    if (!target) return;

    if (activeKey.startsWith(TOOLBOX_DRAG_PREFIX)) {
      store.getState().addElement(activeKey.slice(TOOLBOX_DRAG_PREFIX.length), target);
      return;
    }

    if (activeKey === String(over.id)) return;
    store.getState().moveElement(activeKey, target);
  };

  const describe = (id: string): string => {
    if (id.startsWith(TOOLBOX_DRAG_PREFIX)) {
      const type = id.slice(TOOLBOX_DRAG_PREFIX.length);
      return type === 'panel' ? t('addGroup') : text(registry.get(type)?.label) || type;
    }
    const location = findElementById(store.getState().survey, id);
    return location ? text(location.element.title) || location.element.name : id;
  };

  // Annonces vocales en français : le message anglais par défaut de dnd-kit
  // serait lu tel quel au milieu d'une interface francophone.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Déplacement de ${describe(String(active.id))} commencé.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${describe(String(active.id))} est au-dessus de ${describe(String(over.id))}.`
        : `${describe(String(active.id))} n’est au-dessus d’aucune zone de dépôt.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${describe(String(active.id))} a été déposé sur ${describe(String(over.id))}.`
        : `${describe(String(active.id))} a été relâché sans destination.`,
    onDragCancel: ({ active }) => `Déplacement de ${describe(String(active.id))} annulé.`,
  };

  const activeLabel = activeId ? describe(activeId) : '';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragStart={({ active }: DragStartEvent) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {activeId && (
          <div className="edbs-card edbs-card--overlay">
            <div className="edbs-card__bar">
              <span className="edbs-card__icon">
                <QuestionIcon name="panel" />
              </span>
              <span className="edbs-card__title">{activeLabel}</span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
