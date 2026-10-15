#!/usr/bin/env python3
"""Migración D-99: módulo MASIVAS y jornada de despacho.

Aplica sobre la base existente el esquema del incremento D-99:

1. Estado **PENDIENTE** del caso (los despachos cerrados devuelven a PENDIENTE los
   casos que no se cerraron).
2. **Catálogo de personal externo**: se amplía `solicitante` con tipo
   (SOLICITANTE/CRASS/OTRO), documento, central, estado y actualización.
3. Asociación explícita **`falla_masiva_caso`** (CASOS ASOCIADOS y cierre en
   cascada).
4. Columnas de **cierre y ubicación** de la masiva en `falla_masiva`.
5. Columnas de **jornada** en `despacho` (cierre automático a las 23:50).
6. Parámetros nuevos de `configuracion`.

Por defecto solo inspecciona el esquema y muestra los cambios pendientes. La
escritura requiere --aplicar y confirmación (o --si). Todo el DDL y la siembra de
parámetros se ejecutan en **una sola transacción**.

Uso:
    python scripts/migrar_d99_masivas.py
    python scripts/migrar_d99_masivas.py --aplicar
    python scripts/migrar_d99_masivas.py --aplicar --si
    python scripts/migrar_d99_masivas.py --dsn "postgresql://…"
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d99.log"

SQL = """
-- 1. Estado PENDIENTE del caso (se reemplaza el CHECK vigente, sin perder datos).
DO $$
DECLARE c record;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'caso'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%estado_actual%'
    LOOP
        EXECUTE format('ALTER TABLE caso DROP CONSTRAINT %I', c.conname);
    END LOOP;
    ALTER TABLE caso ADD CONSTRAINT ck_caso_estado_actual
        CHECK (estado_actual IN ('NUEVO','PENDIENTE','ASIGNADO','CONTACTADO','CITADO',
                                 'DIFERIDO','EN_GESTION','ENRUTADO','CERRADO','CANCELADO'));
END;
$$;

-- 2. Catálogo de personal externo (se amplía `solicitante`, no se duplica).
ALTER TABLE solicitante ADD COLUMN IF NOT EXISTS id_central integer
    REFERENCES central(id_central);
ALTER TABLE solicitante ADD COLUMN IF NOT EXISTS documento  varchar(30);
ALTER TABLE solicitante ADD COLUMN IF NOT EXISTS tipo       varchar(20)
    NOT NULL DEFAULT 'SOLICITANTE';
ALTER TABLE solicitante ADD COLUMN IF NOT EXISTS activo     boolean NOT NULL DEFAULT true;
ALTER TABLE solicitante ADD COLUMN IF NOT EXISTS actualizado_en timestamptz
    NOT NULL DEFAULT now();

DO $$
DECLARE c record;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'solicitante'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%tipo%'
    LOOP
        EXECUTE format('ALTER TABLE solicitante DROP CONSTRAINT %I', c.conname);
    END LOOP;
    ALTER TABLE solicitante ADD CONSTRAINT ck_solicitante_tipo
        CHECK (tipo IN ('SOLICITANTE','CRASS','OTRO'));
END;
$$;

CREATE INDEX IF NOT EXISTS ix_solicitante_tipo    ON solicitante (tipo, activo);
CREATE INDEX IF NOT EXISTS ix_solicitante_central ON solicitante (id_central, activo);

-- 3. Asociación explícita caso ↔ falla masiva.
CREATE TABLE IF NOT EXISTS falla_masiva_caso (
    id_asociacion   bigserial    PRIMARY KEY,
    id_falla        bigint       NOT NULL REFERENCES falla_masiva(id_falla) ON DELETE CASCADE,
    id_caso         bigint       NOT NULL REFERENCES caso(id_caso) ON DELETE CASCADE,
    origen          varchar(12)  NOT NULL DEFAULT 'AUTO' CHECK (origen IN ('AUTO','MANUAL')),
    agregado_por    varchar(20)  REFERENCES usuario(p00),
    agregado_en     timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (id_falla, id_caso)
);
CREATE INDEX IF NOT EXISTS ix_falla_masiva_caso_caso ON falla_masiva_caso (id_caso);

-- 4. Cierre de la masiva y ubicación del FAT.
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS descripcion_cierre text;
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS id_validador_crass bigint
    REFERENCES solicitante(id_solicitante) ON DELETE SET NULL;
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS evidencias_cierre  text;
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS cerrada_por        varchar(20)
    REFERENCES usuario(p00);
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS cerrada_en         timestamptz;
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS casos_cerrados     integer NOT NULL DEFAULT 0;
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS latitud            numeric(10,7);
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS longitud           numeric(10,7);
CREATE INDEX IF NOT EXISTS ix_falla_masiva_estado
    ON falla_masiva (id_central, estado, fecha_deteccion DESC);

-- 5. Jornada del despacho.
ALTER TABLE despacho ADD COLUMN IF NOT EXISTS cerrado_en     timestamptz;
ALTER TABLE despacho ADD COLUMN IF NOT EXISTS cierre_auto    boolean NOT NULL DEFAULT false;
ALTER TABLE despacho ADD COLUMN IF NOT EXISTS reprocesado_en timestamptz;

-- 6. Parámetros del incremento.
INSERT INTO configuracion (clave, valor, descripcion) VALUES
    ('despacho.hora_cierre_jornada', '"23:50"'::jsonb,
     'Hora del día operativo en que se cierran los despachos; lo no cerrado va a PENDIENTE (D-99)'),
    ('fallas.asociar_automatico', 'true'::jsonb,
     'Asocia a la falla masiva los casos de su concentración al detectarla (D-99)'),
    ('fallas.historico_dias', '90'::jsonb,
     'Días de histórico de masivas que devuelve la sección MASIVAS (D-99)')
ON CONFLICT (clave) DO NOTHING;
"""

VERIFICACION = """
SELECT
  (SELECT count(*) FROM pg_constraint
   WHERE conrelid='caso'::regclass AND contype='c'
     AND pg_get_constraintdef(oid) LIKE '%PENDIENTE%') AS estado_pendiente,
  (SELECT count(*) FROM information_schema.tables
   WHERE table_schema=current_schema() AND table_name='falla_masiva_caso') AS tabla_asociacion,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema=current_schema() AND table_name='falla_masiva'
     AND column_name IN ('descripcion_cierre','id_validador_crass','evidencias_cierre',
                         'cerrada_por','cerrada_en','casos_cerrados','latitud','longitud')
  ) AS columnas_masiva,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema=current_schema() AND table_name='despacho'
     AND column_name IN ('cerrado_en','cierre_auto','reprocesado_en')) AS columnas_despacho,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema=current_schema() AND table_name='solicitante'
     AND column_name IN ('id_central','documento','tipo','activo','actualizado_en')
  ) AS columnas_personal,
  (SELECT count(*) FROM configuracion
   WHERE clave IN ('despacho.hora_cierre_jornada','fallas.asociar_automatico',
                   'fallas.historico_dias')) AS parametros;
"""

#: Estado esperado tras aplicar la migración.
ESPERADO = (1, 1, 8, 3, 5, 3)


def registrar(texto: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as salida:
        salida.write(f"[{datetime.now(UTC).isoformat(timespec='seconds')}] {texto}\n")
    try:
        print(texto)
    except UnicodeEncodeError:  # consolas cp1252
        print(texto.encode("ascii", "replace").decode("ascii"))


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
        registrar(f"D-99 · modo={'APLICAR' if args.aplicar else 'SIMULACIÓN'} · estado={antes}")
        if antes == ESPERADO:
            registrar("La migración ya está aplicada; no hay cambios pendientes.")
            conn.rollback()
            return 0
        if not args.aplicar:
            registrar("Simulación: se creará el módulo MASIVAS y la jornada de despacho.")
            conn.rollback()
            return 0
        if not args.si and input("¿Aplicar D-99 en esta base? [sí/no] ").strip().lower() not in {
            "sí", "si", "yes", "y"
        }:
            registrar("Cancelado.")
            conn.rollback()
            return 1

        cur.execute(SQL)
        cur.execute(VERIFICACION)
        despues = cur.fetchone()
        if despues != ESPERADO:
            raise RuntimeError(f"Verificación posterior inesperada: {despues} (esperado {ESPERADO})")
        conn.commit()
        registrar(f"Migración D-99 aplicada y verificada: {despues}")
        return 0
    except Exception as exc:
        conn.rollback()
        registrar(f"ERROR: transacción revertida: {exc}")
        return 4
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
