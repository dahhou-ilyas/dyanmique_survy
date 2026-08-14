import { describe, expect, it } from 'vitest';
import { satisfactionSurvey } from '../../../tests/fixtures';
import {
  collectElements,
  collectPageQuestions,
  collectQuestions,
  collectUsedNames,
  findElementById,
  findPageByName,
  findPageOfQuestion,
  findQuestionByName,
  generateUniqueName,
  walkElements,
} from './traverse';

describe('collectQuestions', () => {
  it('aplatit les panels et respecte l’ordre d’affichage', () => {
    const names = collectQuestions(satisfactionSurvey()).map((question) => question.name);
    expect(names).toEqual([
      'satisfaction',
      'commentaire',
      'recommandation',
      'email',
      'age',
      'canaux',
      'segment',
    ]);
  });

  it('n’inclut jamais les panels', () => {
    const types = collectQuestions(satisfactionSurvey()).map((question) => question.type);
    expect(types).not.toContain('panel');
  });
});

describe('collectElements', () => {
  it('inclut les panels en plus des questions', () => {
    const names = collectElements(satisfactionSurvey()).map((element) => element.name);
    expect(names).toContain('coordonnees');
    expect(names).toHaveLength(8);
  });
});

describe('collectPageQuestions', () => {
  it('ne renvoie que les questions de la page demandée', () => {
    const survey = satisfactionSurvey();
    const names = collectPageQuestions(survey.pages[1]!).map((question) => question.name);
    expect(names).toEqual(['email', 'age', 'canaux', 'segment']);
  });
});

describe('walkElements', () => {
  it('coupe la descente quand la visite renvoie false', () => {
    const survey = satisfactionSurvey();
    const visited: string[] = [];
    walkElements(survey.pages[1]!.elements, (element) => {
      visited.push(element.name);
      return element.type !== 'panel';
    });
    expect(visited).toEqual(['coordonnees', 'canaux', 'segment']);
  });

  it('transmet le panel parent et l’index', () => {
    const survey = satisfactionSurvey();
    const parents: Array<string | null> = [];
    walkElements(survey.pages[1]!.elements, (_element, parent) => {
      parents.push(parent?.name ?? null);
    });
    expect(parents).toEqual([null, 'coordonnees', 'coordonnees', null, null]);
  });
});

describe('findElementById', () => {
  it('localise une question à l’intérieur d’un panel', () => {
    const location = findElementById(satisfactionSurvey(), 'q5');
    expect(location?.element.name).toBe('age');
    expect(location?.parent?.name).toBe('coordonnees');
    expect(location?.pageIndex).toBe(1);
    expect(location?.index).toBe(1);
  });

  it('localise un élément posé directement sur la page', () => {
    const location = findElementById(satisfactionSurvey(), 'q1');
    expect(location?.parent).toBeNull();
    expect(location?.index).toBe(0);
  });

  it('renvoie undefined pour un identifiant absent', () => {
    expect(findElementById(satisfactionSurvey(), 'inexistant')).toBeUndefined();
  });
});

describe('recherches par nom', () => {
  it('trouve une question par son nom', () => {
    expect(findQuestionByName(satisfactionSurvey(), 'email')?.type).toBe('text');
  });

  it('trouve la page contenant une question, panel compris', () => {
    expect(findPageOfQuestion(satisfactionSurvey(), 'age')?.name).toBe('page2');
  });

  it('trouve une page par son nom', () => {
    expect(findPageByName(satisfactionSurvey(), 'page2')?.id).toBe('p2');
  });
});

describe('collectUsedNames', () => {
  it('réunit pages, panels, questions et valeurs calculées', () => {
    const names = collectUsedNames(satisfactionSurvey());
    expect(names.has('page1')).toBe(true);
    expect(names.has('coordonnees')).toBe(true);
    expect(names.has('satisfaction')).toBe(true);
    expect(names.has('estDetracteur')).toBe(true);
  });
});

describe('generateUniqueName', () => {
  it('renvoie le premier indice libre', () => {
    const taken = new Set(['question1', 'question2']);
    expect(generateUniqueName(taken, 'question')).toBe('question3');
  });

  it('part de 1 quand rien n’est pris', () => {
    expect(generateUniqueName(new Set(), 'page')).toBe('page1');
  });

  it('autorise la réutilisation du nom exclu', () => {
    const taken = new Set(['question1']);
    expect(generateUniqueName(taken, 'question', 'question1')).toBe('question1');
  });
});
