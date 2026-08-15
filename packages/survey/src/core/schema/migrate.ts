import { CURRENT_SCHEMA_VERSION, type SurveyDefinition } from './types';

/**
 * Migrations du schéma JSON.
 *
 * Les définitions sont stockées en base et survivent aux montées de version du
 * package : toute évolution incompatible du schéma doit incrémenter
 * `CURRENT_SCHEMA_VERSION` et ajouter une étape ici. Le renderer et le builder
 * appellent `migrateSurvey` avant toute autre opération, ce qui garantit qu'aucun
 * code métier n'a jamais à connaître les anciennes formes.
 */

/** Transforme une définition de la version `from` vers `from + 1`. */
export type MigrationStep = (survey: Record<string, unknown>) => Record<string, unknown>;

/**
 * Indexé par version de départ : `MIGRATIONS[1]` fait passer de la v1 à la v2.
 * Vide tant que le schéma n'a pas évolué — l'infrastructure est en place pour
 * que la première migration ne soit qu'une entrée de plus.
 */
export const MIGRATIONS: Record<number, MigrationStep> = {};

export class SurveyMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SurveyMigrationError';
  }
}

/** Vrai si la définition n'est pas à la version courante du schéma. */
export function needsMigration(survey: { schemaVersion?: number }): boolean {
  return (survey.schemaVersion ?? 0) !== CURRENT_SCHEMA_VERSION;
}

/**
 * Applique les migrations successives jusqu'à la version courante.
 *
 * Une définition produite par une version *plus récente* du package est refusée
 * plutôt que traitée au mieux : la faire tourner sur un moteur qui ignore ses
 * nouveautés produirait des réponses silencieusement incomplètes.
 */
export function migrateSurvey(input: unknown): SurveyDefinition {
  if (typeof input !== 'object' || input === null) {
    throw new SurveyMigrationError('La définition de sondage doit être un objet.');
  }

  let current = { ...(input as Record<string, unknown>) };
  let version = typeof current.schemaVersion === 'number' ? current.schemaVersion : 1;

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new SurveyMigrationError(
      `Cette définition est en version ${version}, alors que ce package gère au plus la ` +
        `version ${CURRENT_SCHEMA_VERSION}. Mettez à jour @dahhouilyas/survey avant de l'ouvrir.`,
    );
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      throw new SurveyMigrationError(
        `Aucune migration disponible de la version ${version} vers ${version + 1}.`,
      );
    }
    current = step(current);
    version += 1;
    current.schemaVersion = version;
  }

  current.schemaVersion = CURRENT_SCHEMA_VERSION;
  return current as unknown as SurveyDefinition;
}
