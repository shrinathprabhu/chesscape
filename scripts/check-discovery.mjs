import assert from 'node:assert/strict';
const origin = process.env.CHESSCAPE_CHECK_ORIGIN ?? 'http://localhost:3001';
const mount = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const prefix = origin + mount;
const auth = process.env.CC_SITES_INSPECTION_TOKEN;
const headers = auth ? { 'OAI-Sites-Authorization': `Bearer ${auth}` } : {};
async function get(path) {
  const response = await fetch(prefix + path, {
    headers,
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, `${path} should be reachable`);
  return response;
}
const page = await get('/');
assert.equal(
  new URL(page.url).pathname,
  mount + '/',
  'The install start URL must stay inside its scope',
);
const html = await page.text();
assert.match(
  html,
  /<link[^>]*rel="canonical"[^>]*href="https:\/\/lowkey\.tools\/chesscape"/,
);
assert.match(html, /<meta[^>]*name="viewport"[^>]*device-width/);
assert.ok(!html.includes('user-scalable=no'));
assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
assert.match(html, /<main[^>]*id="main-content"/);
assert.match(html, /id="faq"/);
assert.match(html, /href="https:\/\/owleye\.dev"/);
assert.match(html, /href="https:\/\/shrinath\.me"/);
const json = html.match(
  /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
)?.[1];
assert.ok(json, 'JSON-LD should be present without JavaScript execution');
const data = JSON.parse(json);
assert.ok(data['@graph'].some((node) => node['@type'] === 'FAQPage'));
assert.ok(
  data['@graph'].some(
    (node) => node['@id'] === 'https://lowkey.tools/chesscape#game',
  ),
);
const manifestResponse = await get('/manifest.webmanifest');
assert.match(
  manifestResponse.headers.get('content-type'),
  /application\/manifest\+json/,
);
const manifest = await manifestResponse.json();
assert.equal(manifest.start_url, mount + '/');
assert.equal(manifest.scope, mount + '/');
for (const icon of manifest.icons) {
  assert.ok(icon.src.startsWith(mount + '/'));
  const response = await get(icon.src.slice(mount.length));
  assert.match(response.headers.get('content-type'), /image\/png/);
}
const resources = await Promise.all(
  ['/robots.txt', '/sitemap.xml', '/llms.txt', '/index.md'].map(
    async (path) => ({ path, response: await get(path) }),
  ),
);
for (const { path, response } of resources) {
  const body = await response.text();
  assert.ok(
    body.includes('https://lowkey.tools/chesscape'),
    `${path} uses canonical URLs`,
  );
  assert.ok(!response.headers.get('content-type').includes('text/html'));
}
const sw = await get('/sw.js');
const swCache = sw.headers.get('cache-control') ?? '';
// Sites can normalize no-cache into an equivalent mandatory-revalidation policy.
assert.ok(
  /\bno-cache\b/.test(swCache) ||
    (/\bmax-age=0\b/.test(swCache) && /\bmust-revalidate\b/.test(swCache)),
  'The service worker must revalidate rather than stay in a fresh cache',
);
const api = await get('/api/daily');
assert.match(api.headers.get('x-robots-tag') ?? '', /noindex/);
assert.ok((await api.json()).solutions.length > 0);
for (const path of ['/pieces/wN.svg', '/apple-touch-icon.png']) await get(path);
assert.ok(
  html.includes(`src="${mount}/pieces/wN.svg"`),
  'Piece assets honor the mount path',
);
assert.ok(
  html.includes(`href="${mount}/manifest.webmanifest"`),
  'Manifest link honors the mount path',
);
console.log(
  `Discovery checks passed for ${prefix || origin}: server-rendered metadata, FAQ, JSON-LD, canonical, crawl files, scoped manifest, icons, assets and API index exclusion.`,
);
