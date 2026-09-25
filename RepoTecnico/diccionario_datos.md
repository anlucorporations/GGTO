# Diccionario de Datos — Plataforma GGTO

| Campo | Valor |
|---|---|
| Proyecto | **GGTO** — Gestión de averías y puntos ópticos |
| Cliente | CANTV C.A. — Central Francisco Salias (Área 4) |
| Motor | **PostgreSQL** |
| Fuente | `BRIEF-GGTO-INICIAL.md` + muestra `detalle_averias_gpon 12_09_2026.csv` |
| Fase | Fase 1 — Concepto |
| Estado | Borrador v0.1 — **sujeto a validación** |

> Convenciones:
> - `PK` = clave primaria, `FK` = clave foránea, `UQ` = único, `NN` = no nulo.
> - Tipos PostgreSQL. Fechas del archivo origen en `dd/mm/aaaa hh:mm:ss a.m./p.m.` → se normalizan a `timestamp`.
> - Estados y catálogos enumerados se modelan como **tablas de catálogo** (configurables), no como `ENUM`.

---

## 1. Inventario de entidades

| # | Entidad | Tabla | Descripción |
|---|---|---|---|
| 1 | Central | `central` | Dirección operativa de la central (base de filtro de la ingesta). |
| 2 | Sector | `sector` | Agrupación geográfica de trabajo para rutas y despacho. |
| 3 | Usuario | `usuario` | Credenciales de acceso (supervisor, técnico, admin). |
| 4 | Rol | `rol` | Catálogo de roles y permisos. |
| 5 | Técnico | `tecnico` | Datos del trabajador de la central. |
| 6 | Flota | `flota` | Vehículos de la central. |
| 7 | Herramienta | `herramienta` | Herramientas asignables. |
| 8 | Cuadrilla | `cuadrilla` | Equipo = técnicos + flota + herramientas. |
| 9 | Cuadrilla–Técnico | `cuadrilla_tecnico` | Pertenencia (N:M) con rol en la cuadrilla. |
| 10 | Cuadrilla–Herramienta | `cuadrilla_herramienta` | Asignación de herramientas. |
| 11 | Caso/Avería | `caso` | Entidad central de casos (averías + construcción). |
| 12 | Caso especial | `caso_especial` | Subtipo REFERIDO/EMPRESA/GOBIERNO/construcción sin `id_averia`. |
| 13 | Solicitante externo | `solicitante` | Unidad + Nombre + Contacto del personal externo. |
| 14 | Cita | `cita` | Agenda de contacto/atención por caso. |
| 15 | Despacho | `despacho` | Cabecera del despacho diario por cuadrilla. |
| 16 | Despacho–Caso | `despacho_caso` | Detalle de casos asignados. |
| 17 | Seguimiento | `seguimiento` | Casos derivados a otras instancias/colas. |
| 18 | Actividad/Reporte | `actividad` | Reporte corto de gestión (contacto, cierre, enrute, diferido). |
| 19 | Evidencia | `evidencia` | Registro fotográfico con GPS y fecha/hora. |
| 20 | Estado del caso | `caso_estado_hist` | Bitácora de cambios de estado. |
| 21 | Ingesta (lote) | `ingesta_lote` | Carga del CSV diario y sus métricas. |
| 22 | Insumo | `insumo` | Materiales (v2). |
| 23 | Inventario | `inventario_movimiento` | Ingresos/egresos de material (v2). |
| 24 | Orden de material | `orden_material` / `orden_material_detalle` | Solicitudes de material (v2). |
| 25 | Falla masiva | `falla_masiva` | Evento de falla masiva y su atención. |
| 26 | Incidente | `incidente` | Incidentes de flota/herramienta. |
| 27 | Notificación | `notificacion` | Mensajes enviados por WhatsApp/Telegram/correo/MCP. |
| 28 | Seguridad del dispositivo | `dispositivo_seguridad` | 12 palabras, clave privada, estado de bloqueo. |
| 29 | Sincronización | `sincronizacion` | Paquetes ZIP y estado de sync del dispositivo. |
| 30 | Catálogo de causas | `causa` | Código/subcódigo/descripción de causa. |
| 31 | Método | `catalogo_metodo` | Métodos de cierre (IVR/COS/SACAS) y de enrutado. |
| 32 | Auditoría | `auditoria` | Bitácora de acciones (RNF-12). |
| 33 | Configuración | `configuracion` | Parámetros del sistema (frases de exclusión, reglas). |

---

## 2. Entidades de configuración

### 2.1 `central`
Base del filtro de ingesta (brief 6.1).

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_central | serial | PK | Identificador. |
| region | varchar(80) | NN | Ej. `CAPITAL`. |
| estado_geografico | varchar(80) | NN | Ej. `BOLIVARIANO MIRANDA`. |
| capital_estado | varchar(80) | | Capital del estado geográfico. |
| municipio | varchar(80) | NN | Ej. `LOS TEQUES`. |
| parroquia | varchar(80) | NN | Ej. `BARUTA`. |
| estado_operativo | varchar(80) | | Ej. `MIRANDA-2`. |
| distrito | varchar(40) | | Ej. `10204`. |
| area | varchar(20) | NN | Ej. `AREA 4`. |
| codigo_central | varchar(20) | UQ, NN | Ej. `2324X`. |
| nombre_central | varchar(120) | NN | Ej. `FRANCISCO SALIAS`. |
| activa | boolean | NN, default true | Central operativa. |
| creado_en / actualizado_en | timestamptz | | Auditoría. |

### 2.2 `sector`
Agrupación geográfica para rutas (RF-23). **Definida por el supervisor en CONFIGURACIÓN**
(nombre + conjunto de direcciones/alias). Decisión P1.2: la asignación de un caso a un sector se
hace por **coincidencia de texto sobre el campo `direccion`** del CSV.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_sector | serial | PK | |
| id_central | int | FK→central | |
| nombre | varchar(120) | NN | Nombre visible del sector (ej. `Norte 1`, `Sur 2`). |
| codigo | varchar(20) | UQ | Código corto (ej. `N1`). |
| descripcion | text | | Notas del supervisor. |
| prioridad | smallint | | Orden de atención. |
| activo | boolean | NN, default true | |
| creado_en / actualizado_en | timestamptz | | |

> *(PostGIS/polígonos descartado por ahora; se puede añadir un campo `geom` opcional más adelante.)*

### 2.2.1 `sector_direccion`
Patrones/alias de dirección que pertenecen a un sector (N:M dirección↔sector lógico).

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_sector_direccion | serial | PK | |
| id_sector | int | FK→sector, NN | |
| patron | varchar(160) | NN | Texto/alias a buscar en `caso.direccion` (ej. `VALLE ARRIBA`, `CONCRESA`, `PARQUE HUMBOLDT`). |
| tipo_coincidencia | varchar(20) | NN, default `CONTIENE` | `CONTIENE` / `EXACTO` / `REGEX`. |
| normalizar | boolean | NN, default true | Sin acentos/mayúsculas antes de comparar. |
| activo | boolean | NN, default true | |

**Regla de asignación (RF-23):** normalizar `caso.direccion` → buscar el primer `patron` activo que
coincida (mayor prioridad de sector y mayor longitud de patrón) → asignar `caso.id_sector`.
Si no coincide ninguno, el caso queda **sin sector** y se reporta para configuración.

### 2.3 `usuario` / `rol`
Accesos (RF-02, RF-20, RNF-01).

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_usuario | serial | PK | |
| p00 | varchar(20) | UQ, NN | Identificador laboral (login). |
| correo | varchar(120) | UQ | Correo. |
| clave_hash | varchar(255) | NN | Hash (bcrypt/argon2). |
| id_rol | int | FK→rol, NN | |
| id_tecnico | int | FK→tecnico, null | Datos del trabajador asociado. |
| intentos_fallidos | smallint | NN, default 0 | Hasta 3 (RF-20). |
| bloqueado | boolean | NN, default false | Bloqueo por intentos. |
| bloqueo_cliente | boolean | NN, default false | Oculta datos del cliente (RNF-05). |
| requiere_cambio_clave | boolean | default false | |
| activo | boolean | NN, default true | |
| ultimo_acceso | timestamptz | | |
| creado_en / actualizado_en | timestamptz | | |

`rol`: `id_rol` PK, `codigo` UQ (`SUPERVISOR`, `TECNICO`, `ADMIN`), `nombre`, `permisos` (jsonb).

### 2.4 `tecnico` (brief 6.2)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_tecnico | serial | PK | |
| id_central | int | FK→central | |
| nombre | varchar(80) | NN | |
| apellido | varchar(80) | | |
| cedula | varchar(20) | UQ | |
| p00 | varchar(20) | UQ, NN | |
| telefono | varchar(30) | | |
| correo | varchar(120) | | |
| especialidad | varchar(80) | | |
| status | varchar(20) | NN | ACTIVO / INACTIVO / VACACIONES. |
| creado_en / actualizado_en | timestamptz | | |

### 2.5 `flota` (brief 6.3)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_flota | serial | PK | |
| id_central | int | FK→central | |
| can | varchar(20) | UQ, NN | Código CAN (ej. `CAN00`). |
| tipo | varchar(40) | | |
| marca | varchar(40) | | |
| modelo | varchar(40) | | |
| placa | varchar(20) | UQ | |
| combustible | varchar(20) | | |
| status | varchar(20) | NN | DISPONIBLE / EN RUTA / MANTENIMIENTO. |
| estado_cauchos | varchar(30) | | |
| estado_fluidos | varchar(30) | | |
| estado_general | varchar(30) | | |
| creado_en / actualizado_en | timestamptz | | |

### 2.6 `herramienta` y `cuadrilla` (brief 6.4)

`herramienta`: `id_herramienta` PK, `id_central` FK, `nombre`, `codigo` UQ, `estado`
(`DISPONIBLE`/`ASIGNADA`/`AVERIADA`), `observacion`.

`cuadrilla`:

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_cuadrilla | serial | PK | |
| id_central | int | FK→central | |
| codigo | varchar(20) | UQ | Ej. `C-01`. |
| nombre | varchar(80) | NN | |
| id_flota | int | FK→flota, null | Vehículo asignado. |
| es_supervisor | boolean | NN, default false | **Cuadrilla 0** (RF-25). |
| activa | boolean | NN, default true | |
| creado_en / actualizado_en | timestamptz | | |

`cuadrilla_tecnico`: `id_cuadrilla` FK, `id_tecnico` FK, `rol_cuadrilla`
(`REPARADOR_PRINCIPAL`/`AYUDANTE`), `desde`, `hasta`. PK compuesta.

`cuadrilla_herramienta`: `id_cuadrilla`, `id_herramienta`, `asignada_en`, `devuelta_en`. PK compuesta.

---

## 3. Entidad central: `caso` (avería)

Mapea el archivo `detalle_averias_gpon_<fecha>.csv` (80 columnas) más los campos propios del
sistema. La clave natural de deduplicación es **`id_averia`** (RF-22).

### 3.1 Campos propios del sistema

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_caso | bigserial | PK | Identificador interno. |
| id_central | int | FK→central, NN | Central propietaria del caso. |
| origen | varchar(20) | NN | `INGESTA_CSV` / `MANUAL` / `WHATSAPP` / `TELEGRAM` / `MCP_IA`. |
| tipo_caso | varchar(20) | NN | `AVERIA` / `REPARACION` / `CONSTRUCCION`. |
| categoria | varchar(20) | NN | `RESIDENCIAL` / `EMPRESA` / `REFERIDO` / `GOBIERNO`. |
| en_gestion_supervisor | boolean | NN, default false | Asignado a cuadrilla 0 (RF-25). |
| es_falla_masiva | boolean | default false | RF-09. |
| id_sector | int | FK→sector, null | Sector de atención (RF-23). |
| creado_en / actualizado_en | timestamptz | | |
| creado_por | varchar(20) | FK→usuario.p00 | |

### 3.2 Mapeo del CSV de ingesta (por posición)

> El archivo tiene **80 columnas con `;` como delimitador** y **encabezados duplicados**:
> `informacion` aparece 2 veces (col. 31–32) y `descripcion` 3 veces (col. 52, 57, 59).
> Por robustez, la ingesta mapea **por índice de columna**, no por nombre.

| # | Columna CSV | Campo destino | Tipo | Notas |
|---|---|---|---|---|
| 1 | region | `region` | varchar(80) | Filtro central. |
| 2 | estado geografico | `estado_geografico` | varchar(80) | Filtro. |
| 3 | capital estado geografico | `capital_estado` | varchar(80) | Filtro. |
| 4 | municipio | `municipio` | varchar(80) | Filtro. |
| 5 | parroquia | `parroquia` | varchar(80) | Filtro. |
| 6 | estado operativo | `estado_operativo` | varchar(80) | Filtro. |
| 7 | distrito | `distrito` | varchar(40) | Filtro. |
| 8 | area | `area` | varchar(20) | Filtro. |
| 9 | central | `codigo_central` | varchar(20) | Filtro (ej. `2324X`). |
| 10 | nombre central | `nombre_central` | varchar(120) | Filtro (ej. `FRANCISCO SALIAS`). |
| 11 | id_averia | `id_averia` | varchar(30) | **UQ natural** (deduplicación). |
| 12 | tipo_reporte | `tipo_reporte` | varchar(20) | Ej. `INTERNO`. |
| 13 | dac | `dac` | varchar(20) | |
| 14 | telefono | `telefono` | varchar(30) | Búsqueda en PANEL. |
| 15 | fecha_reporte | `fecha_reporte` | timestamp | |
| 16 | persona_reporta | `persona_reporta` | varchar(120) | |
| 17 | contacto | `contacto_cliente` | varchar(60) | |
| 18 | fecha_compromiso | `fecha_compromiso` | timestamp | |
| 19 | fecha_cita | `fecha_cita` | timestamp | |
| 20 | ultimo_usuario | `ultimo_usuario` | varchar(60) | |
| 21 | ultimo_comentario | `ultimo_comentario` | text | Frases de exclusión (RF-25). |
| 22 | results | `results` | text | |
| 23 | asignado_a | `asignado_a` | varchar(60) | |
| 24 | cuadrilla | `cuadrilla_externa` | varchar(40) | Cuadrilla del sistema origen. |
| 25 | fecha_despacho | `fecha_despacho_externo` | timestamp | |
| 26 | ciudad | `ciudad` | varchar(80) | |
| 27 | estatus | `estatus_origen` | varchar(20) | Ej. `PEND`. |
| 28 | problema_reporte | `problema_reporte` | text | Frases de exclusión (RF-25). |
| 29 | servicio_off_on | `servicio_off_on` | varchar(20) | |
| 30 | cliente_notificado | `cliente_notificado` | boolean/varchar | `0`/`1`. |
| 31 | informacion (1.ª) | `informacion_1` | text | |
| 32 | informacion (2.ª) | `informacion_2` | text | Duplicado de encabezado. |
| 33 | nombre | `nombre_cliente` | varchar(160) | |
| 34 | direccion | `direccion` | text | Base de sectorización. |
| 35 | fecha_instalacion | `fecha_instalacion` | date | |
| 36 | olt | `olt` | varchar(40) | |
| 37 | ip | `ip` | inet/varchar(20) | |
| 38 | tarjeta | `tarjeta` | varchar(40) | |
| 39 | plan | `plan` | varchar(60) | |
| 40 | slot | `slot` | varchar(10) | |
| 41 | puerto | `puerto` | varchar(10) | |
| 42 | ont_id | `ont_id` | varchar(20) | |
| 43 | fat | `fat` | varchar(80) | |
| 44 | serial | `serial` | varchar(60) | Serial del equipo. |
| 45 | cvlan | `cvlan` | varchar(20) | |
| 46 | extra | `extra` | varchar(40) | |
| 47 | area_trabajo | `area_trabajo` | varchar(40) | Ej. `PTAEXT`. |
| 48 | dias transcurrido desde la apertura | `dias_desde_apertura` | int | |
| 49 | area_resolutoria | `area_resolutoria` | varchar(20) | |
| 50 | tipo_servicio | `tipo_servicio` | varchar(40) | Ej. `ABA ULTRA`. |
| 51 | tipo_problema | `tipo_problema` | varchar(20) | Ej. `NL`. |
| 52 | descripcion (1.ª) | `descripcion_problema` | text | |
| 53 | usuario_acciona | `usuario_acciona` | varchar(60) | |
| 54 | fecha_acciona | `fecha_acciona` | timestamp | |
| 55 | dias transcurrido en area resolutoria | `dias_area_resolutoria` | int | |
| 56 | codigo_causa | `codigo_causa` | varchar(20) | |
| 57 | descripcion (2.ª) | `descripcion_causa` | text | |
| 58 | Subcodigo_causa | `subcodigo_causa` | varchar(20) | |
| 59 | descripcion (3.ª) | `descripcion_subcausa` | text | |
| 60 | con_serv_aba | `con_serv_aba` | varchar(5) | `Y`/`N`. |
| 61 | unidad_negocio | `unidad_negocio` | varchar(40) | Ej. `CANTV RESIDENCIAL`. |
| 62 | ups | `ups` | varchar(10) | |
| 63 | codigos_gestionados_en_VENAPP | `codigos_gestionados_venapp` | varchar(60) | |
| 64 | codigos_sin_gestion_en_VENAPP | `codigos_sin_gestion_venapp` | varchar(60) | |
| 65 | Reparador Principal | `reparador_principal` | varchar(20) | P00. |
| 66–74 | Ayudante 1..9 | `ayudantes` | jsonb/text[] | Hasta 9 ayudantes. |
| 75 | Flota (CAN) | `flota_can` | varchar(20) | |
| 76 | Nombre | `despacho_nombre` | varchar(80) | Nombre del despachador/asignado. |
| 77 | Apellido | `despacho_apellido` | varchar(80) | |
| 78 | Telefono Oficina | `telefono_oficina` | varchar(30) | |
| 79 | Telefono Movil | `telefono_movil` | varchar(30) | |
| 80 | Fecha Hora Asignacion | `fecha_hora_asignacion` | timestamp | |

### 3.3 `caso_estado_hist`

`id_hist` PK · `id_caso` FK · `estado_anterior` · `estado_nuevo` · `motivo` ·
`usuario` · `fecha_hora`. Estados propuestos: `NUEVO`, `ASIGNADO`, `CONTACTADO`,
`CITADO`, `DIFERIDO`, `EN_GESTION`, `ENRUTADO`, `CERRADO`, `CANCELADO`.

---

## 4. Casos especiales y seguimiento

### 4.1 `solicitante` (personal externo)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_solicitante | serial | PK | |
| unidad | varchar(120) | NN | Unidad/área de la empresa. |
| nombre | varchar(120) | NN | Nombre del contacto. |
| contacto | varchar(60) | NN | Teléfono/correo. |
| canal | varchar(20) | | `WHATSAPP`/`TELEGRAM`/`MCP_IA`/`MANUAL`. |
| creado_en | timestamptz | | |

### 4.2 `caso_especial`

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_caso_especial | serial | PK | |
| id_caso | bigint | FK→caso, null | Vinculado si existe. |
| id_solicitante | int | FK→solicitante | Quién lo reporta. |
| clasificacion | varchar(20) | NN | `REFERIDO` / `EMPRESA` / `GOBIERNO`. |
| tipo_actividad | varchar(20) | NN | `REPARACION` / `CONSTRUCCION`. |
| prioridad | varchar(20) | | Niveles por definir (S-11). |
| tiene_id_averia | boolean | default false | Referidos sin `id_averia`. |
| descripcion | text | | |
| requiere_informe | boolean | default true | Notificar a ACT-03. |
| estado | varchar(20) | | |
| creado_en / actualizado_en | timestamptz | | |

### 4.3 `seguimiento`

`id_seguimiento` PK · `id_caso` FK · `instancia_destino` (cola/área) · `motivo` ·
`fecha_envio` · `fecha_retorno` · `estado` (`EN_COLA`/`RESUELTO`/`DEVUELTO`) ·
`observacion` · `usuario`.

### 4.4 `cita` (RF-12, RF-05 módulos Empresas/Referidos)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_cita | serial | PK | |
| id_caso | bigint | FK→caso, null | |
| id_caso_especial | int | FK→caso_especial, null | |
| id_cuadrilla | int | FK→cuadrilla, null | |
| fecha_hora | timestamptz | NN | **Sin solapamiento** (RF-12). |
| tipo | varchar(20) | NN | `CONTACTO` / `ATENCION`. |
| estado | varchar(20) | | `PROPUESTA`/`CONFIRMADA`/`CUMPLIDA`/`REPROGRAMADA`/`DIFERIDA`. |
| observacion | text | | |
| creado_por | varchar(20) | | |

---

## 5. Despacho

### 5.1 `despacho`

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_despacho | serial | PK | |
| id_central | int | FK→central | |
| fecha | date | NN | Día del despacho. |
| id_cuadrilla | int | FK→cuadrilla | Cuadrilla destino (puede ser la 0). |
| estado | varchar(20) | | `BORRADOR`/`PUBLICADO`/`CERRADO`. |
| generado_auto | boolean | | Propuesto por el sistema (RF-24). |
| enviado_canal | varchar(20) | | `WHATSAPP`/`CORREO`/`TELEGRAM`. |
| enviado_en | timestamptz | | |
| reporte_produccion_en | timestamptz | | Cierre 04:00 p.m. (RF-27). |
| usuario_crea | varchar(20) | | |
| creado_en / actualizado_en | timestamptz | | |

### 5.2 `despacho_caso`

`id_despacho_caso` PK · `id_despacho` FK · `id_caso` FK · `id_sector` FK ·
`orden_visita` · `tipo_asignacion` (`REPARACION`/`CONSTRUCCION`/`REFERIDO`/`EMPRESA`/`FALLA_MASIVA`) ·
`estado` (`ASIGNADO`/`GESTIONADO`/`CERRADO`/`CITADO`/`DIFERIDO`) · `observacion`.

### 5.3 `falla_masiva`

`id_falla` PK · `id_central` FK · `descripcion` · `fecha_deteccion` · `id_sector` FK ·
`id_cuadrilla` FK (mayor cercanía) · `estado` · `planificacion` (texto) ·
`reporte_simple` · `creado_en`.

---

## 6. Gestión técnica (app móvil)

### 6.1 `actividad`

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_actividad | bigserial | PK | |
| id_caso | bigint | FK→caso | |
| id_usuario | int | FK→usuario | Técnico que reporta. |
| id_cuadrilla | int | FK→cuadrilla | |
| tipo | varchar(20) | NN | `CONTACTO`/`CIERRE`/`ENRUTE`/`DIFERIDO`/`INCIDENTE`/`FALLA_MASIVA`. |
| resultado | varchar(20) | | `CONTACTADO`/`CERRADO`/`ENRUTADO`/`DIFERIDO`. |
| reporte_corto | text | | Descripción de la actividad/justificación. |
| metodo | varchar(20) | | Cierre: `IVR`/`COS`/`SACAS`. Enrutado: cola. |
| codigo_causa | varchar(20) | FK→causa | Para enrute/diferido. |
| fecha_hora | timestamptz | NN | Del dispositivo. |
| latitud / longitud | numeric(10,7) | | GPS. |
| sincronizado | boolean | default false | Origen offline. |
| creado_en | timestamptz | | |

### 6.2 `evidencia` (RF-14, RF-04 procedimiento)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_evidencia | bigserial | PK | |
| id_actividad | bigint | FK→actividad | |
| tipo | varchar(20) | NN | `POTENCIA`/`NAVEGACION`/`DEMO`. |
| serial_imagen | varchar(160) | NN, UQ | `N.º caso + id_averia + tipo + fecha/hora`. |
| ruta_local | varchar(255) | | Ruta en la app. |
| ruta_remota | varchar(255) | | Objeto en Storage. |
| latitud / longitud | numeric(10,7) | | Coordenadas marcadas. |
| fecha_hora | timestamptz | NN | Marca de la captura. |
| origen_camara | boolean | NN, default true | `false` = inválido (galería prohibida). |

### 6.3 `dispositivo_seguridad`

`id_dispositivo` PK · `p00` FK→usuario · `palabras_hash` (jsonb, 12 hashes) ·
`clave_privada_ref` · `documento_cifrado` (bytea/text) · `bloqueado` ·
`actualizado_en` · `version`.

### 6.4 `sincronizacion`

`id_sync` PK · `id_dispositivo` FK · `id_tecnico` FK · `inicio` · `fin` ·
`casos_descargados` · `actividades_subidas` · `evidencias_subidas` ·
`archivo_zip` (nombre `central+cuadrilla+fecha`) · `estado` · `detalle_json`.

---

## 7. Catálogos y soporte

- **`causa`**: `codigo_causa` PK · `descripcion` · `subcodigo` · `descripcion_subcodigo` · `tipo` · `activo`.
- **`catalogo_metodo`**: `id` · `dominio` (`CIERRE`/`ENRUTE`/`DIFERIDO`) · `codigo` · `nombre` · `activo`.
- **`notificacion`**: `id` · `canal` (`WHATSAPP`/`TELEGRAM`/`CORREO`/`MCP_IA`) · `destinatario` · `asunto` · `cuerpo` · `id_caso` · `estado` (`PENDIENTE`/`ENVIADO`/`FALLIDO`) · `enviado_en`.
- **`incidente`**: `id` · `tipo` (`FLOTA`/`HERRAMIENTA`) · `id_flota`/`id_herramienta` · `descripcion` · `id_actividad` · `estado`.
- **`ingesta_lote`**: `id_lote` · `archivo` · `fecha_archivo` · `id_central` · `filas_leidas` · `filas_central` · `casos_nuevos` · `casos_duplicados` · `casos_descartados` · `estado` · `usuario` · `creado_en`.
- **`configuracion`**: `clave` PK · `valor` (jsonb) · `descripcion`. Ej.: frases de exclusión `["LOSS ROJO","FALLA FIBRA","Fibra Dañada"]`, reglas de despacho (≥2 referidos, ≥1 empresa), hora de corte (16:00).
- **`auditoria`**: `id` · `usuario` · `accion` · `entidad` · `id_entidad` · `datos_antes` (jsonb) · `datos_despues` (jsonb) · `ip` · `fecha_hora`.

---

## 8. Insumos (v2)

- **`insumo`**: `id_insumo` · `codigo` UQ · `nombre` · `unidad_medida` · `stock_minimo` · `activo`.
- **`inventario_movimiento`**: `id_mov` · `id_insumo` · `tipo` (`INGRESO`/`EGRESO`/`AJUSTE`) · `cantidad` · `id_orden` · `id_tecnico` · `fecha` · `usuario`.
- **`orden_material`**: `id_orden` · `id_caso` · `id_cuadrilla` · `solicitante` · `estado` · `fecha` · `observacion`.
- **`orden_material_detalle`**: `id_orden` · `id_insumo` · `cantidad_solicitada` · `cantidad_entregada`.

---

## 9. Relaciones principales

```
central 1──N sector            sector  1──N sector_direccion
central 1──N tecnico           central 1──N flota
central 1──N cuadrilla         cuadrilla N──M tecnico   cuadrilla 1──N despacho
caso    N──1 central           caso     N──1 sector     caso    1──N actividad
caso    1──N despacho_caso     despacho 1──N despacho_caso
caso    1──1 caso_especial     caso_especial N──1 solicitante
caso    1──N seguimiento       caso    1──N cita        caso    1──N caso_estado_hist
actividad 1──N evidencia       usuario 1──N actividad
dispositivo_seguridad 1──N sincronizacion
```

---

## 10. Dudas del diccionario (a resolver con el usuario)

1. **Unicidad de `id_averia`**: ✅ **único global** (P1.3).
2. **`telefono`**: ¿puede haber múltiples casos por teléfono? ¿Se normaliza (sin guiones)?
3. **Sectorización**: ✅ **resuelto (P1.2)** — el supervisor define sectores con nombre y una lista
   de direcciones/alias; el caso se asigna por coincidencia sobre `direccion`.
4. **Referidos**: estructura exacta de la ficha (Unidad + Nombre + Contacto) y niveles de prioridad.
5. **Causas**: catálogo oficial (código/subcódigo) y quién lo mantiene.
6. **Insumos**: confirmar que quedan para v2 (RF-05).
7. **Histórico**: ¿se conservan todos los CSV cargados y sus versiones?
8. **Multi-central**: ¿`central` única en v1 o multi-central desde el inicio?
