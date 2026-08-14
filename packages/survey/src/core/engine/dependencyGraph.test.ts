import { describe, expect, it } from 'vitest';
import { minimalSurvey, satisfactionSurvey } from '../../../tests/fixtures';
import { createQuestion } from '../schema/defaults';
import { affectedBy, buildDependencyGraph } from './dependencyGraph';

describe('buildDependencyGraph', () => {
  it('relie une question à celles dont elle conditionne l’affichage', () => {
    const graph = buildDependencyGraph(satisfactionSurvey());
    expect(graph.byName.get('satisfaction')?.elements.has('q2')).toBe(true);
  });

  it('relie les valeurs calculées à leurs dépendances', () => {
    const graph = buildDependencyGraph(satisfactionSurvey());
    expect(graph.byName.get('recommandation')?.calculated.has('estDetracteur')).toBe(true);
  });

  it('relie les déclencheurs à leur condition et à leur source', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push(createQuestion('text', 'copie'));
    survey.triggers = [
      { type: 'copyvalue', expression: '{nom} notempty', fromName: 'nom', setToName: 'copie' },
    ];
    const graph = buildDependencyGraph(survey);
    expect(graph.byName.get('nom')?.triggers.has(0)).toBe(true);
  });

  it('recense les expressions des options et des validateurs', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push({
      id: 'q2',
      name: 'liste',
      type: 'dropdown',
      title: 'Liste',
      choices: [{ value: 'a', visibleIf: '{nom} notempty' }],
      validators: [{ type: 'expression', expression: '{age} > 0' }],
    });
    const graph = buildDependencyGraph(survey);
    expect(graph.byName.get('nom')?.elements.has('q2')).toBe(true);
    expect(graph.byName.get('age')?.elements.has('q2')).toBe(true);
  });

  it('ignore silencieusement une expression syntaxiquement invalide', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.visibleIf = '{a} =';
    expect(() => buildDependencyGraph(survey)).not.toThrow();
  });

  it('ne référence pas les éléments dépourvus d’expression', () => {
    const graph = buildDependencyGraph(minimalSurvey());
    expect(graph.expressionElementIds.size).toBe(0);
  });
});

describe('ordre des valeurs calculées', () => {
  it('place une valeur après celles dont elle dépend', () => {
    const survey = minimalSurvey();
    survey.calculatedValues = [
      { name: 'c', expression: '{b} + 1' },
      { name: 'b', expression: '{a} + 1' },
      { name: 'a', expression: '1' },
    ];
    expect(buildDependencyGraph(survey).calculatedOrder).toEqual(['a', 'b', 'c']);
  });

  it('reste stable en présence d’un cycle plutôt que d’échouer', () => {
    const survey = minimalSurvey();
    survey.calculatedValues = [
      { name: 'a', expression: '{b} + 1' },
      { name: 'b', expression: '{a} + 1' },
    ];
    const order = buildDependencyGraph(survey).calculatedOrder;
    expect(order).toHaveLength(2);
    expect([...order].sort()).toEqual(['a', 'b']);
  });
});

describe('affectedBy', () => {
  it('remonte les dépendants directs', () => {
    const graph = buildDependencyGraph(satisfactionSurvey());
    expect(affectedBy(graph, ['satisfaction']).elements.has('q2')).toBe(true);
  });

  it('propage à travers les valeurs calculées', () => {
    const survey = minimalSurvey();
    survey.calculatedValues = [{ name: 'longueur', expression: 'len({nom})' }];
    survey.pages[0]!.elements.push({
      id: 'q2',
      name: 'suite',
      type: 'text',
      title: 'Suite',
      visibleIf: '{longueur} > 3',
    });
    const graph = buildDependencyGraph(survey);
    const affected = affectedBy(graph, ['nom']);
    expect(affected.calculated.has('longueur')).toBe(true);
    // La question ne cite pas {nom} mais dépend de lui via la valeur calculée.
    expect(affected.elements.has('q2')).toBe(true);
  });

  it('ne boucle pas sur des valeurs calculées mutuellement dépendantes', () => {
    const survey = minimalSurvey();
    survey.calculatedValues = [
      { name: 'a', expression: '{b} + {nom}' },
      { name: 'b', expression: '{a} + 1' },
    ];
    const graph = buildDependencyGraph(survey);
    expect(() => affectedBy(graph, ['nom'])).not.toThrow();
    expect(affectedBy(graph, ['nom']).calculated.size).toBe(2);
  });

  it('ne renvoie rien pour un nom sans dépendant', () => {
    const graph = buildDependencyGraph(satisfactionSurvey());
    const affected = affectedBy(graph, ['inconnu']);
    expect(affected.elements.size).toBe(0);
    expect(affected.calculated.size).toBe(0);
    expect(affected.triggers.size).toBe(0);
  });
});
