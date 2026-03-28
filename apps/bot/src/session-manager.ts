import type { GameDefinition } from "@glaude/engine";
import { SessionId, PlayerId } from "@glaude/shared";
import type { GameId, GameOutcome, PlayerSeat, Result } from "@glaude/shared";
import { ok, err } from "@glaude/shared";
import { findGame } from "./games/registry.js";
import type { Db } from "./db/client.js";
import {
  ensurePlayer,
  persistLobby,
  persistPlaying,
  persistMoveAndState,
  persistEnded,
  updateMessageId as dbUpdateMessageId,
  loadActiveSessions,
  addSessionPlayer,
} from "./db/repository.js";

// ─── Session Types ────────────────────────────────────────────────────────────

export type LobbySession = {
  readonly phase: "LOBBY";
  readonly channelId: string;
  readonly sessionId: string;
  readonly gameId: GameId;
  readonly hostId: PlayerId;
  readonly seats: readonly PlayerId[];
  readonly messageId?: string;
};

export type PlayingSession = {
  readonly phase: "PLAYING";
  readonly channelId: string;
  readonly sessionId: string;
  readonly gameId: GameId;
  readonly seats: readonly PlayerSeat[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly definition: GameDefinition<any, any, any>;
  readonly state: unknown;
  readonly messageId?: string;
};

export type EndedSession = {
  readonly phase: "FINISHED" | "FORFEITED";
  readonly channelId: string;
  readonly sessionId: string;
  readonly gameId: GameId;
  readonly seats: readonly PlayerSeat[];
  readonly outcome: GameOutcome;
  readonly messageId?: string;
};

export type Session = LobbySession | PlayingSession | EndedSession;

// ─── Session Manager ──────────────────────────────────────────────────────────

export class SessionManager {
  readonly #sessions = new Map<string, Session>();
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  // Rebuild in-memory state from persisted active sessions (call on startup).
  recover(): void {
    const active = loadActiveSessions(this.#db);
    for (const recovered of active) {
      const { row, seats } = recovered;
      if (recovered.phase === "LOBBY") {
        const hostSeat = seats.find((s) => s.seatIndex === 0);
        if (!hostSeat) continue;
        const lobby: LobbySession = {
          phase: "LOBBY",
          channelId: row.channelId,
          sessionId: row.id,
          gameId: row.gameId as GameId,
          hostId: PlayerId(hostSeat.playerId),
          seats: seats
            .slice()
            .sort((a, b) => a.seatIndex - b.seatIndex)
            .map((s) => PlayerId(s.playerId)),
          ...(row.messageId !== null && { messageId: row.messageId }),
        };
        this.#sessions.set(row.channelId, lobby);
      } else {
        const def = findGame(row.gameId);
        if (!def || !row.state) continue;
        const playerSeats: PlayerSeat[] = seats
          .slice()
          .sort((a, b) => a.seatIndex - b.seatIndex)
          .map((s) => ({ playerId: PlayerId(s.playerId), seatIndex: s.seatIndex }));
        const playing: PlayingSession = {
          phase: "PLAYING",
          channelId: row.channelId,
          sessionId: row.id,
          gameId: row.gameId as GameId,
          seats: playerSeats,
          definition: def,
          state: def.deserializeState(row.state),
          ...(row.messageId !== null && { messageId: row.messageId }),
        };
        this.#sessions.set(row.channelId, playing);
      }
    }
    if (active.length > 0) {
      console.log(`Recovered ${active.length} active session(s) from database.`);
    }
  }

  createLobby(
    channelId: string,
    gameId: string,
    hostId: PlayerId,
  ): Result<LobbySession, string> {
    const existing = this.#sessions.get(channelId);
    if (existing && existing.phase !== "FINISHED" && existing.phase !== "FORFEITED") {
      return err("There is already an active session in this channel");
    }

    const def = findGame(gameId);
    if (!def) return err(`Unknown game: "${gameId}"`);

    const session: LobbySession = {
      phase: "LOBBY",
      channelId,
      sessionId: SessionId(crypto.randomUUID()),
      gameId: def.id,
      hostId,
      seats: [hostId],
    };

    this.#sessions.set(channelId, session);
    persistLobby(this.#db, session);
    return ok(session);
  }

  joinLobby(
    channelId: string,
    playerId: PlayerId,
  ): Result<LobbySession | PlayingSession, string> {
    const session = this.#sessions.get(channelId);
    if (!session) return err("No active lobby in this channel");
    if (session.phase !== "LOBBY") return err("No lobby is open in this channel");
    if (session.seats.includes(playerId)) return err("You have already joined this session");

    const def = findGame(session.gameId)!;
    const newSeats = [...session.seats, playerId];

    if (newSeats.length >= def.players.min) {
      const playerSeats: PlayerSeat[] = newSeats.map((pid, i) => ({
        playerId: pid,
        seatIndex: i,
      }));
      const state = def.initialState(playerSeats) as unknown;
      const playing: PlayingSession = {
        phase: "PLAYING",
        channelId,
        sessionId: session.sessionId,
        gameId: session.gameId,
        seats: playerSeats,
        definition: def,
        state,
        ...(session.messageId !== undefined && { messageId: session.messageId }),
      };
      this.#sessions.set(channelId, playing);
      persistPlaying(this.#db, playing);
      return ok(playing);
    }

    const updated: LobbySession = { ...session, seats: newSeats };
    this.#sessions.set(channelId, updated);
    addSessionPlayer(this.#db, session.sessionId, { playerId, seatIndex: newSeats.length - 1 });
    return ok(updated);
  }

  forfeit(channelId: string, playerId: PlayerId): Result<EndedSession, string> {
    const session = this.#sessions.get(channelId);
    if (!session) return err("No active session in this channel");
    if (session.phase !== "PLAYING") return err("No game is in progress in this channel");

    const forfeiter = session.seats.find((s) => s.playerId === playerId);
    if (!forfeiter) return err("You are not a participant in this game");

    const winner = session.seats.find((s) => s.playerId !== playerId);
    if (!winner) return err("Cannot forfeit — no opponent found");

    const ended: EndedSession = {
      phase: "FORFEITED",
      channelId,
      sessionId: session.sessionId,
      gameId: session.gameId,
      seats: session.seats,
      outcome: { kind: "FORFEIT", winner: winner.playerId, forfeiter: playerId },
      ...(session.messageId !== undefined && { messageId: session.messageId }),
    };
    this.#sessions.set(channelId, ended);
    persistEnded(this.#db, ended);
    return ok(ended);
  }

  makeMove(
    channelId: string,
    playerId: PlayerId,
    move: unknown,
  ): Result<{ session: PlayingSession | EndedSession; renderCtx: unknown }, string> {
    const session = this.#sessions.get(channelId);
    if (!session) return err("No active session in this channel");
    if (session.phase !== "PLAYING") return err("No game is in progress in this channel");

    const { definition, state, seats } = session;
    const validated = definition.validateMove(state, move, playerId) as Result<void, string>;
    if (!validated.ok) return err(validated.error);

    const serializedMove = definition.serializeMove(move);
    const newState = definition.applyMove(state, move, playerId) as unknown;
    const outcome = definition.outcome(newState) as GameOutcome | null;
    const moveNumber = (state as { moveNumber: number }).moveNumber;

    if (outcome) {
      const ended: EndedSession = {
        phase: "FINISHED",
        channelId,
        sessionId: session.sessionId,
        gameId: session.gameId,
        seats,
        outcome,
        ...(session.messageId !== undefined && { messageId: session.messageId }),
      };
      this.#sessions.set(channelId, ended);
      const updatedPlaying: PlayingSession = { ...session, state: newState };
      persistMoveAndState(this.#db, updatedPlaying, playerId, serializedMove, moveNumber);
      persistEnded(this.#db, ended);
      return ok({ session: ended, renderCtx: definition.buildRenderContext(newState, seats) });
    }

    const updated: PlayingSession = { ...session, state: newState };
    this.#sessions.set(channelId, updated);
    persistMoveAndState(this.#db, updated, playerId, serializedMove, moveNumber);
    return ok({ session: updated, renderCtx: definition.buildRenderContext(newState, seats) });
  }

  /**
   * Upserts the player record then creates or joins a lobby for `channelId`.
   * First caller becomes the host (LOBBY); second caller starts the game (PLAYING).
   * Returns the resulting session, or an error string if the channel already has
   * an active session the player can't join (e.g. game in progress with other players).
   */
  autoJoin(
    channelId: string,
    gameId: string,
    playerId: PlayerId,
    username: string,
  ): Result<LobbySession | PlayingSession, string> {
    ensurePlayer(this.#db, playerId, username);

    const existing = this.#sessions.get(channelId);

    if (!existing || existing.phase === "FINISHED" || existing.phase === "FORFEITED") {
      return this.createLobby(channelId, gameId, playerId);
    }

    if (existing.phase === "LOBBY") {
      // Already in lobby — joining again is a no-op, just return current session.
      if (existing.seats.includes(playerId)) return ok(existing);
      return this.joinLobby(channelId, playerId);
    }

    // PLAYING — only allow re-joins by existing participants.
    if (existing.phase === "PLAYING") {
      const isSeat = existing.seats.some((s) => s.playerId === playerId);
      if (isSeat) return ok(existing);
      return err("A game is already in progress in this channel");
    }

    return err("Unexpected session state");
  }

  setMessageId(channelId: string, messageId: string): void {
    const session = this.#sessions.get(channelId);
    if (!session) return;
    this.#sessions.set(channelId, { ...session, messageId } as Session);
    dbUpdateMessageId(this.#db, session.sessionId, messageId);
  }

  getSession(channelId: string): Session | undefined {
    return this.#sessions.get(channelId);
  }

  getSessionBySessionId(sessionId: string): Session | undefined {
    for (const s of this.#sessions.values()) {
      if (s.sessionId === sessionId) return s;
    }
    return undefined;
  }

  /** Channel ID for a given session ID (O(n) — sessions are small) */
  getChannelId(sessionId: string): string | undefined {
    for (const [channelId, s] of this.#sessions.entries()) {
      if (s.sessionId === sessionId) return channelId;
    }
    return undefined;
  }
}
