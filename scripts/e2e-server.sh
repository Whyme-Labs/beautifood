#!/usr/bin/env bash
# Start a fresh production build for end-to-end tests: clean database, build, preview.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=${PORT:-5190}
npx void db reset --yes >/dev/null
eval "$(node scripts/vapid-keys.mjs | sed 's/^/export /')"
export APP_ENV=test
export MAIL_FROM="Beautifood <receipts@mail.example.test>"
export BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-e2e-better-auth-secret-0123456789abcdef}
export TOKEN_SECRET=${TOKEN_SECRET:-e2e-token-secret-0123456789abcdef}
export AUTH_TRUSTED_KEY=${AUTH_TRUSTED_KEY:-e2e-trusted}
export PUBLIC_URL="http://127.0.0.1:$PORT"
# The taste service (services/taste) on the next port, with a stand-in for Qloo's harness, so the
# taste brief is tested end to end: Worker → taste service → MCP → (fake) Qloo.
TASTE_PORT=$((PORT + 1))
TASTE_SECRET=${TASTE_SECRET:-e2e-taste-secret-0123456789abcdef0123}
[ -d services/taste/node_modules ] || npm ci --prefix services/taste --no-audit --no-fund --silent
TASTE_SECRET=$TASTE_SECRET QLOO_COMMAND="$(command -v node)" QLOO_ARGS="services/taste/test/fake-qloo.mjs" PORT=$TASTE_PORT node services/taste/server.mjs &
TASTE_PID=$!
trap 'kill $TASTE_PID 2>/dev/null' EXIT
# Void's local preview reads Worker env values from .env (gitignored; never deployed).
{
  echo "APP_ENV=$APP_ENV"
  echo "BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET"
  echo "TOKEN_SECRET=$TOKEN_SECRET"
  echo "AUTH_TRUSTED_KEY=$AUTH_TRUSTED_KEY"
  echo "PUBLIC_URL=$PUBLIC_URL"
  echo "STOREFRONT_DOMAIN=stores.test"
  echo "TASTE_URL=http://127.0.0.1:$TASTE_PORT"
  echo "TASTE_SECRET=$TASTE_SECRET"
  echo "VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY"
  echo "VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY"
} > .env
E2E_SEND_EMAIL=1 npx vite build >/dev/null
npx vite preview --port "$PORT" --host 127.0.0.1 --strictPort
