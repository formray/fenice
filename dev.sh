#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/lib.sh"

echo -e "\n${BLUE}🔥 FENICE Dev${NC}\n"

# Cleanup function to kill background processes
cleanup() {
  echo ""
  info "Stopping dev servers..."
  kill $BACKEND_PID 2>/dev/null || true
  wait $BACKEND_PID 2>/dev/null || true
  success "Stopped"
}
trap cleanup EXIT INT TERM

# Start MongoDB via docker-compose
info "Starting MongoDB..."
docker compose up -d mongodb
success "MongoDB running on localhost:27017"

# Wait for MongoDB to be ready
info "Waiting for MongoDB..."
until docker compose exec mongodb mongosh --eval "db.adminCommand('ping')" --quiet &> /dev/null; do
  sleep 1
done
success "MongoDB is ready"

# Start backend in background
info "Starting backend on :3000..."
npm run dev &
BACKEND_PID=$!

# Give backend a moment to start
sleep 2

# Start client (foreground — Ctrl+C stops everything via trap)
info "Starting client on :5173..."
echo -e "\n  ${GREEN}Backend${NC}  → http://localhost:3000"
echo -e "  ${GREEN}Client${NC}   → http://localhost:5173\n"
(cd "$SCRIPT_DIR/client" && npm run dev)
