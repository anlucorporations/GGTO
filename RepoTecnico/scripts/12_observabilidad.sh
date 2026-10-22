#!/usr/bin/env bash
# 12_observabilidad.sh - Métricas, alertas, uptime y retención de logs (D-155/H-15).
#
# Requiere una sesión de gcloud autenticada con permiso para Logging y Monitoring
# (por ejemplo, Cloud Shell). Es idempotente: crea o actualiza los objetos.
#
#   PROYECTO=truekeate-main ALERTA_EMAIL=operaciones@ejemplo.com \
#     bash RepoTecnico/scripts/12_observabilidad.sh
#
# Sin ALERTA_EMAIL las políticas se crean igual, pero no tendrán un canal de
# notificación; se pueden asociar después desde la consola de Monitoring.
set -euo pipefail

cd "$(dirname "$0")"
PROYECTO="${PROYECTO:-truekeate-main}"
PROJECT_ID="$PROYECTO"
REGION="${REGION:-europe-west1}"
SERVICIO="${SERVICIO:-ggto-web}"
ALERTA_EMAIL="${ALERTA_EMAIL:-}"

# lib_gcp.sh define PROJECT_ID solo si no viene definido y aporta gcp_token.
source ./lib_gcp.sh

LOG="https://logging.googleapis.com"
MON="https://monitoring.googleapis.com"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
TOKEN="$(gcp_token)"

_api() {
  local method="$1" url="$2" body="${3:-}" code
  if [[ -n "$body" ]]; then
    code=$(curl -sS -o "$TMP/resp" -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d "$body" "$url")
  else
    code=$(curl -sS -o "$TMP/resp" -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer $TOKEN" "$url")
  fi
  printf '%s' "$code"
}

_contiene_politica() {
  python3 - "$TMP/resp" "$1" <<'PY'
import json
import sys

try:
    datos = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    sys.exit(1)
sys.exit(0 if any(p.get("displayName") == sys.argv[2] for p in datos.get("alertPolicies", [])) else 1)
PY
}

_contiene_uptime() {
  python3 - "$TMP/resp" "$1" <<'PY'
import json
import sys

try:
    datos = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    sys.exit(1)
sys.exit(0 if any(c.get("displayName") == sys.argv[2] for c in datos.get("uptimeCheckConfigs", [])) else 1)
PY
}

echo "== APIs de observabilidad =="
gcloud services enable \
  logging.googleapis.com monitoring.googleapis.com \
  cloudtrace.googleapis.com clouderrorreporting.googleapis.com \
  --project="$PROJECT_ID" >/dev/null
echo "  = logging, monitoring, trace y error reporting habilitadas"

echo "== Métricas basadas en logs =="
crear_metrica() {
  local id="$1" desc="$2" filtro="$3" distribucion="${4:-no}"
  local url="$LOG/v2/projects/$PROJECT_ID/metrics/$id"
  local cuerpo code

  if [[ "$distribucion" == "si" ]]; then
    cuerpo=$(cat <<JSON
{"name":"projects/$PROJECT_ID/metrics/$id","description":"$desc","filter":"$filtro","valueExtractor":"EXTRACT(jsonPayload.ms)","bucketOptions":{"explicitBuckets":{"bounds":[50,100,250,500,1000,2000,5000,10000]}},"metricDescriptor":{"metricKind":"DELTA","valueType":"DISTRIBUTION","unit":"ms"}}
JSON
)
  else
    cuerpo=$(cat <<JSON
{"name":"projects/$PROJECT_ID/metrics/$id","description":"$desc","filter":"$filtro","metricDescriptor":{"metricKind":"DELTA","valueType":"INT64","unit":"1"}}
JSON
)
  fi

  code=$(_api PUT "$url" "$cuerpo")
  if [[ "$code" == "404" || "$code" == "405" ]]; then
    code=$(_api POST "$LOG/v2/projects/$PROJECT_ID/metrics" "$cuerpo")
  fi
  if [[ "$code" == "409" ]]; then
    # Ya existe: el PUT es la actualización idempotente.
    code=$(_api PUT "$url" "$cuerpo")
  fi
  if [[ "$code" != "200" ]]; then
    echo "ERROR al crear la métrica $id ($code): $(cat "$TMP/resp")" >&2
    return 1
  fi
  echo "  = $id"
}

crear_metrica ggto_ingesta_completada "Ingesta diaria completada" \
  'resource.type=\"cloud_run_revision\" AND jsonPayload.evento=\"ingesta_completada\"'
crear_metrica ggto_notificacion_fallida "Notificación que agotó los reintentos" \
  'resource.type=\"cloud_run_revision\" AND jsonPayload.evento=\"notificacion_fallida\"'
crear_metrica ggto_http_5xx "Respuestas HTTP 5xx" \
  'resource.type=\"cloud_run_revision\" AND jsonPayload.evento=\"http_request\" AND jsonPayload.status>=500'
crear_metrica ggto_http_latencia "Latencia de las peticiones HTTP (ms)" \
  'resource.type=\"cloud_run_revision\" AND jsonPayload.evento=\"http_request\"' si

echo "== Canal de notificación =="
CANAL=""
CANAL_JSON=""
if [[ -n "$ALERTA_EMAIL" ]]; then
  _api GET "$MON/v3/projects/$PROJECT_ID/notificationChannels" >/dev/null
  CANAL=$(python3 - "$TMP/resp" "$ALERTA_EMAIL" <<'PY'
import json
import sys

try:
    datos = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    sys.exit(0)
for canal in datos.get("notificationChannels", []):
    if canal.get("labels", {}).get("email_address") == sys.argv[2]:
        print(canal.get("name", ""))
        break
PY
)
  if [[ -z "$CANAL" ]]; then
    cuerpo=$(cat <<JSON
{"type":"email","displayName":"GGTO alertas","labels":{"email_address":"$ALERTA_EMAIL"}}
JSON
)
    code=$(_api POST "$MON/v3/projects/$PROJECT_ID/notificationChannels" "$cuerpo")
    if [[ "$code" == "200" ]]; then
      CANAL=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8")).get("name",""))' "$TMP/resp")
    else
      echo "ERROR al crear el canal ($code): $(cat "$TMP/resp")" >&2
    fi
  fi
  if [[ -n "$CANAL" ]]; then
    CANAL_JSON=",\"notificationChannels\":[\"$CANAL\"]"
    echo "  = $ALERTA_EMAIL"
  fi
else
  echo "  ! ALERTA_EMAIL vacío: las políticas se crean sin canal de notificación"
fi

crear_alerta() {
  local nombre="$1" cuerpo="$2" code
  _api GET "$MON/v3/projects/$PROJECT_ID/alertPolicies?pageSize=100" >/dev/null
  if _contiene_politica "$nombre"; then
    echo "  = $nombre"
    return 0
  fi
  code=$(_api POST "$MON/v3/projects/$PROJECT_ID/alertPolicies" "$cuerpo")
  if [[ "$code" != "200" ]]; then
    echo "ERROR al crear la política '$nombre' ($code): $(cat "$TMP/resp")" >&2
    return 1
  fi
  echo "  + $nombre"
}

echo "== Políticas de alerta =="
cuerpo=$(cat <<JSON
{
  "displayName": "GGTO - Ingesta diaria ausente",
  "combiner": "OR",
  "conditions": [{
    "displayName": "Sin ingesta completada en 23 horas",
    "conditionAbsent": {
      "filter": "metric.type=\"logging.googleapis.com/user/ggto_ingesta_completada\" AND resource.type=\"cloud_run_revision\"",
      "duration": "82800s",
      "aggregations": [{"alignmentPeriod": "3600s", "perSeriesAligner": "ALIGN_COUNT"}],
      "trigger": {"count": 1}
    }
  }],
  "alertStrategy": {"autoClose": "604800s"},
  "documentation": {"mimeType": "text/markdown", "content": "No se registró una ingesta completada en 23 h. Revise el CSV diario y el job de carga."},
  "severity": "WARNING"${CANAL_JSON}
}
JSON
)
crear_alerta "GGTO - Ingesta diaria ausente" "$cuerpo"

cuerpo=$(cat <<JSON
{
  "displayName": "GGTO - Errores 5xx o /ready caído",
  "combiner": "OR",
  "conditions": [{
    "displayName": "Respuestas 5xx en 5 minutos",
    "conditionThreshold": {
      "filter": "metric.type=\"logging.googleapis.com/user/ggto_http_5xx\" AND resource.type=\"cloud_run_revision\"",
      "comparison": "COMPARISON_GT",
      "thresholdValue": 0,
      "duration": "300s",
      "aggregations": [{"alignmentPeriod": "300s", "perSeriesAligner": "ALIGN_COUNT"}],
      "trigger": {"count": 1}
    }
  }],
  "alertStrategy": {"autoClose": "604800s"},
  "documentation": {"mimeType": "text/markdown", "content": "Hay respuestas 5xx, incluido /ready (503). Revise Cloud Run y la base de datos."},
  "severity": "ERROR"${CANAL_JSON}
}
JSON
)
crear_alerta "GGTO - Errores 5xx o /ready caído" "$cuerpo"

cuerpo=$(cat <<JSON
{
  "displayName": "GGTO - Notificaciones fallidas",
  "combiner": "OR",
  "conditions": [{
    "displayName": "Notificación FALLIDA en 15 minutos",
    "conditionThreshold": {
      "filter": "metric.type=\"logging.googleapis.com/user/ggto_notificacion_fallida\" AND resource.type=\"cloud_run_revision\"",
      "comparison": "COMPARISON_GT",
      "thresholdValue": 0,
      "duration": "900s",
      "aggregations": [{"alignmentPeriod": "900s", "perSeriesAligner": "ALIGN_COUNT"}],
      "trigger": {"count": 1}
    }
  }],
  "alertStrategy": {"autoClose": "604800s"},
  "documentation": {"mimeType": "text/markdown", "content": "Una notificación agotó los reintentos del outbox. Revise el canal (Telegram/correo) y la configuración."},
  "severity": "WARNING"${CANAL_JSON}
}
JSON
)
crear_alerta "GGTO - Notificaciones fallidas" "$cuerpo"

cuerpo=$(cat <<JSON
{
  "displayName": "GGTO - Latencia p95 superior a 2 s",
  "combiner": "OR",
  "conditions": [{
    "displayName": "p95 de latencia HTTP > 2000 ms en 10 minutos",
    "conditionThreshold": {
      "filter": "metric.type=\"logging.googleapis.com/user/ggto_http_latencia\" AND resource.type=\"cloud_run_revision\"",
      "comparison": "COMPARISON_GT",
      "thresholdValue": 2000,
      "duration": "600s",
      "aggregations": [{"alignmentPeriod": "300s", "perSeriesAligner": "ALIGN_PERCENTILE_95"}]
    }
  }],
  "alertStrategy": {"autoClose": "604800s"},
  "documentation": {"mimeType": "text/markdown", "content": "El percentil 95 de latencia supera 2 s. Revise la base de datos y las consultas del panel."},
  "severity": "WARNING"${CANAL_JSON}
}
JSON
)
crear_alerta "GGTO - Latencia p95 superior a 2 s" "$cuerpo"

echo "== Uptime de /health =="
URL=$(gcloud run services describe "$SERVICIO" --region "$REGION" --project "$PROJECT_ID" \
  --format='value(status.url)' 2>/dev/null || true)
HOST="${URL#https://}"
HOST="${HOST%/}"
if [[ -z "$HOST" ]]; then
  echo "  ! No se pudo obtener la URL de $SERVICIO; se omite el uptime check" >&2
else
  _api GET "$MON/v3/projects/$PROJECT_ID/uptimeCheckConfigs" >/dev/null
  if _contiene_uptime "GGTO /health"; then
    echo "  = GGTO /health ($HOST)"
  else
    cuerpo=$(cat <<JSON
{"displayName":"GGTO /health","monitoredResource":{"type":"uptime_url","labels":{"project_id":"$PROJECT_ID","host":"$HOST"}},"httpCheck":{"path":"/health","port":443,"useSsl":true,"validateSsl":true},"period":"300s","timeout":"10s","selectedRegions":["USA","EUROPE","SOUTH_AMERICA"]}
JSON
)
    code=$(_api POST "$MON/v3/projects/$PROJECT_ID/uptimeCheckConfigs" "$cuerpo")
    if [[ "$code" == "200" ]]; then
      echo "  + GGTO /health ($HOST), cada 5 minutos"
    else
      echo "ERROR al crear el uptime check ($code): $(cat "$TMP/resp")" >&2
    fi
  fi
fi

echo "== Retención de logs =="
if gcloud logging buckets update _Default --location=global --retention-days=30 \
  --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "  = _Default: 30 días"
else
  echo "  ! No se pudo fijar _Default a 30 días (requiere permisos de Logging Admin)" >&2
fi

echo
echo "Observabilidad configurada. Compruebe en Monitoring:"
echo "  - Alertas: Ingesta, 5xx//ready, Notificaciones y Latencia p95"
echo "  - Uptime: GGTO /health"
echo "  - Logs: filtro jsonPayload.evento=\"http_request\""
