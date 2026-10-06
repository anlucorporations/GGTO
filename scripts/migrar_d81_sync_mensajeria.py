#!/usr/bin/env python3
"""Aplica la **migración D-81** (log de sincronización, mensajería interna y panel).

=============================================================================
QUÉ HACE (idempotente; solo esquema, no toca datos)
    1. Amplía `sync_log`: `plataforma`, `duracion_ms`, `id_central` (+ índices).
    2. Crea `sync_check` (checklist POR PASO, RF-40).
    3. Crea `mensaje` (RF-41) y `mensaje_destino` (fan-out + lectura).
    4. Añade `cita.recordatorio_para` (idempotencia ante reprogramación).
    5. Siembra los 7 parámetros nuevos en `configuracion`.
    6. Verifica el resultado contra el catálogo de PostgreSQL.

SEGURIDAD
    · Por defecto es **simulación** (`--dry-run` implícito).
    · Para escribir hay que pasar `--aplicar` y confirmar (o `--si`).
    · Todo corre en UNA transacción: si algo falla, no queda a medias.
    · Registra cada ejecución en RepoTecnico/BaseOperaciones/migracion_d81.log
    · NUNCA se ejecuta sola.

USO
    export DB_HOST=... DB_NAME=ggtov2 DB_USER=ggtov2_app DB_PASSWORD='...'
    python3 scripts/migrar_d81_sync_mensajeria.py                 # simulación
    python3 scripts/migrar_d81_sync_mensajeria.py --aplicar       # aplica con confirmación
    python3 scripts/migrar_d81_sync_mensajeria.py --aplicar --si  # aplica sin preguntar
    python3 scripts/migrar_d81_sync_mensajeria.py --dsn "postgresql://user:pwd@host/db"
=============================================================================
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d81.log"

# --- 1. Ampliación de sync_log -------------------------------------------- #

SQL_SYNC_LOG_COLS = """
ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS plataforma  varchar(20) NOT NULL DEFAULT 'APK';
ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS duracion_ms integer;
ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS id_central  integer REFERENCES central(id_central);
"""
SQL_SYNC_LOG_IX = """
CREATE INDEX IF NOT EXISTS ix_sync_log_iniciado    ON sync_log (iniciado_en DESC);
CREATE INDEX IF NOT EXISTS ix_sync_log_estado      ON sync_log (estado, iniciado_en DESC);
CREATE INDEX IF NOT EXISTS ix_sync_log_dispositivo ON sync_log (dispositivo_id);
"""

# --- 2. Checklist por paso ------------------------------------------------- #

SQL_SYNC_CHECK = """
CREATE TABLE IF NOT EXISTS sync_check (
    id_sync_check  bigserial   PRIMARY KEY,
    id_sync_log    bigint      NOT NULL REFERENCES sync_log(id_sync_log) ON DELETE CASCADE,
    paso           varchar(12) NOT NULL CHECK (paso IN ('CONEXION','LOGIN','DESCARGA','CARGA')),
    estado         varchar(12) NOT NULL CHECK (estado IN ('PENDIENTE','EN_CURSO','OK','ERROR','OMITIDO')),
    fecha_hora     timestamptz,
    detalle        jsonb,
    UNIQUE (id_sync_log, paso)
);
"""

# --- 3. Mensajería interna ------------------------------------------------- #

SQL_MENSAJE = """
CREATE TABLE IF NOT EXISTS mensaje (
    id_mensaje     bigserial    PRIMARY KEY,
    id_central     integer      NOT NULL REFERENCES central(id_central),
    origen_p00     varchar(20)  REFERENCES usuario(p00),   -- NULL en los automáticos del sistema
    destino_tipo   varchar(12)  NOT NULL CHECK (destino_tipo IN ('TODOS','CUADRILLA','TECNICO')),
    id_cuadrilla   integer      REFERENCES cuadrilla(id_cuadrilla) ON DELETE SET NULL,
    id_tecnico     integer      REFERENCES tecnico(id_tecnico)     ON DELETE SET NULL,
    tipo           varchar(20)  NOT NULL
                   CHECK (tipo IN ('RECORDATORIO_CITA','ESTADO_SYNC','ALARMA_DESPACHO','TEXTO')),
    cuerpo         varchar(500) NOT NULL,
    id_caso        bigint       REFERENCES caso(id_caso) ON DELETE SET NULL,
    dedupe_key     varchar(80)  UNIQUE,          -- idempotencia de los automáticos (NULL en manuales)
    creado_en      timestamptz  NOT NULL DEFAULT now(),
    expira_en      timestamptz  NOT NULL DEFAULT (now() + interval '5 days'),
    CHECK (expira_en > creado_en),
    CHECK (
        (destino_tipo = 'TODOS'     AND id_cuadrilla IS NULL     AND id_tecnico IS NULL) OR
        (destino_tipo = 'CUADRILLA' AND id_cuadrilla IS NOT NULL AND id_tecnico IS NULL) OR
        (destino_tipo = 'TECNICO'   AND id_tecnico IS NOT NULL   AND id_cuadrilla IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS ix_mensaje_creado  ON mensaje (creado_en DESC);
CREATE INDEX IF NOT EXISTS ix_mensaje_expira  ON mensaje (expira_en);
CREATE INDEX IF NOT EXISTS ix_mensaje_central ON mensaje (id_central);

CREATE TABLE IF NOT EXISTS mensaje_destino (
    id_mensaje   bigint      NOT NULL REFERENCES mensaje(id_mensaje) ON DELETE CASCADE,
    id_tecnico   integer     NOT NULL REFERENCES tecnico(id_tecnico) ON DELETE CASCADE,
    leido_en     timestamptz,
    PRIMARY KEY (id_mensaje, id_tecnico)
);
CREATE INDEX IF NOT EXISTS ix_mensaje_destino_tecnico ON mensaje_destino (id_tecnico, id_mensaje);
"""

# --- 4. cita.recordatorio_para -------------------------------------------- #

SQL_CITA_COL = """
ALTER TABLE cita ADD COLUMN IF NOT EXISTS recordatorio_para timestamptz;
"""

# --- 5. Parámetros --------------------------------------------------------- #

SQL_PARAMS = """
INSERT INTO configuracion (clave, valor, descripcion) VALUES
    ('mensajeria.poll_segundos',        '20'::jsonb, 'Periodo del sondeo de mensajes (única pieza con 20 s)'),
    ('panel.sync_segundos',             '30'::jsonb, 'Periodo del auto-refresco del panel'),
    ('mensajeria.retencion_dias',       '5'::jsonb,  'Retención de mensajes internos'),
    ('mensajeria.retencion_max_dias',   '30'::jsonb, 'Tope de seguridad: no leídos se borran a los N días'),
    ('sync_log.retencion_dias',         '90'::jsonb, 'Retención del log de sincronización'),
    ('mensajeria.recordatorio_cita_min','60'::jsonb, 'Antelación del recordatorio de cita'),
    ('sync.timeout_min',                '10'::jsonb, 'Cierre de sesiones de sincronización colgadas')
ON CONFLICT (clave) DO NOTHING;
"""

SQL_BLOQUES = [
    ("sync_log: plataforma/duracion_ms/id_central", [SQL_SYNC_LOG_COLS, SQL_SYNC_LOG_IX]),
    ("tabla sync_check (checklist por paso)", [SQL_SYNC_CHECK]),
    ("tablas mensaje + mensaje_destino", [SQL_MENSAJE]),
    ("cita.recordatorio_para", [SQL_CITA_COL]),
    ("parámetros de configuración", [SQL_PARAMS]),
]

# --- 6. Verificación ------------------------------------------------------- #

VERIFICACION = """
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'sync_log'
      AND column_name IN ('plataforma','duracion_ms','id_central'))            AS sync_log_cols,
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name IN ('sync_check','mensaje','mensaje_destino'))           AS tablas_nuevas,
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'cita'
      AND column_name = 'recordatorio_para')                                  AS cita_col,
  (SELECT COUNT(*) FROM configuracion WHERE clave IN (
     'mensajeria.poll_segundos','panel.sync_segundos','mensajeria.retencion_dias',
     'mensajeria.retencion_max_dias','sync_log.retencion_dias',
     'mensajeria.recordatorio_cita_min','sync.timeout_min'))                  AS params;
"""


def registrar(mensaje: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"[{datetime.now(UTC).isoformat(timespec='seconds')}] {mensaje}\n")
    print(mensaje)


def conectar(args: argparse.Namespace):
    import psycopg2

    if args.dsn:
        return psycopg2.connect(args.dsn, connect_timeout=20)
    faltan = [v for v in ("DB_NAME", "DB_USER", "DB_PASSWORD") if not os.environ.get(v)]
    if faltan:
        registrar(f"ERROR: faltan variables de entorno: {', '.join(faltan)} (o usa --dsn)")
        sys.exit(2)
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", "5432")),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        sslmode=os.environ.get("DB_SSLMODE", "prefer"),
        connect_timeout=20,
    )


def estado_actual(cur) -> dict:
    cur.execute(VERIFICACION)
    cols = [d[0] for d in cur.description]
    return dict(zip(cols, cur.fetchone(), strict=True))


def main() -> int:
    p = argparse.ArgumentParser(description="Migración D-81: log de sync + mensajería interna.")
    p.add_argument("--aplicar", action="store_true", help="Escribe los cambios (por defecto simula)")
    p.add_argument("--si", action="store_true", help="Omite la confirmación interactiva")
    p.add_argument("--dsn", default=None, help="Cadena de conexión (alternativa a DB_*)")
    args = p.parse_args()

    conn = conectar(args)
    try:
        conn.autocommit = False
        cur = conn.cursor()

        antes = estado_actual(cur)
        registrar("=" * 78)
        registrar("MIGRACIÓN D-81 (log de sincronización + mensajería interna + panel)")
        registrar(f"modo={'APLICAR' if args.aplicar else 'SIMULACIÓN'}")
        registrar(f"estado actual: {antes}")

        ya = (
            antes["sync_log_cols"] == 3
            and antes["tablas_nuevas"] == 3
            and antes["cita_col"] == 1
            and antes["params"] == 7
        )
        if ya:
            registrar("✓ La base YA está migrada: no hay cambios pendientes.")
            conn.rollback()
            return 0

        registrar("Cambios pendientes:")
        for titulo, _ in SQL_BLOQUES:
            registrar(f"  · {titulo}")

        if not args.aplicar:
            registrar("(simulación) Ejecuta con --aplicar para escribir.")
            conn.rollback()
            return 0

        if not args.si:
            respuesta = input("¿Aplicar los cambios sobre esta base? [sí/no] ").strip().lower()
            if respuesta not in {"sí", "si", "yes", "y"}:
                registrar("Cancelado por el usuario.")
                conn.rollback()
                return 1

        for titulo, sentencias in SQL_BLOQUES:
            for sql in sentencias:
                cur.execute(sql)
            registrar(f"  ✓ {titulo}")

        conn.commit()

        despues = estado_actual(cur)
        registrar(f"verificación post-migración: {despues}")
        ok = (
            despues["sync_log_cols"] == 3
            and despues["tablas_nuevas"] == 3
            and despues["cita_col"] == 1
            and despues["params"] == 7
        )
        registrar("✓ MIGRACIÓN COMPLETA Y VERIFICADA" if ok else "⚠ VERIFICACIÓN FALLÓ: revisar")
        return 0 if ok else 3
    except Exception as exc:
        conn.rollback()
        registrar(f"ERROR (transacción revertida): {exc}")
        return 4
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
