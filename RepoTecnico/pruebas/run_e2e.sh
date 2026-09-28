#!/usr/bin/env bash
# Pruebas E2E de GGTO (Fase 4) contra un esquema AISLADO (por defecto `ggto_e2e`).
#
# Requisitos:
#   - Cloud SQL Auth Proxy escuchando en $DB_PORT (por defecto 5433).
#   - LD_LIBRARY_PATH y FONTCONFIG_FILE (Chromium necesita librerías y fuentes).
#
# Uso:
#   DB_PASSWORD=... RepoTecnico/pruebas/run_e2e.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
E2E_DIR="$RAIZ/RepoTecnico/pruebas/e2e"
LOGS="$RAIZ/RepoTecnico/pruebas/logs"
PUERTO="${GGTO_E2E_PORT:-8090}"
ESQUEMA="${DB_SCHEMA:-ggto_e2e}"

export DB_HOST="${DB_HOST:-127.0.0.1}"
export DB_PORT="${DB_PORT:-5433}"
export DB_NAME="${DB_NAME:-ggtov2}"
export DB_USER="${DB_USER:-ggtov2_app}"
export DB_SSLMODE="${DB_SSLMODE:-disable}"
export DB_SCHEMA="$ESQUEMA"
export APP_ENV=test
export RATE_LIMIT_INTENTOS="${RATE_LIMIT_INTENTOS:-10000}"   # evita 429 por logins repetidos en E2E
export SECRET_KEY="${SECRET_KEY:-e2e-secret-key}"
export PYTHONPATH="$RAIZ"
export LD_LIBRARY_PATH="/home/dsh/tools/libs/usr/lib/x86_64-linux-gnu:/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export FONTCONFIG_FILE="${FONTCONFIG_FILE:-$HOME/.config/fontconfig/fonts.conf}"
export GGTO_E2E_URL="http://127.0.0.1:$PUERTO"

mkdir -p "$LOGS"

if [ -z "${DB_PASSWORD:-}" ]; then
  echo "ERROR: exporta DB_PASSWORD (o ejecuta con la variable definida)." >&2
  exit 1
fi
export DB_PASSWORD
export PGPASSWORD="$DB_PASSWORD"

echo "== 1/4 Comprobando PostgreSQL =="
PSQL="$HOME/bin/psql"; command -v "$PSQL" >/dev/null || PSQL=psql
"$PSQL" "host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER sslmode=$DB_SSLMODE" \
  -Atc "select 'ok';" >/dev/null

echo "== 2/4 Sembrando el esquema aislado $ESQUEMA =="
python3 "$RAIZ/RepoTecnico/pruebas/seed_e2e.py" | tee "$LOGS/seed.json"

echo "== 3/4 Levantando la aplicación en $GGTO_E2E_URL =="
python3 -m uvicorn app.main:app --host 127.0.0.1 --port "$PUERTO" --log-level warning \
  >"$LOGS/uvicorn.log" 2>&1 &
UVICORN=$!
trap 'kill $UVICORN 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  if curl -sf "$GGTO_E2E_URL/health" >/dev/null; then break; fi
  sleep 1
done
curl -sf "$GGTO_E2E_URL/health" >/dev/null || { echo "la app no respondió" >&2; exit 1; }

echo "== 4/4 Ejecutando Playwright =="
cd "$E2E_DIR"
set +e
npx playwright test "$@"
RESULTADO=$?
set -e

kill $UVICORN 2>/dev/null || true
trap - EXIT
echo "Resultado Playwright: $RESULTADO · informes en $LOGS"
exit $RESULTADO
