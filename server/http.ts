const cookieName = 'chesscape_player';
export function player(request: Request) {
  const match = request.headers
    .get('cookie')
    ?.match(/(?:^|;\s*)chesscape_player=([a-f0-9-]{36})(?:;|$)/);
  return match?.[1] ?? null;
}
export function json(
  request: Request,
  data: unknown,
  status = 200,
  newClient?: string,
) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Cookie',
  });
  if (newClient)
    headers.set(
      'Set-Cookie',
      `${cookieName}=${newClient}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
    );
  return new Response(JSON.stringify(data), { status, headers });
}
export function validOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
export async function ipKey(request: Request) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(new Date().toISOString().slice(0, 10) + ':' + ip),
  );
  return Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

export async function limitedBody(
  request: Request,
  maxBytes = 256,
): Promise<string | null> {
  if (Number(request.headers.get('content-length')) > maxBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '',
    total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
