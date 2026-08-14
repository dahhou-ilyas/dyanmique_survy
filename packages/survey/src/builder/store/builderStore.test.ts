import { beforeEach, describe, expect, it } from 'vitest';
import { satisfactionSurvey } from '../../../tests/fixtures';
import { collectQuestions, findElementById } from '../../core/schema/traverse';
import { isPanel } from '../../core/schema/types';
import { createBuilderStore, type BuilderStoreApi } from './builderStore';

let store: BuilderStoreApi;
const state = () => store.getState();

beforeEach(() => {
  store = createBuilderStore(satisfactionSurvey());
});

describe('ajout d’éléments', () => {
  it('ajoute à la fin de la page courante par défaut', () => {
    state().addElement('text');
    const page = state().survey.pages[0]!;
    expect(page.elements).toHaveLength(4);
    expect(page.elements[3]!.type).toBe('text');
  });

  it('sélectionne l’élément créé', () => {
    state().addElement('text');
    const created = state().survey.pages[0]!.elements[3]!;
    expect(state().selection).toEqual({ kind: 'element', id: created.id });
  });

  it('génère un nom unique', () => {
    state().addElement('text');
    state().addElement('text');
    const names = collectQuestions(state().survey).map((question) => question.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('insère à la position demandée', () => {
    state().addElement('text', { pageId: 'p1', parentId: null, index: 1 });
    expect(state().survey.pages[0]!.elements[1]!.type).toBe('text');
  });

  it('insère dans un groupe', () => {
    state().addElement('text', { pageId: 'p2', parentId: 'pnl1', index: 0 });
    const panel = state().survey.pages[1]!.elements[0]!;
    expect(isPanel(panel) && panel.elements).toHaveLength(3);
  });

  it('crée un groupe', () => {
    state().addElement('panel');
    const created = state().survey.pages[0]!.elements[3]!;
    expect(created.type).toBe('panel');
    expect(created.name).toMatch(/^groupe/);
  });
});

describe('suppression et duplication', () => {
  it('supprime un élément', () => {
    state().removeElement('q1');
    expect(findElementById(state().survey, 'q1')).toBeUndefined();
  });

  it('supprime un élément imbriqué', () => {
    state().removeElement('q5');
    expect(findElementById(state().survey, 'q5')).toBeUndefined();
    expect(findElementById(state().survey, 'pnl1')).toBeDefined();
  });

  it('duplique avec de nouveaux identifiants et noms', () => {
    state().duplicateElement('q1');
    const page = state().survey.pages[0]!;
    const [original, copy] = [page.elements[0]!, page.elements[1]!];

    expect(copy.id).not.toBe(original.id);
    // Un nom partagé ferait écrire les deux questions au même endroit.
    expect(copy.name).not.toBe(original.name);
    expect(copy.type).toBe(original.type);
  });

  it('renomme aussi les enfants lors de la duplication d’un groupe', () => {
    state().duplicateElement('pnl1');
    const names = collectQuestions(state().survey).map((question) => question.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('déplacement', () => {
  it('réordonne dans la même page', () => {
    state().moveElement('q3', { pageId: 'p1', parentId: null, index: 0 });
    expect(state().survey.pages[0]!.elements[0]!.id).toBe('q3');
  });

  it('corrige l’index lors d’un déplacement vers le bas dans le même conteneur', () => {
    state().moveElement('q1', { pageId: 'p1', parentId: null, index: 2 });
    const ids = state().survey.pages[0]!.elements.map((element) => element.id);
    expect(ids).toEqual(['q2', 'q1', 'q3']);
  });

  it('déplace vers une autre page', () => {
    state().moveElement('q1', { pageId: 'p2', parentId: null, index: 0 });
    expect(state().survey.pages[0]!.elements).toHaveLength(2);
    expect(state().survey.pages[1]!.elements[0]!.id).toBe('q1');
  });

  it('déplace dans un groupe', () => {
    state().moveElement('q1', { pageId: 'p2', parentId: 'pnl1', index: 0 });
    const panel = state().survey.pages[1]!.elements[0]!;
    expect(isPanel(panel) && panel.elements[0]!.id).toBe('q1');
  });

  it('refuse de déposer un groupe dans lui-même', () => {
    const before = JSON.stringify(state().survey);
    state().moveElement('pnl1', { pageId: 'p2', parentId: 'pnl1', index: 0 });
    expect(JSON.stringify(state().survey)).toBe(before);
  });

  it('refuse de déposer un groupe dans sa propre descendance', () => {
    state().addElement('panel', { pageId: 'p2', parentId: 'pnl1', index: 0 });
    const inner = (state().survey.pages[1]!.elements[0]! as { elements: Array<{ id: string }> })
      .elements[0]!;

    const before = JSON.stringify(state().survey);
    state().moveElement('pnl1', { pageId: 'p2', parentId: inner.id, index: 0 });
    expect(JSON.stringify(state().survey)).toBe(before);
  });

  it('ne perd pas l’élément si la cible n’existe pas', () => {
    state().moveElement('q1', { pageId: 'inexistante', parentId: null, index: 0 });
    expect(findElementById(state().survey, 'q1')).toBeDefined();
  });
});

describe('renommage', () => {
  it('applique un nom libre', () => {
    state().renameElement('q1', 'note_globale');
    expect(findElementById(state().survey, 'q1')?.element.name).toBe('note_globale');
  });

  it('suffixe un nom déjà pris plutôt que de créer un doublon', () => {
    state().renameElement('q1', 'email');
    const name = findElementById(state().survey, 'q1')?.element.name;
    expect(name).not.toBe('email');
    expect(name).toMatch(/^email\d+$/);
  });

  it('accepte de réappliquer son propre nom', () => {
    state().renameElement('q1', 'satisfaction');
    expect(findElementById(state().survey, 'q1')?.element.name).toBe('satisfaction');
  });
});

describe('pages', () => {
  it('ajoute une page et s’y positionne', () => {
    state().addPage();
    expect(state().survey.pages).toHaveLength(3);
    expect(state().currentPageId).toBe(state().survey.pages[2]!.id);
  });

  it('supprime une page', () => {
    state().removePage('p2');
    expect(state().survey.pages).toHaveLength(1);
  });

  it('refuse de supprimer la dernière page', () => {
    state().removePage('p2');
    state().removePage('p1');
    expect(state().survey.pages).toHaveLength(1);
  });

  it('réordonne les pages', () => {
    state().movePage(0, 1);
    expect(state().survey.pages[0]!.id).toBe('p2');
  });
});

describe('historique', () => {
  it('annule la dernière action', () => {
    state().addElement('text');
    expect(state().survey.pages[0]!.elements).toHaveLength(4);
    state().undo();
    expect(state().survey.pages[0]!.elements).toHaveLength(3);
  });

  it('rétablit une action annulée', () => {
    state().addElement('text');
    state().undo();
    state().redo();
    expect(state().survey.pages[0]!.elements).toHaveLength(4);
  });

  it('annule plusieurs actions dans l’ordre inverse', () => {
    state().addElement('text');
    state().addElement('number');
    state().undo();
    state().undo();
    expect(state().survey.pages[0]!.elements).toHaveLength(3);
  });

  it('vide la branche « refaire » dès qu’une nouvelle action a lieu', () => {
    state().addElement('text');
    state().undo();
    expect(state().future).toHaveLength(1);
    state().addElement('number');
    expect(state().future).toHaveLength(0);
  });

  it('ne fait rien quand il n’y a rien à annuler', () => {
    const before = state().survey;
    state().undo();
    expect(state().survey).toBe(before);
  });

  it('n’empile rien quand la modification est sans effet', () => {
    state().updateElement('q1', {});
    expect(state().past).toHaveLength(0);
  });

  it('restitue exactement l’état antérieur après annulation', () => {
    const before = JSON.stringify(state().survey);
    state().addElement('text');
    state().renameElement(state().survey.pages[0]!.elements[3]!.id, 'nouvelle');
    state().undo();
    state().undo();
    expect(JSON.stringify(state().survey)).toBe(before);
  });

  it('expose le libellé de la prochaine annulation', () => {
    state().addElement('text');
    expect(state().past[0]!.label).toBe('Ajouter un élément');
  });
});

describe('état « modifié »', () => {
  it('est faux au départ et vrai après modification', () => {
    expect(state().dirty).toBe(false);
    state().addElement('text');
    expect(state().dirty).toBe(true);
  });

  it('repasse à faux après markSaved', () => {
    state().addElement('text');
    state().markSaved();
    expect(state().dirty).toBe(false);
  });

  it('est réinitialisé par replaceSurvey', () => {
    state().addElement('text');
    state().replaceSurvey(satisfactionSurvey());
    expect(state().dirty).toBe(false);
    expect(state().past).toHaveLength(0);
  });
});

describe('mise à jour de propriétés', () => {
  it('modifie une propriété d’élément', () => {
    state().updateElement('q1', { isRequired: false });
    const element = findElementById(state().survey, 'q1')?.element;
    expect(element && 'isRequired' in element && element.isRequired).toBe(false);
  });

  it('supprime la propriété quand la valeur est undefined', () => {
    state().updateElement('q2', { visibleIf: undefined });
    expect(findElementById(state().survey, 'q2')?.element.visibleIf).toBeUndefined();
  });

  it('modifie les réglages du sondage', () => {
    state().updateSettings({ showProgressBar: 'bottom' });
    expect(state().survey.settings.showProgressBar).toBe('bottom');
  });
});

describe('sélection', () => {
  it('bascule sur la page de l’élément sélectionné', () => {
    state().select({ kind: 'element', id: 'q5' });
    expect(state().currentPageId).toBe('p2');
  });
});
