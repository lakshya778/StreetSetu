import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthBrandPanel from '../components/layout/AuthBrandPanel.jsx';
import AuthSteps from '../components/layout/AuthSteps.jsx';

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(form);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('auth.signInError')));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <AuthBrandPanel />
        <section className="auth-panel">
          <div className="auth-form-wrap">
            <p className="eyebrow">{t('auth.welcomeBack')}</p>
            <h1>{t('auth.signInTitle')}</h1>
            <p className="auth-subtitle">{t('auth.signInSubtitle')}</p>
            <form onSubmit={handleSubmit} className="auth-form">
              <label>{t('auth.email')}<input name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} placeholder={t('auth.emailPlaceholder')} required /></label>
              <label>{t('auth.password')}<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={updateField} placeholder={t('auth.passwordPlaceholder')} required minLength="8" /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')} aria-pressed={showPassword}>{showPassword ? t('auth.hidePassword') : t('auth.showPassword')}</button></div></label>
              {error && <div className="form-error" role="alert">{error}</div>}
              <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? t('auth.signingIn') : t('nav.signIn')} <span>→</span></button>
            </form>
            <p className="auth-switch">{t('auth.newHere')} <Link to="/register">{t('auth.createAccount')}</Link> · <Link to="/transparency">{t('auth.cityTransparency')}</Link></p>
          </div>
        </section>
      </div>
      <AuthSteps />
    </main>
  );
}
