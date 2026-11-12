#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/html-to-pdf.sh <input.html> [output.pdf]

Convert a standalone resume HTML file into an A4 PDF with headless Chrome.
Set CHROME_BIN if Chrome/Chromium is not in a default location.
EOF
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

INPUT="$1"
OUTPUT="${2:-${INPUT%.html}.pdf}"

if [[ ! -f "$INPUT" ]]; then
  echo "Input file not found: $INPUT" >&2
  exit 1
fi

# Resolve to absolute paths before Chrome changes its working directory.
INPUT_ABS="$(cd "$(dirname "$INPUT")" && pwd)/$(basename "$INPUT")"
OUTPUT_DIR="$(cd "$(dirname "$OUTPUT")" && pwd)"
OUTPUT_ABS="$OUTPUT_DIR/$(basename "$OUTPUT")"

CHROME_BIN="${CHROME_BIN:-}"
if [[ -z "$CHROME_BIN" ]]; then
  for candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$(command -v google-chrome || true)" \
    "$(command -v chromium || true)" \
    "$(command -v chromium-browser || true)"; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      CHROME_BIN="$candidate"
      break
    fi
  done
fi

if [[ -z "$CHROME_BIN" || ! -x "$CHROME_BIN" ]]; then
  echo "Chrome/Chromium not found. Set CHROME_BIN to the browser executable." >&2
  exit 1
fi

PROFILE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/papercv-chrome.XXXXXX")"
cleanup() { rm -rf "$PROFILE_DIR"; }
trap cleanup EXIT

# --no-sandbox is needed in some containerized environments. Set
# CHROME_NO_SANDBOX=0 to keep Chrome's sandbox enabled.
SANDBOX_FLAG="--no-sandbox"
if [[ "${CHROME_NO_SANDBOX:-1}" == "0" ]]; then
  SANDBOX_FLAG=""
fi

"$CHROME_BIN" \
  --headless=new \
  ${SANDBOX_FLAG:+"$SANDBOX_FLAG"} \
  --disable-gpu \
  --hide-scrollbars \
  --no-first-run \
  --no-default-browser-check \
  --no-pdf-header-footer \
  --run-all-compositor-stages-before-draw \
  --virtual-time-budget=3000 \
  --user-data-dir="$PROFILE_DIR" \
  --print-to-pdf="$OUTPUT_ABS" \
  "file://$INPUT_ABS"

if [[ ! -s "$OUTPUT_ABS" ]]; then
  echo "PDF was not created: $OUTPUT_ABS" >&2
  exit 1
fi

printf 'PDF written to %s\n' "$OUTPUT_ABS"
