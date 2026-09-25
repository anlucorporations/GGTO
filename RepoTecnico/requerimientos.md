# Requerimientos — Plataforma GGTO (Gestión de Averías y Puntos Ópticos)

| Campo | Valor |
|---|---|
| Proyecto | **GGTO** — Sistema de administración de reportes de avería y construcción de puntos ópticos |
| Cliente | **CANTV C.A.** — Central **Francisco Salias (Área 4)** |
| Fuente | `RepoTecnico/BRIEF-GGTO-INICIAL.md` |
| Muestra de datos | `RepoTecnico/detalle_averias_gpon 12_09_2026.csv` (80 columnas, delimitador `;`) |
| Infraestructura | Proyecto GCP **GGTOv2** (`ggtov2`) + PostgreSQL (Cloud SQL) — ver `GGTOv2_GCP.md` |
| Fase | Fase 1 — Concepto |
| Estado | Borrador v0.1 — **requiere validación del usuario** |

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
   **WhatsApp/Telegram** y un canal de **IA vía WEB-MCP**.

> El brief menciona originalmente "almacenamiento basado en hoja de Excel". El contexto y la
> infraestructura ya preparada (`GGTOv2_GCP.md`) establecen **PostgreSQL** como base de datos.
> *(Confirmar en entrevista: RF-0.)*

---

## 2. Actores

| ID | Actor | Descripción | Canal |
|---|---|---|---|
| **ACT-01** | **Supervisor de la central** | Carga el CSV diario, crea perfiles/accesos, gestiona flota, cuadrillas e insumos, genera reportes, ejecuta el despacho diario, gestiona fallas masivas y la "cuadrilla 0". | Web PC / App móvil |
| **ACT-02** | **Técnico de campo** | Miembro de una cuadrilla. Consulta casos, contacta y agenda, documenta actividad/resolución, captura evidencias, alerta fallas masivas e incidentes, solicita material, sincroniza el dispositivo. | App Android / Web móvil / WhatsApp/Telegram |
| **ACT-03** | **Personal externo solicitante** | Reporta casos especiales (referidos, empresas, gobiernos) indicando **Unidad + Nombre + Contacto**; recibe notificación de lo realizado. | WhatsApp / Telegram / WEB-MCP (IA) |
| **ACT-04** | **Administrador del sistema** | Configura el entorno (central, técnicos, flota, cuadrillas, catálogos, roles). | Web PC |
| **ACT-05** | **Sistema (automático)** | Ingesta, detección de duplicados, sectorización, propuesta de despacho, gestión automatizada, mensajería, generación de reportes. | Backend |
| **ACT-06** | **Integración IA (WEB-MCP)** | Canal conversacional que interpreta y registra casos especiales y consultas. | MCP sobre web |

---

## 3. Módulos / secciones funcionales

| Sección | Nombre | Descripción (del brief) |
|---|---|---|
| 0 | **PANEL** | Búsqueda de caso por `id_averia` o `teléfono`; actualización de casos; alta manual de casos nuevos (Fecha, Tipo, Actividad, Contacto, Nombre, Dirección, Información, etc.). |
| 0.1 | **MONITOREO** | Tarjetas/zonas con datos y tablas: GESTIÓN DIARIA, GESTIÓN SEMANAL, CASOS GLOBALES, REPARACIÓN, CONSTRUCCIÓN, CUADRILLA. |
| 0.2 | **GRÁFICOS** | Visualizaciones: barras (Gestión diaria, Casos globales, Construcción, Cuadrilla), curva (Semanal), torta (Reparación). |
| 1 | **CASOS** | Data principal de casos y su resolución (Construcción/Reparación · Residencial/Empresa/Referidos). |
| 2 | **DESPACHO** | Distribución del universo de averías entre cuadrillas por sectores; despacho del día en tabla imprimible (carta) + histórico. |
| 3 | **SEGUIMIENTO** | Casos pasados a otras instancias (en cola) para seguimiento. |
| 4 | **EMPRESAS** | Resumen de reparación/construcción tipo Empresa + registro de cita. |
| 5 | **REFERIDOS** | Resumen de reparación/construcción tipo Referido sin `id_averia`, priorizados + cita. |
| 6 | **CONFIGURACIÓN** | 6.1 CENTRAL · 6.2 TÉCNICOS · 6.3 FLOTA · 6.4 CUADRILLA. |
| 8 | **GESTIÓN** | Casos de la "cuadrilla 0" (supervisor) que no se despachan a calle. |

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
| **RF-06** | Gestionar la ingesta/asignación de casos especiales solicitados por otras instancias (Referidos de reparación, construcción residencial, construcción empresa, etc.) vía WhatsApp, Telegram o IA (WEB-MCP). | Alta | Referidos/Empresas |
| **RF-07** | Generar reportes de: Capacidad Operativa (cuadrilla + sectores), estado de flotas y herramientas, y función diaria (cuadrilla + despacho del día). | Alta | Monitoreo |
| **RF-08** | Gestionar el **Despacho Diario**: asignar un grupo de casos a las cuadrillas activas por día, agrupando por áreas geográficas/sectores. | Alta | Despacho |
| **RF-09** | Gestionar las **fallas masivas**: detectarlas automáticamente por **concentración de casos** tras la ingesta y también por **reporte manual** del técnico vía MCP/Telegram; asignarlas a la cuadrilla con mayor **proximidad de sector**. | Media | Despacho |
| **RF-10** | Enviar por **Telegram o correo** (v1) la ficha de la cuadrilla y los sectores a atender en el día. *WhatsApp queda para la v3 (P3.1).* | Media | Despacho |

### 4.2 Funciones del Técnico de campo (ACT-02)

| ID | Requerimiento | Prioridad | Módulo |
|---|---|---|---|
| **RF-11** | Gestionar/consultar la ficha de los casos asignados a su cuadrilla. | Alta | Gestión técnica |
| **RF-12** | Contactar y acordar hora de encuentro con el cliente; gestionar agenda interna. | Alta | Gestión técnica |
| **RF-13** | Documentar la actividad realizada en cada caso. | Alta | Gestión técnica |
| **RF-14** | Capturar registro fotográfico marcado con GPS + fecha y hora. **No se permite cargar imágenes desde galería.** | Alta | Gestión técnica |
| **RF-15** | Documentar la resolución del caso. | Alta | Gestión técnica |
| **RF-16** | Alertar casos de **falla masiva** por **Telegram** o WEB-MCP. *WhatsApp: v3.* | Media | Alertas |
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
| **RF-25** | Asignar a la **cuadrilla del supervisor (cuadrilla 0)** los casos que no ameritan maniobra de campo: sin `LOSS ROJO`, sin `FALLA FIBRA` y sin `Fibra Dañada` en las columnas de información (`Falla Reportada`, `Último Comentario`, `problema_reporte`), **antes** de preparar el despacho. | Alta | Gestión automatizada |
| **RF-26** | Alimentar los tableros de MONITOREO y GRÁFICOS con las métricas de gestión diaria/semanal, casos globales, reparación, construcción y cuadrilla. | Media | Monitoreo |
| **RF-27** | Generar reporte de producción a las 04:00 p.m. (casos atendidos, citados, referidos, etc.) y enviarlo por WhatsApp/correo/Telegram. | Media | Despacho |
| **RF-28** | Generar reporte de trabajo diario, semanal y mensual. | Alta | Monitoreo |
| **RF-29** | Documentar cada carga de archivo diferenciando los casos nuevos. | Media | Ingesta |

### 4.4 Procedimientos detallados

**RF-INGESTA (1):** filtrar por datos operativos de la central → extraer datos → descartar duplicados por `id_averia` → insertar nuevos → documentar la carga.

**RF-DESPACHO (2):** el despacho diario debe:
1. Incluir los casos citados del día + al menos 2 reparaciones de referidos + 1 o más reparaciones de empresas.
2. Asignar la construcción (si existe) a **una sola** cuadrilla, preferentemente la que tenga reparaciones en el sector de la construcción.
3. Enviarse por WhatsApp/correo/Telegram (ficha de cuadrilla + sectores).
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
| **RNF-07** | Compatibilidad / Portabilidad | Multiplataforma: PC, web móvil, APK Android, WhatsApp/Telegram y WEB-MCP. | Matriz de pruebas por plataforma. |
| **RNF-08** | Rendimiento | Ingesta del CSV diario (universo de averías del área operativa) sin degradar la operación. | Tiempo de procesamiento medible; objetivo por definir. |
| **RNF-09** | Usabilidad | Fichas de caso "cómodas y visibles" con nombre y sector; flujo de campo con pocos toques. | Prueba heurística / tiempo de tarea. |
| **RNF-10** | Mantenibilidad | Catálogos y reglas (central, causas, columnas de filtro, frases de exclusión) configurables sin cambiar código. | Cambio de configuración sin despliegue. |
| **RNF-11** | Interoperabilidad | Integración con WhatsApp, Telegram, correo y un servidor MCP/IA. | Pruebas de envío/recepción en cada canal. |
| **RNF-12** | Trazabilidad / Auditabilidad | Registrar usuario, fecha/hora y cambios sobre cada caso; historial de despachos. | Consulta de bitácora por caso y por despacho. |
| **RNF-13** | Localización | Interfaz en español; fechas en `dd/mm/aaaa hh:mm`; coordenadas GPS en evidencias. | Revisión de UI y metadatos EXIF/sidecar. |
| **RNF-14** | Escalabilidad | Arquitectura que permita incorporar otras centrales (multi-central). | Análisis de diseño; configuración por central. |
| **RNF-15** | Capacidad | Soportar el volumen diario de averías del área 4 y su histórico. | Pruebas de carga con datos reales. |

---

## 6. Requerimientos Técnicos

| ID | Requerimiento | Definición |
|---|---|---|
| **RT-01** | Base de datos | **PostgreSQL** (Cloud SQL / instancia `truekeate-db-dev` o `ggtov2-pg`). Ver `GGTOv2_GCP.md`. |
| **RT-02** | Backend | API web con autenticación, RBAC y capa de servicios para ingesta, despacho y reportes. |
| **RT-03** | Frontend web | Aplicación web responsive (PC + móvil). |
| **RT-04** | App móvil | APK Android con almacenamiento local, sincronización asíncrona y cámara. |
| **RT-05** | Ingesta CSV | Parser robusto del archivo `;`-delimitado de **80 columnas**, con encabezados duplicados (`informacion` ×2, `descripcion` ×3) que deben mapearse por posición. Codificación y fechas variadas. |
| **RT-06** | Mensajería | Integración WhatsApp (API/Business), Telegram Bot y correo (SMTP). |
| **RT-07** | IA / MCP | Servidor **WEB-MCP** para ingesta conversacional de casos especiales. |
| **RT-08** | Reportes | Generación de reportes diario/semanal/mensual y despacho imprimible tamaño carta (PDF/HTML). |
| **RT-09** | Geolocalización | GPS del dispositivo; geocodificación/rutas por sectores. |
| **RT-10** | Gráficos | Librería de gráficos (barras, curva, torta) para MONITOREO/GRÁFICOS. |
| **RT-11** | Infraestructura | GCP `ggtov2` (Cloud Run + Cloud SQL + Secret Manager) según `GGTOv2_GCP.md`. |
| **RT-12** | Seguridad de datos | Cifrado en tránsito, secretos gestionados, control de acceso por rol. |

---

## 7. Trazabilidad preliminar Brief → Requerimientos

| Sección del brief | Requerimiento(s) |
|---|---|
| OBJETIVO / CONTEXTO | RF-01…RF-29, RT-01…RT-12 |
| GENERALIDADES 1.1–1.7 | RF-01…RF-10 |
| GENERALIDADES 2.1–2.3 | RF-11…RF-19 |
| GENERALIDADES 3.1–3.5 | RF-21…RF-25 |
| DETALLE 0–0.2 | RF-26, RF-28, RT-08, RT-10 |
| DETALLE 1–8 | RF-06, RF-11, RF-25, Módulos §3 |
| PROCEDIMIENTOS 1–4 | RF-21…RF-29, RNF-06 |

---

## 8. Supuestos y decisiones abiertas

| # | Tema | Supuesto actual | Estado |
|---|---|---|---|
| S-01 | Almacenamiento | PostgreSQL (no Excel) como fuente de verdad. | **A confirmar** |
| S-02 | Cliente | La plataforma sirve primero a **Francisco Salias (Área 4)** y debe ser extensible a otras centrales. | A confirmar |
| S-03 | Multi-central | Modelo con tabla `central` y filtro por configuración. | A confirmar |
| S-04 | Insumos | Fuera del MVP (v2), pero el modelo de datos se reserva. | A confirmar |
| S-05 | App móvil | APK Android nativo/híbrido con SQLite local. | A confirmar |
| S-06 | Autenticación web | Usuario/`P00` + clave para todos los perfiles. | A confirmar |
| S-07 | Definición de "sector" | Agrupación geográfica (parroquia/municipio/área de trabajo/FAT). | A confirmar |
| S-08 | Métricas exactas | "Gestionado", "Cerrado", "Citado", "Referido", etc. requieren fórmula explícita. | A confirmar |
| S-09 | Catálogo de causas | Origen: VENAPP / sistema interno CANTV. | A confirmar |
| S-10 | Estados del caso | Ciclo de vida exacto (PEND, EN GESTIÓN, CERRADO, ENRUTADO, DIFERIDO…). | A confirmar |
| S-11 | Casos especiales | Estructura de "Unidad + Nombre + Contacto" y niveles de prioridad. | A confirmar |
| S-12 | Fallas masivas | Origen, detección y criterio de "mayor cercanía". | A confirmar |

---

## 9. Preguntas de la entrevista (Fase 1)

> Se formulan en **bloques de 3**. Respuestas pendientes de registrar en `estado_proyecto.md`.
> Bloque 1 (Alcance y datos) · Bloque 2 (Usuarios y seguridad) · Bloque 3 (Canales e integraciones)
> Bloque 4 (Despliegue, repositorios y GCP) · Bloque 5 (Métricas y catálogos).

Ver los bloques activos en `estado_proyecto.md` §Preguntas pendientes.

---

## 10. Criterios de aceptación de la Fase 1

- [x] Brief analizado y requerimientos extraídos.
- [x] `requerimientos.md` generado.
- [ ] `diccionario_datos.md` generado.
- [ ] `entornos_globales.md` generado.
- [ ] Preguntas de la entrevista respondidas (bloques 1–5).
- [ ] URLs de repositorios GitLab/GitHub definidas.
- [ ] Credenciales/configuración GCP confirmadas.
- [ ] Confirmación del usuario para pasar a Fase 2 (Auditoría).
