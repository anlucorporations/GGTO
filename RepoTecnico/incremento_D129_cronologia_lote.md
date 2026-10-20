# Incremento D-129 — El lote de la carga se aplica en orden cronológico (H-12)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-12** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Decisión del usuario: **ordenar el lote por hora** |
| Fecha | 2026-10-20 |
| Alcance | Backend + APK · **`1.15.7+32`** publicada · despliegue **v61** |
| Autor | Dirección del proyecto |

---

## 1. El defecto

`aplicar_carga` procesaba el lote en **dos pasadas**: primero **todas** las
`actividades` y después **todos** los `estados`. Como la CARGA de la APK manda los
cierres como actividad y los contactos/citas como estado, el orden real del
técnico se perdía:

1. El técnico marca **CONTACTADO** (estado) y luego **cierra** (actividad).
2. El servidor aplica primero el cierre (actividad) y después el contacto (estado).
3. Resultado: el caso queda **CONTACTADO** aunque se había cerrado, y la bitácora
   cuenta los movimientos al revés.

---

## 2. Corrección

### 2.1 Una sola secuencia ordenada

`aplicar_carga` construye un `lote` con actividades y estados y lo ordena por la
**clave de orden real**: el `id_actividad_local` de la acción en la cola del
dispositivo (autoincremental: refleja el orden en que el técnico las hizo). Si
falta (cliente antiguo), se conserva el orden de llegada —actividades y luego
estados—, que es el comportamiento anterior.

```python
lote.sort(key=lambda elemento: (elemento[0], elemento[1]))
for _clave, _indice, clase, datos in lote:
    if clase == "actividad": …
    else: …  # estado
```

### 2.2 El estado lleva su id local

`EstadoSyncIn` gana `id_actividad_local` (opcional) y la APK lo envía en
`estadoDeCarga` (que ahora recibe `idLocal`). Sin él, el servidor no podría
intercalar estados y actividades.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **473/473 en verde** (4 nuevas de D-129) |
| Pruebas nuevas | CONTACTADO (id 1) + CIERRE (id 2) → el caso queda **CERRADO** y el cierre es el último movimiento de la bitácora; CIERRE (1) + CONTACTADO (2) → CONTACTADO; sin id local se respeta el orden de llegada; el cierre conserva su `id_actividad_local` |
| APK | `flutter analyze` sin hallazgos; suite completa en verde · `estadoDeCarga` envía el id local |
| Contrato | `SyncCargaIn.estados[].id_actividad_local` en `/openapi.json` |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/services/sync.py` | `aplicar_carga`: lote único ordenado por id local. |
| `app/schemas/sync.py` | `EstadoSyncIn.id_actividad_local`. |
| `app/tests/test_d129_cronologia_lote.py` | **Nuevo**: 4 pruebas. |
| `app_movil/lib/features/sync/cola_offline.dart` | `estadoDeCarga` recibe y envía `idLocal`. |
| `app_movil/lib/features/sync/upload_service.dart` | Pasa el id local al estado. |
| `app_movil/test/d125_diferido_evidencias_test.dart` | Llamadas actualizadas a la nueva firma. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.7+32**. |

---

## 5. Siguiente hallazgo

**H-13** — ningún endpoint de `/casos` aplica el filtro de cuadrilla que sí aplica
`/sync`: un TÉCNICO puede leer y escribir casos de otras cuadrillas (y
`/casos/buscar` no acota ni por central). Se consulta al usuario.
