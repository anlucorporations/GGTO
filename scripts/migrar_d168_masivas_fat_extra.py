#!/usr/bin/env python3
"""Migración **D-168** — identidad técnica de 5 campos en las fallas masivas.

 =============================================================================
 QUÉ HACE (idempotente; esquema + datos + configuración)
     1. **Esquema**: `ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS
        extra varchar(120)` — el EXTRA del archivo de ingesta (la ruta del
        FAT) como quinto campo de la identidad técnica
        (OLT + slot + puerto + FAT + EXTRA).
     2. **Backfill opcional de `extra`**: para cada masiva **no cerrada** sin
        `extra`, si asociarle casos (`falla_masiva_caso` → `caso`) confirma
        UN ÚNICO EXTRA no vacío compartido por **todos** los casos asociados,
        se copia ese valor. Si los casos asociados discrepan (o están
        vacíos), la masiva queda con `extra = NULL` y el código cae a la
        comparación de 4 campos (legacy) — jamás se adivina la ruta.
     3. **Configuración**: `fallas.umbral_casos` pasa de `5` a `3` (D-168:
        3 o más casos con la misma tupla técnica crean la masiva) y su
        descripción se actualiza.

 POR QUÉ
     La petición del usuario: los casos de una masiva deben tener los datos
     técnicos (OLT, SLOT, PUERTO, FAT, EXTRA) **idénticos** para corroborar
     que pertenecen al mismo FAT; con 3 o más casos se crea la masiva
     automáticamente; y al cerrar la masiva se cierran **solo** los casos
     asociados a ella (eso ya funciona por `falla_masiva_caso`, RF-61/62).

 SEGURIDAD
     · Por defecto es **simulación** (`--aplicar` para escribir).
     · `--si` omite la confirmación interactiva.
     · Todo corre en UNA transacción; el ALTER es idempotente.
     · Sin secretos: los datos de conexión van por `os.environ`,
       `DB_DSN` o `--dsn` (igual que los demás scripts del repo).

 USO
     export DB_DSN='postgresql://user:pwd@host/db'
     python3 scripts/migrar_d168_masivas_fat_extra.py               # simulación
     python3 scripts/migrar_d168_masivas_fat_extra.py --aplicar
     python3 scripts/migrar_d168_masivas_fat_extra.py --aplicar --si
     python3 scripts/migrar_d168_masivas_fat_extra.py --dsn "postgresql://..."
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
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d168.log"

SQL_EXISTE = """
SELECT
    -- ¿la columna ya existe?
    (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'falla_masiva' AND column_name = 'extra') AS columna_extra,
    (SELECT valor::text FROM configuracion
      WHERE clave = 'fallas.umbral_casos') AS umbral_actual
"""

SQL_VERIFICACION = """
SELECT
    -- masivas vivas sin extra, y si su backfill es inequívoco
    (SELECT count(*) FROM falla_masiva
      WHERE estado <> 'CERRADA' AND (extra IS NULL OR trim(extra) = '')) AS vivas_sin_extra,
    (SELECT count(*) FROM falla_masiva f
      WHERE f.estado <> 'CERRADA' AND (f.extra IS NULL OR trim(f.extra) = '')
        AND (SELECT count(DISTINCT trim(c.extra)) FROM falla_masiva_caso fc
             JOIN caso c ON c.id_caso = fc.id_caso
             WHERE fc.id_falla = f.id_falla AND trim(c.extra) <> '') = 1
        AND (SELECT count(*) FROM falla_masiva_caso fc
             JOIN caso c ON c.id_caso = fc.id_caso
             WHERE fc.id_falla = f.id_falla AND trim(c.extra) <> '') > 0
    ) AS backfill_inequivoco
"""

SQL_CAMBIOS = """
-- 1. Columna EXTRA de la identidad técnica (idempotente).
ALTER TABLE falla_masiva ADD COLUMN IF NOT EXISTS extra varchar(120);

-- 2. Backfill: solo cuando TODOS los casos asociados comparten un único EXTRA.
UPDATE falla_masiva f
SET extra = (SELECT trim(c.extra) FROM falla_masiva_caso fc
             JOIN caso c ON c.id_caso = fc.id_caso
             WHERE fc.id_falla = f.id_falla AND trim(c.extra) <> ''
             LIMIT 1),
    actualizado_en = now()
WHERE f.estado <> 'CERRADA'
  AND (f.extra IS NULL OR trim(f.extra) = '')
  AND (SELECT count(DISTINCT trim(c.extra)) FROM falla_masiva_caso fc
       JOIN caso c ON c.id_caso = fc.id_caso
       WHERE fc.id_falla = f.id_falla AND trim(c.extra) <> '') = 1
  AND (SELECT count(*) FROM falla_masiva_caso fc
       JOIN caso c ON c.id_caso = fc.id_caso
       WHERE fc.id_falla = f.id_falla AND trim(c.extra) <> '') > 0;

-- 3. Umbral de detección: 5 → 3 (D-168).
UPDATE configuracion
SET valor = '3'::jsonb,
    descripcion = 'Nº mínimo de casos con la misma tupla técnica '
                  '(OLT/slot/puerto/FAT/EXTRA) para declarar falla masiva (D-168)'
WHERE clave = 'fallas.umbral_casos'
  AND valor IS DISTINCT FROM '3'::jsonb;
"""

UMBRAL_NUEVO = 3


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
        registrar(f"ERROR: faltan variables de entorno: {', '.join(faltan)} "
                  "(o usa --dsn / DB_DSN)")
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
    cur.execute(SQL_EXISTE)
    cols = [d[0] for d in cur.description]
    fila = cur.fetchone()
    return dict(zip(cols, fila, strict=True))


def estado_backfill(cur) -> dict:
    cur.execute(SQL_VERIFICACION)
    cols = [d[0] for d in cur.description]
    fila = cur.fetchone()
    return dict(zip(cols, fila, strict=True))


def main() -> int:
    p = argparse.ArgumentParser(
        description="D-168: identidad técnica de 5 campos (OLT/SLOT/PUERTO/FAT/EXTRA) "
                    "en las fallas masivas + umbral 3."
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
        ya_columna = antes["columna_extra"] > 0
        umbral_ok = (antes["umbral_actual"] or "").startswith(str(UMBRAL_NUEVO))
        pendiente_columna = not ya_columna
        # Backfill: masivas vivas sin extra rellenables (solo si la columna ya
        # existe; si no, el propio ALTER la añade vacía y el backfill corre con ella).
        pendiente_backfill = ya_columna and bool(estado_backfill(cur)["backfill_inequivoco"])
        pendiente_umbral = not umbral_ok

        registrar("=" * 78)
        registrar("MIGRACIÓN D-168 (identidad técnica OLT/SLOT/PUERTO/FAT/EXTRA + umbral 3)")
        registrar(f"modo={'APLICAR' if args.aplicar else 'SIMULACIÓN'}")
        registrar(f"estado actual: {antes}")

        if not (pendiente_columna or pendiente_backfill or pendiente_umbral):
            registrar("✓ La base YA está migrada: no hay cambios pendientes.")
            conn.rollback()
            return 0

        if pendiente_columna:
            registrar("  · añadir columna falla_masiva.extra varchar(120)")
        if pendiente_backfill:
            registrar(f"  · backfill de extra para {antes['backfill_inequivoco']} "
                      "masiva(s) viva(s) (únicamente con EXTRA inequívoco)")
        if pendiente_umbral:
            registrar(f"  · fallas.umbral_casos {antes['umbral_actual']} → 3")

        if not args.aplicar:
            registrar("SIMULACIÓN: no se escribió nada (usa --aplicar).")
            conn.rollback()
            return 0

        if not args.si:
            r = input("¿Aplicar los cambios? escribe 'SI' para confirmar: ").strip()
            if r != "SI":
                registrar("Confirmación rechazada: no se escribió nada.")
                conn.rollback()
                return 0

        cur.execute(SQL_CAMBIOS)
        n_backfill = max(cur.rowcount, 0)
        cur.execute(SQL_VERIFICACION)
        despues = dict(zip([d[0] for d in cur.description],
                           cur.fetchone(), strict=True))
        conn.commit()
        registrar(f"✓ migración aplicada (backfill: {n_backfill} fila(s)); "
                  f"verificación posterior: {despues}")
        return 0
    except Exception as exc:  # noqa: BLE001 — el script registra el fallo y deshace
        conn.rollback()
        registrar(f"ERROR: {exc}")
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
