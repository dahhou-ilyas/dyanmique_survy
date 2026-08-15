import { describe, expect, it, vi } from 'vitest';
import { evaluateCondition, evaluateExpression, tryEvaluateExpression } from './evaluate';

const FIXED_NOW = new Date('2026-06-15T12:00:00Z');

const evaluate = (expression: string, data: Record<string, unknown> = {}): unknown =>
  evaluateExpression(expression, { data, now: FIXED_NOW });

const condition = (
  expression: string,
  data: Record<string, unknown> = {},
  fallback = false,
): boolean => evaluateCondition(expression, { data, now: FIXED_NOW }, fallback);

describe('références', () => {
  it('lit une réponse', () => {
    expect(evaluate('{nom}', { nom: 'Dupont' })).toBe('Dupont');
  });

  it('renvoie undefined pour une question sans réponse', () => {
    expect(evaluate('{absent}')).toBeUndefined();
  });

  it('descend dans un chemin pointé', () => {
    expect(evaluate('{coord.ville}', { coord: { ville: 'Paris' } })).toBe('Paris');
  });

  it('indexe un tableau', () => {
    expect(evaluate('{liste[1]}', { liste: ['a', 'b', 'c'] })).toBe('b');
  });

  it('renvoie undefined sur un chemin qui traverse une valeur scalaire', () => {
    expect(evaluate('{nom.ville}', { nom: 'Dupont' })).toBeUndefined();
  });

  it('résout {item} depuis le contexte d’option', () => {
    expect(evaluateExpression('{item} = 2', { data: {}, item: 2, now: FIXED_NOW })).toBe(true);
  });
});

describe('égalité', () => {
  it.each([
    ["{a} = 'x'", { a: 'x' }, true],
    ["{a} = 'x'", { a: 'y' }, false],
    ['{a} = 5', { a: 5 }, true],
    // Le champ HTML rend une chaîne : la comparaison numérique doit rester vraie.
    ['{a} = 5', { a: '5' }, true],
    ['{a} >= 18', { a: '18' }, true],
    ['{a} = true', { a: true }, true],
    ['{a} <> 1', { a: 2 }, true],
    ['{a} != 1', { a: 1 }, false],
  ])('%s avec %o → %s', (expression, data, expected) => {
    expect(evaluate(expression, data)).toBe(expected);
  });

  it('considère null, undefined et chaîne vide comme équivalents', () => {
    expect(evaluate('{a} = {b}', { a: null, b: '' })).toBe(true);
    expect(evaluate('{a} = {b}', { a: undefined, b: null })).toBe(true);
  });

  it('distingue le vide d’une valeur renseignée', () => {
    expect(evaluate('{a} = {b}', { a: '', b: 'x' })).toBe(false);
  });

  it('compare les tableaux sans tenir compte de l’ordre', () => {
    expect(evaluate('{a} = {b}', { a: ['x', 'y'], b: ['y', 'x'] })).toBe(true);
    expect(evaluate('{a} = {b}', { a: ['x'], b: ['x', 'y'] })).toBe(false);
  });
});

describe('comparaisons ordonnées', () => {
  it.each([
    ['{a} > 10', { a: 11 }, true],
    ['{a} > 10', { a: 10 }, false],
    ['{a} <= 10', { a: 10 }, true],
    ['{a} < 10', { a: '9' }, true],
  ])('%s avec %o → %s', (expression, data, expected) => {
    expect(evaluate(expression, data)).toBe(expected);
  });

  it('compare des dates ISO', () => {
    expect(evaluate("{d} > '2026-01-01'", { d: '2026-06-01' })).toBe(true);
    expect(evaluate("{d} < '2026-01-01'", { d: '2026-06-01' })).toBe(false);
  });

  it('renvoie faux plutôt qu’un résultat arbitraire sur des opérandes incomparables', () => {
    expect(evaluate('{a} > 10', { a: undefined })).toBe(false);
    expect(evaluate('{a} > {b}', { a: 'texte', b: 5 })).toBe(false);
  });
});

describe('opérateurs d’ensemble', () => {
  it('contains sur une chaîne', () => {
    expect(evaluate("{a} contains 'ell'", { a: 'hello' })).toBe(true);
    expect(evaluate("{a} contains 'xyz'", { a: 'hello' })).toBe(false);
  });

  it('contains sur un tableau', () => {
    expect(evaluate("{a} contains 'x'", { a: ['x', 'y'] })).toBe(true);
    expect(evaluate("{a} contains 'z'", { a: ['x', 'y'] })).toBe(false);
  });

  it('l’alias *= est équivalent à contains', () => {
    expect(evaluate("{a} *= 'x'", { a: ['x'] })).toBe(true);
  });

  it('notcontains inverse contains', () => {
    expect(evaluate("{a} notcontains 'z'", { a: ['x', 'y'] })).toBe(true);
  });

  it('anyof exige au moins une intersection', () => {
    expect(evaluate("{a} anyof ['x', 'z']", { a: ['x', 'y'] })).toBe(true);
    expect(evaluate("{a} anyof ['z']", { a: ['x', 'y'] })).toBe(false);
    expect(evaluate("{a} anyof ['x']", { a: 'x' })).toBe(true);
  });

  it('allof exige toutes les valeurs', () => {
    expect(evaluate("{a} allof ['x', 'y']", { a: ['x', 'y', 'z'] })).toBe(true);
    expect(evaluate("{a} allof ['x', 'w']", { a: ['x', 'y'] })).toBe(false);
  });

  it('noneof exige aucune intersection', () => {
    expect(evaluate("{a} noneof ['z']", { a: ['x', 'y'] })).toBe(true);
    expect(evaluate("{a} noneof ['x']", { a: ['x', 'y'] })).toBe(false);
  });

  it('contains est faux sur une valeur vide', () => {
    expect(evaluate("{a} contains 'x'", { a: [] })).toBe(false);
    expect(evaluate("{a} contains 'x'", {})).toBe(false);
  });
});

describe('empty / notempty', () => {
  it.each([
    ['{a} empty', {}, true],
    ['{a} empty', { a: '' }, true],
    ['{a} empty', { a: '  ' }, true],
    ['{a} empty', { a: [] }, true],
    ['{a} empty', { a: 0 }, false],
    ['{a} empty', { a: false }, false],
    ['{a} notempty', { a: 'x' }, true],
    ['{a} notempty', { a: [] }, false],
  ])('%s avec %o → %s', (expression, data, expected) => {
    expect(evaluate(expression, data)).toBe(expected);
  });
});

describe('logique booléenne', () => {
  it('and et or', () => {
    expect(evaluate('{a} and {b}', { a: true, b: true })).toBe(true);
    expect(evaluate('{a} and {b}', { a: true, b: false })).toBe(false);
    expect(evaluate('{a} or {b}', { a: false, b: true })).toBe(true);
  });

  it('court-circuite le membre droit', () => {
    // `fonctionInconnue()` lèverait si elle était évaluée.
    expect(evaluate('false and fonctionInconnue()')).toBe(false);
    expect(evaluate('true or fonctionInconnue()')).toBe(true);
  });

  it('traite un tableau vide comme faux', () => {
    expect(evaluate('{a} and true', { a: [] })).toBe(false);
    expect(evaluate('{a} and true', { a: ['x'] })).toBe(true);
  });

  it('nie une valeur', () => {
    expect(evaluate('!{a}', { a: false })).toBe(true);
    expect(evaluate('not {a}', { a: 'x' })).toBe(false);
  });
});

describe('arithmétique', () => {
  it.each([
    ['1 + 2', 3],
    ['10 - 4', 6],
    ['3 * 4', 12],
    ['10 / 4', 2.5],
    ['10 % 3', 1],
    ['2 ^ 10', 1024],
    ['-5 + 2', -3],
  ])('%s → %s', (expression, expected) => {
    expect(evaluate(expression)).toBe(expected);
  });

  it('concatène dès qu’un opérande est du texte', () => {
    expect(evaluate("{p} + ' ' + {n}", { p: 'Jean', n: 'Dupont' })).toBe('Jean Dupont');
  });

  it('additionne des chaînes numériques', () => {
    expect(evaluate('{a} + {b}', { a: '2', b: '3' })).toBe(5);
  });

  it('renvoie undefined plutôt qu’Infinity sur une division par zéro', () => {
    expect(evaluate('10 / 0')).toBeUndefined();
    expect(evaluate('10 % 0')).toBeUndefined();
  });

  it('renvoie undefined sur des opérandes non numériques', () => {
    expect(evaluate('{a} * 2', { a: 'texte' })).toBeUndefined();
  });
});

describe('fonctions', () => {
  it('iif choisit la branche', () => {
    expect(evaluate("iif({a} > 5, 'grand', 'petit')", { a: 10 })).toBe('grand');
    expect(evaluate("iif({a} > 5, 'grand', 'petit')", { a: 1 })).toBe('petit');
  });

  it('today est déterministe et décalable', () => {
    expect(evaluate('today()')).toBe('2026-06-15');
    expect(evaluate('today(1)')).toBe('2026-06-16');
    expect(evaluate('today(-15)')).toBe('2026-05-31');
  });

  it('age compte les années révolues', () => {
    expect(evaluate("age('1990-06-15')")).toBe(36);
    // L'anniversaire n'a pas encore eu lieu cette année.
    expect(evaluate("age('1990-06-16')")).toBe(35);
  });

  it('extrait les composants d’une date', () => {
    expect(evaluate("year('2026-03-14')")).toBe(2026);
    expect(evaluate("month('2026-03-14')")).toBe(3);
    expect(evaluate("day('2026-03-14')")).toBe(14);
  });

  it('dateDiff selon l’intervalle', () => {
    expect(evaluate("dateDiff('2026-01-01', '2026-01-31', 'days')")).toBe(30);
    expect(evaluate("dateDiff('2026-01-01', '2026-04-01', 'months')")).toBe(3);
    expect(evaluate("dateDiff('2020-01-01', '2026-01-01', 'years')")).toBe(6);
  });

  it('dateAdd décale une date', () => {
    expect(evaluate("dateAdd('2026-01-31', 1, 'days')")).toBe('2026-02-01');
    expect(evaluate("dateAdd('2026-01-01', 1, 'years')")).toBe('2027-01-01');
  });

  it('agrège des nombres', () => {
    expect(evaluate('sum(1, 2, 3)')).toBe(6);
    expect(evaluate('min(5, 2, 8)')).toBe(2);
    expect(evaluate('max(5, 2, 8)')).toBe(8);
    expect(evaluate('avg(2, 4)')).toBe(3);
  });

  it('aplatit un argument tableau pour les agrégats', () => {
    expect(evaluate('sum({notes})', { notes: [1, 2, 3] })).toBe(6);
  });

  it('arrondit avec précision', () => {
    expect(evaluate('round(3.14159, 2)')).toBe(3.14);
    expect(evaluate('round(3.7)')).toBe(4);
    expect(evaluate('trunc(3.789, 1)')).toBe(3.7);
  });

  it('manipule du texte', () => {
    expect(evaluate("upper('abc')")).toBe('ABC');
    expect(evaluate("lower('ABC')")).toBe('abc');
    expect(evaluate("trim('  x  ')")).toBe('x');
    expect(evaluate("concat('a', 'b', 'c')")).toBe('abc');
    expect(evaluate("len('abcd')")).toBe(4);
    expect(evaluate('len({a})', { a: ['x', 'y'] })).toBe(2);
  });

  it('compte les valeurs renseignées', () => {
    expect(evaluate('count({a})', { a: ['x', '', 'y'] })).toBe(2);
  });

  it('renvoie undefined sur une date invalide', () => {
    expect(evaluate("age('pas-une-date')")).toBeUndefined();
    expect(evaluate("year('')")).toBeUndefined();
  });

  it('lève sur une fonction inconnue', () => {
    expect(() => evaluate('fonctionInconnue(1)')).toThrow(/Fonction inconnue/);
  });

  it('accepte une fonction personnalisée', () => {
    const result = evaluateExpression('double(21)', {
      data: {},
      functions: { double: (args) => Number(args[0]) * 2 },
    });
    expect(result).toBe(42);
  });
});

describe('evaluateCondition', () => {
  it('retombe sur la valeur par défaut quand l’expression est absente', () => {
    expect(evaluateCondition(undefined, { data: {} }, true)).toBe(true);
    expect(evaluateCondition('', { data: {} }, false)).toBe(false);
  });

  it('retombe sur la valeur par défaut quand l’expression est cassée', () => {
    expect(condition('{a} = ', {}, true)).toBe(true);
    expect(condition('{a} = ', {}, false)).toBe(false);
  });

  it('signale l’erreur via onError sans lever', () => {
    const onError = vi.fn();
    evaluateCondition('{a} = ', { data: {}, onError }, true);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('coerce le résultat en booléen', () => {
    expect(condition('{a}', { a: 'texte' })).toBe(true);
    expect(condition('{a}', { a: 0 })).toBe(false);
  });
});

describe('tryEvaluateExpression', () => {
  it('renvoie undefined au lieu de lever', () => {
    const onError = vi.fn();
    expect(tryEvaluateExpression('inconnue()', { data: {}, onError })).toBeUndefined();
    expect(onError).toHaveBeenCalledOnce();
  });
});

describe('scénarios métier du cahier des charges', () => {
  it('affiche la question de motif quand la satisfaction est basse', () => {
    expect(condition('{satisfaction} <= 3', { satisfaction: 2 })).toBe(true);
    expect(condition('{satisfaction} <= 3', { satisfaction: 5 })).toBe(false);
  });

  it('cible les détracteurs NPS', () => {
    expect(condition('{recommandation} < 7', { recommandation: 4 })).toBe(true);
  });

  it('combine plusieurs canaux cochés', () => {
    expect(
      condition("{canaux} anyof ['app', 'web'] and {segment} = 'pro'", {
        canaux: ['agence', 'web'],
        segment: 'pro',
      }),
    ).toBe(true);
  });

  it('rend une question obligatoire pour les majeurs', () => {
    expect(condition('age({naissance}) >= 18', { naissance: '1990-01-01' })).toBe(true);
    expect(condition('age({naissance}) >= 18', { naissance: '2020-01-01' })).toBe(false);
  });
});
