import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import {
  SurveyEngine,
  type PageChangedEvent,
  type SurveyMode,
  type ValueChangedEvent,
} from '../core/engine/SurveyEngine';
import type { ExpressionFunction } from '../core/expressions/functions';
import type { QuestionRegistry } from '../core/registry/questionRegistry';
import { migrateSurvey, needsMigration } from '../core/schema/migrate';
import {
  DEFAULT_LOCALE,
  type Locale,
  type SurveyDefinition,
  type SurveyResult,
} from '../core/schema/types';
import type { Messages } from '../i18n/messages';
import { SurveyProvider, useSurveyContext } from './SurveyProvider';
import { CompletePage } from './components/CompletePage';
import { NavigationBar } from './components/NavigationBar';
import { PageRenderer } from './components/PageRenderer';
import { ProgressBar } from './components/ProgressBar';
import { defaultFieldComponents, type FieldComponents } from './fieldComponents';
import { useSurveyState } from './hooks/useSurveyEngine';

export interface SurveyRendererProps {
  /** Définition JSON du sondage. Une définition antérieure est migrée à la volée. */
  definition: SurveyDefinition;
  /** Réponses initiales — reprise d'un sondage partiellement rempli. */
  data?: Record<string, unknown>;
  locale?: Locale;
  /** `display` rend le sondage en lecture seule. */
  mode?: SurveyMode;
  /** Force le thème clair ou sombre ; sans valeur, le thème importé s'applique. */
  theme?: 'light' | 'dark';
  className?: string;
  /** Surcharge partielle des libellés d'interface. */
  messages?: Partial<Messages>;
  /** Fonctions d'expression supplémentaires, propres à l'application hôte. */
  functions?: Record<string, ExpressionFunction>;
  /** Registre de types personnalisé. */
  registry?: QuestionRegistry;
  /** Composants de champ, pour surcharger ou ajouter un type. */
  components?: FieldComponents;
  /** Masque l'écran de fin — utile quand l'hôte affiche le sien. */
  showCompletePage?: boolean;

  onValueChanged?: (event: ValueChangedEvent) => void;
  onPageChanged?: (event: PageChangedEvent) => void;
  /** Appelé une fois le sondage validé et clôturé : point de branchement de l'API hôte. */
  onComplete?: (result: SurveyResult) => void;
  /** Donne accès à l'instance du moteur (navigation programmatique, sauvegarde partielle). */
  onEngineReady?: (engine: SurveyEngine) => void;
}

/**
 * Moteur de rendu d'un sondage.
 *
 * Ne réalise **aucun appel réseau** : la persistance passe par `onComplete` et
 * `onValueChanged`, que l'application hôte branche sur ses propres API. C'est la
 * séparation « moteur de rendu / logique métier » demandée par le cahier des charges.
 *
 * ```tsx
 * <SurveyRenderer
 *   definition={campagne.definition}
 *   onComplete={(result) => api.post('/sondages/reponses', result)}
 * />
 * ```
 */
export function SurveyRenderer({
  definition,
  data,
  locale,
  mode = 'edit',
  theme,
  className,
  messages,
  functions,
  registry,
  components = defaultFieldComponents,
  showCompletePage = true,
  onValueChanged,
  onPageChanged,
  onComplete,
  onEngineReady,
}: SurveyRendererProps): ReactNode {
  // Une définition venue d'une version antérieure du schéma est mise à niveau
  // avant toute autre opération : rien en aval n'a à connaître les anciennes formes.
  const migrated = useMemo(
    () => (needsMigration(definition) ? migrateSurvey(definition) : definition),
    [definition],
  );

  const effectiveLocale = locale ?? migrated.settings.locale ?? DEFAULT_LOCALE;

  // Le moteur est recréé si la définition change — c'est un changement de sondage,
  // pas une mise à jour d'état. La locale et le mode, eux, se pilotent à chaud.
  const engine = useMemo(
    () =>
      new SurveyEngine({
        definition: migrated,
        ...(data ? { data } : {}),
        locale: effectiveLocale,
        mode,
        ...(functions ? { functions } : {}),
        ...(registry ? { registry } : {}),
      }),
    // `data`, `mode` et la locale sont volontairement absents : les réinjecter
    // ici réinitialiserait les réponses en cours de saisie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [migrated],
  );

  useEffect(() => engine.setLocale(effectiveLocale), [engine, effectiveLocale]);
  useEffect(() => engine.setMode(mode), [engine, mode]);

  // Les rappels sont lus via des refs : les changer entre deux rendus ne doit pas
  // provoquer un désabonnement / réabonnement du moteur.
  const callbacks = useRef({ onValueChanged, onPageChanged, onComplete });
  callbacks.current = { onValueChanged, onPageChanged, onComplete };

  const pageAnchorRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onEngineReady?.(engine);
  }, [engine, onEngineReady]);

  useEffect(() => {
    const unsubscribers = [
      engine.on<ValueChangedEvent>('valueChanged', (event) =>
        callbacks.current.onValueChanged?.(event),
      ),
      engine.on<SurveyResult>('completed', (result) => callbacks.current.onComplete?.(result)),
      engine.on<PageChangedEvent>('pageChanged', (event) => {
        callbacks.current.onPageChanged?.(event);
        // Sans ce déplacement, le focus resterait sur un bouton devenu hors écran
        // et rien ne signalerait le changement d'étape à un lecteur d'écran.
        pageAnchorRef.current?.focus();
      }),
      engine.on('validationFailed', () => {
        const name = engine.getFirstErrorQuestionName();
        if (!name) return;
        const container = rootRef.current?.querySelector(
          `[data-edbs-question="${CSS.escape(name)}"]`,
        );
        const focusable = container?.querySelector<HTMLElement>(
          'input:not([type="hidden"]), select, textarea, button',
        );
        focusable?.focus();
      }),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [engine]);

  return (
    <SurveyProvider
      engine={engine}
      locale={effectiveLocale}
      components={components}
      {...(registry ? { registry } : {})}
      {...(messages ? { messages } : {})}
    >
      <div
        ref={rootRef}
        className={`edbs-root${className ? ` ${className}` : ''}`}
        {...(theme ? { 'data-edbs-theme': theme } : {})}
      >
        <SurveyBody
          showCompletePage={showCompletePage}
          pageAnchorRef={pageAnchorRef}
          showPageTitles={migrated.settings.showPageTitles}
          showProgressBar={migrated.settings.showProgressBar}
        />
      </div>
    </SurveyProvider>
  );
}

function SurveyBody({
  showCompletePage,
  pageAnchorRef,
  showPageTitles,
  showProgressBar,
}: {
  showCompletePage: boolean;
  pageAnchorRef: React.RefObject<HTMLDivElement>;
  showPageTitles: boolean;
  showProgressBar: SurveyDefinition['settings']['showProgressBar'];
}): ReactNode {
  const { t, text, engine } = useSurveyContextSafe();
  const state = useSurveyState();
  const definition = engine.getDefinition();

  if (state.completed && showCompletePage) {
    return (
      <div className="edbs-survey">
        <CompletePage />
      </div>
    );
  }

  const title = text(definition.title);
  const description = text(definition.description);
  const errorCount = state.currentPage
    ? Object.keys(engine.getErrors()).length
    : 0;

  return (
    <div className="edbs-survey">
      {(title !== '' || description !== '') && (
        <header className="edbs-survey__header">
          {title !== '' && <h1 className="edbs-survey__title">{title}</h1>}
          {description !== '' && <p className="edbs-survey__description">{description}</p>}
        </header>
      )}

      {showProgressBar === 'top' && <ProgressBar />}

      {state.currentPageHasErrors && (
        <div className="edbs-summary-error" role="alert">
          {errorCount === 1 ? t('errorSummaryOne') : t('errorSummary', { count: errorCount })}
        </div>
      )}

      {state.currentPage ? (
        <PageRenderer
          ref={pageAnchorRef}
          page={state.currentPage}
          showTitle={showPageTitles}
        />
      ) : (
        <p className="edbs-page__description">{t('emptySurvey')}</p>
      )}

      <NavigationBar />

      {showProgressBar === 'bottom' && <ProgressBar />}
    </div>
  );
}

// Import tardif pour éviter un cycle avec `SurveyProvider`.
import { useSurveyContext as useSurveyContextSafe } from './SurveyProvider';
