import { Chess } from 'chess.js';
import type { PuzzlePayload } from './contracts';

// Win mode: the daily position, played out to the end against the on-device engine.
// The clock counts up from zero and only runs while it is the player's move.
export const WIN_PROGRESS_KEY = 'chesscape-win-v1';
export type WinStatus = 'playing' | 'won' | 'lost' | 'draw';
export type WinReason =
  | 'checkmate'
  | 'stalemate'
  | 'repetition'
  | 'insufficient'
  | 'fifty-moves'
  | 'resigned'
  | null;
export interface WinGame {
  id: string;
  day: string;
  startFen: string;
  fen: string;
  side: 'w' | 'b';
  moves: string[];
  status: WinStatus;
  reason: WinReason;
  startedAt: number;
  updatedAt: number;
  /** Player thinking time banked from completed turns. */
  elapsedMs: number;
  /** When the player's current turn began; null while the computer moves or after the game. */
  turnStartedAt: number | null;
}
export interface WinResult {
  day: string;
  elapsedMs: number;
  moves: number;
  completedAt: number;
}
export interface WinProgress {
  version: 1;
  game: WinGame | null;
  /** Fastest win per puzzle day, newest first. */
  wins: WinResult[];
}
export const emptyWinProgress = (): WinProgress => ({
  version: 1,
  game: null,
  wins: [],
});

export function createWinGame(
  puzzle: Pick<PuzzlePayload, 'day' | 'fen'>,
  now = Date.now(),
  id = crypto.randomUUID(),
): WinGame {
  return {
    id,
    day: puzzle.day,
    startFen: puzzle.fen,
    fen: puzzle.fen,
    side: new Chess(puzzle.fen).turn(),
    moves: [],
    status: 'playing',
    reason: null,
    startedAt: now,
    updatedAt: now,
    elapsedMs: 0,
    turnStartedAt: now,
  };
}
export const winClock = (game: WinGame, now = Date.now()) =>
  game.elapsedMs +
  (game.turnStartedAt === null ? 0 : Math.max(0, now - game.turnStartedAt));
/** Moves the player made, counting the opening escape. */
export const playerMoveCount = (game: WinGame) =>
  Math.ceil(game.moves.length / 2);
export const isPlayerTurn = (game: WinGame) =>
  game.status === 'playing' && new Chess(game.fen).turn() === game.side;

function replay(game: WinGame) {
  const chess = new Chess(game.startFen);
  for (const move of game.moves) chess.move(move);
  return chess;
}
function outcome(chess: Chess, moverIsPlayer: boolean) {
  if (chess.isCheckmate())
    return {
      status: (moverIsPlayer ? 'won' : 'lost') as WinStatus,
      reason: 'checkmate' as WinReason,
    };
  const reason: WinReason = chess.isStalemate()
    ? 'stalemate'
    : chess.isThreefoldRepetition()
      ? 'repetition'
      : chess.isInsufficientMaterial()
        ? 'insufficient'
        : chess.isDrawByFiftyMoves()
          ? 'fifty-moves'
          : null;
  return reason
    ? { status: 'draw' as WinStatus, reason }
    : { status: 'playing' as WinStatus, reason: null };
}
/** Applies the player's move. Throws on illegal moves and leaves the game untouched. */
export function playWinMove(
  game: WinGame,
  move: { from: string; to: string; promotion?: string },
  now = Date.now(),
): WinGame {
  if (!isPlayerTurn(game)) return game;
  const chess = replay(game);
  const played = chess.move(move);
  const elapsedMs = winClock(game, now);
  return {
    ...game,
    fen: chess.fen(),
    moves: [...game.moves, played.lan],
    ...outcome(chess, true),
    elapsedMs,
    turnStartedAt: null,
    updatedAt: now,
  };
}
/** Applies the computer's reply and restarts the player's clock. */
export function playComputerMove(
  game: WinGame,
  uci: string,
  now = Date.now(),
): WinGame {
  if (game.status !== 'playing' || isPlayerTurn(game)) return game;
  const chess = replay(game);
  const played = chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4],
  });
  const result = outcome(chess, false);
  return {
    ...game,
    fen: chess.fen(),
    moves: [...game.moves, played.lan],
    ...result,
    turnStartedAt: result.status === 'playing' ? now : null,
    updatedAt: now,
  };
}
export function resignWinGame(game: WinGame, now = Date.now()): WinGame {
  if (game.status !== 'playing') return game;
  return {
    ...game,
    status: 'lost',
    reason: 'resigned',
    elapsedMs: winClock(game, now),
    turnStartedAt: null,
    updatedAt: now,
  };
}
export function recordWinGame(
  progress: WinProgress,
  game: WinGame,
): WinProgress {
  if (game.status !== 'won') return { ...progress, game };
  const result: WinResult = {
    day: game.day,
    elapsedMs: game.elapsedMs,
    moves: playerMoveCount(game),
    completedAt: game.updatedAt,
  };
  const previous = progress.wins.find((win) => win.day === game.day);
  const best =
    previous && previous.elapsedMs <= result.elapsedMs ? previous : result;
  return {
    ...progress,
    game,
    wins: [best, ...progress.wins.filter((win) => win.day !== game.day)]
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, 366),
  };
}
export const bestWin = (progress: WinProgress, day?: string) =>
  progress.wins
    .filter((win) => day === undefined || win.day === day)
    .reduce<WinResult | null>(
      (best, win) => (!best || win.elapsedMs < best.elapsedMs ? win : best),
      null,
    );

export function readWinProgress(
  storage: Pick<Storage, 'getItem'>,
): WinProgress | null {
  try {
    const value = JSON.parse(
      storage.getItem(WIN_PROGRESS_KEY) ?? 'null',
    ) as WinProgress | null;
    if (!value || value.version !== 1 || !Array.isArray(value.wins))
      return null;
    if (
      value.wins.some(
        (win) =>
          !win ||
          !/^\d{4}-\d{2}-\d{2}$/.test(win.day) ||
          !Number.isFinite(win.elapsedMs) ||
          !Number.isFinite(win.moves) ||
          !Number.isFinite(win.completedAt),
      )
    )
      return null;
    const game = value.game;
    if (game) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(game.day) ||
        !['playing', 'won', 'lost', 'draw'].includes(game.status) ||
        !Array.isArray(game.moves) ||
        !Number.isFinite(game.elapsedMs) ||
        !(game.turnStartedAt === null || Number.isFinite(game.turnStartedAt))
      )
        return null;
      // Replaying proves the saved move list is legal and matches the position.
      if (replay(game).fen() !== game.fen) return null;
    }
    return value;
  } catch {
    return null;
  }
}
export function saveWinProgress(
  storage: Pick<Storage, 'setItem'>,
  progress: WinProgress,
) {
  storage.setItem(WIN_PROGRESS_KEY, JSON.stringify(progress));
}
/** m:ss.cc for count-up clocks. */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 10));
  const minutes = Math.floor(total / 6000);
  const secs = Math.floor(total / 100) % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}.${String(total % 100).padStart(2, '0')}`;
}
