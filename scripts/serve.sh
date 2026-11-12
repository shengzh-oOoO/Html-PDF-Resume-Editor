#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${1:-4173}"

exec python3 scripts/local_server.py "$PORT"
