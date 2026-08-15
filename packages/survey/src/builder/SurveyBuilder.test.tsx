import axe from 'axe-core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { satisfactionSurvey } from '../../tests/fixtures';
import { createSurvey } from '../core/schema/defaults';
import type { SurveyDefinition } from '../core/schema/types';
import { SurveyBuilder } from './SurveyBuilder';

function renderBuilder(definition: SurveyDefinition = satisfactionSurvey(), props = {}) {
  return render(<SurveyBuilder value={definition} {...props} />);
}

describe('ossature', () => {
  it('affiche la palette, le canevas et les propriétés', () => {
    renderBuilder();
    expect(screen.getByRole('complementary', { name: 'Types de questions' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Propriétés' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Pages' })).toBeInTheDocument();
  });

  it('liste les questions de la page courante', () => {
    renderBuilder();
    expect(screen.getByText('Votre satisfaction globale')).toBeInTheDocument();
    expect(screen.getByText('Nous recommanderiez-vous ?')).toBeInTheDocument();
  });

  it('bascule de page', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('tab', { name: /Vous concernant/ }));

    expect(screen.getByText('Coordonnées')).toBeInTheDocument();
  });
});

describe('ajout et suppression', () => {
  it('ajoute une question depuis la palette', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBuilder(createSurvey(), { onChange });

    await user.click(screen.getByRole('button', { name: 'Texte court' }));

    expect(onChange).toHaveBeenCalled();
    const survey = onChange.mock.calls.at(-1)![0] as SurveyDefinition;
    expect(survey.pages[0]!.elements).toHaveLength(1);
    expect(survey.pages[0]!.elements[0]!.type).toBe('text');
  });

  it('supprime une question', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBuilder(satisfactionSurvey(), { onChange });

    await user.click(
      screen.getByRole('button', { name: /Supprimer : Votre satisfaction globale/ }),
    );

    const survey = onChange.mock.calls.at(-1)![0] as SurveyDefinition;
    expect(survey.pages[0]!.elements).toHaveLength(2);
  });

  it('duplique une question', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBuilder(satisfactionSurvey(), { onChange });

    await user.click(
      screen.getByRole('button', { name: /Dupliquer : Votre satisfaction globale/ }),
    );

    const survey = onChange.mock.calls.at(-1)![0] as SurveyDefinition;
    expect(survey.pages[0]!.elements).toHaveLength(4);
  });

  it('ajoute une page', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBuilder(satisfactionSurvey(), { onChange });

    await user.click(screen.getByRole('button', { name: 'Ajouter une page' }));

    const survey = onChange.mock.calls.at(-1)![0] as SurveyDefinition;
    expect(survey.pages).toHaveLength(3);
  });
});

describe('panneau de propriétés généré', () => {
  it('affiche les propriétés du type sélectionné', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /^Votre satisfaction globale/ }));

    const panel = screen.getByRole('complementary', { name: 'Propriétés' });
    // Propriétés propres au type « rating », issues de son descripteur.
    expect(within(panel).getByLabelText('Affichage')).toBeInTheDocument();
    expect(within(panel).getByLabelText('Nombre de crans')).toBeInTheDocument();
    expect(within(panel).getByLabelText('Obligatoire')).toBeInTheDocument();
  });

  it('modifie un libellé et le répercute dans le canevas', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /^Nous recommanderiez-vous/ }));
    const panel = screen.getByRole('complementary', { name: 'Propriétés' });
    const titleField = within(panel).getByLabelText('Libellé');

    await user.clear(titleField);
    await user.type(titleField, 'Nouveau libellé');

    expect(screen.getByText('Nouveau libellé')).toBeInTheDocument();
  });

  it('n’affiche pas la validation pour un bloc de contenu', async () => {
    const user = userEvent.setup();
    renderBuilder(createSurvey());

    await user.click(screen.getByRole('button', { name: 'Bloc de contenu' }));

    const panel = screen.getByRole('complementary', { name: 'Propriétés' });
    expect(within(panel).queryByLabelText('Obligatoire')).not.toBeInTheDocument();
    expect(within(panel).getByLabelText('Contenu HTML')).toBeInTheDocument();
  });

  it('révèle les propriétés dépendantes quand leur condition devient vraie', async () => {
    const user = userEvent.setup();
    renderBuilder(createSurvey());

    await user.click(screen.getByRole('button', { name: 'Choix unique' }));
    const panel = screen.getByRole('complementary', { name: 'Propriétés' });

    expect(within(panel).queryByLabelText('Libellé de « Autre »')).not.toBeInTheDocument();
    await user.click(within(panel).getByLabelText('Proposer « Autre »'));
    expect(within(panel).getByLabelText('Libellé de « Autre »')).toBeInTheDocument();
  });

  it('empêche un nom en doublon', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBuilder(satisfactionSurvey(), { onChange });

    await user.click(screen.getByRole('button', { name: /^Nous recommanderiez-vous/ }));
    const panel = screen.getByRole('complementary', { name: 'Propriétés' });
    const nameField = within(panel).getByLabelText('Identifiant');

    await user.clear(nameField);
    await user.type(nameField, 'satisfaction');

    const survey = onChange.mock.calls.at(-1)![0] as SurveyDefinition;
    const names = survey.pages[0]!.elements.map((element) => element.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('éditeur d’options', () => {
  it('ajoute et retire des options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBuilder(createSurvey(), { onChange });

    await user.click(screen.getByRole('button', { name: 'Choix unique' }));
    const panel = screen.getByRole('complementary', { name: 'Propriétés' });

    await user.click(within(panel).getByRole('button', { name: 'Ajouter une option' }));
    let survey = onChange.mock.calls.at(-1)![0] as SurveyDefinition;
    expect((survey.pages[0]!.elements[0] as { choices: unknown[] }).choices).toHaveLength(4);

    await user.click(within(panel).getByRole('button', { name: /Supprimer l’option 1/ }));
    survey = onChange.mock.calls.at(-1)![0] as SurveyDefinition;
    expect((survey.pages[0]!.elements[0] as { choices: unknown[] }).choices).toHaveLength(3);
  });

  it('remplace les options via la saisie en masse', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBuilder(createSurvey(), { onChange });

    await user.click(screen.getByRole('button', { name: 'Choix unique' }));
    const panel = screen.getByRole('complementary', { name: 'Propriétés' });

    await user.click(within(panel).getByRole('button', { name: 'Saisie en masse' }));
    const textarea = within(panel).getByRole('textbox', { name: 'Saisie en masse' });
    await user.clear(textarea);
    await user.type(textarea, 'oui | Oui, tout à fait\nnon | Non');
    await user.click(within(panel).getByRole('button', { name: 'Appliquer' }));

    const survey = onChange.mock.calls.at(-1)![0] as SurveyDefinition;
    expect((survey.pages[0]!.elements[0] as { choices: unknown[] }).choices).toEqual([
      { value: 'oui', text: 'Oui, tout à fait' },
      { value: 'non', text: 'Non' },
    ]);
  });
});

describe('éditeur d’expression', () => {
  it('signale une expression invalide sans bloquer la saisie', async () => {
    const user = userEvent.setup();
    renderBuilder(satisfactionSurvey());

    await user.click(screen.getByRole('button', { name: /^Nous recommanderiez-vous/ }));
    const panel = screen.getByRole('complementary', { name: 'Propriétés' });
    const field = within(panel).getByLabelText('Afficher si');

    await user.type(field, '{{satisfaction} =');

    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(within(panel).getByRole('alert')).toBeInTheDocument();
  });

  it('accepte une expression valide', async () => {
    const user = userEvent.setup();
    renderBuilder(satisfactionSurvey());

    await user.click(screen.getByRole('button', { name: /^Nous recommanderiez-vous/ }));
    const panel = screen.getByRole('complementary', { name: 'Propriétés' });
    const field = within(panel).getByLabelText('Afficher si');

    await user.type(field, '{{satisfaction} > 3');

    expect(field).not.toHaveAttribute('aria-invalid');
  });
});

describe('historique', () => {
  it('annule puis rétablit via la barre d’outils', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBuilder(createSurvey(), { onChange });

    await user.click(screen.getByRole('button', { name: 'Texte court' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect((onChange.mock.calls.at(-1)![0] as SurveyDefinition).pages[0]!.elements).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Rétablir' }));
    expect((onChange.mock.calls.at(-1)![0] as SurveyDefinition).pages[0]!.elements).toHaveLength(1);
  });

  it('désactive les boutons quand il n’y a rien à annuler', () => {
    renderBuilder();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rétablir' })).toBeDisabled();
  });
});

describe('enregistrement', () => {
  it('n’affiche le bouton que si onSave est fourni', () => {
    renderBuilder();
    expect(screen.queryByRole('button', { name: /Enregistrer/ })).not.toBeInTheDocument();
  });

  it('transmet la définition et repasse à l’état enregistré', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderBuilder(createSurvey(), { onSave });

    await user.click(screen.getByRole('button', { name: 'Texte court' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Enregistré' })).toBeDisabled();
  });
});

describe('onglets', () => {
  it('affiche l’aperçu avec le vrai moteur de rendu', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('tab', { name: 'Aperçu' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Satisfaction client');
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeInTheDocument();
  });

  it('liste les règles conditionnelles', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('tab', { name: 'Logique' }));

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('{satisfaction} <= 3')).toBeInTheDocument();
  });

  it('liste les textes à traduire et compte l’avancement', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('tab', { name: 'Traductions' }));

    expect(screen.getByText(/traduits$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sondage · titre — EN/)).toHaveValue('Customer satisfaction');
  });

  it('affiche le JSON et refuse une saisie invalide', async () => {
    const user = userEvent.setup();
    renderBuilder(createSurvey());

    await user.click(screen.getByRole('tab', { name: 'JSON' }));
    const editor = screen.getByLabelText('Définition JSON du sondage');

    await user.clear(editor);
    await user.type(editor, '{{ nawak');
    await user.click(screen.getByRole('button', { name: 'Appliquer le JSON' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/JSON invalide/);
  });
});

describe('diagnostics', () => {
  it('signale un sondage sain', () => {
    renderBuilder();
    expect(screen.getByText('Aucun problème détecté.')).toBeInTheDocument();
  });

  it('signale une référence cassée et permet de l’atteindre', async () => {
    const user = userEvent.setup();
    const survey = satisfactionSurvey();
    survey.pages[0]!.elements[2]!.visibleIf = '{jexistepas} = 1';
    renderBuilder(survey);

    const diagnostic = screen.getByRole('button', { name: /ne correspond à aucune question/ });
    await user.click(diagnostic);

    const panel = screen.getByRole('complementary', { name: 'Propriétés' });
    expect(within(panel).getByLabelText('Identifiant')).toHaveValue('recommandation');
  });
});

describe('accessibilité', () => {
  it('aucune violation axe sur le concepteur', async () => {
    const { container } = renderBuilder();
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    const summary = results.violations.map(
      (violation) => `${violation.id} : ${violation.help}\n  ${violation.nodes[0]?.html ?? ''}`,
    );
    expect(summary, summary.join('\n')).toEqual([]);
  });
});
