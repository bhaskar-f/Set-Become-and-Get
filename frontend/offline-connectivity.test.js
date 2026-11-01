const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'offline-connectivity.js'), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const response = (status = 200, body = 'ok\n') => ({ ok: status >= 200 && status < 300, status, text: async () => body });

function run(url, options = {}) {
  const listeners = {};
  const intervals = [];
  const values = options.values || new Map();
  const parsed = new URL(url);
  const location = {
    href: parsed.href, origin: parsed.origin, pathname: parsed.pathname,
    replace(value) { this.replaced = value; },
  };
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  const window = {
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
    NumberRushHandleConnectionRestored: options.connectionHandler,
    NumberRushHandleConnectivityLost: options.connectionLost,
  };
  const document = {
    visibilityState: options.visibility || 'visible',
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
  };
  const context = {
    URL, Date, Promise, AbortController, console,
    location,
    sessionStorage: options.storageThrows ? { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } } : storage,
    navigator: { onLine: options.online ?? true },
    document,
    window,
    fetch: options.fetch || (async () => response()),
    setTimeout, clearTimeout,
    setInterval(callback, delay) { intervals.push({ callback, delay }); return intervals.length; },
    clearInterval(id) { intervals[id - 1] && (intervals[id - 1].cleared = true); },
  };
  vm.runInNewContext(source, context);
  return { context, listeners, values, intervals };
}

const KEY = 'setbget:offline:return-url';

test('consecutive failed probes save and redirect the exact original path, query and hash', async () => {
  const page = run('https://setbget.test/jobs/chemist?state=WB&page=2#eligibility', {
    online: true,
    fetch: async () => { throw Error('network unreachable'); },
  });
  await sleep(5); // initial live check is failure one
  await page.listeners.offline[0]();
  assert.equal(page.values.get(KEY), 'https://setbget.test/jobs/chemist?state=WB&page=2#eligibility');
  assert.equal(page.context.location.replaced, '/number-rush/');
  assert.equal(page.values.get('setbget:number-rush:offline-entry'), '1');
});

test('a temporary probe failure followed by a live valid response stays online', async () => {
  let checks = 0;
  const page = run('https://setbget.test/jobs?q=teacher&page=3', {
    fetch: async () => ++checks === 1 ? Promise.reject(Error('temporary packet loss')) : response(),
  });
  await sleep(5);
  await page.listeners.offline[0]();
  assert.equal(checks, 2);
  assert.equal(page.context.location.replaced, undefined);
  assert.equal(page.values.has(KEY), false);
});

test('a reachable Wi-Fi interface with an unavailable frontend is detected without navigator.onLine changes', async () => {
  const page = run('https://setbget.test/jobs', {
    online: true,
    fetch: async () => { throw Error('gateway unavailable'); },
  });
  await sleep(5);
  await page.listeners.offline[0]();
  assert.equal(page.context.navigator.onLine, true);
  assert.equal(page.context.location.replaced, '/number-rush/');
});

test('periodic probes trigger offline routing without pointer, keyboard or scroll events', async () => {
  const page = run('https://setbget.test/dashboard?tab=profile#settings', {
    online: true,
    fetch: async () => Promise.reject(Error('internet route unavailable')),
  });
  await sleep(5); // initial probe is the first failed check
  await page.intervals[0].callback(); // scheduled monitor probe; no user interaction is dispatched
  await sleep(5);
  assert.equal(page.context.location.replaced, '/number-rush/');
  assert.equal(page.values.get(KEY), 'https://setbget.test/dashboard?tab=profile#settings');
});

test('only a live 200 response containing the probe token counts as reachable', async () => {
  for (const invalidResponse of [response(503, 'offline'), response(200, '<html>SPA fallback</html>'), response(200, '')]) {
    const page = run('https://setbget.test/jobs', { fetch: async () => invalidResponse });
    await sleep(5);
    await page.listeners.offline[0]();
    assert.equal(page.context.location.replaced, '/number-rush/');
  }
});

test('probe is uncached, same-origin, redirect-free, timed and periodically scheduled', async () => {
  let request;
  const page = run('https://setbget.test/jobs', {
    fetch: async (url, options) => { request = { url, options }; return response(); },
  });
  await sleep(5);
  assert.match(request.url, /^https:\/\/setbget\.test\/connectivity-check\.txt\?/);
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.mode, 'same-origin');
  assert.equal(request.options.redirect, 'error');
  assert.equal(request.options.cache, 'no-store');
  assert.equal(request.options.credentials, 'omit');
  assert.ok(request.options.signal instanceof AbortSignal);
  assert.equal(page.intervals[0].delay, 5_000);
  await page.intervals[0].callback();
  assert.equal(request.options.cache, 'no-store');
});

test('overlapping timer and browser-event requests share one in-flight probe', async () => {
  let finish;
  let checks = 0;
  const page = run('https://setbget.test/jobs', {
    fetch: async () => { checks++; return new Promise(resolve => { finish = resolve; }); },
  });
  page.intervals[0].callback();
  const online = page.listeners.online[0]();
  assert.equal(checks, 1);
  finish(response());
  await online;
  await sleep(5);
  assert.equal(checks, 2); // one queued fresh check, never parallel requests
});

test('a hanging probe times out instead of blocking future checks or declaring offline on one failure', async () => {
  let aborted = false;
  const page = run('https://setbget.test/jobs', {
    fetch: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true });
    }),
  });
  await sleep(2_600);
  assert.equal(aborted, true);
  assert.equal(page.context.location.replaced, undefined);
  assert.equal(page.values.has(KEY), false);
});

test('hidden pages stop polling, abort pending work, and run a fresh check when shown', async () => {
  let checks = 0;
  const page = run('https://setbget.test/jobs', { fetch: async () => { checks++; return response(); } });
  await sleep(5);
  const firstCount = checks;
  page.context.document.visibilityState = 'hidden';
  page.listeners.visibilitychange[0]();
  await page.intervals[0].callback();
  assert.equal(checks, firstCount);
  page.context.document.visibilityState = 'visible';
  page.listeners.visibilitychange[0]();
  await sleep(5);
  assert.equal(checks, firstCount + 1);
});

test('a page restored from the back-forward cache restarts connectivity monitoring', async () => {
  let checks = 0;
  const page = run('https://setbget.test/jobs', { fetch: async () => { checks++; return response(); } });
  await sleep(5);
  page.listeners.pagehide[0]();
  page.listeners.pageshow[0]({ persisted: true });
  await sleep(5);
  assert.equal(checks, 2);
  assert.equal(page.intervals.filter(interval => !interval.cleared).length, 1);
});

test('a single cached-style or malformed success never resets an outage', async () => {
  let checks = 0;
  const page = run('https://setbget.test/jobs', {
    online: true,
    fetch: async () => ++checks <= 2 ? response(200, '<cached fallback>') : response(),
  });
  await sleep(5); // invalid response one
  await page.listeners.offline[0](); // invalid response two triggers redirect
  assert.equal(page.context.location.replaced, '/number-rush/');
  assert.equal(page.values.get(KEY), 'https://setbget.test/jobs');
});

test('verified recovery requires consecutive successes and defers an active round', async () => {
  const values = new Map([[KEY, 'https://setbget.test/jobs/chemist?state=WB#eligibility']]);
  let reachable = false;
  let deferredUrl;
  const game = run('https://setbget.test/number-rush/', {
    values,
    online: false,
    fetch: async () => reachable ? response() : Promise.reject(Error('offline')),
    connectionHandler(url) { deferredUrl = url; return true; },
  });
  await sleep(5);
  reachable = true;
  game.context.navigator.onLine = true;
  await game.listeners.online[0]();
  await sleep(5);
  assert.equal(deferredUrl, 'https://setbget.test/jobs/chemist?state=WB#eligibility');
  assert.equal(game.context.location.replaced, undefined);
});

test('reconnection from the welcome screen restores after verified reachability', async () => {
  const values = new Map([[KEY, 'https://setbget.test/jobs?q=teacher#latest']]);
  let reachable = false;
  const game = run('https://setbget.test/number-rush/', {
    values,
    online: false,
    fetch: async () => reachable ? response() : Promise.reject(Error('offline')),
  });
  await sleep(5);
  reachable = true;
  game.context.navigator.onLine = true;
  await game.listeners.online[0]();
  await sleep(5);
  assert.equal(game.context.location.replaced, 'https://setbget.test/jobs?q=teacher#latest');
});

test('direct game visits do not redirect, and unavailable storage uses the offline marker', async () => {
  const direct = run('https://setbget.test/number-rush/');
  await sleep(5);
  await direct.listeners.offline[0]();
  assert.equal(direct.context.location.replaced, undefined);

  const blocked = run('https://setbget.test/dashboard', {
    online: false,
    storageThrows: true,
    fetch: async () => Promise.reject(Error('offline')),
  });
  await sleep(5);
  await blocked.listeners.offline[0]();
  assert.equal(blocked.context.location.replaced, '/number-rush/?offline=1');
});

test('external return targets are discarded and never navigated to', async () => {
  const values = new Map([[KEY, 'https://attacker.test/collect']]);
  const game = run('https://setbget.test/number-rush/', { values });
  await sleep(5);
  assert.equal(values.has(KEY), false);
  assert.equal(game.context.location.replaced, undefined);
});
