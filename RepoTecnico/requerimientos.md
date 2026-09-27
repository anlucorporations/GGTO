# Requerimientos — Plataforma GGTO (Gestión de Averías y Puntos Ópticos)

| Campo | Valor |
|---|---|
| Proyecto | **GGTO** — Sistema de administración de reportes de avería y construcción de puntos ópticos |
| Cliente | **CANTV C.A.** — Central **Francisco Salias (Área 4)** |
| Fuente | `RepoTecnico/BRIEF-GGTO-INICIAL.md` |
| Muestra de datos | `RepoTecnico/muestras/detalle_averias_gpon_EJEMPLO.csv` (80 columnas, pseudonimizada, delimitador `;`) |
| Infraestructura | Proyecto GCP **GGTOv2** (`ggtov2`) + PostgreSQL (Cloud SQL) — ver `GGTOv2_GCP.md` |
| Fase | Fase 1 — Concepto |
| Estado | **v1.0 — validado por el cliente** (entrevista bloques 1–5 + auditoría V1) |
| Decisiones | D-01..D-31 (ver `estado_proyecto.md` y §8) |

> Este documento es la **guía principal de desarrollo**. Se actualiza de forma incremental.
> Convención de identificadores: `RF-xxx` (funcional), `RNF-xxx` (no funcional, ISO 25010), `RT-xxx` (técnico).

---

## 1. Visión general

Crear una **plataforma web multiplataforma** para la administración de reportes de avería GPON y de
solicitudes de construcción de puntos ópticos de la Central Francisco Salias (Área 4), que:

1. Ingeste diariamente el archivo matriz `detalle_averias_gpon_<fecha>.csv` y conserve solo los casos
   de la central configurada.
2. Administre personal, cuadrillas (técnicos + flota + herramientas) y el **despacho diario**.
3. Genere **rutas/sectores** de atención agrupando casos por cercanía de dirección.
4. Dé **seguimiento a casos especiales** (REPARACIÓN / CONSTRUCCIÓN) clasificados como
   REFERIDOS, EMPRESAS y GOBIERNOS, ingresados manualmente por personal externo.
5. Genere reportes de gestión diaria, semanal y mensual, con tableros y gráficos.
6. Opere desde **PC, web móvil, app Android (APK con sincronización asíncrona/offline)**,
   **Telegram** y un canal de **IA vía WEB-MCP**.

> El brief menciona originalmente "almacenamiento basado en hoja de Excel". El contexto y la
> infraestructura ya preparada (`GGTOv2_GCP.md`) establecen **PostgreSQL** como base de datos.
> **Confirmado en la entrevista** (P1.1 / decisión D-01): se descarta Excel como almacenamiento.

---

## 2. Actores

| ID | Actor | Descripción | Canal |
|---|---|---|---|
| **ACT-01** | **Supervisor de la central** | Carga el CSV diario, crea perfiles/accesos, gestiona flota, cuadrillas e insumos, genera reportes, ejecuta el despacho diario, gestiona fallas masivas y la "cuadrilla 0". | Web PC / App móvil |
| **ACT-02** | **Técnico de campo** | Miembro de una cuadrilla. Consulta casos, contacta y agenda, documenta actividad/resolución, captura evidencias, alerta fallas masivas e incidentes, solicita material, sincroniza el dispositivo. | App Android / Web móvil / Telegram |
| **ACT-03** | **Personal externo solicitante** | Reporta casos especiales (referidos, empresas, gobiernos) indicando **Unidad + Nombre + Contacto**; recibe notificación de lo realizado. | Telegram / WEB-MCP (IA) |
| **ACT-04** | **Administrador del sistema** | Configura el entorno (central, técnicos, flota, cuadrillas, catálogos, roles). | Web PC |
| **ACT-05** | **Sistema (automático)** | Ingesta, detección de duplicados, sectorización, propuesta de despacho, gestión automatizada, mensajería, generación de reportes. | Backend |
| **ACT-06** | **Integración IA (WEB-MCP)** | Canal conversacional que interpreta y registra casos especiales y consultas. | MCP sobre web |

---

## 3. Módulos / secciones funcionales

### 3.1 Secciones de la interfaz (10)

| Sección | Nombre | Descripción (del brief) | RF |
|---|---|---|---|
| 0 | **PANEL** | Búsqueda de caso por `id_averia` o `teléfono`; actualización de casos; alta manual de casos nuevos. | RF-30, RF-31, RF-32 |
| 0.1 | **MONITOREO** | Tarjetas/zonas con datos y tablas: GESTIÓN DIARIA, GESTIÓN SEMANAL, CASOS GLOBALES, REPARACIÓN, CONSTRUCCIÓN, CUADRILLA. | RF-26, RF-28 |
| 0.2 | **GRÁFICOS** | Visualizaciones: barras, curva y torta. | RF-26 |
| 1 | **CASOS** | Data principal de casos y su resolución (Construcción/Reparación · Residencial/Empresa/Referidos). | RF-33 |
| 2 | **DESPACHO** | Distribución del universo de averías entre cuadrillas por sectores; despacho imprimible + histórico. | RF-08, RF-09, RF-10, RF-24, RF-27 |
| 3 | **SEGUIMIENTO** | Casos pasados a otras instancias (en cola) para seguimiento. | RF-34 |
| 4 | **EMPRESAS** | Resumen de reparación/construcción tipo Empresa + registro de cita. | RF-35 |
| 5 | **REFERIDOS** | Resumen de reparación/construcción tipo Referido sin `id_averia`, priorizados + cita. | RF-36 |
| 6 | **CONFIGURACIÓN** | CENTRAL · TÉCNICOS · FLOTA · CUADRILLA. | RF-02, RF-03, RF-04, RF-38 |
| 7 | **GESTIÓN** | Casos de la "cuadrilla 0" (supervisor) que no se despachan a calle. | RF-25, RF-37 |

### 3.2 Módulos funcionales transversales (7)

| Módulo | Descripción | RF |
|---|---|---|
| **INGESTA** | Carga y depuración del CSV diario, deduplicación y sectorización. | RF-01, RF-21, RF-22, RF-23, RF-29 |
| **GESTIÓN AUTOMATIZADA** | Criterio combinado de la cuadrilla 0. | RF-25 |
| **GESTIÓN TÉCNICA** | Flujo de campo de la app móvil (contactar, atender, cerrar, enrutar, diferir, evidencias, offline). | RF-11…RF-15, RF-20 |
| **ALERTAS** | Fallas masivas, incidentes de flota/herramientas, solicitud de material. | RF-16…RF-19 |
| **SEGURIDAD** | Autenticación, bloqueo, 12 palabras, roles y sesiones. | RF-20, RNF-01…RNF-05, RNF-21, RNF-22 |
| **INSUMOS** (v2) | Inventario, órdenes de material y entrega. | RF-05, RF-18 |
| **REPORTES** | Reportes de capacidad, función diaria, producción y trabajo diario/semanal/mensual. | RF-07, RF-27, RF-28 |

---

## 4. Requerimientos Funcionales

### 4.1 Funciones del Supervisor (ACT-01)

| ID | Requerimiento | Prioridad | Módulo |
|---|---|---|---|
| **RF-01** | Cargar el documento de casos diarios `detalle_averias_gpon_<fecha>.csv` (fecha variable). | Alta | Ingesta |
| **RF-02** | Crear perfiles y accesos de los trabajadores (alta, edición, roles, credenciales). | Alta | Configuración |
| **RF-03** | Gestionar las flotas (vehículos de la central). | Alta | Configuración |
| **RF-04** | Gestionar las cuadrillas (trabajadores + flota + herramientas). | Alta | Configuración |
| **RF-05** | Gestionar insumos: inventario, ingreso por orden de material y entrega a trabajadores. **Para una 2.ª versión.** | Baja (v2) | Insumos |
| **RF-06** | Gestionar la ingesta/asignación de casos especiales solicitados por otras instancias (**Referidos** de reparación, **construcción residencial**, **construcción empresa**, **GOBIERNOS**, etc.) vía Telegram o IA (WEB-MCP). | Alta | Referidos/Empresas |
| **RF-07** | Generar reportes de: Capacidad Operativa (cuadrilla + sectores), estado de flotas y herramientas, y función diaria (cuadrilla + despacho del día). | Alta | Monitoreo |
| **RF-08** | Gestionar el **Despacho Diario**: asignar un grupo de casos a las cuadrillas activas por día, agrupando por áreas geográficas/sectores. | Alta | Despacho |
| **RF-09** | Gestionar las **fallas masivas**: detectarlas automáticamente por **concentración de casos** tras la ingesta y también por **reporte manual** del técnico vía MCP/Telegram; asignarlas a la cuadrilla con mayor **proximidad de sector**. | Media | Despacho |
| **RF-10** | Enviar por **Telegram o correo** la ficha de la cuadrilla y los sectores a atender en el día. | Media | Despacho |

### 4.2 Funciones del Técnico de campo (ACT-02)

| ID | Requerimiento | Prioridad | Módulo |
|---|---|---|---|
| **RF-11** | Gestionar/consultar la ficha de los casos asignados a su cuadrilla. | Alta | Gestión técnica |
| **RF-12** | Contactar y acordar hora de encuentro con el cliente; gestionar agenda interna. | Alta | Gestión técnica |
| **RF-13** | Documentar la actividad realizada en cada caso. | Alta | Gestión técnica |
| **RF-14** | Capturar registro fotográfico marcado con GPS + fecha y hora. **No se permite cargar imágenes desde galería.** | Alta | Gestión técnica |
| **RF-15** | Documentar la resolución del caso. | Alta | Gestión técnica |
| **RF-16** | Alertar casos de **falla masiva** por **Telegram** o WEB-MCP. | Media | Alertas |
| **RF-17** | Documentar la planificación de atención (reporte simple + evidencias fotográficas) para fallas masivas. | Media | Alertas |
| **RF-18** | Preparar la **solicitud de material** según el caso. | Media | Insumos |
| **RF-19** | Alertar incidentes con flotas o herramientas (reporte simple + evidencias fotográficas). | Media | Alertas |
| **RF-20** | **Login** con `P00` + clave; máximo **3 intentos** y luego bloqueo; desbloqueo con 3 de las 12 palabras de seguridad; posibilidad de bloquear la app para no exponer datos del cliente. | Alta | Seguridad |
### 4.3 Funciones del Sistema (ACT-05)

| ID | Requerimiento | Prioridad | Módulo |
|---|---|---|---|
| **RF-21** | Procesar el archivo CSV diario, extrayendo **solo los casos de la central** configurada (region, estado geográfico, capital, municipio, parroquia, estado operativo, distrito, área, central, nombre central). | Alta | Ingesta |
| **RF-22** | Insertar **solo los casos nuevos**, usando `id_averia` como clave de comparación (deduplicación). | Alta | Ingesta |
| **RF-23** | Actualizar los sectores de trabajo según el documento central, a partir de las direcciones de los casos activos. | Alta | Despacho |
| **RF-24** | Proponer la distribución de los casos (despacho diario) entre las cuadrillas declaradas. | Alta | Despacho |
| **RF-25** | **Cuadrilla 0 (supervisor) — criterio combinado (D-22).** Un caso va a la cuadrilla 0 si cumple **cualquiera** de: **(a) PROCEDIMIENTO 3** — no contiene ninguna frase de `despacho.frases_campo` (`LOSS ROJO`, `FALLA FIBRA`, `Fibra Dañada`), es decir, no amerita maniobra en casa; **o (b) GENERALIDADES 3.5** — contiene alguna frase de `despacho.frases_supervisor` (`NAVEGACION LENTA`, `PON INTERMITENTE`, `SIN TONO`…) o el caso fue enviado a otra cola (tabla `seguimiento`). Ambas listas y el modo (`CAMPO` / `SUPERVISOR` / `UNION`) son **configurables**. Se aplica **antes** de preparar el despacho. ⚠️ La columna `Falla Reportada` citada por el brief **no existe** en el CSV real; se evalúan `problema_reporte`, `ultimo_comentario` e `informacion` (pendiente de confirmar con CANTV). | Alta | Gestión automatizada |
| **RF-26** | Alimentar los tableros de MONITOREO y GRÁFICOS con las métricas de gestión diaria/semanal, casos globales, reparación, construcción y cuadrilla. | Media | Monitoreo |
| **RF-27** | Generar reporte de producción a las 04:00 p.m. (casos atendidos, citados, referidos, etc.) y enviarlo por Telegram o correo. | Media | Despacho |
| **RF-28** | Generar reporte de trabajo diario, semanal y mensual. | Alta | Monitoreo |
| **RF-29** | Documentar cada carga de archivo diferenciando los casos nuevos. | Media | Ingesta |

### 4.4 Funciones por módulo de interfaz (RF-30…RF-38)

> Añadidas al cerrar H-38/H-40/H-43: los módulos PANEL, CASOS, SEGUIMIENTO, EMPRESAS, REFERIDOS,
> GESTIÓN y CONFIGURACIÓN no tenían RF asociado.

| ID | Requerimiento | Prioridad | Módulo |
|---|---|---|---|
| **RF-30** | **Buscar** un caso por `id_averia` o por `teléfono` y mostrar su ficha completa. | Alta | PANEL |
| **RF-31** | **Actualizar/editar** un caso existente (contacto, dirección, clasificación, estado y campos de gestión). | Alta | PANEL |
| **RF-32** | **Alta manual** de un caso nuevo con información sencilla (fecha, tipo, actividad, contacto, nombre, dirección, información). | Alta | PANEL |
| **RF-33** | **Administrar el universo de casos**: listado con filtros (central, sector, estado, tipo, fechas), detalle y registro de resolución. | Alta | CASOS |
| **RF-34** | **Gestionar el seguimiento** de casos derivados a otras instancias/colas (instancia, motivo, fechas, estado). | Media | SEGUIMIENTO |
| **RF-35** | **Gestionar los casos de tipo EMPRESA** (reparación/construcción) y su cita de atención. | Media | EMPRESAS |
| **RF-36** | **Gestionar los casos de tipo REFERIDO** sin `id_averia` (prioridad y cita), con identificador `REF-…`. | Media | REFERIDOS |
| **RF-37** | **Gestionar los casos de la cuadrilla 0** sin despacharlos a calle (bandeja GESTIÓN y cierre administrativo). | Alta | GESTIÓN |
| **RF-38** | **Configurar la central y los sectores de trabajo** (datos operativos de la central y direcciones/alias por sector). | Alta | CONFIGURACIÓN |

### 4.5 Procedimientos detallados

**RF-INGESTA (1):** filtrar por datos operativos de la central → extraer datos → descartar duplicados por `id_averia` → insertar nuevos → documentar la carga.

**RF-DESPACHO (2):** el despacho diario debe:
1. Incluir los casos citados del día + al menos 2 reparaciones de referidos + 1 o más reparaciones de empresas.
2. Asignar la construcción (si existe) a **una sola** cuadrilla, preferentemente la que tenga reparaciones en el sector de la construcción.
3. Enviarse por Telegram o correo (ficha de cuadrilla + sectores).
4. Generar a las 04:00 p.m. el reporte de producción y notificarlo.
5. Omitir casos en gestión o asignados a la cuadrilla del supervisor.

**RF-GESTIÓN AUTOMATIZADA (3):** ver RF-25.

**RF-GESTIÓN TÉCNICA (4):** app móvil o web móvil que sincroniza al loguearse para operar **offline**:
- **4.0 LOGGEAR:** ver RF-20.
- **4.1 CONTACTAR:** ficha con datos básicos del cliente, corrección de dirección e información preliminar; botones **CONTACTADO** (marca) o **DIFERIDO** (selección de fecha/hora sin solapar citas existentes).
- **4.2 ATENDER:** solo casos contactados; ficha dividida en sección **Administrativa** (Número, Plan, Serial del equipo, Tipo de Servicio) y **Técnica** (OLT, Slot, Puerto, Ruta, FAT). Procedimientos:
  - **CERRAR:** reporte corto de actividad + evidencias (potencia del equipo, prueba de navegación) + método de cierre (con IVR / con COS / con SACAS).
  - **ENRUTAR:** reporte corto de justificación + evidencia (potencia en el equipo) + método de enrutado (colas de enrutado) + causa.
  - **DIFERIR:** reporte corto de justificación + hasta 3 fotos demostrativas + causa (listado de causas).
- **4.3 CONSIDERACIONES:**
  - Evidencias solo por **cámara del móvil** (no galería); almacenadas en baja calidad en carpeta de la app, serializadas con `N.º de caso + id_averia + tipo (potencia/navegación/demo) + fecha y hora`; en el reporte solo se guarda el serial de la imagen según tipo.
  - Al finalizar la jornada, en la pantalla **DISPOSITIVO** se genera un **ZIP** con el despacho modificado y todas las evidencias; nombre `central+cuadrilla+fecha`.
  - En la pantalla principal se puede seleccionar **SINCRONIZAR** el dispositivo (propuesta de procedimiento).
  - Primer inicio: ingresar `P00`, correo, clave y confirmación; se generan **12 palabras aleatorias** mostradas en pantalla y guardadas como **documento de seguridad encriptado** para recuperación de contraseña/bloqueo.
  - La app posee una **clave privada** para descifrar el documento de seguridad.
  - El documento de seguridad se actualiza durante la sincronización.

---

## 5. Requerimientos No Funcionales (ISO/IEC 25010)

| ID | Categoría | Requerimiento | Criterio de verificación |
|---|---|---|---|
| **RNF-01** | Seguridad | Autenticación de todos los usuarios; el login del campo bloquea tras 3 intentos y exige 3 de 12 palabras de seguridad. | Prueba de 3 intentos fallidos → bloqueo; recuperación con palabras. |
| **RNF-02** | Seguridad | Contraseñas y secretos nunca en texto plano; hash de claves y uso de Secret Manager en GCP. | Inspección de BD y variables; contraseñas con hash. |
| **RNF-03** | Seguridad | Documento de seguridad del dispositivo cifrado con clave privada de la app. | Inspección del archivo; no legible sin clave. |
| **RNF-04** | Seguridad | Solo lectura de las imágenes por cámara; bloqueo de selección desde galería. | Prueba en APK: galería no disponible en el flujo. |
| **RNF-05** | Privacidad | La app puede bloquearse para no exponer información confidencial del cliente. | Prueba de bloqueo/desbloqueo. |
| **RNF-06** | Confiabilidad / Disponibilidad | Operación **offline** en campo con sincronización asíncrona al recuperar conexión. | Prueba sin red: alta de actividad y evidencias; sincronización posterior sin pérdida. |
| **RNF-07** | Compatibilidad / Portabilidad | Multiplataforma: PC, web móvil, APK Android, Telegram y WEB-MCP. | Matriz de pruebas por plataforma. |
| **RNF-08** | Rendimiento | **SLO provisional (D-33):** ingesta del CSV diario en **≤ 5 min (p95)** para hasta **20 000 filas**; consultas de PANEL y generación de despacho en **≤ 2 s (p95)**; **30 usuarios concurrentes**. Se revisa cuando CANTV entregue la volumetría real. | Prueba de carga con dataset versionado de 20 000 filas; medición p95. |
| **RNF-09** | Usabilidad | **Tareas medibles (D-37):** `CONTACTAR → CONTACTADO/DIFERIDO` en **≤ 3 toques y ≤ 20 s**; encontrar la ficha por teléfono en **≤ 10 s** desde el login; alta manual de caso en **≤ 60 s**. Validado con **3–5 técnicos** reales, en dispositivo de campo, **a una mano** y **sin conexión**. | Prueba de usabilidad con métricas de tiempo y toques (media y p95). |
| **RNF-10** | Mantenibilidad | Catálogos y reglas (central, causas, columnas de filtro, frases de exclusión) configurables sin cambiar código. | Cambio de configuración sin despliegue. |
| **RNF-11** | Interoperabilidad | Integración con Telegram, correo y un servidor MCP/IA. | Pruebas de envío/recepción en cada canal. |
| **RNF-12** | Trazabilidad / Auditabilidad | Registrar usuario, fecha/hora y cambios sobre cada caso; historial de despachos. | Consulta de bitácora por caso y por despacho. |
| **RNF-13** | Localización | Interfaz en español; fechas en `dd/mm/aaaa hh:mm`; coordenadas GPS en evidencias. | Revisión de UI y metadatos EXIF/sidecar. |
| **RNF-14** | Escalabilidad | Arquitectura que permita incorporar otras centrales (multi-central). | Análisis de diseño; configuración por central. |
| **RNF-15** | Capacidad | **SLO provisional (D-33):** soportar **20 000 casos/día** de pico y un histórico de **3 años** sin degradar RNF-08; índice GIN (`pg_trgm`) sobre `caso.direccion` y `sector_direccion.patron` para la sectorización. Revisar con la volumetría real. | Pruebas de carga con histórico simulado de 3 años. |
| **RNF-16** | Fiabilidad / Respaldo | **Backup y recuperación:** backups automáticos diarios, *point-in-time recovery* y protección de borrado; **RPO ≤ 24 h** y **RTO ≤ 4 h**; prueba de restauración documentada al menos trimestral. (H-03) | Restauración real en entorno de pruebas + registro de la prueba. |
| **RNF-17** | Fiabilidad / Disponibilidad | **Disponibilidad** del backend/web ≥ 99 % en horario operativo (06:00–20:00), con reintentos y degradación controlada ante caída de dependencias externas (Telegram, correo, MCP). (H-27) | Monitoreo de uptime + prueba de caída de dependencia. |
| **RNF-18** | Privacidad / Cumplimiento | **Protección de datos personales (H-17):** base legal y finalidad declaradas; inventario y clasificación de PII; minimización (solo los campos necesarios); **retención por entidad** (ver §5.1); **enmascaramiento** de teléfono, dirección y serial para roles no autorizados; cifrado en reposo (CMEK) y en tránsito; derechos del titular (acceso, rectificación, supresión); DPA con proveedores (SendGrid/Gmail, Telegram); evaluación de transferencia internacional. | Inventario de PII revisado + prueba de enmascaramiento por rol + política de retención aprobada por CANTV. |
| **RNF-19** | Observabilidad | **Logs y monitoreo (H-26):** logs estructurados con `request-id` y usuario en todas las operaciones; métricas de negocio (ingestas ejecutadas/fallidas, casos nuevos, despachos emitidos, notificaciones fallidas, sincronizaciones); `/health` y `/ready`; alertas ante ingesta diaria no ejecutada, error de sincronización o fallo de notificación crítica; retención de logs ≥ 30 días. | Panel de métricas + prueba de alerta disparada. |
| **RNF-20** | Fiabilidad / Resiliencia | **Dependencias externas (H-14):** patrón *outbox* para notificaciones con reintentos exponenciales y estado terminal; **correo como canal de respaldo de Telegram**; alerta al supervisor si el reporte de producción de las 16:00 no se confirma; el MCP no puede bloquear el flujo principal. | Prueba de caída simulada de Telegram/correo + verificación de reintento y de la alerta. |
| **RNF-21** | Seguridad / Autorización | **RBAC y alcance por central (H-15/H-32):** matriz rol × módulo × acción (ver §5.2); `usuario.id_central` acota el alcance; **RLS** en PostgreSQL como defensa en profundidad; pruebas negativas (central A no accede a datos de central B). | Matriz RBAC aprobada + pruebas de acceso denegado entre centrales. |
| **RNF-22** | Seguridad / Autenticación y sesión | **Endurecimiento de acceso (H-31):** hash `Argon2id` (o bcrypt con coste ≥ 12) + *pepper*; política de complejidad/caducidad/historial de claves; **MFA obligatorio para ADMIN y SUPERVISOR**; bloqueo y *rate limiting* del lado servidor con backoff; expiración, rotación y revocación de sesión/token; protección CSRF/CORS; registro de eventos de login; autenticación de canales externos (`MCP_API_KEY`, token del bot). | Pruebas de fuerza bruta (bloqueo), expiración de sesión y MFA; revisión de configuración. |
| **RNF-23** | Accesibilidad | **Accesibilidad (H-28):** web conforme a **WCAG 2.1 AA**; en la APK objetivos táctiles **≥ 48 dp**, contraste **≥ 4.5:1**, fuente base **≥ 16 sp** y compatibilidad con lector de pantalla en los flujos de campo. | Auditoría automatizada (axe/Lighthouse) + revisión manual en APK. |
| **RNF-24** | Mantenibilidad / DevOps | **Calidad y entrega (H-13/H-29):** **migraciones versionadas** con Alembic (baseline = `db/schema.sql`); CI con `pytest`, Ruff y mypy en cada PR; **cobertura mínima 70 %**; API versionada (`/api/v1`) con OpenAPI; entornos separados `dev`/`staging`/`prod`. | Pipeline en verde + informe de cobertura + `alembic upgrade head` reproducible. |
| **RNF-25** | Portabilidad / Despliegue | **Paridad de entornos (H-29):** mismas versiones de PostgreSQL/Python en dev y prod; configuración solo por variables de entorno; imagen Docker reproducible; despliegue automatizado a Cloud Run. | Comparación de versiones dev/prod + despliegue reproducible desde cero. |

> ⚠️ **Riesgo aceptado (D-26):** la base de datos provisional (`truekeate-db-dev`) **no** cumple RNF-16/SSL
> obligatorio. El usuario aceptó el riesgo el 2026-09-25 con dueño **Dirección del proyecto** y condición
> de cierre: **migrar a `ggtov2-pg` propio** (REGIONAL, SSL `ENCRYPTED_ONLY`, backups + PITR +
> `deletionProtectionEnabled`) al resolver la cuota de facturación de GCP. **No se cargan datos reales
> de producción en la instancia compartida** hasta que exista respaldo.

### 5.1 Retención de datos (RNF-18 / D-34)

| Entidad | Contiene PII | Retención propuesta | Acción al vencer |
|---|---|---|---|
| `caso` | Sí (nombre, teléfono, dirección, serial) | 5 años | Anonimizar y archivar |
| `actividad` | Sí (reporte libre, GPS) | 5 años | Anonimizar |
| `evidencia` | Sí (imagen + GPS + hora) | 2 años | Eliminar imagen y metadatos |
| `auditoria` | Sí (datos_antes/después) | 3 años | Archivar sin PII |
| `notificacion` | Sí (destinatario, cuerpo) | 1 año | Eliminar |
| `solicitante` | Sí (nombre, contacto) | 5 años | Anonimizar |
| `dispositivo_seguridad` | No (hashes) | Mientras la cuenta esté activa | Eliminar con la cuenta |
| `inventario_movimiento` / `orden_material` (v2) | No | 5 años | Archivar |

> Los plazos son **propuesta** y deben validarse con CANTV/asesoría legal (tarea externa de H-17).

### 5.2 Matriz RBAC (RNF-21 / D-36)

Roles de la v1: **SUPER**, **ADMIN**, **SUPERVISOR**, **TECNICO**. Cada usuario pertenece a **una central**
(`usuario.id_central`), y el alcance se refuerza con RLS.

> **`SUPER` (Super Usuario) — acceso total:** `app/api/deps.py` concede **cualquier operación** a quien
> tenga este rol, sin necesidad de enumerarlo en cada endpoint (D-50). Cubre de forma permanente todas
> las secciones y funciones presentes y futuras. Su cuenta se crea con
> `scripts/inyectar_super_usuario.py`.

| Módulo / acción | **SUPER** | ADMIN | SUPERVISOR | TECNICO |
|---|---|---|---|---|
| CONFIGURACIÓN (central, sectores, catálogos, usuarios, flota, cuadrillas) | **CRUD** | CRUD | Lectura + edición operativa | — |
| INGESTA (cargar y procesar CSV) | **CRUD** | CRUD | CRUD | — |
| PANEL (buscar, editar, alta manual) | **CRUD** | CRUD | CRUD | Lectura de sus casos |
| CASOS / SEGUIMIENTO / EMPRESAS / REFERIDOS | **CRUD** | CRUD | CRUD | Lectura + gestión de su cuadrilla |
| DESPACHO (armar, publicar, reporte 16:00) | **CRUD** | CRUD | CRUD | Lectura de su despacho |
| GESTIÓN (cuadrilla 0) | **CRUD** | CRUD | CRUD | — |
| MONITOREO / GRÁFICOS | **Lectura** | Lectura | Lectura | — |
| GESTIÓN TÉCNICA (contactar, atender, cerrar, enrutar, diferir, evidencias) | **CRUD** | — | Lectura | CRUD (solo sus casos y offline) |
| ALERTAS (falla masiva, incidentes, solicitud de material) | **CRUD** | Lectura | Lectura | CRUD |
| INSUMOS (v2) | **CRUD** | CRUD | CRUD | Solicitud |
| AUDITORÍA | **Lectura** | Lectura | — | — |
| USUARIOS y accesos | **CRUD** | CRUD | Alta/baja de técnicos | — |

> **El rol `SUPER` no se enumera en los endpoints**: el bypass en `require_roles` le concede
> cualquier operación, por lo que la columna **SUPER** es siempre acceso total.

> **MFA obligatorio** para ADMIN y SUPERVISOR (RNF-22). El TÉCNICO usa `P00` + clave con bloqueo a los
> 3 intentos y recuperación con 3 de las 12 palabras (RF-20).

### 5.3 Gobierno de datos en la v1 (D-39)

| Función | Responsable en v1 | Estado |
|---|---|---|
| Administración de catálogos (causas, métodos, sectores, frases de exclusión) | **SUPERVISOR** | Cubierto por ACT-01 |
| Gestión y mantenimiento de flota | **SUPERVISOR** | Cubierto por RF-03 |
| Almacén / insumos (órdenes de material) | **SUPERVISOR** | v2 (RF-05) |
| Auditoría interna de la bitácora | **ADMIN** (solo lectura de `auditoria`) | Sin rol AUDITOR en v1 |
| Soporte / helpdesk de la plataforma y la APK | **SUPERVISOR** (registro por correo) | Informal en v1 |
| Responsable de protección de datos | CANTV (externo) | Pendiente de designar |
| Dueño del sistema origen CANTV (entrega del CSV) | CANTV (externo) | Pendiente de formalizar |

---

## 6. Requerimientos Técnicos

| ID | Requerimiento | Definición |
|---|---|---|
| **RT-01** | Base de datos | **PostgreSQL** (Cloud SQL / instancia `truekeate-db-dev` o `ggtov2-pg`). Ver `GGTOv2_GCP.md`. |
| **RT-02** | Backend | API web con autenticación, RBAC y capa de servicios para ingesta, despacho y reportes. |
| **RT-03** | Frontend web | Aplicación web responsive (PC + móvil). |
| **RT-04** | App móvil | APK Android con almacenamiento local, sincronización asíncrona y cámara. |
| **RT-05** | Ingesta CSV | Parser robusto del archivo `;`-delimitado de **80 columnas** (encabezados duplicados: `informacion` ×2, `descripcion` ×3) mapeadas **por posición** a **49 campos destino**. Se **descartan 21 columnas** y se unifican `informacion`(31) + `informacion`(32) + `descripcion`(52) en `informacion` (D-27). Codificación ISO-8859-1 y fechas `dd/mm/aaaa hh:mm:ss a.m./p.m.`. Contrato de interfaz con el sistema origen: [`interfaz_csv_origen.md`](interfaz_csv_origen.md) (D-41). |
| **RT-06** | Mensajería | Integración **Telegram Bot** y **correo (SMTP)**. WhatsApp reservado a la **v3** (D-12/P3.1). |
| **RT-07** | IA / MCP | Servidor **WEB-MCP** para ingesta conversacional de casos especiales. |
| **RT-08** | Reportes | Generación de reportes diario/semanal/mensual y despacho imprimible tamaño carta (PDF/HTML). |
| **RT-09** | Geolocalización | GPS del dispositivo; geocodificación/rutas por sectores. |
| **RT-10** | Gráficos | Librería de gráficos (barras, curva, torta) para MONITOREO/GRÁFICOS. |
| **RT-11** | Infraestructura | GCP `ggtov2` (Cloud Run + Cloud SQL + Secret Manager) según `GGTOv2_GCP.md`. |
| **RT-12** | Seguridad de datos | Cifrado en tránsito, secretos gestionados, control de acceso por rol. |
| **RT-13** | Migraciones | **Alembic** sobre SQLAlchemy; `db/schema.sql` es la línea base y cada cambio se versiona en `db/migrations/`. (D-38) |
| **RT-14** | CI/CD | **GitHub Actions** (espejo GitLab CI): lint, tipos, tests, cobertura, build de imagen y despliegue a Cloud Run. (D-38) |

**Totales:** **38 RF** (RF-01…RF-38) · **25 RNF** (RNF-01…RNF-25) · **14 RT** (RT-01…RT-14) · 6 actores · 10 secciones + 7 módulos funcionales.

---

## 7. Trazabilidad preliminar Brief → Requerimientos

| Sección del brief | Requerimiento(s) |
|---|---|
| OBJETIVO / CONTEXTO | RF-01…RF-38, RT-01…RT-14 |
| GENERALIDADES 1.1–1.7 | RF-01…RF-10 |
| GENERALIDADES 2.1–2.3 | RF-11…RF-19 |
| GENERALIDADES 3.1–3.5 | RF-21…RF-25 |
| DETALLE 0–0.2 | RF-26, RF-28, RF-30…RF-32, RT-08, RT-10 |
| DETALLE 1–7 | RF-06, RF-11, RF-25, RF-33…RF-38, Módulos §3 |
| PROCEDIMIENTOS 1–4 | RF-21…RF-29, RNF-06 |

---

## 8. Supuestos y decisiones (cerrados en la entrevista)

| # | Tema | Resolución | Decisión |
|---|---|---|---|
| S-01 | Almacenamiento | **PostgreSQL**, se descarta Excel. | D-01 / P1.1 ✅ |
| S-02 | Cliente | Primero **Francisco Salias (Área 4)**, extensible a otras centrales. | D-06 / P1.1 ✅ |
| S-03 | Multi-central | Tabla `central` + filtro por configuración, diseñado multi-central desde el inicio. | D-06 / P1.1 ✅ |
| S-04 | Insumos | **Fuera del MVP (v2)**; el modelo de datos los reserva. | D-18 / P5.2 ✅ |
| S-05 | App móvil | **Flutter + SQLite** con sincronización offline. | D-11 / P2.3 ✅ |
| S-06 | Autenticación | **`P00` + clave** para web y APK (3 intentos, 12 palabras). | D-10 / P2.2 ✅ |
| S-07 | Definición de "sector" | Definido por el supervisor (nombre + direcciones/alias); asignación por coincidencia sobre `direccion`. | D-07 / P1.2 ✅ |
| S-08 | Métricas exactas | ✅ **Cerrada (D-56)** en `metricas.md` v1.0: fórmula, entidad, ventana y redondeo de cada indicador. Pendiente solo la validación con CANTV. | D-56 / P5.1 ✅ |
| S-09 | Catálogo de causas | **Administrable** (ya no se puebla del CSV); falta cargar el listado oficial. | D-27 / H-05 ✅ |
| S-10 | Estados del caso | Fijados en el DDL: `NUEVO, ASIGNADO, CONTACTADO, CITADO, DIFERIDO, EN_GESTION, ENRUTADO, CERRADO, CANCELADO`. | **D-29** |
| S-11 | Casos especiales | Ficha `solicitante` (Unidad + Nombre + Contacto) y prioridad `ALTA/MEDIA/BAJA`; clasificación `REFERIDO/EMPRESA/GOBIERNO`. | **D-30** |
| S-12 | Fallas masivas | Detección automática por concentración tras la ingesta **+** reporte manual del técnico vía MCP/Telegram; asignación por proximidad de sector. Falta fijar el umbral. | D-19 / P5.3 ✅ / **D-31** |

> **D-29:** los 9 estados de `caso.estado_actual` quedan fijos en el DDL y se confirman con el cliente.
> **D-30:** la ficha del solicitante externo se modela en `solicitante` (unidad, nombre, contacto, canal).
> **D-31:** el umbral y la ventana de detección de falla masiva se configuran vía `configuracion` y se
> **definen en la Fase 3** junto con las métricas (S-08).

---

## 9. Preguntas de la entrevista (Fase 1)

> Se formulan en **bloques de 3**. Respuestas pendientes de registrar en `estado_proyecto.md`.
> Bloque 1 (Alcance y datos) · Bloque 2 (Usuarios y seguridad) · Bloque 3 (Canales e integraciones)
> Bloque 4 (Despliegue, repositorios y GCP) · Bloque 5 (Métricas y catálogos).

Ver los bloques activos en `estado_proyecto.md` §Preguntas pendientes.

---

## 10. Criterios de aceptación de la Fase 1

- [x] Brief analizado y requerimientos extraídos.
- [x] `requerimientos.md` generado y sincronizado con las respuestas (S-01..S-12 cerrados).
- [x] `diccionario_datos.md` generado.
- [x] `entornos_globales.md` generado.
- [x] `modelo_er.md` y `db/schema.sql` generados.
- [x] Preguntas de la entrevista respondidas (bloques 1–5).
- [x] URLs de repositorios GitLab/GitHub definidas (rama `GGTOv2-DSH-GCP`).
- [x] Credenciales/configuración GCP confirmadas.
- [x] Auditoría de Fase 1 ejecutada (`INFORME_OPTIMIZACION_V1.md`).
- [ ] Criterios C1–C5 del informe de auditoría (§8) — C2 y C3 completos; C1 con riesgos aceptados; C4 y C5 pendientes.
- [ ] Push a remotos (orden `/push`).
- [ ] Confirmación del usuario para pasar a Fase 2 (Auditoría / casos de uso).
