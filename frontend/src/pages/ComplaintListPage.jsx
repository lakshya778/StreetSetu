import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { complaintCategories, complaintListCacheKey, getComplaints } from '../api/complaints.js';
import ComplaintCard, { statusLabel } from '../components/complaints/ComplaintCard.jsx';
import ComplaintMap from '../components/maps/LazyComplaintMap.jsx';
import SkeletonList from '../components/layout/SkeletonList.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import StreetEmptyIllustration from '../components/layout/StreetEmptyIllustration.jsx';

const emptyResult = { items: [], total: 0, pages: 1, page: 1 };

export default function ComplaintListPage({ mine = false }) {
  const { t } = useTranslation();
  const [result, setResult] = useState(emptyResult);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', search: '', page: 1, limit: 12 });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getComplaints(filters)
      .then((data) => { if (mounted) setResult(data); })
      .catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, t('complaints.loadError'))); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [filters]);

  useEffect(() => {
    setFilters((current) => current.search === debouncedSearch ? current : { ...current, search: debouncedSearch, page: 1 });
  }, [debouncedSearch]);

  useEffect(() => {
    const key = complaintListCacheKey(filters);
    const handleRefresh = (event) => { if (event.detail.key === key) setResult(event.detail.data); };
    const handleRefreshError = (event) => {
      if (event.detail.key === key) setError(getApiErrorMessage(event.detail.error, t('complaints.refreshError')));
    };
    window.addEventListener('streetsetu:complaints-refreshed', handleRefresh);
    window.addEventListener('streetsetu:complaints-refresh-error', handleRefreshError);
    return () => {
      window.removeEventListener('streetsetu:complaints-refreshed', handleRefresh);
      window.removeEventListener('streetsetu:complaints-refresh-error', handleRefreshError);
    };
  }, [filters]);

  function updateFilter(event) {
    if (event.target.name === 'search') {
      setSearchInput(event.target.value);
      return;
    }
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value, page: 1 }));
  }
  const title = mine ? t('complaints.myTitle') : t('complaints.managementTitle');
  const description = mine ? t('complaints.mySubtitle') : t('complaints.managementSubtitle');

  return <div className="complaints-page">
    <PageHeader kicker={t('complaints.kicker')} title={title} subtitle={description} actions={<Link className="primary-button compact-button" to="/dashboard/complaints/new">{t('complaints.new')} <span>+</span></Link>} />
    <div className="complaint-toolbar"><div className="filter-label">{t('complaints.reportsCount', { count: result.total || 0 })}</div><input name="search" value={searchInput} onChange={updateFilter} placeholder={t('complaints.searchPlaceholder')} aria-label={t('complaints.searchPlaceholder')} /><select name="status" value={filters.status} onChange={updateFilter}><option value="">{t('complaints.allStatuses')}</option>{['submitted', 'under_review', 'assigned', 'in_progress', 'needs_review', 'resolved', 'closed', 'rejected'].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><select name="category" value={filters.category} onChange={updateFilter}><option value="">{t('complaints.allCategories')}</option>{complaintCategories.map((category) => <option key={category} value={category}>{t(`category.${category}`)}</option>)}</select><select name="priority" value={filters.priority} onChange={updateFilter}><option value="">{t('complaints.allPriorities')}</option>{['low', 'medium', 'high', 'critical'].map((priority) => <option key={priority} value={priority}>{t(`priority.${priority}`)}</option>)}</select></div>
    {error && <div className="notice-banner">{error}</div>}
    {!isLoading && result.items.length > 0 && <ComplaintMap complaints={result.items} className="complaints-overview-map" />}
    {isLoading ? <SkeletonList rows={6} /> : result.items.length ? <div className="complaint-grid">{result.items.map((complaint) => <ComplaintCard key={complaint._id} complaint={complaint} />)}</div> : <div className="empty-state complaint-empty"><StreetEmptyIllustration /><strong>{t('complaints.notFound')}</strong><p>{t('complaints.adjustFilters')}</p><Link className="primary-button compact-button" to="/dashboard/complaints/new">{t('complaints.reportIssue')} <span>→</span></Link></div>}
    {result.pages > 1 && <div className="pagination"><button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>{t('complaints.previous')}</button><span>{t('complaints.page', { page: result.page, pages: result.pages })}</span><button disabled={filters.page >= result.pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>{t('complaints.next')}</button></div>}
  </div>;
}
