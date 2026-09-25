#!/usr/bin/env bash
# 02_red_privada.sh - VPC dedicada + subred + Private Service Access para Cloud SQL.
# Requiere: compute.googleapis.com y servicenetworking.googleapis.com habilitados.
set -euo pipefail
source "$(dirname "$0")/lib_gcp.sh"
VPC="ggtov2-vpc"
SUBNET="ggtov2-subnet"
PSA_RANGE="ggtov2-psa-range"
PSA_PREFIX=20
echo "== [02] Red privada $VPC ($REGION) =="

existe_net() { api GET "https://compute.googleapis.com/compute/v1/projects/$PROJECT_ID/global/networks/$VPC" | grep -q '"name"'; }

if ! existe_net; then
  api POST "https://compute.googleapis.com/compute/v1/projects/$PROJECT_ID/global/networks" \
    "{\"name\":\"$VPC\",\"autoCreateSubnetworks\":false,\"routingConfig\":{\"routingMode\":\"GLOBAL\"}}" >/dev/null
  echo "  VPC creada"
else echo "  VPC ya existe"; fi

if ! api GET "https://compute.googleapis.com/compute/v1/projects/$PROJECT_ID/regions/$REGION/subnetworks/$SUBNET" | grep -q '"name"'; then
  api POST "https://compute.googleapis.com/compute/v1/projects/$PROJECT_ID/regions/$REGION/subnetworks" \
    "{\"name\":\"$SUBNET\",\"ipCidrRange\":\"10.10.0.0/24\",\"network\":\"projects/$PROJECT_ID/global/networks/$VPC\",\"privateIpGoogleAccess\":true}" >/dev/null
  echo "  Subred creada (10.10.0.0/24, Private Google Access)"
else echo "  Subred ya existe"; fi

# Rango reservado para peering con servicios gestionados (Cloud SQL)
if ! api GET "https://compute.googleapis.com/compute/v1/projects/$PROJECT_ID/global/addresses/$PSA_RANGE" | grep -q '"name"'; then
  api POST "https://compute.googleapis.com/compute/v1/projects/$PROJECT_ID/global/addresses" \
    "{\"name\":\"$PSA_RANGE\",\"addressType\":\"INTERNAL\",\"purpose\":\"VPC_PEERING\",\"prefixLength\":$PSA_PREFIX,\"network\":\"projects/$PROJECT_ID/global/networks/$VPC\"}" >/dev/null
  echo "  Rango PSA creado (/ $PSA_PREFIX)"
else echo "  Rango PSA ya existe"; fi

# Conexion de peering (idempotente: si ya existe devuelve error benigno)
api POST "https://servicenetworking.googleapis.com/v1/projects/$PROJECT_ID/global/networks/$VPC/connections?force=true" \
  "{\"reservedPeeringRanges\":[\"$PSA_RANGE\"]}" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  Peering:",d.get("name") or d.get("error",{}).get("message"))'
echo "Red lista. Cloud SQL usara IP privada dentro de $VPC."
