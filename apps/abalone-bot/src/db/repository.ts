import { eq, and, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { players, gameSessions, sessionPlayers, moveHistory, playerStats } from "./schema.js";
import type { PlayerId, PlayerSeat } from "@glaude/shared";
import type { LobbySession, PlayingSession, EndedSession } from "../session-manager.js";
import { findGame } from "../games/registry.js";

// ─── Players ──────────────────────────────────────────────────────────────────

export const ensurePlayer = (db: Db, discordId: PlayerId, username: string): void => {
  db.insert(players)
    .values({ discordId, username, createdAt: new Date() })
    .onConflictDoUpdate({ target: players.discordId, set: { username } })
    .run();
};

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const persistLobby = (db: Db, session: LobbySession): void => {
  const now = new Date();
  db.insert(gameSessions)
    .values({
      id: session.sessionId,
      gameId: session.gameId,
      channelId: session.channelId,
      phase: "LOBBY",
      state: null,
      messageId: session.messageId ?? null,
      winnerId: null,
      forfeiter: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  db.insert(sessionPlayers)
    .values({ sessionId: session.sessionId, playerId: session.hostId, seatIndex: 0 })
    .run();
};

export const addSessionPlayer = (db: Db, sessionId: string, seat: PlayerSeat): void => {
  db.insert(sessionPlayers)
    .values({ sessionId, playerId: seat.playerId, seatIndex: seat.seatIndex })
    .onConflictDoNothing()
    .run();
};

export const persistPlaying = (db: Db, session: PlayingSession): void => {
  const serialized = session.definition.serializeState(session.state);
  db.update(gameSessions)
    .set({ phase: "PLAYING", state: serialized, updatedAt: new Date() })
    .where(eq(gameSessions.id, session.sessionId))
    .run();
  for (const seat of session.seats) {
    addSessionPlayer(db, session.sessionId, seat);
  }
};

export const persistMoveAndState = (
  db: Db,
  session: PlayingSession,
  playerId: PlayerId,
  serializedMove: string,
  moveNumber: number,
): void => {
  const serializedState = session.definition.serializeState(session.state);
  db.update(gameSessions)
    .set({ state: serializedState, updatedAt: new Date() })
    .where(eq(gameSessions.id, session.sessionId))
    .run();
  db.insert(moveHistory)
    .values({
      sessionId: session.sessionId,
      playerId,
      moveData: serializedMove,
      moveNumber,
      createdAt: new Date(),
    })
    .run();
};

export const persistEnded = (db: Db, session: EndedSession): void => {
  const { outcome } = session;
  db.update(gameSessions)
    .set({
      phase: session.phase,
      winnerId: outcome.kind === "WIN" || outcome.kind === "FORFEIT" ? outcome.winner : null,
      forfeiter: outcome.kind === "FORFEIT" ? outcome.forfeiter : null,
      updatedAt: new Date(),
    })
    .where(eq(gameSessions.id, session.sessionId))
    .run();

  for (const seat of session.seats) {
    const isWinner =
      (outcome.kind === "WIN" || outcome.kind === "FORFEIT") && outcome.winner === seat.playerId;
    const isForfeiter = outcome.kind === "FORFEIT" && outcome.forfeiter === seat.playerId;
    const isDraw = outcome.kind === "DRAW";

    db.insert(playerStats)
      .values({
        playerId: seat.playerId,
        gameId: session.gameId,
        wins: isWinner ? 1 : 0,
        losses: isForfeiter || (!isWinner && !isDraw) ? 1 : 0,
        draws: isDraw ? 1 : 0,
        elo: 1000,
      })
      .onConflictDoUpdate({
        target: [playerStats.playerId, playerStats.gameId],
        set: {
          wins: isWinner ? sql`${playerStats.wins} + 1` : playerStats.wins,
          losses:
            isForfeiter || (!isWinner && !isDraw)
              ? sql`${playerStats.losses} + 1`
              : playerStats.losses,
          draws: isDraw ? sql`${playerStats.draws} + 1` : playerStats.draws,
        },
      })
      .run();
  }
};

export const updateMessageId = (db: Db, sessionId: string, messageId: string): void => {
  db.update(gameSessions)
    .set({ messageId, updatedAt: new Date() })
    .where(eq(gameSessions.id, sessionId))
    .run();
};

// ─── Recovery ─────────────────────────────────────────────────────────────────

export type RecoveredLobby = {
  phase: "LOBBY";
  row: typeof gameSessions.$inferSelect;
  seats: (typeof sessionPlayers.$inferSelect)[];
};

export type RecoveredPlaying = {
  phase: "PLAYING";
  row: typeof gameSessions.$inferSelect;
  seats: (typeof sessionPlayers.$inferSelect)[];
};

export type RecoveredSession = RecoveredLobby | RecoveredPlaying;

export const loadActiveSessions = (db: Db): RecoveredSession[] => {
  const activeRows = db
    .select()
    .from(gameSessions)
    .all()
    .filter((row) => row.phase === "LOBBY" || row.phase === "PLAYING");

  const recovered: RecoveredSession[] = [];
  for (const row of activeRows) {
    const seats = db
      .select()
      .from(sessionPlayers)
      .where(eq(sessionPlayers.sessionId, row.id))
      .all();

    if (row.phase === "LOBBY") {
      recovered.push({ phase: "LOBBY", row, seats });
    } else {
      const def = findGame(row.gameId);
      if (!def || !row.state) continue;
      recovered.push({ phase: "PLAYING", row, seats });
    }
  }
  return recovered;
};
