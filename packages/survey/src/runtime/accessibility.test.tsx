import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { satisfactionSurvey } from '../../tests/fixtures';
import { createQuestion, createSurvey } from '../core/schema/defaults';
import type { SurveyDefinition } from '../core/schema/types';
import { SurveyRenderer } from './SurveyRenderer';

/**
 * Contrôles d'accessibilité automatisés (axe-core, règles WCAG 2.1 A et AA).
 *
 * Ils ne remplacent pas un audit manuel — un outil ne juge ni la pertinence d'un
 * libellé ni l'ordre de tabulation — mais ils verrouillent les régressions
 * structurelles : libellé manquant, contraste, rôle incohérent.
 */
async function expectNoViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  });
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}) : ${violation.help}\n  ` +
      violation.nodes.map((node) => node.html).join('\n  '),
  );
  expect(summary, summary.join('\n')).toEqual([]);
}

function surveyWithEveryType(): SurveyDefinition {
  const survey = createSurvey();
  survey.title = 'Tous les types';
  survey.pages[0]!.elements = [
    createQuestion('text', 'texte'),
    createQuestion('comment', 'commentaire'),
    createQuestion('radiogroup', 'radio'),
    createQuestion('checkbox', 'cases'),
    createQuestion('dropdown', 'liste'),
    createQuestion('date', 'date'),
    createQuestion('number', 'nombre'),
    createQuestion('rating', 'note'),
    createQuestion('nps', 'recommandation'),
    createQuestion('boolean', 'ouiNon'),
    createQuestion('html', 'contenu'),
  ];
  return survey;
}

describe('accessibilité', () => {
  it('aucune violation sur un sondage couvrant tous les types de questions', async () => {
    const { container } = render(<SurveyRenderer definition={surveyWithEveryType()} />);
    await expectNoViolations(container);
  });

  it('aucune violation avec des groupes et une logique conditionnelle', async () => {
    const user = userEvent.setup();
    const { container } = render(<SurveyRenderer definition={satisfactionSurvey()} />);

    await user.click(screen.getByRole('radio', { name: '2 / 5' }));
    await expectNoViolations(container);
  });

  it('aucune violation lorsque des erreurs sont affichées', async () => {
    const user = userEvent.setup();
    const { container } = render(<SurveyRenderer definition={satisfactionSurvey()} />);

    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    await expectNoViolations(container);
  });

  it('aucune violation en thème sombre', async () => {
    const { container } = render(
      <SurveyRenderer definition={surveyWithEveryType()} theme="dark" />,
    );
    await expectNoViolations(container);
  });
});

describe('sémantique et clavier', () => {
  it('associe chaque champ simple à son libellé', () => {
    render(<SurveyRenderer definition={surveyWithEveryType()} />);
    expect(screen.getByLabelText('Question texte')).toBeInTheDocument();
    expect(screen.getByLabelText('Question date')).toBeInTheDocument();
    expect(screen.getByLabelText('Question numérique')).toBeInTheDocument();
  });

  it('groupe les choix multiples dans un fieldset nommé', () => {
    render(<SurveyRenderer definition={surveyWithEveryType()} />);
    expect(
      screen.getByRole('group', { name: /Question à choix multiple/ }),
    ).toBeInTheDocument();
  });

  it('annonce le caractère obligatoire aux lecteurs d’écran', () => {
    const survey = createSurvey();
    const question = createQuestion('text', 'nom');
    question.title = 'Votre nom';
    question.isRequired = true;
    survey.pages[0]!.elements = [question];
    render(<SurveyRenderer definition={survey} />);

    const field = screen.getByLabelText(/Votre nom/);
    expect(field).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('(obligatoire)')).toBeInTheDocument();
  });

  it('relie le message d’erreur au champ via aria-describedby', async () => {
    const user = userEvent.setup();
    const survey = createSurvey();
    const question = createQuestion('text', 'nom');
    question.title = 'Votre nom';
    question.isRequired = true;
    survey.pages[0]!.elements = [question];
    render(<SurveyRenderer definition={survey} />);

    await user.click(screen.getByRole('button', { name: /Terminer/ }));

    const field = screen.getByLabelText(/Votre nom/);
    const describedBy = field.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      'Cette question est obligatoire.',
    );
  });

  it('déplace le focus sur le premier champ en erreur', async () => {
    const user = userEvent.setup();
    render(<SurveyRenderer definition={satisfactionSurvey()} />);

    await user.click(screen.getByRole('button', { name: /Suivant/ }));

    // La question de satisfaction est un groupe de radios : le focus va sur le premier cran.
    expect(document.activeElement).toHaveAttribute('name', 'satisfaction');
  });

  it('déplace le focus sur la page à chaque changement d’étape', async () => {
    const user = userEvent.setup();
    const { container } = render(<SurveyRenderer definition={satisfactionSurvey()} />);

    await user.click(screen.getByRole('radio', { name: '5 / 5' }));
    await user.click(screen.getByRole('button', { name: /Suivant/ }));

    expect(document.activeElement).toBe(container.querySelector('.edbs-page__anchor'));
  });

  it('permet de parcourir une échelle de notation au clavier', async () => {
    const user = userEvent.setup();
    const survey = createSurvey();
    survey.pages[0]!.elements = [createQuestion('rating', 'note')];
    render(<SurveyRenderer definition={survey} />);

    await user.tab();
    expect(screen.getByRole('radio', { name: '1 / 5' })).toHaveFocus();
    // Les flèches naviguent nativement dans un groupe de boutons radio.
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '2 / 5' })).toBeChecked();
  });
});
