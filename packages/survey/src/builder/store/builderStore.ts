import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createId, createPage, createPanel, createQuestion } from '../../core/schema/defaults';
import {
  collectUsedNames,
  findElementById,
  generateUniqueName,
  walkElements,
} from '../../core/schema/traverse';
import {
  isPanel,
  type Page,
  type Panel,
  type SurveyDefinition,
  type SurveyElement,
} from '../../core/schema/types';

enablePatches();

/** Ce qui est actuellement sélectionné dans le concepteur. */
export type Selection =
  { kind: 'survey' } | { kind: 'page'; id: string } | { kind: 'element'; id: string };

/** Destination d'un déplacement ou d'un ajout. */
export interface DropTarget {
  pageId: string;
  /** Groupe d'accueil, ou `null` pour la racine de la page. */
  parentId: string | null;
  index: number;
}

interface HistoryEntry {
  patches: Patch[];
  inverse: Patch[];
  label: string;
}

export interface BuilderState {
  survey: SurveyDefinition;
  selection: Selection;
  currentPageId: string;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Vrai dès qu'une modification a eu lieu depuis le dernier `markSaved`. */
  dirty: boolean;
}

export interface BuilderActions {
  /** Remplace la définition et réinitialise l'historique (chargement d'un autre sondage). */
  replaceSurvey: (survey: SurveyDefinition) => void;
  markSaved: () => void;

  undo: () => void;
  redo: () => void;

  select: (selection: Selection) => void;
  setCurrentPage: (pageId: string) => void;

  addPage: () => void;
  removePage: (pageId: string) => void;
  movePage: (from: number, to: number) => void;
  updatePage: (pageId: string, changes: Partial<Page>) => void;

  /** Ajoute une question ou un groupe. `type: 'panel'` crée un groupe. */
  addElement: (type: string, target?: DropTarget) => void;
  removeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  moveElement: (id: string, target: DropTarget) => void;
  updateElement: (id: string, changes: Record<string, unknown>) => void;
  /** Renomme un élément en garantissant l'unicité du nom. */
  renameElement: (id: string, name: string) => void;

  updateSurvey: (changes: Partial<SurveyDefinition>) => void;
  updateSettings: (changes: Partial<SurveyDefinition['settings']>) => void;
}

export type BuilderStore = BuilderState & BuilderActions;
export type BuilderStoreApi = StoreApi<BuilderStore>;

/** Profondeur d'historique — au-delà, les entrées les plus anciennes sont oubliées. */
const HISTORY_LIMIT = 100;

export function createBuilderStore(initial: SurveyDefinition): BuilderStoreApi {
  return createStore<BuilderStore>()((set, get) => {
    /**
     * Applique une modification et empile son inverse.
     *
     * L'historique stocke des **patches** plutôt que des copies complètes du
     * sondage : sur un questionnaire de cent questions, mémoriser cent états
     * entiers pour cent frappes au clavier serait inutilement coûteux.
     */
    const commit = (label: string, recipe: (draft: SurveyDefinition) => void): void => {
      const { survey, past } = get();
      const [next, patches, inverse] = produceWithPatches(survey, recipe);
      if (patches.length === 0) return;

      const entry: HistoryEntry = { patches, inverse, label };
      const trimmed = past.length >= HISTORY_LIMIT ? past.slice(1) : past;

      set({
        survey: next,
        past: [...trimmed, entry],
        // Toute nouvelle action invalide la branche « refaire ».
        future: [],
        dirty: true,
      });
    };

    return {
      survey: initial,
      selection: { kind: 'survey' },
      currentPageId: initial.pages[0]?.id ?? '',
      past: [],
      future: [],
      dirty: false,

      /* ----------------------------- Cycle de vie ---------------------------- */

      replaceSurvey: (survey) =>
        set({
          survey,
          selection: { kind: 'survey' },
          currentPageId: survey.pages[0]?.id ?? '',
          past: [],
          future: [],
          dirty: false,
        }),

      markSaved: () => set({ dirty: false }),

      /* ------------------------------ Historique ----------------------------- */

      undo: () => {
        const { past, future, survey } = get();
        const entry = past[past.length - 1];
        if (!entry) return;
        set({
          survey: applyPatches(survey, entry.inverse),
          past: past.slice(0, -1),
          future: [entry, ...future],
          dirty: true,
        });
      },

      redo: () => {
        const { past, future, survey } = get();
        const [entry, ...rest] = future;
        if (!entry) return;
        set({
          survey: applyPatches(survey, entry.patches),
          past: [...past, entry],
          future: rest,
          dirty: true,
        });
      },

      /* ------------------------------ Sélection ------------------------------ */

      select: (selection) => {
        set({ selection });
        // Sélectionner un élément d'une autre page doit y amener le concepteur.
        if (selection.kind === 'element') {
          const location = findElementById(get().survey, selection.id);
          if (location) set({ currentPageId: location.page.id });
        }
        if (selection.kind === 'page') set({ currentPageId: selection.id });
      },

      setCurrentPage: (pageId) =>
        set({ currentPageId: pageId, selection: { kind: 'page', id: pageId } }),

      /* -------------------------------- Pages -------------------------------- */

      addPage: () => {
        const names = collectUsedNames(get().survey);
        const page = createPage(generateUniqueName(names, 'page'));
        commit('Ajouter une page', (draft) => {
          draft.pages.push(page);
        });
        set({ currentPageId: page.id, selection: { kind: 'page', id: page.id } });
      },

      removePage: (pageId) => {
        const { survey } = get();
        // Un sondage sans page ne serait plus rendable : la dernière est protégée.
        if (survey.pages.length <= 1) return;
        const index = survey.pages.findIndex((page) => page.id === pageId);
        if (index === -1) return;

        commit('Supprimer la page', (draft) => {
          draft.pages.splice(index, 1);
        });

        const fallback = get().survey.pages[Math.min(index, get().survey.pages.length - 1)];
        set({
          currentPageId: fallback?.id ?? '',
          selection: fallback ? { kind: 'page', id: fallback.id } : { kind: 'survey' },
        });
      },

      movePage: (from, to) =>
        commit('Déplacer la page', (draft) => {
          const [page] = draft.pages.splice(from, 1);
          if (page) draft.pages.splice(to, 0, page);
        }),

      updatePage: (pageId, changes) =>
        commit('Modifier la page', (draft) => {
          const page = draft.pages.find((candidate) => candidate.id === pageId);
          if (page) Object.assign(page, changes);
        }),

      /* ------------------------------ Éléments ------------------------------- */

      addElement: (type, target) => {
        const { survey, currentPageId } = get();
        const names = collectUsedNames(survey);
        const prefix = type === 'panel' ? 'groupe' : 'question';
        const name = generateUniqueName(names, prefix);
        const element: SurveyElement =
          type === 'panel' ? createPanel(name) : createQuestion(type, name);

        const destination: DropTarget = target ?? {
          pageId: currentPageId,
          parentId: null,
          index: Number.POSITIVE_INFINITY,
        };

        commit('Ajouter un élément', (draft) => {
          const container = containerOf(draft, destination);
          if (!container) return;
          container.splice(clampIndex(destination.index, container.length), 0, element);
        });

        set({ selection: { kind: 'element', id: element.id }, currentPageId: destination.pageId });
      },

      removeElement: (id) => {
        commit('Supprimer l’élément', (draft) => {
          const location = findElementById(draft, id);
          if (!location) return;
          const container = location.parent ? location.parent.elements : location.page.elements;
          container.splice(location.index, 1);
        });
        set({ selection: { kind: 'survey' } });
      },

      duplicateElement: (id) => {
        const { survey } = get();
        const location = findElementById(survey, id);
        if (!location) return;

        const names = collectUsedNames(survey);
        const copy = cloneWithNewIdentity(location.element, names);

        commit('Dupliquer l’élément', (draft) => {
          const target = findElementById(draft, id);
          if (!target) return;
          const container = target.parent ? target.parent.elements : target.page.elements;
          container.splice(target.index + 1, 0, copy);
        });

        set({ selection: { kind: 'element', id: copy.id } });
      },

      moveElement: (id, target) =>
        commit('Déplacer l’élément', (draft) => {
          const location = findElementById(draft, id);
          if (!location) return;

          // Interdire de déposer un groupe dans lui-même ou dans sa descendance :
          // l'arbre deviendrait cyclique et le rendu boucherait à l'infini.
          if (isPanel(location.element) && target.parentId) {
            if (target.parentId === location.element.id) return;
            if (containsElement(location.element, target.parentId)) return;
          }

          const source = location.parent ? location.parent.elements : location.page.elements;
          const [element] = source.splice(location.index, 1);
          if (!element) return;

          const container = containerOf(draft, target);
          if (!container) {
            // Cible introuvable : remettre l'élément à sa place plutôt que le perdre.
            source.splice(location.index, 0, element);
            return;
          }

          // Retirer avant d'insérer décale les index du même conteneur : on corrige.
          const sameContainer = container === source;
          const insertAt =
            sameContainer && target.index > location.index ? target.index - 1 : target.index;
          container.splice(clampIndex(insertAt, container.length), 0, element);
        }),

      updateElement: (id, changes) =>
        commit('Modifier l’élément', (draft) => {
          const location = findElementById(draft, id);
          if (!location) return;
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined) {
              delete (location.element as unknown as Record<string, unknown>)[key];
            } else {
              (location.element as unknown as Record<string, unknown>)[key] = value;
            }
          }
        }),

      renameElement: (id, name) => {
        const { survey } = get();
        const location = findElementById(survey, id);
        if (!location || location.element.name === name) return;

        const taken = collectUsedNames(survey);
        taken.delete(location.element.name);
        // Un doublon casserait les expressions et les clés de réponse : on suffixe.
        const unique = taken.has(name) ? generateUniqueName(taken, name) : name;

        commit('Renommer l’élément', (draft) => {
          const target = findElementById(draft, id);
          if (target) target.element.name = unique;
        });
      },

      /* ------------------------------- Sondage ------------------------------- */

      updateSurvey: (changes) =>
        commit('Modifier le sondage', (draft) => {
          Object.assign(draft, changes);
        }),

      updateSettings: (changes) =>
        commit('Modifier les réglages', (draft) => {
          Object.assign(draft.settings, changes);
        }),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Utilitaires                                                                */
/* -------------------------------------------------------------------------- */

function containerOf(survey: SurveyDefinition, target: DropTarget): SurveyElement[] | undefined {
  const page = survey.pages.find((candidate) => candidate.id === target.pageId);
  if (!page) return undefined;
  if (!target.parentId) return page.elements;

  const location = findElementById(survey, target.parentId);
  if (!location || !isPanel(location.element)) return undefined;
  return location.element.elements;
}

function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index) || index > length) return length;
  return Math.max(0, index);
}

function containsElement(panel: Panel, id: string): boolean {
  let found = false;
  walkElements(panel.elements, (element) => {
    if (element.id === id) found = true;
    return !found;
  });
  return found;
}

/**
 * Copie profonde d'un élément avec de nouveaux identifiants et noms.
 * Sans cela, le doublon partagerait la clé de réponse de l'original et les deux
 * questions écriraient au même endroit.
 */
function cloneWithNewIdentity(element: SurveyElement, taken: Set<string>): SurveyElement {
  const copy = structuredClone(element) as SurveyElement;
  const rename = (target: SurveyElement): void => {
    target.id = createId();
    const prefix = isPanel(target) ? 'groupe' : 'question';
    target.name = generateUniqueName(taken, prefix);
    taken.add(target.name);
    if (isPanel(target)) {
      for (const child of target.elements) rename(child);
    }
  };
  rename(copy);
  return copy;
}

/** Étiquette de la prochaine action annulable — affichée en infobulle du bouton. */
export function undoLabel(state: BuilderState): string | undefined {
  return state.past[state.past.length - 1]?.label;
}

export function redoLabel(state: BuilderState): string | undefined {
  return state.future[0]?.label;
}
