#!/usr/bin/env python3
"""Recalcula la marca de **cuadrilla 0** (`caso.en_gestion_supervisor`) de los casos existentes.

=============================================================================
QUÉ HACE
    Vuelve a evaluar el criterio de cuadrilla 0 (RF-25 / D-22) sobre los casos ya
    guardados, usando la configuración vigente en la tabla `configuracion`
    (`despacho.criterio_cuadrilla0`, `despacho.frases_campo`,
    `despacho.frases_supervisor` y `despacho.columnas_evaluar`).

    Sirve para aplicar un cambio de criterio a los casos que ya estaban
    cargados, sin depender de volver a ingerir el CSV.

SEGURIDAD
    · Por defecto es **simulación** (`--dry-run`): solo informa qué cambiaría.
    · Para escribir hay que pasar `--aplicar` y confirmar (o `--si`).
    · Registra cada ejecución en RepoTecnico/BaseOperaciones/recalculo_cuadrilla0.log
    · NUNCA se ejecuta sola.

USO
    export DB_HOST=... DB_NAME=ggtov2 DB_USER=ggtov2_app DB_PASSWORD='...'
    python3 scripts/recalcular_cuadrilla0.py                      # simulación
    python3 scripts/recalcular_cuadrilla0.py --aplicar            # pide confirmación
    python3 scripts/recalcular_cuadrilla0.py --aplicar --si       # sin confirmación
    python3 scripts/recalcular_cuadrilla0.py --id-central 1       # limitar a una central
=============================================================================
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from app.services.cuadrilla0 import COLUMNAS_POR_DEFECTO, evaluar  # noqa: E402

LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "recalculo_cuadrilla0.log"


def registrar(mensaje: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"[{datetime.now(UTC).isoformat(timespec='seconds')}] {mensaje}\n")
    print(mensaje)


def main() -> int:
    p = argparse.ArgumentParser(description="Recalcula la marca de cuadrilla 0 de los casos.")
    p.add_argument("--aplicar", action="store_true", help="Escribe los cambios (por defecto simula)")
    p.add_argument("--si", action="store_true", help="Omite la confirmación interactiva")
    p.add_argument("--id-central", type=int, default=None, help="Limitar a una central")
    p.add_argument("--dsn", default=None, help="Cadena de conexión (alternativa a DB_*)")
    args = p.parse_args()

    import psycopg2

    if args.dsn:
        conexion = psycopg2.connect(args.dsn)
    else:
        faltan = [v for v in ("DB_NAME", "DB_USER", "DB_PASSWORD") if not os.environ.get(v)]
        if faltan:
            registrar(f"ERROR: faltan variables de entorno: {', '.join(faltan)}")
            return 2
        conexion = psycopg2.connect(
            host=os.environ.get("DB_HOST", "localhost"),
            port=int(os.environ.get("DB_PORT", "5432")),
            dbname=os.environ["DB_NAME"],
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASSWORD"],
            sslmode=os.environ.get("DB_SSLMODE", "prefer"),
            connect_timeout=20,
        )

    registrar("=" * 78)
    registrar(f"RECÁLCULO DE CUADRILLA 0 · aplicar={args.aplicar} · central={args.id_central or 'todas'}")

    try:
        with conexion.cursor() as cur:
            cur.execute("SELECT clave, valor FROM configuracion")
            config = {clave: valor for clave, valor in cur.fetchall()}

            modo = str(config.get("despacho.criterio_cuadrilla0") or "UNION").strip('"')
            columnas = config.get("despacho.columnas_evaluar") or list(COLUMNAS_POR_DEFECTO)
            registrar(f"Criterio vigente: {modo} · columnas: {', '.join(columnas)}")
            registrar(f"Frases campo: {config.get('despacho.frases_campo')}")
            registrar(f"Frases supervisor: {config.get('despacho.frases_supervisor')}")

            sql = "SELECT id_caso, id_averia, en_gestion_supervisor"
            sql += "".join(f", {c}" for c in columnas)
            sql += " FROM caso"
            if args.id_central:
                sql += " WHERE id_central = %s"
                cur.execute(sql, (args.id_central,))
            else:
                cur.execute(sql)
            filas = cur.fetchall()

            cambios: list[tuple[int, str, bool, bool]] = []
            for fila in filas:
                id_caso, id_averia, actual = fila[0], fila[1], fila[2]
                datos = dict(zip(columnas, fila[3:], strict=False))
                nuevo = evaluar(datos, config)
                if nuevo != actual:
                    cambios.append((id_caso, id_averia, actual, nuevo))

            registrar(f"Casos evaluados: {len(filas)} · cambios: {len(cambios)}")
            for id_caso, id_averia, actual, nuevo in cambios[:20]:
                registrar(f"  caso {id_caso} ({id_averia}): {actual} -> {nuevo}")
            if len(cambios) > 20:
                registrar(f"  … y {len(cambios) - 20} más")

            if not args.aplicar:
                registrar("SIMULACIÓN: no se escribió nada (use --aplicar para guardar).")
                return 0

            if not args.si:
                respuesta = input(f"¿Aplicar {len(cambios)} cambios? (s/n): ").strip().lower()
                if respuesta != "s":
                    registrar("Cancelado por el usuario.")
                    return 0

            for id_caso, _id_averia, _actual, nuevo in cambios:
                cur.execute("UPDATE caso SET en_gestion_supervisor = %s WHERE id_caso = %s",
                            (nuevo, id_caso))
            conexion.commit()
            registrar(f"COMMIT: {len(cambios)} casos actualizados.")

            cur.execute(
                "SELECT en_gestion_supervisor, count(*) FROM caso GROUP BY 1 ORDER BY 1"
            )
            registrar(f"Distribución final (cuadrilla 0): {dict(cur.fetchall())}")
    finally:
        conexion.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
