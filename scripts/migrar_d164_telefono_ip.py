"""Migración D-164: columna `telefono_ip` en `caso`.

El archivo diario `detalle_averias_gpon_*` del 02/11/2026 trae una columna
nueva (`telefono_ip`, el teléfono IP/fijo del cliente) en la posición 15;
el parser pasa a aceptar la estructura de 81 columnas y este script agrega
la columna donde se persiste. Idempotente: si la columna ya existe, no hace
nada (safe para re-ejecutar).

USO
    python scripts/migrar_d164_telefono_ip.py                 # simula
    python scripts/migrar_d164_telefono_ip.py --aplicar --si  # aplica

Conexión: variables `DB_*` (igual que la app) o `--dsn`.
Log: `RepoTecnico/BaseOperaciones/migracion_d164.log`.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d164.log"

CAMBIO = (
    "ALTER TABLE caso ADD COLUMN IF NOT EXISTS telefono_ip varchar(30);"
)

VERIFICACION = """
SELECT
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'caso'
        AND column_name = 'telefono_ip'
        AND udt_name = 'varchar' AND character_maximum_length = 30) AS columna_ok,
    (SELECT count(*) FROM caso) AS casos_totales
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


def estado_actual(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute(VERIFICACION)
        cols = [d[0] for d in cur.description]
        return dict(zip(cols, cur.fetchone(), strict=True))


def main() -> int:
    p = argparse.ArgumentParser(
        description="Migración D-164: agrega caso.telefono_ip (varchar 30)."
    )
    p.add_argument("--aplicar", action="store_true", help="Escribe los cambios (por defecto simula)")
    p.add_argument("--si", action="store_true", help="Omite la confirmación interactiva")
    p.add_argument("--dsn", default=None, help="Cadena de conexión (alternativa a DB_*)")
    args = p.parse_args()

    if args.aplicar and not args.si:
        registrar("Leyendo el archivo diario: idempotente; pidó confirmación (--si).")

    conn = conectar(args)
    try:
        conn.autocommit = False
        estado = estado_actual(conn)
        registrar("=" * 78)
        registrar("MIGRACIÓN D-164 (columna caso.telefono_ip)")
        registrar("modo=APLICAR" if args.aplicar else "modo=SIMULACIÓN")
        registrar(f"estado actual: {estado}")

        if estado["columna_ok"]:
            registrar("✓ La base YA está migrada: no hay cambios pendientes.")
            return 0
        registrar(f"cambio pendiente: {CAMBIO}")
        if not args.aplicar:
            registrar("(simulación) Ejecuta con --aplicar --si para escribir.")
            return 0

        with conn.cursor() as cur:
            cur.execute(CAMBIO)
        conn.commit()

        post = estado_actual(conn)
        if post["columna_ok"]:
            registrar(f"verificación post-migración: {post}")
            registrar("✓ MIGRACIÓN COMPLETA Y VERIFICADA")
            return 0
        registrar(f"ERROR: la columna no quedó bien después del cambio: {post}")
        return 4
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
