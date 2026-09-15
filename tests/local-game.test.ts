import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { getDaily } from '../server/service';
import {
  createAttempt,
  commitMove,
  expireAttempt,
  recordAttempt,
  needsNewPuzzle,
  nextMidnight,
  progressStats,
  readProgress,
  saveProgress,
  PROGRESS_KEY,
} from '../lib/local-game';
import type { LocalProgress } from '../lib/contracts';
const day = '2026-09-07';
const puzzle = getDaily(day);
const now = Date.parse(day + 'T12:00:00Z');
const move = (uci: string) => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  promotion: uci[4],
});
const fresh = (): LocalProgress => ({
  version: 2,
  day,
  attempt: null,
  nextAvailableAt: null,
  history: [],
});
void test('start, correct move, wrong move, and retry are synchronous and require no network', (t) => {
  const network = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Gameplay must work offline');
  });
  const start = createAttempt(puzzle, now);
  const win = commitMove(puzzle, start, move(puzzle.solutions[0]), now + 1234);
  assert.equal(win.status, 'won');
  assert.equal(win.elapsedMs, 1234);
  assert.equal(win.reply, null);
  assert.ok(!(win instanceof Promise));
  assert.equal(
    commitMove(puzzle, win, move(puzzle.solutions[0]), now + 5000),
    win,
  );
  const bad = Object.keys(puzzle.refutations)[0];
  const lost = commitMove(puzzle, start, move(bad), now + 2000);
  assert.equal(lost.status, 'lost');
  assert.equal(new Chess(lost.fen).isCheckmate(), true);
  const retry = createAttempt(puzzle, now + 10000);
  assert.equal(retry.fen, puzzle.fen);
  assert.equal(retry.expiresAt - retry.startedAt, 30000);
  assert.notEqual(retry.id, start.id);
  assert.equal(
    commitMove(puzzle, retry, move(puzzle.solutions[0]), now + 10300).elapsedMs,
    300,
  );
  assert.equal(network.mock.callCount(), 0);
});
void test('illegal moves leave the attempt active; an exact-deadline move times out locally', () => {
  const start = createAttempt(puzzle, now);
  assert.throws(() =>
    commitMove(puzzle, start, { from: 'a1', to: 'a1' }, now + 100),
  );
  assert.equal(start.status, 'playing');
  assert.equal(expireAttempt(start, now + 29999), start);
  const timeout = commitMove(
    puzzle,
    start,
    move(puzzle.solutions[0]),
    now + 30000,
  );
  assert.equal(timeout.status, 'timeout');
  assert.equal(timeout.elapsedMs, 30000);
  assert.equal(timeout.fen, puzzle.fen);
  assert.equal(expireAttempt(start, now + 60000).status, 'timeout');
});
void test('unfinished puzzles remain pinned across days; solving starts a cooldown until the following midnight', () => {
  let progress = fresh();
  assert.equal(needsNewPuzzle(null, now), true);
  assert.equal(needsNewPuzzle(progress, now + 3 * 86400000), false);
  progress = recordAttempt(
    progress,
    expireAttempt(createAttempt(puzzle, now), now + 30000),
  );
  assert.equal(needsNewPuzzle(progress, now + 3 * 86400000), false);
  const later = now + 3 * 86400000;
  const win = commitMove(
    puzzle,
    createAttempt(puzzle, later),
    move(puzzle.solutions[0]),
    later + 1400,
  );
  progress = recordAttempt(progress, win);
  assert.equal(progress.nextAvailableAt, nextMidnight(later + 1400));
  assert.equal(needsNewPuzzle(progress, progress.nextAvailableAt! - 1), false);
  assert.equal(needsNewPuzzle(progress, progress.nextAvailableAt!), true);
});
void test('reload restores results and deadlines without persisting solutions or reply maps', () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
  };
  const progress = recordAttempt(fresh(), createAttempt(puzzle, now));
  saveProgress(storage, progress);
  assert.deepEqual(readProgress(storage), progress);
  const raw = memory.get(PROGRESS_KEY)!;
  assert.ok(!raw.includes('solutions'));
  assert.ok(!raw.includes('refutations'));
  assert.equal(
    expireAttempt(readProgress(storage)!.attempt!, now + 40000).status,
    'timeout',
  );
  storage.setItem(PROGRESS_KEY, 'broken');
  assert.equal(readProgress(storage), null);
  storage.setItem(
    PROGRESS_KEY,
    JSON.stringify({ ...progress, history: [null] }),
  );
  assert.equal(readProgress(storage), null);
});
void test('retries update one puzzle record and a solve replaces its earlier loss in local stats', () => {
  const start = createAttempt(puzzle, now);
  let progress = recordAttempt(fresh(), expireAttempt(start, now + 30000));
  const retry = createAttempt(puzzle, now + 60000);
  progress = recordAttempt(progress, retry);
  progress = recordAttempt(
    progress,
    commitMove(puzzle, retry, move(puzzle.solutions[0]), now + 60987),
  );
  const stats = progressStats(progress, now + 61000);
  assert.equal(stats.played, 1);
  assert.equal(stats.won, 1);
  assert.equal(stats.bestMs, 987);
  assert.equal(stats.streak, 1);
  assert.equal(stats.recent[0].status, 'won');
});
