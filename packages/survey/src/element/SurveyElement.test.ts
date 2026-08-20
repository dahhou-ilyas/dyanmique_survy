import { describe, expect, it } from 'vitest';
import { minimalSurvey } from '../../tests/fixtures';
import './index';
import type { SurveyElement } from './SurveyElement';

/** Laisse le rendu se produire (Preact/React programment un microtask). */
const attendre = () => new Promise((r) => setTimeout(r, 0));

describe('<edb-survey> — fumée', () => {
  it('est enregistré', () => {
    expect(customElements.get('edb-survey')).toBeDefined();
  });

  it('rend le sondage depuis la propriété definition', async () => {
    const el = document.createElement('edb-survey') as SurveyElement;
    document.body.appendChild(el);
    el.definition = minimalSurvey();
    await attendre();

    const racine = el.shadowRoot!;
    expect(racine.querySelector('style')?.textContent).toContain('--edbs-color-primary');
    expect(racine.textContent).toContain('Votre nom');
    el.remove();
  });

  it('expose le moteur et émet edbs-complete', async () => {
    const el = document.createElement('edb-survey') as SurveyElement;
    document.body.appendChild(el);
    el.definition = minimalSurvey();
    await attendre();

    expect(el.engine).not.toBeNull();

    let resultat: unknown = null;
    el.addEventListener('edbs-complete', (e) => {
      resultat = (e as CustomEvent).detail;
    });

    el.engine!.setValue('nom', 'Dupont');
    el.engine!.complete();
    await attendre();

    expect(resultat).toMatchObject({ surveyId: 'srv_min' });
    el.remove();
  });
});
