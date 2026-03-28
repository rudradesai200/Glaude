declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type PlayerId = Brand<string, "PlayerId">;
export type SessionId = Brand<string, "SessionId">;
export type GameId = Brand<string, "GameId">;

export const PlayerId = (s: string): PlayerId => s as PlayerId;
export const SessionId = (s: string): SessionId => s as SessionId;
export const GameId = (s: string): GameId => s as GameId;
