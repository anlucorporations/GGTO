#!/usr/bin/env bash
# 05_storage_registry.sh - Bucket seguro (CMEK, sin acceso publico) + Artifact Registry.
set -euo pipefail
source "$(dirname "$0")/lib_gcp.sh"
BUCKET="ggtov2-assets-$(api GET "https://cloudresourcemanager.googleapis.com/v1/projects/$PROJECT_ID" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("projectNumber"))')"
KMSKEY="projects/$PROJECT_ID/locations/$REGION/keyRings/ggtov2/cryptoKeys/ggtov2-storage"
echo "== [05] Storage + Artifact Registry =="

if api GET "https://storage.googleapis.com/storage/v1/b/$BUCKET" | grep -q '"name"'; then
  echo "  Bucket ya existe: $BUCKET"
else
  api POST "https://storage.googleapis.com/storage/v1/b?project=$PROJECT_ID" \
    "{\"name\":\"$BUCKET\",\"location\":\"EUROPE-WEST1\",\"storageClass\":\"STANDARD\",\"defaultKmsKeyName\":\"$KMSKEY\",\"iamConfiguration\":{\"uniformBucketLevelAccess\":{\"enabled\":true},\"publicAccessPrevention\":\"enforced\"},\"versioning\":{\"enabled\":true},\"lifecycle\":{\"rule\":[{\"action\":{\"type\":\"Delete\"},\"condition\":{\"age\":365,\"isLive\":false}}]}}" \
    | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  Bucket:",d.get("name") or d.get("error",{}).get("message"))'
fi
# Retencion minima de 30 dias para objetos (WORM logico) - opcional
api PATCH "https://storage.googleapis.com/storage/v1/b/$BUCKET?fields=name" \
  "{\"retentionPolicy\":{\"retentionPeriod\":\"2592000\",\"isLocked\":false}}" >/dev/null 2>&1 && echo "  Retencion 30 dias aplicada"

# Artifact Registry (imagenes de la plataforma web)
if api GET "https://artifactregistry.googleapis.com/v1/projects/$PROJECT_ID/locations/$REGION/repositories/ggtov2-web" | grep -q '"name"'; then
  echo "  Repo ya existe"
else
  api POST "https://artifactregistry.googleapis.com/v1/projects/$PROJECT_ID/locations/$REGION/repositories?repositoryId=ggtov2-web" \
    '{"description":"Imagenes Docker de la plataforma web GGTOv2","format":"DOCKER","labels":{"proyecto":"ggtov2"}}' \
    | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  Repo:",d.get("name") or d.get("error",{}).get("message"))'
fi
echo "  Bucket: gs://$BUCKET"
