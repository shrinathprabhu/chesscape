import { database } from '@/server/database';
import {
  getDaily,
  currentAttempt,
  publicAttempt,
  statistics,
  utcDay,
  nextDay,
} from '@/server/service';
import { json, player } from '@/server/http';
export async function GET(request: Request) {
  try {
    const db = database();
    const existing = player(request);
    const client = existing ?? crypto.randomUUID();
    const day = utcDay();
    const puzzle = await getDaily(db, day);
    const row = await currentAttempt(db, client, day);
    return json(
      request,
      {
        day,
        number: Math.max(
          1,
          Math.floor((Date.parse(day) - Date.parse('2026-09-01')) / 86400000) +
            1,
        ),
        escapeCount: puzzle.escape_count,
        source: puzzle.source,
        resetsAt: nextDay(day),
        attempt: row ? publicAttempt(row, puzzle) : null,
        stats: await statistics(db, client),
      },
      200,
      existing ? undefined : client,
    );
  } catch (error) {
    console.error(
      'Daily unavailable',
      error instanceof Error ? error.message : 'unknown',
    );
    return json(
      request,
      { error: 'The daily escape is taking a moment. Please try again.' },
      503,
    );
  }
}
