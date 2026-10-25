# 11 — La APK del técnico: contenido local, progreso de sincronización, sección Usuario, falla masiva de campo (D-82), identificador de pago (D-93) y ZIP de jornada (D-156)

> Manual técnico de la aplicación **GGTO Técnico** (`app_movil/`, Flutter). El
> incremento **D-82** cubre cinco requisitos pedidos por el usuario:
> (1) que la APK muestre el **contenido local**; (2) una **barra con el progreso de
> la sincronización**; (3) un **menú de usuario** (icono de Usuario); (4) una
> **sección Usuario** con cambio de contraseña, palabras de seguridad (mostradas
> con la contraseña actual), datos personales y datos administrativos; y (5) el
> **reporte de falla masiva** con OLT · SLOT · PUERTO · FAT · dirección · ODN ·
> descripción y **máximo 2 fotos** de evidencia.
>
> El incremento **D-93** (versión `1.1.0+9`) lleva a la ficha de campo la
> separación **identificador de pago (70\*) / número de contacto** que el backend
> estrenó en D-89: se documenta en la sección 7 de este manual.

> **Alcance vigente:** este manual describe la APK de campo y su versión publicada
> actual es `1.15.20+45` (D-158, que corrigió la discrepancia de `AppConstants.version`;
> al cierre de **D-156** era `1.15.17+42`). El incremento D-156 añade el **ZIP de la
> jornada** (sección 3.6); el resto del documento conserva el detalle histórico de
> D-82 y D-93. No describe una APK multirol ya entregada. La V2 solicitada debe
> integrar TÉCNICO, SUPERVISOR, ADMIN, COORDINADOR y SUPER; a la fecha de corte no
> existen las pantallas ni la navegación de gestión en `app_movil/`. Ver
> [`../../auditoria_estado_real_v2.md`](../../auditoria_estado_real_v2.md).

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
| Actualización completa | `app_movil/lib/features/sync/actualizacion_datos_service.dart` | evidencias 2-40 % → cola 42-55 % → despacho 55-100 %. |
| DESCARGA | `app_movil/lib/features/sync/download_service.dart:36` | conectando 5 % → descargando 35 % → guardando en el dispositivo 70 % → 100 %. |
| CARGA | `app_movil/lib/features/sync/upload_service.dart:115` | 5 % apertura → fotos 10-60 % (`subirPendientes`, `:80`) → actividades 65 % → cierre de la jornada 90-100 %. |
| Cola offline | `sync_provider.dart:189` | acción por acción hasta vaciar la cola. |

### 3.3 El widget

`app_movil/lib/widgets/barra_progreso_sync.dart:15` — `BarraProgresoSync`:

- `compacta: true`: franja bajo la barra de título; se usa en **Casos**
  (`casos_screen.dart:74`), **Alertas** (`alertas_screen.dart:195`) y **Mensajes**
  (`mensajes_screen.dart:29`).
- `compacta: false`: tarjeta ancha en **Sincronizar** (`sync_screen.dart`), con
  el porcentaje a la derecha y el estado de conexión.

### 3.4 Un solo botón en SINCRONIZAR (D-115 · D-117)

`app_movil/lib/features/sync/actualizacion_datos_service.dart` — `ActualizacionDatosService.ejecutar()`
une los tres procesos en una sola acción, ejecutada **solo** desde la sección
**Sincronizar**:

1. **CARGA** (`UploadService.cargar`): sube las evidencias (`evidencia_local.subida = 0`)
   y las actividades por `/sync/carga`.
2. **Cola clásica** (`SyncProvider.sincronizar`): fallas masivas, citas y evidencias
   sueltas que el lote no cubre.
3. **DESCARGA** (`DownloadService.descargar`): trae el despacho del día y ejecuta
   `PurgaDespachos.ejecutar`, que borra los casos **no atendidos** de jornadas anteriores.

El botón **SINCRONIZAR** de `sync_screen.dart` es el único que toca la red. El
panel **Casos** solo lee el dispositivo (`CasosProvider.refrescarLocal`,
`MasivasProvider.refrescarLocal`, `SyncProvider.refrescar`) y su botón es
**Refrescar**. La purga se ejecuta cuando el servidor resolvió una cuadrilla de
campo (`PurgaDespachos.procede`); **nunca** borra un caso atendido (cerrado,
cancelado, enrutado, diferido o citado), uno con trabajo sin enviar (cola o foto
pendiente) ni uno del **despacho del día**.

### 3.5 Bloqueo por inactividad y PIN (D-117)

| Pieza | Detalle |
|---|---|
| `app_movil/lib/widgets/bloqueo_inactividad.dart` | Temporizador de **2 minutos** (`AppConstants.bloqueoInactividadMinutos`); se reinicia con cualquier toque y comprueba el tiempo al volver del segundo plano. Envuelve la app desde `MaterialApp.builder` (`main.dart`) y solo se arma con `AuthProvider.sesionActiva` (sesión abierta en esta ejecución, no el acceso). |
| `app_movil/lib/features/auth/lock_controller.dart` | `LockController`: `bloquear()`/`desbloquear()`; **no** toca `AuthProvider` ni cierra la sesión. |
| `app_movil/lib/features/auth/lock_screen.dart` | Pantalla de bloqueo: pide el PIN, muestra el nombre del técnico y, si el PIN es el de fábrica, obliga a cambiarlo antes de desbloquear. |
| `CredencialService.restablecerPin` | «Restablecer PIN» deja la credencial con el PIN de fábrica y `pinPorDefecto = true`; el primer uso pide cambiarlo. |

El PIN solo se usa para **abrir sin internet** y **desbloquear la pantalla**; no
se envía al servidor. El bloqueo aplica a la sesión **TÉCNICO**, que es la que
tiene credencial local.

### 3.6 ZIP de la jornada (D-156)

El apartado 4.3 de los requerimientos pide que, al finalizar la jornada, el
dispositivo genere un **ZIP con el despacho modificado y todas las evidencias**,
con el nombre `central + cuadrilla + fecha`. Se implementa **en la APK**, no en el
backend: el despacho local ya contiene los cambios del técnico y las fotos están
en el teléfono, así que el ZIP se puede generar sin red.

| Pieza | Detalle |
|---|---|
| `app_movil/lib/features/sync/zip_jornada_service.dart` | `ZipJornadaService.generar()` lee los casos y las evidencias locales, el perfil y la cuadrilla; `crear()` construye el archivo a partir de datos ya leídos y es la parte que prueban los tests. |
| Nombre | `ZipJornadaService.nombreArchivo` normaliza central, cuadrilla y fecha a `central_cuadrilla_AAAAMMDD.zip`. |
| Contenido | `despacho.csv` (una fila por caso con los campos operativos), `despacho.json` (registro local completo), `evidencias/` (fotos disponibles) y `LEEME.txt` (resumen y conteos). |
| Evidencias | Se incluyen las que existen en el dispositivo; las que no se encuentran se cuentan en `evidenciasFaltantes` y se informan, sin abortar el ZIP. Los nombres repetidos se renombran (`foto_2.jpg`). |
| Pantalla | `app_movil/lib/features/sync/sync_screen.dart`: tarjeta **ZIP de la jornada** con el botón `GENERAR Y COMPARTIR ZIP` (clave `zip-jornada`). |
| Compartición | `SharePlus.instance.share` con el archivo `application/zip`; el usuario elige correo, mensajería o almacenamiento. |
| Pruebas | `app_movil/test/d156_zip_jornada_test.dart` (**3**): nombre válido, contenido CSV/JSON/evidencias y no duplicación de nombres. La suite completa queda en **279 passed**. |

El ZIP se genera desde la sección **SINCRONIZAR** y no sustituye a la
sincronización: primero se cargan las acciones y las fotos al servidor; el ZIP es
el respaldo local que el técnico entrega al supervisor al cerrar la jornada.

---

## 4. Menú de usuario (requisito 3)

| Pieza | Detalle |
|---|---|
| `app_movil/lib/widgets/boton_usuario.dart:8` | `BotonUsuario`: `Icons.account_circle` que abre la ruta `/usuario`. |
| `app_movil/lib/main.dart:119` | Ruta protegida `/usuario` → `UsuarioScreen`, dentro del mismo guard `_RutaProtegida` que el resto de pantallas de campo. |
| Casos / Alertas / Sincronizar / Mensajes | El icono está en la barra superior de las cuatro pantallas. El **cierre de sesión** ya no es un candado suelto: vive dentro de la sección Usuario. |

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

| Campo | Validación en el cliente |
|---|---|
| **OLT\*** | Obligatoria (D-118). |
| **SLOT\*** | Obligatorio (D-118). |
| **PUERTO\*** | Obligatorio (D-118). |
| **ODN\*** | ≥ 3 caracteres. |
| **Dirección\*** | ≥ 5 caracteres. |
| **FAT\*** | Obligatoria. |
| **Descripción\*** | ≥ 5 (máximo 400 en el campo, 500 en el servidor). |
| Sector (opcional) | Numérico. |
| **Fotos de evidencia** | **Máximo 2** (`AppConstants.maxEvidenciasFallaMasiva`), cámara + GPS, ≤ 3 MB, miniatura con botón para quitarla. |

Flujo (`_reportarFalla`): 1) validación **previa** (no se sube ninguna foto
si faltan datos); 2) se suben las fotos del reporte con
`POST /evidencias/upload`; 3) se registra la falla en
`POST /fallas-masivas/reporte-campo`. **Sin conexión** la acción queda en la cola
con los seriales locales y las fotos en `evidencia_local`; la CARGA sube los
archivos y la cola envía la acción.

### 6.2 Endpoint de campo

`POST /api/v1/fallas-masivas/reporte-campo`:

- Cuerpo `FallaMasivaCampo`: `olt`, `slot`, `puerto`, `fat`, `direccion`, `odn` y
  `descripcion` obligatorios; `id_sector`/`id_cuadrilla` opcionales; `evidencias`
  con **máximo 2**.
- **D-118:** el servidor asocia automáticamente **todos los casos del mismo FAT**
  (OLT + slot + puerto + FAT). Si no hay ninguno, responde **422** y no registra
  la masiva: una masiva sin casos no se puede cerrar.
- **Cualquier usuario autenticado** puede usarlo (el TECNICO es quien detecta la
  concentración); el alta administrativa `POST /fallas-masivas` conserva su RBAC
  de ADMIN/SUPERVISOR.
- `origen` se fija a `REPORTE_TECNICO` y la cuadrilla se toma de la activa del
  reportante y, si no tiene, de la más cercana al sector.
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

## 7. El identificador de pago (70\*) en la APK — Incremento D-93

> Versión entregada: `1.1.0+9` (`app_movil/pubspec.yaml:5`, espejo en
> `app_movil/lib/core/constants.dart:15`, verificado por
> `test/version_visible_test.dart`). El incremento D-93 alinea la APK con el eje
> del sistema introducido en D-89: el caso se identifica por el **identificador de
> pago (70\*)** y el teléfono deja de ser «el número del cliente». Documento del
> incremento: [`../../incremento_D89_identificador_pago.md`](../../incremento_D89_identificador_pago.md).

### 7.1 La regla de los números

`app_movil/lib/features/casos/acciones_caso.dart`:

| Miembro | Línea | Qué hace |
|---|---|---|
| `patronIdentificadorPago` | `:74` | `RegExp(r'^70\d{8}$')` — el mismo valor por defecto del servidor (`configuracion.pago.serie_regex`, DEC-IP-1). La APK **no** lee la configuración del servidor: sirve para **rotular** el dato y avisar al técnico; la validación de negocio es responsabilidad del servidor. |
| `normalizarNumero()` | `:78` | RN-IP-07: quita separadores, el prefijo internacional (`0058`/`58`) y el `0` inicial. Réplica de `app/services/pagos.py:65`. |
| `esIdentificadorPago()` | `:96` | `patronIdentificadorPago.hasMatch(normalizarNumero(valor))`. |
| `errorNumeroContacto()` | `:104` | **Cualquier** número es un contacto válido: solo rechaza el texto que no tenga ningún dígito. |

**Retirados en D-93.** `seriesTelefono`, `normalizarTelefono` y `errorTelefono` ya
**no existen** en `app_movil/lib/` (verificado: cero coincidencias de esos
identificadores en todo el árbol). Las series 700/701/702 dejaron de ser una
restricción de la ficha; solo sobreviven como ejemplo en comentarios y pruebas.

### 7.2 La cabecera de la ficha

`app_movil/lib/widgets/ficha_caso.dart` — `FichaCabecera` recibe dos datos
distintos y los rotula por separado:

| Dato | Línea | Comportamiento |
|---|---|---|
| `identificadorPago` | `:32`, pintado en `:80` | «Identificador de pago (70\*): …», o «Sin identificador de pago (70\*)» si viene vacío (`:78-80`). Va en **solo lectura**: la cabecera **no** lo edita. |
| `contacto` | `:35`, pintado en `:95` | «Número de contacto: …», o «Sin número de contacto». |

La ficha de detalle alimenta ambos desde la caché local
(`app_movil/lib/features/casos/caso_detalle_screen.dart:100-101`: `telefono` →
identificador, `contacto_cliente` → contacto) y repite los rótulos en la sección
**Contacto** del cuerpo (`caso_detalle_screen.dart:124-125`). El icono de edición
lleva el tooltip «Editar dirección y contacto» (`ficha_caso.dart:109`).

### 7.3 El diálogo de edición

`app_movil/lib/features/casos/caso_detalle_screen.dart` — `_EditarContactoDialog`
(`:306`):

- edita **dirección** (`:351-356`, validador `errorDireccion`) y **número de
  contacto** (`:358-369`, validador `errorNumeroContacto`);
- el campo de contacto lleva el aviso: *«Cualquier número. Si escribe un 70\* se
  registra como identificador de pago del caso.»* (`:364-365`);
- solo envía lo que cambió (`:333-338`).

### 7.4 El envío al servidor

`app_movil/lib/features/casos/operaciones_service.dart::editarContacto`
(`:357`): arma el payload con las claves `direccion` y **`contacto`** (`:364-368`
— la clave que acepta `PATCH /api/v1/casos/{id}/contacto` desde D-93, ver el
manual 04) y llama a `PATCH /casos/{idCaso}/contacto` (`:376`). Detecta si el
valor era un 70\* (`:375`) y el mensaje de éxito lo distingue: «… se registró como
identificador de pago del caso.» frente a «Contacto actualizado en el caso.»
(`:387-389`). Sin red, la edición queda **encolada** como `CONTACTO_CAMPO`
(`:396-399`).

### 7.5 La tarjeta, la pantalla CONTACTAR y la búsqueda local

| Pieza | Ubicación | Rótulo |
|---|---|---|
| Tarjeta de la lista | `app_movil/lib/widgets/caso_card.dart` | «Contacto: …» a partir de `caso['contacto_cliente']`. **El teléfono que se muestra para contactar es el contacto, no el 70\*** (RN-AL-03): el identificador de pago queda en la ficha. |
| Pantalla CONTACTAR | `app_movil/lib/features/casos/contactar_screen.dart:24-26,176` | «Número de contacto: …» (o «Sin número de contacto»); el comentario deja claro que **el 70\* no se usa para contactar**, se llama al contacto. |
| Búsqueda local del dispositivo | `app_movil/lib/core/database.dart:237-245` | La aguja busca en `id_averia`, **`telefono`** (identificador de pago) y **`contacto_cliente`**, además de nombre y dirección. |
| Ficha de la APK (variante compacta) | `app_movil/lib/widgets/ficha_caso.dart` (misma clase) | Los dos rótulos, siempre juntos. |

La **descarga** de la APK incluye ahora `contacto_cliente` y `persona_reporta`
(`app/services/sync.py`, `_caso_sync`): sin ellos la ficha y la tarjeta no tenían
el número con el que se llama al cliente y solo quedaba el 70\*.

### 7.6 Pruebas de D-93

`app_movil/test/d93_identificador_pago_test.dart` cubre la normalización
(RN-IP-07), la detección del 70\*, la cabecera con el identificador en solo
lectura y el número de contacto, los rótulos de la ficha y —**RN-AL-03**— que la
tarjeta de la lista muestra el **contacto** y no el 70\*, y la ayuda del diálogo
de edición. La evidencia de regresión previa sigue en
`app_movil/test/d87_ficha_test.dart:107` y `app_movil/test/d88_flujo_campo_test.dart:86-102`.

---

## 8. Configuración y despliegue

| Elemento | Valor |
|---|---|
| Versión visible | `AppConstants.version` = `1.15.20+45` (`app_movil/pubspec.yaml:5`, `app_movil/lib/core/constants.dart:15`), verificada por `test/version_visible_test.dart`. (En D-82 la entrega era `1.0.0+3`; en D-93, `1.1.0+9`; en D-156, `1.15.17+42`.) |
| URL de la API | `AppConstants.baseUrl` (`--dart-define=GGTO_API_BASE=…`). |
| Firma | Keystore oficial `RepoTecnico/credenciales/ggto-tecnico-release.jks` + `app_movil/android/key.properties`; publicación con `python scripts/publicar_apk.py --confirmar` (valida el keystore y la firma con `apksigner`). |
| Entrega | `app_movil/GGTOv2.apk` con su SHA-256. |

---

## 9. Pruebas

| Nivel | Comando | Cobertura D-82 |
|---|---|---|
| Análisis | `flutter analyze` | Sin hallazgos. |
| Unitarias/widget | `flutter test` | **279 passed** en total. `test/d82_apk_test.dart` (12): validación del reporte de campo, barra de progreso (porcentaje y widget), icono de usuario → ruta `/usuario`, datos de la sección Usuario. **D-93:** `test/d93_identificador_pago_test.dart` (normalización RN-IP-07, detección del 70\*, cabecera en solo lectura, rótulos de ficha/tarjeta y aviso del diálogo). **D-156:** `test/d156_zip_jornada_test.dart` (3): nombre, contenido y evidencias del ZIP. |
| Integración backend | `pytest` con `GGTO_TEST_DB_URL` | `app/tests/test_d82_falla_campo.py` (6): ODN/dirección/FAT/descripción y 2 fotos, 422 si falta un dato o si hay 3 fotos, cuadrilla del reportante y RBAC intacto. `test_auth.py` (3 nuevas): palabras con la clave actual + auditoría + palabras anteriores invalidadas, cambio de clave y perfil propio. |
| Migración | `scripts/migrar_d82_falla_campo.py` (`--dsn`) | Simulación → aplicar → verificación → reejecución idempotente. |

---

## 10. Trazabilidad

| Requisito | Dónde |
|---|---|
| RF-11 (casos del técnico) | `casos_provider.dart`, `casos_screen.dart` |
| RF-14 (evidencias) | `evidencia_service.dart` (`TipoEvidencia.fallaMasiva`), `alertas_screen.dart` |
| RF-16 (falla masiva de campo) | `alertas_screen.dart`, `POST /fallas-masivas/reporte-campo` |
| RF-20 / RNF-01 | `usuario_screen.dart` (`/auth/cambio-clave`, `/auth/palabras/mostrar`) |
| RF-45/RF-46 (identificador de pago) · D-93 | `acciones_caso.dart` (`patronIdentificadorPago`, `normalizarNumero`, `esIdentificadorPago`), `ficha_caso.dart`, `caso_detalle_screen.dart`, `caso_card.dart`, `contactar_screen.dart`, `operaciones_service.dart::editarContacto` |
| DEC-IP-7 (un 70\* es identificador del caso) | `operaciones_service.dart:375-389` (aviso) + servidor `PATCH /casos/{id}/contacto` (manual 04) |
| RNF-06 (offline) | caché local de casos, perfil y cuadrilla; cola de acciones con las fotos |
| RNF-21/22 | rutas protegidas y contraseña actual exigida en cada operación sensible |
| ZIP de jornada (apartado 4.3) · D-156 | `zip_jornada_service.dart` (`generar`, `crear`, `nombreArchivo`), `sync_screen.dart` (`zip-jornada`), `test/d156_zip_jornada_test.dart` |

Documento del incremento: [`../../incremento_D82_apk_campo.md`](../../incremento_D82_apk_campo.md).
