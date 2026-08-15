import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firstQuestion, minimalSurvey, satisfactionSurvey } from '../../../tests/fixtures';
import { createQuestion, createSurvey } from '../schema/defaults';
import type { SurveyDefinition } from '../schema/types';
import { SurveyEngine } from './SurveyEngine';

const FIXED_NOW = new Date('2026-06-15T12:00:00Z');

function makeEngine(
  definition: SurveyDefinition = satisfactionSurvey(),
  data?: Record<string, unknown>,
): SurveyEngine {
  return new SurveyEngine({ definition, ...(data ? { data } : {}), now: () => FIXED_NOW });
}

describe('initialisation', () => {
  it('démarre sur la première page', () => {
    const engine = makeEngine();
    expect(engine.getState().currentPage?.name).toBe('page1');
    expect(engine.getState().isFirstPage).toBe(true);
    expect(engine.getState().isLastPage).toBe(false);
  });

  it('reprend des réponses existantes', () => {
    const engine = makeEngine(satisfactionSurvey(), { satisfaction: 4 });
    expect(engine.getValue('satisfaction')).toBe(4);
  });

  it('applique les valeurs par défaut sans écraser les réponses fournies', () => {
    const survey = minimalSurvey();
    firstQuestion(survey).defaultValue = 'Anonyme';
    expect(makeEngine(survey).getValue('nom')).toBe('Anonyme');
    expect(makeEngine(survey, { nom: 'Dupont' }).getValue('nom')).toBe('Dupont');
  });

  it('évalue la visibilité conditionnelle dès le départ', () => {
    expect(makeEngine().getQuestionSnapshot('commentaire')?.visible).toBe(false);
    expect(
      makeEngine(satisfactionSurvey(), { satisfaction: 2 }).getQuestionSnapshot('commentaire')
        ?.visible,
    ).toBe(true);
  });
});

describe('setValue', () => {
  it('enregistre et normalise la valeur', () => {
    const engine = makeEngine();
    engine.setValue('satisfaction', '4');
    // Le champ HTML renvoie une chaîne ; le moteur stocke un nombre.
    expect(engine.getValue('satisfaction')).toBe(4);
  });

  it('supprime la clé quand la valeur redevient vide', () => {
    const engine = makeEngine(satisfactionSurvey(), { satisfaction: 3 });
    engine.setValue('satisfaction', '');
    expect('satisfaction' in engine.getData()).toBe(false);
  });

  it('force un tableau pour les choix multiples', () => {
    const engine = makeEngine();
    engine.setValue('canaux', 'app');
    expect(engine.getValue('canaux')).toEqual(['app']);
  });

  it('n’émet rien si la valeur est inchangée', () => {
    const engine = makeEngine(satisfactionSurvey(), { satisfaction: 3 });
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.setValue('satisfaction', 3);
    expect(listener).not.toHaveBeenCalled();
  });

  it('émet valueChanged avec l’ancienne valeur', () => {
    const engine = makeEngine(satisfactionSurvey(), { satisfaction: 3 });
    const listener = vi.fn();
    engine.on('valueChanged', listener);
    engine.setValue('satisfaction', 5);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'satisfaction', value: 5, previousValue: 3 }),
    );
  });

  it('applique plusieurs réponses en un seul rendu', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.setValues({ satisfaction: 2, recommandation: 3 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(engine.getValue('satisfaction')).toBe(2);
  });
});

describe('visibilité conditionnelle', () => {
  it('révèle et masque une question selon la condition', () => {
    const engine = makeEngine();
    engine.setValue('satisfaction', 2);
    expect(engine.getQuestionSnapshot('commentaire')?.visible).toBe(true);
    engine.setValue('satisfaction', 5);
    expect(engine.getQuestionSnapshot('commentaire')?.visible).toBe(false);
  });

  it('conserve la réponse d’une question masquée pour la restaurer au retour', () => {
    const engine = makeEngine();
    engine.setValue('satisfaction', 2);
    engine.setValue('commentaire', 'Trop lent');
    engine.setValue('satisfaction', 5);
    expect(engine.getValue('commentaire')).toBe('Trop lent');
    engine.setValue('satisfaction', 1);
    expect(engine.getQuestionSnapshot('commentaire')?.value).toBe('Trop lent');
  });

  it('masque les questions d’un groupe masqué (cascade)', () => {
    const survey = satisfactionSurvey();
    const panel = survey.pages[1]!.elements[0]!;
    panel.visibleIf = "{segment} = 'pro'";
    const engine = makeEngine(survey);
    expect(engine.getQuestionSnapshot('email')?.visible).toBe(false);
    engine.setValue('segment', 'pro');
    expect(engine.getQuestionSnapshot('email')?.visible).toBe(true);
  });

  it('masque une page entière', () => {
    const survey = satisfactionSurvey();
    survey.pages[1]!.visibleIf = '{recommandation} < 7';
    const engine = makeEngine(survey);
    expect(engine.getState().visiblePages).toHaveLength(1);
    engine.setValue('recommandation', 3);
    expect(engine.getState().visiblePages).toHaveLength(2);
  });

  it('filtre les options via choicesVisibleIf', () => {
    const survey = createSurvey();
    const question = createQuestion('checkbox', 'canaux');
    if (question.type === 'checkbox') {
      question.choices = [
        { value: 'app' },
        { value: 'web' },
        { value: 'agence', visibleIf: "{segment} = 'part'" },
      ];
    }
    survey.pages[0]!.elements = [createQuestion('text', 'segment'), question];
    const engine = makeEngine(survey);
    expect(engine.getQuestionSnapshot('canaux')?.visibleChoices).toHaveLength(2);
    engine.setValue('segment', 'part');
    expect(engine.getQuestionSnapshot('canaux')?.visibleChoices).toHaveLength(3);
  });
});

describe('identité des instantanés', () => {
  it('conserve l’objet quand rien ne change pour cette question', () => {
    const engine = makeEngine();
    const before = engine.getQuestionSnapshot('recommandation');
    engine.setValue('satisfaction', 4);
    // Une saisie sur `satisfaction` ne doit pas provoquer le rendu de `recommandation`.
    expect(engine.getQuestionSnapshot('recommandation')).toBe(before);
  });

  it('remplace l’objet quand la valeur de la question change', () => {
    const engine = makeEngine();
    const before = engine.getQuestionSnapshot('satisfaction');
    engine.setValue('satisfaction', 4);
    expect(engine.getQuestionSnapshot('satisfaction')).not.toBe(before);
  });

  it('remplace l’objet quand la visibilité change', () => {
    const engine = makeEngine();
    const before = engine.getQuestionSnapshot('commentaire');
    engine.setValue('satisfaction', 1);
    expect(engine.getQuestionSnapshot('commentaire')).not.toBe(before);
  });
});

describe('validation et navigation', () => {
  it('bloque la navigation tant qu’une question obligatoire est vide', () => {
    const engine = makeEngine();
    expect(engine.nextPage()).toBe(false);
    expect(engine.getState().currentPage?.name).toBe('page1');
    expect(engine.getQuestionSnapshot('satisfaction')?.errors[0]?.key).toBe('required');
  });

  it('n’affiche les erreurs qu’après tentative de navigation en mode onNextPage', () => {
    const engine = makeEngine();
    expect(engine.getQuestionSnapshot('satisfaction')?.showErrors).toBe(false);
    engine.nextPage();
    expect(engine.getQuestionSnapshot('satisfaction')?.showErrors).toBe(true);
  });

  it('affiche les erreurs au fil de la saisie en mode onValueChanged', () => {
    const survey = satisfactionSurvey();
    survey.settings.checkErrorsMode = 'onValueChanged';
    const engine = makeEngine(survey);
    engine.setValue('satisfaction', 3);
    expect(engine.getQuestionSnapshot('commentaire')?.showErrors).toBe(false);
    // L'utilisateur saisit puis efface : la question est « touchée », l'erreur s'affiche.
    engine.setValue('commentaire', 'x');
    engine.setValue('commentaire', '');
    expect(engine.getQuestionSnapshot('commentaire')?.showErrors).toBe(true);
    expect(engine.getQuestionSnapshot('commentaire')?.errors[0]?.key).toBe('required');
  });

  it('avance quand la page est valide', () => {
    const engine = makeEngine(satisfactionSurvey(), { satisfaction: 5 });
    expect(engine.nextPage()).toBe(true);
    expect(engine.getState().currentPage?.name).toBe('page2');
    expect(engine.getState().isLastPage).toBe(true);
  });

  it('n’exige pas de réponse à une question obligatoire masquée', () => {
    // `commentaire` est obligatoire mais masqué tant que la satisfaction est haute.
    const engine = makeEngine(satisfactionSurvey(), { satisfaction: 5 });
    expect(engine.nextPage()).toBe(true);
  });

  it('exige la réponse dès que la question devient visible', () => {
    const engine = makeEngine(satisfactionSurvey(), { satisfaction: 2 });
    expect(engine.nextPage()).toBe(false);
    expect(engine.getQuestionSnapshot('commentaire')?.errors[0]?.key).toBe('required');
  });

  it('revient en arrière sans valider', () => {
    const engine = makeEngine(satisfactionSurvey(), { satisfaction: 5 });
    engine.nextPage();
    expect(engine.prevPage()).toBe(true);
    expect(engine.getState().currentPage?.name).toBe('page1');
    expect(engine.prevPage()).toBe(false);
  });

  it('désigne la première question en erreur pour le focus', () => {
    const engine = makeEngine();
    engine.nextPage();
    expect(engine.getFirstErrorQuestionName()).toBe('satisfaction');
  });

  it('émet validationFailed', () => {
    const engine = makeEngine();
    const listener = vi.fn();
    engine.on('validationFailed', listener);
    engine.nextPage();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('émet pageChanged avec la page d’origine et la destination', () => {
    const engine = makeEngine(satisfactionSurvey(), { satisfaction: 5 });
    const listener = vi.fn();
    engine.on('pageChanged', listener);
    engine.nextPage();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.objectContaining({ name: 'page1' }),
        to: expect.objectContaining({ name: 'page2' }),
      }),
    );
  });
});

describe('complétion', () => {
  it('refuse de clôturer si une page est invalide et y ramène l’utilisateur', () => {
    const engine = makeEngine(satisfactionSurvey(), { satisfaction: 5 });
    engine.nextPage();
    engine.setValue('email', 'pas-un-email');
    expect(engine.complete()).toBe(false);
    expect(engine.getState().currentPage?.name).toBe('page2');
  });

  it('clôture et émet le résultat', () => {
    const engine = makeEngine(satisfactionSurvey(), { satisfaction: 5, recommandation: 9 });
    const listener = vi.fn();
    engine.on('completed', listener);
    expect(engine.complete()).toBe(true);
    expect(engine.getState().completed).toBe(true);
    expect(engine.getState().progress).toBe(1);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('remet tout à zéro avec clear()', () => {
    const engine = makeEngine(satisfactionSurvey(), { satisfaction: 5 });
    engine.nextPage();
    engine.clear();
    expect(engine.getData()).toEqual({});
    expect(engine.getState().currentPageIndex).toBe(0);
    expect(engine.getState().completed).toBe(false);
  });
});

describe('valeurs calculées', () => {
  it('recalcule à chaque changement de dépendance', () => {
    const engine = makeEngine();
    engine.setValue('recommandation', 4);
    expect(engine.getState().calculated.estDetracteur).toBe(true);
    engine.setValue('recommandation', 9);
    expect(engine.getState().calculated.estDetracteur).toBe(false);
  });

  it('sont utilisables dans les conditions', () => {
    const survey = satisfactionSurvey();
    survey.pages[1]!.elements[2]!.visibleIf = '{estDetracteur} = true';
    const engine = makeEngine(survey);
    expect(engine.getQuestionSnapshot('segment')?.visible).toBe(false);
    engine.setValue('recommandation', 2);
    expect(engine.getQuestionSnapshot('segment')?.visible).toBe(true);
  });

  it('s’enchaînent dans le bon ordre', () => {
    const survey = minimalSurvey();
    survey.calculatedValues = [
      { name: 'derive', expression: '{base} * 2' },
      { name: 'base', expression: 'len({nom})' },
    ];
    const engine = makeEngine(survey);
    engine.setValue('nom', 'abcd');
    expect(engine.getState().calculated.base).toBe(4);
    expect(engine.getState().calculated.derive).toBe(8);
  });
});

describe('déclencheurs', () => {
  it('setvalue s’exécute à la transition vers vrai', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push(createQuestion('text', 'cible'));
    survey.triggers = [
      { type: 'setvalue', expression: "{nom} = 'admin'", setToName: 'cible', setValue: 'oui' },
    ];
    const engine = makeEngine(survey);
    engine.setValue('nom', 'dupont');
    expect(engine.getValue('cible')).toBeUndefined();
    engine.setValue('nom', 'admin');
    expect(engine.getValue('cible')).toBe('oui');
  });

  it('ne réécrase pas une correction de l’utilisateur tant que la condition reste vraie', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push(createQuestion('text', 'cible'));
    survey.triggers = [
      { type: 'setvalue', expression: '{nom} notempty', setToName: 'cible', setValue: 'auto' },
    ];
    const engine = makeEngine(survey);
    engine.setValue('nom', 'a');
    expect(engine.getValue('cible')).toBe('auto');
    engine.setValue('cible', 'saisie manuelle');
    engine.setValue('nom', 'ab');
    expect(engine.getValue('cible')).toBe('saisie manuelle');
  });

  it('copyvalue recopie une réponse', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push(createQuestion('text', 'copie'));
    survey.pages[0]!.elements.push(createQuestion('boolean', 'idem'));
    survey.triggers = [
      { type: 'copyvalue', expression: '{idem} = true', fromName: 'nom', setToName: 'copie' },
    ];
    const engine = makeEngine(survey, { nom: 'Dupont' });
    engine.setValue('idem', true);
    expect(engine.getValue('copie')).toBe('Dupont');
  });

  it('complete clôture le sondage', () => {
    const survey = minimalSurvey();
    firstQuestion(survey).isRequired = false;
    survey.triggers = [{ type: 'complete', expression: "{nom} = 'stop'" }];
    const engine = makeEngine(survey);
    engine.setValue('nom', 'stop');
    expect(engine.getState().completed).toBe(true);
  });

  it('skip saute à la page nommée', () => {
    const survey = satisfactionSurvey();
    firstQuestion(survey).isRequired = false;
    survey.triggers = [{ type: 'skip', expression: '{satisfaction} = 5', gotoName: 'page2' }];
    const engine = makeEngine(survey);
    engine.setValue('satisfaction', 5);
    expect(engine.getState().currentPage?.name).toBe('page2');
  });

  it('n’entre pas en boucle sur des déclencheurs qui s’alimentent', () => {
    const survey = minimalSurvey();
    firstQuestion(survey).isRequired = false;
    survey.pages[0]!.elements.push(createQuestion('number', 'a'));
    survey.pages[0]!.elements.push(createQuestion('number', 'b'));
    survey.triggers = [
      { type: 'setvalue', expression: '{a} > 0', setToName: 'b', setValue: 1 },
      { type: 'setvalue', expression: '{b} > 0', setToName: 'a', setValue: 1 },
    ];
    const engine = makeEngine(survey);
    expect(() => engine.setValue('a', 5)).not.toThrow();
    expect(engine.getValue('b')).toBe(1);
  });
});

describe('mode lecture seule', () => {
  it('désactive toutes les questions', () => {
    const engine = new SurveyEngine({
      definition: satisfactionSurvey(),
      mode: 'display',
      now: () => FIXED_NOW,
    });
    expect(engine.getQuestionSnapshot('satisfaction')?.enabled).toBe(false);
  });

  it('se bascule à chaud', () => {
    const engine = makeEngine();
    expect(engine.getQuestionSnapshot('satisfaction')?.enabled).toBe(true);
    engine.setMode('display');
    expect(engine.getQuestionSnapshot('satisfaction')?.enabled).toBe(false);
  });

  it('respecte readOnly au niveau de la question', () => {
    const survey = minimalSurvey();
    firstQuestion(survey).readOnly = true;
    expect(makeEngine(survey).getQuestionSnapshot('nom')?.enabled).toBe(false);
  });
});

describe('getResult', () => {
  let engine: SurveyEngine;

  beforeEach(() => {
    engine = makeEngine(satisfactionSurvey(), {
      satisfaction: 2,
      commentaire: 'Trop lent',
      recommandation: 3,
      email: 'a@b.fr',
      age: 40,
      canaux: ['app', 'web'],
      segment: 'pro',
    });
  });

  it('produit des réponses à plat exploitables pour le reporting', () => {
    const result = engine.getResult();
    const answer = result.answers.find((entry) => entry.questionName === 'canaux');
    expect(answer).toMatchObject({
      questionId: 'q6',
      type: 'checkbox',
      title: 'Canaux utilisés',
      value: ['app', 'web'],
      displayValue: 'Application mobile, Site web',
    });
  });

  it('exclut les questions masquées du résultat', () => {
    engine.setValue('satisfaction', 5);
    const result = engine.getResult();
    expect(result.answers.some((answer) => answer.questionName === 'commentaire')).toBe(false);
    // La réponse reste néanmoins accessible pour un retour en arrière.
    expect(engine.getValue('commentaire')).toBe('Trop lent');
  });

  it('exclut les questions sans réponse', () => {
    const bare = makeEngine(satisfactionSurvey(), { satisfaction: 5 });
    expect(bare.getResult().answers.map((answer) => answer.questionName)).toEqual(['satisfaction']);
  });

  it('n’inclut jamais les blocs de contenu', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push(createQuestion('html', 'intro'));
    const result = makeEngine(survey, { nom: 'x' }).getResult();
    expect(result.answers.some((answer) => answer.type === 'html')).toBe(false);
  });

  it('joint les valeurs calculées marquées includeIntoResult', () => {
    expect(engine.getResult().data.estDetracteur).toBe(true);
  });

  it('renseigne les métadonnées de passation', () => {
    const result = engine.getResult();
    expect(result.surveyId).toBe('srv_satisfaction');
    expect(result.locale).toBe('fr');
    expect(result.startedAt).toBe(FIXED_NOW.toISOString());
    expect(result.durationMs).toBe(0);
  });

  it('mesure la durée réelle de passation', () => {
    let clock = new Date('2026-06-15T12:00:00Z');
    const timed = new SurveyEngine({
      definition: minimalSurvey(),
      data: { nom: 'x' },
      now: () => clock,
    });
    clock = new Date('2026-06-15T12:02:30Z');
    timed.complete();
    expect(timed.getResult().durationMs).toBe(150_000);
  });
});
