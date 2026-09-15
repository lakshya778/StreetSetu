import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'citizen' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <div className="auth-visual"><div className="auth-visual-top"><div className="brand-mark">S</div><strong>StreetSetu</strong></div><div className="register-orbit" aria-hidden="true"><div className="orbit-ring ring-a" /><div className="orbit-ring ring-b" /><div className="orbit-core">+</div><span className="orbit-label label-a">Report</span><span className="orbit-label label-b">Resolve</span><span className="orbit-label label-c">Restore</span></div><div className="auth-visual-copy"><p className="eyebrow">A better block starts here</p><h2>Be part of the<br /><em>signal.</em></h2><p>Join citizens and volunteers turning local observations into accountable action.</p></div></div>
      <section className="auth-panel"><div className="auth-form-wrap"><p className="eyebrow">Get started</p><h1>Create your account</h1><p className="auth-subtitle">Bring your street into the conversation.</p><form onSubmit={handleSubmit} className="auth-form"><label>Full name<input name="name" type="text" autoComplete="name" value={form.name} onChange={updateField} placeholder="Your name" required minLength="2" /></label><label>Email address<input name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} placeholder="you@example.com" required /></label><label>Password<input name="password" type="password" autoComplete="new-password" value={form.password} onChange={updateField} placeholder="At least 8 characters" required minLength="8" /></label><label>How will you participate?<select name="role" value={form.role} onChange={updateField}><option value="citizen">As a citizen</option><option value="volunteer">As a volunteer</option></select></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Create account'} <span>→</span></button></form><p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p></div></section>
    </main>
  );
}
