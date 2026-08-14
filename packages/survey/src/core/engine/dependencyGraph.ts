import { collectReferences } from '../expressions/ast';
import { checkExpression } from '../expressions/parser';
import { walkElements } from '../schema/traverse';
import { isChoiceQuestion, isPanel, type SurveyDefinition } from '../schema/types';

/**
 * Graphe des dépendances entre réponses et expressions.
 *
 * Sans lui, chaque frappe au clavier réévaluerait toutes les conditions du sondage.
 * Avec lui, changer `{montant}` ne réévalue que les éléments dont une expression
 * cite réellement `montant` — et, en cascade, ceux qui dépendent d'une valeur
 * calculée elle-même touchée.
 */

export interface Dependents {
  /** Identifiants d'éléments (questions, panels) et de pages. */
  elements: Set<string>;
  /** Noms de valeurs calculées. */
  calculated: Set<string>;
  /** Indices dans `survey.triggers`. */
  triggers: Set<number>;
}

export interface DependencyGraph {
  /** Nom de réponse → tout ce qui en dépend directement. */
  byName: Map<string, Dependents>;
  /** Tous les identifiants d'éléments/pages porteurs d'au moins une expression. */
  expressionElementIds: Set<string>;
  /** Noms de valeurs calculées, dans un ordre d'évaluation sans dépendance amont. */
  calculatedOrder: string[];
}

function emptyDependents(): Dependents {
  return { elements: new Set(), calculated: new Set(), triggers: new Set() };
}

function referencesOf(expression: string | undefined): string[] {
  if (!expression || expression.trim() === '') return [];
  const checked = checkExpression(expression);
  if (!checked.valid || !checked.node) return [];
  return [...collectReferences(checked.node)];
}

export function buildDependencyGraph(survey: SurveyDefinition): DependencyGraph {
  const byName = new Map<string, Dependents>();
  const expressionElementIds = new Set<string>();

  const dependentsFor = (name: string): Dependents => {
    let dependents = byName.get(name);
    if (!dependents) {
      dependents = emptyDependents();
      byName.set(name, dependents);
    }
    return dependents;
  };

  const linkElement = (expressions: Array<string | undefined>, elementId: string): void => {
    let hasExpression = false;
    for (const expression of expressions) {
      const references = referencesOf(expression);
      if (expression && expression.trim() !== '') hasExpression = true;
      for (const reference of references) {
        dependentsFor(reference).elements.add(elementId);
      }
    }
    if (hasExpression) expressionElementIds.add(elementId);
  };

  for (const page of survey.pages) {
    linkElement([page.visibleIf], page.id);
    walkElements(page.elements, (element) => {
      if (isPanel(element)) {
        linkElement([element.visibleIf, element.enableIf], element.id);
        return;
      }
      const expressions: Array<string | undefined> = [
        element.visibleIf,
        element.enableIf,
        element.requiredIf,
      ];
      if (isChoiceQuestion(element)) {
        expressions.push(element.choicesVisibleIf);
        for (const choice of element.choices) expressions.push(choice.visibleIf);
      }
      for (const validator of element.validators ?? []) {
        if (validator.type === 'expression') expressions.push(validator.expression);
      }
      linkElement(expressions, element.id);
    });
  }

  const calculatedValues = survey.calculatedValues ?? [];
  const calculatedReferences = new Map<string, string[]>();
  for (const calculated of calculatedValues) {
    const references = referencesOf(calculated.expression);
    calculatedReferences.set(calculated.name, references);
    for (const reference of references) {
      dependentsFor(reference).calculated.add(calculated.name);
    }
  }

  (survey.triggers ?? []).forEach((trigger, index) => {
    for (const reference of referencesOf(trigger.expression)) {
      dependentsFor(reference).triggers.add(index);
    }
    if (trigger.type === 'copyvalue') {
      dependentsFor(trigger.fromName).triggers.add(index);
    }
  });

  return {
    byName,
    expressionElementIds,
    calculatedOrder: topologicalOrder(calculatedValues.map((value) => value.name), calculatedReferences),
  };
}

/**
 * Ordonne les valeurs calculées pour qu'une valeur soit évaluée après celles
 * dont elle dépend. Un cycle (A dépend de B qui dépend de A) ne fait pas échouer
 * l'ordonnancement : les valeurs restantes sont ajoutées telles quelles, ce qui
 * produit un résultat stable — un sondage cassé ne doit pas empêcher l'affichage.
 */
function topologicalOrder(names: string[], references: Map<string, string[]>): string[] {
  const known = new Set(names);
  const ordered: string[] = [];
  const placed = new Set<string>();
  const visiting = new Set<string>();

  const visit = (name: string): void => {
    if (placed.has(name) || visiting.has(name)) return;
    visiting.add(name);
    for (const reference of references.get(name) ?? []) {
      if (known.has(reference)) visit(reference);
    }
    visiting.delete(name);
    placed.add(name);
    ordered.push(name);
  };

  for (const name of names) visit(name);
  return ordered;
}

export interface AffectedTargets {
  elements: Set<string>;
  calculated: Set<string>;
  triggers: Set<number>;
}

/**
 * Cibles à réévaluer après modification des noms fournis.
 * Le parcours est transitif : une valeur calculée touchée devient elle-même une
 * source de changement pour les expressions qui la citent.
 */
export function affectedBy(graph: DependencyGraph, changedNames: Iterable<string>): AffectedTargets {
  const elements = new Set<string>();
  const calculated = new Set<string>();
  const triggers = new Set<number>();

  const queue = [...changedNames];
  const seen = new Set(queue);

  while (queue.length > 0) {
    const name = queue.shift()!;
    const dependents = graph.byName.get(name);
    if (!dependents) continue;

    for (const elementId of dependents.elements) elements.add(elementId);
    for (const index of dependents.triggers) triggers.add(index);
    for (const calculatedName of dependents.calculated) {
      calculated.add(calculatedName);
      if (!seen.has(calculatedName)) {
        seen.add(calculatedName);
        queue.push(calculatedName);
      }
    }
  }

  return { elements, calculated, triggers };
}
