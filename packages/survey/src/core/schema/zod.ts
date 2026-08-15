import { z } from 'zod';
import { LOCALES, type SurveyDefinition, type SurveyElement } from './types';

/**
 * Validation de forme du JSON de sondage.
 *
 * Zod ne contrôle que la structure. Les règles sémantiques — unicité des `name`,
 * expressions syntaxiquement valides, références existantes — sont vérifiées par
 * `validateSurveyDefinition` (module `validation/`), qui produit des diagnostics
 * exploitables par le builder.
 */

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

const localeSchema = z.enum(LOCALES);

const localizedMapSchema = z
  .object({
    default: z.string().optional(),
    fr: z.string().optional(),
    en: z.string().optional(),
  })
  .strict();

const localizedStringSchema = z.union([z.string(), localizedMapSchema]);

/**
 * Un `name` sert de clé de réponse et d'identifiant dans les expressions `{name}`.
 * Le jeu de caractères est donc restreint pour rester utilisable partout
 * (JSON, colonnes de reporting, parseur d'expressions).
 */
const nameSchema = z
  .string()
  .min(1, 'Le nom est obligatoire')
  .max(64, 'Le nom ne doit pas dépasser 64 caractères')
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    'Le nom doit commencer par une lettre ou « _ » et ne contenir que lettres, chiffres et « _ »',
  );

const idSchema = z.string().min(1);
const expressionSchema = z.string();

/* -------------------------------------------------------------------------- */
/* Validateurs                                                                */
/* -------------------------------------------------------------------------- */

const validatorTextField = { text: localizedStringSchema.optional() };

const validatorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('email'), ...validatorTextField }),
  z.object({ type: z.literal('regex'), regex: z.string(), ...validatorTextField }),
  z.object({
    type: z.literal('numeric'),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    ...validatorTextField,
  }),
  z.object({
    type: z.literal('text'),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    ...validatorTextField,
  }),
  z.object({ type: z.literal('expression'), expression: expressionSchema, ...validatorTextField }),
]);

/* -------------------------------------------------------------------------- */
/* Choix                                                                      */
/* -------------------------------------------------------------------------- */

const choiceSchema = z.object({
  value: z.union([z.string(), z.number()]),
  text: localizedStringSchema.optional(),
  visibleIf: expressionSchema.optional(),
});

/* -------------------------------------------------------------------------- */
/* Questions                                                                  */
/* -------------------------------------------------------------------------- */

const baseQuestionFields = {
  id: idSchema,
  name: nameSchema,
  title: localizedStringSchema,
  description: localizedStringSchema.optional(),
  isRequired: z.boolean().optional(),
  requiredErrorText: localizedStringSchema.optional(),
  visibleIf: expressionSchema.optional(),
  enableIf: expressionSchema.optional(),
  requiredIf: expressionSchema.optional(),
  defaultValue: z.unknown().optional(),
  validators: z.array(validatorSchema).optional(),
  readOnly: z.boolean().optional(),
};

const choiceQuestionFields = {
  ...baseQuestionFields,
  choices: z.array(choiceSchema),
  choicesVisibleIf: expressionSchema.optional(),
  hasOther: z.boolean().optional(),
  otherText: localizedStringSchema.optional(),
  otherPlaceholder: localizedStringSchema.optional(),
};

const colCountSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

const questionSchemas = [
  z.object({
    ...baseQuestionFields,
    type: z.literal('text'),
    inputType: z.enum(['text', 'email', 'tel', 'url', 'password']).optional(),
    placeholder: localizedStringSchema.optional(),
    maxLength: z.number().int().positive().optional(),
  }),
  z.object({
    ...baseQuestionFields,
    type: z.literal('comment'),
    placeholder: localizedStringSchema.optional(),
    rows: z.number().int().positive().optional(),
    maxLength: z.number().int().positive().optional(),
    showCharacterCounter: z.boolean().optional(),
  }),
  z.object({
    ...choiceQuestionFields,
    type: z.literal('radiogroup'),
    colCount: colCountSchema.optional(),
  }),
  z.object({
    ...choiceQuestionFields,
    type: z.literal('checkbox'),
    colCount: colCountSchema.optional(),
    minSelectedChoices: z.number().int().nonnegative().optional(),
    maxSelectedChoices: z.number().int().positive().optional(),
  }),
  z.object({
    ...choiceQuestionFields,
    type: z.literal('dropdown'),
    placeholder: localizedStringSchema.optional(),
  }),
  z.object({
    ...baseQuestionFields,
    type: z.literal('date'),
    min: z.string().optional(),
    max: z.string().optional(),
  }),
  z.object({
    ...baseQuestionFields,
    type: z.literal('number'),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    unit: localizedStringSchema.optional(),
  }),
  z.object({
    ...baseQuestionFields,
    type: z.literal('rating'),
    rateMax: z.number().int().min(2).max(10).optional(),
    rateType: z.enum(['stars', 'numbers', 'smileys']).optional(),
    minRateDescription: localizedStringSchema.optional(),
    maxRateDescription: localizedStringSchema.optional(),
  }),
  z.object({
    ...baseQuestionFields,
    type: z.literal('nps'),
    minDescription: localizedStringSchema.optional(),
    maxDescription: localizedStringSchema.optional(),
  }),
  z.object({
    ...baseQuestionFields,
    type: z.literal('boolean'),
    labelTrue: localizedStringSchema.optional(),
    labelFalse: localizedStringSchema.optional(),
    renderAs: z.enum(['switch', 'radio']).optional(),
  }),
  z.object({
    ...baseQuestionFields,
    type: z.literal('html'),
    html: localizedStringSchema,
  }),
] as const;

export const questionSchema = z.discriminatedUnion('type', [...questionSchemas]);

/* -------------------------------------------------------------------------- */
/* Conteneurs — récursifs                                                     */
/* -------------------------------------------------------------------------- */

// `elements` est différé par `z.lazy` : seul ce champ est circulaire, ce qui laisse
// `type: 'panel'` visible comme littéral et permet de garder une union discriminée
// (messages d'erreur bien plus précis qu'avec une union simple).
const panelSchema = z.object({
  id: idSchema,
  name: nameSchema,
  type: z.literal('panel'),
  title: localizedStringSchema.optional(),
  description: localizedStringSchema.optional(),
  state: z.enum(['expanded', 'collapsed']).optional(),
  visibleIf: expressionSchema.optional(),
  enableIf: expressionSchema.optional(),
  elements: z.array(
    z.lazy((): z.ZodType<SurveyElement> => elementSchema as z.ZodType<SurveyElement>),
  ),
});

const elementSchema = z.discriminatedUnion('type', [...questionSchemas, panelSchema]);

const pageSchema = z.object({
  id: idSchema,
  name: nameSchema,
  title: localizedStringSchema.optional(),
  description: localizedStringSchema.optional(),
  visibleIf: expressionSchema.optional(),
  elements: z.array(elementSchema),
});

/* -------------------------------------------------------------------------- */
/* Logique transverse                                                         */
/* -------------------------------------------------------------------------- */

const calculatedValueSchema = z.object({
  name: nameSchema,
  expression: expressionSchema,
  includeIntoResult: z.boolean().optional(),
});

const triggerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('setvalue'),
    expression: expressionSchema,
    setToName: nameSchema,
    setValue: z.unknown(),
  }),
  z.object({
    type: z.literal('copyvalue'),
    expression: expressionSchema,
    fromName: nameSchema,
    setToName: nameSchema,
  }),
  z.object({ type: z.literal('skip'), expression: expressionSchema, gotoName: nameSchema }),
  z.object({ type: z.literal('complete'), expression: expressionSchema }),
]);

const settingsSchema = z.object({
  locale: localeSchema,
  showProgressBar: z.enum(['off', 'top', 'bottom']),
  showQuestionNumbers: z.enum(['on', 'off', 'onPage']),
  showPageTitles: z.boolean(),
  checkErrorsMode: z.enum(['onNextPage', 'onValueChanged']),
  requiredErrorText: localizedStringSchema.optional(),
  pagePrevText: localizedStringSchema.optional(),
  pageNextText: localizedStringSchema.optional(),
  completeText: localizedStringSchema.optional(),
  completedHtml: localizedStringSchema.optional(),
});

export const surveyDefinitionSchema = z.object({
  schemaVersion: z.number().int().positive(),
  id: idSchema,
  title: localizedStringSchema,
  description: localizedStringSchema.optional(),
  pages: z.array(pageSchema),
  settings: settingsSchema,
  calculatedValues: z.array(calculatedValueSchema).optional(),
  triggers: z.array(triggerSchema).optional(),
});

/* -------------------------------------------------------------------------- */
/* API publique                                                               */
/* -------------------------------------------------------------------------- */

export interface SchemaIssue {
  /** Chemin JSON de l'erreur, ex. `pages[0].elements[2].name`. */
  path: string;
  message: string;
}

export class SurveySchemaError extends Error {
  readonly issues: SchemaIssue[];

  constructor(issues: SchemaIssue[]) {
    const preview = issues
      .slice(0, 5)
      .map((issue) => `  • ${issue.path || '(racine)'} : ${issue.message}`)
      .join('\n');
    const more = issues.length > 5 ? `\n  … et ${issues.length - 5} autre(s)` : '';
    super(`JSON de sondage invalide (${issues.length} erreur(s)) :\n${preview}${more}`);
    this.name = 'SurveySchemaError';
    this.issues = issues;
  }
}

function formatPath(path: ReadonlyArray<PropertyKey>): string {
  return path.reduce<string>((accumulator, segment) => {
    if (typeof segment === 'number') return `${accumulator}[${segment}]`;
    return accumulator === '' ? String(segment) : `${accumulator}.${String(segment)}`;
  }, '');
}

export function toSchemaIssues(error: z.ZodError): SchemaIssue[] {
  return error.issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
  }));
}

export type ParseSurveyResult =
  { success: true; data: SurveyDefinition } | { success: false; issues: SchemaIssue[] };

/** Valide sans lever d'exception — c'est la forme utilisée par le builder. */
export function safeParseSurvey(input: unknown): ParseSurveyResult {
  const result = surveyDefinitionSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as SurveyDefinition };
  }
  return { success: false, issues: toSchemaIssues(result.error) };
}

/**
 * Valide et lève `SurveySchemaError` en cas d'échec.
 *
 * À réserver aux frontières où le JSON n'est pas de confiance (import de fichier,
 * réponse d'API). Un JSON déjà validé à l'enregistrement peut être passé directement
 * au renderer sans repasser par cette étape.
 */
export function parseSurvey(input: unknown): SurveyDefinition {
  const result = safeParseSurvey(input);
  if (!result.success) throw new SurveySchemaError(result.issues);
  return result.data;
}

export const schemas = {
  localizedString: localizedStringSchema,
  name: nameSchema,
  validator: validatorSchema,
  choice: choiceSchema,
  question: questionSchema,
  panel: panelSchema,
  element: elementSchema,
  page: pageSchema,
  trigger: triggerSchema,
  calculatedValue: calculatedValueSchema,
  settings: settingsSchema,
  survey: surveyDefinitionSchema,
} as const;
