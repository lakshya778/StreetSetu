import axios from 'axios';
import { clearAccessToken, getAccessToken, getCurrentUserId, setAccessToken } from '../auth/accessTokenStore.js';

const SESSION_KEY = 'streetsetu_session';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

function offlineCacheKey(config) {
  if (config.method?.toLowerCase() !== 'get') return null;
  const userId = getCurrentUserId();
  if (!userId) return null;
  try {
    const url = new URL(api.getUri(config));
    if (!['/dashboard/summary', '/complaints', '/notifications'].includes(url.pathname.replace('/api/v1', ''))) return null;
    url.searchParams.set('__streetsetu_user', userId);
    return new Request(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
  } catch { return null; }
}

async function cacheApiResponse(response) {
  const key = offlineCacheKey(response.config);
  if (!key || typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(`streetsetu-private-v1-${getCurrentUserId()}`);
    await cache.put(key, new Response(JSON.stringify(response.data), { headers: { 'Content-Type': 'application/json' } }));
  } catch { /* Offline support is best effort when storage is full or unavailable. */ }
}

async function readOfflineApiResponse(error) {
  const key = offlineCacheKey(error.config || {});
  if (!key || typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(`streetsetu-private-v1-${getCurrentUserId()}`);
    const cached = await cache.match(key);
    if (!cached) return null;
    return { data: await cached.json(), status: 200, statusText: 'OK (offline cache)', headers: {}, config: error.config, request: error.request };
  } catch { return null; }
}

let refreshRequest;

export async function ensureAccessToken() {
  const currentToken = getAccessToken();
  if (currentToken) return currentToken;

  try {
    refreshRequest ||= axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true });
    const { data } = await refreshRequest;
    const accessToken = data.data.accessToken || data.data.token;
    if (!accessToken) throw new Error('The refresh response did not include an access token');
    setAccessToken(accessToken);
    window.dispatchEvent(new CustomEvent('streetsetu:token-refreshed', { detail: { accessToken } }));
    return accessToken;
  } catch (refreshError) {
    clearAccessToken();
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event('streetsetu:session-expired'));
    throw refreshError;
  } finally {
    refreshRequest = null;
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.streetsetuDiagnostic === 'volunteer-recommendations') {
    console.info('[StreetSetu] Volunteer recommendations request', {
      url: api.getUri(config),
      authorizationHeaderPresent: Boolean(config.headers.Authorization)
    });
  }
  return config;
});

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback;
}

api.interceptors.response.use(async (response) => {
  if (response.config.streetsetuDiagnostic === 'volunteer-recommendations') {
    console.info('[StreetSetu] Volunteer recommendations response', { status: response.status });
  }
  await cacheApiResponse(response);
  return response;
}, async (error) => {
  if (error.config?.streetsetuDiagnostic === 'volunteer-recommendations') {
    console.info('[StreetSetu] Volunteer recommendations response', { status: error.response?.status ?? 'network error' });
  }
  if (!error.response) {
    const cached = await readOfflineApiResponse(error);
    if (cached) return cached;
  }
  const original = error.config;
  const isAuthRequest = /\/auth\/(login|register|refresh|logout)/.test(original?.url || '');
  if (error.response?.status !== 401 || !original || original._retry || isAuthRequest) throw error;
  original._retry = true;
  try {
    refreshRequest ||= axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true });
    const { data } = await refreshRequest;
    const accessToken = data.data.accessToken || data.data.token;
    setAccessToken(accessToken);
    original.headers.Authorization = `Bearer ${accessToken}`;
    window.dispatchEvent(new CustomEvent('streetsetu:token-refreshed', { detail: { accessToken } }));
    return api(original);
  } catch (refreshError) {
    clearAccessToken();
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event('streetsetu:session-expired'));
    throw refreshError;
  } finally {
    refreshRequest = null;
  }
});

export default api;
