const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = __dirname;
const output = path.join(root, 'public');
if (process.env.VERCEL === '1' && !process.env.PUBLIC_API_BASE_URL)
  throw new Error('Set PUBLIC_API_BASE_URL separately in the Vercel Production and Preview environments.');
const apiBase = process.env.PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
let parsed;
try { parsed = new URL(apiBase); } catch { throw new Error('PUBLIC_API_BASE_URL must be an absolute API URL.'); }
if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.pathname.replace(/\/$/, '').endsWith('/api'))
  throw new Error('PUBLIC_API_BASE_URL must be an HTTP(S) API base URL ending in /api.');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, 'data'), { recursive: true });
esbuild.buildSync({
  entryPoints: [path.join(root, 'analytics-entry.js')],
  outfile: path.join(output, 'analytics.js'),
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2017'],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.VERCEL === '1' ? 'production' : 'development'),
  },
});
for (const name of ['index.html', 'style.css', 'script.js', 'admin.js', 'public-pages.js', 'job-details.js', 'board-details.js', 'job-content.js', 'job-content-language.js', 'youtube-video.js', 'i18n.js', 'data.json', 'logo.png'])
  fs.copyFileSync(path.join(root, name), path.join(output, name));
fs.cpSync(path.join(root, 'locales'), path.join(output, 'locales'), { recursive: true });
for (const name of ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png', 'favicon-192x192.png', 'favicon-512x512.png'])
  fs.copyFileSync(path.join(root, 'assets', 'favicons', name), path.join(output, name));
for (const name of ['qualification-taxonomy.json', 'india-locations.json', 'job-taxonomy.json'])
  fs.copyFileSync(path.join(root, 'data', name), path.join(output, 'data', name));
fs.writeFileSync(path.join(output, 'api-config.js'), `window.JPEDIA_CONFIG = Object.freeze({ API_BASE_URL: ${JSON.stringify(apiBase.replace(/\/$/, ''))} });\n`);
const canonicalHost = 'https://www.setbget.in';
const publicRoutes = ['/', '/jobs', '/communities', '/faqs', '/boards', '/services', '/services/preparation', '/services/eligibility', '/privacy', '/terms', '/about', '/contact'];
const escapeXml = value => String(value).replace(/[<>&'\"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '\"': '&quot;' })[char]);
async function writeSitemap() {
  const urls = new Set(publicRoutes.map(route => `${canonicalHost}${route}`));
  if (process.env.VERCEL === '1') {
    try {
      const response = await fetch(`${apiBase.replace(/\/$/, '')}/jobs?page=1&limit=100`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`Public jobs endpoint returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.data)) throw new Error('Public jobs endpoint returned an unexpected response.');
      const pages = Math.min(500, Math.ceil((payload.pagination?.total || payload.data.length) / 100));
      const allPages = [payload];
      for (let start = 2; start <= pages; start += 10) {
        const batch = await Promise.all(Array.from({ length: Math.min(10, pages - start + 1) }, async (_, offset) => {
          const page = start + offset;
          const result = await fetch(`${apiBase.replace(/\/$/, '')}/jobs?page=${page}&limit=100`, { signal: AbortSignal.timeout(8000) });
          if (!result.ok) throw new Error(`Public jobs page ${page} returned ${result.status}`);
          return result.json();
        }));
        allPages.push(...batch);
      }
      for (const job of allPages.flatMap(page => page.data || [])) {
        if (job.status === 'PUBLISHED' && typeof job.slug === 'string' && job.slug.trim())
          urls.add(`${canonicalHost}/jobs/${encodeURIComponent(job.slug.trim())}`);
      }
    } catch (error) {
      console.warn('Could not add public job URLs to sitemap:', error.message);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls].map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(output, 'sitemap.xml'), xml);
}
fs.writeFileSync(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /profile\nDisallow: /settings\nDisallow: /services/tracker\n\nSitemap: ${canonicalHost}/sitemap.xml\n`);
writeSitemap().then(() => console.info('Built static SetBGet frontend with public API origin:', parsed.origin)).catch(error => { console.error(error); process.exitCode = 1; });
