# Incremento D-132 — La purga protege el caso de toda acción encolada (H-15)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-15** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **por payload y por endpoint** |
| Fecha | 2026-10-20 |
| Alcance | APK · **`1.15.8+33`** publicada · despliegue **v64** · sin cambios de API |
| Autor | Dirección del proyecto |

---

## 1. El defecto

La purga de la descarga (D-104/D-117/D-119) conserva los casos con **trabajo sin
enviar** (`protegidos`), que se calculaban leyendo `id_caso` e `id_averia` del
**payload** de cada acción encolada.

Las acciones de `DIFERIDO_EVIDENCIAS` —las que adjuntan la foto de un diferido—
llevaban **solo** `{'evidencias': [...]}`: su caso no entraba en `protegidos` y la
purga podía **borrarlo del dispositivo** con el trabajo todavía en la cola. Eran
las 7 de 8 acciones protegidas que señaló la auditoría.

---

## 2. Corrección

`app_movil/lib/features/sync/purga_despachos.dart` gana la función **pura**
`clavesDeAccion(payload, endpoint)`:

1. toma `id_caso` e `id_averia` del payload (como antes), y
2. **deduce el caso del endpoint** (`/casos/{id}/…`), que las acciones de
   `DIFERIDO_EVIDENCIAS` sí traen.

`clavesConTrabajoPendiente()` la usa para cada fila de `accion_pendiente` (lee
`payload` y `endpoint`). Al cubrir el endpoint, **las filas ya encoladas en los
dispositivos quedan protegidas sin migración**.

Además, `OperacionesService.diferir` guarda ahora `id_caso` e `id_averia` en el
payload de `DIFERIDO_EVIDENCIAS` (defensa en profundidad para las acciones nuevas).

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| APK `flutter test` | **249/249 en verde** (6 nuevas de D-132) · `flutter analyze` sin hallazgos |
| Pruebas nuevas | payload con `id_caso`/`id_averia`; `DIFERIDO_EVIDENCIAS` sin el caso en el payload queda **protegido por el endpoint**; no se duplican claves; un endpoint ajeno (`/citas`) no inventa claves; `id_caso = 0` (reporte de masiva) no protege a nadie; un payload ilegible no impide la protección por el endpoint |
| Backend / esquema | sin cambios |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app_movil/lib/features/sync/purga_despachos.dart` | `clavesDeAccion` (pura). |
| `app_movil/lib/core/database.dart` | `clavesConTrabajoPendiente` lee `endpoint` y usa la función. |
| `app_movil/lib/features/casos/operaciones_service.dart` | El payload del diferido lleva `id_caso` e `id_averia`. |
| `app_movil/test/d132_proteccion_purga_test.dart` | **Nuevo**: 6 pruebas. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.8+33**. |

---

## 5. Siguiente hallazgo

**H-16** — `requiere_informe` es decorativo: no se exige el informe en ningún
camino (ni APK, ni web, ni backend) al cerrar un especial. Se consulta al usuario.
