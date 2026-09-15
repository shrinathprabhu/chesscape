import assert from 'node:assert/strict';
import test from 'node:test';
import { puzzleCacheHeaders, noStore } from '../lib/http-cache';

void test('daily edge caching expires at UTC midnight without storing answers in the browser', () => {
  const midnight = Date.parse('2026-09-08T00:00:00Z');
  const result = puzzleCacheHeaders(midnight, midnight - 1500);
  assert.equal(result['Cache-Control'], 'no-store');
  assert.equal(
    result['CDN-Cache-Control'],
    'public, max-age=1, must-revalidate',
  );
  for (const now of [midnight - 999, midnight, midnight + 3000])
    assert.deepEqual(puzzleCacheHeaders(midnight, now), noStore);
  assert.deepEqual(puzzleCacheHeaders(NaN), noStore);
  assert.equal(
    puzzleCacheHeaders(midnight * 2, midnight)['CDN-Cache-Control'],
    'public, max-age=86400, must-revalidate',
  );
});
