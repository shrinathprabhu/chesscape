import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const archive = process.argv[2];
if (!archive)
  throw new Error('Usage: npm run verify:archive -- /path/to/release.tar.gz');
const absoluteArchive = resolve(archive);
const entries = new Set(
  execFileSync('tar', ['-tzf', absoluteArchive], { encoding: 'utf8' })
    .trim()
    .split('\n'),
);
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = directory + '/' + entry.name;
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}
const hosting = JSON.parse(readFileSync('.openai/hosting.json', 'utf8'));
assert.ok(
  entries.has('dist/.openai/hosting.json'),
  'Release is missing its hosting configuration.',
);
if (hosting.d1) {
  const files = sourceFiles('drizzle');
  assert.ok(
    files.some((path) => path.endsWith('.sql')),
    'D1 releases must include a generated SQL migration.',
  );
  assert.ok(
    files.includes('drizzle/meta/_journal.json'),
    'Migration journal is missing.',
  );
  for (const source of files) {
    const target = 'dist/.openai/' + source;
    assert.ok(
      entries.has(target),
      `Release is missing ${target}. The source migration directory must be ./drizzle.`,
    );
    const archived = execFileSync('tar', ['-xOf', absoluteArchive, target]);
    assert.deepEqual(
      archived,
      readFileSync(source),
      `${target} does not match the checked-in migration.`,
    );
  }
  console.log(
    `Release verified: all ${files.length} migration and metadata files are packaged unchanged.`,
  );
}
