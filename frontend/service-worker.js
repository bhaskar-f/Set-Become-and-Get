/* Number Rush shell cache. Keep the cache list limited to public static game assets. */
const CACHE = 'setbget-number-rush-v1';
const ASSETS = ['/offline.html','/offline.css','/offline.js','/number-rush/','/number-rush/index.html','/number-rush/game.css','/number-rush/game.js','/number-rush/questions.js','/number-rush/storage.js'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('setbget-number-rush-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      if (/^\/number-rush(?:\/|$)/.test(url.pathname)) return (await cache.match('/number-rush/index.html')) || cache.match('/offline.html');
      return (await cache.match('/offline.html')) || Response.error();
    })); return;
  }
  if (/^\/number-rush(?:\/|$)/.test(url.pathname) || /^\/offline\.(?:html|css|js)$/.test(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
