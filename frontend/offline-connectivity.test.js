const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'offline-connectivity.js'), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const response = { ok: true, status: 200, text: async () => 'ok\\n' };

function run(url, options = {}) {
  const listeners = {};
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
    URL, Date, Promise, AbortController,
    location, sessionStorage: storage,
    navigator: { onLine: options.online ?? true },
    document: { visibilityState: 'visible' },
    window,
    fetch: options.fetch || (async () => response),
    setTimeout, clearTimeout,
    setInterval() { throw new Error('Periodic polling must not be installed'); },
    clearInterval() {},
  };
  vm.runInNewContext(source, context);
  return { context, listeners, values };
}

const KEY = 'setbget:offline:return-url';

test('does not install a polling timer or probe on initial page load while online', async () => {
  let checks = 0;
  run('https://setbget.test/jobs', { fetch: async () => { checks++; return response; } });
  await sleep(10);
  assert.equal(checks, 0);
});

test('browser offline event immediately redirects and saves the original URL', async () => {
  const page = run('https://setbget.test/jobs?q=teacher&page=2#latest', {
    fetch: async () => { throw Error('offline'); },
  });
  await page.listeners.offline[0]();
  assert.equal(page.values.get(KEY), 'https://setbget.test/jobs?q=teacher&page=2#latest');
  assert.equal(page.context.location.replaced, '/number-rush/');
});

test('browser online event verifies reachability and restores the saved page', async () => {
  const values = new Map([[KEY, 'https://setbget.test/jobs?q=teacher#latest']]);
  const game = run('https://setbget.test/number-rush/', { values, online: false });
  await game.listeners.online[0]();
  await sleep(10);
  assert.equal(game.context.location.replaced, 'https://setbget.test/jobs?q=teacher#latest');
});

test('recovery can be deferred until the active game round ends', async () => {
  const values = new Map([[KEY, 'https://setbget.test/jobs/chemist']]);
  let deferredUrl;
  const game = run('https://setbget.test/number-rush/', {
    values, online: false,
    connectionHandler(url) { deferredUrl = url; return true; },
  });
  await game.listeners.online[0]();
  await sleep(10);
  assert.equal(deferredUrl, 'https://setbget.test/jobs/chemist');
  assert.equal(game.context.location.replaced, undefined);
});

test('browser offline event works even when navigator.onLine was still true', async () => {
  const page = run('https://setbget.test/dashboard', { online: true });
  await page.listeners.offline[0]();
  assert.equal(page.context.location.replaced, '/number-rush/');
});

test('browser online event does not restore if the actual same-origin probe fails', async () => {
  const values = new Map([[KEY, 'https://setbget.test/jobs']]);
  const game = run('https://setbget.test/number-rush/', {
    values, online: false,
    fetch: async () => { throw Error('network route is not ready'); },
  });
  await game.listeners.online[0]();
  await sleep(10);
  assert.equal(game.context.location.replaced, undefined);
});

test('probe is same-origin, uncached and does not follow redirects', async () => {
  const values = new Map([[KEY, 'https://setbget.test/jobs']]);
  let request;
  const game = run('https://setbget.test/number-rush/', {
    values, online: false,
    fetch: async (url, options) => { request = { url, options }; return response; },
  });
  await game.listeners.online[0]();
  assert.match(request.url, /^https:\/\/setbget\\.test\/connectivity-check\\.txt\\?/);
  assert.equal(request.options.mode, 'same-origin');
  assert.equal(request.options.cache, 'no-store');
  assert.equal(request.options.redirect, 'error');
});
