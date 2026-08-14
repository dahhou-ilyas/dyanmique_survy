/**
 * Encodage des identifiants de glisser-déposer.
 *
 * `@dnd-kit` ne manipule que des identifiants plats. Les conteneurs (racine d'une
 * page, intérieur d'un groupe) n'ont pas d'existence propre dans le modèle : on
 * les décrit donc dans l'identifiant lui-même, ce qui évite de maintenir une
 * table de correspondance en parallèle de l'arbre.
 */

export const CONTAINER_PREFIX = 'container:';

export interface ContainerId {
  pageId: string;
  /** `null` pour la racine de la page. */
  parentId: string | null;
}

export function encodeContainerId({ pageId, parentId }: ContainerId): string {
  return `${CONTAINER_PREFIX}${pageId}:${parentId ?? ''}`;
}

export function decodeContainerId(id: string): ContainerId | undefined {
  if (!id.startsWith(CONTAINER_PREFIX)) return undefined;
  const rest = id.slice(CONTAINER_PREFIX.length);
  const separator = rest.indexOf(':');
  if (separator === -1) return undefined;
  const pageId = rest.slice(0, separator);
  const parentId = rest.slice(separator + 1);
  return { pageId, parentId: parentId === '' ? null : parentId };
}

export function isContainerId(id: string): boolean {
  return id.startsWith(CONTAINER_PREFIX);
}
