import { cpSync, readFileSync, writeFileSync } from 'node:fs';
const mount = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
if (mount !== '' && mount !== '/chesscape')
  throw new Error('Invalid Chesscape mount path.');
// Vinext prefixes its own chunks, but Vite copies public/ to the asset root.
// Mirror those files into the mount so production serves the same URLs as dev.
if (mount) cpSync('public', `dist/client${mount}`, { recursive: true });
const path = 'dist/client/_headers';
const generated = readFileSync(path, 'utf8');
const rule = `${mount}/sw.js\n  Cache-Control: no-cache\n`;
if (!generated.includes(rule)) writeFileSync(path, `${generated}\n${rule}`);
console.log(
  `Prepared public assets for ${mount || '/'} and service-worker update headers.`,
);
