#!/usr/bin/env python3
"""Aplica la **migración D-82** (reporte de falla masiva desde la APK).

=============================================================================
QUÉ HACE (idempotente; solo esquema, no toca datos)
    1. Amplía `falla_masiva` con las columnas del reporte de campo:
       `odn`, `direccion`, `fat` y `evidencias` (seriales de hasta 2 fotos).
    2. Recrea el CHECK `evidencia_tipo_check` para admitir `FALLA_MASIVA`
       (la APK sube así las fotos del reporte de campo; sin esto, la subida
       fallaba con un 500).
    3. Verifica el resultado contra el catálogo de PostgreSQL.

POR QUÉ
    La APK reporta la falla masiva indicando **ODN · dirección · FAT ·
    descripción** y hasta **2 fotos** de evidencia (RF-16 / D-82). El endpoint
    `POST /api/v1/fallas-masivas/reporte-campo` persiste esos datos y las fotos
    se suben antes con `POST /evidencias/upload`.

SEGURIDAD
    · Por defecto es **simulación** (`--dry-run` implícito).
    · Para escribir hay que pasar `--aplicar` y confirmar (o `--si`).
    · Todo corre en UNA transacción: si algo falla, no queda a medias.
    · Registra cada ejecución en RepoTecnico/BaseOperaciones/migracion_d82.log
    · NUNCA se ejecuta sola.

USO
    export DB_HOST=... DB_NAME=ggtov2 DB_USER=ggtov2_app DB_PASSWORD='...'
    python3 scripts/migrar_d82_falla_campo.py                 # simulación
    python3 scripts/migrar_d82_falla_campo.py --aplicar       # aplica con confirmación
    python3 scripts/migrar_d82_falla_campo.py --aplicar --si  # aplica sin preguntar
    python3 scripts/migrar_d82_falla_campo.py --dsn "postgresql://user:pwd@host/db"
=============================================================================
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d82.log"

SQL_COLUMNAS = """
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS odn        varchar(60);
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS direccion  varchar(200);
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS fat        varchar(60);
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS evidencias text;
"""

# La APK sube las fotos del reporte de campo con `tipo = 'FALLA_MASIVA'`; el
# CHECK original solo admitía POTENCIA/NAVEGACION/DEMO y la subida fallaba con
# un 500 (`evidencia_tipo_check`). Se recrea el CHECK con los cuatro valores.
SQL_EVIDENCIA_TIPO = """
ALTER TABLE evidencia DROP CONSTRAINT IF EXISTS evidencia_tipo_check;
ALTER TABLE evidencia ADD CONSTRAINT evidencia_tipo_check
    CHECK (tipo IN ('POTENCIA','NAVEGACION','DEMO','FALLA_MASIVA'));
"""

VERIFICACION = """
SELECT
    (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'falla_masiva' AND column_name = 'odn')         AS odn,
    (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'falla_masiva' AND column_name = 'direccion')   AS direccion,
    (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'falla_masiva' AND column_name = 'fat')         AS fat,
    (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'falla_masiva' AND column_name = 'evidencias')  AS evidencias,
    (SELECT count(*) FROM pg_constraint
      WHERE conname = 'evidencia_tipo_check'
        AND pg_get_constraintdef(oid) LIKE '%FALLA_MASIVA%')             AS evidencia_falla_masiva
"""


def registrar(mensaje: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"[{datetime.now(UTC).isoformat(timespec='seconds')}] {mensaje}\n")
    try:
        print(mensaje)
    except UnicodeEncodeError:
        # Consola Windows en cp1252: los símbolos (✓, ⚠, ·) no se pueden
        # representar; la migración NO debe fallar por la consola.
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
        description="Migración D-82: columnas del reporte de campo en falla_masiva "
                    "y CHECK de evidencia.tipo con FALLA_MASIVA."
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
        registrar("MIGRACIÓN D-82 (falla_masiva: odn, direccion, fat, evidencias + CHECK de evidencia.tipo)")
        registrar(f"modo={'APLICAR' if args.aplicar else 'SIMULACIÓN'}")
        registrar(f"estado actual: {antes}")

        pendientes = [c for c, v in antes.items() if v == 0]
        if not pendientes:
            registrar("✓ La base YA está migrada: no hay cambios pendientes.")
            conn.rollback()
            return 0

        registrar("Cambios pendientes:")
        for columna in pendientes:
            if columna == "evidencia_falla_masiva":
                registrar("  · ALTER TABLE evidencia: CHECK evidencia_tipo_check con 'FALLA_MASIVA'")
            else:
                registrar(f"  · ALTER TABLE falla_masiva ADD COLUMN {columna}")

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

        if any(c != "evidencia_falla_masiva" for c in pendientes):
            cur.execute(SQL_COLUMNAS)
        if "evidencia_falla_masiva" in pendientes:
            cur.execute(SQL_EVIDENCIA_TIPO)
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
