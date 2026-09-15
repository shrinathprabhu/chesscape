import { writeFileSync } from 'node:fs';
import { routeHeaders } from '../config/http.mjs';
const path = 'dist/client/_headers';
// Static files bypass the Worker, so they need the same policy at the asset edge.
// Only literal paths and terminal wildcards are used, supported by both formats.
writeFileSync(
  path,
  '# Generated from config/http.mjs\n' +
    routeHeaders()
      .map(
        (rule) =>
          `${rule.source.replace(':path*', '*')}\n${rule.headers.map((header) => `  ${header.key}: ${header.value}`).join('\n')}\n`,
      )
      .join('\n'),
);
console.log(`Prepared public assets, security headers and cache rules for /.`);
