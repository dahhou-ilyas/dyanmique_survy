import { findElementById } from '../../core/schema/traverse';
import { isPanel, type SurveyDefinition } from '../../core/schema/types';
import type { DropTarget } from '../store/builderStore';
import { decodeContainerId, isContainerId } from './dragIds';

/** Préfixe des identifiants de glisser-déposer venant de la palette. */
export const TOOLBOX_DRAG_PREFIX = 'toolbox:';

/**
 * Traduit la cible survolée en position d'insertion dans le modèle.
 *
 * Extrait du composant pour être testable : `jsdom` ne sait pas simuler un
 * glisser-déposer au pointeur, or c'est ici que se joue la logique délicate
 * (conteneur racine, intérieur d'un groupe, insertion avant un élément).
 */
export function resolveDropTarget(
  survey: SurveyDefinition,
  overId: string,
): DropTarget | undefined {
  if (isContainerId(overId)) {
    const container = decodeContainerId(overId);
    if (!container) return undefined;
    // Déposer sur le conteneur lui-même — donc à la fin de son contenu.
    return { ...container, index: Number.POSITIVE_INFINITY };
  }

  const location = findElementById(survey, overId);
  if (!location) return undefined;

  // Déposer sur un groupe insère **à l'intérieur** plutôt qu'à côté : sans cela,
  // un groupe vide serait impossible à remplir, notamment au clavier.
  if (isPanel(location.element)) {
    return { pageId: location.page.id, parentId: location.element.id, index: 0 };
  }

  return {
    pageId: location.page.id,
    parentId: location.parent?.id ?? null,
    index: location.index,
  };
}

/** Vrai si le glisser-déposer provient de la palette et non du canevas. */
export function isToolboxDrag(activeId: string): boolean {
  return activeId.startsWith(TOOLBOX_DRAG_PREFIX);
}

/** Type de question porté par un identifiant de palette. */
export function toolboxDragType(activeId: string): string {
  return activeId.slice(TOOLBOX_DRAG_PREFIX.length);
}
