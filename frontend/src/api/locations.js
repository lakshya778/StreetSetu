const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

async function requestNominatim(path, signal) {
  const timeoutController = new AbortController();
  const timeout = window.setTimeout(() => timeoutController.abort(), 30000);
  const abortFromCaller = () => timeoutController.abort(signal.reason);
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    const response = await fetch(`${NOMINATIM_URL}${path}`, {
      headers: { Accept: 'application/json' },
      signal: timeoutController.signal
    });
    if (!response.ok) throw new Error('Location search is temporarily unavailable.');
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

function formatAddress(result) {
  return result?.display_name || '';
}

function geographicParts(result) {
  const parts = result?.address || {};
  return {
    city: parts.city || parts.town || parts.village || parts.municipality || parts.county || '',
    area: parts.neighbourhood || parts.suburb || parts.quarter || parts.residential || parts.hamlet || parts.road || ''
  };
}

export async function searchAddresses(query, { signal } = {}) {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '5' });
  const results = await requestNominatim(`/search?${params}`, signal);
  return results.map((result) => ({
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    address: formatAddress(result),
    ...geographicParts(result),
    id: result.place_id
  })).filter((result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude));
}

export async function reverseGeocode(latitude, longitude, { signal } = {}) {
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', addressdetails: '1' });
  const result = await requestNominatim(`/reverse?${params}`, signal);
  return formatAddress(result);
}
