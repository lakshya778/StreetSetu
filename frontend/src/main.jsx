import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles.css';
import './production.css';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE, tracesSampleRate: 0.05 });
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={<main className="page-content"><section className="panel"><h1>Something went wrong</h1><p>Reload StreetSetu to continue.</p></section></main>}>
    <BrowserRouter>
      <React.StrictMode>
        <AuthProvider><App /></AuthProvider>
      </React.StrictMode>
    </BrowserRouter>
  </Sentry.ErrorBoundary>
);
