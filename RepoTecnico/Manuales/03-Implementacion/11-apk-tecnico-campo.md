# 11 — La APK del técnico: contenido local, progreso de sincronización, sección Usuario y falla masiva de campo (Incremento D-82)

> Manual técnico de la aplicación **GGTO Técnico** (`app_movil/`, Flutter) tras el
> incremento **D-82**, que cubre cinco requisitos pedidos por el usuario:
> (1) que la APK muestre el **contenido local**; (2) una **barra con el progreso de
> la sincronización**; (3) un **menú de usuario** (icono de Usuario); (4) una
> **sección Usuario** con cambio de contraseña, palabras de seguridad (mostradas
> con la contraseña actual), datos personales y datos administrativos; y (5) el
> **reporte de falla masiva** con ODN · dirección · FAT · descripción y **máximo 2
> fotos** de evidencia.

---

## 1. Arquitectura de la app y flujo de datos

La APK es **offline-first**: el dispositivo es la fuente de verdad mientras el
técnico está en la calle.

```text
Backend FastAPI ──GET /sync/descarga──► SQLite local (ggto.db)
                                            │  leerCasos()      → lista en pantalla
                                            │  encolarAccion()  → cola offline
                                            │  evidencia_local  → fotos pendientes
Backend FastAPI ◄──POST /sync/carga─────── cola + fotos
                ◄──POST /evidencias/upload
                ◄──POST /fallas-masivas/reporte-campo (D-82)
```

- Base local: `app_movil/lib/core/database.dart` (`caso_local`, `accion_pendiente`,
  `evidencia_local`, `app_meta`).
- Interceptor HTTP, token y cierre por 401: `app_movil/lib/core/api_client.dart`.
- Rutas y guard de sesión: `app_movil/lib/main.dart:110-120`.

### 1.1 Defecto corregido en D-82

`CasosProvider.cargar()` llamaba a la DESCARGA —que escribe la caché SQLite— pero
**nunca volvía a leer la base local**: tras una descarga correcta, `_casos` seguía
vacío y la pantalla mostraba «No tiene casos asignados» aunque el dispositivo
tuviera los casos guardados. El contenido local solo aparecía por el camino de
error.

---

## 2. Contenido local (requisito 1)

| Pieza | Detalle |
|---|---|
| `app_movil/lib/features/casos/casos_provider.dart:47` | `cargar()` intenta la DESCARGA y, **en cualquier caso** (`finally`), vuelca la caché con `_leerLocal()` (`DatabaseHelper.leerCasos`). `locales` (`:43`) informa cuántos casos hay en el dispositivo. |
| `app_movil/lib/features/casos/casos_provider.dart:90` | `cargarDesdeCache()` lee la caché **sin tocar la red** y marca `desdeCache`. |
| `app_movil/lib/features/casos/casos_screen.dart:40` | Al abrir la pantalla se pinta **primero** la caché y después se intenta actualizar. |
| `app_movil/lib/features/casos/casos_screen.dart:216` | `_BannerContenidoLocal`: franja permanente «Contenido local · N casos · actualizado el …» con botón *Actualizar*; en ámbar con *Reintentar* cuando la última descarga falló (sin conexión). |
| `app_movil/lib/features/usuario/usuario_service.dart:129` | El perfil (`perfil_local`) y la cuadrilla (`cuadrilla_local`) se cachean en `app_meta`: la sección Usuario abre con datos locales aunque no haya red. |

**Regla de diseño:** la descarga **solo actualiza** la caché; nunca decide qué se
muestra. La lista visible es siempre el contenido del dispositivo.

---

## 3. Barra con el progreso de la sincronización (requisito 2)

### 3.1 Estado del progreso

`app_movil/lib/features/sync/sync_provider.dart`:

| Miembro | Línea | Uso |
|---|---|---|
| `progreso` (0…1), `fase`, `progresoActivo` | `:79-85` | Avance y texto del paso en curso. |
| `progresoPorcentaje` | `:88` | Entero para mostrar («42 %»). |
| `progresoEnReposo` / `resumenBarra` | `:92-102` | En reposo resume la cola: verde al día · ámbar «N acciones pendientes de envío» · rojo «N acciones con error». |
| `iniciarProgreso` / `actualizarProgreso` / `terminarProgreso` | `:105-126` | API que usan las pantallas y los servicios. |
| `sincronizar()` | `:189` | Avanza **acción por acción** (`procesadas / total`) y notifica en cada paso. |

### 3.2 Progreso de cada operación

| Operación | Archivo | Reparto del avance |
|---|---|---|
| DESCARGA | `app_movil/lib/features/sync/download_service.dart:36` | conectando 5 % → descargando 35 % → guardando en el dispositivo 70 % → 100 %. |
| CARGA | `app_movil/lib/features/sync/upload_service.dart:115` | 5 % apertura → fotos 10-60 % (`subirPendientes`, `:80`) → actividades 65 % → cierre de la jornada 90-100 %. |
| Cola offline | `sync_provider.dart:189` | acción por acción hasta vaciar la cola. |

### 3.3 El widget

`app_movil/lib/widgets/barra_progreso_sync.dart:15` — `BarraProgresoSync`:

- `compacta: true`: franja bajo la barra de título; se usa en **Casos**
  (`casos_screen.dart:74`), **Alertas** (`alertas_screen.dart:195`) y **Mensajes**
  (`mensajes_screen.dart:29`).
- `compacta: false`: tarjeta ancha en **Dispositivo** (`sync_screen.dart:109`), con
  el porcentaje a la derecha y el estado de conexión.

### 3.4 La CARGA también vacía la cola clásica

`app_movil/lib/features/sync/sync_screen.dart:55` — tras `UploadService.cargar()`,
si quedan pendientes y hay red se llama a `sync.sincronizar()`: es lo que envía las
**fallas masivas** y las **citas**, que el lote de `/sync/carga` no cubre.

---

## 4. Menú de usuario (requisito 3)

| Pieza | Detalle |
|---|---|
| `app_movil/lib/widgets/boton_usuario.dart:8` | `BotonUsuario`: `Icons.account_circle` que abre la ruta `/usuario`. |
| `app_movil/lib/main.dart:119` | Ruta protegida `/usuario` → `UsuarioScreen`, dentro del mismo guard `_RutaProtegida` que el resto de pantallas de campo. |
| Casos / Alertas / Dispositivo / Mensajes | El icono está en la barra superior de las cuatro pantallas. El **cierre de sesión** ya no es un candado suelto: vive dentro de la sección Usuario. |

---

## 5. Sección Usuario (requisito 4)

`app_movil/lib/features/usuario/usuario_screen.dart:26` + `usuario_service.dart`.
Cuatro bloques desplegables, todos alimentados primero por el contenido local:

| Bloque | Línea | Contenido | Endpoint |
|---|---|---|---|
| **Datos personales** | `:270` | Nombre, apellido, P00 y **correo editable** con «Guardar correo». | `GET /auth/me`, `PATCH /auth/me` |
| **Datos administrativos** | `:301` | P00, rol, **cuadrilla activa** (código · nombre), desde cuándo, central, identificador del dispositivo y versión de la app. | `GET /auth/me`, `GET /sync/cuadrilla` |
| **Cambiar la contraseña** | `:315` | Contraseña actual, nueva (mínimo 8) y confirmación; valida en el cliente y muestra el mensaje del servidor. | `POST /auth/cambio-clave` (`usuario_service.dart:197`) |
| **Palabras de seguridad** | `:365` | Estado (cantidad y versión) y **«Ver palabras de seguridad»**: exige la **contraseña actual**, muestra las 12 palabras numeradas (seleccionables y copiables) y advierte de que las anteriores dejan de valer. | `GET /auth/mi-seguridad` (`:188`), `POST /auth/palabras/mostrar` (`:226`) |

> **Nota de seguridad.** Las palabras se guardan **solo como hashes Argon2id**
> (`dispositivo_seguridad.palabras_hash`), así que «verlas» implica
> **regenerarlas** tras verificar la contraseña actual: el backend invalida las
> anteriores, audita el movimiento (`REGENERAR_PALABRAS_PROPIO`, sin guardar los
> valores) e incrementa `version`. El aviso en pantalla es explícito.

### 5.1 Defecto corregido en el backend

`app/api/routes_auth.py` — `POST /auth/palabras/mostrar` usaba `datetime`/`UTC`
**sin importarlos** y llamaba a un `_auditar` inexistente (habría respondido
**500**). Ahora importa `datetime`/`UTC` e inserta la fila de `Auditoria` igual que
el resto del módulo (`routes_auth.py:512-526`).

---

## 6. Reporte de falla masiva de campo (requisito 5)

### 6.1 Formulario de la APK

`app_movil/lib/features/alertas/alertas_screen.dart`:

| Campo | Línea | Validación en el cliente |
|---|---|---|
| **ODN\*** | `:218` | ≥ 3 caracteres. |
| **Dirección\*** | `:228` | ≥ 5 caracteres. |
| **FAT\*** | `:239` | Obligatoria. |
| **Descripción\*** | `:251` | ≥ 5 (máximo 400 en el campo, 500 en el servidor). |
| Sector (opcional) | `:262` | Numérico. |
| **Fotos de evidencia** | `:311` | **Máximo 2** (`AppConstants.maxEvidenciasFallaMasiva`), cámara + GPS, ≤ 3 MB, miniatura con botón para quitarla. |

Flujo (`_reportarFalla`, `:96`): 1) validación **previa** (no se sube ninguna foto
si faltan datos); 2) se suben las fotos del reporte con
`POST /evidencias/upload` (`upload_service.dart:43`); 3) se registra la falla en
`POST /fallas-masivas/reporte-campo` (`operaciones_service.dart:253`, endpoint en
`:312`). **Sin conexión** la acción queda en la cola con los seriales locales y las
fotos en `evidencia_local`; la CARGA sube los archivos y la cola envía la acción.

### 6.2 Endpoint de campo

`app/api/routes_alertas.py:206` — `POST /api/v1/fallas-masivas/reporte-campo`:

- Cuerpo `FallaMasivaCampo` (`app/schemas/alertas.py:70`): `odn`, `direccion`,
  `fat`, `descripcion` obligatorios; `id_sector`/`id_cuadrilla` opcionales;
  `evidencias` con **máximo 2** (`MAX_EVIDENCIAS_CAMPO`, `routes_alertas.py:54`).
- **Cualquier usuario autenticado** puede usarlo (el TECNICO es quien detecta la
  concentración); el alta administrativa `POST /fallas-masivas` conserva su RBAC
  de ADMIN/SUPERVISOR.
- `origen` se fija a `REPORTE_TECNICO` y la cuadrilla se toma de la activa del
  reportante y, si no tiene, de la más cercana al sector
  (`app/services/fallas.py:26`).
- Las evidencias se guardan en `falla_masiva.evidencias` (seriales separados por
  coma) y `FallaMasivaOut.evidencias` las devuelve como lista
  (`app/schemas/alertas.py:11`, validador `_evidencias_sin_nulos`).

### 6.3 Esquema y migración

| Pieza | Detalle |
|---|---|
| Modelo | `app/models/despacho_entities.py:128-131` — `odn varchar(60)`, `direccion varchar(200)`, `fat varchar(60)`, `evidencias text`. |
| DDL | `RepoTecnico/db/schema.sql:503-506`. |
| Migración | `scripts/migrar_d82_falla_campo.py` — idempotente, **simulación por defecto**, `--aplicar`, `--si`, `--dsn`, verificación post-migración y log en `RepoTecnico/BaseOperaciones/migracion_d82.log`. Columnas **aditivas**: el código anterior las ignora. |
| Ficha web | `app/web/src/components/FichaFalla.tsx` muestra **ODN · FAT · Dirección (reporte)** y los seriales de las evidencias; tipos en `app/web/src/api/types.ts`. |

### 6.4 Cola offline y evidencias

| Acción | Tipo en la cola | Endpoint |
|---|---|---|
| Falla masiva de campo | `FALLA_MASIVA` | `/fallas-masivas/reporte-campo` |
| Foto de evidencia | fila en `evidencia_local` con `subida = 0` | `/evidencias/upload` |

`UploadService.subirPendientes({idCaso})` permite subir **solo** las fotos de un
reporte concreto (`upload_service.dart:80`), con `id_caso` = identificador local
del reporte (`FM-<millis>`).

---

## 7. Configuración y despliegue

| Elemento | Valor |
|---|---|
| Versión visible | `AppConstants.version` = `1.0.0+3` (`pubspec.yaml`), verificada por `test/version_visible_test.dart`. |
| URL de la API | `AppConstants.baseUrl` (`--dart-define=GGTO_API_BASE=…`). |
| Firma | Keystore oficial `RepoTecnico/credenciales/ggto-tecnico-release.jks` + `app_movil/android/key.properties`; publicación con `python scripts/publicar_apk.py --confirmar` (valida el keystore y la firma con `apksigner`). |
| Entrega | `app_movil/GGTOv2.apk` con su SHA-256. |

---

## 8. Pruebas

| Nivel | Comando | Cobertura D-82 |
|---|---|---|
| Análisis | `flutter analyze` | Sin hallazgos. |
| Unitarias/widget | `flutter test` | `test/d82_apk_test.dart` (12): validación del reporte de campo, barra de progreso (porcentaje y widget), icono de usuario → ruta `/usuario`, datos de la sección Usuario. |
| Integración backend | `pytest` con `GGTO_TEST_DB_URL` | `app/tests/test_d82_falla_campo.py` (6): ODN/dirección/FAT/descripción y 2 fotos, 422 si falta un dato o si hay 3 fotos, cuadrilla del reportante y RBAC intacto. `test_auth.py` (3 nuevas): palabras con la clave actual + auditoría + palabras anteriores invalidadas, cambio de clave y perfil propio. |
| Migración | `scripts/migrar_d82_falla_campo.py` (`--dsn`) | Simulación → aplicar → verificación → reejecución idempotente. |

---

## 9. Trazabilidad

| Requisito | Dónde |
|---|---|
| RF-11 (casos del técnico) | `casos_provider.dart`, `casos_screen.dart` |
| RF-14 (evidencias) | `evidencia_service.dart` (`TipoEvidencia.fallaMasiva`), `alertas_screen.dart` |
| RF-16 (falla masiva de campo) | `alertas_screen.dart`, `POST /fallas-masivas/reporte-campo` |
| RF-20 / RNF-01 | `usuario_screen.dart` (`/auth/cambio-clave`, `/auth/palabras/mostrar`) |
| RNF-06 (offline) | caché local de casos, perfil y cuadrilla; cola de acciones con las fotos |
| RNF-21/22 | rutas protegidas y contraseña actual exigida en cada operación sensible |

Documento del incremento: [`../../incremento_D82_apk_campo.md`](../../incremento_D82_apk_campo.md).
