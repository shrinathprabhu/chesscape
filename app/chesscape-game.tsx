'use client';
/* oxlint-disable next/no-img-element -- Local SVG pieces and generated Blob previews do not need image optimization. */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, DEFAULT_POSITION, type Square } from 'chess.js';
import {
  ArrowUpRight,
  ArrowRight,
  CircleHelp,
  ChartNoAxesColumnIncreasing,
  Download,
  Clock3,
  ShieldCheck,
  Zap,
  Volume2,
  VolumeX,
  RotateCw,
  MoveUpRight,
  Check,
  Copy,
  Share2,
  Trophy,
  Flame,
  WifiOff,
  LoaderCircle,
  Smartphone,
  X,
  Swords,
  Flag,
  Bot,
  Lock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getChallenge } from '@/lib/client-api';
import {
  createAttempt,
  commitMove,
  expireAttempt,
  needsNewPuzzle,
  progressStats,
  readProgress,
  recordAttempt,
  saveProgress,
} from '@/lib/local-game';
import {
  createShareImage,
  createWinShareImage,
  downloadBlob,
  shareText,
  winShareText,
} from '@/lib/share';
import { ENGINE_DEPTH, chooseMove } from '@/lib/engine';
import {
  bestWin,
  createWinGame,
  emptyWinProgress,
  formatClock,
  playComputerMove,
  playWinMove,
  playerMoveCount,
  readWinProgress,
  recordWinGame,
  resignWinGame,
  saveWinProgress,
  winClock,
  type WinGame,
  type WinProgress,
} from '@/lib/win-game';
import type { Attempt, DailyChallenge, LocalProgress } from '@/lib/contracts';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
type Modal = 'how' | 'stats' | 'install' | 'share' | null;
type Mode = 'escape' | 'win';
const drawReasons: Record<string, string> = {
  stalemate: 'stalemate',
  repetition: 'threefold repetition',
  insufficient: 'insufficient material',
  'fifty-moves': 'the fifty-move rule',
};
const names: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};
const badgeFor = (ms: number) =>
  ms < 5000
    ? 'Lightning escape'
    : ms < 15000
      ? 'Cool under pressure'
      : 'Clutch escape';
function seconds(ms: number) {
  return (ms / 1000).toFixed(2);
}
// Computer replies wait briefly so they read as a move, not a flicker.
const COMPUTER_DELAY_MS = 450;

export default function ChesscapeGame({
  children,
}: {
  children: React.ReactNode;
}) {
  const [daily, setDaily] = useState<DailyChallenge | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(30000);
  const [selected, setSelected] = useState<Square | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [sound, setSound] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const [online, setOnline] = useState(true);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [focusedSquare, setFocusedSquare] = useState('a8');
  const [mode, setMode] = useState<Mode>('escape');
  const [winProgress, setWinProgress] = useState<WinProgress>(emptyWinProgress);
  const [clockNow, setClockNow] = useState(0);
  const [shareKind, setShareKind] = useState<Mode>('escape');
  const winRef = useRef<WinProgress>(emptyWinProgress());
  const deadline = useRef(0);
  const operation = useRef(false);
  const progressRef = useRef<LocalProgress | null>(null);
  const restored = useRef(false);
  const lastRefresh = useRef(0);
  const attemptRef = useRef<Attempt | null>(null);
  const dailyRef = useRef<DailyChallenge | null>(null);
  const [shareBlob, setShareBlob] = useState<Blob | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const boardRef = useRef<HTMLFieldSetElement | null>(null);

  const playing = attempt?.status === 'playing';
  const done = !!attempt && !playing;
  const won = attempt?.status === 'won';
  const winMode = mode === 'win';
  // Win mode unlocks once today's escape is solved, so it never spoils the timed puzzle.
  const win =
    daily && winProgress.game?.day === daily.day ? winProgress.game : null;
  const winPlaying = win?.status === 'playing';
  const winDone = !!win && !winPlaying;
  const winWon = win?.status === 'won';
  const computerTurn =
    !!win && winPlaying && new Chess(win.fen).turn() !== win.side;
  const boardFen = winMode
    ? (win?.fen ?? (won ? daily?.fen : undefined))
    : attempt?.fen;
  const canMove = winMode ? winPlaying && !computerTurn : playing;
  const game = useMemo(
    () => new Chess(boardFen ?? DEFAULT_POSITION),
    [boardFen],
  );
  const initialSide = useMemo(
    () => new Chess(daily?.fen ?? DEFAULT_POSITION).turn(),
    [daily?.fen],
  );
  const legal = useMemo(
    () =>
      canMove && selected
        ? game.moves({ square: selected, verbose: true })
        : [],
    [game, selected, canMove],
  );
  const squares = useMemo(() => {
    const list = Array.from(
      { length: 64 },
      (_, i) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}` as Square,
    );
    return flipped ? list.reverse() : list;
  }, [flipped]);

  const notify = useCallback((message: string) => setNotice(message), []);
  const acceptAttempt = useCallback((value: Attempt) => {
    if (!progressRef.current || !dailyRef.current) return;
    const progress = recordAttempt(progressRef.current, value);
    progressRef.current = progress;
    attemptRef.current = value;
    setAttempt(value);
    setNow(Date.now());
    const challenge = {
      ...dailyRef.current,
      attempt: value,
      stats: progressStats(progress),
      resetsAt: progress.nextAvailableAt ?? dailyRef.current.resetsAt,
    };
    dailyRef.current = challenge;
    setDaily(challenge);
    deadline.current =
      performance.now() + Math.max(0, value.expiresAt - Date.now());
    setRemaining(Math.max(0, value.expiresAt - Date.now()));
    setSelected(null);
    setPromotion(null);
    try {
      saveProgress(localStorage, progress);
    } catch {
      setNotice(
        'Browser storage is unavailable. Keep this tab open to keep your progress.',
      );
    }
  }, []);
  const acceptWin = useCallback((value: WinGame) => {
    const progress = recordWinGame(winRef.current, value);
    winRef.current = progress;
    setWinProgress(progress);
    setClockNow(Date.now());
    setSelected(null);
    setPromotion(null);
    try {
      saveWinProgress(localStorage, progress);
    } catch {
      setNotice(
        'Browser storage is unavailable. Keep this tab open to keep your game.',
      );
    }
  }, []);
  const refresh = useCallback(
    async (manual = false) => {
      if (operation.current) return;
      if (!restored.current) {
        restored.current = true;
        try {
          progressRef.current = readProgress(localStorage);
          const saved = readWinProgress(localStorage);
          if (saved) {
            winRef.current = saved;
            setWinProgress(saved);
          }
        } catch {}
      }
      const progress = progressRef.current;
      if (dailyRef.current && !needsNewPuzzle(progress)) {
        const current = attemptRef.current;
        if (current) {
          const expired = expireAttempt(current);
          if (expired !== current) acceptAttempt(expired);
        }
        return;
      }
      // An unfinished Win game keeps its puzzle until it ends or the player moves on.
      const activeWin = winRef.current.game;
      if (
        !manual &&
        dailyRef.current &&
        activeWin?.status === 'playing' &&
        activeWin.day === dailyRef.current.day
      )
        return;
      operation.current = true;
      lastRefresh.current = Date.now();
      setBusy(true);
      try {
        const puzzle = await getChallenge(
          needsNewPuzzle(progress) ? undefined : progress?.day,
        );
        let next: LocalProgress = {
          version: 2,
          day: puzzle.day,
          history: progress?.history ?? [],
          attempt: progress?.day === puzzle.day ? progress.attempt : null,
          nextAvailableAt:
            progress?.day === puzzle.day ? progress.nextAvailableAt : null,
        };
        if (next.attempt)
          next = recordAttempt(next, expireAttempt(next.attempt));
        progressRef.current = next;
        const value: DailyChallenge = {
          ...puzzle,
          attempt: next.attempt,
          stats: progressStats(next),
          resetsAt: next.nextAvailableAt ?? puzzle.resetsAt,
        };
        dailyRef.current = value;
        setDaily(value);
        setLoadError('');
        try {
          saveProgress(localStorage, next);
        } catch {
          setNotice(
            'Browser storage is unavailable. Keep this tab open to keep your progress.',
          );
        }
        if (value.attempt) {
          acceptAttempt(value.attempt);
          setFlipped(new Chess(puzzle.fen).turn() === 'b');
        } else {
          attemptRef.current = null;
          setAttempt(null);
          setRemaining(30000);
          setSelected(null);
          setPromotion(null);
        }
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Could not load today’s escape.',
        );
      } finally {
        operation.current = false;
        setBusy(false);
      }
    },
    [acceptAttempt],
  );
  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
      setOnline(navigator.onLine);
      setNow(Date.now());
      try {
        setSound(localStorage.getItem('chesscape-sound') !== 'off');
      } catch {}
      setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    });
    const onOnline = () => {
      setOnline(true);
      void refresh();
    };
    const onOffline = () => setOnline(false);
    const onFocus = () => {
      if (document.visibilityState === 'visible' && !operation.current)
        void refresh();
    };
    const install = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    const complete = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', complete);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator)
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {});
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('beforeinstallprompt', install);
      window.removeEventListener('appinstalled', complete);
    };
  }, [refresh]);
  useEffect(() => {
    if (!won) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [won]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const current = attemptRef.current;
      if (!current || current.status !== 'playing') return;
      const value = Math.max(
        0,
        Math.min(
          deadline.current - performance.now(),
          current.expiresAt - Date.now(),
        ),
      );
      setRemaining(value);
      if (value === 0)
        acceptAttempt(
          expireAttempt(current, Math.max(Date.now(), current.expiresAt)),
        );
    }, 100);
    return () => clearInterval(timer);
  }, [playing, acceptAttempt]);
  useEffect(() => {
    if (
      !won ||
      !daily ||
      !now ||
      now < daily.resetsAt ||
      !online ||
      now - lastRefresh.current < 30000
    )
      return;
    queueMicrotask(() => void refresh());
  }, [now, daily, won, online, refresh]);
  useEffect(
    () => () => {
      if (shareUrl) URL.revokeObjectURL(shareUrl);
    },
    [shareUrl],
  );
  useEffect(() => {
    if (!winPlaying) return;
    const tick = window.setInterval(() => setClockNow(Date.now()), 100);
    return () => window.clearInterval(tick);
  }, [winPlaying]);

  const playTone = useCallback(
    (success?: boolean) => {
      if (!sound) return;
      try {
        const context = audioContext.current ?? new AudioContext();
        audioContext.current = context;
        void context.resume();
        const notes = success
          ? [523, 659, 784]
          : success === false
            ? [220, 164]
            : [420];
        notes.forEach((hz, i) => {
          const o = context.createOscillator();
          const gain = context.createGain();
          o.type = 'sine';
          o.frequency.value = hz;
          gain.gain.setValueAtTime(0.035, context.currentTime + i * 0.11);
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            context.currentTime + i * 0.11 + 0.16,
          );
          o.connect(gain);
          gain.connect(context.destination);
          o.start(context.currentTime + i * 0.11);
          o.stop(context.currentTime + i * 0.11 + 0.17);
        });
      } catch {}
    },
    [sound],
  );
  const toneRef = useRef(playTone);
  useEffect(() => {
    toneRef.current = playTone;
  });
  useEffect(() => {
    if (!win || !computerTurn) return;
    const timer = window.setTimeout(() => {
      const current = winRef.current.game;
      if (current?.id !== win.id || current.fen !== win.fen) return;
      const reply = chooseMove(current.fen);
      if (!reply) return;
      const value = playComputerMove(current, reply);
      acceptWin(value);
      toneRef.current(value.status === 'lost' ? false : undefined);
    }, COMPUTER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [win, computerTurn, acceptWin]);
  function startWin() {
    const puzzle = dailyRef.current;
    const current = winRef.current.game;
    if (
      !puzzle ||
      attemptRef.current?.status !== 'won' ||
      (current?.status === 'playing' && current.day === puzzle.day)
    )
      return;
    const value = createWinGame(puzzle);
    acceptWin(value);
    setFlipped(value.side === 'b');
    playTone();
  }
  function resignWin() {
    const current = winRef.current.game;
    if (current?.status !== 'playing') return;
    acceptWin(resignWinGame(current));
    playTone(false);
  }
  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setSelected(null);
    setPromotion(null);
  }
  function start() {
    if (
      operation.current ||
      !dailyRef.current ||
      attemptRef.current?.status === 'playing' ||
      attemptRef.current?.status === 'won'
    )
      return;
    const value = createAttempt(dailyRef.current);
    acceptAttempt(value);
    setFlipped(new Chess(value.fen).turn() === 'b');
    playTone();
  }
  const commit = useCallback(
    (from: Square, to: Square, promote?: string) => {
      if (!dailyRef.current || attemptRef.current?.status !== 'playing') return;
      try {
        const current = attemptRef.current;
        const value = commitMove(dailyRef.current, current, {
          from,
          to,
          promotion: promote,
        });
        acceptAttempt(value);
        playTone(value.status === 'won');
      } catch {
        notify('That move is not legal. Choose a highlighted square.');
      }
    },
    [acceptAttempt, playTone, notify],
  );
  const commitWin = useCallback(
    (from: Square, to: Square, promote?: string) => {
      const current = winRef.current.game;
      if (current?.status !== 'playing') return;
      try {
        const value = playWinMove(current, { from, to, promotion: promote });
        acceptWin(value);
        playTone(value.status === 'won' ? true : undefined);
      } catch {
        notify('That move is not legal. Choose a highlighted square.');
      }
    },
    [acceptWin, playTone, notify],
  );
  const choose = useCallback(
    (square: Square, dragFrom?: Square) => {
      if (!canMove || busy) return;
      const from = dragFrom ?? selected;
      if (from && from !== square) {
        const moves = game
          .moves({ square: from, verbose: true })
          .filter((m) => m.to === square);
        if (moves.length) {
          if (moves.some((m) => m.promotion)) {
            setPromotion({ from, to: square });
            return;
          }
          if (winMode) commitWin(from, square);
          else commit(from, square);
          return;
        }
      }
      const piece = game.get(square);
      if (piece?.color === game.turn()) {
        setSelected(from === square ? null : square);
        playTone();
      } else setSelected(null);
    },
    [canMove, busy, selected, game, commit, commitWin, winMode, playTone],
  );
  async function openShare(kind: Mode = 'escape') {
    if (!daily || (kind === 'escape' ? !won || !attempt : !winWon || !win))
      return;
    setShareKind(kind);
    setShareBlob(null);
    setShareUrl(null);
    setModal('share');
    setShareBusy(true);
    try {
      const blob =
        kind === 'win' && win
          ? await createWinShareImage(win, daily.number)
          : await createShareImage(attempt!, daily.number);
      setShareBlob(blob);
      setShareUrl(URL.createObjectURL(blob));
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'Could not create your share image.',
      );
    } finally {
      setShareBusy(false);
    }
  }
  const currentShareText = () =>
    !daily
      ? null
      : shareKind === 'win'
        ? win && winShareText(win, daily.number)
        : attempt && shareText(attempt, daily.number);
  const shareFileName =
    shareKind === 'win'
      ? `chesscape-win-${win?.day}.png`
      : `chesscape-${attempt?.day}.png`;
  async function copyShare() {
    const text = currentShareText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify('Your escape is copied. Go claim those bragging rights.');
    } catch {
      notify('Copy is unavailable here. You can download your result image.');
    }
  }
  async function nativeShare() {
    const text = currentShareText();
    if (!shareBlob || !text) return;
    const file = new File([shareBlob], shareFileName, {
      type: 'image/png',
    });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title:
            shareKind === 'win'
              ? 'I beat the computer in Chesscape'
              : 'I escaped Chesscape',
          text,
        });
      } else {
        await copyShare();
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError')
        notify('Sharing was unavailable. Download your result instead.');
    }
  }
  async function installApp() {
    if (installed) {
      notify('Chesscape is already installed.');
      return;
    }
    if (!installEvent) {
      setModal('install');
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setInstallEvent(null);
  }
  function toggleSound() {
    setSound((value) => {
      try {
        localStorage.setItem('chesscape-sound', value ? 'off' : 'on');
      } catch {}
      return !value;
    });
  }

  const actions = useRef({ start, commit });
  useEffect(() => {
    actions.current = { start, commit };
  });
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const register = (tool: unknown) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'read_chesscape_challenge',
      description:
        'Read the current Chesscape state. Position is only available after the timed attempt begins. No solutions are returned.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => ({
        day: dailyRef.current?.day,
        status: attemptRef.current?.status ?? 'ready',
        attempt: attemptRef.current,
      }),
    });
    register({
      name: 'start_chesscape_attempt',
      description:
        'Start or retry this puzzle with a fresh 30-second local timer. Solved puzzles unlock the next day.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: () => {
        if (
          attemptRef.current?.status === 'playing' ||
          attemptRef.current?.status === 'won'
        )
          throw new Error('The puzzle is already in progress or solved.');
        actions.current.start();
        if (!attemptRef.current)
          throw new Error('The attempt could not start.');
        return attemptRef.current;
      },
    });
    register({
      name: 'submit_chesscape_move',
      description:
        'Commit one legal chess move and return the immediate local result. A wrong move ends this try; the same puzzle can be retried.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', pattern: '^[a-h][1-8]$' },
          to: { type: 'string', pattern: '^[a-h][1-8]$' },
          promotion: { type: 'string', enum: ['q', 'r', 'b', 'n'] },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input: unknown) => {
        const data = input as {
          from?: string;
          to?: string;
          promotion?: string;
        };
        if (
          !data ||
          !/^[a-h][1-8]$/.test(data.from ?? '') ||
          !/^[a-h][1-8]$/.test(data.to ?? '') ||
          (data.promotion && !/^[qrbn]$/.test(data.promotion))
        )
          throw new Error('Invalid move format.');
        if (attemptRef.current?.status !== 'playing')
          throw new Error('No active attempt.');
        const g = new Chess(attemptRef.current.fen);
        g.move({ from: data.from!, to: data.to!, promotion: data.promotion });
        actions.current.commit(
          data.from as Square,
          data.to as Square,
          data.promotion,
        );
        return attemptRef.current;
      },
    });
    return () => controller.abort();
  }, []);
  // The 64-square board is reused while timer digits tick; only board state redraws it.
  const kingInCheck = useMemo(() => game.isCheck(), [game]);
  const lastMove = winMode ? win?.moves.at(-1) : undefined;
  const board = useMemo(
    () => (
      <fieldset
        className="chessboard"
        ref={boardRef}
        aria-label={
          winMode
            ? win
              ? `Chessboard. You play ${win.side === 'w' ? 'white' : 'black'} against the computer.`
              : 'Win mode chessboard. Start a game to play.'
            : attempt
              ? `Chessboard. ${initialSide === 'w' ? 'White' : 'Black'} to escape.`
              : 'Concealed challenge. Start to reveal the position.'
        }
      >
        {squares.map((square, index) => {
          const piece = game.get(square);
          const isLegal = legal.some((move) => move.to === square);
          const isSelected = selected === square;
          const inCheck =
            !!piece &&
            piece.type === 'k' &&
            piece.color === game.turn() &&
            kingInCheck;
          const light =
            (Number(square[1]) + 'abcdefgh'.indexOf(square[0])) % 2 === 0;
          const isLast =
            !!lastMove &&
            (lastMove.slice(0, 2) === square ||
              lastMove.slice(2, 4) === square);
          return (
            <button
              key={square}
              className={`square ${light ? 'light-square' : 'dark-square'} ${isSelected ? 'selected-square' : ''} ${isLegal ? 'legal-square' : ''} ${inCheck ? 'check-square' : ''} ${isLast ? 'last-move-square' : ''}`}
              aria-label={`${square}${piece ? `, ${piece.color === 'w' ? 'white' : 'black'} ${names[piece.type]}` : ', empty'}${isLegal ? ', legal destination' : ''}${inCheck ? ', in check' : ''}`}
              aria-pressed={isSelected}
              aria-disabled={!canMove || busy}
              tabIndex={
                (winMode ? win : attempt) && square === focusedSquare ? 0 : -1
              }
              data-square={square}
              onFocus={() => setFocusedSquare(square)}
              onClick={() => choose(square)}
              onKeyDown={(event) => {
                const offsets: Record<string, number> = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -8,
                  ArrowDown: 8,
                };
                if (event.key === 'Escape') {
                  setSelected(null);
                  return;
                }
                if (event.key in offsets) {
                  event.preventDefault();
                  const next =
                    squares[
                      Math.max(0, Math.min(63, index + offsets[event.key]))
                    ];
                  setFocusedSquare(next);
                  boardRef.current
                    ?.querySelector<HTMLButtonElement>(
                      `[data-square="${next}"]`,
                    )
                    ?.focus();
                }
              }}
              draggable={!!(canMove && !busy && piece?.color === game.turn())}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', square);
                event.dataTransfer.effectAllowed = 'move';
                setSelected(square);
              }}
              onDragOver={(event) => {
                if (canMove) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = event.dataTransfer.getData('text/plain');
                if (/^[a-h][1-8]$/.test(from)) choose(square, from as Square);
              }}
            >
              {index % 8 === 0 && (
                <span className="rank" aria-hidden="true">
                  {square[1]}
                </span>
              )}
              {index >= 56 && (
                <span className="file" aria-hidden="true">
                  {square[0]}
                </span>
              )}
              {piece && (
                <img
                  alt=""
                  draggable={false}
                  src={`/pieces/${piece.color}${piece.type.toUpperCase()}.svg`}
                  width={45}
                  height={45}
                />
              )}
              {isLegal && (
                <span
                  aria-hidden="true"
                  className={piece ? 'capture-ring' : 'move-dot'}
                />
              )}
            </button>
          );
        })}
      </fieldset>
    ),
    [
      attempt,
      win,
      winMode,
      lastMove,
      game,
      kingInCheck,
      initialSide,
      squares,
      legal,
      selected,
      canMove,
      busy,
      focusedSquare,
      choose,
    ],
  );
  const shownTime = done ? (attempt.elapsedMs ?? 30000) : remaining;
  const winShown = win ? winClock(win, Math.max(clockNow, win.updatedAt)) : 0;
  const [winMinutes, winRest] = formatClock(winShown).split(':');
  const [winSeconds, winFraction] = winRest.split('.');
  const winBest = daily ? bestWin(winProgress, daily.day) : null;
  const winBestEver = bestWin(winProgress);
  const winMoves = win ? playerMoveCount(win) : 0;
  const winResultText = !win
    ? ''
    : win.status === 'won'
      ? `Checkmate. You won in ${formatClock(win.elapsedMs)}.`
      : win.reason === 'resigned'
        ? 'You resigned. The position is waiting for a rematch.'
        : win.status === 'lost'
          ? 'Checkmated. The computer found its way through.'
          : `Draw by ${drawReasons[win.reason ?? ''] ?? 'agreement'}. Only checkmate wins.`;
  const timeParts = seconds(shownTime).split('.');
  const untilReset = daily && now ? Math.max(0, daily.resetsAt - now) : 0;
  const resetClock = `${String(Math.floor(untilReset / 3600000)).padStart(2, '0')}:${String(Math.floor(untilReset / 60000) % 60).padStart(2, '0')}:${String(Math.floor(untilReset / 1000) % 60).padStart(2, '0')}`;
  const dayLabel = daily
    ? new Date(daily.day + 'T12:00:00Z').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : 'Today';

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Chesscape home">
          <span className="brand-mark">
            <img src={'/pieces/wN.svg'} width={35} height={35} alt="" />
          </span>
          chesscape<span className="brand-period">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <button
            className="nav-item nav-active"
            onClick={() => {
              setModal(null);
              boardRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            }}
          >
            Daily challenge
          </button>
          <button
            className="nav-item"
            aria-label="How to play"
            onClick={() => setModal('how')}
          >
            <CircleHelp size={16} /> How to play
          </button>
          <button
            className="nav-item"
            aria-label="Your stats"
            onClick={() => setModal('stats')}
          >
            <ChartNoAxesColumnIncreasing size={16} /> Your stats
          </button>
        </nav>
        <button
          className="install-button"
          aria-label={installed ? 'App installed' : 'Install app'}
          onClick={() => void installApp()}
        >
          {installed ? <Check size={15} /> : <Download size={15} />}{' '}
          {installed ? 'Installed' : 'Install app'}
        </button>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="intro" aria-labelledby="page-heading">
          <div className="eyebrow">
            <span className="tiny-star">✳</span> YOUR DAILY MENTAL GETAWAY
          </div>
          <h1 id="page-heading">
            Your daily <em>chess escape.</em>
          </h1>
          <p>
            One chess puzzle. Thirty seconds. Find the move that escapes
            checkmate.
          </p>
          <p className="intro-credits">
            By{' '}
            <a
              href="https://shrinath.me"
              target="_blank"
              rel="noopener noreferrer"
            >
              Shrinath Prabhu
            </a>
            , creator of{' '}
            <a
              href="https://owleye.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              OwlEye Analytics
            </a>
            .
          </p>
        </section>
        {!online && (
          <output className="connection-banner">
            <WifiOff size={16} />{' '}
            {daily
              ? 'You’re offline. Your loaded escape is ready to play. Reconnect for the next puzzle.'
              : 'You’re offline. Reconnect to load your saved escape.'}
          </output>
        )}
        <fieldset className="mode-switch" aria-label="Game mode">
          <button
            className={`mode-tab ${!winMode ? 'mode-active' : ''}`}
            aria-pressed={!winMode}
            onClick={() => switchMode('escape')}
          >
            <ShieldCheck size={16} />
            <span>
              <strong>Escape</strong>
              <small>One move · 30 seconds</small>
            </span>
          </button>
          <button
            className={`mode-tab ${winMode ? 'mode-active' : ''}`}
            aria-pressed={winMode}
            disabled={playing}
            title={playing ? 'Finish this escape first.' : undefined}
            onClick={() => switchMode('win')}
          >
            {won ? <Swords size={16} /> : <Lock size={16} />}
            <span>
              <strong>Win it</strong>
              <small>
                {won
                  ? 'Beat the computer · no limit'
                  : 'Unlocks after your escape'}
              </small>
            </span>
          </button>
        </fieldset>
        <div className="game-layout">
          <section
            className={`board-column ${playing || winPlaying ? 'playing-column' : ''}`}
            aria-label="Daily chess puzzle"
          >
            <div className="board-top">
              <span className="player-label">
                <span
                  className={`player-dot ${initialSide === 'w' ? 'black-dot' : 'white-dot'}`}
                />{' '}
                {winMode ? (
                  <>
                    <Bot size={15} /> The computer
                    {computerTurn && (
                      <span className="your-turn thinking-tag">THINKING</span>
                    )}
                  </>
                ) : (
                  'The opponent'
                )}
              </span>
              <span className="mini-tag">
                {dayLabel} <span className="tag-divider">/</span>{' '}
                {winMode ? 'WIN IT' : 'THE DAILY ESCAPE'}
              </span>
              {winMode && winPlaying && (
                <span className="mobile-timer">
                  <Clock3 size={15} /> {formatClock(winShown)}
                </span>
              )}
              {!winMode && playing && (
                <span
                  className={`mobile-timer ${remaining < 10000 ? 'urgent' : ''}`}
                >
                  <Clock3 size={15} /> {seconds(remaining)}s
                </span>
              )}
            </div>
            <div
              className={`board-frame ${(winMode ? winPlaying : playing) ? 'is-playing' : ''} ${(winMode ? winWon : won) ? 'is-won' : ''}`}
            >
              {board}
              {winMode && !win && (
                <div className="board-cover">
                  <div className="start-card">
                    <span className="start-icon">
                      {won ? <Swords size={25} /> : <Lock size={25} />}
                    </span>
                    <h2>
                      {won ? (
                        <>
                          You escaped.
                          <br />
                          Now win it.
                        </>
                      ) : (
                        <>
                          Escape first.
                          <br />
                          Then win it.
                        </>
                      )}
                    </h2>
                    <p>
                      {won ? (
                        <>
                          Same position, played to the end.
                          <br />
                          Checkmate the computer, fast.
                        </>
                      ) : (
                        <>
                          Solve today’s one-move escape
                          <br />
                          to play it out against the computer.
                        </>
                      )}
                    </p>
                    {won ? (
                      <button className="primary-button" onClick={startWin}>
                        Start the game <ArrowRight size={17} />
                      </button>
                    ) : (
                      <button
                        className="primary-button"
                        onClick={() => switchMode('escape')}
                      >
                        Go to today’s escape <ArrowRight size={17} />
                      </button>
                    )}
                    <span className="start-caption">
                      <Clock3 size={12} />{' '}
                      {won
                        ? 'Clock starts at 0:00 and runs only on your move.'
                        : 'No spoilers: the position stays hidden until you start.'}
                    </span>
                  </div>
                </div>
              )}
              {winMode && winDone && (
                <output
                  className={`board-result ${winWon ? 'result-success' : ''}`}
                >
                  {winWon ? <Trophy size={19} /> : <Flag size={19} />}
                  <span>{winResultText}</span>
                </output>
              )}
              {!winMode && !attempt && (
                <div className="board-cover">
                  <div className="start-card">
                    <span className="start-icon">
                      <ShieldCheck size={25} />
                    </span>
                    <h2>
                      Keep your king.
                      <br />
                      Keep your cool.
                    </h2>
                    <p>
                      Checkmate is coming.
                      <br />
                      Find the move that stops it.
                    </p>
                    <button
                      className="primary-button"
                      disabled={busy || !daily}
                      onClick={start}
                    >
                      {busy ? (
                        <>
                          <LoaderCircle size={17} className="spin" /> Revealing
                          your escape…
                        </>
                      ) : daily ? (
                        <>
                          I’m ready. Let’s escape. <ArrowRight size={17} />
                        </>
                      ) : loadError ? (
                        'Challenge unavailable'
                      ) : (
                        <>
                          <LoaderCircle size={17} className="spin" /> Getting
                          today’s challenge…
                        </>
                      )}
                    </button>
                    {loadError ? (
                      <button
                        className="retry-link"
                        onClick={() => void refresh(true)}
                      >
                        Try again <RotateCw size={12} />
                      </button>
                    ) : (
                      <span className="start-caption">
                        <Clock3 size={12} /> Your 30 seconds start when you do.
                      </span>
                    )}
                  </div>
                </div>
              )}
              {!winMode && done && (
                <output
                  className={`board-result ${won ? 'result-success' : ''}`}
                >
                  {won ? <ShieldCheck size={19} /> : <Clock3 size={19} />}
                  <span>
                    {won
                      ? 'King safe. Nicely done.'
                      : attempt.status === 'timeout'
                        ? 'Time’s up. Take a breath and try again.'
                        : `Checkmate. ${attempt.move} left your king exposed.`}
                  </span>
                </output>
              )}
            </div>
            <div className="board-bottom">
              <span className="player-label">
                <span
                  className={`player-dot ${initialSide === 'w' ? 'white-dot' : 'black-dot'}`}
                />{' '}
                {winMode ? (
                  <>
                    {won
                      ? `You play ${initialSide === 'w' ? 'white' : 'black'}`
                      : 'Your color is revealed after your escape'}
                    {winPlaying && !computerTurn && (
                      <span className="your-turn">YOUR MOVE</span>
                    )}
                  </>
                ) : (
                  <>
                    {attempt
                      ? `You play ${initialSide === 'w' ? 'white' : 'black'}`
                      : 'Your color is revealed at the start'}
                    {playing && <span className="your-turn">YOUR MOVE</span>}
                  </>
                )}
              </span>
              <div className="board-actions">
                <button
                  aria-label={sound ? 'Turn sound off' : 'Turn sound on'}
                  title={sound ? 'Sound on' : 'Sound off'}
                  aria-pressed={sound}
                  onClick={toggleSound}
                >
                  {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
                </button>
                <button
                  aria-label="Flip board"
                  title="Flip board"
                  onClick={() => setFlipped((value) => !value)}
                >
                  <RotateCw size={17} />
                </button>
              </div>
            </div>
            <div className="board-instruction" aria-live="polite">
              {winMode ? (
                winPlaying ? (
                  computerTurn ? (
                    <>
                      The computer is choosing its move. Your clock is paused.
                    </>
                  ) : selected ? (
                    <>Choose a highlighted square to make your move.</>
                  ) : (
                    <>Your clock is running. Find the fastest way to mate.</>
                  )
                ) : winWon ? (
                  <>
                    {playerMoveCount(win)} moves.{' '}
                    <strong>{formatClock(win.elapsedMs)}</strong> on your clock.
                  </>
                ) : winDone ? (
                  <>Same starting position. Your clock resets to 0:00.</>
                ) : won ? (
                  <>No time limit. Just a clock that remembers.</>
                ) : (
                  <>Win mode opens once you solve today’s escape.</>
                )
              ) : playing ? (
                selected ? (
                  <>Choose a highlighted square to commit your move.</>
                ) : (
                  <>Click a piece, then its destination. Or drag to move.</>
                )
              ) : won ? (
                <>
                  {untilReset > 0 ? (
                    <>
                      Next escape in <strong>{resetClock}</strong>
                    </>
                  ) : (
                    <button
                      className="retry-link"
                      disabled={busy || !online}
                      onClick={() => void refresh(true)}
                    >
                      {busy
                        ? 'Loading your next escape…'
                        : online
                          ? 'Load your next escape'
                          : 'Reconnect for your next escape'}{' '}
                      <RotateCw size={12} />
                    </button>
                  )}
                </>
              ) : done ? (
                <>Same position. A fresh thirty seconds. Try another move.</>
              ) : (
                <>A small daily ritual. A very real ticking clock.</>
              )}
            </div>
          </section>
          {winMode ? (
            <aside className="challenge-column">
              <div className="challenge-heading">
                <span className="eyebrow">WIN IT FROM HERE</span>
                <span className="puzzle-number">
                  No. {daily ? String(daily.number).padStart(3, '0') : '—'}
                </span>
              </div>
              <h2>
                {winWon ? (
                  <>
                    Checkmate.
                    <br />
                    That’s a win.
                  </>
                ) : winDone ? (
                  <>
                    Not this time.
                    <br />
                    Run it back.
                  </>
                ) : !won ? (
                  <>
                    Escape first.
                    <br />
                    Then win it.
                  </>
                ) : (
                  <>
                    You survived.
                    <br />
                    Now finish it.
                  </>
                )}
              </h2>
              <p className="challenge-description">
                {winWon
                  ? 'From one move from mate to delivering it. Go again to shave off time.'
                  : winDone
                    ? 'Every game teaches the position a little better. Same board, fresh clock.'
                    : won
                      ? 'Start from today’s escape position and play until checkmate. The fastest win is the best win.'
                      : 'Win mode plays today’s position to the end. It opens once you find the escape.'}
              </p>
              <div className="challenge-tags">
                <span>
                  <Bot size={12} /> Computer · {ENGINE_DEPTH}-ply search
                </span>
                <span>
                  {winMoves} {winMoves === 1 ? 'move' : 'moves'}
                </span>
              </div>
              <div className={`timer-panel ${winWon ? 'timer-won' : ''}`}>
                <div className="timer-label">
                  <Clock3 size={15} />
                  <span>{winDone ? 'YOUR GAME TIME' : 'YOUR CLOCK'}</span>
                  <span className="timer-status">
                    {winWon
                      ? 'Checkmate'
                      : winDone
                        ? 'Try again'
                        : winPlaying
                          ? computerTurn
                            ? 'Paused'
                            : 'Running'
                          : 'Starts at 0:00'}
                  </span>
                </div>
                <div
                  className="timer-digits"
                  role="timer"
                  aria-label={`${formatClock(winShown)} on your clock`}
                >
                  {winMinutes.padStart(2, '0')}
                  <span>:</span>
                  {winSeconds}
                  <span className="timer-fraction">.{winFraction}</span>
                </div>
                <div className="timer-foot">
                  <span>
                    {winBest
                      ? `Your fastest win today: ${formatClock(winBest.elapsedMs)}`
                      : 'Only your moves count. No time limit.'}
                  </span>
                  <span>{winWon ? <Check size={13} /> : 'NO LIMIT'}</span>
                </div>
              </div>
              {!won ? (
                <div className="win-actions">
                  <button
                    className="primary-button"
                    onClick={() => switchMode('escape')}
                  >
                    <ShieldCheck size={17} /> Solve today’s escape first{' '}
                    <ArrowRight size={17} />
                  </button>
                  <p>Escape in one move, then play it out.</p>
                </div>
              ) : winPlaying ? (
                <div className="win-actions">
                  <button className="secondary-button wide" onClick={resignWin}>
                    <Flag size={16} /> Resign this game
                  </button>
                  <p>Stuck? Resign and restart from the escape position.</p>
                </div>
              ) : winWon ? (
                <div className="win-actions">
                  <button
                    className="primary-button"
                    onClick={() => void openShare('win')}
                  >
                    <Share2 size={17} /> Share your win{' '}
                    <ArrowUpRight size={17} />
                  </button>
                  <button className="secondary-button wide" onClick={startWin}>
                    <RotateCw size={16} /> Play again for a faster win
                  </button>
                </div>
              ) : (
                <div className="win-actions">
                  <button className="primary-button" onClick={startWin}>
                    {win ? <RotateCw size={17} /> : <Swords size={17} />}{' '}
                    {win ? 'Try again from the start' : 'Start the game'}{' '}
                    <ArrowRight size={17} />
                  </button>
                  <p>Same position. Your clock starts at 0:00.</p>
                </div>
              )}
            </aside>
          ) : (
            <aside className="challenge-column">
              <div className="challenge-heading">
                <span className="eyebrow">YOUR DAILY CHALLENGE</span>
                <span className="puzzle-number">
                  No. {daily ? String(daily.number).padStart(3, '0') : '—'}
                </span>
              </div>
              <h2>
                {won ? (
                  <>
                    Now that’s
                    <br />
                    an escape.
                  </>
                ) : done ? (
                  <>
                    Every great player
                    <br />
                    gets cornered.
                  </>
                ) : (
                  <>
                    A tight spot.
                    <br />A brilliant way out.
                  </>
                )}
              </h2>
              <p className="challenge-description">
                {won ? (
                  'A clear head. A clever move. Your king lives to see another day.'
                ) : done ? (
                  'One move doesn’t define your game. Take a breath. Your escape is still here.'
                ) : (
                  <>
                    Your king is one move from trouble.
                    <br />
                    Find the escape before time runs out.
                  </>
                )}
              </p>
              <div className="challenge-tags">
                <span>
                  <span className="difficulty-dots">▂▄▆</span>{' '}
                  {won
                    ? badgeFor(attempt.elapsedMs ?? 30000)
                    : 'Tactical escape'}
                </span>
                <span>
                  {daily?.escapeCount ?? '1–2'} escape{' '}
                  {daily?.escapeCount === 1 ? 'move' : 'moves'}
                </span>
              </div>
              <div
                className={`timer-panel ${playing && remaining < 10000 ? 'timer-urgent' : ''} ${won ? 'timer-won' : ''}`}
              >
                <div className="timer-label">
                  <Clock3 size={15} />
                  <span>{done ? 'YOUR ESCAPE TIME' : 'TIME TO ESCAPE'}</span>
                  <span className="timer-status">
                    {won
                      ? 'Nicely done'
                      : done
                        ? 'Try again'
                        : playing
                          ? remaining < 10000
                            ? 'You’ve got this.'
                            : 'Clock is ticking'
                          : 'Ready when you are'}
                  </span>
                </div>
                <div
                  className="timer-digits"
                  role="timer"
                  aria-label={`${seconds(shownTime)} seconds ${done ? 'elapsed' : 'remaining'}`}
                >
                  00<span>:</span>
                  {timeParts[0].padStart(2, '0')}
                  <span className="timer-fraction">.{timeParts[1]}</span>
                </div>
                <div className="timer-track">
                  <div
                    style={{
                      width: `${done ? (won ? 100 : 0) : remaining / 300}%`,
                    }}
                  />
                </div>
                <div className="timer-foot">
                  <span>
                    {won
                      ? 'One move. A well-earned deep breath.'
                      : playing
                        ? 'Trust your eyes. Find your move.'
                        : done
                          ? 'Take a breath. Give it another try.'
                          : 'Take a breath. Then take your shot.'}
                  </span>
                  <span>{won ? <Check size={13} /> : '30 SEC'}</span>
                </div>
              </div>
              {won ? (
                <div className="win-actions">
                  <button
                    className="primary-button"
                    onClick={() => void openShare('escape')}
                  >
                    <Share2 size={17} /> Share your escape{' '}
                    <ArrowUpRight size={17} />
                  </button>
                  <p>Your board. Your time. Your bragging rights.</p>
                </div>
              ) : done ? (
                <div className="win-actions">
                  <button className="primary-button" onClick={start}>
                    <RotateCw size={17} /> Try this escape again{' '}
                    <ArrowRight size={17} />
                  </button>
                  <p>Same puzzle. A fresh 30 seconds. You’ve got this.</p>
                </div>
              ) : (
                <div className="rules-compact">
                  <div>
                    <span className="rule-icon">
                      <MoveUpRight size={19} />
                    </span>
                    <p>
                      <strong>Thirty seconds per try.</strong>
                      <span>Keep this puzzle until you find your way out.</span>
                    </p>
                  </div>
                  <div>
                    <span className="rule-icon">
                      <Zap size={18} />
                    </span>
                    <p>
                      <strong>
                        Quick thinking. Well-earned bragging rights.
                      </strong>
                      <span>Solve it. Get your time. Share your escape.</span>
                    </p>
                  </div>
                </div>
              )}
              <div className="daily-note">
                <span className="note-star">✳</span>
                <p>
                  A little chess. A little adrenaline.
                  <br />
                  <strong>A fresh escape, every day.</strong>
                </p>
                <ArrowUpRight size={20} />
              </div>
            </aside>
          )}
        </div>
        <div className="under-game">
          <span>
            <ShieldCheck size={15} /> Finish this escape. The next one can wait.
          </span>
          <span>Solve it to unlock the next escape at 00:00 UTC.</span>
        </div>
        {children}
      </main>
      <footer>
        <span>
          A small move from{' '}
          <a href="https://lowkey.tools" target="_blank" rel="noreferrer">
            lowkey.tools <ArrowUpRight size={12} />
          </a>
        </span>
        <span className="creator-credit">
          <span>
            Your daily escape, by{' '}
            <a
              href="https://shrinath.me"
              target="_blank"
              rel="noopener noreferrer"
            >
              Shrinath Prabhu
            </a>
          </span>
          <span className="credit-divider" aria-hidden="true">
            ·
          </span>
          <span>
            Also behind{' '}
            <a
              href="https://owleye.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              OwlEye Analytics <ArrowUpRight size={12} />
            </a>
          </span>
        </span>
        <button
          className="preview-label footer-button"
          onClick={() => setModal('how')}
        >
          <i /> {daily?.source ?? 'One daily escape'} <CircleHelp size={12} />
        </button>
      </footer>
      {notice && (
        <output className="notice-toast">
          <span>{notice}</span>
          <button
            onClick={() => setNotice('')}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </output>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent
          className={`chesscape-modal ${modal === 'share' ? 'share-modal' : ''}`}
        >
          <DialogTitle>
            {modal === 'how'
              ? 'Your daily great escape.'
              : modal === 'stats'
                ? 'A little better, every day.'
                : modal === 'install'
                  ? 'A home for your daily escape.'
                  : shareKind === 'win'
                    ? 'Some wins are worth sharing.'
                    : 'Some escapes are worth sharing.'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'how'
              ? 'One position. Thirty seconds per try.'
              : modal === 'stats'
                ? 'Your Chesscape history on this browser.'
                : modal === 'install'
                  ? 'Add Chesscape to your home screen for a little chess, every day.'
                  : shareKind === 'win'
                    ? 'Checkmate delivered. Take your final board and your time with you.'
                    : 'You earned this one. Take your board and your time with you.'}
          </DialogDescription>
          {modal === 'how' && (
            <div className="how-content">
              <ol>
                <li>
                  <span>01</span>
                  <div>
                    <strong>Take a breath. Hit start.</strong>
                    <p>
                      The board is revealed and your unpausable 30-second timer
                      begins.
                    </p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Find the move that keeps you alive.</strong>
                    <p>
                      Only one or two legal moves avoid checkmate on the
                      opponent’s next turn. Click a piece and a destination, or
                      drag it.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Make it count.</strong>
                    <p>
                      A legal move is your final answer. Escape in time to earn
                      a share card. A wrong move or the clock reaching zero ends
                      this try. Start again with the same position and a fresh
                      timer.
                    </p>
                  </div>
                </li>
                <li>
                  <span>04</span>
                  <div>
                    <strong>Then, win it.</strong>
                    <p>
                      Once you escape, switch to Win it and play the same
                      position to the end against the computer. Your clock
                      starts at 0:00, runs only on your move and has no limit.
                      Checkmate wins; a loss, draw or resignation lets you
                      restart. Your fastest win is kept.
                    </p>
                  </div>
                </li>
              </ol>
              <div className="modal-note">
                <ShieldCheck size={19} />
                <p>
                  Your moves react instantly on this device. Refreshing keeps
                  the clock running. An unfinished puzzle stays with you across
                  visits. Solve it, then return after midnight UTC for the next
                  escape.
                </p>
              </div>
              <p className="source-note">
                Today’s puzzle is a verified Chesscape original from a rotating
                collection. Once loaded, your puzzle works offline in this tab.
                Reconnect when reopening the app or loading your next escape.
              </p>
              <button className="primary-button" onClick={() => setModal(null)}>
                Got it. Keep my king safe. <ArrowRight size={16} />
              </button>
            </div>
          )}
          {modal === 'stats' && (
            <div className="stats-content">
              <div className="stats-grid">
                <div>
                  <strong>{daily?.stats.played ?? 0}</strong>
                  <span>Played</span>
                </div>
                <div>
                  <strong>{daily?.stats.won ?? 0}</strong>
                  <span>Escaped</span>
                </div>
                <div>
                  <strong>
                    {daily?.stats.streak ?? 0}
                    <Flame size={18} />
                  </strong>
                  <span>Day streak</span>
                </div>
              </div>
              <div className="personal-best">
                <Trophy size={24} />
                <div>
                  <span>YOUR QUICKEST ESCAPE</span>
                  <strong>
                    {daily?.stats.bestMs != null
                      ? `${seconds(daily.stats.bestMs)} seconds`
                      : 'Your first escape awaits.'}
                  </strong>
                </div>
              </div>
              <div className="personal-best">
                <Swords size={24} />
                <div>
                  <span>
                    YOUR QUICKEST WIN
                    {winProgress.wins.length
                      ? ` · ${winProgress.wins.length} ${winProgress.wins.length === 1 ? 'PUZZLE' : 'PUZZLES'} WON`
                      : ''}
                  </span>
                  <strong>
                    {winBestEver
                      ? `${formatClock(winBestEver.elapsedMs)} in ${winBestEver.moves} moves`
                      : 'Escape, then beat the computer.'}
                  </strong>
                </div>
              </div>
              <h3>Recent escapes</h3>
              {daily?.stats.recent.length ? (
                <div className="history-list">
                  {daily.stats.recent.map((result) => (
                    <div key={result.day}>
                      <span>
                        {new Date(result.day + 'T12:00:00Z').toLocaleDateString(
                          'en-US',
                          { month: 'short', day: 'numeric', timeZone: 'UTC' },
                        )}
                      </span>
                      <span
                        className={result.status === 'won' ? 'history-won' : ''}
                      >
                        {result.status === 'won'
                          ? 'Escaped'
                          : result.status === 'timeout'
                            ? 'Time ran out'
                            : 'Checkmated'}
                      </span>
                      <strong>
                        {result.status === 'won'
                          ? `${seconds(result.elapsedMs ?? 0)}s`
                          : '—'}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-history">
                  A blank slate. Today could be the start of a great streak.
                </p>
              )}
              <p className="source-note">
                Your progress and history are saved on this browser. Clearing
                site data or using another browser starts a new history.
              </p>
            </div>
          )}
          {modal === 'install' && (
            <div className="install-content">
              <span className="install-art">
                <Smartphone size={38} />
              </span>
              <h3>One tap closer to your next escape.</h3>
              <p>
                <strong>iPhone or iPad:</strong> open this site in Safari, tap
                Share, then “Add to Home Screen.”
              </p>
              <p>
                <strong>Android or desktop:</strong> open Chesscape in Chrome or
                Edge and choose “Install app” from the browser menu.
              </p>
              <p className="modal-note">
                Load your escape once, then play and retry offline in this tab.
                Reconnect when reopening the app or getting your next puzzle.
              </p>
            </div>
          )}
          {modal === 'share' && (
            <div className="share-content">
              {shareBusy ? (
                <div className="share-loading">
                  <LoaderCircle className="spin" /> Preparing your escape card…
                </div>
              ) : shareUrl ? (
                <img
                  className="share-image"
                  src={shareUrl}
                  alt={
                    shareKind === 'win'
                      ? `Chesscape win in ${formatClock(win?.elapsedMs ?? 0)} with the final chessboard`
                      : `Chesscape escape in ${seconds(attempt?.elapsedMs ?? 0)} seconds with the resulting chessboard`
                  }
                />
              ) : (
                <p>
                  Your image couldn’t be created. You can still copy your
                  result.
                </p>
              )}
              <div className="share-buttons">
                <button
                  className="primary-button"
                  disabled={!shareBlob || shareBusy}
                  onClick={() => void nativeShare()}
                >
                  <Share2 size={16} /> Share result
                </button>
                <button
                  className="secondary-button"
                  disabled={!shareBlob || shareBusy}
                  onClick={() => {
                    if (shareBlob) downloadBlob(shareBlob, shareFileName);
                  }}
                >
                  <Download size={16} /> Save image
                </button>
              </div>
              <button className="copy-button" onClick={() => void copyShare()}>
                <Copy size={14} /> Copy result as text
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={promotion !== null}
        onOpenChange={(open) => {
          if (!open) setPromotion(null);
        }}
      >
        <DialogContent className="chesscape-modal">
          <DialogTitle>Choose your promotion.</DialogTitle>
          <DialogDescription>
            {winMode
              ? 'Your clock is still running. Pick the piece your pawn becomes.'
              : 'Your timer is still running. This piece becomes your final move.'}
          </DialogDescription>
          <div className="promotion-options">
            {['q', 'r', 'b', 'n'].map((p) => (
              <button
                key={p}
                aria-label={`Promote to ${names[p]}`}
                onClick={() => {
                  if (!promotion) return;
                  if (winMode) commitWin(promotion.from, promotion.to, p);
                  else commit(promotion.from, promotion.to, p);
                }}
              >
                <img
                  src={`/pieces/${game.turn()}${p.toUpperCase()}.svg`}
                  width={55}
                  height={55}
                  alt=""
                />
                <span>{names[p]}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
