const STATIC_CACHE = 'streetsetu-static-v2';
const IMAGE_CACHE = 'streetsetu-images-v1';
const PRIVATE_CACHE_PREFIX = 'streetsetu-private-v1-';
const APP_SHELL = ['/', '/index.html', '/offline.html', '/manifest.json', '/icons/streetsetu-192.svg', '/icons/streetsetu-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(APP_SHELL);
    const shell = await cache.match('/index.html');
    if (shell) {
      const html = await shell.text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+\/assets\/[^"]+)"/g)].map((match) => match[1]);
      if (assets.length) await cache.addAll(assets);
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('streetsetu-') && ![STATIC_CACHE, IMAGE_CACHE].includes(key) && !key.startsWith(PRIVATE_CACHE_PREFIX)).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

function authenticatedUserId(request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).sub || null;
  } catch { return null; }
}

async function privateCacheRequest(request, userId) {
  const keyUrl = new URL(request.url);
  const token = request.headers.get('Authorization') || '';
  const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const sessionKey = [...new Uint8Array(tokenHash)].map((value) => value.toString(16).padStart(2, '0')).join('');
  keyUrl.searchParams.set('__streetsetu_user', userId);
  keyUrl.searchParams.set('__streetsetu_session', sessionKey);
  return new Request(keyUrl.toString(), { method: 'GET', headers: { Accept: request.headers.get('Accept') || 'application/json' } });
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_PRIVATE_CACHE') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(PRIVATE_CACHE_PREFIX)).map((key) => caches.delete(key)))));
  }
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/v1/') && url.origin === self.location.origin) {
    const userId = authenticatedUserId(request);
    const isPublicApi = url.pathname.startsWith('/api/v1/public/');
    if (!userId && !isPublicApi) return;
    event.respondWith((async () => {
      const cacheName = userId ? `${PRIVATE_CACHE_PREFIX}${userId}` : 'streetsetu-public-api-v1';
      const cache = await caches.open(cacheName);
      const cacheKey = userId ? await privateCacheRequest(request, userId) : request;
      try {
        const response = await fetch(request);
        if (response.ok) {
          const headers = new Headers(response.headers);
          headers.set('x-streetsetu-cached-at', String(Date.now()));
          await cache.put(cacheKey, new Response(response.clone().body, { status: response.status, statusText: response.statusText, headers }));
        }
        return response;
      } catch {
        const cached = await cache.match(cacheKey);
        const cachedAt = Number(cached?.headers.get('x-streetsetu-cached-at'));
        if (cached && Date.now() - cachedAt <= 5 * 60 * 1000) return cached;
        if (cached) await cache.delete(cacheKey);
        return Response.json({ success: false, error: { code: 'OFFLINE', message: 'You are offline and this data has not been cached yet.' } }, { status: 503 });
      }
    })());
    return;
  }

  if (request.destination === 'image') {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE);
      const requestBase = new URL(request.url);
      const cachedRequests = await cache.keys();
      for (const cachedRequest of cachedRequests) {
        const cachedUrl = new URL(cachedRequest.url);
        const cachedAt = Number(cachedUrl.searchParams.get('__streetsetu_cached_at'));
        cachedUrl.searchParams.delete('__streetsetu_cached_at');
        if (cachedUrl.href !== requestBase.href) continue;
        if (Date.now() - cachedAt <= 7 * 24 * 60 * 60 * 1000) return cache.match(cachedRequest);
        await cache.delete(cachedRequest);
      }
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') {
        requestBase.searchParams.set('__streetsetu_cached_at', String(Date.now()));
        await cache.put(new Request(requestBase.href), response.clone());
      }
      return response;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

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
