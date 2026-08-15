import type { ReactNode } from 'react';
import { useSurveyContext } from '../SurveyProvider';
import { useSurveyState } from '../hooks/useSurveyEngine';
import { ArrowLeftIcon, ArrowRightIcon } from './ui/icons';

export function NavigationBar(): ReactNode {
  const { engine, t, text } = useSurveyContext();
  const state = useSurveyState();
  const settings = engine.getDefinition().settings;

  if (state.completed || state.visiblePages.length === 0) return null;

  return (
    <nav
      className="edbs-nav"
      aria-label={t('pageProgress', {
        current: state.currentPageIndex + 1,
        total: state.visiblePages.length,
      })}
    >
      {!state.isFirstPage && (
        <button
          type="button"
          className="edbs-btn edbs-btn--secondary"
          onClick={() => engine.prevPage()}
        >
          <ArrowLeftIcon />
          {text(settings.pagePrevText) || t('previous')}
        </button>
      )}
      <span className="edbs-nav__spacer" />
      <button
        type="button"
        className="edbs-btn edbs-btn--primary"
        onClick={() => engine.nextPage()}
      >
        {state.isLastPage ? (
          text(settings.completeText) || t('complete')
        ) : (
          <>
            {text(settings.pageNextText) || t('next')}
            <ArrowRightIcon />
          </>
        )}
      </button>
    </nav>
  );
}
