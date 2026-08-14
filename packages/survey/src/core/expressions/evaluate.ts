import type { BinaryOperator, ExpressionNode } from './ast';
import { builtinFunctions, type ExpressionFunction } from './functions';
import { parseExpression } from './parser';
import {
  compareValues,
  isEmpty,
  looseEquals,
  toArray,
  toBoolean,
  toNumber,
  toStringValue,
} from './values';

export interface EvaluationContext {
  /** Réponses courantes, indexées par `name` de question. */
  data: Readonly<Record<string, unknown>>;
  /** Valeur de l'option en cours de test — alimente `{item}` dans `choicesVisibleIf`. */
  item?: unknown;
  /** Fonctions additionnelles, fusionnées avec les fonctions intégrées. */
  functions?: Readonly<Record<string, ExpressionFunction>>;
  /** Date de référence ; injectée par les tests pour rendre `today()` déterministe. */
  now?: Date;
  /** Notifié à chaque échec — le moteur y branche ses diagnostics. */
  onError?: (error: Error, expression: string) => void;
}

/** Résout `{a.b[0]}` dans les réponses. */
function resolveReference(path: string[], context: EvaluationContext): unknown {
  const [root, ...rest] = path;
  if (root === undefined) return undefined;

  let current: unknown = root === 'item' && 'item' in context ? context.item : context.data[root];

  for (const segment of rest) {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isNaN(index) ? undefined : current[index];
      continue;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }
    return undefined;
  }

  return current;
}

function evaluateContains(left: unknown, right: unknown): boolean {
  if (isEmpty(left)) return false;
  if (Array.isArray(left)) {
    return toArray(right).every((needle) =>
      left.some((candidate) => looseEquals(candidate, needle)),
    );
  }
  if (isEmpty(right)) return false;
  return toStringValue(left).includes(toStringValue(right));
}

function evaluateArithmetic(operator: BinaryOperator, left: unknown, right: unknown): unknown {
  // `+` reste une concaténation dès qu'un opérande est une chaîne non numérique,
  // ce qui permet d'écrire `{prenom} + ' ' + {nom}` dans une valeur calculée.
  if (operator === '+') {
    const leftNumber = toNumber(left);
    const rightNumber = toNumber(right);
    const leftIsText = typeof left === 'string' && leftNumber === undefined;
    const rightIsText = typeof right === 'string' && rightNumber === undefined;
    if (leftIsText || rightIsText) return toStringValue(left) + toStringValue(right);
    if (leftNumber === undefined || rightNumber === undefined) return undefined;
    return leftNumber + rightNumber;
  }

  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (leftNumber === undefined || rightNumber === undefined) return undefined;

  switch (operator) {
    case '-':
      return leftNumber - rightNumber;
    case '*':
      return leftNumber * rightNumber;
    case '/':
      // Une division par zéro doit produire « pas de valeur », jamais `Infinity`,
      // qui se propagerait silencieusement dans les comparaisons.
      return rightNumber === 0 ? undefined : leftNumber / rightNumber;
    case '%':
      return rightNumber === 0 ? undefined : leftNumber % rightNumber;
    case '^':
      return leftNumber ** rightNumber;
    default:
      return undefined;
  }
}

export function evaluateNode(node: ExpressionNode, context: EvaluationContext): unknown {
  switch (node.kind) {
    case 'literal':
      return node.value;

    case 'ref':
      return resolveReference(node.path, context);

    case 'array':
      return node.items.map((item) => evaluateNode(item, context));

    case 'unary': {
      const operand = evaluateNode(node.operand, context);
      if (node.operator === '!') return !toBoolean(operand);
      const numeric = toNumber(operand);
      return numeric === undefined ? undefined : -numeric;
    }

    case 'postfix': {
      const operand = evaluateNode(node.operand, context);
      return node.operator === 'empty' ? isEmpty(operand) : !isEmpty(operand);
    }

    case 'binary': {
      // `and` / `or` court-circuitent : le membre droit n'est pas évalué inutilement.
      if (node.operator === 'and') {
        return toBoolean(evaluateNode(node.left, context))
          ? toBoolean(evaluateNode(node.right, context))
          : false;
      }
      if (node.operator === 'or') {
        return toBoolean(evaluateNode(node.left, context))
          ? true
          : toBoolean(evaluateNode(node.right, context));
      }

      const left = evaluateNode(node.left, context);
      const right = evaluateNode(node.right, context);

      switch (node.operator) {
        case '==':
          return looseEquals(left, right);
        case '!=':
          return !looseEquals(left, right);
        case '<':
        case '>':
        case '<=':
        case '>=': {
          const comparison = compareValues(left, right);
          if (comparison === undefined) return false;
          if (node.operator === '<') return comparison < 0;
          if (node.operator === '>') return comparison > 0;
          if (node.operator === '<=') return comparison <= 0;
          return comparison >= 0;
        }
        case 'contains':
          return evaluateContains(left, right);
        case 'notcontains':
          return !evaluateContains(left, right);
        case 'anyof': {
          const candidates = toArray(right);
          const values = toArray(left);
          return values.some((value) =>
            candidates.some((candidate) => looseEquals(value, candidate)),
          );
        }
        case 'allof': {
          const candidates = toArray(right);
          const values = toArray(left);
          if (candidates.length === 0) return true;
          return candidates.every((candidate) =>
            values.some((value) => looseEquals(value, candidate)),
          );
        }
        case 'noneof': {
          const candidates = toArray(right);
          const values = toArray(left);
          return !values.some((value) =>
            candidates.some((candidate) => looseEquals(value, candidate)),
          );
        }
        default:
          return evaluateArithmetic(node.operator, left, right);
      }
    }

    case 'call': {
      const implementation = context.functions?.[node.name] ?? builtinFunctions[node.name];
      if (!implementation) {
        throw new Error(
          `Fonction inconnue « ${node.name} ». Fonctions disponibles : ` +
            `${Object.keys(builtinFunctions).join(', ')}.`,
        );
      }
      const args = node.args.map((argument) => evaluateNode(argument, context));
      return implementation(args, { now: context.now ?? new Date() });
    }

    default:
      return undefined;
  }
}

/**
 * Évalue une expression et renvoie sa valeur brute.
 * Utilisée par les valeurs calculées et les déclencheurs `setvalue`.
 */
export function evaluateExpression(expression: string, context: EvaluationContext): unknown {
  return evaluateNode(parseExpression(expression), context);
}

/**
 * Évalue une expression comme condition.
 *
 * Une expression absente **ou en erreur** retombe sur `fallback` : une règle
 * syntaxiquement cassée se comporte donc comme si elle n'existait pas, plutôt que
 * de masquer silencieusement une question ou de bloquer la validation. L'erreur
 * reste remontée via `onError` pour être affichée dans le builder.
 */
export function evaluateCondition(
  expression: string | undefined,
  context: EvaluationContext,
  fallback: boolean,
): boolean {
  if (expression === undefined || expression.trim() === '') return fallback;
  try {
    return toBoolean(evaluateNode(parseExpression(expression), context));
  } catch (error) {
    context.onError?.(error instanceof Error ? error : new Error(String(error)), expression);
    return fallback;
  }
}

/** Comme `evaluateExpression`, mais renvoie `undefined` en cas d'erreur au lieu de lever. */
export function tryEvaluateExpression(
  expression: string,
  context: EvaluationContext,
): unknown {
  try {
    return evaluateExpression(expression, context);
  } catch (error) {
    context.onError?.(error instanceof Error ? error : new Error(String(error)), expression);
    return undefined;
  }
}
