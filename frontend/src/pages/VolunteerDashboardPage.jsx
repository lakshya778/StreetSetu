import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getApiErrorMessage } from '../api/client.js';
import api from '../api/client.js';
import { getCompletionVerification, getMyAssignments, getMyOptimizedRoute, respondToAssignment, updateAssignedComplaintStatus } from '../api/assignments.js';
import { uploadWorkEvidence } from '../api/complaints.js';
import ImageGallery from '../components/media/ImageGallery.jsx';
import ImageUploader from '../components/media/ImageUploader.jsx';
import DevGalleryProof from '../components/media/DevGalleryProof.jsx';
import ComplaintMap from '../components/maps/LazyComplaintMap.jsx';
import VolunteerRouteMap from '../components/maps/LazyVolunteerRouteMap.jsx';
import RouteSummaryCard from '../components/dashboard/RouteSummaryCard.jsx';
import VolunteerProfileForm from '../components/layout/VolunteerProfileForm.jsx';
import PageHeader from '../components/layout/PageHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import SkeletonList from '../components/layout/SkeletonList.jsx';
import { statusLabel } from '../components/complaints/ComplaintCard.jsx';

const LiveCameraCapture = lazy(() => import('../components/media/LiveCameraCapture.jsx'));
const RESOLVED_STATUSES = ['resolved'];
const WORKFLOW_GROUPS = [
  { key: 'assigned', label: 'Assigned', tone: 'assignment-amber' },
  { key: 'in_progress', label: 'In progress', tone: 'assignment-blue' },
  { key: 'needs_review', label: 'Needs review', tone: 'assignment-amber' },
  { key: 'resolved', label: 'Resolved', tone: 'assignment-green' },
  { key: 'rejected', label: 'Rejected', tone: 'assignment-red' }
];

export default function VolunteerDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { socket } = useNotifications();
  const [assignments, setAssignments] = useState([]);
  const [route, setRoute] = useState(null);
  const [assignmentMeta, setAssignmentMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [analytics, setAnalytics] = useState({ monthlyTrends: [], resolutionTrends: [], statusCounts: [] });
  const [evidenceFiles, setEvidenceFiles] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');

  async function loadAssignments(page = assignmentMeta.page) {
    setError('');
    setIsLoading(true);
    try {
      const [assignmentResult, dashboardResult, routeResult] = await Promise.all([
        getMyAssignments({ page, limit: 12 }),
        api.get('/dashboard/summary'),
        getMyOptimizedRoute()
      ]);
      setAssignments(assignmentResult.items || []);
      setAssignmentMeta({ page: assignmentResult.page || page, pages: assignmentResult.pages || 1, total: assignmentResult.total || 0 });
      setAnalytics(dashboardResult.data.data || { monthlyTrends: [], resolutionTrends: [], statusCounts: [] });
      setRoute(routeResult);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Your dashboard could not be loaded.'));
    } finally { setIsLoading(false); }
  }

  useEffect(() => { loadAssignments(assignmentMeta.page); }, [assignmentMeta.page]);

  useEffect(() => {
    if (!socket) return undefined;
    const refreshAssignments = () => { void loadAssignments(); };
    socket.on('complaint:assigned', refreshAssignments);
    socket.on('complaint:reassigned', refreshAssignments);
    socket.on('complaint:status', refreshAssignments);
    socket.on('feedback:received', refreshAssignments);
    return () => {
      socket.off('complaint:assigned', refreshAssignments);
      socket.off('complaint:reassigned', refreshAssignments);
      socket.off('complaint:status', refreshAssignments);
      socket.off('feedback:received', refreshAssignments);
    };
  }, [socket, assignmentMeta.page]);

  async function refreshRoute() {
    try { setRoute(await getMyOptimizedRoute()); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'The route could not be recalculated.')); }
  }

  async function handleStatusChange(complaintId, status, stage, files, captureMetadata = {}) {
    setUpdatingId(complaintId);
    setError('');
    try {
      if (files.length) {
        setUploadProgress((current) => ({ ...current, [complaintId]: 0 }));
        const evidenceResult = await uploadWorkEvidence(complaintId, stage, files, captureMetadata, (progress) => setUploadProgress((current) => ({ ...current, [complaintId]: progress })));
        const returnedBeforeImages = evidenceResult.workStartPhotos || evidenceResult.beforeImages || [];
        const returnedAfterImages = evidenceResult.completionPhotos || evidenceResult.afterImages || [];
        setAssignments((items) => items.map((assignment) => assignment.complaint?._id === complaintId
          ? { ...assignment, complaint: {
            ...assignment.complaint,
            beforeImages: returnedBeforeImages,
            afterImages: returnedAfterImages,
            ...(stage === 'after' ? { status: evidenceResult.status || 'needs_review', completionVerification: evidenceResult.completionVerification } : {})
          } }
          : assignment));
        setEvidenceFiles((current) => ({ ...current, [complaintId]: [] }));
        await loadAssignments();
        if (stage === 'after') return;
      }
      if (status === 'resolved') {
        let verification = await getCompletionVerification(complaintId);
        for (let attempt = 0; verification.verificationStatus === 'pending' && attempt < 30; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
          verification = await getCompletionVerification(complaintId);
        }
        if (verification.verificationStatus !== 'verified') {
          await loadAssignments();
          setError(verification.verificationStatus === 'pending'
            ? 'Photo verification is still processing. Please try resolving this complaint again shortly.'
            : verification.failureReason || 'The completion photos need admin review before this complaint can be resolved.');
          return;
        }
      }
      const updated = await updateAssignedComplaintStatus(complaintId, { status });
      setAssignments((items) => items.map((assignment) => assignment.complaint?._id === complaintId
        ? { ...assignment, complaint: { ...assignment.complaint, ...updated } }
        : assignment));
      setEvidenceFiles((current) => ({ ...current, [complaintId]: [] }));
      await loadAssignments();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Complaint status could not be updated.'));
    } finally {
      setUpdatingId('');
      setUploadProgress((current) => {
        const next = { ...current };
        delete next[complaintId];
        return next;
      });
    }
  }

  async function handleAssignmentResponse(complaintId, response) {
    setUpdatingId(complaintId);
    setError('');
    try {
      await respondToAssignment(complaintId, response);
      await loadAssignments();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Your assignment response could not be saved.'));
    } finally { setUpdatingId(''); }
  }

  const metrics = useMemo(() => {
    const activeAssignments = assignments.filter(({ complaint }) => ['assigned', 'in_progress', 'needs_review'].includes(complaint?.status)).length;
    const resolved = assignments.filter(({ complaint }) => RESOLVED_STATUSES.includes(complaint?.status)).length;
    const rejected = assignments.filter(({ complaint }) => complaint?.status === 'rejected').length;
    const eligibleAssignments = resolved + rejected;
    return {
      total: activeAssignments,
      inProgress: assignments.filter(({ complaint }) => complaint?.status === 'in_progress').length,
      resolved,
      rejected,
      rate: eligibleAssignments > 0 ? Math.round((resolved / eligibleAssignments) * 100) : 0,
      averageCompletionDays: analytics.averageCompletionDays,
      routeEfficiencyScore: analytics.routeEfficiencyScore || 0,
      rank: analytics.volunteerRank,
      averageRating: analytics.averageRating,
      ratingCount: analytics.ratingCount || 0,
      volunteerCount: analytics.volunteerPerformance?.length || 0
    };
  }, [analytics, assignments, assignmentMeta.total]);

  const metricCards = [
    { label: t('dashboard.myAssignments'), value: metrics.total, description: t('dashboard.allAssigned'), tone: 'metric-dark' },
    { label: t('dashboard.resolved'), value: metrics.resolved, description: t('dashboard.completedAssignments'), tone: '' },
    { label: t('dashboard.averageCompletionDays'), value: metrics.averageCompletionDays == null ? '—' : t('dashboard.days', { count: metrics.averageCompletionDays }), description: t('dashboard.reportedToResolved'), tone: '' },
    { label: t('dashboard.routeEfficiency'), value: `${metrics.routeEfficiencyScore}%`, description: t('dashboard.completedPerKm'), tone: '' },
    { label: t('dashboard.resolutionRateLabel'), value: `${metrics.rate}%`, description: t('dashboard.resolvedAssignments'), tone: 'metric-lime' },
    { label: t('dashboard.citizenRating'), value: metrics.averageRating == null ? '—' : `${metrics.averageRating} / 5`, description: t('dashboard.citizenRatings', { count: metrics.ratingCount }), tone: '' },
    { label: t('dashboard.volunteerRanking'), value: metrics.rank ? `#${metrics.rank} / ${metrics.volunteerCount}` : '—', description: t('dashboard.rankedResolution'), tone: 'metric-dark' }
  ];
  const filteredAssignments = assignments.filter(({ complaint }) => !assignmentSearch || `${complaint?.title || ''} ${complaint?.description || ''} ${complaint?.category || ''} ${complaint?.address || ''}`.toLowerCase().includes(assignmentSearch.toLowerCase()));
  const assignedComplaints = filteredAssignments.map((assignment) => assignment.complaint).filter(Boolean);

  return <div className="volunteer-page">
    <PageHeader kicker={t('dashboard.volunteerKicker')} title={t('dashboard.volunteerGreeting', { name: user?.name?.split(' ')[0] || t('dashboard.volunteerFallback') })} subtitle={t('dashboard.volunteerSubtitle')} actions={<button className="outline-button" onClick={loadAssignments}>{t('dashboard.refreshAssignments')} <span>↻</span></button>} />
    {error && <div className="notice-banner">{error}<button onClick={loadAssignments}>{t('dashboard.retry')}</button></div>}
    <div className="volunteer-metrics">{metricCards.map((card) => <article className={`volunteer-metric ${card.tone}`} key={card.label}><span>{card.label}</span><strong>{isLoading ? '—' : card.value}</strong><small>{card.description}</small></article>)}</div>
    <VolunteerProfileForm user={user} onSaved={refreshRoute} />
    <div className="volunteer-route-grid"><RouteSummaryCard route={route} isLoading={isLoading} /><VolunteerRouteMap route={route} /></div>
    <section className="panel volunteer-map-panel"><div className="panel-heading"><div><p className="eyebrow">{t('dashboard.fieldCoordination')}</p><h2>{t('dashboard.assignedNearby')}</h2></div></div><ComplaintMap complaints={assignedComplaints} className="volunteer-assignment-map" /></section>
    <div className="volunteer-charts-grid">
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">{t('dashboard.personalPerformance')}</p><h2>{t('dashboard.assignmentTrend')}</h2></div></div><div className="dashboard-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.monthlyTrends || []}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="submitted" name={t('dashboard.assignedReports')} fill="#83a978" radius={[4, 4, 0, 0]} /><Bar dataKey="rejected" name={t('dashboard.rejected')} fill="#d27a70" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">{t('dashboard.monthlyResolution')}</p><h2>{t('dashboard.resolved')}</h2></div></div><div className="dashboard-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.resolutionTrends || []}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="resolved" name={t('dashboard.resolved')} stroke="#5e896b" fill="#dcebd6" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></section>
    </div>
    <div className="volunteer-assignment-toolbar"><label>{t('dashboard.searchAssignments')}<input value={assignmentSearch} onChange={(event) => setAssignmentSearch(event.target.value)} placeholder={t('dashboard.assignmentSearchPlaceholder')} /></label></div>
    <div className="assignment-groups">{WORKFLOW_GROUPS.map((group) => {
      const items = filteredAssignments.filter(({ complaint }) => complaint?.status === group.key);
      return <section className="assignment-section" key={group.key}>
        <div className="assignment-section-heading"><div><p className="eyebrow">{t('dashboard.workflow')}</p><h2>{t(`status.${group.key}`)}</h2></div><span className={`assignment-count ${group.tone}`}>{items.length}</span></div>
        {isLoading ? <SkeletonList rows={2} /> : items.length
          ? <div className="assignment-list">{items.map((assignment) => <AssignmentCard key={assignment._id} assignment={assignment} evidenceFiles={evidenceFiles[assignment.complaint?._id] || []} uploadProgress={uploadProgress[assignment.complaint?._id]} onEvidenceChange={(files) => setEvidenceFiles((current) => ({ ...current, [assignment.complaint._id]: files }))} updatingId={updatingId} onStatusChange={handleStatusChange} onAssignmentResponse={handleAssignmentResponse} />)}</div>
          : <div className="assignment-empty">{t('dashboard.noStatusComplaints', { status: t(`status.${group.key}`).toLowerCase() })}</div>}
      </section>;
    })}</div>
    {assignmentMeta.pages > 1 && <div className="pagination"><button disabled={assignmentMeta.page <= 1} onClick={() => setAssignmentMeta((current) => ({ ...current, page: current.page - 1 }))}>{t('dashboard.previousAssignments')}</button><span>{t('complaints.page', { page: assignmentMeta.page, pages: assignmentMeta.pages })} · {t('dashboard.total', { count: assignmentMeta.total })}</span><button disabled={assignmentMeta.page >= assignmentMeta.pages} onClick={() => setAssignmentMeta((current) => ({ ...current, page: current.page + 1 }))}>{t('dashboard.nextAssignments')}</button></div>}
  </div>;
}

function AssignmentCard({ assignment, evidenceFiles, uploadProgress, onEvidenceChange, updatingId, onStatusChange, onAssignmentResponse }) {
  useTranslation();
  const complaint = assignment.complaint;
  const isResolved = RESOLVED_STATUSES.includes(complaint.status);
  const needsReview = complaint.status === 'needs_review';
  const needsResponse = assignment.responseStatus === 'pending' && complaint.status === 'assigned';
  const nextStatus = !isResolved && !needsReview && !needsResponse && complaint.status === 'assigned' ? 'in_progress' : !isResolved && !needsReview && complaint.status === 'in_progress' ? 'needs_review' : null;
  const evidenceStage = complaint.status === 'assigned' ? 'before' : 'after';
  const savedEvidence = evidenceStage === 'before' ? complaint.beforeImages || [] : complaint.afterImages || [];
  const completionPhotosCount = complaint.afterImages?.length || 0;
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
      {needsReview && <span className="status-badge">Needs Review</span>}
      {isResolved && <span className="status-badge resolved-badge">Resolved</span>}
      {!nextStatus && !isResolved && <Link className="assignment-action" to={`/dashboard/complaints/${complaint._id}`}>View details <span>→</span></Link>}
    </div>
    {nextStatus && !(evidenceStage === 'after' && completionPhotosCount > 0) && <div className="assignment-evidence-step"><strong>{evidenceStage === 'before' ? 'Before starting' : 'Before submitting for review'}</strong><ImageGallery images={savedEvidence} label={evidenceStage === 'before' ? 'Work-start evidence' : 'Completion evidence'} compact />{evidenceStage === 'before' ? <><ImageUploader files={evidenceFiles} onChange={onEvidenceChange} disabled={updatingId === complaint._id} label="Add work-start image" /><button className="assignment-action evidence-submit-button" disabled={updatingId === complaint._id || !evidenceFiles.length} onClick={() => onStatusChange(complaint._id, nextStatus, evidenceStage, evidenceFiles)}>{updatingId === complaint._id ? 'Saving...' : `Upload & mark ${statusLabel(nextStatus)}`}</button></> : <><Suspense fallback={<div className="skeleton-item" role="status">Preparing camera…</div>}><LiveCameraCapture disabled={updatingId === complaint._id} onSubmit={(file, metadata) => onStatusChange(complaint._id, nextStatus, evidenceStage, [file], metadata)} /></Suspense><DevGalleryProof disabled={updatingId === complaint._id} onSubmit={(file, metadata) => onStatusChange(complaint._id, nextStatus, evidenceStage, [file], metadata)} /></>}{uploadProgress !== undefined && <div className="upload-progress" role="status"><progress max="100" value={uploadProgress} /><span>Uploading proof · {uploadProgress}%</span></div>}</div>}
    {needsReview && <div className="assignment-response-actions"><p>Completion photos are waiting for admin review.</p></div>}
    {needsResponse && <div className="assignment-response-actions"><p>This assignment is awaiting your response.</p><button className="primary-button compact-button" disabled={updatingId === complaint._id} onClick={() => onAssignmentResponse(complaint._id, 'accepted')}>Accept assignment</button><button className="outline-button" disabled={updatingId === complaint._id} onClick={() => onAssignmentResponse(complaint._id, 'declined')}>Decline</button></div>}
  </article>;
}
