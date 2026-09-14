import { Routes, Route } from 'react-router-dom';

function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <section className="text-center">
        <span className="inline-block rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">
          StreetSetu
        </span>
        <h1 className="mt-6 text-4xl font-bold text-slate-900">
          AI-Powered Street & Neighbourhood Action Platform
        </h1>
        <p className="mt-4 text-slate-600">
          Citizen reporting, issue visibility, and action workflows.
        </p>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}
