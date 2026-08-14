import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { resolveText } from '../core/localization/resolveText';
import { questionRegistry, type QuestionRegistry } from '../core/registry/questionRegistry';
import type { Locale, LocalizedString } from '../core/schema/types';
import {
  createBuilderTranslator,
  type BuilderMessages,
  type TranslateBuilder,
} from '../i18n/builderMessages';
import type { BuilderStore, BuilderStoreApi } from './store/builderStore';

interface BuilderContextValue {
  store: BuilderStoreApi;
  registry: QuestionRegistry;
  locale: Locale;
  t: TranslateBuilder;
  text: (value: LocalizedString | undefined) => string;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

export interface BuilderProviderProps {
  store: BuilderStoreApi;
  locale: Locale;
  registry?: QuestionRegistry;
  messages?: Partial<BuilderMessages>;
  children: ReactNode;
}

export function BuilderProvider({
  store,
  locale,
  registry = questionRegistry,
  messages,
  children,
}: BuilderProviderProps): ReactNode {
  const value = useMemo<BuilderContextValue>(
    () => ({
      store,
      registry,
      locale,
      t: createBuilderTranslator(locale, messages),
      text: (input) => resolveText(input, locale),
    }),
    [store, registry, locale, messages],
  );

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}

export function useBuilderContext(): BuilderContextValue {
  const value = useContext(BuilderContext);
  if (!value) {
    throw new Error('Ce composant doit être rendu à l’intérieur de <SurveyBuilder>.');
  }
  return value;
}

/**
 * Sélecteur sur le store du builder.
 * Passer un sélecteur étroit limite les rendus au strict nécessaire — le panneau
 * de propriétés ne doit pas se re-rendre parce qu'une autre page a bougé.
 */
export function useBuilder<T>(selector: (state: BuilderStore) => T): T {
  const { store } = useBuilderContext();
  return useStore(store, selector);
}

/** Accès direct aux actions, sans abonnement (les actions sont stables). */
export function useBuilderActions(): BuilderStore {
  const { store } = useBuilderContext();
  return store.getState();
}
