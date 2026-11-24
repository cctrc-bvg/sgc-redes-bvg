#!/usr/bin/env bash
# Sobe o servidor standalone do build de produção (.next/standalone) para os testes E2E.
# Usado pelo playwright.config.ts; precisa de `npm run build` antes e de DATABASE_URL no ambiente.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

[[ -f .next/standalone/server.js ]] || { echo "Build não encontrado: rode 'npm run build' antes." >&2; exit 1; }
# O standalone não leva os arquivos estáticos nem a pasta public.
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

cd .next/standalone
export PORT="${PORT:-3123}" HOSTNAME="${HOSTNAME_E2E:-127.0.0.1}" APP_URL="${APP_URL:-http://127.0.0.1:${PORT:-3123}}"
exec node server.js
