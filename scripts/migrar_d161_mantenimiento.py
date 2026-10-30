#!/usr/bin/env python3
"""Aplica la **migración D-161** (mantenimiento de fallas masivas).

=============================================================================
QUÉ HACE (idempotente; un solo lote de datos + un cambio de catálogo)
    1. Reemplaza el CHECK de `caso.tipo_caso` por el catálogo completo,
       que ahora admite `MANTENIMIENTO` (D-161).
    2. Reclasifica como `MANTENIMIENTO` los casos «JUSTIFICATIVO» **pendientes**
       generados por la detección automática de fallas masivas (dueno del
       nombre: `nombre_cliente ILIKE 'JUSTIFICATIVO %'`).
    3. Hereda el sector de la falla masiva cuando el caso no tiene ninguno,
       para que el despacho pueda **agruparlo por sector** y asignarlo a la
       cuadrilla de ese sector (regla D-113).
    4. Registra la reclasificación en la bitácora de cada caso
       (`caso_estado_hist`) con motivo y, como dueño, el **P00 del usuario
       SUPER** resuelto de la propia base (la columna tiene FK a
       `usuario(p00)`).

POR QUÉ
    Los casos «JUSTIFICATIVO» nacían como `tipo_caso='CONSTRUCCION'` porque era
    el tipo por omisión de la ingesta GPON, no porque lo sean: son trabajos de
    **mantenimiento** de una FAT atenuada. Como tipo propio, el despacho los
    separa en su bloque `MANTENIMIENTO` (D-161) y el reporte de producción los
    cuenta aparte.

REGLAS DECIDIDAS (2026-10-29)
    · Se reclasifica **solo lo pendiente**; lo cerrado queda con su tipo
      histórico para no alterar las métricas.
    · El caso de mantenimiento es **independiente** de la masiva: cerrar el
      caso NO cierra la falla (ese cierre sigue el ciclo CRASS aparte).

SEGURIDAD
    · Por defecto es **simulación**.
    · Para escribir hay que pasar `--aplicar` y confirmar (o `--si`).
    · Todo corre en UNA transacción.
    · Registra cada ejecución en RepoTecnico/BaseOperaciones/migracion_d161.log

USO
    export DB_HOST=... DB_NAME=ggtov2 DB_USER=ggtov2_app DB_PASSWORD='...'
    python3 scripts/migrar_d161_mantenimiento.py                 # simulación
    python3 scripts/migrar_d161_mantenimiento.py --aplicar       # aplica con confirmación
    python3 scripts/migrar_d161_mantenimiento.py --aplicar --si  # aplica sin preguntar
    python3 scripts/migrar_d161_mantenimiento.py --dsn "postgresql://user:pwd@host/db"
=============================================================================
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d161.log"

MOTIVO = "D-161: reclasificado a MANTENIMIENTO (JUSTIFICATIVO de falla masiva)"

CATALOGO_TIPO_CASO = "('AVERIA','REPARACION','CONSTRUCCION','REFERIDO','MANTENIMIENTO')"

#: `caso_estado_hist.usuario` tiene FK a `usuario(p00)`, así que el dueño de la
#: bitácora debe ser el **P00 de un usuario real**: se resuelve el SUPER activo
#: (fail-closed: sin SUPER en la base, la migración no escribe).
SQL_USUARIO = """
SELECT u.p00 FROM usuario u
JOIN rol r ON r.id_rol = u.id_rol
WHERE r.codigo = 'SUPER' AND u.activo
ORDER BY u.id_usuario LIMIT 1
"""

SQL_CAMBIOS = """
DO $$
DECLARE
    restriccion record;
BEGIN
    -- 1. Catálogo: elimina cualquier CHECK previo de tipo_caso y repone el
    --    completo, que ahora admite MANTENIMIENTO (el nombre generado por la
    --    tabla original no está fijado, se busca por definición).
    FOR restriccion IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'caso'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%tipo_caso%'
    LOOP
        EXECUTE format('ALTER TABLE caso DROP CONSTRAINT %I', restriccion.conname);
    END LOOP;
    ALTER TABLE caso
        ADD CONSTRAINT caso_tipo_caso_check
        CHECK (tipo_caso IN __CATALOGO__);

    -- 1.b Descriptor del despacho: el CHECK de tipo_asignacion admite el
    --     bloque MANTENIMIENTO (mismo catálogo nuevo en `despacho_caso`).
    FOR restriccion IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'despacho_caso'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%tipo_asignacion%'
          AND pg_get_constraintdef(oid) ILIKE '%construccion%'
    LOOP
        EXECUTE format('ALTER TABLE despacho_caso DROP CONSTRAINT %I', restriccion.conname);
    END LOOP;
    ALTER TABLE despacho_caso
        ADD CONSTRAINT despacho_caso_tipo_asignacion_check
        CHECK (tipo_asignacion IN
               ('REPARACION','CONSTRUCCION','REFERIDO','EMPRESA','FALLA_MASIVA',
                'MANTENIMIENTO'));
END $$;

-- 2. Reclasificación (solo pendientes). Idempotente: el WHERE acota por el
--    estado PRE-MIGRACIÓN, así que repetir no vuelve a contar nada.
UPDATE caso c
SET tipo_caso = 'MANTENIMIENTO',
    -- 3. Hereda el sector de la falla masiva si no tiene uno propio, para que
    --    el despacho lo agrupe por sector (D-161).
    id_sector = COALESCE(c.id_sector, (
        SELECT f.id_sector FROM falla_masiva_caso fc
        JOIN falla_masiva f ON f.id_falla = fc.id_falla
        WHERE fc.id_caso = c.id_caso
          AND f.estado <> 'CERRADA'
        ORDER BY f.id_falla DESC
        LIMIT 1
    ))
WHERE c.nombre_cliente ILIKE 'JUSTIFICATIVO %'
  AND c.tipo_caso = 'CONSTRUCCION'
  AND c.estado_actual = 'PENDIENTE';

-- 4. Bitácora de la reclasificación (un renglón por caso tocado). El dueño es
--    el P00 del SUPER, resuelto en la base (FK a `usuario(p00)`).
INSERT INTO caso_estado_hist (id_caso, estado_anterior, estado_nuevo, motivo, usuario)
SELECT c.id_caso, c.estado_actual, c.estado_actual, '__MOTIVO__', '__USUARIO__'
FROM caso c
WHERE c.tipo_caso = 'MANTENIMIENTO'
  AND c.nombre_cliente ILIKE 'JUSTIFICATIVO %'
  AND c.estado_actual = 'PENDIENTE'
  AND NOT EXISTS (
      SELECT 1 FROM caso_estado_hist h
      WHERE h.id_caso = c.id_caso AND h.usuario = '__USUARIO__'
  );
"""


def sql_cambios(usuario: str) -> str:
    """SQL con el catálogo, el motivo y el dueño (P00 del SUPER) interpolados."""
    return (
        SQL_CAMBIOS
        .replace("__CATALOGO__", CATALOGO_TIPO_CASO)
        .replace("__MOTIVO__", MOTIVO)
        .replace("__USUARIO__", usuario)
    )

VERIFICACION = """
SELECT
    (SELECT count(*) FROM pg_constraint
      WHERE conrelid = 'caso'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%MANTENIMIENTO%') AS catalogo_mantenimiento,
    (SELECT count(*) FROM pg_constraint
      WHERE conrelid = 'despacho_caso'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%MANTENIMIENTO%') AS catalogo_despacho,
    (SELECT count(*) FROM caso
      WHERE tipo_caso = 'MANTENIMIENTO') AS casos_reclasificados,
    (SELECT count(*) FROM caso
      WHERE nombre_cliente ILIKE 'JUSTIFICATIVO %'
        AND tipo_caso = 'CONSTRUCCION'
        AND estado_actual = 'PENDIENTE') AS pendientes_reclasificacion,
    (SELECT count(*) FROM caso
      WHERE tipo_caso = 'MANTENIMIENTO'
        AND nombre_cliente ILIKE 'JUSTIFICATIVO %'
        AND estado_actual = 'PENDIENTE'
        AND id_sector IS NULL) AS sin_sector
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
        description="Migración D-161: casos JUSTIFICATIVO de masivas pasan a MANTENIMIENTO."
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
        registrar("MIGRACIÓN D-161 (casos JUSTIFICATIVO → MANTENIMIENTO)")
        registrar(f"modo={'APLICAR' if args.aplicar else 'SIMULACIÓN'}")
        registrar(f"estado actual: {antes}")

        if antes["pendientes_reclasificacion"] == 0 and antes["catalogo_mantenimiento"] > 0 \
                and antes["catalogo_despacho"] > 0:
            registrar("✓ La base YA está migrada: no hay cambios pendientes.")
            conn.rollback()
            return 0

        registrar("Cambios pendientes:")
        if not antes["catalogo_mantenimiento"]:
            registrar("  · ampliar el CHECK de caso.tipo_caso con MANTENIMIENTO")
        if not antes["catalogo_despacho"]:
            registrar("  · ampliar el CHECK de despacho_caso.tipo_asignacion con MANTENIMIENTO")
        registrar(
            f"  · reclasificar {antes['pendientes_reclasificacion']} caso(s) "
            "JUSTIFICATIVO pendientes a MANTENIMIENTO"
        )
        if antes["sin_sector"]:
            registrar(f"  · {antes['sin_sector']} quedarán sin sector "
                      "(sin falla masiva sectorizada asociada)")

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

        # Dueño de la bitácora: el P00 del SUPER activo (FK a `usuario(p00)`).
        cur.execute(SQL_USUARIO)
        fila_super = cur.fetchone()
        if not fila_super:
            conn.rollback()
            registrar("ERROR: no hay un usuario SUPER activo para la bitácora; abortado.")
            return 5
        dueño_bitacora = fila_super[0]
        registrar(f"dueño de la bitácora (FK usuario.p00): SUPER «{dueño_bitacora}»")

        cur.execute(sql_cambios(dueño_bitacora))
        conn.commit()

        despues = estado_actual(cur)
        registrar(f"verificación post-migración: {despues}")
        ok = (
            despues["catalogo_mantenimiento"] > 0
            and despues["catalogo_despacho"] > 0
            and despues["pendientes_reclasificacion"] == 0
        )
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
