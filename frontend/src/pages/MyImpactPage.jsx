import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../api/client.js';
import { getMyGamificationStats } from '../api/gamification.js';
import PageHeader from '../components/layout/PageHeader.jsx';

const BADGE_KEYS = {
  first_report: 'firstReport',
  community_hero: 'communityHero',
  drive_volunteer: 'driveVolunteer',
  drive_organizer: 'driveOrganizer',
  points_100: 'points100',
  points_500: 'points500'
};

export default function MyImpactPage() {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getMyGamificationStats()
      .then((result) => { if (active) setStats(result); })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError, t('gamification.statsError')));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);

  if (loading) return <div className="page-skeleton" role="status" aria-label={t('gamification.loading')}><span /><span /><span /></div>;
  if (error) return <div className="form-error" role="alert">{error}</div>;
  if (!stats) return null;

  const cards = [
    { label: t('gamification.totalPoints'), value: stats.totalPoints },
    { label: t('gamification.monthlyPoints'), value: stats.monthlyPoints },
    { label: t('gamification.monthlyRank'), value: stats.rank.monthly, prefix: '#' },
    { label: t('gamification.allTimeRank'), value: stats.rank.allTime, prefix: '#' },
    { label: t('gamification.reports'), value: stats.reports },
    { label: t('gamification.resolved'), value: stats.resolved },
    { label: t('gamification.drivesJoined'), value: stats.drivesJoined },
    { label: t('gamification.drivesOrganized'), value: stats.drivesOrganized },
    { label: t('gamification.peopleImpacted'), value: stats.peopleImpactedEstimate.value, note: t('gamification.estimate') }
  ];

  return (
    <div className="gamification-page">
      <PageHeader kicker={t('gamification.kicker')} title={t('gamification.impactTitle')} subtitle={t('gamification.impactSubtitle')} />
      <div className="gamification-stats-grid">
        {cards.map((card) => <article className="panel gamification-stat" key={card.label}><span>{card.label}</span><strong>{card.prefix || ''}{Number(card.value).toLocaleString()}</strong>{card.note && <small>{card.note}</small>}</article>)}
      </div>
      <section className="panel gamification-panel">
        <div className="panel-heading"><div><p className="eyebrow">{t('gamification.achievements')}</p><h2>{t('gamification.badges')}</h2></div></div>
        {stats.badges.length ? <ul className="gamification-badges">
          {stats.badges.map((badge) =>           <li key={badge.key}><span aria-hidden="true">✦</span><div><strong>{t(`gamification.badge.${BADGE_KEYS[badge.key] || badge.key}`, { defaultValue: badge.label })}</strong><small>{new Intl.DateTimeFormat(i18n.resolvedLanguage === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' }).format(new Date(badge.awardedAt))}</small></div></li>)}
        </ul> : <div className="empty-state gamification-empty"><strong>{t('gamification.noBadges')}</strong><p>{t('gamification.noBadgesHelp')}</p></div>}
      </section>
      <section className="panel gamification-panel">
        <div className="panel-heading"><div><p className="eyebrow">{t('gamification.verifiedWork')}</p><h2>{t('gamification.beforeAfterTitle')}</h2></div></div>
        {stats.beforeAfter.length ? <div className="gamification-comparisons">
          {stats.beforeAfter.map((item) => <article className="gamification-comparison" key={item.complaintId}>
            <h3>{item.title}</h3>
            <div>
              <figure>{item.beforePhotoUrl ? <img src={item.beforePhotoUrl} alt={t('gamification.beforePhotoAlt', { title: item.title })} loading="lazy" /> : <span>{t('gamification.photoUnavailable')}</span>}<figcaption>{t('gamification.before')}</figcaption></figure>
              <figure>{item.afterPhotoUrl ? <img src={item.afterPhotoUrl} alt={t('gamification.afterPhotoAlt', { title: item.title })} loading="lazy" /> : <span>{t('gamification.photoUnavailable')}</span>}<figcaption>{t('gamification.after')}</figcaption></figure>
            </div>
          </article>)}
        </div> : <div className="empty-state gamification-empty"><strong>{t('gamification.noResolved')}</strong><p>{t('gamification.noResolvedHelp')}</p></div>}
      </section>
    </div>
  );
}
