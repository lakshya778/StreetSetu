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
let sessionExpirationDispatched = false;

function dispatchSessionExpired() {
  clearAccessToken();
  localStorage.removeItem(SESSION_KEY);
  if (!sessionExpirationDispatched) {
    sessionExpirationDispatched = true;
    window.dispatchEvent(new Event('streetsetu:session-expired'));
  }
}

function isPublicApiRequest(config) {
  const url = String(config.url || '');
  return config.skipAccessToken
    || /\/auth\/(login|register|refresh|logout)(?:\?|$)/.test(url)
    || /\/public\/(transparency|complaints)(?:\/|\?|$)/.test(url);
}

function storeAccessToken(token) {
  sessionExpirationDispatched = false;
  setAccessToken(token);
}

export async function ensureAccessToken() {
  const currentToken = getAccessToken();
  if (currentToken) return currentToken;

  try {
    refreshRequest ||= axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true });
    const { data } = await refreshRequest;
    const accessToken = data.data.accessToken || data.data.token;
    if (!accessToken) throw new Error('The refresh response did not include an access token');
    storeAccessToken(accessToken);
    window.dispatchEvent(new CustomEvent('streetsetu:token-refreshed', { detail: { accessToken } }));
    return accessToken;
  } catch (refreshError) {
    dispatchSessionExpired();
    throw refreshError;
  } finally {
    refreshRequest = null;
  }
}

api.interceptors.request.use(async (config) => {
  let token = getAccessToken();
  if (token) sessionExpirationDispatched = false;
  if (!token && !isPublicApiRequest(config)) {
    if (!localStorage.getItem(SESSION_KEY)) throw new axios.CanceledError('No signed-in session');
    token = await ensureAccessToken();
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback;
}

api.interceptors.response.use(async (response) => {
  await cacheApiResponse(response);
  return response;
}, async (error) => {
  if (!error.response) {
    const cached = await readOfflineApiResponse(error);
    if (cached) return cached;
  }
  const original = error.config;
  const isAuthRequest = /\/auth\/(login|register|refresh|logout)/.test(original?.url || '');
  if (error.response?.status !== 401 || !original || isAuthRequest) throw error;
  if (original._retry) {
    dispatchSessionExpired();
    throw error;
  }
  original._retry = true;
  try {
    refreshRequest ||= axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true });
    const { data } = await refreshRequest;
    const accessToken = data.data.accessToken || data.data.token;
    storeAccessToken(accessToken);
    original.headers.Authorization = `Bearer ${accessToken}`;
    window.dispatchEvent(new CustomEvent('streetsetu:token-refreshed', { detail: { accessToken } }));
    return api(original);
  } catch (refreshError) {
    dispatchSessionExpired();
    throw refreshError;
  } finally {
    refreshRequest = null;
  }
});

export default api;
