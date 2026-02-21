#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/lib.sh"

echo -e "\n${YELLOW}⚠ FENICE Reset${NC}\n"
echo "This will remove: node_modules, dist, Docker volumes, coverage"
read -p "Continue? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  info "Cancelled"
  exit 0
fi

info "Stopping services..."
docker compose down -v 2>/dev/null || true

info "Cleaning build artifacts..."
rm -rf node_modules/ dist/ coverage/ .eslintcache

info "Reinstalling dependencies..."
npm ci

success "Reset complete! Run ./dev.sh to start fresh"
