import { database } from '@/server/database';
import {
  getDaily,
  currentAttempt,
  publicAttempt,
  rateLimit,
  utcDay,
} from '@/server/service';
import { json, player, validOrigin, ipKey } from '@/server/http';
export async function POST(request: Request) {
  if (!validOrigin(request))
    return json(
      request,
      { error: 'This request must come from Chesscape.' },
      403,
    );
  const client = player(request);
  if (!client)
    return json(request, { error: 'Please refresh Chesscape to begin.' }, 401);
  try {
    const db = database();
    const day = utcDay();
    await getDaily(db, day);
    let row = await currentAttempt(db, client, day);
    if (!row) {
      if (
        !(await rateLimit(db, 'start:' + (await ipKey(request)), 15, 86400000))
      )
        return json(
          request,
          {
            error:
              'Too many new attempts from this network. Come back tomorrow.',
          },
          429,
        );
      const now = Date.now();
      await db
        .prepare(
          'INSERT OR IGNORE INTO attempts (id,client,day,started_at,expires_at,status) VALUES (?,?,?,?,?,?)',
        )
        .bind(crypto.randomUUID(), client, day, now, now + 30000, 'playing')
        .run();
      row = await currentAttempt(db, client, day);
    }
    // Re-read after insertion; the pinned puzzle cannot change once an attempt exists.
    const puzzle = await getDaily(db, day);
    return json(request, { attempt: publicAttempt(row!, puzzle) });
  } catch {
    return json(
      request,
      { error: 'Could not start your escape. Please try again.' },
      503,
    );
  }
}
