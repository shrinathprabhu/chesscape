import { cpSync, writeFileSync } from 'node:fs';
import { routeHeaders } from '../config/http.mjs';
const mount = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
if (mount !== '' && mount !== '/chesscape')
  throw new Error('Invalid Chesscape mount path.');
// Vinext prefixes its own chunks, but Vite copies public/ to the asset root.
// Mirror those files into the mount so production serves the same URLs as dev.
if (mount) cpSync('public', `dist/client${mount}`, { recursive: true });
const path = 'dist/client/_headers';
// Static files bypass the Worker, so they need the same policy at the asset edge.
// Only literal paths and terminal wildcards are used, supported by both formats.
writeFileSync(
  path,
  '# Generated from config/http.mjs\n' +
    routeHeaders()
      .map(
        (rule) =>
          `${mount}${rule.source.replace(':path*', '*')}\n${rule.headers.map((header) => `  ${header.key}: ${header.value}`).join('\n')}\n`,
      )
      .join('\n'),
);
console.log(
  `Prepared public assets, security headers and cache rules for ${mount || '/'}.`,
);
