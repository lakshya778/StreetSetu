import { lazy, Suspense } from 'react';

const ComplaintMap = lazy(() => import('./ComplaintMap.jsx'));

export default function LazyComplaintMap(props) {
  return <Suspense fallback={<div className={`map-loading ${props.className || ''}`} role="status">Loading map…</div>}><ComplaintMap {...props} /></Suspense>;
}
