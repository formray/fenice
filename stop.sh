#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/lib.sh"

echo -e "\n${BLUE}🔥 FENICE Stop${NC}\n"

info "Stopping services..."
docker compose down
success "All services stopped"
