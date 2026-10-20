# Incremento D-126 — La descarga no deshace el trabajo pendiente (H-09)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-09** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Decisión del usuario: **«lo pendiente manda»** |
| Fecha | 2026-10-20 |
| Alcance | APK · **`1.15.5+30`** publicada · despliegue **v58** · sin cambios de API ni de esquema |
| Autor | Dirección del proyecto |

---

## 1. El defecto

`DatabaseHelper.mergearCasos` insertaba cada caso descargado con
`ConflictAlgorithm.replace`: la fila local se **reemplazaba** por el JSON del
servidor.

Secuencia real del técnico:

1. Sin conexión marca **CONTACTADO** (o cierra): el estado se guarda en local con
   `pendiente_sync = true` y la acción en la cola.
2. Al volver la red, la **descarga** se ejecuta y el servidor —que todavía no ha
   recibido la acción— devuelve el caso como **NUEVO**.
3. La descarga reemplaza la fila: el estado local se pierde, `pendiente_sync`
   desaparece y el caso **reaparece como pendiente**. El técnico puede repetir la
   acción (o creer que no se guardó).

---

## 2. Corrección: lo pendiente manda

`app_movil/lib/features/sync/merge_casos.dart` (nuevo, función **pura**):

```dart
fusionarCasoDescargado(entrante:, local:, tieneTrabajoPendiente:)
```

| Situación | Resultado |
|---|---|
| Sin fila local | se inserta la del servidor (`pendiente_sync = false`) |
| Filas local y sin trabajo pendiente | manda el servidor |
| **Con trabajo pendiente** (acción en la cola o `pendiente_sync`) | se refrescan todos los campos **menos el estado**, que se conserva, y `pendiente_sync` sigue en `true` |

`mergearCasos` calcula el conjunto de casos protegidos con
`clavesConTrabajoPendiente()` (la misma protección que usa la purga, D-104/D-119) y
la marca `pendiente_sync` de la propia fila; codifica el resultado fusionado.

Así, mientras la acción no se envíe, la descarga **no puede** revertir el estado;
cuando la cola queda vacía, la siguiente descarga vuelve a mandar (comportamiento
normal).

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| APK `flutter test` | **243/243 en verde** (6 nuevas de D-126) · `flutter analyze` sin hallazgos |
| Pruebas nuevas | sin pendiente manda el servidor; con pendiente se conserva `CONTACTADO`/`CERRADO` y la marca, refrescando dirección y teléfono; sin fila local se inserta; una fila local sin estado no inventa uno; la función no muta las entradas |
| Backend / esquema | sin cambios |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app_movil/lib/features/sync/merge_casos.dart` | **Nuevo**: `fusionarCasoDescargado` (pura). |
| `app_movil/lib/core/database.dart` | `mergearCasos` fusiona en lugar de reemplazar y protege lo pendiente. |
| `app_movil/test/d126_merge_casos_test.dart` | **Nuevo**: 7 pruebas. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.5+30**. |

---

## 5. Siguiente hallazgo

**H-10** — `ids_conocidos` viaja con **toda** la caché en la query string
(`GET /sync/descarga?ids_conocidos=…`): con cientos de casos la URL crece sin
límite y puede superar el máximo del servidor/proxy. Se consulta al usuario.
