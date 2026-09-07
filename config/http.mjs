// Shared by the Worker/framework and the generated Vercel host rules.
export function securityHeaders(development = false) {
  const csp = [
    "default-src 'self'",
    // Vinext streams inline hydration scripts. Keep them working without eval
    // or third-party script origins; this is a baseline CSP, not a nonce policy.
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${development ? ' ws: wss:' : ''}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    ...(development ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    {
      key: 'Permissions-Policy',
      value:
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), clipboard-write=(self), web-share=(self)',
    },
    // Do not impose a preload or includeSubDomains policy on the shared host.
    ...(!development
      ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]
      : []),
  ];
}

export const revalidate = 'public, max-age=0, must-revalidate';
export const immutable = 'public, max-age=31536000, immutable';
export const staticCache = 'public, max-age=3600, must-revalidate';
export const noStoreHeaders = [
  { key: 'Cache-Control', value: 'no-store' },
  { key: 'CDN-Cache-Control', value: 'no-store' },
  { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
];

export function routeHeaders(development = false) {
  return [
    {
      source: '/',
      headers: [...securityHeaders(development), ...noStoreHeaders],
    },
    { source: '/:path*', headers: securityHeaders(development) },
    {
      source: '/api/:path*',
      // Cache policy belongs to the route: config defaults can override the
      // success response's bounded CDN TTL in a framework response finalizer.
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nosnippet' }],
    },
    {
      source: '/sw.js',
      headers: [
        ...noStoreHeaders.filter(({ key }) => key !== 'Cache-Control'),
        { key: 'Cache-Control', value: revalidate },
      ],
    },
    {
      source: '/_next/static/:path*',
      headers: [{ key: 'Cache-Control', value: immutable }],
    },
    {
      source: '/pieces/:path*',
      headers: [{ key: 'Cache-Control', value: staticCache }],
    },
    ...[
      '/favicon.svg',
      '/icon-192.png',
      '/icon-512.png',
      '/icon-maskable-512.png',
      '/apple-touch-icon.png',
    ].map((source) => ({
      source,
      headers: [{ key: 'Cache-Control', value: staticCache }],
    })),
  ];
}
