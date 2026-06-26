#!/usr/bin/env bash
# Start the Node backend, freeing the port first so repeated runs are safe.
set -e
cd "$(dirname "$0")"

PORT="${PORT:-8008}"

if [ ! -f ".env" ]; then
  echo "Missing backend/.env."
  echo "Copy backend/.env.example to backend/.env and set DATABASE_URL + JWT_SECRET."
  exit 1
fi

if ! grep -qE '^DATABASE_URL=.+$' .env || ! grep -qE '^JWT_SECRET=.+$' .env; then
  echo "backend/.env is incomplete."
  echo "Set DATABASE_URL to your Neon connection string and JWT_SECRET to a strong random value."
  exit 1
fi

pids=$(lsof -ti "tcp:$PORT" 2>/dev/null || true)
if [ -n "$pids" ]; then
  echo "Freeing port $PORT (killing: $pids)"
  kill -9 $pids 2>/dev/null || true
  sleep 1
fi

echo "Starting backend on http://127.0.0.1:$PORT"
exec npm run dev
