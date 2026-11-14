const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'offline-connectivity.js'), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, ms = 1500) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (predicate()) return true; await sleep(5); }
  return predicate();
}
const ok = { ok: true, status: 200, text: async () => 'ok\n' };
const status = code => ({ ok: false, status: code, text: async () => 'error' });
const fail = async () => { throw new TypeError('Failed to fetch'); };
const KEY = 'setbget:offline:session';
const CONFIG = { confirmDelayMs: 25, retryBaseMs: 30, retryMaxMs: 60, probeTimeoutMs: 300, resumeCheckAfterMs: 50 };

/**
 * Runs offline-connectivity.js in a fake browser.
 * options.origin / options.internet are mutable handlers so a test can "restore the network".
 */
const pages = [];
test.afterEach(() => { pages.splice(0).forEach(page => (page.win.listeners.pagehide || []).forEach(fn => fn())); });
function run(url, options = {}) {
  const parsed = new URL(url);
  const values = options.values || new Map();
  const win = { listeners: {}, SETBGET_CONNECTIVITY_CONFIG: { ...CONFIG, ...(options.config || {}) } };
  win.addEventListener = (name, fn) => { (win.listeners[name] ||= []).push(fn); };
  const doc = { listeners: {}, visibilityState: 'visible' };
  doc.addEventListener = (name, fn) => { (doc.listeners[name] ||= []).push(fn); };
  doc.documentElement = { getAttribute: name => (options.fallback && name === 'data-sbg-fallback' ? '1' : null) };
  const env = {
    origin: options.origin || (async () => ok),
    internet: options.internet || (async () => ({ ok: true, status: 0, type: 'opaque' })),
    online: options.online ?? true,
    requests: [], replaced: [], reloads: 0,
  };
  const location = {
    href: parsed.href, origin: parsed.origin, pathname: parsed.pathname, protocol: parsed.protocol,
    replace(value) { env.replaced.push(value); }, reload() { env.reloads++; },
  };
  const context = {
    URL, Date, AbortController, setTimeout, clearTimeout, window: win, document: doc, location,
    sessionStorage: {
      getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
    },
    navigator: {
      get onLine() { return env.online; },
      serviceWorker: { register: async () => ({}), ready: Promise.resolve({}) },
    },
    caches: { match: async () => (options.gameCached === false ? undefined : {}) },
    setInterval() { throw new Error('Periodic polling must not be installed'); },
    clearInterval() {},
    fetch(requestUrl, init = {}) {
      env.requests.push({ url: String(requestUrl), init });
      const handler = String(requestUrl).includes('/connectivity-check.txt') ? env.origin : env.internet;
      return new Promise((resolve, reject) => {
        if (init.signal) init.signal.addEventListener('abort', () => reject(new Error('aborted')));
        Promise.resolve().then(() => handler(requestUrl, init)).then(resolve, reject);
      });
    },
  };
  vm.runInNewContext(source, context);
  const page = { env, values, win, doc, conn: win.SetBGetConnectivity, hits: () => env.requests.filter(r => r.url.includes('/connectivity-check.txt')).length };
  pages.push(page);
  return page;
}
const fire = (page, name, event = {}) => (page.win.listeners[name] || []).forEach(fn => fn(event));
const seed = (url, at = Date.now()) => new Map([[KEY, JSON.stringify({ returnUrl: url, at })]]);

test('1. online initial load: no probe, no redirect, no timers, stale session cleared', async () => {
  const page = run('https://setbget.test/jobs', { values: seed('https://setbget.test/old') });
  await sleep(80);
  assert.equal(page.env.requests.length, 0);
  assert.deepEqual(page.env.replaced, []);
  assert.equal(page.conn.state, 'ONLINE');
  assert.equal(page.values.has(KEY), false);
});

test('2. manual Number Rush access while online is plain ONLINE with no probe', async () => {
  const page = run('https://setbget.test/number-rush/');
  await sleep(80);
  assert.equal(page.conn.state, 'ONLINE');
  assert.equal(page.env.requests.length, 0);
  assert.equal(page.conn.hasSession(), false);
});

test('3. Wi-Fi/Ethernet loss: offline event, origin and internet unreachable -> OFFLINE, URL saved, redirect', async () => {
  const page = run('https://setbget.test/jobs?q=teacher&page=2#latest', { online: false, origin: fail, internet: fail });
  fire(page, 'offline');
  assert.ok(await waitFor(() => page.env.replaced.length === 1));
  assert.equal(page.env.replaced[0], '/number-rush/');
  assert.equal(JSON.parse(page.values.get(KEY)).returnUrl, 'https://setbget.test/jobs?q=teacher&page=2#latest');
  assert.equal(page.conn.state, 'OFFLINE');
});

test('4. spurious offline event while SetBGet is reachable never redirects', async () => {
  const page = run('https://setbget.test/jobs');
  fire(page, 'offline');
  assert.ok(await waitFor(() => page.conn.state === 'ONLINE' && page.hits() >= 1));
  await sleep(120);
  assert.deepEqual(page.env.replaced, []);
  assert.equal(page.values.has(KEY), false);
  assert.equal(page.conn.state, 'ONLINE');
});

test('5. navigator.onLine true but no internet at all (no events needed to be wrong): offline is detected via probe', async () => {
  const page = run('https://setbget.test/jobs', { online: true, origin: fail, internet: fail });
  fire(page, 'offline'); // e.g. fired by the OS for a different adapter while onLine stays true
  assert.ok(await waitFor(() => page.env.replaced.length === 1));
  assert.equal(page.conn.state, 'OFFLINE');
});

test('6. internet works but SetBGet unreachable -> WEBSITE_UNAVAILABLE, no Number Rush redirect', async () => {
  const page = run('https://setbget.test/jobs', { origin: fail, internet: async () => ({ type: 'opaque' }) });
  fire(page, 'offline');
  assert.ok(await waitFor(() => page.conn.state === 'WEBSITE_UNAVAILABLE'));
  await sleep(100);
  assert.deepEqual(page.env.replaced, []);
  assert.equal(page.conn.hasSession(), false);
});

test('7. temporary server failure (HTTP 503) is WEBSITE_UNAVAILABLE and never skips the internet check logic', async () => {
  const page = run('https://setbget.test/jobs', { origin: async () => status(503), internet: fail });
  fire(page, 'online');
  assert.ok(await waitFor(() => page.conn.state === 'WEBSITE_UNAVAILABLE'));
  assert.deepEqual(page.env.replaced, []);
});

test('8. a 200 response with the wrong body (captive portal) is not treated as reachable', async () => {
  const page = run('https://setbget.test/jobs', { origin: async () => ({ ok: true, status: 200, text: async () => '<html>login</html>' }), internet: fail });
  fire(page, 'offline');
  assert.ok(await waitFor(() => page.conn.state === 'OFFLINE'));
});

test('9. network switch (offline then online within the confirmation window) does not launch the game', async () => {
  let up = false;
  const page = run('https://setbget.test/jobs', { config: { confirmDelayMs: 80 }, origin: async () => { if (!up) throw new TypeError('x'); return ok; }, internet: fail });
  fire(page, 'offline');
  await sleep(20);
  up = true;
  fire(page, 'online');
  await sleep(250);
  assert.deepEqual(page.env.replaced, []);
  assert.equal(page.conn.state, 'ONLINE');
});

test('10. does not redirect when the game is not cached for offline use', async () => {
  const page = run('https://setbget.test/jobs', { gameCached: false, origin: fail, internet: fail });
  fire(page, 'offline');
  assert.ok(await waitFor(() => page.conn.state === 'OFFLINE'));
  await sleep(100);
  assert.deepEqual(page.env.replaced, []);
});

test('11. saved return URL alone never makes the game offline: legacy keys are ignored and removed', async () => {
  const values = new Map([['setbget:offline:return-url', 'https://setbget.test/jobs'], ['setbget:number-rush:offline-entry', '1']]);
  const game = run('https://setbget.test/number-rush/', { values });
  await sleep(80);
  assert.equal(game.conn.state, 'ONLINE');
  assert.equal(game.env.requests.length, 0);
  assert.equal(values.size, 0);
});

test('12. online event fired before the game loaded: the game verifies on load and can restore the page', async () => {
  const game = run('https://setbget.test/number-rush/', { values: seed('https://setbget.test/jobs?q=1#x') });
  assert.equal(game.conn.state, 'VERIFYING');
  assert.ok(await waitFor(() => game.conn.state === 'ONLINE'));
  assert.equal(game.conn.hasSession(), true);
  assert.equal(game.conn.restoreOriginalPage(), true);
  assert.deepEqual(game.env.replaced, ['https://setbget.test/jobs?q=1#x']);
  assert.equal(game.conn.hasSession(), false);
  assert.equal(game.conn.restoreOriginalPage(), false); // no redirect loop
});

test('13. recovery without any online event: backoff retries find the site again, then stop', async () => {
  let up = false;
  const game = run('https://setbget.test/number-rush/', { values: seed('https://setbget.test/jobs'), online: false, origin: async () => { if (!up) throw new TypeError('x'); return ok; }, internet: fail });
  assert.ok(await waitFor(() => game.conn.state === 'OFFLINE'));
  up = true; game.env.online = true; // network returns; no event is dispatched
  assert.ok(await waitFor(() => game.conn.state === 'ONLINE', 800));
  const hits = game.hits();
  await sleep(200);
  assert.equal(game.hits(), hits, 'no further probes once reachable');
});

test('14. probe is same-origin, uncached, credential-less and does not follow redirects', async () => {
  const page = run('https://setbget.test/jobs');
  fire(page, 'online');
  await waitFor(() => page.hits() >= 1);
  const { url, init } = page.env.requests[0];
  assert.match(url, /^https:\/\/setbget\.test\/connectivity-check\.txt\?_=\d+$/);
  assert.equal(init.mode, 'same-origin');
  assert.equal(init.cache, 'no-store');
  assert.equal(init.redirect, 'error');
  assert.equal(init.credentials, 'omit');
});

test('15. old and unsafe sessions are ignored', async () => {
  const old = run('https://setbget.test/number-rush/', { values: seed('https://setbget.test/jobs', Date.now() - 7 * 3600 * 1000) });
  assert.equal(old.conn.hasSession(), false);
  const external = run('https://setbget.test/number-rush/', { values: seed('https://evil.test/phish') });
  await waitFor(() => external.conn.state === 'ONLINE');
  assert.equal(external.conn.restoreOriginalPage(), false);
  assert.deepEqual(external.env.replaced, []);
});

test('16. resuming a tab: only a long absence (or a non-ONLINE state) triggers one check', async () => {
  const page = run('https://setbget.test/jobs');
  page.doc.visibilityState = 'hidden'; (page.doc.listeners.visibilitychange || []).forEach(fn => fn());
  page.doc.visibilityState = 'visible'; (page.doc.listeners.visibilitychange || []).forEach(fn => fn());
  await sleep(30);
  assert.equal(page.hits(), 0, 'short absence: no probe');
  page.doc.visibilityState = 'hidden'; (page.doc.listeners.visibilitychange || []).forEach(fn => fn());
  await sleep(70);
  page.doc.visibilityState = 'visible'; (page.doc.listeners.visibilitychange || []).forEach(fn => fn());
  assert.ok(await waitFor(() => page.hits() === 1));
});

test('17. fallback page: reachable -> reload once (guarded against loops); OFFLINE -> redirect with original URL', async () => {
  const recovered = run('https://setbget.test/jobs/chemist', { fallback: true });
  assert.ok(await waitFor(() => recovered.env.reloads === 1));
  fire(recovered, 'online');
  await sleep(80);
  assert.equal(recovered.env.reloads, 1, 'second reload within the guard window is suppressed');

  const offline = run('https://setbget.test/jobs/chemist', { fallback: true, online: false, origin: fail, internet: fail });
  assert.ok(await waitFor(() => offline.env.replaced.length === 1));
  assert.equal(JSON.parse(offline.values.get(KEY)).returnUrl, 'https://setbget.test/jobs/chemist');

  const down = run('https://setbget.test/jobs/chemist', { fallback: true, origin: fail });
  assert.ok(await waitFor(() => down.conn.state === 'WEBSITE_UNAVAILABLE'));
  assert.deepEqual(down.env.replaced, []);
});
