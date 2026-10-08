import axios from 'axios';
import { clearAccessToken, getAccessToken, getCurrentUserId, setAccessToken } from '../auth/accessTokenStore.js';

const SESSION_KEY = 'streetsetu_session';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});
const pendingGetRequests = new Map();
const slowRequestIds = new Set();

function transientRequestError(error) {
  return !axios.isCancel(error) && error.code !== 'ERR_CANCELED'
    && (!error.response || [502, 503, 504].includes(error.response.status));
}

function requestKey(config) {
  return `${api.getUri(config)}|${config.headers?.Authorization || ''}`;
}

async function requestWithRetry(adapter, config) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await adapter(config);
    } catch (error) {
      if (config.method?.toLowerCase() !== 'get' || attempt >= 2 || !transientRequestError(error) || navigator.onLine === false) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

function clearSlowRequest(config) {
  if (!config?._streetSetuRequestId) return;
  window.clearTimeout(config._streetSetuSlowTimer);
  slowRequestIds.delete(config._streetSetuRequestId);
  window.dispatchEvent(new CustomEvent('streetsetu:request-settled', { detail: { count: slowRequestIds.size } }));
  delete config._streetSetuRequestId;
}

async function deduplicatedGetAdapter(config, adapter) {
  if (config.method?.toLowerCase() !== 'get' || config.signal) return requestWithRetry(adapter, config);
  const key = requestKey(config);
  const inFlight = pendingGetRequests.get(key);
  if (inFlight) {
    const response = await inFlight;
    return { ...response, config, headers: { ...response.headers } };
  }

  const request = requestWithRetry(adapter, config);
  pendingGetRequests.set(key, request);
  try {
    return await request;
  } finally {
    if (pendingGetRequests.get(key) === request) pendingGetRequests.delete(key);
  }
}

function offlineCacheEntry(config) {
  if (config.method?.toLowerCase() !== 'get') return null;
  const userId = getCurrentUserId();
  try {
    const url = new URL(api.getUri(config));
    const isPublicEndpoint = url.pathname.includes('/public/');
    if (!userId && !isPublicEndpoint) return null;
    if (userId) url.searchParams.set('__streetsetu_user', userId);
    return {
      cacheName: userId ? `streetsetu-private-v1-${userId}` : 'streetsetu-public-api-v1',
      key: new Request(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } })
    };
  } catch { return null; }
}

async function cacheApiResponse(response) {
  const entry = offlineCacheEntry(response.config);
  if (!entry || typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(entry.cacheName);
    await cache.put(entry.key, new Response(JSON.stringify(response.data), {
      headers: { 'Content-Type': 'application/json', 'x-streetsetu-cached-at': String(Date.now()) }
    }));
  } catch { /* Offline support is best effort when storage is full or unavailable. */ }
}

async function readOfflineApiResponse(error) {
  const entry = offlineCacheEntry(error.config || {});
  if (!entry || typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(entry.cacheName);
    const cached = await cache.match(entry.key);
    if (!cached) return null;
    const cachedAt = Number(cached.headers.get('x-streetsetu-cached-at'));
    if (!cachedAt || Date.now() - cachedAt > 5 * 60 * 1000) {
      await cache.delete(entry.key);
      return null;
    }
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
    || /\/public\/(transparency|complaints)(?:\/|\?|$)/.test(url)
    || /\/complaints\/overdue(?:\?|$)/.test(url);
}

function storeAccessToken(token) {
  sessionExpirationDispatched = false;
  setAccessToken(token);
}

export async function ensureAccessToken() {
  const currentToken = getAccessToken();
  if (currentToken) return currentToken;

  try {
    refreshRequest ||= axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true, timeout: 30000 });
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
  const adapter = axios.getAdapter(config.adapter || api.defaults.adapter);
  config.adapter = (requestConfig) => deduplicatedGetAdapter(requestConfig, adapter);
  config._streetSetuRequestId = `${Date.now()}-${Math.random()}`;
  config._streetSetuSlowTimer = window.setTimeout(() => {
    slowRequestIds.add(config._streetSetuRequestId);
    window.dispatchEvent(new CustomEvent('streetsetu:request-slow', { detail: { count: slowRequestIds.size } }));
  }, 5000);
  return config;
});

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback;
}

api.interceptors.response.use(async (response) => {
  clearSlowRequest(response.config);
  if (response.statusText !== 'OK (offline cache)') await cacheApiResponse(response);
  return response;
}, async (error) => {
  clearSlowRequest(error.config);
  if (!error.response || [502, 503, 504].includes(error.response.status)) {
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
    refreshRequest ||= axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true, timeout: 30000 });
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
