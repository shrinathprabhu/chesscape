import { getDaily, utcDay, FIRST_DAY } from '@/server/service';
import { noStore, puzzleCacheHeaders } from '@/lib/http-cache';

export async function GET(request: Request) {
  const today = utcDay();
  const params = new URL(request.url).searchParams;
  const requested = params.get('day');
  const day = requested ?? today;
  if (
    params.getAll('day').length > 1 ||
    [...params.keys()].some((key) => key !== 'day') ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(Date.parse(day)) ||
    utcDay(Date.parse(day)) !== day ||
    day > today
  )
    return Response.json(
      { error: 'That puzzle date is not available.' },
      { status: 400, headers: noStore },
    );
  try {
    if (day < FIRST_DAY) throw new Error('PUZZLE_NOT_FOUND');
    const puzzle = getDaily(day);
    // Browser state is local; only this shared puzzle crosses the network once.
    return Response.json(puzzle, {
      headers: {
        ...puzzleCacheHeaders(
          day === today ? puzzle.resetsAt : Date.now() + 86400000,
        ),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
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
      { status: missing ? 404 : 503, headers: noStore },
    );
  }
}
