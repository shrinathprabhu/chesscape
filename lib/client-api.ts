import type { PuzzlePayload } from './contracts';
import { appPath } from './site';
export async function getChallenge(day?: string): Promise<PuzzlePayload> {
  const response = await fetch(
    appPath('/api/daily') + (day ? '?day=' + encodeURIComponent(day) : ''),
    {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = (await response.json()) as PuzzlePayload & { error?: string };
  if (!response.ok)
    throw new Error(
      data.error ?? 'Could not load your puzzle. Please try again.',
    );
  if (
    !data.fen ||
    !Array.isArray(data.solutions) ||
    !data.solutions.length ||
    !data.refutations
  )
    throw new Error('The puzzle could not be loaded. Please refresh.');
  return data;
}
