#!/usr/bin/env python3
"""Añade el método **CONTACTO/COS** al catálogo de métodos (migración D-88).

=============================================================================
QUÉ HACE
    `POST /api/v1/casos/{id}/no-contesta` deja constancia de que el cliente quedó
    **informado al COS**: registra una actividad de `CONTACTO` con el método
    `COS`. Ese código existe hoy **solo** en el dominio `CIERRE` (IVR/COS/SACAS),
    así que esta migración añade la fila del dominio `CONTACTO`.

SEGURIDAD
    · Por defecto es **simulación**: muestra lo que haría y verifica, sin escribir.
    · Para aplicar: `--aplicar` (y `--si` para no pedir confirmación).
    · La escritura es **aditiva e idempotente** (`ON CONFLICT DO NOTHING`).

USO
    python3 scripts/migrar_d88_contacto_cos.py                  # simulación
    python3 scripts/migrar_d88_contacto_cos.py --aplicar --si    # aplica
    python3 scripts/migrar_d88_contacto_cos.py --dsn "postgresql://usuario:clave@host/base"

REGISTRO
    Cada ejecución queda anotada en RepoTecnico/BaseOperaciones/migracion_d88.log
=============================================================================
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d88.log"

SQL_INSERT = """
INSERT INTO catalogo_metodo (dominio, codigo, nombre)
VALUES ('CONTACTO', 'COS', 'Cliente informado al COS')
ON CONFLICT (dominio, codigo) DO NOTHING;
"""

VERIFICACION = """
SELECT id_metodo, dominio, codigo, nombre
FROM catalogo_metodo
WHERE dominio = 'CONTACTO' AND codigo = 'COS'
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


def estado(cur) -> list[tuple]:
    cur.execute(VERIFICACION)
    return cur.fetchall()


def main() -> int:
    p = argparse.ArgumentParser(description="Migración D-88: método CONTACTO/COS.")
    p.add_argument("--aplicar", action="store_true", help="Escribe de verdad")
    p.add_argument("--si", action="store_true", help="No pide confirmación")
    p.add_argument("--dsn", default=None, help="Cadena de conexión (alternativa a DB_*)")
    args = p.parse_args()

    registrar("=" * 74)
    registrar(f"MIGRACIÓN D-88 (método CONTACTO/COS) — {'APLICAR' if args.aplicar else 'SIMULACIÓN'}")

    conn = conectar(args)
    try:
        conn.autocommit = False
        cur = conn.cursor()

        antes = estado(cur)
        registrar(f"Antes: {antes or 'sin fila CONTACTO/COS'}")

        if not args.aplicar:
            registrar("Simulación: se añadiría el método CONTACTO/COS al catálogo.")
            registrar("Vuelve a ejecutar con --aplicar para escribir.")
            return 0

        if antes:
            registrar("Ya existe: no hay nada que hacer (idempotente).")
            return 0

        if not args.si:
            respuesta = input("¿Aplicar la migración D-88 en esta base? [s/N] ").strip().lower()
            if respuesta not in {"s", "si", "sí", "y"}:
                registrar("Cancelado por el usuario.")
                return 0

        cur.execute(SQL_INSERT)
        conn.commit()

        despues = estado(cur)
        if not despues:
            registrar("ERROR: la verificación no encontró la fila recién creada")
            return 1
        registrar(f"Después: {despues}")
        registrar("MIGRACIÓN D-88: OK")
        return 0
    except Exception as exc:  # se reporta y se revierte la transacción
        conn.rollback()
        registrar(f"ERROR: {exc}")
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
