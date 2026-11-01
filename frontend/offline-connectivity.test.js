const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'offline-connectivity.js'), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  const context = {
    URL, Date, Promise, AbortController, console,
    location,
    sessionStorage: options.storageThrows ? { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } } : storage,
    navigator: { onLine: options.online ?? true },
    document: { visibilityState: options.visibility || 'visible', addEventListener(name, callback) { (listeners[name] ||= []).push(callback); } },
    window,
    fetch: options.fetch || (async () => ({ ok: true, status: 200 })),
    setTimeout, clearTimeout,
    setInterval(callback, delay) { intervals.push({ callback, delay }); return intervals.length; },
    clearInterval() {},
  };
  vm.runInNewContext(source, context);
  return { context, listeners, values, intervals };
}

const KEY = 'setbget:offline:return-url';

test('two consecutive same-origin check failures save and redirect the exact current URL', async () => {
  const page = run('https://setbget.test/jobs/chemist?state=WB&page=2#eligibility', {
    online: true,
    fetch: async () => { throw Error('network unreachable'); },
  });
  await sleep(5); // initial monitor check is failure one
  await page.listeners.offline[0]();
  assert.equal(page.values.get(KEY), 'https://setbget.test/jobs/chemist?state=WB&page=2#eligibility');
  assert.equal(page.context.location.replaced, '/number-rush/');
  assert.equal(page.values.get('setbget:number-rush:offline-entry'), '1');
});

test('a transient check failure followed by a reachable frontend does not redirect', async () => {
  let checks = 0;
  const page = run('https://setbget.test/jobs?q=teacher&page=3', {
    fetch: async () => { checks++; if (checks === 1) throw Error('temporary packet loss'); return { ok: true, status: 200 }; },
  });
  await sleep(5);
  await page.listeners.offline[0]();
  assert.equal(checks, 2);
  assert.equal(page.context.location.replaced, undefined);
  assert.equal(page.values.has(KEY), false);
});

test('frontend polling detects router outages even when navigator.onLine remains true', async () => {
  let checks = 0;
  const page = run('https://setbget.test/jobs', {
    online: true,
    fetch: async () => { checks++; throw Error('gateway unavailable'); },
  });
  await sleep(5);
  await page.listeners.offline[0]();
  assert.ok(checks >= 2);
  assert.equal(page.context.location.replaced, '/number-rush/');
});

test('visible-page monitoring uses a same-origin uncached probe every seven seconds', async () => {
  let request;
  const page = run('https://setbget.test/jobs', {
    fetch: async (url, options) => { request = { url, options }; return { ok: true, status: 200 }; },
  });
  await sleep(5);
  assert.match(request.url, /^https:\/\/setbget\.test\/connectivity-check\.txt\?/);
  assert.equal(request.options.cache, 'no-store');
  assert.equal(request.options.credentials, 'omit');
  assert.equal(request.options.signal instanceof AbortSignal, true);
  assert.equal(page.intervals[0].delay, 7_000);

  let hiddenRequests = 0;
  const hidden = run('https://setbget.test/jobs', { visibility: 'hidden', fetch: async () => { hiddenRequests++; return { ok: true, status: 200 }; } });
  await hidden.intervals[0].callback();
  assert.equal(hiddenRequests, 0);
});

test('game defers a verified restored URL until the active round finishes', async () => {
  const values = new Map([[KEY, 'https://setbget.test/jobs/chemist?state=WB#eligibility']]);
  let deferredUrl;
  let reachable = false;
  const game = run('https://setbget.test/number-rush/', {
    values,
    online: false,
    fetch: async () => { if (!reachable) throw Error('offline'); return { ok: true, status: 200 }; },
    connectionHandler(url) { deferredUrl = url; return true; },
  });
  await sleep(5);
  reachable = true;
  game.context.navigator.onLine = true;
  await game.listeners.online[0]();
  assert.equal(deferredUrl, 'https://setbget.test/jobs/chemist?state=WB#eligibility');
  assert.equal(game.context.location.replaced, undefined);
});

test('recovery check retries until the frontend responds, then restores the same-origin URL', async () => {
  const values = new Map([[KEY, 'https://setbget.test/jobs?q=teacher#latest']]);
  let checks = 0;
  const game = run('https://setbget.test/number-rush/', {
    values,
    online: false,
    fetch: async url => { checks++; assert.match(url, /connectivity-check\.txt/); if (checks < 3) throw Error('not reachable yet'); return { ok: true, status: 200 }; },
  });
  await sleep(5);
  game.context.navigator.onLine = true;
  await game.listeners.online[0]();
  await sleep(750);
  assert.ok(checks >= 3);
  assert.equal(game.context.location.replaced, 'https://setbget.test/jobs?q=teacher#latest');
});

test('direct game visits do not redirect and unavailable storage uses an offline-entry marker', async () => {
  const direct = run('https://setbget.test/number-rush/');
  await sleep(5);
  await direct.listeners.offline[0]();
  assert.equal(direct.context.location.replaced, undefined);

  const blocked = run('https://setbget.test/dashboard', {
    online: false,
    storageThrows: true,
    fetch: async () => { throw Error('offline'); },
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
