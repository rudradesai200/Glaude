import type { GameDefinition } from "@glaude/engine";
import { GameId, err } from "@glaude/shared";
import { renderAbalone } from "./render.js";
import type { GameOutcome, PlayerId, PlayerSeat } from "@glaude/shared";
import { initialState } from "./board.js";
import { validateMove, applyMove, legalMoves, isWon } from "./moves.js";
import type { AbaloneMove, AbaloneRenderContext, AbaloneState, Cell } from "./types.js";

// ─── serialization helpers ────────────────────────────────────────────────────

type SerializedState = {
  board: Record<string, Cell>;
  turn: PlayerId;
  capturedBy: Record<string, number>;
  moveNumber: number;
};

const serializeBoard = (board: Map<string, Cell>): Record<string, Cell> =>
  Object.fromEntries(board);

const deserializeBoard = (raw: Record<string, Cell>): Map<string, Cell> =>
  new Map(Object.entries(raw));

// ─── GameDefinition ───────────────────────────────────────────────────────────

export const abaloneDefinition: GameDefinition<AbaloneState, AbaloneMove, AbaloneRenderContext> = {
  id: GameId("abalone"),
  displayName: "Abalone",
  players: { min: 2, max: 2 },

  initialState(seats: readonly PlayerSeat[]): AbaloneState {
    const black = seats[0]?.playerId;
    const white = seats[1]?.playerId;
    if (!black || !white) throw new Error("Abalone requires exactly 2 players");
    return initialState(black, white);
  },

  validateMove(state: AbaloneState, move: AbaloneMove, playerId: PlayerId) {
    if (playerId !== state.turn) return err("It is not your turn");
    return validateMove(state, move);
  },

  applyMove(state: AbaloneState, move: AbaloneMove, _playerId: PlayerId): AbaloneState {
    return applyMove(state, move);
  },

  legalMoves(state: AbaloneState, playerId: PlayerId): readonly AbaloneMove[] {
    if (playerId !== state.turn) return [];
    return legalMoves(state);
  },

  currentTurn(state: AbaloneState): PlayerId {
    return state.turn;
  },

  outcome(state: AbaloneState): GameOutcome | null {
    const winner = isWon(state);
    if (!winner) return null;
    return { kind: "WIN", winner };
  },

  buildRenderContext(state: AbaloneState, seats: readonly PlayerSeat[]): AbaloneRenderContext {
    return { state, players: seats };
  },

  render(ctx: AbaloneRenderContext): Promise<Uint8Array> {
    return renderAbalone(ctx);
  },

  serializeState(state: AbaloneState): string {
    const serialized: SerializedState = {
      board: serializeBoard(state.board),
      turn: state.turn,
      capturedBy: { ...state.capturedBy },
      moveNumber: state.moveNumber,
    };
    return JSON.stringify(serialized);
  },

  deserializeState(raw: string): AbaloneState {
    const parsed = JSON.parse(raw) as SerializedState;
    return {
      board: deserializeBoard(parsed.board),
      turn: parsed.turn,
      capturedBy: parsed.capturedBy,
      moveNumber: parsed.moveNumber,
    };
  },

  serializeMove(move: AbaloneMove): string {
    return JSON.stringify(move);
  },

  deserializeMove(raw: string): AbaloneMove {
    return JSON.parse(raw) as AbaloneMove;
  },
};
