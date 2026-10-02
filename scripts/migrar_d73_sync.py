#!/usr/bin/env python3
"""Aplica la **migración D-73** (sincronización de la APK) sobre la base destino.

=============================================================================
QUÉ HACE
    1. Crea la tabla `sync_log` (+ índice) si no existe.
    2. Relaja `evidencia.id_actividad` a NULL: permite subir la foto desde el
       campo ANTES de crear la actividad (flujo CARGA de la APK).
    3. Verifica el resultado contra el catálogo de PostgreSQL.

    Es **idempotente**: puede ejecutarse varias veces sin efectos secundarios.
    No toca datos existentes — solo esquema.

SEGURIDAD
    · Por defecto es **simulación** (`--dry-run` implícito): solo informa qué
      haría, leyendo el catálogo actual.
    · Para escribir hay que pasar `--aplicar` y confirmar (o `--si`).
    · Todo corre en UNA transacción: si algo falla, no queda a medias.
    · Registra cada ejecución en RepoTecnico/BaseOperaciones/migracion_d73.log
    · NUNCA se ejecuta sola.

USO
    export DB_HOST=... DB_NAME=ggtov2 DB_USER=ggtov2_app DB_PASSWORD='...'
    python3 scripts/migrar_d73_sync.py                 # simulación (informativa)
    python3 scripts/migrar_d73_sync.py --aplicar       # aplica con confirmación
    python3 scripts/migrar_d73_sync.py --aplicar --si  # aplica sin preguntar
    python3 scripts/migrar_d73_sync.py --dsn "postgresql://user:pwd@host/db"
=============================================================================
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d73.log"

# --- Sentencias DDL (idempotentes) ---------------------------------------- #

SQL_SYNC_LOG = """
CREATE TABLE IF NOT EXISTS sync_log (
    id_sync_log     bigserial    PRIMARY KEY,
    p00             varchar(20)  NOT NULL,
    id_cuadrilla    integer      REFERENCES cuadrilla(id_cuadrilla),
    tipo            varchar(20)  NOT NULL CHECK (tipo IN ('DESCARGA','CARGA')),
    dispositivo_id  varchar(80),
    version_app     varchar(20),
    iniciado_en     timestamptz  NOT NULL DEFAULT now(),
    finalizado_en   timestamptz,
    recibidos       integer      NOT NULL DEFAULT 0,
    procesados      integer      NOT NULL DEFAULT 0,
    errores         integer      NOT NULL DEFAULT 0,
    estado          varchar(20)  NOT NULL DEFAULT 'EN_PROCESO'
                    CHECK (estado IN ('EN_PROCESO','OK','PARCIAL','ERROR')),
    detalle         jsonb
);
"""

SQL_SYNC_LOG_INDEX = """
CREATE INDEX IF NOT EXISTS ix_sync_log_p00_fecha ON sync_log (p00, iniciado_en DESC);
"""

# Relajar NOT NULL solo si todavía lo tiene (evita NOTICEs inútiles).
SQL_EVIDENCIA_NULLABLE = """
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name   = 'evidencia'
           AND column_name  = 'id_actividad'
           AND is_nullable  = 'NO'
    ) THEN
        ALTER TABLE evidencia ALTER COLUMN id_actividad DROP NOT NULL;
        RAISE NOTICE 'evidencia.id_actividad ahora admite NULL';
    ELSE
        RAISE NOTICE 'evidencia.id_actividad ya admitía NULL (nada que hacer)';
    END IF;
END;
$$;
"""

VERIFICACION = """
SELECT
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'sync_log')      AS sync_log_tabla,
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'sync_log')      AS sync_log_columnas,
  (SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname = current_schema() AND indexname = 'ix_sync_log_p00_fecha') AS indice_p00_fecha,
  (SELECT is_nullable FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'evidencia'
      AND column_name = 'id_actividad')                                     AS evidencia_idact_null;
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
    fila = cur.fetchone()
    return dict(zip(cols, fila, strict=True))


def main() -> int:
    p = argparse.ArgumentParser(description="Migración D-73: sync_log + evidencia.id_actividad NULL.")
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
        registrar("MIGRACIÓN D-73 (sync_log + evidencia.id_actividad NULL)")
        modo = "APLICAR" if args.aplicar else "SIMULACIÓN"
        registrar(f"modo={modo}")
        registrar(f"estado actual: {antes}")

        necesita_tabla = antes["sync_log_tabla"] == 0
        necesita_indice = antes["indice_p00_fecha"] == 0
        necesita_relax = antes["evidencia_idact_null"] == "NO"

        if not (necesita_tabla or necesita_indice or necesita_relax):
            registrar("✓ La base YA está migrada: no hay cambios pendientes.")
            conn.rollback()
            return 0

        registrar("Cambios pendientes:")
        if necesita_tabla:
            registrar("  · CREATE TABLE sync_log (13 columnas, 2 CHECK, FK a cuadrilla)")
        if necesita_indice:
            registrar("  · CREATE INDEX ix_sync_log_p00_fecha")
        if necesita_relax:
            registrar("  · ALTER TABLE evidencia ALTER COLUMN id_actividad DROP NOT NULL")

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

        if necesita_tabla:
            cur.execute(SQL_SYNC_LOG)
            registrar("  ✓ sync_log creada")
        if necesita_indice:
            cur.execute(SQL_SYNC_LOG_INDEX)
            registrar("  ✓ índice ix_sync_log_p00_fecha creado")
        if necesita_relax:
            cur.execute(SQL_EVIDENCIA_NULLABLE)
            for nota in conn.notices[-3:] if hasattr(conn, "notices") else []:
                registrar(f"    · {nota.strip()}")
            registrar("  ✓ evidencia.id_actividad relajado (o ya estaba)")

        conn.commit()

        despues = estado_actual(cur)
        registrar(f"verificación post-migración: {despues}")
        ok = (
            despues["sync_log_tabla"] == 1
            and despues["sync_log_columnas"] == 13
            and despues["indice_p00_fecha"] == 1
            and despues["evidencia_idact_null"] == "YES"
        )
        registrar("✓ MIGRACIÓN COMPLETA Y VERIFICADA" if ok else "⚠ VERIFICACIÓN FALLÓ: revisar manualmente")
        return 0 if ok else 3
    except Exception as exc:
        conn.rollback()
        registrar(f"ERROR (transacción revertida): {exc}")
        return 4
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
