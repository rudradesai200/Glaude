import type { GameDefinition } from "@glaude/engine";
import { GameId } from "@glaude/shared";
import type { GameOutcome, PlayerId, PlayerSeat } from "@glaude/shared";
import { initialState } from "./state.js";
import { applyMove, legalMoves, outcome, validateMove } from "./moves.js";
import { currentActor } from "./state.js";
import { buildPlayerView } from "./view.js";
import type { CoupMove, CoupRenderContext, CoupState } from "./types.js";

export const coupDefinition: GameDefinition<CoupState, CoupMove, CoupRenderContext> = {
  id: GameId("coup"),
  displayName: "Coup",
  players: { min: 2, max: 6 },

  initialState(seats: readonly PlayerSeat[]): CoupState {
    return initialState(seats);
  },

  validateMove(state: CoupState, move: CoupMove, playerId: PlayerId) {
    return validateMove(state, move, playerId);
  },

  applyMove(state: CoupState, move: CoupMove, playerId: PlayerId): CoupState {
    return applyMove(state, move, playerId);
  },

  legalMoves(state: CoupState, playerId: PlayerId): readonly CoupMove[] {
    return legalMoves(state, playerId);
  },

  currentTurn(state: CoupState): PlayerId {
    return currentActor(state);
  },

  outcome(state: CoupState): GameOutcome | null {
    const result = outcome(state);
    if (!result) return null;
    return { kind: "WIN", winner: result.winner };
  },

  buildPlayerView(state: CoupState, playerId: PlayerId, _seats: readonly PlayerSeat[]): unknown {
    return buildPlayerView(state, playerId);
  },

  activeRespondents(state: CoupState): readonly PlayerId[] {
    return state.players
      .map((p) => p.playerId)
      .filter((id) => legalMoves(state, id).length > 0);
  },

  buildRenderContext(state: CoupState, seats: readonly PlayerSeat[]): CoupRenderContext {
    return { state, seats };
  },

  render(_ctx: CoupRenderContext): Promise<Uint8Array> {
    // Phase 1: rendering is a stub — Phase 2 will implement the activity UI
    return Promise.resolve(new Uint8Array());
  },

  serializeState(state: CoupState): string {
    // Convert `responded` Set and pending action cleanly
    return JSON.stringify(state);
  },

  deserializeState(raw: string): CoupState {
    return JSON.parse(raw) as CoupState;
  },

  serializeMove(move: CoupMove): string {
    return JSON.stringify(move);
  },

  deserializeMove(raw: string): CoupMove {
    return JSON.parse(raw) as CoupMove;
  },
};

// Re-export buildPlayerView for consumers
export { buildPlayerView } from "./view.js";
