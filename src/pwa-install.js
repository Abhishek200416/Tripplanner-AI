let deferredPrompt = null;
let subscribers = new Set();

export function initPWAInstallListener() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();           // prevent mini-infobar
    deferredPrompt = e;           // stash event
    subscribers.forEach((fn) => fn(true)); // notify buttons to show
  });

  // Optional: know when installed
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    subscribers.forEach((fn) => fn(false));
  });
}

export function onInstallAvailabilityChange(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export async function triggerInstall() {
  if (!deferredPrompt) return { outcome: 'unavailable' };
  const e = deferredPrompt;
  deferredPrompt = null; // can only be used once
  const { outcome } = await e.prompt(); // show the browser install UI
  return { outcome }; // 'accepted' | 'dismissed'
}
