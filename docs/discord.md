# Discord Integration

## Bot vs Activity

| Concern | Bot (`apps/bot/`) | Activity (`apps/activity/`) |
|---------|-------------------|------------------------------|
| Protocol | Discord slash commands + REST | Embedded iframe via Discord SDK |
| Auth | `DISCORD_TOKEN` env var | OAuth2 via `@discord/embedded-app-sdk` |
| Game state | SQLite + in-memory `SessionManager` | WebSocket from bot |
| Rendering | Canvas PNG attached to message | SVG in browser |

## Bot Setup
- `DISCORD_TOKEN` + `DISCORD_CLIENT_ID` + `DISCORD_GUILD_ID` in `.env`
- Run `npx tsx --env-file=../../.env src/deploy-commands.ts` once to register slash commands
- Run `npx tsx --env-file=../../.env src/index.ts` to start bot

## Activity Setup
1. Discord Developer Portal → Application → Activities → enable
2. Run `cloudflared tunnel --url http://localhost:5173`
3. Set tunnel URL as URL Override in Activities settings
4. Set `VITE_DISCORD_CLIENT_ID` in `apps/activity/.env`

## Session ID
The Activity uses the Discord **channel ID** as `sessionId`. Both players in the same channel share one session. The bot WS server keys rooms by `sessionId`.

## Auth Flow (`discord-sdk.ts`)
```
DiscordSDK.ready()
  → sdk.commands.authorize({ client_id, scopes })
  → POST /api/auth (bot's api-server.ts on :3000)
      → discord OAuth token exchange
  → sdk.commands.authenticate({ access_token })
  → returns { userId, username, avatarUrl, sessionId(=channelId), wsUrl }
```

`wsUrl` is returned by the bot's `/api/auth` endpoint so the activity knows where to connect.

## API Server (`apps/bot/src/api-server.ts`)
- Port `:3000`
- `POST /api/auth` — exchanges Discord OAuth code for token, returns `wsUrl` + user info
- `GET /health` — liveness check

## WS Server (`apps/bot/src/ws-server.ts`)
- Port `:3001`
- Room = `sessionId` (channel ID) → `Set<WebSocket>`
- Auto-forfeit: 30s after room empties during active game
- New game flow: player sends `join` → `autoJoin` creates LOBBY → server auto-joins other sockets in room → both get `state` broadcast

## Slash Commands

| Command | File | Description |
|---------|------|-------------|
| `/game start <game>` | `game-start.ts` | Create lobby in channel |
| `/game join` | `game-join.ts` | Join active lobby |
| `/game forfeit` | `game-forfeit.ts` | Forfeit current game |
| `/game status` | `game-status.ts` | Show current board (canvas PNG) |
| `/game move` | `game-move.ts` | Submit a move (text-based fallback) |

## Env Variables

| Var | Used By | Purpose |
|-----|---------|---------|
| `DISCORD_TOKEN` | bot | Bot login |
| `DISCORD_CLIENT_ID` | bot, activity | OAuth client ID |
| `DISCORD_CLIENT_SECRET` | bot | OAuth token exchange |
| `DISCORD_GUILD_ID` | deploy-commands | Dev guild for fast command registration |
| `DATABASE_URL` | bot | SQLite path (default: `./data/glaude.db`) |
| `WS_PORT` | bot | WS server port (default: `3001`) |
| `API_PORT` | bot | API server port (default: `3000`) |
| `VITE_DISCORD_CLIENT_ID` | activity | SDK init |
| `VITE_WS_URL` | activity | Fallback WS URL if SDK doesn't provide one |
