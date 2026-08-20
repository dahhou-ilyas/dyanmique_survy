import { describe, expect, it } from 'vitest';
import { minimalSurvey, satisfactionSurvey } from '../../tests/fixtures';
import { SurveyShapeError, assertSurveyShape } from './assertSurveyShape';

describe('définitions valides', () => {
  it.each([
    ['minimal', minimalSurvey()],
    ['avec groupes, logique et options', satisfactionSurvey()],
  ])('accepte un sondage %s', (_nom, definition) => {
    expect(assertSurveyShape(definition)).toBe(definition);
  });

  it('accepte un libellé sous forme de table de traductions', () => {
    const survey = minimalSurvey();
    survey.title = { fr: 'Titre', en: 'Title' };
    expect(() => assertSurveyShape(survey)).not.toThrow();
  });

  it('descend dans les groupes imbriqués', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements = [
      {
        id: 'p1',
        name: 'externe',
        type: 'panel',
        elements: [
          {
            id: 'p2',
            name: 'interne',
            type: 'panel',
            elements: [{ id: 'q', name: 'profond', type: 'text', title: 'Profond' }],
          },
        ],
      },
    ];
    expect(() => assertSurveyShape(survey)).not.toThrow();
  });
});

describe('définitions rejetées', () => {
  it.each([
    ['null', null],
    ['une chaîne', 'texte'],
    ['un tableau', []],
    ['un objet vide', {}],
  ])('rejette %s', (_nom, valeur) => {
    expect(() => assertSurveyShape(valeur)).toThrow(SurveyShapeError);
  });

  it('exige schemaVersion', () => {
    const survey = { ...minimalSurvey(), schemaVersion: '1' };
    expect(() => assertSurveyShape(survey)).toThrow(/schemaVersion/);
  });

  it('exige au moins une page', () => {
    expect(() => assertSurveyShape({ ...minimalSurvey(), pages: [] })).toThrow(/pages/);
  });

  it('exige des réglages avec une locale', () => {
    const survey = { ...minimalSurvey(), settings: {} };
    expect(() => assertSurveyShape(survey)).toThrow(/settings.locale/);
  });

  it.each(['3questions', 'mon nom', 'nom-tiret', ''])(
    'rejette le nom de question « %s »',
    (nom) => {
      const survey = minimalSurvey();
      survey.pages[0]!.elements[0]!.name = nom;
      expect(() => assertSurveyShape(survey)).toThrow(/name/);
    },
  );

  it('exige un tableau d’éléments dans un groupe', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements = [{ id: 'p', name: 'groupe', type: 'panel' } as never];
    expect(() => assertSurveyShape(survey)).toThrow(/elements/);
  });

  it('signale le chemin exact de l’erreur', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push({ id: '', name: 'x', type: 'text', title: 'X' });
    expect(() => assertSurveyShape(survey)).toThrow(/pages\[0\]\.elements\[1\]\.id/);
  });

  it('remonte une erreur depuis un groupe imbriqué', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements = [
      {
        id: 'p1',
        name: 'externe',
        type: 'panel',
        elements: [{ id: 'q', name: 'nom invalide', type: 'text', title: 'X' } as never],
      },
    ];
    expect(() => assertSurveyShape(survey)).toThrow(
      /pages\[0\]\.elements\[0\]\.elements\[0\]\.name/,
    );
  });
});

describe('portée volontairement limitée', () => {
  it('n’inspecte pas les types de questions', () => {
    // Un type inconnu passe ce contrôle : le moteur de rendu affiche déjà un
    // message explicite pour ce cas. Valider les types ici imposerait Zod, soit
    // 60 Ko gzip pour une vérification que le rendu fait mieux, plus tard.
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.type = 'signature' as never;
    expect(() => assertSurveyShape(survey)).not.toThrow();
  });

  it('n’inspecte pas les expressions', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.visibleIf = '{a} =';
    // Une expression cassée se comporte comme absente — décision du moteur.
    expect(() => assertSurveyShape(survey)).not.toThrow();
  });
});
