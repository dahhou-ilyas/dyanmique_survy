import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { firstQuestion, minimalSurvey, satisfactionSurvey } from '../../tests/fixtures';
import { createQuestion, createSurvey } from '../core/schema/defaults';
import type { SurveyDefinition } from '../core/schema/types';
import { SurveyRenderer } from './SurveyRenderer';

function renderSurvey(definition: SurveyDefinition, props = {}) {
  return render(<SurveyRenderer definition={definition} {...props} />);
}

describe('structure et libellés', () => {
  it('affiche le titre du sondage et de la page', () => {
    renderSurvey(satisfactionSurvey());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Satisfaction client');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Votre avis');
  });

  it('rend les libellés dans la locale demandée', () => {
    renderSurvey(satisfactionSurvey(), { locale: 'en' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Customer satisfaction');
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('n’affiche pas les questions masquées par une condition', () => {
    renderSurvey(satisfactionSurvey());
    expect(screen.queryByText(/Que pouvons-nous améliorer/)).not.toBeInTheDocument();
  });

  it('signale un type de question sans composant enregistré', () => {
    const survey = minimalSurvey();
    survey.pages[0]!.elements[0]!.type = 'signature' as never;
    renderSurvey(survey);
    expect(screen.getByRole('alert')).toHaveTextContent(/Aucun composant enregistré/);
  });
});

describe('saisie et liaison au moteur', () => {
  it('remonte les saisies via onValueChanged', async () => {
    const user = userEvent.setup();
    const onValueChanged = vi.fn();
    renderSurvey(minimalSurvey(), { onValueChanged });

    await user.type(screen.getByLabelText(/Votre nom/), 'Dupont');

    expect(onValueChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'nom', value: 'Dupont' }),
    );
  });

  it('révèle une question dès que sa condition devient vraie', async () => {
    const user = userEvent.setup();
    renderSurvey(satisfactionSurvey());

    await user.click(screen.getByRole('radio', { name: '2 / 5' }));

    expect(screen.getByLabelText(/Que pouvons-nous améliorer/)).toBeInTheDocument();
  });

  it('coche et décoche les choix multiples', async () => {
    const user = userEvent.setup();
    const survey = createSurvey();
    survey.pages[0]!.elements = [createQuestion('checkbox', 'canaux')];
    const onValueChanged = vi.fn();
    renderSurvey(survey, { onValueChanged });

    await user.click(screen.getByRole('checkbox', { name: 'Option 1' }));
    await user.click(screen.getByRole('checkbox', { name: 'Option 3' }));
    expect(onValueChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: ['item1', 'item3'] }),
    );

    await user.click(screen.getByRole('checkbox', { name: 'Option 1' }));
    expect(onValueChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: ['item3'] }),
    );
  });

  it('conserve l’ordre des options plutôt que l’ordre de cochage', async () => {
    const user = userEvent.setup();
    const survey = createSurvey();
    survey.pages[0]!.elements = [createQuestion('checkbox', 'canaux')];
    const onValueChanged = vi.fn();
    renderSurvey(survey, { onValueChanged });

    await user.click(screen.getByRole('checkbox', { name: 'Option 3' }));
    await user.click(screen.getByRole('checkbox', { name: 'Option 1' }));

    expect(onValueChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: ['item1', 'item3'] }),
    );
  });

  it('restitue la valeur d’origine d’une option numérique via la liste déroulante', async () => {
    const user = userEvent.setup();
    const survey = createSurvey();
    const question = createQuestion('dropdown', 'note');
    if (question.type === 'dropdown') {
      question.choices = [
        { value: 1, text: 'Un' },
        { value: 2, text: 'Deux' },
      ];
    }
    survey.pages[0]!.elements = [question];
    const onValueChanged = vi.fn();
    renderSurvey(survey, { onValueChanged });

    await user.selectOptions(screen.getByRole('combobox'), '2');

    // La valeur remontée est le nombre 2, pas la chaîne « 2 ».
    expect(onValueChanged).toHaveBeenLastCalledWith(expect.objectContaining({ value: 2 }));
  });
});

describe('option « Autre »', () => {
  it('affiche le champ libre uniquement quand l’option est sélectionnée', async () => {
    const user = userEvent.setup();
    const survey = createSurvey();
    const question = createQuestion('radiogroup', 'canal');
    if (question.type === 'radiogroup') {
      question.hasOther = true;
      question.otherText = 'Autre canal';
    }
    survey.pages[0]!.elements = [question];
    renderSurvey(survey);

    // Le bouton radio porte le même libellé : on cible explicitement le champ texte.
    expect(screen.queryByRole('textbox', { name: 'Autre canal' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Autre canal' }));
    expect(screen.getByRole('textbox', { name: 'Autre canal' })).toBeInTheDocument();
  });
});

describe('validation et navigation', () => {
  it('bloque la navigation et affiche l’erreur', async () => {
    const user = userEvent.setup();
    renderSurvey(satisfactionSurvey());

    await user.click(screen.getByRole('button', { name: /Suivant/ }));

    expect(screen.getByText('Cette question est obligatoire.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Votre avis');
  });

  it('n’affiche aucune erreur avant la première tentative', () => {
    renderSurvey(satisfactionSurvey());
    expect(screen.queryByText('Cette question est obligatoire.')).not.toBeInTheDocument();
  });

  it('passe à la page suivante quand la page est valide', async () => {
    const user = userEvent.setup();
    renderSurvey(satisfactionSurvey());

    await user.click(screen.getByRole('radio', { name: '5 / 5' }));
    await user.click(screen.getByRole('button', { name: /Suivant/ }));

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Vous concernant');
  });

  it('revient à la page précédente', async () => {
    const user = userEvent.setup();
    renderSurvey(satisfactionSurvey());

    await user.click(screen.getByRole('radio', { name: '5 / 5' }));
    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    await user.click(screen.getByRole('button', { name: /Précédent/ }));

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Votre avis');
  });

  it('clôture le sondage et transmet le résultat', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    renderSurvey(minimalSurvey(), { onComplete });

    await user.type(screen.getByLabelText(/Votre nom/), 'Dupont');
    await user.click(screen.getByRole('button', { name: /Terminer/ }));

    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete.mock.calls[0]![0]).toMatchObject({
      surveyId: 'srv_min',
      answers: [expect.objectContaining({ questionName: 'nom', displayValue: 'Dupont' })],
    });
    expect(screen.getByText('Merci !')).toBeInTheDocument();
  });

  it('affiche le récapitulatif du nombre d’erreurs', async () => {
    const user = userEvent.setup();
    const survey = minimalSurvey();
    survey.pages[0]!.elements.push({
      id: 'q2',
      name: 'prenom',
      type: 'text',
      title: 'Votre prénom',
      isRequired: true,
    });
    renderSurvey(survey);

    await user.click(screen.getByRole('button', { name: /Terminer/ }));

    expect(screen.getByText('2 questions nécessitent votre attention.')).toBeInTheDocument();
  });
});

describe('mode lecture seule', () => {
  it('désactive tous les contrôles', () => {
    renderSurvey(minimalSurvey(), { mode: 'display' });
    expect(screen.getByLabelText(/Votre nom/)).toBeDisabled();
  });
});

describe('groupes', () => {
  it('rend un groupe repliable et bascule son contenu', async () => {
    const user = userEvent.setup();
    const survey = satisfactionSurvey();
    firstQuestion(survey).isRequired = false;
    renderSurvey(survey);

    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    const toggle = screen.getByRole('button', { name: /Coordonnées/ });

    expect(screen.getByLabelText(/Votre e-mail/)).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.queryByLabelText(/Votre e-mail/)).not.toBeInTheDocument();
  });
});

describe('bloc de contenu', () => {
  it('affiche le HTML assaini', () => {
    const survey = createSurvey();
    const block = createQuestion('html', 'intro');
    if (block.type === 'html') {
      block.html = '<p>Conditions <strong>générales</strong></p>';
    }
    survey.pages[0]!.elements = [block];
    const { container } = renderSurvey(survey);

    expect(container.querySelector('.edbs-html strong')).toHaveTextContent('générales');
  });

  it('retire les scripts et les attributs événementiels', () => {
    const survey = createSurvey();
    const block = createQuestion('html', 'intro');
    if (block.type === 'html') {
      block.html = '<p onclick="alert(1)">Texte</p><script>alert(2)</script><img src=x onerror=alert(3)>';
    }
    survey.pages[0]!.elements = [block];
    const { container } = renderSurvey(survey);

    const html = container.querySelector('.edbs-html')!;
    expect(html.querySelector('script')).toBeNull();
    expect(html.querySelector('img')).toBeNull();
    expect(html.querySelector('p')!.getAttribute('onclick')).toBeNull();
    expect(html).toHaveTextContent('Texte');
  });
});

describe('progression', () => {
  it('expose la progression aux technologies d’assistance', () => {
    renderSurvey(satisfactionSurvey());
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '1');
    expect(progress).toHaveAttribute('aria-valuemax', '2');
  });

  it('masque la barre sur un sondage d’une seule page', () => {
    renderSurvey(minimalSurvey());
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

describe('numérotation des questions', () => {
  it('numérote les questions visibles quand le réglage est actif', async () => {
    const user = userEvent.setup();
    const survey = satisfactionSurvey();
    survey.settings.showQuestionNumbers = 'onPage';
    renderSurvey(survey);

    const groups = screen.getAllByRole('group');
    expect(within(groups[0]!).getByText('1.')).toBeInTheDocument();

    // La question conditionnelle s'insère en 2 et décale la suivante.
    await user.click(screen.getByRole('radio', { name: '2 / 5' }));
    expect(screen.getByText('3.')).toBeInTheDocument();
  });
});
