"""Migración AV-C4: tabla `asistente_sesion` (historial del asistente virtual).

Crea la tabla que registra cada turno del asistente de gestión por texto
libre (`asistente-ggto`, propuesta v2.1). Idempotente: si la tabla y sus
índices ya existen, no hace nada (safe para re-ejecutar).

USO
    python scripts/migrar_av_asistente_sesion.py                 # simula
    python scripts/migrar_av_asistente_sesion.py --aplicar --si  # aplica

Conexión: variables `DB_*` (igual que la app) o `--dsn`.
Log: `RepoTecnico/BaseOperaciones/migracion_av_c4.log`.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_av_c4.log"

CAMBIO = """
CREATE TABLE IF NOT EXISTS asistente_sesion (
    id_turno      bigserial PRIMARY KEY,
    sesion_id     varchar(64) NOT NULL,
    canal         varchar(20) NOT NULL DEFAULT 'PANEL',
    id_central    integer REFERENCES central(id_central),
    p00           varchar(20),
    texto_entrada text NOT NULL,
    intencion     varchar(30),
    detalle       varchar(60),
    ficha_json    text,
    respuesta     text,
    creado_en     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_asistente_sesion_sesion ON asistente_sesion(sesion_id);
CREATE INDEX IF NOT EXISTS ix_asistente_sesion_fecha ON asistente_sesion(creado_en);
"""

VERIFICACION = """
SELECT
    (SELECT count(*) FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'asistente_sesion') AS tabla_ok,
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'asistente_sesion') AS columnas,
    (SELECT count(*) FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'asistente_sesion') AS indices
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
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--aplicar", action="store_true", help="Aplica el cambio (requiere --si)")
    p.add_argument("--si", action="store_true", help="Confirmación explícita")
    p.add_argument("--dsn", help="DSN completo de conexión")
    args = p.parse_args()

    registrar("=== migración AV-C4: tabla asistente_sesion ===")
    conn = conectar(args)
    estado = estado_actual(conn)
    if estado["tabla_ok"] and estado["columnas"] >= 11:
        registrar(f"Ya existe ({int(estado['columnas'])} columnas, {int(estado['indices'])} índices): nada por hacer.")
        conn.close()
        return 0
    registrar(f"Estado actual: {estado}")
    registrar("CAMBIO a aplicar:\n" + CAMBIO)
    if not (args.aplicar and args.si):
        registrar("SIMULACIÓN — no se aplicó nada. Ejecuta con --aplicar --si para confirmar.")
        conn.close()
        return 0
    with conn.cursor() as cur:
        cur.execute(CAMBIO)
    conn.commit()
    despues = estado_actual(conn)
    registrar(f"Aplicado. Verificación: {despues}")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
