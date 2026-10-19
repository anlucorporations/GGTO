# Incremento D-121 — Idempotencia de la carga de la APK (H-01)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-01** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md): `/sync/carga` no era idempotente y duplicaba la bitácora y la productividad al reenviar el lote |
| Fecha | 2026-10-19 |
| Alcance | Backend + APK + esquema · APK **`1.15.1+26`** publicada · migración **aplicada en producción** · despliegue **v53** |
| Autor | Dirección del proyecto |

---

## 1. El defecto

`POST /sync/carga` **no tenía clave de idempotencia**:

- `ActividadSyncIn.id_actividad_local` llegaba desde la APK y el servidor **lo
  ignoraba**; `actividad` no tenía columna ni índice único, y el serial de la
  evidencia se derivaba del `id_actividad`, así que un segundo envío no colisionaba.
- La APK, ante `rechazadas > 0`, devolvía **todo el lote** a reintento con
  `intentos = 1` fijo (nunca llegaba a 5) y, si la respuesta se perdía, **reenviaba
  las acciones ya aplicadas**: doble `CIERRE`/`ENRUTE`, doble fila en la bitácora y
  doble conteo en MONITOREO. Un solo ítem «venenoso» dejaba el lote en bucle.

---

## 2. Corrección

### 2.1 Esquema (migración aplicada)

`actividad` gana:

- `id_actividad_local integer` — id de la acción en la cola del dispositivo;
- `dispositivo_id varchar(80)` — dispositivo de origen;
- índice **único parcial** `ux_actividad_local (dispositivo_id, id_actividad_local)`
  donde ambos no son nulos: dos acciones distintas del mismo dispositivo no
  colisionan y la misma acción no puede entrar dos veces, ni en concurrencia.

`Actividad.id_actividad_local` y `dispositivo_id` en el modelo ORM ·
`RepoTecnico/db/schema.sql` (CREATE + ALTER idempotentes) ·
`scripts/migrar_d121_idempotencia.py` (simulación por defecto, `--aplicar --si`).

**Aplicada en producción** el 2026-10-19 vía `cloud-sql-proxy`:
`{id_actividad_local: 0, dispositivo_id: 0, indice: 0}` →
`{1, 1, 1}` — **verificada**.

### 2.2 Servidor: idempotencia y respuesta por acción

`services/sync.aplicar_carga`:

1. Lee `dispositivo_id` del lote (ya viajaba en el contrato).
2. Por cada actividad con `id_actividad_local`, **busca antes de escribir**: si la
   pareja ya existe, la confirma como aceptada (`mensaje: "Ya registrada en una
   carga anterior"`, con su `id_actividad`) y **no** vuelve a escribir ni a mover
   el caso. Cubre también el `CIERRE`, que pasa por `resolucion.cerrar_caso`
   (que ahora recibe y guarda esos dos campos).
3. Devuelve **`items`**: `id_actividad_local`, `id_caso`, `aceptada`, `mensaje`,
   `id_actividad`. Se mantienen `aceptadas`/`rechazadas`/`errores` para los
   clientes anteriores.

### 2.3 APK: marca acción por acción y contadores reales

`features/sync/upload_service.dart`:

- `planificarResultado(items)` (función **pura**): traduce el desglose del
  servidor a `ResultadoItemCarga`.
- Con `items` en la respuesta, cada acción se **borra de la cola si se aceptó** o
  queda en **`ERROR` visible con su motivo** si se rechazó — ya no se reintenta el
  lote entero por un ítem.
- Sin `items` (servidor anterior) se conserva el comportamiento por lote.
- Si no hay respuesta (red), se reintenta con **backoff real** (1, 2, 4… 60 min)
  y el contador de intentos **de cada acción**; la idempotencia evita el duplicado
  cuando el servidor sí lo había aplicado.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa, esquema nuevo) | **448/448 en verde** (4 nuevas de D-121) |
| APK `flutter test` | **223/223 en verde** (4 nuevas de D-121) · `flutter analyze` sin hallazgos |
| Pruebas nuevas del backend | doble POST del mismo lote → **una** actividad y el mismo `id_actividad`; cierre reenviado → **un** cierre y un histórico; lote 1 bueno + 1 malo → el bueno se confirma y el malo devuelve su motivo sin dejar actividad; acción sin id local → contrato antiguo intacto |
| Pruebas nuevas de la APK | desglose aceptado/rechazado, duplicada confirmada, respuestas mal formadas ignoradas |
| Migración | aplicada y verificada en producción (columnas + índice) |
| Despliegue | imagen **v53**, `/openapi.json` con `SyncCargaOut.items` |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `RepoTecnico/db/schema.sql` | Columnas + índice único parcial en `actividad`. |
| `scripts/migrar_d121_idempotencia.py` | **Nuevo**: migración idempotente. |
| `app/models/entities.py` | `id_actividad_local`, `dispositivo_id`. |
| `app/services/sync.py` | Idempotencia por (dispositivo, id local) y `items` en la respuesta. |
| `app/services/resolucion.py` | `cerrar_caso` guarda la clave de idempotencia. |
| `app/schemas/sync.py` | `ItemCargaOut` y `SyncCargaOut.items`; `errores[].id_actividad_local`. |
| `app/tests/test_d121_idempotencia.py` | **Nuevo**: 4 pruebas. |
| `app_movil/lib/features/sync/upload_service.dart` | `planificarResultado`, marcado por acción y backoff real. |
| `app_movil/test/d121_idempotencia_carga_test.dart` | **Nuevo**: 4 pruebas. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.1+26**. |

---

## 5. Estado del resto de hallazgos

Se sigue con la lista del [informe V3](INFORME_OPTIMIZACION_V3.md) en el orden
acordado con el usuario: siguiente **H-04** (el `REF-…` de un especial no se
despacha al crearse).
