import { describe, expect, it } from 'vitest';
import {
  isLocalizedTextEmpty,
  resolveEditableText,
  resolveText,
  resolveTextOrUndefined,
  setLocalizedText,
  toLocalizedMap,
} from './resolveText';

describe('resolveText', () => {
  it('renvoie une chaîne nue telle quelle', () => {
    expect(resolveText('Bonjour', 'en')).toBe('Bonjour');
  });

  it('sélectionne la locale demandée', () => {
    expect(resolveText({ fr: 'Bonjour', en: 'Hello' }, 'en')).toBe('Hello');
  });

  it('retombe sur `default` quand la locale est absente', () => {
    expect(resolveText({ default: 'Hi', fr: 'Bonjour' }, 'en')).toBe('Hi');
  });

  it('retombe sur le français quand ni la locale ni `default` ne sont présents', () => {
    expect(resolveText({ fr: 'Bonjour' }, 'en')).toBe('Bonjour');
  });

  it('retombe sur la première traduction non vide en dernier recours', () => {
    expect(resolveText({ en: 'Hello' }, 'fr')).toBe('Hello');
  });

  it('renvoie une chaîne vide pour undefined', () => {
    expect(resolveText(undefined, 'fr')).toBe('');
  });

  it('ignore les traductions vides lors du repli', () => {
    expect(resolveText({ fr: '', en: 'Hello' }, 'fr')).toBe('Hello');
  });
});

describe('resolveTextOrUndefined', () => {
  it('renvoie undefined plutôt qu’une chaîne vide', () => {
    expect(resolveTextOrUndefined(undefined, 'fr')).toBeUndefined();
    expect(resolveTextOrUndefined({}, 'fr')).toBeUndefined();
    expect(resolveTextOrUndefined('x', 'fr')).toBe('x');
  });
});

describe('resolveEditableText', () => {
  it('renvoie une chaîne nue telle quelle', () => {
    expect(resolveEditableText('Bonjour', 'en')).toBe('Bonjour');
  });

  it('ne retombe jamais sur une autre langue', () => {
    // C'est la différence avec `resolveText` : vider le champ français ne doit
    // pas y faire apparaître le texte anglais, sans quoi la frappe s'y ajoute.
    expect(resolveEditableText({ en: 'Hello' }, 'fr')).toBe('');
  });

  it('accepte `default` comme valeur de la langue courante', () => {
    expect(resolveEditableText({ default: 'Bonjour' }, 'fr')).toBe('Bonjour');
  });

  it('préfère la traduction exacte à `default`', () => {
    expect(resolveEditableText({ default: 'Bonjour', en: 'Hello' }, 'en')).toBe('Hello');
  });
});

describe('toLocalizedMap', () => {
  it('promeut une chaîne nue en `default`', () => {
    expect(toLocalizedMap('Bonjour')).toEqual({ default: 'Bonjour' });
  });

  it('copie la table sans la partager', () => {
    const source = { fr: 'Bonjour' };
    const copy = toLocalizedMap(source);
    copy.fr = 'Salut';
    expect(source.fr).toBe('Bonjour');
  });
});

describe('setLocalizedText', () => {
  it('préserve le texte existant lors de la première traduction', () => {
    expect(setLocalizedText('Bonjour', 'en', 'Hello')).toEqual({
      default: 'Bonjour',
      en: 'Hello',
    });
  });

  it('met à jour une traduction existante', () => {
    expect(setLocalizedText({ fr: 'Bonjour', en: 'Hi' }, 'en', 'Hello')).toEqual({
      fr: 'Bonjour',
      en: 'Hello',
    });
  });

  it('supprime la traduction quand la valeur est vide', () => {
    expect(setLocalizedText({ fr: 'Bonjour', en: 'Hello' }, 'en', '')).toEqual({
      fr: 'Bonjour',
    });
  });

  it('retombe sur une chaîne nue quand seul `default` subsiste', () => {
    expect(setLocalizedText({ default: 'Bonjour', en: 'Hello' }, 'en', '')).toBe('Bonjour');
  });

  it('renvoie une chaîne vide quand plus rien ne subsiste', () => {
    expect(setLocalizedText({ fr: 'Bonjour' }, 'fr', '')).toBe('');
  });
});

describe('isLocalizedTextEmpty', () => {
  it.each([
    [undefined, true],
    ['', true],
    ['   ', true],
    [{}, true],
    [{ fr: '' }, true],
    ['x', false],
    [{ fr: 'Bonjour' }, false],
  ])('%o → %s', (input, expected) => {
    expect(isLocalizedTextEmpty(input as never)).toBe(expected);
  });
});
