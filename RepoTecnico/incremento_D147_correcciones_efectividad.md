# Incremento D-147 — Correcciones de acceso y cálculo del ranking de efectividad

| Campo | Valor |
|---|---|
| Origen | Revisión de código de D-146 (`0ea7dbf`, desplegado en **v78**) |
| Fecha | 2026-10-21 |
| Alcance | Backend + web · sin cambios de esquema ni de APK |
| Autor | Dirección del proyecto |

---

## 1. Qué se revisó y qué se encontró

D-146 introdujo `GET /despachos/efectividad` y el bloque «Efectividad y ranking de
cuadrillas». La revisión del incremento ya desplegado encontró **tres defectos**:

| # | Severidad | Defecto | Efecto real |
|---|---|---|---|
| 1 | **Alta** | El endpoint se autenticaba con `get_current_user` y llamaba a `resolver_central(db, id_central, config)` **sin** el `usuario`. | Cualquier usuario autenticado (incluido un TÉCNICO) podía leer el ranking y pedir `?id_central=N` de otra central. |
| 2 | **Alta** | `reaperturas` se incrementaba **dentro** de `if cerrado`. Un caso reabierto deja de estar `CERRADO` y `despacho_caso.estado` nace `ASIGNADO`, así que el contador quedaba en 0. | El 10 % del puntaje («sin reapertura») era una constante para todas las cuadrillas. |
| 3 | **Media** | `oportunidad` comparaba `momento.date()` (UTC de la base) con `fila.fecha` (día operativo) y la web construía el periodo con `toISOString()`. | Un cierre entre las 20:00 y las 23:59 de Caracas caía en el día siguiente y podía salir del plazo. Contradecía **D-131**. |

---

## 2. Correcciones

### 2.1 Acceso (defecto 1)

- Guard nuevo `_lectura_gestion = require_roles("ADMIN", "SUPERVISOR", "COORDINADOR")`
  (**DEC-147-1**): el ranking es una métrica de gestión, no de campo; `SUPER` entra
  por el bypass de rol.
- `resolver_central(db, id_central, config, usuario)` valida que la central pedida
  sea la del usuario; una central distinta responde **403** antes de consultar.

### 2.2 Reaperturas (defecto 2)

- El conteo sale del bloque `if cerrado` y se calcula por **caso único**:
  `datos.reaperturas = len({id_caso de la cuadrilla} ∩ reabiertos)`.
- El denominador del criterio pasa a `max(cerrados, reaperturas)` para que la ratio
  quede en 0..1 aun cuando el caso reabierto ya no esté cerrado (**DEC-147-2**).

### 2.3 Día operativo (defecto 3)

- Backend: `dia_operativo(momento)` de `services/tiempo.py` (America/Caracas).
- Web: el periodo se arma con la fecha **local** (`getFullYear/getMonth/getDate`),
  no con `toISOString()` (**DEC-147-3**).

### 2.4 Contrato

- `componentes: dict[str, float]`, `por_estado: dict[str, int]`,
  `pesos: dict[str, float]` y `criterios: dict[str, str]`: el OpenAPI vuelve a
  declarar el tipo de cada mapa.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Pruebas unitarias nuevas | **7 en verde** (2 de puntaje con reapertura, 1 de denominador sin cierres) |
| Suite sin base | **111 passed, 431 skipped** por `GGTO_TEST_DB_URL` no configurada |
| Pruebas de integración de D-146 | **7** (rol TÉCNICO → 403, SUPERVISOR → 200, central ajena → 403, reapertura contada con el caso ya no cerrado, y las 3 previas) — **pendientes de ejecutar** contra PostgreSQL |
| Doble de sesión (sin base) | cuadrilla con 6 asignados, 4 cerrados y 1 reabierto → `reaperturas = 1`, `en_plazo = 4` con cierre a las 21:30 de Caracas, puntaje **62,5** |
| Web | `tsc --noEmit` limpio |
| Esquema / APK | sin cambios |

> La corrida de integración queda pendiente por no haber `GGTO_TEST_DB_URL` en esta
> estación. No se declara el incremento verificado en base hasta ejecutarla.

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/api/routes_despachos.py` | Guard `_lectura_gestion`; `usuario` en `resolver_central`; bloque reubicado a «Efectividad y ranking». |
| `app/services/efectividad.py` | Reaperturas por caso y fuera de `if cerrado`; denominador `max(cerrados, reaperturas)`; `dia_operativo`; `set` de evidencias una sola vez. |
| `app/schemas/despacho.py` | Mapas tipados en `EfectividadCuadrillaOut` y `RankingEfectividadOut`. |
| `app/tests/test_d146_efectividad.py` | 2 pruebas unitarias de reapertura + 4 de acceso/reapertura con datos. |
| `app/web/src/pages/Despacho.tsx` | Periodo en fecha local. |

---

## 5. Decisiones

1. **DEC-147-1** — El ranking lo consultan ADMIN, SUPERVISOR y COORDINADOR; el
   TÉCNICO recibe 403. La web sigue sin mostrar DESPACHO al COORDINADOR (D-72),
   pero la API queda alineada con su rol de monitoreo (D-95).
2. **DEC-147-2** — «Reapertura» se mide por caso y con denominador
   `max(cerrados, reaperturas)`: un caso reabierto y no re-cerrado **sí** penaliza,
   que es el supuesto que D-146 quería medir.
3. **DEC-147-3** — Toda fecha de negocio del ranking usa el día operativo
   (America/Caracas), conforme a D-131.
