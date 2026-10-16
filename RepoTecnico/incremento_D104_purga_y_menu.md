# Incremento D-104 — Sin menú inferior en el técnico y purga de despachos anteriores

| Campo | Valor |
|---|---|
| Petición | 1) Eliminar el menú inferior · 2) Al descargar, verificar que la cuadrilla del usuario **tenga despacho del día** y entonces borrar los casos **no atendidos** de despachos anteriores, para que el técnico vea solo lo ya atendido y lo nuevo del día |
| Fecha | 2026-10-16 |
| Alcance | APK (`app_movil`) + dos campos nuevos en la API de descarga (`app/services`, `app/schemas`) |
| Autor | Dirección del proyecto |

---

## 1. Decisiones

| ID | Decisión |
|---|---|
| **DEC-104-1** | **Atendido** = `estadosGestionados` de D-101: **cerrado, cancelado, enrutado, diferido y citado**. `CONTACTADO` **no** cuenta como atendido (decisión expresa del director): si es de un despacho anterior y no tiene trabajo sin enviar, se borra |
| **DEC-104-2** | **Nunca** se borra un caso con **trabajo sin enviar**: acciones en `accion_pendiente` (`PENDIENTE`/`REINTENTO`/`ERROR`) o fotografías con `evidencia_local.subida = 0`. Borrarlo perdería trabajo de campo |
| **DEC-104-3** | La purga **solo** se ejecuta si el servidor confirma el **despacho del día** de la cuadrilla (`despacho_del_dia`). Si no lo hay —o si la descarga falla— **no se borra nada**: el técnico puede estar trabajando con el despacho de ayer |
| **DEC-104-4** | El menú inferior se retira **solo del rol TÉCNICO** (como se indicó): vuelve a su pantalla de casos con las acciones en la barra de título, donde ya estaban. La barra de los roles de **gestión** se conserva: es su única forma de cambiar de sección |
| **DEC-104-5** | El día se calcula con el **día operativo** de la central (`app/services/tiempo.py`, `America/Caracas`), no con el día del servidor (UTC) |

---

## 2. Qué cambió

### 2.1 API: la descarga informa de la jornada (D-104)

`GET /api/v1/sync/descarga` añade dos campos:

```json
"despacho_del_dia": { "id_despacho": 812, "fecha": "2026-10-16" },   // null si no hay jornada hoy
"ids_del_dia": [48213, 48207, 48190]                                 // casos del despacho de hoy
```

- `despacho_del_dia` es la condición de seguridad: sin él, la APK no purga.
- `ids_del_dia` se calcula con el mismo criterio que el universo descargable (el **último** despacho
  del caso debe ser el de hoy y de esta cuadrilla), así un caso reasignado hoy a otra cuadrilla no
  cuenta como del día para la anterior.
- Viaja también en las respuestas sin casos (`SIN_DESPACHO`, `SIN_PENDIENTES`) para que la app pueda
  purgar sin esperar a que haya novedades.

### 2.2 APK: purga tras la descarga

`ResultadoDescarga` gana `descartados` y `despachoDelDia`; `DownloadService.descargar` —después de
guardar los casos y las masivas— ejecuta `PurgaDespachos.ejecutar(idsDelDia: …)` y el técnico ve el
resultado en el mensaje de la descarga («Se descartaron N caso(s) no atendidos de jornadas
anteriores»).

La decisión es una **función pura** (`PurgaDespachos.planificar`), igual que `planMergeMasivas`
(D-99), para poder probarla sin SQLite.

### 2.3 APK: sin menú inferior en el técnico

- Se elimina `InicioTecnicoScreen` (la pantalla con `NavigationBar` de cinco destinos que introdujo
  la propuesta visual) y el rol TECNICO vuelve a entrar por `CasosScreen`, con sus acciones en la
  barra de título.
- La barra de los roles de gestión (`InicioGestionScreen`, máximo 5 destinos + hoja «Más») **se
  mantiene**: sin ella esos roles no podrían cambiar de sección.

---

## 3. Trazabilidad

| ID | Requisito / regla |
|---|---|
| RF-84 | La descarga verifica que la cuadrilla tenga despacho del día antes de limpiar la caché |
| RF-85 | El dispositivo conserva los casos atendidos y los del despacho del día, y descarta el resto |
| RNF-41 | Nunca se descarta un caso con acciones o evidencias sin enviar |
| RT-29 | Plan de purga como función pura, verificable sin base de datos |

---

## 4. Archivos

| Archivo | Cambio |
|---|---|
| `app/services/sync.py` | `_despacho_del_dia`, `_casos_del_dia`, campos en `_respuesta` y uso del día operativo |
| `app/schemas/sync.py` | `DespachoDelDiaOut` + `despacho_del_dia` e `ids_del_dia` en `SyncDescargaOut` |
| `app_movil/lib/features/sync/download_service.dart` | Lee la jornada, ejecuta la purga y reporta `descartados` |
| `app_movil/lib/features/sync/purga_despachos.dart` | **Nuevo**: plan puro + ejecución |
| `app_movil/lib/core/database.dart` | `casosParaPurga`, `clavesConTrabajoPendiente` y `borrarCasos` |
| `app_movil/lib/features/casos/casos_provider.dart` | Informa de los casos descartados |
| `app_movil/lib/main.dart` | El TÉCNICO entra por `CasosScreen` (sin barra inferior) |
| `app_movil/lib/features/inicio/inicio_tecnico_screen.dart` | **Eliminado** |
| `app_movil/test/d104_purga_despachos_test.dart` | **Nuevo**: 7 pruebas del plan |

---

## 5. Verificación

| Prueba | Resultado |
|---|---|
| `flutter analyze` | **«No issues found!»** |
| `flutter test` | **157/157 en verde** (150 previos + **7 nuevos** de D-104) |
| `ruff check` / `mypy` en los archivos tocados | **limpios** (los 6 avisos de ruff y el de mypy que quedan en el repositorio son **preexistentes**, en `app/tests`) |
| `pytest` (pruebas sin base de datos) | **44/44** |

**Pruebas de D-104:** se conserva lo del despacho del día aunque siga pendiente · se borra lo no
atendido de jornadas anteriores · se conservan los cinco estados gestionados · `CONTACTADO` **sí** se
borra (decisión del director) · nunca se borra un caso con acción en cola o foto sin subir · filas sin
identificador y listas vacías no rompen.

---

## 6. Pendiente

- **Prueba en dispositivo** del ciclo completo: con despacho del día debe verse «N descartados», y sin
  despacho del día (o sin conexión) no debe desaparecer ningún caso.
- **Prueba de integración del backend** (requiere PostgreSQL): comprobar `despacho_del_dia`/`ids_del_dia`
  con una cuadrilla con despacho y con otra sin él.
- **Tablero de la propuesta** (`docs/propuesta-visual-apk/mockup/apk.html`): muestra la barra inferior
  del técnico, que ya no existe; conviene actualizarlo.
- **Publicar la APK** (`versionCode` +15) para que el cambio llegue a los equipos, y **redesplegar** la
  web para que la API sirva los campos nuevos.
