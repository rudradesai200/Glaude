# Deploy COUP Game to Discord

## Quick Start
COUP is already integrated into Glaude. The game code is complete and ready. Here's how to make it live on Discord:

## Step 1: Start All Services
```bash
# Terminal 1: Start bot and activity
./start-services.sh

# Terminal 2: Deploy cloudflared tunnel
./deploy-cloudflared.sh
```

Services will be:
- **Bot API**: `http://localhost:3002`
- **Bot WS**: `ws://localhost:3001`
- **Activity**: `http://localhost:5173`
- **Public Tunnel**: Check `logs/cloudflared.log` for the URL

## Step 2: Register Activity with Discord

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your Glaude application
3. Navigate to **Activities** (in the left menu)
4. Click **Enable Activities**
5. Set **URL Mappings**:
   - **Default**: Set to your cloudflared tunnel URL (e.g., `https://frog-activity-reader-dealer.trycloudflare.com`)
   - **Platform**: Supports all platforms
6. Save changes

## Step 3: Test in Discord

### Start a COUP Game
1. In any Discord channel where your bot is present:
   ```
   /game start coup
   ```
2. Another player runs:
   ```
   /game join
   ```
3. The activity will launch automatically in Discord

### Game Flow
- Both players see the COUP activity embedded in Discord
- Game state syncs over WebSocket to `ws://localhost:3001`
- Moves are sent via `/game move` slash command (text fallback)
- Can also use the activity UI directly for moves

## Environment Variables

**Required** (already set in `.env`):
```
DISCORD_TOKEN=your_token
DISCORD_CLIENT_ID=1487446385115664504
DISCORD_CLIENT_SECRET=your_secret
DATABASE_URL=./glaude.db
```

**Activity** (in `apps/activity/.env`):
```
VITE_DISCORD_CLIENT_ID=1487446385115664504
VITE_WS_URL=ws://localhost:3001
```

## Monitoring

All logs write to `logs/`:
```bash
# Watch all logs
tail -f logs/*.log

# Watch specific service
tail -f logs/bot.log        # Bot service
tail -f logs/activity.log   # React app
tail -f logs/cloudflared.log # Tunnel
```

## What's Already Done

✅ COUP game logic implemented in `packages/coup/`
✅ Game UI in `apps/activity/src/coup/`
✅ WebSocket integration for multiplayer
✅ Slash commands (`/game start`, `/game join`, `/game move`, etc.)
✅ Discord OAuth flow for the activity
✅ Session management and state sync

## Supported Games
- `abalone` — Hexagonal board strategy game
- `coup` — Deduction card game (newly implemented)

Use `/game start <game>` to start either.

## Troubleshooting

**Activity not loading?**
- Check cloudflared tunnel is running: `pgrep cloudflared`
- Verify tunnel URL is set in Discord Developer Portal
- Check `logs/activity.log` for errors

**WebSocket connection failed?**
- Ensure bot is running: `tail -f logs/bot.log`
- Verify `VITE_WS_URL` matches bot's actual WS address
- Check firewall/tunnel allows WebSocket

**Game state out of sync?**
- Restart both players (`/game forfeit` then `/game start`)
- Check `logs/bot.log` for session errors

## Public Deployment

For production:
1. Use a stable cloudflared tunnel (not the ephemeral one)
2. Update Discord Developer Portal with permanent tunnel URL
3. Consider deploying bot to a server (not localhost)
4. Use production Discord guild for testing before wider release

## Files Modified for COUP

Key files with COUP integration:
- `packages/coup/src/` — Game logic
- `apps/activity/src/coup/` — UI components
- `apps/activity/src/App.tsx` — Game selector
- `apps/bot/src/ws-server.ts` — WebSocket handler (game-agnostic)
- `apps/bot/src/session-manager.ts` — Session management (game-agnostic)
