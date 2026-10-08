import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiErrorMessage } from '../../api/client.js';
import { getComplaints } from '../../api/complaints.js';
import { useNotifications } from '../../context/NotificationContext.jsx';
import DuplicateComplaintsPanel from './DuplicateComplaintsPanel.jsx';
import SkeletonList from '../layout/SkeletonList.jsx';

const STATUS_LABELS = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  needs_review: 'Needs Review',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected'
};

const WORKFLOW_STATUSES = ['submitted', 'under_review', 'assigned', 'in_progress', 'needs_review', 'resolved'];

function statusLabel(status) {
  return STATUS_LABELS[status] || String(status || 'Unknown').replaceAll('_', ' ');
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export default function AdminOperationsDashboard() {
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
    ['Total Complaints', counts.total, 'ink'],
    ['Open Complaints', counts.open, 'amber'],
    ['Under Review', counts.under_review, ''],
    ['Assigned', counts.assigned, ''],
    ['In Progress', counts.in_progress, ''],
    ['Needs Review', counts.needs_review, 'amber'],
    ['Resolved', counts.resolved, 'green'],
    ['Rejected', counts.rejected, 'red']
  ];
  const recentComplaints = recent.items.filter((complaint) => !complaint.isDuplicate && !complaint.duplicateOf && !complaint.masterComplaint);

  return <div className="dashboard-page admin-operations-dashboard">
    <div className="page-heading admin-dashboard-heading">
      <div><p className="eyebrow">City operations</p><h1>Admin dashboard</h1><p className="page-lede">Complaint status and review work in one place.</p></div>
      <button className="outline-button" type="button" onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
    </div>

    <section className="admin-dashboard-section" aria-labelledby="primary-metrics-heading">
      <div className="admin-section-heading"><div><p className="eyebrow">Operations at a glance</p><h2 id="primary-metrics-heading">Primary Metrics</h2></div></div>
      {summaryError && <p className="admin-inline-error" role="status">{summaryError}</p>}
      <div className="admin-primary-metrics">
        {metrics.map(([label, value, tone]) => <article className={`stat-card admin-metric-card ${tone}`} key={label}>
          <div className="stat-top"><span>{label}</span></div>
          <strong>{loading && !summary ? '—' : Number(value || 0).toLocaleString()}</strong>
        </article>)}
      </div>
    </section>

    <section className="panel admin-recent-panel" aria-labelledby="recent-complaints-heading">
      <div className="panel-heading"><div><p className="eyebrow">Latest reports</p><h2 id="recent-complaints-heading">Recent Complaints</h2></div></div>
      {recentError && <p className="admin-inline-error" role="status">{recentError}</p>}
      {recentComplaints.length ? <div className="admin-recent-table-wrap"><table className="admin-recent-table">
        <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Priority</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>{recentComplaints.map((complaint) => <tr key={complaint._id}>
          <td data-label="Title"><strong>{complaint.title}</strong></td>
          <td data-label="Category" className="capitalize-cell">{complaint.category?.replaceAll('_', ' ') || '—'}</td>
          <td data-label="Status"><span className={`admin-status-pill admin-status-${complaint.status}`}>{statusLabel(complaint.status)}</span></td>
          <td data-label="Priority" className="capitalize-cell">{complaint.priority || '—'}</td>
          <td data-label="Date">{formatDate(complaint.createdAt)}</td>
          <td data-label="Actions"><Link className="admin-review-link" to={`/dashboard/complaints/${complaint._id}`}>Review</Link></td>
        </tr>)}</tbody>
      </table></div> : loading ? <SkeletonList rows={3} variant="row" /> : <div className="empty-table">{recentError ? 'Recent complaints could not be shown.' : 'No recent complaints to review.'}</div>}
    </section>

    <section className="panel admin-workflow-panel" aria-labelledby="workflow-summary-heading">
      <div className="panel-heading"><div><p className="eyebrow">Current workload</p><h2 id="workflow-summary-heading">Workflow Summary</h2></div></div>
      <div className="admin-workflow-counts">
        {WORKFLOW_STATUSES.map((status) => <article className="admin-workflow-count" key={status}>
          <span>{statusLabel(status)}</span><strong>{loading && !summary ? '—' : (counts.byStatus[status] || 0).toLocaleString()}</strong>
        </article>)}
      </div>
    </section>

    <DuplicateComplaintsPanel />
  </div>;
}
