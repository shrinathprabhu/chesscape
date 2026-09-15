import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { originalPuzzle, escapeMoves } from '../server/chess';
import { getDaily, utcDay } from '../server/service';
void test('all 16 daily transforms ship 1–2 escapes and an immediate mating reply for every other legal move', () => {
  for (let i = 0; i < 16; i++) {
    const day = utcDay(Date.parse('2026-09-01') + i * 86400000);
    const p = originalPuzzle(day);
    const payload = getDaily(day);
    assert.equal(payload.fen, p.fen);
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
void test('selection is repeatable without network access and saved dates survive midnight', (t) => {
  const network = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('No upstream allowed');
  });
  const a = getDaily('2026-09-07');
  getDaily('2026-09-08');
  assert.deepEqual(getDaily('2026-09-07'), a);
  assert.equal(a.resetsAt, Date.parse('2026-09-08T00:00:00Z'));
  a.solutions.length = 0;
  assert.ok(getDaily('2026-09-07').solutions.length > 0);
  assert.equal(network.mock.callCount(), 0);
  for (const day of ['2026-02-30', 'invalid', '2026-08-31'])
    assert.throws(() => getDaily(day));
});

void test('daily API serves current and historical puzzles without external services', async (t) => {
  const { GET } = await import('../app/api/daily/route');
  const network = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('No upstream allowed');
  });
  const today = utcDay();
  const current = await GET(
    new Request('https://chesscape.lowkey.tools/api/daily'),
  );
  assert.equal(current.status, 200);
  assert.deepEqual(await current.json(), getDaily(today));
  const saved = await GET(
    new Request('https://chesscape.lowkey.tools/api/daily?day=2026-09-07'),
  );
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), getDaily('2026-09-07'));
  for (const query of [
    'day=invalid',
    'day=2026-02-30',
    'day=9999-12-31',
    'day=2026-09-07&day=2026-09-08',
    'other=1',
  ]) {
    const response = await GET(
      new Request('https://chesscape.lowkey.tools/api/daily?' + query),
    );
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(
    (
      await GET(
        new Request('https://chesscape.lowkey.tools/api/daily?day=2026-08-31'),
      )
    ).status,
    404,
  );
  assert.equal(network.mock.callCount(), 0);
});
