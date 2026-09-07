import { database } from '@/server/database';
import { submitAttempt, rateLimit } from '@/server/service';
import { json, player, validOrigin, limitedBody } from '@/server/http';
export async function POST(request: Request) {
  const receivedAt = Date.now();
  if (!validOrigin(request))
    return json(
      request,
      { error: 'This request must come from Chesscape.' },
      403,
    );
  const client = player(request);
  if (!client)
    return json(request, { error: 'Please refresh Chesscape.' }, 401);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return json(request, { error: 'Expected a move.' }, 415);
  try {
    const body = await limitedBody(request);
    if (body === null)
      return json(request, { error: 'Move request is too large.' }, 413);
    const data = JSON.parse(body);
    if (
      typeof data.attemptId !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(data.attemptId) ||
      typeof data.move !== 'string' ||
      !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(data.move)
    )
      return json(request, { error: 'Choose a valid move.' }, 400);
    const db = database();
    if (!(await rateLimit(db, 'submit:' + client, 20, 60000)))
      return json(
        request,
        { error: 'Please wait a moment before trying again.' },
        429,
      );
    const result = await submitAttempt(
      db,
      client,
      data.attemptId,
      data.move,
      receivedAt,
    );
    if ('error' in result)
      return json(request, { error: result.error }, result.code);
    return json(request, result);
  } catch {
    return json(
      request,
      { error: 'Could not verify your move. Reconnect to see your result.' },
      503,
    );
  }
}
