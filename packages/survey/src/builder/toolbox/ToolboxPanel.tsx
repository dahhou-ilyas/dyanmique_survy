import { useDraggable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { CATEGORY_LABELS, TOOLBOX_ORDER } from '../../core/registry/questionRegistry';
import type { IconName, QuestionCategory } from '../../core/registry/types';
import { useBuilderContext } from '../BuilderProvider';
import { QuestionIcon } from '../icons';

/** Préfixe des identifiants de glisser-déposer venant de la palette. */
export const TOOLBOX_DRAG_PREFIX = 'toolbox:';

interface ToolboxEntry {
  type: string;
  label: string;
  icon: IconName;
  category: QuestionCategory;
}

function ToolboxItem({ entry }: { entry: ToolboxEntry }): ReactNode {
  const { store } = useBuilderContext();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${TOOLBOX_DRAG_PREFIX}${entry.type}`,
    data: { kind: 'toolbox', type: entry.type },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`edbs-toolbox__item${isDragging ? ' edbs-toolbox__item--dragging' : ''}`}
      // Le clic ajoute à la fin de la page : le glisser-déposer reste un confort,
      // jamais le seul moyen d'ajouter une question.
      onClick={() => store.getState().addElement(entry.type)}
      {...listeners}
      {...attributes}
    >
      <QuestionIcon name={entry.icon} />
      <span>{entry.label}</span>
    </button>
  );
}

export function ToolboxPanel(): ReactNode {
  const { registry, locale, t, text } = useBuilderContext();

  const entries: ToolboxEntry[] = TOOLBOX_ORDER.flatMap((type) => {
    const descriptor = registry.get(type);
    if (!descriptor) return [];
    return [
      {
        type,
        label: text(descriptor.label),
        icon: descriptor.icon,
        category: descriptor.category,
      },
    ];
  });

  // Les types ajoutés par l'application hôte, absents de l'ordre par défaut,
  // sont ajoutés à la suite plutôt qu'ignorés.
  for (const descriptor of registry.list()) {
    if (entries.some((entry) => entry.type === descriptor.type)) continue;
    entries.push({
      type: descriptor.type,
      label: text(descriptor.label),
      icon: descriptor.icon,
      category: descriptor.category,
    });
  }

  entries.push({ type: 'panel', label: t('addGroup'), icon: 'panel', category: 'layout' });

  const categories = [...new Set(entries.map((entry) => entry.category))];

  return (
    <aside className="edbs-toolbox" aria-label={t('toolbox')}>
      <h2 className="edbs-toolbox__title">{t('toolbox')}</h2>
      <p className="edbs-toolbox__hint">{t('toolboxHint')}</p>

      {categories.map((category) => (
        <section key={category} className="edbs-toolbox__group">
          <h3 className="edbs-toolbox__group-title">{CATEGORY_LABELS[category][locale]}</h3>
          <div className="edbs-toolbox__items">
            {entries
              .filter((entry) => entry.category === category)
              .map((entry) => (
                <ToolboxItem key={entry.type} entry={entry} />
              ))}
          </div>
        </section>
      ))}
    </aside>
  );
}
