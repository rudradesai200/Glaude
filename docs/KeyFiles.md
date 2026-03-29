## Frontend
Root = `apps/activity/`

| File | Purpose |
|------|---------|
| `src/main.tsx` | Entry — initializes Discord SDK, renders `<App>` |
| `src/App.tsx` | Top-level layout: `<GameProvider>` + `<BoardSVG>` + `<HUD>` + `<WinScreen>` |
| `src/discord-sdk.ts` | Discord SDK init, auth flow, returns `SdkAuth` with `userId`, `username`, `avatarUrl`, `sessionId`, `wsUrl` |
| `src/game-context.tsx` | React context — WebSocket connection, game state, `sendMove`, `forfeit`, `startNewGame` |
| `src/hex-geometry.ts` | Axial→pixel math: `axialToPixel`, `hexVertices`, `directionVector`, `HEX_RADIUS`, `SVG_WIDTH`, `SVG_HEIGHT` |
| `src/components/BoardSVG.tsx` | 61 hex `<polygon>` cells + marble `<circle>` + `<MoveArrow>` chevrons |
| `src/components/HUD.tsx` | Turn banner, marble counts, forfeit button |
| `src/components/WinScreen.tsx` | Fullscreen overlay on game over — crown/defeat UI + "New Game" button |
| `src/components/InfoModal.tsx` | "How to play" modal |


## Backend
Root = `apps/bot/`

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
