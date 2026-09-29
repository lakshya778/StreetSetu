import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getApiErrorMessage } from '../api/client.js';
import api from '../api/client.js';
import { getMyAssignments, updateAssignedComplaintStatus } from '../api/assignments.js';
import { uploadWorkEvidence } from '../api/complaints.js';
import ImageGallery from '../components/media/ImageGallery.jsx';
import ImageUploader from '../components/media/ImageUploader.jsx';
import ComplaintMap from '../components/maps/ComplaintMap.jsx';
import VolunteerProfileForm from '../components/layout/VolunteerProfileForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

const RESOLVED_STATUSES = ['resolved', 'closed'];
const STATUS_LABELS = { assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed', rejected: 'Rejected' };
const WORKFLOW_GROUPS = [
  { key: 'assigned', label: 'Assigned', tone: 'assignment-amber' },
  { key: 'in_progress', label: 'In progress', tone: 'assignment-blue' },
  { key: 'resolved', label: 'Resolved', tone: 'assignment-green' },
  { key: 'rejected', label: 'Rejected', tone: 'assignment-red' }
];

function statusLabel(status) { return STATUS_LABELS[status] || status.replaceAll('_', ' '); }

export default function VolunteerDashboardPage() {
  const { user } = useAuth();
  const { socket } = useNotifications();
  const [assignments, setAssignments] = useState([]);
  const [assignmentMeta, setAssignmentMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [analytics, setAnalytics] = useState({ monthlyTrends: [], resolutionTrends: [], statusCounts: [] });
  const [evidenceFiles, setEvidenceFiles] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');

  async function loadAssignments(page = assignmentMeta.page) {
    setError('');
    setIsLoading(true);
    try {
      const [assignmentResult, dashboardResult] = await Promise.all([
        getMyAssignments({ page, limit: 100 }),
        api.get('/dashboard/summary')
      ]);
      setAssignments(assignmentResult.items || []);
      setAssignmentMeta({ page: assignmentResult.page || page, pages: assignmentResult.pages || 1, total: assignmentResult.total || 0 });
      setAnalytics(dashboardResult.data.data || { monthlyTrends: [], resolutionTrends: [], statusCounts: [] });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Your dashboard could not be loaded.'));
    } finally { setIsLoading(false); }
  }

  useEffect(() => { loadAssignments(assignmentMeta.page); }, [assignmentMeta.page]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on('complaint:assigned', loadAssignments);
    socket.on('complaint:reassigned', loadAssignments);
    socket.on('complaint:status', loadAssignments);
    return () => {
      socket.off('complaint:assigned', loadAssignments);
      socket.off('complaint:reassigned', loadAssignments);
      socket.off('complaint:status', loadAssignments);
    };
  }, [socket, assignmentMeta.page]);

  async function handleStatusChange(complaintId, status, stage, files) {
    setUpdatingId(complaintId);
    setError('');
    try {
      if (files.length) await uploadWorkEvidence(complaintId, stage, files);
      const updated = await updateAssignedComplaintStatus(complaintId, { status });
      setAssignments((items) => items.map((assignment) => assignment.complaint?._id === complaintId
        ? { ...assignment, complaint: { ...assignment.complaint, ...updated } }
        : assignment));
      setEvidenceFiles((current) => ({ ...current, [complaintId]: [] }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Complaint status could not be updated.'));
    } finally { setUpdatingId(''); }
  }

  const metrics = useMemo(() => {
    const total = analytics.totalComplaints ?? assignmentMeta.total;
    const inProgress = analytics.statusCounts?.find((entry) => entry.status === 'in_progress')?.count || 0;
    const resolved = analytics.resolvedComplaints ?? assignments.filter(({ complaint }) => RESOLVED_STATUSES.includes(complaint?.status)).length;
    const rejected = analytics.rejectedComplaints ?? assignments.filter(({ complaint }) => complaint?.status === 'rejected').length;
    const eligibleAssignments = total - rejected;
    return {
      total,
      inProgress,
      resolved,
      rejected,
      rate: eligibleAssignments > 0 ? Math.round((resolved / eligibleAssignments) * 100) : 0
    };
  }, [analytics, assignments, assignmentMeta.total]);

  const metricCards = [
    { label: 'My assignments', value: metrics.total, description: 'All assigned complaints', tone: 'metric-dark' },
    { label: 'In progress', value: metrics.inProgress, description: 'Currently being worked', tone: '' },
    { label: 'Resolved', value: metrics.resolved, description: 'Completed assignments', tone: '' },
    { label: 'Rejected', value: metrics.rejected, description: 'Excluded from performance rate', tone: 'metric-red' },
    { label: 'Resolution rate', value: `${metrics.rate}%`, description: 'Resolved / assignments excluding rejected', tone: 'metric-lime' }
  ];
  const filteredAssignments = assignments.filter(({ complaint }) => !assignmentSearch || `${complaint?.title || ''} ${complaint?.description || ''} ${complaint?.category || ''} ${complaint?.address || ''}`.toLowerCase().includes(assignmentSearch.toLowerCase()));
  const assignedComplaints = filteredAssignments.map((assignment) => assignment.complaint).filter(Boolean);

  return <div className="volunteer-page">
    <div className="page-heading"><div><p className="eyebrow">Volunteer workspace</p><h1>Good morning, {user?.name?.split(' ')[0] || 'volunteer'}.</h1><p className="page-lede">Your assigned street actions, in one clear view.</p></div><button className="outline-button" onClick={loadAssignments}>Refresh <span>↻</span></button></div>
    {error && <div className="notice-banner">{error}<button onClick={loadAssignments}>Retry</button></div>}
    <div className="volunteer-metrics">{metricCards.map((card) => <article className={`volunteer-metric ${card.tone}`} key={card.label}><span>{card.label}</span><strong>{isLoading ? '—' : card.value}</strong><small>{card.description}</small></article>)}</div>
    <VolunteerProfileForm user={user} />
    <section className="panel volunteer-map-panel"><div className="panel-heading"><div><p className="eyebrow">Field coordination</p><h2>Assigned complaints nearby</h2></div></div><ComplaintMap complaints={assignedComplaints} className="volunteer-assignment-map" /></section>
    <div className="volunteer-charts-grid">
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Personal performance</p><h2>Assigned complaint trend</h2></div></div><div className="dashboard-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.monthlyTrends || []}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="submitted" name="Assigned reports" fill="#83a978" radius={[4, 4, 0, 0]} /><Bar dataKey="rejected" name="Rejected" fill="#d27a70" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Monthly resolution</p><h2>Resolved complaints</h2></div></div><div className="dashboard-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.resolutionTrends || []}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="resolved" name="Resolved" stroke="#5e896b" fill="#dcebd6" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></section>
    </div>
    <div className="volunteer-assignment-toolbar"><label>Search assignments<input value={assignmentSearch} onChange={(event) => setAssignmentSearch(event.target.value)} placeholder="Title, category, address" /></label></div>
    <div className="assignment-groups">{WORKFLOW_GROUPS.map((group) => {
      const items = filteredAssignments.filter(({ complaint }) => group.key === 'resolved'
        ? RESOLVED_STATUSES.includes(complaint?.status)
        : complaint?.status === group.key);
      return <section className="assignment-section" key={group.key}>
        <div className="assignment-section-heading"><div><p className="eyebrow">Workflow</p><h2>{group.label}</h2></div><span className={`assignment-count ${group.tone}`}>{items.length}</span></div>
        {isLoading ? <div className="loading-state compact-loading">Loading...</div> : items.length
          ? <div className="assignment-list">{items.map((assignment) => <AssignmentCard key={assignment._id} assignment={assignment} evidenceFiles={evidenceFiles[assignment.complaint?._id] || []} onEvidenceChange={(files) => setEvidenceFiles((current) => ({ ...current, [assignment.complaint._id]: files }))} updatingId={updatingId} onStatusChange={handleStatusChange} />)}</div>
          : <div className="assignment-empty">No {group.label.toLowerCase()} complaints.</div>}
      </section>;
    })}</div>
    {assignmentMeta.pages > 1 && <div className="pagination"><button disabled={assignmentMeta.page <= 1} onClick={() => setAssignmentMeta((current) => ({ ...current, page: current.page - 1 }))}>← Previous assignments</button><span>Page {assignmentMeta.page} of {assignmentMeta.pages} · {assignmentMeta.total} total</span><button disabled={assignmentMeta.page >= assignmentMeta.pages} onClick={() => setAssignmentMeta((current) => ({ ...current, page: current.page + 1 }))}>Next assignments →</button></div>}
  </div>;
}

function AssignmentCard({ assignment, evidenceFiles, onEvidenceChange, updatingId, onStatusChange }) {
  const complaint = assignment.complaint;
  const nextStatus = complaint.status === 'assigned' ? 'in_progress' : complaint.status === 'in_progress' ? 'resolved' : null;
  const evidenceStage = complaint.status === 'assigned' ? 'before' : 'after';
  const savedEvidence = evidenceStage === 'before' ? complaint.beforeImages || [] : complaint.afterImages || [];
  return <article className={`assignment-card ${complaint.status === 'rejected' ? 'assignment-card-rejected' : ''}`}>
    <div className="assignment-card-body"><div className={`status-dot status-${complaint.status}`} /><div>
      <div className="assignment-card-meta"><span>{complaint.category?.replaceAll('_', ' ')}</span><time>{new Date(assignment.assignedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</time></div>
      <h3>{complaint.title}</h3><p>{complaint.description}</p>
      {complaint.attachments?.length > 0 && <ImageGallery images={complaint.attachments} label="Complaint photos" compact />}
      {complaint.beforeImages?.length > 0 && <div className="assignment-evidence"><strong>Work-start photos</strong><ImageGallery images={complaint.beforeImages} label="Work-start photos" compact /></div>}
      {complaint.afterImages?.length > 0 && <div className="assignment-evidence"><strong>Completion photos</strong><ImageGallery images={complaint.afterImages} label="Completion photos" compact /></div>}
      {complaint.status === 'rejected' && <div className="volunteer-rejection-reason"><strong>Rejected</strong><span>{complaint.rejectionReason || 'Reason not recorded'}</span></div>}
      <small>{complaint.address || `${complaint.latitude}, ${complaint.longitude}`}</small>
    </div></div>
    <div className="assignment-card-actions"><span className={`priority-label priority-${complaint.priority}`}>{complaint.priority}</span>
      {complaint.status === 'rejected' && <span className="status-badge rejected-badge">Rejected</span>}
      {!nextStatus && <Link className="assignment-action" to={`/dashboard/complaints/${complaint._id}`}>View details <span>→</span></Link>}
    </div>
    {nextStatus && <div className="assignment-evidence-step"><strong>{evidenceStage === 'before' ? 'Before starting' : 'Before resolving'}</strong><ImageGallery images={savedEvidence} label={evidenceStage === 'before' ? 'Work-start evidence' : 'Completion evidence'} compact /><ImageUploader files={evidenceFiles} onChange={onEvidenceChange} disabled={updatingId === complaint._id} label={evidenceStage === 'before' ? 'Add work-start image' : 'Add completion image'} /><button className="assignment-action evidence-submit-button" disabled={updatingId === complaint._id || (!savedEvidence.length && !evidenceFiles.length)} onClick={() => onStatusChange(complaint._id, nextStatus, evidenceStage, evidenceFiles)}>{updatingId === complaint._id ? 'Saving...' : `Upload & mark ${statusLabel(nextStatus)}`}</button></div>}
  </article>;
}
