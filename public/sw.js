/* Solutions stay in page memory; cache only the app shell and static assets. */
const VERSION = 'chesscape-shell-v5-root';
const SHELL = [
  '/',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
  ...['w', 'b'].flatMap((color) =>
    ['K', 'Q', 'R', 'B', 'N', 'P'].map(
      (piece) => `/pieces/${color}${piece}.svg`,
    ),
  ),
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith('chesscape-shell-') &&
                key.endsWith('-root') &&
                key !== VERSION,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith('/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__') ||
    url.search
  )
    return;
  // Never replace the cached game document with a Markdown guide or another route.
  if (request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (
            response.ok &&
            response.headers.get('Content-Type')?.includes('text/html')
          ) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(VERSION).then((cache) => cache.put('/', copy)),
            );
          }
          return response;
        })
        .catch(
          async () =>
            (await caches.match('/')) ||
            new Response('Reconnect to open your daily escape.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            }),
        ),
    );
    return;
  }
  if (
    url.pathname === '/sw.js' ||
    !/\.(?:js|css|svg|png|webp|webmanifest|woff2?)$/.test(url.pathname)
  )
    return;
  const update = async () => {
    const response = await fetch(request);
    if (
      response.ok &&
      !/\bno-store\b/.test(response.headers.get('Cache-Control') || '')
    ) {
      const copy = response.clone();
      event.waitUntil(
        caches.open(VERSION).then((cache) => cache.put(request, copy)),
      );
    }
    return response;
  };
  // Only content-hashed bundles/fonts are immutable. Icons, pieces and the
  // install manifest check the network so an update cannot stay cached forever.
  const hashed = url.pathname.startsWith('/_next/static/');
  event.respondWith(
    hashed
      ? caches.match(request).then((cached) => cached || update())
      : update().catch(async (error) => {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw error;
        }),
  );
});
