import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../../api/client.js';
import { getMonthlyHighlights } from '../../api/gamification.js';

export default function MonthlyCommunityHighlights() {
  const { t, i18n } = useTranslation();
  const [highlights, setHighlights] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getMonthlyHighlights()
      .then((result) => { if (active) setHighlights(result); })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError, t('gamification.homeHighlightsError')));
      });
    return () => { active = false; };
  }, [t]);

  if (error) return <div className="notice-banner" role="status">{error}</div>;
  if (!highlights) return null;
  const month = highlights.month
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${highlights.month}-01T00:00:00Z`))
    : '';
  if (!highlights.winners?.length && !highlights.cleanestWard) return null;

  return <section className="monthly-community-highlights" aria-label={t('gamification.monthlyHighlights')}>
    {highlights.winners?.length > 0 && <article className="panel monthly-winners-card">
      <div className="panel-heading"><div><p className="eyebrow">{t('gamification.monthlyHighlights')}</p><h2>{t('gamification.topThreeOfMonth')}</h2></div><span>{month}</span></div>
      <ol className="monthly-winners-list">{highlights.winners.map((winner) => <li key={`${winner.rank}-${winner.displayName}`}><span>{winner.rank}</span><strong>{winner.displayName}</strong><small>{winner.points.toLocaleString()} {t('gamification.points')}</small></li>)}</ol>
    </article>}
    {highlights.cleanestWard && <article className="panel cleanest-ward-card">
      <p className="eyebrow">{t('gamification.cleanestWard')}</p>
      <strong>{highlights.cleanestWard.label}</strong>
      <span>{t('gamification.resolvedInArea', { count: highlights.cleanestWard.resolvedCount })}</span>
    </article>}
  </section>;
}
