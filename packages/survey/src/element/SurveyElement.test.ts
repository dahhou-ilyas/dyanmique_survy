import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { minimalSurvey, satisfactionSurvey } from '../../tests/fixtures';
import './index';
import type { SurveyElement } from './SurveyElement';

/** Laisse le rendu se produire — Preact comme React programment un microtask. */
const attendre = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/**
 * Contenu **rendu**, hors feuille de style.
 * `shadowRoot.textContent` inclurait le CSS injecté, ce qui rend toute assertion
 * de vacuité systématiquement fausse.
 */
const rendu = (el: SurveyElement): string =>
  (el.shadowRoot ?? el).querySelector('div')?.textContent ?? '';

let element: SurveyElement;

function monter(): SurveyElement {
  element = document.createElement('edb-survey') as SurveyElement;
  document.body.appendChild(element);
  return element;
}

afterEach(() => {
  element?.remove();
  vi.unstubAllGlobals();
});

describe('enregistrement', () => {
  it('définit l’élément à l’import', () => {
    expect(customElements.get('edb-survey')).toBeDefined();
  });

  it('un second enregistrement ne lève pas', async () => {
    // Cas réel : deux micro-frontends chargent le bundle sur la même page.
    const { defineSurveyElement } = await import('./SurveyElement');
    expect(() => defineSurveyElement()).not.toThrow();
  });
});

describe('rendu', () => {
  it('rend depuis la propriété definition', async () => {
    const el = monter();
    el.definition = minimalSurvey();
    await attendre();

    expect(el.shadowRoot!.textContent).toContain('Votre nom');
  });

  it('injecte les styles dans le shadow root', async () => {
    const el = monter();
    el.definition = minimalSurvey();
    await attendre();

    const style = el.shadowRoot!.querySelector('style');
    expect(style?.textContent).toContain('--edbs-color-primary');
    expect(style?.textContent).toContain('.edbs-question__label');
  });

  it('rend en DOM clair avec shadow="false"', async () => {
    const el = document.createElement('edb-survey') as SurveyElement;
    el.setAttribute('shadow', 'false');
    document.body.appendChild(el);
    element = el;
    el.definition = minimalSurvey();
    await attendre();

    expect(el.shadowRoot).toBeNull();
    expect(el.textContent).toContain('Votre nom');
  });

  it('respecte l’attribut locale', async () => {
    const el = monter();
    el.setAttribute('locale', 'en');
    el.definition = satisfactionSurvey();
    await attendre();

    expect(el.shadowRoot!.textContent).toContain('Customer satisfaction');
  });

  it('respecte l’attribut mode', async () => {
    const el = monter();
    el.setAttribute('mode', 'display');
    el.definition = minimalSurvey();
    await attendre();

    expect(el.shadowRoot!.querySelector('input')).toBeDisabled();
  });

  it('reprend des réponses via la propriété data', async () => {
    const el = monter();
    el.data = { nom: 'Dupont' };
    el.definition = minimalSurvey();
    await attendre();

    expect(el.shadowRoot!.querySelector('input')).toHaveValue('Dupont');
  });
});

describe('chargement depuis src', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/ok.json') {
          return { ok: true, status: 200, json: async () => minimalSurvey() } as Response;
        }
        if (url === '/invalide.json') {
          return { ok: true, status: 200, json: async () => ({ nawak: true }) } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }),
    );
  });

  it('charge et rend', async () => {
    const el = monter();
    el.setAttribute('src', '/ok.json');
    await attendre();
    await attendre();

    expect(el.shadowRoot!.textContent).toContain('Votre nom');
  });

  it('émet edbs-error sur une définition invalide', async () => {
    const el = monter();
    const erreurs: unknown[] = [];
    el.addEventListener('edbs-error', (e) => erreurs.push((e as CustomEvent).detail));

    el.setAttribute('src', '/invalide.json');
    await attendre();
    await attendre();

    expect(erreurs).toHaveLength(1);
    expect((erreurs[0] as { message: string }).message).toMatch(/Définition invalide/);
  });

  it('émet edbs-error sur une réponse HTTP en échec', async () => {
    const el = monter();
    const erreurs: unknown[] = [];
    el.addEventListener('edbs-error', (e) => erreurs.push((e as CustomEvent).detail));

    el.setAttribute('src', '/absent.json');
    await attendre();
    await attendre();

    expect((erreurs[0] as { message: string }).message).toContain('HTTP 404');
  });

  it('ne rend rien après une erreur', async () => {
    const el = monter();
    el.setAttribute('src', '/invalide.json');
    await attendre();
    await attendre();

    expect(rendu(el)).toBe('');
  });
});

describe('événements', () => {
  it('émet edbs-change à chaque saisie', async () => {
    const el = monter();
    el.definition = minimalSurvey();
    await attendre();

    const changements: unknown[] = [];
    el.addEventListener('edbs-change', (e) => changements.push((e as CustomEvent).detail));

    el.engine!.setValue('nom', 'Dupont');
    await attendre();

    expect(changements).toHaveLength(1);
    expect(changements[0]).toMatchObject({ name: 'nom', value: 'Dupont' });
  });

  it('émet edbs-page au changement d’étape', async () => {
    const el = monter();
    el.definition = satisfactionSurvey();
    await attendre();

    const pages: unknown[] = [];
    el.addEventListener('edbs-page', (e) => pages.push((e as CustomEvent).detail));

    el.engine!.setValue('satisfaction', 5);
    el.engine!.nextPage();
    await attendre();

    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ to: expect.objectContaining({ name: 'page2' }) });
  });

  it('émet edbs-complete avec le résultat', async () => {
    const el = monter();
    el.definition = minimalSurvey();
    await attendre();

    let resultat: unknown = null;
    el.addEventListener('edbs-complete', (e) => {
      resultat = (e as CustomEvent).detail;
    });

    el.engine!.setValue('nom', 'Dupont');
    el.engine!.complete();
    await attendre();

    expect(resultat).toMatchObject({
      surveyId: 'srv_min',
      answers: [expect.objectContaining({ questionName: 'nom', displayValue: 'Dupont' })],
    });
  });

  it('les événements traversent le shadow DOM et remontent', async () => {
    const el = monter();
    el.definition = minimalSurvey();
    await attendre();

    const surDocument = vi.fn();
    document.addEventListener('edbs-change', surDocument);
    el.engine!.setValue('nom', 'x');
    await attendre();
    document.removeEventListener('edbs-change', surDocument);

    // `composed: true` est ce qui permet à l'hôte d'écouter en délégation.
    expect(surDocument).toHaveBeenCalled();
  });
});

describe('propriétés exposées', () => {
  it('expose le moteur et le résultat courant', async () => {
    const el = monter();
    el.definition = minimalSurvey();
    await attendre();

    expect(el.engine).not.toBeNull();
    el.engine!.setValue('nom', 'Dupont');
    expect(el.result?.answers[0]?.value).toBe('Dupont');
  });

  it('renvoie null tant qu’aucune définition n’est posée', () => {
    const el = monter();
    expect(el.engine).toBeNull();
    expect(el.result).toBeNull();
  });
});

describe('cycle de vie', () => {
  it('démonte au retrait du document', async () => {
    const el = monter();
    el.definition = minimalSurvey();
    await attendre();
    expect(el.engine).not.toBeNull();

    el.remove();
    await attendre();

    // Sans démontage, les abonnements du moteur survivraient à l'élément.
    expect(el.engine).toBeNull();
  });

  it('ne rend pas sans définition', () => {
    const el = monter();
    expect(rendu(el)).toBe('');
  });
});

describe('thème', () => {
  it('applique l’attribut theme', async () => {
    const el = monter();
    el.setAttribute('theme', 'dark');
    el.definition = minimalSurvey();
    await attendre();

    expect(el.shadowRoot!.querySelector('[data-edbs-theme="dark"]')).not.toBeNull();
  });

  it('embarque les jetons du thème sombre', async () => {
    const el = monter();
    el.definition = minimalSurvey();
    await attendre();

    // Les variables CSS traversent la frontière du shadow DOM : c'est ce qui
    // permet à la page hôte de rethémer sans mécanisme supplémentaire.
    const style = el.shadowRoot!.querySelector('style')!.textContent!;
    expect(style).toContain("data-edbs-theme='dark'");
  });
});
