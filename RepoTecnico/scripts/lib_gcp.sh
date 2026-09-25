#!/usr/bin/env bash
# lib_gcp.sh - Helpers de autenticación y llamadas REST a Google Cloud.
# Obtiene un access token en este orden: $GOOGLE_ACCESS_TOKEN, gcloud, metadata server, ADC de usuario.
set -euo pipefail
gcp_token() {
  if [[ -n "${GOOGLE_ACCESS_TOKEN:-}" ]]; then printf '%s' "$GOOGLE_ACCESS_TOKEN"; return; fi
  if command -v gcloud >/dev/null 2>&1 && gcloud auth print-access-token >/dev/null 2>&1; then
    gcloud auth print-access-token; return; fi
  # Credenciales de usuario almacenadas por gcloud (refresh_token) - útil cuando gcloud no ejecuta.
  local utok=""
  if [[ -f "$HOME/.config/gcloud/credentials.db" ]]; then
    utok=$(python3 - <<PY 2>/dev/null
import sqlite3,os,json,urllib.request,urllib.parse,sys
p=os.path.expanduser("~/.config/gcloud/credentials.db")
try:
    row=sqlite3.connect(p).execute(
      "select value from credentials where account_id=?",("${GCP_USER_ACCOUNT:-anlucorporations@gmail.com}",)).fetchone()
    d=json.loads(row[0])
    data=urllib.parse.urlencode({"client_id":d["client_id"],"client_secret":d["client_secret"],
      "refresh_token":d["refresh_token"],"grant_type":"refresh_token"}).encode()
    r=json.load(urllib.request.urlopen(urllib.request.Request(
      "https://oauth2.googleapis.com/token",data=data),timeout=20))
    print(r["access_token"])
except Exception:
    pass
PY
)
  fi
  if [[ -n "$utok" ]]; then printf '%s' "$utok"; return; fi
  if curl -s -m 3 -H "Metadata-Flavor: Google" \
      http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token >/dev/null 2>&1; then
    curl -s -H "Metadata-Flavor: Google" \
      http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token \
      | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])'; return; fi
  echo "ERROR: no se pudo obtener token" >&2; return 1
}
# api METHOD URL [json_body]
api() {
  local method="$1" url="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -s -X "$method" -H "Authorization: Bearer $(gcp_token)" -H "Content-Type: application/json" -d "$body" "$url"
  else
    curl -s -X "$method" -H "Authorization: Bearer $(gcp_token)" "$url"
  fi
}
PROJECT_ID="${PROJECT_ID:-ggtov2}"
REGION="${REGION:-europe-west1}"
BILLING_ACCOUNT="${BILLING_ACCOUNT:-013B00-B9A67C-014A43}"
ORG_ID="${ORG_ID:-253767381125}"
