import type { BinaryOperator, ExpressionNode, PostfixOperator } from './ast';
import { ExpressionSyntaxError, tokenize, type Token } from './lexer';

/**
 * Parseur à montée en précédence (« precedence climbing ») produisant un AST.
 *
 * La syntaxe reprend celle de SurveyJS — `{q1} = 'oui' and {age} >= 18` — pour que
 * les règles restent transposables dans les deux sens et que le vocabulaire du
 * cahier des charges s'applique tel quel.
 */

/** Alias acceptés en entrée, normalisés vers l'opérateur canonique de l'AST. */
const BINARY_ALIASES: Record<string, BinaryOperator> = {
  '||': 'or',
  or: 'or',
  '&&': 'and',
  and: 'and',
  '=': '==',
  '==': '==',
  '!=': '!=',
  '<>': '!=',
  '<': '<',
  '>': '>',
  '<=': '<=',
  '>=': '>=',
  '*=': 'contains',
  contains: 'contains',
  notcontains: 'notcontains',
  anyof: 'anyof',
  allof: 'allof',
  noneof: 'noneof',
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  '%': '%',
  '^': '^',
};

const PRECEDENCE: Record<BinaryOperator, number> = {
  or: 1,
  and: 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '>': 4,
  '<=': 4,
  '>=': 4,
  contains: 4,
  notcontains: 4,
  anyof: 4,
  allof: 4,
  noneof: 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
  '^': 7,
};

/** `empty` / `notempty` sont postfixés : `{q1} notempty`. */
const POSTFIX_PRECEDENCE = 4;

const LITERAL_IDENTIFIERS: Record<string, string | number | boolean | null> = {
  true: true,
  false: false,
  null: null,
  undefined: null,
};

class Parser {
  private position = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly source: string,
  ) {}

  parse(): ExpressionNode {
    const node = this.parseExpression(0);
    const token = this.peek();
    if (token.type !== 'eof') {
      throw new ExpressionSyntaxError(
        `Jeton inattendu « ${token.value} » après une expression complète`,
        this.source,
        token.start,
      );
    }
    return node;
  }

  private peek(): Token {
    return this.tokens[this.position]!;
  }

  private next(): Token {
    const token = this.tokens[this.position]!;
    if (token.type !== 'eof') this.position += 1;
    return token;
  }

  private binaryOperatorAt(token: Token): BinaryOperator | undefined {
    if (token.type === 'op') return BINARY_ALIASES[token.value];
    if (token.type === 'ident') return BINARY_ALIASES[token.value.toLowerCase()];
    return undefined;
  }

  private postfixOperatorAt(token: Token): PostfixOperator | undefined {
    if (token.type !== 'ident') return undefined;
    const lowered = token.value.toLowerCase();
    if (lowered === 'empty' || lowered === 'notempty') return lowered;
    return undefined;
  }

  private parseExpression(minimumPrecedence: number): ExpressionNode {
    let left = this.parseUnary();

    for (;;) {
      const token = this.peek();

      const postfix = this.postfixOperatorAt(token);
      if (postfix) {
        if (POSTFIX_PRECEDENCE < minimumPrecedence) break;
        this.next();
        left = { kind: 'postfix', operator: postfix, operand: left };
        continue;
      }

      const operator = this.binaryOperatorAt(token);
      if (!operator) break;

      const precedence = PRECEDENCE[operator];
      if (precedence < minimumPrecedence) break;

      this.next();
      // `^` est associatif à droite : 2 ^ 3 ^ 2 vaut 2 ^ (3 ^ 2).
      const nextMinimum = operator === '^' ? precedence : precedence + 1;
      const right = this.parseExpression(nextMinimum);
      left = { kind: 'binary', operator, left, right };
    }

    return left;
  }

  private parseUnary(): ExpressionNode {
    const token = this.peek();

    if (
      (token.type === 'op' && token.value === '!') ||
      (token.type === 'ident' && (token.value.toLowerCase() === 'not' || token.value.toLowerCase() === 'negate'))
    ) {
      this.next();
      return { kind: 'unary', operator: '!', operand: this.parseUnary() };
    }

    if (token.type === 'op' && token.value === '-') {
      this.next();
      return { kind: 'unary', operator: '-', operand: this.parseUnary() };
    }

    if (token.type === 'op' && token.value === '+') {
      this.next();
      return this.parseUnary();
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.next();

    switch (token.type) {
      case 'number':
        return { kind: 'literal', value: Number(token.value) };

      case 'string':
        return { kind: 'literal', value: token.value };

      case 'ref':
        return { kind: 'ref', path: splitPath(token.value), source: token.value };

      case 'ident': {
        const lowered = token.value.toLowerCase();
        if (lowered in LITERAL_IDENTIFIERS) {
          return { kind: 'literal', value: LITERAL_IDENTIFIERS[lowered]! };
        }
        if (this.peek().type === 'punct' && this.peek().value === '(') {
          this.next();
          const args = this.parseArguments(')');
          return { kind: 'call', name: token.value, args };
        }
        throw new ExpressionSyntaxError(
          `Identifiant inattendu « ${token.value} ». Une valeur texte doit être entre ` +
            `apostrophes ('${token.value}') et une réponse entre accolades ({${token.value}}).`,
          this.source,
          token.start,
        );
      }

      case 'punct':
        if (token.value === '(') {
          const node = this.parseExpression(0);
          this.expect(')');
          return node;
        }
        if (token.value === '[') {
          return { kind: 'array', items: this.parseArguments(']') };
        }
        throw new ExpressionSyntaxError(
          `Ponctuation inattendue « ${token.value} »`,
          this.source,
          token.start,
        );

      case 'eof':
        throw new ExpressionSyntaxError('Expression incomplète', this.source, token.start);

      default:
        throw new ExpressionSyntaxError(
          `Jeton inattendu « ${token.value} »`,
          this.source,
          token.start,
        );
    }
  }

  /** Lit une liste séparée par des virgules jusqu'au délimiteur fermant (déjà consommé côté ouvrant). */
  private parseArguments(closing: ')' | ']'): ExpressionNode[] {
    const args: ExpressionNode[] = [];
    if (this.peek().type === 'punct' && this.peek().value === closing) {
      this.next();
      return args;
    }
    for (;;) {
      args.push(this.parseExpression(0));
      const token = this.peek();
      if (token.type === 'punct' && token.value === ',') {
        this.next();
        continue;
      }
      this.expect(closing);
      return args;
    }
  }

  private expect(value: string): Token {
    const token = this.peek();
    if (token.type === 'punct' && token.value === value) return this.next();
    throw new ExpressionSyntaxError(
      `« ${value} » attendu mais « ${token.value || 'fin d’expression'} » trouvé`,
      this.source,
      token.start,
    );
  }
}

/** `a.b[0]` → `['a', 'b', '0']` */
function splitPath(source: string): string[] {
  return source
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '');
}

/**
 * Cache des AST : les expressions d'un sondage sont réévaluées à chaque saisie,
 * les re-parser à chaque fois dominerait le coût du moteur.
 */
const CACHE_LIMIT = 500;
const cache = new Map<string, ExpressionNode>();

export function parseExpression(expression: string): ExpressionNode {
  const cached = cache.get(expression);
  if (cached) return cached;

  const node = new Parser(tokenize(expression), expression).parse();

  if (cache.size >= CACHE_LIMIT) {
    // Éviction FIFO : suffisante ici, le jeu d'expressions d'un sondage est borné.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(expression, node);
  return node;
}

export function clearExpressionCache(): void {
  cache.clear();
}

export interface ExpressionCheck {
  valid: boolean;
  error?: ExpressionSyntaxError;
  node?: ExpressionNode;
}

/** Vérifie une expression sans lever d'exception — utilisé par l'éditeur du builder. */
export function checkExpression(expression: string): ExpressionCheck {
  if (expression.trim() === '') return { valid: true };
  try {
    return { valid: true, node: parseExpression(expression) };
  } catch (error) {
    if (error instanceof ExpressionSyntaxError) return { valid: false, error };
    throw error;
  }
}

export { ExpressionSyntaxError };
