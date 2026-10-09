import { useTranslation } from 'react-i18next';

const steps = [
  { titleKey: 'auth.stepReport', descriptionKey: 'auth.stepReportDescription' },
  { titleKey: 'auth.stepAssigned', descriptionKey: 'auth.stepAssignedDescription' },
  { titleKey: 'auth.stepResolved', descriptionKey: 'auth.stepResolvedDescription' }
];

export default function AuthSteps() {
  const { t } = useTranslation();

  return (
    <div className="auth-steps">
      <ol aria-label={t('auth.howItWorks')}>
        {steps.map((step, index) => (
          <li key={step.titleKey}>
            <span className="auth-step-number" aria-hidden="true">{index + 1}</span>
            <span className="auth-step-copy">
              <strong>{t(step.titleKey)}</strong>
              <small>{t(step.descriptionKey)}</small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
