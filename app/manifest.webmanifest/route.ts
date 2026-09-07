import { appPath, SITE_DESCRIPTION } from '@/lib/site';
export function GET() {
  return Response.json(
    {
      id: appPath('/'),
      name: 'Chesscape — Daily Chess Escape',
      short_name: 'Chesscape',
      description: SITE_DESCRIPTION,
      lang: 'en',
      dir: 'ltr',
      start_url: appPath('/'),
      scope: appPath('/'),
      display: 'standalone',
      background_color: '#f7f8f2',
      theme_color: '#f7f8f2',
      orientation: 'any',
      icons: [
        {
          src: appPath('/icon-192.png'),
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: appPath('/icon-512.png'),
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: appPath('/icon-maskable-512.png'),
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
          url: appPath('/'),
          icons: [{ src: appPath('/icon-192.png'), sizes: '192x192' }],
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
