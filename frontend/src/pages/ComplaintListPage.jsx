import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { complaintCategories, getComplaints } from '../api/complaints.js';
import ComplaintCard from '../components/complaints/ComplaintCard.jsx';
import ComplaintMap from '../components/maps/ComplaintMap.jsx';

export default function ComplaintListPage({ mine = false }) {
  const [result, setResult] = useState({ items: [], total: 0, pages: 1 });
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', page: 1, limit: 12 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getComplaints(filters)
      .then((data) => { if (mounted) setResult(data); })
      .catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'Complaints could not be loaded.')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [filters]);

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value, page: 1 }));
  }

  const title = mine ? 'My complaints' : 'Complaint management';
  const description = mine ? 'Track the issues you have raised and their progress.' : 'Review, filter, and coordinate neighbourhood reports.';

  return <div className="complaints-page"><div className="page-heading"><div><p className="eyebrow">Civic reports</p><h1>{title}</h1><p className="page-lede">{description}</p></div><Link className="primary-button compact-button" to="/dashboard/complaints/new">New complaint <span>+</span></Link></div><div className="complaint-toolbar"><div className="filter-label">{result.total || 0} reports</div><select name="status" value={filters.status} onChange={updateFilter}><option value="">All statuses</option><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><select name="category" value={filters.category} onChange={updateFilter}><option value="">All categories</option>{complaintCategories.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select><select name="priority" value={filters.priority} onChange={updateFilter}><option value="">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>{error && <div className="notice-banner">{error}</div>}{!isLoading && result.items.length > 0 && <ComplaintMap complaints={result.items} className="complaints-overview-map" />}{isLoading ? <div className="loading-state">Loading complaints...</div> : result.items.length ? <div className="complaint-grid">{result.items.map((complaint) => <ComplaintCard key={complaint._id} complaint={complaint} />)}</div> : <div className="empty-state complaint-empty"><span>◈</span><strong>No complaints found</strong><p>Try adjusting your filters or report an issue in your neighbourhood.</p></div>}{result.pages > 1 && <div className="pagination"><button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>← Previous</button><span>Page {result.page} of {result.pages}</span><button disabled={filters.page >= result.pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next →</button></div>}</div>;
}
