import type { PlayerId } from "./branded";

export type GamePhase =
  | "CREATED"
  | "LOBBY"
  | "PLAYING"
  | "FINISHED"
  | "CANCELLED"
  | "FORFEITED";

export type GameOutcome =
  | { readonly kind: "WIN"; readonly winner: PlayerId }
  | { readonly kind: "DRAW" }
  | { readonly kind: "FORFEIT"; readonly winner: PlayerId; readonly forfeiter: PlayerId };

export type PlayerSeat = {
  readonly playerId: PlayerId;
  readonly seatIndex: number;
};
