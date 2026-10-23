#!/usr/bin/env python3
"""Aplica la **migración D-157** (asignaciones `DEVUELTO` en `despacho_caso`).

=============================================================================
QUÉ HACE (idempotente; solo esquema, no toca datos)
    1. Reemplaza el CHECK del estado de `despacho_caso` por el catálogo
       completo, que ahora admite `DEVUELTO` (asignación anulada por el
       cierre de jornada).
    2. Verifica el resultado contra el catálogo de PostgreSQL.

POR QUÉ
    El cierre de jornada (D-99) devuelve los casos a `PENDIENTE`, pero su
    renglón de `despacho_caso` seguía contando como asignación vigente: la
    cuadrilla seguía descargando el caso y CASOS lo seguía mostrando como
    suyo. Con `DEVUELTO` la fila conserva la historia del despacho sin
    atribuir el caso a ninguna cuadrilla.

SEGURIDAD
    · Por defecto es **simulación**.
    · Para escribir hay que pasar `--aplicar` y confirmar (o `--si`).
    · Todo corre en UNA transacción.
    · Registra cada ejecución en RepoTecnico/BaseOperaciones/migracion_d157.log

USO
    export DB_HOST=... DB_NAME=ggtov2 DB_USER=ggtov2_app DB_PASSWORD='...'
    python3 scripts/migrar_d157_devueltas.py                 # simulación
    python3 scripts/migrar_d157_devueltas.py --aplicar       # aplica con confirmación
    python3 scripts/migrar_d157_devueltas.py --aplicar --si  # aplica sin preguntar
    python3 scripts/migrar_d157_devueltas.py --dsn "postgresql://user:pwd@host/db"
=============================================================================
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d157.log"

CATALOGO = "('ASIGNADO','GESTIONADO','CERRADO','CITADO','DIFERIDO','DEVUELTO')"

SQL_CAMBIOS = f"""
DO $$
DECLARE
    restriccion record;
BEGIN
    -- Elimina cualquier CHECK previo del estado de `despacho_caso` sea cual
    -- sea su nombre (el generado por la tabla original no estaba nombrado).
    FOR restriccion IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'despacho_caso'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%estado%'
          AND pg_get_constraintdef(oid) ILIKE '%gestionado%'
    LOOP
        EXECUTE format('ALTER TABLE despacho_caso DROP CONSTRAINT %I', restriccion.conname);
    END LOOP;
    ALTER TABLE despacho_caso
        ADD CONSTRAINT despacho_caso_estado_check
        CHECK (estado IN {CATALOGO});
END $$;
"""

VERIFICACION = """
SELECT
    (SELECT count(*) FROM pg_constraint
      WHERE conrelid = 'despacho_caso'::regclass
        AND conname = 'despacho_caso_estado_check'
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%DEVUELTO%') AS catalogo_devuelto
"""


def registrar(mensaje: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"[{datetime.now(UTC).isoformat(timespec='seconds')}] {mensaje}\n")
    try:
        print(mensaje)
    except UnicodeEncodeError:
        print(mensaje.encode("ascii", "replace").decode("ascii"))


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
    p = argparse.ArgumentParser(
        description="Migración D-157: despacho_caso admite estado DEVUELTO."
    )
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
        registrar("MIGRACIÓN D-157 (despacho_caso: estado DEVUELTO)")
        registrar(f"modo={'APLICAR' if args.aplicar else 'SIMULACIÓN'}")
        registrar(f"estado actual: {antes}")

        pendientes = [c for c, v in antes.items() if v == 0]
        if not pendientes:
            registrar("✓ La base YA está migrada: no hay cambios pendientes.")
            conn.rollback()
            return 0

        registrar("Cambios pendientes:")
        for elemento in pendientes:
            registrar(f"  · {elemento}")

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

        cur.execute(SQL_CAMBIOS)
        conn.commit()

        despues = estado_actual(cur)
        registrar(f"verificación post-migración: {despues}")
        ok = all(v == 1 for v in despues.values())
        registrar(
            "✓ MIGRACIÓN COMPLETA Y VERIFICADA"
            if ok
            else "⚠ VERIFICACIÓN FALLÓ: revisar manualmente"
        )
        return 0 if ok else 3
    except Exception as exc:
        conn.rollback()
        registrar(f"ERROR (transacción revertida): {exc}")
        return 4
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
