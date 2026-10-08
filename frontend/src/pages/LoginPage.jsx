import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthBrandPanel from '../components/layout/AuthBrandPanel.jsx';

export default function LoginPage() {
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
      setError(getApiErrorMessage(requestError, 'We could not sign you in. Check your details and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <AuthBrandPanel />
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in to your workspace</h1>
          <p className="auth-subtitle">Pick up where your neighbourhood left off.</p>
          <form onSubmit={handleSubmit} className="auth-form">
            <label>Email address<input name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} placeholder="you@example.com" required /></label>
            <label>Password<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={updateField} placeholder="Enter your password" required minLength="8" /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'} <span>→</span></button>
          </form>
          <p className="auth-switch">New to StreetSetu? <Link to="/register">Create an account</Link> · <Link to="/transparency">City transparency</Link></p>
        </div>
      </section>
    </main>
  );
}
