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
#   SPACETIME_HOST      SpacetimeDB server URL (default: http://localhost:3000)
#   SPACETIME_LISTEN_ADDR  Local server listen address (default: 0.0.0.0:3000)

set -euo pipefail

COMMAND="${1:-help}"
DB_NAME="${SPACETIME_DB_NAME:-solar-dominion}"
HOST="${SPACETIME_HOST:-http://localhost:3000}"
LISTEN_ADDR="${SPACETIME_LISTEN_ADDR:-0.0.0.0:3000}"
BINDINGS_DIR="../client/src/module_bindings"

case "$COMMAND" in
  build)
    echo "Building SpacetimeDB module..."
    spacetime build
    ;;
  start)
    echo "Starting local SpacetimeDB server on $LISTEN_ADDR..."
    spacetime start --listen-addr "$LISTEN_ADDR" --non-interactive
    ;;
  publish)
    echo "Publishing module to $HOST as '$DB_NAME'..."
    spacetime publish "$DB_NAME" --server "$HOST" --anonymous --yes
    ;;
  generate)
    echo "Generating TypeScript client bindings into $BINDINGS_DIR..."
    mkdir -p "$BINDINGS_DIR"
    spacetime generate --lang typescript --module-path . --out-dir "$BINDINGS_DIR" --yes
    ;;
  help|*)
    echo "Usage: $0 {build|start|publish|generate}"
    echo ""
    echo "Requires spacetime CLI: https://spacetimedb.com/install"
    exit 0
    ;;
esac
