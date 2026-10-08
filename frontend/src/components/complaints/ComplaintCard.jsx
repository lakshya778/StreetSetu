import { Link } from 'react-router-dom';

const statusLabels = {
  submitted: 'Submitted', under_review: 'Under review', assigned: 'Assigned',
  in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed', rejected: 'Rejected'
};

export function statusLabel(status) {
  return statusLabels[status] || status;
}

function thumbnailUrl(image) {
  const originalUrl = image?.url || image?.src;
  if (!originalUrl) return '';
  try {
    const url = new URL(originalUrl);
    if (url.hostname.endsWith('res.cloudinary.com')) {
      url.pathname = url.pathname.replace('/upload/', '/upload/w_400,q_auto,f_auto/');
      return url.toString();
    }
  } catch {
    return originalUrl;
  }
  return originalUrl;
}

export default function ComplaintCard({ complaint }) {
  const thumbnail = thumbnailUrl(complaint.attachments?.[0]);
  return (
    <Link to={`/dashboard/complaints/${complaint._id}`} className="complaint-card">
      {thumbnail && <img className="complaint-card-thumbnail" src={thumbnail} alt="" loading="lazy" decoding="async" width="400" height="300" />}
      <div className="complaint-card-top">
        <span className={`status-dot status-${complaint.status}`} />
        <span className="complaint-status">{statusLabel(complaint.status)}</span>
        <span className={`priority-label priority-${complaint.priority}`}>{complaint.priority}</span>
      </div>
      <h3>{complaint.title}</h3>
      <p>{complaint.description}</p>
      <div className="complaint-card-meta">
        <span>{complaint.category?.replaceAll('_', ' ')}</span>
        <span>{new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
    </Link>
  );
}
