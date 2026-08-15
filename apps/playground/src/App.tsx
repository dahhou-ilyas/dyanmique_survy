import { useEffect, useState, type ReactNode } from 'react';
import { SurveyBuilder } from '@edb/survey/builder';
import {
  parseSurvey,
  type Locale,
  type SurveyDefinition,
  type SurveyResult,
} from '@edb/survey/core';
import { SurveyRenderer } from '@edb/survey/runtime';
import { SAMPLE_LABELS, samples, type SampleKey } from './samples';

type View = 'builder' | 'runtime';

const STORAGE_KEY = 'edbs-playground-survey';

/**
 * Bac à sable : le builder et le moteur de rendu côte à côte, sur la même
 * définition. Il tient lieu de démonstration client et de banc d'intégration —
 * c'est ici qu'on vérifie qu'un sondage construit à la main se rend correctement.
 *
 * La persistance passe par `localStorage` : le package ne fait aucun appel réseau,
 * c'est bien à l'application hôte de décider où les données vont.
 */
export function App(): ReactNode {
  const [view, setView] = useState<View>('builder');
  const [locale, setLocale] = useState<Locale>('fr');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [survey, setSurvey] = useState<SurveyDefinition>(() => loadSurvey('satisfaction'));
  const [result, setResult] = useState<SurveyResult | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(survey));
  }, [survey]);

  const loadSample = (key: SampleKey): void => {
    setSurvey(structuredClone(samples[key]));
    setResult(null);
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__brand">@edb/survey</h1>

        <nav className="app__nav">
          <button
            type="button"
            aria-current={view === 'builder' ? 'page' : undefined}
            onClick={() => setView('builder')}
          >
            Builder
          </button>
          <button
            type="button"
            aria-current={view === 'runtime' ? 'page' : undefined}
            onClick={() => {
              setResult(null);
              setView('runtime');
            }}
          >
            Rendu
          </button>
        </nav>

        <span className="app__spacer" />

        <div className="app__controls">
          <label>
            Exemple{' '}
            <select
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) loadSample(event.target.value as SampleKey);
                event.target.value = '';
              }}
            >
              <option value="">Charger…</option>
              {(Object.keys(samples) as SampleKey[]).map((key) => (
                <option key={key} value={key}>
                  {SAMPLE_LABELS[key]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Langue{' '}
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </label>

          <button type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? 'Sombre' : 'Clair'}
          </button>
        </div>
      </header>

      <main className="app__main">
        {view === 'builder' ? (
          <SurveyBuilder
            key={survey.id}
            value={survey}
            locale={locale}
            theme={theme}
            onChange={setSurvey}
            onSave={(saved) => {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

              console.info('Sondage enregistré', saved);
            }}
          />
        ) : (
          <>
            <div className="app__panel">
              <p className="app__hint">
                Ce que verrait un client, à partir de la définition en cours d’édition.
              </p>
              <SurveyRenderer
                key={`${survey.id}-${locale}`}
                definition={survey}
                locale={locale}
                theme={theme}
                onComplete={setResult}
              />
            </div>
            {result && <pre className="app__result">{JSON.stringify(result, null, 2)}</pre>}
          </>
        )}
      </main>
    </div>
  );
}

/** Reprend le sondage précédemment édité, ou l'exemple demandé. */
function loadSurvey(fallback: SampleKey): SurveyDefinition {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      // Le JSON stocké peut dater d'une version antérieure du bac à sable :
      // on le valide avant de le charger plutôt que de faire confiance.
      return parseSurvey(JSON.parse(stored));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
  return structuredClone(samples[fallback]);
}
