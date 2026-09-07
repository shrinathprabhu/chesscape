import { database } from '@/server/database';
import {
  getDaily,
  publicPuzzle,
  utcDay,
  type DailyRow,
} from '@/server/service';
import type { PuzzlePayload } from '@/lib/contracts';

// Puzzle responses contain no player data and can be shared across visitors.
const cached = new Map<string, Promise<PuzzlePayload>>();
export async function GET(request: Request) {
  const today = utcDay();
  const requested = new URL(request.url).searchParams.get('day');
  const day = requested ?? today;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(Date.parse(day)) ||
    utcDay(Date.parse(day)) !== day ||
    day > today
  )
    return Response.json(
      { error: 'That puzzle date is not available.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  try {
    let loading = cached.get(day);
    if (!loading) {
      loading = (async () => {
        const db = database();
        const row =
          day === today
            ? await getDaily(db, day)
            : await db
                .prepare('SELECT * FROM daily WHERE day=?')
                .bind(day)
                .first<DailyRow>();
        if (!row) throw new Error('PUZZLE_NOT_FOUND');
        return publicPuzzle(row);
      })();
      cached.set(day, loading);
      if (cached.size > 32) cached.delete(cached.keys().next().value!);
    }
    const puzzle = await loading;
    // Browser state is local; only this shared puzzle crosses the network once.
    const ttl =
      day === today
        ? Math.max(0, Math.floor((puzzle.resetsAt - Date.now()) / 1000))
        : 86400;
    return Response.json(puzzle, {
      headers: {
        'Cache-Control': `public, max-age=0, s-maxage=${ttl}`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    cached.delete(day);
    const missing =
      error instanceof Error && error.message === 'PUZZLE_NOT_FOUND';
    if (!missing)
      console.error(
        'Daily unavailable',
        error instanceof Error ? error.message : 'unknown',
      );
    return Response.json(
      {
        error: missing
          ? 'Your saved puzzle is unavailable. Please try again later.'
          : 'Could not load your escape. Please try again.',
      },
      { status: missing ? 404 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
