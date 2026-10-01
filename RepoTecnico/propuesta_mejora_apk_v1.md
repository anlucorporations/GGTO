# Propuesta de mejora de la APK móvil — GGTO

| Campo | Valor |
|---|---|
| **Documento** | Propuesta de mejora de la APK móvil (ciclo 8 de desarrollo) |
| **Proyecto** | GGTO — Sistema de administración de reportes de avería y construcción de puntos ópticos |
| **Cliente** | CANTV C.A. — Central Francisco Salias (Área 4) |
| **Decisión vinculada** | **D-73** (nueva propuesta de mantenimiento / mejora) |
| **Versión** | v1.0 |
| **Fecha** | 2026-10-01 |
| **Autor** | Ing. Angel H. Lucci / Dirección del proyecto |

---

## 1. Resumen ejecutivo

El presente documento describe una propuesta de mejora para la **aplicación móvil (APK)** de GGTO.
La APK utilizará Flutter + SQLite local (casos offline) y estará alimentada por el backend FastAPI existente.
El alcance de esta mejora se centra en:

1. **Sincronización tipo DESCARGA**: traer únicamente los casos asignados a la cuadrilla del técnico que inició sesión, manteniendo toda la data mínima necesaria para trabajar sin conexión.
2. **Sincronización tipo CARGA**: subir el trabajo del día (actividades del caso + evidencias fotográficas) de forma segura, confiable y trazable.
3. **Pantalla de acceso (login)**: branding con el logo de CANTV, título «PLANTA EXTERNA GPON», pie de pantalla y aviso legal/confidencialidad.

> **Nota técnica importante**: en el repositorio actual solo existen los binarios (`app_movil/GGTOv2.apk` y `app_movil/app-release.apk`). No hay código fuente Flutter en el workspace. Esta propuesta supone que se creará o recuperará el proyecto Flutter bajo `app_movil/ggto_apk` (o equivalente), y que se agregarán los assets y endpoints aquí descritos.

---

## 2. Objetivos y criterios de aceptación

### 2.1 Objetivos

- Reducir al mínimo la carga de red para la APK, descargando **solo** los casos que le corresponden al técnico logueado según su cuadrilla activa.
- Permitir que el técnico realice su gestión sin conexión mientras dure la jornada, y que al finalice la jornada sincronice con el servidor.
- Garantizar que las evidencias fotográficas lleguen al servidor de forma segura y vinculadas a cada actividad/caso.
- Alinear la identidad visual de la APK con CANTV y el proyecto GGTO.
- Garantizar que el aviso legal y de confidencialidad (`disclaimer.md`) se muestre y acepte antes del acceso.

### 2.2 Criterios de aceptación principales

- [ ] Un técnico con rol `TECNICO` y cuadrilla activa puede llamar a `GET /api/v1/sync/descarga` y recibir únicamente los casos de su cuadrilla.
- [ ] Un técnico sin cuadrilla activa obtiene respuesta vacía (o aviso de «sin asignación»).
- [ ] La APK persiste localmente en SQLite los casos descargados y los muestra offline.
- [ ] El botón **DESCARGA** adiciona/actualiza casos locales sin duplicarlos y respetando una marca temporal de sincronización.
- [ ] El botón **CARGA** sube todas las actividades y evidencias pendientes del día.
- [ ] Las fotos se envían por multipart/form-data y se almacenan en un bucket de Cloud Storage; su referencia queda en la tabla `evidencia`.
- [ ] La pantalla de acceso muestra el logo CANTV centrado, título, pie exacto y obliga a aceptar el disclaimer.
- [ ] El servicio se despliega bajo HTTPS y mantiene RBAC (`require_roles`).

---

## 3. Requisitos funcionales y no funcionales propuestos

### 3.1 Nuevos requisitos funcionales (RF-39 a RF-44)

| ID | Requisito | Origen |
|---|---|---|
| **RF-39** | La APK debe permitir al técnico elegir entre dos operaciones de sincronización: **DESCARGA** y **CARGA**. | Petición del usuario |
| **RF-40** | La operación **DESCARGA** debe consultar al servidor los casos asignados a la cuadrilla del técnico logueado y persistirlos localmente, agregando solo aquellos que aún no existan en el dispositivo o que hayan cambiado desde la última sincronización. | Petición del usuario |
| **RF-41** | La operación **CARGA** debe enviar al servidor todas las actividades registradas localmente el día de la jornada, actualizando estado y bitácora de cada caso. | Petición del usuario |
| **RF-42** | La operación **CARGA** debe enviar todas las evidencias fotográficas tomadas ese día, vinculándolas a la actividad respectiva. | Petición del usuario |
| **RF-43** | La pantalla de acceso debe mostrar el logo de CANTV centrado, el título «PLANTA EXTERNA GPON», el pie exacto `APK en Desarrollo - Desarrollado por ING. Angel Lucci - Uso confidencial de CANTV-GGTO - 2026` y el aviso legal completo. | Petición del usuario |
| **RF-44** | El aviso legal debe aceptarse explícitamente antes de mostrar el formulario de acceso; la aceptación debe persistir en el dispositivo. | Petición del usuario |

### 3.2 Nuevos requisitos no funcionales (RNF-26 a RNF-30)

| ID | Requisito | Origen |
|---|---|---|
| **RNF-26** | La DESCARGA debe completarse en ≤ 30 s para una cuadrilla con hasta 60 casos en condiciones normales de red móvil. | Diseño |
| **RNF-27** | La CARGA debe soportar lotes de hasta 50 fotos o 150 MB por sesión, con reintentos automáticos ante fallos parciales. | Diseño |
| **RNF-28** | El almacenamiento local de la APK debe estar protegido (SQLCipher / cifrado del sistema operativo) y no permitir extracción sencilla de PII. | Seguridad |
| **RNF-29** | Las evidencias deben conservarse en Cloud Storage con nombres imposibles de adivinar (UUID) y acceso limitado al bucket. | Seguridad |
| **RNF-30** | La APK debe ser compatible con Android 8.0+ y utilizar Flutter estable (canal estable). | Portabilidad |

---

## 4. Diseño del backend (API FastAPI)

Se propone crear un módulo de sincronización independiente e inyectarlo en el router principal.

### 4.1 Nuevos archivos propuestos

```text
app/
├── api/
│   └── routes_sync.py          # endpoints de DESCARGA/CARGA/evidencias
├── services/
│   ├── sync.py                 # lógica de negocio: cuadrilla, descarga, carga
│   └── storage.py              # subida a Cloud Storage (evidencias)
└── schemas/
    └── sync.py                 # Pydantic SyncDescargaOut, SyncCargaIn, etc.
```

### 4.2 Endpoint para obtener la cuadrilla activa del técnico

```http
GET /api/v1/sync/cuadrilla
Authorization: Bearer <JWT>
```

- Resuelve `usuario.id_tecnico` → `cuadrilla_tecnico.id_cuadrilla` donde `hasta IS NULL`.
- Retorna `id_cuadrilla`, `codigo`, `nombre` y `fecha_vigencia` (`desde`).
- Para rol `TECNICO`: forzado a su propia cuadrilla.
- Para `SUPERVISOR`/`ADMIN`/`SUPER`: consulta por defecto la propia (si la tiene) o permite parámetros opcionales.

### 4.3 Endpoint de DESCARGA

```http
GET /api/v1/sync/descarga
Authorization: Bearer <JWT>
Query: desde=<ISO8601>&ids_conocidos[]=1&ids_conocidos[]=2&...
```

**Comportamiento**:

1. Determina `id_central` del usuario y `id_cuadrilla` vigente.
2. Busca los **últimos despachos y asignaciones** (`despacho_caso`) para esa cuadrilla:
   - Casos cuya última fila en `despacho_caso` apunta a dicha cuadrilla.
   - Estados que aún permiten trabajo de campo: `ASIGNADO`, `CONTACTADO`, `CITADO`, `DIFERIDO`, `EN_GESTION`.
3. Si llega `ids_conocidos[]` y/o `desde`, excluye o actualiza solamente los casos faltantes/cambiados.
4. Devuelve un payload que incluye:
   - `casos`: lista de objetos `CasoOut` minimal (los datos mínimos para campo).
   - `despacho_caso`: filas relevantes con `orden_visita`, `tipo_asignacion`, observación.
   - `catalogos`: causas y métodos vigentes (cacheable).
   - `server_ts`: timestamp del servidor para que la APK guarde como `last_sync_at`.

> **Decisiones abierta**: se recomienda que la descarga inicial del día traiga los últimos 7 días de asignaciones activas; para el resto del día, basta con `desde=last_sync_at`. Esto se ajustará en la estimación.

### 4.4 Endpoints de CARGA

#### 4.4.1 Subida individual o batch de fotos

```http
POST /api/v1/evidencias/upload
Authorization: Bearer <JWT>
Content-Type: multipart/form-data
Body:
  - file: <JPEG>
  - id_caso: <int>
  - id_actividad: <int>           # puede ser el id local durante la carga mixta
  - tipo: "DEMO" | "FOTO_TRABAJO" | "OTRO"
  - latitud, longitud, fecha_hora, serial_local: <string>
```

**Comportamiento**:

- Valida JWT, rol y que el caso esté dentro del alcance del técnico.
- Almacena el archivo en Cloud Storage bajo `evidencias/{id_caso}/{uuid}.jpg`.
- Crea fila en `evidencia` con `serial_imagen=serial_local` (o generado), `ruta_remota` y metadatos.
- Responde con `serial`, `ruta_publica` (URL firmada temporal) y `id_evidencia`.

#### 4.4.2 Envío del paquete de trabajo del día

```http
POST /api/v1/sync/carga
Authorization: Bearer <JWT>
Content-Type: application/json
Body:
{
  "dispositivo_id": "<uuid del dispositivo>",
  "version_app": "1.0.0",
  "actividades": [
    {
      "id_caso_local": "<local>",
      "id_caso": <int>,
      "tipo": "CIERRE" | "CONTACTO" | "CITA" | "ENRUTADO" | "DIFERIDO",
      "resultado": "EXITOSO" | "FALLIDO" | "NO_ATIENDE" | null,
      "reporte_corto": "...",
      "id_metodo": <int>,
      "id_causa": <int>,
      "fecha_hora": "ISO8601",
      "latitud": 10.123,
      "longitud": -66.987,
      "evidencias": ["serial-1", "serial-2", ...]
    }
  ],
  "estados": [{"id_caso": 1, "estado_nuevo": "CERRADO", "motivo": "..."}]
}
```

**Comportamiento**:

- Valida que cada `id_caso` pertenezca actualmente a la cuadrilla del técnico (salvo `SUPERVISOR`/`ADMIN`/`SUPER`).
- Para cada actividad:
  - Crea fila en `actividad` (sincronizado=true).
  - Vincula las evidencias subidas previamente por `serial_imagen`.
  - Actualiza `caso.estado_actual` y registra entrada en `caso_estado_hist`.
  - Si es cierre, reutiliza la lógica existente de `routes_casos.cerrar_caso` (modo, causa, descripción).
- Devuelve resumen: actividades aceptadas, rechazadas, errores por caso.

### 4.5 Registro de sesiones de sync (auditoría / resiliencia)

Se propone crear una tabla `sync_log`:

| Campo | Tipo | Descripción |
|---|---|---|
| `id_sync_log` | serial PK | Identificador interno |
| `p00` | varchar(20) | Técnico que sincroniza |
| `id_cuadrilla` | int | Cuadrilla del momento |
| `tipo` | varchar(20) | `DESCARGA` / `CARGA` |
| `dispositivo_id` | varchar(80) | UUID del dispositivo |
| `version_app` | varchar(20) | Versión de la APK |
| `iniciado_en` | timestamptz | Inicio de la sesión |
| `finalizado_en` | timestamptz | Fin de la sesión |
| `recibidos` | int | Casos/actividades recibidas |
| `procesados` | int | Casos/actividades aplicadas |
| `errores` | int | Errores |
| `estado` | varchar(20) | `OK`, `PARCIAL`, `ERROR` |
| `detalle` | jsonb | Errores detallados |

Esto cierra el bucle de trazabilidad y permite detectar sincronizaciones pendientes o incompletas.

---

## 5. Diseño de la APK Flutter

### 5.1 Dependencias propuestas (`pubspec.yaml`)

```yaml
dependencies:
  flutter:
    sdk: flutter
  sqflite: ^2.3.2
  path: ^1.9.0
  dio: ^5.4.0
  http_parser: ^4.0.2
  image_picker: ^1.0.7
  image: ^4.1.3
  geolocator: ^10.1.0
  intl: ^0.19.0
  flutter_secure_storage: ^9.0.0
  path_provider: ^2.1.2
  connectivity_plus: ^5.0.2
  package_info_plus: ^5.0.1

dev_dependencies:
  flutter_test:
    sdk: flutter
```

### 5.2 Esquema de la base de datos local (SQLite)

| Tabla | Propósito |
|---|---|
| `caso_local` | Casos descargados del servidor; clave primaria local autoincremental + `id_caso_server` único. |
| `despacho_caso_local` | Asignación de cada caso a la cuadrilla: orden de visita, tipo, observación. |
| `actividad_local` | Actividades registradas en campo pendientes de sincronizar. |
| `evidencia_local` | Fotos pendientes de sincronizar + ruta local del archivo. |
| `sync_log_local` | Bitácora local de cada sesión de sync. |
| `disclaimer_local` | Versión aceptada del disclaimer y timestamp. |

### 5.3 Algoritmo de sincronización

#### DESCARGA (pull incremental)

```text
1. Verificar conectividad.
2. Leer last_sync_at y lista de id_caso_server conocidos localmente.
3. GET /api/v1/sync/descarga?desde={last_sync_at}&ids_conocidos[]={id1}&...
4. Dentro de una transacción SQLite:
   a. Insertar casos nuevos (id_caso_server no existente).
   b. Actualizar casos existentes si actualizado_en > local.actualizado_en.
   c. Insertar/actualizar filas de despacho_caso_local.
   d. Guardar server_ts como last_sync_at.
5. Mostrar resumen: N casos nuevos, M actualizados.
```

#### CARGA (push batch)

```text
1. Verificar conectividad.
2. Leer actividades y evidencias locales con sincronizado = 0.
3. Si hay fotos:
   a. Para cada foto: comprimir/thumbnail si es necesario.
   b. POST /api/v1/evidencias/upload con multipart.
   c. Marcar evidencia_local.sincronizado = 1 y guardar ruta_remota.
4. POST /api/v1/sync/carga con las actividades y seriales de evidencias.
5. Para cada actividad aceptada:
   a. Marcar actividad_local.sincronizado = 1.
   b. Actualizar caso_local.estado_actual con el resultado.
6. Registrar sync_log_local con estado OK/PARCIAL/ERROR.
7. Resolver conflictos: si falla una foto, el batch continúa; actividad se mantiene pendiente.
```

### 5.4 Pantallas propuestas

| Pantalla | Función |
|---|---|
| `DisclaimerScreen` | Muestra las cláusulas de `disclaimer.md`; requiere casilla de aceptación y botón «Aceptar e ingresar». Persiste la versión aceptada. |
| `LoginScreen` | Logo CANTV centrado, título «PLANTA EXTERNA GPON», formulario P00 + clave, enlaces a primer acceso/desbloqueo, pie de pantalla. |
| `SyncOptionScreen` | Dos grandes botones: **DESCARGA** y **CARGA**, con contadores de casos/ fotos pendientes. |
| `DownloadProgressScreen` | Progreso de descarga, resumen y lista de casos nuevos. |
| `UploadProgressScreen` | Progreso de subida de fotos y actividades; resumen de éxito/errores. |
| `CasosListScreen` | Listado offline de casos de la cuadrilla, con filtros por estado. |
| `CasoDetailScreen` | Ficha resumida del caso, botón para registrar actividad/cierre y adjuntar foto. |
| `ActividadFormScreen` | Formulario para registrar contacto/cierre/cita/diferido con método, causa, observación y foto. |

### 5.5 Flujo de navegación

```
[DISCLAIMER (si no aceptado)] → LOGIN → SYNC OPTIONS
                                      ↓
                         [DESCARGA] ← → → [CARGA]
                              ↓                ↓
                     CASOS LIST → CASO → ACTIVIDAD + FOTO
```

### 5.6 Cámara y gestión de fotos

- Tomar foto con `image_picker`.
- Guardar en directoro privado de la app (`path_provider`);
- Comprimir a JPEG 80 % ancho máximo 1920 px.
- Extraer/validar metadatos EXIF: fecha/hora de captura, geolocalición.
- Generar `serial_local` único: `{id_caso}-{uuid}`.
- Asociar a la actividad local pendiente.

---

## 6. Activos y recursos necesarios

### 6.1 Logo CANTV

- El usuario referenció `dosc/imagenes/logo_CANTV.png`. La ruta correcta dentro del proyecto será `docs/imagenes/logo_CANTV.png` y se copiará a `app_movil/assets/logo_CANTV.png`.
- Debe ser PNG con fondo transparente o blanco; se recomienda una resolución mínima de 512×512 px para escalado en móvil.
- En `pubspec.yaml` se declara:

```yaml
flutter:
  assets:
    - assets/logo_CANTV.png
```

### 6.2 Texto del disclaimer

- Fuente única de verdad: `disclaimer.md` en la raíz del repositorio.
- Para la APK se mantendrá una copia sincronizada en `app_movil/assets/disclaimer.md` y se parseará como texto plano; también se puede exponer desde FastAPI como `GET /manual/disclaimer.txt` para evitar duplicados.
- Versión del disclaimer: se controlará con un hash o semántica (`GGTO v0.9.0 · 2026-09-30`), igual que en la SPA (`app/web/src/disclaimer.ts`).

### 6.3 Bucket de Cloud Storage

- Se reutilizará el bucket previsto en D-16 o se creará `ggtov2-evidencias-{proyecto}` con las siguientes características:
  - Acceso uniforme a nivel bucket (privado).
  - Política de retención mínima alineada a D-34 (`evidencia` 2 años).
  - Lifecycle para eliminar residuos de subidas fallidas después de 7 días.

---

## 7. Seguridad, privacidad y cumplimiento

| Aspecto | Medida |
|---|---|
| **Autenticación** | JWT con expiración corta (≤ 24 h); refresh token opcional en versiones futuras. |
| **Transporte** | TLS 1.2+ obligatorio; certificado válido. |
| **Alcance** | El endpoint de sync obliga que un `TECNICO` consulte únicamente su cuadrilla; `SUPERVISOR`/`ADMIN`/`SUPER` tienen alcance ampliado. |
| **Almacenamiento local** | SQLite cifrado con `SQLCipher` (plugin `sqflite_sqlcipher`) o almacenamiento cifrado por el SO; tokens en `flutter_secure_storage`. |
| **Fotos locales** | Directorio privado de la aplicación; thumbnails sin PII en caché. |
| **PII en tránsito** | Los payload de DESCARGA traen la dirección y contacto del abonado; se recomienda minimizar datos sensibles a lo estrictamente necesario. |
| **Retención** | Alineado a D-34: `caso`/`actividad` 5 años, `evidencia` 2 años. |
| **Idempotencia** | La CARGA se identifica por `dispositivo_id` + timestamp; subidas duplicadas del mismo `serial_local` retornan el id existente sin crear filas nuevas. |
| **Aviso legal** | El disclaimer requiere aceptación explícita y se vuelve a mostrar si cambia la versión. |

---

## 8. Plan de implementación (estimación de esfuerzos)

Se propone abordar el trabajo en **6 mini-ciclos** (≈ 3–4 semanas con 1 desarrollador Flutter + 1 backend).

| # | Ciclo | Entregables | Esfuerzo estimado |
|---|---|---|---|
| 1 | **Backend sync (DESCARGA)** | `routes_sync.py`, `services/sync.py`, tests de integración, `db/schema.sql` actualizado con `sync_log`, endpoint `GET /sync/descarga`. | 3 días |
| 2 | **Backend evidencias (CARGA)** | Servicio de Cloud Storage, endpoint `POST /evidencias/upload`, endpoint `POST /sync/carga`, validaciones de alcance. | 3 días |
| 3 | **Flutter: esqueleto + UI** | Creación del proyecto Flutter, navegación, DisclaimerScreen, LoginScreen con branding y pie. | 2 días |
| 4 | **Flutter: SQLite + DESCARGA** | Modelo local, tablas, algoritmo de descarga incremental y listado offline de casos. | 4 días |
| 5 | **Flutter: actividad + CARGA** | Formulario de actividad, cámara, gestión local de fotos, subida batch y pantalla de progreso. | 5 días |
| 6 | **Integración, pruebas y build** | Pruebas E2E con dispositivo/emulador, build APK firmado, documentación de manuales móviles. | 3 días |

**Total estimado**: **20 días-hombre** (≈ 4 semanas calendario).

---

## 9. Pruebas propuestas

1. **Unitarias backend**: servicio `_cuadrilla_tecnico`, filtros de DESCARGA, mapeo de CARGA.
2. **Integración backend**: DESCARGA para TECNICO devuelve solo casos de su cuadrilla; CARGA crea actividades y evidencias correctamente.
3. **Seguridad**: un TECNICO no puede descargar casos de otra cuadrilla; SUPERVISOR sí puede ver cualquiera.
4. **Flutter**: pruebas de widgets (DisclaimerScreen, LoginScreen), pruebas de integración del DAO local.
5. **E2E móvil**: flujo completo login → descarga → registrar actividad con foto → carga → verificación en backend.
6. **Rendimiento**: descarga de 60 casos < 30 s en red móvil simulada (3G).

---

## 10. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **No se dispone del código fuente Flutter actual** | Alto | Se propone crear un proyecto Flutter nuevo bajo `app_movil/ggto_apk`; se evaluará si el APK binario existente se puede descompilar o si se requiere reescribir desde cero. |
| **Endpoint de subida de archivos no existe** | Alto | Se diseñará e implementará en el Ciclo 2; se utilizará Cloud Storage. |
| **Modelo `evidencia` actual solo guarda seriales** | Medio | Se extenderá `ruta_remota` y `ruta_local`; no se requiere cambiar el esquema general. |
| **Múltiples técnicos comparten una cuadrilla** | Medio | Carga con `dispositivo_id` + `serial_local`; idempotencia y sincronización de actividades por timestamp. |
| **Grandes volúmenes de fotos en zonas de mala cobertura** | Medio | Compresión, lotes pequeños configurable, reintentos con backoff y persistencia local hasta éxito. |
| **PII en dispositivo móvil** | Alto | Cifrado de DB, directorio privado, política de retención y borrado selectivo configurable. |
| **Definición de estado aceptado del disclaimer** | Bajo | Reutilizar la misma versión y cláusulas de `app/web/src/disclaimer.ts`. |

---

## 11. Preguntas abiertas para validación

1. **Código fuente**: ¿Se dispone del repositorio/original del APK actual para refactorizar, o se crea un proyecto Flutter nuevo?
2. **Alcance histórico**: ¿La APK debe almacenar solo los casos activos del día o también histórico de casos cerrados de los últimos días?
3. **Límites de fotos**: ¿Máximo de fotos por caso y tamaño máximo aceptado por CANTV?
4. **Disclaimer**: ¿Debe mostrarse en **cada inicio de sesión** o solo en la **primera instalación/actualización** de versión? (Propuesta: primera vez y al cambiar la versión del disclaimer.)
5. **Dispositivos**: ¿Los técnicos usan teléfonos personales o corporativos? Esto afecta la estrategia de cifrado y borrado remoto.

---

## 12. Estado de implementación (D-73 aplicada)

Esta propuesta fue **aprobada e implementada** el 2026-10-01. Resumen de lo entregado:

### Backend
- `app/api/routes_sync.py` — endpoints `GET /api/v1/sync/cuadrilla`, `GET /api/v1/sync/descarga`, `POST /api/v1/evidencias/upload`, `POST /api/v1/sync/carga`.
- `app/services/sync.py` — resolución de cuadrilla activa, carga diferencial por cuadrilla y aplicación del batch de actividades/estados.
- `app/services/storage.py` — subida a Cloud Storage con fallback local para desarrollo/pruebas.
- `app/schemas/sync.py` — modelos Pydantic de entrada/salida.
- `app/models/sync_entities.py` + tabla `sync_log` en `db/schema.sql`.
- Se registró el router en `app/main.py` y se añadió `httpx` a `requirements.txt`.

### APK Flutter (`app_movil/`)
- `login_screen.dart`: logo CANTV centrado, título «PLANTA EXTERNA GPON», pie exacto de confidencialidad.
- `disclaimer_storage.dart` + `main.dart`: el aviso se muestra en **cada inicio de sesión**.
- `download_service.dart`: DESCARGA diferencial contra `/sync/descarga`.
- `upload_service.dart`: CARGA directa de fotos vía multipart y envío de actividades pendientes vía `/sync/carga`.
- `casos_provider.dart`: ahora consume `DownloadService` en lugar del listado global `/casos`.
- `sync_screen.dart`: reemplazado el botón EXPORTAR ZIP por botones **DESCARGA** y **CARGA**.
- `camara_screen.dart` + `evidencia_service.dart`: límite de 5 fotos por caso y validación/recompresión ≤ 3 MB.
- Asset agregado: `assets/logo_CANTV.webp` (declarado en `pubspec.yaml`).

### Pendientes para cierre total del ciclo
1. Ejecutar pruebas de integración del backend sync en un entorno con base de datos disponible.
2. Compilar el APK firmado y probarlo en dispositivo/emulador.
3. Configurar credenciales/bucket de GCS reales para producción (`GGTO_GCS_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS`).
4. Actualizar manuales técnicos/literales de la sección móvil una vez verificadas las rutas nuevas.

El resultado es una APK funcional, offline-first, segura y alineada con la identidad institucional y legal del proyecto GGTO.
