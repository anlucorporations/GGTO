#!/usr/bin/env bash
# 00_crear_proyecto.sh - Crea el proyecto GGTOv2 en la organizacion y vincula facturacion.
# Requiere permisos: resourcemanager.projects.create, resourcemanager.projects.createBillingAssignment.
set -euo pipefail
source "$(dirname "$0")/lib_gcp.sh"

echo "== [00] Proyecto $PROJECT_ID =="

EXISTE=$(api GET "https://cloudresourcemanager.googleapis.com/v1/projects/$PROJECT_ID")
if echo "$EXISTE" | grep -q '"projectId"'; then
  echo "El proyecto ya existe: $(echo "$EXISTE" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["projectId"],d["projectNumber"],d["lifecycleState"])')"
else
  echo "Creando proyecto $PROJECT_ID (nombre: GGTOv2)..."
  OP=$(api POST "https://cloudresourcemanager.googleapis.com/v1/projects" \
      "{\"projectId\":\"$PROJECT_ID\",\"name\":\"GGTOv2\",\"parent\":{\"type\":\"organization\",\"id\":\"$ORG_ID\"}}" \
      | python3 -c 'import sys,json;print(json.load(sys.stdin)["name"])')
  echo "Operacion: $OP"
  for i in $(seq 1 30); do
    D=$(api GET "https://cloudresourcemanager.googleapis.com/v1/$OP")
    if echo "$D" | grep -q '"done": true'; then echo "Proyecto creado."; break; fi
    echo "  esperando ($i)..."; sleep 6
  done
fi

echo "-- Vinculando cuenta de facturacion $BILLING_ACCOUNT --"
api PUT "https://cloudbilling.googleapis.com/v1/projects/$PROJECT_ID/billingInfo" \
  "{\"billingAccountName\":\"billingAccounts/$BILLING_ACCOUNT\"}" | python3 -m json.tool || true

echo "-- Estado de facturacion --"
api GET "https://cloudbilling.googleapis.com/v1/projects/$PROJECT_ID/billingInfo" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("billingEnabled =",d.get("billingEnabled"),"|",d.get("billingAccountName"))'

echo "NOTA: si aparece 'Cloud billing quota exceeded', la cuenta alcanzo el maximo de proyectos"
echo "permitidos (por defecto 5). Libere un cupo o solicite aumento de cuota antes de continuar."
