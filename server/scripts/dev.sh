#!/usr/bin/env bash
# Local SpacetimeDB module developer workflow.
# Requires the spacetime CLI: https://spacetimedb.com/install
#
# Usage:
#   ./scripts/dev.sh build      Build the module artifact
#   ./scripts/dev.sh start      Start a local SpacetimeDB server and publish the module
#   ./scripts/dev.sh generate   Generate TypeScript client bindings for the frontend
#   ./scripts/dev.sh publish    Publish the module to a running SpacetimeDB server
#
# Prerequisites:
#   1. Install the spacetime CLI (curl https://spacetimedb.com/install | sh)
#   2. Run `npm install` from the repo root
#
# Expected env vars (or defaults shown):
#   SPACETIME_DB_NAME   Name to publish the module under (default: solar-dominion)
#   SPACETIME_HOST      SpacetimeDB server host (default: localhost:3000)

set -euo pipefail

COMMAND="${1:-help}"
DB_NAME="${SPACETIME_DB_NAME:-solar-dominion}"
HOST="${SPACETIME_HOST:-localhost:3000}"
BINDINGS_DIR="../client/src/module_bindings"

case "$COMMAND" in
  build)
    echo "Building SpacetimeDB module..."
    spacetime build
    ;;
  start)
    echo "Starting local SpacetimeDB server and publishing module as '$DB_NAME'..."
    spacetime start --db-name "$DB_NAME" --anonymous-access
    ;;
  publish)
    echo "Publishing module to $HOST as '$DB_NAME'..."
    spacetime publish --db-name "$DB_NAME" --anonymous-access
    ;;
  generate)
    echo "Generating TypeScript client bindings into $BINDINGS_DIR..."
    mkdir -p "$BINDINGS_DIR"
    spacetime generate --lang typescript --out-dir "$BINDINGS_DIR"
    ;;
  help|*)
    echo "Usage: $0 {build|start|publish|generate}"
    echo ""
    echo "Requires spacetime CLI: https://spacetimedb.com/install"
    exit 0
    ;;
esac
