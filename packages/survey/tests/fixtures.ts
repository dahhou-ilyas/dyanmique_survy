import {
  isPanel,
  CURRENT_SCHEMA_VERSION,
  type Question,
  type SurveyDefinition,
} from '../src/core/schema/types';

/**
 * Première question de la première page, typée comme telle.
 * Renvoie la référence vivante : la muter modifie bien le sondage.
 */
export function firstQuestion(survey: SurveyDefinition): Question {
  const element = survey.pages[0]?.elements[0];
  if (!element || isPanel(element)) {
    throw new Error('Le sondage de test ne commence pas par une question.');
  }
  return element;
}

/**
 * Sondage de satisfaction couvrant les cas structurants : plusieurs pages,
 * logique conditionnelle, panel, options « Autre », validateurs, valeur calculée
 * et déclencheur. Sert de base à la majorité des tests du moteur.
 */
export function satisfactionSurvey(): SurveyDefinition {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'srv_satisfaction',
    title: { fr: 'Satisfaction client', en: 'Customer satisfaction' },
    settings: {
      locale: 'fr',
      showProgressBar: 'top',
      showQuestionNumbers: 'off',
      showPageTitles: true,
      checkErrorsMode: 'onNextPage',
    },
    calculatedValues: [
      { name: 'estDetracteur', expression: '{recommandation} < 7', includeIntoResult: true },
    ],
    pages: [
      {
        id: 'p1',
        name: 'page1',
        title: { fr: 'Votre avis', en: 'Your opinion' },
        elements: [
          {
            id: 'q1',
            name: 'satisfaction',
            type: 'rating',
            title: { fr: 'Votre satisfaction globale', en: 'Overall satisfaction' },
            rateMax: 5,
            rateType: 'stars',
            isRequired: true,
          },
          {
            id: 'q2',
            name: 'commentaire',
            type: 'comment',
            title: { fr: 'Que pouvons-nous améliorer ?', en: 'What can we improve?' },
            visibleIf: '{satisfaction} <= 3',
            isRequired: true,
            rows: 4,
          },
          {
            id: 'q3',
            name: 'recommandation',
            type: 'nps',
            title: { fr: 'Nous recommanderiez-vous ?', en: 'Would you recommend us?' },
          },
        ],
      },
      {
        id: 'p2',
        name: 'page2',
        title: { fr: 'Vous concernant', en: 'About you' },
        elements: [
          {
            id: 'pnl1',
            name: 'coordonnees',
            type: 'panel',
            title: { fr: 'Coordonnées', en: 'Contact details' },
            state: 'expanded',
            elements: [
              {
                id: 'q4',
                name: 'email',
                type: 'text',
                title: { fr: 'Votre e-mail', en: 'Your email' },
                inputType: 'email',
                validators: [{ type: 'email' }],
              },
              {
                id: 'q5',
                name: 'age',
                type: 'number',
                title: { fr: 'Votre âge', en: 'Your age' },
                min: 18,
                max: 120,
                validators: [{ type: 'numeric', minValue: 18, maxValue: 120 }],
              },
            ],
          },
          {
            id: 'q6',
            name: 'canaux',
            type: 'checkbox',
            title: { fr: 'Canaux utilisés', en: 'Channels used' },
            choices: [
              { value: 'app', text: { fr: 'Application mobile', en: 'Mobile app' } },
              { value: 'web', text: { fr: 'Site web', en: 'Website' } },
              { value: 'agence', text: { fr: 'Agence', en: 'Branch' } },
            ],
            hasOther: true,
            otherText: { fr: 'Autre canal', en: 'Other channel' },
          },
          {
            id: 'q7',
            name: 'segment',
            type: 'dropdown',
            title: { fr: 'Votre profil', en: 'Your profile' },
            choices: [
              { value: 'part', text: { fr: 'Particulier', en: 'Individual' } },
              { value: 'pro', text: { fr: 'Professionnel', en: 'Business' } },
            ],
          },
        ],
      },
    ],
  };
}

/** Sondage minimal : une page, une question obligatoire. */
export function minimalSurvey(): SurveyDefinition {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'srv_min',
    title: 'Minimal',
    settings: {
      locale: 'fr',
      showProgressBar: 'off',
      showQuestionNumbers: 'off',
      showPageTitles: false,
      checkErrorsMode: 'onNextPage',
    },
    pages: [
      {
        id: 'p1',
        name: 'page1',
        elements: [
          {
            id: 'q1',
            name: 'nom',
            type: 'text',
            title: 'Votre nom',
            isRequired: true,
          },
        ],
      },
    ],
  };
}
