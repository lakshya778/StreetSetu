import { useTranslation } from 'react-i18next';

const steps = [
  {
    titleKey: 'auth.stepReport',
    descriptionKey: 'auth.stepReportDescription',
    icon: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z" /></>
  },
  {
    titleKey: 'auth.stepAssigned',
    descriptionKey: 'auth.stepAssignedDescription',
    icon: <><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a6 6 0 0 1 12 0v2" /><path d="m16 11 2 2 4-4" /></>
  },
  {
    titleKey: 'auth.stepResolved',
    descriptionKey: 'auth.stepResolvedDescription',
    icon: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="10" /></>
  }
];

export default function AuthSteps() {
  const { t } = useTranslation();

  return (
    <section className="auth-steps" aria-labelledby="auth-steps-heading">
      <h2 id="auth-steps-heading">{t('auth.howItWorks')}</h2>
      <ol>
        {steps.map((step) => (
          <li key={step.titleKey}>
            <span className="auth-step-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{step.icon}</svg>
            </span>
            <span className="auth-step-copy">
              <strong>{t(step.titleKey)}</strong>
              <small>{t(step.descriptionKey)}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
