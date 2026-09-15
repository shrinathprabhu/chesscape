// A small, deterministic alpha-beta opponent for Win mode. It runs entirely on
// the device (in a Web Worker when available) and never talks to the network.
// Fixed depth keeps its strength identical on every device, so times compare fairly.
// chess.js remains the authority for legality in the UI; this generator exists only
// because chess.js' SAN-producing move list is far too slow to search with.
export const ENGINE_DEPTH = 2;
const QUIESCENCE_DEPTH = 6;
const MATE = 100000;

const PAWN = 1,
  KNIGHT = 2,
  BISHOP = 3,
  ROOK = 4,
  QUEEN = 5,
  KING = 6;
const BLACK = 8;
const symbols = ' pnbrqk';
const values = [0, 100, 320, 330, 500, 900, 0];
const KNIGHT_STEPS = [33, 31, 18, 14, -33, -31, -18, -14];
const KING_STEPS = [1, -1, 16, -16, 17, 15, -17, -15];
const BISHOP_STEPS = [17, 15, -17, -15];
const ROOK_STEPS = [1, -1, 16, -16];
// Castling rights cleared when a move touches a1, e1, h1, a8, e8 or h8.
const castleMask = new Uint8Array(128).fill(15);
castleMask[0] = 13;
castleMask[4] = 12;
castleMask[7] = 14;
castleMask[112] = 7;
castleMask[116] = 3;
castleMask[119] = 11;

export interface EngineMove {
  from: number;
  to: number;
  piece: number;
  captured: number;
  promotion: number;
  flags: number; // 1 en passant, 2 castle, 4 double pawn push
}
interface Undo {
  move: EngineMove;
  castling: number;
  ep: number;
  halfmove: number;
}
export class Position {
  board = new Uint8Array(128);
  turn = 0; // 0 white, 8 black
  castling = 0;
  ep = -1;
  halfmove = 0;
  kings = [0, 0];
  private history: Undo[] = [];

  constructor(fen: string) {
    const [placement, side, rights, ep, half] = fen.trim().split(/\s+/);
    placement.split('/').forEach((row, r) => {
      let file = 0;
      for (const char of row) {
        if (/\d/.test(char)) {
          file += Number(char);
          continue;
        }
        const type = symbols.indexOf(char.toLowerCase());
        const color = char === char.toLowerCase() ? BLACK : 0;
        const square = (7 - r) * 16 + file++;
        this.board[square] = type | color;
        if (type === KING) this.kings[color ? 1 : 0] = square;
      }
    });
    this.turn = side === 'b' ? BLACK : 0;
    for (const [flag, bit] of [
      ['K', 1],
      ['Q', 2],
      ['k', 4],
      ['q', 8],
    ] as const)
      if (rights?.includes(flag)) this.castling |= bit;
    this.ep =
      ep && ep !== '-' ? (Number(ep[1]) - 1) * 16 + ep.charCodeAt(0) - 97 : -1;
    this.halfmove = Number(half) || 0;
  }

  attacked(square: number, by: number): boolean {
    const pawnDir = by === 0 ? -16 : 16;
    for (const side of [1, -1]) {
      const from = square + pawnDir + side;
      if (!(from & 0x88) && this.board[from] === (PAWN | by)) return true;
    }
    for (const step of KNIGHT_STEPS) {
      const from = square + step;
      if (!(from & 0x88) && this.board[from] === (KNIGHT | by)) return true;
    }
    for (const step of KING_STEPS) {
      const from = square + step;
      if (!(from & 0x88) && this.board[from] === (KING | by)) return true;
    }
    for (const [steps, piece] of [
      [BISHOP_STEPS, BISHOP],
      [ROOK_STEPS, ROOK],
    ] as const)
      for (const step of steps) {
        let from = square + step;
        while (!(from & 0x88)) {
          const found = this.board[from];
          if (found) {
            if (found === (piece | by) || found === (QUEEN | by)) return true;
            break;
          }
          from += step;
        }
      }
    return false;
  }
  inCheck(): boolean {
    return this.attacked(this.kings[this.turn ? 1 : 0], this.turn ^ BLACK);
  }

  private pseudo(capturesOnly: boolean): EngineMove[] {
    const moves: EngineMove[] = [];
    const us = this.turn,
      them = us ^ BLACK;
    const add = (from: number, to: number, flags = 0, captured = 0) => {
      const piece = this.board[from];
      if ((piece & 7) === PAWN && (to >> 4 === 7 || to >> 4 === 0))
        for (const promotion of [QUEEN, KNIGHT, ROOK, BISHOP])
          moves.push({ from, to, piece, captured, promotion, flags });
      else moves.push({ from, to, piece, captured, promotion: 0, flags });
    };
    for (let from = 0; from < 128; from++) {
      if (from & 0x88) {
        from += 7;
        continue;
      }
      const piece = this.board[from];
      if (!piece || (piece & BLACK) !== us) continue;
      const type = piece & 7;
      if (type === PAWN) {
        const dir = us ? -16 : 16;
        const one = from + dir;
        if (!(one & 0x88) && !this.board[one]) {
          const promoting = one >> 4 === 7 || one >> 4 === 0;
          if (!capturesOnly || promoting) add(from, one);
          const home = us ? 6 : 1;
          if (!capturesOnly && from >> 4 === home && !this.board[one + dir])
            add(from, one + dir, 4);
        }
        for (const side of [-1, 1]) {
          const to = one + side;
          if (to & 0x88) continue;
          const target = this.board[to];
          if (target && (target & BLACK) === them) add(from, to, 0, target);
          else if (to === this.ep) add(from, to, 1, PAWN | them);
        }
        continue;
      }
      const steps =
        type === KNIGHT
          ? KNIGHT_STEPS
          : type === BISHOP
            ? BISHOP_STEPS
            : type === ROOK
              ? ROOK_STEPS
              : KING_STEPS;
      const slides = type === BISHOP || type === ROOK || type === QUEEN;
      for (const step of steps) {
        let to = from + step;
        while (!(to & 0x88)) {
          const target = this.board[to];
          if (target) {
            if ((target & BLACK) === them) add(from, to, 0, target);
            break;
          }
          if (!capturesOnly) add(from, to);
          if (!slides) break;
          to += step;
        }
      }
      if (type === KING && !capturesOnly) {
        const [kingSide, queenSide, home] = us ? [4, 8, 116] : [1, 2, 4];
        if (from === home && !this.attacked(home, them)) {
          if (
            this.castling & kingSide &&
            !this.board[home + 1] &&
            !this.board[home + 2] &&
            this.board[home + 3] === (ROOK | us) &&
            !this.attacked(home + 1, them)
          )
            add(from, home + 2, 2);
          if (
            this.castling & queenSide &&
            !this.board[home - 1] &&
            !this.board[home - 2] &&
            !this.board[home - 3] &&
            this.board[home - 4] === (ROOK | us) &&
            !this.attacked(home - 1, them)
          )
            add(from, home - 2, 2);
        }
      }
    }
    return moves;
  }
  /** Legal moves; castling-through-check is filtered by the destination test below. */
  moves(capturesOnly = false): EngineMove[] {
    return this.pseudo(capturesOnly).filter((move) => {
      this.make(move);
      const legal = !this.attacked(this.kings[this.turn ? 0 : 1], this.turn);
      this.unmake();
      return legal;
    });
  }
  make(move: EngineMove) {
    const { from, to, piece, promotion, flags } = move;
    this.history.push({
      move,
      castling: this.castling,
      ep: this.ep,
      halfmove: this.halfmove,
    });
    const us = this.turn;
    this.board[to] = promotion ? promotion | us : piece;
    this.board[from] = 0;
    if (flags & 1) this.board[to + (us ? 16 : -16)] = 0;
    if (flags & 2) {
      const [rookFrom, rookTo] =
        to > from ? [to + 1, to - 1] : [to - 2, to + 1];
      this.board[rookTo] = this.board[rookFrom];
      this.board[rookFrom] = 0;
    }
    if ((piece & 7) === KING) this.kings[us ? 1 : 0] = to;
    this.castling &= castleMask[from] & castleMask[to];
    this.ep = flags & 4 ? from + (us ? -16 : 16) : -1;
    this.halfmove =
      (piece & 7) === PAWN || move.captured ? 0 : this.halfmove + 1;
    this.turn ^= BLACK;
  }
  unmake() {
    const undo = this.history.pop();
    if (!undo) return;
    const { from, to, piece, captured, flags } = undo.move;
    this.turn ^= BLACK;
    const us = this.turn;
    this.board[from] = piece;
    this.board[to] = flags & 1 ? 0 : captured;
    if (flags & 1) this.board[to + (us ? 16 : -16)] = captured;
    if (flags & 2) {
      const [rookFrom, rookTo] =
        to > from ? [to + 1, to - 1] : [to - 2, to + 1];
      this.board[rookFrom] = this.board[rookTo];
      this.board[rookTo] = 0;
    }
    if ((piece & 7) === KING) this.kings[us ? 1 : 0] = from;
    this.castling = undo.castling;
    this.ep = undo.ep;
    this.halfmove = undo.halfmove;
  }
  evaluate(): number {
    let score = 0,
      minors = 0;
    for (let square = 0; square < 128; square++) {
      if (square & 0x88) {
        square += 7;
        continue;
      }
      const piece = this.board[square];
      if (!piece) continue;
      const type = piece & 7,
        black = piece & BLACK;
      const rank = square >> 4,
        file = square & 7;
      if (type !== PAWN && type !== KING) minors += values[type];
      const value =
        values[type] + positional(type, black ? 7 - rank : rank, file);
      score += black ? -value : value;
    }
    // In the endgame, reward driving the defending king toward the edge.
    if (minors < 2600) {
      const [white, black] = this.kings;
      const edge = (sq: number) =>
        Math.max(3 - (sq >> 4), (sq >> 4) - 4) +
        Math.max(3 - (sq & 7), (sq & 7) - 4);
      score += (edge(black) - edge(white)) * 12;
    }
    return this.turn ? -score : score;
  }
}
const centre = [0, 1, 2, 3, 3, 2, 1, 0];
function positional(type: number, advance: number, file: number) {
  const central = centre[advance] + centre[file];
  switch (type) {
    case PAWN:
      return advance * 6 + (file >= 2 && file <= 5 ? advance * 2 : 0);
    case KNIGHT:
    case BISHOP:
      return central * 5;
    case QUEEN:
      return central * 2;
    case KING:
      return advance === 0 ? 10 : -advance * 8;
    default:
      return advance === 6 ? 15 : 0;
  }
}
function ordered(moves: EngineMove[]) {
  const rank = (m: EngineMove) =>
    (m.captured
      ? 10 * values[m.captured & 7] - values[m.piece & 7] + 1000
      : 0) + values[m.promotion];
  return moves.sort((a, b) => rank(b) - rank(a));
}
function quiesce(
  p: Position,
  alpha: number,
  beta: number,
  depth: number,
): number {
  const stand = p.evaluate();
  if (depth === 0 || stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  for (const move of ordered(p.moves(true))) {
    p.make(move);
    const score = -quiesce(p, -beta, -alpha, depth - 1);
    p.unmake();
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }
  return alpha;
}
function search(
  p: Position,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
): number {
  const moves = p.moves();
  if (!moves.length) return p.inCheck() ? -MATE + ply : 0;
  if (p.halfmove >= 100) return 0;
  if (depth <= 0) return quiesce(p, alpha, beta, QUIESCENCE_DEPTH);
  let best = -Infinity;
  for (const move of ordered(moves)) {
    p.make(move);
    // Extend checks by a ply so short mating attacks are seen and answered.
    const extend = depth === 1 && ply < 6 && p.inCheck() ? 1 : 0;
    const score = -search(p, depth - 1 + extend, -beta, -alpha, ply + 1);
    p.unmake();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}
export const uci = (move: EngineMove) =>
  'abcdefgh'[move.from & 7] +
  ((move.from >> 4) + 1) +
  'abcdefgh'[move.to & 7] +
  ((move.to >> 4) + 1) +
  (move.promotion ? symbols[move.promotion] : '');

/** Returns the engine's reply in UCI form, or null when the side to move has none. */
export function chooseMove(fen: string, depth = ENGINE_DEPTH): string | null {
  const p = new Position(fen);
  const moves = ordered(p.moves());
  if (!moves.length) return null;
  let best = moves[0],
    alpha = -Infinity;
  for (const move of moves) {
    p.make(move);
    const score = -search(p, depth - 1, -Infinity, -alpha, 1);
    p.unmake();
    // Ties keep the earlier, better-ordered move, so replies are deterministic.
    if (score > alpha) {
      alpha = score;
      best = move;
    }
  }
  return uci(best);
}
