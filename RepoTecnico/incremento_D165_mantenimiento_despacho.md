# D-165 · Métricas diarias persistidas, sección MANTENIMIENTO y despacho por sectores

**Fecha:** 2026-11-03 · **Tipo:** incremento funcional (RF-01/varios · D-163 · D-161/D-162)
**Pedido del usuario (4 puntos):** métricas diarias «off-chain», reemplazo de
SEGUIMIENTO por MANTENIMIENTO, mantenimiento por sectores en el despacho y
exclusividad de una sola cuadrilla para Construcción.

## 1. Métricas diarias persistidas (punto 1 «off-chain»)

El proyecto **no usa blockchain**: las métricas diarias del despacho se
persisten en la base operativa (`despacho_metrica_diaria`, D-163) y la
WEB/APK las leen de ahí vía `GET /despachos/reporte/produccion`.

Trabajo:

- **Migración a producción**
  (`scripts/migrar_d163_metricas.py`, patrón idempotente simulación/aplicar,
  log `migracion_d163.log`): tabla `despacho_metrica_diaria` (3 columnas por
  día: COMUNES, REFERIDOS, EMPRESA), función
  `fn_recalcular_metricas_despacho_diarias`, triggers
  `trg_despacho_caso_metricas` (en `despacho_caso`) y
  `trg_caso_metricas_despacho` (en `caso`), **política RLS de central**
  (defensa en profundidad D-36, se añadió al schema § 14) y **recálculo
  retroactivo** de las jornadas existentes.
- **Aplicada en producción `ggtov2`** (túnel Cloud SQL, usuario `ggtov2_app`),
  verificada y re-ejecutada con idempotencia en verde. Jornada recalculada:
  COMUNES 10 asignados · REFERIDOS 1 · EMPRESA 0 (2026-11-02).
- **Persistencia perezosa de respaldo** (`routes_despachos.py`): cuando el
  reporte calcula las columnas en memoria y no existen filas persistidas, las
  escribe (el detalle por cuadrilla sigue en memoria).
- El comentario del endpoint aclara el vocabulario: «off-chain = persistidas
  en la base operativa».

## 2. Sección MANTENIMIENTO reemplaza a SEGUIMIENTO (punto 2)

Objetivo: incorporar el tipo de caso `MANTENIMIENTO` al sistema para su gestión.

- **Nueva página `app/web/src/pages/Mantenimiento.tsx`** (ruta `/mantenimiento`,
  menú «MANTENIMIENTO», icono propio `IconoMantenimiento`): lista completa de
  los casos `tipo_caso=MANTENIMIENTO` con búsqueda, filtros por estado y
  sector, «solo abiertos», paginación, tarjetas de resumen, alta manual de
  nuevos casos de mantenimiento (modal con sector, identificador de pago 70*,
  contacto y dirección) y ficha de gestión (edición, cierre e historial de
  estados). Roles de escritura: SUPER/ADMIN/SUPERVISOR; el TÉCNICO consulta.
- **Ruta `/seguimiento` redirige a `/mantenimiento`** (301 interno de la SPA;
 marca de la página anterior desaparece del menú) y se eliminaron
  `Seguimiento.tsx` y los restos RF-34 del cliente (funciones, tipos e icono).
  La **API REST `/seguimiento` RF-34** (`routes_especiales.py`) se conserva
  sin cambios.
- **Alta manual** (`routes_casos.py`): los REF generados para mantenimiento
  usan el prefijo **`REF-MANT-…`** (misma secuencia `seq_caso_ref`) y el
  especial asociado lleva `tipo_actividad=MANTENIMIENTO`.

## 3. Mantenimiento por sectores en una sección aparte del despacho (punto 3)

- **Backend (`services/despacho.py` · `schemas/despacho.py`)**: el proceso
  (`GET /despachos/proceso`) trae el bloque aparte
  `mantenimiento = {total, por_sector: [{id_sector, nombre, cantidad,
  id_cuadrilla}]}`; `POST /despachos/procesar` acepta
  `mantenimiento_asignaciones` (lista por sector) con la semántica:
  cuadrilla elegida manda; un `null` explícito conserva la cuadrilla del
  sector (regla D-113); sin entrada también.
- **WEB (`ProcesarDespacho.tsx`)**: nueva sección aparte «Mantenimiento
  (sección aparte por sector)» con tarjetas (total y sectores), tabla
  sector × casos × cuadrilla asignada y select por sector; el aviso de reglas
  quedó acorde a la nueva sección (antes decía «no tiene bloque propio»).

## 4. Verificación de exclusividad de Construcción (punto 5)

**Sin cambios de código — verificada** (D-162 ya lo implementó):

- El formulario usa **un solo select** de cuadrilla para el bloque completo
  (`construccion_cuadrilla`), no por sector.
- El servicio concentra `REFERIDO + EMPRESA + CONSTRUCCION` en esa cuadrilla,
  la marca exclusiva (`construccion_cuadrilla_exclusiva`) y **desaloja** los
  REPARACIÓN/MANTENIMIENTO (con las masivas priorizadas, D-162 punto 4).
- Pruebas fijas del contrato en `test_d162_despacho_global.py`
  (`test_el_bloque_de_construcciones_va_a_una_cuadrilla_exclusiva`:
  sin REPARACION en la cuadrilla, 2 desalojados, exclusiva=True, etc.).

## Verificación

- Pruebas nuevas en `test_d161_mantenimiento.py`: el proceso informa el bloque
  por sector; `mantenimiento_asignaciones` reubica un sector a otra cuadrilla;
  `id_cuadrilla: null` conserva la cuadrilla del sector (regla D-113).
- **Defecto corregido durante las pruebas:** un `id_cuadrilla=null` dejaba los
  casos de ese sector en `sin_asignar`; ahora cae a la cuadrilla del sector.
- WEB: `tsc && vite build` sin errores (se corrigieron usos de `CeldaSector`,
  `EstadoChips` y `PieTabla` a sus contratos reales y la paginación estándar).
- APK: `flutter analyze` sin issues y **290 pruebas** pasando (la APK no tiene
  sección de seguimiento; los mantenimiento llegan por el despacho del día y
  se muestran por su `tipo_caso`).
- Backend: `ruff` y `mypy` limpios; suite completa **628 passed** (7:48 min,
  625 previas + 3 pruebas nuevas del ciclo).

## Estado de la entrega

- **Aplicado en producción:** la migración D-163 (tabla, triggers, RLS y
  recálculo retroactivo) — el **código** (sección MANTENIMIENTO, despacho por
  sectores y el resto del ciclo, incluido D-164) sigue **sin commit, sin push
  y sin despliegue** pendiente de orden del usuario.

## Pendientes / decisiones abiertas

1. Regenerar el manual (HTML/PDF) y la Ayuda: la sección 06 manual sigue
   describiendo SEGUIMIENTO RF-34.
2. ¿ Dar de baja la API REST `/seguimiento` RF-34 (`routes_especiales.py`)?
   (queda viva aunque sin cliente WEB).
3. Los 8/24 mantenimientos sin sector (altas MANUALES previas a la masiva) y
   el reset/restauración de la base del 30-oct siguen en decisión del usuario.
