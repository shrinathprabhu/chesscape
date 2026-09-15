import puzzleData from './puzzles-v1.json';
import type { PuzzlePayload } from '../lib/contracts';

export const utcDay = (now = Date.now()) =>
  new Date(now).toISOString().slice(0, 10);
export const nextDay = (day: string) =>
  Date.parse(day + 'T00:00:00Z') + 86400000;
const puzzles: Omit<PuzzlePayload, 'day' | 'number' | 'resetsAt'>[] =
  puzzleData.map((puzzle) => ({
    ...puzzle,
    refutations: Object.fromEntries(
      Object.entries(puzzle.refutations).filter(
        ([, reply]) => typeof reply === 'string',
      ),
    ),
  }));
export const FIRST_DAY = '2026-09-01';

// Keep v1 ordering and length fixed. Future packs need a dated cutover so saved
// days continue to select their original position after a deployment.
export function getDaily(day: string): PuzzlePayload {
  const time = Date.parse(day + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(time) ||
    utcDay(time) !== day ||
    day < FIRST_DAY
  )
    throw new Error('PUZZLE_NOT_FOUND');
  const index = Math.floor(time / 86400000) % puzzles.length;
  return {
    ...structuredClone(puzzles[index]),
    day,
    number: Math.floor((time - Date.parse(FIRST_DAY)) / 86400000) + 1,
    resetsAt: nextDay(day),
  };
}
