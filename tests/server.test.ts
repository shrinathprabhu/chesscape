import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { originalPuzzle, escapeMoves, lichessCandidate } from '../server/chess';
import { getDaily, publicPuzzle, utcDay } from '../server/service';
function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('drizzle/0000_spotty_junta.sql', 'utf8'));
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          args = values;
          return this;
        },
        async first() {
          return sqlite.prepare(sql).get(...(args as never[])) ?? null;
        },
        async run() {
          return {
            meta: {
              changes: Number(
                sqlite.prepare(sql).run(...(args as never[])).changes,
              ),
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, sqlite };
}
void test('all 16 daily transforms ship 1–2 escapes and an immediate mating reply for every other legal move', () => {
  for (let i = 0; i < 16; i++) {
    const day = utcDay(Date.parse('2026-09-01') + i * 86400000);
    const p = originalPuzzle(day);
    const payload = publicPuzzle({
      day,
      fen: p.fen,
      answers: JSON.stringify(p.answers),
      source: p.source,
      source_id: null,
      escape_count: p.escapeCount,
    });
    assert.ok(payload.solutions.length >= 1 && payload.solutions.length <= 2);
    assert.deepEqual(payload.solutions, escapeMoves(payload.fen));
    const game = new Chess(payload.fen);
    const moves = game.moves({ verbose: true });
    assert.ok(moves.length >= 5);
    assert.equal(
      moves.length,
      payload.solutions.length + Object.keys(payload.refutations).length,
    );
    for (const move of moves) {
      game.move(move);
      if (!payload.solutions.includes(move.lan)) {
        game.move(payload.refutations[move.lan]);
        assert.equal(game.isCheckmate(), true);
        game.undo();
      }
      game.undo();
    }
    assert.deepEqual(
      Object.keys(payload).sort(),
      [
        'day',
        'number',
        'fen',
        'solutions',
        'refutations',
        'escapeCount',
        'source',
        'resetsAt',
      ].sort(),
    );
  }
});
void test('daily cache requests Lichess once, including upstream failure, and does not write player attempts', async (t) => {
  const { db, sqlite } = makeDb();
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('offline');
  });
  const a = await getDaily(db, '2026-09-07');
  const b = await getDaily(db, '2026-09-07');
  assert.deepEqual(a, b);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(a.source, 'Chesscape original');
  assert.equal(
    sqlite.prepare('SELECT COUNT(*) AS count FROM attempts').get()!.count,
    0,
  );
  sqlite.close();
});
void test('concurrent first visitors always receive the same immutable position', async (t) => {
  const { db, sqlite } = makeDb();
  let release!: () => void;
  let entered!: () => void;
  const upstreamStarted = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const upstream = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    entered();
    await upstream;
    return Response.json({
      game: { pgn: 'e4' },
      puzzle: { themes: ['mateIn1'], solution: ['e7e5'], initialPly: 0 },
    });
  });
  const first = getDaily(db, '2026-09-08');
  await upstreamStarted;
  const second = await getDaily(db, '2026-09-08');
  release();
  assert.deepEqual(await first, second);
  assert.deepEqual(await getDaily(db, '2026-09-08'), second);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(
    sqlite.prepare('SELECT COUNT(*) AS count FROM daily').get()!.count,
    1,
  );
  sqlite.close();
});
void test('Lichess rejects unrelated or malformed puzzle data', () => {
  assert.equal(lichessCandidate({}), null);
  assert.equal(
    lichessCandidate({
      game: { pgn: 'e4' },
      puzzle: { initialPly: 0, themes: ['mateIn1'], solution: ['e7e5'] },
    }),
    null,
  );
});
