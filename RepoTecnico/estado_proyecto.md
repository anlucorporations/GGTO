# Estado del Proyecto — GGTO

| Campo | Valor |
|---|---|
| Proyecto | **GGTO** — Sistema de administración de reportes de avería y construcción de puntos ópticos |
| Cliente | **CANTV C.A.** — Central **Francisco Salias (Área 4)** |
| Fase actual | **Fase 5 — Manuales: COMPLETADA** · pendiente la confirmación del usuario para cerrar el proyecto |
| Última actualización | 2026-09-28 |
| Rama git | `GGTOv2-DSH-GCP` · publicada en GitHub y GitLab |
| Informe de auditoría | `INFORME_OPTIMIZACION_V1.md` (43 hallazgos iniciales; todos con decisión registrada) |
| Decisiones | **D-01…D-63** |
| Infraestructura | GCP `ggtov2` + PostgreSQL (instancia compartida `truekeate-db-dev`) |
| Pendientes externos | ⚠️ **Restringir el acceso público** (ya hay PII real) · firma del contrato de interfaz por CANTV · designar responsables de datos y del sistema origen · desbloquear facturación GCP (migrar `ggto-web` a `ggtov2`) · restringir el acceso público de `ggto-web` |

> Memoria de trabajo del proyecto. Se actualiza de forma incremental, sin recargar todo el contexto.

---

## 1. Resumen de avances

- [x] Brief `BRIEF-GGTO-INICIAL.md` analizado (124 líneas, 4 secciones: OBJETIVO, CONTEXTO,
  GENERALIDADES, DETALLE, PROCEDIMIENTOS).
- [x] Muestra de datos `detalle_averias_gpon 12_09_2026.csv` inspeccionada: **80 columnas**,
  delimitador `;`, 56 registros, encabezados duplicados (`informacion` ×2, `descripcion` ×3).
- [x] Contexto GCP revisado (`GGTOv2_GCP.md`, `.env.global`, `gcp-env.sh`, scripts).
- [x] `requerimientos.md` generado (38 RF, 25 RNF, 14 RT, 6 actores, 10 secciones + 7 módulos funcionales, trazabilidad).
- [x] `diccionario_datos.md` generado (33 entidades lógicas → 35 tablas física; mapeo de las 80 columnas del CSV).
- [x] `entornos_globales.md` generado (GCP, PostgreSQL, variables, comandos, stack propuesto).
- [x] Entrevista Fase 1 respondida (bloques 1–5, respuestas en §5).
- [x] Repositorios GitLab/GitHub definidos (rama `GGTOv2-DSH-GCP`).
- [x] Configuración GCP confirmada (base `ggtov2` en `truekeate-db-dev`, despliegue local).
- [x] `modelo_er.md` y `db/schema.sql` generados (7 diagramas Mermaid, 35 tablas).
- [x] Auditoría de Fase 1 ejecutada → `INFORME_OPTIMIZACION_V1.md` (4 CRÍTICOS, 14 ALTOS).

---

## 2. Artefactos generados en `RepoTecnico/`

| Archivo | Contenido | Estado |
|---|---|---|
| `BRIEF-GGTO-INICIAL.md` | Brief original del cliente (entrada). | Recibido |
| `GGTOv2_GCP.md` | Habilitación de infraestructura GCP. | Existente |
| `detalle_averias_gpon 12_09_2026.csv` | Muestra del archivo matriz diario (80 cols). | Recibido |
| `scripts/*.sh` | Aprovisionamiento GCP (13 scripts). | Existente |
| `requerimientos.md` | RF/RNF/RT, actores, módulos, trazabilidad. | **v0.1** |
| `diccionario_datos.md` | Entidades, campos, mapeo CSV. | **v0.1** |
| `entornos_globales.md` | Configuración, rutas, variables, comandos. | **v0.1** |
| `modelo_er.md` | Diagrama Entidad-Relación completo en Mermaid (7 diagramas). | **v0.1** |
| `db/schema.sql` | Script DDL PostgreSQL (35 tablas + índices + triggers + datos iniciales). | **v0.1** |
| `muestras/detalle_averias_gpon_EJEMPLO.csv` | Muestra **pseudonimizada** (56×80, ISO-8859-1) para pruebas de ingesta. | **v1** |
| `INFORME_OPTIMIZACION_V1.md` | Auditoría de Fase 1 (7 lentes + verificación adversarial). | **V1** |
| `interfaz_csv_origen.md` | Contrato de interfaz del archivo diario con el sistema origen CANTV. | **v0.1** |
| `plan_desarrollo.md` | Plan de desarrollo vertical (10 ciclos) y bitácora de avance. | **v1.0** |
| `metricas.md` | Definición formal de las métricas de MONITOREO y REPORTES. | **v1.0** |
| `../app/` | Backend FastAPI + web React (Ciclos 1–7 y 9) con pruebas y CI. | **v0.9.0** |
| `pruebas/` | Plan de pruebas, semilla E2E, suite Playwright e informe de la Fase 4. | **v1.0** |
| `Manuales/` | 22 manuales técnicos por tema → sección → sub-sección, con citas `ruta:línea` al código real. | **v1.0** |
| `../docs/Manuales/` | 22 manuales literales (mismo árbol), HTML estilizado y PDF descargable. | **v1.0** |
| `../docs/imagenes/` | Diagramas e infografías de los manuales (SVG + PNG). | **v1.0** |
| `estado_proyecto.md` | Este archivo. | **v0.1** |

---

## 3. Decisiones tomadas

| # | Decisión | Origen |
|---|---|---|
| D-01 | Base de datos **PostgreSQL** (no hoja de Excel). | Contexto del brief + `GGTOv2_GCP.md` |
| D-02 | Proyecto GCP **GGTOv2** (`ggtov2`) como destino de despliegue. | `GGTOv2_GCP.md` |
| D-03 | Reutilizar la instancia PostgreSQL `truekeate-db-dev` (base `ggtov2`) mientras se resuelve la facturación. | `GGTOv2_GCP.md` §6.5 |
| D-04 | Mapeo del CSV **por posición de columna** (encabezados duplicados). | Análisis del archivo |
| D-05 | Identificador de deduplicación de casos: **`id_averia`** (único **global**). | Brief, procedimiento 1 |
| D-06 | Diseño **multi-central** desde el inicio; v1 opera Francisco Salias. | Entrevista P1.1 |
| D-07 | **Sector** definido por el supervisor (nombre + lista de direcciones/alias); asignación por coincidencia sobre `direccion` del CSV. | Entrevista P1.2 |
| D-08 | Catálogo de **causas** se puebla desde el propio CSV. | Entrevista P1.3 |
| D-09 | Roles base: **Administrador, Supervisor, Técnico**. | Entrevista P2.1 |
| D-10 | Autenticación única **`P00` + clave** en web y APK. | Entrevista P2.2 |
| D-11 | App móvil en **Flutter + SQLite** (offline). | Entrevista P2.3 |
| D-12 | Mensajería v1: **bot de Telegram**; **WhatsApp se difiere a la v3**. | Entrevista P3.1 |
| D-13 | **MCP/IA**: ingesta + consultas + alertas. | Entrevista P3.2 |
| D-14 | Correo saliente: servicio gratuito integrable con GCP (SendGrid free tier; alternativa Gmail SMTP app password), cuenta `txbarlovento@gmail.com`. | Entrevista P3.3 |
| D-15 | Desarrollo contra la base `ggtov2` en **`truekeate-db-dev`**; despliegue **local** por ahora. | Entrevista P4.2 |
| D-16 | **Cloud Storage** para evidencias y **KMS/Secret Manager** desde el inicio. | Entrevista P4.3 |
| D-17 | Métricas de MONITOREO/GRÁFICOS: **definición diferida a la Fase 3**. | Entrevista P5.1 |
| D-18 | **Insumos = v2**; el modelo de datos los reserva. | Entrevista P5.2 |
| D-19 | Fallas masivas: **detección automática por concentración** (tras la ingesta) **+ reporte manual** de técnico vía MCP/Telegram; asignación por **proximidad de sector**. | Entrevista P5.3 |
| D-20 | Repositorios: GitHub `anlucorporations/GGTO`, GitLab `anlucorporations/ggto`, rama **`GGTOv2-DSH-GCP`**. | Entrevista P4.1 |
| D-21 | Modelo E-R documentado en **Mermaid** (`modelo_er.md`) y DDL PostgreSQL editable en `db/schema.sql` (35 tablas, se mantienen sincronizados). | Solicitud del usuario |
| D-22 | **Cuadrilla 0 = criterio combinado (H-04):** va al supervisor si **no** contiene frases de campo (`despacho.frases_campo`) **o** contiene frases de no-atención en casa (`despacho.frases_supervisor`) o está en otra cola. Modo configurable `despacho.criterio_cuadrilla0` = `CAMPO`/`SUPERVISOR`/`UNION` (por defecto `UNION`). | Entrevista H-04 |
| D-23 | **Referidos sin incidencia (H-09):** reciben identificador sintético `REF-<CÓDIGO_CENTRAL>-<NNNNNN>` (función `generar_id_averia_ref`); `caso.id_averia` sigue `NOT NULL UNIQUE`. | Entrevista H-09 |
| D-24 | **Quick wins de auditoría ejecutados:** QW-1 (PII fuera de git + historial purgado + muestra pseudonimizada), QW-2 (encoding ISO-8859-1 + parser de fecha), QW-3 (conteos), QW-5 (`Falla Reportada` aclarada), QW-6 (privilegios de BD endurecidos) y QW-7 (binding de secretos retirado). | Aprobación del usuario |
| D-25 | **H-33 aceptado con mitigación:** `ggtov2_app` conserva la membresía `cloudsqlsuperuser` (no revocable vía SQL en Cloud SQL) pero con `NOINHERIT`, sin `CREATEROLE`/`CREATEDB` y sin acceso a `truekeate`/`postgres`/`template1`. No se resetea la contraseña de `postgres`. | Aprobación del usuario |
| D-26 | **H-03 riesgo aceptado:** no se modifican backups/PITR/SSL de `truekeate-db-dev` (instancia compartida de TrueKeate). Dueño: Dirección del proyecto · Fecha: 2026-09-25 · Cierre: migrar a `ggtov2-pg` con backups+PITR+SSL al desbloquear facturación. **No cargar datos reales** hasta entonces. RNF-16/RNF-17 definidos. | Aprobación del usuario |
| D-27 | **Depuración del CSV (H-05):** se descartan **21 columnas** (`tipo_reporte`, `dac`, `ultimo_usuario`, `fecha_despacho`, `ciudad`, `servicio_off_on`, `cliente_notificado`, `fecha_instalacion`, `ip`, `tarjeta`, `ont_id`, `cvlan`, `dias transcurrido desde la apertura`, `area_resolutoria`, `usuario_acciona`, `fecha_acciona`, `codigo_causa`, `descripcion`×2, `Subcodigo_causa`, `con_serv_aba`) y se **unifican** `informacion`(31) + `informacion`(32) + `descripcion`(52) en `informacion`. Quedan **49 campos destino**. El catálogo `causa` pasa a ser **administrable** (ya no se puebla del CSV). | Entrevista H-05 |
| D-28 | **H-07 alineado:** canales de la v1 = **Telegram + correo + MCP/IA**. WhatsApp retirado de RF-06, RF-10, RF-16, RF-27, RNF-07, RNF-11, RT-06, ACT-02/ACT-03 y de los enums del diccionario; reservado a la **v3**. | Entrevista H-07 |
| D-29 | **Estados del caso (S-10):** `NUEVO, ASIGNADO, CONTACTADO, CITADO, DIFERIDO, EN_GESTION, ENRUTADO, CERRADO, CANCELADO` fijos en el DDL. | Sincronización H-08 |
| D-30 | **Ficha de casos especiales (S-11):** `solicitante` (unidad + nombre + contacto + canal) y prioridad `ALTA/MEDIA/BAJA`; clasificación `REFERIDO/EMPRESA/GOBIERNO`. | Sincronización H-08 |
| D-31 | **Umbral de falla masiva (S-12):** configurable; valor y ventana se definen en la **Fase 3** junto con las métricas (S-08/D-17). | Sincronización H-08 |
| D-32 | **H-11 resuelto por decisión:** la tabla `caso` se mantiene **plana** (63 columnas) como tabla caliente; no se separa `caso_origen_csv` ni se extrae la geografía. La reducción 84→63 (D-27) se considera suficiente. | Entrevista H-11 |
| D-33 | **SLO provisionales (H-16):** ingesta ≤ 5 min (p95) para 20 000 filas · PANEL/despacho ≤ 2 s (p95) · 30 usuarios concurrentes · 20 000 casos/día y 3 años de histórico. Se instala `pg_trgm` con índices GIN sobre `caso.direccion` y `sector_direccion.patron`. Revisable con la volumetría real de CANTV. | Entrevista H-16 |
| D-34 | **RNF-18 + retención (H-17):** definidos base legal/finalidad, inventario de PII, minimización, enmascaramiento por rol, derechos del titular y DPA. Retención propuesta: `caso`/`actividad`/`solicitante` 5 años · `evidencia` 2 años · `auditoria` 3 años · `notificacion` 1 año. **Validación legal con CANTV pendiente (tarea externa).** | Entrevista H-17 |
| D-35 | **RNF-19 y RNF-20 (H-14/H-26/H-27):** observabilidad (logs con request-id, métricas de negocio, health checks, alertas, retención ≥ 30 días) y resiliencia (patrón outbox, reintentos, correo como respaldo de Telegram, alerta si el reporte de las 16:00 no se confirma). | Entrevista H-14/H-26/H-27 |
| D-36 | **RBAC y multi-central (H-15/H-30/H-31/H-32):** 3 roles (ADMIN/SUPERVISOR/TECNICO) + matriz rol×módulo×acción; `usuario.id_central`; **RLS** en `caso` y `despacho` como patrón; RNF-21 y RNF-22 (Argon2id, MFA para ADMIN/SUPERVISOR, sesiones, rate limiting, CSRF/CORS). | Entrevista H-15/H-30/H-31/H-32 |
| D-37 | **Usabilidad y accesibilidad (H-28):** RNF-09 reescrito con tareas medibles (≤3 toques/20 s contactar; ≤10 s localizar ficha; ≤60 s alta manual) y RNF-23 de accesibilidad (WCAG 2.1 AA en web; ≥48 dp, contraste ≥4.5:1 y ≥16 sp en APK). | Entrevista H-28 |
| D-38 | **Stack y DevOps (H-13/H-29):** **Python + FastAPI**, migraciones con **Alembic** (baseline `db/schema.sql`), **React** (Vite/Recharts), **Flutter + SQLite**, **GitHub Actions** (espejo GitLab) con pytest/Ruff/mypy y cobertura ≥ 70 %. RNF-24 y RNF-25. | Entrevista H-13/H-29 |
| D-39 | **Gobierno v1 (H-34/H-35/H-36/H-42):** catálogos, flota/mantenimiento, almacén y soporte los cubre el **SUPERVISOR**; la auditoría interna la ejerce **ADMIN** en solo lectura. **No se crea rol AUDITOR en v1.** El responsable de protección de datos y el dueño del sistema origen quedan del lado CANTV (pendientes de designar). | Entrevista H-34/35/36/42 |
| D-40 | **Trazabilidad RF (H-38/H-40/H-43):** añadidos **RF-30…RF-38** (PANEL, CASOS, SEGUIMIENTO, EMPRESAS, REFERIDOS, GESTIÓN, CONFIGURACIÓN), GOBIERNO nombrado en RF-06, catálogo §3 reestructurado (10 secciones + 7 módulos funcionales) y numeración corregida (GESTIÓN 8→7). Total: **38 RF / 25 RNF / 14 RT**. | Entrevista H-38/40/43 |
| D-41 | **Contrato de interfaz (H-32/C24):** redactado `interfaz_csv_origen.md` (nombre, periodicidad, `;`, ISO-8859-1, 80 columnas por posición, validaciones, errores, confidencialidad y responsabilidades). **Pendiente de firma por CANTV.** | Entrevista H-32/C24 |
| D-42 | **Despliegue de la capa de datos en GCP:** `db/schema.sql` aplicado sobre la base **`ggtov2`** de la instancia disponible `truekeate-db-dev`. Verificado: 35 tablas, `pgcrypto`+`pg_trgm`, RLS en `caso`/`despacho`, 14 triggers, 2 índices trigram, semillas y función `REF-…` operativa. | Orden del usuario |
| D-43 | **Despliegue web (esqueleto) en GCP:** servicio **Cloud Run `ggto-web`** en `truekeate-main`/`europe-west1` → https://ggto-web-593453426217.europe-west1.run.app, con SA propia `ggto-web-sa`, conectado a `ggtov2` por el conector de Cloud SQL. Código en `app/` (FastAPI + psycopg2). **Acceso público (smoke test); restringir antes de producción.** Migrar a `ggtov2` al desbloquear facturación. | Orden del usuario |
| D-44 | **Fase 3 iniciada — Ciclo 1 (Núcleo + Autenticación) completado:** plan vertical en `plan_desarrollo.md` (10 ciclos); backend `app/` con Argon2id, JWT, bloqueo a los 3 intentos, 12 palabras, rate limiting y RBAC; **17/17 pruebas** en verde; CI en GitHub Actions; desplegado como revisión `ggto-web-00002-rbl` (imagen `v2`) con el secreto `ggto-secret-key`. Flujo verificado en vivo (setup → login → me → bloqueo → desbloqueo). | Fase 3 |
| D-45 | **Ciclo 2 (Configuración) completado:** CRUD de central, sectores (+direcciones), técnicos, flota, cuadrillas (+integrantes), catálogos y parámetros, con RBAC de escritura `ADMIN`/`SUPERVISOR`; **web React** (login, panel y 8 secciones) servida por el mismo contenedor; `/api/v1/resumen` pasa a exigir token; **28/28 pruebas**; desplegado como `ggto-web-00003-6zb` (imagen `v3`, build multi-etapa Node+Python) y verificado en vivo. | Fase 3 |
| D-46 | **Ciclo 3 (Ingesta CSV + Gestión automatizada) completado:** parser ISO-8859-1 de 80 columnas por posición (49 campos destino), fechas `a.m./p.m.`, normalización de acentos y recorte defensivo; filtro por central, deduplicación por `id_averia`, sectorización por dirección (`pg_trgm`) y criterio combinado de cuadrilla 0; endpoints de preview/carga/lotes y página web INGESTA; **62/62 pruebas**; desplegado como `ggto-web-00004-cj9` (imagen `v4`) y verificado en vivo. | Fase 3 |
| D-47 | **`caso.extra` ampliado a `varchar(120)`** (la muestra real traía valores de hasta 50 caracteres) y añadido recorte con aviso para que ningún valor inesperado aborte la ingesta. | Ciclo 3 |
| D-48 | **Criterio de cuadrilla 0 a revisar:** con modo `UNION` la muestra arrojó **51 de 51** casos al supervisor (H-04/H-19). ✅ **Resuelto en D-59.** | Ciclo 3 |
| D-49 | **Ciclo 4 (PANEL y CASOS) completado:** búsqueda por `id_averia`/teléfono (RF-30), listado con filtros y paginación (RF-33), ficha y edición con re-sectorización automática (RF-31), alta manual que genera `REF-<CENTRAL>-<NNNNNN>` (RF-32) y bitácora de estados `caso_estado_hist` (RNF-12); páginas web CASOS y búsqueda rápida en PANEL; **79/79 pruebas**; desplegado como `ggto-web-00005-rxm` (imagen `v5`) y verificado en vivo. | Fase 3 |
| D-50 | **Super Usuario con acceso total:** nuevo rol **`SUPER`** en el catálogo; `app/api/deps.py` le concede **cualquier operación** sin enumerarlo por endpoint (acceso total permanente, también en ciclos futuros). Cuenta `123456` / `anlucorporations@gmail.com` / **ANLUcorporations Super Usuario** creada con `scripts/inyectar_super_usuario.py` (idempotente, con confirmación y log) y **verificada en producción**: lectura en las 11 secciones y escritura en configuración, casos y parámetros. Desplegado como `ggto-web-00006-htl` (imagen `v6`). Documentación en `RepoTecnico/BaseOperaciones/`. | Orden del usuario |
| D-51 | **12 palabras de seguridad del Super Usuario generadas** (`--con-palabras`) y almacenadas como hashes Argon2id en `dispositivo_seguridad`; el listado en claro vive **solo** en `RepoTecnico/credenciales/CREDENCIALES-GGTO.md` (ignorado por git, permisos `600`). Verificado en producción: `unlock` con 3 palabras correctas → `200`; con incorrectas → `401`. | Orden del usuario |
| D-59 | **Criterio de cuadrilla 0 ajustado a `SUPERVISOR` (resuelve D-48):** solo van al supervisor los casos con frases de no-atención en casa; el resto vuelve a estar **disponible para el despacho de calle**. Se cambió `despacho.criterio_cuadrilla0` a `SUPERVISOR` (semilla de `schema.sql` incluida) y se **recalcularon los 42 casos reales** con `scripts/recalcular_cuadrilla0.py` (simulación + confirmación + log): **36 pasaron a `Pendiente`** y 6 permanecen en **Gestión**. La propuesta de despacho pasó de 0 a **36 casos**. | Petición del usuario |
| D-57 | **Rediseño de navegación (petición del usuario):** se elimina el menú lateral y queda **una sola barra superior** con (a) **buscador global de un solo campo** (`/casos/buscar?q=` → avería, teléfono, cliente o dirección), (b) botón **«Agregar caso»** con **modal flotante** que incluye los campos distintivos de los casos especiales (clasificación, tipo de actividad, prioridad y solicitante externo), (c) **menú de usuario**, (d) enlaces de sección con **iconos en móvil**, y (e) **CONFIGURACIÓN** como submenú restringido. Listados **CASOS** (ID/Tipo/Clase/Sector) y **ESPECIALES** (Tipo/Sector/Prioridad/Solicitante) reducidos a resumen con **iconos Pendiente·Asignado·Citado·Gestión** y acceso a la ficha completa; **AGENDA** con vistas **día/semana/mes**. Backend: `sector_nombre`, iconos calculados y búsqueda `q`. **Sin dependencias nuevas.** Desplegado como `ggto-web-00012-lbl` (imagen `v12`) y verificado en vivo. | Petición del usuario |
| D-58 | **Visibilidad de CONFIGURACIÓN:** se muestra a `SUPER`, `ADMIN` y `SUPERVISOR` (oculta a `TECNICO`). El usuario pidió «Supervisor y Super Usuario»; se incluyó `ADMIN` por ser el rol administrador — **ajustable si se desea restringir solo a SUPER/SUPERVISOR**. | Decisión de diseño |
| D-56 | **Ciclo 7 (MONITOREO y REPORTES) completado:** métricas cerradas en `RepoTecnico/metricas.md` v1.0 (cierra **S-08 y D-17**); 7 endpoints de monitoreo, reporte de trabajo diario/semanal/mensual con versión imprimible y página web con gráficos SVG propios; REPARACIÓN y CONSTRUCCIÓN pasan a ser excluyentes; **127/127 pruebas**; desplegado como `ggto-web-00009-fvc` (imagen `v9`) y verificado en vivo en modo lectura. | Fase 3 |
| D-53 | **Ciclo 6 (SEGUIMIENTO, EMPRESAS y REFERIDOS) completado:** casos especiales REFERIDO/EMPRESA/GOBIERNO con solicitante y creación automática del caso (`REF-…`), **agenda sin solapamiento** por cuadrilla (duración configurable, `409` con el choque, forzar solo `SUPER`), **seguimiento** que enruta el caso y lo saca del despacho (y lo devuelve a `NUEVO`); páginas web ESPECIALES y AGENDA; **111/111 pruebas**; desplegado como `ggto-web-00008-vr5` (imagen `v8`) y verificado en vivo. | Fase 3 |
| D-54 | **Datos reales en producción:** el Super Usuario cargó `detalle_averias_gpon 15_09_2026.csv` (47 filas → **42 casos**, 5 descartadas) el 2026-09-27. La ingesta funcionó; los casos **no** se tocaron en las limpiezas (verificado con las secuencias de `public`, que coinciden solo con los registros de prueba). ⚠️ Contienen **PII de suscriptores** y el servicio es **público**: urge restringir el acceso y habilitar respaldo. | Operación |
| D-55 | **Política de limpieza corregida:** desde este ciclo, las limpiezas de verificación en producción se hacen **solo con filtros/marcadores** (`TST%`, ids conocidos); quedan prohibidos los `DELETE` sin filtro sobre tablas que ya contienen datos reales. | Lección aprendida |
| D-52 | **Ciclo 5 (DESPACHO) completado:** propuesta automática por sector con balanceo *greedy* y las reglas del brief (citados del día, ≥2 referidos, ≥1 empresa, construcción a una sola cuadrilla), exclusión de la cuadrilla 0, generación/edición/publicación, **impresión tamaño carta**, reporte de producción, envío por Telegram/correo con patrón *outbox* (queda `PENDIENTE` sin credenciales, que llegan en el Ciclo 9) y fallas masivas; página web DESPACHO; **96/96 pruebas**; desplegado como `ggto-web-00007-vsr` (imagen `v7`) y verificado en vivo. | Fase 3 |
| D-60 | **Ciclo 9 (ALERTAS, Telegram y MCP) completado:** detección automática de fallas por concentración (idempotente), reporte manual, planificación (RF-17), material (RF-18), *outbox* con backoff (RNF-20), bot de Telegram (`/ayuda`, `/estado`, `/caso`, `/falla`), servidor MCP JSON-RPC y `ObservabilidadMiddleware` + `/metricas` (RNF-19); página web ALERTAS; **152/152 pruebas**; desplegado (`ggto-web-00014-zqx`, imagen `v14`) y verificado en vivo. | Fase 3 |
| D-61 | **Concentración real detectada:** los 42 casos reales se reparten en 4 OLT (`pde-olt-00…03`, 14/12/10/6) y superan el umbral de 5; la próxima ingesta declarará automáticamente esas 4 fallas masivas y encolará sus alertas. Telegram y correo siguen sin credenciales (`canales_configurados=false`), por lo que las notificaciones quedan `PENDIENTE` en la bandeja. | Operación |
| D-62 | **Fase 4 (Pruebas) completada:** plan en `RepoTecnico/pruebas/plan_pruebas.md` con 4 niveles (unitarias, integración, contratos y E2E de navegador); **169/169 `pytest` + 46/46 Playwright = 215 pruebas en verde**; `ruff`, `mypy` y `tsc` strict sin hallazgos; esquemas aislados `ggto_test`/`ggto_e2e` (parámetro `DB_SCHEMA`, nunca producción); 6 hallazgos corregidos y documentados en `informe_fase4.md`. Sin defectos funcionales abiertos. | Fase 4 |
| D-63 | **Fase 5 (Manuales) completada:** **22 manuales técnicos** (`RepoTecnico/Manuales/`, 12 004 líneas con citas `ruta:línea` validadas), **22 manuales literales** (`docs/Manuales/`, mismo árbol, "Empezar en 5 minutos"), **35 imágenes** SVG+PNG (`docs/imagenes/`), **22 PDF** (371 páginas) + 23 HTML estilizados y la **sección AYUDA** de la SPA (`/ayuda`, ruta protegida, índice temas→secciones→sub-secciones con descarga de PDF). Sincronización reproducible con `docs/Manuales/_build/sincronizar_manual.sh`; `tsc` y `npm run build` en verde; assets servidos por FastAPI verificados (`/ayuda`, HTML, PDF e imágenes `200`). | Fase 5 |

---

## 4. Próximos pasos

1. **Confirmación del usuario para dar por terminado el proyecto** (Fase 5 completada).
2. **Republicar la imagen** de `ggto-web` para que la sección AYUDA (`/ayuda`) y los
   manuales lleguen a producción (el `dist/` se reconstruyó en local; no se desplegó).
3. Restringir el **acceso público de `ggto-web`** y habilitar respaldo antes de operar
   con PII real; firmar el contrato de interfaz con CANTV.
4. Designar los responsables de protección de datos y del sistema origen (lado CANTV).
5. Desbloquear la facturación GCP y migrar `ggto-web`/`ggtov2` a la instancia propia
   con backups + PITR + SSL (cierra el riesgo aceptado D-26).
6. Ciclo 8 (app móvil Flutter + SQLite) — pospuesto.

---

## 5. Preguntas de la entrevista (Fase 1)

> Se entregan por bloques de 3. Estado: `⏳ pendiente` / `✅ respondida`.

### Bloque 1 — Alcance y datos

| # | Pregunta | Estado | Respuesta |
|---|---|---|---|
| P1.1 | ¿La base de datos definitiva es **PostgreSQL** y diseño multi-central? | ✅ | **Sí.** PostgreSQL es la base definitiva (no Excel). La plataforma se diseña **multi-central** desde el inicio; v1 opera la Central Francisco Salias. |
| P1.2 | ¿Qué define un **"sector"** para agrupar casos y armar rutas? | ✅ | El **supervisor lo define en CONFIGURACIÓN** con un nombre (p. ej. `Norte 1`, `Norte 2`, `Sur 1`). Cada sector agrupa **varias direcciones** (ej. `Norte 1 = Valle Arriba, Concresa, Parque Humboldt`). La asignación se hace **por coincidencia sobre el campo `direccion`** del CSV contra los patrones/alias configurados por sector. |
| P1.3 | ¿Unicidad de `id_averia` y fuente del catálogo de causas? | ✅ | **`id_averia` es único global.** El **catálogo de causas se puebla desde el propio CSV** (`codigo_causa`, `subcodigo_causa` y sus descripciones). |

### Bloque 2 — Usuarios y seguridad

| # | Pregunta | Estado | Respuesta |
|---|---|---|---|
| P2.1 | ¿Roles del sistema? | ✅ | **Administrador, Supervisor y Técnico** (tres roles base). |
| P2.2 | ¿Autenticación en web y APK? | ✅ | **Solo `P00` + clave** en web y APK. Aplica el bloqueo a los 3 intentos y las 12 palabras de seguridad. |
| P2.3 | ¿Tecnología de la app móvil? | ✅ | **Flutter** (híbrida) con **SQLite** local para operación offline. |

### Bloque 3 — Canales e integraciones

| # | Pregunta | Estado | Respuesta |
|---|---|---|---|
| P3.1 | ¿Disponibilidad de WhatsApp/Telegram? | ✅ | **Solo bot de Telegram** en esta etapa. La integración con **WhatsApp queda para la 3.ª versión**. |
| P3.2 | ¿Alcance del WEB-MCP/IA? | ✅ | **Ingesta de casos + consultas + alertas.** |
| P3.3 | ¿Servicio de correo saliente? | ✅ | Servicio **gratuito y de fácil integración con GCP**, cuenta `txbarlovento@gmail.com`. Propuesta: **SendGrid free tier** (100 correos/día, disponible en GCP Marketplace); alternativa: **Gmail SMTP con contraseña de aplicación**. |

### Bloque 4 — Despliegue, repositorios y GCP

| # | Pregunta | Estado | Respuesta |
|---|---|---|---|
| P4.1 | ¿URLs de repositorios GitLab/GitHub y rama? | ✅ (parcial) | El usuario **ya dispone de repositorios** y proporcionará las **URLs y la rama**. ⚠️ **Pendiente de recibir los valores.** |
| P4.2 | ¿Despliegue GCP y base de datos? | ✅ | Se continúa con **`truekeate-db-dev`** (base `ggtov2`) y se **despliega local** por ahora; se migrará a instancia propia al resolver la facturación. |
| P4.3 | ¿Evidencias y secretos? | ✅ | **Cloud Storage** para evidencias + **Cloud KMS / Secret Manager** desde el inicio. |

### Bloque 5 — Métricas, catálogos e insumos

| # | Pregunta | Estado | Respuesta |
|---|---|---|---|
| P5.1 | ¿Fórmula exacta de las métricas de MONITOREO/GRÁFICOS? | ✅ | **Se difiere a la Fase 3.** Se avanza con la estructura de los tableros. |
| P5.2 | ¿Insumos/inventario en v2? | ✅ | **Confirmado: insumos (RF-05) van para la 2.ª versión.** |
| P5.3 | ¿Origen de fallas masivas y "mayor cercanía"? | ✅ | **Ambos:** (a) **detección automática por concentración de casos** tras cargar el CSV del día, y (b) **reporte manual** de un técnico en calle vía **MCP/Telegram**. La asignación es por **proximidad de sector**. |

### Pendiente de valores

| # | Dato | Estado |
|---|---|---|
| P4.1 | **Repositorios**: GitHub `https://github.com/anlucorporations/GGTO.git` · GitLab `https://gitlab.com/anlucorporations/ggto.git` · **rama `GGTOv2-DSH-GCP`** (debe quedar limpia). | ✅ Recibido |

---

## 6. Auditoría de Fase 1 (resultado)

**Informe:** `INFORME_OPTIMIZACION_V1.md` · **Método:** 7 revisores en paralelo → 7 verificadores adversariales → síntesis.
**Veredicto:** la documentación **NO es apta aún** para la Fase 2 en su estado actual; es apta **bajo condiciones**.
16 hallazgos fueron descartados en la verificación (anexo §9 del informe).

### 6.1 Hallazgos CRÍTICOS (bloqueantes)

| ID | Hallazgo | Verificación del director | Acción |
|---|---|---|---|
| **H-01** | CSV real con PII de suscriptores (nombre, teléfono, dirección, serial, IP) versionado en git y **no** cubierto por `.gitignore`; remotos GitHub/GitLab ya configurados. | ✅ Confirmado (`git ls-files`) | Retirar del índice, purgar historial, pseudonimizar muestra |
| **H-02** | El CSV real es **ISO-8859-1** y la ingesta está configurada como UTF-8 → aborto o corrupción (afecta la frase `Fibra Dañada`). | ✅ Confirmado (`file`, `UnicodeDecodeError 0xd1`) | Fijar codificación real + parser de fechas `a.m./p.m.` |
| **H-03** | Persistencia en instancia **compartida, zonal, sin backups/PITR/protección de borrado**, SSL no obligatorio. | ✅ Confirmado | Habilitar backups/PITR/SSL o registrar riesgo aceptado |
| **H-04** | La cuadrilla 0 modela solo PROCEDIMIENTO 3 e **ignora GENERALIDADES 3.5**; con datos reales casi todo iría al supervisor. | ✅ Confirmado | Resolver criterio con el usuario y modelarlo por configuración |

### 6.2 Hallazgos ALTOS destacados

H-05 (columnas de causa sin destino), H-06 (columna `Falla Reportada` inexistente), H-07 (WhatsApp v1 vs v3),
H-08 (Fase 1 declarada completa con contradicciones), H-09 (`id_averia` NOT NULL impide referidos sin incidencia),
H-10 (bloqueo de facturación sin destino de bucket/KMS), H-11 (tabla `caso` monolítica), H-12/H-22 (sincronización offline),
H-13 (sin migraciones), H-14 (sin fallback de notificaciones), H-15/H-30/H-31/H-32 (RBAC, sesiones, multi-central),
H-16 (RNF sin umbral), H-17 (PII sin retención ni base legal), H-18 (fallas masivas sin algoritmo).

### 6.3 Plan de acción


Quick wins **ejecutados** (D-24): QW-1 (retirar CSV/PII de git + purga de historial + muestra
pseudonimizada en `muestras/`), QW-2 (codificación ISO-8859-1 + parser de fecha), QW-3 (conteos) y
QW-5 (aclarar `Falla Reportada` en RF-25).
Quick wins **pendientes**: QW-4 (alinear enums/WhatsApp v3 — H-07/H-24), QW-6 (revocar privilegios de
`ggtov2_app` — H-33) y QW-7 (binding de secretos).El detalle completo (Quick wins QW-1..QW-7, Mejoras M-1..M-13, Roadmap R-1..R-10) está en el informe §7.
Los 24 criterios de aceptación para cerrar la Fase 1 están en el informe §8.

### 6.4 Erratas del informe


Corregidos en el informe §10: RT reales = **12** (no 20), módulos = **10** filas, y `RF-0` en `requerimientos.md` §1 es un typo que debe referenciar `S-01`.

---

## 7. Criterios de aceptación — Fase 1

### 7.1 Criterios base

- [x] Los 3 archivos `.md` base existen en `RepoTecnico/`.
- [x] Preguntas de la entrevista respondidas (bloques 1–5).
- [x] URLs de repositorios definidas (GitHub `GGTO`, GitLab `ggto`, rama `GGTOv2-DSH-GCP`).
- [x] Configuración GCP confirmada (base `ggtov2` en `truekeate-db-dev`, despliegue local).
- [x] Repositorio git local inicializado con la rama `GGTOv2-DSH-GCP`.
- [x] Modelo E-R y script DDL generados.
- [x] Auditoría de Fase 1 ejecutada (`INFORME_OPTIMIZACION_V1.md`).

### 7.2 Criterios de auditoría (ver informe §8: C1–C5)

- [ ] **C1 Seguridad** — [x] H-01 (PII fuera de git + historial purgado); [~] H-33 (mitigado con `NOINHERIT` + aislamiento, D-25); [x] binding de secretos; [~] H-03 (**riesgo aceptado**, D-26 → RNF-16/RNF-17).
- [ ] **C2 Ingesta** — [x] H-02 (encoding/parser); [x] H-05 (columnas de causa descartadas y `informacion` unificada, D-27); [x] H-06 (`Falla Reportada` aclarada en RF-25).
- [x] **C3 Requisitos y alcance** — [x] H-04/H-19 (cuadrilla 0 combinada, D-22); [x] H-07 (canales v1 = Telegram+correo+MCP, D-28); [x] H-09/H-11 (referidos `REF-…`, D-23); [x] H-08 (`requerimientos.md` v1.0 sincronizado, D-29..D-31).
- [x] **C4 RNF** — [x] H-16 (SLO de rendimiento/capacidad, D-33); [x] H-03 (backup: RNF-16, riesgo aceptado D-26); [x] H-17 (privacidad/retención: RNF-18, D-34); [x] H-14/H-26/H-27 (observabilidad y resiliencia: RNF-17/19/20, D-35); [x] H-15/H-30/H-31 (RBAC, sesiones, MFA: RNF-21/22, D-36); [x] H-28 (usabilidad/accesibilidad: RNF-09/23, D-37); [x] H-13/H-29 (migraciones/CI/portabilidad: RNF-24/25, D-38).
- [x] **C5 Gobernanza** — [x] dueños de catálogos/flota/almacén/auditoría/soporte definidos (SUPERVISOR/ADMIN, D-39); [x] RF de PANEL/GOBIERNO y trazabilidad de módulos (RF-30…RF-38, D-40); [x] contrato de interfaz redactado (D-41, pendiente de firma de CANTV).
- [x] **Push a remotos**: rama `GGTOv2-DSH-GCP` publicada por force-push en GitHub (`anlucorporations/GGTO`) y GitLab (`anlucorporations/ggto`), commit `72200e8`, 25 archivos. Repos **públicos** (decisión del usuario).
- [ ] Confirmación del usuario para pasar a **Fase 2**.

---

## 8. Historial

| Fecha | Evento |
|---|---|
| 2026-09-25 | Fase 1 iniciada: brief analizado, `requerimientos.md`, `diccionario_datos.md`, `entornos_globales.md`, `estado_proyecto.md` generados. |
| 2026-09-25 | Entrevista Fase 1 completada (bloques 1–5). Repositorio git local creado en la rama `GGTOv2-DSH-GCP`. |
| 2026-09-25 | Generados `modelo_er.md` (diagramas Mermaid) y `db/schema.sql` (DDL PostgreSQL, 35 tablas). |
| 2026-09-25 | Auditoría de Fase 1 ejecutada (7 lentes + verificación adversarial) → `INFORME_OPTIMIZACION_V1.md`: 43 hallazgos (4 CRÍTICA, 14 ALTA, 19 MEDIA, 6 BAJA), veredicto "apta bajo condiciones". |
| 2026-09-25 | Quick wins aprobados y ejecutados (D-24): PII fuera de git e **historial purgado**, codificación ISO-8859-1, conteos corregidos, `Falla Reportada` aclarada. Decisiones D-22 (cuadrilla 0 combinada) y D-23 (`REF-…`). |
| 2026-09-25 | ⚠️ La purga de historial (`git filter-branch`) eliminó también el **CSV real del disco**; no hay copia local. Se conserva la muestra pseudonimizada. Pendiente: que el usuario re-aporte un archivo diario real (quedará fuera de git). |
| 2026-09-25 | **QW-6/QW-7 sobre `truekeate-main`:** revocados `CREATEROLE`/`CREATEDB` y aplicado `NOINHERIT` a `ggtov2_app`; revocado `PUBLIC` en `truekeate`/`postgres`/`template1` (ggtov2_app ya no puede acceder a la base de TrueKeate, que sigue operando); retirado el binding de `truekeate-app-sa` sobre los secretos de GGTO. Riesgo residual: membresía `cloudsqlsuperuser` no revocable vía SQL (D-25). |
| 2026-09-25 | ⚠️ **Exposición de secreto (RESUELTA):** un error de Node imprimió la contraseña del usuario `app` de `truekeate-main`. Se rotó la contraseña, se creó la versión 3 del secreto `DATABASE_URL` y se desplegó `truekeate-api-00034-hvk` (Ready, 100 % tráfico, sin errores de auth). |
| 2026-09-25 | **H-03 riesgo aceptado (D-26):** no se modifican backups/PITR/SSL de la instancia compartida; se añaden RNF-16 (backup, RPO/RTO) y RNF-17 (disponibilidad). |
| 2026-09-25 | **H-05 resuelto (D-27):** depurado el mapeo del CSV (se descartan 21 columnas y se unifica `informacion`); actualizados `diccionario_datos.md`, `db/schema.sql`, `modelo_er.md` y `requerimientos.md` (RF-25, RT-05). C2 completado. |
| 2026-09-25 | **H-07 resuelto (D-28):** canales v1 alineados a Telegram + correo + MCP; WhatsApp retirado de RF/RNF/RT, actores y enums, reservado a la v3. |
| 2026-09-25 | **H-08 resuelto (D-29..D-31):** `requerimientos.md` subido a **v1.0 validado**; S-01..S-12 cerrados con su decisión; §10 actualizado. **C3 completado.** |
| 2026-09-25 | **C4 completado (D-33..D-38):** SLO de rendimiento, privacidad/retención (RNF-18), observabilidad y resiliencia (RNF-19/20), RBAC + RLS + MFA (RNF-21/22), usabilidad/accesibilidad (RNF-09/23) y mantenibilidad/portabilidad (RNF-24/25). Stack definido: FastAPI + Alembic + React + Flutter + GitHub Actions. |
| 2026-09-25 | **C5 completado (D-39..D-41):** gobierno v1 (SUPERVISOR/ADMIN), RF-30…RF-38 y catálogo de módulos, y contrato de interfaz `interfaz_csv_origen.md` (pendiente de firma de CANTV). **Auditoría de Fase 1 cerrada en sus 5 criterios.** |
| 2026-09-26 | **Proyecto publicado:** force-push de la rama `GGTOv2-DSH-GCP` (commit `72200e8`, 25 archivos) a GitHub `anlucorporations/GGTO` y GitLab `anlucorporations/ggto`, con remotos migrados a SSH. Repos públicos por decisión del usuario. |
| 2026-09-26 | **Base de datos desplegada en GCP (D-42):** `db/schema.sql` aplicado a la base `ggtov2` de `truekeate-db-dev`; verificados 35 tablas, extensiones, RLS, triggers, semillas y `REF-…`. |
| 2026-09-26 | **Aplicación desplegada en GCP (D-43):** esqueleto FastAPI en Cloud Run `ggto-web` (proyecto `truekeate-main`) conectado a `ggtov2`; endpoints `/health`, `/ready`, `/api/v1/central` y `/api/v1/resumen` verificados en producción. |
| 2026-09-26 | **Fase 3 iniciada (D-44):** plan de desarrollo vertical en `plan_desarrollo.md` (10 ciclos) y **Ciclo 1 completado**: autenticación P00 + clave con Argon2id, JWT, bloqueo a los 3 intentos, 12 palabras, rate limiting y RBAC; **17/17 pruebas**; CI en GitHub Actions; desplegado (`ggto-web-00002-rbl`, imagen `v2`) y verificado en vivo. |
| 2026-09-26 | **Ciclo 2 completado (D-45):** CRUD de configuración (central, sectores+direcciones, técnicos, flota, cuadrillas, catálogos, parámetros) + **web React** integrada en el mismo contenedor; **28/28 pruebas**; desplegado (`ggto-web-00003-6zb`, imagen `v3`) y verificado en vivo (SPA, login y CRUD). |
| 2026-09-26 | **Ciclo 3 completado (D-46..D-48):** ingesta del CSV diario (ISO-8859-1, 80 columnas por posición), filtro por central, deduplicación por `id_averia`, sectorización por dirección y cuadrilla 0 configurable; página web INGESTA; **62/62 pruebas**; desplegado (`ggto-web-00004-cj9`, imagen `v4`) y verificado con la muestra real (56 filas → 51 de la central, 5 descartadas, 15 sectorizadas, 51 duplicadas en la segunda carga). |
| 2026-09-26 | **Ciclo 4 completado (D-49):** PANEL y CASOS con búsqueda por avería/teléfono, listado filtrado y paginado, ficha, edición, alta manual con `REF-…` y bitácora de estados; **79/79 pruebas**; desplegado (`ggto-web-00005-rxm`, imagen `v5`) y verificado en vivo (`REF-2324X-000001`, historial de 2 entradas). |
| 2026-09-27 | **Super Usuario inyectado (D-50):** rol `SUPER` con acceso total (bypass en `require_roles`); cuenta `123456` (ANLUcorporations) creada con `scripts/inyectar_super_usuario.py` y verificada en producción; documentación en `RepoTecnico/BaseOperaciones/` (`estructura_datos.md`, `casos_uso_inyeccion.md`, `estado_inyeccion.md`). Credenciales registradas en `RepoTecnico/credenciales/` (ignorado por git). |
| 2026-09-27 | **12 palabras de seguridad del Super Usuario (D-51)** generadas y documentadas; verificado `unlock` con 3 palabras (`200`) y con incorrectas (`401`). |
| 2026-09-27 | **Desplegada la revisión `ggto-web-00013-9pf`** (imagen `v13`, commit `a2cf60e`): verificado en vivo — 42 casos con 6 en Gestión, propuesta de despacho con **36 casos**, SPA y API `200`. |
| 2026-09-27 | **Cuadrilla 0 ajustada (D-59):** criterio `UNION` → `SUPERVISOR`; 36 de 42 casos reales vuelven a `Pendiente` y el despacho ya propone 36 casos. Script `scripts/recalcular_cuadrilla0.py` (dry-run/confirmación/log). |
| 2026-09-27 | **Rediseño de navegación (D-57/D-58):** barra superior única con buscador global, modal de alta (normal y especial), menú de usuario, iconos en móvil, listados resumidos con iconos de estado y agenda día/semana/mes; **32/32 pruebas de regresión**; desplegado (`ggto-web-00012-lbl`, imagen `v12`) y verificado en vivo. |
| 2026-09-27 | **Redespliegue desde el commit `638544d`** (imagen `v11`, revisión `ggto-web-00011-ksr`): prueba de humo completa — las **dos URLs** del servicio `200`, 9 rutas de la SPA `200`, login del Super Usuario `200`, y **22 endpoints** de lectura `200` con los 42 casos reales visibles. |
| 2026-09-27 | **Ciclo 7 completado (D-56):** métricas definidas (`metricas.md`), monitoreo, reportes imprimibles y página con gráficos; **127/127 pruebas**; desplegado (`ggto-web-00009-fvc`, imagen `v9`) y verificado en vivo sobre los datos reales. |
| 2026-09-27 | **Ciclo 6 completado (D-53):** casos especiales, agenda sin solapamiento y seguimiento; páginas ESPECIALES y AGENDA; **111/111 pruebas**; desplegado (`ggto-web-00008-vr5`, imagen `v8`) y verificado en vivo. |
| 2026-09-27 | **Datos reales detectados (D-54):** el Super Usuario cargó `detalle_averias_gpon 15_09_2026.csv` → **42 casos reales** con PII. Verificado que las limpiezas de prueba no los afectaron. Política de limpieza corregida (D-55). |
| 2026-09-27 | **Ciclo 5 completado (D-52):** propuesta de despacho por sector con las reglas del brief, generación/edición/publicación, imprimible tamaño carta, reporte de producción, envío con patrón *outbox* y fallas masivas; página web DESPACHO; **96/96 pruebas**; desplegado (`ggto-web-00007-vsr`, imagen `v7`) y verificado en vivo (reparto 6/4, construcción en una sola cuadrilla, envío PENDIENTE sin credenciales). |
| 2026-09-27 | **Ciclo 9 completado (D-60):** ALERTAS, Telegram y MCP — detección automática de fallas por concentración (idempotente), reporte manual, planificación (RF-17), material (RF-18), *outbox* con backoff (RNF-20), bot de Telegram (`/ayuda`, `/estado`, `/caso`, `/falla`), servidor MCP JSON-RPC y `ObservabilidadMiddleware` + `/metricas` (RNF-19); página web ALERTAS; **152/152 pruebas**; desplegado (`ggto-web-00014-zqx`, imagen `v14`) y verificado en vivo (42 casos, 0 fallas, outbox vacío, 73 endpoints, SPA `/alertas` `200`). |
| 2026-09-27 | **Concentración real detectada (D-61):** los 42 casos se reparten en 4 OLT (`pde-olt-00…03` con 14/12/10/6) y superan el umbral de 5; la próxima ingesta declarará automáticamente esas 4 fallas masivas y encolará sus alertas. Telegram y correo siguen sin credenciales (`canales_configurados=false`), por lo que las notificaciones quedarán PENDIENTES en la bandeja. |
| 2026-09-28 | **Fase 4 iniciada:** `RepoTecnico/pruebas/plan_pruebas.md` v1.0 con 4 niveles (unitarias, integración, contratos y E2E de navegador) y esquemas aislados `ggto_test`/`ggto_e2e`; corregido F4-01 (parámetro `DB_SCHEMA` → `search_path`, nunca producción). |
| 2026-09-28 | **E2E de navegador en verde:** suite Playwright/Chromium de 11 archivos (**46/46**, 7.4 m) con la SPA completa sobre `ggto_e2e`; mitiga F4-04 (librerías y fuentes de Chromium) y F4-05 (rate limit en pruebas). |
| 2026-09-28 | **Accesibilidad (F4-02):** 56 `<label>` de CONFIGURACIÓN asociados a su control (`htmlFor`+`id`) en las 7 páginas; verificado con `tsc` strict. |
| 2026-09-28 | **F4-03 corregido:** `test_monitoreo_api.py` pasa de la constante `HOY` a la función `hoy()` (evita falsos negativos en corridas que cruzan la medianoche). |
| 2026-09-28 | **Fase 4 completada (D-62):** **169/169 `pytest` + 46/46 E2E = 215 pruebas en verde** y `ruff`/`mypy`/`tsc` sin hallazgos; 6 hallazgos corregidos y documentados en `informe_fase4.md` (F4-06: variable local `hoy` que tapaba la función homónima). Sin defectos funcionales abiertos. |
| 2026-09-28 | **Fase 5 iniciada (Manuales):** el equipo `@manuales` desplegó sus 5 roles (técnico, literario, creativo, PDF e integrador) sobre el código real; base de 22 temas con jerarquía tema → sección → sub-sección. |
| 2026-09-28 | **Manuales técnicos y literales generados:** 22 + 22 manuales (12 004 líneas los técnicos), con "Empezar en 5 minutos" en cada literal; **3 573 citas `ruta:línea` verificadas** (367 nombres sueltos y 46 rutas relativas normalizadas; 2 rangos corregidos → 0 problemas). |
| 2026-09-28 | **Gráficos, PDF y Ayuda:** 35 imágenes SVG+PNG (`docs/imagenes/`, 0 marcadores sin imagen y 0 huérfanas), 22 PDF (371 páginas, 22/22 verificados con índice y anclas) + 23 HTML estilizados, y la sección **AYUDA** (`/ayuda`) integrada en la SPA con índice navegable y descarga de PDF. |
| 2026-09-28 | **Fase 5 completada (D-63):** `sincronizar_manual.sh` publica HTML/PDF/imágenes en `app/web/public/manual` sin referencias rotas; `tsc` y `npm run build` en verde; assets servidos por FastAPI verificados (`/ayuda`, HTML, PDF e imágenes `200`). Pendiente: confirmación del usuario y republicación de la imagen. |
