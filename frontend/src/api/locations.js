const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

async function requestNominatim(path, signal) {
  const response = await fetch(`${NOMINATIM_URL}${path}`, {
    headers: { Accept: 'application/json' },
    signal
  });
  if (!response.ok) throw new Error('Location search is temporarily unavailable.');
  return response.json();
}

function formatAddress(result) {
  return result?.display_name || '';
}

export async function searchAddresses(query, { signal } = {}) {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '5' });
  const results = await requestNominatim(`/search?${params}`, signal);
  return results.map((result) => ({
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    address: formatAddress(result),
    id: result.place_id
  })).filter((result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude));
}

export async function reverseGeocode(latitude, longitude, { signal } = {}) {
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', addressdetails: '1' });
  const result = await requestNominatim(`/reverse?${params}`, signal);
  return formatAddress(result);
}
