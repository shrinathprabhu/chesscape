import { readdirSync, readFileSync, statSync } from 'node:fs';
const files = [];
function walk(path) {
  for (const name of readdirSync(path)) {
    const p = path + '/' + name;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|map)$/.test(p)) files.push(p);
  }
}
walk('dist/client');
const forbidden = [
  '5rk1/pp3ppp',
  '2N4q/PPP2PPP',
  'function escapeMoves',
  'function originalPuzzle',
  'lichess.org/api/puzzle/daily',
  'source_id',
  'FROM attempts',
  'INSERT INTO daily',
];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const text of forbidden)
    if (source.includes(text))
      throw new Error(`Server data leaked into ${file}: ${text}`);
}
console.log(
  `Client boundary verified: ${files.length} JavaScript/map files contain no private puzzle data or server handlers.`,
);
