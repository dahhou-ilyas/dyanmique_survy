import { useEffect, useState, type ReactNode } from 'react';
import { safeParseSurvey, type SchemaIssue } from '../../core/schema/zod';
import { useBuilder, useBuilderContext } from '../BuilderProvider';
import { AlertIcon, CheckIcon } from '../icons';

/**
 * Édition directe du JSON.
 *
 * Un éditeur de code complet (Monaco) pèserait plusieurs mégaoctets pour un usage
 * ponctuel : une zone de texte plus la validation Zod couvrent le besoin réel —
 * copier, coller, corriger à la main — sans peser sur le bundle du back-office.
 */
export function JsonTab(): ReactNode {
  const { t, store } = useBuilderContext();
  const survey = useBuilder((state) => state.survey);

  const serialized = JSON.stringify(survey, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [issues, setIssues] = useState<SchemaIssue[] | null>(null);
  const [copied, setCopied] = useState(false);

  // Le JSON affiché suit les modifications faites dans le concepteur, tant que
  // l'utilisateur n'a pas commencé à éditer manuellement.
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setDraft(serialized);
  }, [serialized, dirty]);

  const apply = (): void => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (error) {
      setIssues([{ path: '', message: `${t('jsonInvalid')} : ${(error as Error).message}` }]);
      return;
    }

    const result = safeParseSurvey(parsed);
    if (!result.success) {
      setIssues(result.issues);
      return;
    }

    setIssues([]);
    setDirty(false);
    store.getState().replaceSurvey(result.data);
  };

  const copy = (): void => {
    void navigator.clipboard?.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="edbs-json">
      <div className="edbs-json__bar">
        <button
          type="button"
          className="edbs-btn edbs-btn--primary"
          onClick={apply}
          disabled={!dirty}
        >
          {t('jsonApply')}
        </button>
        <button type="button" className="edbs-btn edbs-btn--secondary" onClick={copy}>
          {copied ? <CheckIcon /> : null}
          {copied ? t('jsonCopied') : t('jsonCopy')}
        </button>
      </div>

      {issues !== null &&
        (issues.length === 0 ? (
          <p className="edbs-json__status edbs-json__status--ok">
            <CheckIcon />
            {t('diagnosticsNone')}
          </p>
        ) : (
          <ul className="edbs-json__issues" role="alert">
            {issues.map((issue, index) => (
              <li key={index}>
                <AlertIcon />
                <code>{issue.path || '(racine)'}</code> {issue.message}
              </li>
            ))}
          </ul>
        ))}

      <textarea
        className="edbs-textarea edbs-json__editor"
        spellCheck={false}
        value={draft}
        aria-label="Définition JSON du sondage"
        onChange={(event) => {
          setDraft(event.target.value);
          setDirty(true);
          setIssues(null);
        }}
      />
    </div>
  );
}
