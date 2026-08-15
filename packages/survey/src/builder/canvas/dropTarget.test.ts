import { describe, expect, it } from 'vitest';
import { satisfactionSurvey } from '../../../tests/fixtures';
import { decodeContainerId, encodeContainerId, isContainerId } from './dragIds';
import { isToolboxDrag, resolveDropTarget, toolboxDragType } from './dropTarget';

const survey = satisfactionSurvey();

describe('identifiants de conteneur', () => {
  it('fait un aller-retour sur la racine d’une page', () => {
    const id = encodeContainerId({ pageId: 'p1', parentId: null });
    expect(isContainerId(id)).toBe(true);
    expect(decodeContainerId(id)).toEqual({ pageId: 'p1', parentId: null });
  });

  it('fait un aller-retour sur l’intérieur d’un groupe', () => {
    const id = encodeContainerId({ pageId: 'p2', parentId: 'pnl1' });
    expect(decodeContainerId(id)).toEqual({ pageId: 'p2', parentId: 'pnl1' });
  });

  it('ne confond pas un identifiant d’élément avec un conteneur', () => {
    expect(isContainerId('q1')).toBe(false);
    expect(decodeContainerId('q1')).toBeUndefined();
  });

  it('rejette un identifiant de conteneur malformé', () => {
    expect(decodeContainerId('container:sansSeparateur')).toBeUndefined();
  });
});

describe('resolveDropTarget', () => {
  it('dépose à la fin quand la cible est le conteneur d’une page', () => {
    const target = resolveDropTarget(survey, encodeContainerId({ pageId: 'p1', parentId: null }));
    expect(target).toEqual({ pageId: 'p1', parentId: null, index: Number.POSITIVE_INFINITY });
  });

  it('dépose à la fin quand la cible est l’intérieur d’un groupe', () => {
    const target = resolveDropTarget(survey, encodeContainerId({ pageId: 'p2', parentId: 'pnl1' }));
    expect(target).toEqual({ pageId: 'p2', parentId: 'pnl1', index: Number.POSITIVE_INFINITY });
  });

  it('insère à la position d’une question survolée', () => {
    expect(resolveDropTarget(survey, 'q3')).toEqual({ pageId: 'p1', parentId: null, index: 2 });
  });

  it('conserve le groupe parent d’une question imbriquée', () => {
    expect(resolveDropTarget(survey, 'q5')).toEqual({
      pageId: 'p2',
      parentId: 'pnl1',
      index: 1,
    });
  });

  it('dépose **à l’intérieur** d’un groupe survolé, pas à côté', () => {
    // Sans cette règle, un groupe vide serait impossible à remplir au clavier.
    expect(resolveDropTarget(survey, 'pnl1')).toEqual({
      pageId: 'p2',
      parentId: 'pnl1',
      index: 0,
    });
  });

  it('renvoie undefined pour une cible inconnue', () => {
    expect(resolveDropTarget(survey, 'inexistant')).toBeUndefined();
    expect(resolveDropTarget(survey, 'container:pageInconnue:')).toEqual({
      pageId: 'pageInconnue',
      parentId: null,
      index: Number.POSITIVE_INFINITY,
    });
  });
});

describe('glisser depuis la palette', () => {
  it('reconnaît un identifiant de palette', () => {
    expect(isToolboxDrag('toolbox:text')).toBe(true);
    expect(isToolboxDrag('q1')).toBe(false);
  });

  it('extrait le type de question', () => {
    expect(toolboxDragType('toolbox:radiogroup')).toBe('radiogroup');
    expect(toolboxDragType('toolbox:panel')).toBe('panel');
  });
});
