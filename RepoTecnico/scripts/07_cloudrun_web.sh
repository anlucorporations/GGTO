#!/usr/bin/env bash
# 07_cloudrun_web.sh - Despliegue de la plataforma web en Cloud Run con salida VPC directa.
# IMAGE debe existir en Artifact Registry. Ejecutar despues de 04, 05 y 06.
set -euo pipefail
source "$(dirname "$0")/lib_gcp.sh"
SERVICE="ggtov2-web"
IMAGE="${IMAGE:-$REGION-docker.pkg.dev/$PROJECT_ID/ggtov2-web/app:latest}"
echo "== [07] Cloud Run $SERVICE =="

BODY=$(python3 - "$SERVICE" "$IMAGE" "$PROJECT_ID" "$REGION" <<'PY'
import json,sys
svc,image,proj,region=sys.argv[1:5]
print(json.dumps({"template":{"containers":[{
  "image":image,
  "ports":[{"containerPort":8080}],
  "env":[
    {"name":"DB_USER","value":"ggtov2_app"},
    {"name":"DB_NAME","value":"ggtov2"},
    {"name":"DB_HOST","value":f"/cloudsql/{proj}:{region}:ggtov2-pg"},
    {"name":"SECRET_KEY","valueSource":{"secretKeyRef":{"secret":"ggtov2-app-secret-key","version":"latest"}}}
  ],
  "resources":{"limits":{"cpu":"1","memory":"512Mi"}}}],
  "vpcAccess":{"networkInterfaces":[{"network":"ggtov2-vpc","subnetwork":"ggtov2-subnet"}]},
  "scaling":{"minInstanceCount":0,"maxInstanceCount":10},
  "timeout":"300s"}}))
PY
)
api POST "https://run.googleapis.com/v2/projects/$PROJECT_ID/locations/$REGION/services?serviceId=$SERVICE" "$BODY" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  Servicio:",d.get("name") or d.get("error",{}).get("message"))'

echo "-- Acceso publico (invoker) --"
api POST "https://run.googleapis.com/v2/projects/$PROJECT_ID/locations/$REGION/services/$SERVICE:setIamPolicy" \
  '{"policy":{"bindings":[{"role":"roles/run.invoker","members":["allUsers"]}]}}' \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  IAM:", "OK" if "bindings" in d else d.get("error",{}).get("message"))'
echo "  URL: se obtiene con GET .../services/$SERVICE -> status.url"
echo "  Dominio propio: usar Domain Mapping de Cloud Run + certificado gestionado."
