/**
 * Coercitions partagées par le parseur, l'évaluateur et les fonctions.
 *
 * Les valeurs manipulées viennent de champs HTML (donc souvent des chaînes) et de
 * la base (donc typées). Centraliser les conversions ici évite que chaque opérateur
 * invente ses propres règles — première source d'incohérences dans ce genre de moteur.
 */

/** `null`, `undefined`, chaîne vide ou blanche, tableau vide, `NaN`. */
export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'number') return Number.isNaN(value);
  return false;
}

/** Conversion numérique stricte : renvoie `undefined` plutôt que `NaN`. */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isNaN(value) ? undefined : value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

export function toStringValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(toStringValue).join(', ');
  return String(value);
}

/**
 * Vérité d'une valeur dans un contexte conditionnel.
 * Un tableau vide est faux (utile pour `{cases} && …` sur une question à choix multiple),
 * là où JavaScript le considérerait vrai.
 */
export function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '' && value.toLowerCase() !== 'false';
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  return true;
}

/** Emballe une valeur en tableau — un scalaire devient un singleton, le vide un tableau vide. */
export function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/;

/**
 * Analyse une date. Accepte les chaînes ISO (`YYYY-MM-DD`), les `Date` et les
 * timestamps. Une date nue est ancrée à midi UTC : décaler de quelques heures
 * évite qu'un fuseau négatif ne fasse basculer la date d'un jour.
 */
export function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'number') {
    const fromTimestamp = new Date(value);
    return Number.isNaN(fromTimestamp.getTime()) ? undefined : fromTimestamp;
  }
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (ISO_DATE.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

/** Formate une `Date` en `YYYY-MM-DD` — format de stockage des questions de type date. */
export function formatIsoDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Égalité utilisée par `=` et `!=`.
 *
 * - `null`, `undefined` et chaîne vide sont équivalents : une question sans réponse
 *   se compare de la même façon quelle que soit la façon dont le vide est arrivé.
 * - Un nombre et une chaîne numérique sont comparés numériquement : le champ HTML
 *   rend « 18 » là où la règle est écrite `>= 18`.
 * - Deux tableaux sont égaux s'ils contiennent le même ensemble de valeurs, sans
 *   considération d'ordre — l'ordre de cochage de cases n'a pas de sens métier.
 */
export function looseEquals(left: unknown, right: unknown): boolean {
  if (isEmpty(left) && isEmpty(right)) return true;
  if (isEmpty(left) || isEmpty(right)) return false;

  if (Array.isArray(left) || Array.isArray(right)) {
    const leftArray = toArray(left);
    const rightArray = toArray(right);
    if (leftArray.length !== rightArray.length) return false;
    const remaining = [...rightArray];
    for (const item of leftArray) {
      const index = remaining.findIndex((candidate) => looseEquals(item, candidate));
      if (index === -1) return false;
      remaining.splice(index, 1);
    }
    return true;
  }

  if (typeof left === typeof right) return left === right;

  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (leftNumber !== undefined && rightNumber !== undefined) return leftNumber === rightNumber;

  if (typeof left === 'boolean' || typeof right === 'boolean') {
    return toBoolean(left) === toBoolean(right);
  }

  return toStringValue(left) === toStringValue(right);
}

/**
 * Comparaison ordonnée utilisée par `<`, `>`, `<=`, `>=`.
 * Renvoie `undefined` quand les opérandes ne sont pas comparables — l'opérateur
 * produit alors `false` plutôt qu'un résultat arbitraire.
 */
export function compareValues(left: unknown, right: unknown): number | undefined {
  if (isEmpty(left) || isEmpty(right)) return undefined;

  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (leftNumber !== undefined && rightNumber !== undefined) {
    return leftNumber === rightNumber ? 0 : leftNumber < rightNumber ? -1 : 1;
  }

  const leftDate = toDate(left);
  const rightDate = toDate(right);
  if (leftDate && rightDate) {
    const difference = leftDate.getTime() - rightDate.getTime();
    return difference === 0 ? 0 : difference < 0 ? -1 : 1;
  }

  if (typeof left === 'string' && typeof right === 'string') {
    return left === right ? 0 : left < right ? -1 : 1;
  }

  return undefined;
}
