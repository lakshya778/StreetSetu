import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher.jsx';

export default function PublicHeader() {
  const { t } = useTranslation();
  return <header className="public-site-header"><Link to="/transparency" className="public-brand"><span className="brand-mark">S</span><span><strong>StreetSetu</strong><small>{t('nav.brandSubtitle')}</small></span></Link><nav><Link to="/transparency">{t('nav.transparency')}</Link><Link to="/overdue">{t('nav.overdue')}</Link><Link to="/login">{t('nav.signIn')}</Link><LanguageSwitcher /></nav></header>;
}
