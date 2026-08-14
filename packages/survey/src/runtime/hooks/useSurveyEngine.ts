import { useCallback, useSyncExternalStore } from 'react';
import type { PanelSnapshot, QuestionSnapshot, SurveyState } from '../../core/engine/SurveyEngine';
import { useSurveyContext } from '../SurveyProvider';

/** État global du sondage : page courante, progression, complétion. */
export function useSurveyState(): SurveyState {
  const { engine } = useSurveyContext();
  const subscribe = useCallback((listener: () => void) => engine.subscribe(listener), [engine]);
  const getSnapshot = useCallback(() => engine.getState(), [engine]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Abonne un composant à **une seule** question.
 *
 * Le moteur conserve l'identité de l'instantané tant que rien ne change pour
 * cette question : saisir dans un champ ne provoque donc pas le rendu des autres.
 */
export function useQuestionSnapshot(name: string): QuestionSnapshot | undefined {
  const { engine } = useSurveyContext();
  const subscribe = useCallback((listener: () => void) => engine.subscribe(listener), [engine]);
  const getSnapshot = useCallback(() => engine.getQuestionSnapshot(name), [engine, name]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Idem pour un groupe (panel), identifié par son `id`. */
export function usePanelSnapshot(id: string): PanelSnapshot | undefined {
  const { engine } = useSurveyContext();
  const subscribe = useCallback((listener: () => void) => engine.subscribe(listener), [engine]);
  const getSnapshot = useCallback(() => engine.getPanelSnapshot(id), [engine, id]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
