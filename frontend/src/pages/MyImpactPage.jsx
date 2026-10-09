import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../api/client.js';
import { downloadMyCertificate, getMyCertificates, getMyGamificationStats } from '../api/gamification.js';
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
  const [certificates, setCertificates] = useState([]);
  const [certificateError, setCertificateError] = useState('');
  const [downloadingCertificate, setDownloadingCertificate] = useState('');

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

  useEffect(() => {
    let active = true;
    getMyCertificates()
      .then((result) => { if (active) setCertificates(result); })
      .catch((requestError) => {
        if (active) setCertificateError(getApiErrorMessage(requestError, t('gamification.certificatesError')));
      });
    return () => { active = false; };
  }, [t]);

  async function downloadCertificate(certificate) {
    setCertificateError('');
    setDownloadingCertificate(certificate.id);
    try {
      const file = await downloadMyCertificate(certificate.id);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `streetsetu-${certificate.month}-rank-${certificate.rank}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setCertificateError(getApiErrorMessage(requestError, t('gamification.certificateDownloadError')));
    } finally {
      setDownloadingCertificate('');
    }
  }

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
    { label: t('gamification.peopleImpacted'), value: stats.peopleImpactedEstimate.value, note: t('gamification.estimate') },
    { label: t('gamification.weeklyStreak'), value: stats.streakWeeks, icon: '🔥' },
    ...(stats.community ? [{ label: t('gamification.communityRank', { ward: stats.community.label }), value: stats.community.rank || '—', prefix: stats.community.rank ? '#' : '' }] : [])
  ];
  const monthLabel = (month) => new Intl.DateTimeFormat(i18n.resolvedLanguage === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));

  return (
    <div className="gamification-page">
      <PageHeader kicker={t('gamification.kicker')} title={t('gamification.impactTitle')} subtitle={t('gamification.impactSubtitle')} />
      <div className="gamification-stats-grid">
        {cards.map((card) => <article className="panel gamification-stat" key={card.label}><span>{card.icon && <span className="gamification-stat-icon" aria-hidden="true">{card.icon}</span>}{card.label}</span><strong>{card.prefix || ''}{Number.isFinite(Number(card.value)) ? Number(card.value).toLocaleString() : card.value}</strong>{card.note && <small>{card.note}</small>}</article>)}
      </div>
      {stats.referralCode && <section className="panel gamification-panel referral-code-panel"><div><p className="eyebrow">{t('gamification.referrals')}</p><h2>{t('gamification.yourReferralCode')}</h2><p>{t('gamification.referralHelp')}</p></div><code>{stats.referralCode}</code></section>}
      <section className="panel gamification-panel">
        <div className="panel-heading"><div><p className="eyebrow">{t('gamification.achievements')}</p><h2>{t('gamification.badges')}</h2></div></div>
        {stats.badges.length ? <ul className="gamification-badges">
          {stats.badges.map((badge) => {
            const monthlyBadge = /^monthly_(champion|top3)_(\d{4}-\d{2})$/.exec(badge.key);
            const badgeLabel = monthlyBadge
              ? t(`gamification.badge.monthly${monthlyBadge[1] === 'champion' ? 'Champion' : 'Top3'}`, { month: monthLabel(monthlyBadge[2]) })
              : t(`gamification.badge.${BADGE_KEYS[badge.key] || badge.key}`, { defaultValue: badge.label });
            return <li key={badge.key}><span aria-hidden="true">✦</span><div><strong>{badgeLabel}</strong><small>{new Intl.DateTimeFormat(i18n.resolvedLanguage === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' }).format(new Date(badge.awardedAt))}</small></div></li>;
          })}
        </ul> : <div className="empty-state gamification-empty"><strong>{t('gamification.noBadges')}</strong><p>{t('gamification.noBadgesHelp')}</p></div>}
      </section>
      <section className="panel gamification-panel">
        <div className="panel-heading"><div><p className="eyebrow">{t('gamification.achievements')}</p><h2>{t('gamification.certificates')}</h2></div></div>
        {certificateError && <div className="form-error" role="alert">{certificateError}</div>}
        {certificates.length ? <ul className="gamification-certificates">{certificates.map((certificate) => <li key={certificate.id}><div><strong>{monthLabel(certificate.month)}</strong><small>{t(certificate.rank === 1 ? 'gamification.championRank' : 'gamification.topThreeRank', { rank: certificate.rank, points: certificate.points })}</small></div><button className="outline-button" type="button" disabled={downloadingCertificate === certificate.id} onClick={() => void downloadCertificate(certificate)}>{downloadingCertificate === certificate.id ? t('gamification.downloadingCertificate') : t('gamification.downloadCertificate')}</button></li>)}</ul> : !certificateError && <div className="empty-state gamification-empty"><strong>{t('gamification.noCertificates')}</strong><p>{t('gamification.noCertificatesHelp')}</p></div>}
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
