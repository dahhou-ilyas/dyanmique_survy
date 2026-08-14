import { DEFAULT_LOCALE, type Locale, type LocalizedMap, type LocalizedString } from '../schema/types';

/**
 * Résout un texte multilingue vers une chaîne affichable.
 *
 * Ordre de repli : locale demandée → `default` → locale par défaut du package →
 * première traduction non vide. Une chaîne nue est renvoyée telle quelle.
 */
export function resolveText(text: LocalizedString | undefined, locale: Locale): string {
  if (text === undefined || text === null) return '';
  if (typeof text === 'string') return text;

  const exact = text[locale];
  if (exact) return exact;
  if (text.default) return text.default;

  const fallback = text[DEFAULT_LOCALE];
  if (fallback) return fallback;

  for (const value of Object.values(text)) {
    if (value) return value;
  }
  return '';
}

/** Idem, mais renvoie `undefined` si aucune traduction n'existe (au lieu d'une chaîne vide). */
export function resolveTextOrUndefined(
  text: LocalizedString | undefined,
  locale: Locale,
): string | undefined {
  const resolved = resolveText(text, locale);
  return resolved === '' ? undefined : resolved;
}

/**
 * Texte destiné à un **champ d'édition**, sans repli sur une autre langue.
 *
 * `resolveText` retombe volontiers sur une traduction voisine, ce qui est juste à
 * l'affichage mais faux dans un éditeur : vider le champ français y ferait
 * apparaître le texte anglais, et la frappe suivante s'y ajouterait. Une chaîne
 * nue est en revanche renvoyée telle quelle — c'est l'unique texte du sondage.
 */
export function resolveEditableText(
  text: LocalizedString | undefined,
  locale: Locale,
): string {
  if (text === undefined || text === null) return '';
  if (typeof text === 'string') return text;
  return text[locale] ?? text.default ?? '';
}

/** Normalise en table de traductions ; une chaîne nue devient la valeur `default`. */
export function toLocalizedMap(text: LocalizedString | undefined): LocalizedMap {
  if (text === undefined || text === null) return {};
  if (typeof text === 'string') return { default: text };
  return { ...text };
}

/**
 * Écrit une traduction dans une locale donnée.
 *
 * Une chaîne nue est d'abord promue en table (l'ancienne valeur devient `default`),
 * ce qui évite de perdre le texte existant lors de la première traduction.
 * Retombe sur une chaîne nue quand seul `default` subsiste : le JSON reste compact
 * tant que le sondage est monolingue.
 */
export function setLocalizedText(
  text: LocalizedString | undefined,
  locale: Locale,
  value: string,
): LocalizedString {
  const map = toLocalizedMap(text);

  if (value === '') {
    delete map[locale];
  } else {
    map[locale] = value;
  }

  const keys = Object.keys(map);
  if (keys.length === 0) return '';
  if (keys.length === 1 && keys[0] === 'default') return map.default ?? '';
  return map;
}

/** Vrai si le texte porte au moins une traduction non vide. */
export function isLocalizedTextEmpty(text: LocalizedString | undefined): boolean {
  if (text === undefined || text === null) return true;
  if (typeof text === 'string') return text.trim() === '';
  return Object.values(text).every((value) => !value || value.trim() === '');
}
