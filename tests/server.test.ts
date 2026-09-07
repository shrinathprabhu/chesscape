import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import {
  originalPuzzle,
  escapeMoves,
  evaluate,
  lichessCandidate,
} from '../server/chess';
import {
  getDaily,
  submitAttempt,
  publicAttempt,
  rateLimit,
  utcDay,
} from '../server/service';
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
        async all() {
          return { results: sqlite.prepare(sql).all(...(args as never[])) };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...(args as never[]));
          return { meta: { changes: Number(result.changes) } };
        },
      };
    },
  } as unknown as D1Database;
  return { db, sqlite };
}
void test('every original and board transform has 1–2 escapes; all other legal moves lead to mate in one', () => {
  for (let i = 0; i < 16; i++) {
    const day = utcDay(Date.parse('2026-09-01') + i * 86400000);
    const p = originalPuzzle(day);
    assert.ok(p.answers.length >= 1 && p.answers.length <= 2);
    assert.deepEqual(p.answers, escapeMoves(p.fen));
    const game = new Chess(p.fen);
    assert.ok(game.moves().length >= 5);
    for (const move of game.moves({ verbose: true })) {
      const result = evaluate(p.fen, move.lan, p.answers)!;
      assert.equal(result.won, p.answers.includes(move.lan));
      if (!result.won) assert.equal(new Chess(result.fen).isCheckmate(), true);
    }
  }
});
void test('initial serializers do not expose answer arrays, FEN before start, or Lichess IDs', () => {
  const data = readFileSync('app/api/daily/route.ts', 'utf8');
  assert.ok(!data.includes('answers:'));
  assert.ok(!data.includes('solution:'));
  assert.ok(!data.includes('fen:'));
  const p = originalPuzzle('2026-09-07');
  const out = publicAttempt(
    {
      id: 'id',
      client: 'private',
      day: '2026-09-07',
      started_at: 0,
      expires_at: 30000,
      status: 'playing',
      elapsed_ms: null,
      move: null,
      result_fen: null,
      reply: null,
    },
    {
      day: '2026-09-07',
      fen: p.fen,
      answers: JSON.stringify(p.answers),
      source: p.source,
      source_id: 'secret',
      escape_count: p.escapeCount,
    },
    5000,
  );
  assert.deepEqual(
    Object.keys(out).sort(),
    [
      'id',
      'day',
      'fen',
      'status',
      'startedAt',
      'expiresAt',
      'serverNow',
      'elapsedMs',
      'move',
      'reply',
    ].sort(),
  );
  assert.ok(!JSON.stringify(out).includes('answers'));
});
async function fixture() {
  const { db, sqlite } = makeDb();
  const day = '2026-09-07';
  const p = originalPuzzle(day);
  await db
    .prepare('INSERT INTO daily VALUES (?,?,?,?,?,?)')
    .bind(day, p.fen, JSON.stringify(p.answers), p.source, null, p.escapeCount)
    .run();
  await db
    .prepare(
      'INSERT INTO attempts (id,client,day,started_at,expires_at,status) VALUES (?,?,?,?,?,?)',
    )
    .bind('attempt', 'player', day, 1000, 31000, 'playing')
    .run();
  return { db, sqlite, p };
}
void test('server uses its clock, accepts valid escape, and repeated submissions return the committed result', async () => {
  const { db, p } = await fixture();
  const first = await submitAttempt(
    db,
    'player',
    'attempt',
    p.answers[0],
    8000,
  );
  assert.equal(first.attempt?.status, 'won');
  assert.equal(first.attempt?.elapsedMs, 7000);
  const second = await submitAttempt(db, 'player', 'attempt', 'a1a1', 9000);
  assert.equal(second.attempt?.elapsedMs, 7000);
  assert.equal(second.attempt?.status, 'won');
});
void test('a move arriving exactly at the deadline loses even if correct', async () => {
  const { db, p } = await fixture();
  const result = await submitAttempt(
    db,
    'player',
    'attempt',
    p.answers[0],
    31000,
  );
  assert.equal(result.attempt?.status, 'timeout');
  assert.equal(result.attempt?.elapsedMs, 30000);
});
void test('invalid moves do not consume an attempt and attempts are bound to their owner', async () => {
  const { db, p } = await fixture();
  assert.equal(
    (await submitAttempt(db, 'other', 'attempt', p.answers[0], 2000)).code,
    404,
  );
  assert.equal(
    (await submitAttempt(db, 'player', 'attempt', 'a1a1', 2000)).code,
    400,
  );
  assert.equal(
    (await submitAttempt(db, 'player', 'attempt', p.answers[0], 3000)).attempt
      ?.status,
    'won',
  );
});
void test('concurrent good and bad guesses commit only one result', async () => {
  const { db, p } = await fixture();
  const bad = new Chess(p.fen)
    .moves({ verbose: true })
    .find((m) => !p.answers.includes(m.lan))!.lan;
  const [one, two] = await Promise.all([
    submitAttempt(db, 'player', 'attempt', bad, 2000),
    submitAttempt(db, 'player', 'attempt', p.answers[0], 2000),
  ]);
  assert.equal(one.attempt?.status, two.attempt?.status);
  assert.equal(one.attempt?.status, 'lost');
  assert.equal(new Chess(one.attempt!.fen).isCheckmate(), true);
});
void test('daily cache requests Lichess once, including when upstream fails', async () => {
  const { db } = makeDb();
  const fetchBefore = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw new Error('offline');
  }) as typeof fetch;
  try {
    const a = await getDaily(db, '2026-09-07');
    const b = await getDaily(db, '2026-09-07');
    assert.equal(a.fen, b.fen);
    assert.equal(calls, 1);
    assert.equal(a.source, 'Chesscape original');
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
void test('durable rate limit crosses the threshold and isolates buckets', async () => {
  const { db } = makeDb();
  assert.equal(await rateLimit(db, 'ip', 2, 1000, 100), true);
  assert.equal(await rateLimit(db, 'ip', 2, 1000, 101), true);
  assert.equal(await rateLimit(db, 'ip', 2, 1000, 102), false);
  assert.equal(await rateLimit(db, 'ip', 2, 1000, 1100), true);
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
