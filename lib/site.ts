// One canonical identity, with a build-time mount path for Lowkey's shared domain.
export const CANONICAL_URL = 'https://lowkey.tools/chesscape';
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const appPath = (path: string) => `${BASE_PATH}${path}`;
export const SITE_TITLE = 'Chesscape — Daily Chess Escape Puzzle in 30 Seconds';
export const SITE_DESCRIPTION =
  'Play a free daily chess puzzle: find one of the 1–2 moves that avoids immediate checkmate in 30 seconds. Retry until you escape, then return after midnight UTC.';
