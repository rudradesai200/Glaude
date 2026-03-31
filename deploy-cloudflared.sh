#!/bin/bash

# Glaude Cloudflared Deployment Script
# Exposes bot API, bot WS, and activity app through Cloudflare tunnel with logging

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

mkdir -p "$LOG_DIR"

# Clear old logs (fresh start on each run)
echo "Clearing old cloudflared logs..."
rm -f "$LOG_DIR"/cloudflared*.log

# Kill any existing cloudflared processes
pkill -f cloudflared 2>/dev/null || true
sleep 1

echo "Starting Cloudflare tunnel..."
echo "Mapping services:"
echo "  http://localhost:3002 -> Bot API"
echo "  http://localhost:3001 -> Bot WS"
echo "  http://localhost:5173 -> Activity Frontend"
echo ""

# Start cloudflared tunnel with logging to file
cloudflared tunnel --url http://localhost:3002 >> "$LOG_DIR/cloudflared.log" 2>&1 &

# Wait a moment for tunnel to establish
sleep 3

echo "Cloudflare tunnel started"
echo "Logs: $LOG_DIR/cloudflared.log"
echo ""
echo "Monitor tunnel:"
echo "  tail -f $LOG_DIR/cloudflared.log"
