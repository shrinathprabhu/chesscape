import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import puzzles from '../server/puzzles-v1.json';
import { getDaily } from '../server/service';
import { Position, chooseMove } from '../lib/engine';
import {
  WIN_PROGRESS_KEY,
  bestWin,
  createWinGame,
  emptyWinProgress,
  formatClock,
  isPlayerTurn,
  playComputerMove,
  playWinMove,
  playerMoveCount,
  readWinProgress,
  recordWinGame,
  resignWinGame,
  saveWinProgress,
  winClock,
} from '../lib/win-game';

const day = '2026-09-07';
const now = Date.parse(day + 'T12:00:00Z');
const move = (uci: string) => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  promotion: uci[4],
});
function perft(position: Position, depth: number): number {
  if (!depth) return 1;
  let nodes = 0;
  for (const next of position.moves()) {
    position.make(next);
    nodes += perft(position, depth - 1);
    position.unmake();
  }
  return nodes;
}

void test('engine move generation matches standard perft counts', () => {
  const cases: [string, number[]][] = [
    [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      [20, 400, 8902],
    ],
    [
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
      [48, 2039, 97862],
    ],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
    [
      'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
      [6, 264, 9467],
    ],
    [
      'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
      [44, 1486, 62379],
    ],
  ];
  for (const [fen, counts] of cases)
    counts.forEach((count, index) =>
      assert.equal(perft(new Position(fen), index + 1), count, fen),
    );
});

void test('engine finds the mating reply to every wrong escape and always plays legal moves', () => {
  for (const puzzle of puzzles) {
    for (const wrong of Object.keys(puzzle.refutations)) {
      const game = new Chess(puzzle.fen);
      game.move(wrong);
      game.move(chooseMove(game.fen())!);
      assert.equal(game.isCheckmate(), true, `${puzzle.fen} ${wrong}`);
    }
    for (const escape of puzzle.solutions) {
      const game = new Chess(puzzle.fen);
      game.move(escape);
      const reply = chooseMove(game.fen());
      assert.ok(reply);
      assert.doesNotThrow(() => game.move(reply));
    }
  }
  assert.equal(chooseMove('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1'), null);
});

void test('win games run the player clock only on the player turn and end on checkmate', (t) => {
  const network = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Win mode must work offline');
  });
  const puzzle = getDaily(day);
  let game = createWinGame(puzzle, now, 'game-1');
  assert.equal(game.side, new Chess(puzzle.fen).turn());
  assert.equal(winClock(game, now + 2500), 2500);
  assert.throws(() => playWinMove(game, { from: 'a1', to: 'a1' }, now + 100));

  game = playWinMove(game, move(puzzle.solutions[0]), now + 2500);
  assert.equal(game.status, 'playing');
  assert.equal(isPlayerTurn(game), false);
  assert.equal(winClock(game, now + 60000), 2500);
  // Moving out of turn is ignored.
  assert.equal(playWinMove(game, move(puzzle.solutions[0]), now + 3000), game);

  const reply = chooseMove(game.fen)!;
  game = playComputerMove(game, reply, now + 9000);
  assert.equal(isPlayerTurn(game), true);
  assert.equal(winClock(game, now + 10000), 3500);
  assert.equal(playerMoveCount(game), 1);
  assert.equal(network.mock.callCount(), 0);

  const mate = createWinGame(
    { day, fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1' },
    now,
  );
  const finished = playWinMove(mate, move('a1a8'), now + 1234);
  assert.equal(finished.status, 'won');
  assert.equal(finished.reason, 'checkmate');
  assert.equal(finished.elapsedMs, 1234);
  assert.equal(winClock(finished, now + 99999), 1234);
});

void test('computer checkmates, draws and resignations end the game without recording a win', () => {
  const wrong = getDaily(day);
  const bad = Object.keys(wrong.refutations)[0];
  let game = playWinMove(createWinGame(wrong, now), move(bad), now + 500);
  game = playComputerMove(game, chooseMove(game.fen)!, now + 900);
  assert.equal(game.status, 'lost');
  assert.equal(game.reason, 'checkmate');

  const stalemate = playWinMove(
    createWinGame({ day, fen: '7k/8/5Q2/8/8/8/8/6K1 w - - 0 1' }, now),
    move('f6g6'),
    now + 10,
  );
  assert.equal(stalemate.status, 'draw');
  assert.equal(stalemate.reason, 'stalemate');

  const resigned = resignWinGame(createWinGame(wrong, now), now + 4000);
  assert.equal(resigned.status, 'lost');
  assert.equal(resigned.reason, 'resigned');
  assert.equal(resigned.elapsedMs, 4000);
  assert.deepEqual(recordWinGame(emptyWinProgress(), resigned).wins, []);
});

void test('win progress keeps the fastest win per day and survives a reload', () => {
  const fen = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
  const win = (elapsed: number) =>
    playWinMove(createWinGame({ day, fen }, now), move('a1a8'), now + elapsed);
  let progress = recordWinGame(emptyWinProgress(), win(9000));
  progress = recordWinGame(progress, win(4000));
  progress = recordWinGame(progress, win(7000));
  assert.equal(progress.wins.length, 1);
  assert.equal(bestWin(progress, day)!.elapsedMs, 4000);
  assert.equal(progress.game!.elapsedMs, 7000);

  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
  };
  const active = recordWinGame(progress, createWinGame({ day, fen }, now));
  saveWinProgress(storage, active);
  assert.deepEqual(readWinProgress(storage), active);
  // A tampered move list that no longer reaches the saved position is rejected.
  storage.setItem(
    WIN_PROGRESS_KEY,
    JSON.stringify({ ...active, game: { ...active.game, moves: ['a1a8'] } }),
  );
  assert.equal(readWinProgress(storage), null);
  storage.setItem(WIN_PROGRESS_KEY, 'broken');
  assert.equal(readWinProgress(storage), null);
});

void test('count-up clock formatting', () => {
  assert.equal(formatClock(0), '0:00.00');
  assert.equal(formatClock(61234), '1:01.23');
  assert.equal(formatClock(3600000), '60:00.00');
});
