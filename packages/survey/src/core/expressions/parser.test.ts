import { describe, expect, it } from 'vitest';
import { collectFunctionCalls, collectReferences } from './ast';
import { ExpressionSyntaxError, tokenize } from './lexer';
import { checkExpression, parseExpression } from './parser';

describe('tokenize', () => {
  it('découpe une expression complète', () => {
    const types = tokenize("{q1} = 'oui' and {age} >= 18").map((token) => token.type);
    expect(types).toEqual(['ref', 'op', 'string', 'ident', 'ref', 'op', 'number', 'eof']);
  });

  it('gère les échappements dans les chaînes', () => {
    const tokens = tokenize("'l\\'énoncé'");
    expect(tokens[0]!.value).toBe("l'énoncé");
  });

  it('accepte les guillemets doubles', () => {
    expect(tokenize('"texte"')[0]!.value).toBe('texte');
  });

  it('lit les nombres décimaux', () => {
    expect(tokenize('1.5')[0]!.value).toBe('1.5');
    expect(tokenize('.5')[0]!.value).toBe('.5');
  });

  it('préfère les opérateurs à deux caractères', () => {
    expect(tokenize('<=')[0]!.value).toBe('<=');
    expect(tokenize('<>')[0]!.value).toBe('<>');
  });

  it.each([
    ['{q1', 'accolade non fermée'],
    ['{}', 'référence vide'],
    ["'abc", 'chaîne non terminée'],
    ['{q1} # 2', 'caractère inconnu'],
  ])('rejette « %s » (%s)', (expression) => {
    expect(() => tokenize(expression)).toThrow(ExpressionSyntaxError);
  });

  it('indique la position de l’erreur avec un repère visuel', () => {
    try {
      tokenize('{a} # {b}');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ExpressionSyntaxError);
      expect((error as ExpressionSyntaxError).position).toBe(4);
      expect((error as ExpressionSyntaxError).message).toContain('^');
    }
  });
});

describe('précédence des opérateurs', () => {
  it('« and » lie plus fort que « or »', () => {
    const node = parseExpression('{a} or {b} and {c}');
    expect(node).toMatchObject({
      kind: 'binary',
      operator: 'or',
      right: { kind: 'binary', operator: 'and' },
    });
  });

  it('la comparaison lie plus fort que « and »', () => {
    const node = parseExpression('{a} > 1 and {b} < 2');
    expect(node).toMatchObject({
      operator: 'and',
      left: { operator: '>' },
      right: { operator: '<' },
    });
  });

  it('la multiplication lie plus fort que l’addition', () => {
    expect(parseExpression('1 + 2 * 3')).toMatchObject({
      operator: '+',
      right: { operator: '*' },
    });
  });

  it('les parenthèses inversent la précédence', () => {
    expect(parseExpression('(1 + 2) * 3')).toMatchObject({
      operator: '*',
      left: { operator: '+' },
    });
  });

  it('« ^ » est associatif à droite', () => {
    expect(parseExpression('2 ^ 3 ^ 2')).toMatchObject({
      operator: '^',
      right: { operator: '^' },
    });
  });

  it('« - » et « + » sont associatifs à gauche', () => {
    expect(parseExpression('10 - 3 - 2')).toMatchObject({
      operator: '-',
      left: { operator: '-' },
    });
  });
});

describe('normalisation des alias', () => {
  it.each([
    ['=', '=='],
    ['==', '=='],
    ['<>', '!='],
    ['!=', '!='],
    ['&&', 'and'],
    ['and', 'and'],
    ['||', 'or'],
    ['or', 'or'],
    ['*=', 'contains'],
    ['contains', 'contains'],
  ])('« %s » devient « %s »', (input, expected) => {
    expect(parseExpression(`{a} ${input} {b}`)).toMatchObject({ operator: expected });
  });

  it('accepte les mots-clés quelle que soit la casse', () => {
    expect(parseExpression('{a} AND {b}')).toMatchObject({ operator: 'and' });
    expect(parseExpression('{a} AnyOf [1]')).toMatchObject({ operator: 'anyof' });
  });
});

describe('formes syntaxiques', () => {
  it('analyse les opérateurs postfixés', () => {
    expect(parseExpression('{a} notempty')).toMatchObject({
      kind: 'postfix',
      operator: 'notempty',
    });
  });

  it('combine postfixe et « and »', () => {
    expect(parseExpression('{a} empty and {b} notempty')).toMatchObject({
      operator: 'and',
      left: { kind: 'postfix', operator: 'empty' },
      right: { kind: 'postfix', operator: 'notempty' },
    });
  });

  it('analyse la négation préfixée', () => {
    expect(parseExpression('!{a}')).toMatchObject({ kind: 'unary', operator: '!' });
    expect(parseExpression('not {a}')).toMatchObject({ kind: 'unary', operator: '!' });
  });

  it('analyse les littéraux tableau', () => {
    expect(parseExpression("{a} anyof ['x', 'y']")).toMatchObject({
      operator: 'anyof',
      right: { kind: 'array', items: [{ value: 'x' }, { value: 'y' }] },
    });
  });

  it('analyse un tableau vide', () => {
    expect(parseExpression('[]')).toMatchObject({ kind: 'array', items: [] });
  });

  it('analyse les appels de fonction imbriqués', () => {
    expect(parseExpression('iif({a} > 1, round({b}, 2), 0)')).toMatchObject({
      kind: 'call',
      name: 'iif',
      args: [{ operator: '>' }, { kind: 'call', name: 'round' }, { value: 0 }],
    });
  });

  it('analyse un appel sans argument', () => {
    expect(parseExpression('today()')).toMatchObject({ kind: 'call', name: 'today', args: [] });
  });

  it('éclate les chemins pointés et indexés', () => {
    expect(parseExpression('{coord.ville}')).toMatchObject({ path: ['coord', 'ville'] });
    expect(parseExpression('{liste[2]}')).toMatchObject({ path: ['liste', '2'] });
  });

  it.each(['true', 'false', 'null'])('reconnaît le littéral « %s »', (literal) => {
    expect(parseExpression(literal)).toMatchObject({ kind: 'literal' });
  });
});

describe('erreurs de syntaxe', () => {
  it.each([
    ['{a} =', 'membre droit manquant'],
    ['(1 + 2', 'parenthèse non fermée'],
    ['{a} = oui', 'valeur texte sans apostrophes'],
    ['1 2', 'jetons juxtaposés'],
    ['', 'expression vide'],
    ["['a', ]", 'virgule finale'],
  ])('rejette « %s » (%s)', (expression) => {
    expect(() => parseExpression(expression)).toThrow(ExpressionSyntaxError);
  });

  it('suggère la correction pour une valeur non quotée', () => {
    expect(() => parseExpression('{a} = oui')).toThrow(/apostrophes/);
  });
});

describe('checkExpression', () => {
  it('considère une expression vide comme valide', () => {
    expect(checkExpression('').valid).toBe(true);
    expect(checkExpression('   ').valid).toBe(true);
  });

  it('renvoie l’erreur sans lever', () => {
    const result = checkExpression('{a} = ');
    expect(result.valid).toBe(false);
    expect(result.error).toBeInstanceOf(ExpressionSyntaxError);
  });

  it('renvoie l’AST quand l’expression est valide', () => {
    expect(checkExpression('{a} = 1').node).toBeDefined();
  });
});

describe('cache d’AST', () => {
  it('renvoie la même instance pour une expression déjà analysée', () => {
    const first = parseExpression('{cache} = 1');
    const second = parseExpression('{cache} = 1');
    expect(second).toBe(first);
  });
});

describe('collectReferences', () => {
  it('remonte les noms de premier niveau', () => {
    const node = parseExpression('{a} = 1 and iif({b.c} > 2, {d}, 0) anyof [{e}]');
    expect([...collectReferences(node)].sort()).toEqual(['a', 'b', 'd', 'e']);
  });

  it('ne renvoie rien pour une expression constante', () => {
    expect(collectReferences(parseExpression('1 + 2')).size).toBe(0);
  });
});

describe('collectFunctionCalls', () => {
  it('remonte les fonctions, imbriquées comprises', () => {
    const node = parseExpression('iif({a}, round(sum({b}), 2), 0)');
    expect([...collectFunctionCalls(node)].sort()).toEqual(['iif', 'round', 'sum']);
  });
});
