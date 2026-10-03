const STATIC_CACHE = 'streetsetu-static-v1';
const PRIVATE_CACHE_PREFIX = 'streetsetu-private-v1-';
const APP_SHELL = ['/', '/index.html', '/offline.html', '/manifest.json', '/icons/streetsetu-192.svg', '/icons/streetsetu-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('streetsetu-') && key !== STATIC_CACHE && !key.startsWith(PRIVATE_CACHE_PREFIX)).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

function authenticatedUserId(request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).sub || null;
  } catch { return null; }
}

function privateCacheRequest(request, userId) {
  const keyUrl = new URL(request.url);
  keyUrl.searchParams.set('__streetsetu_user', userId);
  return new Request(keyUrl.toString(), { method: 'GET', headers: { Accept: request.headers.get('Accept') || 'application/json' } });
}

function isOfflineCacheApi(url) {
  return url.pathname === '/api/v1/dashboard/summary'
    || url.pathname === '/api/v1/complaints'
    || url.pathname === '/api/v1/notifications';
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_PRIVATE_CACHE') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(PRIVATE_CACHE_PREFIX)).map((key) => caches.delete(key)))));
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/v1/') && isOfflineCacheApi(url)) {
    const userId = authenticatedUserId(request);
    if (!userId) return;
    event.respondWith((async () => {
      const cache = await caches.open(`${PRIVATE_CACHE_PREFIX}${userId}`);
      const cacheKey = privateCacheRequest(request, userId);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(cacheKey, response.clone());
        return response;
      } catch {
        return (await cache.match(cacheKey)) || Response.json({ success: false, error: { code: 'OFFLINE', message: 'You are offline and this data has not been cached yet.' } }, { status: 503 });
      }
    })());
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/index.html')) || caches.match('/offline.html')));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
