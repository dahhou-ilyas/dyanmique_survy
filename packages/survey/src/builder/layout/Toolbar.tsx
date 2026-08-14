import type { ReactNode } from 'react';
import { useBuilder, useBuilderContext } from '../BuilderProvider';
import { CheckIcon, RedoIcon, UndoIcon } from '../icons';
import { redoLabel, undoLabel } from '../store/builderStore';

export const BUILDER_TABS = ['designer', 'preview', 'logic', 'translations', 'json'] as const;
export type BuilderTab = (typeof BUILDER_TABS)[number];

export interface ToolbarProps {
  tab: BuilderTab;
  onTabChange: (tab: BuilderTab) => void;
  onSave?: (() => void) | undefined;
}

export function Toolbar({ tab, onTabChange, onSave }: ToolbarProps): ReactNode {
  const { t, store } = useBuilderContext();
  const canUndo = useBuilder((state) => state.past.length > 0);
  const canRedo = useBuilder((state) => state.future.length > 0);
  const dirty = useBuilder((state) => state.dirty);
  const undoTitle = useBuilder(undoLabel);
  const redoTitle = useBuilder(redoLabel);

  return (
    <header className="edbs-toolbar">
      <div className="edbs-toolbar__tabs" role="tablist" aria-label="Vues du builder">
        {BUILDER_TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={`edbs-toolbar__tab${tab === name ? ' edbs-toolbar__tab--active' : ''}`}
            onClick={() => onTabChange(name)}
          >
            {t(name)}
          </button>
        ))}
      </div>

      <div className="edbs-toolbar__actions">
        <button
          type="button"
          className="edbs-icon-btn"
          title={undoTitle ? `${t('undo')} : ${undoTitle}` : t('undo')}
          aria-label={t('undo')}
          disabled={!canUndo}
          onClick={() => store.getState().undo()}
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className="edbs-icon-btn"
          title={redoTitle ? `${t('redo')} : ${redoTitle}` : t('redo')}
          aria-label={t('redo')}
          disabled={!canRedo}
          onClick={() => store.getState().redo()}
        >
          <RedoIcon />
        </button>

        {onSave && (
          <button
            type="button"
            className="edbs-btn edbs-btn--primary"
            onClick={onSave}
            disabled={!dirty}
          >
            {dirty ? null : <CheckIcon />}
            {dirty ? t('save') : t('saved')}
          </button>
        )}

        <span className="edbs-toolbar__status" aria-live="polite">
          {dirty ? t('unsavedChanges') : ''}
        </span>
      </div>
    </header>
  );
}
