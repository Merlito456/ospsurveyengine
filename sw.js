
const CACHE_NAME = 'osp-survey-pro-v5-cache';
const MAP_CACHE = 'osp-map-tiles';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './metadata.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@100..800&display=swap'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME && name !== MAP_CACHE).map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Strategy for core app assets: CACHE FIRST
  // This ensures the app is "immortal" even when signal is lost completely.
  const isCoreAsset = PRECACHE_ASSETS.some(asset => event.request.url.includes(asset.replace('./', ''))) || 
                     url.pathname.endsWith('.js') || 
                     url.pathname.endsWith('.css');

  if (isCoreAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Strategy for Map Tiles: Stale-While-Revalidate
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(MAP_CACHE).then((cache) => {
        return cache.match(event.request).then((response) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => response);
          return response || fetchPromise;
        });
      })
    );
    return;
  }

  // Fallback: Cache-First for everything else to maximize offline resilience
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    }).catch(() => caches.match('./index.html')) // Critical: Fallback to home if totally offline and link is dead
  );
});
