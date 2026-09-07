import { originalPuzzle, lichessCandidate, mateReply } from './chess';
import { Chess } from 'chess.js';
import type { PuzzlePayload } from '../lib/contracts';
export interface DailyRow {
  day: string;
  fen: string;
  answers: string;
  source: string;
  source_id: string | null;
  escape_count: number;
}
export const utcDay = (now = Date.now()) =>
  new Date(now).toISOString().slice(0, 10);
export const nextDay = (day: string) =>
  Date.parse(day + 'T00:00:00Z') + 86400000;
export async function getDaily(db: D1Database, day: string): Promise<DailyRow> {
  const existing = await db
    .prepare('SELECT * FROM daily WHERE day = ?')
    .bind(day)
    .first<DailyRow>();
  if (existing) return existing;
  let selected = originalPuzzle(day);
  const claimed = await db
    .prepare(
      'INSERT OR IGNORE INTO rate_limits (key,count,expires) VALUES (?,1,?)',
    )
    .bind(`daily:${day}`, nextDay(day))
    .run();
  // Only the winner checks upstream. A concurrent request may publish an original
  // first; INSERT OR IGNORE below makes the published position immutable for everyone.
  if (claimed.meta.changes === 1) {
    try {
      const response = await fetch('https://lichess.org/api/puzzle/daily', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2500),
      });
      if (response.ok) {
        const candidate = lichessCandidate(await response.json());
        if (candidate) selected = candidate;
      }
    } catch {
      /* Use a checked original if Lichess is unavailable or unsuitable. */
    }
    await db
      .prepare('DELETE FROM rate_limits WHERE expires < ?')
      .bind(Date.parse(day))
      .run();
  }
  await db
    .prepare(
      'INSERT OR IGNORE INTO daily (day,fen,answers,source,source_id,escape_count) VALUES (?,?,?,?,?,?)',
    )
    .bind(
      day,
      selected.fen,
      JSON.stringify(selected.answers),
      selected.source,
      selected.sourceId ?? null,
      selected.escapeCount,
    )
    .run();
  return (await db
    .prepare('SELECT * FROM daily WHERE day=?')
    .bind(day)
    .first<DailyRow>())!;
}
export function publicPuzzle(puzzle: DailyRow): PuzzlePayload {
  const solutions = JSON.parse(puzzle.answers) as string[];
  const game = new Chess(puzzle.fen);
  const refutations: Record<string, string> = {};
  for (const move of game.moves({ verbose: true })) {
    if (solutions.includes(move.lan)) continue;
    game.move(move);
    const reply = mateReply(game);
    game.undo();
    if (reply) refutations[move.lan] = reply;
  }
  return {
    day: puzzle.day,
    number: Math.max(
      1,
      Math.floor(
        (Date.parse(puzzle.day) - Date.parse('2026-09-01')) / 86400000,
      ) + 1,
    ),
    fen: puzzle.fen,
    solutions,
    refutations,
    escapeCount: solutions.length,
    source: puzzle.source,
    resetsAt: nextDay(puzzle.day),
  };
}
