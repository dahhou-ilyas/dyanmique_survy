import type { SurveyDefinition } from '@dahhouilyas/survey/core';

/**
 * Exemples couvrant les trois cas cités par le cahier des charges :
 * satisfaction, questionnaire (KYC) et conditions.
 * Ils servent de démonstration client et de jeu d'essai pour l'intégration.
 */

export const satisfactionSample: SurveyDefinition = {
  schemaVersion: 1,
  id: 'sample_satisfaction',
  title: { fr: 'Votre avis sur la banque à distance', en: 'Your digital banking experience' },
  description: {
    fr: 'Trois minutes pour nous aider à améliorer votre application.',
    en: 'Three minutes to help us improve your app.',
  },
  settings: {
    locale: 'fr',
    showProgressBar: 'top',
    showQuestionNumbers: 'off',
    showPageTitles: true,
    checkErrorsMode: 'onNextPage',
    completedHtml: {
      fr: '<h2>Merci !</h2><p>Votre retour a bien été enregistré.</p>',
      en: '<h2>Thank you!</h2><p>Your feedback has been recorded.</p>',
    },
  },
  calculatedValues: [
    { name: 'estDetracteur', expression: '{recommandation} < 7', includeIntoResult: true },
  ],
  pages: [
    {
      id: 'sat_p1',
      name: 'appreciation',
      title: { fr: 'Votre appréciation', en: 'Your rating' },
      elements: [
        {
          id: 'sat_q1',
          name: 'satisfaction',
          type: 'rating',
          title: {
            fr: 'Quel est votre niveau de satisfaction global ?',
            en: 'How satisfied are you overall?',
          },
          rateType: 'stars',
          rateMax: 5,
          isRequired: true,
          minRateDescription: { fr: 'Très insatisfait', en: 'Very dissatisfied' },
          maxRateDescription: { fr: 'Très satisfait', en: 'Very satisfied' },
        },
        {
          id: 'sat_q2',
          name: 'points_faibles',
          type: 'checkbox',
          title: { fr: 'Qu’est-ce qui vous a déçu ?', en: 'What disappointed you?' },
          visibleIf: '{satisfaction} <= 3',
          isRequired: true,
          colCount: 2,
          hasOther: true,
          otherText: { fr: 'Autre raison', en: 'Other reason' },
          choices: [
            { value: 'lenteur', text: { fr: 'Lenteur de l’application', en: 'App is slow' } },
            {
              value: 'ergonomie',
              text: { fr: 'Navigation peu claire', en: 'Confusing navigation' },
            },
            { value: 'fonctions', text: { fr: 'Fonctions manquantes', en: 'Missing features' } },
            { value: 'support', text: { fr: 'Service client', en: 'Customer support' } },
          ],
        },
        {
          id: 'sat_q3',
          name: 'recommandation',
          type: 'nps',
          title: {
            fr: 'Recommanderiez-vous notre banque à un proche ?',
            en: 'Would you recommend us to a friend?',
          },
          isRequired: true,
        },
      ],
    },
    {
      id: 'sat_p2',
      name: 'precisions',
      title: { fr: 'Pour aller plus loin', en: 'Tell us more' },
      visibleIf: '{estDetracteur} = true',
      elements: [
        {
          id: 'sat_q4',
          name: 'commentaire',
          type: 'comment',
          title: {
            fr: 'Que devrions-nous améliorer en priorité ?',
            en: 'What should we improve first?',
          },
          rows: 5,
          maxLength: 500,
          showCharacterCounter: true,
        },
        {
          id: 'sat_q5',
          name: 'rappel',
          type: 'boolean',
          title: {
            fr: 'Acceptez-vous d’être rappelé par un conseiller ?',
            en: 'May an advisor call you back?',
          },
          renderAs: 'radio',
        },
        {
          id: 'sat_q6',
          name: 'telephone',
          type: 'text',
          title: { fr: 'Votre numéro de téléphone', en: 'Your phone number' },
          inputType: 'tel',
          visibleIf: '{rappel} = true',
          requiredIf: '{rappel} = true',
          validators: [{ type: 'regex', regex: '^[+0-9 ().-]{8,20}$' }],
        },
      ],
    },
  ],
};

export const kycSample: SurveyDefinition = {
  schemaVersion: 1,
  id: 'sample_kyc',
  title: { fr: 'Mise à jour de vos informations', en: 'Update your information' },
  description: {
    fr: 'La réglementation nous impose d’actualiser régulièrement votre dossier.',
    en: 'Regulation requires us to keep your file up to date.',
  },
  settings: {
    locale: 'fr',
    showProgressBar: 'top',
    showQuestionNumbers: 'onPage',
    showPageTitles: true,
    checkErrorsMode: 'onNextPage',
    completeText: { fr: 'Valider mes informations', en: 'Submit my information' },
  },
  pages: [
    {
      id: 'kyc_p1',
      name: 'identite',
      title: { fr: 'Votre situation', en: 'Your situation' },
      elements: [
        {
          id: 'kyc_intro',
          name: 'intro',
          type: 'html',
          title: 'Introduction',
          html: {
            fr: '<p>Ces informations sont conservées de façon confidentielle et servent uniquement à respecter nos obligations réglementaires.</p>',
            en: '<p>This information is kept confidential and is used solely to meet our regulatory obligations.</p>',
          },
        },
        {
          id: 'kyc_q1',
          name: 'date_naissance',
          type: 'date',
          title: { fr: 'Votre date de naissance', en: 'Your date of birth' },
          isRequired: true,
          max: '2010-01-01',
        },
        {
          id: 'kyc_q2',
          name: 'situation_pro',
          type: 'dropdown',
          title: { fr: 'Votre situation professionnelle', en: 'Employment status' },
          isRequired: true,
          choices: [
            { value: 'salarie', text: { fr: 'Salarié(e)', en: 'Employed' } },
            { value: 'independant', text: { fr: 'Indépendant(e)', en: 'Self-employed' } },
            { value: 'retraite', text: { fr: 'Retraité(e)', en: 'Retired' } },
            { value: 'etudiant', text: { fr: 'Étudiant(e)', en: 'Student' } },
            { value: 'sans', text: { fr: 'Sans activité', en: 'Not working' } },
          ],
        },
        {
          id: 'kyc_q3',
          name: 'employeur',
          type: 'text',
          title: { fr: 'Nom de votre employeur', en: 'Employer name' },
          visibleIf: "{situation_pro} anyof ['salarie', 'independant']",
          requiredIf: "{situation_pro} = 'salarie'",
        },
      ],
    },
    {
      id: 'kyc_p2',
      name: 'patrimoine',
      title: { fr: 'Revenus et patrimoine', en: 'Income and assets' },
      elements: [
        {
          id: 'kyc_pnl',
          name: 'revenus',
          type: 'panel',
          title: { fr: 'Revenus annuels', en: 'Annual income' },
          state: 'expanded',
          elements: [
            {
              id: 'kyc_q4',
              name: 'revenu_annuel',
              type: 'number',
              title: { fr: 'Revenu net annuel', en: 'Net annual income' },
              unit: 'EUR',
              min: 0,
              isRequired: true,
            },
            {
              id: 'kyc_q5',
              name: 'origine_fonds',
              type: 'checkbox',
              title: { fr: 'Origine principale de vos fonds', en: 'Main source of funds' },
              isRequired: true,
              minSelectedChoices: 1,
              hasOther: true,
              choices: [
                { value: 'salaire', text: { fr: 'Salaires', en: 'Salary' } },
                { value: 'epargne', text: { fr: 'Épargne', en: 'Savings' } },
                { value: 'immobilier', text: { fr: 'Revenus immobiliers', en: 'Property income' } },
                {
                  value: 'heritage',
                  text: { fr: 'Héritage / donation', en: 'Inheritance / gift' },
                },
              ],
            },
          ],
        },
        {
          id: 'kyc_q6',
          name: 'ppe',
          type: 'boolean',
          title: {
            fr: 'Exercez-vous, ou avez-vous exercé, une fonction politique importante ?',
            en: 'Do you hold, or have you held, a prominent public function?',
          },
          description: {
            fr: 'Cette question découle de la réglementation sur les personnes politiquement exposées.',
            en: 'This question stems from politically exposed persons regulation.',
          },
          isRequired: true,
        },
        {
          id: 'kyc_q7',
          name: 'ppe_precisions',
          type: 'comment',
          title: { fr: 'Précisez la fonction et le pays', en: 'Specify the role and country' },
          visibleIf: '{ppe} = true',
          requiredIf: '{ppe} = true',
          rows: 3,
        },
      ],
    },
  ],
};

export const conditionsSample: SurveyDefinition = {
  schemaVersion: 1,
  id: 'sample_conditions',
  title: { fr: 'Conditions générales d’utilisation', en: 'Terms of use' },
  settings: {
    locale: 'fr',
    showProgressBar: 'off',
    showQuestionNumbers: 'off',
    showPageTitles: false,
    checkErrorsMode: 'onValueChanged',
    completeText: { fr: 'J’accepte', en: 'I accept' },
  },
  pages: [
    {
      id: 'cgu_p1',
      name: 'acceptation',
      elements: [
        {
          id: 'cgu_texte',
          name: 'texte',
          type: 'html',
          title: 'Conditions',
          html: {
            fr: '<h2>Évolution de nos conditions</h2><p>Nos conditions générales d’utilisation évoluent au 1<sup>er</sup> septembre. Les principales modifications portent sur les plafonds de virement instantané et sur la conservation des justificatifs.</p><p><a href="https://example.invalid/cgu" target="_blank" rel="noreferrer">Consulter le texte complet</a></p>',
            en: '<h2>Updated terms</h2><p>Our terms of use change on 1 September. The main changes concern instant transfer limits and document retention.</p>',
          },
        },
        {
          id: 'cgu_q1',
          name: 'accepte',
          type: 'boolean',
          title: {
            fr: 'J’ai lu et j’accepte les nouvelles conditions générales.',
            en: 'I have read and accept the new terms.',
          },
          isRequired: true,
          renderAs: 'switch',
          requiredErrorText: {
            fr: 'Vous devez accepter les conditions pour continuer.',
            en: 'You must accept the terms to continue.',
          },
        },
      ],
    },
  ],
};

export const samples = {
  satisfaction: satisfactionSample,
  kyc: kycSample,
  conditions: conditionsSample,
} as const;

export type SampleKey = keyof typeof samples;

export const SAMPLE_LABELS: Record<SampleKey, string> = {
  satisfaction: 'Satisfaction',
  kyc: 'KYC',
  conditions: 'Conditions',
};
