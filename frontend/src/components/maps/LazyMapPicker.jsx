import { lazy, Suspense } from 'react';

const MapPicker = lazy(() => import('./MapPicker.jsx'));

export default function LazyMapPicker(props) {
  return <Suspense fallback={<div className="map-loading picker-map-loading" role="status">Loading location map…</div>}><MapPicker {...props} /></Suspense>;
}
