import {
  SurveyEngine,
  type PageChangedEvent,
  type PanelSnapshot,
  type QuestionSnapshot,
  type SurveyMode,
  type SurveyState,
  type ValueChangedEvent,
} from '../core/engine/SurveyEngine';
import type { ExpressionFunction } from '../core/expressions/functions';
import { resolveText } from '../core/localization/resolveText';
import type { QuestionRegistry } from '../core/registry/questionRegistry';
import { migrateSurvey, needsMigration } from '../core/schema/migrate';
import { isPanel } from '../core/schema/types';
import {
  DEFAULT_LOCALE,
  type Locale,
  type LocalizedString,
  type Page,
  type SurveyDefinition,
  type SurveyElement,
  type SurveyResult,
} from '../core/schema/types';
import { createTranslator, type Messages, type Translate } from '../i18n/messages';

/**
 * Pilotage d'un sondage **sans framework**.
 *
 * `SurveyEngine` sait déjà tout faire, mais son API est celle d'une machine d'état :
 * `subscribe()` global, instantanés à aller chercher un par un. Cette couche ajoute
 * l'ergonomie qui manque à un hôte qui rend lui-même son interface — abonnement par
 * question, arbre prêt à rendre, désabonnement groupé.
 *
 * Aucune dépendance à React : utilisable depuis du DOM natif, Vue, Svelte, Angular,
 * ou n'importe quoi d'autre.
 *
 * ```ts
 * const survey = createHeadlessSurvey(definition);
 *
 * survey.onQuestionChange('nom', (snapshot) => input.value = String(snapshot.value ?? ''));
 * survey.onComplete((result) => fetch('/api/reponses', { method: 'POST', body: … }));
 *
 * input.addEventListener('input', () => survey.setValue('nom', input.value));
 * ```
 */

/** Nœud de l'arbre visible, prêt à être rendu par l'hôte. */
export type RenderableNode =
  | { kind: 'question'; snapshot: QuestionSnapshot }
  | { kind: 'panel'; snapshot: PanelSnapshot; children: RenderableNode[] };

export interface HeadlessSurveyOptions {
  /** Réponses initiales — reprise d'un sondage partiellement rempli. */
  data?: Record<string, unknown>;
  locale?: Locale;
  /** `display` rend le sondage en lecture seule. */
  mode?: SurveyMode;
  functions?: Record<string, ExpressionFunction>;
  registry?: QuestionRegistry;
  /** Surcharge partielle des libellés d'interface. */
  messages?: Partial<Messages>;
  /** Injectable pour rendre `today()` et les durées déterministes en test. */
  now?: () => Date;
}

export interface HeadlessSurvey {
  /** Le moteur sous-jacent, pour les cas que cette couche ne couvre pas. */
  readonly engine: SurveyEngine;

  /* -------------------------------- Lecture ------------------------------- */

  getState(): SurveyState;
  getQuestion(name: string): QuestionSnapshot | undefined;
  getPanel(id: string): PanelSnapshot | undefined;
  /** Arbre des éléments **visibles** de la page courante, dans l'ordre d'affichage. */
  currentPageElements(): RenderableNode[];
  getResult(): SurveyResult;

  /* --------------------------------- Textes -------------------------------- */

  /** Libellé d'interface traduit (« Suivant », « Cette question est obligatoire »…). */
  t: Translate;
  /** Résout un texte multilingue du sondage dans la locale courante. */
  text(value: LocalizedString | undefined): string;

  /* -------------------------------- Écriture ------------------------------- */

  setValue(name: string, value: unknown): void;
  setValues(values: Record<string, unknown>): void;
  clear(): void;

  /* ------------------------------- Navigation ------------------------------ */

  /** Valide la page courante puis avance. Renvoie `false` si la validation échoue. */
  next(): boolean;
  previous(): boolean;
  goTo(pageIndex: number): boolean;
  complete(): boolean;
  /** Nom de la première question en erreur — cible du focus après un échec. */
  firstErrorQuestion(): string | undefined;

  /* ------------------------------ Abonnements ------------------------------ */

  onStateChange(listener: (state: SurveyState) => void): () => void;
  /**
   * Abonnement à **une seule** question.
   *
   * Le rappel n'est déclenché que si l'instantané de cette question a réellement
   * changé — c'est le même mécanisme d'identité stable qui évite les rendus
   * inutiles côté React, exposé ici pour un rendu chirurgical en DOM natif.
   */
  onQuestionChange(name: string, listener: (snapshot: QuestionSnapshot) => void): () => void;
  onValueChange(listener: (event: ValueChangedEvent) => void): () => void;
  onPageChange(listener: (event: PageChangedEvent) => void): () => void;
  onComplete(listener: (result: SurveyResult) => void): () => void;

  /** Coupe tous les abonnements posés via cette instance. */
  destroy(): void;
}

export function createHeadlessSurvey(
  definition: SurveyDefinition,
  options: HeadlessSurveyOptions = {},
): HeadlessSurvey {
  // Une définition antérieure est mise à niveau avant toute autre opération,
  // exactement comme le fait le renderer React.
  const migrated = needsMigration(definition) ? migrateSurvey(definition) : definition;
  const locale = options.locale ?? migrated.settings.locale ?? DEFAULT_LOCALE;

  const engine = new SurveyEngine({
    definition: migrated,
    ...(options.data ? { data: options.data } : {}),
    locale,
    mode: options.mode ?? 'edit',
    ...(options.functions ? { functions: options.functions } : {}),
    ...(options.registry ? { registry: options.registry } : {}),
    ...(options.now ? { now: options.now } : {}),
  });

  const translate = createTranslator(locale, options.messages);

  /** Désabonnements à rejouer dans `destroy()`. */
  const teardown = new Set<() => void>();

  const track = (unsubscribe: () => void): (() => void) => {
    teardown.add(unsubscribe);
    return () => {
      unsubscribe();
      teardown.delete(unsubscribe);
    };
  };

  /** Construit l'arbre visible d'une liste d'éléments. */
  const toRenderable = (elements: SurveyElement[]): RenderableNode[] => {
    const nodes: RenderableNode[] = [];

    for (const element of elements) {
      if (isPanel(element)) {
        const snapshot = engine.getPanelSnapshot(element.id);
        if (snapshot && !snapshot.visible) continue;
        if (!snapshot) continue;
        nodes.push({ kind: 'panel', snapshot, children: toRenderable(element.elements) });
        continue;
      }

      const snapshot = engine.getQuestionSnapshot(element.name);
      if (!snapshot?.visible) continue;
      nodes.push({ kind: 'question', snapshot });
    }

    return nodes;
  };

  return {
    engine,

    getState: () => engine.getState(),
    getQuestion: (name) => engine.getQuestionSnapshot(name),
    getPanel: (id) => engine.getPanelSnapshot(id),
    getResult: () => engine.getResult(),

    currentPageElements(): RenderableNode[] {
      const page: Page | null = engine.getState().currentPage;
      return page ? toRenderable(page.elements) : [];
    },

    t: translate,
    text: (value) => resolveText(value, engine.getLocale()),

    setValue: (name, value) => engine.setValue(name, value),
    setValues: (values) => engine.setValues(values),
    clear: () => engine.clear(),

    next: () => engine.nextPage(),
    previous: () => engine.prevPage(),
    goTo: (pageIndex) => engine.goToPage(pageIndex),
    complete: () => engine.complete(),
    firstErrorQuestion: () => engine.getFirstErrorQuestionName(),

    onStateChange(listener) {
      return track(engine.subscribe(() => listener(engine.getState())));
    },

    onQuestionChange(name, listener) {
      // On mémorise le dernier instantané vu pour cette question : le moteur
      // conserve l'identité de l'objet tant que rien ne bouge, une comparaison
      // par référence suffit donc à savoir s'il faut notifier.
      let previous = engine.getQuestionSnapshot(name);

      return track(
        engine.subscribe(() => {
          const current = engine.getQuestionSnapshot(name);
          if (current === undefined || current === previous) return;
          previous = current;
          listener(current);
        }),
      );
    },

    onValueChange(listener) {
      return track(engine.on<ValueChangedEvent>('valueChanged', listener));
    },

    onPageChange(listener) {
      return track(engine.on<PageChangedEvent>('pageChanged', listener));
    },

    onComplete(listener) {
      return track(engine.on<SurveyResult>('completed', listener));
    },

    destroy() {
      for (const unsubscribe of teardown) unsubscribe();
      teardown.clear();
    },
  };
}
