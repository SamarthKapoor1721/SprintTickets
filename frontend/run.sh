#!/usr/bin/env bash
# Start the frontend, automatically freeing the port first so you never have to
# manually kill a previous run. Usage:  ./run.sh
set -e
cd "$(dirname "$0")"

PORT=4321

# Kill anything already listening on the port (a previous dev server).
pids=$(lsof -ti "tcp:$PORT" 2>/dev/null || true)
if [ -n "$pids" ]; then
  echo "Freeing port $PORT (killing: $pids)"
  kill -9 $pids 2>/dev/null || true
  sleep 1
fi

echo "Starting frontend on http://localhost:$PORT"
exec npm run dev
