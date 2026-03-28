# Backend

## Stack
Bun runtime · discord.js v14 · SQLite + Drizzle ORM · WebSocket server (`ws`)

## Entry Point
`apps/bot/src/index.ts` — bootstraps DB, migrations, SessionManager, WS server, API server, Discord client

## Key Files

| File | Purpose |
|------|---------|
| `apps/bot/src/session-manager.ts` | In-memory session state + DB persistence. Methods: `autoJoin`, `makeMove`, `forfeit`, `recover` |
| `apps/bot/src/ws-server.ts` | WebSocket server (`:3001`). Handles `join`/`move`/`forfeit` messages. Broadcasts state to room. Auto-forfeits after 30s empty room |
| `apps/bot/src/api-server.ts` | HTTP API (`:3000`) — serves `GET /auth` for Discord activity SDK token exchange |
| `apps/bot/src/interaction-handler.ts` | Routes Discord slash command interactions to handlers |
| `apps/bot/src/commands/` | One file per command: `game-start`, `game-join`, `game-forfeit`, `game-status`, `game-move` |
| `apps/bot/src/games/registry.ts` | Game registry — add a game by importing its definition + one line |
| `apps/bot/src/db/schema.ts` | Drizzle schema: `players`, `game_sessions`, `session_players`, `move_history`, `player_stats` |
| `apps/bot/src/db/repository.ts` | DB helpers: `ensurePlayer`, `persistLobby`, `persistPlaying`, `persistMoveAndState`, `persistEnded`, `loadActiveSessions` |

## Session Lifecycle
`LOBBY → PLAYING → FINISHED | FORFEITED`

- `autoJoin(sessionId, gameId, playerId, username)` — creates LOBBY or joins existing; if 2nd player joins, transitions to PLAYING
- Re-calling `autoJoin` on FINISHED/FORFEITED session creates a new LOBBY (used for "New Game")

## Session Types
```ts
LobbySession  { phase: "LOBBY";    seats: PlayerId[] }
PlayingSession { phase: "PLAYING";  seats: PlayerSeat[]; state: unknown; definition: GameDefinition }
EndedSession  { phase: "FINISHED"|"FORFEITED"; seats: PlayerSeat[]; outcome: GameOutcome }
```

## WS Wire Format

**Client → Server:**
```json
{ "type": "join",    "sessionId": "...", "userId": "...", "username": "..." }
{ "type": "move",    "sessionId": "...", "userId": "...", "move": { ... } }
{ "type": "forfeit", "sessionId": "...", "userId": "..." }
```

**Server → Client:**
```json
{ "type": "state",  "state": { "board": {}, "turn": "...", "capturedBy": {}, "moveNumber": 0, "players": ["blackId","whiteId"] } }
{ "type": "ended",  "outcome": { "kind": "WIN|FORFEIT|DRAW", "winner": "...", "forfeiter": "..." }, "state": { ... } }
{ "type": "error",  "message": "..." }
```

`players[0]` = black (seat 0, moves first), `players[1]` = white (seat 1).

## Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@glaude/shared` | `packages/shared/` | `Result<T,E>`, `GlaudeError`, branded types (`PlayerId`, `SessionId`, `GameId`), `GamePhase`, `GameOutcome`, `PlayerSeat` |
| `@glaude/engine` | `packages/engine/` | `GameDefinition<TState,TMove,TRenderCtx>` interface — 10 methods |
| `@glaude/game-abalone` | `packages/games/abalone/` | Abalone implementation of `GameDefinition` |

## Adding a New Game
1. Implement `GameDefinition<TState,TMove,TRenderCtx>` in `packages/games/<name>/`
2. Add one line to `apps/bot/src/games/registry.ts`

## Dev
```bash
cd apps/bot && npx tsx --env-file=../../.env src/index.ts
```
