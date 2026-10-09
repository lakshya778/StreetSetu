import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../api/client.js';
import { getLeaderboard, getMyGamificationStats } from '../api/gamification.js';
import PageHeader from '../components/layout/PageHeader.jsx';

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const [scope, setScope] = useState('month');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [community, setCommunity] = useState(null);
  const [communityError, setCommunityError] = useState('');
  const [ward, setWard] = useState('');

  useEffect(() => {
    let active = true;
    getMyGamificationStats()
      .then((stats) => { if (active) setCommunity(stats.community || null); })
      .catch(() => { if (active) setCommunityError(t('gamification.areaFilterUnavailable')); });
    return () => { active = false; };
  }, [t]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getLeaderboard(scope, ward || undefined)
      .then((result) => { if (active) setRows(result); })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError, t('gamification.leaderboardError')));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope, ward, t]);

  return (
    <div className="gamification-page">
      <PageHeader kicker={t('gamification.kicker')} title={t('gamification.leaderboardTitle')} subtitle={t('gamification.leaderboardSubtitle')} />
      {error && <div className="form-error" role="alert">{error}</div>}
      {communityError && <div className="notice-banner" role="status">{communityError}</div>}
      <section className="panel gamification-panel">
        <div className="gamification-tabs" role="tablist" aria-label={t('gamification.leaderboardScope')}>
          {['month', 'all'].map((item) => (
            <button key={item} type="button" role="tab" aria-selected={scope === item} className={scope === item ? 'active' : ''} onClick={() => setScope(item)}>
              {t(item === 'month' ? 'gamification.monthly' : 'gamification.allTime')}
            </button>
          ))}
        </div>
        {community?.key && <label className="gamification-area-filter"><span>{t('gamification.areaFilter')}</span><select value={ward} onChange={(event) => setWard(event.target.value)}><option value="">{t('gamification.allAreas')}</option><option value={community.key}>{community.label}</option></select></label>}
        {loading ? <div className="page-skeleton" role="status" aria-label={t('gamification.loading')}><span /><span /><span /></div>
          : rows.length ? <div className="table-wrap gamification-table-wrap">
            <table className="gamification-table">
              <thead><tr><th>{t('gamification.rank')}</th><th>{t('gamification.member')}</th><th>{t('gamification.points')}</th><th>{t('gamification.badges')}</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={`${row.rank}-${row.displayName}`} className={row.isMe ? 'gamification-current-user' : ''}>
                  <td><span className="gamification-rank">#{row.rank}</span></td>
                  <td>{row.displayName}{row.isMe && <span className="gamification-you">{t('gamification.you')}</span>}</td>
                  <td><strong>{row.points.toLocaleString()}</strong></td>
                  <td>{row.badgesCount}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
            : <div className="empty-state gamification-empty"><strong>{t('gamification.emptyTitle')}</strong><p>{t('gamification.emptyMessage')}</p></div>}
      </section>
    </div>
  );
}
