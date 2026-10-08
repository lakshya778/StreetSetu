import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { complaintCategories, complaintListCacheKey, getComplaints } from '../api/complaints.js';
import { assignComplaint, getVolunteerRecommendations, reassignComplaint } from '../api/assignments.js';
import ComplaintMap from '../components/maps/LazyComplaintMap.jsx';
import { statusLabel } from '../components/complaints/ComplaintCard.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import SkeletonList from '../components/layout/SkeletonList.jsx';

export default function AdminComplaintManagementPage() {
  const { t } = useTranslation();
  const { socket } = useNotifications();
  const [result, setResult] = useState({ items: [], total: 0, pages: 1 });
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', search: '', page: 1, limit: 12 });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput);
  const [volunteerIds, setVolunteerIds] = useState({});
  const [recommendations, setRecommendations] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState('');
  const [error, setError] = useState('');

  async function loadComplaints() {
    setIsLoading(true);
    setError('');
    try { setResult(await getComplaints(filters)); }
    catch (requestError) { setError(getApiErrorMessage(requestError, t('complaints.loadError'))); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { loadComplaints(); }, [filters]);
  useEffect(() => {
    setFilters((current) => current.search === debouncedSearch ? current : { ...current, search: debouncedSearch, page: 1 });
  }, [debouncedSearch]);
  useEffect(() => {
    const key = complaintListCacheKey(filters);
    const handleRefresh = (event) => {
      if (event.detail.key === key) setResult(event.detail.data);
    };
    const handleRefreshError = (event) => {
      if (event.detail.key === key) setError(getApiErrorMessage(event.detail.error, t('complaints.refreshError')));
    };
    window.addEventListener('streetsetu:complaints-refreshed', handleRefresh);
    window.addEventListener('streetsetu:complaints-refresh-error', handleRefreshError);
    return () => {
      window.removeEventListener('streetsetu:complaints-refreshed', handleRefresh);
      window.removeEventListener('streetsetu:complaints-refresh-error', handleRefreshError);
    };
  }, [filters]);
  useEffect(() => {
    if (!socket) return undefined;
    socket.on('dashboard:updated', loadComplaints);
    return () => socket.off('dashboard:updated', loadComplaints);
  }, [socket, filters]);

  function updateFilter(event) {
    if (event.target.name === 'search') {
      setSearchInput(event.target.value);
      return;
    }
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value, page: 1 }));
  }
  function updateVolunteerId(id, value) { setVolunteerIds((current) => ({ ...current, [id]: value })); }

  async function handleAssignment(complaint, reassign) {
    const volunteerId = volunteerIds[complaint._id];
    if (!volunteerId) { setError(t('adminComplaints.enterVolunteerId')); return; }
    setActiveAction(`${reassign ? 'reassign' : 'assign'}-${complaint._id}`);
    setError('');
    try {
      await (reassign ? reassignComplaint : assignComplaint)(complaint._id, volunteerId);
      await loadComplaints();
      setVolunteerIds((current) => ({ ...current, [complaint._id]: '' }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('adminComplaints.assignmentSaveError')));
    } finally { setActiveAction(''); }
  }

  async function handleRecommendations(complaint) {
    setActiveAction(`recommend-${complaint._id}`);
    setError('');
    try {
      const ranked = await getVolunteerRecommendations(complaint._id);
      setRecommendations((current) => ({ ...current, [complaint._id]: ranked }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('adminComplaints.recommendationLoadError')));
    } finally { setActiveAction(''); }
  }

  async function acceptRecommendation(complaint, volunteerId) {
    setActiveAction(`accept-${complaint._id}`);
    setError('');
    try {
      await assignComplaint(complaint._id, volunteerId, { recommendationAccepted: true });
      setRecommendations((current) => ({ ...current, [complaint._id]: null }));
      await loadComplaints();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('adminComplaints.recommendedAssignError')));
    } finally { setActiveAction(''); }
  }

  async function handleAutoAssignment(complaint) {
    setActiveAction(`auto-${complaint._id}`);
    setError('');
    try {
      const ranked = await getVolunteerRecommendations(complaint._id);
      setRecommendations((current) => ({ ...current, [complaint._id]: ranked }));
      const bestAvailable = ranked.find((item) => item.availability !== 'unavailable');
      if (!bestAvailable) { setError(t('adminComplaints.noAvailableVolunteers')); return; }
      await assignComplaint(complaint._id, bestAvailable.volunteerId, { recommendationAccepted: true });
      await loadComplaints();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('adminComplaints.autoAssignError')));
    } finally { setActiveAction(''); }
  }

  function renderAssignmentAction(complaint) {
    if (complaint.status === 'under_review') {
      const isWorking = activeAction.endsWith(complaint._id);
      return <><div className="admin-assignment-action"><button disabled={isWorking} onClick={() => handleRecommendations(complaint)}>{activeAction === `recommend-${complaint._id}` ? t('adminComplaints.ranking') : t('adminComplaints.recommendVolunteers')}</button><button disabled={isWorking} onClick={() => handleAutoAssignment(complaint)}>{activeAction === `auto-${complaint._id}` ? t('adminComplaints.assigning') : t('adminComplaints.autoAssign')}</button><input value={volunteerIds[complaint._id] || ''} onChange={(event) => updateVolunteerId(complaint._id, event.target.value)} placeholder={t('adminComplaints.volunteerId')} aria-label={`${t('adminComplaints.volunteerId')} for ${complaint.title}`} /><button disabled={isWorking} onClick={() => handleAssignment(complaint, false)}>{activeAction === `assign-${complaint._id}` ? t('adminComplaints.saving') : t('adminComplaints.assignManually')}</button></div>{recommendations[complaint._id]?.length > 0 && <div className="recommendation-list">{recommendations[complaint._id].slice(0, 5).map((item) => <div className="recommendation-row" key={item.volunteerId}><span><strong>{item.volunteer?.name || item.name}</strong><small>{item.area || item.city || t('adminComplaints.workAreaNotSet')} · {item.availability} · {t('adminComplaints.score')} {item.score} · {item.activeAssignments} {t('adminComplaints.activeAssignments')} · {item.distanceKm == null ? t('adminComplaints.distanceUnknown') : `${item.distanceKm} km ${t('adminComplaints.away')}`} · {item.resolutionRate}% {t('adminComplaints.resolved')}</small></span><button disabled={isWorking || item.availability === 'unavailable'} onClick={() => acceptRecommendation(complaint, item.volunteerId)}>{t('adminComplaints.assign')}</button></div>)}</div>}</>;
    }
    if (complaint.assignedVolunteer && ['assigned', 'in_progress'].includes(complaint.status)) {
      return <div className="admin-assignment-action"><input value={volunteerIds[complaint._id] || ''} onChange={(event) => updateVolunteerId(complaint._id, event.target.value)} placeholder={t('adminComplaints.newVolunteerId')} aria-label={`${t('adminComplaints.newVolunteerId')} for ${complaint.title}`} /><button disabled={activeAction === `reassign-${complaint._id}`} onClick={() => handleAssignment(complaint, true)}>{activeAction === `reassign-${complaint._id}` ? t('adminComplaints.saving') : t('adminComplaints.reassign')}</button></div>;
    }
    if (complaint.status === 'submitted') return <Link className="assignment-review-link" to={`/dashboard/complaints/${complaint._id}`}>{t('adminComplaints.reviewBeforeAssignment')}</Link>;
    return <span className="assignment-unavailable">{t('adminComplaints.noAssignmentAction')}</span>;
  }

  return <div className="admin-complaints-page">
    <PageHeader kicker={t('adminComplaints.kicker')} title={t('adminComplaints.title')} subtitle={t('adminComplaints.subtitle')} actions={<span className="admin-report-count">{t('adminComplaints.totalReports', { count: result.total || 0 })}</span>} />
    <div className="complaint-toolbar"><div className="filter-label">{t('adminComplaints.filterReports')}</div><select name="status" value={filters.status} onChange={updateFilter}><option value="">{t('adminComplaints.allStatuses')}</option>{['submitted', 'under_review', 'assigned', 'in_progress', 'needs_review', 'resolved', 'closed', 'rejected'].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><select name="category" value={filters.category} onChange={updateFilter}><option value="">{t('adminComplaints.allCategories')}</option>{complaintCategories.map((category) => <option key={category} value={category}>{t(`category.${category}`)}</option>)}</select><select name="priority" value={filters.priority} onChange={updateFilter}><option value="">{t('adminComplaints.allPriorities')}</option>{['low', 'medium', 'high', 'critical'].map((priority) => <option key={priority} value={priority}>{t(`priority.${priority}`)}</option>)}</select></div>
    <label className="admin-search-field">{t('adminComplaints.search')}<input name="search" value={searchInput} onChange={updateFilter} placeholder={t('adminComplaints.searchPlaceholder')} /></label>
    {error && <div className="notice-banner">{error}<button onClick={loadComplaints}>{t('adminComplaints.retry')}</button></div>}
    {!isLoading && result.items.length > 0 && <ComplaintMap complaints={result.items} className="complaints-overview-map" />}
    {isLoading ? <SkeletonList rows={4} variant="row" /> : <div className="admin-complaint-table panel">
      <div className="admin-table-head"><span>{t('adminComplaints.complaint')}</span><span>{t('adminComplaints.status')}</span><span>{t('adminComplaints.assignment')}</span><span>{t('adminComplaints.action')}</span></div>
      {result.items.length ? result.items.map((complaint) => <article className="admin-complaint-row" key={complaint._id}>
        <div className="admin-complaint-title"><strong>{complaint.title}</strong><small>{t(`category.${complaint.category}`, { defaultValue: complaint.category?.replaceAll('_', ' ') })} · {t(`priority.${complaint.priority}`, { defaultValue: complaint.priority })} {t('report.priority').toLowerCase()}</small><Link to={`/dashboard/complaints/${complaint._id}`}>{t('adminComplaints.viewTimeline')}</Link></div>
        <div><span className={`detail-status status-${complaint.status}`}><i />{statusLabel(complaint.status)}</span></div>
        <div className="assignment-summary"><strong>{complaint.assignedVolunteer?.name || t('adminComplaints.unassigned')}</strong><small>{complaint.assignedVolunteer?.email || t('adminComplaints.noActiveVolunteer')}</small></div>
        <div>{renderAssignmentAction(complaint)}</div>
      </article>) : <div className="empty-state"><span>◈</span><strong>{t('adminComplaints.noComplaints')}</strong><p>{t('adminComplaints.filterHint')}</p></div>}
    </div>}
    {result.pages > 1 && <div className="pagination"><button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>{t('adminComplaints.previous')}</button><span>{t('adminComplaints.page', { page: result.page, pages: result.pages })}</span><button disabled={filters.page >= result.pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>{t('adminComplaints.next')}</button></div>}
  </div>;
}
