import type { SurveyDefinition } from '../core/schema/types';

/**
 * Contrôle structurel d'une définition, **sans dépendance**.
 *
 * Pourquoi ne pas réutiliser `parseSurvey` : il repose sur Zod, qui pèse à lui
 * seul 60 Ko gzip dans un bundle censé tenir sous 45. Or la validation
 * exhaustive — types de questions, validateurs, expressions — sert à l'auteur du
 * questionnaire et au backend. Le moteur de rendu, lui, a besoin d'une seule
 * garantie : que la forme lue par `SurveyEngine` soit présente.
 *
 * Ce contrôle vérifie donc exactement ce que le moteur parcourt, et rien de plus.
 * Le reste est déjà couvert par la conception : un type de question inconnu
 * affiche un message explicite, une expression cassée se comporte comme absente.
 *
 * La validation complète reste disponible via `@dahhouilyas/survey/core` pour
 * qui valide côté serveur ou dans le builder.
 */

export class SurveyShapeError extends Error {
  constructor(chemin: string, attendu: string) {
    super(`Définition invalide — ${chemin} : ${attendu}.`);
    this.name = 'SurveyShapeError';
  }
}

const NOM_VALIDE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function exigerTexte(valeur: unknown, chemin: string): void {
  // Un libellé est soit une chaîne, soit une table de traductions.
  if (typeof valeur === 'string') return;
  if (estObjet(valeur)) return;
  throw new SurveyShapeError(chemin, 'texte ou table de traductions attendu');
}

function verifierElement(valeur: unknown, chemin: string): void {
  if (!estObjet(valeur)) throw new SurveyShapeError(chemin, 'objet attendu');

  if (typeof valeur.id !== 'string' || valeur.id === '') {
    throw new SurveyShapeError(`${chemin}.id`, 'identifiant non vide attendu');
  }
  if (typeof valeur.name !== 'string' || !NOM_VALIDE.test(valeur.name)) {
    throw new SurveyShapeError(
      `${chemin}.name`,
      'nom commençant par une lettre ou « _ », sans espace ni tiret',
    );
  }
  if (typeof valeur.type !== 'string' || valeur.type === '') {
    throw new SurveyShapeError(`${chemin}.type`, 'type de question attendu');
  }

  if (valeur.type === 'panel') {
    if (!Array.isArray(valeur.elements)) {
      throw new SurveyShapeError(`${chemin}.elements`, 'tableau attendu dans un groupe');
    }
    valeur.elements.forEach((enfant, i) => verifierElement(enfant, `${chemin}.elements[${i}]`));
    return;
  }

  exigerTexte(valeur.title, `${chemin}.title`);
}

/** Valide la forme et renvoie la définition typée. Lève `SurveyShapeError` sinon. */
export function assertSurveyShape(valeur: unknown): SurveyDefinition {
  if (!estObjet(valeur)) throw new SurveyShapeError('racine', 'objet attendu');

  if (typeof valeur.schemaVersion !== 'number') {
    throw new SurveyShapeError('schemaVersion', 'nombre attendu');
  }
  if (typeof valeur.id !== 'string' || valeur.id === '') {
    throw new SurveyShapeError('id', 'identifiant non vide attendu');
  }
  exigerTexte(valeur.title, 'title');

  if (!estObjet(valeur.settings)) throw new SurveyShapeError('settings', 'objet attendu');
  if (typeof valeur.settings.locale !== 'string') {
    throw new SurveyShapeError('settings.locale', 'code de langue attendu');
  }

  if (!Array.isArray(valeur.pages) || valeur.pages.length === 0) {
    throw new SurveyShapeError('pages', 'tableau non vide attendu');
  }

  valeur.pages.forEach((page, i) => {
    const chemin = `pages[${i}]`;
    if (!estObjet(page)) throw new SurveyShapeError(chemin, 'objet attendu');
    if (typeof page.id !== 'string' || page.id === '') {
      throw new SurveyShapeError(`${chemin}.id`, 'identifiant non vide attendu');
    }
    if (typeof page.name !== 'string' || !NOM_VALIDE.test(page.name)) {
      throw new SurveyShapeError(`${chemin}.name`, 'nom valide attendu');
    }
    if (!Array.isArray(page.elements)) {
      throw new SurveyShapeError(`${chemin}.elements`, 'tableau attendu');
    }
    page.elements.forEach((element, j) => verifierElement(element, `${chemin}.elements[${j}]`));
  });

  return valeur as unknown as SurveyDefinition;
}
