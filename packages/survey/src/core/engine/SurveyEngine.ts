import {
  evaluateCondition,
  tryEvaluateExpression,
  type EvaluationContext,
} from '../expressions/evaluate';
import type { ExpressionFunction } from '../expressions/functions';
import { resolveText } from '../localization/resolveText';
import { questionRegistry, type QuestionRegistry } from '../registry/questionRegistry';
import { walkElements } from '../schema/traverse';
import {
  DEFAULT_LOCALE,
  isChoiceQuestion,
  isPanel,
  type Choice,
  type Locale,
  type Page,
  type Panel,
  type Question,
  type SurveyAnswer,
  type SurveyDefinition,
  type SurveyResult,
} from '../schema/types';
import { validateQuestion, type ValidationError } from '../validation/validators';
import { affectedBy, buildDependencyGraph, type DependencyGraph } from './dependencyGraph';

/**
 * Moteur d'exécution d'un sondage.
 *
 * TypeScript pur, sans React : il est testable sans DOM, utilisable côté serveur
 * pour recalculer un résultat, et réutilisable si un jour le back-office n'est pas
 * en React. Le renderer React n'en est qu'un abonné.
 *
 * Il ne fait **aucun** appel réseau : la persistance des réponses et la logique de
 * campagne appartiennent à l'application hôte, conformément à la séparation
 * « moteur de rendu / logique métier » demandée par le cahier des charges.
 */

export type SurveyMode = 'edit' | 'display';

export interface SurveyEngineOptions {
  definition: SurveyDefinition;
  /** Réponses initiales — reprise d'un sondage partiellement rempli. */
  data?: Record<string, unknown>;
  locale?: Locale;
  /** `display` rend tout le sondage en lecture seule (relecture en back-office). */
  mode?: SurveyMode;
  /** Injectable pour rendre `today()` et les durées déterministes en test. */
  now?: () => Date;
  functions?: Record<string, ExpressionFunction>;
  registry?: QuestionRegistry;
  /** Notifié à chaque expression en échec — le builder y branche ses diagnostics. */
  onExpressionError?: (error: Error, expression: string) => void;
}

export interface QuestionSnapshot {
  question: Question;
  value: unknown;
  /** Visibilité **effective** : la page et les groupes parents sont déjà pris en compte. */
  visible: boolean;
  enabled: boolean;
  required: boolean;
  errors: ValidationError[];
  /** Les erreurs doivent-elles être affichées maintenant ? */
  showErrors: boolean;
  /** Options restant après application de `choicesVisibleIf` et des filtres par option. */
  visibleChoices: Choice[];
  /**
   * Numéro d'affichage, ou `undefined` si la numérotation est désactivée.
   * Calculé ici plutôt que dans le rendu : la numérotation dépend de la visibilité
   * de *toutes* les questions, et la porter dans l'instantané évite de re-rendre
   * la page entière à chaque frappe pour la recalculer.
   */
  number: number | undefined;
}

export interface PanelSnapshot {
  panel: Panel;
  visible: boolean;
  enabled: boolean;
}

export interface SurveyState {
  data: Readonly<Record<string, unknown>>;
  calculated: Readonly<Record<string, unknown>>;
  visiblePages: Page[];
  currentPageIndex: number;
  currentPage: Page | null;
  isFirstPage: boolean;
  isLastPage: boolean;
  completed: boolean;
  /** Progression 0 → 1, sur les seules pages visibles. */
  progress: number;
  /** Nombre de questions visibles en erreur sur la page courante. */
  currentPageErrorCount: number;
  /** Raccourci sur `currentPageErrorCount > 0`. */
  currentPageHasErrors: boolean;
  /** Incrémenté à chaque changement — repère de débogage, pas une clé de rendu. */
  version: number;
}

export type SurveyEventName =
  'stateChanged' | 'valueChanged' | 'pageChanged' | 'completed' | 'validationFailed';

export interface ValueChangedEvent {
  name: string;
  value: unknown;
  previousValue: unknown;
  data: Readonly<Record<string, unknown>>;
}

export interface PageChangedEvent {
  from: Page | null;
  to: Page | null;
}

/** Résultats d'expressions propres à un élément, avant cascade depuis les parents. */
interface OwnExpressionResults {
  visible: boolean;
  enabled: boolean;
  required: boolean;
  visibleChoices: Choice[];
}

/** État d'une question après cascade, prêt à devenir un instantané. */
interface ComputedQuestionState {
  visible: boolean;
  enabled: boolean;
  required: boolean;
  visibleChoices: Choice[];
  number: number | undefined;
}

const MAX_TRIGGER_PASSES = 10;

export class SurveyEngine {
  private readonly definition: SurveyDefinition;
  private readonly registry: QuestionRegistry;
  private readonly graph: DependencyGraph;
  private readonly nowProvider: () => Date;
  private readonly functions: Record<string, ExpressionFunction> | undefined;
  private readonly onExpressionError: ((error: Error, expression: string) => void) | undefined;

  private locale: Locale;
  private mode: SurveyMode;

  private data: Record<string, unknown>;
  private calculated: Record<string, unknown> = {};

  private readonly questionsByName = new Map<string, Question>();
  private readonly pageOfQuestion = new Map<string, string>();
  private readonly ownResults = new Map<string, OwnExpressionResults>();
  private readonly questionSnapshots = new Map<string, QuestionSnapshot>();
  private readonly panelSnapshots = new Map<string, PanelSnapshot>();
  private readonly pageVisibility = new Map<string, boolean>();

  private errors: Record<string, ValidationError[]> = {};
  private readonly touched = new Set<string>();
  private readonly validatedPages = new Set<string>();
  private triggerStates: boolean[];

  private currentPageIndex = 0;
  private completed = false;
  private readonly startedAt: Date;
  private completedAt: Date | null = null;
  private version = 0;

  private state!: SurveyState;
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Map<SurveyEventName, Set<(payload: unknown) => void>>();

  constructor(options: SurveyEngineOptions) {
    this.definition = options.definition;
    this.registry = options.registry ?? questionRegistry;
    this.locale = options.locale ?? options.definition.settings.locale ?? DEFAULT_LOCALE;
    this.mode = options.mode ?? 'edit';
    this.nowProvider = options.now ?? (() => new Date());
    this.functions = options.functions;
    this.onExpressionError = options.onExpressionError;
    this.data = { ...(options.data ?? {}) };
    this.graph = buildDependencyGraph(options.definition);
    this.triggerStates = (options.definition.triggers ?? []).map(() => false);
    this.startedAt = this.nowProvider();

    this.indexElements();
    this.applyDefaultValues();
    this.recomputeAll();
    this.rebuildState();
  }

  /* ------------------------------------------------------------------ */
  /* Indexation                                                          */
  /* ------------------------------------------------------------------ */

  private indexElements(): void {
    for (const page of this.definition.pages) {
      walkElements(page.elements, (element) => {
        if (!isPanel(element)) {
          this.questionsByName.set(element.name, element);
          this.pageOfQuestion.set(element.name, page.id);
        }
      });
    }
  }

  private applyDefaultValues(): void {
    for (const question of this.questionsByName.values()) {
      if (question.defaultValue === undefined) continue;
      if (question.name in this.data) continue;
      this.data[question.name] = question.defaultValue;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Contexte d'évaluation                                               */
  /* ------------------------------------------------------------------ */

  private evaluationContext(item?: unknown): EvaluationContext {
    // Les valeurs calculées sont visibles des expressions au même titre que les
    // réponses : `{estDetracteur}` s'écrit comme `{recommandation}`.
    return {
      data: { ...this.data, ...this.calculated },
      ...(item === undefined ? {} : { item }),
      ...(this.functions ? { functions: this.functions } : {}),
      now: this.nowProvider(),
      ...(this.onExpressionError ? { onError: this.onExpressionError } : {}),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Recalcul                                                            */
  /* ------------------------------------------------------------------ */

  private recomputeCalculated(names?: Iterable<string>): void {
    const wanted = names ? new Set(names) : undefined;
    for (const name of this.graph.calculatedOrder) {
      if (wanted && !wanted.has(name)) continue;
      const definition = (this.definition.calculatedValues ?? []).find(
        (value) => value.name === name,
      );
      if (!definition) continue;
      this.calculated[name] = tryEvaluateExpression(
        definition.expression,
        this.evaluationContext(),
      );
    }
  }

  private computeOwnResults(element: Question | Panel): OwnExpressionResults {
    const context = this.evaluationContext();
    const visible = evaluateCondition(element.visibleIf, context, true);
    const enabled = evaluateCondition(element.enableIf, context, true);

    if (isPanel(element)) {
      return { visible, enabled, required: false, visibleChoices: [] };
    }

    const required =
      element.isRequired === true || evaluateCondition(element.requiredIf, context, false);

    let visibleChoices: Choice[] = [];
    if (isChoiceQuestion(element)) {
      visibleChoices = element.choices.filter((choice) => {
        // `{item}` désigne la valeur de l'option en cours de test.
        const itemContext = this.evaluationContext(choice.value);
        if (!evaluateCondition(element.choicesVisibleIf, itemContext, true)) return false;
        return evaluateCondition(choice.visibleIf, itemContext, true);
      });
    }

    return { visible, enabled, required, visibleChoices };
  }

  /** Réévalue toutes les expressions du sondage. Utilisé à l'initialisation. */
  private recomputeAll(): void {
    this.recomputeCalculated();
    for (const page of this.definition.pages) {
      this.pageVisibility.set(
        page.id,
        evaluateCondition(page.visibleIf, this.evaluationContext(), true),
      );
      walkElements(page.elements, (element) => {
        this.ownResults.set(element.id, this.computeOwnResults(element));
      });
    }
    this.cascadeAndSnapshot();
  }

  /** Réévalue uniquement ce qui dépend des noms modifiés. */
  private recomputeFor(changedNames: string[]): void {
    const affected = affectedBy(this.graph, changedNames);

    if (affected.calculated.size > 0) this.recomputeCalculated(affected.calculated);

    for (const page of this.definition.pages) {
      if (affected.elements.has(page.id)) {
        this.pageVisibility.set(
          page.id,
          evaluateCondition(page.visibleIf, this.evaluationContext(), true),
        );
      }
      walkElements(page.elements, (element) => {
        if (!affected.elements.has(element.id)) return;
        this.ownResults.set(element.id, this.computeOwnResults(element));
      });
    }

    this.cascadeAndSnapshot();
  }

  /**
   * Propage la visibilité de haut en bas puis reconstruit les instantanés.
   *
   * La cascade est refaite intégralement même en recalcul ciblé : elle ne coûte
   * que des lectures de `Map`, et c'est ce qui garantit qu'une question reste
   * masquée lorsque son groupe parent le devient.
   */
  private cascadeAndSnapshot(): void {
    const numbering = this.definition.settings.showQuestionNumbers;
    const counter = { value: 0 };

    for (const page of this.definition.pages) {
      if (numbering === 'onPage') counter.value = 0;
      const pageVisible = this.pageVisibility.get(page.id) ?? true;
      this.cascadeElements(page.elements, pageVisible, this.mode === 'edit', counter);
    }
  }

  private cascadeElements(
    elements: Array<Question | Panel>,
    parentVisible: boolean,
    parentEnabled: boolean,
    counter: { value: number },
  ): void {
    for (const element of elements) {
      const own = this.ownResults.get(element.id) ?? {
        visible: true,
        enabled: true,
        required: false,
        visibleChoices: [],
      };
      const visible = parentVisible && own.visible;
      const enabled = parentEnabled && own.enabled;

      if (isPanel(element)) {
        this.setPanelSnapshot(element, visible, enabled);
        this.cascadeElements(element.elements, visible, enabled, counter);
        continue;
      }

      // Seules les questions visibles portant une réponse sont numérotées :
      // un bloc de contenu ou une question masquée ne doit pas créer de trou.
      let number: number | undefined;
      if (
        this.definition.settings.showQuestionNumbers !== 'off' &&
        visible &&
        this.registry.get(element.type)?.hasValue === true
      ) {
        counter.value += 1;
        number = counter.value;
      }

      this.setQuestionSnapshot(element, {
        visible,
        enabled: enabled && element.readOnly !== true,
        required: own.required,
        visibleChoices: own.visibleChoices,
        number,
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Instantanés — identité stable pour un rendu React ciblé             */
  /* ------------------------------------------------------------------ */

  private shouldShowErrors(question: Question): boolean {
    if (this.definition.settings.checkErrorsMode === 'onValueChanged') {
      return this.touched.has(question.name);
    }
    const pageId = this.pageOfQuestion.get(question.name);
    return pageId !== undefined && this.validatedPages.has(pageId);
  }

  private setQuestionSnapshot(question: Question, computed: ComputedQuestionState): void {
    const candidate: QuestionSnapshot = {
      question,
      value: this.data[question.name],
      visible: computed.visible,
      enabled: computed.enabled,
      required: computed.required,
      errors: this.errors[question.name] ?? [],
      showErrors: this.shouldShowErrors(question),
      visibleChoices: computed.visibleChoices,
      number: computed.number,
    };

    const previous = this.questionSnapshots.get(question.name);
    // Conserver l'objet précédent quand rien n'a changé : le composant React
    // abonné à cette question ne se rend alors pas du tout.
    if (previous && sameQuestionSnapshot(previous, candidate)) return;
    this.questionSnapshots.set(question.name, candidate);
  }

  private setPanelSnapshot(panel: Panel, visible: boolean, enabled: boolean): void {
    const previous = this.panelSnapshots.get(panel.id);
    if (previous && previous.visible === visible && previous.enabled === enabled) return;
    this.panelSnapshots.set(panel.id, { panel, visible, enabled });
  }

  private rebuildState(): void {
    const visiblePages = this.definition.pages.filter(
      (page) => this.pageVisibility.get(page.id) ?? true,
    );

    if (this.currentPageIndex >= visiblePages.length) {
      this.currentPageIndex = Math.max(0, visiblePages.length - 1);
    }
    const currentPage = visiblePages[this.currentPageIndex] ?? null;
    const errorCount = currentPage ? this.pageQuestionsInError(currentPage).length : 0;

    this.version += 1;
    this.state = {
      data: this.data,
      calculated: this.calculated,
      visiblePages,
      currentPageIndex: this.currentPageIndex,
      currentPage,
      isFirstPage: this.currentPageIndex === 0,
      isLastPage: this.currentPageIndex >= visiblePages.length - 1,
      completed: this.completed,
      progress:
        visiblePages.length === 0
          ? 1
          : this.completed
            ? 1
            : this.currentPageIndex / visiblePages.length,
      currentPageErrorCount: errorCount,
      currentPageHasErrors: errorCount > 0,
      version: this.version,
    };
  }

  private emitChange(): void {
    this.rebuildState();
    for (const listener of this.listeners) listener();
    this.emit('stateChanged', this.state);
  }

  /* ------------------------------------------------------------------ */
  /* API de lecture                                                      */
  /* ------------------------------------------------------------------ */

  getState(): SurveyState {
    return this.state;
  }

  /** Abonnement global — branché sur `useSyncExternalStore` par le renderer. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  on<T = unknown>(event: SurveyEventName, listener: (payload: T) => void): () => void {
    const set = this.eventListeners.get(event) ?? new Set();
    set.add(listener as (payload: unknown) => void);
    this.eventListeners.set(event, set);
    return () => {
      set.delete(listener as (payload: unknown) => void);
    };
  }

  private emit<T = unknown>(event: SurveyEventName, payload: T): void {
    const set = this.eventListeners.get(event);
    if (!set) return;
    for (const listener of set) listener(payload);
  }

  getQuestionSnapshot(name: string): QuestionSnapshot | undefined {
    return this.questionSnapshots.get(name);
  }

  getPanelSnapshot(id: string): PanelSnapshot | undefined {
    return this.panelSnapshots.get(id);
  }

  getQuestion(name: string): Question | undefined {
    return this.questionsByName.get(name);
  }

  getValue(name: string): unknown {
    return this.data[name];
  }

  getData(): Readonly<Record<string, unknown>> {
    return this.data;
  }

  getLocale(): Locale {
    return this.locale;
  }

  setLocale(locale: Locale): void {
    if (locale === this.locale) return;
    this.locale = locale;
    // Les libellés sont résolus au rendu : il suffit d'invalider les instantanés.
    this.questionSnapshots.clear();
    this.recomputeAll();
    this.emitChange();
  }

  getMode(): SurveyMode {
    return this.mode;
  }

  setMode(mode: SurveyMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.recomputeAll();
    this.emitChange();
  }

  getDefinition(): SurveyDefinition {
    return this.definition;
  }

  /* ------------------------------------------------------------------ */
  /* Écriture                                                            */
  /* ------------------------------------------------------------------ */

  /** Applique la normalisation du descripteur de type à une valeur brute de champ. */
  private normalize(name: string, rawValue: unknown): unknown {
    const question = this.questionsByName.get(name);
    if (!question) return rawValue;
    const descriptor = this.registry.get(question.type);
    return descriptor?.normalizeValue ? descriptor.normalizeValue(rawValue, question) : rawValue;
  }

  /**
   * Écrit une réponse normalisée. Renvoie `false` si rien n'a bougé.
   * Toutes les écritures passent par ici — saisie utilisateur comme déclencheurs —
   * pour qu'une valeur posée par une règle soit typée comme une valeur saisie.
   */
  private writeValue(name: string, rawValue: unknown): boolean {
    const value = this.normalize(name, rawValue);
    if (Object.is(this.data[name], value)) return false;
    if (value === undefined) delete this.data[name];
    else this.data[name] = value;
    return true;
  }

  setValue(name: string, rawValue: unknown): void {
    const previousValue = this.data[name];
    if (!this.writeValue(name, rawValue)) return;
    const value = this.data[name];

    this.touched.add(name);
    this.recomputeFor([name]);
    this.revalidateQuestion(name);
    this.runTriggers([name]);
    this.emitChange();
    this.emit<ValueChangedEvent>('valueChanged', { name, value, previousValue, data: this.data });
  }

  /** Applique plusieurs réponses en une passe — un seul recalcul, un seul rendu. */
  setValues(values: Record<string, unknown>): void {
    const changed: string[] = [];
    for (const [name, rawValue] of Object.entries(values)) {
      if (!this.writeValue(name, rawValue)) continue;
      this.touched.add(name);
      changed.push(name);
    }
    if (changed.length === 0) return;

    this.recomputeFor(changed);
    for (const name of changed) this.revalidateQuestion(name);
    this.runTriggers(changed);
    this.emitChange();
  }

  /** Efface toutes les réponses et repart de la première page. */
  clear(): void {
    this.data = {};
    this.calculated = {};
    this.errors = {};
    this.touched.clear();
    this.validatedPages.clear();
    this.questionSnapshots.clear();
    this.panelSnapshots.clear();
    this.triggerStates = (this.definition.triggers ?? []).map(() => false);
    this.currentPageIndex = 0;
    this.completed = false;
    this.completedAt = null;
    this.applyDefaultValues();
    this.recomputeAll();
    this.emitChange();
  }

  /* ------------------------------------------------------------------ */
  /* Validation                                                          */
  /* ------------------------------------------------------------------ */

  private revalidateQuestion(name: string): void {
    const question = this.questionsByName.get(name);
    if (!question) return;
    const snapshot = this.questionSnapshots.get(name);

    // Une question masquée n'a pas à être valide : ses règles ne s'appliquent pas.
    if (snapshot && !snapshot.visible) {
      delete this.errors[name];
    } else {
      const errors = validateQuestion(question, this.data[name], {
        isRequired: snapshot?.required ?? question.isRequired === true,
        context: this.evaluationContext(),
      });
      if (errors.length === 0) delete this.errors[name];
      else this.errors[name] = errors;
    }

    // L'instantané doit refléter les nouvelles erreurs.
    if (snapshot) {
      this.setQuestionSnapshot(question, {
        visible: snapshot.visible,
        enabled: snapshot.enabled,
        required: snapshot.required,
        visibleChoices: snapshot.visibleChoices,
        number: snapshot.number,
      });
    }
  }

  private visibleQuestionsOfPage(page: Page): Question[] {
    const questions: Question[] = [];
    walkElements(page.elements, (element) => {
      if (isPanel(element)) return this.panelSnapshots.get(element.id)?.visible !== false;
      if (this.questionSnapshots.get(element.name)?.visible !== false) questions.push(element);
      return true;
    });
    return questions;
  }

  private pageQuestionsInError(page: Page): Question[] {
    return this.visibleQuestionsOfPage(page).filter(
      (question) => (this.errors[question.name] ?? []).length > 0,
    );
  }

  /**
   * Valide toutes les questions visibles d'une page et mémorise qu'elle a été
   * soumise, ce qui rend ses erreurs affichables en mode `onNextPage`.
   */
  validatePage(page: Page): boolean {
    this.validatedPages.add(page.id);
    for (const question of this.visibleQuestionsOfPage(page)) {
      this.revalidateQuestion(question.name);
    }
    // Les instantanés doivent repasser en `showErrors: true`.
    for (const question of this.visibleQuestionsOfPage(page)) {
      const snapshot = this.questionSnapshots.get(question.name);
      if (!snapshot) continue;
      this.setQuestionSnapshot(question, {
        visible: snapshot.visible,
        enabled: snapshot.enabled,
        required: snapshot.required,
        visibleChoices: snapshot.visibleChoices,
        number: snapshot.number,
      });
    }
    return this.pageQuestionsInError(page).length === 0;
  }

  validateCurrentPage(): boolean {
    const page = this.state.currentPage;
    if (!page) return true;
    const valid = this.validatePage(page);
    this.emitChange();
    if (!valid) this.emit('validationFailed', { page, errors: this.errors });
    return valid;
  }

  /** Nom de la première question en erreur de la page courante — cible du focus. */
  getFirstErrorQuestionName(): string | undefined {
    const page = this.state.currentPage;
    if (!page) return undefined;
    return this.pageQuestionsInError(page)[0]?.name;
  }

  getErrors(): Readonly<Record<string, ValidationError[]>> {
    return this.errors;
  }

  /* ------------------------------------------------------------------ */
  /* Navigation                                                          */
  /* ------------------------------------------------------------------ */

  nextPage(): boolean {
    const page = this.state.currentPage;
    if (!page) return false;
    if (!this.validatePage(page)) {
      this.emitChange();
      this.emit('validationFailed', { page, errors: this.errors });
      return false;
    }
    if (this.state.isLastPage) return this.complete();

    const from = page;
    this.currentPageIndex += 1;
    this.emitChange();
    this.emit<PageChangedEvent>('pageChanged', { from, to: this.state.currentPage });
    return true;
  }

  prevPage(): boolean {
    if (this.currentPageIndex === 0) return false;
    const from = this.state.currentPage;
    this.currentPageIndex -= 1;
    this.emitChange();
    this.emit<PageChangedEvent>('pageChanged', { from, to: this.state.currentPage });
    return true;
  }

  /** Navigue sans valider — réservé à la navigation libre (aperçu, back-office). */
  goToPage(index: number): boolean {
    const { visiblePages } = this.state;
    if (index < 0 || index >= visiblePages.length) return false;
    const from = this.state.currentPage;
    this.currentPageIndex = index;
    this.emitChange();
    this.emit<PageChangedEvent>('pageChanged', { from, to: this.state.currentPage });
    return true;
  }

  goToPageNamed(name: string): boolean {
    const index = this.state.visiblePages.findIndex((page) => page.name === name);
    return index === -1 ? false : this.goToPage(index);
  }

  /** Valide toutes les pages visibles puis clôture le sondage. */
  complete(): boolean {
    for (const page of this.state.visiblePages) {
      if (!this.validatePage(page)) {
        // Ramener l'utilisateur sur la première page fautive plutôt que de le
        // laisser devant un bouton qui « ne fait rien ».
        const index = this.state.visiblePages.indexOf(page);
        if (index !== -1) this.currentPageIndex = index;
        this.emitChange();
        this.emit('validationFailed', { page, errors: this.errors });
        return false;
      }
    }
    this.completed = true;
    this.completedAt = this.nowProvider();
    this.emitChange();
    this.emit('completed', this.getResult());
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Déclencheurs                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Exécute les déclencheurs dont la condition vient de passer à vrai.
   *
   * Le déclenchement sur **transition** (et non sur « condition vraie ») est ce qui
   * évite qu'un `setvalue` ne réécrase indéfiniment une réponse que l'utilisateur
   * vient de corriger.
   */
  private runTriggers(changedNames: string[]): void {
    const triggers = this.definition.triggers ?? [];
    if (triggers.length === 0) return;

    let pending = changedNames;
    for (let pass = 0; pass < MAX_TRIGGER_PASSES && pending.length > 0; pass += 1) {
      const affected = affectedBy(this.graph, pending);
      const cascaded: string[] = [];

      triggers.forEach((trigger, index) => {
        if (!affected.triggers.has(index)) return;
        const fires = evaluateCondition(trigger.expression, this.evaluationContext(), false);
        const wasFiring = this.triggerStates[index] ?? false;
        this.triggerStates[index] = fires;
        if (!fires || wasFiring) return;

        switch (trigger.type) {
          case 'setvalue': {
            if (this.writeValue(trigger.setToName, trigger.setValue)) {
              cascaded.push(trigger.setToName);
            }
            break;
          }
          case 'copyvalue': {
            if (this.writeValue(trigger.setToName, this.data[trigger.fromName])) {
              cascaded.push(trigger.setToName);
            }
            break;
          }
          case 'skip': {
            // `gotoName` désigne indifféremment une page ou une question : on tente
            // la page d'abord, puis la page qui contient la question nommée.
            if (!this.goToPageNamed(trigger.gotoName)) {
              this.goToPageOfQuestion(trigger.gotoName);
            }
            break;
          }
          case 'complete': {
            this.completed = true;
            this.completedAt = this.nowProvider();
            break;
          }
        }
      });

      if (cascaded.length === 0) break;
      this.recomputeFor(cascaded);
      for (const name of cascaded) this.revalidateQuestion(name);
      pending = cascaded;
    }
  }

  private goToPageOfQuestion(questionName: string): boolean {
    const pageId = this.pageOfQuestion.get(questionName);
    if (!pageId) return false;
    const index = this.state.visiblePages.findIndex((page) => page.id === pageId);
    return index === -1 ? false : this.goToPage(index);
  }

  /* ------------------------------------------------------------------ */
  /* Résultat                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Construit le résultat destiné au backend.
   *
   * Seules les questions **visibles** y figurent : une réponse donnée puis rendue
   * hors sujet par un changement de parcours ne doit pas polluer le reporting.
   * Elle reste néanmoins dans `data`, pour que revenir en arrière la restaure.
   */
  getResult(): SurveyResult {
    const answers: SurveyAnswer[] = [];
    const data: Record<string, unknown> = {};
    const context = { locale: this.locale, data: this.data };

    for (const question of this.questionsByName.values()) {
      const snapshot = this.questionSnapshots.get(question.name);
      if (!snapshot?.visible) continue;

      const descriptor = this.registry.get(question.type);
      if (!descriptor?.hasValue) continue;

      const value = this.data[question.name];
      if (descriptor.isEmpty(value)) continue;

      data[question.name] = value;
      answers.push({
        questionId: question.id,
        questionName: question.name,
        type: question.type,
        title: resolveText(question.title, this.locale),
        value,
        displayValue: descriptor.getDisplayValue(value, question, context),
      });
    }

    for (const calculated of this.definition.calculatedValues ?? []) {
      if (!calculated.includeIntoResult) continue;
      data[calculated.name] = this.calculated[calculated.name];
    }

    const completedAt = this.completedAt ?? this.nowProvider();
    return {
      surveyId: this.definition.id,
      schemaVersion: this.definition.schemaVersion,
      locale: this.locale,
      startedAt: this.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - this.startedAt.getTime(),
      data,
      answers,
    };
  }
}

function sameErrors(left: ValidationError[], right: ValidationError[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((error, index) => {
    const other = right[index]!;
    return (
      error.key === other.key &&
      JSON.stringify(error.params ?? null) === JSON.stringify(other.params ?? null)
    );
  });
}

function sameChoices(left: Choice[], right: Choice[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((choice, index) => choice === right[index]);
}

function sameQuestionSnapshot(left: QuestionSnapshot, right: QuestionSnapshot): boolean {
  return (
    left.question === right.question &&
    Object.is(left.value, right.value) &&
    left.visible === right.visible &&
    left.enabled === right.enabled &&
    left.required === right.required &&
    left.showErrors === right.showErrors &&
    sameErrors(left.errors, right.errors) &&
    left.number === right.number &&
    sameChoices(left.visibleChoices, right.visibleChoices)
  );
}
