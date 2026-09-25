#!/usr/bin/env bash
# 01_habilitar_apis.sh - Habilita las APIs de GCP requeridas por GGTOv2.
# La mayoria requiere facturacion activa en el proyecto.
set -euo pipefail
source "$(dirname "$0")/lib_gcp.sh"
NUM=$(api GET "https://cloudresourcemanager.googleapis.com/v1/projects/$PROJECT_ID" \
      | python3 -c 'import sys,json;print(json.load(sys.stdin).get("projectNumber",""))')
[ -n "$NUM" ] || { echo "Proyecto no encontrado"; exit 1; }
echo "== [01] Habilitando APIs en $PROJECT_ID ($NUM) =="

SIN_BILLING="
cloudresourcemanager.googleapis.com serviceusage.googleapis.com iam.googleapis.com
iamcredentials.googleapis.com cloudbilling.googleapis.com sqladmin.googleapis.com
sql-component.googleapis.com servicenetworking.googleapis.com storage.googleapis.com
logging.googleapis.com monitoring.googleapis.com networkconnectivity.googleapis.com
cloudkms.googleapis.com cloudtrace.googleapis.com cloudprofiler.googleapis.com
clouderrorreporting.googleapis.com servicecontrol.googleapis.com
"
CON_BILLING="
compute.googleapis.com vpcaccess.googleapis.com secretmanager.googleapis.com
dlp.googleapis.com run.googleapis.com artifactregistry.googleapis.com
cloudbuild.googleapis.com containerregistry.googleapis.com certificatemanager.googleapis.com
billingbudgets.googleapis.com
"
for grupo in "SIN_BILLING" "CON_BILLING"; do
  echo "--- grupo $grupo ---"
  eval "LIST=\$$grupo"
  for s in $LIST; do
    R=$(api POST "https://serviceusage.googleapis.com/v1/projects/$NUM/services/$s:enable")
    if echo "$R" | grep -q '"error"'; then
      RZ=$(echo "$R" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["error"].get("details",[{}])[-1].get("reason","") or d["error"].get("message","")[:60])' 2>/dev/null)
      echo "  PENDIENTE $s  -> $RZ"
    else
      echo "  OK        $s"
    fi
  done
done
echo "Las APIs marcadas PENDIENTE requieren vincular la cuenta de facturacion (ver 00)."
