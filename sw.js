/* Series of Tubes service worker: makes the game installable and playable offline.
   The page always comes from the network when there is one, so a new release shows up on the
   next visit; everything else is served from the cache and refreshed in the background. */
const CACHE = 'sot-seriesoftubes-preview-1.28.0-perf.c0e7608';
const CORE = ['/seriesoftubes/', '/seriesoftubes/index.html', '/seriesoftubes/site.webmanifest', '/seriesoftubes/favicon.svg', '/seriesoftubes/icon-192.png', '/seriesoftubes/icon-512.png', '/seriesoftubes/apple-touch-icon.png', '/seriesoftubes/i18n/it.js?v=1.28.0-perf.c0e7608'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('sot-seriesoftubes-preview-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // The update check must always ask the network.
  if (url.origin === location.origin && url.pathname === '/seriesoftubes/version.json') return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/seriesoftubes/', copy)); return r; })
      .catch(() => caches.match('/seriesoftubes/').then((r) => r || caches.match('/seriesoftubes/index.html'))));
    return;
  }
  const local = url.origin === location.origin, fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!local && !fonts) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => {
    const net = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })));
});
