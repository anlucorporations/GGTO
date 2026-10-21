# Incremento D-140 — La cuadrilla de gestión no purga aunque tenga casos (H-23)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-23** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **bandera `purga_permitida`** |
| Fecha | 2026-10-20 |
| Alcance | Backend + APK · **`1.15.13+38`** publicada · despliegue **v72** |
| Autor | Dirección del proyecto |

---

## 1. El defecto

La salvaguarda de la cuadrilla de gestión (C-00) dependía de una condición
indirecta: `construir_descarga` solo respondía `CUADRILLA_GESTION` en la rama
**«la cuadrilla no tiene casos»**. En cuanto C-00 tenía trabajo —hoy 8 casos— el
servidor devolvía `OK`, la APK consideraba que procedía purgar (D-115) y la
salvaguarda quedaba **inerte**: una cuadrilla de gestión podía perder en el
dispositivo los casos que no estuvieran en el despacho del día.

---

## 2. Corrección

### 2.1 Una bandera explícita en la descarga

`SyncDescargaOut` gana **`purga_permitida`** (por defecto `true`). `_respuesta` la
calcula a partir de la cuadrilla: **`false` si `es_supervisor`**, tenga o no casos.

Así el contrato deja de depender del `motivo` y la salvaguarda actúa **siempre**
para una cuadrilla de gestión, sin dejar de entregarle sus casos (C-00 sigue
recibiendo el despacho, que es lo que el usuario prueba en el teléfono).

### 2.2 La APK obedece la bandera

`PurgaDespachos.procede(motivo, cuadrillaResuelta, purgaPermitida)` devuelve `false`
si el servidor no autoriza. `DownloadService` lee `datos['purga_permitida']` (si el
servidor antiguo no lo manda, se asume `true`, como antes).

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **507/507 en verde** (3 nuevas de D-140) |
| Pruebas nuevas | un técnico de la cuadrilla de gestión **recibe** su caso y la descarga llega con `purga_permitida = false`; una cuadrilla de campo llega con `true`; sin cuadrilla la bandera viaja igual (la APK no purga por `cuadrillaResuelta`) |
| APK | **265/265 en verde** (2 aserciones nuevas en la prueba de la purga) · `flutter analyze` sin hallazgos |
| Datos sembrados | las pruebas **no modifican** C-00: le asignan un técnico y un caso temporal |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/schemas/sync.py` | `SyncDescargaOut.purga_permitida`. |
| `app/services/sync.py` | `_respuesta` calcula la bandera desde la cuadrilla. |
| `app/tests/test_d140_purga_gestion.py` | **Nuevo**: 3 pruebas. |
| `app_movil/lib/features/sync/purga_despachos.dart` | `procede(..., purgaPermitida)`. |
| `app_movil/lib/features/sync/download_service.dart` | Lee `purga_permitida` y la pasa. |
| `app_movil/test/d104_purga_despachos_test.dart` | Aserciones de la bandera. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.13+38**. |

---

## 5. Siguiente hallazgo

**H-24** — las actividades viajan con hora local **sin offset** y los estados sin
hora: la bitácora queda desplazada 4 h y los estados se fechan al sincronizar. Se
consulta al usuario.
