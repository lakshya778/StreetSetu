let accessToken = null;
let currentUserId = null;

if (typeof localStorage !== 'undefined') {
  localStorage.removeItem('streetsetu_token');
  try { currentUserId = JSON.parse(localStorage.getItem('streetsetu_session') || 'null')?._id || null; } catch { currentUserId = null; }
}

export function setAccessToken(token) { accessToken = token || null; }
export function getAccessToken() { return accessToken; }
export function setCurrentUserId(userId) { currentUserId = userId || null; }
export function getCurrentUserId() { return currentUserId; }
export function clearAccessToken() { accessToken = null; }
export function clearPrivateOfflineCache() {
  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PRIVATE_CACHE' });
  if (typeof caches !== 'undefined') {
    void caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('streetsetu-private-v1-')).map((key) => caches.delete(key))));
  }
}
