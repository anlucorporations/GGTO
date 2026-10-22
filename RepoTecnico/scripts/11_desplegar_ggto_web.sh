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

echo "== 1/7 Comprobando sesión y proyecto =="
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
  1) Comprobar sesión y proyecto de gcloud
  2) Asegurar el token de mantenimiento (ggto-mantenimiento-token)
  3) Asegurar el bucket de evidencias (GCS, IAM y ciclo de vida)
  4) gcloud builds submit "$RAIZ/app" --tag "$IMAGEN"
  5) gcloud run deploy "$SERVICIO" --image "$IMAGEN" ... (Cloud SQL, secretos, SA)
  6) Verificación de /health, /ready, SPA y /manual/
  7) Programación de los trabajos de mantenimiento (Cloud Scheduler)
Vuelve a ejecutar con --confirmar para desplegar en producción.
EOF
  exit 0
fi

echo "== 2/7 Asegurando el token de mantenimiento =="
if ! gcloud secrets describe ggto-mantenimiento-token --project "$PROYECTO" >/dev/null 2>&1; then
  gcloud secrets create ggto-mantenimiento-token --replication-policy=automatic \
    --project "$PROYECTO" >/dev/null
  echo -n "$(openssl rand -hex 24)" | gcloud secrets versions add ggto-mantenimiento-token \
    --data-file=- --project "$PROYECTO" >/dev/null
  echo "  Secreto creado."
else
  echo "  Secreto existente: se conserva la versión vigente."
fi
gcloud secrets add-iam-policy-binding ggto-mantenimiento-token \
  --member="serviceAccount:$CUENTA_SERVICIO" \
  --role="roles/secretmanager.secretAccessor" --project "$PROYECTO" >/dev/null
echo "  Permiso de lectura concedido a $CUENTA_SERVICIO."

echo "== 3/7 Preparando el bucket de evidencias =="
BUCKET="${GGTO_BUCKET:-${PROYECTO}-ggto-evidencias}"
gcloud services enable storage.googleapis.com --project "$PROYECTO" >/dev/null
if ! gcloud storage buckets describe "gs://$BUCKET" --project "$PROYECTO" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" --project "$PROYECTO" --location "$REGION" \
    --uniform-bucket-level-access --public-access-prevention >/dev/null
  echo "  Bucket creado: gs://$BUCKET"
else
  echo "  Bucket existente: gs://$BUCKET"
fi
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$CUENTA_SERVICIO" \
  --role="roles/storage.objectUser" >/dev/null
LIFECYCLE="$(mktemp)"
cat > "$LIFECYCLE" <<'EOF'
{"lifecycle":{"rule":[{"action":{"type":"Delete"},"condition":{"age":730}}]}}
EOF
gcloud storage buckets update "gs://$BUCKET" --lifecycle-file="$LIFECYCLE" >/dev/null
rm -f "$LIFECYCLE"
echo "  Ciclo de vida: borrar objetos a los 730 días (respaldo de la purga D-153)."

echo "== 4/7 Construyendo la imagen en Cloud Build (Dockerfile multi-etapa) =="
gcloud builds submit "$RAIZ/app" --project "$PROYECTO" --tag "$IMAGEN"

echo "== 5/7 Desplegando el servicio $SERVICIO =="
gcloud run deploy "$SERVICIO" \
  --project "$PROYECTO" \
  --region "$REGION" \
  --image "$IMAGEN" \
  --port 8080 \
  --cpu 1 --memory 512Mi \
  --min-instances 0 --max-instances 10 \
  --timeout 300 \
  --add-cloudsql-instances "$INSTANCIA_SQL" \
  --set-env-vars "DB_HOST=/cloudsql/${INSTANCIA_SQL},DB_PORT=5432,DB_NAME=ggtov2,DB_USER=ggtov2_app,DB_SSLMODE=require,APP_ENV=production,GGTO_GCS_BUCKET=${BUCKET}" \
  --set-secrets "SECRET_KEY=ggto-secret-key:latest,DB_PASSWORD=ggtov2-db-password:latest,MANTENIMIENTO_TOKEN=ggto-mantenimiento-token:latest" \
  --service-account "$CUENTA_SERVICIO" \
  --allow-unauthenticated

echo "== 6/7 Verificando =="
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

echo "== 7/7 Programando los trabajos de mantenimiento (Cloud Scheduler) =="
gcloud services enable cloudscheduler.googleapis.com --project "$PROYECTO" >/dev/null
TOKEN_MANTENIMIENTO="$(gcloud secrets versions access latest \
  --secret=ggto-mantenimiento-token --project "$PROYECTO")"

programar_job() {
  local nombre="$1" cron="$2" ruta="$3"
  if gcloud scheduler jobs describe "$nombre" --location "$REGION" \
      --project "$PROYECTO" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "$nombre" --location "$REGION" --project "$PROYECTO" \
      --schedule "$cron" --time-zone "America/Caracas" --uri "$URL$ruta" \
      --http-method POST --update-headers "X-Mantenimiento-Token=$TOKEN_MANTENIMIENTO" >/dev/null
  else
    gcloud scheduler jobs create http "$nombre" --location "$REGION" --project "$PROYECTO" \
      --schedule "$cron" --time-zone "America/Caracas" --uri "$URL$ruta" \
      --http-method POST --headers "X-Mantenimiento-Token=$TOKEN_MANTENIMIENTO" >/dev/null
  fi
  echo "  $nombre  $cron  $ruta"
}

programar_job ggto-purgar "0 * * * *" "/api/v1/mantenimiento/purgar"
programar_job ggto-cerrar-sesiones "*/10 * * * *" "/api/v1/mantenimiento/cerrar-sesiones"
programar_job ggto-recordatorios-citas "*/15 * * * *" "/api/v1/mantenimiento/recordatorios-citas"
programar_job ggto-alarmas-despacho "*/30 * * * *" "/api/v1/mantenimiento/alarmas-despacho"
gcloud scheduler jobs list --location "$REGION" --project "$PROYECTO" \
  --format='table(name,schedule,state)'
