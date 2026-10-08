import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage === 'hi' ? 'hi' : 'en';

  return <div className="language-switcher" role="group" aria-label={t('language.choose')}>
    <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => void i18n.changeLanguage('en')}>EN</button>
    <span aria-hidden="true">|</span>
    <button type="button" className={language === 'hi' ? 'active' : ''} aria-pressed={language === 'hi'} onClick={() => void i18n.changeLanguage('hi')}>हिंदी</button>
  </div>;
}
