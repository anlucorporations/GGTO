"""Migración AV-C5: tabla `asistente_remitente` (Telegram del asistente virtual).

Remitentes autorizados del asistente de gestión por texto libre: el SUPER liga
cada `chat_id` de Telegram a un operador de una central. Idempotente: si la
tabla ya existe, no hace nada (safe para re-ejecutar).

USO
    python scripts/migrar_av_asistente_remitentes.py                 # simula
    python scripts/migrar_av_asistente_remitentes.py --aplicar --si  # aplica

Conexión: variables `DB_*` (igual que la app) o `--dsn`.
Log: `RepoTecnico/BaseOperaciones/migracion_av_c5.log`.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_av_c5.log"

CAMBIO = """
CREATE TABLE IF NOT EXISTS asistente_remitente (
    id_remitente   bigserial PRIMARY KEY,
    id_central     integer NOT NULL REFERENCES central(id_central),
    canal          varchar(20) NOT NULL DEFAULT 'TELEGRAM',
    chat_id        varchar(64) NOT NULL UNIQUE,
    p00            varchar(20) NOT NULL,
    nombre         varchar(120),
    activo         boolean NOT NULL DEFAULT true,
    creado_en      timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now()
);
"""

VERIFICACION = """
SELECT
    (SELECT count(*) FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'asistente_remitente') AS tabla_ok,
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'asistente_remitente') AS columnas
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

    registrar("=== migración AV-C5: tabla asistente_remitente ===")
    conn = conectar(args)
    estado = estado_actual(conn)
    if estado["tabla_ok"] and estado["columnas"] >= 9:
        registrar(f"Ya existe ({int(estado['columnas'])} columnas): nada por hacer.")
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
