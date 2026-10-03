import { Link } from 'react-router-dom';

export default function PublicHeader() {
  return <header className="public-site-header"><Link to="/transparency" className="public-brand"><span className="brand-mark">S</span><span><strong>StreetSetu</strong><small>Neighbourhood action</small></span></Link><nav><Link to="/transparency">Transparency</Link><Link to="/login">Sign in</Link></nav></header>;
}
