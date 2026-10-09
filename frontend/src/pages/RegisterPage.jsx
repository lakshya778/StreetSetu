import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthBrandPanel from '../components/layout/AuthBrandPanel.jsx';
import AuthSteps from '../components/layout/AuthSteps.jsx';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'citizen', referralCode: '' });
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
      await register(form);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('auth.registerError')));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page auth-page-register">
      <div className="auth-layout">
        <AuthBrandPanel />
        <section className="auth-panel">
          <div className="auth-form-wrap">
            <p className="eyebrow">{t('auth.getStarted')}</p>
            <h1>{t('auth.registerTitle')}</h1>
            <p className="auth-subtitle">{t('auth.registerSubtitle')}</p>
            <form onSubmit={handleSubmit} className="auth-form">
              <label>{t('auth.fullName')}<input name="name" type="text" autoComplete="name" value={form.name} onChange={updateField} placeholder={t('auth.namePlaceholder')} required minLength="2" /></label>
              <label>{t('auth.email')}<input name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} placeholder={t('auth.emailPlaceholder')} required /></label>
              <label>{t('auth.password')}<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={updateField} placeholder={t('auth.newPasswordPlaceholder')} required minLength="8" /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')} aria-pressed={showPassword}>{showPassword ? t('auth.hidePassword') : t('auth.showPassword')}</button></div></label>
              <label><span className="auth-label-copy">{t('auth.referralCode')} <small className="optional-label">{t('auth.optional')}</small></span><input name="referralCode" type="text" autoComplete="off" value={form.referralCode} onChange={updateField} placeholder={t('auth.referralCodePlaceholder')} maxLength="24" /></label>
              <fieldset className="role-choice">
                <legend>{t('auth.participate')}</legend>
                <label className={`role-choice-card ${form.role === 'citizen' ? 'selected' : ''}`}>
                  <input type="radio" name="role" value="citizen" checked={form.role === 'citizen'} onChange={updateField} />
                  <span className="role-choice-icon" aria-hidden="true">C</span>
                  <span><strong>{t('auth.citizen')}</strong><small>{t('auth.citizenDescription')}</small></span>
                </label>
                <label className={`role-choice-card ${form.role === 'volunteer' ? 'selected' : ''}`}>
                  <input type="radio" name="role" value="volunteer" checked={form.role === 'volunteer'} onChange={updateField} />
                  <span className="role-choice-icon" aria-hidden="true">V</span>
                  <span><strong>{t('auth.volunteer')}</strong><small>{t('auth.volunteerDescription')}</small></span>
                </label>
              </fieldset>
              {error && <div className="form-error" role="alert">{error}</div>}
              <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? t('auth.creatingAccount') : t('auth.createAccount')} <span>→</span></button>
            </form>
            <p className="auth-switch">{t('auth.alreadyHaveAccount')} <Link to="/login">{t('nav.signIn')}</Link> · <Link to="/transparency">{t('auth.cityTransparency')}</Link></p>
          </div>
        </section>
      </div>
      <AuthSteps />
    </main>
  );
}
