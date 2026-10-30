# Incremento D-161 — El mantenimiento de las masivas es un tipo y bloque propio

| Campo | Valor |
|---|---|
| **Petición del usuario** | «Todas las averías masivas RECLASIFICA como casos de MANTENIMIENTO. Los casos de mantenimientos se deben agrupar por sector y se asigna en el despacho.» |
| **Cierre de entrevista** | (a) Reclasificar **solo los 24 casos «JUSTIFICATIVO» PENDIENTE** actuales; los cerrados quedan con su tipo histórico (no alterar métricas). (b) Cada grupo por sector va a la **cuadrilla de su sector** (regla D-113): **NO** a una cuadrilla única como la construcción (D-143). (c) El caso de mantenimiento es **independiente** de la masiva: cerrarlo **NO** cierra la falla (cierre CRASS aparte, RF-61/RF-62). |
| **Base** | D-113/D-114 (checklist de tipos y cuadrilla por sector), D-118 (casos «JUSTIFICATIVO FAT» de la concentración), D-99/D-111 (proceso de masivas), DEC-MA-1 (asociación `falla_masiva_caso`). |

## Problema

Las fallas masivas detectadas automáticamente generan casos «JUSTIFICATIVO
FAT …» con `tipo_caso='CONSTRUCCION'` + `categoria='REFERIDO'` — la categoría es
correcta (herencia del alta) pero el tipo **no** lo es: son trabajos de
**mantenimiento** de una FAT atenuada, y nacieron como construcción **por
omisión de la ingesta**, no porque lo sean. Esa omisión tenía tres efectos
medibles en producción (2026-10-29: **24 casos** JUSTIFICATIVO PENDIENTE de
**25 fallas masivas**, 24 `DETECTADA`):

1. El despacho los trataba como construcción (`tipo_asignacion =
   'CONSTRUCCION'` por `despacho.py::_tipo_asignacion`): un bloque que **no**
   representa lo que son.
2. Contaban como **referidos disponibles** para la regla de mínimos D-110,
   aunque no son trabajo de referido.
3. En el reporte de producción se mezclaban con construcciones.

## Qué cambia

1. **Nuevo tipo de caso `MANTENIMIENTO`.** Sumado a `TIPO_CASO`
   (`app/schemas/casos.py`) y al CHECK de `caso.tipo_caso`
   (`RepoTecnico/db/schema.sql:318-319`). La API lo acepta en el PATCH
   (`CasoUpdate.tipo_caso`) desde ya.
2. **Bloque propio del despacho.** `_tipo_asignacion` resuelve
   `MANTENIMIENTO` **antes** que la categoría REFERIDO y `tipos_distribucion`
   del caso devuelve la tupla `("MANTENIMIENTO",)` — es un **tipo a sí mismo**,
   no parte de «Especiales Reparación» (`app/services/despacho.py`). El
   checklist gana el 4.º tipo **MANTENIMIENTO** («Mantenimiento»), marcado por
   **defecto** junto a Comunes y Especiales Reparación:
   `TIPOS_DISTRIBUCION_POR_DEFECTO = ("COMUNES", "ESPECIALES_REPARACION",
   "MANTENIMIENTO")`.
3. **Agrupación por sector → cuadrilla del sector (regla D-113).** El
   mantenimiento **no** concentra en una cuadrilla: cada caso va al grupo de su
   sector, y el despachado lo lleva a la cuadrilla asignada a ese sector en el
   proceso. El resumen de reglas de la propuesta informa
   `mantenimientos_asignados`.
4. **No altera la métrica de referidos.** `referidos_disponibles` excluye a los
   `MANTENIMIENTO` aunque su `categoria` sea `REFERIDO` (la categoría es
   herencia del «JUSTIFICATIVO» original).
5. **Reporte de producción aparte.** El reporte del día suma
   `mantenimientos` y `mantenimientos_cerradas` por cuadrilla y totales, igual
   que la construcción de D-143 (`app/api/routes_despachos.py`).
6. **Migración de datos `scripts/migrar_d161_mantenimiento.py`.** Idempotente:
   (1) reemplaza el CHECK de `caso.tipo_caso` **y** de
   `despacho_caso.tipo_asignacion` por los catálogos completos; (2) reclasifica
   a `MANTENIMIENTO` los casos `nombre_cliente ILIKE 'JUSTIFICATIVO %'` +
   `CONSTRUCCION` + `PENDIENTE`; (3) **hereda el sector de su falla masiva**
   (la masiva activa asociada por `falla_masiva_caso`) cuando el caso no
   tiene; (4) deja trazabilidad en `caso_estado_hist` (usuario
   `d161-migracion`, motivo D-161). Un solo lote; los cerrados no se tocan.
7. **Web.** `TipoCaso` y `TipoAsignacionDespacho` ganan el literal; la ficha
   del despacho muestra el chip «Mantenimiento» (icono `IconoActividad`, verde
   la ficha del despacho muestra el chip «Mantenimiento» (icono `IconoActividad`, verde
   `#0a7d5a`) cuando hay mantenimientos en el día; CASOS y Agenda exponen el
   tipo en sus listas (`Casos.tsx`, `Agenda.tsx`, `Despacho.tsx`,
   `CeldasIcono.tsx`, `styles.css`).

## Qué NO cambia (reglas decididas)

- Los casos **cerrados** siguen como `CONSTRUCCION` (histórico intacto).
- No hay regla automática para **futuros** mantenimientos (la reclasificación y
  el nuevo tipo están disponibles para el usuario o la ingesta cuando
  corresponda).
- **Cerrar el caso de mantenimiento no cierra la falla masiva**: el cierre de
  la masiva mantiene su ciclo propio (validador CRASS, RF-61/RF-62).
- El caso sigue **asociado** a su masiva (`falla_masiva_caso`, DEC-MA-1): la
  ficha de la masiva y los overrides de cuadrilla de D-113 aplican igual.

## Despliegue a producción (pendiente de orden)

1. Commit + push (GitHub/GitLab, con barrido de secretos del diff).
2. migración `python scripts/migrar_d161_mantenimiento.py --aplicar` contra
   `ggtov2` (vía Cloud SQL Auth Proxy; simulación primero).
3. Despliegue `TAG=vNN RepoTecnico/scripts/11_desplegar_ggto_web.sh --confirmar`.
4. Humo: `/health`, `/ready` y los 24 casos con `q=JUSTIFICATIVO` (tipo
   `MANTENIMIENTO`, sector heredado donde la masiva lo tiene).

## Verificación

- Pruebas nuevas `app/tests/test_d161_mantenimiento.py` — **4 passed**:
  la API acepta el tipo por PATCH; cada grupo por sector va a la cuadrilla de
  su sector (2 cuadrillas, 3 casos, {1, 2}); los mantenimientos no cuentan como
  `referidos_disponibles` (0) y suman `mantenimientos_asignados = 3`; el
  reporte del día cuenta `mantenimientos = 3` y `mantenimientos_cerradas = 1`.
- Suites regresivas: `test_d113_despacho_tipos.py` **9/9** y
  `test_d114_despacho_especiales.py` **10/10** (assertions del catálogo de 6
  tipos con MANTENIMIENTO por defecto).
- Suite completa con PostgreSQL temporal: **610 passed, cero failed** (12m06s),
  incluye las 4 de D-161 y los 2 de checklist corregidos.
- `ruff check app` y `mypy app` sin hallazgos (135 archivos).
- Frontend: `tsc && vite build` OK (bundle `index-CwksgAf-.js`).

## Archivos

| Archivo | Cambio |
|---|---|
| `app/schemas/casos.py` | `TIPO_CASO` + `MANTENIMIENTO`. |
| `app/services/despacho.py` | Checklist de 6 tipos, `_tipo_asignacion`, `tipos_distribucion`, `referidos_disponibles`, `mantenimientos_asignados`. |
| `app/api/routes_despachos.py` | Reporte de producción con `mantenimientos`/`mantenimientos_cerradas`. |
| `RepoTecnico/db/schema.sql` | CHECK de `caso.tipo_caso` y `despacho_caso.tipo_asignacion` ampliados. |
| `scripts/migrar_d161_mantenimiento.py` | Migración idempotente (simulación por defecto; log en `RepoTecnico/BaseOperaciones/migracion_d161.log`). |
| `app/tests/test_d161_mantenimiento.py` | 4 pruebas nuevas. |
| `app/tests/test_d113_despacho_tipos.py`, `test_d114_despacho_especiales.py` | Catálogo del checklist actualizado. |
| `app/web/src/api/types.ts` | `TipoCaso`, `TipoAsignacionDespacho` + `MANTENIMIENTO`. |
| `app/web/src/pages/Despacho.tsx` | `TIPOS_ASIGNACION`, `conteoPorTipo` + chip «Mantenimiento». |
| `app/web/src/pages/Casos.tsx`, `Agenda.tsx` | Listas de tipos. |
| `app/web/src/components/CeldasIcono.tsx` | Aspecto `ci-tipo-MANTENIMIENTO`. |
| `app/web/src/styles.css` | Colores verde `#0a7d5a` (chip y celda). |
