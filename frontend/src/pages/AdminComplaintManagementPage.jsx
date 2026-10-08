import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { complaintCategories, complaintListCacheKey, getComplaints } from '../api/complaints.js';
import { assignComplaint, getVolunteerRecommendations, reassignComplaint } from '../api/assignments.js';
import ComplaintMap from '../components/maps/LazyComplaintMap.jsx';
import { statusLabel } from '../components/complaints/ComplaintCard.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import SkeletonList from '../components/layout/SkeletonList.jsx';

export default function AdminComplaintManagementPage() {
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
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Complaints could not be loaded.')); }
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
      if (event.detail.key === key) setError(getApiErrorMessage(event.detail.error, 'Complaints could not be refreshed.'));
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
    if (!volunteerId) { setError('Enter a volunteer ID before assigning.'); return; }
    setActiveAction(`${reassign ? 'reassign' : 'assign'}-${complaint._id}`);
    setError('');
    try {
      await (reassign ? reassignComplaint : assignComplaint)(complaint._id, volunteerId);
      await loadComplaints();
      setVolunteerIds((current) => ({ ...current, [complaint._id]: '' }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'The complaint assignment could not be saved.'));
    } finally { setActiveAction(''); }
  }

  async function handleRecommendations(complaint) {
    setActiveAction(`recommend-${complaint._id}`);
    setError('');
    try {
      const ranked = await getVolunteerRecommendations(complaint._id);
      setRecommendations((current) => ({ ...current, [complaint._id]: ranked }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Volunteer recommendations could not be loaded.'));
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
      setError(getApiErrorMessage(requestError, 'Recommended volunteer could not be assigned.'));
    } finally { setActiveAction(''); }
  }

  async function handleAutoAssignment(complaint) {
    setActiveAction(`auto-${complaint._id}`);
    setError('');
    try {
      const ranked = await getVolunteerRecommendations(complaint._id);
      setRecommendations((current) => ({ ...current, [complaint._id]: ranked }));
      const bestAvailable = ranked.find((item) => item.availability !== 'unavailable');
      if (!bestAvailable) { setError('No available volunteers were found for automatic assignment. Review the recommendations or assign manually.'); return; }
      await assignComplaint(complaint._id, bestAvailable.volunteerId, { recommendationAccepted: true });
      await loadComplaints();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Automatic assignment could not be completed.'));
    } finally { setActiveAction(''); }
  }

  function renderAssignmentAction(complaint) {
    if (complaint.status === 'under_review') {
      const isWorking = activeAction.endsWith(complaint._id);
      return <><div className="admin-assignment-action"><button disabled={isWorking} onClick={() => handleRecommendations(complaint)}>{activeAction === `recommend-${complaint._id}` ? 'Ranking...' : 'Recommend volunteers'}</button><button disabled={isWorking} onClick={() => handleAutoAssignment(complaint)}>{activeAction === `auto-${complaint._id}` ? 'Assigning...' : 'Auto assign'}</button><input value={volunteerIds[complaint._id] || ''} onChange={(event) => updateVolunteerId(complaint._id, event.target.value)} placeholder="Volunteer ID" aria-label={`Volunteer ID for ${complaint.title}`} /><button disabled={isWorking} onClick={() => handleAssignment(complaint, false)}>{activeAction === `assign-${complaint._id}` ? 'Saving...' : 'Assign manually'}</button></div>{recommendations[complaint._id]?.length > 0 && <div className="recommendation-list">{recommendations[complaint._id].slice(0, 5).map((item) => <div className="recommendation-row" key={item.volunteerId}><span><strong>{item.volunteer?.name || item.name}</strong><small>{item.area || item.city || 'Work area not set'} · {item.availability} · Score {item.score} · {item.activeAssignments} active · {item.distanceKm == null ? 'distance unknown' : `${item.distanceKm} km away`} · {item.resolutionRate}% resolved</small></span><button disabled={isWorking || item.availability === 'unavailable'} onClick={() => acceptRecommendation(complaint, item.volunteerId)}>Assign</button></div>)}</div>}</>;
    }
    if (complaint.assignedVolunteer && ['assigned', 'in_progress'].includes(complaint.status)) {
      return <div className="admin-assignment-action"><input value={volunteerIds[complaint._id] || ''} onChange={(event) => updateVolunteerId(complaint._id, event.target.value)} placeholder="New volunteer ID" aria-label={`New volunteer ID for ${complaint.title}`} /><button disabled={activeAction === `reassign-${complaint._id}`} onClick={() => handleAssignment(complaint, true)}>{activeAction === `reassign-${complaint._id}` ? 'Saving...' : 'Reassign'}</button></div>;
    }
    if (complaint.status === 'submitted') return <Link className="assignment-review-link" to={`/dashboard/complaints/${complaint._id}`}>Review before assignment →</Link>;
    return <span className="assignment-unavailable">No assignment action</span>;
  }

  return <div className="admin-complaints-page">
    <div className="page-heading"><div><p className="eyebrow">Admin operations</p><h1>Complaint management</h1><p className="page-lede">Review every report, assign ownership, and follow the full history.</p></div><span className="admin-report-count">{result.total || 0} total reports</span></div>
    <div className="complaint-toolbar"><div className="filter-label">Filter reports</div><select name="status" value={filters.status} onChange={updateFilter}><option value="">All statuses</option><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="rejected">Rejected</option></select><select name="category" value={filters.category} onChange={updateFilter}><option value="">All categories</option>{complaintCategories.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select><select name="priority" value={filters.priority} onChange={updateFilter}><option value="">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
    <label className="admin-search-field">Search reports<input name="search" value={searchInput} onChange={updateFilter} placeholder="Title, description, or address" /></label>
    {error && <div className="notice-banner">{error}<button onClick={loadComplaints}>Retry</button></div>}
    {!isLoading && result.items.length > 0 && <ComplaintMap complaints={result.items} className="complaints-overview-map" />}
    {isLoading ? <SkeletonList rows={4} variant="row" /> : <div className="admin-complaint-table panel">
      <div className="admin-table-head"><span>Complaint</span><span>Status</span><span>Assignment</span><span>Action</span></div>
      {result.items.length ? result.items.map((complaint) => <article className="admin-complaint-row" key={complaint._id}>
        <div className="admin-complaint-title"><strong>{complaint.title}</strong><small>{complaint.category?.replaceAll('_', ' ')} · {complaint.priority} priority</small><Link to={`/dashboard/complaints/${complaint._id}`}>View timeline →</Link></div>
        <div><span className={`detail-status status-${complaint.status}`}><i />{statusLabel(complaint.status)}</span></div>
        <div className="assignment-summary"><strong>{complaint.assignedVolunteer?.name || 'Unassigned'}</strong><small>{complaint.assignedVolunteer?.email || 'No active volunteer'}</small></div>
        <div>{renderAssignmentAction(complaint)}</div>
      </article>) : <div className="empty-state"><span>◈</span><strong>No complaints found</strong><p>Try a different set of filters.</p></div>}
    </div>}
    {result.pages > 1 && <div className="pagination"><button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>← Previous</button><span>Page {result.page} of {result.pages}</span><button disabled={filters.page >= result.pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next →</button></div>}
  </div>;
}
