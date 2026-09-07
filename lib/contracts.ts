export type AttemptStatus = 'playing' | 'won' | 'lost' | 'timeout';
export interface Attempt {
  id: string;
  day: string;
  fen: string;
  status: AttemptStatus;
  startedAt: number;
  expiresAt: number;
  serverNow: number;
  elapsedMs: number | null;
  move: string | null;
  reply: string | null;
}
export interface DailyChallenge {
  day: string;
  number: number;
  escapeCount: number;
  source: string;
  resetsAt: number;
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
