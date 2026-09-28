#!/usr/bin/env bash
# 11_desplegar_ggto_web.sh — Construye y despliega la plataforma GGTO en Cloud Run.
#
# Reconstruye la imagen multi-etapa de `app/Dockerfile` (backend FastAPI + SPA
# React, ahora con la sección AYUDA y los manuales en `app/web/public/manual`)
# y actualiza el servicio `ggto-web` en `truekeate-main/europe-west1`.
#
# USO
#   RepoTecnico/scripts/11_desplegar_ggto_web.sh                 # muestra el plan (no despliega)
#   RepoTecnico/scripts/11_desplegar_ggto_web.sh --confirmar     # construye y despliega
#   TAG=v15 RepoTecnico/scripts/.../11_desplegar_ggto_web.sh --confirmar
#
# Requisitos: gcloud autenticado con permisos sobre el proyecto; Cloud Build y
# Artifact Registry habilitados. No usa Docker local (la imagen se construye en
# Cloud Build). No escribe secretos en la línea de comandos: se inyectan por
# referencia a Secret Manager.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROYECTO="${PROYECTO:-truekeate-main}"
REGION="${REGION:-europe-west1}"
SERVICIO="${SERVICIO:-ggto-web}"
REPO_IMAGEN="${REPO_IMAGEN:-southamerica-east1-docker.pkg.dev/${PROYECTO}/truekeate-repo/ggto-web}"
TAG="${TAG:-v15}"
IMAGEN="${REPO_IMAGEN}:${TAG}"
INSTANCIA_SQL="${INSTANCIA_SQL:-${PROYECTO}:southamerica-east1:truekeate-db-dev}"
CUENTA_SERVICIO="${CUENTA_SERVICIO:-ggto-web-sa@${PROYECTO}.iam.gserviceaccount.com}"

# gcloud: se prefiere el SDK local (el de snap falla en este entorno).
if ! command -v gcloud >/dev/null 2>&1 || ! gcloud version >/dev/null 2>&1; then
  if [ -x "$HOME/google-cloud-sdk/bin/gcloud" ]; then
    export PATH="$HOME/google-cloud-sdk/bin:$PATH"
  fi
fi
command -v gcloud >/dev/null 2>&1 || { echo "ERROR: gcloud no está disponible." >&2; exit 1; }

CONFIRMAR=0
[ "${1:-}" = "--confirmar" ] && CONFIRMAR=1

cat <<EOF
== Despliegue GGTO en Cloud Run ==
  Proyecto        : $PROYECTO
  Región          : $REGION
  Servicio        : $SERVICIO
  Imagen          : $IMAGEN
  Instancia SQL   : $INSTANCIA_SQL
  Cuenta de servicio: $CUENTA_SERVICIO
  Contexto de build: $RAIZ/app (app/Dockerfile)
EOF

echo "== 1/4 Comprobando sesión y proyecto =="
CUENTA="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)"
[ -n "$CUENTA" ] || { echo "ERROR: no hay cuenta activa (ejecuta: gcloud auth login)." >&2; exit 1; }
echo "  Cuenta activa: $CUENTA"
gcloud config set project "$PROYECTO" >/dev/null
echo "  Revisión desplegada actual:"
gcloud run services describe "$SERVICIO" --project "$PROYECTO" --region "$REGION" \
  --format='value(status.latestReadyRevisionName,spec.template.spec.containers[0].image)' || true

if [ "$CONFIRMAR" -ne 1 ]; then
  cat <<EOF

== PLAN (sin ejecutar) ==
  1) gcloud builds submit "$RAIZ/app" --tag "$IMAGEN"
  2) gcloud run deploy "$SERVICIO" --image "$IMAGEN" ... (Cloud SQL, secretos, SA)
  3) Verificación de /health, /ready, SPA y /manual/
Vuelve a ejecutar con --confirmar para desplegar en producción.
EOF
  exit 0
fi

echo "== 2/4 Construyendo la imagen en Cloud Build (Dockerfile multi-etapa) =="
gcloud builds submit "$RAIZ/app" --project "$PROYECTO" --tag "$IMAGEN"

echo "== 3/4 Desplegando el servicio $SERVICIO =="
gcloud run deploy "$SERVICIO" \
  --project "$PROYECTO" \
  --region "$REGION" \
  --image "$IMAGEN" \
  --port 8080 \
  --cpu 1 --memory 512Mi \
  --min-instances 0 --max-instances 10 \
  --timeout 300 \
  --add-cloudsql-instances "$INSTANCIA_SQL" \
  --set-env-vars "DB_HOST=/cloudsql/${INSTANCIA_SQL},DB_PORT=5432,DB_NAME=ggtov2,DB_USER=ggtov2_app,DB_SSLMODE=require" \
  --set-secrets "SECRET_KEY=ggto-secret-key:latest,DB_PASSWORD=ggtov2-db-password:latest" \
  --service-account "$CUENTA_SERVICIO" \
  --allow-unauthenticated

echo "== 4/4 Verificando =="
URL="$(gcloud run services describe "$SERVICIO" --project "$PROYECTO" --region "$REGION" --format='value(status.url)')"
REV="$(gcloud run services describe "$SERVICIO" --project "$PROYECTO" --region "$REGION" --format='value(status.latestReadyRevisionName)')"
echo "  URL: $URL"
echo "  Revisión: $REV"
for ruta in /health /ready / /manual/ /manual/01-Tecnologia/01-plataforma.html; do
  codigo="$(curl -s -o /dev/null -w '%{http_code}' "$URL$ruta" || echo '000')"
  echo "  $codigo  $ruta"
done
echo
echo "Aviso: el servicio queda con acceso público (--allow-unauthenticated) y contiene PII"
echo "real; restringir el invocador antes de operar (ver estado_proyecto.md, pendientes)."
