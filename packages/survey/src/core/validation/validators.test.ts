import { describe, expect, it } from 'vitest';
import type { EvaluationContext } from '../expressions/evaluate';
import { createQuestion } from '../schema/defaults';
import type { CheckboxQuestion, DateQuestion, NumberQuestion, Question, TextQuestion } from '../schema/types';
import { validateQuestion } from './validators';

const context = (data: Record<string, unknown> = {}): EvaluationContext => ({ data });

const keys = (
  question: Question,
  value: unknown,
  isRequired = false,
  data: Record<string, unknown> = {},
): string[] =>
  validateQuestion(question, value, { isRequired, context: context(data) }).map(
    (error) => error.key,
  );

describe('obligation', () => {
  it('signale une réponse manquante', () => {
    expect(keys(createQuestion('text', 'q'), '', true)).toEqual(['required']);
    expect(keys(createQuestion('text', 'q'), undefined, true)).toEqual(['required']);
  });

  it('ne signale rien si la question est facultative', () => {
    expect(keys(createQuestion('text', 'q'), '', false)).toEqual([]);
  });

  it('accepte `false` comme réponse à une question oui/non obligatoire', () => {
    expect(keys(createQuestion('boolean', 'q'), false, true)).toEqual([]);
  });

  it('accepte 0 comme réponse numérique obligatoire', () => {
    expect(keys(createQuestion('number', 'q'), 0, true)).toEqual([]);
  });

  it('remonte le message personnalisé', () => {
    const question = createQuestion('text', 'q');
    question.requiredErrorText = { fr: 'Merci de répondre' };
    const errors = validateQuestion(question, '', { isRequired: true, context: context() });
    expect(errors[0]!.customText).toEqual({ fr: 'Merci de répondre' });
  });

  it('n’applique aucune règle de format à une question vide et facultative', () => {
    const question = createQuestion('text', 'q') as TextQuestion;
    question.inputType = 'email';
    expect(keys(question, '')).toEqual([]);
  });

  it('n’évalue pas les règles quand la question est vide et obligatoire', () => {
    const question = createQuestion('text', 'q') as TextQuestion;
    question.validators = [{ type: 'email' }];
    // Seule l'obligation est signalée : cumuler « obligatoire » et « e-mail invalide »
    // sur un champ vide noierait le message utile.
    expect(keys(question, '', true)).toEqual(['required']);
  });
});

describe('validateur e-mail', () => {
  const question = (): TextQuestion => {
    const created = createQuestion('text', 'q') as TextQuestion;
    created.validators = [{ type: 'email' }];
    return created;
  };

  it.each(['a@b.fr', 'prenom.nom@banque.co.uk', 'x+tag@d.io'])('accepte « %s »', (value) => {
    expect(keys(question(), value)).toEqual([]);
  });

  it.each(['abc', 'a@b', 'a b@c.fr', '@b.fr', 'a@.fr'])('refuse « %s »', (value) => {
    expect(keys(question(), value)).toEqual(['invalidEmail']);
  });

  it('s’applique aussi via inputType sans validateur explicite', () => {
    const created = createQuestion('text', 'q') as TextQuestion;
    created.inputType = 'email';
    expect(keys(created, 'pas-un-email')).toEqual(['invalidEmail']);
  });
});

describe('validateur regex', () => {
  it('accepte une valeur conforme', () => {
    const question = createQuestion('text', 'q') as TextQuestion;
    question.validators = [{ type: 'regex', regex: '^[0-9]{5}$' }];
    expect(keys(question, '75001')).toEqual([]);
    expect(keys(question, '7500')).toEqual(['invalidFormat']);
  });

  it('ignore une expression régulière invalide plutôt que de bloquer la saisie', () => {
    const question = createQuestion('text', 'q') as TextQuestion;
    question.validators = [{ type: 'regex', regex: '([' }];
    expect(keys(question, 'peu importe')).toEqual([]);
  });
});

describe('validateur numérique', () => {
  const withValidator = (minValue?: number, maxValue?: number): Question => {
    const question = createQuestion('number', 'q') as NumberQuestion;
    question.validators = [
      {
        type: 'numeric',
        ...(minValue === undefined ? {} : { minValue }),
        ...(maxValue === undefined ? {} : { maxValue }),
      },
    ];
    return question;
  };

  it('signale une borne basse', () => {
    expect(keys(withValidator(18), 17)).toContain('numericMin');
  });

  it('signale une borne haute', () => {
    expect(keys(withValidator(undefined, 100), 101)).toContain('numericMax');
  });

  it('produit un seul message quand les deux bornes sont posées', () => {
    expect(keys(withValidator(18, 120), 5)).toEqual(['numericRange']);
    expect(keys(withValidator(18, 120), 50)).toEqual([]);
  });

  it('signale une valeur non numérique', () => {
    expect(keys(withValidator(0, 10), 'abc')).toContain('invalidNumber');
  });
});

describe('contraintes portées par la question', () => {
  it('borne un nombre par min et max', () => {
    const question = createQuestion('number', 'q') as NumberQuestion;
    question.min = 18;
    question.max = 120;
    expect(keys(question, 17)).toEqual(['numericMin']);
    expect(keys(question, 121)).toEqual(['numericMax']);
    expect(keys(question, 40)).toEqual([]);
  });

  it('borne une date', () => {
    const question = createQuestion('date', 'q') as DateQuestion;
    question.min = '2026-01-01';
    question.max = '2026-12-31';
    expect(keys(question, '2025-06-01')).toEqual(['dateMin']);
    expect(keys(question, '2027-06-01')).toEqual(['dateMax']);
    expect(keys(question, '2026-06-01')).toEqual([]);
  });

  it('signale une date illisible', () => {
    expect(keys(createQuestion('date', 'q'), 'pas-une-date')).toEqual(['invalidDate']);
  });

  it('limite la longueur d’un texte', () => {
    const question = createQuestion('comment', 'q');
    if (question.type === 'comment') question.maxLength = 5;
    expect(keys(question, 'abcdef')).toEqual(['textMaxLength']);
    expect(keys(question, 'abcde')).toEqual([]);
  });

  it('borne le nombre de cases cochées', () => {
    const question = createQuestion('checkbox', 'q') as CheckboxQuestion;
    question.minSelectedChoices = 2;
    question.maxSelectedChoices = 3;
    expect(keys(question, ['a'])).toEqual(['minSelected']);
    expect(keys(question, ['a', 'b', 'c', 'd'])).toEqual(['maxSelected']);
    expect(keys(question, ['a', 'b'])).toEqual([]);
  });
});

describe('validateur par expression', () => {
  it('échoue quand l’expression est fausse', () => {
    const question = createQuestion('number', 'q') as NumberQuestion;
    question.validators = [{ type: 'expression', expression: '{montant} <= {plafond}' }];
    expect(keys(question, 500, false, { montant: 500, plafond: 300 })).toEqual([
      'expressionFailed',
    ]);
    expect(keys(question, 200, false, { montant: 200, plafond: 300 })).toEqual([]);
  });

  it('laisse passer quand l’expression est cassée', () => {
    const question = createQuestion('number', 'q') as NumberQuestion;
    question.validators = [{ type: 'expression', expression: '{a} =' }];
    expect(keys(question, 1)).toEqual([]);
  });
});

describe('cumul et types sans réponse', () => {
  it('cumule les erreurs de type et de validateur', () => {
    const question = createQuestion('number', 'q') as NumberQuestion;
    question.min = 10;
    question.validators = [{ type: 'numeric', minValue: 20 }];
    expect(keys(question, 5)).toEqual(['numericMin', 'numericMin']);
  });

  it('ne valide jamais un bloc de contenu', () => {
    expect(keys(createQuestion('html', 'q'), undefined, true)).toEqual([]);
  });

  it('ne valide pas un type inconnu du registre', () => {
    const question = { ...createQuestion('text', 'q'), type: 'inconnu' } as unknown as Question;
    expect(keys(question, '', true)).toEqual([]);
  });
});
