#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${1:-4173}"

printf '纸间 Resume Studio\n'
printf '  http://127.0.0.1:%s/\n\n' "$PORT"
printf '按 Ctrl+C 停止服务。\n'

exec python3 -m http.server "$PORT" --bind 127.0.0.1
