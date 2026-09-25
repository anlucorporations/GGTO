#!/usr/bin/env bash
# 06_cloudsql_postgres.sh - Instancia Cloud SQL PostgreSQL 16 con IP privada, SSL y backups.
# PERFIL DEV (db-f1-micro, ZONAL). Para produccion cambiar TIER y HA=true.
# NO ejecutar sin facturacion vinculada: genera costo recurrente.
set -euo pipefail
source "$(dirname "$0")/lib_gcp.sh"
INSTANCE="ggtov2-pg"
DB_NAME="ggtov2"
DB_USER="ggtov2_app"
TIER="${TIER:-db-f1-micro}"
HA="${HA:-ZONAL}"
echo "== [06] Cloud SQL PostgreSQL ($INSTANCE, $TIER, $HA) =="

if api GET "https://sqladmin.googleapis.com/v1/projects/$PROJECT_ID/instances/$INSTANCE" | grep -q '"name"'; then
  echo "  La instancia ya existe."
else
  PWD_DB=$(api GET "https://secretmanager.googleapis.com/v1/projects/$PROJECT_ID/secrets/ggtov2-db-password/versions/latest:access" \
    | python3 -c 'import sys,json,base64;print(base64.b64decode(json.load(sys.stdin)["payload"]["data"]).decode())')
  PWD_ROOT=$(api GET "https://secretmanager.googleapis.com/v1/projects/$PROJECT_ID/secrets/ggtov2-db-root-password/versions/latest:access" \
    | python3 -c 'import sys,json,base64;print(base64.b64decode(json.load(sys.stdin)["payload"]["data"]).decode())')
  BODY=$(python3 - "$INSTANCE" "$TIER" "$HA" "$PWD_ROOT" "$PROJECT_ID" "$REGION" <<'PY'
import json,sys
inst,tier,ha,root,proj,region=sys.argv[1:7]
print(json.dumps({
 "name":inst,"region":region,"databaseVersion":"POSTGRES_16","rootPassword":root,
 "settings":{
   "tier":tier,"availabilityType":ha,"dataDiskType":"PD_SSD","dataDiskSizeGb":"10",
   "storageAutoResize":True,"storageAutoResizeLimit":"50",
   "backupConfiguration":{"enabled":True,"pointInTimeRecoveryEnabled":True,
       "transactionLogRetentionDays":7,"startTime":"03:00"},
   "ipConfiguration":{"ipv4Enabled":False,
       "privateNetwork":f"projects/{proj}/global/networks/ggtov2-vpc","sslMode":"ENCRYPTED_ONLY"},
   "deletionProtectionEnabled":True,
   "passwordValidationPolicy":{"minLength":12,"complexity":"COMPLEXITY_DEFAULT",
       "reuseInterval":5,"disallowUsernameSubstring":True},
   "databaseFlags":[{"name":"cloudsql.iam_authentication","value":"on"},
                    {"name":"log_min_duration_statement","value":"500"},
                    {"name":"log_connections","value":"on"}],
   "maintenanceWindow":{"day":7,"hour":3,"updateTrack":"stable"},
   "insightsConfig":{"queryInsightsEnabled":True,"recordClientAddress":True}
 }}))
PY
)
  OP=$(api POST "https://sqladmin.googleapis.com/v1/projects/$PROJECT_ID/instances" "$BODY" \
       | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("name") or "ERR:"+str(d.get("error",{}).get("message")))')
  echo "  Operacion: $OP"
  for i in $(seq 1 60); do
    D=$(api GET "https://sqladmin.googleapis.com/v1/projects/$PROJECT_ID/operations/$OP")
    S=$(echo "$D" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("status"))' 2>/dev/null)
    echo "  estado: $S"; [ "$S" = "DONE" ] && break; sleep 15
  done
fi

# Base de datos y usuario de aplicacion
api POST "https://sqladmin.googleapis.com/v1/projects/$PROJECT_ID/instances/$INSTANCE/databases" \
  "{\"name\":\"$DB_NAME\",\"instance\":\"$INSTANCE\",\"charset\":\"UTF8\"}" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  DB:",d.get("name") or d.get("error",{}).get("message"))'
PWD_DB=$(api GET "https://secretmanager.googleapis.com/v1/projects/$PROJECT_ID/secrets/ggtov2-db-password/versions/latest:access" \
  | python3 -c 'import sys,json,base64;print(base64.b64decode(json.load(sys.stdin)["payload"]["data"]).decode())')
api POST "https://sqladmin.googleapis.com/v1/projects/$PROJECT_ID/instances/$INSTANCE/users" \
  "{\"name\":\"$DB_USER\",\"password\":\"$PWD_DB\",\"host\":\"%\"}" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  Usuario:",d.get("name") or d.get("error",{}).get("message"))'

echo "-- Cadena de conexion (referencia) --"
echo "  postgresql://$DB_USER:<ggtov2-db-password>@<IP_PRIVADA>:5432/$DB_NAME?sslmode=require"
echo "  Obtener IP:  GET .../instances/$INSTANCE  ->  ipAddresses[]"
