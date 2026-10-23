# INFORME DE OPTIMIZACIÓN V2 — Auditoría integral de GGTO (proyecto y APK)

| | |
|---|---|
| **Proyecto** | GGTO — Gestión de Órdenes de Trabajo y Despacho (CANTV, Central Francisco Salias / Área 4) |
| **Alcance** | **Todo el proyecto y su APK**: backend FastAPI, SPA web, APK Flutter, esquema PostgreSQL, scripts de despliegue, documentación (`RepoTecnico/`, `docs/`, `Manuales/`) y estado real de producción |
| **Fecha** | **2026-10-19** |
| **Autor** | **Equipo de Auditoría — 7 lentes + verificación adversarial** |
| **Versión del informe** | **V2** |
| **Commit auditado** | `7c10086` |
| **Método** | 3 fases: 7 revisores en paralelo → 7 verificadores adversariales → síntesis |
| **Naturaleza** | Auditoría de solo lectura, con verificación en vivo de solo lectura (`gcloud … describe/list`, `GET` a producción). Solo el sintetizador escribió este archivo |

> **Aviso de lectura.** Este informe sustituye y amplía `INFORME_OPTIMIZACION_V1.md` (que auditó documentación de Fase 1) y `INFORME_OPTIMIZACION_D95_V1.md` (que auditó el incremento D-95). Aquí se audita el proyecto completo en su estado de 2026-10-19. Cuando la verificación desmintió un dato de partida, se señala expresamente y se conserva el hecho verificado; cuando algo no pudo comprobarse, se marca **«necesita verificación»**.
>
> **Corrección importante respecto al dato de partida.** El resumen de métricas de la auditoría describía producción «sin backups automáticos». Tres dimensiones (R5, R6 y R7) verificaron en vivo, el 2026-10-19, lo contrario: `truekeate-db-dev` tiene `backupConfiguration.enabled=true`, `pointInTimeRecoveryEnabled=true`, `retainedBackups=30` y 7 días de transaction logs. Lo que **sí** sigue abierto es `deletionProtectionEnabled=false`, `sslMode=ALLOW_UNENCRYPTED_AND_ENCRYPTED`, la ausencia de prueba de restauración y una documentación que afirma lo contrario de la realidad. Este informe refleja el hecho verificado (ver H-01 y H-29).

> **Nota de línea base (detectada al cierre).** La auditoría se ejecutó sobre el commit `7c10086` (2026-10-19). Durante su ejecución apareció en el árbol de trabajo un conjunto de cambios **sin versionar** de un incremento **D-114** —especiales separados por concepto y masivas por sector— que **no forma parte de esta auditoría ni de su alcance**. No se modificó ni se revirtió: se dejó intacto. Las referencias de línea de los archivos que ese cambio toca (`app/services/despacho.py`, `app/schemas/despacho.py`, `app/api/routes_despachos.py`, `app/web/src/api/types.ts`, `ProcesarDespacho.tsx`, `styles.css`) pueden estar desplazadas respecto al commit auditado; el contenido de los hallazgos se sostiene sobre el código del commit y sobre las comprobaciones en vivo. **Revalidar este informe tras integrar D-114.**

---

## 1. Resumen ejecutivo y veredicto

**VEREDICTO: NO APTO para producción en su estado actual.** Es **apto con condiciones** únicamente después de cerrar los cinco hallazgos CRÍTICOS y los ALTOS de seguridad y de operación que se detallan abajo.

La ejecución técnica del proyecto es sólida y verificable: `pytest` 411/411 sobre PostgreSQL 18 (`ggto_test`), `flutter test` 194/194, `flutter analyze` sin hallazgos, `tsc` + `vite build` en verde, 42 tablas en `db/schema.sql`, 101 archivos Python, 73 de la web y 87 Dart. La arquitectura está documentada con un nivel poco habitual (diccionario de datos, ER, DDL, manuales por área) y el código tiene pruebas reales para buena parte del flujo. **Nada de eso compensa, sin embargo, que el sistema esté tratando PII real de abonados en un servicio público, con canales externos abiertos, secretos comprometidos y sin una sola puerta automática de calidad.**

**Razones principales del veredicto:**

1. **Datos personales reales en un servicio invocable por cualquiera.** Producción contiene casos de abonados (nombre, teléfono, dirección, serial) cargados el 2026-09-27, el servicio Cloud Run está abierto a `allUsers`, `/docs`, `/openapi.json` y `/ready` son públicos, y no consta base legal, aviso de privacidad, DPA ni responsable de protección de datos designado. La retención declarada no se ejecuta (H-01, H-25).
2. **Superficie anónima con PII y toma de cuentas.** El webhook de Telegram y el servidor MCP son *fail-open* (clave vacía = sin autenticación) y en producción responden 200 sin credencial, devolviendo nombre, teléfono y dirección; en paralelo, `/auth/unlock` y `/auth/reset-password` no tienen límite, bloqueo ni auditoría y permiten tomar cualquier cuenta, incluida SUPER (H-02, H-04).
3. **Secretos comprometidos.** La contraseña del keystore de firma está versionada y se descarga sin autenticación desde el repositorio público, y `GET /configuracion` entrega `telegram.webhook_secret` y `mcp.api_key` a cualquier rol autenticado (H-03).
4. **Pérdida silenciosa de evidencia y permisos no aplicados.** Las fotos de cierre se escriben en el disco efímero del contenedor y su URL devuelve 200 con el HTML de la SPA; el TÉCNICO no está acotado a su cuadrilla y ninguna suite ejerce la RLS (H-05, H-07).
5. **La calidad declarada no es reproducible.** No existe `.github/` ni CI aunque seis manuales lo citan con líneas exactas, la cobertura del 70 % no se mide, los conteos de pruebas se contradicen y los criterios de aceptación clave (SLO de rendimiento, usabilidad, RNF-21, prueba de campo) no tienen medición ni oráculo (H-17, H-16, H-22, H-21, H-07).

**Lo que sí acredita el proyecto:** corrección funcional de los flujos cubiertos por sus 411 pruebas de API y 194 de APK, una APK ya multirol en 1.12.0+21 con 14 módulos de features, y documentación de ingeniería aprovechable. **Lo que no acredita:** que sus propios criterios de aceptación sean verificables, que el aislamiento entre centrales/cuadrillas exista de hecho, ni que la operación con PII sea legal y recuperable.

**Condiciones para pasar a V3 (resumen):** cerrar H-01…H-05 y H-06, H-07, H-08, H-09, H-10, H-11; restaurar el CI real con puerta de calidad y cobertura; demostrar RBAC y RLS con pruebas negativas; ejecutar una restauración y una prueba de carga registradas; y reconciliar la documentación con la realidad. Los criterios medibles están en §8.

---

## 2. Metodología

La auditoría se ejecutó en **tres fases** con separación estricta de roles. Ningún revisor ni verificador modificó archivos; solo el sintetizador (este informe) escribe.

### Fase 1 — Revisar (7 revisores en paralelo)

| # | Lente | Qué buscó |
|---|---|---|
| R1 | **Ambigüedad y testabilidad** | Términos vagos y criterios no medibles ni verificables en código o pruebas |
| R2 | **Consistencia** | Contradicciones docs ↔ código ↔ DDL ↔ APK, versiones, estados, conteos |
| R3 | **Completitud RNF (ISO 25010)** | Categorías ausentes: fiabilidad, observabilidad, rendimiento, seguridad, mantenibilidad, portabilidad, backup, monitoreo, cumplimiento |
| R4 | **Stakeholders** | Actores ausentes o sin rol: suscriptor, custodio de secretos, DBA/SRE, seguridad, soporte, auditoría, regulador |
| R5 | **Trazabilidad con el brief** | Deseos del cliente perdidos y requisitos inventados sin base en el brief |
| R6 | **Riesgos técnicos** | Puntos únicos de fallo, idempotencia, concurrencia, trabajos programados, respaldo, capacidad |
| R7 | **Seguridad y legal** | Autenticación, autorización, PII, XSS, secretos, cadena de suministro, base legal |

Cada revisor entregó como máximo 12 hallazgos con `ruta:línea`, impacto y recomendación. **Total recibido: 84 hallazgos (12 × 7).**

### Fase 2 — Verificar (7 verificadores adversariales, uno por lente)

Cada verificador recibió **solo** los hallazgos de su dimensión y los contrastó contra el árbol real (lectura de archivos, `grep`, `git`, consultas de solo lectura a `gcloud` y `GET` a producción). Su mandato fue: **filtrar falsos positivos, deduplicar, ajustar severidades con justificación y, ante la duda, descartar**. Los descartes no se arrastran al informe: se documentan con su motivo en el Anexo (§9).

| Dimensión | Recibidos | Descartados (Anexo) | Fusionados / reformulados | Supervivientes |
|---|---:|---:|---:|---:|
| R1 Ambigüedad y testabilidad | 12 | 2 | 1 reformulado + 2 fusionados | 10 |
| R2 Consistencia | 12 | 2 | 3 ajustados (2 con corrección de evidencia) | 10 |
| R3 Completitud RNF | 12 | 2 | 1 ajuste de severidad (conexiones ALTA→MEDIA) | 10 |
| R4 Stakeholders | 12 | 1 | 1 fusionado (los dos hallazgos de secretos) | 10 |
| R5 Trazabilidad | 12 | 2 | 4 citas corregidas | 10 |
| R6 Riesgos técnicos | 12 | 2 (1 deduplicado + 1 sub-afirmación) | 3 sub-afirmaciones retiradas | 10 |
| R7 Seguridad y legal | 12 | 2 | 4 sub-afirmaciones corregidas | 10 |
| **Total** | **84** | **13** (+1 fusionado en R4) | — | **70** |

**Ajustes de severidad aplicados en verificación:** la cabecera de `estado_proyecto.md` bajó de CRÍTICA a ALTA (es gobierno documental, no fallo de producción); el manual de Cloud Run bajó a BAJA/MEDIA (él mismo advierte que no es lectura en vivo); el desfase 41/42/43 tablas se mantuvo MEDIA; el estado PENDIENTE subió de MEDIA a ALTA (un caso re-despachado llega a la APK sin acción posible); el presupuesto de conexiones bajó de ALTA a MEDIA; el respaldo bajó de ALTA a MEDIA al comprobarse que los backups **sí** están activos; el supervisor de cuadrilla bajó a BAJA; la validación del CRASS bajó a MEDIA; y la auto-actualización y la línea base quedaron en MEDIA.

### Fase 3 — Sintetizar (este informe)

Consolidación cruzada de los **70 hallazgos supervivientes** en **46 hallazgos únicos** con IDs `H-01`…`H-46`, deduplicando entre dimensiones (un mismo defecto reportado por 2–4 lentes se conserva una sola vez, con la evidencia de todas) y ordenando por severidad y luego por impacto. La columna «Origen» de cada tabla permite rastrear qué lentes lo sostuvieron.

**Regla de evidencia:** toda afirmación se ancla a `ruta:línea` del árbol o a una comprobación en vivo reproducible. Lo que no se pudo comprobar se marca **«necesita verificación»**. No se añadió ningún hallazgo que no estuviera en los informes verificados.

**Regla de descarte:** ante la duda, el hallazgo no pasa. Por eso el informe no contiene, por ejemplo, el «bucle de reenvío cada minuto» (la APK solo envía el lote al pulsar CARGA), ni la «duplicación del histórico de estados» (el servidor no reescribe un estado idéntico), ni la premisa de que el manual de Cloud Run presente el dato como verificado (el propio manual advierte lo contrario).

---

## 3. Estado de calidad del proyecto (métricas reales y límites)

### 3.1 Métricas medidas el 2026-10-19

| Métrica | Resultado | Evaluación |
|---|---|---|
| `pytest` | **411/411** en verde (PostgreSQL 18, base `ggto_test`) | Correcto |
| `flutter test` | **194/194** en verde | Correcto |
| `flutter analyze` | **Sin hallazgos** | Correcto |
| `tsc` + `vite build` | **En verde** | Correcto |
| `ruff check app` | **6 errores preexistentes** (E501 ×5, I001 ×1) | Incumple el criterio de salida «sin hallazgos» |
| `mypy` | **1 error preexistente** (fixture de pruebas, `app/tests/test_sync_api.py:86`) | Incumple el criterio de salida |
| Tamaño del código | **101** archivos Python · **73** de la web · **87** Dart | — |
| Esquema | **42** `CREATE TABLE` en `db/schema.sql` | Contrastado |
| E2E Playwright | **27** specs (R1 y R2 citan 26; el árbol tiene 27) | Sin ejecutar en esta auditoría |
| CI | **No existe `.github/` ni workflow propio** (`Test-Path .github` → `False`) | Brecha estructural |
| Producción | Cloud Run **público** (`allUsers` → `roles/run.invoker`), revisión `ggto-web-00060-lrm`, PII real | Riesgo confirmado |
| Cloud SQL (en vivo) | `truekeate-db-dev`: **backups y PITR activos**, 30 backups, 7 días de logs; **`deletionProtectionEnabled=false`**, `sslMode=ALLOW_UNENCRYPTED_AND_ENCRYPTED` | Corrige el dato de partida |
| Cloud Scheduler | **API deshabilitada**; la revisión no define `MANTENIMIENTO_TOKEN` | Los 4 jobs de D-81 no existen |

### 3.2 Qué no se pudo medir

- **Cobertura de código:** no hay `pytest-cov` en `app/requirements-dev.txt` ni configuración de cobertura en `pyproject.toml`/`pytest.ini`. El umbral del 70 % de RNF-24 no se mide en ninguna parte.
- **Rendimiento:** no hay latencia, throughput ni concurrencia medidas. Los SLO de RNF-08/RNF-15/RNF-34 (p95 de ingesta, PANEL y despacho, 30 concurrentes) siguen sin verificar y los archivos de prueba de carga que la documentación cita no existen.
- **Restauración:** no se ejecutó ninguna restauración ni PITR de prueba; el RTO ≤ 4 h de RNF-16 **necesita verificación**.
- **Capacidad de la instancia:** el `max_connections` real de `truekeate-db-dev` no es legible desde el repositorio y **necesita verificación** con `gcloud sql instances describe/flags`.
- **Producción vs DDL:** `/ready` informa 43 tablas frente a 42 del esquema versionado; la conciliación **necesita verificación** contra la base.
- **PII real:** consta en la documentación (`estado_proyecto.md:151`) y en los manuales; no se consultó la base ni se invocó `consultar_caso` (decisión deliberada para no recuperar PII).
- **Firma del APK publicado y valor de los secretos:** **necesita verificación**; no se descargó ni analizó el binario.
- **Pruebas en dispositivo físico:** pendientes por declaración del propio proyecto (cámara, GPS y PIN reales).
- **Specs E2E:** no se ejecutaron en esta auditoría; se auditó su contenido.

---

## 4. Hallazgos por severidad

**Leyenda de esfuerzo:** **S** ≤ 3 días-persona · **M** 4–15 días-persona · **L** > 15 días-persona o requiere migración/terceros.

### 4.1 CRÍTICA (5)

| ID | Origen | Área | Título | Evidencia | Esf. |
|---|---|---|---|---|---|
| H-01 | R3·R4·R7 | Legal / privacidad (PII) | PII real de suscriptores en un servicio público, sin base legal, aviso al titular ni retención efectiva | `estado_proyecto.md:12-13,151`; `Manuales/07-Operacion/02-seguridad-y-privacidad.md:336,341-346,362-367,371-384`; `disclaimer.md:13-16`; `gcloud` → `allUsers/run.invoker`; `GGTOv2_GCP.md:344-348` | M |
| H-02 | R4·R7 | Seguridad backend / canales externos | MCP y webhook de Telegram responden sin autenticación en producción (fail-open) y exponen PII | `app/api/routes_alertas.py:686-691,716,770-777,806-808`; `db/schema.sql:938-939`; `Manuales/03-Implementacion/09-api-endpoints.md:451-452,665-667`; en vivo: `POST /mcp` y `/telegram/webhook` → 200 sin credencial | S |
| H-03 | R4·R6·R7 | Secretos / cadena de suministro | Contraseña del keystore pública y claves de canal legibles por cualquier rol autenticado | `app_movil/android/key.properties.bak:7-10`; `key.properties.temporal-debug:7-10`; `git ls-files` → 2 archivos; `raw.githubusercontent.com/.../key.properties.bak` → 200; `app/api/routes_config.py:302-314,750-752`; `schemas/config.py:321-326` | M |
| H-04 | R7 | Autenticación / recuperación de cuenta | `/auth/unlock` y `/auth/reset-password` sin límite, bloqueo ni auditoría: toma de cualquier cuenta, incluida SUPER | `app/api/routes_auth.py:44-58,73-85,256,361-396`; `app/schemas/auth.py:35-43`; `app/core/words.py:8-22`; `app/core/security.py:67` | S |
| H-05 | R6·R7 | Backend / almacenamiento de evidencias | Las fotos de campo se guardan en disco efímero y su URL devuelve 200 con el HTML de la SPA | `app/services/storage.py:22-25,63-84`; `app/api/routes_sync.py:90-155`; `app/main.py:105-119`; `app/Dockerfile:19`; en vivo: `/evidencias-locales/x.jpg` → 200 `text/html` | M |

### 4.2 ALTA (19)

| ID | Origen | Área | Título | Evidencia | Esf. |
|---|---|---|---|---|---|
| H-06 | R7 | Web / XSS | XSS almacenado en las fichas imprimibles (HTML sin escapar + `document.write`) con robo del JWT | `app/api/routes_despachos.py:540-583`; `app/web/src/pages/Despacho.tsx:683-691`; `app/web/src/api/client.ts:139,200`; `app/api/routes_casos.py:63,790-796` | M |
| H-07 | R1·R4·R7 | RBAC / aislamiento por central y cuadrilla | Aislamiento incompleto y no probado: TÉCNICO sin acotado, RLS nunca ejercida, bandeja sin filtro y destinatario libre | `app/api/routes_casos.py:225-226,473-475,638-643`; `app/services/sync.py:582-603`; `db/schema.sql:786-811`; `app/tests/` → 0 `set_config`; `routes_alertas.py:617-635`; `routes_despachos.py:703-741` | M |
| H-08 | R7 | Ciclo de vida de la cuenta | El primer acceso no verifica identidad: enumera P00 y nombres y permite preregistrar cuentas ajenas | `app/api/routes_auth.py:136-223,250-303,364-365`; `app/schemas/auth.py:57-63,72-80` | S |
| H-09 | R5·R7 | APK / acceso sin conexión | PIN de fábrica universal `824605`, base SQLite con PII sujeta a backup, paquete `com.example` y FileProvider sobre todo el caché | `app_movil/lib/core/constants.dart:27`; `credencial_service.dart:216-223`; `core/database.dart:22-45`; `AndroidManifest.xml:29-32`; `file_paths.xml:3-4`; `build.gradle:38,58` | M |
| H-10 | R5 | Autorización / alcance | Roles no definidos por el cliente y SUPER con acceso total, sin acotado por central y sin MFA | `app/api/deps.py:20,52-53,76`; `requerimientos.md:19,56,261-264`; `estado_proyecto.md:144`; `grep MFA/TOTP` → 0 | M |
| H-11 | R5·R6 | Operación / trabajos programados | Nada se ejecuta de forma programada y nada sale por los canales externos: purga, cierres, recordatorios y alertas nunca corren | `app/api/routes_mantenimiento.py:25-64`; `app/core/config.py:43`; `scripts/11_desplegar_ggto_web.sh:85-86`; `app/services/outbox.py:51-104`; `services/notificaciones.py:20-42`; `gcloud scheduler` → API deshabilitada | S |
| H-12 | R3·R6 | Infraestructura / capacidad | Instancia zonal `db-f1-micro` compartida, en otra región que el servicio, sin SSL exigido y hasta 100 conexiones de cliente | `scripts/11_desplegar_ggto_web.sh:21,26,81-82`; `app/core/db.py:26-39`; `app/web/src/components/Layout.tsx:134`; `Manuales/07-Operacion/01-operacion-y-mantenimiento.md:287-290,307-309` | L |
| H-13 | R6 | APK / cola de sincronización | La carga por lotes no es idempotente: el servidor ignora `id_actividad_local` y el reintento duplica actividades | `app/schemas/sync.py:123`; `app/services/sync.py:606-638,667,688-694`; `db/schema.sql:545-562`; `upload_service.dart:171,198,211,247-265`; `core/database.dart:461-498` | M |
| H-14 | R6 | APK / concurrencia | `/sync/carga` aplica estados sin control de versión ni de estado terminal: la APK puede reabrir un caso ya cerrado | `app/services/sync.py:46,467-475,512-520,560-604,669-686`; `app/services/resolucion.py:77-81` | M |
| H-15 | R3 | Observabilidad y monitoreo | Observabilidad parcial: logs de texto sin usuario, `/metricas` solo autenticado, sin alertas, uptime, retención ni crash reporting en la APK | `app/main.py:39-72`; `routes_alertas.py:852-858`; `routes_health.py:28-57`; `scripts/01_habilitar_apis.sh:15`; `scripts/03_iam_cuentas_servicio.sh:32-33`; `app_movil/pubspec.yaml:10-34` | M |
| H-16 | R1·R3 | Rendimiento y capacidad | SLO de rendimiento sin medición, archivos de prueba de carga inexistentes y N+1 verificado en MONITOREO | `app/services/monitoreo.py:29,165-216,460-480`; `documento_tecnico_D95.md:1147`; `documento_tecnico_D89.md:458`; `pruebas/plan_pruebas.md:26`; `requerimientos.md:213,220` | M |
| H-17 | R1·R2·R3 | Calidad y entrega | CI inexistente que seis manuales describen; línea base no reproducible, sin cobertura y con conteos contradictorios | `Manuales/04-Despliegue/04-pruebas-y-ci.md:20-24,335-359,368-387,398-401`; `Manuales/02-Dependencias/01-backend.md:523-531`; `plan_desarrollo.md:416`; `estado_proyecto.md:55`; `git log` → `ci.yml` borrado en `d818bcb`; `app/tests/conftest.py:25,79`; ruff 6 / mypy 1 | S |
| H-18 | R2 | Contrato API (manuales vs código) | Cifras incompatibles del contrato (109/79/109 vs 117/150/154; real 132/168), 18 operaciones sin documentar y RBAC anterior a D-112 | `Manuales/01-Tecnologia/01-plataforma.md:130-138`; `Manuales/03-Implementacion/09-api-endpoints.md:72-89,108-109,348-355`; `app/main.py:84-99`; `app/api/routes_casos.py:63`; medido: 132 paths / 168 operaciones | S |
| H-19 | R2 | Estados / contrato web-APK | El estado PENDIENTE existe en migración y producción, pero falta en el DDL base, Pydantic, la web y las acciones de la APK | `db/schema.sql:322-324` vs `:1049-1052`; `app/schemas/casos.py:11-21,29-32`; `app/web/src/api/types.ts:392-401`; `Casos.tsx:31-39`; `acciones_caso.dart:60-83`; `services/jornada.py:33,103`; `estado_proyecto.md:526` (54 casos) | S |
| H-20 | R5 | Brief DETALLE 5 / CASOS | El 70* obligatorio y el id de avería exigido a toda REPARACIÓN impiden registrar el Referido sin incidencia del brief | `BRIEF-GGTO-INICIAL.md:51,59`; `incremento_D89_identificador_pago.md:8,22-23,47`; `app/schemas/especiales.py:121-131`; `app/schemas/casos.py:129-143`; `test_especiales_api.py:117-124`; `ModalCaso.tsx:155-160` | M |
| H-21 | R1 | APK / prueba de campo | La «prueba de campo» no tiene oráculo: navega, imprime y puede saltarse la interfaz, pero no afirma el resultado | `app_movil/integration_test/flujo_campo_test.dart:121-150,395,401-427`; `incremento_D112_prueba_campo_apk.md:138,166,199,211-212` | M |
| H-22 | R1·R3 | Usabilidad / criterios de aceptación | RNF-09 y RNF-43 no son medibles ni medidos: placeholders «≤ N toques y ≤ T s» y validación pendiente de CANTV | `requerimientos.md:214`; `incremento_D95_apk_gestion.md:171`; `plan_desarrollo_D95_D98.md:163`; `pruebas/plan_pruebas.md:67,97`; `e2e/tests/02-navegacion.spec.js:23-40`; `propuesta_mejora_apk.md:487` | M |
| H-23 | R2·R5 | Estado del proyecto / gobierno documental | La cabecera del «estado vigente» contradice la bitácora: fase, HEAD, revisión desplegada y APK | `estado_proyecto.md:7-15` vs `:520-526`; `requerimientos.md:21`; `auditoria_estado_real_v2.md:3,7`; HEAD real `7c10086` | S |
| H-24 | R4 | Gobernanza operativa | Producción con PII sin dueño de DBA/SRE, seguridad, respuesta a incidentes ni proveedor cloud | `requerimientos.md:221,223,340-355`; `estado_proyecto.md:12-13,120,151,526`; `Manuales/07-Operacion/02-seguridad-y-privacidad.md:418-432`; `INFORME_OPTIMIZACION_V1.md:411,419` | S |

### 4.3 MEDIA (20)

| ID | Origen | Área | Hallazgo | Evidencia | Esf. |
|---|---|---|---|---|---|
| H-25 | R3 | Cumplimiento / retención (RNF-18) | Retención ejecutada sobre 3 de 12 entidades, auditoría a 365 días frente a 3 años y sin enmascaramiento por rol | `requerimientos.md:223,238-254`; `app/services/purga.py:60-110`; `app/api/routes_mantenimiento.py:48-50`; `app/schemas/casos.py:70-72`; `app/services/sistemas.py:38-50`; `estado_proyecto.md:481` | M |
| H-26 | R4·R7 | Auditoría / trazabilidad | La auditoría no cubre logins fallidos, recuperaciones, cierres, despachos, ingestas ni envíos de PII, y su único lector es el SUPER | `routes_auth.py:106-118,361-396`; `routes_casos.py:636-668`; `routes_despachos.py:703-741`; `routes_ingesta.py` (0 `Auditoria`); `routes_auditoria.py:22-35`; `deps.py:76,91` | M |
| H-27 | R2·R3 | Base de datos / esquema | Sin migraciones versionadas (no hay Alembic), scripts ad hoc, 41/42/43 tablas y `falla_masiva_caso` fuera del diccionario | `Manuales/07-Operacion/01-operacion-y-mantenimiento.md:323-331`; `db/schema.sql:1094`; `app/models/*.py` (37 `__tablename__`); `Manuales/05-Diccionario-de-Datos/01-entidades.md:9,22-38`; `modelo_er.md:10`; `estado_proyecto.md:526` | L |
| H-28 | R3·R6 | Entrega / reproducibilidad | Cadena no reproducible: tag mutable, despliegue sin digest ni aprobación, APK fuera de git, `versionCode` sin verificar y dependencias sin fijar | `scripts/11_desplegar_ggto_web.sh:24,73,77-88`; `.gitignore:40-42`; `publicar_apk.py:480-509,651`; `app/requirements.txt:1-9`; `Dockerfile:6,13,22`; `06_cloudsql_postgres.sh:25`; `GGTOv2_GCP.md:342` | M |
| H-29 | R6·R2 | Documentación de respaldo y despliegue | La documentación afirma que no hay backups/PITR cuando la instancia los tiene; no hay prueba de restauración y la protección de borrado sigue apagada | `Manuales/07-Operacion/01-operacion-y-mantenimiento.md:276-295`; `estado_proyecto.md:12-13,120`; `Manuales/04-Despliegue/02-cloud-run-y-cloud-sql.md:54-75,112,413`; `requerimientos.md:221` | M |
| H-30 | R6 | Zona horaria | La vigencia de cuadrilla se calcula con fecha UTC: entre las 20:00 y las 24:00 de Caracas el técnico queda «sin cuadrilla» | `app/services/sync.py:99,103-106` vs `:448`; `app/services/tiempo.py:16,30-38`; `routes_config.py:577,653` | S |
| H-31 | R6 | Proceso / cierre de jornada | El cierre «perezoso» depende de que un gestor abra DESPACHO; sin eso, casos de un despacho PUBLICADO desaparecen del universo sin aviso | `app/services/jornada.py:8-11,128-146`; `routes_despachos.py:146,321-341`; `services/despacho.py:269-279`; `Despacho.tsx:1067-1070`; `incremento_D99_masivas.md:131,141` | M |
| H-32 | R4·R5 | Soporte / NOC y reporte diario | Soporte sin canal ni SLA, destinatarios de aviso vacíos y reporte de las 16:00 solo a demanda | `requerimientos.md:225,346`; `db/schema.sql:921,925-926`; `services/notificaciones.py:64-67`; `services/fallas.py:128-135`; `routes_despachos.py:678-688`; `pages/Ayuda.tsx:2` | M |
| H-33 | R1 | Requerimientos / criterios no medibles | Falla masiva sin umbral aprobado y semántica ambigua («superan» vs `>=`), «información sencilla», «preferentemente», «Telegram o correo» | `requerimientos.md:111,151,165,112,138,409,413-414`; `app/services/fallas.py:15-16,54,76`; `test_alertas_api.py:16` | S |
| H-34 | R1 | APK / requisitos sin prueba | RNF-04 (galería bloqueada) no tiene prueba y RNF-37 (`FLAG_SECURE`) no está implementado | `requerimientos.md:209-210`; `incremento_D95_apk_gestion.md:165`; `evidencia_service.dart:43-44`; `flujo_campo_test.dart:210-237`; `grep FLAG_SECURE` → 0; `MainActivity.kt` sin `FLAG_SECURE` | M |
| H-35 | R1·R3 | Accesibilidad (RNF-23) | Sin auditoría automatizada WCAG en la SPA; en la APK, tipografías por debajo de 16 sp y sin acotación de `textScaler` | `requerimientos.md:228`; `app/web/package.json:5-10`; `e2e/tests` (0 axe/accessib); `theme.dart:91-102`; 129 `fontSize` 10.5–15; `grep textScaler` → 0 | M |
| H-36 | R1·R2 | Trazabilidad de requisitos | IDs RNF-40…RNF-47 y RT-36 reutilizados con definiciones distintas | `incremento_D95_apk_gestion.md:156-173`; `D103:41`; `D104:68`; `D105:86`; `D106:66`; `D107:77`; `D108:72`; `D110:86`; `D113:130-131`; `requerimientos.md:376` | S |
| H-37 | R2·R5 | Requerimientos / planificación | `requerimientos.md` sigue congelado en 38 RF/25 RNF/14 RT, sin hito ni plazo, mientras el alcance real llega a RF-101 | `requerimientos.md:101-157,376,380-390`; `plan_desarrollo.md:27-190`; `incremento_D112_prueba_campo_apk.md:164-168` | M |
| H-38 | R2 | Documentación vs APK | El manual de pruebas declara la APK «no desarrollada», los manuales se detienen en D-82 y el índice se anuncia «completo» | `04-pruebas-y-ci.md:46-47`; `app_movil/pubspec.yaml:5`; `Manuales/00-indice.md:3,19-43`; `estado_proyecto.md:58-59`; 26 `.md` en Manuales; 69 Dart en `lib/` | M |
| H-39 | R1 | E2E (cobertura real) | Los E2E 22 (mensajes) y 23 (panel) se presentan como flujos completos y solo comprueban títulos y botones | `e2e/tests/22-mensajes.spec.js:4-29`; `23-panel-gestion.spec.js:4-20` | S |
| H-40 | R4 | Stakeholder validador CRASS | El validador del CRASS no es actor del flujo: se guarda una fila sin confirmación y el servidor no verifica `tipo='CRASS'` | `app/services/masivas.py:265-270,306`; `db/schema.sql:1077-1078`; `routes_alertas.py:53,482-488`; `routes_especiales.py:90-131`; `FichaMasiva.tsx:154` | S |
| H-41 | R4 | Stakeholder solicitante externo | El solicitante externo (ACT-03) no existe como actor: no puede reportar por el canal previsto ni recibe notificación | `requerimientos.md:52,196`; `app/api/deps.py:88`; `routes_especiales.py:286-300`; `routes_alertas.py:661-705,734-745`; `services/fallas.py:128-135` | M |
| H-42 | R5 | APK / alcance del brief | El ZIP de jornada del brief se eliminó del producto sin cambiar el requisito | `BRIEF-GGTO-INICIAL.md:119-120`; `requerimientos.md:181`; `estado_proyecto.md:437`; `diccionario_datos.md:69`; `grep Archive/Zip` sin generación | M |
| H-43 | R5 | Brief / SEGUIMIENTO (RF-34) | La sección SEGUIMIENTO no existe en la web: hay API y cliente, pero ninguna página los usa | `BRIEF-GGTO-INICIAL.md:57`; `requerimientos.md:77,153`; `App.tsx:25-71`; `Layout.tsx:44-59`; `client.ts:912-935`; `routes_especiales.py:596-660`; `FichaCaso.tsx:869-900` | S |
| H-44 | R5 | APK / alcance no solicitado | La auto-actualización de la APK no está en el brief y añade superficie de instalación sin modelo de amenaza | `BRIEF-GGTO-INICIAL.md:2,98,119-120`; `incremento_D107:5`; `AndroidManifest.xml:23`; `estado_proyecto.md:515`; `requerimientos.md` sin RF-90 | S |

### 4.4 BAJA (2)

| ID | Origen | Área | Hallazgo | Evidencia | Esf. |
|---|---|---|---|---|---|
| H-45 | R2 | Accesibilidad / codificación | Los nombres accesibles de los chips de estado muestran mojibake («GestiÃ³n», «sÃ­») | `app/web/src/components/EstadoChips.tsx:26,58-59,82-83`; `D103:41`; `D111:127` | S |
| H-46 | R4 | Stakeholder supervisor de cuadrilla | El supervisor de cuadrilla existe en los datos pero no como actor: se guarda y no otorga permisos, pantalla ni flujo | `db/schema.sql:251-252`; `schemas/config.py:242`; `Cuadrillas.tsx:18`; `routes_config.py:581,646,652`; `sesion.dart:27-29`; `routes_casos.py:63,642` | S |

**Distribución:** CRÍTICA **5** · ALTA **19** · MEDIA **20** · BAJA **2** · **TOTAL 46**.

---

## 5. Hallazgos CRÍTICOS y ALTOS detallados

### 5.1 CRÍTICA

#### H-01 — PII real de suscriptores en un servicio público, sin base legal, aviso ni retención efectiva
- **Origen:** R3 (Fiabilidad/recuperación y D-26), R4 (suscriptor sin actor), R7 (legal/privacidad).
- **Contexto.** Producción contiene **datos reales de abonados** (nombre, teléfono 70*, dirección, serial): la carga inicial documentada es de **42 casos** del CSV del 15/09/2026 (D-54, 2026-09-27) y el universo de despacho consultado el 2026-10-19 informa **61 casos, 54 de ellos en `PENDIENTE`**. El servicio es invocable por `allUsers`. La documentación reconoce que la base legal, la finalidad y la evaluación de transferencia internacional están pendientes de validar con CANTV, que el responsable de protección de datos está sin designar y que el enmascaramiento por rol no está implementado. El «riesgo aceptado D-26» se firmó con una condición explícita —no cargar datos reales hasta que exista respaldo—; los backups y el PITR **hoy sí existen** (verificado en vivo), pero la condición no legitimaba el tratamiento: lo que faltaba y sigue faltando es base legal, aviso, retención efectiva y protección de borrado.
- **Evidencia.** `RepoTecnico/estado_proyecto.md:12-13,120,151` y `:526`; `RepoTecnico/Manuales/07-Operacion/02-seguridad-y-privacidad.md:336` (42 casos reales), `:341-346` (base legal pendiente y responsable sin designar), `:362-367` (enmascaramiento no implementado), `:371-384` (retención propuesta y rutina inexistente) y `:537-541`; `RepoTecnico/requerimientos.md:223,232-236`; `disclaimer.md:13-16,25-28`; `app/web/public/apk/apk.json` («No distribuir»); `app/services/purga.py:110-145`; `app/api/routes_mantenimiento.py:28-33`; verificación en vivo: `gcloud run services get-iam-policy` → `allUsers`/`roles/run.invoker`, `GET /ready` → 200 con base `ggtov2`, usuario `ggtov2_app`, PostgreSQL 15.18 y 43 tablas.
- **Impacto.** Tratamiento de datos personales sin base acreditada, sin aviso al titular y sin vía de ejercicio de derechos (acceso, rectificación, supresión); exposición a cualquier persona con la URL; contradicción directa con el único texto legal del proyecto, que prohíbe publicar y distribuir y declara que «no constituye un sistema en producción». La retención declarada no se ejecuta y `deletionProtectionEnabled=false` deja la base expuesta a borrado accidental. **Necesita verificación:** número exacto de filas con PII en producción (no se consultó la base) y firma del APK publicado.
- **Recomendación.** Suspender el tratamiento de PII real hasta: (a) restringir el invocador (IAP o invocación autenticada) y retirar el APK público; (b) aprobar con CANTV base legal, aviso de privacidad, DPA con Telegram/correo y evaluación de transferencia, designando responsable por escrito; (c) desplegar `MANTENIMIENTO_TOKEN` y una purga/anonimización por entidad realmente ejecutada; (d) `sslMode=ENCRYPTED_ONLY` y `deletionProtectionEnabled=true`; (e) corregir el disclaimer y el registro de riesgos para que reflejen la realidad.

#### H-02 — MCP y webhook de Telegram responden sin autenticación en producción y exponen PII de abonados
- **Origen:** R4 (actores externos) y R7 (seguridad).
- **Contexto.** Ambos endpoints validan la clave con el patrón `if esperada and x… != esperada`: si el parámetro está vacío **no se exige credencial**, y el esquema siembra `mcp.api_key` y `telegram.webhook_secret` como cadena vacía con el comentario explícito «si está vacía no se exige». La revisión desplegada no inyecta ninguna variable que los fije, de modo que el *fail-open* es el comportamiento real. La superficie anónima publica además `/docs`, `/openapi.json` (239 682 bytes) y `/ready`. La herramienta `consultar_caso` devuelve `nombre_cliente`, `telefono`, `direccion` y `sector` a partir de un `id_averia` o de un patrón de teléfono con `ilike %…%`, y el comando `/caso` replica la fuga al `chat_id` que envíe el atacante; `procesar_notificaciones` permite a un anónimo disparar el outbox. No hay identidad, atribución ni rate limit (el limitador solo existe en `routes_auth.py`).
- **Evidencia.** `app/api/routes_alertas.py:686-691,716,769-777,806-808,833-835`; `RepoTecnico/db/schema.sql:938-939`; `RepoTecnico/Manuales/03-Implementacion/09-api-endpoints.md:451-452,665-667`; `RepoTecnico/requerimientos.md:227` (RNF-22); verificación en vivo 2026-10-19: `POST /api/v1/mcp` con `tools/list` → 200 sin cabecera, `POST /api/v1/telegram/webhook` con `{}` → 200 sin secreto, `GET /openapi.json`, `/docs` y `/ready` → 200.
- **Impacto.** Un actor anónimo puede enumerar abonados por prefijo telefónico y leer datos personales sin límite de peticiones; la única credencial que protege los canales externos no existe en producción. Es el H-23 ya documentado en `INFORME_OPTIMIZACION_D95_V1.md:261` cuya mitigación M-13 sigue sin ejecutar.
- **Recomendación.** *Fail-closed*: sin secreto, 503/403 y ninguna herramienta ejecutada. Fijar los secretos en Secret Manager con `--set-secrets`, rotar el token del bot, restringir `consultar_caso` a `id_averia` exacto y sin PII, desactivar `/docs`/`/openapi.json`/`/ready` en producción o exigir autenticación, añadir rate limit y pruebas negativas que fallen con clave vacía.

#### H-03 — Contraseña del keystore pública y claves de canal legibles por cualquier rol
- **Origen:** R4 (custodio de secretos), R6 (cadena de suministro), R7 (secretos).
- **Contexto (a) Firma.** `app_movil/android/key.properties.bak` y `key.properties.temporal-debug` están **rastreados en git** y contienen `storePassword` y `keyPassword` en claro —la misma cadena de 32 caracteres— del almacén `ggto-tecnico-release.jks`. El repositorio es público y el 2026-10-19 se descargó el archivo sin autenticación (`raw.githubusercontent.com/.../key.properties.bak` → 200). Mitigantes verificados: el `.jks` **no** está publicado (raw 404) y `scripts/publicar_apk.py:13` verifica la firma y rechaza la de depuración. Agravantes: `build.gradle:16-20,58` cae silenciosamente a `signingConfigs.debug` si falta `key.properties`; Android exige la misma clave para actualizar, así que rotar obliga a reinstalar toda la flota y rompe la actualización in-app; el `.gitignore:11-15` admite que esos archivos «quedaron versionadas por no cubrirlas el patrón anterior».
- **Contexto (b) Claves de ejecución.** `GET /api/v1/configuracion` exige solo `get_current_user` y devuelve todas las filas de `configuracion`, incluidas `telegram.webhook_secret` y `mcp.api_key`; la matriz reserva CONFIGURACIÓN a SUPER/ADMIN/SUPERVISOR y deja al TECNICO en «—». En el mismo router, `/tecnicos` expone cédula, teléfono y correo de todo el personal a cualquier autenticado.
- **Evidencia.** `app_movil/android/key.properties.bak:8,10`; `key.properties.temporal-debug:8,10`; `app_movil/android/key.properties:8,10`; `.gitignore:11-15`; `git ls-files` → ambos; GET anónimo al `.bak` → 200; `app/api/routes_config.py:302-314,750-752`; `app/schemas/config.py:168-178,321-326`; `RepoTecnico/db/schema.sql:938-939`; `RepoTecnico/estado_proyecto.md:333,496`; `RepoTecnico/requerimientos.md:268,352`; `RepoTecnico/GGTOv2_GCP.md:427`; `AndroidManifest.xml:23`; `actualizador_apk.dart:263`.
- **Impacto.** Con una copia del `.jks` (respaldo, ZIP, correo, otro equipo) la contraseña pública permite firmar una actualización que Android instalará sobre la app oficial, y la actualización in-app confía en esa firma. Las claves de canal, una vez configuradas, quedarían al alcance del rol de menor privilegio, anulando el control de H-02.
- **Recomendación.** Tratar la clave como comprometida: keystore nuevo con `applicationId` definitivo, transición planificada, purga del historial en ambos remotos (`git filter-repo` + force-push coordinado), custodia del `.jks` cifrada con titular y suplente, secretos solo en Secret Manager con rotación a 90 días, lista blanca de configuración por rol, restricción de `/tecnicos` a ADMIN/SUPERVISOR y escáner de secretos (`gitleaks`/`trufflehog`) en el pipeline. **Necesita verificación:** el valor real de los secretos y la validez de la firma del APK publicado.

#### H-04 — `/auth/unlock` y `/auth/reset-password` sin límite, bloqueo ni auditoría: toma de cualquier cuenta
- **Origen:** R7 (autenticación y recuperación).
- **Contexto.** La recuperación se apoya en 3 de las 12 palabras de seguridad (diccionario de 110 palabras) con posiciones elegidas libremente por el cliente. Ninguno de los dos endpoints llama a `_rate_limit` (que solo cubre `/login` y `/primer-acceso`), no incrementan `intentos_fallidos`, no bloquean cuenta ni dispositivo, no exigen sesión y no escriben en `auditoria`; `reset-password` fija además la clave que elige el atacante. El esquema no prohíbe repetir posición y el servidor compara palabra por palabra devolviendo un único booleano: enviar `[{pos:1,X},{pos:1,X},{pos:1,X}]` convierte el endpoint en un oráculo de una sola palabra, de modo que **~110 peticiones por posición y ~330 en total** recuperan 3 palabras válidas. El limitador es un `defaultdict` del proceso que se reinicia al escalar (`--max-instances 10`) y no hay revocación: `jti` se emite pero no se consulta, así que un token de 480 min sigue vivo tras un reset de clave o un cambio de rol. `/unlock` distingue «P00 no encontrado» (404) del resto, lo que facilita la enumeración.
- **Evidencia.** `app/api/routes_auth.py:44-58,73-85,92,256,361-377,380-396,364-365,383-384`; `app/schemas/auth.py:35-43`; `app/core/words.py:8-22`; `app/core/security.py:67`; `app/core/config.py:30`; `RepoTecnico/scripts/11_desplegar_ggto_web.sh:82`; `RepoTecnico/requerimientos.md:227` (RNF-22 pide backoff, revocación y registro).
- **Impacto.** Cualquiera puede tomar una cuenta —incluida SUPER— por fuerza bruta dirigida, sin dejar rastro, y el token robado no se puede revocar. Es el vector de escalada más directo del sistema.
- **Recomendación.** Rate limiting y bloqueo progresivo por P00 + IP + cuenta en almacén compartido (Cloud Armor/Firestore/Redis), prohibir posiciones repetidas, auditar cada intento (éxito y fallo), invalidar los JWT al cambiar clave o rol (tabla de `jti` o versión de sesión), respuesta uniforme para no filtrar existencia de P00 y pruebas de fuerza bruta.

#### H-05 — Las fotos de campo se guardan en disco efímero y su URL devuelve 200 con el HTML de la SPA
- **Origen:** R6 (riesgos técnicos) y R7 (evidencias).
- **Contexto.** `subir_evidencia()` solo usa Cloud Storage si existe `GGTO_GCS_BUCKET`; si no, escribe bajo `GGTO_EVIDENCIAS_DIR` (por defecto `.evidencias`, es decir `/srv/.evidencias` por el `WORKDIR /srv`) y devuelve `/evidencias-locales/...`. La revisión desplegada no tiene `GGTO_GCS_BUCKET` ni credenciales, así que toda evidencia va al disco efímero del contenedor. Como `app/main.py` solo monta la SPA en `/` y su fallback devuelve `index.html` ante un 404, la ruta responde 200 con `text/html`: el enlace «parece válido», abre la aplicación y la imagen nunca aparece. `subir_evidencia()` nunca lanza (registra el fallo de GCS y continúa) y `/evidencias/upload` responde 200 con una `ruta_remota` que apunta a la nada. En paralelo, la subida se valida solo por `content_type`, sin verificar bytes mágicos ni decodificar, sin cuota por usuario y con el `id_caso` aceptado pero no usado, de modo que la evidencia queda huérfana.
- **Evidencia.** `app/services/storage.py:22-25,63-84`; `app/api/routes_sync.py:90-155`; `app/main.py:105-119`; `app/Dockerfile:19`; `RepoTecnico/scripts/11_desplegar_ggto_web.sh:85-86`; `app/tests/test_sync_api.py:596,610,619` (solo con `tmp_path`); verificación en vivo: `GET https://ggto-web-m33mjctj4a-ew.a.run.app/evidencias-locales/x.jpg` → 200 `text/html`.
- **Impacto.** Pérdida silenciosa de evidencia de cierre (RF-14 y cierre en cascada de masivas) en cada arranque en frío o nueva revisión; imposibilidad de auditar cierres; fotos con PII (rostro, fachada, GPS) en el disco de la instancia sin cifrado ni retención. La suite no lo detecta porque inyecta `GGTO_EVIDENCIAS_DIR` a un `tmp_path`.
- **Recomendación.** Configurar bucket GCS + service account de permisos mínimos y hacer la subida *fail-closed*: sin bucket, `/evidencias/upload` responde 503/507 para que el técnico vea que la foto no subió y quede en cola local. URLs firmadas de corta vida, montar `/evidencias-locales` solo fuera de producción, comprobación en `/ready`, validación por contenido, cuota por usuario/caso y conciliación periódica de huérfanas.

### 5.2 ALTA

#### H-06 — XSS almacenado en las fichas imprimibles con robo del JWT de `localStorage`
- **Contexto.** La ficha imprimible del despacho se construye por concatenación de f-strings con datos que escribe el usuario (dirección, cliente, contacto, problema) y se devuelve como `HTMLResponse`; no hay `html.escape` en todo el backend y los tres módulos que devuelven HTML usan el mismo patrón. El SPA la pide con Bearer y la escribe en una ventana `about:blank` con `document.write`, que hereda el origen del abridor: un `<script>` en `caso.direccion` se ejecuta con el origen de la plataforma y puede leer `localStorage`. Un TÉCNICO puede escribir esos campos vía `PATCH /casos/{id}/contacto` (el guard `_gestion` lo incluye), de modo que un usuario de campo puede secuestrar la sesión de un ADMIN que abra la ficha. Se verificó además que `/` no envía `Content-Security-Policy`, `X-Frame-Options`, HSTS ni `X-Content-Type-Options`.
- **Evidencia.** `app/api/routes_despachos.py:525-583`; `app/web/src/pages/Despacho.tsx:683-691`; `app/web/src/api/client.ts:139,200`; `app/api/routes_casos.py:63,790-796`; `app/api/routes_monitoreo.py:8`; `app/api/routes_alertas.py:10`; verificación en vivo de cabeceras.
- **Impacto.** Escalada de privilegios de TÉCNICO a ADMIN/SUPERVISOR y exfiltración del token; el XSS vive en el origen de la aplicación, no en un dominio aislado.
- **Recomendación.** Escapar con `html.escape` todo valor interpolado (o plantillas autoescapadas), servir el imprimible desde origen aislado o `blob`/`iframe sandbox`, añadir CSP estricta sin `unsafe-inline`, `X-Frame-Options: DENY`, HSTS y `nosniff`, dejar de guardar el JWT en `localStorage` y añadir una prueba de XSS con `<script>` en la dirección.

#### H-07 — Aislamiento RBAC incompleto y no probado
- **Contexto.** La matriz concede al TÉCNICO «lectura de sus casos» y «gestión de su cuadrilla», pero `GET /casos` filtra solo por central y `GET /casos/{id}` acepta cualquier id sin comprobar técnico ni cuadrilla; el cierre usa `_gestion`, que incluye TECNICO. El patrón correcto ya existe y no se aplicó: MONITOREO fuerza la cuadrilla del técnico y la ruta de sincronización impone «un TECNICO solo puede tocar casos asignados a su cuadrilla». Además, en las 30 suites no hay una sola aparición de `set_config`, `app.id_central` ni `sin_acotar`, de modo que las políticas RLS de `schema.sql:786-811` nunca se ejercen con un usuario de otra central; el fixture usa siempre `2324X`. A ello se suman: `GET /notificaciones` solo filtra por central al COORDINADOR, y `POST /despachos/{id}/enviar` acepta un `destinatario` arbitrario y envía PII sin traza en auditoría.
- **Evidencia.** `app/api/routes_casos.py:56,63,190-193,225-226,473-475,638-643`; `app/services/sync.py:582-603`; `app/api/routes_monitoreo.py:41-50`; `RepoTecnico/db/schema.sql:786-811`; `app/tests/conftest.py:146-147`; `app/tests/test_d112_campo_rbac.py:51-135`; `app/api/routes_alertas.py:617-635`; `app/api/routes_despachos.py:703-741`; `RepoTecnico/requerimientos.md:226,259,270-271`; `RepoTecnico/pruebas/plan_pruebas.md:97`; `plan_desarrollo_D95_D98.md:161`.
- **Impacto.** Cualquier técnico autenticado puede enumerar y cerrar casos de otras cuadrillas con PII; con una segunda central, la bandeja y el envío filtran datos entre centrales; el aislamiento es una afirmación de diseño sin prueba.
- **Recomendación.** Aplicar el mismo acotado por cuadrilla/central a lecturas y a cierre, enrutado, cita y no-contesta (reutilizando `services/sync.py`), filtrar siempre por `usuario.id_central` en notificaciones, convertir `destinatario` en lista permitida por central con auditoría, y añadir pruebas negativas «técnico A → caso de cuadrilla B = 403», lectura directa de las 3 tablas con RLS activa y «SUPER sin central ve todo».

#### H-08 — El primer acceso no verifica identidad: enumera P00 y permite preregistrar cuentas ajenas
- **Contexto.** `GET /auth/primer-acceso` es anónimo y devuelve, para cualquier P00, si existe, el estado y el nombre y apellido del técnico; el único control es un rate limit de 30/min por IP en memoria. `POST /auth/setup` completa el alta con solo P00, correo y clave: sin código al correo, sin aprobación del supervisor y sin comprobar que quien lo envía sea el titular. Un atacante puede descubrir los P00 en estado PENDIENTE y registrarlos con su propio correo y clave, quedándose con cuentas de rol TÉCNICO; además el alta sobrescribe `tecnico.correo` con el correo del atacante. `/unlock` responde 404 «P00 no encontrado» frente a 401, lo que facilita la enumeración.
- **Evidencia.** `app/api/routes_auth.py:136-207,219-223,250-303,364-365`; `app/schemas/auth.py:57-63,72-80`; `app/scripts/11_desplegar_ggto_web.sh:82`.
- **Impacto.** Toma de cuentas con acceso a casos con PII, cierre y enrutado, y corrupción del contacto real del técnico.
- **Recomendación.** Respuesta uniforme y genérica sin nombre ni estado fino, código de un solo uso entregado por el supervisor o enviado al correo ya registrado, prohibir que `setup` sobrescriba el correo de un técnico existente, auditar intentos y pruebas negativas de enumeración.

#### H-09 — PIN de fábrica universal y base local con PII sin protección
- **Contexto.** La credencial offline se emite automáticamente en cada login con red de un TÉCNICO con el PIN de fábrica `824605`, idéntico para todos los dispositivos y embebido en el APK; la app obliga a cambiarlo en el primer uso sin conexión, pero hasta entonces cualquiera con el dispositivo y el P00 entra y accede a `ggto.db` (SQLite sin cifrar) con los casos descargados en `datos_json`. El manifest no fija `android:allowBackup="false"` ni `dataExtractionRules`, el `applicationId` es `com.example.ggto_tecnico`, `FileProvider` expone `cache-path "/"` y el build de release cae a firma debug si falta `key.properties`. Corrección a R7: el servicio `cambiarPin` no recibe el PIN actual, pero la pantalla sí lo verifica antes de abrir el formulario; es defensa en profundidad, no una vía de cambio sin PIN.
- **Evidencia.** `app_movil/lib/core/constants.dart:27,34`; `credencial_service.dart:216-223,266-290`; `pin_screen.dart:96-106`; `core/database.dart:22-45`; `AndroidManifest.xml:29-32`; `res/xml/file_paths.xml:3-4`; `build.gradle:16-20,38,58`; `credencial_local.dart:55-58`; `pin_hash.dart`.
- **Impacto.** Un dispositivo perdido con la credencial sin personalizar entrega la base local con PII; el backup del sistema puede extraerla; el `applicationId` de ejemplo impide publicar y colisiona.
- **Recomendación.** Eliminar el PIN de fábrica (PIN definido por el técnico en el primer login con red o código de un solo uso), `allowBackup="false"` + `dataExtractionRules`, cifrar la base (SQLCipher) o excluirla, `applicationId` propio, `file_paths.xml` acotado y build de release que falle sin keystore.

#### H-10 — Roles no aprobados y SUPER sin MFA
- **Contexto.** El brief define supervisor, trabajadores y personal externo que reporta casos; no define ADMIN, SUPER ni COORDINADOR. `requerimientos.md` introduce una APK con cinco roles, un actor COORDINADOR nuevo y un SUPER con «acceso total»: el bypass está en `deps.py` (cualquier operación pasa si el rol es SUPER) y activa `app.sin_acotar`, evitando el acotado por central. RNF-22 exige MFA para ADMIN/SUPERVISOR, pero no existe código MFA/TOTP y el MFA del COORDINADOR queda diferido. D-50 creó el SUPER por orden del usuario, sin aprobación de CANTV registrada ni análisis de riesgo.
- **Evidencia.** `app/api/deps.py:20,52-53,76`; `RepoTecnico/requerimientos.md:19,56,261-264,293-294,333-334`; `RepoTecnico/BRIEF-GGTO-INICIAL.md:9,15,26`; `app_movil/lib/main.dart:138-156`; `RepoTecnico/estado_proyecto.md:144`; `grep MFA/TOTP` → sin coincidencias.
- **Impacto.** Un rol total sin MFA, sin acotado por central y sin auditoría independiente concentra el riesgo de toda la PII; los roles extra amplían el alcance sin aceptación del cliente.
- **Recomendación.** Aprobación escrita de CANTV para los roles extra o retirada del alcance V2; para SUPER, aceptación formal de riesgo, acotado por central y MFA antes de conceder lectura amplia de PII.

#### H-11 — Nada se ejecuta de forma programada y nada sale por los canales externos
- **Contexto.** El runbook D-81 presenta cuatro jobs de Cloud Scheduler como parte del despliegue, pero la API `cloudscheduler.googleapis.com` **no está habilitada** y la revisión desplegada no tiene `MANTENIMIENTO_TOKEN`, de modo que las cuatro rutas devolverían 503 aunque se creara el job. Consecuencias: la purga nunca corre (crecimiento indefinido en una instancia de 10 GB compartida), las `sync_log` en EN_PROCESO nunca se cierran y no se emiten recordatorios ni alarmas. A ello se suma que el outbox no está en las rutas de mantenimiento y solo se invoca desde el endpoint manual o el webhook; y, sin `TELEGRAM_BOT_TOKEN` ni `SMTP_HOST`, `_telegram`/`_correo` devuelven PENDIENTE: ninguna alerta de falla masiva sale del sistema. El manual de operación reconoce la ausencia de planificador y de credenciales; lo que no es cierto es el runbook D-81, que describe como desplegado lo que nunca se desplegó.
- **Evidencia.** `app/api/routes_mantenimiento.py:25-64`; `app/core/config.py:43`; `RepoTecnico/D81_despliegue.md:52,55-64`; `scripts/11_desplegar_ggto_web.sh:85-86`; `app/services/purga.py:107-110`; `app/services/outbox.py:51-104`; `app/api/routes_alertas.py:645`; `app/services/notificaciones.py:20-42`; `app/services/fallas.py:128-142`; `Manuales/07-Operacion/01-operacion-y-mantenimiento.md:239-260`; en vivo: `gcloud scheduler jobs list` → SERVICE_DISABLED; revisión sin `MANTENIMIENTO_TOKEN`.
- **Impacto.** Los requisitos de notificación del brief (RF-10/RF-27/RF-09) no se entregan; la retención declarada no se ejecuta; las alertas quedan en la bandeja y nunca llegan a un supervisor. El crecimiento de datos amenaza la instancia compartida.
- **Recomendación.** Habilitar Cloud Scheduler, crear cinco jobs (los cuatro de D-81 más uno de `outbox.procesar` cada 2-5 min), inyectar `MANTENIMIENTO_TOKEN` desde Secret Manager y verificar 200 en cada ruta; configurar Telegram/SMTP o aceptar por escrito un solo canal; probar un envío extremo a extremo; alertar por job fallido y por `notificacion` PENDIENTE antigua; corregir D-81.

#### H-12 — Instancia zonal compartida, en otra región y sin SSL exigido
- **Contexto.** La base `ggtov2` vive en `truekeate-db-dev` (`southamerica-east1`): `ZONAL`, `db-f1-micro`, 10 GB, compartida físicamente con TrueKeate, `ipv4Enabled=true`, red autorizada `35.232.138.181/32` y `sslMode=ALLOW_UNENCRYPTED_AND_ENCRYPTED` con `requireSsl=false`; el `DB_SSLMODE=require` de la aplicación es una exigencia del cliente, no de la instancia. Cloud Run corre en `europe-west1` con `--cpu 1 --memory 512Mi`, concurrencia 80, `maxScale=10` y sin `minScale` (0): cada consulta cruza el Atlántico y se multiplica en los flujos con N+1. El engine global usa `pool_size=5` + `max_overflow=5` (hasta 10 por instancia y 100 con 10 instancias), sin pooler ni `max_connections` fijado. Un fallo zonal, una ventana de mantenimiento o el llenado de los 10 GB tumban backend, web y sincronización; el plan de contingencia se limita a «conservar los CSV de origen».
- **Evidencia.** `scripts/11_desplegar_ggto_web.sh:21,26,81-82`; `app/core/db.py:26-39`; `app/web/src/components/Layout.tsx:134`; `Manuales/07-Operacion/01-operacion-y-mantenimiento.md:287-290,307-309`; `GGTOv2_GCP.md:345,348`; `estado_proyecto.md:12`; en vivo: `gcloud sql instances describe` y `gcloud run services describe` (2026-10-19).
- **Impacto.** Punto único de fallo de toda la persistencia, latencia transatlántica, riesgo de agotamiento de conexiones y datos sin cifrado en tránsito garantizado. **Necesita verificación:** `max_connections` efectivo y existencia del índice GIN en producción.
- **Recomendación.** Migrar a una instancia propia REGIONAL en la misma región que Cloud Run, con `sslMode=ENCRYPTED_ONLY`, IP privada + Cloud SQL Connector, `deletionProtectionEnabled=true` y tier dimensionado. Mientras tanto: reducir el pool (2-3), alinear `max-instances` con el techo de conexiones, fijar `max_connections`, alertas de conexiones/CPU/disco, sustituir el sondeo de listado por endpoint incremental y documentar un plan de contingencia con RTO/RPO medidos.

#### H-13 — La carga por lotes no es idempotente
- **Contexto.** La APK envía en cada actividad un `id_actividad_local` (clave de idempotencia del cliente), pero `aplicar_carga` nunca lo lee: solo existe en el esquema Pydantic y la tabla `actividad` no tiene restricción única. Si el `POST /sync/carga` llega pero la respuesta se pierde (timeout, app en segundo plano, cierre), el dispositivo no marca nada como enviado y reenvía el lote: se crean actividades duplicadas y las métricas quedan infladas. El lote es todo-o-nada: si una sola acción se rechaza, se marcan para reintento las 200, incluidas las ya aceptadas, con `intentos = 1` fijo y sin backoff; `accionesPendientes` no filtra por intentos, así que las rechazadas nunca llegan a ERROR visible.
- **Evidencia.** `app/schemas/sync.py:123`; `app/services/sync.py:606-638,667,688-694`; `RepoTecnico/db/schema.sql:545-562`; `app_movil/lib/features/sync/upload_service.dart:171,198,211,247-265`; `core/database.dart:461-470,484-498`; `sync_screen.dart:59-70`; `sync_provider.dart:244-273`; `core/constants.dart:37`.
- **Impacto.** Duplicación de actividades, métricas y conteos de gestión inflados, y acciones rechazadas invisibles para el técnico.
- **Recomendación.** Clave de idempotencia con índice único (`id_actividad_local`/UUID de cliente) y `ON CONFLICT DO NOTHING`, respuesta por acción para que la APK borre solo las aceptadas, mismo esquema de reintento que la cola clásica (backoff, máximo, ERROR visible) y pruebas de reenvío y de respuesta perdida.

#### H-14 — `/sync/carga` sin control de versión: la APK puede reabrir un caso cerrado
- **Contexto.** `aplicar_carga` valida que el caso pertenezca a la cuadrilla y que el estado nuevo sea válido, pero no comprueba el estado actual ni la marca de actualización: un `estado_nuevo = DIFERIDO` sobre un caso que la web acaba de cerrar se aplica y deja el caso reabierto, con histórico que contradice el cierre. `ESTADOS_TERMINALES` solo excluye casos de la DESCARGA, no protege la CARGA. La ruta web equivalente sí se protege (`resolucion.cerrar_caso` rechaza cerrar un caso ya CERRADO). No hay `If-Match`/`updated_en` ni aviso de conflicto al técnico.
- **Evidencia.** `app/services/sync.py:46,467-475,512-520,560-604,669-686`; `app/services/resolucion.py:77-81`.
- **Impacto.** El inventario de cierres deja de ser fiable y el caso retrocede de estado sin que nadie lo note.
- **Recomendación.** Versionar el caso (`version` o `updated_en` como ETag) y rechazar con 409/`CONFLICTO` toda acción sobre un caso que cambió desde la descarga o está en estado terminal; reutilizar la regla de transiciones de `resolucion` y probar carreras web/APK.

#### H-15 — Observabilidad parcial: sin alertas, uptime, retención ni crash reporting
- **Contexto.** RNF-19 exige logs estructurados con request-id y usuario, métricas de negocio, alertas ante ingesta no ejecutada, error de sincronización y fallo de notificación crítica, y retención ≥ 30 días. Lo implementado es `logging.basicConfig` con formato de texto y un middleware que registra request_id, método, ruta, código y milisegundos —y el fallo con request_id— pero no el usuario, sin JSON y sin propagar el request-id a los servicios; en todo `app/` solo hay tres `logger.exception`. `/metricas` es un endpoint autenticado que devuelve contadores de negocio, no un exportador ni fuente de alertas. No hay ninguna `alertPolicy` ni `uptimeCheck` en `scripts/`; solo se habilitan las APIs y se conceden roles. La APK no declara ninguna dependencia de logging estructurado o crash reporting. El manual reconoce las carencias.
- **Evidencia.** `app/main.py:39-72`; `app/api/routes_alertas.py:852-858`; `app/api/routes_health.py:28-57`; `app/services/sync.py:864`; `app/services/storage.py:54,77`; `Manuales/07-Operacion/01-operacion-y-mantenimiento.md:344-353`; `scripts/01_habilitar_apis.sh:15`; `scripts/03_iam_cuentas_servicio.sh:32-33`; `app_movil/pubspec.yaml:10-34`; `propuesta_mejora_apk.md:97`.
- **Impacto.** Los incidentes de producción y de campo son indiagnosticables; no hay alerta cuando la ingesta no corre o cuando una notificación crítica falla.
- **Recomendación.** Logs JSON con request_id, usuario (p00), rol, ruta y latencia desde un filtro único; 3-4 políticas de alerta (ingesta ausente, `/ready` 503, notificaciones FALLIDO > 0, p95 > 2 s), uptime check sobre `/health` en horario operativo, retención ≥ 30 días y captura de errores en la APK (Sentry/Crashlytics) con p00 anonimizado y log local rotativo.

#### H-16 — SLO de rendimiento sin medición, archivos de carga inexistentes y N+1 en MONITOREO
- **Contexto.** RNF-08 fija ingesta ≤ 5 min p95 para 20 000 filas, consultas de PANEL y despacho ≤ 2 s p95 con 30 usuarios concurrentes, y exige prueba de carga con dataset versionado; RNF-15 añade 20 000 casos/día con 3 años de histórico. No hay medición y el plan de pruebas excluye explícitamente la carga. Los archivos que la documentación cita como evidencia (`app/tests/test_d89_carga.py`, `app/tests/test_d95_carga.py`, «marcado lento») **no existen**. En el código el N+1 es real: `por_cuadrilla()` itera cuadrillas × 6 días llamando a `_por_dia_cuadrilla()`, que ejecuta 3 consultas → 18 por cuadrilla, ~180 viajes para 10 cuadrillas en una sola petición; `gestion_semanal()` repite 3 consultas por día. Sobre eso, Cloud Run y la base están en regiones distintas.
- **Evidencia.** `app/services/monitoreo.py:29,165-188,191-216,460-480`; `RepoTecnico/documento_tecnico_D89.md:458`; `RepoTecnico/documento_tecnico_D95.md:1147`; `RepoTecnico/pruebas/plan_pruebas.md:26-27`; `RepoTecnico/requerimientos.md:213,220`; `RepoTecnico/incremento_D95_apk_gestion.md:162`; `db/schema.sql:763-764`; `Test-Path app/tests/test_d95_carga.py` → `False`.
- **Impacto.** Los SLO son criterios que nadie ha verificado; la petición de MONITOREO escala mal y la latencia se multiplica por la distancia. **Necesita verificación:** existencia del índice GIN y del dataset en producción.
- **Recomendación.** Sustituir el doble bucle por una consulta con GROUP BY (cuadrilla, día) o vista materializada refrescada por mantenimiento; alinear regiones; crear el dataset versionado de 20 000 filas y el runner real (`app/tests/test_d95_carga.py`) con p95 por endpoint, 0 errores 5xx y 30 concurrentes, publicando informe por commit. Mientras no exista, marcar RNF-08/RNF-15/RNF-34 como «no verificado».

#### H-17 — CI inexistente que seis manuales describen; línea base no reproducible
- **Contexto.** El manual de pruebas y CI describe el workflow con detalle (disparadores, servicio `postgres:15`, pasos ruff/mypy/pytest, variables `GGTO_TEST_DB_URL`/`GGTO_TEST_SCHEMA`) y afirma que «en cada push corre ruff, mypy y pytest», pero **no hay `.github/`** (`Test-Path` → `False`) ni `*.yml` propio; el workflow existió y se borró en `d818bcb` (2026-10-06). `02-Dependencias/01-backend.md`, `02-stack-backend.md`, `03-stack-frontend.md` y `03-Implementacion/02-configuracion.md` repiten las citas con líneas exactas. RNF-24/RT-14 exigen CI con cobertura mínima 70 %, y no hay `pytest-cov` ni configuración de cobertura. Las cifras se contradicen: el informe declara 195 + 80 y «272 (195 + 77)»; el manual 169 + 46 = 215 y «trece archivos» cuando hay 30; hoy son 411 y 194. La corrida puede ser verde sin tocar la base: `conftest` usa `public` por defecto y hace `pytest.skip` si falta `GGTO_TEST_DB_URL`. Y el criterio «ruff/mypy/tsc sin hallazgos» no se cumple (ruff 6, mypy 1).
- **Evidencia.** `RepoTecnico/Manuales/04-Despliegue/04-pruebas-y-ci.md:20-24,335-359,366-401`; `Manuales/02-Dependencias/01-backend.md:523-531`; `Manuales/01-Tecnologia/02-stack-backend.md:65-67`; `Manuales/01-Tecnologia/03-stack-frontend.md:723`; `Manuales/03-Implementacion/02-configuracion.md:564`; `plan_desarrollo.md:416`; `estado_proyecto.md:55`; `git log --diff-filter=D -- .github/workflows/ci.yml` → `d818bcb`; `app/requirements-dev.txt`; `pyproject.toml`; `pytest.ini`; `pruebas/informe_fase4.md:18-19,112`; `app/tests/conftest.py:25,79`; ruff 6 / mypy 1.
- **Impacto.** Ninguna afirmación de «pipeline en verde» es reproducible por un tercero; 411 pruebas de API y 194 de APK dependen de ejecución manual; la cobertura no se mide; los manuales describen procedimientos inexistentes.
- **Recomendación.** Restaurar el workflow (`git show 44ca9e2:.github/workflows/ci.yml`) y ampliarlo a `tsc`+vite y `flutter analyze`+`flutter test`; añadir `pytest-cov --cov-fail-under=70`; hacer que la suite falle —no omita— sin base de pruebas; prohibir el esquema `public` por defecto; arreglar los 6 errores de ruff y el de mypy; publicar la línea base por commit en un único sitio; corregir los seis manuales.

#### H-18 — Contrato API desactualizado: cifras incompatibles y 18 operaciones sin documentar
- **Contexto.** `01-plataforma.md` afirma que «los diez módulos de rutas» son nueve, que hay «109 decoradores» y que OpenAPI expone «79 rutas y 109 operaciones»; `09-api-endpoints.md` afirma 117 paths, 150 operaciones y 154 decoradores, y sostiene que sus cifras están «verificadas con `app.openapi()`». Medido en este equipo: **172 decoradores** y `app.openapi()` = **132 paths / 168 operaciones**; `main.py` registra 16 routers, no once. El inventario no tiene sección para `routes_mensajes` (8 ops), `routes_sincronizacion` (4), `routes_sistemas` (4), `routes_auditoria` (1) ni `routes_panel` (1): **18 operaciones sin documentar**. El RBAC quedó pre-D-112: documenta `/casos/{id}/estado`, `/cierre`, `/cita`, `/no-contesta` y `/enrutado` como ADMIN/SUPERVISOR, mientras el código usa `_gestion = require_roles("ADMIN","SUPERVISOR","TECNICO")` por DEC-112-1.
- **Evidencia.** `Manuales/01-Tecnologia/01-plataforma.md:130-138`; `Manuales/03-Implementacion/09-api-endpoints.md:72-89,108-109,348-355`; `app/main.py:84-99`; `app/api/routes_casos.py:63,557,642,676,708,796,842`; medición local.
- **Impacto.** Quien siga el manual reintroduce el 403 al TÉCNICO que D-112 corrigió; no hay inventario fiable de la superficie de ataque ni del RBAC efectivo.
- **Recomendación.** Regenerar el inventario desde `app.openapi()` incluyendo la dependencia efectiva por ruta (rol concedido y denegado), unificar la cifra en ambos manuales y en `estado_proyecto`, y añadir una prueba de contrato que fije el snapshot de paths/operaciones y falle al cambiar un rol.

#### H-19 — El estado PENDIENTE no está modelado en DDL base, Pydantic, la web ni la APK
- **Contexto.** `schema.sql:322-324` crea el CHECK de `estado_actual` sin PENDIENTE y el bloque idempotente `:1049-1052` lo recrea incluyéndolo; `ESTADOS_CASO` y `EstadoCaso` no lo contemplan, el tipo de la web tampoco y el filtro de CASOS lo omite. En la APK, `accionesDeEstado` cae en `default: return {}` y `notasPorEstado` no tiene entrada. El impacto es operativo: el cierre de jornada devuelve casos a PENDIENTE, D-113 los reincorpora al universo de despacho y el despacho no toca `caso.estado_actual`, mientras la descarga solo excluye los terminales. Resultado: un caso PENDIENTE re-despachado llega al técnico y su ficha se abre sin ninguna acción y sin explicación; la bitácora reporta 54 casos en ese estado.
- **Evidencia.** `RepoTecnico/db/schema.sql:322-324` vs `:1049-1052`; `app/schemas/casos.py:11-21,29-32`; `app/web/src/api/types.ts:392-401`; `app/web/src/pages/Casos.tsx:31-39`; `app_movil/lib/features/casos/acciones_caso.dart:60-65,68-83`; `app/services/jornada.py:33,103`; `app/services/sync.py:46,471`; `app/services/despacho.py:536`; `estado_proyecto.md:526`.
- **Impacto.** El técnico recibe trabajo que no puede ejecutar; el catálogo de estados diverge entre capas y el flujo que D-113 reactivó queda roto en la última milla.
- **Recomendación.** Definir el catálogo de estados en un solo lugar (CHECK + enum compartido en schemas y `types.ts`) incluyendo PENDIENTE, darle acciones/nota y chip/filtro en APK y web, y documentarlo en el diccionario y en `04-panel-y-casos`.

#### H-20 — El 70* y el id de avería obligatorios impiden registrar el Referido sin incidencia
- **Contexto.** El brief usa el teléfono como contacto y clave de búsqueda y dice que los REFERIDOS «no poseen id de incidencia». D-89 convierte el 70* en el eje y RN-AL-01 exige 70* en todo alta manual/especial y `id_averia` + `tipo_problema` en toda REPARACIÓN, con 422. El esquema de casos especiales rechaza una REPARACION sin `id_averia`, el formulario web la bloquea y la prueba que dice «Referido sin id_averia» tiene que enviar un «REF-2324X-900010» inventado para pasar. La generación automática `generar_id_averia_ref` es inalcanzable para una REPARACION porque la validación falla antes; el docstring de `CasoManualCreate` admite que el camino del REF sintético «queda reservado a CONSTRUCCIÓN». El caso canónico del brief —Referido de Reparación de otra unidad, sin incidencia— no se puede registrar sin fabricar un ID y sin un 70* que la unidad externa puede no aportar; la regla D-90 de reclasificar a REFERIDO es inalcanzable desde el formulario.
- **Evidencia.** `BRIEF-GGTO-INICIAL.md:51,59`; `incremento_D89_identificador_pago.md:8,22-23,47`; `requerimientos.md:155,196`; `app/schemas/casos.py:129-143,180-201`; `app/schemas/especiales.py:121-131`; `app/web/src/components/ModalCaso.tsx:155-160`; `app/tests/test_especiales_api.py:117-124`; `app/api/routes_especiales.py:162-163`.
- **Impacto.** El flujo de referidos del cliente no se puede operar; se fuerza a inventar identificadores que contaminan la trazabilidad y las métricas por 70*.
- **Recomendación.** Hacer condicionales 70* e `id_averia` por tipo de caso: permitir REFERIDO/EMPRESA/GOBIERNO sin `id_averia` (generando REF-…) y sin 70* cuando el solicitante externo no lo aporte; separar D-90 de la validación de alta y obtener confirmación escrita de CANTV para el 70*.

#### H-21 — La «prueba de campo» de la APK no tiene oráculo
- **Contexto.** El integration_test recorre descarga, cierre con COS, cita, diferido y carga, y termina con `debugPrint` de los textos y del número de avisos «por enviar»: no hay ningún `expect`/`fail` sobre el resultado. Los únicos `fail` son por textos que no aparecen en pantalla. Si el botón CARGA no arranca en 15 s, el test llama directamente a `UploadService.cargar()`, es decir, se salta la interfaz que dice probar; y el criterio para considerar que «arrancó» es que cambien los cuatro primeros textos visibles, condición que satisface cualquier cambio de UI. `_volcarCola` solo imprime la cola local y las evidencias con `subida=`; nadie afirma que la cola quedó en 0 ni que el servidor quedó en CERRADO/CITADO/DIFERIDO. Además RNF-49 se enuncia con una sola corrida («~11 s», 11,6 s), sin p95 ni n≥30.
- **Evidencia.** `app_movil/integration_test/flujo_campo_test.dart:121-150,395,401-427`; `incremento_D112_prueba_campo_apk.md:138,166,199,211-212`.
- **Impacto.** RF-100/RF-101 los «cubre» una prueba que pasaría aunque la carga no surtiera efecto; la evidencia de campo es una transcripción manual, no una aserción.
- **Recomendación.** Cerrar la prueba con aserciones de resultado: estado de los 3 casos consultado por API, cola local con 0 pendientes, evidencias con `subida=1` y `sync_log` con `errores=0`; exigir que la carga se dispare desde el botón (sin fallback al servicio) y expresar RNF-49 con p95 y n≥30 repeticiones.

#### H-22 — RNF-09 y RNF-43 no son medibles ni medidos
- **Contexto.** RNF-09 sí tiene cifras (≤ 3 toques y ≤ 20 s para CONTACTAR→CONTACTADO/DIFERIDO, ≤ 10 s para encontrar la ficha, ≤ 60 s el alta), pero el RNF nuevo del catálogo (RNF-43) reintroduce la ambigüedad: exige «publicar el despacho en ≤ N toques y ≤ T s» y «localizar un caso de la cuadrilla 0 en ≤ T s», con N y T sin valor en ningún documento. La validación con 3–5 supervisores/coordinadores reales figura como «⛔ Pendiente de coordinar con CANTV». El plan asigna RNF-09 a E2E-02 y E2E-11, pero E2E-02 solo comprueba rutas y encabezados: en ninguna de las 27 specs hay medición de tiempo ni de toques. La única «prueba de campo» (D-112) es automatizada en emulador Android 15 con cuentas sembradas y fotos de internet: destapó defectos reales, pero no mide toques ni tiempos y no usa usuarios humanos.
- **Evidencia.** `RepoTecnico/requerimientos.md:214`; `incremento_D95_apk_gestion.md:171`; `plan_desarrollo_D95_D98.md:163`; `pruebas/plan_pruebas.md:67,97`; `e2e/tests/02-navegacion.spec.js:23-40`; `incremento_D112_prueba_campo_apk.md:41-59`; `propuesta_mejora_apk.md:487`; `estado_proyecto.md:131`.
- **Impacto.** Un criterio con N y T en blanco no es contrastable, y uno con cifras no tiene prueba que lo mida; la usabilidad no se puede certificar.
- **Recomendación.** Sustituir N y T por valores acordados con CANTV; escribir el protocolo de la prueba de usabilidad (3-5 usuarios, dispositivo de campo, a una mano, sin red) con media y p95 de tiempo y toques, ejecutarlo y adjuntar informe; mientras tanto no trazar RNF-09/RNF-43 a E2E-02/E2E-11, que no los miden.

#### H-23 — La cabecera del estado del proyecto contradice la bitácora
- **Contexto.** `estado_proyecto.md:7-13` declara «GGTO V2 EN DEFINICIÓN E IMPLEMENTACIÓN PARCIAL», que la APK multirol «no está implementada», que D-89…D-95 «no están publicados ni desplegados», última actualización 2026-10-12, HEAD `d140af5` y revisión `00039-g9n`/v24; la línea 15 afirma que esa tabla «describe el estado vigente». Las filas 520-526 documentan D-111…D-113 publicados y desplegados, APK 1.12.0+21 y revisión `ggto-web-00060-lrm`/v47 al 2026-10-19, y el HEAD real es `7c10086`. `requerimientos.md:21` sigue diciendo que el código de la APK está en 1.1.0+9. El «informe vigente» enlazado (`auditoria_estado_real_v2.md:3,7`) es del 2026-10-13 y sentencia «no está entregado» y «no se generó un APK». El árbol de la APK tiene 14 módulos de features, lo que desmiente el «no está implementada».
- **Evidencia.** `estado_proyecto.md:7-15,522-526`; `requerimientos.md:21`; `auditoria_estado_real_v2.md:3,7`; HEAD `7c10086`; `app_movil/lib/features/` (14 directorios); `pubspec.yaml:5`; `constants.dart:15`.
- **Impacto.** El primer lector —incluido un auditor o CANTV— recibe un estado falso: niega entregas certificadas por la propia bitácora y oculta riesgos reales (backups, revisión desplegada).
- **Recomendación.** Generar la cabecera desde la última fila de la bitácora/commit en lugar de escribirla a mano, añadir a cada fila un campo «verificado el», mover `auditoria_estado_real_v2.md` a histórico o reemitirlo con corte posterior a D-113 y corregir `requerimientos.md:21`.

#### H-24 — Producción con PII sin dueño de DBA/SRE, seguridad ni proveedor cloud
- **Contexto.** El §5.3 asigna catálogos, flota, insumos, dueño del CSV, dueño funcional del COORDINADOR, soporte 1.º/2.º nivel, auditoría interna, protección de datos, auditoría del COORDINADOR y custodia del keystore, pero no hay fila para DBA/SRE, oficial de seguridad, respuesta a incidentes ni proveedor cloud. El riesgo D-26 lo firma la «Dirección del proyecto» y los planes de acción encargan tareas a «DBA/DevOps», un rol que no existe en el organigrama. RNF-16 exige backups diarios, PITR, RPO ≤ 24 h, RTO ≤ 4 h y prueba de restauración trimestral sin responsable asignado. Tampoco hay DPA cerrado con Google: el manual de seguridad muestra todos los DPA «Pendiente de confirmar», incluido Google Cloud, con la transferencia internacional sin evaluar.
- **Evidencia.** `requerimientos.md:221,223,340-355`; `estado_proyecto.md:12-13,120,151,526`; `Manuales/07-Operacion/02-seguridad-y-privacidad.md:418-432`; `INFORME_OPTIMIZACION_V1.md:191,411,419`.
- **Impacto.** Nadie responde por la recuperación, la seguridad ni el proveedor; el riesgo aceptado queda sin dueño y sin criterio de cierre.
- **Recomendación.** Nombrar DBA/SRE (backup, PITR, RTO/RPO y simulacro), oficial de seguridad (runbook de incidentes, rotación de `SECRET_KEY`) y responsable del DPA con Google; reflejarlos en §5.3 con criterios de aceptación y fecha.

---

## 6. RNF faltantes (ISO 25010) y stakeholders faltantes

### 6.1 Categorías y RNF ausentes

| Categoría ISO 25010 | Hueco | Evidencia / hallazgo |
|---|---|---|
| **Seguridad — cadena de suministro** | No hay requisito de firma verificable, fijación de firma (pinning), SBOM ni escaneo de secretos | H-03, H-09, H-44 |
| **Seguridad — gestión de secretos** | No hay RNF de custodia, rotación y doble control de secretos (solo una mención de 90 días en `GGTOv2_GCP.md:427`) | H-03, H-10 |
| **Seguridad — ciclo de vida de sesión** | No se exige revocación de JWT, bloqueo progresivo ni auditoría de recuperación | H-04, H-08, H-26 |
| **Fiabilidad — continuidad** | No hay RNF de plan de contingencia con RTO/RPO medidos ni de instancia multi-zona | H-12, H-24 |
| **Fiabilidad — restauración verificada** | RNF-16 pide prueba trimestral, pero no hay requisito de evidencia ni de RTO demostrado | H-29, H-01 |
| **Privacidad / cumplimiento** | No hay RNF de base legal, DPA, aviso de privacidad ni derechos del titular | H-01, H-25, H-24 |
| **Observabilidad** | RNF-19 no exige alertas, uptime, retención de logs ni crash reporting de la APK | H-15, H-11 |
| **Mantenibilidad — migraciones** | RNF-24 menciona Alembic, pero no hay requisito de versionado ni de rollback probado | H-27 |
| **Portabilidad / reproducibilidad** | RNF-25 no exige lockfiles con hash, digest de imagen ni paridad de versiones verificada | H-28 |
| **Compatibilidad** | No hay requisito de versionado de contrato de API ni de catálogo único de estados | H-18, H-19 |
| **Eficiencia de desempeño** | RNF-08/15/34 no tienen metodología de medición ni dataset de referencia versionado | H-16 |
| **Usabilidad / accesibilidad** | RNF-09 y RNF-23 carecen de protocolo de medición y de umbrales cerrados | H-22, H-35 |
| **Integridad / auditoría** | No hay RNF de auditoría append-only, no repudio ni cobertura de eventos críticos | H-26 |
| **Calidad de datos** | No hay RNF de validación de ingesta, linaje ni detección de PII en repositorios y logs | H-01, H-25 |
| **Testabilidad** | No hay RNF de puerta de calidad con cobertura medida ni de línea base reproducible | H-17 |

### 6.2 Stakeholders faltantes o sin rol efectivo

| Actor faltante | Rol que debería tener | Consecuencia hoy | Hallazgo |
|---|---|---|---|
| **Suscriptor / abonado** (titular de los datos) | Sujeto de derechos: acceso, rectificación, supresión, aviso de privacidad | No existe como actor ni tiene canal; solo recibe una llamada del técnico | H-01 |
| **Responsable de protección de datos (DPO)** | Base legal, DPA, evaluación de transferencia y atención de derechos | «Pendiente de designar» con PII real en producción | H-01, H-24 |
| **DBA / SRE** | Backup, PITR, RTO/RPO, capacidad, migraciones, simulación de desastres | Sin dueño; las tareas se asignan a un rol inexistente | H-24, H-12, H-29 |
| **Oficial de seguridad / respuesta a incidentes** | Runbook, rotación de claves, gestión de brechas | Sin rol; los incidentes no tienen responsable | H-24 |
| **Custodio de secretos (titular y suplente)** | Custodia del keystore y de las claves de canal, doble control por release | La contraseña está pública y las claves son legibles por cualquier rol | H-03 |
| **Proveedor cloud (Google)** | DPA, transferencia internacional, SLA y responsabilidades compartidas | DPA «Pendiente de confirmar»; transferencia sin evaluar | H-24, H-01 |
| **NOC / operaciones de red** | Destinatario nominal de alarmas, acuse y escalado | Destinos de aviso vacíos; la alerta queda «Sin destinatario» | H-32, H-11 |
| **Mesa de ayuda / soporte con SLA** | Canal, niveles, horario y registro de tickets | Soporte «informal por correo»; sin tickets ni SLA | H-32 |
| **Auditor independiente (rol AUDITOR)** | Lectura de auditoría separada de la cuenta con acceso total | Solo el SUPER lee; no hay separación de funciones | H-26 |
| **Validador del CRASS** | Validación real de la reparación con identidad y constancia | Se registra una fila sin que esa persona interactúe | H-40 |
| **Solicitante externo (ACT-03)** | Alta de casos especiales por el canal previsto y notificación de cierre | No puede reportar ni recibe aviso | H-41 |
| **Supervisor de cuadrilla** | Validar cierres y ver casos de su cuadrilla | El valor existe en datos y no otorga permisos ni pantalla | H-46 |
| **Release manager / responsable de firma y distribución** | Versionado, firma, checksum y promoción del APK | Firma en debug posible, `versionCode` sin verificar, APK fuera de git | H-28, H-44, H-03 |
| **Comité de aceptación de CANTV** | Aprobar cambios de requisitos y alcance | Se añadieron roles, 70*, PIN, auto-actualización y se quitó el ZIP sin constancia | H-10, H-20, H-42, H-44, H-37 |

---

## 7. Plan de acción

### 7.1 Quick wins (≤ 1 semana)

| ID | Acción | Responsable sugerido | Esf. |
|---|---|---|---|
| H-01 (parcial) | Restringir el invocador (`allUsers` fuera), retirar el APK público, activar `deletionProtectionEnabled` y `sslMode=ENCRYPTED_ONLY` | SRE + Seguridad | S |
| H-02 | *Fail-closed* en MCP y webhook + secretos en Secret Manager + tests negativos | Backend | S |
| H-03 (parcial) | `git rm --cached` de `key.properties*`, escáner de secretos sobre todo el historial, inicio de rotación | Seguridad + Release | S |
| H-04 | Rate limit, bloqueo progresivo, posiciones no repetidas, auditoría y revocación de JWT en unlock/reset | Backend + Seguridad | S |
| H-05 (parcial) | `/evidencias/upload` fail-closed sin bucket y montaje de `/evidencias-locales` solo fuera de producción | Backend | S |
| H-08 | Respuesta uniforme en primer acceso y código de un solo uso en `setup` | Backend | S |
| H-17 (parcial) | Restaurar `.github/workflows/ci.yml` desde `44ca9e2` y bloquear el merge con él | DevOps | S |
| H-18 | Regenerar el inventario desde `app.openapi()` y corregir el RBAC documentado | Backend docs | S |
| H-19 | Añadir PENDIENTE al catálogo, tipos, filtro y acciones de la APK | Backend + Web + APK | S |
| H-23 | Regenerar la cabecera de `estado_proyecto.md` desde la bitácora | Dirección técnica | S |
| H-33 | Fijar con CANTV el umbral de falla masiva y las reglas deterministas | Producto + CANTV | S |
| H-45 | Corregir «Gestión»/«sí» y añadir regla de lint contra «Ã» | Web | S |
| H-46 | Decidir si el supervisor de cuadrilla es actor o se retira | Producto | S |

### 7.2 Mejoras (≤ 1 mes)

| ID | Acción | Responsable sugerido | Esf. |
|---|---|---|---|
| H-01 | Base legal, DPA, aviso de privacidad, DPO y purga/anonimización por entidad | Dirección + Legal + CANTV | M |
| H-03 | Rotación de keystore, purga del historial en GitHub y GitLab, lista blanca de configuración | Seguridad + Release | M |
| H-06 | Escapado HTML, CSP/HSTS/XFO, JWT fuera de `localStorage` y prueba de XSS | Web + Backend | M |
| H-07 | Acotado por cuadrilla/central, filtro de notificaciones, destinatario permitido y pruebas negativas A↔B | Backend + QA | M |
| H-09 | Eliminar PIN de fábrica, `allowBackup=false`, cifrado local, `applicationId` propio | APK | M |
| H-10 | MFA para ADMIN/SUPERVISOR/SUPER y SUPER acotado por central | Backend + Seguridad | M |
| H-11 | Cloud Scheduler + `MANTENIMIENTO_TOKEN` + outbox cada 2-5 min + credenciales y envío real | SRE + Backend | M |
| H-13 / H-14 | Clave de idempotencia + `ON CONFLICT`, respuestas por acción y control de versión con 409 | Backend + APK | M |
| H-15 | Logs JSON, alertas, uptime y crash reporting | SRE + APK | M |
| H-16 | Eliminar N+1, alinear regiones y ejecutar la prueba de carga con dataset de 20 000 filas | Backend + QA | M |
| H-17 | Cobertura `--cov-fail-under=70`, jobs de web/APK, `set -e` sin base, ruff/mypy a cero | DevOps + QA | M |
| H-21 / H-22 | Oráculo de la prueba de campo y estudio de usabilidad con 3-5 técnicos | QA + Producto | M |
| H-25 / H-26 | Purga y anonimización por entidad, enmascaramiento por rol, auditoría de eventos críticos y rol AUDITOR | Backend + Seguridad | M |
| H-27 / H-29 | Alembic con baseline, conciliación 42/43 tablas y restauración documentada | DBA/SRE | M |
| H-28 | Lockfiles con hash, digest de imagen, promoción por digest y `versionCode` verificado | DevOps | M |
| H-31 / H-32 | Cierre de jornada por job y alerta de despacho vencido; soporte con canal y SLA | SRE + Operaciones | M |
| H-34 / H-35 | Pruebas de cámara/galería y `FLAG_SECURE`; axe en E2E y `textScaler` en la APK | APK + Web QA | M |
| H-36 / H-37 / H-38 | Catálogo único de requisitos, renumeración controlada y manuales regenerados | Dirección técnica | M |
| H-39 / H-40 / H-41 / H-42 / H-43 / H-44 | Aserciones E2E, CRASS validado en servidor, solicitante externo, decisión del ZIP, vista SEGUIMIENTO y modelo de amenaza de la auto-actualización | Producto + QA | M |

### 7.3 Roadmap (≥ 1 trimestre)

| ID | Acción | Responsable sugerido | Esf. |
|---|---|---|---|
| H-12 | Migración a Cloud SQL REGIONAL propia en `southamerica-east1` (o Cloud Run en la región de la BD), IP privada, Connector y pooler | SRE + Plataforma | L |
| H-27 | Migraciones versionadas completas y baseline conciliado con producción | DBA/SRE | L |
| H-24 | Organigrama operativo: DBA/SRE, seguridad, DPO, DPA y plan de continuidad | Dirección | M |
| H-10 | MFA y separación de funciones con auditoría independiente (si se mantiene el SUPER) | Seguridad | L |
| H-17 / H-28 | Pipeline de entrega completo (CI/CD, firma en CI, SBOM, promoción con aprobación y rollback probado) | DevOps | L |
| H-01 | Programa de cumplimiento y gobernanza de datos con CANTV (base legal, retención, derechos, auditoría) | Legal + CANTV | L |
| H-16 / H-22 | Programa recurrente de rendimiento y usabilidad con umbrales y evidencia por release | QA + Producto | L |

**Secuencia recomendada:** (1) contener la exposición (H-01, H-02, H-03, H-04, H-05) y restaurar el CI; (2) demostrar aislamiento y corregir la última milla de la APK (H-07, H-08, H-09, H-13, H-14, H-19); (3) dotar de operación real (H-11, H-15, H-27, H-29, H-31); (4) reconciliar documentación y requisitos (H-17, H-18, H-23, H-36, H-37); (5) migrar infraestructura y cerrar el modelo legal (H-01, H-12, H-24).

---

## 8. Criterios de aceptación para la siguiente versión (V3)

Cada criterio es medible y verificable por un tercero con el repositorio y el entorno de solo lectura.

1. **Canales externos cerrados:** 100 % de los endpoints de integración responden 503/403 sin secreto; existen pruebas negativas en CI y pasan. *(H-02)*
2. **Secretos saneados:** `gitleaks`/`trufflehog` sobre el historial completo devuelve 0 hallazgos; la contraseña del keystore ha sido rotada; el `.jks` está fuera del disco de trabajo con custodio titular y suplente; `/configuracion` no devuelve secretos a roles no autorizados. *(H-03)*
3. **Recuperación de cuenta:** unlock/reset limitados a ≤ 5 intentos/15 min con bloqueo, auditoría de cada intento, respuesta uniforme y revocación de JWT al cambiar clave o rol; la prueba de fuerza bruta falla. *(H-04)*
4. **Producción con PII legal y recuperable:** base legal y DPA firmados, aviso de privacidad publicado, responsable designado, `deletionProtectionEnabled=true`, `sslMode=ENCRYPTED_ONLY` y una restauración completa documentada con RTO ≤ 4 h y RPO ≤ 24 h. *(H-01, H-29)*
5. **Evidencia sin pérdida:** 0 evidencias perdidas en dos reciclajes de revisión; `/evidencias/upload` responde 503 sin bucket; URLs firmadas; conciliación de huérfanas en verde. *(H-05)*
6. **RBAC demostrado:** pruebas negativas «central A → caso de B = 403/404» y «técnico A → caso de cuadrilla B = 403» en el 100 % de las rutas de casos, notificaciones y despachos, con la RLS ejercida de verdad. *(H-07)*
7. **XSS cerrado:** una prueba con `<script>` en dirección no ejecuta código; CSP, HSTS, `X-Frame-Options` y `nosniff` presentes; el JWT no vive en `localStorage`. *(H-06)*
8. **Alta de cuentas:** imposible preregistrar una cuenta ajena; respuesta de primer acceso uniforme; `setup` no sobrescribe el correo existente. *(H-08)*
9. **APK endurecida:** sin PIN de fábrica, `allowBackup=false`, base local cifrada, `applicationId` propio y build de release que falla sin keystore. *(H-09)*
10. **Roles y MFA:** MFA activo para ADMIN/SUPERVISOR/SUPER; roles extra aprobados por escrito por CANTV o retirados; SUPER acotado por central o riesgo aceptado formalmente. *(H-10)*
11. **Operación programada:** 5 jobs de Cloud Scheduler con 200 verificado, outbox procesado en < 5 min y un envío real de Telegram y correo de extremo a extremo. *(H-11)*
12. **Rendimiento medido:** dataset versionado de 20 000 filas; ingesta ≤ 5 min p95, PANEL y despacho ≤ 2 s p95 con 30 concurrentes, 0 errores 5xx; N+1 eliminado. *(H-16)*
13. **Puerta de calidad:** un clon limpio pasa CI con ruff 0, mypy 0, `pytest` ≥ 411 con cobertura ≥ 70 %, `tsc`+vite y `flutter analyze`+`flutter test`; el pipeline falla sin base de pruebas. *(H-17)*
14. **Contrato de API fijado:** snapshot de 132 paths/168 operaciones (o el valor vigente) y RBAC por ruta documentado; 0 operaciones sin documentar. *(H-18)*
15. **Estados completos:** PENDIENTE en DDL base, schemas, `types.ts`, filtros y acciones de la APK, con prueba de caso re-despachado. *(H-19)*
16. **Referido registrable:** alta de REFERIDO/EMPRESA/GOBIERNO sin 70* ni `id_averia` cuando no existan, con `REF-` generado; prueba de aceptación. *(H-20)*
17. **Prueba de campo con oráculo:** estado del servidor afirmado por API, cola local en 0, evidencias `subida=1`, `sync_log` con 0 errores, sin fallback al servicio; RNF-49 con p95 y n ≥ 30. *(H-21)*
18. **Usabilidad medida:** estudio con 3-5 técnicos en dispositivo real, sin conexión y a una mano, con informe de media y p95 de toques y tiempos que cumpla RNF-09 y RNF-43 con N y T cerrados. *(H-22)*
19. **Requisitos gobernados:** un único registro RF/RNF/RT sin IDs duplicados, con origen, aprobación de CANTV, hito, fecha, estado y evidencia; matriz de trazabilidad al 100 %. *(H-36, H-37)*
20. **Accesibilidad medida:** `@axe-core/playwright` con 0 violaciones críticas/serias en las pantallas principales; APK con `textScale` 2.0 sin desbordes y cuerpo ≥ 16 sp. *(H-35)*
21. **Retención y auditoría:** purga/anonimización por entidad con prueba por entidad, auditoría a 3 años, enmascaramiento por rol en los serializadores y traza de logins fallidos, recuperaciones, cierres, despachos, ingestas y envíos. *(H-25, H-26)*
22. **Documentación verdadera:** 0 citas a archivos inexistentes, 0 referencias a `.github/` si no existe, conteos derivados del sistema de archivos y cabecera de estado generada desde la bitácora. *(H-17, H-23, H-38)*
23. **Continuidad:** plan de contingencia con RTO/RPO medidos, alertas de conexiones/CPU/disco y responsable nominal. *(H-12, H-24)*
24. **Entrega reproducible:** imágenes por digest, tag inmutable, APK construida en CI con firma desde Secret Manager, `versionCode` creciente verificado y lockfiles con hash. *(H-28)*

---

## 9. Anexo

### 9.1 Hallazgos descartados por dimensión (resumen y motivo)

| Dim. | Hallazgo descartado / ajustado | Motivo |
|---|---|---|
| R1 | RNF-23 (WCAG y ≥ 48 dp / 4.5:1 / 16 sp / lector) «no verificado con ninguna medición» | **Evidencia desmentida:** `d101_listado_y_ficha_test.dart:143-173` calcula luminancia WCAG y afirma contraste ≥ 4.5:1, y `d109`/`d111` afirman etiquetas de accesibilidad. Se conservó solo la parte que resiste: ausencia de auditoría WCAG automatizada en la SPA (H-35) |
| R1 | RNF-16/17/19 «exigen pruebas que no existen» | **Error de hecho:** `/health` y `/ready` existen en `routes_health.py:28-35` y se registran en `main.py:84`; el núcleo (backups/monitoreo) ya se reporta en H-01/H-15 y el respaldo estaba mal caracterizado |
| R1 | «100 % de pruebas en verde no es auditable» | **Fusionado** con el hallazgo de CI y línea base (H-17); el contenido verificado se conserva íntegro |
| R2 | `.gitignore` no desversionó `key.properties.bak` ni `key.properties.temporal-debug` | La premisa «la documentación da la remediación por cerrada» es falsa: `estado_proyecto.md:496` declara la deuda abierta. El riesgo se conserva en H-03 |
| R2 | El manual de Cloud Run presenta la revisión 00014/v14 como dato «verificado» | La parte de «valor verificado» no se confirma: el manual advierte que no es lectura en vivo. Solo subsiste el desfase y la cita rota (H-29) |
| R2 | Cifra exacta «39 de 132 paths sin documentar» | **No reproducible** sin fijar criterios de normalización; se sustituyó por evidencia verificable: 18 operaciones en 5 routers (H-18) |
| R2 | «El inventario de API no cubre `routes_sync`» | **Falso positivo parcial:** `09-api-endpoints.md:621-693` sí documenta la sincronización móvil; solo faltan mensajes, sincronizaciones, sistemas, auditoría y panel (H-18) |
| R3 | Disponibilidad RNF-17 (99 % en horario operativo) | **Duplicado** de observabilidad (H-15); el arranque en frío con `min-instances 0` no tiene impacto cuantificado ni medición que pruebe incumplimiento |
| R3 | Cinco tablas del DDL sin modelo ORM y desfase 42/37/43 | Evidencia verificada pero **impacto bajo**; se conserva como evidencia dentro de H-27 |
| R4 | Registro de actores «6 actores» frente a 7 | **Desactualizado y solapado:** el suplente del Supervisor ya está resuelto por DEC-G15 y el resto se trata en H-01, H-24 y H-32; solo queda una errata de conteo |
| R4 | Cita «`09-api-endpoints.md:573` publica los canales como Público» | **Cita errónea** (la línea 573 es un ítem de errores 422); la afirmación se verificó en `:451-452` y `:665-667` y así se corrigió en H-02 |
| R5 | «Manuales y RNF-24 citan un CI y migraciones Alembic que no existen» | Cierto pero **no es requisito del brief** y una cita era errónea; se remite a consistencia (H-17, H-27) |
| R5 | Cuadrilla 0 inerte y `MODO_POR_DEFECTO='UNION'` contra la semilla `SUPERVISOR` | **Decisión documentada y pedida por el usuario (D-59)**; defecto de robustez de baja prioridad, sin impacto cuando la configuración existe |
| R6 | Outbox sin despachador automático | **Deduplicado** con H-11 (misma causa raíz); la parte de canales sin credenciales se conserva allí |
| R6 | «Un rechazo persistente genera un bucle de reenvío cada minuto» | **Sub-afirmación falsa:** el lote solo se envía al pulsar CARGA; el autoenvío de 5 min usa la cola clásica con backoff y máximo de 5 intentos. Se conserva el defecto real de idempotencia (H-13) |
| R6 | «El reintento duplica filas del histórico de estados» | **Parcialmente falso:** `_registrar_estado` no escribe si el estado no cambió; lo que se duplica es la fila de `actividad` (H-13) |
| R6 | «El aviso ESTADO_SYNC se emite tras el commit y el rollback deja el mensaje sin traza» | **La traza existe** (`logger.exception` en `sync.py:862-864`) y el commit ya ocurrió; sin impacto verificable suficiente |
| R6 | «El `.jks` está sin custodia ni respaldo verificados» | **No verificable:** está en carpeta ignorada y no se publica (404); se degradó a advertencia dentro de H-03 |
| R7 | CORS refleja cualquier origen con credenciales y `APP_ENV=development` | **Confirmado pero descartado del informe priorizado:** la API usa Bearer, no cookies, y `APP_ENV` solo alimenta un campo informativo. Queda como endurecimiento recomendado (fijar `CORS_ORIGINS`, `allow_credentials=False`, `APP_ENV=production`) |
| R7 | Rate limiting «en memoria» como hallazgo propio | **Duplicado** de H-04 (se cita allí como agravante) |

**Resumen de descartes:** 13 hallazgos descartados (2 R1, 2 R2, 2 R3, 1 R4, 2 R5, 2 R6, 2 R7), 1 fusionado adicional en R4 y 3 sub-afirmaciones retiradas o degradadas en R6; varias citas se corrigieron sin eliminar el hallazgo. **Ninguno de los hallazgos descartados se usa como evidencia de un ID del informe sin haber sido reformulado.**

### 9.2 Trazabilidad de la consolidación

- 84 hallazgos recibidos → 70 supervivientes → **46 IDs únicos**.
- Fusiones cruzadas principales: H-01 (R3+R4+R7), H-02 (R4+R7), H-03 (R4+R6+R7), H-07 (R1+R4+R7), H-11 (R5+R6), H-16 (R1+R3), H-17 (R1+R2+R3), H-22 (R1+R3), H-23 (R2+R5), H-26 (R4+R7), H-27 (R2+R3), H-28 (R3+R6), H-29 (R2+R6), H-35 (R1+R3), H-36 (R1+R2), H-37 (R2+R5), H-05 (R6+R7), H-09 (R5+R7).
- Un hallazgo (R7-F8, cobertura RBAC) aportó evidencia a dos IDs distintos: H-03 (secretos en `/configuracion`) y H-07 (notificaciones y destinatario).

### 9.3 Limitaciones de la auditoría

1. **Solo lectura.** No se modificó ningún artefacto del proyecto ni del entorno; solo se escribió este informe.
2. **No se consultó PII de producción.** No se invocó `consultar_caso` ni se accedió a la base; la existencia de 42 casos con PII consta en la documentación y en la bitácora, no verificada fila a fila.
3. **Estado en vivo mutable.** Las comprobaciones con `gcloud` y los `GET` a producción son del 2026-10-19 y pueden haber cambiado; se indica la fecha en cada evidencia en vivo.
4. **Sin ejecución de pruebas ni builds por el sintetizador.** Las métricas de `pytest`, `flutter test`, `analyze`, `tsc`/`vite` y lint son las reportadas por el equipo en la corrida del 2026-10-19; no se repitieron en esta fase.
5. **Sin medición de cobertura**, sin prueba de carga y sin restauración ejecutada; esos huecos se reportan como tales y no como hallazgos.
6. **Sin acceso al binario publicado** ni a los valores de los secretos; firma y contenido quedan como «necesita verificación».
7. **Conteos con pequeñas divergencias entre dimensiones** (26 vs 27 specs E2E; 101 vs 102 archivos Python; 69 vs 87 Dart según se cuente solo `lib/` o también pruebas): se usó el conteo medido en el árbol y se anota la divergencia donde importa.
8. **Regla de descarte aplicada.** Ante evidencia no reproducible se prefirió retirar el hallazgo antes que arrastrarlo; el Anexo deja constancia para que la próxima auditoría pueda reabrirlo si cambian las condiciones.

---

*Fin del informe V2. Los hallazgos H-01…H-46 se sostienen con la evidencia citada; cualquier afirmación marcada «necesita verificación» requiere comprobación adicional antes de usarse como criterio de cierre.*
