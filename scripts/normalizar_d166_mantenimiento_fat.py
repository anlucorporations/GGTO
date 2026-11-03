#!/usr/bin/env python3
"""Normaliza los casos de **mantenimiento FAT** (D-166).

=============================================================================
QUÉ HACE (idempotente; solo datos, sin cambios de catálogo)
    1. Quita la bandera huérfana `es_falla_masiva` de los casos de
       mantenimiento «JUSTIFICATIVO %»: la falla masiva que los originó fue
       **purgada** (no queda fila en `falla_masiva_caso`), y la solicitud de
       mantenimiento es autónoma — su elemento principal es el **FAT**
       (OLT + SLOT + PUERTO + EXTRA), **sin caso de reparación asociado**.
    2. Renombra el caso para que **no lleve el nombre JUSTIFICATIVO**:
       `nombre_cliente` pasa de «JUSTIFICATIVO FAT X» a «MANTENIMIENTO FAT X»
       y `problema_reporte` pierde el rótulo «(caso justificativo)».
    3. Normaliza el texto de `informacion` (caso) y `descripcion` (la
       solicitud, `caso_especial`): «Caso justificativo de la falla masiva #N»
       → «Solicitud de mantenimiento del FAT (masiva #N)».
    4. Deja bitácora en `caso_estado_hist` de cada caso tocado (motivo D-166,
       dueño = P00 del SUPER activo; FK a `usuario(p00)`).

POR QUÉ
    Los casos de mantenimiento no representan a un cliente de reparación:
    representan el **trabajo sobre el FAT**. La bandera `es_falla_masiva=true`
    quedó huérfana cuando el trabajo de purga eliminó las masivas (cascada en
    `falla_masiva_caso` sin recalcular la bandera) y el nombre «JUSTIFICATIVO»
    es un remanente del origen en la ingesta.

SECTOR
    Los casos sin `id_sector` (sin evidencia en la base: no hay otros casos
    con la misma OLT+FAT) quedan con sector NULL: siguen visibles y
    gestionables en la sección MANTENIMIENTO, y solo entran al despacho por
    sectores en cuanto un SUPER les fije sector.

SEGURIDAD
    · Por defecto es **simulación**.
    · Para escribir: `--aplicar` (+ `--si` para omitir la confirmación).
    · Todo corre en UNA transacción.
    · Log en RepoTecnico/BaseOperaciones/normalizacion_fat.log

USO
    export DB_HOST=... DB_NAME=ggtov2 DB_USER=ggtov2_app DB_PASSWORD='...'
    python3 scripts/normalizar_d166_mantenimiento_fat.py               # simulación
    python3 scripts/normalizar_d166_mantenimiento_fat.py --aplicar
    python3 scripts/normalizar_d166_mantenimiento_fat.py --aplicar --si
    python3 scripts/normalizar_d166_mantenimiento_fat.py --dsn "postgresql://user:pwd@host/db"
=============================================================================
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "normalizacion_fat.log"

MOTIVO = ("D-166: normalizada a solicitud de mantenimiento del FAT "
          "(elemento FAT, sin caso de reparación asociado)")

#: Dueño de la bitácora: P00 del SUPER activo (fail-closed; FK a usuario.p00).
SQL_USUARIO = """
SELECT u.p00 FROM usuario u
JOIN rol r ON r.id_rol = u.id_rol
WHERE r.codigo = 'SUPER' AND u.activo
ORDER BY u.id_usuario LIMIT 1
"""

SQL_CAMBIOS = """
-- 1. Bandera huérfana: sin vínculo a masiva ya no es «falla masiva».
UPDATE caso c
SET es_falla_masiva = false,
    actualizado_en = now()
WHERE c.nombre_cliente ILIKE 'JUSTIFICATIVO %'
  AND c.tipo_caso = 'MANTENIMIENTO'
  AND c.es_falla_masiva
  AND NOT EXISTS (SELECT 1 FROM falla_masiva_caso fc WHERE fc.id_caso = c.id_caso);

-- 2. Renombre: fuera el rótulo JUSTIFICATIVO; el FAT queda como elemento.
UPDATE caso c
SET nombre_cliente = 'MANTENIMIENTO ' || substring(c.nombre_cliente from 15),
    problema_reporte = replace(c.problema_reporte,
                               '(caso justificativo)', '(mantenimiento)'),
    informacion = regexp_replace(c.informacion,
        'Caso justificativo de la falla masiva #([0-9]+)',
        'Solicitud de mantenimiento del FAT (masiva #\\1)'),
    actualizado_en = now()
WHERE c.nombre_cliente ILIKE 'JUSTIFICATIVO %'
  AND c.tipo_caso = 'MANTENIMIENTO'
  AND c.estado_actual = 'PENDIENTE';

-- 3. La solicitud (caso_especial) acompaña el mismo renombre.
UPDATE caso_especial ce
SET descripcion = regexp_replace(ce.descripcion,
        'Caso justificativo de la falla masiva #([0-9]+)',
        'Solicitud de mantenimiento del FAT (masiva #\\1)'),
    actualizado_en = now()
WHERE ce.id_caso IN (
      SELECT c.id_caso FROM caso c
      WHERE c.tipo_caso = 'MANTENIMIENTO' AND c.estado_actual = 'PENDIENTE'
        AND (c.nombre_cliente ILIKE 'MANTENIMIENTO FAT %'
             OR c.nombre_cliente ILIKE 'JUSTIFICATIVO %'))
  AND ce.descripcion ILIKE 'Caso justificativo%';

-- 4. Bitácora de la normalización (un renglón por caso tocado). Idempotente.
INSERT INTO caso_estado_hist (id_caso, estado_anterior, estado_nuevo, motivo, usuario)
SELECT c.id_caso, c.estado_actual, c.estado_actual, '__MOTIVO__', '__USUARIO__'
FROM caso c
WHERE c.tipo_caso = 'MANTENIMIENTO'
  AND c.nombre_cliente ILIKE 'MANTENIMIENTO FAT %'
  AND c.estado_actual = 'PENDIENTE'
  AND NOT EXISTS (
      SELECT 1 FROM caso_estado_hist h
      WHERE h.id_caso = c.id_caso AND h.motivo = '__MOTIVO__'
  );
"""


def sql_cambios(usuario: str) -> str:
    return SQL_CAMBIOS.replace("__MOTIVO__", MOTIVO) \
                      .replace("__USUARIO__", usuario)


VERIFICACION = """
SELECT
    (SELECT count(*) FROM caso
      WHERE tipo_caso = 'MANTENIMIENTO'
        AND nombre_cliente ILIKE 'JUSTIFICATIVO %') AS con_nombre_justificativo,
    (SELECT count(*) FROM caso
      WHERE tipo_caso = 'MANTENIMIENTO'
        AND nombre_cliente ILIKE 'MANTENIMIENTO FAT %') AS ya_renombrados,
    (SELECT count(*) FROM caso
      WHERE tipo_caso = 'MANTENIMIENTO'
        AND es_falla_masiva
        AND NOT EXISTS (SELECT 1 FROM falla_masiva_caso fc
                        WHERE fc.id_caso = caso.id_caso)) AS banderas_huerfanas_global,
    (SELECT count(*) FROM caso
      WHERE tipo_caso = 'MANTENIMIENTO'
        AND (nombre_cliente ILIKE 'JUSTIFICATIVO %'
             OR nombre_cliente ILIKE 'MANTENIMIENTO FAT %')) AS poblacion,
    (SELECT count(*) FROM caso
      WHERE es_falla_masiva
        AND (nombre_cliente ILIKE 'JUSTIFICATIVO %'
             OR nombre_cliente ILIKE 'MANTENIMIENTO FAT %')
        AND NOT EXISTS (SELECT 1 FROM falla_masiva_caso fc
                        WHERE fc.id_caso = caso.id_caso)) AS bandera_huerfana,
    (SELECT count(*) FROM caso
      WHERE tipo_caso = 'MANTENIMIENTO'
        AND (nombre_cliente ILIKE 'JUSTIFICATIVO %'
             OR nombre_cliente ILIKE 'MANTENIMIENTO FAT %')
        AND estado_actual = 'PENDIENTE'
        AND id_sector IS NULL) AS sin_sector,
    (SELECT count(*) FROM caso_estado_hist
      WHERE motivo LIKE 'D-166:%') AS filas_bitacora_d166
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
    if os.environ.get("DB_DSN"):
        dsn = re.sub(r"@34[^/?\s]*", "@127.0.0.1:5433", os.environ["DB_DSN"], count=1)
        return psycopg2.connect(dsn + "&sslmode=disable" if "?" in dsn
                                else dsn + "?sslmode=disable", connect_timeout=20)
    faltan = [v for v in ("DB_NAME", "DB_USER", "DB_PASSWORD") if not os.environ.get(v)]
    if faltan:
        registrar(f"ERROR: faltan variables de entorno: {', '.join(faltan)} (o usa --dsn / DB_DSN)")
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
        description="D-166: normaliza los casos de mantenimiento FAT (sin caso de reparación asociado)."
    )
    p.add_argument("--aplicar", action="store_true", help="Escribe los cambios (por defecto simula)")
    p.add_argument("--si", action="store_true", help="Omite la confirmación interactiva")
    p.add_argument("--dsn", default=None, help="Cadena de conexión (alternativa a DB_* / DB_DSN)")
    args = p.parse_args()

    conn = conectar(args)
    try:
        conn.autocommit = False
        cur = conn.cursor()

        antes = estado_actual(cur)
        registrar("=" * 78)
        registrar("NORMALIZACIÓN D-166 (JUSTIFICATIVO → solicitud de mantenimiento del FAT)")
        registrar(f"modo={'APLICAR' if args.aplicar else 'SIMULACIÓN'}")
        registrar(f"estado actual: {antes}")

        pendiente = (
            antes["con_nombre_justificativo"] > 0
            or antes["bandera_huerfana"] > 0
            or (antes["ya_renombrados"] > 0
                and antes["filas_bitacora_d166"] < antes["ya_renombrados"])
        )
        if not pendiente:
            registrar("✓ La base YA está normalizada: no hay cambios pendientes.")
            if antes["banderas_huerfanas_global"]:
                registrar(f"  (aviso) hay {antes['banderas_huerfanas_global']} bandera(s) "
                          "huérfana(s) fuera del alcance de esta normalización")
            conn.rollback()
            return 0

        registrar("Cambios pendientes:")
        if antes["banderas_huerfanas_global"] > antes["bandera_huerfana"]:
            registrar(f"  (aviso) {antes['banderas_huerfanas_global'] - antes['bandera_huerfana']} "
                      "bandera(s) huérfana(s) quedan fuera del alcance")
        if antes["con_nombre_justificativo"]:
            registrar(f"  · renombrar {antes['con_nombre_justificativo']} caso(s) "
                      "«JUSTIFICATIVO FAT X» → «MANTENIMIENTO FAT X»")
        if antes["bandera_huerfana"]:
            registrar(f"  · quitar bandera es_falla_masiva huérfana en "
                      f"{antes['bandera_huerfana']} caso(s) (masiva purgada)")
        if antes["sin_sector"]:
            registrar(f"  · {antes['sin_sector']} quedarán sin sector: "
                      "sin evidencia en la base (sector lo fija un SUPER desde MANTENIMIENTO)")

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

        cur.execute(SQL_USUARIO)
        fila_super = cur.fetchone()
        if not fila_super:
            conn.rollback()
            registrar("ERROR: no hay un usuario SUPER activo para la bitácora; abortado.")
            return 5
        dueno = fila_super[0]
        registrar(f"dueño de la bitácora (FK usuario.p00): SUPER «{dueno}»")

        cur.execute(sql_cambios(dueno))
        conn.commit()

        despues = estado_actual(cur)
        registrar(f"verificación post-normalización: {despues}")
        ok = (despues["con_nombre_justificativo"] == 0
              and despues["bandera_huerfana"] == 0
              and despues["ya_renombrados"] == despues["poblacion"]
              and despues["filas_bitacora_d166"] >= despues["ya_renombrados"])
        registrar("RESULTADO: " + ("OK — normalización completa ✓" if ok
                                   else "⚠ revisar los contadores post"))
        return 0 if ok else 4
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
