import { createElement } from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import type { PageChangedEvent, SurveyMode, ValueChangedEvent } from '../core/engine/SurveyEngine';
import { type SurveyEngine } from '../core/engine/SurveyEngine';
import { DEFAULT_LOCALE, LOCALES } from '../core/schema/types';
import type { Locale, SurveyDefinition, SurveyResult } from '../core/schema/types';
import { SurveyRenderer } from '../runtime/SurveyRenderer';
import { assertSurveyShape } from './assertSurveyShape';
import { STYLES } from './styles.generated';

/**
 * `<edb-survey>` — le moteur de rendu comme élément HTML standard.
 *
 * Un élément personnalisé est consommé nativement par Vue, Svelte, Angular, Astro,
 * Rails, Django ou une simple page HTML. Écrire un adaptateur par framework
 * reviendrait à maintenir quatre renderers ; celui-ci les remplace tous.
 *
 * Au build, les imports React de cet arbre sont aliasés vers `preact/compat` :
 * le bundle est autonome et ne réclame aucun React à la page hôte.
 *
 * ```html
 * <edb-survey src="/api/formulaire.json" locale="fr"></edb-survey>
 * <script>
 *   document.querySelector('edb-survey')
 *     .addEventListener('edbs-complete', (e) => console.log(e.detail));
 * </script>
 * ```
 */

const NOM_ELEMENT = 'edb-survey';

/** Événements émis. Préfixés pour ne jamais entrer en collision avec ceux de l'hôte. */
export const EVENEMENTS = {
  change: 'edbs-change',
  page: 'edbs-page',
  complete: 'edbs-complete',
  error: 'edbs-error',
} as const;

function estLocale(valeur: string | null): valeur is Locale {
  return valeur !== null && (LOCALES as readonly string[]).includes(valeur);
}

export class SurveyElement extends HTMLElement {
  static readonly observedAttributes = ['src', 'locale', 'theme', 'mode', 'shadow'];

  /** Racine de rendu : le shadow root, ou l'élément lui-même en mode DOM clair. */
  #racine: ShadowRoot | HTMLElement | null = null;
  #conteneur: HTMLDivElement | null = null;

  #definition: SurveyDefinition | null = null;
  #data: Record<string, unknown> | undefined;
  #engine: SurveyEngine | null = null;
  /** Identifie le chargement en cours : une réponse tardive ne doit pas écraser une plus récente. */
  #chargement = 0;

  /* ------------------------------------------------------------------ */
  /* Propriétés JS — pour passer des objets sans les sérialiser          */
  /* ------------------------------------------------------------------ */

  get definition(): SurveyDefinition | null {
    return this.#definition;
  }

  set definition(valeur: SurveyDefinition | null) {
    this.#definition = valeur;
    this.#rendre();
  }

  get data(): Record<string, unknown> | undefined {
    return this.#data;
  }

  set data(valeur: Record<string, unknown> | undefined) {
    this.#data = valeur;
    this.#rendre();
  }

  /** Instance du moteur, pour piloter le sondage depuis l'hôte. */
  get engine(): SurveyEngine | null {
    return this.#engine;
  }

  /** Résultat courant, même avant complétion. */
  get result(): SurveyResult | null {
    return this.#engine?.getResult() ?? null;
  }

  /* ------------------------------------------------------------------ */
  /* Cycle de vie                                                        */
  /* ------------------------------------------------------------------ */

  connectedCallback(): void {
    this.#preparerRacine();
    const src = this.getAttribute('src');
    if (src) void this.#charger(src);
    else this.#rendre();
  }

  disconnectedCallback(): void {
    // Sans démontage explicite, les abonnements du moteur survivraient au retrait
    // de l'élément du document — fuite garantie sur une page qui en crée beaucoup.
    if (this.#conteneur) unmountComponentAtNode(this.#conteneur);
    this.#engine = null;
  }

  attributeChangedCallback(nom: string, avant: string | null, apres: string | null): void {
    if (avant === apres || !this.#racine) return;
    if (nom === 'src') {
      if (apres) void this.#charger(apres);
      return;
    }
    this.#rendre();
  }

  /* ------------------------------------------------------------------ */
  /* Interne                                                             */
  /* ------------------------------------------------------------------ */

  #preparerRacine(): void {
    if (this.#racine) return;

    // Le shadow DOM isole les styles, mais empêche le CSS global de l'hôte
    // d'atteindre le formulaire. `shadow="false"` rend cette encapsulation
    // optionnelle pour qui préfère appliquer sa propre feuille.
    const encapsule = this.getAttribute('shadow') !== 'false';

    if (encapsule) {
      const shadow = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = STYLES;
      shadow.appendChild(style);
      this.#racine = shadow;
    } else {
      this.#racine = this;
    }

    this.#conteneur = document.createElement('div');
    this.#racine.appendChild(this.#conteneur);
  }

  async #charger(src: string): Promise<void> {
    const jeton = ++this.#chargement;
    try {
      const reponse = await fetch(src, { headers: { accept: 'application/json' } });
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status} sur ${src}`);

      const brut: unknown = await reponse.json();
      // La définition vient du réseau : on contrôle sa forme avant de rendre quoi
      // que ce soit. Contrôle structurel et non Zod — voir assertSurveyShape.
      const definition = assertSurveyShape(brut);

      if (jeton !== this.#chargement) return; // un chargement plus récent a pris la main
      this.#definition = definition;
      this.#rendre();
    } catch (erreur) {
      if (jeton !== this.#chargement) return;
      this.#emettre(EVENEMENTS.error, {
        message: erreur instanceof Error ? erreur.message : String(erreur),
        src,
      });
    }
  }

  #emettre(nom: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(nom, { detail, bubbles: true, composed: true }));
  }

  #rendre(): void {
    if (!this.#conteneur || !this.#definition) return;

    const locale = this.getAttribute('locale');
    const theme = this.getAttribute('theme');
    const mode = this.getAttribute('mode');

    render(
      createElement(SurveyRenderer, {
        definition: this.#definition,
        ...(this.#data ? { data: this.#data } : {}),
        locale: estLocale(locale) ? locale : DEFAULT_LOCALE,
        ...(theme === 'dark' || theme === 'light' ? { theme } : {}),
        ...(mode === 'display' || mode === 'edit' ? { mode: mode as SurveyMode } : {}),
        onEngineReady: (engine: SurveyEngine) => {
          this.#engine = engine;
        },
        onValueChanged: (event: ValueChangedEvent) => this.#emettre(EVENEMENTS.change, event),
        onPageChanged: (event: PageChangedEvent) => this.#emettre(EVENEMENTS.page, event),
        onComplete: (result: SurveyResult) => this.#emettre(EVENEMENTS.complete, result),
      }),
      this.#conteneur,
    );
  }
}

/**
 * Enregistre `<edb-survey>`. Appelée automatiquement à l'import ; ré-appelable
 * sans risque, ce qui évite un plantage si le bundle est chargé deux fois — cas
 * courant quand plusieurs micro-frontends cohabitent sur la même page.
 */
export function defineSurveyElement(nom: string = NOM_ELEMENT): void {
  if (typeof customElements === 'undefined') return; // rendu serveur
  if (customElements.get(nom)) return;
  customElements.define(nom, SurveyElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'edb-survey': SurveyElement;
  }
}
