import type { ReactNode } from 'react';
import { useSurveyContext } from '../SurveyProvider';
import { useSurveyState } from '../hooks/useSurveyEngine';

export function ProgressBar(): ReactNode {
  const { t } = useSurveyContext();
  const state = useSurveyState();

  if (state.visiblePages.length <= 1) return null;

  const current = state.currentPageIndex + 1;
  const total = state.visiblePages.length;
  const percent = Math.round(state.progress * 100);

  return (
    <div className="edbs-progress">
      <div
        className="edbs-progress__track"
        role="progressbar"
        aria-label={t('pageProgress', { current, total })}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={t('pageProgress', { current, total })}
      >
        <div className="edbs-progress__bar" style={{ width: `${percent}%` }} />
      </div>
      <span className="edbs-progress__label">{t('pageProgress', { current, total })}</span>
    </div>
  );
}
