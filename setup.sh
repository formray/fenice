#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/lib.sh"

echo -e "\n${BLUE}🔥 FENICE Setup${NC}\n"

# Check prerequisites
info "Checking prerequisites..."
check_command node
check_command npm
check_command docker

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  error "Node.js 22+ required (found v$(node -v))"
  exit 1
fi
success "Node.js $(node -v)"

# Install backend dependencies
info "Installing backend dependencies..."
npm ci
success "Backend dependencies installed"

# Install client dependencies
info "Installing client dependencies..."
(cd "$SCRIPT_DIR/client" && npm ci)
success "Client dependencies installed"

# Copy .env if not exists
if [ ! -f .env ]; then
  info "Creating .env from .env.example..."
  cp .env.example .env
  success ".env created — please update with your values"
else
  success ".env already exists"
fi

# Copy client .env if not exists
if [ ! -f client/.env ]; then
  info "Creating client/.env from client/.env.example..."
  cp client/.env.example client/.env
  success "client/.env created — set VITE_WS_TOKEN after login"
else
  success "client/.env already exists"
fi

echo -e "\n${GREEN}✓ Setup complete!${NC}"
echo -e "  Run ${BLUE}./dev.sh${NC} to start backend + client"
