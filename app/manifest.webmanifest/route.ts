import { SITE_DESCRIPTION } from '@/lib/site';
export function GET() {
  return Response.json(
    {
      id: '/',
      name: 'Chesscape — Daily Chess Escape',
      short_name: 'Chesscape',
      description: SITE_DESCRIPTION,
      lang: 'en',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#f7f8f2',
      theme_color: '#f7f8f2',
      orientation: 'any',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
      categories: ['games', 'education'],
      shortcuts: [
        {
          name: 'Play your daily escape',
          short_name: 'Play',
          url: '/',
          icons: [{ src: '/icon-192.png', sizes: '192x192' }],
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
