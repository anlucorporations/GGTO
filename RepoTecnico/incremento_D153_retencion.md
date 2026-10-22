# Incremento D-153 — Retención ejecutada por entidad (H-25 · H-11)

| Campo | Valor |
|---|---|
| Origen | **H-25** del `INFORME_OPTIMIZACION_V2.md` (retención/PII) y **H-11** (trabajos programados) |
| Fecha | 2026-10-22 |
| Alcance | Purga, anonimización y programación · sin cambios de esquema obligatorios |
| Autor | Dirección del proyecto |

---

## 1. El defecto

La retención de `requerimientos.md` §5.1 declaraba plazos para **12 entidades**, pero
`app/services/purga.py` solo trataba tres: mensajes, `sync_log` y auditoría. Además:

- la auditoría se borraba a los **365 días** cuando la política fija **3 años**;
- `notificacion`, `evidencia`, `caso`, `actividad`, `solicitante` e `identificador_pago`
  no se purgaban ni anonimizaban nunca;
- el *endpoint* existía, pero **ningún planificador lo invocaba** y la revisión desplegada no
  tenía `MANTENIMIENTO_TOKEN`: la retención declarada no se ejecutaba (H-11).

## 2. Corrección

### 2.1 Purga y anonimización (`app/services/purga.py`)

Todo se ejecuta en lotes de 1000 filas, es idempotente y registra el resultado en la auditoría
`MANTENIMIENTO_PURGA`.

| Entidad | Plazo por defecto | Acción |
|---|---|---|
| `mensaje` / `mensaje_destino` | 5 días (30 si hay destinatarios sin leer) | Eliminar |
| `sync_log` (cascada a `sync_check`) | 90 días | Eliminar |
| `notificacion` | 1 año | Eliminar |
| `evidencia` | 2 años | Borrar el objeto (GCS o local) y la fila |
| `auditoria` | **3 años (1095 días)** | Eliminar |
| `caso` | 5 años | Anonimizar |
| `actividad` | 5 años | Anonimizar |
| `solicitante` | 5 años | Anonimizar |
| `identificador_pago` | 5 años | Anonimizar titular y dirección |

Detalles de la anonimización:

- **`caso`**: se vacían nombre, teléfono, contacto, persona que reporta, dirección, serial,
  textos libres (`ultimo_comentario`, `informacion`, `results`, `problema_reporte`), teléfonos de
  oficina/móvil, asignación y ayudantes. Se conservan `id_averia`, fechas, sector, causa, tipo,
  estado y datos técnicos para estadística y trazabilidad.
- **`actividad`**: se vacían el reporte libre y las coordenadas GPS.
- **`solicitante`**: nombre y contacto pasan a `[ANONIMIZADO]` y se borra el documento. Un
  solicitante referenciado por un `caso_especial` de los últimos 5 años **no** se toca.
- **`identificador_pago`**: se vacían titular y dirección y se conserva el número normalizado
  para conciliación. Un pago referenciado por un caso de los últimos 5 años **no** se toca.

Los plazos se leen de `configuracion` (`caso.retencion_dias`, etc.) y caen a los valores de la
tabla si la clave no existe. Se añadieron las semillas a `RepoTecnico/db/schema.sql`.

### 2.2 Imágenes (`app/services/storage.py`)

Nuevo `borrar_evidencia(ruta)` para las dos formas que produce la carga
(`gcs://bucket/objeto` y `/evidencias-locales/...`). Un objeto ausente cuenta como borrado; un fallo
de credenciales o de red devuelve `False`, la fila se conserva y el reporte expone
`evidencias_pendientes` para reintentar.

### 2.3 Programación (`RepoTecnico/scripts/11_desplegar_ggto_web.sh`)

Con `--confirmar`, el despliegue ahora:

1. crea el secreto `ggto-mantenimiento-token` si no existe y concede lectura a la cuenta de
   servicio;
2. inyecta `MANTENIMIENTO_TOKEN` en Cloud Run;
3. habilita `cloudscheduler.googleapis.com` y crea o actualiza los cuatro jobs
   (`ggto-purgar`, `ggto-cerrar-sesiones`, `ggto-recordatorios-citas`, `ggto-alarmas-despacho`)
   con `America/Caracas` y el header del token.

La purga corre cada hora; el resto mantiene los crons del runbook D-81.

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| `app/tests/test_d153_retencion.py` (nuevo) | **8 passed** |
| Suite completa | **573 passed**, cobertura **90,23 %** (12m27s) |
| `ruff check app` / `mypy app` | sin hallazgos |
| `bash -n` del script de despliegue | sintaxis OK |

Las pruebas cubren: auditoría a 400 días **conservada** y a 1100 eliminada; notificación a 400
días eliminada; evidencia a 800 días eliminada con su archivo; caso, actividad, solicitante y pago
a 6 años anonimizados; registros a 4 años intactos; solicitante y pago protegidos por un caso
reciente; reporte completo e idempotencia de una segunda pasada.

## 4. Residuales

1. **Validación legal de los plazos**: siguen siendo una propuesta de CANTV/asesoría legal.
2. **Archivo**: no hay tabla de archivo separada; «archivar» significa conservar la fila ya
   anonimizada.
3. **Evidencias (H-05)**: en producción el bucket GCS no está configurado y las fotos caen en el
   disco efímero de la instancia; la purga borra lo que encuentra, pero la persistencia de
   evidencias es un hallazgo aparte.
4. **`inventario_movimiento` / `orden_material`**: sin PII; no se purgan (la política dice
   «archivar» a 5 años).
5. **Ejecución efectiva**: requiere desplegar la revisión que incluye D-153 y que Cloud Scheduler
   cree los jobs; hasta entonces la retención sigue sin ejecutarse en producción.

## 5. Despliegue

Entra con la imagen v80 (junto con D-148, D-149, D-150 y D-152). No requiere migración: las claves
nuevas tienen valor por defecto en el código y las semillas aplican a bases nuevas.
