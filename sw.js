const CACHE = 'creator-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // External libs to cache for offline 3D
  'https://unpkg.com/three@0.160.0/build/three.min.js',
  'https://unpkg.com/three@0.160.0/examples/js/controls/OrbitControls.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(cache => {
          // Only cache GET and same-origin or whitelisted CDN
          if (request.method === 'GET' &&
              (request.url.startsWith(self.location.origin) ||
               request.url.startsWith('https://unpkg.com/'))) {
            cache.put(request, copy);
          }
        });
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});