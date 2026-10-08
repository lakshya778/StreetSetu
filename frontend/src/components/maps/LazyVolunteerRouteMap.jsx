import { lazy, Suspense } from 'react';

const VolunteerRouteMap = lazy(() => import('./VolunteerRouteMap.jsx'));

export default function LazyVolunteerRouteMap(props) {
  return <Suspense fallback={<section className="panel map-loading" role="status">Loading route map…</section>}><VolunteerRouteMap {...props} /></Suspense>;
}
