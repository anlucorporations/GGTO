#!/usr/bin/env bash
# 03_iam_cuentas_servicio.sh - Cuentas de servicio e IAM de minimo privilegio.
set -euo pipefail
source "$(dirname "$0")/lib_gcp.sh"
APP="ggtov2-app"; DEP="ggtov2-deploy"
echo "== [03] Cuentas de servicio e IAM =="

crear_sa() { # id, display
  local id="$1" disp="$2"
  if api GET "https://iam.googleapis.com/v1/projects/$PROJECT_ID/serviceAccounts/$id@$PROJECT_ID.iam.gserviceaccount.com" | grep -q '"email"'; then
    echo "  SA ya existe: $id"
  else
    api POST "https://iam.googleapis.com/v1/projects/$PROJECT_ID/serviceAccounts" \
      "{\"accountId\":\"$id\",\"serviceAccount\":{\"displayName\":\"$disp\"}}" \
      | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  SA creada:",d.get("email") or d.get("error",{}).get("message"))'
  fi
}
crear_sa "$APP" "GGTOv2 App Runtime (Cloud Run)"
crear_sa "$DEP" "GGTOv2 CI/CD Deploy"

echo "-- Aplicando bindings --"
api POST "https://cloudresourcemanager.googleapis.com/v1/projects/$PROJECT_ID:getIamPolicy" '{"options":{"requestedPolicyVersion":3}}' > /tmp/ggtov2_pol.json
python3 - "$APP" "$DEP" <<'PY' > /tmp/ggtov2_pol_new.json
import json,sys
app,dep=sys.argv[1],sys.argv[2]
p=json.load(open("/tmp/ggtov2_pol.json")); p["version"]=3
def add(role,member):
    for b in p["bindings"]:
        if b["role"]==role:
            if member not in b["members"]: b["members"].append(member)
            return
    p["bindings"].append({"role":role,"members":[member]})
for r in ["roles/cloudsql.client","roles/secretmanager.secretAccessor","roles/logging.logWriter",
          "roles/monitoring.metricWriter","roles/cloudtrace.agent","roles/cloudprofiler.agent",
          "roles/serviceusage.serviceUsageConsumer","roles/cloudkms.cryptoKeyDecrypter"]:
    add(r,f"serviceAccount:{app}@ggtov2.iam.gserviceaccount.com")
for r in ["roles/run.admin","roles/artifactregistry.writer","roles/iam.serviceAccountUser",
          "roles/cloudbuild.builds.editor","roles/storage.objectAdmin","roles/cloudsql.client"]:
    add(r,f"serviceAccount:{dep}@ggtov2.iam.gserviceaccount.com")
print(json.dumps({"policy":p}))
PY
api POST "https://cloudresourcemanager.googleapis.com/v1/projects/$PROJECT_ID:setIamPolicy" "$(cat /tmp/ggtov2_pol_new.json)" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  bindings totales:",len(d.get("bindings",[])) if "bindings" in d else d.get("error",{}).get("message"))'
