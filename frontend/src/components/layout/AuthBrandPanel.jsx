const featurePoints = [
  {
    title: 'Report with live geotagged photo',
    icon: <><path d="M4 7h3l1.5-2h7L17 7h3v12H4z" /><circle cx="12" cy="13" r="3" /></>
  },
  {
    title: 'AI-assisted triage',
    icon: <><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" /><circle cx="12" cy="12" r="4" /></>
  },
  {
    title: 'Transparent resolution',
    icon: <><path d="m5 12 4 4L19 6" /><path d="M20 12a8 8 0 1 1-2.3-5.7" /></>
  }
];

function BrandMark() {
  return <div className="brand-mark">S</div>;
}

export default function AuthBrandPanel() {
  return (
    <>
      <div className="auth-mobile-brand">
        <div className="auth-brand-lockup"><BrandMark /><strong>StreetSetu</strong></div>
        <p>Make every street count.</p>
      </div>
      <aside className="auth-visual">
        <div className="auth-visual-top"><BrandMark /><strong>StreetSetu</strong></div>
        <div className="signal-map" aria-hidden="true"><span className="map-line line-one" /><span className="map-line line-two" /><span className="map-line line-three" /><span className="map-pin pin-one" /><span className="map-pin pin-two" /><span className="map-pin pin-three" /></div>
        <div className="auth-visual-copy">
          <p className="eyebrow">Neighbourhood intelligence</p>
          <h2>Make every street <em>count.</em></h2>
          <ul className="auth-feature-list">
            {featurePoints.map((feature) => (
              <li key={feature.title}>
                <span className="auth-feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{feature.icon}</svg></span>
                <span>{feature.title}</span>
              </li>
            ))}
          </ul>
          <div className="auth-quote-strip"><span>Citizen report</span><i aria-hidden="true">→</i><strong>Accountable action</strong></div>
        </div>
      </aside>
    </>
  );
}
