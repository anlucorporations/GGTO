#!/usr/bin/env bash
# 10_usar_instancia_truekeate.sh
# Da de alta una base y usuario DEDICADOS para GGTOv2 dentro de la instancia
# Cloud SQL existente en truekeate-main, y habilita el acceso del runtime de GGTOv2.
#
# Instancia destino : truekeate-main:southamerica-east1:truekeate-db-dev
# Crea              : database ggtov2  /  user ggtov2_app
# Secretos          : ggtov2-db-password, ggtov2-db-connection (en truekeate-main)
set -euo pipefail
source "$(dirname "$0")/lib_gcp.sh"

ORIGEN_PROJECT="truekeate-main"   # proyecto que aloja la instancia
INSTANCE="truekeate-db-dev"
DB_NAME="ggtov2"
DB_USER="ggtov2_app"
CONN="$ORIGEN_PROJECT:southamerica-east1:$INSTANCE"
APP_SA="serviceAccount:ggtov2-app@ggtov2.iam.gserviceaccount.com"
TK_SA="serviceAccount:truekeate-app-sa@truekeate-main.iam.gserviceaccount.com"

echo "== [10] Usando $CONN para el proyecto GGTOv2 =="

# --- 1) Contraseña aleatoria (no se imprime) ---
PWD_DB=$(openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | head -c 32)

# --- 2) Secreto con la contraseña ---
if api GET "https://secretmanager.googleapis.com/v1/projects/$ORIGEN_PROJECT/secrets/ggtov2-db-password" | grep -q '"name"'; then
  echo "  Secreto ggtov2-db-password ya existe: se agrega nueva version"
else
  api POST "https://secretmanager.googleapis.com/v1/projects/$ORIGEN_PROJECT/secrets?secretId=ggtov2-db-password" \
    '{"replication":{"automatic":{}},"labels":{"proyecto":"ggtov2","tipo":"db-password"}}' >/dev/null
  echo "  Secreto ggtov2-db-password creado"
fi
B64=$(printf '%s' "$PWD_DB" | base64 -w0)
api POST "https://secretmanager.googleapis.com/v1/projects/$ORIGEN_PROJECT/secrets/ggtov2-db-password:addVersion" \
  "{\"payload\":{\"data\":\"$B64\"}}" >/dev/null && echo "  Version de contrasena agregada"

# --- 3) Secreto con el nombre de conexion ---
if api GET "https://secretmanager.googleapis.com/v1/projects/$ORIGEN_PROJECT/secrets/ggtov2-db-connection" | grep -q '"name"'; then
  echo "  Secreto ggtov2-db-connection ya existe"
else
  api POST "https://secretmanager.googleapis.com/v1/projects/$ORIGEN_PROJECT/secrets?secretId=ggtov2-db-connection" \
    '{"replication":{"automatic":{}},"labels":{"proyecto":"ggtov2","tipo":"db-connection"}}' >/dev/null
  C64=$(printf '%s' "$CONN" | base64 -w0)
  api POST "https://secretmanager.googleapis.com/v1/projects/$ORIGEN_PROJECT/secrets/ggtov2-db-connection:addVersion" \
    "{\"payload\":{\"data\":\"$C64\"}}" >/dev/null && echo "  Secreto ggtov2-db-connection creado"
fi

# --- 4) Permisos de lectura de los secretos ---
for s in ggtov2-db-password ggtov2-db-connection; do
  api POST "https://secretmanager.googleapis.com/v1/projects/$ORIGEN_PROJECT/secrets/$s:setIamPolicy" \
    "{\"policy\":{\"bindings\":[{\"role\":\"roles/secretmanager.secretAccessor\",\"members\":[\"$APP_SA\",\"$TK_SA\"]}]}}" >/dev/null \
    && echo "  secretAccessor -> $s"
done

# --- 5) Base de datos y usuario ---
if api GET "https://sqladmin.googleapis.com/v1/projects/$ORIGEN_PROJECT/instances/$INSTANCE/databases/$DB_NAME" | grep -q '"name"'; then
  echo "  Base $DB_NAME ya existe"
else
  api POST "https://sqladmin.googleapis.com/v1/projects/$ORIGEN_PROJECT/instances/$INSTANCE/databases" \
    "{\"name\":\"$DB_NAME\",\"instance\":\"$INSTANCE\",\"charset\":\"UTF8\"}" \
    | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  Base:",d.get("name") or d.get("error",{}).get("message"))'
fi

if api GET "https://sqladmin.googleapis.com/v1/projects/$ORIGEN_PROJECT/instances/$INSTANCE/users" | grep -q "\"name\": \"$DB_USER\""; then
  echo "  Usuario $DB_USER ya existe (no se cambia la contrasena)"
else
  api POST "https://sqladmin.googleapis.com/v1/projects/$ORIGEN_PROJECT/instances/$INSTANCE/users" \
    "{\"name\":\"$DB_USER\",\"password\":\"$PWD_DB\",\"host\":\"%\"}" \
    | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  Usuario:",d.get("name") or d.get("error",{}).get("message"))'
fi

# --- 6) Acceso IAM cruzado: runtime de GGTOv2 -> Cloud SQL en truekeate-main ---
api POST "https://cloudresourcemanager.googleapis.com/v1/projects/$ORIGEN_PROJECT:getIamPolicy" '{"options":{"requestedPolicyVersion":3}}' > /tmp/tk_pol.json
python3 - "$APP_SA" <<'PY' > /tmp/tk_pol_new.json
import json,sys
app=sys.argv[1]
p=json.load(open("/tmp/tk_pol.json")); p["version"]=3
def add(role,member):
    for b in p["bindings"]:
        if b["role"]==role:
            if member not in b["members"]: b["members"].append(member)
            return
    p["bindings"].append({"role":role,"members":[member]})
add("roles/cloudsql.client",app)
print(json.dumps({"policy":p}))
PY
api POST "https://cloudresourcemanager.googleapis.com/v1/projects/$ORIGEN_PROJECT:setIamPolicy" "$(cat /tmp/tk_pol_new.json)" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  IAM truekeate-main actualizado:",len(d.get("bindings",[])),"bindings" if "bindings" in d else d.get("error",{}).get("message"))'

echo
echo "== Resumen =="
echo "  connectionName : $CONN"
echo "  database       : $DB_NAME"
echo "  user           : $DB_USER"
echo "  password       : (solo en Secret Manager: ggtov2-db-password)"
echo "  socket Cloud Run: /cloudsql/$CONN"
