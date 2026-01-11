const CACHE = 'creator-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './storage.js',
  './manifest.webmanifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null))))
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