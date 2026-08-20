import { describe, expect, it, vi } from 'vitest';
import { minimalSurvey, satisfactionSurvey } from '../../tests/fixtures';
import { createQuestion, createSurvey } from '../core/schema/defaults';
import { createHeadlessSurvey } from './createHeadlessSurvey';

const FIXED_NOW = new Date('2026-06-15T12:00:00Z');
const make = (definition = satisfactionSurvey(), options = {}) =>
  createHeadlessSurvey(definition, { now: () => FIXED_NOW, ...options });

describe('création', () => {
  it('expose le moteur sous-jacent', () => {
    expect(make().engine.getState().currentPage?.name).toBe('page1');
  });

  it('reprend des réponses existantes', () => {
    expect(
      make(satisfactionSurvey(), { data: { satisfaction: 4 } }).getQuestion('satisfaction')?.value,
    ).toBe(4);
  });

  it('migre une définition antérieure', () => {
    const survey = minimalSurvey();
    survey.schemaVersion = 1;
    expect(() => make(survey)).not.toThrow();
  });
});

describe('arbre à rendre', () => {
  it('ne renvoie que les éléments visibles, dans l’ordre', () => {
    const survey = make();
    const noms = survey
      .currentPageElements()
      .map((n) => (n.kind === 'question' ? n.snapshot.question.name : n.snapshot.panel.name));
    // `commentaire` est masqué tant que la satisfaction est haute.
    expect(noms).toEqual(['satisfaction', 'recommandation']);
  });

  it('révèle un élément dès que sa condition devient vraie', () => {
    const survey = make();
    survey.setValue('satisfaction', 2);
    const noms = survey
      .currentPageElements()
      .map((n) => (n.kind === 'question' ? n.snapshot.question.name : ''));
    expect(noms).toEqual(['satisfaction', 'commentaire', 'recommandation']);
  });

  it('imbrique les groupes et leurs enfants', () => {
    const survey = make(satisfactionSurvey(), { data: { satisfaction: 5 } });
    survey.next();

    const [premier] = survey.currentPageElements();
    expect(premier?.kind).toBe('panel');
    if (premier?.kind === 'panel') {
      expect(premier.snapshot.panel.name).toBe('coordonnees');
      expect(
        premier.children.map((c) => (c.kind === 'question' ? c.snapshot.question.name : '')),
      ).toEqual(['email', 'age']);
    }
  });

  it('masque un groupe entier quand sa condition est fausse', () => {
    const survey = satisfactionSurvey();
    survey.pages[1]!.elements[0]!.visibleIf = "{segment} = 'pro'";
    const headless = make(survey, { data: { satisfaction: 5 } });
    headless.next();
    expect(headless.currentPageElements().some((n) => n.kind === 'panel')).toBe(false);
  });
});

describe('abonnement ciblé par question', () => {
  it('notifie quand la question change', () => {
    const survey = make();
    const listener = vi.fn();
    survey.onQuestionChange('satisfaction', listener);

    survey.setValue('satisfaction', 4);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]![0].value).toBe(4);
  });

  it('ne notifie PAS quand une autre question change', () => {
    const survey = make();
    const listener = vi.fn();
    survey.onQuestionChange('recommandation', listener);

    // C'est la promesse de cette couche : un rendu chirurgical, pas global.
    survey.setValue('satisfaction', 4);

    expect(listener).not.toHaveBeenCalled();
  });

  it('notifie quand la visibilité change, pas seulement la valeur', () => {
    const survey = make();
    const listener = vi.fn();
    survey.onQuestionChange('commentaire', listener);

    survey.setValue('satisfaction', 1);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]![0].visible).toBe(true);
  });

  it('notifie quand les erreurs deviennent affichables', () => {
    const survey = make();
    const listener = vi.fn();
    survey.onQuestionChange('satisfaction', listener);

    survey.next(); // échoue : question obligatoire vide

    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls.at(-1)![0].showErrors).toBe(true);
  });
});

describe('navigation', () => {
  it('refuse d’avancer si la page est invalide', () => {
    const survey = make();
    expect(survey.next()).toBe(false);
    expect(survey.getState().currentPage?.name).toBe('page1');
    expect(survey.firstErrorQuestion()).toBe('satisfaction');
  });

  it('avance quand la page est valide', () => {
    const survey = make(satisfactionSurvey(), { data: { satisfaction: 5 } });
    expect(survey.next()).toBe(true);
    expect(survey.getState().currentPage?.name).toBe('page2');
    expect(survey.previous()).toBe(true);
  });

  it('émet pageChange et complete', () => {
    const survey = make(minimalSurvey());
    const onPage = vi.fn();
    const onComplete = vi.fn();
    survey.onPageChange(onPage);
    survey.onComplete(onComplete);

    survey.setValue('nom', 'Dupont');
    survey.complete();

    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete.mock.calls[0]![0].answers[0].displayValue).toBe('Dupont');
  });
});

describe('textes', () => {
  it('traduit les libellés d’interface', () => {
    expect(make().t('next')).toBe('Suivant');
    expect(make(satisfactionSurvey(), { locale: 'en' }).t('next')).toBe('Next');
  });

  it('résout un texte multilingue du sondage', () => {
    expect(make().text({ fr: 'Bonjour', en: 'Hello' })).toBe('Bonjour');
  });

  it('accepte une surcharge de libellés', () => {
    expect(make(satisfactionSurvey(), { messages: { next: 'Continuer' } }).t('next')).toBe(
      'Continuer',
    );
  });
});

describe('destroy', () => {
  it('coupe tous les abonnements', () => {
    const survey = make();
    const onQuestion = vi.fn();
    const onState = vi.fn();
    const onValue = vi.fn();
    survey.onQuestionChange('satisfaction', onQuestion);
    survey.onStateChange(onState);
    survey.onValueChange(onValue);

    survey.destroy();
    survey.setValue('satisfaction', 4);

    expect(onQuestion).not.toHaveBeenCalled();
    expect(onState).not.toHaveBeenCalled();
    expect(onValue).not.toHaveBeenCalled();
  });

  it('un désabonnement individuel n’affecte pas les autres', () => {
    const survey = make();
    const premier = vi.fn();
    const second = vi.fn();
    const stop = survey.onQuestionChange('satisfaction', premier);
    survey.onQuestionChange('satisfaction', second);

    stop();
    survey.setValue('satisfaction', 4);

    expect(premier).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});

describe('mode lecture seule', () => {
  it('désactive les questions', () => {
    const survey = make(minimalSurvey(), { mode: 'display' });
    expect(survey.getQuestion('nom')?.enabled).toBe(false);
  });
});

describe('sans dépendance à React', () => {
  it('fonctionne sur un sondage construit à la volée', () => {
    const definition = createSurvey({ id: 'headless' });
    definition.pages[0]!.elements = [createQuestion('text', 'prenom')];

    const survey = createHeadlessSurvey(definition);
    survey.setValue('prenom', 'Ilyas');

    expect(survey.getResult().answers[0]!.value).toBe('Ilyas');
  });
});
