import type { Attempt, DailyChallenge } from './contracts';
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(data.error ?? 'Could not connect. Please try again.');
  return data;
}
export const getChallenge = () => api<DailyChallenge>('/api/daily');
export const startAttempt = () =>
  api<{ attempt: Attempt }>('/api/attempt/start', {});
export const sendMove = (attemptId: string, move: string) =>
  api<{ attempt: Attempt }>('/api/attempt/submit', { attemptId, move });
