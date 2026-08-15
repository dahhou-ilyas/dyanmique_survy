import { describe, expect, it } from 'vitest';
import { BUILTIN_FUNCTION_NAMES, FUNCTION_SIGNATURES, builtinFunctions } from './functions';

const CONTEXT = { now: new Date('2026-06-15T12:00:00Z') };

const call = (name: string, ...args: unknown[]): unknown => builtinFunctions[name]!(args, CONTEXT);

describe('intervalles de date', () => {
  it.each([
    ['day', 1, '2026-06-16'],
    ['days', 2, '2026-06-17'],
    ['month', 1, '2026-07-15'],
    ['months', 2, '2026-08-15'],
    ['year', 1, '2027-06-15'],
    ['years', 2, '2028-06-15'],
  ])('dateAdd avec « %s »', (interval, amount, expected) => {
    expect(call('dateAdd', '2026-06-15', amount, interval)).toBe(expected);
  });

  it('retombe sur les jours pour un intervalle inconnu', () => {
    expect(call('dateAdd', '2026-06-15', 1, 'fortnight')).toBe('2026-06-16');
  });

  it('décale aussi en heures et minutes', () => {
    expect(call('dateAdd', '2026-06-15T00:00:00Z', 25, 'hours')).toBe('2026-06-16');
    expect(call('dateAdd', '2026-06-15T23:30:00Z', 45, 'minutes')).toBe('2026-06-16');
  });

  it('dateDiff en heures et minutes', () => {
    expect(call('dateDiff', '2026-06-15T00:00:00Z', '2026-06-15T06:30:00Z', 'hours')).toBe(6);
    expect(call('dateDiff', '2026-06-15T00:00:00Z', '2026-06-15T00:45:00Z', 'minutes')).toBe(45);
  });

  it('dateDiff sans intervalle compte les jours', () => {
    expect(call('dateDiff', '2026-06-01', '2026-06-15')).toBe(14);
  });

  it('renvoie undefined si une borne est illisible', () => {
    expect(call('dateAdd', 'nawak', 1, 'days')).toBeUndefined();
    expect(call('dateAdd', '2026-06-15', 'nawak', 'days')).toBeUndefined();
    expect(call('dateDiff', 'nawak', '2026-06-15', 'days')).toBeUndefined();
    expect(call('dateDiff', '2026-06-15', 'nawak', 'days')).toBeUndefined();
  });
});

describe('composants de date', () => {
  it('weekday suit la convention de Date (0 = dimanche)', () => {
    // 2026-06-15 est un lundi.
    expect(call('weekday', '2026-06-15')).toBe(1);
  });

  it('now renvoie un horodatage ISO', () => {
    expect(call('now')).toBe('2026-06-15T12:00:00.000Z');
  });

  it.each(['year', 'month', 'day', 'weekday'])(
    '%s renvoie undefined sur une date invalide',
    (name) => {
      expect(call(name, 'nawak')).toBeUndefined();
    },
  );
});

describe('âge', () => {
  it('compte une année de plus le jour de l’anniversaire', () => {
    expect(call('age', '2000-06-15')).toBe(26);
    expect(call('age', '2000-06-16')).toBe(25);
    expect(call('age', '2000-07-01')).toBe(25);
    expect(call('age', '2000-05-31')).toBe(26);
  });
});

describe('agrégats', () => {
  it('renvoie undefined sur une liste sans nombre', () => {
    expect(call('min', 'a', 'b')).toBeUndefined();
    expect(call('max')).toBeUndefined();
    expect(call('avg', [])).toBeUndefined();
  });

  it('ignore les valeurs non numériques', () => {
    expect(call('sum', 1, 'abc', 2)).toBe(3);
  });

  it('count ne compte que les valeurs renseignées', () => {
    expect(call('count', ['a', '', null, 'b'])).toBe(2);
    expect(call('count')).toBe(0);
  });
});

describe('arrondis et valeurs absolues', () => {
  it.each([
    ['abs', -5, 5],
    ['ceil', 1.2, 2],
    ['floor', 1.8, 1],
    ['round', 1.5, 2],
    ['trunc', 1.9, 1],
  ])('%s(%o) → %o', (name, value, expected) => {
    expect(call(name, value)).toBe(expected);
  });

  it.each(['abs', 'ceil', 'floor', 'round', 'trunc'])(
    '%s renvoie undefined sur une valeur non numérique',
    (name) => {
      expect(call(name, 'abc')).toBeUndefined();
    },
  );
});

describe('texte', () => {
  it('len sur une valeur vide vaut 0', () => {
    expect(call('len', undefined)).toBe(0);
    expect(call('len', '')).toBe(0);
  });

  it('isEmpty et isNotEmpty', () => {
    expect(call('isEmpty', '')).toBe(true);
    expect(call('isNotEmpty', 'x')).toBe(true);
  });
});

describe('iif', () => {
  it('renvoie undefined quand la branche « sinon » est absente', () => {
    expect(call('iif', false, 'a')).toBeUndefined();
  });
});

describe('métadonnées exposées à l’éditeur', () => {
  it('chaque fonction intégrée a une signature documentée', () => {
    for (const name of BUILTIN_FUNCTION_NAMES) {
      expect(FUNCTION_SIGNATURES[name], `signature manquante pour ${name}`).toBeDefined();
    }
  });
});
