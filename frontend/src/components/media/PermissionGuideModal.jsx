import { useEffect, useRef, useState } from 'react';

function deviceType() {
  const userAgent = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iphone';
  if (/Android/i.test(userAgent)) return 'android';
  return 'laptop';
}

function browserName() {
  const userAgent = navigator.userAgent || '';
  if (/Edg\//i.test(userAgent)) return 'Edge';
  if (/Brave/i.test(userAgent) || navigator.brave) return 'Brave';
  if (/Chrome|CriOS/i.test(userAgent)) return 'Chrome';
  return 'Safari';
}

function settingsLink() {
  const browser = browserName();
  if (browser === 'Brave') return 'brave://settings/content/camera';
  if (browser === 'Edge') return 'edge://settings/content/camera';
  if (browser === 'Chrome') return 'chrome://settings/content/camera';
  return 'Settings → Safari → Camera and Location';
}

function permissionSteps(device) {
  if (device === 'android') {
    return [
      'Address bar ka lock/tune icon tap karo → Permissions → Camera aur Location ko Allow karo.',
      'Ya Browser Settings → Site settings mein Camera aur Location Allow karo.',
      'Phone Settings → Apps → apna browser → Permissions mein Camera aur Location Allow karo.',
      'Installed PWA mein bhi permissions browser settings se hi badalti hain.'
    ];
  }
  if (device === 'iphone') {
    return [
      'Settings → Safari → Camera aur Location mein permission Allow karo.',
      'Settings → Privacy & Security → Location Services → Safari Websites ko While Using the App Allow karo.',
      'StreetSetu ko dobara kholkar Retry dabao.'
    ];
  }
  return [
    'Address bar ke left side site icon par click karo.',
    'Site permissions mein Camera aur Location toggle ON karo.',
    'Page reload karo ya yahan Retry dabao.'
  ];
}

export default function PermissionGuideModal({
  cameraState,
  locationState,
  onAllow,
  onRetry,
  onClose
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [toast, setToast] = useState('');
  const device = deviceType();
  const needsCamera = cameraState !== 'granted';
  const needsLocation = locationState !== 'granted';
  const denied = cameraState === 'denied' || locationState === 'denied';

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  async function copySettingsLink() {
    try {
      await navigator.clipboard.writeText(settingsLink());
      setToast('Link copy ho gaya, naye tab ki address bar mein paste karo');
    } catch {
      setToast(`Copy nahi ho saka. Paste this in a new tab: ${settingsLink()}`);
    }
  }

  return <div className="permission-guide-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section
      ref={dialogRef}
      className="permission-guide-modal panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="permission-guide-title"
      aria-describedby="permission-guide-message"
    >
      <button ref={closeButtonRef} type="button" className="permission-guide-close outline-button" onClick={onClose} aria-label="Dismiss permissions guide">×</button>
      <p className="eyebrow">Camera and location access</p>
      <h2 id="permission-guide-title">Proof permissions</h2>
      {denied
        ? <p id="permission-guide-message">Permission is blocked. Browser ya device settings mein Camera aur Location allow karo, phir Retry dabao.</p>
        : <p id="permission-guide-message">Proof photo ke liye Camera aur Location ki permission chahiye</p>}
      <div className="permission-guide-states" aria-live="polite">
        {needsCamera && <span>Camera: {cameraState}</span>}
        {needsLocation && <span>Location: {locationState}</span>}
      </div>
      <ol className="permission-guide-steps">{permissionSteps(device).map((step) => <li key={step}>{step}</li>)}</ol>
      <div className="permission-guide-actions">
        {!denied && <button type="button" className="primary-button compact-button" onClick={onAllow}>Allow karo</button>}
        <button type="button" className="outline-button" onClick={onRetry}>Retry</button>
        <button type="button" className="outline-button" onClick={() => void copySettingsLink()}>Copy settings link</button>
        <button type="button" className="outline-button" onClick={onClose}>Dismiss</button>
      </div>
      {toast && <p className="permission-guide-toast" role="status">{toast}</p>}
    </section>
  </div>;
}
