/**
 * Analyse lexicale des expressions conditionnelles.
 *
 * Aucune construction dynamique de code n'est utilisée nulle part dans ce module ni
 * dans le parseur : contexte bancaire, les expressions proviennent d'utilisateurs
 * back-office et ne doivent jamais atteindre un interpréteur JavaScript.
 */

export type TokenType = 'number' | 'string' | 'ident' | 'ref' | 'op' | 'punct' | 'eof';

export interface Token {
  type: TokenType;
  /** Texte du jeton ; pour `ref`, le contenu entre accolades. */
  value: string;
  start: number;
  end: number;
}

export class ExpressionSyntaxError extends Error {
  readonly expression: string;
  readonly position: number;

  constructor(message: string, expression: string, position: number) {
    // Le repère visuel évite d'avoir à compter les caractères à la main dans le builder.
    const pointer = `${expression}\n${' '.repeat(Math.max(0, position))}^`;
    super(`${message} (position ${position})\n${pointer}`);
    this.name = 'ExpressionSyntaxError';
    this.expression = expression;
    this.position = position;
  }
}

const TWO_CHAR_OPERATORS = ['==', '!=', '<>', '<=', '>=', '&&', '||', '*='] as const;
const ONE_CHAR_OPERATORS = ['=', '<', '>', '+', '-', '*', '/', '%', '^', '!'] as const;
const PUNCTUATION = ['(', ')', '[', ']', ','] as const;

const isDigit = (character: string): boolean => character >= '0' && character <= '9';

const isIdentifierStart = (character: string): boolean =>
  (character >= 'a' && character <= 'z') ||
  (character >= 'A' && character <= 'Z') ||
  character === '_' ||
  character === '$';

const isIdentifierPart = (character: string): boolean =>
  isIdentifierStart(character) || isDigit(character);

export function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  const push = (type: TokenType, value: string, start: number): void => {
    tokens.push({ type, value, start, end: index });
  };

  while (index < expression.length) {
    const character = expression[index]!;

    if (character === ' ' || character === '\t' || character === '\n' || character === '\r') {
      index += 1;
      continue;
    }

    // Référence à une réponse : {nom}, {panel.champ}, {tableau[0]}
    if (character === '{') {
      const start = index;
      const closing = expression.indexOf('}', index + 1);
      if (closing === -1) {
        throw new ExpressionSyntaxError('Accolade fermante « } » manquante', expression, start);
      }
      const inner = expression.slice(index + 1, closing).trim();
      if (inner === '') {
        throw new ExpressionSyntaxError('Référence vide « {} »', expression, start);
      }
      index = closing + 1;
      push('ref', inner, start);
      continue;
    }

    if (character === "'" || character === '"') {
      const start = index;
      const quote = character;
      index += 1;
      let value = '';
      let closed = false;
      while (index < expression.length) {
        const current = expression[index]!;
        if (current === '\\' && index + 1 < expression.length) {
          value += expression[index + 1]!;
          index += 2;
          continue;
        }
        if (current === quote) {
          index += 1;
          closed = true;
          break;
        }
        value += current;
        index += 1;
      }
      if (!closed) {
        throw new ExpressionSyntaxError('Chaîne de caractères non terminée', expression, start);
      }
      push('string', value, start);
      continue;
    }

    if (isDigit(character) || (character === '.' && isDigit(expression[index + 1] ?? ''))) {
      const start = index;
      while (index < expression.length && isDigit(expression[index]!)) index += 1;
      if (expression[index] === '.') {
        index += 1;
        while (index < expression.length && isDigit(expression[index]!)) index += 1;
      }
      push('number', expression.slice(start, index), start);
      continue;
    }

    if (isIdentifierStart(character)) {
      const start = index;
      while (index < expression.length && isIdentifierPart(expression[index]!)) index += 1;
      push('ident', expression.slice(start, index), start);
      continue;
    }

    const twoChar = expression.slice(index, index + 2);
    if ((TWO_CHAR_OPERATORS as readonly string[]).includes(twoChar)) {
      const start = index;
      index += 2;
      push('op', twoChar, start);
      continue;
    }

    if ((ONE_CHAR_OPERATORS as readonly string[]).includes(character)) {
      const start = index;
      index += 1;
      push('op', character, start);
      continue;
    }

    if ((PUNCTUATION as readonly string[]).includes(character)) {
      const start = index;
      index += 1;
      push('punct', character, start);
      continue;
    }

    throw new ExpressionSyntaxError(`Caractère inattendu « ${character} »`, expression, index);
  }

  tokens.push({ type: 'eof', value: '', start: index, end: index });
  return tokens;
}
