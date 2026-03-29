# Backend

## Stack
Bun runtime · discord.js v14 · SQLite + Drizzle ORM · WebSocket server (`ws`)

## Entry Point
`apps/bot/src/index.ts` — bootstraps DB, migrations, SessionManager, WS server, API server, Discord client

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
