export type AttemptStatus = 'playing' | 'won' | 'lost' | 'timeout';
export interface Attempt {
  id: string;
  day: string;
  fen: string;
  status: AttemptStatus;
  startedAt: number;
  expiresAt: number;
  updatedAt: number;
  elapsedMs: number | null;
  move: string | null;
  reply: string | null;
}
export interface PuzzlePayload {
  day: string;
  number: number;
  fen: string;
  solutions: string[];
  refutations: Record<string, string>;
  escapeCount: number;
  source: string;
  resetsAt: number;
}
export interface DailyChallenge extends PuzzlePayload {
  attempt: Attempt | null;
  stats: Stats;
}
export interface Stats {
  played: number;
  won: number;
  bestMs: number | null;
  streak: number;
  recent: { day: string; status: string; elapsedMs: number | null }[];
}
export interface LocalProgress {
  version: 2;
  day: string;
  attempt: Attempt | null;
  nextAvailableAt: number | null;
  history: {
    day: string;
    status: AttemptStatus;
    elapsedMs: number | null;
    completedAt: number;
  }[];
}
