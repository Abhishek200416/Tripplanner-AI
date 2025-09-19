// public/sw.js
const CACHE = 'trip-planner-v1';
const CORE = [
  '/', '/index.html',
  '/icon-192.png', '/icon-512.png',
  // Keep this list minimal; avoid caching dev bundles.
];

self.addEventListener('install', (evt) => {
  evt.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
    } catch (e) {
      // Don’t fail install on cache errors
      console.warn('[SW] install cache error', e);
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(names.map(n => (n === CACHE ? null : caches.delete(n))));
    } finally {
      await self.clients.claim();
    }
  })());
});

// Never intercept dev/HMR or module URLs.
// Only handle same-origin GET navigation/doc/script/style requests.
// Always return a valid Response (or let the network do it).
self.addEventListener('fetch', (evt) => {
  const req = evt.request;

  // Only same-origin GET
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const url = new URL(req.url);

  // Skip Vite/HMR & source files paths in prod too; we cache core shell only.
  const skipPrefixes = [
    '/@vite', '/@react-refresh', '/@fs', '/node_modules/',
    '/src/', '/__vite_ping', '/vite.svg',
  ];
  if (skipPrefixes.some(p => url.pathname.startsWith(p))) return;

  evt.respondWith((async () => {
    try {
      // Network first, fallback cache, then a friendly offline page
      const net = await fetch(req);
      // Optionally cache static assets
      if (net.ok && ['document','script','style'].includes(req.destination)) {
        const cache = await caches.open(CACHE);
        cache.put(req, net.clone());
      }
      return net;
    } catch {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;

      // Final fallback: tiny offline response (always a real Response)
      return new Response('You are offline. Please reconnect.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  })());
});
