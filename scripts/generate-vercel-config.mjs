import { readFileSync, writeFileSync } from 'node:fs';
import {
  routeHeaders,
  noStoreHeaders,
  revalidate,
  securityHeaders,
} from '../config/http.mjs';

// Merge this into the lowkey.tools host. The Worker/D1 app still needs a public
// origin or a runtime port; no rewrite to the owner-private preview is installed.
const mount = '/chesscape';
const config = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  headers: [
    ...routeHeaders().map((rule) => ({ ...rule, source: mount + rule.source })),
    { source: mount, headers: [...securityHeaders(), ...noStoreHeaders] },
    { source: mount + '/', headers: noStoreHeaders },
    {
      source: mount + '/manifest.webmanifest',
      headers: [{ key: 'Cache-Control', value: revalidate }],
    },
    ...['robots.txt', 'sitemap.xml', 'llms.txt', 'index.md'].map((file) => ({
      source: `${mount}/${file}`,
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=3600, must-revalidate',
        },
      ],
    })),
  ],
  redirects: [
    {
      source: '/',
      has: [{ type: 'host', value: 'chesscape.lowkey.tools' }],
      destination: 'https://lowkey.tools/chesscape',
      permanent: true,
    },
    {
      source: '/chesscape/:path*',
      has: [{ type: 'host', value: 'chesscape.lowkey.tools' }],
      destination: 'https://lowkey.tools/chesscape/:path*',
      permanent: true,
    },
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'chesscape.lowkey.tools' }],
      destination: 'https://lowkey.tools/chesscape/:path*',
      permanent: true,
    },
  ],
};
const contents = JSON.stringify(config, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync('vercel.json', 'utf8') !== contents)
    throw new Error('vercel.json is stale. Run npm run config:vercel.');
  console.log('Vercel rules match the shared security and caching policy.');
} else {
  writeFileSync('vercel.json', contents);
}
