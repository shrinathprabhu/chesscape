import assert from 'node:assert/strict';
const origin = process.env.CHESSCAPE_CHECK_ORIGIN ?? 'http://localhost:3001';
const mount = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const auth = process.env.CC_SITES_INSPECTION_TOKEN;
const headers = auth ? { 'OAI-Sites-Authorization': `Bearer ${auth}` } : {};
async function get(path, status = 200) {
  const response = await fetch(origin + mount + path, {
    headers,
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, status, `${path}: status`);
  assert.equal(
    response.headers.get('x-content-type-options'),
    'nosniff',
    `${path}: MIME protection`,
  );
  assert.equal(
    response.headers.get('x-frame-options'),
    'DENY',
    `${path}: framing protection`,
  );
  assert.equal(
    response.headers.get('referrer-policy'),
    'strict-origin-when-cross-origin',
  );
  const csp = response.headers.get('content-security-policy') ?? '';
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /font-src 'self'/);
  assert.ok(!csp.includes('unsafe-eval'), 'Production CSP must disallow eval');
  assert.match(
    response.headers.get('permissions-policy') ?? '',
    /web-share=\(self\)/,
  );
  return response;
}
const page = await get('/');
assert.match(page.headers.get('cache-control') ?? '', /no-store/);
if (origin.startsWith('https://'))
  assert.match(
    page.headers.get('strict-transport-security') ?? '',
    /max-age=\d+/,
  );
const html = await page.text();
const css = html.match(/href="([^"]+\.css)"/)?.[1];
assert.ok(css, 'HTML must reference a stylesheet');
assert.ok(css.startsWith(mount + '/_next/static/'));
const bundle = await get(css.slice(mount.length));
assert.match(
  bundle.headers.get('cache-control') ?? '',
  /max-age=31536000.*immutable/,
);
for (const path of ['/sw.js', '/manifest.webmanifest']) {
  const response = await get(path);
  const value = response.headers.get('cache-control') ?? '';
  assert.ok(
    /no-cache/.test(value) || /max-age=0.*must-revalidate/.test(value),
    `${path}: must revalidate`,
  );
}
const icon = await get('/icon-192.png');
assert.match(icon.headers.get('cache-control') ?? '', /max-age=3600/);
const daily = await get('/api/daily');
assert.match(daily.headers.get('cache-control') ?? '', /no-store/);
assert.match(daily.headers.get('x-robots-tag') ?? '', /noindex/);
const puzzle = await daily.json();
assert.ok(puzzle.solutions.length > 0, 'Local validation remains available');
// A CDN may consume its own cache header. When exposed, check the midnight cap.
const cdn = daily.headers.get('cdn-cache-control');
if (cdn && puzzle.resetsAt - Date.now() > 30000)
  assert.ok(
    !cdn.includes('no-store'),
    'Successful puzzles must retain their CDN-only cache policy',
  );
if (cdn && !cdn.includes('no-store')) {
  const ttl = Number(cdn.match(/max-age=(\d+)/)?.[1]);
  assert.ok(ttl > 0 && ttl <= 86400);
  assert.ok(ttl * 1000 <= puzzle.resetsAt - Date.now() + 30000);
  assert.ok(!cdn.includes('stale-while-revalidate'));
}
for (const query of [
  'day=not-a-date',
  'day=2026-02-30',
  'day=9999-01-01',
  'day=2026-09-01&day=2026-09-02',
  'cachebust=1',
]) {
  const response = await get('/api/daily?' + query, 400);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  for (const name of ['cdn-cache-control', 'vercel-cdn-cache-control']) {
    const value = response.headers.get(name);
    if (value)
      assert.equal(value, 'no-store', `Errors must not be cached by ${name}`);
  }
}
console.log(
  `HTTP checks passed for ${origin}${mount}: security headers, asset caching, PWA updates, daily expiry and uncacheable errors.`,
);
