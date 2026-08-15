import { memo, type ReactNode } from 'react';
import type { LocalizedString } from '../../core/schema/types';
import type { ValidationError } from '../../core/validation/validators';
import type { Translate } from '../../i18n/messages';
import { useSurveyContext } from '../SurveyProvider';
import { useQuestionSnapshot } from '../hooks/useSurveyEngine';
import { usesGroupSemantics, type FieldProps } from '../types';
import { ErrorIcon } from './ui/icons';

/** Résout un message d'erreur : texte personnalisé s'il existe, sinon libellé traduit. */
function errorMessage(
  error: ValidationError,
  t: Translate,
  text: (value: LocalizedString | undefined) => string,
): string {
  if (error.customText) {
    const custom = text(error.customText);
    if (custom !== '') return custom;
  }
  return t(error.key, error.params);
}

export interface QuestionRendererProps {
  name: string;
}

/**
 * Rend une question à partir de son instantané.
 *
 * `memo` + abonnement ciblé (`useQuestionSnapshot`) : ce composant ne se rend que
 * lorsque *sa* question change. Saisir dans un champ ne provoque donc aucun rendu
 * dans les autres questions de la page.
 */
export const QuestionRenderer = memo(function QuestionRenderer({
  name,
}: QuestionRendererProps): ReactNode {
  const { engine, components, t, text } = useSurveyContext();
  const snapshot = useQuestionSnapshot(name);

  if (!snapshot || !snapshot.visible) return null;

  const { question } = snapshot;
  const Field = components[question.type] as ((props: FieldProps) => ReactNode) | undefined;

  if (!Field) {
    // Un type sans composant est une erreur d'intégration, pas une donnée invalide :
    // on le signale visiblement plutôt que de rendre un trou silencieux.
    return (
      <div className="edbs-question edbs-summary-error" role="alert">
        {`Aucun composant enregistré pour le type de question « ${question.type} ».`}
      </div>
    );
  }

  const fieldId = `edbs-f-${question.id}`;
  const label = text(question.title);
  const description = text(question.description);
  const descriptionId = description === '' ? undefined : `${fieldId}-desc`;

  const showErrors = snapshot.showErrors && snapshot.errors.length > 0;
  const errorId = showErrors ? `${fieldId}-err` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  const isContentBlock = question.type === 'html';
  const grouped = usesGroupSemantics(question);

  const labelContent = (
    <LabelContent number={snapshot.number} label={label} required={snapshot.required} t={t} />
  );

  const descriptionNode = description !== '' && (
    <p id={descriptionId} className="edbs-question__description">
      {description}
    </p>
  );

  const control = (
    <div className="edbs-question__control">
      <Field
        snapshot={snapshot}
        question={question}
        id={fieldId}
        describedBy={describedBy}
        onChange={(value) => engine.setValue(name, value)}
      />
    </div>
  );

  const errorNode = showErrors && (
    <div id={errorId} className="edbs-question__error" role="alert">
      <ErrorIcon className="edbs-question__error-icon" />
      <span>{snapshot.errors.map((error) => errorMessage(error, t, text)).join(' ')}</span>
    </div>
  );

  const className =
    'edbs-question' +
    (showErrors ? ' edbs-question--invalid' : '') +
    (snapshot.enabled ? '' : ' edbs-question--disabled');

  // `data-edbs-question` sert de point d'ancrage au déplacement du focus vers
  // la première question en erreur.
  if (grouped) {
    // Le `<legend>` doit être le **premier enfant** du `<fieldset>` : c'est la seule
    // position où le navigateur en fait le nom accessible du groupe. L'envelopper
    // dans un conteneur, même pour la mise en page, prive le groupe de son libellé.
    return (
      <fieldset className={`${className} edbs-fieldset`} data-edbs-question={name}>
        <legend className="edbs-question__label">{labelContent}</legend>
        {descriptionNode}
        {control}
        {errorNode}
      </fieldset>
    );
  }

  return (
    <div className={className} data-edbs-question={name}>
      {!isContentBlock && (
        <div className="edbs-question__header">
          <label className="edbs-question__label" htmlFor={fieldId}>
            {labelContent}
          </label>
          {descriptionNode}
        </div>
      )}
      {control}
      {errorNode}
    </div>
  );
});

function LabelContent({
  number,
  label,
  required,
  t,
}: {
  number: number | undefined;
  label: string;
  required: boolean;
  t: Translate;
}): ReactNode {
  return (
    <>
      {number !== undefined && (
        <span className="edbs-question__number" aria-hidden="true">
          {number}.
        </span>
      )}
      {label}
      {required && (
        <span className="edbs-question__required" aria-hidden="true">
          {t('requiredIndicator')}
        </span>
      )}
      {required && <span className="edbs-visually-hidden"> ({t('requiredHint')})</span>}
    </>
  );
}
