# Incremento D-157 — El cierre de jornada anula las asignaciones (DEVUELTO)

| Campo | Valor |
|---|---|
| Petición | «Modifica para que también quite las asignaciones» — sobre el proceso diario que pasa los casos a `PENDIENTE` (el corte perezoso de las 23:50, **D-99** · RF-65/RF-66) |
| Fecha | 2026-10-23 |
| Alcance | Backend, esquema (`despacho_caso.estado`), web y migración · **desplegado en producción (v84)** |
| Autor | Dirección del proyecto |

---

## 1. El defecto

El corte de jornada (D-99) devolvía el caso a `PENDIENTE`, pero su renglón de
`despacho_caso` **seguía contando como asignación vigente**:

- El «último despacho» del caso seguía siendo el de la cuadrilla de la jornada
  vencida, así que la **APK seguía descargándolo** (`ids_vigentes`) y podía
  quedar colgado en el teléfono indefinidamente si la jornada siguiente no lo
  reasignaba.
- En **CASOS** (web) el caso seguía atribuido a esa cuadrilla: filtro
  «Cuadrilla», icono `asignado` y el cálculo de la última cuadrilla de los
  especiales.
- Si el caso quedaba sin reasignar para siempre, su única fija a cuadrilla era
  una jornada ya muerta, en contra de la semántica de `PENDIENTE` («volvió al
  pozo», DEC-MA-6).

---

## 2. Corrección: la fila devuelta ya no es una asignación

### 2.1 El estado `DEVUELTO` (DEC-157-1)

`app/services/jornada.py::cerrar_jornada` marca cada renglón liberado con
**`despacho_caso.estado = 'DEVUELTO'`** en lugar de dejarlo como estaba. La
fila **se conserva** (historia del despacho: quién lo tuvo, con qué orden y
tipo) pero deja de atribuir el caso a ninguna cuadrilla. El catálogo del estado
pasa a `ASIGNADO | GESTIONADO | CERRADO | CITADO | DIFERIDO | DEVUELTO`.

La respuesta del corte suma el campo **`asignaciones_devueltas`** en
`CierreJornadaOut`, y el selector de estado del despacho en la web
(`Despacho.tsx`) ofrece el valor nuevo.

### 2.2 Las consultas de vigencia excluyen las devueltas (DEC-157-2)

Todas las consultas que calculan «el último despacho del caso» o «la
asignación» ignoran las filas `DEVUELTO`:

| Consulta | Cambio |
|---|---|
| `sync._casos_ids_de_cuadrilla` | La APK deja de descargar el caso liberado. |
| `sync._casos_del_dia` | El despacho del día no se construye con filas devueltas. |
| `sync` descarga (`dc_map`) | El orden/tipo/observación ya no sale de una fila devuelta. |
| `routes_casos._resumen` | El icono `asignado` y la última cuadrilla del listado no cuentan devueltas. |
| `routes_casos._casos_de_cuadrilla` | El filtro «Cuadrilla» no devuelve casos devueltos. |
| `routes_especiales` (dos bloques) | La cuadrilla del último despacho del caso especial tampoco. |

Lo que **no** cambia, deliberadamente:

- **D-123 se conserva** (`sync._casos_recientes_de_cuadrilla` no excluye
  devueltas): el técnico sigue pudiendo subir el trabajo reciente del caso
  devuelto dentro de su ventana de 24 h; la devolución anula la asignación
  *futura*, no el trabajo ya hecho.
- **Las estadísticas históricas quedan sin filtro** (reporte de producción,
  MONITOREO, efectividad): los renglones liberados siguen contando como
  asignados de su día, que es lo que miden.
- El **despacho conservado** sigue mostrando sus casos en la ficha, ahora con
  el estado `DEVUELTO` (transparencia histórica).

---

## 3. Esquema y migración

- `RepoTecnico/db/schema.sql`: el CHECK de `despacho_caso.estado` admite
  `DEVUELTO`.
- `scripts/migrar_d157_devueltas.py`. **⚠️ Debe aplicarse a `ggtov2` ANTES del
  despliegue**: si el código nuevo llega primero, el próximo corte perezoso
  intentaría escribir `DEVUELTO` y violaría el CHECK vigente, rompiendo la
  entrada de cualquier gestor (`GET /despachos` → 500).
  - Simulación por defecto; `--aplicar` para escribir (con `--si` u opción
    interactiva; `--dsn` para cadena de conexión explícita).
  - Descubre cualquier CHECK previo del estado por expresión
    (`pg_get_constraintdef`), lo suelta y recrea
    `despacho_caso_estado_check` con el catálogo completo, todo en una
    transacción.
  - Verificación posterior: el constraint llamado
    `despacho_caso_estado_check` contiene `DEVUELTO`; log en
    `RepoTecnico/BaseOperaciones/migracion_d157.log`; reejecución idempotente
    («La base YA está migrada»).

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/services/jornada.py` | `ESTADO_DEVUELTO`, marca el renglón liberado y suma `asignaciones_devueltas`. |
| `app/schemas/despacho.py` | `EstadoDespachoCaso` admite `DEVUELTO`; `CierreJornadaOut.asignaciones_devueltas`. |
| `app/services/sync.py` | `ESTADO_DESASIGNADO`; exclusión en `_casos_ids_de_cuadrilla`, `_casos_del_dia` y `dc_map`. |
| `app/api/routes_casos.py` | Exclusión en `asignados`, en la última cuadrilla del listado y en `_casos_de_cuadrilla`. |
| `app/api/routes_especiales.py` | Exclusión en los dos cálculos de última cuadrilla. |
| `app/web/src/api/types.ts` | `EstadoDespachoCaso` con `DEVUELTO`. |
| `app/web/src/pages/Despacho.tsx` | Selector de estado con `DEVUELTO`. |
| `RepoTecnico/db/schema.sql` | CHECK ampliado. |
| `scripts/migrar_d157_devueltas.py` | **Nuevo**: migración del CHECK (idempotente). |
| `app/tests/test_d157_desasignacion.py` | **Nuevo**: 4 pruebas. |
| `app/tests/test_d99_masivas.py`, `test_sync_api.py` | Aserciones nuevas del corte con devolución. |

---

## 5. Verificación

| Ámbito | Evidencia |
|---|---|
| Pruebas nuevas | `test_d157_desasignacion.py` **4/4 en verde**: las filas quedan `DEVUELTO` y el corte informa el total; el caso deja de ser de la cuadrilla (helper de vigencia y filtro CASOS) pero el despacho conserva la fila devuelta; el caso devuelto se puede reasignar y vuelve a la cuadrilla; la protección D-123 sobrevive (`casos_permitidos` lo incluye para la carga). |
| Suites relacionadas | D-99 **15**, sync **40**, despacho **35**, casos **33**, D-113 **9**, D-72 **11**, especiales **17**, monitoreo **17**, D-146 **14**, D-120 **17**, D-123 **5**. |
| Suite completa | **600 passed** (9 min 17 s) contra PostgreSQL temporal con el esquema recreado desde `schema.sql`. |
| Lint y tipos | `ruff check app` y `mypy app` sin hallazgos. |
| Web | `tsc` + `vite build` en verde (104 módulos). |
| Migración | Simulación → `--aplicar --si` con verificación `{catalogo_devuelto: 1}` → reejecución idempotente → `INSERT 'DEVUELTO'` aceptado contra un esquema de pruebas que recrea el CHECK antiguo. |

---

## 6. Pendiente de publicación

1. **Migrar `ggtov2`** con `scripts/migrar_d157_devueltas.py` (por Cloud SQL
   Auth Proxy) — **antes del despliegue**.
2. Commit del incremento y push a `origin` (GitHub) y `gitlab`.
3. Despliegue **v84** con `TAG=v84 RepoTecnico/scripts/11_desplegar_ggto_web.sh
   --confirmar` y verificación en vivo.
4. Regenerar los manuales HTML/PDF de `docs/` (los `.md` citados ya se
   actualizaron).
