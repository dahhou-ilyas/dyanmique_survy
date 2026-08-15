import type { Locale } from '../core/schema/types';
import { formatMessage } from './messages';

/** Libellés de l'interface du builder — séparés du renderer, qui n'en a pas besoin. */
export interface BuilderMessages {
  /* Barre d'outils */
  designer: string;
  preview: string;
  logic: string;
  translations: string;
  json: string;
  undo: string;
  redo: string;
  save: string;
  saved: string;
  unsavedChanges: string;

  /* Palette */
  toolbox: string;
  toolboxHint: string;
  addGroup: string;

  /* Canevas */
  pages: string;
  addPage: string;
  deletePage: string;
  emptyPage: string;
  emptyPageHint: string;
  dropHere: string;
  duplicate: string;
  delete: string;
  moveUp: string;
  moveDown: string;
  dragHandle: string;
  requiredBadge: string;
  conditionalBadge: string;

  /* Propriétés */
  properties: string;
  noSelection: string;
  noSelectionHint: string;
  surveyProperties: string;
  pageProperties: string;
  surveyTitle: string;
  surveyDescription: string;
  settings: string;
  showProgressBar: string;
  showQuestionNumbers: string;
  showPageTitles: string;
  checkErrorsMode: string;
  defaultLocale: string;

  /* Éditeurs */
  addChoice: string;
  bulkEdit: string;
  bulkEditHint: string;
  applyBulk: string;
  choiceValue: string;
  choiceLabel: string;
  removeChoice: string;
  addValidator: string;
  validatorType: string;
  customMessage: string;
  expressionHelp: string;
  expressionInvalid: string;
  availableFields: string;

  /* Onglets */
  logicEmpty: string;
  logicElement: string;
  logicRule: string;
  logicExpression: string;
  translationsEmpty: string;
  translationsSource: string;
  translationsTarget: string;
  translationsProgress: string;
  jsonInvalid: string;
  jsonApply: string;
  jsonCopy: string;
  jsonCopied: string;
  jsonDownload: string;

  /* Diagnostics */
  diagnostics: string;
  diagnosticsNone: string;
  errors: string;
  warnings: string;
}

const fr: BuilderMessages = {
  designer: 'Concepteur',
  preview: 'Aperçu',
  logic: 'Logique',
  translations: 'Traductions',
  json: 'JSON',
  undo: 'Annuler',
  redo: 'Rétablir',
  save: 'Enregistrer',
  saved: 'Enregistré',
  unsavedChanges: 'Modifications non enregistrées',

  toolbox: 'Types de questions',
  toolboxHint: 'Glissez un élément vers la page, ou cliquez pour l’ajouter à la fin.',
  addGroup: 'Groupe de questions',

  pages: 'Pages',
  addPage: 'Ajouter une page',
  deletePage: 'Supprimer la page',
  emptyPage: 'Cette page est vide',
  emptyPageHint: 'Glissez un type de question depuis la palette de gauche.',
  dropHere: 'Déposer ici',
  duplicate: 'Dupliquer',
  delete: 'Supprimer',
  moveUp: 'Monter',
  moveDown: 'Descendre',
  dragHandle: 'Déplacer',
  requiredBadge: 'Obligatoire',
  conditionalBadge: 'Conditionnelle',

  properties: 'Propriétés',
  noSelection: 'Aucune sélection',
  noSelectionHint:
    'Sélectionnez une question, une page ou le sondage pour en modifier les propriétés.',
  surveyProperties: 'Sondage',
  pageProperties: 'Page',
  surveyTitle: 'Titre du sondage',
  surveyDescription: 'Description',
  settings: 'Réglages',
  showProgressBar: 'Barre de progression',
  showQuestionNumbers: 'Numérotation des questions',
  showPageTitles: 'Afficher les titres de page',
  checkErrorsMode: 'Affichage des erreurs',
  defaultLocale: 'Langue par défaut',

  addChoice: 'Ajouter une option',
  bulkEdit: 'Saisie en masse',
  bulkEditHint: 'Une option par ligne. Utilisez « valeur | libellé » pour dissocier les deux.',
  applyBulk: 'Appliquer',
  choiceValue: 'Valeur',
  choiceLabel: 'Libellé',
  removeChoice: 'Supprimer l’option',
  addValidator: 'Ajouter une règle',
  validatorType: 'Type de règle',
  customMessage: 'Message personnalisé',
  expressionHelp: 'Aide sur les expressions',
  expressionInvalid: 'Expression invalide',
  availableFields: 'Champs disponibles',

  logicEmpty: 'Aucune règle conditionnelle définie.',
  logicElement: 'Élément',
  logicRule: 'Règle',
  logicExpression: 'Expression',
  translationsEmpty: 'Aucun texte à traduire.',
  translationsSource: 'Français',
  translationsTarget: 'Anglais',
  translationsProgress: '{done} / {total} traduits',
  jsonInvalid: 'JSON invalide',
  jsonApply: 'Appliquer le JSON',
  jsonCopy: 'Copier',
  jsonCopied: 'Copié',
  jsonDownload: 'Télécharger',

  diagnostics: 'Contrôles',
  diagnosticsNone: 'Aucun problème détecté.',
  errors: 'erreur(s)',
  warnings: 'avertissement(s)',
};

const en: BuilderMessages = {
  designer: 'Designer',
  preview: 'Preview',
  logic: 'Logic',
  translations: 'Translations',
  json: 'JSON',
  undo: 'Undo',
  redo: 'Redo',
  save: 'Save',
  saved: 'Saved',
  unsavedChanges: 'Unsaved changes',

  toolbox: 'Question types',
  toolboxHint: 'Drag an item onto the page, or click to append it.',
  addGroup: 'Question group',

  pages: 'Pages',
  addPage: 'Add a page',
  deletePage: 'Delete page',
  emptyPage: 'This page is empty',
  emptyPageHint: 'Drag a question type from the palette on the left.',
  dropHere: 'Drop here',
  duplicate: 'Duplicate',
  delete: 'Delete',
  moveUp: 'Move up',
  moveDown: 'Move down',
  dragHandle: 'Move',
  requiredBadge: 'Required',
  conditionalBadge: 'Conditional',

  properties: 'Properties',
  noSelection: 'Nothing selected',
  noSelectionHint: 'Select a question, a page or the survey to edit its properties.',
  surveyProperties: 'Survey',
  pageProperties: 'Page',
  surveyTitle: 'Survey title',
  surveyDescription: 'Description',
  settings: 'Settings',
  showProgressBar: 'Progress bar',
  showQuestionNumbers: 'Question numbering',
  showPageTitles: 'Show page titles',
  checkErrorsMode: 'Error display',
  defaultLocale: 'Default language',

  addChoice: 'Add a choice',
  bulkEdit: 'Bulk edit',
  bulkEditHint: 'One choice per line. Use "value | label" to separate them.',
  applyBulk: 'Apply',
  choiceValue: 'Value',
  choiceLabel: 'Label',
  removeChoice: 'Remove choice',
  addValidator: 'Add a rule',
  validatorType: 'Rule type',
  customMessage: 'Custom message',
  expressionHelp: 'Expression help',
  expressionInvalid: 'Invalid expression',
  availableFields: 'Available fields',

  logicEmpty: 'No conditional rules defined.',
  logicElement: 'Element',
  logicRule: 'Rule',
  logicExpression: 'Expression',
  translationsEmpty: 'Nothing to translate.',
  translationsSource: 'French',
  translationsTarget: 'English',
  translationsProgress: '{done} / {total} translated',
  jsonInvalid: 'Invalid JSON',
  jsonApply: 'Apply JSON',
  jsonCopy: 'Copy',
  jsonCopied: 'Copied',
  jsonDownload: 'Download',

  diagnostics: 'Checks',
  diagnosticsNone: 'No issues found.',
  errors: 'error(s)',
  warnings: 'warning(s)',
};

export const builderMessages: Record<Locale, BuilderMessages> = { fr, en };

export type BuilderMessageKey = keyof BuilderMessages;

export type TranslateBuilder = (
  key: BuilderMessageKey,
  params?: Record<string, string | number>,
) => string;

export function createBuilderTranslator(
  locale: Locale,
  overrides?: Partial<BuilderMessages>,
): TranslateBuilder {
  const dictionary = { ...builderMessages[locale], ...overrides };
  return (key, params) => formatMessage(dictionary[key] ?? key, params);
}
