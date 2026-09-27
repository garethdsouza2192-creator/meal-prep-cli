#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

npm install
pm2 delete meal-prep >/dev/null 2>&1 || true
pm2 start "npm run dev:tailscale" --name meal-prep --update-env

tailscale serve reset

echo "Starting Tailscale Serve on port 3001..."
tailscale serve 3001
