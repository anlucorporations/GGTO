#!/usr/bin/env python3
"""Migración D-95: rol COORDINADOR y destinatarios de mensajería por usuario.

Por defecto solo inspecciona el esquema y muestra los cambios pendientes. La
escritura requiere --aplicar y confirmación (o --si). Todas las operaciones de
DDL y la siembra del rol se ejecutan en una transacción.

Uso:
    python scripts/migrar_d95_coordinador_mensajeria.py
    python scripts/migrar_d95_coordinador_mensajeria.py --aplicar
    python scripts/migrar_d95_coordinador_mensajeria.py --aplicar --si
    python scripts/migrar_d95_coordinador_mensajeria.py --dsn "postgresql://…"
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d95.log"

SQL = """
INSERT INTO rol (codigo, nombre, descripcion)
VALUES ('COORDINADOR', 'Coordinador',
        'Monitoreo, casos especiales, fallas masivas y mensajería al Supervisor')
ON CONFLICT (codigo) DO NOTHING;

-- D-95: nombre y apellido del usuario (destinatarios de mensajería y perfil) y
-- trazas de la auditoría de gestión. Los modelos SQLAlchemy ya los usan: sin
-- estas columnas cualquier INSERT del ORM falla.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS nombre   varchar(80);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS apellido varchar(80);
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS id_central integer
    REFERENCES central(id_central);
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS resultado  varchar(20);
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS request_id varchar(40);

ALTER TABLE mensaje
    ADD COLUMN IF NOT EXISTS id_usuario_destino varchar(20)
    REFERENCES usuario(p00) ON DELETE SET NULL;

DO $$
DECLARE c record;
BEGIN
    -- El DDL histórico creó estos CHECK sin nombre estable. Descubrirlos por
    -- expresión evita depender del nombre autogenerado de PostgreSQL.
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'mensaje'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%destino_tipo%'
    LOOP
        EXECUTE format('ALTER TABLE mensaje DROP CONSTRAINT %I', c.conname);
    END LOOP;
    ALTER TABLE mensaje ADD CONSTRAINT ck_mensaje_destino_tipo
        CHECK (destino_tipo IN ('TODOS','CUADRILLA','TECNICO','SUPERVISOR'));
    ALTER TABLE mensaje ADD CONSTRAINT ck_mensaje_destino_xor
        CHECK (
          (destino_tipo = 'TODOS' AND id_cuadrilla IS NULL AND id_tecnico IS NULL
             AND id_usuario_destino IS NULL) OR
          (destino_tipo = 'CUADRILLA' AND id_cuadrilla IS NOT NULL AND id_tecnico IS NULL
             AND id_usuario_destino IS NULL) OR
          (destino_tipo = 'TECNICO' AND id_tecnico IS NOT NULL AND id_cuadrilla IS NULL
             AND id_usuario_destino IS NULL) OR
          (destino_tipo = 'SUPERVISOR' AND id_usuario_destino IS NOT NULL
             AND id_cuadrilla IS NULL AND id_tecnico IS NULL)
        );
END;
$$;

ALTER TABLE mensaje_destino ADD COLUMN IF NOT EXISTS id_destino bigserial;
ALTER TABLE mensaje_destino ADD COLUMN IF NOT EXISTS p00 varchar(20)
    REFERENCES usuario(p00) ON DELETE CASCADE;

-- La PK histórica es (id_mensaje, id_tecnico): hay que soltarla **antes** de
-- quitar el NOT NULL de `id_tecnico`, porque PostgreSQL no admite una columna de
-- la PK sin NOT NULL («column "id_tecnico" is in a primary key»). Orden
-- corregido al ejecutar la migración contra la base real.
DO $$
DECLARE c record;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'mensaje_destino'::regclass AND contype = 'p'
    LOOP
        EXECUTE format('ALTER TABLE mensaje_destino DROP CONSTRAINT %I', c.conname);
    END LOOP;
END;
$$;

ALTER TABLE mensaje_destino ALTER COLUMN id_tecnico DROP NOT NULL;

DO $$
DECLARE c record;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'mensaje_destino'::regclass AND contype = 'c'
    LOOP
        EXECUTE format('ALTER TABLE mensaje_destino DROP CONSTRAINT %I', c.conname);
    END LOOP;
    ALTER TABLE mensaje_destino ADD CONSTRAINT pk_mensaje_destino
        PRIMARY KEY (id_destino);
    ALTER TABLE mensaje_destino ADD CONSTRAINT ck_mensaje_destino_un_destinatario
        CHECK ((p00 IS NULL AND id_tecnico IS NOT NULL)
            OR (p00 IS NOT NULL AND id_tecnico IS NULL));
END;
$$;

CREATE INDEX IF NOT EXISTS ix_mensaje_destino_tecnico
    ON mensaje_destino (id_tecnico, id_mensaje);
CREATE INDEX IF NOT EXISTS ix_mensaje_destino_usuario
    ON mensaje_destino (p00, id_mensaje);
"""

VERIFICACION = """
SELECT
  (SELECT count(*) FROM rol WHERE codigo='COORDINADOR') AS rol_coordinador,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema=current_schema() AND table_name='mensaje'
     AND column_name='id_usuario_destino') AS mensaje_usuario_destino,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema=current_schema() AND table_name='mensaje_destino'
     AND column_name IN ('id_destino','id_tecnico','p00')) AS destino_columnas,
  (SELECT count(*) FROM pg_constraint
   WHERE conrelid='mensaje'::regclass AND conname IN
     ('ck_mensaje_destino_tipo','ck_mensaje_destino_xor')) AS checks_mensaje,
  (SELECT count(*) FROM pg_constraint
   WHERE conrelid='mensaje_destino'::regclass AND conname IN
     ('pk_mensaje_destino','ck_mensaje_destino_un_destinatario')) AS checks_destino;
"""


def registrar(texto: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as salida:
        salida.write(f"[{datetime.now(UTC).isoformat(timespec='seconds')}] {texto}\n")
    print(texto)


def conectar(dsn: str | None):
    import psycopg2

    if dsn:
        return psycopg2.connect(dsn, connect_timeout=20)
    faltan = [k for k in ("DB_NAME", "DB_USER", "DB_PASSWORD") if not os.environ.get(k)]
    if faltan:
        registrar(f"ERROR: faltan variables {', '.join(faltan)} o usa --dsn")
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aplicar", action="store_true", help="Aplicar en una transacción")
    parser.add_argument("--si", action="store_true", help="No pedir confirmación interactiva")
    parser.add_argument("--dsn", help="DSN PostgreSQL; también acepta variables DB_*")
    args = parser.parse_args()

    conn = conectar(args.dsn)
    try:
        conn.autocommit = False
        cur = conn.cursor()
        cur.execute(VERIFICACION)
        antes = cur.fetchone()
        registrar(f"D-95 · modo={'APLICAR' if args.aplicar else 'SIMULACIÓN'} · estado={antes}")
        if antes == (1, 1, 3, 2, 2):
            registrar("La migración ya está aplicada; no hay cambios pendientes.")
            conn.rollback()
            return 0
        if not args.aplicar:
            registrar("Simulación: se crearán/ajustarán el rol y los contratos de destinatarios.")
            conn.rollback()
            return 0
        if not args.si and input("¿Aplicar D-95 en esta base? [sí/no] ").strip().lower() not in {
            "sí", "si", "yes", "y"
        }:
            registrar("Cancelado.")
            conn.rollback()
            return 1

        cur.execute(SQL)
        cur.execute(VERIFICACION)
        despues = cur.fetchone()
        if despues != (1, 1, 3, 2, 2):
            raise RuntimeError(f"Verificación posterior inesperada: {despues}")
        conn.commit()
        registrar(f"Migración D-95 aplicada y verificada: {despues}")
        return 0
    except Exception as exc:
        conn.rollback()
        registrar(f"ERROR: transacción revertida: {exc}")
        return 4
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
