import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthBrandPanel from '../components/layout/AuthBrandPanel.jsx';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'citizen' });
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
      setError(getApiErrorMessage(requestError, 'We could not create your account. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page auth-page-register">
      <AuthBrandPanel />
      <section className="auth-panel"><div className="auth-form-wrap"><p className="eyebrow">Get started</p><h1>Create your account</h1><p className="auth-subtitle">Bring your street into the conversation.</p><form onSubmit={handleSubmit} className="auth-form"><label>Full name<input name="name" type="text" autoComplete="name" value={form.name} onChange={updateField} placeholder="Your name" required minLength="2" /></label><label>Email address<input name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} placeholder="you@example.com" required /></label><label>Password<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={updateField} placeholder="At least 8 characters" required minLength="8" /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button></div></label><fieldset className="role-choice"><legend>How will you participate?</legend><label className={`role-choice-card ${form.role === 'citizen' ? 'selected' : ''}`}><input type="radio" name="role" value="citizen" checked={form.role === 'citizen'} onChange={updateField} /><span className="role-choice-icon" aria-hidden="true">C</span><span><strong>Citizen</strong><small>Report and track local issues</small></span></label><label className={`role-choice-card ${form.role === 'volunteer' ? 'selected' : ''}`}><input type="radio" name="role" value="volunteer" checked={form.role === 'volunteer'} onChange={updateField} /><span className="role-choice-icon" aria-hidden="true">V</span><span><strong>Volunteer</strong><small>Help coordinate neighbourhood action</small></span></label></fieldset>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Create account'} <span>→</span></button></form><p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link> · <Link to="/transparency">City transparency</Link></p></div></section>
    </main>
  );
}
