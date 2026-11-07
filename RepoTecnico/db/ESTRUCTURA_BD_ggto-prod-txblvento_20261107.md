# Estructura viva de la BD `ggtov2` — ggto-prod-txblvento (06/11/2026)

**Tablas: 44 · Vistas: 0 · Secuencias: 41 · Extensiones: pg_trgm, pgcrypto, plpgsql**

Generada por introspección (`information_schema` + `pg_catalog`). El DDL completo está en `estructura_viva_20261107.sql` (`pg_dump --schema-only`).


## Relaciones (FOREIGN KEYS)

- **`actividad`**: `id_caso` → `caso`, `id_causa` → `causa`, `id_cuadrilla` → `cuadrilla`, `id_metodo` → `catalogo_metodo`, `id_usuario` → `usuario`
- **`auditoria`**: `id_central` → `central`
- **`caso`**: `creado_por` → `usuario`, `id_causa` → `causa`, `id_central` → `central`, `id_lote_ingesta` → `ingesta_lote`, `id_pago` → `identificador_pago`, `id_sector` → `sector`
- **`caso_especial`**: `id_caso` → `caso`, `id_solicitante` → `solicitante`
- **`caso_estado_hist`**: `id_caso` → `caso`, `usuario` → `usuario`
- **`cita`**: `creado_por` → `usuario`, `id_caso` → `caso`, `id_caso_especial` → `caso_especial`, `id_cuadrilla` → `cuadrilla`
- **`cuadrilla`**: `id_central` → `central`, `id_flota` → `flota`
- **`cuadrilla_herramienta`**: `id_cuadrilla` → `cuadrilla`, `id_herramienta` → `herramienta`
- **`cuadrilla_sector_dia`**: `id_central` → `central`, `id_cuadrilla` → `cuadrilla`, `id_sector` → `sector`, `usuario` → `usuario`
- **`cuadrilla_tecnico`**: `id_cuadrilla` → `cuadrilla`, `id_tecnico` → `tecnico`
- **`despacho`**: `id_central` → `central`, `id_cuadrilla` → `cuadrilla`, `usuario_crea` → `usuario`
- **`despacho_caso`**: `id_caso` → `caso`, `id_despacho` → `despacho`, `id_sector` → `sector`
- **`despacho_metrica_diaria`**: `id_central` → `central`
- **`dispositivo_seguridad`**: `p00` → `usuario`
- **`evidencia`**: `id_actividad` → `actividad`, `id_caso` → `caso`
- **`falla_masiva`**: `cerrada_por` → `usuario`, `id_central` → `central`, `id_cuadrilla` → `cuadrilla`, `id_sector` → `sector`, `id_validador_crass` → `solicitante`
- **`falla_masiva_caso`**: `agregado_por` → `usuario`, `id_caso` → `caso`, `id_falla` → `falla_masiva`
- **`flota`**: `id_central` → `central`
- **`herramienta`**: `id_central` → `central`
- **`identificador_pago`**: `id_central` → `central`
- **`incidente`**: `id_actividad` → `actividad`, `id_flota` → `flota`, `id_herramienta` → `herramienta`
- **`ingesta_lote`**: `id_central` → `central`
- **`insumo`**: `id_central` → `central`
- **`inventario_movimiento`**: `id_insumo` → `insumo`, `id_orden` → `orden_material`, `id_tecnico` → `tecnico`, `usuario` → `usuario`
- **`mensaje`**: `id_caso` → `caso`, `id_central` → `central`, `id_cuadrilla` → `cuadrilla`, `id_tecnico` → `tecnico`, `id_usuario_destino` → `usuario`, `origen_p00` → `usuario`
- **`mensaje_destino`**: `id_mensaje` → `mensaje`, `id_tecnico` → `tecnico`, `p00` → `usuario`
- **`notificacion`**: `id_caso` → `caso`
- **`orden_material`**: `id_caso` → `caso`, `id_cuadrilla` → `cuadrilla`, `id_falla` → `falla_masiva`, `solicitante_usuario` → `usuario`
- **`orden_material_detalle`**: `id_insumo` → `insumo`, `id_orden` → `orden_material`
- **`sector`**: `id_central` → `central`
- **`sector_direccion`**: `id_sector` → `sector`
- **`seguimiento`**: `id_caso` → `caso`, `usuario` → `usuario`
- **`sincronizacion`**: `id_dispositivo` → `dispositivo_seguridad`, `id_tecnico` → `tecnico`
- **`solicitante`**: `id_central` → `central`
- **`sync_check`**: `id_sync_log` → `sync_log`
- **`sync_log`**: `id_central` → `central`, `id_cuadrilla` → `cuadrilla`
- **`tecnico`**: `id_central` → `central`
- **`usuario`**: `id_central` → `central`, `id_rol` → `rol`, `id_tecnico` → `tecnico`

## Tablas

| Tabla | col | Filas | Columnas |
|---|---:|---:|---|
| `actividad` | 16 | 120 | `id_actividad` bigint [PK,default=nextval('actividad_id_actividad_seq'::regclass)] • `id_caso` bigint [FK,NN] • `id_usuario` integer [FK] • `id_cuadrilla` integer [FK] • `tipo` character varying [NN] • `resultado` character varying • `reporte_corto` text • `id_metodo` integer [FK] • `id_causa` integer [FK] • `fecha_hora` timestamp with time zone [NN,default=now()] • `latitud` numeric • `longitud` numeric • `sincronizado` boolean [NN,default=false] • `creado_en` timestamp with time zone [NN,default=now()] • `id_actividad_local` integer • `dispositivo_id` character varying |
| `auditoria` | 12 | 799 | `id_auditoria` bigint [PK,default=nextval('auditoria_id_auditoria_seq'::regclass)] • `usuario` character varying • `accion` character varying [NN] • `entidad` character varying • `id_entidad` character varying • `datos_antes` jsonb • `datos_despues` jsonb • `ip` inet • `fecha_hora` timestamp with time zone [NN,default=now()] • `id_central` integer [FK] • `resultado` character varying • `request_id` character varying |
| `caso` | 66 | 167 | `id_caso` bigint [PK,default=nextval('caso_id_caso_seq'::regclass)] • `id_central` integer [FK,NN] • `id_averia` character varying [NN] • `origen` character varying [NN,default='INGESTA_CSV'::character varying] • `tipo_caso` character varying [NN,default='AVERIA'::character varying] • `categoria` character varying [NN,default='RESIDENCIAL'::character varying] • `estado_actual` character varying [NN,default='NUEVO'::character varying] • `id_sector` integer [FK] • `id_causa` integer [FK] • `id_lote_ingesta` bigint [FK] • `en_gestion_supervisor` boolean [NN,default=false] • `es_falla_masiva` boolean [NN,default=false] • `creado_por` character varying [FK] • `region` character varying • `estado_geografico` character varying • `capital_estado` character varying • `municipio` character varying • `parroquia` character varying • `estado_operativo` character varying • `distrito` character varying • `area` character varying • `codigo_central` character varying • `nombre_central` character varying • `telefono` character varying • `fecha_reporte` timestamp with time zone • `persona_reporta` character varying • `contacto_cliente` character varying • `fecha_compromiso` timestamp with time zone • `fecha_cita` timestamp with time zone • `ultimo_comentario` text • `results` text • `asignado_a` character varying • `cuadrilla_externa` character varying • `estatus_origen` character varying • `problema_reporte` text • `informacion` text • `nombre_cliente` character varying • `direccion` text • `olt` character varying • `plan` character varying • `slot` character varying • `puerto` character varying • `fat` character varying • `serial` character varying • `extra` character varying • `area_trabajo` character varying • `tipo_servicio` character varying • `tipo_problema` character varying • `dias_area_resolutoria` integer • `unidad_negocio` character varying • `ups` character varying • `codigos_gestionados_venapp` character varying • `codigos_sin_gestion_venapp` character varying • `reparador_principal` character varying • `ayudantes` jsonb [NN,default='[]'::jsonb] • `flota_can` character varying • `despacho_nombre` character varying • `despacho_apellido` character varying • `telefono_oficina` character varying • `telefono_movil` character varying • `fecha_hora_asignacion` timestamp with time zone • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] • `id_pago` bigint [FK] • `contacto2` character varying • `telefono_ip` character varying |
| `caso_d89_backup` | 5 | 65 | `id_caso` bigint [PK] • `telefono` character varying • `contacto_cliente` character varying • `informacion` text • `respaldado_en` timestamp with time zone [NN,default=now()] |
| `caso_especial` | 13 | 87 | `id_caso_especial` integer [PK,default=nextval('caso_especial_id_caso_especial_seq'::regclass)] • `id_caso` bigint [FK] • `id_solicitante` integer [FK] • `clasificacion` character varying [NN] • `tipo_actividad` character varying [NN] • `prioridad` character varying [NN,default='MEDIA'::character varying] • `tiene_id_averia` boolean [NN,default=false] • `descripcion` text • `requiere_informe` boolean [NN,default=true] • `estado` character varying [NN,default='ABIERTO'::character varying] • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] • `informe` text |
| `caso_estado_hist` | 7 | 633 | `id_hist` bigint [PK,default=nextval('caso_estado_hist_id_hist_seq'::regclass)] • `id_caso` bigint [FK,NN] • `estado_anterior` character varying • `estado_nuevo` character varying [NN] • `motivo` text • `usuario` character varying [FK] • `fecha_hora` timestamp with time zone [NN,default=now()] |
| `catalogo_metodo` | 5 | 10 | `id_metodo` integer [PK,default=nextval('catalogo_metodo_id_metodo_seq'::regclass)] • `dominio` character varying [NN] • `codigo` character varying [NN] • `nombre` character varying [NN] • `activo` boolean [NN,default=true] |
| `causa` | 8 | 0 | `id_causa` integer [PK,default=nextval('causa_id_causa_seq'::regclass)] • `codigo_causa` character varying [NN] • `subcodigo_causa` character varying [NN,default=''::character varying] • `descripcion` character varying • `descripcion_subcodigo` character varying • `tipo` character varying • `activo` boolean [NN,default=true] • `creado_en` timestamp with time zone [NN,default=now()] |
| `central` | 14 | 1 | `id_central` integer [PK,default=nextval('central_id_central_seq'::regclass)] • `region` character varying [NN] • `estado_geografico` character varying [NN] • `capital_estado` character varying • `municipio` character varying [NN] • `parroquia` character varying [NN] • `estado_operativo` character varying • `distrito` character varying • `area` character varying [NN] • `codigo_central` character varying [NN] • `nombre_central` character varying [NN] • `activa` boolean [NN,default=true] • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] |
| `cita` | 11 | 15 | `id_cita` bigint [PK,default=nextval('cita_id_cita_seq'::regclass)] • `id_caso` bigint [FK] • `id_caso_especial` integer [FK] • `id_cuadrilla` integer [FK] • `fecha_hora` timestamp with time zone [NN] • `tipo` character varying [NN,default='CONTACTO'::character varying] • `estado` character varying [NN,default='PROPUESTA'::character varying] • `observacion` text • `creado_por` character varying [FK] • `creado_en` timestamp with time zone [NN,default=now()] • `recordatorio_para` timestamp with time zone |
| `configuracion` | 4 | 35 | `clave` character varying [PK] • `valor` jsonb [NN] • `descripcion` text • `actualizado_en` timestamp with time zone [NN,default=now()] |
| `cuadrilla` | 9 | 5 | `id_cuadrilla` integer [PK,default=nextval('cuadrilla_id_cuadrilla_seq'::regclass)] • `id_central` integer [FK,NN] • `codigo` character varying [NN] • `nombre` character varying [NN] • `id_flota` integer [FK] • `es_supervisor` boolean [NN,default=false] • `activa` boolean [NN,default=true] • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] |
| `cuadrilla_herramienta` | 4 | 0 | `id_cuadrilla` integer [PK,FK] • `id_herramienta` integer [PK,FK] • `asignada_en` timestamp with time zone [PK,default=now()] • `devuelta_en` timestamp with time zone |
| `cuadrilla_sector_dia` | 7 | 2 | `id_asignacion` bigint [PK,default=nextval('cuadrilla_sector_dia_id_asignacion_seq'::regclass)] • `id_central` integer [FK,NN] • `fecha` date [NN] • `id_cuadrilla` integer [FK,NN] • `id_sector` integer [FK,NN] • `usuario` character varying [FK] • `creado_en` timestamp with time zone [NN,default=now()] |
| `cuadrilla_tecnico` | 5 | 13 | `id_cuadrilla` integer [PK,FK] • `id_tecnico` integer [PK,FK] • `desde` date [PK,default=CURRENT_DATE] • `rol_cuadrilla` character varying [NN,default='REPARADOR_PRINCIPAL'::character varying] • `hasta` date |
| `despacho` | 15 | 8 | `id_despacho` bigint [PK,default=nextval('despacho_id_despacho_seq'::regclass)] • `id_central` integer [FK,NN] • `fecha` date [NN] • `id_cuadrilla` integer [FK,NN] • `estado` character varying [NN,default='BORRADOR'::character varying] • `generado_auto` boolean [NN,default=false] • `enviado_canal` character varying • `enviado_en` timestamp with time zone • `reporte_produccion_en` timestamp with time zone • `usuario_crea` character varying [FK] • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] • `cerrado_en` timestamp with time zone • `cierre_auto` boolean [NN,default=false] • `reprocesado_en` timestamp with time zone |
| `despacho_caso` | 8 | 63 | `id_despacho_caso` bigint [PK,default=nextval('despacho_caso_id_despacho_caso_seq'::regclass)] • `id_despacho` bigint [FK,NN] • `id_caso` bigint [FK,NN] • `id_sector` integer [FK] • `orden_visita` smallint • `tipo_asignacion` character varying • `estado` character varying [NN,default='ASIGNADO'::character varying] • `observacion` text |
| `despacho_metrica_diaria` | 18 | 6 | `id_metrica` bigint [PK] • `id_central` integer [FK,NN] • `fecha` date [NN] • `columna` character varying [NN] • `asignados` integer [NN,default=0] • `asignados_reparacion` integer [NN,default=0] • `asignados_construccion` integer [NN,default=0] • `cerrados` integer [NN,default=0] • `cerrados_reparacion` integer [NN,default=0] • `cerrados_construccion` integer [NN,default=0] • `enrutado` integer [NN,default=0] • `citado` integer [NN,default=0] • `citado_reparacion` integer [NN,default=0] • `citado_construccion` integer [NN,default=0] • `diferidos` integer [NN,default=0] • `diferidos_reparacion` integer [NN,default=0] • `diferidos_construccion` integer [NN,default=0] • `recalculado_en` timestamp with time zone [NN,default=now()] |
| `dispositivo_seguridad` | 8 | 9 | `id_dispositivo` bigint [PK,default=nextval('dispositivo_seguridad_id_dispositivo_seq'::regclass)] • `p00` character varying [FK,NN] • `palabras_hash` jsonb [NN,default='[]'::jsonb] • `clave_privada_ref` character varying • `documento_cifrado` text • `bloqueado` boolean [NN,default=false] • `version` integer [NN,default=1] • `actualizado_en` timestamp with time zone [NN,default=now()] |
| `evidencia` | 12 | 22 | `id_evidencia` bigint [PK,default=nextval('evidencia_id_evidencia_seq'::regclass)] • `id_actividad` bigint [FK] • `tipo` character varying [NN] • `serial_imagen` character varying [NN] • `ruta_local` character varying • `ruta_remota` character varying • `latitud` numeric • `longitud` numeric • `fecha_hora` timestamp with time zone [NN] • `origen_camara` boolean [NN,default=true] • `creado_en` timestamp with time zone [NN,default=now()] • `id_caso` bigint [FK] |
| `falla_masiva` | 30 | 0 | `id_falla` bigint [PK,default=nextval('falla_masiva_id_falla_seq'::regclass)] • `id_central` integer [FK,NN] • `descripcion` text [NN] • `fecha_deteccion` timestamp with time zone [NN,default=now()] • `origen` character varying [NN,default='AUTOMATICA'::character varying] • `id_sector` integer [FK] • `id_cuadrilla` integer [FK] • `estado` character varying [NN,default='DETECTADA'::character varying] • `planificacion` text • `reporte_simple` text • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] • `planificada_en` timestamp with time zone • `clave_concentracion` character varying • `odn` character varying • `direccion` character varying • `fat` character varying • `evidencias` text • `descripcion_cierre` text • `id_validador_crass` bigint [FK] • `evidencias_cierre` text • `cerrada_por` character varying [FK] • `cerrada_en` timestamp with time zone • `casos_cerrados` integer [NN,default=0] • `latitud` numeric • `longitud` numeric • `olt` character varying • `slot` character varying • `puerto` character varying • `extra` character varying |
| `falla_masiva_caso` | 6 | 0 | `id_asociacion` bigint [PK,default=nextval('falla_masiva_caso_id_asociacion_seq'::regclass)] • `id_falla` bigint [FK,NN] • `id_caso` bigint [FK,NN] • `origen` character varying [NN,default='AUTO'::character varying] • `agregado_por` character varying [FK] • `agregado_en` timestamp with time zone [NN,default=now()] |
| `flota` | 14 | 3 | `id_flota` integer [PK,default=nextval('flota_id_flota_seq'::regclass)] • `id_central` integer [FK,NN] • `can` character varying [NN] • `tipo` character varying • `marca` character varying • `modelo` character varying • `placa` character varying • `combustible` character varying • `status` character varying [NN,default='DISPONIBLE'::character varying] • `estado_cauchos` character varying • `estado_fluidos` character varying • `estado_general` character varying • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] |
| `herramienta` | 8 | 0 | `id_herramienta` integer [PK,default=nextval('herramienta_id_herramienta_seq'::regclass)] • `id_central` integer [FK,NN] • `nombre` character varying [NN] • `codigo` character varying [NN] • `estado` character varying [NN,default='DISPONIBLE'::character varying] • `observacion` text • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] |
| `identificador_pago` | 8 | 88 | `id_pago` bigint [PK,default=nextval('identificador_pago_id_pago_seq'::regclass)] • `numero` character varying [NN] • `id_central` integer [FK,NN] • `nombre_titular` character varying • `direccion_principal` text • `estado` character varying [NN,default='ACTIVO'::character varying] • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] |
| `incidente` | 8 | 0 | `id_incidente` bigint [PK,default=nextval('incidente_id_incidente_seq'::regclass)] • `tipo` character varying [NN] • `id_flota` integer [FK] • `id_herramienta` integer [FK] • `descripcion` text • `id_actividad` bigint [FK] • `estado` character varying [NN,default='REPORTADO'::character varying] • `creado_en` timestamp with time zone [NN,default=now()] |
| `ingesta_lote` | 16 | 4 | `id_lote` bigint [PK,default=nextval('ingesta_lote_id_lote_seq'::regclass)] • `archivo` character varying [NN] • `fecha_archivo` date • `id_central` integer [FK] • `filas_leidas` integer [NN,default=0] • `filas_central` integer [NN,default=0] • `casos_nuevos` integer [NN,default=0] • `casos_duplicados` integer [NN,default=0] • `casos_descartados` integer [NN,default=0] • `estado` character varying [NN,default='PROCESANDO'::character varying] • `detalle_error` text • `usuario` character varying • `creado_en` timestamp with time zone [NN,default=now()] • `filas_sin_identificador_pago` integer [NN,default=0] • `filas_con_contacto` integer [NN,default=0] • `avisos` jsonb [NN,default='[]'::jsonb] |
| `insumo` | 9 | 0 | `id_insumo` integer [PK,default=nextval('insumo_id_insumo_seq'::regclass)] • `id_central` integer [FK] • `codigo` character varying [NN] • `nombre` character varying [NN] • `unidad_medida` character varying [NN,default='UNIDAD'::character varying] • `stock_minimo` numeric [NN,default=0] • `activo` boolean [NN,default=true] • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] |
| `inventario_movimiento` | 9 | 0 | `id_mov` bigint [PK,default=nextval('inventario_movimiento_id_mov_seq'::regclass)] • `id_insumo` integer [FK,NN] • `tipo` character varying [NN] • `cantidad` numeric [NN] • `id_orden` bigint [FK] • `id_tecnico` integer [FK] • `fecha` timestamp with time zone [NN,default=now()] • `usuario` character varying [FK] • `observacion` text |
| `mensaje` | 13 | 48 | `id_mensaje` bigint [PK,default=nextval('mensaje_id_mensaje_seq'::regclass)] • `id_central` integer [FK,NN] • `origen_p00` character varying [FK] • `destino_tipo` character varying [NN] • `id_cuadrilla` integer [FK] • `id_tecnico` integer [FK] • `tipo` character varying [NN] • `cuerpo` character varying [NN] • `id_caso` bigint [FK] • `dedupe_key` character varying • `creado_en` timestamp with time zone [NN,default=now()] • `expira_en` timestamp with time zone [NN,default=(now() + '5 days'::interval)] • `id_usuario_destino` character varying [FK] |
| `mensaje_destino` | 5 | 68 | `id_mensaje` bigint [FK,NN] • `id_tecnico` integer [FK] • `leido_en` timestamp with time zone • `id_destino` bigint [PK,default=nextval('mensaje_destino_id_destino_seq'::regclass)] • `p00` character varying [FK] |
| `notificacion` | 12 | 1 | `id_notificacion` bigint [PK,default=nextval('notificacion_id_notificacion_seq'::regclass)] • `canal` character varying [NN] • `destinatario` character varying • `asunto` character varying • `cuerpo` text • `id_caso` bigint [FK] • `estado` character varying [NN,default='PENDIENTE'::character varying] • `error` text • `enviado_en` timestamp with time zone • `creado_en` timestamp with time zone [NN,default=now()] • `intentos` smallint [NN,default=0] • `proximo_intento` timestamp with time zone |
| `orden_material` | 10 | 0 | `id_orden` bigint [PK,default=nextval('orden_material_id_orden_seq'::regclass)] • `id_caso` bigint [FK] • `id_cuadrilla` integer [FK] • `solicitante_usuario` character varying [FK] • `estado` character varying [NN,default='SOLICITADA'::character varying] • `fecha` timestamp with time zone [NN,default=now()] • `observacion` text • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] • `id_falla` bigint [FK] |
| `orden_material_detalle` | 5 | 0 | `id_orden_detalle` bigint [PK,default=nextval('orden_material_detalle_id_orden_detalle_seq'::regclass)] • `id_orden` bigint [FK,NN] • `id_insumo` integer [FK,NN] • `cantidad_solicitada` numeric [NN] • `cantidad_entregada` numeric [NN,default=0] |
| `rol` | 7 | 5 | `id_rol` integer [PK,default=nextval('rol_id_rol_seq'::regclass)] • `codigo` character varying [NN] • `nombre` character varying [NN] • `descripcion` text • `permisos` jsonb [NN,default='{}'::jsonb] • `activo` boolean [NN,default=true] • `creado_en` timestamp with time zone [NN,default=now()] |
| `sector` | 9 | 5 | `id_sector` integer [PK,default=nextval('sector_id_sector_seq'::regclass)] • `id_central` integer [FK,NN] • `nombre` character varying [NN] • `codigo` character varying [NN] • `descripcion` text • `prioridad` smallint [NN,default=100] • `activo` boolean [NN,default=true] • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] |
| `sector_direccion` | 7 | 27 | `id_sector_direccion` integer [PK,default=nextval('sector_direccion_id_sector_direccion_seq'::regclass)] • `id_sector` integer [FK,NN] • `patron` character varying [NN] • `tipo_coincidencia` character varying [NN,default='CONTIENE'::character varying] • `normalizar` boolean [NN,default=true] • `activo` boolean [NN,default=true] • `creado_en` timestamp with time zone [NN,default=now()] |
| `seguimiento` | 9 | 1 | `id_seguimiento` bigint [PK,default=nextval('seguimiento_id_seguimiento_seq'::regclass)] • `id_caso` bigint [FK,NN] • `instancia_destino` character varying [NN] • `motivo` text • `fecha_envio` timestamp with time zone [NN,default=now()] • `fecha_retorno` timestamp with time zone • `estado` character varying [NN,default='EN_COLA'::character varying] • `observacion` text • `usuario` character varying [FK] |
| `sincronizacion` | 11 | 0 | `id_sync` bigint [PK,default=nextval('sincronizacion_id_sync_seq'::regclass)] • `id_dispositivo` bigint [FK] • `id_tecnico` integer [FK] • `inicio` timestamp with time zone [NN,default=now()] • `fin` timestamp with time zone • `casos_descargados` integer [NN,default=0] • `actividades_subidas` integer [NN,default=0] • `evidencias_subidas` integer [NN,default=0] • `archivo_zip` character varying • `estado` character varying [NN,default='EN_PROCESO'::character varying] • `detalle_json` jsonb |
| `solicitante` | 11 | 22 | `id_solicitante` integer [PK,default=nextval('solicitante_id_solicitante_seq'::regclass)] • `unidad` character varying [NN] • `nombre` character varying [NN] • `contacto` character varying [NN] • `canal` character varying • `creado_en` timestamp with time zone [NN,default=now()] • `id_central` integer [FK] • `documento` character varying • `tipo` character varying [NN,default='SOLICITANTE'::character varying] • `activo` boolean [NN,default=true] • `actualizado_en` timestamp with time zone [NN,default=now()] |
| `sync_check` | 6 | 64 | `id_sync_check` bigint [PK,default=nextval('sync_check_id_sync_check_seq'::regclass)] • `id_sync_log` bigint [FK,NN] • `paso` character varying [NN] • `estado` character varying [NN] • `fecha_hora` timestamp with time zone • `detalle` jsonb |
| `sync_log` | 16 | 16 | `id_sync_log` bigint [PK,default=nextval('sync_log_id_sync_log_seq'::regclass)] • `p00` character varying [NN] • `id_cuadrilla` integer [FK] • `tipo` character varying [NN] • `dispositivo_id` character varying • `version_app` character varying • `iniciado_en` timestamp with time zone [NN,default=now()] • `finalizado_en` timestamp with time zone • `recibidos` integer [NN,default=0] • `procesados` integer [NN,default=0] • `errores` integer [NN,default=0] • `estado` character varying [NN,default='EN_PROCESO'::character varying] • `detalle` jsonb • `plataforma` character varying [NN,default='APK'::character varying] • `duracion_ms` integer • `id_central` integer [FK] |
| `tecnico` | 12 | 10 | `id_tecnico` integer [PK,default=nextval('tecnico_id_tecnico_seq'::regclass)] • `id_central` integer [FK,NN] • `nombre` character varying [NN] • `apellido` character varying • `cedula` character varying • `p00` character varying [NN] • `telefono` character varying • `correo` character varying • `especialidad` character varying • `status` character varying [NN,default='ACTIVO'::character varying] • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] |
| `usuario` | 17 | 10 | `id_usuario` integer [PK,default=nextval('usuario_id_usuario_seq'::regclass)] • `p00` character varying [NN] • `correo` character varying • `clave_hash` character varying [NN] • `id_rol` integer [FK,NN] • `id_tecnico` integer [FK] • `id_central` integer [FK] • `intentos_fallidos` smallint [NN,default=0] • `bloqueado` boolean [NN,default=false] • `bloqueo_cliente` boolean [NN,default=false] • `requiere_cambio_clave` boolean [NN,default=false] • `activo` boolean [NN,default=true] • `ultimo_acceso` timestamp with time zone • `creado_en` timestamp with time zone [NN,default=now()] • `actualizado_en` timestamp with time zone [NN,default=now()] • `nombre` character varying • `apellido` character varying |

## Vistas


## Secuencias

- `actividad_id_actividad_seq` (último valor: 328)
- `auditoria_id_auditoria_seq` (último valor: 799)
- `caso_especial_id_caso_especial_seq` (último valor: 100)
- `caso_estado_hist_id_hist_seq` (último valor: 1271)
- `caso_id_caso_seq` (último valor: 678)
- `catalogo_metodo_id_metodo_seq` (último valor: 10)
- `causa_id_causa_seq` (último valor: 1)
- `central_id_central_seq` (último valor: 2)
- `cita_id_cita_seq` (último valor: 55)
- `cuadrilla_id_cuadrilla_seq` (último valor: 17)
- `cuadrilla_sector_dia_id_asignacion_seq` (último valor: 300)
- `despacho_caso_id_despacho_caso_seq` (último valor: 3072)
- `despacho_id_despacho_seq` (último valor: 262)
- `despacho_metrica_diaria_id_metrica_seq` (último valor: 522)
- `dispositivo_seguridad_id_dispositivo_seq` (último valor: 16)
- `evidencia_id_evidencia_seq` (último valor: 89)
- `falla_masiva_caso_id_asociacion_seq` (último valor: 58)
- `falla_masiva_id_falla_seq` (último valor: 37)
- `flota_id_flota_seq` (último valor: 4)
- `herramienta_id_herramienta_seq` (último valor: None)
- `identificador_pago_id_pago_seq` (último valor: 292)
- `incidente_id_incidente_seq` (último valor: None)
- `ingesta_lote_id_lote_seq` (último valor: 47)
- `insumo_id_insumo_seq` (último valor: None)
- `inventario_movimiento_id_mov_seq` (último valor: None)
- `mensaje_destino_id_destino_seq` (último valor: 814)
- `mensaje_id_mensaje_seq` (último valor: 950)
- `notificacion_id_notificacion_seq` (último valor: 57)
- `orden_material_detalle_id_orden_detalle_seq` (último valor: None)
- `orden_material_id_orden_seq` (último valor: None)
- `rol_id_rol_seq` (último valor: 6)
- `sector_direccion_id_sector_direccion_seq` (último valor: 63)
- `sector_id_sector_seq` (último valor: 16)
- `seguimiento_id_seguimiento_seq` (último valor: 6)
- `seq_caso_ref` (último valor: 112)
- `sincronizacion_id_sync_seq` (último valor: None)
- `solicitante_id_solicitante_seq` (último valor: 36)
- `sync_check_id_sync_check_seq` (último valor: 2900)
- `sync_log_id_sync_log_seq` (último valor: 749)
- `tecnico_id_tecnico_seq` (último valor: 20)
- `usuario_id_usuario_seq` (último valor: 19)

## Índices (sin las PRIMARY KEY)

- `actividad` · `ix_actividad_caso`: CREATE INDEX ix_actividad_caso ON public.actividad USING btree (id_caso)
- `actividad` · `ix_actividad_usuario`: CREATE INDEX ix_actividad_usuario ON public.actividad USING btree (id_usuario)
- `actividad` · `ux_actividad_local`: CREATE UNIQUE INDEX ux_actividad_local ON public.actividad USING btree (dispositivo_id, id_actividad_local) WHERE ((id_actividad_local IS NOT NULL) AND (dispositivo_id IS NOT NULL))
- `auditoria` · `ix_auditoria_fecha`: CREATE INDEX ix_auditoria_fecha ON public.auditoria USING btree (fecha_hora)
- `caso` · `caso_id_averia_key`: CREATE UNIQUE INDEX caso_id_averia_key ON public.caso USING btree (id_averia)
- `caso` · `ix_caso_central`: CREATE INDEX ix_caso_central ON public.caso USING btree (id_central)
- `caso` · `ix_caso_direccion_trgm`: CREATE INDEX ix_caso_direccion_trgm ON public.caso USING gin (direccion gin_trgm_ops)
- `caso` · `ix_caso_estado`: CREATE INDEX ix_caso_estado ON public.caso USING btree (estado_actual)
- `caso` · `ix_caso_falla_masiva`: CREATE INDEX ix_caso_falla_masiva ON public.caso USING btree (es_falla_masiva)
- `caso` · `ix_caso_fecha_reporte`: CREATE INDEX ix_caso_fecha_reporte ON public.caso USING btree (fecha_reporte)
- `caso` · `ix_caso_gestion_supervisor`: CREATE INDEX ix_caso_gestion_supervisor ON public.caso USING btree (en_gestion_supervisor)
- `caso` · `ix_caso_id_pago`: CREATE INDEX ix_caso_id_pago ON public.caso USING btree (id_pago)
- `caso` · `ix_caso_id_pago_fecha`: CREATE INDEX ix_caso_id_pago_fecha ON public.caso USING btree (id_pago, fecha_reporte)
- `caso` · `ix_caso_lote`: CREATE INDEX ix_caso_lote ON public.caso USING btree (id_lote_ingesta)
- `caso` · `ix_caso_sector`: CREATE INDEX ix_caso_sector ON public.caso USING btree (id_sector)
- `caso` · `ix_caso_telefono`: CREATE INDEX ix_caso_telefono ON public.caso USING btree (telefono)
- `catalogo_metodo` · `catalogo_metodo_dominio_codigo_key`: CREATE UNIQUE INDEX catalogo_metodo_dominio_codigo_key ON public.catalogo_metodo USING btree (dominio, codigo)
- `causa` · `causa_codigo_causa_subcodigo_causa_key`: CREATE UNIQUE INDEX causa_codigo_causa_subcodigo_causa_key ON public.causa USING btree (codigo_causa, subcodigo_causa)
- `central` · `central_codigo_central_key`: CREATE UNIQUE INDEX central_codigo_central_key ON public.central USING btree (codigo_central)
- `cita` · `ix_cita_cuadrilla_fecha`: CREATE INDEX ix_cita_cuadrilla_fecha ON public.cita USING btree (id_cuadrilla, fecha_hora)
- `cuadrilla` · `cuadrilla_id_central_codigo_key`: CREATE UNIQUE INDEX cuadrilla_id_central_codigo_key ON public.cuadrilla USING btree (id_central, codigo)
- `cuadrilla` · `ux_cuadrilla_supervisor`: CREATE UNIQUE INDEX ux_cuadrilla_supervisor ON public.cuadrilla USING btree (id_central) WHERE es_supervisor
- `cuadrilla_sector_dia` · `cuadrilla_sector_dia_fecha_id_sector_key`: CREATE UNIQUE INDEX cuadrilla_sector_dia_fecha_id_sector_key ON public.cuadrilla_sector_dia USING btree (fecha, id_sector)
- `cuadrilla_sector_dia` · `ix_cuadrilla_sector_dia_fecha`: CREATE INDEX ix_cuadrilla_sector_dia_fecha ON public.cuadrilla_sector_dia USING btree (fecha, id_cuadrilla)
- `despacho` · `despacho_fecha_id_cuadrilla_key`: CREATE UNIQUE INDEX despacho_fecha_id_cuadrilla_key ON public.despacho USING btree (fecha, id_cuadrilla)
- `despacho_caso` · `despacho_caso_id_despacho_id_caso_key`: CREATE UNIQUE INDEX despacho_caso_id_despacho_id_caso_key ON public.despacho_caso USING btree (id_despacho, id_caso)
- `despacho_caso` · `ix_despacho_caso_caso`: CREATE INDEX ix_despacho_caso_caso ON public.despacho_caso USING btree (id_caso)
- `despacho_caso` · `ix_despacho_caso_despacho`: CREATE INDEX ix_despacho_caso_despacho ON public.despacho_caso USING btree (id_despacho)
- `despacho_metrica_diaria` · `despacho_metrica_diaria_unica`: CREATE UNIQUE INDEX despacho_metrica_diaria_unica ON public.despacho_metrica_diaria USING btree (id_central, fecha, columna)
- `despacho_metrica_diaria` · `ix_despacho_metrica_diaria_fecha`: CREATE INDEX ix_despacho_metrica_diaria_fecha ON public.despacho_metrica_diaria USING btree (id_central, fecha DESC)
- `dispositivo_seguridad` · `dispositivo_seguridad_p00_key`: CREATE UNIQUE INDEX dispositivo_seguridad_p00_key ON public.dispositivo_seguridad USING btree (p00)
- `evidencia` · `evidencia_serial_imagen_key`: CREATE UNIQUE INDEX evidencia_serial_imagen_key ON public.evidencia USING btree (serial_imagen)
- `evidencia` · `ix_evidencia_actividad`: CREATE INDEX ix_evidencia_actividad ON public.evidencia USING btree (id_actividad)
- `evidencia` · `ix_evidencia_caso`: CREATE INDEX ix_evidencia_caso ON public.evidencia USING btree (id_caso)
- `falla_masiva` · `ix_falla_masiva_estado`: CREATE INDEX ix_falla_masiva_estado ON public.falla_masiva USING btree (id_central, estado, fecha_deteccion DESC)
- `falla_masiva_caso` · `falla_masiva_caso_id_falla_id_caso_key`: CREATE UNIQUE INDEX falla_masiva_caso_id_falla_id_caso_key ON public.falla_masiva_caso USING btree (id_falla, id_caso)
- `falla_masiva_caso` · `ix_falla_masiva_caso_caso`: CREATE INDEX ix_falla_masiva_caso_caso ON public.falla_masiva_caso USING btree (id_caso)
- `flota` · `flota_can_key`: CREATE UNIQUE INDEX flota_can_key ON public.flota USING btree (can)
- `flota` · `flota_placa_key`: CREATE UNIQUE INDEX flota_placa_key ON public.flota USING btree (placa)
- `herramienta` · `herramienta_codigo_key`: CREATE UNIQUE INDEX herramienta_codigo_key ON public.herramienta USING btree (codigo)
- `identificador_pago` · `uq_ip_numero`: CREATE UNIQUE INDEX uq_ip_numero ON public.identificador_pago USING btree (numero)
- `insumo` · `insumo_codigo_key`: CREATE UNIQUE INDEX insumo_codigo_key ON public.insumo USING btree (codigo)
- `mensaje` · `ix_mensaje_central`: CREATE INDEX ix_mensaje_central ON public.mensaje USING btree (id_central)
- `mensaje` · `ix_mensaje_creado`: CREATE INDEX ix_mensaje_creado ON public.mensaje USING btree (creado_en DESC)
- `mensaje` · `ix_mensaje_expira`: CREATE INDEX ix_mensaje_expira ON public.mensaje USING btree (expira_en)
- `mensaje` · `mensaje_dedupe_key_key`: CREATE UNIQUE INDEX mensaje_dedupe_key_key ON public.mensaje USING btree (dedupe_key)
- `mensaje_destino` · `ix_mensaje_destino_tecnico`: CREATE INDEX ix_mensaje_destino_tecnico ON public.mensaje_destino USING btree (id_tecnico, id_mensaje)
- `mensaje_destino` · `ix_mensaje_destino_usuario`: CREATE INDEX ix_mensaje_destino_usuario ON public.mensaje_destino USING btree (p00, id_mensaje)
- `mensaje_destino` · `pk_mensaje_destino`: CREATE UNIQUE INDEX pk_mensaje_destino ON public.mensaje_destino USING btree (id_destino)
- `notificacion` · `ix_notificacion_caso`: CREATE INDEX ix_notificacion_caso ON public.notificacion USING btree (id_caso)
- `orden_material` · `ix_orden_material_id_falla`: CREATE INDEX ix_orden_material_id_falla ON public.orden_material USING btree (id_falla)
- `orden_material_detalle` · `orden_material_detalle_id_orden_id_insumo_key`: CREATE UNIQUE INDEX orden_material_detalle_id_orden_id_insumo_key ON public.orden_material_detalle USING btree (id_orden, id_insumo)
- `rol` · `rol_codigo_key`: CREATE UNIQUE INDEX rol_codigo_key ON public.rol USING btree (codigo)
- `sector` · `sector_id_central_codigo_key`: CREATE UNIQUE INDEX sector_id_central_codigo_key ON public.sector USING btree (id_central, codigo)
- `sector_direccion` · `ix_sector_direccion_sector`: CREATE INDEX ix_sector_direccion_sector ON public.sector_direccion USING btree (id_sector)
- `sector_direccion` · `ix_sector_patron_trgm`: CREATE INDEX ix_sector_patron_trgm ON public.sector_direccion USING gin (patron gin_trgm_ops)
- `sector_direccion` · `sector_direccion_id_sector_patron_key`: CREATE UNIQUE INDEX sector_direccion_id_sector_patron_key ON public.sector_direccion USING btree (id_sector, patron)
- `seguimiento` · `ix_seguimiento_caso`: CREATE INDEX ix_seguimiento_caso ON public.seguimiento USING btree (id_caso)
- `solicitante` · `ix_solicitante_central`: CREATE INDEX ix_solicitante_central ON public.solicitante USING btree (id_central, activo)
- `solicitante` · `ix_solicitante_tipo`: CREATE INDEX ix_solicitante_tipo ON public.solicitante USING btree (tipo, activo)
- `sync_check` · `sync_check_id_sync_log_paso_key`: CREATE UNIQUE INDEX sync_check_id_sync_log_paso_key ON public.sync_check USING btree (id_sync_log, paso)
- `sync_log` · `ix_sync_log_dispositivo`: CREATE INDEX ix_sync_log_dispositivo ON public.sync_log USING btree (dispositivo_id)
- `sync_log` · `ix_sync_log_estado`: CREATE INDEX ix_sync_log_estado ON public.sync_log USING btree (estado, iniciado_en DESC)
- `sync_log` · `ix_sync_log_iniciado`: CREATE INDEX ix_sync_log_iniciado ON public.sync_log USING btree (iniciado_en DESC)
- `sync_log` · `ix_sync_log_p00_fecha`: CREATE INDEX ix_sync_log_p00_fecha ON public.sync_log USING btree (p00, iniciado_en DESC)
- `tecnico` · `tecnico_cedula_key`: CREATE UNIQUE INDEX tecnico_cedula_key ON public.tecnico USING btree (cedula)
- `tecnico` · `tecnico_p00_key`: CREATE UNIQUE INDEX tecnico_p00_key ON public.tecnico USING btree (p00)
- `usuario` · `usuario_correo_key`: CREATE UNIQUE INDEX usuario_correo_key ON public.usuario USING btree (correo)
- `usuario` · `usuario_p00_key`: CREATE UNIQUE INDEX usuario_p00_key ON public.usuario USING btree (p00)

## Extensiones

- `pg_trgm`
- `pgcrypto`
- `plpgsql`