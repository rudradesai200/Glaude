#!/bin/bash

# Glaude Services Startup Script
# Starts all services: abalone-bot, coup-bot, abalone-activity, coup-activity, and cloudflared tunnels

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables from .env
set -a
source "$(dirname "${BASH_SOURCE[0]}")/.env"
set +a

# Verify required variables are set
if [ -z "$ABALONE_TOKEN" ] || [ -z "$ABALONE_CLIENT_ID" ] || [ -z "$COUP_TOKEN" ] || [ -z "$COUP_CLIENT_ID" ]; then
  echo "❌ Missing required Discord tokens or client IDs in .env"
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

mkdir -p "$LOG_DIR"

# Clear old logs (fresh start on each run)
echo "Clearing old logs..."
rm -f "$LOG_DIR"/*.log

echo -e "${GREEN}Starting Glaude Services${NC}"
echo "Project root: $PROJECT_ROOT"
echo "Log directory: $LOG_DIR"

# Kill any existing processes
echo "Cleaning up old processes..."
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "cloudflared" 2>/dev/null || true
sleep 1

# ─── ABALONE BOT ──────────────────────────────────────────────────────────────
echo -e "${YELLOW}Starting Abalone Bot (WS: 3001, API: 3002)...${NC}"
(cd "$PROJECT_ROOT/apps/abalone-bot" && \
 DISCORD_TOKEN="$ABALONE_TOKEN" \
 DISCORD_CLIENT_ID="$ABALONE_CLIENT_ID" \
 DISCORD_CLIENT_SECRET="$ABALONE_CLIENT_SECRET" \
 DATABASE_URL="$DATABASE_URL" \
 WS_PORT='3001' \
 API_PORT='3002' \
 pnpm tsx watch src/index.ts >> "$LOG_DIR/abalone-bot.log" 2>&1) &
ABALONE_BOT_PID=$!
echo "Abalone Bot PID: $ABALONE_BOT_PID"

# ─── COUP BOT ─────────────────────────────────────────────────────────────────
echo -e "${YELLOW}Starting Coup Bot (WS: 3003, API: 3004)...${NC}"
(cd "$PROJECT_ROOT/apps/coup-bot" && \
 DISCORD_TOKEN="$COUP_TOKEN" \
 DISCORD_CLIENT_ID="$COUP_CLIENT_ID" \
 DISCORD_CLIENT_SECRET="$COUP_SECRET" \
 DATABASE_URL="$DATABASE_URL" \
 WS_PORT='3003' \
 API_PORT='3004' \
 pnpm tsx watch src/index.ts >> "$LOG_DIR/coup-bot.log" 2>&1) &
COUP_BOT_PID=$!
echo "Coup Bot PID: $COUP_BOT_PID"

# ─── ABALONE ACTIVITY ─────────────────────────────────────────────────────────
echo -e "${YELLOW}Starting Abalone Activity (port 5173)...${NC}"
(cd "$PROJECT_ROOT/apps/abalone-activity" && \
 VITE_DISCORD_CLIENT_ID="$ABALONE_CLIENT_ID" \
 pnpm vite >> "$LOG_DIR/abalone-activity.log" 2>&1) &
ABALONE_ACTIVITY_PID=$!
echo "Abalone Activity PID: $ABALONE_ACTIVITY_PID"

# ─── COUP ACTIVITY ────────────────────────────────────────────────────────────
echo -e "${YELLOW}Starting Coup Activity (port 5174)...${NC}"
(cd "$PROJECT_ROOT/apps/coup-activity" && \
 VITE_DISCORD_CLIENT_ID="$COUP_CLIENT_ID" \
 pnpm vite -- --port 5174 >> "$LOG_DIR/coup-activity.log" 2>&1) &
COUP_ACTIVITY_PID=$!
echo "Coup Activity PID: $COUP_ACTIVITY_PID"

# ─── CLOUDFLARED TUNNELS ──────────────────────────────────────────────────────
# Note: Cloudflared tunnels require manual setup with cloudflare account and cert.pem
# For now, we start them but they won't work without proper authentication
echo -e "${YELLOW}Starting Cloudflared Tunnel for Abalone Activity (port 5173)...${NC}"
cloudflared tunnel --url http://localhost:5173 >> "$LOG_DIR/cloudflared-abalone.log" 2>&1 &
ABALONE_TUNNEL_PID=$!
echo "Abalone Tunnel PID: $ABALONE_TUNNEL_PID"

echo -e "${YELLOW}Starting Cloudflared Tunnel for Coup Activity (port 5174)...${NC}"
cloudflared tunnel --url http://localhost:5174 >> "$LOG_DIR/cloudflared-coup.log" 2>&1 &
COUP_TUNNEL_PID=$!
echo "Coup Tunnel PID: $COUP_TUNNEL_PID"

echo ""
echo -e "${GREEN}Services Started!${NC}"
echo ""
echo -e "${BLUE}Abalone:${NC}"
echo "  Bot API: http://localhost:3002"
echo "  Bot WS:  ws://localhost:3001"
echo "  Activity: http://localhost:5173"
echo ""
echo -e "${BLUE}Coup:${NC}"
echo "  Bot API: http://localhost:3004"
echo "  Bot WS:  ws://localhost:3003"
echo "  Activity: http://localhost:5174"
echo ""
echo "Logs:"
echo "  Abalone Bot: $LOG_DIR/abalone-bot.log"
echo "  Coup Bot: $LOG_DIR/coup-bot.log"
echo "  Abalone Activity: $LOG_DIR/abalone-activity.log"
echo "  Coup Activity: $LOG_DIR/coup-activity.log"
echo "  Abalone Tunnel: $LOG_DIR/cloudflared-abalone.log"
echo "  Coup Tunnel: $LOG_DIR/cloudflared-coup.log"
echo ""
echo "Monitor logs with:"
echo "  tail -f $LOG_DIR/abalone-bot.log"
echo "  tail -f $LOG_DIR/coup-bot.log"
echo "  tail -f $LOG_DIR/abalone-activity.log"
echo "  tail -f $LOG_DIR/coup-activity.log"
echo "  tail -f $LOG_DIR/cloudflared-abalone.log"
echo "  tail -f $LOG_DIR/cloudflared-coup.log"
echo ""
echo "Note: Update token and client ID values in .env with your registered Discord apps"

# Wait for all services
wait $ABALONE_BOT_PID $COUP_BOT_PID $ABALONE_ACTIVITY_PID $COUP_ACTIVITY_PID $ABALONE_TUNNEL_PID $COUP_TUNNEL_PID
