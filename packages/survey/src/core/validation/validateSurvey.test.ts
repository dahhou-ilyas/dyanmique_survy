import { describe, expect, it } from 'vitest';
import { firstQuestion, minimalSurvey, satisfactionSurvey } from '../../../tests/fixtures';
import type { DropdownQuestion, SurveyDefinition } from '../schema/types';
import { validateSurveyDefinition } from './validateSurvey';

const codes = (survey: SurveyDefinition): string[] =>
  validateSurveyDefinition(survey).diagnostics.map((diagnostic) => diagnostic.code);

describe('sondage valide', () => {
  it('ne produit aucune erreur sur le sondage de référence', () => {
    const result = validateSurveyDefinition(satisfactionSurvey());
    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });
});

describe('espace de noms', () => {
  it('signale un nom de question dupliqué', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push({
      id: 'q2',
      name: 'nom',
      type: 'text',
      title: 'Doublon',
    });
    expect(codes(survey)).toContain('duplicate-name');
  });

  it('signale une collision entre une page et une question', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.name = 'page1';
    expect(codes(survey)).toContain('duplicate-name');
  });

  it('signale une collision avec une valeur calculée', () => {
    const survey = minimalSurvey();
    survey.calculatedValues = [{ name: 'nom', expression: '1' }];
    expect(codes(survey)).toContain('duplicate-name');
  });
});

describe('expressions', () => {
  it('signale une syntaxe invalide et pointe l’élément', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.visibleIf = '{a} =';
    const result = validateSurveyDefinition(survey);
    const diagnostic = result.diagnostics.find((d) => d.code === 'expression-syntax');
    expect(diagnostic?.elementId).toBe('q1');
    expect(result.valid).toBe(false);
  });

  it('signale une référence vers une question inexistante', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.visibleIf = '{jexistepas} = 1';
    expect(codes(survey)).toContain('unknown-reference');
  });

  it('accepte {item} dans un filtre d’options', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push({
      id: 'q2',
      name: 'liste',
      type: 'dropdown',
      title: 'Liste',
      choices: [{ value: 'a' }],
      choicesVisibleIf: "{item} != 'b'",
    });
    expect(codes(survey)).not.toContain('unknown-reference');
  });

  it('signale une fonction inconnue', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.visibleIf = 'fonctionQuiNexistePas() = 1';
    expect(codes(survey)).toContain('unknown-function');
  });

  it('avertit d’une référence vers une question posée plus tard', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.visibleIf = '{plusTard} = 1';
    survey.pages[0]!.elements.push({
      id: 'q2',
      name: 'plusTard',
      type: 'number',
      title: 'Plus tard',
    });
    const diagnostics = validateSurveyDefinition(survey).diagnostics;
    const forward = diagnostics.find((d) => d.code === 'forward-reference');
    expect(forward?.severity).toBe('warning');
    // C'est un avertissement : le sondage reste publiable.
    expect(validateSurveyDefinition(survey).valid).toBe(true);
  });

  it('valide les expressions des validateurs', () => {
    const survey = minimalSurvey();
    firstQuestion(survey).validators = [{ type: 'expression', expression: '{a} =' }];
    expect(codes(survey)).toContain('expression-syntax');
  });

  it('signale une expression régulière invalide', () => {
    const survey = minimalSurvey();
    firstQuestion(survey).validators = [{ type: 'regex', regex: '([' }];
    expect(codes(survey)).toContain('invalid-regex');
  });
});

describe('options de réponse', () => {
  it('signale une question à choix sans option', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push({
      id: 'q2',
      name: 'liste',
      type: 'dropdown',
      title: 'Liste',
      choices: [],
    } satisfies DropdownQuestion);
    expect(codes(survey)).toContain('no-choices');
  });

  it('signale des valeurs d’options dupliquées', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push({
      id: 'q2',
      name: 'liste',
      type: 'dropdown',
      title: 'Liste',
      choices: [{ value: 'a' }, { value: 'a' }],
    } satisfies DropdownQuestion);
    expect(codes(survey)).toContain('duplicate-choice');
  });
});

describe('déclencheurs', () => {
  it('signale une cible inexistante', () => {
    const survey = minimalSurvey();
    survey.triggers = [
      { type: 'setvalue', expression: '{nom} notempty', setToName: 'inexistant', setValue: 1 },
    ];
    expect(codes(survey)).toContain('unknown-reference');
  });

  it('accepte une cible existante', () => {
    const survey = minimalSurvey();
    survey.triggers = [{ type: 'skip', expression: '{nom} notempty', gotoName: 'page1' }];
    expect(validateSurveyDefinition(survey).valid).toBe(true);
  });
});

describe('avertissements de conception', () => {
  it('avertit d’une page vide', () => {
    const survey = minimalSurvey();
    survey.pages.push({ id: 'p2', name: 'page2', elements: [] });
    expect(codes(survey)).toContain('empty-page');
  });

  it('avertit d’un groupe vide', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push({ id: 'pnl', name: 'groupe', type: 'panel', elements: [] });
    expect(codes(survey)).toContain('empty-panel');
  });

  it('avertit d’un libellé manquant', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.title = '';
    expect(codes(survey)).toContain('missing-title');
  });

  it('signale un sondage sans page', () => {
    const survey = minimalSurvey();
    survey.pages = [];
    expect(codes(survey)).toContain('no-pages');
  });
});

describe('structure non conforme', () => {
  it('remonte les erreurs de schéma et s’arrête là', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.name = 'nom invalide';
    const result = validateSurveyDefinition(survey);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.every((d) => d.code === 'schema')).toBe(true);
  });
});
