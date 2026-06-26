#!/usr/bin/env bash
# Start the backend, automatically freeing the port first so you never have to
# manually kill a previous run. Usage:  ./run.sh
set -e
cd "$(dirname "$0")"

PORT=8008

# Kill anything already listening on the port (a previous dev server).
pids=$(lsof -ti "tcp:$PORT" 2>/dev/null || true)
if [ -n "$pids" ]; then
  echo "Freeing port $PORT (killing: $pids)"
  kill -9 $pids 2>/dev/null || true
  sleep 1
fi

echo "Starting backend on http://127.0.0.1:$PORT  (docs at /docs)"
exec venv/bin/uvicorn app.main:app --port "$PORT" --reload
