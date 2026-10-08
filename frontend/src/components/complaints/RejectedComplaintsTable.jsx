import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/client.js';
import { getComplaints } from '../../api/complaints.js';
import { statusLabel } from './ComplaintCard.jsx';

export default function RejectedComplaintsTable() {
  useTranslation();
  const [result, setResult] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getComplaints({ status: 'rejected', page, limit: 8 })
      .then((data) => { if (mounted) setResult(data); })
      .catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'Rejected complaints could not be loaded.')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [page]);

  return <section className="panel rejected-table-panel">
    <div className="panel-heading"><div><p className="eyebrow">Admin review</p><h2>Rejected complaints</h2></div><span className="rejection-badge">{result.total} total</span></div>
    {error && <div className="notice-banner">{error}</div>}
    {isLoading ? <div className="loading-state">Loading rejected complaints...</div> : result.items.length ? <><div className="table-wrap rejected-table-wrap"><table><thead><tr><th>Complaint</th><th>Category</th><th>Reason</th><th>Rejected by</th><th>Rejected at</th></tr></thead><tbody>{result.items.map((complaint) => <tr key={complaint._id}>
      <td><Link className="rejected-complaint-link" to={`/dashboard/complaints/${complaint._id}`}>{complaint.title}</Link><span className="rejected-state-label">{statusLabel(complaint.status)}</span></td>
      <td className="capitalize-cell">{complaint.category?.replaceAll('_', ' ')}</td>
      <td className="rejection-reason-cell">{complaint.rejectionReason || 'Reason not recorded'}</td>
      <td>{complaint.rejectedBy?.name || '—'}</td>
      <td>{complaint.rejectedAt ? new Date(complaint.rejectedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
    </tr>)}</tbody></table></div>{result.pages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {result.pages}</span><button disabled={page >= result.pages} onClick={() => setPage((current) => current + 1)}>Next</button></div>}</> : <div className="empty-table">No complaints have been rejected.</div>}
  </section>;
}
