import type { PlayerId } from "@glaude/shared";

export type AxialCoord = { readonly q: number; readonly r: number };

/** Index into HEX_DIRECTIONS (0-5) */
export type HexDir = 0 | 1 | 2 | 3 | 4 | 5;

export type Cell =
  | { readonly kind: "empty" }
  | { readonly kind: "marble"; readonly owner: PlayerId };

export type AbaloneState = {
  readonly board: Map<string, Cell>;
  readonly turn: PlayerId;
  readonly capturedBy: Readonly<Record<string, number>>;
  readonly moveNumber: number;
};

export type AbaloneMove =
  | { readonly type: "inline"; readonly marbles: readonly AxialCoord[]; readonly direction: HexDir }
  | { readonly type: "broadside"; readonly marbles: readonly AxialCoord[]; readonly direction: HexDir };

export type AbaloneRenderContext = {
  readonly state: AbaloneState;
  readonly players: ReadonlyArray<{ readonly playerId: PlayerId; readonly seatIndex: number }>;
};
