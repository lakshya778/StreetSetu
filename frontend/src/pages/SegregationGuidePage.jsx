import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../components/layout/PageHeader.jsx';
import guide from '../data/segregationGuide.json';

const RecyclingCentersMap = lazy(() => import('../components/maps/RecyclingCentersMap.jsx'));

export default function SegregationGuidePage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const visibleCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return guide;
    return guide.filter((category) => [
      category.name,
      category.binColor,
      t(`guide.category.${category.id}`),
      t(`guide.binColor.${category.binColor.toLowerCase()}`),
      ...category.examples,
      ...t(`guide.examples.${category.id}`, { returnObjects: true })
    ]
      .some((value) => value.toLowerCase().includes(query)));
  }, [search, t]);

  return <div className="segregation-page">
    <PageHeader kicker={t('guide.kicker')} title={t('guide.title')} subtitle={t('guide.subtitle')} />
    <section className="panel segregation-search"><label htmlFor="segregation-search">{t('guide.searchLabel')}</label><input id="segregation-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('guide.searchPlaceholder')} /></section>
    {visibleCategories.length ? <section className="segregation-grid" aria-label={t('guide.categoriesLabel')}>{visibleCategories.map((category) => <article className="panel segregation-card" key={category.id}>
      <div className={`segregation-bin bin-${category.id}`} aria-hidden="true">{t(`guide.category.${category.id}`).slice(0, 1)}</div>
      <div><p className="eyebrow">{t('guide.useBin', { color: t(`guide.binColor.${category.binColor.toLowerCase()}`) })}</p><h2>{t(`guide.category.${category.id}`)}</h2><p>{t('guide.examplesLabel', { items: t(`guide.examples.${category.id}`, { returnObjects: true }).join(', ') })}</p></div>
    </article>)}</section> : <div className="panel guide-no-results">{t('guide.noResults', { query: search })}</div>}
    <section className="recycling-centers-section">
      <div className="panel-heading"><div><p className="eyebrow">{t('guide.centersKicker')}</p><h2>{t('guide.centersTitle')}</h2><p>{t('guide.centersNote')}</p></div></div>
      <Suspense fallback={<div className="map-loading recycling-map" role="status">{t('guide.loadingMap')}</div>}><RecyclingCentersMap /></Suspense>
    </section>
  </div>;
}
