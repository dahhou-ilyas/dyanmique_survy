import { describe, expect, it } from 'vitest';
import { createQuestion, createSurvey } from '../schema/defaults';
import { safeParseSurvey } from '../schema/zod';
import { QUESTION_TYPES, type CheckboxQuestion, type DropdownQuestion } from '../schema/types';
import { OTHER_VALUE, otherCommentKey } from './descriptors/choice';
import {
  PANEL_PROPERTIES,
  QuestionRegistry,
  UnknownQuestionTypeError,
  questionRegistry,
} from './questionRegistry';
import type { DisplayContext } from './types';

const context = (data: Record<string, unknown> = {}): DisplayContext => ({ locale: 'fr', data });

describe('registre', () => {
  it('contient les 11 types intégrés', () => {
    expect(questionRegistry.types().sort()).toEqual([...QUESTION_TYPES].sort());
  });

  it('lève une erreur explicite pour un type inconnu', () => {
    expect(() => questionRegistry.require('signature')).toThrow(UnknownQuestionTypeError);
    expect(() => questionRegistry.require('signature')).toThrow(/questionRegistry.register/);
  });

  it('accepte l’enregistrement d’un type personnalisé', () => {
    const registry = new QuestionRegistry().register({
      type: 'text',
      category: 'text',
      label: 'Perso',
      icon: 'text',
      hasValue: true,
      supportsChoices: false,
      createDefault: (name, id) => ({ id, name, type: 'text', title: 'Perso' }),
      properties: [],
      isEmpty: () => false,
      getDisplayValue: () => 'perso',
    });
    expect(registry.has('text')).toBe(true);
    expect(registry.unregister('text')).toBe(true);
    expect(registry.has('text')).toBe(false);
  });

  it('regroupe les types par catégorie', () => {
    const categories = questionRegistry.byCategory().map((group) => group.category);
    expect(categories).toContain('choice');
    expect(categories).toContain('rating');
  });
});

describe('propertiesFor', () => {
  it('compose identité, spécifique, validation puis logique', () => {
    const groups = questionRegistry.propertiesFor('text').map((property) => property.group);
    // Le tri par groupe doit être stable et monotone.
    const order = ['general', 'options', 'layout', 'validation', 'logic'];
    const indexes = groups.map((group) => order.indexOf(group));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it('n’expose pas de validation pour un bloc de contenu', () => {
    const names = questionRegistry.propertiesFor('html').map((property) => property.name);
    expect(names).not.toContain('isRequired');
    expect(names).not.toContain('validators');
    expect(names).toContain('html');
  });

  it('expose la validation pour une question à réponse', () => {
    const names = questionRegistry.propertiesFor('text').map((property) => property.name);
    expect(names).toContain('isRequired');
    expect(names).toContain('validators');
  });

  it('masque les propriétés de « Autre » tant qu’il est désactivé', () => {
    const question = createQuestion('radiogroup', 'q') as DropdownQuestion;
    const otherText = questionRegistry
      .propertiesFor('radiogroup')
      .find((property) => property.name === 'otherText');

    expect(otherText?.isVisible?.(question)).toBe(false);
    question.hasOther = true;
    expect(otherText?.isVisible?.(question)).toBe(true);
  });

  it('les panels exposent la logique sans `requiredIf`', () => {
    const names = PANEL_PROPERTIES.map((property) => property.name);
    expect(names).toContain('visibleIf');
    expect(names).not.toContain('requiredIf');
  });
});

describe('createDefault', () => {
  it.each([...QUESTION_TYPES])('produit une question « %s » conforme au schéma', (type) => {
    const survey = createSurvey();
    survey.pages[0]!.elements = [createQuestion(type, 'question1')];
    const result = safeParseSurvey(survey);
    expect(result.success, JSON.stringify(result)).toBe(true);
  });

  it('donne des options par défaut aux questions à choix', () => {
    const question = createQuestion('radiogroup', 'q') as DropdownQuestion;
    expect(question.choices).toHaveLength(3);
  });
});

describe('isEmpty', () => {
  it.each([
    ['text', '', true],
    ['text', '   ', true],
    ['text', 'valeur', false],
    ['checkbox', [], true],
    ['checkbox', ['a'], false],
    ['number', undefined, true],
    ['number', 0, false],
  ])('%s(%o) → %s', (type, value, expected) => {
    expect(questionRegistry.require(type).isEmpty(value)).toBe(expected);
  });

  it('traite `false` comme une réponse valide pour oui/non', () => {
    expect(questionRegistry.require('boolean').isEmpty(false)).toBe(false);
    expect(questionRegistry.require('boolean').isEmpty(undefined)).toBe(true);
  });
});

describe('normalizeValue', () => {
  it('convertit la saisie numérique en nombre', () => {
    const descriptor = questionRegistry.require('number');
    const question = createQuestion('number', 'q');
    expect(descriptor.normalizeValue?.('42', question)).toBe(42);
    expect(descriptor.normalizeValue?.('', question)).toBeUndefined();
    expect(descriptor.normalizeValue?.('abc', question)).toBeUndefined();
  });

  it('force un tableau pour les choix multiples', () => {
    const descriptor = questionRegistry.require('checkbox');
    const question = createQuestion('checkbox', 'q');
    expect(descriptor.normalizeValue?.('a', question)).toEqual(['a']);
    expect(descriptor.normalizeValue?.([], question)).toBeUndefined();
  });

  it('convertit les représentations textuelles de booléen', () => {
    const descriptor = questionRegistry.require('boolean');
    const question = createQuestion('boolean', 'q');
    expect(descriptor.normalizeValue?.('true', question)).toBe(true);
    expect(descriptor.normalizeValue?.('false', question)).toBe(false);
    expect(descriptor.normalizeValue?.('', question)).toBeUndefined();
  });
});

describe('getDisplayValue', () => {
  it('remplace le code d’option par son libellé', () => {
    const question = createQuestion('dropdown', 'q') as DropdownQuestion;
    const rendered = questionRegistry.require('dropdown').getDisplayValue(
      'item2',
      question,
      context(),
    );
    expect(rendered).toBe('Option 2');
  });

  it('joint les libellés des choix multiples', () => {
    const question = createQuestion('checkbox', 'q') as CheckboxQuestion;
    const rendered = questionRegistry
      .require('checkbox')
      .getDisplayValue(['item1', 'item3'], question, context());
    expect(rendered).toBe('Option 1, Option 3');
  });

  it('affiche le texte libre saisi dans « Autre »', () => {
    const question = createQuestion('radiogroup', 'canal') as DropdownQuestion;
    question.hasOther = true;
    question.otherText = { fr: 'Autre canal' };
    const rendered = questionRegistry
      .require('radiogroup')
      .getDisplayValue(
        OTHER_VALUE,
        question,
        context({ [otherCommentKey('canal')]: 'Courrier postal' }),
      );
    expect(rendered).toBe('Autre canal : Courrier postal');
  });

  it('retombe sur la valeur brute quand l’option a disparu du sondage', () => {
    const question = createQuestion('dropdown', 'q') as DropdownQuestion;
    expect(
      questionRegistry.require('dropdown').getDisplayValue('supprimee', question, context()),
    ).toBe('supprimee');
  });

  it('segmente le score NPS', () => {
    const question = createQuestion('nps', 'q');
    const display = (value: number) =>
      questionRegistry.require('nps').getDisplayValue(value, question, context());
    expect(display(10)).toBe('10/10 (Promoteur)');
    expect(display(8)).toBe('8/10 (Passif)');
    expect(display(3)).toBe('3/10 (Détracteur)');
  });

  it('affiche la note sur son maximum avec la légende', () => {
    const question = createQuestion('rating', 'q');
    expect(questionRegistry.require('rating').getDisplayValue(3, question, context())).toBe('3/5');
  });

  it('ajoute l’unité à un nombre', () => {
    const question = createQuestion('number', 'q');
    if (question.type === 'number') question.unit = { fr: '€' };
    expect(questionRegistry.require('number').getDisplayValue(150, question, context())).toBe(
      '150 €',
    );
  });

  it('formate la date selon la locale', () => {
    const question = createQuestion('date', 'q');
    expect(questionRegistry.require('date').getDisplayValue('2026-03-14', question, context())).toBe(
      '14/03/2026',
    );
  });

  it('renvoie une chaîne vide pour un bloc de contenu', () => {
    const question = createQuestion('html', 'q');
    expect(questionRegistry.require('html').getDisplayValue(undefined, question, context())).toBe(
      '',
    );
  });
});
