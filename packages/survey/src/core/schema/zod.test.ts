import { describe, expect, it } from 'vitest';
import { minimalSurvey, satisfactionSurvey } from '../../../tests/fixtures';
import { SurveySchemaError, parseSurvey, safeParseSurvey } from './zod';

describe('safeParseSurvey', () => {
  it('accepte un sondage complet avec panels, logique et déclencheurs', () => {
    const result = safeParseSurvey(satisfactionSurvey());
    expect(result.success).toBe(true);
  });

  it('effectue un aller-retour JSON sans perte', () => {
    const original = satisfactionSurvey();
    const roundTripped = parseSurvey(JSON.parse(JSON.stringify(original)));
    expect(roundTripped).toEqual(original);
  });

  it('valide les panels imbriqués récursivement', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements = [
      {
        id: 'pnl1',
        name: 'externe',
        type: 'panel',
        elements: [
          {
            id: 'pnl2',
            name: 'interne',
            type: 'panel',
            elements: [{ id: 'q1', name: 'profond', type: 'text', title: 'Profond' }],
          },
        ],
      },
    ];
    expect(safeParseSurvey(survey).success).toBe(true);
  });

  it('remonte une erreur sur un panel imbriqué invalide', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements = [
      {
        id: 'pnl1',
        name: 'externe',
        type: 'panel',
        elements: [{ id: 'q1', name: '3-invalide', type: 'text', title: 'X' } as never],
      },
    ];
    const result = safeParseSurvey(survey);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0]!.path).toBe('pages[0].elements[0].elements[0].name');
    }
  });

  it('refuse un type de question inconnu', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements = [{ id: 'q1', name: 'x', type: 'signature', title: 'X' } as never];
    expect(safeParseSurvey(survey).success).toBe(false);
  });

  it.each([
    ['3questions', 'commence par un chiffre'],
    ['mon nom', 'contient un espace'],
    ['nom-tiret', 'contient un tiret'],
    ['', 'est vide'],
  ])('refuse le nom « %s » (%s)', (name) => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.name = name;
    expect(safeParseSurvey(survey).success).toBe(false);
  });

  it.each(['nom', '_prive', 'question1', 'NomEnCamelCase'])('accepte le nom « %s »', (name) => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.name = name;
    expect(safeParseSurvey(survey).success).toBe(true);
  });

  it('refuse une clé de traduction inconnue', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.title = { fr: 'Nom', de: 'Name' } as never;
    expect(safeParseSurvey(survey).success).toBe(false);
  });

  it('formate les chemins d’erreur avec index de tableau', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.name = 'nom invalide';
    const result = safeParseSurvey(survey);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0]!.path).toBe('pages[0].elements[0].name');
    }
  });
});

describe('parseSurvey', () => {
  it('lève SurveySchemaError avec le détail des problèmes', () => {
    expect(() => parseSurvey({ nawak: true })).toThrow(SurveySchemaError);
    try {
      parseSurvey({ nawak: true });
    } catch (error) {
      expect(error).toBeInstanceOf(SurveySchemaError);
      expect((error as SurveySchemaError).issues.length).toBeGreaterThan(0);
      expect((error as SurveySchemaError).message).toContain('JSON de sondage invalide');
    }
  });

  it('rejette les entrées non objet', () => {
    expect(() => parseSurvey(null)).toThrow(SurveySchemaError);
    expect(() => parseSurvey('texte')).toThrow(SurveySchemaError);
  });
});
