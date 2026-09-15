import { useLocation } from 'react-router-dom';

const labels = { '/dashboard/complaints': 'Complaints', '/dashboard/neighbourhoods': 'Neighbourhoods', '/dashboard/notifications': 'Notifications' };

export default function WorkspacePage() {
  const { pathname } = useLocation();
  const label = labels[pathname] || 'Workspace';
  return <div className="placeholder-page"><span className="placeholder-icon">◈</span><p className="eyebrow">Workspace module</p><h1>{label}</h1><p>This surface is ready for the next StreetSetu workflow.</p></div>;
}
