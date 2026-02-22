#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/lib.sh"

echo -e "\n${BLUE}🔥 FENICE Stop${NC}\n"

info "Stopping dev servers..."
pkill -f "vite" 2>/dev/null || true
pkill -f "tsx watch" 2>/dev/null || true
success "Dev servers stopped"

info "Stopping Docker services..."
docker compose down
success "All services stopped"
