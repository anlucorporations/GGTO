# Incremento D-81 — Log de sincronización · Mensajería interna · Panel de gestión diaria

| Campo | Valor |
|---|---|
| Proyecto | **GGTO** (CANTV · Central Francisco Salias / Área 4) |
| Tipo | **Incremento funcional** sobre el sistema en mantenimiento (tras D-80) |
| Fase del proceso | **Fase 1 (Concepto)** de este incremento — extracción de requerimientos + entrevista |
| Estado | **Borrador v0.1** — requerimientos extraídos; **pendiente de respuestas (bloque 1)** |
| Solicitado por | Usuario (petición textual, 3 bloques) |

> Documento incremental. No reescribe `requerimientos.md`; añade los RF/RNF/RT del incremento y
> los integra por referencia. Al cerrar la entrevista se actualizarán `requerimientos.md`,
> `diccionario_datos.md`, `plan_desarrollo.md` y `estado_proyecto.md`.

---

## 1. Petición original (texto del usuario)

1. Un **mecanismo tipo log** para registrar las **sincronizaciones de los usuarios** (principalmente
   visible en la web; en la APK, en la sección **SISTEMAS**, accesible al usuario Administrador/Supervisor).
   1.1. **Modificar el panel de sincronización** para que muestre un **checklist** que compruebe:
   la **conexión con el servidor (apuntando al GCP)**, el **login correcto de la aplicación** y la
   **descarga/carga del archivo**.
2. Un **mecanismo de mensajería interna on-line**. Es el **único aspecto** que se actualizará **cada 20 s**
   para mantener informados a los usuarios.
   2.1. Sistema **unidireccional del supervisor a los técnicos** con mensajes cortos tipo chat.
   2.2. El sistema **muestra mensajes en cada actualización** a los técnicos: recordatorios de **citas
   programadas**, **resumen y estado de la sincronización**, y **alarmas según su despacho**.
3. **Usuario Administrador/Supervisor:**
   3.1. Se ejecutarán **sincronizaciones automáticas cada 30 s**.
   3.2. Se agrega la **pantalla principal del panel**, con la **gestión diaria (Asignadas vs. Cerradas
   por cada cuadrilla)** en sus **modos (Común, Referidos)**.
   3.3. Opción para **agregar Casos Especiales de forma manual**.

---

## 2. Estado actual del sistema (base sobre la que se construye)

| Pieza existente | Archivo | Relevancia |
|---|---|---|
| Tabla `sync_log` (37 tablas) + modelo `SyncLog` | `RepoTecnico/db/schema.sql:590`, `app/models/sync_entities.py:18` | **Existe pero nadie escribe en ella** — base directa del RF-39. |
| Endpoints de sincronización móvil | `app/api/routes_sync.py` | `GET /sync/cuadrilla`, `GET /sync/descarga`, `POST /sync/carga`, `POST /evidencias/upload`. Sin registro en `sync_log`. |
| Servicio de sincronización | `app/services/sync.py` | Construye descarga y aplica carga. Punto de instrumentación del log. |
| Pantalla "Dispositivo" de la APK | `app_movil/lib/features/sync/sync_screen.dart` | Muestra conexión + métricas + DESCARGA/CARGA. Base del **checklist** (RF-40). |
| Sección SISTEMAS (web) | `app/api/routes_sistemas.py`, `app/web/src/pages/Sistemas.tsx` | **Exclusiva del Super Usuario** (`require_roles()` sin args, D-69). **Conflicto** con «Admin/Supervisor» de la petición. |
| Tabla `notificacion` (outbox) | `RepoTecnico/db/schema.sql:677` | Canal `TELEGRAM/CORREO/MCP_IA`. La mensajería interna es un canal nuevo (no reutiliza envío externo). |
| Tabla `sincronizacion` | `RepoTecnico/db/schema.sql:574` | Bitácora por dispositivo/técnico (ZIP). Convive con `sync_log`. |
| Pantalla de gestión diaria | `app/web/src/pages/Widget.tsx`, `Panel.tsx`, `Operacion.tsx` | Ya existe una "Zona gestión diaria" (WIDGET). Base del RF-43. |
| Alta de casos especiales | `app/web/src/pages/Especiales.tsx`, `components/ModalCaso.tsx` | Ya hay alta manual; RF-44 formaliza/extiende. |

---

## 3. Nuevos Requerimientos Funcionales (RF-39…RF-44)

> Numeración continúa la serie (último RF = 38). Prioridad y módulo indicados.

| ID | Requerimiento | Prioridad | Módulo |
|---|---|---|---|
| **RF-39** | **Registrar (log) cada sincronización** de la APK. De cada sesión se guarda **quién** (`P00`), **la cuadrilla activa**, **desde qué dispositivo** (`dispositivo_id`, `version_app`), **tipo** (`DESCARGA` / `CARGA`), **inicio y fin**, **duración**, **resultado** (`OK` / `PARCIAL` / `ERROR`), **cantidades** (recibidos, procesados, errores) y **detalle**. El log es **consultable** desde la **web** y desde la **APK** (sección SISTEMAS), **solo** para Administrador/Supervisor (y Super Usuario). **Nota (H-04):** la web **no** genera registros propios — solo la APK sincroniza; por eso `tipo` se limita a `DESCARGA`/`CARGA` (coherente con el `CHECK` de `sync_log` en `db/schema.sql:594` y con E-05). | Alta | Sincronización / Sistemas |
| **RF-40** | **Checklist del panel de sincronización:** el panel muestra una **lista de comprobación** con el resultado paso a paso de: **(a) conexión con el servidor (endpoint GCP)**, **(b) login correcto de la aplicación**, **(c) descarga del archivo/casos**, **(d) carga del archivo/casos**. Cada ítem indica su **estado** (pendiente / en curso / OK / error), la **hora** y el **detalle** del error si lo hubiera. | Alta | Sincronización |
| **RF-41** | **Mensajería interna on-line (unidireccional supervisor → técnicos):** mensajes **cortos tipo chat** enviados por el Supervisor a los técnicos. Es el **único componente que se refresca cada 20 s**. Muestra a cada técnico, en cada actualización: **recordatorios de citas programadas**, **resumen y estado de la sincronización** y **alarmas según su despacho**. Los técnicos **no responden** (unidireccional). | Alta | Mensajería interna |
| **RF-42** | **Sincronización automática del panel cada 30 s** para el usuario Administrador/Supervisor: los datos del panel se **refrescan solos** cada 30 s sin recargar la página. | Media | Panel |
| **RF-43** | **Pantalla principal del panel — Gestión diaria:** muestra **Asignadas vs. Cerradas por cada cuadrilla**, en sus **modos (Común, Referidos)**, con totales y comparación del día. | Alta | Panel |
| **RF-44** | **Alta manual de Casos Especiales** directamente desde el panel (clasificación, prioridad, actividad, solicitante), sin depender de Telegram/MCP. | Media | Especiales |

## 4. Nuevos Requerimientos No Funcionales (RNF-26…RNF-28) y Técnicos (RT-15…RT-16)

| ID | Categoría | Requerimiento | Criterio de verificación |
|---|---|---|---|
| **RNF-26** | Rendimiento / Usabilidad | **Solo la mensajería interna** se consulta por sondeo cada **20 s**; el resto de la aplicación **no** se auto-refresca a ese ritmo. El sondeo es **incremental** (solo trae mensajes nuevos desde el último `id` visto) y su costo es despreciable. | Prueba de red: 1 petición ligera cada 20 s; sin mensajes nuevos devuelve vacío. |
| **RNF-27** | Rendimiento | La **sincronización automática del panel** (Admin/Supervisor) ocurre cada **30 s**, se **pausa** cuando la pestaña no está visible y no solapa peticiones. | Prueba: refresco a los 30 s; sin duplicar peticiones; se detiene al ocultar la pestaña. |
| **RNF-28** | Seguridad / Autorización | **RBAC del incremento:** el **log de sincronizaciones** y su panel son **exclusivos** de ADMIN/SUPERVISOR (y SUPER); el envío de **mensajes internos** es **exclusivo** del Supervisor (y ADMIN/SUPER); los TÉCNICOS solo **leen** los mensajes dirigidos a ellos. Coherente con la matriz RBAC (RNF-21/D-36). | Pruebas negativas: TECNICO recibe `403` al pedir el log o al intentar enviar mensajes. |
| **RT-15** | Transporte de mensajería | Mecanismo de actualización a **20 s**: sondeo incremental (polling) sobre `GET /api/v1/mensajes?desde=<id>`. Sin dependencias nuevas (coherente con la SPA actual). | Prueba de integración contra el endpoint. |
| **RT-16** | Datos | La mensajería interna usa **tablas nuevas** (`mensaje` + `mensaje_destino` con fan-out y lectura); el log reutiliza/expande `sync_log` y añade `sync_check` (**una fila por paso**). Todas con `id_central` (RNF-21). | DDL + prueba de creación y lectura. |

**Totales del incremento:** **6 RF** (RF-39…RF-44) · **3 RNF** (RNF-26…RNF-28) · **2 RT** (RT-15…RT-16).

---

## 5. Decisiones del incremento (entrevista resuelta — E-01…E-08)

| # | Origen | Decisión |
|---|---|---|
| **E-01** | I1 | La vista de **Sincronización** se integra **dentro de SISTEMAS** y se abre a **ADMIN/SUPERVISOR** (y SUPER). La **inspección de la base de datos** de SISTEMAS **sigue exclusiva del Super Usuario** (D-69). |
| **E-02** | I2 | **Mensajería y checklist** en **web y APK**; el **auto-refresco de 30 s es solo de la web** (panel del Supervisor/Admin). La APK no auto-refresca a 30 s. |
| **E-03** | I3 | El **Supervisor elige destinatario**: *todos* / *cuadrilla* / *técnico*. Existen **mensajes automáticos** (citas, estado de sync, alarmas por despacho) **y texto libre** del supervisor. **ADMIN y SUPER también pueden enviar** (coherente con la matriz RBAC). |
| **E-04** | I4 | **Asignadas** = casos presentes en el **despacho del día**; **Cerradas** = casos en estado **CERRADO**. **Común** = casos con `categoria = 'RESIDENCIAL'` **(decisión de cierre E-13)**; **Referidos** = casos especiales con clasificación **REFERIDO**.
| **E-05** | I5 | El log registra **solo las sincronizaciones de la APK** (tipos `DESCARGA` / `CARGA`; la subida de evidencias ocurre dentro de CARGA). La web lo **consulta**, no genera registros propios. |
| **E-06** | I6 | Mensajes automáticos: **(a)** **recordatorio de citas del mismo día** (por defecto **60 min antes**, configurable) al técnico de la cuadrilla de la cita; **(b)** **estado de la sincronización** al cerrar la DESCARGA/CARGA del propio técnico; **(c)** **alarmas por sector del despacho del día** (fallas masivas / material en su sector). |
| **E-07** | I7 | Los mensajes llevan **marca leído/no leído**; el destinatario *cuadrilla* = **cuadrilla activa del técnico**. **Retención: 5 días**, salvo los **no leídos** que se conservan hasta ser leídos o hasta el tope `mensajeria.retencion_max_dias` (30) **(decisión de cierre E-14)**. |
| **E-08** | I8 | El checklist se ejecuta **automáticamente en cada sincronización** (sin botón "Comprobar ahora"); se guarda el **último resultado** por dispositivo/usuario. |

### 5.1 Decisiones provisionales complementarias (E-09…E-12, confirmadas)

| # | Decisión provisional |
|---|---|
| **E-09** | Los intervalos **20 s (mensajería)** y **30 s (panel)** quedan **configurables** en `configuracion` (`mensajeria.poll_segundos`, `panel.sync_segundos`). |
| **E-10** | **Retención del log `sync_log` = 90 días** (configurable), con purga automática. |
| **E-11** | El **alta manual de Casos Especiales** (RF-44) **reutiliza el formulario actual** de ESPECIALES, expuesto con un **botón en el panel** de gestión diaria. |
| **E-12** | El **checklist** guarda el resultado de los 4 pasos (**conexión GCP · login · descarga · carga**) con su hora; en la APK se ve en la pantalla **"Dispositivo"** y en la web en **SISTEMAS → Sincronización**. |

### 5.2 Decisiones de cierre (E-13…E-15)

| # | Decisión |
|---|---|
| **E-13** | **Modo Común** del panel = casos con `caso.categoria = 'RESIDENCIAL'` (no "todo lo que no sea especial"). EMPRESA/GOBIERNO no entran en ninguno de los dos modos. |
| **E-14** | **Mensajes no leídos:** se conservan tras los 5 días **hasta que el destinatario los lea**, con un tope de seguridad de **30 días** (`mensajeria.retencion_max_dias`), tras el cual se borran igualmente. |
| **E-15** | **Migraciones:** se usa un **script idempotente** (estilo `scripts/migrar_d73_sync.py`) + actualización del `db/schema.sql` canónico; **Alembic** (exigido por RNF-24) queda como **tarea aparte** (desviación declarada). |

---

## 6. Respuestas de la entrevista (registro)

| # | Tema | Respuesta |
|---|---|---|
| **I1** | Ubicación del log | *Abrir "Sincronización" dentro de SISTEMAS a Admin/Supervisor.* |
| **I2** | Plataformas | *Mensajería y checklist en web y APK; auto-refresco 30 s solo en la web.* |
| **I3** | Destino/emisor | *El supervisor elige destinatario (todos / cuadrilla / técnico); automáticos (citas, estado sync, alarmas de despacho) + texto libre.* |
| **I4** | Panel gestión diaria | *Asignadas = despacho del día; Cerradas = CERRADO. Común = comunes; Referidos = clasificación REFERIDO.* |
| **I5** | Alcance del log | *Solo sincronizaciones de la APK.* |
| **I6** | Disparadores de mensajes | *Citas el mismo día + estado al cerrar su sync + alarmas por sector del despacho.* |
| **I7** | Lectura/retención | *Leído/no leído; "cuadrilla" = cuadrilla activa; **5 días** de retención y luego se borran.* |
| **I8** | Checklist | *Solo automático en cada sync.* |

---

## 7. Trazabilidad petición → requerimiento

| Petición | RF/RNF/RT |
|---|---|
| 1. Log de sincronizaciones | RF-39, RNF-28, RT-16 |
| 1.1 Checklist del panel de sync | RF-40 |
| 2. Mensajería interna 20 s | RF-41, RNF-26, RT-15, RT-16 |
| 2.1 Unidireccional supervisor→técnicos | RF-41, RNF-28 |
| 2.2 Citas · estado sync · alarmas | RF-41 |
| 3.1 Auto-sync cada 30 s | RF-42, RNF-27 |
| 3.2 Pantalla panel gestión diaria | RF-43 |
| 3.3 Alta manual de Casos Especiales | RF-44 |

---

## 8. Próximos pasos (Fase 2 del incremento)

1. **Casos de uso** (RF-39…RF-44) bajo criterio de analista funcional: un CU por objetivo de actor,
   flujo principal + alternativos, criterios **Gherkin/EARS** testeables y **trazabilidad** a RF.
2. **Extensión del documento técnico** (o anexo `documento_tecnico_D81.md`): modelo de datos
   (`mensaje` nueva, `sync_log`/`sync_check` extendidos), endpoints y diseño del sondeo 20 s / 30 s.
3. **Auditoría** de casos de uso y del diseño técnico (skill `equipo-auditoria`).
4. **Plan de desarrollo** del incremento (ciclos verticales) e **implementación** por ciclo.

## 9. Afectaciones previstas al modelo de datos

| Cambio | Detalle | Origen |
|---|---|---|
| `sync_log` (**existente, sin uso**) | Se empieza a **escribir** en cada DESCARGA/CARGA desde `app/services/sync.py`; se añaden `plataforma`, `duracion_ms` e **`id_central`** (RNF-21). | RF-39, E-05 |
| `sync_check` (**tabla nueva**) | Checklist **una fila por paso**: `id_sync_log`, `paso` (`CONEXION`/`LOGIN`/`DESCARGA`/`CARGA`), `estado` (`PENDIENTE`/`EN_CURSO`/`OK`/`ERROR`/`OMITIDO`), `fecha_hora`, `detalle`. UNIQUE `(id_sync_log, paso)`. | RF-40, C-02 |
| `mensaje` (**tabla nueva**) | `id_mensaje`, `id_central` (RNF-21), `origen_p00`, `destino_tipo` (`TODOS`/`CUADRILLA`/`TECNICO` con XOR de ids), `tipo` (`RECORDATORIO_CITA`/`ESTADO_SYNC`/`ALARMA_DESPACHO`/`TEXTO`), `cuerpo`, `id_caso`, `creado_en`, `expira_en`. | RF-41, E-06, E-07 |
| `mensaje_destino` (**tabla nueva**) | **Fan-out** de destinatarios y **marca leído/no leído**: `id_mensaje`, `id_tecnico`, `leido_en`. Reemplaza a `mensaje_lectura`. | RF-41, E-07, A-03 |
| Parámetros `configuracion` | `mensajeria.poll_segundos` (20), `panel.sync_segundos` (30), `mensajeria.retencion_dias` (5), `mensajeria.retencion_max_dias` (30, E-14), `sync_log.retencion_dias` (90), `mensajeria.recordatorio_cita_min` (60), `sync.timeout_min` (10). | E-06, E-09, E-10, E-14 |
