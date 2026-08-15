import type { Question, QuestionType } from '../schema/types';
import {
  IDENTITY_PROPERTIES,
  LOGIC_PROPERTIES,
  PANEL_LOGIC_PROPERTIES,
  VALIDATION_PROPERTIES,
} from './commonProperties';
import { checkboxDescriptor, dropdownDescriptor, radioGroupDescriptor } from './descriptors/choice';
import { htmlDescriptor } from './descriptors/content';
import { dateDescriptor, numberDescriptor } from './descriptors/numeric';
import { booleanDescriptor, npsDescriptor, ratingDescriptor } from './descriptors/rating';
import { commentDescriptor, textDescriptor } from './descriptors/text';
import type {
  PropertyDescriptor,
  PropertyGroup,
  QuestionCategory,
  QuestionTypeDescriptor,
} from './types';

/** Ordre d'affichage des groupes dans le panneau de propriétés du builder. */
export const PROPERTY_GROUP_ORDER: PropertyGroup[] = [
  'general',
  'options',
  'layout',
  'validation',
  'logic',
];

export const PROPERTY_GROUP_LABELS: Record<PropertyGroup, { fr: string; en: string }> = {
  general: { fr: 'Général', en: 'General' },
  options: { fr: 'Options', en: 'Options' },
  layout: { fr: 'Mise en page', en: 'Layout' },
  validation: { fr: 'Validation', en: 'Validation' },
  logic: { fr: 'Logique conditionnelle', en: 'Conditional logic' },
};

export class UnknownQuestionTypeError extends Error {
  constructor(type: string, known: string[]) {
    super(
      `Type de question inconnu : « ${type} ». Types enregistrés : ${known.join(', ')}. ` +
        'Un type personnalisé doit être enregistré via questionRegistry.register() avant usage.',
    );
    this.name = 'UnknownQuestionTypeError';
  }
}

/**
 * Registre des types de questions.
 *
 * Les types intégrés sont enregistrés au chargement du module. Une application hôte
 * peut en ajouter — le builder et le renderer les prennent alors en charge sans
 * modification, puisque tous deux ne lisent que ce registre.
 */
export class QuestionRegistry {
  private readonly descriptors = new Map<string, QuestionTypeDescriptor<Question>>();

  register<Q extends Question>(descriptor: QuestionTypeDescriptor<Q>): this {
    this.descriptors.set(
      descriptor.type,
      descriptor as unknown as QuestionTypeDescriptor<Question>,
    );
    return this;
  }

  unregister(type: string): boolean {
    return this.descriptors.delete(type);
  }

  has(type: string): boolean {
    return this.descriptors.has(type);
  }

  get(type: string): QuestionTypeDescriptor<Question> | undefined {
    return this.descriptors.get(type);
  }

  /** Comme `get`, mais lève une erreur explicite plutôt que de renvoyer `undefined`. */
  require(type: string): QuestionTypeDescriptor<Question> {
    const descriptor = this.descriptors.get(type);
    if (!descriptor) throw new UnknownQuestionTypeError(type, this.types());
    return descriptor;
  }

  types(): string[] {
    return [...this.descriptors.keys()];
  }

  list(): QuestionTypeDescriptor<Question>[] {
    return [...this.descriptors.values()];
  }

  /** Descripteurs regroupés par catégorie — alimente directement la palette du builder. */
  byCategory(): Array<{
    category: QuestionCategory;
    descriptors: QuestionTypeDescriptor<Question>[];
  }> {
    const groups = new Map<QuestionCategory, QuestionTypeDescriptor<Question>[]>();
    for (const descriptor of this.descriptors.values()) {
      const bucket = groups.get(descriptor.category) ?? [];
      bucket.push(descriptor);
      groups.set(descriptor.category, bucket);
    }
    return [...groups.entries()].map(([category, descriptors]) => ({ category, descriptors }));
  }

  /**
   * Liste complète et ordonnée des propriétés éditables d'un type : identité,
   * propriétés spécifiques, validation puis logique conditionnelle.
   * Les blocs sans réponse (`hasValue: false`) n'exposent pas de validation.
   */
  propertiesFor(type: string): PropertyDescriptor[] {
    const descriptor = this.require(type);
    const properties = [
      ...IDENTITY_PROPERTIES,
      ...descriptor.properties,
      ...(descriptor.hasValue ? VALIDATION_PROPERTIES : []),
      ...LOGIC_PROPERTIES,
    ];
    return sortByGroup(properties);
  }

  /** Crée une question du type demandé avec ses valeurs par défaut. */
  create(type: string, name: string, id: string): Question {
    return this.require(type).createDefault(name, id);
  }
}

function sortByGroup(properties: PropertyDescriptor[]): PropertyDescriptor[] {
  return [...properties].sort(
    (left, right) =>
      PROPERTY_GROUP_ORDER.indexOf(left.group) - PROPERTY_GROUP_ORDER.indexOf(right.group),
  );
}

/** Propriétés éditables d'un panel — il n'est pas dans le registre des questions. */
export const PANEL_PROPERTIES: PropertyDescriptor[] = sortByGroup([
  ...IDENTITY_PROPERTIES,
  {
    name: 'state',
    label: { fr: 'État initial', en: 'Initial state' },
    editor: 'select',
    group: 'layout',
    options: [
      { value: 'expanded', label: { fr: 'Déplié', en: 'Expanded' } },
      { value: 'collapsed', label: { fr: 'Replié', en: 'Collapsed' } },
    ],
  },
  ...PANEL_LOGIC_PROPERTIES,
]);

/** Propriétés éditables d'une page. */
export const PAGE_PROPERTIES: PropertyDescriptor[] = sortByGroup([
  ...IDENTITY_PROPERTIES,
  {
    name: 'visibleIf',
    label: { fr: 'Afficher si', en: 'Visible if' },
    editor: 'expression',
    group: 'logic',
  },
]);

/** Registre partagé, pré-rempli avec les types intégrés. */
export const questionRegistry = new QuestionRegistry()
  .register(textDescriptor)
  .register(commentDescriptor)
  .register(radioGroupDescriptor)
  .register(checkboxDescriptor)
  .register(dropdownDescriptor)
  .register(dateDescriptor)
  .register(numberDescriptor)
  .register(ratingDescriptor)
  .register(npsDescriptor)
  .register(booleanDescriptor)
  .register(htmlDescriptor);

/** Ordre de présentation des types dans la palette du builder. */
export const TOOLBOX_ORDER: QuestionType[] = [
  'text',
  'comment',
  'radiogroup',
  'checkbox',
  'dropdown',
  'date',
  'number',
  'rating',
  'nps',
  'boolean',
  'html',
];

export const CATEGORY_LABELS: Record<QuestionCategory, { fr: string; en: string }> = {
  text: { fr: 'Texte', en: 'Text' },
  choice: { fr: 'Choix', en: 'Choice' },
  numeric: { fr: 'Numérique', en: 'Numeric' },
  rating: { fr: 'Évaluation', en: 'Rating' },
  content: { fr: 'Contenu', en: 'Content' },
  layout: { fr: 'Mise en page', en: 'Layout' },
};
