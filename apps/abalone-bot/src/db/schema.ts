import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

// ─── players ──────────────────────────────────────────────────────────────────

export const players = sqliteTable("players", {
  discordId: text("discord_id").primaryKey(),
  username: text("username").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// ─── game_sessions ────────────────────────────────────────────────────────────

export const gameSessions = sqliteTable("game_sessions", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  channelId: text("channel_id").notNull(),
  phase: text("phase").notNull(), // LOBBY | PLAYING | FINISHED | FORFEITED
  state: text("state"), // JSON-serialized game state (null in LOBBY phase)
  messageId: text("message_id"), // Discord message id for in-place edits
  winnerId: text("winner_id"),
  forfeiter: text("forfeiter"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// ─── session_players ──────────────────────────────────────────────────────────

export const sessionPlayers = sqliteTable(
  "session_players",
  {
    sessionId: text("session_id").notNull(),
    playerId: text("player_id").notNull(),
    seatIndex: integer("seat_index").notNull(),
  },
  (t) => [uniqueIndex("session_players_session_seat").on(t.sessionId, t.seatIndex)],
);

// ─── move_history ─────────────────────────────────────────────────────────────

export const moveHistory = sqliteTable("move_history", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull(),
  playerId: text("player_id").notNull(),
  moveData: text("move_data").notNull(), // JSON-serialized move
  moveNumber: integer("move_number").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// ─── player_stats ─────────────────────────────────────────────────────────────

export const playerStats = sqliteTable(
  "player_stats",
  {
    playerId: text("player_id").notNull(),
    gameId: text("game_id").notNull(),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    elo: integer("elo").notNull().default(1000),
  },
  (t) => [uniqueIndex("player_stats_player_game").on(t.playerId, t.gameId)],
);
