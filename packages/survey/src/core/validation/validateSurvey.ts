import { collectFunctionCalls, collectReferences } from '../expressions/ast';
import { builtinFunctions } from '../expressions/functions';
import { checkExpression } from '../expressions/parser';
import { isLocalizedTextEmpty } from '../localization/resolveText';
import { questionRegistry } from '../registry/questionRegistry';
import { collectPageQuestions, walkElements } from '../schema/traverse';
import { isChoiceQuestion, isPanel, type SurveyDefinition } from '../schema/types';
import { safeParseSurvey } from '../schema/zod';

/**
 * Diagnostics de **conception** — ce que le builder affiche à l'auteur du sondage.
 * À distinguer de `validators.ts`, qui valide les *réponses* d'un répondant.
 */

export type DiagnosticSeverity = 'error' | 'warning';

export interface SurveyDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  /** Identifiant de l'élément fautif — permet au builder de le sélectionner au clic. */
  elementId?: string;
  /** Nom lisible de l'élément fautif. */
  elementName?: string;
}

export interface ValidateSurveyResult {
  diagnostics: SurveyDiagnostic[];
  /** Vrai si aucun diagnostic de sévérité `error`. */
  valid: boolean;
}

/** Référence toujours résolvable, quel que soit le sondage. */
const IMPLICIT_NAMES = new Set(['item']);

export function validateSurveyDefinition(survey: SurveyDefinition): ValidateSurveyResult {
  const diagnostics: SurveyDiagnostic[] = [];
  const report = (diagnostic: SurveyDiagnostic): void => {
    diagnostics.push(diagnostic);
  };

  /* --------------------------- Conformité au schéma -------------------------- */

  const parsed = safeParseSurvey(survey);
  if (!parsed.success) {
    for (const issue of parsed.issues) {
      report({
        severity: 'error',
        code: 'schema',
        message: `${issue.path || 'racine'} : ${issue.message}`,
      });
    }
    // Le reste des contrôles suppose une structure conforme.
    return { diagnostics, valid: false };
  }

  /* ------------------------------ Espace de noms ----------------------------- */

  const seen = new Map<string, number>();
  const knownNames = new Set<string>(IMPLICIT_NAMES);
  /** Rang d'apparition d'un nom, pour détecter les références en avant. */
  const nameOrder = new Map<string, number>();
  let order = 0;

  const declare = (name: string, id: string, kind: string): void => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count > 1) {
      report({
        severity: 'error',
        code: 'duplicate-name',
        message: `Le nom « ${name} » est utilisé plusieurs fois. Chaque ${kind}, page et question doit porter un nom unique.`,
        elementId: id,
        elementName: name,
      });
    }
    knownNames.add(name);
    if (!nameOrder.has(name)) nameOrder.set(name, order);
    order += 1;
  };

  for (const page of survey.pages) {
    declare(page.name, page.id, 'page');
    walkElements(page.elements, (element) => {
      declare(element.name, element.id, isPanel(element) ? 'groupe' : 'question');
    });
  }
  for (const calculated of survey.calculatedValues ?? []) {
    declare(calculated.name, calculated.name, 'valeur calculée');
  }

  /* ------------------------------- Expressions ------------------------------- */

  const checkExpressionField = (
    expression: string | undefined,
    label: string,
    elementId: string,
    elementName: string,
    elementRank?: number,
  ): void => {
    if (!expression || expression.trim() === '') return;

    const result = checkExpression(expression);
    if (!result.valid || !result.node) {
      report({
        severity: 'error',
        code: 'expression-syntax',
        message: `${label} : ${result.error?.message.split('\n')[0] ?? 'expression invalide'}`,
        elementId,
        elementName,
      });
      return;
    }

    for (const reference of collectReferences(result.node)) {
      if (!knownNames.has(reference)) {
        report({
          severity: 'error',
          code: 'unknown-reference',
          message: `${label} : la référence {${reference}} ne correspond à aucune question, page ou valeur calculée.`,
          elementId,
          elementName,
        });
        continue;
      }
      // Une condition qui dépend d'une réponse posée *après* elle ne peut jamais
      // être vraie au premier affichage : c'est presque toujours une erreur de conception.
      const referenceRank = nameOrder.get(reference);
      if (elementRank !== undefined && referenceRank !== undefined && referenceRank > elementRank) {
        report({
          severity: 'warning',
          code: 'forward-reference',
          message: `${label} : {${reference}} est posée après cet élément ; la condition sera fausse au premier affichage.`,
          elementId,
          elementName,
        });
      }
    }

    for (const functionName of collectFunctionCalls(result.node)) {
      if (!(functionName in builtinFunctions)) {
        report({
          severity: 'error',
          code: 'unknown-function',
          message: `${label} : la fonction « ${functionName} » n'existe pas. Disponibles : ${Object.keys(builtinFunctions).join(', ')}.`,
          elementId,
          elementName,
        });
      }
    }
  };

  /* ---------------------------- Pages et éléments ---------------------------- */

  let rank = 0;
  for (const page of survey.pages) {
    const pageRank = rank;
    rank += 1;

    checkExpressionField(
      page.visibleIf,
      `Page « ${page.name} », afficher si`,
      page.id,
      page.name,
      pageRank,
    );

    if (collectPageQuestions(page).length === 0) {
      report({
        severity: 'warning',
        code: 'empty-page',
        message: `La page « ${page.name} » ne contient aucune question.`,
        elementId: page.id,
        elementName: page.name,
      });
    }

    walkElements(page.elements, (element) => {
      const elementRank = rank;
      rank += 1;
      const label = (field: string): string => `« ${element.name} », ${field}`;

      checkExpressionField(
        element.visibleIf,
        label('afficher si'),
        element.id,
        element.name,
        elementRank,
      );
      checkExpressionField(
        element.enableIf,
        label('activer si'),
        element.id,
        element.name,
        elementRank,
      );

      if (isPanel(element)) {
        if (element.elements.length === 0) {
          report({
            severity: 'warning',
            code: 'empty-panel',
            message: `Le groupe « ${element.name} » est vide.`,
            elementId: element.id,
            elementName: element.name,
          });
        }
        return;
      }

      checkExpressionField(
        element.requiredIf,
        label('obligatoire si'),
        element.id,
        element.name,
        elementRank,
      );

      if (!questionRegistry.has(element.type)) {
        report({
          severity: 'error',
          code: 'unknown-type',
          message: `Type de question inconnu : « ${element.type} ».`,
          elementId: element.id,
          elementName: element.name,
        });
        return;
      }

      if (isLocalizedTextEmpty(element.title)) {
        report({
          severity: 'warning',
          code: 'missing-title',
          message: `La question « ${element.name} » n'a pas de libellé.`,
          elementId: element.id,
          elementName: element.name,
        });
      }

      for (const validator of element.validators ?? []) {
        if (validator.type === 'expression') {
          checkExpressionField(
            validator.expression,
            label('règle de validation'),
            element.id,
            element.name,
            elementRank,
          );
        }
        if (validator.type === 'regex') {
          try {
            new RegExp(validator.regex);
          } catch {
            report({
              severity: 'error',
              code: 'invalid-regex',
              message: `« ${element.name} » : l'expression régulière « ${validator.regex} » est invalide.`,
              elementId: element.id,
              elementName: element.name,
            });
          }
        }
      }

      if (isChoiceQuestion(element)) {
        checkExpressionField(
          element.choicesVisibleIf,
          label('filtrer les options si'),
          element.id,
          element.name,
          elementRank,
        );

        if (element.choices.length === 0) {
          report({
            severity: 'error',
            code: 'no-choices',
            message: `La question « ${element.name} » n'a aucune option de réponse.`,
            elementId: element.id,
            elementName: element.name,
          });
        }

        const values = new Set<string>();
        for (const choice of element.choices) {
          const key = String(choice.value);
          if (values.has(key)) {
            report({
              severity: 'error',
              code: 'duplicate-choice',
              message: `La question « ${element.name} » contient plusieurs options de valeur « ${key} ».`,
              elementId: element.id,
              elementName: element.name,
            });
          }
          values.add(key);
        }
      }
    });
  }

  /* --------------------------- Valeurs et déclencheurs ------------------------ */

  for (const calculated of survey.calculatedValues ?? []) {
    checkExpressionField(
      calculated.expression,
      `Valeur calculée « ${calculated.name} »`,
      calculated.name,
      calculated.name,
    );
  }

  (survey.triggers ?? []).forEach((trigger, index) => {
    const label = `Déclencheur ${index + 1} (${trigger.type})`;
    checkExpressionField(trigger.expression, label, `trigger-${index}`, label);

    const requireName = (name: string, field: string): void => {
      if (!knownNames.has(name)) {
        report({
          severity: 'error',
          code: 'unknown-reference',
          message: `${label} : ${field} « ${name} » ne correspond à aucun élément du sondage.`,
          elementId: `trigger-${index}`,
          elementName: label,
        });
      }
    };

    if (trigger.type === 'setvalue') requireName(trigger.setToName, 'la cible');
    if (trigger.type === 'copyvalue') {
      requireName(trigger.fromName, 'la source');
      requireName(trigger.setToName, 'la cible');
    }
    if (trigger.type === 'skip') requireName(trigger.gotoName, 'la destination');
  });

  if (survey.pages.length === 0) {
    report({
      severity: 'error',
      code: 'no-pages',
      message: 'Le sondage ne contient aucune page.',
    });
  }

  return {
    diagnostics,
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
  };
}
