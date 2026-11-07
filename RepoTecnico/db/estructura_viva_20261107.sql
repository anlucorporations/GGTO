--
-- PostgreSQL database dump
--

\restrict UJYjLNAA42cKyEncPI9PNFIndpcWsbkhjlubIrvMwOIfFi54rJHlW1SDeEFTMPU

-- Dumped from database version 15.19
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ggto_d77; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA ggto_d77;


--
-- Name: ggto_e2e; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA ggto_e2e;


--
-- Name: ggto_sync; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA ggto_sync;


--
-- Name: ggto_test; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA ggto_test;


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: app_central_actual(); Type: FUNCTION; Schema: ggto_d77; Owner: -
--

CREATE FUNCTION ggto_d77.app_central_actual() RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    SELECT nullif(current_setting('app.id_central', true), '')::integer;
$$;


--
-- Name: generar_id_averia_ref(integer); Type: FUNCTION; Schema: ggto_d77; Owner: -
--

CREATE FUNCTION ggto_d77.generar_id_averia_ref(p_id_central integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: set_actualizado_en(); Type: FUNCTION; Schema: ggto_d77; Owner: -
--

CREATE FUNCTION ggto_d77.set_actualizado_en() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;


--
-- Name: app_central_actual(); Type: FUNCTION; Schema: ggto_e2e; Owner: -
--

CREATE FUNCTION ggto_e2e.app_central_actual() RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    SELECT nullif(current_setting('app.id_central', true), '')::integer;
$$;


--
-- Name: generar_id_averia_ref(integer); Type: FUNCTION; Schema: ggto_e2e; Owner: -
--

CREATE FUNCTION ggto_e2e.generar_id_averia_ref(p_id_central integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: set_actualizado_en(); Type: FUNCTION; Schema: ggto_e2e; Owner: -
--

CREATE FUNCTION ggto_e2e.set_actualizado_en() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;


--
-- Name: app_central_actual(); Type: FUNCTION; Schema: ggto_sync; Owner: -
--

CREATE FUNCTION ggto_sync.app_central_actual() RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    SELECT nullif(current_setting('app.id_central', true), '')::integer;
$$;


--
-- Name: generar_id_averia_ref(integer); Type: FUNCTION; Schema: ggto_sync; Owner: -
--

CREATE FUNCTION ggto_sync.generar_id_averia_ref(p_id_central integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: set_actualizado_en(); Type: FUNCTION; Schema: ggto_sync; Owner: -
--

CREATE FUNCTION ggto_sync.set_actualizado_en() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;


--
-- Name: app_central_actual(); Type: FUNCTION; Schema: ggto_test; Owner: -
--

CREATE FUNCTION ggto_test.app_central_actual() RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    SELECT nullif(current_setting('app.id_central', true), '')::integer;
$$;


--
-- Name: generar_id_averia_ref(integer); Type: FUNCTION; Schema: ggto_test; Owner: -
--

CREATE FUNCTION ggto_test.generar_id_averia_ref(p_id_central integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: set_actualizado_en(); Type: FUNCTION; Schema: ggto_test; Owner: -
--

CREATE FUNCTION ggto_test.set_actualizado_en() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;


--
-- Name: app_central_actual(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_central_actual() RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    SELECT nullif(current_setting('app.id_central', true), '')::integer;
$$;


--
-- Name: fn_caso_reparacion_a_referido(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_caso_reparacion_a_referido() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
            IF NEW.tipo_caso = 'REPARACION'
               AND (NEW.id_pago IS NULL OR NEW.id_averia LIKE 'REF-%') THEN
                NEW.tipo_caso := 'REFERIDO';
                IF NEW.categoria IN ('RESIDENCIAL', 'REFERIDO') THEN
                    NEW.categoria := 'REFERIDO';
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$;


--
-- Name: fn_recalcular_metricas_despacho_diarias(integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_recalcular_metricas_despacho_diarias(p_central integer, p_fecha date) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM despacho_metrica_diaria WHERE id_central=p_central AND fecha=p_fecha;
    INSERT INTO despacho_metrica_diaria (
        id_central, fecha, columna, asignados, asignados_reparacion,
        asignados_construccion, cerrados, cerrados_reparacion,
        cerrados_construccion, enrutado, citado, citado_reparacion,
        citado_construccion, diferidos, diferidos_reparacion,
        diferidos_construccion
    )
    SELECT p_central, p_fecha, col.columna,
        count(c.id_caso),
        count(c.id_caso) FILTER (WHERE c.tipo_caso <> 'CONSTRUCCION'),
        count(c.id_caso) FILTER (WHERE c.tipo_caso = 'CONSTRUCCION'),
        count(c.id_caso) FILTER (WHERE c.estado_actual='CERRADO' OR dc.estado='CERRADO'),
        count(c.id_caso) FILTER (WHERE (c.estado_actual='CERRADO' OR dc.estado='CERRADO')
            AND c.tipo_caso <> 'CONSTRUCCION'),
        count(c.id_caso) FILTER (WHERE (c.estado_actual='CERRADO' OR dc.estado='CERRADO')
            AND c.tipo_caso = 'CONSTRUCCION'),
        count(c.id_caso) FILTER (WHERE c.estado_actual='ENRUTADO'),
        count(c.id_caso) FILTER (WHERE c.estado_actual='CITADO' OR dc.estado='CITADO'),
        count(c.id_caso) FILTER (WHERE (c.estado_actual='CITADO' OR dc.estado='CITADO')
            AND c.tipo_caso <> 'CONSTRUCCION'),
        count(c.id_caso) FILTER (WHERE (c.estado_actual='CITADO' OR dc.estado='CITADO')
            AND c.tipo_caso = 'CONSTRUCCION'),
        count(c.id_caso) FILTER (WHERE c.estado_actual='DIFERIDO' OR dc.estado='DIFERIDO'),
        count(c.id_caso) FILTER (WHERE (c.estado_actual='DIFERIDO' OR dc.estado='DIFERIDO')
            AND c.tipo_caso <> 'CONSTRUCCION'),
        count(c.id_caso) FILTER (WHERE (c.estado_actual='DIFERIDO' OR dc.estado='DIFERIDO')
            AND c.tipo_caso = 'CONSTRUCCION')
    FROM (VALUES ('COMUNES'),('REFERIDOS'),('EMPRESA')) AS col(columna)
    LEFT JOIN despacho d ON d.id_central=p_central AND d.fecha=p_fecha
    LEFT JOIN despacho_caso dc ON dc.id_despacho=d.id_despacho
    LEFT JOIN caso c ON c.id_caso=dc.id_caso AND (
        (col.columna='COMUNES' AND dc.tipo_asignacion IN ('REPARACION','CONSTRUCCION')
            AND c.categoria='RESIDENCIAL') OR
        (col.columna='REFERIDOS' AND (dc.tipo_asignacion='REFERIDO'
            OR (dc.tipo_asignacion IN ('REPARACION','CONSTRUCCION')
            AND c.categoria='REFERIDO'))) OR
        (col.columna='EMPRESA' AND (dc.tipo_asignacion='EMPRESA'
            OR (dc.tipo_asignacion IN ('REPARACION','CONSTRUCCION')
            AND c.categoria IN ('EMPRESA','GOBIERNO'))))
    )
    GROUP BY col.columna;
END; $$;


--
-- Name: generar_id_averia_ref(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generar_id_averia_ref(p_id_central integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: set_actualizado_en(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_actualizado_en() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;


--
-- Name: trg_recalcular_metricas_caso(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_recalcular_metricas_caso() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE fila record;
BEGIN
    FOR fila IN SELECT DISTINCT d.id_central, d.fecha
        FROM despacho d JOIN despacho_caso dc ON dc.id_despacho=d.id_despacho
        WHERE dc.id_caso=NEW.id_caso
    LOOP
        PERFORM fn_recalcular_metricas_despacho_diarias(fila.id_central, fila.fecha);
    END LOOP;
    RETURN NEW;
END; $$;


--
-- Name: trg_recalcular_metricas_despacho_caso(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_recalcular_metricas_despacho_caso() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v_central integer; v_fecha date; v_despacho bigint;
BEGIN
    v_despacho := CASE WHEN TG_OP = 'DELETE' THEN OLD.id_despacho ELSE NEW.id_despacho END;
    SELECT id_central, fecha INTO v_central, v_fecha FROM despacho
     WHERE id_despacho=v_despacho;
    IF v_central IS NOT NULL THEN
        PERFORM fn_recalcular_metricas_despacho_diarias(v_central, v_fecha);
    END IF;
    RETURN COALESCE(NEW, OLD);
END; $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actividad; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.actividad (
    id_actividad bigint NOT NULL,
    id_caso bigint NOT NULL,
    id_usuario integer,
    id_cuadrilla integer,
    tipo character varying(20) NOT NULL,
    resultado character varying(20),
    reporte_corto text,
    id_metodo integer,
    id_causa integer,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    latitud numeric(10,7),
    longitud numeric(10,7),
    sincronizado boolean DEFAULT false NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT actividad_resultado_check CHECK (((resultado)::text = ANY (ARRAY[('CONTACTADO'::character varying)::text, ('CERRADO'::character varying)::text, ('ENRUTADO'::character varying)::text, ('DIFERIDO'::character varying)::text]))),
    CONSTRAINT actividad_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('CONTACTO'::character varying)::text, ('CIERRE'::character varying)::text, ('ENRUTE'::character varying)::text, ('DIFERIDO'::character varying)::text, ('INCIDENTE'::character varying)::text, ('FALLA_MASIVA'::character varying)::text])))
);


--
-- Name: actividad_id_actividad_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.actividad_id_actividad_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: actividad_id_actividad_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.actividad_id_actividad_seq OWNED BY ggto_d77.actividad.id_actividad;


--
-- Name: auditoria; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.auditoria (
    id_auditoria bigint NOT NULL,
    usuario character varying(20),
    accion character varying(60) NOT NULL,
    entidad character varying(60),
    id_entidad character varying(40),
    datos_antes jsonb,
    datos_despues jsonb,
    ip inet,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.auditoria_id_auditoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.auditoria_id_auditoria_seq OWNED BY ggto_d77.auditoria.id_auditoria;


--
-- Name: caso; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.caso (
    id_caso bigint NOT NULL,
    id_central integer NOT NULL,
    id_averia character varying(30) NOT NULL,
    origen character varying(20) DEFAULT 'INGESTA_CSV'::character varying NOT NULL,
    tipo_caso character varying(20) DEFAULT 'AVERIA'::character varying NOT NULL,
    categoria character varying(20) DEFAULT 'RESIDENCIAL'::character varying NOT NULL,
    estado_actual character varying(20) DEFAULT 'NUEVO'::character varying NOT NULL,
    id_sector integer,
    id_causa integer,
    id_lote_ingesta bigint,
    en_gestion_supervisor boolean DEFAULT false NOT NULL,
    es_falla_masiva boolean DEFAULT false NOT NULL,
    creado_por character varying(20),
    region character varying(80),
    estado_geografico character varying(80),
    capital_estado character varying(80),
    municipio character varying(80),
    parroquia character varying(80),
    estado_operativo character varying(80),
    distrito character varying(40),
    area character varying(20),
    codigo_central character varying(20),
    nombre_central character varying(120),
    telefono character varying(30),
    fecha_reporte timestamp with time zone,
    persona_reporta character varying(120),
    contacto_cliente character varying(60),
    fecha_compromiso timestamp with time zone,
    fecha_cita timestamp with time zone,
    ultimo_comentario text,
    results text,
    asignado_a character varying(60),
    cuadrilla_externa character varying(40),
    estatus_origen character varying(20),
    problema_reporte text,
    informacion text,
    nombre_cliente character varying(160),
    direccion text,
    olt character varying(40),
    plan character varying(60),
    slot character varying(10),
    puerto character varying(10),
    fat character varying(80),
    serial character varying(60),
    extra character varying(120),
    area_trabajo character varying(40),
    tipo_servicio character varying(40),
    tipo_problema character varying(20),
    dias_area_resolutoria integer,
    unidad_negocio character varying(40),
    ups character varying(10),
    codigos_gestionados_venapp character varying(60),
    codigos_sin_gestion_venapp character varying(60),
    reparador_principal character varying(20),
    ayudantes jsonb DEFAULT '[]'::jsonb NOT NULL,
    flota_can character varying(20),
    despacho_nombre character varying(80),
    despacho_apellido character varying(80),
    telefono_oficina character varying(30),
    telefono_movil character varying(30),
    fecha_hora_asignacion timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caso_categoria_check CHECK (((categoria)::text = ANY (ARRAY[('RESIDENCIAL'::character varying)::text, ('EMPRESA'::character varying)::text, ('REFERIDO'::character varying)::text, ('GOBIERNO'::character varying)::text]))),
    CONSTRAINT caso_estado_actual_check CHECK (((estado_actual)::text = ANY (ARRAY[('NUEVO'::character varying)::text, ('ASIGNADO'::character varying)::text, ('CONTACTADO'::character varying)::text, ('CITADO'::character varying)::text, ('DIFERIDO'::character varying)::text, ('EN_GESTION'::character varying)::text, ('ENRUTADO'::character varying)::text, ('CERRADO'::character varying)::text, ('CANCELADO'::character varying)::text]))),
    CONSTRAINT caso_origen_check CHECK (((origen)::text = ANY (ARRAY[('INGESTA_CSV'::character varying)::text, ('MANUAL'::character varying)::text, ('TELEGRAM'::character varying)::text, ('MCP_IA'::character varying)::text]))),
    CONSTRAINT caso_tipo_caso_check CHECK (((tipo_caso)::text = ANY (ARRAY[('AVERIA'::character varying)::text, ('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text])))
);

ALTER TABLE ONLY ggto_d77.caso FORCE ROW LEVEL SECURITY;


--
-- Name: caso_especial; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.caso_especial (
    id_caso_especial integer NOT NULL,
    id_caso bigint,
    id_solicitante integer,
    clasificacion character varying(20) NOT NULL,
    tipo_actividad character varying(20) NOT NULL,
    prioridad character varying(20) DEFAULT 'MEDIA'::character varying NOT NULL,
    tiene_id_averia boolean DEFAULT false NOT NULL,
    descripcion text,
    requiere_informe boolean DEFAULT true NOT NULL,
    estado character varying(20) DEFAULT 'ABIERTO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caso_especial_clasificacion_check CHECK (((clasificacion)::text = ANY (ARRAY[('REFERIDO'::character varying)::text, ('EMPRESA'::character varying)::text, ('GOBIERNO'::character varying)::text]))),
    CONSTRAINT caso_especial_estado_check CHECK (((estado)::text = ANY (ARRAY[('ABIERTO'::character varying)::text, ('EN_PROCESO'::character varying)::text, ('ATENDIDO'::character varying)::text, ('CERRADO'::character varying)::text]))),
    CONSTRAINT caso_especial_prioridad_check CHECK (((prioridad)::text = ANY (ARRAY[('ALTA'::character varying)::text, ('MEDIA'::character varying)::text, ('BAJA'::character varying)::text]))),
    CONSTRAINT caso_especial_tipo_actividad_check CHECK (((tipo_actividad)::text = ANY (ARRAY[('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text])))
);


--
-- Name: caso_especial_id_caso_especial_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.caso_especial_id_caso_especial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_especial_id_caso_especial_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.caso_especial_id_caso_especial_seq OWNED BY ggto_d77.caso_especial.id_caso_especial;


--
-- Name: caso_estado_hist; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.caso_estado_hist (
    id_hist bigint NOT NULL,
    id_caso bigint NOT NULL,
    estado_anterior character varying(20),
    estado_nuevo character varying(20) NOT NULL,
    motivo text,
    usuario character varying(20),
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: caso_estado_hist_id_hist_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.caso_estado_hist_id_hist_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_estado_hist_id_hist_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.caso_estado_hist_id_hist_seq OWNED BY ggto_d77.caso_estado_hist.id_hist;


--
-- Name: caso_id_caso_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.caso_id_caso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_id_caso_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.caso_id_caso_seq OWNED BY ggto_d77.caso.id_caso;


--
-- Name: catalogo_metodo; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.catalogo_metodo (
    id_metodo integer NOT NULL,
    dominio character varying(20) NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(120) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT catalogo_metodo_dominio_check CHECK (((dominio)::text = ANY (ARRAY[('CIERRE'::character varying)::text, ('ENRUTE'::character varying)::text, ('DIFERIDO'::character varying)::text, ('CONTACTO'::character varying)::text])))
);


--
-- Name: catalogo_metodo_id_metodo_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.catalogo_metodo_id_metodo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catalogo_metodo_id_metodo_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.catalogo_metodo_id_metodo_seq OWNED BY ggto_d77.catalogo_metodo.id_metodo;


--
-- Name: causa; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.causa (
    id_causa integer NOT NULL,
    codigo_causa character varying(20) NOT NULL,
    subcodigo_causa character varying(20) DEFAULT ''::character varying NOT NULL,
    descripcion character varying(255),
    descripcion_subcodigo character varying(255),
    tipo character varying(20),
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: causa_id_causa_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.causa_id_causa_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: causa_id_causa_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.causa_id_causa_seq OWNED BY ggto_d77.causa.id_causa;


--
-- Name: central; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.central (
    id_central integer NOT NULL,
    region character varying(80) NOT NULL,
    estado_geografico character varying(80) NOT NULL,
    capital_estado character varying(80),
    municipio character varying(80) NOT NULL,
    parroquia character varying(80) NOT NULL,
    estado_operativo character varying(80),
    distrito character varying(40),
    area character varying(20) NOT NULL,
    codigo_central character varying(20) NOT NULL,
    nombre_central character varying(120) NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: central_id_central_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.central_id_central_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: central_id_central_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.central_id_central_seq OWNED BY ggto_d77.central.id_central;


--
-- Name: cita; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.cita (
    id_cita bigint NOT NULL,
    id_caso bigint,
    id_caso_especial integer,
    id_cuadrilla integer,
    fecha_hora timestamp with time zone NOT NULL,
    tipo character varying(20) DEFAULT 'CONTACTO'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'PROPUESTA'::character varying NOT NULL,
    observacion text,
    creado_por character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cita_estado_check CHECK (((estado)::text = ANY (ARRAY[('PROPUESTA'::character varying)::text, ('CONFIRMADA'::character varying)::text, ('CUMPLIDA'::character varying)::text, ('REPROGRAMADA'::character varying)::text, ('DIFERIDA'::character varying)::text, ('CANCELADA'::character varying)::text]))),
    CONSTRAINT cita_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('CONTACTO'::character varying)::text, ('ATENCION'::character varying)::text]))),
    CONSTRAINT ck_cita_referencia CHECK (((id_caso IS NOT NULL) OR (id_caso_especial IS NOT NULL)))
);


--
-- Name: cita_id_cita_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.cita_id_cita_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cita_id_cita_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.cita_id_cita_seq OWNED BY ggto_d77.cita.id_cita;


--
-- Name: configuracion; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.configuracion (
    clave character varying(80) NOT NULL,
    valor jsonb NOT NULL,
    descripcion text,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.cuadrilla (
    id_cuadrilla integer NOT NULL,
    id_central integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(80) NOT NULL,
    id_flota integer,
    es_supervisor boolean DEFAULT false NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla_herramienta; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.cuadrilla_herramienta (
    id_cuadrilla integer NOT NULL,
    id_herramienta integer NOT NULL,
    asignada_en timestamp with time zone DEFAULT now() NOT NULL,
    devuelta_en timestamp with time zone
);


--
-- Name: cuadrilla_id_cuadrilla_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.cuadrilla_id_cuadrilla_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuadrilla_id_cuadrilla_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.cuadrilla_id_cuadrilla_seq OWNED BY ggto_d77.cuadrilla.id_cuadrilla;


--
-- Name: cuadrilla_sector_dia; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.cuadrilla_sector_dia (
    id_asignacion bigint NOT NULL,
    id_central integer NOT NULL,
    fecha date NOT NULL,
    id_cuadrilla integer NOT NULL,
    id_sector integer NOT NULL,
    usuario character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla_sector_dia_id_asignacion_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.cuadrilla_sector_dia_id_asignacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuadrilla_sector_dia_id_asignacion_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.cuadrilla_sector_dia_id_asignacion_seq OWNED BY ggto_d77.cuadrilla_sector_dia.id_asignacion;


--
-- Name: cuadrilla_tecnico; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.cuadrilla_tecnico (
    id_cuadrilla integer NOT NULL,
    id_tecnico integer NOT NULL,
    desde date DEFAULT CURRENT_DATE NOT NULL,
    rol_cuadrilla character varying(30) DEFAULT 'REPARADOR_PRINCIPAL'::character varying NOT NULL,
    hasta date,
    CONSTRAINT cuadrilla_tecnico_rol_cuadrilla_check CHECK (((rol_cuadrilla)::text = ANY (ARRAY[('REPARADOR_PRINCIPAL'::character varying)::text, ('AYUDANTE'::character varying)::text, ('SUPERVISOR'::character varying)::text])))
);


--
-- Name: despacho; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.despacho (
    id_despacho bigint NOT NULL,
    id_central integer NOT NULL,
    fecha date NOT NULL,
    id_cuadrilla integer NOT NULL,
    estado character varying(20) DEFAULT 'BORRADOR'::character varying NOT NULL,
    generado_auto boolean DEFAULT false NOT NULL,
    enviado_canal character varying(20),
    enviado_en timestamp with time zone,
    reporte_produccion_en timestamp with time zone,
    usuario_crea character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT despacho_enviado_canal_check CHECK (((enviado_canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('CORREO'::character varying)::text]))),
    CONSTRAINT despacho_estado_check CHECK (((estado)::text = ANY (ARRAY[('BORRADOR'::character varying)::text, ('PUBLICADO'::character varying)::text, ('CERRADO'::character varying)::text])))
);

ALTER TABLE ONLY ggto_d77.despacho FORCE ROW LEVEL SECURITY;


--
-- Name: despacho_caso; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.despacho_caso (
    id_despacho_caso bigint NOT NULL,
    id_despacho bigint NOT NULL,
    id_caso bigint NOT NULL,
    id_sector integer,
    orden_visita smallint,
    tipo_asignacion character varying(20),
    estado character varying(20) DEFAULT 'ASIGNADO'::character varying NOT NULL,
    observacion text,
    CONSTRAINT despacho_caso_estado_check CHECK (((estado)::text = ANY (ARRAY[('ASIGNADO'::character varying)::text, ('GESTIONADO'::character varying)::text, ('CERRADO'::character varying)::text, ('CITADO'::character varying)::text, ('DIFERIDO'::character varying)::text]))),
    CONSTRAINT despacho_caso_tipo_asignacion_check CHECK (((tipo_asignacion)::text = ANY (ARRAY[('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text, ('REFERIDO'::character varying)::text, ('EMPRESA'::character varying)::text, ('FALLA_MASIVA'::character varying)::text])))
);


--
-- Name: despacho_caso_id_despacho_caso_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.despacho_caso_id_despacho_caso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: despacho_caso_id_despacho_caso_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.despacho_caso_id_despacho_caso_seq OWNED BY ggto_d77.despacho_caso.id_despacho_caso;


--
-- Name: despacho_id_despacho_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.despacho_id_despacho_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: despacho_id_despacho_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.despacho_id_despacho_seq OWNED BY ggto_d77.despacho.id_despacho;


--
-- Name: dispositivo_seguridad; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.dispositivo_seguridad (
    id_dispositivo bigint NOT NULL,
    p00 character varying(20) NOT NULL,
    palabras_hash jsonb DEFAULT '[]'::jsonb NOT NULL,
    clave_privada_ref character varying(255),
    documento_cifrado text,
    bloqueado boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dispositivo_seguridad_id_dispositivo_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.dispositivo_seguridad_id_dispositivo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dispositivo_seguridad_id_dispositivo_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.dispositivo_seguridad_id_dispositivo_seq OWNED BY ggto_d77.dispositivo_seguridad.id_dispositivo;


--
-- Name: evidencia; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.evidencia (
    id_evidencia bigint NOT NULL,
    id_actividad bigint,
    tipo character varying(20) NOT NULL,
    serial_imagen character varying(160) NOT NULL,
    ruta_local character varying(255),
    ruta_remota character varying(255),
    latitud numeric(10,7),
    longitud numeric(10,7),
    fecha_hora timestamp with time zone NOT NULL,
    origen_camara boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT evidencia_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('POTENCIA'::character varying)::text, ('NAVEGACION'::character varying)::text, ('DEMO'::character varying)::text])))
);


--
-- Name: evidencia_id_evidencia_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.evidencia_id_evidencia_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evidencia_id_evidencia_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.evidencia_id_evidencia_seq OWNED BY ggto_d77.evidencia.id_evidencia;


--
-- Name: falla_masiva; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.falla_masiva (
    id_falla bigint NOT NULL,
    id_central integer NOT NULL,
    clave_concentracion character varying(120),
    descripcion text NOT NULL,
    fecha_deteccion timestamp with time zone DEFAULT now() NOT NULL,
    origen character varying(20) DEFAULT 'AUTOMATICA'::character varying NOT NULL,
    id_sector integer,
    id_cuadrilla integer,
    estado character varying(20) DEFAULT 'DETECTADA'::character varying NOT NULL,
    planificacion text,
    reporte_simple text,
    planificada_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT falla_masiva_estado_check CHECK (((estado)::text = ANY (ARRAY[('DETECTADA'::character varying)::text, ('PLANIFICADA'::character varying)::text, ('ATENDIDA'::character varying)::text, ('CERRADA'::character varying)::text]))),
    CONSTRAINT falla_masiva_origen_check CHECK (((origen)::text = ANY (ARRAY[('AUTOMATICA'::character varying)::text, ('REPORTE_TECNICO'::character varying)::text, ('MCP'::character varying)::text])))
);


--
-- Name: falla_masiva_id_falla_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.falla_masiva_id_falla_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: falla_masiva_id_falla_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.falla_masiva_id_falla_seq OWNED BY ggto_d77.falla_masiva.id_falla;


--
-- Name: flota; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.flota (
    id_flota integer NOT NULL,
    id_central integer NOT NULL,
    can character varying(20) NOT NULL,
    tipo character varying(40),
    marca character varying(40),
    modelo character varying(40),
    placa character varying(20),
    combustible character varying(20),
    status character varying(20) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    estado_cauchos character varying(30),
    estado_fluidos character varying(30),
    estado_general character varying(30),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT flota_status_check CHECK (((status)::text = ANY (ARRAY[('DISPONIBLE'::character varying)::text, ('EN_RUTA'::character varying)::text, ('MANTENIMIENTO'::character varying)::text, ('FUERA_SERVICIO'::character varying)::text])))
);


--
-- Name: flota_id_flota_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.flota_id_flota_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flota_id_flota_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.flota_id_flota_seq OWNED BY ggto_d77.flota.id_flota;


--
-- Name: herramienta; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.herramienta (
    id_herramienta integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(120) NOT NULL,
    codigo character varying(40) NOT NULL,
    estado character varying(20) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    observacion text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT herramienta_estado_check CHECK (((estado)::text = ANY (ARRAY[('DISPONIBLE'::character varying)::text, ('ASIGNADA'::character varying)::text, ('AVERIADA'::character varying)::text, ('PERDIDA'::character varying)::text])))
);


--
-- Name: herramienta_id_herramienta_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.herramienta_id_herramienta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: herramienta_id_herramienta_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.herramienta_id_herramienta_seq OWNED BY ggto_d77.herramienta.id_herramienta;


--
-- Name: incidente; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.incidente (
    id_incidente bigint NOT NULL,
    tipo character varying(20) NOT NULL,
    id_flota integer,
    id_herramienta integer,
    descripcion text,
    id_actividad bigint,
    estado character varying(20) DEFAULT 'REPORTADO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_incidente_referencia CHECK (((id_flota IS NOT NULL) OR (id_herramienta IS NOT NULL))),
    CONSTRAINT incidente_estado_check CHECK (((estado)::text = ANY (ARRAY[('REPORTADO'::character varying)::text, ('EN_REVISION'::character varying)::text, ('RESUELTO'::character varying)::text]))),
    CONSTRAINT incidente_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('FLOTA'::character varying)::text, ('HERRAMIENTA'::character varying)::text])))
);


--
-- Name: incidente_id_incidente_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.incidente_id_incidente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidente_id_incidente_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.incidente_id_incidente_seq OWNED BY ggto_d77.incidente.id_incidente;


--
-- Name: ingesta_lote; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.ingesta_lote (
    id_lote bigint NOT NULL,
    archivo character varying(255) NOT NULL,
    fecha_archivo date,
    id_central integer,
    filas_leidas integer DEFAULT 0 NOT NULL,
    filas_central integer DEFAULT 0 NOT NULL,
    casos_nuevos integer DEFAULT 0 NOT NULL,
    casos_duplicados integer DEFAULT 0 NOT NULL,
    casos_descartados integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'PROCESANDO'::character varying NOT NULL,
    detalle_error text,
    usuario character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ingesta_lote_estado_check CHECK (((estado)::text = ANY (ARRAY[('PROCESANDO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text])))
);


--
-- Name: ingesta_lote_id_lote_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.ingesta_lote_id_lote_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingesta_lote_id_lote_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.ingesta_lote_id_lote_seq OWNED BY ggto_d77.ingesta_lote.id_lote;


--
-- Name: insumo; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.insumo (
    id_insumo integer NOT NULL,
    id_central integer,
    codigo character varying(40) NOT NULL,
    nombre character varying(120) NOT NULL,
    unidad_medida character varying(20) DEFAULT 'UNIDAD'::character varying NOT NULL,
    stock_minimo numeric(12,2) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: insumo_id_insumo_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.insumo_id_insumo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: insumo_id_insumo_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.insumo_id_insumo_seq OWNED BY ggto_d77.insumo.id_insumo;


--
-- Name: inventario_movimiento; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.inventario_movimiento (
    id_mov bigint NOT NULL,
    id_insumo integer NOT NULL,
    tipo character varying(20) NOT NULL,
    cantidad numeric(12,2) NOT NULL,
    id_orden bigint,
    id_tecnico integer,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    usuario character varying(20),
    observacion text,
    CONSTRAINT inventario_movimiento_cantidad_check CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT inventario_movimiento_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('INGRESO'::character varying)::text, ('EGRESO'::character varying)::text, ('AJUSTE'::character varying)::text])))
);


--
-- Name: inventario_movimiento_id_mov_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.inventario_movimiento_id_mov_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventario_movimiento_id_mov_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.inventario_movimiento_id_mov_seq OWNED BY ggto_d77.inventario_movimiento.id_mov;


--
-- Name: notificacion; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.notificacion (
    id_notificacion bigint NOT NULL,
    canal character varying(20) NOT NULL,
    destinatario character varying(160),
    asunto character varying(200),
    cuerpo text,
    id_caso bigint,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    error text,
    enviado_en timestamp with time zone,
    intentos smallint DEFAULT 0 NOT NULL,
    proximo_intento timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notificacion_canal_check CHECK (((canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('CORREO'::character varying)::text, ('MCP_IA'::character varying)::text]))),
    CONSTRAINT notificacion_estado_check CHECK (((estado)::text = ANY (ARRAY[('PENDIENTE'::character varying)::text, ('ENVIADO'::character varying)::text, ('FALLIDO'::character varying)::text])))
);


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.notificacion_id_notificacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.notificacion_id_notificacion_seq OWNED BY ggto_d77.notificacion.id_notificacion;


--
-- Name: orden_material; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.orden_material (
    id_orden bigint NOT NULL,
    id_caso bigint,
    id_falla bigint,
    id_cuadrilla integer,
    solicitante_usuario character varying(20),
    estado character varying(20) DEFAULT 'SOLICITADA'::character varying NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    observacion text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orden_material_estado_check CHECK (((estado)::text = ANY (ARRAY[('SOLICITADA'::character varying)::text, ('APROBADA'::character varying)::text, ('ENTREGADA'::character varying)::text, ('RECHAZADA'::character varying)::text])))
);


--
-- Name: orden_material_detalle; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.orden_material_detalle (
    id_orden_detalle bigint NOT NULL,
    id_orden bigint NOT NULL,
    id_insumo integer NOT NULL,
    cantidad_solicitada numeric(12,2) NOT NULL,
    cantidad_entregada numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT orden_material_detalle_cantidad_solicitada_check CHECK ((cantidad_solicitada > (0)::numeric))
);


--
-- Name: orden_material_detalle_id_orden_detalle_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.orden_material_detalle_id_orden_detalle_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_material_detalle_id_orden_detalle_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.orden_material_detalle_id_orden_detalle_seq OWNED BY ggto_d77.orden_material_detalle.id_orden_detalle;


--
-- Name: orden_material_id_orden_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.orden_material_id_orden_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_material_id_orden_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.orden_material_id_orden_seq OWNED BY ggto_d77.orden_material.id_orden;


--
-- Name: rol; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.rol (
    id_rol integer NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(80) NOT NULL,
    descripcion text,
    permisos jsonb DEFAULT '{}'::jsonb NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rol_id_rol_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.rol_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rol_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.rol_id_rol_seq OWNED BY ggto_d77.rol.id_rol;


--
-- Name: sector; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.sector (
    id_sector integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(120) NOT NULL,
    codigo character varying(20) NOT NULL,
    descripcion text,
    prioridad smallint DEFAULT 100 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sector_direccion; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.sector_direccion (
    id_sector_direccion integer NOT NULL,
    id_sector integer NOT NULL,
    patron character varying(160) NOT NULL,
    tipo_coincidencia character varying(20) DEFAULT 'CONTIENE'::character varying NOT NULL,
    normalizar boolean DEFAULT true NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sector_direccion_tipo_coincidencia_check CHECK (((tipo_coincidencia)::text = ANY (ARRAY[('CONTIENE'::character varying)::text, ('EXACTO'::character varying)::text, ('REGEX'::character varying)::text])))
);


--
-- Name: sector_direccion_id_sector_direccion_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.sector_direccion_id_sector_direccion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sector_direccion_id_sector_direccion_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.sector_direccion_id_sector_direccion_seq OWNED BY ggto_d77.sector_direccion.id_sector_direccion;


--
-- Name: sector_id_sector_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.sector_id_sector_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sector_id_sector_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.sector_id_sector_seq OWNED BY ggto_d77.sector.id_sector;


--
-- Name: seguimiento; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.seguimiento (
    id_seguimiento bigint NOT NULL,
    id_caso bigint NOT NULL,
    instancia_destino character varying(120) NOT NULL,
    motivo text,
    fecha_envio timestamp with time zone DEFAULT now() NOT NULL,
    fecha_retorno timestamp with time zone,
    estado character varying(20) DEFAULT 'EN_COLA'::character varying NOT NULL,
    observacion text,
    usuario character varying(20),
    CONSTRAINT seguimiento_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_COLA'::character varying)::text, ('RESUELTO'::character varying)::text, ('DEVUELTO'::character varying)::text])))
);


--
-- Name: seguimiento_id_seguimiento_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.seguimiento_id_seguimiento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seguimiento_id_seguimiento_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.seguimiento_id_seguimiento_seq OWNED BY ggto_d77.seguimiento.id_seguimiento;


--
-- Name: seq_caso_ref; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.seq_caso_ref
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sincronizacion; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.sincronizacion (
    id_sync bigint NOT NULL,
    id_dispositivo bigint,
    id_tecnico integer,
    inicio timestamp with time zone DEFAULT now() NOT NULL,
    fin timestamp with time zone,
    casos_descargados integer DEFAULT 0 NOT NULL,
    actividades_subidas integer DEFAULT 0 NOT NULL,
    evidencias_subidas integer DEFAULT 0 NOT NULL,
    archivo_zip character varying(160),
    estado character varying(20) DEFAULT 'EN_PROCESO'::character varying NOT NULL,
    detalle_json jsonb,
    CONSTRAINT sincronizacion_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_PROCESO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text])))
);


--
-- Name: sincronizacion_id_sync_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.sincronizacion_id_sync_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sincronizacion_id_sync_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.sincronizacion_id_sync_seq OWNED BY ggto_d77.sincronizacion.id_sync;


--
-- Name: solicitante; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.solicitante (
    id_solicitante integer NOT NULL,
    unidad character varying(120) NOT NULL,
    nombre character varying(120) NOT NULL,
    contacto character varying(60) NOT NULL,
    canal character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT solicitante_canal_check CHECK (((canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('MCP_IA'::character varying)::text, ('MANUAL'::character varying)::text, ('CORREO'::character varying)::text])))
);


--
-- Name: solicitante_id_solicitante_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.solicitante_id_solicitante_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitante_id_solicitante_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.solicitante_id_solicitante_seq OWNED BY ggto_d77.solicitante.id_solicitante;


--
-- Name: sync_log; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.sync_log (
    id_sync_log bigint NOT NULL,
    p00 character varying(20) NOT NULL,
    id_cuadrilla integer,
    tipo character varying(20) NOT NULL,
    dispositivo_id character varying(80),
    version_app character varying(20),
    iniciado_en timestamp with time zone DEFAULT now() NOT NULL,
    finalizado_en timestamp with time zone,
    recibidos integer DEFAULT 0 NOT NULL,
    procesados integer DEFAULT 0 NOT NULL,
    errores integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'EN_PROCESO'::character varying NOT NULL,
    detalle jsonb,
    CONSTRAINT sync_log_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_PROCESO'::character varying)::text, ('OK'::character varying)::text, ('PARCIAL'::character varying)::text, ('ERROR'::character varying)::text]))),
    CONSTRAINT sync_log_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('DESCARGA'::character varying)::text, ('CARGA'::character varying)::text])))
);


--
-- Name: sync_log_id_sync_log_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.sync_log_id_sync_log_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_log_id_sync_log_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.sync_log_id_sync_log_seq OWNED BY ggto_d77.sync_log.id_sync_log;


--
-- Name: tecnico; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.tecnico (
    id_tecnico integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(80) NOT NULL,
    apellido character varying(80),
    cedula character varying(20),
    p00 character varying(20) NOT NULL,
    telefono character varying(30),
    correo character varying(120),
    especialidad character varying(80),
    status character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tecnico_status_check CHECK (((status)::text = ANY (ARRAY[('ACTIVO'::character varying)::text, ('INACTIVO'::character varying)::text, ('VACACIONES'::character varying)::text, ('SUSPENDIDO'::character varying)::text])))
);


--
-- Name: tecnico_id_tecnico_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.tecnico_id_tecnico_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tecnico_id_tecnico_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.tecnico_id_tecnico_seq OWNED BY ggto_d77.tecnico.id_tecnico;


--
-- Name: usuario; Type: TABLE; Schema: ggto_d77; Owner: -
--

CREATE TABLE ggto_d77.usuario (
    id_usuario integer NOT NULL,
    p00 character varying(20) NOT NULL,
    correo character varying(120),
    clave_hash character varying(255) NOT NULL,
    id_rol integer NOT NULL,
    id_tecnico integer,
    id_central integer,
    intentos_fallidos smallint DEFAULT 0 NOT NULL,
    bloqueado boolean DEFAULT false NOT NULL,
    bloqueo_cliente boolean DEFAULT false NOT NULL,
    requiere_cambio_clave boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    ultimo_acceso timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE; Schema: ggto_d77; Owner: -
--

CREATE SEQUENCE ggto_d77.usuario_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: ggto_d77; Owner: -
--

ALTER SEQUENCE ggto_d77.usuario_id_usuario_seq OWNED BY ggto_d77.usuario.id_usuario;


--
-- Name: actividad; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.actividad (
    id_actividad bigint NOT NULL,
    id_caso bigint NOT NULL,
    id_usuario integer,
    id_cuadrilla integer,
    tipo character varying(20) NOT NULL,
    resultado character varying(20),
    reporte_corto text,
    id_metodo integer,
    id_causa integer,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    latitud numeric(10,7),
    longitud numeric(10,7),
    sincronizado boolean DEFAULT false NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT actividad_resultado_check CHECK (((resultado)::text = ANY (ARRAY[('CONTACTADO'::character varying)::text, ('CERRADO'::character varying)::text, ('ENRUTADO'::character varying)::text, ('DIFERIDO'::character varying)::text]))),
    CONSTRAINT actividad_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('CONTACTO'::character varying)::text, ('CIERRE'::character varying)::text, ('ENRUTE'::character varying)::text, ('DIFERIDO'::character varying)::text, ('INCIDENTE'::character varying)::text, ('FALLA_MASIVA'::character varying)::text])))
);


--
-- Name: actividad_id_actividad_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.actividad_id_actividad_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: actividad_id_actividad_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.actividad_id_actividad_seq OWNED BY ggto_e2e.actividad.id_actividad;


--
-- Name: auditoria; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.auditoria (
    id_auditoria bigint NOT NULL,
    usuario character varying(20),
    accion character varying(60) NOT NULL,
    entidad character varying(60),
    id_entidad character varying(40),
    datos_antes jsonb,
    datos_despues jsonb,
    ip inet,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.auditoria_id_auditoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.auditoria_id_auditoria_seq OWNED BY ggto_e2e.auditoria.id_auditoria;


--
-- Name: caso; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.caso (
    id_caso bigint NOT NULL,
    id_central integer NOT NULL,
    id_averia character varying(30) NOT NULL,
    origen character varying(20) DEFAULT 'INGESTA_CSV'::character varying NOT NULL,
    tipo_caso character varying(20) DEFAULT 'AVERIA'::character varying NOT NULL,
    categoria character varying(20) DEFAULT 'RESIDENCIAL'::character varying NOT NULL,
    estado_actual character varying(20) DEFAULT 'NUEVO'::character varying NOT NULL,
    id_sector integer,
    id_causa integer,
    id_lote_ingesta bigint,
    en_gestion_supervisor boolean DEFAULT false NOT NULL,
    es_falla_masiva boolean DEFAULT false NOT NULL,
    creado_por character varying(20),
    region character varying(80),
    estado_geografico character varying(80),
    capital_estado character varying(80),
    municipio character varying(80),
    parroquia character varying(80),
    estado_operativo character varying(80),
    distrito character varying(40),
    area character varying(20),
    codigo_central character varying(20),
    nombre_central character varying(120),
    telefono character varying(30),
    fecha_reporte timestamp with time zone,
    persona_reporta character varying(120),
    contacto_cliente character varying(60),
    fecha_compromiso timestamp with time zone,
    fecha_cita timestamp with time zone,
    ultimo_comentario text,
    results text,
    asignado_a character varying(60),
    cuadrilla_externa character varying(40),
    estatus_origen character varying(20),
    problema_reporte text,
    informacion text,
    nombre_cliente character varying(160),
    direccion text,
    olt character varying(40),
    plan character varying(60),
    slot character varying(10),
    puerto character varying(10),
    fat character varying(80),
    serial character varying(60),
    extra character varying(120),
    area_trabajo character varying(40),
    tipo_servicio character varying(40),
    tipo_problema character varying(20),
    dias_area_resolutoria integer,
    unidad_negocio character varying(40),
    ups character varying(10),
    codigos_gestionados_venapp character varying(60),
    codigos_sin_gestion_venapp character varying(60),
    reparador_principal character varying(20),
    ayudantes jsonb DEFAULT '[]'::jsonb NOT NULL,
    flota_can character varying(20),
    despacho_nombre character varying(80),
    despacho_apellido character varying(80),
    telefono_oficina character varying(30),
    telefono_movil character varying(30),
    fecha_hora_asignacion timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caso_categoria_check CHECK (((categoria)::text = ANY (ARRAY[('RESIDENCIAL'::character varying)::text, ('EMPRESA'::character varying)::text, ('REFERIDO'::character varying)::text, ('GOBIERNO'::character varying)::text]))),
    CONSTRAINT caso_estado_actual_check CHECK (((estado_actual)::text = ANY (ARRAY[('NUEVO'::character varying)::text, ('ASIGNADO'::character varying)::text, ('CONTACTADO'::character varying)::text, ('CITADO'::character varying)::text, ('DIFERIDO'::character varying)::text, ('EN_GESTION'::character varying)::text, ('ENRUTADO'::character varying)::text, ('CERRADO'::character varying)::text, ('CANCELADO'::character varying)::text]))),
    CONSTRAINT caso_origen_check CHECK (((origen)::text = ANY (ARRAY[('INGESTA_CSV'::character varying)::text, ('MANUAL'::character varying)::text, ('TELEGRAM'::character varying)::text, ('MCP_IA'::character varying)::text]))),
    CONSTRAINT caso_tipo_caso_check CHECK (((tipo_caso)::text = ANY (ARRAY[('AVERIA'::character varying)::text, ('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text])))
);

ALTER TABLE ONLY ggto_e2e.caso FORCE ROW LEVEL SECURITY;


--
-- Name: caso_especial; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.caso_especial (
    id_caso_especial integer NOT NULL,
    id_caso bigint,
    id_solicitante integer,
    clasificacion character varying(20) NOT NULL,
    tipo_actividad character varying(20) NOT NULL,
    prioridad character varying(20) DEFAULT 'MEDIA'::character varying NOT NULL,
    tiene_id_averia boolean DEFAULT false NOT NULL,
    descripcion text,
    requiere_informe boolean DEFAULT true NOT NULL,
    estado character varying(20) DEFAULT 'ABIERTO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caso_especial_clasificacion_check CHECK (((clasificacion)::text = ANY (ARRAY[('REFERIDO'::character varying)::text, ('EMPRESA'::character varying)::text, ('GOBIERNO'::character varying)::text]))),
    CONSTRAINT caso_especial_estado_check CHECK (((estado)::text = ANY (ARRAY[('ABIERTO'::character varying)::text, ('EN_PROCESO'::character varying)::text, ('ATENDIDO'::character varying)::text, ('CERRADO'::character varying)::text]))),
    CONSTRAINT caso_especial_prioridad_check CHECK (((prioridad)::text = ANY (ARRAY[('ALTA'::character varying)::text, ('MEDIA'::character varying)::text, ('BAJA'::character varying)::text]))),
    CONSTRAINT caso_especial_tipo_actividad_check CHECK (((tipo_actividad)::text = ANY (ARRAY[('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text])))
);


--
-- Name: caso_especial_id_caso_especial_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.caso_especial_id_caso_especial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_especial_id_caso_especial_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.caso_especial_id_caso_especial_seq OWNED BY ggto_e2e.caso_especial.id_caso_especial;


--
-- Name: caso_estado_hist; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.caso_estado_hist (
    id_hist bigint NOT NULL,
    id_caso bigint NOT NULL,
    estado_anterior character varying(20),
    estado_nuevo character varying(20) NOT NULL,
    motivo text,
    usuario character varying(20),
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: caso_estado_hist_id_hist_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.caso_estado_hist_id_hist_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_estado_hist_id_hist_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.caso_estado_hist_id_hist_seq OWNED BY ggto_e2e.caso_estado_hist.id_hist;


--
-- Name: caso_id_caso_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.caso_id_caso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_id_caso_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.caso_id_caso_seq OWNED BY ggto_e2e.caso.id_caso;


--
-- Name: catalogo_metodo; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.catalogo_metodo (
    id_metodo integer NOT NULL,
    dominio character varying(20) NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(120) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT catalogo_metodo_dominio_check CHECK (((dominio)::text = ANY (ARRAY[('CIERRE'::character varying)::text, ('ENRUTE'::character varying)::text, ('DIFERIDO'::character varying)::text, ('CONTACTO'::character varying)::text])))
);


--
-- Name: catalogo_metodo_id_metodo_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.catalogo_metodo_id_metodo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catalogo_metodo_id_metodo_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.catalogo_metodo_id_metodo_seq OWNED BY ggto_e2e.catalogo_metodo.id_metodo;


--
-- Name: causa; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.causa (
    id_causa integer NOT NULL,
    codigo_causa character varying(20) NOT NULL,
    subcodigo_causa character varying(20) DEFAULT ''::character varying NOT NULL,
    descripcion character varying(255),
    descripcion_subcodigo character varying(255),
    tipo character varying(20),
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: causa_id_causa_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.causa_id_causa_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: causa_id_causa_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.causa_id_causa_seq OWNED BY ggto_e2e.causa.id_causa;


--
-- Name: central; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.central (
    id_central integer NOT NULL,
    region character varying(80) NOT NULL,
    estado_geografico character varying(80) NOT NULL,
    capital_estado character varying(80),
    municipio character varying(80) NOT NULL,
    parroquia character varying(80) NOT NULL,
    estado_operativo character varying(80),
    distrito character varying(40),
    area character varying(20) NOT NULL,
    codigo_central character varying(20) NOT NULL,
    nombre_central character varying(120) NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: central_id_central_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.central_id_central_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: central_id_central_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.central_id_central_seq OWNED BY ggto_e2e.central.id_central;


--
-- Name: cita; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.cita (
    id_cita bigint NOT NULL,
    id_caso bigint,
    id_caso_especial integer,
    id_cuadrilla integer,
    fecha_hora timestamp with time zone NOT NULL,
    tipo character varying(20) DEFAULT 'CONTACTO'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'PROPUESTA'::character varying NOT NULL,
    observacion text,
    creado_por character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    recordatorio_para timestamp with time zone,
    CONSTRAINT cita_estado_check CHECK (((estado)::text = ANY (ARRAY[('PROPUESTA'::character varying)::text, ('CONFIRMADA'::character varying)::text, ('CUMPLIDA'::character varying)::text, ('REPROGRAMADA'::character varying)::text, ('DIFERIDA'::character varying)::text, ('CANCELADA'::character varying)::text]))),
    CONSTRAINT cita_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('CONTACTO'::character varying)::text, ('ATENCION'::character varying)::text]))),
    CONSTRAINT ck_cita_referencia CHECK (((id_caso IS NOT NULL) OR (id_caso_especial IS NOT NULL)))
);


--
-- Name: cita_id_cita_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.cita_id_cita_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cita_id_cita_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.cita_id_cita_seq OWNED BY ggto_e2e.cita.id_cita;


--
-- Name: configuracion; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.configuracion (
    clave character varying(80) NOT NULL,
    valor jsonb NOT NULL,
    descripcion text,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.cuadrilla (
    id_cuadrilla integer NOT NULL,
    id_central integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(80) NOT NULL,
    id_flota integer,
    es_supervisor boolean DEFAULT false NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla_herramienta; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.cuadrilla_herramienta (
    id_cuadrilla integer NOT NULL,
    id_herramienta integer NOT NULL,
    asignada_en timestamp with time zone DEFAULT now() NOT NULL,
    devuelta_en timestamp with time zone
);


--
-- Name: cuadrilla_id_cuadrilla_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.cuadrilla_id_cuadrilla_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuadrilla_id_cuadrilla_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.cuadrilla_id_cuadrilla_seq OWNED BY ggto_e2e.cuadrilla.id_cuadrilla;


--
-- Name: cuadrilla_sector_dia; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.cuadrilla_sector_dia (
    id_asignacion bigint NOT NULL,
    id_central integer NOT NULL,
    fecha date NOT NULL,
    id_cuadrilla integer NOT NULL,
    id_sector integer NOT NULL,
    usuario character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla_sector_dia_id_asignacion_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.cuadrilla_sector_dia_id_asignacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuadrilla_sector_dia_id_asignacion_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.cuadrilla_sector_dia_id_asignacion_seq OWNED BY ggto_e2e.cuadrilla_sector_dia.id_asignacion;


--
-- Name: cuadrilla_tecnico; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.cuadrilla_tecnico (
    id_cuadrilla integer NOT NULL,
    id_tecnico integer NOT NULL,
    desde date DEFAULT CURRENT_DATE NOT NULL,
    rol_cuadrilla character varying(30) DEFAULT 'REPARADOR_PRINCIPAL'::character varying NOT NULL,
    hasta date,
    CONSTRAINT cuadrilla_tecnico_rol_cuadrilla_check CHECK (((rol_cuadrilla)::text = ANY (ARRAY[('REPARADOR_PRINCIPAL'::character varying)::text, ('AYUDANTE'::character varying)::text, ('SUPERVISOR'::character varying)::text])))
);


--
-- Name: despacho; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.despacho (
    id_despacho bigint NOT NULL,
    id_central integer NOT NULL,
    fecha date NOT NULL,
    id_cuadrilla integer NOT NULL,
    estado character varying(20) DEFAULT 'BORRADOR'::character varying NOT NULL,
    generado_auto boolean DEFAULT false NOT NULL,
    enviado_canal character varying(20),
    enviado_en timestamp with time zone,
    reporte_produccion_en timestamp with time zone,
    usuario_crea character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT despacho_enviado_canal_check CHECK (((enviado_canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('CORREO'::character varying)::text]))),
    CONSTRAINT despacho_estado_check CHECK (((estado)::text = ANY (ARRAY[('BORRADOR'::character varying)::text, ('PUBLICADO'::character varying)::text, ('CERRADO'::character varying)::text])))
);

ALTER TABLE ONLY ggto_e2e.despacho FORCE ROW LEVEL SECURITY;


--
-- Name: despacho_caso; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.despacho_caso (
    id_despacho_caso bigint NOT NULL,
    id_despacho bigint NOT NULL,
    id_caso bigint NOT NULL,
    id_sector integer,
    orden_visita smallint,
    tipo_asignacion character varying(20),
    estado character varying(20) DEFAULT 'ASIGNADO'::character varying NOT NULL,
    observacion text,
    CONSTRAINT despacho_caso_estado_check CHECK (((estado)::text = ANY (ARRAY[('ASIGNADO'::character varying)::text, ('GESTIONADO'::character varying)::text, ('CERRADO'::character varying)::text, ('CITADO'::character varying)::text, ('DIFERIDO'::character varying)::text]))),
    CONSTRAINT despacho_caso_tipo_asignacion_check CHECK (((tipo_asignacion)::text = ANY (ARRAY[('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text, ('REFERIDO'::character varying)::text, ('EMPRESA'::character varying)::text, ('FALLA_MASIVA'::character varying)::text])))
);


--
-- Name: despacho_caso_id_despacho_caso_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.despacho_caso_id_despacho_caso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: despacho_caso_id_despacho_caso_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.despacho_caso_id_despacho_caso_seq OWNED BY ggto_e2e.despacho_caso.id_despacho_caso;


--
-- Name: despacho_id_despacho_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.despacho_id_despacho_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: despacho_id_despacho_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.despacho_id_despacho_seq OWNED BY ggto_e2e.despacho.id_despacho;


--
-- Name: dispositivo_seguridad; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.dispositivo_seguridad (
    id_dispositivo bigint NOT NULL,
    p00 character varying(20) NOT NULL,
    palabras_hash jsonb DEFAULT '[]'::jsonb NOT NULL,
    clave_privada_ref character varying(255),
    documento_cifrado text,
    bloqueado boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dispositivo_seguridad_id_dispositivo_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.dispositivo_seguridad_id_dispositivo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dispositivo_seguridad_id_dispositivo_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.dispositivo_seguridad_id_dispositivo_seq OWNED BY ggto_e2e.dispositivo_seguridad.id_dispositivo;


--
-- Name: evidencia; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.evidencia (
    id_evidencia bigint NOT NULL,
    id_actividad bigint,
    tipo character varying(20) NOT NULL,
    serial_imagen character varying(160) NOT NULL,
    ruta_local character varying(255),
    ruta_remota character varying(255),
    latitud numeric(10,7),
    longitud numeric(10,7),
    fecha_hora timestamp with time zone NOT NULL,
    origen_camara boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT evidencia_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('POTENCIA'::character varying)::text, ('NAVEGACION'::character varying)::text, ('DEMO'::character varying)::text, ('FALLA_MASIVA'::character varying)::text])))
);


--
-- Name: evidencia_id_evidencia_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.evidencia_id_evidencia_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evidencia_id_evidencia_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.evidencia_id_evidencia_seq OWNED BY ggto_e2e.evidencia.id_evidencia;


--
-- Name: falla_masiva; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.falla_masiva (
    id_falla bigint NOT NULL,
    id_central integer NOT NULL,
    clave_concentracion character varying(120),
    descripcion text NOT NULL,
    fecha_deteccion timestamp with time zone DEFAULT now() NOT NULL,
    origen character varying(20) DEFAULT 'AUTOMATICA'::character varying NOT NULL,
    id_sector integer,
    id_cuadrilla integer,
    estado character varying(20) DEFAULT 'DETECTADA'::character varying NOT NULL,
    odn character varying(60),
    direccion character varying(200),
    fat character varying(60),
    evidencias text,
    planificacion text,
    reporte_simple text,
    planificada_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT falla_masiva_estado_check CHECK (((estado)::text = ANY (ARRAY[('DETECTADA'::character varying)::text, ('PLANIFICADA'::character varying)::text, ('ATENDIDA'::character varying)::text, ('CERRADA'::character varying)::text]))),
    CONSTRAINT falla_masiva_origen_check CHECK (((origen)::text = ANY (ARRAY[('AUTOMATICA'::character varying)::text, ('REPORTE_TECNICO'::character varying)::text, ('MCP'::character varying)::text])))
);


--
-- Name: falla_masiva_id_falla_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.falla_masiva_id_falla_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: falla_masiva_id_falla_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.falla_masiva_id_falla_seq OWNED BY ggto_e2e.falla_masiva.id_falla;


--
-- Name: flota; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.flota (
    id_flota integer NOT NULL,
    id_central integer NOT NULL,
    can character varying(20) NOT NULL,
    tipo character varying(40),
    marca character varying(40),
    modelo character varying(40),
    placa character varying(20),
    combustible character varying(20),
    status character varying(20) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    estado_cauchos character varying(30),
    estado_fluidos character varying(30),
    estado_general character varying(30),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT flota_status_check CHECK (((status)::text = ANY (ARRAY[('DISPONIBLE'::character varying)::text, ('EN_RUTA'::character varying)::text, ('MANTENIMIENTO'::character varying)::text, ('FUERA_SERVICIO'::character varying)::text])))
);


--
-- Name: flota_id_flota_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.flota_id_flota_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flota_id_flota_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.flota_id_flota_seq OWNED BY ggto_e2e.flota.id_flota;


--
-- Name: herramienta; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.herramienta (
    id_herramienta integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(120) NOT NULL,
    codigo character varying(40) NOT NULL,
    estado character varying(20) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    observacion text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT herramienta_estado_check CHECK (((estado)::text = ANY (ARRAY[('DISPONIBLE'::character varying)::text, ('ASIGNADA'::character varying)::text, ('AVERIADA'::character varying)::text, ('PERDIDA'::character varying)::text])))
);


--
-- Name: herramienta_id_herramienta_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.herramienta_id_herramienta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: herramienta_id_herramienta_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.herramienta_id_herramienta_seq OWNED BY ggto_e2e.herramienta.id_herramienta;


--
-- Name: incidente; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.incidente (
    id_incidente bigint NOT NULL,
    tipo character varying(20) NOT NULL,
    id_flota integer,
    id_herramienta integer,
    descripcion text,
    id_actividad bigint,
    estado character varying(20) DEFAULT 'REPORTADO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_incidente_referencia CHECK (((id_flota IS NOT NULL) OR (id_herramienta IS NOT NULL))),
    CONSTRAINT incidente_estado_check CHECK (((estado)::text = ANY (ARRAY[('REPORTADO'::character varying)::text, ('EN_REVISION'::character varying)::text, ('RESUELTO'::character varying)::text]))),
    CONSTRAINT incidente_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('FLOTA'::character varying)::text, ('HERRAMIENTA'::character varying)::text])))
);


--
-- Name: incidente_id_incidente_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.incidente_id_incidente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidente_id_incidente_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.incidente_id_incidente_seq OWNED BY ggto_e2e.incidente.id_incidente;


--
-- Name: ingesta_lote; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.ingesta_lote (
    id_lote bigint NOT NULL,
    archivo character varying(255) NOT NULL,
    fecha_archivo date,
    id_central integer,
    filas_leidas integer DEFAULT 0 NOT NULL,
    filas_central integer DEFAULT 0 NOT NULL,
    casos_nuevos integer DEFAULT 0 NOT NULL,
    casos_duplicados integer DEFAULT 0 NOT NULL,
    casos_descartados integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'PROCESANDO'::character varying NOT NULL,
    detalle_error text,
    usuario character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ingesta_lote_estado_check CHECK (((estado)::text = ANY (ARRAY[('PROCESANDO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text])))
);


--
-- Name: ingesta_lote_id_lote_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.ingesta_lote_id_lote_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingesta_lote_id_lote_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.ingesta_lote_id_lote_seq OWNED BY ggto_e2e.ingesta_lote.id_lote;


--
-- Name: insumo; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.insumo (
    id_insumo integer NOT NULL,
    id_central integer,
    codigo character varying(40) NOT NULL,
    nombre character varying(120) NOT NULL,
    unidad_medida character varying(20) DEFAULT 'UNIDAD'::character varying NOT NULL,
    stock_minimo numeric(12,2) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: insumo_id_insumo_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.insumo_id_insumo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: insumo_id_insumo_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.insumo_id_insumo_seq OWNED BY ggto_e2e.insumo.id_insumo;


--
-- Name: inventario_movimiento; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.inventario_movimiento (
    id_mov bigint NOT NULL,
    id_insumo integer NOT NULL,
    tipo character varying(20) NOT NULL,
    cantidad numeric(12,2) NOT NULL,
    id_orden bigint,
    id_tecnico integer,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    usuario character varying(20),
    observacion text,
    CONSTRAINT inventario_movimiento_cantidad_check CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT inventario_movimiento_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('INGRESO'::character varying)::text, ('EGRESO'::character varying)::text, ('AJUSTE'::character varying)::text])))
);


--
-- Name: inventario_movimiento_id_mov_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.inventario_movimiento_id_mov_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventario_movimiento_id_mov_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.inventario_movimiento_id_mov_seq OWNED BY ggto_e2e.inventario_movimiento.id_mov;


--
-- Name: mensaje; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.mensaje (
    id_mensaje bigint NOT NULL,
    id_central integer NOT NULL,
    origen_p00 character varying(20),
    destino_tipo character varying(12) NOT NULL,
    id_cuadrilla integer,
    id_tecnico integer,
    tipo character varying(20) NOT NULL,
    cuerpo character varying(500) NOT NULL,
    id_caso bigint,
    dedupe_key character varying(80),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone DEFAULT (now() + '5 days'::interval) NOT NULL,
    CONSTRAINT mensaje_check CHECK ((expira_en > creado_en)),
    CONSTRAINT mensaje_check1 CHECK (((((destino_tipo)::text = 'TODOS'::text) AND (id_cuadrilla IS NULL) AND (id_tecnico IS NULL)) OR (((destino_tipo)::text = 'CUADRILLA'::text) AND (id_cuadrilla IS NOT NULL) AND (id_tecnico IS NULL)) OR (((destino_tipo)::text = 'TECNICO'::text) AND (id_tecnico IS NOT NULL) AND (id_cuadrilla IS NULL)))),
    CONSTRAINT mensaje_destino_tipo_check CHECK (((destino_tipo)::text = ANY (ARRAY[('TODOS'::character varying)::text, ('CUADRILLA'::character varying)::text, ('TECNICO'::character varying)::text]))),
    CONSTRAINT mensaje_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('RECORDATORIO_CITA'::character varying)::text, ('ESTADO_SYNC'::character varying)::text, ('ALARMA_DESPACHO'::character varying)::text, ('TEXTO'::character varying)::text])))
);


--
-- Name: mensaje_destino; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.mensaje_destino (
    id_mensaje bigint NOT NULL,
    id_tecnico integer NOT NULL,
    leido_en timestamp with time zone
);


--
-- Name: mensaje_id_mensaje_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.mensaje_id_mensaje_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mensaje_id_mensaje_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.mensaje_id_mensaje_seq OWNED BY ggto_e2e.mensaje.id_mensaje;


--
-- Name: notificacion; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.notificacion (
    id_notificacion bigint NOT NULL,
    canal character varying(20) NOT NULL,
    destinatario character varying(160),
    asunto character varying(200),
    cuerpo text,
    id_caso bigint,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    error text,
    enviado_en timestamp with time zone,
    intentos smallint DEFAULT 0 NOT NULL,
    proximo_intento timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notificacion_canal_check CHECK (((canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('CORREO'::character varying)::text, ('MCP_IA'::character varying)::text]))),
    CONSTRAINT notificacion_estado_check CHECK (((estado)::text = ANY (ARRAY[('PENDIENTE'::character varying)::text, ('ENVIADO'::character varying)::text, ('FALLIDO'::character varying)::text])))
);


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.notificacion_id_notificacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.notificacion_id_notificacion_seq OWNED BY ggto_e2e.notificacion.id_notificacion;


--
-- Name: orden_material; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.orden_material (
    id_orden bigint NOT NULL,
    id_caso bigint,
    id_falla bigint,
    id_cuadrilla integer,
    solicitante_usuario character varying(20),
    estado character varying(20) DEFAULT 'SOLICITADA'::character varying NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    observacion text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orden_material_estado_check CHECK (((estado)::text = ANY (ARRAY[('SOLICITADA'::character varying)::text, ('APROBADA'::character varying)::text, ('ENTREGADA'::character varying)::text, ('RECHAZADA'::character varying)::text])))
);


--
-- Name: orden_material_detalle; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.orden_material_detalle (
    id_orden_detalle bigint NOT NULL,
    id_orden bigint NOT NULL,
    id_insumo integer NOT NULL,
    cantidad_solicitada numeric(12,2) NOT NULL,
    cantidad_entregada numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT orden_material_detalle_cantidad_solicitada_check CHECK ((cantidad_solicitada > (0)::numeric))
);


--
-- Name: orden_material_detalle_id_orden_detalle_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.orden_material_detalle_id_orden_detalle_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_material_detalle_id_orden_detalle_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.orden_material_detalle_id_orden_detalle_seq OWNED BY ggto_e2e.orden_material_detalle.id_orden_detalle;


--
-- Name: orden_material_id_orden_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.orden_material_id_orden_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_material_id_orden_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.orden_material_id_orden_seq OWNED BY ggto_e2e.orden_material.id_orden;


--
-- Name: rol; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.rol (
    id_rol integer NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(80) NOT NULL,
    descripcion text,
    permisos jsonb DEFAULT '{}'::jsonb NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rol_id_rol_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.rol_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rol_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.rol_id_rol_seq OWNED BY ggto_e2e.rol.id_rol;


--
-- Name: sector; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.sector (
    id_sector integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(120) NOT NULL,
    codigo character varying(20) NOT NULL,
    descripcion text,
    prioridad smallint DEFAULT 100 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sector_direccion; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.sector_direccion (
    id_sector_direccion integer NOT NULL,
    id_sector integer NOT NULL,
    patron character varying(160) NOT NULL,
    tipo_coincidencia character varying(20) DEFAULT 'CONTIENE'::character varying NOT NULL,
    normalizar boolean DEFAULT true NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sector_direccion_tipo_coincidencia_check CHECK (((tipo_coincidencia)::text = ANY (ARRAY[('CONTIENE'::character varying)::text, ('EXACTO'::character varying)::text, ('REGEX'::character varying)::text])))
);


--
-- Name: sector_direccion_id_sector_direccion_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.sector_direccion_id_sector_direccion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sector_direccion_id_sector_direccion_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.sector_direccion_id_sector_direccion_seq OWNED BY ggto_e2e.sector_direccion.id_sector_direccion;


--
-- Name: sector_id_sector_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.sector_id_sector_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sector_id_sector_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.sector_id_sector_seq OWNED BY ggto_e2e.sector.id_sector;


--
-- Name: seguimiento; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.seguimiento (
    id_seguimiento bigint NOT NULL,
    id_caso bigint NOT NULL,
    instancia_destino character varying(120) NOT NULL,
    motivo text,
    fecha_envio timestamp with time zone DEFAULT now() NOT NULL,
    fecha_retorno timestamp with time zone,
    estado character varying(20) DEFAULT 'EN_COLA'::character varying NOT NULL,
    observacion text,
    usuario character varying(20),
    CONSTRAINT seguimiento_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_COLA'::character varying)::text, ('RESUELTO'::character varying)::text, ('DEVUELTO'::character varying)::text])))
);


--
-- Name: seguimiento_id_seguimiento_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.seguimiento_id_seguimiento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seguimiento_id_seguimiento_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.seguimiento_id_seguimiento_seq OWNED BY ggto_e2e.seguimiento.id_seguimiento;


--
-- Name: seq_caso_ref; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.seq_caso_ref
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sincronizacion; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.sincronizacion (
    id_sync bigint NOT NULL,
    id_dispositivo bigint,
    id_tecnico integer,
    inicio timestamp with time zone DEFAULT now() NOT NULL,
    fin timestamp with time zone,
    casos_descargados integer DEFAULT 0 NOT NULL,
    actividades_subidas integer DEFAULT 0 NOT NULL,
    evidencias_subidas integer DEFAULT 0 NOT NULL,
    archivo_zip character varying(160),
    estado character varying(20) DEFAULT 'EN_PROCESO'::character varying NOT NULL,
    detalle_json jsonb,
    CONSTRAINT sincronizacion_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_PROCESO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text])))
);


--
-- Name: sincronizacion_id_sync_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.sincronizacion_id_sync_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sincronizacion_id_sync_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.sincronizacion_id_sync_seq OWNED BY ggto_e2e.sincronizacion.id_sync;


--
-- Name: solicitante; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.solicitante (
    id_solicitante integer NOT NULL,
    unidad character varying(120) NOT NULL,
    nombre character varying(120) NOT NULL,
    contacto character varying(60) NOT NULL,
    canal character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT solicitante_canal_check CHECK (((canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('MCP_IA'::character varying)::text, ('MANUAL'::character varying)::text, ('CORREO'::character varying)::text])))
);


--
-- Name: solicitante_id_solicitante_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.solicitante_id_solicitante_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitante_id_solicitante_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.solicitante_id_solicitante_seq OWNED BY ggto_e2e.solicitante.id_solicitante;


--
-- Name: sync_check; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.sync_check (
    id_sync_check bigint NOT NULL,
    id_sync_log bigint NOT NULL,
    paso character varying(12) NOT NULL,
    estado character varying(12) NOT NULL,
    fecha_hora timestamp with time zone,
    detalle jsonb,
    CONSTRAINT sync_check_estado_check CHECK (((estado)::text = ANY (ARRAY[('PENDIENTE'::character varying)::text, ('EN_CURSO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text, ('OMITIDO'::character varying)::text]))),
    CONSTRAINT sync_check_paso_check CHECK (((paso)::text = ANY (ARRAY[('CONEXION'::character varying)::text, ('LOGIN'::character varying)::text, ('DESCARGA'::character varying)::text, ('CARGA'::character varying)::text])))
);


--
-- Name: sync_check_id_sync_check_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.sync_check_id_sync_check_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_check_id_sync_check_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.sync_check_id_sync_check_seq OWNED BY ggto_e2e.sync_check.id_sync_check;


--
-- Name: sync_log; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.sync_log (
    id_sync_log bigint NOT NULL,
    p00 character varying(20) NOT NULL,
    id_cuadrilla integer,
    tipo character varying(20) NOT NULL,
    dispositivo_id character varying(80),
    version_app character varying(20),
    iniciado_en timestamp with time zone DEFAULT now() NOT NULL,
    finalizado_en timestamp with time zone,
    recibidos integer DEFAULT 0 NOT NULL,
    procesados integer DEFAULT 0 NOT NULL,
    errores integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'EN_PROCESO'::character varying NOT NULL,
    detalle jsonb,
    plataforma character varying(20) DEFAULT 'APK'::character varying NOT NULL,
    duracion_ms integer,
    id_central integer,
    CONSTRAINT sync_log_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_PROCESO'::character varying)::text, ('OK'::character varying)::text, ('PARCIAL'::character varying)::text, ('ERROR'::character varying)::text]))),
    CONSTRAINT sync_log_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('DESCARGA'::character varying)::text, ('CARGA'::character varying)::text])))
);


--
-- Name: sync_log_id_sync_log_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.sync_log_id_sync_log_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_log_id_sync_log_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.sync_log_id_sync_log_seq OWNED BY ggto_e2e.sync_log.id_sync_log;


--
-- Name: tecnico; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.tecnico (
    id_tecnico integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(80) NOT NULL,
    apellido character varying(80),
    cedula character varying(20),
    p00 character varying(20) NOT NULL,
    telefono character varying(30),
    correo character varying(120),
    especialidad character varying(80),
    status character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tecnico_status_check CHECK (((status)::text = ANY (ARRAY[('ACTIVO'::character varying)::text, ('INACTIVO'::character varying)::text, ('VACACIONES'::character varying)::text, ('SUSPENDIDO'::character varying)::text])))
);


--
-- Name: tecnico_id_tecnico_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.tecnico_id_tecnico_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tecnico_id_tecnico_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.tecnico_id_tecnico_seq OWNED BY ggto_e2e.tecnico.id_tecnico;


--
-- Name: usuario; Type: TABLE; Schema: ggto_e2e; Owner: -
--

CREATE TABLE ggto_e2e.usuario (
    id_usuario integer NOT NULL,
    p00 character varying(20) NOT NULL,
    correo character varying(120),
    clave_hash character varying(255) NOT NULL,
    id_rol integer NOT NULL,
    id_tecnico integer,
    id_central integer,
    intentos_fallidos smallint DEFAULT 0 NOT NULL,
    bloqueado boolean DEFAULT false NOT NULL,
    bloqueo_cliente boolean DEFAULT false NOT NULL,
    requiere_cambio_clave boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    ultimo_acceso timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE; Schema: ggto_e2e; Owner: -
--

CREATE SEQUENCE ggto_e2e.usuario_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: ggto_e2e; Owner: -
--

ALTER SEQUENCE ggto_e2e.usuario_id_usuario_seq OWNED BY ggto_e2e.usuario.id_usuario;


--
-- Name: actividad; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.actividad (
    id_actividad bigint NOT NULL,
    id_caso bigint NOT NULL,
    id_usuario integer,
    id_cuadrilla integer,
    tipo character varying(20) NOT NULL,
    resultado character varying(20),
    reporte_corto text,
    id_metodo integer,
    id_causa integer,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    latitud numeric(10,7),
    longitud numeric(10,7),
    sincronizado boolean DEFAULT false NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT actividad_resultado_check CHECK (((resultado)::text = ANY (ARRAY[('CONTACTADO'::character varying)::text, ('CERRADO'::character varying)::text, ('ENRUTADO'::character varying)::text, ('DIFERIDO'::character varying)::text]))),
    CONSTRAINT actividad_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('CONTACTO'::character varying)::text, ('CIERRE'::character varying)::text, ('ENRUTE'::character varying)::text, ('DIFERIDO'::character varying)::text, ('INCIDENTE'::character varying)::text, ('FALLA_MASIVA'::character varying)::text])))
);


--
-- Name: actividad_id_actividad_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.actividad_id_actividad_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: actividad_id_actividad_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.actividad_id_actividad_seq OWNED BY ggto_sync.actividad.id_actividad;


--
-- Name: auditoria; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.auditoria (
    id_auditoria bigint NOT NULL,
    usuario character varying(20),
    accion character varying(60) NOT NULL,
    entidad character varying(60),
    id_entidad character varying(40),
    datos_antes jsonb,
    datos_despues jsonb,
    ip inet,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.auditoria_id_auditoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.auditoria_id_auditoria_seq OWNED BY ggto_sync.auditoria.id_auditoria;


--
-- Name: caso; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.caso (
    id_caso bigint NOT NULL,
    id_central integer NOT NULL,
    id_averia character varying(30) NOT NULL,
    origen character varying(20) DEFAULT 'INGESTA_CSV'::character varying NOT NULL,
    tipo_caso character varying(20) DEFAULT 'AVERIA'::character varying NOT NULL,
    categoria character varying(20) DEFAULT 'RESIDENCIAL'::character varying NOT NULL,
    estado_actual character varying(20) DEFAULT 'NUEVO'::character varying NOT NULL,
    id_sector integer,
    id_causa integer,
    id_lote_ingesta bigint,
    en_gestion_supervisor boolean DEFAULT false NOT NULL,
    es_falla_masiva boolean DEFAULT false NOT NULL,
    creado_por character varying(20),
    region character varying(80),
    estado_geografico character varying(80),
    capital_estado character varying(80),
    municipio character varying(80),
    parroquia character varying(80),
    estado_operativo character varying(80),
    distrito character varying(40),
    area character varying(20),
    codigo_central character varying(20),
    nombre_central character varying(120),
    telefono character varying(30),
    fecha_reporte timestamp with time zone,
    persona_reporta character varying(120),
    contacto_cliente character varying(60),
    fecha_compromiso timestamp with time zone,
    fecha_cita timestamp with time zone,
    ultimo_comentario text,
    results text,
    asignado_a character varying(60),
    cuadrilla_externa character varying(40),
    estatus_origen character varying(20),
    problema_reporte text,
    informacion text,
    nombre_cliente character varying(160),
    direccion text,
    olt character varying(40),
    plan character varying(60),
    slot character varying(10),
    puerto character varying(10),
    fat character varying(80),
    serial character varying(60),
    extra character varying(120),
    area_trabajo character varying(40),
    tipo_servicio character varying(40),
    tipo_problema character varying(20),
    dias_area_resolutoria integer,
    unidad_negocio character varying(40),
    ups character varying(10),
    codigos_gestionados_venapp character varying(60),
    codigos_sin_gestion_venapp character varying(60),
    reparador_principal character varying(20),
    ayudantes jsonb DEFAULT '[]'::jsonb NOT NULL,
    flota_can character varying(20),
    despacho_nombre character varying(80),
    despacho_apellido character varying(80),
    telefono_oficina character varying(30),
    telefono_movil character varying(30),
    fecha_hora_asignacion timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caso_categoria_check CHECK (((categoria)::text = ANY (ARRAY[('RESIDENCIAL'::character varying)::text, ('EMPRESA'::character varying)::text, ('REFERIDO'::character varying)::text, ('GOBIERNO'::character varying)::text]))),
    CONSTRAINT caso_estado_actual_check CHECK (((estado_actual)::text = ANY (ARRAY[('NUEVO'::character varying)::text, ('ASIGNADO'::character varying)::text, ('CONTACTADO'::character varying)::text, ('CITADO'::character varying)::text, ('DIFERIDO'::character varying)::text, ('EN_GESTION'::character varying)::text, ('ENRUTADO'::character varying)::text, ('CERRADO'::character varying)::text, ('CANCELADO'::character varying)::text]))),
    CONSTRAINT caso_origen_check CHECK (((origen)::text = ANY (ARRAY[('INGESTA_CSV'::character varying)::text, ('MANUAL'::character varying)::text, ('TELEGRAM'::character varying)::text, ('MCP_IA'::character varying)::text]))),
    CONSTRAINT caso_tipo_caso_check CHECK (((tipo_caso)::text = ANY (ARRAY[('AVERIA'::character varying)::text, ('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text])))
);

ALTER TABLE ONLY ggto_sync.caso FORCE ROW LEVEL SECURITY;


--
-- Name: caso_especial; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.caso_especial (
    id_caso_especial integer NOT NULL,
    id_caso bigint,
    id_solicitante integer,
    clasificacion character varying(20) NOT NULL,
    tipo_actividad character varying(20) NOT NULL,
    prioridad character varying(20) DEFAULT 'MEDIA'::character varying NOT NULL,
    tiene_id_averia boolean DEFAULT false NOT NULL,
    descripcion text,
    requiere_informe boolean DEFAULT true NOT NULL,
    estado character varying(20) DEFAULT 'ABIERTO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caso_especial_clasificacion_check CHECK (((clasificacion)::text = ANY (ARRAY[('REFERIDO'::character varying)::text, ('EMPRESA'::character varying)::text, ('GOBIERNO'::character varying)::text]))),
    CONSTRAINT caso_especial_estado_check CHECK (((estado)::text = ANY (ARRAY[('ABIERTO'::character varying)::text, ('EN_PROCESO'::character varying)::text, ('ATENDIDO'::character varying)::text, ('CERRADO'::character varying)::text]))),
    CONSTRAINT caso_especial_prioridad_check CHECK (((prioridad)::text = ANY (ARRAY[('ALTA'::character varying)::text, ('MEDIA'::character varying)::text, ('BAJA'::character varying)::text]))),
    CONSTRAINT caso_especial_tipo_actividad_check CHECK (((tipo_actividad)::text = ANY (ARRAY[('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text])))
);


--
-- Name: caso_especial_id_caso_especial_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.caso_especial_id_caso_especial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_especial_id_caso_especial_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.caso_especial_id_caso_especial_seq OWNED BY ggto_sync.caso_especial.id_caso_especial;


--
-- Name: caso_estado_hist; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.caso_estado_hist (
    id_hist bigint NOT NULL,
    id_caso bigint NOT NULL,
    estado_anterior character varying(20),
    estado_nuevo character varying(20) NOT NULL,
    motivo text,
    usuario character varying(20),
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: caso_estado_hist_id_hist_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.caso_estado_hist_id_hist_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_estado_hist_id_hist_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.caso_estado_hist_id_hist_seq OWNED BY ggto_sync.caso_estado_hist.id_hist;


--
-- Name: caso_id_caso_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.caso_id_caso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_id_caso_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.caso_id_caso_seq OWNED BY ggto_sync.caso.id_caso;


--
-- Name: catalogo_metodo; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.catalogo_metodo (
    id_metodo integer NOT NULL,
    dominio character varying(20) NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(120) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT catalogo_metodo_dominio_check CHECK (((dominio)::text = ANY (ARRAY[('CIERRE'::character varying)::text, ('ENRUTE'::character varying)::text, ('DIFERIDO'::character varying)::text, ('CONTACTO'::character varying)::text])))
);


--
-- Name: catalogo_metodo_id_metodo_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.catalogo_metodo_id_metodo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catalogo_metodo_id_metodo_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.catalogo_metodo_id_metodo_seq OWNED BY ggto_sync.catalogo_metodo.id_metodo;


--
-- Name: causa; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.causa (
    id_causa integer NOT NULL,
    codigo_causa character varying(20) NOT NULL,
    subcodigo_causa character varying(20) DEFAULT ''::character varying NOT NULL,
    descripcion character varying(255),
    descripcion_subcodigo character varying(255),
    tipo character varying(20),
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: causa_id_causa_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.causa_id_causa_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: causa_id_causa_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.causa_id_causa_seq OWNED BY ggto_sync.causa.id_causa;


--
-- Name: central; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.central (
    id_central integer NOT NULL,
    region character varying(80) NOT NULL,
    estado_geografico character varying(80) NOT NULL,
    capital_estado character varying(80),
    municipio character varying(80) NOT NULL,
    parroquia character varying(80) NOT NULL,
    estado_operativo character varying(80),
    distrito character varying(40),
    area character varying(20) NOT NULL,
    codigo_central character varying(20) NOT NULL,
    nombre_central character varying(120) NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: central_id_central_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.central_id_central_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: central_id_central_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.central_id_central_seq OWNED BY ggto_sync.central.id_central;


--
-- Name: cita; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.cita (
    id_cita bigint NOT NULL,
    id_caso bigint,
    id_caso_especial integer,
    id_cuadrilla integer,
    fecha_hora timestamp with time zone NOT NULL,
    tipo character varying(20) DEFAULT 'CONTACTO'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'PROPUESTA'::character varying NOT NULL,
    observacion text,
    creado_por character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cita_estado_check CHECK (((estado)::text = ANY (ARRAY[('PROPUESTA'::character varying)::text, ('CONFIRMADA'::character varying)::text, ('CUMPLIDA'::character varying)::text, ('REPROGRAMADA'::character varying)::text, ('DIFERIDA'::character varying)::text, ('CANCELADA'::character varying)::text]))),
    CONSTRAINT cita_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('CONTACTO'::character varying)::text, ('ATENCION'::character varying)::text]))),
    CONSTRAINT ck_cita_referencia CHECK (((id_caso IS NOT NULL) OR (id_caso_especial IS NOT NULL)))
);


--
-- Name: cita_id_cita_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.cita_id_cita_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cita_id_cita_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.cita_id_cita_seq OWNED BY ggto_sync.cita.id_cita;


--
-- Name: configuracion; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.configuracion (
    clave character varying(80) NOT NULL,
    valor jsonb NOT NULL,
    descripcion text,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.cuadrilla (
    id_cuadrilla integer NOT NULL,
    id_central integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(80) NOT NULL,
    id_flota integer,
    es_supervisor boolean DEFAULT false NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla_herramienta; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.cuadrilla_herramienta (
    id_cuadrilla integer NOT NULL,
    id_herramienta integer NOT NULL,
    asignada_en timestamp with time zone DEFAULT now() NOT NULL,
    devuelta_en timestamp with time zone
);


--
-- Name: cuadrilla_id_cuadrilla_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.cuadrilla_id_cuadrilla_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuadrilla_id_cuadrilla_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.cuadrilla_id_cuadrilla_seq OWNED BY ggto_sync.cuadrilla.id_cuadrilla;


--
-- Name: cuadrilla_sector_dia; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.cuadrilla_sector_dia (
    id_asignacion bigint NOT NULL,
    id_central integer NOT NULL,
    fecha date NOT NULL,
    id_cuadrilla integer NOT NULL,
    id_sector integer NOT NULL,
    usuario character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla_sector_dia_id_asignacion_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.cuadrilla_sector_dia_id_asignacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuadrilla_sector_dia_id_asignacion_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.cuadrilla_sector_dia_id_asignacion_seq OWNED BY ggto_sync.cuadrilla_sector_dia.id_asignacion;


--
-- Name: cuadrilla_tecnico; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.cuadrilla_tecnico (
    id_cuadrilla integer NOT NULL,
    id_tecnico integer NOT NULL,
    desde date DEFAULT CURRENT_DATE NOT NULL,
    rol_cuadrilla character varying(30) DEFAULT 'REPARADOR_PRINCIPAL'::character varying NOT NULL,
    hasta date,
    CONSTRAINT cuadrilla_tecnico_rol_cuadrilla_check CHECK (((rol_cuadrilla)::text = ANY (ARRAY[('REPARADOR_PRINCIPAL'::character varying)::text, ('AYUDANTE'::character varying)::text, ('SUPERVISOR'::character varying)::text])))
);


--
-- Name: despacho; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.despacho (
    id_despacho bigint NOT NULL,
    id_central integer NOT NULL,
    fecha date NOT NULL,
    id_cuadrilla integer NOT NULL,
    estado character varying(20) DEFAULT 'BORRADOR'::character varying NOT NULL,
    generado_auto boolean DEFAULT false NOT NULL,
    enviado_canal character varying(20),
    enviado_en timestamp with time zone,
    reporte_produccion_en timestamp with time zone,
    usuario_crea character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT despacho_enviado_canal_check CHECK (((enviado_canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('CORREO'::character varying)::text]))),
    CONSTRAINT despacho_estado_check CHECK (((estado)::text = ANY (ARRAY[('BORRADOR'::character varying)::text, ('PUBLICADO'::character varying)::text, ('CERRADO'::character varying)::text])))
);

ALTER TABLE ONLY ggto_sync.despacho FORCE ROW LEVEL SECURITY;


--
-- Name: despacho_caso; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.despacho_caso (
    id_despacho_caso bigint NOT NULL,
    id_despacho bigint NOT NULL,
    id_caso bigint NOT NULL,
    id_sector integer,
    orden_visita smallint,
    tipo_asignacion character varying(20),
    estado character varying(20) DEFAULT 'ASIGNADO'::character varying NOT NULL,
    observacion text,
    CONSTRAINT despacho_caso_estado_check CHECK (((estado)::text = ANY (ARRAY[('ASIGNADO'::character varying)::text, ('GESTIONADO'::character varying)::text, ('CERRADO'::character varying)::text, ('CITADO'::character varying)::text, ('DIFERIDO'::character varying)::text]))),
    CONSTRAINT despacho_caso_tipo_asignacion_check CHECK (((tipo_asignacion)::text = ANY (ARRAY[('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text, ('REFERIDO'::character varying)::text, ('EMPRESA'::character varying)::text, ('FALLA_MASIVA'::character varying)::text])))
);


--
-- Name: despacho_caso_id_despacho_caso_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.despacho_caso_id_despacho_caso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: despacho_caso_id_despacho_caso_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.despacho_caso_id_despacho_caso_seq OWNED BY ggto_sync.despacho_caso.id_despacho_caso;


--
-- Name: despacho_id_despacho_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.despacho_id_despacho_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: despacho_id_despacho_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.despacho_id_despacho_seq OWNED BY ggto_sync.despacho.id_despacho;


--
-- Name: dispositivo_seguridad; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.dispositivo_seguridad (
    id_dispositivo bigint NOT NULL,
    p00 character varying(20) NOT NULL,
    palabras_hash jsonb DEFAULT '[]'::jsonb NOT NULL,
    clave_privada_ref character varying(255),
    documento_cifrado text,
    bloqueado boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dispositivo_seguridad_id_dispositivo_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.dispositivo_seguridad_id_dispositivo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dispositivo_seguridad_id_dispositivo_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.dispositivo_seguridad_id_dispositivo_seq OWNED BY ggto_sync.dispositivo_seguridad.id_dispositivo;


--
-- Name: evidencia; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.evidencia (
    id_evidencia bigint NOT NULL,
    id_actividad bigint,
    tipo character varying(20) NOT NULL,
    serial_imagen character varying(160) NOT NULL,
    ruta_local character varying(255),
    ruta_remota character varying(255),
    latitud numeric(10,7),
    longitud numeric(10,7),
    fecha_hora timestamp with time zone NOT NULL,
    origen_camara boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT evidencia_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('POTENCIA'::character varying)::text, ('NAVEGACION'::character varying)::text, ('DEMO'::character varying)::text])))
);


--
-- Name: evidencia_id_evidencia_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.evidencia_id_evidencia_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evidencia_id_evidencia_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.evidencia_id_evidencia_seq OWNED BY ggto_sync.evidencia.id_evidencia;


--
-- Name: falla_masiva; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.falla_masiva (
    id_falla bigint NOT NULL,
    id_central integer NOT NULL,
    clave_concentracion character varying(120),
    descripcion text NOT NULL,
    fecha_deteccion timestamp with time zone DEFAULT now() NOT NULL,
    origen character varying(20) DEFAULT 'AUTOMATICA'::character varying NOT NULL,
    id_sector integer,
    id_cuadrilla integer,
    estado character varying(20) DEFAULT 'DETECTADA'::character varying NOT NULL,
    planificacion text,
    reporte_simple text,
    planificada_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT falla_masiva_estado_check CHECK (((estado)::text = ANY (ARRAY[('DETECTADA'::character varying)::text, ('PLANIFICADA'::character varying)::text, ('ATENDIDA'::character varying)::text, ('CERRADA'::character varying)::text]))),
    CONSTRAINT falla_masiva_origen_check CHECK (((origen)::text = ANY (ARRAY[('AUTOMATICA'::character varying)::text, ('REPORTE_TECNICO'::character varying)::text, ('MCP'::character varying)::text])))
);


--
-- Name: falla_masiva_id_falla_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.falla_masiva_id_falla_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: falla_masiva_id_falla_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.falla_masiva_id_falla_seq OWNED BY ggto_sync.falla_masiva.id_falla;


--
-- Name: flota; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.flota (
    id_flota integer NOT NULL,
    id_central integer NOT NULL,
    can character varying(20) NOT NULL,
    tipo character varying(40),
    marca character varying(40),
    modelo character varying(40),
    placa character varying(20),
    combustible character varying(20),
    status character varying(20) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    estado_cauchos character varying(30),
    estado_fluidos character varying(30),
    estado_general character varying(30),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT flota_status_check CHECK (((status)::text = ANY (ARRAY[('DISPONIBLE'::character varying)::text, ('EN_RUTA'::character varying)::text, ('MANTENIMIENTO'::character varying)::text, ('FUERA_SERVICIO'::character varying)::text])))
);


--
-- Name: flota_id_flota_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.flota_id_flota_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flota_id_flota_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.flota_id_flota_seq OWNED BY ggto_sync.flota.id_flota;


--
-- Name: herramienta; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.herramienta (
    id_herramienta integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(120) NOT NULL,
    codigo character varying(40) NOT NULL,
    estado character varying(20) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    observacion text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT herramienta_estado_check CHECK (((estado)::text = ANY (ARRAY[('DISPONIBLE'::character varying)::text, ('ASIGNADA'::character varying)::text, ('AVERIADA'::character varying)::text, ('PERDIDA'::character varying)::text])))
);


--
-- Name: herramienta_id_herramienta_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.herramienta_id_herramienta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: herramienta_id_herramienta_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.herramienta_id_herramienta_seq OWNED BY ggto_sync.herramienta.id_herramienta;


--
-- Name: incidente; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.incidente (
    id_incidente bigint NOT NULL,
    tipo character varying(20) NOT NULL,
    id_flota integer,
    id_herramienta integer,
    descripcion text,
    id_actividad bigint,
    estado character varying(20) DEFAULT 'REPORTADO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_incidente_referencia CHECK (((id_flota IS NOT NULL) OR (id_herramienta IS NOT NULL))),
    CONSTRAINT incidente_estado_check CHECK (((estado)::text = ANY (ARRAY[('REPORTADO'::character varying)::text, ('EN_REVISION'::character varying)::text, ('RESUELTO'::character varying)::text]))),
    CONSTRAINT incidente_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('FLOTA'::character varying)::text, ('HERRAMIENTA'::character varying)::text])))
);


--
-- Name: incidente_id_incidente_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.incidente_id_incidente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidente_id_incidente_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.incidente_id_incidente_seq OWNED BY ggto_sync.incidente.id_incidente;


--
-- Name: ingesta_lote; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.ingesta_lote (
    id_lote bigint NOT NULL,
    archivo character varying(255) NOT NULL,
    fecha_archivo date,
    id_central integer,
    filas_leidas integer DEFAULT 0 NOT NULL,
    filas_central integer DEFAULT 0 NOT NULL,
    casos_nuevos integer DEFAULT 0 NOT NULL,
    casos_duplicados integer DEFAULT 0 NOT NULL,
    casos_descartados integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'PROCESANDO'::character varying NOT NULL,
    detalle_error text,
    usuario character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ingesta_lote_estado_check CHECK (((estado)::text = ANY (ARRAY[('PROCESANDO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text])))
);


--
-- Name: ingesta_lote_id_lote_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.ingesta_lote_id_lote_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingesta_lote_id_lote_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.ingesta_lote_id_lote_seq OWNED BY ggto_sync.ingesta_lote.id_lote;


--
-- Name: insumo; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.insumo (
    id_insumo integer NOT NULL,
    id_central integer,
    codigo character varying(40) NOT NULL,
    nombre character varying(120) NOT NULL,
    unidad_medida character varying(20) DEFAULT 'UNIDAD'::character varying NOT NULL,
    stock_minimo numeric(12,2) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: insumo_id_insumo_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.insumo_id_insumo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: insumo_id_insumo_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.insumo_id_insumo_seq OWNED BY ggto_sync.insumo.id_insumo;


--
-- Name: inventario_movimiento; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.inventario_movimiento (
    id_mov bigint NOT NULL,
    id_insumo integer NOT NULL,
    tipo character varying(20) NOT NULL,
    cantidad numeric(12,2) NOT NULL,
    id_orden bigint,
    id_tecnico integer,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    usuario character varying(20),
    observacion text,
    CONSTRAINT inventario_movimiento_cantidad_check CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT inventario_movimiento_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('INGRESO'::character varying)::text, ('EGRESO'::character varying)::text, ('AJUSTE'::character varying)::text])))
);


--
-- Name: inventario_movimiento_id_mov_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.inventario_movimiento_id_mov_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventario_movimiento_id_mov_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.inventario_movimiento_id_mov_seq OWNED BY ggto_sync.inventario_movimiento.id_mov;


--
-- Name: notificacion; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.notificacion (
    id_notificacion bigint NOT NULL,
    canal character varying(20) NOT NULL,
    destinatario character varying(160),
    asunto character varying(200),
    cuerpo text,
    id_caso bigint,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    error text,
    enviado_en timestamp with time zone,
    intentos smallint DEFAULT 0 NOT NULL,
    proximo_intento timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notificacion_canal_check CHECK (((canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('CORREO'::character varying)::text, ('MCP_IA'::character varying)::text]))),
    CONSTRAINT notificacion_estado_check CHECK (((estado)::text = ANY (ARRAY[('PENDIENTE'::character varying)::text, ('ENVIADO'::character varying)::text, ('FALLIDO'::character varying)::text])))
);


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.notificacion_id_notificacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.notificacion_id_notificacion_seq OWNED BY ggto_sync.notificacion.id_notificacion;


--
-- Name: orden_material; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.orden_material (
    id_orden bigint NOT NULL,
    id_caso bigint,
    id_falla bigint,
    id_cuadrilla integer,
    solicitante_usuario character varying(20),
    estado character varying(20) DEFAULT 'SOLICITADA'::character varying NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    observacion text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orden_material_estado_check CHECK (((estado)::text = ANY (ARRAY[('SOLICITADA'::character varying)::text, ('APROBADA'::character varying)::text, ('ENTREGADA'::character varying)::text, ('RECHAZADA'::character varying)::text])))
);


--
-- Name: orden_material_detalle; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.orden_material_detalle (
    id_orden_detalle bigint NOT NULL,
    id_orden bigint NOT NULL,
    id_insumo integer NOT NULL,
    cantidad_solicitada numeric(12,2) NOT NULL,
    cantidad_entregada numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT orden_material_detalle_cantidad_solicitada_check CHECK ((cantidad_solicitada > (0)::numeric))
);


--
-- Name: orden_material_detalle_id_orden_detalle_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.orden_material_detalle_id_orden_detalle_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_material_detalle_id_orden_detalle_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.orden_material_detalle_id_orden_detalle_seq OWNED BY ggto_sync.orden_material_detalle.id_orden_detalle;


--
-- Name: orden_material_id_orden_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.orden_material_id_orden_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_material_id_orden_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.orden_material_id_orden_seq OWNED BY ggto_sync.orden_material.id_orden;


--
-- Name: rol; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.rol (
    id_rol integer NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(80) NOT NULL,
    descripcion text,
    permisos jsonb DEFAULT '{}'::jsonb NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rol_id_rol_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.rol_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rol_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.rol_id_rol_seq OWNED BY ggto_sync.rol.id_rol;


--
-- Name: sector; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.sector (
    id_sector integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(120) NOT NULL,
    codigo character varying(20) NOT NULL,
    descripcion text,
    prioridad smallint DEFAULT 100 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sector_direccion; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.sector_direccion (
    id_sector_direccion integer NOT NULL,
    id_sector integer NOT NULL,
    patron character varying(160) NOT NULL,
    tipo_coincidencia character varying(20) DEFAULT 'CONTIENE'::character varying NOT NULL,
    normalizar boolean DEFAULT true NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sector_direccion_tipo_coincidencia_check CHECK (((tipo_coincidencia)::text = ANY (ARRAY[('CONTIENE'::character varying)::text, ('EXACTO'::character varying)::text, ('REGEX'::character varying)::text])))
);


--
-- Name: sector_direccion_id_sector_direccion_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.sector_direccion_id_sector_direccion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sector_direccion_id_sector_direccion_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.sector_direccion_id_sector_direccion_seq OWNED BY ggto_sync.sector_direccion.id_sector_direccion;


--
-- Name: sector_id_sector_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.sector_id_sector_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sector_id_sector_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.sector_id_sector_seq OWNED BY ggto_sync.sector.id_sector;


--
-- Name: seguimiento; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.seguimiento (
    id_seguimiento bigint NOT NULL,
    id_caso bigint NOT NULL,
    instancia_destino character varying(120) NOT NULL,
    motivo text,
    fecha_envio timestamp with time zone DEFAULT now() NOT NULL,
    fecha_retorno timestamp with time zone,
    estado character varying(20) DEFAULT 'EN_COLA'::character varying NOT NULL,
    observacion text,
    usuario character varying(20),
    CONSTRAINT seguimiento_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_COLA'::character varying)::text, ('RESUELTO'::character varying)::text, ('DEVUELTO'::character varying)::text])))
);


--
-- Name: seguimiento_id_seguimiento_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.seguimiento_id_seguimiento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seguimiento_id_seguimiento_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.seguimiento_id_seguimiento_seq OWNED BY ggto_sync.seguimiento.id_seguimiento;


--
-- Name: seq_caso_ref; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.seq_caso_ref
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sincronizacion; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.sincronizacion (
    id_sync bigint NOT NULL,
    id_dispositivo bigint,
    id_tecnico integer,
    inicio timestamp with time zone DEFAULT now() NOT NULL,
    fin timestamp with time zone,
    casos_descargados integer DEFAULT 0 NOT NULL,
    actividades_subidas integer DEFAULT 0 NOT NULL,
    evidencias_subidas integer DEFAULT 0 NOT NULL,
    archivo_zip character varying(160),
    estado character varying(20) DEFAULT 'EN_PROCESO'::character varying NOT NULL,
    detalle_json jsonb,
    CONSTRAINT sincronizacion_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_PROCESO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text])))
);


--
-- Name: sincronizacion_id_sync_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.sincronizacion_id_sync_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sincronizacion_id_sync_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.sincronizacion_id_sync_seq OWNED BY ggto_sync.sincronizacion.id_sync;


--
-- Name: solicitante; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.solicitante (
    id_solicitante integer NOT NULL,
    unidad character varying(120) NOT NULL,
    nombre character varying(120) NOT NULL,
    contacto character varying(60) NOT NULL,
    canal character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT solicitante_canal_check CHECK (((canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('MCP_IA'::character varying)::text, ('MANUAL'::character varying)::text, ('CORREO'::character varying)::text])))
);


--
-- Name: solicitante_id_solicitante_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.solicitante_id_solicitante_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitante_id_solicitante_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.solicitante_id_solicitante_seq OWNED BY ggto_sync.solicitante.id_solicitante;


--
-- Name: sync_log; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.sync_log (
    id_sync_log bigint NOT NULL,
    p00 character varying(20) NOT NULL,
    id_cuadrilla integer,
    tipo character varying(20) NOT NULL,
    dispositivo_id character varying(80),
    version_app character varying(20),
    iniciado_en timestamp with time zone DEFAULT now() NOT NULL,
    finalizado_en timestamp with time zone,
    recibidos integer DEFAULT 0 NOT NULL,
    procesados integer DEFAULT 0 NOT NULL,
    errores integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'EN_PROCESO'::character varying NOT NULL,
    detalle jsonb,
    CONSTRAINT sync_log_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_PROCESO'::character varying)::text, ('OK'::character varying)::text, ('PARCIAL'::character varying)::text, ('ERROR'::character varying)::text]))),
    CONSTRAINT sync_log_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('DESCARGA'::character varying)::text, ('CARGA'::character varying)::text])))
);


--
-- Name: sync_log_id_sync_log_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.sync_log_id_sync_log_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_log_id_sync_log_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.sync_log_id_sync_log_seq OWNED BY ggto_sync.sync_log.id_sync_log;


--
-- Name: tecnico; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.tecnico (
    id_tecnico integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(80) NOT NULL,
    apellido character varying(80),
    cedula character varying(20),
    p00 character varying(20) NOT NULL,
    telefono character varying(30),
    correo character varying(120),
    especialidad character varying(80),
    status character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tecnico_status_check CHECK (((status)::text = ANY (ARRAY[('ACTIVO'::character varying)::text, ('INACTIVO'::character varying)::text, ('VACACIONES'::character varying)::text, ('SUSPENDIDO'::character varying)::text])))
);


--
-- Name: tecnico_id_tecnico_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.tecnico_id_tecnico_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tecnico_id_tecnico_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.tecnico_id_tecnico_seq OWNED BY ggto_sync.tecnico.id_tecnico;


--
-- Name: usuario; Type: TABLE; Schema: ggto_sync; Owner: -
--

CREATE TABLE ggto_sync.usuario (
    id_usuario integer NOT NULL,
    p00 character varying(20) NOT NULL,
    correo character varying(120),
    clave_hash character varying(255) NOT NULL,
    id_rol integer NOT NULL,
    id_tecnico integer,
    id_central integer,
    intentos_fallidos smallint DEFAULT 0 NOT NULL,
    bloqueado boolean DEFAULT false NOT NULL,
    bloqueo_cliente boolean DEFAULT false NOT NULL,
    requiere_cambio_clave boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    ultimo_acceso timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE; Schema: ggto_sync; Owner: -
--

CREATE SEQUENCE ggto_sync.usuario_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: ggto_sync; Owner: -
--

ALTER SEQUENCE ggto_sync.usuario_id_usuario_seq OWNED BY ggto_sync.usuario.id_usuario;


--
-- Name: actividad; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.actividad (
    id_actividad bigint NOT NULL,
    id_caso bigint NOT NULL,
    id_usuario integer,
    id_cuadrilla integer,
    tipo character varying(20) NOT NULL,
    resultado character varying(20),
    reporte_corto text,
    id_metodo integer,
    id_causa integer,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    latitud numeric(10,7),
    longitud numeric(10,7),
    sincronizado boolean DEFAULT false NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT actividad_resultado_check CHECK (((resultado)::text = ANY (ARRAY[('CONTACTADO'::character varying)::text, ('CERRADO'::character varying)::text, ('ENRUTADO'::character varying)::text, ('DIFERIDO'::character varying)::text]))),
    CONSTRAINT actividad_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('CONTACTO'::character varying)::text, ('CIERRE'::character varying)::text, ('ENRUTE'::character varying)::text, ('DIFERIDO'::character varying)::text, ('INCIDENTE'::character varying)::text, ('FALLA_MASIVA'::character varying)::text])))
);


--
-- Name: actividad_id_actividad_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.actividad_id_actividad_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: actividad_id_actividad_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.actividad_id_actividad_seq OWNED BY ggto_test.actividad.id_actividad;


--
-- Name: auditoria; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.auditoria (
    id_auditoria bigint NOT NULL,
    usuario character varying(20),
    accion character varying(60) NOT NULL,
    entidad character varying(60),
    id_entidad character varying(40),
    datos_antes jsonb,
    datos_despues jsonb,
    ip inet,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.auditoria_id_auditoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.auditoria_id_auditoria_seq OWNED BY ggto_test.auditoria.id_auditoria;


--
-- Name: caso; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.caso (
    id_caso bigint NOT NULL,
    id_central integer NOT NULL,
    id_averia character varying(30) NOT NULL,
    origen character varying(20) DEFAULT 'INGESTA_CSV'::character varying NOT NULL,
    tipo_caso character varying(20) DEFAULT 'AVERIA'::character varying NOT NULL,
    categoria character varying(20) DEFAULT 'RESIDENCIAL'::character varying NOT NULL,
    estado_actual character varying(20) DEFAULT 'NUEVO'::character varying NOT NULL,
    id_sector integer,
    id_causa integer,
    id_lote_ingesta bigint,
    en_gestion_supervisor boolean DEFAULT false NOT NULL,
    es_falla_masiva boolean DEFAULT false NOT NULL,
    creado_por character varying(20),
    region character varying(80),
    estado_geografico character varying(80),
    capital_estado character varying(80),
    municipio character varying(80),
    parroquia character varying(80),
    estado_operativo character varying(80),
    distrito character varying(40),
    area character varying(20),
    codigo_central character varying(20),
    nombre_central character varying(120),
    telefono character varying(30),
    fecha_reporte timestamp with time zone,
    persona_reporta character varying(120),
    contacto_cliente character varying(60),
    fecha_compromiso timestamp with time zone,
    fecha_cita timestamp with time zone,
    ultimo_comentario text,
    results text,
    asignado_a character varying(60),
    cuadrilla_externa character varying(40),
    estatus_origen character varying(20),
    problema_reporte text,
    informacion text,
    nombre_cliente character varying(160),
    direccion text,
    olt character varying(40),
    plan character varying(60),
    slot character varying(10),
    puerto character varying(10),
    fat character varying(80),
    serial character varying(60),
    extra character varying(120),
    area_trabajo character varying(40),
    tipo_servicio character varying(40),
    tipo_problema character varying(20),
    dias_area_resolutoria integer,
    unidad_negocio character varying(40),
    ups character varying(10),
    codigos_gestionados_venapp character varying(60),
    codigos_sin_gestion_venapp character varying(60),
    reparador_principal character varying(20),
    ayudantes jsonb DEFAULT '[]'::jsonb NOT NULL,
    flota_can character varying(20),
    despacho_nombre character varying(80),
    despacho_apellido character varying(80),
    telefono_oficina character varying(30),
    telefono_movil character varying(30),
    fecha_hora_asignacion timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caso_categoria_check CHECK (((categoria)::text = ANY (ARRAY[('RESIDENCIAL'::character varying)::text, ('EMPRESA'::character varying)::text, ('REFERIDO'::character varying)::text, ('GOBIERNO'::character varying)::text]))),
    CONSTRAINT caso_estado_actual_check CHECK (((estado_actual)::text = ANY (ARRAY[('NUEVO'::character varying)::text, ('ASIGNADO'::character varying)::text, ('CONTACTADO'::character varying)::text, ('CITADO'::character varying)::text, ('DIFERIDO'::character varying)::text, ('EN_GESTION'::character varying)::text, ('ENRUTADO'::character varying)::text, ('CERRADO'::character varying)::text, ('CANCELADO'::character varying)::text]))),
    CONSTRAINT caso_origen_check CHECK (((origen)::text = ANY (ARRAY[('INGESTA_CSV'::character varying)::text, ('MANUAL'::character varying)::text, ('TELEGRAM'::character varying)::text, ('MCP_IA'::character varying)::text]))),
    CONSTRAINT caso_tipo_caso_check CHECK (((tipo_caso)::text = ANY (ARRAY[('AVERIA'::character varying)::text, ('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text])))
);

ALTER TABLE ONLY ggto_test.caso FORCE ROW LEVEL SECURITY;


--
-- Name: caso_especial; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.caso_especial (
    id_caso_especial integer NOT NULL,
    id_caso bigint,
    id_solicitante integer,
    clasificacion character varying(20) NOT NULL,
    tipo_actividad character varying(20) NOT NULL,
    prioridad character varying(20) DEFAULT 'MEDIA'::character varying NOT NULL,
    tiene_id_averia boolean DEFAULT false NOT NULL,
    descripcion text,
    requiere_informe boolean DEFAULT true NOT NULL,
    estado character varying(20) DEFAULT 'ABIERTO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caso_especial_clasificacion_check CHECK (((clasificacion)::text = ANY (ARRAY[('REFERIDO'::character varying)::text, ('EMPRESA'::character varying)::text, ('GOBIERNO'::character varying)::text]))),
    CONSTRAINT caso_especial_estado_check CHECK (((estado)::text = ANY (ARRAY[('ABIERTO'::character varying)::text, ('EN_PROCESO'::character varying)::text, ('ATENDIDO'::character varying)::text, ('CERRADO'::character varying)::text]))),
    CONSTRAINT caso_especial_prioridad_check CHECK (((prioridad)::text = ANY (ARRAY[('ALTA'::character varying)::text, ('MEDIA'::character varying)::text, ('BAJA'::character varying)::text]))),
    CONSTRAINT caso_especial_tipo_actividad_check CHECK (((tipo_actividad)::text = ANY (ARRAY[('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text])))
);


--
-- Name: caso_especial_id_caso_especial_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.caso_especial_id_caso_especial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_especial_id_caso_especial_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.caso_especial_id_caso_especial_seq OWNED BY ggto_test.caso_especial.id_caso_especial;


--
-- Name: caso_estado_hist; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.caso_estado_hist (
    id_hist bigint NOT NULL,
    id_caso bigint NOT NULL,
    estado_anterior character varying(20),
    estado_nuevo character varying(20) NOT NULL,
    motivo text,
    usuario character varying(20),
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: caso_estado_hist_id_hist_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.caso_estado_hist_id_hist_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_estado_hist_id_hist_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.caso_estado_hist_id_hist_seq OWNED BY ggto_test.caso_estado_hist.id_hist;


--
-- Name: caso_id_caso_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.caso_id_caso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_id_caso_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.caso_id_caso_seq OWNED BY ggto_test.caso.id_caso;


--
-- Name: catalogo_metodo; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.catalogo_metodo (
    id_metodo integer NOT NULL,
    dominio character varying(20) NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(120) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT catalogo_metodo_dominio_check CHECK (((dominio)::text = ANY (ARRAY[('CIERRE'::character varying)::text, ('ENRUTE'::character varying)::text, ('DIFERIDO'::character varying)::text, ('CONTACTO'::character varying)::text])))
);


--
-- Name: catalogo_metodo_id_metodo_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.catalogo_metodo_id_metodo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catalogo_metodo_id_metodo_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.catalogo_metodo_id_metodo_seq OWNED BY ggto_test.catalogo_metodo.id_metodo;


--
-- Name: causa; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.causa (
    id_causa integer NOT NULL,
    codigo_causa character varying(20) NOT NULL,
    subcodigo_causa character varying(20) DEFAULT ''::character varying NOT NULL,
    descripcion character varying(255),
    descripcion_subcodigo character varying(255),
    tipo character varying(20),
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: causa_id_causa_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.causa_id_causa_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: causa_id_causa_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.causa_id_causa_seq OWNED BY ggto_test.causa.id_causa;


--
-- Name: central; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.central (
    id_central integer NOT NULL,
    region character varying(80) NOT NULL,
    estado_geografico character varying(80) NOT NULL,
    capital_estado character varying(80),
    municipio character varying(80) NOT NULL,
    parroquia character varying(80) NOT NULL,
    estado_operativo character varying(80),
    distrito character varying(40),
    area character varying(20) NOT NULL,
    codigo_central character varying(20) NOT NULL,
    nombre_central character varying(120) NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: central_id_central_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.central_id_central_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: central_id_central_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.central_id_central_seq OWNED BY ggto_test.central.id_central;


--
-- Name: cita; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.cita (
    id_cita bigint NOT NULL,
    id_caso bigint,
    id_caso_especial integer,
    id_cuadrilla integer,
    fecha_hora timestamp with time zone NOT NULL,
    tipo character varying(20) DEFAULT 'CONTACTO'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'PROPUESTA'::character varying NOT NULL,
    observacion text,
    creado_por character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    recordatorio_para timestamp with time zone,
    CONSTRAINT cita_estado_check CHECK (((estado)::text = ANY (ARRAY[('PROPUESTA'::character varying)::text, ('CONFIRMADA'::character varying)::text, ('CUMPLIDA'::character varying)::text, ('REPROGRAMADA'::character varying)::text, ('DIFERIDA'::character varying)::text, ('CANCELADA'::character varying)::text]))),
    CONSTRAINT cita_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('CONTACTO'::character varying)::text, ('ATENCION'::character varying)::text]))),
    CONSTRAINT ck_cita_referencia CHECK (((id_caso IS NOT NULL) OR (id_caso_especial IS NOT NULL)))
);


--
-- Name: cita_id_cita_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.cita_id_cita_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cita_id_cita_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.cita_id_cita_seq OWNED BY ggto_test.cita.id_cita;


--
-- Name: configuracion; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.configuracion (
    clave character varying(80) NOT NULL,
    valor jsonb NOT NULL,
    descripcion text,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.cuadrilla (
    id_cuadrilla integer NOT NULL,
    id_central integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(80) NOT NULL,
    id_flota integer,
    es_supervisor boolean DEFAULT false NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla_herramienta; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.cuadrilla_herramienta (
    id_cuadrilla integer NOT NULL,
    id_herramienta integer NOT NULL,
    asignada_en timestamp with time zone DEFAULT now() NOT NULL,
    devuelta_en timestamp with time zone
);


--
-- Name: cuadrilla_id_cuadrilla_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.cuadrilla_id_cuadrilla_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuadrilla_id_cuadrilla_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.cuadrilla_id_cuadrilla_seq OWNED BY ggto_test.cuadrilla.id_cuadrilla;


--
-- Name: cuadrilla_sector_dia; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.cuadrilla_sector_dia (
    id_asignacion bigint NOT NULL,
    id_central integer NOT NULL,
    fecha date NOT NULL,
    id_cuadrilla integer NOT NULL,
    id_sector integer NOT NULL,
    usuario character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla_sector_dia_id_asignacion_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.cuadrilla_sector_dia_id_asignacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuadrilla_sector_dia_id_asignacion_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.cuadrilla_sector_dia_id_asignacion_seq OWNED BY ggto_test.cuadrilla_sector_dia.id_asignacion;


--
-- Name: cuadrilla_tecnico; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.cuadrilla_tecnico (
    id_cuadrilla integer NOT NULL,
    id_tecnico integer NOT NULL,
    desde date DEFAULT CURRENT_DATE NOT NULL,
    rol_cuadrilla character varying(30) DEFAULT 'REPARADOR_PRINCIPAL'::character varying NOT NULL,
    hasta date,
    CONSTRAINT cuadrilla_tecnico_rol_cuadrilla_check CHECK (((rol_cuadrilla)::text = ANY (ARRAY[('REPARADOR_PRINCIPAL'::character varying)::text, ('AYUDANTE'::character varying)::text, ('SUPERVISOR'::character varying)::text])))
);


--
-- Name: despacho; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.despacho (
    id_despacho bigint NOT NULL,
    id_central integer NOT NULL,
    fecha date NOT NULL,
    id_cuadrilla integer NOT NULL,
    estado character varying(20) DEFAULT 'BORRADOR'::character varying NOT NULL,
    generado_auto boolean DEFAULT false NOT NULL,
    enviado_canal character varying(20),
    enviado_en timestamp with time zone,
    reporte_produccion_en timestamp with time zone,
    usuario_crea character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT despacho_enviado_canal_check CHECK (((enviado_canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('CORREO'::character varying)::text]))),
    CONSTRAINT despacho_estado_check CHECK (((estado)::text = ANY (ARRAY[('BORRADOR'::character varying)::text, ('PUBLICADO'::character varying)::text, ('CERRADO'::character varying)::text])))
);

ALTER TABLE ONLY ggto_test.despacho FORCE ROW LEVEL SECURITY;


--
-- Name: despacho_caso; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.despacho_caso (
    id_despacho_caso bigint NOT NULL,
    id_despacho bigint NOT NULL,
    id_caso bigint NOT NULL,
    id_sector integer,
    orden_visita smallint,
    tipo_asignacion character varying(20),
    estado character varying(20) DEFAULT 'ASIGNADO'::character varying NOT NULL,
    observacion text,
    CONSTRAINT despacho_caso_estado_check CHECK (((estado)::text = ANY (ARRAY[('ASIGNADO'::character varying)::text, ('GESTIONADO'::character varying)::text, ('CERRADO'::character varying)::text, ('CITADO'::character varying)::text, ('DIFERIDO'::character varying)::text]))),
    CONSTRAINT despacho_caso_tipo_asignacion_check CHECK (((tipo_asignacion)::text = ANY (ARRAY[('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text, ('REFERIDO'::character varying)::text, ('EMPRESA'::character varying)::text, ('FALLA_MASIVA'::character varying)::text])))
);


--
-- Name: despacho_caso_id_despacho_caso_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.despacho_caso_id_despacho_caso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: despacho_caso_id_despacho_caso_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.despacho_caso_id_despacho_caso_seq OWNED BY ggto_test.despacho_caso.id_despacho_caso;


--
-- Name: despacho_id_despacho_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.despacho_id_despacho_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: despacho_id_despacho_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.despacho_id_despacho_seq OWNED BY ggto_test.despacho.id_despacho;


--
-- Name: dispositivo_seguridad; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.dispositivo_seguridad (
    id_dispositivo bigint NOT NULL,
    p00 character varying(20) NOT NULL,
    palabras_hash jsonb DEFAULT '[]'::jsonb NOT NULL,
    clave_privada_ref character varying(255),
    documento_cifrado text,
    bloqueado boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dispositivo_seguridad_id_dispositivo_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.dispositivo_seguridad_id_dispositivo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dispositivo_seguridad_id_dispositivo_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.dispositivo_seguridad_id_dispositivo_seq OWNED BY ggto_test.dispositivo_seguridad.id_dispositivo;


--
-- Name: evidencia; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.evidencia (
    id_evidencia bigint NOT NULL,
    id_actividad bigint,
    tipo character varying(20) NOT NULL,
    serial_imagen character varying(160) NOT NULL,
    ruta_local character varying(255),
    ruta_remota character varying(255),
    latitud numeric(10,7),
    longitud numeric(10,7),
    fecha_hora timestamp with time zone NOT NULL,
    origen_camara boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT evidencia_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('POTENCIA'::character varying)::text, ('NAVEGACION'::character varying)::text, ('DEMO'::character varying)::text, ('FALLA_MASIVA'::character varying)::text])))
);


--
-- Name: evidencia_id_evidencia_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.evidencia_id_evidencia_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evidencia_id_evidencia_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.evidencia_id_evidencia_seq OWNED BY ggto_test.evidencia.id_evidencia;


--
-- Name: falla_masiva; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.falla_masiva (
    id_falla bigint NOT NULL,
    id_central integer NOT NULL,
    clave_concentracion character varying(120),
    descripcion text NOT NULL,
    fecha_deteccion timestamp with time zone DEFAULT now() NOT NULL,
    origen character varying(20) DEFAULT 'AUTOMATICA'::character varying NOT NULL,
    id_sector integer,
    id_cuadrilla integer,
    estado character varying(20) DEFAULT 'DETECTADA'::character varying NOT NULL,
    odn character varying(60),
    direccion character varying(200),
    fat character varying(60),
    evidencias text,
    planificacion text,
    reporte_simple text,
    planificada_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT falla_masiva_estado_check CHECK (((estado)::text = ANY (ARRAY[('DETECTADA'::character varying)::text, ('PLANIFICADA'::character varying)::text, ('ATENDIDA'::character varying)::text, ('CERRADA'::character varying)::text]))),
    CONSTRAINT falla_masiva_origen_check CHECK (((origen)::text = ANY (ARRAY[('AUTOMATICA'::character varying)::text, ('REPORTE_TECNICO'::character varying)::text, ('MCP'::character varying)::text])))
);


--
-- Name: falla_masiva_id_falla_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.falla_masiva_id_falla_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: falla_masiva_id_falla_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.falla_masiva_id_falla_seq OWNED BY ggto_test.falla_masiva.id_falla;


--
-- Name: flota; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.flota (
    id_flota integer NOT NULL,
    id_central integer NOT NULL,
    can character varying(20) NOT NULL,
    tipo character varying(40),
    marca character varying(40),
    modelo character varying(40),
    placa character varying(20),
    combustible character varying(20),
    status character varying(20) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    estado_cauchos character varying(30),
    estado_fluidos character varying(30),
    estado_general character varying(30),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT flota_status_check CHECK (((status)::text = ANY (ARRAY[('DISPONIBLE'::character varying)::text, ('EN_RUTA'::character varying)::text, ('MANTENIMIENTO'::character varying)::text, ('FUERA_SERVICIO'::character varying)::text])))
);


--
-- Name: flota_id_flota_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.flota_id_flota_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flota_id_flota_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.flota_id_flota_seq OWNED BY ggto_test.flota.id_flota;


--
-- Name: herramienta; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.herramienta (
    id_herramienta integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(120) NOT NULL,
    codigo character varying(40) NOT NULL,
    estado character varying(20) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    observacion text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT herramienta_estado_check CHECK (((estado)::text = ANY (ARRAY[('DISPONIBLE'::character varying)::text, ('ASIGNADA'::character varying)::text, ('AVERIADA'::character varying)::text, ('PERDIDA'::character varying)::text])))
);


--
-- Name: herramienta_id_herramienta_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.herramienta_id_herramienta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: herramienta_id_herramienta_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.herramienta_id_herramienta_seq OWNED BY ggto_test.herramienta.id_herramienta;


--
-- Name: incidente; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.incidente (
    id_incidente bigint NOT NULL,
    tipo character varying(20) NOT NULL,
    id_flota integer,
    id_herramienta integer,
    descripcion text,
    id_actividad bigint,
    estado character varying(20) DEFAULT 'REPORTADO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_incidente_referencia CHECK (((id_flota IS NOT NULL) OR (id_herramienta IS NOT NULL))),
    CONSTRAINT incidente_estado_check CHECK (((estado)::text = ANY (ARRAY[('REPORTADO'::character varying)::text, ('EN_REVISION'::character varying)::text, ('RESUELTO'::character varying)::text]))),
    CONSTRAINT incidente_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('FLOTA'::character varying)::text, ('HERRAMIENTA'::character varying)::text])))
);


--
-- Name: incidente_id_incidente_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.incidente_id_incidente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidente_id_incidente_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.incidente_id_incidente_seq OWNED BY ggto_test.incidente.id_incidente;


--
-- Name: ingesta_lote; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.ingesta_lote (
    id_lote bigint NOT NULL,
    archivo character varying(255) NOT NULL,
    fecha_archivo date,
    id_central integer,
    filas_leidas integer DEFAULT 0 NOT NULL,
    filas_central integer DEFAULT 0 NOT NULL,
    casos_nuevos integer DEFAULT 0 NOT NULL,
    casos_duplicados integer DEFAULT 0 NOT NULL,
    casos_descartados integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'PROCESANDO'::character varying NOT NULL,
    detalle_error text,
    usuario character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ingesta_lote_estado_check CHECK (((estado)::text = ANY (ARRAY[('PROCESANDO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text])))
);


--
-- Name: ingesta_lote_id_lote_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.ingesta_lote_id_lote_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingesta_lote_id_lote_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.ingesta_lote_id_lote_seq OWNED BY ggto_test.ingesta_lote.id_lote;


--
-- Name: insumo; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.insumo (
    id_insumo integer NOT NULL,
    id_central integer,
    codigo character varying(40) NOT NULL,
    nombre character varying(120) NOT NULL,
    unidad_medida character varying(20) DEFAULT 'UNIDAD'::character varying NOT NULL,
    stock_minimo numeric(12,2) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: insumo_id_insumo_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.insumo_id_insumo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: insumo_id_insumo_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.insumo_id_insumo_seq OWNED BY ggto_test.insumo.id_insumo;


--
-- Name: inventario_movimiento; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.inventario_movimiento (
    id_mov bigint NOT NULL,
    id_insumo integer NOT NULL,
    tipo character varying(20) NOT NULL,
    cantidad numeric(12,2) NOT NULL,
    id_orden bigint,
    id_tecnico integer,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    usuario character varying(20),
    observacion text,
    CONSTRAINT inventario_movimiento_cantidad_check CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT inventario_movimiento_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('INGRESO'::character varying)::text, ('EGRESO'::character varying)::text, ('AJUSTE'::character varying)::text])))
);


--
-- Name: inventario_movimiento_id_mov_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.inventario_movimiento_id_mov_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventario_movimiento_id_mov_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.inventario_movimiento_id_mov_seq OWNED BY ggto_test.inventario_movimiento.id_mov;


--
-- Name: mensaje; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.mensaje (
    id_mensaje bigint NOT NULL,
    id_central integer NOT NULL,
    origen_p00 character varying(20),
    destino_tipo character varying(12) NOT NULL,
    id_cuadrilla integer,
    id_tecnico integer,
    tipo character varying(20) NOT NULL,
    cuerpo character varying(500) NOT NULL,
    id_caso bigint,
    dedupe_key character varying(80),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone DEFAULT (now() + '5 days'::interval) NOT NULL,
    CONSTRAINT mensaje_check CHECK ((expira_en > creado_en)),
    CONSTRAINT mensaje_check1 CHECK (((((destino_tipo)::text = 'TODOS'::text) AND (id_cuadrilla IS NULL) AND (id_tecnico IS NULL)) OR (((destino_tipo)::text = 'CUADRILLA'::text) AND (id_cuadrilla IS NOT NULL) AND (id_tecnico IS NULL)) OR (((destino_tipo)::text = 'TECNICO'::text) AND (id_tecnico IS NOT NULL) AND (id_cuadrilla IS NULL)))),
    CONSTRAINT mensaje_destino_tipo_check CHECK (((destino_tipo)::text = ANY (ARRAY[('TODOS'::character varying)::text, ('CUADRILLA'::character varying)::text, ('TECNICO'::character varying)::text]))),
    CONSTRAINT mensaje_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('RECORDATORIO_CITA'::character varying)::text, ('ESTADO_SYNC'::character varying)::text, ('ALARMA_DESPACHO'::character varying)::text, ('TEXTO'::character varying)::text])))
);


--
-- Name: mensaje_destino; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.mensaje_destino (
    id_mensaje bigint NOT NULL,
    id_tecnico integer NOT NULL,
    leido_en timestamp with time zone
);


--
-- Name: mensaje_id_mensaje_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.mensaje_id_mensaje_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mensaje_id_mensaje_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.mensaje_id_mensaje_seq OWNED BY ggto_test.mensaje.id_mensaje;


--
-- Name: notificacion; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.notificacion (
    id_notificacion bigint NOT NULL,
    canal character varying(20) NOT NULL,
    destinatario character varying(160),
    asunto character varying(200),
    cuerpo text,
    id_caso bigint,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    error text,
    enviado_en timestamp with time zone,
    intentos smallint DEFAULT 0 NOT NULL,
    proximo_intento timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notificacion_canal_check CHECK (((canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('CORREO'::character varying)::text, ('MCP_IA'::character varying)::text]))),
    CONSTRAINT notificacion_estado_check CHECK (((estado)::text = ANY (ARRAY[('PENDIENTE'::character varying)::text, ('ENVIADO'::character varying)::text, ('FALLIDO'::character varying)::text])))
);


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.notificacion_id_notificacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.notificacion_id_notificacion_seq OWNED BY ggto_test.notificacion.id_notificacion;


--
-- Name: orden_material; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.orden_material (
    id_orden bigint NOT NULL,
    id_caso bigint,
    id_falla bigint,
    id_cuadrilla integer,
    solicitante_usuario character varying(20),
    estado character varying(20) DEFAULT 'SOLICITADA'::character varying NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    observacion text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orden_material_estado_check CHECK (((estado)::text = ANY (ARRAY[('SOLICITADA'::character varying)::text, ('APROBADA'::character varying)::text, ('ENTREGADA'::character varying)::text, ('RECHAZADA'::character varying)::text])))
);


--
-- Name: orden_material_detalle; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.orden_material_detalle (
    id_orden_detalle bigint NOT NULL,
    id_orden bigint NOT NULL,
    id_insumo integer NOT NULL,
    cantidad_solicitada numeric(12,2) NOT NULL,
    cantidad_entregada numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT orden_material_detalle_cantidad_solicitada_check CHECK ((cantidad_solicitada > (0)::numeric))
);


--
-- Name: orden_material_detalle_id_orden_detalle_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.orden_material_detalle_id_orden_detalle_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_material_detalle_id_orden_detalle_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.orden_material_detalle_id_orden_detalle_seq OWNED BY ggto_test.orden_material_detalle.id_orden_detalle;


--
-- Name: orden_material_id_orden_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.orden_material_id_orden_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_material_id_orden_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.orden_material_id_orden_seq OWNED BY ggto_test.orden_material.id_orden;


--
-- Name: rol; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.rol (
    id_rol integer NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(80) NOT NULL,
    descripcion text,
    permisos jsonb DEFAULT '{}'::jsonb NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rol_id_rol_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.rol_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rol_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.rol_id_rol_seq OWNED BY ggto_test.rol.id_rol;


--
-- Name: sector; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.sector (
    id_sector integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(120) NOT NULL,
    codigo character varying(20) NOT NULL,
    descripcion text,
    prioridad smallint DEFAULT 100 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sector_direccion; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.sector_direccion (
    id_sector_direccion integer NOT NULL,
    id_sector integer NOT NULL,
    patron character varying(160) NOT NULL,
    tipo_coincidencia character varying(20) DEFAULT 'CONTIENE'::character varying NOT NULL,
    normalizar boolean DEFAULT true NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sector_direccion_tipo_coincidencia_check CHECK (((tipo_coincidencia)::text = ANY (ARRAY[('CONTIENE'::character varying)::text, ('EXACTO'::character varying)::text, ('REGEX'::character varying)::text])))
);


--
-- Name: sector_direccion_id_sector_direccion_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.sector_direccion_id_sector_direccion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sector_direccion_id_sector_direccion_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.sector_direccion_id_sector_direccion_seq OWNED BY ggto_test.sector_direccion.id_sector_direccion;


--
-- Name: sector_id_sector_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.sector_id_sector_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sector_id_sector_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.sector_id_sector_seq OWNED BY ggto_test.sector.id_sector;


--
-- Name: seguimiento; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.seguimiento (
    id_seguimiento bigint NOT NULL,
    id_caso bigint NOT NULL,
    instancia_destino character varying(120) NOT NULL,
    motivo text,
    fecha_envio timestamp with time zone DEFAULT now() NOT NULL,
    fecha_retorno timestamp with time zone,
    estado character varying(20) DEFAULT 'EN_COLA'::character varying NOT NULL,
    observacion text,
    usuario character varying(20),
    CONSTRAINT seguimiento_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_COLA'::character varying)::text, ('RESUELTO'::character varying)::text, ('DEVUELTO'::character varying)::text])))
);


--
-- Name: seguimiento_id_seguimiento_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.seguimiento_id_seguimiento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seguimiento_id_seguimiento_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.seguimiento_id_seguimiento_seq OWNED BY ggto_test.seguimiento.id_seguimiento;


--
-- Name: seq_caso_ref; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.seq_caso_ref
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sincronizacion; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.sincronizacion (
    id_sync bigint NOT NULL,
    id_dispositivo bigint,
    id_tecnico integer,
    inicio timestamp with time zone DEFAULT now() NOT NULL,
    fin timestamp with time zone,
    casos_descargados integer DEFAULT 0 NOT NULL,
    actividades_subidas integer DEFAULT 0 NOT NULL,
    evidencias_subidas integer DEFAULT 0 NOT NULL,
    archivo_zip character varying(160),
    estado character varying(20) DEFAULT 'EN_PROCESO'::character varying NOT NULL,
    detalle_json jsonb,
    CONSTRAINT sincronizacion_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_PROCESO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text])))
);


--
-- Name: sincronizacion_id_sync_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.sincronizacion_id_sync_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sincronizacion_id_sync_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.sincronizacion_id_sync_seq OWNED BY ggto_test.sincronizacion.id_sync;


--
-- Name: solicitante; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.solicitante (
    id_solicitante integer NOT NULL,
    unidad character varying(120) NOT NULL,
    nombre character varying(120) NOT NULL,
    contacto character varying(60) NOT NULL,
    canal character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT solicitante_canal_check CHECK (((canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('MCP_IA'::character varying)::text, ('MANUAL'::character varying)::text, ('CORREO'::character varying)::text])))
);


--
-- Name: solicitante_id_solicitante_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.solicitante_id_solicitante_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitante_id_solicitante_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.solicitante_id_solicitante_seq OWNED BY ggto_test.solicitante.id_solicitante;


--
-- Name: sync_check; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.sync_check (
    id_sync_check bigint NOT NULL,
    id_sync_log bigint NOT NULL,
    paso character varying(12) NOT NULL,
    estado character varying(12) NOT NULL,
    fecha_hora timestamp with time zone,
    detalle jsonb,
    CONSTRAINT sync_check_estado_check CHECK (((estado)::text = ANY (ARRAY[('PENDIENTE'::character varying)::text, ('EN_CURSO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text, ('OMITIDO'::character varying)::text]))),
    CONSTRAINT sync_check_paso_check CHECK (((paso)::text = ANY (ARRAY[('CONEXION'::character varying)::text, ('LOGIN'::character varying)::text, ('DESCARGA'::character varying)::text, ('CARGA'::character varying)::text])))
);


--
-- Name: sync_check_id_sync_check_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.sync_check_id_sync_check_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_check_id_sync_check_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.sync_check_id_sync_check_seq OWNED BY ggto_test.sync_check.id_sync_check;


--
-- Name: sync_log; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.sync_log (
    id_sync_log bigint NOT NULL,
    p00 character varying(20) NOT NULL,
    id_cuadrilla integer,
    tipo character varying(20) NOT NULL,
    dispositivo_id character varying(80),
    version_app character varying(20),
    iniciado_en timestamp with time zone DEFAULT now() NOT NULL,
    finalizado_en timestamp with time zone,
    recibidos integer DEFAULT 0 NOT NULL,
    procesados integer DEFAULT 0 NOT NULL,
    errores integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'EN_PROCESO'::character varying NOT NULL,
    detalle jsonb,
    plataforma character varying(20) DEFAULT 'APK'::character varying NOT NULL,
    duracion_ms integer,
    id_central integer,
    CONSTRAINT sync_log_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_PROCESO'::character varying)::text, ('OK'::character varying)::text, ('PARCIAL'::character varying)::text, ('ERROR'::character varying)::text]))),
    CONSTRAINT sync_log_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('DESCARGA'::character varying)::text, ('CARGA'::character varying)::text])))
);


--
-- Name: sync_log_id_sync_log_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.sync_log_id_sync_log_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_log_id_sync_log_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.sync_log_id_sync_log_seq OWNED BY ggto_test.sync_log.id_sync_log;


--
-- Name: tecnico; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.tecnico (
    id_tecnico integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(80) NOT NULL,
    apellido character varying(80),
    cedula character varying(20),
    p00 character varying(20) NOT NULL,
    telefono character varying(30),
    correo character varying(120),
    especialidad character varying(80),
    status character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tecnico_status_check CHECK (((status)::text = ANY (ARRAY[('ACTIVO'::character varying)::text, ('INACTIVO'::character varying)::text, ('VACACIONES'::character varying)::text, ('SUSPENDIDO'::character varying)::text])))
);


--
-- Name: tecnico_id_tecnico_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.tecnico_id_tecnico_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tecnico_id_tecnico_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.tecnico_id_tecnico_seq OWNED BY ggto_test.tecnico.id_tecnico;


--
-- Name: usuario; Type: TABLE; Schema: ggto_test; Owner: -
--

CREATE TABLE ggto_test.usuario (
    id_usuario integer NOT NULL,
    p00 character varying(20) NOT NULL,
    correo character varying(120),
    clave_hash character varying(255) NOT NULL,
    id_rol integer NOT NULL,
    id_tecnico integer,
    id_central integer,
    intentos_fallidos smallint DEFAULT 0 NOT NULL,
    bloqueado boolean DEFAULT false NOT NULL,
    bloqueo_cliente boolean DEFAULT false NOT NULL,
    requiere_cambio_clave boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    ultimo_acceso timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE; Schema: ggto_test; Owner: -
--

CREATE SEQUENCE ggto_test.usuario_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: ggto_test; Owner: -
--

ALTER SEQUENCE ggto_test.usuario_id_usuario_seq OWNED BY ggto_test.usuario.id_usuario;


--
-- Name: actividad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.actividad (
    id_actividad bigint NOT NULL,
    id_caso bigint NOT NULL,
    id_usuario integer,
    id_cuadrilla integer,
    tipo character varying(20) NOT NULL,
    resultado character varying(20),
    reporte_corto text,
    id_metodo integer,
    id_causa integer,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    latitud numeric(10,7),
    longitud numeric(10,7),
    sincronizado boolean DEFAULT false NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    id_actividad_local integer,
    dispositivo_id character varying(80),
    CONSTRAINT actividad_resultado_check CHECK (((resultado)::text = ANY (ARRAY[('CONTACTADO'::character varying)::text, ('CERRADO'::character varying)::text, ('ENRUTADO'::character varying)::text, ('DIFERIDO'::character varying)::text]))),
    CONSTRAINT actividad_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('CONTACTO'::character varying)::text, ('CIERRE'::character varying)::text, ('ENRUTE'::character varying)::text, ('DIFERIDO'::character varying)::text, ('INCIDENTE'::character varying)::text, ('FALLA_MASIVA'::character varying)::text])))
);


--
-- Name: actividad_id_actividad_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.actividad_id_actividad_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: actividad_id_actividad_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.actividad_id_actividad_seq OWNED BY public.actividad.id_actividad;


--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    id_auditoria bigint NOT NULL,
    usuario character varying(20),
    accion character varying(60) NOT NULL,
    entidad character varying(60),
    id_entidad character varying(40),
    datos_antes jsonb,
    datos_despues jsonb,
    ip inet,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    id_central integer,
    resultado character varying(20),
    request_id character varying(40)
);


--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_id_auditoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_auditoria_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_id_auditoria_seq OWNED BY public.auditoria.id_auditoria;


--
-- Name: caso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caso (
    id_caso bigint NOT NULL,
    id_central integer NOT NULL,
    id_averia character varying(30) NOT NULL,
    origen character varying(20) DEFAULT 'INGESTA_CSV'::character varying NOT NULL,
    tipo_caso character varying(20) DEFAULT 'AVERIA'::character varying NOT NULL,
    categoria character varying(20) DEFAULT 'RESIDENCIAL'::character varying NOT NULL,
    estado_actual character varying(20) DEFAULT 'NUEVO'::character varying NOT NULL,
    id_sector integer,
    id_causa integer,
    id_lote_ingesta bigint,
    en_gestion_supervisor boolean DEFAULT false NOT NULL,
    es_falla_masiva boolean DEFAULT false NOT NULL,
    creado_por character varying(20),
    region character varying(80),
    estado_geografico character varying(80),
    capital_estado character varying(80),
    municipio character varying(80),
    parroquia character varying(80),
    estado_operativo character varying(80),
    distrito character varying(40),
    area character varying(20),
    codigo_central character varying(20),
    nombre_central character varying(120),
    telefono character varying(30),
    fecha_reporte timestamp with time zone,
    persona_reporta character varying(120),
    contacto_cliente character varying(60),
    fecha_compromiso timestamp with time zone,
    fecha_cita timestamp with time zone,
    ultimo_comentario text,
    results text,
    asignado_a character varying(60),
    cuadrilla_externa character varying(40),
    estatus_origen character varying(20),
    problema_reporte text,
    informacion text,
    nombre_cliente character varying(160),
    direccion text,
    olt character varying(40),
    plan character varying(60),
    slot character varying(10),
    puerto character varying(10),
    fat character varying(80),
    serial character varying(60),
    extra character varying(120),
    area_trabajo character varying(40),
    tipo_servicio character varying(40),
    tipo_problema character varying(20),
    dias_area_resolutoria integer,
    unidad_negocio character varying(40),
    ups character varying(10),
    codigos_gestionados_venapp character varying(60),
    codigos_sin_gestion_venapp character varying(60),
    reparador_principal character varying(20),
    ayudantes jsonb DEFAULT '[]'::jsonb NOT NULL,
    flota_can character varying(20),
    despacho_nombre character varying(80),
    despacho_apellido character varying(80),
    telefono_oficina character varying(30),
    telefono_movil character varying(30),
    fecha_hora_asignacion timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    id_pago bigint,
    contacto2 character varying(60),
    telefono_ip character varying(30),
    CONSTRAINT caso_categoria_check CHECK (((categoria)::text = ANY (ARRAY[('RESIDENCIAL'::character varying)::text, ('EMPRESA'::character varying)::text, ('REFERIDO'::character varying)::text, ('GOBIERNO'::character varying)::text]))),
    CONSTRAINT caso_origen_check CHECK (((origen)::text = ANY (ARRAY[('INGESTA_CSV'::character varying)::text, ('MANUAL'::character varying)::text, ('TELEGRAM'::character varying)::text, ('MCP_IA'::character varying)::text]))),
    CONSTRAINT caso_tipo_caso_check CHECK (((tipo_caso)::text = ANY (ARRAY[('AVERIA'::character varying)::text, ('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text, ('REFERIDO'::character varying)::text, ('MANTENIMIENTO'::character varying)::text]))),
    CONSTRAINT ck_caso_estado_actual CHECK (((estado_actual)::text = ANY (ARRAY[('NUEVO'::character varying)::text, ('PENDIENTE'::character varying)::text, ('ASIGNADO'::character varying)::text, ('CONTACTADO'::character varying)::text, ('CITADO'::character varying)::text, ('DIFERIDO'::character varying)::text, ('EN_GESTION'::character varying)::text, ('ENRUTADO'::character varying)::text, ('CERRADO'::character varying)::text, ('CANCELADO'::character varying)::text])))
);

ALTER TABLE ONLY public.caso FORCE ROW LEVEL SECURITY;


--
-- Name: caso_d89_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caso_d89_backup (
    id_caso bigint NOT NULL,
    telefono character varying(30),
    contacto_cliente character varying(60),
    informacion text,
    respaldado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: caso_especial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caso_especial (
    id_caso_especial integer NOT NULL,
    id_caso bigint,
    id_solicitante integer,
    clasificacion character varying(20) NOT NULL,
    tipo_actividad character varying(20) NOT NULL,
    prioridad character varying(20) DEFAULT 'MEDIA'::character varying NOT NULL,
    tiene_id_averia boolean DEFAULT false NOT NULL,
    descripcion text,
    requiere_informe boolean DEFAULT true NOT NULL,
    estado character varying(20) DEFAULT 'ABIERTO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    informe text,
    CONSTRAINT caso_especial_clasificacion_check CHECK (((clasificacion)::text = ANY (ARRAY[('REFERIDO'::character varying)::text, ('EMPRESA'::character varying)::text, ('GOBIERNO'::character varying)::text]))),
    CONSTRAINT caso_especial_estado_check CHECK (((estado)::text = ANY (ARRAY[('ABIERTO'::character varying)::text, ('EN_PROCESO'::character varying)::text, ('ATENDIDO'::character varying)::text, ('CERRADO'::character varying)::text]))),
    CONSTRAINT caso_especial_prioridad_check CHECK (((prioridad)::text = ANY (ARRAY[('ALTA'::character varying)::text, ('MEDIA'::character varying)::text, ('BAJA'::character varying)::text]))),
    CONSTRAINT caso_especial_tipo_actividad_check CHECK (((tipo_actividad)::text = ANY (ARRAY[('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text, ('MANTENIMIENTO'::character varying)::text])))
);


--
-- Name: caso_especial_id_caso_especial_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.caso_especial_id_caso_especial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_especial_id_caso_especial_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.caso_especial_id_caso_especial_seq OWNED BY public.caso_especial.id_caso_especial;


--
-- Name: caso_estado_hist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caso_estado_hist (
    id_hist bigint NOT NULL,
    id_caso bigint NOT NULL,
    estado_anterior character varying(20),
    estado_nuevo character varying(20) NOT NULL,
    motivo text,
    usuario character varying(20),
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: caso_estado_hist_id_hist_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.caso_estado_hist_id_hist_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_estado_hist_id_hist_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.caso_estado_hist_id_hist_seq OWNED BY public.caso_estado_hist.id_hist;


--
-- Name: caso_id_caso_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.caso_id_caso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: caso_id_caso_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.caso_id_caso_seq OWNED BY public.caso.id_caso;


--
-- Name: catalogo_metodo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_metodo (
    id_metodo integer NOT NULL,
    dominio character varying(20) NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(120) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT catalogo_metodo_dominio_check CHECK (((dominio)::text = ANY (ARRAY[('CIERRE'::character varying)::text, ('ENRUTE'::character varying)::text, ('DIFERIDO'::character varying)::text, ('CONTACTO'::character varying)::text])))
);


--
-- Name: catalogo_metodo_id_metodo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.catalogo_metodo_id_metodo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catalogo_metodo_id_metodo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.catalogo_metodo_id_metodo_seq OWNED BY public.catalogo_metodo.id_metodo;


--
-- Name: causa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.causa (
    id_causa integer NOT NULL,
    codigo_causa character varying(20) NOT NULL,
    subcodigo_causa character varying(20) DEFAULT ''::character varying NOT NULL,
    descripcion character varying(255),
    descripcion_subcodigo character varying(255),
    tipo character varying(20),
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: causa_id_causa_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.causa_id_causa_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: causa_id_causa_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.causa_id_causa_seq OWNED BY public.causa.id_causa;


--
-- Name: central; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.central (
    id_central integer NOT NULL,
    region character varying(80) NOT NULL,
    estado_geografico character varying(80) NOT NULL,
    capital_estado character varying(80),
    municipio character varying(80) NOT NULL,
    parroquia character varying(80) NOT NULL,
    estado_operativo character varying(80),
    distrito character varying(40),
    area character varying(20) NOT NULL,
    codigo_central character varying(20) NOT NULL,
    nombre_central character varying(120) NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: central_id_central_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.central_id_central_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: central_id_central_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.central_id_central_seq OWNED BY public.central.id_central;


--
-- Name: cita; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cita (
    id_cita bigint NOT NULL,
    id_caso bigint,
    id_caso_especial integer,
    id_cuadrilla integer,
    fecha_hora timestamp with time zone NOT NULL,
    tipo character varying(20) DEFAULT 'CONTACTO'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'PROPUESTA'::character varying NOT NULL,
    observacion text,
    creado_por character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    recordatorio_para timestamp with time zone,
    CONSTRAINT cita_estado_check CHECK (((estado)::text = ANY (ARRAY[('PROPUESTA'::character varying)::text, ('CONFIRMADA'::character varying)::text, ('CUMPLIDA'::character varying)::text, ('REPROGRAMADA'::character varying)::text, ('DIFERIDA'::character varying)::text, ('CANCELADA'::character varying)::text]))),
    CONSTRAINT cita_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('CONTACTO'::character varying)::text, ('ATENCION'::character varying)::text]))),
    CONSTRAINT ck_cita_referencia CHECK (((id_caso IS NOT NULL) OR (id_caso_especial IS NOT NULL)))
);


--
-- Name: cita_id_cita_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cita_id_cita_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cita_id_cita_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cita_id_cita_seq OWNED BY public.cita.id_cita;


--
-- Name: configuracion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion (
    clave character varying(80) NOT NULL,
    valor jsonb NOT NULL,
    descripcion text,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cuadrilla (
    id_cuadrilla integer NOT NULL,
    id_central integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(80) NOT NULL,
    id_flota integer,
    es_supervisor boolean DEFAULT false NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cuadrilla_herramienta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cuadrilla_herramienta (
    id_cuadrilla integer NOT NULL,
    id_herramienta integer NOT NULL,
    asignada_en timestamp with time zone DEFAULT now() NOT NULL,
    devuelta_en timestamp with time zone
);


--
-- Name: cuadrilla_id_cuadrilla_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cuadrilla_id_cuadrilla_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuadrilla_id_cuadrilla_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cuadrilla_id_cuadrilla_seq OWNED BY public.cuadrilla.id_cuadrilla;


--
-- Name: cuadrilla_sector_dia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cuadrilla_sector_dia (
    id_asignacion bigint NOT NULL,
    id_central integer NOT NULL,
    fecha date NOT NULL,
    id_cuadrilla integer NOT NULL,
    id_sector integer NOT NULL,
    usuario character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE cuadrilla_sector_dia; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cuadrilla_sector_dia IS 'Asignación diaria de sectores a cuadrillas (D-66)';


--
-- Name: cuadrilla_sector_dia_id_asignacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cuadrilla_sector_dia_id_asignacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuadrilla_sector_dia_id_asignacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cuadrilla_sector_dia_id_asignacion_seq OWNED BY public.cuadrilla_sector_dia.id_asignacion;


--
-- Name: cuadrilla_tecnico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cuadrilla_tecnico (
    id_cuadrilla integer NOT NULL,
    id_tecnico integer NOT NULL,
    desde date DEFAULT CURRENT_DATE NOT NULL,
    rol_cuadrilla character varying(30) DEFAULT 'REPARADOR_PRINCIPAL'::character varying NOT NULL,
    hasta date,
    CONSTRAINT cuadrilla_tecnico_rol_cuadrilla_check CHECK (((rol_cuadrilla)::text = ANY (ARRAY[('REPARADOR_PRINCIPAL'::character varying)::text, ('AYUDANTE'::character varying)::text, ('SUPERVISOR'::character varying)::text])))
);


--
-- Name: despacho; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.despacho (
    id_despacho bigint NOT NULL,
    id_central integer NOT NULL,
    fecha date NOT NULL,
    id_cuadrilla integer NOT NULL,
    estado character varying(20) DEFAULT 'BORRADOR'::character varying NOT NULL,
    generado_auto boolean DEFAULT false NOT NULL,
    enviado_canal character varying(20),
    enviado_en timestamp with time zone,
    reporte_produccion_en timestamp with time zone,
    usuario_crea character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    cerrado_en timestamp with time zone,
    cierre_auto boolean DEFAULT false NOT NULL,
    reprocesado_en timestamp with time zone,
    CONSTRAINT despacho_enviado_canal_check CHECK (((enviado_canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('CORREO'::character varying)::text]))),
    CONSTRAINT despacho_estado_check CHECK (((estado)::text = ANY (ARRAY[('BORRADOR'::character varying)::text, ('PUBLICADO'::character varying)::text, ('CERRADO'::character varying)::text])))
);

ALTER TABLE ONLY public.despacho FORCE ROW LEVEL SECURITY;


--
-- Name: despacho_caso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.despacho_caso (
    id_despacho_caso bigint NOT NULL,
    id_despacho bigint NOT NULL,
    id_caso bigint NOT NULL,
    id_sector integer,
    orden_visita smallint,
    tipo_asignacion character varying(20),
    estado character varying(20) DEFAULT 'ASIGNADO'::character varying NOT NULL,
    observacion text,
    CONSTRAINT despacho_caso_estado_check CHECK (((estado)::text = ANY (ARRAY[('ASIGNADO'::character varying)::text, ('GESTIONADO'::character varying)::text, ('CERRADO'::character varying)::text, ('CITADO'::character varying)::text, ('DIFERIDO'::character varying)::text, ('DEVUELTO'::character varying)::text]))),
    CONSTRAINT despacho_caso_tipo_asignacion_check CHECK (((tipo_asignacion)::text = ANY (ARRAY[('REPARACION'::character varying)::text, ('CONSTRUCCION'::character varying)::text, ('REFERIDO'::character varying)::text, ('EMPRESA'::character varying)::text, ('FALLA_MASIVA'::character varying)::text, ('MANTENIMIENTO'::character varying)::text])))
);


--
-- Name: despacho_caso_id_despacho_caso_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.despacho_caso_id_despacho_caso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: despacho_caso_id_despacho_caso_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.despacho_caso_id_despacho_caso_seq OWNED BY public.despacho_caso.id_despacho_caso;


--
-- Name: despacho_id_despacho_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.despacho_id_despacho_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: despacho_id_despacho_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.despacho_id_despacho_seq OWNED BY public.despacho.id_despacho;


--
-- Name: despacho_metrica_diaria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.despacho_metrica_diaria (
    id_metrica bigint NOT NULL,
    id_central integer NOT NULL,
    fecha date NOT NULL,
    columna character varying(12) NOT NULL,
    asignados integer DEFAULT 0 NOT NULL,
    asignados_reparacion integer DEFAULT 0 NOT NULL,
    asignados_construccion integer DEFAULT 0 NOT NULL,
    cerrados integer DEFAULT 0 NOT NULL,
    cerrados_reparacion integer DEFAULT 0 NOT NULL,
    cerrados_construccion integer DEFAULT 0 NOT NULL,
    enrutado integer DEFAULT 0 NOT NULL,
    citado integer DEFAULT 0 NOT NULL,
    citado_reparacion integer DEFAULT 0 NOT NULL,
    citado_construccion integer DEFAULT 0 NOT NULL,
    diferidos integer DEFAULT 0 NOT NULL,
    diferidos_reparacion integer DEFAULT 0 NOT NULL,
    diferidos_construccion integer DEFAULT 0 NOT NULL,
    recalculado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT despacho_metrica_diaria_columna_check CHECK (((columna)::text = ANY (ARRAY[('COMUNES'::character varying)::text, ('REFERIDOS'::character varying)::text, ('EMPRESA'::character varying)::text])))
);

ALTER TABLE ONLY public.despacho_metrica_diaria FORCE ROW LEVEL SECURITY;


--
-- Name: despacho_metrica_diaria_id_metrica_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.despacho_metrica_diaria ALTER COLUMN id_metrica ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.despacho_metrica_diaria_id_metrica_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: dispositivo_seguridad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispositivo_seguridad (
    id_dispositivo bigint NOT NULL,
    p00 character varying(20) NOT NULL,
    palabras_hash jsonb DEFAULT '[]'::jsonb NOT NULL,
    clave_privada_ref character varying(255),
    documento_cifrado text,
    bloqueado boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dispositivo_seguridad_id_dispositivo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dispositivo_seguridad_id_dispositivo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dispositivo_seguridad_id_dispositivo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dispositivo_seguridad_id_dispositivo_seq OWNED BY public.dispositivo_seguridad.id_dispositivo;


--
-- Name: evidencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidencia (
    id_evidencia bigint NOT NULL,
    id_actividad bigint,
    tipo character varying(20) NOT NULL,
    serial_imagen character varying(160) NOT NULL,
    ruta_local character varying(255),
    ruta_remota character varying(255),
    latitud numeric(10,7),
    longitud numeric(10,7),
    fecha_hora timestamp with time zone NOT NULL,
    origen_camara boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    id_caso bigint,
    CONSTRAINT evidencia_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('POTENCIA'::character varying)::text, ('NAVEGACION'::character varying)::text, ('DEMO'::character varying)::text, ('FALLA_MASIVA'::character varying)::text])))
);


--
-- Name: evidencia_id_evidencia_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evidencia_id_evidencia_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evidencia_id_evidencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evidencia_id_evidencia_seq OWNED BY public.evidencia.id_evidencia;


--
-- Name: falla_masiva; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.falla_masiva (
    id_falla bigint NOT NULL,
    id_central integer NOT NULL,
    descripcion text NOT NULL,
    fecha_deteccion timestamp with time zone DEFAULT now() NOT NULL,
    origen character varying(20) DEFAULT 'AUTOMATICA'::character varying NOT NULL,
    id_sector integer,
    id_cuadrilla integer,
    estado character varying(20) DEFAULT 'DETECTADA'::character varying NOT NULL,
    planificacion text,
    reporte_simple text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    planificada_en timestamp with time zone,
    clave_concentracion character varying(120),
    odn character varying(60),
    direccion character varying(200),
    fat character varying(60),
    evidencias text,
    descripcion_cierre text,
    id_validador_crass bigint,
    evidencias_cierre text,
    cerrada_por character varying(20),
    cerrada_en timestamp with time zone,
    casos_cerrados integer DEFAULT 0 NOT NULL,
    latitud numeric(10,7),
    longitud numeric(10,7),
    olt character varying(60),
    slot character varying(20),
    puerto character varying(20),
    extra character varying(120),
    CONSTRAINT falla_masiva_estado_check CHECK (((estado)::text = ANY (ARRAY[('DETECTADA'::character varying)::text, ('PLANIFICADA'::character varying)::text, ('ATENDIDA'::character varying)::text, ('CERRADA'::character varying)::text]))),
    CONSTRAINT falla_masiva_origen_check CHECK (((origen)::text = ANY (ARRAY[('AUTOMATICA'::character varying)::text, ('REPORTE_TECNICO'::character varying)::text, ('MCP'::character varying)::text])))
);


--
-- Name: falla_masiva_caso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.falla_masiva_caso (
    id_asociacion bigint NOT NULL,
    id_falla bigint NOT NULL,
    id_caso bigint NOT NULL,
    origen character varying(12) DEFAULT 'AUTO'::character varying NOT NULL,
    agregado_por character varying(20),
    agregado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT falla_masiva_caso_origen_check CHECK (((origen)::text = ANY (ARRAY[('AUTO'::character varying)::text, ('MANUAL'::character varying)::text])))
);


--
-- Name: falla_masiva_caso_id_asociacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.falla_masiva_caso_id_asociacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: falla_masiva_caso_id_asociacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.falla_masiva_caso_id_asociacion_seq OWNED BY public.falla_masiva_caso.id_asociacion;


--
-- Name: falla_masiva_id_falla_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.falla_masiva_id_falla_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: falla_masiva_id_falla_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.falla_masiva_id_falla_seq OWNED BY public.falla_masiva.id_falla;


--
-- Name: flota; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flota (
    id_flota integer NOT NULL,
    id_central integer NOT NULL,
    can character varying(20) NOT NULL,
    tipo character varying(40),
    marca character varying(40),
    modelo character varying(40),
    placa character varying(20),
    combustible character varying(20),
    status character varying(20) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    estado_cauchos character varying(30),
    estado_fluidos character varying(30),
    estado_general character varying(30),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT flota_status_check CHECK (((status)::text = ANY (ARRAY[('DISPONIBLE'::character varying)::text, ('EN_RUTA'::character varying)::text, ('MANTENIMIENTO'::character varying)::text, ('FUERA_SERVICIO'::character varying)::text])))
);


--
-- Name: flota_id_flota_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.flota_id_flota_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flota_id_flota_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.flota_id_flota_seq OWNED BY public.flota.id_flota;


--
-- Name: herramienta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.herramienta (
    id_herramienta integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(120) NOT NULL,
    codigo character varying(40) NOT NULL,
    estado character varying(20) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    observacion text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT herramienta_estado_check CHECK (((estado)::text = ANY (ARRAY[('DISPONIBLE'::character varying)::text, ('ASIGNADA'::character varying)::text, ('AVERIADA'::character varying)::text, ('PERDIDA'::character varying)::text])))
);


--
-- Name: herramienta_id_herramienta_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.herramienta_id_herramienta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: herramienta_id_herramienta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.herramienta_id_herramienta_seq OWNED BY public.herramienta.id_herramienta;


--
-- Name: identificador_pago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.identificador_pago (
    id_pago bigint NOT NULL,
    numero character varying(15) NOT NULL,
    id_central integer NOT NULL,
    nombre_titular character varying(160),
    direccion_principal text,
    estado character varying(12) DEFAULT 'ACTIVO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_ip_serie CHECK (((numero)::text ~ '^[0-9]{7,15}$'::text)),
    CONSTRAINT identificador_pago_estado_check CHECK (((estado)::text = ANY (ARRAY[('ACTIVO'::character varying)::text, ('SUSPENDIDO'::character varying)::text, ('BAJA'::character varying)::text])))
);

ALTER TABLE ONLY public.identificador_pago FORCE ROW LEVEL SECURITY;


--
-- Name: identificador_pago_id_pago_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.identificador_pago_id_pago_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: identificador_pago_id_pago_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.identificador_pago_id_pago_seq OWNED BY public.identificador_pago.id_pago;


--
-- Name: incidente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidente (
    id_incidente bigint NOT NULL,
    tipo character varying(20) NOT NULL,
    id_flota integer,
    id_herramienta integer,
    descripcion text,
    id_actividad bigint,
    estado character varying(20) DEFAULT 'REPORTADO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_incidente_referencia CHECK (((id_flota IS NOT NULL) OR (id_herramienta IS NOT NULL))),
    CONSTRAINT incidente_estado_check CHECK (((estado)::text = ANY (ARRAY[('REPORTADO'::character varying)::text, ('EN_REVISION'::character varying)::text, ('RESUELTO'::character varying)::text]))),
    CONSTRAINT incidente_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('FLOTA'::character varying)::text, ('HERRAMIENTA'::character varying)::text])))
);


--
-- Name: incidente_id_incidente_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incidente_id_incidente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidente_id_incidente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incidente_id_incidente_seq OWNED BY public.incidente.id_incidente;


--
-- Name: ingesta_lote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingesta_lote (
    id_lote bigint NOT NULL,
    archivo character varying(255) NOT NULL,
    fecha_archivo date,
    id_central integer,
    filas_leidas integer DEFAULT 0 NOT NULL,
    filas_central integer DEFAULT 0 NOT NULL,
    casos_nuevos integer DEFAULT 0 NOT NULL,
    casos_duplicados integer DEFAULT 0 NOT NULL,
    casos_descartados integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'PROCESANDO'::character varying NOT NULL,
    detalle_error text,
    usuario character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    filas_sin_identificador_pago integer DEFAULT 0 NOT NULL,
    filas_con_contacto integer DEFAULT 0 NOT NULL,
    avisos jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT ingesta_lote_estado_check CHECK (((estado)::text = ANY (ARRAY[('PROCESANDO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text])))
);


--
-- Name: ingesta_lote_id_lote_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingesta_lote_id_lote_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingesta_lote_id_lote_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingesta_lote_id_lote_seq OWNED BY public.ingesta_lote.id_lote;


--
-- Name: insumo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insumo (
    id_insumo integer NOT NULL,
    id_central integer,
    codigo character varying(40) NOT NULL,
    nombre character varying(120) NOT NULL,
    unidad_medida character varying(20) DEFAULT 'UNIDAD'::character varying NOT NULL,
    stock_minimo numeric(12,2) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: insumo_id_insumo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.insumo_id_insumo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: insumo_id_insumo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.insumo_id_insumo_seq OWNED BY public.insumo.id_insumo;


--
-- Name: inventario_movimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventario_movimiento (
    id_mov bigint NOT NULL,
    id_insumo integer NOT NULL,
    tipo character varying(20) NOT NULL,
    cantidad numeric(12,2) NOT NULL,
    id_orden bigint,
    id_tecnico integer,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    usuario character varying(20),
    observacion text,
    CONSTRAINT inventario_movimiento_cantidad_check CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT inventario_movimiento_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('INGRESO'::character varying)::text, ('EGRESO'::character varying)::text, ('AJUSTE'::character varying)::text])))
);


--
-- Name: inventario_movimiento_id_mov_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventario_movimiento_id_mov_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventario_movimiento_id_mov_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventario_movimiento_id_mov_seq OWNED BY public.inventario_movimiento.id_mov;


--
-- Name: mensaje; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensaje (
    id_mensaje bigint NOT NULL,
    id_central integer NOT NULL,
    origen_p00 character varying(20),
    destino_tipo character varying(12) NOT NULL,
    id_cuadrilla integer,
    id_tecnico integer,
    tipo character varying(20) NOT NULL,
    cuerpo character varying(500) NOT NULL,
    id_caso bigint,
    dedupe_key character varying(80),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone DEFAULT (now() + '5 days'::interval) NOT NULL,
    id_usuario_destino character varying(20),
    CONSTRAINT ck_mensaje_destino_tipo CHECK (((destino_tipo)::text = ANY (ARRAY[('TODOS'::character varying)::text, ('CUADRILLA'::character varying)::text, ('TECNICO'::character varying)::text, ('SUPERVISOR'::character varying)::text]))),
    CONSTRAINT ck_mensaje_destino_xor CHECK (((((destino_tipo)::text = 'TODOS'::text) AND (id_cuadrilla IS NULL) AND (id_tecnico IS NULL) AND (id_usuario_destino IS NULL)) OR (((destino_tipo)::text = 'CUADRILLA'::text) AND (id_cuadrilla IS NOT NULL) AND (id_tecnico IS NULL) AND (id_usuario_destino IS NULL)) OR (((destino_tipo)::text = 'TECNICO'::text) AND (id_tecnico IS NOT NULL) AND (id_cuadrilla IS NULL) AND (id_usuario_destino IS NULL)) OR (((destino_tipo)::text = 'SUPERVISOR'::text) AND (id_usuario_destino IS NOT NULL) AND (id_cuadrilla IS NULL) AND (id_tecnico IS NULL)))),
    CONSTRAINT mensaje_check CHECK ((expira_en > creado_en)),
    CONSTRAINT mensaje_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('RECORDATORIO_CITA'::character varying)::text, ('ESTADO_SYNC'::character varying)::text, ('ALARMA_DESPACHO'::character varying)::text, ('TEXTO'::character varying)::text])))
);


--
-- Name: mensaje_destino; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensaje_destino (
    id_mensaje bigint NOT NULL,
    id_tecnico integer,
    leido_en timestamp with time zone,
    id_destino bigint NOT NULL,
    p00 character varying(20),
    CONSTRAINT ck_mensaje_destino_un_destinatario CHECK ((((p00 IS NULL) AND (id_tecnico IS NOT NULL)) OR ((p00 IS NOT NULL) AND (id_tecnico IS NULL))))
);


--
-- Name: mensaje_destino_id_destino_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mensaje_destino_id_destino_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mensaje_destino_id_destino_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mensaje_destino_id_destino_seq OWNED BY public.mensaje_destino.id_destino;


--
-- Name: mensaje_id_mensaje_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mensaje_id_mensaje_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mensaje_id_mensaje_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mensaje_id_mensaje_seq OWNED BY public.mensaje.id_mensaje;


--
-- Name: notificacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacion (
    id_notificacion bigint NOT NULL,
    canal character varying(20) NOT NULL,
    destinatario character varying(160),
    asunto character varying(200),
    cuerpo text,
    id_caso bigint,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    error text,
    enviado_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    intentos smallint DEFAULT 0 NOT NULL,
    proximo_intento timestamp with time zone,
    CONSTRAINT ck_notificacion_canal CHECK (((canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('CORREO'::character varying)::text, ('MCP_IA'::character varying)::text, ('MANUAL'::character varying)::text]))),
    CONSTRAINT notificacion_estado_check CHECK (((estado)::text = ANY (ARRAY[('PENDIENTE'::character varying)::text, ('ENVIADO'::character varying)::text, ('FALLIDO'::character varying)::text])))
);


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notificacion_id_notificacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificacion_id_notificacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notificacion_id_notificacion_seq OWNED BY public.notificacion.id_notificacion;


--
-- Name: orden_material; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orden_material (
    id_orden bigint NOT NULL,
    id_caso bigint,
    id_cuadrilla integer,
    solicitante_usuario character varying(20),
    estado character varying(20) DEFAULT 'SOLICITADA'::character varying NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    observacion text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    id_falla bigint,
    CONSTRAINT orden_material_estado_check CHECK (((estado)::text = ANY (ARRAY[('SOLICITADA'::character varying)::text, ('APROBADA'::character varying)::text, ('ENTREGADA'::character varying)::text, ('RECHAZADA'::character varying)::text])))
);


--
-- Name: orden_material_detalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orden_material_detalle (
    id_orden_detalle bigint NOT NULL,
    id_orden bigint NOT NULL,
    id_insumo integer NOT NULL,
    cantidad_solicitada numeric(12,2) NOT NULL,
    cantidad_entregada numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT orden_material_detalle_cantidad_solicitada_check CHECK ((cantidad_solicitada > (0)::numeric))
);


--
-- Name: orden_material_detalle_id_orden_detalle_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orden_material_detalle_id_orden_detalle_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_material_detalle_id_orden_detalle_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orden_material_detalle_id_orden_detalle_seq OWNED BY public.orden_material_detalle.id_orden_detalle;


--
-- Name: orden_material_id_orden_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orden_material_id_orden_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_material_id_orden_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orden_material_id_orden_seq OWNED BY public.orden_material.id_orden;


--
-- Name: rol; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rol (
    id_rol integer NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(80) NOT NULL,
    descripcion text,
    permisos jsonb DEFAULT '{}'::jsonb NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rol_id_rol_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rol_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rol_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rol_id_rol_seq OWNED BY public.rol.id_rol;


--
-- Name: sector; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sector (
    id_sector integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(120) NOT NULL,
    codigo character varying(20) NOT NULL,
    descripcion text,
    prioridad smallint DEFAULT 100 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sector_direccion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sector_direccion (
    id_sector_direccion integer NOT NULL,
    id_sector integer NOT NULL,
    patron character varying(160) NOT NULL,
    tipo_coincidencia character varying(20) DEFAULT 'CONTIENE'::character varying NOT NULL,
    normalizar boolean DEFAULT true NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sector_direccion_tipo_coincidencia_check CHECK (((tipo_coincidencia)::text = ANY (ARRAY[('CONTIENE'::character varying)::text, ('EXACTO'::character varying)::text, ('REGEX'::character varying)::text])))
);


--
-- Name: sector_direccion_id_sector_direccion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sector_direccion_id_sector_direccion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sector_direccion_id_sector_direccion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sector_direccion_id_sector_direccion_seq OWNED BY public.sector_direccion.id_sector_direccion;


--
-- Name: sector_id_sector_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sector_id_sector_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sector_id_sector_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sector_id_sector_seq OWNED BY public.sector.id_sector;


--
-- Name: seguimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seguimiento (
    id_seguimiento bigint NOT NULL,
    id_caso bigint NOT NULL,
    instancia_destino character varying(120) NOT NULL,
    motivo text,
    fecha_envio timestamp with time zone DEFAULT now() NOT NULL,
    fecha_retorno timestamp with time zone,
    estado character varying(20) DEFAULT 'EN_COLA'::character varying NOT NULL,
    observacion text,
    usuario character varying(20),
    CONSTRAINT seguimiento_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_COLA'::character varying)::text, ('RESUELTO'::character varying)::text, ('DEVUELTO'::character varying)::text])))
);


--
-- Name: seguimiento_id_seguimiento_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seguimiento_id_seguimiento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seguimiento_id_seguimiento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seguimiento_id_seguimiento_seq OWNED BY public.seguimiento.id_seguimiento;


--
-- Name: seq_caso_ref; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_caso_ref
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sincronizacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sincronizacion (
    id_sync bigint NOT NULL,
    id_dispositivo bigint,
    id_tecnico integer,
    inicio timestamp with time zone DEFAULT now() NOT NULL,
    fin timestamp with time zone,
    casos_descargados integer DEFAULT 0 NOT NULL,
    actividades_subidas integer DEFAULT 0 NOT NULL,
    evidencias_subidas integer DEFAULT 0 NOT NULL,
    archivo_zip character varying(160),
    estado character varying(20) DEFAULT 'EN_PROCESO'::character varying NOT NULL,
    detalle_json jsonb,
    CONSTRAINT sincronizacion_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_PROCESO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text])))
);


--
-- Name: sincronizacion_id_sync_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sincronizacion_id_sync_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sincronizacion_id_sync_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sincronizacion_id_sync_seq OWNED BY public.sincronizacion.id_sync;


--
-- Name: solicitante; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitante (
    id_solicitante integer NOT NULL,
    unidad character varying(120) NOT NULL,
    nombre character varying(120) NOT NULL,
    contacto character varying(60) NOT NULL,
    canal character varying(20),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    id_central integer,
    documento character varying(30),
    tipo character varying(20) DEFAULT 'SOLICITANTE'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_solicitante_tipo CHECK (((tipo)::text = ANY (ARRAY[('SOLICITANTE'::character varying)::text, ('CRASS'::character varying)::text, ('OTRO'::character varying)::text]))),
    CONSTRAINT solicitante_canal_check CHECK (((canal)::text = ANY (ARRAY[('TELEGRAM'::character varying)::text, ('MCP_IA'::character varying)::text, ('MANUAL'::character varying)::text, ('CORREO'::character varying)::text])))
);


--
-- Name: solicitante_id_solicitante_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitante_id_solicitante_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitante_id_solicitante_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitante_id_solicitante_seq OWNED BY public.solicitante.id_solicitante;


--
-- Name: sync_check; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_check (
    id_sync_check bigint NOT NULL,
    id_sync_log bigint NOT NULL,
    paso character varying(12) NOT NULL,
    estado character varying(12) NOT NULL,
    fecha_hora timestamp with time zone,
    detalle jsonb,
    CONSTRAINT sync_check_estado_check CHECK (((estado)::text = ANY (ARRAY[('PENDIENTE'::character varying)::text, ('EN_CURSO'::character varying)::text, ('OK'::character varying)::text, ('ERROR'::character varying)::text, ('OMITIDO'::character varying)::text]))),
    CONSTRAINT sync_check_paso_check CHECK (((paso)::text = ANY (ARRAY[('CONEXION'::character varying)::text, ('LOGIN'::character varying)::text, ('DESCARGA'::character varying)::text, ('CARGA'::character varying)::text])))
);


--
-- Name: sync_check_id_sync_check_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sync_check_id_sync_check_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_check_id_sync_check_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sync_check_id_sync_check_seq OWNED BY public.sync_check.id_sync_check;


--
-- Name: sync_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_log (
    id_sync_log bigint NOT NULL,
    p00 character varying(20) NOT NULL,
    id_cuadrilla integer,
    tipo character varying(20) NOT NULL,
    dispositivo_id character varying(80),
    version_app character varying(20),
    iniciado_en timestamp with time zone DEFAULT now() NOT NULL,
    finalizado_en timestamp with time zone,
    recibidos integer DEFAULT 0 NOT NULL,
    procesados integer DEFAULT 0 NOT NULL,
    errores integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'EN_PROCESO'::character varying NOT NULL,
    detalle jsonb,
    plataforma character varying(20) DEFAULT 'APK'::character varying NOT NULL,
    duracion_ms integer,
    id_central integer,
    CONSTRAINT sync_log_estado_check CHECK (((estado)::text = ANY (ARRAY[('EN_PROCESO'::character varying)::text, ('OK'::character varying)::text, ('PARCIAL'::character varying)::text, ('ERROR'::character varying)::text]))),
    CONSTRAINT sync_log_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('DESCARGA'::character varying)::text, ('CARGA'::character varying)::text])))
);


--
-- Name: sync_log_id_sync_log_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sync_log_id_sync_log_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_log_id_sync_log_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sync_log_id_sync_log_seq OWNED BY public.sync_log.id_sync_log;


--
-- Name: tecnico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tecnico (
    id_tecnico integer NOT NULL,
    id_central integer NOT NULL,
    nombre character varying(80) NOT NULL,
    apellido character varying(80),
    cedula character varying(20),
    p00 character varying(20) NOT NULL,
    telefono character varying(30),
    correo character varying(120),
    especialidad character varying(80),
    status character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tecnico_status_check CHECK (((status)::text = ANY (ARRAY[('ACTIVO'::character varying)::text, ('INACTIVO'::character varying)::text, ('VACACIONES'::character varying)::text, ('SUSPENDIDO'::character varying)::text])))
);


--
-- Name: tecnico_id_tecnico_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tecnico_id_tecnico_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tecnico_id_tecnico_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tecnico_id_tecnico_seq OWNED BY public.tecnico.id_tecnico;


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario (
    id_usuario integer NOT NULL,
    p00 character varying(20) NOT NULL,
    correo character varying(120),
    clave_hash character varying(255) NOT NULL,
    id_rol integer NOT NULL,
    id_tecnico integer,
    id_central integer,
    intentos_fallidos smallint DEFAULT 0 NOT NULL,
    bloqueado boolean DEFAULT false NOT NULL,
    bloqueo_cliente boolean DEFAULT false NOT NULL,
    requiere_cambio_clave boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    ultimo_acceso timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    nombre character varying(80),
    apellido character varying(80)
);


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_id_usuario_seq OWNED BY public.usuario.id_usuario;


--
-- Name: actividad id_actividad; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.actividad ALTER COLUMN id_actividad SET DEFAULT nextval('ggto_d77.actividad_id_actividad_seq'::regclass);


--
-- Name: auditoria id_auditoria; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.auditoria ALTER COLUMN id_auditoria SET DEFAULT nextval('ggto_d77.auditoria_id_auditoria_seq'::regclass);


--
-- Name: caso id_caso; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso ALTER COLUMN id_caso SET DEFAULT nextval('ggto_d77.caso_id_caso_seq'::regclass);


--
-- Name: caso_especial id_caso_especial; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso_especial ALTER COLUMN id_caso_especial SET DEFAULT nextval('ggto_d77.caso_especial_id_caso_especial_seq'::regclass);


--
-- Name: caso_estado_hist id_hist; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso_estado_hist ALTER COLUMN id_hist SET DEFAULT nextval('ggto_d77.caso_estado_hist_id_hist_seq'::regclass);


--
-- Name: catalogo_metodo id_metodo; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.catalogo_metodo ALTER COLUMN id_metodo SET DEFAULT nextval('ggto_d77.catalogo_metodo_id_metodo_seq'::regclass);


--
-- Name: causa id_causa; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.causa ALTER COLUMN id_causa SET DEFAULT nextval('ggto_d77.causa_id_causa_seq'::regclass);


--
-- Name: central id_central; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.central ALTER COLUMN id_central SET DEFAULT nextval('ggto_d77.central_id_central_seq'::regclass);


--
-- Name: cita id_cita; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cita ALTER COLUMN id_cita SET DEFAULT nextval('ggto_d77.cita_id_cita_seq'::regclass);


--
-- Name: cuadrilla id_cuadrilla; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla ALTER COLUMN id_cuadrilla SET DEFAULT nextval('ggto_d77.cuadrilla_id_cuadrilla_seq'::regclass);


--
-- Name: cuadrilla_sector_dia id_asignacion; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_sector_dia ALTER COLUMN id_asignacion SET DEFAULT nextval('ggto_d77.cuadrilla_sector_dia_id_asignacion_seq'::regclass);


--
-- Name: despacho id_despacho; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.despacho ALTER COLUMN id_despacho SET DEFAULT nextval('ggto_d77.despacho_id_despacho_seq'::regclass);


--
-- Name: despacho_caso id_despacho_caso; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.despacho_caso ALTER COLUMN id_despacho_caso SET DEFAULT nextval('ggto_d77.despacho_caso_id_despacho_caso_seq'::regclass);


--
-- Name: dispositivo_seguridad id_dispositivo; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.dispositivo_seguridad ALTER COLUMN id_dispositivo SET DEFAULT nextval('ggto_d77.dispositivo_seguridad_id_dispositivo_seq'::regclass);


--
-- Name: evidencia id_evidencia; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.evidencia ALTER COLUMN id_evidencia SET DEFAULT nextval('ggto_d77.evidencia_id_evidencia_seq'::regclass);


--
-- Name: falla_masiva id_falla; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.falla_masiva ALTER COLUMN id_falla SET DEFAULT nextval('ggto_d77.falla_masiva_id_falla_seq'::regclass);


--
-- Name: flota id_flota; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.flota ALTER COLUMN id_flota SET DEFAULT nextval('ggto_d77.flota_id_flota_seq'::regclass);


--
-- Name: herramienta id_herramienta; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.herramienta ALTER COLUMN id_herramienta SET DEFAULT nextval('ggto_d77.herramienta_id_herramienta_seq'::regclass);


--
-- Name: incidente id_incidente; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.incidente ALTER COLUMN id_incidente SET DEFAULT nextval('ggto_d77.incidente_id_incidente_seq'::regclass);


--
-- Name: ingesta_lote id_lote; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.ingesta_lote ALTER COLUMN id_lote SET DEFAULT nextval('ggto_d77.ingesta_lote_id_lote_seq'::regclass);


--
-- Name: insumo id_insumo; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.insumo ALTER COLUMN id_insumo SET DEFAULT nextval('ggto_d77.insumo_id_insumo_seq'::regclass);


--
-- Name: inventario_movimiento id_mov; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.inventario_movimiento ALTER COLUMN id_mov SET DEFAULT nextval('ggto_d77.inventario_movimiento_id_mov_seq'::regclass);


--
-- Name: notificacion id_notificacion; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.notificacion ALTER COLUMN id_notificacion SET DEFAULT nextval('ggto_d77.notificacion_id_notificacion_seq'::regclass);


--
-- Name: orden_material id_orden; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.orden_material ALTER COLUMN id_orden SET DEFAULT nextval('ggto_d77.orden_material_id_orden_seq'::regclass);


--
-- Name: orden_material_detalle id_orden_detalle; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.orden_material_detalle ALTER COLUMN id_orden_detalle SET DEFAULT nextval('ggto_d77.orden_material_detalle_id_orden_detalle_seq'::regclass);


--
-- Name: rol id_rol; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.rol ALTER COLUMN id_rol SET DEFAULT nextval('ggto_d77.rol_id_rol_seq'::regclass);


--
-- Name: sector id_sector; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sector ALTER COLUMN id_sector SET DEFAULT nextval('ggto_d77.sector_id_sector_seq'::regclass);


--
-- Name: sector_direccion id_sector_direccion; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sector_direccion ALTER COLUMN id_sector_direccion SET DEFAULT nextval('ggto_d77.sector_direccion_id_sector_direccion_seq'::regclass);


--
-- Name: seguimiento id_seguimiento; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.seguimiento ALTER COLUMN id_seguimiento SET DEFAULT nextval('ggto_d77.seguimiento_id_seguimiento_seq'::regclass);


--
-- Name: sincronizacion id_sync; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sincronizacion ALTER COLUMN id_sync SET DEFAULT nextval('ggto_d77.sincronizacion_id_sync_seq'::regclass);


--
-- Name: solicitante id_solicitante; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.solicitante ALTER COLUMN id_solicitante SET DEFAULT nextval('ggto_d77.solicitante_id_solicitante_seq'::regclass);


--
-- Name: sync_log id_sync_log; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sync_log ALTER COLUMN id_sync_log SET DEFAULT nextval('ggto_d77.sync_log_id_sync_log_seq'::regclass);


--
-- Name: tecnico id_tecnico; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.tecnico ALTER COLUMN id_tecnico SET DEFAULT nextval('ggto_d77.tecnico_id_tecnico_seq'::regclass);


--
-- Name: usuario id_usuario; Type: DEFAULT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.usuario ALTER COLUMN id_usuario SET DEFAULT nextval('ggto_d77.usuario_id_usuario_seq'::regclass);


--
-- Name: actividad id_actividad; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.actividad ALTER COLUMN id_actividad SET DEFAULT nextval('ggto_e2e.actividad_id_actividad_seq'::regclass);


--
-- Name: auditoria id_auditoria; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.auditoria ALTER COLUMN id_auditoria SET DEFAULT nextval('ggto_e2e.auditoria_id_auditoria_seq'::regclass);


--
-- Name: caso id_caso; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso ALTER COLUMN id_caso SET DEFAULT nextval('ggto_e2e.caso_id_caso_seq'::regclass);


--
-- Name: caso_especial id_caso_especial; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso_especial ALTER COLUMN id_caso_especial SET DEFAULT nextval('ggto_e2e.caso_especial_id_caso_especial_seq'::regclass);


--
-- Name: caso_estado_hist id_hist; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso_estado_hist ALTER COLUMN id_hist SET DEFAULT nextval('ggto_e2e.caso_estado_hist_id_hist_seq'::regclass);


--
-- Name: catalogo_metodo id_metodo; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.catalogo_metodo ALTER COLUMN id_metodo SET DEFAULT nextval('ggto_e2e.catalogo_metodo_id_metodo_seq'::regclass);


--
-- Name: causa id_causa; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.causa ALTER COLUMN id_causa SET DEFAULT nextval('ggto_e2e.causa_id_causa_seq'::regclass);


--
-- Name: central id_central; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.central ALTER COLUMN id_central SET DEFAULT nextval('ggto_e2e.central_id_central_seq'::regclass);


--
-- Name: cita id_cita; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cita ALTER COLUMN id_cita SET DEFAULT nextval('ggto_e2e.cita_id_cita_seq'::regclass);


--
-- Name: cuadrilla id_cuadrilla; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla ALTER COLUMN id_cuadrilla SET DEFAULT nextval('ggto_e2e.cuadrilla_id_cuadrilla_seq'::regclass);


--
-- Name: cuadrilla_sector_dia id_asignacion; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_sector_dia ALTER COLUMN id_asignacion SET DEFAULT nextval('ggto_e2e.cuadrilla_sector_dia_id_asignacion_seq'::regclass);


--
-- Name: despacho id_despacho; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.despacho ALTER COLUMN id_despacho SET DEFAULT nextval('ggto_e2e.despacho_id_despacho_seq'::regclass);


--
-- Name: despacho_caso id_despacho_caso; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.despacho_caso ALTER COLUMN id_despacho_caso SET DEFAULT nextval('ggto_e2e.despacho_caso_id_despacho_caso_seq'::regclass);


--
-- Name: dispositivo_seguridad id_dispositivo; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.dispositivo_seguridad ALTER COLUMN id_dispositivo SET DEFAULT nextval('ggto_e2e.dispositivo_seguridad_id_dispositivo_seq'::regclass);


--
-- Name: evidencia id_evidencia; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.evidencia ALTER COLUMN id_evidencia SET DEFAULT nextval('ggto_e2e.evidencia_id_evidencia_seq'::regclass);


--
-- Name: falla_masiva id_falla; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.falla_masiva ALTER COLUMN id_falla SET DEFAULT nextval('ggto_e2e.falla_masiva_id_falla_seq'::regclass);


--
-- Name: flota id_flota; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.flota ALTER COLUMN id_flota SET DEFAULT nextval('ggto_e2e.flota_id_flota_seq'::regclass);


--
-- Name: herramienta id_herramienta; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.herramienta ALTER COLUMN id_herramienta SET DEFAULT nextval('ggto_e2e.herramienta_id_herramienta_seq'::regclass);


--
-- Name: incidente id_incidente; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.incidente ALTER COLUMN id_incidente SET DEFAULT nextval('ggto_e2e.incidente_id_incidente_seq'::regclass);


--
-- Name: ingesta_lote id_lote; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.ingesta_lote ALTER COLUMN id_lote SET DEFAULT nextval('ggto_e2e.ingesta_lote_id_lote_seq'::regclass);


--
-- Name: insumo id_insumo; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.insumo ALTER COLUMN id_insumo SET DEFAULT nextval('ggto_e2e.insumo_id_insumo_seq'::regclass);


--
-- Name: inventario_movimiento id_mov; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.inventario_movimiento ALTER COLUMN id_mov SET DEFAULT nextval('ggto_e2e.inventario_movimiento_id_mov_seq'::regclass);


--
-- Name: mensaje id_mensaje; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.mensaje ALTER COLUMN id_mensaje SET DEFAULT nextval('ggto_e2e.mensaje_id_mensaje_seq'::regclass);


--
-- Name: notificacion id_notificacion; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.notificacion ALTER COLUMN id_notificacion SET DEFAULT nextval('ggto_e2e.notificacion_id_notificacion_seq'::regclass);


--
-- Name: orden_material id_orden; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.orden_material ALTER COLUMN id_orden SET DEFAULT nextval('ggto_e2e.orden_material_id_orden_seq'::regclass);


--
-- Name: orden_material_detalle id_orden_detalle; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.orden_material_detalle ALTER COLUMN id_orden_detalle SET DEFAULT nextval('ggto_e2e.orden_material_detalle_id_orden_detalle_seq'::regclass);


--
-- Name: rol id_rol; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.rol ALTER COLUMN id_rol SET DEFAULT nextval('ggto_e2e.rol_id_rol_seq'::regclass);


--
-- Name: sector id_sector; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sector ALTER COLUMN id_sector SET DEFAULT nextval('ggto_e2e.sector_id_sector_seq'::regclass);


--
-- Name: sector_direccion id_sector_direccion; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sector_direccion ALTER COLUMN id_sector_direccion SET DEFAULT nextval('ggto_e2e.sector_direccion_id_sector_direccion_seq'::regclass);


--
-- Name: seguimiento id_seguimiento; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.seguimiento ALTER COLUMN id_seguimiento SET DEFAULT nextval('ggto_e2e.seguimiento_id_seguimiento_seq'::regclass);


--
-- Name: sincronizacion id_sync; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sincronizacion ALTER COLUMN id_sync SET DEFAULT nextval('ggto_e2e.sincronizacion_id_sync_seq'::regclass);


--
-- Name: solicitante id_solicitante; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.solicitante ALTER COLUMN id_solicitante SET DEFAULT nextval('ggto_e2e.solicitante_id_solicitante_seq'::regclass);


--
-- Name: sync_check id_sync_check; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sync_check ALTER COLUMN id_sync_check SET DEFAULT nextval('ggto_e2e.sync_check_id_sync_check_seq'::regclass);


--
-- Name: sync_log id_sync_log; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sync_log ALTER COLUMN id_sync_log SET DEFAULT nextval('ggto_e2e.sync_log_id_sync_log_seq'::regclass);


--
-- Name: tecnico id_tecnico; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.tecnico ALTER COLUMN id_tecnico SET DEFAULT nextval('ggto_e2e.tecnico_id_tecnico_seq'::regclass);


--
-- Name: usuario id_usuario; Type: DEFAULT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.usuario ALTER COLUMN id_usuario SET DEFAULT nextval('ggto_e2e.usuario_id_usuario_seq'::regclass);


--
-- Name: actividad id_actividad; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.actividad ALTER COLUMN id_actividad SET DEFAULT nextval('ggto_sync.actividad_id_actividad_seq'::regclass);


--
-- Name: auditoria id_auditoria; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.auditoria ALTER COLUMN id_auditoria SET DEFAULT nextval('ggto_sync.auditoria_id_auditoria_seq'::regclass);


--
-- Name: caso id_caso; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso ALTER COLUMN id_caso SET DEFAULT nextval('ggto_sync.caso_id_caso_seq'::regclass);


--
-- Name: caso_especial id_caso_especial; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso_especial ALTER COLUMN id_caso_especial SET DEFAULT nextval('ggto_sync.caso_especial_id_caso_especial_seq'::regclass);


--
-- Name: caso_estado_hist id_hist; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso_estado_hist ALTER COLUMN id_hist SET DEFAULT nextval('ggto_sync.caso_estado_hist_id_hist_seq'::regclass);


--
-- Name: catalogo_metodo id_metodo; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.catalogo_metodo ALTER COLUMN id_metodo SET DEFAULT nextval('ggto_sync.catalogo_metodo_id_metodo_seq'::regclass);


--
-- Name: causa id_causa; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.causa ALTER COLUMN id_causa SET DEFAULT nextval('ggto_sync.causa_id_causa_seq'::regclass);


--
-- Name: central id_central; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.central ALTER COLUMN id_central SET DEFAULT nextval('ggto_sync.central_id_central_seq'::regclass);


--
-- Name: cita id_cita; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cita ALTER COLUMN id_cita SET DEFAULT nextval('ggto_sync.cita_id_cita_seq'::regclass);


--
-- Name: cuadrilla id_cuadrilla; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla ALTER COLUMN id_cuadrilla SET DEFAULT nextval('ggto_sync.cuadrilla_id_cuadrilla_seq'::regclass);


--
-- Name: cuadrilla_sector_dia id_asignacion; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_sector_dia ALTER COLUMN id_asignacion SET DEFAULT nextval('ggto_sync.cuadrilla_sector_dia_id_asignacion_seq'::regclass);


--
-- Name: despacho id_despacho; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.despacho ALTER COLUMN id_despacho SET DEFAULT nextval('ggto_sync.despacho_id_despacho_seq'::regclass);


--
-- Name: despacho_caso id_despacho_caso; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.despacho_caso ALTER COLUMN id_despacho_caso SET DEFAULT nextval('ggto_sync.despacho_caso_id_despacho_caso_seq'::regclass);


--
-- Name: dispositivo_seguridad id_dispositivo; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.dispositivo_seguridad ALTER COLUMN id_dispositivo SET DEFAULT nextval('ggto_sync.dispositivo_seguridad_id_dispositivo_seq'::regclass);


--
-- Name: evidencia id_evidencia; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.evidencia ALTER COLUMN id_evidencia SET DEFAULT nextval('ggto_sync.evidencia_id_evidencia_seq'::regclass);


--
-- Name: falla_masiva id_falla; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.falla_masiva ALTER COLUMN id_falla SET DEFAULT nextval('ggto_sync.falla_masiva_id_falla_seq'::regclass);


--
-- Name: flota id_flota; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.flota ALTER COLUMN id_flota SET DEFAULT nextval('ggto_sync.flota_id_flota_seq'::regclass);


--
-- Name: herramienta id_herramienta; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.herramienta ALTER COLUMN id_herramienta SET DEFAULT nextval('ggto_sync.herramienta_id_herramienta_seq'::regclass);


--
-- Name: incidente id_incidente; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.incidente ALTER COLUMN id_incidente SET DEFAULT nextval('ggto_sync.incidente_id_incidente_seq'::regclass);


--
-- Name: ingesta_lote id_lote; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.ingesta_lote ALTER COLUMN id_lote SET DEFAULT nextval('ggto_sync.ingesta_lote_id_lote_seq'::regclass);


--
-- Name: insumo id_insumo; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.insumo ALTER COLUMN id_insumo SET DEFAULT nextval('ggto_sync.insumo_id_insumo_seq'::regclass);


--
-- Name: inventario_movimiento id_mov; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.inventario_movimiento ALTER COLUMN id_mov SET DEFAULT nextval('ggto_sync.inventario_movimiento_id_mov_seq'::regclass);


--
-- Name: notificacion id_notificacion; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.notificacion ALTER COLUMN id_notificacion SET DEFAULT nextval('ggto_sync.notificacion_id_notificacion_seq'::regclass);


--
-- Name: orden_material id_orden; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.orden_material ALTER COLUMN id_orden SET DEFAULT nextval('ggto_sync.orden_material_id_orden_seq'::regclass);


--
-- Name: orden_material_detalle id_orden_detalle; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.orden_material_detalle ALTER COLUMN id_orden_detalle SET DEFAULT nextval('ggto_sync.orden_material_detalle_id_orden_detalle_seq'::regclass);


--
-- Name: rol id_rol; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.rol ALTER COLUMN id_rol SET DEFAULT nextval('ggto_sync.rol_id_rol_seq'::regclass);


--
-- Name: sector id_sector; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sector ALTER COLUMN id_sector SET DEFAULT nextval('ggto_sync.sector_id_sector_seq'::regclass);


--
-- Name: sector_direccion id_sector_direccion; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sector_direccion ALTER COLUMN id_sector_direccion SET DEFAULT nextval('ggto_sync.sector_direccion_id_sector_direccion_seq'::regclass);


--
-- Name: seguimiento id_seguimiento; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.seguimiento ALTER COLUMN id_seguimiento SET DEFAULT nextval('ggto_sync.seguimiento_id_seguimiento_seq'::regclass);


--
-- Name: sincronizacion id_sync; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sincronizacion ALTER COLUMN id_sync SET DEFAULT nextval('ggto_sync.sincronizacion_id_sync_seq'::regclass);


--
-- Name: solicitante id_solicitante; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.solicitante ALTER COLUMN id_solicitante SET DEFAULT nextval('ggto_sync.solicitante_id_solicitante_seq'::regclass);


--
-- Name: sync_log id_sync_log; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sync_log ALTER COLUMN id_sync_log SET DEFAULT nextval('ggto_sync.sync_log_id_sync_log_seq'::regclass);


--
-- Name: tecnico id_tecnico; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.tecnico ALTER COLUMN id_tecnico SET DEFAULT nextval('ggto_sync.tecnico_id_tecnico_seq'::regclass);


--
-- Name: usuario id_usuario; Type: DEFAULT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.usuario ALTER COLUMN id_usuario SET DEFAULT nextval('ggto_sync.usuario_id_usuario_seq'::regclass);


--
-- Name: actividad id_actividad; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.actividad ALTER COLUMN id_actividad SET DEFAULT nextval('ggto_test.actividad_id_actividad_seq'::regclass);


--
-- Name: auditoria id_auditoria; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.auditoria ALTER COLUMN id_auditoria SET DEFAULT nextval('ggto_test.auditoria_id_auditoria_seq'::regclass);


--
-- Name: caso id_caso; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso ALTER COLUMN id_caso SET DEFAULT nextval('ggto_test.caso_id_caso_seq'::regclass);


--
-- Name: caso_especial id_caso_especial; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso_especial ALTER COLUMN id_caso_especial SET DEFAULT nextval('ggto_test.caso_especial_id_caso_especial_seq'::regclass);


--
-- Name: caso_estado_hist id_hist; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso_estado_hist ALTER COLUMN id_hist SET DEFAULT nextval('ggto_test.caso_estado_hist_id_hist_seq'::regclass);


--
-- Name: catalogo_metodo id_metodo; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.catalogo_metodo ALTER COLUMN id_metodo SET DEFAULT nextval('ggto_test.catalogo_metodo_id_metodo_seq'::regclass);


--
-- Name: causa id_causa; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.causa ALTER COLUMN id_causa SET DEFAULT nextval('ggto_test.causa_id_causa_seq'::regclass);


--
-- Name: central id_central; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.central ALTER COLUMN id_central SET DEFAULT nextval('ggto_test.central_id_central_seq'::regclass);


--
-- Name: cita id_cita; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cita ALTER COLUMN id_cita SET DEFAULT nextval('ggto_test.cita_id_cita_seq'::regclass);


--
-- Name: cuadrilla id_cuadrilla; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla ALTER COLUMN id_cuadrilla SET DEFAULT nextval('ggto_test.cuadrilla_id_cuadrilla_seq'::regclass);


--
-- Name: cuadrilla_sector_dia id_asignacion; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_sector_dia ALTER COLUMN id_asignacion SET DEFAULT nextval('ggto_test.cuadrilla_sector_dia_id_asignacion_seq'::regclass);


--
-- Name: despacho id_despacho; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.despacho ALTER COLUMN id_despacho SET DEFAULT nextval('ggto_test.despacho_id_despacho_seq'::regclass);


--
-- Name: despacho_caso id_despacho_caso; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.despacho_caso ALTER COLUMN id_despacho_caso SET DEFAULT nextval('ggto_test.despacho_caso_id_despacho_caso_seq'::regclass);


--
-- Name: dispositivo_seguridad id_dispositivo; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.dispositivo_seguridad ALTER COLUMN id_dispositivo SET DEFAULT nextval('ggto_test.dispositivo_seguridad_id_dispositivo_seq'::regclass);


--
-- Name: evidencia id_evidencia; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.evidencia ALTER COLUMN id_evidencia SET DEFAULT nextval('ggto_test.evidencia_id_evidencia_seq'::regclass);


--
-- Name: falla_masiva id_falla; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.falla_masiva ALTER COLUMN id_falla SET DEFAULT nextval('ggto_test.falla_masiva_id_falla_seq'::regclass);


--
-- Name: flota id_flota; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.flota ALTER COLUMN id_flota SET DEFAULT nextval('ggto_test.flota_id_flota_seq'::regclass);


--
-- Name: herramienta id_herramienta; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.herramienta ALTER COLUMN id_herramienta SET DEFAULT nextval('ggto_test.herramienta_id_herramienta_seq'::regclass);


--
-- Name: incidente id_incidente; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.incidente ALTER COLUMN id_incidente SET DEFAULT nextval('ggto_test.incidente_id_incidente_seq'::regclass);


--
-- Name: ingesta_lote id_lote; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.ingesta_lote ALTER COLUMN id_lote SET DEFAULT nextval('ggto_test.ingesta_lote_id_lote_seq'::regclass);


--
-- Name: insumo id_insumo; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.insumo ALTER COLUMN id_insumo SET DEFAULT nextval('ggto_test.insumo_id_insumo_seq'::regclass);


--
-- Name: inventario_movimiento id_mov; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.inventario_movimiento ALTER COLUMN id_mov SET DEFAULT nextval('ggto_test.inventario_movimiento_id_mov_seq'::regclass);


--
-- Name: mensaje id_mensaje; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.mensaje ALTER COLUMN id_mensaje SET DEFAULT nextval('ggto_test.mensaje_id_mensaje_seq'::regclass);


--
-- Name: notificacion id_notificacion; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.notificacion ALTER COLUMN id_notificacion SET DEFAULT nextval('ggto_test.notificacion_id_notificacion_seq'::regclass);


--
-- Name: orden_material id_orden; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.orden_material ALTER COLUMN id_orden SET DEFAULT nextval('ggto_test.orden_material_id_orden_seq'::regclass);


--
-- Name: orden_material_detalle id_orden_detalle; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.orden_material_detalle ALTER COLUMN id_orden_detalle SET DEFAULT nextval('ggto_test.orden_material_detalle_id_orden_detalle_seq'::regclass);


--
-- Name: rol id_rol; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.rol ALTER COLUMN id_rol SET DEFAULT nextval('ggto_test.rol_id_rol_seq'::regclass);


--
-- Name: sector id_sector; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sector ALTER COLUMN id_sector SET DEFAULT nextval('ggto_test.sector_id_sector_seq'::regclass);


--
-- Name: sector_direccion id_sector_direccion; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sector_direccion ALTER COLUMN id_sector_direccion SET DEFAULT nextval('ggto_test.sector_direccion_id_sector_direccion_seq'::regclass);


--
-- Name: seguimiento id_seguimiento; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.seguimiento ALTER COLUMN id_seguimiento SET DEFAULT nextval('ggto_test.seguimiento_id_seguimiento_seq'::regclass);


--
-- Name: sincronizacion id_sync; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sincronizacion ALTER COLUMN id_sync SET DEFAULT nextval('ggto_test.sincronizacion_id_sync_seq'::regclass);


--
-- Name: solicitante id_solicitante; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.solicitante ALTER COLUMN id_solicitante SET DEFAULT nextval('ggto_test.solicitante_id_solicitante_seq'::regclass);


--
-- Name: sync_check id_sync_check; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sync_check ALTER COLUMN id_sync_check SET DEFAULT nextval('ggto_test.sync_check_id_sync_check_seq'::regclass);


--
-- Name: sync_log id_sync_log; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sync_log ALTER COLUMN id_sync_log SET DEFAULT nextval('ggto_test.sync_log_id_sync_log_seq'::regclass);


--
-- Name: tecnico id_tecnico; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.tecnico ALTER COLUMN id_tecnico SET DEFAULT nextval('ggto_test.tecnico_id_tecnico_seq'::regclass);


--
-- Name: usuario id_usuario; Type: DEFAULT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.usuario ALTER COLUMN id_usuario SET DEFAULT nextval('ggto_test.usuario_id_usuario_seq'::regclass);


--
-- Name: actividad id_actividad; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad ALTER COLUMN id_actividad SET DEFAULT nextval('public.actividad_id_actividad_seq'::regclass);


--
-- Name: auditoria id_auditoria; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria ALTER COLUMN id_auditoria SET DEFAULT nextval('public.auditoria_id_auditoria_seq'::regclass);


--
-- Name: caso id_caso; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso ALTER COLUMN id_caso SET DEFAULT nextval('public.caso_id_caso_seq'::regclass);


--
-- Name: caso_especial id_caso_especial; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso_especial ALTER COLUMN id_caso_especial SET DEFAULT nextval('public.caso_especial_id_caso_especial_seq'::regclass);


--
-- Name: caso_estado_hist id_hist; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso_estado_hist ALTER COLUMN id_hist SET DEFAULT nextval('public.caso_estado_hist_id_hist_seq'::regclass);


--
-- Name: catalogo_metodo id_metodo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_metodo ALTER COLUMN id_metodo SET DEFAULT nextval('public.catalogo_metodo_id_metodo_seq'::regclass);


--
-- Name: causa id_causa; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.causa ALTER COLUMN id_causa SET DEFAULT nextval('public.causa_id_causa_seq'::regclass);


--
-- Name: central id_central; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.central ALTER COLUMN id_central SET DEFAULT nextval('public.central_id_central_seq'::regclass);


--
-- Name: cita id_cita; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cita ALTER COLUMN id_cita SET DEFAULT nextval('public.cita_id_cita_seq'::regclass);


--
-- Name: cuadrilla id_cuadrilla; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla ALTER COLUMN id_cuadrilla SET DEFAULT nextval('public.cuadrilla_id_cuadrilla_seq'::regclass);


--
-- Name: cuadrilla_sector_dia id_asignacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_sector_dia ALTER COLUMN id_asignacion SET DEFAULT nextval('public.cuadrilla_sector_dia_id_asignacion_seq'::regclass);


--
-- Name: despacho id_despacho; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho ALTER COLUMN id_despacho SET DEFAULT nextval('public.despacho_id_despacho_seq'::regclass);


--
-- Name: despacho_caso id_despacho_caso; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho_caso ALTER COLUMN id_despacho_caso SET DEFAULT nextval('public.despacho_caso_id_despacho_caso_seq'::regclass);


--
-- Name: dispositivo_seguridad id_dispositivo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivo_seguridad ALTER COLUMN id_dispositivo SET DEFAULT nextval('public.dispositivo_seguridad_id_dispositivo_seq'::regclass);


--
-- Name: evidencia id_evidencia; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia ALTER COLUMN id_evidencia SET DEFAULT nextval('public.evidencia_id_evidencia_seq'::regclass);


--
-- Name: falla_masiva id_falla; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva ALTER COLUMN id_falla SET DEFAULT nextval('public.falla_masiva_id_falla_seq'::regclass);


--
-- Name: falla_masiva_caso id_asociacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva_caso ALTER COLUMN id_asociacion SET DEFAULT nextval('public.falla_masiva_caso_id_asociacion_seq'::regclass);


--
-- Name: flota id_flota; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flota ALTER COLUMN id_flota SET DEFAULT nextval('public.flota_id_flota_seq'::regclass);


--
-- Name: herramienta id_herramienta; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.herramienta ALTER COLUMN id_herramienta SET DEFAULT nextval('public.herramienta_id_herramienta_seq'::regclass);


--
-- Name: identificador_pago id_pago; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identificador_pago ALTER COLUMN id_pago SET DEFAULT nextval('public.identificador_pago_id_pago_seq'::regclass);


--
-- Name: incidente id_incidente; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidente ALTER COLUMN id_incidente SET DEFAULT nextval('public.incidente_id_incidente_seq'::regclass);


--
-- Name: ingesta_lote id_lote; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingesta_lote ALTER COLUMN id_lote SET DEFAULT nextval('public.ingesta_lote_id_lote_seq'::regclass);


--
-- Name: insumo id_insumo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insumo ALTER COLUMN id_insumo SET DEFAULT nextval('public.insumo_id_insumo_seq'::regclass);


--
-- Name: inventario_movimiento id_mov; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventario_movimiento ALTER COLUMN id_mov SET DEFAULT nextval('public.inventario_movimiento_id_mov_seq'::regclass);


--
-- Name: mensaje id_mensaje; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje ALTER COLUMN id_mensaje SET DEFAULT nextval('public.mensaje_id_mensaje_seq'::regclass);


--
-- Name: mensaje_destino id_destino; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje_destino ALTER COLUMN id_destino SET DEFAULT nextval('public.mensaje_destino_id_destino_seq'::regclass);


--
-- Name: notificacion id_notificacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion ALTER COLUMN id_notificacion SET DEFAULT nextval('public.notificacion_id_notificacion_seq'::regclass);


--
-- Name: orden_material id_orden; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_material ALTER COLUMN id_orden SET DEFAULT nextval('public.orden_material_id_orden_seq'::regclass);


--
-- Name: orden_material_detalle id_orden_detalle; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_material_detalle ALTER COLUMN id_orden_detalle SET DEFAULT nextval('public.orden_material_detalle_id_orden_detalle_seq'::regclass);


--
-- Name: rol id_rol; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol ALTER COLUMN id_rol SET DEFAULT nextval('public.rol_id_rol_seq'::regclass);


--
-- Name: sector id_sector; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sector ALTER COLUMN id_sector SET DEFAULT nextval('public.sector_id_sector_seq'::regclass);


--
-- Name: sector_direccion id_sector_direccion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sector_direccion ALTER COLUMN id_sector_direccion SET DEFAULT nextval('public.sector_direccion_id_sector_direccion_seq'::regclass);


--
-- Name: seguimiento id_seguimiento; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguimiento ALTER COLUMN id_seguimiento SET DEFAULT nextval('public.seguimiento_id_seguimiento_seq'::regclass);


--
-- Name: sincronizacion id_sync; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sincronizacion ALTER COLUMN id_sync SET DEFAULT nextval('public.sincronizacion_id_sync_seq'::regclass);


--
-- Name: solicitante id_solicitante; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitante ALTER COLUMN id_solicitante SET DEFAULT nextval('public.solicitante_id_solicitante_seq'::regclass);


--
-- Name: sync_check id_sync_check; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_check ALTER COLUMN id_sync_check SET DEFAULT nextval('public.sync_check_id_sync_check_seq'::regclass);


--
-- Name: sync_log id_sync_log; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_log ALTER COLUMN id_sync_log SET DEFAULT nextval('public.sync_log_id_sync_log_seq'::regclass);


--
-- Name: tecnico id_tecnico; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tecnico ALTER COLUMN id_tecnico SET DEFAULT nextval('public.tecnico_id_tecnico_seq'::regclass);


--
-- Name: usuario id_usuario; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuario_id_usuario_seq'::regclass);


--
-- Name: actividad actividad_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.actividad
    ADD CONSTRAINT actividad_pkey PRIMARY KEY (id_actividad);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id_auditoria);


--
-- Name: caso_especial caso_especial_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso_especial
    ADD CONSTRAINT caso_especial_pkey PRIMARY KEY (id_caso_especial);


--
-- Name: caso_estado_hist caso_estado_hist_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_pkey PRIMARY KEY (id_hist);


--
-- Name: caso caso_id_averia_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso
    ADD CONSTRAINT caso_id_averia_key UNIQUE (id_averia);


--
-- Name: caso caso_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso
    ADD CONSTRAINT caso_pkey PRIMARY KEY (id_caso);


--
-- Name: catalogo_metodo catalogo_metodo_dominio_codigo_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.catalogo_metodo
    ADD CONSTRAINT catalogo_metodo_dominio_codigo_key UNIQUE (dominio, codigo);


--
-- Name: catalogo_metodo catalogo_metodo_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.catalogo_metodo
    ADD CONSTRAINT catalogo_metodo_pkey PRIMARY KEY (id_metodo);


--
-- Name: causa causa_codigo_causa_subcodigo_causa_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.causa
    ADD CONSTRAINT causa_codigo_causa_subcodigo_causa_key UNIQUE (codigo_causa, subcodigo_causa);


--
-- Name: causa causa_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.causa
    ADD CONSTRAINT causa_pkey PRIMARY KEY (id_causa);


--
-- Name: central central_codigo_central_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.central
    ADD CONSTRAINT central_codigo_central_key UNIQUE (codigo_central);


--
-- Name: central central_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.central
    ADD CONSTRAINT central_pkey PRIMARY KEY (id_central);


--
-- Name: cita cita_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cita
    ADD CONSTRAINT cita_pkey PRIMARY KEY (id_cita);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (clave);


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_pkey PRIMARY KEY (id_cuadrilla, id_herramienta, asignada_en);


--
-- Name: cuadrilla cuadrilla_id_central_codigo_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla
    ADD CONSTRAINT cuadrilla_id_central_codigo_key UNIQUE (id_central, codigo);


--
-- Name: cuadrilla cuadrilla_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla
    ADD CONSTRAINT cuadrilla_pkey PRIMARY KEY (id_cuadrilla);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_fecha_id_sector_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_fecha_id_sector_key UNIQUE (fecha, id_sector);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_pkey PRIMARY KEY (id_asignacion);


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_pkey PRIMARY KEY (id_cuadrilla, id_tecnico, desde);


--
-- Name: despacho_caso despacho_caso_id_despacho_id_caso_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.despacho_caso
    ADD CONSTRAINT despacho_caso_id_despacho_id_caso_key UNIQUE (id_despacho, id_caso);


--
-- Name: despacho_caso despacho_caso_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.despacho_caso
    ADD CONSTRAINT despacho_caso_pkey PRIMARY KEY (id_despacho_caso);


--
-- Name: despacho despacho_fecha_id_cuadrilla_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.despacho
    ADD CONSTRAINT despacho_fecha_id_cuadrilla_key UNIQUE (fecha, id_cuadrilla);


--
-- Name: despacho despacho_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.despacho
    ADD CONSTRAINT despacho_pkey PRIMARY KEY (id_despacho);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_p00_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_p00_key UNIQUE (p00);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_pkey PRIMARY KEY (id_dispositivo);


--
-- Name: evidencia evidencia_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.evidencia
    ADD CONSTRAINT evidencia_pkey PRIMARY KEY (id_evidencia);


--
-- Name: evidencia evidencia_serial_imagen_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.evidencia
    ADD CONSTRAINT evidencia_serial_imagen_key UNIQUE (serial_imagen);


--
-- Name: falla_masiva falla_masiva_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.falla_masiva
    ADD CONSTRAINT falla_masiva_pkey PRIMARY KEY (id_falla);


--
-- Name: flota flota_can_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.flota
    ADD CONSTRAINT flota_can_key UNIQUE (can);


--
-- Name: flota flota_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.flota
    ADD CONSTRAINT flota_pkey PRIMARY KEY (id_flota);


--
-- Name: flota flota_placa_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.flota
    ADD CONSTRAINT flota_placa_key UNIQUE (placa);


--
-- Name: herramienta herramienta_codigo_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.herramienta
    ADD CONSTRAINT herramienta_codigo_key UNIQUE (codigo);


--
-- Name: herramienta herramienta_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.herramienta
    ADD CONSTRAINT herramienta_pkey PRIMARY KEY (id_herramienta);


--
-- Name: incidente incidente_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.incidente
    ADD CONSTRAINT incidente_pkey PRIMARY KEY (id_incidente);


--
-- Name: ingesta_lote ingesta_lote_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.ingesta_lote
    ADD CONSTRAINT ingesta_lote_pkey PRIMARY KEY (id_lote);


--
-- Name: insumo insumo_codigo_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.insumo
    ADD CONSTRAINT insumo_codigo_key UNIQUE (codigo);


--
-- Name: insumo insumo_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.insumo
    ADD CONSTRAINT insumo_pkey PRIMARY KEY (id_insumo);


--
-- Name: inventario_movimiento inventario_movimiento_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_pkey PRIMARY KEY (id_mov);


--
-- Name: notificacion notificacion_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.notificacion
    ADD CONSTRAINT notificacion_pkey PRIMARY KEY (id_notificacion);


--
-- Name: orden_material_detalle orden_material_detalle_id_orden_id_insumo_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_orden_id_insumo_key UNIQUE (id_orden, id_insumo);


--
-- Name: orden_material_detalle orden_material_detalle_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_pkey PRIMARY KEY (id_orden_detalle);


--
-- Name: orden_material orden_material_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.orden_material
    ADD CONSTRAINT orden_material_pkey PRIMARY KEY (id_orden);


--
-- Name: rol rol_codigo_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.rol
    ADD CONSTRAINT rol_codigo_key UNIQUE (codigo);


--
-- Name: rol rol_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.rol
    ADD CONSTRAINT rol_pkey PRIMARY KEY (id_rol);


--
-- Name: sector_direccion sector_direccion_id_sector_patron_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sector_direccion
    ADD CONSTRAINT sector_direccion_id_sector_patron_key UNIQUE (id_sector, patron);


--
-- Name: sector_direccion sector_direccion_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sector_direccion
    ADD CONSTRAINT sector_direccion_pkey PRIMARY KEY (id_sector_direccion);


--
-- Name: sector sector_id_central_codigo_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sector
    ADD CONSTRAINT sector_id_central_codigo_key UNIQUE (id_central, codigo);


--
-- Name: sector sector_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sector
    ADD CONSTRAINT sector_pkey PRIMARY KEY (id_sector);


--
-- Name: seguimiento seguimiento_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.seguimiento
    ADD CONSTRAINT seguimiento_pkey PRIMARY KEY (id_seguimiento);


--
-- Name: sincronizacion sincronizacion_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sincronizacion
    ADD CONSTRAINT sincronizacion_pkey PRIMARY KEY (id_sync);


--
-- Name: solicitante solicitante_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.solicitante
    ADD CONSTRAINT solicitante_pkey PRIMARY KEY (id_solicitante);


--
-- Name: sync_log sync_log_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sync_log
    ADD CONSTRAINT sync_log_pkey PRIMARY KEY (id_sync_log);


--
-- Name: tecnico tecnico_cedula_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.tecnico
    ADD CONSTRAINT tecnico_cedula_key UNIQUE (cedula);


--
-- Name: tecnico tecnico_p00_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.tecnico
    ADD CONSTRAINT tecnico_p00_key UNIQUE (p00);


--
-- Name: tecnico tecnico_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.tecnico
    ADD CONSTRAINT tecnico_pkey PRIMARY KEY (id_tecnico);


--
-- Name: usuario usuario_correo_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.usuario
    ADD CONSTRAINT usuario_correo_key UNIQUE (correo);


--
-- Name: usuario usuario_p00_key; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.usuario
    ADD CONSTRAINT usuario_p00_key UNIQUE (p00);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario);


--
-- Name: actividad actividad_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.actividad
    ADD CONSTRAINT actividad_pkey PRIMARY KEY (id_actividad);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id_auditoria);


--
-- Name: caso_especial caso_especial_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso_especial
    ADD CONSTRAINT caso_especial_pkey PRIMARY KEY (id_caso_especial);


--
-- Name: caso_estado_hist caso_estado_hist_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_pkey PRIMARY KEY (id_hist);


--
-- Name: caso caso_id_averia_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso
    ADD CONSTRAINT caso_id_averia_key UNIQUE (id_averia);


--
-- Name: caso caso_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso
    ADD CONSTRAINT caso_pkey PRIMARY KEY (id_caso);


--
-- Name: catalogo_metodo catalogo_metodo_dominio_codigo_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.catalogo_metodo
    ADD CONSTRAINT catalogo_metodo_dominio_codigo_key UNIQUE (dominio, codigo);


--
-- Name: catalogo_metodo catalogo_metodo_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.catalogo_metodo
    ADD CONSTRAINT catalogo_metodo_pkey PRIMARY KEY (id_metodo);


--
-- Name: causa causa_codigo_causa_subcodigo_causa_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.causa
    ADD CONSTRAINT causa_codigo_causa_subcodigo_causa_key UNIQUE (codigo_causa, subcodigo_causa);


--
-- Name: causa causa_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.causa
    ADD CONSTRAINT causa_pkey PRIMARY KEY (id_causa);


--
-- Name: central central_codigo_central_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.central
    ADD CONSTRAINT central_codigo_central_key UNIQUE (codigo_central);


--
-- Name: central central_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.central
    ADD CONSTRAINT central_pkey PRIMARY KEY (id_central);


--
-- Name: cita cita_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cita
    ADD CONSTRAINT cita_pkey PRIMARY KEY (id_cita);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (clave);


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_pkey PRIMARY KEY (id_cuadrilla, id_herramienta, asignada_en);


--
-- Name: cuadrilla cuadrilla_id_central_codigo_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla
    ADD CONSTRAINT cuadrilla_id_central_codigo_key UNIQUE (id_central, codigo);


--
-- Name: cuadrilla cuadrilla_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla
    ADD CONSTRAINT cuadrilla_pkey PRIMARY KEY (id_cuadrilla);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_fecha_id_sector_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_fecha_id_sector_key UNIQUE (fecha, id_sector);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_pkey PRIMARY KEY (id_asignacion);


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_pkey PRIMARY KEY (id_cuadrilla, id_tecnico, desde);


--
-- Name: despacho_caso despacho_caso_id_despacho_id_caso_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.despacho_caso
    ADD CONSTRAINT despacho_caso_id_despacho_id_caso_key UNIQUE (id_despacho, id_caso);


--
-- Name: despacho_caso despacho_caso_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.despacho_caso
    ADD CONSTRAINT despacho_caso_pkey PRIMARY KEY (id_despacho_caso);


--
-- Name: despacho despacho_fecha_id_cuadrilla_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.despacho
    ADD CONSTRAINT despacho_fecha_id_cuadrilla_key UNIQUE (fecha, id_cuadrilla);


--
-- Name: despacho despacho_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.despacho
    ADD CONSTRAINT despacho_pkey PRIMARY KEY (id_despacho);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_p00_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_p00_key UNIQUE (p00);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_pkey PRIMARY KEY (id_dispositivo);


--
-- Name: evidencia evidencia_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.evidencia
    ADD CONSTRAINT evidencia_pkey PRIMARY KEY (id_evidencia);


--
-- Name: evidencia evidencia_serial_imagen_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.evidencia
    ADD CONSTRAINT evidencia_serial_imagen_key UNIQUE (serial_imagen);


--
-- Name: falla_masiva falla_masiva_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.falla_masiva
    ADD CONSTRAINT falla_masiva_pkey PRIMARY KEY (id_falla);


--
-- Name: flota flota_can_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.flota
    ADD CONSTRAINT flota_can_key UNIQUE (can);


--
-- Name: flota flota_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.flota
    ADD CONSTRAINT flota_pkey PRIMARY KEY (id_flota);


--
-- Name: flota flota_placa_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.flota
    ADD CONSTRAINT flota_placa_key UNIQUE (placa);


--
-- Name: herramienta herramienta_codigo_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.herramienta
    ADD CONSTRAINT herramienta_codigo_key UNIQUE (codigo);


--
-- Name: herramienta herramienta_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.herramienta
    ADD CONSTRAINT herramienta_pkey PRIMARY KEY (id_herramienta);


--
-- Name: incidente incidente_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.incidente
    ADD CONSTRAINT incidente_pkey PRIMARY KEY (id_incidente);


--
-- Name: ingesta_lote ingesta_lote_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.ingesta_lote
    ADD CONSTRAINT ingesta_lote_pkey PRIMARY KEY (id_lote);


--
-- Name: insumo insumo_codigo_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.insumo
    ADD CONSTRAINT insumo_codigo_key UNIQUE (codigo);


--
-- Name: insumo insumo_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.insumo
    ADD CONSTRAINT insumo_pkey PRIMARY KEY (id_insumo);


--
-- Name: inventario_movimiento inventario_movimiento_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_pkey PRIMARY KEY (id_mov);


--
-- Name: mensaje mensaje_dedupe_key_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.mensaje
    ADD CONSTRAINT mensaje_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: mensaje_destino mensaje_destino_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.mensaje_destino
    ADD CONSTRAINT mensaje_destino_pkey PRIMARY KEY (id_mensaje, id_tecnico);


--
-- Name: mensaje mensaje_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.mensaje
    ADD CONSTRAINT mensaje_pkey PRIMARY KEY (id_mensaje);


--
-- Name: notificacion notificacion_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.notificacion
    ADD CONSTRAINT notificacion_pkey PRIMARY KEY (id_notificacion);


--
-- Name: orden_material_detalle orden_material_detalle_id_orden_id_insumo_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_orden_id_insumo_key UNIQUE (id_orden, id_insumo);


--
-- Name: orden_material_detalle orden_material_detalle_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_pkey PRIMARY KEY (id_orden_detalle);


--
-- Name: orden_material orden_material_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.orden_material
    ADD CONSTRAINT orden_material_pkey PRIMARY KEY (id_orden);


--
-- Name: rol rol_codigo_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.rol
    ADD CONSTRAINT rol_codigo_key UNIQUE (codigo);


--
-- Name: rol rol_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.rol
    ADD CONSTRAINT rol_pkey PRIMARY KEY (id_rol);


--
-- Name: sector_direccion sector_direccion_id_sector_patron_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sector_direccion
    ADD CONSTRAINT sector_direccion_id_sector_patron_key UNIQUE (id_sector, patron);


--
-- Name: sector_direccion sector_direccion_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sector_direccion
    ADD CONSTRAINT sector_direccion_pkey PRIMARY KEY (id_sector_direccion);


--
-- Name: sector sector_id_central_codigo_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sector
    ADD CONSTRAINT sector_id_central_codigo_key UNIQUE (id_central, codigo);


--
-- Name: sector sector_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sector
    ADD CONSTRAINT sector_pkey PRIMARY KEY (id_sector);


--
-- Name: seguimiento seguimiento_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.seguimiento
    ADD CONSTRAINT seguimiento_pkey PRIMARY KEY (id_seguimiento);


--
-- Name: sincronizacion sincronizacion_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sincronizacion
    ADD CONSTRAINT sincronizacion_pkey PRIMARY KEY (id_sync);


--
-- Name: solicitante solicitante_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.solicitante
    ADD CONSTRAINT solicitante_pkey PRIMARY KEY (id_solicitante);


--
-- Name: sync_check sync_check_id_sync_log_paso_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sync_check
    ADD CONSTRAINT sync_check_id_sync_log_paso_key UNIQUE (id_sync_log, paso);


--
-- Name: sync_check sync_check_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sync_check
    ADD CONSTRAINT sync_check_pkey PRIMARY KEY (id_sync_check);


--
-- Name: sync_log sync_log_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sync_log
    ADD CONSTRAINT sync_log_pkey PRIMARY KEY (id_sync_log);


--
-- Name: tecnico tecnico_cedula_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.tecnico
    ADD CONSTRAINT tecnico_cedula_key UNIQUE (cedula);


--
-- Name: tecnico tecnico_p00_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.tecnico
    ADD CONSTRAINT tecnico_p00_key UNIQUE (p00);


--
-- Name: tecnico tecnico_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.tecnico
    ADD CONSTRAINT tecnico_pkey PRIMARY KEY (id_tecnico);


--
-- Name: usuario usuario_correo_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.usuario
    ADD CONSTRAINT usuario_correo_key UNIQUE (correo);


--
-- Name: usuario usuario_p00_key; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.usuario
    ADD CONSTRAINT usuario_p00_key UNIQUE (p00);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario);


--
-- Name: actividad actividad_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.actividad
    ADD CONSTRAINT actividad_pkey PRIMARY KEY (id_actividad);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id_auditoria);


--
-- Name: caso_especial caso_especial_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso_especial
    ADD CONSTRAINT caso_especial_pkey PRIMARY KEY (id_caso_especial);


--
-- Name: caso_estado_hist caso_estado_hist_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_pkey PRIMARY KEY (id_hist);


--
-- Name: caso caso_id_averia_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso
    ADD CONSTRAINT caso_id_averia_key UNIQUE (id_averia);


--
-- Name: caso caso_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso
    ADD CONSTRAINT caso_pkey PRIMARY KEY (id_caso);


--
-- Name: catalogo_metodo catalogo_metodo_dominio_codigo_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.catalogo_metodo
    ADD CONSTRAINT catalogo_metodo_dominio_codigo_key UNIQUE (dominio, codigo);


--
-- Name: catalogo_metodo catalogo_metodo_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.catalogo_metodo
    ADD CONSTRAINT catalogo_metodo_pkey PRIMARY KEY (id_metodo);


--
-- Name: causa causa_codigo_causa_subcodigo_causa_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.causa
    ADD CONSTRAINT causa_codigo_causa_subcodigo_causa_key UNIQUE (codigo_causa, subcodigo_causa);


--
-- Name: causa causa_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.causa
    ADD CONSTRAINT causa_pkey PRIMARY KEY (id_causa);


--
-- Name: central central_codigo_central_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.central
    ADD CONSTRAINT central_codigo_central_key UNIQUE (codigo_central);


--
-- Name: central central_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.central
    ADD CONSTRAINT central_pkey PRIMARY KEY (id_central);


--
-- Name: cita cita_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cita
    ADD CONSTRAINT cita_pkey PRIMARY KEY (id_cita);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (clave);


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_pkey PRIMARY KEY (id_cuadrilla, id_herramienta, asignada_en);


--
-- Name: cuadrilla cuadrilla_id_central_codigo_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla
    ADD CONSTRAINT cuadrilla_id_central_codigo_key UNIQUE (id_central, codigo);


--
-- Name: cuadrilla cuadrilla_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla
    ADD CONSTRAINT cuadrilla_pkey PRIMARY KEY (id_cuadrilla);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_fecha_id_sector_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_fecha_id_sector_key UNIQUE (fecha, id_sector);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_pkey PRIMARY KEY (id_asignacion);


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_pkey PRIMARY KEY (id_cuadrilla, id_tecnico, desde);


--
-- Name: despacho_caso despacho_caso_id_despacho_id_caso_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.despacho_caso
    ADD CONSTRAINT despacho_caso_id_despacho_id_caso_key UNIQUE (id_despacho, id_caso);


--
-- Name: despacho_caso despacho_caso_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.despacho_caso
    ADD CONSTRAINT despacho_caso_pkey PRIMARY KEY (id_despacho_caso);


--
-- Name: despacho despacho_fecha_id_cuadrilla_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.despacho
    ADD CONSTRAINT despacho_fecha_id_cuadrilla_key UNIQUE (fecha, id_cuadrilla);


--
-- Name: despacho despacho_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.despacho
    ADD CONSTRAINT despacho_pkey PRIMARY KEY (id_despacho);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_p00_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_p00_key UNIQUE (p00);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_pkey PRIMARY KEY (id_dispositivo);


--
-- Name: evidencia evidencia_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.evidencia
    ADD CONSTRAINT evidencia_pkey PRIMARY KEY (id_evidencia);


--
-- Name: evidencia evidencia_serial_imagen_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.evidencia
    ADD CONSTRAINT evidencia_serial_imagen_key UNIQUE (serial_imagen);


--
-- Name: falla_masiva falla_masiva_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.falla_masiva
    ADD CONSTRAINT falla_masiva_pkey PRIMARY KEY (id_falla);


--
-- Name: flota flota_can_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.flota
    ADD CONSTRAINT flota_can_key UNIQUE (can);


--
-- Name: flota flota_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.flota
    ADD CONSTRAINT flota_pkey PRIMARY KEY (id_flota);


--
-- Name: flota flota_placa_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.flota
    ADD CONSTRAINT flota_placa_key UNIQUE (placa);


--
-- Name: herramienta herramienta_codigo_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.herramienta
    ADD CONSTRAINT herramienta_codigo_key UNIQUE (codigo);


--
-- Name: herramienta herramienta_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.herramienta
    ADD CONSTRAINT herramienta_pkey PRIMARY KEY (id_herramienta);


--
-- Name: incidente incidente_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.incidente
    ADD CONSTRAINT incidente_pkey PRIMARY KEY (id_incidente);


--
-- Name: ingesta_lote ingesta_lote_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.ingesta_lote
    ADD CONSTRAINT ingesta_lote_pkey PRIMARY KEY (id_lote);


--
-- Name: insumo insumo_codigo_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.insumo
    ADD CONSTRAINT insumo_codigo_key UNIQUE (codigo);


--
-- Name: insumo insumo_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.insumo
    ADD CONSTRAINT insumo_pkey PRIMARY KEY (id_insumo);


--
-- Name: inventario_movimiento inventario_movimiento_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_pkey PRIMARY KEY (id_mov);


--
-- Name: notificacion notificacion_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.notificacion
    ADD CONSTRAINT notificacion_pkey PRIMARY KEY (id_notificacion);


--
-- Name: orden_material_detalle orden_material_detalle_id_orden_id_insumo_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_orden_id_insumo_key UNIQUE (id_orden, id_insumo);


--
-- Name: orden_material_detalle orden_material_detalle_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_pkey PRIMARY KEY (id_orden_detalle);


--
-- Name: orden_material orden_material_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.orden_material
    ADD CONSTRAINT orden_material_pkey PRIMARY KEY (id_orden);


--
-- Name: rol rol_codigo_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.rol
    ADD CONSTRAINT rol_codigo_key UNIQUE (codigo);


--
-- Name: rol rol_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.rol
    ADD CONSTRAINT rol_pkey PRIMARY KEY (id_rol);


--
-- Name: sector_direccion sector_direccion_id_sector_patron_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sector_direccion
    ADD CONSTRAINT sector_direccion_id_sector_patron_key UNIQUE (id_sector, patron);


--
-- Name: sector_direccion sector_direccion_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sector_direccion
    ADD CONSTRAINT sector_direccion_pkey PRIMARY KEY (id_sector_direccion);


--
-- Name: sector sector_id_central_codigo_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sector
    ADD CONSTRAINT sector_id_central_codigo_key UNIQUE (id_central, codigo);


--
-- Name: sector sector_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sector
    ADD CONSTRAINT sector_pkey PRIMARY KEY (id_sector);


--
-- Name: seguimiento seguimiento_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.seguimiento
    ADD CONSTRAINT seguimiento_pkey PRIMARY KEY (id_seguimiento);


--
-- Name: sincronizacion sincronizacion_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sincronizacion
    ADD CONSTRAINT sincronizacion_pkey PRIMARY KEY (id_sync);


--
-- Name: solicitante solicitante_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.solicitante
    ADD CONSTRAINT solicitante_pkey PRIMARY KEY (id_solicitante);


--
-- Name: sync_log sync_log_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sync_log
    ADD CONSTRAINT sync_log_pkey PRIMARY KEY (id_sync_log);


--
-- Name: tecnico tecnico_cedula_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.tecnico
    ADD CONSTRAINT tecnico_cedula_key UNIQUE (cedula);


--
-- Name: tecnico tecnico_p00_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.tecnico
    ADD CONSTRAINT tecnico_p00_key UNIQUE (p00);


--
-- Name: tecnico tecnico_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.tecnico
    ADD CONSTRAINT tecnico_pkey PRIMARY KEY (id_tecnico);


--
-- Name: usuario usuario_correo_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.usuario
    ADD CONSTRAINT usuario_correo_key UNIQUE (correo);


--
-- Name: usuario usuario_p00_key; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.usuario
    ADD CONSTRAINT usuario_p00_key UNIQUE (p00);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario);


--
-- Name: actividad actividad_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.actividad
    ADD CONSTRAINT actividad_pkey PRIMARY KEY (id_actividad);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id_auditoria);


--
-- Name: caso_especial caso_especial_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso_especial
    ADD CONSTRAINT caso_especial_pkey PRIMARY KEY (id_caso_especial);


--
-- Name: caso_estado_hist caso_estado_hist_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_pkey PRIMARY KEY (id_hist);


--
-- Name: caso caso_id_averia_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso
    ADD CONSTRAINT caso_id_averia_key UNIQUE (id_averia);


--
-- Name: caso caso_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso
    ADD CONSTRAINT caso_pkey PRIMARY KEY (id_caso);


--
-- Name: catalogo_metodo catalogo_metodo_dominio_codigo_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.catalogo_metodo
    ADD CONSTRAINT catalogo_metodo_dominio_codigo_key UNIQUE (dominio, codigo);


--
-- Name: catalogo_metodo catalogo_metodo_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.catalogo_metodo
    ADD CONSTRAINT catalogo_metodo_pkey PRIMARY KEY (id_metodo);


--
-- Name: causa causa_codigo_causa_subcodigo_causa_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.causa
    ADD CONSTRAINT causa_codigo_causa_subcodigo_causa_key UNIQUE (codigo_causa, subcodigo_causa);


--
-- Name: causa causa_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.causa
    ADD CONSTRAINT causa_pkey PRIMARY KEY (id_causa);


--
-- Name: central central_codigo_central_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.central
    ADD CONSTRAINT central_codigo_central_key UNIQUE (codigo_central);


--
-- Name: central central_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.central
    ADD CONSTRAINT central_pkey PRIMARY KEY (id_central);


--
-- Name: cita cita_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cita
    ADD CONSTRAINT cita_pkey PRIMARY KEY (id_cita);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (clave);


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_pkey PRIMARY KEY (id_cuadrilla, id_herramienta, asignada_en);


--
-- Name: cuadrilla cuadrilla_id_central_codigo_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla
    ADD CONSTRAINT cuadrilla_id_central_codigo_key UNIQUE (id_central, codigo);


--
-- Name: cuadrilla cuadrilla_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla
    ADD CONSTRAINT cuadrilla_pkey PRIMARY KEY (id_cuadrilla);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_fecha_id_sector_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_fecha_id_sector_key UNIQUE (fecha, id_sector);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_pkey PRIMARY KEY (id_asignacion);


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_pkey PRIMARY KEY (id_cuadrilla, id_tecnico, desde);


--
-- Name: despacho_caso despacho_caso_id_despacho_id_caso_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.despacho_caso
    ADD CONSTRAINT despacho_caso_id_despacho_id_caso_key UNIQUE (id_despacho, id_caso);


--
-- Name: despacho_caso despacho_caso_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.despacho_caso
    ADD CONSTRAINT despacho_caso_pkey PRIMARY KEY (id_despacho_caso);


--
-- Name: despacho despacho_fecha_id_cuadrilla_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.despacho
    ADD CONSTRAINT despacho_fecha_id_cuadrilla_key UNIQUE (fecha, id_cuadrilla);


--
-- Name: despacho despacho_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.despacho
    ADD CONSTRAINT despacho_pkey PRIMARY KEY (id_despacho);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_p00_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_p00_key UNIQUE (p00);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_pkey PRIMARY KEY (id_dispositivo);


--
-- Name: evidencia evidencia_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.evidencia
    ADD CONSTRAINT evidencia_pkey PRIMARY KEY (id_evidencia);


--
-- Name: evidencia evidencia_serial_imagen_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.evidencia
    ADD CONSTRAINT evidencia_serial_imagen_key UNIQUE (serial_imagen);


--
-- Name: falla_masiva falla_masiva_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.falla_masiva
    ADD CONSTRAINT falla_masiva_pkey PRIMARY KEY (id_falla);


--
-- Name: flota flota_can_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.flota
    ADD CONSTRAINT flota_can_key UNIQUE (can);


--
-- Name: flota flota_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.flota
    ADD CONSTRAINT flota_pkey PRIMARY KEY (id_flota);


--
-- Name: flota flota_placa_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.flota
    ADD CONSTRAINT flota_placa_key UNIQUE (placa);


--
-- Name: herramienta herramienta_codigo_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.herramienta
    ADD CONSTRAINT herramienta_codigo_key UNIQUE (codigo);


--
-- Name: herramienta herramienta_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.herramienta
    ADD CONSTRAINT herramienta_pkey PRIMARY KEY (id_herramienta);


--
-- Name: incidente incidente_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.incidente
    ADD CONSTRAINT incidente_pkey PRIMARY KEY (id_incidente);


--
-- Name: ingesta_lote ingesta_lote_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.ingesta_lote
    ADD CONSTRAINT ingesta_lote_pkey PRIMARY KEY (id_lote);


--
-- Name: insumo insumo_codigo_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.insumo
    ADD CONSTRAINT insumo_codigo_key UNIQUE (codigo);


--
-- Name: insumo insumo_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.insumo
    ADD CONSTRAINT insumo_pkey PRIMARY KEY (id_insumo);


--
-- Name: inventario_movimiento inventario_movimiento_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_pkey PRIMARY KEY (id_mov);


--
-- Name: mensaje mensaje_dedupe_key_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.mensaje
    ADD CONSTRAINT mensaje_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: mensaje_destino mensaje_destino_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.mensaje_destino
    ADD CONSTRAINT mensaje_destino_pkey PRIMARY KEY (id_mensaje, id_tecnico);


--
-- Name: mensaje mensaje_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.mensaje
    ADD CONSTRAINT mensaje_pkey PRIMARY KEY (id_mensaje);


--
-- Name: notificacion notificacion_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.notificacion
    ADD CONSTRAINT notificacion_pkey PRIMARY KEY (id_notificacion);


--
-- Name: orden_material_detalle orden_material_detalle_id_orden_id_insumo_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_orden_id_insumo_key UNIQUE (id_orden, id_insumo);


--
-- Name: orden_material_detalle orden_material_detalle_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_pkey PRIMARY KEY (id_orden_detalle);


--
-- Name: orden_material orden_material_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.orden_material
    ADD CONSTRAINT orden_material_pkey PRIMARY KEY (id_orden);


--
-- Name: rol rol_codigo_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.rol
    ADD CONSTRAINT rol_codigo_key UNIQUE (codigo);


--
-- Name: rol rol_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.rol
    ADD CONSTRAINT rol_pkey PRIMARY KEY (id_rol);


--
-- Name: sector_direccion sector_direccion_id_sector_patron_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sector_direccion
    ADD CONSTRAINT sector_direccion_id_sector_patron_key UNIQUE (id_sector, patron);


--
-- Name: sector_direccion sector_direccion_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sector_direccion
    ADD CONSTRAINT sector_direccion_pkey PRIMARY KEY (id_sector_direccion);


--
-- Name: sector sector_id_central_codigo_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sector
    ADD CONSTRAINT sector_id_central_codigo_key UNIQUE (id_central, codigo);


--
-- Name: sector sector_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sector
    ADD CONSTRAINT sector_pkey PRIMARY KEY (id_sector);


--
-- Name: seguimiento seguimiento_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.seguimiento
    ADD CONSTRAINT seguimiento_pkey PRIMARY KEY (id_seguimiento);


--
-- Name: sincronizacion sincronizacion_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sincronizacion
    ADD CONSTRAINT sincronizacion_pkey PRIMARY KEY (id_sync);


--
-- Name: solicitante solicitante_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.solicitante
    ADD CONSTRAINT solicitante_pkey PRIMARY KEY (id_solicitante);


--
-- Name: sync_check sync_check_id_sync_log_paso_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sync_check
    ADD CONSTRAINT sync_check_id_sync_log_paso_key UNIQUE (id_sync_log, paso);


--
-- Name: sync_check sync_check_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sync_check
    ADD CONSTRAINT sync_check_pkey PRIMARY KEY (id_sync_check);


--
-- Name: sync_log sync_log_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sync_log
    ADD CONSTRAINT sync_log_pkey PRIMARY KEY (id_sync_log);


--
-- Name: tecnico tecnico_cedula_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.tecnico
    ADD CONSTRAINT tecnico_cedula_key UNIQUE (cedula);


--
-- Name: tecnico tecnico_p00_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.tecnico
    ADD CONSTRAINT tecnico_p00_key UNIQUE (p00);


--
-- Name: tecnico tecnico_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.tecnico
    ADD CONSTRAINT tecnico_pkey PRIMARY KEY (id_tecnico);


--
-- Name: usuario usuario_correo_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.usuario
    ADD CONSTRAINT usuario_correo_key UNIQUE (correo);


--
-- Name: usuario usuario_p00_key; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.usuario
    ADD CONSTRAINT usuario_p00_key UNIQUE (p00);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario);


--
-- Name: actividad actividad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad
    ADD CONSTRAINT actividad_pkey PRIMARY KEY (id_actividad);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id_auditoria);


--
-- Name: caso_d89_backup caso_d89_backup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso_d89_backup
    ADD CONSTRAINT caso_d89_backup_pkey PRIMARY KEY (id_caso);


--
-- Name: caso_especial caso_especial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso_especial
    ADD CONSTRAINT caso_especial_pkey PRIMARY KEY (id_caso_especial);


--
-- Name: caso_estado_hist caso_estado_hist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_pkey PRIMARY KEY (id_hist);


--
-- Name: caso caso_id_averia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso
    ADD CONSTRAINT caso_id_averia_key UNIQUE (id_averia);


--
-- Name: caso caso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso
    ADD CONSTRAINT caso_pkey PRIMARY KEY (id_caso);


--
-- Name: catalogo_metodo catalogo_metodo_dominio_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_metodo
    ADD CONSTRAINT catalogo_metodo_dominio_codigo_key UNIQUE (dominio, codigo);


--
-- Name: catalogo_metodo catalogo_metodo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_metodo
    ADD CONSTRAINT catalogo_metodo_pkey PRIMARY KEY (id_metodo);


--
-- Name: causa causa_codigo_causa_subcodigo_causa_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.causa
    ADD CONSTRAINT causa_codigo_causa_subcodigo_causa_key UNIQUE (codigo_causa, subcodigo_causa);


--
-- Name: causa causa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.causa
    ADD CONSTRAINT causa_pkey PRIMARY KEY (id_causa);


--
-- Name: central central_codigo_central_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.central
    ADD CONSTRAINT central_codigo_central_key UNIQUE (codigo_central);


--
-- Name: central central_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.central
    ADD CONSTRAINT central_pkey PRIMARY KEY (id_central);


--
-- Name: cita cita_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cita
    ADD CONSTRAINT cita_pkey PRIMARY KEY (id_cita);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (clave);


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_pkey PRIMARY KEY (id_cuadrilla, id_herramienta, asignada_en);


--
-- Name: cuadrilla cuadrilla_id_central_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla
    ADD CONSTRAINT cuadrilla_id_central_codigo_key UNIQUE (id_central, codigo);


--
-- Name: cuadrilla cuadrilla_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla
    ADD CONSTRAINT cuadrilla_pkey PRIMARY KEY (id_cuadrilla);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_fecha_id_sector_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_fecha_id_sector_key UNIQUE (fecha, id_sector);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_pkey PRIMARY KEY (id_asignacion);


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_pkey PRIMARY KEY (id_cuadrilla, id_tecnico, desde);


--
-- Name: despacho_caso despacho_caso_id_despacho_id_caso_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho_caso
    ADD CONSTRAINT despacho_caso_id_despacho_id_caso_key UNIQUE (id_despacho, id_caso);


--
-- Name: despacho_caso despacho_caso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho_caso
    ADD CONSTRAINT despacho_caso_pkey PRIMARY KEY (id_despacho_caso);


--
-- Name: despacho despacho_fecha_id_cuadrilla_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho
    ADD CONSTRAINT despacho_fecha_id_cuadrilla_key UNIQUE (fecha, id_cuadrilla);


--
-- Name: despacho_metrica_diaria despacho_metrica_diaria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho_metrica_diaria
    ADD CONSTRAINT despacho_metrica_diaria_pkey PRIMARY KEY (id_metrica);


--
-- Name: despacho_metrica_diaria despacho_metrica_diaria_unica; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho_metrica_diaria
    ADD CONSTRAINT despacho_metrica_diaria_unica UNIQUE (id_central, fecha, columna);


--
-- Name: despacho despacho_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho
    ADD CONSTRAINT despacho_pkey PRIMARY KEY (id_despacho);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_p00_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_p00_key UNIQUE (p00);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_pkey PRIMARY KEY (id_dispositivo);


--
-- Name: evidencia evidencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia
    ADD CONSTRAINT evidencia_pkey PRIMARY KEY (id_evidencia);


--
-- Name: evidencia evidencia_serial_imagen_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia
    ADD CONSTRAINT evidencia_serial_imagen_key UNIQUE (serial_imagen);


--
-- Name: falla_masiva_caso falla_masiva_caso_id_falla_id_caso_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva_caso
    ADD CONSTRAINT falla_masiva_caso_id_falla_id_caso_key UNIQUE (id_falla, id_caso);


--
-- Name: falla_masiva_caso falla_masiva_caso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva_caso
    ADD CONSTRAINT falla_masiva_caso_pkey PRIMARY KEY (id_asociacion);


--
-- Name: falla_masiva falla_masiva_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva
    ADD CONSTRAINT falla_masiva_pkey PRIMARY KEY (id_falla);


--
-- Name: flota flota_can_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flota
    ADD CONSTRAINT flota_can_key UNIQUE (can);


--
-- Name: flota flota_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flota
    ADD CONSTRAINT flota_pkey PRIMARY KEY (id_flota);


--
-- Name: flota flota_placa_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flota
    ADD CONSTRAINT flota_placa_key UNIQUE (placa);


--
-- Name: herramienta herramienta_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.herramienta
    ADD CONSTRAINT herramienta_codigo_key UNIQUE (codigo);


--
-- Name: herramienta herramienta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.herramienta
    ADD CONSTRAINT herramienta_pkey PRIMARY KEY (id_herramienta);


--
-- Name: identificador_pago identificador_pago_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identificador_pago
    ADD CONSTRAINT identificador_pago_pkey PRIMARY KEY (id_pago);


--
-- Name: incidente incidente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidente
    ADD CONSTRAINT incidente_pkey PRIMARY KEY (id_incidente);


--
-- Name: ingesta_lote ingesta_lote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingesta_lote
    ADD CONSTRAINT ingesta_lote_pkey PRIMARY KEY (id_lote);


--
-- Name: insumo insumo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insumo
    ADD CONSTRAINT insumo_codigo_key UNIQUE (codigo);


--
-- Name: insumo insumo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insumo
    ADD CONSTRAINT insumo_pkey PRIMARY KEY (id_insumo);


--
-- Name: inventario_movimiento inventario_movimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_pkey PRIMARY KEY (id_mov);


--
-- Name: mensaje mensaje_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje
    ADD CONSTRAINT mensaje_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: mensaje mensaje_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje
    ADD CONSTRAINT mensaje_pkey PRIMARY KEY (id_mensaje);


--
-- Name: notificacion notificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion
    ADD CONSTRAINT notificacion_pkey PRIMARY KEY (id_notificacion);


--
-- Name: orden_material_detalle orden_material_detalle_id_orden_id_insumo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_orden_id_insumo_key UNIQUE (id_orden, id_insumo);


--
-- Name: orden_material_detalle orden_material_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_pkey PRIMARY KEY (id_orden_detalle);


--
-- Name: orden_material orden_material_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_material
    ADD CONSTRAINT orden_material_pkey PRIMARY KEY (id_orden);


--
-- Name: mensaje_destino pk_mensaje_destino; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje_destino
    ADD CONSTRAINT pk_mensaje_destino PRIMARY KEY (id_destino);


--
-- Name: rol rol_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_codigo_key UNIQUE (codigo);


--
-- Name: rol rol_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_pkey PRIMARY KEY (id_rol);


--
-- Name: sector_direccion sector_direccion_id_sector_patron_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sector_direccion
    ADD CONSTRAINT sector_direccion_id_sector_patron_key UNIQUE (id_sector, patron);


--
-- Name: sector_direccion sector_direccion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sector_direccion
    ADD CONSTRAINT sector_direccion_pkey PRIMARY KEY (id_sector_direccion);


--
-- Name: sector sector_id_central_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sector
    ADD CONSTRAINT sector_id_central_codigo_key UNIQUE (id_central, codigo);


--
-- Name: sector sector_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sector
    ADD CONSTRAINT sector_pkey PRIMARY KEY (id_sector);


--
-- Name: seguimiento seguimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguimiento
    ADD CONSTRAINT seguimiento_pkey PRIMARY KEY (id_seguimiento);


--
-- Name: sincronizacion sincronizacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sincronizacion
    ADD CONSTRAINT sincronizacion_pkey PRIMARY KEY (id_sync);


--
-- Name: solicitante solicitante_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitante
    ADD CONSTRAINT solicitante_pkey PRIMARY KEY (id_solicitante);


--
-- Name: sync_check sync_check_id_sync_log_paso_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_check
    ADD CONSTRAINT sync_check_id_sync_log_paso_key UNIQUE (id_sync_log, paso);


--
-- Name: sync_check sync_check_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_check
    ADD CONSTRAINT sync_check_pkey PRIMARY KEY (id_sync_check);


--
-- Name: sync_log sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_log
    ADD CONSTRAINT sync_log_pkey PRIMARY KEY (id_sync_log);


--
-- Name: tecnico tecnico_cedula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tecnico
    ADD CONSTRAINT tecnico_cedula_key UNIQUE (cedula);


--
-- Name: tecnico tecnico_p00_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tecnico
    ADD CONSTRAINT tecnico_p00_key UNIQUE (p00);


--
-- Name: tecnico tecnico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tecnico
    ADD CONSTRAINT tecnico_pkey PRIMARY KEY (id_tecnico);


--
-- Name: identificador_pago uq_ip_numero; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identificador_pago
    ADD CONSTRAINT uq_ip_numero UNIQUE (numero);


--
-- Name: usuario usuario_correo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_correo_key UNIQUE (correo);


--
-- Name: usuario usuario_p00_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_p00_key UNIQUE (p00);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario);


--
-- Name: ix_actividad_caso; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_actividad_caso ON ggto_d77.actividad USING btree (id_caso);


--
-- Name: ix_actividad_usuario; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_actividad_usuario ON ggto_d77.actividad USING btree (id_usuario);


--
-- Name: ix_auditoria_fecha; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_auditoria_fecha ON ggto_d77.auditoria USING btree (fecha_hora);


--
-- Name: ix_caso_central; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_caso_central ON ggto_d77.caso USING btree (id_central);


--
-- Name: ix_caso_direccion_trgm; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_caso_direccion_trgm ON ggto_d77.caso USING gin (direccion public.gin_trgm_ops);


--
-- Name: ix_caso_estado; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_caso_estado ON ggto_d77.caso USING btree (estado_actual);


--
-- Name: ix_caso_falla_masiva; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_caso_falla_masiva ON ggto_d77.caso USING btree (es_falla_masiva);


--
-- Name: ix_caso_fecha_reporte; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_caso_fecha_reporte ON ggto_d77.caso USING btree (fecha_reporte);


--
-- Name: ix_caso_gestion_supervisor; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_caso_gestion_supervisor ON ggto_d77.caso USING btree (en_gestion_supervisor);


--
-- Name: ix_caso_lote; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_caso_lote ON ggto_d77.caso USING btree (id_lote_ingesta);


--
-- Name: ix_caso_sector; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_caso_sector ON ggto_d77.caso USING btree (id_sector);


--
-- Name: ix_caso_telefono; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_caso_telefono ON ggto_d77.caso USING btree (telefono);


--
-- Name: ix_cita_cuadrilla_fecha; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_cita_cuadrilla_fecha ON ggto_d77.cita USING btree (id_cuadrilla, fecha_hora);


--
-- Name: ix_cuadrilla_sector_dia_fecha; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_cuadrilla_sector_dia_fecha ON ggto_d77.cuadrilla_sector_dia USING btree (fecha, id_cuadrilla);


--
-- Name: ix_despacho_caso_caso; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_despacho_caso_caso ON ggto_d77.despacho_caso USING btree (id_caso);


--
-- Name: ix_despacho_caso_despacho; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_despacho_caso_despacho ON ggto_d77.despacho_caso USING btree (id_despacho);


--
-- Name: ix_evidencia_actividad; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_evidencia_actividad ON ggto_d77.evidencia USING btree (id_actividad);


--
-- Name: ix_notificacion_caso; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_notificacion_caso ON ggto_d77.notificacion USING btree (id_caso);


--
-- Name: ix_orden_material_id_falla; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_orden_material_id_falla ON ggto_d77.orden_material USING btree (id_falla);


--
-- Name: ix_sector_direccion_sector; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_sector_direccion_sector ON ggto_d77.sector_direccion USING btree (id_sector);


--
-- Name: ix_sector_patron_trgm; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_sector_patron_trgm ON ggto_d77.sector_direccion USING gin (patron public.gin_trgm_ops);


--
-- Name: ix_seguimiento_caso; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_seguimiento_caso ON ggto_d77.seguimiento USING btree (id_caso);


--
-- Name: ix_sync_log_p00_fecha; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE INDEX ix_sync_log_p00_fecha ON ggto_d77.sync_log USING btree (p00, iniciado_en DESC);


--
-- Name: ux_cuadrilla_supervisor; Type: INDEX; Schema: ggto_d77; Owner: -
--

CREATE UNIQUE INDEX ux_cuadrilla_supervisor ON ggto_d77.cuadrilla USING btree (id_central) WHERE es_supervisor;


--
-- Name: ix_actividad_caso; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_actividad_caso ON ggto_e2e.actividad USING btree (id_caso);


--
-- Name: ix_actividad_usuario; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_actividad_usuario ON ggto_e2e.actividad USING btree (id_usuario);


--
-- Name: ix_auditoria_fecha; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_auditoria_fecha ON ggto_e2e.auditoria USING btree (fecha_hora);


--
-- Name: ix_caso_central; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_caso_central ON ggto_e2e.caso USING btree (id_central);


--
-- Name: ix_caso_direccion_trgm; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_caso_direccion_trgm ON ggto_e2e.caso USING gin (direccion public.gin_trgm_ops);


--
-- Name: ix_caso_estado; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_caso_estado ON ggto_e2e.caso USING btree (estado_actual);


--
-- Name: ix_caso_falla_masiva; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_caso_falla_masiva ON ggto_e2e.caso USING btree (es_falla_masiva);


--
-- Name: ix_caso_fecha_reporte; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_caso_fecha_reporte ON ggto_e2e.caso USING btree (fecha_reporte);


--
-- Name: ix_caso_gestion_supervisor; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_caso_gestion_supervisor ON ggto_e2e.caso USING btree (en_gestion_supervisor);


--
-- Name: ix_caso_lote; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_caso_lote ON ggto_e2e.caso USING btree (id_lote_ingesta);


--
-- Name: ix_caso_sector; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_caso_sector ON ggto_e2e.caso USING btree (id_sector);


--
-- Name: ix_caso_telefono; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_caso_telefono ON ggto_e2e.caso USING btree (telefono);


--
-- Name: ix_cita_cuadrilla_fecha; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_cita_cuadrilla_fecha ON ggto_e2e.cita USING btree (id_cuadrilla, fecha_hora);


--
-- Name: ix_cuadrilla_sector_dia_fecha; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_cuadrilla_sector_dia_fecha ON ggto_e2e.cuadrilla_sector_dia USING btree (fecha, id_cuadrilla);


--
-- Name: ix_despacho_caso_caso; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_despacho_caso_caso ON ggto_e2e.despacho_caso USING btree (id_caso);


--
-- Name: ix_despacho_caso_despacho; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_despacho_caso_despacho ON ggto_e2e.despacho_caso USING btree (id_despacho);


--
-- Name: ix_evidencia_actividad; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_evidencia_actividad ON ggto_e2e.evidencia USING btree (id_actividad);


--
-- Name: ix_mensaje_central; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_mensaje_central ON ggto_e2e.mensaje USING btree (id_central);


--
-- Name: ix_mensaje_creado; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_mensaje_creado ON ggto_e2e.mensaje USING btree (creado_en DESC);


--
-- Name: ix_mensaje_destino_tecnico; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_mensaje_destino_tecnico ON ggto_e2e.mensaje_destino USING btree (id_tecnico, id_mensaje);


--
-- Name: ix_mensaje_expira; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_mensaje_expira ON ggto_e2e.mensaje USING btree (expira_en);


--
-- Name: ix_notificacion_caso; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_notificacion_caso ON ggto_e2e.notificacion USING btree (id_caso);


--
-- Name: ix_orden_material_id_falla; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_orden_material_id_falla ON ggto_e2e.orden_material USING btree (id_falla);


--
-- Name: ix_sector_direccion_sector; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_sector_direccion_sector ON ggto_e2e.sector_direccion USING btree (id_sector);


--
-- Name: ix_sector_patron_trgm; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_sector_patron_trgm ON ggto_e2e.sector_direccion USING gin (patron public.gin_trgm_ops);


--
-- Name: ix_seguimiento_caso; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_seguimiento_caso ON ggto_e2e.seguimiento USING btree (id_caso);


--
-- Name: ix_sync_log_dispositivo; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_sync_log_dispositivo ON ggto_e2e.sync_log USING btree (dispositivo_id);


--
-- Name: ix_sync_log_estado; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_sync_log_estado ON ggto_e2e.sync_log USING btree (estado, iniciado_en DESC);


--
-- Name: ix_sync_log_iniciado; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_sync_log_iniciado ON ggto_e2e.sync_log USING btree (iniciado_en DESC);


--
-- Name: ix_sync_log_p00_fecha; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE INDEX ix_sync_log_p00_fecha ON ggto_e2e.sync_log USING btree (p00, iniciado_en DESC);


--
-- Name: ux_cuadrilla_supervisor; Type: INDEX; Schema: ggto_e2e; Owner: -
--

CREATE UNIQUE INDEX ux_cuadrilla_supervisor ON ggto_e2e.cuadrilla USING btree (id_central) WHERE es_supervisor;


--
-- Name: ix_actividad_caso; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_actividad_caso ON ggto_sync.actividad USING btree (id_caso);


--
-- Name: ix_actividad_usuario; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_actividad_usuario ON ggto_sync.actividad USING btree (id_usuario);


--
-- Name: ix_auditoria_fecha; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_auditoria_fecha ON ggto_sync.auditoria USING btree (fecha_hora);


--
-- Name: ix_caso_central; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_caso_central ON ggto_sync.caso USING btree (id_central);


--
-- Name: ix_caso_direccion_trgm; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_caso_direccion_trgm ON ggto_sync.caso USING gin (direccion public.gin_trgm_ops);


--
-- Name: ix_caso_estado; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_caso_estado ON ggto_sync.caso USING btree (estado_actual);


--
-- Name: ix_caso_falla_masiva; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_caso_falla_masiva ON ggto_sync.caso USING btree (es_falla_masiva);


--
-- Name: ix_caso_fecha_reporte; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_caso_fecha_reporte ON ggto_sync.caso USING btree (fecha_reporte);


--
-- Name: ix_caso_gestion_supervisor; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_caso_gestion_supervisor ON ggto_sync.caso USING btree (en_gestion_supervisor);


--
-- Name: ix_caso_lote; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_caso_lote ON ggto_sync.caso USING btree (id_lote_ingesta);


--
-- Name: ix_caso_sector; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_caso_sector ON ggto_sync.caso USING btree (id_sector);


--
-- Name: ix_caso_telefono; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_caso_telefono ON ggto_sync.caso USING btree (telefono);


--
-- Name: ix_cita_cuadrilla_fecha; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_cita_cuadrilla_fecha ON ggto_sync.cita USING btree (id_cuadrilla, fecha_hora);


--
-- Name: ix_cuadrilla_sector_dia_fecha; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_cuadrilla_sector_dia_fecha ON ggto_sync.cuadrilla_sector_dia USING btree (fecha, id_cuadrilla);


--
-- Name: ix_despacho_caso_caso; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_despacho_caso_caso ON ggto_sync.despacho_caso USING btree (id_caso);


--
-- Name: ix_despacho_caso_despacho; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_despacho_caso_despacho ON ggto_sync.despacho_caso USING btree (id_despacho);


--
-- Name: ix_evidencia_actividad; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_evidencia_actividad ON ggto_sync.evidencia USING btree (id_actividad);


--
-- Name: ix_notificacion_caso; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_notificacion_caso ON ggto_sync.notificacion USING btree (id_caso);


--
-- Name: ix_orden_material_id_falla; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_orden_material_id_falla ON ggto_sync.orden_material USING btree (id_falla);


--
-- Name: ix_sector_direccion_sector; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_sector_direccion_sector ON ggto_sync.sector_direccion USING btree (id_sector);


--
-- Name: ix_sector_patron_trgm; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_sector_patron_trgm ON ggto_sync.sector_direccion USING gin (patron public.gin_trgm_ops);


--
-- Name: ix_seguimiento_caso; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_seguimiento_caso ON ggto_sync.seguimiento USING btree (id_caso);


--
-- Name: ix_sync_log_p00_fecha; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE INDEX ix_sync_log_p00_fecha ON ggto_sync.sync_log USING btree (p00, iniciado_en DESC);


--
-- Name: ux_cuadrilla_supervisor; Type: INDEX; Schema: ggto_sync; Owner: -
--

CREATE UNIQUE INDEX ux_cuadrilla_supervisor ON ggto_sync.cuadrilla USING btree (id_central) WHERE es_supervisor;


--
-- Name: ix_actividad_caso; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_actividad_caso ON ggto_test.actividad USING btree (id_caso);


--
-- Name: ix_actividad_usuario; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_actividad_usuario ON ggto_test.actividad USING btree (id_usuario);


--
-- Name: ix_auditoria_fecha; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_auditoria_fecha ON ggto_test.auditoria USING btree (fecha_hora);


--
-- Name: ix_caso_central; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_caso_central ON ggto_test.caso USING btree (id_central);


--
-- Name: ix_caso_direccion_trgm; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_caso_direccion_trgm ON ggto_test.caso USING gin (direccion public.gin_trgm_ops);


--
-- Name: ix_caso_estado; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_caso_estado ON ggto_test.caso USING btree (estado_actual);


--
-- Name: ix_caso_falla_masiva; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_caso_falla_masiva ON ggto_test.caso USING btree (es_falla_masiva);


--
-- Name: ix_caso_fecha_reporte; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_caso_fecha_reporte ON ggto_test.caso USING btree (fecha_reporte);


--
-- Name: ix_caso_gestion_supervisor; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_caso_gestion_supervisor ON ggto_test.caso USING btree (en_gestion_supervisor);


--
-- Name: ix_caso_lote; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_caso_lote ON ggto_test.caso USING btree (id_lote_ingesta);


--
-- Name: ix_caso_sector; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_caso_sector ON ggto_test.caso USING btree (id_sector);


--
-- Name: ix_caso_telefono; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_caso_telefono ON ggto_test.caso USING btree (telefono);


--
-- Name: ix_cita_cuadrilla_fecha; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_cita_cuadrilla_fecha ON ggto_test.cita USING btree (id_cuadrilla, fecha_hora);


--
-- Name: ix_cuadrilla_sector_dia_fecha; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_cuadrilla_sector_dia_fecha ON ggto_test.cuadrilla_sector_dia USING btree (fecha, id_cuadrilla);


--
-- Name: ix_despacho_caso_caso; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_despacho_caso_caso ON ggto_test.despacho_caso USING btree (id_caso);


--
-- Name: ix_despacho_caso_despacho; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_despacho_caso_despacho ON ggto_test.despacho_caso USING btree (id_despacho);


--
-- Name: ix_evidencia_actividad; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_evidencia_actividad ON ggto_test.evidencia USING btree (id_actividad);


--
-- Name: ix_mensaje_central; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_mensaje_central ON ggto_test.mensaje USING btree (id_central);


--
-- Name: ix_mensaje_creado; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_mensaje_creado ON ggto_test.mensaje USING btree (creado_en DESC);


--
-- Name: ix_mensaje_destino_tecnico; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_mensaje_destino_tecnico ON ggto_test.mensaje_destino USING btree (id_tecnico, id_mensaje);


--
-- Name: ix_mensaje_expira; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_mensaje_expira ON ggto_test.mensaje USING btree (expira_en);


--
-- Name: ix_notificacion_caso; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_notificacion_caso ON ggto_test.notificacion USING btree (id_caso);


--
-- Name: ix_orden_material_id_falla; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_orden_material_id_falla ON ggto_test.orden_material USING btree (id_falla);


--
-- Name: ix_sector_direccion_sector; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_sector_direccion_sector ON ggto_test.sector_direccion USING btree (id_sector);


--
-- Name: ix_sector_patron_trgm; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_sector_patron_trgm ON ggto_test.sector_direccion USING gin (patron public.gin_trgm_ops);


--
-- Name: ix_seguimiento_caso; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_seguimiento_caso ON ggto_test.seguimiento USING btree (id_caso);


--
-- Name: ix_sync_log_dispositivo; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_sync_log_dispositivo ON ggto_test.sync_log USING btree (dispositivo_id);


--
-- Name: ix_sync_log_estado; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_sync_log_estado ON ggto_test.sync_log USING btree (estado, iniciado_en DESC);


--
-- Name: ix_sync_log_iniciado; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_sync_log_iniciado ON ggto_test.sync_log USING btree (iniciado_en DESC);


--
-- Name: ix_sync_log_p00_fecha; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE INDEX ix_sync_log_p00_fecha ON ggto_test.sync_log USING btree (p00, iniciado_en DESC);


--
-- Name: ux_cuadrilla_supervisor; Type: INDEX; Schema: ggto_test; Owner: -
--

CREATE UNIQUE INDEX ux_cuadrilla_supervisor ON ggto_test.cuadrilla USING btree (id_central) WHERE es_supervisor;


--
-- Name: ix_actividad_caso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_actividad_caso ON public.actividad USING btree (id_caso);


--
-- Name: ix_actividad_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_actividad_usuario ON public.actividad USING btree (id_usuario);


--
-- Name: ix_auditoria_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auditoria_fecha ON public.auditoria USING btree (fecha_hora);


--
-- Name: ix_caso_central; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_caso_central ON public.caso USING btree (id_central);


--
-- Name: ix_caso_direccion_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_caso_direccion_trgm ON public.caso USING gin (direccion public.gin_trgm_ops);


--
-- Name: ix_caso_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_caso_estado ON public.caso USING btree (estado_actual);


--
-- Name: ix_caso_falla_masiva; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_caso_falla_masiva ON public.caso USING btree (es_falla_masiva);


--
-- Name: ix_caso_fecha_reporte; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_caso_fecha_reporte ON public.caso USING btree (fecha_reporte);


--
-- Name: ix_caso_gestion_supervisor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_caso_gestion_supervisor ON public.caso USING btree (en_gestion_supervisor);


--
-- Name: ix_caso_id_pago; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_caso_id_pago ON public.caso USING btree (id_pago);


--
-- Name: ix_caso_id_pago_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_caso_id_pago_fecha ON public.caso USING btree (id_pago, fecha_reporte);


--
-- Name: ix_caso_lote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_caso_lote ON public.caso USING btree (id_lote_ingesta);


--
-- Name: ix_caso_sector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_caso_sector ON public.caso USING btree (id_sector);


--
-- Name: ix_caso_telefono; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_caso_telefono ON public.caso USING btree (telefono);


--
-- Name: ix_cita_cuadrilla_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cita_cuadrilla_fecha ON public.cita USING btree (id_cuadrilla, fecha_hora);


--
-- Name: ix_cuadrilla_sector_dia_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cuadrilla_sector_dia_fecha ON public.cuadrilla_sector_dia USING btree (fecha, id_cuadrilla);


--
-- Name: ix_despacho_caso_caso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_despacho_caso_caso ON public.despacho_caso USING btree (id_caso);


--
-- Name: ix_despacho_caso_despacho; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_despacho_caso_despacho ON public.despacho_caso USING btree (id_despacho);


--
-- Name: ix_despacho_metrica_diaria_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_despacho_metrica_diaria_fecha ON public.despacho_metrica_diaria USING btree (id_central, fecha DESC);


--
-- Name: ix_evidencia_actividad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_evidencia_actividad ON public.evidencia USING btree (id_actividad);


--
-- Name: ix_evidencia_caso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_evidencia_caso ON public.evidencia USING btree (id_caso);


--
-- Name: ix_falla_masiva_caso_caso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_falla_masiva_caso_caso ON public.falla_masiva_caso USING btree (id_caso);


--
-- Name: ix_falla_masiva_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_falla_masiva_estado ON public.falla_masiva USING btree (id_central, estado, fecha_deteccion DESC);


--
-- Name: ix_mensaje_central; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mensaje_central ON public.mensaje USING btree (id_central);


--
-- Name: ix_mensaje_creado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mensaje_creado ON public.mensaje USING btree (creado_en DESC);


--
-- Name: ix_mensaje_destino_tecnico; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mensaje_destino_tecnico ON public.mensaje_destino USING btree (id_tecnico, id_mensaje);


--
-- Name: ix_mensaje_destino_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mensaje_destino_usuario ON public.mensaje_destino USING btree (p00, id_mensaje);


--
-- Name: ix_mensaje_expira; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mensaje_expira ON public.mensaje USING btree (expira_en);


--
-- Name: ix_notificacion_caso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notificacion_caso ON public.notificacion USING btree (id_caso);


--
-- Name: ix_orden_material_id_falla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orden_material_id_falla ON public.orden_material USING btree (id_falla);


--
-- Name: ix_sector_direccion_sector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sector_direccion_sector ON public.sector_direccion USING btree (id_sector);


--
-- Name: ix_sector_patron_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sector_patron_trgm ON public.sector_direccion USING gin (patron public.gin_trgm_ops);


--
-- Name: ix_seguimiento_caso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_seguimiento_caso ON public.seguimiento USING btree (id_caso);


--
-- Name: ix_solicitante_central; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_solicitante_central ON public.solicitante USING btree (id_central, activo);


--
-- Name: ix_solicitante_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_solicitante_tipo ON public.solicitante USING btree (tipo, activo);


--
-- Name: ix_sync_log_dispositivo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sync_log_dispositivo ON public.sync_log USING btree (dispositivo_id);


--
-- Name: ix_sync_log_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sync_log_estado ON public.sync_log USING btree (estado, iniciado_en DESC);


--
-- Name: ix_sync_log_iniciado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sync_log_iniciado ON public.sync_log USING btree (iniciado_en DESC);


--
-- Name: ix_sync_log_p00_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sync_log_p00_fecha ON public.sync_log USING btree (p00, iniciado_en DESC);


--
-- Name: ux_actividad_local; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_actividad_local ON public.actividad USING btree (dispositivo_id, id_actividad_local) WHERE ((id_actividad_local IS NOT NULL) AND (dispositivo_id IS NOT NULL));


--
-- Name: ux_cuadrilla_supervisor; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_cuadrilla_supervisor ON public.cuadrilla USING btree (id_central) WHERE es_supervisor;


--
-- Name: caso trg_caso_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_caso_actualizado BEFORE UPDATE ON ggto_d77.caso FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: caso_especial trg_caso_especial_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_caso_especial_actualizado BEFORE UPDATE ON ggto_d77.caso_especial FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: central trg_central_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_central_actualizado BEFORE UPDATE ON ggto_d77.central FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: configuracion trg_configuracion_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_configuracion_actualizado BEFORE UPDATE ON ggto_d77.configuracion FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: cuadrilla trg_cuadrilla_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_cuadrilla_actualizado BEFORE UPDATE ON ggto_d77.cuadrilla FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: despacho trg_despacho_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_despacho_actualizado BEFORE UPDATE ON ggto_d77.despacho FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: falla_masiva trg_falla_masiva_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_falla_masiva_actualizado BEFORE UPDATE ON ggto_d77.falla_masiva FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: flota trg_flota_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_flota_actualizado BEFORE UPDATE ON ggto_d77.flota FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: herramienta trg_herramienta_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_herramienta_actualizado BEFORE UPDATE ON ggto_d77.herramienta FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: insumo trg_insumo_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_insumo_actualizado BEFORE UPDATE ON ggto_d77.insumo FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: orden_material trg_orden_material_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_orden_material_actualizado BEFORE UPDATE ON ggto_d77.orden_material FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: sector trg_sector_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_sector_actualizado BEFORE UPDATE ON ggto_d77.sector FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: tecnico trg_tecnico_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_tecnico_actualizado BEFORE UPDATE ON ggto_d77.tecnico FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: usuario trg_usuario_actualizado; Type: TRIGGER; Schema: ggto_d77; Owner: -
--

CREATE TRIGGER trg_usuario_actualizado BEFORE UPDATE ON ggto_d77.usuario FOR EACH ROW EXECUTE FUNCTION ggto_d77.set_actualizado_en();


--
-- Name: caso trg_caso_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_caso_actualizado BEFORE UPDATE ON ggto_e2e.caso FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: caso_especial trg_caso_especial_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_caso_especial_actualizado BEFORE UPDATE ON ggto_e2e.caso_especial FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: central trg_central_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_central_actualizado BEFORE UPDATE ON ggto_e2e.central FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: configuracion trg_configuracion_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_configuracion_actualizado BEFORE UPDATE ON ggto_e2e.configuracion FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: cuadrilla trg_cuadrilla_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_cuadrilla_actualizado BEFORE UPDATE ON ggto_e2e.cuadrilla FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: despacho trg_despacho_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_despacho_actualizado BEFORE UPDATE ON ggto_e2e.despacho FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: falla_masiva trg_falla_masiva_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_falla_masiva_actualizado BEFORE UPDATE ON ggto_e2e.falla_masiva FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: flota trg_flota_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_flota_actualizado BEFORE UPDATE ON ggto_e2e.flota FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: herramienta trg_herramienta_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_herramienta_actualizado BEFORE UPDATE ON ggto_e2e.herramienta FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: insumo trg_insumo_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_insumo_actualizado BEFORE UPDATE ON ggto_e2e.insumo FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: orden_material trg_orden_material_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_orden_material_actualizado BEFORE UPDATE ON ggto_e2e.orden_material FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: sector trg_sector_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_sector_actualizado BEFORE UPDATE ON ggto_e2e.sector FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: tecnico trg_tecnico_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_tecnico_actualizado BEFORE UPDATE ON ggto_e2e.tecnico FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: usuario trg_usuario_actualizado; Type: TRIGGER; Schema: ggto_e2e; Owner: -
--

CREATE TRIGGER trg_usuario_actualizado BEFORE UPDATE ON ggto_e2e.usuario FOR EACH ROW EXECUTE FUNCTION ggto_e2e.set_actualizado_en();


--
-- Name: caso trg_caso_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_caso_actualizado BEFORE UPDATE ON ggto_sync.caso FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: caso_especial trg_caso_especial_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_caso_especial_actualizado BEFORE UPDATE ON ggto_sync.caso_especial FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: central trg_central_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_central_actualizado BEFORE UPDATE ON ggto_sync.central FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: configuracion trg_configuracion_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_configuracion_actualizado BEFORE UPDATE ON ggto_sync.configuracion FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: cuadrilla trg_cuadrilla_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_cuadrilla_actualizado BEFORE UPDATE ON ggto_sync.cuadrilla FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: despacho trg_despacho_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_despacho_actualizado BEFORE UPDATE ON ggto_sync.despacho FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: falla_masiva trg_falla_masiva_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_falla_masiva_actualizado BEFORE UPDATE ON ggto_sync.falla_masiva FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: flota trg_flota_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_flota_actualizado BEFORE UPDATE ON ggto_sync.flota FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: herramienta trg_herramienta_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_herramienta_actualizado BEFORE UPDATE ON ggto_sync.herramienta FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: insumo trg_insumo_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_insumo_actualizado BEFORE UPDATE ON ggto_sync.insumo FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: orden_material trg_orden_material_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_orden_material_actualizado BEFORE UPDATE ON ggto_sync.orden_material FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: sector trg_sector_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_sector_actualizado BEFORE UPDATE ON ggto_sync.sector FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: tecnico trg_tecnico_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_tecnico_actualizado BEFORE UPDATE ON ggto_sync.tecnico FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: usuario trg_usuario_actualizado; Type: TRIGGER; Schema: ggto_sync; Owner: -
--

CREATE TRIGGER trg_usuario_actualizado BEFORE UPDATE ON ggto_sync.usuario FOR EACH ROW EXECUTE FUNCTION ggto_sync.set_actualizado_en();


--
-- Name: caso trg_caso_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_caso_actualizado BEFORE UPDATE ON ggto_test.caso FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: caso_especial trg_caso_especial_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_caso_especial_actualizado BEFORE UPDATE ON ggto_test.caso_especial FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: central trg_central_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_central_actualizado BEFORE UPDATE ON ggto_test.central FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: configuracion trg_configuracion_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_configuracion_actualizado BEFORE UPDATE ON ggto_test.configuracion FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: cuadrilla trg_cuadrilla_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_cuadrilla_actualizado BEFORE UPDATE ON ggto_test.cuadrilla FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: despacho trg_despacho_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_despacho_actualizado BEFORE UPDATE ON ggto_test.despacho FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: falla_masiva trg_falla_masiva_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_falla_masiva_actualizado BEFORE UPDATE ON ggto_test.falla_masiva FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: flota trg_flota_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_flota_actualizado BEFORE UPDATE ON ggto_test.flota FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: herramienta trg_herramienta_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_herramienta_actualizado BEFORE UPDATE ON ggto_test.herramienta FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: insumo trg_insumo_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_insumo_actualizado BEFORE UPDATE ON ggto_test.insumo FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: orden_material trg_orden_material_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_orden_material_actualizado BEFORE UPDATE ON ggto_test.orden_material FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: sector trg_sector_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_sector_actualizado BEFORE UPDATE ON ggto_test.sector FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: tecnico trg_tecnico_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_tecnico_actualizado BEFORE UPDATE ON ggto_test.tecnico FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: usuario trg_usuario_actualizado; Type: TRIGGER; Schema: ggto_test; Owner: -
--

CREATE TRIGGER trg_usuario_actualizado BEFORE UPDATE ON ggto_test.usuario FOR EACH ROW EXECUTE FUNCTION ggto_test.set_actualizado_en();


--
-- Name: caso trg_caso_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_caso_actualizado BEFORE UPDATE ON public.caso FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: caso_especial trg_caso_especial_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_caso_especial_actualizado BEFORE UPDATE ON public.caso_especial FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: caso trg_caso_metricas_despacho; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_caso_metricas_despacho AFTER UPDATE OF estado_actual, tipo_caso, categoria ON public.caso FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_metricas_caso();


--
-- Name: caso trg_caso_reparacion_a_referido; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_caso_reparacion_a_referido BEFORE INSERT OR UPDATE ON public.caso FOR EACH ROW EXECUTE FUNCTION public.fn_caso_reparacion_a_referido();


--
-- Name: central trg_central_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_central_actualizado BEFORE UPDATE ON public.central FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: configuracion trg_configuracion_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_configuracion_actualizado BEFORE UPDATE ON public.configuracion FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: cuadrilla trg_cuadrilla_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cuadrilla_actualizado BEFORE UPDATE ON public.cuadrilla FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: despacho trg_despacho_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_despacho_actualizado BEFORE UPDATE ON public.despacho FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: despacho_caso trg_despacho_caso_metricas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_despacho_caso_metricas AFTER INSERT OR DELETE OR UPDATE ON public.despacho_caso FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_metricas_despacho_caso();


--
-- Name: falla_masiva trg_falla_masiva_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_falla_masiva_actualizado BEFORE UPDATE ON public.falla_masiva FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: flota trg_flota_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_flota_actualizado BEFORE UPDATE ON public.flota FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: herramienta trg_herramienta_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_herramienta_actualizado BEFORE UPDATE ON public.herramienta FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: identificador_pago trg_identificador_pago_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_identificador_pago_actualizado BEFORE UPDATE ON public.identificador_pago FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: insumo trg_insumo_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_insumo_actualizado BEFORE UPDATE ON public.insumo FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: orden_material trg_orden_material_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_orden_material_actualizado BEFORE UPDATE ON public.orden_material FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: sector trg_sector_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sector_actualizado BEFORE UPDATE ON public.sector FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: tecnico trg_tecnico_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tecnico_actualizado BEFORE UPDATE ON public.tecnico FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: usuario trg_usuario_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_usuario_actualizado BEFORE UPDATE ON public.usuario FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();


--
-- Name: actividad actividad_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.actividad
    ADD CONSTRAINT actividad_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_d77.caso(id_caso) ON DELETE CASCADE;


--
-- Name: actividad actividad_id_causa_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.actividad
    ADD CONSTRAINT actividad_id_causa_fkey FOREIGN KEY (id_causa) REFERENCES ggto_d77.causa(id_causa);


--
-- Name: actividad actividad_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.actividad
    ADD CONSTRAINT actividad_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_d77.cuadrilla(id_cuadrilla);


--
-- Name: actividad actividad_id_metodo_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.actividad
    ADD CONSTRAINT actividad_id_metodo_fkey FOREIGN KEY (id_metodo) REFERENCES ggto_d77.catalogo_metodo(id_metodo);


--
-- Name: actividad actividad_id_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.actividad
    ADD CONSTRAINT actividad_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES ggto_d77.usuario(id_usuario);


--
-- Name: caso caso_creado_por_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso
    ADD CONSTRAINT caso_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES ggto_d77.usuario(p00);


--
-- Name: caso_especial caso_especial_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso_especial
    ADD CONSTRAINT caso_especial_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_d77.caso(id_caso) ON DELETE CASCADE;


--
-- Name: caso_especial caso_especial_id_solicitante_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso_especial
    ADD CONSTRAINT caso_especial_id_solicitante_fkey FOREIGN KEY (id_solicitante) REFERENCES ggto_d77.solicitante(id_solicitante);


--
-- Name: caso_estado_hist caso_estado_hist_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_d77.caso(id_caso) ON DELETE CASCADE;


--
-- Name: caso_estado_hist caso_estado_hist_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_d77.usuario(p00);


--
-- Name: caso caso_id_causa_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso
    ADD CONSTRAINT caso_id_causa_fkey FOREIGN KEY (id_causa) REFERENCES ggto_d77.causa(id_causa);


--
-- Name: caso caso_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso
    ADD CONSTRAINT caso_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_d77.central(id_central);


--
-- Name: caso caso_id_lote_ingesta_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso
    ADD CONSTRAINT caso_id_lote_ingesta_fkey FOREIGN KEY (id_lote_ingesta) REFERENCES ggto_d77.ingesta_lote(id_lote);


--
-- Name: caso caso_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.caso
    ADD CONSTRAINT caso_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_d77.sector(id_sector);


--
-- Name: cita cita_creado_por_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cita
    ADD CONSTRAINT cita_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES ggto_d77.usuario(p00);


--
-- Name: cita cita_id_caso_especial_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cita
    ADD CONSTRAINT cita_id_caso_especial_fkey FOREIGN KEY (id_caso_especial) REFERENCES ggto_d77.caso_especial(id_caso_especial) ON DELETE CASCADE;


--
-- Name: cita cita_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cita
    ADD CONSTRAINT cita_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_d77.caso(id_caso) ON DELETE CASCADE;


--
-- Name: cita cita_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cita
    ADD CONSTRAINT cita_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_d77.cuadrilla(id_cuadrilla);


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_d77.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_id_herramienta_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_id_herramienta_fkey FOREIGN KEY (id_herramienta) REFERENCES ggto_d77.herramienta(id_herramienta) ON DELETE CASCADE;


--
-- Name: cuadrilla cuadrilla_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla
    ADD CONSTRAINT cuadrilla_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_d77.central(id_central);


--
-- Name: cuadrilla cuadrilla_id_flota_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla
    ADD CONSTRAINT cuadrilla_id_flota_fkey FOREIGN KEY (id_flota) REFERENCES ggto_d77.flota(id_flota);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_d77.central(id_central);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_d77.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_d77.sector(id_sector) ON DELETE CASCADE;


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_d77.usuario(p00);


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_d77.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_d77.tecnico(id_tecnico) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.despacho_caso
    ADD CONSTRAINT despacho_caso_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_d77.caso(id_caso) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_despacho_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.despacho_caso
    ADD CONSTRAINT despacho_caso_id_despacho_fkey FOREIGN KEY (id_despacho) REFERENCES ggto_d77.despacho(id_despacho) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.despacho_caso
    ADD CONSTRAINT despacho_caso_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_d77.sector(id_sector);


--
-- Name: despacho despacho_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.despacho
    ADD CONSTRAINT despacho_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_d77.central(id_central);


--
-- Name: despacho despacho_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.despacho
    ADD CONSTRAINT despacho_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_d77.cuadrilla(id_cuadrilla);


--
-- Name: despacho despacho_usuario_crea_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.despacho
    ADD CONSTRAINT despacho_usuario_crea_fkey FOREIGN KEY (usuario_crea) REFERENCES ggto_d77.usuario(p00);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_p00_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_p00_fkey FOREIGN KEY (p00) REFERENCES ggto_d77.usuario(p00) ON DELETE CASCADE;


--
-- Name: evidencia evidencia_id_actividad_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.evidencia
    ADD CONSTRAINT evidencia_id_actividad_fkey FOREIGN KEY (id_actividad) REFERENCES ggto_d77.actividad(id_actividad) ON DELETE CASCADE;


--
-- Name: falla_masiva falla_masiva_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.falla_masiva
    ADD CONSTRAINT falla_masiva_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_d77.central(id_central);


--
-- Name: falla_masiva falla_masiva_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.falla_masiva
    ADD CONSTRAINT falla_masiva_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_d77.cuadrilla(id_cuadrilla);


--
-- Name: falla_masiva falla_masiva_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.falla_masiva
    ADD CONSTRAINT falla_masiva_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_d77.sector(id_sector);


--
-- Name: flota flota_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.flota
    ADD CONSTRAINT flota_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_d77.central(id_central);


--
-- Name: herramienta herramienta_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.herramienta
    ADD CONSTRAINT herramienta_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_d77.central(id_central);


--
-- Name: incidente incidente_id_actividad_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.incidente
    ADD CONSTRAINT incidente_id_actividad_fkey FOREIGN KEY (id_actividad) REFERENCES ggto_d77.actividad(id_actividad) ON DELETE SET NULL;


--
-- Name: incidente incidente_id_flota_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.incidente
    ADD CONSTRAINT incidente_id_flota_fkey FOREIGN KEY (id_flota) REFERENCES ggto_d77.flota(id_flota);


--
-- Name: incidente incidente_id_herramienta_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.incidente
    ADD CONSTRAINT incidente_id_herramienta_fkey FOREIGN KEY (id_herramienta) REFERENCES ggto_d77.herramienta(id_herramienta);


--
-- Name: ingesta_lote ingesta_lote_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.ingesta_lote
    ADD CONSTRAINT ingesta_lote_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_d77.central(id_central);


--
-- Name: insumo insumo_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.insumo
    ADD CONSTRAINT insumo_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_d77.central(id_central);


--
-- Name: inventario_movimiento inventario_movimiento_id_insumo_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES ggto_d77.insumo(id_insumo);


--
-- Name: inventario_movimiento inventario_movimiento_id_orden_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_orden_fkey FOREIGN KEY (id_orden) REFERENCES ggto_d77.orden_material(id_orden);


--
-- Name: inventario_movimiento inventario_movimiento_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_d77.tecnico(id_tecnico);


--
-- Name: inventario_movimiento inventario_movimiento_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_d77.usuario(p00);


--
-- Name: notificacion notificacion_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.notificacion
    ADD CONSTRAINT notificacion_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_d77.caso(id_caso) ON DELETE SET NULL;


--
-- Name: orden_material_detalle orden_material_detalle_id_insumo_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES ggto_d77.insumo(id_insumo);


--
-- Name: orden_material_detalle orden_material_detalle_id_orden_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_orden_fkey FOREIGN KEY (id_orden) REFERENCES ggto_d77.orden_material(id_orden) ON DELETE CASCADE;


--
-- Name: orden_material orden_material_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.orden_material
    ADD CONSTRAINT orden_material_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_d77.caso(id_caso);


--
-- Name: orden_material orden_material_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.orden_material
    ADD CONSTRAINT orden_material_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_d77.cuadrilla(id_cuadrilla);


--
-- Name: orden_material orden_material_id_falla_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.orden_material
    ADD CONSTRAINT orden_material_id_falla_fkey FOREIGN KEY (id_falla) REFERENCES ggto_d77.falla_masiva(id_falla) ON DELETE CASCADE;


--
-- Name: orden_material orden_material_solicitante_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.orden_material
    ADD CONSTRAINT orden_material_solicitante_usuario_fkey FOREIGN KEY (solicitante_usuario) REFERENCES ggto_d77.usuario(p00);


--
-- Name: sector_direccion sector_direccion_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sector_direccion
    ADD CONSTRAINT sector_direccion_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_d77.sector(id_sector) ON DELETE CASCADE;


--
-- Name: sector sector_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sector
    ADD CONSTRAINT sector_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_d77.central(id_central) ON DELETE CASCADE;


--
-- Name: seguimiento seguimiento_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.seguimiento
    ADD CONSTRAINT seguimiento_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_d77.caso(id_caso) ON DELETE CASCADE;


--
-- Name: seguimiento seguimiento_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.seguimiento
    ADD CONSTRAINT seguimiento_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_d77.usuario(p00);


--
-- Name: sincronizacion sincronizacion_id_dispositivo_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sincronizacion
    ADD CONSTRAINT sincronizacion_id_dispositivo_fkey FOREIGN KEY (id_dispositivo) REFERENCES ggto_d77.dispositivo_seguridad(id_dispositivo) ON DELETE SET NULL;


--
-- Name: sincronizacion sincronizacion_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sincronizacion
    ADD CONSTRAINT sincronizacion_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_d77.tecnico(id_tecnico);


--
-- Name: sync_log sync_log_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.sync_log
    ADD CONSTRAINT sync_log_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_d77.cuadrilla(id_cuadrilla);


--
-- Name: tecnico tecnico_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.tecnico
    ADD CONSTRAINT tecnico_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_d77.central(id_central);


--
-- Name: usuario usuario_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.usuario
    ADD CONSTRAINT usuario_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_d77.central(id_central);


--
-- Name: usuario usuario_id_rol_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.usuario
    ADD CONSTRAINT usuario_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES ggto_d77.rol(id_rol);


--
-- Name: usuario usuario_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_d77; Owner: -
--

ALTER TABLE ONLY ggto_d77.usuario
    ADD CONSTRAINT usuario_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_d77.tecnico(id_tecnico);


--
-- Name: actividad actividad_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.actividad
    ADD CONSTRAINT actividad_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_e2e.caso(id_caso) ON DELETE CASCADE;


--
-- Name: actividad actividad_id_causa_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.actividad
    ADD CONSTRAINT actividad_id_causa_fkey FOREIGN KEY (id_causa) REFERENCES ggto_e2e.causa(id_causa);


--
-- Name: actividad actividad_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.actividad
    ADD CONSTRAINT actividad_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_e2e.cuadrilla(id_cuadrilla);


--
-- Name: actividad actividad_id_metodo_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.actividad
    ADD CONSTRAINT actividad_id_metodo_fkey FOREIGN KEY (id_metodo) REFERENCES ggto_e2e.catalogo_metodo(id_metodo);


--
-- Name: actividad actividad_id_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.actividad
    ADD CONSTRAINT actividad_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES ggto_e2e.usuario(id_usuario);


--
-- Name: caso caso_creado_por_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso
    ADD CONSTRAINT caso_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES ggto_e2e.usuario(p00);


--
-- Name: caso_especial caso_especial_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso_especial
    ADD CONSTRAINT caso_especial_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_e2e.caso(id_caso) ON DELETE CASCADE;


--
-- Name: caso_especial caso_especial_id_solicitante_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso_especial
    ADD CONSTRAINT caso_especial_id_solicitante_fkey FOREIGN KEY (id_solicitante) REFERENCES ggto_e2e.solicitante(id_solicitante);


--
-- Name: caso_estado_hist caso_estado_hist_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_e2e.caso(id_caso) ON DELETE CASCADE;


--
-- Name: caso_estado_hist caso_estado_hist_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_e2e.usuario(p00);


--
-- Name: caso caso_id_causa_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso
    ADD CONSTRAINT caso_id_causa_fkey FOREIGN KEY (id_causa) REFERENCES ggto_e2e.causa(id_causa);


--
-- Name: caso caso_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso
    ADD CONSTRAINT caso_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: caso caso_id_lote_ingesta_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso
    ADD CONSTRAINT caso_id_lote_ingesta_fkey FOREIGN KEY (id_lote_ingesta) REFERENCES ggto_e2e.ingesta_lote(id_lote);


--
-- Name: caso caso_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.caso
    ADD CONSTRAINT caso_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_e2e.sector(id_sector);


--
-- Name: cita cita_creado_por_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cita
    ADD CONSTRAINT cita_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES ggto_e2e.usuario(p00);


--
-- Name: cita cita_id_caso_especial_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cita
    ADD CONSTRAINT cita_id_caso_especial_fkey FOREIGN KEY (id_caso_especial) REFERENCES ggto_e2e.caso_especial(id_caso_especial) ON DELETE CASCADE;


--
-- Name: cita cita_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cita
    ADD CONSTRAINT cita_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_e2e.caso(id_caso) ON DELETE CASCADE;


--
-- Name: cita cita_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cita
    ADD CONSTRAINT cita_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_e2e.cuadrilla(id_cuadrilla);


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_e2e.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_id_herramienta_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_id_herramienta_fkey FOREIGN KEY (id_herramienta) REFERENCES ggto_e2e.herramienta(id_herramienta) ON DELETE CASCADE;


--
-- Name: cuadrilla cuadrilla_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla
    ADD CONSTRAINT cuadrilla_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: cuadrilla cuadrilla_id_flota_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla
    ADD CONSTRAINT cuadrilla_id_flota_fkey FOREIGN KEY (id_flota) REFERENCES ggto_e2e.flota(id_flota);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_e2e.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_e2e.sector(id_sector) ON DELETE CASCADE;


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_e2e.usuario(p00);


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_e2e.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_e2e.tecnico(id_tecnico) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.despacho_caso
    ADD CONSTRAINT despacho_caso_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_e2e.caso(id_caso) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_despacho_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.despacho_caso
    ADD CONSTRAINT despacho_caso_id_despacho_fkey FOREIGN KEY (id_despacho) REFERENCES ggto_e2e.despacho(id_despacho) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.despacho_caso
    ADD CONSTRAINT despacho_caso_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_e2e.sector(id_sector);


--
-- Name: despacho despacho_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.despacho
    ADD CONSTRAINT despacho_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: despacho despacho_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.despacho
    ADD CONSTRAINT despacho_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_e2e.cuadrilla(id_cuadrilla);


--
-- Name: despacho despacho_usuario_crea_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.despacho
    ADD CONSTRAINT despacho_usuario_crea_fkey FOREIGN KEY (usuario_crea) REFERENCES ggto_e2e.usuario(p00);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_p00_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_p00_fkey FOREIGN KEY (p00) REFERENCES ggto_e2e.usuario(p00) ON DELETE CASCADE;


--
-- Name: evidencia evidencia_id_actividad_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.evidencia
    ADD CONSTRAINT evidencia_id_actividad_fkey FOREIGN KEY (id_actividad) REFERENCES ggto_e2e.actividad(id_actividad) ON DELETE CASCADE;


--
-- Name: falla_masiva falla_masiva_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.falla_masiva
    ADD CONSTRAINT falla_masiva_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: falla_masiva falla_masiva_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.falla_masiva
    ADD CONSTRAINT falla_masiva_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_e2e.cuadrilla(id_cuadrilla);


--
-- Name: falla_masiva falla_masiva_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.falla_masiva
    ADD CONSTRAINT falla_masiva_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_e2e.sector(id_sector);


--
-- Name: flota flota_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.flota
    ADD CONSTRAINT flota_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: herramienta herramienta_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.herramienta
    ADD CONSTRAINT herramienta_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: incidente incidente_id_actividad_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.incidente
    ADD CONSTRAINT incidente_id_actividad_fkey FOREIGN KEY (id_actividad) REFERENCES ggto_e2e.actividad(id_actividad) ON DELETE SET NULL;


--
-- Name: incidente incidente_id_flota_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.incidente
    ADD CONSTRAINT incidente_id_flota_fkey FOREIGN KEY (id_flota) REFERENCES ggto_e2e.flota(id_flota);


--
-- Name: incidente incidente_id_herramienta_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.incidente
    ADD CONSTRAINT incidente_id_herramienta_fkey FOREIGN KEY (id_herramienta) REFERENCES ggto_e2e.herramienta(id_herramienta);


--
-- Name: ingesta_lote ingesta_lote_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.ingesta_lote
    ADD CONSTRAINT ingesta_lote_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: insumo insumo_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.insumo
    ADD CONSTRAINT insumo_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: inventario_movimiento inventario_movimiento_id_insumo_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES ggto_e2e.insumo(id_insumo);


--
-- Name: inventario_movimiento inventario_movimiento_id_orden_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_orden_fkey FOREIGN KEY (id_orden) REFERENCES ggto_e2e.orden_material(id_orden);


--
-- Name: inventario_movimiento inventario_movimiento_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_e2e.tecnico(id_tecnico);


--
-- Name: inventario_movimiento inventario_movimiento_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_e2e.usuario(p00);


--
-- Name: mensaje_destino mensaje_destino_id_mensaje_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.mensaje_destino
    ADD CONSTRAINT mensaje_destino_id_mensaje_fkey FOREIGN KEY (id_mensaje) REFERENCES ggto_e2e.mensaje(id_mensaje) ON DELETE CASCADE;


--
-- Name: mensaje_destino mensaje_destino_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.mensaje_destino
    ADD CONSTRAINT mensaje_destino_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_e2e.tecnico(id_tecnico) ON DELETE CASCADE;


--
-- Name: mensaje mensaje_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.mensaje
    ADD CONSTRAINT mensaje_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_e2e.caso(id_caso) ON DELETE SET NULL;


--
-- Name: mensaje mensaje_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.mensaje
    ADD CONSTRAINT mensaje_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: mensaje mensaje_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.mensaje
    ADD CONSTRAINT mensaje_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_e2e.cuadrilla(id_cuadrilla) ON DELETE SET NULL;


--
-- Name: mensaje mensaje_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.mensaje
    ADD CONSTRAINT mensaje_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_e2e.tecnico(id_tecnico) ON DELETE SET NULL;


--
-- Name: mensaje mensaje_origen_p00_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.mensaje
    ADD CONSTRAINT mensaje_origen_p00_fkey FOREIGN KEY (origen_p00) REFERENCES ggto_e2e.usuario(p00);


--
-- Name: notificacion notificacion_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.notificacion
    ADD CONSTRAINT notificacion_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_e2e.caso(id_caso) ON DELETE SET NULL;


--
-- Name: orden_material_detalle orden_material_detalle_id_insumo_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES ggto_e2e.insumo(id_insumo);


--
-- Name: orden_material_detalle orden_material_detalle_id_orden_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_orden_fkey FOREIGN KEY (id_orden) REFERENCES ggto_e2e.orden_material(id_orden) ON DELETE CASCADE;


--
-- Name: orden_material orden_material_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.orden_material
    ADD CONSTRAINT orden_material_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_e2e.caso(id_caso);


--
-- Name: orden_material orden_material_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.orden_material
    ADD CONSTRAINT orden_material_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_e2e.cuadrilla(id_cuadrilla);


--
-- Name: orden_material orden_material_id_falla_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.orden_material
    ADD CONSTRAINT orden_material_id_falla_fkey FOREIGN KEY (id_falla) REFERENCES ggto_e2e.falla_masiva(id_falla) ON DELETE CASCADE;


--
-- Name: orden_material orden_material_solicitante_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.orden_material
    ADD CONSTRAINT orden_material_solicitante_usuario_fkey FOREIGN KEY (solicitante_usuario) REFERENCES ggto_e2e.usuario(p00);


--
-- Name: sector_direccion sector_direccion_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sector_direccion
    ADD CONSTRAINT sector_direccion_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_e2e.sector(id_sector) ON DELETE CASCADE;


--
-- Name: sector sector_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sector
    ADD CONSTRAINT sector_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central) ON DELETE CASCADE;


--
-- Name: seguimiento seguimiento_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.seguimiento
    ADD CONSTRAINT seguimiento_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_e2e.caso(id_caso) ON DELETE CASCADE;


--
-- Name: seguimiento seguimiento_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.seguimiento
    ADD CONSTRAINT seguimiento_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_e2e.usuario(p00);


--
-- Name: sincronizacion sincronizacion_id_dispositivo_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sincronizacion
    ADD CONSTRAINT sincronizacion_id_dispositivo_fkey FOREIGN KEY (id_dispositivo) REFERENCES ggto_e2e.dispositivo_seguridad(id_dispositivo) ON DELETE SET NULL;


--
-- Name: sincronizacion sincronizacion_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sincronizacion
    ADD CONSTRAINT sincronizacion_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_e2e.tecnico(id_tecnico);


--
-- Name: sync_check sync_check_id_sync_log_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sync_check
    ADD CONSTRAINT sync_check_id_sync_log_fkey FOREIGN KEY (id_sync_log) REFERENCES ggto_e2e.sync_log(id_sync_log) ON DELETE CASCADE;


--
-- Name: sync_log sync_log_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sync_log
    ADD CONSTRAINT sync_log_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: sync_log sync_log_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.sync_log
    ADD CONSTRAINT sync_log_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_e2e.cuadrilla(id_cuadrilla);


--
-- Name: tecnico tecnico_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.tecnico
    ADD CONSTRAINT tecnico_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: usuario usuario_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.usuario
    ADD CONSTRAINT usuario_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_e2e.central(id_central);


--
-- Name: usuario usuario_id_rol_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.usuario
    ADD CONSTRAINT usuario_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES ggto_e2e.rol(id_rol);


--
-- Name: usuario usuario_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ONLY ggto_e2e.usuario
    ADD CONSTRAINT usuario_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_e2e.tecnico(id_tecnico);


--
-- Name: actividad actividad_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.actividad
    ADD CONSTRAINT actividad_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_sync.caso(id_caso) ON DELETE CASCADE;


--
-- Name: actividad actividad_id_causa_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.actividad
    ADD CONSTRAINT actividad_id_causa_fkey FOREIGN KEY (id_causa) REFERENCES ggto_sync.causa(id_causa);


--
-- Name: actividad actividad_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.actividad
    ADD CONSTRAINT actividad_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_sync.cuadrilla(id_cuadrilla);


--
-- Name: actividad actividad_id_metodo_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.actividad
    ADD CONSTRAINT actividad_id_metodo_fkey FOREIGN KEY (id_metodo) REFERENCES ggto_sync.catalogo_metodo(id_metodo);


--
-- Name: actividad actividad_id_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.actividad
    ADD CONSTRAINT actividad_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES ggto_sync.usuario(id_usuario);


--
-- Name: caso caso_creado_por_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso
    ADD CONSTRAINT caso_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES ggto_sync.usuario(p00);


--
-- Name: caso_especial caso_especial_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso_especial
    ADD CONSTRAINT caso_especial_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_sync.caso(id_caso) ON DELETE CASCADE;


--
-- Name: caso_especial caso_especial_id_solicitante_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso_especial
    ADD CONSTRAINT caso_especial_id_solicitante_fkey FOREIGN KEY (id_solicitante) REFERENCES ggto_sync.solicitante(id_solicitante);


--
-- Name: caso_estado_hist caso_estado_hist_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_sync.caso(id_caso) ON DELETE CASCADE;


--
-- Name: caso_estado_hist caso_estado_hist_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_sync.usuario(p00);


--
-- Name: caso caso_id_causa_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso
    ADD CONSTRAINT caso_id_causa_fkey FOREIGN KEY (id_causa) REFERENCES ggto_sync.causa(id_causa);


--
-- Name: caso caso_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso
    ADD CONSTRAINT caso_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_sync.central(id_central);


--
-- Name: caso caso_id_lote_ingesta_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso
    ADD CONSTRAINT caso_id_lote_ingesta_fkey FOREIGN KEY (id_lote_ingesta) REFERENCES ggto_sync.ingesta_lote(id_lote);


--
-- Name: caso caso_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.caso
    ADD CONSTRAINT caso_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_sync.sector(id_sector);


--
-- Name: cita cita_creado_por_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cita
    ADD CONSTRAINT cita_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES ggto_sync.usuario(p00);


--
-- Name: cita cita_id_caso_especial_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cita
    ADD CONSTRAINT cita_id_caso_especial_fkey FOREIGN KEY (id_caso_especial) REFERENCES ggto_sync.caso_especial(id_caso_especial) ON DELETE CASCADE;


--
-- Name: cita cita_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cita
    ADD CONSTRAINT cita_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_sync.caso(id_caso) ON DELETE CASCADE;


--
-- Name: cita cita_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cita
    ADD CONSTRAINT cita_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_sync.cuadrilla(id_cuadrilla);


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_sync.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_id_herramienta_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_id_herramienta_fkey FOREIGN KEY (id_herramienta) REFERENCES ggto_sync.herramienta(id_herramienta) ON DELETE CASCADE;


--
-- Name: cuadrilla cuadrilla_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla
    ADD CONSTRAINT cuadrilla_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_sync.central(id_central);


--
-- Name: cuadrilla cuadrilla_id_flota_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla
    ADD CONSTRAINT cuadrilla_id_flota_fkey FOREIGN KEY (id_flota) REFERENCES ggto_sync.flota(id_flota);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_sync.central(id_central);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_sync.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_sync.sector(id_sector) ON DELETE CASCADE;


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_sync.usuario(p00);


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_sync.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_sync.tecnico(id_tecnico) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.despacho_caso
    ADD CONSTRAINT despacho_caso_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_sync.caso(id_caso) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_despacho_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.despacho_caso
    ADD CONSTRAINT despacho_caso_id_despacho_fkey FOREIGN KEY (id_despacho) REFERENCES ggto_sync.despacho(id_despacho) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.despacho_caso
    ADD CONSTRAINT despacho_caso_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_sync.sector(id_sector);


--
-- Name: despacho despacho_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.despacho
    ADD CONSTRAINT despacho_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_sync.central(id_central);


--
-- Name: despacho despacho_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.despacho
    ADD CONSTRAINT despacho_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_sync.cuadrilla(id_cuadrilla);


--
-- Name: despacho despacho_usuario_crea_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.despacho
    ADD CONSTRAINT despacho_usuario_crea_fkey FOREIGN KEY (usuario_crea) REFERENCES ggto_sync.usuario(p00);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_p00_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_p00_fkey FOREIGN KEY (p00) REFERENCES ggto_sync.usuario(p00) ON DELETE CASCADE;


--
-- Name: evidencia evidencia_id_actividad_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.evidencia
    ADD CONSTRAINT evidencia_id_actividad_fkey FOREIGN KEY (id_actividad) REFERENCES ggto_sync.actividad(id_actividad) ON DELETE CASCADE;


--
-- Name: falla_masiva falla_masiva_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.falla_masiva
    ADD CONSTRAINT falla_masiva_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_sync.central(id_central);


--
-- Name: falla_masiva falla_masiva_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.falla_masiva
    ADD CONSTRAINT falla_masiva_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_sync.cuadrilla(id_cuadrilla);


--
-- Name: falla_masiva falla_masiva_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.falla_masiva
    ADD CONSTRAINT falla_masiva_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_sync.sector(id_sector);


--
-- Name: flota flota_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.flota
    ADD CONSTRAINT flota_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_sync.central(id_central);


--
-- Name: herramienta herramienta_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.herramienta
    ADD CONSTRAINT herramienta_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_sync.central(id_central);


--
-- Name: incidente incidente_id_actividad_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.incidente
    ADD CONSTRAINT incidente_id_actividad_fkey FOREIGN KEY (id_actividad) REFERENCES ggto_sync.actividad(id_actividad) ON DELETE SET NULL;


--
-- Name: incidente incidente_id_flota_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.incidente
    ADD CONSTRAINT incidente_id_flota_fkey FOREIGN KEY (id_flota) REFERENCES ggto_sync.flota(id_flota);


--
-- Name: incidente incidente_id_herramienta_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.incidente
    ADD CONSTRAINT incidente_id_herramienta_fkey FOREIGN KEY (id_herramienta) REFERENCES ggto_sync.herramienta(id_herramienta);


--
-- Name: ingesta_lote ingesta_lote_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.ingesta_lote
    ADD CONSTRAINT ingesta_lote_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_sync.central(id_central);


--
-- Name: insumo insumo_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.insumo
    ADD CONSTRAINT insumo_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_sync.central(id_central);


--
-- Name: inventario_movimiento inventario_movimiento_id_insumo_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES ggto_sync.insumo(id_insumo);


--
-- Name: inventario_movimiento inventario_movimiento_id_orden_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_orden_fkey FOREIGN KEY (id_orden) REFERENCES ggto_sync.orden_material(id_orden);


--
-- Name: inventario_movimiento inventario_movimiento_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_sync.tecnico(id_tecnico);


--
-- Name: inventario_movimiento inventario_movimiento_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_sync.usuario(p00);


--
-- Name: notificacion notificacion_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.notificacion
    ADD CONSTRAINT notificacion_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_sync.caso(id_caso) ON DELETE SET NULL;


--
-- Name: orden_material_detalle orden_material_detalle_id_insumo_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES ggto_sync.insumo(id_insumo);


--
-- Name: orden_material_detalle orden_material_detalle_id_orden_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_orden_fkey FOREIGN KEY (id_orden) REFERENCES ggto_sync.orden_material(id_orden) ON DELETE CASCADE;


--
-- Name: orden_material orden_material_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.orden_material
    ADD CONSTRAINT orden_material_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_sync.caso(id_caso);


--
-- Name: orden_material orden_material_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.orden_material
    ADD CONSTRAINT orden_material_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_sync.cuadrilla(id_cuadrilla);


--
-- Name: orden_material orden_material_id_falla_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.orden_material
    ADD CONSTRAINT orden_material_id_falla_fkey FOREIGN KEY (id_falla) REFERENCES ggto_sync.falla_masiva(id_falla) ON DELETE CASCADE;


--
-- Name: orden_material orden_material_solicitante_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.orden_material
    ADD CONSTRAINT orden_material_solicitante_usuario_fkey FOREIGN KEY (solicitante_usuario) REFERENCES ggto_sync.usuario(p00);


--
-- Name: sector_direccion sector_direccion_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sector_direccion
    ADD CONSTRAINT sector_direccion_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_sync.sector(id_sector) ON DELETE CASCADE;


--
-- Name: sector sector_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sector
    ADD CONSTRAINT sector_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_sync.central(id_central) ON DELETE CASCADE;


--
-- Name: seguimiento seguimiento_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.seguimiento
    ADD CONSTRAINT seguimiento_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_sync.caso(id_caso) ON DELETE CASCADE;


--
-- Name: seguimiento seguimiento_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.seguimiento
    ADD CONSTRAINT seguimiento_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_sync.usuario(p00);


--
-- Name: sincronizacion sincronizacion_id_dispositivo_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sincronizacion
    ADD CONSTRAINT sincronizacion_id_dispositivo_fkey FOREIGN KEY (id_dispositivo) REFERENCES ggto_sync.dispositivo_seguridad(id_dispositivo) ON DELETE SET NULL;


--
-- Name: sincronizacion sincronizacion_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sincronizacion
    ADD CONSTRAINT sincronizacion_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_sync.tecnico(id_tecnico);


--
-- Name: sync_log sync_log_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.sync_log
    ADD CONSTRAINT sync_log_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_sync.cuadrilla(id_cuadrilla);


--
-- Name: tecnico tecnico_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.tecnico
    ADD CONSTRAINT tecnico_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_sync.central(id_central);


--
-- Name: usuario usuario_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.usuario
    ADD CONSTRAINT usuario_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_sync.central(id_central);


--
-- Name: usuario usuario_id_rol_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.usuario
    ADD CONSTRAINT usuario_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES ggto_sync.rol(id_rol);


--
-- Name: usuario usuario_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_sync; Owner: -
--

ALTER TABLE ONLY ggto_sync.usuario
    ADD CONSTRAINT usuario_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_sync.tecnico(id_tecnico);


--
-- Name: actividad actividad_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.actividad
    ADD CONSTRAINT actividad_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_test.caso(id_caso) ON DELETE CASCADE;


--
-- Name: actividad actividad_id_causa_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.actividad
    ADD CONSTRAINT actividad_id_causa_fkey FOREIGN KEY (id_causa) REFERENCES ggto_test.causa(id_causa);


--
-- Name: actividad actividad_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.actividad
    ADD CONSTRAINT actividad_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_test.cuadrilla(id_cuadrilla);


--
-- Name: actividad actividad_id_metodo_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.actividad
    ADD CONSTRAINT actividad_id_metodo_fkey FOREIGN KEY (id_metodo) REFERENCES ggto_test.catalogo_metodo(id_metodo);


--
-- Name: actividad actividad_id_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.actividad
    ADD CONSTRAINT actividad_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES ggto_test.usuario(id_usuario);


--
-- Name: caso caso_creado_por_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso
    ADD CONSTRAINT caso_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES ggto_test.usuario(p00);


--
-- Name: caso_especial caso_especial_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso_especial
    ADD CONSTRAINT caso_especial_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_test.caso(id_caso) ON DELETE CASCADE;


--
-- Name: caso_especial caso_especial_id_solicitante_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso_especial
    ADD CONSTRAINT caso_especial_id_solicitante_fkey FOREIGN KEY (id_solicitante) REFERENCES ggto_test.solicitante(id_solicitante);


--
-- Name: caso_estado_hist caso_estado_hist_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_test.caso(id_caso) ON DELETE CASCADE;


--
-- Name: caso_estado_hist caso_estado_hist_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_test.usuario(p00);


--
-- Name: caso caso_id_causa_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso
    ADD CONSTRAINT caso_id_causa_fkey FOREIGN KEY (id_causa) REFERENCES ggto_test.causa(id_causa);


--
-- Name: caso caso_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso
    ADD CONSTRAINT caso_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: caso caso_id_lote_ingesta_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso
    ADD CONSTRAINT caso_id_lote_ingesta_fkey FOREIGN KEY (id_lote_ingesta) REFERENCES ggto_test.ingesta_lote(id_lote);


--
-- Name: caso caso_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.caso
    ADD CONSTRAINT caso_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_test.sector(id_sector);


--
-- Name: cita cita_creado_por_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cita
    ADD CONSTRAINT cita_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES ggto_test.usuario(p00);


--
-- Name: cita cita_id_caso_especial_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cita
    ADD CONSTRAINT cita_id_caso_especial_fkey FOREIGN KEY (id_caso_especial) REFERENCES ggto_test.caso_especial(id_caso_especial) ON DELETE CASCADE;


--
-- Name: cita cita_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cita
    ADD CONSTRAINT cita_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_test.caso(id_caso) ON DELETE CASCADE;


--
-- Name: cita cita_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cita
    ADD CONSTRAINT cita_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_test.cuadrilla(id_cuadrilla);


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_test.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_id_herramienta_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_id_herramienta_fkey FOREIGN KEY (id_herramienta) REFERENCES ggto_test.herramienta(id_herramienta) ON DELETE CASCADE;


--
-- Name: cuadrilla cuadrilla_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla
    ADD CONSTRAINT cuadrilla_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: cuadrilla cuadrilla_id_flota_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla
    ADD CONSTRAINT cuadrilla_id_flota_fkey FOREIGN KEY (id_flota) REFERENCES ggto_test.flota(id_flota);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_test.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_test.sector(id_sector) ON DELETE CASCADE;


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_test.usuario(p00);


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_test.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_test.tecnico(id_tecnico) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.despacho_caso
    ADD CONSTRAINT despacho_caso_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_test.caso(id_caso) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_despacho_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.despacho_caso
    ADD CONSTRAINT despacho_caso_id_despacho_fkey FOREIGN KEY (id_despacho) REFERENCES ggto_test.despacho(id_despacho) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.despacho_caso
    ADD CONSTRAINT despacho_caso_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_test.sector(id_sector);


--
-- Name: despacho despacho_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.despacho
    ADD CONSTRAINT despacho_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: despacho despacho_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.despacho
    ADD CONSTRAINT despacho_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_test.cuadrilla(id_cuadrilla);


--
-- Name: despacho despacho_usuario_crea_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.despacho
    ADD CONSTRAINT despacho_usuario_crea_fkey FOREIGN KEY (usuario_crea) REFERENCES ggto_test.usuario(p00);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_p00_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_p00_fkey FOREIGN KEY (p00) REFERENCES ggto_test.usuario(p00) ON DELETE CASCADE;


--
-- Name: evidencia evidencia_id_actividad_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.evidencia
    ADD CONSTRAINT evidencia_id_actividad_fkey FOREIGN KEY (id_actividad) REFERENCES ggto_test.actividad(id_actividad) ON DELETE CASCADE;


--
-- Name: falla_masiva falla_masiva_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.falla_masiva
    ADD CONSTRAINT falla_masiva_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: falla_masiva falla_masiva_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.falla_masiva
    ADD CONSTRAINT falla_masiva_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_test.cuadrilla(id_cuadrilla);


--
-- Name: falla_masiva falla_masiva_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.falla_masiva
    ADD CONSTRAINT falla_masiva_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_test.sector(id_sector);


--
-- Name: flota flota_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.flota
    ADD CONSTRAINT flota_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: herramienta herramienta_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.herramienta
    ADD CONSTRAINT herramienta_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: incidente incidente_id_actividad_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.incidente
    ADD CONSTRAINT incidente_id_actividad_fkey FOREIGN KEY (id_actividad) REFERENCES ggto_test.actividad(id_actividad) ON DELETE SET NULL;


--
-- Name: incidente incidente_id_flota_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.incidente
    ADD CONSTRAINT incidente_id_flota_fkey FOREIGN KEY (id_flota) REFERENCES ggto_test.flota(id_flota);


--
-- Name: incidente incidente_id_herramienta_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.incidente
    ADD CONSTRAINT incidente_id_herramienta_fkey FOREIGN KEY (id_herramienta) REFERENCES ggto_test.herramienta(id_herramienta);


--
-- Name: ingesta_lote ingesta_lote_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.ingesta_lote
    ADD CONSTRAINT ingesta_lote_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: insumo insumo_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.insumo
    ADD CONSTRAINT insumo_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: inventario_movimiento inventario_movimiento_id_insumo_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES ggto_test.insumo(id_insumo);


--
-- Name: inventario_movimiento inventario_movimiento_id_orden_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_orden_fkey FOREIGN KEY (id_orden) REFERENCES ggto_test.orden_material(id_orden);


--
-- Name: inventario_movimiento inventario_movimiento_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_test.tecnico(id_tecnico);


--
-- Name: inventario_movimiento inventario_movimiento_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_test.usuario(p00);


--
-- Name: mensaje_destino mensaje_destino_id_mensaje_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.mensaje_destino
    ADD CONSTRAINT mensaje_destino_id_mensaje_fkey FOREIGN KEY (id_mensaje) REFERENCES ggto_test.mensaje(id_mensaje) ON DELETE CASCADE;


--
-- Name: mensaje_destino mensaje_destino_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.mensaje_destino
    ADD CONSTRAINT mensaje_destino_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_test.tecnico(id_tecnico) ON DELETE CASCADE;


--
-- Name: mensaje mensaje_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.mensaje
    ADD CONSTRAINT mensaje_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_test.caso(id_caso) ON DELETE SET NULL;


--
-- Name: mensaje mensaje_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.mensaje
    ADD CONSTRAINT mensaje_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: mensaje mensaje_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.mensaje
    ADD CONSTRAINT mensaje_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_test.cuadrilla(id_cuadrilla) ON DELETE SET NULL;


--
-- Name: mensaje mensaje_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.mensaje
    ADD CONSTRAINT mensaje_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_test.tecnico(id_tecnico) ON DELETE SET NULL;


--
-- Name: mensaje mensaje_origen_p00_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.mensaje
    ADD CONSTRAINT mensaje_origen_p00_fkey FOREIGN KEY (origen_p00) REFERENCES ggto_test.usuario(p00);


--
-- Name: notificacion notificacion_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.notificacion
    ADD CONSTRAINT notificacion_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_test.caso(id_caso) ON DELETE SET NULL;


--
-- Name: orden_material_detalle orden_material_detalle_id_insumo_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES ggto_test.insumo(id_insumo);


--
-- Name: orden_material_detalle orden_material_detalle_id_orden_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_orden_fkey FOREIGN KEY (id_orden) REFERENCES ggto_test.orden_material(id_orden) ON DELETE CASCADE;


--
-- Name: orden_material orden_material_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.orden_material
    ADD CONSTRAINT orden_material_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_test.caso(id_caso);


--
-- Name: orden_material orden_material_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.orden_material
    ADD CONSTRAINT orden_material_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_test.cuadrilla(id_cuadrilla);


--
-- Name: orden_material orden_material_id_falla_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.orden_material
    ADD CONSTRAINT orden_material_id_falla_fkey FOREIGN KEY (id_falla) REFERENCES ggto_test.falla_masiva(id_falla) ON DELETE CASCADE;


--
-- Name: orden_material orden_material_solicitante_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.orden_material
    ADD CONSTRAINT orden_material_solicitante_usuario_fkey FOREIGN KEY (solicitante_usuario) REFERENCES ggto_test.usuario(p00);


--
-- Name: sector_direccion sector_direccion_id_sector_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sector_direccion
    ADD CONSTRAINT sector_direccion_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES ggto_test.sector(id_sector) ON DELETE CASCADE;


--
-- Name: sector sector_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sector
    ADD CONSTRAINT sector_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central) ON DELETE CASCADE;


--
-- Name: seguimiento seguimiento_id_caso_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.seguimiento
    ADD CONSTRAINT seguimiento_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES ggto_test.caso(id_caso) ON DELETE CASCADE;


--
-- Name: seguimiento seguimiento_usuario_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.seguimiento
    ADD CONSTRAINT seguimiento_usuario_fkey FOREIGN KEY (usuario) REFERENCES ggto_test.usuario(p00);


--
-- Name: sincronizacion sincronizacion_id_dispositivo_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sincronizacion
    ADD CONSTRAINT sincronizacion_id_dispositivo_fkey FOREIGN KEY (id_dispositivo) REFERENCES ggto_test.dispositivo_seguridad(id_dispositivo) ON DELETE SET NULL;


--
-- Name: sincronizacion sincronizacion_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sincronizacion
    ADD CONSTRAINT sincronizacion_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_test.tecnico(id_tecnico);


--
-- Name: sync_check sync_check_id_sync_log_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sync_check
    ADD CONSTRAINT sync_check_id_sync_log_fkey FOREIGN KEY (id_sync_log) REFERENCES ggto_test.sync_log(id_sync_log) ON DELETE CASCADE;


--
-- Name: sync_log sync_log_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sync_log
    ADD CONSTRAINT sync_log_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: sync_log sync_log_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.sync_log
    ADD CONSTRAINT sync_log_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES ggto_test.cuadrilla(id_cuadrilla);


--
-- Name: tecnico tecnico_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.tecnico
    ADD CONSTRAINT tecnico_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: usuario usuario_id_central_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.usuario
    ADD CONSTRAINT usuario_id_central_fkey FOREIGN KEY (id_central) REFERENCES ggto_test.central(id_central);


--
-- Name: usuario usuario_id_rol_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.usuario
    ADD CONSTRAINT usuario_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES ggto_test.rol(id_rol);


--
-- Name: usuario usuario_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: ggto_test; Owner: -
--

ALTER TABLE ONLY ggto_test.usuario
    ADD CONSTRAINT usuario_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES ggto_test.tecnico(id_tecnico);


--
-- Name: actividad actividad_id_caso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad
    ADD CONSTRAINT actividad_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES public.caso(id_caso) ON DELETE CASCADE;


--
-- Name: actividad actividad_id_causa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad
    ADD CONSTRAINT actividad_id_causa_fkey FOREIGN KEY (id_causa) REFERENCES public.causa(id_causa);


--
-- Name: actividad actividad_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad
    ADD CONSTRAINT actividad_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES public.cuadrilla(id_cuadrilla);


--
-- Name: actividad actividad_id_metodo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad
    ADD CONSTRAINT actividad_id_metodo_fkey FOREIGN KEY (id_metodo) REFERENCES public.catalogo_metodo(id_metodo);


--
-- Name: actividad actividad_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividad
    ADD CONSTRAINT actividad_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario);


--
-- Name: auditoria auditoria_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: caso caso_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso
    ADD CONSTRAINT caso_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuario(p00);


--
-- Name: caso_especial caso_especial_id_caso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso_especial
    ADD CONSTRAINT caso_especial_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES public.caso(id_caso) ON DELETE CASCADE;


--
-- Name: caso_especial caso_especial_id_solicitante_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso_especial
    ADD CONSTRAINT caso_especial_id_solicitante_fkey FOREIGN KEY (id_solicitante) REFERENCES public.solicitante(id_solicitante);


--
-- Name: caso_estado_hist caso_estado_hist_id_caso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES public.caso(id_caso) ON DELETE CASCADE;


--
-- Name: caso_estado_hist caso_estado_hist_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso_estado_hist
    ADD CONSTRAINT caso_estado_hist_usuario_fkey FOREIGN KEY (usuario) REFERENCES public.usuario(p00);


--
-- Name: caso caso_id_causa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso
    ADD CONSTRAINT caso_id_causa_fkey FOREIGN KEY (id_causa) REFERENCES public.causa(id_causa);


--
-- Name: caso caso_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso
    ADD CONSTRAINT caso_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: caso caso_id_lote_ingesta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso
    ADD CONSTRAINT caso_id_lote_ingesta_fkey FOREIGN KEY (id_lote_ingesta) REFERENCES public.ingesta_lote(id_lote);


--
-- Name: caso caso_id_sector_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso
    ADD CONSTRAINT caso_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES public.sector(id_sector);


--
-- Name: cita cita_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cita
    ADD CONSTRAINT cita_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuario(p00);


--
-- Name: cita cita_id_caso_especial_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cita
    ADD CONSTRAINT cita_id_caso_especial_fkey FOREIGN KEY (id_caso_especial) REFERENCES public.caso_especial(id_caso_especial) ON DELETE CASCADE;


--
-- Name: cita cita_id_caso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cita
    ADD CONSTRAINT cita_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES public.caso(id_caso) ON DELETE CASCADE;


--
-- Name: cita cita_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cita
    ADD CONSTRAINT cita_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES public.cuadrilla(id_cuadrilla);


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES public.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_herramienta cuadrilla_herramienta_id_herramienta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_herramienta
    ADD CONSTRAINT cuadrilla_herramienta_id_herramienta_fkey FOREIGN KEY (id_herramienta) REFERENCES public.herramienta(id_herramienta) ON DELETE CASCADE;


--
-- Name: cuadrilla cuadrilla_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla
    ADD CONSTRAINT cuadrilla_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: cuadrilla cuadrilla_id_flota_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla
    ADD CONSTRAINT cuadrilla_id_flota_fkey FOREIGN KEY (id_flota) REFERENCES public.flota(id_flota);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES public.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_id_sector_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES public.sector(id_sector) ON DELETE CASCADE;


--
-- Name: cuadrilla_sector_dia cuadrilla_sector_dia_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_sector_dia
    ADD CONSTRAINT cuadrilla_sector_dia_usuario_fkey FOREIGN KEY (usuario) REFERENCES public.usuario(p00);


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES public.cuadrilla(id_cuadrilla) ON DELETE CASCADE;


--
-- Name: cuadrilla_tecnico cuadrilla_tecnico_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuadrilla_tecnico
    ADD CONSTRAINT cuadrilla_tecnico_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.tecnico(id_tecnico) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_caso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho_caso
    ADD CONSTRAINT despacho_caso_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES public.caso(id_caso) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_despacho_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho_caso
    ADD CONSTRAINT despacho_caso_id_despacho_fkey FOREIGN KEY (id_despacho) REFERENCES public.despacho(id_despacho) ON DELETE CASCADE;


--
-- Name: despacho_caso despacho_caso_id_sector_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho_caso
    ADD CONSTRAINT despacho_caso_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES public.sector(id_sector);


--
-- Name: despacho despacho_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho
    ADD CONSTRAINT despacho_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: despacho despacho_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho
    ADD CONSTRAINT despacho_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES public.cuadrilla(id_cuadrilla);


--
-- Name: despacho_metrica_diaria despacho_metrica_diaria_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho_metrica_diaria
    ADD CONSTRAINT despacho_metrica_diaria_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: despacho despacho_usuario_crea_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despacho
    ADD CONSTRAINT despacho_usuario_crea_fkey FOREIGN KEY (usuario_crea) REFERENCES public.usuario(p00);


--
-- Name: dispositivo_seguridad dispositivo_seguridad_p00_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivo_seguridad
    ADD CONSTRAINT dispositivo_seguridad_p00_fkey FOREIGN KEY (p00) REFERENCES public.usuario(p00) ON DELETE CASCADE;


--
-- Name: evidencia evidencia_id_actividad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia
    ADD CONSTRAINT evidencia_id_actividad_fkey FOREIGN KEY (id_actividad) REFERENCES public.actividad(id_actividad) ON DELETE CASCADE;


--
-- Name: evidencia evidencia_id_caso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidencia
    ADD CONSTRAINT evidencia_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES public.caso(id_caso) ON DELETE CASCADE;


--
-- Name: falla_masiva_caso falla_masiva_caso_agregado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva_caso
    ADD CONSTRAINT falla_masiva_caso_agregado_por_fkey FOREIGN KEY (agregado_por) REFERENCES public.usuario(p00);


--
-- Name: falla_masiva_caso falla_masiva_caso_id_caso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva_caso
    ADD CONSTRAINT falla_masiva_caso_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES public.caso(id_caso) ON DELETE CASCADE;


--
-- Name: falla_masiva_caso falla_masiva_caso_id_falla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva_caso
    ADD CONSTRAINT falla_masiva_caso_id_falla_fkey FOREIGN KEY (id_falla) REFERENCES public.falla_masiva(id_falla) ON DELETE CASCADE;


--
-- Name: falla_masiva falla_masiva_cerrada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva
    ADD CONSTRAINT falla_masiva_cerrada_por_fkey FOREIGN KEY (cerrada_por) REFERENCES public.usuario(p00);


--
-- Name: falla_masiva falla_masiva_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva
    ADD CONSTRAINT falla_masiva_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: falla_masiva falla_masiva_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva
    ADD CONSTRAINT falla_masiva_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES public.cuadrilla(id_cuadrilla);


--
-- Name: falla_masiva falla_masiva_id_sector_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva
    ADD CONSTRAINT falla_masiva_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES public.sector(id_sector);


--
-- Name: falla_masiva falla_masiva_id_validador_crass_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.falla_masiva
    ADD CONSTRAINT falla_masiva_id_validador_crass_fkey FOREIGN KEY (id_validador_crass) REFERENCES public.solicitante(id_solicitante) ON DELETE SET NULL;


--
-- Name: caso fk_caso_id_pago; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caso
    ADD CONSTRAINT fk_caso_id_pago FOREIGN KEY (id_pago) REFERENCES public.identificador_pago(id_pago) ON DELETE RESTRICT;


--
-- Name: flota flota_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flota
    ADD CONSTRAINT flota_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: herramienta herramienta_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.herramienta
    ADD CONSTRAINT herramienta_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: identificador_pago identificador_pago_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identificador_pago
    ADD CONSTRAINT identificador_pago_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: incidente incidente_id_actividad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidente
    ADD CONSTRAINT incidente_id_actividad_fkey FOREIGN KEY (id_actividad) REFERENCES public.actividad(id_actividad) ON DELETE SET NULL;


--
-- Name: incidente incidente_id_flota_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidente
    ADD CONSTRAINT incidente_id_flota_fkey FOREIGN KEY (id_flota) REFERENCES public.flota(id_flota);


--
-- Name: incidente incidente_id_herramienta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidente
    ADD CONSTRAINT incidente_id_herramienta_fkey FOREIGN KEY (id_herramienta) REFERENCES public.herramienta(id_herramienta);


--
-- Name: ingesta_lote ingesta_lote_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingesta_lote
    ADD CONSTRAINT ingesta_lote_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: insumo insumo_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insumo
    ADD CONSTRAINT insumo_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: inventario_movimiento inventario_movimiento_id_insumo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES public.insumo(id_insumo);


--
-- Name: inventario_movimiento inventario_movimiento_id_orden_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_orden_fkey FOREIGN KEY (id_orden) REFERENCES public.orden_material(id_orden);


--
-- Name: inventario_movimiento inventario_movimiento_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.tecnico(id_tecnico);


--
-- Name: inventario_movimiento inventario_movimiento_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventario_movimiento
    ADD CONSTRAINT inventario_movimiento_usuario_fkey FOREIGN KEY (usuario) REFERENCES public.usuario(p00);


--
-- Name: mensaje_destino mensaje_destino_id_mensaje_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje_destino
    ADD CONSTRAINT mensaje_destino_id_mensaje_fkey FOREIGN KEY (id_mensaje) REFERENCES public.mensaje(id_mensaje) ON DELETE CASCADE;


--
-- Name: mensaje_destino mensaje_destino_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje_destino
    ADD CONSTRAINT mensaje_destino_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.tecnico(id_tecnico) ON DELETE CASCADE;


--
-- Name: mensaje_destino mensaje_destino_p00_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje_destino
    ADD CONSTRAINT mensaje_destino_p00_fkey FOREIGN KEY (p00) REFERENCES public.usuario(p00) ON DELETE CASCADE;


--
-- Name: mensaje mensaje_id_caso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje
    ADD CONSTRAINT mensaje_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES public.caso(id_caso) ON DELETE SET NULL;


--
-- Name: mensaje mensaje_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje
    ADD CONSTRAINT mensaje_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: mensaje mensaje_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje
    ADD CONSTRAINT mensaje_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES public.cuadrilla(id_cuadrilla) ON DELETE SET NULL;


--
-- Name: mensaje mensaje_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje
    ADD CONSTRAINT mensaje_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.tecnico(id_tecnico) ON DELETE SET NULL;


--
-- Name: mensaje mensaje_id_usuario_destino_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje
    ADD CONSTRAINT mensaje_id_usuario_destino_fkey FOREIGN KEY (id_usuario_destino) REFERENCES public.usuario(p00) ON DELETE SET NULL;


--
-- Name: mensaje mensaje_origen_p00_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensaje
    ADD CONSTRAINT mensaje_origen_p00_fkey FOREIGN KEY (origen_p00) REFERENCES public.usuario(p00);


--
-- Name: notificacion notificacion_id_caso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion
    ADD CONSTRAINT notificacion_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES public.caso(id_caso) ON DELETE SET NULL;


--
-- Name: orden_material_detalle orden_material_detalle_id_insumo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES public.insumo(id_insumo);


--
-- Name: orden_material_detalle orden_material_detalle_id_orden_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_material_detalle
    ADD CONSTRAINT orden_material_detalle_id_orden_fkey FOREIGN KEY (id_orden) REFERENCES public.orden_material(id_orden) ON DELETE CASCADE;


--
-- Name: orden_material orden_material_id_caso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_material
    ADD CONSTRAINT orden_material_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES public.caso(id_caso);


--
-- Name: orden_material orden_material_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_material
    ADD CONSTRAINT orden_material_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES public.cuadrilla(id_cuadrilla);


--
-- Name: orden_material orden_material_id_falla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_material
    ADD CONSTRAINT orden_material_id_falla_fkey FOREIGN KEY (id_falla) REFERENCES public.falla_masiva(id_falla) ON DELETE CASCADE;


--
-- Name: orden_material orden_material_solicitante_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_material
    ADD CONSTRAINT orden_material_solicitante_usuario_fkey FOREIGN KEY (solicitante_usuario) REFERENCES public.usuario(p00);


--
-- Name: sector_direccion sector_direccion_id_sector_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sector_direccion
    ADD CONSTRAINT sector_direccion_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES public.sector(id_sector) ON DELETE CASCADE;


--
-- Name: sector sector_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sector
    ADD CONSTRAINT sector_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central) ON DELETE CASCADE;


--
-- Name: seguimiento seguimiento_id_caso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguimiento
    ADD CONSTRAINT seguimiento_id_caso_fkey FOREIGN KEY (id_caso) REFERENCES public.caso(id_caso) ON DELETE CASCADE;


--
-- Name: seguimiento seguimiento_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguimiento
    ADD CONSTRAINT seguimiento_usuario_fkey FOREIGN KEY (usuario) REFERENCES public.usuario(p00);


--
-- Name: sincronizacion sincronizacion_id_dispositivo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sincronizacion
    ADD CONSTRAINT sincronizacion_id_dispositivo_fkey FOREIGN KEY (id_dispositivo) REFERENCES public.dispositivo_seguridad(id_dispositivo) ON DELETE SET NULL;


--
-- Name: sincronizacion sincronizacion_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sincronizacion
    ADD CONSTRAINT sincronizacion_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.tecnico(id_tecnico);


--
-- Name: solicitante solicitante_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitante
    ADD CONSTRAINT solicitante_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: sync_check sync_check_id_sync_log_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_check
    ADD CONSTRAINT sync_check_id_sync_log_fkey FOREIGN KEY (id_sync_log) REFERENCES public.sync_log(id_sync_log) ON DELETE CASCADE;


--
-- Name: sync_log sync_log_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_log
    ADD CONSTRAINT sync_log_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: sync_log sync_log_id_cuadrilla_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_log
    ADD CONSTRAINT sync_log_id_cuadrilla_fkey FOREIGN KEY (id_cuadrilla) REFERENCES public.cuadrilla(id_cuadrilla);


--
-- Name: tecnico tecnico_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tecnico
    ADD CONSTRAINT tecnico_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: usuario usuario_id_central_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_id_central_fkey FOREIGN KEY (id_central) REFERENCES public.central(id_central);


--
-- Name: usuario usuario_id_rol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.rol(id_rol);


--
-- Name: usuario usuario_id_tecnico_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.tecnico(id_tecnico);


--
-- Name: caso; Type: ROW SECURITY; Schema: ggto_d77; Owner: -
--

ALTER TABLE ggto_d77.caso ENABLE ROW LEVEL SECURITY;

--
-- Name: despacho; Type: ROW SECURITY; Schema: ggto_d77; Owner: -
--

ALTER TABLE ggto_d77.despacho ENABLE ROW LEVEL SECURITY;

--
-- Name: caso p_caso_central; Type: POLICY; Schema: ggto_d77; Owner: -
--

CREATE POLICY p_caso_central ON ggto_d77.caso USING (((ggto_d77.app_central_actual() IS NULL) OR (id_central = ggto_d77.app_central_actual()))) WITH CHECK (((ggto_d77.app_central_actual() IS NULL) OR (id_central = ggto_d77.app_central_actual())));


--
-- Name: despacho p_despacho_central; Type: POLICY; Schema: ggto_d77; Owner: -
--

CREATE POLICY p_despacho_central ON ggto_d77.despacho USING (((ggto_d77.app_central_actual() IS NULL) OR (id_central = ggto_d77.app_central_actual()))) WITH CHECK (((ggto_d77.app_central_actual() IS NULL) OR (id_central = ggto_d77.app_central_actual())));


--
-- Name: caso; Type: ROW SECURITY; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ggto_e2e.caso ENABLE ROW LEVEL SECURITY;

--
-- Name: despacho; Type: ROW SECURITY; Schema: ggto_e2e; Owner: -
--

ALTER TABLE ggto_e2e.despacho ENABLE ROW LEVEL SECURITY;

--
-- Name: caso p_caso_central; Type: POLICY; Schema: ggto_e2e; Owner: -
--

CREATE POLICY p_caso_central ON ggto_e2e.caso USING (((ggto_e2e.app_central_actual() IS NULL) OR (id_central = ggto_e2e.app_central_actual()))) WITH CHECK (((ggto_e2e.app_central_actual() IS NULL) OR (id_central = ggto_e2e.app_central_actual())));


--
-- Name: despacho p_despacho_central; Type: POLICY; Schema: ggto_e2e; Owner: -
--

CREATE POLICY p_despacho_central ON ggto_e2e.despacho USING (((ggto_e2e.app_central_actual() IS NULL) OR (id_central = ggto_e2e.app_central_actual()))) WITH CHECK (((ggto_e2e.app_central_actual() IS NULL) OR (id_central = ggto_e2e.app_central_actual())));


--
-- Name: caso; Type: ROW SECURITY; Schema: ggto_sync; Owner: -
--

ALTER TABLE ggto_sync.caso ENABLE ROW LEVEL SECURITY;

--
-- Name: despacho; Type: ROW SECURITY; Schema: ggto_sync; Owner: -
--

ALTER TABLE ggto_sync.despacho ENABLE ROW LEVEL SECURITY;

--
-- Name: caso p_caso_central; Type: POLICY; Schema: ggto_sync; Owner: -
--

CREATE POLICY p_caso_central ON ggto_sync.caso USING (((ggto_sync.app_central_actual() IS NULL) OR (id_central = ggto_sync.app_central_actual()))) WITH CHECK (((ggto_sync.app_central_actual() IS NULL) OR (id_central = ggto_sync.app_central_actual())));


--
-- Name: despacho p_despacho_central; Type: POLICY; Schema: ggto_sync; Owner: -
--

CREATE POLICY p_despacho_central ON ggto_sync.despacho USING (((ggto_sync.app_central_actual() IS NULL) OR (id_central = ggto_sync.app_central_actual()))) WITH CHECK (((ggto_sync.app_central_actual() IS NULL) OR (id_central = ggto_sync.app_central_actual())));


--
-- Name: caso; Type: ROW SECURITY; Schema: ggto_test; Owner: -
--

ALTER TABLE ggto_test.caso ENABLE ROW LEVEL SECURITY;

--
-- Name: despacho; Type: ROW SECURITY; Schema: ggto_test; Owner: -
--

ALTER TABLE ggto_test.despacho ENABLE ROW LEVEL SECURITY;

--
-- Name: caso p_caso_central; Type: POLICY; Schema: ggto_test; Owner: -
--

CREATE POLICY p_caso_central ON ggto_test.caso USING (((ggto_test.app_central_actual() IS NULL) OR (id_central = ggto_test.app_central_actual()))) WITH CHECK (((ggto_test.app_central_actual() IS NULL) OR (id_central = ggto_test.app_central_actual())));


--
-- Name: despacho p_despacho_central; Type: POLICY; Schema: ggto_test; Owner: -
--

CREATE POLICY p_despacho_central ON ggto_test.despacho USING (((ggto_test.app_central_actual() IS NULL) OR (id_central = ggto_test.app_central_actual()))) WITH CHECK (((ggto_test.app_central_actual() IS NULL) OR (id_central = ggto_test.app_central_actual())));


--
-- Name: caso; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.caso ENABLE ROW LEVEL SECURITY;

--
-- Name: despacho; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.despacho ENABLE ROW LEVEL SECURITY;

--
-- Name: despacho_metrica_diaria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.despacho_metrica_diaria ENABLE ROW LEVEL SECURITY;

--
-- Name: identificador_pago; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.identificador_pago ENABLE ROW LEVEL SECURITY;

--
-- Name: caso p_caso_central; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_caso_central ON public.caso USING (((public.app_central_actual() IS NULL) OR (id_central = public.app_central_actual()))) WITH CHECK (((public.app_central_actual() IS NULL) OR (id_central = public.app_central_actual())));


--
-- Name: despacho p_despacho_central; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_despacho_central ON public.despacho USING (((public.app_central_actual() IS NULL) OR (id_central = public.app_central_actual()))) WITH CHECK (((public.app_central_actual() IS NULL) OR (id_central = public.app_central_actual())));


--
-- Name: despacho_metrica_diaria p_despacho_metrica_central; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_despacho_metrica_central ON public.despacho_metrica_diaria USING (((public.app_central_actual() IS NULL) OR (id_central = public.app_central_actual()))) WITH CHECK (((public.app_central_actual() IS NULL) OR (id_central = public.app_central_actual())));


--
-- Name: identificador_pago p_ip_central; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_ip_central ON public.identificador_pago USING (((public.app_central_actual() IS NULL) OR (id_central = public.app_central_actual()) OR (EXISTS ( SELECT 1
   FROM public.caso c
  WHERE ((c.id_pago = identificador_pago.id_pago) AND (c.id_central = public.app_central_actual())))))) WITH CHECK (((public.app_central_actual() IS NULL) OR (id_central = public.app_central_actual())));


--
-- PostgreSQL database dump complete
--

\unrestrict UJYjLNAA42cKyEncPI9PNFIndpcWsbkhjlubIrvMwOIfFi54rJHlW1SDeEFTMPU

