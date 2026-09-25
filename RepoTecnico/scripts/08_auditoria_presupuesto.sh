#!/usr/bin/env bash
# 08_auditoria_presupuesto.sh - Auditoria de acceso a datos + presupuesto con alertas.
set -euo pipefail
source "$(dirname "$0")/lib_gcp.sh"
echo "== [08] Auditoria y presupuesto =="

echo "-- Audit configs (acceso a datos en servicios sensibles) --"
api POST "https://cloudresourcemanager.googleapis.com/v1/projects/$PROJECT_ID:getIamPolicy" '{"options":{"requestedPolicyVersion":3}}' > /tmp/ggtov2_pol_a.json
python3 - <<'PY' > /tmp/ggtov2_pol_a_new.json
import json
p=json.load(open("/tmp/ggtov2_pol_a.json")); p["version"]=3
p["auditConfigs"]=[{"service":s,"auditLogConfigs":[{"logType":t} for t in ts]} for s,ts in [
 ("secretmanager.googleapis.com",["ADMIN_READ","DATA_READ","DATA_WRITE"]),
 ("cloudkms.googleapis.com",["ADMIN_READ","DATA_READ","DATA_WRITE"]),
 ("cloudsql.googleapis.com",["ADMIN_READ","DATA_WRITE"]),
 ("storage.googleapis.com",["ADMIN_READ","DATA_WRITE"])]]
print(json.dumps({"policy":p}))
PY
api POST "https://cloudresourcemanager.googleapis.com/v1/projects/$PROJECT_ID:setIamPolicy" "$(cat /tmp/ggtov2_pol_a_new.json)" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  auditConfigs:",[a["service"] for a in d.get("auditConfigs",[])] or "NO PERSISTIDO (revisar permisos/version 3)")'

echo "-- Presupuesto mensual con alertas al 50/90/100% --"
api POST "https://billingbudgets.googleapis.com/v1/billingAccounts/$BILLING_ACCOUNT/budgets" \
  "{\"budget\":{\"displayName\":\"GGTOv2 mensual\",\"amount\":{\"specifiedAmount\":{\"currencyCode\":\"USD\",\"units\":\"${BUDGET_USD:-50}\"}},\"thresholdRules\":[{\"thresholdPercent\":0.5},{\"thresholdPercent\":0.9},{\"thresholdPercent\":1.0}],\"budgetFilter\":{\"projects\":[\"projects/$PROJECT_ID\"]}}}" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  Presupuesto:",d.get("name") or d.get("error",{}).get("message"))'
