#!/usr/bin/env bash
#
# PVM one-command setup.
#
# Alternative to the manual steps in docs/connect-backend.md: generates a
# PVM_API_SECRET, writes a .env, builds PVM and starts it with Docker when
# available, otherwise with Node.js. Idempotent: safe to run again.
#
# Usage:
#   ./scripts/pvm-setup.sh                 # auto: Docker if present, else Node
#   ./scripts/pvm-setup.sh --mode node     # force Node.js
#   ./scripts/pvm-setup.sh --mode docker   # force Docker
#   ./scripts/pvm-setup.sh --ha-url http://homeassistant.local:8123 --ha-token eyJ...
#
set -euo pipefail

MODE="auto"
HA_URL=""
HA_TOKEN=""
PORT="${PVM_PORT:-7000}"

while [ $# -gt 0 ]; do
  case "$1" in
    --mode) MODE="${2:-}"; shift 2 ;;
    --ha-url) HA_URL="${2:-}"; shift 2 ;;
    --ha-token) HA_TOKEN="${2:-}"; shift 2 ;;
    --port) PORT="${2:-}"; shift 2 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> PVM setup in $ROOT"

# 1. Secret ------------------------------------------------------------------
if [ -n "${PVM_API_SECRET:-}" ]; then
  SECRET="$PVM_API_SECRET"
  echo "    Using PVM_API_SECRET from the environment."
elif [ -f .env ] && grep -q '^PVM_API_SECRET=.\+' .env; then
  SECRET="$(grep '^PVM_API_SECRET=' .env | head -1 | cut -d= -f2-)"
  echo "    Reusing PVM_API_SECRET from .env."
else
  if command -v openssl >/dev/null 2>&1; then
    SECRET="$(openssl rand -hex 32)"
  else
    SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  echo "    Generated a new PVM_API_SECRET."
fi

# 2. Write .env --------------------------------------------------------------
if [ ! -f .env ]; then
  cat > .env <<EOF
NODE_ENV=production
PVM_HOST=0.0.0.0
PVM_PORT=$PORT
PVM_LOG_LEVEL=INFO
PVM_API_SECRET=$SECRET
PVM_DB_PATH=./data/pvm.sqlite
PVM_DATA_DIR=./data
PVM_ADDONS_DIR=./data/addons
PVM_LOGS_DIR=./data/logs
HA_URL=$HA_URL
HA_TOKEN=$HA_TOKEN
HA_LOCAL_ONLY=true
EOF
  echo "    Wrote .env"
else
  echo "    .env already exists, leaving it untouched."
fi

# 3. Choose the mode ---------------------------------------------------------
if [ "$MODE" = "auto" ]; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    MODE="docker"
  else
    MODE="node"
  fi
fi

echo "    Mode: $MODE"

# 4. Start -------------------------------------------------------------------
if [ "$MODE" = "docker" ]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "!! Docker requested but not found." >&2; exit 1
  fi
  export PVM_API_SECRET="$SECRET"
  if [ -n "$HA_URL" ]; then export HA_URL; fi
  if [ -n "$HA_TOKEN" ]; then export HA_TOKEN; fi
  docker compose up -d --build
  echo "==> PVM is starting in Docker. Logs: docker compose logs -f pvm"
else
  command -v npm >/dev/null 2>&1 || { echo "!! Node.js/npm not found." >&2; exit 1; }
  [ -d node_modules ] || npm install
  npm run build
  export PVM_API_SECRET="$SECRET"
  if [ -n "$HA_URL" ]; then export HA_URL; fi
  if [ -n "$HA_TOKEN" ]; then export HA_TOKEN; fi
  echo "==> Starting PVM (Ctrl+C to stop)..."
  exec npm start
fi

echo
echo "==> PVM URL:      http://localhost:$PORT"
echo "==> PVM API token (paste into Home Assistant):"
echo "    $SECRET"
echo
echo "Next: open the PVM UI, paste your HA Long-Lived Access Token."
echo "If your HA URL is public (DuckDNS/Nabu Casa), allow non-local URLs in the setup assistant."
echo "Full guide: docs/connect-backend.md"
