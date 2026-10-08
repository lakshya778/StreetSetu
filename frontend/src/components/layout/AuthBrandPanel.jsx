import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher.jsx';

const featurePoints = [
  {
    titleKey: 'auth.featurePhoto',
    icon: <><path d="M4 7h3l1.5-2h7L17 7h3v12H4z" /><circle cx="12" cy="13" r="3" /></>
  },
  {
    titleKey: 'auth.featureTriage',
    icon: <><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" /><circle cx="12" cy="12" r="4" /></>
  },
  {
    titleKey: 'auth.featureResolution',
    icon: <><path d="m5 12 4 4L19 6" /><path d="M20 12a8 8 0 1 1-2.3-5.7" /></>
  }
];

function BrandMark() {
  return <div className="brand-mark">S</div>;
}

export default function AuthBrandPanel() {
  const { t } = useTranslation();
  return (
    <section className="auth-visual" aria-labelledby="auth-brand-heading">
      <LanguageSwitcher />
      <div className="auth-hero-art" aria-hidden="true">
        <svg viewBox="0 0 520 260" fill="none">
          <path d="M0 218h520" stroke="currentColor" strokeWidth="2" />
          <path d="M20 218v-76h72v76m-58-59h12m18 0h12m-42 23h12m18 0h12M101 218v-112h86v112m-70-91h13m18 0h13m-44 23h13m18 0h13m-44 23h13m18 0h13M197 218v-65h54v65m-37-47h19m-19 22h19M265 218V91l46-26 45 26v127m-73-95h15m24 0h15m-54 24h15m24 0h15m-54 24h15m24 0h15m-36 23h21v-23" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M381 218v-92m-16 13c2-19 12-29 24-31-1 17-8 27-24 31Zm16-17c2-17 11-25 23-27-1 15-9 24-23 27Zm0 0c-1-16-9-24-21-27 0 14 8 24 21 27Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M424 218v-111m-10 0h20m-28 20h36m-18-20 15 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M467 218v-43h35v43m-40-43 23-15 23 15m-33 12h22m-22 12h22" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="59" cy="79" r="17" stroke="currentColor" strokeWidth="2" /><path d="m50 79 6 6 12-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="auth-visual-top"><BrandMark /><strong>StreetSetu</strong></div>
      <div className="auth-visual-copy">
        <p className="eyebrow">{t('auth.brandKicker')}</p>
        <h2 id="auth-brand-heading">{t('auth.brandHeading')}</h2>
        <p className="auth-hero-subtitle">{t('auth.brandSubtitle')}</p>
        <ul className="auth-feature-list">
          {featurePoints.map((feature) => (
            <li key={feature.titleKey}>
              <span className="auth-feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{feature.icon}</svg></span>
              <span>{t(feature.titleKey)}</span>
            </li>
          ))}
        </ul>
        <div className="auth-quote-strip"><span>{t('auth.citizenReport')}</span><i aria-hidden="true">→</i><strong>{t('auth.accountableAction')}</strong></div>
      </div>
    </section>
  );
}
