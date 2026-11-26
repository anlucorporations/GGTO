#!/usr/bin/env python3
"""Migración idempotente F3-TG-1 — asistente con IA en grupo de Telegram.

=============================================================================
QUÉ HACE (solo esquema + semilla del grupo; no toca casos)
    1. `asistente_grupo`: grupo GGTOv3-PDE (-5561202916), central 1,
       politica_pii=REFERENCIAS, eventos_config jsonb.
    2. `asistente_grupo_miembro`: única fuente de autorización por from.id,
       con p00 nominado (nunca GGTOAST001).
    3. `asistente_pending_confirm`: pendientes persistidas con estado, TTL,
       confirmador e índice único parcial WHERE estado='PENDIENTE'.
    4. `asistente_sesion`: columnas id_grupo, mensaje_id y telegram_user_id.
    5. Catálogo `asistente_evento_tipo` con los 5 tipos habilitables.

SEGURIDAD
    · Por defecto SIMULA; escribe solo con --aplicar (y confirmación o --si).
    · Una sola transacción; si algo falla, no queda a medias.
    · Log en RepoTecnico/BaseOperaciones/migracion_tg_grupo.log.
    · NUNCA incluye secretos: DSN por entorno o argumento.

USO
    export GGTO_DB_DSN="postgresql://user:pwd@host:5432/ggtov2"
    python3 scripts/migrar_tg_grupo.py                    # simulación
    python3 scripts/migrar_tg_grupo.py --aplicar          # confirma interactivo
    python3 scripts/migrar_tg_grupo.py --aplicar --si     # sin preguntar
=============================================================================
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_tg_grupo.log"

DDL = """
CREATE TABLE IF NOT EXISTS asistente_grupo (
    id_grupo      bigserial PRIMARY KEY,
    chat_id       bigint NOT NULL UNIQUE,
    titulo        varchar(160) NOT NULL,
    topic_id      bigint,
    activo        boolean NOT NULL DEFAULT true,
    id_central    integer REFERENCES central(id_central),
    politica_pii  varchar(20) NOT NULL DEFAULT 'REFERENCIAS'
                  CHECK (politica_pii IN ('NONE','REFERENCIAS')),
    eventos_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asistente_grupo_miembro (
    id_miembro        bigserial PRIMARY KEY,
    id_grupo          integer NOT NULL REFERENCES asistente_grupo(id_grupo),
    telegram_user_id  bigint NOT NULL,
    p00               varchar(20) NOT NULL CHECK (p00 <> 'GGTOAST001'),
    rol               varchar(20) NOT NULL,
    puede_actualizar  boolean NOT NULL DEFAULT false,
    activo            boolean NOT NULL DEFAULT true,
    creado_en         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id_grupo, telegram_user_id)
);

CREATE TABLE IF NOT EXISTS asistente_pending_confirm (
    id_pending         bigserial PRIMARY KEY,
    id_grupo           integer NOT NULL REFERENCES asistente_grupo(id_grupo),
    telegram_user_id   bigint NOT NULL,
    intencion          varchar(20) NOT NULL,
    ficha_json         jsonb NOT NULL DEFAULT '{}'::jsonb,
    estado             varchar(20) NOT NULL DEFAULT 'PENDIENTE'
                       CHECK (estado IN ('PENDIENTE','CONSUMIDA','DESCARTADA','EXPIRADA')),
    expira_en          timestamptz NOT NULL,
    solicitado_por     bigint,
    confirmado_por     bigint,
    id_mensaje_preview bigint,
    creado_en          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tg_pending_activa
    ON asistente_pending_confirm (id_grupo, telegram_user_id)
    WHERE estado = 'PENDIENTE';

ALTER TABLE asistente_sesion ADD COLUMN IF NOT EXISTS id_grupo integer
    REFERENCES asistente_grupo(id_grupo);
ALTER TABLE asistente_sesion ADD COLUMN IF NOT EXISTS mensaje_id bigint;
ALTER TABLE asistente_sesion ADD COLUMN IF NOT EXISTS telegram_user_id bigint;

CREATE TABLE IF NOT EXISTS asistente_evento_tipo (
    codigo     varchar(40) PRIMARY KEY,
    descripcion varchar(160)
);
INSERT INTO asistente_evento_tipo (codigo, descripcion) VALUES
    ('CIERRE','Caso cerrado'),
    ('CITA','Cita agendada'),
    ('ENRUTADO','Caso enrutado'),
    ('DIFERIDO','Caso diferido'),
    ('FALLA','Falla masiva')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO asistente_grupo (chat_id, titulo, id_central, politica_pii, eventos_config)
VALUES (-5561202916, 'GGTOv3-PDE', 1, 'REFERENCIAS',
        '{"CIERRE":true,"CITA":true,"ENRUTADO":true,"DIFERIDO":true,"FALLA":false}'::jsonb)
ON CONFLICT (chat_id) DO NOTHING;
"""

VERIFICACION = """
SELECT
 (SELECT count(*) FROM information_schema.tables WHERE table_name='asistente_grupo') AS grupo,
 (SELECT count(*) FROM information_schema.tables WHERE table_name='asistente_grupo_miembro') AS miembro,
 (SELECT count(*) FROM information_schema.tables WHERE table_name='asistente_pending_confirm') AS pendiente,
 (SELECT count(*) FROM pg_indexes WHERE indexname='uq_tg_pending_activa') AS indice_parcial,
 (SELECT count(*) FROM information_schema.columns
   WHERE table_name='asistente_sesion' AND column_name='telegram_user_id') AS from_id,
 (SELECT CASE WHEN to_regclass('public.asistente_evento_tipo') IS NOT NULL
              THEN (SELECT count(*) FROM asistente_evento_tipo) ELSE 0 END) AS eventos,
 (SELECT CASE WHEN to_regclass('public.asistente_grupo') IS NOT NULL
              THEN (SELECT count(*) FROM asistente_grupo WHERE chat_id=-5561202916) ELSE 0 END) AS grupo_semilla
"""


def registrar(mensaje: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"[{datetime.now(UTC).isoformat()}] {mensaje}\n")


def main() -> int:
    p = argparse.ArgumentParser(description="Migración F3-TG-1 (grupo Telegram).")
    p.add_argument("--aplicar", action="store_true", help="Escribe; por defecto simula.")
    p.add_argument("--si", action="store_true", help="Omite confirmación interactiva.")
    p.add_argument("--dsn", default=os.environ.get("GGTO_DB_DSN", ""), help="DSN PostgreSQL.")
    args = p.parse_args()

    if not args.dsn:
        print("ERROR: defina GGTO_DB_DSN o pase --dsn.")
        return 2

    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 no instalado.")
        return 2

    modo = "APLICAR" if args.aplicar else "SIMULACIÓN"
    print(f"Modo: {modo}")
    if args.aplicar and not args.si:
        if input("¿Aplicar la migración F3-TG-1? escribe SI: ").strip() != "SI":
            print("Cancelado.")
            return 0

    conn = None
    try:
        conn = psycopg2.connect(args.dsn)
        conn.autocommit = False
        with conn.cursor() as cur:
            if args.aplicar:
                cur.execute(DDL)
            cur.execute(VERIFICACION)
            cols = [d[0] for d in cur.description]
            vals = cur.fetchone()
            resultado = dict(zip(cols, vals))
        if args.aplicar:
            conn.commit()
        else:
            conn.rollback()
        print("Verificación:", resultado)
        registrar(f"{modo} | {resultado}")
        return 0
    except Exception as exc:
        if conn:
            conn.rollback()
        registrar(f"{modo} | ERROR {exc}")
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    sys.exit(main())
