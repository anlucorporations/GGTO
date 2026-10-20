# Incremento D-134 — El flujo del caso especial se valida (H-17)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-17** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **validar el flujo completo** |
| Fecha | 2026-10-20 |
| Alcance | Backend · despliegue **v66** · APK y web sin cambios de contrato |
| Autor | Dirección del proyecto |

---

## 1. El defecto

`PATCH /casos-especiales/{id}` escribía `estado` con `setattr` **sin validar nada**:

- `ABIERTO → CERRADO` saltándose `EN_PROCESO`/`ATENDIDO`;
- `CERRADO → ABIERTO` (reabrir) sin motivo, sin permiso especial y sin rastro;
- estados inventados (más allá del enumerado del esquema).

Es la vía del cierre administrativo de la web, así que la regla tenía que vivir en
el servidor.

---

## 2. Corrección

`app/services/clasificacion.py` gana la **máquina de estados**:

```python
TRANSICIONES_ESPECIAL = {
    "ABIERTO":    {"EN_PROCESO", "ATENDIDO", "CERRADO"},
    "EN_PROCESO": {"ATENDIDO", "CERRADO"},
    "ATENDIDO":   {"CERRADO"},
    "CERRADO":    set(),
}
```

`routes_especiales._validar_transicion`:

| Situación | Respuesta |
|---|---|
| mismo estado | 200 (idempotente) |
| avance permitido | 200 |
| estado fuera del enumerado | **422** con la lista válida |
| salto no permitido entre estados abiertos | **409** con las opciones |
| **retroceso** desde `ATENDIDO`/`CERRADO` sin ser SUPER | **409** («solo el SUPER puede…») |
| retroceso del SUPER sin `motivo_reversion` (≥ 10 caracteres) | **422** |
| retroceso del SUPER con motivo | 200 + fila de **auditoría** `REVERSION_ESPECIAL` (con `datos_antes`/`datos_despues`) |

`CasoEspecialUpdate` gana `motivo_reversion` (no es columna: se consume en la
validación).

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **496/496 en verde** (8 nuevas de D-134) |
| Pruebas nuevas | avance válido desde el estado de alta; `EN_PROCESO → ATENDIDO`; cierre desde abierto; estado inventado → 422; reabrir como ADMIN → **409**; reabrir como SUPER sin motivo → **422**; reabrir como SUPER con motivo → 200 + auditoría `REVERSION_ESPECIAL`; mismo estado → 200 |
| APK / web | sin cambios (la web ya solo ofrece los estados del enumerado) |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/services/clasificacion.py` | `TRANSICIONES_ESPECIAL` y `RETROCESOS_ESPECIAL`. |
| `app/api/routes_especiales.py` | `_validar_transicion` y su uso en el PATCH; auditoría del retroceso. |
| `app/schemas/especiales.py` | `motivo_reversion`. |
| `app/tests/test_d134_flujo_especial.py` | **Nuevo**: 8 pruebas. |

---

## 5. Siguiente hallazgo

**H-18** — pendiente de detallar en el informe (siguiente bloque de la auditoría).
