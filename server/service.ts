import { originalPuzzle, lichessCandidate, evaluate } from './chess';
import type { Attempt, Stats } from '../lib/contracts';
export interface DailyRow {
  day: string;
  fen: string;
  answers: string;
  source: string;
  source_id: string | null;
  escape_count: number;
}
export interface AttemptRow {
  id: string;
  client: string;
  day: string;
  started_at: number;
  expires_at: number;
  status: Attempt['status'];
  elapsed_ms: number | null;
  move: string | null;
  result_fen: string | null;
  reply: string | null;
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
  const fallback = originalPuzzle(day);
  const claimed = await db
    .prepare(
      'INSERT OR IGNORE INTO daily (day,fen,answers,source,source_id,escape_count) VALUES (?,?,?,?,?,?)',
    )
    .bind(
      day,
      fallback.fen,
      JSON.stringify(fallback.answers),
      fallback.source,
      null,
      fallback.escapeCount,
    )
    .run();
  // The unique UTC date is a durable single-flight lock: at most one upstream request/day.
  if (claimed.meta.changes === 1) {
    try {
      const response = await fetch('https://lichess.org/api/puzzle/daily', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2500),
      });
      if (response.ok) {
        const candidate = lichessCandidate(await response.json());
        if (candidate) {
          await db
            .prepare(
              'UPDATE daily SET fen=?,answers=?,source=?,source_id=?,escape_count=? WHERE day=? AND NOT EXISTS (SELECT 1 FROM attempts WHERE day=?)',
            )
            .bind(
              candidate.fen,
              JSON.stringify(candidate.answers),
              candidate.source,
              candidate.sourceId,
              candidate.escapeCount,
              day,
              day,
            )
            .run();
        }
      }
    } catch {
      /* A checked original is already pinned if Lichess is unavailable or unsuitable. */
    }
    await db
      .prepare('DELETE FROM rate_limits WHERE expires < ?')
      .bind(Date.now())
      .run();
  }
  return (await db
    .prepare('SELECT * FROM daily WHERE day=?')
    .bind(day)
    .first<DailyRow>())!;
}
export function publicAttempt(
  row: AttemptRow,
  puzzle: DailyRow,
  now = Date.now(),
): Attempt {
  return {
    id: row.id,
    day: row.day,
    fen: row.result_fen ?? puzzle.fen,
    status: row.status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    serverNow: now,
    elapsedMs: row.elapsed_ms,
    move: row.move,
    reply: row.reply,
  };
}
export async function currentAttempt(
  db: D1Database,
  client: string,
  day: string,
) {
  await db
    .prepare(
      "UPDATE attempts SET status='timeout',elapsed_ms=30000 WHERE client=? AND day=? AND status='playing' AND expires_at<=?",
    )
    .bind(client, day, Date.now())
    .run();
  return db
    .prepare('SELECT * FROM attempts WHERE client=? AND day=?')
    .bind(client, day)
    .first<AttemptRow>();
}
export async function statistics(
  db: D1Database,
  client: string,
): Promise<Stats> {
  await db
    .prepare(
      "UPDATE attempts SET status='timeout',elapsed_ms=30000 WHERE client=? AND status='playing' AND expires_at<=?",
    )
    .bind(client, Date.now())
    .run();
  const summary = await db
    .prepare(
      "SELECT COUNT(*) AS played, COALESCE(SUM(status='won'),0) AS won, MIN(CASE WHEN status='won' THEN elapsed_ms END) AS bestMs FROM attempts WHERE client=? AND status!='playing'",
    )
    .bind(client)
    .first<{ played: number; won: number; bestMs: number | null }>();
  const { results } = await db
    .prepare(
      "SELECT day,status,elapsed_ms AS elapsedMs FROM attempts WHERE client=? AND status!='playing' ORDER BY day DESC LIMIT 366",
    )
    .bind(client)
    .all<{ day: string; status: string; elapsedMs: number | null }>();
  let streak = 0;
  let expected = utcDay();
  if (!results.some((r) => r.day === expected))
    expected = utcDay(Date.now() - 86400000);
  for (const row of results) {
    if (row.day !== expected || row.status !== 'won') break;
    streak++;
    expected = utcDay(Date.parse(expected + 'T00:00:00Z') - 86400000);
  }
  return { ...summary!, streak, recent: results.slice(0, 7) };
}
export async function rateLimit(
  db: D1Database,
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
) {
  const bucket = key + ':' + Math.floor(now / windowMs);
  const count = await db
    .prepare(
      'INSERT INTO rate_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
    )
    .bind(bucket, now + windowMs)
    .first<{ count: number }>();
  return !!count && count.count <= max;
}
export async function submitAttempt(
  db: D1Database,
  client: string,
  id: string,
  uci: string,
  now = Date.now(),
) {
  const row = await db
    .prepare('SELECT * FROM attempts WHERE id=? AND client=?')
    .bind(id, client)
    .first<AttemptRow>();
  if (!row) return { error: 'Attempt not found.', code: 404 };
  const puzzle = await db
    .prepare('SELECT * FROM daily WHERE day=?')
    .bind(row.day)
    .first<DailyRow>();
  if (!puzzle) throw new Error('Missing puzzle');
  if (row.status !== 'playing')
    return { attempt: publicAttempt(row, puzzle, now) };
  const elapsed = Math.max(0, now - row.started_at);
  const timedOut = now >= row.expires_at;
  const result = timedOut
    ? null
    : evaluate(puzzle.fen, uci, JSON.parse(puzzle.answers));
  if (!timedOut && !result)
    return {
      error: 'That move is not legal. Choose a highlighted square.',
      code: 400,
    };
  // Compare-and-swap consumes the attempt exactly once, including concurrent submissions.
  await db
    .prepare(
      "UPDATE attempts SET status=?,elapsed_ms=?,move=?,result_fen=?,reply=? WHERE id=? AND client=? AND status='playing'",
    )
    .bind(
      timedOut ? 'timeout' : result!.won ? 'won' : 'lost',
      Math.min(30000, elapsed),
      result?.move ?? null,
      result?.fen ?? puzzle.fen,
      result?.reply ?? null,
      id,
      client,
    )
    .run();
  const committed = (await db
    .prepare('SELECT * FROM attempts WHERE id=? AND client=?')
    .bind(id, client)
    .first<AttemptRow>())!;
  return { attempt: publicAttempt(committed, puzzle, now) };
}
