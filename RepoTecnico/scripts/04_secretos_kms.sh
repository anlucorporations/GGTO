#!/usr/bin/env bash
# 04_secretos_kms.sh - Cloud KMS (CMEK) + Secret Manager para informacion sensible.
# Requiere facturacion. Genera contrasenas aleatorias y las guarda SOLO en Secret Manager.
set -euo pipefail
source "$(dirname "$0")/lib_gcp.sh"
KR="ggtov2"; KEY_SEC="ggtov2-secrets"; KEY_STO="ggtov2-storage"
KMS="projects/$PROJECT_ID/locations/$REGION"
echo "== [04] KMS + Secret Manager =="

gcp_gen() { openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | head -c 32; }

# --- KMS keyring y claves (rotacion 90 dias) ---
if ! api GET "https://cloudkms.googleapis.com/v1/$KMS/keyRings/$KR" | grep -q '"name"'; then
  api POST "https://cloudkms.googleapis.com/v1/$KMS/keyRings?keyRingId=$KR" '{}' >/dev/null && echo "  Keyring $KR creado"
else echo "  Keyring $KR ya existe"; fi

crear_clave() { # id
  local id="$1"
  if api GET "https://cloudkms.googleapis.com/v1/$KMS/keyRings/$KR/cryptoKeys/$id" | grep -q '"name"'; then
    echo "  Clave $id ya existe"
  else
    api POST "https://cloudkms.googleapis.com/v1/$KMS/keyRings/$KR/cryptoKeys?cryptoKeyId=$id" \
      "{\"purpose\":\"ENCRYPT_DECRYPT\",\"rotationPeriod\":\"7776000s\"}" \
      | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  Clave",d.get("name") or d.get("error",{}).get("message"))'
  fi
}
crear_clave "$KEY_SEC"; crear_clave "$KEY_STO"

# --- Secretos con CMEK ---
crear_secreto() { # id, valor
  local id="$1" val="$2" keyname="projects/$PROJECT_ID/locations/$REGION/keyRings/$KR/cryptoKeys/$KEY_SEC"
  if api GET "https://secretmanager.googleapis.com/v1/projects/$PROJECT_ID/secrets/$id" | grep -q '"name"'; then
    echo "  Secreto $id ya existe (no se sobreescribe)"
  else
    api POST "https://secretmanager.googleapis.com/v1/projects/$PROJECT_ID/secrets?secretId=$id" \
      "{\"replication\":{\"userManaged\":{\"replicas\":[{\"location\":\"$REGION\",\"customerManagedEncryption\":{\"kmsKeyName\":\"$keyname\"}}]}}}" >/dev/null
    B64=$(printf '%s' "$val" | base64 -w0)
    api POST "https://secretmanager.googleapis.com/v1/projects/$PROJECT_ID/secrets/$id:addVersion" \
      "{\"payload\":{\"data\":\"$B64\"}}" \
      | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  Secreto creado:",d.get("name") or d.get("error",{}).get("message"))'
  fi
}
crear_secreto "ggtov2-db-password" "$(gcp_gen)"
crear_secreto "ggtov2-db-root-password" "$(gcp_gen)"
crear_secreto "ggtov2-app-secret-key" "$(gcp_gen)"
crear_secreto "ggtov2-django-secret-key" "$(gcp_gen)"

echo "-- Permiso de lectura al runtime --"
api POST "https://secretmanager.googleapis.com/v1/projects/$PROJECT_ID/secrets/ggtov2-db-password:getIamPolicy" '{}' >/dev/null 2>&1 || true
for s in ggtov2-db-password ggtov2-app-secret-key ggtov2-django-secret-key; do
  api POST "https://secretmanager.googleapis.com/v1/projects/$PROJECT_ID/secrets/$s:setIamPolicy" \
    "{\"policy\":{\"bindings\":[{\"role\":\"roles/secretmanager.secretAccessor\",\"members\":[\"serviceAccount:ggtov2-app@$PROJECT_ID.iam.gserviceaccount.com\"]}]}}" >/dev/null \
    && echo "  acceso concedido a ggtov2-app sobre $s"
done
