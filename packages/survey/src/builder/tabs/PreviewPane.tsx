import { useState, type ReactNode } from 'react';
import { LOCALES, type Locale, type SurveyResult } from '../../core/schema/types';
import { SurveyRenderer } from '../../runtime/SurveyRenderer';
import { useBuilder, useBuilderContext } from '../BuilderProvider';

/**
 * Aperçu du sondage en cours d'édition.
 *
 * Réutilise le **même** `SurveyRenderer` que la production : il n'existe qu'un
 * moteur de rendu dans le package, donc aucune divergence possible entre ce que
 * l'auteur voit ici et ce que le répondant verra.
 */
export function PreviewPane(): ReactNode {
  const { locale } = useBuilderContext();
  const survey = useBuilder((state) => state.survey);
  const [previewLocale, setPreviewLocale] = useState<Locale>(locale);
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [runId, setRunId] = useState(0);

  return (
    <div className="edbs-preview">
      <div className="edbs-preview__bar">
        <label className="edbs-preview__locale">
          <span className="edbs-field__label">Langue</span>
          <select
            className="edbs-select"
            value={previewLocale}
            onChange={(event) => setPreviewLocale(event.target.value as Locale)}
          >
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {code.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="edbs-btn edbs-btn--secondary"
          onClick={() => {
            setResult(null);
            // Changer la clé recrée le moteur : c'est le moyen le plus simple de
            // repartir d'un sondage vierge sans exposer d'API de réinitialisation.
            setRunId((value) => value + 1);
          }}
        >
          Recommencer
        </button>
      </div>

      <div className="edbs-preview__frame">
        <SurveyRenderer
          key={`${runId}-${previewLocale}`}
          definition={survey}
          locale={previewLocale}
          onComplete={setResult}
        />
      </div>

      {result && (
        <details className="edbs-preview__result" open>
          <summary>Résultat transmis à l’application hôte</summary>
          <pre className="edbs-code">{JSON.stringify(result, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
