import { nanoid } from 'nanoid';
import { questionRegistry } from '../registry/questionRegistry';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_LOCALE,
  type Locale,
  type Page,
  type Panel,
  type Question,
  type SurveyDefinition,
  type SurveySettings,
} from './types';

/** Identifiant technique court, stable et non deviné à partir du contenu. */
export function createId(): string {
  return nanoid(10);
}

export function createDefaultSettings(locale: Locale = DEFAULT_LOCALE): SurveySettings {
  return {
    locale,
    showProgressBar: 'top',
    showQuestionNumbers: 'off',
    showPageTitles: true,
    // Par défaut on ne signale les erreurs qu'à la navigation : afficher une erreur
    // pendant que l'utilisateur tape est perçu comme agressif sur un sondage.
    checkErrorsMode: 'onNextPage',
  };
}

export function createPage(name: string, title?: string): Page {
  return {
    id: createId(),
    name,
    ...(title === undefined ? {} : { title }),
    elements: [],
  };
}

export function createPanel(name: string): Panel {
  return {
    id: createId(),
    name,
    type: 'panel',
    title: { fr: 'Groupe de questions', en: 'Question group' },
    state: 'expanded',
    elements: [],
  };
}

/** Crée une question via son descripteur — les valeurs par défaut viennent du registre. */
export function createQuestion(type: string, name: string): Question {
  return questionRegistry.create(type, name, createId());
}

/** Sondage vierge : une page, aucune question. */
export function createSurvey(overrides: Partial<SurveyDefinition> = {}): SurveyDefinition {
  const locale = overrides.settings?.locale ?? DEFAULT_LOCALE;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: createId(),
    title: { fr: 'Nouveau sondage', en: 'New survey' },
    pages: [createPage('page1')],
    ...overrides,
    settings: { ...createDefaultSettings(locale), ...overrides.settings },
  };
}
