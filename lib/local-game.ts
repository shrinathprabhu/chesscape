import { Chess } from 'chess.js';
import type { Attempt, LocalProgress, PuzzlePayload, Stats } from './contracts';

export const PROGRESS_KEY = 'chesscape-progress-v2';
export const nextMidnight = (now: number) =>
  (Math.floor(now / 86400000) + 1) * 86400000;
export function createAttempt(
  puzzle: PuzzlePayload,
  now = Date.now(),
  id = crypto.randomUUID(),
): Attempt {
  return {
    id,
    day: puzzle.day,
    fen: puzzle.fen,
    status: 'playing',
    startedAt: now,
    expiresAt: now + 30000,
    updatedAt: now,
    elapsedMs: null,
    move: null,
    reply: null,
  };
}
export function expireAttempt(attempt: Attempt, now = Date.now()): Attempt {
  if (attempt.status !== 'playing' || now < attempt.expiresAt) return attempt;
  return { ...attempt, status: 'timeout', elapsedMs: 30000, updatedAt: now };
}
// No fetch, promises, or engine search: the puzzle brings its answers and mating replies.
export function commitMove(
  puzzle: PuzzlePayload,
  attempt: Attempt,
  move: { from: string; to: string; promotion?: string },
  now = Date.now(),
): Attempt {
  if (attempt.status !== 'playing') return attempt;
  const expired = expireAttempt(attempt, now);
  if (expired !== attempt) return expired;
  const game = new Chess(attempt.fen);
  const played = game.move(move);
  const won = puzzle.solutions.includes(played.lan);
  const reply = won ? null : (puzzle.refutations[played.lan] ?? null);
  if (reply) game.move(reply);
  return {
    ...attempt,
    fen: game.fen(),
    status: won ? 'won' : 'lost',
    elapsedMs: Math.max(0, now - attempt.startedAt),
    updatedAt: now,
    move: played.san,
    reply,
  };
}
export function recordAttempt(
  progress: LocalProgress,
  attempt: Attempt,
): LocalProgress {
  const history =
    attempt.status === 'playing'
      ? progress.history
      : [
          {
            day: attempt.day,
            status: attempt.status,
            elapsedMs: attempt.elapsedMs,
            completedAt: attempt.updatedAt,
          },
          ...progress.history.filter((result) => result.day !== attempt.day),
        ].slice(0, 366);
  return {
    ...progress,
    day: attempt.day,
    attempt,
    history,
    nextAvailableAt:
      attempt.status === 'won' ? nextMidnight(attempt.updatedAt) : null,
  };
}
export function needsNewPuzzle(
  progress: LocalProgress | null,
  now = Date.now(),
) {
  return (
    !progress ||
    (progress.attempt?.status === 'won' &&
      now >=
        (progress.nextAvailableAt ?? nextMidnight(progress.attempt.updatedAt)))
  );
}
export function progressStats(
  progress: LocalProgress | null,
  now = Date.now(),
): Stats {
  const history = progress?.history ?? [];
  const wins = history.filter((result) => result.status === 'won');
  let streak = 0,
    expected = Math.floor(now / 86400000);
  const days = new Set(
    wins.map((result) => Math.floor(result.completedAt / 86400000)),
  );
  if (!days.has(expected)) expected--;
  while (days.has(expected)) {
    streak++;
    expected--;
  }
  return {
    played: history.length,
    won: wins.length,
    bestMs: wins.length
      ? Math.min(...wins.map((result) => result.elapsedMs ?? 30000))
      : null,
    streak,
    recent: history.slice(0, 7),
  };
}
export function readProgress(
  storage: Pick<Storage, 'getItem'>,
): LocalProgress | null {
  try {
    const value = JSON.parse(
      storage.getItem(PROGRESS_KEY) ?? 'null',
    ) as LocalProgress | null;
    if (
      !value ||
      value.version !== 2 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.day) ||
      !Array.isArray(value.history)
    )
      return null;
    if (
      value.nextAvailableAt !== null &&
      !Number.isFinite(value.nextAvailableAt)
    )
      return null;
    if (
      value.history.some(
        (result) =>
          !result ||
          !/^\d{4}-\d{2}-\d{2}$/.test(result.day) ||
          !['won', 'lost', 'timeout'].includes(result.status) ||
          !Number.isFinite(result.completedAt) ||
          (result.elapsedMs !== null && !Number.isFinite(result.elapsedMs)),
      )
    )
      return null;
    if (value.attempt) {
      const a = value.attempt;
      if (
        a.day !== value.day ||
        !['playing', 'won', 'lost', 'timeout'].includes(a.status) ||
        !Number.isFinite(a.startedAt) ||
        !Number.isFinite(a.expiresAt) ||
        !Number.isFinite(a.updatedAt)
      )
        return null;
      new Chess(a.fen);
    }
    return value;
  } catch {
    return null;
  }
}
export function saveProgress(
  storage: Pick<Storage, 'setItem'>,
  progress: LocalProgress,
) {
  // Only progress is persisted. Solutions and reply maps remain in the active page's memory.
  storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}
