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

### Restarting servers

```bash
# Kill everything
pkill -f "tsx src/index.ts"; pkill -f "vite"; pkill -f "cloudflared"

# Then restart steps 2–4 above
```

After restarting cloudflared, repeat step 5 with the new tunnel URL.
