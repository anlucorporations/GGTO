#!/usr/bin/env python3
"""Migración D-156: el outbox admite el canal **MANUAL**.

=============================================================================
QUÉ HACE (idempotente; solo esquema, no toca datos)
    1. Reemplaza el CHECK de `notificacion.canal` para admitir `MANUAL`.
    2. Verifica el CHECK contra el catálogo de PostgreSQL.
    3. En modo `--aplicar`, prueba una inserción `MANUAL` y la revierte.

POR QUÉ
    El aviso de cierre al solicitante externo (ACT-03) usa el outbox. Si el
    contacto no tiene canal automático, el aviso queda **PENDIENTE** con canal
    `MANUAL` para que el supervisor lo entregue. El esquema original solo
    permitía `TELEGRAM`, `CORREO` y `MCP_IA`, así que el INSERT fallaba y el
    cierre del caso especial devolvía error.

SEGURIDAD
    · Por defecto es **simulación**.
    · Para escribir hay que pasar `--aplicar` y confirmar (o `--si`).
    · Todo corre en UNA transacción.
    · Registra cada ejecución en RepoTecnico/BaseOperaciones/migracion_d156.log

USO
    export DB_HOST=... DB_NAME=ggtov2 DB_USER=ggtov2_app DB_PASSWORD='...'
    python scripts/migrar_d156_notificacion_manual.py                 # simulación
    python scripts/migrar_d156_notificacion_manual.py --aplicar
    python scripts/migrar_d156_notificacion_manual.py --aplicar --si
    python scripts/migrar_d156_notificacion_manual.py --dsn "postgresql://…"
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d156.log"

SQL_CAMBIOS = """
DO $$
DECLARE
    c record;
    ya_admite_manual boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'notificacion'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%canal%'
          AND pg_get_constraintdef(oid) LIKE '%MANUAL%'
    ) INTO ya_admite_manual;

    IF ya_admite_manual THEN
        RETURN;
    END IF;

    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'notificacion'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%canal%'
    LOOP
        EXECUTE format('ALTER TABLE notificacion DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE notificacion ADD CONSTRAINT ck_notificacion_canal
        CHECK (canal IN ('TELEGRAM', 'CORREO', 'MCP_IA', 'MANUAL'));
END;
$$;
"""

VERIFICACION = """
SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'notificacion'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%canal%'
      AND pg_get_constraintdef(oid) LIKE '%MANUAL%'
) AS canal_manual;
"""


def registrar(mensaje: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"[{datetime.now(UTC).isoformat(timespec='seconds')}] {mensaje}\n")
    try:
        print(mensaje)
    except UnicodeEncodeError:  # consolas cp1252
        print(mensaje.encode("ascii", "replace").decode("ascii"))


def conectar(args: argparse.Namespace):
    import psycopg2

    if args.dsn:
        return psycopg2.connect(args.dsn, connect_timeout=20)
    faltan = [v for v in ("DB_NAME", "DB_USER", "DB_PASSWORD") if not os.environ.get(v)]
    if faltan:
        registrar(f"ERROR: faltan variables de entorno: {', '.join(faltan)} (o usa --dsn)")
        raise SystemExit(2)
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", "5432")),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        sslmode=os.environ.get("DB_SSLMODE", "prefer"),
        connect_timeout=20,
    )


def admite_manual(cur) -> bool:
    cur.execute(VERIFICACION)
    return bool(cur.fetchone()[0])


def main() -> int:
    parser = argparse.ArgumentParser(description="Migración D-156: notificacion.canal admite MANUAL")
    parser.add_argument("--aplicar", action="store_true", help="Escribe los cambios (por defecto simula)")
    parser.add_argument("--si", action="store_true", help="Omite la confirmación interactiva")
    parser.add_argument("--dsn", default=None, help="DSN PostgreSQL; también acepta variables DB_*")
    args = parser.parse_args()

    conn = conectar(args)
    try:
        conn.autocommit = False
        cur = conn.cursor()

        antes = admite_manual(cur)
        registrar("=" * 78)
        registrar("MIGRACIÓN D-156 (notificacion.canal: MANUAL)")
        registrar(f"modo={'APLICAR' if args.aplicar else 'SIMULACIÓN'}")
        registrar(f"¿ya admite MANUAL?: {'sí' if antes else 'no'}")

        if antes:
            registrar("✔ La base YA está migrada: no hay cambios pendientes.")
            conn.rollback()
            return 0

        registrar("Cambio pendiente: reemplazar el CHECK de notificacion.canal.")
        if not args.aplicar:
            registrar("(simulación) Ejecuta con --aplicar para escribir.")
            conn.rollback()
            return 0

        if not args.si:
            respuesta = input("¿Aplicar D-156 sobre esta base? [sí/no] ").strip().lower()
            if respuesta not in {"sí", "si", "yes", "y"}:
                registrar("Cancelado por el usuario.")
                conn.rollback()
                return 1

        cur.execute(SQL_CAMBIOS)
        if not admite_manual(cur):
            raise RuntimeError("el CHECK de notificacion.canal no admite MANUAL tras el cambio")

        # Prueba real del contrato: insertar un aviso manual y deshacerlo.
        cur.execute("SAVEPOINT d156_prueba_manual")
        cur.execute(
            "INSERT INTO notificacion (canal, asunto, cuerpo, estado) "
            "VALUES ('MANUAL', 'D-156 verificación', 'ok', 'PENDIENTE')"
        )
        cur.execute("ROLLBACK TO SAVEPOINT d156_prueba_manual")

        conn.commit()
        registrar("✔ MIGRACIÓN COMPLETA Y VERIFICADA: INSERT MANUAL aceptado y revertido.")
        return 0
    except Exception as exc:
        conn.rollback()
        registrar(f"✘ ERROR (transacción revertida): {exc}")
        return 4
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
