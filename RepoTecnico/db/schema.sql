-- =============================================================================
-- GGTO — Esquema de base de datos PostgreSQL
-- -----------------------------------------------------------------------------
-- Proyecto : GGTO — Gestión de averías y puntos ópticos
-- Cliente  : CANTV C.A. — Central Francisco Salias (Área 4)
-- Motor    : PostgreSQL 15/16
-- Documento: RepoTecnico/diccionario_datos.md  ·  RepoTecnico/modelo_er.md
-- -----------------------------------------------------------------------------
-- ESTE ARCHIVO SE EDITA A MEDIDA DEL DESARROLLO.
-- Es idempotente en lo posible (CREATE ... IF NOT EXISTS / ON CONFLICT).
--
-- Uso:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f RepoTecnico/db/schema.sql
--
-- Aplicar como usuario con privilegios DDL (ggtov2_app) sobre la base `ggtov2`.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Extensiones y utilidades
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- búsqueda difusa por dirección (RF-23 / D-33)

-- Actualiza automáticamente la columna actualizado_en en cada UPDATE.
CREATE OR REPLACE FUNCTION set_actualizado_en()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

-- Genera el identificador sintético de los casos sin incidencia de origen
-- (REFERIDOS, EMPRESAS, GOBIERNOS, altas manuales) — decisión D-23.
-- Formato: REF-<CÓDIGO_CENTRAL>-<NNNNNN>
CREATE SEQUENCE IF NOT EXISTS seq_caso_ref;

CREATE OR REPLACE FUNCTION generar_id_averia_ref(p_id_central integer)
RETURNS varchar
LANGUAGE plpgsql AS $$
DECLARE
    v_codigo varchar(20);
BEGIN
    SELECT codigo_central INTO v_codigo
    FROM central WHERE id_central = p_id_central;

    IF v_codigo IS NULL THEN
        RAISE EXCEPTION 'Central % no existe', p_id_central;
    END IF;

    RETURN 'REF-' || upper(v_codigo) || '-'
           || lpad(nextval('seq_caso_ref')::text, 6, '0');
END;
$$;

-- -----------------------------------------------------------------------------
-- 1. Catálogos base
-- -----------------------------------------------------------------------------

-- 1.1 Roles del sistema (P2.1: Administrador, Supervisor, Técnico)
CREATE TABLE IF NOT EXISTS rol (
    id_rol          serial       PRIMARY KEY,
    codigo          varchar(30)  NOT NULL UNIQUE,
    nombre          varchar(80)  NOT NULL,
    descripcion     text,
    permisos        jsonb        NOT NULL DEFAULT '{}'::jsonb,
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now()
);

-- 1.2 Catálogo de causas (se puebla desde el CSV — P1.3)
CREATE TABLE IF NOT EXISTS causa (
    id_causa                serial       PRIMARY KEY,
    codigo_causa            varchar(20)  NOT NULL,
    subcodigo_causa         varchar(20)  NOT NULL DEFAULT '',
    descripcion             varchar(255),
    descripcion_subcodigo   varchar(255),
    tipo                    varchar(20),
    activo                  boolean      NOT NULL DEFAULT true,
    creado_en               timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (codigo_causa, subcodigo_causa)
);

-- 1.3 Métodos de cierre / enrutado / contacto
CREATE TABLE IF NOT EXISTS catalogo_metodo (
    id_metodo   serial       PRIMARY KEY,
    dominio     varchar(20)  NOT NULL
                CHECK (dominio IN ('CIERRE','ENRUTE','DIFERIDO','CONTACTO')),
    codigo      varchar(30)  NOT NULL,
    nombre      varchar(120) NOT NULL,
    activo      boolean      NOT NULL DEFAULT true,
    UNIQUE (dominio, codigo)
);

-- 1.4 Parámetros configurables del sistema
CREATE TABLE IF NOT EXISTS configuracion (
    clave           varchar(80)  PRIMARY KEY,
    valor           jsonb        NOT NULL,
    descripcion     text,
    actualizado_en  timestamptz  NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. Configuración de la central y geografía (módulo CONFIGURACIÓN)
-- -----------------------------------------------------------------------------

-- 2.1 Central (base del filtro de ingesta — brief 6.1)
CREATE TABLE IF NOT EXISTS central (
    id_central          serial       PRIMARY KEY,
    region              varchar(80)  NOT NULL,
    estado_geografico   varchar(80)  NOT NULL,
    capital_estado      varchar(80),
    municipio           varchar(80)  NOT NULL,
    parroquia           varchar(80)  NOT NULL,
    estado_operativo    varchar(80),
    distrito            varchar(40),
    area                varchar(20)  NOT NULL,
    codigo_central      varchar(20)  NOT NULL UNIQUE,   -- ej. 2324X
    nombre_central      varchar(120) NOT NULL,          -- ej. FRANCISCO SALIAS
    activa              boolean      NOT NULL DEFAULT true,
    creado_en           timestamptz  NOT NULL DEFAULT now(),
    actualizado_en      timestamptz  NOT NULL DEFAULT now()
);

-- 2.2 Sector: lo define el supervisor (Norte 1, Norte 2, Sur 1…) — P1.2
CREATE TABLE IF NOT EXISTS sector (
    id_sector       serial       PRIMARY KEY,
    id_central      integer      NOT NULL REFERENCES central(id_central) ON DELETE CASCADE,
    nombre          varchar(120) NOT NULL,
    codigo          varchar(20)  NOT NULL,
    descripcion     text,
    prioridad       smallint     NOT NULL DEFAULT 100,
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (id_central, codigo)
);

-- 2.3 Direcciones/alias que pertenecen a un sector (asignación por coincidencia)
CREATE TABLE IF NOT EXISTS sector_direccion (
    id_sector_direccion serial       PRIMARY KEY,
    id_sector           integer      NOT NULL REFERENCES sector(id_sector) ON DELETE CASCADE,
    patron              varchar(160) NOT NULL,   -- VALLE ARRIBA, CONCRESA, PARQUE HUMBOLDT…
    tipo_coincidencia   varchar(20)  NOT NULL DEFAULT 'CONTIENE'
                        CHECK (tipo_coincidencia IN ('CONTIENE','EXACTO','REGEX')),
    normalizar          boolean      NOT NULL DEFAULT true,
    activo              boolean      NOT NULL DEFAULT true,
    creado_en           timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (id_sector, patron)
);

-- -----------------------------------------------------------------------------
-- 3. Personal, accesos y recursos
-- -----------------------------------------------------------------------------

-- 3.1 Técnicos / trabajadores (brief 6.2)
CREATE TABLE IF NOT EXISTS tecnico (
    id_tecnico      serial       PRIMARY KEY,
    id_central      integer      NOT NULL REFERENCES central(id_central),
    nombre          varchar(80)  NOT NULL,
    apellido        varchar(80),
    cedula          varchar(20)  UNIQUE,
    p00             varchar(20)  NOT NULL UNIQUE,
    telefono        varchar(30),
    correo          varchar(120),
    especialidad    varchar(80),
    status          varchar(20)  NOT NULL DEFAULT 'ACTIVO'
                    CHECK (status IN ('ACTIVO','INACTIVO','VACACIONES','SUSPENDIDO')),
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now()
);

-- 3.2 Usuarios del sistema (login P00 + clave — P2.2)
CREATE TABLE IF NOT EXISTS usuario (
    id_usuario          serial       PRIMARY KEY,
    p00                 varchar(20)  NOT NULL UNIQUE,
    correo              varchar(120) UNIQUE,
    clave_hash          varchar(255) NOT NULL,
    id_rol              integer      NOT NULL REFERENCES rol(id_rol),
    id_tecnico          integer      REFERENCES tecnico(id_tecnico),
    id_central          integer      REFERENCES central(id_central),  -- alcance por central (D-36)
    intentos_fallidos   smallint     NOT NULL DEFAULT 0,
    bloqueado           boolean      NOT NULL DEFAULT false,
    bloqueo_cliente     boolean      NOT NULL DEFAULT false,
    requiere_cambio_clave boolean    NOT NULL DEFAULT false,
    activo              boolean      NOT NULL DEFAULT true,
    ultimo_acceso       timestamptz,
    creado_en           timestamptz  NOT NULL DEFAULT now(),
    actualizado_en      timestamptz  NOT NULL DEFAULT now()
);

-- 3.3 Flota (brief 6.3)
CREATE TABLE IF NOT EXISTS flota (
    id_flota        serial       PRIMARY KEY,
    id_central      integer      NOT NULL REFERENCES central(id_central),
    can             varchar(20)  NOT NULL UNIQUE,
    tipo            varchar(40),
    marca           varchar(40),
    modelo          varchar(40),
    placa           varchar(20)  UNIQUE,
    combustible     varchar(20),
    status          varchar(20)  NOT NULL DEFAULT 'DISPONIBLE'
                    CHECK (status IN ('DISPONIBLE','EN_RUTA','MANTENIMIENTO','FUERA_SERVICIO')),
    estado_cauchos  varchar(30),
    estado_fluidos  varchar(30),
    estado_general  varchar(30),
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now()
);

-- 3.4 Herramientas
CREATE TABLE IF NOT EXISTS herramienta (
    id_herramienta  serial       PRIMARY KEY,
    id_central      integer      NOT NULL REFERENCES central(id_central),
    nombre          varchar(120) NOT NULL,
    codigo          varchar(40)  NOT NULL UNIQUE,
    estado          varchar(20)  NOT NULL DEFAULT 'DISPONIBLE'
                    CHECK (estado IN ('DISPONIBLE','ASIGNADA','AVERIADA','PERDIDA')),
    observacion     text,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now()
);

-- 3.5 Cuadrillas (trabajadores + flota + herramientas — brief 6.4)
CREATE TABLE IF NOT EXISTS cuadrilla (
    id_cuadrilla    serial       PRIMARY KEY,
    id_central      integer      NOT NULL REFERENCES central(id_central),
    codigo          varchar(20)  NOT NULL,
    nombre          varchar(80)  NOT NULL,
    id_flota        integer      REFERENCES flota(id_flota),
    es_supervisor   boolean      NOT NULL DEFAULT false,   -- cuadrilla 0 / GESTIÓN
    activa          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (id_central, codigo)
);
-- Una sola cuadrilla de supervisor por central.
CREATE UNIQUE INDEX IF NOT EXISTS ux_cuadrilla_supervisor
    ON cuadrilla (id_central) WHERE es_supervisor;

CREATE TABLE IF NOT EXISTS cuadrilla_tecnico (
    id_cuadrilla    integer      NOT NULL REFERENCES cuadrilla(id_cuadrilla) ON DELETE CASCADE,
    id_tecnico      integer      NOT NULL REFERENCES tecnico(id_tecnico) ON DELETE CASCADE,
    desde           date         NOT NULL DEFAULT CURRENT_DATE,
    rol_cuadrilla   varchar(30)  NOT NULL DEFAULT 'REPARADOR_PRINCIPAL'
                    CHECK (rol_cuadrilla IN ('REPARADOR_PRINCIPAL','AYUDANTE','SUPERVISOR')),
    hasta           date,
    PRIMARY KEY (id_cuadrilla, id_tecnico, desde)
);

CREATE TABLE IF NOT EXISTS cuadrilla_herramienta (
    id_cuadrilla    integer      NOT NULL REFERENCES cuadrilla(id_cuadrilla) ON DELETE CASCADE,
    id_herramienta  integer      NOT NULL REFERENCES herramienta(id_herramienta) ON DELETE CASCADE,
    asignada_en     timestamptz  NOT NULL DEFAULT now(),
    devuelta_en     timestamptz,
    PRIMARY KEY (id_cuadrilla, id_herramienta, asignada_en)
);

-- -----------------------------------------------------------------------------
-- 4. Casos (averías y solicitudes de construcción/reparación)
-- -----------------------------------------------------------------------------

-- 4.1 Lote de ingesta del archivo diario
CREATE TABLE IF NOT EXISTS ingesta_lote (
    id_lote             bigserial    PRIMARY KEY,
    archivo             varchar(255) NOT NULL,
    fecha_archivo       date,
    id_central          integer      REFERENCES central(id_central),
    filas_leidas        integer      NOT NULL DEFAULT 0,
    filas_central       integer      NOT NULL DEFAULT 0,
    casos_nuevos        integer      NOT NULL DEFAULT 0,
    casos_duplicados    integer      NOT NULL DEFAULT 0,
    casos_descartados   integer      NOT NULL DEFAULT 0,
    estado              varchar(20)  NOT NULL DEFAULT 'PROCESANDO'
                        CHECK (estado IN ('PROCESANDO','OK','ERROR')),
    detalle_error       text,
    usuario             varchar(20),
    creado_en           timestamptz  NOT NULL DEFAULT now()
);

-- 4.2 Tabla central de casos
CREATE TABLE IF NOT EXISTS caso (
    id_caso                 bigserial    PRIMARY KEY,
    id_central              integer      NOT NULL REFERENCES central(id_central),

    -- Clasificación del sistema
    id_averia               varchar(30)  NOT NULL UNIQUE,   -- único GLOBAL (P1.3). Manuales: REF-<CENTRAL>-<NNNNNN> (D-23)
    origen                  varchar(20)  NOT NULL DEFAULT 'INGESTA_CSV'
                            CHECK (origen IN ('INGESTA_CSV','MANUAL','TELEGRAM','MCP_IA')),
    tipo_caso               varchar(20)  NOT NULL DEFAULT 'AVERIA'
                            CHECK (tipo_caso IN ('AVERIA','REPARACION','CONSTRUCCION')),
    categoria               varchar(20)  NOT NULL DEFAULT 'RESIDENCIAL'
                            CHECK (categoria IN ('RESIDENCIAL','EMPRESA','REFERIDO','GOBIERNO')),
    estado_actual           varchar(20)  NOT NULL DEFAULT 'NUEVO'
                            CHECK (estado_actual IN ('NUEVO','ASIGNADO','CONTACTADO','CITADO',
                                   'DIFERIDO','EN_GESTION','ENRUTADO','CERRADO','CANCELADO')),
    id_sector               integer      REFERENCES sector(id_sector),
    id_causa                integer      REFERENCES causa(id_causa),
    id_lote_ingesta         bigint       REFERENCES ingesta_lote(id_lote),
    en_gestion_supervisor   boolean      NOT NULL DEFAULT false,
    es_falla_masiva         boolean      NOT NULL DEFAULT false,
    creado_por              varchar(20)  REFERENCES usuario(p00),

    -- Geografía (filtro de la central)
    region                  varchar(80),
    estado_geografico       varchar(80),
    capital_estado          varchar(80),
    municipio               varchar(80),
    parroquia               varchar(80),
    estado_operativo        varchar(80),
    distrito                varchar(40),
    area                    varchar(20),
    codigo_central          varchar(20),
    nombre_central          varchar(120),

    -- Datos administrativos y de contacto
    telefono                varchar(30),
    fecha_reporte           timestamptz,
    persona_reporta         varchar(120),
    contacto_cliente        varchar(60),
    fecha_compromiso        timestamptz,
    fecha_cita              timestamptz,
    ultimo_comentario       text,
    results                 text,
    asignado_a              varchar(60),
    cuadrilla_externa       varchar(40),
    estatus_origen          varchar(20),
    problema_reporte        text,
    informacion             text,                 -- unifica informacion(31) + informacion(32) + descripcion(52) — D-27
    nombre_cliente          varchar(160),
    direccion               text,                 -- base de la sectorización

    -- Datos técnicos / lógicos
    olt                     varchar(40),
    plan                    varchar(60),
    slot                    varchar(10),
    puerto                  varchar(10),
    fat                     varchar(80),
    serial                  varchar(60),
    extra                   varchar(120),
    area_trabajo            varchar(40),
    tipo_servicio           varchar(40),
    tipo_problema           varchar(20),
    dias_area_resolutoria   integer,
    unidad_negocio          varchar(40),
    ups                     varchar(10),
    codigos_gestionados_venapp   varchar(60),
    codigos_sin_gestion_venapp   varchar(60),

    -- Asignación de origen
    reparador_principal     varchar(20),
    ayudantes               jsonb        NOT NULL DEFAULT '[]'::jsonb,
    flota_can               varchar(20),
    despacho_nombre         varchar(80),
    despacho_apellido       varchar(80),
    telefono_oficina        varchar(30),
    telefono_movil          varchar(30),
    fecha_hora_asignacion   timestamptz,
    creado_en               timestamptz  NOT NULL DEFAULT now(),
    actualizado_en          timestamptz  NOT NULL DEFAULT now()
);

-- 4.3 Casos especiales (referidos / empresas / gobiernos)
CREATE TABLE IF NOT EXISTS solicitante (
    id_solicitante  serial       PRIMARY KEY,
    unidad          varchar(120) NOT NULL,
    nombre          varchar(120) NOT NULL,
    contacto        varchar(60)  NOT NULL,
    canal           varchar(20)  CHECK (canal IN ('TELEGRAM','MCP_IA','MANUAL','CORREO')),
    creado_en       timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS caso_especial (
    id_caso_especial    serial       PRIMARY KEY,
    id_caso             bigint       REFERENCES caso(id_caso) ON DELETE CASCADE,
    id_solicitante      integer      REFERENCES solicitante(id_solicitante),
    clasificacion       varchar(20)  NOT NULL
                        CHECK (clasificacion IN ('REFERIDO','EMPRESA','GOBIERNO')),
    tipo_actividad      varchar(20)  NOT NULL
                        CHECK (tipo_actividad IN ('REPARACION','CONSTRUCCION')),
    prioridad           varchar(20)  NOT NULL DEFAULT 'MEDIA'
                        CHECK (prioridad IN ('ALTA','MEDIA','BAJA')),
    tiene_id_averia     boolean      NOT NULL DEFAULT false,
    descripcion         text,
    requiere_informe    boolean      NOT NULL DEFAULT true,
    estado              varchar(20)  NOT NULL DEFAULT 'ABIERTO'
                        CHECK (estado IN ('ABIERTO','EN_PROCESO','ATENDIDO','CERRADO')),
    creado_en           timestamptz  NOT NULL DEFAULT now(),
    actualizado_en      timestamptz  NOT NULL DEFAULT now()
);

-- 4.4 Historial de estados
CREATE TABLE IF NOT EXISTS caso_estado_hist (
    id_hist         bigserial    PRIMARY KEY,
    id_caso         bigint       NOT NULL REFERENCES caso(id_caso) ON DELETE CASCADE,
    estado_anterior varchar(20),
    estado_nuevo    varchar(20)  NOT NULL,
    motivo          text,
    usuario         varchar(20)  REFERENCES usuario(p00),
    fecha_hora      timestamptz  NOT NULL DEFAULT now()
);

-- 4.5 Seguimiento (casos pasados a otras instancias / colas)
CREATE TABLE IF NOT EXISTS seguimiento (
    id_seguimiento      bigserial    PRIMARY KEY,
    id_caso             bigint       NOT NULL REFERENCES caso(id_caso) ON DELETE CASCADE,
    instancia_destino   varchar(120) NOT NULL,
    motivo              text,
    fecha_envio         timestamptz  NOT NULL DEFAULT now(),
    fecha_retorno       timestamptz,
    estado              varchar(20)  NOT NULL DEFAULT 'EN_COLA'
                        CHECK (estado IN ('EN_COLA','RESUELTO','DEVUELTO')),
    observacion         text,
    usuario             varchar(20)  REFERENCES usuario(p00)
);

-- 4.6 Citas (RF-12: sin solapamiento por cuadrilla)
CREATE TABLE IF NOT EXISTS cita (
    id_cita         bigserial    PRIMARY KEY,
    id_caso         bigint       REFERENCES caso(id_caso) ON DELETE CASCADE,
    id_caso_especial integer     REFERENCES caso_especial(id_caso_especial) ON DELETE CASCADE,
    id_cuadrilla    integer      REFERENCES cuadrilla(id_cuadrilla),
    fecha_hora      timestamptz  NOT NULL,
    tipo            varchar(20)  NOT NULL DEFAULT 'CONTACTO'
                    CHECK (tipo IN ('CONTACTO','ATENCION')),
    estado          varchar(20)  NOT NULL DEFAULT 'PROPUESTA'
                    CHECK (estado IN ('PROPUESTA','CONFIRMADA','CUMPLIDA','REPROGRAMADA','DIFERIDA','CANCELADA')),
    observacion     text,
    creado_por      varchar(20)  REFERENCES usuario(p00),
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_cita_referencia CHECK (id_caso IS NOT NULL OR id_caso_especial IS NOT NULL)
);

-- -----------------------------------------------------------------------------
-- 5. Despacho y fallas masivas
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS despacho (
    id_despacho             bigserial    PRIMARY KEY,
    id_central              integer      NOT NULL REFERENCES central(id_central),
    fecha                   date         NOT NULL,
    id_cuadrilla            integer      NOT NULL REFERENCES cuadrilla(id_cuadrilla),
    estado                  varchar(20)  NOT NULL DEFAULT 'BORRADOR'
                            CHECK (estado IN ('BORRADOR','PUBLICADO','CERRADO')),
    generado_auto           boolean      NOT NULL DEFAULT false,
    enviado_canal           varchar(20)  CHECK (enviado_canal IN ('TELEGRAM','CORREO')),
    enviado_en              timestamptz,
    reporte_produccion_en   timestamptz,      -- cierre 04:00 p.m.
    usuario_crea            varchar(20)  REFERENCES usuario(p00),
    creado_en               timestamptz  NOT NULL DEFAULT now(),
    actualizado_en          timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (fecha, id_cuadrilla)
);

CREATE TABLE IF NOT EXISTS despacho_caso (
    id_despacho_caso    bigserial    PRIMARY KEY,
    id_despacho         bigint       NOT NULL REFERENCES despacho(id_despacho) ON DELETE CASCADE,
    id_caso             bigint       NOT NULL REFERENCES caso(id_caso) ON DELETE CASCADE,
    id_sector           integer      REFERENCES sector(id_sector),
    orden_visita        smallint,
    tipo_asignacion     varchar(20)
                        CHECK (tipo_asignacion IN ('REPARACION','CONSTRUCCION','REFERIDO',
                               'EMPRESA','FALLA_MASIVA')),
    estado              varchar(20)  NOT NULL DEFAULT 'ASIGNADO'
                        CHECK (estado IN ('ASIGNADO','GESTIONADO','CERRADO','CITADO','DIFERIDO')),
    observacion         text,
    UNIQUE (id_despacho, id_caso)
);

CREATE TABLE IF NOT EXISTS falla_masiva (
    id_falla            bigserial    PRIMARY KEY,
    id_central          integer      NOT NULL REFERENCES central(id_central),
    descripcion         text         NOT NULL,
    fecha_deteccion     timestamptz  NOT NULL DEFAULT now(),
    origen              varchar(20)  NOT NULL DEFAULT 'AUTOMATICA'
                        CHECK (origen IN ('AUTOMATICA','REPORTE_TECNICO','MCP')),
    id_sector           integer      REFERENCES sector(id_sector),
    id_cuadrilla        integer      REFERENCES cuadrilla(id_cuadrilla),
    estado              varchar(20)  NOT NULL DEFAULT 'DETECTADA'
                        CHECK (estado IN ('DETECTADA','PLANIFICADA','ATENDIDA','CERRADA')),
    planificacion       text,
    reporte_simple      text,
    creado_en           timestamptz  NOT NULL DEFAULT now(),
    actualizado_en      timestamptz  NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 6. Gestión técnica (app móvil / offline)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS actividad (
    id_actividad    bigserial    PRIMARY KEY,
    id_caso         bigint       NOT NULL REFERENCES caso(id_caso) ON DELETE CASCADE,
    id_usuario      integer      REFERENCES usuario(id_usuario),
    id_cuadrilla    integer      REFERENCES cuadrilla(id_cuadrilla),
    tipo            varchar(20)  NOT NULL
                    CHECK (tipo IN ('CONTACTO','CIERRE','ENRUTE','DIFERIDO','INCIDENTE','FALLA_MASIVA')),
    resultado       varchar(20)
                    CHECK (resultado IN ('CONTACTADO','CERRADO','ENRUTADO','DIFERIDO')),
    reporte_corto   text,
    id_metodo       integer      REFERENCES catalogo_metodo(id_metodo),
    id_causa        integer      REFERENCES causa(id_causa),
    fecha_hora      timestamptz  NOT NULL DEFAULT now(),
    latitud         numeric(10,7),
    longitud        numeric(10,7),
    sincronizado    boolean      NOT NULL DEFAULT false,
    creado_en       timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidencia (
    id_evidencia    bigserial    PRIMARY KEY,
    id_actividad    bigint       NOT NULL REFERENCES actividad(id_actividad) ON DELETE CASCADE,
    tipo            varchar(20)  NOT NULL
                    CHECK (tipo IN ('POTENCIA','NAVEGACION','DEMO')),
    serial_imagen   varchar(160) NOT NULL UNIQUE,   -- caso + id_averia + tipo + fecha/hora
    ruta_local      varchar(255),
    ruta_remota     varchar(255),
    latitud         numeric(10,7),
    longitud        numeric(10,7),
    fecha_hora      timestamptz  NOT NULL,
    origen_camara   boolean      NOT NULL DEFAULT true,   -- false = galería (prohibido)
    creado_en       timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidente (
    id_incidente    bigserial    PRIMARY KEY,
    tipo            varchar(20)  NOT NULL CHECK (tipo IN ('FLOTA','HERRAMIENTA')),
    id_flota        integer      REFERENCES flota(id_flota),
    id_herramienta  integer      REFERENCES herramienta(id_herramienta),
    descripcion     text,
    id_actividad    bigint       REFERENCES actividad(id_actividad) ON DELETE SET NULL,
    estado          varchar(20)  NOT NULL DEFAULT 'REPORTADO'
                    CHECK (estado IN ('REPORTADO','EN_REVISION','RESUELTO')),
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_incidente_referencia
        CHECK (id_flota IS NOT NULL OR id_herramienta IS NOT NULL)
);

-- 6.1 Seguridad del dispositivo (12 palabras + documento cifrado — 4.3)
CREATE TABLE IF NOT EXISTS dispositivo_seguridad (
    id_dispositivo      bigserial    PRIMARY KEY,
    p00                 varchar(20)  NOT NULL UNIQUE REFERENCES usuario(p00) ON DELETE CASCADE,
    palabras_hash       jsonb        NOT NULL DEFAULT '[]'::jsonb,
    clave_privada_ref   varchar(255),
    documento_cifrado   text,
    bloqueado           boolean      NOT NULL DEFAULT false,
    version             integer      NOT NULL DEFAULT 1,
    actualizado_en      timestamptz  NOT NULL DEFAULT now()
);

-- 6.2 Sincronización del dispositivo (ZIP central+cuadrilla+fecha)
CREATE TABLE IF NOT EXISTS sincronizacion (
    id_sync             bigserial    PRIMARY KEY,
    id_dispositivo      bigint       REFERENCES dispositivo_seguridad(id_dispositivo) ON DELETE SET NULL,
    id_tecnico          integer      REFERENCES tecnico(id_tecnico),
    inicio              timestamptz  NOT NULL DEFAULT now(),
    fin                 timestamptz,
    casos_descargados   integer      NOT NULL DEFAULT 0,
    actividades_subidas integer      NOT NULL DEFAULT 0,
    evidencias_subidas  integer      NOT NULL DEFAULT 0,
    archivo_zip         varchar(160),
    estado              varchar(20)  NOT NULL DEFAULT 'EN_PROCESO'
                        CHECK (estado IN ('EN_PROCESO','OK','ERROR')),
    detalle_json        jsonb
);

-- -----------------------------------------------------------------------------
-- 7. Insumos (v2 — RF-05) y material
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS insumo (
    id_insumo       serial       PRIMARY KEY,
    id_central      integer      REFERENCES central(id_central),
    codigo          varchar(40)  NOT NULL UNIQUE,
    nombre          varchar(120) NOT NULL,
    unidad_medida   varchar(20)  NOT NULL DEFAULT 'UNIDAD',
    stock_minimo    numeric(12,2) NOT NULL DEFAULT 0,
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orden_material (
    id_orden            bigserial    PRIMARY KEY,
    id_caso             bigint       REFERENCES caso(id_caso),
    id_cuadrilla        integer      REFERENCES cuadrilla(id_cuadrilla),
    solicitante_usuario varchar(20)  REFERENCES usuario(p00),
    estado              varchar(20)  NOT NULL DEFAULT 'SOLICITADA'
                        CHECK (estado IN ('SOLICITADA','APROBADA','ENTREGADA','RECHAZADA')),
    fecha               timestamptz  NOT NULL DEFAULT now(),
    observacion         text,
    creado_en           timestamptz  NOT NULL DEFAULT now(),
    actualizado_en      timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orden_material_detalle (
    id_orden_detalle    bigserial    PRIMARY KEY,
    id_orden            bigint       NOT NULL REFERENCES orden_material(id_orden) ON DELETE CASCADE,
    id_insumo           integer      NOT NULL REFERENCES insumo(id_insumo),
    cantidad_solicitada numeric(12,2) NOT NULL CHECK (cantidad_solicitada > 0),
    cantidad_entregada  numeric(12,2) NOT NULL DEFAULT 0,
    UNIQUE (id_orden, id_insumo)
);

CREATE TABLE IF NOT EXISTS inventario_movimiento (
    id_mov      bigserial    PRIMARY KEY,
    id_insumo   integer      NOT NULL REFERENCES insumo(id_insumo),
    tipo        varchar(20)  NOT NULL CHECK (tipo IN ('INGRESO','EGRESO','AJUSTE')),
    cantidad    numeric(12,2) NOT NULL CHECK (cantidad > 0),
    id_orden    bigint       REFERENCES orden_material(id_orden),
    id_tecnico  integer      REFERENCES tecnico(id_tecnico),
    fecha       timestamptz  NOT NULL DEFAULT now(),
    usuario     varchar(20)  REFERENCES usuario(p00),
    observacion text
);

-- -----------------------------------------------------------------------------
-- 8. Notificaciones y auditoría
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notificacion (
    id_notificacion bigserial    PRIMARY KEY,
    canal           varchar(20)  NOT NULL CHECK (canal IN ('TELEGRAM','CORREO','MCP_IA')),
    destinatario    varchar(160),
    asunto          varchar(200),
    cuerpo          text,
    id_caso         bigint       REFERENCES caso(id_caso) ON DELETE SET NULL,
    estado          varchar(20)  NOT NULL DEFAULT 'PENDIENTE'
                    CHECK (estado IN ('PENDIENTE','ENVIADO','FALLIDO')),
    error           text,
    enviado_en      timestamptz,
    creado_en       timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auditoria (
    id_auditoria    bigserial    PRIMARY KEY,
    usuario         varchar(20),
    accion          varchar(60)  NOT NULL,
    entidad         varchar(60),
    id_entidad      varchar(40),
    datos_antes     jsonb,
    datos_despues   jsonb,
    ip              inet,
    fecha_hora      timestamptz  NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 9. Índices de consulta frecuente
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ix_caso_central            ON caso (id_central);
CREATE INDEX IF NOT EXISTS ix_caso_sector             ON caso (id_sector);
CREATE INDEX IF NOT EXISTS ix_caso_telefono           ON caso (telefono);
CREATE INDEX IF NOT EXISTS ix_caso_estado             ON caso (estado_actual);
CREATE INDEX IF NOT EXISTS ix_caso_fecha_reporte      ON caso (fecha_reporte);
CREATE INDEX IF NOT EXISTS ix_caso_gestion_supervisor ON caso (en_gestion_supervisor);
CREATE INDEX IF NOT EXISTS ix_caso_falla_masiva       ON caso (es_falla_masiva);
CREATE INDEX IF NOT EXISTS ix_caso_lote               ON caso (id_lote_ingesta);
CREATE INDEX IF NOT EXISTS ix_despacho_caso_caso      ON despacho_caso (id_caso);
CREATE INDEX IF NOT EXISTS ix_despacho_caso_despacho  ON despacho_caso (id_despacho);
CREATE INDEX IF NOT EXISTS ix_actividad_caso          ON actividad (id_caso);
CREATE INDEX IF NOT EXISTS ix_actividad_usuario       ON actividad (id_usuario);
CREATE INDEX IF NOT EXISTS ix_evidencia_actividad     ON evidencia (id_actividad);
CREATE INDEX IF NOT EXISTS ix_cita_cuadrilla_fecha    ON cita (id_cuadrilla, fecha_hora);
CREATE INDEX IF NOT EXISTS ix_seguimiento_caso        ON seguimiento (id_caso);
CREATE INDEX IF NOT EXISTS ix_sector_direccion_sector ON sector_direccion (id_sector);
-- Sectorización por coincidencia de texto (RF-23 / D-33): búsqueda trigram.
CREATE INDEX IF NOT EXISTS ix_caso_direccion_trgm   ON caso USING gin (direccion gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_sector_patron_trgm    ON sector_direccion USING gin (patron gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_notificacion_caso       ON notificacion (id_caso);
CREATE INDEX IF NOT EXISTS ix_auditoria_fecha         ON auditoria (fecha_hora);

-- -----------------------------------------------------------------------------
-- 9.1 Row Level Security multi-central (D-36) — defensa en profundidad
-- -----------------------------------------------------------------------------
-- La aplicación debe fijar el alcance de la central en cada conexión:
--     SET LOCAL app.id_central = '<id_central>';
-- Si el parámetro NO está definido, la política permite todo (modo compatibilidad
-- para desarrollo/migraciones). ANTES DE PRODUCCIÓN: eliminar la cláusula
-- `app_central_actual() IS NULL` de las políticas para que sea "denegar por defecto".
--
-- Se aplica a `caso` y `despacho` como patrón; extender al resto de tablas con
-- `id_central` (sector, tecnico, flota, cuadrilla, insumo) en la Fase 3.

CREATE OR REPLACE FUNCTION app_central_actual()
RETURNS integer
LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('app.id_central', true), '')::integer;
$$;

ALTER TABLE caso     ENABLE ROW LEVEL SECURITY;
ALTER TABLE caso     FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_caso_central ON caso;
CREATE POLICY p_caso_central ON caso
    USING      (app_central_actual() IS NULL OR id_central = app_central_actual())
    WITH CHECK (app_central_actual() IS NULL OR id_central = app_central_actual());

ALTER TABLE despacho     ENABLE ROW LEVEL SECURITY;
ALTER TABLE despacho     FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_despacho_central ON despacho;
CREATE POLICY p_despacho_central ON despacho
    USING      (app_central_actual() IS NULL OR id_central = app_central_actual())
    WITH CHECK (app_central_actual() IS NULL OR id_central = app_central_actual());

-- -----------------------------------------------------------------------------
-- 10. Triggers: actualizado_en automático
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    t text;
    tablas text[] := ARRAY[
        'central','sector','tecnico','usuario','flota','herramienta','cuadrilla',
        'caso','caso_especial','despacho','falla_masiva','insumo','orden_material','configuracion'
    ];
BEGIN
    FOREACH t IN ARRAY tablas LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_actualizado ON %I;', t, t);
        EXECUTE format(
            'CREATE TRIGGER trg_%s_actualizado BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();', t, t);
    END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. Datos iniciales (idempotentes)
-- -----------------------------------------------------------------------------

-- 11.1 Roles
INSERT INTO rol (codigo, nombre, descripcion) VALUES
    ('SUPER',      'Super Usuario', 'Acceso total a todas las secciones y funciones de la plataforma'),
    ('ADMIN',      'Administrador', 'Configura el entorno, usuarios y catálogos'),
    ('SUPERVISOR', 'Supervisor',    'Ingesta, despacho, cuadrillas, reportes y GESTIÓN'),
    ('TECNICO',    'Técnico',       'Gestión de casos en campo (app móvil)')
ON CONFLICT (codigo) DO NOTHING;

-- 11.2 Métodos (cierre IVR/COS/SACAS y enrutado)
INSERT INTO catalogo_metodo (dominio, codigo, nombre) VALUES
    ('CIERRE',   'IVR',             'Cierre con IVR'),
    ('CIERRE',   'COS',             'Cierre con COS'),
    ('CIERRE',   'SACAS',           'Cierre con SACAS'),
    ('ENRUTE',   'COLA_SEGUIMIENTO','Enrutado a cola de seguimiento'),
    ('ENRUTE',   'COLA_PLANTA',     'Enrutado a planta externa'),
    ('ENRUTE',   'COLA_MASIVOS',    'Enrutado a unidad de masivos'),
    ('CONTACTO', 'TELEFONO',        'Contacto telefónico'),
    ('DIFERIDO', 'CLIENTE_AUSENTE', 'Cliente ausente'),
    ('DIFERIDO', 'REPROGRAMADO',    'Reprogramado por el cliente')
ON CONFLICT (dominio, codigo) DO NOTHING;

-- 11.3 Central Francisco Salias (Área 4) — tomada del CSV de muestra
INSERT INTO central (region, estado_geografico, capital_estado, municipio, parroquia,
                     estado_operativo, distrito, area, codigo_central, nombre_central)
VALUES ('CAPITAL','BOLIVARIANO MIRANDA','LOS TEQUES','BARUTA','BARUTA',
        'MIRANDA-2','10204','AREA 4','2324X','FRANCISCO SALIAS')
ON CONFLICT (codigo_central) DO NOTHING;

-- 11.4 Cuadrilla 0 (supervisor) para la central sembrada
INSERT INTO cuadrilla (id_central, codigo, nombre, es_supervisor)
SELECT c.id_central, 'C-00', 'Gestión (Supervisor)', true
FROM central c
WHERE c.codigo_central = '2324X'
ON CONFLICT (id_central, codigo) DO NOTHING;

-- 11.5 Parámetros del sistema
INSERT INTO configuracion (clave, valor, descripcion) VALUES
    ('ingesta.central_codigo',      '"2324X"'::jsonb,           'Código de central usado como filtro de ingesta'),
    ('ingesta.delimitador',         '";"'::jsonb,               'Delimitador del archivo detalle_averias_gpon'),
    ('ingesta.encoding',            '"iso-8859-1"'::jsonb,      'Codificación real del CSV (H-02); decodificar a UTF-8 en la frontera'),
    ('ingesta.fecha_formato',       '"%d/%m/%Y %I:%M:%S %p"'::jsonb, 'Formato de fecha del CSV; zona America/Caracas'),
    ('despacho.hora_reporte',       '"16:00"'::jsonb,           'Hora de generación del reporte de producción'),
    ('despacho.min_referidos',      '2'::jsonb,                 'Mínimo de reparaciones de referidos por despacho'),
    ('despacho.min_empresas',       '1'::jsonb,                 'Mínimo de reparaciones de empresas por despacho'),
    ('despacho.criterio_cuadrilla0','"UNION"'::jsonb,           'CAMPO | SUPERVISOR | UNION (D-22, criterio combinado)'),
    ('despacho.frases_campo',       '["LOSS ROJO","FALLA FIBRA","Fibra Dañada"]'::jsonb,
     'Frases que indican que el caso SÍ amerita maniobra de campo (PROCEDIMIENTO 3)'),
    ('despacho.frases_supervisor',  '["NAVEGACION LENTA","PON INTERMITENTE","SIN TONO"]'::jsonb,
     'Frases que indican que el caso NO amerita maniobra en casa (GENERALIDADES 3.5)'),
    ('despacho.columnas_evaluar',   '["problema_reporte","ultimo_comentario","informacion"]'::jsonb,
     'Columnas donde se buscan las frases (el brief citaba "Falla Reportada", inexistente en el CSV)'),
    ('seguridad.max_intentos',      '3'::jsonb,                 'Intentos de login antes del bloqueo'),
    ('seguridad.palabras_seguridad','12'::jsonb,                'Cantidad de palabras de recuperación')
ON CONFLICT (clave) DO NOTHING;

COMMIT;

-- =============================================================================
-- Fin del esquema. Registrar cambios en RepoTecnico/estado_proyecto.md
-- =============================================================================
