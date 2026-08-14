import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SurveyEngine } from '../core/engine/SurveyEngine';
import { resolveText } from '../core/localization/resolveText';
import { questionRegistry, type QuestionRegistry } from '../core/registry/questionRegistry';
import type { Locale, LocalizedString } from '../core/schema/types';
import { createTranslator, type Messages, type Translate } from '../i18n/messages';
import type { FieldComponents } from './fieldComponents';

export interface SurveyContextValue {
  engine: SurveyEngine;
  registry: QuestionRegistry;
  locale: Locale;
  /** Traduit un libellé d'interface. */
  t: Translate;
  /** Résout un texte multilingue du sondage dans la locale courante. */
  text: (value: LocalizedString | undefined) => string;
  components: FieldComponents;
}

const SurveyContext = createContext<SurveyContextValue | null>(null);

export interface SurveyProviderProps {
  engine: SurveyEngine;
  locale: Locale;
  components: FieldComponents;
  registry?: QuestionRegistry;
  messages?: Partial<Messages>;
  children: ReactNode;
}

export function SurveyProvider({
  engine,
  locale,
  components,
  registry = questionRegistry,
  messages,
  children,
}: SurveyProviderProps): ReactNode {
  const value = useMemo<SurveyContextValue>(
    () => ({
      engine,
      registry,
      locale,
      t: createTranslator(locale, messages),
      text: (input) => resolveText(input, locale),
      components,
    }),
    [engine, registry, locale, messages, components],
  );

  return <SurveyContext.Provider value={value}>{children}</SurveyContext.Provider>;
}

export function useSurveyContext(): SurveyContextValue {
  const value = useContext(SurveyContext);
  if (!value) {
    throw new Error(
      'Ce composant doit être rendu à l’intérieur de <SurveyRenderer>. ' +
        'Un champ personnalisé ne peut être utilisé qu’au sein du moteur de rendu.',
    );
  }
  return value;
}
