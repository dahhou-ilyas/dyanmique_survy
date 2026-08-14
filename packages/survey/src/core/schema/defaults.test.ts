import { describe, expect, it } from 'vitest';
import { hasValue, isChoiceQuestion, isPanel, isQuestion } from './types';
import { createId, createPage, createPanel, createQuestion, createSurvey } from './defaults';
import { safeParseSurvey } from './zod';

describe('createSurvey', () => {
  it('produit un sondage conforme au schéma', () => {
    expect(safeParseSurvey(createSurvey()).success).toBe(true);
  });

  it('démarre avec une page vide', () => {
    const survey = createSurvey();
    expect(survey.pages).toHaveLength(1);
    expect(survey.pages[0]!.elements).toEqual([]);
  });

  it('fusionne les réglages partiels avec les valeurs par défaut', () => {
    const survey = createSurvey({ settings: { locale: 'en' } as never });
    expect(survey.settings.locale).toBe('en');
    expect(survey.settings.showProgressBar).toBe('top');
  });

  it('accepte un titre et un identifiant imposés', () => {
    const survey = createSurvey({ id: 'srv_fixe', title: 'Mon sondage' });
    expect(survey.id).toBe('srv_fixe');
    expect(survey.title).toBe('Mon sondage');
  });
});

describe('fabriques', () => {
  it('createId produit des identifiants distincts', () => {
    expect(createId()).not.toBe(createId());
  });

  it('createPage accepte un titre optionnel', () => {
    expect(createPage('page2').title).toBeUndefined();
    expect(createPage('page2', 'Titre').title).toBe('Titre');
  });

  it('createPanel produit un groupe déplié et vide', () => {
    const panel = createPanel('groupe1');
    expect(panel.type).toBe('panel');
    expect(panel.state).toBe('expanded');
    expect(panel.elements).toEqual([]);
  });

  it('createQuestion délègue au registre', () => {
    expect(createQuestion('rating', 'note')).toMatchObject({ type: 'rating', rateMax: 5 });
  });
});

describe('gardes de type', () => {
  it('distingue panels et questions', () => {
    const panel = createPanel('g');
    const question = createQuestion('text', 'q');
    expect(isPanel(panel)).toBe(true);
    expect(isPanel(question)).toBe(false);
    expect(isQuestion(question)).toBe(true);
    expect(isQuestion(panel)).toBe(false);
  });

  it('reconnaît les questions à options', () => {
    expect(isChoiceQuestion(createQuestion('radiogroup', 'q'))).toBe(true);
    expect(isChoiceQuestion(createQuestion('checkbox', 'q'))).toBe(true);
    expect(isChoiceQuestion(createQuestion('dropdown', 'q'))).toBe(true);
    expect(isChoiceQuestion(createQuestion('text', 'q'))).toBe(false);
  });

  it('exclut les blocs de contenu des questions porteuses de valeur', () => {
    expect(hasValue(createQuestion('text', 'q'))).toBe(true);
    expect(hasValue(createQuestion('html', 'q'))).toBe(false);
  });
});
