# Frontend (Discord Activity)

## Stack
Vite + React · SVG board · `@discord/embedded-app-sdk` · TypeScript strict

## App Root
`apps/activity/src/main.tsx` → `App.tsx` → `GameProvider` wraps everything

## Key Files

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

## Game Context (`game-context.tsx`)

Key values provided:
```ts
{
  state: AbaloneState,
  myPlayerId: PlayerId,       // current user's Discord ID
  opponentId: PlayerId,       // derived from players[] array
  blackPlayerId: PlayerId,    // players[0] = seat 0 = black marbles
  myUsername: string,
  myAvatarUrl: string | null,
  sendMove(move): void,
  forfeit(): void,
  startNewGame(): void,       // sends "join" WS message; server auto-joins opponent
  connected: boolean,
  gameOver: GameOver | null,
}
```

`players: [PlayerId, PlayerId]` state is updated on every incoming WS `state`/`ended` message. `players[0]` = black (seat 0).

Dev mode (no WS/sessionId): uses `BroadcastChannel("glaude-dev")` for cross-tab sync.

## Board Interaction

Selection → arrows → move:
1. Click own marble(s) — max 3, must be collinear
2. `legalMoves(state)` filtered by selection → one `MoveArrow` per direction
3. Click arrow → `sendMove(move)` → WS → state broadcast → re-render

## Marble Colors
- Seat 0 (`blackPlayerId`) → `#1a1a1a` (dark)
- Seat 1 → `#f0f0f0` (light)
- Color is consistent for all viewers (not relative to `myPlayerId`)

## Visual States

| Element | Style |
|---------|-------|
| Selected marble | stroke `#facc15` (yellow), width 3 |
| Last-moved marble | stroke `#60a5fa` (blue), width 2 |
| Direction arrow | fill `#4ade80` (green), opacity 0.85 |
| Active player dot | border `#facc15` |

## WinScreen
Shown when `gameOver !== null`. Displays victory (crown) or defeat UI. "New Game" button calls `startNewGame()` which sends `join` to server — server auto-joins opponent via room scan, both players get `state` broadcast and game resets.

## Dev Workflow
```bash
pnpm --filter activity dev      # Vite on :5173
cloudflared tunnel --url http://localhost:5173
# set tunnel URL in Discord dev portal → Activities → URL Override
```

Env vars: `VITE_DISCORD_CLIENT_ID`, `VITE_WS_URL` (fallback if SDK doesn't provide wsUrl)
