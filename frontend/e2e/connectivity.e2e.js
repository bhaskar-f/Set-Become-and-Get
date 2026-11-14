/*
 * Real-browser tests: production build + real service worker + real navigation, driven with
 * Playwright against a local server whose failure modes the tests control.
 *
 *   npm run test:e2e        (needs Chrome or Edge; override with E2E_CHANNEL=msedge)
 *
 * Network faults are produced two ways, both of which are what the page can observe:
 *   - server side: the origin / the "wider internet" endpoint drop connections or answer 503;
 *   - browser side: context.setOffline() (navigator.onLine=false + offline/online events).
 * A physically unplugged cable or a switched Wi-Fi adapter cannot be driven from a test; to the
 * page those are exactly these signals, so the Wi-Fi / Ethernet cases are covered at that level.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright-core');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };
const SPA = /^\/(jobs|boards|communities|services|about|contact|faqs|privacy|terms)(\/|$)/;

const net = { origin: 'up', internet: 'up', probeHits: 0 }; // origin: up | down | error
let originServer, internetServer, browser, base;

function serve(req, res) {
  let pathname = new URL(req.url, 'http://x').pathname;
  if (net.origin === 'down') return req.socket.destroy();
  if (pathname === '/connectivity-check.txt') net.probeHits++;
  if (net.origin === 'error') { res.writeHead(503, { 'content-type': 'text/html' }); return res.end('<h1>SetBGet is temporarily unavailable (503)</h1>'); }
  if (SPA.test(pathname)) pathname = '/index.html';
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.join(publicDir, pathname);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

test.before(async () => {
  const built = spawnSync(process.execPath, ['build.js'], { cwd: root, encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  originServer = http.createServer(serve);
  internetServer = http.createServer((req, res) => {
    if (net.internet === 'down') return req.socket.destroy();
    res.writeHead(204, { 'access-control-allow-origin': '*' }); res.end();
  });
  await new Promise(resolve => originServer.listen(0, 'localhost', resolve));
  await new Promise(resolve => internetServer.listen(0, '127.0.0.1', resolve));
  base = `http://localhost:${originServer.address().port}`;
  browser = await chromium.launch({ channel: process.env.E2E_CHANNEL || 'chrome', headless: true });
});
test.after(async () => {
  await browser?.close();
  originServer?.closeAllConnections?.(); internetServer?.closeAllConnections?.();
  originServer?.close(); internetServer?.close();
});
test.beforeEach(() => { Object.assign(net, { origin: 'up', internet: 'up', probeHits: 0 }); });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function newPage() {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const internetUrl = `http://127.0.0.1:${internetServer.address().port}/generate_204`;
  await context.addInitScript(config => { window.SETBGET_CONNECTIVITY_CONFIG = config; },
    { internetCheckUrl: internetUrl, confirmDelayMs: 300, retryBaseMs: 300, retryMaxMs: 600, probeTimeoutMs: 1500 });
  const page = await context.newPage();
  page.visited = [];
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) page.visited.push(new URL(frame.url()).pathname); });
  return { context, page };
}
/** Visit a page, then make sure the service worker controls it and the game shell is cached. */
async function prime(page, url = '/about') {
  await page.goto(base + url);
  await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then(r => r && r.active));
  await page.reload();
  await page.waitForFunction(async () => navigator.serviceWorker.controller && Boolean(await caches.match('/number-rush/index.html')));
  net.probeHits = 0;
}
const ui = page => page.evaluate(() => ({
  path: location.pathname + location.search + location.hash,
  welcome: document.getElementById('welcomeStatus')?.textContent,
  heading: document.getElementById('welcomeHeading')?.textContent,
  badge: document.getElementById('network')?.hidden === false ? document.getElementById('network').textContent : '',
  fallback: document.documentElement.getAttribute('data-sbg-fallback') === '1' ? document.getElementById('signal')?.textContent : null,
}));
const neverOpenedGame = page => assert.ok(!page.visited.some(p => p.startsWith('/number-rush')), `Number Rush must never open; navigations: ${page.visited.join(', ')}`);
const onGame = page => page.waitForURL(url => url.pathname.startsWith('/number-rush'), { timeout: 15000 });
const offlineGame = page => page.waitForFunction(() => document.getElementById('welcomeStatus')?.textContent === 'OFFLINE · READY TO PLAY', null, { timeout: 15000 });
async function lose(context, { hardware = true } = {}) { net.origin = 'down'; net.internet = 'down'; if (hardware) await context.setOffline(true); }
async function regain(context) { net.origin = 'up'; net.internet = 'up'; await context.setOffline(false); }

test('1/15. online initial load: no redirect, no banner, and no connectivity traffic', async () => {
  const { context, page } = await newPage();
  await prime(page, '/jobs?q=teacher#latest');
  await sleep(3500);
  const state = await ui(page);
  assert.equal(state.path, '/jobs?q=teacher#latest');
  assert.equal(net.probeHits, 0, 'no probe and no polling while the site is reachable');
  await context.close();
});

test('2. manual Number Rush access while online shows the normal welcome screen', async () => {
  const { context, page } = await newPage();
  await prime(page);
  await page.goto(base + '/number-rush/');
  await sleep(1200);
  assert.deepEqual(await ui(page), { path: '/number-rush/', welcome: 'NUMBER RUSH', heading: 'Think fast. Stay sharp.', badge: '', fallback: null });
  assert.equal(net.probeHits, 0);
  await context.close();
});

test('3/4. Wi-Fi or Ethernet lost: Number Rush opens, URL preserved, page restored on recovery', async () => {
  const { context, page } = await newPage();
  await prime(page, '/jobs?q=teacher&page=2#latest');
  await lose(context);
  await onGame(page);
  await offlineGame(page);
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('setbget:offline:session')).returnUrl), `${base}/jobs?q=teacher&page=2#latest`);
  assert.equal((await ui(page)).badge, 'OFFLINE');
  await regain(context);
  await page.waitForURL(url => url.pathname === '/jobs', { timeout: 15000 });
  assert.equal((await ui(page)).path, '/jobs?q=teacher&page=2#latest');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('setbget:offline:session')), null);
  await context.close();
});

test('5. navigator.onLine stays true while internet is gone: detected on the next navigation', async () => {
  const { context, page } = await newPage();
  await prime(page, '/jobs');
  net.origin = 'down'; net.internet = 'down'; // router lost its ISP link: no browser event at all
  assert.equal(await page.evaluate(() => navigator.onLine), true);
  await page.goto(base + '/about').catch(() => {});
  await onGame(page);
  await offlineGame(page);
  assert.equal(await page.evaluate(() => navigator.onLine), true);
  await regain(context);
  await page.waitForURL(url => url.pathname === '/about', { timeout: 15000 });
  await context.close();
});

test('6/14. recovery with no online event at all (event fired before the game loaded) still restores an idle game', async () => {
  const { context, page } = await newPage();
  await prime(page, '/jobs');
  await lose(context, { hardware: false });
  await page.goto(base + '/about').catch(() => {});
  await onGame(page);
  await offlineGame(page);
  net.origin = 'up'; net.internet = 'up'; // network returns silently: nothing dispatches `online`
  await page.waitForURL(url => url.pathname === '/about', { timeout: 15000 });
  await context.close();
});

test('7/15. spurious offline/online events while SetBGet is reachable never open Number Rush', async () => {
  const { context, page } = await newPage();
  await prime(page, '/jobs');
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await sleep(150);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  }
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await sleep(3500);
  assert.equal((await ui(page)).path, '/jobs');
  neverOpenedGame(page);
  await context.close();
});

test('8. network switching (offline then online again quickly) does not launch the game', async () => {
  const { context, page } = await newPage();
  await prime(page, '/jobs');
  await context.setOffline(true);
  await sleep(100);
  await context.setOffline(false);
  await sleep(3500);
  assert.equal((await ui(page)).path, '/jobs');
  neverOpenedGame(page);
  await context.close();
});

test('9a. internet works but SetBGet is unreachable: informational page, no game, auto-recovers', async () => {
  const { context, page } = await newPage();
  await prime(page, '/jobs');
  net.origin = 'down'; // internet endpoint stays up
  await page.goto(base + '/about').catch(() => {});
  await page.waitForFunction(() => document.getElementById('signal')?.textContent === 'SETBGET IS TEMPORARILY UNAVAILABLE', null, { timeout: 15000 });
  await sleep(1500);
  assert.equal((await ui(page)).path, '/about');
  net.origin = 'up';
  await page.waitForFunction(() => document.documentElement.getAttribute('data-sbg-fallback') !== '1', null, { timeout: 15000 });
  assert.equal((await ui(page)).path, '/about');
  await context.close();
});

test('9b. HTTP 503 from SetBGet is shown as the real server response, not as "no internet"', async () => {
  const { context, page } = await newPage();
  await prime(page, '/jobs');
  net.origin = 'error';
  const response = await page.goto(base + '/about');
  assert.equal(response.status(), 503);
  assert.match(await page.content(), /temporarily unavailable \(503\)/);
  await sleep(1500);
  assert.equal((await ui(page)).path, '/about');
  await context.close();
});

test('10. saved return URLs (legacy keys, or an unrelated stored URL) never make a manual open look offline', async () => {
  const { context, page } = await newPage();
  await prime(page, '/jobs');
  await page.evaluate(() => {
    sessionStorage.setItem('setbget:offline:return-url', location.origin + '/jobs');
    sessionStorage.setItem('setbget:number-rush:offline-entry', '1');
  });
  await page.goto(base + '/number-rush/?offline=1');
  await sleep(1500);
  const state = await ui(page);
  assert.equal(state.welcome, 'NUMBER RUSH');
  assert.equal(state.badge, '');
  await context.close();
});

test('11. stale caches: a stale cached connectivity script is replaced by the network copy; the probe is never cached', async () => {
  const { context, page } = await newPage();
  await prime(page, '/jobs');
  await page.evaluate(async () => {
    const name = (await caches.keys()).find(key => key.startsWith('setbget-number-rush-'));
    const cache = await caches.open(name);
    await cache.put('/offline-connectivity.js', new Response('window.STALE_POLLING_SCRIPT = true;', { headers: { 'content-type': 'text/javascript' } }));
  });
  await page.reload();
  await sleep(500);
  assert.equal(await page.evaluate(() => Boolean(window.STALE_POLLING_SCRIPT)), false);
  assert.equal(await page.evaluate(() => typeof window.SetBGetConnectivity), 'object');
  const cached = await page.evaluate(async () => {
    const out = [];
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) out.push(new URL(request.url).pathname);
    return out;
  });
  assert.ok(!cached.some(p => p.includes('connectivity-check')));
  assert.equal(await page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('setbget-number-rush-')).length), 1);
  await context.close();
});

test('12. offline game reload keeps working and keeps the personal best', async () => {
  const { context, page } = await newPage();
  await prime(page, '/jobs');
  await page.evaluate(() => localStorage.setItem('setbget:number-rush:v1', JSON.stringify({ best: 85, games: 3 })));
  await lose(context);
  await onGame(page);
  await offlineGame(page);
  await page.reload();
  await offlineGame(page);
  assert.equal(await page.evaluate(() => document.getElementById('welcomeBest').textContent), '085');
  await page.click('#start');
  await page.waitForSelector('#game:not([hidden])');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('setbget:number-rush:v1')).best), 85);
  await context.close();
});

test('13. recovery during an active round waits for the round to finish, then restores the page', async () => {
  const { context, page } = await newPage();
  await prime(page, '/jobs?x=1');
  await lose(context);
  await onGame(page);
  await offlineGame(page);
  await page.clock.install();
  await page.click('#start');
  await page.waitForSelector('#game:not([hidden])');
  await regain(context);
  await page.waitForFunction(() => document.getElementById('network')?.textContent === 'CONNECTION RESTORED', null, { timeout: 15000 });
  await page.clock.runFor(1500);
  assert.equal((await ui(page)).path, '/number-rush/', 'must not leave while a round is active');
  assert.equal(await page.evaluate(() => document.getElementById('game').hidden), false);
  await page.clock.runFor(70000); // round ends
  await page.clock.runFor(3000);  // post-round delay
  await page.waitForURL(url => url.pathname === '/jobs', { timeout: 15000 });
  assert.equal((await ui(page)).path, '/jobs?x=1');
  await context.close();
});
