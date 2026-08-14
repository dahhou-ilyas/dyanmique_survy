import { afterEach, describe, expect, it } from 'vitest';
import { minimalSurvey } from '../../../tests/fixtures';
import { MIGRATIONS, SurveyMigrationError, migrateSurvey, needsMigration } from './migrate';
import { CURRENT_SCHEMA_VERSION } from './types';

afterEach(() => {
  for (const key of Object.keys(MIGRATIONS)) {
    delete MIGRATIONS[Number(key)];
  }
});

describe('needsMigration', () => {
  it('est faux pour la version courante', () => {
    expect(needsMigration({ schemaVersion: CURRENT_SCHEMA_VERSION })).toBe(false);
  });

  it('est vrai quand la version manque', () => {
    expect(needsMigration({})).toBe(true);
  });
});

describe('migrateSurvey', () => {
  it('laisse intacte une définition déjà à jour', () => {
    const survey = minimalSurvey();
    expect(migrateSurvey(survey)).toEqual(survey);
  });

  it('refuse une définition produite par une version plus récente', () => {
    expect(() => migrateSurvey({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(
      SurveyMigrationError,
    );
    expect(() => migrateSurvey({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(
      /Mettez à jour @edb\/survey/,
    );
  });

  it('refuse une entrée qui n’est pas un objet', () => {
    expect(() => migrateSurvey(null)).toThrow(SurveyMigrationError);
    expect(() => migrateSurvey('texte')).toThrow(SurveyMigrationError);
  });

  it('applique les étapes successives et met à jour la version', () => {
    // On simule un schéma en avance de deux versions pour vérifier l'enchaînement.
    const target = CURRENT_SCHEMA_VERSION;
    MIGRATIONS[target - 2] = (survey) => ({ ...survey, ajouteParEtape1: true });
    MIGRATIONS[target - 1] = (survey) => ({ ...survey, ajouteParEtape2: true });

    const migrated = migrateSurvey({ schemaVersion: target - 2, id: 'x' }) as unknown as Record<
      string,
      unknown
    >;

    expect(migrated.ajouteParEtape1).toBe(true);
    expect(migrated.ajouteParEtape2).toBe(true);
    expect(migrated.schemaVersion).toBe(target);
  });

  it('échoue explicitement quand une étape manque', () => {
    expect(() => migrateSurvey({ schemaVersion: CURRENT_SCHEMA_VERSION - 3 })).toThrow(
      /Aucune migration disponible/,
    );
  });

  it('ne modifie pas l’objet d’entrée', () => {
    const input = { schemaVersion: CURRENT_SCHEMA_VERSION, id: 'x' };
    migrateSurvey(input);
    expect(Object.keys(input)).toEqual(['schemaVersion', 'id']);
  });
});
