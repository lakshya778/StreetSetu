import { lazy, Suspense, useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader.jsx';
import guide from '../data/segregationGuide.json';

const RecyclingCentersMap = lazy(() => import('../components/maps/RecyclingCentersMap.jsx'));

export default function SegregationGuidePage() {
  const [search, setSearch] = useState('');
  const visibleCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return guide;
    return guide.filter((category) => [category.name, category.binColor, ...category.examples]
      .some((value) => value.toLowerCase().includes(query)));
  }, [search]);

  return <div className="segregation-page">
    <PageHeader kicker="Everyday guide" title="Waste segregation guide" subtitle="Sort waste at home and find a suitable local drop-off point." />
    <section className="panel segregation-search"><label htmlFor="segregation-search">Search an item</label><input id="segregation-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try banana peel or plastic bottle" /></section>
    {visibleCategories.length ? <section className="segregation-grid" aria-label="Waste categories">{visibleCategories.map((category) => <article className="panel segregation-card" key={category.id}>
      <div className={`segregation-bin bin-${category.id}`} aria-hidden="true">{category.name.slice(0, 1)}</div>
      <div><p className="eyebrow">Use the {category.binColor.toLowerCase()} bin</p><h2>{category.name}</h2><p>Examples: {category.examples.join(', ')}.</p></div>
    </article>)}</section> : <div className="panel guide-no-results">No waste category matches “{search}”. Try another item.</div>}
    <section className="recycling-centers-section">
      <div className="panel-heading"><div><p className="eyebrow">Delhi / NCR placeholders</p><h2>Recycling centers</h2><p>These sample locations need local verification before use.</p></div></div>
      <Suspense fallback={<div className="map-loading recycling-map" role="status">Loading recycling map…</div>}><RecyclingCentersMap /></Suspense>
    </section>
  </div>;
}
