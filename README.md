# Glaude

A Discord bot that hosts multiplayer board games as Discord Activities (embedded iframes).

**Current game:** [Abalone](docs/ABALONE.md) — a strategy marble-pushing game for two players.

## Architecture

```
apps/
  bot/       — Discord bot + WebSocket server (port 3001) + OAuth2 API server (port 3002)
  activity/  — React frontend served by Vite (port 5173), embedded as a Discord Activity

packages/
  games/abalone/  — Pure game logic (board, moves, rules)
  shared/         — Shared types and utilities
  engine/         — Game session engine
  discord-ui/     — Discord message/embed helpers
```

The bot manages game sessions and stores state in SQLite. When two players start a game, a Discord Activity is launched. Each player's browser connects to the bot's WebSocket server, which keeps both clients in sync.

```
Discord client → Cloudflare tunnel → Vite (5173) → WS proxy → Bot WS server (3001)
                                                   → HTTP proxy → API server (3002)
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Application client ID |
| `DISCORD_CLIENT_SECRET` | Yes | OAuth2 client secret (for the `/api/token` exchange) |
| `DATABASE_URL` | No | Path to SQLite DB file (default: `./glaude.db`) |
| `WS_PORT` | No | WebSocket server port (default: `3001`) |
| `API_PORT` | No | OAuth2 API server port (default: `3002`) |
| `VITE_DISCORD_CLIENT_ID` | Yes | Same client ID, injected into the Vite frontend |

`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `DISCORD_CLIENT_SECRET` come from the **Discord Developer Portal → Your App → Bot / OAuth2** pages.

`VITE_DISCORD_CLIENT_ID` must equal `DISCORD_CLIENT_ID`; it is a separate entry because Vite only exposes `VITE_*` variables to the browser.

## Local Discord Activity Setup

Running a Discord Activity locally requires exposing `localhost:5173` to the internet so Discord can load the iframe. The recommended tool is [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/do-more-with-tunnels/trycloudflare/).

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start the bot + servers

```bash
cd apps/bot
tsx src/deploy-commands.ts          # register slash commands (once)
tsx src/index.ts 2>&1 | tee ../../logs/bot.log
```

The bot starts three things: the Discord bot, the WS server on port 3001, and the OAuth2 API server on port 3002.

### 3. Start the Vite dev server

```bash
cd apps/activity
pnpm dev 2>&1 | tee ../../logs/activity.log
```

### 4. Start the Cloudflare tunnel

```bash
cloudflared tunnel --url http://localhost:5173 2>&1 | tee logs/cloudflared.log
```

Note the public URL printed in the output (e.g. `https://some-name.trycloudflare.com`).

### 5. Configure the Discord Developer Portal

Every time the tunnel URL changes (on each cloudflared restart), update two fields in the [Discord Developer Portal](https://discord.com/developers/applications):

1. **Activities → URL Mappings**
   - Add a mapping: prefix `/` → your tunnel URL (without `https://`)

2. **OAuth2 → Redirects**
   - Add: `https://<your-app-id>.discordsays.com/.proxy/`
   - (The app ID is your `DISCORD_CLIENT_ID`)

### 6. Test in Discord

1. Invite the bot to a server (OAuth2 scopes: `bot`, `applications.commands`; permissions: `Send Messages`, `Read Messages/View Channels`)
2. In a text channel: `/game start abalone`
3. Have a second user: `/game join`
4. Click the **Launch Activity** button that appears — both players should see the board and moves sync in real time

## Restarting servers

### When to Restart

Restart after:
- Changes to bot code, game logic, or activity frontend
- Cloudflared crashes or tunnel becomes unstable
- WebSocket or database connection issues
- Updating Discord application settings (OAuth2 redirect URLs, activity URL mappings)

### Quick Restart

```bash
# Kill all services
pkill -f "tsx watch src/index.ts"; pkill -f "vite"; pkill -f "cloudflared"

# Restart them (runs step-by-step commands)
./start-services.sh
```

Or restart individual services:
```bash
# Kill just the bot
pkill -f "apps/coup-bot.*tsx"
cd apps/coup-bot && pnpm tsx watch src/index.ts 2>&1 | tee ../../logs/coup-bot.log

# Kill just the activity
pkill -f "apps/coup-activity.*vite"
cd apps/coup-activity && pnpm vite -- --port 5174 2>&1 | tee ../../logs/coup-activity.log

# Kill just the tunnel
pkill -f cloudflared
cd apps/coup-activity && pnpm dev 2>&1 | tee ../../logs/coup-activity.log
```

### After Cloudflared Restart

Every time cloudflared restarts and gets a **new tunnel URL**, update the Discord Developer Portal immediately:

1. **Activities → URL Mappings**
   - Update the mapping: prefix `/` → your **new** tunnel URL (without `https://`)
   - Example: if new URL is `https://abc-123.trycloudflare.com`, use `abc-123.trycloudflare.com`

2. **OAuth2 → Redirects**
   - Update: `https://<your-app-id>.discordsays.com/.proxy/`
   - This maps to the tunnel URL internally; no change needed here unless the app ID changes

3. **Test the activity**
   - Start a new game session in Discord: `/game start coup`
   - If you see a **black screen**, check browser console (F12) for errors
   - Common issues:
     - `Invalid Origin` → OAuth2 redirect URL not registered correctly
     - `Token exchange failed: 500` → Bot is crashed or database error (check `logs/coup-bot.log`)
     - `WebSocket connection failed` → Tunnel not running or WS server port mismatch

### Database Reset

If the bot crashes during database operations:

```bash
# Clear the database (WARNING: deletes all game sessions!)
rm apps/coup-bot/glaude.db apps/abalone-bot/glaude.db

# Restart the bot
pkill -f "tsx.*src/index.ts"
cd apps/coup-bot && pnpm tsx watch src/index.ts 2>&1 | tee ../../logs/coup-bot.log
```

### Checking Logs

All logs are in `./logs/` with fresh entries on each startup:

```bash
# Monitor bot startup
tail -f logs/coup-bot.log

# Monitor activity frontend
tail -f logs/coup-activity.log

# Monitor tunnel
tail -f logs/cloudflared-coup.log

# See all errors since last restart
grep -i "error\|fail" logs/coup-bot.log
```
