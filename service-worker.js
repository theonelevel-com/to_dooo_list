const CACHE_NAME = 'to-dooo-app-202607141057';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './sync-bridge.js',
  './vendor/dooo-core/index.js',
  './vendor/dooo-core/sync-engine.js',
  './vendor/dooo-core/idb.js',
  './vendor/dooo-core/queue.js',
  './vendor/dooo-core/dedup.js',
  './vendor/dooo-core/transports.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Background Sync: when connectivity returns after an offline edit, the browser
// fires this even if the app was closed. We wake any open client to drain the
// outbox (sync-bridge.js listens for this message); if none is open, the queued
// mutations replay next time the app opens. Tag matches SyncEngine's default.
self.addEventListener('sync', event => {
  if (event.tag === 'dooo-sync') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'dooo-sync' }));
      })
    );
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return; // writes go straight to the network
  const url = event.request.url;
  // Never intercept the sync backend (dooo-api Worker) or LLM APIs — always live.
  if (url.includes('workers.dev') || url.includes('dooo-api') ||
      url.includes('script.google.com') || url.includes('api.anthropic.com')) {
    return; // default network handling
  }
  // Same-origin shell / JS / assets: NETWORK-FIRST, so a deployed fix is never
  // masked by a cached copy. (This SW previously served these cache-first, which
  // in a path-caching proxy environment could pin stale JS.) Fall back to the
  // cache when offline; navigations fall back to the cached shell.
  event.respondWith(
    fetch(event.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
      return resp;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      throw new Error('offline and not cached');
    })
  );
});
