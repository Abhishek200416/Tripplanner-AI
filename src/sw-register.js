// src/sw-register.js
export function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  if (!import.meta.env.PROD) {
    // Kill any old SW so dev requests don’t get intercepted
    navigator.serviceWorker.getRegistrations?.().then(rs => rs.forEach(r => r.unregister()));
    return;
  }

  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
  if (!isSecure) return;

  navigator.serviceWorker.register('/sw.js').catch(e => console.warn('[SW] register failed', e));
}
