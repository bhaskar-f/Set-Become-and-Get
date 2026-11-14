/*
 * Number Rush shell cache and offline fallback.
 *
 * Design rules:
 *  - The service worker never decides that the user is "offline". It only serves the cached
 *    fallback page when a navigation could not complete at the network level. The page then
 *    verifies reachability itself (see offline-connectivity.js).
 *  - HTTP error responses (4xx/5xx) are real answers from the server and are passed through.
 *  - /connectivity-check.txt is never intercepted or cached.
 *  - CACHE carries a content hash stamped by build.js, so any change to a cached asset ships a
 *    new worker, a fresh cache and removal of the old one.
 */
const CACHE = 'setbget-number-rush-__BUILD_ID__';
const ASSETS = ['/offline.html','/offline.css','/offline.js','/offline-connectivity.js','/logo.png','/number-rush/','/number-rush/index.html','/number-rush/game.css','/number-rush/game.js','/number-rush/questions.js','/number-rush/storage.js'];
const isGamePath = pathname => pathname === '/number-rush' || pathname.startsWith('/number-rush/');
const SCRIPT_TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache:'reload' bypasses the HTTP cache so a new worker never precaches stale files.
    await Promise.all(ASSETS.map(async asset => {
      const response = await fetch(new Request(asset, { cache: 'reload' }));
      if (!response.ok) throw new Error(`Precache failed for ${asset}: ${response.status}`);
      await cache.put(asset, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Only this app's own shell caches; never anything else (and localStorage is not touched).
    await Promise.all(keys.filter(key => key.startsWith('setbget-number-rush-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Reachability probe: leave it entirely to the network.
  if (url.pathname === '/connectivity-check.txt') return;

  if (request.mode === 'navigate') {
    event.respondWith(isGamePath(url.pathname) ? gameNavigation(event) : siteNavigation(request));
    return;
  }

  if (url.pathname === '/offline-connectivity.js') {
    event.respondWith(networkFirst(request, SCRIPT_TIMEOUT_MS));
    return;
  }

  if (isGamePath(url.pathname) || ['/offline.html', '/offline.css', '/offline.js', '/logo.png'].includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

// Normal pages: network only. A real HTTP response (even 5xx) is returned untouched; the fallback
// page is used only when the request failed at the network level.
async function siteNavigation(request) {
  try {
    return await fetch(request);
  } catch (_) {
    const cache = await caches.open(CACHE);
    return (await cache.match('/offline.html')) || Response.error();
  }
}

async function gameNavigation(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match('/number-rush/index.html');
  const update = fetch(event.request).then(response => {
    if (response.ok) cache.put('/number-rush/index.html', response.clone());
    return response;
  });
  if (cached) { event.waitUntil(update.catch(() => {})); return cached; }
  try { return await update; } catch (_) { return (await cache.match('/offline.html')) || Response.error(); }
}

async function networkFirst(request, timeoutMs) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([
      fetch(request, { cache: 'no-store' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    if (response.ok) { await cache.put(request, response.clone()); return response; }
    return (await cache.match(request)) || response;
  } catch (_) {
    return (await cache.match(request)) || Response.error();
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request);
  const update = fetch(event.request).then(response => {
    if (response.ok) cache.put(event.request, response.clone());
    return response;
  });
  if (cached) { event.waitUntil(update.catch(() => {})); return cached; }
  return update;
}
