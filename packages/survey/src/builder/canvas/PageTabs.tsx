import type { ReactNode } from 'react';
import { useBuilder, useBuilderContext } from '../BuilderProvider';
import { PlusIcon, TrashIcon } from '../icons';

export function PageTabs(): ReactNode {
  const { t, text, store } = useBuilderContext();
  const pages = useBuilder((state) => state.survey.pages);
  const currentPageId = useBuilder((state) => state.currentPageId);

  return (
    <div className="edbs-pagetabs" role="tablist" aria-label={t('pages')}>
      {pages.map((page, index) => {
        const active = page.id === currentPageId;
        const label = text(page.title) || page.name;
        return (
          <button
            key={page.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`edbs-pagetab${active ? ' edbs-pagetab--active' : ''}`}
            onClick={() => store.getState().setCurrentPage(page.id)}
          >
            <span className="edbs-pagetab__index">{index + 1}</span>
            <span className="edbs-pagetab__label">{label}</span>
          </button>
        );
      })}

      <button
        type="button"
        className="edbs-icon-btn"
        title={t('addPage')}
        aria-label={t('addPage')}
        onClick={() => store.getState().addPage()}
      >
        <PlusIcon />
      </button>

      {pages.length > 1 && (
        <button
          type="button"
          className="edbs-icon-btn edbs-icon-btn--danger"
          title={t('deletePage')}
          aria-label={t('deletePage')}
          onClick={() => store.getState().removePage(currentPageId)}
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}
