#!/usr/bin/env bash
# provision_all.sh - Ejecuta el aprovisionamiento completo de GGTOv2 en orden.
# Uso:  ./provision_all.sh              (solo pasos 00-03 y 08; no facturables)
#       CREAR_RECURSOS=si ./provision_all.sh   (incluye 04-07, generan costo)
set -euo pipefail
cd "$(dirname "$0")"
echo "############ GGTOv2 - aprovisionamiento ############"
./00_crear_proyecto.sh
./01_habilitar_apis.sh
./02_red_privada.sh
./03_iam_cuentas_servicio.sh
./08_auditoria_presupuesto.sh
if [[ "${CREAR_RECURSOS:-no}" == "si" ]]; then
  ./04_secretos_kms.sh
  ./05_storage_registry.sh
  ./06_cloudsql_postgres.sh
  # ./07_cloudrun_web.sh   # descomentar cuando exista una imagen en Artifact Registry
else
  echo "Recursos facturables OMITIDOS. Ejecute con CREAR_RECURSOS=si cuando la facturacion este activa."
fi
echo "############ Fin ############"
