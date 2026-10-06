# Incremento D-82 — APK: contenido local, progreso de sincronización, sección Usuario y reporte de Falla Masiva

| Campo | Valor |
|---|---|
| **Petición** | «Asegúrate que la APK: 1) muestre el contenido local; 2) muestre una barra con el progreso de la sincronización de los datos; 3) tenga un menú de usuario (icono de Usuario) para gestionar el perfil; 4) la sección Usuario permita cambiar la contraseña, ver las palabras de seguridad (se muestran con la contraseña actual), datos personales y datos administrativos (P00, Cuadrilla, etc.); 5) el reporte de Falla Masiva debe indicar la ODN, Dirección, FAT, Descripción y máximo 2 fotos de evidencia.» |
| **Fecha** | 2026-10-06 |
| **Alcance** | `app_movil/` (APK Flutter), `app/` (backend del reporte de campo) y ficha web de la falla |
| **Requisitos** | RF-11, RF-14, RF-16, RF-20 (palabras de seguridad), RNF-01 (autenticación), RNF-06 (offline), RNF-21/22 |
| **Versión de la APK** | `1.0.0+3` (`pubspec.yaml` y `AppConstants.version`) |

---

## 1. Requisito 1 — la APK muestra el contenido local

**Defecto corregido.** `CasosProvider.cargar()` llamaba a `DownloadService.descargar()`
—que escribe la caché SQLite— pero **nunca volvía a leer la base local**: tras una
descarga correcta, `_casos` seguía como estaba (vacío en el primer arranque) y la
pantalla mostraba «No tiene casos asignados» aunque el dispositivo tuviera los casos
guardados. El contenido local solo aparecía por el camino de error (`_servirCache`).

**Solución.** El **contenido local es la fuente de la lista**:

| Pieza | Cambio |
|---|---|
| `features/casos/casos_provider.dart` | `cargar()` intenta la DESCARGA y, **en cualquier caso** (`finally`), vuelca la caché con `_leerLocal()` (`DatabaseHelper.leerCasos`). Se añaden `locales`, `sincronizadoEn` y la marca `desdeCache` (solo si la descarga falló). |
| `features/casos/casos_screen.dart` | Al abrir la pantalla se pinta **primero** la caché (`cargarDesdeCache()`) y después se intenta actualizar. Franja permanente «Contenido local · N casos · actualizado el …» con botón *Actualizar/Reintentar*; en amarillo cuando no hay conexión. |
| `features/usuario/usuario_service.dart` | El perfil y la cuadrilla también se cachean en `app_meta` (`perfil_local`, `cuadrilla_local`), de modo que la sección Usuario abre con datos locales sin red. |

## 2. Requisito 2 — barra con el progreso de la sincronización

| Pieza | Cambio |
|---|---|
| `features/sync/sync_provider.dart` | Estado de progreso: `progreso` (0…1), `fase`, `progresoActivo`, `progresoPorcentaje`, `progresoEnReposo` y `resumenBarra`; métodos `iniciarProgreso`, `actualizarProgreso` y `terminarProgreso`. `sincronizar()` avanza **acción por acción** (`procesadas / total`). |
| `features/sync/download_service.dart` | `descargar({onProgreso})`: conectando (5 %) → descargando (35 %) → guardando en el dispositivo (70 %) → 100 %. |
| `features/sync/upload_service.dart` | `cargar({onProgreso})` y `subirPendientes({onProgreso, idCaso})`: las fotos ocupan del 10 % al 60 %, las actividades del 65 % al 90 % y el cierre de la jornada el 100 %. `subirEvidencia()` se extrae para reutilizarla en la falla masiva. |
| `widgets/barra_progreso_sync.dart` (nuevo) | Barra reutilizable en dos formatos: franja compacta bajo la barra de título (`compacta: true`) y tarjeta ancha (`compacta: false`). En reposo resume la cola: verde «Datos sincronizados», ámbar «N acciones pendientes de envío», rojo «N acciones con error». |
| `features/casos/casos_screen.dart`, `features/alertas/alertas_screen.dart`, `features/mensajes/mensajes_screen.dart` | Franja de progreso en la barra de título (`AppBar.bottom`). |
| `features/sync/sync_screen.dart` | Tarjeta de progreso ancha + DESCARGA/CARGA informando el avance real a la barra. |

## 3. Requisito 3 — menú de usuario (icono de Usuario)

- `widgets/boton_usuario.dart` (nuevo): icono `Icons.account_circle` que abre la ruta
  `/usuario`; se coloca en la barra superior de **Casos**, **Alertas**, **Dispositivo** y
  **Mensajes** (el cierre de sesión, antes un candado suelto, vive ahora dentro de la
  sección Usuario).
- `main.dart`: ruta protegida `/usuario` → `UsuarioScreen`, dentro del mismo guard
  `_RutaProtegida` que el resto de pantallas de campo.

## 4. Requisito 4 — sección Usuario

`features/usuario/usuario_screen.dart` (nuevo) + `features/usuario/usuario_service.dart` (nuevo).
Cuatro bloques desplegables y el cierre de sesión:

| Bloque | Contenido | Endpoint |
|---|---|---|
| **Datos personales** | Nombre, apellido, P00 y correo editable con «Guardar correo». | `GET /auth/me`, `PATCH /auth/me` |
| **Datos administrativos** | P00, rol, **cuadrilla activa** (código · nombre), desde cuándo, central, identificador del dispositivo y versión de la app. | `GET /auth/me`, `GET /sync/cuadrilla` |
| **Cambiar la contraseña** | Contraseña actual, nueva (mínimo 8) y confirmación; valida en el cliente y muestra el mensaje del servidor. | `POST /auth/cambio-clave` |
| **Palabras de seguridad** | Estado (cantidad y versión) y **«Ver palabras de seguridad»**: exige la **contraseña actual**, muestra las 12 palabras numeradas (seleccionables y copiables) y advierte de que las anteriores dejan de ser válidas. | `GET /auth/mi-seguridad`, `POST /auth/palabras/mostrar` |

> **Nota de seguridad:** las palabras solo se guardan como hashes Argon2id, así que
> «verlas» implica **regenerarlas** tras verificar la contraseña actual; el backend lo
> audita (`REGENERAR_PALABRAS_PROPIO`) y devuelve las nuevas. El aviso en pantalla es
> explícito para que el técnico las guarde.

## 5. Requisito 5 — reporte de Falla Masiva

### 5.1 APK (`features/alertas/alertas_screen.dart`)

Formulario con **ODN\***, **Dirección\***, **FAT\***, **Descripción\*** (400), sector
opcional y **hasta 2 fotos de evidencia**: cámara con GPS, compresión (`≤ 3 MB`),
miniatura con opción de quitarla y contador «N de 2». Validaciones en el cliente
(`OperacionesService.reportarFallaMasiva` → `valida: false`): ODN ≥ 3, dirección ≥ 5,
FAT obligatoria, descripción ≥ 5 y máximo 2 fotos.

Flujo: 1) las fotos del reporte se suben con `POST /evidencias/upload` (serial
determinista, por lo que un reintento no duplica); 2) se registra la falla en
`POST /fallas-masivas/reporte-campo`. **Sin conexión** el reporte queda en la cola
offline con sus seriales y las fotos en `evidencia_local`; la CARGA sube los archivos y
la cola envía la acción.

### 5.2 Backend

| Pieza | Cambio |
|---|---|
| `app/api/routes_alertas.py` | Nuevo `POST /api/v1/fallas-masivas/reporte-campo` (`FallaMasivaCampo`), accesible a **cualquier usuario autenticado** (el TECNICO es quien reporta): exige ODN, dirección, FAT y descripción, admite **máximo 2 evidencias** y fija `origen="REPORTE_TECNICO"`. La cuadrilla se toma de la activa del reportante y, si no tiene, de la más cercana al sector. `POST /fallas-masivas` (ADMIN/SUPERVISOR) admite los mismos campos como opcionales; su RBAC no cambia. |
| `app/models/despacho_entities.py` | `falla_masiva` gana `odn varchar(60)`, `direccion varchar(200)`, `fat varchar(60)` y `evidencias text` (seriales separados por coma). |
| `app/schemas/alertas.py` | `FallaMasivaOut` expone `odn`, `direccion`, `fat` y `evidencias: list[str]` (validador que tolera `NULL`); `FallaMasivaManual` y `FallaMasivaCampo` los reciben. |
| `RepoTecnico/db/schema.sql` | Las 4 columnas nuevas en el DDL y el CHECK `evidencia_tipo_check` ampliado con `FALLA_MASIVA`. |
| `scripts/migrar_d82_falla_campo.py` (nuevo) | Migración **idempotente** (simulación por defecto, `--aplicar`, `--si`, `--dsn`, verificación post-migración, log en `BaseOperaciones/migracion_d82.log`). Añade las 4 columnas **y** recrea el CHECK de `evidencia.tipo` con `FALLA_MASIVA`. **Aplicada en producción el 2026-10-06.** |
| `app/api/routes_sync.py` | `TIPOS_EVIDENCIA` y validación previa en `POST /evidencias/upload`: un tipo fuera del CHECK devuelve **422** con la lista de tipos válidos (antes: 500 de la base). |
| Ficha web `FichaFalla.tsx` + `types.ts` | El supervisor ve **ODN · FAT · Dirección (reporte) · Dirección (corta)** y los seriales de las **evidencias**. |

## 6. Verificación

| Prueba | Resultado |
|---|---|
| `flutter analyze` | Sin hallazgos (12,3 s). |
| `flutter test` | **20/20**: `version_visible_test` (2), `contrato_campo_test` (6) y **`d82_apk_test` (12)** — validación del reporte de campo, progreso de la barra, icono de usuario y datos de la sección Usuario. |
| `pytest` (esquema aislado `ggto_test`, PostgreSQL 18 temporal) | **290/290** en 3:04, incluidas `app/tests/test_d82_falla_campo.py` (**8** pruebas: el TECNICO reporta con ODN/dirección/FAT/2 fotos, 422 si falta un dato o si hay 3 fotos, reporte sin fotos, cuadrilla del reportante, matriz RBAC de `POST /fallas-masivas` intacta, **subida de evidencia `FALLA_MASIVA` aceptada** y **422 para un tipo desconocido**) y 3 pruebas nuevas en `test_auth.py` para la sección Usuario (ver las palabras con la clave actual + auditoría + palabras anteriores invalidadas, cambio de clave y perfil propio). |
| `ruff` / `mypy` | Sin hallazgos (`All checks passed!` · 84 archivos). |
| `tsc` + `vite build` | En verde (bundle final `index-Mz7FhF5A.js`, 84 módulos). |
| `scripts/migrar_d82_falla_campo.py` | Probado de extremo a extremo en una base desechable y **aplicado en producción**: simulación (0 cambios) → `--aplicar --si` (añade `odn`, `direccion`, `fat`, `evidencias` y el CHECK con `FALLA_MASIVA`, y **verifica** los 5) → reejecución (detecta «ya migrada»). |
| **Prueba de escritura en vivo** (producción, con limpieza) | 2 fotos subidas → **200**; reporte de campo → **201** con `origen=REPORTE_TECNICO`, ODN, dirección, FAT y los 2 seriales; ficha → **200** con los mismos datos; limpieza: 1 falla + 2 evidencias + 1 notificación borradas y `falla_masiva` de vuelta a **4 filas**. `tipo=INVENTADO` → **422**. |
| `flutter build apk --release` (keystore oficial) | **`app_movil/GGTOv2.apk`** (23.829.845 bytes) · SHA-256 `bd4badd036dc71c1ab913061cce8b830cc6a08786aff70962221e185a2c921ea` · firmada con `CN=GGTO Tecnico, OU=Proyecto GGTO, O=Ing. Angel H. Lucci, L=Caracas, ST=Miranda, C=VE` (verificada con `apksigner`). Los marcadores `reporte-campo`, `1.0.0+3`, `FALLA_MASIVA`, `Contenido local`, `Palabras de seguridad`, `Datos administrativos`, `ODN` y `Cuadrilla` están dentro de `libapp.so`/`classes.dex`. |

## 7. Trazabilidad

| Requisito | Dónde |
|---|---|
| RF-11 (casos del técnico) | `casos_provider.dart`, `casos_screen.dart` |
| RF-14 (evidencias) | `evidencia_service.dart` (`TipoEvidencia.fallaMasiva`), `alertas_screen.dart` |
| RF-16 (falla masiva de campo) | `alertas_screen.dart`, `POST /fallas-masivas/reporte-campo` |
| RF-20 / RNF-01 | `usuario_screen.dart` (`/auth/cambio-clave`, `/auth/palabras/mostrar`) |
| RNF-06 (offline) | caché local de casos, perfil y cuadrilla; cola de acciones con las fotos |
| RNF-21/22 | rutas protegidas y contraseña actual exigida en cada operación sensible |

## 8. Despliegue y verificación en producción (2026-10-06)

| Paso | Resultado |
|---|---|
| **Migración D-82 en producción** | Túnel `cloud-sql-proxy` (v2.15.2, `--gcloud-auth`) → `truekeate-main:southamerica-east1:truekeate-db-dev`, base `ggtov2`. Simulación → `--aplicar --si` → **verificado**: `falla_masiva` pasa de 14 a **18 columnas** (`odn`, `direccion`, `fat`, `evidencias`), 4 filas intactas. En la segunda pasada (tras la prueba de escritura) se recreó además el CHECK `evidencia_tipo_check` con `FALLA_MASIVA`. Reejecución: «ya migrada». |
| **APK firmada** | `python scripts/publicar_apk.py --confirmar`: detecta el keystore, valida con `keytool`, compila, **verifica la firma con `apksigner`** y publica `app_movil/GGTOv2.apk` (22,7 MB, `1.0.0+3`). |
| **Imágenes** | `gcloud builds submit app --tag …/ggto-web:v18` (1M56S) y, tras las correcciones de la verificación, **`v19`** (1M34S). Se descartaron la `v16` (cancelada) y la `v17` (manuales mal codificados, ver §9). |
| **Servicio** | `gcloud run deploy ggto-web` con el mismo entorno, secretos, cuenta de servicio y escalado: revisión **`ggto-web-00033-tcn`** (v18) y, finalmente, **`ggto-web-00034-7h2`** (v19) con el **100 %** del tráfico. |
| **Defecto de producción A (fotos del reporte)** | La **prueba de escritura** reveló que `POST /evidencias/upload` con `tipo=FALLA_MASIVA` respondía **500**: `evidencia_tipo_check` solo admitía `POTENCIA/NAVEGACION/DEMO`. Corregido en `RepoTecnico/db/schema.sql`, en `scripts/migrar_d82_falla_campo.py` (recrea el CHECK) y **aplicado en producción**; además el endpoint valida el tipo y devuelve **422** con la lista de válidos en lugar de un 500. |
| **Defecto de producción B (mensajería, D-81)** | Los logs de Cloud Run mostraron **20 errores** `relation "mensaje_destino" does not exist`: la migración del **incremento D-81 nunca se aplicó al esquema `public`** (sus tablas solo existían en los esquemas de prueba `ggto_test`/`ggto_e2e`), así que los endpoints de mensajería y del panel respondían 500. Se aplicó `scripts/migrar_d81_sync_mensajeria.py --aplicar --si` sobre `public`: `sync_log` (+3 columnas), `sync_check`, `mensaje`, `mensaje_destino`, `cita.recordatorio_para` y **7 parámetros** de configuración verificados; `public` pasa de 37 a **40 tablas** y `GET /mensajes`, `/mensajes/no-leidos`, `/sincronizaciones`, `/sincronizaciones/resumen` y `/panel/gestion-diaria` responden **200**. |
| **Verificación en vivo (revisión 34)** | `/health`, `/ready` (`PostgreSQL 15.18`, **40 tablas**), `/`, `/manual/`, el **manual nuevo en HTML y PDF** y el **index de AYUDA** responden **200**; el manual servido es UTF-8 sin BOM y con acentos correctos; el bundle de la SPA contiene las entradas de AYUDA (manuales 10 y 11) y la ficha enriquecida («Dirección (reporte)», «Evidencias», «ODN»); el contrato declara `/api/v1/fallas-masivas/reporte-campo` (**401** sin token); con sesión de Super Usuario, `GET /fallas-masivas` devuelve las 4 fallas **con `odn`, `direccion`, `fat` y `evidencias`**, `GET /auth/mi-seguridad` responde `tiene_palabras=true`, un tipo de evidencia inventado da **422** y **la prueba de escritura completa quedó en verde con la base limpia**. Scripts (fuera del repositorio, sin escrituras salvo el propio reporte de prueba ya eliminado): `C:\GGTO\pgtmp\verificar_d82_produccion.py`, `verificar_mensajeria.py`, `verificar_tipo_invalido.py`, `prueba_d82_escritura.py`. |

## 9. Manuales y lecciones del proceso

- **Manuales nuevos:** técnico `RepoTecnico/Manuales/03-Implementacion/11-apk-tecnico-campo.md` y
  literal `docs/Manuales/03-Implementacion/11-apk-tecnico-campo.md` (25 manuales en la colección),
  con HTML (`docs/Manuales/html/…`) y PDF (7 páginas) generados con `generar.py` y `exportar_pdf.mjs`.
- **Índice de AYUDA:** `app/web/src/pages/Ayuda.tsx` gana las entradas del manual **11** (D-82) y
  también del **10** (D-81), que **faltaba** desde el incremento anterior.
- **Defecto de herramienta detectado y corregido:** la sincronización de manuales hecha con
  PowerShell 5.1 (`Get-Content`/`Set-Content`) **corrompió todos los HTML** (leía UTF-8 como cp1252 y
  reescribía con BOM); la `v17` llegó a producción con los acentos rotos. Se sustituyó por
  `docs/Manuales/_build/sincronizar_manual.py`, que además **verifica** referencias locales, ausencia
  de BOM y ausencia de dobles codificaciones (el `.sh` se mantiene para Linux).
- **Otras mejoras de herramienta:** `scripts/publicar_apk.py` imprime con respaldo ASCII (antes
  terminaba con `UnicodeEncodeError` en consola cp1252) y se añadió `app/.gcloudignore` (evita subir
  `web/node_modules` y `web/dist` a Cloud Build, ~150 MB).
- **Lección:** cuando un artefacto se genera en el pipeline (manuales, bundles), la verificación debe
  incluir la **codificación** del contenido servido, no solo el código HTTP.
- **Lección (segunda):** la verificación en vivo **con escritura** (aunque sea mínima y con limpieza)
  es la que descubre los defectos reales: los dos fallos de producción de este incremento (el CHECK de
  `evidencia.tipo` y la migración de D-81 sin aplicar en `public`) eran invisibles a las pruebas
  locales y a las comprobaciones de contrato, y ambos dejaban la funcionalidad inservible para el
  técnico (fotos del reporte) o para el supervisor (mensajería).

## 10. Pendientes

1. **Distribuir la APK `1.0.0+3`** a los técnicos (entrega a CANTV / canal de instalación).
2. **Almacenamiento de evidencias en GCS:** hoy las fotos caen al **fallback local efímero** del
   contenedor (`/srv/.evidencias`); configurar `GGTO_GCS_BUCKET` para que las evidencias persistan y
   sean auditables (pendiente heredado de D-73).
3. **Publicar el incremento en GitHub/GitLab** (commit y push).
4. **Pendientes externos heredados:** restringir el acceso público de `ggto-web` (contiene PII real),
   respaldos/PITR y firma del contrato de interfaz con CANTV.
