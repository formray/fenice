#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/lib.sh"

echo -e "\n${BLUE}🔥 FENICE Dev${NC}\n"

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

# Start development server
info "Starting FENICE..."
npm run dev
