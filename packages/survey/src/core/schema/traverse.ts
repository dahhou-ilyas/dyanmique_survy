import {
  isPanel,
  type Page,
  type Panel,
  type Question,
  type SurveyDefinition,
  type SurveyElement,
} from './types';

/** Emplacement d'un élément dans l'arbre du sondage. */
export interface ElementLocation {
  element: SurveyElement;
  page: Page;
  pageIndex: number;
  /** Panel contenant l'élément, ou `null` s'il est directement sur la page. */
  parent: Panel | null;
  /** Index dans `parent.elements` ou `page.elements`. */
  index: number;
}

/**
 * Parcourt en profondeur tous les éléments d'une page (panels compris).
 * Renvoyer `false` depuis `visit` coupe la descente dans le sous-arbre courant.
 */
export function walkElements(
  elements: SurveyElement[],
  visit: (element: SurveyElement, parent: Panel | null, index: number) => boolean | void,
  parent: Panel | null = null,
): void {
  elements.forEach((element, index) => {
    const descend = visit(element, parent, index);
    if (descend !== false && isPanel(element)) {
      walkElements(element.elements, visit, element);
    }
  });
}

/** Toutes les questions du sondage, dans l'ordre d'affichage, panels aplatis. */
export function collectQuestions(survey: SurveyDefinition): Question[] {
  const questions: Question[] = [];
  for (const page of survey.pages) {
    walkElements(page.elements, (element) => {
      if (!isPanel(element)) questions.push(element);
    });
  }
  return questions;
}

/** Questions d'une page donnée, panels aplatis. */
export function collectPageQuestions(page: Page): Question[] {
  const questions: Question[] = [];
  walkElements(page.elements, (element) => {
    if (!isPanel(element)) questions.push(element);
  });
  return questions;
}

/** Tous les éléments du sondage (questions et panels), dans l'ordre d'affichage. */
export function collectElements(survey: SurveyDefinition): SurveyElement[] {
  const elements: SurveyElement[] = [];
  for (const page of survey.pages) {
    walkElements(page.elements, (element) => {
      elements.push(element);
    });
  }
  return elements;
}

export function findQuestionByName(
  survey: SurveyDefinition,
  name: string,
): Question | undefined {
  return collectQuestions(survey).find((question) => question.name === name);
}

export function findElementById(
  survey: SurveyDefinition,
  id: string,
): ElementLocation | undefined {
  for (let pageIndex = 0; pageIndex < survey.pages.length; pageIndex += 1) {
    const page = survey.pages[pageIndex];
    if (!page) continue;

    let found: ElementLocation | undefined;
    walkElements(page.elements, (element, parent, index) => {
      if (found) return false;
      if (element.id === id) {
        found = { element, page, pageIndex, parent, index };
        return false;
      }
      return true;
    });
    if (found) return found;
  }
  return undefined;
}

export function findPageById(survey: SurveyDefinition, id: string): Page | undefined {
  return survey.pages.find((page) => page.id === id);
}

export function findPageByName(survey: SurveyDefinition, name: string): Page | undefined {
  return survey.pages.find((page) => page.name === name);
}

/** Page contenant la question portant ce `name`, ou `undefined`. */
export function findPageOfQuestion(
  survey: SurveyDefinition,
  questionName: string,
): Page | undefined {
  return survey.pages.find((page) =>
    collectPageQuestions(page).some((question) => question.name === questionName),
  );
}

/**
 * Tous les `name` déjà pris dans le sondage (questions, panels et pages).
 * Les trois partagent le même espace de nommage : une expression `{x}` doit être
 * sans ambiguïté, et `SkipTrigger.gotoName` vise indifféremment une page ou une question.
 */
export function collectUsedNames(survey: SurveyDefinition): Set<string> {
  const names = new Set<string>();
  for (const page of survey.pages) {
    names.add(page.name);
    walkElements(page.elements, (element) => {
      names.add(element.name);
    });
  }
  for (const calculated of survey.calculatedValues ?? []) {
    names.add(calculated.name);
  }
  return names;
}

/**
 * Génère un `name` libre à partir d'un préfixe : `question1`, `question2`…
 * `exclude` permet d'ignorer le nom actuel d'un élément en cours de renommage.
 */
export function generateUniqueName(
  taken: Set<string>,
  prefix: string,
  exclude?: string,
): string {
  let index = 1;
  let candidate = `${prefix}${index}`;
  while (taken.has(candidate) && candidate !== exclude) {
    index += 1;
    candidate = `${prefix}${index}`;
  }
  return candidate;
}
