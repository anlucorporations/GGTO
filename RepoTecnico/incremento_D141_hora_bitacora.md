# Incremento D-141 — La bitácora guarda la hora real de la acción (H-24)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-24** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **UTC con offset + hora en los estados** |
| Fecha | 2026-10-20 |
| Alcance | Backend + APK · **`1.15.14+39`** publicada · despliegue **v73** |
| Autor | Dirección del proyecto |

---

## 1. El defecto

- Las **actividades** viajaban con `DateTime.now().toIso8601String()`: la hora
  **local del teléfono sin offset**. El servidor la interpretaba como UTC y la
  bitácora quedaba **desplazada 4 h** (hora de Venezuela tratada como UTC).
- Los **estados** no llevaban hora: `CasoEstadoHist` los fechaba con
  `now()` del servidor, es decir, en el momento de **sincronizar** y no cuando el
  técnico hizo la acción (que puede ser horas antes, sin conexión).

---

## 2. Corrección

### 2.1 La APK manda el instante real, en UTC

- `UploadService` construye `fecha_hora` con `DateTime.now().toUtc().toIso8601String()`
  (`…Z`, con offset explícito) para las actividades.
- `estadoDeCarga` recibe `fechaHora` y lo incluye en el estado.

### 2.2 El servidor lo usa

- `EstadoSyncIn` gana `fecha_hora` (validada como `datetime`: una hora ilegible se
  corta con **422**, nunca un 500).
- `_instante_del_item` interpreta el valor: si viene sin zona se asume **UTC**
  (nunca la hora local del servidor); si falta o no se puede leer, se usa la hora
  de llegada.
- `resolucion.registrar_estado(..., momento=)` escribe ese instante en
  `caso_estado_hist.fecha_hora`; `_registrar_estado` (sync) lo propaga.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **511/511 en verde** (4 nuevas de D-141) |
| Pruebas nuevas | el CONTACTADO de las 10:00 UTC se guarda **con esa hora** (no con la de sincronización); sin hora se usa la llegada; una hora ilegible → 422; la actividad conserva su hora (9:30 UTC) |
| APK | **265/265 en verde** · `flutter analyze` sin hallazgos |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app_movil/lib/features/sync/upload_service.dart` | Actividades en UTC con `Z`; hora al estado. |
| `app_movil/lib/features/sync/cola_offline.dart` | `estadoDeCarga(..., fechaHora)`. |
| `app/schemas/sync.py` | `EstadoSyncIn.fecha_hora`. |
| `app/services/sync.py` | `_instante_del_item` y su uso al registrar el estado. |
| `app/services/resolucion.py` | `registrar_estado(..., momento)`. |
| `app/tests/test_d141_hora_bitacora.py` | **Nuevo**: 4 pruebas. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.14+39**. |

---

## 5. Siguiente hallazgo

**H-25** (último de la auditoría) — accesibilidad de la pantalla *Sincronizar*:
colores fuera del sistema de marca (contraste < 4,5:1), progreso sin semántica y
purga sin confirmación ni anuncio. Se consulta al usuario.
