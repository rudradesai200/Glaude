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

  buildRenderContext(state: TState, seats: readonly PlayerSeat[]): TRenderContext;
  render(ctx: TRenderContext): Promise<Uint8Array>;

  serializeState(state: TState): string;
  deserializeState(raw: string): TState;
  serializeMove(move: TMove): string;
  deserializeMove(raw: string): TMove;
}
