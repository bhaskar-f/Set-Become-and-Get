const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'offline-connectivity.js'), 'utf8');
function run(url, options = {}) {
  const listeners = {};
  const values = options.values || new Map();
  const location = new URL(url);
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  const context = {
    URL, Date, Promise, console,
    location: { href: location.href, origin: location.origin, pathname: location.pathname, replace(value) { this.replaced = value; } },
    sessionStorage: options.storageThrows ? { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } } : storage,
    navigator: { onLine: options.online ?? true },
    window: { addEventListener(name, callback) { listeners[name] = callback; } },
    fetch: options.fetch || (async () => ({ ok: true })),
    setTimeout(callback) { callback(); return 1; }, clearTimeout() {},
  };
  vm.runInNewContext(source, context);
  return { context, listeners, values };
}
const KEY = 'setbget:offline:return-url';

test('offline transition preserves an exact same-origin job URL for automatic return', async () => {
  const page = run('https://setbget.test/jobs/chemist?state=WB&page=2#eligibility');
  await page.listeners.offline();
  assert.equal(page.values.get(KEY), 'https://setbget.test/jobs/chemist?state=WB&page=2#eligibility');
  assert.equal(page.context.location.replaced, '/number-rush/');
});

test('game reconnect verifies reachability before restoring the saved route', async () => {
  const values = new Map([[KEY, 'https://setbget.test/jobs?q=teacher#latest']]);
  let checks = 0;
  const game = run('https://setbget.test/number-rush/', { values, online: false, fetch: async url => { checks++; assert.match(url, /reachability=/); return { ok: checks > 1 }; } });
  await game.listeners.online();
  assert.equal(game.context.location.replaced, undefined);
  game.context.navigator.onLine = true;
  await game.listeners.online();
  assert.equal(checks, 2);
  assert.equal(game.context.location.replaced, 'https://setbget.test/jobs?q=teacher#latest');
  assert.equal(values.get(KEY), 'https://setbget.test/jobs?q=teacher#latest');
});

test('direct game visits and blocked session storage do not create a return redirect', async () => {
  const direct = run('https://setbget.test/number-rush/');
  await direct.listeners.offline();
  assert.equal(direct.context.location.replaced, undefined);
  const blocked = run('https://setbget.test/dashboard', { storageThrows: true });
  await blocked.listeners.offline();
  assert.equal(blocked.context.location.replaced, '/number-rush/');
});

test('external return targets are rejected', async () => {
  const values = new Map([[KEY, 'https://attacker.test/collect']]);
  const game = run('https://setbget.test/number-rush/', { values });
  await game.listeners.online();
  assert.equal(game.context.location.replaced, undefined);
  assert.equal(values.has(KEY), false);
});
