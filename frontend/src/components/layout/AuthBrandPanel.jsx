import { useTranslation } from 'react-i18next';
import AuthSteps from './AuthSteps.jsx';

export default function AuthBrandPanel() {
  const { t } = useTranslation();
  return (
    <section className="auth-visual" aria-labelledby="auth-brand-heading">
      <div className="auth-visual-copy">
        <p className="eyebrow">{t('auth.brandKicker')}</p>
        <h1 id="auth-brand-heading">{t('auth.brandHeading')}</h1>
        <p className="auth-hero-subtitle">{t('auth.brandSubtitle')}</p>
        <AuthSteps />
      </div>
    </section>
  );
}
