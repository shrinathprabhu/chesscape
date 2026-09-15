import { Chess } from 'chess.js';
// SERVER ONLY. Never import this module from a client component.
// Original training compositions. Every non-escape legal move permits mate in one.
const originals = [
  '5rk1/pp3ppp/3b4/1b6/6nq/2N5/RPP2PPP/3Q1RK1 w - - 0 1',
  '5rk1/pp3ppp/3b4/1b6/6nq/2N5/RPP2PPP/5RK1 w - - 0 1',
  '5rk1/pp3ppp/8/1b6/6n1/2N4q/PPP2PPP/R4RK1 w - - 0 1',
  '5rk1/pp3ppp/3b4/1b6/3P2nq/2N5/RPP2PPP/5RK1 w - - 0 1',
];
export function mateReply(game: Chess): string | null {
  for (const move of game.moves({ verbose: true })) {
    game.move(move);
    const mate = game.isCheckmate();
    game.undo();
    if (mate) return move.lan;
  }
  return null;
}
export function escapeMoves(fen: string): string[] {
  const game = new Chess(fen);
  if (game.isGameOver()) return [];
  return game
    .moves({ verbose: true })
    .filter((move) => {
      game.move(move);
      const safe = mateReply(game) === null;
      game.undo();
      return safe;
    })
    .map((move) => move.lan);
}
export function originalPuzzle(day: string) {
  const n = Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
  const base = originals[n % originals.length];
  const board = base.split(' ')[0];
  // Mirror files and/or invert ranks and colors, preserving the chess proof.
  const rows = board.split('/').map((row) => row.split(''));
  if (Math.floor(n / 4) % 2) rows.forEach((row) => row.reverse());
  const invert = Math.floor(n / 8) % 2 === 1;
  if (invert) {
    rows.reverse();
    rows.forEach((row) =>
      row.forEach((p, i) => {
        if (/[a-z]/i.test(p))
          row[i] = p === p.toUpperCase() ? p.toLowerCase() : p.toUpperCase();
      }),
    );
  }
  const fen =
    rows.map((row) => row.join('')).join('/') +
    ` ${invert ? 'b' : 'w'} - - 0 1`;
  const answers = escapeMoves(fen);
  return {
    fen,
    answers,
    source: 'Chesscape original',
    sourceId: null as string | null,
    escapeCount: answers.length,
  };
}
