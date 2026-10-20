#!/usr/bin/env python3
"""Aplica la **migración D-133** (el especial guarda su informe de atencion).

=============================================================================
QUÉ HACE (idempotente; solo esquema, no toca datos)
    1. Añade `evidencia.id_caso` (FK a `caso`, ON DELETE CASCADE).
    2. Crea el índice `ix_evidencia_caso`.
    3. Verifica el resultado contra el catálogo de PostgreSQL.

POR QUÉ
    `/evidencias/upload` no guardaba a qué caso pertenecía la foto ni validaba
    quién la subía (H-11 de la auditoría V3): quedaban evidencias huérfanas hasta
    que llegaba la actividad de la CARGA, se podía subir contra un caso ajeno y la
    purga local podía borrar la referencia. Con `id_caso` la foto nace ligada a su
    caso y el servidor puede validar la pertenencia.

SEGURIDAD
    · Por defecto es **simulación**.
    · Para escribir hay que pasar `--aplicar` y confirmar (o `--si`).
    · Todo corre en UNA transacción.
    · Registra cada ejecución en RepoTecnico/BaseOperaciones/migracion_d133.log

USO
    export DB_HOST=... DB_NAME=ggtov2 DB_USER=ggtov2_app DB_PASSWORD='...'
    python3 scripts/migrar_d133_informe_especial.py                 # simulación
    python3 scripts/migrar_d133_informe_especial.py --aplicar       # aplica con confirmación
    python3 scripts/migrar_d133_informe_especial.py --aplicar --si  # aplica sin preguntar
    python3 scripts/migrar_d133_informe_especial.py --dsn "postgresql://user:pwd@host/db"
=============================================================================
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d133.log"

SQL_CAMBIOS = """
ALTER TABLE caso_especial ADD COLUMN IF NOT EXISTS informe text;
"""

VERIFICACION = """
SELECT
    (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'caso_especial' AND column_name = 'informe') AS informe
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
        description="Migración D-133: evidencia.id_caso."
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
        registrar("MIGRACIÓN D-133 (caso_especial: informe)")
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
