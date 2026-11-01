/* Number Rush shell cache. Keep the cache list limited to public static game assets. */
const CACHE = 'setbget-number-rush-v2';
const ASSETS = ['/offline.html','/offline.css','/offline.js','/offline-connectivity.js','/number-rush/','/number-rush/index.html','/number-rush/game.css','/number-rush/game.js','/number-rush/questions.js','/number-rush/storage.js'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('setbget-number-rush-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async response => {
      if (response.status < 500) return response;
      return await fallbackNavigation(url.pathname) || response;
    }).catch(async () => await fallbackNavigation(url.pathname) || Response.error())); return;
  }
  if (/^\/number-rush(?:\/|$)/.test(url.pathname) || /^\/offline\.(?:html|css|js)$/.test(url.pathname) || url.pathname === '/offline-connectivity.js') {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});

async function fallbackNavigation(pathname) {
  const cache = await caches.open(CACHE);
  if (/^\/number-rush(?:\/|$)/.test(pathname))
    return (await cache.match('/number-rush/index.html')) || cache.match('/offline.html');
  return cache.match('/offline.html');
}
