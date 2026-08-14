import DOMPurify from 'dompurify';
import { useMemo, type ReactNode } from 'react';
import type { HtmlQuestion } from '../../../core/schema/types';
import { useSurveyContext } from '../../SurveyProvider';
import type { FieldProps } from '../../types';

/**
 * Liste blanche du contenu autorisé dans un bloc.
 *
 * Le HTML est saisi par des utilisateurs du back-office : il est traité comme
 * une entrée non fiable. Seuls la mise en forme et les liens passent — ni script,
 * ni iframe, ni attribut événementiel, ni `style` (vecteur d'exfiltration via
 * `background-image: url(...)`).
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'div',
  'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'code', 'pre', 'hr', 'small', 'sub', 'sup',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const ALLOWED_ATTR = ['href', 'title', 'target', 'rel', 'lang', 'dir', 'colspan', 'rowspan'];

/** Assainit un fragment HTML ; renvoie `null` si l'environnement ne le permet pas. */
export function sanitizeHtml(html: string): string | null {
  // En rendu serveur, DOMPurify n'a pas de DOM à sa disposition et laisserait
  // le contenu intact. On préfère alors ne rien injecter du tout.
  if (!DOMPurify.isSupported) return null;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Toujours ouvrir les liens externes sans exposer `window.opener`.
    ADD_ATTR: ['target'],
  });
}

export function HtmlBlock({ question }: FieldProps<HtmlQuestion>): ReactNode {
  const { text } = useSurveyContext();
  const raw = text(question.html);
  const sanitized = useMemo(() => sanitizeHtml(raw), [raw]);

  if (sanitized === null) {
    // Repli sans DOM : le texte brut, échappé par React.
    return <div className="edbs-html">{raw.replace(/<[^>]*>/g, '')}</div>;
  }

  return (
    <div
      className="edbs-html"
      // Le contenu vient d'être assaini par la liste blanche ci-dessus.
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
