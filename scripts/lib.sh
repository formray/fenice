#!/usr/bin/env bash
# Shared utilities for FENICE scripts

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

check_command() {
  if ! command -v "$1" &> /dev/null; then
    error "$1 is not installed"
    return 1
  fi
  success "$1 found"
}
