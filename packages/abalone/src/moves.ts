import type { PlayerId } from "@glaude/shared";
import { ok, err } from "@glaude/shared";
import type { Result } from "@glaude/shared";
import type { AbaloneMove, AbaloneState, AxialCoord, HexDir } from "./types.js";
import {
  HEX_DIRECTIONS,
  coordKey,
  parseKey,
  step,
  isOnBoard,
  opposite,
} from "./board.js";

// ─── helpers ────────────────────────────────────────────────────────────────

/** Dot-product projection of c onto HEX_DIRECTIONS[dir] */
const project = (c: AxialCoord, dir: HexDir): number => {
  const d = HEX_DIRECTIONS[dir] as AxialCoord;
  return c.q * d.q + c.r * d.r;
};

/**
 * Sort marbles along `dir` (tail → lead).
 * Secondary sort on the *other* coordinate for determinism when projections tie.
 */
const sortAlongDir = (marbles: readonly AxialCoord[], dir: HexDir): AxialCoord[] =>
  [...marbles].sort((a, b) => {
    const diff = project(a, dir) - project(b, dir);
    if (diff !== 0) return diff;
    return a.q !== b.q ? a.q - b.q : a.r - b.r;
  });

/**
 * Check that the sorted array forms a consecutive chain in `dir`.
 * Returns true if each element is exactly one step ahead of the previous.
 */
const isConsecutive = (sorted: AxialCoord[], dir: HexDir): boolean => {
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev || !curr) return false;
    const expected = step(prev, dir);
    if (expected.q !== curr.q || expected.r !== curr.r) return false;
  }
  return true;
};

/**
 * Find the axis direction (0, 1, or 2) along which marbles are collinear.
 * Returns null if not collinear on any axis.
 * Axes: 0=E/W, 1=NE/SW, 2=NW/SE.
 */
const findLineAxis = (marbles: readonly AxialCoord[]): 0 | 1 | 2 | null => {
  for (const axis of [0, 1, 2] as const) {
    const sorted = sortAlongDir(marbles, axis);
    if (isConsecutive(sorted, axis)) return axis;
  }
  return null;
};

// ─── validateMove ────────────────────────────────────────────────────────────

export const validateMove = (
  state: AbaloneState,
  move: AbaloneMove,
): Result<void, string> => {
  const { board, turn } = state;
  const { marbles, direction } = move;
  const n = marbles.length;

  if (n < 1 || n > 3) return err("Must move 1–3 marbles");

  for (const m of marbles) {
    const cell = board.get(coordKey(m));
    if (!cell || cell.kind !== "marble" || cell.owner !== turn) {
      return err("All marbles must belong to the current player");
    }
  }

  return move.type === "inline"
    ? validateInline(board, marbles, direction, turn)
    : validateBroadside(board, marbles, direction, turn);
};

const validateInline = (
  board: AbaloneState["board"],
  marbles: readonly AxialCoord[],
  direction: HexDir,
  owner: PlayerId,
): Result<void, string> => {
  const sorted = sortAlongDir(marbles, direction);
  if (!isConsecutive(sorted, direction)) {
    return err("Marbles must be consecutive in the move direction for inline");
  }

  const lead = sorted[sorted.length - 1] as AxialCoord;
  const dest = step(lead, direction);

  // Own marbles cannot be pushed off the board
  if (!isOnBoard(dest)) return err("Cannot push own marble off the board");

  const destCell = board.get(coordKey(dest));

  if (!destCell || destCell.kind === "empty") return ok(undefined);
  if (destCell.owner === owner) return err("Blocked by own marble");

  // Sumito: count consecutive opponent marbles ahead
  let pos = dest;
  let opCount = 0;
  while (true) {
    const cell = board.get(coordKey(pos));
    if (!cell || cell.kind !== "marble" || cell.owner === owner) break;
    opCount++;
    pos = step(pos, direction);
  }

  if (opCount >= marbles.length) {
    return err("Cannot push an equal or larger group (sumito requires numerical advantage)");
  }

  // `pos` is now the cell after the last opponent marble
  if (isOnBoard(pos)) {
    const afterCell = board.get(coordKey(pos));
    if (afterCell?.kind === "marble") {
      return err("Opponent marbles are blocked by another marble");
    }
  }
  // If off-board, the opponent marble(s) are captured — valid

  return ok(undefined);
};

const validateBroadside = (
  board: AbaloneState["board"],
  marbles: readonly AxialCoord[],
  direction: HexDir,
  _owner: PlayerId,
): Result<void, string> => {
  const n = marbles.length;

  if (n >= 2) {
    const axis = findLineAxis(marbles);
    if (axis === null) return err("Marbles are not collinear");
    // Move direction must not be along the same axis as the marble line
    if (direction % 3 === axis) {
      return err("Broadside move direction must be perpendicular to the marble line");
    }
  }

  for (const m of marbles) {
    const dest = step(m, direction);
    if (!isOnBoard(dest)) return err("Cannot move marble off the board");
    const destCell = board.get(coordKey(dest));
    if (destCell?.kind === "marble") return err("Broadside cannot push marbles");
  }

  return ok(undefined);
};

// ─── applyMove ───────────────────────────────────────────────────────────────

export const applyMove = (state: AbaloneState, move: AbaloneMove): AbaloneState => {
  const validation = validateMove(state, move);
  if (!validation.ok) throw new Error(`Invalid move: ${validation.error}`);

  const { board, turn, capturedBy, moveNumber } = state;
  const { marbles, direction } = move;

  const players = Object.keys(capturedBy) as PlayerId[];
  const opponent = players.find((p) => p !== turn) as PlayerId;

  const newBoard = new Map(board);
  let newCapturedBy: Record<string, number> = { ...capturedBy };

  if (move.type === "inline") {
    const sorted = sortAlongDir(marbles, direction);
    const lead = sorted[sorted.length - 1] as AxialCoord;

    // Collect consecutive opponent marbles ahead of the lead
    let pos = step(lead, direction);
    const opponentMarbles: AxialCoord[] = [];
    while (isOnBoard(pos)) {
      const cell = board.get(coordKey(pos));
      if (!cell || cell.kind !== "marble" || cell.owner === turn) break;
      opponentMarbles.push(pos);
      pos = step(pos, direction);
    }

    // Clear current positions
    for (const m of marbles) newBoard.set(coordKey(m), { kind: "empty" });
    for (const m of opponentMarbles) newBoard.set(coordKey(m), { kind: "empty" });

    // Place friendly marbles one step forward
    for (const m of marbles) {
      newBoard.set(coordKey(step(m, direction)), { kind: "marble", owner: turn });
    }

    // Place opponent marbles one step forward (or capture if off board)
    let captured = 0;
    for (const m of opponentMarbles) {
      const newPos = step(m, direction);
      if (isOnBoard(newPos)) {
        newBoard.set(coordKey(newPos), { kind: "marble", owner: opponent });
      } else {
        captured++;
      }
    }

    if (captured > 0) {
      newCapturedBy = { ...newCapturedBy, [turn]: (newCapturedBy[turn] ?? 0) + captured };
    }
  } else {
    // Broadside: every marble moves independently in direction
    for (const m of marbles) newBoard.set(coordKey(m), { kind: "empty" });
    for (const m of marbles) {
      newBoard.set(coordKey(step(m, direction)), { kind: "marble", owner: turn });
    }
  }

  const nextTurn = (Object.keys(capturedBy) as PlayerId[]).find((p) => p !== turn) as PlayerId;

  return {
    board: newBoard,
    turn: nextTurn,
    capturedBy: newCapturedBy as Readonly<Record<string, number>>,
    moveNumber: moveNumber + 1,
  };
};

// ─── isWon ───────────────────────────────────────────────────────────────────

/**
 * Returns the PlayerId of the winner (the player who has pushed off 6 opponent marbles),
 * or null if the game is still in progress.
 */
export const isWon = (state: AbaloneState): PlayerId | null => {
  for (const [playerId, captured] of Object.entries(state.capturedBy)) {
    if (captured >= 6) return playerId as PlayerId;
  }
  return null;
};

// ─── legalMoves ──────────────────────────────────────────────────────────────

/** Canonical serialization for dedup */
const serializeMove = (move: AbaloneMove): string => {
  const sortedMarbles = [...move.marbles].sort(
    (a, b) => a.q !== b.q ? a.q - b.q : a.r - b.r,
  );
  return `${move.type}:${move.direction}:${sortedMarbles.map(coordKey).join("|")}`;
};

/**
 * Generate all legal moves for the current player.
 */
export const legalMoves = (state: AbaloneState): AbaloneMove[] => {
  const moves: AbaloneMove[] = [];
  const seen = new Set<string>();

  const add = (move: AbaloneMove): void => {
    const key = serializeMove(move);
    if (seen.has(key)) return;
    seen.add(key);
    if (validateMove(state, move).ok) moves.push(move);
  };

  // Collect all own marble positions
  const own: AxialCoord[] = [];
  for (const [key, cell] of state.board) {
    if (cell.kind === "marble" && cell.owner === state.turn) {
      own.push(parseKey(key));
    }
  }

  for (const m1 of own) {
    // ── Single-marble moves (inline only) ────────────────────────────────
    for (let d = 0; d < 6; d++) {
      add({ type: "inline", marbles: [m1], direction: d as HexDir });
    }

    // ── Pairs and triples ────────────────────────────────────────────────
    // Walk along each of the 6 directions to find adjacent own marbles
    for (let ld = 0; ld < 6; ld++) {
      const m2 = step(m1, ld as HexDir);
      const m2cell = state.board.get(coordKey(m2));
      if (m2cell?.kind !== "marble" || m2cell.owner !== state.turn) continue;

      // 2-marble inline (both directions along the line axis)
      add({ type: "inline", marbles: [m1, m2], direction: ld as HexDir });
      add({ type: "inline", marbles: [m1, m2], direction: opposite(ld as HexDir) });

      // 2-marble broadside (4 directions perpendicular to the line)
      for (let d = 0; d < 6; d++) {
        if (d % 3 !== ld % 3) {
          add({ type: "broadside", marbles: [m1, m2], direction: d as HexDir });
        }
      }

      // Extend to 3-marble groups
      const m3 = step(m2, ld as HexDir);
      const m3cell = state.board.get(coordKey(m3));
      if (m3cell?.kind !== "marble" || m3cell.owner !== state.turn) continue;

      // 3-marble inline
      add({ type: "inline", marbles: [m1, m2, m3], direction: ld as HexDir });
      add({ type: "inline", marbles: [m1, m2, m3], direction: opposite(ld as HexDir) });

      // 3-marble broadside
      for (let d = 0; d < 6; d++) {
        if (d % 3 !== ld % 3) {
          add({ type: "broadside", marbles: [m1, m2, m3], direction: d as HexDir });
        }
      }
    }
  }

  return moves;
};
