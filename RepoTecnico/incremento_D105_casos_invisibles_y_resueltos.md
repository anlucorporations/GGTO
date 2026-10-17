# Incremento D-105 — Los casos no se quedan invisibles y el botón de resueltos es permanente

| Campo | Valor |
|---|---|
| Petición | «No se muestran los casos en la APK después de descargarlos, dice que ya se encuentran en el dispositivo pero no los muestra. Asegúrate de mostrar permanentemente el botón para ver los casos ya resueltos» |
| Fecha | 2026-10-17 |
| Alcance | API de descarga (`app/services/sync.py`) + APK (`app_movil`) |
| Autor | Dirección del proyecto |

---

## 1. Diagnóstico (con datos de producción, no por suposición)

Se revisó el estado real de la base `ggtov2` a través de la sección SISTEMAS del Super Usuario:

| Comprobación | Resultado |
|---|---|
| Despachos del 2026-10-17 | **4 despachos en estado `BORRADOR`** (cuadrillas 1, 11, 12 y 8), con 7, 36, 12 y 6 casos ya cargados |
| Despachos del 2026-10-16 | Publicados/cerrados (cuadrillas 1, 11 y 8) |
| Sesiones de sincronización del 2026-10-17 | P00 `141546` (cuadrilla 8) y `143130` (cuadrilla 8): **`recibidos: 0`** en todas |
| Estados de los casos de la cuadrilla 8 | `NUEVO` y `PENDIENTE` — **ninguno gestionado** (el filtro de D-101 no los ocultaba) |

Con esos datos, el defecto tiene **dos causas encadenadas**:

1. **Un despacho `BORRADOR` contaba como «despacho del día».** `_despacho_del_dia` filtraba
   solo por cuadrilla y fecha, sin mirar el estado. Un `BORRADOR` es la **propuesta** que el
   supervisor todavía está armando (`despacho.estado`: `BORRADOR → PUBLICADO → CERRADO`). Al
   procesarse el despacho del día, la APK creía que había jornada y **purgaba los casos del
   técnico** (D-104) que no estuvieran en ese borrador.
2. **El diferencial descartaba los casos que el dispositivo no tenía.** `construir_descarga`
   aplicaba `desde` a todos los casos: un caso **desconocido** para el dispositivo pero con
   `actualizado_en` anterior a la marca se descartaba por «no modificado». El despacho **no
   toca `caso.actualizado_en`**, así que un caso antiguo recién asignado (el caso normal) nunca
   llegaba: la respuesta quedaba vacía con el mensaje «su cuadrilla tiene N caso(s) y el
   dispositivo ya los tiene todos: no hay cambios» —exactamente lo que veía el director— y el
   listado, ya purgado, quedaba vacío.

El tercer punto de la petición era real: el conmutador de resueltos de D-101 se pintaba **solo
si `gestionados > 0`**, así que con el listado vacío desaparecía.

---

## 2. Decisiones

| ID | Decisión |
|---|---|
| **DEC-105-1** | Solo cuentan como jornada los despachos **`PUBLICADO` o `CERRADO`**. Un `BORRADOR` no es la jornada del técnico y **nunca** puede disparar la purga (completa DEC-104-3) |
| **DEC-105-2** | Un caso que el dispositivo **no tiene** se envía **siempre**, aunque no haya cambiado desde `desde`: el diferencial solo puede ahorrar tráfico de lo que el dispositivo ya tiene |
| **DEC-105-3** | Si el cliente no manda `ids_conocidos` (modo «solo `desde`»), se conserva el diferencial puro por fecha |
| **DEC-105-4** | El botón de resueltos es **permanente**: se pinta siempre, con el conteo real (aunque sea 0), y la vista vacía de «todo resuelto» mantiene su botón |

---

## 3. Qué cambió

### 3.1 API (`app/services/sync.py`)

- `ESTADOS_DESPACHO_VIGENTE = ("PUBLICADO", "CERRADO")` y `_despacho_del_dia` filtra por ese
  estado: un `BORRADOR` devuelve `despacho_del_dia: null` e `ids_del_dia: []`, de modo que la APK
  **no borra nada**.
- `construir_descarga`: el descarte por «no modificado» ya no se aplica a los casos
  desconocidos. La regla queda:
  - conocido y sin cambios → no viaja;
  - conocido y modificado → viaja;
  - **desconocido → viaja siempre**;
  - sin `ids_conocidos` (modo `desde`) → se mantiene el diferencial por fecha.

### 3.2 APK (`app_movil`)

- Nuevo `lib/widgets/chip_resueltos.dart` (`ChipResueltos`): conmutador **permanente**
  «Resueltos (N)», con icono de visibilidad y tooltip; es un widget sin lógica para poder
  probarlo aislado.
- `casos_screen.dart`: se pinta **siempre** (antes estaba dentro de `if (gestionados > 0)`), la
  vista de «todo resuelto» conserva su botón y los textos pasan a «resuelto(s)» para coincidir
  con el botón.
- Versión a **`1.7.0+16`** (`pubspec.yaml` y `AppConstants.version`).

---

## 4. Trazabilidad

| ID | Requisito / regla |
|---|---|
| RF-86 | La descarga prioriza la verdad del dispositivo: lo que no tiene, se le envía |
| RF-87 | El técnico puede abrir en cualquier momento los casos ya resueltos del dispositivo |
| RNF-42 | La sincronización no pierde trabajo: ningún caso puede quedar inaccesible por el diferencial ni por la purga |
| RT-30 | Pruebas del diferencial («caso desconocido y antiguo») y de la jornada («borrador no es jornada») como funciones verificables |

---

## 5. Archivos

| Archivo | Cambio |
|---|---|
| `app/services/sync.py` | Estado vigente del despacho, diferencial sin pérdida y docstrings |
| `app/tests/test_sync_api.py` | **2 pruebas nuevas** (caso desconocido antiguo y despacho en borrador) |
| `app_movil/lib/widgets/chip_resueltos.dart` | **Nuevo**: conmutador permanente |
| `app_movil/lib/features/casos/casos_screen.dart` | El chip ya no es condicional; textos «resueltos» |
| `app_movil/test/d105_resueltos_test.dart` | **Nuevo**: 4 pruebas del widget |
| `app_movil/lib/core/constants.dart`, `app_movil/pubspec.yaml` | Versión `1.7.0+16` |

---

## 6. Verificación

| Prueba | Resultado |
|---|---|
| `pytest` de integración (PostgreSQL 18, esquema `ggto_test`) | **390/390 en verde** (388 previos + **2 nuevos** de D-105) |
| `flutter analyze` | **«No issues found!»** |
| `flutter test` | **161/161 en verde** (157 previos + **4 nuevos** de `d105_resueltos_test.dart`) |
| `ruff check` en los archivos tocados | **limpio** |

**Pruebas nuevas de D-105:** un caso desconocido y **más antiguo que la marca `desde`** viaja
igual en la descarga (con y sin `ids_conocidos`) · un despacho **`BORRADOR` no es la jornada**
(`despacho_del_dia: null`, `ids_del_dia: []`) · el chip de resueltos se pinta con 0, muestra el
conteo real, alterna al pulsarlo y refleja el estado «viendo resueltos».

También se corrigió el contrato de la ruta: `ids_conocidos` ausente ahora significa «el
dispositivo no declara lo que tiene» (diferencial puro por `desde`, como antes); antes el
servidor lo convertía en un conjunto vacío y no podía distinguir «no tengo nada» de «no lo
mandé». La APK, por su parte, **no envía `desde` cuando su caché está vacía**: sin casos no hay
marca de agua válida y la descarga debe ser completa (era la otra mitad del mismo defecto).

---

## 7. Pendiente

- **Desplegar** la API (imagen nueva de Cloud Run) y **publicar la APK `1.7.0+16`**: sin las dos
  piezas, el dispositivo sigue con el comportamiento anterior.
- Prueba **en dispositivo**: tras sincronizar, el listado debe mostrar los casos de la cuadrilla
  y el chip «Resueltos (N)» debe estar visible siempre.
- Cuando se **publique** un despacho del día, la purga de D-104 vuelve a aplicar: los casos de
  jornadas anteriores no atendidos se descartan del dispositivo. Si el servidor los sigue
  entregando (siguen siendo trabajo de la cuadrilla), la descarga siguiente los vuelve a traer y
  a descartar: es el comportamiento literal de D-104, ruidoso pero sin pérdida. Si molesta, el
  siguiente paso es mover la regla de jornada al servidor (que la descarga entregue solo la
  jornada publicada más lo ya atendido).
