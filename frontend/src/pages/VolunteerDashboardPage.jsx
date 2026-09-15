import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { getMyAssignments, updateAssignedComplaintStatus } from '../api/assignments.js';
import { useAuth } from '../context/AuthContext.jsx';

const statusLabels = { assigned: 'Assigned', in_progress: 'In progress', resolved: 'Resolved' };

function statusLabel(status) { return statusLabels[status] || status.replaceAll('_', ' '); }

export default function VolunteerDashboardPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');

  async function loadAssignments() {
    setError('');
    setIsLoading(true);
    try {
      const result = await getMyAssignments({ page: 1, limit: 100 });
      setAssignments(result.items || []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Assigned complaints could not be loaded.'));
    } finally { setIsLoading(false); }
  }

  useEffect(() => { loadAssignments(); }, []);

  async function handleStatusChange(complaintId, status) {
    setUpdatingId(complaintId);
    setError('');
    try {
      const updated = await updateAssignedComplaintStatus(complaintId, { status });
      setAssignments((items) => items.map((assignment) => assignment.complaint?._id === complaintId ? { ...assignment, complaint: { ...assignment.complaint, ...updated } } : assignment));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Complaint status could not be updated.'));
    } finally { setUpdatingId(''); }
  }

  const metrics = useMemo(() => {
    const total = assignments.length;
    const inProgress = assignments.filter((assignment) => assignment.complaint?.status === 'in_progress').length;
    const resolved = assignments.filter((assignment) => ['resolved', 'closed'].includes(assignment.complaint?.status)).length;
    return { total, inProgress, resolved, rate: total ? Math.round((resolved / total) * 100) : 0 };
  }, [assignments]);

  const groups = [
    { key: 'assigned', label: 'Assigned', tone: 'assignment-amber' },
    { key: 'in_progress', label: 'In progress', tone: 'assignment-blue' },
    { key: 'resolved', label: 'Resolved', tone: 'assignment-green' }
  ];

  return <div className="volunteer-page"><div className="page-heading"><div><p className="eyebrow">Volunteer workspace</p><h1>Good morning, {user?.name?.split(' ')[0] || 'volunteer'}.</h1><p className="page-lede">Your assigned street actions, in one clear view.</p></div><button className="outline-button" onClick={loadAssignments}>Refresh <span>↻</span></button></div>{error && <div className="notice-banner">{error}<button onClick={loadAssignments}>Retry</button></div>}<div className="volunteer-metrics"><article className="volunteer-metric metric-dark"><span>My assignments</span><strong>{isLoading ? '—' : metrics.total}</strong><small>Active complaints</small></article><article className="volunteer-metric"><span>In progress</span><strong>{isLoading ? '—' : metrics.inProgress}</strong><small>Currently being worked</small></article><article className="volunteer-metric"><span>Resolved</span><strong>{isLoading ? '—' : metrics.resolved}</strong><small>Completed assignments</small></article><article className="volunteer-metric metric-lime"><span>Resolution rate</span><strong>{isLoading ? '—' : `${metrics.rate}%`}</strong><small>Across your assignments</small></article></div><div className="assignment-groups">{groups.map((group) => { const items = assignments.filter((assignment) => group.key === 'resolved' ? ['resolved', 'closed'].includes(assignment.complaint?.status) : assignment.complaint?.status === group.key); return <section className="assignment-section" key={group.key}><div className="assignment-section-heading"><div><p className="eyebrow">Workflow</p><h2>{group.label}</h2></div><span className={`assignment-count ${group.tone}`}>{items.length}</span></div>{isLoading ? <div className="loading-state compact-loading">Loading...</div> : items.length ? <div className="assignment-list">{items.map((assignment) => <AssignmentCard key={assignment._id} assignment={assignment} updatingId={updatingId} onStatusChange={handleStatusChange} />)}</div> : <div className="assignment-empty">No {group.label.toLowerCase()} complaints.</div>}</section>; })}</div></div>;
}

function AssignmentCard({ assignment, updatingId, onStatusChange }) {
  const complaint = assignment.complaint;
  const nextStatus = complaint.status === 'assigned' ? 'in_progress' : complaint.status === 'in_progress' ? 'resolved' : null;
  return <article className="assignment-card"><div className="assignment-card-body"><div className={`status-dot status-${complaint.status}`} /><div><div className="assignment-card-meta"><span>{complaint.category?.replaceAll('_', ' ')}</span><time>{new Date(assignment.assignedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</time></div><h3>{complaint.title}</h3><p>{complaint.description}</p><small>⌖ {complaint.address || `${complaint.latitude}, ${complaint.longitude}`}</small></div></div><div className="assignment-card-actions"><span className={`priority-label priority-${complaint.priority}`}>{complaint.priority}</span>{nextStatus && <button className="assignment-action" disabled={updatingId === complaint._id} onClick={() => onStatusChange(complaint._id, nextStatus)}>{updatingId === complaint._id ? 'Saving...' : `Mark ${statusLabel(nextStatus)}`} <span>→</span></button>}{!nextStatus && <Link className="assignment-action" to={`/dashboard/complaints/${complaint._id}`}>View details <span>→</span></Link>}</div></article>;
}
