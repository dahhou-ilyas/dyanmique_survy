import type { HtmlQuestion } from '../../schema/types';
import type { QuestionTypeDescriptor } from '../types';

/**
 * Bloc de contenu : introduction, conditions générales, mention légale.
 * Ne produit aucune réponse — d'où `hasValue: false`, qui l'exclut du résultat
 * et de tout contrôle d'obligation.
 */
export const htmlDescriptor: QuestionTypeDescriptor<HtmlQuestion> = {
  type: 'html',
  category: 'content',
  label: { fr: 'Bloc de contenu', en: 'Content block' },
  icon: 'html',
  hasValue: false,
  supportsChoices: false,

  createDefault: (name, id) => ({
    id,
    name,
    type: 'html',
    title: { fr: 'Bloc de contenu', en: 'Content block' },
    html: {
      fr: '<p>Saisissez votre texte ici.</p>',
      en: '<p>Type your content here.</p>',
    },
  }),

  properties: [
    {
      name: 'html',
      label: { fr: 'Contenu HTML', en: 'HTML content' },
      description: {
        fr: 'Le contenu est assaini avant affichage : scripts et attributs événementiels sont retirés.',
        en: 'Content is sanitised before display: scripts and event attributes are stripped.',
      },
      editor: 'localizedHtml',
      group: 'general',
    },
  ],

  isEmpty: () => true,
  getDisplayValue: () => '',
};
