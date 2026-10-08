import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api, { getApiErrorMessage } from '../../api/client.js';
import { getComplaints } from '../../api/complaints.js';
import { useNotifications } from '../../context/NotificationContext.jsx';
import DuplicateComplaintsPanel from './DuplicateComplaintsPanel.jsx';
import SkeletonList from '../layout/SkeletonList.jsx';
import PageHeader from '../layout/PageHeader.jsx';
import { statusLabel } from '../complaints/ComplaintCard.jsx';

const WORKFLOW_STATUSES = ['submitted', 'under_review', 'assigned', 'in_progress', 'needs_review', 'resolved'];

export default function AdminOperationsDashboard() {
  const { t, i18n } = useTranslation();
  const { socket } = useNotifications();
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState({ items: [] });
  const [summaryError, setSummaryError] = useState('');
  const [recentError, setRecentError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [summaryResult, recentResult] = await Promise.allSettled([
      api.get('/dashboard/summary'),
      getComplaints({ page: 1, limit: 12 })
    ]);
    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value.data.data);
      setSummaryError('');
    } else {
      setSummaryError(getApiErrorMessage(summaryResult.reason, 'Complaint counts could not be loaded.'));
    }
    if (recentResult.status === 'fulfilled') {
      setRecent(recentResult.value);
      setRecentError('');
    } else {
      setRecentError(getApiErrorMessage(recentResult.reason, 'Recent complaints could not be loaded.'));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on('dashboard:updated', refresh);
    socket.on('complaint:status', refresh);
    socket.on('complaint:assigned', refresh);
    socket.on('complaint:reassigned', refresh);
    return () => {
      socket.off('dashboard:updated', refresh);
      socket.off('complaint:status', refresh);
      socket.off('complaint:assigned', refresh);
      socket.off('complaint:reassigned', refresh);
    };
  }, [socket, refresh]);

  const counts = useMemo(() => {
    const byStatus = Object.fromEntries((summary?.statusCounts || []).map(({ status, count }) => [status, count]));
    const resolved = (byStatus.resolved || 0) + (byStatus.closed || 0);
    const open = (byStatus.submitted || 0) + (byStatus.under_review || 0) + (byStatus.assigned || 0)
      + (byStatus.in_progress || 0) + (byStatus.needs_review || 0);
    return {
      total: summary?.totalComplaints ?? Object.values(byStatus).reduce((total, count) => total + count, 0),
      open,
      under_review: byStatus.under_review || 0,
      assigned: byStatus.assigned || 0,
      in_progress: byStatus.in_progress || 0,
      needs_review: byStatus.needs_review || 0,
      resolved,
      rejected: byStatus.rejected || 0,
      byStatus: { ...byStatus, resolved }
    };
  }, [summary]);

  const metrics = [
    [t('dashboard.totalComplaints'), counts.total, 'ink'],
    [t('dashboard.openComplaints'), counts.open, 'amber'],
    [statusLabel('under_review'), counts.under_review, ''],
    [statusLabel('assigned'), counts.assigned, ''],
    [statusLabel('in_progress'), counts.in_progress, ''],
    [statusLabel('needs_review'), counts.needs_review, 'amber'],
    [statusLabel('resolved'), counts.resolved, 'green'],
    [statusLabel('rejected'), counts.rejected, 'red']
  ];
  const recentComplaints = recent.items.filter((complaint) => !complaint.isDuplicate && !complaint.duplicateOf && !complaint.masterComplaint);

  return <div className="dashboard-page admin-operations-dashboard">
    <PageHeader className="admin-dashboard-heading" kicker={t('dashboard.adminKicker')} title={t('dashboard.adminTitle')} subtitle={t('dashboard.adminSubtitle')} actions={<button className="outline-button" type="button" onClick={() => void refresh()} disabled={loading}>{loading ? t('dashboard.refreshing') : t('dashboard.refresh')}</button>} />

    <section className="admin-dashboard-section" aria-labelledby="primary-metrics-heading">
      <div className="admin-section-heading"><div><p className="eyebrow">{t('dashboard.atAGlance')}</p><h2 id="primary-metrics-heading">{t('dashboard.primaryMetrics')}</h2></div></div>
      {summaryError && <p className="admin-inline-error" role="status">{summaryError}</p>}
      <div className="admin-primary-metrics">
        {metrics.map(([label, value, tone]) => <article className={`stat-card admin-metric-card ${tone}`} key={label}>
          <div className="stat-top"><span>{label}</span></div>
          <strong>{loading && !summary ? '—' : Number(value || 0).toLocaleString()}</strong>
        </article>)}
      </div>
    </section>

    <section className="panel admin-recent-panel" aria-labelledby="recent-complaints-heading">
      <div className="panel-heading"><div><p className="eyebrow">{t('dashboard.latestReports')}</p><h2 id="recent-complaints-heading">{t('dashboard.recentComplaints')}</h2></div></div>
      {recentError && <p className="admin-inline-error" role="status">{recentError}</p>}
      {recentComplaints.length ? <div className="admin-recent-table-wrap"><table className="admin-recent-table">
        <thead><tr><th>{t('report.titleLabel')}</th><th>{t('report.category')}</th><th>{t('dashboard.status')}</th><th>{t('report.priority')}</th><th>{t('dashboard.date')}</th><th>{t('dashboard.actions')}</th></tr></thead>
        <tbody>{recentComplaints.map((complaint) => <tr key={complaint._id}>
          <td data-label={t('report.titleLabel')}><strong>{complaint.title}</strong></td>
          <td data-label={t('report.category')} className="capitalize-cell">{complaint.category ? t(`category.${complaint.category}`, { defaultValue: complaint.category.replaceAll('_', ' ') }) : '—'}</td>
          <td data-label={t('dashboard.status')}><span className={`admin-status-pill admin-status-${complaint.status}`}>{statusLabel(complaint.status)}</span></td>
          <td data-label={t('report.priority')} className="capitalize-cell">{complaint.priority ? t(`priority.${complaint.priority}`, { defaultValue: complaint.priority }) : '—'}</td>
          <td data-label={t('dashboard.date')}>{complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString(i18n.resolvedLanguage === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
          <td data-label={t('dashboard.actions')}><Link className="admin-review-link" to={`/dashboard/complaints/${complaint._id}`}>{t('dashboard.review')}</Link></td>
        </tr>)}</tbody>
      </table></div> : loading ? <SkeletonList rows={3} variant="row" /> : <div className="empty-table">{recentError ? t('dashboard.noRecentError') : t('dashboard.noRecentItems')}</div>}
    </section>

    <section className="panel admin-workflow-panel" aria-labelledby="workflow-summary-heading">
      <div className="panel-heading"><div><p className="eyebrow">{t('dashboard.currentWorkload')}</p><h2 id="workflow-summary-heading">{t('dashboard.workflowSummary')}</h2></div></div>
      <div className="admin-workflow-counts">
        {WORKFLOW_STATUSES.map((status) => <article className="admin-workflow-count" key={status}>
          <span>{statusLabel(status)}</span><strong>{loading && !summary ? '—' : (counts.byStatus[status] || 0).toLocaleString()}</strong>
        </article>)}
      </div>
    </section>

    <DuplicateComplaintsPanel />
  </div>;
}
