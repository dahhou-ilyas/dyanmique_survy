import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { QuestionRegistry } from '../core/registry/questionRegistry';
import { migrateSurvey, needsMigration } from '../core/schema/migrate';
import { DEFAULT_LOCALE, type Locale, type SurveyDefinition } from '../core/schema/types';
import type { BuilderMessages } from '../i18n/builderMessages';
import { BuilderProvider } from './BuilderProvider';
import { DesignerCanvas } from './canvas/DesignerCanvas';
import { DesignerDnd } from './layout/DesignerDnd';
import { Toolbar, type BuilderTab } from './layout/Toolbar';
import { PropertyGrid } from './properties/PropertyGrid';
import { createBuilderStore } from './store/builderStore';
import { DiagnosticsPanel } from './tabs/DiagnosticsPanel';
import { JsonTab } from './tabs/JsonTab';
import { LogicTab } from './tabs/LogicTab';
import { PreviewPane } from './tabs/PreviewPane';
import { TranslationsTab } from './tabs/TranslationsTab';
import { ToolboxPanel } from './toolbox/ToolboxPanel';

export interface SurveyBuilderProps {
  /** Définition éditée. Sert d'état initial ; les modifications passent par `onChange`. */
  value: SurveyDefinition;
  /** Notifié à chaque modification — l'hôte y branche son état ou son autosave. */
  onChange?: (survey: SurveyDefinition) => void;
  /** Affiche un bouton « Enregistrer ». Sans ce rappel, le bouton n'apparaît pas. */
  onSave?: (survey: SurveyDefinition) => void;
  locale?: Locale;
  theme?: 'light' | 'dark';
  className?: string;
  registry?: QuestionRegistry;
  messages?: Partial<BuilderMessages>;
}

/**
 * Builder de sondage : palette, canevas en glisser-déposer, panneau de propriétés
 * généré, aperçu, vue logique, traductions et JSON.
 *
 * Comme le renderer, il ne réalise **aucun appel réseau** : la persistance est
 * l'affaire de l'application hôte, via `onChange` et `onSave`.
 *
 * ```tsx
 * const [survey, setSurvey] = useState(createSurvey());
 * <SurveyBuilder value={survey} onChange={setSurvey} onSave={(s) => api.put(url, s)} />
 * ```
 */
export function SurveyBuilder({
  value,
  onChange,
  onSave,
  locale = DEFAULT_LOCALE,
  theme,
  className,
  registry,
  messages,
}: SurveyBuilderProps): ReactNode {
  const initial = useMemo(
    () => (needsMigration(value) ? migrateSurvey(value) : value),
    // Seule la première définition compte : l'état vivant est celui du store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const store = useMemo(() => createBuilderStore(initial), [initial]);
  const [tab, setTab] = useState<BuilderTab>('designer');

  const survey = useStore(store, (state) => state.survey);

  // `onChange` est lu via une ref : le changer entre deux rendus ne doit pas
  // relancer la notification.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onChangeRef.current?.(survey);
  }, [survey]);

  // Une définition poussée de l'extérieur (chargement d'un autre sondage) remplace
  // l'état ; celle que le builder vient lui-même d'émettre est ignorée.
  useEffect(() => {
    if (value === store.getState().survey) return;
    store.getState().replaceSurvey(needsMigration(value) ? migrateSurvey(value) : value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta || event.key.toLowerCase() !== 'z') return;
      // Ne pas confisquer Ctrl+Z pendant la saisie dans un champ : l'annulation
      // native du texte est ce que l'utilisateur attend à cet instant.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      event.preventDefault();
      if (event.shiftKey) store.getState().redo();
      else store.getState().undo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store]);

  const handleSave = onSave
    ? () => {
        onSave(store.getState().survey);
        store.getState().markSaved();
      }
    : undefined;

  return (
    <BuilderProvider
      store={store}
      locale={locale}
      {...(registry ? { registry } : {})}
      {...(messages ? { messages } : {})}
    >
      <div
        className={`edbs-root edbs-builder${className ? ` ${className}` : ''}`}
        {...(theme ? { 'data-edbs-theme': theme } : {})}
      >
        <Toolbar tab={tab} onTabChange={setTab} onSave={handleSave} />

        <div className="edbs-builder__body">
          {tab === 'designer' && (
            <DesignerDnd>
              <div className="edbs-builder__columns">
                <ToolboxPanel />
                <main className="edbs-builder__main">
                  <DesignerCanvas />
                  <DiagnosticsPanel />
                </main>
                <PropertyGrid />
              </div>
            </DesignerDnd>
          )}

          {tab === 'preview' && <PreviewPane />}
          {tab === 'logic' && <LogicTab />}
          {tab === 'translations' && <TranslationsTab />}
          {tab === 'json' && <JsonTab />}
        </div>
      </div>
    </BuilderProvider>
  );
}
