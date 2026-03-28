import type { PlayerId } from "@glaude/shared";
import type { AxialCoord, AbaloneState, Cell, HexDir } from "./types.js";

export const HEX_DIRECTIONS: readonly AxialCoord[] = [
  { q: 1, r: 0 },   // 0: E
  { q: 1, r: -1 },  // 1: NE
  { q: 0, r: -1 },  // 2: NW
  { q: -1, r: 0 },  // 3: W
  { q: -1, r: 1 },  // 4: SW
  { q: 0, r: 1 },   // 5: SE
] as const;

/** Opposite direction index (dir + 3) % 6 */
export const opposite = (dir: HexDir): HexDir => ((dir + 3) % 6) as HexDir;

export const coordKey = (c: AxialCoord): string => `${c.q},${c.r}`;

export const parseKey = (key: string): AxialCoord => {
  const comma = key.indexOf(",");
  return { q: Number(key.slice(0, comma)), r: Number(key.slice(comma + 1)) };
};

export const addCoord = (a: AxialCoord, b: AxialCoord): AxialCoord => ({
  q: a.q + b.q,
  r: a.r + b.r,
});

export const step = (c: AxialCoord, dir: HexDir): AxialCoord =>
  addCoord(c, HEX_DIRECTIONS[dir] as AxialCoord);

/** The 61 valid axial coords: max(|q|,|r|,|q+r|) <= 4 */
export const VALID_CELLS: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 4) {
        set.add(coordKey({ q, r }));
      }
    }
  }
  return set;
})();

export const isOnBoard = (c: AxialCoord): boolean => VALID_CELLS.has(coordKey(c));

/**
 * Standard starting layout.
 * Player at seat 0 = "black" (top, r <= -3 / partial r=-2)
 * Player at seat 1 = "white" (bottom, r >= 3 / partial r=2)
 */
export const initialBoard = (
  blackPlayer: PlayerId,
  whitePlayer: PlayerId,
): Map<string, Cell> => {
  const board = new Map<string, Cell>();

  // Seed all valid cells as empty
  for (const key of VALID_CELLS) {
    board.set(key, { kind: "empty" });
  }

  const place = (coords: AxialCoord[], owner: PlayerId) => {
    for (const c of coords) {
      board.set(coordKey(c), { kind: "marble", owner });
    }
  };

  // Black marbles (seat 0) — rows r=-4 and r=-3, plus q∈{-1,0,1} at r=-2
  const blackCoords: AxialCoord[] = [];
  for (const key of VALID_CELLS) {
    const { q, r } = parseKey(key);
    if (r === -4 || r === -3 || (r === -2 && q >= -1 && q <= 1)) {
      blackCoords.push({ q, r });
    }
  }
  place(blackCoords, blackPlayer);

  // White marbles (seat 1) — rows r=4 and r=3, plus q∈{-1,0,1} at r=2
  const whiteCoords: AxialCoord[] = [];
  for (const key of VALID_CELLS) {
    const { q, r } = parseKey(key);
    if (r === 4 || r === 3 || (r === 2 && q >= -1 && q <= 1)) {
      whiteCoords.push({ q, r });
    }
  }
  place(whiteCoords, whitePlayer);

  return board;
};

/** Count marbles on board for a given player */
export const countMarbles = (board: Map<string, Cell>, owner: PlayerId): number => {
  let count = 0;
  for (const cell of board.values()) {
    if (cell.kind === "marble" && cell.owner === owner) count++;
  }
  return count;
};

/** Build an AbaloneState with a fresh initial board */
export const initialState = (
  blackPlayer: PlayerId,
  whitePlayer: PlayerId,
): AbaloneState => ({
  board: initialBoard(blackPlayer, whitePlayer),
  turn: blackPlayer,
  capturedBy: { [blackPlayer]: 0, [whitePlayer]: 0 },
  moveNumber: 0,
});
