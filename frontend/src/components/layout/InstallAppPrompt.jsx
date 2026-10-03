import { useEffect, useState } from 'react';

export default function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const installed = () => setIsInstalled(true);
    const beforeInstall = (event) => { event.preventDefault(); setInstallEvent(event); };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    setIsInstalled(media.matches || Boolean(window.navigator.standalone));
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  if (!installEvent || isInstalled) return null;
  return <button className="install-app-button" onClick={install} type="button" aria-label="Install StreetSetu app">Install App</button>;
}
