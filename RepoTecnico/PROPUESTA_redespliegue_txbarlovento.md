# PROPUESTA — Redespliegue de GGTO (web + APK) en el GCP de TX Barlovento

> **⏱️ ESTADO: EJECUTADA el 06/11/2026** — en lugar de `barloventasv2` se
> creó un proyecto dedicado: **`ggto-prod-txblvento`** (nº 597577479284),
> enlazado a la cuenta de facturación ABIERTA `01E9E1-5892F8-EC5643`.
>
> | Recurso | Valor final |
> |---|---|
> | URL de la web/API | `https://ggto-web-597577479284.europe-west1.run.app` |
> | Revisión | `ggto-web-00001-dzx` (v100, 100 % del tráfico; `/health /ready` 200) |
> | Cloud SQL | `ggto-db` — PostgreSQL 15 `db-f1-micro` con **HA REGIONAL** en europe-west1 |
> | Datos | Dump de producción importado: 167 casos · 633 movimientos · 82 averías |
> | Scheduler | 5 jobs ENABLED en europe-west1 (App Engine creado) con `X-Mantenimiento-Token` |
> | Bucket | `gs://ggto-prod-txblvento-ggto-evidencias` (con el dump respaldado) |
> | APK | base URL nueva + versión `1.15.22+47` — APK compilada (24,2 MB) |
>
> El proyecto `truekeate-main` queda INTACTO (fase de apagado pendiente).

**Fecha de la propuesta:** 05/11/2026

---

## 1 · Resumen ejecutivo

Mudar la plataforma GGTO (API FastAPI + web React + APK Flutter) del proyecto
`truekeate-main` al proyecto **`barloventasv2`** en ~1 día de trabajo, con
**cero pérdida de datos** y reversibilidad: el repositorio ya está
empaquetado (v100, commit `ce781a0` en `C:\GGTO\backup_gcp_2026-11-05\`),
los scripts de despliegue ya están parametrizados y la BD se restablece
desde el dump de producción.

Beneficios: presupuesto y medio de pago separados del proyecto afectado,
portabilidad completa (se mantiene Cloud Run + Cloud SQL y el mismo
`Dockerfile`), sin código nuevo (todo lo necesario ya está en la rama
`GGTOv2-DSH-GCP` de GitHub y GitLab).

## 2 · Proyecto destino (precondiciones)

`barloventasv2` ya tiene activos: Cloud Run, Cloud Build y Artifact
Registry. Faltan estas 3 APIs (~10 min con gcloud):

```
sqladmin.googleapis.com
secretmanager.googleapis.com
cloudscheduler.googleapis.com
```

**⚠️ Precondición bloqueante (facturación):** `barloventasv2` está vinculado
a la MISMA cuenta cerrada (`013B00…`, `open: false`). Antes de empezar hay
que: (a) reactivar esa cuenta con el medio de pago, o (b) vincular
`barloventasv2` a otra cuenta de facturación activa de TX Barlovento.
Sin esto NADA arranca (misma respuesta `BILLING_DISABLED` que hoy bloquea
`truekeate-main`).

## 3 · Arquitectura destino

| Pieza | Recurso nuevo |
|---|---|
| Registro de imágenes | `europe-west1-docker.pkg.dev/barloventasv2/ggto` |
| API + web | Cloud Run `ggto-web` — 1 vCPU · 512 MiB · timeout 300 s · escala 0–10 · acceso público |
| Base de datos | Cloud SQL `ggto-db` — PostgreSQL 15, `db-f1-micro`, en **europe-west1** (misma región que Cloud Run: mejor latencia y menos coste de salida) |
| Secretos | `ggto-secret-key` · `ggtov2-db-password` · `ggto-mantenimiento-token` (se crean nuevos) |
| Evidencias / backups | Bucket `barloventasv2-ggto-evidencias` |
| Mantenimiento | 5 jobs del Scheduler en TZ `America/Caracas`: purgar (hora), cerrar-sesiones (10 min), recordatorios-citas (15 min), alarmas-despacho (30 min), cierre-jornada (23:00) |

## 4 · Qué se lleva y qué no

**Se lleva tal cual:**
- Código: branch `GGTOv2-DSH-GCP` @ `ce781a0` (v100) — ya en GitHub/GitLab y
  en el bundle local.
- Base de datos completa: el dump `ggtov2_backup.dump` (estados, bitácoras
  D-120, historiales, usuarios, accesos). Contiene PII real.
- Configuración de variables (los nombres `DB_*`, `APP_ENV`,
  `GGTO_GCS_BUCKET` son los mismos).

**Se cambian:**
- URL pública (Cloud Run entrega un subdominio propio).
- Los 3 secretos se recrean (como mínimo `SECRET_KEY`; la clave de BD será
  la de la instancia nueva — o la vigente si se restaura el dump tal cual).
- La APK re-publicada con la URL nueva embebida (build nuevo del mismo
  código de `app_movil`).

**No se lleva:**
- `node_modules`, `dist`, `build/` (se regeneran al compilar).
- Secreto de recuperación viejo (rutina de pago antiguos).
- Logs/traces históricos del proyecto viejo.

## 5 · Plan de ejecución (~1 día)

**Fase A — Infraestructura (2–3 h, con gcloud)**
1. Habilitar las 3 APIs faltantes.
2. Crear Artifact Registry `ggto` (europe-west1) y el bucket de evidencias.
3. Crear Cloud SQL `ggto-db` (PostgreSQL 15, `db-f1-micro`, europe-west1).
4. Crear cuenta de servicio `ggto-web-sa` con
   `roles/cloudsql.client` + `roles/secretmanager.secretAccessor`
   + `roles/storage.objectUser` (la BD también necesita
   `roles/storage.admin` sobre el bucket para sus exportaciones).
5. Crear los 3 secretos de Secret Manager.

**Fase B — Base de datos (1–2 h, paralela a A)**
6. Crear BD `ggtov2` y usuario `ggtov2_app`; restaurar el dump
   `ggtov2_backup.dump` (`pg_restore`). **Depende de completar el dump**:
   ver `README-backup.md` — la pieza pendiente es leer el secreto
   `ggtov2-db-password` (requiere factura activa) o que me pasen la clave
   vigente. Con el dump ya restaurado hay de propina una copia reciente.
7. Verificar el conteo principal: ~2.500+ casos, 21 masivas históricas de
   hoy, bitácora `caso_estado_hist` con los cierres del 04/11.

**Fase C — Despliegue web/API (30 min, el script hace todo)**
8. Clonar el repo desde el bundle o GitHub:
   `git clone C:\GGTO\backup_gcp_2026-11-05\ggto_repo.bundle GGTOv2`.
9. Ejecutar:

   ```bash
   TAG=v100 PROYECTO=barloventasv2 SERVICIO=ggto-web \
     INSTANCIA_SQL=barloventasv2:europe-west1:ggto-db \
     CUENTA_SERVICIO=ggto-web-sa@barloventasv2.iam.gserviceaccount.com \
     REPO_IMAGEN=europe-west1-docker.pkg.dev/barloventasv2/ggto/ggto-web \
     BUCKET=barloventasv2-ggto-evidencias \
     GGTO_BUCKET=barloventasv2-ggto-evidencias \
     RepoTecnico/scripts/11_desplegar_ggto_web.sh --confirmar
   ```

   El script construye la imagen multi-etapa (Node 20 → Python 3.12),
   despliega con los env-vars/secrets correctos, hornea el badge de
   versión en la navbar (`version.json`) y programa los 5 jobs del
   Scheduler con el token. Verificación: 200 en `/health /ready / /manual/`.

**Fase D — APK (1–2 h)**
10. Configurar la URL nueva de la API en `app_movil` (`core/constants.dart`,
    base URL) y compilar con el ciclo standard ya documentado
    (`publicar_apk.py`). Distribuyendo como hasta ahora (Play Store /APK
    directa), actualización D-107 ya cubre el caso.

## 6 · Riesgos y mitigación

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Facturación sigue cerrada en barloventasv2 | Alta | Nada arranca | Reactivar la cuenta (a) o vincular a una activa de TX (b) — decisión del dueño del billing |
| Dump pendiente (clave de BD rotada y secreto bloqueado) | Alta | No se pueden migrar históricos hasta completar el dump | Con factura activa leo el secreto y genero el dump en minutos; sin dump el despliegue arranca con schema vacío y se re-importar más tarde |
| Integraciones 3ros / usuarios que conocen la URL vieja | Media | Ruptura de sesión web, JWT inválido si cambio SECRET_KEY | Comunicar URL nueva; re-emitir accesos; mantener DNS de transición si el dominio es propio |
| Mala configuración secretos | Baja | Error 500 en Cloud Run | `--set-secrets` con los 3 nombres correctos; verificado con el humo del paso 9 |

## 7 · Costos estimados (equivalentes al servicio actual, mensual)

Cloud Run ~$5–15 · Cloud SQL db-f1-micro ~$12–18 · Storage ~$1 · Secret
Manager ~$0.1 · Scheduler ~$0.5 · Cloud Build dentro del tier gratuito.
**Total ~$20–35 USD/mes**, contemplando tráfico similar al actual.

## 8 · Autorizaciones requeridas

1. **TX Barlovento** decide el tema de facturación: activa `013B00…` o
   vincula `barloventasv2` a una cuenta activa.
2. **Permiso para ejecutar** las Fases A/B/C con los gcloud y el script de
   despliegue ya commiteados — todo queda logueado en la bitácora del
   repositorio.
3. **Dump de BD listo** (o confirmación de empezar con esquema vacío y
   re-importar COPIA después).
4. Confirmada la URL nueva, **APK re-publicada** con esa URL.

## 9 · Cierre del proyecto viejo (fase 2 posterior)

Con el servicio estable 48 h en `barloventasv2`: apagar el servicio y la
BD de `truekeate-main` (queda snapshot en Cloud SQL) para no pagar doble.

---

**Con TX Barlovento reactivando la factura + el dump de BD listo: despliegue
completo en ~1 día.** Todo el material técnico ya está en
`C:\GGTO\backup_gcp_2026-11-05\` (bundle + docs) y en el repositorio
(commit `ce781a0`).
