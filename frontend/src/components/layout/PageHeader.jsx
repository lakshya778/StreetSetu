export default function PageHeader({ kicker, title, subtitle, actions, className = '' }) {
  return (
    <header className={`page-heading ${className}`.trim()}>
      <div className="page-heading-copy">
        {kicker && <p className="eyebrow">{kicker}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="page-lede">{subtitle}</p>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  );
}
