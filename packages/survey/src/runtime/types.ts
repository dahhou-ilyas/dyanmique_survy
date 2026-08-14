import type { QuestionSnapshot } from '../core/engine/SurveyEngine';
import type { Question } from '../core/schema/types';

/**
 * Contrat d'un composant de champ.
 *
 * Le composant reçoit un instantané déjà calculé (valeur, visibilité, options
 * filtrées, erreurs) : il n'a aucune logique métier à porter, seulement le rendu
 * et la remontée des saisies. C'est ce qui permet d'ajouter un type de question
 * avec un descripteur et un composant, sans toucher au moteur.
 */
export interface FieldProps<Q extends Question = Question> {
  snapshot: QuestionSnapshot;
  question: Q;
  /** Identifiant du contrôle principal — cible de `<label for>`. */
  id: string;
  /** Liste d'ids pour `aria-describedby` (description et message d'erreur). */
  describedBy: string | undefined;
  onChange: (value: unknown) => void;
}

/**
 * Vrai si la question se rend comme un **groupe** de contrôles (plusieurs boutons
 * radio, cases à cocher, crans de notation) plutôt qu'un contrôle unique.
 * Ces questions utilisent `<fieldset>/<legend>` au lieu de `<label for>` : un
 * `<label>` ne peut cibler qu'un seul contrôle, et les lecteurs d'écran
 * annonceraient alors mal le libellé de la question.
 */
export function usesGroupSemantics(question: Question): boolean {
  switch (question.type) {
    case 'radiogroup':
    case 'checkbox':
    case 'rating':
    case 'nps':
      return true;
    case 'boolean':
      return question.renderAs !== 'switch';
    default:
      return false;
  }
}
