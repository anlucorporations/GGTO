# Incremento **D-95 … D-98** — APK de Gestión (Supervisor · Administrador · Coordinador)

> **Estado:** `v0.3.2` — **Fase 1 (Concepto) COMPLETA y AUDITADA** · **18 RF-APK nuevos (RF-APK-13…30)** ·
> **6 RNF-APK + 12 RNF nuevos del catálogo (RNF-34…RNF-45)** · **6 RT-APK** (el **RT-APK-06** es nuevo:
> DEC-G17 exige que el SUPER pueda leer la auditoría y **no existe ningún `GET` de auditoría** en el
> contrato vigente) · **19 decisiones cerradas**
> (DEC-G1…DEC-G10 + las 9 de la auditoría) · las **7 críticas**, los **12 quick wins** y los
> **12 RNF / 10 stakeholders** que faltaban, resueltos · **apto para la Fase 2**.
> *(QW-5 · H-34: el catálogo completo de la APK es **30 RF-APK**: los 12 vigentes `01…12` de D-84…D-93 más los **18 nuevos** `13…30`.)*
> **Fecha:** 2026-10-10 · **Rama:** `GGTOv2-DSH-GCP`
> **Precede:** cierre del incremento D-89…D-94 (identificador de pago 70\*, D-91 diferido).
> **Entrada:** petición del usuario (3 puntos) reproducida en §1.

> **Estado de implementación revisado el 2026-10-12:** este documento sigue siendo la especificación objetivo de V2, no una certificación de entrega. El checkout ya contiene algunas rutas y guards D-95, pero el catálogo/migración, la compatibilidad DDL de mensajería, los permisos de alta de especiales/material, la integración web y las pantallas móviles siguen incompletos. La matriz vigente por componente está en [`auditoria_estado_real_v2.md`](auditoria_estado_real_v2.md).

---

## 1. Petición del usuario (texto de entrada)

> 1. **El Supervisor** puede realizar en la APK todas las funciones esenciales que se muestran en la WEB:
>    1.1 Monitoreo de la gestión (seleccionable entre **Diaria, Semanal, Mensual, Casos especiales, Construcciones**), Gestión de Casos Especiales, Gestión de Despacho, Gestión de Casos (ver datos, asignar a cuadrilla).
>    1.2 Crear una **pantalla llamada GESTIÓN** para ver solo los casos de la **cuadrilla 0**.
> 2. **El Coordinador** puede realizar en la **APK y WEB**:
>    2.1 Monitoreo de la gestión (seleccionable entre Diaria, Semanal, Mensual, Casos especiales, Construcciones), **Crear** Casos Especiales, Gestionar **Fallas Masivas** (solo lectura y especialmente la **solicitud de materiales**).
>    2.2 **Enviar Mensajes al Supervisor**.
>    2.3 **Monitorear las Alertas.**
> 3. La APK se mantiene conectada con **actualización automática cada 5 minutos**.

---

## 2. Verificación contra el código actual (hecha antes de escribir nada)

| # | Afirmación a verificar | Evidencia real | Veredicto |
|---|---|---|---|
| V1 | El **Coordinador** existe como rol | `grep` de `coordinador\|Coordinador\|COORDINADOR` en todo el repo: **0 coincidencias**. Roles reales en `RepoTecnico/requerimientos.md:232` y `app/api/deps.py:20`: `SUPER · ADMIN · SUPERVISOR · TECNICO` | ❌ **No existe — actor nuevo** |
| V2 | Existe una APK para roles de gestión | `app_movil/` es **una sola** app Flutter «GGTO Técnico» `1.1.0+9`; `lib/core/sesion.dart:27-29` solo distingue `esTecnico` / `esSuper` / `soloLectura`; la navegación es de campo (Casos · Alertas · Mensajes · Usuario) | ❌ **No existe** |
| V3 | La APK sincroniza sola los casos (punto 3) | D-84 (`plan_mejora_apk.md:85-102`) hizo la sincronización **totalmente manual**: casos y cola solo con CARGA/DESCARGA; **solo los mensajes** se sondean (60 s) | ⚠️ **Contradice D-84** → resuelto en DEC-G4/DEC-G5 |
| V4 | La pantalla GESTIÓN (cuadrilla 0) existe en la WEB | `requerimientos.md:68` — sección **GESTIÓN** = casos de la cuadrilla 0 (RF-25, RF-37); en la SPA está fundida dentro de CASOS con el filtro «Cuadrilla 0 (supervisor)» (D-72/D-77) | ✅ Existe, **no** como pantalla propia |
| V5 | El Supervisor puede asignar casos a cuadrilla desde la ficha | `D-78` (casos) y `D-79` (especiales): pestaña **Despacho** en la ficha, `POST /despachos/asignar-casos` y `/quitar-casos` (`require_roles("ADMIN","SUPERVISOR")`) | ✅ Backend listo, **falta en la APK** |
| V6 | Fallas masivas: lectura + solicitud de material | `routes_alertas.py:43` `_escritura = require_roles("ADMIN","SUPERVISOR")`; existe `POST` de fallas y órdenes de material (`orden_material.id_falla`) | ✅ Capacidad lista; **falta acotar el rol** nuevo |
| V7 | Mensajería **Coordinador → Supervisor** | `app/api/routes_mensajes.py:3` — «**unidireccional supervisor → técnicos**»; `TIPOS_DESTINO = ("TODOS","CUADRILLA","TECNICO")` (`app/models/mensaje_entities.py:28`) | ❌ **Dirección inversa no existe** |
| V8 | Monitoreo Diaria / Semanal / **Mensual** / **Especiales** / **Construcciones** | ⚠️ **CORREGIDO (QW-10 · H-18):** `app/api/routes_monitoreo.py` expone **solo** diaria, semanal, reparación, construcción por cuadrilla y capacidad. **NO existen** monitoreo **mensual**, de **casos especiales** ni de **construcciones**, ni un selector de vistas | ❌ **La afirmación «✅ backend listo» de la v0.2 era FALSA: hay que CONSTRUIR 3 de las 5 vistas** (API + pantallas) |
| V9 | Infraestructura, repos y central | GCP `ggtov2` + Cloud Run `ggto-web`; repos GitHub/GitLab y rama `GGTOv2-DSH-GCP` ya definidos (D-20/D-43) | ✅ **No se vuelve a preguntar** |

**Conclusión:** el **backend ya soporta** casi todo lo pedido; el trabajo es **(a)** crear el rol
`COORDINADOR`, **(b)** una **capa de navegación por rol** en la APK con las pantallas de gestión,
**(c)** la **mensajería Coordinador → Supervisor** (funcionalidad nueva de extremo a extremo) y
**(d)** el **refresco automático de 5 min** acotado a las pantallas de gestión.

---

## 3. Decisiones cerradas (entrevista de Fase 1, 2026-10-10)

| # | Decisión | Respuesta del usuario | Impacto |
|---|---|---|---|
| **DEC-G1** | **Rol nuevo `COORDINADOR`** (quinto rol, con permisos propios) | Bloque 1 · G-01 | Fila en el catálogo `rol`, matriz RBAC §5.2, `ROL_ASIGNABLE`, migración idempotente y `require_roles` de los endpoints que use |
| **DEC-G2** | **Una sola APK multi-rol** | Bloque 1 · G-02 | El menú y las pantallas se arman por rol; el TÉCNICO conserva su flujo intacto; un solo ciclo de firma y publicación |
| **DEC-G3** | **El Administrador tiene el mismo alcance que el Supervisor** en la APK | Bloque 1 · G-03 | Menú de gestión completo para `ADMIN` |
| **DEC-G4** | **Online con caché de lectura** | Bloque 2 · G-04 | Las escrituras (despacho, asignar, crear especial, mensaje, orden de material) exigen conexión; hay caché local de solo lectura para consultar sin red; **el TÉCNICO mantiene CARGA/DESCARGA manual (D-84)** |
| **DEC-G5** | **Refresco de 5 min en todas las pantallas de gestión**, en primer plano, con indicador y refresco manual | Bloque 2 · G-05 | Un solo temporizador; se cancela en segundo plano; nunca se solapa consigo mismo |
| **DEC-G6** | **Una central por usuario** (`usuario.id_central`) | Bloque 2 · G-06 | ⚠️ **CORRECCIÓN H-01 (auditoría, verificada por el director):** la afirmación «cero cambios de seguridad» de la v0.2 era **FALSA**. El acotado por central **no está activo**: (a) la RLS es **inerte** — `schema.sql:767-769` admite que con `app.id_central` sin definir «la política **permite todo**» y el manual `07-Operacion/02-seguridad-y-privacidad:1298` reconoce que «ninguna parte de la aplicación ejecuta `SET LOCAL app.id_central`»; (b) `app/services/consultas.py:20-29` (`resolver_central`) acepta el `id_central` de la petición **sin compararlo** con `usuario.id_central`. **Consecuencia:** activar el acotado real es un **entregable técnico del ciclo D-95**, no una herencia |
| **DEC-G7** | **Pantalla GESTIÓN: Supervisor y Administrador, con acciones**; el Coordinador no la ve | Bloque 3 · G-07 | Asignar, quitar del despacho y abrir ficha desde la bandeja de la cuadrilla 0 |
| **DEC-G8** | **Fallas masivas: el Coordinador lee todo y escribe solo la orden de material** | Bloque 3 · G-08 | Declarar/planificar/cerrar la falla sigue siendo de `SUPERVISOR`/`ADMIN` |
| **DEC-G9** | **Mensajería de una vía: Coordinador → Supervisor** (sin respuesta en la app) | Bloque 3 · G-09 | El Supervisor ve los mensajes del Coordinador en su bandeja; **no** se habilita Supervisor → Coordinador |
| **DEC-G10** | ~~**MFA obligatorio** para `COORDINADOR`~~ → **REESCRITA por DEC-G14**: el MFA queda **diferido** (riesgo aceptado **RA-01**) | Bloque 3 · G-10 · **B1** | El Coordinador entra con `P00` + clave y 3 de las 12 palabras. Se suma a `ROL_ASIGNABLE` (`app/schemas/config.py:132`). ⚠️ **Corrección H-02:** el MFA **NO estaba implementado**; la afirmación «ya implementado» de la v0.2 era **falsa** |

---

### 3.1 Decisiones de la auditoría (bloques A, B y C — 2026-10-10)

| # | Decisión | Respuesta del usuario | Consecuencia |
|---|---|---|---|
| **DEC-G11** | **El reporte de campo de fallas masivas excluye al COORDINADOR** | A1 | El reporte `POST /fallas-masivas/reporte-campo` queda para TÉCNICO, SUPERVISOR, ADMIN y SUPER. Cierra el agujero real H-05: hoy lo puede invocar cualquier autenticado |
| **DEC-G12** | **El alcance de la APK incluye el alta manual y la edición ligera de casos** | A2 | Se añaden **RF-APK-29** y **RF-APK-30**. Quedan **fuera**: seguimiento, empresas, referidos, citas, configuración, ingesta e imprimibles del despacho |
| **DEC-G13** | **«Monitorear las alertas» = ver todo y abrir fichas, sin actuar** | A3 | El Coordinador consulta alertas diarias, fallas masivas y la bandeja; abre la ficha de la falla con casos afectados, planificación y materiales; **no** declara, planifica, cierra ni cambia el estado |
| **DEC-G14** | **El MFA se DIFIERE** a un ciclo posterior con dueño y fecha | B1 | **Riesgo aceptado RA-01.** DEC-G10 se reescribe: el Coordinador entra con `P00` + clave (bloqueo a los 3 intentos + 3 de las 12 palabras), igual que ADMIN/SUPERVISOR |
| **DEC-G15** | **Rediseño del modelo de mensajería** con destinatario-usuario, nuevos `CHECK` y fan-out al Supervisor; **Supervisor concreto con escalado al ADMIN de su central** cuando no esté | B2 | H-03 resuelto como **entregable técnico real** del ciclo D-95 (RT-APK-03 se reescribe) |
| **DEC-G16** | **El Coordinador es una cuenta de gestión SEPARADA de `tecnico`** | B3 | H-07 resuelto: nueva vía de alta de usuario de gestión. Implica que `usuario` deje de exigir una fila en `tecnico` y que el Coordinador no aparezca en cuadrillas, flota ni despacho |
| **DEC-G17** | **Gobierno:** dueño funcional y soporte de 1.º/2.º nivel = **SUPERVISOR** de la central; **keystore y publicación de la APK** = **Super Usuario**; **auditoría de las acciones del Coordinador** = **SUPER en solo lectura** sobre `auditoria` | C1 | Cierra el conflicto de que ADMIN ejecuta el despacho y a la vez audita. Se incorpora a la tabla de gobierno §5.3 de `requerimientos.md` |
| **DEC-G18** | **Rendimiento:** se aceptan **p95 ≤ 2 s**, **0 errores 5xx** y **prueba de carga obligatoria** antes del cierre de D-97 y D-98; el refresco de 5 min refresca **solo la pantalla visible** con tope de peticiones por token | C2 | **RNF-APK-06** nuevo |
| **DEC-G19** | **PII en el dispositivo: enmascaramiento visual** en pantalla; **la caché local NO se cifra** | C3 + **aclarada por la auditoría de casos de uso (H-02)** | **Riesgo aceptado RA-02, ACOTADO.** Lo que **no** se implementa: **cifrado** de la caché, **TTL** y **PIN/biometría**. Lo que **SÍ** entra (confirmado por el usuario al resolver H-02): **`FLAG_SECURE`** y **purga de la caché y de la cola al cerrar sesión** (RNF-37, H-14) |
| **DEC-G20** | **El COORDINADOR recibe `403` en `GET /casos`** (no lee el universo de casos) | **Auditoría de casos de uso · H-03** | Coherente con la matriz RBAC (CASOS «—» para el Coordinador) y con DEC-G8/G12: su trabajo con casos pasa por ESPECIALES (crear), FALLAS MASIVAS y MONITOREO. Se corrigen el Gherkin de CU-D95-22 y los casos que lo contradecían |
| **DEC-G21** | **Se construyen las vistas de MONITOREO que no existen** (mensual, casos especiales y construcciones) y se marcan como **NUEVO** | **Auditoría de casos de uso · H-06** + confirmación del usuario | Es el punto 1.1 de la petición. Se asume la ampliación de alcance (**R6**) y cada vista lleva su endpoint y su criterio propios. ⚠️ «Casos especiales» **no** es `/monitoreo/reparacion` |
| **DEC-G22** | **Se sincroniza el documento de casos de uso con el incremento v0.3.2**: se incorporan los **12 RNF-34…RNF-45**, los 10 stakeholders de §9.4 y los hallazgos H-01…H-07 de su auditoría | **Auditoría de casos de uso · H-01 (crítica, 12 huérfanos)** | Sin esto el documento no cubre el conjunto de requisitos vigente. Es el cierre de la Fase 2 |

### 3.2 Riesgos aceptados formalmente

| # | Riesgo | Decisión | Dueño | Fecha de cierre propuesta |
|---|---|---|---|---|
| **RA-01** | **Sin MFA** en ADMIN, SUPERVISOR y COORDINADOR: la cuenta se protege solo con `P00` + clave y 3 de las 12 palabras, aunque RNF-22 lo exige para los roles de gestión | DEC-G14 (B1) | Dirección del proyecto | Ciclo propio posterior a D-98; se documenta en el manual de seguridad |
| **RA-02** | **Caché local sin cifrar ni TTL**: el dispositivo guarda teléfono (70\*), nombre y dirección **en claro**; un dispositivo perdido o robado expone PII. **Acotado** por la decisión del usuario sobre H-02: `FLAG_SECURE` y la **purga al cerrar sesión SÍ se implementan**; solo quedan fuera el **cifrado**, el **TTL** y el **PIN/biometría** | DEC-G19 (C3) aclarada + **H-02** | Dirección del proyecto | Se reevalúa cuando se designe el responsable de protección de datos (pendiente externo CANTV) |

---

## 4. Requerimientos funcionales finales

### 4.1 APK de gestión — Supervisor y Administrador (mismo alcance, DEC-G3)

| ID | Requisito | Origen | Backend |
|---|---|---|---|
| **RF-APK-13** | **Monitoreo de la gestión** con selector **Diaria · Semanal · Mensual · Casos especiales · Construcciones** (las 5 vistas) | Punto 1.1 | ✅ `routes_monitoreo.py` |
| **RF-APK-14** | **Gestión de Casos Especiales**: listar, filtrar y abrir la ficha del especial, con su caso asociado | Punto 1.1 | ✅ `routes_especiales.py` |
| **RF-APK-15** | **Gestión de Despacho**: universo, asignación de sectores por cuadrilla del día, procesar y publicar el despacho | Punto 1.1 | ✅ `GET /despachos/proceso`, `PUT /despachos/asignacion`, `POST /despachos/procesar` |
| **RF-APK-16** | **Gestión de Casos**: ver los datos del caso y **asignar / quitar de cuadrilla** desde la ficha | Punto 1.1 | ✅ D-78/D-79 (`POST /despachos/asignar-casos`, `/quitar-casos`) |
| **RF-APK-17** | **Pantalla GESTIÓN** (nueva): lista **solo** los casos de la **cuadrilla 0**, con asignar / quitar del despacho | Punto 1.2 · DEC-G7 | ⚠️ existe como filtro; se promueve a pantalla |
| **RF-APK-24** | **Bandeja de mensajes del Supervisor**: recibidos del Coordinador + enviados a los técnicos | Punto 2.2 · DEC-G9 | ⚠️ requiere DDL (RT-APK-03) |
| **RF-APK-25** | **Monitoreo de Alertas** para el Supervisor/Administrador (alertas diarias, fallas masivas y bandeja de notificaciones) | **Extensión por simetría con el punto 2.3 — NO está en la petición literal** (QW-7 · H-38): el Supervisor y el Administrador ya tienen ALERTAS en la WEB (D-65/D-72) y la APK de gestión no puede quedar sin ellas | ✅ `routes_alertas.py` |

### 4.2 APK y WEB — Coordinador

| ID | Requisito | Origen | Alcance |
|---|---|---|---|
| **RF-APK-18** | **Monitoreo de la gestión** con las mismas 5 vistas (Diaria · Semanal · Mensual · Especiales · Construcciones) | Punto 2.1 | Lectura |
| **RF-APK-19** | **Crear Casos Especiales** (solicitante, clasificación, actividad, prioridad) con su caso asociado | Punto 2.1 | Escritura |
| **RF-APK-20** | **Fallas masivas — consulta completa**: listar, abrir la ficha, ver casos afectados, planificación y materiales | Punto 2.1 · DEC-G8 | Lectura |
| **RF-APK-21** | **Fallas masivas — solicitud de materiales**: crear y consultar la **orden de material** de una falla | Punto 2.1 · DEC-G8 | Escritura **acotada** |
| **RF-APK-22** | **Enviar mensajes al Supervisor** (dirección nueva), con bandeja de enviados | Punto 2.2 · DEC-G9 | Escritura |
| **RF-APK-23** | **Monitorear las Alertas** (alertas diarias, fallas masivas, bandeja de notificaciones) | Punto 2.3 | Lectura |
| **RF-APK-26** | **WEB del Coordinador**: las mismas capacidades en la SPA (puntos 2.1–2.3), con el menú y los guards por rol | Punto 2 | Mixto |

### 4.3 APK — transversal

| ID | Requisito | Origen |
|---|---|---|
| **RF-APK-27** | **Navegación por rol**: la APK habilita solo las secciones del rol autenticado; el TÉCNICO conserva su flujo de campo (D-84…D-93) sin alteración | Puntos 1 y 2 · DEC-G2 |
| **RF-APK-28** | **Indicador de frescura y refresco manual** en cada pantalla de gestión («actualizado hh:mm» + botón) | Punto 3 · DEC-G5 |
| **RF-APK-29** | **Alta manual de un caso** desde la APK de gestión (fecha, tipo, actividad, contacto, nombre, dirección, información), con el identificador `REF-…` cuando no haya avería | **Pregunta A2 de la auditoría** (amplía el alcance) | ✅ **El endpoint ya existe** (`POST /api/v1/casos`, `routes_casos.py:365`): solo falta la **pantalla** en la APK |
| **RF-APK-30** | **Edición ligera de un caso** desde la APK de gestión, limitada a **Sector · Fecha de cita · Información (200 caracteres)**, reutilizando las reglas vigentes de la ficha (D-70/D-76) | **Pregunta A2 de la auditoría** (amplía el alcance) | ✅ **El endpoint ya existe** (`PATCH /api/v1/casos/{id}`, `routes_casos.py:450`). ⚠️ `caso.informacion` **no tiene `max_length` en el esquema** (`schemas/casos.py:156`): el límite de 200 lo aplica hoy la web (`FichaCaso.tsx:449`) → la APK debe aplicarlo también, o se añade al contrato |

### 4.4 No funcionales

| ID | Requisito | Criterio | Origen |
|---|---|---|---|
| **RNF-APK-01** | **Actualización automática cada 5 min ±30 s**, **solo en primer plano**, sin solaparse consigo misma, en todas las pantallas de gestión | Prueba de temporizador con reloj simulado | Punto 3 · DEC-G5 |
| **RNF-APK-02** | **Caché de lectura** sin conexión: las pantallas de gestión muestran el último contenido con aviso de «sin conexión»; **toda escritura exige conexión** y lo informa antes de intentarla | Prueba sin red: lectura con caché, escritura bloqueada con mensaje | Punto 3 · DEC-G4 |
| **RNF-APK-03** | **Coexistencia con D-84**: el refresco automático **no** aplica al flujo del TÉCNICO (CARGA/DESCARGA manual), que permanece intacto | Prueba de que el rol TÉCNICO no emite descargas automáticas | D-84 |
| **RNF-APK-04** | **MFA obligatorio** para `COORDINADOR` (y para ADMIN/SUPERVISOR, hoy **no implementado** — H-02 de la auditoría) | Flujo de segundo factor **implementado y verificado** | RNF-22 · DEC-G10 |
| **RNF-APK-05** | Objetivos táctiles ≥48 dp, contraste ≥4.5:1 y texto ≥16 sp en las pantallas nuevas | Medición en las pantallas de gestión | RNF-23 (D-37) |
| **RNF-APK-06** | **Rendimiento y carga (H-06 · pregunta C2):** p95 ≤ 2 s y **0 errores 5xx** en las pantallas de gestión; **prueba de carga obligatoria** antes del cierre de **D-97** y **D-98**; el refresco de 5 min tiene **presupuesto de peticiones**: refresca **solo la pantalla visible**, con **tope de peticiones por token** y comportamiento definido ante fallo o falta de conexión | Prueba de carga registrada en `RepoTecnico/pruebas/`; prueba de que el refresco no encadena peticiones al fallar | C2 · RNF-08 (D-33) |

### 4.5 Técnicos / seguridad

| ID | Requisito | Impacto |
|---|---|---|
| **RT-APK-01** | Alta del rol **`COORDINADOR`** en el catálogo `rol`, en la matriz RBAC (§5.2 de `requerimientos.md`) y en `ROL_ASIGNABLE` (`app/schemas/config.py:132`) | Migración idempotente + semilla de `schema.sql` |
| **RT-APK-02** | Acotado por central: `usuario.id_central` + RLS vigente (sin cambios) | Ninguno |
| **RT-APK-03** | **Mensajería de una vía**: ampliar el modelo `mensaje` para el origen `COORDINADOR` y el destino `SUPERVISOR` (`TIPOS_DESTINO`, `ck_mensaje_destino_tipo`) con auditoría | DDL + migración idempotente + contrato |
| **RT-APK-04** | **APK multi-rol**: versión nueva (`pubspec.yaml` + `constants.dart`), firma con el keystore oficial y publicación en `app_movil/GGTOv2.apk` | Sin cambio de arquitectura de build |
| **RT-APK-05** | Ajustar `require_roles` de los endpoints usados por el Coordinador (especiales alta, fallas masivas lectura y orden de material, alertas, monitoreo) para incluir `COORDINADOR` **solo** en las acciones de DEC-G8 | Auditoría de RBAC endpoint por endpoint |
| **RT-APK-06** | **Lectura de la auditoría para el SUPER** (DEC-G17): **no existe ningún `GET` de auditoría** en el contrato vigente — hay que **crearlo** para que el SUPER pueda auditar las acciones del Coordinador | Endpoint nuevo + su prueba de RBAC |

---

### 4.6 RNF incorporados de la auditoría (**RNF-34 … RNF-45**)

El catálogo del proyecto terminaba en **RNF-33** (D-89). La auditoría detectó **12 áreas no
funcionales sin cubrir**; se incorporan al catálogo continuando su numeración (no como `RNF-APK`,
porque la mayoría son de alcance sistémico, no exclusivas de la APK):

| ID | Requisito | Hallazgo | Ciclo |
|---|---|---|---|
| **RNF-34** | **Rendimiento y capacidad**: p95 ≤ 2 s y **0 errores 5xx** en MONITOREO, DESPACHO, CASOS/GESTIÓN y ALERTAS, con concurrencia objetivo declarada y **prueba de carga con dataset versionado** | H-06, H-11 | D-96/D-97/D-98 |
| **RNF-35** | **Presupuesto de carga del refresco**: máximo de peticiones por usuario/minuto, prohibición de refrescar lo no visible o con formulario abierto, política ante fallo (backoff + aviso de antigüedad máxima) y medición de la amplificación | H-11 | D-96 |
| **RNF-36** | **Privacidad y enmascaramiento por rol**: reparto rol × dato para el COORDINADOR, minimización por diseño y **prueba negativa de enmascaramiento** | H-04 | D-96 |
| **RNF-37** | **PII en dispositivo móvil**: `FLAG_SECURE`, alcance limitado y **borrado de la caché al cerrar sesión** — **sin cifrado ni TTL** por decisión expresa (riesgo aceptado **RA-02**) | H-04 | D-96 |
| **RNF-38** | **Retención de los datos nuevos**: mensajería de gestión (origen `COORDINADOR` / destino `SUPERVISOR`) y auditoría de las acciones nuevas, con plazo y acción al vencer | H-24 | D-95 |
| **RNF-39** | **Mantenibilidad de dos arquitecturas de datos**: aislamiento de las tablas de gestión, migración versionada del esquema local y **prueba de no contaminación** entre el flujo del TÉCNICO y el de gestión | H-14 | D-96 |
| **RNF-40** | **Portabilidad**: matriz de dispositivos (rango de anchos, orientación, tableta), comportamiento responsivo de tablas y listas de gestión y prueba en un dispositivo de cada clase | H-29 | D-97 |
| **RNF-41** | **Observabilidad de las acciones de gestión**: eventos auditables (acción, actor, entidad, central, resultado, `request-id`) y alertas operativas mínimas (refresco fallido reiterado, error de escritura, intento denegado por rol) | H-26, H-27 | D-95/D-98 |
| **RNF-42** | **Backup y recuperación de los datos nuevos**: respaldo verificado antes de la migración, **rollback probado** y RPO/RTO para mensajería y auditoría — o aceptación explícita del riesgo **D-26** | H-25 | D-95 |
| **RNF-43** | **Usabilidad de las pantallas de gestión**: tareas y umbrales medibles (publicar el despacho en ≤ N toques y ≤ T s; localizar un caso de la cuadrilla 0 en ≤ T s) y **validación con 3–5 supervisores/coordinadores reales** | H-37 | D-97/D-98 |
| **RNF-44** | **Auditoría de las escrituras nuevas**: traza obligatoria en `auditoria` para el alta de especiales, la orden de material y asignar/quitar del despacho, con **prueba por acción** | H-27 | D-95 |
| **RNF-45** | **Compatibilidad de versiones del APK**: versión mínima soportada consultada al arrancar, aviso/actualización y **prueba de contrato con la APK antigua** | H-36 | D-98 |

---

## 5. Matriz RBAC propuesta (se incorpora a `requerimientos.md` §5.2)

| Módulo / acción | SUPER | ADMIN | SUPERVISOR | **COORDINADOR** | TECNICO |
|---|---|---|---|---|---|
| MONITOREO / GRÁFICOS | Lectura | Lectura | Lectura | **Lectura** | Lectura de su cuadrilla |
| CASOS (ver, asignar a cuadrilla) | CRUD | CRUD | CRUD | **—** | Lectura de sus casos |
| ESPECIALES (listar / abrir ficha) | CRUD | CRUD | CRUD | **Lectura** | — |
| ESPECIALES (crear) | CRUD | CRUD | CRUD | **CRUD (alta)** | — |
| DESPACHO | CRUD | CRUD | CRUD | **—** | Lectura de su despacho |
| GESTIÓN (cuadrilla 0) | CRUD | CRUD | CRUD | **—** | — |
| FALLAS MASIVAS (consulta) | CRUD | CRUD | CRUD | **Lectura** | Reporte |
| FALLAS MASIVAS (declarar / planificar / cerrar) | CRUD | CRUD | CRUD | **—** | Reporte |
| ORDEN DE MATERIAL de una falla | CRUD | CRUD | CRUD | **Crear / consultar** | Solicitud |
| ALERTAS (incidentes de flota/herramientas y bandeja de notificaciones) | CRUD | **CRUD** | **CRUD** | **Lectura** | **Reporte** *(no CRUD: el reporte de campo del TECNICO es la única escritura; el COORDINADOR está excluido por DEC-G11)* |
| MENSAJERÍA — enviar a técnicos | CRUD | CRUD | CRUD | **—** | — |
| MENSAJERÍA — enviar al Supervisor | — | — | — | **Crear** | — |
| MENSAJERÍA — bandeja propia | CRUD | CRUD | CRUD | **Enviados** | Recibidos |
| CONFIGURACIÓN, INGESTA, SISTEMAS, AUDITORÍA | (los vigentes, sin cambios) | | | **—** | — |

> **MFA: DIFERIDO (riesgo aceptado RA-01 · DEC-G14).** ADMIN, SUPERVISOR y COORDINADOR entran con
> `P00` + clave, bloqueo a los 3 intentos y recuperación con 3 de las 12 palabras. RNF-22 queda
> **incumplido en este incremento** por decisión expresa de la dirección del proyecto.

---

## 6. Ciclos propuestos (verticales, cada uno entregable)

| Ciclo | Objetivo | Requisitos | Criterio de cierre |
|---|---|---|---|
| **D-95** | **Rol Coordinador, contrato y seguridad base** (sin pantallas): catálogo `rol` + `ROL_ASIGNABLE`, **cuenta de gestión separada de `tecnico`** (DEC-G16), **acotado real por central** (H-01), **corrección del borrado cruzado de `cuadrilla_sector_dia`** (H-13), **guards por capacidad** —separar `_escritura` de alertas (H-09) y `_envio` de mensajería con `resolver_destinatarios` sin fallback (H-10)—, **rediseño del modelo de mensajería** (DEC-G15), exclusión del Coordinador del reporte de campo (DEC-G11), acotado de fallas y materiales, traza en `auditoria` (H-27) y gobierno del rol (DEC-G17) | **RT-APK-01/03/05** | Migración idempotente aplicada + pruebas de contrato, RBAC por endpoint (concedidos y denegados) y **aislamiento por central con dos centrales** en verde |
| **D-96** | **Esqueleto de la APK de gestión y MONITOREO**: login por rol, navegación por rol, caché de lectura **particionada por usuario y purgada al cerrar sesión** (H-14), refresco de 5 min **con presupuesto de peticiones** (H-11), y las **5 vistas de MONITOREO**, incluidas las **3 que hay que construir** (mensual, especiales y construcciones — H-18) | RF-APK-27, 28, **13**, RNF-APK-01/02/03/06 | APK con menú por rol + selector de las 5 vistas verificado; refresco con reloj simulado y solo de la pantalla visible; API de las 3 vistas nuevas en verde |
| **D-97** | **Supervisor y Administrador**: ESPECIALES, DESPACHO (**con concurrencia optimista**, H-12), CASOS + asignación, **alta manual (RF-APK-29) y edición ligera (RF-APK-30)**, pantalla GESTIÓN (anclada al criterio real de cuadrilla 0, H-16), ALERTAS y bandeja de mensajes recibidos | RF-APK-14, 15, 16, 17, 24, 25, 29, 30 | Recorrido completo sobre datos reales + `flutter test` en verde + **prueba de carga** (RNF-APK-06) |
| **D-98** | **Coordinador** (APK y WEB): crear especiales, fallas masivas + materiales, mensajes al Supervisor, alertas; **política de versión mínima del APK** (H-36); **manuales** y entrega | RF-APK-18, 19, 20, 21, 22, 23, 26 | APK firmada publicada + manuales + WEB del Coordinador verificada + **prueba de carga** |

> **QW-8 (H-35): reparto sin solape.** Cada RF-APK nuevo pertenece a **un solo** ciclo; la mensajería
> se reparte así: el **modelo y el contrato** (RT-APK-03) en **D-95**, la **bandeja del Supervisor**
> (RF-APK-24) en **D-97** y el **envío del Coordinador** (RF-APK-21/22) en **D-98**.

---

## 7. Trazabilidad petición → requisito → decisión

| Punto de la petición | Requisitos | Decisiones |
|---|---|---|
| 1.1 Supervisor: Monitoreo / Especiales / Despacho / Casos | RF-APK-13, 14, 15, 16, **29, 30** | DEC-G1, G2, G3, **G12** |
| 1.2 Pantalla GESTIÓN (cuadrilla 0) | RF-APK-17 | DEC-G7 |
| 2.1 Coordinador: Monitoreo / Crear especiales / Fallas masivas + materiales | RF-APK-18, 19, 20, 21, 26 | DEC-G1, G8, **G11, G13** |
| 2.2 Enviar mensajes al Supervisor | RF-APK-22, RF-APK-24 | DEC-G9, **G15** |
| 2.3 Monitorear las alertas | RF-APK-23 | DEC-G1, **G13** |
| **Extensión (no pedida literalmente): alertas para el Supervisor/Administrador** | RF-APK-25, RF-APK-24 | DEC-G3, G9, **G15** |
| 3. Actualización automática cada 5 min | RNF-APK-01, 02, 03, **06**, RF-APK-28 | DEC-G4, G5, **G18** |
| **Transversal: rol nuevo, alcance, seguridad y gobierno** | RF-APK-27, RT-APK-01…06, RNF-APK-04 | DEC-G6, **G14 (RA-01), G16, G17, G19 (RA-02)** + **H-01** (acotado por central) |

> ⚠️ **Reconciliación pendiente declarada (RT-APK-06):** el documento de casos de uso `casos_uso_D95.md`
> v0.2 se cerró con **5 RT-APK** (01…05) antes de que se registrara este requisito. **RT-APK-06 debe
> quedar trazado a CU-D95-19** (alta del rol y gobierno, que ya cubre DEC-G17) en la siguiente revisión
> de los casos de uso; hasta entonces es el **único requisito sin caso de uso** y queda declarado aquí,
> no silenciado.

**Sin requisitos huérfanos salvo el declarado:** los **18 RF-APK nuevos**, los **6 RNF-APK**, los
**12 RNF nuevos del catálogo (RNF-34…RNF-45)** y los **5 RT-APK (01…05)** tienen origen declarado y
decisión asociada; ninguno procede de una premisa sin verificar tras la auditoría de la §9. El
**RT-APK-06** queda **declarado** como pendiente de trazado a CU-D95-19 (nota de arriba).
Las dos únicas extensiones sobre la petición literal (RF-APK-24 y RF-APK-25) están **marcadas como
tales** (QW-7).

---

## 8. Riesgos identificados

| # | Riesgo | Mitigación |
|---|---|---|
| **R1** | El refresco de 5 min puede reabrir el defecto que D-84 corrigió (descargas automáticas masivas) | Alcance por rol explícito: el temporizador solo se instala para los roles de gestión (RNF-APK-03) |
| **R2** | Dos supervisores editando el **mismo despacho** del día al mismo tiempo | El backend ya respeta borradores/publicados y devuelve `omitidos`; la APK debe informarlo antes de procesar |
| **R3** | El Coordinador creando especiales duplicados (el técnico ya reporta por Telegram) | La idempotencia de `caso_especial` (D-90) y la deduplicación por `id_averia` ya lo acotan; añadir aviso en la APK |
| **R4** | Ampliar `ROL_ASIGNABLE` y `TIPOS_DESTINO` puede romper contratos vigentes | Migración idempotente + pruebas de contrato de los enums (`test_contratos.py`) |
| **R5** | **QW-9 (H-16):** la pantalla GESTIÓN podría inventar un criterio propio de «cuadrilla 0» y divergir del despacho | La «cuadrilla 0» **no es `id_cuadrilla = 0`**: se materializa con la cuadrilla marcada `es_supervisor` y la bandeja de gestión (`en_gestion_supervisor` / estado `EN_GESTION`), como hace `app/services/despacho.py:132-145`. La pantalla GESTIÓN usa **ese mismo criterio** y ninguna lógica propia; su criterio de pertenencia es **medible** y se prueba en CU-D95-11 |
| **R6** | **H-18:** construir 3 vistas de monitoreo nuevas (mensual, especiales, construcciones) **amplía el alcance** y puede desbordar D-96/D-97 | Se dimensiona la API y las pantallas en D-96 con criterio de cierre propio; si no cabe, la vista que no entre se entrega en D-98 con su RF marcado, sin dejarla implícita |
| **R7** | ⚠️ **`FORCE ROW LEVEL SECURITY` + nadie fija el parámetro (verificado por el director y por el documento técnico):** las tres tablas con RLS (`caso`, `despacho`, `identificador_pago`) tienen **`FORCE`**, de modo que la política aplica **incluso al propietario** (`schema.sql:781,788,797`); y **ninguna** parte de `app/services/` ejecuta `set_config` ni `SET LOCAL app.id_central` (**0 coincidencias**). Si D-95 retira la cláusula `IS NULL OR` —que es el diseño—, **la ingesta diaria, la purga y los scripts de migración se quedan sin filas** o fallan el `WITH CHECK`, y **la operación se rompe** | **Entregable obligatorio de D-95:** fijar `app.id_central` en **todos** los caminos de acceso —API por petición (`set_config(..., true)`), `services/ingesta.py`, `services/purga.py` y los scripts— **antes** de retirar la cláusula, con una única vía de escape **explícita, acotada y auditada** para el SUPER y para las tareas de sistema. Se prueba con las dos centrales **y** con la ingesta completa |
| **R8** | El nombre físico de las restricciones autogeneradas (`CHECK` en línea de `mensaje.destino_tipo` y el XOR sin nombre de `schema.sql:989-993`) **no se puede verificar en este entorno**: no hay base local | El script de migración **descubre** los nombres por `pg_constraint` en tiempo de ejecución en vez de asumirlos; queda marcado como **necesita verificación** |

---

## 9. Auditoría de Fase 1 y resolución de las 7 críticas

**Informe:** [`INFORME_OPTIMIZACION_D95_V1.md`](INFORME_OPTIMIZACION_D95_V1.md) · **Método:** 7 revisores
en paralelo → 7 verificadores adversariales → síntesis. **Resultado:** 38 hallazgos únicos
(**7 CRÍTICOS**, 16 ALTOS, 13 MEDIOS, 2 BAJOS) y **27 hallazgos descartados** en la verificación.
**Veredicto inicial: NO APTOS.** Resolución de las 7 críticas:

| ID | Crítico | Resolución | Estado |
|---|---|---|---|
| **H-01** | El **alcance por central no se aplica**: la RLS está inerte (`app_central_actual()` siempre NULL) y `resolver_central` acepta el `id_central` del cliente sin compararlo con `usuario.id_central` | **Entregable técnico nuevo del ciclo D-95:** se activa el acotado por central (comparar contra `usuario.id_central`) y se prueba con dos centrales. Se retira la afirmación «cero cambios de seguridad» de DEC-G6 | 🔧 **En alcance** |
| **H-02** | El **MFA no existe** (premisa falsa de la v0.2) | **DEC-G14:** MFA **diferido**; riesgo aceptado **RA-01** con dueño y fecha | ✅ Resuelto |
| **H-03** | La **mensajería Coordinador → Supervisor es irresoluble** con el modelo actual | **DEC-G15:** rediseño del modelo (destinatario-usuario, nuevos `CHECK`, fan-out al Supervisor) con **Supervisor concreto y escalado al ADMIN** | ✅ Resuelto |
| **H-04** | **PII sin proteger** en las pantallas nuevas (caché en claro, sin `FLAG_SECURE`, sin purga) | **DEC-G19:** **solo enmascaramiento visual**; el resto se acepta como **riesgo RA-02** con dueño y fecha | ⚠️ **Riesgo aceptado** |
| **H-05** | Contradicción **«solo lectura» vs orden de material** | **DEC-G8 + DEC-G11 + DEC-G13:** se fija el alcance exacto del Coordinador (lee todo, escribe solo la orden de material; el reporte de campo lo pierde) y se corrige la redacción de §1 | ✅ Resuelto |
| **H-06** | **SLO sin reconfirmar** ni probar | **DEC-G18:** **RNF-APK-06** con p95 ≤ 2 s, 0 errores 5xx y **prueba de carga obligatoria** en D-97 y D-98 | ✅ Resuelto |
| **H-07** | El rol **COORDINADOR no tiene camino de alta** ni gobierno | **DEC-G16** (cuenta de gestión separada de `tecnico`) y **DEC-G17** (dueño, soporte, keystore y auditoría) | ✅ Resuelto |

### 9.1 Comprobaciones directas del director (no delegadas)

Los tres críticos que definen la migración de **D-95** los verifiqué personalmente contra el código
antes de aceptar el diagnóstico del auditor:

| Crítico | Evidencia verificada | Conclusión |
|---|---|---|
| **H-01 · alcance por central** | `RepoTecnico/db/schema.sql:774-785` (`app_central_actual()` = `current_setting('app.id_central')` y la política `USING (app_central_actual() IS NULL OR id_central = app_central_actual())`); el propio comentario `:767-769` admite que sin el parámetro **«la política permite todo»** y manda eliminar la cláusula `IS NULL` antes de producción; `app/web/public/manual/07-Operacion/02-seguridad-y-privacidad.html:1298` reconoce que **«ninguna parte de la aplicación ejecuta `SET LOCAL app.id_central`»**; `app/services/consultas.py:20-29` acepta el `id_central` de la petición sin compararlo con `usuario.id_central` | ✅ **Confirmado**: la RLS es **diseño, no control activo**. Activar el acotado es entregable de D-95 |
| **H-03 · mensajería** | `app/models/mensaje_entities.py:28` (`TIPOS_DESTINO = ("TODOS","CUADRILLA","TECNICO")`), `:60` (`ck_mensaje_destino_tipo`), `:67-72` (`ck_mensaje_destino_xor` **sin rama** para un destino sin `id_cuadrilla` ni `id_tecnico`) y `:84-85` (`MensajeDestino.id_tecnico` es **clave primaria con FK a `tecnico`**) | ✅ **Confirmado**: un Supervisor **no puede** ser destino sin cambiar el modelo |
| **H-07 · alta del Coordinador** | `app/models/entities.py:80`: `Usuario.id_tecnico` es **nullable**; `:76`: `usuario.p00` **no** es FK a `tecnico`. En cambio `app/api/routes_auth.py:187` (`/auth/setup` crea la fila `Tecnico` con rol TECNICO) y `app/api/routes_config.py:350` (la asignación de rol cuelga de `/tecnicos/{id}`) | ✅ **Matizado a mejor**: el **esquema ya admite** la cuenta de gestión sin fila en `tecnico`; lo que falta es el **flujo de alta** y descolgar la asignación de rol de `/tecnicos/{id}`. **D-95 es más barato de lo diagnosticado** |

---

### 9.2 Hallazgos ALTOS que **cambian el alcance** o destapan defectos reales

Se incorporan como trabajo de los ciclos, no como notas:

| ID | Hallazgo | Impacto en el alcance | Ciclo |
|---|---|---|---|
| **H-18** | **Las «5 vistas» de MONITOREO no existen**: no hay selector ni endpoints de monitoreo **mensual**, **especiales** ni **construcciones** (`routes_monitoreo.py` solo expone diaria, semanal, reparación, construcción por cuadrilla y capacidad). Mi RF-APK-13 las dio por existentes: era **falso** | ⚠️ **Se amplía D-97/D-98**: hay que **construir** el monitoreo mensual, de especiales y de construcciones (API + pantallas) | **D-96/D-97** |
| **H-09** | El `_escritura` **compartido** de alertas: añadir `COORDINADOR` a `routes_alertas.py:43` le abriría **declarar, planificar y cerrar** fallas → **elevación de privilegios** | RT-APK-05 se reescribe: se **separa** el guard por operación; el Coordinador solo obtiene la lectura y la orden de material | **D-95** |
| **H-10** | Ampliar `_envio` daría al Coordinador difusión a `TODOS`/`CUADRILLA`/`TECNICO`, y el **fallback** de `resolver_destinatarios` haría fan-out a **todos los técnicos** ante un destino nuevo | DEC-G15 exige un guard **dedicado** (no el compartido) y **eliminar el fallback** para el destino `SUPERVISOR` | **D-95** |
| **H-13** | **Defecto real, y PEOR de lo diagnosticado (verificado por el director):** `guardar_asignacion`/`asignacion_guardada` **no filtran `id_central`** — guardar la asignación de una central **borra** la de las demás centrales del mismo día; y además la tabla tiene **`UNIQUE (fecha, id_sector)` SIN la central** (`schema.sql:509`), así que **dos centrales no pueden ni asignar el mismo sector el mismo día**: el defecto es **latente**, no solo de borrado | Se corrige en D-95 junto con el acotado por central (H-01): filtrar por central **y** reemplazar el `UNIQUE` por `(fecha, id_central, id_sector)` | **D-95** |
| **H-12** | Dos supervisores sobre el mismo despacho del día: **sin bloqueo optimista**, con *check-then-act* y con `DELETE`+reinserción destructiva | Se añade control de concurrencia y se convierte el borrado en no destructivo (o se informa el conflicto) | **D-97** |
| **H-08 / H-21** | La matriz promete «—» al Coordinador en CASOS/DESPACHO/CONFIGURACIÓN, pero **las lecturas solo exigen autenticación** y el guard web niega **por excepción** (solo TECNICO); la fila ALERTAS contradice los `require_roles` reales | Se reescriben los guards **por enumeración** (no por excepción) y se corrige la matriz | **D-95/D-96** |
| **H-16** | «Cuadrilla 0» **no es `id_cuadrilla = 0`**: se materializa por `es_supervisor`/marca de gestión, y RF-APK-17 no tenía criterio de pertenencia medible | RF-APK-17 se ancla al criterio real del despacho (`en_gestion_supervisor` y la cuadrilla `es_supervisor`), con criterio medible | **D-97** |
| **H-14** | **Una APK con dos arquitecturas de datos**: la caché SQLite **no está particionada por usuario** y **sobrevive al cierre de sesión** | Se añade partición por usuario y purga de la caché en el cierre de sesión (aunque **sin cifrado**, RA-02) | **D-96** |
| **H-11** | El refresco de 5 min **no tiene presupuesto ni límite de tasa**: el único limitador es en memoria y solo en login/primer-acceso, con pool 5+5 | Se implementa el presupuesto de peticiones de RNF-APK-06 (solo pantalla visible, tope por token) | **D-96** |
| **H-36** | **Coexistencia de versiones del APK** sin mecanismo de versión mínima (RNF-30 de D-89) | Se añade versión mínima/negociación para no dejar APK antiguas sin aviso | **D-98** |
| **H-23** | ⚠️ **Defecto de seguridad preexistente (no de este incremento):** el **webhook de Telegram** y el endpoint **MCP** **fallan abiertos** si falta el secreto y devuelven **nombre, teléfono y dirección** del suscriptor a un tercero, **sin filtro de central** | **Fuera del alcance de D-95…D-98**, pero se escala a la dirección del proyecto como incidente de PII con prioridad propia | **Incidente aparte** |

---

Con las 7 críticas cerradas y las 9 preguntas de la auditoría resueltas, el incremento queda
**APTO CON OBSERVACIONES** para la Fase 2. Los **12 quick wins**, las **22 mejoras** y el **roadmap**
del informe se incorporan como tareas de los ciclos D-95…D-98.

### 9.3 Superficie exacta de migración de D-95 (verificada línea a línea)

Punto de partida real del DDL que deberá aplicar la migración idempotente de **D-95**
(convención vigente: `scripts/migrar_dXX_*.py`, simulación por defecto, `--aplicar --si`, log en
`RepoTecnico/BaseOperaciones/` y reflejo en `db/schema.sql`):

| # | Objeto | Estado vigente (evidencia) | Cambio de D-95 |
|---|---|---|---|
| 1 | Catálogo **`rol`** | 4 filas: `SUPER`, `ADMIN`, `SUPERVISOR`, `TECNICO` (`schema.sql:872-876`) | **Insertar `COORDINADOR`** (idempotente, `ON CONFLICT DO NOTHING`) |
| 2 | `app/schemas/config.py` **`ROL_ASIGNABLE`** | `Literal["TECNICO","SUPERVISOR","ADMIN"]` (`:132`); `SUPER` excluido a propósito (D-68) | Añadir `COORDINADOR` |
| 3 | **`mensaje.destino_tipo`** | `CHECK (destino_tipo IN ('TODOS','CUADRILLA','TECNICO'))` **en línea** en la columna (`schema.sql:978`) | El `CHECK` en línea tiene nombre autogenerado: hay que **DROP + ADD CONSTRAINT** sobre una tabla **viva con PII** → ensayo previo y ventana (H-15). Se añade `SUPERVISOR` |
| 4 | **`ck_mensaje_destino_xor`** | Tres ramas (TODOS/CUADRILLA/TECNICO), sin rama para un destino sin cuadrilla ni técnico (`schema.sql:989-993`; ORM `mensaje_entities.py:67-72`) | **Nueva rama** `destino_tipo = 'SUPERVISOR'` con su columna de destinatario |
| 5 | **`mensaje_destino`** | **PK compuesta `(id_mensaje, id_tecnico)`** con FK a `tecnico` (`mensaje_entities.py:81-86`) — el fan-out es **por técnico** | Añadir el destinatario de gestión (p. ej. `p00`/`id_usuario`) y la marca de lectura; el fan-out pasa a ser polimórfico |
| 6 | **`usuario`** | `id_tecnico` **nullable** y `p00` **sin FK** a `tecnico` (`entities.py:76,80`); **pero `Usuario` NO tiene `nombre` ni `apellido`** — viven solo en `Tecnico` (`entities.py:58-70`) | ⚠️ **SÍ hay cambio de esquema (corrección de la v0.3.1, que decía «sin cambio»):** la cuenta de gestión **no tiene dónde guardar el nombre**, así que hay que **añadir `nombre`/`apellido` a `usuario`** (o equivalente). Además falta el **flujo de alta** (`/auth/setup` exige fila en `tecnico`, `routes_auth.py:177-181`) y **descolgar la asignación de rol** de `/tecnicos/{id}` (`routes_config.py:365`). Lo que **ya funciona**: el primer acceso cae en la rama `PENDIENTE/puede_registrarse` cuando hay `usuario` sin `tecnico` (`routes_auth.py:266-292`) y `/auth/setup` **conserva el rol** si el `Usuario` ya existe (`:201-203`) |
| 7 | **`cuadrilla_sector_dia`** | `guardar_asignacion`/`asignacion_guardada` **sin filtro `id_central`** (`services/despacho.py:225-334`) | Corregir el `SELECT`/`DELETE` por central (H-13) — **con prueba de dos centrales** |
| 8 | **`caso` / `despacho`** (RLS) | Políticas con `app_central_actual() IS NULL → permite todo` (`schema.sql:783-805`) | Activar el acotado real (H-01): `SET LOCAL app.id_central` por petición y retirada de la cláusula `IS NULL` |

### 9.4 Stakeholders y responsabilidades incorporados

La auditoría detectó **10 actores o responsabilidades sin representar**. Resolución:

| # | Faltaba | Resolución | Estado |
|---|---|---|---|
| 1 | **ACT-07 Coordinador** como actor formal (H-07) | Añadido a `requerimientos.md` §2 con su gobierno | ✅ |
| 2 | **Administrador del catálogo de roles** (H-07) | Es el **Super Usuario** (acceso total, D-50). **D-95 no crea un CRUD del catálogo `rol`**: la migración solo inserta la fila | ✅ |
| 3 | **Dueño funcional del Coordinador** (H-22) | **DEC-G17**: SUPERVISOR de la central; fila nueva en `requerimientos.md` §5.3 | ✅ |
| 4 | **Soporte de 1.º y 2.º nivel de la APK de gestión** (H-30) | **DEC-G17**: SUPERVISOR de la central. El **canal formal de tickets sigue pendiente** (el soporte vigente es informal por correo) | ⚠️ Parcial |
| 5 | **Custodio del keystore y responsable de publicación** (H-30) | **DEC-G17**: Super Usuario. ✅ **CORRECCIÓN del 2026-10-11:** el keystore oficial **SÍ está** en `RepoTecnico/credenciales/ggto-tecnico-release.jks` (cabecera JKS verificada) → **la firma en release de D-98 no está bloqueada**. Se retira la afirmación anterior de que faltaba | ✅ |
| 6 | **Responsable de protección de datos y firmante del DPA** (H-04) | **Pendiente externo de CANTV.** Es lo que impide cerrar el riesgo aceptado **RA-02** | ⛔ Externo |
| 7 | **Suplente o escalado del Supervisor ausente** (H-03) | **DEC-G15**: el mensaje del Coordinador escala al **ADMIN de su central** cuando no hay Supervisor disponible | ✅ |
| 8 | **Cuadrillas y técnicos afectados por el cambio del despacho** (H-31) | Se incorpora a **D-97** la notificación a la cuadrilla afectada al asignar, mover o quitar casos (mensaje interno o marca visible al descargar) | ✅ En alcance |
| 9 | **Auditor interno independiente del ejecutor** (H-27) | Las acciones del **COORDINADOR** las audita el **SUPER** (DEC-G17). ⚠️ **Persiste** el conflicto sobre el **despacho**, que ejecuta y audita ADMIN: en v1 no hay rol AUDITOR (D-39) | ⚠️ Parcial |
| 10 | **Responsable de la instancia provisional sin respaldo** (H-25) | El riesgo aceptado **D-26** se **extiende a los datos nuevos** vía **RNF-42** (respaldo verificado y rollback probado antes de la migración) | ✅ |

### 9.5 Alta de la cuenta de gestión — diseño verificado (DEC-G16)

El flujo real, comprobado línea a línea, y **en qué se apoya D-95**:

| Paso | Estado vigente (evidencia) | Qué falta |
|---|---|---|
| 1. **Pre-alta** de la cuenta de gestión | **No existe**. `PATCH /tecnicos/{id}/rol` (`routes_config.py:349-383`) **exige una fila en `tecnico`** (`_o_404(db, Tecnico, id_tecnico)` en `:365`) y crea el `Usuario` con `id_tecnico=obj.id_tecnico` (`:379`) | **Endpoint nuevo** de pre-alta de usuario de gestión (SUPER/SUPERVISOR): crea el `Usuario` con `id_tecnico=NULL`, `id_rol=COORDINADOR`, `id_central`, clave aleatoria inalcanzable y **nombre/apellido** |
| 2. **Comprobación del primer acceso** | ✅ **Ya funciona**: `GET /auth/primer-acceso` (`routes_auth.py:246-295`) busca `tecnico` **y** `usuario` por separado; con `usuario` sin `tecnico` cae en la rama `PENDIENTE` con `puede_registrarse=True` (`:288-295`) | Solo el **nombre**: hoy se lee de `tecnico` (`:264`) y devolvería `null` |
| 3. **Alta de la clave y las 12 palabras** | ✅ **Ya funciona**: `POST /auth/setup` con el `Usuario` ya existente **no** exige `tecnico` (la comprobación de `tecnico` está en la rama `usuario is None`, `:176-199`) y **conserva el rol** al solo actualizar clave y correo (`:201-204`) | Nada |
| 4. **Nombre del usuario** | ⚠️ `Usuario` **no tiene `nombre`/`apellido`** (`entities.py:76-89`); `GET /auth/me` y el primer acceso los leen de `tecnico` | **Cambio de esquema**: añadir `nombre`/`apellido` a `usuario` (o tabla de perfil de gestión) |

**Conclusión de diseño:** DEC-G16 cuesta **menos** de lo que parecía en la API (los pasos 2 y 3 ya
sirven) pero **exige una migración de esquema** que la v0.3.1 no había visto (el nombre no tiene dónde
vivir). Sin nombre, la APK mostraría el `P00` como nombre del Coordinador (`sesion.dart:22-25` hace
precisamente ese respaldo), lo que es funcional pero pobre para un rol de gestión.

### 9.6 Defectos colaterales detectados al modelar (los cierra D-95)

Aparecieron al dibujar los diagramas de secuencia (ver [`casos_uso/diagramas_D95.md`](casos_uso/diagramas_D95.md)
§8). **Están fuera del alcance funcional de la APK**, pero son de la misma clase que H-01/H-13 —el
sistema está diseñado **multi-central desde el inicio** (D-06) y hay lugares donde la central está
**fija**—, así que se cierran en **D-95** aprovechando la corrección del acotado:

| # | Defecto | Evidencia | Corrección |
|---|---|---|---|
| **C-1** | El **imprimible del despacho** lleva el rótulo **`Central: FRANCISCO SALIAS` fijo** en el HTML, en vez de la central real del despacho | `app/api/routes_despachos.py:486` | Tomar el nombre de `despacho.central` |
| **C-2** | El aviso de **Telegram/MCP** antepone **`GGTO — Central Francisco Salias`** fijo | `app/api/routes_alertas.py:402` | Tomar el nombre de la central del caso o del despacho |

> ⚠️ **C-2 se relaciona con el incidente H-23** (los canales externos fallan abiertos y devuelven PII a
> un tercero): la corrección de la central y el cierre por defecto del canal deben hacerse **juntos**.

---

## 10. Historial del documento

| Versión | Fecha | Cambio |
|---|---|---|
| **v0.1** | 2026-10-10 | Extracción de requerimientos, verificación V1–V9, ciclos propuestos y **bloque 1** de la entrevista. |
| **v0.2** | 2026-10-10 | **Fase 1 cerrada**: decisiones **DEC-G1…DEC-G10**, requerimientos finales (23 RF + 5 RNF + 5 RT), matriz RBAC del Coordinador, ciclos D-95…D-98, trazabilidad sin huérfanos y riesgos R1–R5. |
| **v0.3** | 2026-10-10 | **Auditoría adversarial incorporada** (`INFORME_OPTIMIZACION_D95_V1.md`: 38 hallazgos, 7 críticos) y **9 decisiones nuevas** (DEC-G11…DEC-G19) de los bloques A, B y C. Alcance ampliado (**RF-APK-29/30**: alta y edición ligera de casos), **RNF-APK-06** de rendimiento con prueba de carga obligatoria, **2 riesgos aceptados formales** (RA-01 MFA diferido, RA-02 caché sin cifrar), corrección de la premisa falsa del MFA y sección §9 con la resolución de las 7 críticas. Veredicto: **APTO CON OBSERVACIONES**. |
| **v0.3.1** | 2026-10-10 | **12 quick wins ejecutados** y **§9.2** con los ALTOS que cambian alcance o destapan defectos. Correcciones a afirmaciones falsas de la v0.2: **(V8/H-18)** las «5 vistas» de MONITOREO no existen — 3 hay que **construirlas**; **(DEC-G6/H-01)** el acotado por central no estaba activo; **(H-34)** el conteo pasa a **18 RF-APK nuevos (13…30)** sobre 30 del catálogo; **(H-21)** fila ALERTAS corregida contra los `require_roles` reales; **(H-38)** origen de RF-APK-25 marcado como **extensión no pedida**; **(H-35)** reparto de ciclos **sin solape**; **(H-16)** criterio de la cuadrilla 0 corregido a `es_supervisor` + `en_gestion_supervisor`. Se añaden el riesgo **R6** y las comprobaciones directas del director (§9.1: H-01, H-03 y **H-07 matizado a mejor**). Se añade **§9.3** con la superficie exacta de migración de D-95. |
| **v0.3.2** | 2026-10-10 | **RNF y stakeholders faltantes incorporados** (H-24…H-31, H-37): **§4.6** con **RNF-34…RNF-45** (rendimiento, presupuesto del refresco, enmascaramiento por rol, PII en móvil, retención, mantenibilidad de dos arquitecturas, portabilidad, observabilidad, backup/rollback, usabilidad medible, auditoría de escrituras y compatibilidad de versiones) y **§9.4** con los **10 stakeholders** resueltos (**ACT-07 Coordinador** en `requerimientos.md` §2, gobierno en §5.3 y matriz **§5.2.1**). Quedan **3 parciales y 1 externo** declarados: canal de tickets, keystore oficial ausente en este entorno, auditoría del despacho por ADMIN y el responsable de protección de datos de CANTV. |
