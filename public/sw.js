/* Solutions stay in page memory; cache only the app shell and static assets. */
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const VERSION = `chesscape-shell-v4-${BASE || 'root'}`;
const scoped = (path) => `${BASE}${path}`;
const SHELL = [
  scoped('/'),
  scoped('/favicon.svg'),
  scoped('/icon-192.png'),
  scoped('/icon-512.png'),
  scoped('/icon-maskable-512.png'),
  scoped('/apple-touch-icon.png'),
  scoped('/manifest.webmanifest'),
  ...['w', 'b'].flatMap((color) =>
    ['K', 'Q', 'R', 'B', 'N', 'P'].map((piece) =>
      scoped(`/pieces/${color}${piece}.svg`),
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
                key.endsWith(`-${BASE || 'root'}`) &&
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
    !url.pathname.startsWith(scoped('/')) ||
    url.pathname.startsWith(scoped('/api/')) ||
    url.pathname.startsWith(scoped('/__')) ||
    url.search
  )
    return;
  // Never replace the cached game document with a Markdown guide or another route.
  if (
    request.mode === 'navigate' &&
    (url.pathname === scoped('/') || url.pathname === BASE)
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (
            response.ok &&
            response.headers.get('Content-Type')?.includes('text/html')
          ) {
            const copy = response.clone();
            event.waitUntil(
              caches
                .open(VERSION)
                .then((cache) => cache.put(scoped('/'), copy)),
            );
          }
          return response;
        })
        .catch(
          async () =>
            (await caches.match(scoped('/'))) ||
            new Response('Reconnect to open your daily escape.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            }),
        ),
    );
    return;
  }
  if (
    url.pathname === scoped('/sw.js') ||
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
  const hashed = url.pathname.startsWith(scoped('/_next/static/'));
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
