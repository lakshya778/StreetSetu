import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { complaintCategories, getComplaints } from '../api/complaints.js';
import { assignComplaint, reassignComplaint } from '../api/assignments.js';
import ComplaintMap from '../components/maps/ComplaintMap.jsx';
import { statusLabel } from '../components/complaints/ComplaintCard.jsx';

export default function AdminComplaintManagementPage() {
  const [result, setResult] = useState({ items: [], total: 0, pages: 1 });
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', page: 1, limit: 12 });
  const [volunteerIds, setVolunteerIds] = useState({});
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

  function updateFilter(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value, page: 1 })); }
  function updateVolunteerId(id, value) { setVolunteerIds((current) => ({ ...current, [id]: value })); }

  async function handleAssignment(complaint, reassign) {
    const volunteerId = volunteerIds[complaint._id];
    if (!volunteerId) { setError('Enter a volunteer ID before assigning.'); return; }
    setActiveAction(`${reassign ? 'reassign' : 'assign'}-${complaint._id}`);
    setError('');
    try { await (reassign ? reassignComplaint : assignComplaint)(complaint._id, volunteerId); await loadComplaints(); setVolunteerIds((current) => ({ ...current, [complaint._id]: '' })); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'The complaint assignment could not be saved.')); }
    finally { setActiveAction(''); }
  }

  return <div className="admin-complaints-page"><div className="page-heading"><div><p className="eyebrow">Admin operations</p><h1>Complaint management</h1><p className="page-lede">Review every report, assign ownership, and follow the full history.</p></div><span className="admin-report-count">{result.total || 0} total reports</span></div><div className="complaint-toolbar"><div className="filter-label">Filter reports</div><select name="status" value={filters.status} onChange={updateFilter}><option value="">All statuses</option><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="rejected">Rejected</option></select><select name="category" value={filters.category} onChange={updateFilter}><option value="">All categories</option>{complaintCategories.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select><select name="priority" value={filters.priority} onChange={updateFilter}><option value="">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>{error && <div className="notice-banner">{error}<button onClick={loadComplaints}>Retry</button></div>}{!isLoading && result.items.length > 0 && <ComplaintMap complaints={result.items} className="complaints-overview-map" />}{isLoading ? <div className="loading-state">Loading all complaints...</div> : <div className="admin-complaint-table panel"><div className="admin-table-head"><span>Complaint</span><span>Status</span><span>Assignment</span><span>Action</span></div>{result.items.length ? result.items.map((complaint) => <article className="admin-complaint-row" key={complaint._id}><div className="admin-complaint-title"><strong>{complaint.title}</strong><small>{complaint.category?.replaceAll('_', ' ')} · {complaint.priority} priority</small><Link to={`/dashboard/complaints/${complaint._id}`}>View timeline →</Link></div><div><span className={`detail-status status-${complaint.status}`}><i />{statusLabel(complaint.status)}</span></div><div className="assignment-summary"><strong>{complaint.assignedVolunteer?.name || 'Unassigned'}</strong><small>{complaint.assignedVolunteer?.email || 'No active volunteer'}</small></div><div className="admin-assignment-action"><input value={volunteerIds[complaint._id] || ''} onChange={(event) => updateVolunteerId(complaint._id, event.target.value)} placeholder="Volunteer ID" aria-label={`Volunteer ID for ${complaint.title}`} /><div><button disabled={activeAction === `assign-${complaint._id}`} onClick={() => handleAssignment(complaint, false)}>{activeAction === `assign-${complaint._id}` ? 'Saving...' : complaint.assignedVolunteer ? 'Assign' : 'Assign volunteer'}</button>{complaint.assignedVolunteer && <button disabled={activeAction === `reassign-${complaint._id}`} onClick={() => handleAssignment(complaint, true)}>{activeAction === `reassign-${complaint._id}` ? 'Saving...' : 'Reassign'}</button>}</div></div></article>) : <div className="empty-state"><span>◈</span><strong>No complaints found</strong><p>Try a different set of filters.</p></div>}</div>}{result.pages > 1 && <div className="pagination"><button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>← Previous</button><span>Page {result.page} of {result.pages}</span><button disabled={filters.page >= result.pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next →</button></div>}</div>;
}
