import { describe, expect, it } from 'vitest';
import {
  compareValues,
  formatIsoDate,
  isEmpty,
  looseEquals,
  toArray,
  toBoolean,
  toDate,
  toNumber,
  toStringValue,
} from './values';

describe('isEmpty', () => {
  it.each([
    [undefined, true],
    [null, true],
    ['', true],
    ['   ', true],
    [[], true],
    [Number.NaN, true],
    [0, false],
    [false, false],
    ['x', false],
    [['x'], false],
    [{}, false],
  ])('%o → %s', (value, expected) => {
    expect(isEmpty(value)).toBe(expected);
  });
});

describe('toNumber', () => {
  it.each([
    [5, 5],
    ['5', 5],
    [' 5.5 ', 5.5],
    [true, 1],
    [false, 0],
    ['abc', undefined],
    ['', undefined],
    [null, undefined],
    [[], undefined],
    [Number.NaN, undefined],
  ])('%o → %o', (value, expected) => {
    expect(toNumber(value)).toBe(expected);
  });
});

describe('toBoolean', () => {
  it.each([
    [true, true],
    [false, false],
    [[], false],
    [['x'], true],
    ['', false],
    ['false', false],
    ['x', true],
    [0, false],
    [1, true],
    [null, false],
    [{}, true],
  ])('%o → %s', (value, expected) => {
    expect(toBoolean(value)).toBe(expected);
  });
});

describe('toArray', () => {
  it('emballe les scalaires et laisse les tableaux', () => {
    expect(toArray('x')).toEqual(['x']);
    expect(toArray(['x'])).toEqual(['x']);
    expect(toArray(undefined)).toEqual([]);
    expect(toArray(null)).toEqual([]);
  });
});

describe('toStringValue', () => {
  it('joint les tableaux et neutralise le vide', () => {
    expect(toStringValue(['a', 'b'])).toBe('a, b');
    expect(toStringValue(undefined)).toBe('');
    expect(toStringValue(42)).toBe('42');
  });
});

describe('toDate', () => {
  it('accepte une date ISO nue', () => {
    expect(formatIsoDate(toDate('2026-03-14')!)).toBe('2026-03-14');
  });

  it('ancre une date nue à midi UTC pour ne pas basculer de jour selon le fuseau', () => {
    expect(toDate('2026-03-14')!.getUTCHours()).toBe(12);
  });

  it('accepte un horodatage ISO complet', () => {
    expect(toDate('2026-03-14T08:30:00Z')?.getUTCHours()).toBe(8);
  });

  it('accepte un objet Date et un timestamp', () => {
    const date = new Date('2026-03-14T00:00:00Z');
    expect(toDate(date)).toBe(date);
    expect(toDate(date.getTime())?.getTime()).toBe(date.getTime());
  });

  it.each([['abc'], [''], [null], [{}], [new Date('nawak')]])('refuse %o', (value) => {
    expect(toDate(value)).toBeUndefined();
  });
});

describe('looseEquals', () => {
  it('assimile toutes les formes de vide', () => {
    expect(looseEquals(null, undefined)).toBe(true);
    expect(looseEquals('', null)).toBe(true);
    expect(looseEquals([], undefined)).toBe(true);
  });

  it('compare nombre et chaîne numérique', () => {
    expect(looseEquals(5, '5')).toBe(true);
    expect(looseEquals(5, '6')).toBe(false);
  });

  it('compare les booléens à leurs équivalents', () => {
    expect(looseEquals(true, 'true')).toBe(true);
    expect(looseEquals(false, 0)).toBe(true);
  });

  it('compare les tableaux comme des ensembles', () => {
    expect(looseEquals(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(looseEquals(['a', 'a'], ['a', 'b'])).toBe(false);
    expect(looseEquals(['a'], 'a')).toBe(true);
  });
});

describe('compareValues', () => {
  it('ordonne les nombres', () => {
    expect(compareValues(1, 2)).toBe(-1);
    expect(compareValues(2, 1)).toBe(1);
    expect(compareValues(2, 2)).toBe(0);
  });

  it('ordonne les dates', () => {
    expect(compareValues('2026-01-01', '2026-06-01')).toBe(-1);
  });

  it('ordonne les chaînes', () => {
    expect(compareValues('a', 'b')).toBe(-1);
  });

  it('renvoie undefined sur des opérandes incomparables', () => {
    expect(compareValues(undefined, 1)).toBeUndefined();
    expect(compareValues({}, 1)).toBeUndefined();
  });
});

describe('formatIsoDate', () => {
  it('complète les zéros', () => {
    expect(formatIsoDate(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
  });
});
