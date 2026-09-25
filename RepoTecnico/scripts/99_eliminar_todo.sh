#!/usr/bin/env bash
# 99_eliminar_todo.sh - Teardown controlado de los recursos GGTOv2.
# Peligroso: requiere CONFIRM_DESTROY=ELIMINAR
set -euo pipefail
source "$(dirname "$0")/lib_gcp.sh"
[[ "${CONFIRM_DESTROY:-}" == "ELIMINAR" ]] || { echo "Abortado. Exporte CONFIRM_DESTROY=ELIMINAR"; exit 1; }
echo "== Eliminando recursos de $PROJECT_ID =="
# Instancia Cloud SQL (desactivar proteccion primero)
api PATCH "https://sqladmin.googleapis.com/v1/projects/$PROJECT_ID/instances/ggtov2-pg" \
  '{"settings":{"deletionProtectionEnabled":false}}' >/dev/null 2>&1 || true
api DELETE "https://sqladmin.googleapis.com/v1/projects/$PROJECT_ID/instances/ggtov2-pg" >/dev/null 2>&1 || true
api DELETE "https://run.googleapis.com/v2/projects/$PROJECT_ID/locations/$REGION/services/ggtov2-web" >/dev/null 2>&1 || true
api DELETE "https://artifactregistry.googleapis.com/v1/projects/$PROJECT_ID/locations/$REGION/repositories/ggtov2-web" >/dev/null 2>&1 || true
api DELETE "https://compute.googleapis.com/compute/v1/projects/$PROJECT_ID/global/networks/ggtov2-vpc" >/dev/null 2>&1 || true
for s in ggtov2-db-password ggtov2-db-root-password ggtov2-app-secret-key ggtov2-django-secret-key; do
  api DELETE "https://secretmanager.googleapis.com/v1/projects/$PROJECT_ID/secrets/$s" >/dev/null 2>&1 || true
done
echo "Recursos eliminados. El bucket y las claves KMS deben borrarse manualmente por su politica de retencion."
