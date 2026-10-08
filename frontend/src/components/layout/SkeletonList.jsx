export default function SkeletonList({ rows = 4, variant = 'card' }) {
  return <div className={`skeleton-list skeleton-list-${variant}`} role="status" aria-label="Loading results">
    {Array.from({ length: rows }, (_, index) => <div className="skeleton-item" key={index}><span /><span /><span /></div>)}
  </div>;
}
