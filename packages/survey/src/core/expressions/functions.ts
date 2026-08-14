import {
  formatIsoDate,
  isEmpty,
  toArray,
  toBoolean,
  toDate,
  toNumber,
  toStringValue,
} from './values';

/** Contexte transmis aux fonctions — `now` est injectable pour rendre les tests déterministes. */
export interface FunctionContext {
  now: Date;
}

export type ExpressionFunction = (args: unknown[], context: FunctionContext) => unknown;

type DateInterval = 'days' | 'months' | 'years' | 'hours' | 'minutes';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function numericArgs(args: unknown[]): number[] {
  // Un argument tableau est aplati : `sum({notes})` doit fonctionner sur une
  // question à choix multiple aussi bien que sur une liste d'arguments.
  return args
    .flatMap((argument) => (Array.isArray(argument) ? argument : [argument]))
    .map(toNumber)
    .filter((value): value is number => value !== undefined);
}

function normalizeInterval(value: unknown): DateInterval {
  const raw = toStringValue(value).toLowerCase();
  switch (raw) {
    case 'day':
    case 'days':
      return 'days';
    case 'month':
    case 'months':
      return 'months';
    case 'year':
    case 'years':
      return 'years';
    case 'hour':
    case 'hours':
      return 'hours';
    case 'minute':
    case 'minutes':
      return 'minutes';
    default:
      return 'days';
  }
}

function addInterval(date: Date, amount: number, interval: DateInterval): Date {
  const result = new Date(date.getTime());
  switch (interval) {
    case 'days':
      result.setUTCDate(result.getUTCDate() + amount);
      break;
    case 'months':
      result.setUTCMonth(result.getUTCMonth() + amount);
      break;
    case 'years':
      result.setUTCFullYear(result.getUTCFullYear() + amount);
      break;
    case 'hours':
      result.setUTCHours(result.getUTCHours() + amount);
      break;
    case 'minutes':
      result.setUTCMinutes(result.getUTCMinutes() + amount);
      break;
  }
  return result;
}

/** Âge révolu en années — l'anniversaire du jour compte comme atteint. */
function yearsBetween(from: Date, to: Date): number {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const monthDelta = to.getUTCMonth() - from.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && to.getUTCDate() < from.getUTCDate())) {
    years -= 1;
  }
  return years;
}

export const builtinFunctions: Record<string, ExpressionFunction> = {
  /* ----------------------------- Conditionnel ---------------------------- */

  iif: (args) => (toBoolean(args[0]) ? args[1] : args[2]),

  /* -------------------------------- Dates -------------------------------- */

  /** Date du jour au format `YYYY-MM-DD`, décalée de `offset` jours si fourni. */
  today: (args, context) => {
    const offset = toNumber(args[0]) ?? 0;
    return formatIsoDate(addInterval(context.now, offset, 'days'));
  },

  now: (_args, context) => context.now.toISOString(),

  age: (args, context) => {
    const birthDate = toDate(args[0]);
    if (!birthDate) return undefined;
    return yearsBetween(birthDate, context.now);
  },

  year: (args) => toDate(args[0])?.getUTCFullYear(),
  month: (args) => {
    const date = toDate(args[0]);
    return date ? date.getUTCMonth() + 1 : undefined;
  },
  day: (args) => toDate(args[0])?.getUTCDate(),
  /** 0 = dimanche … 6 = samedi, comme `Date.prototype.getDay`. */
  weekday: (args) => toDate(args[0])?.getUTCDay(),

  dateAdd: (args) => {
    const date = toDate(args[0]);
    const amount = toNumber(args[1]);
    if (!date || amount === undefined) return undefined;
    return formatIsoDate(addInterval(date, amount, normalizeInterval(args[2])));
  },

  dateDiff: (args) => {
    const from = toDate(args[0]);
    const to = toDate(args[1]);
    if (!from || !to) return undefined;
    const interval = normalizeInterval(args[2]);
    switch (interval) {
      case 'years':
        return yearsBetween(from, to);
      case 'months':
        return (
          (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
          (to.getUTCMonth() - from.getUTCMonth())
        );
      case 'hours':
        return Math.trunc((to.getTime() - from.getTime()) / (60 * 60 * 1000));
      case 'minutes':
        return Math.trunc((to.getTime() - from.getTime()) / (60 * 1000));
      case 'days':
      default:
        return Math.round((to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY);
    }
  },

  /* ------------------------------ Numérique ------------------------------ */

  sum: (args) => numericArgs(args).reduce((total, value) => total + value, 0),
  min: (args) => {
    const numbers = numericArgs(args);
    return numbers.length === 0 ? undefined : Math.min(...numbers);
  },
  max: (args) => {
    const numbers = numericArgs(args);
    return numbers.length === 0 ? undefined : Math.max(...numbers);
  },
  avg: (args) => {
    const numbers = numericArgs(args);
    if (numbers.length === 0) return undefined;
    return numbers.reduce((total, value) => total + value, 0) / numbers.length;
  },
  count: (args) => args.flatMap((argument) => toArray(argument)).filter((v) => !isEmpty(v)).length,

  abs: (args) => {
    const value = toNumber(args[0]);
    return value === undefined ? undefined : Math.abs(value);
  },
  ceil: (args) => {
    const value = toNumber(args[0]);
    return value === undefined ? undefined : Math.ceil(value);
  },
  floor: (args) => {
    const value = toNumber(args[0]);
    return value === undefined ? undefined : Math.floor(value);
  },
  round: (args) => {
    const value = toNumber(args[0]);
    if (value === undefined) return undefined;
    const precision = toNumber(args[1]) ?? 0;
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
  },
  trunc: (args) => {
    const value = toNumber(args[0]);
    if (value === undefined) return undefined;
    const precision = toNumber(args[1]) ?? 0;
    const factor = 10 ** precision;
    return Math.trunc(value * factor) / factor;
  },

  /* -------------------------------- Texte -------------------------------- */

  len: (args) => {
    const value = args[0];
    if (Array.isArray(value)) return value.length;
    if (isEmpty(value)) return 0;
    return toStringValue(value).length;
  },
  upper: (args) => toStringValue(args[0]).toUpperCase(),
  lower: (args) => toStringValue(args[0]).toLowerCase(),
  trim: (args) => toStringValue(args[0]).trim(),
  concat: (args) => args.map(toStringValue).join(''),

  /* ------------------------------- Divers -------------------------------- */

  isEmpty: (args) => isEmpty(args[0]),
  isNotEmpty: (args) => !isEmpty(args[0]),
};

/** Noms disponibles — alimente l'autocomplétion de l'éditeur d'expressions. */
export const BUILTIN_FUNCTION_NAMES: string[] = Object.keys(builtinFunctions);

/** Signature affichée dans l'aide de l'éditeur du builder. */
export const FUNCTION_SIGNATURES: Record<string, string> = {
  iif: 'iif(condition, siVrai, siFaux)',
  today: 'today(décalageEnJours?)',
  now: 'now()',
  age: 'age(dateDeNaissance)',
  year: 'year(date)',
  month: 'month(date)',
  day: 'day(date)',
  weekday: 'weekday(date)',
  dateAdd: "dateAdd(date, nombre, 'days' | 'months' | 'years')",
  dateDiff: "dateDiff(dateDébut, dateFin, 'days' | 'months' | 'years')",
  sum: 'sum(valeur, …)',
  min: 'min(valeur, …)',
  max: 'max(valeur, …)',
  avg: 'avg(valeur, …)',
  count: 'count(valeur, …)',
  abs: 'abs(nombre)',
  ceil: 'ceil(nombre)',
  floor: 'floor(nombre)',
  round: 'round(nombre, décimales?)',
  trunc: 'trunc(nombre, décimales?)',
  len: 'len(texteOuListe)',
  upper: 'upper(texte)',
  lower: 'lower(texte)',
  trim: 'trim(texte)',
  concat: 'concat(texte, …)',
  isEmpty: 'isEmpty(valeur)',
  isNotEmpty: 'isNotEmpty(valeur)',
};
