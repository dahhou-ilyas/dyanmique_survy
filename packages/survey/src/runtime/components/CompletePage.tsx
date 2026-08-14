import type { ReactNode } from 'react';
import { useSurveyContext } from '../SurveyProvider';
import { sanitizeHtml } from './fields/HtmlBlock';
import { CheckCircleIcon } from './ui/icons';

/** Écran affiché après la soumission, personnalisable via `settings.completedHtml`. */
export function CompletePage(): ReactNode {
  const { engine, t, text } = useSurveyContext();
  const html = text(engine.getDefinition().settings.completedHtml);

  if (html !== '') {
    const sanitized = sanitizeHtml(html);
    return (
      <div className="edbs-complete" role="status">
        {sanitized === null ? (
          <p className="edbs-complete__text">{html.replace(/<[^>]*>/g, '')}</p>
        ) : (
          <div className="edbs-html" dangerouslySetInnerHTML={{ __html: sanitized }} />
        )}
      </div>
    );
  }

  return (
    <div className="edbs-complete" role="status">
      <CheckCircleIcon className="edbs-complete__icon" size={40} />
      <h2 className="edbs-complete__title">{t('completeTitle')}</h2>
      <p className="edbs-complete__text">{t('completeText')}</p>
    </div>
  );
}
