const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = __dirname;
function build(env) {
  return spawnSync(process.execPath, ['build.js'], { cwd: root, env, encoding: 'utf8' });
}

test('Vercel builds require an explicit public API URL and embed only that URL', () => {
  const missing = { ...process.env, VERCEL: '1' };
  delete missing.PUBLIC_API_BASE_URL;
  const rejected = build(missing);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /PUBLIC_API_BASE_URL/);

  const preview = build({ ...process.env, VERCEL: '1', PUBLIC_API_BASE_URL: 'https://api-preview.example/api' });
  assert.equal(preview.status, 0, preview.stderr);
  const config = fs.readFileSync(path.join(root, 'public', 'api-config.js'), 'utf8');
  assert.ok(config.includes('https://api-preview.example/api'));
  assert.doesNotMatch(config, /SECRET|MONGODB|PASSWORD|JWT_/);
  assert.ok(fs.existsSync(path.join(root, 'public', 'i18n.js')));
  assert.ok(fs.existsSync(path.join(root, 'public', 'job-content-language.js')));
  assert.ok(fs.existsSync(path.join(root, 'public', 'offline-connectivity.js')));
  assert.ok(fs.existsSync(path.join(root, 'public', 'service-worker.js')));
  assert.ok(fs.existsSync(path.join(root, 'public', 'offline.html')));
  assert.ok(fs.existsSync(path.join(root, 'public', 'logo.png')));
  assert.ok(fs.existsSync(path.join(root, 'public', 'connectivity-check.txt')));
  assert.equal(fs.readFileSync(path.join(root, 'public', 'connectivity-check.txt'), 'utf8').trim(), 'ok');
  for (const asset of ['index.html', 'game.css', 'game.js', 'questions.js', 'storage.js'])
    assert.ok(fs.existsSync(path.join(root, 'public', 'number-rush', asset)), `${asset} must ship with the game`);
  assert.match(fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8'), /offline-connectivity\.js/);
  const worker = fs.readFileSync(path.join(root, 'public', 'service-worker.js'), 'utf8');
  assert.match(worker, /setbget-number-rush-v4/);
  assert.match(worker, /connectivity-check\.txt[\s\S]*cache: 'no-store'/);
  const builtHtml = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  assert.match(builtHtml, /<img src="\/logo\.png" alt="setbget"/);
  assert.match(builtHtml, /services-menu-group[\s\S]*data-i18n="navigation\.brainGames"[\s\S]*href="\/number-rush\/"/);
  const mainNav = builtHtml.match(/<nav[^>]*class="main-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
  assert.doesNotMatch(mainNav.split('<details')[0], /href="\/number-rush\/"/);
  assert.ok(fs.readFileSync(path.join(root, 'public', 'job-content.js'), 'utf8').includes('translationMap'));
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  assert.match(html, /<script defer src="\/analytics\.js"><\/script>/);
  const analytics = fs.readFileSync(path.join(root, 'public', 'analytics.js'), 'utf8');
  assert.match(analytics, /@vercel\/analytics/);
  assert.match(analytics, /_vercel\/insights\/script\.js/);
  for (const developmentOnly of ['translation-preview.html', 'translation-preview.js', 'translation-preview-restore.js', 'dev-fixtures/content-translated-job.fixture.js'])
    assert.equal(fs.existsSync(path.join(root, 'public', developmentOnly)), false, `${developmentOnly} must not enter production output`);
  for (const locale of ['en', 'hi', 'bn'])
    assert.ok(fs.existsSync(path.join(root, 'public', 'locales', `${locale}.json`)));
});
