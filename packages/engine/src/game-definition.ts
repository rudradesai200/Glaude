import type { GameId, GameOutcome, PlayerId, PlayerSeat, Result } from "@glaude/shared";

export interface GameDefinition<TState, TMove, TRenderContext> {
  readonly id: GameId;
  readonly displayName: string;
  readonly players: { readonly min: 2; readonly max: number };

  initialState(seats: readonly PlayerSeat[]): TState;

  validateMove(state: TState, move: TMove, playerId: PlayerId): Result<void, string>;
  applyMove(state: TState, move: TMove, playerId: PlayerId): TState;
  legalMoves(state: TState, playerId: PlayerId): readonly TMove[];

  currentTurn(state: TState): PlayerId;
  outcome(state: TState): GameOutcome | null;

  /**
   * Returns a player-specific masked view of the state.
   * When defined, the WS server sends each player their own view instead of
   * a shared broadcast. Optional — falls back to serializeState if absent.
   */
  buildPlayerView?(state: TState, playerId: PlayerId, seats: readonly PlayerSeat[]): unknown;

  /**
   * Returns the set of players who must respond in the current phase.
   * When defined, the WS server uses this for move authorization instead of
   * falling back to [currentTurn]. Optional.
   */
  activeRespondents?(state: TState): readonly PlayerId[];

  buildRenderContext(state: TState, seats: readonly PlayerSeat[]): TRenderContext;
  render(ctx: TRenderContext): Promise<Uint8Array>;

  serializeState(state: TState): string;
  deserializeState(raw: string): TState;
  serializeMove(move: TMove): string;
  deserializeMove(raw: string): TMove;
}
