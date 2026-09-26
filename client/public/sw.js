// Itenary service worker — offline & low-bandwidth resilience.
// • App shell and hashed assets: cache-first
// • GET /api/* (itineraries, trips, zine, bookings): network-first with cached fallback
// • Map tiles & photos: stale-while-revalidate (so maps and the zine work offline)
const SHELL = 'tc-shell-v1';
const DATA = 'tc-data-v1';
const MEDIA = 'tc-media-v1';
const API_ORIGIN = (() => {
  try {
    const api = new URL(self.location.href).searchParams.get('api');
    return api ? new URL(api).origin : '';
  } catch {
    return '';
  }
})();

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/icon.svg', '/manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, DATA, MEDIA].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    return new Response(JSON.stringify({ error: 'You are offline. Showing saved data when available.', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fetching = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fetching;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/admin')) return;
    if (url.pathname.startsWith('/api/')) return event.respondWith(networkFirst(request, DATA));
    if (url.pathname.startsWith('/uploads/')) return event.respondWith(staleWhileRevalidate(request, MEDIA));
    if (url.pathname.startsWith('/assets/')) {
      return event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => caches.open(SHELL).then((c) => (c.put(request, res.clone()), res)))));
    }
    if (request.mode === 'navigate') {
      return event.respondWith(fetch(request).then((res) => {
        caches.open(SHELL).then((c) => c.put('/', res.clone()));
        return res;
      }).catch(() => caches.match('/')));
    }
    return;
  }

  // API hosted on another origin (e.g. web app on Vercel, API on Render)
  if (API_ORIGIN && url.origin === API_ORIGIN) {
    if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/admin') || url.pathname.startsWith('/socket.io')) return;
    if (url.pathname.startsWith('/api/')) return event.respondWith(networkFirst(request, DATA));
    if (url.pathname.startsWith('/uploads/')) return event.respondWith(staleWhileRevalidate(request, MEDIA));
    return;
  }

  // Cross-origin: OSM map tiles and seeded photos
  if (/tile\.openstreetmap\.org|picsum\.photos/.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, MEDIA));
  }
});
