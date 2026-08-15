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
import { useBuilderContext } from '../BuilderProvider';
import {
  isToolboxDrag,
  resolveDropTarget,
  toolboxDragType,
  TOOLBOX_DRAG_PREFIX,
} from '../canvas/dropTarget';
import { QuestionIcon } from '../icons';

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

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    setActiveId(null);
    if (!over) return;

    const activeKey = String(active.id);
    const target = resolveDropTarget(store.getState().survey, String(over.id));
    if (!target) return;

    if (isToolboxDrag(activeKey)) {
      store.getState().addElement(toolboxDragType(activeKey), target);
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
