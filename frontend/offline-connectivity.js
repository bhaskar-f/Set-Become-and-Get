(function () {
  'use strict';
  const KEY = 'setbget:offline:return-url';
  const GAME_PATH = '/number-rush';
  const isGamePath = pathname => pathname === GAME_PATH || pathname.startsWith(`${GAME_PATH}/`);
  const isGame = () => isGamePath(location.pathname);
  const safeStore = {
    get() { try { return sessionStorage.getItem(KEY); } catch (_) { return null; } },
    set(value) { try { sessionStorage.setItem(KEY, value); return true; } catch (_) { return false; } },
    clear() { try { sessionStorage.removeItem(KEY); } catch (_) {} },
  };
  function checkedReturnUrl(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
      const url = new URL(value, location.origin);
      if (url.origin !== location.origin || url.username || url.password || isGamePath(url.pathname)) return null;
      return url;
    } catch (_) { return null; }
  }

  let registrationReady = Promise.resolve(false);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    registrationReady = navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        if (navigator.serviceWorker.controller) return true;
        return new Promise(resolve => {
          let settled = false;
          const finish = value => { if (settled) return; settled = true; clearTimeout(timeout); navigator.serviceWorker.removeEventListener('controllerchange', changed); resolve(value); };
          const changed = () => finish(Boolean(navigator.serviceWorker.controller));
          const timeout = setTimeout(() => finish(Boolean(navigator.serviceWorker.controller)), 5000);
          navigator.serviceWorker.addEventListener('controllerchange', changed);
          if (navigator.serviceWorker.controller) finish(true);
        });
      }).catch(() => false);
  }

  let redirectingOffline = false;
  window.addEventListener('offline', async () => {
    if (isGame() || redirectingOffline) return;
    const existing = checkedReturnUrl(safeStore.get());
    if (!existing) safeStore.set(new URL(location.href).href);
    redirectingOffline = true;
    await registrationReady;
    if (!isGame()) location.replace(`${GAME_PATH}/`);
  });

  let restoring = false;
  async function restoreWhenReachable() {
    if (restoring || !isGame()) return;
    const target = checkedReturnUrl(safeStore.get());
    if (!target) { if (safeStore.get()) safeStore.clear(); return; }
    restoring = true;
    const delays = [0, 700, 1400, 2800, 5000, 5000, 5000, 5000];
    try {
      for (const delay of delays) {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        if (!navigator.onLine) return;
        try {
          const probe = new URL('/offline.html', location.origin);
          probe.searchParams.set('reachability', String(Date.now()));
          const response = await fetch(probe.href, { method: 'GET', cache: 'no-store', credentials: 'omit' });
          if (!response.ok) continue;
          if (!navigator.onLine) return;
          location.replace(target.href);
          return;
        } catch (_) { /* Retry when the browser is online but the site is not reachable yet. */ }
      }
    } finally { restoring = false; }
  }
  window.addEventListener('online', restoreWhenReachable);
  if (isGame() && navigator.onLine) restoreWhenReachable();

  const savedOnThisPage = checkedReturnUrl(safeStore.get());
  if (!isGame() && savedOnThisPage && savedOnThisPage.href === new URL(location.href).href && navigator.onLine)
    safeStore.clear();
})();
