import { useEffect, useRef, useState } from 'react';

export default function GlobalStatusBanners() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [slowRequests, setSlowRequests] = useState(0);
  const [waitingWorker, setWaitingWorker] = useState(null);
  const reloadOnControllerChange = useRef(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleSlowRequest = (event) => setSlowRequests(event.detail?.count || 1);
    const handleRequestSettled = (event) => setSlowRequests(event.detail?.count || 0);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('streetsetu:request-slow', handleSlowRequest);
    window.addEventListener('streetsetu:request-settled', handleRequestSettled);

    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      let registration;
      let installingWorker;
      let checkForUpdate;
      const handleControllerChange = () => {
        if (reloadOnControllerChange.current) window.location.reload();
      };
      const handleUpdateFound = () => {
        installingWorker = registration?.installing;
        installingWorker?.addEventListener('statechange', () => {
          if (installingWorker?.state === 'installed' && navigator.serviceWorker.controller && registration?.waiting) {
            setWaitingWorker(registration.waiting);
          }
        });
      };

      navigator.serviceWorker.register('/service-worker.js').then((result) => {
        registration = result;
        if (registration.waiting && navigator.serviceWorker.controller) setWaitingWorker(registration.waiting);
        registration.addEventListener('updatefound', handleUpdateFound);
        checkForUpdate = () => { void registration.update().catch((error) => console.error('StreetSetu app update check failed:', error)); };
        window.addEventListener('focus', checkForUpdate);
      }).catch((error) => console.error('StreetSetu offline support could not start:', error));
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('streetsetu:request-slow', handleSlowRequest);
        window.removeEventListener('streetsetu:request-settled', handleRequestSettled);
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        registration?.removeEventListener('updatefound', handleUpdateFound);
        if (checkForUpdate) window.removeEventListener('focus', checkForUpdate);
        reloadOnControllerChange.current = false;
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('streetsetu:request-slow', handleSlowRequest);
      window.removeEventListener('streetsetu:request-settled', handleRequestSettled);
    };
  }, []);

  function applyUpdate() {
    if (!waitingWorker) return;
    reloadOnControllerChange.current = true;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  return <>
    {!isOnline && <div className="global-status-banner" role="status"><strong>You're offline.</strong><span>Some information may be unavailable.</span><button type="button" onClick={() => window.location.reload()}>Retry</button></div>}
    {isOnline && slowRequests > 0 && <div className="global-status-banner" role="status">Server jaag raha hai, 30-50 sec lag sakte hain...</div>}
    {waitingWorker && <div className="global-status-banner update-banner" role="status"><span>New version available</span><button type="button" onClick={applyUpdate}>Refresh</button></div>}
  </>;
}
